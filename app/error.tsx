"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/primitives";

/**
 * Segment-level error boundary. One broken view must never take down playback
 * or the rest of melo, and the message must be human-readable.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Local-only: no telemetry leaves the device.
    console.error("melo view error:", error);
  }, [error]);

  return (
    <div className="page-pad flex min-h-[70vh] flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-surface text-[#f08c7e]">
        <AlertTriangle size={22} />
      </div>
      <h1 className="font-display text-[26px]">Something went wrong</h1>
      <p className="mt-2 max-w-md text-[13px] leading-relaxed text-muted">
        This screen hit an error. Your queue, playlists and downloads are safe — playback keeps running.
      </p>
      <p className="mt-3 max-w-lg rounded-xl border border-line bg-surface px-3 py-2 text-left text-[11.5px] break-words text-muted">
        {error.message || "Unknown error"}
        {error.digest ? ` · ${error.digest}` : ""}
      </p>
      <div className="mt-6 flex gap-2">
        <Button variant="primary" onClick={reset}>
          <RefreshCw size={14} /> Try again
        </Button>
        <Link href="/">
          <Button variant="surface">Go home</Button>
        </Link>
      </div>
    </div>
  );
}
