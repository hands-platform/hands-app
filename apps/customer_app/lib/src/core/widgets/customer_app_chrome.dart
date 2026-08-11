import 'package:flutter/material.dart';

import '../customer_design_system.dart';

class CustomerBottomNavigation extends StatelessWidget {
  const CustomerBottomNavigation({
    super.key,
    required this.index,
    required this.onSelected,
  });

  final int index;
  final ValueChanged<int> onSelected;

  @override
  Widget build(BuildContext context) {
    final colors = context.handsColors;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surface,
        border: Border(top: BorderSide(color: colors.outline)),
      ),
      child: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: onSelected,
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home_rounded),
            label: 'Home',
          ),
          NavigationDestination(
            icon: Icon(Icons.calendar_month_outlined),
            selectedIcon: Icon(Icons.calendar_month_rounded),
            label: 'Booking',
          ),
          NavigationDestination(
            icon: Icon(Icons.apps_outlined),
            selectedIcon: Icon(Icons.apps_rounded),
            label: 'More',
          ),
        ],
      ),
    );
  }
}

class HandsScaffold extends StatelessWidget {
  const HandsScaffold({
    super.key,
    required this.body,
    this.appBar,
    this.bottomNavigationBar,
    this.floatingActionButton,
  });

  final Widget body;
  final PreferredSizeWidget? appBar;
  final Widget? bottomNavigationBar;
  final Widget? floatingActionButton;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.handsColors.canvas,
      appBar: appBar,
      body: body,
      bottomNavigationBar: bottomNavigationBar,
      floatingActionButton: floatingActionButton,
    );
  }
}

class HandsTopBar extends StatelessWidget implements PreferredSizeWidget {
  const HandsTopBar({
    super.key,
    this.title,
    this.leading,
    this.actions,
  });

  final String? title;
  final Widget? leading;
  final List<Widget>? actions;

  @override
  Size get preferredSize => const Size.fromHeight(64);

  @override
  Widget build(BuildContext context) {
    return AppBar(
      leading: leading,
      title: title == null ? null : Text(title!),
      actions: actions,
    );
  }
}

class HandsEmptyState extends StatelessWidget {
  const HandsEmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.body,
    this.action,
  });

  final IconData icon;
  final String title;
  final String body;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final colors = context.handsColors;
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: HandsSpacing.space24,
        vertical: HandsSpacing.space48,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: HandsIconTheme.emptyState, color: colors.primary),
          const SizedBox(height: HandsSpacing.space24),
          Text(
            title,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.headlineMedium,
          ),
          const SizedBox(height: HandsSpacing.space8),
          Text(
            body,
            textAlign: TextAlign.center,
            style: Theme.of(context)
                .textTheme
                .bodyLarge
                ?.copyWith(color: colors.inkMuted),
          ),
          if (action != null) ...[
            const SizedBox(height: HandsSpacing.space24),
            action!,
          ],
        ],
      ),
    );
  }
}

class HandsPageBody extends StatelessWidget {
  const HandsPageBody({
    super.key,
    required this.slivers,
    this.controller,
  });

  final List<Widget> slivers;
  final ScrollController? controller;

  @override
  Widget build(BuildContext context) {
    final page = HandsSpacing.screenMargin(MediaQuery.sizeOf(context).width);
    return CustomScrollView(
      controller: controller,
      slivers: [
        SliverPadding(
          padding: EdgeInsets.fromLTRB(
            page,
            HandsSpacing.space24,
            page,
            HandsSpacing.space40,
          ),
          sliver: SliverList.list(children: slivers),
        ),
      ],
    );
  }
}

class CustomerAddressBar extends StatelessWidget {
  const CustomerAddressBar({
    super.key,
    required this.address,
    required this.onTap,
    this.onProfileTap,
    this.profileLabel,
  });

  final String address;
  final VoidCallback onTap;
  final VoidCallback? onProfileTap;
  final String? profileLabel;

  @override
  Widget build(BuildContext context) {
    final colors = context.handsColors;
    return Material(
      color: colors.surface,
      child: SizedBox(
        height: 64,
        child: Row(
          children: [
            const SizedBox(width: HandsSpacing.space20),
            const SizedBox(width: HandsIconTheme.touchTarget),
            Expanded(
              child: InkWell(
                onTap: onTap,
                borderRadius: BorderRadius.circular(HandsShapes.medium),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: HandsSpacing.space8,
                    vertical: HandsSpacing.space12,
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Flexible(
                        child: Text(
                          address.isEmpty ? 'Choose service address' : address,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style:
                              Theme.of(context).textTheme.bodyMedium?.copyWith(
                                    fontWeight: FontWeight.w500,
                                  ),
                        ),
                      ),
                      const SizedBox(width: HandsSpacing.space4),
                      const Icon(
                        Icons.keyboard_arrow_down_rounded,
                        size: HandsIconTheme.inline,
                      ),
                    ],
                  ),
                ),
              ),
            ),
            IconButton(
              onPressed: onProfileTap,
              tooltip: 'Profile',
              icon: CircleAvatar(
                radius: 15,
                backgroundColor: colors.photoMatte,
                child: _profileInitial(profileLabel).isEmpty
                    ? Icon(
                        Icons.person_outline_rounded,
                        size: 17,
                        color: colors.primary,
                      )
                    : Text(
                        _profileInitial(profileLabel),
                        style: TextStyle(
                          color: colors.primary,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
              ),
            ),
            const SizedBox(width: HandsSpacing.space4),
          ],
        ),
      ),
    );
  }
}

String _profileInitial(String? value) {
  final trimmed = value?.trim() ?? '';
  if (trimmed.isEmpty) return '';
  final first = trimmed.characters.first.toUpperCase();
  return RegExp(r'[A-Z]').hasMatch(first) ? first : '';
}

enum CustomerAddressSheetAction { addNew }

Future<CustomerAddressSheetAction?> showCustomerAddressSheet({
  required BuildContext context,
  required String currentAddress,
}) {
  return showModalBottomSheet<CustomerAddressSheetAction>(
    context: context,
    useSafeArea: true,
    isScrollControlled: true,
    builder: (context) => _CustomerAddressSheet(
      currentAddress: currentAddress,
    ),
  );
}

class _CustomerAddressSheet extends StatelessWidget {
  const _CustomerAddressSheet({required this.currentAddress});

  final String currentAddress;

  @override
  Widget build(BuildContext context) {
    final visibleAddress = currentAddress.trim();
    final colors = context.handsColors;
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        HandsSpacing.space20,
        HandsSpacing.space24,
        HandsSpacing.space20,
        HandsSpacing.space32,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'SELECT AN ADDRESS',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: colors.inkMuted,
                  fontWeight: FontWeight.w500,
                ),
          ),
          const SizedBox(height: HandsSpacing.space16),
          if (visibleAddress.isNotEmpty) ...[
            _AddressSheetRow(
              icon: Icons.location_on_outlined,
              label: visibleAddress,
              selected: true,
              onTap: () => Navigator.of(context).pop(),
            ),
            const Divider(),
          ],
          _AddressSheetRow(
            icon: Icons.add_circle_outline,
            label: 'Add new address',
            onTap: () =>
                Navigator.of(context).pop(CustomerAddressSheetAction.addNew),
          ),
        ],
      ),
    );
  }
}

class _AddressSheetRow extends StatelessWidget {
  const _AddressSheetRow({
    required this.icon,
    required this.label,
    required this.onTap,
    this.selected = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final colors = context.handsColors;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(HandsShapes.medium),
      child: SizedBox(
        height: 56,
        child: Row(
          children: [
            Icon(icon, size: 22),
            const SizedBox(width: HandsSpacing.space16),
            Expanded(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ),
            if (selected)
              Container(
                width: 20,
                height: 20,
                padding: const EdgeInsets.all(3),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: colors.outline),
                ),
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: colors.success,
                  ),
                ),
              )
            else
              const Icon(
                Icons.arrow_forward_rounded,
                size: HandsIconTheme.inline,
              ),
          ],
        ),
      ),
    );
  }
}

class CustomerPageHeader extends StatelessWidget {
  const CustomerPageHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.trailing,
  });

  final String title;
  final String? subtitle;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final colors = context.handsColors;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: Theme.of(context).textTheme.headlineMedium),
              if (subtitle != null) ...[
                const SizedBox(height: HandsSpacing.space8),
                Text(
                  subtitle!,
                  style: Theme.of(context)
                      .textTheme
                      .bodyMedium
                      ?.copyWith(color: colors.inkMuted),
                ),
              ],
            ],
          ),
        ),
        if (trailing != null) trailing!,
      ],
    );
  }
}
