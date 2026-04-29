"""DeepMCP Server Configuration."""

import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).parent.resolve()
MODELS_DIR = Path(os.getenv("DEEPMCP_MODELS_DIR", BASE_DIR / ".." / "models_storage"))
DEVICE = os.getenv("DEEPMCP_DEVICE", "cpu")
HOST = os.getenv("DEEPMCP_HOST", "127.0.0.1")
PORT = int(os.getenv("DEEPMCP_PORT", "8081"))
WORKERS = int(os.getenv("DEEPMCP_WORKERS", "1"))

# Security: API key has no default value. Must be explicitly set via env var.
# Empty string disables auth (development only); production deployments MUST set this.
API_KEY = os.getenv("DEEPMCP_API_KEY", "")

# Security: CORS origins read from env var with restrictive defaults.
# Includes common Vite dev-server ports (5173-5180) to avoid preflight failures
# when the port auto-increments due to conflicts.
CORS_ORIGINS = os.getenv(
    "DEEPMCP_CORS_ORIGINS",
    ",".join([f"http://localhost:{p}" for p in range(5173, 5181)] + ["http://localhost:3000"]),
).split(",")

MOCK_MODE = os.getenv("DEEPMCP_MOCK_MODE", "false").lower() == "true"

# Camera configuration
CAMERA_ENABLED = os.getenv("DEEPMCP_CAMERA_ENABLED", "true").lower() == "true"
# Default scans indices 0-9 to auto-discover non-zero V4L2 devices.
# Override via env var if you need a restricted list.
_raw_camera_ids = os.getenv("DEEPMCP_CAMERA_DEVICE_IDS", "0,1,2,3,4,5,6,7,8,9")
CAMERA_DEVICE_IDS = [d.strip() for d in _raw_camera_ids.split(",") if d.strip() != ""]
CAMERA_INFERENCE_INTERVAL = float(os.getenv("DEEPMCP_CAMERA_INFERENCE_INTERVAL", "0.2"))
CAMERA_PERSON_CONFIDENCE = float(os.getenv("DEEPMCP_CAMERA_PERSON_CONFIDENCE", "0.5"))
CAMERA_WEBHOOK_COOLDOWN = float(os.getenv("DEEPMCP_CAMERA_WEBHOOK_COOLDOWN", "5.0"))

# OpenClaw webhook
OPENCLAW_WEBHOOK_URL = os.getenv("OPENCLAW_WEBHOOK_URL", "")
OPENCLAW_API_KEY = os.getenv("OPENCLAW_API_KEY", "")

# Model-specific configs
MODEL_CONFIG = {
    "yolo26": {"enabled": True, "variant": "yolo26n", "classes": 80},
    "detr": {"enabled": True, "variant": "resnet50"},
    "paddleocr": {"enabled": True, "lang": ["ch", "en"]},
    "sam2": {"enabled": True, "variant": "sam2_hiera_large"},
    "clip": {"enabled": True, "variant": "ViT-L/14"},
    "whisper": {"enabled": True, "model": "large-v3"},
    "depth_anything": {"enabled": True, "variant": "v2"},
    "dinov2": {"enabled": True, "variant": "vitl14"},
    "yolov8_pose": {"enabled": True, "variant": "yolov8m-pose"},
    "grounding_dino": {"enabled": True, "variant": "v1.5"},
}
