"use client";

import { useState, useEffect } from "react";
import { Route, Ruler, Users } from "lucide-react";
import CountUp from "@/components/CountUp";
import { calcOnlineCount } from "./helpers";

export function StatCard({ icon: Icon, value, label, suffix, iconColor, inView }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] py-4 px-2 shadow-[var(--shadow-sm)]">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-light)] mb-1">
        <Icon className={`h-5 w-5 ${iconColor}`} />
      </div>
      <div className="text-2xl font-bold text-[var(--text-primary)] leading-tight">
        {inView ? <CountUp end={value} suffix={suffix} /> : "0"}
      </div>
      <div className="mt-0.5 text-xs text-[var(--text-secondary)] text-center">{label}</div>
    </div>
  );
}

export function OnlineStatCard({ inView, totalUsers }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    setCount(calcOnlineCount(totalUsers));
  }, [totalUsers]);

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] py-4 px-2 shadow-[var(--shadow-sm)]">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 mb-1 relative">
        <Users className="h-5 w-5 text-purple-500" />
        <span className="absolute top-0.5 right-0.5 flex h-2.5 w-2.5">
          <span className="absolute inset-0 rounded-full bg-green-400 animate-online-dot" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
        </span>
      </div>
      <div className="text-2xl font-bold text-[var(--text-primary)] leading-tight">
        {inView ? <CountUp end={count} /> : "0"}
      </div>
      <div className="mt-0.5 text-xs text-[var(--text-secondary)] text-center">Онлайн</div>
    </div>
  );
}
