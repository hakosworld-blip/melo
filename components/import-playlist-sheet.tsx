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
  streamOnly: number;
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

  function save(name: string, tracks: Track[], missing: string[], duplicates: number, capped: boolean) {
    if (!tracks.length) {
      setOutcome({ playlistId: "", name, imported: 0, duplicates, missing, streamOnly: 0, capped });
      return;
    }
    const library = useLibrary.getState();
    const existing = library.playlists.find(
      (candidate) => candidate.name.trim().toLowerCase() === name.trim().toLowerCase(),
    );
    let playlistId: string;
    if (existing) {
      library.addTracks(existing.id, tracks);
      playlistId = existing.id;
    } else {
      playlistId = library.createPlaylist(name, tracks);
    }
    const streamOnly = tracks.filter((track) => track.provider === "youtube").length;
    setOutcome({ playlistId, name, imported: tracks.length, duplicates, missing, streamOnly, capped });
    toast(`Imported ${tracks.length} ${tracks.length === 1 ? "song" : "songs"} into “${name}”`, "success");
  }

  async function importYoutube(link: string) {
    setPhase("reading");
    setProgress({ done: 0, total: 0 });
    const res = await fetch("/api/import/youtube", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: link }),
    });
    const payload = (await res.json()) as {
      playlist?: { name: string; tracks: Track[]; capped: boolean };
      error?: string;
    };
    if (!res.ok || !payload.playlist) throw new Error(payload.error || "Could not read that playlist.");
    if (cancelled.current) return;

    const playlist = payload.playlist;
    setProgress({ done: playlist.tracks.length, total: playlist.tracks.length });
    setPhase("saving");
    save(playlist.name, playlist.tracks, [], 0, playlist.capped);
  }

  async function importSpotify(link: string) {
    setPhase("reading");
    setProgress({ done: 0, total: 0 });
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

    setPhase("saving");
    save(playlist.name, unique, missing, matched.length - unique.length, playlist.capped);
  }

  async function run() {
    const link = url.trim();
    if (!link || busy) return;
    const isYoutube = /youtu\.?be|youtube\.com/i.test(link);
    const isSpotify = /spotify/i.test(link);
    if (!isYoutube && !isSpotify) {
      setError("Paste a Spotify or YouTube Music playlist link.");
      setOutcome(null);
      return;
    }

    cancelled.current = false;
    setError(null);
    setOutcome(null);
    try {
      if (isYoutube) await importYoutube(link);
      else await importSpotify(link);
      if (cancelled.current) return;
      setPhase("idle");
    } catch (err) {
      if (cancelled.current) return;
      setError(err instanceof Error ? err.message : "Import failed.");
      setPhase("idle");
    }
  }

  return (
    <div className="px-3 pb-4">
      <label className="block px-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
        Playlist link
      </label>
      <div className="mt-2 flex items-center gap-2 rounded-xl border border-line bg-surface px-3 focus-within:border-[color-mix(in_srgb,var(--accent)_55%,var(--line))]">
        <Link2 size={15} className="shrink-0 text-muted" />
        <input
          autoFocus
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && void run()}
          placeholder="Spotify or YouTube Music link"
          inputMode="url"
          autoCapitalize="none"
          spellCheck={false}
          disabled={busy}
          className="h-11 w-full min-w-0 bg-transparent text-[14px] outline-none disabled:opacity-60"
        />
      </div>
      <p className="mt-2.5 px-1 text-[11.5px] leading-relaxed text-muted">
        Paste a public playlist from Spotify or YouTube Music and melo saves it here with the same name — no
        account, nothing posted to either service. Spotify songs are matched to the catalogue; YouTube Music
        playlists keep their exact songs, which stream and can&rsquo;t be downloaded.
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
              (progress.total ? `Matching songs… ${progress.done}/${progress.total}` : "Matching songs…")}
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
              {outcome.missing.length > 0 && ` ${outcome.missing.length} not found.`}
            </p>
          ) : (
            <p>
              <span className="font-medium text-ink">Nothing imported.</span> None of the songs in “{outcome.name}”
              could be found in a source melo can play.
            </p>
          )}
          {outcome.streamOnly > 0 && (
            <p className="mt-2 text-[11.5px] text-muted">
              {outcome.streamOnly === outcome.imported
                ? "These stream through YouTube Music and can't be downloaded."
                : `${outcome.streamOnly} of them stream through YouTube Music and can't be downloaded.`}
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
              This playlist is longer than melo imports in one go, so the later songs were left out.
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
