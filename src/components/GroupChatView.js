"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { ArrowLeft, Send, Users, Settings, ChevronDown, Pin, Smile, Paperclip, MapPin, Mic, Square, Image as ImageIcon, Reply, Pencil, Trash2, Copy, Forward, X, Check, Search } from "lucide-react";
import PinnedMessageBanner from "./chat/PinnedMessageBanner";
import { useUser } from "./UserProvider";
import UserAvatar from "./UserAvatar";
import LinkPreview, { extractUrls, MessageTextWithLinks } from "./chat/LinkPreview";
import GroupSettingsModal from "./GroupSettingsModal";
import ForwardModal from "./chat/ForwardModal";
import VoiceMessage from "./VoiceMessage";
import useVoiceRecorder from "@/hooks/useVoiceRecorder";
import { getChatTheme, getAllChatThemes } from "@/lib/chatThemes";
import MediaGallery from "./chat/MediaGallery";

const REACTION_EMOJI = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

const EMOJI_LIST = [
  "😀", "😂", "🤣", "😊", "😍", "🥰", "😘", "😜",
  "🤔", "😎", "🥳", "😭", "😡", "🤯", "🥺", "👀",
  "👍", "👎", "❤️", "🔥", "💯", "✨", "🎉", "🙏",
  "👋", "🤝", "💪", "🫡", "🤗", "😴", "🤡", "💀",
];

const EDIT_WINDOW_MS = 15 * 60 * 1000; // 15 минут

function timeShort(date) {
  return new Date(date).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function highlightMentions(text, accentColor) {
  if (!text || !text.includes("@")) return text;
  const parts = text.split(/(@\w+)/g);
  return parts.map((part, i) =>
    part.startsWith("@") ? (
      <span key={i} className="font-semibold" style={{ color: accentColor }}>
        {part}
      </span>
    ) : part
  );
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

export default function GroupChatView({ group, onBack, onGroupUpdated, onLeaveGroup, onDeleteGroup }) {
  const { user, authFetch } = useUser();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [showScrollFab, setShowScrollFab] = useState(false);
  const [pinnedMessage, setPinnedMessage] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [galleryMsgId, setGalleryMsgId] = useState(null);

  // Reply state
  const [replyTo, setReplyTo] = useState(null);

  // Edit state
  const [editingMsg, setEditingMsg] = useState(null);
  const [editText, setEditText] = useState("");

  // Forward state
  const [forwardMsg, setForwardMsg] = useState(null);

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimeoutRef = useRef(null);

  // Mentions autocomplete
  const [mentionQuery, setMentionQuery] = useState(null); // { query: string, startPos: number }
  const [mentionResults, setMentionResults] = useState([]);

  const groupKey = `group_${group?.id}`;
  const [chatTheme, setChatThemeState] = useState(() => getChatTheme(groupKey));

  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const intervalRef = useRef(null);
  const lastTimestampRef = useRef(null);
  const lastTypingSentRef = useRef(0);
  const typingTimeoutsRef = useRef(new Map());
  const emojiRef = useRef(null);

  const { recording, duration: recDuration, audioBlob, start: startRecording, stop: stopRecording, cancel: cancelRecording, reset: resetRecording } = useVoiceRecorder();

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
        if (data.typingUsers) {
          setTypingUsers(data.typingUsers.filter((u) => u.userId !== user?.id));
        }
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
  }, [authFetch, group?.id, user?.id]);

  useEffect(() => {
    if (!group?.id) return;
    fetchMessages();
    intervalRef.current = setInterval(() => {
      if (lastTimestampRef.current) fetchMessages(lastTimestampRef.current);
    }, 10000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [group?.id, fetchMessages]);

  // SSE typing events
  useEffect(() => {
    const handler = (e) => {
      const data = e.detail;
      if (data?.type === "group_typing" && data.groupId === group?.id && data.userId !== user?.id) {
        setTypingUsers((prev) => {
          const exists = prev.some((u) => u.userId === data.userId);
          if (exists) return prev;
          return [...prev, { userId: data.userId, username: data.username }];
        });
        const key = data.userId;
        if (typingTimeoutsRef.current.has(key)) clearTimeout(typingTimeoutsRef.current.get(key));
        typingTimeoutsRef.current.set(key, setTimeout(() => {
          setTypingUsers((prev) => prev.filter((u) => u.userId !== key));
          typingTimeoutsRef.current.delete(key);
        }, 4000));
      }
    };
    window.addEventListener("chat-typing", handler);
    const timeouts = typingTimeoutsRef.current;
    return () => {
      window.removeEventListener("chat-typing", handler);
      timeouts.forEach((t) => clearTimeout(t));
    };
  }, [group?.id, user?.id]);

  // Close emoji picker on outside click
  useEffect(() => {
    if (!showEmojiPicker) return;
    const handler = (e) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target)) setShowEmojiPicker(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showEmojiPicker]);

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

  const handleReaction = useCallback(async (messageId, emoji) => {
    if (!authFetch || !group?.id) return;
    try {
      const res = await authFetch(`/api/groups/${group.id}/messages/${messageId}/react`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      if (res.ok) {
        const { reactions } = await res.json();
        setMessages((prev) => prev.map((m) =>
          m.id === messageId ? { ...m, reactions } : m
        ));
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
    setContextMenu({ msgId, x: Math.min(e.clientX, window.innerWidth - 200), y: Math.min(e.clientY, window.innerHeight - 300) });
  }, []);

  const handleLongPress = useCallback((msgId, rect) => {
    setContextMenu({ msgId, x: Math.min(rect.left, window.innerWidth - 200), y: Math.min(rect.top - 10, window.innerHeight - 300) });
  }, []);

  const sendTyping = useCallback(async () => {
    if (!authFetch || !group?.id) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < 3000) return;
    lastTypingSentRef.current = now;
    try {
      await authFetch(`/api/groups/${group.id}/typing`, { method: "POST" });
    } catch { /* ignore */ }
  }, [authFetch, group?.id]);

  // --- Reply ---
  const handleReply = useCallback((msg) => {
    setReplyTo({ id: msg.id, senderName: msg.senderUsername, text: msg.text || "[Медиа]" });
    setEditingMsg(null);
    setEditText("");
    setContextMenu(null);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  const cancelReply = useCallback(() => {
    setReplyTo(null);
  }, []);

  // --- Edit ---
  const handleStartEdit = useCallback((msg) => {
    setEditingMsg(msg);
    setEditText(msg.text || "");
    setReplyTo(null);
    setContextMenu(null);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingMsg(null);
    setEditText("");
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingMsg || !authFetch || !group?.id) return;
    const trimmed = editText.trim();
    if (!trimmed || trimmed === editingMsg.text) { cancelEdit(); return; }

    try {
      const res = await authFetch(`/api/groups/${group.id}/messages/${editingMsg.id}/edit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => prev.map((m) =>
          m.id === editingMsg.id ? { ...m, text: data.text, editedAt: data.editedAt } : m
        ));
      }
    } catch { /* ignore */ }
    cancelEdit();
  }, [editingMsg, editText, authFetch, group?.id, cancelEdit]);

  // --- Delete ---
  const handleDelete = useCallback(async (messageId, mode) => {
    if (!authFetch || !group?.id) return;
    try {
      const res = await authFetch(`/api/groups/${group.id}/messages/${messageId}?mode=${mode}`, { method: "DELETE" });
      if (res.ok) {
        if (mode === "all") {
          setMessages((prev) => prev.filter((m) => m.id !== messageId));
        } else {
          setMessages((prev) => prev.filter((m) => m.id !== messageId));
        }
      }
    } catch { /* ignore */ }
    setDeleteConfirm(null);
  }, [authFetch, group?.id]);

  // --- Copy ---
  const handleCopy = useCallback((text) => {
    if (text) navigator.clipboard.writeText(text);
    setContextMenu(null);
  }, []);

  // --- Forward ---
  const handleForward = useCallback((msg) => {
    setForwardMsg(msg);
    setContextMenu(null);
  }, []);

  // --- Search ---
  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await authFetch(`/api/groups/${group?.id}/messages/search?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.results || []);
        }
      } catch { /* ignore */ }
      finally { setSearchLoading(false); }
    }, 400);
  }, [authFetch, group?.id]);

  const handleSearchJump = useCallback((messageId) => {
    setShowSearch(false);
    setSearchQuery("");
    setSearchResults([]);
    handleJumpToMessage(messageId);
  }, [handleJumpToMessage]);

  // --- Mention select ---
  const handleMentionSelect = useCallback((member) => {
    if (!mentionQuery) return;
    const currentText = editingMsg ? editText : text;
    const before = currentText.slice(0, mentionQuery.startPos);
    const after = currentText.slice(mentionQuery.startPos + mentionQuery.query.length + 1); // +1 for @
    const newText = `${before}@${member.username} ${after}`;
    if (editingMsg) {
      setEditText(newText);
    } else {
      setText(newText);
    }
    setMentionQuery(null);
    setMentionResults([]);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, [mentionQuery, editingMsg, editText, text]);

  const handleSend = async () => {
    // If editing, save edit instead
    if (editingMsg) {
      handleSaveEdit();
      return;
    }

    const trimmed = text.trim();
    if (!trimmed && !imagePreview) return;

    // Image upload
    if (imagePreview) {
      setUploading(true);
      try {
        const form = new FormData();
        form.append("file", imagePreview.file);
        if (trimmed) form.append("text", trimmed);
        const res = await authFetch(`/api/groups/${group.id}/messages/upload`, { method: "POST", body: form });
        if (res.ok) {
          const msg = await res.json();
          lastTimestampRef.current = msg.createdAt;
          setMessages((prev) => [...prev, msg]);
        }
      } catch { /* ignore */ }
      finally { setUploading(false); setImagePreview(null); setText(""); setReplyTo(null); }
      return;
    }

    setText("");
    const currentReplyTo = replyTo;
    setReplyTo(null);

    const tempMsg = {
      id: `_temp_${Date.now()}`,
      senderId: user.id,
      senderUsername: user.username,
      senderAvatarUrl: user.avatarUrl,
      text: trimmed,
      type: "text",
      createdAt: new Date().toISOString(),
      reactions: [],
      replyToId: currentReplyTo?.id || null,
      replyTo: currentReplyTo ? { senderName: currentReplyTo.senderName, text: currentReplyTo.text } : null,
      _optimistic: true,
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      const res = await authFetch(`/api/groups/${group.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed, replyToId: currentReplyTo?.id || null }),
      });
      if (res.ok) {
        const msg = await res.json();
        lastTimestampRef.current = msg.createdAt;
        setMessages((prev) => prev.map((m) => m.id === tempMsg.id ? msg : m));
      }
    } catch { /* ignore */ }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImagePreview({ file, url });
  };

  // Отправка голосового после записи (через useEffect, как в ChatView)
  useEffect(() => {
    if (!audioBlob || recording || !authFetch || !group?.id) return;
    (async () => {
      setUploading(true);
      try {
        const form = new FormData();
        form.append("file", audioBlob, "voice.webm");
        form.append("duration", String(Math.round(recDuration)));
        const res = await authFetch(`/api/groups/${group.id}/messages/upload-audio`, { method: "POST", body: form });
        if (res.ok) {
          const msg = await res.json();
          lastTimestampRef.current = msg.createdAt;
          setMessages((prev) => [...prev, msg]);
        }
      } catch { /* ignore */ }
      finally { setUploading(false); resetRecording(); }
    })();
  }, [audioBlob, recording, authFetch, group?.id, recDuration, resetRecording]);

  const theme = chatTheme;

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

  // Скрываем BottomNav когда GroupChat открыт
  useEffect(() => {
    const nav = document.querySelector("[data-bottom-nav]");
    if (nav) nav.style.display = "none";
    return () => {
      if (nav) nav.style.display = "";
    };
  }, []);

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: !theme.bg?.includes("url") ? (theme.bg || "var(--bg-surface)") : undefined, backgroundImage: theme.bg?.includes("url") ? theme.bg : undefined, backgroundSize: theme.bg?.includes("url") ? (theme.bgSize || "auto") : undefined, backgroundRepeat: theme.bg?.includes("url") ? "no-repeat" : undefined, backgroundPosition: theme.bg?.includes("url") ? "center" : undefined }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0 bg-[var(--bg-surface)]/80 backdrop-blur-sm">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onBack} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <button onClick={() => setShowSettings(true)} className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-color)]/15 shrink-0 overflow-hidden">
              {group?.avatarUrl ? (
                <img src={group.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <Users className="h-4 w-4 text-[var(--accent-color)]" />
              )}
            </div>
            <div className="min-w-0 text-left">
              <p className="text-sm font-semibold text-[var(--text-primary)] truncate leading-tight">{group?.name}</p>
              <p className="text-xs text-[var(--text-muted)] leading-tight">{group?.memberCount} участников</p>
            </div>
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowSearch((v) => !v)} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-[var(--bg-elevated)] transition">
            <Search className="h-5 w-5 text-[var(--text-secondary)]" />
          </button>
          <button onClick={() => setShowSettings(true)} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-[var(--bg-elevated)] transition">
            <Settings className="h-5 w-5 text-[var(--text-secondary)]" />
          </button>
        </div>
      </div>

      {/* Search panel */}
      {showSearch && (
        <div className="px-4 py-2 shrink-0 border-b border-[var(--border-color)] bg-[var(--bg-surface)]">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
            <input
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Поиск по сообщениям..."
              autoFocus
              className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
            />
            <button onClick={() => { setShowSearch(false); setSearchQuery(""); setSearchResults([]); }} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition">
              <X className="h-4 w-4" />
            </button>
          </div>
          {searchQuery.trim().length >= 2 && (
            <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
              {searchLoading ? (
                <p className="text-xs text-[var(--text-muted)] py-2">Поиск...</p>
              ) : searchResults.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] py-2">Ничего не найдено</p>
              ) : (
                searchResults.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => handleSearchJump(r.id)}
                    className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-[var(--bg-elevated)] transition"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{r.senderUsername}</p>
                      <span className="text-xs text-[var(--text-muted)] shrink-0">{timeShort(r.createdAt)}</span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] truncate">{r.text}</p>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

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
      <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-3" onClick={() => { contextMenu && setContextMenu(null); showEmojiPicker && setShowEmojiPicker(false); }}>
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
            const canEdit = isMe && msg.type === "text" && msg.text && (Date.now() - new Date(msg.createdAt).getTime() < EDIT_WINDOW_MS) && !msg._optimistic;
            const canDeleteForAll = isMe && !msg._optimistic;

            const reactions = msg.reactions || [];
            const groupedReactions = {};
            for (const r of reactions) {
              if (!groupedReactions[r.emoji]) groupedReactions[r.emoji] = { count: 0, mine: false };
              groupedReactions[r.emoji].count++;
              if (r.userId === user?.id) groupedReactions[r.emoji].mine = true;
            }

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
                    <p className="text-xs font-semibold mb-0.5 pl-1" style={{ color: theme.accent }}>{msg.senderUsername}</p>
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
                    className={`rounded-2xl px-3 py-1.5 select-none ${isMe ? "rounded-br-sm" : `rounded-bl-sm ${!theme.dark ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]" : ""}`} ${msg._optimistic ? "opacity-70" : ""}`}
                    style={isMe ? { backgroundColor: theme.bubble, color: theme.bubbleText } : theme.dark ? { backgroundColor: "rgba(255,255,255,0.12)", color: "#e2e8f0" } : undefined}
                  >
                    {isMsgPinned && (
                      <div className="flex items-center gap-1 mb-0.5">
                        <Pin className="h-3 w-3 rotate-45" style={{ color: theme.accent }} />
                        <span className="text-xs font-medium" style={{ color: theme.accent }}>Закреплено</span>
                      </div>
                    )}

                    {/* Reply preview in message bubble */}
                    {msg.replyTo && (
                      <button
                        onClick={() => msg.replyToId && handleJumpToMessage(msg.replyToId)}
                        className={`flex items-stretch gap-2 mb-1 w-full text-left rounded-lg px-2 py-1 ${isMe ? "bg-white/10" : "bg-black/5"}`}
                      >
                        <div className="w-0.5 rounded-full shrink-0" style={{ backgroundColor: theme.accent }} />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color: theme.accent }}>
                            {msg.replyTo.senderName}
                          </p>
                          <p className="text-xs truncate opacity-70">
                            {msg.replyTo.text}
                          </p>
                        </div>
                      </button>
                    )}

                    {/* Image */}
                    {msg.type === "image" && msg.imageUrl && (
                      <img src={msg.imageUrl} alt="" className="rounded-xl max-w-full max-h-64 object-cover mb-1 cursor-pointer" onClick={() => setGalleryMsgId(msg.id)} />
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
                            style={{ backgroundColor: isMe ? "rgba(255,255,255,0.2)" : (theme.accent + "20") }}
                          >
                            <MapPin className="h-5 w-5" style={{ color: isMe ? "#fff" : theme.accent }} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium">Геолокация</p>
                            <p className={`text-xs truncate ${isMe ? "opacity-70" : "text-[var(--text-muted)]"}`}>
                              {msg.location.lat.toFixed(5)}, {msg.location.lng.toFixed(5)}
                            </p>
                          </div>
                        </div>
                      </a>
                    )}

                    {msg.text && (
                      <span className="text-sm break-words whitespace-pre-wrap leading-snug [&_.mention]:font-semibold">
                        {msg.text.includes("@")
                          ? highlightMentions(msg.text, theme.accent)
                          : <MessageTextWithLinks text={msg.text} className="" />
                        }
                      </span>
                    )}
                    {msg.text && extractUrls(msg.text).length > 0 && (
                      <LinkPreview text={msg.text} />
                    )}
                    <div className={`flex items-center justify-end gap-1 mt-0.5 leading-none`}
                      style={isMe ? { color: "rgba(255,255,255,0.6)" } : undefined}
                    >
                      {msg.editedAt && (
                        <span className={`text-xs italic ${isMe || theme.dark ? "" : "text-[var(--text-muted)]"}`}>ред.</span>
                      )}
                      <span className={`text-xs ${isMe || theme.dark ? "" : "text-[var(--text-muted)]"}`}>{timeShort(msg.createdAt)}</span>
                      {isMe && !msg._optimistic && <Check className="h-2.5 w-2.5 ml-0.5" />}
                    </div>
                  </div>

                  {/* Reaction badges */}
                  {Object.keys(groupedReactions).length > 0 && (
                    <div className={`flex gap-1 mt-0.5 ${isMe ? "justify-end" : "justify-start"}`}>
                      {Object.entries(groupedReactions).map(([emoji, data]) => (
                        <button
                          key={emoji}
                          onClick={() => handleReaction(msg.id, emoji)}
                          className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition`}
                          style={data.mine
                            ? { backgroundColor: theme.accent + "26", borderColor: theme.accent + "66", color: theme.accent }
                            : undefined
                          }
                        >
                          <span>{emoji}</span>
                          {data.count > 1 && <span className="text-xs">{data.count}</span>}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Context menu */}
                  {contextMenu?.msgId === msg.id && (
                    <div
                      className="fixed z-50 min-w-[180px] rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-color)] shadow-[var(--shadow-xl)] overflow-hidden py-1"
                      style={{ top: contextMenu.y, left: contextMenu.x }}
                    >
                      {/* Reactions row */}
                      <div className="flex gap-1 px-2 py-1.5 border-b border-[var(--border-color)]">
                        {REACTION_EMOJI.map((e) => (
                          <button
                            key={e}
                            onClick={() => { handleReaction(msg.id, e); setContextMenu(null); }}
                            className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-[var(--bg-surface)] transition text-base hover:scale-125"
                          >
                            {e}
                          </button>
                        ))}
                      </div>

                      {/* Reply */}
                      <button
                        onClick={() => handleReply(msg)}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition"
                      >
                        <Reply className="h-4 w-4" />
                        Ответить
                      </button>

                      {/* Copy */}
                      {msg.text && (
                        <button
                          onClick={() => handleCopy(msg.text)}
                          className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition"
                        >
                          <Copy className="h-4 w-4" />
                          Копировать
                        </button>
                      )}

                      {/* Edit (own messages, text only, within 15 min) */}
                      {canEdit && (
                        <button
                          onClick={() => handleStartEdit(msg)}
                          className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition"
                        >
                          <Pencil className="h-4 w-4" />
                          Редактировать
                        </button>
                      )}

                      {/* Forward */}
                      <button
                        onClick={() => handleForward(msg)}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition"
                      >
                        <Forward className="h-4 w-4" />
                        Переслать
                      </button>

                      {/* Pin */}
                      <button
                        onClick={() => { handleTogglePin(msg.id); setContextMenu(null); }}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition"
                      >
                        <Pin className="h-4 w-4" />
                        {isMsgPinned ? "Открепить" : "Закрепить"}
                      </button>

                      {/* Delete */}
                      {!msg._optimistic && (
                        <button
                          onClick={() => { setDeleteConfirm({ msgId: msg.id, isMe }); setContextMenu(null); }}
                          className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-red-500 hover:bg-[var(--bg-surface)] transition"
                        >
                          <Trash2 className="h-4 w-4" />
                          Удалить
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div className="px-4 pb-1">
          <p className="text-xs text-[var(--text-muted)] animate-pulse">
            {typingUsers.length === 1
              ? `${typingUsers[0].username} печатает...`
              : typingUsers.length === 2
                ? `${typingUsers[0].username} и ${typingUsers[1].username} печатают...`
                : `${typingUsers[0].username} и ещё ${typingUsers.length - 1} печатают...`
            }
          </p>
        </div>
      )}

      {/* Scroll FAB */}
      {showScrollFab && (
        <button
          onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })}
          className="absolute bottom-20 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg-elevated)] border border-[var(--border-color)] shadow-[var(--shadow-lg)] transition"
        >
          <ChevronDown className="h-5 w-5 text-[var(--text-secondary)]" />
        </button>
      )}

      {/* Image preview */}
      {imagePreview && (
        <div className="px-4 py-2 shrink-0 border-t border-[var(--border-color)] bg-[var(--bg-surface)]">
          <div className="relative inline-block">
            <img src={imagePreview.url} alt="" className="h-20 rounded-xl object-cover" />
            <button
              onClick={() => { URL.revokeObjectURL(imagePreview.url); setImagePreview(null); }}
              className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Reply / Edit bar above input */}
      {(replyTo || editingMsg) && (
        <div className="px-4 py-2 shrink-0 border-t border-[var(--border-color)] bg-[var(--bg-surface)] flex items-center gap-2">
          <div className="w-0.5 h-8 rounded-full shrink-0" style={{ backgroundColor: editingMsg ? "#f59e0b" : theme.accent }} />
          <div className="flex-1 min-w-0">
            {editingMsg ? (
              <>
                <p className="text-xs font-semibold text-amber-500">Редактирование</p>
                <p className="text-xs text-[var(--text-muted)] truncate">{editingMsg.text}</p>
              </>
            ) : (
              <>
                <p className="text-xs font-semibold" style={{ color: theme.accent }}>{replyTo.senderName}</p>
                <p className="text-xs text-[var(--text-muted)] truncate">{replyTo.text}</p>
              </>
            )}
          </div>
          <button
            onClick={editingMsg ? cancelEdit : cancelReply}
            className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 shrink-0 bg-[var(--bg-surface)]/80 backdrop-blur-sm">
        <div className="flex items-end gap-2 max-w-2xl mx-auto">
          {/* Emoji picker toggle */}
          <div className="relative">
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-[var(--bg-elevated)] transition shrink-0"
            >
              <Smile className="h-5 w-5 text-[var(--text-muted)]" />
            </button>
            {showEmojiPicker && (
              <div ref={emojiRef} className="absolute bottom-full left-0 mb-2 p-2 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-color)] shadow-[var(--shadow-lg)] z-10 w-[280px]">
                <div className="grid grid-cols-8 gap-1">
                  {EMOJI_LIST.map((e) => (
                    <button
                      key={e}
                      onClick={() => {
                        if (editingMsg) {
                          setEditText((prev) => prev + e);
                        } else {
                          setText((prev) => prev + e);
                        }
                        setShowEmojiPicker(false);
                        textareaRef.current?.focus();
                      }}
                      className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-[var(--bg-surface)] transition text-lg"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {recording ? (
            /* Recording UI — с ползунком как в ChatView */
            <div className="flex-1 flex items-center gap-3">
              <button
                onClick={cancelRecording}
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
                onClick={stopRecording}
                className="flex h-10 w-10 items-center justify-center rounded-full text-white shrink-0"
                style={{ backgroundColor: theme.accent }}
              >
                <Square className="h-4 w-4" fill="currentColor" />
              </button>
            </div>
          ) : (
            <>
              {/* Image attach */}
              {!editingMsg && (
                <>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-[var(--bg-elevated)] transition shrink-0"
                  >
                    <Paperclip className="h-5 w-5 text-[var(--text-muted)]" />
                  </button>
                  <button
                    onClick={async () => {
                      if (!navigator.geolocation || !authFetch || !group?.id) return;
                      navigator.geolocation.getCurrentPosition(
                        async (pos) => {
                          try {
                            const res = await authFetch(`/api/groups/${group.id}/messages`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ location: { lat: pos.coords.latitude, lng: pos.coords.longitude } }),
                            });
                            if (res.ok) {
                              const msg = await res.json();
                              setMessages((prev) => [...prev, msg]);
                            }
                          } catch { /* ignore */ }
                        },
                        () => {},
                        { enableHighAccuracy: true, timeout: 10000 }
                      );
                    }}
                    className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-[var(--bg-elevated)] transition shrink-0"
                    title="Отправить геолокацию"
                  >
                    <MapPin className="h-5 w-5 text-[var(--text-muted)]" />
                  </button>
                </>
              )}
              {/* Mentions autocomplete popup */}
              <div className="relative flex-1">
                {mentionQuery && mentionResults.length > 0 && (
                  <div className="absolute bottom-full left-0 right-0 mb-1 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-color)] shadow-[var(--shadow-lg)] z-20 overflow-hidden max-h-40 overflow-y-auto">
                    {mentionResults.map((m) => (
                      <button
                        key={m.userId}
                        onClick={() => handleMentionSelect(m)}
                        className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-[var(--bg-surface)] transition"
                      >
                        <UserAvatar username={m.username} avatarUrl={m.avatarUrl} size="xs" />
                        <span className="text-sm text-[var(--text-primary)]">{m.username}</span>
                      </button>
                    ))}
                  </div>
                )}
              <textarea
                ref={textareaRef}
                value={editingMsg ? editText : text}
                onChange={(e) => {
                  const val = e.target.value.slice(0, 1000);
                  if (editingMsg) {
                    setEditText(val);
                  } else {
                    setText(val);
                    sendTyping();
                  }
                  // Detect @mention
                  const cursorPos = e.target.selectionStart;
                  const textBeforeCursor = val.slice(0, cursorPos);
                  const atMatch = textBeforeCursor.match(/@(\w*)$/);
                  if (atMatch) {
                    const query = atMatch[1].toLowerCase();
                    const members = group?.members || [];
                    const filtered = members
                      .filter((m) => m.userId !== user?.id && m.username?.toLowerCase().startsWith(query))
                      .slice(0, 5);
                    setMentionQuery({ query, startPos: cursorPos - atMatch[0].length });
                    setMentionResults(filtered);
                  } else {
                    setMentionQuery(null);
                    setMentionResults([]);
                  }
                  const ta = textareaRef.current;
                  if (ta) { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 144) + "px"; }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    if (mentionQuery && mentionResults.length > 0) {
                      e.preventDefault();
                      handleMentionSelect(mentionResults[0]);
                      return;
                    }
                    e.preventDefault();
                    handleSend();
                  }
                  if (e.key === "Escape") {
                    if (mentionQuery) { setMentionQuery(null); setMentionResults([]); return; }
                    if (editingMsg) cancelEdit();
                    else if (replyTo) cancelReply();
                  }
                }}
                placeholder={editingMsg ? "Редактирование..." : "Сообщение..."}
                rows={1}
                className="w-full rounded-2xl border border-[var(--border-color)]/50 bg-[var(--bg-elevated)]/80 px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition focus:border-[var(--text-secondary)] resize-none"
                style={{ maxHeight: "144px", overflowY: "auto", scrollbarWidth: "none" }}
              />
              </div>

              {editingMsg ? (
                <button
                  onClick={handleSaveEdit}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-white transition shrink-0 bg-amber-500 hover:bg-amber-600"
                >
                  <Check className="h-4 w-4" />
                </button>
              ) : text.trim() || imagePreview ? (
                <button
                  onClick={handleSend}
                  disabled={uploading}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-white transition disabled:opacity-40 shrink-0"
                  style={{ backgroundColor: theme.accent }}
                >
                  <Send className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={startRecording}
                  className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-[var(--bg-elevated)] transition shrink-0"
                >
                  <Mic className="h-5 w-5 text-[var(--text-muted)]" />
                </button>
              )}
            </>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageSelect} />
      </div>

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative w-full max-w-xs rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-[var(--shadow-xl)] overflow-hidden p-4 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-3">Удалить сообщение?</h3>
            <div className="space-y-2">
              {deleteConfirm.isMe && (
                <button
                  onClick={() => handleDelete(deleteConfirm.msgId, "all")}
                  className="w-full rounded-xl py-2.5 text-sm font-medium text-red-500 bg-red-500/10 hover:bg-red-500/20 transition"
                >
                  Удалить у всех
                </button>
              )}
              <button
                onClick={() => handleDelete(deleteConfirm.msgId, "self")}
                className="w-full rounded-xl py-2.5 text-sm font-medium text-[var(--text-primary)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-elevated)]/80 transition"
              >
                Удалить у себя
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="w-full rounded-xl py-2.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Forward modal */}
      {forwardMsg && (
        <ForwardModal message={forwardMsg} onClose={() => setForwardMsg(null)} />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <GroupSettingsModal
          group={group}
          onClose={() => setShowSettings(false)}
          onGroupUpdated={onGroupUpdated}
          onLeaveGroup={onLeaveGroup}
          onDeleteGroup={onDeleteGroup}
          onThemeChange={(id) => {
            const all = getAllChatThemes();
            setChatThemeState(all.find((t) => t.id === id) || all[0]);
          }}
        />
      )}

      {/* Media Gallery */}
      {galleryMsgId && (
        <MediaGallery
          messages={messages}
          initialMsgId={galleryMsgId}
          onClose={() => setGalleryMsgId(null)}
          getSenderName={(m) => m.senderUsername || "Участник"}
        />
      )}
    </div>
  );
}
