import { create } from 'zustand';

export type MapLayersState = {
  aisEnabled: boolean;
  oceanusEnabled: boolean;
  trackEnabled: boolean;
  windEnabled: boolean;
  setAisEnabled: (enabled: boolean) => void;
  setOceanusEnabled: (enabled: boolean) => void;
  setTrackEnabled: (enabled: boolean) => void;
  setWindEnabled: (enabled: boolean) => void;
};

export const useMapLayersStore = create<MapLayersState>((set) => ({
  aisEnabled: true,
  oceanusEnabled: true,
  trackEnabled: true,
  windEnabled: false,
  setAisEnabled: (enabled) => set({ aisEnabled: enabled }),
  setOceanusEnabled: (enabled) => set({ oceanusEnabled: enabled }),
  setTrackEnabled: (enabled) => set({ trackEnabled: enabled }),
  setWindEnabled: (enabled) => set({ windEnabled: enabled })
}));