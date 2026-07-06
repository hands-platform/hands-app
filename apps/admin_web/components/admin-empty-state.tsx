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
      <div aria-live="polite" className={joinClassNames('empty-state', className)} role="status">
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
    return (
      <div aria-live="polite" className={joinClassNames('empty-state', className)} role="status">
        {content}
      </div>
    );
  }

  return <>{content}</>;
}

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames
    .flatMap((className) => className?.split(/\s+/).filter(Boolean) ?? [])
    .filter((className, index, values) => values.indexOf(className) === index)
    .join(' ');
}
