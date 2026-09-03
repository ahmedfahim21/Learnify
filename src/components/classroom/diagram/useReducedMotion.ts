"use client";

import { useEffect, useState } from "react";

/** Tracks `prefers-reduced-motion: reduce`, live. Motion in the diagram is
 *  always decoration — every step also has a caption — so this only ever
 *  disables autoplay/the packet, never information. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
