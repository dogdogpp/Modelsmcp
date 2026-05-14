"""OpenClaw Webhook reliability layer: queue, retry, dedup, metrics."""

import json
import sqlite3
import threading
import time
from dataclasses import dataclass, field
from typing import Any

import httpx

import communication_settings as comm_settings


@dataclass
class WebhookMetrics:
    delivery_total: int = 0
    delivery_failed_total: int = 0
    queue_depth: int = 0
    _lock: threading.Lock = field(default_factory=threading.Lock)

    def inc_delivery(self) -> None:
        with self._lock:
            self.delivery_total += 1

    def inc_failed(self) -> None:
        with self._lock:
            self.delivery_failed_total += 1

    def set_queue_depth(self, depth: int) -> None:
        with self._lock:
            self.queue_depth = depth

    def snapshot(self) -> dict[str, int]:
        with self._lock:
            return {
                "webhook_delivery_total": self.delivery_total,
                "webhook_delivery_failed_total": self.delivery_failed_total,
                "webhook_queue_depth": self.queue_depth,
            }


class WebhookQueue:
    """Persistent SQLite-backed queue with exponential-backoff retry,
    duplicate suppression, and Prometheus-style metrics.
    """

    def __init__(
        self,
        db_path: str = "webhook_queue.db",
        webhook_url: str = "",
        api_key: str = "",
        timeout: float = 10.0,
        max_retries: int = 5,
        dedup_window_seconds: float = 60.0,
        backoff_base_seconds: float = 1.0,
    ) -> None:
        self.db_path = db_path
        self.webhook_url = webhook_url
        self.api_key = api_key
        self.timeout = timeout
        self.max_retries = max_retries
        self.dedup_window_seconds = dedup_window_seconds
        self.backoff_base_seconds = backoff_base_seconds
        self.metrics = WebhookMetrics()

        self._dedup_cache: dict[str, float] = {}
        self._dedup_lock = threading.Lock()

        self._worker_thread: threading.Thread | None = None
        self._stop_event = threading.Event()

        self._init_db()

    def _init_db(self) -> None:
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS webhook_queue (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    camera_id TEXT NOT NULL,
                    class_name TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    created_at REAL NOT NULL,
                    retry_count INTEGER DEFAULT 0,
                    next_retry_at REAL NOT NULL,
                    status TEXT DEFAULT 'pending'
                )
                """
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_status_next_retry ON webhook_queue(status, next_retry_at)"
            )
            conn.commit()

    def start(self) -> None:
        self._stop_event.clear()
        self._worker_thread = threading.Thread(target=self._worker_loop, daemon=True)
        self._worker_thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        if self._worker_thread is not None:
            self._worker_thread.join(timeout=5.0)

    def enqueue(
        self,
        camera_id: str,
        class_name: str,
        payload: dict[str, Any],
        confidence: float | None = None,
        switch_key: str = "webhook_send",
    ) -> bool:
        if not self.webhook_url:
            return False

        if not comm_settings.is_enabled(switch_key):
            return False

        # Embed switch_key into payload so _process_pending can enforce it
        # even if the switch was toggled after enqueue.
        payload = dict(payload)
        payload["_switch_key"] = switch_key

        conf_bucket = f"{round(confidence, 1)}" if confidence is not None else "any"
        dedup_key = f"{camera_id}:{class_name}:{conf_bucket}"
        now = time.time()
        with self._dedup_lock:
            cutoff = now - self.dedup_window_seconds
            self._dedup_cache = {
                k: v for k, v in self._dedup_cache.items() if v > cutoff
            }
            last_sent = self._dedup_cache.get(dedup_key)
            if last_sent is not None and (now - last_sent) < self.dedup_window_seconds:
                return False
            self._dedup_cache[dedup_key] = now

        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                INSERT INTO webhook_queue
                (camera_id, class_name, payload, created_at, retry_count, next_retry_at, status)
                VALUES (?, ?, ?, ?, 0, ?, 'pending')
                """,
                (camera_id, class_name, json.dumps(payload), now, now),
            )
            conn.commit()

        self._update_queue_depth()
        return True

    def _update_queue_depth(self) -> None:
        with sqlite3.connect(self.db_path) as conn:
            cur = conn.execute(
                "SELECT COUNT(*) FROM webhook_queue WHERE status = 'pending'"
            )
            depth = cur.fetchone()[0]
        self.metrics.set_queue_depth(depth)

    def _worker_loop(self) -> None:
        while not self._stop_event.is_set():
            try:
                self._process_pending()
            except Exception as e:
                print(f"[WebhookWorker] Error: {e}")
            time.sleep(1.0)

    def _process_pending(self) -> None:
        now = time.time()
        with sqlite3.connect(self.db_path) as conn:
            cur = conn.execute(
                """
                SELECT id, payload, retry_count FROM webhook_queue
                WHERE status = 'pending' AND next_retry_at <= ?
                ORDER BY next_retry_at ASC
                LIMIT 10
                """,
                (now,),
            )
            rows = cur.fetchall()

        for row_id, payload_json, retry_count in rows:
            if self._stop_event.is_set():
                break
            payload = json.loads(payload_json)
            switch_key = payload.pop("_switch_key", "webhook_send")

            if not comm_settings.is_enabled(switch_key):
                # Drop the event if its switch is now disabled
                with sqlite3.connect(self.db_path) as conn:
                    conn.execute("DELETE FROM webhook_queue WHERE id = ?", (row_id,))
                    conn.commit()
                continue

            success = self._attempt_delivery(payload)
            self.metrics.inc_delivery()

            if success:
                with sqlite3.connect(self.db_path) as conn:
                    conn.execute(
                        "DELETE FROM webhook_queue WHERE id = ?", (row_id,)
                    )
                    conn.commit()
            else:
                new_retry = retry_count + 1
                if new_retry > self.max_retries:
                    self.metrics.inc_failed()
                    with sqlite3.connect(self.db_path) as conn:
                        conn.execute(
                            """
                            UPDATE webhook_queue
                            SET status = 'failed', retry_count = ?
                            WHERE id = ?
                            """,
                            (new_retry, row_id),
                        )
                        conn.commit()
                    print(
                        f"[WebhookWorker] Delivery failed permanently after "
                        f"{self.max_retries} retries for camera {payload.get('camera_id')}"
                    )
                else:
                    backoff = self.backoff_base_seconds * (2 ** retry_count)
                    next_retry = now + backoff
                    # Restore _switch_key for next retry attempt
                    payload["_switch_key"] = switch_key
                    with sqlite3.connect(self.db_path) as conn:
                        conn.execute(
                            """
                            UPDATE webhook_queue
                            SET retry_count = ?, next_retry_at = ?, status = 'pending', payload = ?
                            WHERE id = ?
                            """,
                            (new_retry, next_retry, json.dumps(payload), row_id),
                        )
                        conn.commit()

        self._update_queue_depth()

    def _attempt_delivery(self, payload: dict[str, Any]) -> bool:
        try:
            headers = {"Content-Type": "application/json"}
            if self.api_key:
                headers["Authorization"] = f"Bearer {self.api_key}"
            with httpx.Client(timeout=self.timeout) as client:
                resp = client.post(
                    self.webhook_url, json=payload, headers=headers
                )
                if resp.status_code >= 500 or resp.status_code == 429:
                    return False
                if 400 <= resp.status_code < 500:
                    print(
                        f"[WebhookWorker] Non-retryable error {resp.status_code} "
                        f"for camera {payload.get('camera_id')}"
                    )
                    return True
                return resp.status_code < 400
        except (httpx.TimeoutException, httpx.ConnectError, httpx.NetworkError):
            return False
        except Exception as e:
            print(f"[WebhookWorker] Unexpected delivery error: {e}")
            return False

    def get_metrics(self) -> dict[str, int]:
        return self.metrics.snapshot()
