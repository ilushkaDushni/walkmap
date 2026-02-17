"use client";

import Link from "next/link";

const SIZES = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-16 w-16 text-xl",
  xl: "h-24 w-24 text-3xl",
};

const DOT_SIZES = {
  sm: "h-2 w-2 ring-[1.5px]",
  md: "h-2.5 w-2.5 ring-2",
  lg: "h-3.5 w-3.5 ring-2",
  xl: "h-4 w-4 ring-[3px]",
};

export default function UserAvatar({ username, avatarUrl, roleColor, size = "md", linkToProfile = false, online, className = "" }) {
  const sizeClass = SIZES[size] || SIZES.md;
  const initial = (username || "?")[0].toUpperCase();
  const bg = roleColor || "#6b7280";

  const avatarEl = avatarUrl ? (
    <img
      src={avatarUrl}
      alt={username || ""}
      className={`${sizeClass} rounded-full object-cover shrink-0 ${className}`}
    />
  ) : (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center font-bold text-white shrink-0 ${className}`}
      style={{ backgroundColor: bg }}
    >
      {initial}
    </div>
  );

  const dotSize = DOT_SIZES[size] || DOT_SIZES.md;

  const wrapped = online != null ? (
    <div className="relative inline-flex shrink-0">
      {avatarEl}
      {online && (
        <span className={`absolute bottom-0 right-0 block rounded-full bg-green-500 ring-[var(--bg-surface)] ${dotSize}`} />
      )}
    </div>
  ) : avatarEl;

  if (linkToProfile && username) {
    return (
      <Link href={`/users/${username}`} className="shrink-0">
        {wrapped}
      </Link>
    );
  }

  return wrapped;
}
