import { OPERATIONAL_POLICY_KEYS, operationalPolicyHref } from '../../lib/operations-policy';

// Authority marker: Marketplace partner radius.

export type OwnerDecisionBacklogItem = {
  owner: string;
  title: string;
  question: string;
  evidence: string;
  options: Array<{
    label: string;
    tradeoff: string;
  }>;
  recommendation: string;
  decisionTrigger: string;
  href: string;
  className: string;
  pillClass: string;
};

export function operationsOwnerDecisionBacklog(): OwnerDecisionBacklogItem[] {
  return [
    {
      owner: 'Dispatch',
      title: 'First-pick Partner timer',
      question:
        'Should the first-pick Partner keep the full response window, or should marketplace Partners become more prominent earlier?',
      evidence:
        'Review open matching wait time, first-pick response rate, and customer cancellation before changing the timer.',
      options: [
        {
          label: 'Keep 10 minutes',
          tradeoff:
            'Protects the customer-selected Partner and keeps the first-pick promise clear, but customers may wait longer.',
        },
        {
          label: 'Escalate earlier',
          tradeoff:
            'Shows marketplace Partners sooner and reduces waiting anxiety, but the first-pick Partner has less exclusive time.',
        },
      ],
      recommendation:
        'Keep the 10-minute policy for launch, then review response-rate data by city before shortening it.',
      decisionTrigger:
        'Revisit when first-pick response rate drops below 70% or customer cancellations during wait exceed 8%.',
      href: '/bookings?view=matching',
      className: 'ops-task-pending',
      pillClass: 'pill-info',
    },
    {
      owner: 'Supply',
      title: 'Marketplace Partner radius',
      question:
        'Should HANDS keep one nationwide default radius, or vary radius by city density and service type?',
      evidence:
        'Review Partner count within radius, average distance, late arrivals, and ignored marketplace alerts by city.',
      options: [
        {
          label: 'Single 10km default',
          tradeoff:
            'Simple to explain and operate during MVP, but dense cities and low-supply cities may need different behavior.',
        },
        {
          label: 'City/service rules',
          tradeoff:
            'More precise dispatch control, but requires more admin policy work and monitoring per market.',
        },
      ],
      recommendation:
        'Start with one marketplace policy baseline, then add city/service overrides after Ho Chi Minh City data is stable.',
      decisionTrigger:
        'Revisit when marketplace alerts are ignored often, or accepted marketplace Partners are repeatedly too far away.',
      href: operationalPolicyHref(OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters),
      className: 'ops-task-pending',
      pillClass: 'pill-info',
    },
    {
      owner: 'Finance',
      title: 'Negative wallet marketplace policy',
      question:
        'Should cash-fee debt block marketplace alerts and participation only, or also block payout release?',
      evidence:
        'Review cash settlement speed, repeated debt Partners, marketplace participation, and payout exposure before changing wallet gate scope.',
      options: [
        {
          label: 'Marketplace only',
          tradeoff:
            'Keeps payout decisions separate, while settlement is required before participating in new marketplace requests.',
        },
        {
          label: 'Marketplace + payout',
          tradeoff: 'Adds payout release review while preserving marketplace list visibility.',
        },
      ],
      recommendation:
        'Keep marketplace list visibility open; apply settlement checks at marketplace alerts, participation, and payout release.',
      decisionTrigger:
        'Revisit after cash-settlement median collection time is under 24 hours for two consecutive weeks.',
      href: '/cash-settlements',
      className: 'ops-task-blocked',
      pillClass: 'pill-warn',
    },
    {
      owner: 'Finance',
      title: 'Negative wallet direct-request boundary',
      question:
        'Should unpaid cash-fee debt also block a first-pick Partner from accepting a direct request, or only block marketplace alerts, participation, and payout release?',
      evidence:
        'Review how often negative-wallet Partners are chosen first by customers, how quickly they settle fees, and whether blocking direct requests creates customer wait issues.',
      options: [
        {
          label: 'Keep current MVP boundary',
          tradeoff:
            'Marketplace alerts, participation, and payout release stay blocked, while first-pick direct requests remain a separate owner decision.',
        },
        {
          label: 'Block all new acceptance',
          tradeoff:
            'Stronger cash-fee control, but can prevent a customer from using a Partner they deliberately selected first.',
        },
      ],
      recommendation:
        'Keep the current marketplace/payout gate for MVP, then decide the direct-request gate after real cash-settlement data is visible.',
      decisionTrigger:
        'Revisit when repeated cash-fee debt appears after direct first-pick bookings, or settlement time exceeds the finance SLA.',
      href: '/cash-settlements',
      className: 'ops-task-pending',
      pillClass: 'pill-info',
    },
    {
      owner: 'Finance',
      title: 'Payout batch cycle',
      question:
        'Should positive Partner earnings be settled on a weekly rhythm, monthly rhythm, or admin-selected payout day?',
      evidence:
        'Review completed earning volume, withholding logs, bank verification, cash-debt offsets, and transfer-reference workload before changing payout cadence.',
      options: [
        {
          label: 'Weekly or monthly batch',
          tradeoff:
            'Predictable for finance and Partners, with enough time to review tax, wallet, and bank records.',
        },
        {
          label: 'Admin selected day',
          tradeoff:
            'Flexible for launch or holidays, but operators must keep transfer references and payout evidence clean.',
        },
      ],
      recommendation:
        'Start with batch settlement only: weekly or monthly default, plus admin-selected exception batches when needed.',
      decisionTrigger:
        'Revisit when payout batch volume, withholding records, and bank verification are stable for at least two cycles.',
      href: '/payouts',
      className: 'ops-task-pending',
      pillClass: 'pill-info',
    },
    {
      owner: 'Support',
      title: 'Cancellation fee rule',
      question:
        'When a customer cancels after Partner commitment, should payment be released immediately or held for fee review?',
      evidence:
        'Review after-match cancellation reasons, Partner travel evidence, refund complaints, and manual review workload.',
      options: [
        {
          label: 'Admin review',
          tradeoff:
            'Protects early customer confidence and lets support learn real patterns, but increases manual workload.',
        },
        {
          label: 'Admin fee review',
          tradeoff:
            'More consistent than ad hoc handling, while still keeping the final fee decision with operations.',
        },
      ],
      recommendation:
        'Use admin review during MVP. Tighten evidence requirements before considering any automation later.',
      decisionTrigger:
        'Revisit when support has at least 100 reviewed after-match cancellations with clear reason categories.',
      href: '/refunds',
      className: 'ops-task-pending',
      pillClass: 'pill-warn',
    },
    {
      owner: 'Account ops',
      title: 'No-show evidence',
      question:
        'What evidence should be required before no-show closeout or customer fee decisions are reviewed?',
      evidence:
        'Review chat, arrival timestamp, location evidence, customer response, and dispute context before no-show closeout.',
      options: [
        {
          label: 'Manual evidence review',
          tradeoff:
            'More controlled for launch and disputes, but slower for Partner compensation and customer closeout.',
        },
        {
          label: 'Evidence checklist',
          tradeoff:
            'Keeps decisions factual and repeatable, but requires reliable location, chat, and timestamp capture.',
        },
      ],
      recommendation:
        'Keep manual review until service-start, arrival, chat, and location evidence are consistently captured.',
      decisionTrigger:
        'Revisit when no-show dispute rate is measurable and evidence completeness is above 95%.',
      href: '/bookings?view=no-show',
      className: 'ops-task-pending',
      pillClass: 'pill-warn',
    },
    {
      owner: 'Growth',
      title: 'Partner alert routing',
      question:
        'When should time-sensitive booking alerts move from in-app only to mandatory FCM push delivery?',
      evidence:
        'Review delivery failure rate, disabled devices, missed requests, and production push credential readiness.',
      options: [
        {
          label: 'In-app first',
          tradeoff:
            'Lowest setup work and easiest local testing, but Partners may miss requests when the app is closed.',
        },
        {
          label: 'FCM required',
          tradeoff: 'Better booking reach, but depends on production credentials and delivery monitoring.',
        },
      ],
      recommendation:
        'Keep in-app first locally, then enable FCM once production credentials and failure dashboards are ready.',
      decisionTrigger:
        'Revisit immediately after FCM production setup is complete and device delivery logs are visible.',
      href: operationalPolicyHref(OPERATIONAL_POLICY_KEYS.partnerAlertChannel),
      className: 'ops-task-done',
      pillClass: 'pill-success',
    },
  ];
}
