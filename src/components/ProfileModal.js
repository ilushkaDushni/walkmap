"use client";

import { useEffect, useState, useRef } from "react";
import { X, LogIn, LogOut, Shield, UserPlus, ArrowLeft, Mail, Pencil, Camera } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "./UserProvider";
import UserAvatar from "./UserAvatar";
import AvatarCropper from "./AvatarCropper";

export default function ProfileModal({ isOpen, onClose }) {
  const { user, login, register, verify, logout, authFetch, updateUser } = useUser();
  const router = useRouter();
  // "profile" | "login" | "register" | "verify" | "edit"
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

  // Edit fields
  const [editBio, setEditBio] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState(null);
  const fileInputRef = useRef(null);

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

  // Заполнить bio при открытии экрана edit
  useEffect(() => {
    if (screen === "edit" && user) {
      setEditBio(user.bio || "");
    }
  }, [screen, user]);

  const handleLogin = async () => {
    setError("");
    setSubmitting(true);
    try {
      const result = await login(loginUsername, loginPassword);
      if (!result) return;
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

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCropImageSrc(reader.result);
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCroppedUpload = async (blob) => {
    setCropImageSrc(null);
    setError("");
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("file", new File([blob], "avatar.webp", { type: "image/webp" }));
      const res = await authFetch("/api/users/avatar", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка загрузки");
      updateUser({ avatarUrl: data.avatarUrl });
    } catch (e) {
      setError(e.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setError("");
    setUploadingAvatar(true);
    try {
      const res = await authFetch("/api/users/avatar", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка удаления");
      updateUser({ avatarUrl: null });
    } catch (e) {
      setError(e.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveBio = async () => {
    setError("");
    setSubmitting(true);
    try {
      const res = await authFetch("/api/users/bio", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio: editBio }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка сохранения");
      updateUser({ bio: data.bio });
      setScreen("profile");
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
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

  const primaryRoleColor = user?.roles?.[0]?.color || null;

  // === Экран: Редактирование профиля ===
  if (user && screen === "edit") {
    // Cropper sub-screen
    if (cropImageSrc) {
      return modalShell(
        <>
          <div className="flex flex-col items-center">
            <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4">Настройте аватар</h2>
            <AvatarCropper
              imageSrc={cropImageSrc}
              onCrop={handleCroppedUpload}
              onCancel={() => setCropImageSrc(null)}
            />
          </div>
        </>
      );
    }

    return modalShell(
      <>
        {backBtn("profile")}
        {closeBtn}
        <div className="flex flex-col items-center mb-4">
          <div className="relative mb-3">
            <UserAvatar username={user.username} avatarUrl={user.avatarUrl} roleColor={primaryRoleColor} size="xl" />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--text-primary)] text-[var(--bg-surface)] shadow-lg transition hover:opacity-90 disabled:opacity-50"
            >
              <Camera className="h-4 w-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
          {uploadingAvatar && (
            <p className="text-xs text-[var(--text-muted)] mb-2">Загрузка...</p>
          )}
          {user.avatarUrl && (
            <button
              onClick={handleRemoveAvatar}
              disabled={uploadingAvatar}
              className="text-xs text-red-400 hover:underline disabled:opacity-50 mb-1"
            >
              Удалить аватар
            </button>
          )}
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Редактирование</h2>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">О себе</label>
            <textarea
              value={editBio}
              onChange={(e) => setEditBio(e.target.value.slice(0, 200))}
              placeholder="Расскажите о себе..."
              rows={3}
              className={`${inputCls} resize-none`}
            />
            <div className="text-right text-[10px] text-[var(--text-muted)] mt-1">
              {editBio.length}/200
            </div>
          </div>
          {errorMsg}
          <button onClick={handleSaveBio} disabled={submitting} className={btnPrimary}>
            {submitting ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </>
    );
  }

  // === Экран: Профиль (залогинен) ===
  if (user) {
    return modalShell(
      <>
        {closeBtn}
        <div className="flex flex-col items-center">
          <div className="mb-3">
            <UserAvatar username={user.username} avatarUrl={user.avatarUrl} roleColor={primaryRoleColor} size="lg" />
          </div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">{user.username}</h2>
          {user.bio && (
            <p className="text-sm text-[var(--text-secondary)] text-center mt-1 max-w-[260px]">{user.bio}</p>
          )}
          <p className="text-xs text-[var(--text-muted)] mt-1">{user.email}</p>
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
        <div className="mt-4 space-y-2">
          <button onClick={() => { setScreen("edit"); setError(""); }} className={btnOutline}>
            <Pencil className="h-4 w-4" />
            Редактировать профиль
          </button>
          <Link
            href={`/users/${user.username}`}
            onClick={onClose}
            className={`${btnOutline} no-underline`}
          >
            Открыть профиль
          </Link>
          <button onClick={handleLogout} className={`${btnOutline} text-red-400 border-red-400/30 hover:bg-red-400/10`}>
            <LogOut className="h-4 w-4" />
            Выйти
          </button>
        </div>
      </>
    );
  }

  // === Экран: Профиль (гость) ===
  if (screen === "profile") {
    return modalShell(
      <>
        {closeBtn}
        <div className="flex flex-col items-center">
          <div className="mb-3">
            <UserAvatar username="?" size="lg" />
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
