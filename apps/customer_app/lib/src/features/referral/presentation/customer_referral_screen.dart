import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api_client.dart';
import '../../../core/app_config.dart';
import '../../../core/customer_design_system.dart';
import '../../../core/customer_value_helpers.dart';
import '../../../core/widgets/customer_app_chrome.dart';
import '../../../core/widgets/customer_feedback_panels.dart';
import '../data/customer_referral_repository.dart';
import 'customer_referral_copy.dart';

class CustomerReferralScreen extends ConsumerStatefulWidget {
  const CustomerReferralScreen({super.key});

  @override
  ConsumerState<CustomerReferralScreen> createState() =>
      _CustomerReferralScreenState();
}

class _CustomerReferralScreenState
    extends ConsumerState<CustomerReferralScreen> {
  final _claimController = TextEditingController();
  final _cashingOut = <String>{};
  final _invites = <Map<String, dynamic>>[];
  final _rewards = <Map<String, dynamic>>[];
  Map<String, dynamic>? _summary;
  String? _summaryError;
  String? _invitesError;
  String? _rewardsError;
  String? _notice;
  String? _actionError;
  String? _nextInvites;
  String? _nextRewards;
  bool _loadingSummary = false;
  bool _loadingInvites = false;
  bool _loadingRewards = false;
  bool _starting = false;
  bool _claiming = false;

  CustomerReferralRepository get _repository =>
      ref.read(customerReferralRepositoryProvider);

  @override
  void initState() {
    super.initState();
    Future.microtask(_loadSummary);
  }

  @override
  void dispose() {
    _claimController.dispose();
    super.dispose();
  }

  Future<void> _loadSummary({bool loadLists = true}) async {
    if (_loadingSummary) return;
    setState(() {
      _loadingSummary = true;
      _summaryError = null;
    });
    try {
      final summary = await _repository.summary();
      if (!mounted) return;
      setState(() => _summary = summary);
      if (loadLists && asMap(summary['referralCode']) != null) {
        await Future.wait([
          _loadInvites(reset: true),
          _loadRewards(reset: true),
        ]);
      }
    } catch (_) {
      if (mounted) setState(() => _summaryError = 'loadError');
    } finally {
      if (mounted) setState(() => _loadingSummary = false);
    }
  }

  Future<void> _loadInvites({required bool reset}) async {
    if (_loadingInvites) return;
    setState(() {
      _loadingInvites = true;
      _invitesError = null;
    });
    try {
      final result = await _repository.invites(
        cursor: reset ? null : _nextInvites,
      );
      final rows = asList(result['rows'])
          .map(asMap)
          .whereType<Map<String, dynamic>>()
          .toList(growable: false);
      final pagination = asMap(result['pagination']);
      if (!mounted) return;
      setState(() {
        if (reset) _invites.clear();
        _invites.addAll(rows);
        _nextInvites = pagination?['nextCursor']?.toString();
      });
    } catch (_) {
      if (mounted) setState(() => _invitesError = 'listError');
    } finally {
      if (mounted) setState(() => _loadingInvites = false);
    }
  }

  Future<void> _loadRewards({required bool reset}) async {
    if (_loadingRewards) return;
    setState(() {
      _loadingRewards = true;
      _rewardsError = null;
    });
    try {
      final result = await _repository.rewards(
        cursor: reset ? null : _nextRewards,
      );
      final rows = asList(result['rows'])
          .map(asMap)
          .whereType<Map<String, dynamic>>()
          .toList(growable: false);
      final pagination = asMap(result['pagination']);
      if (!mounted) return;
      setState(() {
        if (reset) _rewards.clear();
        _rewards.addAll(rows);
        _nextRewards = pagination?['nextCursor']?.toString();
      });
    } catch (_) {
      if (mounted) setState(() => _rewardsError = 'listError');
    } finally {
      if (mounted) setState(() => _loadingRewards = false);
    }
  }

  Future<void> _refresh() async {
    await _loadSummary(loadLists: false);
    if (asMap(_summary?['referralCode']) != null) {
      await Future.wait([
        _loadInvites(reset: true),
        _loadRewards(reset: true),
      ]);
    }
  }

  Future<void> _startRewards() async {
    if (_starting || asMap(_summary?['referralCode']) != null) return;
    setState(() {
      _starting = true;
      _actionError = null;
    });
    try {
      final code = await _repository.issueCode();
      if (!mounted) return;
      setState(() {
        _summary = {...?_summary, 'referralCode': code};
        _notice = 'codeReady';
      });
      await Future.wait([
        _loadInvites(reset: true),
        _loadRewards(reset: true),
      ]);
    } catch (_) {
      if (mounted) setState(() => _actionError = 'codeIssueError');
    } finally {
      if (mounted) setState(() => _starting = false);
    }
  }

  Future<void> _copyReferralLink(String link) async {
    final locale = Localizations.localeOf(context);
    try {
      await Clipboard.setData(ClipboardData(text: link));
      if (mounted) {
        setState(() {
          _actionError = null;
          _notice = 'copied';
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _actionError = 'copyError';
          _notice = null;
        });
      }
    }
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content:
            Text(referralText(locale, _actionError ?? _notice ?? 'copied')),
      ),
    );
  }

  Future<void> _claimCode() async {
    if (_claiming) return;
    final locale = Localizations.localeOf(context);
    final code = _claimController.text.trim();
    if (code.isEmpty) {
      setState(() => _actionError = 'enterCode');
      return;
    }
    setState(() {
      _claiming = true;
      _actionError = null;
    });
    try {
      await _repository.claim(code);
      if (!mounted) return;
      _claimController.clear();
      setState(() => _notice = 'claimSuccess');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(referralText(locale, 'claimSuccess'))),
      );
    } catch (_) {
      if (mounted) setState(() => _actionError = 'claimError');
    } finally {
      if (mounted) setState(() => _claiming = false);
    }
  }

  Future<void> _requestCashout(Map<String, dynamic> reward) async {
    final id = reward['id']?.toString() ?? '';
    if (id.isEmpty || _cashingOut.contains(id)) return;
    final locale = Localizations.localeOf(context);
    setState(() {
      _cashingOut.add(id);
      _actionError = null;
    });
    try {
      await _repository.requestCashout(id);
      if (!mounted) return;
      setState(() => _notice = 'cashoutRequested');
      await Future.wait([
        _loadSummary(loadLists: false),
        _loadRewards(reset: true),
      ]);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(referralText(locale, 'cashoutRequested'))),
        );
      }
    } catch (exception) {
      if (mounted) {
        setState(() => _actionError = referralCashoutErrorKey(exception));
      }
    } finally {
      if (mounted) {
        setState(() => _cashingOut.remove(id));
      }
    }
  }

  Future<void> _showHelp(Map<String, dynamic>? policy) {
    return showModalBottomSheet<void>(
      context: context,
      useSafeArea: true,
      isScrollControlled: true,
      backgroundColor: context.handsColors.surface,
      builder: (context) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.78,
        maxChildSize: 0.94,
        builder: (context, controller) => SingleChildScrollView(
          controller: controller,
          padding: const EdgeInsets.all(CustomerSpacing.page),
          child: _ReferralIntroduction(
            policy: policy,
            showAction: false,
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final locale = Localizations.localeOf(context);
    final code = asMap(_summary?['referralCode']);
    final policy = asMap(_summary?['policy']);
    final policyEnabled = policy?['enabled'] == true;

    return HandsScaffold(
      appBar: HandsTopBar(
        title: referralText(locale, 'title'),
        actions: code == null
            ? null
            : [
                IconButton(
                  tooltip: referralText(locale, 'help'),
                  onPressed: () => _showHelp(policy),
                  icon: const Icon(Icons.help_outline_rounded),
                ),
              ],
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            if (_loadingSummary && _summary == null)
              const SliverFillRemaining(
                hasScrollBody: false,
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_summaryError != null && _summary == null)
              SliverFillRemaining(
                hasScrollBody: false,
                child: Padding(
                  padding: const EdgeInsets.all(CustomerSpacing.page),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      ErrorPanel(text: referralText(locale, _summaryError!)),
                      const SizedBox(height: HandsSpacing.space16),
                      FilledButton(
                        onPressed: _loadSummary,
                        child: Text(referralText(locale, 'retry')),
                      ),
                    ],
                  ),
                ),
              )
            else if (code == null)
              SliverPadding(
                padding: const EdgeInsets.all(CustomerSpacing.page),
                sliver: SliverToBoxAdapter(
                  child: Column(
                    children: [
                      _ReferralIntroduction(
                        policy: policy,
                        showAction: true,
                        loading: _starting,
                        onStart: policyEnabled ? _startRewards : null,
                      ),
                      if (_actionError != null) ...[
                        const SizedBox(height: HandsSpacing.space16),
                        ErrorPanel(
                          text: referralText(locale, _actionError!),
                        ),
                      ],
                    ],
                  ),
                ),
              )
            else
              SliverList.list(
                children: [
                  if (!policyEnabled)
                    _ReferralSection(
                      child: InfoBanner(
                        text: referralText(locale, 'inactiveBody'),
                      ),
                    ),
                  if (_actionError != null)
                    _ReferralSection(
                      child: Semantics(
                        liveRegion: true,
                        child: ErrorPanel(
                          text: referralText(locale, _actionError!),
                        ),
                      ),
                    ),
                  if (_notice != null)
                    _ReferralSection(
                      child: Semantics(
                        liveRegion: true,
                        child: InfoBanner(
                          text: referralText(locale, _notice!),
                        ),
                      ),
                    ),
                  _ReferralLinkSection(
                    code: code,
                    enabled: policyEnabled,
                    onCopy: _copyReferralLink,
                  ),
                  _ReferralSummarySection(summary: _summary),
                  _ReferralInviteSection(
                    rows: _invites,
                    errorKey: _invitesError,
                    loading: _loadingInvites,
                    hasMore: _nextInvites != null,
                    onRetry: () => _loadInvites(reset: true),
                    onLoadMore: () => _loadInvites(reset: false),
                  ),
                  _ReferralRewardSection(
                    rows: _rewards,
                    errorKey: _rewardsError,
                    loading: _loadingRewards,
                    hasMore: _nextRewards != null,
                    cashingOut: _cashingOut,
                    onCashout: _requestCashout,
                    onRetry: () => _loadRewards(reset: true),
                    onLoadMore: () => _loadRewards(reset: false),
                  ),
                  _ReferralClaimSection(
                    controller: _claimController,
                    enabled: policyEnabled && !_claiming,
                    loading: _claiming,
                    onSubmit: _claimCode,
                  ),
                  const SizedBox(height: HandsSpacing.space32),
                ],
              ),
          ],
        ),
      ),
    );
  }
}

class _ReferralIntroduction extends StatelessWidget {
  const _ReferralIntroduction({
    required this.policy,
    required this.showAction,
    this.loading = false,
    this.onStart,
  });

  final Map<String, dynamic>? policy;
  final bool showAction;
  final bool loading;
  final VoidCallback? onStart;

  @override
  Widget build(BuildContext context) {
    final locale = Localizations.localeOf(context);
    final enabled = policy?['enabled'] == true;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          referralText(locale, 'introTitle'),
          style: Theme.of(context).textTheme.headlineLarge,
        ),
        const SizedBox(height: HandsSpacing.space20),
        Text(
          referralText(locale, 'introBody'),
          style: Theme.of(context).textTheme.bodyLarge,
        ),
        const SizedBox(height: HandsSpacing.space24),
        ..._policyLines(locale, policy).map(
          (line) => Padding(
            padding: const EdgeInsets.only(bottom: HandsSpacing.space8),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  Icons.check_circle_outline_rounded,
                  size: HandsIconTheme.inline,
                  color: context.handsColors.primary,
                ),
                const SizedBox(width: HandsSpacing.space8),
                Expanded(child: Text(line)),
              ],
            ),
          ),
        ),
        const SizedBox(height: HandsSpacing.space24),
        for (final step in const [1, 2, 3]) ...[
          Text(
            referralText(locale, 'step${step}Title'),
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: HandsSpacing.space4),
          Text(
            referralText(locale, 'step${step}Body'),
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  color: context.handsColors.inkMuted,
                ),
          ),
          if (step != 3) const SizedBox(height: HandsSpacing.space20),
        ],
        if (!enabled) ...[
          const SizedBox(height: HandsSpacing.space24),
          InfoBanner(text: referralText(locale, 'inactiveBody')),
        ],
        if (showAction) ...[
          const SizedBox(height: HandsSpacing.space32),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: loading ? null : onStart,
              child: loading
                  ? const SizedBox.square(
                      dimension: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Text(referralText(locale, 'start')),
            ),
          ),
        ],
      ],
    );
  }
}

class _ReferralLinkSection extends StatelessWidget {
  const _ReferralLinkSection({
    required this.code,
    required this.enabled,
    required this.onCopy,
  });

  final Map<String, dynamic> code;
  final bool enabled;
  final ValueChanged<String> onCopy;

  @override
  Widget build(BuildContext context) {
    final locale = Localizations.localeOf(context);
    final link = buildReferralShareUrl(
      baseUrl: AppConfig.referralPublicBaseUrl,
      sharePath: code['sharePath']?.toString() ?? '',
    );
    return _ReferralSection(
      title: referralText(locale, 'myCode'),
      child: Container(
        padding: const EdgeInsets.fromLTRB(12, 10, 4, 10),
        decoration: BoxDecoration(
          color: context.handsColors.canvas,
          borderRadius: BorderRadius.circular(HandsShapes.medium),
        ),
        child: Row(
          children: [
            Expanded(
              child: SelectableText(
                link,
                maxLines: 2,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: context.handsColors.ink,
                    ),
              ),
            ),
            IconButton(
              tooltip: referralText(locale, 'copy'),
              onPressed: enabled && link.isNotEmpty ? () => onCopy(link) : null,
              icon: const Icon(Icons.copy_rounded),
            ),
          ],
        ),
      ),
    );
  }
}

class _ReferralSummarySection extends StatelessWidget {
  const _ReferralSummarySection({required this.summary});

  final Map<String, dynamic>? summary;

  @override
  Widget build(BuildContext context) {
    final locale = Localizations.localeOf(context);
    final totals = asMap(summary?['totals']) ?? const <String, dynamic>{};
    final currency = totals['currency']?.toString() ?? 'VND';
    final metrics = [
      (
        label: 'friends',
        value: '${asNum(totals['invitedFriendCount'])?.toInt() ?? 0}'
      ),
      (
        label: 'totalReward',
        value: '${formatCurrency(totals['totalRewardAmount'])} $currency'
      ),
      (
        label: 'processing',
        value: '${formatCurrency(totals['processingAmount'])} $currency'
      ),
      (
        label: 'paidOut',
        value: '${formatCurrency(totals['paidOutAmount'])} $currency'
      ),
    ];
    return _ReferralSection(
      title: referralText(locale, 'details'),
      child: GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: metrics.length,
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          crossAxisSpacing: HandsSpacing.space12,
          mainAxisSpacing: HandsSpacing.space12,
          childAspectRatio: 1.65,
        ),
        itemBuilder: (context, index) => _ReferralMetricCard(
          label: referralText(locale, metrics[index].label),
          value: metrics[index].value,
        ),
      ),
    );
  }
}

class _ReferralMetricCard extends StatelessWidget {
  const _ReferralMetricCard({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(HandsSpacing.space12),
      decoration: BoxDecoration(
        color: context.handsColors.canvas,
        borderRadius: BorderRadius.circular(HandsShapes.medium),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: Theme.of(context).textTheme.bodySmall),
          const Spacer(),
          Text(
            value,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: HandsTypography.numeric(
              Theme.of(context).textTheme.titleMedium,
            ),
          ),
        ],
      ),
    );
  }
}

class _ReferralInviteSection extends StatelessWidget {
  const _ReferralInviteSection({
    required this.rows,
    required this.errorKey,
    required this.loading,
    required this.hasMore,
    required this.onRetry,
    required this.onLoadMore,
  });

  final List<Map<String, dynamic>> rows;
  final String? errorKey;
  final bool loading;
  final bool hasMore;
  final VoidCallback onRetry;
  final VoidCallback onLoadMore;

  @override
  Widget build(BuildContext context) {
    final locale = Localizations.localeOf(context);
    return _ReferralSection(
      title: referralText(locale, 'invitedFriends'),
      child: Column(
        children: [
          if (errorKey != null)
            _ListError(errorKey: errorKey!, onRetry: onRetry)
          else if (!loading && rows.isEmpty)
            HandsEmptyState(
              icon: Icons.group_add_outlined,
              title: referralText(locale, 'invitedFriends'),
              body: referralText(locale, 'noInvites'),
            )
          else
            for (var index = 0; index < rows.length; index++)
              _ReferralInviteRow(
                row: rows[index],
                last: index == rows.length - 1,
              ),
          _ListFooter(
            loading: loading,
            hasMore: hasMore,
            onLoadMore: onLoadMore,
          ),
        ],
      ),
    );
  }
}

class _ReferralInviteRow extends StatelessWidget {
  const _ReferralInviteRow({required this.row, required this.last});

  final Map<String, dynamic> row;
  final bool last;

  @override
  Widget build(BuildContext context) {
    final locale = Localizations.localeOf(context);
    final met = row['rewardConditionMet'] == true;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: HandsSpacing.space16),
      decoration: last
          ? null
          : BoxDecoration(
              border: Border(
                bottom: BorderSide(color: context.handsColors.outline),
              ),
            ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            backgroundColor: context.handsColors.primarySoft,
            child: Icon(
              met ? Icons.check_rounded : Icons.person_outline_rounded,
              color: context.handsColors.primary,
            ),
          ),
          const SizedBox(width: HandsSpacing.space12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  row['displayName']?.toString() ?? '',
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                const SizedBox(height: HandsSpacing.space4),
                Text(
                  referralText(
                    locale,
                    _attributionStatusKey(row['status']?.toString()),
                  ),
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                Text(
                  referralTextWith(locale, 'attributedOn', {
                    'date': _dateLabel(context, row['attributedAt']),
                  }),
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
          Text(
            referralText(
              locale,
              met ? 'conditionMet' : 'conditionPending',
            ),
            textAlign: TextAlign.end,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: met
                      ? context.handsColors.success
                      : context.handsColors.inkMuted,
                ),
          ),
        ],
      ),
    );
  }
}

class _ReferralRewardSection extends StatelessWidget {
  const _ReferralRewardSection({
    required this.rows,
    required this.errorKey,
    required this.loading,
    required this.hasMore,
    required this.cashingOut,
    required this.onCashout,
    required this.onRetry,
    required this.onLoadMore,
  });

  final List<Map<String, dynamic>> rows;
  final String? errorKey;
  final bool loading;
  final bool hasMore;
  final Set<String> cashingOut;
  final ValueChanged<Map<String, dynamic>> onCashout;
  final VoidCallback onRetry;
  final VoidCallback onLoadMore;

  @override
  Widget build(BuildContext context) {
    final locale = Localizations.localeOf(context);
    return _ReferralSection(
      title: referralText(locale, 'rewardDetails'),
      child: Column(
        children: [
          if (errorKey != null)
            _ListError(errorKey: errorKey!, onRetry: onRetry)
          else if (!loading && rows.isEmpty)
            HandsEmptyState(
              icon: Icons.account_balance_wallet_outlined,
              title: referralText(locale, 'rewardDetails'),
              body: referralText(locale, 'noRewards'),
            )
          else
            for (var index = 0; index < rows.length; index++)
              _ReferralRewardRow(
                row: rows[index],
                last: index == rows.length - 1,
                loading: cashingOut.contains(rows[index]['id']?.toString()),
                onCashout: () => onCashout(rows[index]),
              ),
          _ListFooter(
            loading: loading,
            hasMore: hasMore,
            onLoadMore: onLoadMore,
          ),
        ],
      ),
    );
  }
}

class _ReferralRewardRow extends StatelessWidget {
  const _ReferralRewardRow({
    required this.row,
    required this.last,
    required this.loading,
    required this.onCashout,
  });

  final Map<String, dynamic> row;
  final bool last;
  final bool loading;
  final VoidCallback onCashout;

  @override
  Widget build(BuildContext context) {
    final locale = Localizations.localeOf(context);
    final currency = row['currency']?.toString() ?? 'VND';
    final canCashout = row['canRequestCashout'] == true;
    final bookingReference = row['bookingReference']?.toString();
    final availableAt = row['availableAt'];
    final unavailableReason = row['cashoutUnavailableReason']?.toString();
    return Container(
      padding: const EdgeInsets.symmetric(vertical: HandsSpacing.space16),
      decoration: last
          ? null
          : BoxDecoration(
              border: Border(
                bottom: BorderSide(color: context.handsColors.outline),
              ),
            ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  '${formatCurrency(row['amount'])} $currency',
                  style: HandsTypography.numeric(
                    Theme.of(context).textTheme.titleMedium,
                  ),
                ),
              ),
              Text(
                referralText(
                  locale,
                  _rewardStatusKey(row['status']?.toString()),
                ),
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: context.handsColors.primary,
                    ),
              ),
            ],
          ),
          const SizedBox(height: HandsSpacing.space4),
          Text(
            _dateLabel(context, row['createdAt']),
            style: Theme.of(context).textTheme.bodySmall,
          ),
          if (bookingReference != null && bookingReference.isNotEmpty)
            Text(
              referralTextWith(
                locale,
                'booking',
                {'reference': bookingReference},
              ),
              style: Theme.of(context).textTheme.bodySmall,
            ),
          if (availableAt != null)
            Text(
              referralTextWith(
                locale,
                'availableOn',
                {'date': _dateLabel(context, availableAt)},
              ),
              style: Theme.of(context).textTheme.bodySmall,
            ),
          if (unavailableReason == 'WALLET_BALANCE') ...[
            const SizedBox(height: HandsSpacing.space8),
            Text(
              referralText(locale, 'cashoutBalance'),
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: context.handsColors.warning,
                  ),
            ),
          ],
          if (canCashout) ...[
            const SizedBox(height: HandsSpacing.space12),
            Align(
              alignment: AlignmentDirectional.centerEnd,
              child: FilledButton.tonal(
                onPressed: loading ? null : onCashout,
                child: loading
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text(referralText(locale, 'cashout')),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ReferralClaimSection extends StatelessWidget {
  const _ReferralClaimSection({
    required this.controller,
    required this.enabled,
    required this.loading,
    required this.onSubmit,
  });

  final TextEditingController controller;
  final bool enabled;
  final bool loading;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    final locale = Localizations.localeOf(context);
    return _ReferralSection(
      child: ExpansionTile(
        tilePadding: EdgeInsets.zero,
        childrenPadding: const EdgeInsets.only(bottom: HandsSpacing.space8),
        title: Text(referralText(locale, 'haveCode')),
        subtitle: Text(referralText(locale, 'claimHelp')),
        children: [
          TextField(
            controller: controller,
            enabled: enabled,
            textCapitalization: TextCapitalization.characters,
            decoration: InputDecoration(
              labelText: referralText(locale, 'codeLabel'),
            ),
          ),
          const SizedBox(height: HandsSpacing.space12),
          SizedBox(
            width: double.infinity,
            child: FilledButton.tonal(
              onPressed: enabled ? onSubmit : null,
              child: loading
                  ? const SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Text(referralText(locale, 'apply')),
            ),
          ),
        ],
      ),
    );
  }
}

class _ReferralSection extends StatelessWidget {
  const _ReferralSection({this.title, required this.child});

  final String? title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: HandsSpacing.space8),
      padding: const EdgeInsets.all(CustomerSpacing.page),
      color: context.handsColors.surface,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (title != null) ...[
            Text(title!, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: HandsSpacing.space16),
          ],
          child,
        ],
      ),
    );
  }
}

class _ListError extends StatelessWidget {
  const _ListError({required this.errorKey, required this.onRetry});

  final String errorKey;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final locale = Localizations.localeOf(context);
    return Column(
      children: [
        ErrorPanel(text: referralText(locale, errorKey)),
        const SizedBox(height: HandsSpacing.space12),
        OutlinedButton(
          onPressed: onRetry,
          child: Text(referralText(locale, 'retry')),
        ),
      ],
    );
  }
}

class _ListFooter extends StatelessWidget {
  const _ListFooter({
    required this.loading,
    required this.hasMore,
    required this.onLoadMore,
  });

  final bool loading;
  final bool hasMore;
  final VoidCallback onLoadMore;

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const Padding(
        padding: EdgeInsets.all(HandsSpacing.space16),
        child: Center(child: CircularProgressIndicator()),
      );
    }
    if (!hasMore) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: HandsSpacing.space12),
      child: OutlinedButton(
        onPressed: onLoadMore,
        child: Text(
          referralText(Localizations.localeOf(context), 'loadMore'),
        ),
      ),
    );
  }
}

String buildReferralShareUrl({
  required String baseUrl,
  required String sharePath,
}) {
  final base = Uri.tryParse(baseUrl.trim());
  if (base == null || !base.hasScheme || base.host.isEmpty) return '';
  final path = sharePath.trim();
  if (path.isEmpty) return '';
  final absolute = Uri.tryParse(path);
  if (absolute != null && absolute.hasScheme && absolute.host.isNotEmpty) {
    return absolute.toString();
  }
  return base.resolve(path).toString();
}

String referralCashoutErrorKey(Object exception) {
  if (exception is ApiException) {
    final message = exception.body['message']?.toString().toLowerCase() ?? '';
    if (message.contains('already') || message.contains('state changed')) {
      return 'cashoutAlready';
    }
    if (message.contains('balance')) return 'cashoutBalance';
    if (message.contains('only credited') || message.contains('requires')) {
      return 'cashoutUnavailable';
    }
  }
  return 'cashoutError';
}

List<String> _policyLines(
  Locale locale,
  Map<String, dynamic>? policy,
) {
  if (policy == null) return const [];
  final currency = policy['currency']?.toString() ?? 'VND';
  final lines = <String>[];
  if (policy['rewardMode'] == 'COMMISSION_PERCENT') {
    final bps = asNum(policy['commissionPercentBps'])?.toInt();
    if (bps != null && bps > 0) {
      lines.add(referralTextWith(locale, 'policyPercent', {
        'value': _percentLabel(bps),
      }));
    }
  } else {
    final amount = asNum(policy['fixedRewardAmount'])?.toInt();
    if (amount != null && amount > 0) {
      lines.add(referralTextWith(locale, 'policyFixed', {
        'value': formatCurrency(amount),
        'currency': currency,
      }));
    }
  }
  final holdDays = asNum(policy['holdPeriodDays'])?.toInt();
  if (holdDays != null && holdDays > 0) {
    lines.add(referralTextWith(locale, 'policyHold', {'days': holdDays}));
  }
  final maxFriends = asNum(policy['maxRewardedReferrals'])?.toInt();
  if (maxFriends != null && maxFriends > 0) {
    lines.add(
      referralTextWith(locale, 'policyMaxFriends', {'count': maxFriends}),
    );
  }
  final maxRewards = asNum(policy['maxRewardsPerReferred'])?.toInt();
  if (maxRewards != null && maxRewards > 0) {
    lines.add(
      referralTextWith(locale, 'policyMaxRewards', {'count': maxRewards}),
    );
  }
  final perCap = asNum(policy['perRewardCapAmount'])?.toInt();
  if (perCap != null && perCap > 0) {
    lines.add(referralTextWith(locale, 'policyPerCap', {
      'value': formatCurrency(perCap),
      'currency': currency,
    }));
  }
  final totalCap = asNum(policy['totalRewardCapAmount'])?.toInt();
  if (totalCap != null && totalCap > 0) {
    lines.add(referralTextWith(locale, 'policyTotalCap', {
      'value': formatCurrency(totalCap),
      'currency': currency,
    }));
  }
  return lines;
}

String _percentLabel(int bps) {
  final value = bps / 100;
  return value == value.roundToDouble()
      ? value.toInt().toString()
      : value.toStringAsFixed(2).replaceFirst(RegExp(r'0+$'), '');
}

String _dateLabel(BuildContext context, dynamic value) {
  final date = DateTime.tryParse(value?.toString() ?? '');
  return date == null
      ? '-'
      : MaterialLocalizations.of(context).formatMediumDate(date.toLocal());
}

String _attributionStatusKey(String? status) {
  return switch (status) {
    'QUALIFIED' => 'statusQualified',
    'REWARDED' => 'statusRewarded',
    'BLOCKED' => 'statusBlocked',
    'CANCELLED' => 'statusCancelled',
    _ => 'statusRegistered',
  };
}

String _rewardStatusKey(String? status) {
  return switch (status) {
    'AVAILABLE' || 'APPROVED' => 'rewardAvailable',
    'CREDITED' || 'REWARDED' => 'rewardCredited',
    'USED_FOR_SERVICE' || 'OFFSET' => 'rewardUsed',
    'CASHOUT_REQUESTED' => 'rewardCashoutRequested',
    'CASHOUT_APPROVED' => 'rewardCashoutApproved',
    'PAID' => 'rewardPaid',
    'HELD' || 'LOCKED' => 'rewardHeld',
    'REVERSED' => 'rewardReversed',
    'CANCELLED' => 'rewardCancelled',
    'TAX_REVIEW_REQUIRED' => 'rewardReview',
    _ => 'rewardPending',
  };
}
