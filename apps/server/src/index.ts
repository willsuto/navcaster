import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import {
  type BoundingBox,
  createAisStreamConnector,
  DEFAULT_BOUNDING_BOXES
} from './aisstream';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json());

const parseJson = <T,>(value?: string): T | undefined => {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Invalid JSON env value provided.', error);
    return undefined;
  }
};

const parseStringArray = (value?: string): string[] | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('[')) {
    const parsed = parseJson<unknown>(trimmed);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : undefined;
  }
  return trimmed.split(',').map((entry) => entry.trim()).filter(Boolean);
};

const boundingBoxes = parseJson<BoundingBox[]>(process.env.AISSTREAM_BOUNDING_BOXES) ?? DEFAULT_BOUNDING_BOXES;
const filterMessageTypes = parseStringArray(process.env.AISSTREAM_FILTER_MESSAGE_TYPES) ?? ['PositionReport'];
const filterMmsi = parseStringArray(process.env.AISSTREAM_FILTER_MMSI);

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/ais' });

let aisConnected = false;

const broadcast = (payload: Record<string, unknown>) => {
  const message = JSON.stringify(payload);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
};

const broadcastAisStatus = () => {
  broadcast({
    type: 'aisstream:status',
    payload: {
      status: aisConnected ? 'connected' : 'disconnected'
    }
  });
};

const aisConnector = createAisStreamConnector({
  apiKey: process.env.AISSTREAM_API_KEY,
  boundingBoxes,
  filterMessageTypes,
  filterMmsi,
  onVesselUpdate: (update) => {
    broadcast({
      type: 'vessel:update',
      payload: update
    });
  },
  onStatusChange: (connected) => {
    aisConnected = connected;
    broadcastAisStatus();
  }
});

wss.on('connection', (socket) => {
  socket.send(
    JSON.stringify({
      type: 'connection:ready',
      payload: {
        status: 'connected'
      }
    })
  );
  socket.send(
    JSON.stringify({
      type: 'aisstream:status',
      payload: {
        status: aisConnected ? 'connected' : 'disconnected'
      }
    })
  );
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    aisstream: {
      connected: aisConnected,
      clients: wss.clients.size
    }
  });
});

app.get('/', (_req, res) => {
  res.send('Navcaster backend is running.');
});

aisConnector.connect();

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on http://localhost:${PORT}`);
});
