import 'package:flutter/material.dart';

import '../customer_design_system.dart';

class MvpAsyncList extends StatelessWidget {
  const MvpAsyncList({
    super.key,
    required this.title,
    required this.subtitle,
    required this.enabled,
    required this.disabledText,
    required this.loader,
    required this.labelBuilder,
  });

  final String title;
  final String subtitle;
  final bool enabled;
  final String disabledText;
  final Future<List<dynamic>> Function() loader;
  final String Function(dynamic item) labelBuilder;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(title, style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 8),
          Text(subtitle, style: Theme.of(context).textTheme.bodyLarge),
          const SizedBox(height: 20),
          if (!enabled)
            EmptyPanel(text: disabledText)
          else
            FutureBuilder<List<dynamic>>(
              future: loader(),
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }
                final items = snapshot.data ?? [];
                if (items.isEmpty) {
                  return const EmptyPanel(text: 'No records yet.');
                }
                return Column(
                  children: [
                    for (final item in items)
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text(labelBuilder(item)),
                        trailing: const Icon(Icons.arrow_forward_rounded),
                      ),
                  ],
                );
              },
            ),
        ],
      ),
    );
  }
}

class MvpScreen extends StatelessWidget {
  const MvpScreen({
    super.key,
    required this.title,
    required this.subtitle,
    required this.items,
  });

  final String title;
  final String subtitle;
  final List<String> items;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(title, style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 8),
          Text(subtitle, style: Theme.of(context).textTheme.bodyLarge),
          const SizedBox(height: 20),
          for (final item in items)
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(item),
              trailing: const Icon(Icons.arrow_forward_rounded),
            ),
        ],
      ),
    );
  }
}

class InfoBanner extends StatelessWidget {
  const InfoBanner({super.key, required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.handsColors;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.primarySoft,
        borderRadius: BorderRadius.circular(HandsShapes.medium),
      ),
      child: Padding(
        padding: const EdgeInsets.all(HandsSpacing.space16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              Icons.info_outline_rounded,
              size: HandsIconTheme.inline,
              color: colors.primary,
            ),
            const SizedBox(width: HandsSpacing.space12),
            Expanded(child: Text(text)),
          ],
        ),
      ),
    );
  }
}

class EmptyPanel extends StatelessWidget {
  const EmptyPanel({super.key, required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.handsColors;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: HandsSpacing.space32),
      child: Row(
        children: [
          Icon(
            Icons.inbox_outlined,
            size: HandsIconTheme.standard,
            color: colors.inkMuted,
          ),
          const SizedBox(width: HandsSpacing.space16),
          Expanded(
            child: Text(
              text,
              style: Theme.of(context)
                  .textTheme
                  .bodyLarge
                  ?.copyWith(color: colors.inkMuted),
            ),
          ),
        ],
      ),
    );
  }
}

class ErrorPanel extends StatelessWidget {
  const ErrorPanel({super.key, required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.handsColors;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.error.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(HandsShapes.medium),
        border: Border.all(color: colors.error.withValues(alpha: 0.24)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(HandsSpacing.space16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              Icons.error_outline_rounded,
              size: HandsIconTheme.inline,
              color: colors.error,
            ),
            const SizedBox(width: HandsSpacing.space12),
            Expanded(
              child: Text(
                text,
                style: Theme.of(context)
                    .textTheme
                    .bodyMedium
                    ?.copyWith(color: colors.error),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
