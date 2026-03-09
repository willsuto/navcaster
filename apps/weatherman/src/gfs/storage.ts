import fs from 'fs/promises';
import path from 'path';
import type { Cycle } from './types';

export const getDataRoot = () => path.resolve(process.cwd(), 'data', 'gfs');

export const getCycleDirectory = (cycle: Cycle) => path.join(getDataRoot(), cycle.date, cycle.cycle);

export const ensureDirectory = async (dir: string) => {
  await fs.mkdir(dir, { recursive: true });
};

export const getForecastFileName = (forecastHour: number) => {
  const padded = String(forecastHour).padStart(3, '0');
  return `gfs.f${padded}.grib2`;
};

export const getForecastFilePath = (cycle: Cycle, forecastHour: number) =>
  path.join(getCycleDirectory(cycle), getForecastFileName(forecastHour));

export const listForecastFiles = async (cycle: Cycle) => {
  const dir = getCycleDirectory(cycle);
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.grib2'));
    const stats = await Promise.all(
      files.map(async (entry) => {
        const fullPath = path.join(dir, entry.name);
        const stat = await fs.stat(fullPath);
        return {
          name: entry.name,
          size: stat.size,
          path: fullPath
        };
      })
    );
    return stats;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
};

export const listForecastHours = async (cycle: Cycle) => {
  const files = await listForecastFiles(cycle);
  return files
    .map((file) => {
      const match = file.name.match(/f(\d{3})/i);
      return match ? Number(match[1]) : undefined;
    })
    .filter((value): value is number => typeof value === 'number')
    .sort((a, b) => a - b);
};

export const listAvailableCycles = async (): Promise<Cycle[]> => {
  const root = getDataRoot();
  try {
    const dates = await fs.readdir(root, { withFileTypes: true });
    const cycles: Cycle[] = [];

    for (const entry of dates) {
      if (!entry.isDirectory()) continue;
      const date = entry.name;
      const cycleDir = path.join(root, date);
      const cycleEntries = await fs.readdir(cycleDir, { withFileTypes: true });
      for (const cycleEntry of cycleEntries) {
        if (!cycleEntry.isDirectory()) continue;
        cycles.push({ date, cycle: cycleEntry.name });
      }
    }

    return cycles.sort((a, b) => {
      const aKey = `${a.date}${a.cycle}`;
      const bKey = `${b.date}${b.cycle}`;
      return bKey.localeCompare(aKey);
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
};