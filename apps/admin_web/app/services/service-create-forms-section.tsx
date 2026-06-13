import { createService, createServiceDurationSet } from './actions';

export function ServiceCreateFormsSection() {
  return (
    <>
      <section className="card admin-mb-16">
        <h2>Create service with duration options</h2>
        <p className="muted">
          This creates one service type with 60, 90, and 120 minute options. Leave a duration blank if that
          option should not be sold yet. Add Partner payout amounts now so each option can be booked
          immediately.
        </p>
        <form action={createServiceDurationSet} className="form-grid">
          <label>
            Group key (optional)
            <input name="serviceGroupKey" placeholder="auto from name, e.g. leg_massage" />
          </label>
          <label>
            Service name
            <input name="name" placeholder="Leg Massage" required />
          </label>
          <label>
            60 min minimum
            <input name="basePrice60" type="number" min="100000" step="100000" placeholder="500000" />
          </label>
          <label>
            60 min Partner payout
            <input name="providerPayoutAmount60" type="number" min="0" step="1000" placeholder="380000" />
          </label>
          <label>
            90 min minimum
            <input name="basePrice90" type="number" min="100000" step="100000" placeholder="700000" />
          </label>
          <label>
            90 min Partner payout
            <input name="providerPayoutAmount90" type="number" min="0" step="1000" placeholder="540000" />
          </label>
          <label>
            120 min minimum
            <input name="basePrice120" type="number" min="100000" step="100000" placeholder="900000" />
          </label>
          <label>
            120 min Partner payout
            <input name="providerPayoutAmount120" type="number" min="0" step="1000" placeholder="700000" />
          </label>
          <label>
            Price step
            <input name="priceStep" type="number" min="100000" step="100000" defaultValue="100000" />
          </label>
          <label>
            VAT bps
            <input name="vatBps" type="number" min="0" max="10000" defaultValue="0" />
          </label>
          <label>
            Other cost
            <input name="otherCostAmount" type="number" min="0" defaultValue="0" />
          </label>
          <label>
            Display order
            <input name="displayOrder" type="number" defaultValue="100" />
          </label>
          <label className="full-span">
            Description
            <input name="description" placeholder="Shown in customer and Partner apps" />
          </label>
          <button type="submit">Create duration set</button>
        </form>
      </section>

      <section className="card admin-mb-16">
        <h2>Add one duration option</h2>
        <p className="muted">
          Use this when an existing service type needs another duration. The group key connects the option to
          the parent service name in the customer app.
        </p>
        <form action={createService} className="form-grid">
          <label>
            Group key
            <input name="serviceGroupKey" placeholder="leg_massage" />
          </label>
          <label>
            Service name
            <input name="name" placeholder="Leg Massage" required />
          </label>
          <label>
            Duration
            <input name="durationMin" type="number" min="1" placeholder="60" required />
          </label>
          <label>
            Minimum price
            <input name="basePrice" type="number" min="100000" step="100000" placeholder="500000" required />
          </label>
          <label>
            Partner payout
            <input name="providerPayoutAmount" type="number" min="0" step="1000" placeholder="380000" />
          </label>
          <label>
            Price step
            <input name="priceStep" type="number" min="100000" step="100000" defaultValue="100000" />
          </label>
          <label>
            VAT bps
            <input name="vatBps" type="number" min="0" max="10000" defaultValue="0" />
          </label>
          <label>
            Other cost
            <input name="otherCostAmount" type="number" min="0" defaultValue="0" />
          </label>
          <label>
            Display order
            <input name="displayOrder" type="number" defaultValue="100" />
          </label>
          <label className="full-span">
            Description
            <input name="description" placeholder="Shown in customer and Partner apps" />
          </label>
          <button type="submit">Create service</button>
        </form>
      </section>
    </>
  );
}
