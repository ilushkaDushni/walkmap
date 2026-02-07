"use client";

import { Eye, Route, MapPin, Flag, Save } from "lucide-react";

const modes = [
  { id: "view", label: "Обзор", icon: Eye },
  { id: "drawPath", label: "Путь", icon: Route },
  { id: "addCheckpoint", label: "Точки", icon: MapPin },
  { id: "setFinish", label: "Финиш", icon: Flag },
];

export default function RouteEditorToolbar({ mode, onModeChange, onSave, isDirty, saving }) {
  return (
    <div className="flex items-center gap-1 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-1.5">
      {modes.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onModeChange(id)}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition ${
            mode === id
              ? "bg-green-600 text-white"
              : "text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-secondary)]"
          }`}
        >
          <Icon className="h-4 w-4" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}

      <div className="ml-auto">
        <button
          onClick={onSave}
          disabled={!isDirty || saving}
          className="flex items-center gap-1.5 rounded-xl bg-green-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? "..." : "Сохранить"}
        </button>
      </div>
    </div>
  );
}
