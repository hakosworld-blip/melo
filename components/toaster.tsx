"use client";

import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useToasts } from "@/store/toast";

export default function Toaster() {
  const items = useToasts((s) => s.items);
  const dismiss = useToasts((s) => s.dismiss);
  if (!items.length) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+140px)] z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-[calc(env(safe-area-inset-bottom)+104px)]"
      role="status"
      aria-live="polite"
    >
      {items.map((item) => (
        <div
          key={item.id}
          className={cn(
            "pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border border-line px-4 py-3 anim-rise",
            "bg-[color-mix(in_srgb,var(--surface)_96%,transparent)] shadow-[var(--shadow-soft)] backdrop-blur-xl",
          )}
        >
          <span className="shrink-0">
            {item.tone === "success" ? (
              <CheckCircle2 size={17} className="text-accent" />
            ) : item.tone === "error" ? (
              <AlertCircle size={17} className="text-[#f08c7e]" />
            ) : (
              <Info size={17} className="text-muted" />
            )}
          </span>
          <p className="min-w-0 flex-1 text-[13px] leading-snug">{item.message}</p>
          {item.action && (
            <button
              onClick={() => {
                item.action?.run();
                dismiss(item.id);
              }}
              className="press shrink-0 rounded-full px-2.5 py-1 text-[12px] font-medium text-accent hover:bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]"
            >
              {item.action.label}
            </button>
          )}
          <button
            onClick={() => dismiss(item.id)}
            aria-label="Dismiss"
            className="press shrink-0 rounded-full p-1 text-muted hover:text-ink"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
