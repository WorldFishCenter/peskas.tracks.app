import { useState, useEffect } from 'react';

/**
 * Whether the app is currently in dark mode, tracked from the data-bs-theme
 * attribute Tabler sets on the root element.
 *
 * Transitional. Reading the theme into React state at all is a workaround for
 * markup that picks colour classes in JavaScript (`bg-dark` vs `bg-white`)
 * instead of letting Tabler's own theme-aware CSS do it. Each call site should
 * be converted to theme-aware classes and this hook deleted; it exists so that
 * conversion can happen one component at a time rather than all at once, and
 * so the four copies of this effect are one copy in the meantime.
 */
export const useIsDarkMode = (): boolean => {
  const [isDarkMode, setIsDarkMode] = useState(
    () => document.documentElement.getAttribute('data-bs-theme') === 'dark'
  );

  useEffect(() => {
    const detectTheme = () => {
      setIsDarkMode(document.documentElement.getAttribute('data-bs-theme') === 'dark');
    };

    detectTheme();

    const observer = new MutationObserver(detectTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-bs-theme']
    });

    return () => observer.disconnect();
  }, []);

  return isDarkMode;
};
