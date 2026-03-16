"use client";

import { useState } from "react";
import { Swords } from "lucide-react";
import { useUser } from "./UserProvider";
import ChallengeModal from "./ChallengeModal";

export default function ChallengeButton({ routeId, routeTitle }) {
  const { user } = useUser();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-2xl border border-orange-500/30 bg-orange-500/5 px-4 py-2.5 text-sm font-semibold text-orange-500 hover:bg-orange-500/10 transition w-full justify-center"
      >
        <Swords className="h-4 w-4" />
        Вызвать друга
      </button>
      <ChallengeModal
        isOpen={open}
        onClose={() => setOpen(false)}
        routeId={routeId}
        routeTitle={routeTitle}
      />
    </>
  );
}
