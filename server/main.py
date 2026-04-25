import os
import sys

# Ensure server package is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any

from server.models import list_tools, run_inference
# Import handlers to trigger self-registration
import server.models.yolo_handler
import server.models.whisper_handler

app = FastAPI(title="DeepMCP Server", version="0.1.0")

# CORS — allow frontend origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class CallRequest(BaseModel):
    tool: str
    arguments: Dict[str, Any] = {}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/tools")
def tools():
    return {"tools": list_tools()}


@app.post("/call")
def call(req: CallRequest):
    try:
        resp = run_inference(req.tool, req.arguments)
        return resp
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/metrics")
def metrics():
    return {
        "requests_total": 0,
        "requests_per_second": 0,
        "avg_latency_ms": 0,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=18080)
