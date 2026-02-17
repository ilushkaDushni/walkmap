"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Search, X, Loader2 } from "lucide-react";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const VIEWBOX = "38.8,47.6,40.6,46.9";
const DEBOUNCE_MS = 600;
const MIN_CHARS = 3;

export default function AddressSearch({ onSelect }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [noResults, setNoResults] = useState(false);

  const timerRef = useRef(null);
  const abortRef = useRef(null);
  const containerRef = useRef(null);

  // Закрытие по клику вне
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const search = useCallback((q) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setNoResults(false);

    const url = `${NOMINATIM_URL}?q=${encodeURIComponent(q)}&format=json&limit=5&viewbox=${VIEWBOX}&bounded=1&accept-language=ru`;

    fetch(url, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        setResults(data);
        setNoResults(data.length === 0);
        setOpen(true);
        setActiveIndex(-1);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setLoading(false);
        }
      });
  }, []);

  const handleChange = useCallback(
    (e) => {
      const val = e.target.value;
      setQuery(val);
      clearTimeout(timerRef.current);

      if (val.trim().length < MIN_CHARS) {
        setResults([]);
        setOpen(false);
        setNoResults(false);
        abortRef.current?.abort();
        setLoading(false);
        return;
      }

      timerRef.current = setTimeout(() => search(val.trim()), DEBOUNCE_MS);
    },
    [search]
  );

  const selectResult = useCallback(
    (item) => {
      onSelect({
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        displayName: item.display_name,
      });
      setQuery(item.display_name.split(",")[0]);
      setOpen(false);
    },
    [onSelect]
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (!open || results.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i < results.length - 1 ? i + 1 : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i > 0 ? i - 1 : results.length - 1));
      } else if (e.key === "Enter" && activeIndex >= 0) {
        e.preventDefault();
        selectResult(results[activeIndex]);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    },
    [open, results, activeIndex, selectResult]
  );

  const clear = useCallback(() => {
    setQuery("");
    setResults([]);
    setOpen(false);
    setNoResults(false);
    abortRef.current?.abort();
    setLoading(false);
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute left-3 top-3 z-20 w-72 max-w-[calc(100%-80px)]"
    >
      {/* Input */}
      <div className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)]/90 backdrop-blur px-3 py-2 shadow-lg">
        <Search className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          placeholder="Поиск адреса..."
          className="flex-1 min-w-0 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
        />
        {loading && <Loader2 className="h-4 w-4 shrink-0 text-[var(--text-muted)] animate-spin" />}
        {query && !loading && (
          <button onClick={clear} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && (results.length > 0 || noResults) && (
        <div className="mt-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)]/95 backdrop-blur shadow-xl overflow-hidden">
          {noResults ? (
            <div className="px-3 py-2.5 text-xs text-[var(--text-muted)]">Ничего не найдено</div>
          ) : (
            results.map((item, i) => (
              <button
                key={item.place_id}
                onClick={() => selectResult(item)}
                className={`w-full text-left px-3 py-2 text-xs transition ${
                  i === activeIndex
                    ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
                }`}
              >
                <div className="line-clamp-2">{item.display_name}</div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
