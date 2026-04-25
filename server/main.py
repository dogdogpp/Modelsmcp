import hmac

from fastapi import FastAPI, Request, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from config import CORS_ORIGINS, DEEPMCP_API_KEY, SERVER_HOST, SERVER_PORT

app = FastAPI(title="DeepMCP Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-API-Key"],
)


def verify_api_key(request: Request):
    if not DEEPMCP_API_KEY:
        return
    api_key = request.headers.get("X-API-Key")
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-API-Key header",
        )
    if not hmac.compare_digest(api_key, DEEPMCP_API_KEY):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid API Key",
        )


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/tools")
async def list_tools():
    return {
        "tools": [
            {"name": "yolov8_detect", "description": "YOLOv8 object detection"},
            {"name": "paddleocr_recognize", "description": "PaddleOCR text recognition"},
            {"name": "sam2_segment", "description": "SAM 2 image/video segmentation"},
        ]
    }


@app.post("/call")
async def call_tool(request: Request, _=Depends(verify_api_key)):
    body = await request.json()
    tool = body.get("tool")
    arguments = body.get("arguments", {})
    return {
        "status": "success",
        "tool": tool,
        "arguments": arguments,
        "result": {"message": "Inference completed"},
    }


@app.get("/metrics")
async def metrics(_=Depends(verify_api_key)):
    return {"requests": 0, "latency_ms": 12}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=SERVER_HOST, port=SERVER_PORT)
