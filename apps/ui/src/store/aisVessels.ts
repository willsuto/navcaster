import { create } from 'zustand';
import type { VesselUpdate } from '../services/aisSocket';

export type Vessel = {
  mmsi: number;
  latitude?: number;
  longitude?: number;
  cog?: number;
  sog?: number;
  heading?: number;
  name?: string;
  messageType?: string;
  timestamp?: string;
  lastSeen: number;
};

export type AisVesselState = {
  vessels: Record<string, Vessel>;
  upsertVessel: (update: VesselUpdate, now?: number) => void;
  removeVessel: (mmsi: number) => void;
  pruneStale: (maxAgeMs: number, now?: number) => number;
  reset: () => void;
};

const sanitizeUpdate = (update: VesselUpdate): Partial<Vessel> => {
  const entries = Object.entries(update).filter(([, value]) => value !== undefined);
  return Object.fromEntries(entries) as Partial<Vessel>;
};

export const useAisVesselStore = create<AisVesselState>((set, get) => ({
  vessels: {},
  upsertVessel: (update, now = Date.now()) => {
    if (update.mmsi === undefined || update.mmsi === null) return;

    set((state) => {
      const key = String(update.mmsi);
      const previous = state.vessels[key];
      const sanitized = sanitizeUpdate(update);
      const next: Vessel = {
        ...(previous ?? { mmsi: update.mmsi, lastSeen: now }),
        ...sanitized,
        mmsi: update.mmsi,
        lastSeen: now
      };

      return {
        vessels: {
          ...state.vessels,
          [key]: next
        }
      };
    });
  },
  removeVessel: (mmsi) =>
    set((state) => {
      const key = String(mmsi);
      if (!(key in state.vessels)) return state;
      const { [key]: _removed, ...remaining } = state.vessels;
      return { vessels: remaining };
    }),
  pruneStale: (maxAgeMs, now = Date.now()) => {
    const cutoff = now - maxAgeMs;
    const current = get().vessels;
    const next: Record<string, Vessel> = {};
    let removed = 0;

    for (const [key, vessel] of Object.entries(current)) {
      if (vessel.lastSeen >= cutoff) {
        next[key] = vessel;
      } else {
        removed += 1;
      }
    }

    if (removed > 0) {
      set({ vessels: next });
    }

    return removed;
  },
  reset: () => set({ vessels: {} })
}));

export const selectVessels = (state: AisVesselState) => state.vessels;