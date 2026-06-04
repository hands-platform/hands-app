import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../provider_services/presentation/widgets/provider_service_pricing_card.dart';
import '../../../app_state.dart';
import '../../../core/provider_value_helpers.dart';
import '../../booking/presentation/provider_jobs_helpers.dart';
import '../../provider_onboarding/presentation/provider_onboarding_status.dart';
import '../../provider_onboarding/presentation/widgets/provider_document_upload_slots.dart';
import '../../provider_onboarding/presentation/widgets/provider_onboarding_forms.dart';
import 'provider_feedback_cards.dart';
import 'provider_public_media_review_helpers.dart';

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  late Future<Map<String, dynamic>> _verificationFuture;
  late Future<Map<String, dynamic>> _onboardingFuture;
  late Future<Map<String, dynamic>> _profileFuture;
  final List<String> _uploadedFileIds = [];
  final Map<String, String> _uploadedOnboardingDocumentIds = {};
  bool _isUploadingProfileImage = false;
  bool _isUploadingGalleryImage = false;
  bool _isUploading = false;
  bool _isSubmitting = false;
  bool _isSavingOnboarding = false;

  @override
  void initState() {
    super.initState();
    _verificationFuture = ref.read(providerRepositoryProvider).verification();
    _onboardingFuture =
        ref.read(providerRepositoryProvider).onboardingSnapshot();
    _profileFuture = ref.read(providerRepositoryProvider).providerMe();
  }

  void _refreshVerification() {
    setState(() {
      _verificationFuture = ref.read(providerRepositoryProvider).verification();
    });
  }

  void _refreshOnboarding() {
    setState(() {
      _onboardingFuture =
          ref.read(providerRepositoryProvider).onboardingSnapshot();
    });
  }

  void _refreshProfile() {
    setState(() {
      _profileFuture = ref.read(providerRepositoryProvider).providerMe();
    });
  }

  Future<void> _runOnboardingAction(
      String successMessage, Future<void> Function() action) async {
    setState(() {
      _isSavingOnboarding = true;
    });
    try {
      await action();
      _refreshOnboarding();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(successMessage)),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Onboarding update failed: $error')),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isSavingOnboarding = false;
        });
      }
    }
  }

  Future<void> _editBasicProfile(Map<String, dynamic> snapshot) async {
    final input = await showProviderBasicProfileSheet(
      context,
      initial: asMap(snapshot['basicProfile']) ?? <String, dynamic>{},
    );
    if (input == null) return;
    return _runOnboardingAction('Basic profile saved', () async {
      await ref
          .read(providerRepositoryProvider)
          .updateOnboardingBasicProfile(input.toJson());
    });
  }

  Future<void> _submitKycFromForm(Map<String, dynamic> snapshot) async {
    final existingDocumentTypes = asList(snapshot['documents'])
        .map(asMap)
        .whereType<Map<String, dynamic>>()
        .where(isProviderSubmittedDocumentUsableForKyc)
        .map((document) => document['type']?.toString())
        .whereType<String>()
        .toSet();
    final readyDocumentTypes = {
      ...existingDocumentTypes,
      ..._uploadedOnboardingDocumentIds.keys,
    };
    final requiredTypes = requiredKycDocumentTypesFromSnapshot(snapshot);
    final missingTypes = requiredTypes
        .where((type) => !readyDocumentTypes.contains(type))
        .toList();
    if (missingTypes.isNotEmpty) {
      final rejectedSummaries = providerRejectedKycDocumentSummaries(
        submittedDocuments: asList(snapshot['documents']),
        uploadedDocumentIds: _uploadedOnboardingDocumentIds,
        requiredTypes: requiredTypes,
      );
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            rejectedSummaries.isNotEmpty
                ? 'Replace rejected KYC photo(s): ${rejectedSummaries.join('; ')}'
                : 'Upload required KYC photos first: ${missingTypes.map(providerDocumentTypeLabel).join(', ')}',
          ),
        ),
      );
      return;
    }

    final input = await showProviderKycSheet(context);
    if (input == null) return;
    final documents = _uploadedOnboardingDocumentIds.entries
        .map((entry) => {'type': entry.key, 'fileId': entry.value})
        .toList();
    return _runOnboardingAction('KYC request submitted for admin review',
        () async {
      await ref.read(providerRepositoryProvider).submitOnboardingKyc(
            cccdNumber: input.cccdNumber,
            documents: documents,
          );
      _uploadedOnboardingDocumentIds.clear();
      _refreshVerification();
    });
  }

  Future<void> _addBankAccountFromForm(Map<String, dynamic> snapshot) async {
    final bankAccounts = asList(snapshot['bankAccounts']);
    final initialBankAccount = bankAccounts.isEmpty
        ? <String, dynamic>{}
        : asMap(bankAccounts.first) ?? <String, dynamic>{};
    final input = await showProviderBankAccountSheet(
      context,
      initial: initialBankAccount,
      status: initialBankAccount['status']?.toString(),
      rejectionReason: reviewReason(initialBankAccount),
    );
    if (input == null) return;
    return _runOnboardingAction('Bank account submitted for review', () async {
      await ref.read(providerRepositoryProvider).createOnboardingBankAccount(
            bankName: input.bankName,
            accountNumber: input.accountNumber,
            accountHolderName: input.accountHolderName,
            qrBankingInfo: input.qrBankingInfo,
          );
    });
  }

  Future<void> _addTaxProfileFromForm(Map<String, dynamic> snapshot) async {
    final taxProfile = asMap(snapshot['taxProfile']) ?? <String, dynamic>{};
    final input = await showProviderTaxProfileSheet(
      context,
      initial: taxProfile,
      basicProfile: asMap(snapshot['basicProfile']) ?? <String, dynamic>{},
      status: taxProfile['status']?.toString(),
      rejectionReason: reviewReason(taxProfile),
    );
    if (input == null) return;
    return _runOnboardingAction('Tax profile submitted for review', () async {
      await ref.read(providerRepositoryProvider).upsertOnboardingTaxProfile(
            taxCode: input.taxCode,
            legalName: input.legalName,
            registeredAddress: input.registeredAddress,
          );
    });
  }

  Future<void> _acceptAgreementsFromForm(Map<String, dynamic> snapshot) async {
    final input = await showProviderAgreementsSheet(
      context,
      accepted: asList(snapshot['agreements']),
      requiredTypes: requiredPayoutAgreementTypesFromSnapshot(snapshot),
      version: providerAgreementVersionFromSnapshot(snapshot),
    );
    if (input == null) return;
    return _runOnboardingAction('Required agreements accepted', () async {
      for (final type in input.types) {
        await ref.read(providerRepositoryProvider).acceptOnboardingAgreement(
              type: type,
              version: input.version,
              deviceId: input.deviceId.isEmpty ? null : input.deviceId,
            );
      }
    });
  }

  Future<void> _pickAndUploadVerificationFile(String documentType) async {
    final image = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      imageQuality: 85,
      maxWidth: 2400,
    );
    if (image == null) {
      return;
    }

    setState(() {
      _isUploading = true;
    });
    try {
      final bytes = await image.readAsBytes();
      final contentType =
          image.mimeType ?? guessImageContentTypeFromName(image.name);
      final completedFile = await ref
          .read(providerRepositoryProvider)
          .uploadVerificationFile(bytes: bytes, contentType: contentType);
      final fileId = completedFile['id']?.toString();
      if (fileId != null && fileId.isNotEmpty) {
        _uploadedFileIds.add(fileId);
        _uploadedOnboardingDocumentIds[documentType] = fileId;
      }
      _refreshVerification();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              '${providerDocumentTypeLabel(documentType)} uploaded: ${image.name}',
            ),
          ),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Upload failed: $error')),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isUploading = false;
        });
      }
    }
  }

  Future<void> _pickAndUploadProfileImage() async {
    final image = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      imageQuality: 85,
      maxWidth: 1600,
    );
    if (image == null) {
      return;
    }

    setState(() {
      _isUploadingProfileImage = true;
    });
    try {
      final bytes = await image.readAsBytes();
      final contentType =
          image.mimeType ?? guessImageContentTypeFromName(image.name);
      await ref
          .read(providerRepositoryProvider)
          .uploadProfileImage(bytes: bytes, contentType: contentType);
      if (mounted) {
        _refreshProfile();
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text(
                  'Profile image uploaded for admin review: ${image.name}')),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Profile image upload failed: $error')),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isUploadingProfileImage = false;
        });
      }
    }
  }

  Future<void> _pickAndUploadGalleryImage() async {
    final image = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      imageQuality: 82,
      maxWidth: 1800,
    );
    if (image == null) {
      return;
    }

    setState(() {
      _isUploadingGalleryImage = true;
    });
    try {
      final bytes = await image.readAsBytes();
      final contentType =
          image.mimeType ?? guessImageContentTypeFromName(image.name);
      await ref
          .read(providerRepositoryProvider)
          .uploadGalleryImage(bytes: bytes, contentType: contentType);
      if (mounted) {
        _refreshProfile();
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content:
                  Text('Work photo uploaded for admin review: ${image.name}')),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Work photo upload failed: $error')),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isUploadingGalleryImage = false;
        });
      }
    }
  }

  Future<void> _submitVerification(List<dynamic> existingFiles) async {
    final uploadedExistingIds = existingFiles
        .whereType<Map>()
        .where((file) => file['uploadStatus']?.toString() == 'UPLOADED')
        .map((file) => file['id']?.toString())
        .whereType<String>()
        .toList();
    final fileIds = <String>{...uploadedExistingIds, ..._uploadedFileIds}
        .where((id) => id.isNotEmpty)
        .toList();

    if (fileIds.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Upload at least one verification file first.')),
      );
      return;
    }

    setState(() {
      _isSubmitting = true;
    });
    try {
      await ref
          .read(providerRepositoryProvider)
          .submitVerification(fileIds: fileIds);
      _uploadedFileIds.clear();
      _refreshVerification();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Verification submitted')),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Submit failed: $error')),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text('Profile', style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 8),
          Text(
            auth == null
                ? 'Not signed in'
                : 'Signed in as ${auth.user['phone']}',
            style: Theme.of(context).textTheme.bodyLarge,
          ),
          const SizedBox(height: 16),
          if (auth != null) ...[
            FutureBuilder<Map<String, dynamic>>(
              future: _onboardingFuture,
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }
                return _ProviderOnboardingCard(
                  snapshot: snapshot.data ?? <String, dynamic>{},
                  error: snapshot.error,
                  isSaving: _isSavingOnboarding,
                  onRefresh: _refreshOnboarding,
                  onFillBasicProfile: () =>
                      _editBasicProfile(snapshot.data ?? <String, dynamic>{}),
                  onSubmitKyc: () =>
                      _submitKycFromForm(snapshot.data ?? <String, dynamic>{}),
                  onAddBankAccount: () => _addBankAccountFromForm(
                      snapshot.data ?? <String, dynamic>{}),
                  onAddTaxProfile: () => _addTaxProfileFromForm(
                      snapshot.data ?? <String, dynamic>{}),
                  onAcceptAgreements: () => _acceptAgreementsFromForm(
                      snapshot.data ?? <String, dynamic>{}),
                );
              },
            ),
            const SizedBox(height: 12),
            FilledButton.tonalIcon(
              onPressed:
                  _isUploadingProfileImage ? null : _pickAndUploadProfileImage,
              icon: const Icon(Icons.image_outlined),
              label: Text(_isUploadingProfileImage
                  ? 'Uploading profile image...'
                  : 'Upload public profile image'),
            ),
            const SizedBox(height: 8),
            FilledButton.tonalIcon(
              onPressed:
                  _isUploadingGalleryImage ? null : _pickAndUploadGalleryImage,
              icon: const Icon(Icons.photo_library_outlined),
              label: Text(_isUploadingGalleryImage
                  ? 'Uploading work photo...'
                  : 'Upload public work photo'),
            ),
            const SizedBox(height: 12),
            FutureBuilder<Map<String, dynamic>>(
              future: _profileFuture,
              builder: (context, snapshot) {
                return _ProviderPublicMediaReviewCard(
                  profile: snapshot.data ?? <String, dynamic>{},
                  error: snapshot.error,
                  isLoading:
                      snapshot.connectionState == ConnectionState.waiting,
                  onRefresh: _refreshProfile,
                );
              },
            ),
            const SizedBox(height: 12),
            const ProviderServicePricingCard(),
            const SizedBox(height: 12),
          ],
          if (auth == null)
            const InfoCard(text: 'Login first to manage verification.')
          else
            FutureBuilder<Map<String, dynamic>>(
              future: _verificationFuture,
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }

                final verification = snapshot.data ?? <String, dynamic>{};
                final files = verification['files'] is List<dynamic>
                    ? verification['files'] as List<dynamic>
                    : [];
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Card(
                      child: ListTile(
                        title: Text(
                            'Verification ${verification['status'] ?? 'DRAFT'}'),
                        subtitle: Text(
                          verification['rejectionReason'] == null
                              ? '${files.length} file(s) attached'
                              : '${verification['rejectionReason']}',
                        ),
                        trailing: const Icon(Icons.verified_user_outlined),
                      ),
                    ),
                    const SizedBox(height: 12),
                    if (snapshot.hasError) ...[
                      ErrorCard(
                          text: 'Verification load failed: ${snapshot.error}'),
                      const SizedBox(height: 12),
                    ],
                    FutureBuilder<Map<String, dynamic>>(
                      future: _onboardingFuture,
                      builder: (context, onboardingSnapshot) {
                        final onboarding =
                            onboardingSnapshot.data ?? <String, dynamic>{};
                        return ProviderDocumentUploadSlots(
                          uploadedDocumentIds: _uploadedOnboardingDocumentIds,
                          submittedDocuments: asList(onboarding['documents']),
                          isUploading: _isUploading,
                          onUpload: _pickAndUploadVerificationFile,
                        );
                      },
                    ),
                    if (_uploadedOnboardingDocumentIds.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      InfoCard(
                        text:
                            'Ready for KYC: ${_uploadedOnboardingDocumentIds.keys.map(providerDocumentTypeLabel).join(', ')}',
                      ),
                    ],
                    const SizedBox(height: 8),
                    FilledButton.icon(
                      onPressed: _isSubmitting || _isUploading
                          ? null
                          : () => _submitVerification(files),
                      icon: const Icon(Icons.send_outlined),
                      label: Text(_isSubmitting
                          ? 'Submitting...'
                          : 'Submit uploaded files for review'),
                    ),
                    const SizedBox(height: 12),
                    if (files.isEmpty)
                      const InfoCard(
                        text:
                            'Upload one private verification photo, then submit it for admin review.',
                      )
                    else
                      ...files.map((file) {
                        final item = asMap(file) ?? <String, dynamic>{};
                        final key =
                            item['key']?.toString() ?? 'verification file';
                        final status =
                            item['uploadStatus']?.toString() ?? 'PENDING';
                        final size = asNum(item['sizeBytes'])?.toInt();
                        final uploadedAt = item['uploadedAt']?.toString();
                        return Card(
                          child: ListTile(
                            leading: Icon(status == 'UPLOADED'
                                ? Icons.check_circle_outline
                                : Icons.pending_outlined),
                            title: Text(key),
                            subtitle: Text([
                              status,
                              if (size != null) '${(size / 1024).ceil()} KB',
                              if (uploadedAt != null) uploadedAt,
                            ].join(' / ')),
                          ),
                        );
                      }),
                    const SizedBox(height: 12),
                    for (final item in ['Massage menu', 'Online toggle'])
                      Card(
                        child: ListTile(
                          title: Text(item),
                          trailing: const Icon(Icons.chevron_right),
                        ),
                      ),
                  ],
                );
              },
            ),
          if (auth != null) ...[
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: () async {
                await ref.read(providerRepositoryProvider).goOffline();
                ref.read(providerLocationHeartbeatProvider).stop();
                await ref.read(authControllerProvider.notifier).signOut();
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                        content: Text('Signed out and partner is offline.')),
                  );
                }
              },
              icon: const Icon(Icons.logout),
              label: const Text('Sign out'),
            ),
          ],
        ],
      ),
    );
  }
}

class _ProviderPublicMediaReviewCard extends StatelessWidget {
  const _ProviderPublicMediaReviewCard({
    required this.profile,
    required this.error,
    required this.isLoading,
    required this.onRefresh,
  });

  final Map<String, dynamic> profile;
  final Object? error;
  final bool isLoading;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    final media = asList(profile['fileAssets'])
        .map(asMap)
        .whereType<Map<String, dynamic>>()
        .where(providerPublicMediaIsReviewable)
        .toList();
    final pendingCount = media
        .where(
            (item) => providerPublicMediaReviewStatus(item) == 'PENDING_REVIEW')
        .length;
    final approvedCount = media
        .where((item) => providerPublicMediaReviewStatus(item) == 'APPROVED')
        .length;
    final rejectedCount = media
        .where((item) => providerPublicMediaReviewStatus(item) == 'REJECTED')
        .length;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                const Icon(Icons.collections_outlined),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Public media review',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
                if (isLoading)
                  const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            const Text(
              'Customers only see profile photos and work photos after admin approval.',
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _PublicMediaReviewChip(
                  label: 'Waiting',
                  value: pendingCount,
                  color: Colors.orange.shade700,
                ),
                _PublicMediaReviewChip(
                  label: 'Approved',
                  value: approvedCount,
                  color: Colors.green.shade700,
                ),
                _PublicMediaReviewChip(
                  label: 'Needs changes',
                  value: rejectedCount,
                  color: Colors.red.shade700,
                ),
              ],
            ),
            if (error != null) ...[
              const SizedBox(height: 12),
              Text(
                'Media review status could not be loaded: $error',
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ],
            const SizedBox(height: 12),
            if (media.isEmpty)
              const InfoCard(
                text:
                    'Upload a public profile image or work photo to start admin review.',
              )
            else
              ...media.take(6).map((item) => _PublicMediaReviewRow(item: item)),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: onRefresh,
              icon: const Icon(Icons.refresh_outlined),
              label: const Text('Refresh media status'),
            ),
          ],
        ),
      ),
    );
  }
}

class _PublicMediaReviewChip extends StatelessWidget {
  const _PublicMediaReviewChip({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final int value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Chip(
      avatar: CircleAvatar(
        backgroundColor: color,
        child: Text(
          value.toString(),
          style: const TextStyle(color: Colors.white, fontSize: 12),
        ),
      ),
      label: Text(label),
    );
  }
}

class _PublicMediaReviewRow extends StatelessWidget {
  const _PublicMediaReviewRow({required this.item});

  final Map<String, dynamic> item;

  @override
  Widget build(BuildContext context) {
    final status = providerPublicMediaReviewStatus(item);
    final statusColor = providerPublicMediaReviewColor(status);
    final reason = reviewReason(item);
    final uploadedAt = item['uploadedAt']?.toString() ??
        item['createdAt']?.toString() ??
        'upload time pending';

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        border: Border.all(color: Theme.of(context).dividerColor),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(providerPublicMediaReviewIcon(status), color: statusColor),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  providerPublicMediaPurposeLabel(item['purpose']?.toString()),
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 4),
                Text(
                  providerPublicMediaReviewLabel(status),
                  style: TextStyle(
                    color: statusColor,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (reason != null && reason.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text('Reason: $reason'),
                ],
                const SizedBox(height: 4),
                Text(
                  uploadedAt,
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

class _ProviderOnboardingCard extends StatelessWidget {
  const _ProviderOnboardingCard({
    required this.snapshot,
    required this.error,
    required this.isSaving,
    required this.onRefresh,
    required this.onFillBasicProfile,
    required this.onSubmitKyc,
    required this.onAddBankAccount,
    required this.onAddTaxProfile,
    required this.onAcceptAgreements,
  });

  final Map<String, dynamic> snapshot;
  final Object? error;
  final bool isSaving;
  final VoidCallback onRefresh;
  final Future<void> Function() onFillBasicProfile;
  final Future<void> Function() onSubmitKyc;
  final Future<void> Function() onAddBankAccount;
  final Future<void> Function() onAddTaxProfile;
  final Future<void> Function() onAcceptAgreements;

  @override
  Widget build(BuildContext context) {
    final level = snapshot['level']?.toString() ?? 'LEVEL_1_SIGNUP';
    final recommended =
        snapshot['recommendedLevel']?.toString() ?? 'LEVEL_1_SIGNUP';
    final nextActions = asList(snapshot['nextRequiredActions'])
        .map((action) => action.toString())
        .toList();
    final bankAccounts = asList(snapshot['bankAccounts']);
    final documents = asList(snapshot['documents']);
    final recentLogs = asList(snapshot['recentVerificationLogs'])
        .map(asMap)
        .whereType<Map<String, dynamic>>()
        .toList();
    final requiredKycTypes = requiredKycDocumentTypesFromSnapshot(snapshot);
    final payoutGate = asMap(snapshot['payoutGate']) ?? <String, dynamic>{};
    final payoutMissing = asMap(payoutGate['missing']) ?? <String, dynamic>{};
    final canWithdraw = payoutGate['canWithdraw'] == true;
    final completedBookingCount =
        asNum(snapshot['completedBookingCount'])?.toInt() ?? 0;
    final kyc = asMap(snapshot['kyc']);
    final verification = asMap(snapshot['verification']);
    final taxProfile = asMap(snapshot['taxProfile']);
    final basicProfile = asMap(snapshot['basicProfile']) ?? <String, dynamic>{};
    final hasBasicProfile = !nextActions.contains('BASIC_PROFILE');
    final kycStatus =
        kyc?['status']?.toString() ?? verification?['status']?.toString();
    final bankStatus = bankAccounts.isEmpty
        ? null
        : asMap(bankAccounts.first)?['status']?.toString();
    final taxStatus = taxProfile?['status']?.toString();
    final addressText = basicProfile['residentialAddress']?.toString();
    final primaryBank = bankAccounts.isEmpty ? null : asMap(bankAccounts.first);
    final kycRejectionReason = reviewReason(kyc) ?? reviewReason(verification);
    final bankRejectionReason = reviewReason(primaryBank);
    final taxRejectionReason = reviewReason(taxProfile);
    final rejectedDocuments = documents
        .map(asMap)
        .whereType<Map<String, dynamic>>()
        .where((document) => document['status']?.toString() == 'REJECTED')
        .toList();
    final rejectedRequiredSummaries = providerRejectedKycDocumentSummaries(
      submittedDocuments: documents,
      uploadedDocumentIds: const {},
      requiredTypes: requiredKycTypes,
    );
    final submittedKycRequiredCount = documents
        .map(asMap)
        .whereType<Map<String, dynamic>>()
        .where(isProviderSubmittedDocumentUsableForKyc)
        .map((document) => document['type']?.toString())
        .where((type) => requiredKycTypes.contains(type))
        .toSet()
        .length;
    final kycDocumentsReady =
        submittedKycRequiredCount >= requiredKycTypes.length;
    final missingAgreementCount = (asList(payoutMissing['agreements'])).length;
    final payoutPrerequisiteReady = completedBookingCount > 0 &&
        taxStatus == 'APPROVED' &&
        (addressText?.trim().isNotEmpty ?? false) &&
        missingAgreementCount == 0;
    final payoutGateItems = providerPayoutGateItemsFromSnapshot(snapshot);
    final kycDecisionItems = providerKycDecisionChecklistFromSnapshot(snapshot);
    final levelMilestones = providerLevelMilestonesFromSnapshot(snapshot);
    final priority = providerOnboardingPriorityFromSnapshot(snapshot);
    final firstRevenuePayoutSetupActive =
        providerFirstRevenuePayoutSetupActiveFromSnapshot(snapshot);
    final priorityAction = switch (priority.actionKey) {
      'BASIC_PROFILE' => onFillBasicProfile,
      'RESIDENTIAL_ADDRESS' => onFillBasicProfile,
      'KYC_REVIEW' => onSubmitKyc,
      'BANK_ACCOUNT_REVIEW' => onAddBankAccount,
      'TAX_PROFILE_REVIEW' => onAddTaxProfile,
      'AGREEMENTS' => onAcceptAgreements,
      _ => null,
    };

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Partner onboarding',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
                IconButton(
                  onPressed: isSaving ? null : onRefresh,
                  icon: const Icon(Icons.refresh),
                  tooltip: 'Refresh onboarding',
                ),
              ],
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _OnboardingPill(label: 'Current', value: _compactLevel(level)),
                _OnboardingPill(
                    label: 'Recommended', value: _compactLevel(recommended)),
                _OnboardingPill(
                    label: 'Completed',
                    value: '$completedBookingCount service(s)'),
                _OnboardingPill(
                    label: 'Payout',
                    value: canWithdraw ? 'Ready' : 'Locked',
                    isPositive: canWithdraw),
              ],
            ),
            const SizedBox(height: 12),
            _ProviderLevelRoadmap(milestones: levelMilestones),
            const SizedBox(height: 12),
            if (error != null) ...[
              ErrorCard(text: 'Onboarding load failed: $error'),
              const SizedBox(height: 12),
            ],
            _OnboardingPriorityPanel(
              priority: priority,
              onPressed: isSaving || priorityAction == null
                  ? null
                  : () {
                      priorityAction();
                    },
            ),
            const SizedBox(height: 12),
            if (firstRevenuePayoutSetupActive) ...[
              _FirstRevenuePayoutSetupPanel(
                completedBookingCount: completedBookingCount,
                taxStatus: taxStatus,
                addressReady: addressText?.trim().isNotEmpty ?? false,
                missingAgreementCount: missingAgreementCount,
                onAddTaxProfile: isSaving
                    ? null
                    : () {
                        onAddTaxProfile();
                      },
                onUpdateAddress: isSaving
                    ? null
                    : () {
                        onFillBasicProfile();
                      },
                onAcceptAgreements: isSaving
                    ? null
                    : () {
                        onAcceptAgreements();
                      },
              ),
              const SizedBox(height: 12),
            ],
            if (documents.isNotEmpty) ...[
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: documents.map((document) {
                    final item = asMap(document) ?? <String, dynamic>{};
                    final type = item['type']?.toString() ?? 'DOCUMENT';
                    final status = item['status']?.toString() ?? 'PENDING';
                    final rejected = status == 'REJECTED';
                    return Chip(
                      backgroundColor: rejected
                          ? Theme.of(context).colorScheme.errorContainer
                          : null,
                      label: Text(
                        '${providerDocumentTypeLabel(type)}: $status',
                      ),
                    );
                  }).toList(),
                ),
              ),
            ],
            const SizedBox(height: 12),
            if (kycRejectionReason != null) ...[
              _ReviewAlert(
                title: 'KYC needs updates',
                detail: kycRejectionReason,
              ),
              const SizedBox(height: 8),
            ],
            if (rejectedDocuments.isNotEmpty) ...[
              _ReviewAlert(
                title: 'Rejected document(s)',
                detail: rejectedRequiredSummaries.isNotEmpty
                    ? '${rejectedRequiredSummaries.join('\n')}\n\nOpen the KYC checklist and replace each rejected required photo.'
                    : rejectedDocuments.map((document) {
                        final type = providerDocumentTypeLabel(
                            document['type'].toString());
                        final reason =
                            reviewReason(document) ?? 'Upload a clearer image.';
                        return '$type: $reason';
                      }).join('\n'),
              ),
              const SizedBox(height: 8),
            ],
            if (bankRejectionReason != null) ...[
              _ReviewAlert(
                title: 'Bank account needs updates',
                detail:
                    '$bankRejectionReason\n\nOpen Bank account and submit corrected details.',
              ),
              const SizedBox(height: 8),
            ],
            if (taxRejectionReason != null) ...[
              _ReviewAlert(
                title: 'Tax profile needs updates',
                detail:
                    '$taxRejectionReason\n\nOpen Tax profile and submit corrected MST, legal name, and registered address.',
              ),
              const SizedBox(height: 8),
            ],
            _OnboardingStepCard(
              step: '1',
              title: 'Basic profile',
              detail: addressText == null || addressText.isEmpty
                  ? 'Add legal name, public name, birthday, and service area. Tax address can wait until first earning.'
                  : addressText,
              status: hasBasicProfile ? 'Complete' : 'Required',
              complete: hasBasicProfile,
              icon: Icons.badge_outlined,
              actionLabel: hasBasicProfile ? 'Edit profile' : 'Start profile',
              onPressed: isSaving ? null : onFillBasicProfile,
            ),
            _OnboardingStepCard(
              step: '2',
              title: 'KYC verification',
              detail: rejectedRequiredSummaries.isNotEmpty
                  ? 'Replace ${rejectedRequiredSummaries.length} rejected required photo(s), then resubmit KYC.'
                  : '$submittedKycRequiredCount of ${requiredKycTypes.length} required photos ready. Status: ${kycStatus ?? 'Not submitted'}.',
              status: kycStatus == 'APPROVED'
                  ? 'Approved'
                  : kycDocumentsReady
                      ? 'Ready to submit'
                      : 'Upload documents first',
              complete: kycStatus == 'APPROVED',
              icon: Icons.verified_user_outlined,
              actionLabel: kycStatus == 'REJECTED'
                  ? 'Resubmit KYC'
                  : kycDocumentsReady
                      ? 'Submit KYC'
                      : 'Open KYC checklist',
              onPressed: isSaving ? null : onSubmitKyc,
            ),
            _KycDecisionChecklist(
              items: kycDecisionItems,
              reviewStatus: kycStatus ?? 'Not submitted',
            ),
            _OnboardingStepCard(
              step: '3',
              title: 'Bank account',
              detail: providerBankAccountStepDetail(
                status: bankStatus,
                rejectionReason: bankRejectionReason,
              ),
              status: bankStatus == 'APPROVED' ? 'Approved' : 'Required',
              complete: bankStatus == 'APPROVED',
              icon: Icons.account_balance_outlined,
              actionLabel: bankStatus == 'REJECTED'
                  ? 'Resubmit bank'
                  : bankStatus == null
                      ? 'Add bank account'
                      : 'Update bank account',
              onPressed: isSaving ? null : onAddBankAccount,
            ),
            _OnboardingStepCard(
              step: '4',
              title: 'Payout unlock',
              detail: providerTaxProfileStepDetail(
                completedBookingCount: completedBookingCount,
                status: taxStatus,
                rejectionReason: taxRejectionReason,
                missingAgreementCount: missingAgreementCount,
              ),
              status: canWithdraw
                  ? 'Withdrawals enabled'
                  : payoutPrerequisiteReady
                      ? 'Ready for admin refresh'
                      : 'Locked',
              complete: canWithdraw,
              icon: Icons.payments_outlined,
              actionLabel: completedBookingCount == 0
                  ? 'After first earning'
                  : taxStatus == 'REJECTED'
                      ? 'Resubmit tax'
                      : taxStatus == 'APPROVED'
                          ? 'Review terms'
                          : 'Add tax profile',
              onPressed: isSaving
                  ? null
                  : completedBookingCount == 0
                      ? null
                      : taxStatus == 'APPROVED'
                          ? onAcceptAgreements
                          : onAddTaxProfile,
            ),
            _PayoutGateChecklist(
              items: payoutGateItems,
              agreementVersion: providerAgreementVersionFromSnapshot(snapshot),
            ),
            _OnboardingStepCard(
              step: '5',
              title: 'Profile review',
              detail:
                  'Admin can complete an optional profile review after identity, experience, and profile evidence are reviewed.',
              status: recommended == 'LEVEL_4_TRUSTED' ? 'Complete' : 'Later',
              complete: recommended == 'LEVEL_4_TRUSTED',
              icon: Icons.workspace_premium_outlined,
            ),
            if (recentLogs.isNotEmpty) ...[
              const SizedBox(height: 6),
              _OnboardingHistoryList(logs: recentLogs),
            ],
            if (isSaving) ...[
              const SizedBox(height: 12),
              const LinearProgressIndicator(),
            ],
          ],
        ),
      ),
    );
  }
}

class _FirstRevenuePayoutSetupPanel extends StatelessWidget {
  const _FirstRevenuePayoutSetupPanel({
    required this.completedBookingCount,
    required this.taxStatus,
    required this.addressReady,
    required this.missingAgreementCount,
    required this.onAddTaxProfile,
    required this.onUpdateAddress,
    required this.onAcceptAgreements,
  });

  final int completedBookingCount;
  final String? taxStatus;
  final bool addressReady;
  final int missingAgreementCount;
  final VoidCallback? onAddTaxProfile;
  final VoidCallback? onUpdateAddress;
  final VoidCallback? onAcceptAgreements;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final taxReady = taxStatus == 'APPROVED';
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
                      'First earning recorded',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '$completedBookingCount completed service(s). Finish tax, address, and payout agreements before withdrawal. You can still receive bookings unless the HANDS wallet is negative.',
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _PayoutSetupStatusRow(
            label: 'Tax profile',
            value: taxReady ? 'Approved' : taxStatus ?? 'Missing',
            complete: taxReady,
          ),
          _PayoutSetupStatusRow(
            label: 'Residential address',
            value: addressReady ? 'Saved' : 'Missing',
            complete: addressReady,
          ),
          _PayoutSetupStatusRow(
            label: 'Payout agreements',
            value: agreementsReady ? 'Accepted' : '$missingAgreementCount left',
            complete: agreementsReady,
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (!taxReady)
                FilledButton.tonalIcon(
                  onPressed: onAddTaxProfile,
                  icon: const Icon(Icons.receipt_long_outlined),
                  label: Text(
                    taxStatus == 'REJECTED' ? 'Resubmit tax' : 'Add tax',
                  ),
                ),
              if (!addressReady)
                FilledButton.tonalIcon(
                  onPressed: onUpdateAddress,
                  icon: const Icon(Icons.home_outlined),
                  label: const Text('Update address'),
                ),
              if (!agreementsReady)
                FilledButton.tonalIcon(
                  onPressed: onAcceptAgreements,
                  icon: const Icon(Icons.assignment_turned_in_outlined),
                  label: const Text('Accept agreements'),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _PayoutSetupStatusRow extends StatelessWidget {
  const _PayoutSetupStatusRow({
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

class _ProviderLevelRoadmap extends StatelessWidget {
  const _ProviderLevelRoadmap({required this.milestones});

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
                  'Partner level roadmap',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              Chip(label: Text('$completedCount/${milestones.length}')),
            ],
          ),
          const SizedBox(height: 10),
          for (final milestone in milestones) ...[
            _ProviderLevelRoadmapRow(milestone: milestone),
            if (milestone != milestones.last) const SizedBox(height: 8),
          ],
        ],
      ),
    );
  }
}

class _ProviderLevelRoadmapRow extends StatelessWidget {
  const _ProviderLevelRoadmapRow({required this.milestone});

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
            const Chip(label: Text('Current')),
          ],
        ],
      ),
    );
  }
}

class _PayoutGateChecklist extends StatelessWidget {
  const _PayoutGateChecklist({
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
                  'Payout gate checklist',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              Chip(label: Text('$completeCount/${items.length}')),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'Agreement version: $agreementVersion',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 10),
          for (final item in items) ...[
            _PayoutGateChecklistRow(item: item),
            if (item != items.last) const SizedBox(height: 8),
          ],
        ],
      ),
    );
  }
}

class _PayoutGateChecklistRow extends StatelessWidget {
  const _PayoutGateChecklistRow({required this.item});

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

class _KycDecisionChecklist extends StatelessWidget {
  const _KycDecisionChecklist({
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
                  'KYC review checklist',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              Chip(label: Text('$completeCount/${items.length}')),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'HANDS operations checks these items before Level 2 work access. Review status: $reviewStatus.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 10),
          for (final item in items) ...[
            _KycDecisionChecklistRow(item: item),
            if (item != items.last) const SizedBox(height: 8),
          ],
        ],
      ),
    );
  }
}

class _KycDecisionChecklistRow extends StatelessWidget {
  const _KycDecisionChecklistRow({required this.item});

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

class _OnboardingHistoryList extends StatelessWidget {
  const _OnboardingHistoryList({required this.logs});

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
                  'Recent review activity',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          for (final log in logs.take(5)) ...[
            _OnboardingHistoryRow(log: log),
            if (log != logs.take(5).last)
              Divider(color: colorScheme.outlineVariant),
          ],
        ],
      ),
    );
  }
}

class _OnboardingPriorityPanel extends StatelessWidget {
  const _OnboardingPriorityPanel({
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

class _OnboardingHistoryRow extends StatelessWidget {
  const _OnboardingHistoryRow({required this.log});

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
        ? 'Recorded'
        : '${fromStatus ?? 'New'} -> ${toStatus ?? 'Updated'}';
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
                    if (actorName != null) 'by $actorName',
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

class _OnboardingPill extends StatelessWidget {
  const _OnboardingPill({
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

class _ReviewAlert extends StatelessWidget {
  const _ReviewAlert({
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

class _OnboardingStepCard extends StatelessWidget {
  const _OnboardingStepCard({
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

String _compactLevel(String value) {
  return value
      .replaceAll('LEVEL_', 'L')
      .replaceAll('_SIGNUP', ' signup')
      .replaceAll('_ACTIVE', ' active')
      .replaceAll('_PAYOUT_ENABLED', ' payout')
      .replaceAll('_TRUSTED', ' reviewed');
}

String guessImageContentTypeFromName(String name) {
  final lowerName = name.toLowerCase();
  if (lowerName.endsWith('.png')) {
    return 'image/png';
  }
  if (lowerName.endsWith('.webp')) {
    return 'image/webp';
  }
  return 'image/jpeg';
}
