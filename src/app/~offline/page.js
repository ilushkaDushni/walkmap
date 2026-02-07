"use client";

import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-[var(--bg-elevated)]">
          <WifiOff className="h-12 w-12 text-[var(--text-muted)]" />
        </div>
        <h1 className="mb-2 text-2xl font-bold text-[var(--text-primary)]">Нет подключения</h1>
        <p className="mb-6 text-[var(--text-muted)]">
          Проверьте интернет-соединение и попробуйте снова.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg bg-green-600 px-6 py-3 text-white transition hover:bg-green-700"
        >
          Повторить
        </button>
      </div>
    </div>
  );
}
