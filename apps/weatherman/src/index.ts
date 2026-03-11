import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { downloadForecastHours, findLatestCycle } from './gfs/fetch';
import type { BoundingBox, DownloadStatus } from './gfs/types';
import {
  listAvailableCycles,
  listForecastFiles,
  listForecastHours,
  getForecastFilePath
} from './gfs/storage';
import { WindStore } from './gfs/wind/WindStore';
import { computeIsochroneRoute, type PolarTable } from './routing/isochroneRouter';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3002;

app.use(cors());
app.use(express.json());

const parseForecastHours = (value?: string) => {
  if (!value) return undefined;
  return value
    .split(',')
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isFinite(entry));
};

const parseBoundingBox = (value?: string): BoundingBox => {
  if (!value) {
    throw new Error('GFS_BBOX is required and must be "leftLon,rightLon,topLat,bottomLat"');
  }
  const parts = value.split(',').map((entry) => Number(entry.trim()));
  if (parts.length !== 4 || parts.some((entry) => !Number.isFinite(entry))) {
    throw new Error('GFS_BBOX must be "leftLon,rightLon,topLat,bottomLat" with valid numbers');
  }
  const [leftLon, rightLon, topLat, bottomLat] = parts;
  return { leftLon, rightLon, topLat, bottomLat };
};

const defaultForecastHours = Array.from({ length: 17 }, (_, index) => index * 3);
const forecastHours = parseForecastHours(process.env.GFS_FORECAST_HOURS) ?? defaultForecastHours;
const bbox = parseBoundingBox(process.env.GFS_BBOX);
const pollMinutes = Number(process.env.GFS_POLL_MINUTES ?? '0');

const status: DownloadStatus = {
  forecastHours: [],
  inProgress: false
};
const windStore = new WindStore();

const loadWindStore = async (cycle: { date: string; cycle: string }) => {
  const hours = await listForecastHours(cycle);
  if (!hours.length) {
    throw new Error(`No forecast hours found for ${cycle.date} ${cycle.cycle}z.`);
  }
  await windStore.loadCycle(cycle, hours);
};

const runDownload = async () => {
  if (status.inProgress) return;
  status.inProgress = true;
  status.lastError = undefined;
  try {
    const cycle = await findLatestCycle(bbox);
    status.cycle = cycle;
    const { downloaded, skipped } = await downloadForecastHours(cycle, forecastHours, bbox);
    status.forecastHours = Array.from(new Set([...downloaded, ...skipped])).sort((a, b) => a - b);
    status.lastDownloadAt = new Date().toISOString();
    await loadWindStore(cycle);
  } catch (error) {
    status.lastError = error instanceof Error ? error.message : String(error);
  } finally {
    status.inProgress = false;
  }
};

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/gfs/status', async (_req, res) => {
  const hours = status.cycle ? await listForecastHours(status.cycle) : [];
  res.json({
    status: 'ok',
    cycle: status.cycle,
    bbox,
    forecastHours: hours,
    lastDownloadAt: status.lastDownloadAt,
    inProgress: status.inProgress,
    lastError: status.lastError
  });
});

app.get('/api/gfs/files', async (_req, res) => {
  if (!status.cycle) {
    res.status(404).json({ status: 'error', message: 'No cycle selected yet.' });
    return;
  }
  const files = await listForecastFiles(status.cycle);
  res.json({
    status: 'ok',
    cycle: status.cycle,
    files
  });
});

app.get('/api/gfs/file', async (req, res) => {
  if (!status.cycle) {
    res.status(404).json({ status: 'error', message: 'No cycle selected yet.' });
    return;
  }
  const forecastHour = Number(req.query.fh);
  if (!Number.isFinite(forecastHour)) {
    res.status(400).json({ status: 'error', message: 'Provide fh query param (e.g. fh=3).' });
    return;
  }
  const filePath = getForecastFilePath(status.cycle, forecastHour);
  res.sendFile(path.resolve(filePath), (error) => {
    if (error) {
      res.status(404).json({ status: 'error', message: 'File not found.' });
    }
  });
});

app.get('/api/gfs/wind/meta', (_req, res) => {
  res.json({ status: 'ok', ...windStore.getMeta() });
});

app.get('/api/gfs/wind/query', (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    res.status(400).json({ status: 'error', message: 'Provide lat/lon query params.' });
    return;
  }

  const forecastHour = req.query.fh !== undefined ? Number(req.query.fh) : undefined;
  const time = typeof req.query.t === 'string' ? req.query.t : undefined;
  if (forecastHour === undefined && !time) {
    res.status(400).json({ status: 'error', message: 'Provide fh or t query param.' });
    return;
  }
  if (forecastHour !== undefined && !Number.isFinite(forecastHour)) {
    res.status(400).json({ status: 'error', message: 'fh must be a number.' });
    return;
  }

  const result = windStore.query({ lat, lon, forecastHour, time });
  if (!result) {
    res.status(404).json({ status: 'error', message: 'Wind data not available for query.' });
    return;
  }

  res.json({ status: 'ok', ...result });
});

app.get('/api/gfs/wind/vectors', (req, res) => {
  const forecastHour = Number(req.query.fh);
  const stepParam = req.query.step;

  if (!Number.isFinite(forecastHour)) {
    res.status(400).json({ status: 'error', message: 'Provide fh query param (e.g. fh=3).' });
    return;
  }

  const step = stepParam === undefined ? 1 : Number(stepParam);
  if (!Number.isFinite(step) || step <= 0) {
    res.status(400).json({ status: 'error', message: 'step must be a positive number.' });
    return;
  }

  const result = windStore.getVectors(forecastHour, step);
  if (!result) {
    res.status(404).json({ status: 'error', message: 'Wind vectors not available.' });
    return;
  }

  res.json({ status: 'ok', ...result });
});

app.post('/api/gfs/route', async (req, res) => {
  if (!windStore.isReady()) {
    res.status(503).json({ status: 'error', message: 'Wind data not ready yet.' });
    return;
  }

  const { start, finish, polarTable, startForecastHour, startTime, dtMinutes, headingStepDeg, maxHours, maxFrontier, arrivalRadiusMeters } =
    (req.body ?? {}) as {
      start?: { lat?: number; lon?: number };
      finish?: { lat?: number; lon?: number };
      polarTable?: PolarTable;
      startForecastHour?: number;
      startTime?: string;
      dtMinutes?: number;
      headingStepDeg?: number;
      maxHours?: number;
      maxFrontier?: number;
      arrivalRadiusMeters?: number;
    };

  const startLat = start?.lat;
  const startLon = start?.lon;
  const finishLat = finish?.lat;
  const finishLon = finish?.lon;

  if (!Number.isFinite(startLat) || !Number.isFinite(startLon)) {
    res.status(400).json({ status: 'error', message: 'Provide start lat/lon.' });
    return;
  }
  if (!Number.isFinite(finishLat) || !Number.isFinite(finishLon)) {
    res.status(400).json({ status: 'error', message: 'Provide finish lat/lon.' });
    return;
  }
  if (!polarTable || typeof polarTable !== 'object') {
    res.status(400).json({ status: 'error', message: 'Provide polarTable.' });
    return;
  }

  const startLatValue = Number(startLat);
  const startLonValue = Number(startLon);
  const finishLatValue = Number(finishLat);
  const finishLonValue = Number(finishLon);

  let resolvedStartTime = startTime;
  if (!resolvedStartTime) {
    if (!Number.isFinite(startForecastHour)) {
      res.status(400).json({ status: 'error', message: 'Provide startTime or startForecastHour.' });
      return;
    }
    const meta = windStore.getMeta();
    if (!meta.cycle) {
      res.status(400).json({ status: 'error', message: 'Wind cycle not loaded.' });
      return;
    }
    const cycleStart = Date.UTC(
      Number(meta.cycle.date.slice(0, 4)),
      Number(meta.cycle.date.slice(4, 6)) - 1,
      Number(meta.cycle.date.slice(6, 8)),
      Number(meta.cycle.cycle)
    );
    const forecastHourValue = Number(startForecastHour);
    resolvedStartTime = new Date(cycleStart + forecastHourValue * 60 * 60 * 1000).toISOString();
  }

  const result = await computeIsochroneRoute(windStore, {
    start: { lat: startLatValue, lon: startLonValue },
    finish: { lat: finishLatValue, lon: finishLonValue },
    polarTable,
    startTime: resolvedStartTime,
    dtMinutes: Number.isFinite(dtMinutes) ? Math.max(1, Number(dtMinutes)) : 10,
    headingStepDeg: Number.isFinite(headingStepDeg) ? Math.max(1, Number(headingStepDeg)) : 5,
    maxHours: Number.isFinite(maxHours) ? Math.max(1, Number(maxHours)) : 120,
    maxFrontier: Number.isFinite(maxFrontier) ? Math.max(50, Number(maxFrontier)) : 600,
    arrivalRadiusMeters: Number.isFinite(arrivalRadiusMeters) ? Math.max(100, Number(arrivalRadiusMeters)) : 20000
  });

  if (!result) {
    res.status(400).json({
      status: 'error',
      message: 'Unable to compute route. Check start time/forecast hour and wind availability.'
    });
    return;
  }

  const coordinates = result.pathIndices.map((index) => {
    const node = result.nodes[index];
    return [node.lon, node.lat];
  });
  const waypoints = result.pathIndices.map((index) => {
    const node = result.nodes[index];
    return { lon: node.lon, lat: node.lat, timeMs: node.timeMs };
  });
  coordinates.push([finishLonValue, finishLatValue]);

  res.json({
    status: 'ok',
    route: {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates
      },
      properties: {
        durationHours: result.durationHours,
        distanceNm: result.distanceNm,
        eta: result.eta,
        iterations: result.iterations,
        nodesExpanded: result.nodesExpanded,
        frontierMax: result.frontierMax,
        arrived: result.arrived,
        closestApproachMeters: result.closestApproachMeters,
        terminationReason: result.terminationReason,
        waypoints
      }
    }
  });
});

app.post('/api/gfs/wind/reload', async (req, res) => {
  try {
    const date = typeof req.query.date === 'string' ? req.query.date : undefined;
    const cycleParam = typeof req.query.cycle === 'string' ? req.query.cycle : undefined;
    const latest = req.query.latest === '1' || req.query.latest === 'true';

    let cycle = status.cycle;
    if (latest) {
      const cycles = await listAvailableCycles();
      cycle = cycles[0];
    } else if (date && cycleParam) {
      cycle = { date, cycle: cycleParam };
    }

    if (!cycle) {
      res.status(400).json({ status: 'error', message: 'Provide date+cycle or latest=1.' });
      return;
    }

    await loadWindStore(cycle);
    status.cycle = cycle;
    status.forecastHours = await listForecastHours(cycle);

    res.json({ status: 'ok', cycle, forecastHours: status.forecastHours });
  } catch (error) {
    res
      .status(500)
      .json({ status: 'error', message: error instanceof Error ? error.message : String(error) });
  }
});

app.get('/', (_req, res) => {
  res.send('Weatherman backend is running.');
});

runDownload();

if (pollMinutes > 0) {
  setInterval(runDownload, pollMinutes * 60 * 1000);
}

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Weatherman listening on http://localhost:${PORT}`);
});