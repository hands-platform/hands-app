import 'package:flutter/material.dart';

import '../../../core/provider_value_helpers.dart';
import '../../provider_onboarding/presentation/provider_onboarding_status.dart';
import 'provider_error_helpers.dart';
import 'provider_feedback_cards.dart';
import 'provider_public_media_review_helpers.dart';

class ProviderPublicMediaReviewCard extends StatelessWidget {
  const ProviderPublicMediaReviewCard({
    super.key,
    required this.profile,
    required this.error,
    required this.isLoading,
    required this.onRefresh,
  });

  final Map<String, dynamic> profile;
  final Object? error;
  final bool isLoading;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    final media = asList(profile['fileAssets'])
        .map(asMap)
        .whereType<Map<String, dynamic>>()
        .where(providerPublicMediaIsReviewable)
        .toList();
    final pendingCount = media
        .where(
          (item) => providerPublicMediaReviewStatus(item) == 'PENDING_REVIEW',
        )
        .length;
    final approvedCount = media
        .where((item) => providerPublicMediaReviewStatus(item) == 'APPROVED')
        .length;
    final rejectedCount = media
        .where((item) => providerPublicMediaReviewStatus(item) == 'REJECTED')
        .length;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                const Icon(Icons.collections_outlined),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Xét duyệt ảnh công khai',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
                if (isLoading)
                  const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            const Text(
              'Khách hàng chỉ thấy ảnh hồ sơ và ảnh công việc sau khi được HANDS duyệt.',
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _PublicMediaReviewChip(
                  label: 'Đang chờ',
                  value: pendingCount,
                  color: Colors.orange.shade700,
                ),
                _PublicMediaReviewChip(
                  label: 'Đã duyệt',
                  value: approvedCount,
                  color: Colors.green.shade700,
                ),
                _PublicMediaReviewChip(
                  label: 'Cần chỉnh sửa',
                  value: rejectedCount,
                  color: Colors.red.shade700,
                ),
              ],
            ),
            if (error != null) ...[
              const SizedBox(height: 12),
              Text(
                providerAppErrorMessage(
                  error,
                  fallback: 'Không thể tải trạng thái xét duyệt ảnh.',
                ),
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ],
            const SizedBox(height: 12),
            if (media.isEmpty)
              const InfoCard(
                text: 'Tải ảnh hồ sơ hoặc ảnh công việc để bắt đầu xét duyệt.',
              )
            else
              ...media.take(6).map((item) => _PublicMediaReviewRow(item: item)),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: onRefresh,
              icon: const Icon(Icons.refresh_outlined),
              label: const Text('Làm mới trạng thái ảnh'),
            ),
          ],
        ),
      ),
    );
  }
}

class _PublicMediaReviewChip extends StatelessWidget {
  const _PublicMediaReviewChip({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final int value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Chip(
      avatar: CircleAvatar(
        backgroundColor: color,
        child: Text(
          value.toString(),
          style: const TextStyle(color: Colors.white, fontSize: 12),
        ),
      ),
      label: Text(label),
    );
  }
}

class _PublicMediaReviewRow extends StatelessWidget {
  const _PublicMediaReviewRow({required this.item});

  final Map<String, dynamic> item;

  @override
  Widget build(BuildContext context) {
    final status = providerPublicMediaReviewStatus(item);
    final statusColor = providerPublicMediaReviewColor(status);
    final reason = reviewReason(item);
    final uploadedAt = item['uploadedAt']?.toString() ??
        item['createdAt']?.toString() ??
        'chưa có thời gian tải lên';

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        border: Border.all(color: Theme.of(context).dividerColor),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(providerPublicMediaReviewIcon(status), color: statusColor),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  providerPublicMediaPurposeLabel(item['purpose']?.toString()),
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 4),
                Text(
                  providerPublicMediaReviewLabel(status),
                  style: TextStyle(
                    color: statusColor,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (reason != null && reason.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text('Lý do: $reason'),
                ],
                const SizedBox(height: 4),
                Text(
                  uploadedAt,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
