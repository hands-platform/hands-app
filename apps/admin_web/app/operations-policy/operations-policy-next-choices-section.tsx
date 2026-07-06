import { AdminInsightCard, AdminSection } from '../../components/admin-surface';

type DecisionHintProps = {
  readonly title: string;
  readonly recommendation: string;
  readonly detail: string;
};

const decisionHints: readonly DecisionHintProps[] = [
  {
    title: 'First-pick Partner acceptance',
    recommendation: 'Keep first-pick priority with customer fallback.',
    detail:
      'The preferred Partner can match first under API rules, marketplace Partners can still enter the shortlist, and the customer chooses only when first-pick does not win.',
  },
  {
    title: 'Marketplace participation',
    recommendation: 'Keep immediate marketplace visibility during the Partner response window.',
    detail:
      'It reduces waiting anxiety, gives the customer alternatives, and fits the reference flow you described.',
  },
  {
    title: 'Negative wallet gate',
    recommendation: 'Keep marketplace visibility open, but block final acceptance, service start, and payout release.',
    detail:
      'Cash services create company-fee debt. Partners can still see demand, while final acceptance, service start, and payout release wait for settlement.',
  },
  {
    title: 'Phone OTP',
    recommendation: 'Keep production SMS deferred until the SMS service selection is complete.',
    detail:
      'Use internal/demo auth for local development, then turn on phone auth once Vonage credentials, Vietnam sender rules, and the HANDS API token exchange are verified.',
  },
  {
    title: 'Cancellation after match',
    recommendation: 'Keep admin review before any customer charge decision.',
    detail:
      'This keeps early customer support flexible while HANDS learns real cancellation, chat, and Partner arrival patterns.',
  },
  {
    title: 'No-show disputes',
    recommendation: 'Require admin review until evidence upload and dispute screens are mature.',
    detail:
      'No-show is an operational closeout state in MVP, not a person judgment. Operators should review evidence before payment or support action.',
  },
  {
    title: 'Partner alert routing',
    recommendation: 'Keep in-app notifications first, then promote FCM after production credentials are stable.',
    detail: 'The system can record notifications now; push delivery should become mandatory only after monitoring is ready.',
  },
];

function DecisionHint({ title, recommendation, detail }: DecisionHintProps) {
  return (
    <AdminInsightCard>
      <strong>{title}</strong>
      <p>{recommendation}</p>
      <p className="muted">{detail}</p>
    </AdminInsightCard>
  );
}

export function OperationsPolicyNextChoicesSection() {
  return (
    <AdminSection title="Recommended next choices">
      <div className="booking-radar">
        {decisionHints.map((hint) => (
          <DecisionHint
            detail={hint.detail}
            key={hint.title}
            recommendation={hint.recommendation}
            title={hint.title}
          />
        ))}
      </div>
    </AdminSection>
  );
}
