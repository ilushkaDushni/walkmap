"use client";

import Link from "next/link";

export default function UserName({ username, equippedItems, showTitle = true, linkToProfile = false, className = "", size = "md" }) {
  const nameColor = equippedItems?.usernameColor?.cssData?.color || undefined;
  const title = equippedItems?.title?.cssData;

  const nameSize = size === "sm" ? "text-xs" : "text-sm";
  const titleSize = size === "sm" ? "text-[9px]" : "text-[10px]";

  const nameEl = (
    <span
      className={`font-semibold ${nameSize} ${className}`}
      style={{ color: nameColor || "var(--text-primary)" }}
    >
      {username}
    </span>
  );

  const titleEl = showTitle && title?.text ? (
    <span
      className={`${titleSize} font-medium leading-tight block`}
      style={{ color: title.color || "var(--text-muted)" }}
    >
      {title.text}
    </span>
  ) : null;

  if (linkToProfile && username) {
    return (
      <Link href={`/users/${username}`} className="hover:underline min-w-0">
        {nameEl}
        {titleEl}
      </Link>
    );
  }

  return (
    <div className="min-w-0">
      {nameEl}
      {titleEl}
    </div>
  );
}
