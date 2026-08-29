export type CouponListView = 'all' | 'expired' | 'live' | 'paused' | 'records' | 'scheduled';
export type CouponListSort = 'code' | 'ending-soon';

export type CouponListFilters = {
  readonly q: string;
  readonly sort: CouponListSort;
  readonly view: CouponListView;
};

export function parseCouponListFilters(params: Record<string, string | string[] | undefined>): CouponListFilters {
  const view = readSingleParam(params.view);
  const sort = readSingleParam(params.sort);

  return {
    q: readSingleParam(params.q).trim().slice(0, 80),
    sort: isCouponListSort(sort) ? sort : 'code',
    view: isCouponListView(view) ? view : 'live',
  };
}

export function couponApiState(view: CouponListView) {
  return view === 'all' ? '' : view;
}

export function buildCouponFilterHref(
  filters: CouponListFilters,
  patch: Partial<CouponListFilters> = {},
) {
  const next = { ...filters, ...patch };
  const params = new URLSearchParams();

  if (next.view !== 'live') {
    params.set('view', next.view);
  }
  if (next.q) {
    params.set('q', next.q);
  }
  if (next.sort !== 'code') {
    params.set('sort', next.sort);
  }

  const query = params.toString();
  return query ? `/coupons?${query}` : '/coupons';
}

export function couponViewLabel(view: CouponListView) {
  if (view === 'scheduled') return 'Scheduled';
  if (view === 'paused') return 'Paused';
  if (view === 'expired') return 'Expired';
  if (view === 'records') return 'Records';
  if (view === 'all') return 'All';
  return 'Live';
}

function isCouponListView(value: string): value is CouponListView {
  return ['all', 'expired', 'live', 'paused', 'records', 'scheduled'].includes(value);
}

function isCouponListSort(value: string): value is CouponListSort {
  return value === 'code' || value === 'ending-soon';
}

function readSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}
