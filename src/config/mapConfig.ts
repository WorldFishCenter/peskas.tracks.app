// Map configuration, resolved once at module load. Vite inlines `import.meta.env`
// at build time, so these are effectively build-time constants.

// Mapbox attribution is hidden by default; opt back in per deployment.
export const SHOW_ATTRIBUTION = import.meta.env.VITE_SHOW_MAPBOX_ATTRIBUTION === 'true';

export const MAP_STYLE =
  import.meta.env.VITE_DEFAULT_MAP_STYLE || 'mapbox://styles/mapbox/satellite-v9';
