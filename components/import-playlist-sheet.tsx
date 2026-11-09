"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Link2, ListPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { useLibrary } from "@/store/library";
import { toast } from "@/store/toast";
import { useUi } from "@/store/ui";
import type { Track } from "@/lib/types";
import type { SpotifyPlaylistRef } from "@/lib/spotify";

type Phase = "idle" | "reading" | "matching" | "saving";

interface Outcome {
  playlistId: string;
  name: string;
  imported: number;
  duplicates: number;
  missing: string[];
  capped: boolean;
}

const BATCH = 10;

export function ImportPlaylistSheet() {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const cancelled = useRef(false);
  const closeSheet = useUi((s) => s.closeSheet);
  const router = useRouter();

  const busy = phase !== "idle";

  async function run() {
    const link = url.trim();
    if (!link || busy) return;
    cancelled.current = false;
    setError(null);
    setOutcome(null);
    setPhase("reading");
    setProgress({ done: 0, total: 0 });

    try {
      const res = await fetch("/api/import/spotify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: link }),
      });
      const payload = (await res.json()) as { playlist?: SpotifyPlaylistRef; error?: string };
      if (!res.ok || !payload.playlist) {
        throw new Error(payload.error || "Could not read that playlist.");
      }
      if (cancelled.current) return;

      const playlist = payload.playlist;
      const total = playlist.tracks.length;
      setProgress({ done: 0, total });
      setPhase("matching");

      const matched: Track[] = [];
      const missing: string[] = [];

      for (let index = 0; index < total; index += BATCH) {
        const batch = playlist.tracks.slice(index, index + BATCH);
        const matchRes = await fetch("/api/import/match", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            tracks: batch.map((track) => ({
              title: track.title,
              artist: track.artistLine,
              duration: track.duration,
            })),
          }),
        });
        if (!matchRes.ok) throw new Error("Matching songs failed. Try again.");
        const matchPayload = (await matchRes.json()) as { results?: { matched: Track | null }[] };
        const results = matchPayload.results ?? [];
        batch.forEach((track, position) => {
          const found = results[position]?.matched ?? null;
          if (found) matched.push(found);
          else missing.push(`${track.title} — ${track.artistLine || "unknown artist"}`);
        });
        if (cancelled.current) return;
        setProgress({ done: Math.min(index + BATCH, total), total });
      }

      const seen = new Set<string>();
      const unique: Track[] = [];
      for (const track of matched) {
        if (seen.has(track.id)) continue;
        seen.add(track.id);
        unique.push(track);
      }
      const duplicates = matched.length - unique.length;

      if (!unique.length) {
        setOutcome({
          playlistId: "",
          name: playlist.name,
          imported: 0,
          duplicates,
          missing,
          capped: playlist.capped,
        });
        setPhase("idle");
        return;
      }

      setPhase("saving");
      const library = useLibrary.getState();
      const existing = library.playlists.find(
        (candidate) => candidate.name.trim().toLowerCase() === playlist.name.trim().toLowerCase(),
      );
      let playlistId: string;
      if (existing) {
        library.addTracks(existing.id, unique);
        playlistId = existing.id;
      } else {
        playlistId = library.createPlaylist(playlist.name, unique);
      }

      setOutcome({
        playlistId,
        name: playlist.name,
        imported: unique.length,
        duplicates,
        missing,
        capped: playlist.capped,
      });
      setPhase("idle");
      toast(`Imported ${unique.length} ${unique.length === 1 ? "song" : "songs"} into “${playlist.name}”`, "success");
    } catch (err) {
      if (cancelled.current) return;
      setError(err instanceof Error ? err.message : "Import failed.");
      setPhase("idle");
    }
  }

  return (
    <div className="px-3 pb-4">
      <label className="block px-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
        Spotify playlist link
      </label>
      <div className="mt-2 flex items-center gap-2 rounded-xl border border-line bg-surface px-3 focus-within:border-[color-mix(in_srgb,var(--accent)_55%,var(--line))]">
        <Link2 size={15} className="shrink-0 text-muted" />
        <input
          autoFocus
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && void run()}
          placeholder="https://open.spotify.com/playlist/…"
          inputMode="url"
          autoCapitalize="none"
          spellCheck={false}
          disabled={busy}
          className="h-11 w-full min-w-0 bg-transparent text-[14px] outline-none disabled:opacity-60"
        />
      </div>
      <p className="mt-2.5 px-1 text-[11.5px] leading-relaxed text-muted">
        Share → Copy link to playlist. melo reads the public playlist, matches each song to the catalogue
        and keeps the playlist name. Nothing is posted to Spotify and no account is needed.
      </p>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-[color-mix(in_srgb,#b4433a_45%,var(--line))] bg-[color-mix(in_srgb,#b4433a_10%,var(--surface))] px-3 py-2.5 text-[12.5px] text-ink">
          <AlertCircle size={15} className="mt-0.5 shrink-0 text-[#d4645a]" />
          <span>{error}</span>
        </div>
      )}

      {busy && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-surface2 px-3 py-2.5 text-[12.5px] text-muted">
          <Loader2 size={15} className="animate-spin" />
          <span>
            {phase === "reading" && "Reading the playlist…"}
            {phase === "matching" &&
              (progress.total
                ? `Matching songs… ${progress.done}/${progress.total}`
                : "Matching songs…")}
            {phase === "saving" && "Saving your playlist…"}
          </span>
        </div>
      )}

      {outcome && (
        <div className="mt-3 rounded-xl border border-line bg-surface2 px-3 py-3 text-[12.5px] leading-relaxed">
          {outcome.imported > 0 ? (
            <p>
              <span className="font-medium text-ink">
                {outcome.imported} {outcome.imported === 1 ? "song" : "songs"}
              </span>{" "}
              imported into <span className="font-medium text-ink">“{outcome.name}”</span>.
              {outcome.duplicates > 0 && ` ${outcome.duplicates} already there.`}
              {outcome.missing.length > 0 && ` ${outcome.missing.length} not found in the catalogue.`}
            </p>
          ) : (
            <p>
              <span className="font-medium text-ink">Nothing imported.</span> None of the songs in “{outcome.name}”
              could be found in the catalogue yet.
            </p>
          )}
          {outcome.missing.length > 0 && (
            <p className="mt-2 text-[11.5px] text-muted">
              Skipped: {outcome.missing.slice(0, 4).join(" · ")}
              {outcome.missing.length > 4 ? ` · +${outcome.missing.length - 4} more` : ""}
            </p>
          )}
          {outcome.capped && (
            <p className="mt-2 text-[11.5px] text-muted">
              Spotify only exposes the first 100 songs of a public playlist, so longer playlists import
              their first 100.
            </p>
          )}
          {outcome.playlistId && (
            <button
              onClick={() => {
                closeSheet();
                router.push(`/playlist/${outcome.playlistId}`);
              }}
              className="press mt-2.5 inline-flex items-center gap-1.5 text-[12px] font-medium text-accent hover:brightness-110"
            >
              Open playlist
            </button>
          )}
        </div>
      )}

      <Button variant="primary" className="mt-4 w-full" onClick={() => void run()} disabled={busy || !url.trim()}>
        <ListPlus size={15} /> {busy ? "Importing…" : "Import playlist"}
      </Button>
    </div>
  );
}
