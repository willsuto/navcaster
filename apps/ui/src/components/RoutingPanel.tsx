import { useEffect, useMemo, useState } from 'react';
import PolarEditor from './PolarEditor';
import { useWindStore, type WindCycle } from '../store/wind';
import { usePolarStore } from '../store/polar';
import { useRouteStore, type RouteFeature } from '../store/route';

// Sydney to North Cape of NZ
const DEFAULT_START = { lat: -33.84, lon: 151.34 };
const DEFAULT_FINISH = { lat: -34.39, lon: 172.51 };

type WindMetaResponse = {
  status: string;
  forecastHours?: number[];
  cycle?: WindCycle;
};

type RouteResponse = {
  status: string;
  route?: RouteFeature;
  message?: string;
};

function RoutingPanel() {
  const forecastHours = useWindStore((state) => state.forecastHours);
  const selectedForecastHour = useWindStore((state) => state.selectedForecastHour);
  const setForecastHours = useWindStore((state) => state.setForecastHours);
  const setSelectedForecastHour = useWindStore((state) => state.setSelectedForecastHour);
  const setCycle = useWindStore((state) => state.setCycle);
  const polarTable = usePolarStore((state) => state.table);
  const route = useRouteStore((state) => state.route);
  const setRoute = useRouteStore((state) => state.setRoute);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [routeStatus, setRouteStatus] = useState<'idle' | 'loading' | 'done'>('idle');
  const [routeError, setRouteError] = useState<string | null>(null);

  useEffect(() => {
    const loadMeta = async () => {
      try {
        const response = await fetch('/api/gfs/wind/meta');
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        const data = (await response.json()) as WindMetaResponse;
        if (!data.forecastHours || data.forecastHours.length === 0) {
          throw new Error('No forecast hours available.');
        }
        setForecastHours(data.forecastHours);
        setCycle(data.cycle ?? null);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load wind metadata.');
      } finally {
        setLoading(false);
      }
    };

    loadMeta();
  }, [setForecastHours, setCycle]);

  const sliderIndex = useMemo(() => {
    if (forecastHours.length === 0) return 0;
    if (selectedForecastHour === null) return 0;
    const index = forecastHours.indexOf(selectedForecastHour);
    return index >= 0 ? index : 0;
  }, [forecastHours, selectedForecastHour]);

  const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextIndex = Number(event.target.value);
    const nextHour = forecastHours[nextIndex];
    if (nextHour !== undefined) {
      setSelectedForecastHour(nextHour);
    }
  };

  const forecastLabel = selectedForecastHour !== null ? `${selectedForecastHour}h` : '—';

  const handleRoute = async () => {
    if (selectedForecastHour === null) {
      setRouteError('Select a forecast hour first.');
      return;
    }

    setRouteStatus('loading');
    setRouteError(null);

    try {
      const response = await fetch('/api/gfs/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start: DEFAULT_START,
          finish: DEFAULT_FINISH,
          polarTable,
          startForecastHour: selectedForecastHour
        })
      });

      const data = (await response.json()) as RouteResponse;
      if (!response.ok || data.status !== 'ok' || !data.route) {
        throw new Error(data.message ?? `Routing failed with status ${response.status}.`);
      }

      setRoute(data.route);
      setRouteStatus('done');
    } catch (err) {
      setRoute(null);
      setRouteStatus('idle');
      setRouteError(err instanceof Error ? err.message : 'Unable to compute route.');
    }
  };

  const closestApproachNm = route?.properties?.closestApproachMeters
    ? route.properties.closestApproachMeters / 1852
    : null;

  return (
    <section className="routing-panel" aria-label="Routing controls">
      <div className="routing-panel__section">
        <div className="routing-panel__header">
          <h3 className="routing-panel__title">Wind Forecast</h3>
          <span className="routing-panel__value">{forecastLabel}</span>
        </div>

        {loading && <p className="routing-panel__status">Loading wind data…</p>}
        {!loading && error && <p className="routing-panel__status routing-panel__status--error">{error}</p>}

        {!loading && !error && forecastHours.length > 0 && (
          <div className="routing-panel__slider">
            <label className="routing-panel__label" htmlFor="forecast-hour">
              Forecast hour
            </label>
            <input
              id="forecast-hour"
              type="range"
              min={0}
              max={Math.max(0, forecastHours.length - 1)}
              value={sliderIndex}
              onChange={handleSliderChange}
              className="routing-panel__input"
            />
            <div className="routing-panel__ticks">
              {forecastHours.map((hour, index) => (
                <span
                  key={hour}
                  className={
                    index === sliderIndex
                      ? 'routing-panel__tick routing-panel__tick--active'
                      : 'routing-panel__tick'
                  }
                >
                  {hour}h
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="routing-panel__section">
        <div className="routing-panel__header">
          <h3 className="routing-panel__title">Polars</h3>
        </div>
        <div className="routing-panel__polar">
          <PolarEditor />
        </div>
      </div>

      <div className="routing-panel__section">
        <div className="routing-panel__header">
          <h3 className="routing-panel__title">Route</h3>
        </div>
        <div className="routing-panel__summary">
          <div>
            <span className="routing-panel__label">Start</span>
            <span className="routing-panel__value">
              {DEFAULT_START.lat.toFixed(2)}, {DEFAULT_START.lon.toFixed(2)}
            </span>
          </div>
          <div>
            <span className="routing-panel__label">Finish</span>
            <span className="routing-panel__value">
              {DEFAULT_FINISH.lat.toFixed(2)}, {DEFAULT_FINISH.lon.toFixed(2)}
            </span>
          </div>
        </div>

        <button
          type="button"
          className="routing-panel__button"
          onClick={handleRoute}
          disabled={routeStatus === 'loading'}
        >
          {routeStatus === 'loading' ? 'Routing…' : 'Compute route'}
        </button>

        {routeError && <p className="routing-panel__status routing-panel__status--error">{routeError}</p>}

        {route && route.properties && (
          <div className="routing-panel__summary">
            <div>
              <span className="routing-panel__label">ETA</span>
              <span className="routing-panel__value">
                {new Date(route.properties.eta).toLocaleString()}
              </span>
            </div>
            <div>
              <span className="routing-panel__label">Duration</span>
              <span className="routing-panel__value">
                {route.properties.durationHours.toFixed(1)} h
              </span>
            </div>
            <div>
              <span className="routing-panel__label">Distance</span>
              <span className="routing-panel__value">
                {route.properties.distanceNm.toFixed(1)} nm
              </span>
            </div>
            {Number.isFinite(route.properties.nodesExpanded) && (
              <div>
                <span className="routing-panel__label">Grid points analyzed</span>
                <span className="routing-panel__value">
                  {route.properties.nodesExpanded.toLocaleString()}
                </span>
              </div>
            )}
            {!route.properties.arrived && closestApproachNm !== null && (
              <div>
                <span className="routing-panel__label">Status</span>
                <span className="routing-panel__value">
                  Partial route (closest approach: {closestApproachNm.toFixed(1)} nm)
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export default RoutingPanel;