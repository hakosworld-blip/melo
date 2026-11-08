import { NextRequest } from "next/server";
import { request as httpRequest, type IncomingHttpHeaders } from "node:http";
import { request as httpsRequest } from "node:https";
import { Readable } from "node:stream";
import { getProvider } from "@/lib/provider";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Audio proxy.
 *
 * A plain Node HTTP client is used instead of fetch: the signed CDN URLs are
 * byte-range servers and Next's patched fetch buffers/hangs on them. This path
 * follows redirects, forwards Range, and streams straight through with a
 * hard header timeout so a dead source can never wedge the player.
 */

interface Upstream {
  status: number;
  headers: IncomingHttpHeaders;
  stream: Readable;
}

function openOnce(url: string, range: string | undefined, signal: AbortSignal): Promise<Upstream> {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const requester = target.protocol === "https:" ? httpsRequest : httpRequest;
    const req = requester(
      target,
      {
        method: "GET",
        headers: {
          ...(range ? { range } : {}),
          "user-agent": "melo/1.0",
          accept: "*/*",
          "accept-encoding": "identity",
        },
        timeout: 20_000,
      },
      (res) => {
        resolve({ status: res.statusCode || 502, headers: res.headers, stream: res });
      },
    );
    req.on("timeout", () => req.destroy(new Error("Upstream timed out")));
    req.on("error", reject);
    if (signal.aborted) req.destroy(new Error("Client aborted"));
    signal.addEventListener("abort", () => req.destroy(new Error("Client aborted")), { once: true });
    req.end();
  });
}

async function openUpstream(url: string, range: string | undefined, signal: AbortSignal): Promise<Upstream> {
  let current = url;
  for (let hop = 0; hop < 4; hop++) {
    const response = await openOnce(current, range, signal);
    const location = response.headers.location;
    if ([301, 302, 303, 307, 308].includes(response.status) && location) {
      response.stream.resume(); // drain the redirect body
      current = new URL(location, current).toString();
      continue;
    }
    return response;
  }
  throw new Error("Too many redirects from the audio source");
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string; id: string }> }) {
  const { provider: providerId, id } = await ctx.params;
  const provider = getProvider(providerId);
  if (provider.id !== providerId) {
    return Response.json({ error: "Unknown music source" }, { status: 404 });
  }

  let upstreamUrl: string;
  try {
    upstreamUrl = await provider.streamUrl(decodeURIComponent(id));
  } catch (err) {
    const message = err instanceof Error ? err.message : "This track cannot be streamed right now";
    const status = (err as { status?: number }).status === 404 ? 404 : 502;
    return Response.json({ error: message }, { status });
  }

  let upstream: Upstream;
  try {
    upstream = await openUpstream(upstreamUrl, req.headers.get("range") || undefined, req.signal);
  } catch (err) {
    const aborted = (err as Error).message === "Client aborted";
    if (aborted) return new Response(null, { status: 499 });
    return Response.json({ error: "The audio source is unreachable" }, { status: 504 });
  }

  if (upstream.status >= 400) {
    upstream.stream.resume();
    return Response.json(
      { error: upstream.status === 403 ? "The source refused this stream" : "Audio is unavailable" },
      { status: upstream.status === 404 ? 404 : 502 },
    );
  }

  const headers = new Headers();
  const contentType = upstream.headers["content-type"];
  headers.set("content-type", typeof contentType === "string" ? contentType : "audio/mpeg");
  const length = upstream.headers["content-length"];
  if (typeof length === "string") headers.set("content-length", length);
  const range = upstream.headers["content-range"];
  if (typeof range === "string") headers.set("content-range", range);
  headers.set("accept-ranges", "bytes");
  headers.set("cache-control", "private, max-age=600");
  headers.set("x-melo-provider", provider.id);

  if (req.method === "HEAD") {
    upstream.stream.resume();
    return new Response(null, { status: upstream.status, headers });
  }

  const body = Readable.toWeb(upstream.stream) as ReadableStream<Uint8Array>;
  return new Response(body, { status: upstream.status, headers });
}

export async function HEAD(req: NextRequest, ctx: { params: Promise<{ provider: string; id: string }> }) {
  return GET(req, ctx);
}
