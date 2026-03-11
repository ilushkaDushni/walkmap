"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@/components/UserProvider";
import { ArrowLeft, Plus, Pencil, Trash2, X, Save } from "lucide-react";
import { useRouter } from "next/navigation";

const CATEGORIES = ["frame", "banner", "title", "usernameColor", "chatTheme", "appTheme"];
const RARITIES = ["common", "rare", "epic", "legendary"];
const CATEGORY_LABELS = {
  frame: "Рамка", banner: "Баннер", title: "Титул",
  usernameColor: "Цвет ника", chatTheme: "Тема чата", appTheme: "Тема приложения",
};
const RARITY_LABELS = { common: "Обычный", rare: "Редкий", epic: "Эпический", legendary: "Легендарный" };

function QuickEditForm({ item, onSave, onCancel }) {
  const [price, setPrice] = useState(item?.price ?? 10);
  const [rarity, setRarity] = useState(item?.rarity || "common");
  const [isActive, setIsActive] = useState(item?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave({ price: Number(price), rarity, isActive });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-[var(--text-muted)]">Редкость</label>
          <select value={rarity} onChange={(e) => setRarity(e.target.value)}
            className="w-full rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-color)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none">
            {RARITIES.map((r) => <option key={r} value={r}>{RARITY_LABELS[r]}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-[var(--text-muted)]">Цена (маршрутики)</label>
          <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} min={0} required
            className="w-full rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-color)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none" />
        </div>
        <div>
          <label className="text-xs text-[var(--text-muted)]">В наличии</label>
          <button type="button" onClick={() => setIsActive(!isActive)}
            className={`w-full rounded-xl border px-3 py-2 text-sm font-medium transition ${isActive ? "bg-green-500/10 border-green-500/30 text-green-500" : "bg-red-500/10 border-red-500/30 text-red-400"}`}>
            {isActive ? "Да" : "Нет"}
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving}
          className="flex-1 py-2 rounded-xl bg-green-600 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-40 flex items-center justify-center gap-1.5">
          <Save className="h-4 w-4" />
          Сохранить
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-2 rounded-xl bg-[var(--bg-elevated)] text-sm text-[var(--text-secondary)] hover:bg-[var(--border-color)]">
          Отмена
        </button>
      </div>
    </form>
  );
}

function ItemForm({ item, onSave, onCancel }) {
  const [name, setName] = useState(item?.name || "");
  const [slug, setSlug] = useState(item?.slug || "");
  const [category, setCategory] = useState(item?.category || "frame");
  const [description, setDescription] = useState(item?.description || "");
  const [price, setPrice] = useState(item?.price ?? 10);
  const [rarity, setRarity] = useState(item?.rarity || "common");
  const [imageUrl, setImageUrl] = useState(item?.imageUrl || "");
  const [cssData, setCssData] = useState(JSON.stringify(item?.cssData || {}, null, 2));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      let parsed = {};
      try { parsed = JSON.parse(cssData); } catch { setError("Невалидный JSON в cssData"); setSaving(false); return; }

      await onSave({
        name, slug, category, description, price: Number(price),
        rarity, imageUrl: imageUrl || null, cssData: parsed,
        ...(item?.id ? { isActive: item.isActive } : {}),
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-[var(--text-muted)]">Название</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required
            className="w-full rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-color)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none" />
        </div>
        <div>
          <label className="text-xs text-[var(--text-muted)]">Slug</label>
          <input value={slug} onChange={(e) => setSlug(e.target.value)} required disabled={!!item?.id}
            className="w-full rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-color)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none disabled:opacity-50" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-[var(--text-muted)]">Категория</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-color)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none">
            {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-[var(--text-muted)]">Редкость</label>
          <select value={rarity} onChange={(e) => setRarity(e.target.value)}
            className="w-full rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-color)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none">
            {RARITIES.map((r) => <option key={r} value={r}>{RARITY_LABELS[r]}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-[var(--text-muted)]">Цена (маршрутики)</label>
          <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} min={0} required
            className="w-full rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-color)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none" />
        </div>
      </div>
      <div>
        <label className="text-xs text-[var(--text-muted)]">Описание</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
          className="w-full rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-color)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none resize-none" />
      </div>
      <div>
        <label className="text-xs text-[var(--text-muted)]">URL изображения</label>
        <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)}
          className="w-full rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-color)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none" />
      </div>
      <div>
        <label className="text-xs text-[var(--text-muted)]">CSS Data (JSON)</label>
        <textarea value={cssData} onChange={(e) => setCssData(e.target.value)} rows={3}
          className="w-full rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-color)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none resize-none font-mono" />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving}
          className="flex-1 py-2 rounded-xl bg-green-600 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-40 flex items-center justify-center gap-1.5">
          <Save className="h-4 w-4" />
          {item?.id ? "Сохранить" : "Создать"}
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-2 rounded-xl bg-[var(--bg-elevated)] text-sm text-[var(--text-secondary)] hover:bg-[var(--border-color)]">
          Отмена
        </button>
      </div>
    </form>
  );
}

export default function AdminShopPage() {
  const { user, authFetch, hasPermission } = useUser();
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | "new" | item object
  const [rate, setRate] = useState(10);
  const [newRate, setNewRate] = useState("");

  const canManage = hasPermission("shop.manage");
  const canEdit = hasPermission("shop.edit");
  const hasAccess = canManage || canEdit;

  const fetchItems = useCallback(async () => {
    if (!authFetch) return;
    try {
      const res = await authFetch("/api/admin/shop");
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [authFetch]);

  const fetchRate = useCallback(async () => {
    try {
      const res = await fetch("/api/currency/rate");
      if (res.ok) {
        const data = await res.json();
        setRate(data.rate);
        setNewRate(String(data.rate));
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (hasAccess) { fetchItems(); if (canManage) fetchRate(); }
  }, [hasAccess, canManage, fetchItems, fetchRate]);

  const handleSave = async (data) => {
    if (!authFetch) return;
    if (editing && editing !== "new" && editing.id) {
      // Update
      const res = await authFetch(`/api/admin/shop/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Ошибка обновления");
      }
    } else {
      // Create
      const res = await authFetch("/api/admin/shop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Ошибка создания");
      }
    }
    setEditing(null);
    await fetchItems();
  };

  const handleDeactivate = async (itemId) => {
    if (!authFetch) return;
    await authFetch(`/api/admin/shop/${itemId}`, { method: "DELETE" });
    await fetchItems();
  };

  const handleToggleActive = async (item) => {
    if (!authFetch) return;
    await authFetch(`/api/admin/shop/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !item.isActive }),
    });
    await fetchItems();
  };

  const handleRateChange = async () => {
    if (!authFetch) return;
    const val = parseInt(newRate, 10);
    if (!val || val < 1) return;
    await authFetch("/api/admin/currency/rate", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rate: val }),
    });
    await fetchRate();
  };

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-[var(--text-muted)]">Нет доступа</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-main)] pb-24">
      <div className="px-4 py-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => router.back()} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Управление магазином</h1>
        </div>

        {/* Курс валюты — только для shop.manage */}
        {canManage && (
          <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 mb-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Курс валюты</h3>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={newRate}
                onChange={(e) => setNewRate(e.target.value)}
                min={1}
                className="w-24 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-color)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
              />
              <span className="text-sm text-[var(--text-muted)]">монет = 1 маршрутик</span>
              <button
                onClick={handleRateChange}
                className="px-3 py-2 rounded-xl bg-blue-600 text-sm text-white hover:bg-blue-500"
              >
                Сохранить
              </button>
            </div>
          </div>
        )}

        {/* Создать — только для shop.manage */}
        {canManage && (
          <button
            onClick={() => setEditing("new")}
            className="flex items-center gap-2 w-full mb-4 py-3 rounded-2xl bg-green-600/10 border border-green-500/20 text-sm font-medium text-green-500 justify-center hover:bg-green-600/20 transition"
          >
            <Plus className="h-4 w-4" />
            Создать товар
          </button>
        )}

        {/* Форма */}
        {editing && editing !== "new" && (
          <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 mb-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
              Редактирование: {editing.name}
            </h3>
            {canManage ? (
              <ItemForm
                item={editing}
                onSave={handleSave}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <QuickEditForm
                item={editing}
                onSave={handleSave}
                onCancel={() => setEditing(null)}
              />
            )}
          </div>
        )}
        {editing === "new" && canManage && (
          <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 mb-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
              Новый товар
            </h3>
            <ItemForm
              item={null}
              onSave={handleSave}
              onCancel={() => setEditing(null)}
            />
          </div>
        )}

        {/* Список */}
        {loading ? (
          <div className="py-8 text-center text-sm text-[var(--text-muted)]">Загрузка...</div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-sm text-[var(--text-muted)]">Товаров пока нет</div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className={`flex items-center gap-3 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] px-4 py-3 ${!item.isActive ? "opacity-50" : ""}`}
              >
                <div className="h-10 w-10 rounded-xl bg-[var(--bg-elevated)] flex items-center justify-center shrink-0 overflow-hidden">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt="" className="h-full w-full object-cover rounded-xl" />
                  ) : (
                    <span className="text-lg">🎁</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{item.name}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {CATEGORY_LABELS[item.category]} · {RARITY_LABELS[item.rarity]} · 🔷 {item.price}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleToggleActive(item)}
                    className={`px-2 py-1 rounded-lg text-xs font-medium ${item.isActive ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-400"}`}
                  >
                    {item.isActive ? "Активен" : "Скрыт"}
                  </button>
                  <button
                    onClick={() => setEditing(item)}
                    className="p-1.5 rounded-lg hover:bg-[var(--bg-elevated)] transition"
                  >
                    <Pencil className="h-4 w-4 text-[var(--text-muted)]" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
