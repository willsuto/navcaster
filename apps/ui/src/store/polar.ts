import { create } from 'zustand';

export const twsValues = [10, 30, 50] as const;
export const twaAngles = [0, 30, 60, 90, 120, 150, 180] as const;

export type TwsValue = (typeof twsValues)[number];
export type TwaAngle = (typeof twaAngles)[number];

export type PolarTable = Record<TwsValue, Record<TwaAngle, number>>;

const defaultPolarTable: PolarTable = {
  10: { 0: 6, 30: 8, 60: 10, 90: 12, 120: 11, 150: 10, 180: 9 },
  30: { 0: 5, 30: 7, 60: 9, 90: 13, 120: 16, 150: 17, 180: 18 },
  50: { 0: 4, 30: 6, 60: 8, 90: 14, 120: 20, 150: 24, 180: 28 }
};

export type PolarState = {
  table: PolarTable;
  setSpeed: (tws: TwsValue, angle: TwaAngle, speed: number) => void;
  resetDefaults: () => void;
};

export const usePolarStore = create<PolarState>((set) => ({
  table: defaultPolarTable,
  setSpeed: (tws, angle, speed) =>
    set((state) => ({
      table: {
        ...state.table,
        [tws]: {
          ...state.table[tws],
          [angle]: Math.max(0, speed)
        }
      }
    })),
  resetDefaults: () => set({ table: defaultPolarTable })
}));