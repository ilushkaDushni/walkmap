import { Geist } from "next/font/google";
import { Map } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import PreviewBanner from "@/components/PreviewBanner";
import BanModal from "@/components/BanModal";
import AchievementToast from "@/components/AchievementToast";
import MessageToast from "@/components/MessageToast";
import NotificationBell from "@/components/NotificationBell";
import LobbyController from "@/components/LobbyController";
import TutorialOverlay from "@/components/TutorialOverlay";
import UpdateModal from "@/components/UpdateModal";
import ThemeProvider from "@/components/ThemeProvider";
import UserProvider from "@/components/UserProvider";
import NavigationGuardProvider from "@/components/NavigationGuardProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata = {
  title: "Ростов GO",
  description: "Больше, чем просто прогулка",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Ростов GO",
  },
};

export const viewport = {
  themeColor: "#353535",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{const t=localStorage.getItem('theme');document.documentElement.setAttribute('data-theme',t||'light')}catch(e){}`,
          }}
        />
      </head>
      <body className={`${geistSans.variable} min-h-screen font-sans antialiased`}>
        <ThemeProvider>
          <UserProvider>
          <NavigationGuardProvider>
            <BanModal />
            <AchievementToast />
            <MessageToast />
            <PreviewBanner />
            {/* Шапка */}
            <header className="sticky top-0 z-50 glass-header transition-colors">
              <div className="flex h-11 items-center justify-between px-4">
                <a href="/" className="flex items-center gap-1.5 text-sm font-bold text-[var(--text-primary)]">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--accent-color)]">
                    <Map className="h-3.5 w-3.5 text-white" />
                  </div>
                  Ростов GO
                </a>
                {/* Десктоп: иконки в шапке */}
                <div className="hidden md:flex items-center gap-1">
                  <LobbyController inline />
                  <NotificationBell inline />
                </div>
              </div>
            </header>

            {/* Контент */}
            <main className="pb-24">
              {children}
            </main>

            {/* Мобильные плавающие иконки */}
            <div className="md:hidden">
              <NotificationBell />
              <LobbyController />
            </div>

            {/* Нижняя навигация */}
            <BottomNav />
            <TutorialOverlay />
            <UpdateModal />
          </NavigationGuardProvider>
          </UserProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
