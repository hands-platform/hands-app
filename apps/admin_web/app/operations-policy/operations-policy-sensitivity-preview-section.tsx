import type { PolicySupplySensitivity } from './policy-supply-sensitivity';

type OperationsPolicySensitivityPreviewSectionProps = {
  readonly sensitivity: PolicySupplySensitivity;
};

export function OperationsPolicySensitivityPreviewSection({
  sensitivity,
}: OperationsPolicySensitivityPreviewSectionProps) {
  return (
    <section className="card admin-mb-16">
      <div className="ops-section-header">
        <div>
          <h2>Policy sensitivity preview</h2>
          <p className="muted">
            Before changing radius or location freshness, compare how many Partners would remain usable
            around the latest customer coordinate. This keeps policy choices tied to real supply instead of
            guesswork.
          </p>
        </div>
        <span className="pill pill-info">{sensitivity.currentPolicyLabel}</span>
      </div>
      <div className="service-trace-summary admin-mt-12">
        {sensitivity.summary.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.helper}</small>
          </div>
        ))}
      </div>
      <div className="detail-grid admin-mt-14">
        <div className="admin-scroll-x">
          <h3>Marketplace supply sensitivity</h3>
          <p className="muted">
            Reference point: {sensitivity.referenceLabel}. Marketplace blockers include account, identity,
            and bank readiness. Negative wallet stays visible and is shown as a marketplace/payout hold.
          </p>
          <table className="table service-trace">
            <thead>
              <tr>
                <th>Radius</th>
                <th>Visible Partners</th>
                <th>Fresh location</th>
                <th>Marketplace/payout held</th>
                <th>Operator read</th>
              </tr>
            </thead>
            <tbody>
              {sensitivity.radiusRows.map((row) => (
                <tr key={row.radiusLabel}>
                  <td>
                    <span className={`pill ${row.pillClass}`}>{row.radiusLabel}</span>
                  </td>
                  <td>{row.eligible}</td>
                  <td>{row.fresh}</td>
                  <td>{row.finalGateHeld}</td>
                  <td>{row.operatorRead}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="admin-scroll-x">
          <h3>Location freshness sensitivity</h3>
          <p className="muted">
            Shows how strict or loose freshness rules affect marketplace matching without real-time
            tracking.
          </p>
          <table className="table service-trace">
            <thead>
              <tr>
                <th>Freshness</th>
                <th>Eligible Partners</th>
                <th>Stale excluded</th>
                <th>Operator read</th>
              </tr>
            </thead>
            <tbody>
              {sensitivity.freshnessRows.map((row) => (
                <tr key={row.freshnessLabel}>
                  <td>
                    <span className={`pill ${row.pillClass}`}>{row.freshnessLabel}</span>
                  </td>
                  <td>{row.eligible}</td>
                  <td>{row.staleExcluded}</td>
                  <td>{row.operatorRead}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
