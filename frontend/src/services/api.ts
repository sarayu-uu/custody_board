import { db } from "../db/database";
import { sha256 } from "../db/database";
import { useUI } from "../stores/ui";
import type { AuditEvent, PendingOperation } from "../types";
const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
export async function queueOrValidate(operation: PendingOperation) {
  await db.pendingOperations.put(operation);
  if (!navigator.onLine || useUI.getState().offlineTest) {
    await applyOptimistic(operation);
    return { queued: true };
  }
  return syncOne(operation);
}
export async function syncOne(op: PendingOperation) {
  await db.pendingOperations.update(op.operationId, { status: "SYNCING" });
  try {
    const res = await fetch(`${API}/api/sync/operation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(op),
      signal: AbortSignal.timeout(65000),
    });
    const body = await res.json();
    if (!res.ok) {
      const conflict = [
        "RESERVATION_OVERLAP",
        "NOT_CURRENT_CUSTODIAN",
        "MACHINE_MAINTENANCE_LOCKED",
        "HOUR_METER_DECREASE",
      ].includes(body.code);
      await db.pendingOperations.update(op.operationId, {
        status: conflict ? "CONFLICT" : "FAILED_VALIDATION",
        retryCount: op.retryCount + 1,
        lastError: body.message,
      });
      await rollbackOptimistic(op);
      throw body;
    }
    await applyChanges(body.changes);
    await db.pendingOperations.update(op.operationId, { status: "SYNCED" });
    await db.appMetadata.put({
      id: "sync",
      lastSynchronizedAt: new Date().toISOString(),
      demo: true,
    });
    return body;
  } catch (e: any) {
    if (!e?.code)
      await db.pendingOperations.update(op.operationId, {
        status: "PENDING_SYNC",
        retryCount: op.retryCount + 1,
        lastError:
          "Server unavailable. Check the connection and retry.",
      });
    throw e;
  }
}
async function applyChanges(c: Record<string, any>) {
  const preparedAudits: AuditEvent[] = [];
  let previous =
    (await db.auditEvents.orderBy("timestamp").last())?.currentEventHash ||
    "GENESIS";
  for (const event of c.auditEvents || []) {
    const existing = await db.auditEvents.get(event.id);
    if (existing) {
      previous = existing.currentEventHash;
      continue;
    }
    const { previousEventHash: _, currentEventHash: __, ...raw } = event;
    const currentEventHash = await sha256(
      JSON.stringify({ ...raw, previousEventHash: previous }),
    );
    preparedAudits.push({ ...raw, previousEventHash: previous, currentEventHash });
    previous = currentEventHash;
  }
  await db.transaction(
    "rw",
    [
      db.machines,
      db.reservations,
      db.handoffs,
      db.conditionLogs,
      db.emergencyRequests,
      db.maintenanceRecords,
      db.auditEvents,
    ],
    async () => {
      if (c.machines) await db.machines.bulkPut(c.machines);
      if (c.reservations) await db.reservations.bulkPut(c.reservations);
      if (c.handoffs) await db.handoffs.bulkPut(c.handoffs);
      if (c.conditionLogs) await db.conditionLogs.bulkPut(c.conditionLogs);
      if (c.emergencyRequests)
        await db.emergencyRequests.bulkPut(c.emergencyRequests);
      if (c.maintenanceRecords)
        await db.maintenanceRecords.bulkPut(c.maintenanceRecords);
      if (preparedAudits.length)
        await db.auditEvents.bulkAdd(preparedAudits);
    },
  );
}
export async function syncPending() {
  const ops = await db.pendingOperations
    .where("status")
    .anyOf("PENDING_SYNC", "SYNCING")
    .sortBy("createdAt");
  for (const op of ops) {
    try {
      await syncOne(op);
    } catch {}
  }
}

async function applyOptimistic(op: PendingOperation) {
  const type = op.operationType.toLowerCase().replaceAll("_", "-");
  const payload: any = op.payload;
  const state: any = op.currentState;
  const machine: any = state.machine;
  if (type === "reservation") {
    await db.transaction("rw", db.machines, db.reservations, async () => {
      await db.reservations.put({ ...payload, id: op.entityId, status: "UPCOMING" });
      if (machine?.status === "AVAILABLE")
        await db.machines.put({ ...machine, status: "RESERVED", version: machine.version + 1 });
    });
  } else if (type === "handoff") {
    await db.transaction("rw", db.machines, db.reservations, db.handoffs, async () => {
      const upcoming = (state.reservations || []).filter((r: any) => r.machineId === machine.id && ["UPCOMING", "AT_RISK"].includes(r.status)).sort((a: any, b: any) => a.startAt.localeCompare(b.startAt))[0];
      await db.machines.put({ ...machine, currentCustodianId: payload.receivingTownId, physicalLocation: payload.physicalLocation, fuelPercentage: Number(payload.fuelPercentage), hourMeter: Number(payload.hourMeter), status: upcoming ? "IN_USE" : "AVAILABLE", version: machine.version + 1 });
      for (const r of state.reservations || []) {
        if (r.machineId === machine.id && r.status === "ACTIVE") await db.reservations.put({ ...r, status: "COMPLETED" });
        else if (upcoming && r.id === upcoming.id) await db.reservations.put({ ...r, status: "ACTIVE" });
      }
      await db.handoffs.put({ ...payload, id: op.entityId, status: "COMPLETED", completedAt: new Date().toISOString(), version: 1 });
    });
  } else if (type === "emergency-request") {
    await db.emergencyRequests.put({ ...payload, id: op.entityId, requestingTownId: op.actor.townId, status: "PENDING" });
  } else if (type === "maintenance-lock") {
    const serious = ["SERIOUS", "CRITICAL"].includes(payload.severity);
    await db.transaction("rw", db.machines, db.reservations, db.maintenanceRecords, async () => {
      await db.maintenanceRecords.put({ ...payload, id: op.entityId, machineId: machine.id, status: serious ? "LOCKED" : "REPORTED" });
      if (serious) {
        await db.machines.put({ ...machine, status: "MAINTENANCE_LOCKED", version: machine.version + 1 });
        for (const r of state.reservations || []) if (r.machineId === machine.id && r.status === "UPCOMING") await db.reservations.put({ ...r, status: "AT_RISK" });
      }
    });
  } else if (type === "emergency-decision") {
    await db.transaction("rw", db.emergencyRequests, db.reservations, async () => {
      await db.emergencyRequests.put({ ...payload, status: payload.decision, approvedBy: "TOWN_ADMIN" });
      if (payload.decision === "APPROVED") {
        const start = new Date(payload.startAt), end = new Date(payload.endAt);
        for (const r of state.reservations || []) {
          if (r.machineId === machine.id && ["UPCOMING", "ACTIVE", "AT_RISK"].includes(r.status) && start < new Date(r.endAt) && end > new Date(r.startAt))
            await db.reservations.put({ ...r, status: "PREEMPTED", preemptedById: op.entityId, originalDetails: r });
        }
        await db.reservations.put({ id: `${op.entityId}-booking`, machineId: machine.id, townId: payload.requestingTownId, startAt: payload.startAt, endAt: payload.endAt, workLocation: payload.affectedLocation, purpose: payload.category, status: "UPCOMING", isEmergency: true, requiresHandoff: true, version: 1 });
      }
    });
  } else if (type === "repair-completion") {
    await db.transaction("rw", db.machines, db.maintenanceRecords, async () => {
      await db.machines.put({ ...machine, status: "MAINTENANCE_LOCKED", version: machine.version + 1 });
      for (const record of state.maintenanceRecords || [])
        if (record.machineId === machine.id && record.status !== "CLEARED")
          await db.maintenanceRecords.put({ ...record, ...payload, status: "REPAIRED_AWAITING_CLEARANCE" });
    });
  } else if (type === "maintenance-clearance") {
    await db.transaction("rw", db.machines, db.reservations, db.maintenanceRecords, async () => {
      await db.machines.put({ ...machine, status: "AVAILABLE", version: machine.version + 1 });
      for (const record of state.maintenanceRecords || []) if (record.machineId === machine.id && record.status !== "CLEARED") await db.maintenanceRecords.put({ ...record, ...payload, status: "CLEARED" });
      for (const r of state.reservations || []) if (r.machineId === machine.id && r.status === "AT_RISK") await db.reservations.put({ ...r, status: "UPCOMING" });
    });
  }
}

async function rollbackOptimistic(op: PendingOperation) {
  const type = op.operationType.toLowerCase().replaceAll("_", "-");
  const state: any = op.currentState;
  if (state.machine) await db.machines.put(state.machine);
  if (state.reservations) await db.reservations.bulkPut(state.reservations);
  if (state.maintenanceRecords) await db.maintenanceRecords.bulkPut(state.maintenanceRecords);
  if (type === "reservation") await db.reservations.delete(op.entityId);
  if (type === "emergency-request") await db.emergencyRequests.delete(op.entityId);
  if (type === "maintenance-lock") await db.maintenanceRecords.delete(op.entityId);
  if (type === "handoff") {
    const previous = state.handoff;
    if (previous) await db.handoffs.put(previous);
    else await db.handoffs.delete(op.entityId);
  }
  if (type === "emergency-decision") {
    await db.emergencyRequests.put({ ...op.payload, status: "PENDING" } as any);
    await db.reservations.delete(`${op.entityId}-booking`);
  }
}
