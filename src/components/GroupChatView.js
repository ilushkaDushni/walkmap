"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { ArrowLeft, Send, Users, Settings, ChevronDown, Pin } from "lucide-react";
import PinnedMessageBanner from "./chat/PinnedMessageBanner";
import { useUser } from "./UserProvider";
import UserAvatar from "./UserAvatar";

function timeShort(date) {
  return new Date(date).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
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

export default function GroupChatView({ group, onBack, onSettings }) {
  const { user, authFetch } = useUser();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [showScrollFab, setShowScrollFab] = useState(false);
  const [pinnedMessage, setPinnedMessage] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);
  const textareaRef = useRef(null);
  const intervalRef = useRef(null);
  const lastTimestampRef = useRef(null);

  const fetchMessages = useCallback(async (after) => {
    if (!authFetch || !group?.id) return;
    try {
      const q = after ? `?after=${encodeURIComponent(after)}` : "?limit=50";
      const res = await authFetch(`/api/groups/${group.id}/messages${q}`);
      if (res.ok) {
        const data = await res.json();
        const msgs = data.messages || [];
        setHasMore(!!data.hasMore);
        if (data.pinnedMessage !== undefined && !after) setPinnedMessage(data.pinnedMessage);
        if (after && msgs.length > 0) {
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const newMsgs = msgs.filter((m) => !existingIds.has(m.id));
            return [...prev, ...newMsgs];
          });
        } else if (!after) {
          setMessages(msgs);
        }
        if (msgs.length > 0) {
          lastTimestampRef.current = msgs[msgs.length - 1].createdAt;
        }
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [authFetch, group?.id]);

  useEffect(() => {
    if (!group?.id) return;
    fetchMessages();
    intervalRef.current = setInterval(() => {
      if (lastTimestampRef.current) fetchMessages(lastTimestampRef.current);
    }, 10000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [group?.id, fetchMessages]);

  // Автоскролл
  const prevCountRef = useRef(0);
  useEffect(() => {
    if (messages.length > prevCountRef.current) {
      const container = containerRef.current;
      if (container) {
        const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 200;
        if (nearBottom || prevCountRef.current === 0) {
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
        }
      }
    }
    prevCountRef.current = messages.length;
  }, [messages]);

  // Scroll FAB
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handler = () => {
      setShowScrollFab(container.scrollHeight - container.scrollTop - container.clientHeight > 200);
    };
    container.addEventListener("scroll", handler, { passive: true });
    return () => container.removeEventListener("scroll", handler);
  }, []);

  const handleTogglePin = useCallback(async (messageId) => {
    if (!authFetch || !group?.id) return;
    try {
      const res = await authFetch(`/api/groups/${group.id}/messages/${messageId}/pin`, { method: "PATCH" });
      if (res.ok) {
        const data = await res.json();
        setPinnedMessage(data.pinnedMessage);
      }
    } catch { /* ignore */ }
  }, [authFetch, group?.id]);

  const handleJumpToMessage = useCallback((messageId) => {
    const el = containerRef.current?.querySelector(`[data-msg-id="${messageId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("animate-highlight");
      setTimeout(() => el.classList.remove("animate-highlight"), 1500);
    }
  }, []);

  const handleContextMenu = useCallback((e, msgId) => {
    e.preventDefault();
    setContextMenu({ msgId, x: Math.min(e.clientX, window.innerWidth - 180), y: Math.min(e.clientY, window.innerHeight - 120) });
  }, []);

  const handleLongPress = useCallback((msgId, rect) => {
    setContextMenu({ msgId, x: Math.min(rect.left, window.innerWidth - 180), y: Math.min(rect.top - 10, window.innerHeight - 120) });
  }, []);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setText("");

    // Optimistic
    const tempMsg = {
      id: `_temp_${Date.now()}`,
      senderId: user.id,
      senderUsername: user.username,
      senderAvatarUrl: user.avatarUrl,
      text: trimmed,
      type: "text",
      createdAt: new Date().toISOString(),
      reactions: [],
      _optimistic: true,
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      const res = await authFetch(`/api/groups/${group.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      if (res.ok) {
        const msg = await res.json();
        lastTimestampRef.current = msg.createdAt;
        setMessages((prev) => prev.map((m) => m.id === tempMsg.id ? msg : m));
      }
    } catch { /* ignore */ }
  };

  const processedMessages = useMemo(() => {
    const result = [];
    let lastDate = null;
    let lastSenderId = null;
    let lastTime = null;

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const msgDate = dateLabel(msg.createdAt);
      if (msgDate !== lastDate) {
        result.push({ type: "date", label: msgDate, key: `date-${msgDate}-${i}` });
        lastDate = msgDate;
        lastSenderId = null;
        lastTime = null;
      }
      const msgTime = new Date(msg.createdAt).getTime();
      const grouped = msg.senderId === lastSenderId && lastTime && (msgTime - lastTime < 2 * 60 * 1000);
      result.push({ type: "message", msg, grouped, key: msg.id });
      lastSenderId = msg.senderId;
      lastTime = msgTime;
    }
    return result;
  }, [messages]);

  return (
    <div className="flex flex-col h-full bg-[var(--bg-surface)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onBack} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-color)]/15 shrink-0">
            <Users className="h-4 w-4 text-[var(--accent-color)]" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--text-primary)] truncate leading-tight">{group?.name}</p>
            <p className="text-xs text-[var(--text-muted)] leading-tight">{group?.memberCount} участников</p>
          </div>
        </div>
        {onSettings && (
          <button onClick={onSettings} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-[var(--bg-elevated)] transition">
            <Settings className="h-5 w-5 text-[var(--text-secondary)]" />
          </button>
        )}
      </div>

      {/* Pinned message banner */}
      {pinnedMessage && (
        <PinnedMessageBanner
          message={pinnedMessage}
          onJump={handleJumpToMessage}
          onUnpin={() => handleTogglePin(pinnedMessage.id)}
          canUnpin
        />
      )}

      {/* Messages */}
      <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-3" onClick={() => contextMenu && setContextMenu(null)}>
        {loading ? (
          <div className="py-8 text-center text-sm text-[var(--text-muted)]">Загрузка...</div>
        ) : messages.length === 0 ? (
          <div className="py-8 text-center text-sm text-[var(--text-muted)]">Начните общение!</div>
        ) : (
          processedMessages.map((item) => {
            if (item.type === "date") {
              return (
                <div key={item.key} className="flex items-center justify-center py-2">
                  <span className="px-3 py-0.5 rounded-full text-xs font-medium bg-[var(--bg-elevated)]/60 text-[var(--text-muted)]">{item.label}</span>
                </div>
              );
            }
            const msg = item.msg;
            const isMe = msg.senderId === user?.id;
            const isMsgPinned = pinnedMessage?.id === msg.id;
            return (
              <div key={item.key} data-msg-id={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"} ${item.grouped ? "mt-0.5" : "mt-2"}`}>
                {!isMe && !item.grouped && (
                  <div className="shrink-0 mr-2 self-end">
                    <UserAvatar username={msg.senderUsername || "?"} avatarUrl={msg.senderAvatarUrl} size="sm" equippedItems={msg.senderEquippedItems} />
                  </div>
                )}
                {!isMe && item.grouped && <div className="w-8 mr-2 shrink-0" />}
                <div className="max-w-[min(75%,480px)] relative">
                  {!isMe && !item.grouped && (
                    <p className="text-xs font-semibold text-[var(--accent-color)] mb-0.5 pl-1">{msg.senderUsername}</p>
                  )}
                  <div
                    onContextMenu={(e) => handleContextMenu(e, msg.id)}
                    onTouchStart={() => {
                      const timer = setTimeout(() => {
                        const el = containerRef.current?.querySelector(`[data-msg-id="${msg.id}"]`);
                        if (el) handleLongPress(msg.id, el.getBoundingClientRect());
                      }, 500);
                      msg._lpTimer = timer;
                    }}
                    onTouchEnd={() => { if (msg._lpTimer) clearTimeout(msg._lpTimer); }}
                    onTouchCancel={() => { if (msg._lpTimer) clearTimeout(msg._lpTimer); }}
                    className={`rounded-2xl px-3 py-1.5 select-none ${isMe ? "rounded-br-sm bg-[var(--accent-color)] text-white" : "rounded-bl-sm bg-[var(--bg-elevated)] text-[var(--text-primary)]"} ${msg._optimistic ? "opacity-70" : ""}`}
                  >
                    {isMsgPinned && (
                      <div className="flex items-center gap-1 mb-0.5">
                        <Pin className="h-3 w-3 rotate-45 text-[var(--accent-color)]" />
                        <span className="text-xs text-[var(--accent-color)] font-medium">Закреплено</span>
                      </div>
                    )}
                    <p className="text-sm break-words whitespace-pre-wrap leading-snug">{msg.text}</p>
                    <div className={`flex items-center justify-end gap-0.5 mt-0.5 ${isMe ? "text-white/60" : ""}`}>
                      <span className={`text-xs ${isMe ? "" : "text-[var(--text-muted)]"}`}>{timeShort(msg.createdAt)}</span>
                    </div>
                  </div>
                  {/* Context menu */}
                  {contextMenu?.msgId === msg.id && (
                    <div
                      className="fixed z-50 min-w-[160px] rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-color)] shadow-[var(--shadow-xl)] overflow-hidden py-1"
                      style={{ top: contextMenu.y, left: contextMenu.x }}
                    >
                      <button
                        onClick={() => { handleTogglePin(msg.id); setContextMenu(null); }}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition"
                      >
                        <Pin className="h-4 w-4" />
                        {isMsgPinned ? "Открепить" : "Закрепить"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Scroll FAB */}
      {showScrollFab && (
        <button
          onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })}
          className="absolute bottom-20 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg-elevated)] border border-[var(--border-color)] shadow-[var(--shadow-lg)] transition"
        >
          <ChevronDown className="h-5 w-5 text-[var(--text-secondary)]" />
        </button>
      )}

      {/* Input */}
      <div className="px-4 py-3 shrink-0">
        <div className="flex items-end gap-2 max-w-2xl mx-auto">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value.slice(0, 1000));
              const ta = textareaRef.current;
              if (ta) { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 144) + "px"; }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
            placeholder="Сообщение..."
            rows={1}
            className="flex-1 rounded-2xl border border-[var(--border-color)]/50 bg-[var(--bg-elevated)]/80 px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition focus:border-[var(--text-secondary)] resize-none"
            style={{ maxHeight: "144px", overflowY: "auto", scrollbarWidth: "none" }}
          />
          <button
            onClick={handleSend}
            disabled={!text.trim()}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent-color)] text-white transition disabled:opacity-40 shrink-0"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
