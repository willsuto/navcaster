import { Vessel, WeatherPoint, ForecastPoint, Alert, RiskAssessment } from '../types';
import { calculateRiskScore } from './riskScore';

let alertCounter = 1;
function generateId(): string {
  return `alert-${Date.now()}-${alertCounter++}`;
}

export function generateAlerts(
  vessels: Vessel[],
  currentWeather: WeatherPoint[],
  forecast: ForecastPoint[],
  currentRiskScores: RiskAssessment[]
): Alert[] {
  const alerts: Alert[] = [];
  
  for (const vessel of vessels) {
    const currentRisk = currentRiskScores.find(r => r.vesselId === vessel.id);
    
    // Check forecast for deteriorating conditions
    for (const forecastPoint of forecast) {
      const futureRisk = calculateRiskScore(vessel, forecastPoint.weatherGrid);
      const hoursAhead = Math.round(
        (new Date(forecastPoint.timestamp).getTime() - Date.now()) / (1000 * 60 * 60)
      );
      
      if (hoursAhead <= 0) continue;
      
      // Alert if future conditions are significantly worse than current
      if (currentRisk && futureRisk.score > currentRisk.score + 20) {
        alerts.push({
          id: generateId(),
          vesselId: vessel.id,
          vesselName: vessel.name,
          type: 'weather_deterioration',
          severity: futureRisk.level === 'critical' ? 'critical' : 'warning',
          message: `Weather deterioration forecast in ${hoursAhead}h`,
          detail: `Risk score expected to increase from ${currentRisk.score} to ${futureRisk.score}. ${futureRisk.goNoGo.reasons.join('; ')}`,
          timestamp: new Date().toISOString(),
          acknowledged: false,
          forecastHours: hoursAhead
        });
        break; // Only one deterioration alert per vessel
      }
      
      // Alert if GO/NO-GO status changes
      if (currentRisk?.goNoGo.decision === 'GO' && futureRisk.goNoGo.decision === 'NO-GO') {
        alerts.push({
          id: generateId(),
          vesselId: vessel.id,
          vesselName: vessel.name,
          type: 'go_nogo_change',
          severity: 'critical',
          message: `GO/NO-GO status change forecast in ${hoursAhead}h`,
          detail: `Operations may need to be suspended. ${futureRisk.goNoGo.reasons.join('; ')}`,
          timestamp: new Date().toISOString(),
          acknowledged: false,
          forecastHours: hoursAhead
        });
        break;
      }
    }
    
    // Alert for currently exceeded thresholds
    if (currentRisk?.goNoGo.decision === 'NO-GO') {
      alerts.push({
        id: generateId(),
        vesselId: vessel.id,
        vesselName: vessel.name,
        type: 'threshold_breach',
        severity: 'critical',
        message: `Operational limits exceeded`,
        detail: currentRisk.goNoGo.reasons.join('; '),
        timestamp: new Date().toISOString(),
        acknowledged: false,
        forecastHours: 0
      });
    } else if (currentRisk && currentRisk.score > 60) {
      alerts.push({
        id: generateId(),
        vesselId: vessel.id,
        vesselName: vessel.name,
        type: 'route_risk',
        severity: 'warning',
        message: `High risk conditions on route`,
        detail: `Current risk score: ${currentRisk.score}/100. Consider route modification.`,
        timestamp: new Date().toISOString(),
        acknowledged: false,
        forecastHours: 0
      });
    }
  }
  
  return alerts;
}
