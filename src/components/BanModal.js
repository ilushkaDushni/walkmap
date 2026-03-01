"use client";

import { Ban, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useUser } from "./UserProvider";

export default function BanModal() {
  const { isBanned, bannedUsername, banReason, banExpiresAt, logout } = useUser();

  if (!isBanned) return null;

  const formatExpiry = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const expiryFormatted = formatExpiry(banExpiresAt);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-md">
      <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
          <Ban className="h-8 w-8 text-red-500" />
        </div>
        <h2 className="mb-2 text-xl font-bold text-gray-900">
          Аккаунт заблокирован
        </h2>
        <p className="mb-3 text-sm text-gray-500">
          {bannedUsername
            ? <><span className="font-semibold text-gray-700">{bannedUsername}</span>, ваш аккаунт находится в блокировке</>
            : "Ваш аккаунт был заблокирован администратором"
          }
        </p>

        {banReason && (
          <div className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-left">
            <p className="text-xs font-semibold text-red-400 mb-1">Причина</p>
            <p className="text-sm text-gray-700">{banReason}</p>
          </div>
        )}

        {expiryFormatted ? (
          <p className="mb-3 text-xs text-gray-500">
            Блокировка до: <span className="font-semibold text-gray-700">{expiryFormatted}</span>
          </p>
        ) : (
          <p className="mb-3 text-xs text-gray-500">
            Блокировка: <span className="font-semibold text-red-500">навсегда</span>
          </p>
        )}

        <Link
          href="/rules"
          className="mb-4 inline-flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-600 transition no-underline"
        >
          <ExternalLink className="h-3 w-3" />
          Правила сообщества
        </Link>

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
