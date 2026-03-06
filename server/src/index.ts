import express from 'express';
import cors from 'cors';
import { mockVessels } from './data/vessels';
import { currentWeather, forecastData } from './data/weather';
import { calculateRiskScore } from './services/riskScore';
import { generateAlerts } from './services/alerts';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// GET /api/vessels - returns all vessel data
app.get('/api/vessels', (_req, res) => {
  res.json(mockVessels);
});

// GET /api/weather - returns current weather grid
app.get('/api/weather', (_req, res) => {
  res.json(currentWeather);
});

// GET /api/forecast - returns 24h forecast in 6h increments
app.get('/api/forecast', (_req, res) => {
  res.json(forecastData);
});

// GET /api/risk - returns risk assessments for all vessels
app.get('/api/risk', (_req, res) => {
  const riskScores = mockVessels.map(vessel => calculateRiskScore(vessel, currentWeather));
  res.json(riskScores);
});

// GET /api/risk/:vesselId - returns risk assessment for a specific vessel
app.get('/api/risk/:vesselId', (req, res) => {
  const vessel = mockVessels.find(v => v.id === req.params.vesselId);
  if (!vessel) {
    res.status(404).json({ error: 'Vessel not found' });
    return;
  }
  const risk = calculateRiskScore(vessel, currentWeather);
  res.json(risk);
});

// GET /api/alerts - returns all active alerts
app.get('/api/alerts', (_req, res) => {
  const riskScores = mockVessels.map(vessel => calculateRiskScore(vessel, currentWeather));
  const alerts = generateAlerts(mockVessels, currentWeather, forecastData, riskScores);
  res.json(alerts);
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Navcaster server running on port ${PORT}`);
});
