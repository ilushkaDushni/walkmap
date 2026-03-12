"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  X, Camera, Pencil, Users, Image as ImageIcon, Mic,
  Link2, Bell, BellOff, Palette, LogOut, Trash2, Plus,
  Crown, ChevronRight, ArrowLeft, Check, UserMinus,
} from "lucide-react";
import { useUser } from "./UserProvider";
import UserAvatar from "./UserAvatar";
import ChatThemePicker from "./ChatThemePicker";
import { isOnline, formatLastSeen } from "@/lib/onlineStatus";
import { isChatMuted, setChatMuted } from "@/lib/chatSettings";
import { getChatTheme, setChatTheme as saveChatTheme, getAllChatThemes } from "@/lib/chatThemes";

// --- Sub-views ---
const VIEW_MAIN = "main";
const VIEW_MEMBERS = "members";
const VIEW_ADD_MEMBER = "add_member";
const VIEW_MEDIA = "media";
const VIEW_THEME = "theme";
const VIEW_EDIT_NAME = "edit_name";
const VIEW_EDIT_DESC = "edit_desc";
const VIEW_INVITE = "invite";

export default function GroupSettingsModal({ group, onClose, onGroupUpdated, onLeaveGroup, onDeleteGroup, onThemeChange }) {
  const { user, authFetch } = useUser();
  const [view, setView] = useState(VIEW_MAIN);
  const [groupData, setGroupData] = useState(null);
  const [loading, setLoading] = useState(true);

  const groupKey = `group_${group.id}`;
  const [muted, setMutedState] = useState(() => isChatMuted(groupKey));
  const currentThemeId = getChatTheme(groupKey)?.id || "green";

  const isOwner = group.isOwner || group.createdBy === user?.id;
  const myMember = groupData?.members?.find((m) => m.userId === user?.id);
  const isAdmin = myMember?.role === "admin";
  const isOwnerOrAdmin = isOwner || isAdmin;

  // Загрузка полных данных группы
  const fetchGroup = useCallback(async () => {
    if (!authFetch) return;
    try {
      const res = await authFetch(`/api/groups/${group.id}`);
      if (res.ok) {
        const data = await res.json();
        setGroupData(data);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [authFetch, group.id]);

  useEffect(() => { fetchGroup(); }, [fetchGroup]);

  const toggleMute = () => {
    const next = !muted;
    setMutedState(next);
    setChatMuted(groupKey, next);
  };

  const handleThemeSelect = (id) => {
    saveChatTheme(groupKey, id);
    onThemeChange?.(id);
    setView(VIEW_MAIN);
  };

  if (view === VIEW_THEME) {
    return (
      <ChatThemePicker
        currentThemeId={currentThemeId}
        onSelect={handleThemeSelect}
        onClose={() => setView(VIEW_MAIN)}
      />
    );
  }

  if (view === VIEW_MEMBERS) {
    return (
      <MembersView
        groupData={groupData}
        isOwner={isOwner}
        isOwnerOrAdmin={isOwnerOrAdmin}
        user={user}
        authFetch={authFetch}
        groupId={group.id}
        onBack={() => setView(VIEW_MAIN)}
        onAddMember={() => setView(VIEW_ADD_MEMBER)}
        onRefresh={fetchGroup}
      />
    );
  }

  if (view === VIEW_ADD_MEMBER) {
    return (
      <AddMemberView
        groupId={group.id}
        existingMembers={groupData?.members || []}
        authFetch={authFetch}
        onBack={() => setView(VIEW_MEMBERS)}
        onAdded={() => { fetchGroup(); setView(VIEW_MEMBERS); }}
      />
    );
  }

  if (view === VIEW_INVITE) {
    return (
      <InviteView
        groupId={group.id}
        authFetch={authFetch}
        onBack={() => setView(VIEW_MAIN)}
      />
    );
  }

  if (view === VIEW_MEDIA) {
    return (
      <MediaView
        groupId={group.id}
        authFetch={authFetch}
        onBack={() => setView(VIEW_MAIN)}
      />
    );
  }

  if (view === VIEW_EDIT_NAME) {
    return (
      <EditFieldView
        title="Название группы"
        initial={groupData?.name || group.name}
        maxLength={50}
        groupId={group.id}
        field="name"
        authFetch={authFetch}
        onBack={() => setView(VIEW_MAIN)}
        onSaved={(val) => {
          setGroupData((prev) => prev ? { ...prev, name: val } : prev);
          onGroupUpdated?.({ ...group, name: val });
          setView(VIEW_MAIN);
        }}
      />
    );
  }

  if (view === VIEW_EDIT_DESC) {
    return (
      <EditFieldView
        title="Описание"
        initial={groupData?.description || ""}
        maxLength={200}
        multiline
        groupId={group.id}
        field="description"
        authFetch={authFetch}
        onBack={() => setView(VIEW_MAIN)}
        onSaved={(val) => {
          setGroupData((prev) => prev ? { ...prev, description: val } : prev);
          setView(VIEW_MAIN);
        }}
      />
    );
  }

  const theme = getAllChatThemes().find((t) => t.id === currentThemeId) || getAllChatThemes()[0];
  const memberCount = groupData?.members?.length || group.memberCount || 0;
  const avatarUrl = groupData?.avatarUrl || group.avatarUrl;
  const name = groupData?.name || group.name;
  const description = groupData?.description || null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-sm max-h-[85vh] rounded-t-2xl sm:rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-2xl overflow-hidden animate-slide-up flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)] shrink-0">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Настройки группы</h3>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* Avatar + Name */}
          <div className="flex flex-col items-center py-5 px-4">
            <AvatarUpload
              avatarUrl={avatarUrl}
              name={name}
              groupId={group.id}
              isOwner={isOwnerOrAdmin}
              authFetch={authFetch}
              onUpdated={(url) => {
                setGroupData((prev) => prev ? { ...prev, avatarUrl: url } : prev);
                onGroupUpdated?.({ ...group, avatarUrl: url });
              }}
            />
            {isOwnerOrAdmin ? (
              <button
                onClick={() => setView(VIEW_EDIT_NAME)}
                className="mt-3 flex items-center gap-1.5 group"
              >
                <span className="text-base font-semibold text-[var(--text-primary)]">{name}</span>
                <Pencil className="h-3.5 w-3.5 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ) : (
              <p className="mt-3 text-base font-semibold text-[var(--text-primary)]">{name}</p>
            )}
            {description && (
              <p className="mt-0.5 text-xs text-[var(--text-muted)] text-center max-w-[280px]">{description}</p>
            )}
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">{memberCount} участников</p>
          </div>

          <div className="border-t border-[var(--border-color)]" />

          {/* Actions */}
          <div className="py-1">
            {/* Edit name */}
            {isOwnerOrAdmin && (
              <SettingsRow icon={Pencil} label="Изменить название" onClick={() => setView(VIEW_EDIT_NAME)} />
            )}

            {/* Edit description */}
            {isOwnerOrAdmin && (
              <SettingsRow icon={Pencil} label={description ? "Изменить описание" : "Добавить описание"} onClick={() => setView(VIEW_EDIT_DESC)} />
            )}

            {/* Invite link */}
            {isOwnerOrAdmin && (
              <SettingsRow icon={Link2} label="Ссылка-приглашение" onClick={() => setView(VIEW_INVITE)} />
            )}

            {/* Members */}
            <SettingsRow
              icon={Users}
              label="Участники"
              detail={String(memberCount)}
              onClick={() => setView(VIEW_MEMBERS)}
            />

            {/* Media */}
            <SettingsRow icon={ImageIcon} label="Медиа" onClick={() => setView(VIEW_MEDIA)} />

            {/* Theme */}
            <SettingsRow
              icon={Palette}
              label="Тема чата"
              detail={theme.name}
              onClick={() => setView(VIEW_THEME)}
              trailing={<div className="h-5 w-5 rounded-full shrink-0" style={{ backgroundColor: theme.bubble }} />}
            />

            {/* Mute */}
            <button
              onClick={toggleMute}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[var(--bg-elevated)] transition"
            >
              {muted ? <BellOff className="h-5 w-5 text-[var(--text-muted)]" /> : <Bell className="h-5 w-5 text-[var(--text-muted)]" />}
              <div className="flex-1">
                <p className="text-sm text-[var(--text-primary)]">Уведомления</p>
                <p className="text-xs text-[var(--text-muted)]">{muted ? "Отключены" : "Включены"}</p>
              </div>
              <div className={`h-5 w-9 rounded-full transition-colors ${muted ? "bg-green-500" : "bg-[var(--border-color)]"} relative`}>
                <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${muted ? "translate-x-4" : "translate-x-0.5"}`} />
              </div>
            </button>
          </div>

          <div className="border-t border-[var(--border-color)]" />

          {/* Danger zone */}
          <div className="py-1">
            {!isOwner && (
              <button
                onClick={onLeaveGroup}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[var(--bg-elevated)] transition"
              >
                <LogOut className="h-5 w-5 text-red-500" />
                <p className="text-sm text-red-500">Покинуть группу</p>
              </button>
            )}
            {isOwner && (
              <button
                onClick={onDeleteGroup}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[var(--bg-elevated)] transition"
              >
                <Trash2 className="h-5 w-5 text-red-500" />
                <p className="text-sm text-red-500">Удалить группу</p>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Settings Row ---
function SettingsRow({ icon: Icon, label, detail, onClick, trailing }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[var(--bg-elevated)] transition"
    >
      <Icon className="h-5 w-5 text-[var(--text-muted)]" />
      <p className="flex-1 text-sm text-[var(--text-primary)]">{label}</p>
      {detail && <span className="text-xs text-[var(--text-muted)]">{detail}</span>}
      {trailing || <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />}
    </button>
  );
}

// --- Avatar Upload ---
function AvatarUpload({ avatarUrl, name, groupId, isOwner, authFetch, onUpdated }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !authFetch) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await authFetch(`/api/groups/${groupId}/avatar`, { method: "POST", body: form });
      if (res.ok) {
        const { avatarUrl: url } = await res.json();
        onUpdated(url);
      }
    } catch { /* ignore */ }
    finally { setUploading(false); }
  };

  const initial = (name || "?")[0].toUpperCase();

  return (
    <div className="relative">
      <div className="h-20 w-20 rounded-full overflow-hidden bg-[var(--accent-color)]/15 flex items-center justify-center">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-2xl font-bold text-[var(--accent-color)]">{initial}</span>
        )}
        {uploading && (
          <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
            <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      {isOwner && (
        <>
          <button
            onClick={() => fileRef.current?.click()}
            className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-[var(--accent-color)] flex items-center justify-center shadow-lg"
          >
            <Camera className="h-3.5 w-3.5 text-white" />
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFile} />
        </>
      )}
    </div>
  );
}

// --- Sub-view wrapper ---
function SubView({ title, onBack, children }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div className="fixed inset-0 bg-black/40" onClick={onBack} />
      <div className="relative w-full max-w-sm max-h-[85vh] rounded-t-2xl sm:rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-2xl overflow-hidden animate-slide-up flex flex-col">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border-color)] shrink-0">
          <button onClick={onBack} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
        </div>
        <div className="overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}

// --- Members View ---
function MembersView({ groupData, isOwner, isOwnerOrAdmin, user, authFetch, groupId, onBack, onAddMember, onRefresh }) {
  const [removing, setRemoving] = useState(null);
  const [togglingRole, setTogglingRole] = useState(null);

  const handleRemove = async (memberId) => {
    if (!authFetch) return;
    setRemoving(memberId);
    try {
      const res = await authFetch(`/api/groups/${groupId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      if (res.ok) onRefresh();
    } catch { /* ignore */ }
    finally { setRemoving(null); }
  };

  const handleToggleAdmin = async (memberId, currentRole) => {
    if (!authFetch) return;
    setTogglingRole(memberId);
    try {
      const newRole = currentRole === "admin" ? "member" : "admin";
      const res = await authFetch(`/api/groups/${groupId}/members/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, role: newRole }),
      });
      if (res.ok) onRefresh();
    } catch { /* ignore */ }
    finally { setTogglingRole(null); }
  };

  const members = groupData?.members || [];

  return (
    <SubView title={`Участники (${members.length})`} onBack={onBack}>
      {isOwnerOrAdmin && (
        <button
          onClick={onAddMember}
          className="flex w-full items-center gap-3 px-4 py-3 hover:bg-[var(--bg-elevated)] transition"
        >
          <div className="h-10 w-10 rounded-full bg-[var(--accent-color)]/15 flex items-center justify-center">
            <Plus className="h-5 w-5 text-[var(--accent-color)]" />
          </div>
          <p className="text-sm font-medium text-[var(--accent-color)]">Добавить участника</p>
        </button>
      )}
      {members.map((m) => {
        const isMe = m.userId === user?.id;
        const memberIsOwner = m.role === "owner";
        const memberIsAdmin = m.role === "admin";
        const canKick = isOwnerOrAdmin && !isMe && !memberIsOwner && !(memberIsAdmin && !isOwner);
        return (
          <div key={m.userId} className="flex items-center gap-3 px-4 py-2.5">
            <UserAvatar
              username={m.username}
              avatarUrl={m.avatarUrl}
              size="md"
              online={isOnline(m.lastActivityAt)}
              equippedItems={m.equippedItems}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                  {m.username}{isMe ? " (вы)" : ""}
                </p>
                {memberIsOwner && <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                {memberIsAdmin && (
                  <span className="text-xs font-medium text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded-full shrink-0">
                    админ
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                {isOnline(m.lastActivityAt) ? "в сети" : formatLastSeen(m.lastActivityAt)}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {/* Toggle admin — only owner can */}
              {isOwner && !isMe && !memberIsOwner && (
                <button
                  onClick={() => handleToggleAdmin(m.userId, m.role)}
                  disabled={togglingRole === m.userId}
                  className={`text-xs px-2 py-1 rounded-lg transition ${memberIsAdmin ? "text-blue-500 bg-blue-500/10 hover:bg-blue-500/20" : "text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]"}`}
                  title={memberIsAdmin ? "Снять админа" : "Назначить админом"}
                >
                  {togglingRole === m.userId ? (
                    <div className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : memberIsAdmin ? "Снять" : "Админ"}
                </button>
              )}
              {/* Kick */}
              {canKick && (
                <button
                  onClick={() => handleRemove(m.userId)}
                  disabled={removing === m.userId}
                  className="text-[var(--text-muted)] hover:text-red-500 transition p-1"
                >
                  {removing === m.userId ? (
                    <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <UserMinus className="h-4 w-4" />
                  )}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </SubView>
  );
}

// --- Add Member View ---
function AddMemberView({ groupId, existingMembers, authFetch, onBack, onAdded }) {
  const [friends, setFriends] = useState([]);
  const [adding, setAdding] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authFetch) return;
    authFetch("/api/friends")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data) {
          const existingIds = new Set(existingMembers.map((m) => m.userId));
          setFriends((data.friends || []).filter((f) => !existingIds.has(f.friendId)));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authFetch, existingMembers]);

  const handleAdd = async (friendId) => {
    if (!authFetch) return;
    setAdding(friendId);
    try {
      const res = await authFetch(`/api/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: friendId }),
      });
      if (res.ok) onAdded();
    } catch { /* ignore */ }
    finally { setAdding(null); }
  };

  return (
    <SubView title="Добавить участника" onBack={onBack}>
      {loading ? (
        <div className="py-8 text-center text-sm text-[var(--text-muted)]">Загрузка...</div>
      ) : friends.length === 0 ? (
        <div className="py-8 text-center text-sm text-[var(--text-muted)]">Нет друзей для добавления</div>
      ) : (
        friends.map((f) => (
          <div key={f.friendId} className="flex items-center gap-3 px-4 py-2.5">
            <UserAvatar username={f.username} avatarUrl={f.avatarUrl} size="md" equippedItems={f.equippedItems} />
            <p className="flex-1 text-sm font-medium text-[var(--text-primary)] truncate">{f.username}</p>
            <button
              onClick={() => handleAdd(f.friendId)}
              disabled={adding === f.friendId}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-color)]/15 text-[var(--accent-color)] hover:bg-[var(--accent-color)]/25 transition"
            >
              {adding === f.friendId ? (
                <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </button>
          </div>
        ))
      )}
    </SubView>
  );
}

// --- Media View ---
function MediaView({ groupId, authFetch, onBack }) {
  const [tab, setTab] = useState("image");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState(null);

  const fetchMedia = useCallback(async () => {
    if (!authFetch) return;
    setLoading(true);
    try {
      const res = await authFetch(`/api/groups/${groupId}/media?type=${tab}&limit=50`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [authFetch, groupId, tab]);

  useEffect(() => { fetchMedia(); }, [fetchMedia]);

  const tabs = [
    { key: "image", label: "Фото", icon: ImageIcon },
    { key: "voice", label: "Аудио", icon: Mic },
    { key: "link", label: "Ссылки", icon: Link2 },
  ];

  return (
    <SubView title="Медиа" onBack={onBack}>
      {/* Tabs */}
      <div className="flex border-b border-[var(--border-color)]">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition border-b-2 ${
              tab === t.key
                ? "text-[var(--accent-color)] border-[var(--accent-color)]"
                : "text-[var(--text-muted)] border-transparent"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-[var(--text-muted)]">Загрузка...</div>
      ) : items.length === 0 ? (
        <div className="py-8 text-center text-sm text-[var(--text-muted)]">Пусто</div>
      ) : tab === "image" ? (
        <div className="grid grid-cols-3 gap-0.5 p-0.5">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => setLightbox(item.imageUrl)}
              className="aspect-square overflow-hidden bg-[var(--bg-elevated)]"
            >
              <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      ) : tab === "voice" ? (
        <div className="py-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-2">
              <Mic className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[var(--text-primary)]">
                  {item.audioDuration ? `${Math.round(item.audioDuration)} сек` : "Голосовое"}
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  {new Date(item.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                </p>
              </div>
              <audio src={item.audioUrl} controls className="h-8 max-w-[140px]" />
            </div>
          ))}
        </div>
      ) : (
        <div className="py-2">
          {items.map((item) => {
            const urlMatch = item.text?.match(/https?:\/\/[^\s]+/);
            const url = urlMatch?.[0];
            return (
              <a
                key={item.id}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--bg-elevated)] transition no-underline"
              >
                <Link2 className="h-4 w-4 text-[var(--accent-color)] shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--accent-color)] truncate">{url}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {new Date(item.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                  </p>
                </div>
              </a>
            );
          })}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80" onClick={() => setLightbox(null)}>
          <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 text-white/80 hover:text-white">
            <X className="h-6 w-6" />
          </button>
          <img src={lightbox} alt="" className="max-w-[90vw] max-h-[90vh] rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </SubView>
  );
}

// --- Invite View ---
function InviteView({ groupId, authFetch, onBack }) {
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!authFetch) return;
    authFetch(`/api/groups/${groupId}/invite`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setInvite(data.invite); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authFetch, groupId]);

  const handleGenerate = async () => {
    if (!authFetch) return;
    setGenerating(true);
    try {
      const res = await authFetch(`/api/groups/${groupId}/invite`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setInvite({ code: data.code, expiresAt: data.expiresAt, uses: 0 });
      }
    } catch { /* ignore */ }
    finally { setGenerating(false); }
  };

  const handleRevoke = async () => {
    if (!authFetch) return;
    try {
      const res = await authFetch(`/api/groups/${groupId}/invite`, { method: "DELETE" });
      if (res.ok) setInvite(null);
    } catch { /* ignore */ }
  };

  const handleCopy = () => {
    if (!invite) return;
    const url = `${window.location.origin}/invite/${invite.code}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <SubView title="Ссылка-приглашение" onBack={onBack}>
      <div className="p-4">
        {loading ? (
          <div className="py-8 text-center text-sm text-[var(--text-muted)]">Загрузка...</div>
        ) : invite ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2.5">
              <p className="text-xs text-[var(--text-muted)] mb-1">Ссылка:</p>
              <p className="text-sm text-[var(--accent-color)] break-all font-mono">
                {typeof window !== "undefined" ? `${window.location.origin}/invite/${invite.code}` : invite.code}
              </p>
            </div>
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span>Использований: {invite.uses}</span>
              <span>Истекает: {new Date(invite.expiresAt).toLocaleDateString("ru-RU")}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="flex-1 py-2.5 rounded-xl bg-[var(--accent-color)] text-white text-sm font-medium transition hover:brightness-110"
              >
                {copied ? "Скопировано!" : "Копировать"}
              </button>
              <button
                onClick={handleRevoke}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-red-500 bg-red-500/10 hover:bg-red-500/20 transition"
              >
                Отозвать
              </button>
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
            >
              Создать новую ссылку
            </button>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-[var(--text-muted)] mb-4">Нет активной ссылки-приглашения</p>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full py-2.5 rounded-xl bg-[var(--accent-color)] text-white text-sm font-medium transition hover:brightness-110 disabled:opacity-50"
            >
              {generating ? "Создание..." : "Создать ссылку"}
            </button>
          </div>
        )}
      </div>
    </SubView>
  );
}

// --- Edit Field View ---
function EditFieldView({ title, initial, maxLength, multiline, groupId, field, authFetch, onBack, onSaved }) {
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!authFetch) return;
    setSaving(true);
    try {
      const res = await authFetch(`/api/groups/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value.trim() }),
      });
      if (res.ok) onSaved(value.trim());
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const changed = value.trim() !== (initial || "").trim();

  return (
    <SubView title={title} onBack={onBack}>
      <div className="p-4">
        {multiline ? (
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value.slice(0, maxLength))}
            rows={3}
            className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none resize-none focus:border-[var(--accent-color)] transition"
            placeholder="Добавьте описание..."
            autoFocus
          />
        ) : (
          <input
            value={value}
            onChange={(e) => setValue(e.target.value.slice(0, maxLength))}
            className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent-color)] transition"
            autoFocus
          />
        )}
        <p className="text-xs text-[var(--text-muted)] mt-1 text-right">{value.length}/{maxLength}</p>
        <button
          onClick={handleSave}
          disabled={!changed || saving}
          className="mt-3 w-full py-2.5 rounded-xl bg-[var(--accent-color)] text-white text-sm font-medium transition disabled:opacity-40"
        >
          {saving ? "Сохранение..." : "Сохранить"}
        </button>
      </div>
    </SubView>
  );
}
