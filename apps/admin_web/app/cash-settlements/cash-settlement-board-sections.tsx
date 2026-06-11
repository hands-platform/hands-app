import Link from 'next/link';
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
    <section className="card admin-mb-16">
      <div className="ops-section-header">
        <div>
          <h2>Cash settlement execution desk</h2>
          <p className="muted">
            Operator-first view for clearing partner cash-fee debt. It does not judge partner quality; it only
            shows what must be evidenced before final acceptance, service start, and payout release reopen.
          </p>
        </div>
        <Link className="text-link" href="/audit-log?bucket=Finance%2FCloseout">
          Audit evidence
        </Link>
      </div>
      <CommandCardGrid cards={executionDesk} />
      <div className="ops-section-header admin-mt-16">
        <div>
          <h3>Settlement priority board</h3>
          <p className="muted">
            Sort order is amount first, then age. Confirm bank deposit evidence or a documented admin offset
            before pressing the settlement action on a row.
          </p>
        </div>
        <Link className="text-link" href="/cash-settlements?queue=high-debt">
          High debt queue
        </Link>
      </div>
      <CashSettlementPriorityBoardSection rows={priorityBoardRows} />
    </section>
  );
}

export function CashSettlementRulesSection({ appliedPolicyCards, settlementRuleCards }: RulesSectionProps) {
  return (
    <section className="card admin-mb-16">
      <div className="ops-section-header">
        <div>
          <h2>Cash fee operating rules</h2>
          <p className="muted">
            Use this as the first read before finance calls a partner or clears a wallet. The rule is factual:
            cash fee debt gates final acceptance, service start, and payout release, not customer access or
            account status.
          </p>
        </div>
        <Link className="text-link" href="/operations-policy?review=wallet">
          Wallet policy
        </Link>
      </div>
      <div className="ops-section-header admin-mt-14">
        <div>
          <h3>Applied operations policy</h3>
          <p className="muted">
            Live Admin policy values used by finance before clearing Partner cash-fee debt and reopening final
            acceptance, service start, and payout release.
          </p>
        </div>
        <span className="pill pill-info">Live policy default</span>
      </div>
      <div className="service-trace-summary admin-mt-12">
        {appliedPolicyCards.map((card) => (
          <div key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <small>{card.helper}</small>
          </div>
        ))}
      </div>
      <CommandCardGrid cards={settlementRuleCards} />
    </section>
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
        description="Factual breakdown of why partner wallets are negative. Use this before contacting a partner or approving an admin offset."
        href="/payments?review=cash-debt"
        linkLabel="Review cash payments"
        title="Debt cause board"
      />
      <div className="card admin-mb-16">
        <div className="ops-section-header">
          <div>
            <h2>Cash fee settlement workflow</h2>
            <p className="muted">
              Standard operating flow for reopening final acceptance, service start, and payout release after
              cash-fee debt is paid or offset. This does not track blocked marketplace attempts.
            </p>
          </div>
          <Link className="text-link" href="/partner-controls?review=cash-debt">
            Open partner controls
          </Link>
        </div>
        <div className="setup-stage-list admin-mt-12">
          {recoverySteps.map((step) => (
            <div className="setup-stage-item" key={step.title}>
              <span className={`pill ${step.pillClass}`}>{step.status}</span>
              <div>
                <strong>{step.title}</strong>
                <p className="muted">{step.detail}</p>
                <small>{step.operatorRule}</small>
              </div>
            </div>
          ))}
        </div>
      </div>
      <LinkedCardSection
        description="Follow a cash booking from customer payment evidence to partner wallet reopening and payout release. Marketplace viewing attempts are not tracked; actual marketplace participants remain on the booking record."
        href="/bookings?view=cash-debt"
        items={settlementHandoff}
        linkLabel="Booking cash debt queue"
        title="Cash settlement handoff map"
      />
      <CommandCardSection
        cards={commandCards}
        description="Work from the highest debt and oldest debt first. Every settlement needs an auditable reference before the partner wallet can reopen."
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
    <div className="card admin-mb-16">
      <div className="ops-section-header">
        <div>
          <h2>{title}</h2>
          <p className="muted">{description}</p>
        </div>
        <Link className="text-link" href={href}>
          {linkLabel}
        </Link>
      </div>
      <CommandCardGrid cards={cards} />
    </div>
  );
}

function CommandCardGrid({ cards }: { readonly cards: readonly CommandCard[] }) {
  return (
    <div className="ops-task-grid">
      {cards.map((card) => (
        <div className={`ops-task-card ${card.className}`} key={card.title}>
          <div>
            <span className={`pill ${card.pillClass}`}>{card.status}</span>
            <h3>{card.title}</h3>
            <p className="muted">{card.detail}</p>
          </div>
          <small>{card.action}</small>
        </div>
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
    <section className="card admin-mb-16">
      <div className="ops-section-header">
        <div>
          <h2>{title}</h2>
          <p className="muted">{description}</p>
        </div>
        <Link className="text-link" href={href}>
          {linkLabel}
        </Link>
      </div>
      <div className="ops-task-grid">
        {items.map((item) => (
          <Link className={`ops-task-card ${item.className}`} href={item.href} key={item.title}>
            <div>
              <span className={`pill ${item.pillClass}`}>{item.status}</span>
              <h3>{item.title}</h3>
              <p className="muted">{item.detail}</p>
            </div>
            <small>{item.operatorRule}</small>
          </Link>
        ))}
      </div>
    </section>
  );
}
