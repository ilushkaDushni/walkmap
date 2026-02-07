"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, MapPin, Settings, Shield } from "lucide-react";
import { useUser } from "./UserProvider";
import ProfileModal from "./ProfileModal";
import SettingsModal from "./SettingsModal";
import AdminModal from "./AdminModal";

export default function BottomNav() {
  const pathname = usePathname();
  const { user } = useUser();
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  const isRoutesActive = pathname === "/routes" || pathname.startsWith("/routes/");
  const isAdmin = user?.role === "admin";

  return (
    <>
      <nav className="fixed bottom-4 left-4 right-4 z-50">
        <div className="mx-auto flex max-w-md items-center justify-around rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-color)] px-6 py-3 shadow-2xl transition-colors">
          {/* Профиль — модал */}
          <button
            onClick={() => setProfileOpen(true)}
            className={`flex flex-col items-center gap-1 px-4 py-1 transition ${
              profileOpen ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            <User className="h-6 w-6" strokeWidth={profileOpen ? 2.5 : 1.5} />
            <span className="text-[10px] font-medium">Профиль</span>
          </button>

          {/* Админ — модал (только для админов) */}
          {isAdmin && (
            <button
              onClick={() => setAdminOpen(true)}
              className={`flex flex-col items-center gap-1 px-4 py-1 transition ${
                adminOpen ? "text-amber-500" : "text-[var(--text-muted)] hover:text-amber-500"
              }`}
            >
              <Shield className="h-6 w-6" strokeWidth={adminOpen ? 2.5 : 1.5} />
              <span className="text-[10px] font-medium">Админ</span>
            </button>
          )}

          {/* Маршруты — страница */}
          <Link
            href="/routes"
            className={`flex flex-col items-center gap-1 px-4 py-1 transition ${
              isRoutesActive ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            <MapPin className="h-6 w-6" strokeWidth={isRoutesActive ? 2.5 : 1.5} />
            <span className="text-[10px] font-medium">Маршруты</span>
          </Link>

          {/* Настройки — модал */}
          <button
            onClick={() => setSettingsOpen(true)}
            className={`flex flex-col items-center gap-1 px-4 py-1 transition ${
              settingsOpen ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            <Settings className="h-6 w-6" strokeWidth={settingsOpen ? 2.5 : 1.5} />
            <span className="text-[10px] font-medium">Настройки</span>
          </button>
        </div>
      </nav>

      <ProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
      {isAdmin && <AdminModal isOpen={adminOpen} onClose={() => setAdminOpen(false)} />}
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
