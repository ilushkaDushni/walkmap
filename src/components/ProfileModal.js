"use client";

import { useEffect, useState, useRef } from "react";
import { X, LogIn, LogOut, Shield, UserPlus, ArrowLeft, Mail, Pencil, Settings, Camera, Trash2, Lock, ChevronDown, ChevronUp, Package, Info, Send, MapPin, CheckCircle, LifeBuoy, Paperclip, GraduationCap, Star, Pin } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "./UserProvider";
import { useTheme, FREE_THEMES } from "./ThemeProvider";
import ThemePicker from "./ThemePicker";
import UserAvatar from "./UserAvatar";
import AvatarCropper from "./AvatarCropper";
import { APP_VERSION } from "@/lib/version";

export default function ProfileModal({ isOpen, onClose, initialScreen }) {
  const { user, login, register, verify, logout, authFetch, updateUser } = useUser();
  const router = useRouter();
  // "profile" | "login" | "register" | "verify" | "welcome" | "edit" | "settings" | "about"
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

  // Support
  const [supportTicketId, setSupportTicketId] = useState(null);

  // Closing animation
  const [closing, setClosing] = useState(false);
  const animateClose = (cb) => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
      if (cb) cb();
    }, 200);
  };

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
    if (isOpen && initialScreen) {
      setScreen(initialScreen);
    }
  }, [isOpen, initialScreen]);

  // Event: открыть экран поддержки (из уведомлений / главной)
  useEffect(() => {
    const handler = (e) => {
      const ticketId = e.detail?.ticketId || null;
      setSupportTicketId(ticketId);
      setScreen(ticketId ? "support-detail" : "support");
      // Открыть модал если закрыт — через ProfileModal isOpen управляется извне,
      // dispatch open-profile-modal чтобы открыть
      if (!isOpen) {
        window.dispatchEvent(new Event("open-profile-modal"));
        // Повторно установить экран после открытия
        setTimeout(() => {
          setSupportTicketId(ticketId);
          setScreen(ticketId ? "support-detail" : "support");
        }, 50);
      }
    };
    window.addEventListener("open-support-screen", handler);
    return () => window.removeEventListener("open-support-screen", handler);
  }, [isOpen]);

  // Event: открыть экран отзывов (из главной)
  useEffect(() => {
    const handler = () => {
      setScreen("reviews");
      if (!isOpen) {
        window.dispatchEvent(new Event("open-profile-modal"));
        setTimeout(() => setScreen("reviews"), 50);
      }
    };
    window.addEventListener("open-reviews-screen", handler);
    return () => window.removeEventListener("open-reviews-screen", handler);
  }, [isOpen]);

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
      setSupportTicketId(null);
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
      setTimeout(() => window.dispatchEvent(new Event("tutorial-new-user")), 1000);
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
      className={`fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${closing ? "opacity-0" : "opacity-100"}`}
      onClick={() => animateClose()}
    />
  );

  const modalShell = (children) => (
    <>
      {backdrop}
      <div className={`fixed inset-x-4 bottom-36 z-[70] mx-auto max-w-md ${closing ? "animate-slide-out-down" : "animate-slide-up"}`}>
        <div className="rounded-3xl bg-[var(--bg-surface)] p-6 shadow-2xl transition-colors max-h-[75dvh] overflow-y-auto">
          {children}
        </div>
      </div>
    </>
  );

  const closeBtn = (
    <button
      onClick={() => animateClose()}
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

  // === Экраны поддержки ===
  if (user && (screen === "support" || screen === "support-new" || screen === "support-detail" || screen === "support-email")) {
    return (
      <SupportScreens
        screen={screen}
        setScreen={setScreen}
        ticketId={supportTicketId}
        setTicketId={setSupportTicketId}
        onClose={onClose}
        modalShell={modalShell}
        backBtn={backBtn}
        closeBtn={closeBtn}
        inputCls={inputCls}
        btnPrimary={btnPrimary}
        authFetch={authFetch}
        user={user}
      />
    );
  }

  // === Экран: Отзывы ===
  if (screen === "reviews") {
    return (
      <ReviewsScreen
        modalShell={modalShell}
        backBtn={backBtn}
        closeBtn={closeBtn}
        inputCls={inputCls}
        btnPrimary={btnPrimary}
        user={user}
        authFetch={authFetch}
      />
    );
  }

  // === Экран: О приложении ===
  if (screen === "about") {
    return (
      <AboutScreen
        modalShell={modalShell}
        backBtn={backBtn}
        closeBtn={closeBtn}
        inputCls={inputCls}
        btnPrimary={btnPrimary}
        user={user}
        goBack={user ? "settings" : "profile"}
        animateClose={animateClose}
      />
    );
  }

  // === Экран: Настройки ===
  if (user && screen === "settings") {
    return <SettingsScreen modalShell={modalShell} backBtn={backBtn} closeBtn={closeBtn} onClose={onClose} setScreen={setScreen} />;
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
                onClick={() => {
                  onClose();
                  router.push("/");
                  setTimeout(() => window.dispatchEvent(new Event("tutorial-new-user")), 1000);
                }}
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
            <UserAvatar username={user.username} avatarUrl={user.avatarUrl} roleColor={primaryRoleColor} size="lg" equippedItems={user.equippedItems} />
          </div>
          <h2 className="text-lg font-bold" style={{ color: user.equippedItems?.usernameColor?.cssData?.color || "var(--text-primary)" }}>{user.username}</h2>
          {user.equippedItems?.title?.cssData?.text && (
            <span className="text-xs font-medium mt-0.5" style={{ color: user.equippedItems.title.cssData.color || "var(--text-secondary)" }}>
              {user.equippedItems.title.cssData.text}
            </span>
          )}
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
          {/* Баланс */}
          <div className="flex items-center justify-center gap-4 mb-1">
            <div className="flex items-center gap-1 text-sm">
              <span>🪙</span>
              <span className="font-bold text-[var(--text-primary)]">{user.coins || 0}</span>
            </div>
            <div className="flex items-center gap-1 text-sm">
              <span>🔷</span>
              <span className="font-bold text-[var(--text-primary)]">{user.routiks || 0}</span>
            </div>
          </div>

          <button onClick={() => { setScreen("edit"); setError(""); }} className={btnOutline}>
            <Pencil className="h-4 w-4" />
            Редактировать профиль
          </button>
          <Link
            href="/shop"
            onClick={onClose}
            className={`${btnOutline} no-underline`}
          >
            <Package className="h-4 w-4" />
            Магазин
          </Link>
          <button onClick={() => { setScreen("support"); setError(""); }} className={btnOutline}>
            <LifeBuoy className="h-4 w-4" />
            Поддержка
          </button>
          <button onClick={() => { setScreen("reviews"); setError(""); }} className={btnOutline}>
            <Star className="h-4 w-4" />
            Отзывы
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
          <button onClick={() => setScreen("reviews")} className={btnOutline}>
            <Star className="h-4 w-4" />
            Отзывы
          </button>
          <button
            onClick={() => setScreen("about")}
            className="w-full text-center text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition pt-1"
          >
            О приложении
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

function ReviewsScreen({ modalShell, backBtn, closeBtn, inputCls, btnPrimary, user, authFetch }) {
  const [reviews, setReviews] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const LIMIT = 20;

  const loadReviews = async (off = 0, append = false) => {
    try {
      const res = await fetch(`/api/reviews?limit=${LIMIT}&offset=${off}`);
      const data = await res.json();
      setReviews((prev) => append ? [...prev, ...data.reviews] : data.reviews);
      setTotal(data.total);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadReviews(); }, []);

  const handleSubmit = async () => {
    if (!rating) { setError("Выберите оценку"); return; }
    if (!text.trim()) { setError("Напишите отзыв"); return; }
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const res = await authFetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, text: text.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      setReviews((prev) => [data, ...prev]);
      setTotal((t) => t + 1);
      setRating(0);
      setText("");
      setSuccess("Отзыв отправлен!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await authFetch(`/api/reviews/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Ошибка");
      }
      setReviews((prev) => prev.filter((r) => r.id !== id));
      setTotal((t) => t - 1);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleToggleFeatured = async (id, currentFeatured) => {
    try {
      const res = await authFetch(`/api/reviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featured: !currentFeatured }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      setReviews((prev) => prev.map((r) => r.id === id ? { ...r, featured: data.featured } : r));
    } catch (e) {
      setError(e.message);
    }
  };

  const handleLoadMore = () => {
    const newOffset = offset + LIMIT;
    setOffset(newOffset);
    loadReviews(newOffset, true);
  };

  const canManage = user?.permissions?.includes("reviews.manage");

  function timeAgo(date) {
    const diff = Date.now() - new Date(date).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return "только что";
    if (min < 60) return `${min} мин`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} ч`;
    const d = Math.floor(hr / 24);
    return `${d} дн`;
  }

  return modalShell(
    <>
      {backBtn("profile")}
      {closeBtn}
      <div className="pt-8">
        <div className="flex flex-col items-center mb-4">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500/20">
            <Star className="h-8 w-8 text-yellow-500" />
          </div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Отзывы</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{total} отзывов</p>
        </div>

        {/* Форма — только для авторизованных */}
        {user && (
          <div className="mb-4 rounded-2xl bg-[var(--bg-elevated)] p-4">
            <div className="flex justify-center gap-1 mb-3">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setRating(s)}
                  onMouseEnter={() => setHoverRating(s)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-1 transition active:scale-90"
                >
                  <Star
                    className={`h-7 w-7 transition ${
                      s <= (hoverRating || rating)
                        ? "text-yellow-400 fill-yellow-400"
                        : "text-[var(--text-muted)]/30"
                    }`}
                  />
                </button>
              ))}
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 500))}
              placeholder="Напишите свой отзыв..."
              rows={3}
              className={`${inputCls} resize-none`}
            />
            <div className="flex items-center justify-between mt-1 mb-2">
              <span className="text-[10px] text-[var(--text-muted)]">{text.length}/500</span>
            </div>
            {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
            {success && <p className="text-xs text-green-500 mb-2">{success}</p>}
            <button onClick={handleSubmit} disabled={submitting} className={btnPrimary}>
              <Star className="h-4 w-4" />
              {submitting ? "Отправка..." : "Оставить отзыв"}
            </button>
          </div>
        )}

        {/* Список отзывов */}
        {loading ? (
          <div className="py-6 text-center text-sm text-[var(--text-muted)]">Загрузка...</div>
        ) : reviews.length === 0 ? (
          <div className="py-6 text-center text-sm text-[var(--text-muted)]">Пока нет отзывов</div>
        ) : (
          <div className="space-y-2 max-h-[40vh] overflow-y-auto">
            {reviews.map((r) => (
              <div key={r.id} className="rounded-2xl bg-[var(--bg-elevated)] p-3">
                <div className="flex items-center gap-2.5 mb-2">
                  {r.avatarUrl ? (
                    <img src={r.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-emerald-500 shrink-0">
                      <span className="text-xs font-bold text-white">{(r.username || "?")[0].toUpperCase()}</span>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[var(--text-primary)] truncate">{r.username}</span>
                      <span className="text-[10px] text-[var(--text-muted)]">{timeAgo(r.createdAt)}</span>
                    </div>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }, (_, j) => (
                        <Star key={j} className={`h-3 w-3 ${j < r.rating ? "text-yellow-400 fill-yellow-400" : "text-[var(--text-muted)]/30"}`} />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {canManage && (
                      <button
                        onClick={() => handleToggleFeatured(r.id, r.featured)}
                        className={`p-1 transition ${r.featured ? "text-green-500" : "text-[var(--text-muted)] hover:text-green-500"}`}
                        title={r.featured ? "Убрать с главной" : "Показать на главной"}
                      >
                        <Pin className={`h-3.5 w-3.5 ${r.featured ? "fill-green-500" : ""}`} />
                      </button>
                    )}
                    {(user && (r.userId === user.id || canManage)) && (
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="p-1 text-[var(--text-muted)] hover:text-red-400 transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{r.text}</p>
              </div>
            ))}
            {reviews.length < total && (
              <button
                onClick={handleLoadMore}
                className="w-full text-center text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition py-2"
              >
                Загрузить ещё
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function AboutScreen({ modalShell, backBtn, closeBtn, inputCls, btnPrimary, user, goBack, animateClose }) {
  const router = useRouter();
  const [name, setName] = useState(user?.username || "");
  const [email, setEmail] = useState(user?.email || "");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null); // { ok: bool, text: string }

  const handleSend = async () => {
    if (!email.trim() || !message.trim()) {
      setResult({ ok: false, text: "Заполните email и сообщение" });
      return;
    }
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), message: message.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка отправки");
      setResult({ ok: true, text: "Сообщение отправлено!" });
      setMessage("");
    } catch (e) {
      setResult({ ok: false, text: e.message });
    } finally {
      setSending(false);
    }
  };

  return modalShell(
    <>
      {backBtn(goBack)}
      {closeBtn}
      <div className="flex flex-col items-center mb-4">
        <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/10">
          <MapPin className="h-8 w-8 text-green-500" />
        </div>
        <h2 className="text-lg font-bold text-[var(--text-primary)]">Ростов GO</h2>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">Больше, чем просто прогулка</p>
      </div>

      <p className="text-sm text-[var(--text-secondary)] text-center mb-4 leading-relaxed">
        Приложение для прогулок по Ростову-на-Дону. Исследуйте город через уникальные маршруты с аудиогидом, зарабатывайте монеты и открывайте достижения.
      </p>

      <div className="text-center mb-4">
        <span className="text-[10px] text-[var(--text-muted)]">Версия {APP_VERSION}</span>
      </div>

      {/* Правила сообщества */}
      <button
        onClick={() => animateClose(() => router.push("/rules"))}
        className="flex w-full items-center justify-between rounded-2xl bg-[var(--bg-elevated)] px-4 py-3 mb-4 no-underline transition hover:opacity-80"
      >
        <span className="text-sm font-medium text-[var(--text-primary)]">Правила сообщества</span>
        <Shield className="h-4 w-4 text-[var(--text-muted)]" />
      </button>

      {/* Форма обратной связи */}
      <div className="border-t border-[var(--border-color)] pt-4">
        <h3 className="text-sm font-bold text-[var(--text-primary)] mb-3">Обратная связь</h3>

        {result?.ok ? (
          <div className="flex flex-col items-center py-4">
            <CheckCircle className="h-10 w-10 text-green-500 mb-2" />
            <p className="text-sm font-medium text-green-500">{result.text}</p>
            <button
              onClick={() => setResult(null)}
              className="mt-3 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition"
            >
              Отправить ещё
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 100))}
              placeholder="Имя (необязательно)"
              className={inputCls}
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email *"
              className={inputCls}
            />
            <div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
                placeholder="Ваше сообщение *"
                rows={4}
                className={`${inputCls} resize-none`}
              />
              <div className="text-right text-[10px] text-[var(--text-muted)] mt-1">
                {message.length}/1000
              </div>
            </div>
            {result && !result.ok && (
              <p className="text-center text-xs text-red-400">{result.text}</p>
            )}
            <button onClick={handleSend} disabled={sending} className={btnPrimary}>
              <Send className="h-4 w-4" />
              {sending ? "Отправка..." : "Отправить"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function EmailFeedbackScreen({ modalShell, backBtn, closeBtn, inputCls, btnPrimary, user }) {
  const [name, setName] = useState(user?.username || "");
  const [email, setEmail] = useState(user?.email || "");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const handleSend = async () => {
    if (!email.trim() || !message.trim()) {
      setResult({ ok: false, text: "Заполните email и сообщение" });
      return;
    }
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), message: message.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка отправки");
      setResult({ ok: true, text: "Отправлено!" });
      setMessage("");
    } catch (e) {
      setResult({ ok: false, text: e.message });
    } finally {
      setSending(false);
    }
  };

  return modalShell(
    <>
      {backBtn("support")}
      {closeBtn}
      <div className="flex flex-col items-center mb-4">
        <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/20">
          <Mail className="h-8 w-8 text-blue-500" />
        </div>
        <h2 className="text-lg font-bold text-[var(--text-primary)]">Написать на почту</h2>
        <p className="text-xs text-[var(--text-muted)] mt-1">Ответ придёт на ваш email</p>
      </div>

      {result?.ok ? (
        <div className="flex flex-col items-center py-6">
          <CheckCircle className="h-12 w-12 text-green-500 mb-3" />
          <p className="text-sm font-semibold text-green-500">{result.text}</p>
          <button
            onClick={() => setResult(null)}
            className="mt-3 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition"
          >
            Отправить ещё
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 100))}
            placeholder="Имя"
            className={inputCls}
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email *"
            className={inputCls}
          />
          <div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
              placeholder="Ваше сообщение *"
              rows={5}
              className={`${inputCls} resize-none`}
            />
            <div className="text-right text-[10px] text-[var(--text-muted)] mt-1">{message.length}/1000</div>
          </div>
          {result && !result.ok && (
            <p className="text-center text-xs text-red-400">{result.text}</p>
          )}
          <button onClick={handleSend} disabled={sending} className={btnPrimary}>
            <Send className="h-4 w-4" />
            {sending ? "Отправка..." : "Отправить"}
          </button>
        </div>
      )}
    </>
  );
}

function SupportScreens({ screen, setScreen, ticketId, setTicketId, onClose, modalShell, backBtn, closeBtn, inputCls, btnPrimary, authFetch, user }) {
  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [ticketData, setTicketData] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [pendingImageUrl, setPendingImageUrl] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Загрузка списка тикетов
  useEffect(() => {
    if (screen === "support") {
      setLoadingTickets(true);
      authFetch("/api/tickets")
        .then((r) => r.json())
        .then((data) => setTickets(Array.isArray(data) ? data : []))
        .catch(() => setTickets([]))
        .finally(() => setLoadingTickets(false));
    }
  }, [screen, authFetch]);

  // Загрузка деталей тикета
  useEffect(() => {
    if (screen === "support-detail" && ticketId) {
      setLoadingDetail(true);
      authFetch(`/api/tickets/${ticketId}`)
        .then((r) => r.json())
        .then((data) => setTicketData(data))
        .catch(() => setTicketData(null))
        .finally(() => setLoadingDetail(false));
    }
  }, [screen, ticketId, authFetch]);

  // Polling: обновлять сообщения каждые 5 секунд пока тикет открыт
  useEffect(() => {
    if (screen !== "support-detail" || !ticketId) return;
    const interval = setInterval(async () => {
      try {
        const res = await authFetch(`/api/tickets/${ticketId}`);
        if (res.ok) {
          const data = await res.json();
          setTicketData((prev) => {
            if (!prev || data.messages?.length !== prev.messages?.length) return data;
            return prev;
          });
        }
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [screen, ticketId, authFetch]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (ticketData?.messages) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [ticketData?.messages?.length]);

  const handleCreateTicket = async () => {
    const subj = newSubject.trim();
    const msg = newMessage.trim();
    if (!subj || (!msg && !pendingImageUrl)) {
      setError("Заполните тему и сообщение");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await authFetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subj, message: msg, imageUrl: pendingImageUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      setNewSubject("");
      setNewMessage("");
      setPendingImageUrl(null);
      setTicketId(data.id);
      setScreen("support-detail");
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async () => {
    const text = replyText.trim();
    if (!text && !pendingImageUrl) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await authFetch(`/api/tickets/${ticketId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, imageUrl: pendingImageUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      setReplyText("");
      setPendingImageUrl(null);
      const fresh = await authFetch(`/api/tickets/${ticketId}`);
      setTicketData(await fresh.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Максимальный размер — 5 МБ");
      return;
    }
    setUploadingImage(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await authFetch("/api/tickets/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка загрузки");
      setPendingImageUrl(data.url);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const statusBadge = (status) => (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${status === "open" ? "bg-green-500/15 text-green-500" : "bg-[var(--text-muted)]/15 text-[var(--text-muted)]"}`}>
      {status === "open" ? "Открыт" : "Закрыт"}
    </span>
  );

  function timeAgo(date) {
    const diff = Date.now() - new Date(date).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return "только что";
    if (min < 60) return `${min} мин`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} ч`;
    const d = Math.floor(hr / 24);
    return `${d} дн`;
  }

  // === Список тикетов ===
  if (screen === "support") {
    return modalShell(
      <>
        {backBtn("profile")}
        {closeBtn}
        <div className="pt-8">
          <div className="flex flex-col items-center mb-4">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-teal-500/20">
              <LifeBuoy className="h-8 w-8 text-teal-500" />
            </div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Поддержка</h2>
          </div>
          <div className="space-y-2">
            <button onClick={() => { setScreen("support-new"); setError(""); }} className={btnPrimary}>
              <Send className="h-4 w-4" />
              Новое обращение
            </button>
            {loadingTickets ? (
              <div className="py-6 text-center text-sm text-[var(--text-muted)]">Загрузка...</div>
            ) : tickets.length === 0 ? (
              <div className="py-6 text-center text-sm text-[var(--text-muted)]">У вас пока нет обращений</div>
            ) : (
              <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                {tickets.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { setTicketId(t.id); setScreen("support-detail"); setReplyText(""); setError(""); setPendingImageUrl(null); }}
                    className="flex w-full items-center gap-3 rounded-2xl bg-[var(--bg-elevated)] p-3 text-left transition hover:opacity-80"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {t.ticketNumber && <span className="text-[10px] font-bold text-teal-500 shrink-0">#{t.ticketNumber}</span>}
                        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{t.subject}</p>
                        {statusBadge(t.status)}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-[var(--text-muted)]">{timeAgo(t.updatedAt)}</span>
                        <span className="text-[10px] text-[var(--text-muted)]">{t.messageCount} сообщ.</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Написать на почту */}
          <div className="border-t border-[var(--border-color)] mt-4 pt-4">
            <button
              onClick={() => setScreen("support-email")}
              className="flex w-full items-center gap-3 rounded-2xl bg-[var(--bg-elevated)] p-3 transition hover:opacity-80"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500/15">
                <Mail className="h-4 w-4 text-blue-500" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Написать на почту</p>
                <p className="text-[11px] text-[var(--text-muted)]">Ответ на email в течение дня</p>
              </div>
            </button>
          </div>
        </div>
      </>
    );
  }

  // === Создание тикета ===
  if (screen === "support-new") {
    return modalShell(
      <>
        {backBtn("support")}
        {closeBtn}
        <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageUpload} />
        <div className="pt-8">
          <div className="flex flex-col items-center mb-4">
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Новое обращение</h2>
            <p className="text-xs text-[var(--text-muted)] mt-1">Опишите вашу проблему или предложение</p>
          </div>
          <div className="space-y-3">
            <input
              type="text"
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value.slice(0, 100))}
              placeholder="Тема обращения"
              className={inputCls}
            />
            <div className="text-right text-[10px] text-[var(--text-muted)] -mt-2">{newSubject.length}/100</div>
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value.slice(0, 1000))}
              placeholder="Ваше сообщение..."
              rows={4}
              className={`${inputCls} resize-none`}
            />
            <div className="text-right text-[10px] text-[var(--text-muted)] -mt-2">{newMessage.length}/1000</div>
            {/* Фото */}
            {pendingImageUrl && (
              <div className="relative inline-block">
                <img src={pendingImageUrl} alt="" className="h-20 rounded-xl" />
                <button onClick={() => setPendingImageUrl(null)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage}
              className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition disabled:opacity-50"
            >
              <Paperclip className="h-4 w-4" />
              {uploadingImage ? "Загрузка..." : pendingImageUrl ? "Заменить фото" : "Прикрепить фото"}
            </button>
            {error && <p className="text-center text-xs text-red-400">{error}</p>}
            <button onClick={handleCreateTicket} disabled={submitting} className={btnPrimary}>
              <Send className="h-4 w-4" />
              {submitting ? "Отправка..." : "Отправить"}
            </button>
          </div>
        </div>
      </>
    );
  }

  // === Email-форма ===
  if (screen === "support-email") {
    return <EmailFeedbackScreen
      modalShell={modalShell}
      backBtn={backBtn}
      closeBtn={closeBtn}
      inputCls={inputCls}
      btnPrimary={btnPrimary}
      user={user}
    />;
  }

  // === Детали тикета ===
  if (screen === "support-detail") {
    if (loadingDetail) {
      return modalShell(
        <>
          {backBtn("support")}
          {closeBtn}
          <div className="pt-8 py-10 text-center text-sm text-[var(--text-muted)]">Загрузка...</div>
        </>
      );
    }

    if (!ticketData) {
      return modalShell(
        <>
          {backBtn("support")}
          {closeBtn}
          <div className="pt-8 py-10 text-center text-sm text-[var(--text-muted)]">Не удалось загрузить</div>
        </>
      );
    }

    return modalShell(
      <>
        {backBtn("support")}
        {closeBtn}
        <div className="pt-8">
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-1">
              {ticketData.ticketNumber && <span className="text-xs font-bold text-teal-500">#{ticketData.ticketNumber}</span>}
              <h2 className="text-base font-bold text-[var(--text-primary)] truncate flex-1">{ticketData.subject}</h2>
              {statusBadge(ticketData.status)}
            </div>
            <span className="text-[10px] text-[var(--text-muted)]">Создано {timeAgo(ticketData.createdAt)}</span>
          </div>

          {/* Лента сообщений */}
          <div className="space-y-2 max-h-[40vh] overflow-y-auto mb-3 pr-1">
            {(ticketData.messages || []).map((m) => {
              const isUser = m.senderType === "user";
              return (
                <div key={m.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                  {!isUser && m.sender && (
                    <div className="shrink-0 mr-2 mt-1">
                      <UserAvatar username={m.sender.username || "Поддержка"} avatarUrl={m.sender.avatarUrl} size="sm" />
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${isUser ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]" : "bg-teal-500/15 text-[var(--text-primary)]"}`}>
                    {!isUser && (
                      <p className="text-[10px] font-bold text-teal-500 mb-0.5">{m.sender?.username || "Поддержка"}</p>
                    )}
                    {m.imageUrl && (
                      <img src={m.imageUrl} alt="" className="rounded-xl max-w-full mb-1 cursor-pointer" onClick={() => window.open(m.imageUrl, "_blank")} />
                    )}
                    {m.text && <p className="text-sm whitespace-pre-wrap break-words">{m.text}</p>}
                    <p className="text-[9px] text-[var(--text-muted)] mt-1 text-right">{timeAgo(m.createdAt)}</p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Поле ввода */}
          {ticketData.status === "open" ? (
            <div className="space-y-2">
              {error && <p className="text-center text-xs text-red-400">{error}</p>}
              {pendingImageUrl && (
                <div className="relative inline-block">
                  <img src={pendingImageUrl} alt="" className="h-16 rounded-lg" />
                  <button onClick={() => setPendingImageUrl(null)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              <div className="flex gap-2 items-end">
                <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageUpload} />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-2xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition disabled:opacity-50"
                >
                  <Paperclip className="h-5 w-5" />
                </button>
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value.slice(0, 1000))}
                  onKeyDown={(e) => e.key === "Enter" && handleReply()}
                  placeholder="Написать..."
                  className={`${inputCls} flex-1`}
                />
                <button
                  onClick={handleReply}
                  disabled={submitting || (!replyText.trim() && !pendingImageUrl)}
                  className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-2xl bg-teal-500 text-white transition hover:bg-teal-600 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-2 text-sm text-[var(--text-muted)]">Обращение закрыто</div>
          )}
        </div>
      </>
    );
  }

  return null;
}

function SettingsScreen({ modalShell, backBtn, closeBtn, onClose, setScreen }) {
  const { theme, setTheme } = useTheme();

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
        {/* Тема */}
        <div className="rounded-2xl bg-[var(--bg-elevated)] px-4 py-3">
          <span className="text-sm text-[var(--text-secondary)] block mb-2">Тема оформления</span>
          <ThemePicker currentTheme={theme} onSelect={setTheme} />
        </div>

        {/* Пройти обучение */}
        <button
          onClick={() => {
            onClose();
            setTimeout(() => window.dispatchEvent(new Event("start-tutorial")), 300);
          }}
          className="flex w-full items-center justify-between rounded-2xl bg-[var(--bg-elevated)] px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <GraduationCap className="h-5 w-5 text-[var(--text-secondary)]" />
            <span className="text-sm text-[var(--text-secondary)]">Пройти обучение</span>
          </div>
          <span className="text-sm text-[var(--text-muted)]">&rarr;</span>
        </button>

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

        {/* О приложении */}
        <button
          onClick={() => setScreen("about")}
          className="flex w-full items-center justify-between rounded-2xl bg-[var(--bg-elevated)] px-4 py-3"
        >
          <span className="text-sm text-[var(--text-secondary)]">О приложении</span>
          <Info className="h-4 w-4 text-[var(--text-muted)]" />
        </button>
      </div>
    </>
  );
}
