"use client";

import { Ban } from "lucide-react";
import { useUser } from "./UserProvider";

export default function BanModal() {
  const { isBanned, bannedUsername, logout } = useUser();

  if (!isBanned) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-md">
      <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
          <Ban className="h-8 w-8 text-red-500" />
        </div>
        <h2 className="mb-2 text-xl font-bold text-gray-900">
          Аккаунт заблокирован
        </h2>
        <p className="mb-6 text-sm text-gray-500">
          {bannedUsername
            ? <><span className="font-semibold text-gray-700">{bannedUsername}</span>, ваш аккаунт находится в блокировке</>
            : "Ваш аккаунт был заблокирован администратором"
          }
        </p>
        <button
          onClick={logout}
          className="w-full rounded-xl bg-red-500 px-4 py-3 font-medium text-white transition-colors hover:bg-red-600"
        >
          Выйти
        </button>
      </div>
    </div>
  );
}
