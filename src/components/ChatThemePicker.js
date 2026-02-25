"use client";

import { useState, useEffect } from "react";
import { Check, X, Lock } from "lucide-react";
import { getAllChatThemes, CHAT_THEMES } from "@/lib/chatThemes";
import { useUser } from "./UserProvider";

export default function ChatThemePicker({ currentThemeId, onSelect, onClose }) {
  const { authFetch } = useUser();
  const [ownedThemeIds, setOwnedThemeIds] = useState(new Set());
  const allThemes = getAllChatThemes();

  // Загрузка купленных тем чата
  useEffect(() => {
    if (!authFetch) return;
    authFetch("/api/shop/inventory")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!data) return;
        const ids = new Set(
          (data.items || [])
            .filter((i) => i.category === "chatTheme" && i.cssData?.id)
            .map((i) => i.cssData.id)
        );
        setOwnedThemeIds(ids);
      })
      .catch(() => {});
  }, [authFetch]);

  // Встроенные id — бесплатные
  const builtinIds = new Set(CHAT_THEMES.map((t) => t.id));

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

        <div className="grid grid-cols-3 gap-3 p-4 max-h-[60vh] overflow-y-auto">
          {allThemes.map((theme) => {
            const active = theme.id === currentThemeId;
            const isBuiltin = builtinIds.has(theme.id);
            const isOwned = ownedThemeIds.has(theme.id);
            const canUse = isBuiltin || isOwned;

            return (
              <button
                key={theme.id}
                onClick={() => canUse && onSelect(theme.id)}
                className={`flex flex-col items-center gap-1.5 rounded-xl p-2 transition ${
                  !canUse ? "opacity-50" :
                  active ? "bg-[var(--bg-elevated)]" : "hover:bg-[var(--bg-elevated)]/50"
                }`}
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
                  {!canUse && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <Lock className="h-4 w-4 text-white/80" />
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
