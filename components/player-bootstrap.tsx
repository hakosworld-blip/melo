"use client";

import { useEffect } from "react";
import { usePlayer } from "@/store/player";
import { toast } from "@/store/toast";

/**
 * Restores the queue/position, registers the offline shell worker and tells the
 * user when the network drops (the library keeps working from local storage).
 */
export default function PlayerBootstrap() {
  useEffect(() => {
    usePlayer.getState().hydrate();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    // The offline shell is a production feature: in development a cached
    // worker would keep serving stale chunks and hide code changes.
    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => registrations.forEach((registration) => void registration.unregister()))
        .catch(() => undefined);
      return;
    }
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* offline shell is progressive enhancement */
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
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
