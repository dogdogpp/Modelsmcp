import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

export type SwitchKey =
  | "websocket_bidirectional"
  | "sse_receive"
  | "webhook_send"
  | "sse_send"
  | "feishu_push";

export interface OperationLog {
  id: string;
  timestamp: number;
  switchId: SwitchKey;
  switchTitle: string;
  newState: boolean;
  actor: string;
}

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:8081";
const API_KEY =
  import.meta.env.VITE_DEEPMCP_API_KEY ||
  import.meta.env.VITE_API_KEY ||
  "";

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (API_KEY) headers["X-API-Key"] = API_KEY;
  return headers;
}

function trackEvent(
  eventName: string,
  payload?: Record<string, unknown>
) {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug("[trackEvent]", eventName, payload);
  }
}

export function useCommunicationSettings() {
  const [states, setStates] = useState<Record<SwitchKey, boolean>>({
    websocket_bidirectional: true,
    sse_receive: true,
    webhook_send: true,
    sse_send: true,
    feishu_push: true,
  });
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);

  // Initial fetch from backend
  useEffect(() => {
    let cancelled = false;
    async function fetchSettings() {
      try {
        const res = await fetch(`${API_BASE}/settings/communication`, {
          headers: authHeaders(),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.switches && typeof data.switches === "object") {
          setStates((prev) => ({ ...prev, ...data.switches }));
        }
        if (Array.isArray(data.logs)) {
          setLogs(data.logs);
        }
      } catch {
        toast.error("通信设置加载失败，使用默认值");
      } finally {
        if (!cancelled) setInitialized(true);
      }
    }
    fetchSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = useCallback(
    async (key: SwitchKey, title: string, nextValue: boolean) => {
      if (loadingKeys.has(key)) return;
      setLoadingKeys((prev) => new Set(prev).add(key));

      const startTime = performance.now();

      try {
        const res = await fetch(
          `${API_BASE}/settings/communication/${key}`,
          {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ value: nextValue }),
          }
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || `HTTP ${res.status}`);
        }
        const data = await res.json();

        if (data.switches && typeof data.switches === "object") {
          setStates((prev) => ({ ...prev, ...data.switches }));
        }
        if (Array.isArray(data.logs)) {
          setLogs(data.logs);
        }

        const duration = Math.round(performance.now() - startTime);
        trackEvent("comm_switch_toggled", {
          switch_id: key,
          new_state: nextValue ? "on" : "off",
          duration_ms: duration,
        });

        toast.success(`${title} 已${nextValue ? "启用" : "关闭"}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "保存失败";
        toast.error(`${title} 保存失败：${msg}`);
      } finally {
        setLoadingKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [loadingKeys]
  );

  const isLoading = useCallback(
    (key: SwitchKey) => loadingKeys.has(key),
    [loadingKeys]
  );

  return {
    states,
    logs,
    toggle,
    isLoading,
    initialized,
  };
}
