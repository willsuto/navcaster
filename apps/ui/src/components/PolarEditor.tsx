import { twaAngles, twsValues, usePolarStore } from '../store/polar';

function PolarEditor() {
  const table = usePolarStore((state) => state.table);
  const setSpeed = usePolarStore((state) => state.setSpeed);

  return (
    <div className="polar-editor" aria-label="Polar speed editor">
      <table className="polar-editor__table">
        <thead>
          <tr>
            <th className="polar-editor__corner"></th>
            {twsValues.map((tws) => (
              <th key={tws} className="polar-editor__heading">
                {tws} kt
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {twaAngles.map((angle) => (
            <tr key={angle}>
              <th className="polar-editor__angle">{angle}°</th>
              {twsValues.map((tws) => (
                <td key={tws}>
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    className="polar-editor__input"
                    value={Number.isFinite(table[tws][angle]) ? table[tws][angle] : 0}
                    onChange={(event) => {
                      const raw = event.target.value;
                      const next = raw === '' ? 0 : Number(raw);
                      if (!Number.isNaN(next)) {
                        setSpeed(tws, angle, next);
                      }
                    }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default PolarEditor;