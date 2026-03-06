import React from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, Rectangle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useAppContext } from '../../store/AppContext';
import { getWeatherColorForPoint, getRiskColor } from '../../utils/weatherColors';
import { WeatherPoint, Vessel, RiskAssessment } from '../../types';

import L from 'leaflet';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconShadowUrl from 'leaflet/dist/images/marker-shadow.png';
L.Icon.Default.mergeOptions({ iconUrl, shadowUrl: iconShadowUrl });

function VesselMarkers({ vessels, risks, selectedVesselId, onSelect }: {
  vessels: Vessel[];
  risks: RiskAssessment[];
  selectedVesselId: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <>
      {vessels.map(vessel => {
        const risk = risks.find(r => r.vesselId === vessel.id);
        const color = risk ? getRiskColor(risk.score) : '#3b82f6';
        const isSelected = vessel.id === selectedVesselId;
        return (
          <CircleMarker
            key={vessel.id}
            center={[vessel.position.lat, vessel.position.lng]}
            radius={isSelected ? 14 : 10}
            pathOptions={{
              color: isSelected ? '#fff' : color,
              fillColor: color,
              fillOpacity: 0.9,
              weight: isSelected ? 3 : 2,
            }}
            eventHandlers={{ click: () => onSelect(isSelected ? null : vessel.id) }}
          >
            <Popup>
              <div style={{ minWidth: 180 }}>
                <strong>{vessel.name}</strong><br />
                Type: {vessel.type}<br />
                Speed: {vessel.speed} kts | Heading: {vessel.heading}°<br />
                Status: {vessel.status}<br />
                {risk && <>
                  Risk Score: <strong style={{ color }}>{risk.score}/100</strong><br />
                  Decision: <strong style={{ color: risk.goNoGo.decision === 'GO' ? 'green' : risk.goNoGo.decision === 'NO-GO' ? 'red' : 'orange' }}>
                    {risk.goNoGo.decision}
                  </strong>
                </>}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}

function RouteLines({ vessels, risks }: { vessels: Vessel[]; risks: RiskAssessment[] }) {
  return (
    <>
      {vessels.map(vessel => {
        if (!vessel.route || vessel.route.length < 2) return null;
        const risk = risks.find(r => r.vesselId === vessel.id);
        const color = risk ? getRiskColor(risk.score) : '#3b82f6';
        const positions = vessel.route.map(p => [p.lat, p.lng] as [number, number]);
        return (
          <React.Fragment key={vessel.id}>
            <Polyline positions={positions} pathOptions={{ color, weight: 2, dashArray: '6 4', opacity: 0.7 }} />
            {risk?.suggestedRoute && risk.suggestedRoute.length > 1 && (
              <Polyline
                positions={risk.suggestedRoute.map(p => [p.lat, p.lng] as [number, number])}
                pathOptions={{ color: '#22c55e', weight: 2, dashArray: '4 4', opacity: 0.8 }}
              />
            )}
          </React.Fragment>
        );
      })}
    </>
  );
}

function WeatherOverlay({ weather, layer }: { weather: WeatherPoint[]; layer: 'waves' | 'wind' | 'pressure' }) {
  return (
    <>
      {weather.map((point, i) => {
        const color = getWeatherColorForPoint(point, layer);
        const bounds: [[number, number], [number, number]] = [
          [point.lat - 1, point.lng - 1],
          [point.lat + 1, point.lng + 1],
        ];
        return (
          <Rectangle key={i} bounds={bounds} pathOptions={{ color: 'transparent', fillColor: color, fillOpacity: 0.55, weight: 0 }}>
            <Popup>
              <div style={{ minWidth: 160 }}>
                {layer === 'waves' && <>
                  <strong>Wave Data</strong><br />
                  Height: {point.waveHeight}m<br />
                  Direction: {point.waveDirection}°<br />
                  Period: {point.wavePeriod}s
                </>}
                {layer === 'wind' && <>
                  <strong>Wind Data</strong><br />
                  Speed: {point.windSpeed} kts<br />
                  Direction: {point.windDirection}°
                </>}
                {layer === 'pressure' && <>
                  <strong>Pressure Data</strong><br />
                  Pressure: {point.barometricPressure} hPa<br />
                  Visibility: {point.visibility} nm
                </>}
              </div>
            </Popup>
          </Rectangle>
        );
      })}
    </>
  );
}

export default function MapView() {
  const { state, dispatch } = useAppContext();
  const { vessels, weather, risks, layers, selectedVesselId } = state;

  const activeWeatherData = state.layers.forecast && state.forecast.length > 0
    ? (state.forecast[Math.min(state.selectedForecastHour, state.forecast.length - 1)]?.weatherGrid ?? weather)
    : weather;

  return (
    <MapContainer
      center={[27.0, -88.0]}
      zoom={6}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />

      {layers.waves && <WeatherOverlay weather={activeWeatherData} layer="waves" />}
      {layers.wind && <WeatherOverlay weather={activeWeatherData} layer="wind" />}
      {layers.pressure && <WeatherOverlay weather={activeWeatherData} layer="pressure" />}

      {layers.routes && <RouteLines vessels={vessels} risks={risks} />}

      {layers.vessels && (
        <VesselMarkers
          vessels={vessels}
          risks={risks}
          selectedVesselId={selectedVesselId}
          onSelect={(id) => dispatch({ type: 'SELECT_VESSEL', id })}
        />
      )}
    </MapContainer>
  );
}
