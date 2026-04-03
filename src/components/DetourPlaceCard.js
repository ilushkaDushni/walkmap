"use client";

import { Clock, MapPin, Navigation } from "lucide-react";

/**
 * Карточка заведения в списке детура.
 * Показывает: название, категорию, расстояние пешком, кухню, адрес.
 */
export default function DetourPlaceCard({ place, onSelect, loading }) {
  const distText = place.straightDistance > 1000
    ? `${(place.straightDistance / 1000).toFixed(1)} км`
    : `${Math.round(place.straightDistance)} м`;

  // Примерное время пешком (5 км/ч ≈ 83 м/мин)
  const walkMinutes = Math.max(1, Math.round(place.straightDistance / 83));

  return (
    <button
      onClick={() => onSelect(place)}
      disabled={loading}
      className="w-full flex items-start gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-3 text-left transition hover:bg-[var(--bg-elevated)] active:scale-[0.98] disabled:opacity-60"
    >
      {/* Иконка навигации */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
        <Navigation className="h-5 w-5" />
      </div>

      <div className="flex-1 min-w-0 space-y-1">
        {/* Название */}
        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
          {place.name}
        </p>

        {/* Категория + кухня */}
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <span>{place.category}</span>
          {place.cuisine && (
            <span className="text-[var(--text-muted)]">· {place.cuisine}</span>
          )}
        </div>

        {/* Расстояние + время */}
        <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
          <span className="flex items-center gap-0.5">
            <MapPin className="h-3 w-3" />
            {distText}
          </span>
          <span className="flex items-center gap-0.5">
            <Clock className="h-3 w-3" />
            ~{walkMinutes} мин
          </span>
          {place.openingHours && (
            <span className="text-[var(--text-muted)] truncate max-w-[120px]">
              {place.openingHours}
            </span>
          )}
        </div>

        {place.address && (
          <p className="text-xs text-[var(--text-muted)] truncate">{place.address}</p>
        )}
      </div>
    </button>
  );
}
