"use client";

import { useEffect } from "react";
import { X, Bell, Globe, Info, GraduationCap } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import ThemePicker from "./ThemePicker";
import { APP_VERSION } from "@/lib/version";

export default function SettingsModal({ isOpen, onClose }) {
  const { theme, setTheme } = useTheme();

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
            {/* Тема оформления */}
            <div className="rounded-2xl bg-[var(--bg-elevated)] px-4 py-3">
              <span className="text-sm text-[var(--text-secondary)] block mb-2">Тема оформления</span>
              <ThemePicker currentTheme={theme} onSelect={setTheme} />
            </div>

            <div className="flex items-center justify-between rounded-2xl bg-[var(--bg-elevated)] px-4 py-3 opacity-60">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-[var(--text-secondary)]" />
                <span className="text-sm text-[var(--text-secondary)]">Уведомления</span>
              </div>
              <span className="rounded-full bg-[var(--bg-main)] px-2 py-0.5 text-xs text-[var(--text-muted)]">Скоро</span>
            </div>

            <div className="flex items-center justify-between rounded-2xl bg-[var(--bg-elevated)] px-4 py-3 opacity-60">
              <div className="flex items-center gap-3">
                <Globe className="h-5 w-5 text-[var(--text-secondary)]" />
                <span className="text-sm text-[var(--text-secondary)]">Язык</span>
              </div>
              <span className="rounded-full bg-[var(--bg-main)] px-2 py-0.5 text-xs text-[var(--text-muted)]">Скоро</span>
            </div>

            <button
              onClick={() => {
                onClose();
                setTimeout(() => window.dispatchEvent(new Event("start-tutorial")), 300);
              }}
              className="flex w-full items-center justify-between rounded-2xl bg-[var(--bg-elevated)] px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <GraduationCap className="h-5 w-5 text-[var(--text-secondary)]" />
                <span className="text-sm text-[var(--text-secondary)]">Пройти обучение</span>
              </div>
              <span className="text-sm text-[var(--text-muted)]">&rarr;</span>
            </button>

            <button
              onClick={() => {
                onClose();
                window.dispatchEvent(new Event("show-update-modal"));
              }}
              className="flex w-full items-center justify-between rounded-2xl bg-[var(--bg-elevated)] px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <Info className="h-5 w-5 text-[var(--text-secondary)]" />
                <span className="text-sm text-[var(--text-secondary)]">Версия</span>
              </div>
              <span className="text-sm text-[var(--text-muted)]">{APP_VERSION}</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
