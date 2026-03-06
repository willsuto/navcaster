import { useEffect, useState } from 'react';
import Map from './components/Map';

type HealthResponse = {
  status: string;
  timestamp: string;
};

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <>
      <Map />

      {/* <div className="app-foreground">
        <main className="container app-shell">
          <h1 className="app-title">Navcaster</h1>
          <p className="app-subtitle">React + TypeScript frontend talking to Node/Express backend.</p>

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
        </main>
      </div> */}
    </>
  );
}

export default App;