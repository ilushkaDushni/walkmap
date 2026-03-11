"use client";

import { useState, useRef, useEffect } from "react";

const STICKER_PACKS = [
  {
    id: "emotions",
    name: "Эмоции",
    icon: "😊",
    stickers: [
      "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂",
      "🙂", "😉", "😊", "😇", "🥰", "😍", "🤩", "😘",
      "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭",
      "🤫", "🤔", "🤐", "🤨", "😐", "😑", "😶", "😏",
      "😒", "🙄", "😬", "😮‍💨", "🤥", "😌", "😔", "😪",
      "🤤", "😴", "😷", "🤒", "🤕", "🤢", "🤮", "🥴",
    ],
  },
  {
    id: "gestures",
    name: "Жесты",
    icon: "👋",
    stickers: [
      "👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤌", "🤏",
      "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆",
      "🖕", "👇", "☝️", "👍", "👎", "✊", "👊", "🤛",
      "🤜", "👏", "🙌", "🫶", "👐", "🤲", "🤝", "🙏",
      "💪", "🫡", "🫰", "🫳", "🫴", "🫲", "🫱", "🫵",
    ],
  },
  {
    id: "animals",
    name: "Природа",
    icon: "🌿",
    stickers: [
      "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼",
      "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🐔",
      "🐧", "🐦", "🐤", "🦆", "🦅", "🦉", "🦇", "🐺",
      "🌲", "🌳", "🌴", "🌵", "🌿", "☘️", "🍀", "🍃",
      "🌺", "🌻", "🌹", "🌷", "💐", "🍄", "🌈", "☀️",
      "🌙", "⭐", "🌟", "✨", "⚡", "🔥", "🌊", "❄️",
    ],
  },
];

export default function StickerPicker({ onSelect, onClose }) {
  const [activePack, setActivePack] = useState("emotions");
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const pack = STICKER_PACKS.find((p) => p.id === activePack) || STICKER_PACKS[0];

  return (
    <div ref={ref} className="absolute bottom-full left-0 mb-2 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-color)] shadow-[var(--shadow-lg)] z-10 w-[300px] overflow-hidden">
      {/* Pack tabs */}
      <div className="flex border-b border-[var(--border-color)]">
        {STICKER_PACKS.map((p) => (
          <button
            key={p.id}
            onClick={() => setActivePack(p.id)}
            className={`flex-1 py-2 text-lg text-center transition ${
              activePack === p.id ? "bg-[var(--bg-surface)]" : "hover:bg-[var(--bg-surface)]/50"
            }`}
          >
            {p.icon}
          </button>
        ))}
      </div>

      {/* Stickers grid */}
      <div className="p-2 max-h-48 overflow-y-auto">
        <div className="grid grid-cols-8 gap-0.5">
          {pack.stickers.map((s, i) => (
            <button
              key={i}
              onClick={() => { onSelect(s); onClose(); }}
              className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-[var(--bg-surface)] transition text-xl hover:scale-125"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
