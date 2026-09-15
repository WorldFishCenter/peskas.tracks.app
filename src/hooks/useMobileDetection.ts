import { useMediaQuery, MD_BREAKPOINT_PX } from './useMediaQuery';

// Evaluated once: the user agent cannot change for the life of the page.
const IS_MOBILE_DEVICE =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

/**
 * Whether to use touch-style interactions (tap-to-open bottom sheet) rather
 * than pointer-style ones (hover tooltip).
 *
 * Distinct from the `md` breakpoint that reshapes the dashboard grid: this hook
 * also considers the user agent, so it stays true on a tablet however wide the
 * viewport gets.
 */
export const useMobileDetection = (): boolean =>
  useMediaQuery(`(max-width: ${MD_BREAKPOINT_PX}px)`) || IS_MOBILE_DEVICE;
