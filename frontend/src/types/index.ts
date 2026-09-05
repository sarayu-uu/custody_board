export type Role = "CREW_CHIEF" | "TOWN_ADMIN" | "FLEET_MECHANIC";
export type MachineStatus =
  "AVAILABLE" | "RESERVED" | "IN_USE" | "HANDOFF_DUE" | "MAINTENANCE_LOCKED";
export type ReservationStatus =
  "UPCOMING" | "ACTIVE" | "COMPLETED" | "CANCELLED" | "PREEMPTED" | "AT_RISK";
export type SyncStatus =
  | "LOCAL_DRAFT"
  | "PENDING_SYNC"
  | "SYNCING"
  | "SYNCED"
  | "CONFLICT"
  | "FAILED_VALIDATION";
export interface Town {
  id: string;
  name: string;
  shortName: string;
  color: string;
  yard: string;
}
export interface Machine {
  id: string;
  name: string;
  type: string;
  jointOwner: string;
  baseYard: string;
  currentCustodianId: string;
  physicalLocation: string;
  status: MachineStatus;
  fuelPercentage: number;
  hourMeter: number;
  lastConditionSummary: string;
  version: number;
  purpose: string[];
}
export interface Reservation {
  id: string;
  machineId: string;
  townId: string;
  startAt: string;
  endAt: string;
  workLocation: string;
  purpose: string;
  status: ReservationStatus;
  version: number;
  preemptedById?: string;
  originalDetails?: unknown;
  isEmergency?: boolean;
  requiresHandoff?: boolean;
}
export interface Handoff {
  id: string;
  machineId: string;
  sendingTownId: string;
  receivingTownId: string;
  status: "PENDING" | "COMPLETED";
  dueAt: string;
  completedAt?: string;
  version: number;
}
export interface Maintenance {
  id: string;
  machineId: string;
  category: string;
  severity: string;
  notes: string;
  canMoveSafely: boolean;
  status:
    | "REPORTED"
    | "LOCKED"
    | "REPAIR_IN_PROGRESS"
    | "REPAIRED_AWAITING_CLEARANCE"
    | "CLEARED";
  diagnosis?: string;
  repairActions?: string;
  partsUsed?: string;
  completionNotes?: string;
}
export interface Emergency {
  id: string;
  machineId: string;
  requestingTownId: string;
  category: string;
  startAt: string;
  endAt: string;
  affectedLocation: string;
  justification: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN";
  conflictingReservationId?: string;
}
export interface AuditEvent {
  id: string;
  timestamp: string;
  actingRole: Role;
  actingTownId?: string;
  machineId: string;
  action: string;
  relatedRecordId: string;
  before: unknown;
  after: unknown;
  reason: string;
  previousEventHash: string;
  currentEventHash: string;
}
export interface PendingOperation {
  operationId: string;
  operationType: string;
  entityId: string;
  baseVersion: number;
  createdAt: string;
  payload: Record<string, unknown>;
  currentState: Record<string, unknown>;
  actor: { role: Role; townId?: string };
  status: SyncStatus;
  retryCount: number;
  lastError?: string;
}
