import Dexie from "dexie";
import { db } from "../db/database";
import { appendAudit } from "./audit";
import type { PendingOperation } from "../types";
const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
export async function queueOrValidate(operation: PendingOperation) {
  await db.pendingOperations.put(operation);
  if (!navigator.onLine) return { queued: true };
  return syncOne(operation);
}
export async function syncOne(op: PendingOperation) {
  await db.pendingOperations.update(op.operationId, { status: "SYNCING" });
  try {
    const res = await fetch(`${API}/api/sync/operation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(op),
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
  } catch (e) {
    if (e instanceof TypeError)
      await db.pendingOperations.update(op.operationId, {
        status: "PENDING_SYNC",
        retryCount: op.retryCount + 1,
        lastError: "Waiting for connection",
      });
    throw e;
  }
}
async function applyChanges(c: Record<string, any>) {
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
      for (const event of c.auditEvents || []) {
        const { previousEventHash: _, currentEventHash: __, ...raw } = event;
      // Hashing uses Web Crypto, so explicitly keep this IndexedDB
      // transaction alive while the audit hash is calculated.
      await Dexie.waitFor(appendAudit(raw));
      }
    },
  );
}
export async function syncPending() {
  const ops = await db.pendingOperations
    .where("status")
    .equals("PENDING_SYNC")
    .sortBy("createdAt");
  for (const op of ops) {
    try {
      await syncOne(op);
    } catch {}
  }
}
