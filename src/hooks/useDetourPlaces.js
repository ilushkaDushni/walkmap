"use client";

import { useState, useCallback, useRef } from "react";
import { haversineDistance } from "@/lib/geo";

const CATEGORIES = [
  { key: "food", label: "Еда", icon: "🍽" },
  { key: "pharmacy", label: "Аптека", icon: "💊" },
  { key: "toilet", label: "Туалет", icon: "🚻" },
];

/**
 * Хук для работы с заведениями при отклонении от маршрута.
 *
 * Загружает ближайшие заведения через 2GIS API,
 * строит пешеходный маршрут к выбранному месту,
 * рассчитывает маршрут возврата на основной маршрут.
 */
export default function useDetourPlaces() {
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState("food");
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [detourRoute, setDetourRoute] = useState(null); // { path, distance, duration, fallback }
  const [returnRoute, setReturnRoute] = useState(null); // { path, distance, duration, fallback }
  const [routeLoading, setRouteLoading] = useState(false);
  const abortRef = useRef(null);

  /**
   * Загрузить ближайшие заведения.
   * @param {number} lat
   * @param {number} lng
   * @param {string} [cat] — категория (food/pharmacy/toilet)
   */
  const fetchPlaces = useCallback(async (lat, lng, cat) => {
    const activeCat = cat || category;
    if (cat) setCategory(cat);
    setLoading(true);
    setPlaces([]);

    try {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const res = await fetch(
        `/api/places/nearby?lat=${lat}&lng=${lng}&category=${activeCat}&radius=1000`,
        { signal: controller.signal }
      );

      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();

      // Добавляем расстояние по прямой от юзера (для сортировки)
      const withDistance = (data.places || []).map((p) => ({
        ...p,
        straightDistance: haversineDistance({ lat, lng }, { lat: p.lat, lng: p.lng }),
      }));

      // Сортируем по расстоянию
      withDistance.sort((a, b) => a.straightDistance - b.straightDistance);
      setPlaces(withDistance);
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("fetchPlaces error:", err);
      }
    } finally {
      setLoading(false);
    }
  }, [category]);

  /**
   * Построить маршрут к заведению и маршрут возврата на основной маршрут.
   * @param {{ lat, lng }} userPos — текущая позиция юзера
   * @param {{ lat, lng, name, ... }} place — выбранное заведение
   * @param {{ lat, lng }} returnPoint — точка возврата на основной маршрут
   */
  const buildDetourRoute = useCallback(async (userPos, place, returnPoint) => {
    setSelectedPlace(place);
    setRouteLoading(true);
    setDetourRoute(null);
    setReturnRoute(null);

    try {
      // Параллельно строим маршрут к месту и от места обратно к маршруту
      const results = await Promise.allSettled([
        fetch(
          `/api/places/route-to?fromLat=${userPos.lat}&fromLng=${userPos.lng}&toLat=${place.lat}&toLng=${place.lng}`
        ),
        returnPoint
          ? fetch(
              `/api/places/route-to?fromLat=${place.lat}&fromLng=${place.lng}&toLat=${returnPoint.lat}&toLng=${returnPoint.lng}`
            )
          : Promise.resolve(null),
      ]);

      const toRes = results[0].status === "fulfilled" ? results[0].value : null;
      const returnRes = results[1].status === "fulfilled" ? results[1].value : null;

      if (toRes?.ok) {
        const toData = await toRes.json();
        setDetourRoute(toData);
      }

      if (returnRes?.ok) {
        const returnData = await returnRes.json();
        setReturnRoute(returnData);
      }
    } catch (err) {
      console.error("buildDetourRoute error:", err);
    } finally {
      setRouteLoading(false);
    }
  }, []);

  /**
   * Сбросить всё (выход из детура).
   */
  const clearDetour = useCallback(() => {
    setSelectedPlace(null);
    setDetourRoute(null);
    setReturnRoute(null);
    setPlaces([]);
    setRouteLoading(false);
    setLoading(false);
  }, []);

  return {
    // Данные
    places,
    loading,
    category,
    categories: CATEGORIES,
    selectedPlace,
    detourRoute,
    returnRoute,
    routeLoading,
    // Методы
    fetchPlaces,
    setCategory,
    buildDetourRoute,
    clearDetour,
    setSelectedPlace,
  };
}
