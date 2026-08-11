import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../app_state.dart';
import '../../../core/app_config.dart';
import '../../../core/customer_design_system.dart';
import '../../../core/customer_error_message.dart';
import '../../../core/customer_locale.dart';
import '../../../core/customer_value_helpers.dart';
import '../../../core/mobile_app_version.dart';
import '../../../core/widgets/customer_app_chrome.dart';
import '../../../core/widgets/customer_feedback_panels.dart';
import '../../booking/presentation/customer_bookings_screen.dart';
import '../../map/presentation/customer_location_helpers.dart';
import '../../map/presentation/customer_map_widgets.dart';
import '../../notification/presentation/customer_notification_screen.dart';
import '../../referral/presentation/customer_referral_screen.dart';

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key, this.openWalletOnLoad = false});

  final bool openWalletOnLoad;

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  Map<String, dynamic> wallet = const {
    'balance': 0,
    'currency': 'VND',
    'entries': <dynamic>[],
  };
  bool walletLoading = false;
  String? walletError;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      await _loadWallet();
      if (mounted &&
          widget.openWalletOnLoad &&
          ref.read(authControllerProvider) != null) {
        await _showWalletSheet(context, wallet);
      }
    });
  }

  Future<void> _loadWallet() async {
    if (ref.read(authControllerProvider) == null) {
      return;
    }
    setState(() {
      walletLoading = true;
      walletError = null;
    });
    try {
      final result = await ref.read(customerRepositoryProvider).getWallet();
      if (mounted) {
        setState(() => wallet = result);
      }
    } catch (exception) {
      if (mounted) {
        setState(() => walletError = customerErrorMessage(exception));
      }
    } finally {
      if (mounted) {
        setState(() => walletLoading = false);
      }
    }
  }

  Future<void> _editProfile(Map<String, dynamic> user) async {
    final customerProfile = asMap(user['customerProfile']);
    final fullName = TextEditingController(
      text: user['fullName']?.toString() ?? user['name']?.toString() ?? '',
    );
    final email = TextEditingController(text: user['email']?.toString() ?? '');
    final nationality = TextEditingController(
      text: customerProfile?['nationality']?.toString() ?? '',
    );
    var gender = customerProfile?['gender']?.toString() ?? 'not_specified';
    final formKey = GlobalKey<FormState>();
    final values = await showDialog<
        ({String fullName, String email, String gender, String nationality})>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Edit profile'),
          content: Form(
            key: formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextFormField(
                  controller: fullName,
                  autofocus: true,
                  maxLength: 160,
                  decoration: const InputDecoration(labelText: 'Full name'),
                  validator: (value) => value == null || value.trim().isEmpty
                      ? 'Enter your name.'
                      : null,
                ),
                TextFormField(
                  controller: email,
                  keyboardType: TextInputType.emailAddress,
                  maxLength: 254,
                  decoration: const InputDecoration(labelText: 'Email'),
                  validator: (value) {
                    final normalized = value?.trim() ?? '';
                    if (normalized.isEmpty) return null;
                    return normalized.contains('@')
                        ? null
                        : 'Enter a valid email.';
                  },
                ),
                DropdownButtonFormField<String>(
                  initialValue: gender,
                  decoration: const InputDecoration(labelText: 'Gender'),
                  items: const [
                    DropdownMenuItem(value: 'female', child: Text('Female')),
                    DropdownMenuItem(value: 'male', child: Text('Male')),
                    DropdownMenuItem(value: 'other', child: Text('Other')),
                    DropdownMenuItem(
                      value: 'not_specified',
                      child: Text('Prefer not to say'),
                    ),
                  ],
                  onChanged: (value) {
                    if (value != null) setDialogState(() => gender = value);
                  },
                ),
                TextFormField(
                  controller: nationality,
                  maxLength: 80,
                  decoration: const InputDecoration(
                    labelText: 'Nationality',
                    hintText: 'For partner request details',
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () {
                if (formKey.currentState?.validate() != true) return;
                Navigator.of(context).pop((
                  fullName: fullName.text.trim(),
                  email: email.text.trim(),
                  gender: gender,
                  nationality: nationality.text.trim(),
                ));
              },
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );
    fullName.dispose();
    email.dispose();
    nationality.dispose();
    if (values == null || !mounted) return;

    try {
      final session = await ref.read(authRepositoryProvider).updateProfile(
            fullName: values.fullName,
            email: values.email,
            gender: values.gender,
            nationality: values.nationality,
          );
      ref.read(authControllerProvider.notifier).replaceSession(session);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Profile updated.')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Profile could not be updated.')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    final user = auth?.user ?? const <String, dynamic>{};
    final name = _userLabel(user);
    final rawContact = user['email']?.toString() ??
        user['phone']?.toString() ??
        'Customer account';
    final contact =
        rawContact.trim() == name.trim() ? 'HANDS customer' : rawContact;
    final walletBalance = asNum(wallet['balance'])?.toInt() ?? 0;
    final walletCurrency = wallet['currency']?.toString() ?? 'VND';

    return HandsScaffold(
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            _MoreProfileHeader(
              name: name,
              contact: contact,
              onTap: auth == null ? null : () => _editProfile(user),
            ),
            _MoreMenuRow(
              icon: Icons.calendar_month_outlined,
              label: 'My bookings',
              onTap: auth == null
                  ? null
                  : () => Navigator.of(context).push<void>(
                        MaterialPageRoute(
                          builder: (context) => const BookingsScreen(),
                        ),
                      ),
            ),
            _MoreMenuRow(
              icon: Icons.account_balance_wallet_outlined,
              label: 'Wallet',
              value: walletLoading
                  ? 'Loading'
                  : '${formatCurrency(walletBalance)} $walletCurrency',
              onTap: auth == null
                  ? null
                  : () {
                      if (walletError != null) {
                        _loadWallet();
                      }
                      _showWalletSheet(context, wallet);
                    },
            ),
            _MoreMenuRow(
              icon: Icons.location_on_outlined,
              label: 'My addresses',
              onTap: auth == null ? null : () => _openAddressSelector(context),
            ),
            _MoreMenuRow(
              icon: Icons.notifications_none_rounded,
              label: 'Notifications',
              onTap: auth == null
                  ? null
                  : () => Navigator.of(context).push<void>(
                        MaterialPageRoute(
                          builder: (context) =>
                              const CustomerNotificationScreen(),
                        ),
                      ),
            ),
            _MoreMenuRow(
              icon: Icons.card_giftcard_outlined,
              label: 'Refer a friend',
              onTap: auth == null
                  ? null
                  : () async {
                      await Navigator.of(context).push<void>(
                        MaterialPageRoute(
                          builder: (context) => const CustomerReferralScreen(),
                        ),
                      );
                      await _loadWallet();
                    },
            ),
            _MoreMenuRow(
              icon: Icons.translate_rounded,
              label: 'Language',
              value: _languageLabel(ref.watch(customerLocaleProvider)),
              onTap: () => _showLanguageSheet(context, ref),
            ),
            _MoreMenuRow(
              icon: Icons.support_agent_outlined,
              label: 'Support',
              onTap: () => _contactSupport(context),
            ),
            _MoreMenuRow(
              icon: Icons.category_outlined,
              label: 'About the app',
              onTap: () => _showInfo(
                context,
                title: 'About HANDS',
                body:
                    'HANDS connects customers with verified on-demand wellness Partners in Vietnam.\n\nVersion $currentCustomerAppVersion',
              ),
            ),
            if (auth != null)
              _MoreMenuRow(
                icon: Icons.logout_rounded,
                label: 'Sign out',
                destructive: true,
                showArrow: false,
                onTap: () => _signOut(context, ref),
              ),
          ],
        ),
      ),
    );
  }
}

Future<void> _contactSupport(BuildContext context) async {
  final opened = await launchUrl(
    Uri(
      scheme: 'mailto',
      path: AppConfig.supportEmail,
      queryParameters: const {'subject': 'HANDS customer support'},
    ),
    mode: LaunchMode.externalApplication,
  );
  if (!opened && context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('No email app is available.')),
    );
  }
}

class _MoreProfileHeader extends StatelessWidget {
  const _MoreProfileHeader({
    required this.name,
    required this.contact,
    required this.onTap,
  });

  final String name;
  final String contact;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.handsColors;
    final initial = _avatarInitial(name);
    return Material(
      color: colors.surface,
      child: InkWell(
        onTap: onTap,
        child: Container(
          height: 112,
          padding: const EdgeInsets.symmetric(horizontal: 20),
          foregroundDecoration: BoxDecoration(
            border: Border(bottom: BorderSide(color: colors.outline)),
          ),
          child: Row(
            children: [
              CircleAvatar(
                radius: 30,
                backgroundColor: colors.photoMatte,
                child: initial.isEmpty
                    ? Icon(
                        Icons.person_outline_rounded,
                        size: 29,
                        color: colors.primary,
                      )
                    : Text(
                        initial,
                        style: TextStyle(
                          color: colors.primary,
                          fontSize: 20,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
              ),
              const SizedBox(width: 18),
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      contact,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: colors.inkMuted,
                          ),
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.arrow_circle_right_outlined,
                color: colors.primary,
                size: 22,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

String _avatarInitial(String value) {
  final trimmed = value.trim();
  if (trimmed.isEmpty) return '';
  final first = trimmed.characters.first.toUpperCase();
  return RegExp(r'[A-Z]').hasMatch(first) ? first : '';
}

class _MoreMenuRow extends StatelessWidget {
  const _MoreMenuRow({
    required this.icon,
    required this.label,
    required this.onTap,
    this.destructive = false,
    this.showArrow = true,
    this.value,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  final bool destructive;
  final bool showArrow;
  final String? value;

  @override
  Widget build(BuildContext context) {
    final colors = context.handsColors;
    final color = destructive ? colors.error : colors.ink;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: InkWell(
        onTap: onTap,
        child: Container(
          height: 63,
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(color: colors.outline),
            ),
          ),
          child: Row(
            children: [
              Icon(icon, size: 23, color: color),
              const SizedBox(width: 16),
              Expanded(
                child: Text(
                  label,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: color,
                      ),
                ),
              ),
              if (value != null) ...[
                const SizedBox(width: 12),
                Text(
                  value!,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: colors.inkMuted,
                        fontWeight: FontWeight.w600,
                      ),
                ),
              ],
              if (showArrow)
                Icon(
                  Icons.arrow_circle_right_outlined,
                  size: 21,
                  color: onTap == null ? colors.inkMuted : color,
                ),
            ],
          ),
        ),
      ),
    );
  }
}

Future<void> _showWalletSheet(
  BuildContext context,
  Map<String, dynamic> wallet,
) {
  final balance = asNum(wallet['balance'])?.toInt() ?? 0;
  final currency = wallet['currency']?.toString() ?? 'VND';
  final entries = wallet['entries'] is List
      ? (wallet['entries'] as List)
          .whereType<Map>()
          .map((entry) => Map<String, dynamic>.from(entry))
          .toList()
      : <Map<String, dynamic>>[];

  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Theme.of(context).colorScheme.surface,
    builder: (context) => FractionallySizedBox(
      heightFactor: 0.72,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 12, 12),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    'Wallet',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  tooltip: 'Close wallet',
                  icon: const Icon(Icons.close_rounded),
                ),
              ],
            ),
          ),
          Builder(
            builder: (context) {
              final colors = context.handsColors;
              return Container(
                width: double.infinity,
                margin: const EdgeInsets.fromLTRB(20, 4, 20, 20),
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: colors.primarySoft,
                  borderRadius: BorderRadius.circular(HandsShapes.large),
                  border: Border.all(color: colors.outline),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Available balance',
                      style: TextStyle(
                        color: colors.inkMuted,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '${formatCurrency(balance)} $currency',
                      style:
                          Theme.of(context).textTheme.headlineMedium?.copyWith(
                                color: colors.ink,
                                fontWeight: FontWeight.w800,
                              ),
                    ),
                  ],
                ),
              );
            },
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'Recent activity',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
              ),
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: entries.isEmpty
                ? Center(
                    child: Text(
                      'No wallet activity yet.',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: context.handsColors.inkMuted,
                          ),
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                    itemCount: entries.length,
                    separatorBuilder: (_, __) =>
                        Divider(height: 1, color: context.handsColors.outline),
                    itemBuilder: (context, index) =>
                        _WalletActivityRow(entry: entries[index]),
                  ),
          ),
        ],
      ),
    ),
  );
}

class _WalletActivityRow extends StatelessWidget {
  const _WalletActivityRow({required this.entry});

  final Map<String, dynamic> entry;

  @override
  Widget build(BuildContext context) {
    final colors = context.handsColors;
    final amount = asNum(entry['amount'])?.toInt() ?? 0;
    final currency = entry['currency']?.toString() ?? 'VND';
    final positive = amount >= 0;
    final createdAt = DateTime.tryParse(entry['createdAt']?.toString() ?? '');

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 14),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: positive
                  ? colors.success.withValues(alpha: 0.12)
                  : colors.error.withValues(alpha: 0.12),
            ),
            child: Icon(
              positive ? Icons.add_rounded : Icons.remove_rounded,
              color: positive ? colors.success : colors.error,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _walletActivityLabel(entry['type']?.toString()),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const SizedBox(height: 3),
                Text(
                  _walletActivityDate(createdAt),
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: colors.inkMuted,
                      ),
                ),
              ],
            ),
          ),
          Text(
            '${positive ? '+' : ''}${formatCurrency(amount)} $currency',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: positive ? colors.success : colors.error,
                  fontWeight: FontWeight.w800,
                ),
          ),
        ],
      ),
    );
  }
}

Future<void> _openAddressSelector(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => const _SavedAddressesSheet(),
  );
}

class _SavedAddressesSheet extends ConsumerStatefulWidget {
  const _SavedAddressesSheet();

  @override
  ConsumerState<_SavedAddressesSheet> createState() =>
      _SavedAddressesSheetState();
}

class _SavedAddressesSheetState extends ConsumerState<_SavedAddressesSheet> {
  List<Map<String, dynamic>> _locations = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    Future.microtask(_load);
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final locations =
          await ref.read(customerRepositoryProvider).listSavedLocations();
      if (mounted) setState(() => _locations = locations);
    } catch (_) {
      if (mounted) setState(() => _error = 'Addresses could not be loaded.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _add() async {
    final selected = ref.read(selectedCustomerLocationProvider);
    final next = await Navigator.of(context).push<SelectedCustomerLocation>(
      MaterialPageRoute(
        builder: (context) => LocationSelectionPage(
          initialLatitude: selected?.latitude ?? demoCustomerLat,
          initialLongitude: selected?.longitude ?? demoCustomerLng,
          initialAddress: selected?.addressText ?? '',
        ),
      ),
    );
    if (next == null || !mounted) return;

    try {
      final saved =
          await ref.read(customerRepositoryProvider).saveSelectedLocation(
                lat: next.latitude,
                lng: next.longitude,
                addressText: next.addressText,
              );
      final savedLocation =
          next.copyWith(id: saved?['id']?.toString() ?? next.id);
      ref.read(selectedCustomerLocationProvider.notifier).state = savedLocation;
      await _load();
    } catch (_) {
      if (mounted) setState(() => _error = 'Address could not be saved.');
    }
  }

  void _select(Map<String, dynamic> location) {
    final latitude = double.tryParse(location['latitude']?.toString() ?? '');
    final longitude = double.tryParse(location['longitude']?.toString() ?? '');
    final address = location['addressText']?.toString().trim() ?? '';
    if (latitude == null || longitude == null || address.isEmpty) return;
    ref.read(selectedCustomerLocationProvider.notifier).state =
        SelectedCustomerLocation(
      id: location['id']?.toString(),
      latitude: latitude,
      longitude: longitude,
      addressText: address,
    );
    Navigator.of(context).pop();
  }

  Future<void> _delete(String id) async {
    try {
      await ref.read(customerRepositoryProvider).deleteSavedLocation(id);
      if (ref.read(selectedCustomerLocationProvider)?.id == id) {
        ref.read(selectedCustomerLocationProvider.notifier).state = null;
      }
      await _load();
    } catch (_) {
      if (mounted) setState(() => _error = 'Address could not be deleted.');
    }
  }

  @override
  Widget build(BuildContext context) {
    return FractionallySizedBox(
      heightFactor: 0.82,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 8, 12),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    'My addresses',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
                IconButton(
                  tooltip: 'Add address',
                  onPressed: _loading ? null : _add,
                  icon: const Icon(Icons.add_location_alt_outlined),
                ),
                IconButton(
                  tooltip: 'Close',
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close_rounded),
                ),
              ],
            ),
          ),
          if (_loading) const LinearProgressIndicator(),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.all(20),
              child: ErrorPanel(text: _error!),
            ),
          Expanded(
            child: !_loading && _locations.isEmpty
                ? Center(
                    child: FilledButton.icon(
                      onPressed: _add,
                      icon: const Icon(Icons.add_location_alt_outlined),
                      label: const Text('Add address'),
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.fromLTRB(12, 8, 12, 24),
                    itemCount: _locations.length,
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (context, index) {
                      final location = _locations[index];
                      final id = location['id']?.toString() ?? '';
                      return ListTile(
                        onTap: () => _select(location),
                        leading: const Icon(Icons.location_on_outlined),
                        title: Text(
                          location['addressText']?.toString() ??
                              'Saved address',
                        ),
                        trailing: IconButton(
                          tooltip: 'Delete address',
                          onPressed: id.isEmpty ? null : () => _delete(id),
                          icon: const Icon(Icons.delete_outline_rounded),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}

Future<void> _showLanguageSheet(BuildContext context, WidgetRef ref) {
  const languages = [
    (locale: Locale('vi'), label: 'Tiếng Việt'),
    (locale: Locale('en'), label: 'English'),
    (locale: Locale('ko'), label: 'Korean'),
    (locale: Locale('ja'), label: '日本語'),
    (locale: Locale('zh'), label: '中文'),
  ];
  return showModalBottomSheet<void>(
    context: context,
    builder: (context) => Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Language', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          for (final language in languages)
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(language.label),
              trailing: ref.read(customerLocaleProvider) == language.locale
                  ? Icon(
                      Icons.check_circle,
                      color: context.handsColors.success,
                    )
                  : null,
              onTap: () async {
                await ref
                    .read(customerLocaleProvider.notifier)
                    .setLocale(language.locale);
                if (context.mounted) Navigator.of(context).pop();
              },
            ),
        ],
      ),
    ),
  );
}

String _languageLabel(Locale locale) {
  return switch (locale.languageCode) {
    'vi' => 'Tiếng Việt',
    'ko' => 'Korean',
    'ja' => '日本語',
    'zh' => '中文',
    _ => 'English',
  };
}

Future<void> _showInfo(
  BuildContext context, {
  required String title,
  required String body,
}) {
  return showDialog<void>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(title),
      content: Text(body),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Close'),
        ),
      ],
    ),
  );
}

String _walletActivityLabel(String? type) {
  switch (type) {
    case 'REFERRAL_REWARD':
    case 'CUSTOMER_REFERRAL_EARNED':
      return 'Referral reward';
    case 'CUSTOMER_REFERRAL_TAX_WITHHELD':
      return 'Referral tax';
    case 'CUSTOMER_REFERRAL_USED_FOR_SERVICE':
    case 'CUSTOMER_WALLET_PAYMENT':
      return 'Service payment';
    case 'CUSTOMER_REFERRAL_CASHOUT':
      return 'Wallet cashout';
    case 'CUSTOMER_REFERRAL_REVERSED':
      return 'Referral reversal';
    case 'REFUND':
      return 'Refund';
    case 'ADMIN_ADJUSTMENT':
      return 'Wallet adjustment';
    default:
      return 'Wallet activity';
  }
}

String _walletActivityDate(DateTime? value) {
  if (value == null) {
    return 'Date unavailable';
  }
  final local = value.toLocal();
  final month = local.month.toString().padLeft(2, '0');
  final day = local.day.toString().padLeft(2, '0');
  final hour = local.hour.toString().padLeft(2, '0');
  final minute = local.minute.toString().padLeft(2, '0');
  return '${local.year}-$month-$day $hour:$minute';
}

Future<void> _signOut(BuildContext context, WidgetRef ref) async {
  try {
    await ref.read(unregisterCurrentDevicePushTokenProvider).call();
  } catch (_) {
    // Local credential cleanup must continue when push unregister fails.
  }
  await ref.read(authControllerProvider.notifier).signOut();
  if (context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Signed out.')),
    );
  }
}

String _userLabel(Map<String, dynamic> user) {
  final candidates = [
    user['displayName'],
    user['name'],
    user['phone'],
  ];
  for (final candidate in candidates) {
    final value = candidate?.toString().trim() ?? '';
    if (value.isNotEmpty) return value;
  }
  return 'HANDS Customer';
}
