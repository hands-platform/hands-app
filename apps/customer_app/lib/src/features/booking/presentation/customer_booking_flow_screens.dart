import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:maplibre_gl/maplibre_gl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../app_state.dart';
import '../../../core/app_config.dart';
import '../../../core/customer_design_system.dart';
import '../../../core/customer_value_helpers.dart';
import '../../../core/local_demo_access.dart';
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
  final nameController = TextEditingController(
    text: localDemoAccessEnabled ? 'Demo Customer' : '',
  );
  final phoneController = TextEditingController(
    text: localDemoAccessEnabled ? '0865907184' : '',
  );
  final addressController = TextEditingController(
    text: localDemoAccessEnabled ? demoCustomerAddress : '',
  );
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
  bool loadingWalletBalance = true;
  int? walletBalance;
  String walletCurrency = 'VND';
  List<CustomerPaymentMethodOption> paymentMethods = const [
    CustomerPaymentMethodOption.cash,
  ];
  String selectedPaymentMethod = CustomerPaymentMethodOption.cash.method;
  String? error;

  @override
  void initState() {
    super.initState();
    final account = ref.read(authControllerProvider)?.user;
    final accountName =
        (account?['fullName'] ?? account?['displayName'])?.toString().trim();
    final accountPhone = account?['phone']?.toString().trim();
    if (accountName != null && accountName.isNotEmpty) {
      nameController.text = accountName;
    }
    if (accountPhone != null && accountPhone.isNotEmpty) {
      phoneController.text = accountPhone;
    }
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
    unawaited(loadWalletBalance());
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

  Future<void> loadWalletBalance() async {
    try {
      final wallet = await ref.read(customerRepositoryProvider).getWallet();
      if (!mounted) {
        return;
      }
      setState(() {
        walletBalance = asNum(wallet['balance'])?.toInt();
        walletCurrency = wallet['currency'] as String? ?? 'VND';
        loadingWalletBalance = false;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() {
        walletBalance = null;
        loadingWalletBalance = false;
      });
    }
  }

  int get totalAmount {
    final rawAmount =
        customerServicePrice(widget.selectedService) - couponDiscountAmount;
    return rawAmount < 0 ? 0 : rawAmount;
  }

  bool get selectedPaymentUsesWallet =>
      selectedPaymentMethod.contains('WALLET');

  bool get walletHasInsufficientBalance =>
      selectedPaymentUsesWallet &&
      walletBalance != null &&
      walletBalance! < totalAmount;

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
          initialLocationRequiresConfirmation: !locationConfirmed,
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
    if (walletHasInsufficientBalance) {
      setState(() {
        error =
            'Your HANDS Wallet balance is not enough for this booking. Choose another payment method or add funds.';
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
        couponMessage = customerBookingErrorMessage(exception);
      });
    } finally {
      if (mounted) {
        setState(() => applyingCoupon = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.handsColors;
    final service = widget.selectedService;
    final provider = widget.providerDetail;
    final distanceMeters = asDouble(provider['distanceMeters']);
    final servicePrice = customerServicePrice(service);
    final providerName = provider['displayName'] as String? ?? 'Partner';
    final serviceName = customerServiceName(
      service,
      requestedLocale: Localizations.localeOf(context).languageCode,
    );
    final durationLabel = customerServiceDurationLabel(service);
    final totalAmount = this.totalAmount;
    final couponApplied = appliedCouponCode != null && couponDiscountAmount > 0;
    final selectedMethod = paymentMethods.firstWhere(
      (method) => method.method == selectedPaymentMethod,
      orElse: () => CustomerPaymentMethodOption.cash,
    );
    final walletInsufficient = walletHasInsufficientBalance;
    final customerPoint = customerLat == null || customerLng == null
        ? null
        : LatLng(customerLat!, customerLng!);
    final providerPoint = deriveProviderLatLng(provider);
    return Scaffold(
      appBar: AppBar(title: const Text('Review booking')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            CustomerSpacing.page,
            CustomerSpacing.page,
            CustomerSpacing.page,
            28,
          ),
          children: [
            BookingSectionCard(
              title: 'Your service',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      ProviderThumbnail(
                        name: providerName,
                        size: 58,
                        imageUrl: providerProfileImageUrl(provider),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              providerName,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context)
                                  .textTheme
                                  .titleLarge
                                  ?.copyWith(fontWeight: FontWeight.w700),
                            ),
                            const SizedBox(height: 5),
                            Wrap(
                              spacing: 14,
                              runSpacing: 4,
                              children: [
                                _BookingInlineFact(
                                  icon: Icons.star_rounded,
                                  iconColor: colors.primary,
                                  label:
                                      '${providerAverageRating(provider).toStringAsFixed(1)} (${providerReviewCount(provider)})',
                                ),
                                _BookingInlineFact(
                                  icon: Icons.location_on_outlined,
                                  label: formatDistance(distanceMeters),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 16),
                    child: Divider(height: 1),
                  ),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const _BookingIconBadge(icon: Icons.spa_outlined),
                      const SizedBox(width: 12),
                      Expanded(
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
                                  ?.copyWith(color: colors.inkMuted),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      Text(
                        '${formatCurrency(servicePrice)} VND',
                        style:
                            Theme.of(context).textTheme.titleMedium?.copyWith(
                                  color: colors.primary,
                                  fontWeight: FontWeight.w800,
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
                    borderRadius: BorderRadius.circular(CustomerRadii.control),
                    child: SizedBox(
                      height: 142,
                      child: LocationMapSurface(
                        customerPoint: customerPoint,
                        providerPoint: providerPoint,
                        customerLabel: 'Service address',
                        providerLabel: 'Partner area',
                        fallbackShowProviderMarker: true,
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(
                        locationConfirmed
                            ? Icons.check_circle
                            : Icons.location_on_outlined,
                        color:
                            locationConfirmed ? colors.success : colors.primary,
                        size: 22,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              locationConfirmed
                                  ? 'Location confirmed'
                                  : 'Choose a service location',
                              style: Theme.of(context)
                                  .textTheme
                                  .titleMedium
                                  ?.copyWith(fontWeight: FontWeight.w700),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              addressController.text.trim().isEmpty
                                  ? 'No address selected'
                                  : addressController.text.trim(),
                              style: Theme.of(context)
                                  .textTheme
                                  .bodyMedium
                                  ?.copyWith(color: colors.inkMuted),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    onPressed: submitting ? null : openLocationSelector,
                    icon: const Icon(Icons.map_outlined),
                    label: Text(
                      locationConfirmed ? 'Change location' : 'Choose on map',
                    ),
                  ),
                  if (locationMessage != null) ...[
                    const SizedBox(height: 12),
                    InfoBanner(text: locationMessage!),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 14),
            BookingSectionCard(
              title: 'Contact details',
              child: Column(
                children: [
                  TextField(
                    controller: nameController,
                    readOnly: true,
                    textInputAction: TextInputAction.next,
                    decoration: const InputDecoration(
                      labelText: 'Name',
                      prefixIcon: Icon(Icons.person_outline),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: phoneController,
                    readOnly: true,
                    keyboardType: TextInputType.phone,
                    textInputAction: TextInputAction.next,
                    decoration: const InputDecoration(
                      labelText: 'Phone',
                      prefixIcon: Icon(Icons.phone_outlined),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: addressController,
                    decoration: const InputDecoration(
                      labelText: 'Service address details',
                      prefixIcon: Icon(Icons.home_outlined),
                    ),
                    maxLines: 2,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            BookingSectionCard(
              title: 'How you will pay',
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
                  : Column(
                      children: [
                        for (var index = 0;
                            index < paymentMethods.length;
                            index++) ...[
                          _PaymentMethodOptionTile(
                            method: paymentMethods[index],
                            selected: selectedPaymentMethod ==
                                paymentMethods[index].method,
                            walletBalance: walletBalance,
                            walletCurrency: walletCurrency,
                            walletLoading: loadingWalletBalance,
                            insufficientBalance: paymentMethods[index]
                                    .method
                                    .contains('WALLET') &&
                                walletBalance != null &&
                                walletBalance! < totalAmount,
                            onPressed: submitting ||
                                    (paymentMethods[index]
                                            .method
                                            .contains('WALLET') &&
                                        walletBalance != null &&
                                        walletBalance! < totalAmount)
                                ? null
                                : () => setState(
                                      () => selectedPaymentMethod =
                                          paymentMethods[index].method,
                                    ),
                          ),
                          if (index < paymentMethods.length - 1)
                            const SizedBox(height: 10),
                        ],
                      ],
                    ),
            ),
            const SizedBox(height: 14),
            BookingSectionCard(
              title: 'Coupon',
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
                      OutlinedButton(
                        onPressed: applyingCoupon ? null : applyCoupon,
                        child: Text(applyingCoupon ? 'Checking...' : 'Apply'),
                      ),
                    ],
                  ),
                  if (couponMessage != null) ...[
                    const SizedBox(height: 10),
                    Builder(
                      builder: (context) => Text(
                        couponMessage!,
                        style: TextStyle(
                          color: appliedCouponCode != null
                              ? context.handsColors.success
                              : context.handsColors.error,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                  if (couponApplied) ...[
                    const SizedBox(height: 14),
                    Builder(
                      builder: (context) {
                        final colors = context.handsColors;
                        return Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: colors.success.withValues(alpha: 0.10),
                            border: Border.all(
                              color: colors.success.withValues(alpha: 0.35),
                            ),
                            borderRadius:
                                BorderRadius.circular(HandsShapes.medium),
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
                                      color: colors.success,
                                      fontWeight: FontWeight.w800,
                                    ),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                '$appliedCouponCode saves ${formatCurrency(couponDiscountAmount)} VND. Final payment amount is ${formatCurrency(totalAmount)} VND.',
                                style: Theme.of(context)
                                    .textTheme
                                    .bodyMedium
                                    ?.copyWith(color: colors.success),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 14),
            BookingSectionCard(
              title: 'Total',
              child: Column(
                children: [
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
                  const SizedBox(height: 10),
                  BookingSummaryRow(
                    label: 'Payment method',
                    value: selectedMethod.label,
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
      bottomNavigationBar: _BookingConfirmationBar(
        amount: totalAmount,
        locationConfirmed: locationConfirmed,
        submitting: submitting,
        paymentMethod: selectedPaymentMethod,
        paymentBlocked: walletInsufficient,
        onPressed: submitting || walletInsufficient
            ? null
            : locationConfirmed
                ? confirmBooking
                : openLocationSelector,
      ),
    );
  }
}

class _BookingInlineFact extends StatelessWidget {
  const _BookingInlineFact({
    required this.icon,
    required this.label,
    this.iconColor,
  });

  final IconData icon;
  final String label;
  final Color? iconColor;

  @override
  Widget build(BuildContext context) {
    final colors = context.handsColors;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 17, color: iconColor ?? colors.inkMuted),
        const SizedBox(width: 4),
        Text(
          label,
          style: Theme.of(context)
              .textTheme
              .bodySmall
              ?.copyWith(color: colors.inkMuted),
        ),
      ],
    );
  }
}

class _BookingIconBadge extends StatelessWidget {
  const _BookingIconBadge({required this.icon});

  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final colors = context.handsColors;
    return Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(
        color: colors.primarySoft,
        borderRadius: BorderRadius.circular(HandsShapes.medium),
      ),
      child: Icon(icon, color: colors.primary, size: 22),
    );
  }
}

class _PaymentMethodOptionTile extends StatelessWidget {
  const _PaymentMethodOptionTile({
    required this.method,
    required this.selected,
    required this.onPressed,
    required this.walletBalance,
    required this.walletCurrency,
    required this.walletLoading,
    required this.insufficientBalance,
  });

  final CustomerPaymentMethodOption method;
  final bool selected;
  final VoidCallback? onPressed;
  final int? walletBalance;
  final String walletCurrency;
  final bool walletLoading;
  final bool insufficientBalance;

  IconData get icon {
    if (method.method == 'CASH') {
      return Icons.payments_outlined;
    }
    if (method.method.contains('WALLET')) {
      return Icons.account_balance_wallet_outlined;
    }
    return Icons.credit_card_outlined;
  }

  String get description {
    if (method.method == 'CASH') {
      return 'Pay the partner after the service. Nothing is charged now.';
    }
    if (method.method.contains('WALLET')) {
      return 'Reserved when you request the booking and restored if it is cancelled before service.';
    }
    if (method.requiresRedirect) {
      return 'Payment authorization is required before partner matching starts.';
    }
    return 'Pay securely with ${method.label}.';
  }

  String? get walletBalanceLabel {
    if (!method.method.contains('WALLET')) {
      return null;
    }
    if (walletLoading) {
      return 'Checking wallet balance...';
    }
    if (walletBalance == null) {
      return 'Wallet balance unavailable';
    }
    return 'Balance: ${formatCurrency(walletBalance)} $walletCurrency';
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.handsColors;
    return Semantics(
      button: true,
      selected: selected,
      label: '${method.label} payment method',
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(CustomerRadii.control),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: selected ? colors.primarySoft : colors.surface,
            borderRadius: BorderRadius.circular(CustomerRadii.control),
            border: Border.all(
              color: selected ? colors.primary : colors.outline,
              width: selected ? 1.5 : 1,
            ),
          ),
          child: Row(
            children: [
              _BookingIconBadge(icon: icon),
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
                    const SizedBox(height: 3),
                    Text(
                      description,
                      style: Theme.of(context)
                          .textTheme
                          .bodySmall
                          ?.copyWith(color: colors.inkMuted),
                    ),
                    if (walletBalanceLabel != null) ...[
                      const SizedBox(height: 6),
                      Text(
                        insufficientBalance
                            ? '${walletBalanceLabel!} · Insufficient'
                            : walletBalanceLabel!,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: insufficientBalance
                                  ? colors.error
                                  : colors.primary,
                              fontWeight: FontWeight.w700,
                            ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Icon(
                selected ? Icons.check_circle : Icons.radio_button_unchecked,
                color: selected ? colors.primary : colors.inkMuted,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _BookingConfirmationBar extends StatelessWidget {
  const _BookingConfirmationBar({
    required this.amount,
    required this.locationConfirmed,
    required this.submitting,
    required this.paymentMethod,
    required this.paymentBlocked,
    required this.onPressed,
  });

  final int amount;
  final bool locationConfirmed;
  final bool submitting;
  final String paymentMethod;
  final bool paymentBlocked;
  final VoidCallback? onPressed;

  String get buttonLabel {
    if (submitting) {
      return 'Booking...';
    }
    if (!locationConfirmed) {
      return 'Choose location';
    }
    if (paymentBlocked) {
      return 'Insufficient wallet';
    }
    if (paymentMethod == 'CASH') {
      return 'Request booking';
    }
    if (paymentMethod.contains('WALLET')) {
      return 'Pay with wallet';
    }
    return 'Confirm booking';
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.handsColors;
    return Material(
      color: colors.surface,
      child: SafeArea(
        minimum: const EdgeInsets.fromLTRB(
          CustomerSpacing.page,
          12,
          CustomerSpacing.page,
          14,
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Total',
                    style: Theme.of(context)
                        .textTheme
                        .bodySmall
                        ?.copyWith(color: colors.inkMuted),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${formatCurrency(amount)} VND',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          color: colors.primary,
                          fontWeight: FontWeight.w800,
                        ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 16),
            FilledButton(
              onPressed: onPressed,
              style: FilledButton.styleFrom(
                minimumSize: const Size(152, 54),
                padding: const EdgeInsets.symmetric(horizontal: 22),
              ),
              child: Text(
                buttonLabel,
              ),
            ),
          ],
        ),
      ),
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
    final colors = context.handsColors;
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
              color: highlighted ? colors.primary : null,
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

class _BookingWaitingPageState extends ConsumerState<BookingWaitingPage>
    with WidgetsBindingObserver {
  Timer? timer;
  Map<String, dynamic>? booking;
  late final RealtimeSocket _socket;
  Map<String, dynamic>? latestProviderLocation;
  String? statusMessage;
  String? error;
  bool loading = false;
  bool refreshInFlight = false;
  bool reviewSubmitting = false;
  bool candidateNoticeShown = false;
  int timerTicks = 0;
  final GlobalKey _candidateListKey = GlobalKey();
  final List<void Function()> _realtimeDisposers = [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _socket = ref.read(realtimeSocketProvider);
    booking = widget.initialBooking;
    latestProviderLocation = bookingLatestProviderLocation(booking);
    final bookingId = booking?['id'] as String?;
    if (bookingId != null) {
      ref.read(customerRepositoryProvider).joinBookingRoom(bookingId);
    }
    attachRealtimeListeners();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(_showCandidateNoticeIfNeeded(widget.initialBooking));
    });
    timer = Timer.periodic(const Duration(seconds: 1), (_) {
      final currentBooking = booking;
      if (!mounted ||
          currentBooking == null ||
          isCustomerClosedBooking(currentBooking)) {
        return;
      }
      setState(() {});
      timerTicks += 1;
      if (timerTicks % 5 == 0) {
        unawaited(refreshBooking(showLoading: false));
      }
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    timer?.cancel();
    final bookingId = booking?['id']?.toString();
    if (bookingId != null) {
      _socket.leaveBooking(bookingId);
    }
    detachRealtimeListeners();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      unawaited(refreshBooking(showLoading: false));
    }
  }

  void attachRealtimeListeners() {
    detachRealtimeListeners();
    _realtimeDisposers
        .add(_socket.onEvent('provider.location.updated', (payload) {
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
    }));

    final eventMessages = <String, String>{
      'provider.joined': 'Another partner is available for this request.',
      'provider.accepted':
          'A partner is available. Keep waiting or choose the available option.',
      'provider.rejected':
          'A partner declined. We will keep showing available options.',
      'provider.arrived': 'Your partner has arrived at the service address.',
      'booking.matched':
          'Your partner confirmed. Chat and service are now active.',
      'booking.opened': 'The request is still open for partner responses.',
      'booking.expired': 'This booking expired or was cancelled.',
      'service.started': 'Service started. Matched chat remains available.',
      'service.completed': 'Service completed. You can review the booking.',
    };

    for (final entry in eventMessages.entries) {
      _realtimeDisposers.add(_socket.onEvent(entry.key, (payload) {
        if (!mounted || !_eventBelongsToActiveBooking(payload)) {
          return;
        }
        setState(() => statusMessage = entry.value);
        unawaited(refreshBooking(showLoading: false));
      }));
    }
  }

  void detachRealtimeListeners() {
    for (final disposeListener in _realtimeDisposers) {
      disposeListener();
    }
    _realtimeDisposers.clear();
  }

  bool _eventBelongsToActiveBooking(dynamic payload) {
    if (payload is! Map) {
      return true;
    }
    final payloadBooking = asMap(payload['booking']);
    final payloadBookingId = payload['bookingId']?.toString() ??
        payload['id']?.toString() ??
        payloadBooking?['id']?.toString();
    final activeBookingId = booking?['id']?.toString();
    return payloadBookingId == null ||
        activeBookingId == null ||
        payloadBookingId == activeBookingId;
  }

  Future<void> refreshBooking({bool showLoading = true}) async {
    final bookingId = booking?['id'] as String?;
    if (bookingId == null || refreshInFlight) {
      return;
    }
    refreshInFlight = true;
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
      unawaited(_showCandidateNoticeIfNeeded(updated));
    } catch (exception) {
      if (mounted) {
        setState(() => error = customerBookingErrorMessage(exception));
      }
    } finally {
      refreshInFlight = false;
      if (mounted && showLoading) {
        setState(() => loading = false);
      }
    }
  }

  Future<void> openPaymentCheckout() async {
    final bookingId = booking?['id']?.toString();
    if (bookingId == null) {
      return;
    }
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final action = await ref
          .read(customerPaymentActionRepositoryProvider)
          .getForBooking(bookingId);
      final opened = await launchUrl(
        action.checkoutUri,
        mode: LaunchMode.externalApplication,
      );
      if (!opened) {
        throw StateError('Payment checkout could not be opened.');
      }
      if (mounted) {
        setState(() {
          statusMessage =
              'Complete the payment, then return to HANDS. This booking will refresh automatically.';
        });
      }
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

  Future<void> openBookingSupport() async {
    final bookingId = booking?['id']?.toString() ?? '';
    final opened = await launchUrl(
      Uri(
        scheme: 'mailto',
        path: AppConfig.supportEmail,
        queryParameters: {'subject': 'HANDS booking support: $bookingId'},
      ),
      mode: LaunchMode.externalApplication,
    );
    if (!opened && mounted) {
      setState(() => error = 'HANDS support could not be opened.');
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
      if (!_applyLatestBookingFromException(exception)) {
        setState(() => error = customerBookingErrorMessage(exception));
      }
    } finally {
      if (mounted) {
        setState(() => loading = false);
      }
    }
  }

  Future<void> confirmCancellation() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Cancel booking request?'),
        content: const Text(
          'This booking has not been matched yet. Cancelling ends every partner request for this booking.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Keep waiting'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Cancel request'),
          ),
        ],
      ),
    );
    if (confirmed == true && mounted) {
      await cancelBooking();
    }
  }

  Future<void> selectProvider(Map<String, dynamic> participant) async {
    final bookingId = booking?['id'] as String?;
    final providerId = customerParticipantPartnerId(participant);
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
      if (!_applyLatestBookingFromException(exception)) {
        setState(() => error = customerBookingErrorMessage(exception));
      }
    } finally {
      if (mounted) {
        setState(() => loading = false);
      }
    }
  }

  bool _applyLatestBookingFromException(Object exception) {
    final latest = customerLatestBookingFromError(exception);
    if (latest == null || !mounted) {
      return false;
    }
    setState(() {
      booking = latest;
      error = latest['status'] != 'CREATED' &&
              latest['status'] != 'OPEN_MATCHING' &&
              isCustomerActiveBooking(latest)
          ? 'This booking is already matched. Use chat or HANDS support if you need help.'
          : customerBookingErrorMessage(exception);
    });
    widget.onBookingUpdated(latest);
    return true;
  }

  Future<void> _showCandidateNoticeIfNeeded(
      Map<String, dynamic> updated) async {
    if (!mounted ||
        candidateNoticeShown ||
        updated['status'] != 'OPEN_MATCHING') {
      return;
    }
    final preferredProvider = asMap(updated['preferredProvider']);
    final candidates = customerSelectableMarketplaceParticipants(
      asList(updated['participants']),
      preferredProviderId: preferredProvider?['id']?.toString(),
    );
    if (candidates.isEmpty) {
      return;
    }
    candidateNoticeShown = true;
    final viewCandidates = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(
            '${candidates.length} more partner${candidates.length == 1 ? '' : 's'} available'),
        content: const Text(
          'You can keep waiting for your preferred partner or choose another available partner. The original matching time continues.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Keep waiting'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('View partners'),
          ),
        ],
      ),
    );
    if (viewCandidates == true && mounted) {
      final candidateContext = _candidateListKey.currentContext;
      if (candidateContext != null && candidateContext.mounted) {
        await Scrollable.ensureVisible(
          candidateContext,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
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
        setState(() => error = customerBookingErrorMessage(exception));
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
    final timeLeft = formatRemainingTime(expiresAt);
    final action = waitingCustomerAction(
      status: status,
      fallbackCount: fallbackCount,
      hasChatRoom: chatRoomId != null,
      cancellationReasonCode:
          asMap(currentBooking?['cancellation'])?['reasonCode']?.toString(),
    );
    final addressSnapshot = asMap(currentBooking?['addressSnapshot']);
    final addressText = addressSnapshot?['addressText']?.toString().trim();
    final payment = asMap(currentBooking?['payment']);
    final cancellation = asMap(currentBooking?['cancellation']);
    final paymentMethod = payment?['method']?.toString() ??
        currentBooking?['paymentMethod']?.toString();
    final canOpenPaymentCheckout = status == 'CREATED' &&
        const {'MOMO', 'VNPAY', 'CARD'}.contains(paymentMethod?.toUpperCase());
    final visibleProvider = finalizedProvider ?? preferredProvider;
    final providerLocationLabel = isClosed
        ? 'Service location'
        : latestProviderLocation == null
            ? 'Location will appear when shared'
            : 'Location updated ${formatLastLocation(latestProviderLocation?['recordedAt'])}';
    final partnerBadgeLabel = isMatching
        ? 'Requested'
        : isClosed
            ? 'Booking closed'
            : 'Confirmed';
    final partnerSubtitle = isMatching
        ? 'Waiting for this partner to confirm'
        : isClosed
            ? 'This booking is closed'
            : providerLocationLabel;
    final showLiveMap = const {
          'PROVIDER_ON_THE_WAY',
          'ARRIVED',
          'IN_SERVICE',
        }.contains(status) &&
        providerPoint != null;
    final bookingContent = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        BookingProgressStatusCard(
          status: status,
          title: action.title,
          body: action.body,
          timeLeft: isMatching && timeLeft != '--' ? timeLeft : null,
        ),
        if (loading) ...[
          const SizedBox(height: 12),
          const LinearProgressIndicator(),
        ],
        if (error != null) ...[
          const SizedBox(height: 12),
          ErrorPanel(text: error!),
        ],
        if (statusMessage != null) ...[
          const SizedBox(height: 12),
          InfoBanner(text: statusMessage!),
        ],
        if (canOpenPaymentCheckout) ...[
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: loading ? null : openPaymentCheckout,
              icon: const Icon(Icons.open_in_new_rounded),
              label: const Text('Continue to payment'),
            ),
          ),
        ],
        if (visibleProvider != null) ...[
          const SizedBox(height: 16),
          PartnerDisplayCard(
            provider: visibleProvider,
            badgeLabel: partnerBadgeLabel,
            subtitle: partnerSubtitle,
          ),
        ],
        const SizedBox(height: 16),
        BookingSectionCard(
          title: 'Your booking',
          child: Column(
            children: [
              BookingProgressDetailRow(
                icon: Icons.spa_outlined,
                label: 'Service',
                value: service == null
                    ? 'Service details unavailable'
                    : customerServiceOptionPriceLabel(service),
              ),
              const Divider(height: 25),
              BookingProgressDetailRow(
                icon: Icons.location_on_outlined,
                label: 'Service address',
                value: addressText == null || addressText.isEmpty
                    ? 'Address unavailable'
                    : addressText,
              ),
              const Divider(height: 25),
              BookingProgressDetailRow(
                icon: _bookingPaymentIcon(paymentMethod),
                label: 'Payment',
                value: _bookingPaymentLabel(paymentMethod),
              ),
              const Divider(height: 25),
              BookingProgressDetailRow(
                icon: Icons.receipt_long_outlined,
                label: 'Reference',
                value: '#${shortCode(currentBooking?['id'])}',
              ),
            ],
          ),
        ),
        if (isClosed && cancellation != null) ...[
          const SizedBox(height: 16),
          BookingSectionCard(
            title: 'Cancellation result',
            child: Column(
              children: [
                BookingProgressDetailRow(
                  icon: Icons.info_outline_rounded,
                  label: 'Reason',
                  value: cancellation['reason']?.toString().trim().isNotEmpty ==
                          true
                      ? cancellation['reason'].toString()
                      : 'This booking was cancelled.',
                ),
                const Divider(height: 25),
                BookingProgressDetailRow(
                  icon: Icons.payments_outlined,
                  label: 'Payment result',
                  value: _cancellationPaymentOutcomeLabel(
                    cancellation['paymentOutcome']?.toString(),
                  ),
                ),
              ],
            ),
          ),
        ],
        if (alternativeParticipants.isNotEmpty) ...[
          const SizedBox(height: 24),
          KeyedSubtree(
            key: _candidateListKey,
            child: Text(
              '$fallbackCount available partner${fallbackCount == 1 ? '' : 's'}',
              style: Theme.of(context)
                  .textTheme
                  .titleLarge
                  ?.copyWith(fontWeight: FontWeight.w700),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Keep waiting for your selected partner or choose one of these nearby partners.',
            style: Theme.of(context)
                .textTheme
                .bodyMedium
                ?.copyWith(color: context.handsColors.inkMuted),
          ),
          const SizedBox(height: 12),
          for (final item in alternativeParticipants)
            PartnerSelectionCard(
              participant: item,
              onSelect: () => selectProvider(item),
            ),
        ],
        if (chatRoomId != null && isCustomerAppChatVisible(currentBooking)) ...[
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: loading ? null : () => openChatRoom(chatRoomId),
              icon: const Icon(Icons.chat_bubble_outline_rounded),
              label: Text(chatActionLabel(status)),
            ),
          ),
        ] else if (needsOpsReview) ...[
          const SizedBox(height: 16),
          const InfoBanner(
            text:
                'This booking can no longer be cancelled in the app. Contact HANDS support if you need help.',
          ),
        ],
        if (isCompleted && currentBooking?['review'] == null) ...[
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: reviewSubmitting ? null : submitReview,
              icon: const Icon(Icons.star_outline_rounded),
              label: Text(
                  reviewSubmitting ? 'Submitting review...' : 'Leave a review'),
            ),
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
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: () =>
                  Navigator.of(context).popUntil((route) => route.isFirst),
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Book again'),
            ),
          ),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: openBookingSupport,
              icon: const Icon(Icons.support_agent_outlined),
              label: const Text('Contact HANDS support'),
            ),
          ),
        ],
        if (canDirectCancel) ...[
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: loading ? null : confirmCancellation,
              icon: const Icon(Icons.close_rounded),
              label: const Text('Cancel booking request'),
            ),
          ),
        ],
      ],
    );

    return Scaffold(
      appBar: AppBar(
        title: const Text('Booking'),
        actions: [
          IconButton(
            tooltip: 'Refresh booking',
            onPressed: loading ? null : () => refreshBooking(),
            icon: const Icon(Icons.refresh_rounded),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: SafeArea(
        child: showLiveMap
            ? Stack(
                children: [
                  LocationMapSurface(
                    customerPoint: customerPoint,
                    providerPoint: providerPoint,
                    customerLabel: 'You',
                    providerLabel: 'Partner',
                    fallbackShowProviderMarker: true,
                  ),
                  Positioned(
                    top: 18,
                    left: 18,
                    child: BookingMapStatusBadge(
                      label: providerLocationLabel,
                      active: true,
                    ),
                  ),
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: 0,
                    child: Container(
                      constraints: BoxConstraints(
                        maxHeight: MediaQuery.sizeOf(context).height * 0.67,
                      ),
                      decoration: const BoxDecoration(
                        color: Colors.white,
                        borderRadius:
                            BorderRadius.vertical(top: Radius.circular(24)),
                      ),
                      padding: const EdgeInsets.fromLTRB(20, 20, 20, 28),
                      child: SingleChildScrollView(child: bookingContent),
                    ),
                  ),
                ],
              )
            : ListView(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
                children: [bookingContent],
              ),
      ),
    );
  }
}

String _cancellationPaymentOutcomeLabel(String? outcome) => switch (outcome) {
      'NO_CHARGE' => 'No payment was charged.',
      'RELEASED' => 'The payment hold was released.',
      'REFUND_REQUESTED' => 'A full refund was requested.',
      'REFUNDED' => 'The full refund is complete.',
      'UNDER_REVIEW' => 'HANDS is reviewing the payment and refund.',
      _ => 'Payment cancellation is processing.',
    };

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
    final colors = context.handsColors;
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
                      color: colors.primary,
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
    final colors = context.handsColors;
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
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        PartnerRoleTag(
                          label: 'Available now',
                          backgroundColor:
                              colors.success.withValues(alpha: 0.12),
                          foregroundColor: colors.success,
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      distance,
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Choose this partner without starting a new booking.',
                      style: Theme.of(context)
                          .textTheme
                          .bodyMedium
                          ?.copyWith(color: colors.inkMuted),
                    ),
                  ],
                );

                if (compact) {
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      ProviderThumbnail(
                        name: providerName,
                        size: thumbnailSize,
                        imageUrl: providerProfileImageUrl(provider),
                      ),
                      const SizedBox(height: 10),
                      details,
                    ],
                  );
                }

                return Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    ProviderThumbnail(
                      name: providerName,
                      size: thumbnailSize,
                      imageUrl: providerProfileImageUrl(provider),
                    ),
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
                  backgroundColor: colors.primary,
                  foregroundColor: colors.onPrimary,
                ),
                child: const Text('Choose partner'),
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
    final colors = context.handsColors;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ProviderThumbnail(
              name: provider['displayName'] as String? ?? 'Partner',
              size: 72,
              imageUrl: providerProfileImageUrl(provider),
            ),
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
                          backgroundColor:
                              colors.success.withValues(alpha: 0.12),
                          foregroundColor: colors.success,
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
                          ?.copyWith(color: colors.inkMuted),
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

class BookingProgressStatusCard extends StatelessWidget {
  const BookingProgressStatusCard({
    super.key,
    required this.status,
    required this.title,
    required this.body,
    this.timeLeft,
  });

  final String status;
  final String title;
  final String body;
  final String? timeLeft;

  @override
  Widget build(BuildContext context) {
    final colors = context.handsColors;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: colors.surfaceMuted,
        borderRadius: BorderRadius.circular(HandsShapes.medium),
        border: Border.all(color: colors.outline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: colors.surface,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  _bookingStatusIcon(status),
                  color: colors.primary,
                  size: 22,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  waitingStepLabel(status),
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        color: colors.primary,
                      ),
                ),
              ),
              if (timeLeft != null)
                Text(
                  timeLeft!,
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        color: colors.primary,
                      ),
                ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            title,
            style: Theme.of(context)
                .textTheme
                .headlineSmall
                ?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 6),
          Text(body, style: Theme.of(context).textTheme.bodyLarge),
          if (!_bookingProgressIsClosed(status)) ...[
            const SizedBox(height: 16),
            LinearProgressIndicator(
              value: bookingProgress(status),
              minHeight: 6,
              borderRadius: BorderRadius.circular(999),
              backgroundColor: colors.surface,
            ),
          ],
        ],
      ),
    );
  }
}

class BookingMapStatusBadge extends StatelessWidget {
  const BookingMapStatusBadge({
    super.key,
    required this.label,
    required this.active,
  });

  final String label;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final colors = context.handsColors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(CustomerRadii.control),
        border: Border.all(color: colors.outline),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(
              color: active ? colors.success : colors.inkMuted,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 8),
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: colors.ink,
                  fontWeight: FontWeight.w600,
                ),
          ),
        ],
      ),
    );
  }
}

class BookingProgressDetailRow extends StatelessWidget {
  const BookingProgressDetailRow({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final colors = context.handsColors;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: colors.primarySoft,
            borderRadius: BorderRadius.circular(CustomerRadii.control),
          ),
          child: Icon(icon, size: 20, color: colors.primary),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 3),
              Text(
                value,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

bool _bookingProgressIsClosed(String status) {
  return const {
    'COMPLETED',
    'CANCELLED',
    'EXPIRED',
    'NO_SHOW',
  }.contains(status);
}

IconData _bookingStatusIcon(String status) {
  return switch (status) {
    'OPEN_MATCHING' => Icons.search_rounded,
    'MATCHED' => Icons.check_circle_outline_rounded,
    'PROVIDER_ON_THE_WAY' => Icons.directions_bike_outlined,
    'ARRIVED' => Icons.location_on_outlined,
    'IN_SERVICE' => Icons.spa_outlined,
    'COMPLETED' => Icons.verified_outlined,
    'CANCELLED' => Icons.cancel_outlined,
    'EXPIRED' => Icons.timer_off_outlined,
    _ => Icons.receipt_long_outlined,
  };
}

IconData _bookingPaymentIcon(String? method) {
  return switch (method?.toUpperCase()) {
    'CASH' => Icons.payments_outlined,
    'CUSTOMER_WALLET' => Icons.account_balance_wallet_outlined,
    'MOMO' || 'VNPAY' => Icons.phone_android_outlined,
    'CARD' => Icons.credit_card_outlined,
    _ => Icons.payment_outlined,
  };
}

String _bookingPaymentLabel(String? method) {
  return switch (method?.toUpperCase()) {
    'CASH' => 'Cash',
    'CUSTOMER_WALLET' => 'Wallet',
    'MOMO' => 'MoMo',
    'VNPAY' => 'VNPay',
    'CARD' => 'Card',
    null || '' => 'Payment method',
    final value => value.replaceAll('_', ' '),
  };
}
