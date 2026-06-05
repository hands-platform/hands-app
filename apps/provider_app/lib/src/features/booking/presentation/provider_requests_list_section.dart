import 'package:flutter/material.dart';

import '../../provider_profile/presentation/provider_feedback_cards.dart';
import 'provider_request_cards.dart';
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
    required this.onRequestViewChanged,
    required this.onJoin,
    required this.onAccept,
    required this.onReject,
    required this.onStart,
  });

  final bool isOnline;
  final String authUserId;
  final List<Map<String, dynamic>> bookingItems;
  final List<Map<String, dynamic>> visibleBookings;
  final String requestView;
  final Set<String> joinedBookingIds;
  final bool loading;
  final bool walletBlocked;
  final ValueChanged<String> onRequestViewChanged;
  final ValueChanged<Map<String, dynamic>> onJoin;
  final ValueChanged<Map<String, dynamic>> onAccept;
  final ValueChanged<Map<String, dynamic>> onReject;
  final ValueChanged<Map<String, dynamic>> onStart;

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
          preferredRequests: bookingItems.where((booking) {
            final preferredProvider = booking['preferredProvider'];
            return preferredProvider is Map<String, dynamic> &&
                preferredProvider['userId'] == authUserId;
          }).length,
          marketplaceRequests: bookingItems.where((booking) {
            final preferredProvider = booking['preferredProvider'];
            return preferredProvider is Map<String, dynamic> &&
                preferredProvider['userId'] != authUserId;
          }).length,
          chatReady: bookingItems.where(isProviderAppChatVisible).length,
        ),
        const SizedBox(height: 16),
        _RequestViewFilter(
          requestView: requestView,
          onChanged: onRequestViewChanged,
        ),
        const SizedBox(height: 12),
        InfoCard(text: providerRequestViewSummaryCopy(requestView)),
        const SizedBox(height: 16),
        if (bookingItems.isEmpty)
          const InfoCard(
            text:
                'No booking requests yet. First-pick and marketplace requests will appear here.',
          )
        else if (visibleBookings.isEmpty)
          const InfoCard(
            text:
                'No requests match this filter right now. Switch filters to review older items.',
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
              onStart: onStart,
            ),
      ],
    );
  }

  String providerRequestViewSummaryCopy(String requestView) {
    final filterCopy = requestView == 'action'
        ? 'Requests that still need action'
        : requestView == 'chat'
            ? 'Requests with matched chat ready'
            : 'All loaded requests';
    return 'Showing ${visibleBookings.length} of ${bookingItems.length} request(s) - $filterCopy';
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
          label: const Text('Action needed'),
          selected: requestView == 'action',
          onSelected: (_) => onChanged('action'),
        ),
        ChoiceChip(
          label: const Text('Chat ready'),
          selected: requestView == 'chat',
          onSelected: (_) => onChanged('chat'),
        ),
        ChoiceChip(
          label: const Text('All requests'),
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
    required this.onStart,
  });

  final Map<String, dynamic> booking;
  final String authUserId;
  final bool joined;
  final bool loading;
  final bool walletBlocked;
  final ValueChanged<Map<String, dynamic>> onJoin;
  final ValueChanged<Map<String, dynamic>> onAccept;
  final ValueChanged<Map<String, dynamic>> onReject;
  final ValueChanged<Map<String, dynamic>> onStart;

  @override
  Widget build(BuildContext context) {
    final preferredProvider = booking['preferredProvider'];
    final isPreferredRequest = preferredProvider is Map<String, dynamic> &&
        preferredProvider['userId'] == authUserId;

    return OpenBookingCard(
      booking: booking,
      isPreferredRequest: isPreferredRequest,
      joined: joined,
      loading: loading,
      walletBlocked: walletBlocked,
      onJoin: () => onJoin(booking),
      onAccept: () => onAccept(booking),
      onReject: () => onReject(booking),
      onStart: () => onStart(booking),
    );
  }
}
