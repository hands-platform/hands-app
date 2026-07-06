import { AdminSectionHeader } from '../../components/admin-page-template';
import { AdminTraceSummary } from '../../components/admin-overview-card';
import { AdminActionCard, AdminTaskCard } from '../../components/admin-surface';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { AdminTextLink } from '../../components/admin-text-link';
import { StatusBadge, statusBadgeToneFromPillClass } from '../../components/status-badge';
import type { CashSettlementPriorityBoardRow } from './cash-settlement-priority-board-section';
import { CashSettlementPriorityBoardSection } from './cash-settlement-priority-board-section';
import type {
  AppliedCashSettlementPolicyCard,
  CashSettlementHandoffItem,
  CommandCard,
  EvidenceChecklistItem,
  WalletRecoveryStep,
} from './cash-settlement-page-types';

type ExecutionSectionProps = {
  readonly executionDesk: readonly CommandCard[];
  readonly priorityBoardRows: readonly CashSettlementPriorityBoardRow[];
};

type RulesSectionProps = {
  readonly appliedPolicyCards: readonly AppliedCashSettlementPolicyCard[];
  readonly settlementRuleCards: readonly CommandCard[];
};

type WorkflowSectionsProps = {
  readonly commandCards: readonly CommandCard[];
  readonly debtCauseCards: readonly CommandCard[];
  readonly evidenceChecklist: readonly EvidenceChecklistItem[];
  readonly recoverySteps: readonly WalletRecoveryStep[];
  readonly settlementHandoff: readonly CashSettlementHandoffItem[];
};

export function CashSettlementExecutionSection({ executionDesk, priorityBoardRows }: ExecutionSectionProps) {
  return (
    <AdminTablePanel
      description="Operator-first view for clearing Partner cash-fee debt. It does not judge Partner quality; it only shows what must be evidenced before final acceptance, service start, and payout release reopen."
      resultLabel={`${priorityBoardRows.length} priority row(s)`}
      resultTone={priorityBoardRows.length > 0 ? 'warning' : 'success'}
      title="Cash settlement execution desk"
    >
      <div className="participant-list admin-mb-12">
        <AdminTextLink href="/audit-log?bucket=Finance%2FCloseout">
          Audit evidence
        </AdminTextLink>
      </div>
      <CommandCardGrid cards={executionDesk} />
      <AdminSectionHeader
        actions={
          <AdminTextLink href="/cash-settlements?queue=high-debt">
            High debt queue
          </AdminTextLink>
        }
        className="admin-mt-16"
        description="Sort order is amount first, then age. Confirm bank deposit evidence or a documented admin offset before pressing the settlement action on a row."
        title="Settlement priority board"
      />
      <CashSettlementPriorityBoardSection rows={priorityBoardRows} />
    </AdminTablePanel>
  );
}

export function CashSettlementRulesSection({ appliedPolicyCards, settlementRuleCards }: RulesSectionProps) {
  return (
    <AdminTablePanel
      description="Use this as the first read before finance calls a Partner or clears a wallet. The rule is factual: cash fee debt gates final acceptance, service start, and payout release, not customer access or account status."
      resultLabel={`${settlementRuleCards.length} rule(s)`}
      resultTone="info"
      title="Cash fee operating rules"
    >
      <div className="participant-list admin-mb-12">
        <AdminTextLink href="/operations-policy?review=wallet">
          Wallet policy
        </AdminTextLink>
      </div>
      <AdminSectionHeader
        className="admin-mt-14"
        description="Live Admin policy values used by finance before clearing Partner cash-fee debt and reopening final acceptance, service start, and payout release."
        status={<StatusBadge tone="info">Live policy default</StatusBadge>}
        title="Applied operations policy"
      />
      <AdminTraceSummary
        className="admin-mt-12"
        metrics={appliedPolicyCards.map((card) => ({
          detail: card.helper,
          label: card.label,
          value: card.value,
        }))}
      />
      <CommandCardGrid cards={settlementRuleCards} />
    </AdminTablePanel>
  );
}

export function CashSettlementWorkflowSections({
  commandCards,
  debtCauseCards,
  evidenceChecklist,
  recoverySteps,
  settlementHandoff,
}: WorkflowSectionsProps) {
  return (
    <>
      <CommandCardSection
        cards={debtCauseCards}
        description="Factual breakdown of why Partner wallets are negative. Use this before contacting a Partner or approving an admin offset."
        href="/payments?review=cash-debt"
        linkLabel="Review cash payments"
        title="Debt cause board"
      />
      <AdminTablePanel
        description="Standard operating flow for reopening final acceptance, service start, and payout release after cash-fee debt is paid or offset. This does not track blocked marketplace attempts."
        resultLabel={`${recoverySteps.length} step(s)`}
        resultTone={recoverySteps.length > 0 ? 'warning' : 'success'}
        title="Cash fee settlement workflow"
      >
        <div className="participant-list admin-mb-12">
          <AdminTextLink href="/partner-controls?review=cash-debt">
            Open Partner controls
          </AdminTextLink>
        </div>
        <div className="setup-stage-list admin-mt-12">
          {recoverySteps.map((step) => (
            <div className="setup-stage-item" key={step.title}>
              <StatusBadge tone={statusBadgeToneFromPillClass(step.pillClass)}>{step.status}</StatusBadge>
              <div>
                <strong>{step.title}</strong>
                <p className="muted">{step.detail}</p>
                <small>{step.operatorRule}</small>
              </div>
            </div>
          ))}
        </div>
      </AdminTablePanel>
      <LinkedCardSection
        description="Follow a cash booking from customer payment evidence to Partner wallet reopening and payout release. Marketplace viewing attempts are not tracked; actual marketplace participants remain on the booking record."
        href="/bookings?view=cash-debt"
        items={settlementHandoff}
        linkLabel="Booking cash debt queue"
        title="Cash settlement handoff map"
      />
      <CommandCardSection
        cards={commandCards}
        description="Work from the highest debt and oldest debt first. Every settlement needs an auditable reference before the Partner wallet can reopen."
        href="/earnings"
        linkLabel="Open earnings"
        title="Settlement command queue"
      />
      <LinkedCardSection
        description="Operator checklist for cash bookings where the Partner collected customer cash and HANDS is waiting for a company-fee deposit or approved offset."
        href="/bookings?view=cash-debt"
        items={evidenceChecklist}
        linkLabel="Booking cash debt queue"
        title="Cash settlement evidence checklist"
      />
    </>
  );
}

function CommandCardSection({
  cards,
  description,
  href,
  linkLabel,
  title,
}: {
  readonly cards: readonly CommandCard[];
  readonly description: string;
  readonly href: string;
  readonly linkLabel: string;
  readonly title: string;
}) {
  return (
    <AdminTablePanel
      description={description}
      resultLabel={`${cards.length} item(s)`}
      resultTone={cards.length > 0 ? 'warning' : 'success'}
      title={title}
    >
      <div className="participant-list admin-mb-12">
        <AdminTextLink href={href}>
          {linkLabel}
        </AdminTextLink>
      </div>
      <CommandCardGrid cards={cards} />
    </AdminTablePanel>
  );
}

function CommandCardGrid({ cards }: { readonly cards: readonly CommandCard[] }) {
  return (
    <div className="ops-task-grid">
      {cards.map((card) => (
        <AdminTaskCard
          actionLabel={card.action}
          className={card.className}
          detail={card.detail}
          key={card.title}
          leading={<StatusBadge tone={statusBadgeToneFromPillClass(card.pillClass)}>{card.status}</StatusBadge>}
          title={card.title}
        />
      ))}
    </div>
  );
}

function LinkedCardSection({
  description,
  href,
  items,
  linkLabel,
  title,
}: {
  readonly description: string;
  readonly href: string;
  readonly items: readonly EvidenceChecklistItem[];
  readonly linkLabel: string;
  readonly title: string;
}) {
  return (
    <AdminTablePanel
      description={description}
      resultLabel={`${items.length} item(s)`}
      resultTone={items.length > 0 ? 'warning' : 'success'}
      title={title}
    >
      <div className="participant-list admin-mb-12">
        <AdminTextLink href={href}>
          {linkLabel}
        </AdminTextLink>
      </div>
      <div className="ops-task-grid">
        {items.map((item) => (
          <AdminActionCard
            actionLabel={item.operatorRule}
            className={item.className}
            detail={item.detail}
            href={item.href}
            key={item.title}
            leading={<StatusBadge tone={statusBadgeToneFromPillClass(item.pillClass)}>{item.status}</StatusBadge>}
            title={item.title}
            variant="ops-task"
          />
        ))}
      </div>
    </AdminTablePanel>
  );
}
