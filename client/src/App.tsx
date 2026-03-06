import { AppProvider } from './store/AppContext';
import { useData } from './hooks/useData';
import MapView from './components/MapView/MapView';
import ControlPanel from './components/ControlPanel/ControlPanel';
import VesselPanel from './components/VesselPanel/VesselPanel';
import AlertPanel from './components/AlertPanel/AlertPanel';
import { useAppContext } from './store/AppContext';

function AppContent() {
  useData();
  const { state } = useAppContext();

  if (state.loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Loading maritime data...</p>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="error-screen">
        <h2>⚠️ Connection Error</h2>
        <p>{state.error}</p>
        <p>Please ensure the Navcaster server is running on port 3001.</p>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="header-logo">
          <span className="logo-icon">⚓</span>
          <span className="logo-text">NavCaster</span>
          <span className="logo-sub">Maritime Weather Intelligence</span>
        </div>
        <div className="header-stats">
          <div className="stat">
            <span className="stat-value">{state.vessels.length}</span>
            <span className="stat-label">Vessels</span>
          </div>
          <div className="stat">
            <span className="stat-value critical">{state.alerts.filter(a => !a.acknowledged && a.severity === 'critical').length}</span>
            <span className="stat-label">Critical Alerts</span>
          </div>
          <div className="stat">
            <span className="stat-value warning">{state.risks.filter(r => r.goNoGo.decision === 'NO-GO').length}</span>
            <span className="stat-label">NO-GO</span>
          </div>
        </div>
      </header>

      <div className="app-body">
        <aside className="left-sidebar">
          <ControlPanel />
          <AlertPanel />
        </aside>

        <main className="map-area">
          <MapView />
        </main>

        <aside className="right-sidebar">
          <VesselPanel />
        </aside>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
