"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconClose } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "surface" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const buttonBase =
  "press focus-ring inline-flex items-center justify-center gap-2 rounded-full font-medium disabled:opacity-45 disabled:pointer-events-none";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accentink hover:brightness-95",
  surface: "glass text-ink hover:border-[color-mix(in_srgb,var(--ink)_24%,transparent)] hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]",
  ghost: "text-ink/80 hover:text-ink hover:bg-[color-mix(in_srgb,var(--ink)_7%,transparent)]",
  danger: "bg-[#c0453a] text-white hover:brightness-110",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3.5 text-[12.5px]",
  md: "h-10 px-5 text-[13.5px]",
  lg: "h-12 px-7 text-[15px]",
};

export function Button({
  variant = "surface",
  size = "md",
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button className={cn(buttonBase, variants[variant], sizes[size], className)} {...props}>
      {children}
    </button>
  );
}

export function IconButton({
  label,
  className,
  active,
  children,
  size = "md",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  active?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const dimensions = size === "lg" ? "h-12 w-12" : size === "sm" ? "h-8 w-8" : "h-10 w-10";
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        "press focus-ring icon-btn",
        dimensions,
        active
          ? "text-accent bg-[color-mix(in_srgb,var(--accent)_14%,transparent)]"
          : "text-ink/75 hover:text-ink hover:bg-[color-mix(in_srgb,var(--ink)_7%,transparent)]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    const timer = setTimeout(() => panelRef.current?.focus(), 60);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
      clearTimeout(timer);
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/60 anim-fade" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cn(
          "relative w-full outline-none anim-sheet",
          "mx-0 sm:mx-6",
          wide ? "sm:max-w-2xl" : "sm:max-w-md",
          "max-h-[88vh] sm:max-h-[82vh] flex flex-col",
          "rounded-t-[20px] sm:rounded-[16px] border border-transparent sm:border-[var(--glass-line)]",
          "glass-strong shadow-[0_-24px_60px_-30px_rgba(0,0,0,0.8)] sm:shadow-[var(--shadow-soft)]",
          "pb-[max(env(safe-area-inset-bottom),14px)] sm:pb-0",
        )}
      >
        <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-ink/25 sm:hidden" aria-hidden="true" />
        <div className="flex items-start justify-between gap-4 px-5 pt-3 sm:px-6 sm:pt-5">
          <div className="min-w-0">
            {title && (
              <h2 id={titleId} className="text-[19px] font-semibold tracking-[-0.02em]">
                {title}
              </h2>
            )}
            {description && <p className="mt-1 text-[12.5px] text-muted">{description}</p>}
          </div>
          <IconButton label="Close" size="sm" onClick={onClose}>
            <IconClose size={16} />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2 pt-2 sm:px-3">{children}</div>
        {footer && <div className="border-t border-white/10 px-5 py-3 sm:px-6">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
  size = "md",
}: {
  value: T;
  options: { value: T; label: string; icon?: ReactNode }[];
  onChange: (value: T) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ x: number; w: number } | null>(null);

  // The selection is one thumb that glides between labels, so switching a tab
  // reads as movement rather than a colour swap. Measured, because the labels
  // change width with their counts.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => {
      const index = options.findIndex((option) => option.value === value);
      const node = list.querySelectorAll<HTMLButtonElement>('[role="tab"]')[index];
      if (node) setThumb({ x: node.offsetLeft, w: node.offsetWidth });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [value, options]);

  return (
    <div
      ref={listRef}
      className={cn(
        "relative inline-flex w-full items-center gap-1 overflow-x-auto rounded-full border border-line bg-[color-mix(in_srgb,var(--ink)_4%,transparent)] p-1 no-scrollbar",
        className,
      )}
      role="tablist"
    >
      <span
        aria-hidden="true"
        className="seg-thumb"
        style={{ transform: `translateX(${thumb?.x ?? 0}px)`, width: thumb?.w ?? 0, opacity: thumb ? 1 : 0 }}
      />
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "press relative z-10 flex shrink-0 grow items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-medium transition-colors",
              size === "sm" ? "h-7 px-3 text-[12px]" : "h-8 px-3.5 text-[12.5px]",
              selected ? "text-bg" : "text-muted hover:text-ink",
            )}
          >
            {option.icon && <span className="hidden shrink-0 items-center sm:flex">{option.icon}</span>}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "press relative h-6 w-11 shrink-0 rounded-full border transition-colors",
        checked ? "border-transparent bg-accent" : "border-line bg-[color-mix(in_srgb,var(--ink)_10%,transparent)]",
      )}
    >
      <span
        className={cn(
          "absolute left-[3px] top-1/2 h-[18px] w-[18px] -translate-y-1/2 rounded-full shadow transition-transform duration-200",
          checked ? "translate-x-[21px] bg-accentink" : "translate-x-0 bg-ink/80",
        )}
      />
    </button>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden="true" />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "py-10" : "py-16", className)}>
      {icon && (
        <div className="glass empty-icon mb-4 flex h-12 w-12 items-center justify-center rounded-full text-muted">{icon}</div>
      )}
      <h3 className="text-[16px] font-semibold tracking-[-0.01em]">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function SectionTitle({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        <h2 className="section-head truncate">{title}</h2>
        {subtitle && <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span
      className="anim-spin inline-block rounded-full border-2 border-[color-mix(in_srgb,var(--ink)_25%,transparent)] border-t-ink"
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    />
  );
}
