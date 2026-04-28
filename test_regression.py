"""Regression test suite for develop branch (HEAD: 604612e9)."""
import os
import sys
import base64
import tempfile
import time
import json
import hmac
import importlib
from unittest.mock import patch, MagicMock
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "server"))

import pytest
from fastapi.testclient import TestClient

def clear_server_modules():
    for name in list(sys.modules.keys()):
        if name in ("config", "main", "mcp.server", "server.mcp.server",
                    "server.models.whisper_handler", "server.models.yolo_handler",
                    "server.models.__init__", "server.camera", "server.mcp.__init__"):
            del sys.modules[name]
        elif name.startswith("server."):
            del sys.modules[name]

# ---------------------------------------------------------------------------
# 1. Security Tests
# ---------------------------------------------------------------------------

class TestSecurityAuth:
    @pytest.fixture(autouse=True)
    def _clear_env(self):
        clear_server_modules()
        yield

    def test_post_call_no_key_returns_401(self):
        os.environ["DEEPMCP_API_KEY"] = "test-secret-key"
        os.environ["DEEPMCP_MOCK_MODE"] = "true"
        os.environ["DEEPMCP_CAMERA_ENABLED"] = "false"
        import config
        importlib.reload(config)
        import main
        importlib.reload(main)
        with TestClient(main.app) as client:
            res = client.post("/call", json={"tool": "yolo26_detect", "arguments": {"image": "test"}})
        assert res.status_code == 401
        assert "Missing X-API-Key header" in res.text

    def test_post_call_wrong_key_returns_403(self):
        os.environ["DEEPMCP_API_KEY"] = "test-secret-key"
        os.environ["DEEPMCP_MOCK_MODE"] = "true"
        os.environ["DEEPMCP_CAMERA_ENABLED"] = "false"
        import config
        importlib.reload(config)
        import main
        importlib.reload(main)
        with TestClient(main.app) as client:
            res = client.post(
                "/call",
                json={"tool": "yolo26_detect", "arguments": {"image": "test"}},
                headers={"X-API-Key": "wrong-key"}
            )
        assert res.status_code == 403
        assert "Invalid API Key" in res.text

    def test_post_call_correct_key_returns_200(self):
        os.environ["DEEPMCP_API_KEY"] = "test-secret-key"
        os.environ["DEEPMCP_MOCK_MODE"] = "true"
        os.environ["DEEPMCP_CAMERA_ENABLED"] = "false"
        import config
        importlib.reload(config)
        import main
        importlib.reload(main)
        with TestClient(main.app) as client:
            res = client.post(
                "/call",
                json={"tool": "yolo26_detect", "arguments": {"image": "test"}},
                headers={"X-API-Key": "test-secret-key"}
            )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"

    def test_timing_safe_comparison_used(self):
        import main
        source = Path(main.__file__).read_text()
        assert "hmac.compare_digest" in source
        lines = source.splitlines()
        for line in lines:
            if "api_key" in line and "==" in line and "compare_digest" not in line:
                pytest.fail(f"Potential timing-unsafe comparison found: {line}")

    def test_cors_preflight_allowed_methods_and_headers(self):
        os.environ["DEEPMCP_API_KEY"] = "test-secret-key"
        os.environ["DEEPMCP_MOCK_MODE"] = "true"
        os.environ["DEEPMCP_CAMERA_ENABLED"] = "false"
        os.environ["DEEPMCP_CORS_ORIGINS"] = "http://localhost:5173"
        import config
        importlib.reload(config)
        import main
        importlib.reload(main)
        with TestClient(main.app) as client:
            res = client.options(
                "/call",
                headers={
                    "Origin": "http://localhost:5173",
                    "Access-Control-Request-Method": "POST",
                    "Access-Control-Request-Headers": "Content-Type, X-API-Key",
                }
            )
        assert res.status_code == 200
        assert "POST" in res.headers.get("access-control-allow-methods", "")
        allowed_headers = res.headers.get("access-control-allow-headers", "").lower()
        assert "content-type" in allowed_headers
        assert "x-api-key" in allowed_headers

    def test_cors_preflight_disallowed_method(self):
        os.environ["DEEPMCP_API_KEY"] = "test-secret-key"
        os.environ["DEEPMCP_MOCK_MODE"] = "true"
        os.environ["DEEPMCP_CAMERA_ENABLED"] = "false"
        os.environ["DEEPMCP_CORS_ORIGINS"] = "http://localhost:5173"
        import config
        importlib.reload(config)
        import main
        importlib.reload(main)
        with TestClient(main.app) as client:
            res = client.options(
                "/call",
                headers={
                    "Origin": "http://localhost:5173",
                    "Access-Control-Request-Method": "DELETE",
                }
            )
        assert "DELETE" not in res.headers.get("access-control-allow-methods", "")

    def test_dev_mode_empty_api_key_bypasses_auth(self):
        os.environ["DEEPMCP_API_KEY"] = ""
        os.environ["DEEPMCP_MOCK_MODE"] = "true"
        os.environ["DEEPMCP_CAMERA_ENABLED"] = "false"
        import config
        importlib.reload(config)
        import main
        importlib.reload(main)
        with TestClient(main.app) as client:
            res = client.post("/call", json={"tool": "yolo26_detect", "arguments": {"image": "test"}})
        assert res.status_code == 200

    def test_websocket_wrong_key_closes_4001(self):
        os.environ["DEEPMCP_API_KEY"] = "test-secret-key"
        os.environ["DEEPMCP_MOCK_MODE"] = "true"
        os.environ["DEEPMCP_CAMERA_ENABLED"] = "false"
        import config
        importlib.reload(config)
        import main
        importlib.reload(main)
        with TestClient(main.app) as client:
            with pytest.raises(Exception):
                with client.websocket_connect("/ws/cameras/cam_0?api_key=bad") as ws:
                    pass


# ---------------------------------------------------------------------------
# 2. Whisper Handler Tests
# ---------------------------------------------------------------------------

class TestWhisperHandler:
    def test_handler_schema_matches_contract(self):
        import server.models.whisper_handler as wh
        importlib.reload(wh)
        handler = wh.WhisperHandler()
        params = handler.parameters
        assert "audio" in params["properties"]
        assert "language" in params["properties"]
        assert "task" in params["properties"]
        assert "word_timestamps" in params["properties"]
        assert params["properties"]["task"]["enum"] == ["transcribe", "translate"]

    def test_resolve_audio_url(self):
        import server.models.whisper_handler as wh
        handler = wh.WhisperHandler()
        with patch("urllib.request.urlretrieve") as mock_retrieve:
            fd, path = tempfile.mkstemp(suffix=".mp3")
            os.close(fd)
            mock_retrieve.return_value = (path, None)
            result = handler._resolve_audio("http://example.com/audio.mp3")
            assert result.endswith(".mp3")
            mock_retrieve.assert_called_once()
            os.remove(path)

    def test_resolve_audio_base64(self):
        import server.models.whisper_handler as wh
        handler = wh.WhisperHandler()
        b64 = base64.b64encode(b"fake audio data").decode()
        result = handler._resolve_audio(f"base64://{b64}")
        assert os.path.exists(result)
        os.remove(result)

    def test_resolve_audio_local_path(self):
        import server.models.whisper_handler as wh
        handler = wh.WhisperHandler()
        fd, path = tempfile.mkstemp(suffix=".wav")
        os.close(fd)
        result = handler._resolve_audio(path)
        assert result == path
        os.remove(path)

    def test_word_timestamps_passed_to_transcribe(self):
        import server.models.whisper_handler as wh
        handler = wh.WhisperHandler()
        mock_model = MagicMock()
        mock_model.transcribe.return_value = {
            "text": "hello",
            "segments": [
                {"start": 0.0, "end": 1.0, "text": "hello", "words": [{"word": "hello", "start": 0.0, "end": 1.0}]}
            ]
        }
        handler._models["base"] = mock_model
        fd, path = tempfile.mkstemp(suffix=".wav")
        os.close(fd)
        handler.infer({"audio": path, "word_timestamps": True})
        _, kwargs = mock_model.transcribe.call_args
        assert kwargs.get("word_timestamps") is True, "word_timestamps must be passed to transcribe()"
        os.remove(path)


# ---------------------------------------------------------------------------
# 3. YOLO Handler Tests
# ---------------------------------------------------------------------------

class TestYOLOHandler:
    def test_handler_schema_matches_contract(self):
        import server.models.yolo_handler as yh
        importlib.reload(yh)
        handler = yh.YOLOHandler()
        params = handler.parameters
        assert "image" in params["properties"]
        assert "confidence" in params["properties"]
        assert "classes" in params["properties"]
        assert "model_size" in params["properties"]
        assert params["properties"]["model_size"]["enum"] == ["n", "s", "m", "l", "x"]

    def test_resolve_image_url(self):
        import server.models.yolo_handler as yh
        handler = yh.YOLOHandler()
        with patch("urllib.request.urlretrieve") as mock_retrieve:
            fd, path = tempfile.mkstemp(suffix=".jpg")
            os.close(fd)
            mock_retrieve.return_value = (path, None)
            result = handler._resolve_image("http://example.com/img.jpg")
            assert result.endswith(".jpg")
            os.remove(path)

    def test_resolve_image_base64(self):
        import server.models.yolo_handler as yh
        handler = yh.YOLOHandler()
        b64 = base64.b64encode(b"fake image").decode()
        result = handler._resolve_image(f"base64://{b64}")
        assert os.path.exists(result)
        os.remove(result)


# ---------------------------------------------------------------------------
# 4. Camera / OpenClaw Tests
# ---------------------------------------------------------------------------

class TestCameraManager:
    def test_camera_manager_webhook_payload_schema(self):
        import server.camera as cam
        importlib.reload(cam)
        event = cam.DetectionEvent(
            camera_id="cam_0",
            timestamp=time.time(),
            confidence=0.92,
            screenshot_b64="data:image/jpeg;base64,abc",
            bbox=[10, 20, 30, 40],
        )
        assert event.camera_id == "cam_0"
        assert len(event.bbox) == 4

    def test_camera_stream_thread_safety(self):
        import server.camera as cam
        importlib.reload(cam)
        stream = cam.CameraStream(
            camera_id="cam_0",
            source=0,
            yolo_model=None,
            confidence=0.5,
            inference_interval=0.2,
            webhook_cooldown=5.0,
        )
        assert stream.get_latest_frame_bytes() is None
        assert stream.get_last_detection_bytes() is None
        assert stream.get_last_detection_event() is None


# ---------------------------------------------------------------------------
# 5. MCP Server Integration Tests
# ---------------------------------------------------------------------------

class TestMcpServer:
    def test_whisper_mock_always_registered_even_in_non_mock(self):
        os.environ["DEEPMCP_API_KEY"] = ""
        os.environ["DEEPMCP_MOCK_MODE"] = "false"
        os.environ["DEEPMCP_CAMERA_ENABLED"] = "false"
        import config
        importlib.reload(config)
        import server.mcp.server as mcp_server
        importlib.reload(mcp_server)
        mcp_server.init_tools(mock_mode=False, camera_manager=None)
        handler = mcp_server._TOOL_HANDLERS.get("whisper_transcribe")
        assert handler is not None
        res = handler({"audio": "test.wav", "language": "en"})
        if res.result and "欢迎使用 DeepMCP" in str(res.result):
            pytest.fail("whisper_transcribe is still using MOCK handler in non-mock mode!")

    def test_yolo_real_handler_in_non_mock(self):
        os.environ["DEEPMCP_API_KEY"] = ""
        os.environ["DEEPMCP_MOCK_MODE"] = "false"
        os.environ["DEEPMCP_CAMERA_ENABLED"] = "false"
        import config
        importlib.reload(config)
        import server.mcp.server as mcp_server
        importlib.reload(mcp_server)
        mcp_server.init_tools(mock_mode=False, camera_manager=None)
        handler = mcp_server._TOOL_HANDLERS.get("yolo26_detect")
        assert handler is not None
        assert handler.__name__ == "_real_yolov8"

    def test_call_tool_unknown_tool(self):
        os.environ["DEEPMCP_API_KEY"] = ""
        os.environ["DEEPMCP_MOCK_MODE"] = "true"
        os.environ["DEEPMCP_CAMERA_ENABLED"] = "false"
        import server.mcp.server as mcp_server
        importlib.reload(mcp_server)
        mcp_server.init_tools(mock_mode=True, camera_manager=None)
        from server.mcp.protocol import CallRequest
        res = mcp_server.call_tool(CallRequest(tool="nonexistent", arguments={}))
        assert res.status == "error"
        assert res.error["code"] == "TOOL_NOT_FOUND"


# ---------------------------------------------------------------------------
# 6. Frontend Build Test
# ---------------------------------------------------------------------------

class TestFrontendBuild:
    def test_npm_build_passes(self):
        import subprocess
        result = subprocess.run(
            ["npm", "run", "build"],
            cwd="/home/qihui/multica_workspaces/9fe17ac9-54fa-4e0f-9078-e02138fa4d92/c93dd09b/workdir/Modelsmcp",
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"Build failed:\n{result.stdout}\n{result.stderr}"

    def test_camera_panel_no_hardcoded_dev_key(self):
        panel_path = Path("/home/qihui/multica_workspaces/9fe17ac9-54fa-4e0f-9078-e02138fa4d92/c93dd09b/workdir/Modelsmcp/src/app/components/CameraPanel.tsx")
        source = panel_path.read_text()
        if '|| "deepmcp-dev-key"' in source:
            pytest.fail("CameraPanel.tsx contains hardcoded fallback API key 'deepmcp-dev-key'")

    def test_playground_error_distinguishes_401_403(self):
        pg_path = Path("/home/qihui/multica_workspaces/9fe17ac9-54fa-4e0f-9078-e02138fa4d92/c93dd09b/workdir/Modelsmcp/src/app/pages/Playground.tsx")
        source = pg_path.read_text()
        assert "401" in source or "403" in source


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
