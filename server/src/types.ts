export interface Vessel {
  id: string;
  name: string;
  type: 'cargo' | 'tanker' | 'passenger' | 'military' | 'research';
  position: { lat: number; lng: number };
  heading: number; // degrees 0-360
  speed: number; // knots
  status: 'underway' | 'anchored' | 'moored';
  route?: Array<{ lat: number; lng: number }>;
  mmsi: string;
}

export interface WeatherPoint {
  lat: number;
  lng: number;
  waveHeight: number; // meters
  waveDirection: number; // degrees
  wavePeriod: number; // seconds
  windSpeed: number; // knots
  windDirection: number; // degrees
  barometricPressure: number; // hPa
  visibility: number; // nautical miles
  seaTemperature: number; // Celsius
  swellHeight: number; // meters
  swellDirection: number; // degrees
}

export interface ForecastPoint {
  timestamp: string; // ISO8601
  weatherGrid: WeatherPoint[];
}

export interface RiskAssessment {
  vesselId: string;
  score: number; // 0-100
  level: 'low' | 'moderate' | 'high' | 'critical';
  factors: RiskFactor[];
  goNoGo: GoNoGoDecision;
  suggestedRoute?: Array<{ lat: number; lng: number }>;
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

export interface GoNoGoDecision {
  decision: 'GO' | 'CAUTION' | 'NO-GO';
  reasons: string[];
  limits: OperationalLimit[];
}

export interface OperationalLimit {
  parameter: string;
  limit: number;
  unit: string;
  currentValue: number;
  exceeded: boolean;
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
