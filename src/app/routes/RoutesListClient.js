"use client";

import { useState } from "react";
import { useUser } from "@/components/UserProvider";
import RouteCard from "@/components/RouteCard";

export default function RoutesListClient({ routes: initialRoutes }) {
  const { user, authFetch } = useUser();
  const isAdmin = user?.role === "admin" || user?.role === "moderator";
  const [routes, setRoutes] = useState(initialRoutes);

  const visible = isAdmin ? routes : routes.filter((r) => !r._hidden);

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
      {visible.map((route) => (
        <RouteCard
          key={route._id}
          route={route}
          isAdmin={isAdmin}
          onToggleHidden={handleToggleHidden}
        />
      ))}
    </div>
  );
}
