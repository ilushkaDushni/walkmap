"use client";

import { Eye, Route, MapPin, Save, BookOpen, Play, Undo2, ScanEye } from "lucide-react";

const modes = [
  { id: "view", label: "Обзор", shortcut: "1", icon: Eye },
  { id: "drawPath", label: "Путь", shortcut: "2", icon: Route },
  { id: "addCheckpoint", label: "Точки", shortcut: "3", icon: MapPin },
  { id: "addSegment", label: "Текст", shortcut: "4", icon: BookOpen },
  { id: "simulate", label: "Тест", shortcut: "5", icon: Play },
];

export default function RouteEditorToolbar({ mode, onModeChange, onSave, isDirty, saving, onUndo, canUndo, onPreview }) {
  return (
    <div className="absolute right-3 top-3 z-10 flex flex-col gap-1 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)]/90 backdrop-blur p-1.5 shadow-lg">
      {modes.map(({ id, label, shortcut, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onModeChange(id)}
          title={`${label} (${shortcut})`}
          className={`flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-medium transition ${
            mode === id
              ? "bg-green-600 text-white"
              : "text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-secondary)]"
          }`}
        >
          <Icon className="h-4 w-4" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}

      <div className="my-1 border-t border-[var(--border-color)]" />

      <button
        onClick={onUndo}
        disabled={!canUndo}
        title="Отменить (Ctrl+Z)"
        className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-medium text-[var(--text-muted)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text-secondary)] disabled:opacity-30"
      >
        <Undo2 className="h-4 w-4" />
        <span className="hidden sm:inline">Отменить</span>
      </button>

      {onPreview && (
        <button
          onClick={onPreview}
          title="Просмотр"
          className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-medium text-[var(--text-muted)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text-secondary)]"
        >
          <ScanEye className="h-4 w-4" />
          <span className="hidden sm:inline">Просмотр</span>
        </button>
      )}

      <button
        onClick={onSave}
        disabled={!isDirty || saving}
        title="Сохранить (Ctrl+S)"
        className="flex items-center gap-1.5 rounded-xl bg-green-600 px-2.5 py-2 text-xs font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
      >
        <Save className="h-4 w-4" />
        <span className="hidden sm:inline">{saving ? "..." : "Сохранить"}</span>
      </button>
    </div>
  );
}
