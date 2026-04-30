"""Webhook reliability专项测试 (SEL-34)."""

import os
import sys
import json
import sqlite3
import tempfile
import time
from unittest.mock import patch, MagicMock
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "server"))

import pytest

from fastapi.testclient import TestClient


def clear_server_modules():
    for name in list(sys.modules.keys()):
        if name in (
            "config", "main", "mcp.server", "server.mcp.server",
            "server.models.whisper_handler", "server.models.yolo_handler",
            "server.models.__init__", "server.camera", "server.mcp.__init__",
            "server.webhook",
        ):
            del sys.modules[name]
        elif name.startswith("server."):
            del sys.modules[name]


# ---------------------------------------------------------------------------
# 1. SQLite 持久化测试
# ---------------------------------------------------------------------------

class TestWebhookPersistence:
    def test_queue_survives_recreate(self):
        """网络中断后重启，队列中的消息必须仍然存在并可投递。"""
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "queue.db"
            from webhook import WebhookQueue

            q1 = WebhookQueue(
                db_path=str(db_path),
                webhook_url="http://localhost:9999/hook",
                timeout=2.0,
                max_retries=5,
            )
            q1.enqueue("cam_0", "person", {"camera_id": "cam_0"}, confidence=0.92)

            # 直接查库验证写入
            with sqlite3.connect(str(db_path)) as conn:
                cur = conn.execute("SELECT COUNT(*) FROM webhook_queue WHERE status='pending'")
                assert cur.fetchone()[0] == 1

            # 模拟进程重启：新建实例指向同一 DB
            q2 = WebhookQueue(
                db_path=str(db_path),
                webhook_url="http://localhost:9999/hook",
                timeout=2.0,
                max_retries=5,
            )
            q2.start()
            # 等待 worker 发现没有可投递项（因为目标不可达，但至少不会崩溃）
            time.sleep(0.3)
            metrics = q2.get_metrics()
            assert metrics["webhook_queue_depth"] == 1
            q2.stop()


# ---------------------------------------------------------------------------
# 2. 指数退避重试测试
# ---------------------------------------------------------------------------

class TestWebhookExponentialBackoff:
    def test_backoff_intervals(self):
        """重试间隔必须遵循 1s/2s/4s/8s/16s。"""
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "queue.db"
            from webhook import WebhookQueue

            q = WebhookQueue(
                db_path=str(db_path),
                webhook_url="http://localhost:9999/hook",
                timeout=2.0,
                max_retries=5,
                backoff_base_seconds=1.0,
            )
            q.enqueue("cam_0", "person", {"camera_id": "cam_0"}, confidence=0.92)
            q.start()

            # 模拟 delivery 永远失败
            with patch.object(q, "_attempt_delivery", return_value=False):
                time.sleep(1.5)  # 等 worker 跑一轮
                q.stop()

            with sqlite3.connect(str(db_path)) as conn:
                cur = conn.execute(
                    "SELECT retry_count, next_retry_at - created_at as backoff FROM webhook_queue ORDER BY retry_count"
                )
                rows = cur.fetchall()

            # 至少应该有一次重试记录
            assert len(rows) >= 1
            for retry_count, backoff in rows:
                expected_backoff = 2 ** (retry_count - 1)
                assert backoff >= expected_backoff * 0.9, f"retry {retry_count}: backoff {backoff} < {expected_backoff}"


# ---------------------------------------------------------------------------
# 3. 500 错误恢复测试
# ---------------------------------------------------------------------------

class TestWebhook500Recovery:
    def test_eventual_success_after_500(self):
        """模拟目标返回 500，重试后最终返回 200，消息应被删除。"""
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "queue.db"
            from webhook import WebhookQueue

            q = WebhookQueue(
                db_path=str(db_path),
                webhook_url="http://localhost:9999/hook",
                timeout=2.0,
                max_retries=5,
                backoff_base_seconds=0.01,
            )
            q.enqueue("cam_0", "person", {"camera_id": "cam_0"}, confidence=0.92)

            call_count = 0

            def side_effect(*args, **kwargs):
                nonlocal call_count
                call_count += 1
                if call_count < 3:
                    return False  # 模拟 500 / 网络错误
                return True  # 最终成功

            with patch.object(q, "_attempt_delivery", side_effect=side_effect):
                # 直接驱动 worker 轮询，避免依赖真实线程时序
                for _ in range(10):
                    q._process_pending()
                    time.sleep(0.05)

            # 队列应被清空
            with sqlite3.connect(str(db_path)) as conn:
                cur = conn.execute("SELECT COUNT(*) FROM webhook_queue")
                assert cur.fetchone()[0] == 0

            metrics = q.get_metrics()
            assert metrics["webhook_delivery_total"] >= 3
            assert metrics["webhook_delivery_failed_total"] == 0


# ---------------------------------------------------------------------------
# 4. 60s 去重窗口测试
# ---------------------------------------------------------------------------

class TestWebhookDedup:
    def test_same_camera_class_confidence_deduped_within_60s(self):
        """相同 camera + class + confidence(0.1 精度) 在 60s 内只入队一次。"""
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "queue.db"
            from webhook import WebhookQueue

            q = WebhookQueue(
                db_path=str(db_path),
                webhook_url="http://localhost:9999/hook",
                dedup_window_seconds=60.0,
            )
            q.start()

            # 第一次应成功
            assert q.enqueue("cam_0", "person", {"a": 1}, confidence=0.92) is True
            # 相同 key 在 60s 内应被去重
            assert q.enqueue("cam_0", "person", {"a": 2}, confidence=0.92) is False
            # 相同 camera + class 但 confidence 不同（0.92 -> 0.9 vs 0.96 -> 1.0）应成功
            assert q.enqueue("cam_0", "person", {"a": 3}, confidence=0.96) is True
            # 不同 class 应成功
            assert q.enqueue("cam_0", "car", {"a": 4}, confidence=0.92) is True
            # 不同 camera 应成功
            assert q.enqueue("cam_1", "person", {"a": 5}, confidence=0.92) is True

            q.stop()
            with sqlite3.connect(str(db_path)) as conn:
                cur = conn.execute("SELECT COUNT(*) FROM webhook_queue")
                assert cur.fetchone()[0] == 4

    def test_dedup_expires_after_window(self):
        """超过 60s 后相同事件应允许再次入队。"""
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "queue.db"
            from webhook import WebhookQueue

            q = WebhookQueue(
                db_path=str(db_path),
                webhook_url="http://localhost:9999/hook",
                dedup_window_seconds=0.5,  # 缩短窗口加速测试
            )
            q.start()

            assert q.enqueue("cam_0", "person", {"a": 1}, confidence=0.92) is True
            assert q.enqueue("cam_0", "person", {"a": 2}, confidence=0.92) is False
            time.sleep(0.6)
            assert q.enqueue("cam_0", "person", {"a": 3}, confidence=0.92) is True

            q.stop()


# ---------------------------------------------------------------------------
# 5. /metrics 指标存在性断言
# ---------------------------------------------------------------------------

class TestWebhookMetricsEndpoint:
    def test_metrics_contains_webhook_fields(self):
        """启动带 webhook 配置的服务，/metrics 必须包含 webhook 相关指标。"""
        clear_server_modules()
        os.environ["DEEPMCP_API_KEY"] = ""
        os.environ["DEEPMCP_MOCK_MODE"] = "true"
        os.environ["DEEPMCP_CAMERA_ENABLED"] = "false"
        os.environ["OPENCLAW_WEBHOOK_URL"] = "http://localhost:9999/hook"
        os.environ["DEEPMCP_WEBHOOK_MAX_RETRIES"] = "2"

        import config, importlib
        importlib.reload(config)
        import main, importlib
        importlib.reload(main)

        with TestClient(main.app) as client:
            res = client.get("/metrics")
            assert res.status_code == 200
            data = res.json()
            assert "webhook" in data, f"Missing webhook section in metrics: {data.keys()}"
            wh = data["webhook"]
            assert "webhook_delivery_total" in wh
            assert "webhook_delivery_failed_total" in wh
            assert "webhook_queue_depth" in wh


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
