"use client";

import { Pin, X } from "lucide-react";

export default function PinnedMessageBanner({ message, onJump, onUnpin, canUnpin }) {
  if (!message) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-elevated)]/80 border-b border-[var(--border-color)] cursor-pointer"
      onClick={() => onJump?.(message.id)}
    >
      <Pin className="h-3.5 w-3.5 text-[var(--accent-color)] shrink-0 rotate-45" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-[var(--accent-color)]">Закреплено</p>
        <p className="text-xs text-[var(--text-secondary)] truncate">{message.text || "Медиа"}</p>
      </div>
      {canUnpin && (
        <button
          onClick={(e) => { e.stopPropagation(); onUnpin?.(); }}
          className="p-1 rounded hover:bg-[var(--bg-surface)] transition shrink-0"
        >
          <X className="h-3.5 w-3.5 text-[var(--text-muted)]" />
        </button>
      )}
    </div>
  );
}
