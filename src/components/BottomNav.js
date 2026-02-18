"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { User, MapPin, Shield, House } from "lucide-react";
import { useUser } from "./UserProvider";
import { useNavigationGuard } from "./NavigationGuardProvider";
import ProfileModal from "./ProfileModal";
import AdminModal from "./AdminModal";
import useUnreadMessages from "@/hooks/useUnreadMessages";

export default function BottomNav() {
  const pathname = usePathname();
  const { user, hasPermission } = useUser();
  const { navigate } = useNavigationGuard();
  const { count: unreadMsgCount } = useUnreadMessages();
  const [profileOpen, setProfileOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  useEffect(() => {
    const handler = () => setProfileOpen(true);
    window.addEventListener("open-profile-modal", handler);
    return () => window.removeEventListener("open-profile-modal", handler);
  }, []);

  const isHome = pathname === "/";
  const isRoutesActive = pathname === "/routes" || pathname.startsWith("/routes/");
  const isFriendsActive = pathname === "/friends";
  const isAdmin = hasPermission("admin.access");

  return (
    <>
      <nav className={`fixed bottom-4 left-4 right-4 z-50 ${isFriendsActive ? "md:hidden" : ""}`}>
        <div className="mx-auto flex max-w-md items-center justify-around rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-color)] px-2 py-3 shadow-2xl transition-colors">
          {/* Главная */}
          <button
            onClick={() => navigate("/")}
            className={`flex flex-col items-center gap-1 px-2 py-1 transition ${
              isHome ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            <House className="h-6 w-6" strokeWidth={isHome ? 2.5 : 1.5} />
            <span className="text-[10px] font-medium">Главная</span>
          </button>

          {/* Маршруты */}
          <button
            onClick={() => {
              if (!user) {
                window.dispatchEvent(new Event("open-profile-modal"));
              } else {
                navigate("/routes");
              }
            }}
            className={`flex flex-col items-center gap-1 px-2 py-1 transition ${
              isRoutesActive ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            <MapPin className="h-6 w-6" strokeWidth={isRoutesActive ? 2.5 : 1.5} />
            <span className="text-[10px] font-medium">Маршруты</span>
          </button>

          {/* Админ (только для админов) */}
          {isAdmin && (
            <button
              onClick={() => setAdminOpen(true)}
              className={`flex flex-col items-center gap-1 px-2 py-1 transition ${
                adminOpen ? "text-amber-500" : "text-[var(--text-muted)] hover:text-amber-500"
              }`}
            >
              <Shield className="h-6 w-6" strokeWidth={adminOpen ? 2.5 : 1.5} />
              <span className="text-[10px] font-medium">Админ</span>
            </button>
          )}

          {/* Друзья */}
          <button
            onClick={() => {
              if (!user) {
                window.dispatchEvent(new Event("open-profile-modal"));
              } else {
                navigate("/friends");
              }
            }}
            className={`flex flex-col items-center gap-1 px-2 py-1 transition ${
              isFriendsActive ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            <div className="relative">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="var(--bg-surface)" stroke="currentColor" strokeWidth={isFriendsActive ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
                {/* Левый задний */}
                <circle cx="6.5" cy="8" r="2.2" />
                <path d="M2.5 20a4 4 0 0 1 8 0" />
                {/* Правый задний */}
                <circle cx="17.5" cy="8" r="2.2" />
                <path d="M13.5 20a4 4 0 0 1 8 0" />
                {/* Передний центральный (перекрывает) */}
                <circle cx="12" cy="9" r="2.8" />
                <path d="M7 21a5 5 0 0 1 10 0" />
              </svg>
              {unreadMsgCount > 0 && (
                <span className="absolute -top-0.5 -right-1 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-[var(--bg-surface)]" />
              )}
            </div>
            <span className="text-[10px] font-medium">Друзья</span>
          </button>

          {/* Профиль */}
          <button
            onClick={() => setProfileOpen(true)}
            className={`flex flex-col items-center gap-1 px-2 py-1 transition ${
              profileOpen ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            <User className="h-6 w-6" strokeWidth={profileOpen ? 2.5 : 1.5} />
            <span className="text-[10px] font-medium">Профиль</span>
          </button>
        </div>
      </nav>

      <ProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
      {isAdmin && <AdminModal isOpen={adminOpen} onClose={() => setAdminOpen(false)} />}
    </>
  );
}
