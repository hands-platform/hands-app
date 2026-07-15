import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../provider_services/presentation/widgets/provider_service_pricing_card.dart';
import '../../../app_state.dart';
import '../../../core/provider_value_helpers.dart';
import '../../provider_onboarding/presentation/provider_onboarding_status.dart';
import '../../provider_onboarding/presentation/widgets/provider_document_upload_slots.dart';
import '../../provider_onboarding/presentation/widgets/provider_onboarding_forms.dart';
import 'provider_feedback_cards.dart';
import 'provider_image_upload_picker.dart';
import 'provider_onboarding_card.dart';
import 'provider_public_media_review_card.dart';

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
    final image = await pickProviderImage(
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
      final completedFile =
          await ref.read(providerRepositoryProvider).uploadVerificationFile(
                bytes: image.bytes,
                contentType: image.contentType,
              );
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
    final image = await pickProviderImage(
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
      await ref.read(providerRepositoryProvider).uploadProfileImage(
            bytes: image.bytes,
            contentType: image.contentType,
          );
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
    final image = await pickProviderImage(
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
      await ref.read(providerRepositoryProvider).uploadGalleryImage(
            bytes: image.bytes,
            contentType: image.contentType,
          );
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
                return ProviderOnboardingCard(
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
                return ProviderPublicMediaReviewCard(
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
                try {
                  await ref.read(providerRepositoryProvider).goOffline();
                } catch (_) {
                  // A stale session must not prevent local credential cleanup.
                }
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
