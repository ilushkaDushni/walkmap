"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/components/UserProvider";
import { ArrowLeft, Users2, X, Clock } from "lucide-react";

export default function AdminLobbiesPage() {
  const { user, loading, authFetch, hasPermission } = useUser();
  const router = useRouter();
  const [lobbies, setLobbies] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !hasPermission("admin.access")) {
      router.replace("/");
    }
  }, [user, loading, router, hasPermission]);

  const fetchLobbies = useCallback(async () => {
    const res = await authFetch("/api/admin/lobbies");
    if (res.ok) setLobbies(await res.json());
    setLoadingData(false);
  }, [authFetch]);

  useEffect(() => {
    if (hasPermission("admin.access")) fetchLobbies();
  }, [user, fetchLobbies, hasPermission]);

  const handleClose = async (id) => {
    if (!confirm("Закрыть лобби? Участники будут отключены.")) return;
    const res = await authFetch(`/api/admin/lobbies/${id}`, { method: "DELETE" });
    if (res.ok) {
      setLobbies((prev) => prev.filter((l) => l._id !== id));
    }
  };

  if (loading || !hasPermission("admin.access")) return null;

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
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Лобби</h1>
          <p className="text-sm text-[var(--text-muted)]">Активные ({lobbies.length})</p>
        </div>
        <button
          onClick={fetchLobbies}
          className="ml-auto text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
        >
          Обновить
        </button>
      </div>

      {/* Список */}
      {loadingData ? (
        <p className="text-sm text-[var(--text-muted)] py-8 text-center">Загрузка...</p>
      ) : lobbies.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-[var(--text-muted)]">
          <Users2 className="h-10 w-10 mb-2 opacity-30" />
          <p className="text-sm">Нет активных лобби</p>
        </div>
      ) : (
        <div className="space-y-2">
          {lobbies.map((lobby) => {
            const timeLeft = lobby.expiresAt
              ? Math.max(0, Math.floor((new Date(lobby.expiresAt) - Date.now()) / 60000))
              : null;

            return (
              <div
                key={lobby._id}
                className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/20">
                    <Users2 className="h-5 w-5 text-cyan-500" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                      {lobby.route?.title || "Маршрут удалён"}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mt-0.5">
                      <span>Хост: {lobby.host?.username || "—"}</span>
                      <span>Код: <span className="font-mono font-bold">{lobby.joinCode}</span></span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mt-0.5">
                      <span>{(lobby.participants || []).length} участников</span>
                      {timeLeft !== null && (
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-3 w-3" />
                          {timeLeft > 0 ? `${timeLeft} мин` : "Истекает"}
                        </span>
                      )}
                    </div>
                    {/* Список участников */}
                    {(lobby.participants || []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {lobby.participants.map((p) => (
                          <span
                            key={p.userId}
                            className="text-[10px] rounded px-1.5 py-0.5 bg-[var(--bg-elevated)] text-[var(--text-muted)]"
                          >
                            {p.username}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Закрыть */}
                  <button
                    onClick={() => handleClose(lobby._id)}
                    className="shrink-0 rounded-lg p-1.5 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                    title="Закрыть лобби"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
