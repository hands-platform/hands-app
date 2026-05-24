import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/providers.dart';
import '../../data/repositories/provider_onboarding_repository_impl.dart';
import '../../domain/repositories/provider_onboarding_repository.dart';

final providerOnboardingRepositoryProvider =
    Provider<ProviderOnboardingRepository>((ref) {
  return ProviderOnboardingRepositoryImpl(api: ref.read(apiClientProvider));
});
