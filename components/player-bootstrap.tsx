"use client";

import { useEffect } from "react";
import { usePlayer } from "@/store/player";
import { toast } from "@/store/toast";

/**
 * Restores the queue/position and tells the user when the network drops
 * (the library keeps working from local storage).
 */
export default function PlayerBootstrap() {
  useEffect(() => {
    usePlayer.getState().hydrate();
  }, []);

  useEffect(() => {
    const offline = () => toast("You're offline. Downloaded music and lyrics still work.", "neutral");
    const online = () => toast("Back online", "success");
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    return () => {
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
    };
  }, []);

  return null;
}
