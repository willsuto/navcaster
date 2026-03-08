import { useEffect, useRef, useState } from 'react';
import Bridge from './components/Bridge';
import LayerPanel from './components/LayerPanel';
import LogPanel from './components/LogPanel';
import Map from './components/Map';
import PanelWindow from './components/PanelWindow';
import { useAisSocket } from './hooks/useAisSocket';
import { useOceanusTelemetryLogger } from './hooks/useOceanusTelemetryLogger';
import { useAisVesselStore } from './store/aisVessels';

type PanelKey = 'telemetry' | 'routing' | 'layers' | 'log';

type HealthResponse = {
  status: string;
  timestamp: string;
};

const OCEANUS_MMSI = 999000001;

const panelDefinitions: { key: PanelKey; label: string }[] = [
  { key: 'telemetry', label: 'Bridge' },
  { key: 'log', label: 'Log' },
  { key: 'routing', label: 'Routing' },
  { key: 'layers', label: 'Layers' }
];

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openPanels, setOpenPanels] = useState<Record<PanelKey, boolean>>({
    telemetry: false,
    log: false,
    routing: false,
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

  const closePanel = (panelKey: PanelKey) => {
    setOpenPanels((current) => ({
      ...current,
      [panelKey]: false
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
          <PanelWindow
            title="Bridge"
            initialX={96}
            initialY={24}
            initialWidth={420}
            initialHeight={260}
            onClose={() => closePanel('telemetry')}
          >
            <Bridge oceanus={oceanus} health={health} loading={loading} error={error} />
          </PanelWindow>
        )}

        {openPanels.log && (
          <PanelWindow
            title="Log"
            initialX={112}
            initialY={52}
            initialWidth={520}
            initialHeight={320}
            onClose={() => closePanel('log')}
          >
            <LogPanel />
          </PanelWindow>
        )}

        {openPanels.routing && (
          <PanelWindow
            title="Routing"
            initialX={120}
            initialY={64}
            initialWidth={360}
            initialHeight={240}
            onClose={() => closePanel('routing')}
          >
            <section className="panel-placeholder">
              <h3 className="panel-placeholder__title">Route Planner</h3>
              <p className="panel-placeholder__text">
                Configure route waypoints, constraints, and optimization profiles.
              </p>
            </section>
          </PanelWindow>
        )}

        {openPanels.layers && (
          <PanelWindow
            title="Layers"
            initialX={168}
            initialY={144}
            initialWidth={340}
            initialHeight={220}
            onClose={() => closePanel('layers')}
          >
            <LayerPanel />
          </PanelWindow>
        )}
      </div>
    </>
  );
}

export default App;