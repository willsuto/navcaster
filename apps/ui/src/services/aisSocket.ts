export type VesselUpdate = {
  mmsi: number;
  latitude: number;
  longitude: number;
  cog?: number;
  sog?: number;
  heading?: number;
  roll?: number;
  name?: string;
  messageType?: string;
  timestamp?: string;
};

export type AisSocketConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';
export type AisStreamStatus = 'connected' | 'disconnected';

type AisSocketMessage = {
  type: string;
  payload?: unknown;
};

export type AisSocketClientOptions = {
  url?: string;
  onVesselUpdate?: (update: VesselUpdate) => void;
  onConnectionStatus?: (status: AisSocketConnectionStatus) => void;
  onStreamStatus?: (status: AisStreamStatus) => void;
  onError?: (event: Event) => void;
};

export type AisSocketClient = {
  connect: () => void;
  close: () => void;
};

const resolveSocketUrl = (url?: string) => {
  if (url) return url;
  const envUrl = import.meta.env.VITE_AIS_WS_URL as string | undefined;
  if (envUrl) return envUrl;
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  if (import.meta.env.DEV) {
    return `${protocol}://${window.location.hostname}:3001/ws/ais`;
  }
  return `${protocol}://${window.location.host}/ws/ais`;
};

const parseMessage = (raw: string): AisSocketMessage | null => {
  try {
    return JSON.parse(raw) as AisSocketMessage;
  } catch {
    return null;
  }
};

export const createAisSocketClient = (options: AisSocketClientOptions = {}): AisSocketClient => {
  let socket: WebSocket | null = null;
  let reconnectTimeout: number | undefined;
  let reconnectAttempts = 0;
  let closedByUser = false;

  const notifyStatus = (status: AisSocketConnectionStatus) => {
    options.onConnectionStatus?.(status);
  };

  const scheduleReconnect = () => {
    if (reconnectTimeout) return;
    const delay = Math.min(15000, 1000 * 2 ** reconnectAttempts);
    reconnectAttempts += 1;
    reconnectTimeout = window.setTimeout(() => {
      reconnectTimeout = undefined;
      connect();
    }, delay);
  };

  const connect = () => {
    closedByUser = false;
    notifyStatus('connecting');

    const targetUrl = resolveSocketUrl(options.url);
    socket = new WebSocket(targetUrl);

    socket.addEventListener('open', () => {
      reconnectAttempts = 0;
      notifyStatus('connected');
    });

    socket.addEventListener('message', (event) => {
      if (typeof event.data !== 'string') return;
      const message = parseMessage(event.data);
      if (!message) return;

      if (message.type === 'vessel:update' && message.payload) {
        options.onVesselUpdate?.(message.payload as VesselUpdate);
      }

      if (message.type === 'aisstream:status' && message.payload) {
        const status = (message.payload as { status?: AisStreamStatus }).status;
        if (status) {
          options.onStreamStatus?.(status);
        }
      }
    });

    socket.addEventListener('close', () => {
      notifyStatus('disconnected');
      if (!closedByUser) {
        scheduleReconnect();
      }
    });

    socket.addEventListener('error', (event) => {
      notifyStatus('error');
      options.onError?.(event);
    });
  };

  const close = () => {
    closedByUser = true;
    if (reconnectTimeout) {
      window.clearTimeout(reconnectTimeout);
      reconnectTimeout = undefined;
    }
    socket?.close();
  };

  return {
    connect,
    close
  };
};