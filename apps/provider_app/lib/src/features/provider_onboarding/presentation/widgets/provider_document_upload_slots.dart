import 'package:flutter/material.dart';

const requiredProviderDocumentTypes = ['CCCD_FRONT', 'CCCD_BACK', 'SELFIE'];
const optionalProviderDocumentTypes = [
  'PROFILE_PHOTO',
  'WORK_PHOTO',
  'BANK_QR',
];
const providerDocumentTypes = [
  ...requiredProviderDocumentTypes,
  ...optionalProviderDocumentTypes,
];

class ProviderDocumentUploadSlots extends StatelessWidget {
  const ProviderDocumentUploadSlots({
    super.key,
    required this.uploadedDocumentIds,
    this.submittedDocuments = const [],
    required this.isUploading,
    required this.onUpload,
  });

  final Map<String, String> uploadedDocumentIds;
  final List<dynamic> submittedDocuments;
  final bool isUploading;
  final Future<void> Function(String type) onUpload;

  @override
  Widget build(BuildContext context) {
    final submittedByType =
        providerDocumentSlotDocumentsByType(submittedDocuments);
    final rejectedRequired = providerRejectedKycDocumentSummaries(
      submittedDocuments: submittedDocuments,
      uploadedDocumentIds: uploadedDocumentIds,
    );

    final missingRequired = requiredProviderDocumentTypes
        .where((type) => !isProviderKycDocumentReady(
              type: type,
              uploadedDocumentIds: uploadedDocumentIds,
              submittedDocuments: submittedDocuments,
            ))
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
              rejectedRequired.isNotEmpty
                  ? 'Some required identity photos were rejected. Replace each rejected item, then resubmit KYC.'
                  : missingRequired.isEmpty
                      ? 'Required identity photos are ready for KYC submission.'
                      : 'Upload the CCCD/CMND front, back, and selfie before submitting KYC.',
            ),
            if (rejectedRequired.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(
                rejectedRequired.join('\n'),
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ],
            const SizedBox(height: 12),
            for (final type in requiredProviderDocumentTypes) ...[
              _DocumentSlot(
                type: type,
                submittedDocument: submittedByType[type],
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
                submittedDocument: submittedByType[type],
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
    required this.submittedDocument,
    required this.uploaded,
    required this.isUploading,
    required this.onUpload,
  });

  final String type;
  final Map<String, dynamic>? submittedDocument;
  final bool uploaded;
  final bool isUploading;
  final Future<void> Function(String type) onUpload;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final status = submittedDocument?['status']?.toString();
    final rejected = status == 'REJECTED';
    final approved = status == 'APPROVED';
    final pending = status == 'PENDING_REVIEW';
    final rejectionReason = providerDocumentRejectionReason(submittedDocument);
    final statusLabel = providerDocumentSlotStatusLabel(
      type: type,
      uploaded: uploaded,
      submittedDocument: submittedDocument,
    );
    final actionHint = providerDocumentSlotActionHint(
      uploaded: uploaded,
      status: status,
    );
    final activeColor = rejected ? colorScheme.error : colorScheme.primary;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        border: Border.all(
          color: uploaded || approved || pending || rejected
              ? activeColor
              : colorScheme.outlineVariant,
        ),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Icon(
            uploaded || approved
                ? Icons.check_circle_outline
                : rejected
                    ? Icons.error_outline
                    : pending
                        ? Icons.hourglass_top_outlined
                        : Icons.add_photo_alternate,
            color: uploaded || approved || pending || rejected
                ? activeColor
                : colorScheme.onSurfaceVariant,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${providerDocumentTypeStep(type)} - ${providerDocumentTypeLabel(type)}',
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
                Text(
                  statusLabel,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                if (actionHint != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    actionHint,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: rejected
                              ? colorScheme.error
                              : colorScheme.onSurfaceVariant,
                        ),
                  ),
                ],
                if (rejectionReason != null && rejectionReason.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    'Reason: $rejectionReason',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: colorScheme.error,
                        ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 8),
          FilledButton.tonal(
            onPressed: isUploading ? null : () => onUpload(type),
            child: Text(uploaded || rejected ? 'Replace' : 'Upload'),
          ),
        ],
      ),
    );
  }
}

String providerDocumentTypeLabel(String type) {
  switch (type) {
    case 'CCCD_FRONT':
      return 'CCCD front side';
    case 'CCCD_BACK':
      return 'CCCD back side';
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

String providerDocumentTypeDescription(String type) {
  switch (type) {
    case 'CCCD_FRONT':
      return 'Front side of CCCD/CMND. Keep all text readable.';
    case 'CCCD_BACK':
      return 'Back side of CCCD/CMND. Avoid glare and cropped corners.';
    case 'SELFIE':
      return 'Face photo taken by the partner. It must match the ID document.';
    case 'PROFILE_PHOTO':
      return 'Public profile photo used after admin review.';
    case 'WORK_PHOTO':
      return 'Optional work or service evidence for trust review.';
    case 'BANK_QR':
      return 'Optional VietQR or banking QR image for payout review.';
    default:
      return 'Supporting document for partner verification.';
  }
}

String providerDocumentTypeStep(String type) {
  final requiredIndex = requiredProviderDocumentTypes.indexOf(type);
  if (requiredIndex >= 0) return 'Step ${requiredIndex + 1}';
  return 'Optional';
}

String providerDocumentStatusLabel(String status) {
  switch (status) {
    case 'APPROVED':
      return 'Approved by admin.';
    case 'PENDING_REVIEW':
      return 'Submitted. Waiting for admin review.';
    case 'REJECTED':
      return 'Rejected. Upload a clearer replacement image.';
    default:
      return status;
  }
}

String providerDocumentSlotStatusLabel({
  required String type,
  required bool uploaded,
  required Map<String, dynamic>? submittedDocument,
}) {
  if (uploaded) {
    return 'Replacement attached. Submit KYC to send it for review.';
  }
  final status = submittedDocument?['status']?.toString();
  if (status == null) {
    return providerDocumentTypeDescription(type);
  }
  return providerDocumentStatusLabel(status);
}

String? providerDocumentSlotActionHint({
  required bool uploaded,
  required String? status,
}) {
  if (uploaded) {
    return 'Next: press Submit KYC so admin can review the new image.';
  }
  if (status == 'REJECTED') {
    return 'Next: tap Replace and upload a clearer photo.';
  }
  return null;
}

String? providerDocumentRejectionReason(Map<String, dynamic>? document) {
  final reason = document?['rejectionReason']?.toString().trim();
  return reason == null || reason.isEmpty ? null : reason;
}

List<String> providerRejectedKycDocumentSummaries({
  required List<dynamic> submittedDocuments,
  required Map<String, String> uploadedDocumentIds,
  List<String> requiredTypes = requiredProviderDocumentTypes,
}) {
  final summaries = <String>[];
  for (final type in requiredTypes) {
    if (isProviderKycDocumentReady(
      type: type,
      uploadedDocumentIds: uploadedDocumentIds,
      submittedDocuments: submittedDocuments,
    )) {
      continue;
    }
    final rejectedDocument = submittedDocuments
        .map(_asMap)
        .whereType<Map<String, dynamic>>()
        .where((document) =>
            document['type']?.toString() == type &&
            document['status']?.toString() == 'REJECTED')
        .cast<Map<String, dynamic>?>()
        .firstWhere((document) => document != null, orElse: () => null);
    if (rejectedDocument == null) {
      continue;
    }
    final reason = providerDocumentRejectionReason(rejectedDocument) ??
        'Upload a clearer replacement image.';
    summaries.add('${providerDocumentTypeLabel(type)}: $reason');
  }
  return summaries;
}

Map<String, dynamic>? _asMap(dynamic value) {
  if (value is Map<String, dynamic>) {
    return value;
  }
  if (value is Map) {
    return Map<String, dynamic>.from(value);
  }
  return null;
}

Map<String, Map<String, dynamic>> providerDocumentSlotDocumentsByType(
    List<dynamic> submittedDocuments) {
  final documentsByType = <String, List<Map<String, dynamic>>>{};
  for (final document in submittedDocuments) {
    final item = _asMap(document);
    final type = item?['type']?.toString();
    if (item == null || type == null || type.isEmpty) {
      continue;
    }
    documentsByType.putIfAbsent(type, () => []).add(item);
  }

  return documentsByType.map((type, documents) {
    return MapEntry(type, _preferredDocumentForSlot(documents));
  });
}

bool isProviderKycDocumentReady({
  required String type,
  required Map<String, String> uploadedDocumentIds,
  required List<dynamic> submittedDocuments,
}) {
  if (uploadedDocumentIds.containsKey(type)) {
    return true;
  }
  return submittedDocuments
      .map(_asMap)
      .whereType<Map<String, dynamic>>()
      .where((document) => document['type']?.toString() == type)
      .any(isProviderSubmittedDocumentUsableForKyc);
}

bool isProviderSubmittedDocumentUsableForKyc(Map<String, dynamic> document) {
  final status = document['status']?.toString();
  return status == 'APPROVED' || status == 'PENDING_REVIEW';
}

Map<String, dynamic> _preferredDocumentForSlot(
    List<Map<String, dynamic>> documents) {
  return documents.reduce((best, candidate) {
    final bestScore = _documentSlotScore(best);
    final candidateScore = _documentSlotScore(candidate);
    if (candidateScore > bestScore) {
      return candidate;
    }
    return best;
  });
}

int _documentSlotScore(Map<String, dynamic> document) {
  switch (document['status']?.toString()) {
    case 'PENDING_REVIEW':
      return 4;
    case 'APPROVED':
      return 3;
    case 'REJECTED':
      return 2;
    default:
      return 1;
  }
}
