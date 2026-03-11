"use client";

import { useState, useEffect } from "react";
import { calcOnlineCount } from "./helpers";

export default function OnlineCounter({ totalUsers }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    setCount(calcOnlineCount(totalUsers));
  }, [totalUsers]);

  if (!count) return null;
  return (
    <div className="flex items-center justify-center gap-2 py-2.5 px-4 animate-slide-up">
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inset-0 rounded-full bg-green-400 animate-online-dot" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
      </span>
      <span className="text-sm text-[var(--text-secondary)]">
        Сейчас гуляют <span className="font-bold text-[var(--text-primary)]">{count}</span> человек
      </span>
    </div>
  );
}
