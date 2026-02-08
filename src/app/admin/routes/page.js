"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/components/UserProvider";
import RouteEditor from "@/components/RouteEditor";
import { Plus, Trash2, Pencil, ArrowLeft, Eye, EyeOff } from "lucide-react";

export default function AdminRoutesPage() {
  const { user, loading, authFetch } = useUser();
  const router = useRouter();
  const [routes, setRoutes] = useState([]);
  const [editingRouteId, setEditingRouteId] = useState(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("edit");
    }
    return null;
  });
  const [loadingRoutes, setLoadingRoutes] = useState(true);

  // Редирект если не админ
  useEffect(() => {
    if (!loading && user?.role !== "admin") {
      router.replace("/");
    }
  }, [user, loading, router]);

  const fetchRoutes = useCallback(async () => {
    const res = await authFetch("/api/routes");
    if (res.ok) {
      setRoutes(await res.json());
    }
    setLoadingRoutes(false);
  }, [authFetch]);

  useEffect(() => {
    if (user?.role === "admin") fetchRoutes();
  }, [user, fetchRoutes]);

  const handleCreate = async () => {
    const res = await authFetch("/api/routes", { method: "POST" });
    if (res.ok) {
      const route = await res.json();
      setEditingRouteId(route._id);
      fetchRoutes();
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Удалить маршрут? Это действие необратимо.")) return;
    const res = await authFetch(`/api/routes/${id}`, { method: "DELETE" });
    if (res.ok) {
      if (editingRouteId === id) setEditingRouteId(null);
      fetchRoutes();
    }
  };

  const handleSaved = () => {
    fetchRoutes();
  };

  if (loading || user?.role !== "admin") return null;

  // Режим редактирования
  if (editingRouteId) {
    return (
      <div className="mx-auto max-w-4xl px-4 pt-4 pb-24">
        <button
          onClick={() => setEditingRouteId(null)}
          className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition"
        >
          <ArrowLeft className="h-4 w-4" />
          К списку маршрутов
        </button>
        <RouteEditor routeId={editingRouteId} onSaved={handleSaved} />
      </div>
    );
  }

  // Список маршрутов
  return (
    <div className="mx-auto max-w-lg px-4 pt-4 pb-24">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Маршруты</h1>
          <p className="text-sm text-[var(--text-muted)]">Управление маршрутами</p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-green-700"
        >
          <Plus className="h-4 w-4" />
          Создать
        </button>
      </div>

      {loadingRoutes ? (
        <p className="text-sm text-[var(--text-muted)] py-8 text-center">Загрузка...</p>
      ) : routes.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)] py-8 text-center">
          Маршрутов пока нет. Создайте первый!
        </p>
      ) : (
        <div className="space-y-3">
          {routes.map((route) => (
            <div
              key={route._id}
              className="flex items-center gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 transition"
            >
              {/* Обложка */}
              <div
                className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[var(--bg-elevated)] cursor-pointer"
                onClick={() => setEditingRouteId(route._id)}
              >
                {route.coverImage ? (
                  <img src={route.coverImage} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[var(--text-muted)]">
                    <Eye className="h-5 w-5" />
                  </div>
                )}
              </div>

              {/* Инфо */}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-[var(--text-primary)]">{route.title}</p>
                <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  {route.status === "published" ? (
                    <span className="flex items-center gap-1 text-green-600">
                      <Eye className="h-3 w-3" /> Опубликован
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <EyeOff className="h-3 w-3" /> Черновик
                    </span>
                  )}
                  <span>{route.checkpoints?.length || 0} точек</span>
                  {route.distance > 0 && (
                    <span>
                      {route.distance >= 1000
                        ? `${(route.distance / 1000).toFixed(1)} км`
                        : `${route.distance} м`}
                    </span>
                  )}
                </div>
              </div>

              {/* Действия */}
              <div className="flex gap-1">
                <button
                  onClick={() => setEditingRouteId(route._id)}
                  className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-blue-500 transition"
                  title="Редактировать"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(route._id)}
                  className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-red-500 transition"
                  title="Удалить"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
