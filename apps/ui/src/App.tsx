import { useEffect, useRef, useState } from 'react';
import Map from './components/Map';
import PanelWindow from './components/PanelWindow';
import { useAisSocket } from './hooks/useAisSocket';
import { useOceanusTelemetryLogger } from './hooks/useOceanusTelemetryLogger';
import { useAisVesselStore } from './store/aisVessels';

type PanelKey = 'telemetry' | 'routing' | 'riskAnalysis' | 'layers';

type HealthResponse = {
  status: string;
  timestamp: string;
};

const OCEANUS_MMSI = 999000001;

const panelDefinitions: { key: PanelKey; label: string }[] = [
  { key: 'telemetry', label: 'Telemetry' },
  { key: 'routing', label: 'Routing' },
  { key: 'riskAnalysis', label: 'Risk Analysis' },
  { key: 'layers', label: 'Layers' }
];

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openPanels, setOpenPanels] = useState<Record<PanelKey, boolean>>({
    telemetry: false,
    routing: false,
    riskAnalysis: false,
    layers: false
  });
  const lastLogRef = useRef(0);
  const upsertVessel = useAisVesselStore((state) => state.upsertVessel);
  const oceanus = useAisVesselStore((state) => state.vessels[String(OCEANUS_MMSI)]);

  useOceanusTelemetryLogger();

  useAisSocket({
    onVesselUpdate: (update) => {
      upsertVessel(update);
      const now = Date.now();
      if (now - lastLogRef.current < 2000) return;
      lastLogRef.current = now;
      // eslint-disable-next-line no-console
      console.log('[AIS] vessel update', update);
    },
    onStreamStatus: (status) => {
      // eslint-disable-next-line no-console
      console.log('[AIS] stream status', status);
    }
  });

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await fetch('/api/health');

        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`);
        }

        const data = (await res.json()) as HealthResponse;
        setHealth(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchHealth();
  }, []);

  const togglePanel = (panelKey: PanelKey) => {
    setOpenPanels((current) => ({
      ...current,
      [panelKey]: !current[panelKey]
    }));
  };

  return (
    <>
      <Map />

      <div className="app-foreground panel-host" aria-label="Panel host">
        <aside className="left-sidebar" aria-label="Panel controls">
          {panelDefinitions.map((panel) => (
            <button
              key={panel.key}
              type="button"
              className={`sidebar-button${openPanels[panel.key] ? ' sidebar-button--active' : ''}`}
              onClick={() => togglePanel(panel.key)}
              aria-pressed={openPanels[panel.key]}
            >
              {panel.label}
            </button>
          ))}
        </aside>

        {openPanels.telemetry && (
          <PanelWindow title="Telemetry" initialX={96} initialY={24} initialWidth={420} initialHeight={260}>
            <section className="status-card">
              <h2 className="status-card__title">Backend Health</h2>
              {loading && <p className="status-message status-message--info">Checking backend...</p>}
              {error && <p className="status-message status-message--error">Error: {error}</p>}
              {health && (
                <div className="status-details">
                  <p className="status-row">
                    <strong className="status-label">Status:</strong>{' '}
                    <span className="status-value status-value--success">{health.status}</span>
                  </p>
                  <p className="status-row">
                    <strong className="status-label">Timestamp:</strong>{' '}
                    <span className="status-value">{new Date(health.timestamp).toLocaleString()}</span>
                  </p>
                </div>
              )}
            </section>

            <section className="status-card">
              <h2 className="status-card__title">Oceanus Telemetry</h2>
              {!oceanus && <p className="status-message status-message--info">Awaiting Oceanus telemetry...</p>}
              {oceanus && (
                <div className="status-details">
                  <p className="status-row">
                    <strong className="status-label">Lat/Lon:</strong>{' '}
                    <span className="status-value">
                      {oceanus.latitude?.toFixed(5) ?? '—'}, {oceanus.longitude?.toFixed(5) ?? '—'}
                    </span>
                  </p>
                  <p className="status-row">
                    <strong className="status-label">COG:</strong>{' '}
                    <span className="status-value">{oceanus.cog?.toFixed(1) ?? '—'}°</span>
                  </p>
                  <p className="status-row">
                    <strong className="status-label">SOG:</strong>{' '}
                    <span className="status-value">{oceanus.sog?.toFixed(2) ?? '—'} kts</span>
                  </p>
                  <p className="status-row">
                    <strong className="status-label">Roll:</strong>{' '}
                    <span className="status-value">{oceanus.roll?.toFixed(2) ?? '—'}°</span>
                  </p>
                  <p className="status-row">
                    <strong className="status-label">Last Seen:</strong>{' '}
                    <span className="status-value">
                      {new Date(oceanus.lastSeen).toLocaleTimeString()}
                    </span>
                  </p>
                </div>
              )}
            </section>
          </PanelWindow>
        )}

        {openPanels.routing && (
          <PanelWindow title="Routing" initialX={120} initialY={64} initialWidth={360} initialHeight={240}>
            <section className="panel-placeholder">
              <h3 className="panel-placeholder__title">Route Planner</h3>
              <p className="panel-placeholder__text">
                Configure route waypoints, constraints, and optimization profiles.
              </p>
            </section>
          </PanelWindow>
        )}

        {openPanels.riskAnalysis && (
          <PanelWindow title="Risk Analysis" initialX={144} initialY={104} initialWidth={360} initialHeight={240}>
            <section className="panel-placeholder">
              <h3 className="panel-placeholder__title">Risk Assessment</h3>
              <p className="panel-placeholder__text">
                Inspect hazards, weather impact, and no-fly zone conflicts.
              </p>
            </section>
          </PanelWindow>
        )}

        {openPanels.layers && (
          <PanelWindow title="Layers" initialX={168} initialY={144} initialWidth={340} initialHeight={220}>
            <section className="panel-placeholder">
              <h3 className="panel-placeholder__title">Map Layers</h3>
              <p className="panel-placeholder__text">
                Toggle overlays such as terrain, traffic, weather, and coverage.
              </p>
            </section>
          </PanelWindow>
        )}
      </div>
    </>
  );
}

export default App;