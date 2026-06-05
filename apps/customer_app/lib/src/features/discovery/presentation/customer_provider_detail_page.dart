import 'package:flutter/material.dart';

import '../../../core/customer_value_helpers.dart';
import '../../../core/widgets/customer_feedback_panels.dart';
import '../../booking/presentation/customer_booking_ui_helpers.dart';
import '../../map/presentation/customer_map_widgets.dart';
import 'customer_service_option_helpers.dart';

class ProviderDetailPage extends StatelessWidget {
  const ProviderDetailPage({
    super.key,
    required this.providerPreview,
    required this.loader,
    required this.onBookService,
  });

  final Map<String, dynamic> providerPreview;
  final Future<Map<String, dynamic>> Function() loader;
  final Future<void> Function(
      Map<String, dynamic> detail, Map<String, dynamic> service) onBookService;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: FutureBuilder<Map<String, dynamic>>(
        future: loader(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          final detail = <String, dynamic>{
            ...providerPreview,
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
          final galleryImageUrls = asStringList(detail['galleryImageUrls']);
          final photoCount =
              galleryImageUrls.isEmpty ? 1 : galleryImageUrls.length;

          return CustomScrollView(
            slivers: [
              SliverAppBar(
                expandedHeight: 360,
                pinned: true,
                leading: const BackButton(color: Colors.black),
                backgroundColor: Colors.white,
                actions: const [
                  CircleAvatar(
                      radius: 18,
                      backgroundColor: Colors.white,
                      child: Icon(Icons.favorite_border, color: Colors.black)),
                  SizedBox(width: 8),
                  CircleAvatar(
                      radius: 18,
                      backgroundColor: Colors.white,
                      child: Icon(Icons.share_outlined, color: Colors.black)),
                  SizedBox(width: 12),
                ],
                flexibleSpace: FlexibleSpaceBar(
                  background: Stack(
                    fit: StackFit.expand,
                    children: [
                      Container(
                        decoration: const BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: [
                              Color(0xFFF7E8C8),
                              Color(0xFFE9DCC7),
                              Color(0xFFD6E2CF)
                            ],
                          ),
                        ),
                      ),
                      Center(
                        child: ProviderThumbnail(
                          name: displayName,
                          size: 210,
                          imageUrl: providerProfileImageUrl(detail),
                        ),
                      ),
                      Positioned(
                        right: 20,
                        bottom: 20,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 8),
                          decoration: BoxDecoration(
                            color: Colors.black54,
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text('1 / $photoCount',
                              style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w700)),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(displayName,
                          style: Theme.of(context)
                              .textTheme
                              .headlineMedium
                              ?.copyWith(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          const Icon(Icons.location_on_outlined,
                              size: 22, color: Colors.grey),
                          const SizedBox(width: 4),
                          Text(formatDistance(
                              asDouble(providerPreview['distanceMeters']))),
                          const SizedBox(width: 14),
                          const Icon(Icons.star_rounded,
                              size: 22, color: Color(0xFFF59E0B)),
                          const SizedBox(width: 4),
                          Text(
                              '${rating.toStringAsFixed(1)} ($reviewCount reviews)'),
                        ],
                      ),
                      const SizedBox(height: 16),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: const [
                          ServiceTag(label: 'Available soon'),
                          ServiceTag(label: 'Direct request'),
                          ServiceTag(label: 'Marketplace matching'),
                        ],
                      ),
                      const SizedBox(height: 18),
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          border: Border.all(color: const Color(0xFF8AA773)),
                          borderRadius: BorderRadius.circular(18),
                          color: const Color(0xFFF9FCF6),
                        ),
                        child: const Column(
                          children: [
                            Row(
                              children: [
                                Icon(Icons.verified_user_outlined,
                                    color: Color(0xFF5E8E4A)),
                                SizedBox(width: 10),
                                Expanded(
                                    child: Text(
                                        'No required extra fee, no travel fee')),
                              ],
                            ),
                            SizedBox(height: 10),
                            Row(
                              children: [
                                Icon(Icons.shield_outlined,
                                    color: Color(0xFF5E8E4A)),
                                SizedBox(width: 10),
                                Expanded(
                                    child: Text(
                                        'Protected when the assigned partner changes')),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),
                      const SectionHeader(
                        title: 'About me',
                        subtitle:
                            'Profile, service style, and guest expectations before booking.',
                      ),
                      const SizedBox(height: 12),
                      DetailInfoCard(
                        child: Text(
                          (detail['bio'] as String?) ??
                              'Experienced partner profile ready for booking.',
                          style: Theme.of(context).textTheme.bodyLarge,
                        ),
                      ),
                      if (serviceStyle.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        DetailInfoCard(
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Icon(Icons.room_service_outlined,
                                  color: Color(0xFF5E8E4A)),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  serviceStyle,
                                  style: Theme.of(context).textTheme.bodyLarge,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                      const SizedBox(height: 16),
                      DetailInfoCard(
                        child: Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          children: [
                            if (experienceYears != null)
                              DetailFactChip(
                                icon: Icons.workspace_premium_outlined,
                                label: '$experienceYears year(s) experience',
                              ),
                            const DetailFactChip(
                              icon: Icons.timer_outlined,
                              label: 'Typical response within minutes',
                            ),
                            DetailFactChip(
                              icon: Icons.spa_outlined,
                              label: '${services.length} service option(s)',
                            ),
                            DetailFactChip(
                              icon: Icons.star_outline_rounded,
                              label: '$reviewCount verified review(s)',
                            ),
                            if (languages.isNotEmpty)
                              DetailFactChip(
                                icon: Icons.translate_outlined,
                                label: languages.take(3).join(', '),
                              ),
                          ],
                        ),
                      ),
                      if (specialties.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        DetailInfoCard(
                          child: Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              for (final specialty in specialties.take(8))
                                ServiceTag(label: specialty),
                            ],
                          ),
                        ),
                      ],
                      if (galleryImageUrls.isNotEmpty) ...[
                        const SizedBox(height: 24),
                        const SectionHeader(
                          title: 'Photos',
                          subtitle:
                              'Public profile and work photos from this partner.',
                        ),
                        const SizedBox(height: 12),
                        SizedBox(
                          height: 112,
                          child: ListView.separated(
                            scrollDirection: Axis.horizontal,
                            itemCount: galleryImageUrls.length,
                            separatorBuilder: (context, index) =>
                                const SizedBox(width: 12),
                            itemBuilder: (context, index) {
                              return ProviderThumbnail(
                                name: displayName,
                                size: 112,
                                imageUrl: galleryImageUrls[index],
                              );
                            },
                          ),
                        ),
                      ],
                      const SizedBox(height: 28),
                      const SectionHeader(
                        title: 'My services',
                        subtitle:
                            'Choose one service to open a booking request with this partner first.',
                      ),
                      const SizedBox(height: 12),
                      Builder(
                        builder: (context) {
                          final serviceGroups =
                              customerServiceOptionGroups(services);
                          if (serviceGroups.isEmpty) {
                            return const EmptyPanel(
                              text:
                                  'This partner has no bookable service options yet. HANDS requires an active partner price and an exact admin payout rule before booking.',
                            );
                          }
                          return Column(
                            children: [
                              for (final group in serviceGroups)
                                ServiceOptionGroupCard(
                                  group: group,
                                  onBook: (service) =>
                                      onBookService(detail, service),
                                ),
                            ],
                          );
                        },
                      ),
                      const SizedBox(height: 28),
                      Row(
                        children: [
                          const Expanded(
                            child: SectionHeader(
                              title: 'Reviews',
                              subtitle:
                                  'Recent guest feedback and overall rating distribution.',
                            ),
                          ),
                          TextButton(
                              onPressed: () {}, child: const Text('View all')),
                        ],
                      ),
                      ReviewSummaryCard(
                        rating: rating,
                        reviewCount: reviewCount,
                      ),
                      const SizedBox(height: 12),
                      if (reviews.isEmpty)
                        const EmptyPanel(text: 'No reviews yet.')
                      else
                        for (final review in reviews.take(3))
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
    return Card(
      margin: const EdgeInsets.only(bottom: 14),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(group.name,
                style: Theme.of(context)
                    .textTheme
                    .titleLarge
                    ?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            Text(
              'Choose a time option. The selected partner gets the first response window, and marketplace partner options can open if needed.',
              style: Theme.of(context)
                  .textTheme
                  .bodyMedium
                  ?.copyWith(color: Colors.black54),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                DurationPill(label: customerServiceGroupDurationSummary(group)),
                DurationPill(label: customerServiceGroupPriceRangeLabel(group)),
                const DurationPill(label: 'First-pick request'),
                const DurationPill(label: 'Marketplace matching'),
              ],
            ),
            const SizedBox(height: 18),
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
    final duration = asNum(service['durationMin'])?.toInt();
    final price = customerServicePrice(service);
    final basePrice = asNum(service['basePrice'])?.toInt();
    final hasProviderPrice =
        basePrice != null && basePrice > 0 && price != basePrice;
    final policyLabel = customerServicePricePolicyLabel(service);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              DurationPill(label: '${duration ?? '-'} min'),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  policyLabel,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: const Color(0xFF5E8E4A),
                        fontWeight: FontWeight.w700,
                      ),
                ),
              ),
              const SizedBox(width: 8),
              Flexible(
                child: Text(
                  '${formatCurrency(price)} VND',
                  textAlign: TextAlign.right,
                  style: Theme.of(context)
                      .textTheme
                      .titleMedium
                      ?.copyWith(fontWeight: FontWeight.w800),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: onBook,
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF5E8E4A),
                foregroundColor: Colors.white,
              ),
              child: Text('Reserve ${duration ?? '-'} min'),
            ),
          ),
          if (hasProviderPrice) ...[
            const SizedBox(height: 8),
            Text(
              'Partner price selected. Admin minimum ${formatCurrency(basePrice)} VND.',
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(color: Colors.black54),
            ),
          ],
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
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
        borderRadius: BorderRadius.circular(24),
      ),
      child: Text(label, style: Theme.of(context).textTheme.labelLarge),
    );
  }
}

class SectionHeader extends StatelessWidget {
  const SectionHeader({
    super.key,
    required this.title,
    required this.subtitle,
  });

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: Theme.of(context)
              .textTheme
              .headlineSmall
              ?.copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 6),
        Text(
          subtitle,
          style: Theme.of(context)
              .textTheme
              .bodyMedium
              ?.copyWith(color: Colors.black54),
        ),
      ],
    );
  }
}

class DetailInfoCard extends StatelessWidget {
  const DetailInfoCard({
    super.key,
    required this.child,
  });

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFF9F8F4),
        borderRadius: BorderRadius.circular(18),
      ),
      child: child,
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
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: const Color(0xFFE6E0D2)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: const Color(0xFF5E8E4A)),
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
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${rating.toStringAsFixed(1)} / 5',
                    style: Theme.of(context)
                        .textTheme
                        .headlineMedium
                        ?.copyWith(fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: List.generate(
                      5,
                      (_) => const Icon(
                        Icons.star_rounded,
                        size: 20,
                        color: Color(0xFFF59E0B),
                      ),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text('($reviewCount reviews)'),
                ],
              ),
            ),
            Expanded(
              child: Column(
                children: List.generate(
                  5,
                  (index) {
                    final stars = 5 - index;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Row(
                        children: [
                          Text('$stars'),
                          const SizedBox(width: 8),
                          const Icon(Icons.star_rounded,
                              size: 18, color: Color(0xFFF59E0B)),
                          const SizedBox(width: 8),
                          Expanded(
                            child: LinearProgressIndicator(
                              value: stars == 5 ? 1 : 0,
                              minHeight: 8,
                              borderRadius: BorderRadius.circular(999),
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
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
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const CircleAvatar(child: Icon(Icons.person_outline)),
                const SizedBox(width: 12),
                Text('Customer',
                    style: Theme.of(context)
                        .textTheme
                        .titleMedium
                        ?.copyWith(fontWeight: FontWeight.w700)),
                const Spacer(),
                Text(review['createdAt']?.toString().split('T').first ?? ''),
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
                  color: const Color(0xFFF59E0B),
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
