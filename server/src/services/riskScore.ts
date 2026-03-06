import { Vessel, WeatherPoint, RiskAssessment, RiskFactor, GoNoGoDecision, OperationalLimit } from '../types';

// Operational limits by vessel type
const OPERATIONAL_LIMITS: Record<string, { waveHeight: number; windSpeed: number; minPressure: number }> = {
  cargo: { waveHeight: 4.0, windSpeed: 40, minPressure: 975 },
  tanker: { waveHeight: 3.5, windSpeed: 35, minPressure: 978 },
  passenger: { waveHeight: 2.5, windSpeed: 30, minPressure: 985 },
  military: { waveHeight: 5.0, windSpeed: 50, minPressure: 970 },
  research: { waveHeight: 3.0, windSpeed: 35, minPressure: 980 },
};

function interpolateWeather(lat: number, lng: number, grid: WeatherPoint[]): WeatherPoint | null {
  // Find the nearest 4 grid points and interpolate
  let closest = grid[0];
  let minDist = Infinity;
  
  for (const point of grid) {
    const dist = Math.sqrt(Math.pow(point.lat - lat, 2) + Math.pow(point.lng - lng, 2));
    if (dist < minDist) {
      minDist = dist;
      closest = point;
    }
  }
  
  return closest;
}

export function calculateRiskScore(vessel: Vessel, weatherGrid: WeatherPoint[]): RiskAssessment {
  const weather = interpolateWeather(vessel.position.lat, vessel.position.lng, weatherGrid);
  
  if (!weather) {
    return {
      vesselId: vessel.id,
      score: 0,
      level: 'low',
      factors: [],
      goNoGo: { decision: 'GO', reasons: ['No weather data available'], limits: [] }
    };
  }
  
  const limits = OPERATIONAL_LIMITS[vessel.type] || OPERATIONAL_LIMITS.cargo;
  
  // Calculate risk factors (each contributes to total score)
  const waveRatio = weather.waveHeight / limits.waveHeight;
  const windRatio = weather.windSpeed / limits.windSpeed;
  const pressureRatio = Math.max(0, (1013 - weather.barometricPressure) / (1013 - limits.minPressure));
  const visibilityRatio = Math.max(0, 1 - weather.visibility / 10);
  
  const factors: RiskFactor[] = [
    {
      name: 'Wave Height',
      value: weather.waveHeight,
      unit: 'm',
      weight: 0.35,
      contribution: Math.min(1, waveRatio) * 35,
      threshold: limits.waveHeight,
      status: waveRatio < 0.6 ? 'normal' : waveRatio < 0.85 ? 'caution' : waveRatio < 1 ? 'warning' : 'critical'
    },
    {
      name: 'Wind Speed',
      value: weather.windSpeed,
      unit: 'kts',
      weight: 0.30,
      contribution: Math.min(1, windRatio) * 30,
      threshold: limits.windSpeed,
      status: windRatio < 0.6 ? 'normal' : windRatio < 0.85 ? 'caution' : windRatio < 1 ? 'warning' : 'critical'
    },
    {
      name: 'Barometric Pressure',
      value: weather.barometricPressure,
      unit: 'hPa',
      weight: 0.20,
      contribution: Math.min(1, pressureRatio) * 20,
      threshold: limits.minPressure,
      status: pressureRatio < 0.4 ? 'normal' : pressureRatio < 0.7 ? 'caution' : pressureRatio < 0.9 ? 'warning' : 'critical'
    },
    {
      name: 'Visibility',
      value: weather.visibility,
      unit: 'nm',
      weight: 0.15,
      contribution: visibilityRatio * 15,
      threshold: 2,
      status: weather.visibility > 8 ? 'normal' : weather.visibility > 4 ? 'caution' : weather.visibility > 2 ? 'warning' : 'critical'
    }
  ];
  
  const score = Math.round(Math.min(100, factors.reduce((sum, f) => sum + f.contribution, 0)));
  
  let level: RiskAssessment['level'];
  if (score < 25) level = 'low';
  else if (score < 50) level = 'moderate';
  else if (score < 75) level = 'high';
  else level = 'critical';
  
  // GO/NO-GO decision
  const operationalLimits: OperationalLimit[] = [
    { parameter: 'Wave Height', limit: limits.waveHeight, unit: 'm', currentValue: weather.waveHeight, exceeded: weather.waveHeight > limits.waveHeight },
    { parameter: 'Wind Speed', limit: limits.windSpeed, unit: 'kts', currentValue: weather.windSpeed, exceeded: weather.windSpeed > limits.windSpeed },
    { parameter: 'Barometric Pressure', limit: limits.minPressure, unit: 'hPa', currentValue: weather.barometricPressure, exceeded: weather.barometricPressure < limits.minPressure },
    { parameter: 'Visibility', limit: 2, unit: 'nm', currentValue: weather.visibility, exceeded: weather.visibility < 2 },
  ];
  
  const exceededLimits = operationalLimits.filter(l => l.exceeded);
  const reasons: string[] = [];
  
  if (exceededLimits.length > 0) {
    exceededLimits.forEach(l => {
      reasons.push(`${l.parameter} ${l.currentValue}${l.unit} exceeds limit of ${l.limit}${l.unit}`);
    });
  }
  
  let decision: GoNoGoDecision['decision'];
  if (exceededLimits.length > 0) {
    decision = 'NO-GO';
  } else if (score > 40) {
    decision = 'CAUTION';
    reasons.push('Conditions approaching operational limits');
  } else {
    decision = 'GO';
    reasons.push('All conditions within acceptable limits');
  }
  
  // Suggest alternate route (simplified: route with symmetric random offset away from hazards)
  const suggestedRoute = vessel.route && vessel.route.length > 0
    ? vessel.route.map(pt => ({
        lat: pt.lat + (Math.random() - 0.5) * 0.5,
        lng: pt.lng + (Math.random() - 0.5) * 0.5
      }))
    : undefined;
  
  return {
    vesselId: vessel.id,
    score,
    level,
    factors,
    goNoGo: { decision, reasons, limits: operationalLimits },
    suggestedRoute: decision !== 'GO' ? suggestedRoute : undefined
  };
}
