export function OperationsPolicyAuthorityBaselineSection() {
  return (
    <section className="card admin-mb-16">
      <div className="ops-section-header">
        <div>
          <h2>MVP authority baseline</h2>
          <p className="muted">
            These rules are not CRM preferences. They are the operating authority for Vietnam booking,
            marketplace, and finance actions until a later product decision changes them.
          </p>
        </div>
        <span className="pill pill-success">Command center rules</span>
      </div>
      <div className="ops-task-grid admin-mt-14">
        <div className="ops-task-card ops-task-done">
          <span className="pill pill-success">BookingAddressSnapshot</span>
          <h3>Address snapshot required</h3>
          <p>
            Every booking must keep an immutable service address snapshot before distance matching,
            marketplace participation, payment evidence, and dispute review.
          </p>
          <small>Customers may browse globally; booking requires a confirmed Vietnam service address.</small>
        </div>
        <div className="ops-task-card ops-task-done">
          <span className="pill pill-success">No auto assignment</span>
          <h3>First-pick priority with fallback choice</h3>
          <p>
            The first-pick Partner can match first under API rules. If first-pick does not win, the customer
            chooses from eligible participating Partners.
          </p>
          <small>Operators review evidence, but the platform does not automatically assign the partner.</small>
        </div>
        <div className="ops-task-card ops-task-done">
          <span className="pill pill-info">10km marketplace</span>
          <h3>Booking-address radius</h3>
          <p>
            Marketplace participation and alerts are based on the booking address, not the customer&apos;s
            browsing location or current country.
          </p>
          <small>The radius is admin-editable and defaults to 10km for Vietnam operations.</small>
        </div>
        <div className="ops-task-card ops-task-done">
          <span className="pill pill-warn">Negative wallet gate</span>
          <h3>View demand, block finalization</h3>
          <p>
            A Partner with a negative wallet may see marketplace requests, but final acceptance, service
            start, and payout release wait until the unpaid platform fee is settled or cleared by finance.
          </p>
          <small>Direct first-pick response and already-matched service flow stay separate from this gate.</small>
        </div>
      </div>
    </section>
  );
}
