// In-memory SSE pub/sub для уведомлений
// Работает в рамках одного процесса (подходит для pm2 single-instance)

const clients = new Map(); // userId → Set<ReadableStreamController>

export function subscribe(userId, controller) {
  if (!clients.has(userId)) {
    clients.set(userId, new Set());
  }
  clients.get(userId).add(controller);
}

export function unsubscribe(userId, controller) {
  const set = clients.get(userId);
  if (!set) return;
  set.delete(controller);
  if (set.size === 0) {
    clients.delete(userId);
  }
}

export function pushNotification(userId, data) {
  const set = clients.get(userId);
  if (!set || set.size === 0) return;

  const payload = `data: ${JSON.stringify(data)}\n\n`;
  const encoder = new TextEncoder();
  const encoded = encoder.encode(payload);

  for (const controller of set) {
    try {
      controller.enqueue(encoded);
    } catch {
      // Клиент отключился — уберём при следующем unsubscribe
    }
  }
}
