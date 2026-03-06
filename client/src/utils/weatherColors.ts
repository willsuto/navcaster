import { WeatherPoint } from '../types';

export function waveHeightColor(height: number): string {
  if (height < 1) return 'rgba(0, 100, 255, 0.3)';
  if (height < 2) return 'rgba(0, 180, 255, 0.4)';
  if (height < 3) return 'rgba(255, 220, 0, 0.45)';
  if (height < 4) return 'rgba(255, 140, 0, 0.5)';
  return 'rgba(220, 0, 0, 0.55)';
}

export function windSpeedColor(speed: number): string {
  if (speed < 10) return 'rgba(144, 238, 144, 0.35)';
  if (speed < 20) return 'rgba(255, 255, 0, 0.4)';
  if (speed < 30) return 'rgba(255, 165, 0, 0.45)';
  if (speed < 40) return 'rgba(255, 80, 0, 0.5)';
  return 'rgba(200, 0, 0, 0.55)';
}

export function pressureColor(pressure: number): string {
  if (pressure > 1010) return 'rgba(0, 200, 255, 0.3)';
  if (pressure > 1000) return 'rgba(100, 255, 100, 0.35)';
  if (pressure > 990) return 'rgba(255, 255, 0, 0.4)';
  if (pressure > 980) return 'rgba(255, 140, 0, 0.45)';
  return 'rgba(200, 0, 0, 0.55)';
}

export function getRiskColor(score: number): string {
  if (score < 25) return '#22c55e';
  if (score < 50) return '#eab308';
  if (score < 75) return '#f97316';
  return '#ef4444';
}

export function getGoNoGoColor(decision: string): string {
  switch (decision) {
    case 'GO': return '#22c55e';
    case 'CAUTION': return '#eab308';
    case 'NO-GO': return '#ef4444';
    default: return '#6b7280';
  }
}

export function getWeatherColorForPoint(point: WeatherPoint, layer: 'waves' | 'wind' | 'pressure'): string {
  switch (layer) {
    case 'waves': return waveHeightColor(point.waveHeight);
    case 'wind': return windSpeedColor(point.windSpeed);
    case 'pressure': return pressureColor(point.barometricPressure);
    default: return 'transparent';
  }
}
