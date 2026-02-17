"use client";

import { useState } from "react";
import { X, Palette, Type, BellOff, Bell, Trash2, User } from "lucide-react";
import { useUser } from "./UserProvider";
import { isChatMuted, setChatMuted, getChatFontSize, setChatFontSize } from "@/lib/chatSettings";
import ChatThemePicker from "./ChatThemePicker";
import Link from "next/link";

const FONT_OPTIONS = [
  { key: "sm", label: "Маленький" },
  { key: "base", label: "Обычный" },
  { key: "lg", label: "Большой" },
];

export default function ChatSettingsModal({ conversationKey, friend, currentTheme, onThemeChange, onFontSizeChange, onClearHistory, onClose }) {
  const { authFetch } = useUser();
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [muted, setMutedState] = useState(() => isChatMuted(conversationKey));
  const [fontSize, setFontSizeState] = useState(() => getChatFontSize(conversationKey));
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  const toggleMute = () => {
    const next = !muted;
    setMutedState(next);
    setChatMuted(conversationKey, next);
  };

  const handleFontSize = (size) => {
    setFontSizeState(size);
    setChatFontSize(conversationKey, size);
    onFontSizeChange(size);
  };

  const handleClear = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    setClearing(true);
    try {
      const res = await authFetch(`/api/messages/${conversationKey}/clear`, { method: "DELETE" });
      if (res.ok) {
        onClearHistory();
        onClose();
      }
    } catch { /* ignore */ }
    finally { setClearing(false); }
  };

  if (showThemePicker) {
    return (
      <ChatThemePicker
        currentThemeId={currentTheme.id}
        onSelect={(id) => {
          onThemeChange(id);
          setShowThemePicker(false);
        }}
        onClose={() => setShowThemePicker(false)}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-t-2xl sm:rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-2xl overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Настройки чата</h3>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="py-2">
          {/* Тема чата */}
          <button
            onClick={() => setShowThemePicker(true)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[var(--bg-elevated)] transition"
          >
            <Palette className="h-5 w-5 text-[var(--text-muted)]" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[var(--text-primary)]">Тема чата</p>
              <p className="text-xs text-[var(--text-muted)]">{currentTheme.name}</p>
            </div>
            <div className="h-5 w-5 rounded-full shrink-0" style={{ backgroundColor: currentTheme.bubble }} />
          </button>

          {/* Размер шрифта */}
          <div className="px-4 py-3">
            <div className="flex items-center gap-3 mb-2">
              <Type className="h-5 w-5 text-[var(--text-muted)]" />
              <p className="text-sm text-[var(--text-primary)]">Размер шрифта</p>
            </div>
            <div className="flex gap-1 ml-8 rounded-xl bg-[var(--bg-elevated)] p-1">
              {FONT_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => handleFontSize(opt.key)}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition ${
                    fontSize === opt.key
                      ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm"
                      : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Без звука */}
          <button
            onClick={toggleMute}
            className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[var(--bg-elevated)] transition"
          >
            {muted ? (
              <BellOff className="h-5 w-5 text-[var(--text-muted)]" />
            ) : (
              <Bell className="h-5 w-5 text-[var(--text-muted)]" />
            )}
            <div className="flex-1">
              <p className="text-sm text-[var(--text-primary)]">Без звука</p>
              <p className="text-xs text-[var(--text-muted)]">{muted ? "Уведомления отключены" : "Уведомления включены"}</p>
            </div>
            <div className={`h-5 w-9 rounded-full transition-colors ${muted ? "bg-green-500" : "bg-[var(--border-color)]"} relative`}>
              <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${muted ? "translate-x-4" : "translate-x-0.5"}`} />
            </div>
          </button>

          {/* Профиль */}
          {friend?.username && (
            <Link
              href={`/users/${friend.username}`}
              onClick={onClose}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[var(--bg-elevated)] transition no-underline"
            >
              <User className="h-5 w-5 text-[var(--text-muted)]" />
              <p className="text-sm text-[var(--text-primary)]">Профиль {friend.username}</p>
            </Link>
          )}

          {/* Очистить историю */}
          <button
            onClick={handleClear}
            disabled={clearing}
            className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[var(--bg-elevated)] transition"
          >
            <Trash2 className="h-5 w-5 text-red-500" />
            <p className="text-sm text-red-500">
              {clearing ? "Очистка..." : confirmClear ? "Нажмите ещё раз для подтверждения" : "Очистить историю"}
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}
