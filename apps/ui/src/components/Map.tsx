import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useVesselFeatureCollection } from '../store/aisGeoJson';

function Map() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const vesselData = useVesselFeatureCollection();
  const vesselDataRef = useRef(vesselData);

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

    const nav = new mapboxgl.NavigationControl({ showCompass: true, showZoom: false });
    map.addControl(nav, 'top-right');

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
                <span class="ais-popup__value">${cog}</span>
              </div>
              <div class="ais-popup__row">
                <span class="ais-popup__label">SOG</span>
                <span class="ais-popup__value">${sog}</span>
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
          const shoulderHalfWidth = 5;
          const maxHalfWidth = 10;

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
          // Tiny center notch so stern is visually distinct.
          context.lineTo(cx + 2, sternY);
          context.lineTo(cx + 1, sternY + 2);
          context.lineTo(cx - 1, sternY + 2);
          context.lineTo(cx - 2, sternY);
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
        id: 'vessels-marker-outline',
        type: 'symbol',
        source: 'vessels',
        layout: {
          'icon-image': vesselIconId,
          'icon-size': 1.45,
          'icon-rotation-alignment': 'map',
          'icon-rotate': [
            'coalesce',
            ['to-number', ['get', 'heading']],
            ['to-number', ['get', 'cog']],
            0
          ],
          'icon-allow-overlap': true
        },
        paint: {
          'icon-color': '#050a12',
          'icon-opacity': 0.9
        }
      });

      map.addLayer({
        id: 'vessels-marker',
        type: 'symbol',
        source: 'vessels',
        layout: {
          'icon-image': vesselIconId,
          'icon-size': 1.25,
          'icon-rotation-alignment': 'map',
          'icon-rotate': [
            'coalesce',
            ['to-number', ['get', 'heading']],
            ['to-number', ['get', 'cog']],
            0
          ],
          'icon-allow-overlap': true
        },
        paint: {
          'icon-color': '#4cc9f0'
        }
      });

      map.on('click', 'vessels-marker-outline', handleMarkerClick);
      map.on('click', 'vessels-marker', handleMarkerClick);

      map.on('mouseenter', 'vessels-marker-outline', handleMarkerEnter);
      map.on('mouseenter', 'vessels-marker', handleMarkerEnter);

      map.on('mouseleave', 'vessels-marker-outline', handleMarkerLeave);
      map.on('mouseleave', 'vessels-marker', handleMarkerLeave);

      map.setFog({
        color: '#030813',
        'high-color': '#0b2a4f',
        'horizon-blend': 0.24,
        'space-color': '#010205',
        'star-intensity': 0.25
      });
    });

    return () => {
      if (map) {
        map.off('click', 'vessels-marker-outline', handleMarkerClick);
        map.off('click', 'vessels-marker', handleMarkerClick);

        map.off('mouseenter', 'vessels-marker-outline', handleMarkerEnter);
        map.off('mouseenter', 'vessels-marker', handleMarkerEnter);

        map.off('mouseleave', 'vessels-marker-outline', handleMarkerLeave);
        map.off('mouseleave', 'vessels-marker', handleMarkerLeave);
      }
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
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