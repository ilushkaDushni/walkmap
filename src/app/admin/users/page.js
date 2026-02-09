"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/components/UserProvider";
import {
  ArrowLeft,
  Search,
  Shield,
  Ban,
  Coins,
  ChevronDown,
  Crown,
  User,
  X,
} from "lucide-react";

export default function AdminUsersPage() {
  const { user, loading, authFetch, hasPermission } = useUser();
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [allRoles, setAllRoles] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("createdAt");
  const [order, setOrder] = useState("desc");
  const [coinsModal, setCoinsModal] = useState(null);

  useEffect(() => {
    if (!loading && !hasPermission("users.view")) {
      router.replace("/");
    }
  }, [user, loading, router, hasPermission]);

  const fetchUsers = useCallback(async () => {
    const params = new URLSearchParams({ sort, order });
    if (search.trim()) params.set("q", search.trim());
    const [uRes, rRes] = await Promise.all([
      authFetch(`/api/admin/users?${params}`),
      authFetch("/api/admin/roles"),
    ]);
    if (uRes.ok) setUsers(await uRes.json());
    if (rRes.ok) setAllRoles(await rRes.json());
    setLoadingData(false);
  }, [authFetch, search, sort, order]);

  useEffect(() => {
    if (hasPermission("users.view")) fetchUsers();
  }, [user, fetchUsers, hasPermission]);

  const handleUpdate = async (id, data) => {
    const res = await authFetch(`/api/admin/users/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) fetchUsers();
  };

  const toggleSort = (field) => {
    if (sort === field) {
      setOrder((o) => (o === "desc" ? "asc" : "desc"));
    } else {
      setSort(field);
      setOrder("desc");
    }
  };

  if (loading || !hasPermission("users.view")) return null;

  const totalUsers = users.length;
  const totalCoins = users.reduce((s, u) => s + (u.coins || 0), 0);
  const totalCompleted = users.reduce((s, u) => s + (u.completedRoutes || 0), 0);

  return (
    <div className="mx-auto max-w-lg px-4 pt-4 pb-24">
      {/* Шапка */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => router.push("/admin/routes")}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Пользователи</h1>
          <p className="text-sm text-[var(--text-muted)]">Управление аккаунтами</p>
        </div>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-color)] p-3 text-center">
          <p className="text-lg font-bold text-[var(--text-primary)]">{totalUsers}</p>
          <p className="text-xs text-[var(--text-muted)]">Всего</p>
        </div>
        <div className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-color)] p-3 text-center">
          <p className="text-lg font-bold text-amber-500">{totalCoins}</p>
          <p className="text-xs text-[var(--text-muted)]">Монет</p>
        </div>
        <div className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-color)] p-3 text-center">
          <p className="text-lg font-bold text-green-600">{totalCompleted}</p>
          <p className="text-xs text-[var(--text-muted)]">Пройдено</p>
        </div>
      </div>

      {/* Поиск */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
        <input
          type="text"
          placeholder="Поиск по логину..."
          className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] pl-9 pr-4 py-2.5 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Сортировка */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {[
          { key: "createdAt", label: "Дата" },
          { key: "username", label: "Логин" },
          { key: "coins", label: "Монеты" },
          { key: "lastLoginAt", label: "Активность" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => toggleSort(key)}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              sort === key
                ? "bg-blue-600 text-white"
                : "bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            {label}
            {sort === key && (
              <ChevronDown
                className={`h-3 w-3 transition-transform ${order === "asc" ? "rotate-180" : ""}`}
              />
            )}
          </button>
        ))}
      </div>

      {/* Список */}
      {loadingData ? (
        <p className="text-sm text-[var(--text-muted)] py-8 text-center">Загрузка...</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)] py-8 text-center">Пользователи не найдены</p>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <UserRow
              key={u._id}
              u={u}
              isSelf={u._id === user?.id}
              allRoles={allRoles}
              canAssignRoles={hasPermission("users.assign_roles")}
              canBan={hasPermission("users.ban")}
              canManageCoins={hasPermission("users.manage_coins")}
              onChangeRoles={(roleIds) => handleUpdate(u._id, { roles: roleIds })}
              onToggleBan={() => handleUpdate(u._id, { banned: !u.banned })}
              onOpenCoins={() => setCoinsModal(u)}
            />
          ))}
        </div>
      )}

      {/* Модалка монет */}
      {coinsModal && (
        <CoinsModal
          u={coinsModal}
          onSave={(delta) => {
            handleUpdate(coinsModal._id, { addCoins: delta });
            setCoinsModal(null);
          }}
          onClose={() => setCoinsModal(null)}
        />
      )}
    </div>
  );
}

// === Мульти-роль пикер ===
function RolePicker({ currentRoleIds, allRoles, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const toggle = (roleId) => {
    const next = currentRoleIds.includes(roleId)
      ? currentRoleIds.filter((id) => id !== roleId)
      : [...currentRoleIds, roleId];
    onChange(next);
  };

  const currentRoles = allRoles.filter((r) => currentRoleIds.includes(r._id));

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 flex-wrap rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-1.5 py-1 text-xs min-w-[4rem] max-w-[10rem]"
      >
        {currentRoles.length === 0 ? (
          <span className="text-[var(--text-muted)] px-0.5">Нет ролей</span>
        ) : (
          currentRoles.map((r) => (
            <span
              key={r._id}
              className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
              style={{ backgroundColor: `${r.color}20`, color: r.color }}
            >
              {r.name}
            </span>
          ))
        )}
        <ChevronDown className="h-3 w-3 ml-auto shrink-0 text-[var(--text-muted)]" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 w-48 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-lg py-1">
          {allRoles.map((r) => (
            <label
              key={r._id}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--bg-elevated)] cursor-pointer text-xs text-[var(--text-primary)]"
            >
              <input
                type="checkbox"
                checked={currentRoleIds.includes(r._id)}
                onChange={() => toggle(r._id)}
                className="h-3.5 w-3.5 rounded accent-blue-600"
              />
              <span
                className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                style={{ backgroundColor: `${r.color}20`, color: r.color }}
              >
                {r.name}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// === Строка пользователя ===
function UserRow({ u, isSelf, allRoles, canAssignRoles, canBan, canManageCoins, onChangeRoles, onToggleBan, onOpenCoins }) {
  const topRole = u.roles?.[0];
  const avatarColor = topRole?.color || "#22c55e";

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border p-3 transition ${
        u.banned
          ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30"
          : "border-[var(--border-color)] bg-[var(--bg-surface)]"
      }`}
    >
      {/* Аватар */}
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white font-bold text-sm"
        style={{ backgroundColor: avatarColor }}
      >
        {(u.username || "?")[0].toUpperCase()}
      </div>

      {/* Инфо */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
            {u.username}
          </p>
          {u.banned && <Ban className="h-3 w-3 text-red-500 shrink-0" />}
        </div>
        <div className="flex items-center gap-1 flex-wrap mt-0.5">
          {(u.roles || []).map((role) => (
            <span
              key={role.id}
              className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
              style={{ backgroundColor: `${role.color}20`, color: role.color }}
            >
              {role.name}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] mt-0.5">
          <span>{u.coins || 0} монет</span>
          <span>{u.completedRoutes || 0} маршр.</span>
          {u.lastLoginAt && (
            <span title="Последний вход">{formatDate(u.lastLoginAt)}</span>
          )}
        </div>
      </div>

      {/* Действия */}
      <div className="flex items-center gap-0.5">
        {canManageCoins && (
          <button
            onClick={onOpenCoins}
            className="rounded-lg p-1.5 text-amber-500 hover:bg-[var(--bg-elevated)] transition"
            title="Монеты"
          >
            <Coins className="h-4 w-4" />
          </button>
        )}
        {!isSelf && canAssignRoles && (
          <RolePicker
            currentRoleIds={u.roleIds || []}
            allRoles={allRoles}
            onChange={onChangeRoles}
          />
        )}
        {!isSelf && canBan && (
          <button
            onClick={onToggleBan}
            className={`rounded-lg p-1.5 transition ${
              u.banned
                ? "text-red-500 hover:text-red-600"
                : "text-[var(--text-muted)] hover:text-red-500"
            }`}
            title={u.banned ? "Разбанить" : "Забанить"}
          >
            <Ban className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// === Модалка монет ===
function CoinsModal({ u, onSave, onClose }) {
  const [delta, setDelta] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div
        className="w-full max-w-xs rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-[var(--text-primary)]">
            Монеты: {u.username}
          </h3>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-[var(--text-muted)] mb-3">
          Баланс: <span className="font-bold text-amber-500">{u.coins || 0}</span> монет
        </p>

        <input
          type="number"
          placeholder="Кол-во (- для списания)"
          className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none mb-4"
          value={delta}
          onChange={(e) => setDelta(e.target.value)}
          autoFocus
        />

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-4 py-2 text-sm font-medium text-[var(--text-primary)]"
          >
            Отмена
          </button>
          <button
            onClick={() => {
              const n = Number(delta);
              if (!isNaN(n) && n !== 0) onSave(n);
            }}
            disabled={!delta || isNaN(Number(delta)) || Number(delta) === 0}
            className="flex-1 rounded-xl bg-amber-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {Number(delta) > 0 ? "Начислить" : "Списать"}
          </button>
        </div>
      </div>
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
