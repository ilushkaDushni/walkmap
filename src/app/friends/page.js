"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Users, UserPlus, Search, MessageCircle, Check, X, Clock, Eye, Shield, Plus } from "lucide-react";
import { useUser } from "@/components/UserProvider";
import UserAvatar from "@/components/UserAvatar";
import UserName from "@/components/UserName";
import ChatView from "@/components/ChatView";
import GroupChatView from "@/components/GroupChatView";
import CreateGroupModal from "@/components/CreateGroupModal";
import { useRouter } from "next/navigation";
import { isOnline, formatLastSeen } from "@/lib/onlineStatus";

const TABS = [
  { key: "friends", label: "Друзья", icon: Users },
  { key: "groups", label: "Группы", icon: MessageCircle },
  { key: "requests", label: "Заявки", icon: UserPlus },
  { key: "search", label: "Поиск", icon: Search },
];

export default function FriendsPage() {
  const { user, authFetch } = useUser();
  const router = useRouter();
  const [tab, setTab] = useState("friends");
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [chatFriendId, setChatFriendId] = useState(null);
  const [adminChatOpen, setAdminChatOpen] = useState(false);
  const [adminConversation, setAdminConversation] = useState(null); // { unread }
  const [unreadMap, setUnreadMap] = useState({}); // { friendId: count }
  const [contextMenu, setContextMenu] = useState(null); // { x, y, friend }
  const [groups, setGroups] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null); // group object
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const contextRef = useRef(null);
  const chatFriendIdRef = useRef(null);

  // Перенаправление гостей
  useEffect(() => {
    if (user === null) {
      window.dispatchEvent(new Event("open-profile-modal"));
    }
  }, [user]);

  const loadFriends = useCallback(async () => {
    if (!authFetch) return;
    try {
      const res = await authFetch("/api/friends");
      if (res.ok) {
        const data = await res.json();
        setFriends(data.friends || []);
      }
    } catch { /* ignore */ }
  }, [authFetch]);

  const loadRequests = useCallback(async () => {
    if (!authFetch) return;
    try {
      const res = await authFetch("/api/friends/pending");
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
      }
    } catch { /* ignore */ }
  }, [authFetch]);

  const loadUnread = useCallback(async () => {
    if (!authFetch) return;
    try {
      const res = await authFetch("/api/messages/conversations");
      if (res.ok) {
        const data = await res.json();
        const map = {};
        let adminConv = null;
        const activeFriend = chatFriendIdRef.current;
        for (const c of data.conversations || []) {
          if (c.isAdminConversation) {
            adminConv = { unread: adminChatOpen ? 0 : c.unread };
            continue;
          }
          if (c.unread > 0 && c.friendId !== activeFriend) map[c.friendId] = c.unread;
        }
        setUnreadMap(map);
        setAdminConversation(adminConv);
      }
    } catch { /* ignore */ }
  }, [authFetch, adminChatOpen]);

  const loadGroups = useCallback(async () => {
    if (!authFetch) return;
    try {
      const res = await authFetch("/api/groups");
      if (res.ok) {
        const data = await res.json();
        setGroups(data.groups || []);
      }
    } catch { /* ignore */ }
  }, [authFetch]);

  useEffect(() => {
    if (!user) return;
    loadFriends();
    loadRequests();
    loadUnread();
    loadGroups();
  }, [user, loadFriends, loadRequests, loadUnread, loadGroups]);

  // Обработка события open-chat (из NotificationBell)
  useEffect(() => {
    const handler = (e) => {
      const friendId = e.detail?.friendId;
      if (friendId) setChatFriendId(friendId);
    };
    const adminHandler = () => {
      setChatFriendId(null);
      setAdminChatOpen(true);
    };
    window.addEventListener("open-chat", handler);
    window.addEventListener("open-admin-chat", adminHandler);
    return () => {
      window.removeEventListener("open-chat", handler);
      window.removeEventListener("open-admin-chat", adminHandler);
    };
  }, []);

  const handleSearch = useCallback(async (q) => {
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await authFetch(`/api/friends/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.users || []);
      }
    } catch { /* ignore */ }
    finally { setSearching(false); }
  }, [authFetch]);

  useEffect(() => {
    const timer = setTimeout(() => handleSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  const handleAddFriend = async (targetUserId) => {
    try {
      const res = await authFetch("/api/friends/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId }),
      });
      const data = await res.json();
      if (res.ok) {
        // Обновляем статус в результатах поиска
        setSearchResults((prev) =>
          prev.map((u) =>
            u.id === targetUserId
              ? { ...u, friendStatus: data.status === "accepted" ? "friend" : "pending_sent" }
              : u
          )
        );
        if (data.status === "accepted") {
          loadFriends();
          loadRequests();
        }
      }
    } catch { /* ignore */ }
  };

  const handleAccept = async (requesterId) => {
    try {
      const res = await authFetch("/api/friends/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requesterId }),
      });
      if (res.ok) {
        setRequests((prev) => prev.filter((r) => r.id !== requesterId));
        loadFriends();
      }
    } catch { /* ignore */ }
  };

  const handleReject = async (requesterId) => {
    try {
      const res = await authFetch("/api/friends/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requesterId }),
      });
      if (res.ok) {
        setRequests((prev) => prev.filter((r) => r.id !== requesterId));
      }
    } catch { /* ignore */ }
  };

  // При открытии чата — сразу убираем бейдж непрочитанных для этого друга
  useEffect(() => {
    chatFriendIdRef.current = chatFriendId;
    if (!chatFriendId) return;
    setUnreadMap((prev) => {
      if (!prev[chatFriendId]) return prev;
      const next = { ...prev };
      delete next[chatFriendId];
      return next;
    });
    // Также слушаем приход новых сообщений — сбрасываем бейдж, пока чат открыт
    const handler = () => {
      setUnreadMap((prev) => {
        if (!prev[chatFriendId]) return prev;
        const next = { ...prev };
        delete next[chatFriendId];
        return next;
      });
    };
    window.addEventListener("refresh-unread", handler);
    return () => window.removeEventListener("refresh-unread", handler);
  }, [chatFriendId]);

  // При открытии admin чата — убираем бейдж
  useEffect(() => {
    if (adminChatOpen) {
      setAdminConversation((prev) => prev ? { ...prev, unread: 0 } : prev);
    }
  }, [adminChatOpen]);

  const handleCloseChat = useCallback(() => {
    setChatFriendId(null);
    setAdminChatOpen(false);
    setActiveGroup(null);
    loadUnread();
  }, [loadUnread]);

  const handleGroupUpdated = useCallback((updated) => {
    setActiveGroup((prev) => prev ? { ...prev, ...updated } : prev);
    setGroups((prev) => prev.map((g) => g.id === updated.id ? { ...g, ...updated } : g));
  }, []);

  const handleLeaveGroup = useCallback(async () => {
    if (!authFetch || !activeGroup) return;
    if (!confirm("Вы уверены, что хотите покинуть группу?")) return;
    try {
      const res = await authFetch(`/api/groups/${activeGroup.id}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: user.id }),
      });
      if (res.ok) {
        setActiveGroup(null);
        loadGroups();
      }
    } catch { /* ignore */ }
  }, [authFetch, activeGroup, user?.id, loadGroups]);

  const handleDeleteGroup = useCallback(async () => {
    if (!authFetch || !activeGroup) return;
    if (!confirm("Удалить группу? Это действие необратимо.")) return;
    try {
      const res = await authFetch(`/api/groups/${activeGroup.id}`, { method: "DELETE" });
      if (res.ok) {
        setActiveGroup(null);
        loadGroups();
      }
    } catch { /* ignore */ }
  }, [authFetch, activeGroup, loadGroups]);

  // Закрытие контекстного меню при клике вне
  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e) => {
      if (contextRef.current && !contextRef.current.contains(e.target)) {
        setContextMenu(null);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("scroll", () => setContextMenu(null), true);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("scroll", () => setContextMenu(null), true);
    };
  }, [contextMenu]);

  if (!user) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-[var(--text-muted)]">Войдите, чтобы видеть друзей</p>
      </div>
    );
  }

  const chatFriend = adminChatOpen
    ? { username: "Администрация" }
    : friends.find((f) => f.id === chatFriendId);
  const activeChatId = adminChatOpen ? user.id : chatFriendId;
  const hasActiveChat = activeChatId || activeGroup;

  const renderTabs = () => (
    <div className="flex gap-0.5 mb-4 rounded-xl bg-[var(--bg-elevated)] p-0.5">
      {TABS.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => setTab(key)}
          className={`flex-1 flex items-center justify-center gap-1 rounded-lg py-2 text-xs font-semibold transition ${
            tab === key
              ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm"
              : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
          {key === "requests" && requests.length > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-xs font-bold text-white">
              {requests.length}
            </span>
          )}
        </button>
      ))}
    </div>
  );

  const renderFriendItem = (f) => (
    <button
      key={f.id}
      onClick={() => { setAdminChatOpen(false); setChatFriendId(f.id); }}
      onContextMenu={(e) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, friend: f });
      }}
      className={`flex w-full items-center gap-3 rounded-2xl bg-[var(--bg-elevated)] px-4 py-3 text-left transition hover:bg-[var(--bg-elevated)]/80 shadow-[var(--shadow-sm)] ${
        chatFriendId === f.id ? "ring-2 ring-green-500" : ""
      }`}
    >
      <UserAvatar username={f.username} avatarUrl={f.avatarUrl} size="md" online={isOnline(f.lastActivityAt)} equippedItems={f.equippedItems} />
      <div className="flex-1 min-w-0">
        <UserName username={f.username} equippedItems={f.equippedItems} showTitle={false} />
        <p className={`text-xs truncate ${f.trackingStatus?.active ? "text-blue-500" : isOnline(f.lastActivityAt) ? "text-green-500" : "text-[var(--text-muted)]"}`}>
          {formatLastSeen(f.lastActivityAt, f.trackingStatus)}
        </p>
      </div>
      <div className="relative shrink-0">
        <MessageCircle className="h-4 w-4 text-[var(--text-muted)]" />
        {unreadMap[f.id] > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-xs font-bold text-white">
            {unreadMap[f.id] > 99 ? "99+" : unreadMap[f.id]}
          </span>
        )}
      </div>
    </button>
  );

  const renderTabContent = () => (
    <>
      {tab === "friends" && (
        <div className="space-y-2">
          {/* Закреплённый элемент "Администрация" */}
          {adminConversation && (
            <button
              onClick={() => { setChatFriendId(null); setAdminChatOpen(true); }}
              className={`flex w-full items-center gap-3 rounded-2xl bg-[var(--bg-elevated)] px-4 py-3 text-left transition hover:bg-[var(--bg-elevated)]/80 shadow-[var(--shadow-sm)] ${
                adminChatOpen ? "ring-2 ring-red-500" : ""
              }`}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/15 shrink-0">
                <Shield className="h-5 w-5 text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-red-500">Администрация</p>
                <p className="text-xs text-[var(--text-muted)] truncate">Чат с поддержкой</p>
              </div>
              <div className="relative shrink-0">
                <MessageCircle className="h-4 w-4 text-[var(--text-muted)]" />
                {adminConversation.unread > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-xs font-bold text-white">
                    {adminConversation.unread > 99 ? "99+" : adminConversation.unread}
                  </span>
                )}
              </div>
            </button>
          )}

          {friends.length === 0 && !adminConversation ? (
            <div className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto text-[var(--text-muted)] mb-3 opacity-40" />
              <p className="text-sm text-[var(--text-muted)]">У вас пока нет друзей</p>
              <button
                onClick={() => setTab("search")}
                className="mt-2 text-sm text-green-500 font-medium hover:underline"
              >
                Найти друзей
              </button>
            </div>
          ) : (
            friends.map((f) => renderFriendItem(f))
          )}
        </div>
      )}

      {tab === "groups" && (
        <div className="space-y-2">
          <button
            onClick={() => setShowCreateGroup(true)}
            className="flex w-full items-center gap-3 rounded-2xl bg-[var(--bg-elevated)] px-4 py-3 text-left transition hover:bg-[var(--bg-elevated)]/80 shadow-[var(--shadow-sm)]"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent-color)]/15 shrink-0">
              <Plus className="h-5 w-5 text-[var(--accent-color)]" />
            </div>
            <span className="text-sm font-semibold text-[var(--accent-color)]">Новая группа</span>
          </button>

          {groups.length === 0 ? (
            <div className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto text-[var(--text-muted)] mb-3 opacity-40" />
              <p className="text-sm text-[var(--text-muted)]">Нет групп</p>
            </div>
          ) : (
            groups.map((g) => (
              <button
                key={g.id}
                onClick={() => { setChatFriendId(null); setAdminChatOpen(false); setActiveGroup(g); }}
                className={`flex w-full items-center gap-3 rounded-2xl bg-[var(--bg-elevated)] px-4 py-3 text-left transition hover:bg-[var(--bg-elevated)]/80 shadow-[var(--shadow-sm)] ${
                  activeGroup?.id === g.id ? "ring-2 ring-[var(--accent-color)]" : ""
                }`}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent-color)]/15 shrink-0 overflow-hidden">
                  {g.avatarUrl ? (
                    <img src={g.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Users className="h-5 w-5 text-[var(--accent-color)]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{g.name}</p>
                  <p className="text-xs text-[var(--text-muted)] truncate">
                    {g.lastMessage ? g.lastMessage.senderUsername + ": " + g.lastMessage.text : `${g.memberCount} участников`}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {tab === "requests" && (
        <div className="space-y-2">
          {requests.length === 0 ? (
            <div className="py-12 text-center">
              <UserPlus className="h-12 w-12 mx-auto text-[var(--text-muted)] mb-3 opacity-40" />
              <p className="text-sm text-[var(--text-muted)]">Нет входящих заявок</p>
            </div>
          ) : (
            requests.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-2xl bg-[var(--bg-elevated)] px-4 py-3">
                <UserAvatar username={r.username} avatarUrl={r.avatarUrl} size="md" linkToProfile equippedItems={r.equippedItems} />
                <div className="flex-1 min-w-0">
                  <UserName username={r.username} equippedItems={r.equippedItems} linkToProfile />
                  {r.bio && (
                    <p className="text-xs text-[var(--text-muted)] truncate">{r.bio}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleAccept(r.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/10 text-green-500 hover:bg-green-500/20 transition"
                    title="Принять"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleReject(r.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 transition"
                    title="Отклонить"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "search" && (
        <div>
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по имени..."
              className="w-full rounded-2xl border border-[var(--border-color)] bg-[var(--bg-elevated)] pl-10 pr-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition focus:border-[var(--text-secondary)]"
              autoFocus
            />
          </div>

          {searchQuery.length < 2 ? (
            <div className="py-12 text-center">
              <Search className="h-12 w-12 mx-auto text-[var(--text-muted)] mb-3 opacity-40" />
              <p className="text-sm text-[var(--text-muted)]">Введите минимум 2 символа</p>
            </div>
          ) : searching ? (
            <div className="py-8 text-center text-sm text-[var(--text-muted)]">Поиск...</div>
          ) : searchResults.length === 0 ? (
            <div className="py-8 text-center text-sm text-[var(--text-muted)]">Никого не нашли</div>
          ) : (
            <div className="space-y-2">
              {searchResults.map((u) => (
                <div key={u.id} className="flex items-center gap-3 rounded-2xl bg-[var(--bg-elevated)] px-4 py-3">
                  <UserAvatar username={u.username} avatarUrl={u.avatarUrl} size="md" linkToProfile equippedItems={u.equippedItems} />
                  <div className="flex-1 min-w-0">
                    <UserName username={u.username} equippedItems={u.equippedItems} linkToProfile />
                    {u.bio && (
                      <p className="text-xs text-[var(--text-muted)] truncate">{u.bio}</p>
                    )}
                  </div>
                  <div className="shrink-0">
                    {u.friendStatus === "friend" ? (
                      <span className="flex items-center gap-1 rounded-full bg-green-500/10 px-3 py-1 text-xs text-green-500 font-medium">
                        <Check className="h-3 w-3" />
                        Друг
                      </span>
                    ) : u.friendStatus === "pending_sent" ? (
                      <span className="flex items-center gap-1 rounded-full bg-[var(--bg-surface)] px-3 py-1 text-xs text-[var(--text-muted)]">
                        <Clock className="h-3 w-3" />
                        Ожидает
                      </span>
                    ) : u.friendStatus === "pending_received" ? (
                      <button
                        onClick={() => handleAccept(u.id)}
                        className="rounded-full bg-green-500 px-3 py-1 text-xs text-white font-medium hover:bg-green-600 transition"
                      >
                        Принять
                      </button>
                    ) : (
                      <button
                        onClick={() => handleAddFriend(u.id)}
                        className="rounded-full bg-[var(--text-primary)] px-3 py-1 text-xs text-[var(--bg-surface)] font-medium hover:opacity-90 transition"
                      >
                        Добавить
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );

  const contextMenuEl = contextMenu && (
    <>
      <div className="fixed inset-0 z-[80]" onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }} />
      <div
        ref={contextRef}
        className="fixed z-[81] w-48 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-[var(--shadow-lg)] overflow-hidden py-1 animate-slide-down"
        style={{
          left: Math.min(contextMenu.x, window.innerWidth - 200),
          top: Math.min(contextMenu.y, window.innerHeight - 60),
        }}
      >
        <button
          onClick={() => {
            router.push(`/users/${contextMenu.friend.username}`);
            setContextMenu(null);
          }}
          className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition"
        >
          <Eye className="h-4 w-4 text-[var(--text-muted)]" />
          Просмотр профиля
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile: overlay чат */}
      {activeChatId && !activeGroup && (
        <div className="md:hidden">
          <ChatView
            friendId={activeChatId}
            friend={chatFriend}
            onBack={handleCloseChat}
            adminMode={adminChatOpen}
          />
        </div>
      )}
      {activeGroup && !activeChatId && (
        <div className="md:hidden fixed inset-0 z-[56] bg-[var(--bg-surface)]">
          <GroupChatView group={activeGroup} onBack={handleCloseChat} onGroupUpdated={handleGroupUpdated} onLeaveGroup={handleLeaveGroup} onDeleteGroup={handleDeleteGroup} />
        </div>
      )}

      {/* Desktop: split layout */}
      <div data-friends-desktop className="hidden md:flex h-[calc(100dvh-57px)] overflow-hidden -mb-24">
        {/* Сайдбар */}
        <div className="w-80 border-r border-[var(--border-color)] overflow-y-auto p-4 shrink-0">
          <h1 className="text-xl font-bold text-[var(--text-primary)] mb-4">Друзья</h1>
          {renderTabs()}
          {renderTabContent()}
        </div>

        {/* Чат или пустое состояние */}
        <div className="flex-1 min-w-0">
          {activeGroup ? (
            <GroupChatView group={activeGroup} onBack={handleCloseChat} onGroupUpdated={handleGroupUpdated} onLeaveGroup={handleLeaveGroup} onDeleteGroup={handleDeleteGroup} />
          ) : activeChatId ? (
            <ChatView
              friendId={activeChatId}
              friend={chatFriend}
              onBack={handleCloseChat}
              inline
              adminMode={adminChatOpen}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)]">
              <MessageCircle className="h-16 w-16 mb-4 opacity-20" />
              <p className="text-sm">Выберите друга или группу для чата</p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile: обычный layout */}
      <div className={`md:hidden ${hasActiveChat ? "hidden" : ""}`}>
        <div className="px-4 py-4 max-w-lg mx-auto">
          <h1 className="text-xl font-bold text-[var(--text-primary)] mb-4">Друзья</h1>
          {renderTabs()}
          {renderTabContent()}
        </div>
      </div>

      {contextMenuEl}
      {showCreateGroup && (
        <CreateGroupModal
          onClose={() => setShowCreateGroup(false)}
          onCreated={(group) => { loadGroups(); setActiveGroup(group); }}
        />
      )}
    </>
  );
}
