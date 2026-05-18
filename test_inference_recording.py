"""Unit tests for inference recording (SEL-100)."""

import os
import sys
import json
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "server"))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from mcp.protocol import CallResponse

# Import once at module level to avoid SQLAlchemy redefinition issues
from db.models import ModelMeta, Subscription, CommunicationLog
from db.crud import upsert_subscription_stats
from main import _record_inference


def _make_mock_session():
    """Return a mock AsyncSession with async methods stubbed."""
    session = MagicMock(spec=AsyncSession)
    session.execute = AsyncMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    session.add = MagicMock()
    return session


# ---------------------------------------------------------------------------
# 1. _record_inference unit tests
# ---------------------------------------------------------------------------

class TestRecordInference:
    @pytest.mark.asyncio
    async def test_record_inference_creates_log_and_upserts_subscription(self):
        session = _make_mock_session()
        model = ModelMeta(
            id="yolo26",
            name="YOLO2026",
            category="目标检测",
            version="8.3.0",
            mcp_tool="yolo26_detect",
        )

        with patch("main.get_model_meta_by_mcp_tool", new_callable=AsyncMock, return_value=model):
            with patch("main.upsert_subscription_stats", new_callable=AsyncMock) as mock_upsert:
                response = CallResponse(
                    status="success",
                    model="yolo26",
                    inference_time="12ms",
                    device="cuda",
                    result={"detections": [{"class": "person"}]},
                )

                await _record_inference(session, "yolo26_detect", response, mode="HTTP", payload_size_bytes=1024)

        session.add.assert_called_once()
        added_log = session.add.call_args[0][0]
        assert isinstance(added_log, CommunicationLog)
        assert added_log.model_id == "yolo26"
        assert added_log.status == "success"
        assert added_log.latency_ms == 12.0
        assert added_log.mode == "HTTP"
        assert added_log.payload_size_bytes == 1024
        session.commit.assert_awaited_once()
        mock_upsert.assert_awaited_once_with(session, model_id="yolo26", model_name="YOLO2026", latency_ms=12.0, success=True)

    @pytest.mark.asyncio
    async def test_record_inference_silent_when_model_not_found(self):
        session = _make_mock_session()

        with patch("main.get_model_meta_by_mcp_tool", new_callable=AsyncMock, return_value=None):
            response = CallResponse(
                status="success",
                model="unknown",
                inference_time="0ms",
                device="cpu",
                result={},
            )

            await _record_inference(session, "nonexistent_tool", response, mode="HTTP")

        session.add.assert_not_called()
        session.commit.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_record_inference_survives_db_exception(self):
        session = _make_mock_session()
        model = ModelMeta(
            id="yolo26",
            name="YOLO2026",
            category="目标检测",
            version="8.3.0",
            mcp_tool="yolo26_detect",
        )

        with patch("main.get_model_meta_by_mcp_tool", new_callable=AsyncMock, return_value=model):
            session.commit = AsyncMock(side_effect=RuntimeError("DB down"))

            response = CallResponse(
                status="success",
                model="yolo26",
                inference_time="12ms",
                device="cuda",
                result={"detections": []},
            )

            # Should NOT raise
            await _record_inference(session, "yolo26_detect", response, mode="HTTP")

    @pytest.mark.asyncio
    async def test_record_inference_parses_latency_correctly(self):
        session = _make_mock_session()
        model = ModelMeta(
            id="whisper",
            name="Whisper",
            category="语音识别",
            version="large-v3",
            mcp_tool="whisper_transcribe",
        )

        with patch("main.get_model_meta_by_mcp_tool", new_callable=AsyncMock, return_value=model):
            with patch("main.upsert_subscription_stats", new_callable=AsyncMock):
                response = CallResponse(
                    status="success",
                    model="whisper",
                    inference_time="320ms",
                    device="cuda",
                    result={"segments": [{"text": "hello"}]},
                )

                await _record_inference(session, "whisper_transcribe", response, mode="SSE")

        added_log = session.add.call_args[0][0]
        assert isinstance(added_log, CommunicationLog)
        assert added_log.latency_ms == 320.0
        assert added_log.summary == "Transcribe 1 segments"

    @pytest.mark.asyncio
    async def test_record_inference_error_response_still_logged(self):
        session = _make_mock_session()
        model = ModelMeta(
            id="yolo26",
            name="YOLO2026",
            category="目标检测",
            version="8.3.0",
            mcp_tool="yolo26_detect",
        )

        with patch("main.get_model_meta_by_mcp_tool", new_callable=AsyncMock, return_value=model):
            with patch("main.upsert_subscription_stats", new_callable=AsyncMock):
                response = CallResponse(
                    status="error",
                    model="yolo26",
                    inference_time="0ms",
                    device="cpu",
                    result=None,
                    error={"code": "INFERENCE_ERROR", "message": "boom"},
                )

                await _record_inference(session, "yolo26_detect", response, mode="HTTP")

        added_log = session.add.call_args[0][0]
        assert isinstance(added_log, CommunicationLog)
        assert added_log.status == "error"


# ---------------------------------------------------------------------------
# 2. CRUD helper unit tests
# ---------------------------------------------------------------------------

class TestUpsertSubscriptionStats:
    @pytest.mark.asyncio
    async def test_creates_subscription_when_none_exists(self):
        session = _make_mock_session()
        session.execute.return_value.scalar_one_or_none = MagicMock(return_value=None)

        sub = await upsert_subscription_stats(session, "yolo26", "YOLO2026", latency_ms=12.0, success=True)

        assert isinstance(sub, Subscription)
        assert sub.model_id == "yolo26"
        assert sub.total_calls == 1
        assert sub.success_rate == 1.0
        assert sub.avg_latency_ms == 12.0
        session.add.assert_called_once_with(sub)

    @pytest.mark.asyncio
    async def test_updates_existing_subscription(self):
        existing = Subscription(
            id="sub-yolo26",
            model_id="yolo26",
            model_name="YOLO2026",
            status="active",
            subscribed_at=datetime.utcnow(),
            last_active_at=datetime.utcnow(),
            total_calls=10,
            success_rate=0.9,
            avg_latency_ms=15.0,
        )
        session = _make_mock_session()
        session.execute.return_value.scalar_one_or_none = MagicMock(return_value=existing)

        sub = await upsert_subscription_stats(session, "yolo26", "YOLO2026", latency_ms=25.0, success=True)

        assert sub.total_calls == 11
        expected_rate = round((0.9 * 10 + 1.0) / 11, 4)
        expected_latency = round((15.0 * 10 + 25.0) / 11, 2)
        assert sub.success_rate == expected_rate
        assert sub.avg_latency_ms == expected_latency

    @pytest.mark.asyncio
    async def test_failure_lowers_success_rate(self):
        existing = Subscription(
            id="sub-yolo26",
            model_id="yolo26",
            model_name="YOLO2026",
            status="active",
            subscribed_at=datetime.utcnow(),
            last_active_at=datetime.utcnow(),
            total_calls=10,
            success_rate=0.9,
            avg_latency_ms=15.0,
        )
        session = _make_mock_session()
        session.execute.return_value.scalar_one_or_none = MagicMock(return_value=existing)

        sub = await upsert_subscription_stats(session, "yolo26", "YOLO2026", latency_ms=25.0, success=False)

        assert sub.total_calls == 11
        expected_rate = round((0.9 * 10 + 0.0) / 11, 4)
        assert sub.success_rate == expected_rate


# ---------------------------------------------------------------------------
# 3. Endpoint integration tests (mocked DB)
# ---------------------------------------------------------------------------

class TestEndpointRecording:
    @pytest.fixture(autouse=True)
    def _clear_env(self):
        os.environ["DEEPMCP_API_KEY"] = ""
        os.environ["DEEPMCP_MOCK_MODE"] = "true"
        os.environ["DEEPMCP_CAMERA_ENABLED"] = "false"
        import importlib
        import config
        importlib.reload(config)
        import main
        importlib.reload(main)
        yield

    def test_call_and_messages_endpoints_record_inference(self):
        import main
        with patch.object(main, "init_db", new_callable=AsyncMock):
            with patch.object(main, "_record_inference", new_callable=AsyncMock) as mock_record:
                with patch.object(main, "get_db") as mock_get_db:
                    mock_session = _make_mock_session()
                    mock_get_db.return_value = mock_session

                    with TestClient(main.app) as client:
                        res_call = client.post("/call", json={"tool": "yolo26_detect", "arguments": {"image": "test"}})
                        assert res_call.status_code == 200

                        res_msg = client.post(
                            "/messages?session_id=test-123",
                            json={
                                "jsonrpc": "2.0",
                                "id": 1,
                                "method": "tools/call",
                                "params": {"name": "yolo26_detect", "arguments": {"image": "test"}},
                            },
                        )
                        assert res_msg.status_code == 200

                    assert mock_record.await_count == 2
                    call_args = mock_record.call_args_list
                    assert call_args[0][0][1] == "yolo26_detect"
                    assert call_args[0][1]["mode"] == "HTTP"
                    assert call_args[1][0][1] == "yolo26_detect"
                    assert call_args[1][1]["mode"] == "SSE"

    def test_call_endpoint_records_error_before_raising(self):
        import main
        with patch.object(main, "init_db", new_callable=AsyncMock):
            with patch.object(main, "_record_inference", new_callable=AsyncMock) as mock_record:
                with patch.object(main, "get_db") as mock_get_db:
                    mock_session = _make_mock_session()
                    mock_get_db.return_value = mock_session

                    with TestClient(main.app) as client:
                        res = client.post("/call", json={"tool": "unknown_tool", "arguments": {}})
                        assert res.status_code == 400

                    mock_record.assert_awaited_once()
                    recorded_response = mock_record.call_args[0][2]
                    assert recorded_response.status == "error"

    def test_upload_endpoint_records_error_before_raising(self):
        import main
        with patch.object(main, "init_db", new_callable=AsyncMock):
            with patch.object(main, "_record_inference", new_callable=AsyncMock) as mock_record:
                with patch.object(main, "get_db") as mock_get_db:
                    mock_session = _make_mock_session()
                    mock_get_db.return_value = mock_session

                    with TestClient(main.app) as client:
                        res = client.post(
                            "/upload",
                            data={"tool": "unknown_tool", "arguments": "{}"},
                            files={"file": ("test.jpg", b"fake-image-data", "image/jpeg")},
                        )
                        assert res.status_code == 400

                    mock_record.assert_awaited_once()
                    recorded_response = mock_record.call_args[0][2]
                    assert recorded_response.status == "error"
