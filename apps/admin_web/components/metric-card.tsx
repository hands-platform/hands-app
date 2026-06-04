import Link from 'next/link';

type MetricCardProps = {
  label: string;
  value: number | string;
  helper: string;
  href?: string;
};

export function MetricCard({ label, value, helper, href }: MetricCardProps) {
  const content = (
    <>
      <p>{label}</p>
      <h2>{value}</h2>
      <small className="muted">{helper}</small>
    </>
  );

  if (href) {
    return (
      <Link className="card" href={href}>
        {content}
      </Link>
    );
  }

  return <div className="card">{content}</div>;
}
