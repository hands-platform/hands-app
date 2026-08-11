export type CouponListView = 'all' | 'live' | 'records' | 'scheduled';

export type CouponListFilters = {
  readonly q: string;
  readonly view: CouponListView;
};

export function parseCouponListFilters(params: Record<string, string | string[] | undefined>): CouponListFilters {
  const view = readSingleParam(params.view);

  return {
    q: readSingleParam(params.q).trim().slice(0, 80),
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

  const query = params.toString();
  return query ? `/coupons?${query}` : '/coupons';
}

export function couponViewLabel(view: CouponListView) {
  if (view === 'scheduled') return 'Scheduled';
  if (view === 'records') return 'Records';
  if (view === 'all') return 'All';
  return 'Live';
}

function isCouponListView(value: string): value is CouponListView {
  return value === 'all' || value === 'live' || value === 'records' || value === 'scheduled';
}

function readSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}
