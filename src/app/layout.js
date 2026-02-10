import { Geist } from "next/font/google";
import { Map } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import PreviewBanner from "@/components/PreviewBanner";
import BanModal from "@/components/BanModal";
import ThemeProvider from "@/components/ThemeProvider";
import UserProvider from "@/components/UserProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata = {
  title: "Прогулочные маршруты",
  description: "PWA-приложение для прогулочных маршрутов с интерактивной картой",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Маршруты",
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
            <BanModal />
            <PreviewBanner />
            {/* Шапка */}
            <header className="sticky top-0 z-50 bg-[var(--bg-header)] border-b border-[var(--border-color)] transition-colors">
              <div className="flex items-center px-4 py-3">
                <a href="/" className="flex items-center gap-2 text-lg font-bold text-[var(--text-primary)]">
                  <Map className="h-6 w-6" />
                  Маршруты
                </a>
              </div>
            </header>

            {/* Контент */}
            <main className="pb-24">
              {children}
            </main>

            {/* Нижняя навигация */}
            <BottomNav />
          </UserProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
