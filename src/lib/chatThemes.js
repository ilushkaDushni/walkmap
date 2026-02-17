export const CHAT_THEMES = [
  {
    id: "default",
    name: "Зелёный",
    bubble: "#22c55e",
    bubbleText: "#ffffff",
    accent: "#22c55e",
    bg: "linear-gradient(135deg, rgba(34,197,94,0.05) 0%, transparent 100%)",
  },
  {
    id: "blue",
    name: "Синий",
    bubble: "#3b82f6",
    bubbleText: "#ffffff",
    accent: "#3b82f6",
    bg: "linear-gradient(135deg, rgba(59,130,246,0.06) 0%, rgba(59,130,246,0.02) 100%)",
  },
  {
    id: "purple",
    name: "Фиолетовый",
    bubble: "#8b5cf6",
    bubbleText: "#ffffff",
    accent: "#8b5cf6",
    bg: "linear-gradient(135deg, rgba(139,92,246,0.06) 0%, rgba(139,92,246,0.02) 100%)",
  },
  {
    id: "pink",
    name: "Розовый",
    bubble: "#ec4899",
    bubbleText: "#ffffff",
    accent: "#ec4899",
    bg: "linear-gradient(135deg, rgba(236,72,153,0.06) 0%, rgba(236,72,153,0.02) 100%)",
  },
  {
    id: "orange",
    name: "Оранжевый",
    bubble: "#f97316",
    bubbleText: "#ffffff",
    accent: "#f97316",
    bg: "linear-gradient(135deg, rgba(249,115,22,0.06) 0%, rgba(249,115,22,0.02) 100%)",
  },
  {
    id: "red",
    name: "Красный",
    bubble: "#ef4444",
    bubbleText: "#ffffff",
    accent: "#ef4444",
    bg: "linear-gradient(135deg, rgba(239,68,68,0.06) 0%, rgba(239,68,68,0.02) 100%)",
  },
  {
    id: "teal",
    name: "Бирюзовый",
    bubble: "#14b8a6",
    bubbleText: "#ffffff",
    accent: "#14b8a6",
    bg: "linear-gradient(135deg, rgba(20,184,166,0.06) 0%, rgba(20,184,166,0.02) 100%)",
  },
  {
    id: "dots",
    name: "Точки",
    bubble: "#6366f1",
    bubbleText: "#ffffff",
    accent: "#6366f1",
    bg: "radial-gradient(circle, rgba(99,102,241,0.15) 0.5px, transparent 0.5px)",
    bgSize: "12px 12px",
  },
  {
    id: "gradient",
    name: "Градиент",
    bubble: "#a855f7",
    bubbleText: "#ffffff",
    accent: "#a855f7",
    bg: "linear-gradient(160deg, #0f172a 0%, #1e1b4b 40%, #312e81 70%, #4c1d95 100%)",
    dark: true,
  },
];

export function getChatTheme(conversationKey) {
  if (typeof window === "undefined") return CHAT_THEMES[0];
  const id = localStorage.getItem(`chat-theme-${conversationKey}`);
  return CHAT_THEMES.find((t) => t.id === id) || CHAT_THEMES[0];
}

export function setChatTheme(conversationKey, themeId) {
  if (typeof window === "undefined") return;
  localStorage.setItem(`chat-theme-${conversationKey}`, themeId);
}
