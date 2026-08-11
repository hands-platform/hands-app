import 'package:flutter/material.dart';

import 'provider_error_helpers.dart';

class InfoCard extends StatelessWidget {
  const InfoCard({super.key, required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Text(text),
      ),
    );
  }
}

class ProviderErrorCard extends StatelessWidget {
  const ProviderErrorCard({super.key, required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final actionBlock = providerActionBlockCopy(text);
    if (actionBlock == null && !isProviderBlockedMessage(text)) {
      return ErrorCard(text: text);
    }

    final colorScheme = Theme.of(context).colorScheme;
    final accountBlocked = isProviderAccountBlockedMessage(text);
    final title = actionBlock?.title ??
        (accountBlocked
            ? 'Tài khoản đối tác đang bị HANDS tạm khóa'
            : 'Thiết bị đang bị HANDS tạm khóa');
    final detail = actionBlock?.detail ?? text;
    final nextStep = actionBlock?.nextStep ??
        (accountBlocked
            ? 'Liên hệ HANDS. Tài khoản không thể trực tuyến hoặc chia sẻ vị trí cho đến khi được mở khóa.'
            : 'Không tạo tài khoản mới. Hãy liên hệ HANDS để thiết bị được xem xét hoặc mở khóa.');
    final icon = actionBlock?.icon ??
        (accountBlocked
            ? Icons.admin_panel_settings_outlined
            : Icons.phonelink_lock_outlined);

    return Card(
      color: colorScheme.errorContainer,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: colorScheme.error),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          color: colorScheme.onErrorContainer,
                          fontWeight: FontWeight.w800,
                        ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    detail,
                    style: TextStyle(color: colorScheme.onErrorContainer),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    nextStep,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: colorScheme.onErrorContainer,
                        ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class ErrorCard extends StatelessWidget {
  const ErrorCard({super.key, required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Card(
      color: colorScheme.errorContainer,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Text(
          text,
          style: TextStyle(color: colorScheme.onErrorContainer),
        ),
      ),
    );
  }
}
