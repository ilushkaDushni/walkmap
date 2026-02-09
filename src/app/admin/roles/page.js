"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/components/UserProvider";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  X,
  Crown,
  Users,
  Check,
  Shield,
} from "lucide-react";

const PERMISSION_REGISTRY = {
  "admin.access":       { label: "Доступ к админ-панели",       group: "Админ" },
  "routes.create":      { label: "Создание маршрутов",          group: "Маршруты" },
  "routes.edit":        { label: "Редактирование маршрутов",    group: "Маршруты" },
  "routes.delete":      { label: "Удаление маршрутов",          group: "Маршруты" },
  "routes.view_hidden": { label: "Просмотр скрытых маршрутов",  group: "Маршруты" },
  "folders.create":     { label: "Создание папок",              group: "Папки" },
  "folders.edit":       { label: "Редактирование папок",        group: "Папки" },
  "folders.delete":     { label: "Удаление папок",              group: "Папки" },
  "folders.visibility": { label: "Управление видимостью",       group: "Папки" },
  "users.view":         { label: "Просмотр пользователей",      group: "Пользователи" },
  "users.ban":          { label: "Бан/разбан",                  group: "Пользователи" },
  "users.manage_coins": { label: "Управление монетами",         group: "Пользователи" },
  "users.assign_roles": { label: "Назначение ролей",            group: "Пользователи" },
  "roles.manage":       { label: "Управление ролями",           group: "Роли" },
  "upload.files":       { label: "Загрузка файлов",             group: "Файлы" },
};

const COLOR_PRESETS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280",
];

// Группируем права по категориям
function getPermissionGroups() {
  const groups = {};
  for (const [key, { label, group }] of Object.entries(PERMISSION_REGISTRY)) {
    if (!groups[group]) groups[group] = [];
    groups[group].push({ key, label });
  }
  return groups;
}

export default function AdminRolesPage() {
  const { user, loading, authFetch, hasPermission } = useUser();
  const router = useRouter();
  const [roles, setRoles] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [editing, setEditing] = useState(null); // role object or "new"
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !hasPermission("roles.manage")) {
      router.replace("/");
    }
  }, [user, loading, router, hasPermission]);

  const fetchRoles = useCallback(async () => {
    const res = await authFetch("/api/admin/roles");
    if (res.ok) setRoles(await res.json());
    setLoadingData(false);
  }, [authFetch]);

  useEffect(() => {
    if (hasPermission("roles.manage")) fetchRoles();
  }, [user, fetchRoles, hasPermission]);

  const handleCreate = () => {
    setEditing({
      _id: null,
      name: "",
      slug: "",
      color: "#6b7280",
      position: 5,
      permissions: [],
      isDefault: false,
    });
  };

  const handleEdit = (role) => {
    setEditing({ ...role });
  };

  const handleSave = async (data) => {
    setSaving(true);
    const url = data._id ? `/api/admin/roles/${data._id}` : "/api/admin/roles";
    const method = data._id ? "PUT" : "POST";
    const res = await authFetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      setEditing(null);
      fetchRoles();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Ошибка сохранения");
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!confirm("Удалить роль? Она будет снята у всех пользователей.")) return;
    const res = await authFetch(`/api/admin/roles/${id}`, { method: "DELETE" });
    if (res.ok) {
      fetchRoles();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Ошибка удаления");
    }
  };

  if (loading || !hasPermission("roles.manage")) return null;

  return (
    <div className="mx-auto max-w-lg px-4 pt-4 pb-24">
      {/* Шапка */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => router.push("/admin/routes")}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Роли</h1>
          <p className="text-sm text-[var(--text-muted)]">Управление ролями и правами</p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-green-700"
        >
          <Plus className="h-4 w-4" />
          Создать
        </button>
      </div>

      {/* Список ролей */}
      {loadingData ? (
        <p className="text-sm text-[var(--text-muted)] py-8 text-center">Загрузка...</p>
      ) : roles.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)] py-8 text-center">
          Ролей пока нет. Запустите миграцию.
        </p>
      ) : (
        <div className="space-y-2">
          {roles.map((role) => (
            <div
              key={role._id}
              className="flex items-center gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-3 transition"
            >
              {/* Цвет */}
              <div
                className="h-10 w-10 shrink-0 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${role.color}20` }}
              >
                <Crown className="h-5 w-5" style={{ color: role.color }} />
              </div>

              {/* Инфо */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{role.name}</p>
                  <span className="text-[10px] text-[var(--text-muted)] font-mono">{role.slug}</span>
                  {role.isDefault && (
                    <span className="text-[10px] font-semibold bg-green-500/20 text-green-600 rounded px-1.5 py-0.5">
                      default
                    </span>
                  )}
                  {role.isSystem && (
                    <span className="text-[10px] font-semibold bg-blue-500/20 text-blue-500 rounded px-1.5 py-0.5">
                      system
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                  <span>Позиция: {role.position}</span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {role.userCount}
                  </span>
                  <span>{role.permissions.length} прав</span>
                </div>
              </div>

              {/* Действия */}
              <div className="flex gap-0.5">
                <button
                  onClick={() => handleEdit(role)}
                  className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-blue-500 transition"
                  title="Редактировать"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                {!role.isSystem && (
                  <button
                    onClick={() => handleDelete(role._id)}
                    className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-red-500 transition"
                    title="Удалить"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Модалка редактирования / создания */}
      {editing && (
        <RoleEditor
          role={editing}
          saving={saving}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

// === Редактор роли (модалка) ===
function RoleEditor({ role, saving, onSave, onClose }) {
  const [name, setName] = useState(role.name || "");
  const [slug, setSlug] = useState(role.slug || "");
  const [color, setColor] = useState(role.color || "#6b7280");
  const [position, setPosition] = useState(role.position ?? 5);
  const [permissions, setPermissions] = useState(role.permissions || []);
  const [isDefault, setIsDefault] = useState(role.isDefault || false);

  const groups = getPermissionGroups();

  const togglePerm = (key) => {
    setPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  const toggleGroup = (groupPerms) => {
    const allSelected = groupPerms.every((p) => permissions.includes(p.key));
    if (allSelected) {
      setPermissions((prev) => prev.filter((p) => !groupPerms.some((gp) => gp.key === p)));
    } else {
      setPermissions((prev) => [...new Set([...prev, ...groupPerms.map((p) => p.key)])]);
    }
  };

  const handleSubmit = () => {
    onSave({
      _id: role._id,
      name,
      slug: slug || name.toLowerCase().replace(/[^a-z0-9_-]/g, "_"),
      color,
      position: Number(position),
      permissions,
      isDefault,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 py-8 overflow-y-auto" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-5 shadow-xl my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Заголовок */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-[var(--text-primary)]">
            {role._id ? "Редактирование роли" : "Новая роль"}
          </h3>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Основные поля */}
        <div className="space-y-3 mb-4">
          <div>
            <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">Название</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
              placeholder="Модератор"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">Slug</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              disabled={role.isSystem}
              className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none disabled:opacity-50 font-mono"
              placeholder="moderator"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">Позиция</label>
              <input
                type="number"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">Цвет</label>
              <div className="flex items-center gap-1.5">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`h-7 w-7 rounded-full border-2 transition ${
                      color === c ? "border-[var(--text-primary)] scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-7 w-7 rounded-full cursor-pointer border-0 bg-transparent"
                />
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="h-4 w-4 rounded accent-green-600"
            />
            <span className="text-sm text-[var(--text-primary)]">Роль по умолчанию для новых юзеров</span>
          </label>
        </div>

        {/* Права */}
        <div className="border-t border-[var(--border-color)] pt-4">
          <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Права ({permissions.length})
          </h4>

          <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
            {Object.entries(groups).map(([groupName, groupPerms]) => {
              const allSelected = groupPerms.every((p) => permissions.includes(p.key));
              const someSelected = groupPerms.some((p) => permissions.includes(p.key));

              return (
                <div key={groupName}>
                  <button
                    onClick={() => toggleGroup(groupPerms)}
                    className="flex items-center gap-2 mb-1"
                  >
                    <div
                      className={`h-3.5 w-3.5 rounded border flex items-center justify-center transition ${
                        allSelected
                          ? "bg-blue-600 border-blue-600"
                          : someSelected
                            ? "bg-blue-600/30 border-blue-600"
                            : "border-[var(--border-color)]"
                      }`}
                    >
                      {allSelected && <Check className="h-2.5 w-2.5 text-white" />}
                      {someSelected && !allSelected && <div className="h-1.5 w-1.5 rounded-sm bg-white" />}
                    </div>
                    <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                      {groupName}
                    </span>
                  </button>
                  <div className="ml-5 space-y-0.5">
                    {groupPerms.map(({ key, label }) => (
                      <label
                        key={key}
                        className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-[var(--bg-elevated)] cursor-pointer transition"
                      >
                        <input
                          type="checkbox"
                          checked={permissions.includes(key)}
                          onChange={() => togglePerm(key)}
                          className="h-3.5 w-3.5 rounded accent-blue-600"
                        />
                        <span className="text-xs text-[var(--text-primary)]">{label}</span>
                        <span className="text-[10px] text-[var(--text-muted)] font-mono ml-auto">{key}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Кнопки */}
        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:bg-[var(--bg-surface)]"
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || saving}
            className="flex-1 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Сохранение..." : role._id ? "Сохранить" : "Создать"}
          </button>
        </div>
      </div>
    </div>
  );
}
