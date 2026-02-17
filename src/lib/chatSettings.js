export function isChatMuted(key) {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(`chat-muted-${key}`) === "1";
}

export function setChatMuted(key, muted) {
  if (typeof window === "undefined") return;
  if (muted) {
    localStorage.setItem(`chat-muted-${key}`, "1");
  } else {
    localStorage.removeItem(`chat-muted-${key}`);
  }
}

export function getChatFontSize(key) {
  if (typeof window === "undefined") return "base";
  return localStorage.getItem(`chat-fontsize-${key}`) || "base";
}

export function setChatFontSize(key, size) {
  if (typeof window === "undefined") return;
  if (size === "base") {
    localStorage.removeItem(`chat-fontsize-${key}`);
  } else {
    localStorage.setItem(`chat-fontsize-${key}`, size);
  }
}
