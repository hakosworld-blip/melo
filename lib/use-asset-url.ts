"use client";

import { useEffect, useState } from "react";
import { getAssetUrl } from "@/lib/storage";

/** Resolves an IndexedDB asset key (playlist cover, custom background) to a URL. */
export function useAssetUrl(key: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!key) {
      setUrl(null);
      return;
    }
    getAssetUrl(key).then((value) => {
      if (!cancelled) setUrl(value);
    });
    return () => {
      cancelled = true;
    };
  }, [key]);
  return url;
}
