import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";

export type SwitchKey =
  | "websocket_bidirectional"
  | "redis_subscription"
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

interface PersistedState {
  switches: Record<SwitchKey, boolean>;
  logs: OperationLog[];
}

const STORAGE_KEY = "deepmcp_communication_settings";
const LOG_LIMIT = 20;

const DEFAULT_SWITCHES: Record<SwitchKey, boolean> = {
  websocket_bidirectional: true,
  redis_subscription: true,
  sse_receive: true,
  webhook_send: true,
  sse_send: true,
  feishu_push: true,
};

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function trackEvent(
  eventName: string,
  payload?: Record<string, unknown>
) {
  // Placeholder for future analytics SDK integration
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug("[trackEvent]", eventName, payload);
  }
}

function readPersistedState(): { state: PersistedState; parseFailed: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw)
      return { state: { switches: { ...DEFAULT_SWITCHES }, logs: [] }, parseFailed: false };
    const parsed = JSON.parse(raw) as PersistedState;
    if (
      parsed &&
      typeof parsed === "object" &&
      parsed.switches &&
      typeof parsed.switches === "object"
    ) {
      // Merge with defaults to handle new switches added later
      const merged: Record<SwitchKey, boolean> = { ...DEFAULT_SWITCHES };
      (Object.keys(merged) as SwitchKey[]).forEach((k) => {
        if (typeof parsed.switches[k] === "boolean") {
          merged[k] = parsed.switches[k];
        }
      });
      return {
        state: {
          switches: merged,
          logs: Array.isArray(parsed.logs) ? parsed.logs.slice(-LOG_LIMIT) : [],
        },
        parseFailed: false,
      };
    }
  } catch {
    // parse error or corrupted data
  }
  return { state: { switches: { ...DEFAULT_SWITCHES }, logs: [] }, parseFailed: true };
}

function writePersistedState(state: PersistedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    // localStorage may be disabled in private mode or quota exceeded
    return false;
  }
}

export function useCommunicationSettings() {
  const initial = useRef(readPersistedState()).current;
  const [states, setStates] = useState<Record<SwitchKey, boolean>>(
    initial.state.switches
  );
  const [logs, setLogs] = useState<OperationLog[]>(initial.state.logs);
  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(new Set());
  const initializedRef = useRef(false);

  // Notify user if initial load had parse errors
  useEffect(() => {
    if (initial.parseFailed) {
      toast.warning("配置已重置为默认值");
    }
  }, []);

  // Sync to localStorage whenever states or logs change
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      return;
    }
    const ok = writePersistedState({ switches: states, logs });
    if (!ok) {
      toast.warning("隐私模式下配置不会持久化，刷新后将恢复默认值");
    }
  }, [states, logs]);

  const toggle = useCallback(
    async (key: SwitchKey, title: string, nextValue: boolean) => {
      setLoadingKeys((prev) => {
        if (prev.has(key)) return prev;
        return new Set(prev).add(key);
      });

      const startTime = performance.now();

      // Simulate async persistence / propagation delay
      await new Promise((r) => setTimeout(r, 600));

      setStates((prev) => ({ ...prev, [key]: nextValue }));

      const logEntry: OperationLog = {
        id: generateId(),
        timestamp: Date.now(),
        switchId: key,
        switchTitle: title,
        newState: nextValue,
        actor: "当前用户",
      };

      setLogs((prev) => {
        const next = [...prev, logEntry];
        if (next.length > LOG_LIMIT) next.shift();
        return next;
      });

      setLoadingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });

      const duration = Math.round(performance.now() - startTime);
      trackEvent("comm_switch_toggled", {
        switch_id: key,
        new_state: nextValue ? "on" : "off",
        duration_ms: duration,
      });

      toast.success(`${title} 已${nextValue ? "启用" : "关闭"}`);
    },
    []
  );

  const isLoading = useCallback(
    (key: SwitchKey) => loadingKeys.has(key),
    [loadingKeys]
  );

  const resetToDefaults = useCallback(() => {
    setStates({ ...DEFAULT_SWITCHES });
    setLogs([]);
    toast.info("配置已重置为默认值");
    trackEvent("comm_settings_reset_defaults");
  }, []);

  return {
    states,
    logs,
    toggle,
    isLoading,
    resetToDefaults,
  };
}
