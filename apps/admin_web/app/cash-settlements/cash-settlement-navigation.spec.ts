import {
  cashSettlementNoticeHref,
  cashSettlementReviewHref,
  safeCashSettlementReturnTo,
} from './cash-settlement-page-filters';

describe('cash settlement navigation', () => {
  const context =
    '/cash-settlements?queue=missing-evidence&q=Mai&sort=oldest&pageSize=25&page=2';

  it('keeps queue context through review, cancel, success, and error states', () => {
    expect(cashSettlementReviewHref(context, 'earning-22')).toBe(`${context}&review=earning-22`);
    expect(cashSettlementNoticeHref(context, { notice: 'settled', earningId: 'earning-22' })).toBe(
      `${context}&notice=settled&resultEarningId=earning-22`,
    );
    expect(
      cashSettlementNoticeHref(context, {
        notice: 'error',
        earningId: 'earning-22',
        code: 'STALE_OR_DUPLICATE',
      }),
    ).toBe(
      `${context}&review=earning-22&notice=error&code=STALE_OR_DUPLICATE&resultEarningId=earning-22`,
    );
    expect(safeCashSettlementReturnTo(context)).toBe(context);
  });
});
