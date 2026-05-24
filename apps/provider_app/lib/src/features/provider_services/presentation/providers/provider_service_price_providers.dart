import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/providers.dart';
import '../../data/repositories/provider_service_price_repository_impl.dart';
import '../../domain/repositories/provider_service_price_repository.dart';

final providerServicePriceRepositoryProvider =
    Provider<ProviderServicePriceRepository>((ref) {
  return ProviderServicePriceRepositoryImpl(ref.read(apiClientProvider));
});
