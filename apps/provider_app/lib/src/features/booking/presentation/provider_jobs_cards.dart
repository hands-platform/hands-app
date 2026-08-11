import 'package:flutter/material.dart';

import '../../../core/provider_value_helpers.dart';
import 'provider_booking_service_helpers.dart';
import 'provider_jobs_helpers.dart';
import 'provider_request_common_widgets.dart';

class PartnerJobsSummary extends StatelessWidget {
  const PartnerJobsSummary({
    super.key,
    required this.active,
    required this.completed,
    required this.closed,
  });

  final int active;
  final int completed;
  final int closed;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: [
        SizedBox(
          width: 150,
          child: RequestSummaryCard(
            label: 'Đang hoạt động',
            value: '$active công việc',
            tone: const Color(0xFFEAF2FF),
          ),
        ),
        SizedBox(
          width: 150,
          child: RequestSummaryCard(
            label: 'Đã hoàn tất',
            value: '$completed bản ghi',
            tone: const Color(0xFFEAF5E3),
          ),
        ),
        SizedBox(
          width: 150,
          child: RequestSummaryCard(
            label: 'Đã đóng',
            value: '$closed bản ghi',
            tone: const Color(0xFFF8ECD4),
          ),
        ),
      ],
    );
  }
}

class PartnerJobsCard extends StatelessWidget {
  const PartnerJobsCard({
    super.key,
    required this.booking,
    this.actionBusy = false,
    this.onOpenChat,
    this.onCompleteService,
  });

  final Map<String, dynamic> booking;
  final bool actionBusy;
  final VoidCallback? onOpenChat;
  final VoidCallback? onCompleteService;

  @override
  Widget build(BuildContext context) {
    final service = providerBookingService(booking);
    final address = asMap(booking['address']);
    final addressSnapshot = asMap(booking['addressSnapshot']);
    final snapshotAddress = asMap(addressSnapshot?['address']);
    final payment = asMap(booking['payment']);
    final selectedProvider = asMap(booking['selectedProvider']);
    final customer = asMap(booking['customer']);
    final isAssigned = selectedProvider != null;
    final amount = payment?['amount'] ?? service?['basePrice'];
    final serviceAddress = addressSnapshot?['addressText']?.toString() ??
        snapshotAddress?['line1']?.toString() ??
        snapshotAddress?['addressPreview']?.toString() ??
        address?['line1']?.toString() ??
        address?['addressPreview']?.toString() ??
        'Chưa có khu vực của khách hàng';

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const CircleAvatar(child: Icon(Icons.event_available_outlined)),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    providerServiceOptionLabel(service),
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
                ProviderRequestTag(
                  label: providerBookingStatusLabel(booking['status']),
                  highlighted: isAssigned,
                ),
              ],
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                ProviderRequestTag(
                  label:
                      'Mở lúc ${formatRequestOpenedMoment(providerBookingRequestOpenedAt(booking))}',
                ),
                ProviderRequestTag(
                    label: providerServiceDurationLabel(service)),
                ProviderRequestTag(label: '${formatCurrency(amount)} VND'),
                ProviderRequestTag(
                  label: providerPaymentStatusLabel(payment?['status']),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(serviceAddress),
            if (customer != null) ...[
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  ProviderRequestTag(
                    label: customer['fullName']?.toString().trim().isNotEmpty ==
                            true
                        ? customer['fullName'].toString()
                        : 'Chưa có tên khách hàng',
                  ),
                  if (customer['phone']?.toString().trim().isNotEmpty == true)
                    ProviderRequestTag(label: customer['phone'].toString()),
                  ProviderRequestTag(
                    label:
                        'Giới tính: ${customer['gender'] ?? 'Chưa cung cấp'}',
                  ),
                  ProviderRequestTag(
                    label:
                        'Quốc tịch: ${customer['nationality'] ?? 'Chưa cung cấp'}',
                  ),
                ],
              ),
            ],
            const SizedBox(height: 6),
            Text(
              partnerJobNextAction(booking),
              style: Theme.of(context)
                  .textTheme
                  .bodyMedium
                  ?.copyWith(color: Colors.black54),
            ),
            if (onOpenChat != null || onCompleteService != null) ...[
              const SizedBox(height: 14),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  if (onOpenChat != null)
                    OutlinedButton.icon(
                      onPressed: actionBusy ? null : onOpenChat,
                      icon: const Icon(Icons.chat_bubble_outline),
                      label: const Text('Mở trò chuyện'),
                    ),
                  if (onCompleteService != null)
                    FilledButton.icon(
                      onPressed: actionBusy ? null : onCompleteService,
                      icon: const Icon(Icons.check_circle_outline),
                      label: const Text('Hoàn tất dịch vụ'),
                    ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
