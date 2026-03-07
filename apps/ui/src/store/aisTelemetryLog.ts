import { create } from 'zustand';

export type TelemetryLog = {
  t: number;
  latitude: number;
  longitude: number;
  cog?: number;
  sog?: number;
  heading?: number;
  roll?: number;
};

type AisTelemetryLogState = {
  oceanus: TelemetryLog[];
  appendOceanus: (entry: TelemetryLog) => void;
  pruneOceanus: (maxAgeMs: number, now?: number) => number;
  reset: () => void;
};

export const useAisTelemetryLogStore = create<AisTelemetryLogState>((set, get) => ({
  oceanus: [],
  appendOceanus: (entry) =>
    set((state) => ({
      oceanus: [...state.oceanus, entry]
    })),
  pruneOceanus: (maxAgeMs, now = Date.now()) => {
    const cutoff = now - maxAgeMs;
    const current = get().oceanus;
    if (current.length === 0) return 0;

    let firstValidIndex = 0;
    while (firstValidIndex < current.length && current[firstValidIndex].t < cutoff) {
      firstValidIndex += 1;
    }

    if (firstValidIndex === 0) return 0;

    const next = current.slice(firstValidIndex);
    set({ oceanus: next });
    return current.length - next.length;
  },
  reset: () => set({ oceanus: [] })
}));

export const selectOceanusTelemetry = (state: AisTelemetryLogState) => state.oceanus;