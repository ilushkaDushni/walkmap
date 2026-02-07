"use client";

import { useUser } from "@/components/UserProvider";

export default function HomePage() {
  const { user } = useUser();

  return (
    <div className="flex flex-col items-center justify-center px-6 pt-20 text-center">
      <h1 className="mb-2 text-2xl font-bold text-[var(--text-primary)]">
        {user ? `Добро пожаловать, ${user.username}` : "Добро пожаловать"}
      </h1>
      <p className="text-sm text-[var(--text-muted)]">
        Выберите раздел в меню ниже
      </p>
    </div>
  );
}
