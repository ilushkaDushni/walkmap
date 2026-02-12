"use client";

import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

const NavigationGuardContext = createContext(null);

export function useNavigationGuard() {
  return useContext(NavigationGuardContext);
}

export default function NavigationGuardProvider({ children }) {
  const router = useRouter();
  // { isDirty: () => bool, onSave: () => Promise, onLeave?: () => void }
  const guardRef = useRef(null);
  const [modal, setModal] = useState(null); // { url: string } | null
  const [visible, setVisible] = useState(false);

  const registerGuard = useCallback((isDirtyFn, onSaveFn, onLeaveFn) => {
    guardRef.current = { isDirty: isDirtyFn, onSave: onSaveFn, onLeave: onLeaveFn };
  }, []);

  const unregisterGuard = useCallback(() => {
    guardRef.current = null;
  }, []);

  const navigate = useCallback((url) => {
    if (guardRef.current?.isDirty()) {
      setModal({ url });
      requestAnimationFrame(() => setVisible(true));
    } else {
      router.push(url);
    }
  }, [router]);

  const doLeave = useCallback((url) => {
    const onLeave = guardRef.current?.onLeave;
    guardRef.current = null;
    onLeave?.();
    if (url === "__back__") {
      window.history.back();
    } else if (url) {
      router.push(url);
    }
  }, [router]);

  const closeModal = useCallback((action) => {
    setVisible(false);
    setTimeout(action, 200);
  }, []);

  const handleDiscard = useCallback(() => {
    const url = modal?.url;
    closeModal(() => {
      setModal(null);
      doLeave(url);
    });
  }, [modal, closeModal, doLeave]);

  const handleSave = useCallback(async () => {
    const url = modal?.url;
    await guardRef.current?.onSave();
    closeModal(() => {
      setModal(null);
      doLeave(url);
    });
  }, [modal, closeModal, doLeave]);

  const handleCancel = useCallback(() => {
    closeModal(() => setModal(null));
  }, [closeModal]);

  // Intercept browser back button
  useEffect(() => {
    const handler = () => {
      if (guardRef.current?.isDirty()) {
        window.history.pushState(null, "", window.location.href);
        setModal({ url: "__back__" });
        requestAnimationFrame(() => setVisible(true));
      }
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  return (
    <NavigationGuardContext.Provider value={{ registerGuard, unregisterGuard, navigate }}>
      {children}
      {modal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
          onClick={handleCancel}
        >
          <div
            className={`w-full max-w-sm rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-5 shadow-xl transition-all duration-200 ${
              visible ? "scale-100 opacity-100" : "scale-75 opacity-0"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-[var(--text-primary)] mb-2">
              Несохранённые изменения
            </h3>
            <p className="text-sm text-[var(--text-secondary)] mb-5">
              У вас есть несохранённые изменения. Хотите сохранить их перед выходом?
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDiscard}
                className="flex-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-4 py-2.5 text-sm font-medium text-red-500 transition hover:bg-red-500/10"
              >
                Не сохранять
              </button>
              <button
                onClick={handleCancel}
                className="flex-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] transition hover:bg-[var(--bg-surface)]"
              >
                Остаться
              </button>
              <button
                onClick={handleSave}
                className="flex-1 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-green-700"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </NavigationGuardContext.Provider>
  );
}
