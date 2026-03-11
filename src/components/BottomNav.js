"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { User, MapPin, Shield, House, ShoppingBag } from "lucide-react";
import { useUser } from "./UserProvider";
import { useNavigationGuard } from "./NavigationGuardProvider";
import ProfileModal from "./ProfileModal";
import AdminModal from "./AdminModal";
import useUnreadMessages from "@/hooks/useUnreadMessages";

export default function BottomNav() {
  const pathname = usePathname();
  const { user, hasPermission, authFetch } = useUser();
  const { navigate } = useNavigationGuard();
  const { count: unreadMsgCount } = useUnreadMessages();
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileInitialScreen, setProfileInitialScreen] = useState(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [openTicketsCount, setOpenTicketsCount] = useState(0);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setIsDesktop(mq.matches);
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    const handler = () => setProfileOpen(true);
    const aboutHandler = () => {
      setProfileInitialScreen("about");
      setProfileOpen(true);
    };
    window.addEventListener("open-profile-modal", handler);
    window.addEventListener("open-about-screen", aboutHandler);
    return () => {
      window.removeEventListener("open-profile-modal", handler);
      window.removeEventListener("open-about-screen", aboutHandler);
    };
  }, []);

  useEffect(() => {
    if (!hasPermission("feedback.manage")) return;
    const fetchCount = () => {
      Promise.all([
        authFetch("/api/admin/tickets/unread-count").then((r) => r.json()).catch(() => ({ count: 0 })),
        authFetch("/api/admin/messages/unread-count").then((r) => r.json()).catch(() => ({ count: 0 })),
      ]).then(([tickets, msgs]) => {
        setOpenTicketsCount((tickets.count || 0) + (msgs.count || 0));
      });
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [hasPermission, authFetch]);

  const isHome = pathname === "/";
  const isRoutesActive = pathname === "/routes" || pathname.startsWith("/routes/");
  const isFriendsActive = pathname === "/friends";
  const isShopActive = pathname === "/shop";
  const isAdmin = hasPermission("admin.access");

  const navItems = [
    { key: "home", tutorial: "nav-home", active: isHome, icon: House, label: "Главная", onClick: () => navigate("/") },
    { key: "routes", tutorial: "nav-routes", active: isRoutesActive, icon: MapPin, label: "Маршруты", onClick: () => { if (!user) { window.dispatchEvent(new Event("open-profile-modal")); } else { navigate("/routes"); } } },
    ...(isAdmin ? [{ key: "admin", active: adminOpen, icon: Shield, label: "Админ", badge: openTicketsCount, isAmber: true, onClick: () => setAdminOpen(true) }] : []),
    { key: "shop", tutorial: "nav-shop", active: isShopActive, icon: ShoppingBag, label: "Магазин", onClick: () => { if (!user) { window.dispatchEvent(new Event("open-profile-modal")); } else { navigate("/shop"); } } },
    { key: "friends", tutorial: "nav-friends", active: isFriendsActive, label: "Друзья", isFriends: true, unread: unreadMsgCount, onClick: () => { if (!user) { window.dispatchEvent(new Event("open-profile-modal")); } else { navigate("/friends"); } } },
    { key: "profile", tutorial: "nav-profile", active: profileOpen, icon: User, label: "Профиль", onClick: () => setProfileOpen(true) },
  ];

  const count = navItems.length;
  const activeIdx = navItems.findIndex((i) => i.active);

  return (
    <>
      <nav data-bottom-nav className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none" style={isFriendsActive && isDesktop ? { display: "none" } : undefined}>
        <div className="pointer-events-auto mx-3 mb-3 glass-nav rounded-2xl px-1.5 py-1 transition-colors relative overflow-hidden">
          {/* Скользящий индикатор */}
          {activeIdx >= 0 && (
            <div
              className="nav-tab-slider absolute top-1 bottom-1 rounded-xl bg-[var(--accent-light)]"
              style={{
                width: `${100 / count}%`,
                left: `${(activeIdx / count) * 100}%`,
              }}
            />
          )}

          <div className="flex items-center relative z-[1]">
            {navItems.map((item) => {
              const Ic = item.icon;
              const isActive = item.active;
              const accentColor = item.isAmber ? "text-amber-500" : "text-[var(--accent-color)]";

              return (
                <button
                  key={item.key}
                  data-tutorial={item.tutorial}
                  onClick={item.onClick}
                  className="nav-tab-btn relative flex flex-col items-center justify-center py-1.5 flex-1 min-w-0 gap-0.5"
                >
                  {item.isFriends ? (
                    <div className="relative">
                      <svg
                        className={`nav-tab-icon h-[22px] w-[22px] ${isActive ? accentColor : "text-[var(--text-muted)]"}`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={isActive ? 2 : 1.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="6.5" cy="8" r="2.2" />
                        <path d="M2.5 20a4 4 0 0 1 8 0" />
                        <circle cx="17.5" cy="8" r="2.2" />
                        <path d="M13.5 20a4 4 0 0 1 8 0" />
                        <circle cx="12" cy="9" r="2.8" />
                        <path d="M7 21a5 5 0 0 1 10 0" />
                      </svg>
                      {item.unread > 0 && (
                        <span className="absolute -top-0.5 -right-1 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-[var(--glass-bg-strong)]" />
                      )}
                    </div>
                  ) : (
                    <div className="relative">
                      <Ic
                        className={`nav-tab-icon h-[22px] w-[22px] ${isActive ? accentColor : "text-[var(--text-muted)]"}`}
                        strokeWidth={isActive ? 2.5 : 1.5}
                      />
                      {item.badge > 0 && (
                        <span className="absolute -top-1 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[10px] font-bold text-white">
                          {item.badge > 9 ? "9+" : item.badge}
                        </span>
                      )}
                    </div>
                  )}
                  <span className={`nav-tab-label text-[10px] leading-tight ${
                    isActive ? `${accentColor} font-semibold` : "text-[var(--text-muted)] font-medium"
                  }`}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      <ProfileModal
        isOpen={profileOpen}
        onClose={() => { setProfileOpen(false); setProfileInitialScreen(null); }}
        initialScreen={profileInitialScreen}
      />
      {isAdmin && <AdminModal isOpen={adminOpen} onClose={() => setAdminOpen(false)} />}
    </>
  );
}
