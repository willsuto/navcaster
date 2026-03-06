import { useAppContext } from '../../store/AppContext';
import { Alert } from '../../types';

function AlertItem({ alert }: { alert: Alert }) {
  const { dispatch } = useAppContext();

  const severityClass = `alert-item alert-${alert.severity}`;
  const icon = alert.severity === 'critical' ? '🔴' : alert.severity === 'warning' ? '🟡' : 'ℹ️';

  return (
    <div className={`${severityClass} ${alert.acknowledged ? 'acknowledged' : ''}`}>
      <div className="alert-header">
        <span className="alert-icon">{icon}</span>
        <div className="alert-title">
          <span className="alert-vessel">{alert.vesselName}</span>
          <span className="alert-message">{alert.message}</span>
        </div>
        {!alert.acknowledged && (
          <button
            className="ack-button"
            onClick={() => dispatch({ type: 'ACKNOWLEDGE_ALERT', id: alert.id })}
            title="Acknowledge"
          >
            ✓
          </button>
        )}
      </div>
      <p className="alert-detail">{alert.detail}</p>
      {alert.forecastHours > 0 && (
        <span className="alert-forecast">Forecast: +{alert.forecastHours}h</span>
      )}
    </div>
  );
}

export default function AlertPanel() {
  const { state } = useAppContext();
  const activeAlerts = state.alerts.filter(a => !a.acknowledged);
  const criticalCount = activeAlerts.filter(a => a.severity === 'critical').length;

  return (
    <div className="alert-panel">
      <div className="alert-panel-header">
        <h3>Active Alerts</h3>
        {criticalCount > 0 && (
          <span className="alert-count critical">{criticalCount} Critical</span>
        )}
        {activeAlerts.length === 0 && (
          <span className="alert-count clear">All Clear</span>
        )}
      </div>
      <div className="alert-list">
        {activeAlerts.length === 0 ? (
          <div className="no-alerts">✅ No active alerts</div>
        ) : (
          activeAlerts.map(alert => <AlertItem key={alert.id} alert={alert} />)
        )}
      </div>
    </div>
  );
}
