"use client";

import { useState } from "react";
import { X, ChevronDown } from "lucide-react";
import AudioPlayer from "@/components/AudioPlayer";

export default function SegmentReadingCard({ segment, onClose }) {
  const [expanded, setExpanded] = useState(false);

  if (!segment) return null;

  return (
    <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
      {/* Шапка */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">
          {segment.title || `Сегмент #${segment.order + 1}`}
        </h3>
        {expanded && (
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition shrink-0">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Текст */}
      {segment.text && (
        <div className="mt-2">
          {expanded ? (
            <div className="max-h-[60vh] overflow-y-auto text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
              {segment.text}
            </div>
          ) : (
            <p className="text-sm text-[var(--text-secondary)] line-clamp-3 leading-relaxed">
              {segment.text}
            </p>
          )}
        </div>
      )}

      {/* Аудио */}
      {segment.audio?.length > 0 && (
        <div className="mt-3">
          <AudioPlayer urls={segment.audio} variant="compact" />
        </div>
      )}

      {/* Кнопки */}
      <div className="mt-3 flex items-center gap-2">
        {!expanded && segment.text && segment.text.length > 150 && (
          <button
            onClick={() => setExpanded(true)}
            className="flex items-center gap-1 rounded-xl border border-[var(--border-color)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition hover:bg-[var(--bg-elevated)] ml-auto"
          >
            Читать далее
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        )}

        {expanded && (
          <button
            onClick={() => setExpanded(false)}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition ml-auto"
          >
            Свернуть
          </button>
        )}
      </div>
    </div>
  );
}
