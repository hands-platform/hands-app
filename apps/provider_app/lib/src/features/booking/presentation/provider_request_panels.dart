import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/local_demo_access.dart';
import '../../map/domain/services/provider_location_heartbeat.dart';
import 'provider_jobs_helpers.dart';

class ProviderOtpLoginPanel extends StatelessWidget {
  const ProviderOtpLoginPanel({
    super.key,
    required this.phoneController,
    required this.otpController,
    required this.otpRequested,
    required this.otpCooldownSeconds,
    required this.loading,
    required this.onRequestOtp,
    required this.onVerifyOtp,
    required this.onDemoLogin,
  });

  final TextEditingController phoneController;
  final TextEditingController otpController;
  final bool otpRequested;
  final int otpCooldownSeconds;
  final bool loading;
  final VoidCallback onRequestOtp;
  final VoidCallback onVerifyOtp;
  final VoidCallback onDemoLogin;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Đăng nhập đối tác',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            Text(
              localDemoAccessEnabled
                  ? 'Dùng OTP qua điện thoại hoặc tài khoản thử nghiệm cục bộ khi kiểm tra yêu cầu đặt lịch.'
                  : 'Dùng OTP qua điện thoại để đăng nhập tài khoản đối tác HANDS.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 16),
            TextField(
              controller: phoneController,
              keyboardType: TextInputType.phone,
              textInputAction: TextInputAction.next,
              decoration: const InputDecoration(
                border: OutlineInputBorder(),
                labelText: 'Số điện thoại',
                hintText: '+84900000002',
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: otpController,
              keyboardType: TextInputType.number,
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                LengthLimitingTextInputFormatter(6),
              ],
              decoration: const InputDecoration(
                border: OutlineInputBorder(),
                labelText: 'Mã OTP',
                hintText: '123456',
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: FilledButton.tonalIcon(
                    onPressed:
                        loading || otpCooldownSeconds > 0 ? null : onRequestOtp,
                    icon: const Icon(Icons.sms_outlined),
                    label: Text(
                      otpCooldownSeconds > 0
                          ? 'Gửi lại sau $otpCooldownSeconds giây'
                          : otpRequested
                              ? 'Gửi lại OTP'
                              : 'Nhận mã OTP',
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: FilledButton.icon(
                    onPressed: loading || !otpRequested ? null : onVerifyOtp,
                    icon: const Icon(Icons.login),
                    label: const Text('Xác minh'),
                  ),
                ),
              ],
            ),
            if (localDemoAccessEnabled) ...[
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: TextButton.icon(
                  onPressed: loading ? null : onDemoLogin,
                  icon: const Icon(Icons.play_circle_outline),
                  label: const Text('Dùng tài khoản thử nghiệm cục bộ'),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

bool isValidProviderPhone(String value) {
  return RegExp(r'^\+[1-9]\d{7,14}$').hasMatch(value.trim());
}

bool isValidProviderOtp(String value) {
  return RegExp(r'^\d{6}$').hasMatch(value.trim());
}

class ProviderStatusPanel extends StatelessWidget {
  const ProviderStatusPanel({
    super.key,
    required this.isSignedIn,
    required this.isOnline,
    required this.isAvailabilityEnabled,
    required this.heartbeatSnapshot,
    required this.loading,
    required this.onGoOnline,
    required this.onGoOffline,
  });

  final bool isSignedIn;
  final bool isOnline;
  final bool isAvailabilityEnabled;
  final ProviderLocationHeartbeatSnapshot heartbeatSnapshot;
  final bool loading;
  final VoidCallback? onGoOnline;
  final VoidCallback? onGoOffline;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            CircleAvatar(
              backgroundColor: isOnline
                  ? Theme.of(context).colorScheme.primaryContainer
                  : Theme.of(context).colorScheme.surfaceContainerHighest,
              child: Icon(
                isOnline ? Icons.radar_outlined : Icons.power_settings_new,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    isOnline
                        ? 'Đang trực tuyến'
                        : isAvailabilityEnabled
                            ? 'Đã bật theo lịch làm việc'
                            : 'Đang ngoại tuyến',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  Text(
                    isOnline
                        ? providerLocationHeartbeatLabel(heartbeatSnapshot)
                        : isAvailabilityEnabled
                            ? 'Vị trí được cập nhật. Yêu cầu sẽ tự mở trong giờ làm việc.'
                            : 'Bật trực tuyến để nhận yêu cầu trực tiếp và yêu cầu công khai.',
                  ),
                  if (isOnline && heartbeatSnapshot.lastError != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      'Vị trí đã lưu gần nhất vẫn hiển thị cho khách hàng.',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: Theme.of(context).colorScheme.error,
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                  ],
                ],
              ),
            ),
            FilledButton.tonal(
              onPressed: !isSignedIn || loading
                  ? null
                  : isAvailabilityEnabled
                      ? onGoOffline
                      : onGoOnline,
              child: Text(
                isAvailabilityEnabled ? 'Tắt trực tuyến' : 'Bật trực tuyến',
              ),
            ),
          ],
        ),
      ),
    );
  }
}
