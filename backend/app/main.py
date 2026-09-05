import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from backend.app.api.routes import router
from backend.app.domain.errors import DomainError

app=FastAPI(title='Yeldurthy RoadShare Validator',version='1.0.0')
origins=[x.strip() for x in os.getenv('ALLOWED_ORIGINS','http://localhost:5173').split(',')]
app.add_middleware(CORSMiddleware,allow_origins=origins,allow_methods=['*'],allow_headers=['*'])
@app.exception_handler(DomainError)
async def domain_error(_:Request,e:DomainError): return JSONResponse(status_code=e.status,content={'code':e.code,'message':e.message,'field':e.field,'details':e.details})
@app.exception_handler(Exception)
async def unexpected(_:Request,e:Exception): return JSONResponse(status_code=500,content={'code':'INTERNAL_ERROR','message':'The request could not be processed.','field':None,'details':{}})
app.include_router(router)
