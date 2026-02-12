"use client";

import Link from "next/link";

const SIZES = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-16 w-16 text-xl",
  xl: "h-24 w-24 text-3xl",
};

export default function UserAvatar({ username, avatarUrl, roleColor, size = "md", linkToProfile = false, className = "" }) {
  const sizeClass = SIZES[size] || SIZES.md;
  const initial = (username || "?")[0].toUpperCase();
  const bg = roleColor || "#6b7280";

  const avatar = avatarUrl ? (
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

  if (linkToProfile && username) {
    return (
      <Link href={`/users/${username}`} className="shrink-0">
        {avatar}
      </Link>
    );
  }

  return avatar;
}
