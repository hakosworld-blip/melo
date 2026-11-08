/** Timeouts + one retry for flaky public APIs. No silent failures. */

export class UpstreamError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "UpstreamError";
    this.status = status;
  }
}

export async function fetchJson<T>(
  url: string,
  { timeout = 9000, retries = 1, headers }: { timeout?: number; retries?: number; headers?: Record<string, string> } = {},
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { accept: "application/json", ...headers },
        cache: "no-store",
      });
      if (!res.ok) {
        // 4xx from a provider is authoritative; don't retry.
        if (res.status < 500) throw new UpstreamError(`Upstream responded ${res.status}`, res.status);
        throw new UpstreamError(`Upstream responded ${res.status}`, res.status);
      }
      return (await res.json()) as T;
    } catch (err) {
      lastError = err;
      if (attempt === retries) break;
      await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  if (lastError instanceof UpstreamError) throw lastError;
  const aborted = lastError instanceof Error && lastError.name === "AbortError";
  throw new UpstreamError(aborted ? "The music source timed out" : "The music source is unreachable");
}

export function normalise(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\((?:feat|ft|with)\.?[^)]*\)/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
