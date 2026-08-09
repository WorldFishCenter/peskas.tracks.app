import { useState, useEffect } from 'react';

// Matches the previous `window.innerWidth <= 768` threshold exactly, but as a
// media query: `change` fires only when the result actually flips, whereas a
// `resize` listener fires on every tick — including the URL bar collapsing
// during scroll on mobile.
const MOBILE_WIDTH_QUERY = '(max-width: 768px)';
const MOBILE_UA_PATTERN = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

interface UseMobileDetectionReturn {
  isMobile: boolean;
}

/**
 * Whether to use touch-style interactions (tap-to-open bottom sheet) rather
 * than pointer-style ones (hover tooltip).
 *
 * Distinct from `useIsDesktopLayout`, which tracks the Bootstrap `md`
 * breakpoint that swaps the two dashboard layouts. This hook also considers the
 * user agent, so it stays true on a tablet however wide the viewport gets.
 */
export const useMobileDetection = (): UseMobileDetectionReturn => {
  const [isMobile, setIsMobile] = useState(
    () =>
      window.matchMedia(MOBILE_WIDTH_QUERY).matches ||
      MOBILE_UA_PATTERN.test(navigator.userAgent)
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_WIDTH_QUERY);
    const isMobileDevice = MOBILE_UA_PATTERN.test(navigator.userAgent);
    const handleChange = (event: MediaQueryListEvent) =>
      setIsMobile(event.matches || isMobileDevice);

    // Re-sync in case the viewport changed between first render and this effect
    setIsMobile(mediaQuery.matches || isMobileDevice);
    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return { isMobile };
};
