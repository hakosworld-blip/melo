"use client";

import Link from "@/lib/router";
import { useEffect, useRef, useState } from "react";
import {
  CloudOff,
  ImagePlus,
  Info,
  Loader2,
  Music2,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import AppBar from "@/components/app-bar";
import SectionBackground from "@/components/section-background";
import StoragePanel from "@/components/storage-panel";
import { ColorField, SettingRow, SettingsGroup, SliderRow } from "@/components/settings-controls";
import { Button, Segmented, Switch } from "@/components/ui/primitives";
import { apiGet } from "@/lib/api-client";
import { ACCENTS, useSettings, type BackgroundType, type SectionKey } from "@/store/settings";
import { KEYS, idbDel, idbSet } from "@/lib/storage";
import { cn } from "@/lib/cn";
import { toast } from "@/store/toast";

type ProviderCheck = { provider: string; label: string; available: boolean; reason?: string };

export default function SettingsPage() {
  // The installed app reports its own version; nothing here is hardcoded.
  const [appVersion, setAppVersion] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiGet<{ version?: string }>("/api/app")
      .then((info) => {
        if (!cancelled && info?.version) setAppVersion(info.version);
      })
      .catch(() => {
        /* Settings still works without it. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const settings = useSettings();
  const [checks, setChecks] = useState<ProviderCheck[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [bgSection, setBgSection] = useState<SectionKey>("app");
  const bg = settings.backgrounds[bgSection];
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!window.location.hash) return;
    const target = document.querySelector(window.location.hash);
    if (target) setTimeout(() => target.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
  }, []);

  const checkSources = async () => {
    setChecking(true);
    try {
      const payload = await apiGet<{ providers: ProviderCheck[] }>("/api/providers?check=1");
      setChecks(payload.providers);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't check sources", "error");
    } finally {
      setChecking(false);
    }
  };

  const uploadBackground = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast("Choose an image file", "error");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast("Backgrounds must be under 10 MB", "error");
      return;
    }
    const key = `${bgSection}-${Date.now()}`;
    const ok = await idbSet(KEYS.background(key), file);
    if (!ok) {
      toast("Couldn't save that image", "error");
      return;
    }
    if (bg.imageKey) await idbDel(KEYS.background(bg.imageKey));
    settings.setBackground(bgSection, { imageKey: key, type: "image" });
    toast("Background updated", "success");
  };

  return (
    <div className="relative min-h-full">
      <SectionBackground section="app" />
      <div className="relative z-10 page-pad pb-14">
        <AppBar title="Settings" subtitle="Stored on this device" />

        <div className="mx-auto mt-6 max-w-3xl space-y-10">
          <SettingsGroup title="Appearance" description="Theme, colour and density">
            <SettingRow label="Theme" description="melo is dark by default">
              <Segmented
                value={settings.theme}
                onChange={(theme) => settings.update({ theme })}
                size="sm"
                options={[
                  { value: "dark", label: "Dark" },
                  { value: "light", label: "Light" },
                  { value: "system", label: "System" },
                ]}
              />
            </SettingRow>
            <SettingRow label="Accent colour" description="Buttons, highlights and lyrics">
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                {ACCENTS.map((accent) => (
                  <button
                    key={accent.value}
                    aria-label={accent.name}
                    title={accent.name}
                    onClick={() => settings.update({ accent: accent.value })}
                    className={cn(
                      "press h-7 w-7 rounded-full border transition-transform",
                      settings.accent.toLowerCase() === accent.value.toLowerCase()
                        ? "border-ink scale-110"
                        : "border-transparent",
                    )}
                    style={{ background: accent.value === "ink" ? "var(--ink)" : accent.value }}
                  />
                ))}
                <label className="ml-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-dashed border-line text-[11px] text-muted">
                  <input
                    type="color"
                    value={settings.accent === "ink" ? "#141312" : settings.accent}
                    onChange={(event) => settings.update({ accent: event.target.value })}
                    className="h-0 w-0 opacity-0"
                    aria-label="Custom accent colour"
                  />
                  <Sparkles size={12} />
                </label>
              </div>
            </SettingRow>
            <SettingRow label="Density" description="How much breathing room lists get">
              <Segmented
                value={settings.density}
                onChange={(density) => settings.update({ density })}
                size="sm"
                options={[
                  { value: "compact", label: "Compact" },
                  { value: "comfortable", label: "Comfort" },
                  { value: "spacious", label: "Spacious" },
                ]}
              />
            </SettingRow>
            <SliderRow
              label="Corner radius"
              description="Rounded surfaces across the app"
              min={0}
              max={30}
              value={settings.radius}
              suffix="px"
              onChange={(radius) => settings.update({ radius })}
            />
            <SettingRow label="Typography" description="Interface typeface">
              <Segmented
                value={settings.font}
                onChange={(font) => settings.update({ font })}
                size="sm"
                options={[
                  { value: "sans", label: "Geist" },
                  { value: "serif", label: "Serif" },
                  { value: "mono", label: "Mono" },
                ]}
              />
            </SettingRow>
            <SettingRow label="Animations" description="Smooth transitions across the app">
              <Segmented
                value={settings.animations}
                onChange={(animations) => settings.update({ animations })}
                size="sm"
                options={[
                  { value: "full", label: "Full" },
                  { value: "reduced", label: "Reduced" },
                ]}
              />
            </SettingRow>
          </SettingsGroup>

          <SettingsGroup
            title="Backgrounds"
            description="Per-section colour, gradient, uploaded image or the current artwork"
          >
            <SettingRow label="Section" stacked>
              <Segmented
                value={bgSection}
                onChange={setBgSection}
                size="sm"
                options={[
                  { value: "app", label: "App" },
                  { value: "home", label: "Home" },
                  { value: "library", label: "Library" },
                  { value: "nowPlaying", label: "Player" },
                ]}
              />
            </SettingRow>
            <SettingRow label="Background type" stacked>
              <Segmented
                value={bg.type}
                onChange={(type: BackgroundType) => settings.setBackground(bgSection, { type })}
                size="sm"
                options={[
                  { value: "color", label: "Solid" },
                  { value: "gradient", label: "Gradient" },
                  { value: "image", label: "Image" },
                  { value: "artwork", label: "Artwork" },
                ]}
              />
            </SettingRow>

            {bg.type === "color" && <ColorField label="Colour" value={bg.color} onChange={(color) => settings.setBackground(bgSection, { color })} />}
            {bg.type === "gradient" && (
              <>
                <ColorField label="Gradient start" value={bg.gradientFrom} onChange={(gradientFrom) => settings.setBackground(bgSection, { gradientFrom })} />
                <ColorField label="Gradient end" value={bg.gradientTo} onChange={(gradientTo) => settings.setBackground(bgSection, { gradientTo })} />
                <SliderRow label="Angle" min={0} max={360} value={bg.gradientAngle} suffix="°" onChange={(gradientAngle) => settings.setBackground(bgSection, { gradientAngle })} />
              </>
            )}
            {bg.type === "image" && (
              <SettingRow label="Your image" description={bg.imageKey ? "Custom image applied" : "PNG, JPEG or WebP up to 10 MB"}>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="surface" onClick={() => fileRef.current?.click()}>
                    <ImagePlus size={14} /> Upload
                  </Button>
                  {bg.imageKey && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await idbDel(KEYS.background(bg.imageKey as string));
                        settings.setBackground(bgSection, { imageKey: undefined, type: "color" });
                        toast("Background image removed", "success");
                      }}
                    >
                      <Trash2 size={14} />
                    </Button>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadBackground(file);
                    event.target.value = "";
                  }}
                />
              </SettingRow>
            )}
            {bg.type === "artwork" && (
              <p className="px-4 py-3 text-[11.5px] leading-relaxed text-muted sm:px-5">
                The current track&apos;s artwork is blurred behind this section. Best for the player.
              </p>
            )}

            <SliderRow label="Overlay" description="Darken the background for readability" min={0} max={90} value={bg.overlay} suffix="%" onChange={(overlay) => settings.setBackground(bgSection, { overlay })} />
            <SliderRow label="Blur" min={0} max={120} value={bg.blur} suffix="px" onChange={(blur) => settings.setBackground(bgSection, { blur })} />
            <SliderRow label="Brightness" min={20} max={180} value={Math.round(bg.brightness * 100)} suffix="%" onChange={(value) => settings.setBackground(bgSection, { brightness: value / 100 })} />
            <SliderRow label="Saturation" min={0} max={220} value={Math.round(bg.saturation * 100)} suffix="%" onChange={(value) => settings.setBackground(bgSection, { saturation: value / 100 })} />
          </SettingsGroup>

          <SettingsGroup title="Now Playing" description="The player, exactly how you like it">
            <SettingRow label="Blurred artwork background" description="Use the cover as the player's backdrop">
              <Switch
                checked={settings.nowPlaying.blurArtwork}
                onChange={(blurArtwork) => settings.nowPlayingChange({ blurArtwork })}
                label="Blurred artwork background"
              />
            </SettingRow>
            <SliderRow
              label="Artwork blur"
              min={0}
              max={120}
              value={settings.nowPlaying.artworkBlur}
              suffix="px"
              onChange={(artworkBlur) => settings.nowPlayingChange({ artworkBlur })}
            />
            <SettingRow label="Artwork shape">
              <Segmented
                value={settings.nowPlaying.artworkStyle}
                size="sm"
                onChange={(artworkStyle) => settings.nowPlayingChange({ artworkStyle })}
                options={[
                  { value: "rounded", label: "Rounded" },
                  { value: "square", label: "Square" },
                  { value: "circle", label: "Circle" },
                ]}
              />
            </SettingRow>
            <SettingRow label="Playback controls">
              <Segmented
                value={settings.nowPlaying.controlsStyle}
                size="sm"
                onChange={(controlsStyle) => settings.nowPlayingChange({ controlsStyle })}
                options={[
                  { value: "filled", label: "Filled" },
                  { value: "outline", label: "Outline" },
                  { value: "minimal", label: "Minimal" },
                ]}
              />
            </SettingRow>
            <SettingRow label="Show time remaining" description="Instead of total duration">
              <Switch
                checked={settings.nowPlaying.showRemaining}
                onChange={(showRemaining) => settings.nowPlayingChange({ showRemaining })}
                label="Show time remaining"
              />
            </SettingRow>
            <SettingRow label="Artwork glow" description="Ambient colour pulled from the cover">
              <Switch checked={settings.nowPlaying.glow} onChange={(glow) => settings.nowPlayingChange({ glow })} label="Artwork glow" />
            </SettingRow>
          </SettingsGroup>

          <SettingsGroup title="Lyrics" description="Timing, typography and highlighting">
            <SliderRow
              label="Font size"
              min={16}
              max={40}
              value={settings.lyrics.fontSize}
              suffix="px"
              onChange={(fontSize) => settings.lyricsChange({ fontSize })}
            />
            <SettingRow label="Alignment">
              <Segmented
                value={settings.lyrics.align}
                size="sm"
                onChange={(align) => settings.lyricsChange({ align })}
                options={[
                  { value: "left", label: "Left" },
                  { value: "center", label: "Center" },
                ]}
              />
            </SettingRow>
            <SettingRow label="Highlight style">
              <Segmented
                value={settings.lyrics.highlight}
                size="sm"
                onChange={(highlight) => settings.lyricsChange({ highlight })}
                options={[
                  { value: "fill", label: "Fill" },
                  { value: "glow", label: "Glow" },
                  { value: "underline", label: "Underline" },
                ]}
              />
            </SettingRow>
            <SettingRow label="Auto-scroll" description="Follow the sung line automatically">
              <Switch checked={settings.lyrics.autoScroll} onChange={(autoScroll) => settings.lyricsChange({ autoScroll })} label="Auto-scroll lyrics" />
            </SettingRow>
          </SettingsGroup>

          <SettingsGroup id="source" title="Music source" description="One source, no switching">
            <div className="px-4 py-4 sm:px-5">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                  <Music2 size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium">YouTube Music</p>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">
                    Streaming only through yt-dlp · YouTube doesn&apos;t authorise downloads
                  </p>
                </div>
              </div>
              <p className="mt-3 text-[11.5px] leading-relaxed text-muted">
                YouTube blocks datacenter IPs, so melo may need cookies on this machine or a residential connection.
                There is no second catalogue to fall back to.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Button size="sm" variant="surface" onClick={() => void checkSources()} disabled={checking}>
                  {checking ? <Loader2 size={13} className="anim-spin" /> : <CloudOff size={13} />} Test source
                </Button>
                <span className="text-[10.5px]">Runs a real search + stream resolution</span>
              </div>
              {checks && (
                <div className="mt-3 space-y-1.5">
                  {checks.map((check) => (
                    <div key={check.provider} className="flex items-start gap-2">
                      <span className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", check.available ? "bg-[#7FDCC0]" : "bg-[#F08C7E]")} />
                      <span className="min-w-0">
                        <span className="text-[11.5px] font-medium text-ink/85">{check.label}</span>
                        <span className="text-[11px] text-muted"> — {check.available ? "available" : check.reason}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SettingsGroup>

          <SettingsGroup id="storage" title="Storage" description="What melo keeps on this device">
            <div className="px-3 py-4 sm:px-4">
              <StoragePanel />
            </div>
          </SettingsGroup>

          <SettingsGroup title="About melo" description="Free, private, and yours">
            <div className="space-y-3 px-4 py-4 text-[12px] leading-relaxed text-muted sm:px-5">
              <p className="flex items-start gap-2">
                <ShieldCheck size={15} className="mt-0.5 shrink-0 text-accent" />
                No account, no ads, no subscriptions, no analytics. Playlists, follows, history, downloads and settings
                never leave this device.
              </p>
              <p className="flex items-start gap-2">
                <Info size={15} className="mt-0.5 shrink-0" />
                {/* One span keeps the sentence as flowing text instead of
                    letting the link become its own flex column. */}
                <span>
                  Lyrics come from{" "}
                <a href="https://lrclib.net" target="_blank" rel="noreferrer" className="text-ink underline decoration-line underline-offset-2">
                  LRCLIB
                </a>
                . Catalogue data and streams come from the selected provider; melo doesn&apos;t claim ownership of any
                  music and doesn&apos;t bypass paywalls, DRM or gated content.
                </span>
              </p>
              <p className="text-[11px]">
                melo{appVersion ? ` v${appVersion}` : ""} ·{" "}
                <Link href="/" className="text-ink/80 underline decoration-line underline-offset-2">back home</Link>
              </p>
            </div>
          </SettingsGroup>
        </div>
      </div>
    </div>
  );
}
