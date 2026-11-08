"use client";

import { useEffect, useState } from "react";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<(available: boolean) => void>();

function publish() {
  listeners.forEach((listener) => listener(Boolean(deferred)));
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    publish();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    publish();
  });
}

/**
 * True only when the platform is actually offering an install (Android Chrome,
 * desktop Chromium). iOS has no prompt API, so nothing is shown rather than a
 * fake button.
 */
export function useInstallPrompt() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    listeners.add(setAvailable);
    setAvailable(Boolean(deferred));
    return () => {
      listeners.delete(setAvailable);
    };
  }, []);

  const install = async () => {
    if (!deferred) return false;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") {
      deferred = null;
      publish();
      return true;
    }
    return false;
  };

  return { available, install };
}
