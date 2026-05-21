import os
import shutil
import base64
import tempfile
import time
from pathlib import Path
from typing import Dict, Any
from urllib.parse import urlparse
import urllib.request

import cv2
import numpy as np
from ultralytics import YOLO

from . import register


class YOLOHandler:
    name = "YOLO2026"
    tool = "yolo2026_detect"
    model_id = "yolo2026"
    description = "YOLO2026 目标检测"
    device = "CPU"
    parameters = {
        "type": "object",
        "properties": {
            "image": {
                "type": "string",
                "description": "图片输入：支持 HTTP/HTTPS URL、Base64、data URI、本地文件路径，以及 OpenClaw 媒体引用（media://inbound/<id>）。如果用户消息中包含 [media attached: media://inbound/<id>]，请直接将该 URI 作为本参数传入。",
            },
            "confidence": {"type": "number", "default": 0.5},
            "classes": {"type": "array", "items": {"type": "string"}},
            "model_size": {"type": "string", "enum": ["n", "s", "m", "l", "x"], "default": "n"},
        },
        "required": ["image"],
    }

    def __init__(self):
        self._model = None
        self._model_size = None

    def _load_model(self, size: str = "n"):
        if self._model is not None and self._model_size == size:
            return self._model

        weights_dir = Path(__file__).resolve().parent.parent.parent / "models_storage"
        weights_path = weights_dir / f"yolo2026{size}.pt"

        if weights_path.exists():
            self._model = YOLO(str(weights_path))
        else:
            # Auto-download via ultralytics; ensure it lands in models_storage
            weights_dir.mkdir(parents=True, exist_ok=True)
            self._model = YOLO(f"yolo2026{size}.pt")
            cwd_file = Path(f"yolo2026{size}.pt")
            if cwd_file.exists():
                shutil.move(str(cwd_file), str(weights_path))

        self._model_size = size
        return self._model

    def _resolve_image(self, image: str) -> str:
        if image.startswith("http://") or image.startswith("https://"):
            ext = ".jpg"
            parsed = urlparse(image)
            if parsed.path:
                _, ext = os.path.splitext(parsed.path)
                if not ext:
                    ext = ".jpg"
            fd, path = tempfile.mkstemp(suffix=ext)
            urllib.request.urlretrieve(image, path)
            os.close(fd)
            return path

        # OpenClaw media URI: media://inbound/<id>
        # OpenClaw offloads large attachments (>2MB) to ~/.openclaw/media/inbound/
        if image.startswith("media://inbound/"):
            media_id = image[len("media://inbound/"):]
            # Try local OpenClaw media directory first
            openclaw_media_dir = Path.home() / ".openclaw" / "media" / "inbound"
            if openclaw_media_dir.exists():
                # The media ID may include an original-filename prefix and extension
                candidates = list(openclaw_media_dir.glob(f"*{media_id}*"))
                if candidates:
                    # Pick the most recently modified match
                    candidates.sort(key=lambda p: p.stat().st_mtime, reverse=True)
                    return str(candidates[0])
                # Exact match
                exact = openclaw_media_dir / media_id
                if exact.exists():
                    return str(exact)
            # Fallback: try OpenClaw HTTP media endpoint (if exposed)
            try:
                fd, path = tempfile.mkstemp(suffix=".jpg")
                urllib.request.urlretrieve(f"http://localhost:18789/media/{media_id}", path)
                os.close(fd)
                return path
            except Exception:
                pass
            raise ValueError(f"OpenClaw media not found: {image}")

        if image.startswith("data:"):
            # Handle data URI: data:{mime};base64,{data}
            header, _, data = image.partition(",")
            mime = "image/jpeg"
            if ";" in header:
                mime = header[len("data:"):].split(";")[0]
            ext = ".jpg"
            if "png" in mime:
                ext = ".png"
            elif "webp" in mime:
                ext = ".webp"
            elif "bmp" in mime:
                ext = ".bmp"
            fd, path = tempfile.mkstemp(suffix=ext)
            with os.fdopen(fd, "wb") as f:
                f.write(base64.b64decode(data))
            return path

        if image.startswith("base64://"):
            data = image[len("base64://"):]
            fd, path = tempfile.mkstemp(suffix=".jpg")
            with os.fdopen(fd, "wb") as f:
                f.write(base64.b64decode(data))
            return path

        if image.startswith("file://"):
            return image[len("file://"):]

        if os.path.exists(image):
            return image

        raise ValueError(f"Unsupported image source: {image[:50]}...")

    def infer(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        image_src = arguments.get("image")
        confidence = float(arguments.get("confidence", 0.5))
        classes = arguments.get("classes", [])
        model_size = arguments.get("model_size", "n")

        image_path = self._resolve_image(image_src)
        model = self._load_model(model_size)

        results = model(image_path, conf=confidence, verbose=False)
        detections = []
        for r in results:
            for box in r.boxes:
                class_id = int(box.cls[0])
                class_name = model.names[class_id]
                if classes and class_name not in classes:
                    continue
                detections.append({
                    "class": class_name,
                    "confidence": round(float(box.conf[0]), 4),
                    "bbox": [round(float(v)) for v in box.xyxy[0].tolist()],
                    "class_id": class_id,
                })

        # Clean up temp files
        if image_path != image_src and image_path.startswith(tempfile.gettempdir()):
            try:
                os.remove(image_path)
            except Exception:
                pass

        return {
            "detections": detections,
            "total_objects": len(detections),
        }


register(YOLOHandler())
