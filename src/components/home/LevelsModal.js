"use client";

import { createPortal } from "react-dom";
import { Trophy, X } from "lucide-react";
import { LEVELS } from "./helpers";

export default function LevelsModal({ level, completedRoutes, onClose }) {
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative w-full max-w-xs rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-[var(--shadow-xl)] overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Звания</h3>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-3 space-y-2">
          {LEVELS.map((lvl, i) => {
            const isCurrent = lvl.title === level.title;
            const isUnlocked = completedRoutes >= lvl.min;
            const nextLvl = LEVELS[i + 1];
            const pct = nextLvl
              ? Math.min(100, Math.round(((completedRoutes - lvl.min) / (nextLvl.min - lvl.min)) * 100))
              : 100;

            return (
              <div
                key={lvl.title}
                className={`rounded-xl border p-3 transition ${
                  isCurrent
                    ? "border-[var(--accent-color)] bg-[var(--accent-color)]/5"
                    : isUnlocked
                    ? "border-[var(--border-color)] bg-[var(--bg-elevated)]/50"
                    : "border-[var(--border-color)] opacity-50"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${lvl.bg} shrink-0`}>
                    <Trophy className={`h-4 w-4 ${lvl.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${lvl.color}`}>{lvl.title}</span>
                      {isCurrent && (
                        <span className="text-xs font-bold uppercase tracking-wider text-[var(--accent-color)] bg-[var(--accent-color)]/10 px-1.5 py-0.5 rounded">Сейчас</span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">{lvl.desc}</p>
                  </div>
                  {isUnlocked && !isCurrent && (
                    <span className="text-green-500 text-xs font-bold shrink-0">✓</span>
                  )}
                </div>
                {isCurrent && nextLvl && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all" style={{ width: `${Math.max(0, pct)}%` }} />
                    </div>
                    <span className="text-xs text-[var(--text-muted)] shrink-0">{completedRoutes}/{nextLvl.min}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
