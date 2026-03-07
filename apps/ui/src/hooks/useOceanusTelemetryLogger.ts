import { useEffect } from 'react';
import { useAisVesselStore } from '../store/aisVessels';
import { useAisTelemetryLogStore } from '../store/aisTelemetryLog';

const OCEANUS_MMSI = 999000001;
const LOG_INTERVAL_MS = 1000;
const LOG_RETENTION_MS = 30 * 60 * 1000;

const hasValidCoordinate = (value: number | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export const useOceanusTelemetryLogger = () => {
  useEffect(() => {
    const timer = window.setInterval(() => {
      const vessel = useAisVesselStore.getState().vessels[String(OCEANUS_MMSI)];
      const latitude = vessel?.latitude;
      const longitude = vessel?.longitude;
      if (!vessel || !hasValidCoordinate(latitude) || !hasValidCoordinate(longitude)) {
        return;
      }

      const now = Date.now();
      const { appendOceanus, pruneOceanus } = useAisTelemetryLogStore.getState();

      appendOceanus({
        t: now,
        latitude,
        longitude,
        cog: vessel.cog,
        sog: vessel.sog,
        heading: vessel.heading,
        roll: vessel.roll
      });

      pruneOceanus(LOG_RETENTION_MS, now);
    }, LOG_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, []);
};