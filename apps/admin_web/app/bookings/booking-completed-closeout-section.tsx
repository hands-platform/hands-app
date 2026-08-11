import { AdminDisclosure } from '../../components/admin-surface';

const COMPLETED_CLOSEOUT_FLOW = [
  {
    helper:
      'Check completed time, service address, Partner completion location, and retained chat in the booking detail.',
    label: '1. Confirm service record',
    value: 'Completion evidence',
  },
  {
    helper:
      'Resolve open closeout items before operator notes, settlement records, or refund review are treated as final.',
    label: '2. Check closeout records',
    value: 'Closeout status',
  },
  {
    helper:
      'Use one booking detail as the single record for customer, matched Partner, finance, and system evidence.',
    label: '3. Keep audit trail',
    value: 'Completed detail',
  },
] as const;

export function BookingCompletedCloseoutSection() {
  return (
    <AdminDisclosure
      ariaLabel="How to review closeout"
      className="booking-completed-closeout-card admin-mt-16"
    >
      <summary>
        <span>How to review closeout</span>
        <small>Service evidence, finance records, and retained audit trail</small>
      </summary>
      <div className="admin-disclosure-content">
        <div className="booking-post-match-decision-flow" aria-label="Completed closeout flow">
          {COMPLETED_CLOSEOUT_FLOW.map((item) => (
            <div className="booking-post-match-decision-step" key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <p>{item.helper}</p>
            </div>
          ))}
        </div>

        <div className="booking-post-match-operator-note admin-mt-14">
          <strong>Admin handling rule</strong>
          <span>
            Keep terminal bookings here for normal closeout review, then open the booking detail only
            when customer, final Partner, finance, or system evidence needs deeper inspection.
          </span>
        </div>
      </div>
    </AdminDisclosure>
  );
}
