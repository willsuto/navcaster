import { create } from 'zustand';

export type MapLayersState = {
  aisEnabled: boolean;
  oceanusEnabled: boolean;
  trackEnabled: boolean;
  setAisEnabled: (enabled: boolean) => void;
  setOceanusEnabled: (enabled: boolean) => void;
  setTrackEnabled: (enabled: boolean) => void;
};

export const useMapLayersStore = create<MapLayersState>((set) => ({
  aisEnabled: true,
  oceanusEnabled: true,
  trackEnabled: true,
  setAisEnabled: (enabled) => set({ aisEnabled: enabled }),
  setOceanusEnabled: (enabled) => set({ oceanusEnabled: enabled }),
  setTrackEnabled: (enabled) => set({ trackEnabled: enabled })
}));