from datetime import datetime, timezone, timedelta
from uuid import uuid5, NAMESPACE_URL
from backend.app.domain.errors import DomainError
from backend.app.schemas.models import ValidationRequest, Machine, Reservation

ACTIVE_BOOKING = {'UPCOMING','ACTIVE','AT_RISK'}
LOCAL_TIMEZONE = timezone(timedelta(hours=5, minutes=30))

def comparable_time(value):
    """Return an aware UTC datetime; browser datetime-local values are IST."""
    parsed = value if isinstance(value, datetime) else datetime.fromisoformat(value.replace('Z','+00:00'))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=LOCAL_TIMEZONE)
    return parsed.astimezone(timezone.utc)

def audit(req: ValidationRequest, action: str, before=None, after=None, reason=''):
    related=(after or {}).get('id','') if isinstance(after,dict) else ''
    event_id=str(uuid5(NAMESPACE_URL,f'roadshare:{req.operationId}:{action}:{related}'))
    return {'id':event_id,'timestamp':datetime.now(timezone.utc).isoformat(),'actingRole':req.actor.role,
      'actingTownId':req.actor.townId,'machineId':req.payload.get('machineId',req.entityId),'action':action,
      'relatedRecordId':req.entityId,'before':before,'after':after,'reason':reason}

def machine(req): return Machine.model_validate(req.currentState.get('machine', {}))
def reservations(req): return [Reservation.model_validate(x) for x in req.currentState.get('reservations', [])]
def require_role(req, *roles):
    if req.actor.role not in roles: raise DomainError('ROLE_NOT_ALLOWED','Your current role cannot perform this action.',status=403)
def require_unlocked(m):
    if m.status == 'MAINTENANCE_LOCKED': raise DomainError('MACHINE_MAINTENANCE_LOCKED','This machine cannot be used until the repair is cleared.')
def interval(payload):
    try: start,end=comparable_time(payload['startAt']),comparable_time(payload['endAt'])
    except (KeyError,ValueError): raise DomainError('INVALID_DATE_RANGE','Enter a valid start and end time.','startAt')
    if start >= end: raise DomainError('INVALID_DATE_RANGE','Start must be before end.','endAt')
    return start,end

def validate_reservation(req):
    require_role(req,'CREW_CHIEF','TOWN_ADMIN'); m=machine(req); require_unlocked(m); start,end=interval(req.payload)
    if start < datetime.now(timezone.utc): raise DomainError('RESERVATION_IN_PAST','A reservation cannot start in the past.','startAt')
    for existing in reservations(req):
        if existing.machineId==m.id and existing.status in ACTIVE_BOOKING and start < comparable_time(existing.endAt) and end > comparable_time(existing.startAt):
            raise DomainError('RESERVATION_OVERLAP','This time overlaps another booking.',details={'reservationId':existing.id})
    for f in ('purpose','workLocation'):
        if not str(req.payload.get(f,'')).strip(): raise DomainError('FIELD_REQUIRED',f'{f} is required.',f)
    r={**req.payload,'id':req.entityId,'status':'UPCOMING','version':1}
    result={'reservations':[r],'auditEvents':[audit(req,'RESERVATION_CREATED',None,r,req.payload['purpose'])]}
    if m.status=='AVAILABLE': result['machines']=[m.model_copy(update={'status':'RESERVED','version':m.version+1}).model_dump()]
    return result

def validate_handoff(req):
    require_role(req,'CREW_CHIEF'); m=machine(req); require_unlocked(m); p=req.payload
    if req.actor.townId != m.currentCustodianId: raise DomainError('NOT_CURRENT_CUSTODIAN','Only the town holding the machine can start this handoff.',status=403)
    for f in ('fuelPercentage','hourMeter','conditionNotes'):
        if p.get(f) is None or (isinstance(p.get(f),str) and not p[f].strip()): raise DomainError('FIELD_REQUIRED',f'{f} is required.',f)
    if float(p['hourMeter']) < m.hourMeter: raise DomainError('HOUR_METER_DECREASE','Hour meter cannot be lower than the last reading.','hourMeter')
    if not p.get('receivingConfirmed'): raise DomainError('RECEIVING_CONFIRMATION_REQUIRED','The receiving crew must confirm custody.','receivingConfirmed')
    if p.get('receivingTownId') == m.currentCustodianId: raise DomainError('INVALID_RECEIVER','Choose a different receiving town.','receivingTownId')
    upcoming=sorted([r for r in reservations(req) if r.machineId==m.id and r.status in ('UPCOMING','AT_RISK')],key=lambda r:r.startAt)
    if upcoming and p.get('receivingTownId') != upcoming[0].townId: raise DomainError('RECEIVER_BOOKING_MISMATCH','Custody must transfer to the town with the next booking.','receivingTownId')
    updated=m.model_copy(update={'currentCustodianId':p['receivingTownId'],'physicalLocation':p['physicalLocation'],'fuelPercentage':int(p['fuelPercentage']),'hourMeter':float(p['hourMeter']),'status':'IN_USE','version':m.version+1}).model_dump()
    booking_updates=[]
    for r in reservations(req):
        if r.machineId==m.id and r.status=='ACTIVE': booking_updates.append(r.model_copy(update={'status':'COMPLETED'}).model_dump(mode='json'))
        elif upcoming and r.id==upcoming[0].id: booking_updates.append(r.model_copy(update={'status':'ACTIVE'}).model_dump(mode='json'))
    condition={k:p.get(k) for k in ('conditionNotes','checks','attachmentIds')}; condition.update({'id':f'{req.entityId}-condition','machineId':m.id})
    handoff={**p,'id':req.entityId,'status':'COMPLETED','completedAt':datetime.now(timezone.utc).isoformat()}
    return {'machines':[updated],'reservations':booking_updates,'handoffs':[handoff],'conditionLogs':[condition],'auditEvents':[audit(req,'CONDITION_RECORDED',None,condition,p['conditionNotes']),audit(req,'CUSTODY_TRANSFERRED',m.model_dump(),updated,p['conditionNotes'])]}

def validate_emergency_request(req):
    require_role(req,'CREW_CHIEF'); m=machine(req); require_unlocked(m); start,_=interval(req.payload)
    if start < datetime.now(timezone.utc): raise DomainError('EMERGENCY_IN_PAST','Emergency use cannot start in the past.','startAt')
    if not str(req.payload.get('justification','')).strip(): raise DomainError('FIELD_REQUIRED','Emergency justification is required.','justification')
    er={**req.payload,'id':req.entityId,'requestingTownId':req.actor.townId,'status':'PENDING'}
    return {'emergencyRequests':[er],'auditEvents':[audit(req,'EMERGENCY_REQUESTED',None,er,req.payload['justification'])]}

def validate_emergency_decision(req):
    require_role(req,'TOWN_ADMIN'); m=machine(req); require_unlocked(m); p=req.payload
    if p.get('status')!='PENDING': raise DomainError('INVALID_TRANSITION','Only a pending request can be decided.')
    decision=p.get('decision')
    if decision not in ('APPROVED','REJECTED'): raise DomainError('INVALID_TRANSITION','Decision must be approved or rejected.','decision')
    result={'emergencyRequests':[{**p,'status':decision,'approvedBy':'TOWN_ADMIN'}]}
    events=[audit(req,f'EMERGENCY_{decision}',{'status':'PENDING'},{'status':decision},p.get('justification',''))]
    if decision=='APPROVED':
        start,end=interval(p); affected=[]
        for r in reservations(req):
            if r.machineId==m.id and r.status in ACTIVE_BOOKING and start<comparable_time(r.endAt) and end>comparable_time(r.startAt):
                affected.append(r.model_copy(update={'status':'PREEMPTED','preemptedById':req.entityId,'originalDetails':r.model_dump(mode='json')}).model_dump(mode='json'))
                events.append(audit(req,'BOOKING_PREEMPTED',r.model_dump(mode='json'),affected[-1],p['justification']))
        emergency_booking={'id':f'{req.entityId}-booking','machineId':m.id,'townId':p['requestingTownId'],'startAt':p['startAt'],'endAt':p['endAt'],'workLocation':p['affectedLocation'],'purpose':p['category'],'status':'UPCOMING','isEmergency':True,'requiresHandoff':True,'version':1}
        result['reservations']=affected+[emergency_booking]
    result['auditEvents']=events; return result

def validate_maintenance_lock(req):
    require_role(req,'CREW_CHIEF','FLEET_MECHANIC'); m=machine(req); p=req.payload
    if not str(p.get('notes','')).strip(): raise DomainError('FIELD_REQUIRED','Defect notes are required.','notes')
    serious=p.get('severity') in ('SERIOUS','CRITICAL'); updated=m.model_copy(update={'status':'MAINTENANCE_LOCKED' if serious else m.status,'version':m.version+1}).model_dump()
    if serious and m.status=='MAINTENANCE_LOCKED': raise DomainError('MAINTENANCE_ALREADY_LOCKED','This machine already has an active maintenance lock.')
    at_risk=[r.model_copy(update={'status':'AT_RISK'}).model_dump(mode='json') for r in reservations(req) if r.machineId==m.id and r.status=='UPCOMING'] if serious else []
    record={**p,'id':req.entityId,'machineId':m.id,'status':'LOCKED' if serious else 'REPORTED'}
    return {'machines':[updated],'reservations':at_risk,'maintenanceRecords':[record],'auditEvents':[audit(req,'DEFECT_REPORTED',None,record,p['notes'])]+([audit(req,'MAINTENANCE_LOCK_APPLIED',m.model_dump(),updated,p['notes'])] if serious else [])}

def validate_repair_completion(req):
    require_role(req,'FLEET_MECHANIC'); p=req.payload; m=machine(req)
    if p.get('status') not in ('LOCKED','REPAIR_IN_PROGRESS'): raise DomainError('INVALID_TRANSITION','This repair cannot be marked complete from its current state.')
    for f in ('diagnosis','repairActions','completionNotes'):
        if not str(p.get(f,'')).strip(): raise DomainError('FIELD_REQUIRED',f'{f} is required.',f)
    # The safety lock remains until a Town Admin independently clears it.
    updated_machine=m.model_copy(update={'status':'MAINTENANCE_LOCKED','version':m.version+1}).model_dump()
    open_records=req.currentState.get('maintenanceRecords',[])
    awaiting_records=[{**record,'status':'REPAIRED_AWAITING_CLEARANCE','completionNotes':p['completionNotes'],'diagnosis':p['diagnosis'],'repairActions':p['repairActions'],'partsUsed':p.get('partsUsed','')} for record in open_records if record.get('machineId')==m.id and record.get('status')!='CLEARED']
    if not awaiting_records: awaiting_records=[{**p,'status':'REPAIRED_AWAITING_CLEARANCE'}]
    return {'machines':[updated_machine],'reservations':[],'maintenanceRecords':awaiting_records,'auditEvents':[audit(req,'REPAIR_COMPLETED',p,awaiting_records[0],p['completionNotes'])]}

def validate_maintenance_clearance(req):
    require_role(req,'TOWN_ADMIN'); m=machine(req); p=req.payload
    if p.get('status')!='REPAIRED_AWAITING_CLEARANCE': raise DomainError('REPAIR_NOT_COMPLETE','The mechanic must complete the repair before Town Admin clearance.')
    updated=m.model_copy(update={'status':'AVAILABLE','version':m.version+1}).model_dump()
    open_records=req.currentState.get('maintenanceRecords',[])
    closed_records=[{**record,'status':'CLEARED','clearanceNotes':p.get('clearanceNotes','')} for record in open_records if record.get('machineId')==m.id and record.get('status')!='CLEARED']
    if not closed_records: closed_records=[{**p,'status':'CLEARED'}]
    restored=[r.model_copy(update={'status':'UPCOMING'}).model_dump(mode='json') for r in reservations(req) if r.machineId==m.id and r.status=='AT_RISK']
    return {'machines':[updated],'reservations':restored,'maintenanceRecords':closed_records,'auditEvents':[audit(req,'MAINTENANCE_LOCK_CLEARED',m.model_dump(),updated,p.get('clearanceNotes',''))]}

VALIDATORS={'reservation':validate_reservation,'handoff':validate_handoff,'emergency-request':validate_emergency_request,'emergency-decision':validate_emergency_decision,'maintenance-lock':validate_maintenance_lock,'repair-completion':validate_repair_completion,'maintenance-clearance':validate_maintenance_clearance}

def validate(kind,req):
    if kind not in VALIDATORS: raise DomainError('UNKNOWN_OPERATION','This operation is not supported.')
    return VALIDATORS[kind](req)
