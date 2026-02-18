"use client";

import { useEffect, useState, useRef } from "react";
import { X, LogIn, LogOut, Shield, UserPlus, ArrowLeft, Mail, Pencil, Settings, Camera, Trash2, Lock, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "./UserProvider";
import { useTheme } from "./ThemeProvider";
import UserAvatar from "./UserAvatar";
import AvatarCropper from "./AvatarCropper";
import { APP_VERSION } from "@/lib/version";

export default function ProfileModal({ isOpen, onClose }) {
  const { user, login, register, verify, logout, authFetch, updateUser } = useUser();
  const router = useRouter();
  // "profile" | "login" | "register" | "verify" | "welcome" | "edit" | "settings"
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
  const [cropImageSrc, setCropImageSrc] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef(null);

  // Welcome screen
  const [welcomeAvatarBlob, setWelcomeAvatarBlob] = useState(null);
  const [welcomeAvatarPreview, setWelcomeAvatarPreview] = useState(null);

  // Username change
  const [editUsername, setEditUsername] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);
  const [usernameMsg, setUsernameMsg] = useState({ text: "", ok: false });

  // Password change
  const [showPassword, setShowPassword] = useState(false);
  const [pwdMode, setPwdMode] = useState("change"); // "change" | "forgot" | "code"
  const [curPassword, setCurPassword] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdMsg, setPwdMsg] = useState({ text: "", ok: false });

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
      setCropImageSrc(null);
      if (welcomeAvatarPreview) URL.revokeObjectURL(welcomeAvatarPreview);
      setWelcomeAvatarBlob(null);
      setWelcomeAvatarPreview(null);
      setEditUsername("");
      setUsernameMsg({ text: "", ok: false });
      setShowPassword(false);
      setPwdMode("change");
      setCurPassword("");
      setNewPwd("");
      setConfirmPwd("");
      setResetCode("");
      setPwdMsg({ text: "", ok: false });
    }
  }, [isOpen]);

  // Заполнить bio и username при открытии экрана edit
  useEffect(() => {
    if (screen === "edit" && user) {
      setEditBio(user.bio || "");
      setEditUsername(user.username || "");
      setUsernameMsg({ text: "", ok: false });
      setShowPassword(false);
      setPwdMode("change");
      setCurPassword("");
      setNewPwd("");
      setConfirmPwd("");
      setResetCode("");
      setPwdMsg({ text: "", ok: false });
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
      setScreen("welcome");
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

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Файл слишком большой (макс. 5 МБ)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setCropImageSrc(reader.result);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleCroppedUpload = async (blob) => {
    setCropImageSrc(null);
    setUploadingAvatar(true);
    setError("");
    try {
      const form = new FormData();
      form.append("avatar", blob, "avatar.webp");
      const res = await authFetch("/api/users/avatar", { method: "POST", body: form });
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
    setUploadingAvatar(true);
    setError("");
    try {
      const res = await authFetch("/api/users/avatar", { method: "DELETE" });
      if (!res.ok) throw new Error("Ошибка удаления");
      updateUser({ avatarUrl: null });
    } catch (e) {
      setError(e.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Welcome: обрезка аватара (сохраняем blob, не загружаем сразу)
  const handleWelcomeCrop = (blob) => {
    setCropImageSrc(null);
    setWelcomeAvatarBlob(blob);
    if (welcomeAvatarPreview) URL.revokeObjectURL(welcomeAvatarPreview);
    setWelcomeAvatarPreview(URL.createObjectURL(blob));
  };

  // Welcome: сохранить аву + bio
  const handleWelcomeSave = async () => {
    setSubmitting(true);
    setError("");
    try {
      if (welcomeAvatarBlob) {
        const form = new FormData();
        form.append("avatar", welcomeAvatarBlob, "avatar.webp");
        const res = await authFetch("/api/users/avatar", { method: "POST", body: form });
        const data = await res.json();
        if (res.ok) updateUser({ avatarUrl: data.avatarUrl });
      }
      if (editBio.trim()) {
        const res = await authFetch("/api/users/bio", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bio: editBio }),
        });
        const data = await res.json();
        if (res.ok) updateUser({ bio: data.bio });
      }
      onClose();
      router.push("/");
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Смена ника
  const handleSaveUsername = async () => {
    const trimmed = editUsername.trim();
    if (trimmed === user.username) return;
    if (trimmed.length < 2 || trimmed.length > 20) {
      setUsernameMsg({ text: "Ник от 2 до 20 символов", ok: false });
      return;
    }
    setSavingUsername(true);
    setUsernameMsg({ text: "", ok: false });
    try {
      const res = await authFetch("/api/users/username", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      updateUser({ username: data.username, coins: data.coins });
      setUsernameMsg({ text: "Ник изменён", ok: true });
    } catch (e) {
      setUsernameMsg({ text: e.message, ok: false });
    } finally {
      setSavingUsername(false);
    }
  };

  // Смена пароля (с текущим паролем)
  const handleSavePassword = async () => {
    if (newPwd.length < 6) {
      setPwdMsg({ text: "Новый пароль минимум 6 символов", ok: false });
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdMsg({ text: "Пароли не совпадают", ok: false });
      return;
    }
    setSavingPwd(true);
    setPwdMsg({ text: "", ok: false });
    try {
      const res = await authFetch("/api/users/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: curPassword, newPassword: newPwd }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      setPwdMsg({ text: "Пароль изменён", ok: true });
      setCurPassword("");
      setNewPwd("");
      setConfirmPwd("");
    } catch (e) {
      setPwdMsg({ text: e.message, ok: false });
    } finally {
      setSavingPwd(false);
    }
  };

  // Забыли пароль — отправить код на email
  const handleForgotPassword = async () => {
    setSavingPwd(true);
    setPwdMsg({ text: "", ok: false });
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      setPwdMode("code");
      setPwdMsg({ text: `Код отправлен на ${user.email}`, ok: true });
    } catch (e) {
      setPwdMsg({ text: e.message, ok: false });
    } finally {
      setSavingPwd(false);
    }
  };

  // Сброс пароля по коду
  const handleResetPassword = async () => {
    if (newPwd.length < 6) {
      setPwdMsg({ text: "Новый пароль минимум 6 символов", ok: false });
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdMsg({ text: "Пароли не совпадают", ok: false });
      return;
    }
    setSavingPwd(true);
    setPwdMsg({ text: "", ok: false });
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, code: resetCode, newPassword: newPwd }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      setPwdMsg({ text: "Пароль изменён, войдите заново", ok: true });
      setResetCode("");
      setNewPwd("");
      setConfirmPwd("");
      setPwdMode("change");
      // Разлогин (токены удалены на сервере)
      setTimeout(() => logout(), 2000);
    } catch (e) {
      setPwdMsg({ text: e.message, ok: false });
    } finally {
      setSavingPwd(false);
    }
  };

  const usernameChanged = editUsername.trim() !== (user?.username || "");
  const isFirstUsernameChange = !user?.usernameChangedAt;

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

  // === Экран: Настройки ===
  if (user && screen === "settings") {
    return <SettingsScreen modalShell={modalShell} backBtn={backBtn} closeBtn={closeBtn} onClose={onClose} />;
  }

  // === Экран: Welcome (после регистрации) ===
  if (screen === "welcome") {
    return modalShell(
      <>
        {closeBtn}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileSelect}
        />

        {cropImageSrc ? (
          <div className="flex flex-col items-center mb-4">
            <h2 className="text-lg font-bold text-[var(--text-primary)] mb-3">Обрезка фото</h2>
            <AvatarCropper
              imageSrc={cropImageSrc}
              onCrop={handleWelcomeCrop}
              onCancel={() => setCropImageSrc(null)}
            />
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center mb-4">
              <h2 className="text-xl font-bold text-[var(--text-primary)]">Добро пожаловать!</h2>
              <p className="text-sm text-[var(--text-muted)] mt-1">Настройте свой профиль</p>
            </div>
            <div className="flex flex-col items-center mb-4">
              <div className="relative mb-3">
                {welcomeAvatarPreview ? (
                  <img
                    src={welcomeAvatarPreview}
                    alt="Аватар"
                    className="h-24 w-24 rounded-full object-cover border-2 border-[var(--border-color)]"
                  />
                ) : (
                  <UserAvatar username={user?.username || "?"} size="xl" />
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-green-500 text-white shadow-lg transition hover:bg-green-600"
                >
                  <Camera className="h-4 w-4" />
                </button>
              </div>
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
              <button onClick={handleWelcomeSave} disabled={submitting} className={btnPrimary}>
                {submitting ? "Сохранение..." : "Сохранить"}
              </button>
              <button
                onClick={() => { onClose(); router.push("/"); }}
                className={btnOutline}
              >
                Пропустить
              </button>
            </div>
          </>
        )}
      </>
    );
  }

  // === Экран: Редактирование профиля ===
  if (user && screen === "edit") {
    return modalShell(
      <>
        {backBtn("profile")}
        {closeBtn}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileSelect}
        />

        {cropImageSrc ? (
          <div className="flex flex-col items-center mb-4">
            <h2 className="text-lg font-bold text-[var(--text-primary)] mb-3">Обрезка фото</h2>
            <AvatarCropper
              imageSrc={cropImageSrc}
              onCrop={handleCroppedUpload}
              onCancel={() => setCropImageSrc(null)}
            />
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center mb-4">
              <div className="relative mb-3">
                <UserAvatar username={user.username} avatarUrl={user.avatarUrl} roleColor={primaryRoleColor} size="xl" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-green-500 text-white shadow-lg transition hover:bg-green-600 disabled:opacity-50"
                >
                  <Camera className="h-4 w-4" />
                </button>
              </div>
              {uploadingAvatar && (
                <p className="text-xs text-[var(--text-muted)]">Загрузка...</p>
              )}
              {user.avatarUrl && !uploadingAvatar && (
                <button
                  onClick={handleRemoveAvatar}
                  className="flex items-center gap-1 text-xs text-red-400 hover:text-red-500 transition mt-1"
                >
                  <Trash2 className="h-3 w-3" />
                  Удалить фото
                </button>
              )}
              <h2 className="text-lg font-bold text-[var(--text-primary)] mt-2">Редактирование</h2>
            </div>
            <div className="space-y-4">
              {/* --- Ник --- */}
              <div>
                <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">Ник</label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value.slice(0, 20))}
                  className={inputCls}
                />
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {isFirstUsernameChange ? "Первая смена — бесплатно" : "Смена ника — 50 монет"}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)]">{editUsername.trim().length}/20</span>
                </div>
                {usernameMsg.text && (
                  <p className={`text-xs mt-1 ${usernameMsg.ok ? "text-green-500" : "text-red-400"}`}>
                    {usernameMsg.text}
                  </p>
                )}
                {usernameChanged && (
                  <button
                    onClick={handleSaveUsername}
                    disabled={savingUsername}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--border-color)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--bg-elevated)] disabled:opacity-50"
                  >
                    {savingUsername ? "Сохранение..." : "Сменить ник"}
                  </button>
                )}
              </div>

              {/* --- О себе --- */}
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

              {/* --- Смена пароля --- */}
              <div className="border-t border-[var(--border-color)] pt-3">
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="flex w-full items-center justify-between text-sm font-medium text-[var(--text-secondary)]"
                >
                  <span className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Сменить пароль
                  </span>
                  {showPassword ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {showPassword && (
                  <div className="mt-3 space-y-2">
                    {pwdMode === "change" && (
                      <>
                        <input
                          type="password"
                          value={curPassword}
                          onChange={(e) => setCurPassword(e.target.value)}
                          placeholder="Текущий пароль"
                          className={inputCls}
                        />
                        <input
                          type="password"
                          value={newPwd}
                          onChange={(e) => setNewPwd(e.target.value)}
                          placeholder="Новый пароль"
                          className={inputCls}
                        />
                        <input
                          type="password"
                          value={confirmPwd}
                          onChange={(e) => setConfirmPwd(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSavePassword()}
                          placeholder="Повторите новый пароль"
                          className={inputCls}
                        />
                        <button
                          onClick={handleSavePassword}
                          disabled={savingPwd}
                          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--border-color)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--bg-elevated)] disabled:opacity-50"
                        >
                          {savingPwd ? "Сохранение..." : "Изменить пароль"}
                        </button>
                        <button
                          onClick={() => { setPwdMode("forgot"); setPwdMsg({ text: "", ok: false }); }}
                          className="w-full text-center text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition"
                        >
                          Не помню пароль
                        </button>
                      </>
                    )}
                    {pwdMode === "forgot" && (
                      <>
                        <p className="text-xs text-[var(--text-secondary)]">
                          Отправим код на <span className="font-medium">{user.email}</span>
                        </p>
                        <button
                          onClick={handleForgotPassword}
                          disabled={savingPwd}
                          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--border-color)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--bg-elevated)] disabled:opacity-50"
                        >
                          {savingPwd ? "Отправка..." : "Отправить код"}
                        </button>
                        <button
                          onClick={() => { setPwdMode("change"); setPwdMsg({ text: "", ok: false }); }}
                          className="w-full text-center text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition"
                        >
                          Вспомнил пароль
                        </button>
                      </>
                    )}
                    {pwdMode === "code" && (
                      <>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={resetCode}
                          onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ""))}
                          placeholder="6-значный код"
                          className={`${inputCls} text-center text-lg tracking-[0.3em]`}
                        />
                        <input
                          type="password"
                          value={newPwd}
                          onChange={(e) => setNewPwd(e.target.value)}
                          placeholder="Новый пароль"
                          className={inputCls}
                        />
                        <input
                          type="password"
                          value={confirmPwd}
                          onChange={(e) => setConfirmPwd(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleResetPassword()}
                          placeholder="Повторите новый пароль"
                          className={inputCls}
                        />
                        <button
                          onClick={handleResetPassword}
                          disabled={savingPwd}
                          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--border-color)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--bg-elevated)] disabled:opacity-50"
                        >
                          {savingPwd ? "Сохранение..." : "Сбросить пароль"}
                        </button>
                      </>
                    )}
                    {pwdMsg.text && (
                      <p className={`text-xs ${pwdMsg.ok ? "text-green-500" : "text-red-400"}`}>
                        {pwdMsg.text}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
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
          <button onClick={() => { setScreen("settings"); setError(""); }} className={btnOutline}>
            <Settings className="h-4 w-4" />
            Настройки
          </button>
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

function SettingsScreen({ modalShell, backBtn, closeBtn, onClose }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return modalShell(
    <>
      {backBtn("profile")}
      {closeBtn}
      <div className="flex flex-col items-center mb-4">
        <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--bg-elevated)]">
          <Settings className="h-8 w-8 text-[var(--text-secondary)]" />
        </div>
        <h2 className="text-lg font-bold text-[var(--text-primary)]">Настройки</h2>
      </div>
      <div className="space-y-3">
        {/* Тёмная тема */}
        <div className="flex items-center justify-between rounded-2xl bg-[var(--bg-elevated)] px-4 py-3">
          <span className="text-sm text-[var(--text-secondary)]">Тёмная тема</span>
          <button onClick={toggleTheme} className="relative">
            <div className={`h-6 w-10 rounded-full p-0.5 transition-colors ${isDark ? "bg-green-500" : "bg-[var(--bg-main)]"}`}>
              <div className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${isDark ? "translate-x-4" : "translate-x-0"}`} />
            </div>
          </button>
        </div>

        {/* Версия */}
        <button
          onClick={() => {
            onClose();
            window.dispatchEvent(new Event("show-update-modal"));
          }}
          className="flex w-full items-center justify-between rounded-2xl bg-[var(--bg-elevated)] px-4 py-3"
        >
          <span className="text-sm text-[var(--text-secondary)]">Версия</span>
          <span className="text-sm text-[var(--text-muted)]">{APP_VERSION}</span>
        </button>
      </div>
    </>
  );
}
