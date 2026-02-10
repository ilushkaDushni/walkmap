"use client";

import { useState } from "react";
import { useUser } from "@/components/UserProvider";
import RouteCard from "@/components/RouteCard";
import { LogIn, MapPin } from "lucide-react";

export default function RoutesListClient({ routes: initialRoutes }) {
  const { user, authFetch, hasPermission } = useUser();
  const isAdmin = hasPermission("routes.view_hidden");
  const [routes, setRoutes] = useState(initialRoutes);

  // Если пользователь не авторизован — показать приглашение зарегистрироваться
  if (!user) {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/10">
          <MapPin className="h-8 w-8 text-green-500" />
        </div>
        <h2 className="text-lg font-bold text-[var(--text-primary)]">Войдите, чтобы увидеть маршруты</h2>
        <p className="mt-2 text-sm text-[var(--text-muted)] max-w-xs">
          Зарегистрируйтесь или войдите в аккаунт, чтобы просматривать и проходить маршруты
        </p>
        <button
          onClick={() => window.dispatchEvent(new Event("open-profile-modal"))}
          className="mt-6 flex items-center gap-2 rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-green-500/20 transition hover:shadow-green-500/30 active:scale-[0.98]"
        >
          <LogIn className="h-4 w-4" />
          Войти / Зарегистрироваться
        </button>
      </div>
    );
  }

  const visible = isAdmin ? routes : routes.filter((r) => !r._hidden);
  const published = visible.filter((r) => !r._hidden);
  const hidden = visible.filter((r) => r._hidden);

  const handleToggleHidden = async (routeId, hide) => {
    // Оптимистичное обновление
    setRoutes((prev) =>
      prev.map((r) =>
        r._id === routeId ? { ...r, adminOnly: hide, _hidden: hide } : r
      )
    );
    const res = await authFetch(`/api/routes/${routeId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminOnly: hide }),
    });
    if (!res.ok) {
      // Откат при ошибке
      setRoutes((prev) =>
        prev.map((r) =>
          r._id === routeId ? { ...r, adminOnly: !hide, _hidden: !hide } : r
        )
      );
    }
  };

  if (visible.length === 0) return null;

  return (
    <div className="grid gap-4 pb-24">
      {published.map((route) => (
        <RouteCard
          key={route._id}
          route={route}
          isAdmin={isAdmin}
          onToggleHidden={handleToggleHidden}
        />
      ))}
      {isAdmin && hidden.length > 0 && (
        <>
          <p className="text-xs text-[var(--text-muted)] mt-2">Скрытые маршруты</p>
          {hidden.map((route) => (
            <RouteCard
              key={route._id}
              route={route}
              isAdmin={isAdmin}
              onToggleHidden={handleToggleHidden}
            />
          ))}
        </>
      )}
    </div>
  );
}
