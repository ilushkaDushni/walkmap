"use client";

import { useState } from "react";
import { GitBranch, Trash2, Palette, Pencil, Check } from "lucide-react";

const BRANCH_COLORS = ["#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#3b82f6", "#ec4899", "#14b8a6", "#f97316"];

export default function BranchSwitcher({ branches, activeBranchId, onSwitch, onRename, onDelete, onColorChange }) {
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [colorPickerId, setColorPickerId] = useState(null);

  if (!branches || branches.length === 0) return null;

  const startRename = (branch) => {
    setEditingId(branch.id);
    setEditName(branch.name);
  };

  const commitRename = (id) => {
    if (editName.trim()) onRename?.(id, editName.trim());
    setEditingId(null);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-2">
      {/* Main path */}
      <button
        onClick={() => onSwitch(null)}
        className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium transition ${
          !activeBranchId
            ? "bg-blue-600 text-white"
            : "text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]"
        }`}
      >
        <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
        Основной
      </button>

      {branches.map((branch) => (
        <div key={branch.id} className="relative flex items-center">
          <button
            onClick={() => onSwitch(branch.id)}
            className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium transition ${
              activeBranchId === branch.id
                ? "bg-[var(--bg-elevated)] text-[var(--text-primary)] ring-2 ring-offset-1"
                : "text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]"
            }`}
            style={activeBranchId === branch.id ? { ringColor: branch.color } : undefined}
          >
            <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: branch.color }} />
            {editingId === branch.id ? (
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={() => commitRename(branch.id)}
                onKeyDown={(e) => { if (e.key === "Enter") commitRename(branch.id); }}
                autoFocus
                className="w-20 bg-transparent text-xs outline-none"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="max-w-[80px] truncate">{branch.name}</span>
            )}
          </button>

          {/* Действия — только для активной ветки */}
          {activeBranchId === branch.id && (
            <div className="flex items-center gap-0.5 ml-0.5">
              <button
                onClick={() => startRename(branch)}
                className="rounded p-1 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition"
                title="Переименовать"
              >
                <Pencil className="h-3 w-3" />
              </button>
              <button
                onClick={() => setColorPickerId(colorPickerId === branch.id ? null : branch.id)}
                className="rounded p-1 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition"
                title="Цвет"
              >
                <Palette className="h-3 w-3" />
              </button>
              <button
                onClick={() => {
                  if (window.confirm(`Удалить ветку "${branch.name}"?`)) onDelete?.(branch.id);
                }}
                className="rounded p-1 text-[var(--text-muted)] hover:text-red-500 transition"
                title="Удалить"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Color picker */}
          {colorPickerId === branch.id && (
            <div className="absolute top-full left-0 z-20 mt-1 flex flex-wrap gap-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-2 shadow-lg">
              {BRANCH_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => { onColorChange?.(branch.id, c); setColorPickerId(null); }}
                  className="h-5 w-5 rounded-full border-2 transition hover:scale-110"
                  style={{ background: c, borderColor: c === branch.color ? "white" : "transparent" }}
                />
              ))}
            </div>
          )}
        </div>
      ))}

      <GitBranch className="h-3.5 w-3.5 text-[var(--text-muted)] ml-1" />
    </div>
  );
}
