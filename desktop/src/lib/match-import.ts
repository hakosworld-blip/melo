/**
 * Matching an imported song to a playable catalogue track.
 *
 * Spotify gives a title, an artist line and a duration. The catalogue gives
 * back search results. This scores the candidates so the pick is explainable
 * rather than "whatever came first", and returns null instead of guessing when
 * nothing is close enough.
 */

import { normalise } from "./http";
import type { Track } from "./types";

const NOISE = new Set([
  "feat",
  "ft",
  "featuring",
  "with",
  "the",
  "a",
  "and",
  "remaster",
  "remastered",
  "version",
  "edit",
  "radio",
  "mix",
  "extended",
  "original",
  "single",
  "album",
  "explicit",
  "clean",
  "deluxe",
]);

function tokenSet(value: string) {
  return new Set(
    normalise(value)
      .split(" ")
      .filter((token) => token && !NOISE.has(token)),
  );
}

function overlap(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  return shared / Math.min(a.size, b.size);
}

function titleScore(wanted: string, candidate: string) {
  const a = normalise(wanted);
  const b = normalise(candidate);
  if (!a || !b) return 0;
  if (a === b) return 55;
  if (b.startsWith(a) || a.startsWith(b)) return 42;
  if (b.includes(a) || a.includes(b)) return 34;
  return overlap(tokenSet(wanted), tokenSet(candidate)) * 38;
}

function artistScore(wanted: string, candidate: string) {
  const a = normalise(wanted);
  const b = normalise(candidate);
  if (!a || !b) return 0;
  if (a === b) return 32;
  if (b.includes(a) || a.includes(b)) return 24;
  return overlap(tokenSet(wanted), tokenSet(candidate)) * 22;
}

function durationScore(wanted: number, candidate: number) {
  if (!wanted || !candidate) return 0;
  const diff = Math.abs(wanted - candidate);
  if (diff <= 2) return 13;
  if (diff <= 5) return 10;
  if (diff <= 12) return 6;
  if (diff <= 30) return 2;
  if (diff > 75) return -14;
  return 0;
}

export interface MatchQuery {
  title: string;
  artist: string;
  duration?: number;
}

/** 0-100. Anything under 55 is treated as "no confident match". */
export function scoreCandidate(query: MatchQuery, candidate: Track) {
  const title = titleScore(query.title, candidate.title);
  const artist = artistScore(query.artist, candidate.artist);
  const duration = durationScore(query.duration ?? 0, candidate.duration);
  const score = title + artist + duration;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export const MATCH_THRESHOLD = 55;

export function pickBestMatch(query: MatchQuery, candidates: Track[]): Track | null {
  let best: Track | null = null;
  let bestScore = 0;
  for (const candidate of candidates) {
    if (!candidate.streamable) continue;
    const score = scoreCandidate(query, candidate);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return bestScore >= MATCH_THRESHOLD ? best : null;
}

/**
 * YouTube search returns every upload that mentions a song, so this is stricter
 * than the catalogue matcher: the title must match exactly (or start with the
 * wanted title) and the duration must agree when both sides report one. It is
 * better to skip a song than to import the wrong video.
 */
export function pickYoutubeMatch(query: MatchQuery, candidates: Track[]): Track | null {
  const wanted = normalise(query.title);
  if (!wanted) return null;
  let best: Track | null = null;
  let bestScore = 0;
  for (const candidate of candidates) {
    if (!candidate.streamable) continue;
    const title = normalise(candidate.title);
    const exact = title === wanted;
    const prefix = title.startsWith(`${wanted} `);
    if (!exact && !prefix) continue;
    if (query.duration && candidate.duration && Math.abs(query.duration - candidate.duration) > 20) continue;
    const score = scoreCandidate(query, candidate) + (exact ? 15 : 0);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return bestScore >= 60 ? best : null;
}
