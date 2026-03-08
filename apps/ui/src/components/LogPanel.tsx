import { useEffect, useMemo, useRef, useState } from 'react';
import { selectOceanusTelemetry, useAisTelemetryLogStore } from '../store/aisTelemetryLog';

const AUTO_SCROLL_THRESHOLD_PX = 32;
const RETENTION_MINUTES = 30;
const GRAPH_WINDOW_MINUTES = 5;
const GRAPH_WINDOW_MS = GRAPH_WINDOW_MINUTES * 60 * 1000;
const GRAPH_WIDTH = 720;
const GRAPH_HEIGHT = 86;

const formatTime = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

const formatNumber = (value: number | undefined, digits: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '—';

type TelemetryGraphSample = {
  t: number;
  value?: number;
};

const buildGraphPath = (
  samples: TelemetryGraphSample[],
  start: number,
  end: number,
  width: number,
  height: number
) => {
  const defined = samples.filter((sample) => typeof sample.value === 'number');
  if (defined.length === 0) {
    return '';
  }

  let min = Math.min(...defined.map((sample) => sample.value as number));
  let max = Math.max(...defined.map((sample) => sample.value as number));
  if (min === max) {
    min -= 1;
    max += 1;
  }

  const range = max - min;
  const window = Math.max(end - start, 1);
  let path = '';
  let started = false;

  samples.forEach((sample) => {
    if (typeof sample.value !== 'number') {
      started = false;
      return;
    }

    const x = ((sample.t - start) / window) * width;
    const y = height - ((sample.value - min) / range) * height;
    path += `${started ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)} `;
    started = true;
  });

  return path.trim();
};

function LogPanel() {
  const telemetry = useAisTelemetryLogStore(selectOceanusTelemetry);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [viewMode, setViewMode] = useState<'table' | 'graph'>('table');

  const entryCount = telemetry.length;
  const rows = useMemo(() => telemetry, [telemetry]);

  useEffect(() => {
    if (!autoScroll || viewMode !== 'table') return;
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [autoScroll, entryCount, viewMode]);

  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    setAutoScroll(distanceFromBottom <= AUTO_SCROLL_THRESHOLD_PX);
  };

  const graphData = useMemo(() => {
    const now = Date.now();
    const start = now - GRAPH_WINDOW_MS;
    const filtered = telemetry.filter((entry) => entry.t >= start);

    let lastCog: number | undefined;
    let lastUnwrapped: number | undefined;

    const samples = filtered.map((entry) => {
      let cogUnwrapped: number | undefined;
      if (typeof entry.cog === 'number' && Number.isFinite(entry.cog)) {
        if (typeof lastCog === 'number' && typeof lastUnwrapped === 'number') {
          let delta = entry.cog - lastCog;
          if (delta > 180) delta -= 360;
          if (delta < -180) delta += 360;
          cogUnwrapped = lastUnwrapped + delta;
        } else {
          cogUnwrapped = entry.cog;
        }
        lastCog = entry.cog;
        lastUnwrapped = cogUnwrapped;
      }

      return {
        t: entry.t,
        sog: entry.sog,
        roll: entry.roll,
        cogUnwrapped
      };
    });

    return { start, end: now, samples };
  }, [telemetry]);
  return (
    <div className="telemetry-log">
      <header className="telemetry-log__header">
        <div>
          <div className="telemetry-log__title">Oceanus Log</div>
          <div className="telemetry-log__meta">
            Entries: {entryCount} (last {RETENTION_MINUTES} min)
          </div>
        </div>
        <div className="telemetry-log__view-toggle" role="group" aria-label="Log view">
          <button
            type="button"
            className={`telemetry-log__toggle-button ${
              viewMode === 'table' ? 'telemetry-log__toggle-button--active' : ''
            }`}
            onClick={() => setViewMode('table')}
          >
            Table
          </button>
          <button
            type="button"
            className={`telemetry-log__toggle-button ${
              viewMode === 'graph' ? 'telemetry-log__toggle-button--active' : ''
            }`}
            onClick={() => setViewMode('graph')}
          >
            Graph
          </button>
        </div>
      </header>

      {viewMode === 'table' ? (
        <div className="telemetry-log__table-wrapper" ref={containerRef} onScroll={handleScroll}>
          <table className="telemetry-log__table">
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Lat</th>
                <th scope="col">Lon</th>
                <th scope="col">COG</th>
                <th scope="col">SOG</th>
                <th scope="col">Roll</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr className="telemetry-log__empty">
                  <td colSpan={6}>Awaiting telemetry samples...</td>
                </tr>
              )}
              {rows.map((entry) => (
                <tr key={entry.t}>
                  <td>{formatTime(entry.t)}</td>
                  <td>{formatNumber(entry.latitude, 5)}</td>
                  <td>{formatNumber(entry.longitude, 5)}</td>
                  <td>{formatNumber(entry.cog, 1)}</td>
                  <td>{formatNumber(entry.sog, 2)}</td>
                  <td>{formatNumber(entry.roll, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div ref={bottomRef} />
        </div>
      ) : (
        <div className="telemetry-log__graphs">
          {graphData.samples.length === 0 ? (
            <div className="telemetry-log__graph-empty">
              Awaiting telemetry samples in the last {GRAPH_WINDOW_MINUTES} minutes...
            </div>
          ) : (
            [
              {
                key: 'sog',
                label: 'SOG (kn)',
                values: graphData.samples.map((sample) => ({
                  t: sample.t,
                  value: sample.sog
                }))
              },
              {
                key: 'cog',
                label: 'COG (° unwrapped)',
                values: graphData.samples.map((sample) => ({
                  t: sample.t,
                  value: sample.cogUnwrapped
                }))
              },
              {
                key: 'roll',
                label: 'Roll (°)',
                values: graphData.samples.map((sample) => ({
                  t: sample.t,
                  value: sample.roll
                }))
              }
            ].map((series) => {
              const path = buildGraphPath(
                series.values,
                graphData.start,
                graphData.end,
                GRAPH_WIDTH,
                GRAPH_HEIGHT
              );

              return (
                <div className="telemetry-log__graph" key={series.key}>
                  <div className="telemetry-log__graph-header">
                    <span className="telemetry-log__graph-label">{series.label}</span>
                  </div>
                  <svg
                    className="telemetry-log__graph-svg"
                    viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
                    role="img"
                    aria-label={`${series.label} last ${GRAPH_WINDOW_MINUTES} minutes`}
                  >
                    <path className="telemetry-log__graph-line" d={path} />
                  </svg>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export default LogPanel;