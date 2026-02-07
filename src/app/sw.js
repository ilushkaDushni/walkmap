import { defaultCache } from "@serwist/next/worker";
import { Serwist } from "serwist";

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // OpenFreeMap тайлы и стиль — CacheFirst, 30 дней
    {
      urlPattern: /^https:\/\/tiles\.openfreemap\.org\/.*/i,
      handler: "CacheFirst",
      options: {
        cacheName: "ofm-tiles",
        expiration: {
          maxEntries: 3000,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    // Загруженные фото и аудио — CacheFirst, 30 дней
    {
      urlPattern: /\/uploads\/(photos|audio)\/.*/i,
      handler: "CacheFirst",
      options: {
        cacheName: "uploads-media",
        expiration: {
          maxEntries: 500,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    // API маршрутов — NetworkFirst, 7 дней
    {
      urlPattern: /\/api\/routes.*/i,
      handler: "NetworkFirst",
      options: {
        cacheName: "routes-api",
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 7 * 24 * 60 * 60,
        },
        cacheableResponse: { statuses: [0, 200] },
        networkTimeoutSeconds: 5,
      },
    },
    // Картинки карт — CacheFirst, 30 дней
    {
      urlPattern: /\/maps\/.*/i,
      handler: "CacheFirst",
      options: {
        cacheName: "map-images",
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    // Фото и аудио остановок (legacy) — CacheFirst, 30 дней
    {
      urlPattern: /\/(images|audio)\/.*/i,
      handler: "CacheFirst",
      options: {
        cacheName: "media-assets",
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    // Статические изображения (иконки и пр.)
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
      handler: "CacheFirst",
      options: {
        cacheName: "static-images",
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        },
      },
    },
    // JS/CSS бандлы
    {
      urlPattern: /\.(?:js|css)$/i,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "static-assets",
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 7 * 24 * 60 * 60,
        },
      },
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();
