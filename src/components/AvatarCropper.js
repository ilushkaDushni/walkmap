"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { ZoomIn, ZoomOut, Check, X } from "lucide-react";

const CANVAS_SIZE = 256;
const OUTPUT_SIZE = 256;

export default function AvatarCropper({ imageSrc, onCrop, onCancel }) {
  const canvasRef = useRef(null);
  const [img, setImg] = useState(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  // Load image
  useEffect(() => {
    const image = new Image();
    image.onload = () => {
      setImg(image);
      // Fit image: scale so shortest side fills canvas
      const minDim = Math.min(image.width, image.height);
      const fitScale = CANVAS_SIZE / minDim;
      setScale(fitScale);
      setOffset({
        x: (CANVAS_SIZE - image.width * fitScale) / 2,
        y: (CANVAS_SIZE - image.height * fitScale) / 2,
      });
    };
    image.src = imageSrc;
  }, [imageSrc]);

  // Draw
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Draw image
    ctx.save();
    ctx.beginPath();
    ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, offset.x, offset.y, img.width * scale, img.height * scale);
    ctx.restore();

    // Overlay outside circle
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Circle border
    ctx.beginPath();
    ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 1, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [img, scale, offset]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Mouse / touch handlers
  const getEventPos = (e) => {
    if (e.touches) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  };

  const handleStart = (e) => {
    e.preventDefault();
    dragging.current = true;
    lastPos.current = getEventPos(e);
  };

  const handleMove = (e) => {
    if (!dragging.current) return;
    e.preventDefault();
    const pos = getEventPos(e);
    const dx = pos.x - lastPos.current.x;
    const dy = pos.y - lastPos.current.y;
    lastPos.current = pos;
    setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
  };

  const handleEnd = () => {
    dragging.current = false;
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    adjustScale(delta);
  };

  const adjustScale = (delta) => {
    setScale((prev) => {
      const next = Math.max(0.1, Math.min(5, prev + delta));
      if (!img) return next;
      // Zoom towards center
      const cx = CANVAS_SIZE / 2;
      const cy = CANVAS_SIZE / 2;
      setOffset((off) => ({
        x: cx - ((cx - off.x) / prev) * next,
        y: cy - ((cy - off.y) / prev) * next,
      }));
      return next;
    });
  };

  const handleCrop = () => {
    if (!img) return;
    const out = document.createElement("canvas");
    out.width = OUTPUT_SIZE;
    out.height = OUTPUT_SIZE;
    const ctx = out.getContext("2d");

    // Draw full image at current transform, clipped to circle
    ctx.beginPath();
    ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, offset.x, offset.y, img.width * scale, img.height * scale);

    out.toBlob((blob) => {
      if (blob) onCrop(blob);
    }, "image/webp", 0.9);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        className="rounded-full cursor-grab active:cursor-grabbing touch-none"
        style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
        onWheel={handleWheel}
      />

      {/* Zoom controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => adjustScale(-0.1)}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <input
          type="range"
          min="0.1"
          max="5"
          step="0.01"
          value={scale}
          onChange={(e) => {
            const next = parseFloat(e.target.value);
            if (!img) { setScale(next); return; }
            const cx = CANVAS_SIZE / 2;
            const cy = CANVAS_SIZE / 2;
            setOffset((off) => ({
              x: cx - ((cx - off.x) / scale) * next,
              y: cy - ((cy - off.y) / scale) * next,
            }));
            setScale(next);
          }}
          className="w-28 accent-green-500"
        />
        <button
          onClick={() => adjustScale(0.1)}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
      </div>

      {/* Actions */}
      <div className="flex gap-2 w-full">
        <button
          onClick={onCancel}
          className="flex-1 flex items-center justify-center gap-2 rounded-2xl border border-[var(--border-color)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--bg-elevated)]"
        >
          <X className="h-4 w-4" />
          Отмена
        </button>
        <button
          onClick={handleCrop}
          className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700"
        >
          <Check className="h-4 w-4" />
          Применить
        </button>
      </div>
    </div>
  );
}
