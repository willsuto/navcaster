import { useAppContext } from '../../store/AppContext';
import { getRiskColor, getGoNoGoColor } from '../../utils/weatherColors';
import { RiskAssessment, Vessel } from '../../types';

function RiskGauge({ score }: { score: number }) {
  const color = getRiskColor(score);
  return (
    <div className="risk-gauge">
      <div className="risk-bar-bg">
        <div className="risk-bar-fill" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
      <span className="risk-score" style={{ color }}>{score}</span>
    </div>
  );
}

function VesselCard({ vessel, risk }: { vessel: Vessel; risk?: RiskAssessment }) {
  const { dispatch, state } = useAppContext();
  const isSelected = state.selectedVesselId === vessel.id;

  return (
    <div
      className={`vessel-card ${isSelected ? 'selected' : ''}`}
      onClick={() => dispatch({ type: 'SELECT_VESSEL', id: isSelected ? null : vessel.id })}
    >
      <div className="vessel-header">
        <div>
          <span className="vessel-name">{vessel.name}</span>
          <span className="vessel-type">{vessel.type}</span>
        </div>
        {risk && (
          <span
            className="go-nogo-badge"
            style={{ backgroundColor: getGoNoGoColor(risk.goNoGo.decision) }}
          >
            {risk.goNoGo.decision}
          </span>
        )}
      </div>

      <div className="vessel-info">
        <span>⚓ {vessel.status}</span>
        <span>🧭 {vessel.heading}°</span>
        <span>⚡ {vessel.speed} kts</span>
      </div>

      {risk && (
        <>
          <div className="risk-label">Risk Score</div>
          <RiskGauge score={risk.score} />

          {isSelected && (
            <div className="risk-factors">
              {risk.factors.map(factor => (
                <div key={factor.name} className={`risk-factor factor-${factor.status}`}>
                  <span className="factor-name">{factor.name}</span>
                  <span className="factor-value">{factor.value}{factor.unit}</span>
                  <span className="factor-limit">/ {factor.threshold}{factor.unit}</span>
                </div>
              ))}
              <div className="go-nogo-detail">
                {risk.goNoGo.reasons.map((reason, i) => (
                  <div key={i} className="go-nogo-reason">{reason}</div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function VesselPanel() {
  const { state } = useAppContext();
  const { vessels, risks } = state;

  return (
    <div className="vessel-panel">
      <h3>Fleet Status</h3>
      <div className="vessel-list">
        {vessels.map(vessel => (
          <VesselCard
            key={vessel.id}
            vessel={vessel}
            risk={risks.find(r => r.vesselId === vessel.id)}
          />
        ))}
      </div>
    </div>
  );
}
