"use client";

import { useEffect } from "react";
import { X, Shield, Route, Users, BarChart3 } from "lucide-react";

export default function AdminModal({ isOpen, onClose }) {
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

  const sections = [
    {
      icon: Route,
      title: "Управление маршрутами",
      description: "Добавление, редактирование и удаление маршрутов",
    },
    {
      icon: Users,
      title: "Пользователи",
      description: "Управление пользователями и ролями",
    },
    {
      icon: BarChart3,
      title: "Статистика",
      description: "Просмотр активности и аналитики",
    },
  ];

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

          {/* Заголовок */}
          <div className="flex flex-col items-center mb-4">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20">
              <Shield className="h-8 w-8 text-amber-500" />
            </div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Админ-панель</h2>
          </div>

          {/* Секции */}
          <div className="space-y-2">
            {sections.map(({ icon: Icon, title, description }) => (
              <button
                key={title}
                className="flex w-full items-center gap-3 rounded-2xl bg-[var(--bg-elevated)] p-4 text-left transition hover:opacity-80"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-surface)]">
                  <Icon className="h-5 w-5 text-[var(--text-secondary)]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{title}</p>
                  <p className="text-xs text-[var(--text-muted)]">{description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
