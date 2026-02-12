"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/components/UserProvider";
import { ArrowLeft, Megaphone, Send, Check } from "lucide-react";

export default function AdminNotificationsPage() {
  const { user, loading, authFetch, hasPermission } = useUser();
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [roles, setRoles] = useState([]);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null); // { ok, sent } | { error }

  useEffect(() => {
    if (!loading && !hasPermission("notifications.broadcast")) {
      router.replace("/");
    }
  }, [user, loading, router, hasPermission]);

  useEffect(() => {
    if (hasPermission("notifications.broadcast")) {
      authFetch("/api/admin/roles").then(async (res) => {
        if (res.ok) setRoles(await res.json());
      });
    }
  }, [user, authFetch, hasPermission]);

  const toggleRole = (id) => {
    setSelectedRoles((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  const handleSend = async () => {
    if (!message.trim()) return;
    if (!confirm(`Отправить рассылку${selectedRoles.length > 0 ? " выбранным ролям" : " всем пользователям"}?`)) return;

    setSending(true);
    setResult(null);
    try {
      const res = await authFetch("/api/admin/notifications/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          roleIds: selectedRoles.length > 0 ? selectedRoles : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ ok: true, sent: data.sent });
        setMessage("");
        setSelectedRoles([]);
      } else {
        setResult({ error: data.error });
      }
    } catch {
      setResult({ error: "Ошибка сети" });
    }
    setSending(false);
  };

  if (loading || !hasPermission("notifications.broadcast")) return null;

  return (
    <div className="mx-auto max-w-lg px-4 pt-4 pb-24">
      {/* Шапка */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => router.back()}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Рассылка</h1>
          <p className="text-sm text-[var(--text-muted)]">Уведомления пользователям</p>
        </div>
      </div>

      {/* Форма */}
      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 space-y-4">
        {/* Текст */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
            Сообщение
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={500}
            rows={4}
            placeholder="Текст уведомления..."
            className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] resize-none"
          />
          <p className="text-xs text-[var(--text-muted)] text-right mt-1">
            {message.length}/500
          </p>
        </div>

        {/* Фильтр по ролям */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
            Получатели
          </label>
          <div className="flex flex-wrap gap-2">
            {roles.map((r) => (
              <button
                key={r._id}
                onClick={() => toggleRole(r._id)}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium border transition ${
                  selectedRoles.includes(r._id)
                    ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400"
                    : "border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-muted)]"
                }`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: r.color }}
                />
                {r.name}
              </button>
            ))}
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {selectedRoles.length === 0
              ? "Все пользователи"
              : `Выбрано ${selectedRoles.length} ${selectedRoles.length === 1 ? "роль" : "ролей"}`}
          </p>
        </div>

        {/* Кнопка */}
        <button
          onClick={handleSend}
          disabled={!message.trim() || sending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {sending ? (
            "Отправка..."
          ) : (
            <>
              <Send className="h-4 w-4" />
              Отправить рассылку
            </>
          )}
        </button>

        {/* Результат */}
        {result?.ok && (
          <div className="flex items-center gap-2 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-3">
            <Check className="h-4 w-4 text-green-600" />
            <p className="text-sm text-green-700 dark:text-green-400">
              Отправлено {result.sent} уведомлений
            </p>
          </div>
        )}
        {result?.error && (
          <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3">
            <p className="text-sm text-red-700 dark:text-red-400">{result.error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
