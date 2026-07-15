import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:maplibre_gl/maplibre_gl.dart';

import '../../../app_state.dart';
import '../../../core/customer_value_helpers.dart';
import '../../../core/realtime_socket.dart';
import '../../../core/widgets/customer_feedback_panels.dart';
import '../../chat/presentation/customer_chat_screen.dart';
import '../../discovery/presentation/customer_service_option_helpers.dart';
import '../../map/presentation/customer_location_helpers.dart';
import '../../map/presentation/customer_map_widgets.dart';
import '../domain/repositories/customer_booking_repository.dart';
import 'customer_booking_error_messages.dart';
import 'customer_booking_ui_helpers.dart';

class BookingConfirmationPage extends ConsumerStatefulWidget {
  const BookingConfirmationPage({
    super.key,
    required this.providerDetail,
    required this.selectedService,
    this.initialCustomerLat,
    this.initialCustomerLng,
    this.initialCustomerAddress,
    this.initialCustomerLocationIsDemo = false,
  });

  final Map<String, dynamic> providerDetail;
  final Map<String, dynamic> selectedService;
  final double? initialCustomerLat;
  final double? initialCustomerLng;
  final String? initialCustomerAddress;
  final bool initialCustomerLocationIsDemo;
  @override
  ConsumerState<BookingConfirmationPage> createState() =>
      _BookingConfirmationPageState();
}

class _BookingConfirmationPageState
    extends ConsumerState<BookingConfirmationPage> {
  final nameController = TextEditingController(text: 'Demo Customer');
  final phoneController = TextEditingController(text: '0865907184');
  final addressController = TextEditingController(text: demoCustomerAddress);
  final couponController = TextEditingController();
  double? customerLat;
  double? customerLng;
  double? currentGpsLat;
  double? currentGpsLng;
  DateTime? currentGpsUpdatedAt;
  int couponDiscountAmount = 0;
  String? appliedCouponCode;
  String? couponMessage;
  String? locationMessage;
  bool applyingCoupon = false;
  bool submitting = false;
  bool locationConfirmed = false;
  bool loadingPaymentMethods = true;
  List<CustomerPaymentMethodOption> paymentMethods = const [
    CustomerPaymentMethodOption.cash,
  ];
  String selectedPaymentMethod = CustomerPaymentMethodOption.cash.method;
  String? error;

  @override
  void initState() {
    super.initState();
    customerLat = widget.initialCustomerLat;
    customerLng = widget.initialCustomerLng;
    final initialAddress = widget.initialCustomerAddress?.trim();
    if (initialAddress != null && initialAddress.isNotEmpty) {
      addressController.text = initialAddress;
    }
    locationConfirmed = customerLat != null &&
        customerLng != null &&
        !widget.initialCustomerLocationIsDemo;
    if (widget.initialCustomerLocationIsDemo) {
      locationMessage =
          'Nearby partners used a fallback city pin. Choose the exact service location before booking.';
    }
    if (customerLat == null || customerLng == null) {
      locationMessage =
          'Choose the exact Vietnam service location before booking.';
    }
    unawaited(loadPaymentMethods());
  }

  Future<void> loadPaymentMethods() async {
    try {
      final loaded =
          await ref.read(customerRepositoryProvider).listPaymentMethods();
      if (!mounted) {
        return;
      }
      setState(() {
        paymentMethods =
            loaded.isEmpty ? const [CustomerPaymentMethodOption.cash] : loaded;
        if (!paymentMethods
            .any((item) => item.method == selectedPaymentMethod)) {
          selectedPaymentMethod = paymentMethods.first.method;
        }
        loadingPaymentMethods = false;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() {
        paymentMethods = const [CustomerPaymentMethodOption.cash];
        selectedPaymentMethod = CustomerPaymentMethodOption.cash.method;
        loadingPaymentMethods = false;
      });
    }
  }

  @override
  void dispose() {
    nameController.dispose();
    phoneController.dispose();
    addressController.dispose();
    couponController.dispose();
    super.dispose();
  }

  Future<void> openLocationSelector() async {
    final selected = await Navigator.of(context).push<SelectedCustomerLocation>(
      MaterialPageRoute(
        builder: (context) => LocationSelectionPage(
          initialLatitude: customerLat ?? demoCustomerLat,
          initialLongitude: customerLng ?? demoCustomerLng,
          initialAddress: addressController.text.trim().isEmpty
              ? demoCustomerAddress
              : addressController.text.trim(),
        ),
      ),
    );
    if (selected == null || !mounted) {
      return;
    }
    setState(() {
      customerLat = selected.latitude;
      customerLng = selected.longitude;
      addressController.text = selected.addressText;
      locationConfirmed = true;
      locationMessage = 'Service location confirmed.';
      error = null;
    });
    ref.read(selectedCustomerLocationProvider.notifier).state = selected;
  }

  Future<void> refreshCurrentGpsEvidenceForBooking() async {
    try {
      final location = await resolveCustomerLocation(ref);
      if (!mounted) {
        return;
      }
      setState(() {
        currentGpsLat = location.currentLatitude;
        currentGpsLng = location.currentLongitude;
        currentGpsUpdatedAt = location.currentLatitude != null &&
                location.currentLongitude != null
            ? DateTime.now()
            : null;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() {
        currentGpsLat = null;
        currentGpsLng = null;
        currentGpsUpdatedAt = null;
      });
    }
  }

  Future<void> confirmBooking() async {
    final lat = customerLat;
    final lng = customerLng;
    if (!locationConfirmed || lat == null || lng == null) {
      setState(() {
        error =
            'Please confirm the service location on the map before booking.';
      });
      return;
    }
    setState(() {
      submitting = true;
      error = null;
    });
    try {
      await refreshCurrentGpsEvidenceForBooking();
      if (!mounted) {
        return;
      }
      final savedLocation =
          await ref.read(customerRepositoryProvider).saveSelectedLocation(
                lat: lat,
                lng: lng,
                addressText: addressController.text.trim(),
              );
      final selectedLocationId = savedLocation?['id'] as String?;
      final booking = await ref.read(customerRepositoryProvider).createBooking(
            widget.selectedService['id'] as String,
            providerId: widget.providerDetail['id'] as String?,
            couponCode: appliedCouponCode,
            selectedLocationId: selectedLocationId,
            paymentMethod: selectedPaymentMethod,
            customerName: nameController.text.trim(),
            customerPhone: phoneController.text.trim(),
            addressLine: addressController.text.trim(),
            lat: lat,
            lng: lng,
            currentLat: currentGpsLat,
            currentLng: currentGpsLng,
            currentLocationUpdatedAt: currentGpsUpdatedAt,
          );
      if (mounted) {
        Navigator.of(context).pop(booking);
      }
    } catch (exception) {
      setState(() => error = customerBookingErrorMessage(exception));
    } finally {
      if (mounted) {
        setState(() => submitting = false);
      }
    }
  }

  Future<void> applyCoupon() async {
    final code = couponController.text.trim();
    final servicePrice = customerServicePrice(widget.selectedService);
    if (code.isEmpty) {
      setState(() {
        appliedCouponCode = null;
        couponDiscountAmount = 0;
        couponMessage = 'Enter a coupon code first.';
      });
      return;
    }

    setState(() {
      applyingCoupon = true;
      error = null;
      couponMessage = null;
    });

    try {
      final preview = await ref.read(customerRepositoryProvider).previewCoupon(
            code: code,
            serviceId: widget.selectedService['id'] as String,
            subtotal: servicePrice,
          );
      if (!mounted) {
        return;
      }

      setState(() {
        appliedCouponCode = preview['code'] as String?;
        couponDiscountAmount = asNum(preview['discountAmount'])?.toInt() ?? 0;
        if (appliedCouponCode != null) {
          couponController.text = appliedCouponCode!;
          couponController.selection =
              TextSelection.collapsed(offset: couponController.text.length);
        }
        final description = preview['description'] as String?;
        couponMessage = description == null || description.isEmpty
            ? 'Coupon applied successfully.'
            : '${preview['code']} applied. $description';
      });
    } catch (exception) {
      if (!mounted) {
        return;
      }

      setState(() {
        appliedCouponCode = null;
        couponDiscountAmount = 0;
        couponMessage = '$exception';
      });
    } finally {
      if (mounted) {
        setState(() => applyingCoupon = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final service = widget.selectedService;
    final provider = widget.providerDetail;
    final distanceMeters = asDouble(provider['distanceMeters']);
    final servicePrice = customerServicePrice(service);
    final basePrice = asNum(service['basePrice'])?.toInt() ?? servicePrice;
    final hasProviderPrice = servicePrice != basePrice;
    final providerName = provider['displayName'] as String? ?? 'Partner';
    final serviceName = customerServiceName(service);
    final durationLabel = customerServiceDurationLabel(service);
    final serviceCount = 1;
    final rawTotalAmount = servicePrice - couponDiscountAmount;
    final totalAmount = rawTotalAmount < 0 ? 0 : rawTotalAmount;
    final couponApplied = appliedCouponCode != null && couponDiscountAmount > 0;
    final customerPoint = customerLat == null || customerLng == null
        ? null
        : LatLng(customerLat!, customerLng!);
    final providerPoint = deriveProviderLatLng(provider);
    return Scaffold(
      appBar: AppBar(title: const Text('Booking information')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
          children: [
            BookingSectionCard(
              title: 'Request summary',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: const [
                      ServiceTag(label: 'Direct request'),
                      ServiceTag(label: 'Marketplace matching if needed'),
                      ServiceTag(label: 'Chat after match'),
                    ],
                  ),
                  const SizedBox(height: 16),
                  BookingSummaryRow(
                    label: 'Partner',
                    value: providerName,
                  ),
                  const SizedBox(height: 10),
                  BookingSummaryRow(
                    label: 'Service',
                    value: serviceName,
                  ),
                  const SizedBox(height: 10),
                  BookingSummaryRow(
                    label: 'Duration',
                    value: durationLabel,
                  ),
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 14),
                    child: Divider(height: 1),
                  ),
                  BookingSummaryRow(
                    label: 'Amount to pay',
                    value: '${formatCurrency(totalAmount)} VND',
                    emphasized: true,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            BookingSectionCard(
              title: 'My address',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: nameController,
                          decoration: const InputDecoration(labelText: 'Name'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextField(
                          controller: phoneController,
                          decoration: const InputDecoration(labelText: 'Phone'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: addressController,
                    decoration: const InputDecoration(labelText: 'Address'),
                    maxLines: 2,
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      const Icon(Icons.call_outlined,
                          size: 18, color: Colors.black54),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          phoneController.text,
                          style: Theme.of(context)
                              .textTheme
                              .bodyMedium
                              ?.copyWith(color: Colors.black54),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            BookingSectionCard(
              title: 'Service location',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(18),
                    child: SizedBox(
                      height: 180,
                      child: LocationMapSurface(
                        customerPoint: customerPoint,
                        providerPoint: providerPoint,
                        customerLabel: 'Customer',
                        providerLabel: 'Partner area',
                        fallbackShowProviderMarker: true,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      const Icon(Icons.location_on_outlined,
                          size: 20, color: Colors.grey),
                      const SizedBox(width: 6),
                      Expanded(child: Text(addressController.text)),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Service pin: ${formatCoordinate(customerLat)}, ${formatCoordinate(customerLng)}',
                    style: Theme.of(context)
                        .textTheme
                        .bodyMedium
                        ?.copyWith(color: Colors.black54),
                  ),
                  if (locationMessage != null) ...[
                    const SizedBox(height: 8),
                    InfoBanner(text: locationMessage!),
                  ],
                  const SizedBox(height: 4),
                  Text(
                    'Partner distance: ${formatDistance(distanceMeters)}',
                    style: Theme.of(context)
                        .textTheme
                        .bodyMedium
                        ?.copyWith(color: Colors.black54),
                  ),
                  const SizedBox(height: 12),
                  FilledButton.tonalIcon(
                    onPressed: openLocationSelector,
                    icon: const Icon(Icons.pin_drop_outlined),
                    label: const Text('Choose on map'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            BookingSectionCard(
              title: 'Selected service',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      ProviderThumbnail(
                          name: providerName,
                          size: 72,
                          imageUrl: providerProfileImageUrl(provider)),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              providerName,
                              style: Theme.of(context).textTheme.titleLarge,
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '${providerAverageRating(provider).toStringAsFixed(1)} (${providerReviewCount(provider)} reviews)',
                            ),
                            const SizedBox(height: 4),
                            Text(
                              formatDistance(distanceMeters),
                              style: Theme.of(context)
                                  .textTheme
                                  .bodyMedium
                                  ?.copyWith(color: Colors.black54),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8F5EC),
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          serviceName,
                          style: Theme.of(context)
                              .textTheme
                              .titleMedium
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          durationLabel,
                          style: Theme.of(context)
                              .textTheme
                              .bodyMedium
                              ?.copyWith(color: Colors.black54),
                        ),
                        const SizedBox(height: 10),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            ServiceTag(label: durationLabel),
                            ServiceTag(
                                label: '${formatCurrency(servicePrice)} VND'),
                            if (hasProviderPrice)
                              ServiceTag(
                                  label:
                                      'Minimum ${formatCurrency(basePrice)} VND'),
                            const ServiceTag(label: '1 partner'),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            BookingSectionCard(
              title: 'Payment method',
              child: loadingPaymentMethods
                  ? const Row(
                      children: [
                        SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                        SizedBox(width: 12),
                        Text('Checking available payment methods...'),
                      ],
                    )
                  : paymentMethods.length == 1
                      ? _PaymentMethodSummary(method: paymentMethods.first)
                      : DropdownButtonFormField<String>(
                          initialValue: selectedPaymentMethod,
                          decoration: const InputDecoration(
                            labelText: 'Payment method',
                          ),
                          items: paymentMethods
                              .map(
                                (method) => DropdownMenuItem<String>(
                                  value: method.method,
                                  child: Text(method.label),
                                ),
                              )
                              .toList(growable: false),
                          onChanged: submitting
                              ? null
                              : (value) {
                                  if (value != null) {
                                    setState(
                                        () => selectedPaymentMethod = value);
                                  }
                                },
                        ),
            ),
            const SizedBox(height: 14),
            BookingSectionCard(
              title: 'Discount code',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: TextField(
                          controller: couponController,
                          decoration: const InputDecoration(
                              hintText: 'Enter coupon code'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      TextButton(
                        onPressed: applyingCoupon ? null : applyCoupon,
                        child: Text(applyingCoupon ? 'Checking...' : 'Apply'),
                      ),
                    ],
                  ),
                  if (couponMessage != null) ...[
                    const SizedBox(height: 10),
                    Text(
                      couponMessage!,
                      style: TextStyle(
                        color: appliedCouponCode != null
                            ? const Color(0xFF5E8E4A)
                            : const Color(0xFFB3261E),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                  if (couponApplied) ...[
                    const SizedBox(height: 14),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F8E9),
                        border: Border.all(color: const Color(0xFFCBE7BB)),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Discount applied',
                            style: Theme.of(context)
                                .textTheme
                                .titleSmall
                                ?.copyWith(
                                  color: const Color(0xFF3F6F2D),
                                  fontWeight: FontWeight.w800,
                                ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            '$appliedCouponCode saves ${formatCurrency(couponDiscountAmount)} VND. Final payment amount is ${formatCurrency(totalAmount)} VND.',
                            style: Theme.of(context)
                                .textTheme
                                .bodyMedium
                                ?.copyWith(color: const Color(0xFF3F6F2D)),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 14),
            BookingSectionCard(
              title: 'Payment summary',
              child: Column(
                children: [
                  BookingSummaryRow(
                    label: 'Services',
                    value: '$serviceCount item',
                  ),
                  const SizedBox(height: 10),
                  BookingSummaryRow(
                    label: 'Service type',
                    value: serviceName,
                  ),
                  const SizedBox(height: 10),
                  BookingSummaryRow(
                    label: 'Duration',
                    value: durationLabel,
                  ),
                  const SizedBox(height: 10),
                  BookingSummaryRow(
                    label: 'Service price',
                    value: '${formatCurrency(servicePrice)} VND',
                  ),
                  const SizedBox(height: 10),
                  BookingSummaryRow(
                    label: 'Coupon',
                    value: appliedCouponCode == null
                        ? 'Not applied'
                        : '-${formatCurrency(couponDiscountAmount)} VND ($appliedCouponCode)',
                    highlighted: appliedCouponCode != null,
                  ),
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 14),
                    child: Divider(height: 1),
                  ),
                  BookingSummaryRow(
                    label: 'Total',
                    value: '${formatCurrency(totalAmount)} VND',
                    emphasized: true,
                  ),
                ],
              ),
            ),
            if (error != null) ...[
              const SizedBox(height: 12),
              ErrorPanel(text: error!),
            ],
          ],
        ),
      ),
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.fromLTRB(16, 8, 16, 16),
        child: FilledButton(
          onPressed: submitting ? null : confirmBooking,
          style: FilledButton.styleFrom(
            backgroundColor: const Color(0xFF5E8E4A),
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 18),
          ),
          child: Text(
            submitting
                ? 'Creating booking...'
                : !locationConfirmed
                    ? 'Confirm location before booking'
                    : 'Send booking request - ${formatCurrency(totalAmount)} VND',
          ),
        ),
      ),
    );
  }
}

class _PaymentMethodSummary extends StatelessWidget {
  const _PaymentMethodSummary({required this.method});

  final CustomerPaymentMethodOption method;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(
          method.method == 'CASH'
              ? Icons.payments_outlined
              : Icons.account_balance_wallet_outlined,
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                method.label,
                style: Theme.of(context)
                    .textTheme
                    .titleMedium
                    ?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 2),
              Text(
                method.method == 'CASH'
                    ? 'Pay the partner when the service starts.'
                    : 'Continue to secure payment after the booking request.',
                style: Theme.of(context)
                    .textTheme
                    .bodyMedium
                    ?.copyWith(color: Colors.black54),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class BookingSummaryRow extends StatelessWidget {
  const BookingSummaryRow({
    super.key,
    required this.label,
    required this.value,
    this.emphasized = false,
    this.highlighted = false,
  });

  final String label;
  final String value;
  final bool emphasized;
  final bool highlighted;

  @override
  Widget build(BuildContext context) {
    final labelStyle = emphasized
        ? Theme.of(context)
            .textTheme
            .titleMedium
            ?.copyWith(fontWeight: FontWeight.w800)
        : Theme.of(context).textTheme.bodyLarge;
    final valueStyle = emphasized
        ? Theme.of(context)
            .textTheme
            .titleLarge
            ?.copyWith(fontWeight: FontWeight.w800)
        : Theme.of(context).textTheme.bodyLarge?.copyWith(
              color: highlighted ? const Color(0xFF5E8E4A) : null,
              fontWeight: highlighted ? FontWeight.w700 : FontWeight.w500,
            );

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(child: Text(label, style: labelStyle)),
        const SizedBox(width: 12),
        Flexible(
          child: Text(
            value,
            style: valueStyle,
            textAlign: TextAlign.right,
          ),
        ),
      ],
    );
  }
}

class BookingWaitingPage extends ConsumerStatefulWidget {
  const BookingWaitingPage({
    super.key,
    required this.initialBooking,
    required this.onBookingUpdated,
  });

  final Map<String, dynamic> initialBooking;
  final ValueChanged<Map<String, dynamic>> onBookingUpdated;

  @override
  ConsumerState<BookingWaitingPage> createState() => _BookingWaitingPageState();
}

class _BookingWaitingPageState extends ConsumerState<BookingWaitingPage> {
  Timer? timer;
  Map<String, dynamic>? booking;
  late final RealtimeSocket _socket;
  Map<String, dynamic>? latestProviderLocation;
  String? statusMessage;
  String? error;
  bool loading = false;
  bool reviewSubmitting = false;

  @override
  void initState() {
    super.initState();
    _socket = ref.read(realtimeSocketProvider);
    booking = widget.initialBooking;
    latestProviderLocation = bookingLatestProviderLocation(booking);
    final bookingId = booking?['id'] as String?;
    if (bookingId != null) {
      ref.read(customerRepositoryProvider).joinBookingRoom(bookingId);
    }
    attachRealtimeListeners();
    timer = Timer.periodic(
        const Duration(seconds: 5), (_) => refreshBooking(showLoading: false));
  }

  @override
  void dispose() {
    timer?.cancel();
    detachRealtimeListeners();
    super.dispose();
  }

  void attachRealtimeListeners() {
    detachRealtimeListeners();
    _socket.onEvent('provider.location.updated', (payload) {
      final activeBookingId = booking?['id'];
      if (!mounted ||
          payload is! Map ||
          payload['bookingId'] != activeBookingId) {
        return;
      }
      setState(() {
        latestProviderLocation =
            Map<String, dynamic>.from(payload.cast<String, dynamic>());
      });
    });

    final eventMessages = <String, String>{
      'provider.joined': 'A marketplace partner joined this request.',
      'provider.accepted':
          'A partner accepted. Confirm this partner or choose another available option.',
      'provider.rejected':
          'A partner declined. We will keep showing available options.',
      'booking.matched': 'Your partner confirmed the booking.',
      'booking.opened': 'The request is still open for partner responses.',
      'booking.expired': 'This booking expired or was cancelled.',
      'service.started': 'Service started. Matched chat remains available.',
      'service.completed': 'Service completed. You can review the booking.',
    };

    for (final entry in eventMessages.entries) {
      _socket.onEvent(entry.key, (payload) {
        if (!mounted) {
          return;
        }
        setState(() => statusMessage = entry.value);
        unawaited(refreshBooking(showLoading: false));
      });
    }
  }

  void detachRealtimeListeners() {
    for (final event in [
      'provider.location.updated',
      'provider.joined',
      'provider.accepted',
      'provider.rejected',
      'booking.matched',
      'booking.opened',
      'booking.expired',
      'service.started',
      'service.completed',
    ]) {
      _socket.offEvent(event);
    }
  }

  Future<void> refreshBooking({bool showLoading = true}) async {
    final bookingId = booking?['id'] as String?;
    if (bookingId == null) {
      return;
    }
    if (showLoading) {
      setState(() {
        loading = true;
        error = null;
      });
    }
    try {
      final updated =
          await ref.read(customerRepositoryProvider).getBooking(bookingId);
      if (!mounted) {
        return;
      }
      final storedProviderLocation = bookingLatestProviderLocation(updated);
      setState(() {
        booking = updated;
        if (storedProviderLocation != null) {
          latestProviderLocation = storedProviderLocation;
        }
      });
      widget.onBookingUpdated(updated);
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

  Future<void> openChatRoom(String chatRoomId) async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (context) => ChatScreen(
          initialChatRoomId: chatRoomId,
          initialBookingId: booking?['id']?.toString(),
        ),
      ),
    );
    await refreshBooking(showLoading: false);
  }

  Future<void> cancelBooking() async {
    final bookingId = booking?['id'] as String?;
    if (bookingId == null) {
      return;
    }
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final updated =
          await ref.read(customerRepositoryProvider).cancelBooking(bookingId);
      if (!mounted) {
        return;
      }
      widget.onBookingUpdated(updated);
      Navigator.of(context).pop();
    } catch (exception) {
      setState(() => error = '$exception');
    } finally {
      if (mounted) {
        setState(() => loading = false);
      }
    }
  }

  Future<void> selectProvider(Map<String, dynamic> participant) async {
    final bookingId = booking?['id'] as String?;
    final providerId = participant['providerProfileId'] as String?;
    if (bookingId == null || providerId == null) {
      return;
    }
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final updated = await ref
          .read(customerRepositoryProvider)
          .selectProvider(bookingId, providerId);
      if (!mounted) {
        return;
      }
      setState(() => booking = updated);
      widget.onBookingUpdated(updated);
    } catch (exception) {
      setState(() => error = '$exception');
    } finally {
      if (mounted) {
        setState(() => loading = false);
      }
    }
  }

  Future<void> submitReview() async {
    final bookingId = booking?['id']?.toString();
    if (bookingId == null || reviewSubmitting) {
      return;
    }
    final reviewInput = await showDialog<CustomerReviewInput>(
      context: context,
      builder: (context) => const CustomerReviewDialog(),
    );
    if (reviewInput == null || !mounted) {
      return;
    }
    setState(() {
      reviewSubmitting = true;
      error = null;
    });
    try {
      final review = await ref.read(customerRepositoryProvider).createReview(
            bookingId: bookingId,
            rating: reviewInput.rating,
            comment: reviewInput.comment,
          );
      if (!mounted) {
        return;
      }
      setState(() {
        booking = {...?booking, 'review': review};
        statusMessage = 'Review submitted. Thank you.';
      });
    } catch (exception) {
      if (mounted) {
        setState(() => error = '$exception');
      }
    } finally {
      if (mounted) {
        setState(() => reviewSubmitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final currentBooking = booking;
    final participants = currentBooking?['participants'] is List<dynamic>
        ? currentBooking!['participants'] as List<dynamic>
        : <dynamic>[];
    final preferredProviderData =
        currentBooking?['preferredProvider'] as Map<String, dynamic>?;
    final selectedProvider =
        currentBooking?['selectedProvider'] as Map<String, dynamic>?;
    final service =
        currentBooking == null ? null : firstBookingService(currentBooking);
    final status = currentBooking?['status'] as String? ?? 'OPEN_MATCHING';
    final isMatching = status == 'OPEN_MATCHING';
    final isCompleted = status == 'COMPLETED';
    final isClosed =
        currentBooking != null && isCustomerClosedBooking(currentBooking);
    final canDirectCancel = canCustomerDirectlyCancelBooking(currentBooking);
    final needsOpsReview = customerCancellationNeedsOpsReview(status);
    final preferredProvider =
        status == 'OPEN_MATCHING' ? preferredProviderData : null;
    final finalizedProvider = status == 'OPEN_MATCHING'
        ? null
        : selectedProvider ?? preferredProviderData;
    final alternativeParticipants = status == 'OPEN_MATCHING'
        ? customerSelectableMarketplaceParticipants(
            participants,
            preferredProviderId: preferredProvider?['id']?.toString(),
          )
        : <Map<String, dynamic>>[];
    final expiresAt = currentBooking?['expiresAt'] as String?;
    final fallbackCount = alternativeParticipants.length;
    final customerPoint = deriveBookingLatLng(currentBooking);
    final providerPoint = deriveRealtimeLatLng(latestProviderLocation);
    final chatRoom = asMap(currentBooking?['chatRoom']);
    final chatRoomId = chatRoom?['id']?.toString();
    final matchingPolicy = bookingMatchingPolicy(currentBooking);
    final timeLeft = formatRemainingTime(expiresAt);
    final action = waitingCustomerAction(
      status: status,
      fallbackCount: fallbackCount,
      hasChatRoom: chatRoomId != null,
      matchingPolicy: matchingPolicy,
    );
    final waitingHeadline = status == 'OPEN_MATCHING'
        ? '${providerDisplayName(currentBooking)} confirmation pending'
        : status == 'MATCHED'
            ? '${providerDisplayName(currentBooking)} confirmed'
            : status == 'IN_SERVICE'
                ? 'Service in progress'
                : 'Booking update';
    final waitingText = status == 'OPEN_MATCHING'
        ? (preferredProvider == null
            ? 'Waiting for nearby partners to respond...'
            : 'Waiting for ${preferredProvider['displayName'] ?? 'your partner'} to confirm. Marketplace partners may join too.')
        : status == 'MATCHED'
            ? 'Partner confirmed. Chat is ready for coordination...'
            : status == 'IN_SERVICE'
                ? 'Service started. Continue in Chat.'
                : 'Status: $status';

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: Stack(
                children: [
                  LocationMapSurface(
                    customerPoint: customerPoint,
                    providerPoint: providerPoint,
                    customerLabel: 'You',
                    providerLabel:
                        latestProviderLocation == null ? 'Waiting' : 'Partner',
                    fallbackShowProviderMarker: latestProviderLocation != null,
                  ),
                  Positioned(
                    top: 18,
                    left: 18,
                    child: const CircleAvatar(
                      radius: 24,
                      backgroundColor: Colors.white,
                      child: BackButton(),
                    ),
                  ),
                  Positioned(
                    top: 18,
                    right: 18,
                    child: canDirectCancel
                        ? FilledButton(
                            onPressed: loading ? null : cancelBooking,
                            style: FilledButton.styleFrom(
                              backgroundColor: const Color(0xFFE84B4B),
                              foregroundColor: Colors.white,
                            ),
                            child: const Text('Cancel request'),
                          )
                        : needsOpsReview
                            ? Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 14, vertical: 10),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(999),
                                  boxShadow: const [
                                    BoxShadow(
                                      color: Color(0x22000000),
                                      blurRadius: 12,
                                      offset: Offset(0, 4),
                                    ),
                                  ],
                                ),
                                child: const Text('Chat evidence'),
                              )
                            : const SizedBox.shrink(),
                  ),
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: 0,
                    child: Container(
                      decoration: const BoxDecoration(
                        color: Colors.white,
                        borderRadius:
                            BorderRadius.vertical(top: Radius.circular(24)),
                      ),
                      padding: const EdgeInsets.fromLTRB(20, 20, 20, 28),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            waitingHeadline,
                            style: Theme.of(context)
                                .textTheme
                                .headlineSmall
                                ?.copyWith(fontWeight: FontWeight.w800),
                          ),
                          const SizedBox(height: 8),
                          Text(waitingText,
                              style: Theme.of(context).textTheme.bodyLarge),
                          if (isMatching) ...[
                            const SizedBox(height: 8),
                            Text(
                                'This request closes automatically at ${formatExpiry(expiresAt)}'),
                          ],
                          const SizedBox(height: 16),
                          if (loading) const LinearProgressIndicator(),
                          if (error != null) ...[
                            const SizedBox(height: 12),
                            ErrorPanel(text: error!),
                          ],
                          if (statusMessage != null) ...[
                            const SizedBox(height: 12),
                            InfoBanner(text: statusMessage!),
                          ],
                          const SizedBox(height: 12),
                          if (service != null)
                            Text(
                              customerServiceOptionPriceLabel(service),
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                          if (!isClosed) ...[
                            const SizedBox(height: 16),
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: [
                                BookingTimelineChip(
                                  icon: Icons.tag_rounded,
                                  label:
                                      'Booking ${shortCode(currentBooking?['id'])}',
                                ),
                                BookingTimelineChip(
                                  icon: Icons.timer_outlined,
                                  label: isMatching
                                      ? timeLeft
                                      : waitingStepLabel(status),
                                ),
                                if (isMatching)
                                  BookingTimelineChip(
                                    icon: Icons.groups_rounded,
                                    label: fallbackCount == 0
                                        ? 'No marketplace option yet'
                                        : '$fallbackCount marketplace ready',
                                  ),
                              ],
                            ),
                            const SizedBox(height: 16),
                            LinearProgressIndicator(
                              value: bookingProgress(status),
                              minHeight: 8,
                              borderRadius: BorderRadius.circular(999),
                            ),
                          ],
                          if (isMatching) ...[
                            const SizedBox(height: 18),
                            LayoutBuilder(
                              builder: (context, constraints) {
                                final cardWidth =
                                    (constraints.maxWidth - 12) / 2;
                                return Wrap(
                                  spacing: 12,
                                  runSpacing: 12,
                                  children: [
                                    SizedBox(
                                      width: cardWidth,
                                      child: WaitingStatCard(
                                        label: 'Current step',
                                        value: waitingStepLabel(status),
                                      ),
                                    ),
                                    SizedBox(
                                      width: cardWidth,
                                      child: WaitingStatCard(
                                        label: 'Marketplace partners',
                                        value: fallbackCount.toString(),
                                      ),
                                    ),
                                    SizedBox(
                                      width: cardWidth,
                                      child: WaitingStatCard(
                                        label: 'Time left',
                                        value: timeLeft,
                                      ),
                                    ),
                                    SizedBox(
                                      width: cardWidth,
                                      child: WaitingStatCard(
                                        label: 'Signal',
                                        value: waitingSignalLabel(
                                            status, fallbackCount),
                                      ),
                                    ),
                                  ],
                                );
                              },
                            ),
                            const SizedBox(height: 12),
                            WaitingStagePanel(
                              status: status,
                              fallbackCount: fallbackCount,
                              preferredProviderName:
                                  preferredProvider?['displayName'] as String?,
                              expiresAt: expiresAt,
                              matchingPolicy: matchingPolicy,
                            ),
                          ],
                          const SizedBox(height: 12),
                          WaitingInfoBanner(
                            title: action.title,
                            body: action.body,
                          ),
                          if (chatRoomId != null &&
                              isCustomerAppChatVisible(currentBooking)) ...[
                            const SizedBox(height: 12),
                            FilledButton.icon(
                              onPressed: loading
                                  ? null
                                  : () => openChatRoom(chatRoomId),
                              icon: const Icon(Icons.chat_bubble_outline),
                              label: Text(chatActionLabel(status)),
                            ),
                          ],
                          if (!isClosed) ...[
                            const SizedBox(height: 18),
                            BookingSectionCard(
                              title: 'Partner location',
                              child: LiveLocationDetails(
                                customerPoint: customerPoint,
                                providerLocation: latestProviderLocation,
                                emptyText:
                                    'The partner\'s last shared pin will appear here after they share location.',
                              ),
                            ),
                          ],
                          const SizedBox(height: 18),
                          if (preferredProvider != null) ...[
                            Text('Chosen partner',
                                style: Theme.of(context)
                                    .textTheme
                                    .titleLarge
                                    ?.copyWith(fontWeight: FontWeight.w700)),
                            const SizedBox(height: 12),
                            PartnerDisplayCard(
                              provider: preferredProvider,
                              badgeLabel: 'Chosen first',
                              detail: directRequestDetail(matchingPolicy),
                              subtitle: fallbackCount == 0
                                  ? 'Checking availability - $timeLeft'
                                  : 'Checking availability - $timeLeft with ${marketplaceParticipationLabel(matchingPolicy)}',
                            ),
                            const SizedBox(height: 16),
                          ],
                          if (alternativeParticipants.isNotEmpty) ...[
                            Text('Marketplace partners',
                                style: Theme.of(context)
                                    .textTheme
                                    .titleLarge
                                    ?.copyWith(fontWeight: FontWeight.w700)),
                            const SizedBox(height: 4),
                            Text(
                              '$fallbackCount partner(s) can take this request now. You can keep waiting or switch.',
                              style: Theme.of(context)
                                  .textTheme
                                  .bodyMedium
                                  ?.copyWith(color: Colors.black54),
                            ),
                            const SizedBox(height: 12),
                            for (final item in alternativeParticipants)
                              PartnerSelectionCard(
                                participant: item,
                                onSelect: () => selectProvider(item),
                              ),
                          ] else if (finalizedProvider != null) ...[
                            Text('Confirmed partner',
                                style: Theme.of(context)
                                    .textTheme
                                    .titleLarge
                                    ?.copyWith(fontWeight: FontWeight.w700)),
                            const SizedBox(height: 12),
                            PartnerDisplayCard(
                              provider: finalizedProvider,
                              badgeLabel: 'Confirmed',
                              detail:
                                  'Your booking is now locked to this partner.',
                            ),
                          ] else if (isMatching) ...[
                            const EmptyPanel(
                                text:
                                    'Waiting for a partner response. Marketplace options can appear here if the first partner is slow to confirm.'),
                          ],
                          if (isCompleted &&
                              currentBooking?['review'] == null) ...[
                            const SizedBox(height: 12),
                            FilledButton.icon(
                              onPressed: reviewSubmitting ? null : submitReview,
                              icon: const Icon(Icons.star_outline_rounded),
                              label: Text(reviewSubmitting
                                  ? 'Submitting review...'
                                  : 'Leave a review'),
                            ),
                          ] else if (isCompleted) ...[
                            const SizedBox(height: 12),
                            InfoBanner(
                              text:
                                  'Review submitted: ${asNum(asMap(currentBooking?['review'])?['rating'])?.toInt() ?? '-'} / 5',
                            ),
                          ],
                          if (isClosed) ...[
                            const SizedBox(height: 12),
                            FilledButton.tonalIcon(
                              onPressed: () => Navigator.of(context).pop(),
                              icon: const Icon(Icons.receipt_long_outlined),
                              label: const Text('Close booking record'),
                            ),
                          ],
                          const SizedBox(height: 10),
                          if (!isClosed)
                            FilledButton.tonalIcon(
                              onPressed:
                                  loading ? null : () => refreshBooking(),
                              icon: const Icon(Icons.refresh),
                              label: const Text('Check latest status'),
                            ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class CustomerReviewInput {
  const CustomerReviewInput({
    required this.rating,
    this.comment,
  });

  final int rating;
  final String? comment;
}

class CustomerReviewDialog extends StatefulWidget {
  const CustomerReviewDialog({super.key});

  @override
  State<CustomerReviewDialog> createState() => _CustomerReviewDialogState();
}

class _CustomerReviewDialogState extends State<CustomerReviewDialog> {
  final commentController = TextEditingController();
  int rating = 5;

  @override
  void dispose() {
    commentController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Review your service'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('How was your HANDS service?'),
            const SizedBox(height: 12),
            Wrap(
              spacing: 2,
              children: [
                for (var value = 1; value <= 5; value++)
                  IconButton(
                    tooltip: '$value star${value == 1 ? '' : 's'}',
                    onPressed: () => setState(() => rating = value),
                    icon: Icon(
                      value <= rating
                          ? Icons.star_rounded
                          : Icons.star_outline_rounded,
                      color: const Color(0xFFF4A340),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              controller: commentController,
              maxLength: 1000,
              minLines: 3,
              maxLines: 5,
              decoration: const InputDecoration(
                labelText: 'Comment (optional)',
                hintText: 'Share what went well or what could improve.',
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Not now'),
        ),
        FilledButton(
          onPressed: () {
            final comment = commentController.text.trim();
            Navigator.of(context).pop(
              CustomerReviewInput(
                rating: rating,
                comment: comment.isEmpty ? null : comment,
              ),
            );
          },
          child: const Text('Submit review'),
        ),
      ],
    );
  }
}

class PartnerSelectionCard extends StatelessWidget {
  const PartnerSelectionCard({
    super.key,
    required this.participant,
    required this.onSelect,
  });

  final Map<String, dynamic> participant;
  final VoidCallback onSelect;

  @override
  Widget build(BuildContext context) {
    final provider =
        asMap(participant['providerProfile']) ?? <String, dynamic>{};
    final providerName = provider['displayName']?.toString() ?? 'Partner';
    final distance = formatDistance(asDouble(participant['distanceMeters']));
    final titleStyle = Theme.of(context)
        .textTheme
        .titleMedium
        ?.copyWith(fontWeight: FontWeight.w700);
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            LayoutBuilder(
              builder: (context, constraints) {
                final compact = constraints.maxWidth < 340;
                final thumbnailSize = compact ? 68.0 : 84.0;
                final details = Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      providerName,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      softWrap: true,
                      style: titleStyle,
                    ),
                    const SizedBox(height: 8),
                    const Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        PartnerRoleTag(
                          label: 'Marketplace ready',
                          backgroundColor: Color(0xFFF8ECD4),
                          foregroundColor: Color(0xFF8A5B12),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '${participant['status'] ?? 'JOINED'} - $distance',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'You can choose this partner as your final partner if this option works better.',
                      style: Theme.of(context)
                          .textTheme
                          .bodyMedium
                          ?.copyWith(color: Colors.black54),
                    ),
                  ],
                );

                if (compact) {
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      ProviderThumbnail(
                          name: providerName, size: thumbnailSize),
                      const SizedBox(height: 10),
                      details,
                    ],
                  );
                }

                return Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    ProviderThumbnail(name: providerName, size: thumbnailSize),
                    const SizedBox(width: 12),
                    Expanded(child: details),
                  ],
                );
              },
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: onSelect,
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF5E8E4A),
                  foregroundColor: Colors.white,
                ),
                child: const Text('Switch to this partner'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class PartnerDisplayCard extends StatelessWidget {
  const PartnerDisplayCard({
    super.key,
    required this.provider,
    this.subtitle = 'Ready for confirmation / service delivery',
    this.detail,
    this.badgeLabel,
  });

  final Map<String, dynamic> provider;
  final String subtitle;
  final String? detail;
  final String? badgeLabel;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ProviderThumbnail(
                name: provider['displayName'] as String? ?? 'Partner',
                size: 84),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          provider['displayName'] as String? ?? 'Partner',
                          style: Theme.of(context)
                              .textTheme
                              .titleMedium
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                      ),
                      if (badgeLabel != null)
                        PartnerRoleTag(
                          label: badgeLabel!,
                          backgroundColor: badgeLabel == 'Final'
                              ? const Color(0xFFE8F4E3)
                              : const Color(0xFFE7F2DE),
                          foregroundColor: badgeLabel == 'Final'
                              ? const Color(0xFF2E6A2B)
                              : const Color(0xFF446B2A),
                        ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(subtitle),
                  if (detail != null) ...[
                    const SizedBox(height: 6),
                    Text(
                      detail!,
                      style: Theme.of(context)
                          .textTheme
                          .bodyMedium
                          ?.copyWith(color: Colors.black54),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class PartnerRoleTag extends StatelessWidget {
  const PartnerRoleTag({
    super.key,
    required this.label,
    required this.backgroundColor,
    required this.foregroundColor,
  });

  final String label;
  final Color backgroundColor;
  final Color foregroundColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: foregroundColor,
              fontWeight: FontWeight.w700,
            ),
      ),
    );
  }
}

class WaitingStatCard extends StatelessWidget {
  const WaitingStatCard({
    super.key,
    required this.label,
    required this.value,
  });

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFF8F5EC),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: Theme.of(context)
                  .textTheme
                  .bodyMedium
                  ?.copyWith(color: Colors.black54)),
          const SizedBox(height: 8),
          Text(value,
              style: Theme.of(context)
                  .textTheme
                  .titleLarge
                  ?.copyWith(fontWeight: FontWeight.w800)),
        ],
      ),
    );
  }
}

class BookingTimelineChip extends StatelessWidget {
  const BookingTimelineChip({
    super.key,
    required this.icon,
    required this.label,
  });

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFF7F4EA),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: const Color(0xFFE4DDCA)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 18, color: const Color(0xFF5E8E4A)),
          const SizedBox(width: 8),
          Text(
            label,
            style: Theme.of(context)
                .textTheme
                .bodyMedium
                ?.copyWith(fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}

class WaitingStagePanel extends StatelessWidget {
  const WaitingStagePanel({
    super.key,
    required this.status,
    required this.fallbackCount,
    required this.preferredProviderName,
    required this.expiresAt,
    this.matchingPolicy = const {},
  });

  final String status;
  final int fallbackCount;
  final String? preferredProviderName;
  final String? expiresAt;
  final Map<String, dynamic> matchingPolicy;

  @override
  Widget build(BuildContext context) {
    final stageItems = [
      WaitingStageItem(
        title: preferredProviderName == null
            ? 'Finding a partner'
            : 'Chosen partner first',
        body: preferredProviderName == null
            ? 'Nearby partners are being checked now.'
            : '$preferredProviderName gets ${responseWindowLabel(matchingPolicy)} while ${marketplaceWindowDescription(matchingPolicy)}.',
        accent: const Color(0xFF5E8E4A),
        caption: preferredProviderName == null
            ? 'Stage 1'
            : 'Stage 1 - direct request',
      ),
      WaitingStageItem(
        title: fallbackCount == 0
            ? 'No marketplace option yet'
            : '$fallbackCount marketplace option(s) ready',
        body: fallbackCount == 0
            ? marketplaceStandbyDescription(matchingPolicy)
            : 'You can switch to another available partner below without restarting the booking.',
        accent: const Color(0xFFB9852F),
        caption: fallbackCount == 0
            ? 'Stage 2 - standby'
            : 'Stage 2 - alternatives ready',
      ),
      WaitingStageItem(
        title: status == 'MATCHED' ? 'Confirmed' : 'Auto-close timer',
        body: status == 'MATCHED'
            ? 'The partner is confirmed. Chat is ready while service start is coordinated.'
            : 'This request closes automatically at ${formatExpiry(expiresAt)} if no partner is selected.',
        accent: const Color(0xFF2563EB),
        caption: status == 'MATCHED'
            ? 'Stage 3 - locked in'
            : 'Stage 3 - timeout protection',
      ),
    ];

    return Column(
      children: [
        for (var index = 0; index < stageItems.length; index++) ...[
          stageItems[index],
          if (index != stageItems.length - 1) const SizedBox(height: 10),
        ],
      ],
    );
  }
}

class WaitingStageItem extends StatelessWidget {
  const WaitingStageItem({
    super.key,
    required this.title,
    required this.body,
    required this.accent,
    required this.caption,
  });

  final String title;
  final String body;
  final Color accent;
  final String caption;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: accent.withValues(alpha: 0.18)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 12,
            height: 12,
            margin: const EdgeInsets.only(top: 4),
            decoration: BoxDecoration(
              color: accent,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  caption,
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: accent,
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const SizedBox(height: 4),
                Text(
                  title,
                  style: Theme.of(context)
                      .textTheme
                      .titleMedium
                      ?.copyWith(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 4),
                Text(
                  body,
                  style: Theme.of(context)
                      .textTheme
                      .bodyMedium
                      ?.copyWith(color: Colors.black54),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class WaitingInfoBanner extends StatelessWidget {
  const WaitingInfoBanner({
    super.key,
    required this.title,
    required this.body,
  });

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFF3F7EC),
        border: Border.all(color: const Color(0xFFD2E1C5)),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style: Theme.of(context)
                  .textTheme
                  .titleMedium
                  ?.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          Text(body, style: Theme.of(context).textTheme.bodyMedium),
        ],
      ),
    );
  }
}
