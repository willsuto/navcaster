"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const vessels_1 = require("./data/vessels");
const weather_1 = require("./data/weather");
const riskScore_1 = require("./services/riskScore");
const alerts_1 = require("./services/alerts");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// GET /api/vessels - returns all vessel data
app.get('/api/vessels', (_req, res) => {
    res.json(vessels_1.mockVessels);
});
// GET /api/weather - returns current weather grid
app.get('/api/weather', (_req, res) => {
    res.json(weather_1.currentWeather);
});
// GET /api/forecast - returns 24h forecast in 6h increments
app.get('/api/forecast', (_req, res) => {
    res.json(weather_1.forecastData);
});
// GET /api/risk - returns risk assessments for all vessels
app.get('/api/risk', (_req, res) => {
    const riskScores = vessels_1.mockVessels.map(vessel => (0, riskScore_1.calculateRiskScore)(vessel, weather_1.currentWeather));
    res.json(riskScores);
});
// GET /api/risk/:vesselId - returns risk assessment for a specific vessel
app.get('/api/risk/:vesselId', (req, res) => {
    const vessel = vessels_1.mockVessels.find(v => v.id === req.params.vesselId);
    if (!vessel) {
        res.status(404).json({ error: 'Vessel not found' });
        return;
    }
    const risk = (0, riskScore_1.calculateRiskScore)(vessel, weather_1.currentWeather);
    res.json(risk);
});
// GET /api/alerts - returns all active alerts
app.get('/api/alerts', (_req, res) => {
    const riskScores = vessels_1.mockVessels.map(vessel => (0, riskScore_1.calculateRiskScore)(vessel, weather_1.currentWeather));
    const alerts = (0, alerts_1.generateAlerts)(vessels_1.mockVessels, weather_1.currentWeather, weather_1.forecastData, riskScores);
    res.json(alerts);
});
// Health check
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.listen(PORT, () => {
    console.log(`Navcaster server running on port ${PORT}`);
});
