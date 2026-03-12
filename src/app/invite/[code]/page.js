"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { useUser } from "@/components/UserProvider";

export default function InvitePage() {
  const { code } = useParams();
  const router = useRouter();
  const { user, authFetch, loading: authLoading } = useUser();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/invite/${code}`)
      .then((r) => r.ok ? r.json() : r.json().then((d) => Promise.reject(d.error)))
      .then(setInfo)
      .catch((err) => setError(typeof err === "string" ? err : "Ссылка недействительна"))
      .finally(() => setLoading(false));
  }, [code]);

  const handleJoin = async () => {
    if (!authFetch) return;
    setJoining(true);
    setError("");
    try {
      const res = await authFetch(`/api/invite/${code}`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        router.push("/friends");
      } else {
        setError(data.error || "Ошибка");
        if (data.groupId) {
          setTimeout(() => router.push("/friends"), 1500);
        }
      }
    } catch {
      setError("Ошибка сети");
    } finally {
      setJoining(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-main)]">
        <div className="h-8 w-8 border-2 border-[var(--accent-color)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-main)] p-4">
      <div className="w-full max-w-sm rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-[var(--shadow-xl)] p-6 text-center">
        {error && !info ? (
          <>
            <p className="text-sm text-red-500 mb-4">{error}</p>
            <button
              onClick={() => router.push("/")}
              className="text-sm text-[var(--accent-color)] hover:underline"
            >
              На главную
            </button>
          </>
        ) : info ? (
          <>
            <div className="flex items-center justify-center mb-4">
              <div className="h-16 w-16 rounded-full bg-[var(--accent-color)]/15 flex items-center justify-center overflow-hidden">
                {info.groupAvatarUrl ? (
                  <img src={info.groupAvatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Users className="h-8 w-8 text-[var(--accent-color)]" />
                )}
              </div>
            </div>
            <h2 className="text-lg font-bold text-[var(--text-primary)] mb-1">{info.groupName}</h2>
            <p className="text-sm text-[var(--text-muted)] mb-5">{info.memberCount} участников</p>

            {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

            {!user ? (
              <div>
                <p className="text-sm text-[var(--text-secondary)] mb-3">Войдите, чтобы присоединиться</p>
                <button
                  onClick={() => router.push("/")}
                  className="w-full rounded-xl bg-[var(--accent-color)] py-2.5 text-sm font-bold text-white transition hover:brightness-110"
                >
                  Войти
                </button>
              </div>
            ) : (
              <button
                onClick={handleJoin}
                disabled={joining}
                className="w-full rounded-xl bg-[var(--accent-color)] py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-50"
              >
                {joining ? "Присоединение..." : "Присоединиться"}
              </button>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
