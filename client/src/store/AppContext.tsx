import React, { createContext, useContext, useReducer } from 'react';
import { AppState, LayerVisibility, Vessel, WeatherPoint, ForecastPoint, RiskAssessment, Alert } from '../types';

type Action =
  | { type: 'SET_DATA'; vessels: Vessel[]; weather: WeatherPoint[]; forecast: ForecastPoint[]; risks: RiskAssessment[]; alerts: Alert[] }
  | { type: 'TOGGLE_LAYER'; layer: keyof LayerVisibility }
  | { type: 'SELECT_VESSEL'; id: string | null }
  | { type: 'SET_FORECAST_HOUR'; hour: number }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'ACKNOWLEDGE_ALERT'; id: string };

const initialState: AppState = {
  vessels: [],
  weather: [],
  forecast: [],
  risks: [],
  alerts: [],
  layers: {
    waves: true,
    wind: true,
    pressure: false,
    vessels: true,
    routes: true,
    forecast: false,
  },
  selectedVesselId: null,
  selectedForecastHour: 0,
  loading: false,
  error: null,
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_DATA':
      return { ...state, vessels: action.vessels, weather: action.weather, forecast: action.forecast, risks: action.risks, alerts: action.alerts, loading: false };
    case 'TOGGLE_LAYER':
      return { ...state, layers: { ...state.layers, [action.layer]: !state.layers[action.layer] } };
    case 'SELECT_VESSEL':
      return { ...state, selectedVesselId: action.id };
    case 'SET_FORECAST_HOUR':
      return { ...state, selectedForecastHour: action.hour };
    case 'SET_LOADING':
      return { ...state, loading: action.loading };
    case 'SET_ERROR':
      return { ...state, error: action.error };
    case 'ACKNOWLEDGE_ALERT':
      return { ...state, alerts: state.alerts.map(a => a.id === action.id ? { ...a, acknowledged: true } : a) };
    default:
      return state;
  }
}

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}
