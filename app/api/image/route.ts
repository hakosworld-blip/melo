import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Artwork proxy.
 *
 * Keeps third-party CDNs out of the client, lets artwork be cached offline and
 * avoids leaking the user's origin. Audius artwork is served by a rotating set
 * of creator nodes (staked.cloud, theblueprint.xyz, allego.net, …), so we can't
 * pin a host list without covers silently disappearing. Instead we accept
 * HTTPS image URLs from public hosts, and require Audius artwork to use its
 * `/content/<cid>/<size>.jpg` path. Private/loopback targets are refused to
 * keep the proxy from being usable for local network requests.
 */
const KNOWN_HOSTS = [
  "i.ytimg.com",
  "yt3.ggpht.com",
  "yt3.googleusercontent.com",
  "lh3.googleusercontent.com",
];

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * Audius hands out a different creator node for the same content id on every
 * request, and some of those nodes answer 404 for artwork the others serve.
 * When a `/content/<cid>/…` URL fails we retry the identical path on a few
 * known-good gateways instead of showing an empty cover.
 */
const AUDIUS_MIRRORS = [
  "https://v.monophonic.digital",
  "https://audius-01.staked.cloud",
  "https://audius-content-8.figment.io",
  "https://audius-creator-1.theblueprint.xyz",
  "https://cn4.mainnet.audiusindex.org",
  "https://val011.open-audio-validator.com",
];

function isPrivateHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return true;
  }
  if (host === "::1" || host === "::" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) {
    return true;
  }
  // Bare IP literals are refused: artwork never comes from one, and they are
  // the usual route into internal services.
  return IPV4.test(host);
}

function isAllowed(url: URL) {
  if (url.protocol !== "https:") return false;
  if (isPrivateHost(url.hostname)) return false;
  if (KNOWN_HOSTS.includes(url.hostname)) return true;
  // Audius creator-node artwork path. Anything else must be one of our sources.
  return url.pathname.startsWith("/content/") && /\.(jpg|jpeg|png|webp)$/i.test(url.pathname);
}

function mirrorCandidates(url: URL): URL[] {
  if (!/^\/content\/[^/]+\//.test(url.pathname)) return [];
  const host = url.hostname.toLowerCase();
  return AUDIUS_MIRRORS.filter((m) => new URL(m).hostname.toLowerCase() !== host).map(
    (m) => new URL(url.pathname, m),
  );
}

async function fetchImage(url: URL) {
  let upstream: Response;
  try {
    upstream = await fetch(url, {
      headers: { accept: "image/*", "user-agent": "melo/1.0" },
      cache: "no-store",
      signal: AbortSignal.timeout(7000),
    });
  } catch {
    return null;
  }
  const drop = async () => {
    try {
      await upstream.body?.cancel();
    } catch {
      /* already consumed */
    }
  };
  if (!upstream.ok || !upstream.body) {
    await drop();
    return null;
  }
  const type = upstream.headers.get("content-type") || "";
  if (type && !type.startsWith("image/")) {
    await drop();
    return null;
  }
  const length = Number(upstream.headers.get("content-length") || 0);
  if (length > 8 * 1024 * 1024) {
    await drop();
    return null;
  }
  return { body: upstream.body, type, length };
}

export async function GET(req: NextRequest) {
  const src = req.nextUrl.searchParams.get("src");
  if (!src) return new Response("Missing src", { status: 400 });
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return new Response("Invalid src", { status: 400 });
  }
  if (!isAllowed(url)) return new Response("Host not allowed", { status: 403 });

  let image = await fetchImage(url);
  for (const candidate of mirrorCandidates(url)) {
    if (image) break;
    image = await fetchImage(candidate);
  }
  if (!image) return new Response("Artwork unavailable", { status: 404 });

  return new Response(image.body, {
    headers: {
      "content-type": image.type || "image/jpeg",
      "cache-control": "public, max-age=31536000, immutable",
      ...(image.length ? { "content-length": String(image.length) } : {}),
    },
  });
}
