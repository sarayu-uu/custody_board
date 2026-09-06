import Dexie, { type EntityTable } from "dexie";
import type {
  AuditEvent,
  Emergency,
  Handoff,
  Machine,
  Maintenance,
  PendingOperation,
  Reservation,
  Town,
} from "../types";
import * as seed from "./seed";
type Simple = { id: string; [key: string]: unknown };
export class RoadShareDB extends Dexie {
  towns!: EntityTable<Town, "id">;
  machines!: EntityTable<Machine, "id">;
  reservations!: EntityTable<Reservation, "id">;
  handoffs!: EntityTable<Handoff, "id">;
  conditionLogs!: EntityTable<Simple, "id">;
  emergencyRequests!: EntityTable<Emergency, "id">;
  maintenanceRecords!: EntityTable<Maintenance, "id">;
  auditEvents!: EntityTable<AuditEvent, "id">;
  attachments!: EntityTable<Simple, "id">;
  pendingOperations!: EntityTable<PendingOperation, "operationId">;
  appMetadata!: EntityTable<Simple, "id">;
  constructor() {
    super("YeldurthyRoadShare");
    this.version(1).stores({
      towns: "id,name",
      machines: "id,status,currentCustodianId",
      reservations: "id,machineId,townId,status,startAt",
      handoffs: "id,machineId,status",
      conditionLogs: "id,machineId",
      emergencyRequests: "id,machineId,status",
      maintenanceRecords: "id,machineId,status",
      auditEvents: "id,timestamp,machineId,actingTownId,action",
      attachments: "id,relatedRecordId",
      pendingOperations: "operationId,status,createdAt",
      appMetadata: "id",
    });
    this.version(2)
      .stores({
        towns: "id,name",
        machines: "id,status,currentCustodianId",
        reservations: "id,machineId,townId,status,startAt",
        handoffs: "id,machineId,status",
        conditionLogs: "id,machineId",
        emergencyRequests: "id,machineId,status",
        maintenanceRecords: "id,machineId,status",
        auditEvents: "id,timestamp,machineId,actingTownId,action",
        attachments: "id,relatedRecordId",
        pendingOperations: "operationId,status,createdAt",
        appMetadata: "id",
      })
      .upgrade(async (tx) => {
        await tx.table("towns").bulkPut(seed.towns);
        const historical = seed.reservations.filter((r) =>
          r.id.startsWith("hist-"),
        );
        await tx.table("reservations").bulkPut(historical);
      });
    this.version(3)
      .stores({
        towns: "id,name",
        machines: "id,status,currentCustodianId",
        reservations: "id,machineId,townId,status,startAt",
        handoffs: "id,machineId,status",
        conditionLogs: "id,machineId",
        emergencyRequests: "id,machineId,status",
        maintenanceRecords: "id,machineId,status",
        auditEvents: "id,timestamp,machineId,actingTownId,action",
        attachments: "id,relatedRecordId",
        pendingOperations: "operationId,status,createdAt",
        appMetadata: "id",
      })
      .upgrade(async (tx) => {
        await tx.table("towns").bulkPut(seed.towns);
        await tx
          .table("reservations")
          .bulkPut(seed.reservations.filter((r) => r.id.startsWith("hist-")));
        await tx
          .table("machines")
          .toCollection()
          .modify((m) => {
            m.baseYard = "Town A Central Equipment Yard";
            m.physicalLocation = m.physicalLocation
              .replace("Mangalparthy", "Town A")
              .replace("M. Jalalpur", "Town B")
              .replace("Manepalle", "Town C")
              .replace("Kuknoor", "Town D");
          });
      });
    this.version(4)
      .stores({
        towns: "id,name",
        machines: "id,status,currentCustodianId",
        reservations: "id,machineId,townId,status,startAt",
        handoffs: "id,machineId,status",
        conditionLogs: "id,machineId",
        emergencyRequests: "id,machineId,status",
        maintenanceRecords: "id,machineId,status",
        auditEvents: "id,timestamp,machineId,actingTownId,action",
        attachments: "id,relatedRecordId",
        pendingOperations: "operationId,status,createdAt",
        appMetadata: "id",
      })
      .upgrade(async (tx) => {
        const neutralize = (value: string = "") =>
          value
            .replace(/mannevar jalalpur/gi, "Town B")
            .replace(/m\.\s*jalalpur/gi, "Town B")
            .replace(/jalalpur/gi, "Town B")
            .replace(/mangalparthy/gi, "Town A")
            .replace(/manepalle/gi, "Town C")
            .replace(/kuknoor/gi, "Town D");
        await tx.table("towns").bulkPut(seed.towns);
        await tx
          .table("machines")
          .toCollection()
          .modify((m) => {
            m.physicalLocation = neutralize(m.physicalLocation);
            m.baseYard = neutralize(m.baseYard);
          });
        await tx
          .table("reservations")
          .toCollection()
          .modify((r) => {
            r.workLocation = neutralize(r.workLocation);
          });
        await tx
          .table("emergencyRequests")
          .toCollection()
          .modify((e) => {
            e.affectedLocation = neutralize(e.affectedLocation);
          });
      });
    this.version(5)
      .stores({
        towns: "id,name",
        machines: "id,status,currentCustodianId",
        reservations: "id,machineId,townId,status,startAt",
        handoffs: "id,machineId,status",
        conditionLogs: "id,machineId",
        emergencyRequests: "id,machineId,status",
        maintenanceRecords: "id,machineId,status",
        auditEvents: "id,timestamp,machineId,actingTownId,action",
        attachments: "id,relatedRecordId",
        pendingOperations: "operationId,status,createdAt",
        appMetadata: "id",
      })
      .upgrade(async (tx) => {
        await tx.table("machines").update("MDK-BL-02", {
          status: "AVAILABLE",
          currentCustodianId: "mangalparthy",
          physicalLocation: "Town A Yard",
        });
        await tx.table("reservations").update("res-bl-current", {
          status: "COMPLETED",
        });
      });
    this.version(6)
      .stores({
        towns: "id,name", machines: "id,status,currentCustodianId",
        reservations: "id,machineId,townId,status,startAt", handoffs: "id,machineId,status",
        conditionLogs: "id,machineId", emergencyRequests: "id,machineId,status",
        maintenanceRecords: "id,machineId,status", auditEvents: "id,timestamp,machineId,actingTownId,action",
        attachments: "id,relatedRecordId", pendingOperations: "operationId,status,createdAt", appMetadata: "id",
      })
      .upgrade(async (tx) => {
        await tx.table("machines").update("MDK-BL-02", {
          status: "AVAILABLE", currentCustodianId: "mangalparthy", physicalLocation: "Town A Yard",
        });
        await tx.table("machines").update("MDK-GR-01", {
          status: "IN_USE", currentCustodianId: "mangalparthy", physicalLocation: "Town A Yard",
        });
        await tx.table("machines").update("MDK-PP-03", {
          status: "MAINTENANCE_LOCKED", currentCustodianId: "jalalpur", physicalLocation: "Town B Yard",
        });
        await tx.table("reservations").update("res-gr-current", { status: "ACTIVE", townId: "mangalparthy" });
        await tx.table("reservations").update("res-gr-next", { status: "UPCOMING", townId: "kuknoor" });
        await tx.table("reservations").update("res-bl-current", { status: "COMPLETED" });
        await tx.table("reservations").update("res-bl-next", { status: "CANCELLED" });
        await tx.table("handoffs").update("handoff-pending", { status: "COMPLETED", completedAt: new Date().toISOString() });
        await tx.table("maintenanceRecords").toCollection().modify((record) => {
          if (record.machineId === "MDK-GR-01") record.status = "CLEARED";
        });
      });
    this.version(7)
      .stores({
        towns: "id,name", machines: "id,status,currentCustodianId",
        reservations: "id,machineId,townId,status,startAt", handoffs: "id,machineId,status",
        conditionLogs: "id,machineId", emergencyRequests: "id,machineId,status",
        maintenanceRecords: "id,machineId,status", auditEvents: "id,timestamp,machineId,actingTownId,action",
        attachments: "id,relatedRecordId", pendingOperations: "operationId,status,createdAt", appMetadata: "id",
      })
      .upgrade(async (tx) => {
        const grader = await tx.table("machines").get("MDK-GR-01");
        const next = await tx.table("reservations").get("res-gr-next");
        if (grader?.currentCustodianId === "jalalpur" && next?.townId === "kuknoor") {
          await tx.table("machines").update("MDK-GR-01", {
            currentCustodianId: "kuknoor",
            physicalLocation: "Town D Yard",
          });
          await tx.table("reservations").update("res-gr-current", { status: "COMPLETED" });
          await tx.table("reservations").update("res-gr-next", { status: "ACTIVE" });
        }
      });
    this.auditEvents.hook("updating", () => {
      throw new Error("Audit records are append-only and cannot be edited.");
    });
    this.auditEvents.hook("deleting", () => {
      throw new Error("Audit records are append-only and cannot be deleted.");
    });
    this.on("populate", () => this.seed());
  }
  async seed() {
    await this.towns.bulkAdd(seed.towns);
    await this.machines.bulkAdd(seed.machines);
    await this.reservations.bulkAdd(seed.reservations);
    await this.handoffs.bulkAdd(seed.handoffs);
    await this.emergencyRequests.bulkAdd(seed.emergencies);
    await this.maintenanceRecords.bulkAdd(seed.maintenance);
    let previous = "GENESIS";
    for (const raw of seed.audits) {
      const body = JSON.stringify({ ...raw, previousEventHash: previous });
      // Web Crypto resolves outside IndexedDB's normal promise chain. waitFor
      // keeps the populate transaction alive until the hash is ready.
      const hash = await Dexie.waitFor(sha256(body));
      await this.auditEvents.add({
        ...raw,
        previousEventHash: previous,
        currentEventHash: hash,
      });
      previous = hash;
    }
    await this.appMetadata.add({
      id: "sync",
      lastSynchronizedAt: "2026-09-05T12:00:00+05:30",
      demo: true,
    });
  }
  async resetDemo() {
    this.close();
    await Dexie.delete("YeldurthyRoadShare");
    location.reload();
  }
}
export async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export const db = new RoadShareDB();
