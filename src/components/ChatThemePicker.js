"use client";

import { Check, X } from "lucide-react";
import { CHAT_THEMES } from "@/lib/chatThemes";

export default function ChatThemePicker({ currentThemeId, onSelect, onClose }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-t-2xl sm:rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-2xl overflow-hidden animate-slide-up">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Тема чата</h3>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 p-4">
          {CHAT_THEMES.map((theme) => {
            const active = theme.id === currentThemeId;
            return (
              <button
                key={theme.id}
                onClick={() => onSelect(theme.id)}
                className={`flex flex-col items-center gap-1.5 rounded-xl p-2 transition ${active ? "bg-[var(--bg-elevated)]" : "hover:bg-[var(--bg-elevated)]/50"}`}
              >
                {/* Превью: фон + бабл */}
                <div
                  className={`relative w-full h-12 rounded-lg overflow-hidden border ${active ? "ring-2 ring-offset-1 ring-offset-[var(--bg-surface)]" : "border-[var(--border-color)]"}`}
                  style={{
                    background: theme.bg || "var(--bg-surface)",
                    backgroundSize: theme.bgSize || "auto",
                    ringColor: theme.accent,
                    borderColor: active ? theme.accent : undefined,
                  }}
                >
                  {/* Мини-бабл */}
                  <div
                    className="absolute bottom-1.5 right-2 rounded-lg rounded-br-sm px-2 py-0.5 text-[8px] font-medium"
                    style={{ backgroundColor: theme.bubble, color: theme.bubbleText }}
                  >
                    Привет
                  </div>
                  <div
                    className="absolute top-1.5 left-2 rounded-lg rounded-bl-sm px-2 py-0.5 text-[8px] bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                    style={theme.dark ? { backgroundColor: "rgba(255,255,255,0.12)", color: "#e2e8f0" } : undefined}
                  >
                    Хай
                  </div>
                  {active && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="h-5 w-5 rounded-full flex items-center justify-center" style={{ backgroundColor: theme.accent }}>
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-[var(--text-muted)] leading-tight text-center">{theme.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
