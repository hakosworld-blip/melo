"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const memory = new Map<string, { at: number; data: unknown }>();
const TTL = 1000 * 60 * 5;

export function readCache<T>(path: string): T | undefined {
  const hit = memory.get(path);
  if (!hit) return undefined;
  if (Date.now() - hit.at > TTL) {
    memory.delete(path);
    return undefined;
  }
  return hit.data as T;
}

export function writeCache(path: string, data: unknown) {
  memory.set(path, { at: Date.now(), data });
}

export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  try {
    const res = await fetch(path, { signal, headers: { accept: "application/json" } });
    const json = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
    if (!res.ok) {
      throw new ApiError(json?.error || `Request failed (${res.status})`, res.status);
    }
    if (json === null) throw new ApiError("The server returned an unexpected response");
    writeCache(path, json);
    return json;
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    const cached = readCache<T>(path);
    if (cached) return cached;
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      typeof navigator !== "undefined" && !navigator.onLine
        ? "You're offline. Only downloaded music is available."
        : "Can't reach the music source. Check your connection.",
    );
  }
}

interface ApiState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

/** Cached GET with abort, retry and error surface. */
export function useApi<T>(path: string | null, deps: unknown[] = []): ApiState<T> {
  const [data, setData] = useState<T | null>(() => (path ? readCache<T>(path) ?? null : null));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(path && !readCache(path)));
  const [nonce, setNonce] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!path) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    const cached = readCache<T>(path);
    if (cached) {
      setData(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    // A source that never answers must not leave the page as a skeleton
    // forever; after this the UI gets a retryable error instead.
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 25_000);
    apiGet<T>(path, controller.signal)
      .then((result) => {
        setData(result);
        setLoading(false);
      })
      .catch((err) => {
        if ((err as Error).name === "AbortError") {
          if (timedOut) {
            setError("The music source took too long to answer. Try again, or check it in Settings.");
            setLoading(false);
          }
          return;
        }
        setError(err instanceof Error ? err.message : "Something went wrong");
        setLoading(false);
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, nonce, ...deps]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, error, loading, reload };
}

export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
