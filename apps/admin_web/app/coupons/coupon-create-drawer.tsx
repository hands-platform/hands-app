'use client';

import { useActionState, useMemo, useState } from 'react';
import { CheckCircle2, CircleAlert, Plus } from 'lucide-react';

import {
  AdminDrawerActionFooter,
  AdminDrawerFormGrid,
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormDateTime,
  AdminFormInput,
  AdminFormTextarea,
} from '../../components/admin-form-controls';
import { AdminInlineNotice } from '../../components/admin-inline-notice';
import { AdminNoticeCard } from '../../components/admin-surface';
import { StatusBadge } from '../../components/status-badge';
import { createCoupon } from './actions';
import { parseCouponCodeBatch } from './coupon-code-batch';
import { INITIAL_COUPON_CREATE_STATE } from './coupon-create-state';
import { CouponDrawerShell } from './coupon-drawer-shell';

type CouponCreateDrawerProps = {
  readonly closeHref: string;
};

export function CouponCreateDrawer({ closeHref }: CouponCreateDrawerProps) {
  const [state, formAction, pending] = useActionState(createCoupon, INITIAL_COUPON_CREATE_STATE);
  const [codesValue, setCodesValue] = useState('');
  const parsed = useMemo(() => parseCouponCodeBatch(codesValue), [codesValue]);
  const rejectedCount = parsed.invalid.length + parsed.tooLong.length + parsed.overLimit.length;

  return (
    <CouponDrawerShell
      closeHref={closeHref}
      eyebrow="Growth campaign setup"
      subtitle="New coupons are created as Paused. Review the ICT window, then activate deliberately."
      title="Create coupons"
      titleId="coupon-create-drawer-title"
    >
      <AdminNoticeCard tone="info">
        <strong>Safe launch sequence</strong>
        <p className="muted">
          Create as Paused, verify the code and checkout window, then activate from the list.
        </p>
      </AdminNoticeCard>

      {state.status !== 'idle' ? (
        <AdminInlineNotice
          className="coupon-create-result-notice admin-mt-16"
          role={state.status === 'error' ? 'alert' : 'status'}
          tone={state.status === 'success' ? 'success' : state.status === 'warning' ? 'warning' : 'danger'}
        >
          <strong>{state.status === 'success' ? 'Coupons created' : 'Creation result'}</strong>
          <span>{state.message}</span>
        </AdminInlineNotice>
      ) : null}

      {state.results.length > 0 ? (
        <ul className="coupon-create-result-list" aria-label="Coupon creation results">
          {state.results.map((result) => (
            <li key={result.code}>
              {result.ok ? (
                <CheckCircle2 aria-hidden="true" size={16} />
              ) : (
                <CircleAlert aria-hidden="true" size={16} />
              )}
              <strong>{result.code}</strong>
              <span>{result.ok ? 'Created as Paused' : (result.reason ?? 'Not created')}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <AdminDrawerFormGrid action={formAction} className="coupon-drawer-form admin-mt-16">
        <AdminFormTextarea
          className="admin-form-control-fluid admin-grid-span-2"
          label="Coupon codes"
          labelVisibility="visible"
          name="codes"
          onChange={(event) => setCodesValue(event.target.value)}
          placeholder="WELCOME10, SUMMER20"
          required
          rows={5}
          value={codesValue}
        />
        <div className="coupon-code-preview admin-grid-span-2" aria-live="polite">
          <span>{parsed.accepted.length} valid of 50 maximum</span>
          {parsed.duplicates.length > 0 ? <span>{parsed.duplicates.length} duplicate(s) ignored</span> : null}
          {rejectedCount > 0 ? <StatusBadge tone="danger">{rejectedCount} invalid</StatusBadge> : null}
        </div>

        <AdminFormInput
          className="admin-form-control-fluid admin-grid-span-2"
          label="Campaign description"
          labelVisibility="visible"
          maxLength={500}
          name="description"
          placeholder="Internal campaign purpose"
        />
        <AdminFormInput
          className="admin-form-control-fluid"
          label="Discount percent"
          labelVisibility="visible"
          max="100"
          min="1"
          name="percent"
          placeholder="10"
          required
          type="number"
        />
        <div className="coupon-ict-helper">
          <strong>Timezone</strong>
          <span className="muted">All campaign times use ICT (UTC+7).</span>
        </div>
        <AdminFormDateTime
          className="admin-form-control-fluid"
          label="Starts (ICT)"
          labelVisibility="visible"
          name="startsAt"
        />
        <AdminFormDateTime
          className="admin-form-control-fluid"
          label="Ends (ICT)"
          labelVisibility="visible"
          name="endsAt"
          required
        />
        <AdminNoticeCard className="admin-grid-span-2" tone="info">
          <strong>Checkout exposure limits · VND</strong>
          <p className="muted">
            Every active coupon needs a total cap, per-customer cap, and bounded budget.
          </p>
        </AdminNoticeCard>
        <AdminFormInput
          className="admin-form-control-fluid"
          defaultValue="100"
          label="Maximum redemptions"
          labelVisibility="visible"
          min="1"
          name="maxRedemptions"
          required
          type="number"
        />
        <AdminFormInput
          className="admin-form-control-fluid"
          defaultValue="1"
          label="Per-customer limit"
          labelVisibility="visible"
          min="1"
          name="perCustomerRedemptionLimit"
          required
          type="number"
        />
        <AdminFormInput
          className="admin-form-control-fluid"
          defaultValue="10000000"
          label="Gross campaign budget (VND)"
          labelVisibility="visible"
          min="1"
          name="grossBudgetAmount"
          required
          step="1"
          type="number"
        />
        <AdminFormInput
          className="admin-form-control-fluid"
          defaultValue="100000"
          label="Maximum discount / booking (VND)"
          labelVisibility="visible"
          min="1"
          name="maximumDiscountAmount"
          required
          step="1"
          type="number"
        />
        <AdminFormInput
          className="admin-form-control-fluid"
          defaultValue="0"
          label="Minimum order amount (VND)"
          labelVisibility="visible"
          min="0"
          name="minimumOrderAmount"
          required
          step="1"
          type="number"
        />

        <AdminDrawerActionFooter className="admin-grid-span-2">
          <AdminFormControlLink className="button-secondary" href={closeHref}>
            Cancel
          </AdminFormControlLink>
          <AdminFormControlButton
            className="button-primary"
            disabled={pending || parsed.accepted.length === 0 || rejectedCount > 0}
            type="submit"
          >
            <Plus aria-hidden="true" size={16} />
            {pending ? 'Creating coupons...' : 'Create as Paused'}
          </AdminFormControlButton>
        </AdminDrawerActionFooter>
      </AdminDrawerFormGrid>
    </CouponDrawerShell>
  );
}
