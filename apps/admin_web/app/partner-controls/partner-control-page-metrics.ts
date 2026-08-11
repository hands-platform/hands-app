import type { AdminPageMetric } from '../../components/admin-page-template';

export function buildPartnerControlPageMetrics(
  summary: readonly (readonly [string, string])[],
  _generatedAt?: string,
  reportContext: { readonly overdue?: number; readonly urgent?: number } = {},
): readonly AdminPageMetric[] {
  return summary.map(([label, value]) => ({
    helper: partnerControlMetricHelper(label, reportContext),
    href: partnerControlMetricHref(label),
    kind: value !== '0' && value !== 'Unavailable' ? 'risk' : value === 'Unavailable' ? 'record' : 'live',
    label,
    scope: 'All partners',
    value,
  }));
}

function partnerControlMetricHelper(
  label: string,
  reportContext: { readonly overdue?: number; readonly urgent?: number },
) {
  switch (label) {
    case 'Active restrictions':
      return 'Current account restrictions across every Partner.';
    case 'Reports needing review':
      return `Open and investigating reports that still need an operator decision. Urgent ${metricContextValue(
        reportContext.urgent,
      )} · overdue ${metricContextValue(reportContext.overdue)}.`;
    case 'Debt gates':
      return 'Negative wallet gates final acceptance, service start, and payout release.';
    case 'Overdue':
      return 'Open reports beyond the severity-based review SLA.';
    default:
      return 'Partner control desk metric.';
  }
}

function metricContextValue(value: number | undefined) {
  return Number.isFinite(value) ? String(value) : 'unavailable';
}

function partnerControlMetricHref(label: string) {
  if (label === 'Reports needing review') return '/partner-controls?details=reports';
  if (label === 'Active restrictions') return '/partner-controls?details=sanctions';
  if (label === 'Debt gates') return '/partner-controls?details=controls&review=cash-debt';
  if (label === 'Overdue') return '/partner-controls?details=reports&review=overdue&sort=oldest';
  return '/partner-controls';
}
