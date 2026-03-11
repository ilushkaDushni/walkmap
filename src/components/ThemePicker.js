"use client";

import { useState, useEffect, useCallback } from "react";
import { Check, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { FREE_THEMES } from "./ThemeProvider";
import { useUser } from "./UserProvider";

export default function ThemePicker({ currentTheme, onSelect }) {
  const { user, authFetch, updateUser } = useUser();
  const router = useRouter();
  const [shopThemes, setShopThemes] = useState([]); // все appTheme из каталога
  const [ownedIds, setOwnedIds] = useState(new Set()); // id купленных

  // Загружаем каталог appTheme + инвентарь
  useEffect(() => {
    // Каталог (публичный)
    fetch("/api/shop?category=appTheme&limit=50")
      .then((r) => r.ok ? r.json() : { items: [] })
      .then(({ items }) => setShopThemes(items || []))
      .catch(() => {});

    // Инвентарь (только для залогиненных)
    if (user && authFetch) {
      authFetch("/api/shop/inventory")
        .then((r) => r.ok ? r.json() : { items: [] })
        .then(({ items }) => {
          const owned = new Set(
            (items || []).filter((i) => i.category === "appTheme").map((i) => i.id)
          );
          setOwnedIds(owned);
        })
        .catch(() => {});
    }
  }, [user, authFetch]);

  // Преобразуем каталог в формат для отображения
  const premiumThemes = shopThemes.map((item) => ({
    id: item.cssData?.id || item.slug,
    name: item.name,
    isDark: item.cssData?.isDark ?? true,
    color: item.cssData?.["--bg-main"] || "#333",
    accentColor: item.cssData?.["--text-primary"] || "#fff",
    isPremium: true,
    owned: ownedIds.has(item.id),
    price: item.price,
    cssData: item.cssData,
    itemId: item.id,
  }));

  const handleSelect = useCallback(async (theme) => {
    if (theme.isPremium && !theme.owned) {
      // Не куплена — переход в магазин
      router.push("/shop");
      return;
    }

    if (theme.isPremium) {
      // Визуально применяем сразу
      onSelect(theme.id, theme);
      // Equip на сервере
      if (authFetch && theme.itemId) {
        try {
          const res = await authFetch("/api/shop/equip", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ itemId: theme.itemId, equip: true }),
          });
          if (res.ok) {
            const data = await res.json();
            updateUser({ equippedItems: data.equippedItems });
          }
        } catch {}
      }
    } else {
      // Бесплатная тема
      onSelect(theme.id, null);
      // Unequip appTheme на сервере
      if (authFetch && user?.equippedItems?.appTheme) {
        try {
          const invRes = await authFetch("/api/shop/inventory");
          if (invRes.ok) {
            const { items } = await invRes.json();
            const equipped = items?.find((i) => i.category === "appTheme" && i.equipped);
            if (equipped) {
              const res = await authFetch("/api/shop/equip", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ itemId: equipped.id, equip: false }),
              });
              if (res.ok) {
                const data = await res.json();
                updateUser({ equippedItems: data.equippedItems });
              }
            }
          }
        } catch {}
      }
    }
  }, [onSelect, authFetch, updateUser, user, router]);

  const freeIds = new Set(FREE_THEMES.map((t) => t.id));
  const allThemes = [...FREE_THEMES, ...premiumThemes.filter((t) => !freeIds.has(t.id))];

  return (
    <div className="grid grid-cols-4 gap-2">
      {allThemes.map((t) => {
        const isActive = currentTheme === t.id;
        const locked = t.isPremium && !t.owned;
        return (
          <button
            key={t.id}
            onClick={() => handleSelect(t)}
            className={`flex flex-col items-center gap-1 py-1.5 rounded-xl transition hover:bg-[var(--bg-subtle)] ${locked ? "opacity-60" : ""}`}
          >
            <div className="relative">
              <div
                className="h-9 w-9 rounded-full border-2 transition"
                style={{
                  backgroundColor: t.color,
                  borderColor: isActive ? (t.isDark ? "#60a5fa" : "#3b82f6") : "transparent",
                }}
              >
                <div
                  className="absolute inset-0 rounded-full overflow-hidden"
                  style={{ backgroundColor: t.color }}
                >
                  <div
                    className="absolute bottom-0 left-0 right-0 h-1/3"
                    style={{ backgroundColor: t.accentColor || (t.isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.08)") }}
                  />
                </div>
              </div>
              {isActive && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Check className="h-4 w-4 drop-shadow-md" style={{ color: t.isDark ? "#fff" : "#1a1a1a" }} />
                </div>
              )}
              {locked && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Lock className="h-3.5 w-3.5 text-white/70 drop-shadow-md" />
                </div>
              )}
            </div>
            <span className="text-xs text-[var(--text-muted)] leading-tight text-center">
              {t.name}
            </span>
            {t.isPremium && (
              <span className={`text-xs font-bold leading-none ${locked ? "text-[var(--text-muted)]" : "text-purple-400"}`}>
                {locked ? `🔷 ${t.price}` : "PRO"}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
