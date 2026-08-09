import { useState, useEffect } from 'react';

// Bootstrap's `md` breakpoint. Must stay in sync with the `d-md-none` /
// `d-none d-md-flex` classes that show and hide the two dashboard layouts,
// otherwise a viewport can fall through both and render neither.
const MD_BREAKPOINT_QUERY = '(min-width: 768px)';

/**
 * Tracks whether the Bootstrap desktop (`md` and up) layout is active.
 *
 * Used to mount the map in exactly one of the two dashboard layouts. Both
 * layouts exist in the DOM at all times and are toggled with CSS, so rendering
 * the map in both would initialize two Mapbox instances — and Mapbox bills one
 * map load per instance.
 */
export const useIsDesktopLayout = (): boolean => {
  const [isDesktop, setIsDesktop] = useState(
    () => window.matchMedia(MD_BREAKPOINT_QUERY).matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(MD_BREAKPOINT_QUERY);
    const handleChange = (event: MediaQueryListEvent) => setIsDesktop(event.matches);

    // Re-sync in case the viewport changed between first render and this effect
    setIsDesktop(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return isDesktop;
};
