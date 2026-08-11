import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app_state.dart';
import '../../../core/local_demo_access.dart';
import '../../../core/provider_value_helpers.dart';
import '../../provider_onboarding/presentation/widgets/provider_onboarding_forms.dart';
import '../../provider_profile/presentation/provider_error_helpers.dart';
import '../../provider_profile/presentation/provider_feedback_cards.dart';
import 'provider_wallet_gate_helpers.dart';
import 'provider_wallet_settlement_widgets.dart';

class EarningsScreen extends ConsumerStatefulWidget {
  const EarningsScreen({
    super.key,
    this.initialEarningId,
    this.initialPayoutBatchId,
  });

  final String? initialEarningId;
  final String? initialPayoutBatchId;

  @override
  ConsumerState<EarningsScreen> createState() => _EarningsScreenState();
}

class _EarningsScreenState extends ConsumerState<EarningsScreen> {
  bool restoringSession = false;
  bool handlingWalletRequest = false;
  String? restoreMessage;
  String? restoreError;

  @override
  void initState() {
    super.initState();
    if (_hasInitialTarget) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        unawaited(restoreSessionForTarget());
      });
    }
  }

  bool get _hasInitialTarget =>
      widget.initialEarningId != null || widget.initialPayoutBatchId != null;

  Future<void> restoreSessionForTarget() async {
    setState(() {
      restoringSession = true;
      restoreMessage = null;
      restoreError = null;
    });
    try {
      final authController = ref.read(authControllerProvider.notifier);
      final session = ref.read(authControllerProvider) ??
          await authController.restoreSession();
      if (!mounted) {
        return;
      }
      if (session == null) {
        setState(() => restoreMessage = 'Đăng nhập để xem cập nhật thu nhập.');
      }
    } catch (exception) {
      if (mounted) {
        setState(
          () => restoreError = providerAppErrorMessage(
            exception,
            fallback: 'Không thể khôi phục phiên thu nhập.',
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => restoringSession = false);
      }
    }
  }

  Future<void> _handleWalletRequest(String requestLabel) async {
    setState(() => handlingWalletRequest = true);
    try {
      final bankAccount = await _approvedBankAccount(requestLabel);
      if (mounted && bankAccount != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              providerWalletBankRequestMessage(
                requestLabel,
                bankAccount['status']?.toString(),
              ),
            ),
          ),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              providerAppErrorMessage(
                error,
                fallback: 'Không thể tải yêu cầu ví.',
              ),
            ),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => handlingWalletRequest = false);
      }
    }
  }

  Future<void> _requestWithdrawal(Map<String, dynamic> summary) async {
    setState(() => handlingWalletRequest = true);
    try {
      final bankAccount = await _approvedBankAccount('yêu cầu rút tiền');
      if (!mounted || bankAccount == null) {
        return;
      }
      final walletBalance = providerWalletBalance(summary).toInt();
      if (walletBalance <= 0) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Không có số dư ví khả dụng để rút.')),
        );
        return;
      }
      final input = await showProviderWalletWithdrawalSheet(
        context,
        availableBalance: walletBalance,
        currency: summary['currency']?.toString() ?? 'VND',
      );
      if (input == null) {
        return;
      }
      await ref.read(providerRepositoryProvider).createWalletWithdrawalRequest(
            amount: input.amount,
            bankAccountId: bankAccount['id']?.toString(),
            requestNote: input.note,
          );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Đã gửi yêu cầu rút tiền.')),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              providerAppErrorMessage(
                error,
                fallback: 'Không thể gửi yêu cầu rút tiền.',
              ),
            ),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => handlingWalletRequest = false);
      }
    }
  }

  Future<Map<String, dynamic>?> _approvedBankAccount(
      String requestLabel) async {
    final repository = ref.read(providerRepositoryProvider);
    final snapshot = await repository.onboardingSnapshot();
    final bankAccount = providerWalletPrimaryBankAccount(snapshot);
    final bankStatus = bankAccount?['status']?.toString();

    if (providerWalletBankInputRequired(snapshot)) {
      if (!mounted) {
        return null;
      }
      final input = await showProviderBankAccountSheet(
        context,
        initial: bankAccount ?? const <String, dynamic>{},
        status: bankStatus,
        rejectionReason: providerWalletBankRejectionReason(bankAccount),
      );
      if (input == null) {
        return null;
      }
      await repository.createOnboardingBankAccount(
        bankName: input.bankName,
        accountNumber: input.accountNumber,
        accountHolderName: input.accountHolderName,
        qrBankingInfo: input.qrBankingInfo,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Đã gửi thông tin ngân hàng để quản trị viên xem xét. Hãy thử lại $requestLabel sau khi được phê duyệt.',
            ),
          ),
        );
      }
      return null;
    }
    if (bankStatus != 'APPROVED') {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              providerWalletBankRequestMessage(requestLabel, bankStatus),
            ),
          ),
        );
      }
      return null;
    }
    return bankAccount;
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);

    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text('Thu nhập', style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 8),
          Text(
            auth == null
                ? 'Đăng nhập để xem thu nhập từ dịch vụ đã hoàn tất.'
                : 'Theo dõi doanh thu, phí nền tảng, thuế khấu trừ và số tiền thực nhận.',
            style: Theme.of(context).textTheme.bodyLarge,
          ),
          const SizedBox(height: 16),
          if (restoringSession)
            const Center(child: CircularProgressIndicator())
          else if (restoreMessage != null)
            InfoCard(text: restoreMessage!)
          else if (restoreError != null)
            ProviderErrorCard(text: restoreError!)
          else if (auth == null)
            InfoCard(
              text: localDemoAccessEnabled
                  ? 'Có thể đăng nhập thử nghiệm trong mục Yêu cầu.'
                  : 'Đăng nhập bằng OTP điện thoại trong mục Yêu cầu.',
            )
          else
            FutureBuilder<List<dynamic>>(
              future: ref.read(providerRepositoryProvider).earnings(),
              builder: (context, earningsSnapshot) {
                return FutureBuilder<Map<String, dynamic>>(
                  future:
                      ref.read(providerRepositoryProvider).earningsSummary(),
                  builder: (context, summarySnapshot) {
                    if (earningsSnapshot.connectionState ==
                            ConnectionState.waiting ||
                        summarySnapshot.connectionState ==
                            ConnectionState.waiting) {
                      return const Center(child: CircularProgressIndicator());
                    }

                    final summary = summarySnapshot.data ?? <String, dynamic>{};
                    final earnings = sortedProviderEarningsForTarget(
                      (earningsSnapshot.data ?? [])
                          .whereType<Map<String, dynamic>>()
                          .toList(),
                      earningId: widget.initialEarningId,
                      payoutBatchId: widget.initialPayoutBatchId,
                    );
                    final currency = summary['currency'] ?? 'VND';
                    final settlementView =
                        ProviderWalletSettlementView.fromSummary(summary);

                    return FutureBuilder<List<dynamic>>(
                      future:
                          ref.read(providerRepositoryProvider).payoutBatches(),
                      builder: (context, payoutSnapshot) {
                        final batches = (payoutSnapshot.data ?? [])
                            .whereType<Map<String, dynamic>>()
                            .toList();
                        final targetPayoutBatch = providerTargetPayoutBatch(
                          batches,
                          payoutBatchId: widget.initialPayoutBatchId,
                        );
                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Card(
                              color: settlementView.blocked
                                  ? Theme.of(context).colorScheme.errorContainer
                                  : settlementView.bankCorrectionRequired
                                      ? Theme.of(context)
                                          .colorScheme
                                          .tertiaryContainer
                                      : Theme.of(context)
                                          .colorScheme
                                          .primaryContainer,
                              child: Padding(
                                padding: const EdgeInsets.all(16),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text('Số dư ví',
                                        style: Theme.of(context)
                                            .textTheme
                                            .titleMedium),
                                    const SizedBox(height: 8),
                                    Text(
                                      settlementView.balanceLabel,
                                      style: Theme.of(context)
                                          .textTheme
                                          .headlineSmall,
                                    ),
                                    const SizedBox(height: 8),
                                    Text(
                                      settlementView.statusLabel,
                                      style: Theme.of(context)
                                          .textTheme
                                          .labelLarge
                                          ?.copyWith(
                                            fontWeight: FontWeight.w800,
                                          ),
                                    ),
                                    const SizedBox(height: 6),
                                    Text(
                                      settlementView.blocked
                                          ? settlementView.reasonLabel
                                          : settlementView
                                                  .bankCorrectionRequired
                                              ? settlementView
                                                  .bankCorrectionReasonLabel
                                              : 'Bạn có thể tham gia yêu cầu công khai và nhận yêu cầu trực tiếp.',
                                    ),
                                    if (settlementView.bankCorrectionRequired &&
                                        !settlementView.blocked) ...[
                                      const SizedBox(height: 10),
                                      Text(
                                        'Cập nhật thông tin ngân hàng trước khi yêu cầu rút tiền hoặc báo cáo khoản nộp.',
                                        style: Theme.of(context)
                                            .textTheme
                                            .bodyMedium
                                            ?.copyWith(
                                                fontWeight: FontWeight.w700),
                                      ),
                                      const SizedBox(height: 10),
                                      WalletSettlementChecklist(
                                        items: settlementView.steps,
                                      ),
                                    ],
                                    if (settlementView.blocked) ...[
                                      const SizedBox(height: 10),
                                      Text(
                                        'Số tiền cần thanh toán: ${settlementView.amountLabel}',
                                        style: Theme.of(context)
                                            .textTheme
                                            .titleSmall
                                            ?.copyWith(
                                                fontWeight: FontWeight.w800),
                                      ),
                                      const SizedBox(height: 6),
                                      Text(settlementView.instruction),
                                      if (settlementView.reference != null) ...[
                                        const SizedBox(height: 10),
                                        WalletSettlementReferenceCard(
                                          reference: settlementView.reference!,
                                          amountLabel:
                                              settlementView.amountLabel,
                                        ),
                                      ],
                                      const SizedBox(height: 10),
                                      WalletSettlementChecklist(
                                        items: settlementView.steps,
                                      ),
                                    ],
                                    const SizedBox(height: 14),
                                    Wrap(
                                      spacing: 8,
                                      runSpacing: 8,
                                      children: [
                                        FilledButton.icon(
                                          onPressed: handlingWalletRequest ||
                                                  settlementView
                                                          .walletBalance <=
                                                      0
                                              ? null
                                              : () =>
                                                  _requestWithdrawal(summary),
                                          icon: const Icon(
                                              Icons.account_balance_outlined),
                                          label: Text(handlingWalletRequest
                                              ? 'Đang kiểm tra ngân hàng...'
                                              : settlementView.walletBalance <=
                                                      0
                                                  ? 'Không có số dư để rút'
                                                  : 'Yêu cầu rút tiền'),
                                        ),
                                        OutlinedButton.icon(
                                          onPressed: handlingWalletRequest
                                              ? null
                                              : () => _handleWalletRequest(
                                                    'báo cáo khoản nộp',
                                                  ),
                                          icon: const Icon(
                                              Icons.receipt_long_outlined),
                                          label:
                                              const Text('Báo cáo khoản nộp'),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            ),
                            const SizedBox(height: 12),
                            FutureBuilder<List<dynamic>>(
                              future: ref
                                  .read(providerRepositoryProvider)
                                  .walletWithdrawalRequests(),
                              builder: (context, withdrawalSnapshot) {
                                if (withdrawalSnapshot.connectionState ==
                                    ConnectionState.waiting) {
                                  return const Card(
                                    child: Padding(
                                      padding: EdgeInsets.all(20),
                                      child: Center(
                                        child: CircularProgressIndicator(),
                                      ),
                                    ),
                                  );
                                }
                                if (withdrawalSnapshot.hasError) {
                                  return ProviderErrorCard(
                                    text: providerAppErrorMessage(
                                      withdrawalSnapshot.error,
                                      fallback:
                                          'Không thể tải yêu cầu rút tiền.',
                                    ),
                                  );
                                }
                                return ProviderWalletWithdrawalHistoryCard(
                                  requests: (withdrawalSnapshot.data ?? [])
                                      .whereType<Map<String, dynamic>>()
                                      .toList(),
                                );
                              },
                            ),
                            const SizedBox(height: 12),
                            Card(
                              child: Padding(
                                padding: const EdgeInsets.all(16),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text('Số tiền thực nhận',
                                        style: Theme.of(context)
                                            .textTheme
                                            .titleMedium),
                                    const SizedBox(height: 8),
                                    Text(
                                      '${formatCurrency(summary['netAmount'])} $currency',
                                      style: Theme.of(context)
                                          .textTheme
                                          .headlineSmall,
                                    ),
                                    const SizedBox(height: 8),
                                    Text(
                                        'Thuế khấu trừ ${formatCurrency(providerTaxWithholdingAmount(summary))} $currency'),
                                    Text(
                                        'Phí HANDS ${formatCurrency(summary['platformFee'])} $currency'),
                                    Text('${batches.length} đợt chi trả'),
                                  ],
                                ),
                              ),
                            ),
                            const SizedBox(height: 12),
                            if (targetPayoutBatch != null) ...[
                              Card(
                                shape: providerTargetEarningsCardShape(context),
                                child: ListTile(
                                  leading: const Icon(Icons.payments_outlined),
                                  title: Text(
                                      'Chi trả ${targetPayoutBatch['id'] ?? widget.initialPayoutBatchId}'),
                                  subtitle: Text(providerPayoutStatusLabel(
                                    targetPayoutBatch['status'],
                                  )),
                                  trailing: Text(
                                      '${targetPayoutBatch['totalAmount'] ?? targetPayoutBatch['amount'] ?? 0} ${targetPayoutBatch['currency'] ?? currency}'),
                                ),
                              ),
                              const SizedBox(height: 12),
                            ],
                            if (earnings.isEmpty)
                              const InfoCard(
                                  text:
                                      'Công việc đã hoàn tất sẽ xuất hiện tại đây.')
                            else
                              for (final earning in earnings)
                                Card(
                                  shape: isProviderEarningTarget(
                                    earning,
                                    earningId: widget.initialEarningId,
                                    payoutBatchId: widget.initialPayoutBatchId,
                                  )
                                      ? providerTargetEarningsCardShape(context)
                                      : null,
                                  child: ListTile(
                                    title: Text(
                                        '${formatCurrency(earning['netAmount'])} ${earning['currency'] ?? currency}'),
                                    subtitle: Text(
                                        'Đặt lịch ${earning['bookingId']} - ${providerEarningStatusLabel(earning['status'])}'),
                                    trailing: Text(
                                        'Phí ${formatCurrency(earning['platformFee'])}'),
                                  ),
                                ),
                          ],
                        );
                      },
                    );
                  },
                );
              },
            ),
        ],
      ),
    );
  }
}

class ProviderWalletWithdrawalInput {
  const ProviderWalletWithdrawalInput({
    required this.amount,
    this.note,
  });

  final int amount;
  final String? note;
}

Future<ProviderWalletWithdrawalInput?> showProviderWalletWithdrawalSheet(
  BuildContext context, {
  required int availableBalance,
  required String currency,
}) {
  return showModalBottomSheet<ProviderWalletWithdrawalInput>(
    context: context,
    isScrollControlled: true,
    builder: (context) => _ProviderWalletWithdrawalSheet(
      availableBalance: availableBalance,
      currency: currency,
    ),
  );
}

class _ProviderWalletWithdrawalSheet extends StatefulWidget {
  const _ProviderWalletWithdrawalSheet({
    required this.availableBalance,
    required this.currency,
  });

  final int availableBalance;
  final String currency;

  @override
  State<_ProviderWalletWithdrawalSheet> createState() =>
      _ProviderWalletWithdrawalSheetState();
}

class _ProviderWalletWithdrawalSheetState
    extends State<_ProviderWalletWithdrawalSheet> {
  final _formKey = GlobalKey<FormState>();
  final _amountController = TextEditingController();
  final _noteController = TextEditingController();

  @override
  void dispose() {
    _amountController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) {
      return;
    }
    final note = _noteController.text.trim();
    Navigator.of(context).pop(
      ProviderWalletWithdrawalInput(
        amount: int.parse(_amountController.text),
        note: note.isEmpty ? null : note,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        20,
        20,
        20 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Yêu cầu rút tiền',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 6),
            Text(
              'Số dư ví khả dụng: ${formatCurrency(widget.availableBalance)} ${widget.currency}',
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _amountController,
              autofocus: true,
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              decoration: InputDecoration(
                labelText: 'Số tiền (${widget.currency})',
                border: const OutlineInputBorder(),
              ),
              validator: (value) {
                final amount = int.tryParse(value ?? '');
                if (amount == null || amount <= 0) {
                  return 'Nhập số tiền lớn hơn 0.';
                }
                if (amount > widget.availableBalance) {
                  return 'Số tiền vượt quá số dư ví.';
                }
                return null;
              },
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _noteController,
              maxLength: 500,
              maxLines: 2,
              decoration: const InputDecoration(
                labelText: 'Ghi chú (không bắt buộc)',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: _submit,
              child: const Text('Gửi yêu cầu'),
            ),
          ],
        ),
      ),
    );
  }
}

class ProviderWalletWithdrawalHistoryCard extends StatelessWidget {
  const ProviderWalletWithdrawalHistoryCard({
    super.key,
    required this.requests,
  });

  final List<Map<String, dynamic>> requests;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Yêu cầu rút tiền',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            if (requests.isEmpty)
              const Text('Chưa có yêu cầu rút tiền.')
            else
              for (var index = 0; index < requests.length; index++) ...[
                if (index > 0) const Divider(),
                _ProviderWalletWithdrawalRow(request: requests[index]),
              ],
          ],
        ),
      ),
    );
  }
}

class _ProviderWalletWithdrawalRow extends StatelessWidget {
  const _ProviderWalletWithdrawalRow({required this.request});

  final Map<String, dynamic> request;

  @override
  Widget build(BuildContext context) {
    final status = request['status']?.toString() ?? 'REQUESTED';
    final correctionReason = request['correctionReason']?.toString().trim();
    final transferRef = request['transferRef']?.toString().trim();
    final bankAccount = asMap(request['bankAccount']);
    final bankName = bankAccount?['bankName']?.toString().trim();
    final bankLast4 = bankAccount?['accountNumberLast4']?.toString().trim();
    final detail = [
      providerWalletWithdrawalStatusLabel(status),
      if (bankName != null && bankName.isNotEmpty)
        '$bankName${bankLast4 == null || bankLast4.isEmpty ? '' : ' số cuối $bankLast4'}',
      if (correctionReason != null && correctionReason.isNotEmpty)
        correctionReason,
      if (transferRef != null && transferRef.isNotEmpty)
        'Mã chuyển khoản $transferRef',
      formatProviderWalletWithdrawalDate(
        request['paidAt'] ?? request['createdAt'],
      ),
    ].where((value) => value.isNotEmpty).join('\n');

    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(
        status == 'PAID'
            ? Icons.check_circle_outline
            : status == 'REJECTED' ||
                    status == 'FAILED' ||
                    status == 'NEEDS_BANK_CORRECTION'
                ? Icons.error_outline
                : Icons.schedule_outlined,
      ),
      title: Text(
        '${formatCurrency(request['amount'])} ${request['currency'] ?? 'VND'}',
      ),
      subtitle: Text(detail),
      isThreeLine: true,
    );
  }
}

String providerWalletWithdrawalStatusLabel(String status) {
  return switch (status) {
    'REQUESTED' => 'Đã gửi yêu cầu',
    'NEEDS_BANK_CORRECTION' => 'Cần sửa thông tin ngân hàng',
    'APPROVED' => 'Đã phê duyệt',
    'BANK_TRANSFER_PENDING' => 'Đang chờ chuyển khoản ngân hàng',
    'REVIEW_REQUIRED' => 'Cần xem xét',
    'HOLD' => 'Đang tạm giữ',
    'PAID' => 'Đã thanh toán',
    'REJECTED' => 'Đã từ chối',
    'CANCELLED' => 'Đã hủy',
    'FAILED' => 'Thất bại',
    'REVERSED' => 'Đã hoàn tác',
    _ => status.replaceAll('_', ' ').toLowerCase(),
  };
}

String providerPayoutStatusLabel(Object? status) => switch (status) {
      'PENDING' || 'REQUESTED' => 'Đang chờ xử lý',
      'APPROVED' => 'Đã phê duyệt',
      'PROCESSING' || 'BANK_TRANSFER_PENDING' => 'Đang chuyển khoản',
      'PAID' || 'COMPLETED' => 'Đã thanh toán',
      'HOLD' => 'Đang tạm giữ',
      'FAILED' => 'Chi trả thất bại',
      'CANCELLED' => 'Đã hủy',
      _ => 'Cập nhật chi trả',
    };

String providerEarningStatusLabel(Object? status) => switch (status) {
      'PENDING' => 'Đang chờ',
      'AVAILABLE' || 'APPROVED' => 'Khả dụng',
      'PAID' || 'COMPLETED' => 'Đã thanh toán',
      'HOLD' => 'Đang tạm giữ',
      'REVERSED' => 'Đã hoàn tác',
      _ => 'Đang xử lý',
    };

String formatProviderWalletWithdrawalDate(dynamic value) {
  final date = DateTime.tryParse(value?.toString() ?? '')?.toLocal();
  if (date == null) {
    return '';
  }
  String two(int part) => part.toString().padLeft(2, '0');
  return '${date.year}-${two(date.month)}-${two(date.day)} '
      '${two(date.hour)}:${two(date.minute)}';
}

List<Map<String, dynamic>> sortedProviderEarningsForTarget(
  List<Map<String, dynamic>> earnings, {
  String? earningId,
  String? payoutBatchId,
}) {
  return earnings
    ..sort((left, right) {
      final leftTarget = isProviderEarningTarget(
        left,
        earningId: earningId,
        payoutBatchId: payoutBatchId,
      );
      final rightTarget = isProviderEarningTarget(
        right,
        earningId: earningId,
        payoutBatchId: payoutBatchId,
      );
      if (leftTarget != rightTarget) {
        return leftTarget ? -1 : 1;
      }

      return 0;
    });
}

bool isProviderEarningTarget(
  Map<String, dynamic> earning, {
  String? earningId,
  String? payoutBatchId,
}) {
  final matchesEarning =
      earningId != null && earning['id']?.toString() == earningId;
  final matchesPayout = payoutBatchId != null &&
      earning['payoutBatchId']?.toString() == payoutBatchId;

  return matchesEarning || matchesPayout;
}

int providerTaxWithholdingAmount(Map<String, dynamic> summary) {
  final value = summary['withholdingAmount'] ?? summary['taxAmount'];
  if (value is num) {
    return value.toInt();
  }
  return int.tryParse(value?.toString() ?? '') ?? 0;
}

Map<String, dynamic>? providerTargetPayoutBatch(
  List<Map<String, dynamic>> batches, {
  String? payoutBatchId,
}) {
  if (payoutBatchId == null) {
    return null;
  }

  for (final batch in batches) {
    if (batch['id']?.toString() == payoutBatchId) {
      return batch;
    }
  }
  return null;
}

ShapeBorder providerTargetEarningsCardShape(BuildContext context) {
  return RoundedRectangleBorder(
    borderRadius: BorderRadius.circular(8),
    side: BorderSide(
      color: Theme.of(context).colorScheme.primary,
      width: 2,
    ),
  );
}

Map<String, dynamic>? providerWalletPrimaryBankAccount(
    Map<String, dynamic> snapshot) {
  final bankAccounts = asList(snapshot['bankAccounts'])
      .map(asMap)
      .whereType<Map<String, dynamic>>()
      .toList();
  if (bankAccounts.isEmpty) {
    return null;
  }
  return bankAccounts.first;
}

bool providerWalletBankInputRequired(Map<String, dynamic> snapshot) {
  final bankAccount = providerWalletPrimaryBankAccount(snapshot);
  final status = bankAccount?['status']?.toString();
  return bankAccount == null || status == null || status == 'REJECTED';
}

String? providerWalletBankRejectionReason(Map<String, dynamic>? bankAccount) {
  final reason = bankAccount?['rejectionReason']?.toString().trim();
  return reason == null || reason.isEmpty ? null : reason;
}

String providerWalletBankRequestMessage(String requestLabel, String? status) {
  if (status == 'APPROVED') {
    return 'Thông tin ngân hàng đã được phê duyệt. Có thể tiếp tục $requestLabel qua HANDS.';
  }
  if (status == 'PENDING_REVIEW') {
    return 'Thông tin ngân hàng đang chờ phê duyệt trước khi tiếp tục $requestLabel.';
  }
  return 'Thêm thông tin ngân hàng trước khi tiếp tục $requestLabel.';
}
