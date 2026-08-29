'use client';

import { Fragment, useEffect, useState } from 'react';

import { AdminDataTable } from '../../components/admin-data-table';
import { AdminFormControlButton } from '../../components/admin-form-controls';
import { AdminTextLink } from '../../components/admin-text-link';
import { MoneyText } from '../../components/money-text';
import { AdminSignal, StatusBadgeFromPillClass } from '../../components/status-badge';
import type { RefundTableRow } from './refunds-table-section';

const REFUND_HASH_ID = /^[A-Za-z0-9_-]+$/u;

export function parseRefundHashTarget(hash: string) {
  const prefix = hash.startsWith('#refund-review-')
    ? '#refund-review-'
    : hash.startsWith('#refund-')
      ? '#refund-'
      : null;
  if (!prefix) return null;

  try {
    const id = decodeURIComponent(hash.slice(prefix.length));
    return REFUND_HASH_ID.test(id)
      ? { id, kind: prefix === '#refund-review-' ? 'checklist' as const : 'row' as const }
      : null;
  } catch {
    return null;
  }
}

export function focusRefundHashRow(target: HTMLElement) {
  target.focus({ preventScroll: true });
}

export function RefundRowsTable({ rows }: { readonly rows: readonly RefundTableRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let frame = 0;
    const applyHashTarget = () => {
      const hashTarget = parseRefundHashTarget(window.location.hash);
      if (!hashTarget || !rows.some((row) => row.id === hashTarget.id)) return;

      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        if (hashTarget.kind === 'checklist') {
          setOpenId(hashTarget.id);
        } else {
          const target = document.getElementById(`refund-${hashTarget.id}`);
          if (target) focusRefundHashRow(target);
        }
      });
    };

    applyHashTarget();
    window.addEventListener('hashchange', applyHashTarget);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('hashchange', applyHashTarget);
    };
  }, [rows]);

  useEffect(() => {
    if (!openId) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpenId(null);
      window.requestAnimationFrame(() => document.getElementById(`refund-checklist-toggle-${openId}`)?.focus());
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [openId]);

  return (
    <AdminDataTable
      className="refund-operations-table"
      emptyMessage="No refund cases match this view."
      headers={['Stage', 'Customer / booking', 'Amount / payment', 'Reason / source', 'Control readiness', 'Owner / action']}
      rowCount={rows.length}
    >
      {rows.map((row) => {
        const isOpen = openId === row.id;
        const reviewId = `refund-review-${row.id}`;
        return (
          <Fragment key={row.id}>
            <tr className="refund-case-row" id={`refund-${row.id}`} tabIndex={-1}>
              <td>
                <AdminSignal tone={row.opsTone}>{row.stageLabel}</AdminSignal>
                <span className="refund-case-age">{row.ageLabel}</span>
                <small>{row.createdAtLabel}</small>
                <small title={row.id}>Refund {row.shortId}</small>
              </td>
              <td>
                {row.customerHref ? <AdminTextLink href={row.customerHref}>{row.customerLabel}</AdminTextLink> : <strong>{row.customerLabel}</strong>}
                <small title={row.bookingId}>Booking {row.bookingIdLabel} · {row.bookingStatus}</small>
                <AdminTextLink href={row.bookingHref}>Open booking</AdminTextLink>
              </td>
              <td>
                <MoneyText amount={row.amount} currency={row.currency} />
                <small title={row.paymentId}>{row.paymentLabel}</small>
                <AdminTextLink href={row.paymentHref}>Open payment</AdminTextLink>
              </td>
              <td>
                <strong>{row.reason}</strong>
                <small>Source: {row.requestSource}</small>
              </td>
              <td>
                <strong>{row.evidenceLabel}</strong>
                <small>{row.evidenceBlockerLabel}</small>
                <AdminFormControlButton
                  aria-controls={reviewId}
                  aria-expanded={isOpen}
                  className="text-link refund-checklist-toggle"
                  id={`refund-checklist-toggle-${row.id}`}
                  onClick={() => setOpenId(isOpen ? null : row.id)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    setOpenId(isOpen ? null : row.id);
                  }}
                  type="button"
                >
                  {isOpen ? 'Close checklist' : 'Review checklist'}
                </AdminFormControlButton>
              </td>
              <td>
                <strong>{row.workstreamLabel}</strong>
                <small>{row.opsHint}</small>
                <AdminTextLink className="refund-primary-action" href={row.primaryActionHref}>{row.primaryActionLabel}</AdminTextLink>
              </td>
            </tr>
            {isOpen ? (
              <tr className="refund-review-row">
                <td colSpan={6}>
                  <section aria-label={`Review checklist for refund ${row.shortId}`} className="refund-review-details" id={reviewId}>
                    <div className="refund-review-content">
                      <div className="refund-review-context">
                        <div><span>Refund</span><strong>{row.id}</strong></div>
                        <div><span>Customer</span><strong>{row.customerLabel}</strong></div>
                        <div><span>Booking</span><strong>{row.bookingId} · {row.bookingStatus}</strong></div>
                        <div><span>Payment</span><strong>{row.paymentId} · {row.paymentLabel}</strong></div>
                        <div><span>Amount</span><strong><MoneyText amount={row.amount} currency={row.currency} /></strong></div>
                      </div>
                      <div className="refund-review-checklist">
                        {row.checklistRows.map((item) => (
                          <div className="refund-review-check" key={`${row.id}-${item.label}`}>
                            <StatusBadgeFromPillClass pillClass={item.pillClass}>{item.status}</StatusBadgeFromPillClass>
                            <div><strong>{item.label}</strong><p className="muted">{item.detail}</p></div>
                          </div>
                        ))}
                      </div>
                      <div className="refund-review-actions">
                        <AdminTextLink href={row.primaryActionHref}>{row.primaryActionLabel}</AdminTextLink>
                        <AdminTextLink href={row.paymentHref}>Open payment</AdminTextLink>
                        <AdminTextLink href={row.bookingHref}>Open booking</AdminTextLink>
                      </div>
                    </div>
                  </section>
                </td>
              </tr>
            ) : null}
          </Fragment>
        );
      })}
    </AdminDataTable>
  );
}
