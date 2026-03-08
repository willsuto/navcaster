import { useMapLayersStore } from '../store/mapLayers';

function LayerPanel() {
  const aisEnabled = useMapLayersStore((state) => state.aisEnabled);
  const oceanusEnabled = useMapLayersStore((state) => state.oceanusEnabled);
  const trackEnabled = useMapLayersStore((state) => state.trackEnabled);
  const setAisEnabled = useMapLayersStore((state) => state.setAisEnabled);
  const setOceanusEnabled = useMapLayersStore((state) => state.setOceanusEnabled);
  const setTrackEnabled = useMapLayersStore((state) => state.setTrackEnabled);

  return (
    <section className="layer-panel" aria-label="Map layer toggles">
      <div className="layer-panel__row">
        <span className="layer-panel__label">AIS</span>
        <button
          type="button"
          className={`layer-panel__toggle${aisEnabled ? ' layer-panel__toggle--active' : ''}`}
          onClick={() => setAisEnabled(!aisEnabled)}
          aria-pressed={aisEnabled}
        >
          {aisEnabled ? 'On' : 'Off'}
        </button>
      </div>
      <div className="layer-panel__row">
        <span className="layer-panel__label">Oceanus</span>
        <button
          type="button"
          className={`layer-panel__toggle${oceanusEnabled ? ' layer-panel__toggle--active' : ''}`}
          onClick={() => setOceanusEnabled(!oceanusEnabled)}
          aria-pressed={oceanusEnabled}
        >
          {oceanusEnabled ? 'On' : 'Off'}
        </button>
      </div>
      <div className="layer-panel__row">
        <span className="layer-panel__label">Track</span>
        <button
          type="button"
          className={`layer-panel__toggle${trackEnabled ? ' layer-panel__toggle--active' : ''}`}
          onClick={() => setTrackEnabled(!trackEnabled)}
          aria-pressed={trackEnabled}
        >
          {trackEnabled ? 'On' : 'Off'}
        </button>
      </div>
    </section>
  );
}

export default LayerPanel;