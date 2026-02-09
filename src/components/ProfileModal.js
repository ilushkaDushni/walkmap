"use client";

import { useEffect, useState } from "react";
import { X, User, LogIn, LogOut, Shield, UserPlus, ArrowLeft, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useUser } from "./UserProvider";

export default function ProfileModal({ isOpen, onClose }) {
  const { user, login, register, verify, logout } = useUser();
  const router = useRouter();
  // "profile" | "login" | "register" | "verify"
  const [screen, setScreen] = useState("profile");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Login fields
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register fields
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPassword2, setRegPassword2] = useState("");

  // Verify fields
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyEmail, setVerifyEmail] = useState("");

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  // Сброс при закрытии
  useEffect(() => {
    if (!isOpen) {
      setScreen("profile");
      setError("");
      setLoginUsername("");
      setLoginPassword("");
      setRegUsername("");
      setRegEmail("");
      setRegPassword("");
      setRegPassword2("");
      setVerifyCode("");
      setVerifyEmail("");
    }
  }, [isOpen]);

  const handleLogin = async () => {
    setError("");
    setSubmitting(true);
    try {
      await login(loginUsername, loginPassword);
      onClose();
      router.push("/");
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async () => {
    setError("");
    if (regPassword !== regPassword2) {
      setError("Пароли не совпадают");
      return;
    }
    if (regPassword.length < 6) {
      setError("Пароль минимум 6 символов");
      return;
    }
    setSubmitting(true);
    try {
      await register(regUsername, regEmail, regPassword);
      setVerifyEmail(regEmail);
      setScreen("verify");
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async () => {
    setError("");
    setSubmitting(true);
    try {
      await verify(verifyEmail, verifyCode);
      onClose();
      router.push("/");
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    logout();
    onClose();
  };

  if (!isOpen) return null;

  const backdrop = (
    <div
      className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm transition-opacity"
      onClick={onClose}
    />
  );

  const modalShell = (children) => (
    <>
      {backdrop}
      <div className="fixed inset-x-4 bottom-24 z-[70] mx-auto max-w-md animate-slide-up">
        <div className="rounded-3xl bg-[var(--bg-surface)] p-6 shadow-2xl transition-colors">
          {children}
        </div>
      </div>
    </>
  );

  const closeBtn = (
    <button
      onClick={onClose}
      className="absolute right-6 top-6 text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
    >
      <X className="h-5 w-5" />
    </button>
  );

  const backBtn = (to) => (
    <button
      onClick={() => { setScreen(to); setError(""); }}
      className="absolute left-6 top-6 text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
    >
      <ArrowLeft className="h-5 w-5" />
    </button>
  );

  const errorMsg = error && (
    <p className="text-center text-xs text-red-400 mt-2">{error}</p>
  );

  const inputCls = "w-full rounded-2xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition focus:border-[var(--text-secondary)]";
  const btnPrimary = "flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--text-primary)] px-4 py-3 text-sm font-semibold text-[var(--bg-surface)] transition hover:opacity-90 disabled:opacity-50";
  const btnOutline = "flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--border-color)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--bg-elevated)]";

  // === Экран: Профиль (залогинен) ===
  if (user) {
    return modalShell(
      <>
        {closeBtn}
        <div className="flex flex-col items-center">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--bg-elevated)]">
            <User className="h-8 w-8 text-[var(--text-secondary)]" />
          </div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">{user.username}</h2>
          <p className="text-sm text-[var(--text-muted)]">{user.email}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {user.isSuperadmin && (
              <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-amber-500/20 text-amber-500">
                <Shield className="h-3 w-3" />
                Суперадмин
              </span>
            )}
            {(user.roles || []).map((role) => (
              <span
                key={role.id || role.slug}
                className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{ backgroundColor: `${role.color}20`, color: role.color }}
              >
                <Shield className="h-3 w-3" />
                {role.name}
              </span>
            ))}
          </div>
        </div>
        <button onClick={handleLogout} className={`${btnOutline} mt-4`}>
          <LogOut className="h-4 w-4" />
          Выйти
        </button>
      </>
    );
  }

  // === Экран: Профиль (гость) ===
  if (screen === "profile") {
    return modalShell(
      <>
        {closeBtn}
        <div className="flex flex-col items-center">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--bg-elevated)]">
            <User className="h-8 w-8 text-[var(--text-secondary)]" />
          </div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Профиль</h2>
          <p className="text-sm text-[var(--text-muted)]">Гость</p>
        </div>
        <div className="mt-4 space-y-2">
          <button onClick={() => setScreen("login")} className={btnPrimary}>
            <LogIn className="h-4 w-4" />
            Войти
          </button>
          <button onClick={() => setScreen("register")} className={btnOutline}>
            <UserPlus className="h-4 w-4" />
            Зарегистрироваться
          </button>
        </div>
      </>
    );
  }

  // === Экран: Вход ===
  if (screen === "login") {
    return modalShell(
      <>
        {backBtn("profile")}
        {closeBtn}
        <div className="flex flex-col items-center mb-4">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--bg-elevated)]">
            <LogIn className="h-8 w-8 text-[var(--text-secondary)]" />
          </div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Вход</h2>
        </div>
        <div className="space-y-3">
          <input
            type="text"
            value={loginUsername}
            onChange={(e) => setLoginUsername(e.target.value)}
            placeholder="Логин"
            className={inputCls}
          />
          <input
            type="password"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            placeholder="Пароль"
            className={inputCls}
          />
          {errorMsg}
          <button onClick={handleLogin} disabled={submitting} className={btnPrimary}>
            <LogIn className="h-4 w-4" />
            {submitting ? "Вход..." : "Войти"}
          </button>
        </div>
      </>
    );
  }

  // === Экран: Регистрация ===
  if (screen === "register") {
    return modalShell(
      <>
        {backBtn("profile")}
        {closeBtn}
        <div className="flex flex-col items-center mb-4">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--bg-elevated)]">
            <UserPlus className="h-8 w-8 text-[var(--text-secondary)]" />
          </div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Регистрация</h2>
        </div>
        <div className="space-y-3">
          <input
            type="text"
            value={regUsername}
            onChange={(e) => setRegUsername(e.target.value)}
            placeholder="Логин"
            className={inputCls}
          />
          <input
            type="email"
            value={regEmail}
            onChange={(e) => setRegEmail(e.target.value)}
            placeholder="Email"
            className={inputCls}
          />
          <input
            type="password"
            value={regPassword}
            onChange={(e) => setRegPassword(e.target.value)}
            placeholder="Пароль"
            className={inputCls}
          />
          <input
            type="password"
            value={regPassword2}
            onChange={(e) => setRegPassword2(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRegister()}
            placeholder="Повторите пароль"
            className={inputCls}
          />
          {errorMsg}
          <button onClick={handleRegister} disabled={submitting} className={btnPrimary}>
            <UserPlus className="h-4 w-4" />
            {submitting ? "Отправка..." : "Зарегистрироваться"}
          </button>
        </div>
      </>
    );
  }

  // === Экран: Подтверждение кода ===
  if (screen === "verify") {
    return modalShell(
      <>
        {backBtn("register")}
        {closeBtn}
        <div className="flex flex-col items-center mb-4">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--bg-elevated)]">
            <Mail className="h-8 w-8 text-[var(--text-secondary)]" />
          </div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Подтверждение</h2>
          <p className="text-sm text-[var(--text-muted)] text-center mt-1">
            Код отправлен на {verifyEmail}
          </p>
        </div>
        <div className="space-y-3">
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && handleVerify()}
            placeholder="6-значный код"
            className={`${inputCls} text-center text-lg tracking-[0.3em]`}
          />
          {errorMsg}
          <button onClick={handleVerify} disabled={submitting} className={btnPrimary}>
            {submitting ? "Проверка..." : "Подтвердить"}
          </button>
        </div>
      </>
    );
  }

  return null;
}
