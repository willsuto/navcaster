import { useEffect } from 'react';
import { api } from '../services/api';
import { useAppContext } from '../store/AppContext';

export function useData() {
  const { dispatch } = useAppContext();

  useEffect(() => {
    let mounted = true;

    dispatch({ type: 'SET_LOADING', loading: true });

    async function loadAll() {
      try {
        const [vessels, weather, forecast, risks, alerts] = await Promise.all([
          api.getVessels(),
          api.getWeather(),
          api.getForecast(),
          api.getRiskScores(),
          api.getAlerts(),
        ]);
        if (mounted) {
          dispatch({ type: 'SET_DATA', vessels, weather, forecast, risks, alerts });
        }
      } catch (err: unknown) {
        if (mounted) {
          const message = err instanceof Error ? err.message : 'Failed to load data';
          dispatch({ type: 'SET_ERROR', error: message });
          dispatch({ type: 'SET_LOADING', loading: false });
        }
      }
    }

    loadAll();
    const interval = setInterval(loadAll, 30000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [dispatch]);
}
