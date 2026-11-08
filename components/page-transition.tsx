"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * One authored transition for the whole app: each route enters as a new view,
 * quick and decelerating. Keyed by pathname so the animation restarts once per
 * navigation, and never on a state update within the same view.
 *
 * The app scrolls its own surface (#main), so a new route must also start at
 * the top — otherwise a page opens mid-list, which no native app does.
 */
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    const scroller = document.getElementById("main");
    if (scroller) scroller.scrollTop = 0;
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div key={pathname} className="view-in min-h-full">
      {children}
    </div>
  );
}
