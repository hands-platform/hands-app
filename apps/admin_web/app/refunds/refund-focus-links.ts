export const DEFAULT_REFUND_QUEUE_HREF = '/refunds?range=all&review=open&sort=oldest';

export function refundApprovalFocusHref(refundId: string, returnTo: string) {
  const search = new URLSearchParams({
    view: 'refunds',
    requestId: refundId,
    returnTo: safeRefundReturnTo(returnTo),
  });
  return `/finance-tax/approval-queue?${search.toString()}#approval-${encodeURIComponent(refundId)}`;
}

export function safeRefundReturnTo(value: string | null | undefined) {
  if (!value?.startsWith('/') || value.startsWith('//')) return DEFAULT_REFUND_QUEUE_HREF;

  try {
    const url = new URL(value, 'http://admin.local');
    if (url.origin !== 'http://admin.local' || url.pathname !== '/refunds') {
      return DEFAULT_REFUND_QUEUE_HREF;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return DEFAULT_REFUND_QUEUE_HREF;
  }
}
