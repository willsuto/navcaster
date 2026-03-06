import { useAppContext } from '../../store/AppContext';
import { LayerVisibility } from '../../types';

const LAYERS: { key: keyof LayerVisibility; label: string; color: string }[] = [
  { key: 'vessels', label: '🚢 Vessels', color: '#3b82f6' },
  { key: 'routes', label: '📍 Routes', color: '#8b5cf6' },
  { key: 'waves', label: '🌊 Wave Height', color: '#06b6d4' },
  { key: 'wind', label: '💨 Wind Speed', color: '#84cc16' },
  { key: 'pressure', label: '🌡️ Pressure', color: '#f59e0b' },
  { key: 'forecast', label: '📅 Forecast Mode', color: '#ec4899' },
];

export default function ControlPanel() {
  const { state, dispatch } = useAppContext();

  return (
    <div className="control-panel">
      <h3>Map Layers</h3>
      <div className="layer-toggles">
        {LAYERS.map(({ key, label, color }) => (
          <label key={key} className="layer-toggle">
            <input
              type="checkbox"
              checked={state.layers[key]}
              onChange={() => dispatch({ type: 'TOGGLE_LAYER', layer: key })}
            />
            <span className="toggle-indicator" style={{ backgroundColor: state.layers[key] ? color : '#4b5563' }} />
            <span className="layer-label">{label}</span>
          </label>
        ))}
      </div>

      {state.layers.forecast && state.forecast.length > 0 && (
        <div className="forecast-slider">
          <label>
            Forecast: {state.forecast[state.selectedForecastHour]
              ? new Date(state.forecast[state.selectedForecastHour].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : 'Now'}
          </label>
          <input
            type="range"
            min={0}
            max={state.forecast.length - 1}
            value={state.selectedForecastHour}
            onChange={(e) => dispatch({ type: 'SET_FORECAST_HOUR', hour: Number(e.target.value) })}
          />
        </div>
      )}

      <div className="legend">
        <h4>Wave Height</h4>
        <div className="legend-items">
          <span style={{ background: 'rgba(0,100,255,0.5)' }}>0-1m</span>
          <span style={{ background: 'rgba(0,180,255,0.5)' }}>1-2m</span>
          <span style={{ background: 'rgba(255,220,0,0.6)' }}>2-3m</span>
          <span style={{ background: 'rgba(255,140,0,0.65)' }}>3-4m</span>
          <span style={{ background: 'rgba(220,0,0,0.7)' }}>4m+</span>
        </div>
      </div>
    </div>
  );
}
