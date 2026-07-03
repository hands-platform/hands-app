import type { ReactNode } from 'react';

type AdminDataTableProps = {
  readonly children: ReactNode;
  readonly className?: string;
  readonly emptyMessage: ReactNode;
  readonly headers: readonly string[];
  readonly rowCount: number;
};

type AdminTableScrollProps = {
  readonly children: ReactNode;
};

export function AdminTableScroll({ children }: AdminTableScrollProps) {
  return <div className="admin-table-scroll">{children}</div>;
}

export function AdminDataTable({
  children,
  className,
  emptyMessage,
  headers,
  rowCount,
}: AdminDataTableProps) {
  const tableClassName = className ? `table vuexy-data-table ${className}` : 'table vuexy-data-table';

  return (
    <table className={tableClassName}>
      <thead>
        <tr>
          {headers.map((header) => (
            <th key={header}>{header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {children}
        {rowCount === 0 && emptyMessage !== null ? (
          <tr>
            <td colSpan={headers.length}>{emptyMessage}</td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}
