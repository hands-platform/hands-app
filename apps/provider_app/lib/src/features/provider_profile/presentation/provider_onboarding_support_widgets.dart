import 'package:flutter/material.dart';

import '../../../core/provider_value_helpers.dart';
import '../../booking/presentation/provider_jobs_helpers.dart';
import '../../provider_onboarding/presentation/provider_onboarding_status.dart';

class ProviderFirstRevenuePayoutSetupPanel extends StatelessWidget {
  const ProviderFirstRevenuePayoutSetupPanel({
    super.key,
    required this.completedBookingCount,
    required this.addressReady,
    required this.missingAgreementCount,
    required this.onUpdateAddress,
    required this.onAcceptAgreements,
  });

  final int completedBookingCount;
  final bool addressReady;
  final int missingAgreementCount;
  final VoidCallback? onUpdateAddress;
  final VoidCallback? onAcceptAgreements;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final agreementsReady = missingAgreementCount == 0;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colorScheme.tertiaryContainer.withValues(alpha: 0.35),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: colorScheme.tertiary),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.account_balance_wallet_outlined,
                  color: colorScheme.tertiary),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Đã ghi nhận thu nhập đầu tiên',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Đã hoàn tất $completedBookingCount dịch vụ. Hãy hoàn thiện địa chỉ liên hệ và thỏa thuận ví trước khi yêu cầu rút tiền.',
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ProviderPayoutSetupStatusRow(
            label: 'Thông tin ngân hàng',
            value: 'Trong mục Thu nhập',
            complete: true,
          ),
          ProviderPayoutSetupStatusRow(
            label: 'Địa chỉ cư trú',
            value: addressReady ? 'Đã lưu' : 'Còn thiếu',
            complete: addressReady,
          ),
          ProviderPayoutSetupStatusRow(
            label: 'Thỏa thuận thanh toán',
            value:
                agreementsReady ? 'Đã chấp nhận' : 'Còn $missingAgreementCount',
            complete: agreementsReady,
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (!addressReady)
                FilledButton.tonalIcon(
                  onPressed: onUpdateAddress,
                  icon: const Icon(Icons.home_outlined),
                  label: const Text('Cập nhật địa chỉ'),
                ),
              if (!agreementsReady)
                FilledButton.tonalIcon(
                  onPressed: onAcceptAgreements,
                  icon: const Icon(Icons.assignment_turned_in_outlined),
                  label: const Text('Chấp nhận thỏa thuận ví'),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class ProviderPayoutSetupStatusRow extends StatelessWidget {
  const ProviderPayoutSetupStatusRow({
    super.key,
    required this.label,
    required this.value,
    required this.complete,
  });

  final String label;
  final String value;
  final bool complete;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(
            complete ? Icons.check_circle_outline : Icons.radio_button_checked,
            color: complete ? colorScheme.primary : colorScheme.tertiary,
            size: 20,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              label,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
          const SizedBox(width: 8),
          Text(
            value,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
          ),
        ],
      ),
    );
  }
}

class ProviderLevelRoadmap extends StatelessWidget {
  const ProviderLevelRoadmap({super.key, required this.milestones});

  final List<ProviderOnboardingLevelMilestone> milestones;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final completedCount =
        milestones.where((milestone) => milestone.complete).length;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colorScheme.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(Icons.stairs_outlined, color: colorScheme.primary),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Lộ trình tài khoản',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              Chip(label: Text('$completedCount/${milestones.length}')),
            ],
          ),
          const SizedBox(height: 10),
          for (final milestone in milestones) ...[
            ProviderLevelRoadmapRow(milestone: milestone),
            if (milestone != milestones.last) const SizedBox(height: 8),
          ],
        ],
      ),
    );
  }
}

class ProviderLevelRoadmapRow extends StatelessWidget {
  const ProviderLevelRoadmapRow({super.key, required this.milestone});

  final ProviderOnboardingLevelMilestone milestone;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final icon = milestone.complete
        ? Icons.check_circle_outline
        : milestone.current
            ? Icons.radio_button_checked
            : Icons.radio_button_unchecked;
    final iconColor = milestone.complete || milestone.current
        ? colorScheme.primary
        : colorScheme.onSurfaceVariant;
    final background = milestone.current
        ? colorScheme.primaryContainer.withValues(alpha: 0.35)
        : Colors.transparent;

    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: iconColor, size: 22),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  milestone.title,
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                const SizedBox(height: 2),
                Text(
                  milestone.detail,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
          if (milestone.current) ...[
            const SizedBox(width: 8),
            const Chip(label: Text('Hiện tại')),
          ],
        ],
      ),
    );
  }
}

class ProviderPayoutGateChecklist extends StatelessWidget {
  const ProviderPayoutGateChecklist({
    super.key,
    required this.items,
    required this.agreementVersion,
  });

  final List<ProviderOnboardingGateItem> items;
  final String agreementVersion;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final completeCount = items.where((item) => item.complete).length;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colorScheme.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(Icons.fact_check_outlined, color: colorScheme.primary),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Danh sách kiểm tra ví',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              Chip(label: Text('$completeCount/${items.length}')),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'Phiên bản thỏa thuận: $agreementVersion',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 10),
          for (final item in items) ...[
            ProviderPayoutGateChecklistRow(item: item),
            if (item != items.last) const SizedBox(height: 8),
          ],
        ],
      ),
    );
  }
}

class ProviderPayoutGateChecklistRow extends StatelessWidget {
  const ProviderPayoutGateChecklistRow({super.key, required this.item});

  final ProviderOnboardingGateItem item;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final iconColor = item.complete ? colorScheme.primary : colorScheme.error;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(
          item.complete ? Icons.check_circle_outline : Icons.lock_outline,
          color: iconColor,
          size: 22,
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(item.label, style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: 2),
              Text(
                item.detail,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class ProviderKycDecisionChecklist extends StatelessWidget {
  const ProviderKycDecisionChecklist({
    super.key,
    required this.items,
    required this.reviewStatus,
  });

  final List<ProviderKycDecisionItem> items;
  final String reviewStatus;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final completeCount = items.where((item) => item.complete).length;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colorScheme.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(Icons.assignment_ind_outlined, color: colorScheme.primary),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Danh sách xét duyệt KYC',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              Chip(label: Text('$completeCount/${items.length}')),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'HANDS kiểm tra các mục này trước khi mở quyền nhận việc. Trạng thái: $reviewStatus.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 10),
          for (final item in items) ...[
            ProviderKycDecisionChecklistRow(item: item),
            if (item != items.last) const SizedBox(height: 8),
          ],
        ],
      ),
    );
  }
}

class ProviderKycDecisionChecklistRow extends StatelessWidget {
  const ProviderKycDecisionChecklistRow({super.key, required this.item});

  final ProviderKycDecisionItem item;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(
          item.complete ? Icons.check_circle_outline : Icons.error_outline,
          color: item.complete ? colorScheme.primary : colorScheme.error,
          size: 22,
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(item.label, style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: 2),
              Text(
                item.detail,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class ProviderOnboardingHistoryList extends StatelessWidget {
  const ProviderOnboardingHistoryList({super.key, required this.logs});

  final List<Map<String, dynamic>> logs;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colorScheme.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(Icons.history_outlined, color: colorScheme.primary),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Hoạt động xét duyệt gần đây',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          for (final log in logs.take(5)) ...[
            ProviderOnboardingHistoryRow(log: log),
            if (log != logs.take(5).last)
              Divider(color: colorScheme.outlineVariant),
          ],
        ],
      ),
    );
  }
}

class ProviderOnboardingPriorityPanel extends StatelessWidget {
  const ProviderOnboardingPriorityPanel({
    super.key,
    required this.priority,
    required this.onPressed,
  });

  final ProviderOnboardingPriority priority;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final colors = switch (priority.tone) {
      'success' => (
          background: colorScheme.primaryContainer,
          foreground: colorScheme.onPrimaryContainer,
          icon: Icons.check_circle_outline,
        ),
      'warning' => (
          background: colorScheme.tertiaryContainer,
          foreground: colorScheme.onTertiaryContainer,
          icon: Icons.priority_high_outlined,
        ),
      _ => (
          background: colorScheme.secondaryContainer,
          foreground: colorScheme.onSecondaryContainer,
          icon: Icons.flag_outlined,
        ),
    };

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colors.background,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(colors.icon, color: colors.foreground),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      priority.title,
                      style: Theme.of(context)
                          .textTheme
                          .titleMedium
                          ?.copyWith(color: colors.foreground),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      priority.detail,
                      style: TextStyle(color: colors.foreground),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (priority.buttonLabel != null) ...[
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: onPressed,
              icon: const Icon(Icons.arrow_forward),
              label: Text(priority.buttonLabel!),
            ),
          ],
        ],
      ),
    );
  }
}

class ProviderOnboardingHistoryRow extends StatelessWidget {
  const ProviderOnboardingHistoryRow({super.key, required this.log});

  final Map<String, dynamic> log;

  @override
  Widget build(BuildContext context) {
    final action = log['action']?.toString() ?? 'event';
    final fromStatus = log['fromStatus']?.toString();
    final toStatus = log['toStatus']?.toString();
    final actor = asMap(log['actor']);
    final actorName = actor?['fullName']?.toString().trim().isNotEmpty == true
        ? actor!['fullName'].toString()
        : actor?['phone']?.toString();
    final statusText = fromStatus == null && toStatus == null
        ? 'Đã ghi nhận'
        : '${providerOnboardingReviewStatusLabel(fromStatus)} -> ${providerOnboardingReviewStatusLabel(toStatus)}';
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.only(top: 3),
            child: Icon(Icons.circle, size: 10),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  providerLogActionLabel(action),
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                const SizedBox(height: 2),
                Text(statusText),
                Text(
                  [
                    formatRelativeMoment(log['createdAt']),
                    if (actorName != null) 'bởi $actorName',
                  ].join(' / '),
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

class ProviderOnboardingPill extends StatelessWidget {
  const ProviderOnboardingPill({
    super.key,
    required this.label,
    required this.value,
    this.isPositive,
  });

  final String label;
  final String value;
  final bool? isPositive;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final color = isPositive == null
        ? colorScheme.secondaryContainer
        : isPositive!
            ? colorScheme.primaryContainer
            : colorScheme.errorContainer;
    return Chip(
      backgroundColor: color,
      label: Text('$label: $value'),
    );
  }
}

class ProviderReviewAlert extends StatelessWidget {
  const ProviderReviewAlert({
    super.key,
    required this.title,
    required this.detail,
  });

  final String title;
  final String detail;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: colorScheme.errorContainer,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: colorScheme.error),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.report_problem_outlined, color: colorScheme.error),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: 4),
                Text(detail),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class ProviderOnboardingStepCard extends StatelessWidget {
  const ProviderOnboardingStepCard({
    super.key,
    required this.step,
    required this.title,
    required this.detail,
    required this.status,
    required this.complete,
    required this.icon,
    this.actionLabel,
    this.onPressed,
  });

  final String step;
  final String title;
  final String detail;
  final String status;
  final bool complete;
  final IconData icon;
  final String? actionLabel;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final background = complete
        ? colorScheme.primaryContainer
        : colorScheme.surfaceContainerHighest;
    final foreground = complete
        ? colorScheme.onPrimaryContainer
        : colorScheme.onSurfaceVariant;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: complete ? colorScheme.primary : colorScheme.outlineVariant,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                radius: 18,
                backgroundColor: complete
                    ? colorScheme.primary
                    : colorScheme.surfaceContainerHighest,
                foregroundColor:
                    complete ? colorScheme.onPrimary : colorScheme.primary,
                child: complete
                    ? const Icon(Icons.check, size: 20)
                    : Text(step,
                        style: const TextStyle(fontWeight: FontWeight.w800)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 4),
                    Text(detail, style: TextStyle(color: foreground)),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Icon(icon, color: foreground),
            ],
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Chip(
                label: Text(status),
                backgroundColor:
                    complete ? colorScheme.primary : colorScheme.surface,
              ),
              if (actionLabel != null)
                FilledButton.tonal(
                  onPressed: onPressed,
                  child: Text(actionLabel!),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
