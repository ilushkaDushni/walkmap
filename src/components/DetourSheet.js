"use client";

import { useState, useEffect, useRef } from "react";
import { X, ChevronDown, Loader2, Navigation, MapPin } from "lucide-react";
import DetourPlaceCard from "./DetourPlaceCard";

/**
 * Bottom sheet со списком ближайших заведений.
 * Открывается при нажатии "Перекус", показывает категории и список мест.
 */
export default function DetourSheet({
  open,
  onClose,
  places,
  loading,
  categories,
  activeCategory,
  onCategoryChange,
  onSelectPlace,
  routeLoading,
  selectedPlace,
  detourRoute,
  onConfirmDetour,
  onCancelSelection,
}) {
  const sheetRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const startY = useRef(0);
  const currentY = useRef(0);

  // Закрытие свайпом вниз
  const handleTouchStart = (e) => {
    startY.current = e.touches[0].clientY;
    currentY.current = e.touches[0].clientY; // инициализируем чтобы не было stale значения
    setDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!dragging) return;
    currentY.current = e.touches[0].clientY;
    const dy = currentY.current - startY.current;
    if (dy > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${dy}px)`;
    }
  };

  const handleTouchEnd = () => {
    setDragging(false);
    const dy = currentY.current - startY.current;
    if (sheetRef.current) {
      sheetRef.current.style.transform = "";
    }
    if (dy > 100) onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="relative w-full max-h-[75vh] rounded-t-3xl bg-[var(--bg-primary)] shadow-xl transition-transform overflow-hidden flex flex-col"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Ручка */}
        <div className="flex justify-center py-2">
          <div className="h-1 w-10 rounded-full bg-[var(--text-muted)]/30" />
        </div>

        {/* Заголовок */}
        <div className="flex items-center justify-between px-4 pb-2">
          <h3 className="text-base font-bold text-[var(--text-primary)]">
            {selectedPlace ? "Маршрут к заведению" : "Куда зайти?"}
          </h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-[var(--text-muted)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Если выбрано место — показываем детали маршрута */}
        {selectedPlace ? (
          <div className="px-4 pb-6 space-y-3">
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 space-y-2">
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                {selectedPlace.name}
              </p>
              {selectedPlace.address && (
                <p className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {selectedPlace.address}
                </p>
              )}
              {routeLoading ? (
                <div className="flex items-center gap-2 py-3 text-sm text-[var(--text-muted)]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Строим маршрут...
                </div>
              ) : detourRoute ? (
                <div className="flex items-center gap-4 text-sm text-[var(--text-secondary)]">
                  {detourRoute.distance != null && (
                    <span>
                      {detourRoute.distance > 1000
                        ? `${(detourRoute.distance / 1000).toFixed(1)} км`
                        : `${Math.round(detourRoute.distance)} м`
                      }
                    </span>
                  )}
                  {detourRoute.duration != null && (
                    <span>~{Math.max(1, Math.round(detourRoute.duration / 60))} мин пешком</span>
                  )}
                  {detourRoute.fallback && (
                    <span className="text-xs text-amber-500">по прямой</span>
                  )}
                </div>
              ) : null}
            </div>

            <div className="flex gap-2">
              <button
                onClick={onCancelSelection}
                className="flex-1 rounded-xl border border-[var(--border-color)] px-4 py-3 text-sm font-medium text-[var(--text-secondary)] transition hover:bg-[var(--bg-elevated)]"
              >
                Назад
              </button>
              <button
                onClick={() => onConfirmDetour(selectedPlace)}
                disabled={routeLoading}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                <Navigation className="h-4 w-4" />
                Идём!
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Табы категорий */}
            <div className="flex gap-2 px-4 pb-3">
              {categories.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => onCategoryChange(cat.key)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    activeCategory === cat.key
                      ? "bg-blue-600 text-white"
                      : "bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]"
                  }`}
                >
                  <span>{cat.icon}</span>
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Список мест */}
            <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-2">
              {loading ? (
                <div className="flex items-center justify-center py-8 gap-2 text-sm text-[var(--text-muted)]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Ищем заведения рядом...
                </div>
              ) : places.length === 0 ? (
                <div className="text-center py-8 text-sm text-[var(--text-muted)]">
                  Ничего не найдено поблизости
                </div>
              ) : (
                places.map((place) => (
                  <DetourPlaceCard
                    key={place.id}
                    place={place}
                    onSelect={onSelectPlace}
                    loading={routeLoading}
                  />
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
