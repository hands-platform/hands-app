import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app_state.dart';
import '../../provider_profile/presentation/provider_error_helpers.dart';
import '../../provider_profile/presentation/provider_feedback_cards.dart';
import 'provider_jobs_helpers.dart';
import 'provider_request_cards.dart';
import 'provider_request_guidance_helpers.dart';

class PartnerJobsScreen extends ConsumerStatefulWidget {
  const PartnerJobsScreen({super.key});

  @override
  ConsumerState<PartnerJobsScreen> createState() => _PartnerJobsScreenState();
}

class _PartnerJobsScreenState extends ConsumerState<PartnerJobsScreen> {
  List<dynamic> bookings = [];
  bool loading = false;
  String? error;
  String? statusMessage;

  Future<void> signInAndLoad() async {
    setState(() {
      loading = true;
      error = null;
      statusMessage = null;
    });
    try {
      if (ref.read(authControllerProvider) == null) {
        await ref.read(authControllerProvider.notifier).signInDemoProvider();
      }
      await loadJobs(showLoading: false);
    } catch (exception) {
      setState(() => error = providerAppErrorMessage(exception));
    } finally {
      if (mounted) {
        setState(() => loading = false);
      }
    }
  }

  Future<void> loadJobs({bool showLoading = true}) async {
    if (showLoading) {
      setState(() {
        loading = true;
        error = null;
      });
    }
    try {
      final loaded = await ref.read(providerRepositoryProvider).listBookings();
      if (!mounted) {
        return;
      }
      setState(() {
        bookings = loaded;
        statusMessage = 'Jobs refreshed with ${loaded.length} booking(s).';
      });
    } catch (exception) {
      if (mounted) {
        setState(() => error = providerAppErrorMessage(exception));
      }
    } finally {
      if (mounted && showLoading) {
        setState(() => loading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    final items = bookings.whereType<Map<String, dynamic>>().toList()
      ..sort((left, right) =>
          bookingTimestamp(right).compareTo(bookingTimestamp(left)));
    final activeCount = items.where(isProviderActiveBooking).length;
    final completedCount =
        items.where((booking) => booking['status'] == 'COMPLETED').length;
    final closedCount = items.where(isProviderClosedBooking).length;

    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text('Jobs', style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 8),
          Text(
            'Today, active service states, and closed booking records.',
            style: Theme.of(context).textTheme.bodyLarge,
          ),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed:
                loading ? null : (auth == null ? signInAndLoad : loadJobs),
            icon: const Icon(Icons.work_history_outlined),
            label: Text(auth == null ? 'Demo partner login' : 'Refresh jobs'),
          ),
          if (loading) ...[
            const SizedBox(height: 12),
            const LinearProgressIndicator(),
          ],
          if (statusMessage != null) ...[
            const SizedBox(height: 12),
            InfoCard(text: statusMessage!),
          ],
          if (error != null) ...[
            const SizedBox(height: 12),
            ErrorCard(text: error!),
          ],
          const SizedBox(height: 16),
          PartnerJobsSummary(
            active: activeCount,
            completed: completedCount,
            closed: closedCount,
          ),
          const SizedBox(height: 16),
          if (auth == null)
            const InfoCard(text: 'Login first to load your partner job queue.')
          else if (items.isEmpty)
            const InfoCard(
              text: 'No assigned, participating, or completed bookings yet.',
            )
          else
            for (final booking in items) PartnerJobsCard(booking: booking),
        ],
      ),
    );
  }
}
