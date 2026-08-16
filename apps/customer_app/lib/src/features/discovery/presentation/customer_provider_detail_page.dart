import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/customer_design_system.dart';
import '../../../core/customer_error_message.dart';
import '../../../core/customer_value_helpers.dart';
import '../../../core/widgets/customer_app_chrome.dart';
import '../../../core/widgets/customer_feedback_panels.dart';
import '../../booking/presentation/customer_booking_ui_helpers.dart';
import '../../map/presentation/customer_map_widgets.dart';
import 'customer_discovery_widgets.dart';
import 'customer_service_option_helpers.dart';

class ProviderDetailPage extends StatefulWidget {
  const ProviderDetailPage({
    super.key,
    required this.providerPreview,
    required this.loader,
    this.favoriteLoader,
    this.onFavoriteChanged,
    required this.onBookService,
  });

  final Map<String, dynamic> providerPreview;
  final Future<Map<String, dynamic>> Function() loader;
  final Future<bool> Function()? favoriteLoader;
  final Future<void> Function(bool favorite)? onFavoriteChanged;
  final Future<void> Function(
      Map<String, dynamic> detail, Map<String, dynamic> service) onBookService;

  @override
  State<ProviderDetailPage> createState() => _ProviderDetailPageState();
}

class _ProviderDetailPageState extends State<ProviderDetailPage> {
  late Future<Map<String, dynamic>> _detailFuture;

  Future<void> _copyShareLink() async {
    final providerId = widget.providerPreview['id']?.toString();
    if (providerId == null || providerId.isEmpty) return;
    final locale = Localizations.localeOf(context).languageCode;
    await Clipboard.setData(
      ClipboardData(text: 'https://hands.vn/$locale/partners/$providerId'),
    );
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Partner link copied.')),
      );
    }
  }

  @override
  void initState() {
    super.initState();
    _detailFuture = widget.loader();
  }

  @override
  void didUpdateWidget(covariant ProviderDetailPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.providerPreview['id'] != widget.providerPreview['id']) {
      _detailFuture = widget.loader();
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.handsColors;
    final portraitHeight =
        (MediaQuery.sizeOf(context).width * 1.25).clamp(420.0, 520.0);
    return HandsScaffold(
      body: FutureBuilder<Map<String, dynamic>>(
        future: _detailFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          final detail = <String, dynamic>{
            ...widget.providerPreview,
            ...(snapshot.data ?? const <String, dynamic>{}),
          };
          final reviews = detail['reviews'] is List<dynamic>
              ? detail['reviews'] as List<dynamic>
              : [];
          final services = detail['services'] is List<dynamic>
              ? detail['services'] as List<dynamic>
              : [];
          final displayName = detail['displayName'] as String? ?? 'Partner';
          final rating = providerAverageRating(detail);
          final reviewCount = providerReviewCount(detail);
          final experienceYears = asNum(detail['experienceYears'])?.toInt();
          final specialties = asStringList(detail['specialties']);
          final languages = asStringList(detail['languages']);
          final serviceStyle = detail['serviceStyle']?.toString().trim() ?? '';
          final galleryImageUrls = _partnerMediaUrls(detail);
          final availability = _partnerAvailability(detail);
          final city = detail['city']?.toString().trim() ?? '';
          final serviceGroups = customerServiceOptionGroups(
            services,
            requestedLocale: Localizations.localeOf(context).languageCode,
          );

          return CustomScrollView(
            slivers: [
              SliverAppBar(
                expandedHeight: portraitHeight,
                pinned: true,
                leading: Padding(
                  padding: const EdgeInsets.all(8),
                  child: IconButton.filledTonal(
                    tooltip: 'Back',
                    onPressed: () => Navigator.of(context).maybePop(),
                    icon: const Icon(Icons.arrow_back_rounded),
                  ),
                ),
                backgroundColor: colors.canvas,
                surfaceTintColor: Colors.transparent,
                actions: [
                  IconButton.filledTonal(
                    tooltip: 'Copy partner link',
                    onPressed: _copyShareLink,
                    icon: const Icon(Icons.ios_share_rounded),
                  ),
                  ProviderFavoriteAction(
                    loader: widget.favoriteLoader,
                    onChanged: widget.onFavoriteChanged,
                  ),
                  const SizedBox(width: 12),
                ],
                flexibleSpace: FlexibleSpaceBar(
                  background: PartnerHeroMedia(
                    displayName: displayName,
                    imageUrl: providerProfileImageUrl(detail),
                  ),
                ),
              ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(
                    CustomerSpacing.page,
                    22,
                    CustomerSpacing.page,
                    40,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Text(
                              displayName,
                              style: Theme.of(context).textTheme.headlineMedium,
                            ),
                          ),
                          const SizedBox(width: 12),
                          PartnerAvailabilityBadge(
                            label: availability.label,
                            availableNow: availability.availableNow,
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 14,
                        runSpacing: 8,
                        children: [
                          PartnerMetaItem(
                            icon: Icons.star_rounded,
                            iconColor: colors.primary,
                            label:
                                '${rating.toStringAsFixed(1)} ($reviewCount)',
                          ),
                          PartnerMetaItem(
                            icon: Icons.location_on_outlined,
                            label:
                                providerDistanceLabel(widget.providerPreview),
                          ),
                          if (city.isNotEmpty)
                            PartnerMetaItem(
                              icon: Icons.place_outlined,
                              label: city,
                            ),
                          if (galleryImageUrls.length > 1)
                            PartnerMetaItem(
                              icon: Icons.photo_library_outlined,
                              label: '${galleryImageUrls.length} photos',
                            ),
                        ],
                      ),
                      const SizedBox(height: 20),
                      const PartnerTrustStrip(),
                      const SizedBox(height: 28),
                      SectionHeader(
                        title: 'Choose a service',
                        trailing: serviceGroups.isEmpty
                            ? null
                            : Text(
                                '${serviceGroups.length} type${serviceGroups.length == 1 ? '' : 's'}',
                                style: Theme.of(context)
                                    .textTheme
                                    .bodySmall
                                    ?.copyWith(fontWeight: FontWeight.w600),
                              ),
                      ),
                      const SizedBox(height: 12),
                      if (serviceGroups.isEmpty)
                        const EmptyPanel(
                          text:
                              'This partner does not have an available service right now.',
                        )
                      else
                        for (final group in serviceGroups)
                          ServiceOptionGroupCard(
                            group: group,
                            onBook: (service) =>
                                widget.onBookService(detail, service),
                          ),
                      const SizedBox(height: 28),
                      const Divider(),
                      const SizedBox(height: 26),
                      const SectionHeader(title: 'About'),
                      const SizedBox(height: 12),
                      Text(
                        _localizedPartnerBio(context, detail) ??
                            'This partner has not added an introduction yet.',
                        style: Theme.of(context).textTheme.bodyLarge,
                      ),
                      if (serviceStyle.isNotEmpty) ...[
                        const SizedBox(height: 14),
                        PartnerProfileNote(
                          icon: Icons.spa_outlined,
                          label: serviceStyle,
                        ),
                      ],
                      const SizedBox(height: 16),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          if (experienceYears != null)
                            DetailFactChip(
                              icon: Icons.workspace_premium_outlined,
                              label: '$experienceYears years',
                            ),
                          DetailFactChip(
                            icon: Icons.room_service_outlined,
                            label:
                                '${serviceGroups.fold<int>(0, (sum, group) => sum + group.options.length)} options',
                          ),
                          if (languages.isNotEmpty)
                            DetailFactChip(
                              icon: Icons.translate_outlined,
                              label: languages.take(3).join(', '),
                            ),
                        ],
                      ),
                      if (specialties.isNotEmpty) ...[
                        const SizedBox(height: 14),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            for (final specialty in specialties.take(8))
                              ServiceTag(label: specialty),
                          ],
                        ),
                      ],
                      if (galleryImageUrls.isNotEmpty) ...[
                        const SizedBox(height: 28),
                        const Divider(),
                        const SizedBox(height: 26),
                        SectionHeader(
                          title: 'Photos',
                          trailing: Text(
                            '${galleryImageUrls.length}',
                            style: Theme.of(context)
                                .textTheme
                                .bodySmall
                                ?.copyWith(fontWeight: FontWeight.w600),
                          ),
                        ),
                        const SizedBox(height: 12),
                        SizedBox(
                          height: 118,
                          child: ListView.separated(
                            scrollDirection: Axis.horizontal,
                            itemCount: galleryImageUrls.length,
                            separatorBuilder: (context, index) =>
                                const SizedBox(width: 10),
                            itemBuilder: (context, index) => HandsPortraitStage(
                              name: displayName,
                              imageUrl: galleryImageUrls[index],
                              width: 94,
                              height: 118,
                            ),
                          ),
                        ),
                      ],
                      const SizedBox(height: 28),
                      const Divider(),
                      const SizedBox(height: 26),
                      SectionHeader(
                        title: 'Reviews',
                        trailing: Text(
                          '$reviewCount total',
                          style:
                              Theme.of(context).textTheme.bodySmall?.copyWith(
                                    fontWeight: FontWeight.w600,
                                  ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      ReviewSummaryCard(
                        rating: rating,
                        reviewCount: reviewCount,
                      ),
                      const SizedBox(height: 12),
                      if (reviews.isEmpty)
                        const EmptyPanel(text: 'No reviews yet.')
                      else
                        for (final review in reviews)
                          ReviewCard(review: review as Map<String, dynamic>),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

List<String> _partnerMediaUrls(Map<String, dynamic> detail) {
  final urls = <String>[];
  final profile = providerProfileImageUrl(detail);
  if (profile != null && profile.isNotEmpty) {
    urls.add(profile);
  }
  for (final url in asStringList(detail['galleryImageUrls'])) {
    if (url.isNotEmpty && !urls.contains(url)) {
      urls.add(url);
    }
  }
  return urls;
}

PartnerAvailability _partnerAvailability(Map<String, dynamic> detail) {
  switch (detail['status']?.toString()) {
    case 'ONLINE_AVAILABLE':
      return const PartnerAvailability(
        label: 'Available now',
        availableNow: true,
      );
    case 'ONLINE_AVAILABLE_SOON':
      return const PartnerAvailability(
        label: 'Available soon',
        availableNow: false,
      );
    default:
      return const PartnerAvailability(
        label: 'Unavailable',
        availableNow: false,
      );
  }
}

class PartnerAvailability {
  const PartnerAvailability({
    required this.label,
    required this.availableNow,
  });

  final String label;
  final bool availableNow;
}

class PartnerHeroMedia extends StatelessWidget {
  const PartnerHeroMedia({
    super.key,
    required this.displayName,
    required this.imageUrl,
  });

  final String displayName;
  final String? imageUrl;
  @override
  Widget build(BuildContext context) {
    return HandsPortraitStage(
      name: displayName,
      imageUrl: imageUrl,
      borderRadius: const BorderRadius.vertical(
        bottom: Radius.circular(HandsShapes.large),
      ),
    );
  }
}

class PartnerAvailabilityBadge extends StatelessWidget {
  const PartnerAvailabilityBadge({
    super.key,
    required this.label,
    required this.availableNow,
  });

  final String label;
  final bool availableNow;

  @override
  Widget build(BuildContext context) {
    final colors = context.handsColors;
    final color = availableNow ? colors.success : colors.inkMuted;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(HandsShapes.full),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: color,
                  fontWeight: FontWeight.w600,
                ),
          ),
        ],
      ),
    );
  }
}

class PartnerMetaItem extends StatelessWidget {
  const PartnerMetaItem({
    super.key,
    required this.icon,
    required this.label,
    this.iconColor,
  });

  final IconData icon;
  final String label;
  final Color? iconColor;

  @override
  Widget build(BuildContext context) {
    final colors = context.handsColors;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 18, color: iconColor ?? colors.inkMuted),
        const SizedBox(width: 4),
        Text(label, style: Theme.of(context).textTheme.bodyMedium),
      ],
    );
  }
}

class PartnerTrustStrip extends StatelessWidget {
  const PartnerTrustStrip({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.handsColors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 15),
      decoration: BoxDecoration(
        color: colors.surfaceMuted,
        border: Border.all(color: colors.outline),
        borderRadius: BorderRadius.circular(HandsShapes.medium),
      ),
      child: const Row(
        children: [
          Expanded(
            child: PartnerTrustItem(
              icon: Icons.verified_user_outlined,
              label: 'Verified',
            ),
          ),
          PartnerTrustDivider(),
          Expanded(
            child: PartnerTrustItem(
              icon: Icons.payments_outlined,
              label: 'Upfront price',
            ),
          ),
          PartnerTrustDivider(),
          Expanded(
            child: PartnerTrustItem(
              icon: Icons.home_outlined,
              label: 'At your place',
            ),
          ),
        ],
      ),
    );
  }
}

class PartnerTrustDivider extends StatelessWidget {
  const PartnerTrustDivider({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 1,
      height: 34,
      margin: const EdgeInsets.symmetric(horizontal: 6),
      color: context.handsColors.outline,
    );
  }
}

class PartnerTrustItem extends StatelessWidget {
  const PartnerTrustItem({
    super.key,
    required this.icon,
    required this.label,
  });

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.handsColors;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 21, color: colors.primary),
        const SizedBox(height: 6),
        Text(
          label,
          textAlign: TextAlign.center,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: colors.ink,
                fontWeight: FontWeight.w600,
              ),
        ),
      ],
    );
  }
}

class PartnerProfileNote extends StatelessWidget {
  const PartnerProfileNote({
    super.key,
    required this.icon,
    required this.label,
  });

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.handsColors;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 20, color: colors.primary),
        const SizedBox(width: 10),
        Expanded(
          child: Text(label, style: Theme.of(context).textTheme.bodyMedium),
        ),
      ],
    );
  }
}

String? _localizedPartnerBio(
  BuildContext context,
  Map<String, dynamic> detail,
) {
  final translations = detail['bioTranslations'];
  if (translations is Map) {
    final languageCode =
        Localizations.localeOf(context).languageCode.toLowerCase();
    final translated = translations[languageCode]?.toString().trim();
    if (translated != null && translated.isNotEmpty) {
      return translated;
    }
  }

  final vietnamese = detail['bio']?.toString().trim();
  return vietnamese == null || vietnamese.isEmpty ? null : vietnamese;
}

class ProviderFavoriteAction extends StatefulWidget {
  const ProviderFavoriteAction({
    super.key,
    this.loader,
    this.onChanged,
  });

  final Future<bool> Function()? loader;
  final Future<void> Function(bool favorite)? onChanged;

  @override
  State<ProviderFavoriteAction> createState() => _ProviderFavoriteActionState();
}

class _ProviderFavoriteActionState extends State<ProviderFavoriteAction> {
  bool _favorite = false;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _loadFavorite();
  }

  @override
  void didUpdateWidget(covariant ProviderFavoriteAction oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.loader != widget.loader) {
      _loadFavorite();
    }
  }

  Future<void> _loadFavorite() async {
    final loader = widget.loader;
    if (loader == null) {
      return;
    }

    setState(() => _loading = true);
    try {
      final favorite = await loader();
      if (!mounted) {
        return;
      }
      setState(() => _favorite = favorite);
    } catch (_) {
      // Favorite state is optional; keep the profile readable if sync fails.
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _toggleFavorite() async {
    final onChanged = widget.onChanged;
    if (onChanged == null || _loading) {
      return;
    }

    final next = !_favorite;
    setState(() {
      _favorite = next;
      _loading = true;
    });

    try {
      await onChanged(next);
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(next ? 'Partner saved.' : 'Partner removed.')),
      );
    } catch (exception) {
      if (!mounted) {
        return;
      }
      setState(() => _favorite = !next);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            customerErrorMessage(
              exception,
              fallback: 'Saved partner could not be updated.',
            ),
          ),
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.handsColors;
    final disabled = widget.onChanged == null || _loading;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: IconButton.filledTonal(
        tooltip: _favorite ? 'Remove saved partner' : 'Save partner',
        onPressed: disabled ? null : _toggleFavorite,
        icon: _loading
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : Icon(
                _favorite ? Icons.favorite : Icons.favorite_border,
                color: _favorite ? colors.error : colors.primary,
              ),
      ),
    );
  }
}

class ServiceOptionGroupCard extends StatelessWidget {
  const ServiceOptionGroupCard({
    super.key,
    required this.group,
    required this.onBook,
  });

  final CustomerServiceOptionGroup group;
  final ValueChanged<Map<String, dynamic>> onBook;

  @override
  Widget build(BuildContext context) {
    final colors = context.handsColors;
    final description = group.options.isEmpty
        ? ''
        : group.options.first['description']?.toString().trim() ?? '';
    return Container(
      margin: const EdgeInsets.only(bottom: HandsSpacing.space16),
      padding: const EdgeInsets.only(bottom: HandsSpacing.space16),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: colors.outline)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Text(
                    group.name,
                    style: Theme.of(context)
                        .textTheme
                        .titleLarge
                        ?.copyWith(fontWeight: FontWeight.w700),
                  ),
                ),
                const SizedBox(width: 12),
                Text(
                  customerServiceGroupPriceRangeLabel(group),
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: colors.primary,
                        fontWeight: FontWeight.w700,
                      ),
                ),
              ],
            ),
            if (description.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(
                description,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context)
                    .textTheme
                    .bodySmall
                    ?.copyWith(color: colors.inkMuted),
              ),
            ],
            const SizedBox(height: 14),
            for (final option in group.options) ...[
              ServiceDurationOptionTile(
                service: option,
                onBook: () => onBook(option),
              ),
              if (option != group.options.last) const SizedBox(height: 10),
            ],
          ],
        ),
      ),
    );
  }
}

class ServiceDurationOptionTile extends StatelessWidget {
  const ServiceDurationOptionTile({
    super.key,
    required this.service,
    required this.onBook,
  });

  final Map<String, dynamic> service;
  final VoidCallback onBook;

  @override
  Widget build(BuildContext context) {
    final colors = context.handsColors;
    final duration = asNum(service['durationMin'])?.toInt();
    final price = customerServicePrice(service);

    return Container(
      padding: const EdgeInsets.fromLTRB(14, 13, 10, 13),
      decoration: BoxDecoration(
        color: colors.surfaceMuted,
        borderRadius: BorderRadius.circular(HandsShapes.medium),
      ),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: colors.surface,
              borderRadius: BorderRadius.circular(HandsShapes.small),
            ),
            child: Text(
              '${duration ?? '-'}',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
          ),
          const SizedBox(width: 11),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${duration ?? '-'} minutes',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: 2),
                Text(
                  '${formatCurrency(price)} VND',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          FilledButton(
            onPressed: onBook,
            style: FilledButton.styleFrom(
              minimumSize: const Size(82, 42),
              padding: const EdgeInsets.symmetric(horizontal: 14),
            ),
            child: const Text('Select'),
          ),
        ],
      ),
    );
  }
}

class DurationPill extends StatelessWidget {
  const DurationPill({super.key, required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.handsColors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: colors.surfaceMuted,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(label,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: colors.ink,
                fontWeight: FontWeight.w600,
              )),
    );
  }
}

class SectionHeader extends StatelessWidget {
  const SectionHeader({
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
              Text(
                title,
                style: Theme.of(context)
                    .textTheme
                    .headlineSmall
                    ?.copyWith(fontWeight: FontWeight.w700),
              ),
              if (subtitle != null && subtitle!.isNotEmpty) ...[
                const SizedBox(height: 5),
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
        if (trailing != null) ...[
          const SizedBox(width: 12),
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: trailing,
          ),
        ],
      ],
    );
  }
}

class DetailFactChip extends StatelessWidget {
  const DetailFactChip({
    super.key,
    required this.icon,
    required this.label,
  });

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.handsColors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
      decoration: BoxDecoration(
        color: colors.surfaceMuted,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: colors.outline),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: colors.primary),
          const SizedBox(width: 6),
          Text(
            label,
            style: Theme.of(context)
                .textTheme
                .bodyMedium
                ?.copyWith(fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}

class ReviewSummaryCard extends StatelessWidget {
  const ReviewSummaryCard({
    super.key,
    required this.rating,
    required this.reviewCount,
  });

  final double rating;
  final int reviewCount;

  @override
  Widget build(BuildContext context) {
    final colors = context.handsColors;
    return Container(
      decoration: BoxDecoration(
        color: colors.surfaceMuted,
        border: Border.all(color: colors.outline),
        borderRadius: BorderRadius.circular(HandsShapes.medium),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 58,
              height: 58,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: colors.primarySoft,
                borderRadius: BorderRadius.circular(HandsShapes.small),
              ),
              child: Icon(
                Icons.star_rounded,
                size: 30,
                color: colors.primary,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    rating.toStringAsFixed(1),
                    style: Theme.of(context)
                        .textTheme
                        .headlineMedium
                        ?.copyWith(fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    reviewCount == 0
                        ? 'No reviews yet'
                        : 'Based on $reviewCount verified review${reviewCount == 1 ? '' : 's'}',
                    style: Theme.of(context).textTheme.bodySmall,
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

class ReviewCard extends StatelessWidget {
  const ReviewCard({super.key, required this.review});

  final Map<String, dynamic> review;

  @override
  Widget build(BuildContext context) {
    final colors = context.handsColors;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: colors.outline)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 18,
                  backgroundColor: colors.primarySoft,
                  child: Icon(
                    Icons.person_outline,
                    size: 18,
                    color: colors.primary,
                  ),
                ),
                const SizedBox(width: 12),
                Text(
                    review['managedByAdmin'] == true
                        ? 'Customer review · HANDS entered'
                        : 'Customer',
                    style: Theme.of(context)
                        .textTheme
                        .titleMedium
                        ?.copyWith(fontWeight: FontWeight.w700)),
                const Spacer(),
                Text(
                  review['createdAt']?.toString().split('T').first ?? '',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: List.generate(
                5,
                (index) => Icon(
                  index < (asNum(review['rating'])?.toInt() ?? 0)
                      ? Icons.star_rounded
                      : Icons.star_outline_rounded,
                  size: 18,
                  color: colors.primary,
                ),
              ),
            ),
            const SizedBox(height: 10),
            Text(review['comment'] as String? ?? 'No comment'),
          ],
        ),
      ),
    );
  }
}
