"""DeepMCP Communication Settings persistence module.

Stores 6 communication-mode switch states and an operation-log FIFO (max 20)
in a JSON file under the server directory.
"""

import json
import time
from pathlib import Path
from typing import Literal

from config import BASE_DIR

SettingsKey = Literal[
    "websocket_bidirectional",
    "redis_subscription",
    "sse_receive",
    "webhook_send",
    "sse_send",
    "feishu_push",
]

DEFAULT_SETTINGS: dict[SettingsKey, bool] = {
    "websocket_bidirectional": True,
    "redis_subscription": True,
    "sse_receive": True,
    "webhook_send": True,
    "sse_send": True,
    "feishu_push": True,
}

_SETTINGS_PATH: Path = BASE_DIR / "communication_settings.json"
_LOG_LIMIT = 20


def _load() -> dict:
    if not _SETTINGS_PATH.exists():
        return {"switches": dict(DEFAULT_SETTINGS), "logs": []}
    try:
        with open(_SETTINGS_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict):
            return {"switches": dict(DEFAULT_SETTINGS), "logs": []}
        # Merge with defaults to handle schema evolution
        merged = dict(DEFAULT_SETTINGS)
        raw_switches = data.get("switches")
        if isinstance(raw_switches, dict):
            for k, v in raw_switches.items():
                if k in merged and isinstance(v, bool):
                    merged[k] = v  # type: ignore[literal-required]
        logs = data.get("logs", [])
        if not isinstance(logs, list):
            logs = []
        return {"switches": merged, "logs": logs}
    except (json.JSONDecodeError, OSError):
        return {"switches": dict(DEFAULT_SETTINGS), "logs": []}


def _save(data: dict) -> None:
    with open(_SETTINGS_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def get_settings() -> dict:
    """Return current switch states and operation logs."""
    return _load()


def set_switch(key: str, value: bool, actor: str = "当前用户") -> dict:
    """Toggle a single switch and append an operation log entry."""
    if key not in DEFAULT_SETTINGS:
        raise ValueError(f"Invalid switch key: {key}")
    data = _load()
    data["switches"][key] = value
    log_entry = {
        "id": f"{int(time.time() * 1000)}-{hash(key) & 0xFFFF:04x}",
        "timestamp": int(time.time() * 1000),
        "switchId": key,
        "switchTitle": _switch_title(key),
        "newState": value,
        "actor": actor,
    }
    logs = data.get("logs", [])
    logs.append(log_entry)
    if len(logs) > _LOG_LIMIT:
        logs.pop(0)
    data["logs"] = logs
    _save(data)
    return data


def _switch_title(key: str) -> str:
    titles = {
        "websocket_bidirectional": "WebSocket 全双工",
        "redis_subscription": "Redis 消息代理订阅",
        "sse_receive": "SSE 流式推送接收",
        "webhook_send": "Webhook 回调发送",
        "sse_send": "SSE 流式推送发送",
        "feishu_push": "飞书 / OpenClaw 消息推送",
    }
    return titles.get(key, key)
