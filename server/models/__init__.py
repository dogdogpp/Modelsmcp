from typing import Dict, Any, Protocol
import time


class ModelHandler(Protocol):
    name: str
    tool: str

    def infer(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        ...


_registry: Dict[str, ModelHandler] = {}


def register(handler: ModelHandler) -> None:
    _registry[handler.tool] = handler


def get_handler(tool: str) -> ModelHandler | None:
    return _registry.get(tool)


def list_tools() -> list[dict]:
    return [
        {
            "name": h.tool,
            "description": getattr(h, "description", ""),
            "parameters": getattr(h, "parameters", {}),
        }
        for h in _registry.values()
    ]


def run_inference(tool: str, arguments: dict) -> dict:
    handler = get_handler(tool)
    if handler is None:
        raise ValueError(f"Unknown tool: {tool}")

    t0 = time.perf_counter()
    result = handler.infer(arguments)
    inference_time = round((time.perf_counter() - t0) * 1000, 1)

    return {
        "status": "success",
        "model": getattr(handler, "model_id", handler.tool),
        "inference_time": f"{inference_time}ms",
        "device": getattr(handler, "device", "CPU"),
        "result": result,
    }
