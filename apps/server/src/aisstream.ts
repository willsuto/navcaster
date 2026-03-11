import WebSocket from 'ws';

export type BoundingBox = [[number, number], [number, number]];

export type VesselUpdate = {
  mmsi: number;
  latitude: number;
  longitude: number;
  cog?: number;
  sog?: number;
  heading?: number;
  name?: string;
  messageType?: string;
  timestamp?: string;
};

type AisMetadata = {
  MMSI?: number;
  ShipName?: string;
  Latitude?: number;
  Longitude?: number;
  latitude?: number;
  longitude?: number;
  time_utc?: string;
};

type AisStreamMessage = {
  MessageType?: string;
  MetaData?: AisMetadata;
  Metadata?: AisMetadata;
  Message?: Record<string, unknown>;
};

type AisStreamSubscription = {
  APIKey: string;
  BoundingBoxes: BoundingBox[];
  FiltersShipMMSI?: string[];
  FilterMessageTypes?: string[];
};

export type AisStreamConnectorOptions = {
  apiKey?: string;
  boundingBoxes: BoundingBox[];
  filterMessageTypes?: string[];
  filterMmsi?: string[];
  onVesselUpdate: (update: VesselUpdate) => void;
  onStatusChange?: (connected: boolean) => void;
};

export type AisStreamConnector = {
  connect: () => void;
  getStatus: () => { connected: boolean };
};

const AISSTREAM_URL = 'wss://stream.aisstream.io/v0/stream';

export const DEFAULT_BOUNDING_BOXES: BoundingBox[] = [[[-0.5, 95.0], [7.5, 105.8]]];

const toNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const buildSubscriptionPayload = (options: AisStreamConnectorOptions): AisStreamSubscription | null => {
  if (!options.apiKey) {
    // eslint-disable-next-line no-console
    console.error('Missing AISSTREAM_API_KEY. Unable to connect to AISStream.');
    return null;
  }

  const payload: AisStreamSubscription = {
    APIKey: options.apiKey,
    BoundingBoxes: options.boundingBoxes
  };

  if (options.filterMmsi && options.filterMmsi.length > 0) {
    payload.FiltersShipMMSI = options.filterMmsi;
  }

  if (options.filterMessageTypes && options.filterMessageTypes.length > 0) {
    payload.FilterMessageTypes = options.filterMessageTypes;
  }

  return payload;
};

const normalizeAisMessage = (data: WebSocket.RawData): VesselUpdate | null => {
  const raw = typeof data === 'string' ? data : data.toString();
  let parsed: AisStreamMessage;
  try {
    parsed = JSON.parse(raw) as AisStreamMessage;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Unable to parse AIS message.', error);
    return null;
  }

  const metadata = parsed.MetaData ?? parsed.Metadata;
  const messageType = parsed.MessageType;
  const messageBody =
    messageType && parsed.Message ? (parsed.Message as Record<string, unknown>)[messageType] : undefined;

  const mmsi = toNumber(metadata?.MMSI) ?? toNumber((messageBody as { UserID?: number } | undefined)?.UserID);
  const latitude =
    toNumber(metadata?.Latitude) ??
    toNumber(metadata?.latitude) ??
    toNumber((messageBody as { Latitude?: number } | undefined)?.Latitude);
  const longitude =
    toNumber(metadata?.Longitude) ??
    toNumber(metadata?.longitude) ??
    toNumber((messageBody as { Longitude?: number } | undefined)?.Longitude);

  if (mmsi === undefined || latitude === undefined || longitude === undefined) {
    return null;
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }

  const cog = toNumber((messageBody as { Cog?: number } | undefined)?.Cog);
  const sog = toNumber((messageBody as { Sog?: number } | undefined)?.Sog);
  const heading = toNumber((messageBody as { TrueHeading?: number } | undefined)?.TrueHeading);
  const name = metadata?.ShipName?.trim() || undefined;
  const timestamp = metadata?.time_utc;

  return {
    mmsi,
    latitude,
    longitude,
    cog,
    sog,
    heading,
    name,
    messageType,
    timestamp
  };
};

export const createAisStreamConnector = (options: AisStreamConnectorOptions): AisStreamConnector => {
  let socket: WebSocket | null = null;
  let connected = false;
  let reconnectTimeout: NodeJS.Timeout | null = null;
  let reconnectAttempts = 0;

  const setConnected = (nextConnected: boolean) => {
    connected = nextConnected;
    options.onStatusChange?.(connected);
  };

  const scheduleReconnect = () => {
    if (reconnectTimeout) return;
    const delay = Math.min(30000, 1000 * 2 ** reconnectAttempts);
    reconnectAttempts += 1;
    reconnectTimeout = setTimeout(() => {
      reconnectTimeout = null;
      connect();
    }, delay);
  };

  const connect = () => {
    const subscriptionPayload = buildSubscriptionPayload(options);
    if (!subscriptionPayload) return;

    if (socket && socket.readyState === WebSocket.OPEN) {
      return;
    }

    socket = new WebSocket(AISSTREAM_URL);

    socket.on('open', () => {
      reconnectAttempts = 0;
      setConnected(true);
      socket?.send(JSON.stringify(subscriptionPayload));
      // eslint-disable-next-line no-console

    });

    socket.on('message', (data) => {
      const vesselUpdate = normalizeAisMessage(data);
      if (!vesselUpdate) return;
      options.onVesselUpdate(vesselUpdate);
    });

    socket.on('close', () => {
      setConnected(false);
      scheduleReconnect();
      // eslint-disable-next-line no-console
    });

    socket.on('error', (error) => {
      // eslint-disable-next-line no-console
      console.error('AISStream connection error.', error);
    });
  };

  return {
    connect,
    getStatus: () => ({ connected })
  };
};