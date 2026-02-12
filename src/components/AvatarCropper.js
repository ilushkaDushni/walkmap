"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { X, ZoomIn, ZoomOut, Check } from "lucide-react";

const SIZE = 256;

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
      // Fit image so shortest side fills the canvas
      const s = Math.max(SIZE / image.width, SIZE / image.height);
      setScale(s);
      setOffset({
        x: (SIZE - image.width * s) / 2,
        y: (SIZE - image.height * s) / 2,
      });
    };
    image.src = imageSrc;
  }, [imageSrc]);

  // Draw
  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !img) return;
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.save();
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, offset.x, offset.y, img.width * scale, img.height * scale);
    ctx.restore();
  }, [img, scale, offset]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Mouse drag
  const handlePointerDown = (e) => {
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
  };

  const handlePointerUp = () => {
    dragging.current = false;
  };

  // Wheel zoom
  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    setScale((s) => Math.max(0.1, Math.min(5, s + delta)));
  };

  const zoom = (dir) => {
    setScale((s) => Math.max(0.1, Math.min(5, s + dir * 0.1)));
  };

  const handleConfirm = () => {
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d");
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, offset.x, offset.y, img.width * scale, img.height * scale);
    canvas.toBlob(
      (blob) => {
        if (blob) onCrop(blob);
      },
      "image/webp",
      0.85
    );
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="relative rounded-full overflow-hidden border-2 border-[var(--border-color)]"
        style={{ width: SIZE, height: SIZE, touchAction: "none" }}
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

      <div className="flex items-center gap-2">
        <button
          onClick={() => zoom(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <input
          type="range"
          min={10}
          max={500}
          value={Math.round(scale * 100)}
          onChange={(e) => setScale(parseInt(e.target.value) / 100)}
          className="w-32 accent-green-500"
        />
        <button
          onClick={() => zoom(1)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
      </div>

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
