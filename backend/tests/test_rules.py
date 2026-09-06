from copy import deepcopy
from fastapi.testclient import TestClient
from backend.app.main import app

c=TestClient(app); now='2026-09-07T08:00:00+05:30'; later='2026-09-07T16:00:00+05:30'
machine={'id':'MDK-GR-01','name':'Motor Grader','status':'AVAILABLE','currentCustodianId':'mangalparthy','physicalLocation':'Central Yard','fuelPercentage':70,'hourMeter':1842.6,'version':1}
def req(kind,role='CREW_CHIEF',payload=None,state=None): return {'operationId':'op-1','operationType':kind,'entityId':'record-1','actor':{'role':role,'townId':'mangalparthy'},'payload':payload or {},'currentState':state or {'machine':machine,'reservations':[]}}
def post(kind,body): return c.post('/api/validate/'+kind,json=body)
def booking(): return {'machineId':'MDK-GR-01','townId':'kuknoor','startAt':now,'endAt':later,'purpose':'Grade approach road','workLocation':'Kuknoor west road'}

def test_health(): assert c.get('/api/health').status_code==200
def test_production_origin_receives_cors_headers():
    headers={'Origin':'https://roadshare-app.onrender.com'}
    response=c.get('/api/health',headers=headers)
    assert response.headers['access-control-allow-origin']=='https://roadshare-app.onrender.com'
def test_valid_reservation(): assert post('reservation',req('reservation',payload=booking())).status_code==200
def test_future_reservation_keeps_machine_available_now():
    changes=post('reservation',req('reservation',payload=booking())).json()['changes']
    assert 'machines' not in changes
def test_machine_display_fields_survive_backend_updates():
    rich={**machine,'type':'Grader','jointOwner':'Shared pool','baseYard':'Town A Yard','lastConditionSummary':'Safe','purpose':['Grade roads']}
    current={**booking(),'id':'current','townId':'mangalparthy','status':'ACTIVE','version':1}
    response=post('handoff',req('handoff',payload=handoff(),state={'machine':rich,'reservations':[current]}))
    updated=response.json()['changes']['machines'][0]
    assert updated['purpose']==['Grade roads']
    assert updated['type']=='Grader'
def test_past_reservation_rejected():
    p={**booking(),'startAt':'2020-01-01T08:00:00+05:30','endAt':'2020-01-01T16:00:00+05:30'}
    assert post('reservation',req('reservation',payload=p)).json()['code']=='RESERVATION_IN_PAST'
def test_overlap_rejected():
    b={**booking(),'id':'b1','status':'UPCOMING','version':1}; r=req('reservation',payload=booking(),state={'machine':machine,'reservations':[b]}); assert post('reservation',r).json()['code']=='RESERVATION_OVERLAP'
def test_locked_booking_rejected():
    m={**machine,'status':'MAINTENANCE_LOCKED'}; assert post('reservation',req('reservation',payload=booking(),state={'machine':m,'reservations':[]})).json()['code']=='MACHINE_MAINTENANCE_LOCKED'
def handoff(): return {'machineId':'MDK-GR-01','receivingTownId':'kuknoor','physicalLocation':'Kuknoor Yard','fuelPercentage':65,'hourMeter':1845.2,'conditionNotes':'No new damage','receivingConfirmed':True,'checks':{}}
def test_valid_handoff(): assert post('handoff',req('handoff',payload=handoff())).status_code==200
def test_final_handoff_makes_machine_available_when_no_booking_remains():
    current={**booking(),'id':'current','townId':'mangalparthy','status':'ACTIVE','version':1}
    response=post('handoff',req('handoff',payload=handoff(),state={'machine':{**machine,'status':'IN_USE'},'reservations':[current]}))
    changes=response.json()['changes']
    assert changes['machines'][0]['status']=='AVAILABLE'
    assert changes['reservations'][0]['status']=='COMPLETED'
def test_handoff_must_follow_next_booking():
    p={**handoff(),'receivingTownId':'jalalpur'}
    b={**booking(),'id':'next','status':'UPCOMING','version':1}
    response=post('handoff',req('handoff',payload=p,state={'machine':machine,'reservations':[b]}))
    assert response.json()['code']=='RECEIVER_BOOKING_MISMATCH'
def test_handoff_completes_current_and_activates_next_booking():
    current={**booking(),'id':'current','townId':'mangalparthy','status':'ACTIVE','version':1}
    next_booking={**booking(),'id':'next','status':'UPCOMING','version':1}
    response=post('handoff',req('handoff',payload=handoff(),state={'machine':machine,'reservations':[current,next_booking]}))
    statuses={item['id']:item['status'] for item in response.json()['changes']['reservations']}
    assert statuses=={'current':'COMPLETED','next':'ACTIVE'}
def test_handoff_missing_notes():
    p=handoff();p['conditionNotes']='';assert post('handoff',req('handoff',payload=p)).json()['code']=='FIELD_REQUIRED'
def test_hour_decrease():
    p=handoff();p['hourMeter']=100;assert post('handoff',req('handoff',payload=p)).json()['code']=='HOUR_METER_DECREASE'
def test_unauthorized_handoff(): assert post('handoff',req('handoff','FLEET_MECHANIC',handoff())).status_code==403
def emergency_payload(): return {'machineId':'MDK-GR-01','status':'PENDING','decision':'APPROVED','requestingTownId':'kuknoor','startAt':now,'endAt':later,'affectedLocation':'Canal road','category':'Blocked culvert','justification':'Ambulance route blocked'}
def test_emergency_preemption_preserves_booking():
    b={**booking(),'id':'old','status':'UPCOMING','version':1}; r=req('emergency-decision','TOWN_ADMIN',emergency_payload(),{'machine':machine,'reservations':[b]}); out=post('emergency-decision',r).json()['changes']; assert any(x['status']=='PREEMPTED' and x['originalDetails'] for x in out['reservations'])
    assert any(x['id']=='record-1-booking' for x in out['reservations'])
def test_emergency_accepts_browser_local_time_against_zoned_booking():
    p={**emergency_payload(),'startAt':'2026-09-07T08:00','endAt':'2026-09-07T16:00'}
    b={**booking(),'id':'old','status':'UPCOMING','version':1}
    response=post('emergency-decision',req('emergency-decision','TOWN_ADMIN',p,{'machine':machine,'reservations':[b]}))
    assert response.status_code==200
    assert any(x['status']=='PREEMPTED' for x in response.json()['changes']['reservations'])
def test_emergency_locked():
    m={**machine,'status':'MAINTENANCE_LOCKED'};r=req('emergency-decision','TOWN_ADMIN',emergency_payload(),{'machine':m,'reservations':[]});assert post('emergency-decision',r).json()['code']=='MACHINE_MAINTENANCE_LOCKED'
def test_second_overlapping_emergency_is_rejected():
    emergency={**booking(),'id':'urgent-one','status':'UPCOMING','version':1,'isEmergency':True}
    response=post('emergency-decision',req('emergency-decision','TOWN_ADMIN',emergency_payload(),{'machine':machine,'reservations':[emergency]}))
    assert response.json()['code']=='EMERGENCY_OVERLAP'
def test_repair_completion_waits_for_town_admin_clearance():
    p={'id':'maint','machineId':'MDK-GR-01','status':'LOCKED','diagnosis':'Seal failed','repairActions':'Seal replaced','completionNotes':'Pressure tested'}
    m={**machine,'status':'MAINTENANCE_LOCKED'}; state={'machine':m,'reservations':[{**booking(),'id':'risk','status':'AT_RISK','version':1}],'maintenanceRecords':[p]}
    changes=post('repair-completion',req('repair-completion','FLEET_MECHANIC',p,state)).json()['changes']
    assert changes['machines'][0]['status']=='MAINTENANCE_LOCKED'
    assert changes['maintenanceRecords'][0]['status']=='REPAIRED_AWAITING_CLEARANCE'
    assert changes['reservations']==[]
    assert [event['action'] for event in changes['auditEvents']]==['REPAIR_COMPLETED']
def test_invalid_clearance_transition():
    m={**machine,'status':'MAINTENANCE_LOCKED'};p={'status':'LOCKED'};assert post('maintenance-clearance',req('maintenance-clearance','TOWN_ADMIN',p,{'machine':m})).json()['code']=='REPAIR_NOT_COMPLETE'
def test_town_admin_clearance_returns_machine_to_service():
    p={'id':'maint','machineId':'MDK-GR-01','status':'REPAIRED_AWAITING_CLEARANCE','clearanceNotes':'Inspected and approved'}
    m={**machine,'status':'MAINTENANCE_LOCKED'}
    risk={**booking(),'id':'risk','status':'AT_RISK','version':1}
    state={'machine':m,'reservations':[risk],'maintenanceRecords':[p]}
    changes=post('maintenance-clearance',req('maintenance-clearance','TOWN_ADMIN',p,state)).json()['changes']
    assert changes['machines'][0]['status']=='AVAILABLE'
    assert changes['maintenanceRecords'][0]['status']=='CLEARED'
    assert changes['reservations'][0]['status']=='UPCOMING'
def test_duplicate_maintenance_lock_rejected():
    m={**machine,'status':'MAINTENANCE_LOCKED'};p={'machineId':m['id'],'severity':'SERIOUS','notes':'Still leaking'}
    assert post('maintenance-lock',req('maintenance-lock','FLEET_MECHANIC',p,{'machine':m,'reservations':[]})).json()['code']=='MAINTENANCE_ALREADY_LOCKED'

def test_crew_chief_defect_requires_proof():
    p={'machineId':machine['id'],'severity':'SERIOUS','notes':'Hydraulic hose is leaking'}
    response=post('maintenance-lock',req('maintenance-lock','CREW_CHIEF',p))
    assert response.status_code==422
    assert response.json()['code']=='PROOF_REQUIRED'

def test_crew_chief_can_report_defect_with_proof():
    p={'machineId':machine['id'],'severity':'SERIOUS','notes':'Hydraulic hose is leaking','attachmentIds':['photo-1']}
    changes=post('maintenance-lock',req('maintenance-lock','CREW_CHIEF',p)).json()['changes']
    assert changes['machines'][0]['status']=='MAINTENANCE_LOCKED'
    assert changes['maintenanceRecords'][0]['attachmentIds']==['photo-1']

def test_fleet_mechanic_can_report_defect_without_proof():
    p={'machineId':machine['id'],'severity':'SERIOUS','notes':'Hydraulic hose is leaking'}
    changes=post('maintenance-lock',req('maintenance-lock','FLEET_MECHANIC',p)).json()['changes']
    assert changes['machines'][0]['status']=='MAINTENANCE_LOCKED'
