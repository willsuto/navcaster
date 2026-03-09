import { runWgrib2Buffer, runWgrib2Text } from './wgrib2';

export type WindGridMeta = {
  nx: number;
  ny: number;
  lat0: number;
  lat1: number;
  lon0: number;
  lon1: number;
  dlat: number;
  dlon: number;
  points: number;
  scan: string;
};

export type WindField = {
  meta: WindGridMeta;
  u: Float32Array;
  v: Float32Array;
};

const GRID_REGEX =
  /lat-lon grid:\((\d+) x (\d+)\).*?lat ([\d.-]+) to ([\d.-]+) by ([\d.-]+) lon ([\d.-]+) to ([\d.-]+) by ([\d.-]+).*#points=(\d+)/i;

const parseGridLine = (line: string): WindGridMeta => {
  const match = line.match(GRID_REGEX);
  if (!match) {
    throw new Error(`Unable to parse grid metadata: ${line}`);
  }
  const nx = Number(match[1]);
  const ny = Number(match[2]);
  const lat0 = Number(match[3]);
  const lat1 = Number(match[4]);
  const dlatRaw = Number(match[5]);
  const lon0 = Number(match[6]);
  const lon1 = Number(match[7]);
  const dlon = Number(match[8]);
  const points = Number(match[9]);
  const scanMatch = line.match(/output\s+(\S+)/i);
  const scan = scanMatch ? scanMatch[1] : 'WE:SN';

  const dlat = lat1 >= lat0 ? Math.abs(dlatRaw) : -Math.abs(dlatRaw);

  return { nx, ny, lat0, lat1, lon0, lon1, dlat, dlon, points, scan };
};

const readFloat32Array = (buffer: Buffer) => {
  if (buffer.byteLength % 4 !== 0) {
    throw new Error(`Unexpected binary length ${buffer.byteLength} (not multiple of 4).`);
  }
  return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
};

export const loadWindField = async (filePath: string): Promise<WindField> => {
  const gridOutput = await runWgrib2Text([
    filePath,
    '-match',
    ':(U|V)GRD:10 m above ground:',
    '-grid',
    '-one_line'
  ]);

  const gridLine = gridOutput.trim().split('\n')[0];
  const meta = parseGridLine(gridLine);

  const uBuffer = await runWgrib2Buffer([
    filePath,
    '-match',
    ':UGRD:10 m above ground:',
    '-inv',
    '/dev/null',
    '-no_header',
    '-bin',
    '-'
  ]);

  const vBuffer = await runWgrib2Buffer([
    filePath,
    '-match',
    ':VGRD:10 m above ground:',
    '-inv',
    '/dev/null',
    '-no_header',
    '-bin',
    '-'
  ]);

  const u = readFloat32Array(uBuffer);
  const v = readFloat32Array(vBuffer);

  const expected = meta.nx * meta.ny;
  if (u.length !== expected || v.length !== expected) {
    throw new Error(
      `Wind arrays size mismatch: expected ${expected} points, got u=${u.length}, v=${v.length}.`
    );
  }

  return { meta, u, v };
};