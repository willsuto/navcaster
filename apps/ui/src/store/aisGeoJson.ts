import { useMemo } from 'react';
import { selectVessels, useAisVesselStore, type Vessel } from './aisVessels';

export type VesselFeatureProperties = {
  mmsi: number;
  name?: string;
  heading?: number;
  cog?: number;
  sog?: number;
  roll?: number;
  lastSeen: number;
  messageType?: string;
  timestamp?: string;
};

export type VesselFeatureCollection = {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: {
      type: 'Point';
      coordinates: [number, number];
    };
    properties: VesselFeatureProperties;
  }>;
};

const isValidCoordinate = (
  value: number | undefined,
  min: number,
  max: number
): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

const toVesselFeature = (vessel: Vessel) => {
  const longitude = vessel.longitude;
  const latitude = vessel.latitude;

  if (!isValidCoordinate(longitude, -180, 180)) return null;
  if (!isValidCoordinate(latitude, -90, 90)) return null;

  const coordinates: [number, number] = [longitude, latitude];

  return {
    type: 'Feature' as const,
    geometry: {
      type: 'Point' as const,
      coordinates
    },
    properties: {
      mmsi: vessel.mmsi,
      name: vessel.name,
      heading: vessel.heading,
      cog: vessel.cog,
      sog: vessel.sog,
      roll: vessel.roll,
      lastSeen: vessel.lastSeen,
      messageType: vessel.messageType,
      timestamp: vessel.timestamp
    }
  };
};

export const buildVesselFeatureCollection = (
  vessels: Record<string, Vessel>
): VesselFeatureCollection => {
  const features = Object.values(vessels)
    .map((vessel) => toVesselFeature(vessel))
    .filter((feature): feature is NonNullable<ReturnType<typeof toVesselFeature>> =>
      Boolean(feature)
    );

  return {
    type: 'FeatureCollection',
    features
  };
};

export const useVesselFeatureCollection = () => {
  const vessels = useAisVesselStore(selectVessels);

  return useMemo(() => buildVesselFeatureCollection(vessels), [vessels]);
};