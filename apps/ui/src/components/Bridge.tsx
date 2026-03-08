import type { Vessel } from '../store/aisVessels';

type HealthResponse = {
  status: string;
  timestamp: string;
};

type BridgeProps = {
  oceanus?: Vessel;
  health: HealthResponse | null;
  loading: boolean;
  error: string | null;
};

function Bridge({ oceanus, health, loading, error }: BridgeProps) {
  const commsStatus = error
    ? 'Error'
    : loading
      ? 'Checking'
      : health?.status ?? 'Unknown';
  const commsToneClass = error
    ? 'bridge-metric__value--danger'
    : loading
      ? 'bridge-metric__value--info'
      : health
        ? 'bridge-metric__value--success'
        : 'bridge-metric__value--muted';

  return (
    <section className="bridge-metrics" aria-label="Bridge telemetry">
      <div className="bridge-metric">
        <span className="bridge-metric__label">COG (°)</span>
        <span className="bridge-metric__value bridge-metric__value--numeric">
          {oceanus?.cog?.toFixed(1) ?? '—'}
        </span>
      </div>
      <div className="bridge-metric">
        <span className="bridge-metric__label">SOG (kts)</span>
        <span className="bridge-metric__value bridge-metric__value--numeric">
          {oceanus?.sog?.toFixed(2) ?? '—'}
        </span>
      </div>
      <div className="bridge-metric">
        <span className="bridge-metric__label">Roll (°)</span>
        <span className="bridge-metric__value bridge-metric__value--numeric">
          {oceanus?.roll?.toFixed(2) ?? '—'}
        </span>
      </div>
      <div className="bridge-metric">
        <span className="bridge-metric__label">Comms</span>
        <span className={`bridge-metric__value ${commsToneClass}`}>{commsStatus}</span>
      </div>
      <div className="bridge-metric">
        <span className="bridge-metric__label">Lat</span>
        <span className="bridge-metric__value bridge-metric__value--numeric">
          {oceanus?.latitude?.toFixed(5) ?? '—'}
        </span>
      </div>
      <div className="bridge-metric">
        <span className="bridge-metric__label">Lon</span>
        <span className="bridge-metric__value bridge-metric__value--numeric">
          {oceanus?.longitude?.toFixed(5) ?? '—'}
        </span>
      </div>
    </section>
  );
}

export default Bridge;