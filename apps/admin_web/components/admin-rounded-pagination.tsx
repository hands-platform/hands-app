import Link from 'next/link';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import type { ReactNode } from 'react';

type AdminRoundedPaginationProps = {
  readonly activePage: number;
  readonly ariaLabel: string;
  readonly className: string;
  readonly hrefForPage?: (page: number) => string;
  readonly onPageChange?: (page: number) => void;
  readonly pageLinkClassName: string;
  readonly totalPages: number;
};

export function AdminRoundedPagination({
  activePage,
  ariaLabel,
  className,
  hrefForPage,
  onPageChange,
  pageLinkClassName,
  totalPages,
}: AdminRoundedPaginationProps) {
  const lastPage = Math.max(1, totalPages);
  const page = clampPage(activePage, lastPage);
  const pageItems = adminRoundedPaginationPages(page, lastPage);

  return (
    <nav aria-label={ariaLabel} className={joinClassNames(className)}>
      <AdminRoundedPaginationControl
        disabled={page <= 1}
        href={hrefForPage?.(1)}
        label="First page"
        onClick={onPageChange ? () => onPageChange(1) : undefined}
        pageLinkClassName={pageLinkClassName}
      >
        <ChevronsLeft size={18} />
      </AdminRoundedPaginationControl>
      <AdminRoundedPaginationControl
        disabled={page <= 1}
        href={hrefForPage?.(Math.max(1, page - 1))}
        label="Previous page"
        onClick={onPageChange ? () => onPageChange(Math.max(1, page - 1)) : undefined}
        pageLinkClassName={pageLinkClassName}
      >
        <ChevronLeft size={18} />
      </AdminRoundedPaginationControl>
      {pageItems.map((pageNumber) => (
        <AdminRoundedPaginationControl
          active={pageNumber === page}
          href={hrefForPage?.(pageNumber)}
          key={pageNumber}
          label={`Page ${pageNumber}`}
          onClick={onPageChange ? () => onPageChange(pageNumber) : undefined}
          pageLinkClassName={pageLinkClassName}
        >
          {pageNumber}
        </AdminRoundedPaginationControl>
      ))}
      <AdminRoundedPaginationControl
        disabled={page >= lastPage}
        href={hrefForPage?.(Math.min(lastPage, page + 1))}
        label="Next page"
        onClick={onPageChange ? () => onPageChange(Math.min(lastPage, page + 1)) : undefined}
        pageLinkClassName={pageLinkClassName}
      >
        <ChevronRight size={18} />
      </AdminRoundedPaginationControl>
      <AdminRoundedPaginationControl
        disabled={page >= lastPage}
        href={hrefForPage?.(lastPage)}
        label="Last page"
        onClick={onPageChange ? () => onPageChange(lastPage) : undefined}
        pageLinkClassName={pageLinkClassName}
      >
        <ChevronsRight size={18} />
      </AdminRoundedPaginationControl>
    </nav>
  );
}

export function adminRoundedPaginationPages(activePage: number, totalPages: number) {
  const lastPage = Math.max(1, totalPages);
  const page = clampPage(activePage, lastPage);
  const start = Math.max(1, page - 2);
  const end = Math.min(lastPage, start + 4);
  const adjustedStart = Math.max(1, end - 4);

  return Array.from({ length: end - adjustedStart + 1 }, (_, index) => adjustedStart + index);
}

function AdminRoundedPaginationControl({
  active = false,
  children,
  disabled = false,
  href,
  label,
  onClick,
  pageLinkClassName,
}: {
  readonly active?: boolean;
  readonly children: ReactNode;
  readonly disabled?: boolean;
  readonly href?: string;
  readonly label: string;
  readonly onClick?: () => void;
  readonly pageLinkClassName: string;
}) {
  const className = joinClassNames(pageLinkClassName, active ? 'is-active' : undefined);

  if (onClick) {
    return (
      <button
        aria-current={active ? 'page' : undefined}
        aria-label={label}
        className={className}
        disabled={disabled}
        onClick={onClick}
        type="button"
      >
        {children}
      </button>
    );
  }

  if (disabled || !href) {
    return (
      <span aria-disabled="true" aria-label={label} className={joinClassNames(pageLinkClassName, 'is-disabled')}>
        {children}
      </span>
    );
  }

  return (
    <Link aria-current={active ? 'page' : undefined} aria-label={label} className={className} href={href}>
      {children}
    </Link>
  );
}

function clampPage(activePage: number, totalPages: number) {
  return Math.min(Math.max(1, activePage), totalPages);
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
