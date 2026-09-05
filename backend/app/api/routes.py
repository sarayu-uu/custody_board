from fastapi import APIRouter
from backend.app.schemas.models import ValidationRequest
from backend.app.services.validation import validate

router=APIRouter(prefix='/api')
@router.get('/health')
def health(): return {'status':'ok','service':'yeldurthy-roadshare-validator'}

for _kind in ('reservation','handoff','emergency-request','emergency-decision','maintenance-lock','repair-completion','maintenance-clearance'):
    def make_endpoint(kind):
        async def endpoint(req:ValidationRequest): return {'ok':True,'operationId':req.operationId,'changes':validate(kind,req)}
        return endpoint
    router.add_api_route(f'/validate/{_kind}',make_endpoint(_kind),methods=['POST'])

@router.post('/sync/operation')
async def sync(req:ValidationRequest):
    kind=req.operationType.lower().replace('_','-')
    return {'ok':True,'operationId':req.operationId,'changes':validate(kind,req)}
