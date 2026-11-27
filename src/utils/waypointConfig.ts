import {
  AnchorIcon,
  Building2Icon,
  HeartIcon,
  MapPinIcon,
  StarIcon,
  WavesIcon,
  type LucideIcon,
} from 'lucide-react';
import { WaypointType } from '../types';

/**
 * Centralized configuration for waypoint types.
 * Keeps map marker colors and UI icons consistent across Deck.gl and React.
 */
export interface WaypointTypeConfig {
  value: WaypointType;
  labelKey: string;
  icon: LucideIcon;
  colorRGB: [number, number, number];
  colorHex: string;
}

export const WAYPOINT_TYPE_CONFIGS: Record<WaypointType, WaypointTypeConfig> = {
  port: {
    value: 'port',
    labelKey: 'waypoints.types.port',
    icon: Building2Icon,
    colorRGB: [136, 84, 208],
    colorHex: '#8854d0',
  },
  anchorage: {
    value: 'anchorage',
    labelKey: 'waypoints.types.anchorage',
    icon: AnchorIcon,
    colorRGB: [32, 107, 196],
    colorHex: '#206bc4',
  },
  fishing_ground: {
    value: 'fishing_ground',
    labelKey: 'waypoints.types.fishing_ground',
    icon: StarIcon,
    colorRGB: [47, 179, 68],
    colorHex: '#2fb344',
  },
  favorite_spot: {
    value: 'favorite_spot',
    labelKey: 'waypoints.types.favorite_spot',
    icon: HeartIcon,
    colorRGB: [245, 159, 0],
    colorHex: '#f59f00',
  },
  shallow_reef: {
    value: 'shallow_reef',
    labelKey: 'waypoints.types.shallow_reef',
    icon: WavesIcon,
    colorRGB: [23, 162, 184],
    colorHex: '#17a2b8',
  },
  other: {
    value: 'other',
    labelKey: 'waypoints.types.other',
    icon: MapPinIcon,
    colorRGB: [102, 117, 127],
    colorHex: '#66757f',
  },
};

export function getWaypointConfig(type: WaypointType): WaypointTypeConfig {
  return WAYPOINT_TYPE_CONFIGS[type] || WAYPOINT_TYPE_CONFIGS.other;
}

export function getWaypointColor(type: WaypointType): [number, number, number] {
  return getWaypointConfig(type).colorRGB;
}

export function getWaypointColorHex(type: WaypointType): string {
  return getWaypointConfig(type).colorHex;
}

export function getAllWaypointTypeConfigs(): WaypointTypeConfig[] {
  return Object.values(WAYPOINT_TYPE_CONFIGS);
}
