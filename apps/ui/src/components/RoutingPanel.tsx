import { useEffect, useMemo, useState } from 'react';
import { useWindStore } from '../store/wind';

type WindMetaResponse = {
  status: string;
  forecastHours?: number[];
};

function RoutingPanel() {
  const forecastHours = useWindStore((state) => state.forecastHours);
  const selectedForecastHour = useWindStore((state) => state.selectedForecastHour);
  const setForecastHours = useWindStore((state) => state.setForecastHours);
  const setSelectedForecastHour = useWindStore((state) => state.setSelectedForecastHour);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load wind metadata.');
      } finally {
        setLoading(false);
      }
    };

    loadMeta();
  }, [setForecastHours]);

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
    </section>
  );
}

export default RoutingPanel;