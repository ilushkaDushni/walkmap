"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";

const UserContext = createContext(null);

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}

export default function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const accessTokenRef = useRef(null);

  // Refresh access token using httpOnly cookie
  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/refresh", { method: "POST" });
      if (!res.ok) {
        accessTokenRef.current = null;
        setUser(null);
        return null;
      }
      const data = await res.json();
      accessTokenRef.current = data.accessToken;
      setUser(data.user);
      return data.accessToken;
    } catch {
      accessTokenRef.current = null;
      setUser(null);
      return null;
    }
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
    if (!res.ok) throw new Error(data.error || "Ошибка входа");

    accessTokenRef.current = data.accessToken;
    setUser(data.user);
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
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    accessTokenRef.current = null;
    setUser(null);
  }, []);

  return (
    <UserContext.Provider value={{ user, loading, login, register, verify, logout, authFetch }}>
      {children}
    </UserContext.Provider>
  );
}
