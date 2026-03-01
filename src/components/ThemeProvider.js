"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";

export const FREE_THEMES = [
  { id: "dark", name: "Тёмная", isDark: true, color: "#2a2a2a" },
  { id: "light", name: "Светлая", isDark: false, color: "#e8e8e8" },
  { id: "midnight", name: "Полночь", isDark: true, color: "#0f172a" },
  { id: "forest", name: "Лес", isDark: true, color: "#0f1f15" },
  { id: "sunset", name: "Закат", isDark: true, color: "#1c1210" },
  { id: "lavender", name: "Лаванда", isDark: false, color: "#f0e6ff" },
  { id: "rose", name: "Роза", isDark: false, color: "#fce4ec" },
  { id: "peach", name: "Персик", isDark: false, color: "#fff5ee" },
  { id: "ocean", name: "Океан", isDark: false, color: "#e8f4f8" },
  { id: "mint", name: "Мята", isDark: false, color: "#e8f5f0" },
  { id: "sand", name: "Песок", isDark: false, color: "#f5f0e8" },
  { id: "sky", name: "Небо", isDark: false, color: "#eaf2ff" },
];

const THEME_CSS_VARS = [
  "--bg-main", "--bg-surface", "--bg-elevated", "--bg-subtle", "--bg-header",
  "--text-primary", "--text-secondary", "--text-muted", "--border-color",
];

const ThemeContext = createContext({
  theme: "dark",
  setTheme: () => {},
  isDark: true,
});

export function useTheme() {
  return useContext(ThemeContext);
}

export default function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState("dark");
  const equippedThemeRef = useRef(null);

  // Определяем isDark на основе текущей темы
  const getIsDark = useCallback((themeId) => {
    const free = FREE_THEMES.find((t) => t.id === themeId);
    if (free) return free.isDark;
    // Для премиум тем — берём из equippedThemeRef
    if (equippedThemeRef.current?.cssData?.isDark !== undefined) {
      return equippedThemeRef.current.cssData.isDark;
    }
    return true;
  }, []);

  // Применить equipped appTheme (CSS-переменные напрямую на html)
  const applyEquippedTheme = useCallback((equippedAppTheme) => {
    const el = document.documentElement;
    if (!equippedAppTheme?.cssData) {
      // Убрать inline CSS-переменные, вернуть обычную тему
      THEME_CSS_VARS.forEach((v) => el.style.removeProperty(v));
      equippedThemeRef.current = null;
      return;
    }
    equippedThemeRef.current = equippedAppTheme;
    const css = equippedAppTheme.cssData;
    THEME_CSS_VARS.forEach((v) => {
      if (css[v]) {
        el.style.setProperty(v, css[v]);
      }
    });
  }, []);

  // Инициализация
  useEffect(() => {
    const saved = localStorage.getItem("theme") || "dark";
    const validFree = FREE_THEMES.some((t) => t.id === saved);
    const themeToApply = validFree ? saved : "dark";
    setThemeState(themeToApply);
    document.documentElement.setAttribute("data-theme", themeToApply);
  }, []);

  // Смена темы (бесплатная или премиум)
  const setTheme = useCallback((themeId, premiumTheme) => {
    const el = document.documentElement;
    // Сброс inline CSS от предыдущей премиум-темы
    THEME_CSS_VARS.forEach((v) => el.style.removeProperty(v));
    equippedThemeRef.current = null;

    if (premiumTheme?.cssData) {
      // Премиум-тема: применяем CSS-переменные поверх базовой dark
      el.setAttribute("data-theme", "dark");
      setThemeState(premiumTheme.id);
      localStorage.setItem("theme", premiumTheme.id);
      applyEquippedTheme(premiumTheme);
      return;
    }

    const validFree = FREE_THEMES.some((t) => t.id === themeId);
    if (!validFree) return;
    setThemeState(themeId);
    el.setAttribute("data-theme", themeId);
    localStorage.setItem("theme", themeId);
  }, [applyEquippedTheme]);

  // Слушаем событие применения equipped appTheme (от UserProvider/Shop)
  useEffect(() => {
    const handler = (e) => {
      applyEquippedTheme(e.detail);
    };
    window.addEventListener("apply-app-theme", handler);
    return () => window.removeEventListener("apply-app-theme", handler);
  }, [applyEquippedTheme]);

  const isDark = getIsDark(theme);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark, applyEquippedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
