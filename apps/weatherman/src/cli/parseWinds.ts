import { listAvailableCycles, listForecastHours } from '../gfs/storage';
import type { Cycle } from '../gfs/types';
import { WindStore } from '../gfs/wind/WindStore';

type CliOptions = {
  date?: string;
  cycle?: string;
  latest?: boolean;
};

const parseArgs = (argv: string[]): CliOptions => {
  const options: CliOptions = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--date') {
      options.date = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--cycle') {
      options.cycle = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--latest') {
      options.latest = true;
    }
  }
  return options;
};

const resolveCycle = async (options: CliOptions): Promise<Cycle> => {
  if (options.latest) {
    const cycles = await listAvailableCycles();
    if (!cycles.length) {
      throw new Error('No GFS cycles found on disk.');
    }
    return cycles[0];
  }
  if (!options.date || !options.cycle) {
    throw new Error('Provide --date YYYYMMDD and --cycle HH, or use --latest.');
  }
  return { date: options.date, cycle: options.cycle };
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  const cycle = await resolveCycle(options);
  const forecastHours = await listForecastHours(cycle);
  if (!forecastHours.length) {
    throw new Error(`No forecast hours found for ${cycle.date} ${cycle.cycle}z.`);
  }

  const windStore = new WindStore();
  await windStore.loadCycle(cycle, forecastHours);

  const meta = windStore.getMeta();
  // eslint-disable-next-line no-console
  console.log('Loaded wind arrays into memory.');
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(meta, null, 2));
};

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});