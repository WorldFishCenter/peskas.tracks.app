// Map configuration options
export interface MapConfig {
  // Enable/disable Mapbox attribution
  showAttribution: boolean;

  // Map style configuration
  defaultMapStyle: string;
}

// Default configuration
export const defaultMapConfig: MapConfig = {
  showAttribution: false,
  // Raster satellite imagery. One map load covers unlimited tile requests, so
  // the style choice does not affect billing — see reuseMaps in Map.tsx for the
  // setting that does.
  defaultMapStyle: 'mapbox://styles/mapbox/satellite-v9',
};

// Get configuration from environment variables or use defaults
export const getMapConfig = (): MapConfig => {
  return {
    showAttribution: import.meta.env.VITE_SHOW_MAPBOX_ATTRIBUTION === 'true',
    defaultMapStyle: import.meta.env.VITE_DEFAULT_MAP_STYLE || defaultMapConfig.defaultMapStyle,
  };
};
