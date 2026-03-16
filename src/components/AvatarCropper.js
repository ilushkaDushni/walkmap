"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { X, ZoomIn, ZoomOut, Check, RotateCcw } from "lucide-react";

const SIZE = 256;
const MIN_SCALE_FACTOR = 1; // image always fills the circle
const MAX_SCALE_FACTOR = 5;

export default function AvatarCropper({ imageSrc, onCrop, onCancel }) {
  const canvasRef = useRef(null);
  const [img, setImg] = useState(null);
  const [baseScale, setBaseScale] = useState(1); // scale where shortest side = SIZE
  const [zoomFactor, setZoomFactor] = useState(1); // user zoom on top of baseScale
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  // pinch-to-zoom
  const pinchStartDist = useRef(null);
  const pinchStartZoom = useRef(1);

  const scale = baseScale * zoomFactor;

  // Load image
  useEffect(() => {
    const image = new Image();
    image.onload = () => {
      setImg(image);
      const s = Math.max(SIZE / image.width, SIZE / image.height);
      setBaseScale(s);
      setZoomFactor(1);
      setOffset({
        x: (SIZE - image.width * s) / 2,
        y: (SIZE - image.height * s) / 2,
      });
    };
    image.src = imageSrc;
  }, [imageSrc]);

  // Clamp offset so the image always covers the circle
  const clampOffset = useCallback(
    (ox, oy, sc) => {
      if (!img) return { x: ox, y: oy };
      const w = img.width * sc;
      const h = img.height * sc;
      // image left edge must be <= 0, right edge must be >= SIZE
      const minX = SIZE - w;
      const maxX = 0;
      const minY = SIZE - h;
      const maxY = 0;
      return {
        x: Math.min(maxX, Math.max(minX, ox)),
        y: Math.min(maxY, Math.max(minY, oy)),
      };
    },
    [img]
  );

  // Draw
  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !img) return;
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.save();
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
    ctx.clip();
    const clamped = clampOffset(offset.x, offset.y, scale);
    ctx.drawImage(img, clamped.x, clamped.y, img.width * scale, img.height * scale);
    ctx.restore();
  }, [img, scale, offset, clampOffset]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Pointer drag
  const handlePointerDown = (e) => {
    if (e.pointerType === "touch" && pinchStartDist.current !== null) return;
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setOffset((prev) => clampOffset(prev.x + dx, prev.y + dy, scale));
  };

  const handlePointerUp = () => {
    dragging.current = false;
  };

  // Touch: pinch-to-zoom
  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      dragging.current = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStartDist.current = Math.hypot(dx, dy);
      pinchStartZoom.current = zoomFactor;
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && pinchStartDist.current !== null) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / pinchStartDist.current;
      const newZoom = Math.min(MAX_SCALE_FACTOR, Math.max(MIN_SCALE_FACTOR, pinchStartZoom.current * ratio));
      setZoomFactor(newZoom);
      // Re-center after zoom change
      setOffset((prev) => clampOffset(prev.x, prev.y, baseScale * newZoom));
    }
  };

  const handleTouchEnd = (e) => {
    if (e.touches.length < 2) {
      pinchStartDist.current = null;
    }
  };

  // Wheel zoom (centered)
  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    setZoomFactor((z) => {
      const newZ = Math.min(MAX_SCALE_FACTOR, Math.max(MIN_SCALE_FACTOR, z + delta));
      const newScale = baseScale * newZ;
      // Zoom towards center
      const cx = SIZE / 2;
      const cy = SIZE / 2;
      setOffset((prev) => {
        const ratio = newScale / (baseScale * z);
        const nx = cx - (cx - prev.x) * ratio;
        const ny = cy - (cy - prev.y) * ratio;
        return clampOffset(nx, ny, newScale);
      });
      return newZ;
    });
  };

  const zoom = (dir) => {
    setZoomFactor((z) => {
      const newZ = Math.min(MAX_SCALE_FACTOR, Math.max(MIN_SCALE_FACTOR, z + dir * 0.15));
      const newScale = baseScale * newZ;
      setOffset((prev) => {
        const ratio = newScale / (baseScale * z);
        const cx = SIZE / 2;
        const nx = cx - (cx - prev.x) * ratio;
        const ny = cx - (cx - prev.y) * ratio;
        return clampOffset(nx, ny, newScale);
      });
      return newZ;
    });
  };

  const handleReset = () => {
    if (!img) return;
    setZoomFactor(1);
    setOffset({
      x: (SIZE - img.width * baseScale) / 2,
      y: (SIZE - img.height * baseScale) / 2,
    });
  };

  const handleConfirm = () => {
    if (!img) return;
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d");
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
    ctx.clip();
    const clamped = clampOffset(offset.x, offset.y, scale);
    ctx.drawImage(img, clamped.x, clamped.y, img.width * scale, img.height * scale);
    canvas.toBlob(
      (blob) => {
        if (blob) onCrop(blob);
      },
      "image/webp",
      0.85
    );
  };

  const zoomPercent = Math.round(zoomFactor * 100);

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="relative rounded-full overflow-hidden border-2 border-[var(--border-color)]"
        style={{ width: SIZE, height: SIZE, touchAction: "none" }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <canvas
          ref={canvasRef}
          width={SIZE}
          height={SIZE}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onWheel={handleWheel}
          className="cursor-grab active:cursor-grabbing"
        />
      </div>

      {/* Zoom controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => zoom(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <input
          type="range"
          min={100}
          max={MAX_SCALE_FACTOR * 100}
          value={zoomPercent}
          onChange={(e) => {
            const newZ = parseInt(e.target.value) / 100;
            const newScale = baseScale * newZ;
            setOffset((prev) => {
              const ratio = newScale / scale;
              const cx = SIZE / 2;
              const nx = cx - (cx - prev.x) * ratio;
              const ny = cx - (cx - prev.y) * ratio;
              return clampOffset(nx, ny, newScale);
            });
            setZoomFactor(newZ);
          }}
          className="w-28 accent-green-500"
        />
        <button
          onClick={() => zoom(1)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          onClick={handleReset}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
          title="Сбросить"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 w-full">
        <button
          onClick={onCancel}
          className="flex-1 flex items-center justify-center gap-2 rounded-2xl border border-[var(--border-color)] py-2.5 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition"
        >
          <X className="h-4 w-4" />
          Отмена
        </button>
        <button
          onClick={handleConfirm}
          disabled={!img}
          className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-green-500 py-2.5 text-sm font-semibold text-white hover:bg-green-600 transition disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
          Применить
        </button>
      </div>
    </div>
  );
}
