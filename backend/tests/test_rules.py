from copy import deepcopy
from fastapi.testclient import TestClient
from backend.app.main import app

c=TestClient(app); now='2026-09-07T08:00:00+05:30'; later='2026-09-07T16:00:00+05:30'
machine={'id':'MDK-GR-01','name':'Motor Grader','status':'AVAILABLE','currentCustodianId':'mangalparthy','physicalLocation':'Central Yard','fuelPercentage':70,'hourMeter':1842.6,'version':1}
def req(kind,role='CREW_CHIEF',payload=None,state=None): return {'operationId':'op-1','operationType':kind,'entityId':'record-1','actor':{'role':role,'townId':'mangalparthy'},'payload':payload or {},'currentState':state or {'machine':machine,'reservations':[]}}
def post(kind,body): return c.post('/api/validate/'+kind,json=body)
def booking(): return {'machineId':'MDK-GR-01','townId':'kuknoor','startAt':now,'endAt':later,'purpose':'Grade approach road','workLocation':'Kuknoor west road'}

def test_health(): assert c.get('/api/health').status_code==200
def test_valid_reservation(): assert post('reservation',req('reservation',payload=booking())).status_code==200
def test_overlap_rejected():
    b={**booking(),'id':'b1','status':'UPCOMING','version':1}; r=req('reservation',payload=booking(),state={'machine':machine,'reservations':[b]}); assert post('reservation',r).json()['code']=='RESERVATION_OVERLAP'
def test_locked_booking_rejected():
    m={**machine,'status':'MAINTENANCE_LOCKED'}; assert post('reservation',req('reservation',payload=booking(),state={'machine':m,'reservations':[]})).json()['code']=='MACHINE_MAINTENANCE_LOCKED'
def handoff(): return {'machineId':'MDK-GR-01','receivingTownId':'kuknoor','physicalLocation':'Kuknoor Yard','fuelPercentage':65,'hourMeter':1845.2,'conditionNotes':'No new damage','receivingConfirmed':True,'checks':{}}
def test_valid_handoff(): assert post('handoff',req('handoff',payload=handoff())).status_code==200
def test_handoff_missing_notes():
    p=handoff();p['conditionNotes']='';assert post('handoff',req('handoff',payload=p)).json()['code']=='FIELD_REQUIRED'
def test_hour_decrease():
    p=handoff();p['hourMeter']=100;assert post('handoff',req('handoff',payload=p)).json()['code']=='HOUR_METER_DECREASE'
def test_unauthorized_handoff(): assert post('handoff',req('handoff','FLEET_MECHANIC',handoff())).status_code==403
def emergency_payload(): return {'machineId':'MDK-GR-01','status':'PENDING','decision':'APPROVED','requestingTownId':'kuknoor','startAt':now,'endAt':later,'affectedLocation':'Canal road','category':'Blocked culvert','justification':'Ambulance route blocked'}
def test_emergency_preemption_preserves_booking():
    b={**booking(),'id':'old','status':'UPCOMING','version':1}; r=req('emergency-decision','TOWN_ADMIN',emergency_payload(),{'machine':machine,'reservations':[b]}); out=post('emergency-decision',r).json()['changes']; assert any(x['status']=='PREEMPTED' and x['originalDetails'] for x in out['reservations'])
def test_emergency_locked():
    m={**machine,'status':'MAINTENANCE_LOCKED'};r=req('emergency-decision','TOWN_ADMIN',emergency_payload(),{'machine':m,'reservations':[]});assert post('emergency-decision',r).json()['code']=='MACHINE_MAINTENANCE_LOCKED'
def test_repair_completion_returns_machine_to_service():
    p={'id':'maint','machineId':'MDK-GR-01','status':'LOCKED','diagnosis':'Seal failed','repairActions':'Seal replaced','completionNotes':'Pressure tested'}
    m={**machine,'status':'MAINTENANCE_LOCKED'}; state={'machine':m,'reservations':[{**booking(),'id':'risk','status':'AT_RISK','version':1}],'maintenanceRecords':[p]}
    changes=post('repair-completion',req('repair-completion','FLEET_MECHANIC',p,state)).json()['changes']
    assert changes['machines'][0]['status']=='AVAILABLE'
    assert changes['maintenanceRecords'][0]['status']=='CLEARED'
    assert changes['reservations'][0]['status']=='UPCOMING'
def test_invalid_clearance_transition():
    m={**machine,'status':'MAINTENANCE_LOCKED'};p={'status':'LOCKED'};assert post('maintenance-clearance',req('maintenance-clearance','TOWN_ADMIN',p,{'machine':m})).json()['code']=='REPAIR_NOT_COMPLETE'
