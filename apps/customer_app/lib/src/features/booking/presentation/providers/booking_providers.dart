import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/providers.dart';
import '../../data/repositories/customer_booking_repository_impl.dart';
import '../../domain/repositories/customer_booking_repository.dart';

final customerBookingRepositoryProvider =
    Provider<CustomerBookingRepository>((ref) {
  return CustomerBookingRepositoryImpl(
    ref.read(apiClientProvider),
    ref.read(realtimeSocketProvider),
  );
});

final customerPaymentActionRepositoryProvider =
    Provider<CustomerPaymentActionRepository>((ref) {
  return CustomerPaymentActionRepositoryImpl(ref.read(apiClientProvider));
});
