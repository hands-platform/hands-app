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
            label: 'Active',
            value: '$active live',
            tone: const Color(0xFFEAF2FF),
          ),
        ),
        SizedBox(
          width: 150,
          child: RequestSummaryCard(
            label: 'Done',
            value: '$completed complete',
            tone: const Color(0xFFEAF5E3),
          ),
        ),
        SizedBox(
          width: 150,
          child: RequestSummaryCard(
            label: 'Closed',
            value: '$closed closed',
            tone: const Color(0xFFF8ECD4),
          ),
        ),
      ],
    );
  }
}

class PartnerJobsCard extends StatelessWidget {
  const PartnerJobsCard({super.key, required this.booking});

  final Map<String, dynamic> booking;

  @override
  Widget build(BuildContext context) {
    final service = providerBookingService(booking);
    final address = asMap(booking['address']);
    final payment = asMap(booking['payment']);
    final selectedProvider = asMap(booking['selectedProvider']);
    final isAssigned = selectedProvider != null;
    final amount = payment?['amount'] ?? service?['basePrice'];

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
                  label: booking['status']?.toString() ?? 'UNKNOWN',
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
                      'Opened ${formatRequestOpenedMoment(booking['createdAt'] ?? booking['scheduledStartAt'])}',
                ),
                ProviderRequestTag(
                    label: providerServiceDurationLabel(service)),
                ProviderRequestTag(label: '${formatCurrency(amount)} VND'),
                ProviderRequestTag(
                  label: payment?['status']?.toString() ?? 'NO_PAYMENT',
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(address?['line1']?.toString() ?? 'Guest address pending'),
            const SizedBox(height: 6),
            Text(
              partnerJobNextAction(booking),
              style: Theme.of(context)
                  .textTheme
                  .bodyMedium
                  ?.copyWith(color: Colors.black54),
            ),
          ],
        ),
      ),
    );
  }
}
