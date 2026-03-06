export interface Vessel {
  id: string;
  name: string;
  type: 'cargo' | 'tanker' | 'passenger' | 'military' | 'research';
  position: { lat: number; lng: number };
  heading: number;
  speed: number;
  status: 'underway' | 'anchored' | 'moored';
  route?: Array<{ lat: number; lng: number }>;
  mmsi: string;
}

export interface WeatherPoint {
  lat: number;
  lng: number;
  waveHeight: number;
  waveDirection: number;
  wavePeriod: number;
  windSpeed: number;
  windDirection: number;
  barometricPressure: number;
  visibility: number;
  seaTemperature: number;
  swellHeight: number;
  swellDirection: number;
}

export interface ForecastPoint {
  timestamp: string;
  weatherGrid: WeatherPoint[];
}

export interface RiskFactor {
  name: string;
  value: number;
  unit: string;
  weight: number;
  contribution: number;
  threshold: number;
  status: 'normal' | 'caution' | 'warning' | 'critical';
}

export interface OperationalLimit {
  parameter: string;
  limit: number;
  unit: string;
  currentValue: number;
  exceeded: boolean;
}

export interface GoNoGoDecision {
  decision: 'GO' | 'CAUTION' | 'NO-GO';
  reasons: string[];
  limits: OperationalLimit[];
}

export interface RiskAssessment {
  vesselId: string;
  score: number;
  level: 'low' | 'moderate' | 'high' | 'critical';
  factors: RiskFactor[];
  goNoGo: GoNoGoDecision;
  suggestedRoute?: Array<{ lat: number; lng: number }>;
}

export interface Alert {
  id: string;
  vesselId: string;
  vesselName: string;
  type: 'weather_deterioration' | 'go_nogo_change' | 'route_risk' | 'threshold_breach';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  detail: string;
  timestamp: string;
  acknowledged: boolean;
  forecastHours: number;
}

export interface LayerVisibility {
  waves: boolean;
  wind: boolean;
  pressure: boolean;
  vessels: boolean;
  routes: boolean;
  forecast: boolean;
}

export interface AppState {
  vessels: Vessel[];
  weather: WeatherPoint[];
  forecast: ForecastPoint[];
  risks: RiskAssessment[];
  alerts: Alert[];
  layers: LayerVisibility;
  selectedVesselId: string | null;
  selectedForecastHour: number;
  loading: boolean;
  error: string | null;
}
