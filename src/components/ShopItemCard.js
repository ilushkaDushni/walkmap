"use client";

const RARITY_COLORS = {
  common: { border: "border-[var(--border-color)]", badge: "bg-gray-500", text: "text-gray-400", label: "Обычный" },
  rare: { border: "border-blue-500/40", badge: "bg-blue-500", text: "text-blue-400", label: "Редкий" },
  epic: { border: "border-purple-500/40", badge: "bg-purple-500", text: "text-purple-400", label: "Эпический" },
  legendary: { border: "border-amber-500/40", badge: "bg-amber-500", text: "text-amber-400", label: "Легендарный" },
};

const CATEGORY_LABELS = {
  frame: "Рамка",
  banner: "Баннер",
  title: "Титул",
  usernameColor: "Цвет ника",
  chatTheme: "Тема чата",
  appTheme: "Тема приложения",
};

function ChatThemePreview({ cssData }) {
  return (
    <div
      className="w-full h-full rounded-xl overflow-hidden relative"
      style={{
        background: cssData.bg || "var(--bg-surface)",
        backgroundSize: cssData.bgSize || "auto",
      }}
    >
      {/* Incoming bubble */}
      <div
        className="absolute top-3 left-3 rounded-lg rounded-bl-sm px-2.5 py-1 text-[10px] font-medium"
        style={cssData.dark
          ? { backgroundColor: "rgba(255,255,255,0.12)", color: "#e2e8f0" }
          : { backgroundColor: "var(--bg-elevated)", color: "var(--text-primary)" }
        }
      >
        Привет!
      </div>
      {/* Outgoing bubble */}
      <div
        className="absolute bottom-3 right-3 rounded-lg rounded-br-sm px-2.5 py-1 text-[10px] font-medium"
        style={{ backgroundColor: cssData.bubble, color: cssData.bubbleText }}
      >
        Как дела?
      </div>
    </div>
  );
}

export default function ShopItemCard({ item, owned, equipped, onClick }) {
  const rarity = RARITY_COLORS[item.rarity] || RARITY_COLORS.common;

  const renderPreview = () => {
    if (item.imageUrl) {
      return <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover rounded-xl" />;
    }
    if (item.category === "chatTheme" && item.cssData?.bubble) {
      return <ChatThemePreview cssData={item.cssData} />;
    }
    if (item.category === "usernameColor" && item.cssData?.color) {
      return (
        <div className="flex flex-col items-center gap-1.5">
          <div className="h-10 w-10 rounded-full bg-[var(--bg-surface)] flex items-center justify-center">
            <span className="text-xs font-bold text-[var(--text-muted)]">👤</span>
          </div>
          <span className="text-sm font-bold" style={{ color: item.cssData.color }}>Пользователь</span>
        </div>
      );
    }
    if (item.category === "title" && item.cssData?.text) {
      return (
        <div className="flex flex-col items-center gap-1">
          <div className="h-10 w-10 rounded-full bg-[var(--bg-surface)] flex items-center justify-center">
            <span className="text-xs font-bold text-[var(--text-muted)]">👤</span>
          </div>
          <span className="text-[11px] font-bold" style={{ color: item.cssData?.color || "var(--text-primary)" }}>{item.cssData.text}</span>
        </div>
      );
    }
    if (item.category === "frame" && (item.cssData?.gradient || item.cssData?.borderColor)) {
      const gradient = item.cssData.gradient || item.cssData.borderColor;
      const anim = item.cssData.animation;

      if (anim === "spin") {
        return (
          <div className="relative h-14 w-14">
            <div className="absolute inset-0 rounded-full animate-frame-spin" style={{ background: gradient }} />
            <div className="absolute inset-[3px] rounded-full bg-[var(--bg-elevated)] flex items-center justify-center">
              <span className="text-lg">👤</span>
            </div>
          </div>
        );
      }

      const animClass =
        anim === "pulse" ? "animate-frame-pulse" :
        anim === "rainbow" ? "animate-frame-rainbow" : "";
      return (
        <div className={`h-14 w-14 rounded-full p-[3px] ${animClass}`} style={{ background: gradient }}>
          <div className="w-full h-full rounded-full bg-[var(--bg-elevated)] flex items-center justify-center">
            <span className="text-lg">👤</span>
          </div>
        </div>
      );
    }
    return <span className="text-3xl">🎁</span>;
  };

  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col rounded-2xl border bg-[var(--bg-surface)] p-2.5 transition hover:bg-[var(--bg-elevated)] text-left w-full ${rarity.border}`}
    >
      {/* Rarity badge */}
      <span className={`absolute top-1.5 right-1.5 z-[1] px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white ${rarity.badge}`}>
        {rarity.label}
      </span>

      {/* Preview */}
      <div className="w-full aspect-[4/3] rounded-xl bg-[var(--bg-elevated)] mb-2 flex items-center justify-center overflow-hidden">
        {renderPreview()}
      </div>

      {/* Info */}
      <p className="text-xs font-semibold text-[var(--text-primary)] truncate leading-tight">{item.name}</p>
      <p className="text-[10px] text-[var(--text-muted)] mb-1.5">{CATEGORY_LABELS[item.category] || item.category}</p>

      {/* Price / Status */}
      {owned ? (
        <span className={`text-[10px] font-medium ${equipped ? "text-green-500" : "text-[var(--text-muted)]"}`}>
          {equipped ? "Надето" : "В инвентаре"}
        </span>
      ) : (
        <div className="flex items-center gap-1">
          <span className="text-[10px]">🔷</span>
          <span className="text-xs font-bold text-[var(--text-primary)]">{item.price}</span>
        </div>
      )}
    </button>
  );
}
