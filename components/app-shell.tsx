"use client";

import { useEffect } from "react";
import Sidebar from "@/components/sidebar";
import MobileNav from "@/components/mobile-nav";
import MiniPlayer from "@/components/mini-player";
import NowPlaying from "@/components/now-playing";
import GlobalSheets from "@/components/global-sheets";
import PageTransition from "@/components/page-transition";
import SectionBackground from "@/components/section-background";
import AmbientBackdrop from "@/components/ambient-backdrop";
import { usePlayer } from "@/store/player";
import { toast } from "@/store/toast";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const error = usePlayer((s) => s.error);
  const dismissError = usePlayer((s) => s.dismissError);

  useEffect(() => {
    if (!error) return;
    toast(error, "error", { label: "Music source", run: () => (window.location.href = "/settings#source") });
    dismissError();
  }, [error, dismissError]);

  return (
    <div className="relative flex h-dvh overflow-hidden">
      <SectionBackground section="app" />
      <AmbientBackdrop />
      <Sidebar />
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <main
          id="main"
          className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(152px+env(safe-area-inset-bottom))] lg:pb-[86px]"
        >
          <PageTransition>{children}</PageTransition>
        </main>
        <MiniPlayer />
        <MobileNav />
      </div>
      <NowPlaying />
      <GlobalSheets />
    </div>
  );
}
