import 'package:flutter/material.dart';

const requiredProviderDocumentTypes = ['CCCD_FRONT', 'CCCD_BACK', 'SELFIE'];
const optionalProviderDocumentTypes = ['WORK_PHOTO', 'BANK_QR'];
const providerDocumentTypes = [
  ...requiredProviderDocumentTypes,
  ...optionalProviderDocumentTypes,
];

class ProviderDocumentUploadSlots extends StatelessWidget {
  const ProviderDocumentUploadSlots({
    super.key,
    required this.uploadedDocumentIds,
    required this.isUploading,
    required this.onUpload,
  });

  final Map<String, String> uploadedDocumentIds;
  final bool isUploading;
  final Future<void> Function(String type) onUpload;

  @override
  Widget build(BuildContext context) {
    final missingRequired = requiredProviderDocumentTypes
        .where((type) => !uploadedDocumentIds.containsKey(type))
        .map(providerDocumentTypeLabel)
        .toList();

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'KYC document checklist',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 6),
            Text(
              missingRequired.isEmpty
                  ? 'Required identity photos are ready for KYC submission.'
                  : 'Upload each required photo before submitting KYC.',
            ),
            const SizedBox(height: 12),
            for (final type in requiredProviderDocumentTypes) ...[
              _DocumentSlot(
                type: type,
                required: true,
                uploaded: uploadedDocumentIds.containsKey(type),
                isUploading: isUploading,
                onUpload: onUpload,
              ),
              const SizedBox(height: 8),
            ],
            const Divider(height: 24),
            for (final type in optionalProviderDocumentTypes) ...[
              _DocumentSlot(
                type: type,
                required: false,
                uploaded: uploadedDocumentIds.containsKey(type),
                isUploading: isUploading,
                onUpload: onUpload,
              ),
              const SizedBox(height: 8),
            ],
            if (missingRequired.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(
                'Missing: ${missingRequired.join(', ')}',
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _DocumentSlot extends StatelessWidget {
  const _DocumentSlot({
    required this.type,
    required this.required,
    required this.uploaded,
    required this.isUploading,
    required this.onUpload,
  });

  final String type;
  final bool required;
  final bool uploaded;
  final bool isUploading;
  final Future<void> Function(String type) onUpload;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        border: Border.all(
          color: uploaded ? colorScheme.primary : colorScheme.outlineVariant,
        ),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Icon(
            uploaded ? Icons.check_circle_outline : Icons.add_photo_alternate,
            color:
                uploaded ? colorScheme.primary : colorScheme.onSurfaceVariant,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  providerDocumentTypeLabel(type),
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
                Text(
                  required
                      ? 'Required for Level 2 approval'
                      : 'Optional supporting document',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          FilledButton.tonal(
            onPressed: isUploading ? null : () => onUpload(type),
            child: Text(uploaded ? 'Replace' : 'Upload'),
          ),
        ],
      ),
    );
  }
}

String providerDocumentTypeLabel(String type) {
  switch (type) {
    case 'CCCD_FRONT':
      return 'CCCD front image';
    case 'CCCD_BACK':
      return 'CCCD back image';
    case 'SELFIE':
      return 'Selfie verification';
    case 'PROFILE_PHOTO':
      return 'Profile photo';
    case 'WORK_PHOTO':
      return 'Work photo';
    case 'BANK_QR':
      return 'Bank QR image';
    default:
      return type;
  }
}
