import type { Cycle } from '../types';
import { getForecastFilePath, listForecastHours } from '../storage';
import { loadWindField, type WindField, type WindGridMeta } from './gribWindLoader';

export type WindQuery = {
  lat: number;
  lon: number;
  forecastHour?: number;
  time?: string;
};

export type WindQueryResult = {
  u: number;
  v: number;
  speed: number;
  direction: number;
  forecastHour: number;
  timeInterpolation: number;
};

type WindSlice = {
  u: Float32Array;
  v: Float32Array;
};

export class WindStore {
  private meta?: WindGridMeta;
  private cycle?: Cycle;
  private forecastHours: number[] = [];
  private fieldsByHour = new Map<number, WindSlice>();

  getMeta() {
    return {
      cycle: this.cycle,
      forecastHours: [...this.forecastHours],
      grid: this.meta
    };
  }

  isReady() {
    return Boolean(this.cycle && this.meta && this.forecastHours.length > 0);
  }

  async loadCycle(cycle: Cycle, forecastHours?: number[]) {
    const hours = forecastHours?.length ? [...forecastHours] : await listForecastHours(cycle);
    this.fieldsByHour.clear();
    this.meta = undefined;
    this.cycle = cycle;
    this.forecastHours = [];

    for (const hour of hours) {
      const filePath = getForecastFilePath(cycle, hour);
      const field: WindField = await loadWindField(filePath);

      if (!this.meta) {
        this.meta = field.meta;
      } else {
        this.assertCompatibleGrid(field.meta);
      }

      this.fieldsByHour.set(hour, { u: field.u, v: field.v });
      this.forecastHours.push(hour);
    }

    this.forecastHours.sort((a, b) => a - b);
  }

  query({ lat, lon, forecastHour, time }: WindQuery): WindQueryResult | null {
    if (!this.meta || !this.cycle || this.forecastHours.length === 0) return null;

    const targetHour = forecastHour ?? this.computeForecastHour(time);
    if (targetHour === undefined) return null;

    const { lowerHour, upperHour, t } = this.findBoundingHours(targetHour);
    if (lowerHour === undefined || upperHour === undefined) return null;

    const lowerSlice = this.fieldsByHour.get(lowerHour);
    const upperSlice = this.fieldsByHour.get(upperHour);
    if (!lowerSlice || !upperSlice) return null;

    const lower = this.sampleSlice(lowerSlice, lat, lon);
    if (!lower) return null;

    if (lowerHour === upperHour) {
      const speed = Math.hypot(lower.u, lower.v);
      const direction = this.toDirection(lower.u, lower.v);
      return { ...lower, speed, direction, forecastHour: lowerHour, timeInterpolation: 0 };
    }

    const upper = this.sampleSlice(upperSlice, lat, lon);
    if (!upper) return null;

    const u = lower.u + (upper.u - lower.u) * t;
    const v = lower.v + (upper.v - lower.v) * t;
    const speed = Math.hypot(u, v);
    const direction = this.toDirection(u, v);

    return { u, v, speed, direction, forecastHour: targetHour, timeInterpolation: t };
  }

  private assertCompatibleGrid(meta: WindGridMeta) {
    if (!this.meta) return;
    const keys: (keyof Omit<WindGridMeta, 'scan'>)[] = [
      'nx',
      'ny',
      'lat0',
      'lat1',
      'lon0',
      'lon1',
      'dlat',
      'dlon',
      'points'
    ];
    for (const key of keys) {
      if (Math.abs(this.meta[key] - meta[key]) > 1e-6) {
        throw new Error(`Grid metadata mismatch on ${key}: ${this.meta[key]} vs ${meta[key]}`);
      }
    }
  }

  private computeForecastHour(time?: string) {
    if (!time || !this.cycle) return undefined;
    const parsed = new Date(time);
    if (Number.isNaN(parsed.getTime())) return undefined;
    const cycleStart = new Date(
      Date.UTC(
        Number(this.cycle.date.slice(0, 4)),
        Number(this.cycle.date.slice(4, 6)) - 1,
        Number(this.cycle.date.slice(6, 8)),
        Number(this.cycle.cycle)
      )
    );
    return (parsed.getTime() - cycleStart.getTime()) / (1000 * 60 * 60);
  }

  private findBoundingHours(targetHour: number) {
    const hours = this.forecastHours;
    if (hours.length === 0) return { lowerHour: undefined, upperHour: undefined, t: 0 };
    if (targetHour <= hours[0]) {
      return { lowerHour: hours[0], upperHour: hours[0], t: 0 };
    }
    if (targetHour >= hours[hours.length - 1]) {
      return { lowerHour: hours[hours.length - 1], upperHour: hours[hours.length - 1], t: 0 };
    }

    for (let i = 0; i < hours.length - 1; i += 1) {
      const lower = hours[i];
      const upper = hours[i + 1];
      if (targetHour >= lower && targetHour <= upper) {
        const t = upper === lower ? 0 : (targetHour - lower) / (upper - lower);
        return { lowerHour: lower, upperHour: upper, t };
      }
    }

    return { lowerHour: undefined, upperHour: undefined, t: 0 };
  }

  private sampleSlice(slice: WindSlice, lat: number, lon: number) {
    if (!this.meta) return null;
    const { nx, ny, lat0, lon0, dlat, dlon, lat1, lon1 } = this.meta;
    const normalizedLon = ((lon % 360) + 360) % 360;

    const lonMin = Math.min(lon0, lon1);
    const lonMax = Math.max(lon0, lon1);
    const latMin = Math.min(lat0, lat1);
    const latMax = Math.max(lat0, lat1);

    if (normalizedLon < lonMin || normalizedLon > lonMax || lat < latMin || lat > latMax) {
      return null;
    }

    const x = (normalizedLon - lon0) / dlon;
    const y = (lat - lat0) / dlat;

    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = x0 + 1;
    const y1 = y0 + 1;

    if (x0 < 0 || y0 < 0 || x1 >= nx || y1 >= ny) return null;

    const wx = x - x0;
    const wy = y - y0;

    const idx = (xi: number, yi: number) => yi * nx + xi;
    const u00 = slice.u[idx(x0, y0)];
    const u10 = slice.u[idx(x1, y0)];
    const u01 = slice.u[idx(x0, y1)];
    const u11 = slice.u[idx(x1, y1)];

    const v00 = slice.v[idx(x0, y0)];
    const v10 = slice.v[idx(x1, y0)];
    const v01 = slice.v[idx(x0, y1)];
    const v11 = slice.v[idx(x1, y1)];

    const u =
      (1 - wx) * (1 - wy) * u00 +
      wx * (1 - wy) * u10 +
      (1 - wx) * wy * u01 +
      wx * wy * u11;
    const v =
      (1 - wx) * (1 - wy) * v00 +
      wx * (1 - wy) * v10 +
      (1 - wx) * wy * v01 +
      wx * wy * v11;

    return { u, v };
  }

  private toDirection(u: number, v: number) {
    const radians = Math.atan2(u, v);
    const degrees = (radians * 180) / Math.PI;
    return (degrees + 360) % 360;
  }
}