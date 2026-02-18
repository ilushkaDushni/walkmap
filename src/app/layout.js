import { Geist } from "next/font/google";
import { Map } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import PreviewBanner from "@/components/PreviewBanner";
import BanModal from "@/components/BanModal";
import AchievementToast from "@/components/AchievementToast";
import MessageToast from "@/components/MessageToast";
import NotificationBell from "@/components/NotificationBell";
import LobbyController from "@/components/LobbyController";
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
            __html: `try{const t=localStorage.getItem('theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}`,
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
            <UpdateModal />
            <PreviewBanner />
            {/* Шапка */}
            <header className="sticky top-0 z-50 bg-[var(--bg-header)] border-b border-[var(--border-color)] transition-colors">
              <div className="flex items-center justify-between px-4 py-3">
                <a href="/" className="flex items-center gap-2 text-lg font-bold text-[var(--text-primary)]">
                  <Map className="h-6 w-6" />
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
          </NavigationGuardProvider>
          </UserProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
