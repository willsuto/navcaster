import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import type { BoundingBox, Cycle } from './types';
import { buildNomadsUrl, formatCycleLabel, getCandidateCycles } from './nomads';
import { ensureDirectory, getCycleDirectory, getForecastFilePath } from './storage';

const checkUrlExists = async (url: string) => {
  const headResponse = await fetch(url, { method: 'HEAD' });
  if (headResponse.ok) return true;
  if (headResponse.status === 405) {
    const rangeResponse = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' } });
    return rangeResponse.ok;
  }
  return false;
};

export const findLatestCycle = async (bbox: BoundingBox) => {
  const candidates = getCandidateCycles();
  for (const candidate of candidates) {
    const probeUrl = buildNomadsUrl(candidate, 0, bbox);
    const available = await checkUrlExists(probeUrl);
    if (available) {
      return candidate;
    }
  }
  throw new Error('No available GFS cycle found in the last 2 days.');
};

const downloadForecastHour = async (cycle: Cycle, forecastHour: number, bbox: BoundingBox) => {
  const url = buildNomadsUrl(cycle, forecastHour, bbox);
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ${formatCycleLabel(cycle)} f${forecastHour}: ${response.status}`);
  }

  const destination = getForecastFilePath(cycle, forecastHour);
  await ensureDirectory(getCycleDirectory(cycle));
  const fileStream = createWriteStream(destination);
  const nodeStream = Readable.fromWeb(response.body as unknown as any);
  await pipeline(nodeStream, fileStream);
  return destination;
};

export const downloadForecastHours = async (
  cycle: Cycle,
  forecastHours: number[],
  bbox: BoundingBox
) => {
  const downloaded: number[] = [];
  const skipped: number[] = [];

  await ensureDirectory(getCycleDirectory(cycle));

  for (const hour of forecastHours) {
    const destination = getForecastFilePath(cycle, hour);
    const exists = await fs
      .stat(destination)
      .then(() => true)
      .catch(() => false);
    if (exists) {
      skipped.push(hour);
      continue;
    }
    await downloadForecastHour(cycle, hour, bbox);
    downloaded.push(hour);
  }

  return { downloaded, skipped };
};