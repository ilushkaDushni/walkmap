"use client";

import { useEffect, useState } from "react";
import { X, Shield, Route, Users, BarChart3, Crown, Database, MessageCircle, Megaphone, Coins, Users2 } from "lucide-react";
import { useUser } from "./UserProvider";
import { useNavigationGuard } from "./NavigationGuardProvider";

export default function AdminModal({ isOpen, onClose }) {
  const { user, hasPermission, hasAnyPermission, authFetch } = useUser();
  const { navigate } = useNavigationGuard();
  const [migrateStatus, setMigrateStatus] = useState(null); // null | "loading" | "done" | "error"
  const [migrateLog, setMigrateLog] = useState([]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      setMigrateStatus(null);
      setMigrateLog([]);
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleMigrate = async () => {
    if (!confirm("Запустить миграцию? Будут созданы роли и обновлены пользователи.")) return;
    setMigrateStatus("loading");
    try {
      const res = await authFetch("/api/admin/migrate", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setMigrateStatus("done");
        setMigrateLog(data.log || []);
      } else {
        setMigrateStatus("error");
        setMigrateLog([data.error || "Ошибка"]);
      }
    } catch {
      setMigrateStatus("error");
      setMigrateLog(["Ошибка сети"]);
    }
  };

  if (!isOpen) return null;

  const sections = [
    {
      icon: Route,
      title: "Управление маршрутами",
      description: "Добавление, редактирование и удаление маршрутов",
      action: () => { navigate("/admin/routes"); onClose(); },
      visible: hasAnyPermission("routes.create", "routes.edit", "routes.delete"),
    },
    {
      icon: Users,
      title: "Пользователи",
      description: "Управление пользователями и ролями",
      action: () => { navigate("/admin/users"); onClose(); },
      visible: hasPermission("users.view"),
    },
    {
      icon: Crown,
      title: "Роли",
      description: "Управление ролями и правами",
      action: () => { navigate("/admin/roles"); onClose(); },
      visible: hasPermission("roles.manage"),
    },
    {
      icon: BarChart3,
      title: "Статистика",
      description: "Просмотр активности и аналитики",
      action: () => { navigate("/admin/stats"); onClose(); },
      visible: hasPermission("admin.access"),
    },
    {
      icon: MessageCircle,
      title: "Комментарии",
      description: "Модерация комментариев",
      action: () => { navigate("/admin/comments"); onClose(); },
      visible: hasPermission("comments.manage"),
    },
    {
      icon: Megaphone,
      title: "Рассылка",
      description: "Уведомления пользователям",
      action: () => { navigate("/admin/notifications"); onClose(); },
      visible: hasPermission("notifications.broadcast"),
    },
    {
      icon: Coins,
      title: "Транзакции",
      description: "Лог операций с монетами",
      action: () => { navigate("/admin/transactions"); onClose(); },
      visible: hasPermission("users.manage_coins"),
    },
    {
      icon: Users2,
      title: "Лобби",
      description: "Мониторинг активных лобби",
      action: () => { navigate("/admin/lobbies"); onClose(); },
      visible: hasPermission("admin.access"),
    },
  ].filter((s) => s.visible);

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
            {sections.map(({ icon: Icon, title, description, action }) => (
              <button
                key={title}
                onClick={action || undefined}
                disabled={!action}
                className="flex w-full items-center gap-3 rounded-2xl bg-[var(--bg-elevated)] p-4 text-left transition hover:opacity-80 disabled:opacity-50"
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

            {/* Миграция — только для суперадмина */}
            {user?.isSuperadmin && (
              <div className="pt-2 border-t border-[var(--border-color)]">
                <button
                  onClick={handleMigrate}
                  disabled={migrateStatus === "loading" || migrateStatus === "done"}
                  className="flex w-full items-center gap-3 rounded-2xl bg-[var(--bg-elevated)] p-4 text-left transition hover:opacity-80 disabled:opacity-50"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/20">
                    <Database className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      {migrateStatus === "loading" ? "Миграция..." : migrateStatus === "done" ? "Миграция завершена" : "Запустить миграцию"}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">Создание ролей и обновление пользователей</p>
                  </div>
                </button>
                {migrateLog.length > 0 && (
                  <div className="mt-2 rounded-xl bg-[var(--bg-elevated)] p-3 text-xs text-[var(--text-muted)] space-y-0.5">
                    {migrateLog.map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
