import { RGB, RGBA } from '../types';

// Viridis color palette (values from 0-255)
export const viridisColors: RGB[] = [
  [131, 245, 229],  // Neon Ice (lowest)
  [148, 220, 222],  // Pearl Aqua
  [164, 196, 216],  // Powder Blue
  [181, 171, 209],  // Lilac
  [198, 146, 202],  // Wisteria
  [214, 122, 196],  // Petal Pink
  [231, 97, 189]    // Bubblegum Fizz (highest)
];

/**
 * Get color based on speed using viridis palette
 */
export const getColorForSpeed = (speed: number): RGB => {
  // Cap speed at 20 km/h for color mapping
  const cappedSpeed = Math.min(speed || 0, 20);
  const index = Math.floor((cappedSpeed / 20) * (viridisColors.length - 1));
  return viridisColors[index];
};

// Highlight color for trips
export const petalPink: RGB = [214, 122, 196];

/**
 * Get battery badge class based on battery state
 */
export const getBatteryBadgeClass = (batteryState: string): string => {
  if (batteryState.includes('Low')) return 'bg-warning text-dark';
  if (batteryState.includes('Critical')) return 'bg-danger text-white';
  return 'bg-success text-white';
};

/**
 * Viridis color range for grid layers (with alpha)
 */
export const viridisColorRange: RGBA[] = [
  [131, 245, 229, 60],   // neon-ice (#83F5E5)
  [148, 220, 222, 90],   // pearl-aqua (#94DCDE)
  [164, 196, 216, 120],  // powder-blue (#A4C4D8)
  [181, 171, 209, 155],  // lilac (#B5ABD1)
  [198, 146, 202, 190],  // wisteria (#C692CA)
  [214, 122, 196, 225],  // petal-pink (#D67AC4)
  [231, 97, 189, 255]    // bubblegum-fizz (#E761BD)
];
