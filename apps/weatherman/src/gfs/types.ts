export type BoundingBox = {
  leftLon: number;
  rightLon: number;
  topLat: number;
  bottomLat: number;
};

export type Cycle = {
  date: string; // YYYYMMDD
  cycle: string; // HH
};

export type DownloadStatus = {
  cycle?: Cycle;
  forecastHours: number[];
  lastDownloadAt?: string;
  inProgress: boolean;
  lastError?: string;
};