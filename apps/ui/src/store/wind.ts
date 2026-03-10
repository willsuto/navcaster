import { create } from 'zustand';

export type WindCycle = {
  date: string;
  cycle: string;
};

export type WindState = {
  forecastHours: number[];
  selectedForecastHour: number | null;
  cycle: WindCycle | null;
  setForecastHours: (hours: number[]) => void;
  setSelectedForecastHour: (hour: number) => void;
  setCycle: (cycle: WindCycle | null) => void;
};

export const useWindStore = create<WindState>((set) => ({
  forecastHours: [],
  selectedForecastHour: null,
  cycle: null,
  setForecastHours: (hours) =>
    set((state) => {
      const unique = Array.from(new Set(hours)).sort((a, b) => a - b);
      const fallback = unique[0] ?? null;
      const selected =
        state.selectedForecastHour !== null && unique.includes(state.selectedForecastHour)
          ? state.selectedForecastHour
          : fallback;
      return { forecastHours: unique, selectedForecastHour: selected };
    }),
  setSelectedForecastHour: (hour) => set({ selectedForecastHour: hour }),
  setCycle: (cycle) => set({ cycle })
}));