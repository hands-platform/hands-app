import type { AdminServiceCatalogItem, AdminTaxPolicyVersion } from '../../lib/admin-api';
import { formatMoney } from '../../lib/admin-format';
import { serviceBulkPayoutRuleExample } from '../../lib/service-bulk-payout-rule-example';
import { servicePayoutFinance } from '../../lib/service-payout-finance';
import { bulkUpsertPayoutRules, updatePayoutRule, upsertPayoutRule } from './actions';

type ServicePayoutRulesSectionProps = {
  readonly activeTaxPolicy: AdminTaxPolicyVersion | undefined;
  readonly service: AdminServiceCatalogItem;
};

export function ServicePayoutRulesSection({ activeTaxPolicy, service }: ServicePayoutRulesSectionProps) {
  return (
    <>
      <h3>Payout matrix</h3>
      <div className="setup-stage-list admin-mb-12">
        {(service.payoutRules ?? []).map((rule) => {
          const finance = servicePayoutFinance(service, rule, activeTaxPolicy);
          return (
            <div className="setup-stage-item" key={rule.id}>
              <span>{rule.active ? 'ON' : 'OFF'}</span>
              <div>
                <strong>
                  Customer {formatMoney(rule.customerPrice, rule.currency)} / partner{' '}
                  {formatMoney(rule.providerPayoutAmount, rule.currency)}
                </strong>
                <p className="muted">
                  Fee {formatMoney(finance.fee, rule.currency)} / VAT {formatBps(rule.vatBps)} ={' '}
                  {formatMoney(finance.vatAmount, rule.currency)} / other cost{' '}
                  {formatMoney(rule.otherCostAmount, rule.currency)}
                </p>
                <p className="muted">
                  Withholding projection {formatMoney(finance.withholdingAmount, rule.currency)}
                  {finance.taxRuleLabel ? ` via ${finance.taxRuleLabel}` : ' (no active rule)'}
                </p>
                <p className="muted">
                  Actual company commission after VAT/withholding/other:{' '}
                  {formatMoney(finance.actualCompanyCommission, rule.currency)}
                </p>
                <form action={updatePayoutRule} className="form-grid compact-form">
                  <input type="hidden" name="ruleId" value={rule.id} />
                  <label>
                    Customer price
                    <input
                      name="customerPrice"
                      type="number"
                      min={service.basePrice}
                      step={service.priceStep}
                      defaultValue={rule.customerPrice}
                    />
                  </label>
                  <label>
                    Partner payout
                    <input
                      name="providerPayoutAmount"
                      type="number"
                      min="0"
                      step="1000"
                      defaultValue={rule.providerPayoutAmount}
                    />
                  </label>
                  <label>
                    VAT bps
                    <input name="vatBps" type="number" min="0" max="10000" defaultValue={rule.vatBps} />
                  </label>
                  <label>
                    Other cost
                    <input name="otherCostAmount" type="number" min="0" defaultValue={rule.otherCostAmount} />
                  </label>
                  <label>
                    Notes
                    <input name="notes" defaultValue={rule.notes ?? ''} />
                  </label>
                  <label>
                    Active
                    <input name="active" type="checkbox" defaultChecked={rule.active} />
                  </label>
                  <button type="submit">Update payout</button>
                </form>
              </div>
              <small>{rule.id.slice(0, 8)}</small>
            </div>
          );
        })}
        {(service.payoutRules ?? []).length === 0 ? (
          <span className="muted">
            No payout rule yet. Bookings are blocked until a base payout rule is configured.
          </span>
        ) : null}
      </div>

      <form action={upsertPayoutRule} className="form-grid compact-form">
        <input type="hidden" name="serviceId" value={service.id} />
        <label>
          Customer price
          <input
            name="customerPrice"
            type="number"
            min={service.basePrice}
            step={service.priceStep}
            defaultValue={service.basePrice}
          />
        </label>
        <label>
          Partner payout
          <input
            name="providerPayoutAmount"
            type="number"
            min="0"
            step="1000"
            defaultValue={Math.max(0, service.basePrice - Math.round(service.basePrice * 0.2))}
          />
        </label>
        <label>
          VAT bps
          <input name="vatBps" type="number" min="0" max="10000" defaultValue="0" />
        </label>
        <label>
          Other cost
          <input name="otherCostAmount" type="number" min="0" defaultValue="0" />
        </label>
        <label className="full-span">
          Notes
          <input name="notes" placeholder="Internal finance memo" />
        </label>
        <button type="submit">Upsert payout rule</button>
      </form>

      <h3>Bulk payout ladder import</h3>
      <p className="muted">
        Paste one row per customer price as <code>customerPrice,partnerPayout</code>. This is saved
        atomically so partial payout ladders do not leak into booking.
      </p>
      <form action={bulkUpsertPayoutRules} className="form-grid compact-form">
        <input type="hidden" name="serviceId" value={service.id} />
        <label className="full-span">
          Price ladder rows
          <textarea
            name="rules"
            rows={4}
            defaultValue={serviceBulkPayoutRuleExample(service)}
            spellCheck={false}
          />
        </label>
        <label>
          VAT bps
          <input name="vatBps" type="number" min="0" max="10000" defaultValue="0" />
        </label>
        <label>
          Other cost
          <input name="otherCostAmount" type="number" min="0" defaultValue="0" />
        </label>
        <label className="full-span">
          Notes
          <input name="notes" placeholder="Internal finance memo for this ladder import" />
        </label>
        <button type="submit">Import payout ladder</button>
      </form>
    </>
  );
}

function formatBps(value: number) {
  return `${(value / 100).toFixed(2)}%`;
}
