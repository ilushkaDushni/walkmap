"use client";

import { useState, useEffect } from "react";
import useInView from "./useInView";
import SectionTitle from "./SectionTitle";

const GRADIENTS = [
  "from-blue-500 to-sky-500",
  "from-pink-500 to-rose-500",
  "from-green-500 to-emerald-500",
  "from-purple-500 to-violet-500",
  "from-orange-500 to-amber-500",
  "from-teal-500 to-cyan-500",
];

export default function ReviewsSection({ onWriteReview }) {
  const [ref, inView] = useInView();
  const [reviews, setReviews] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!inView || loaded) return;
    fetch("/api/reviews?limit=6&featured=true")
      .then((r) => r.json())
      .then((data) => setReviews(data.reviews || []))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [inView, loaded]);

  if (loaded && reviews.length === 0) return null;

  return (
    <div ref={ref} className={`${inView ? "animate-slide-up" : "opacity-0"}`}>
      <div className="flex items-center justify-between">
        <SectionTitle>Отзывы</SectionTitle>
        {onWriteReview && (
          <button
            onClick={onWriteReview}
            className="text-xs font-medium text-green-500 hover:text-green-400 transition"
          >
            Написать →
          </button>
        )}
      </div>
      <div className="flex gap-3 overflow-x-auto scrollbar-none mt-2 -mx-4 px-4 pb-1">
        {reviews.map((r, i) => (
          <div
            key={r.id}
            className="shrink-0 w-[68vw] max-w-[260px] rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 shadow-[var(--shadow-sm)]"
          >
            <div className="flex items-center gap-3 mb-3">
              {r.avatarUrl ? (
                <img src={r.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover shrink-0" />
              ) : (
                <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${GRADIENTS[i % GRADIENTS.length]} shrink-0`}>
                  <span className="text-sm font-bold text-white">{(r.username || "?")[0].toUpperCase()}</span>
                </div>
              )}
              <div>
                <div className="text-sm font-bold text-[var(--text-primary)]">{r.username}</div>
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }, (_, j) => (
                    <span key={j} className={`text-xs ${j < r.rating ? "text-yellow-400" : "text-[var(--text-muted)]/30"}`}>&#9733;</span>
                  ))}
                </div>
              </div>
            </div>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed line-clamp-3">{r.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
