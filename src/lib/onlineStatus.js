export function isOnline(lastActivityAt) {
  if (!lastActivityAt) return false;
  const diff = Date.now() - new Date(lastActivityAt).getTime();
  return diff < 5 * 60 * 1000; // 5 минут
}

export function formatLastSeen(lastActivityAt) {
  if (!lastActivityAt) return "был(а) давно";

  const diff = Date.now() - new Date(lastActivityAt).getTime();

  if (diff < 5 * 60 * 1000) return "в сети";

  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `был(а) ${minutes} мин. назад`;

  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `был(а) ${hours} ч. назад`;

  const days = Math.floor(diff / 86400000);
  if (days < 30) return `был(а) ${days} дн. назад`;

  return "был(а) давно";
}
