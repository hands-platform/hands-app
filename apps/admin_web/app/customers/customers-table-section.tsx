import Link from 'next/link';
import { ArrowUpRight, BellRing, MapPin, MessageSquareText, ReceiptText, Smartphone, Wallet } from 'lucide-react';
import { AdminTableScroll } from '../../components/admin-data-table';
import type { CustomerManagementTableRow } from './customer-management-view-model';

type CustomersTableSectionProps = {
  readonly rows: readonly CustomerManagementTableRow[];
  readonly sortLabel: string;
};

export function CustomersTableSection({ rows, sortLabel }: CustomersTableSectionProps) {
  return (
    <section className="vuexy-customer-table-card" aria-labelledby="customer-directory-title">
      <div className="vuexy-customer-toolbar">
        <div>
          <h2 id="customer-directory-title">Customer directory</h2>
          <p>
            Vuexy-style customer management board using live HANDS customer profile, booking, payment,
            session, and chat facts.
          </p>
        </div>
        <div className="participant-list">
          <span className="pill pill-info">{rows.length} rows</span>
          <span className="pill pill-neutral">Sorted by {sortLabel}</span>
        </div>
      </div>

      <AdminTableScroll>
        <table className="table vuexy-customer-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Activity</th>
              <th>Service pattern</th>
              <th>Reachability</th>
              <th>Finance</th>
              <th>Ops trail</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <strong>No customers found</strong>
                  <p className="muted">Change the filters or clear the search to view customer records.</p>
                </td>
              </tr>
            ) : null}
            {rows.map((row) => (
              <tr key={row.customerIdLabel}>
                <td>
                  <div className="vuexy-customer-person">
                    <span className="vuexy-customer-avatar">{row.initials}</span>
                    <div>
                      <strong>{row.name}</strong>
                      <span>{row.phone}</span>
                      <span>{row.email}</span>
                      <small>
                        {row.customerIdLabel} / joined {row.joinedLabel}
                      </small>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="vuexy-customer-stack">
                    <strong>{row.activityLabel}</strong>
                    <span>{row.activityDetail}</span>
                    <small>{row.bookingLabel}</small>
                  </div>
                </td>
                <td>
                  <div className="vuexy-customer-stack">
                    <strong>{row.patternLabel}</strong>
                    <span>{row.patternDetail}</span>
                    <small>{row.closureLabel}</small>
                  </div>
                </td>
                <td>
                  <div className="vuexy-customer-stack">
                    <strong>{row.reachabilityLabel}</strong>
                    <span>{row.reachabilityDetail}</span>
                    <small>{row.sessionLabel}</small>
                    <div className="vuexy-customer-inline-tags">
                      <span className="pill pill-info">
                        <MapPin aria-hidden="true" size={14} />
                        {row.addressLabel}
                      </span>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="vuexy-customer-stack">
                    <strong>{row.financeLabel}</strong>
                    <span>{row.financeDetail}</span>
                    <div className="vuexy-customer-inline-tags">
                      <span className="pill pill-success">
                        <Wallet aria-hidden="true" size={14} />
                        Paid
                      </span>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="vuexy-customer-stack">
                    <strong>{row.opsLabel}</strong>
                    <span>{row.opsDetail}</span>
                    <div className="vuexy-customer-inline-tags">
                      <span className="pill pill-neutral">
                        <MessageSquareText aria-hidden="true" size={14} />
                        {row.chatLabel}
                      </span>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="vuexy-customer-actions">
                    <Link className="vuexy-customer-action-link" href={row.detailHref}>
                      <ArrowUpRight aria-hidden="true" size={16} />
                      Open
                    </Link>
                    <Link className="vuexy-customer-action-link is-muted" href={row.paymentsHref}>
                      <ReceiptText aria-hidden="true" size={16} />
                      Payments
                    </Link>
                    <Link className="vuexy-customer-action-link is-muted" href={row.chatHref}>
                      <BellRing aria-hidden="true" size={16} />
                      Chats
                    </Link>
                    <span className="vuexy-customer-action-meta">
                      <Smartphone aria-hidden="true" size={14} />
                      {row.sessionLabel}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </AdminTableScroll>
    </section>
  );
}
