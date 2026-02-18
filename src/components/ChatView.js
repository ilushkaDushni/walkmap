"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, Send, MapPin, Bell, X, Reply, Smile, Check, CheckCheck, Trash2, MoreVertical } from "lucide-react";
import { useUser } from "./UserProvider";
import UserAvatar from "./UserAvatar";
import useChatPolling from "@/hooks/useChatPolling";
import useUnreadCount from "@/hooks/useUnreadCount";
import Link from "next/link";
import { isOnline, formatLastSeen } from "@/lib/onlineStatus";
import { getChatTheme, setChatTheme as saveChatTheme, CHAT_THEMES } from "@/lib/chatThemes";
import { getChatFontSize } from "@/lib/chatSettings";
import ChatSettingsModal from "./ChatSettingsModal";

const FONT_CLASS = { sm: "text-xs", base: "text-sm", lg: "text-base" };

function timeShort(date) {
  const d = new Date(date);
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
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
          <p className="text-[10px] text-[var(--text-muted)]">{(route.distance / 1000).toFixed(1)} км</p>
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
    <div ref={ref} className="absolute bottom-full left-0 mb-2 p-2 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-color)] shadow-lg z-10 w-[280px]">
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
function ContextMenu({ x, y, onReply, onReact, onDeleteAll, onDeleteSelf, onClose }) {
  const ref = useRef(null);
  const [showReactionRow, setShowReactionRow] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[180px] rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-color)] shadow-xl overflow-hidden py-1"
      style={{ top: y, left: x }}
    >
      {/* Reaction row */}
      {showReactionRow && (
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
      )}
      <button
        onClick={() => setShowReactionRow((v) => !v)}
        className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition"
      >
        <Smile className="h-4 w-4" />
        Реакция
      </button>
      <button
        onClick={() => { onReply(); onClose(); }}
        className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition"
      >
        <Reply className="h-4 w-4" />
        Ответить
      </button>
      <button
        onClick={() => { onDeleteAll(); onClose(); }}
        className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-red-500 hover:bg-[var(--bg-surface)] transition"
      >
        <Trash2 className="h-4 w-4" />
        Удалить у всех
      </button>
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

// --- Message Bubble ---
function MessageBubble({ msg, isMe, user, friend, onReply, onDelete, onReaction, theme, fontClass }) {
  const [contextMenu, setContextMenu] = useState(null);
  const longPressTimer = useRef(null);
  const bubbleRef = useRef(null);

  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - 200);
    setContextMenu({ x, y });
  }, []);

  const handleTouchStart = useCallback(() => {
    longPressTimer.current = setTimeout(() => {
      if (bubbleRef.current) {
        const rect = bubbleRef.current.getBoundingClientRect();
        const x = Math.min(rect.left, window.innerWidth - 200);
        const y = Math.min(rect.top - 10, window.innerHeight - 200);
        setContextMenu({ x, y });
      }
    }, 500);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const reactions = msg.reactions || [];
  const grouped = {};
  for (const r of reactions) {
    if (!grouped[r.emoji]) grouped[r.emoji] = { count: 0, mine: false };
    grouped[r.emoji].count++;
    if (r.userId === user?.id) grouped[r.emoji].mine = true;
  }

  const accentHex = theme.accent;

  return (
    <div className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
      <div className="relative max-w-[min(75%,480px)]">
        <div
          ref={bubbleRef}
          onContextMenu={handleContextMenu}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          className={`rounded-2xl px-3 py-1.5 select-none ${
            isMe
              ? "rounded-br-sm"
              : `rounded-bl-sm ${theme.dark ? "" : "bg-[var(--bg-elevated)] text-[var(--text-primary)]"}`
          }`}
          style={isMe
            ? { backgroundColor: theme.bubble, color: theme.bubbleText }
            : theme.dark ? { backgroundColor: "rgba(255,255,255,0.12)", color: "#e2e8f0" } : undefined
          }
        >
          {/* Reply quote */}
          {msg.replyTo && (
            <div className={`mb-1 pl-2 border-l-2 rounded-sm`}
              style={isMe ? { borderColor: "rgba(255,255,255,0.5)" } : { borderColor: theme.dark ? "rgba(226,232,240,0.3)" : accentHex + "80" }}
            >
              <p className="text-[10px] font-semibold"
                style={isMe ? { color: "rgba(255,255,255,0.8)" } : { color: accentHex }}
              >
                {msg.replyTo.senderId === user?.id ? "Вы" : (msg.replyTo.senderName || friend?.username)}
              </p>
              <p className={`text-[11px] truncate ${isMe || theme.dark ? "" : "text-[var(--text-muted)]"}`}
                style={isMe ? { color: "rgba(255,255,255,0.6)" } : theme.dark ? { color: "rgba(226,232,240,0.5)" } : undefined}
              >
                {msg.replyTo.text}
              </p>
            </div>
          )}

          <p className={`${fontClass} break-words whitespace-pre-wrap leading-snug`}>{msg.text}</p>
          {msg.routeId && <RouteCard routeId={msg.routeId} />}

          {/* Time + read status */}
          <div className={`flex items-center justify-end gap-0.5 mt-0.5 leading-none`}
            style={isMe ? { color: "rgba(255,255,255,0.6)" } : undefined}
          >
            <span className={`text-[10px] ${isMe || theme.dark ? "" : "text-[var(--text-muted)]"}`}
              style={!isMe && theme.dark ? { color: "rgba(226,232,240,0.4)" } : undefined}
            >{timeShort(msg.createdAt)}</span>
            {isMe && (
              msg.readAt
                ? <CheckCheck className="h-3 w-3 ml-0.5" />
                : <Check className="h-3 w-3 ml-0.5" />
            )}
          </div>
        </div>

        {/* Reaction badges */}
        {Object.keys(grouped).length > 0 && (
          <div className={`flex gap-1 mt-0.5 ${isMe ? "justify-end" : "justify-start"}`}>
            {Object.entries(grouped).map(([emoji, data]) => (
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
                {data.count > 1 && <span className="text-[10px]">{data.count}</span>}
              </button>
            ))}
          </div>
        )}

        {/* Context menu */}
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onReply={() => onReply(msg)}
            onReact={(emoji) => onReaction(msg.id, emoji)}
            onDeleteAll={() => onDelete(msg.id, "all")}
            onDeleteSelf={() => onDelete(msg.id, "self")}
            onClose={() => setContextMenu(null)}
          />
        )}
      </div>
    </div>
  );
}

export default function ChatView({ friendId, friend, onBack, inline = false }) {
  const { user } = useUser();
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const { count } = useUnreadCount();

  const conversationKey = user ? [user.id, friendId].sort().join("_") : null;
  const { messages, loading, sendMessage, deleteMessage, toggleReaction, clearMessages } = useChatPolling(conversationKey, {
    interval: 5000,
    enabled: !!conversationKey,
  });

  // Тема чата
  const [chatTheme, setChatThemeState] = useState(() => getChatTheme(conversationKey));
  const [fontSize, setFontSize] = useState(() => conversationKey ? getChatFontSize(conversationKey) : "base");
  const fontClass = FONT_CLASS[fontSize] || FONT_CLASS.base;

  const handleThemeChange = useCallback((themeId) => {
    const theme = CHAT_THEMES.find((t) => t.id === themeId) || CHAT_THEMES[0];
    setChatThemeState(theme);
    if (conversationKey) saveChatTheme(conversationKey, themeId);
  }, [conversationKey]);

  const handleFontSizeChange = useCallback((size) => {
    setFontSize(size);
  }, []);

  const handleClearHistory = useCallback(() => {
    if (clearMessages) clearMessages();
  }, [clearMessages]);

  // Сигнализируем MessageToast о том, что чат открыт/закрыт
  useEffect(() => {
    if (!conversationKey) return;
    window.dispatchEvent(new CustomEvent("chat-active", { detail: { conversationKey } }));
    return () => {
      window.dispatchEvent(new CustomEvent("chat-closed", { detail: { conversationKey } }));
    };
  }, [conversationKey]);

  // Автоскролл вниз только при добавлении новых сообщений
  const prevCountRef = useRef(0);
  useEffect(() => {
    if (messages.length > prevCountRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevCountRef.current = messages.length;
  }, [messages]);

  // Сброс высоты textarea когда текст пустой
  useEffect(() => {
    if (!text && textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [text]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const replyId = replyTo?.id || null;
    setText("");
    setReplyTo(null);
    await sendMessage(trimmed, null, replyId);
  };

  const handleReply = useCallback((msg) => {
    setReplyTo(msg);
    textareaRef.current?.focus();
  }, []);

  const handleDelete = useCallback(async (messageId, mode) => {
    await deleteMessage(messageId, mode);
  }, [deleteMessage]);

  const handleReaction = useCallback(async (messageId, emoji) => {
    await toggleReaction(messageId, emoji);
  }, [toggleReaction]);

  const handleEmojiSelect = useCallback((emoji) => {
    setText((prev) => prev + emoji);
    setShowEmoji(false);
    textareaRef.current?.focus();
  }, []);

  const handleBellClick = () => {
    window.dispatchEvent(new Event("toggle-notification-bell"));
  };

  const friendOnline = isOnline(friend?.lastActivityAt);
  const friendStatus = formatLastSeen(friend?.lastActivityAt);

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
          <UserAvatar
            username={friend?.username || "?"}
            avatarUrl={friend?.avatarUrl}
            size="sm"
            online={friendOnline}
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--text-primary)] truncate leading-tight">
              {friend?.username || "Чат"}
            </p>
            {friend?.lastActivityAt != null && (
              <p className={`text-[11px] leading-tight ${friendOnline ? "text-green-500" : "text-[var(--text-muted)]"}`}>
                {friendStatus}
              </p>
            )}
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
                <span className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white">
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-4 py-3 space-y-2"
        style={chatTheme.bg ? {
          background: chatTheme.bg,
          backgroundSize: chatTheme.bgSize || "auto",
        } : undefined}
      >
        {loading ? (
          <div className="py-8 text-center text-sm" style={chatTheme.dark ? { color: "rgba(226,232,240,0.5)" } : undefined}>
            <span className={chatTheme.dark ? "" : "text-[var(--text-muted)]"}>Загрузка...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="py-8 text-center text-sm" style={chatTheme.dark ? { color: "rgba(226,232,240,0.5)" } : undefined}>
            <span className={chatTheme.dark ? "" : "text-[var(--text-muted)]"}>Начните общение!</span>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              isMe={msg.senderId === user?.id}
              user={user}
              friend={friend}
              onReply={handleReply}
              onDelete={handleDelete}
              onReaction={handleReaction}
              theme={chatTheme}
              fontClass={fontClass}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply preview */}
      {replyTo && (
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

      {/* Input */}
      <div className={`px-4 py-3 shrink-0 ${inline ? "" : "pb-[env(safe-area-inset-bottom,12px)]"}`}>
        <div className={`flex items-end gap-2 max-w-2xl mx-auto ${inline ? "relative -left-40" : ""}`}>
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

          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value.slice(0, 1000));
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
            placeholder="Сообщение..."
            rows={1}
            className="flex-1 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-4 py-2.5 text-sm md:text-base text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition focus:border-[var(--text-secondary)] resize-none"
            style={{ maxHeight: "144px", overflowY: "auto", scrollbarWidth: "none", msOverflowStyle: "none" }}
          />
          <button
            onClick={handleSend}
            disabled={!text.trim()}
            className="flex h-10 w-10 items-center justify-center rounded-full text-white transition disabled:opacity-40 shrink-0"
            style={{ backgroundColor: chatTheme.accent }}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

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
    </div>
  );
}
