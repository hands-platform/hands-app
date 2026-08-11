import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app_state.dart';
import '../../../core/local_demo_access.dart';
import '../../../core/provider_value_helpers.dart';
import '../../provider_profile/presentation/provider_error_helpers.dart';
import '../../provider_profile/presentation/provider_feedback_cards.dart';
import 'provider_jobs_helpers.dart';
import 'provider_request_cards.dart';
import 'provider_request_guidance_helpers.dart';

class PartnerJobsScreen extends ConsumerStatefulWidget {
  const PartnerJobsScreen({
    super.key,
    this.initialBookingId,
    this.onActiveJobCountChanged,
    this.onOpenChat,
  });

  final String? initialBookingId;
  final ValueChanged<int>? onActiveJobCountChanged;
  final void Function(String bookingId, String chatRoomId)? onOpenChat;

  @override
  ConsumerState<PartnerJobsScreen> createState() => _PartnerJobsScreenState();
}

class _PartnerJobsScreenState extends ConsumerState<PartnerJobsScreen> {
  static const _historyPageSize = 10;

  List<dynamic> activeBookings = [];
  List<dynamic> historyBookings = [];
  bool loading = false;
  bool loadingMoreHistory = false;
  bool hasMoreHistory = true;
  String? submittingBookingId;
  String? error;
  String? statusMessage;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && ref.read(authControllerProvider) != null) {
        unawaited(loadJobs(showLoading: false));
      }
    });
  }

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
      final repository = ref.read(providerRepositoryProvider);
      final results = await Future.wait([
        repository.listBookings(),
        repository.listBookings(
          scope: 'history',
          take: _historyPageSize,
        ),
      ]);
      final loaded = results[0];
      final loadedHistory = results[1];
      final loadedActive = loaded
          .whereType<Map<String, dynamic>>()
          .where(isProviderActiveBooking)
          .toList();
      if (!mounted) {
        return;
      }
      final targetBookingId = widget.initialBookingId;
      final targetIsActive = targetBookingId != null &&
          loadedActive.any(
            (booking) => booking['id']?.toString() == targetBookingId,
          );
      final targetIsInHistory = targetBookingId != null &&
          loadedHistory.whereType<Map<String, dynamic>>().any(
                (booking) => booking['id']?.toString() == targetBookingId,
              );
      setState(() {
        activeBookings = loadedActive;
        historyBookings = loadedHistory;
        hasMoreHistory = loadedHistory.length == _historyPageSize;
        statusMessage = targetIsInHistory
            ? 'Đặt lịch từ thông báo đã đóng. Bản ghi gần nhất được hiển thị đầu tiên bên dưới.'
            : targetBookingId != null && !targetIsActive
                ? 'Đặt lịch từ thông báo không còn hoạt động. Đang hiển thị công việc hiện tại và lịch sử gần đây.'
                : 'Đã tải ${loadedActive.length} công việc đang hoạt động và ${loadedHistory.length} bản ghi lịch sử.';
      });
      widget.onActiveJobCountChanged?.call(
        loadedActive.length,
      );
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

  Future<void> loadMoreHistory() async {
    if (loadingMoreHistory || !hasMoreHistory || historyBookings.isEmpty) {
      return;
    }
    final lastBooking = historyBookings.last;
    final cursor =
        lastBooking is Map<String, dynamic> ? lastBooking['id'] : null;
    if (cursor is! String || cursor.isEmpty) {
      setState(() => hasMoreHistory = false);
      return;
    }

    setState(() {
      loadingMoreHistory = true;
      error = null;
    });
    try {
      final loaded = await ref.read(providerRepositoryProvider).listBookings(
            scope: 'history',
            cursor: cursor,
            take: _historyPageSize,
          );
      if (!mounted) {
        return;
      }
      final merged = <String, dynamic>{
        for (final booking in historyBookings)
          if (booking is Map<String, dynamic> && booking['id'] is String)
            booking['id'] as String: booking,
        for (final booking in loaded)
          if (booking is Map<String, dynamic> && booking['id'] is String)
            booking['id'] as String: booking,
      };
      setState(() {
        historyBookings = merged.values.toList();
        hasMoreHistory = loaded.length == _historyPageSize;
        statusMessage = 'Đã tải ${historyBookings.length} bản ghi lịch sử.';
      });
    } catch (exception) {
      if (mounted) {
        setState(() => error = providerAppErrorMessage(exception));
      }
    } finally {
      if (mounted) {
        setState(() => loadingMoreHistory = false);
      }
    }
  }

  Future<void> completeService(Map<String, dynamic> booking) async {
    final bookingId = booking['id'];
    if (bookingId is! String || !isProviderActiveBooking(booking)) {
      return;
    }
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Hoàn tất dịch vụ này?'),
        content: const Text(
          'Thao tác này kết thúc công việc và bắt đầu xử lý thanh toán, thu nhập.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Tiếp tục dịch vụ'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Xác nhận hoàn tất'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) {
      return;
    }

    setState(() {
      submittingBookingId = bookingId;
      error = null;
      statusMessage = null;
    });
    try {
      final actionLocation =
          await ref.read(providerRepositoryProvider).updateLocation(
                bookingId: bookingId,
                includeAddressText: true,
              );
      final lat = asNum(actionLocation['lat'] ?? actionLocation['latitude'])
          ?.toDouble();
      final lng = asNum(actionLocation['lng'] ?? actionLocation['longitude'])
          ?.toDouble();
      if (lat == null || lng == null) {
        if (mounted) {
          setState(() => error =
              'Cần vị trí hiện tại trước khi hoàn tất đặt lịch. Hãy bật vị trí và thử lại.');
        }
        return;
      }
      final addressText = actionLocation['addressText']?.toString().trim();
      ref.read(providerLocationHeartbeatProvider).recordSuccessfulUpdate(
            interval: ProviderLocationHeartbeat.activeBookingInterval,
            bookingId: bookingId,
          );
      await ref.read(providerRepositoryProvider).completeBooking(
            bookingId,
            lat: lat,
            lng: lng,
            addressText:
                addressText == null || addressText.isEmpty ? null : addressText,
          );
      final heartbeat = ref.read(providerLocationHeartbeatProvider);
      await heartbeat.start(runImmediately: false);
      heartbeat.recordSuccessfulUpdate();
      await loadJobs(showLoading: false);
      if (mounted) {
        setState(() {
          statusMessage =
              'Dịch vụ đã hoàn tất. Bản ghi cuối cùng đã được lưu vào lịch sử công việc.';
        });
      }
    } catch (exception) {
      if (mounted) {
        setState(() => error = providerAppErrorMessage(exception));
      }
    } finally {
      if (mounted) {
        setState(() => submittingBookingId = null);
      }
    }
  }

  void openChat(Map<String, dynamic> booking) {
    final bookingId = booking['id'];
    final chatRoom = asMap(booking['chatRoom']);
    final chatRoomId = chatRoom?['id'];
    if (bookingId is String && chatRoomId is String) {
      widget.onOpenChat?.call(bookingId, chatRoomId);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    final activeItems =
        activeBookings.whereType<Map<String, dynamic>>().toList()
          ..sort((left, right) {
            final targetBookingId = widget.initialBookingId;
            if (targetBookingId != null) {
              if (left['id'] == targetBookingId) {
                return -1;
              }
              if (right['id'] == targetBookingId) {
                return 1;
              }
            }
            return bookingTimestamp(right).compareTo(bookingTimestamp(left));
          });
    final historyItems =
        historyBookings.whereType<Map<String, dynamic>>().toList()
          ..sort((left, right) {
            final targetBookingId = widget.initialBookingId;
            if (targetBookingId != null) {
              if (left['id'] == targetBookingId) {
                return -1;
              }
              if (right['id'] == targetBookingId) {
                return 1;
              }
            }
            return bookingTimestamp(right).compareTo(bookingTimestamp(left));
          });
    final completedCount = historyItems
        .where((booking) => booking['status'] == 'COMPLETED')
        .length;
    final closedCount = historyItems.where(isProviderClosedBooking).length;

    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text('Công việc', style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 8),
          Text(
            'Công việc hôm nay, dịch vụ đang hoạt động và các đặt lịch đã đóng.',
            style: Theme.of(context).textTheme.bodyLarge,
          ),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: loading
                ? null
                : auth == null
                    ? (localDemoAccessEnabled ? signInAndLoad : null)
                    : loadJobs,
            icon: const Icon(Icons.work_history_outlined),
            label: Text(auth == null
                ? (localDemoAccessEnabled
                    ? 'Đăng nhập thử nghiệm'
                    : 'Đăng nhập trong mục Yêu cầu')
                : 'Làm mới công việc'),
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
            active: activeItems.length,
            completed: completedCount,
            closed: closedCount,
          ),
          const SizedBox(height: 16),
          if (auth == null)
            const InfoCard(text: 'Đăng nhập để tải hàng chờ công việc của bạn.')
          else ...[
            Text('Công việc đang hoạt động',
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            if (activeItems.isEmpty)
              const InfoCard(
                  text: 'Hiện không có công việc đã xác nhận cần xử lý.')
            else
              for (final booking in activeItems)
                PartnerJobsCard(
                  booking: booking,
                  actionBusy: submittingBookingId != null,
                  onOpenChat: asMap(booking['chatRoom'])?['id'] is String &&
                          widget.onOpenChat != null
                      ? () => openChat(booking)
                      : null,
                  onCompleteService: isProviderActiveBooking(booking)
                      ? () => completeService(booking)
                      : null,
                ),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Lịch sử công việc',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
                Text(
                  'Đã tải ${historyItems.length}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (historyItems.isEmpty)
              const InfoCard(text: 'Chưa có công việc hoàn tất hoặc đã đóng.')
            else
              for (final booking in historyItems)
                PartnerJobsCard(booking: booking),
            if (hasMoreHistory && historyItems.isNotEmpty) ...[
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: loadingMoreHistory ? null : loadMoreHistory,
                icon: loadingMoreHistory
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.expand_more),
                label: Text(
                  loadingMoreHistory ? 'Đang tải lịch sử' : 'Tải thêm lịch sử',
                ),
              ),
            ],
          ],
        ],
      ),
    );
  }
}
