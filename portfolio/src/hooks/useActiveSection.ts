"use client";

import { useEffect, useState } from "react";

/**
 * Returns the id of the section currently crossing the middle of the viewport.
 *
 * This is a deliberately separate source of truth from the 3D world's own scroll position (computeRig/RigDriver,
 * which measures zone boundaries directly rather than watching a viewport band). The two are not synchronised, and
 * were verified in agreement under real interaction — direct nav clicks, rapid link-switching and fast wheel-scroll
 * all keep them in sync — but only because their independent thresholds happen to land close together for the
 * current section heights. If either side's thresholds change (this hook's rootMargin, or a zone's plateau/fade
 * range in rig-math.ts), re-check the other against real scrolling before assuming they still agree.
 */
export function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );

    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [ids]);

  return active;
}
