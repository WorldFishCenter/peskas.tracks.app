import { useState, useEffect } from 'react';

// Bootstrap's `md` breakpoint — the boundary the `d-md-*` utility classes switch
// on. Anything that keys layout off the same boundary must read it from here,
// otherwise a viewport can fall through both sides and render neither.
export const MD_BREAKPOINT_PX = 768;

/**
 * Tracks whether a CSS media query currently matches.
 *
 * Uses `change` rather than a `resize` listener: it fires only when the result
 * actually flips, not on every resize tick — including the URL bar collapsing
 * during scroll on mobile.
 */
export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const handleChange = (event: MediaQueryListEvent) => setMatches(event.matches);

    // Re-sync in case the viewport changed between first render and this effect
    setMatches(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [query]);

  return matches;
};
