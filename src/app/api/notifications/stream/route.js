import { getDb } from "@/lib/mongodb";
import { subscribe, unsubscribe } from "@/lib/sse";

export const dynamic = "force-dynamic";

export async function GET(request) {
  // Auth через refresh token cookie (EventSource не поддерживает заголовки)
  const cookieHeader = request.cookies.get("refreshToken");
  const token = cookieHeader?.value;

  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }

  const db = await getDb();
  const stored = await db.collection("refresh_tokens").findOne({
    token,
    expiresAt: { $gt: new Date() },
  });

  if (!stored) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = stored.userId;

  const stream = new ReadableStream({
    start(controller) {
      // Отправляем начальное событие
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(": connected\n\n"));

      subscribe(userId, controller);

      // Keepalive каждые 30с
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          clearInterval(keepalive);
        }
      }, 30_000);

      // Слушаем отключение клиента
      request.signal.addEventListener("abort", () => {
        clearInterval(keepalive);
        unsubscribe(userId, controller);
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
