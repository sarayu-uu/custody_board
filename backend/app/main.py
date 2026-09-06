import os
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from backend.app.api.routes import router
from backend.app.domain.errors import DomainError

api=FastAPI(title='RoadShare Validator',version='1.0.0')
default_origins='http://localhost:5173,https://roadshare-app.onrender.com'
origins=[x.strip().rstrip('/') for x in os.getenv('ALLOWED_ORIGINS',default_origins).split(',') if x.strip()]
@api.exception_handler(DomainError)
async def domain_error(_:Request,e:DomainError): return JSONResponse(status_code=e.status,content={'code':e.code,'message':e.message,'field':e.field,'details':e.details})
@api.exception_handler(Exception)
async def unexpected(_:Request,e:Exception):
    logging.exception('Unhandled RoadShare API error', exc_info=e)
    return JSONResponse(status_code=500,content={'code':'INTERNAL_ERROR','message':'The server could not complete this action. Try again.','field':None,'details':{}})
api.include_router(router)

# Keep CORS outside FastAPI's error middleware so even unexpected 500 responses
# include the browser-readable CORS headers.
app=CORSMiddleware(app=api,allow_origins=origins,allow_methods=['*'],allow_headers=['*'])
