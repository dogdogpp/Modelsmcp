"""End-to-end integration tests for OpenClaw -> MCP Server -> Camera Tool chain."""
import os
import sys
import base64
import time
import json
import importlib
from unittest.mock import MagicMock
from io import BytesIO
from PIL import Image

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


class TestOpenClawCameraE2E:
    """Simulate OpenClaw discovering and invoking camera tools through the MCP /call endpoint."""

    @pytest.fixture(autouse=True)
    def _clear_env(self):
        clear_server_modules()
        yield

    @pytest.fixture
    def client_with_camera(self):
        """Return a TestClient with a mocked camera manager."""
        os.environ["DEEPMCP_API_KEY"] = ""
        os.environ["DEEPMCP_MOCK_MODE"] = "true"
        os.environ["DEEPMCP_CAMERA_ENABLED"] = "false"
        import config
        importlib.reload(config)
        import main
        importlib.reload(main)

        # Create a fake JPEG frame
        img = Image.new("RGB", (640, 480), color=(0, 255, 0))
        buf = BytesIO()
        img.save(buf, format="JPEG")
        fake_frame = buf.getvalue()

        mock_stream = MagicMock()
        mock_stream.get_latest_frame_bytes.return_value = fake_frame
        mock_stream.get_last_detection_bytes.return_value = fake_frame
        mock_event = MagicMock()
        mock_event.timestamp = time.time()
        mock_event.confidence = 0.92
        mock_event.bbox = [10, 20, 100, 200]
        mock_event.class_name = "person"
        mock_stream.get_last_detection_event.return_value = mock_event
        mock_stream.status = "streaming"
        mock_stream.fps = 30.0

        mock_manager = MagicMock()
        mock_manager.discover_cameras.return_value = [
            {"id": "cam_0", "name": "Camera 0", "source": "0", "resolution": "640x480", "fps": 30.0, "status": "available"},
            {"id": "cam_1", "name": "Camera 1", "source": "1", "resolution": "1920x1080", "fps": 60.0, "status": "available"},
        ]
        mock_manager.list_streams.return_value = [
            {"id": "cam_0", "source": 0, "status": "streaming", "fps": 30.0, "thread_alive": True},
        ]
        mock_manager.get_stream.return_value = mock_stream
        mock_manager.start_camera.return_value = mock_stream

        with TestClient(main.app) as client:
            # Lifespan already ran with camera_manager=None; re-init with mock
            import mcp.server as mcp_server
            mcp_server.init_tools(mock_mode=True, camera_manager=mock_manager)
            main.app.state.camera_manager = mock_manager
            yield client, mock_manager, fake_frame

    # -----------------------------------------------------------------------
    # 1. Tool Discovery
    # -----------------------------------------------------------------------

    def test_tools_endpoint_exposes_all_three_camera_tools(self, client_with_camera):
        client, _, _ = client_with_camera
        res = client.get("/tools")
        assert res.status_code == 200
        data = res.json()
        tool_names = {t["name"] for t in data["tools"]}
        assert "camera_list" in tool_names
        assert "camera_get_frame" in tool_names
        assert "camera_get_last_detection" in tool_names

    def test_camera_list_schema_has_empty_required(self, client_with_camera):
        client, _, _ = client_with_camera
        res = client.get("/tools")
        data = res.json()
        cam_list = next(t for t in data["tools"] if t["name"] == "camera_list")
        assert cam_list["parameters"].get("required") == []

    def test_camera_get_frame_schema_requires_camera_id(self, client_with_camera):
        client, _, _ = client_with_camera
        res = client.get("/tools")
        data = res.json()
        schema = next(t for t in data["tools"] if t["name"] == "camera_get_frame")
        assert "camera_id" in schema["parameters"]["required"]
        assert "cam_0" in schema["description"] or "0" in schema["description"]

    def test_camera_get_frame_schema_has_examples(self, client_with_camera):
        client, _, _ = client_with_camera
        res = client.get("/tools")
        data = res.json()
        schema = next(t for t in data["tools"] if t["name"] == "camera_get_frame")
        cam_prop = schema["parameters"]["properties"]["camera_id"]
        assert "examples" in cam_prop
        assert "cam_0" in cam_prop["examples"]
        assert "default" in cam_prop["examples"] or "门口" in cam_prop["examples"]

    def test_camera_get_last_detection_schema_requires_camera_id(self, client_with_camera):
        client, _, _ = client_with_camera
        res = client.get("/tools")
        data = res.json()
        schema = next(t for t in data["tools"] if t["name"] == "camera_get_last_detection")
        assert "camera_id" in schema["parameters"]["required"]

    def test_camera_get_last_detection_schema_has_examples(self, client_with_camera):
        client, _, _ = client_with_camera
        res = client.get("/tools")
        data = res.json()
        schema = next(t for t in data["tools"] if t["name"] == "camera_get_last_detection")
        cam_prop = schema["parameters"]["properties"]["camera_id"]
        assert "examples" in cam_prop
        assert "cam_0" in cam_prop["examples"]

    # -----------------------------------------------------------------------
    # 2. camera_list
    # -----------------------------------------------------------------------

    def test_call_camera_list_returns_available_and_active(self, client_with_camera):
        client, mock_manager, _ = client_with_camera
        res = client.post("/call", json={"tool": "camera_list", "arguments": {}})
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"
        assert "available_cameras" in data["result"]
        assert "active_streams" in data["result"]
        assert len(data["result"]["available_cameras"]) == 2
        mock_manager.discover_cameras.assert_called_once()
        mock_manager.list_streams.assert_called_once()

    # -----------------------------------------------------------------------
    # 3. camera_get_frame
    # -----------------------------------------------------------------------

    def test_call_camera_get_frame_with_full_id(self, client_with_camera):
        client, mock_manager, fake_frame = client_with_camera
        res = client.post("/call", json={"tool": "camera_get_frame", "arguments": {"camera_id": "cam_0"}})
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"
        assert data["result"]["camera_id"] == "cam_0"
        assert data["result"]["format"] == "jpeg"
        assert "image_base64" in data["result"]
        # Verify it is valid base64
        decoded = base64.b64decode(data["result"]["image_base64"])
        assert decoded == fake_frame
        mock_manager.get_stream.assert_called_with("cam_0")

    def test_call_camera_get_frame_normalizes_numeric_id(self, client_with_camera):
        """Natural language like 'camera 0' should map to cam_0 via normalization."""
        client, mock_manager, fake_frame = client_with_camera
        res = client.post("/call", json={"tool": "camera_get_frame", "arguments": {"camera_id": "0"}})
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"
        # The normalization converts "0" -> "cam_0" internally
        mock_manager.get_stream.assert_called_with("cam_0")

    def test_call_camera_get_frame_auto_starts_camera(self, client_with_camera):
        client, mock_manager, _ = client_with_camera
        mock_manager.get_stream.return_value = None  # Not yet streaming
        res = client.post("/call", json={"tool": "camera_get_frame", "arguments": {"camera_id": "cam_1"}})
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"
        mock_manager.start_camera.assert_called_once_with("cam_1", "1")

    def test_call_camera_get_frame_camera_not_found(self, client_with_camera):
        client, mock_manager, _ = client_with_camera
        mock_manager.get_stream.return_value = None
        mock_manager.discover_cameras.return_value = []
        res = client.post("/call", json={"tool": "camera_get_frame", "arguments": {"camera_id": "cam_99"}})
        assert res.status_code == 400
        data = res.json()
        assert data["detail"]["code"] == "CAMERA_NOT_FOUND"

    def test_call_camera_get_frame_resolves_alias_default(self, client_with_camera):
        """Alias 'default' should resolve to the first available camera."""
        client, mock_manager, _ = client_with_camera
        res = client.post("/call", json={"tool": "camera_get_frame", "arguments": {"camera_id": "default"}})
        assert res.status_code == 200
        mock_manager.get_stream.assert_called_with("cam_0")

    def test_call_camera_get_frame_resolves_alias_chinese_entrance(self, client_with_camera):
        """Alias '门口' should resolve to the first available camera."""
        client, mock_manager, _ = client_with_camera
        res = client.post("/call", json={"tool": "camera_get_frame", "arguments": {"camera_id": "门口"}})
        assert res.status_code == 200
        mock_manager.get_stream.assert_called_with("cam_0")

    def test_call_camera_get_frame_resolves_alias_chinese_indoor(self, client_with_camera):
        """Alias '室内' should resolve to the second available camera."""
        client, mock_manager, _ = client_with_camera
        res = client.post("/call", json={"tool": "camera_get_frame", "arguments": {"camera_id": "室内"}})
        assert res.status_code == 200
        mock_manager.get_stream.assert_called_with("cam_1")

    def test_call_camera_get_frame_alias_out_of_range_fallback(self, client_with_camera):
        """Alias pointing to index beyond available cameras should fall back gracefully."""
        client, mock_manager, _ = client_with_camera
        # Only one camera available; '室内' (index 1) is out of range
        mock_manager.discover_cameras.return_value = [
            {"id": "cam_0", "name": "Camera 0", "source": "0", "resolution": "640x480", "fps": 30.0, "status": "available"},
        ]
        mock_manager.get_stream.return_value = None
        res = client.post("/call", json={"tool": "camera_get_frame", "arguments": {"camera_id": "室内"}})
        assert res.status_code == 400
        assert res.json()["detail"]["code"] == "CAMERA_NOT_FOUND"

    # -----------------------------------------------------------------------
    # 4. camera_get_last_detection
    # -----------------------------------------------------------------------

    def test_call_camera_get_last_detection_with_person(self, client_with_camera):
        client, mock_manager, fake_frame = client_with_camera
        res = client.post("/call", json={"tool": "camera_get_last_detection", "arguments": {"camera_id": "cam_0"}})
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"
        assert data["result"]["detected"] is True
        assert data["result"]["camera_id"] == "cam_0"
        assert "confidence" in data["result"]
        assert "bbox" in data["result"]
        assert "image_base64" in data["result"]
        decoded = base64.b64decode(data["result"]["image_base64"])
        assert decoded == fake_frame

    def test_call_camera_get_last_detection_normalizes_numeric_id(self, client_with_camera):
        client, mock_manager, _ = client_with_camera
        res = client.post("/call", json={"tool": "camera_get_last_detection", "arguments": {"camera_id": "1"}})
        assert res.status_code == 200
        mock_manager.get_stream.assert_called_with("cam_1")

    def test_call_camera_get_last_detection_no_detection_yet(self, client_with_camera):
        client, mock_manager, _ = client_with_camera
        mock_stream = MagicMock()
        mock_stream.get_last_detection_event.return_value = None
        mock_stream.get_last_detection_bytes.return_value = None
        mock_manager.get_stream.return_value = mock_stream
        res = client.post("/call", json={"tool": "camera_get_last_detection", "arguments": {"camera_id": "cam_0"}})
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"
        assert data["result"]["detected"] is False
        assert "No person detected yet" in data["result"]["message"]

    def test_call_camera_get_last_detection_camera_not_streaming(self, client_with_camera):
        client, mock_manager, _ = client_with_camera
        mock_manager.get_stream.return_value = None
        res = client.post("/call", json={"tool": "camera_get_last_detection", "arguments": {"camera_id": "cam_99"}})
        assert res.status_code == 400
        data = res.json()
        assert data["detail"]["code"] == "CAMERA_NOT_FOUND"

    def test_call_camera_get_last_detection_resolves_alias_default(self, client_with_camera):
        client, mock_manager, _ = client_with_camera
        res = client.post("/call", json={"tool": "camera_get_last_detection", "arguments": {"camera_id": "default"}})
        assert res.status_code == 200
        mock_manager.get_stream.assert_called_with("cam_0")

    def test_call_camera_get_last_detection_resolves_alias_chinese(self, client_with_camera):
        client, mock_manager, _ = client_with_camera
        res = client.post("/call", json={"tool": "camera_get_last_detection", "arguments": {"camera_id": "门口"}})
        assert res.status_code == 200
        mock_manager.get_stream.assert_called_with("cam_0")

    # -----------------------------------------------------------------------
    # 5. Camera-disabled path
    # -----------------------------------------------------------------------

    def test_camera_tools_disabled_when_manager_none(self):
        os.environ["DEEPMCP_API_KEY"] = ""
        os.environ["DEEPMCP_MOCK_MODE"] = "true"
        os.environ["DEEPMCP_CAMERA_ENABLED"] = "false"
        import config
        importlib.reload(config)
        import main
        importlib.reload(main)

        with TestClient(main.app) as client:
            import mcp.server as mcp_server
            mcp_server.init_tools(mock_mode=True, camera_manager=None)
            main.app.state.camera_manager = None
            for tool in ("camera_list", "camera_get_frame", "camera_get_last_detection"):
                res = client.post("/call", json={"tool": tool, "arguments": {"camera_id": "cam_0"}})
                assert res.status_code == 400, f"{tool} should error when camera disabled"
                assert res.json()["detail"]["code"] == "CAMERA_DISABLED"

    # -----------------------------------------------------------------------
    # 6. OpenClaw natural-language simulation
    # -----------------------------------------------------------------------

    def test_openclaw_natural_language_flow(self, client_with_camera):
        """Simulate: user says '查看门口摄像头' -> OpenClaw discovers tools, calls camera_list,
        then camera_get_frame with discovered id."""
        client, mock_manager, fake_frame = client_with_camera

        # Step 1: Discovery
        tools_res = client.get("/tools")
        assert tools_res.status_code == 200
        tools = {t["name"]: t for t in tools_res.json()["tools"]}
        assert "camera_list" in tools
        assert "camera_get_frame" in tools

        # Step 2: List cameras (OpenClaw would do this to resolve "门口摄像头")
        list_res = client.post("/call", json={"tool": "camera_list", "arguments": {}})
        assert list_res.status_code == 200
        cams = list_res.json()["result"]["available_cameras"]
        target_id = cams[0]["id"]  # e.g. cam_0

        # Step 3: Get frame
        frame_res = client.post("/call", json={"tool": "camera_get_frame", "arguments": {"camera_id": target_id}})
        assert frame_res.status_code == 200
        frame_data = frame_res.json()["result"]
        assert frame_data["format"] == "jpeg"
        assert len(base64.b64decode(frame_data["image_base64"])) > 0

        # Step 4: Get last detection
        det_res = client.post("/call", json={"tool": "camera_get_last_detection", "arguments": {"camera_id": target_id}})
        assert det_res.status_code == 200
        det_data = det_res.json()["result"]
        assert det_data["detected"] is True

        # Contract match: every step succeeded
        assert all(r.status_code == 200 for r in (tools_res, list_res, frame_res, det_res))

    # -----------------------------------------------------------------------
    # 7. Contract / Latency guards
    # -----------------------------------------------------------------------

    def test_camera_tool_latency_under_500ms(self, client_with_camera):
        """端到端延迟 < 500ms（不含模型推理）"""
        client, _, _ = client_with_camera
        t0 = time.perf_counter()
        res = client.post("/call", json={"tool": "camera_get_frame", "arguments": {"camera_id": "cam_0"}})
        elapsed_ms = (time.perf_counter() - t0) * 1000
        assert res.status_code == 200
        assert elapsed_ms < 500, f"camera_get_frame took {elapsed_ms:.1f}ms, exceeds 500ms budget"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
