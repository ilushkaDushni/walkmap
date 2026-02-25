"use client";

import { useState, useEffect } from "react";
import { ArrowRight, RefreshCw } from "lucide-react";
import { useUser } from "./UserProvider";

export default function CurrencyConverter({ onConvert }) {
  const { user, authFetch, updateUser } = useUser();
  const [rate, setRate] = useState(10);
  const [amount, setAmount] = useState("");
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/currency/rate")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setRate(data.rate); })
      .catch(() => {});
  }, []);

  const coinsToConvert = parseInt(amount, 10) || 0;
  const routiksResult = coinsToConvert >= rate ? Math.floor(coinsToConvert / rate) : 0;
  const adjustedCoins = routiksResult * rate;

  const handleConvert = async () => {
    if (adjustedCoins <= 0 || converting) return;
    setConverting(true);
    setError(null);
    try {
      const res = await authFetch("/api/currency/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: adjustedCoins }),
      });
      if (res.ok) {
        const data = await res.json();
        updateUser({ coins: data.coins, routiks: data.routiks });
        setAmount("");
        onConvert?.(data);
      } else {
        const data = await res.json();
        setError(data.error || "Ошибка конвертации");
      }
    } catch {
      setError("Ошибка сети");
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-4">
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Конвертация валюты</h3>

      <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mb-3">
        <span>Курс: {rate} монет = 1 маршрутик</span>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1">
          <label className="text-[10px] text-[var(--text-muted)] mb-1 block">Монеты</label>
          <div className="flex items-center gap-1 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-color)] px-3 py-2">
            <span>🪙</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setError(null); }}
              placeholder={`мин ${rate}`}
              min={rate}
              step={rate}
              className="flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none w-full"
            />
          </div>
          <p className="text-[10px] text-[var(--text-muted)] mt-1">Баланс: {user?.coins || 0}</p>
        </div>

        <ArrowRight className="h-4 w-4 text-[var(--text-muted)] shrink-0 mt-2" />

        <div className="flex-1">
          <label className="text-[10px] text-[var(--text-muted)] mb-1 block">Маршрутики</label>
          <div className="flex items-center gap-1 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-color)] px-3 py-2">
            <span>🔷</span>
            <span className="text-sm font-medium text-[var(--text-primary)]">{routiksResult}</span>
          </div>
          <p className="text-[10px] text-[var(--text-muted)] mt-1">Баланс: {user?.routiks || 0}</p>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-500 mt-2">{error}</p>
      )}

      <button
        onClick={handleConvert}
        disabled={adjustedCoins <= 0 || (user?.coins || 0) < adjustedCoins || converting}
        className="w-full mt-3 py-2 rounded-xl bg-blue-600 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {converting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
        Конвертировать
      </button>
    </div>
  );
}
