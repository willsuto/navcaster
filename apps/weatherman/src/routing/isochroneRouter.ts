import type { WindStore } from '../gfs/wind/WindStore';

const EARTH_RADIUS_METERS = 6371000;
const KNOTS_TO_MS = 0.514444;

export type LatLon = {
  lat: number;
  lon: number;
};

export type PolarTable = Record<number, Record<number, number>>;

export type RouteRequest = {
  start: LatLon;
  finish: LatLon;
  polarTable: PolarTable;
  startTime: string;
  dtMinutes: number;
  headingStepDeg: number;
  maxHours: number;
  maxFrontier: number;
  arrivalRadiusMeters: number;
};

export type RouteNode = {
  lat: number;
  lon: number;
  timeMs: number;
  parentIndex: number | null;
  distanceFromStartMeters: number;
  distanceToFinishMeters: number;
};

export type RouteResult = {
  nodes: RouteNode[];
  pathIndices: number[];
  durationHours: number;
  distanceNm: number;
  eta: string;
  iterations: number;
  frontierMax: number;
  arrived: boolean;
  closestApproachMeters: number;
  terminationReason: 'arrived' | 'no-wind' | 'max-steps' | 'stalled';
};

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;

const normalizeLon = (lon: number) => {
  const normalized = ((lon + 180) % 360 + 360) % 360 - 180;
  return normalized === -180 ? 180 : normalized;
};

const distanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const fromLat = toRadians(lat1);
  const toLat = toRadians(lat2);

  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);

  const a = sinLat * sinLat + Math.cos(fromLat) * Math.cos(toLat) * sinLon * sinLon;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
};

const bearingDegrees = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const fromLat = toRadians(lat1);
  const toLat = toRadians(lat2);
  const dLon = toRadians(lon2 - lon1);

  const y = Math.sin(dLon) * Math.cos(toLat);
  const x = Math.cos(fromLat) * Math.sin(toLat) - Math.sin(fromLat) * Math.cos(toLat) * Math.cos(dLon);
  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
};

const destinationPoint = (lat: number, lon: number, bearingDeg: number, distance: number) => {
  const angularDistance = distance / EARTH_RADIUS_METERS;
  const bearing = toRadians(bearingDeg);
  const fromLat = toRadians(lat);
  const fromLon = toRadians(lon);

  const sinLat = Math.sin(fromLat);
  const cosLat = Math.cos(fromLat);
  const sinAngular = Math.sin(angularDistance);
  const cosAngular = Math.cos(angularDistance);

  const destLat = Math.asin(sinLat * cosAngular + cosLat * sinAngular * Math.cos(bearing));
  const destLon = fromLon + Math.atan2(
    Math.sin(bearing) * sinAngular * cosLat,
    cosAngular - sinLat * Math.sin(destLat)
  );

  return {
    lat: toDegrees(destLat),
    lon: normalizeLon(toDegrees(destLon))
  };
};

const toDirection = (u: number, v: number) => {
  const radians = Math.atan2(u, v);
  const degrees = (radians * 180) / Math.PI;
  return (degrees + 360) % 360;
};

const normalizePolarTable = (table: PolarTable) => {
  const twsValues = Object.keys(table)
    .map((key) => Number(key))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);

  const rows = twsValues.map((tws) => {
    const row = table[tws] ?? {};
    const entries = Object.keys(row)
      .map((key) => Number(key))
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => a - b);
    const values = new Map<number, number>();
    for (const angle of entries) {
      values.set(angle, Number(row[angle]));
    }
    return { tws, angles: entries, values };
  });

  return { twsValues, rows };
};

const interpolateLinear = (x: number, x0: number, x1: number, y0: number, y1: number) => {
  if (x1 === x0) return y0;
  const t = (x - x0) / (x1 - x0);
  return y0 + (y1 - y0) * t;
};

const interpolateAngleRow = (angle: number, angles: number[], values: Map<number, number>) => {
  if (angles.length === 0) return 0;
  const clamped = Math.min(Math.max(angle, angles[0]), angles[angles.length - 1]);
  for (let i = 0; i < angles.length - 1; i += 1) {
    const a0 = angles[i];
    const a1 = angles[i + 1];
    if (clamped >= a0 && clamped <= a1) {
      const v0 = values.get(a0) ?? 0;
      const v1 = values.get(a1) ?? 0;
      return interpolateLinear(clamped, a0, a1, v0, v1);
    }
  }

  return values.get(angles[angles.length - 1]) ?? 0;
};

const lookupPolarSpeed = (tws: number, twa: number, table: PolarTable) => {
  const normalized = normalizePolarTable(table);
  if (normalized.twsValues.length === 0) return 0;

  const clampedTws = Math.min(
    Math.max(tws, normalized.twsValues[0]),
    normalized.twsValues[normalized.twsValues.length - 1]
  );

  for (let i = 0; i < normalized.twsValues.length - 1; i += 1) {
    const tws0 = normalized.twsValues[i];
    const tws1 = normalized.twsValues[i + 1];
    if (clampedTws >= tws0 && clampedTws <= tws1) {
      const row0 = normalized.rows.find((row) => row.tws === tws0);
      const row1 = normalized.rows.find((row) => row.tws === tws1);
      if (!row0 || !row1) return 0;
      const v0 = interpolateAngleRow(twa, row0.angles, row0.values);
      const v1 = interpolateAngleRow(twa, row1.angles, row1.values);
      return interpolateLinear(clampedTws, tws0, tws1, v0, v1);
    }
  }

  const last = normalized.rows[normalized.rows.length - 1];
  return interpolateAngleRow(twa, last.angles, last.values);
};

const computeTwa = (heading: number, windFrom: number) => {
  const diff = Math.abs(heading - windFrom) % 360;
  return diff > 180 ? 360 - diff : diff;
};

type PruneParams = {
  candidateIndices: number[];
  nodes: RouteNode[];
  start: LatLon;
  finish: LatLon;
  maxFrontier: number;
};

const pruneFrontier = ({ candidateIndices, nodes, start, finish, maxFrontier }: PruneParams) => {
  const bearingBinSize = 5;
  const keepByBearing = new Map<number, number>();
  const keepByFinishBearing = new Map<number, number>();

  for (const index of candidateIndices) {
    const node = nodes[index];
    const bearingFromStart = bearingDegrees(start.lat, start.lon, node.lat, node.lon);
    const startBin = Math.floor(bearingFromStart / bearingBinSize);
    const existing = keepByBearing.get(startBin);
    if (existing === undefined) {
      keepByBearing.set(startBin, index);
    } else if (nodes[existing].distanceFromStartMeters < node.distanceFromStartMeters) {
      keepByBearing.set(startBin, index);
    }

    const bearingToFinish = bearingDegrees(node.lat, node.lon, finish.lat, finish.lon);
    const finishBin = Math.floor(bearingToFinish / bearingBinSize);
    const existingFinish = keepByFinishBearing.get(finishBin);
    if (existingFinish === undefined) {
      keepByFinishBearing.set(finishBin, index);
    } else if (nodes[existingFinish].distanceToFinishMeters > node.distanceToFinishMeters) {
      keepByFinishBearing.set(finishBin, index);
    }
  }

  const combined = new Set<number>([...keepByBearing.values(), ...keepByFinishBearing.values()]);
  let trimmed = [...combined];

  if (trimmed.length > maxFrontier) {
    trimmed = trimmed
      .sort((a, b) => nodes[a].distanceToFinishMeters - nodes[b].distanceToFinishMeters)
      .slice(0, maxFrontier);
  }

  return trimmed;
};

export const computeIsochroneRoute = async (
  windStore: WindStore,
  request: RouteRequest
): Promise<RouteResult | null> => {
  const {
    start,
    finish,
    polarTable,
    startTime,
    dtMinutes,
    headingStepDeg,
    maxHours,
    maxFrontier,
    arrivalRadiusMeters
  } = request;

  const startTimeMs = Date.parse(startTime);
  if (Number.isNaN(startTimeMs)) return null;

  const dtMs = dtMinutes * 60 * 1000;
  const dtSeconds = dtMinutes * 60;
  const maxSteps = Math.ceil((maxHours * 60) / dtMinutes);
  const nodes: RouteNode[] = [];

  const startDistance = distanceMeters(start.lat, start.lon, finish.lat, finish.lon);
  nodes.push({
    lat: start.lat,
    lon: start.lon,
    timeMs: startTimeMs,
    parentIndex: null,
    distanceFromStartMeters: 0,
    distanceToFinishMeters: startDistance
  });

  let frontier: number[] = [0];
  let bestArrival: number | null = null;
  let bestSoFarIndex = 0;
  let bestSoFarDistance = startDistance;
  let terminationReason: RouteResult['terminationReason'] | null = null;
  let frontierMax = frontier.length;

  for (let step = 0; step < maxSteps; step += 1) {
    const nextCandidates: number[] = [];
    let sawWind = false;
    let producedCandidate = false;
    for (const nodeIndex of frontier) {
      const node = nodes[nodeIndex];
      const time = new Date(node.timeMs).toISOString();
      const wind = windStore.query({ lat: node.lat, lon: node.lon, time });
      if (!wind) continue;
      sawWind = true;

      const twsKts = Math.hypot(wind.u, wind.v) * 1.943844;
      const windTo = toDirection(wind.u, wind.v);
      const windFrom = (windTo + 180) % 360;

      for (let heading = 0; heading < 360; heading += headingStepDeg) {
        const twa = computeTwa(heading, windFrom);
        const speedKts = lookupPolarSpeed(twsKts, twa, polarTable);
        if (speedKts <= 0.2) continue;

        const distance = speedKts * KNOTS_TO_MS * dtSeconds;
        if (distance <= 1) continue;

        const next = destinationPoint(node.lat, node.lon, heading, distance);
        const distanceFromStart = distanceMeters(start.lat, start.lon, next.lat, next.lon);
        const distanceToFinish = distanceMeters(next.lat, next.lon, finish.lat, finish.lon);

        const nextIndex = nodes.push({
          lat: next.lat,
          lon: next.lon,
          timeMs: node.timeMs + dtMs,
          parentIndex: nodeIndex,
          distanceFromStartMeters: distanceFromStart,
          distanceToFinishMeters: distanceToFinish
        }) - 1;
        nextCandidates.push(nextIndex);
        producedCandidate = true;
        if (distanceToFinish < bestSoFarDistance) {
          bestSoFarDistance = distanceToFinish;
          bestSoFarIndex = nextIndex;
        }
      }
    }

    if (nextCandidates.length === 0) {
      terminationReason = sawWind || producedCandidate ? 'stalled' : 'no-wind';
      break;
    }

    for (const candidate of nextCandidates) {
      const node = nodes[candidate];
      if (node.distanceToFinishMeters <= arrivalRadiusMeters) {
        if (bestArrival === null) {
          bestArrival = candidate;
        } else {
          const current: RouteNode = nodes[bestArrival];
          if (node.timeMs < current.timeMs) {
            bestArrival = candidate;
          } else if (node.timeMs === current.timeMs) {
            bestArrival = node.distanceToFinishMeters < current.distanceToFinishMeters
              ? candidate
              : bestArrival;
          }
        }
      }
    }

    if (bestArrival !== null) {
      frontier = pruneFrontier({
        candidateIndices: nextCandidates,
        nodes,
        start,
        finish,
        maxFrontier
      });
      frontierMax = Math.max(frontierMax, frontier.length);
      terminationReason = 'arrived';
      break;
    }

    frontier = pruneFrontier({
      candidateIndices: nextCandidates,
      nodes,
      start,
      finish,
      maxFrontier
    });
    frontierMax = Math.max(frontierMax, frontier.length);
  }

  if (terminationReason === null) {
    terminationReason = bestArrival !== null ? 'arrived' : 'max-steps';
  }

  const pathIndices: number[] = [];
  const finalIndex = bestArrival ?? bestSoFarIndex;
  let cursor: number | null = finalIndex;
  while (cursor !== null) {
    pathIndices.push(cursor);
    cursor = nodes[cursor].parentIndex;
  }
  pathIndices.reverse();

  const finalNode = nodes[finalIndex];
  const durationHours = (finalNode.timeMs - startTimeMs) / (1000 * 60 * 60);
  let distanceTotal = 0;
  for (let i = 0; i < pathIndices.length - 1; i += 1) {
    const a = nodes[pathIndices[i]];
    const b = nodes[pathIndices[i + 1]];
    distanceTotal += distanceMeters(a.lat, a.lon, b.lat, b.lon);
  }
  if (bestArrival !== null) {
    distanceTotal += distanceMeters(finalNode.lat, finalNode.lon, finish.lat, finish.lon);
  }

  return {
    nodes,
    pathIndices,
    durationHours,
    distanceNm: distanceTotal / 1852,
    eta: new Date(finalNode.timeMs).toISOString(),
    iterations: pathIndices.length,
    frontierMax,
    arrived: bestArrival !== null,
    closestApproachMeters: bestSoFarDistance,
    terminationReason
  };
};