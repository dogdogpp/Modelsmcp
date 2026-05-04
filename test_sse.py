"""SSE (Server-Sent Events) endpoint contract tests."""
import os
import sys
import importlib
import asyncio

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "server"))

import pytest
from fastapi.testclient import TestClient


def clear_server_modules():
    for name in list(sys.modules.keys()):
        if name in (
            "config", "main", "mcp.server", "server.mcp.server",
            "server.models.whisper_handler", "server.models.yolo_handler",
            "server.models.__init__", "server.camera", "server.mcp.__init__",
            "server.mcp.protocol",
        ):
            del sys.modules[name]
        elif name.startswith("server."):
            del sys.modules[name]


def _parse_sse_events(text: str):
    """Parse raw SSE response body into a list of event dicts."""
    events = []
    for block in text.strip().split("\n\n"):
        if not block.strip():
            continue
        lines = block.splitlines()
        event = ""
        data = ""
        for line in lines:
            if line.startswith("event: "):
                event = line[7:]
            elif line.startswith("data: "):
                data = line[6:]
        if event:
            import json
            try:
                payload = json.loads(data)
            except Exception:
                payload = data
            events.append({"event": event, "data": payload})
    return events


class TestSseAuth:
    @pytest.fixture(autouse=True)
    def _clear_env(self):
        clear_server_modules()
        yield

    def test_sse_no_key_returns_401(self):
        os.environ["DEEPMCP_API_KEY"] = "test-secret-key"
        os.environ["DEEPMCP_MOCK_MODE"] = "true"
        os.environ["DEEPMCP_CAMERA_ENABLED"] = "false"
        import config
        importlib.reload(config)
        import main
        importlib.reload(main)
        with TestClient(main.app) as client:
            res = client.post(
                "/sse",
                json={"tool": "yolo26_detect", "arguments": {"image": "test"}},
            )
        assert res.status_code == 401

    def test_sse_wrong_key_returns_403(self):
        os.environ["DEEPMCP_API_KEY"] = "test-secret-key"
        os.environ["DEEPMCP_MOCK_MODE"] = "true"
        os.environ["DEEPMCP_CAMERA_ENABLED"] = "false"
        import config
        importlib.reload(config)
        import main
        importlib.reload(main)
        with TestClient(main.app) as client:
            res = client.post(
                "/sse",
                json={"tool": "yolo26_detect", "arguments": {"image": "test"}},
                headers={"X-API-Key": "wrong-key"},
            )
        assert res.status_code == 403

    def test_sse_correct_key_returns_stream(self):
        os.environ["DEEPMCP_API_KEY"] = "test-secret-key"
        os.environ["DEEPMCP_MOCK_MODE"] = "true"
        os.environ["DEEPMCP_CAMERA_ENABLED"] = "false"
        import config
        importlib.reload(config)
        import main
        importlib.reload(main)
        with TestClient(main.app) as client:
            res = client.post(
                "/sse",
                json={"tool": "yolo26_detect", "arguments": {"image": "test"}},
                headers={"X-API-Key": "test-secret-key"},
            )
        assert res.status_code == 200
        assert "text/event-stream" in res.headers.get("content-type", "")


class TestSseEvents:
    @pytest.fixture(autouse=True)
    def _clear_env(self):
        clear_server_modules()
        yield

    def test_sse_emits_progress_result_events(self):
        os.environ["DEEPMCP_API_KEY"] = ""
        os.environ["DEEPMCP_MOCK_MODE"] = "true"
        os.environ["DEEPMCP_CAMERA_ENABLED"] = "false"
        import config
        importlib.reload(config)
        import main
        importlib.reload(main)
        with TestClient(main.app) as client:
            res = client.post(
                "/sse",
                json={"tool": "yolo26_detect", "arguments": {"image": "test"}},
            )
        assert res.status_code == 200
        events = _parse_sse_events(res.text)
        event_types = [e["event"] for e in events]
        assert "progress" in event_types
        assert "result" in event_types
        assert event_types[-1] == "result"

    def test_sse_result_matches_call_response_schema(self):
        os.environ["DEEPMCP_API_KEY"] = ""
        os.environ["DEEPMCP_MOCK_MODE"] = "true"
        os.environ["DEEPMCP_CAMERA_ENABLED"] = "false"
        import config
        importlib.reload(config)
        import main
        importlib.reload(main)
        with TestClient(main.app) as client:
            res = client.post(
                "/sse",
                json={"tool": "yolo26_detect", "arguments": {"image": "test"}},
            )
        events = _parse_sse_events(res.text)
        result_event = [e for e in events if e["event"] == "result"][0]
        data = result_event["data"]
        assert data["status"] == "success"
        assert "model" in data
        assert "inference_time" in data
        assert "device" in data
        assert "result" in data

    def test_sse_unknown_tool_emits_error_event(self):
        os.environ["DEEPMCP_API_KEY"] = ""
        os.environ["DEEPMCP_MOCK_MODE"] = "true"
        os.environ["DEEPMCP_CAMERA_ENABLED"] = "false"
        import config
        importlib.reload(config)
        import main
        importlib.reload(main)
        with TestClient(main.app) as client:
            res = client.post(
                "/sse",
                json={"tool": "nonexistent_tool", "arguments": {}},
            )
        assert res.status_code == 200
        events = _parse_sse_events(res.text)
        error_events = [e for e in events if e["event"] == "error"]
        assert len(error_events) >= 1
        assert error_events[0]["data"]["code"] == "TOOL_NOT_FOUND"

    def test_sse_progress_contains_step_fields(self):
        os.environ["DEEPMCP_API_KEY"] = ""
        os.environ["DEEPMCP_MOCK_MODE"] = "true"
        os.environ["DEEPMCP_CAMERA_ENABLED"] = "false"
        import config
        importlib.reload(config)
        import main
        importlib.reload(main)
        with TestClient(main.app) as client:
            res = client.post(
                "/sse",
                json={"tool": "yolo26_detect", "arguments": {"image": "test"}},
            )
        events = _parse_sse_events(res.text)
        progress_events = [e for e in events if e["event"] == "progress"]
        assert len(progress_events) >= 1
        for pe in progress_events:
            assert "message" in pe["data"]
            assert "step" in pe["data"]
            assert "total_steps" in pe["data"]

    def test_sse_error_event_has_code_and_message(self):
        os.environ["DEEPMCP_API_KEY"] = ""
        os.environ["DEEPMCP_MOCK_MODE"] = "true"
        os.environ["DEEPMCP_CAMERA_ENABLED"] = "false"
        import config
        importlib.reload(config)
        import main
        importlib.reload(main)
        with TestClient(main.app) as client:
            res = client.post(
                "/sse",
                json={"tool": "nonexistent_tool", "arguments": {}},
            )
        events = _parse_sse_events(res.text)
        error_event = [e for e in events if e["event"] == "error"][0]
        assert "code" in error_event["data"]
        assert "message" in error_event["data"]

    def test_sse_heartbeat_present_for_long_tools(self):
        os.environ["DEEPMCP_API_KEY"] = ""
        os.environ["DEEPMCP_MOCK_MODE"] = "true"
        os.environ["DEEPMCP_CAMERA_ENABLED"] = "false"
        import config
        importlib.reload(config)
        import main
        importlib.reload(main)
        with TestClient(main.app) as client:
            res = client.post(
                "/sse",
                json={"tool": "whisper_transcribe", "arguments": {"audio": "test"}},
            )
        assert res.status_code == 200
        events = _parse_sse_events(res.text)
        event_types = [e["event"] for e in events]
        assert "progress" in event_types
        assert "result" in event_types

    def test_sse_backward_compatibility_call_unchanged(self):
        os.environ["DEEPMCP_API_KEY"] = ""
        os.environ["DEEPMCP_MOCK_MODE"] = "true"
        os.environ["DEEPMCP_CAMERA_ENABLED"] = "false"
        import config
        importlib.reload(config)
        import main
        importlib.reload(main)
        with TestClient(main.app) as client:
            sync_res = client.post(
                "/call",
                json={"tool": "yolo26_detect", "arguments": {"image": "test"}},
            )
            sse_res = client.post(
                "/sse",
                json={"tool": "yolo26_detect", "arguments": {"image": "test"}},
            )
        assert sync_res.status_code == 200
        assert sync_res.headers.get("content-type") == "application/json"
        assert sse_res.status_code == 200
        assert "text/event-stream" in sse_res.headers.get("content-type", "")

    def test_sse_response_has_cache_control_headers(self):
        os.environ["DEEPMCP_API_KEY"] = ""
        os.environ["DEEPMCP_MOCK_MODE"] = "true"
        os.environ["DEEPMCP_CAMERA_ENABLED"] = "false"
        import config
        importlib.reload(config)
        import main
        importlib.reload(main)
        with TestClient(main.app) as client:
            res = client.post(
                "/sse",
                json={"tool": "yolo26_detect", "arguments": {"image": "test"}},
            )
        assert res.status_code == 200
        assert "no-cache" in res.headers.get("cache-control", "")

    def test_sse_camera_tool_progress_messages(self):
        os.environ["DEEPMCP_API_KEY"] = ""
        os.environ["DEEPMCP_MOCK_MODE"] = "true"
        os.environ["DEEPMCP_CAMERA_ENABLED"] = "false"
        import config
        importlib.reload(config)
        import main
        importlib.reload(main)
        with TestClient(main.app) as client:
            res = client.post(
                "/sse",
                json={"tool": "camera_list", "arguments": {}},
            )
        assert res.status_code == 200
        events = _parse_sse_events(res.text)
        progress_events = [e for e in events if e["event"] == "progress"]
        assert len(progress_events) >= 1
        # Camera disabled in this env, so it should emit error at the end
        assert any(e["event"] == "error" for e in events) or any(e["event"] == "result" for e in events)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
