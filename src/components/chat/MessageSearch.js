"use client";

import { useState, useCallback } from "react";
import { Search, X, ChevronUp, ChevronDown } from "lucide-react";

export default function MessageSearch({ messages, onHighlight, onClose }) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleSearch = useCallback((q) => {
    setQuery(q);
    if (q.length < 2) {
      setMatches([]);
      setCurrentIndex(0);
      onHighlight?.(null);
      return;
    }
    const lower = q.toLowerCase();
    const found = messages
      .filter((m) => m.text?.toLowerCase().includes(lower))
      .map((m) => m.id);
    setMatches(found);
    setCurrentIndex(0);
    if (found.length > 0) onHighlight?.(found[0]);
  }, [messages, onHighlight]);

  const navigate = (dir) => {
    if (matches.length === 0) return;
    const next = (currentIndex + dir + matches.length) % matches.length;
    setCurrentIndex(next);
    onHighlight?.(matches[next]);
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-surface)] border-b border-[var(--border-color)]">
      <Search className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
      <input
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Поиск в чате..."
        className="flex-1 text-sm bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
        autoFocus
      />
      {matches.length > 0 && (
        <span className="text-xs text-[var(--text-muted)] shrink-0">
          {currentIndex + 1}/{matches.length}
        </span>
      )}
      <div className="flex items-center gap-0.5 shrink-0">
        <button onClick={() => navigate(-1)} className="p-1 rounded hover:bg-[var(--bg-elevated)] transition" disabled={matches.length === 0}>
          <ChevronUp className="h-4 w-4 text-[var(--text-muted)]" />
        </button>
        <button onClick={() => navigate(1)} className="p-1 rounded hover:bg-[var(--bg-elevated)] transition" disabled={matches.length === 0}>
          <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />
        </button>
      </div>
      <button onClick={onClose} className="p-1 rounded hover:bg-[var(--bg-elevated)] transition shrink-0">
        <X className="h-4 w-4 text-[var(--text-muted)]" />
      </button>
    </div>
  );
}
