import 'package:flutter/material.dart';

import '../../../core/provider_value_helpers.dart';
import '../../earnings/presentation/provider_wallet_gate_helpers.dart';
import '../../provider_profile/presentation/provider_feedback_cards.dart';
import 'provider_booking_service_helpers.dart';
import 'provider_jobs_helpers.dart';
import 'provider_request_cards.dart';
import 'provider_request_filter_helpers.dart';
import 'provider_request_guidance_helpers.dart';

class ProviderRequestsListSection extends StatelessWidget {
  const ProviderRequestsListSection({
    super.key,
    required this.isOnline,
    required this.authUserId,
    required this.bookingItems,
    required this.visibleBookings,
    required this.requestView,
    required this.joinedBookingIds,
    required this.loading,
    required this.walletBlocked,
    required this.filters,
    required this.savingAlertPreferences,
    required this.onRequestViewChanged,
    required this.onJoin,
    required this.onAccept,
    required this.onReject,
    required this.onFiltersChanged,
    required this.onSaveAlertPreferences,
  });

  final bool isOnline;
  final String authUserId;
  final List<Map<String, dynamic>> bookingItems;
  final List<Map<String, dynamic>> visibleBookings;
  final String requestView;
  final Set<String> joinedBookingIds;
  final bool loading;
  final bool walletBlocked;
  final ProviderRequestFilters filters;
  final bool savingAlertPreferences;
  final ValueChanged<String> onRequestViewChanged;
  final ValueChanged<Map<String, dynamic>> onJoin;
  final ValueChanged<Map<String, dynamic>> onAccept;
  final ValueChanged<Map<String, dynamic>> onReject;
  final ValueChanged<ProviderRequestFilters> onFiltersChanged;
  final VoidCallback onSaveAlertPreferences;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        RequestFlowBar(
          activeStep: !isOnline
              ? 0
              : (bookingItems.any(isProviderAppChatVisible)
                  ? 3
                  : (bookingItems.any((item) => item['status'] == 'MATCHED')
                      ? 2
                      : 1)),
        ),
        const SizedBox(height: 16),
        RequestQueueSummary(
          totalRequests: bookingItems.length,
          preferredRequests: bookingItems
              .where(
                  (booking) => providerIsPreferredRequest(booking, authUserId))
              .length,
          marketplaceRequests: bookingItems
              .where(
                  (booking) => !providerIsPreferredRequest(booking, authUserId))
              .length,
          chatReady: bookingItems.where(isProviderAppChatVisible).length,
        ),
        const SizedBox(height: 16),
        if (walletBlocked) ...[
          const InfoCard(
            text:
                '$providerMarketplaceJoinBlockReasonClean Yêu cầu trực tiếp vẫn được xử lý riêng.',
          ),
          const SizedBox(height: 16),
        ],
        _RequestViewFilter(
          requestView: requestView,
          onChanged: onRequestViewChanged,
        ),
        const SizedBox(height: 12),
        _MarketplaceRequestFilters(
          bookingItems: bookingItems,
          filters: filters,
          saving: savingAlertPreferences,
          onChanged: onFiltersChanged,
          onSave: onSaveAlertPreferences,
        ),
        const SizedBox(height: 12),
        InfoCard(text: providerRequestViewSummaryCopy(requestView)),
        const SizedBox(height: 16),
        if (bookingItems.isEmpty)
          const InfoCard(
            text:
                'Chưa có yêu cầu đặt lịch. Yêu cầu trực tiếp và công khai sẽ xuất hiện tại đây.',
          )
        else if (visibleBookings.isEmpty)
          const InfoCard(
            text:
                'Hiện không có yêu cầu phù hợp với bộ lọc. Hãy đổi bộ lọc để xem các mục khác.',
          )
        else
          for (final booking in visibleBookings)
            _ProviderRequestCardRow(
              booking: booking,
              authUserId: authUserId,
              joined: joinedBookingIds.contains(booking['id']),
              loading: loading,
              walletBlocked: walletBlocked,
              onJoin: onJoin,
              onAccept: onAccept,
              onReject: onReject,
            ),
      ],
    );
  }

  String providerRequestViewSummaryCopy(String requestView) {
    final filterCopy = requestView == 'action'
        ? 'Yêu cầu vẫn cần xử lý'
        : requestView == 'chat'
            ? 'Yêu cầu đã ghép đôi và sẵn sàng trò chuyện'
            : 'Tất cả yêu cầu đã tải';
    return 'Hiển thị ${visibleBookings.length}/${bookingItems.length} yêu cầu - $filterCopy';
  }
}

class _MarketplaceRequestFilters extends StatelessWidget {
  const _MarketplaceRequestFilters({
    required this.bookingItems,
    required this.filters,
    required this.saving,
    required this.onChanged,
    required this.onSave,
  });

  final List<Map<String, dynamic>> bookingItems;
  final ProviderRequestFilters filters;
  final bool saving;
  final ValueChanged<ProviderRequestFilters> onChanged;
  final VoidCallback onSave;

  @override
  Widget build(BuildContext context) {
    final genders = _customerValues('gender');
    final nationalities = _customerValues('nationality');
    final services = <String, String>{};
    for (final booking in bookingItems) {
      for (final item in asList(booking['services'])) {
        final service = asMap(asMap(item)?['service']);
        final id = service?['id']?.toString();
        if (id != null && id.isNotEmpty) {
          services[id] = providerServiceOptionLabel(service);
        }
      }
    }
    if (filters.serviceId != null) {
      services.putIfAbsent(filters.serviceId!, () => filters.serviceId!);
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Bộ lọc yêu cầu công khai',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 4),
            const Text(
              'Yêu cầu trực tiếp luôn hiển thị. Lưu các điều kiện này để nhận thông báo yêu cầu công khai phù hợp.',
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final distance in const <double?>[null, 3, 5, 10, 20])
                  ChoiceChip(
                    label: Text(distance == null
                        ? 'Mọi khoảng cách'
                        : 'Trong vòng ${distance.toInt()} km'),
                    selected: filters.maxDistanceKm == distance,
                    onSelected: (_) => onChanged(
                      ProviderRequestFilters(
                        alertsEnabled: filters.alertsEnabled,
                        maxDistanceKm: distance,
                        customerGender: filters.customerGender,
                        customerNationality: filters.customerNationality,
                        serviceId: filters.serviceId,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: filters.customerGender ?? '',
              decoration:
                  const InputDecoration(labelText: 'Giới tính khách hàng'),
              items: [
                const DropdownMenuItem(value: '', child: Text('Mọi giới tính')),
                for (final value in genders)
                  DropdownMenuItem(value: value, child: Text(value)),
              ],
              onChanged: (value) => onChanged(
                ProviderRequestFilters(
                  alertsEnabled: filters.alertsEnabled,
                  maxDistanceKm: filters.maxDistanceKm,
                  customerGender: value == null || value.isEmpty ? null : value,
                  customerNationality: filters.customerNationality,
                  serviceId: filters.serviceId,
                ),
              ),
            ),
            const SizedBox(height: 10),
            DropdownButtonFormField<String>(
              initialValue: filters.customerNationality ?? '',
              decoration:
                  const InputDecoration(labelText: 'Quốc tịch khách hàng'),
              items: [
                const DropdownMenuItem(value: '', child: Text('Mọi quốc tịch')),
                for (final value in nationalities)
                  DropdownMenuItem(value: value, child: Text(value)),
              ],
              onChanged: (value) => onChanged(
                ProviderRequestFilters(
                  alertsEnabled: filters.alertsEnabled,
                  maxDistanceKm: filters.maxDistanceKm,
                  customerGender: filters.customerGender,
                  customerNationality:
                      value == null || value.isEmpty ? null : value,
                  serviceId: filters.serviceId,
                ),
              ),
            ),
            const SizedBox(height: 10),
            DropdownButtonFormField<String>(
              initialValue: filters.serviceId ?? '',
              decoration: const InputDecoration(labelText: 'Dịch vụ'),
              items: [
                const DropdownMenuItem(value: '', child: Text('Mọi dịch vụ')),
                for (final entry in services.entries)
                  DropdownMenuItem(value: entry.key, child: Text(entry.value)),
              ],
              onChanged: (value) => onChanged(
                ProviderRequestFilters(
                  alertsEnabled: filters.alertsEnabled,
                  maxDistanceKm: filters.maxDistanceKm,
                  customerGender: filters.customerGender,
                  customerNationality: filters.customerNationality,
                  serviceId: value == null || value.isEmpty ? null : value,
                ),
              ),
            ),
            const SizedBox(height: 8),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Thông báo yêu cầu công khai tùy chỉnh'),
              subtitle: const Text(
                  'Không thể tắt thông báo yêu cầu trực tiếp tại đây.'),
              value: filters.alertsEnabled,
              onChanged: (value) => onChanged(
                ProviderRequestFilters(
                  alertsEnabled: value,
                  maxDistanceKm: filters.maxDistanceKm,
                  customerGender: filters.customerGender,
                  customerNationality: filters.customerNationality,
                  serviceId: filters.serviceId,
                ),
              ),
            ),
            FilledButton.icon(
              onPressed: saving ? null : onSave,
              icon: saving
                  ? const SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.notifications_active_outlined),
              label: const Text('Lưu điều kiện thông báo'),
            ),
          ],
        ),
      ),
    );
  }

  List<String> _customerValues(String key) {
    final values = bookingItems
        .map((booking) => asMap(booking['customer'])?[key]?.toString().trim())
        .whereType<String>()
        .where((value) => value.isNotEmpty)
        .toSet()
        .toList();
    final selected =
        key == 'gender' ? filters.customerGender : filters.customerNationality;
    if (selected != null && !values.contains(selected)) values.add(selected);
    values.sort();
    return values;
  }
}

class _RequestViewFilter extends StatelessWidget {
  const _RequestViewFilter({
    required this.requestView,
    required this.onChanged,
  });

  final String requestView;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        ChoiceChip(
          label: const Text('Cần xử lý'),
          selected: requestView == 'action',
          onSelected: (_) => onChanged('action'),
        ),
        ChoiceChip(
          label: const Text('Sẵn sàng trò chuyện'),
          selected: requestView == 'chat',
          onSelected: (_) => onChanged('chat'),
        ),
        ChoiceChip(
          label: const Text('Tất cả yêu cầu'),
          selected: requestView == 'all',
          onSelected: (_) => onChanged('all'),
        ),
      ],
    );
  }
}

class _ProviderRequestCardRow extends StatelessWidget {
  const _ProviderRequestCardRow({
    required this.booking,
    required this.authUserId,
    required this.joined,
    required this.loading,
    required this.walletBlocked,
    required this.onJoin,
    required this.onAccept,
    required this.onReject,
  });

  final Map<String, dynamic> booking;
  final String authUserId;
  final bool joined;
  final bool loading;
  final bool walletBlocked;
  final ValueChanged<Map<String, dynamic>> onJoin;
  final ValueChanged<Map<String, dynamic>> onAccept;
  final ValueChanged<Map<String, dynamic>> onReject;

  @override
  Widget build(BuildContext context) {
    final isPreferredRequest = providerIsPreferredRequest(booking, authUserId);

    return OpenBookingCard(
      booking: booking,
      isPreferredRequest: isPreferredRequest,
      joined: joined,
      loading: loading,
      walletBlocked: walletBlocked,
      onJoin: () => onJoin(booking),
      onAccept: () => onAccept(booking),
      onReject: () => onReject(booking),
    );
  }
}
