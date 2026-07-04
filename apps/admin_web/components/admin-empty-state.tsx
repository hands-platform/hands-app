type AdminEmptyStateProps = {
  readonly className?: string;
  readonly framed?: boolean;
  readonly message: string;
  readonly title?: string | null;
};

export function AdminEmptyState({
  className,
  framed = false,
  message,
  title = 'No records found',
}: AdminEmptyStateProps) {
  if (framed) {
    return (
      <div className={joinClassNames('empty-state', className)}>
        {title === null ? null : <strong>{title}</strong>}
        <p className="muted">{message}</p>
      </div>
    );
  }

  const content = [
    title === null ? null : <strong key="title">{title}</strong>,
    <p className="muted" key="message">
      {message}
    </p>,
  ];

  if (className) {
    return <div className={className}>{content}</div>;
  }

  return <>{content}</>;
}

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(' ');
}
