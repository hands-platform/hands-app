import Link from 'next/link';

import type {
  AdminBookingSettlementSnapshotSummary,
  AdminPartnerWithholdingTaxSummary,
} from '../../lib/admin-api';
import { adminGet } from '../../lib/admin-api';
import { AdminPageTemplate, AdminSectionHeader } from '../../components/admin-page-template';
import { formatMoney } from '../../lib/admin-format';
import {
  bookingSettlementAuditHref,
  buildBookingSettlementSnapshotSummaryApiHref,
  buildPartnerWithholdingTaxSummaryApiHref,
  buildTaxFinanceMetrics,
  emptyBookingSettlementSummary,
  emptyPartnerWithholdingTaxSummary,
  partnerWithholdingTaxHref,
  readBookingSettlementFilters,
  readPartnerWithholdingTaxFilters,
} from './tax-settlement-page-model';

type FinanceTaxPageProps = {
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FinanceTaxPage({ searchParams }: FinanceTaxPageProps) {
  const params = searchParams ? await searchParams : {};
  const settlementFilters = readBookingSettlementFilters(params);
  const withholdingFilters = readPartnerWithholdingTaxFilters(params);
  const [settlementSummary, withholdingSummary] = await Promise.all([
    adminGet<AdminBookingSettlementSnapshotSummary>(
      buildBookingSettlementSnapshotSummaryApiHref(settlementFilters),
      emptyBookingSettlementSummary(),
    ),
    adminGet<AdminPartnerWithholdingTaxSummary>(
      buildPartnerWithholdingTaxSummaryApiHref(withholdingFilters),
      emptyPartnerWithholdingTaxSummary(withholdingFilters.period),
    ),
  ]);

  const currency = settlementSummary.currency || withholdingSummary.currency || 'VND';

  return (
    <AdminPageTemplate
      actions={
        <>
          <Link className="pill pill-info" href={bookingSettlementAuditHref(settlementFilters)}>
            Booking settlement audit
          </Link>
          <Link className="pill pill-info" href={partnerWithholdingTaxHref(withholdingFilters)}>
            Partner withholding tax
          </Link>
        </>
      }
      description="Tax, fee, VAT, PIT, payment fee, and immutable booking settlement snapshot control view."
      metrics={buildTaxFinanceMetrics(settlementSummary, withholdingSummary)}
      title="Tax Overview"
    >
      <section className="card admin-mb-16">
        <AdminSectionHeader
          description="Use the summary APIs first. Open the bounded audit lists only when a finance operator needs booking-level evidence."
          status={<span className="pill pill-success">Summary API</span>}
          title="Tax finance operating model"
        />
        <div className="setup-stage-list admin-mt-12">
          <div className="setup-stage-item">
            <span>1</span>
            <div>
              <strong>Booking snapshot is immutable</strong>
              <p className="muted">
                Completed booking settlement stores customer payment, Partner payout, VAT/PIT, payment fee, and
                company VAT values at posting time.
              </p>
            </div>
            <small>{settlementSummary.count} rows</small>
          </div>
          <div className="setup-stage-item">
            <span>2</span>
            <div>
              <strong>Partner tax is monthly</strong>
              <p className="muted">
                Partner withholding is grouped by month and Partner. Current period: {withholdingSummary.period}.
              </p>
            </div>
            <small>{withholdingSummary.partnerCountWithRevenue} partners</small>
          </div>
          <div className="setup-stage-item">
            <span>3</span>
            <div>
              <strong>Finance uses snapshot totals</strong>
              <p className="muted">
                Company net fee is {formatMoney(settlementSummary.platformFeeNetRevenue, currency)} before payment
                processing cost of {formatMoney(settlementSummary.paymentProcessingFee, currency)}.
              </p>
            </div>
            <small>{formatMoney(settlementSummary.companyOutputVat, currency)} VAT</small>
          </div>
        </div>
      </section>

      <section className="card admin-mb-16">
        <AdminSectionHeader
          description="Keep these two workspaces separate: one reviews booking-level immutable evidence, the other reviews Partner monthly withholding totals."
          title="Finance tax workspaces"
        />
        <div className="setup-stage-list admin-mt-12">
          <Link className="setup-stage-item" href={bookingSettlementAuditHref(settlementFilters)}>
            <span>AUDIT</span>
            <div>
              <strong>Booking Settlement Audit</strong>
              <p className="muted">
                Today/needs-action by default. Review posted, cash, non-cash, declared, paid, and reversed snapshots.
              </p>
            </div>
            <small>{settlementSummary.openTaxCount} open</small>
          </Link>
          <Link className="setup-stage-item" href={partnerWithholdingTaxHref(withholdingFilters)}>
            <span>TAX</span>
            <div>
              <strong>Partner Withholding Tax</strong>
              <p className="muted">
                Monthly Partner VAT/PIT totals for manual tax and payout closeout review.
              </p>
            </div>
            <small>{formatMoney(withholdingSummary.totalPartnerTaxWithheld, withholdingSummary.currency)}</small>
          </Link>
          <Link className="setup-stage-item" href="/tax-policy">
            <span>RULES</span>
            <div>
              <strong>Tax Policy</strong>
              <p className="muted">
                Configure versioned tax rules. Historical settlement snapshots keep their own tax values.
              </p>
            </div>
            <small>Policy</small>
          </Link>
        </div>
      </section>
    </AdminPageTemplate>
  );
}
