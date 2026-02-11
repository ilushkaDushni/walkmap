"use client";

import { useState, useEffect } from "react";
import { Sparkles } from "lucide-react";
import { APP_VERSION, CHANGELOG } from "@/lib/version";

const LS_KEY = "app-last-seen-version";

export default function UpdateModal() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY);

    if (saved !== APP_VERSION) {
      setShow(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(LS_KEY, APP_VERSION);
    setShow(false);
  }

  if (!show) return null;

  const entry = CHANGELOG[0];

  return (
    <>
      {/* Бэкдроп */}
      <div
        className="fixed inset-0 z-[75] bg-black/40 transition-opacity"
        onClick={dismiss}
      />

      {/* Карточка */}
      <div className="fixed inset-x-4 bottom-24 z-[80] mx-auto max-w-md animate-slide-up">
        <div className="rounded-3xl bg-[var(--bg-surface)] p-6 shadow-2xl transition-colors">
          {/* Заголовок */}
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-green-500/15">
              <Sparkles className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                Что нового
              </h2>
              <span className="inline-block rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-500">
                v{entry.version}
              </span>
            </div>
          </div>

          {/* Подзаголовок */}
          <p className="mb-3 text-sm font-medium text-[var(--text-secondary)]">
            {entry.title}
          </p>

          {/* Список изменений */}
          <ul className="mb-5 space-y-2">
            {entry.changes.map((text, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
                {text}
              </li>
            ))}
          </ul>

          {/* Кнопка */}
          <button
            onClick={dismiss}
            className="w-full rounded-2xl bg-green-500 py-3 text-sm font-semibold text-white transition hover:bg-green-600 active:scale-[0.98]"
          >
            Понятно!
          </button>
        </div>
      </div>
    </>
  );
}
