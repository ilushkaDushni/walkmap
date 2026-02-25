"use client";

import Link from "next/link";

const SIZES = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-16 w-16 text-xl",
  xl: "h-24 w-24 text-3xl",
};

const PX_SIZES = { sm: 32, md: 40, lg: 64, xl: 96 };

const DOT_SIZES = {
  sm: "h-2 w-2 ring-[1.5px]",
  md: "h-2.5 w-2.5 ring-2",
  lg: "h-3.5 w-3.5 ring-2",
  xl: "h-4 w-4 ring-[3px]",
};

const FRAME_BORDER = { sm: 2, md: 2, lg: 3, xl: 4 };

export default function UserAvatar({ username, avatarUrl, roleColor, size = "md", linkToProfile = false, online, equippedItems, className = "" }) {
  const sizeClass = SIZES[size] || SIZES.md;
  const initial = (username || "?")[0].toUpperCase();
  const bg = roleColor || "#6b7280";

  const frame = equippedItems?.frame;
  const border = FRAME_BORDER[size] || 2;
  const px = PX_SIZES[size] || 40;
  const outerPx = px + border * 2;

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

  let framedEl = avatarEl;

  if (frame?.cssData) {
    const css = frame.cssData;
    const gradient = css.gradient || css.borderColor;
    const animation = css.animation;

    if (gradient) {
      if (animation === "spin") {
        // Spinning: gradient layer rotates, avatar stays still
        framedEl = (
          <div className="relative inline-flex shrink-0" style={{ width: outerPx, height: outerPx }}>
            <div
              className="absolute inset-0 rounded-full animate-frame-spin"
              style={{ background: gradient }}
            />
            <div className="absolute rounded-full bg-[var(--bg-surface)]"
              style={{ inset: border, width: px, height: px }}
            />
            <div className="absolute" style={{ top: border, left: border }}>
              {avatarEl}
            </div>
          </div>
        );
      } else {
        const animClass =
          animation === "pulse" ? "animate-frame-pulse" :
          animation === "rainbow" ? "animate-frame-rainbow" : "";

        framedEl = (
          <div
            className={`relative inline-flex shrink-0 rounded-full ${animClass}`}
            style={{
              padding: `${border}px`,
              background: gradient,
            }}
          >
            {avatarEl}
          </div>
        );
      }
    }

    if (frame.imageUrl) {
      framedEl = (
        <div className="relative inline-flex shrink-0">
          {framedEl}
          <img
            src={frame.imageUrl}
            alt=""
            className="absolute inset-[-4px] w-[calc(100%+8px)] h-[calc(100%+8px)] pointer-events-none"
            style={{ objectFit: "contain" }}
          />
        </div>
      );
    }
  }

  const wrapped = online != null ? (
    <div className="relative inline-flex shrink-0">
      {framedEl}
      {online && (
        <span className={`absolute bottom-0 right-0 block rounded-full bg-green-500 ring-[var(--bg-surface)] ${dotSize}`} />
      )}
    </div>
  ) : framedEl;

  if (linkToProfile && username) {
    return (
      <Link href={`/users/${username}`} className="shrink-0">
        {wrapped}
      </Link>
    );
  }

  return wrapped;
}
