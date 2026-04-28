import { useRef, useEffect, useState } from "react";

interface Detection {
  class?: string;
  label?: string;
  phrase?: string;
  confidence?: number;
  score?: number;
  logit?: number;
  bbox?: number[];
  box?: number[] | { xmin: number; ymin: number; xmax: number; ymax: number };
}

interface DetectionOverlayProps {
  imageSrc: string;
  detections: Detection[];
  maxWidth?: number;
}

const COLORS = [
  "#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
];

export function DetectionOverlay({ imageSrc, detections, maxWidth = 640 }: DetectionOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const scale = Math.min(maxWidth / img.naturalWidth, 1);
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);

      detections.forEach((det, i) => {
        let x1 = 0, y1 = 0, x2 = 0, y2 = 0;

        if (det.bbox && det.bbox.length >= 4) {
          [x1, y1, x2, y2] = det.bbox;
        } else if (det.box && Array.isArray(det.box) && det.box.length >= 4) {
          [x1, y1, x2, y2] = det.box;
        } else if (det.box && typeof det.box === "object" && "xmin" in det.box) {
          const b = det.box as { xmin: number; ymin: number; xmax: number; ymax: number };
          x1 = b.xmin; y1 = b.ymin; x2 = b.xmax; y2 = b.ymax;
        } else {
          return;
        }

        // Detect normalized coordinates (all values <= 1.0)
        const isNormalized = x1 <= 1 && y1 <= 1 && x2 <= 1 && y2 <= 1;
        if (isNormalized) {
          x1 *= img.naturalWidth;
          y1 *= img.naturalHeight;
          x2 *= img.naturalWidth;
          y2 *= img.naturalHeight;
        }

        // Scale to canvas size
        x1 *= scale; y1 *= scale; x2 *= scale; y2 *= scale;
        const bw = x2 - x1;
        const bh = y2 - y1;

        const color = COLORS[i % COLORS.length];
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(x1, y1, bw, bh);

        const label = det.class || det.label || det.phrase || `Obj ${i + 1}`;
        const score = det.confidence ?? det.score ?? det.logit ?? 0;
        const labelText = `${label} ${(score * 100).toFixed(0)}%`;

        ctx.font = "bold 12px sans-serif";
        const metrics = ctx.measureText(labelText);
        const pad = 4;
        const lh = 16;
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.9;
        ctx.fillRect(x1, y1 - lh - pad * 2, metrics.width + pad * 2, lh + pad * 2);
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#fff";
        ctx.fillText(labelText, x1 + pad, y1 - pad - 2);
      });
    };
    img.onerror = () => {
      setError("图片加载失败，无法绘制检测框");
      // Draw a small error placeholder on canvas
      canvas.width = maxWidth;
      canvas.height = 120;
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#ef4444";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("图片加载失败", canvas.width / 2, canvas.height / 2);
    };
    img.src = imageSrc;
  }, [imageSrc, detections, maxWidth]);

  if (error) {
    return (
      <div className="rounded-xl overflow-hidden border border-red-500/30 bg-red-950/10 px-4 py-3 text-red-400 text-xs">
        {error}
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden border border-white/10 bg-black">
      <canvas ref={canvasRef} className="block max-w-full h-auto" />
    </div>
  );
}
