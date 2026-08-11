import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app_state.dart';
import '../../../core/customer_design_system.dart';
import '../../../core/customer_value_helpers.dart';
import '../../../core/local_demo_access.dart';
import '../../../core/widgets/customer_feedback_panels.dart';
import '../../discovery/presentation/customer_provider_detail_page.dart';
import '../../discovery/presentation/customer_service_option_helpers.dart';
import '../../map/presentation/customer_location_helpers.dart';
import '../../map/presentation/customer_map_widgets.dart';
import 'customer_booking_flow_screens.dart';
import 'customer_booking_error_messages.dart';
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
  bool loadingMore = false;
  bool hasMore = false;
  String? error;
  CustomerBookingListTab selectedTab = CustomerBookingListTab.active;
  CustomerBookingHistoryFilter historyFilter = CustomerBookingHistoryFilter.all;

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
    });
    try {
      final authController = ref.read(authControllerProvider.notifier);
      final session = ref.read(authControllerProvider) ??
          await authController.restoreSession();
      if (!mounted) {
        return;
      }
      if (session == null) {
        return;
      }

      await loadBookings(showLoading: false);
    } catch (exception) {
      if (mounted) {
        setState(() => error = customerBookingErrorMessage(exception));
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
    });
    try {
      if (ref.read(authControllerProvider) == null) {
        await ref.read(authControllerProvider.notifier).signInDemoCustomer();
      }
      await loadBookings(showLoading: false);
    } catch (exception) {
      setState(() => error = customerBookingErrorMessage(exception));
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
      Map<String, dynamic>? target;
      for (final booking in loaded.whereType<Map<String, dynamic>>()) {
        if (isCustomerBookingTarget(
          booking,
          bookingId: widget.initialBookingId,
          paymentId: widget.initialPaymentId,
        )) {
          target = booking;
          break;
        }
      }
      setState(() {
        bookings = loaded;
        hasMore = loaded.length == 20;
        if (target != null && isCustomerClosedBooking(target)) {
          selectedTab = CustomerBookingListTab.history;
        }
      });
    } catch (exception) {
      if (mounted) {
        setState(() => error = customerBookingErrorMessage(exception));
      }
    } finally {
      if (mounted && showLoading) {
        setState(() => loading = false);
      }
    }
  }

  Future<void> loadMoreBookings() async {
    if (loadingMore || !hasMore || bookings.isEmpty) return;
    final cursor =
        bookings.last is Map ? (bookings.last as Map)['id']?.toString() : null;
    if (cursor == null || cursor.isEmpty) return;

    setState(() {
      loadingMore = true;
      error = null;
    });
    try {
      final loaded = await ref
          .read(customerRepositoryProvider)
          .listBookings(cursor: cursor);
      if (!mounted) return;
      final knownIds = bookings
          .whereType<Map>()
          .map((booking) => booking['id']?.toString())
          .whereType<String>()
          .toSet();
      setState(() {
        bookings.addAll(
          loaded.where(
            (booking) =>
                booking is! Map ||
                !knownIds.contains(booking['id']?.toString()),
          ),
        );
        hasMore = loaded.length == 20;
      });
    } catch (exception) {
      if (mounted) {
        setState(() => error = customerBookingErrorMessage(exception));
      }
    } finally {
      if (mounted) setState(() => loadingMore = false);
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
        setState(() => error = customerBookingErrorMessage(exception));
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

  Future<void> openBookingPartner(Map<String, dynamic> booking) async {
    final provider = activeBookingProvider(booking);
    final providerId = provider?['id']?.toString();
    if (provider == null || providerId == null || providerId.isEmpty) {
      return;
    }

    final selectedLocation = ref.read(selectedCustomerLocationProvider);
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (context) => ProviderDetailPage(
          providerPreview: provider,
          favoriteLoader: () => ref
              .read(customerRepositoryProvider)
              .isFavoriteProvider(providerId),
          loader: () => ref
              .read(customerRepositoryProvider)
              .getProviderDetail(providerId),
          onFavoriteChanged: (favorite) => ref
              .read(customerRepositoryProvider)
              .setFavoriteProvider(providerId: providerId, favorite: favorite),
          onBookService: (detail, service) async {
            final navigator = Navigator.of(context);
            final booked = await navigator.push<Map<String, dynamic>>(
              MaterialPageRoute(
                builder: (context) => BookingConfirmationPage(
                  providerDetail: detail,
                  selectedService: service,
                  initialCustomerLat: selectedLocation?.latitude,
                  initialCustomerLng: selectedLocation?.longitude,
                  initialCustomerAddress: selectedLocation?.addressText,
                ),
              ),
            );
            if (!mounted || booked == null) {
              return;
            }

            replaceBooking(booked);
            if (mounted) {
              setState(() => selectedTab = CustomerBookingListTab.active);
            }
            await navigator.push<void>(
              MaterialPageRoute(
                builder: (context) => BookingWaitingPage(
                  initialBooking: booked,
                  onBookingUpdated: replaceBooking,
                ),
              ),
            );
          },
        ),
      ),
    );
    if (mounted) {
      await loadBookings(showLoading: false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    final items = sortedCustomerBookingsForTarget(
      bookings.whereType<Map<String, dynamic>>().toList(),
      bookingId: widget.initialBookingId,
      paymentId: widget.initialPaymentId,
    );
    final activeItems = customerBookingsForListTab(
      items,
      CustomerBookingListTab.active,
    );
    final historyItems = customerBookingsForListTab(
      items,
      CustomerBookingListTab.history,
    );
    final filteredHistoryItems = customerBookingsForHistoryFilter(
      historyItems,
      historyFilter,
    );
    final visibleItems = selectedTab == CustomerBookingListTab.active
        ? activeItems
        : filteredHistoryItems;

    final colors = context.handsColors;
    return ColoredBox(
      color: colors.canvas,
      child: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          onRefresh: auth == null ? () async {} : loadBookings,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
            children: [
              CustomerBookingListHeader(
                loading: loading,
                onRefresh: auth == null ? null : loadBookings,
                onBack: Navigator.of(context).canPop()
                    ? () => Navigator.of(context).maybePop()
                    : null,
              ),
              if (loading) ...[
                const SizedBox(height: 16),
                const LinearProgressIndicator(),
              ],
              if (error != null) ...[
                const SizedBox(height: 16),
                ErrorPanel(text: error!),
              ],
              const SizedBox(height: 24),
              CustomerBookingListTabs(
                selected: selectedTab,
                activeCount: activeItems.length,
                historyCount: historyItems.length,
                onSelected: (tab) => setState(() => selectedTab = tab),
              ),
              const SizedBox(height: 20),
              if (selectedTab == CustomerBookingListTab.history &&
                  historyItems.isNotEmpty) ...[
                CustomerBookingHistoryFilters(
                  selected: historyFilter,
                  bookings: historyItems,
                  onSelected: (filter) =>
                      setState(() => historyFilter = filter),
                ),
                const SizedBox(height: 20),
              ],
              if (auth == null)
                CustomerBookingLoginState(
                  onSignIn:
                      localDemoAccessEnabled && !loading ? signInAndLoad : null,
                )
              else if (!loading && items.isEmpty)
                const CustomerBookingEmptyState(
                  title: 'No bookings yet',
                  body:
                      'Choose a partner from Home to book your first service.',
                )
              else if (!loading && visibleItems.isEmpty)
                CustomerBookingEmptyState(
                  title: selectedTab == CustomerBookingListTab.active
                      ? 'No active booking'
                      : 'No booking history',
                  body: selectedTab == CustomerBookingListTab.active
                      ? 'Your next booking will appear here as soon as it is requested.'
                      : 'Completed and cancelled bookings will appear here.',
                )
              else ...[
                CustomerBookingListSectionHeader(
                  tab: selectedTab,
                  count: visibleItems.length,
                ),
                const SizedBox(height: 12),
                for (final booking in visibleItems) ...[
                  CustomerBookingCard(
                    booking: booking,
                    onOpen: () => openBooking(booking),
                    onOpenPartner: activeBookingProvider(booking) == null
                        ? null
                        : () => openBookingPartner(booking),
                    highlighted: isCustomerBookingTarget(
                      booking,
                      bookingId: widget.initialBookingId,
                      paymentId: widget.initialPaymentId,
                    ),
                  ),
                  const SizedBox(height: 12),
                ],
                if (selectedTab == CustomerBookingListTab.history &&
                    hasMore) ...[
                  const SizedBox(height: 4),
                  OutlinedButton(
                    onPressed: loadingMore ? null : loadMoreBookings,
                    child: Text(
                      loadingMore ? 'Loading bookings...' : 'Load more',
                    ),
                  ),
                ],
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class CustomerBookingListHeader extends StatelessWidget {
  const CustomerBookingListHeader({
    super.key,
    required this.loading,
    required this.onRefresh,
    required this.onBack,
  });

  final bool loading;
  final VoidCallback? onRefresh;
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    final colors = context.handsColors;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (onBack != null) ...[
          IconButton(
            tooltip: 'Back',
            onPressed: onBack,
            icon: const Icon(Icons.arrow_back_rounded),
            style: IconButton.styleFrom(
              foregroundColor: colors.ink,
              minimumSize: const Size.square(48),
            ),
          ),
          const SizedBox(width: 4),
        ],
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'My bookings',
                style: Theme.of(context).textTheme.displaySmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
              ),
              const SizedBox(height: 6),
              Text(
                'Track current services and past bookings.',
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: colors.inkMuted,
                    ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 12),
        IconButton.filledTonal(
          tooltip: 'Refresh bookings',
          onPressed: loading ? null : onRefresh,
          icon: const Icon(Icons.refresh_rounded),
          style: IconButton.styleFrom(
            backgroundColor: colors.surface,
            foregroundColor: colors.primary,
            minimumSize: const Size.square(48),
            side: BorderSide(color: colors.outline),
          ),
        ),
      ],
    );
  }
}

class CustomerBookingHistoryFilters extends StatelessWidget {
  const CustomerBookingHistoryFilters({
    super.key,
    required this.selected,
    required this.bookings,
    required this.onSelected,
  });

  final CustomerBookingHistoryFilter selected;
  final List<Map<String, dynamic>> bookings;
  final ValueChanged<CustomerBookingHistoryFilter> onSelected;

  @override
  Widget build(BuildContext context) {
    final colors = context.handsColors;
    return Material(
      color: Colors.transparent,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            for (final filter in CustomerBookingHistoryFilter.values) ...[
              ChoiceChip(
                label: Text(
                  '${customerBookingHistoryFilterLabel(filter)} '
                  '${customerBookingsForHistoryFilter(bookings, filter).length}',
                ),
                selected: selected == filter,
                onSelected: (_) => onSelected(filter),
                showCheckmark: false,
                side: BorderSide(
                  color: selected == filter ? colors.primary : colors.outline,
                ),
                backgroundColor: colors.surface,
                selectedColor: colors.primary,
                labelStyle: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: selected == filter ? colors.onPrimary : colors.ink,
                    ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
              if (filter != CustomerBookingHistoryFilter.values.last)
                const SizedBox(width: 8),
            ],
          ],
        ),
      ),
    );
  }
}

class CustomerBookingListTabs extends StatelessWidget {
  const CustomerBookingListTabs({
    super.key,
    required this.selected,
    required this.activeCount,
    required this.historyCount,
    required this.onSelected,
  });

  final CustomerBookingListTab selected;
  final int activeCount;
  final int historyCount;
  final ValueChanged<CustomerBookingListTab> onSelected;

  @override
  Widget build(BuildContext context) {
    final colors = context.handsColors;
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: colors.surfaceMuted,
        borderRadius: BorderRadius.circular(CustomerRadii.control),
      ),
      child: Row(
        children: [
          Expanded(
            child: CustomerBookingListTabButton(
              label: 'Active',
              count: activeCount,
              selected: selected == CustomerBookingListTab.active,
              onTap: () => onSelected(CustomerBookingListTab.active),
            ),
          ),
          Expanded(
            child: CustomerBookingListTabButton(
              label: 'History',
              count: historyCount,
              selected: selected == CustomerBookingListTab.history,
              onTap: () => onSelected(CustomerBookingListTab.history),
            ),
          ),
        ],
      ),
    );
  }
}

class CustomerBookingListTabButton extends StatelessWidget {
  const CustomerBookingListTabButton({
    super.key,
    required this.label,
    required this.count,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final int count;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.handsColors;
    return Material(
      color: selected ? colors.surface : Colors.transparent,
      borderRadius: BorderRadius.circular(CustomerRadii.control - 2),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(CustomerRadii.control - 2),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                label,
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: colors.primary,
                      fontWeight: FontWeight.w700,
                    ),
              ),
              const SizedBox(width: 7),
              Container(
                constraints: const BoxConstraints(minWidth: 24),
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: BoxDecoration(
                  color: selected
                      ? colors.primary
                      : colors.surface.withValues(alpha: 0.72),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  '$count',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        color: selected ? colors.onPrimary : colors.primary,
                        fontSize: 12,
                      ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class CustomerBookingListSectionHeader extends StatelessWidget {
  const CustomerBookingListSectionHeader({
    super.key,
    required this.tab,
    required this.count,
  });

  final CustomerBookingListTab tab;
  final int count;

  @override
  Widget build(BuildContext context) {
    final colors = context.handsColors;
    return Row(
      children: [
        Expanded(
          child: Text(
            tab == CustomerBookingListTab.active
                ? 'Active now'
                : 'Past bookings',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
        ),
        Text(
          '$count ${count == 1 ? 'booking' : 'bookings'}',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: colors.inkMuted,
              ),
        ),
      ],
    );
  }
}

class CustomerBookingCard extends StatelessWidget {
  const CustomerBookingCard({
    super.key,
    required this.booking,
    required this.onOpen,
    required this.onOpenPartner,
    this.highlighted = false,
  });

  final Map<String, dynamic> booking;
  final VoidCallback onOpen;
  final VoidCallback? onOpenPartner;
  final bool highlighted;

  @override
  Widget build(BuildContext context) {
    final colors = context.handsColors;
    final service = firstBookingService(booking);
    final provider = activeBookingProvider(booking);
    final payment = asMap(booking['payment']);
    final amount =
        asNum(payment?['amount'])?.toInt() ?? customerServicePrice(service);
    final chatVisible = isCustomerAppChatVisible(booking);
    final active = isCustomerActiveBooking(booking);
    final status = booking['status']?.toString();
    final partnerName =
        provider?['displayName']?.toString() ?? 'Partner pending';

    return Material(
      color: colors.canvas,
      shape: RoundedRectangleBorder(
        side: BorderSide(
          color: highlighted ? colors.primary : colors.outline,
          width: highlighted ? 2 : 1,
        ),
      ),
      child: InkWell(
        onTap: onOpen,
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  CustomerBookingStatusBadge(status: status),
                  const Spacer(),
                  Text(
                    formatCustomerBookingListMoment(
                      booking['createdAt'] ?? booking['updatedAt'],
                    ),
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ProviderThumbnail(
                    name: partnerName,
                    size: 58,
                    imageUrl: provider == null
                        ? null
                        : providerProfileImageUrl(provider),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          customerServiceOptionLabel(service),
                          style:
                              Theme.of(context).textTheme.titleLarge?.copyWith(
                                    fontWeight: FontWeight.w700,
                                  ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          partnerName,
                          style:
                              Theme.of(context).textTheme.bodyMedium?.copyWith(
                                    color: colors.inkMuted,
                                  ),
                        ),
                      ],
                    ),
                  ),
                  Icon(
                    Icons.chevron_right_rounded,
                    color: colors.primary,
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: colors.surfaceMuted,
                  borderRadius: BorderRadius.circular(HandsShapes.medium),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: CustomerBookingMetaItem(
                        icon: Icons.payments_outlined,
                        label: amount <= 0
                            ? 'Price unavailable'
                            : '${formatCurrency(amount)} VND',
                      ),
                    ),
                    const SizedBox(
                      height: 24,
                      child: VerticalDivider(),
                    ),
                    Expanded(
                      child: CustomerBookingMetaItem(
                        icon: Icons.account_balance_wallet_outlined,
                        label: customerBookingPaymentLabel(booking),
                      ),
                    ),
                    if (chatVisible) ...[
                      const SizedBox(
                        height: 24,
                        child: VerticalDivider(),
                      ),
                      const Expanded(
                        child: CustomerBookingMetaItem(
                          icon: Icons.chat_bubble_outline_rounded,
                          label: 'Chat ready',
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 14),
              Text(
                customerBookingNextAction(booking),
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: active ? colors.ink : colors.inkMuted,
                    ),
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  if (onOpenPartner != null)
                    TextButton.icon(
                      onPressed: onOpenPartner,
                      icon: const Icon(Icons.person_outline_rounded, size: 18),
                      label: const Text('View partner'),
                      style: TextButton.styleFrom(
                        foregroundColor: colors.primary,
                        padding: EdgeInsets.zero,
                      ),
                    ),
                  const Spacer(),
                  TextButton.icon(
                    onPressed: onOpen,
                    iconAlignment: IconAlignment.end,
                    icon: const Icon(Icons.arrow_forward_rounded, size: 18),
                    label: Text(active ? 'Live status' : 'Booking details'),
                    style: TextButton.styleFrom(
                      foregroundColor: colors.primary,
                      padding: EdgeInsets.zero,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class CustomerBookingStatusBadge extends StatelessWidget {
  const CustomerBookingStatusBadge({
    super.key,
    required this.status,
  });

  final String? status;

  @override
  Widget build(BuildContext context) {
    final colors = _bookingStatusColors(context.handsColors, status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
      decoration: BoxDecoration(
        color: colors.$1,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(_bookingStatusIcon(status), size: 16, color: colors.$2),
          const SizedBox(width: 6),
          Text(
            customerBookingStatusLabel(status),
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: colors.$2,
                  fontSize: 12,
                ),
          ),
        ],
      ),
    );
  }
}

class CustomerBookingMetaItem extends StatelessWidget {
  const CustomerBookingMetaItem({
    super.key,
    required this.icon,
    required this.label,
  });

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.handsColors;
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(icon, size: 18, color: colors.primary),
        const SizedBox(width: 7),
        Flexible(
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  fontSize: 12,
                ),
          ),
        ),
      ],
    );
  }
}

class CustomerBookingEmptyState extends StatelessWidget {
  const CustomerBookingEmptyState({
    super.key,
    required this.title,
    required this.body,
  });

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    final colors = context.handsColors;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 36),
      child: Column(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: colors.primarySoft,
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.calendar_month_outlined,
              color: colors.primary,
            ),
          ),
          const SizedBox(height: 16),
          Text(title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 6),
          Text(
            body,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: colors.inkMuted,
                ),
          ),
        ],
      ),
    );
  }
}

class CustomerBookingLoginState extends StatelessWidget {
  const CustomerBookingLoginState({
    super.key,
    required this.onSignIn,
  });

  final VoidCallback? onSignIn;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const CustomerBookingEmptyState(
          title: 'Sign in to view bookings',
          body: 'Your active and past bookings will appear here.',
        ),
        if (localDemoAccessEnabled && onSignIn != null) ...[
          const SizedBox(height: 12),
          FilledButton(
            onPressed: onSignIn,
            child: const Text('Use local demo login'),
          ),
        ],
      ],
    );
  }
}

(Color, Color) _bookingStatusColors(
  HandsColors colors,
  String? status,
) {
  return switch (status?.toUpperCase()) {
    'COMPLETED' => (
        colors.success.withValues(alpha: 0.12),
        colors.success,
      ),
    'CANCELLED' || 'NO_SHOW' || 'EXPIRED' => (
        colors.error.withValues(alpha: 0.12),
        colors.error,
      ),
    'REFUNDED' => (colors.mistBlue.withValues(alpha: 0.28), colors.primary),
    _ => (colors.primarySoft, colors.primary),
  };
}

IconData _bookingStatusIcon(String? status) {
  return switch (status?.toUpperCase()) {
    'CREATED' => Icons.hourglass_top_rounded,
    'OPEN_MATCHING' => Icons.search_rounded,
    'MATCHED' => Icons.check_circle_outline_rounded,
    'PROVIDER_ON_THE_WAY' => Icons.directions_bike_outlined,
    'ARRIVED' => Icons.location_on_outlined,
    'IN_SERVICE' => Icons.spa_outlined,
    'COMPLETED' => Icons.check_rounded,
    'CANCELLED' => Icons.close_rounded,
    'NO_SHOW' => Icons.person_off_outlined,
    'EXPIRED' => Icons.schedule_outlined,
    'REFUNDED' => Icons.currency_exchange_rounded,
    _ => Icons.info_outline_rounded,
  };
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
