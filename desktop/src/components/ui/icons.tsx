import type { SVGProps } from "react";

/**
 * melo's icon set.
 *
 * One grid (24), one stroke (1.7), round caps and joins throughout, and solid
 * shapes only where the icon is a physical object you press — transport
 * controls. Drawn here rather than imported so the player, the tab bar and the
 * lists all weigh the same at every size.
 */

type IconProps = SVGProps<SVGSVGElement> & {
  size?: number;
  /** Solid icons ignore this. */
  strokeWidth?: number;
};

function Svg({ size = 20, strokeWidth = 1.7, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function IconHome({ filled, ...props }: IconProps & { filled?: boolean }) {
  return (
    <Svg {...props}>
      <path
        d="M4.25 10.4 12 3.9l7.75 6.5v8.1a1.5 1.5 0 0 1-1.5 1.5h-3.9v-5.3a1.75 1.75 0 0 0-1.75-1.75h-1.2a1.75 1.75 0 0 0-1.75 1.75V20h-3.9a1.5 1.5 0 0 1-1.5-1.5v-8.1Z"
        fill={filled ? "currentColor" : "none"}
        strokeWidth={filled ? 1.2 : undefined}
      />
    </Svg>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="10.6" cy="10.6" r="6.35" />
      <path d="m15.4 15.4 4.1 4.1" />
    </Svg>
  );
}

export function IconSearchX(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="10.4" cy="10.4" r="6.1" />
      <path d="m15 15 4.2 4.2" />
      <path d="m8.7 8.7 3.4 3.4M12.1 8.7l-3.4 3.4" />
    </Svg>
  );
}

export function IconLibrary(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.1" y="4.1" width="15.8" height="15.8" rx="4.4" />
      <path d="M10.7 15.2V9.4l4-1v5.6" />
      <ellipse cx="9.3" cy="15.4" rx="1.4" ry="1.2" />
      <ellipse cx="13.3" cy="14.3" rx="1.4" ry="1.2" />
    </Svg>
  );
}

/** Sliders, not a gear: the same metaphor the OS uses for settings. */
export function IconSettings(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  );
}

export function IconPlay({ size = 20, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M8.4 5.4a1.1 1.1 0 0 1 1.67-.94l8.2 5.23a1.6 1.6 0 0 1 0 2.7l-8.2 5.23a1.1 1.1 0 0 1-1.67-.94V5.4Z" />
    </svg>
  );
}

export function IconPause({ size = 20, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <rect x="6.6" y="4.6" width="3.9" height="14.8" rx="1.5" />
      <rect x="13.5" y="4.6" width="3.9" height="14.8" rx="1.5" />
    </svg>
  );
}

export function IconPrev({ size = 20, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M18.2 6.1v11.8a1 1 0 0 1-1.53.85l-8.2-5.06a1.55 1.55 0 0 1 0-2.64l8.2-5.06a1 1 0 0 1 1.53.85v.26Z" />
      <rect x="4.4" y="5" width="2.6" height="14" rx="1.3" />
    </svg>
  );
}

export function IconNext({ size = 20, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M5.8 6.1v11.8a1 1 0 0 0 1.53.85l8.2-5.06a1.55 1.55 0 0 0 0-2.64l-8.2-5.06a1 1 0 0 0-1.53.85V6.1Z" />
      <rect x="17" y="5" width="2.6" height="14" rx="1.3" />
    </svg>
  );
}

export function IconShuffle(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h2.6c1.2 0 2.3.6 3 1.6l4.8 7.2c.7 1 1.8 1.6 3 1.6H20" />
      <path d="M4 17.4h2.6c1.2 0 2.3-.6 3-1.6l1.6-2.4" />
      <path d="m12.4 9 1.6-2.4c.7-1 1.8-1.6 3-1.6H20" />
      <path d="m17.8 3.4 2.4 1.6-2.4 1.6" />
      <path d="m17.8 15.6 2.4 1.6-2.4 1.6" />
    </Svg>
  );
}

export function IconRepeat({ one, ...props }: IconProps & { one?: boolean }) {
  return (
    <Svg {...props}>
      <path d="M6.4 7.6h9.8a3 3 0 0 1 3 3v1.2" />
      <path d="m8.6 4.6-2.9 3 2.9 3" />
      <path d="M17.6 16.4H7.8a3 3 0 0 1-3-3v-1.2" />
      <path d="m15.4 19.4 2.9-3-2.9-3" />
      {one && <path d="M11.7 13.6V9.9l-1.3.8" strokeWidth="1.5" />}
    </Svg>
  );
}

/** Up next: the current track sits at the top, the rest queue beneath it. */
export function IconQueue(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 6.5h11" />
      <path d="M4 11.5h11" />
      <path d="M4 16.5h6.5" />
      <path d="M17.6 13.2v6.4" strokeWidth="1.5" />
      <circle cx="15.9" cy="19.6" r="1.7" strokeWidth="1.4" />
    </Svg>
  );
}

/** The lyrics button: a speech bubble with two dots, as on the player. */
export function IconLyrics(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20.2 12.1c0 4.1-3.65 7.4-8.15 7.4-.87 0-1.71-.12-2.5-.35l-4.1 1.5.95-3.35A7.06 7.06 0 0 1 3.9 12.1c0-4.09 3.65-7.4 8.15-7.4s8.15 3.31 8.15 7.4Z" />
      <circle cx="9.1" cy="12.1" r=".95" fill="currentColor" stroke="none" />
      <circle cx="14.9" cy="12.1" r=".95" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconPin({ filled, ...props }: IconProps & { filled?: boolean }) {
  return (
    <Svg {...props} strokeWidth={filled ? 1.2 : undefined}>
      <path
        d="m12 3.9 2.5 5.1 5.6.8-4.05 3.95.96 5.62L12 16.75l-5.01 2.62.96-5.62L3.9 9.8l5.6-.8L12 3.9Z"
        fill={filled ? "currentColor" : "none"}
      />
    </Svg>
  );
}

export function IconMore(props: IconProps) {
  return (
    <Svg {...props} stroke="none" fill="currentColor">
      <circle cx="5.6" cy="12" r="1.55" />
      <circle cx="12" cy="12" r="1.55" />
      <circle cx="18.4" cy="12" r="1.55" />
    </Svg>
  );
}

export function IconVolume(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 9.6h3.1L11.4 6v12L7.1 14.4H4a.9.9 0 0 1-.9-.9v-3a.9.9 0 0 1 .9-.9Z" />
      <path d="M14.9 9.4a3.6 3.6 0 0 1 0 5.2" />
      <path d="M17.6 6.9a7 7 0 0 1 0 10.2" />
    </Svg>
  );
}

export function IconVolumeOff(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 9.6h3.1L11.4 6v12L7.1 14.4H4a.9.9 0 0 1-.9-.9v-3a.9.9 0 0 1 .9-.9Z" />
      <path d="m15 9.8 5 4.4M20 9.8l-5 4.4" />
    </Svg>
  );
}

export function IconChevronLeft(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M14.5 5.8 8.3 12l6.2 6.2" />
    </Svg>
  );
}

export function IconChevronDown(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5.8 9.2 12 15.4l6.2-6.2" />
    </Svg>
  );
}

export function IconArrowRight(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.5 12h15" />
      <path d="m14 6.5 5.5 5.5L14 17.5" />
    </Svg>
  );
}

export function IconDownload(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3.8v10.4" />
      <path d="m7.9 10.4 4.1 4.1 4.1-4.1" />
      <path d="M4.6 16.4v1.7a2 2 0 0 0 2 2h10.8a2 2 0 0 0 2-2v-1.7" />
    </Svg>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5.2v13.6M5.2 12h13.6" />
    </Svg>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m5 12.6 4.4 4.4L19 6.9" />
    </Svg>
  );
}

export function IconClose(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6.3 6.3l11.4 11.4M17.7 6.3 6.3 17.7" />
    </Svg>
  );
}

export function IconGrip(props: IconProps) {
  return (
    <Svg {...props} stroke="none" fill="currentColor">
      <circle cx="9" cy="6.6" r="1.4" />
      <circle cx="15" cy="6.6" r="1.4" />
      <circle cx="9" cy="12" r="1.4" />
      <circle cx="15" cy="12" r="1.4" />
      <circle cx="9" cy="17.4" r="1.4" />
      <circle cx="15" cy="17.4" r="1.4" />
    </Svg>
  );
}

export function IconTrash(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.8 7.2h14.4" />
      <path d="M9.4 4.6h5.2" />
      <path d="M6.6 7.2 7.4 19a1.6 1.6 0 0 0 1.6 1.5h6a1.6 1.6 0 0 0 1.6-1.5l.8-11.8" />
      <path d="M10.4 11v5.6M13.6 11v5.6" strokeWidth="1.4" />
    </Svg>
  );
}

export function IconRefresh(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M19.2 12a7.2 7.2 0 1 1-2.4-5.36" />
      <path d="M19.6 4.4v4.2h-4.2" />
    </Svg>
  );
}

export function IconCloudOff(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8.2 18.4h8.4a3.6 3.6 0 0 0 .62-7.14A5.6 5.6 0 0 0 9.4 7.3" />
      <path d="M6.4 9.9a4 4 0 0 0 .9 7.9" />
      <path d="M4.4 4.4l15.2 15.2" />
    </Svg>
  );
}

export function IconMusic(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9.6 17.4V6.3l9.6-1.9v11" />
      <circle cx="6.9" cy="18.1" r="2.7" />
      <circle cx="16.5" cy="16.1" r="2.7" />
    </Svg>
  );
}

export function IconDisc(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.4" />
      <circle cx="12" cy="12" r="2.1" />
      <path d="M12 3.6v2M12 18.4v2M3.6 12h2M18.4 12h2" strokeWidth="1.3" opacity=".6" />
    </Svg>
  );
}

export function IconUser(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="8.4" r="3.9" />
      <path d="M4.8 20.2a7.4 7.4 0 0 1 14.4 0" />
    </Svg>
  );
}

export function IconInfo(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M12 11.2v5.2" />
      <circle cx="12" cy="7.9" r=".95" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconSpinner({ size = 18, className, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className ? `anim-spin ${className}` : "anim-spin"}
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2.1" opacity=".22" />
      <path
        d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconShare(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3.6v11.2" />
      <path d="m8.2 7.4 3.8-3.8 3.8 3.8" />
      <path d="M5.6 12.6v5.8a1.9 1.9 0 0 0 1.9 1.9h9a1.9 1.9 0 0 0 1.9-1.9v-5.8" />
    </Svg>
  );
}

export function IconBan(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.4" />
      <path d="m6.2 6.2 11.6 11.6" />
    </Svg>
  );
}
