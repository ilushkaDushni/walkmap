"use client";

import { useState, useCallback } from "react";

/**
 * Хук для предзагрузки маршрута для офлайн-использования.
 * Скачивает все медиа-файлы и OSM-тайлы для bounding box маршрута.
 */
export default function useOfflineDownload(route) {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  const download = useCallback(async () => {
    if (!route || downloading) return;
    setDownloading(true);
    setProgress(0);
    setDone(false);

    try {
      // Собираем все URL медиа
      const urls = new Set();

      if (route.coverImage) urls.add(route.coverImage);
      route.photos?.forEach((u) => urls.add(u));
      route.audio?.forEach((u) => urls.add(u));
      route.checkpoints?.forEach((cp) => {
        cp.photos?.forEach((u) => urls.add(u));
        cp.audio?.forEach((u) => urls.add(u));
      });

      // Собираем OpenFreeMap vector тайлы
      const tileUrls = getVectorTileUrls(route);
      tileUrls.forEach((u) => urls.add(u));

      // Стиль карты
      urls.add("https://tiles.openfreemap.org/styles/liberty");

      // API маршрута
      urls.add(`/api/routes/${route._id}`);

      const total = urls.size;
      let loaded = 0;

      // Скачиваем всё (SW автоматически кеширует)
      const batch = Array.from(urls);
      const concurrency = 4;

      for (let i = 0; i < batch.length; i += concurrency) {
        const chunk = batch.slice(i, i + concurrency);
        await Promise.allSettled(
          chunk.map((url) =>
            fetch(url).then(() => {
              loaded++;
              setProgress(Math.round((loaded / total) * 100));
            })
          )
        );
      }

      setDone(true);
    } catch {
      // Не критично — что-то могло не загрузиться
    } finally {
      setDownloading(false);
    }
  }, [route, downloading]);

  return { download, downloading, progress, done };
}

/**
 * Генерирует URL OpenFreeMap vector тайлов для bounding box маршрута (zoom 14-16).
 */
function getVectorTileUrls(route) {
  const points = [];
  route.path?.forEach((p) => points.push(p));
  route.checkpoints?.forEach((cp) => points.push(cp.position));
  if (route.finish?.position) points.push(route.finish.position);

  if (points.length === 0) return [];

  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }

  // Добавляем небольшой отступ
  const pad = 0.002;
  minLat -= pad;
  maxLat += pad;
  minLng -= pad;
  maxLng += pad;

  const urls = [];

  for (let z = 14; z <= 16; z++) {
    const minTileX = lng2tile(minLng, z);
    const maxTileX = lng2tile(maxLng, z);
    const minTileY = lat2tile(maxLat, z);
    const maxTileY = lat2tile(minLat, z);

    for (let x = minTileX; x <= maxTileX; x++) {
      for (let y = minTileY; y <= maxTileY; y++) {
        urls.push(`https://tiles.openfreemap.org/planet/${z}/${x}/${y}.pbf`);
      }
    }
  }

  return urls;
}

function lng2tile(lng, zoom) {
  return Math.floor(((lng + 180) / 360) * Math.pow(2, zoom));
}

function lat2tile(lat, zoom) {
  return Math.floor(
    ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) *
      Math.pow(2, zoom)
  );
}
