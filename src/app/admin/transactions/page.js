"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/components/UserProvider";
import { ArrowLeft, Coins, ChevronDown } from "lucide-react";

const TYPE_LABELS = {
  route_completion: { label: "Маршрут", color: "text-green-600 bg-green-50 dark:bg-green-950/30" },
  achievement: { label: "Достижение", color: "text-purple-600 bg-purple-50 dark:bg-purple-950/30" },
  gift_sent: { label: "Подарок →", color: "text-orange-600 bg-orange-50 dark:bg-orange-950/30" },
  gift_received: { label: "Подарок ←", color: "text-blue-600 bg-blue-50 dark:bg-blue-950/30" },
  admin_add: { label: "Админ +", color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30" },
  admin_subtract: { label: "Админ −", color: "text-red-600 bg-red-50 dark:bg-red-950/30" },
  lobby_completion: { label: "Лобби", color: "text-cyan-600 bg-cyan-50 dark:bg-cyan-950/30" },
};

const ALL_TYPES = Object.keys(TYPE_LABELS);

export default function AdminTransactionsPage() {
  const { user, loading, authFetch, hasPermission } = useUser();
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [typeFilter, setTypeFilter] = useState("");
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !hasPermission("users.manage_coins")) {
      router.replace("/");
    }
  }, [user, loading, router, hasPermission]);

  const fetchTransactions = useCallback(async (reset = false) => {
    const currentSkip = reset ? 0 : skip;
    const params = new URLSearchParams({ skip: currentSkip.toString() });
    if (typeFilter) params.set("type", typeFilter);

    const res = await authFetch(`/api/admin/transactions?${params}`);
    if (res.ok) {
      const data = await res.json();
      if (reset) {
        setItems(data.items);
        setSkip(data.items.length);
      } else {
        setItems((prev) => [...prev, ...data.items]);
        setSkip(currentSkip + data.items.length);
      }
      setTotal(data.total);
    }
    setLoadingData(false);
  }, [authFetch, skip, typeFilter]);

  useEffect(() => {
    if (hasPermission("users.manage_coins")) {
      setLoadingData(true);
      setSkip(0);
      fetchTransactions(true);
    }
  }, [user, typeFilter, hasPermission, authFetch]);

  if (loading || !hasPermission("users.manage_coins")) return null;

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
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Транзакции</h1>
          <p className="text-sm text-[var(--text-muted)]">Лог операций с монетами ({total})</p>
        </div>
      </div>

      {/* Фильтр по типу */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        <button
          onClick={() => setTypeFilter("")}
          className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
            !typeFilter
              ? "bg-blue-600 text-white"
              : "bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          Все
        </button>
        {ALL_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              typeFilter === t
                ? "bg-blue-600 text-white"
                : "bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            {TYPE_LABELS[t].label}
          </button>
        ))}
      </div>

      {/* Список */}
      {loadingData ? (
        <p className="text-sm text-[var(--text-muted)] py-8 text-center">Загрузка...</p>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-[var(--text-muted)]">
          <Coins className="h-10 w-10 mb-2 opacity-30" />
          <p className="text-sm">Транзакции не найдены</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((t) => {
            const typeDef = TYPE_LABELS[t.type] || { label: t.type, color: "text-gray-600 bg-gray-50" };
            const isPositive = t.amount > 0;

            return (
              <div
                key={t._id}
                className="flex items-center gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-3"
              >
                {/* Аватар */}
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white font-bold text-xs">
                  {(t.user?.username || "?")[0].toUpperCase()}
                </div>

                {/* Инфо */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
                      {t.user?.username || "Удалён"}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${typeDef.color}`}>
                      {typeDef.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                    <span>Баланс: {t.balance}</span>
                    <span>{formatDate(t.createdAt)}</span>
                  </div>
                </div>

                {/* Сумма */}
                <div className={`text-sm font-bold ${isPositive ? "text-green-600" : "text-red-500"}`}>
                  {isPositive ? "+" : ""}{t.amount}
                </div>
              </div>
            );
          })}

          {/* Загрузить ещё */}
          {items.length < total && (
            <button
              onClick={() => fetchTransactions(false)}
              className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
            >
              Загрузить ещё
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function formatDate(d) {
  if (!d) return "";
  const date = new Date(d);
  const now = new Date();
  const diff = now - date;
  if (diff < 60000) return "только что";
  if (diff < 3600000) return `${Math.floor(diff / 60000)} мин назад`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} ч назад`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} дн назад`;
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}
