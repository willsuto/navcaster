import readline from 'readline';

export type MockShipState = {
  mmsi: number;
  name: string;
  latitude: number;
  longitude: number;
  cog: number;
  sog: number;
  heading: number;
  roll: number;
  messageType: string;
};

type MockShipOptions = {
  initialLatitude: number;
  initialLongitude: number;
  mmsi?: number;
  name?: string;
  updateIntervalMs?: number;
  rollPeriodMs?: number;
  onUpdate: (state: MockShipState) => void;
  onLog?: (message: string) => void;
};

type CommandResult = {
  handled: boolean;
  message?: string;
};

const EARTH_RADIUS_METERS = 6371000;
const KNOTS_TO_MPS = 0.514444;
const DEFAULT_MMSI = 999000001;
const DEFAULT_NAME = 'Oceanus';

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;

const normalizeHeading = (value: number) => {
  let next = value % 360;
  if (next < 0) next += 360;
  return next;
};

const angularDiffDeg = (current: number, target: number) => {
  const diff = normalizeHeading(target - current);
  return diff >= 180 ? diff - 360 : diff;
};

const formatNumber = (value: number, digits = 3) => value.toFixed(digits);

export const createMockShip = (options: MockShipOptions) => {
  const updateIntervalMs = options.updateIntervalMs ?? 250;
  const rollPeriodMs = options.rollPeriodMs ?? 30000;
  const log = options.onLog ?? (() => undefined);

  let state: MockShipState = {
    mmsi: options.mmsi ?? DEFAULT_MMSI,
    name: options.name ?? DEFAULT_NAME,
    latitude: options.initialLatitude,
    longitude: options.initialLongitude,
    cog: 0,
    sog: 0,
    heading: 0,
    roll: 0,
    messageType: 'MockShip'
  };

  let timer: NodeJS.Timeout | null = null;
  let lastTick = Date.now();
  let rollWindowStart = Date.now();
  let rollAmplitude = randomRollAmplitude();
  let targetCog = state.cog;

  function randomRollAmplitude() {
    return (Math.random() * 10 - 5);
  }

  const tick = () => {
    const now = Date.now();
    const dtSeconds = (now - lastTick) / 1000;
    lastTick = now;

    if (now - rollWindowStart >= rollPeriodMs) {
      rollWindowStart = now;
      rollAmplitude = randomRollAmplitude();
    }

    const rollPhase = ((now - rollWindowStart) / rollPeriodMs) * 2 * Math.PI;
    const roll = rollAmplitude * Math.sin(rollPhase);

    const maxStep = dtSeconds;
    const diff = angularDiffDeg(state.cog, targetCog);
    const step = Math.max(-maxStep, Math.min(maxStep, diff));
    const nextCog = normalizeHeading(state.cog + step);

    const speedMps = state.sog * KNOTS_TO_MPS;
    const distanceMeters = speedMps * dtSeconds;
    const headingRad = toRadians(nextCog);
    const latRad = toRadians(state.latitude);

    const dLat = (distanceMeters * Math.cos(headingRad)) / EARTH_RADIUS_METERS;
    const dLon = (distanceMeters * Math.sin(headingRad)) / (EARTH_RADIUS_METERS * Math.cos(latRad));

    state = {
      ...state,
      latitude: state.latitude + toDegrees(dLat),
      longitude: state.longitude + toDegrees(dLon),
      roll,
      cog: nextCog,
      heading: nextCog
    };

    options.onUpdate(state);
  };

  const start = () => {
    if (timer) return;
    lastTick = Date.now();
    rollWindowStart = lastTick;
    timer = setInterval(tick, updateIntervalMs);
  };

  const stop = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  const updateHeading = (delta: number) => {
    targetCog = normalizeHeading(targetCog + delta);
  };

  const updateSpeed = (nextSpeed: number) => {
    state = {
      ...state,
      sog: Math.max(0, nextSpeed)
    };
  };

  const getStatus = () => ({ ...state });

  const handleCommand = (raw: string): CommandResult => {
    const input = raw.trim();
    if (!input) return { handled: false };

    const [command, ...rest] = input.split(' ');
    const arg = rest.join(' ').trim();

    switch (command.toLowerCase()) {
      case 'help':
        return {
          handled: true,
          message:
            'Commands: help | status | port <deg> | starboard <deg> | speed <knots> | speed +<knots> | speed -<knots>'
        };
      case 'status': {
        const snapshot = getStatus();
        return {
          handled: true,
          message: `Oceanus @ ${formatNumber(snapshot.latitude, 5)}, ${formatNumber(snapshot.longitude, 5)} | COG ${formatNumber(snapshot.cog, 1)}° | SOG ${formatNumber(snapshot.sog, 2)} kts | Roll ${formatNumber(snapshot.roll, 2)}°`
        };
      }
      case 'port': {
        const value = Number(arg);
        if (!Number.isFinite(value)) {
          return { handled: true, message: 'Usage: port <deg>' };
        }
        updateHeading(-value);
        return { handled: true, message: `Turning port ${value}° (target ${formatNumber(targetCog, 1)}°)` };
      }
      case 'starboard': {
        const value = Number(arg);
        if (!Number.isFinite(value)) {
          return { handled: true, message: 'Usage: starboard <deg>' };
        }
        updateHeading(value);
        return { handled: true, message: `Turning starboard ${value}° (target ${formatNumber(targetCog, 1)}°)` };
      }
      case 'speed': {
        if (!arg) {
          return { handled: true, message: 'Usage: speed <knots> | speed +<knots> | speed -<knots>' };
        }

        const isDelta = arg.startsWith('+') || arg.startsWith('-');
        const value = Number(arg);
        if (!Number.isFinite(value)) {
          return { handled: true, message: 'Invalid speed value.' };
        }
        const next = isDelta ? state.sog + value : value;
        updateSpeed(next);
        return { handled: true, message: `Speed set to ${formatNumber(state.sog, 2)} kts` };
      }
      default:
        return { handled: false };
    }
  };

  const startCli = () => {
    if (!process.stdin.isTTY) {
      log('Mockship CLI unavailable (non-interactive stdin).');
      return;
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: 'oceanus> '
    });

    log('Mockship CLI ready. Type "help" for commands.');
    rl.prompt();

    rl.on('line', (line) => {
      const result = handleCommand(line);
      if (result.handled && result.message) {
        log(result.message);
      } else if (!result.handled) {
        log('Unknown command. Type "help" for a list of commands.');
      }
      rl.prompt();
    });

    rl.on('close', () => {
      log('Mockship CLI closed.');
    });
  };

  return {
    start,
    stop,
    startCli,
    getStatus
  };
};