"use client";

import { useState, useEffect, useRef } from "react";
import { ExternalLink, Globe } from "lucide-react";
import { useUser } from "@/components/UserProvider";

// Регулярка для поиска URL в тексте
const URL_REGEX = /https?:\/\/[^\s<>"')\]]+/g;

// Глобальный кэш превью (сохраняется между рендерами)
const cache = new Map();

/**
 * Извлекает первый URL из текста
 */
export function extractFirstUrl(text) {
  if (!text) return null;
  const match = text.match(URL_REGEX);
  return match?.[0] || null;
}

/**
 * Извлекает все уникальные URL из текста
 */
export function extractUrls(text) {
  if (!text) return [];
  const matches = text.match(URL_REGEX);
  return matches ? [...new Set(matches)] : [];
}

/**
 * Рендерит текст сообщения с кликабельными ссылками
 */
export function MessageTextWithLinks({ text, className }) {
  if (!text) return null;

  const parts = [];
  let lastIndex = 0;
  let match;

  const regex = new RegExp(URL_REGEX.source, "g");
  while ((match = regex.exec(text)) !== null) {
    // Текст до ссылки
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    // Сама ссылка — кликабельная
    const url = match[0];
    parts.push(
      <a
        key={match.index}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 decoration-1 break-all hover:opacity-80 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        {url}
      </a>
    );
    lastIndex = match.index + url.length;
  }

  // Остаток текста после последней ссылки
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  // Если ссылок не было — возвращаем обычный текст
  if (parts.length === 1 && typeof parts[0] === "string") {
    return <p className={className}>{text}</p>;
  }

  return <p className={className}>{parts}</p>;
}

/**
 * Карточка превью одной ссылки
 */
function PreviewCard({ url }) {
  const { authFetch } = useUser();
  const cached = cache.get(url);
  const [data, setData] = useState(cached || null);
  const [error, setError] = useState(cached === null && cache.has(url));
  const [loading, setLoading] = useState(!cache.has(url));
  const fetchedRef = useRef(!!cached || error);

  useEffect(() => {
    if (!url || !authFetch || fetchedRef.current) return;
    fetchedRef.current = true;

    authFetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((meta) => {
        if (meta.title || meta.description || meta.image) {
          cache.set(url, meta);
          setData(meta);
        } else {
          cache.set(url, null);
          setError(true);
        }
        setLoading(false);
      })
      .catch(() => {
        cache.set(url, null);
        setError(true);
        setLoading(false);
      });
  }, [url, authFetch]);

  // Не показываем при ошибке
  if (error) return null;

  // Скелетон загрузки
  if (loading) {
    return (
      <div className="mt-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] overflow-hidden animate-pulse">
        <div className="px-3 py-2">
          <div className="h-3 w-1/3 rounded bg-[var(--border-color)] mb-1.5" />
          <div className="h-3.5 w-2/3 rounded bg-[var(--border-color)] mb-1" />
          <div className="h-2.5 w-full rounded bg-[var(--border-color)]" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Вычисляем домен для отображения
  let domain = data.domain || data.siteName || "";
  if (!domain) {
    try { domain = new URL(url).hostname.replace(/^www\./, ""); } catch { domain = ""; }
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block mt-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] overflow-hidden no-underline hover:bg-[var(--bg-elevated)] transition group"
      onClick={(e) => e.stopPropagation()}
    >
      {/* OG-изображение */}
      {data.image && (
        <div className="w-full h-32 overflow-hidden bg-[var(--bg-elevated)]">
          <img
            src={data.image}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => { e.target.style.display = "none"; }}
          />
        </div>
      )}

      {/* Текстовый блок */}
      <div className="px-3 py-2">
        {/* Домен */}
        {domain && (
          <div className="flex items-center gap-1 mb-0.5">
            <Globe className="h-3 w-3 text-[var(--text-muted)] shrink-0" />
            <span className="text-xs text-[var(--text-muted)] truncate">{domain}</span>
            <ExternalLink className="h-3 w-3 text-[var(--text-muted)] shrink-0 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        )}

        {/* Заголовок */}
        {data.title && (
          <p className="text-sm font-medium text-[var(--text-primary)] line-clamp-2 leading-snug">{data.title}</p>
        )}

        {/* Описание */}
        {data.description && (
          <p className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-2">{data.description}</p>
        )}
      </div>
    </a>
  );
}

/**
 * Компонент превью ссылок для сообщения.
 * Поддерживает два режима:
 * - url (string) — одна ссылка (обратная совместимость)
 * - text (string) — извлекает все URL из текста (максимум 3)
 */
export default function LinkPreview({ url, text }) {
  // Режим одной ссылки (обратная совместимость)
  if (url && !text) {
    return <PreviewCard url={url} />;
  }

  // Режим извлечения из текста
  const urls = extractUrls(text || "");
  if (urls.length === 0) return null;

  // Ограничиваем до 3 превью на сообщение
  const displayUrls = urls.slice(0, 3);

  return (
    <>
      {displayUrls.map((u) => (
        <PreviewCard key={u} url={u} />
      ))}
    </>
  );
}
