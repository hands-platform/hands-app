import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app_state.dart';
import '../../../core/widgets/customer_feedback_panels.dart';
import '../../discovery/presentation/customer_service_option_helpers.dart';
import '../../map/presentation/customer_map_widgets.dart';
import 'customer_booking_flow_screens.dart';
import 'customer_booking_ui_helpers.dart';

class BookingsScreen extends ConsumerStatefulWidget {
  const BookingsScreen({
    super.key,
    this.initialBookingId,
    this.initialPaymentId,
  });

  final String? initialBookingId;
  final String? initialPaymentId;

  @override
  ConsumerState<BookingsScreen> createState() => _BookingsScreenState();
}

class _BookingsScreenState extends ConsumerState<BookingsScreen> {
  List<dynamic> bookings = [];
  bool loading = false;
  String? error;
  String? statusMessage;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(restoreSessionAndLoadBookings());
    });
  }

  Future<void> restoreSessionAndLoadBookings() async {
    setState(() {
      loading = true;
      error = null;
      statusMessage = null;
    });
    try {
      final authController = ref.read(authControllerProvider.notifier);
      final session = ref.read(authControllerProvider) ??
          await authController.restoreSession();
      if (!mounted) {
        return;
      }
      if (session == null) {
        setState(() => statusMessage = 'Login to load this booking.');
        return;
      }

      await loadBookings(showLoading: false);
    } catch (exception) {
      if (mounted) {
        setState(() => error = '$exception');
      }
    } finally {
      if (mounted) {
        setState(() => loading = false);
      }
    }
  }

  Future<void> signInAndLoad() async {
    setState(() {
      loading = true;
      error = null;
      statusMessage = null;
    });
    try {
      if (ref.read(authControllerProvider) == null) {
        await ref.read(authControllerProvider.notifier).signInDemoCustomer();
      }
      await loadBookings(showLoading: false);
    } catch (exception) {
      setState(() => error = '$exception');
    } finally {
      if (mounted) {
        setState(() => loading = false);
      }
    }
  }

  Future<void> loadBookings({bool showLoading = true}) async {
    if (showLoading) {
      setState(() {
        loading = true;
        error = null;
      });
    }
    try {
      final loaded = await ref.read(customerRepositoryProvider).listBookings();
      if (!mounted) {
        return;
      }
      setState(() {
        bookings = loaded;
        statusMessage = 'Loaded ${loaded.length} booking(s).';
      });
    } catch (exception) {
      if (mounted) {
        setState(() => error = '$exception');
      }
    } finally {
      if (mounted && showLoading) {
        setState(() => loading = false);
      }
    }
  }

  Future<void> openBooking(Map<String, dynamic> booking) async {
    final bookingId = booking['id']?.toString();
    if (bookingId == null || loading) {
      return;
    }
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final detail =
          await ref.read(customerRepositoryProvider).getBooking(bookingId);
      if (!mounted) {
        return;
      }
      setState(() => loading = false);
      await Navigator.of(context).push<void>(
        MaterialPageRoute(
          builder: (context) => BookingWaitingPage(
            initialBooking: detail,
            onBookingUpdated: replaceBooking,
          ),
        ),
      );
      if (mounted) {
        await loadBookings(showLoading: false);
      }
    } catch (exception) {
      if (mounted) {
        setState(() => error = '$exception');
      }
    } finally {
      if (mounted && loading) {
        setState(() => loading = false);
      }
    }
  }

  void replaceBooking(Map<String, dynamic> updated) {
    final id = updated['id']?.toString();
    if (id == null || !mounted) {
      return;
    }
    setState(() {
      bookings = bookings
          .map((item) =>
              item is Map<String, dynamic> && item['id'] == id ? updated : item)
          .toList();
    });
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    final items = sortedCustomerBookingsForTarget(
      bookings.whereType<Map<String, dynamic>>().toList(),
      bookingId: widget.initialBookingId,
      paymentId: widget.initialPaymentId,
    );
    final activeCount = items.where(isCustomerActiveBooking).length;
    final closedCount = items.where(isCustomerClosedBooking).length;
    final chatReadyCount = items.where(isCustomerAppChatVisible).length;

    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text('Bookings', style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 8),
          Text(
              'Recent requests, assigned partners, payment state, and chat readiness.',
              style: Theme.of(context).textTheme.bodyLarge),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed:
                loading ? null : (auth == null ? signInAndLoad : loadBookings),
            icon: const Icon(Icons.receipt_long_outlined),
            label:
                Text(auth == null ? 'Demo customer login' : 'Refresh bookings'),
          ),
          if (loading) ...[
            const SizedBox(height: 12),
            const LinearProgressIndicator(),
          ],
          if (statusMessage != null) ...[
            const SizedBox(height: 12),
            InfoBanner(text: statusMessage!),
          ],
          if (error != null) ...[
            const SizedBox(height: 12),
            ErrorPanel(text: error!),
          ],
          const SizedBox(height: 16),
          CustomerBookingSummary(
              active: activeCount,
              chatReady: chatReadyCount,
              closed: closedCount),
          const SizedBox(height: 16),
          if (auth == null)
            const EmptyPanel(text: 'Login first to load customer bookings.')
          else if (items.isEmpty)
            const EmptyPanel(
                text:
                    'No bookings yet. Choose a partner and book a service to start.')
          else
            for (final booking in items)
              CustomerBookingHistoryCard(
                booking: booking,
                onOpen: () => openBooking(booking),
                highlighted: isCustomerBookingTarget(
                  booking,
                  bookingId: widget.initialBookingId,
                  paymentId: widget.initialPaymentId,
                ),
              ),
        ],
      ),
    );
  }
}

class CustomerBookingSummary extends StatelessWidget {
  const CustomerBookingSummary({
    super.key,
    required this.active,
    required this.chatReady,
    required this.closed,
  });

  final int active;
  final int chatReady;
  final int closed;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: [
        CustomerSummaryTile(
            label: 'Active',
            value: '$active live',
            color: const Color(0xFFEAF5E3)),
        CustomerSummaryTile(
            label: 'Chat',
            value: '$chatReady ready',
            color: const Color(0xFFEAF2FF)),
        CustomerSummaryTile(
            label: 'Closed',
            value: '$closed done',
            color: const Color(0xFFF8ECD4)),
      ],
    );
  }
}

class CustomerSummaryTile extends StatelessWidget {
  const CustomerSummaryTile({
    super.key,
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 150,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
            color: color, borderRadius: BorderRadius.circular(18)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label,
                style: Theme.of(context)
                    .textTheme
                    .labelLarge
                    ?.copyWith(color: Colors.black54)),
            const SizedBox(height: 6),
            Text(value,
                style: Theme.of(context)
                    .textTheme
                    .titleMedium
                    ?.copyWith(fontWeight: FontWeight.w800)),
          ],
        ),
      ),
    );
  }
}

class CustomerBookingHistoryCard extends StatelessWidget {
  const CustomerBookingHistoryCard({
    super.key,
    required this.booking,
    required this.onOpen,
    this.highlighted = false,
  });

  final Map<String, dynamic> booking;
  final VoidCallback onOpen;
  final bool highlighted;

  @override
  Widget build(BuildContext context) {
    final service = firstBookingService(booking);
    final provider = activeBookingProvider(booking);
    final payment = booking['payment'] as Map<String, dynamic>?;
    final chatVisible = isCustomerAppChatVisible(booking);
    return Card(
      shape: highlighted
          ? RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(
                color: Theme.of(context).colorScheme.primary,
                width: 2,
              ),
            )
          : null,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                ProviderThumbnail(
                    name: provider?['displayName'] as String? ?? 'HANDS',
                    size: 52,
                    imageUrl: provider == null
                        ? null
                        : providerProfileImageUrl(provider)),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(customerServiceOptionLabel(service),
                          style: Theme.of(context).textTheme.titleLarge),
                      const SizedBox(height: 2),
                      Text(provider?['displayName'] as String? ??
                          'Partner pending'),
                    ],
                  ),
                ),
                BookingHistoryPill(
                    label: booking['status']?.toString() ?? 'UNKNOWN'),
              ],
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                BookingHistoryPill(
                    label:
                        'Opened ${formatCustomerRequestOpenedMoment(booking['createdAt'])}'),
                BookingHistoryPill(
                    label: customerServiceOptionPriceLabel(
                  service,
                  amount: payment?['amount'],
                )),
                BookingHistoryPill(
                    label: payment?['status']?.toString() ?? 'NO_PAYMENT'),
                if (chatVisible)
                  const BookingHistoryPill(
                      label: 'Chat ready', highlighted: true),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              customerBookingNextAction(booking),
              style: Theme.of(context)
                  .textTheme
                  .bodyMedium
                  ?.copyWith(color: Colors.black54),
            ),
            const SizedBox(height: 12),
            Align(
              alignment: Alignment.centerRight,
              child: FilledButton.tonalIcon(
                onPressed: onOpen,
                icon: const Icon(Icons.open_in_new_rounded),
                label: const Text('Open booking'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

List<Map<String, dynamic>> sortedCustomerBookingsForTarget(
  List<Map<String, dynamic>> bookings, {
  String? bookingId,
  String? paymentId,
}) {
  return bookings
    ..sort((left, right) {
      final leftTarget = isCustomerBookingTarget(
        left,
        bookingId: bookingId,
        paymentId: paymentId,
      );
      final rightTarget = isCustomerBookingTarget(
        right,
        bookingId: bookingId,
        paymentId: paymentId,
      );
      if (leftTarget != rightTarget) {
        return leftTarget ? -1 : 1;
      }

      return customerBookingTimestamp(right)
          .compareTo(customerBookingTimestamp(left));
    });
}

bool isCustomerBookingTarget(
  Map<String, dynamic> booking, {
  String? bookingId,
  String? paymentId,
}) {
  final matchesBooking =
      bookingId != null && booking['id']?.toString() == bookingId;
  final payment = booking['payment'];
  final matchesPayment = paymentId != null &&
      payment is Map &&
      payment['id']?.toString() == paymentId;

  return matchesBooking || matchesPayment;
}

class BookingHistoryPill extends StatelessWidget {
  const BookingHistoryPill(
      {super.key, required this.label, this.highlighted = false});

  final String label;
  final bool highlighted;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: highlighted ? const Color(0xFFEAF5E3) : Colors.white,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
            color: highlighted
                ? const Color(0xFFBFD6AA)
                : Theme.of(context).colorScheme.outlineVariant),
      ),
      child: Text(label,
          style: Theme.of(context)
              .textTheme
              .labelLarge
              ?.copyWith(fontWeight: FontWeight.w700)),
    );
  }
}
