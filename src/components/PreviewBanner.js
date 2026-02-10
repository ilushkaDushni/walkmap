"use client";

import { useUser } from "@/components/UserProvider";
import { Eye, X } from "lucide-react";

export default function PreviewBanner() {
  const { isPreviewMode, previewRole, stopPreview } = useUser();

  if (!isPreviewMode || !previewRole) return null;

  return (
    <div
      className="sticky top-0 z-[60] flex items-center justify-center gap-3 px-4 py-2 text-sm font-medium text-white"
      style={{ backgroundColor: previewRole.color || "#6b7280" }}
    >
      <Eye className="h-4 w-4 shrink-0" />
      <span>
        Просмотр от имени роли: <strong>{previewRole.name}</strong>
      </span>
      <button
        onClick={stopPreview}
        className="ml-2 flex items-center gap-1 rounded-lg bg-white/20 px-2.5 py-1 text-xs font-semibold transition hover:bg-white/30"
      >
        <X className="h-3.5 w-3.5" />
        Выйти
      </button>
    </div>
  );
}
