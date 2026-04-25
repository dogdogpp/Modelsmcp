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
API_KEY = os.getenv("DEEPMCP_API_KEY", "deepmcp-dev-key")
CORS_ORIGINS = os.getenv("DEEPMCP_CORS_ORIGINS", "http://localhost:5173,http://localhost:5174").split(",")
MOCK_MODE = os.getenv("DEEPMCP_MOCK_MODE", "false").lower() == "true"

# Camera configuration
CAMERA_ENABLED = os.getenv("DEEPMCP_CAMERA_ENABLED", "true").lower() == "true"
CAMERA_DEVICE_IDS = os.getenv("DEEPMCP_CAMERA_DEVICE_IDS", "0").split(",")
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
