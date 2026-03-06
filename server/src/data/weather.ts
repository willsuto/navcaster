import { WeatherPoint, ForecastPoint } from '../types';

function generateWeatherGrid(timeOffset: number = 0): WeatherPoint[] {
  const grid: WeatherPoint[] = [];
  
  // Storm center at lat 27.5, lng -92
  const stormLat = 27.5;
  const stormLng = -92.0;

  for (let lat = 20.0; lat <= 32.0; lat += 2.0) {
    for (let lng = -98.0; lng <= -78.0; lng += 2.0) {
      // Distance from storm center
      const distFromStorm = Math.sqrt(
        Math.pow(lat - stormLat, 2) + Math.pow(lng - stormLng, 2)
      );
      
      // Storm intensity decreases with distance, moves over time
      const stormIntensity = Math.max(0, 1 - distFromStorm / 8);
      
      // Base values + storm influence
      const waveHeight = 0.5 + stormIntensity * 5.5 + Math.random() * 0.3;
      const windSpeed = 8 + stormIntensity * 42 + Math.random() * 3;
      const baroPressure = 1013 - stormIntensity * 35 + Math.random() * 2;
      
      // Wind direction spirals around storm center (counterclockwise for low pressure)
      const angleToStorm = Math.atan2(stormLat - lat, stormLng - lng) * (180 / Math.PI);
      const windDirection = ((angleToStorm + 90) + 360) % 360;
      
      grid.push({
        lat: Math.round(lat * 10) / 10,
        lng: Math.round(lng * 10) / 10,
        waveHeight: Math.round(waveHeight * 10) / 10,
        waveDirection: Math.round(windDirection),
        wavePeriod: Math.round((6 + stormIntensity * 8) * 10) / 10,
        windSpeed: Math.round(windSpeed * 10) / 10,
        windDirection: Math.round(windDirection),
        barometricPressure: Math.round(baroPressure * 10) / 10,
        visibility: Math.round(Math.max(1, 15 - stormIntensity * 14) * 10) / 10,
        seaTemperature: Math.round((26 - (lat - 20) * 0.5) * 10) / 10,
        swellHeight: Math.round(waveHeight * 0.7 * 10) / 10,
        swellDirection: Math.round((windDirection + 20) % 360)
      });
    }
  }
  
  return grid;
}

export const currentWeather: WeatherPoint[] = generateWeatherGrid(0);

// Generate 24-hour forecast in 6-hour increments
export const forecastData: ForecastPoint[] = [0, 6, 12, 18, 24].map((hours) => {
  const timestamp = new Date();
  timestamp.setHours(timestamp.getHours() + hours);
  return {
    timestamp: timestamp.toISOString(),
    weatherGrid: generateWeatherGrid(hours)
  };
});
