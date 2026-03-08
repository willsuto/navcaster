import { useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useVesselFeatureCollection } from '../store/aisGeoJson';
import { useOceanusTailFeatureCollection } from '../store/oceanusTailGeoJson';
import { useMapLayersStore } from '../store/mapLayers';
import { useAisVesselStore } from '../store/aisVessels';

const OCEANUS_MMSI = 999000001;
const EARTH_RADIUS_METERS = 6371000;
const METERS_PER_NM = 1852;

const isValidCoordinate = (
  value: number | undefined,
  min: number,
  max: number
): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;

const distanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const fromLat = toRadians(lat1);
  const toLat = toRadians(lat2);

  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);

  const a = sinLat * sinLat + Math.cos(fromLat) * Math.cos(toLat) * sinLon * sinLon;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
};

const bearingDegrees = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const fromLat = toRadians(lat1);
  const toLat = toRadians(lat2);
  const dLon = toRadians(lon2 - lon1);

  const y = Math.sin(dLon) * Math.cos(toLat);
  const x = Math.cos(fromLat) * Math.sin(toLat) - Math.sin(fromLat) * Math.cos(toLat) * Math.cos(dLon);
  const bearing = (toDegrees(Math.atan2(y, x)) + 360) % 360;

  return bearing;
};

function Map() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const scaleControlRef = useRef<mapboxgl.ScaleControl | null>(null);
  const vesselData = useVesselFeatureCollection();
  const vesselDataRef = useRef(vesselData);
  const tailData = useOceanusTailFeatureCollection();
  const tailDataRef = useRef(tailData);
  const [cursorLngLat, setCursorLngLat] = useState<mapboxgl.LngLat | null>(null);
  const [zoom, setZoom] = useState<number | null>(null);
  const aisEnabled = useMapLayersStore((state) => state.aisEnabled);
  const oceanusEnabled = useMapLayersStore((state) => state.oceanusEnabled);
  const trackEnabled = useMapLayersStore((state) => state.trackEnabled);
  const oceanus = useAisVesselStore((state) => state.vessels[String(OCEANUS_MMSI)]);

  const oceanusPosition = useMemo(() => {
    const latitude = oceanus?.latitude;
    const longitude = oceanus?.longitude;

    if (!isValidCoordinate(latitude, -90, 90)) return null;
    if (!isValidCoordinate(longitude, -180, 180)) return null;

    return { latitude, longitude };
  }, [oceanus?.latitude, oceanus?.longitude]);

  const { rangeLabel, bearingLabel } = useMemo(() => {
    if (!cursorLngLat || !oceanusPosition) {
      return { rangeLabel: '—', bearingLabel: '—' };
    }

    const meters = distanceMeters(
      oceanusPosition.latitude,
      oceanusPosition.longitude,
      cursorLngLat.lat,
      cursorLngLat.lng
    );
    const rangeNm = meters / METERS_PER_NM;
    const bearing = bearingDegrees(
      oceanusPosition.latitude,
      oceanusPosition.longitude,
      cursorLngLat.lat,
      cursorLngLat.lng
    );

    return {
      rangeLabel: `${rangeNm.toFixed(2)} nm`,
      bearingLabel: `${bearing.toFixed(0)}°`
    };
  }, [cursorLngLat, oceanusPosition]);

  const setLayerVisibility = (map: mapboxgl.Map, layerId: string, enabled: boolean) => {
    if (!map.getLayer(layerId)) return;
    map.setLayoutProperty(layerId, 'visibility', enabled ? 'visible' : 'none');
  };

  useEffect(() => {
    vesselDataRef.current = vesselData;
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource('vessels') as mapboxgl.GeoJSONSource | undefined;
    if (source) {
      source.setData(vesselData);
    }
  }, [vesselData]);

  useEffect(() => {
    tailDataRef.current = tailData;
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource('oceanus-tail') as mapboxgl.GeoJSONSource | undefined;
    if (source) {
      source.setData(tailData);
    }
  }, [tailData]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    setLayerVisibility(map, 'ais-marker', aisEnabled);
    setLayerVisibility(map, 'ais-dot', aisEnabled);
  }, [aisEnabled]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    setLayerVisibility(map, 'oceanus-marker', oceanusEnabled);
  }, [oceanusEnabled]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    setLayerVisibility(map, 'oceanus-tail-line', trackEnabled);
  }, [trackEnabled]);

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
      center: [103.85, 1.1],
      zoom: 10,
      pitch: 20,
      bearing: 18,
      logoPosition: 'bottom-left',
      attributionControl: false,
      interactive: true
    });

    mapRef.current = map;

    const nav = new mapboxgl.NavigationControl({ showCompass: true, showZoom: false });
    map.addControl(nav, 'top-right');

    const scale = new mapboxgl.ScaleControl({ maxWidth: 120, unit: 'nautical' });
    map.addControl(scale, 'bottom-left');
    scaleControlRef.current = scale;

    const updateScaleIndicator = () => {
      const scaleElement = map.getContainer().querySelector('.mapboxgl-ctrl-scale') as HTMLElement | null;
      if (!scaleElement) return;
      const inlineWidth = scaleElement.style.width;
      const pixelWidth = inlineWidth && inlineWidth.length > 0
        ? inlineWidth
        : `${scaleElement.offsetWidth}px`;
      scaleElement.style.setProperty('--scale-line-width', pixelWidth);
    };

    const handleMarkerClick = (event: mapboxgl.MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature || feature.geometry.type !== 'Point') return;

      const coordinates = [...feature.geometry.coordinates] as [number, number];
      const properties = feature.properties ?? {};
      const name = properties.name || 'Unknown';
      const mmsi = properties.mmsi || '—';
      const cog = properties.cog ?? '—';
      const sog = properties.sog ?? '—';
      const rawTimestamp = typeof properties.timestamp === 'string' ? properties.timestamp : undefined;
      const parsedTimestamp = rawTimestamp ? Date.parse(rawTimestamp) : Number.NaN;
      const lastSeenMs = Number(properties.lastSeen);
      const hasLastSeen = Number.isFinite(lastSeenMs);
      const localTime = Number.isFinite(parsedTimestamp)
        ? new Date(parsedTimestamp).toLocaleString()
        : hasLastSeen
          ? new Date(lastSeenMs).toLocaleString()
          : '—';

      if (popupRef.current) {
        popupRef.current.remove();
      }

      popupRef.current = new mapboxgl.Popup({
        closeButton: true,
        closeOnClick: true,
        offset: 12,
        className: 'ais-popup'
      })
        .setLngLat(coordinates)
        .setHTML(
          `
            <div class="ais-popup__header">
              <div class="ais-popup__title">${name}</div>
            </div>
            <div class="ais-popup__content">
              <div class="ais-popup__row">
                <span class="ais-popup__label">MMSI</span>
                <span class="ais-popup__value">${mmsi}</span>
              </div>
              <div class="ais-popup__row">
                <span class="ais-popup__label">COG</span>
                <span class="ais-popup__value">${cog}°</span>
              </div>
              <div class="ais-popup__row">
                <span class="ais-popup__label">SOG</span>
                <span class="ais-popup__value">${sog} kts</span>
              </div>
              <div class="ais-popup__row ais-popup__row--stack">
                <span class="ais-popup__value">${localTime}</span>
              </div>
            </div>
          `
        )
        .addTo(map);
    };

    const handleMarkerEnter = () => {
      map.getCanvas().style.cursor = 'pointer';
    };

    const handleMarkerLeave = () => {
      map.getCanvas().style.cursor = '';
    };

    const handleMouseMove = (event: mapboxgl.MapMouseEvent) => {
      setCursorLngLat(event.lngLat);
    };

    const handleZoom = () => {
      setZoom(map.getZoom());
      updateScaleIndicator();
    };

    map.on('load', () => {
      map.scrollZoom.enable();
      map.boxZoom.enable();
      map.dragPan.enable();
      map.dragRotate.enable();
      map.keyboard.enable();
      map.doubleClickZoom.enable();
      map.touchZoomRotate.enable();

      map.addSource('vessels', {
        type: 'geojson',
        data: vesselDataRef.current
      });

      map.addSource('oceanus-tail', {
        type: 'geojson',
        data: tailDataRef.current
      });

      // Ship silhouette SDF icon (forward points up so existing icon-rotate continues to work).
      let vesselIconId = 'ship-sdf';

      if (!map.hasImage(vesselIconId)) {
        const size = 32;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');

        if (context) {
          const cx = size / 2;
          const bowY = 3;
          const sternY = size - 4;
          const shoulderY = 10;
          const midY = 18;
          const shoulderHalfWidth = 2.5;
          const maxHalfWidth = 5;

          context.clearRect(0, 0, size, size);
          context.fillStyle = '#ffffff';

          context.beginPath();
          // Bow point.
          context.moveTo(cx, bowY);
          // Starboard bow shoulder to widest point.
          context.quadraticCurveTo(
            cx + shoulderHalfWidth,
            bowY + 2,
            cx + maxHalfWidth,
            shoulderY
          );
          // Starboard hull down toward stern.
          context.quadraticCurveTo(cx + maxHalfWidth + 1, midY, cx + maxHalfWidth, sternY - 1);
          // Flat transom stern.
          context.lineTo(cx + maxHalfWidth, sternY);
          context.lineTo(cx - maxHalfWidth, sternY);
          // Port hull back up.
          context.lineTo(cx - maxHalfWidth, sternY - 1);
          context.quadraticCurveTo(cx - (maxHalfWidth + 1), midY, cx - maxHalfWidth, shoulderY);
          // Port bow shoulder back to bow point.
          context.quadraticCurveTo(
            cx - shoulderHalfWidth,
            bowY + 2,
            cx,
            bowY
          );
          context.closePath();
          context.fill();

          const imageData = context.getImageData(0, 0, size, size);
          map.addImage(vesselIconId, imageData, { sdf: true });
        } else {
          // Fallback to a built-in style icon if canvas isn't available for some reason.
          vesselIconId = 'triangle-15';
        }
      }

      map.addLayer({
        id: 'oceanus-tail-line',
        type: 'line',
        source: 'oceanus-tail',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#f72585',
          'line-width': 2,
          'line-opacity': 0.8,
          'line-dasharray': [2, 2]
        }
      });

      // AIS switches from dots to ship icons at this zoom level.
      const AIS_LOD_ZOOM = 11;

      const vesselMarkerLayout: mapboxgl.SymbolLayout = {
        'icon-image': vesselIconId,
        'icon-size': 1.25,
        'icon-rotation-alignment': 'map',
        'icon-rotate': [
          'case',
          ['==', ['to-number', ['get', 'cog']], 360],
          0,
          ['coalesce', ['to-number', ['get', 'cog']], 0]
        ],
        'icon-allow-overlap': true
      };

      map.addLayer({
        id: 'ais-marker',
        type: 'symbol',
        source: 'vessels',
        filter: ['!=', ['to-number', ['get', 'mmsi']], 999000001],
        minzoom: AIS_LOD_ZOOM,
        layout: vesselMarkerLayout,
        paint: {
          'icon-color': '#a8b44e'
        }
      });

      map.addLayer({
        id: 'ais-dot',
        type: 'circle',
        source: 'vessels',
        filter: ['!=', ['to-number', ['get', 'mmsi']], 999000001],
        maxzoom: AIS_LOD_ZOOM,
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            2,
            1.5,
            AIS_LOD_ZOOM,
            3
          ],
          'circle-color': '#a8b44e',
          'circle-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            2,
            0.45,
            AIS_LOD_ZOOM,
            0.85
          ]
        }
      });

      map.addLayer({
        id: 'oceanus-marker',
        type: 'symbol',
        source: 'vessels',
        filter: ['==', ['to-number', ['get', 'mmsi']], 999000001],
        layout: vesselMarkerLayout,
        paint: {
          'icon-color': '#f72585'
        }
      });

      setLayerVisibility(map, 'ais-marker', aisEnabled);
      setLayerVisibility(map, 'ais-dot', aisEnabled);
      setLayerVisibility(map, 'oceanus-marker', oceanusEnabled);
      setLayerVisibility(map, 'oceanus-tail-line', trackEnabled);

      map.on('click', 'oceanus-marker', handleMarkerClick);
      map.on('click', 'ais-marker', handleMarkerClick);

      map.on('mouseenter', 'oceanus-marker', handleMarkerEnter);
      map.on('mouseenter', 'ais-marker', handleMarkerEnter);

      map.on('mouseleave', 'oceanus-marker', handleMarkerLeave);
      map.on('mouseleave', 'ais-marker', handleMarkerLeave);

      map.setFog({
        color: '#030813',
        'high-color': '#0b2a4f',
        'horizon-blend': 0.24,
        'space-color': '#010205',
        'star-intensity': 0.25
      });

      updateScaleIndicator();
    });

    setZoom(map.getZoom());
    map.on('mousemove', handleMouseMove);
    map.on('zoom', handleZoom);
    map.on('resize', updateScaleIndicator);

    return () => {
      if (map) {
        map.off('click', 'oceanus-marker', handleMarkerClick);
        map.off('click', 'ais-marker', handleMarkerClick);

        map.off('mouseenter', 'oceanus-marker', handleMarkerEnter);
        map.off('mouseenter', 'ais-marker', handleMarkerEnter);

        map.off('mouseleave', 'oceanus-marker', handleMarkerLeave);
        map.off('mouseleave', 'ais-marker', handleMarkerLeave);

        map.off('mousemove', handleMouseMove);
        map.off('zoom', handleZoom);
        map.off('resize', updateScaleIndicator);
      }
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      if (scaleControlRef.current) {
        map.removeControl(scaleControlRef.current);
        scaleControlRef.current = null;
      }
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div className="map-bg" aria-hidden="true">
      <div ref={containerRef} className="map-bg__canvas" />
      <div className="map-bg__overlay" />
      <div className="map-hud" aria-live="polite">
        <div className="map-hud__row">
          <span className="map-hud__label">Lat:</span>
          <span className="map-hud__value">
            {cursorLngLat ? cursorLngLat.lat.toFixed(6) : '—'}
          </span>
        </div>
        <div className="map-hud__row">
          <span className="map-hud__label">Lon:</span>
          <span className="map-hud__value">
            {cursorLngLat ? cursorLngLat.lng.toFixed(6) : '—'}
          </span>
        </div>
        <div className="map-hud__row">
          <span className="map-hud__label">Range:</span>
          <span className="map-hud__value">{rangeLabel}</span>
        </div>
        <div className="map-hud__row">
          <span className="map-hud__label">Bearing:</span>
          <span className="map-hud__value">{bearingLabel}</span>
        </div>
        <div className="map-hud__row">
          <span className="map-hud__label">Z:</span>
          <span className="map-hud__value">{zoom !== null ? zoom.toFixed(2) : '—'}</span>
        </div>
      </div>
    </div>
  );
}

export default Map;