import { useMemo } from 'react';
import { selectOceanusTelemetry, useAisTelemetryLogStore, type TelemetryLog } from './aisTelemetryLog';

export type OceanusTailFeatureCollection = {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: {
      type: 'LineString';
      coordinates: [number, number][];
    };
    properties: {
      mmsi: number;
      startTime?: number;
      endTime?: number;
      pointCount: number;
    };
  }>;
};

const OCEANUS_MMSI = 999000001;

const toLineString = (entries: TelemetryLog[]): OceanusTailFeatureCollection => {
  if (entries.length === 0) {
    return {
      type: 'FeatureCollection',
      features: []
    };
  }

  const coordinates: [number, number][] = [];
  let last: [number, number] | null = null;

  for (const entry of entries) {
    const coordinate: [number, number] = [entry.longitude, entry.latitude];
    if (!last || last[0] !== coordinate[0] || last[1] !== coordinate[1]) {
      coordinates.push(coordinate);
      last = coordinate;
    }
  }

  if (coordinates.length < 2) {
    return {
      type: 'FeatureCollection',
      features: []
    };
  }

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates
        },
        properties: {
          mmsi: OCEANUS_MMSI,
          startTime: entries[0]?.t,
          endTime: entries[entries.length - 1]?.t,
          pointCount: coordinates.length
        }
      }
    ]
  };
};

export const useOceanusTailFeatureCollection = () => {
  const oceanus = useAisTelemetryLogStore(selectOceanusTelemetry);
  return useMemo(() => toLineString(oceanus), [oceanus]);
};