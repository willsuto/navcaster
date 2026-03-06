# NavCaster – Maritime Weather Intelligence

A maritime navigation and weather forecasting dashboard for vessel operations.

![NavCaster Screenshot](https://github.com/user-attachments/assets/728934a9-1afc-4a53-83c7-44992a7cbf50)

## Features

- **Interactive map** with vessel positions and colour-coded weather overlays (wave height, wind speed, barometric pressure)
- **Toggleable data layers** – show/hide waves, wind, pressure, routes, and forecast mode individually
- **Risk Score (0–100)** per vessel based on wave height, wind speed, barometric pressure and visibility
- **GO / CAUTION / NO-GO** operational decision with per-vessel-type limits (cargo, tanker, passenger, research)
- **24-hour forecast** with a time slider to visualise future weather conditions
- **Automated alerts** for threshold breaches and forecast deterioration, with acknowledge functionality
- **Alternate route suggestions** when conditions exceed operational limits

## Project Structure

```
navcaster/
├── server/          # Node / Express / TypeScript backend (port 3001)
│   └── src/
│       ├── data/    # Mock vessel and weather data
│       ├── services/# Risk score engine and alert generator
│       └── index.ts # REST API entry point
└── client/          # React / TypeScript / Vite frontend (port 5173)
    └── src/
        ├── components/  # Map, ControlPanel, VesselPanel, AlertPanel
        ├── store/       # App state (React Context + useReducer)
        ├── hooks/       # Data fetching with 30-second polling
        └── utils/       # Weather colour helpers
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/vessels` | All vessel positions and metadata |
| GET | `/api/weather` | Current weather grid |
| GET | `/api/forecast` | 24-hour forecast (6-hour increments) |
| GET | `/api/risk` | Risk assessments for all vessels |
| GET | `/api/risk/:vesselId` | Risk assessment for one vessel |
| GET | `/api/alerts` | Active operational alerts |

## Getting Started

### Server
```bash
cd server
npm install
npm run dev        # dev server with hot reload
# or
npm run build && npm start
```

### Client
```bash
cd client
npm install
npm run dev        # Vite dev server on http://localhost:5173
```

The client proxies `/api` requests to the server on port 3001.

## Risk Score Model

Each vessel is scored 0–100 using weighted environmental factors:

| Factor | Weight | Contribution |
|--------|--------|-------------|
| Wave Height | 35% | Linear ratio to vessel-type limit |
| Wind Speed | 30% | Linear ratio to vessel-type limit |
| Barometric Pressure | 20% | Drop below normal |
| Visibility | 15% | Below 10 nm |

### Vessel-Type Operational Limits

| Type | Wave Height | Wind Speed | Min Pressure |
|------|-------------|------------|-------------|
| Cargo | 4.0 m | 40 kts | 975 hPa |
| Tanker | 3.5 m | 35 kts | 978 hPa |
| Passenger | 2.5 m | 30 kts | 985 hPa |
| Military | 5.0 m | 50 kts | 970 hPa |
| Research | 3.0 m | 35 kts | 980 hPa |
