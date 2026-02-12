"use client";

import { useUser } from "./UserProvider";

export default function LobbyIcon({ lobbyId, participantCount, isActive, onClick, inline = false }) {
  const { user } = useUser();

  if (!user) return null;

  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center transition-all ${
        inline
          ? `relative h-10 w-10 rounded-xl hover:bg-[var(--bg-elevated)] ${isActive ? "" : ""}`
          : `fixed bottom-40 right-4 z-[55] h-12 w-12 rounded-full shadow-lg hover:scale-105 active:scale-95 ${
              isActive
                ? "bg-green-500 border-green-400"
                : "bg-[var(--bg-surface)] border border-[var(--border-color)]"
            }`
      }`}
      style={isActive && !inline ? { animation: "lobby-pulse 2s ease-in-out infinite" } : {}}
    >
      <svg width={inline ? "20" : "22"} height={inline ? "20" : "22"} viewBox="0 0 24 24" fill={isActive ? "#16a34a" : inline ? "var(--bg-header)" : "var(--bg-surface)"} stroke={isActive ? (inline ? "#16a34a" : "white") : "var(--text-secondary)"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6.5" cy="8" r="2.2" />
        <path d="M2.5 20a4 4 0 0 1 8 0" />
        <circle cx="17.5" cy="8" r="2.2" />
        <path d="M13.5 20a4 4 0 0 1 8 0" />
        <circle cx="12" cy="9" r="2.8" />
        <path d="M7 21a5 5 0 0 1 10 0" />
      </svg>

      {participantCount > 0 && (
        <span className={`absolute flex items-center justify-center rounded-full bg-purple-500 text-[10px] font-bold text-white ${
          inline ? "-top-0.5 -right-0.5 h-4 min-w-4 px-0.5 text-[9px]" : "-top-1 -right-1 h-5 min-w-5 px-1"
        }`}>
          {participantCount}
        </span>
      )}

      {!inline && (
        <style jsx>{`
          @keyframes lobby-pulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
            50% { box-shadow: 0 0 0 8px rgba(34, 197, 94, 0); }
          }
        `}</style>
      )}
    </button>
  );
}
