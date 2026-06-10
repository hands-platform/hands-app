import type { ReactNode } from 'react';

type AdminDataTableProps = {
  readonly children: ReactNode;
  readonly emptyMessage: ReactNode;
  readonly headers: readonly string[];
  readonly rowCount: number;
};

export function AdminDataTable({ children, emptyMessage, headers, rowCount }: AdminDataTableProps) {
  return (
    <table className="table">
      <thead>
        <tr>
          {headers.map((header) => (
            <th key={header}>{header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {children}
        {rowCount === 0 ? (
          <tr>
            <td colSpan={headers.length}>{emptyMessage}</td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}
