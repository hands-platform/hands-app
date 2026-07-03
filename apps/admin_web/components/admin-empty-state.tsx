type AdminEmptyStateProps = {
  readonly framed?: boolean;
  readonly message: string;
  readonly title?: string;
};

export function AdminEmptyState({
  framed = false,
  message,
  title = 'No records found',
}: AdminEmptyStateProps) {
  if (framed) {
    return (
      <div className="empty-state">
        <strong>{title}</strong>
        <p className="muted">{message}</p>
      </div>
    );
  }

  return (
    <>
      <strong>{title}</strong>
      <p className="muted">{message}</p>
    </>
  );
}
