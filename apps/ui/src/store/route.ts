import { create } from 'zustand';

export type RouteWaypoint = {
  lat: number;
  lon: number;
  timeMs: number;
};

export type RouteProperties = {
  durationHours: number;
  distanceNm: number;
  eta: string;
  iterations: number;
  frontierMax: number;
  arrived: boolean;
  closestApproachMeters: number;
  terminationReason: 'arrived' | 'no-wind' | 'max-steps' | 'stalled';
  waypoints?: RouteWaypoint[];
};

export type RouteFeature = GeoJSON.Feature<GeoJSON.LineString, RouteProperties>;

export type RouteState = {
  route: RouteFeature | null;
  setRoute: (route: RouteFeature | null) => void;
};

export const useRouteStore = create<RouteState>((set) => ({
  route: null,
  setRoute: (route) => set({ route })
}));