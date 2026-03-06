import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

function Map() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    const accessToken = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

    if (!accessToken) {
      console.warn('Map disabled: missing VITE_MAPBOX_TOKEN');
      return;
    }

    mapboxgl.accessToken = accessToken;

    const map = new mapboxgl.Map({
      container,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-97.5, 37.8],
      zoom: 3.2,
      pitch: 20,
      bearing: 18,
      attributionControl: false,
      interactive: true
    });

    mapRef.current = map;

    map.on('load', () => {
      map.scrollZoom.enable();
      map.boxZoom.enable();
      map.dragPan.enable();
      map.dragRotate.enable();
      map.keyboard.enable();
      map.doubleClickZoom.enable();
      map.touchZoomRotate.enable();

      map.setFog({
        color: '#030813',
        'high-color': '#0b2a4f',
        'horizon-blend': 0.24,
        'space-color': '#010205',
        'star-intensity': 0.25
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div className="map-bg" aria-hidden="true">
      <div ref={containerRef} className="map-bg__canvas" />
      <div className="map-bg__overlay" />
    </div>
  );
}

export default Map;