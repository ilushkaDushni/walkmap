"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { ArrowLeft, Send, MapPin, Bell, X, Reply, Smile, Check, CheckCheck, Trash2, MoreVertical, ChevronDown, Clock, AlertCircle, RefreshCw, Paperclip, Pencil, Copy, Image as ImageIcon, Shield, Mic, Square, Pin, Users } from "lucide-react";
import PinnedMessageBanner from "./chat/PinnedMessageBanner";
import { useUser } from "./UserProvider";
import UserAvatar from "./UserAvatar";
import useChatPolling from "@/hooks/useChatPolling";
import useUnreadCount from "@/hooks/useUnreadCount";
import Link from "next/link";
import { isOnline, formatLastSeen } from "@/lib/onlineStatus";
import { getChatTheme, setChatTheme as saveChatTheme, CHAT_THEMES, addPremiumThemes, getAllChatThemes } from "@/lib/chatThemes";
import { getChatFontSize } from "@/lib/chatSettings";
import ChatSettingsModal from "./ChatSettingsModal";
import VoiceMessage from "./VoiceMessage";
import useVoiceRecorder from "@/hooks/useVoiceRecorder";
import LinkPreview, { extractUrls, MessageTextWithLinks } from "./chat/LinkPreview";
import ChallengeCard from "./ChallengeCard";
import MediaGallery from "./chat/MediaGallery";

const FONT_CLASS = { sm: "text-xs", base: "text-sm", lg: "text-base" };

function timeShort(date) {
  const d = new Date(date);
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function dateLabel(date) {
  const d = new Date(date);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const msgDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (msgDate.getTime() === today.getTime()) return "Сегодня";
  if (msgDate.getTime() === yesterday.getTime()) return "Вчера";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

function RouteCard({ routeId }) {
  const [route, setRoute] = useState(null);

  useEffect(() => {
    fetch(`/api/routes/${routeId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setRoute(data); })
      .catch(() => {});
  }, [routeId]);

  if (!route) return null;

  return (
    <Link
      href={`/routes/${routeId}`}
      className="flex items-center gap-2 mt-1 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-color)] px-3 py-2 no-underline hover:bg-[var(--bg-surface)] transition"
    >
      <MapPin className="h-4 w-4 text-green-500 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs font-medium text-[var(--text-primary)] truncate">{route.title || "Маршрут"}</p>
        {route.distance && (
          <p className="text-xs text-[var(--text-muted)]">{(route.distance / 1000).toFixed(1)} км</p>
        )}
      </div>
    </Link>
  );
}

// --- Emoji Picker ---
const EMOJI_LIST = [
  "😀", "😂", "🤣", "😊", "😍", "🥰", "😘", "😜",
  "🤔", "😎", "🥳", "😭", "😡", "🤯", "🥺", "👀",
  "👍", "👎", "❤️", "🔥", "💯", "✨", "🎉", "🙏",
  "👋", "🤝", "💪", "🫡", "🤗", "😴", "🤡", "💀",
];

function EmojiPicker({ onSelect, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute bottom-full left-0 mb-2 p-2 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-color)] shadow-[var(--shadow-lg)] z-10 w-[280px]">
      <div className="grid grid-cols-8 gap-1">
        {EMOJI_LIST.map((e) => (
          <button
            key={e}
            onClick={() => onSelect(e)}
            className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-[var(--bg-surface)] transition text-lg"
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}

const REACTION_EMOJI = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

// --- Context Menu ---
function ContextMenu({ x, y, msg, isMe, onReply, onReact, onDeleteAll, onDeleteSelf, onEdit, onCopy, onPin, isPinned, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const canEdit = isMe && msg.type !== "image" && !msg._optimistic &&
    (Date.now() - new Date(msg.createdAt).getTime() < 15 * 60 * 1000);

  // Зажимаем в границы экрана
  const menuStyle = {
    top: Math.min(y, window.innerHeight - 280),
    left: Math.min(x, window.innerWidth - 200),
  };

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[180px] rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-color)] shadow-[var(--shadow-xl)] overflow-hidden py-1"
      style={menuStyle}
    >
      {/* Reaction row */}
      <div className="flex gap-1 px-2 py-1.5 border-b border-[var(--border-color)]">
        {REACTION_EMOJI.map((e) => (
          <button
            key={e}
            onClick={() => { onReact(e); onClose(); }}
            className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-[var(--bg-surface)] transition text-base hover:scale-125"
          >
            {e}
          </button>
        ))}
      </div>
      <button
        onClick={() => { onReply(); onClose(); }}
        className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition"
      >
        <Reply className="h-4 w-4" />
        Ответить
      </button>
      {!msg._optimistic && (
        <button
          onClick={() => { onPin(); onClose(); }}
          className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition"
        >
          <Pin className="h-4 w-4" />
          {isPinned ? "Открепить" : "Закрепить"}
        </button>
      )}
      {msg.text && (
        <button
          onClick={() => { onCopy(); onClose(); }}
          className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition"
        >
          <Copy className="h-4 w-4" />
          Копировать
        </button>
      )}
      {canEdit && (
        <button
          onClick={() => { onEdit(); onClose(); }}
          className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition"
        >
          <Pencil className="h-4 w-4" />
          Редактировать
        </button>
      )}
      {isMe && !msg._optimistic && (
        <button
          onClick={() => { onDeleteAll(); onClose(); }}
          className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-red-500 hover:bg-[var(--bg-surface)] transition"
        >
          <Trash2 className="h-4 w-4" />
          Удалить у всех
        </button>
      )}
      <button
        onClick={() => { onDeleteSelf(); onClose(); }}
        className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-surface)] transition"
      >
        <Trash2 className="h-4 w-4" />
        Удалить у себя
      </button>
    </div>
  );
}

// --- Typing Indicator ---
function TypingIndicator({ theme }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1">
      <span className="text-xs text-[var(--text-muted)]" style={theme.dark ? { color: "rgba(226,232,240,0.5)" } : undefined}>
        печатает
      </span>
      <span className="flex gap-0.5">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-muted)] animate-typing-dot-1" />
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-muted)] animate-typing-dot-2" />
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-muted)] animate-typing-dot-3" />
      </span>
    </div>
  );
}

// --- Date Separator ---
function DateSeparator({ label, theme }) {
  return (
    <div className="flex items-center justify-center py-2">
      <span className="px-3 py-0.5 rounded-full text-xs font-medium bg-[var(--bg-elevated)]/60 text-[var(--text-muted)]"
        style={theme.dark ? { backgroundColor: "rgba(255,255,255,0.1)", color: "rgba(226,232,240,0.5)" } : undefined}
      >
        {label}
      </span>
    </div>
  );
}

// --- Image Lightbox ---

// --- Message Bubble ---
function MessageBubble({ msg, isMe, user, friend, grouped, isNew, onReply, onDelete, onReaction, onEdit, onPin, isPinned, theme, fontClass, contextMenu, onContextMenu, onCloseContextMenu, onImageClick }) {
  const longPressTimer = useRef(null);
  const bubbleRef = useRef(null);
  const [imgRetry, setImgRetry] = useState(0);
  const [imgFailed, setImgFailed] = useState(false);

  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - 200);
    onContextMenu(msg.id, { x, y });
  }, [msg.id, onContextMenu]);

  const handleTouchStart = useCallback(() => {
    longPressTimer.current = setTimeout(() => {
      if (bubbleRef.current) {
        const rect = bubbleRef.current.getBoundingClientRect();
        const x = Math.min(rect.left, window.innerWidth - 200);
        const y = Math.min(rect.top - 10, window.innerHeight - 200);
        onContextMenu(msg.id, { x, y });
      }
    }, 500);
  }, [msg.id, onContextMenu]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleCopy = useCallback(() => {
    if (msg.text) navigator.clipboard?.writeText(msg.text);
  }, [msg.text]);

  const reactions = msg.reactions || [];
  const grouped_reactions = {};
  for (const r of reactions) {
    if (!grouped_reactions[r.emoji]) grouped_reactions[r.emoji] = { count: 0, mine: false };
    grouped_reactions[r.emoji].count++;
    if (r.userId === user?.id) grouped_reactions[r.emoji].mine = true;
  }

  const accentHex = theme.accent;
  const isOptimistic = msg._optimistic;
  const isError = msg._status === "error";
  const isSending = msg._status === "sending";
  const isImageOnly = msg.type === "image" && msg.imageUrl && !msg.text;

  return (
    <div data-msg-id={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"} ${grouped ? "mt-0.5" : "mt-2"} ${isNew ? "animate-message-in" : ""}`}>
      {/* Аватар (только для не-сгруппированных чужих) */}
      {!isMe && !grouped && (
        <div className="shrink-0 mr-2 self-end">
          <UserAvatar username={friend?.username || "?"} avatarUrl={friend?.avatarUrl} size="sm" equippedItems={friend?.equippedItems} />
        </div>
      )}
      {!isMe && grouped && <div className="w-8 mr-2 shrink-0" />}

      <div className="relative max-w-[min(75%,480px)]">
        <div
          ref={bubbleRef}
          onContextMenu={handleContextMenu}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          className={`rounded-2xl select-none ${isImageOnly ? "overflow-hidden" : "px-3 py-1.5"} ${
            isMe
              ? "rounded-br-sm"
              : `rounded-bl-sm ${!isImageOnly && !theme.dark ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]" : ""}`
          } ${isOptimistic ? "opacity-70" : ""}`}
          style={isMe && !isImageOnly
            ? { backgroundColor: theme.bubble, color: theme.bubbleText }
            : !isMe && !isImageOnly && theme.dark ? { backgroundColor: "rgba(255,255,255,0.12)", color: "#e2e8f0" } : undefined
          }
        >
          {/* Reply quote */}
          {msg.replyTo && (
            <div className={`mb-1 pl-2 border-l-2 rounded-sm ${isImageOnly ? "px-3 pt-1.5" : ""}`}
              style={isMe ? { borderColor: "rgba(255,255,255,0.5)" } : { borderColor: theme.dark ? "rgba(226,232,240,0.3)" : accentHex + "80" }}
            >
              <p className="text-xs font-semibold"
                style={isMe ? { color: "rgba(255,255,255,0.8)" } : { color: accentHex }}
              >
                {msg.replyTo.senderId === user?.id ? "Вы" : (msg.replyTo.senderName || friend?.username)}
              </p>
              <p className={`text-xs truncate ${isMe || theme.dark ? "" : "text-[var(--text-muted)]"}`}
                style={isMe ? { color: "rgba(255,255,255,0.6)" } : theme.dark ? { color: "rgba(226,232,240,0.5)" } : undefined}
              >
                {msg.replyTo.text}
              </p>
            </div>
          )}

          {/* Image */}
          {msg.type === "image" && msg.imageUrl && (
            <div className="relative">
              {imgFailed ? (
                <div
                  className="flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-color)] px-6 py-8 cursor-pointer"
                  onClick={() => { setImgFailed(false); setImgRetry((r) => r + 1); }}
                >
                  <ImageIcon className="h-8 w-8 text-[var(--text-muted)] opacity-40" />
                  <span className="text-xs text-[var(--text-muted)]">Не удалось загрузить</span>
                  <span className="text-xs text-green-500 font-medium">Нажмите для повтора</span>
                </div>
              ) : (
              <img
                src={msg.imageUrl + (imgRetry ? `?r=${imgRetry}` : "")}
                alt=""
                className="rounded-2xl max-w-full max-h-80 object-cover cursor-pointer"
                style={isImageOnly ? { display: "block" } : undefined}
                onClick={() => onImageClick?.(msg.id)}
                onError={() => {
                  if (imgRetry < 2) {
                    // Авто-ретрай с кэш-бастингом
                    setTimeout(() => setImgRetry((r) => r + 1), 2000);
                  } else {
                    setImgFailed(true);
                  }
                }}
              />
              )}
              {/* Time overlay for image-only messages */}
              {isImageOnly && !imgFailed && (
                <div className="absolute bottom-1.5 right-2 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-black/50 text-white">
                  {msg.editedAt && <span className="text-xs">ред.</span>}
                  <span className="text-xs">{timeShort(msg.createdAt)}</span>
                  {isMe && (
                    isSending ? <Clock className="h-2.5 w-2.5 ml-0.5" /> :
                    isError ? <AlertCircle className="h-2.5 w-2.5 ml-0.5 text-red-400" /> :
                    msg.readAt ? <CheckCheck className="h-2.5 w-2.5 ml-0.5" /> :
                    <Check className="h-2.5 w-2.5 ml-0.5" />
                  )}
                </div>
              )}
            </div>
          )}

          {/* Admin badge */}
          {msg.type === "admin" && (
            <div className="flex items-center gap-1 mb-0.5">
              <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-500">
                {msg.senderUsername ? `ОТ АДМИНА ${msg.senderUsername}` : "Администрация"}
              </span>
            </div>
          )}

          {/* Voice */}
          {msg.type === "voice" && msg.audioUrl && (
            <VoiceMessage audioUrl={msg.audioUrl} duration={msg.audioDuration} isMe={isMe} theme={theme} />
          )}

          {/* Location */}
          {msg.type === "location" && msg.location && (
            <a
              href={`https://maps.google.com/?q=${msg.location.lat},${msg.location.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <div className="flex items-center gap-2 py-1">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: isMe ? "rgba(255,255,255,0.2)" : (accentHex + "20") }}
                >
                  <MapPin className="h-5 w-5" style={{ color: isMe ? "#fff" : accentHex }} />
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${isMe ? "" : ""}`}>Геолокация</p>
                  <p className={`text-xs truncate ${isMe ? "opacity-70" : "text-[var(--text-muted)]"}`}>
                    {msg.location.lat.toFixed(5)}, {msg.location.lng.toFixed(5)}
                  </p>
                </div>
              </div>
            </a>
          )}

          {/* Lobby invite card */}
          {msg.type === "lobby_invite" && msg.lobbyInvite && (
            <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-green-600" />
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  {msg.lobbyInvite.routeTitle}
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                {msg.lobbyInvite.type === "race" ? "🏃 Гонка" : msg.lobbyInvite.type === "event" ? "🎉 Ивент" : "🚶 Прогулка"}
                {" · "}{msg.lobbyInvite.participantCount}/{msg.lobbyInvite.maxParticipants} участников
              </p>
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent("lobby-join-from-chat", {
                    detail: { joinCode: msg.lobbyInvite.joinCode },
                  }));
                }}
                className="w-full rounded-lg bg-green-600 py-2 text-xs font-semibold text-white hover:bg-green-700 transition"
              >
                Присоединиться
              </button>
            </div>
          )}

          {/* Challenge card */}
          {msg.type === "challenge" && msg.challengeData && (
            <ChallengeCard challengeData={msg.challengeData} isMe={isMe} />
          )}

          {/* Text — ссылки кликабельные */}
          {msg.text && (
            <MessageTextWithLinks text={msg.text} className={`${isImageOnly ? "px-3 pt-1" : ""} ${fontClass} break-words whitespace-pre-wrap leading-snug`} />
          )}
          {msg.routeId && <RouteCard routeId={msg.routeId} />}
          {/* Превью ссылок (до 3 штук) */}
          {msg.text && !msg.routeId && extractUrls(msg.text).length > 0 && (
            <LinkPreview text={msg.text} />
          )}

          {/* Time + status (скрыто для image-only, время на фото) */}
          {!isImageOnly && (
            <div className="flex items-center justify-end gap-0.5 mt-0.5 leading-none"
              style={isMe ? { color: "rgba(255,255,255,0.6)" } : undefined}
            >
              {msg.editedAt && (
                <span className={`text-xs mr-0.5 ${isMe || theme.dark ? "" : "text-[var(--text-muted)]"}`}
                  style={!isMe && theme.dark ? { color: "rgba(226,232,240,0.4)" } : undefined}
                >ред.</span>
              )}
              <span className={`text-xs ${isMe || theme.dark ? "" : "text-[var(--text-muted)]"}`}
                style={!isMe && theme.dark ? { color: "rgba(226,232,240,0.4)" } : undefined}
              >{timeShort(msg.createdAt)}</span>
              {isMe && (
                isSending ? <Clock className="h-3 w-3 ml-0.5" /> :
                isError ? <AlertCircle className="h-3 w-3 ml-0.5 text-red-400" /> :
                msg.readAt ? <CheckCheck className="h-3 w-3 ml-0.5" /> :
                <Check className="h-3 w-3 ml-0.5" />
              )}
            </div>
          )}
        </div>

        {/* Error retry */}
        {isError && (
          <button
            onClick={() => msg._retryFn?.(msg.id)}
            className="flex items-center gap-1 mt-0.5 text-xs text-red-400 hover:text-red-300"
          >
            <RefreshCw className="h-3 w-3" /> Повторить
          </button>
        )}

        {/* Reaction badges */}
        {Object.keys(grouped_reactions).length > 0 && (
          <div className={`flex gap-1 mt-0.5 ${isMe ? "justify-end" : "justify-start"}`}>
            {Object.entries(grouped_reactions).map(([emoji, data]) => (
              <button
                key={emoji}
                onClick={() => onReaction(msg.id, emoji)}
                className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition ${
                  data.mine
                    ? "border-transparent"
                    : "bg-[var(--bg-elevated)] border-[var(--border-color)] text-[var(--text-secondary)]"
                }`}
                style={data.mine ? { backgroundColor: accentHex + "26", borderColor: accentHex + "66", color: accentHex } : undefined}
              >
                <span>{emoji}</span>
                {data.count > 1 && <span className="text-xs">{data.count}</span>}
              </button>
            ))}
          </div>
        )}

        {/* Context menu */}
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            msg={msg}
            isMe={isMe}
            onReply={() => onReply(msg)}
            onReact={(emoji) => onReaction(msg.id, emoji)}
            onDeleteAll={() => onDelete(msg.id, "all")}
            onDeleteSelf={() => onDelete(msg.id, "self")}
            onEdit={() => onEdit(msg)}
            onCopy={handleCopy}
            onPin={() => onPin(msg.id)}
            isPinned={isPinned}
            onClose={onCloseContextMenu}
          />
        )}
      </div>

    </div>
  );
}

export default function ChatView({ friendId, friend, onBack, inline = false, adminMode = false }) {
  const { user, authFetch: chatAuthFetch } = useUser();
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [editingMsg, setEditingMsg] = useState(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeContextMenu, setActiveContextMenu] = useState(null);
  const [showScrollFab, setShowScrollFab] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [galleryMsgId, setGalleryMsgId] = useState(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const topSentinelRef = useRef(null);
  const { count } = useUnreadCount();

  const conversationKey = adminMode
    ? `admin_${friendId}`
    : user ? [user.id, friendId].sort().join("_") : null;
  const {
    messages, loading, hasMore, loadingOlder, typingUsers, pinnedMessage,
    sendMessage, sendImage, sendVoice, sendLocation, retryMessage, deleteMessage, toggleReaction,
    editMessage, togglePin, loadOlder, sendTyping, clearMessages,
  } = useChatPolling(conversationKey, {
    interval: 15000,
    enabled: !!conversationKey,
    adminMode,
  });

  // Загрузка купленных тем чата
  const [premiumLoaded, setPremiumLoaded] = useState(false);
  useEffect(() => {
    if (!chatAuthFetch) return;
    chatAuthFetch("/api/shop/inventory")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!data) return;
        const themes = (data.items || [])
          .filter((i) => i.category === "chatTheme" && i.cssData?.id)
          .map((i) => i.cssData);
        if (themes.length > 0) addPremiumThemes(themes);
      })
      .catch(() => {})
      .finally(() => setPremiumLoaded(true));
  }, [chatAuthFetch]);

  // Тема чата (обновляется после загрузки премиум)
  const [chatTheme, setChatThemeState] = useState(() => getChatTheme(conversationKey));
  const [fontSize, setFontSize] = useState(() => conversationKey ? getChatFontSize(conversationKey) : "base");

  useEffect(() => {
    if (premiumLoaded && conversationKey) {
      setChatThemeState(getChatTheme(conversationKey));
    }
  }, [premiumLoaded, conversationKey]);
  const fontClass = FONT_CLASS[fontSize] || FONT_CLASS.base;

  const handleThemeChange = useCallback((themeId) => {
    const all = getAllChatThemes();
    const theme = all.find((t) => t.id === themeId) || CHAT_THEMES[0];
    setChatThemeState(theme);
    if (conversationKey) saveChatTheme(conversationKey, themeId);
  }, [conversationKey]);

  const handleFontSizeChange = useCallback((size) => {
    setFontSize(size);
  }, []);

  const handleClearHistory = useCallback(() => {
    if (clearMessages) clearMessages();
  }, [clearMessages]);

  // Chat active/closed events
  useEffect(() => {
    if (!conversationKey) return;
    window.dispatchEvent(new CustomEvent("chat-active", { detail: { conversationKey } }));
    return () => {
      window.dispatchEvent(new CustomEvent("chat-closed", { detail: { conversationKey } }));
    };
  }, [conversationKey]);

  // Автоскролл + new message detection
  const prevCountRef = useRef(0);
  const prevIdsRef = useRef(new Set());
  const [newMessageIds, setNewMessageIds] = useState(new Set());

  useEffect(() => {
    const currentIds = new Set(messages.map((m) => m.id));
    const newIds = new Set();
    for (const id of currentIds) {
      if (!prevIdsRef.current.has(id)) newIds.add(id);
    }

    if (newIds.size > 0 && prevIdsRef.current.size > 0) {
      setNewMessageIds(newIds);
      // Очищаем через 300ms (после анимации)
      setTimeout(() => setNewMessageIds(new Set()), 300);
    }

    // Автоскролл только если были внизу
    if (messages.length > prevCountRef.current) {
      const container = messagesContainerRef.current;
      if (container) {
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 200;
        if (isNearBottom || prevCountRef.current === 0) {
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
        }
      }
    }

    prevCountRef.current = messages.length;
    prevIdsRef.current = currentIds;
  }, [messages]);

  // Scroll FAB
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const handler = () => {
      const fromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      setShowScrollFab(fromBottom > 200);
    };
    container.addEventListener("scroll", handler, { passive: true });
    return () => container.removeEventListener("scroll", handler);
  }, []);

  // Infinite scroll up (IntersectionObserver)
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    const container = messagesContainerRef.current;
    if (!sentinel || !container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loadingOlder) {
          const prevHeight = container.scrollHeight;
          loadOlder().then(() => {
            // Сохраняем позицию скролла после загрузки старых
            requestAnimationFrame(() => {
              const newHeight = container.scrollHeight;
              container.scrollTop += newHeight - prevHeight;
            });
          });
        }
      },
      { root: container, threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingOlder, loadOlder]);

  // Сброс высоты textarea
  useEffect(() => {
    if (!text && textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [text]);

  const handleSend = async () => {
    if (editingMsg) {
      const trimmed = text.trim();
      if (!trimmed) return;
      await editMessage(editingMsg.id, trimmed);
      setEditingMsg(null);
      setText("");
      return;
    }

    // Image
    if (imagePreview) {
      await sendImage(imagePreview.file);
      setImagePreview(null);
      setText("");
      return;
    }

    const trimmed = text.trim();
    if (!trimmed) return;
    const replyId = replyTo?.id || null;
    setText("");
    setReplyTo(null);
    await sendMessage(trimmed, null, replyId);
  };

  const handleReply = useCallback((msg) => {
    setReplyTo(msg);
    setEditingMsg(null);
    setImagePreview(null);
    textareaRef.current?.focus();
  }, []);

  const handleEdit = useCallback((msg) => {
    setEditingMsg(msg);
    setText(msg.text || "");
    setReplyTo(null);
    setImagePreview(null);
    textareaRef.current?.focus();
  }, []);

  const handleDelete = useCallback(async (messageId, mode) => {
    await deleteMessage(messageId, mode);
  }, [deleteMessage]);

  const handleReaction = useCallback(async (messageId, emoji) => {
    await toggleReaction(messageId, emoji);
  }, [toggleReaction]);

  const handlePin = useCallback(async (messageId) => {
    await togglePin(messageId);
  }, [togglePin]);

  const handleJumpToMessage = useCallback((messageId) => {
    const el = messagesContainerRef.current?.querySelector(`[data-msg-id="${messageId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("animate-highlight");
      setTimeout(() => el.classList.remove("animate-highlight"), 1500);
    }
  }, []);

  const handleMsgContextMenu = useCallback((msgId, pos) => {
    setActiveContextMenu({ msgId, x: pos.x, y: pos.y });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setActiveContextMenu(null);
  }, []);

  const handleEmojiSelect = useCallback((emoji) => {
    setText((prev) => prev + emoji);
    setShowEmoji(false);
    textareaRef.current?.focus();
  }, []);

  const handleBellClick = () => {
    window.dispatchEvent(new Event("toggle-notification-bell"));
  };

  const handleFileSelect = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return;
    if (file.size > 10 * 1024 * 1024) return;
    setImagePreview({ file, url: URL.createObjectURL(file) });
    setEditingMsg(null);
    setReplyTo(null);
    e.target.value = "";
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Voice recording
  const { recording, duration: recDuration, audioBlob, error: recError, start: startRec, stop: stopRec, cancel: cancelRec, reset: resetRec } = useVoiceRecorder();

  // Отправка голосового после записи
  useEffect(() => {
    if (audioBlob && !recording) {
      sendVoice(audioBlob, recDuration);
      resetRec();
    }
  }, [audioBlob, recording, recDuration, sendVoice, resetRec]);

  // Группировка сообщений
  const processedMessages = useMemo(() => {
    const result = [];
    let lastDate = null;
    let lastSenderId = null;
    let lastTime = null;

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const msgDate = dateLabel(msg.createdAt);
      const msgTime = new Date(msg.createdAt).getTime();

      // Разделитель дат
      if (msgDate !== lastDate) {
        result.push({ type: "date", label: msgDate, key: `date-${msgDate}-${i}` });
        lastDate = msgDate;
        lastSenderId = null;
        lastTime = null;
      }

      // Группировка: тот же отправитель + < 2 минут
      const isGrouped = msg.senderId === lastSenderId && lastTime && (msgTime - lastTime < 2 * 60 * 1000);

      // Добавляем retry функцию для optimistic
      const enrichedMsg = msg._optimistic ? { ...msg, _retryFn: retryMessage } : msg;

      result.push({
        type: "message",
        msg: enrichedMsg,
        grouped: isGrouped,
        isNew: newMessageIds.has(msg.id),
        key: msg.id,
      });

      lastSenderId = msg.senderId;
      lastTime = msgTime;
    }

    return result;
  }, [messages, newMessageIds, retryMessage]);

  const friendOnline = isOnline(friend?.lastActivityAt);
  const friendStatus = formatLastSeen(friend?.lastActivityAt, friend?.trackingStatus);
  const isTyping = typingUsers.length > 0;
  const isAdminChatAsUser = adminMode && friendId === user?.id;

  // Скрываем BottomNav когда чат открыт (не inline)
  useEffect(() => {
    if (inline) return;
    const nav = document.querySelector("[data-bottom-nav]");
    if (nav) nav.style.display = "none";
    return () => {
      if (nav) nav.style.display = "";
    };
  }, [inline]);

  return (
    <div className={inline ? "flex flex-col h-full bg-[var(--bg-surface)]" : "fixed inset-0 z-[56] bg-[var(--bg-surface)] flex flex-col"}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[var(--bg-surface)] shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          {isAdminChatAsUser ? (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/15 shrink-0">
              <Shield className="h-4 w-4 text-red-500" />
            </div>
          ) : (
            <UserAvatar
              username={friend?.username || "?"}
              avatarUrl={friend?.avatarUrl}
              size="sm"
              online={friendOnline}
              equippedItems={friend?.equippedItems}
            />
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate leading-tight"
              style={{ color: (!isAdminChatAsUser && friend?.equippedItems?.usernameColor?.cssData?.color) || "var(--text-primary)" }}
            >
              {isAdminChatAsUser ? "Администрация" : (friend?.username || "Чат")}
            </p>
            {isTyping ? (
              <p className="text-xs leading-tight text-[var(--text-muted)]">печатает...</p>
            ) : !isAdminChatAsUser && friend?.lastActivityAt != null ? (
              <p className={`text-xs leading-tight ${friendOnline ? "text-green-500" : "text-[var(--text-muted)]"}`}>
                {friendStatus}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setShowSettings(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-[var(--bg-elevated)] transition"
          >
            <MoreVertical className="h-5 w-5 text-[var(--text-secondary)]" />
          </button>
          {!inline && (
            <button
              onClick={handleBellClick}
              className="relative flex h-10 w-10 items-center justify-center rounded-full hover:bg-[var(--bg-elevated)] transition"
            >
              <Bell className="h-5 w-5 text-[var(--text-secondary)]" />
              {count > 0 && (
                <span className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-xs font-bold text-white">
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Pinned message banner */}
      {pinnedMessage && (
        <PinnedMessageBanner
          message={pinnedMessage}
          onJump={handleJumpToMessage}
          onUnpin={() => handlePin(pinnedMessage.id)}
          canUnpin
        />
      )}

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-3"
        style={chatTheme.bg ? {
          backgroundImage: chatTheme.bg,
          backgroundSize: chatTheme.bgSize || "auto",
        } : undefined}
      >
        {/* Top sentinel for infinite scroll */}
        <div ref={topSentinelRef} className="h-1" />

        {loadingOlder && (
          <div className="py-2 text-center">
            <span className="text-xs text-[var(--text-muted)]">Загрузка...</span>
          </div>
        )}

        {loading ? (
          <div className="py-8 text-center text-sm" style={chatTheme.dark ? { color: "rgba(226,232,240,0.5)" } : undefined}>
            <span className={chatTheme.dark ? "" : "text-[var(--text-muted)]"}>Загрузка...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="py-8 text-center text-sm" style={chatTheme.dark ? { color: "rgba(226,232,240,0.5)" } : undefined}>
            <span className={chatTheme.dark ? "" : "text-[var(--text-muted)]"}>Начните общение!</span>
          </div>
        ) : (
          processedMessages.map((item) => {
            if (item.type === "date") {
              return <DateSeparator key={item.key} label={item.label} theme={chatTheme} />;
            }
            const msg = item.msg;
            const isMe = msg.senderId === user?.id || msg.senderId === "__me__";
            return (
              <MessageBubble
                key={item.key}
                msg={msg}
                isMe={isMe}
                user={user}
                friend={friend}
                grouped={item.grouped}
                isNew={item.isNew}
                onReply={handleReply}
                onDelete={handleDelete}
                onReaction={handleReaction}
                onEdit={handleEdit}
                onPin={handlePin}
                isPinned={pinnedMessage?.id === msg.id}
                theme={chatTheme}
                fontClass={fontClass}
                contextMenu={activeContextMenu?.msgId === msg.id ? activeContextMenu : null}
                onContextMenu={handleMsgContextMenu}
                onCloseContextMenu={handleCloseContextMenu}
                onImageClick={setGalleryMsgId}
              />
            );
          })
        )}

        {/* Typing indicator */}
        {isTyping && <TypingIndicator theme={chatTheme} />}

        <div ref={messagesEndRef} />
      </div>

      {/* Scroll FAB */}
      {showScrollFab && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-28 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg-elevated)] border border-[var(--border-color)] shadow-[var(--shadow-lg)] hover:bg-[var(--bg-surface)] transition"
        >
          <ChevronDown className="h-5 w-5 text-[var(--text-secondary)]" />
        </button>
      )}

      {/* Image preview */}
      {imagePreview && (
        <div className="px-4 shrink-0">
          <div className="flex items-center gap-2 px-3 py-2 rounded-t-xl bg-[var(--bg-elevated)] border border-b-0 border-[var(--border-color)]">
            <img src={imagePreview.url} alt="" className="h-16 w-16 rounded-lg object-cover" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-[var(--text-muted)]">Отправить фото</p>
            </div>
            <button onClick={() => { URL.revokeObjectURL(imagePreview.url); setImagePreview(null); }} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Edit preview */}
      {editingMsg && (
        <div className="px-4 shrink-0">
          <div className="flex items-center gap-2 px-3 py-2 rounded-t-xl bg-[var(--bg-elevated)] border border-b-0 border-[var(--border-color)]">
            <Pencil className="h-4 w-4 shrink-0" style={{ color: chatTheme.accent }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold" style={{ color: chatTheme.accent }}>Редактирование</p>
              <p className="text-xs text-[var(--text-muted)] truncate">{editingMsg.text}</p>
            </div>
            <button onClick={() => { setEditingMsg(null); setText(""); }} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Reply preview */}
      {replyTo && !editingMsg && (
        <div className="px-4 shrink-0">
          <div className="flex items-center gap-2 px-3 py-2 rounded-t-xl bg-[var(--bg-elevated)] border border-b-0 border-[var(--border-color)]">
            <Reply className="h-4 w-4 shrink-0" style={{ color: chatTheme.accent }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold" style={{ color: chatTheme.accent }}>
                {replyTo.senderId === user?.id ? "Вы" : (friend?.username || "Собеседник")}
              </p>
              <p className="text-xs text-[var(--text-muted)] truncate">{replyTo.text}</p>
            </div>
            <button onClick={() => setReplyTo(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Recording overlay */}
      {recording && (
        <div className="px-4 py-3 shrink-0 bg-[var(--bg-surface)]">
          <div className="flex items-center gap-3 max-w-2xl mx-auto">
            <button
              onClick={cancelRec}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10 text-red-500 transition hover:bg-red-500/20 shrink-0"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex-1 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm font-medium text-[var(--text-primary)]">
                {Math.floor(recDuration / 60)}:{(recDuration % 60).toString().padStart(2, "0")}
              </span>
              <div className="flex-1 h-1 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                <div className="h-full bg-red-500 rounded-full transition-all" style={{ width: `${Math.min(100, (recDuration / 120) * 100)}%` }} />
              </div>
            </div>
            <button
              onClick={stopRec}
              className="flex h-10 w-10 items-center justify-center rounded-full text-white shrink-0"
              style={{ backgroundColor: chatTheme.accent }}
            >
              <Square className="h-4 w-4" fill="currentColor" />
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      {!recording && (
        <div className={`px-4 py-3 shrink-0 ${inline ? "" : "pb-[env(safe-area-inset-bottom,12px)]"}`}>
          <div className="flex items-end gap-2 max-w-2xl mx-auto">
            {/* Emoji button */}
            <div className="relative shrink-0">
              <button
                onClick={() => setShowEmoji((v) => !v)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition"
              >
                <Smile className="h-5 w-5" />
              </button>
              {showEmoji && (
                <EmojiPicker
                  onSelect={handleEmojiSelect}
                  onClose={() => setShowEmoji(false)}
                />
              )}
            </div>

            {/* Attach image + location buttons */}
            {!editingMsg && (
              <div className="flex shrink-0">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition"
                >
                  <Paperclip className="h-5 w-5" />
                </button>
                <button
                  onClick={async () => {
                    if (!navigator.geolocation) return;
                    navigator.geolocation.getCurrentPosition(
                      (pos) => sendLocation(pos.coords.latitude, pos.coords.longitude),
                      () => {},
                      { enableHighAccuracy: true, timeout: 10000 }
                    );
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition"
                  title="Отправить геолокацию"
                >
                  <MapPin className="h-5 w-5" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
            )}

            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => {
                setText(e.target.value.slice(0, 1000));
                sendTyping();
                const ta = textareaRef.current;
                if (ta) {
                  ta.style.height = "auto";
                  ta.style.height = Math.min(ta.scrollHeight, 144) + "px";
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={editingMsg ? "Редактировать сообщение..." : "Сообщение..."}
              rows={1}
              className="flex-1 rounded-2xl border border-[var(--border-color)]/50 bg-[var(--bg-elevated)]/80 backdrop-blur-sm px-4 py-2.5 text-sm md:text-base text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition focus:border-[var(--text-secondary)] resize-none"
              style={{ maxHeight: "144px", overflowY: "auto", scrollbarWidth: "none", msOverflowStyle: "none" }}
            />

            {/* Send or Mic button */}
            {text.trim() || imagePreview || editingMsg ? (
              <button
                onClick={handleSend}
                disabled={!text.trim() && !imagePreview}
                className="flex h-10 w-10 items-center justify-center rounded-full text-white transition disabled:opacity-40 shrink-0"
                style={{ backgroundColor: chatTheme.accent }}
              >
                {editingMsg ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              </button>
            ) : (
              <button
                onClick={startRec}
                className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition shrink-0"
              >
                <Mic className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && conversationKey && (
        <ChatSettingsModal
          conversationKey={conversationKey}
          friend={friend}
          currentTheme={chatTheme}
          onThemeChange={handleThemeChange}
          onFontSizeChange={handleFontSizeChange}
          onClearHistory={handleClearHistory}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Media Gallery */}
      {galleryMsgId && (
        <MediaGallery
          messages={messages}
          initialMsgId={galleryMsgId}
          onClose={() => setGalleryMsgId(null)}
          getSenderName={(m) => m.senderId === user?.id ? "Вы" : (friend?.username || "Собеседник")}
        />
      )}
    </div>
  );
}
