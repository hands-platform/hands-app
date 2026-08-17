import Link from 'next/link';

export type StartShiftLiveMetric = {
  href?: string;
  label: string;
  value: number | string;
};

export function StartShiftLiveMetrics({ metrics }: { metrics: readonly StartShiftLiveMetric[] }) {
  if (!metrics.length) {
    return null;
  }

  return (
    <div className="start-shift-live-strip" aria-label="Current live operations" role="list">
      {metrics.map((metric) => {
        const content = (
          <>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </>
        );
        return metric.href ? (
          <Link href={metric.href} key={metric.label} prefetch={false} role="listitem">
            {content}
          </Link>
        ) : (
          <div key={metric.label} role="listitem">{content}</div>
        );
      })}
    </div>
  );
}
