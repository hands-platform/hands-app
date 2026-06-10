import type { AdminServiceCatalogItem } from './admin-api';
import { serviceBookingTraceState } from './service-booking-trace-state';

type ServiceBookingTraceBooking = NonNullable<
  NonNullable<AdminServiceCatalogItem['bookings']>[number]['booking']
>;

export type ServiceBookingTraceRow = {
  readonly booking: ServiceBookingTraceBooking | null | undefined;
  readonly bookingService: NonNullable<AdminServiceCatalogItem['bookings']>[number];
  readonly currency: string;
  readonly platformFeeLogCount: number;
  readonly platformFeeAmount: number;
  readonly service: AdminServiceCatalogItem;
  readonly taxLogCount: number;
  readonly taxWithheldAmount: number;
  readonly traceStatus: string;
  readonly traceTone: 'pill-success' | 'pill-warn';
  readonly walletAmount: number;
  readonly walletEntryCount: number;
};

export function serviceBookingTraceRows(
  services: readonly AdminServiceCatalogItem[],
): ServiceBookingTraceRow[] {
  return services
    .flatMap((service) =>
      (service.bookings ?? []).map((bookingService) => {
        const booking = bookingService.booking;
        const currency =
          booking?.payment?.currency ??
          booking?.earning?.currency ??
          booking?.taxLogs?.[0]?.currency ??
          'VND';
        const taxWithheldAmount = (booking?.taxLogs ?? []).reduce(
          (sum, log) => sum + log.withholdingAmount,
          0,
        );
        const platformFeeAmount = (booking?.platformFeeLogs ?? []).reduce(
          (sum, log) => sum + log.platformFeeAmount,
          0,
        );
        const walletAmount = (booking?.walletLedgerEntries ?? []).reduce(
          (sum, entry) => sum + entry.amount,
          0,
        );
        const traceState = serviceBookingTraceState({
          earningReady: Boolean(booking?.earning),
          paymentReady: Boolean(booking?.payment),
          taxReady: taxWithheldAmount > 0 || (booking?.taxLogs?.length ?? 0) > 0,
          walletReady: (booking?.walletLedgerEntries?.length ?? 0) > 0,
        });

        return {
          service,
          bookingService,
          booking,
          currency,
          taxLogCount: booking?.taxLogs?.length ?? 0,
          platformFeeLogCount: booking?.platformFeeLogs?.length ?? 0,
          taxWithheldAmount,
          platformFeeAmount,
          walletEntryCount: booking?.walletLedgerEntries?.length ?? 0,
          walletAmount,
          traceStatus: traceState.traceStatus,
          traceTone: traceState.traceTone,
        };
      }),
    )
    .sort((left, right) => {
      const leftCreatedAt = left.booking?.createdAt ? new Date(left.booking.createdAt).getTime() : 0;
      const rightCreatedAt = right.booking?.createdAt ? new Date(right.booking.createdAt).getTime() : 0;
      return rightCreatedAt - leftCreatedAt || left.service.name.localeCompare(right.service.name);
    })
    .slice(0, 24);
}
