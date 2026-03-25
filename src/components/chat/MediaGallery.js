"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, ChevronLeft, ChevronRight, Download } from "lucide-react";

/**
 * Telegram-style media gallery viewer.
 * Props:
 *   messages     — all chat messages (array)
 *   initialMsgId — id of the clicked image message
 *   onClose      — callback to close
 *   getSenderName — (msg) => string
 */
export default function MediaGallery({ messages, initialMsgId, onClose, getSenderName }) {
  const mediaMessages = messages.filter((m) => m.type === "image" && m.imageUrl);
  const initialIndex = mediaMessages.findIndex((m) => m.id === initialMsgId);
  const [index, setIndex] = useState(initialIndex >= 0 ? initialIndex : 0);
  const [zoomed, setZoomed] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const movedRef = useRef(false);
  const containerRef = useRef(null);

  const current = mediaMessages[index];
  if (!current) return null;

  const total = mediaMessages.length;
  const sender = getSenderName?.(current) || "";
  const date = current.createdAt
    ? new Date(current.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "";

  const goPrev = useCallback(() => {
    if (index > 0) { setIndex(index - 1); setZoomed(false); }
  }, [index]);

  const goNext = useCallback(() => {
    if (index < total - 1) { setIndex(index + 1); setZoomed(false); }
  }, [index, total]);

  // keyboard
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, goPrev, goNext]);

  // lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // swipe handlers
  const handlePointerDown = (e) => {
    if (zoomed) return;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    movedRef.current = false;
    setDragging(true);
  };

  const handlePointerMove = (e) => {
    if (!dragging || zoomed) return;
    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) movedRef.current = true;
    setDragX(dx);
  };

  const handlePointerUp = () => {
    if (!dragging) return;
    setDragging(false);
    if (Math.abs(dragX) > 80) {
      if (dragX < 0 && index < total - 1) goNext();
      else if (dragX > 0 && index > 0) goPrev();
    }
    setDragX(0);
  };

  const handleBgClick = () => {
    if (!movedRef.current) onClose();
  };

  const handleDownload = async () => {
    try {
      const res = await fetch(current.imageUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `photo_${index + 1}.webp`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black/95 select-none">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white truncate">{sender}</p>
          <p className="text-xs text-white/50">{date}</p>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-white/40 mr-2">{index + 1} / {total}</span>
          <button
            onClick={handleDownload}
            className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-white/10 transition text-white/70 hover:text-white"
          >
            <Download className="h-5 w-5" />
          </button>
          <button
            onClick={onClose}
            className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-white/10 transition text-white/70 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Image area */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onClick={handleBgClick}
      >
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            transform: `translateX(${dragX}px)`,
            transition: dragging ? "none" : "transform 0.25s ease-out",
          }}
        >
          <img
            key={current.id}
            src={current.imageUrl}
            alt=""
            className={`max-w-[92vw] max-h-[80vh] object-contain rounded-lg transition-transform duration-200 ${zoomed ? "scale-150 cursor-zoom-out" : "cursor-zoom-in"}`}
            draggable={false}
            onClick={(e) => {
              e.stopPropagation();
              if (!movedRef.current) setZoomed((z) => !z);
            }}
          />
        </div>

        {/* Nav arrows (desktop) */}
        {index > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 items-center justify-center rounded-full bg-black/40 hover:bg-black/60 text-white/80 hover:text-white transition"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        {index < total - 1 && (
          <button
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 items-center justify-center rounded-full bg-black/40 hover:bg-black/60 text-white/80 hover:text-white transition"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>

      {/* Bottom thumbnails strip */}
      {total > 1 && (
        <div className="shrink-0 px-4 py-3 overflow-x-auto scrollbar-hide">
          <div className="flex gap-1.5 justify-center">
            {mediaMessages.map((m, i) => (
              <button
                key={m.id}
                onClick={() => { setIndex(i); setZoomed(false); }}
                className={`shrink-0 rounded-lg overflow-hidden transition-all duration-200 ${i === index ? "ring-2 ring-white scale-105" : "opacity-40 hover:opacity-70"}`}
                style={{ width: 48, height: 48 }}
              >
                <img src={m.imageUrl} alt="" className="w-full h-full object-cover" draggable={false} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
