import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../../../core/providers.dart';
import '../../../map/presentation/providers/map_providers.dart';
import '../../data/datasources/provider_device_identity_datasource.dart';
import '../../data/repositories/provider_profile_repository_impl.dart';
import '../../domain/repositories/provider_profile_repository.dart';

final providerDeviceIdentityDataSourceProvider =
    Provider<ProviderDeviceIdentityDataSource>((ref) {
  return const ProviderDeviceIdentityDataSource(
    storage: FlutterSecureStorage(),
  );
});

final providerProfileRepositoryProvider =
    Provider<ProviderProfileRepository>((ref) {
  return ProviderProfileRepositoryImpl(
    api: ref.read(apiClientProvider),
    socket: ref.read(realtimeSocketProvider),
    locationDataSource: ref.read(providerDeviceLocationDataSourceProvider),
    deviceIdentityDataSource:
        ref.read(providerDeviceIdentityDataSourceProvider),
  );
});
