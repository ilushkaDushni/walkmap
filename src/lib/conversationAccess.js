// Утилиты для admin-диалогов (conversationKey формата "admin_{userId}")

export function isAdminConversationKey(key) {
  return key.startsWith("admin_");
}

export function getTargetUserIdFromAdminKey(key) {
  return key.replace("admin_", "");
}
