import { useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useVesselFeatureCollection } from '../store/aisGeoJson';
import { useOceanusTailFeatureCollection } from '../store/oceanusTailGeoJson';
import { useMapLayersStore } from '../store/mapLayers';
import { useAisVesselStore } from '../store/aisVessels';
import { useWindStore } from '../store/wind';

const OCEANUS_MMSI = 999000001;
const EARTH_RADIUS_METERS = 6371000;
const METERS_PER_NM = 1852;
const KNOTS_PER_MS = 1.943844;
const MAX_WIND_KTS = 50;
const GFS_CELL_DEGREES = 0.25;
const WIND_TARGET_PX = 40;
const MIN_WIND_STEP = 1;
const MAX_WIND_STEP = 12;

type WindVector = {
  lat: number;
  lon: number;
  u: number;
  v: number;
};

type WindVectorResponse = {
  status: string;
  vectors?: WindVector[];
};

const isValidCoordinate = (
  value: number | undefined,
  min: number,
  max: number
): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getWindStepFallback = (zoom: number) => {
  if (zoom >= 12) return 2;
  if (zoom >= 10) return 3;
  if (zoom >= 8) return 4;
  if (zoom >= 6) return 6;
  return 8;
};

const getWindStep = (map: mapboxgl.Map | null, zoom: number) => {
  if (!map) return getWindStepFallback(zoom);

  const center = map.getCenter();
  const latitude = clamp(center.lat, -85, 85);
  const longitude = center.lng;
  const origin = map.project([longitude, latitude]);
  const east = map.project([longitude + GFS_CELL_DEGREES, latitude]);
  const north = map.project([longitude, latitude + GFS_CELL_DEGREES]);

  const eastDistance = Math.hypot(east.x - origin.x, east.y - origin.y);
  const northDistance = Math.hypot(north.x - origin.x, north.y - origin.y);
  const cellPx = Math.max(eastDistance, northDistance);

  if (!Number.isFinite(cellPx) || cellPx <= 0) return getWindStepFallback(zoom);

  const step = Math.round(WIND_TARGET_PX / cellPx);
  return clamp(step, MIN_WIND_STEP, MAX_WIND_STEP);
};

const getWindColor = (speedKnots: number) => {
  const stops = [
    { kt: 0, color: '#2c7bb6' },
    { kt: 10, color: '#00a6ca' },
    { kt: 20, color: '#00ccbc' },
    { kt: 30, color: '#90eb9d' },
    { kt: 40, color: '#f9d057' },
    { kt: 50, color: '#f29e2e' }
  ];

  const clamped = clamp(speedKnots, 0, MAX_WIND_KTS);
  const upperIndex = stops.findIndex((stop) => clamped <= stop.kt);
  if (upperIndex <= 0) return stops[0].color;

  const lower = stops[upperIndex - 1];
  const upper = stops[upperIndex];
  const t = upper.kt === lower.kt ? 0 : (clamped - lower.kt) / (upper.kt - lower.kt);

  const lerp = (a: number, b: number) => Math.round(a + (b - a) * t);
  const parse = (color: string) => {
    const value = color.replace('#', '');
    return [
      parseInt(value.slice(0, 2), 16),
      parseInt(value.slice(2, 4), 16),
      parseInt(value.slice(4, 6), 16)
    ];
  };

  const [r1, g1, b1] = parse(lower.color);
  const [r2, g2, b2] = parse(upper.color);
  const r = lerp(r1, r2);
  const g = lerp(g1, g2);
  const b = lerp(b1, b2);
  return `rgb(${r}, ${g}, ${b})`;
};

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
  const windEnabled = useMapLayersStore((state) => state.windEnabled);
  const selectedForecastHour = useWindStore((state) => state.selectedForecastHour);
  const windCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const windVectorsRef = useRef<WindVector[]>([]);
  const windEnabledRef = useRef(false);
  const [windVectors, setWindVectors] = useState<WindVector[]>([]);
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

  const drawWindBarb = (
    context: CanvasRenderingContext2D,
    speedKnots: number,
    length: number
  ) => {
    const roundedSpeed = Math.max(0, Math.round(speedKnots / 5) * 5);
    const flags = Math.floor(roundedSpeed / 50);
    const tens = Math.floor((roundedSpeed % 50) / 10);
    const hasHalf = roundedSpeed % 10 >= 5;

    const barbAngle = Math.PI / 3;
    const barbLength = 11;
    const halfBarbLength = barbLength * 0.6;
    const flagLength = 16;
    const barbSpacing = 5;
    const flagSpacing = 8;
    const barbDx = Math.cos(barbAngle) * barbLength;
    const barbDy = -Math.sin(barbAngle) * barbLength;
    const flagDx = Math.cos(barbAngle) * flagLength;
    const flagDy = -Math.sin(barbAngle) * flagLength;

    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(0, -length);
    context.stroke();

    let offset = 0;

    for (let i = 0; i < flags; i += 1) {
      context.beginPath();
      context.moveTo(0, offset);
      context.lineTo(flagDx, offset + flagDy);
      context.lineTo(0, offset + flagDy * 2);
      context.closePath();
      context.fill();
      offset -= flagSpacing;
    }

    for (let i = 0; i < tens; i += 1) {
      context.beginPath();
      context.moveTo(0, offset);
      context.lineTo(barbDx, offset + barbDy);
      context.stroke();
      offset -= barbSpacing;
    }

    if (hasHalf) {
      const halfDx = Math.cos(barbAngle) * halfBarbLength;
      const halfDy = -Math.sin(barbAngle) * halfBarbLength;
      context.beginPath();
      context.moveTo(0, offset);
      context.lineTo(halfDx, offset + halfDy);
      context.stroke();
    }
  };

  const drawWindVectors = () => {
    const map = mapRef.current;
    const canvas = windCanvasRef.current;
    if (!map || !canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);
    if (!windEnabledRef.current) return;

    const bounds = map.getBounds();
    if (!bounds) return;
    const vectors = windVectorsRef.current;

    for (const vector of vectors) {
      if (!bounds.contains([vector.lon, vector.lat])) continue;

      const point = map.project([vector.lon, vector.lat]);
      const speedKnots = Math.hypot(vector.u, vector.v) * KNOTS_PER_MS;
      const color = getWindColor(speedKnots);
      const length = clamp(16 + speedKnots * 0.25, 16, 34);
      const angle = Math.atan2(vector.u, vector.v);

      context.save();
      context.translate(point.x, point.y);
      context.rotate(angle);
      context.strokeStyle = color;
      context.fillStyle = color;
      context.lineWidth = 1.6;

      drawWindBarb(context, speedKnots, length);

      context.restore();
    }
  };

  useEffect(() => {
    windEnabledRef.current = windEnabled;
    if (!windEnabled) {
      setWindVectors([]);
    }
    drawWindVectors();
  }, [windEnabled]);

  useEffect(() => {
    windVectorsRef.current = windVectors;
    drawWindVectors();
  }, [windVectors]);

  useEffect(() => {
    if (!windEnabled || selectedForecastHour === null) {
      setWindVectors([]);
      return;
    }

    const step = getWindStep(mapRef.current, zoom ?? 0);
    const controller = new AbortController();

    const loadVectors = async () => {
      try {
        const response = await fetch(
          `/api/gfs/wind/vectors?fh=${selectedForecastHour}&step=${step}`,
          { signal: controller.signal }
        );
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        const data = (await response.json()) as WindVectorResponse;
        setWindVectors(Array.isArray(data.vectors) ? data.vectors : []);
      } catch (err) {
        if (controller.signal.aborted) return;
        console.warn('Failed to load wind vectors.', err);
        setWindVectors([]);
      }
    };

    loadVectors();

    return () => controller.abort();
  }, [windEnabled, selectedForecastHour, zoom]);

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

    const windCanvas = document.createElement('canvas');
    windCanvas.className = 'wind-overlay';
    windCanvasRef.current = windCanvas;
    const canvasContainer = map.getCanvasContainer();
    canvasContainer.appendChild(windCanvas);

    const resizeWindCanvas = () => {
      // map.getCanvasContainer() can report 0 height depending on CSS/layout.
      // Use the actual map canvas size as the source of truth.
      const rect = map.getCanvas().getBoundingClientRect();
      const clientWidth = Math.round(rect.width);
      const clientHeight = Math.round(rect.height);

      const dpr = window.devicePixelRatio || 1;
      windCanvas.width = Math.max(1, Math.round(clientWidth * dpr));
      windCanvas.height = Math.max(1, Math.round(clientHeight * dpr));
      windCanvas.style.width = `${clientWidth}px`;
      windCanvas.style.height = `${clientHeight}px`;

      const context = windCanvas.getContext('2d');
      if (context) {
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        context.lineCap = 'round';
      }
    };

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
      drawWindVectors();
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
      resizeWindCanvas();
      drawWindVectors();
    });

    setZoom(map.getZoom());
    const handleResize = () => {
      updateScaleIndicator();
      resizeWindCanvas();
      drawWindVectors();
    };

    map.on('mousemove', handleMouseMove);
    map.on('move', drawWindVectors);
    map.on('zoom', handleZoom);
    map.on('resize', handleResize);

    return () => {
      if (map) {
        map.off('click', 'oceanus-marker', handleMarkerClick);
        map.off('click', 'ais-marker', handleMarkerClick);

        map.off('mouseenter', 'oceanus-marker', handleMarkerEnter);
        map.off('mouseenter', 'ais-marker', handleMarkerEnter);

        map.off('mouseleave', 'oceanus-marker', handleMarkerLeave);
        map.off('mouseleave', 'ais-marker', handleMarkerLeave);

        map.off('mousemove', handleMouseMove);
        map.off('move', drawWindVectors);
        map.off('zoom', handleZoom);
        map.off('resize', handleResize);
      }
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      if (scaleControlRef.current) {
        map.removeControl(scaleControlRef.current);
        scaleControlRef.current = null;
      }
      if (windCanvasRef.current) {
        windCanvasRef.current.remove();
        windCanvasRef.current = null;
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