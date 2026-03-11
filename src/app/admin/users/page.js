"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/components/UserProvider";
import ChatView from "@/components/ChatView";
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
  Package,
  MessageCircle,
  Gift,
  Trash2,
  Clock,
  History,
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
  const [inventoryModal, setInventoryModal] = useState(null);
  const [chatUser, setChatUser] = useState(null);
  const [banModal, setBanModal] = useState(null);
  const [banHistoryModal, setBanHistoryModal] = useState(null);

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
              canManageShop={hasPermission("shop.manage")}
              canViewUsers={hasPermission("users.view")}
              onChangeRoles={(roleIds) => handleUpdate(u._id, { roles: roleIds })}
              onBan={() => u.banned ? handleUpdate(u._id, { banned: false }) : setBanModal(u)}
              onBanHistory={() => setBanHistoryModal(u)}
              onOpenCoins={() => setCoinsModal(u)}
              onOpenInventory={() => setInventoryModal(u)}
              onOpenChat={() => setChatUser({ id: u._id, username: u.username, avatarUrl: u.avatarUrl || null })}
            />
          ))}
        </div>
      )}

      {/* Модалка монет */}
      {coinsModal && (
        <CoinsModal
          u={coinsModal}
          onSave={(delta, msg) => {
            handleUpdate(coinsModal._id, { addCoins: delta, coinMessage: msg });
            setCoinsModal(null);
          }}
          onClose={() => setCoinsModal(null)}
        />
      )}

      {/* Модалка инвентаря */}
      {inventoryModal && (
        <InventoryModal
          u={inventoryModal}
          authFetch={authFetch}
          onClose={() => setInventoryModal(null)}
        />
      )}

      {/* Модалка бана */}
      {banModal && (
        <BanUserModal
          u={banModal}
          onBan={(reason, duration) => {
            handleUpdate(banModal._id, { banned: true, banReason: reason, banDuration: duration });
            setBanModal(null);
          }}
          onClose={() => setBanModal(null)}
        />
      )}

      {/* История банов */}
      {banHistoryModal && (
        <BanHistoryModal
          u={banHistoryModal}
          authFetch={authFetch}
          onClose={() => setBanHistoryModal(null)}
        />
      )}

      {/* Оверлей чата */}
      {chatUser && (
        <div className="fixed inset-0 z-[60]">
          <ChatView
            friendId={chatUser.id}
            friend={chatUser}
            onBack={() => setChatUser(null)}
            adminMode
          />
        </div>
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
              className="rounded px-1.5 py-0.5 text-xs font-semibold"
              style={{ backgroundColor: `${r.color}20`, color: r.color }}
            >
              {r.name}
            </span>
          ))
        )}
        <ChevronDown className="h-3 w-3 ml-auto shrink-0 text-[var(--text-muted)]" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 w-48 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-[var(--shadow-sm)] py-1">
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
                className="rounded px-1.5 py-0.5 text-xs font-semibold"
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
function UserRow({ u, isSelf, allRoles, canAssignRoles, canBan, canManageCoins, canManageShop, canViewUsers, onChangeRoles, onBan, onBanHistory, onOpenCoins, onOpenInventory, onOpenChat }) {
  const topRole = u.roles?.[0];
  const avatarColor = topRole?.color || "#22c55e";

  return (
    <div
      className={`rounded-2xl border p-3 transition ${
        u.banned
          ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30"
          : "border-[var(--border-color)] bg-[var(--bg-surface)]"
      }`}
    >
      {/* Верхняя строка: аватар + ник + роли */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white font-bold text-sm"
          style={{ backgroundColor: avatarColor }}
        >
          {(u.username || "?")[0].toUpperCase()}
        </div>
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
                className="rounded px-1.5 py-0.5 text-xs font-semibold"
                style={{ backgroundColor: `${role.color}20`, color: role.color }}
              >
                {role.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Нижняя строка: статы + действия */}
      <div className="flex items-center justify-between mt-2 pl-[52px]">
        <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
          <span>{u.coins || 0} монет</span>
          <span>{u.completedRoutes || 0} маршр.</span>
          {u.lastLoginAt && (
            <span title="Последний вход">{formatDate(u.lastLoginAt)}</span>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {canManageShop && (
            <button
              onClick={onOpenInventory}
              className="rounded-lg p-1.5 text-purple-500 hover:bg-[var(--bg-elevated)] transition"
              title="Инвентарь"
            >
              <Package className="h-4 w-4" />
            </button>
          )}
          {canManageCoins && (
            <button
              onClick={onOpenCoins}
              className="rounded-lg p-1.5 text-amber-500 hover:bg-[var(--bg-elevated)] transition"
              title="Монеты"
            >
              <Coins className="h-4 w-4" />
            </button>
          )}
          {!isSelf && canViewUsers && (
            <button
              onClick={onOpenChat}
              className="rounded-lg p-1.5 text-blue-500 hover:bg-[var(--bg-elevated)] transition"
              title="Написать"
            >
              <MessageCircle className="h-4 w-4" />
            </button>
          )}
          {!isSelf && canBan && (
            <>
              <button
                onClick={onBanHistory}
                className="rounded-lg p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
                title="История банов"
              >
                <History className="h-4 w-4" />
              </button>
              <button
                onClick={onBan}
                className={`rounded-lg p-1.5 transition ${
                  u.banned
                    ? "text-red-500 hover:text-red-600"
                    : "text-[var(--text-muted)] hover:text-red-500"
                }`}
                title={u.banned ? "Разбанить" : "Забанить"}
              >
                <Ban className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Роль-пикер — отдельной строкой */}
      {!isSelf && canAssignRoles && (
        <div className="mt-2 pl-[52px]">
          <RolePicker
            currentRoleIds={u.roleIds || []}
            allRoles={allRoles}
            onChange={onChangeRoles}
          />
        </div>
      )}
    </div>
  );
}

// === Модалка инвентаря ===
function InventoryModal({ u, authFetch, onClose }) {
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [revokeItem, setRevokeItem] = useState(null);
  const [showGift, setShowGift] = useState(false);

  const loadInventory = useCallback(async () => {
    setLoadingItems(true);
    const res = await authFetch(`/api/admin/shop/user-inventory?userId=${u._id}`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.items || []);
    }
    setLoadingItems(false);
  }, [authFetch, u._id]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const RARITY_COLORS = {
    common: "text-gray-500",
    uncommon: "text-green-500",
    rare: "text-blue-500",
    epic: "text-purple-500",
    legendary: "text-amber-500",
  };

  const CATEGORY_LABELS = {
    nameColor: "Цвет ника",
    nameEffect: "Эффект ника",
    chatBubble: "Пузырь чата",
    chatTheme: "Тема чата",
    profileFrame: "Рамка профиля",
    badge: "Значок",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div
        className="w-full max-w-sm max-h-[80vh] rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-[var(--shadow-md)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">
          <h3 className="text-base font-bold text-[var(--text-primary)]">
            Инвентарь: {u.username}
          </h3>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loadingItems ? (
            <p className="text-sm text-[var(--text-muted)] py-6 text-center">Загрузка...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] py-6 text-center">Инвентарь пуст</p>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
                        {item.name}
                      </span>
                      {item.equipped && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/15 text-green-500 font-medium">
                          Надето
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-[var(--text-muted)]">
                        {CATEGORY_LABELS[item.category] || item.category}
                      </span>
                      <span className={`text-xs font-medium ${RARITY_COLORS[item.rarity] || "text-gray-500"}`}>
                        {item.rarity}
                      </span>
                      <span className="text-xs text-[var(--text-muted)]">
                        {item.price} &#x20BD;
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setRevokeItem(item)}
                    className="rounded-lg p-1.5 text-red-500 hover:bg-red-500/10 transition"
                    title="Изъять"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 pb-4 pt-2 border-t border-[var(--border-color)]">
          <button
            onClick={() => setShowGift(true)}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-green-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-600 transition"
          >
            <Gift className="h-4 w-4" />
            Подарить предмет
          </button>
        </div>

        {/* Модалка изъятия */}
        {revokeItem && (
          <RevokeModal
            item={revokeItem}
            userId={u._id}
            authFetch={authFetch}
            onDone={() => {
              setRevokeItem(null);
              loadInventory();
            }}
            onClose={() => setRevokeItem(null)}
          />
        )}

        {/* Модалка подарка */}
        {showGift && (
          <GiftItemModal
            userId={u._id}
            username={u.username}
            ownedItemIds={items.map((i) => i.id)}
            authFetch={authFetch}
            onDone={() => {
              setShowGift(false);
              loadInventory();
            }}
            onClose={() => setShowGift(false)}
          />
        )}
      </div>
    </div>
  );
}

// === Модалка изъятия ===
function RevokeModal({ item, userId, authFetch, onDone, onClose }) {
  const [reason, setReason] = useState("");
  const [refundPercent, setRefundPercent] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) return;
    setSubmitting(true);
    const res = await authFetch("/api/admin/shop/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, itemId: item.id, reason: reason.trim(), refundPercent }),
    });
    if (res.ok) {
      onDone();
    }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div
        className="w-full max-w-xs rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-5 shadow-[var(--shadow-md)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h4 className="text-sm font-bold text-[var(--text-primary)] mb-3">
          Изъять: {item.name}
        </h4>

        <textarea
          placeholder="Причина изъятия (обязательно)"
          className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none mb-3 resize-none"
          rows={2}
          maxLength={200}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          autoFocus
        />

        <p className="text-xs text-[var(--text-muted)] mb-2">Возврат рутиков ({item.price} руб.):</p>
        <div className="flex gap-2 mb-4">
          {[0, 50, 100].map((pct) => (
            <button
              key={pct}
              onClick={() => setRefundPercent(pct)}
              className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition ${
                refundPercent === pct
                  ? "bg-blue-600 text-white"
                  : "bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border-color)]"
              }`}
            >
              {pct}%
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-4 py-2 text-sm font-medium text-[var(--text-primary)]"
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={!reason.trim() || submitting}
            className="flex-1 rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? "..." : "Изъять"}
          </button>
        </div>
      </div>
    </div>
  );
}

// === Модалка подарка предмета ===
function GiftItemModal({ userId, username, ownedItemIds, authFetch, onDone, onClose }) {
  const [allItems, setAllItems] = useState([]);
  const [loadingShop, setLoadingShop] = useState(true);
  const [filter, setFilter] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await authFetch("/api/admin/shop");
      if (res.ok) {
        const data = await res.json();
        setAllItems(data.items || data || []);
      }
      setLoadingShop(false);
    })();
  }, [authFetch]);

  const CATEGORY_LABELS = {
    nameColor: "Цвет ника",
    nameEffect: "Эффект ника",
    chatBubble: "Пузырь чата",
    chatTheme: "Тема чата",
    profileFrame: "Рамка профиля",
    badge: "Значок",
  };

  const categories = [...new Set(allItems.map((i) => i.category))];
  const filtered = filter ? allItems.filter((i) => i.category === filter) : allItems;

  const handleGift = async () => {
    if (!selectedItem) return;
    setSubmitting(true);
    const res = await authFetch("/api/admin/shop/gift", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, itemId: selectedItem._id || selectedItem.id, message: message.trim() }),
    });
    if (res.ok) {
      onDone();
    }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div
        className="w-full max-w-sm max-h-[80vh] rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-[var(--shadow-md)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">
          <h3 className="text-sm font-bold text-[var(--text-primary)]">
            Подарить: {username}
          </h3>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Фильтр по категории */}
        <div className="flex gap-1.5 px-4 pt-3 flex-wrap">
          <button
            onClick={() => setFilter("")}
            className={`rounded-lg px-2 py-1 text-xs font-medium transition ${
              !filter ? "bg-blue-600 text-white" : "bg-[var(--bg-elevated)] text-[var(--text-muted)]"
            }`}
          >
            Все
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`rounded-lg px-2 py-1 text-xs font-medium transition ${
                filter === cat ? "bg-blue-600 text-white" : "bg-[var(--bg-elevated)] text-[var(--text-muted)]"
              }`}
            >
              {CATEGORY_LABELS[cat] || cat}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loadingShop ? (
            <p className="text-sm text-[var(--text-muted)] py-6 text-center">Загрузка...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] py-6 text-center">Нет товаров</p>
          ) : (
            <div className="space-y-1.5">
              {filtered.map((item) => {
                const id = item._id || item.id;
                const owned = ownedItemIds.includes(id);
                const selected = (selectedItem?._id || selectedItem?.id) === id;
                return (
                  <button
                    key={id}
                    onClick={() => !owned && setSelectedItem(item)}
                    disabled={owned}
                    className={`w-full flex items-center gap-3 rounded-xl border p-2.5 text-left transition ${
                      selected
                        ? "border-green-500 bg-green-500/10"
                        : owned
                          ? "border-[var(--border-color)] bg-[var(--bg-elevated)] opacity-50 cursor-not-allowed"
                          : "border-[var(--border-color)] bg-[var(--bg-elevated)] hover:border-[var(--text-muted)]"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium text-[var(--text-primary)]">{item.name}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-[var(--text-muted)]">
                          {CATEGORY_LABELS[item.category] || item.category}
                        </span>
                        {owned && (
                          <span className="text-xs text-amber-500 font-medium">Уже есть</span>
                        )}
                      </div>
                    </div>
                    {selected && <Gift className="h-4 w-4 text-green-500 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-4 pb-4 pt-2 border-t border-[var(--border-color)] space-y-2">
          <textarea
            placeholder="Подпись (необязательно)"
            className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-4 py-2 text-sm text-[var(--text-primary)] outline-none resize-none"
            rows={2}
            maxLength={200}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button
            onClick={handleGift}
            disabled={!selectedItem || submitting}
            className="w-full rounded-xl bg-green-500 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 hover:bg-green-600 transition"
          >
            {submitting ? "..." : "Подарить"}
          </button>
        </div>
      </div>
    </div>
  );
}

// === Модалка монет ===
function CoinsModal({ u, onSave, onClose }) {
  const [delta, setDelta] = useState("");
  const [coinMessage, setCoinMessage] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div
        className="w-full max-w-xs rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-5 shadow-[var(--shadow-md)]"
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
          className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none mb-2"
          value={delta}
          onChange={(e) => setDelta(e.target.value)}
          autoFocus
        />
        <textarea
          placeholder="Подпись (необязательно)"
          className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none mb-4 resize-none"
          rows={2}
          maxLength={200}
          value={coinMessage}
          onChange={(e) => setCoinMessage(e.target.value)}
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
              if (!isNaN(n) && n !== 0) onSave(n, coinMessage);
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

// === Модалка бана ===
function BanUserModal({ u, onBan, onClose }) {
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState(0); // 0 = навсегда

  const durations = [
    { value: 1, label: "1 день" },
    { value: 3, label: "3 дня" },
    { value: 7, label: "7 дней" },
    { value: 30, label: "30 дней" },
    { value: 0, label: "Навсегда" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div
        className="w-full max-w-xs rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-5 shadow-[var(--shadow-md)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-[var(--text-primary)]">
            Забанить: {u.username}
          </h3>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <textarea
          placeholder="Причина бана (обязательно)"
          className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none mb-3 resize-none"
          rows={3}
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          autoFocus
        />
        <div className="text-right text-xs text-[var(--text-muted)] -mt-2 mb-3">{reason.length}/500</div>

        <p className="text-xs text-[var(--text-muted)] mb-2">Длительность:</p>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {durations.map((d) => (
            <button
              key={d.value}
              onClick={() => setDuration(d.value)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                duration === d.value
                  ? d.value === 0 ? "bg-red-500 text-white" : "bg-blue-600 text-white"
                  : "bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border-color)]"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-4 py-2 text-sm font-medium text-[var(--text-primary)]"
          >
            Отмена
          </button>
          <button
            onClick={() => {
              if (reason.trim()) onBan(reason.trim(), duration);
            }}
            disabled={!reason.trim()}
            className="flex-1 rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Забанить
          </button>
        </div>
      </div>
    </div>
  );
}

// === Модалка истории банов ===
function BanHistoryModal({ u, authFetch, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await authFetch(`/api/admin/users/${u._id}/bans`);
      if (res.ok) setHistory(await res.json());
      setLoading(false);
    })();
  }, [authFetch, u._id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div
        className="w-full max-w-sm max-h-[80vh] rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-[var(--shadow-md)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">
          <h3 className="text-base font-bold text-[var(--text-primary)]">
            История банов: {u.username}
          </h3>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <p className="text-sm text-[var(--text-muted)] py-6 text-center">Загрузка...</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] py-6 text-center">Нет записей</p>
          ) : (
            <div className="space-y-3">
              {history.map((h) => (
                <div
                  key={h.id}
                  className={`rounded-xl border p-3 ${
                    h.action === "ban"
                      ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/20"
                      : "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/20"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {h.action === "ban" ? (
                      <Ban className="h-3.5 w-3.5 text-red-500" />
                    ) : (
                      <Shield className="h-3.5 w-3.5 text-green-500" />
                    )}
                    <span className={`text-xs font-bold ${h.action === "ban" ? "text-red-500" : "text-green-500"}`}>
                      {h.action === "ban" ? "Бан" : "Разбан"}
                    </span>
                    {h.duration && (
                      <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                        <Clock className="h-3 w-3" />
                        {h.duration} дн.
                      </span>
                    )}
                    {h.action === "ban" && !h.duration && (
                      <span className="text-xs font-semibold text-red-400">навсегда</span>
                    )}
                  </div>
                  {h.reason && (
                    <p className="text-xs text-[var(--text-secondary)] mb-1">{h.reason}</p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                    <span>{h.bannedByUsername || "Система"}</span>
                    <span>{formatDate(h.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
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
