"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function SettingsGroup({
  title,
  description,
  children,
  id,
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  id?: string;
  action?: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold leading-tight tracking-[-0.01em]">{title}</h2>
          {description && <p className="mt-1 text-[12px] text-muted">{description}</p>}
        </div>
        {action}
      </div>
      <div className="surface divide-y divide-line overflow-hidden">{children}</div>
    </section>
  );
}

export function SettingRow({
  label,
  description,
  children,
  stacked,
}: {
  label: string;
  description?: string;
  children: ReactNode;
  stacked?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex gap-x-4 gap-y-2.5 px-4 py-3.5 sm:px-5",
        stacked ? "flex-col" : "flex-wrap items-center justify-between",
      )}
    >
      <div className="min-w-0 grow basis-[170px]">
        <p className="text-[13px] font-medium">{label}</p>
        {description && <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">{description}</p>}
      </div>
      <div className={cn("shrink-0", stacked && "w-full")}>{children}</div>
    </div>
  );
}

export function SliderRow({
  label,
  description,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  onChange,
}: {
  label: string;
  description?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="px-4 py-3.5 sm:px-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium">{label}</p>
          {description && <p className="mt-0.5 text-[11.5px] text-muted">{description}</p>}
        </div>
        <span className="rounded-full border border-line px-2.5 py-0.5 text-[11px] tabular-nums text-muted">
          {Math.round(value)}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-3 h-4 w-full cursor-pointer accent-[var(--accent)]"
        style={{
          background: `linear-gradient(to right, var(--accent) ${((value - min) / (max - min)) * 100}%, color-mix(in srgb, var(--ink) 12%, transparent) ${((value - min) / (max - min)) * 100}%)`,
          height: 4,
          borderRadius: 999,
          appearance: "none",
        }}
      />
    </div>
  );
}

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
      <span className="text-[12.5px] text-ink/85">{label}</span>
      <span className="flex items-center gap-2">
        <span className="text-[11px] tabular-nums uppercase text-muted">{value}</span>
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label={label}
          className="h-7 w-9 cursor-pointer rounded-md border border-line bg-transparent p-0.5"
        />
      </span>
    </label>
  );
}
