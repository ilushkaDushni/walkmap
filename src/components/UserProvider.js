"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from "react";

const UserContext = createContext(null);

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}

export default function UserProvider({ children }) {
  const [realUser, setRealUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isBanned, setIsBanned] = useState(false);
  const [bannedUsername, setBannedUsername] = useState(null);
  const accessTokenRef = useRef(null);

  // Preview mode state
  const [preview, setPreview] = useState(null); // { role, permissions, roles }

  // Computed user: подменяем permissions/roles в preview mode
  const user = useMemo(() => {
    if (!realUser) return null;
    if (!preview) return realUser;
    return {
      ...realUser,
      permissions: preview.permissions,
      roles: preview.roles,
      isSuperadmin: false,
    };
  }, [realUser, preview]);

  const isPreviewMode = !!preview;

  const startPreview = useCallback((role) => {
    setPreview({
      role,
      permissions: role.permissions || [],
      roles: [{ id: role._id || role.id, name: role.name, slug: role.slug, color: role.color, position: role.position }],
    });
  }, []);

  const stopPreview = useCallback(() => {
    setPreview(null);
  }, []);

  // Refresh access token using httpOnly cookie (deduplicated)
  const refreshPromiseRef = useRef(null);
  const refreshSession = useCallback(async () => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    const promise = (async () => {
      try {
        const res = await fetch("/api/auth/refresh", { method: "POST" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (res.status === 403 && data.banned) {
            setIsBanned(true);
            setBannedUsername(data.username || null);
          }
          accessTokenRef.current = null;
          setRealUser(null);
          return null;
        }
        const data = await res.json();
        if (data.user?.banned) {
          setIsBanned(true);
        }
        accessTokenRef.current = data.accessToken;
        setRealUser(data.user);
        return data.accessToken;
      } catch {
        accessTokenRef.current = null;
        setRealUser(null);
        return null;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    refreshPromiseRef.current = promise;
    return promise;
  }, []);

  // Restore session on mount via refresh cookie
  useEffect(() => {
    refreshSession().finally(() => setLoading(false));
  }, [refreshSession]);

  // Fetch wrapper that adds Authorization header and auto-refreshes on 401
  const authFetch = useCallback(async (url, options = {}) => {
    const doFetch = (token) =>
      fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

    let res = await doFetch(accessTokenRef.current);

    if (res.status === 401) {
      const newToken = await refreshSession();
      if (newToken) {
        res = await doFetch(newToken);
      }
    }

    return res;
  }, [refreshSession]);

  const login = useCallback(async (username, password) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      if (res.status === 403 && data.banned) {
        setIsBanned(true);
        setBannedUsername(data.username || username);
        return null;
      }
      throw new Error(data.error || "Ошибка входа");
    }

    accessTokenRef.current = data.accessToken;
    setRealUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (username, email, password) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Ошибка регистрации");
    return data;
  }, []);

  const verify = useCallback(async (email, code) => {
    const res = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Ошибка верификации");

    accessTokenRef.current = data.accessToken;
    setRealUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    accessTokenRef.current = null;
    setRealUser(null);
    setPreview(null);
    setIsBanned(false);
    setBannedUsername(null);
  }, []);

  // Проверка прав: ALL (AND) — проверяет по реальным правам если в preview, чтобы hasPermission("roles.preview") работал корректно
  const hasPermission = useCallback((...perms) => {
    if (!user?.permissions) return false;
    return perms.every((p) => user.permissions.includes(p));
  }, [user]);

  // Проверка прав: ANY (OR)
  const hasAnyPermission = useCallback((...perms) => {
    if (!user?.permissions) return false;
    return perms.some((p) => user.permissions.includes(p));
  }, [user]);

  // Проверка прав по РЕАЛЬНОМУ юзеру (нужно для кнопки preview на странице ролей)
  const hasRealPermission = useCallback((...perms) => {
    if (!realUser?.permissions) return false;
    return perms.every((p) => realUser.permissions.includes(p));
  }, [realUser]);

  return (
    <UserContext.Provider value={{
      user, loading, isBanned, bannedUsername, login, register, verify, logout, authFetch,
      hasPermission, hasAnyPermission, hasRealPermission,
      startPreview, stopPreview, isPreviewMode, previewRole: preview?.role || null,
    }}>
      {children}
    </UserContext.Provider>
  );
}
