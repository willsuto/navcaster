import axios from 'axios';
import { Vessel, WeatherPoint, ForecastPoint, RiskAssessment, Alert } from '../types';

const BASE_URL = 'http://localhost:3001/api';

export const api = {
  getVessels: () => axios.get<Vessel[]>(`${BASE_URL}/vessels`).then(r => r.data),
  getWeather: () => axios.get<WeatherPoint[]>(`${BASE_URL}/weather`).then(r => r.data),
  getForecast: () => axios.get<ForecastPoint[]>(`${BASE_URL}/forecast`).then(r => r.data),
  getRiskScores: () => axios.get<RiskAssessment[]>(`${BASE_URL}/risk`).then(r => r.data),
  getAlerts: () => axios.get<Alert[]>(`${BASE_URL}/alerts`).then(r => r.data),
};
