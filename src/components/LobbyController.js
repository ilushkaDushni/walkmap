"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "./UserProvider";
import LobbyIcon from "./LobbyIcon";
import LobbyModal from "./LobbyModal";

export default function LobbyController({ inline = false }) {
  const { user, authFetch } = useUser();
  const [lobbyId, setLobbyId] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // Слушаем события создания/присоединения/выхода
  useEffect(() => {
    const onCreated = (e) => {
      setLobbyId(e.detail.id);
      setIsHost(true);
      setParticipantCount(1);
      setIsActive(false);
    };

    const onJoined = (e) => {
      setLobbyId(e.detail.id);
      setIsHost(false);
      setParticipantCount(0);
      setIsActive(false);
    };

    const onLeft = () => {
      setLobbyId(null);
      setIsHost(false);
      setParticipantCount(0);
      setIsActive(false);
      setModalOpen(false);
    };

    // Открыть лобби по клику (например, из уведомления)
    const onOpenLobby = () => {
      setModalOpen(true);
    };

    window.addEventListener("lobby-created", onCreated);
    window.addEventListener("lobby-joined", onJoined);
    window.addEventListener("lobby-left", onLeft);
    window.addEventListener("open-lobby-modal", onOpenLobby);

    return () => {
      window.removeEventListener("lobby-created", onCreated);
      window.removeEventListener("lobby-joined", onJoined);
      window.removeEventListener("lobby-left", onLeft);
      window.removeEventListener("open-lobby-modal", onOpenLobby);
    };
  }, []);

  // Polling для обновления бейджа (если в лобби)
  useEffect(() => {
    if (!lobbyId || !authFetch) return;

    const poll = async () => {
      try {
        const res = await authFetch(`/api/lobbies/${lobbyId}`);
        if (res.ok) {
          const data = await res.json();
          setParticipantCount(data.participants?.length || 0);
          setIsActive(data.status === "active");

          // Если лобби завершено — сбрасываем
          if (data.status === "completed") {
            setLobbyId(null);
            setIsHost(false);
            setParticipantCount(0);
            setIsActive(false);
          }
        }
      } catch {}
    };

    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [lobbyId, authFetch]);

  if (!user) return null;

  return (
    <>
      <LobbyIcon
        lobbyId={lobbyId}
        participantCount={participantCount}
        isActive={isActive}
        onClick={() => setModalOpen(true)}
        inline={inline}
      />

      {/* Модалка лобби (может открываться и без активного лобби — для создания) */}
      <LobbyModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        lobbyId={lobbyId}
        isHost={isHost}
      />
    </>
  );
}
