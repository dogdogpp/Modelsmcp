import os
import base64
import tempfile
import time
from typing import Dict, Any
from urllib.parse import urlparse
import urllib.request

import cv2
import numpy as np
from ultralytics import YOLO

from . import register


class YOLOHandler:
    name = "YOLO2026"
    tool = "yolo26_detect"
    model_id = "yolo26"
    description = "YOLO2026 目标检测"
    device = "CPU"
    parameters = {
        "type": "object",
        "properties": {
            "image": {"type": "string", "description": "图片 URL、Base64 或本地路径"},
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

        weights_dir = os.path.join(os.path.dirname(__file__), "..", "..", "yolo2026")
        weights_path = os.path.join(weights_dir, f"yolo26{size}.pt")

        if os.path.exists(weights_path):
            self._model = YOLO(weights_path)
        else:
            # Auto-download via ultralytics
            self._model = YOLO(f"yolo26{size}.pt")
            # Save to local weights dir for reuse
            if not os.path.exists(weights_dir):
                os.makedirs(weights_dir, exist_ok=True)

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
