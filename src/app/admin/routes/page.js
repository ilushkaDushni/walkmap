"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/components/UserProvider";
import RouteEditor from "@/components/RouteEditor";
import {
  Plus,
  Trash2,
  Pencil,
  ArrowLeft,
  Eye,
  EyeOff,
  FolderPlus,
  Folder,
  X,
  ChevronDown,
  EllipsisVertical,
  ShieldOff,
  Shield,
} from "lucide-react";

// Хелпер: получить folderIds из маршрута (совместимость со старым folderId)
function getFolderIds(route) {
  if (Array.isArray(route.folderIds)) return route.folderIds;
  if (route.folderId) return [route.folderId];
  return [];
}

export default function AdminRoutesPage() {
  const { user, loading, authFetch } = useUser();
  const router = useRouter();
  const [routes, setRoutes] = useState([]);
  const [folders, setFolders] = useState([]);
  const [editingRouteId, setEditingRouteId] = useState(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("edit");
    }
    return null;
  });
  const [loadingData, setLoadingData] = useState(true);
  const [settingsFolder, setSettingsFolder] = useState(null);

  useEffect(() => {
    if (!loading && user?.role !== "admin" && user?.role !== "moderator") {
      router.replace("/");
    }
  }, [user, loading, router]);

  const fetchData = useCallback(async () => {
    const [rRes, fRes] = await Promise.all([
      authFetch("/api/routes"),
      authFetch("/api/folders"),
    ]);
    if (rRes.ok) setRoutes(await rRes.json());
    if (fRes.ok) setFolders(await fRes.json());
    setLoadingData(false);
  }, [authFetch]);

  useEffect(() => {
    if (user?.role === "admin" || user?.role === "moderator") fetchData();
  }, [user, fetchData]);

  const handleCreate = async () => {
    const res = await authFetch("/api/routes", { method: "POST" });
    if (res.ok) {
      const route = await res.json();
      setEditingRouteId(route._id);
      fetchData();
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Удалить маршрут? Это действие необратимо.")) return;
    const res = await authFetch(`/api/routes/${id}`, { method: "DELETE" });
    if (res.ok) {
      if (editingRouteId === id) setEditingRouteId(null);
      fetchData();
    }
  };

  const handleRouteField = async (id, field, value) => {
    const res = await authFetch(`/api/routes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    if (res.ok) fetchData();
  };

  const handleCreateFolder = async () => {
    const name = prompt("Название папки:");
    if (!name?.trim()) return;
    const res = await authFetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) fetchData();
  };

  const handleFolderField = async (id, field, value) => {
    const res = await authFetch(`/api/folders/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    if (res.ok) fetchData();
  };

  const handleFolderUpdate = async (id, data) => {
    const res = await authFetch(`/api/folders/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) fetchData();
  };

  const handleDeleteFolder = async (id) => {
    if (!confirm("Удалить папку? Маршруты останутся без папки.")) return;
    const res = await authFetch(`/api/folders/${id}`, { method: "DELETE" });
    if (res.ok) fetchData();
  };

  const handleSaved = () => fetchData();

  if (loading || user?.role !== "admin" && user?.role !== "moderator") return null;

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

  // Группировка: маршрут может быть в нескольких папках
  const routesByFolder = {};
  for (const f of folders) {
    routesByFolder[f._id] = [];
  }
  const unfiled = [];
  for (const r of routes) {
    const fids = getFolderIds(r);
    if (fids.length === 0) {
      unfiled.push(r);
    } else {
      for (const fid of fids) {
        if (routesByFolder[fid]) routesByFolder[fid].push(r);
      }
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-4 pb-24">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Маршруты</h1>
          <p className="text-sm text-[var(--text-muted)]">Управление маршрутами</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCreateFolder}
            className="flex items-center gap-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-color)] px-3 py-2.5 text-sm font-medium text-[var(--text-primary)] transition hover:bg-[var(--bg-surface)]"
          >
            <FolderPlus className="h-4 w-4" />
            Папка
          </button>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-green-700"
          >
            <Plus className="h-4 w-4" />
            Создать
          </button>
        </div>
      </div>

      {loadingData ? (
        <p className="text-sm text-[var(--text-muted)] py-8 text-center">Загрузка...</p>
      ) : routes.length === 0 && folders.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)] py-8 text-center">
          Маршрутов пока нет. Создайте первый!
        </p>
      ) : (
        <div className="space-y-4">
          {folders.map((folder) => (
            <FolderSection
              key={folder._id}
              folder={folder}
              routes={routesByFolder[folder._id] || []}
              allFolders={folders}
              onRename={(name) => handleFolderField(folder._id, "name", name)}
              onSortOrder={(v) => handleFolderField(folder._id, "sortOrder", v)}
              onDelete={() => handleDeleteFolder(folder._id)}
              onOpenSettings={() => setSettingsFolder(folder)}
              onEditRoute={setEditingRouteId}
              onDeleteRoute={handleDelete}
              onRouteField={handleRouteField}
            />
          ))}

          {unfiled.length > 0 && (
            <div>
              {folders.length > 0 && (
                <p className="text-sm font-medium text-[var(--text-muted)] mb-2">
                  — Без папки —
                </p>
              )}
              <div className="space-y-2">
                {unfiled.map((route) => (
                  <RouteRow
                    key={route._id}
                    route={route}
                    folders={folders}
                    onEdit={() => setEditingRouteId(route._id)}
                    onDelete={() => handleDelete(route._id)}
                    onFieldChange={handleRouteField}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {settingsFolder && (
        <FolderSettingsModal
          folder={settingsFolder}
          routes={routesByFolder[settingsFolder._id] || []}
          onSave={(data) => {
            handleFolderUpdate(settingsFolder._id, data);
            setSettingsFolder(null);
          }}
          onClose={() => setSettingsFolder(null)}
        />
      )}
    </div>
  );
}

// === Модалка настроек папки ===
function FolderSettingsModal({ folder, routes, onSave, onClose }) {
  const [adminOnly, setAdminOnly] = useState(folder.adminOnly || false);
  const [exceptions, setExceptions] = useState(folder.exceptions || []);

  const toggleException = (routeId) => {
    setExceptions((prev) =>
      prev.includes(routeId) ? prev.filter((id) => id !== routeId) : [...prev, routeId]
    );
  };

  const publishedRoutes = routes.filter((r) => r.status === "published");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-[var(--text-primary)]">
            Настройки: {folder.name}
          </h3>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="flex items-center gap-3 py-3 border-b border-[var(--border-color)] cursor-pointer">
          <input
            type="checkbox"
            checked={adminOnly}
            onChange={(e) => {
              setAdminOnly(e.target.checked);
              if (!e.target.checked) setExceptions([]);
            }}
            className="h-4 w-4 rounded accent-blue-600"
          />
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">Видна только админу</p>
            <p className="text-xs text-[var(--text-muted)]">
              Опубликованные маршруты скрыты от пользователей
            </p>
          </div>
        </label>

        {adminOnly && publishedRoutes.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">
              Исключения — видны пользователям
            </p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {publishedRoutes.map((r) => (
                <label
                  key={r._id}
                  className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-[var(--bg-elevated)] cursor-pointer transition"
                >
                  <input
                    type="checkbox"
                    checked={exceptions.includes(r._id)}
                    onChange={() => toggleException(r._id)}
                    className="h-3.5 w-3.5 rounded accent-blue-600"
                  />
                  <span className="text-sm text-[var(--text-primary)] truncate">{r.title}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {adminOnly && publishedRoutes.length === 0 && (
          <p className="text-xs text-[var(--text-muted)] mt-3">
            Нет опубликованных маршрутов в папке
          </p>
        )}

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:bg-[var(--bg-surface)]"
          >
            Отмена
          </button>
          <button
            onClick={() => onSave({ adminOnly, exceptions: adminOnly ? exceptions : [] })}
            className="flex-1 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}

// === Секция папки ===
function FolderSection({
  folder, routes, allFolders,
  onRename, onSortOrder, onDelete, onOpenSettings,
  onEditRoute, onDeleteRoute, onRouteField,
}) {
  const [name, setName] = useState(folder.name);
  const [order, setOrder] = useState(folder.sortOrder ?? 0);
  const [open, setOpen] = useState(true);

  return (
    <div>
      <div className="flex items-center gap-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-color)] px-3 py-2">
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
          />
        </button>
        <Folder className={`h-4 w-4 shrink-0 ${folder.adminOnly ? "text-red-400" : "text-amber-500"}`} />
        <input
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[var(--text-primary)] outline-none"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== folder.name && onRename(name)}
        />
        {folder.adminOnly && (
          <Shield className="h-3.5 w-3.5 text-red-400 shrink-0" title="Только админ" />
        )}
        <span className="text-xs text-[var(--text-muted)]">{routes.length}</span>
        <input
          type="number"
          className="w-14 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-2 py-1 text-xs text-center text-[var(--text-primary)] outline-none"
          value={order}
          onChange={(e) => setOrder(e.target.value)}
          onBlur={() => {
            const v = Number(order);
            if (!isNaN(v) && v !== folder.sortOrder) onSortOrder(v);
          }}
        />
        <button
          onClick={onOpenSettings}
          className="rounded-lg p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
          title="Настройки папки"
        >
          <EllipsisVertical className="h-4 w-4" />
        </button>
        <button
          onClick={onDelete}
          className="rounded-lg p-1.5 text-[var(--text-muted)] hover:text-red-500 transition"
          title="Удалить папку"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {open && (
        <div className="space-y-2 mt-2">
          {routes.map((route) => (
            <RouteRow
              key={route._id}
              route={route}
              folders={allFolders}
              onEdit={() => onEditRoute(route._id)}
              onDelete={() => onDeleteRoute(route._id)}
              onFieldChange={onRouteField}
            />
          ))}
          {routes.length === 0 && (
            <p className="text-xs text-[var(--text-muted)] pl-8 py-2">Пусто</p>
          )}
        </div>
      )}
    </div>
  );
}

// === Мульти-выбор папок ===
function FolderPicker({ route, folders, onFieldChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const fids = getFolderIds(route);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const toggle = (folderId) => {
    const next = fids.includes(folderId)
      ? fids.filter((id) => id !== folderId)
      : [...fids, folderId];
    onFieldChange(route._id, "folderIds", next);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-2 py-1 text-xs text-[var(--text-primary)] min-w-[5rem] max-w-[7rem] truncate"
      >
        {fids.length === 0
          ? "—"
          : fids.length === 1
            ? folders.find((f) => f._id === fids[0])?.name || "?"
            : `${fids.length} папки`}
        <ChevronDown className="h-3 w-3 ml-auto shrink-0 text-[var(--text-muted)]" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 w-48 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-lg py-1">
          {folders.map((f) => (
            <label
              key={f._id}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--bg-elevated)] cursor-pointer text-xs text-[var(--text-primary)]"
            >
              <input
                type="checkbox"
                checked={fids.includes(f._id)}
                onChange={() => toggle(f._id)}
                className="h-3.5 w-3.5 rounded accent-blue-600"
              />
              <span className="truncate">{f.name}</span>
            </label>
          ))}
          {folders.length === 0 && (
            <p className="px-3 py-2 text-xs text-[var(--text-muted)]">Нет папок</p>
          )}
        </div>
      )}
    </div>
  );
}

// === Строка маршрута ===
function RouteRow({ route, folders, onEdit, onDelete, onFieldChange }) {
  const [order, setOrder] = useState(route.sortOrder ?? 0);

  return (
    <div className="flex items-center gap-2 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-3 transition">
      <div
        className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-[var(--bg-elevated)] cursor-pointer"
        onClick={onEdit}
      >
        {route.coverImage ? (
          <img
            src={typeof route.coverImage === "string" ? route.coverImage : route.coverImage.url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[var(--text-muted)]">
            <Eye className="h-4 w-4" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{route.title}</p>
          {route.adminOnly && (
            <Shield className="h-3 w-3 text-red-400 shrink-0" title="Только админ" />
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          {route.status === "published" ? (
            <span className="flex items-center gap-1 text-green-600">
              <Eye className="h-3 w-3" /> Опубл.
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <EyeOff className="h-3 w-3" /> Черн.
            </span>
          )}
        </div>
      </div>

      <input
        type="number"
        className="w-14 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-2 py-1 text-xs text-center text-[var(--text-primary)] outline-none"
        value={order}
        onChange={(e) => setOrder(e.target.value)}
        onBlur={() => {
          const v = Number(order);
          if (!isNaN(v) && v !== (route.sortOrder ?? 0)) {
            onFieldChange(route._id, "sortOrder", v);
          }
        }}
        title="Порядок"
      />

      <FolderPicker route={route} folders={folders} onFieldChange={onFieldChange} />

      <button
        onClick={() => onFieldChange(route._id, "adminOnly", !route.adminOnly)}
        className={`rounded-lg p-1.5 transition ${
          route.adminOnly
            ? "text-red-400 hover:text-red-500"
            : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        }`}
        title={route.adminOnly ? "Только админ — нажмите чтобы показать всем" : "Виден всем — нажмите чтобы скрыть"}
      >
        {route.adminOnly ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
      </button>

      <div className="flex gap-0.5">
        <button
          onClick={onEdit}
          className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-blue-500 transition"
          title="Редактировать"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          onClick={onDelete}
          className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-red-500 transition"
          title="Удалить"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
