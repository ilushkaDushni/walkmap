"use client";

import { useState } from "react";
import { X, Eye, ShoppingCart, Check, Minus } from "lucide-react";
import UserAvatar from "./UserAvatar";

const RARITY_COLORS = {
  common: { bg: "bg-gray-500/10", text: "text-gray-400", border: "border-gray-500/30", label: "Обычный" },
  rare: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/30", label: "Редкий" },
  epic: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/30", label: "Эпический" },
  legendary: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/30", label: "Легендарный" },
};

const CATEGORY_LABELS = {
  frame: "Рамка",
  banner: "Баннер",
  title: "Титул",
  usernameColor: "Цвет ника",
  chatTheme: "Тема чата",
  appTheme: "Тема приложения",
};

// --- Preview components for different categories ---

function FramePreview({ item, user }) {
  const fakeEquipped = { frame: { cssData: item.cssData, imageUrl: item.imageUrl } };
  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <UserAvatar
        username={user?.username || "User"}
        avatarUrl={user?.avatarUrl}
        size="xl"
        equippedItems={fakeEquipped}
      />
      <p className="text-sm font-semibold text-[var(--text-primary)]">{user?.username || "Пользователь"}</p>
      <p className="text-xs text-[var(--text-muted)]">Так будет выглядеть ваш аватар</p>
    </div>
  );
}

function UsernameColorPreview({ item, user }) {
  const color = item.cssData?.color || "var(--text-primary)";
  return (
    <div className="py-4">
      {/* Fake profile card */}
      <div className="rounded-2xl bg-[var(--bg-elevated)] p-4">
        <div className="flex items-center gap-3 mb-3">
          <UserAvatar
            username={user?.username || "User"}
            avatarUrl={user?.avatarUrl}
            size="lg"
            equippedItems={user?.equippedItems}
          />
          <div>
            <p className="text-base font-bold" style={{ color }}>{user?.username || "Пользователь"}</p>
            <p className="text-xs text-[var(--text-muted)]">{user?.bio || "Участник Ростов GO"}</p>
          </div>
        </div>
        {/* Fake chat message */}
        <div className="rounded-xl bg-[var(--bg-surface)] p-3 mt-2">
          <p className="text-xs font-semibold mb-1" style={{ color }}>
            {user?.username || "Пользователь"}
          </p>
          <p className="text-xs text-[var(--text-secondary)]">Привет! Как дела? 👋</p>
        </div>
      </div>
      <p className="text-xs text-[var(--text-muted)] text-center mt-3">Так будет выглядеть ваш ник</p>
    </div>
  );
}

function TitlePreview({ item, user }) {
  const title = item.cssData?.text || item.name;
  const color = item.cssData?.color || "var(--text-primary)";
  return (
    <div className="py-4">
      <div className="rounded-2xl bg-[var(--bg-elevated)] p-4 flex flex-col items-center gap-2">
        <UserAvatar
          username={user?.username || "User"}
          avatarUrl={user?.avatarUrl}
          size="xl"
          equippedItems={user?.equippedItems}
        />
        <p className="text-base font-bold text-[var(--text-primary)]">{user?.username || "Пользователь"}</p>
        <span
          className="px-2.5 py-0.5 rounded-full text-xs font-bold"
          style={{ color, backgroundColor: color + "18", border: `1px solid ${color}40` }}
        >
          {title}
        </span>
      </div>
      <p className="text-xs text-[var(--text-muted)] text-center mt-3">Так будет выглядеть ваш титул</p>
    </div>
  );
}

function ChatThemePreview({ item }) {
  const css = item.cssData || {};
  return (
    <div className="py-2">
      <div
        className="rounded-2xl overflow-hidden h-48 relative"
        style={{
          background: css.bg || "var(--bg-surface)",
          backgroundSize: css.bgSize || "auto",
        }}
      >
        {/* Incoming */}
        <div className="absolute top-4 left-4 max-w-[60%]">
          <div
            className="rounded-2xl rounded-bl-sm px-3 py-2 text-xs"
            style={css.dark
              ? { backgroundColor: "rgba(255,255,255,0.12)", color: "#e2e8f0" }
              : { backgroundColor: "var(--bg-elevated)", color: "var(--text-primary)" }
            }
          >
            Привет! Как прогулка? 🚶
          </div>
          <p className="text-xs mt-0.5 ml-1" style={{ color: css.dark ? "rgba(226,232,240,0.4)" : "var(--text-muted)" }}>
            12:30
          </p>
        </div>
        {/* Outgoing */}
        <div className="absolute top-[70px] right-4 max-w-[60%]">
          <div
            className="rounded-2xl rounded-br-sm px-3 py-2 text-xs"
            style={{ backgroundColor: css.bubble, color: css.bubbleText }}
          >
            Отлично, прошёл 5 км! 💪
          </div>
          <p className="text-xs mt-0.5 mr-1 text-right" style={{ color: css.dark ? "rgba(226,232,240,0.4)" : "var(--text-muted)" }}>
            12:31 ✓
          </p>
        </div>
        {/* Another incoming */}
        <div className="absolute bottom-4 left-4 max-w-[55%]">
          <div
            className="rounded-2xl rounded-bl-sm px-3 py-2 text-xs"
            style={css.dark
              ? { backgroundColor: "rgba(255,255,255,0.12)", color: "#e2e8f0" }
              : { backgroundColor: "var(--bg-elevated)", color: "var(--text-primary)" }
            }
          >
            Красота! 🔥
          </div>
        </div>
      </div>
      <p className="text-xs text-[var(--text-muted)] text-center mt-3">Так будет выглядеть ваш чат</p>
    </div>
  );
}

function BannerPreview({ item, user }) {
  return (
    <div className="py-4">
      <div className="rounded-2xl overflow-hidden bg-[var(--bg-elevated)]">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt="" className="w-full h-24 object-cover" />
        ) : (
          <div className="w-full h-24" style={{ background: item.cssData?.bg || "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }} />
        )}
        <div className="px-4 py-3 flex items-center gap-3 -mt-6">
          <UserAvatar
            username={user?.username || "User"}
            avatarUrl={user?.avatarUrl}
            size="lg"
            equippedItems={user?.equippedItems}
          />
          <div className="pt-4">
            <p className="text-sm font-bold text-[var(--text-primary)]">{user?.username || "Пользователь"}</p>
            <p className="text-xs text-[var(--text-muted)]">{user?.bio || "Участник"}</p>
          </div>
        </div>
      </div>
      <p className="text-xs text-[var(--text-muted)] text-center mt-3">Так будет выглядеть ваш баннер профиля</p>
    </div>
  );
}

function AppThemePreview({ item }) {
  const css = item.cssData || {};
  return (
    <div className="py-2">
      <div className="rounded-2xl overflow-hidden h-48 relative" style={{ backgroundColor: css["--bg-main"] || "#2a2a2a" }}>
        {/* Header */}
        <div className="h-8 px-3 flex items-center" style={{ backgroundColor: css["--bg-header"] || "#1e1e1e" }}>
          <div className="w-16 h-2.5 rounded-full" style={{ backgroundColor: css["--text-primary"] || "#fff", opacity: 0.8 }} />
        </div>
        {/* Content */}
        <div className="px-3 pt-2 space-y-2">
          {/* Card 1 */}
          <div className="rounded-xl p-2.5" style={{ backgroundColor: css["--bg-surface"] || "#353535" }}>
            <div className="w-[70%] h-2.5 rounded mb-1.5" style={{ backgroundColor: css["--text-primary"] || "#fff", opacity: 0.8 }} />
            <div className="w-[50%] h-2 rounded mb-1" style={{ backgroundColor: css["--text-secondary"] || "#b0b0b0", opacity: 0.6 }} />
            <div className="w-[30%] h-1.5 rounded" style={{ backgroundColor: css["--text-muted"] || "#808080", opacity: 0.5 }} />
          </div>
          {/* Card 2 */}
          <div className="rounded-xl p-2.5" style={{ backgroundColor: css["--bg-surface"] || "#353535" }}>
            <div className="w-[55%] h-2.5 rounded mb-1.5" style={{ backgroundColor: css["--text-primary"] || "#fff", opacity: 0.8 }} />
            <div className="w-[40%] h-2 rounded" style={{ backgroundColor: css["--text-secondary"] || "#b0b0b0", opacity: 0.6 }} />
          </div>
          {/* Bottom bar */}
          <div className="absolute bottom-0 left-0 right-0 h-7 flex items-center justify-around px-6" style={{ backgroundColor: css["--bg-surface"] || "#353535", borderTop: `1px solid ${css["--border-color"] || "#4a4a4a"}` }}>
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: css["--text-muted"] || "#808080", opacity: 0.5 }} />
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: css["--text-muted"] || "#808080", opacity: 0.5 }} />
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: css["--text-muted"] || "#808080", opacity: 0.5 }} />
          </div>
        </div>
      </div>
      <p className="text-xs text-[var(--text-muted)] text-center mt-3">Так будет выглядеть приложение</p>
    </div>
  );
}

function GenericPreview({ item }) {
  return (
    <div className="aspect-video rounded-xl bg-[var(--bg-elevated)] flex items-center justify-center overflow-hidden">
      {item.imageUrl ? (
        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
      ) : (
        <span className="text-5xl">🎁</span>
      )}
    </div>
  );
}

export default function ShopItemModal({ item, owned, equipped, routiks, user, onBuy, onEquip, onUnequip, onClose }) {
  const [showPreview, setShowPreview] = useState(false);

  if (!item) return null;

  const rarity = RARITY_COLORS[item.rarity] || RARITY_COLORS.common;
  const canBuy = !owned && routiks >= item.price;

  const renderPreview = () => {
    switch (item.category) {
      case "frame": return <FramePreview item={item} user={user} />;
      case "usernameColor": return <UsernameColorPreview item={item} user={user} />;
      case "title": return <TitlePreview item={item} user={user} />;
      case "chatTheme": return <ChatThemePreview item={item} />;
      case "banner": return <BannerPreview item={item} user={user} />;
      case "appTheme": return <AppThemePreview item={item} />;
      default: return <GenericPreview item={item} />;
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-md mx-4 rounded-t-3xl sm:rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-[var(--shadow-lg)] overflow-hidden animate-slide-up max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-[var(--text-primary)]">{item.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${rarity.bg} ${rarity.text}`}>
                {rarity.label}
              </span>
              <span className="text-xs text-[var(--text-muted)]">{CATEGORY_LABELS[item.category] || item.category}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Preview area */}
        <div className="px-5">
          {showPreview ? (
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-main)] overflow-hidden">
              {renderPreview()}
            </div>
          ) : (
            <div className={`aspect-[3/2] rounded-2xl bg-[var(--bg-elevated)] border ${rarity.border} flex items-center justify-center overflow-hidden`}>
              {renderCardPreview(item)}
            </div>
          )}

          {/* Preview toggle */}
          <button
            onClick={() => setShowPreview((v) => !v)}
            className="flex items-center justify-center gap-1.5 w-full mt-2 mb-1 py-2 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition"
          >
            <Eye className="h-3.5 w-3.5" />
            {showPreview ? "Скрыть предпросмотр" : "Предпросмотр"}
          </button>
        </div>

        {/* Description */}
        {item.description && (
          <p className="px-5 py-2 text-sm text-[var(--text-secondary)]">{item.description}</p>
        )}

        {/* Actions */}
        <div className="px-5 pb-5 pt-2">
          {owned ? (
            <div className="flex gap-2">
              {equipped ? (
                <button
                  onClick={() => onUnequip(item.id)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-[var(--bg-elevated)] text-sm font-medium text-[var(--text-primary)] transition hover:bg-[var(--border-color)]"
                >
                  <Minus className="h-4 w-4" />
                  Снять
                </button>
              ) : (
                <button
                  onClick={() => onEquip(item.id)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-green-600 text-sm font-medium text-white transition hover:bg-green-500"
                >
                  <Check className="h-4 w-4" />
                  Надеть
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => canBuy && onBuy(item.id)}
              disabled={!canBuy}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-blue-600 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ShoppingCart className="h-4 w-4" />
              <span>Купить за 🔷 {item.price}</span>
            </button>
          )}
          {!canBuy && !owned && (
            <p className="text-xs text-center mt-1.5 text-[var(--text-muted)]">Недостаточно маршрутиков</p>
          )}
        </div>
      </div>
    </div>
  );
}

function renderCardPreview(item) {
  if (item.imageUrl) {
    return <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />;
  }
  if (item.category === "chatTheme" && item.cssData?.bubble) {
    const css = item.cssData;
    return (
      <div className="w-full h-full relative" style={{
        background: css.bg || "var(--bg-surface)",
        backgroundSize: css.bgSize || "auto",
      }}>
        <div className="absolute top-3 left-4 rounded-lg rounded-bl-sm px-2.5 py-1 text-xs"
          style={css.dark
            ? { backgroundColor: "rgba(255,255,255,0.12)", color: "#e2e8f0" }
            : { backgroundColor: "var(--bg-elevated)", color: "var(--text-primary)" }
          }>Привет!</div>
        <div className="absolute bottom-3 right-4 rounded-lg rounded-br-sm px-2.5 py-1 text-xs"
          style={{ backgroundColor: css.bubble, color: css.bubbleText }}>Как дела?</div>
      </div>
    );
  }
  if (item.category === "appTheme" && item.cssData?.["--bg-main"]) {
    const css = item.cssData;
    return (
      <div className="w-full h-full relative" style={{ backgroundColor: css["--bg-main"] }}>
        <div className="absolute top-2 left-2 right-2 h-3 rounded-full" style={{ backgroundColor: css["--bg-header"] }} />
        <div className="absolute top-7 left-2 right-2 bottom-2 rounded-lg" style={{ backgroundColor: css["--bg-surface"] }}>
          <div className="absolute top-2 left-2 w-[60%] h-2 rounded" style={{ backgroundColor: css["--text-primary"], opacity: 0.7 }} />
          <div className="absolute top-5 left-2 w-[40%] h-1.5 rounded" style={{ backgroundColor: css["--text-secondary"], opacity: 0.5 }} />
        </div>
      </div>
    );
  }
  if (item.category === "usernameColor" && item.cssData?.color) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="h-12 w-12 rounded-full bg-[var(--bg-surface)] flex items-center justify-center text-xl">👤</div>
        <span className="text-base font-bold" style={{ color: item.cssData.color }}>Пользователь</span>
      </div>
    );
  }
  if (item.category === "title" && item.cssData?.text) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="h-12 w-12 rounded-full bg-[var(--bg-surface)] flex items-center justify-center text-xl">👤</div>
        <span className="text-sm font-bold" style={{ color: item.cssData?.color || "var(--text-primary)" }}>{item.cssData.text}</span>
      </div>
    );
  }
  if (item.category === "frame" && (item.cssData?.gradient || item.cssData?.borderColor)) {
    const gradient = item.cssData.gradient || item.cssData.borderColor;
    const anim = item.cssData.animation;
    if (anim === "spin") {
      return (
        <div className="relative h-20 w-20">
          <div className="absolute inset-0 rounded-full animate-frame-spin" style={{ background: gradient }} />
          <div className="absolute inset-[4px] rounded-full bg-[var(--bg-elevated)] flex items-center justify-center">
            <span className="text-2xl">👤</span>
          </div>
        </div>
      );
    }
    const animClass =
      anim === "pulse" ? "animate-frame-pulse" :
      anim === "rainbow" ? "animate-frame-rainbow" : "";
    return (
      <div className={`h-20 w-20 rounded-full p-[4px] ${animClass}`} style={{ background: gradient }}>
        <div className="w-full h-full rounded-full bg-[var(--bg-elevated)] flex items-center justify-center">
          <span className="text-2xl">👤</span>
        </div>
      </div>
    );
  }
  return <span className="text-5xl">🎁</span>;
}
