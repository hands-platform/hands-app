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
  const tableClassName = joinClassNames('table vuexy-data-table vuexy-booking-table', className);

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
            <td className="admin-data-table-empty-cell" colSpan={headers.length}>
              <div className="admin-data-table-empty">{emptyMessage}</div>
            </td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}

function joinClassNames(...classNames: Array<string | undefined>) {
  const tokens = new Set<string>();

  for (const className of classNames) {
    for (const token of className?.split(/\s+/) ?? []) {
      if (token) {
        tokens.add(token);
      }
    }
  }

  return Array.from(tokens).join(' ');
}
