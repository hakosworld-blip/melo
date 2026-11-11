"use client";

import { useRouter } from "@/lib/router";
import {
  IconBan,
  IconDisc,
  IconDownload,
  IconLyrics,
  IconNext,
  IconPin,
  IconPlay,
  IconPlus,
  IconShare,
  IconSpinner,
  IconTrash,
  IconUser,
} from "@/components/ui/icons";
import { Artwork } from "@/components/artwork";
import { PROVIDER_LABEL } from "@/lib/constants";
import { formatTime } from "@/lib/format";
import { useDownloads } from "@/store/downloads";
import { useLibrary } from "@/store/library";
import { usePlayer } from "@/store/player";
import { toast } from "@/store/toast";
import { useUi } from "@/store/ui";
import type { Track } from "@/lib/types";

export default function TrackMenu({ track }: { track: Track }) {
  const router = useRouter();
  const closeSheet = useUi((s) => s.closeSheet);
  const openSheet = useUi((s) => s.openSheet);
  const playTrack = usePlayer((s) => s.playTrack);
  const addNext = usePlayer((s) => s.addNext);
  const addToQueue = usePlayer((s) => s.addToQueue);
  const enqueue = useDownloads((s) => s.enqueue);
  const remove = useDownloads((s) => s.remove);
  const retry = useDownloads((s) => s.retry);
  const cancel = useDownloads((s) => s.cancel);
  const record = useDownloads((s) => s.records[track.id]);
  const forgetTrack = useLibrary((s) => s.forgetTrack);
  const pinned = useLibrary((s) => s.pinned.some((entry) => entry.id === track.id));
  const togglePin = useLibrary((s) => s.togglePin);

  const done = (message: string, tone: "neutral" | "success" | "error" = "neutral") => {
    closeSheet();
    toast(message, tone);
  };

  const share = async () => {
    const url =
      track.permalink ||
      (track.provider === "youtube" ? `https://music.youtube.com/watch?v=${track.providerId}` : undefined);
    const payload = { title: `${track.title} — ${track.artist}`, text: `${track.title} — ${track.artist}${url ? `\n${url}` : ""}`, ...(url ? { url } : {}) };
    try {
      if (navigator.share) {
        await navigator.share(payload);
        closeSheet();
        return;
      }
      if (url) {
        await navigator.clipboard.writeText(url);
        done("Link copied to clipboard", "success");
      } else {
        await navigator.clipboard.writeText(payload.text);
        done("Track details copied", "success");
      }
    } catch {
      /* user dismissed the share sheet */
    }
  };

  const downloadLabel =
    record?.status === "complete"
      ? "Delete download"
      : record?.status === "downloading" || record?.status === "queued"
        ? `Cancel (${Math.round((record.progress || 0) * 100)}%)`
        : record?.status === "failed"
          ? "Retry download"
          : track.downloadable
            ? "Download"
            : "Save offline";

  return (
    <div className="pb-3">
      <div className="flex items-center gap-3 px-3 pb-3">
        <Artwork src={track.artworkSmall || track.artwork} alt={track.title} className="h-14 w-14" rounded="rounded-[6px]" iconSize={18} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium">{track.title}</p>
          <p className="mt-0.5 truncate text-[12px] text-muted">
            {track.artist}
            {track.featuredArtists.length > 0 ? ` · feat. ${track.featuredArtists.join(", ")}` : ""}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.08em] text-muted">
            <span>{PROVIDER_LABEL[track.provider]}</span>
            <span className="opacity-50">·</span>
            <span className="tabular-nums">{formatTime(track.duration)}</span>
            {track.genre && (
              <>
                <span className="opacity-50">·</span>
                <span className="truncate normal-case tracking-normal">{track.genre}</span>
              </>
            )}
          </p>
        </div>
      </div>

      <div className="space-y-0.5 px-1.5">
        <MenuRow icon={<IconPlay size={16} />} label="Play now" onClick={() => { playTrack(track); closeSheet(); }} />
        <MenuRow
          icon={<IconNext size={16} />}
          label="Play next"
          onClick={() => { addNext(track); done("Playing next", "success"); }}
        />
        <MenuRow
          icon={<IconPlus size={16} />}
          label="Add to queue"
          onClick={() => { addToQueue(track); done("Added to queue", "success"); }}
        />
        <MenuRow
          icon={<IconPlus size={16} />}
          label="Add to playlist"
          onClick={() => openSheet({ type: "addToPlaylist", track })}
        />
        <MenuRow
          icon={<IconPin size={16} filled={pinned} />}
          label={pinned ? "Unpin from Home" : "Pin to Home"}
          detail={pinned ? undefined : "Keeps it at the top of Home for one tap"}
          onClick={() => {
            const nowPinned = togglePin(track);
            done(nowPinned ? "Pinned to Home" : "Unpinned from Home", nowPinned ? "success" : "neutral");
          }}
        />

        {track.streamable ? (
          <MenuRow
            icon={
              record?.status === "downloading" || record?.status === "queued" ? (
                <IconSpinner size={16} />
              ) : record?.status === "complete" ? (
                <IconTrash size={16} />
              ) : (
                <IconDownload size={16} />
              )
            }
            label={downloadLabel}
            detail={
              !record && !track.downloadable
                ? "Artist hasn't enabled downloads — melo keeps a private copy for you"
                : record?.status === "failed"
                  ? record.error
                  : record?.status === "complete"
                    ? `${track.downloadable ? "Downloaded" : "Saved offline"} · works without a connection`
                    : undefined
            }
            onClick={() => {
              if (record?.status === "complete") {
                closeSheet();
                openSheet({
                  type: "confirm",
                  title: "Delete download?",
                  message: `“${track.title}” and its saved artwork and lyrics will be removed from this device.`,
                  confirmLabel: "Delete download",
                  destructive: true,
                  onConfirm: async () => {
                    await remove(track.id);
                    toast("Download deleted", "success");
                  },
                });
                return;
              }
              if (record?.status === "downloading" || record?.status === "queued") {
                cancel(track.id);
                done("Download cancelled");
                return;
              }
              if (record?.status === "failed") {
                retry(track.id);
                done("Retrying download", "neutral");
                return;
              }
              enqueue(track);
              done(track.downloadable ? "Downloading for offline listening" : "Saving a private offline copy", "success");
            }}
          />
        ) : (
          <MenuRow
            icon={<IconBan size={16} />}
            label="Unavailable to stream"
            detail="The source reports this track as not streamable (removed or gated)."
            disabled
            onClick={() => undefined}
          />
        )}

        <div className="my-2 h-px bg-line" />

        {track.artistId && (
          <MenuRow
            icon={<IconUser size={16} />}
            label="View artist"
            onClick={() => {
              closeSheet();
              router.push(`/artist/${encodeURIComponent(track.artistId!)}`);
            }}
          />
        )}
        {track.albumId && (
          <MenuRow
            icon={<IconDisc size={16} />}
            label="View album"
            onClick={() => {
              closeSheet();
              router.push(`/album/${encodeURIComponent(track.albumId!)}`);
            }}
          />
        )}
        <MenuRow icon={<IconLyrics size={16} />} label="View lyrics" onClick={() => openSheet({ type: "lyrics", track })} />
        <MenuRow icon={<IconShare size={16} />} label="Share" onClick={share} />

        <div className="my-2 h-px bg-line" />

        <MenuRow
          icon={<IconTrash size={16} />}
          label="Remove from library"
          detail="Clears this track from your history and play counts"
          onClick={() => {
            forgetTrack(track.id);
            done("Removed from your library", "success");
          }}
        />
      </div>
    </div>
  );
}

function MenuRow({
  icon,
  label,
  detail,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  detail?: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="press flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)] disabled:opacity-50"
    >
      <span className="mt-0.5 text-muted">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium">{label}</span>
        {detail && <span className="mt-0.5 block text-[11px] leading-snug text-muted">{detail}</span>}
      </span>
    </button>
  );
}
