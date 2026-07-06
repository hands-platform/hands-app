import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { AdminRoundedPagination, adminRoundedPaginationPages } from './admin-rounded-pagination';

const source = readFileSync(join(__dirname, 'admin-rounded-pagination.tsx'), 'utf8');

describe('AdminRoundedPagination', () => {
  it('uses the shared Vuexy pagination button atom for client pagination controls', () => {
    expect(source).toContain("import { AdminPaginationButton } from './admin-pagination-button';");
    expect(source).toContain('<AdminPaginationButton');
    expect(source).not.toContain('<button');
  });

  it('builds a stable rounded five-page window', () => {
    expect(adminRoundedPaginationPages(1, 10)).toEqual([1, 2, 3, 4, 5]);
    expect(adminRoundedPaginationPages(5, 10)).toEqual([3, 4, 5, 6, 7]);
    expect(adminRoundedPaginationPages(10, 10)).toEqual([6, 7, 8, 9, 10]);
    expect(adminRoundedPaginationPages(8, 3)).toEqual([1, 2, 3]);
  });

  it('renders link pagination for server-routed tables', () => {
    const pagination = AdminRoundedPagination({
      activePage: 2,
      ariaLabel: 'Customer review pages',
      className: 'vuexy-review-pagination',
      hrefForPage: (page) => `/reviews?page=${page}`,
      pageLinkClassName: 'vuexy-review-page-link',
      totalPages: 4,
    });

    expect(pagination.type).toBe('nav');
    expect(pagination.props).toMatchObject({
      'aria-label': 'Customer review pages',
      className: 'admin-rounded-pagination vuexy-review-pagination',
    });
    expect(classNamesIn(pagination)).toEqual(
      expect.arrayContaining([
        'vuexy-review-page-link admin-pagination-page-link',
        'vuexy-review-page-link admin-pagination-page-link is-active',
      ]),
    );
    expect(hrefsIn(pagination)).toEqual(
      expect.arrayContaining(['/reviews?page=1', '/reviews?page=2', '/reviews?page=3', '/reviews?page=4']),
    );
  });

  it('renders button pagination for client-owned table state', () => {
    const pagination = AdminRoundedPagination({
      activePage: 1,
      ariaLabel: 'Pre-match pages',
      className: 'vuexy-booking-pagination',
      onPageChange: vi.fn(),
      pageLinkClassName: 'vuexy-booking-page-link',
      totalPages: 2,
    });

    expect(elementTypesIn(pagination)).toContain('button');
    expect(classNamesIn(pagination)).toEqual(
      expect.arrayContaining([
        'admin-pagination-button vuexy-booking-page-link admin-pagination-page-link is-active',
        'admin-pagination-button vuexy-booking-page-link admin-pagination-page-link',
      ]),
    );
  });

  it('deduplicates repeated Vuexy pagination classes from callers', () => {
    const pagination = AdminRoundedPagination({
      activePage: 2,
      ariaLabel: 'Finance ledger pagination',
      className: 'vuexy-booking-pagination vuexy-booking-pagination finance-pagination',
      hrefForPage: (page) => `/finance-tax/general-ledger?page=${page}`,
      pageLinkClassName: 'vuexy-booking-page-link vuexy-booking-page-link finance-page-link',
      totalPages: 3,
    });

    expect(pagination.props.className).toBe('admin-rounded-pagination vuexy-booking-pagination finance-pagination');
    expect(classNamesIn(pagination)).toEqual(
      expect.arrayContaining([
        'vuexy-booking-page-link finance-page-link admin-pagination-page-link',
        'vuexy-booking-page-link finance-page-link admin-pagination-page-link is-active',
      ]),
    );
  });
});

function hrefsIn(value: unknown): string[] {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(hrefsIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const href = typeof props?.href === 'string' ? [props.href] : [];
  return [...href, ...hrefsIn(props?.children)];
}

function classNamesIn(value: unknown): string[] {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(classNamesIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const className = typeof props?.className === 'string' ? [props.className] : [];
  return [...className, ...classNamesIn(props?.children)];
}

function elementTypesIn(value: unknown): string[] {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(elementTypesIn);
  }

  const record = readRecord(value);
  const type = typeof record?.type === 'string' ? [record.type] : [];
  const props = readRecord(record?.props);
  return [...type, ...elementTypesIn(props?.children)];
}

function resolveElement(value: unknown): unknown {
  const record = readRecord(value);
  const props = readRecord(record?.props);
  return typeof record?.type === 'function' ? resolveElement(record.type(props)) : value;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
