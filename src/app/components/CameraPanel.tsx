import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "motion/react";
import {
  Camera,
  Video,
  VideoOff,
  AlertCircle,
  Loader2,
  RefreshCw,
  Eye,
  Activity,
} from "lucide-react";

interface CameraInfo {
  id: string;
  name: string;
  source: string;
  resolution?: string;
  fps?: number;
  status: string;
}

interface StreamInfo {
  id: string;
  source: string;
  status: string;
  fps: number;
}

interface DetectionEvent {
  camera_id: string;
  timestamp: number;
  confidence: number;
  bbox: number[];
}

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8081";
const WS_BASE = API_BASE.replace(/^http/, "ws");

export function CameraPanel() {
  const [cameras, setCameras] = useState<CameraInfo[]>([]);
  const [streams, setStreams] = useState<StreamInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detections, setDetections] = useState<DetectionEvent[]>([]);
  const [streamFps, setStreamFps] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const detectionsRef = useRef<DetectionEvent[]>([]);
  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef(Date.now());

  const fetchCameras = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/cameras`);
      if (!res.ok) throw new Error("Failed to fetch cameras");
      const data = await res.json();
      setCameras(data.available || []);
      setStreams(data.active || []);
      if (data.available?.length > 0 && !selectedCamera) {
        setSelectedCamera(data.available[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  }, [selectedCamera]);

  useEffect(() => {
    fetchCameras();
    const interval = setInterval(fetchCameras, 5000);
    return () => clearInterval(interval);
  }, [fetchCameras]);

  const drawFrame = useCallback((blob: Blob) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (!imgRef.current) {
      imgRef.current = new Image();
    }
    const img = imgRef.current;
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      frameCountRef.current += 1;
      const now = Date.now();
      if (now - lastFpsTimeRef.current >= 1000) {
        setStreamFps(frameCountRef.current);
        frameCountRef.current = 0;
        lastFpsTimeRef.current = now;
      }
    };
    img.src = url;
  }, []);

  const startStream = async () => {
    if (!selectedCamera) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/cameras/${selectedCamera}/start`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to start camera");
      setIsStreaming(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  const stopStream = async () => {
    if (!selectedCamera) return;
    setIsLoading(true);
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    try {
      await fetch(`${API_BASE}/cameras/${selectedCamera}/stop`, { method: "POST" });
      setIsStreaming(false);
      setStreamFps(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isStreaming || !selectedCamera) return;

    const wsUrl = `${WS_BASE}/ws/cameras/${selectedCamera}`;
    const ws = new WebSocket(wsUrl);
    ws.binaryType = "blob";
    wsRef.current = ws;

    ws.onopen = () => {
      setError(null);
    };

    ws.onmessage = (event) => {
      if (event.data instanceof Blob) {
        drawFrame(event.data);
      }
    };

    ws.onerror = () => {
      setError("WebSocket error");
    };

    ws.onclose = () => {
      setIsStreaming(false);
    };

    // Poll last detection via REST for events metadata
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/cameras/${selectedCamera}/status`);
        if (res.ok) {
          const data = await res.json();
          setStreamFps(data.fps || 0);
        }
      } catch {
        // ignore
      }
    }, 2000);

    return () => {
      clearInterval(pollInterval);
      ws.close();
      wsRef.current = null;
    };
  }, [isStreaming, selectedCamera, drawFrame]);

  const activeStream = streams.find((s) => s.id === selectedCamera);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Camera size={16} className="text-cyan-400" />
            <span className="text-cyan-400 text-sm" style={{ fontWeight: 500 }}>
              本地摄像头实时检测
            </span>
          </div>
          <p className="text-gray-400 text-sm">YOLO2026 人形检测，WebSocket 低延迟推流</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchCameras}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 transition-all text-sm"
          >
            <RefreshCw size={14} />
            刷新
          </button>
          {isStreaming ? (
            <button
              onClick={stopStream}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all text-sm"
              style={{ fontWeight: 500 }}
            >
              {isLoading ? <Loader2 size={14} className="animate-spin" /> : <VideoOff size={14} />}
              停止
            </button>
          ) : (
            <button
              onClick={startStream}
              disabled={isLoading || !selectedCamera}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:opacity-90 transition-all text-sm disabled:opacity-50"
              style={{ fontWeight: 500 }}
            >
              {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Video size={14} />}
              开始推流
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left - Controls */}
        <div className="space-y-4">
          <div className="p-5 rounded-2xl border border-white/5 bg-white/[0.02]">
            <label className="text-gray-400 text-xs mb-3 block" style={{ fontWeight: 500 }}>
              选择摄像头
            </label>
            {cameras.length === 0 ? (
              <p className="text-gray-600 text-sm">未检测到可用摄像头</p>
            ) : (
              <div className="space-y-2">
                {cameras.map((cam) => (
                  <button
                    key={cam.id}
                    onClick={() => {
                      setSelectedCamera(cam.id);
                      if (isStreaming) {
                        stopStream();
                      }
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                      selectedCamera === cam.id
                        ? "border-cyan-500/30 bg-cyan-500/5"
                        : "border-white/10 bg-white/5 hover:bg-white/[0.07]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Camera size={16} className="text-gray-400" />
                      <div>
                        <div className="text-white text-sm" style={{ fontWeight: 500 }}>
                          {cam.name}
                        </div>
                        <div className="text-gray-500 text-xs">
                          {cam.resolution} {cam.fps ? `@ ${cam.fps}fps` : ""}
                        </div>
                      </div>
                    </div>
                    <div
                      className={`w-2 h-2 rounded-full ${
                        activeStream?.id === cam.id && activeStream?.status === "streaming"
                          ? "bg-green-400 animate-pulse"
                          : "bg-gray-600"
                      }`}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-5 rounded-2xl border border-white/5 bg-white/[0.02]">
            <label className="text-gray-400 text-xs mb-3 block" style={{ fontWeight: 500 }}>
              流状态
            </label>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">状态</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs ${
                    isStreaming
                      ? "bg-green-500/10 text-green-400"
                      : "bg-gray-500/10 text-gray-400"
                  }`}
                >
                  {isStreaming ? "推流中" : "待机"}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">帧率</span>
                <span className="text-cyan-400 text-xs" style={{ fontWeight: 600 }}>
                  {streamFps} FPS
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">模型</span>
                <span className="text-gray-300 text-xs">YOLO2026 (yolo26n)</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">检测类别</span>
                <span className="text-gray-300 text-xs">person</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right - Video feed */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative rounded-2xl border border-white/5 bg-[#0d1117] overflow-hidden aspect-video flex items-center justify-center">
            {isStreaming ? (
              <canvas
                ref={canvasRef}
                className="w-full h-full object-contain"
                style={{ imageRendering: "auto" }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-8">
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                  <Eye size={20} className="text-gray-600" />
                </div>
                <p className="text-gray-500 text-sm">选择摄像头并点击「开始推流」</p>
                <p className="text-gray-600 text-xs mt-1">实时画面将显示在此处</p>
              </div>
            )}

            {isStreaming && (
              <div className="absolute top-3 left-3 flex items-center gap-2 px-2 py-1 rounded bg-black/60 text-xs text-white">
                <Activity size={12} className="text-green-400 animate-pulse" />
                LIVE
              </div>
            )}
          </div>

          {/* Detection log */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl border border-white/5 bg-[#0d1117] overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
              <span className="text-gray-400 text-xs" style={{ fontWeight: 500 }}>
                检测日志
              </span>
              <span className="text-gray-600 text-xs">
                {detections.length} 次检测
              </span>
            </div>
            <div className="p-4 max-h-48 overflow-y-auto space-y-2">
              {detections.length === 0 ? (
                <p className="text-gray-600 text-xs">暂无检测事件</p>
              ) : (
                detections.map((d, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-xs"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                    <span className="text-gray-500">
                      {new Date(d.timestamp * 1000).toLocaleTimeString()}
                    </span>
                    <span className="text-green-400" style={{ fontWeight: 500 }}>
                      检测到人员
                    </span>
                    <span className="text-gray-400">置信度 {d.confidence.toFixed(2)}</span>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
