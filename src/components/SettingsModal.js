"use client";

import { useEffect } from "react";
import { X, Moon, Sun, Bell, Globe, Info } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { APP_VERSION } from "@/lib/version";

export default function SettingsModal({ isOpen, onClose }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop с размытием */}
      <div
        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Модальное окно */}
      <div className="fixed inset-x-4 bottom-24 z-[70] mx-auto max-w-md animate-slide-up">
        <div className="rounded-3xl bg-[var(--bg-surface)] p-6 shadow-2xl transition-colors">
          {/* Закрыть */}
          <button
            onClick={onClose}
            className="absolute right-6 top-6 text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
          >
            <X className="h-5 w-5" />
          </button>

          <h2 className="mb-4 text-lg font-bold text-[var(--text-primary)]">Настройки</h2>

          <div className="space-y-3">
            {/* Переключатель темы */}
            <div className="flex items-center justify-between rounded-2xl bg-[var(--bg-elevated)] px-4 py-3">
              <div className="flex items-center gap-3">
                {isDark ? (
                  <Moon className="h-5 w-5 text-[var(--text-secondary)]" />
                ) : (
                  <Sun className="h-5 w-5 text-[var(--text-secondary)]" />
                )}
                <span className="text-sm text-[var(--text-secondary)]">Тёмная тема</span>
              </div>
              <button onClick={toggleTheme} className="relative">
                <div className={`h-6 w-10 rounded-full p-0.5 transition-colors ${isDark ? "bg-green-500" : "bg-[var(--bg-main)]"}`}>
                  <div className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${isDark ? "translate-x-4" : "translate-x-0"}`} />
                </div>
              </button>
            </div>

            <div className="flex items-center justify-between rounded-2xl bg-[var(--bg-elevated)] px-4 py-3">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-[var(--text-secondary)]" />
                <span className="text-sm text-[var(--text-secondary)]">Уведомления</span>
              </div>
              <div className="h-6 w-10 rounded-full bg-[var(--bg-main)] p-0.5">
                <div className="h-5 w-5 rounded-full bg-[var(--text-muted)] transition" />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-2xl bg-[var(--bg-elevated)] px-4 py-3">
              <div className="flex items-center gap-3">
                <Globe className="h-5 w-5 text-[var(--text-secondary)]" />
                <span className="text-sm text-[var(--text-secondary)]">Язык</span>
              </div>
              <span className="text-sm font-medium text-[var(--text-primary)]">Русский</span>
            </div>

            <div className="flex items-center justify-between rounded-2xl bg-[var(--bg-elevated)] px-4 py-3">
              <div className="flex items-center gap-3">
                <Info className="h-5 w-5 text-[var(--text-secondary)]" />
                <span className="text-sm text-[var(--text-secondary)]">Версия</span>
              </div>
              <span className="text-sm text-[var(--text-muted)]">{APP_VERSION}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
