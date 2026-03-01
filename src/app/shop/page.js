"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@/components/UserProvider";
import ShopItemCard from "@/components/ShopItemCard";
import ShopItemModal from "@/components/ShopItemModal";
import CurrencyConverter from "@/components/CurrencyConverter";
import { ChevronRight } from "lucide-react";

const CATEGORIES = [
  { id: null, label: "Все", icon: "🛒" },
  { id: "frame", label: "Рамки", icon: "⭕" },
  { id: "title", label: "Титулы", icon: "🏷️" },
  { id: "usernameColor", label: "Цвет ника", icon: "🎨" },
  { id: "banner", label: "Баннеры", icon: "🖼️" },
  { id: "chatTheme", label: "Темы чата", icon: "💬" },
  { id: "appTheme", label: "Темы", icon: "🌗" },
];

export default function ShopPage() {
  const { user, authFetch, updateUser } = useUser();
  const [category, setCategory] = useState(null);
  const [items, setItems] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showConverter, setShowConverter] = useState(false);

  const fetchShop = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      params.set("limit", "50");
      const res = await fetch(`/api/shop?${params}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [category]);

  const fetchInventory = useCallback(async () => {
    if (!authFetch) return;
    try {
      const res = await authFetch("/api/shop/inventory");
      if (res.ok) {
        const data = await res.json();
        setInventory(data.items || []);
      }
    } catch {
      // ignore
    }
  }, [authFetch]);

  useEffect(() => {
    setLoading(true);
    fetchShop();
  }, [fetchShop]);

  useEffect(() => {
    if (user) fetchInventory();
  }, [user, fetchInventory]);

  const inventoryMap = new Map(inventory.map((inv) => [inv.id, inv]));

  const handleBuy = async (itemId) => {
    if (!authFetch) return;
    try {
      const res = await authFetch("/api/shop/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      if (res.ok) {
        const data = await res.json();
        updateUser({ routiks: data.routiks });
        await fetchInventory();
        setSelectedItem(null);
      }
    } catch { /* ignore */ }
  };

  const handleEquip = async (itemId) => {
    if (!authFetch) return;
    try {
      const res = await authFetch("/api/shop/equip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, equip: true }),
      });
      if (res.ok) {
        const data = await res.json();
        updateUser({ equippedItems: data.equippedItems });
        // Применить appTheme если экипировали тему приложения
        if (data.equippedItems?.appTheme) {
          window.dispatchEvent(new CustomEvent("apply-app-theme", { detail: data.equippedItems.appTheme }));
        }
        await fetchInventory();
        setSelectedItem(null);
      }
    } catch { /* ignore */ }
  };

  const handleUnequip = async (itemId) => {
    if (!authFetch) return;
    try {
      const res = await authFetch("/api/shop/equip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, equip: false }),
      });
      if (res.ok) {
        const data = await res.json();
        updateUser({ equippedItems: data.equippedItems });
        // Если сняли appTheme — убрать кастомные переменные
        if (selectedItem?.category === "appTheme") {
          window.dispatchEvent(new CustomEvent("apply-app-theme", { detail: null }));
        }
        await fetchInventory();
        setSelectedItem(null);
      }
    } catch { /* ignore */ }
  };

  const currentCatLabel = CATEGORIES.find((c) => c.id === category)?.label || "Все";

  return (
    <div className="min-h-screen bg-[var(--bg-main)] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[var(--bg-main)] border-b border-[var(--border-color)]">
        <div className="px-4 py-3 max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Магазин</h1>
          {user && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowConverter((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition"
              >
                🪙 {user.coins || 0}
                <span className="text-[var(--text-muted)]">→</span>
                🔷 {user.routiks || 0}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Converter dropdown */}
      {showConverter && user && (
        <div className="px-4 py-3 border-b border-[var(--border-color)] bg-[var(--bg-surface)]">
          <div className="max-w-md mx-auto lg:ml-[260px]">
            <CurrencyConverter onConvert={() => {}} />
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto flex">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-[220px] shrink-0 sticky top-[57px] h-[calc(100vh-57px)] overflow-y-auto py-4 pl-4 pr-2">
          <nav className="space-y-0.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id || "all"}
                onClick={() => setCategory(cat.id)}
                className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-left text-sm transition ${
                  category === cat.id
                    ? "bg-[var(--bg-surface)] text-[var(--text-primary)] font-semibold shadow-sm border border-[var(--border-color)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
                }`}
              >
                <span className="text-base">{cat.icon}</span>
                <span className="flex-1">{cat.label}</span>
                {category === cat.id && <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 px-4 py-4">
          {/* Mobile category tabs */}
          <div className="lg:hidden flex gap-1.5 overflow-x-auto scrollbar-none pb-3 -mx-1 px-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id || "all"}
                onClick={() => setCategory(cat.id)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition ${
                  category === cat.id
                    ? "bg-[var(--text-primary)] text-[var(--bg-main)]"
                    : "bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
                }`}
              >
                <span>{cat.icon}</span>
                {cat.label}
              </button>
            ))}
          </div>

          {/* Category title (desktop) */}
          <h2 className="hidden lg:block text-lg font-bold text-[var(--text-primary)] mb-4">
            {currentCatLabel}
          </h2>

          {/* Grid */}
          {loading ? (
            <div className="py-12 text-center text-sm text-[var(--text-muted)]">Загрузка...</div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-sm text-[var(--text-muted)]">
              {category ? "В этой категории пока ничего нет" : "Магазин пуст"}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {items.map((item) => {
                const inv = inventoryMap.get(item.id);
                return (
                  <ShopItemCard
                    key={item.id}
                    item={item}
                    owned={!!inv}
                    equipped={inv?.equipped}
                    onClick={() => setSelectedItem(item)}
                  />
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Item modal */}
      {selectedItem && (
        <ShopItemModal
          item={selectedItem}
          owned={inventoryMap.has(selectedItem.id)}
          equipped={inventoryMap.get(selectedItem.id)?.equipped}
          routiks={user?.routiks || 0}
          user={user}
          onBuy={handleBuy}
          onEquip={handleEquip}
          onUnequip={handleUnequip}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}
