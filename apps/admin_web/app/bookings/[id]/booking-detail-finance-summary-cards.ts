import { bookingFinanceSummaryCards as buildBookingFinanceSummaryCards } from '../../../lib/booking-finance-summary-cards';
import { money } from './booking-formatters';
import type { bookingFinanceTrace } from './booking-finance-trace';

export function bookingDetailFinanceSummaryCards(financeTrace: ReturnType<typeof bookingFinanceTrace>) {
  return buildBookingFinanceSummaryCards(financeTrace, { money });
}
