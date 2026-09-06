from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, Field

Role = Literal['CREW_CHIEF','TOWN_ADMIN','FLEET_MECHANIC']
MachineStatus = Literal['AVAILABLE','RESERVED','IN_USE','HANDOFF_DUE','MAINTENANCE_LOCKED']
ReservationStatus = Literal['UPCOMING','ACTIVE','COMPLETED','CANCELLED','PREEMPTED','AT_RISK']

class Machine(BaseModel):
    id: str; name: str = ''; status: MachineStatus; currentCustodianId: str | None = None
    physicalLocation: str = ''; fuelPercentage: int = 0; hourMeter: float = 0; version: int = 1

class Reservation(BaseModel):
    id: str; machineId: str; townId: str; startAt: datetime; endAt: datetime
    workLocation: str = ''; purpose: str = ''; status: ReservationStatus = 'UPCOMING'
    version: int = 1; preemptedById: str | None = None; preemptionReason: str | None = None; originalDetails: dict[str, Any] | None = None
    isEmergency: bool = False; requiresHandoff: bool = False

class Actor(BaseModel):
    role: Role; townId: str | None = None

class ValidationRequest(BaseModel):
    operationId: str; operationType: str; entityId: str; baseVersion: int = 1
    actor: Actor; payload: dict[str, Any]; currentState: dict[str, Any] = Field(default_factory=dict)

class AcceptedChange(BaseModel):
    entities: dict[str, Any] = Field(default_factory=dict)
    auditEvents: list[dict[str, Any]] = Field(default_factory=list)

class SuccessResponse(BaseModel):
    ok: Literal[True] = True; operationId: str; changes: AcceptedChange

class ErrorResponse(BaseModel):
    code: str; message: str; field: str | None = None; details: dict[str, Any] = Field(default_factory=dict)
