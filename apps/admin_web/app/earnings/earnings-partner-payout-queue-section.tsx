import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminFormControlButton, AdminFormShell } from '../../components/admin-form-controls';
import { AdminInlineFallback } from '../../components/admin-inline-fallback';
import { AdminStageItem } from '../../components/admin-stage-item';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { AdminTextLink } from '../../components/admin-text-link';
import { MoneyText } from '../../components/money-text';

export type EarningsPartnerPayoutQueueGroup = {
  readonly activeBatchSummary: string | null;
  readonly canBatch: boolean;
  readonly cashDebtAmount: number;
  readonly currency: string;
  readonly nextAction: string;
  readonly providerHref: string;
  readonly providerName: string;
  readonly providerProfileId: string;
  readonly status: string;
  readonly transferRef: string;
  readonly unbatchedCount: number;
  readonly unbatchedNet: number;
  readonly walletBalance: number;
  readonly withholdingAmount: number;
};

type EarningsPartnerPayoutQueueSectionProps = {
  readonly groups: readonly EarningsPartnerPayoutQueueGroup[];
};

export function EarningsPartnerPayoutQueueSection({ groups }: EarningsPartnerPayoutQueueSectionProps) {
  return (
    <AdminTablePanel
      description="Grouped by Partner so finance can create one payout batch for all eligible unpaid earnings."
      resultLabel={`${groups.length} Partner(s)`}
      resultTone={groups.length > 0 ? 'info' : 'warning'}
      title="Partner payout queue"
    >
      {groups.length ? (
        <div className="setup-stage-list">
          {groups.slice(0, 12).map((group) => (
            <AdminStageItem key={group.providerProfileId}>
              <span>{group.status}</span>
              <div>
                <strong>{group.providerName}</strong>
                <p className="muted">
                  {group.unbatchedCount} unbatched earning(s) / net{' '}
                  <MoneyText amount={group.unbatchedNet} currency={group.currency} />
                  {' / '}withholding <MoneyText amount={group.withholdingAmount} currency={group.currency} />
                </p>
                <p className="muted">
                  Wallet balance <MoneyText amount={group.walletBalance} currency={group.currency} />
                  {group.cashDebtAmount > 0 ? (
                    <>
                      {' / '}cash debt <MoneyText amount={group.cashDebtAmount} currency={group.currency} /> blocks payout
                      batching
                    </>
                  ) : (
                    ' / no cash debt'
                  )}
                </p>
                <p className="muted">{group.activeBatchSummary ?? group.nextAction}</p>
              </div>
              <div className="actions">
                <AdminTextLink href={group.providerHref}>
                  Partner
                </AdminTextLink>
                {group.canBatch ? (
                  <AdminFormShell action="/earnings">
                    <input type="hidden" name="confirm" value="create-payout" />
                    <input type="hidden" name="providerProfileId" value={group.providerProfileId} />
                    <input type="hidden" name="transferRef" value={group.transferRef} />
                    <AdminFormControlButton className="button-primary" type="submit">
                      Review payout batch
                    </AdminFormControlButton>
                  </AdminFormShell>
                ) : (
                  <AdminInlineFallback>No batch action</AdminInlineFallback>
                )}
              </div>
            </AdminStageItem>
          ))}
        </div>
      ) : (
        <AdminEmptyState framed message="No Partner has unpaid earnings in the current admin result window." />
      )}
    </AdminTablePanel>
  );
}
