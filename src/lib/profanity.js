import { getDb } from "./mongodb";
import { getAllRoles, isSuperadmin } from "./permissions";
import { createAndPushNotification } from "./notifications";

// ─── Словарь основ (stems) ─────────────────────────────────────
const RU_STEMS = [
  "хуй", "хуе", "хуё", "хуи", "хуя", "хул",
  "пизд", "пезд",
  "бляд", "блят", "бляк",
  "ебат", "ебан", "ебал", "ебаш", "ебну", "ебёт", "ебло", "ебук", "ёбан", "ёбат",
  "сука", "сучк", "сучар",
  "мудак", "мудач", "мудил",
  "пидор", "пидар", "пидр",
  "шлюх", "шалав",
  "гондон", "гандон",
  "залуп", "манд", "елд",
  "дроч", "драчк",
  "жоп", // только с контекстом ниже — короткие
  "нахуй", "нахер", "похуй", "охуе", "охуё", "отъеб", "заеб", "заёб", "выеб", "уёб", "доеб", "съеб",
];

const EN_STEMS = [
  "fuck", "fck", "fuсk",
  "shit", "sh1t",
  "bitch", "b1tch",
  "cunt",
  "nigger", "nigg", "n1gg",
  "asshole", "asshol",
  "dick", "d1ck",
  "pussy",
  "whore",
  "bastard",
  "motherfuck",
  "cocksucker",
  "faggot", "fag",
];

// Минимальная длина основ для предотвращения ложных срабатываний
const ALL_STEMS = [...RU_STEMS, ...EN_STEMS].filter((s) => s.length >= 3);

// ─── Leet-speak замены ─────────────────────────────────────────
const LEET_MAP = {
  "@": "а", "4": "а", "a": "а",
  "6": "б", "b": "б",
  "e": "е", "3": "з",
  "0": "о", "o": "о",
  "$": "с", "c": "с",
  "y": "у", "u": "у",
  "x": "х", "h": "х",
  "k": "к",
  "1": "и", "i": "и",
  "d": "д",
  "p": "р",
  "n": "н",
  "m": "м",
  "l": "л",
  "t": "т",
};

// ─── Нормализация текста ───────────────────────────────────────
function normalize(text) {
  let s = text.toLowerCase();
  // Убираем всё кроме букв (кириллица + латиница + цифры для leet)
  // Сначала делаем leet-замены
  let result = "";
  for (const ch of s) {
    result += LEET_MAP[ch] || ch;
  }
  // Убираем всё кроме кириллицы и латиницы
  result = result.replace(/[^а-яёa-z]/g, "");
  return result;
}

// ─── Проверка мата ─────────────────────────────────────────────

/**
 * @param {string} text
 * @returns {{ hasProfanity: boolean, matchedWords: string[] }}
 */
export function checkProfanity(text) {
  const normalized = normalize(text);
  const matched = [];

  for (const stem of ALL_STEMS) {
    const normalizedStem = normalize(stem);
    if (normalized.includes(normalizedStem)) {
      matched.push(stem);
    }
  }

  return { hasProfanity: matched.length > 0, matchedWords: matched };
}

// ─── Антифлуд ──────────────────────────────────────────────────

const floodMap = new Map(); // userId → timestamp

// Автоочистка каждые 5 минут
setInterval(() => {
  const cutoff = Date.now() - 60_000;
  for (const [key, ts] of floodMap) {
    if (ts < cutoff) floodMap.delete(key);
  }
}, 5 * 60_000);

/**
 * @param {string} userId
 * @param {number} cooldownMs — кулдаун в мс (по умолчанию 20 сек)
 * @returns {{ isFlooding: boolean, retryAfterMs: number }}
 */
export function checkFlood(userId, cooldownMs = 20_000) {
  const now = Date.now();
  const lastTime = floodMap.get(userId);

  if (lastTime && now - lastTime < cooldownMs) {
    const retryAfterMs = cooldownMs - (now - lastTime);
    return { isFlooding: true, retryAfterMs };
  }

  // Записываем только при отсутствии флуда (timestamp = момент успешной попытки)
  floodMap.set(userId, now);
  return { isFlooding: false, retryAfterMs: 0 };
}

// ─── Авто-предупреждение (admin-чат) ─────────────────────────────

const violationCounts = new Map(); // userId → count

// Автоочистка счётчиков каждые 30 минут
setInterval(() => {
  violationCounts.clear();
}, 30 * 60_000);

/**
 * Отправляет автоматическое предупреждение пользователю через admin-чат
 * @param {string} userId
 * @param {string} reason — "Нецензурная лексика" / "Флуд (слишком частые сообщения)"
 * @param {string} [details] — текст нарушения (обрезается до 100 символов)
 */
export async function sendAutoWarning(userId, reason, details = "") {
  try {
    const count = (violationCounts.get(userId) || 0) + 1;
    violationCounts.set(userId, count);

    const truncated = details.length > 100 ? details.slice(0, 100) + "…" : details;

    const warningText =
      `⚠️ АВТОМАТИЧЕСКОЕ ПРЕДУПРЕЖДЕНИЕ\n\n` +
      `Причина: ${reason}\n` +
      (truncated ? `Текст: «${truncated}»\n\n` : "\n") +
      `Предупреждение ${count} из 5. При 5 нарушениях — бан.`;

    const conversationKey = `admin_${userId}`;
    const db = await getDb();

    await db.collection("messages").insertOne({
      conversationKey,
      senderId: userId,
      senderUsername: "Система",
      text: warningText,
      type: "admin",
      routeId: null,
      replyToId: null,
      reactions: [],
      deletedFor: [],
      createdAt: new Date(),
      readAt: null,
    });

    // Notification + SSE для тоста
    const notifData = {
      type: "admin_message",
      username: "Администрация",
      text: warningText.slice(0, 100),
      conversationKey,
      userId,
    };
    await createAndPushNotification(userId, "admin_message", notifData);
  } catch (err) {
    console.error("[profanity] Failed to send auto warning:", err);
  }
}

// ─── Уведомление модераторам ───────────────────────────────────

/**
 * Fire-and-forget: уведомляет всех с правом comments.manage + суперадмина
 */
export async function notifyModeratorsAboutViolation({ userId, username, text, routeId, routeTitle }) {
  try {
    const db = await getDb();
    const allRoles = await getAllRoles();

    // Роли с правом comments.manage
    const modRoleIds = allRoles
      .filter((r) => r.permissions?.includes("comments.manage"))
      .map((r) => r._id);

    // Юзеры с этими ролями
    const query = {};
    const conditions = [];

    if (modRoleIds.length > 0) {
      conditions.push({ roles: { $in: modRoleIds } });
    }
    if (process.env.SUPERADMIN_EMAIL) {
      conditions.push({ email: process.env.SUPERADMIN_EMAIL });
    }

    if (conditions.length === 0) return;

    query.$or = conditions;
    const moderators = await db.collection("users").find(query, { projection: { _id: 1 } }).toArray();

    const truncatedText = text.length > 200 ? text.slice(0, 200) + "…" : text;

    const notifData = {
      type: "profanity_alert",
      violatorId: userId,
      username,
      text: truncatedText,
      routeId,
      routeTitle: routeTitle || "",
    };

    for (const mod of moderators) {
      const modId = mod._id.toString();
      // Не уведомляем самого нарушителя (если вдруг он модератор)
      if (modId === userId) continue;

      await createAndPushNotification(modId, "profanity_alert", notifData);
    }
  } catch (err) {
    console.error("[profanity] Failed to notify moderators:", err);
  }
}
