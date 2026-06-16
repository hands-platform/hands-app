import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/providers.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../data/repositories/customer_discovery_repository_impl.dart';
import '../../domain/repositories/customer_discovery_repository.dart';

final customerDiscoveryRepositoryProvider =
    Provider<CustomerDiscoveryRepository>((ref) {
  return CustomerDiscoveryRepositoryImpl(
    ref.read(apiClientProvider),
    ref.read(appSessionReporterProvider),
  );
});
