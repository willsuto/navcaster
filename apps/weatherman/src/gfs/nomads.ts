import type { BoundingBox, Cycle } from './types';

const NOMADS_BASE_URL = 'https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25.pl';

const padForecastHour = (hour: number) => String(hour).padStart(3, '0');

export const buildNomadsUrl = (cycle: Cycle, forecastHour: number, bbox: BoundingBox) => {
  const file = `gfs.t${cycle.cycle}z.pgrb2.0p25.f${padForecastHour(forecastHour)}`;
  const dir = `/gfs.${cycle.date}/${cycle.cycle}/atmos`;
  const params = new URLSearchParams({
    file,
    dir,
    subregion: '',
    leftlon: String(bbox.leftLon),
    rightlon: String(bbox.rightLon),
    toplat: String(bbox.topLat),
    bottomlat: String(bbox.bottomLat)
  });

  return `${NOMADS_BASE_URL}?${params.toString()}`;
};

const formatDate = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

export const getCandidateCycles = (): Cycle[] => {
  const cycles = ['18', '12', '06', '00'];
  const now = new Date();
  const today = formatDate(now);
  const yesterdayDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  const yesterday = formatDate(yesterdayDate);

  return [
    ...cycles.map((cycle) => ({ date: today, cycle })),
    ...cycles.map((cycle) => ({ date: yesterday, cycle }))
  ];
};

export const formatCycleLabel = (cycle: Cycle) => `${cycle.date} ${cycle.cycle}z`;