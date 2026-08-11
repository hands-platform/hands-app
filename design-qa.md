# Customer Booking Flow Design QA

## Visual target

- Approved customer Partner Detail visual system:
  `artifacts/customer-podo-partner-detail-v3.png`
- Existing Podo-derived customer design tokens:
  `apps/customer_app/lib/src/core/customer_design_system.dart`

## Implementation

- Booking review:
  `artifacts/customer-booking-review-final.png`
- Side-by-side comparison:
  `artifacts/customer-podo-booking-design-comparison.png`
- Booking progress:
  `artifacts/customer-booking-progress-final.png`
- Booking progress comparison:
  `artifacts/customer-podo-booking-progress-comparison.png`
- My Bookings active state:
  `artifacts/customer-bookings-active.png`
- My Bookings history state:
  `artifacts/customer-bookings-history.png`
- My Bookings comparison:
  `artifacts/customer-podo-bookings-comparison.png`
- Booking Partner discovery:
  `artifacts/customer-booking-nearby-partners-final.png`
- Booking discovery visual comparison:
  `artifacts/customer-podo-booking-discovery-comparison.png`
- Booking Partner detail and service selection:
  `artifacts/customer-booking-partner-detail.png`
- Booking Partner reviews:
  `artifacts/customer-booking-partner-detail-reviews.png`

## Checks

- Typography, neutral canvas, white surfaces, outlines, primary violet, and
  lavender icon surfaces match the approved customer screen.
- Service, location, contact, payment, coupon, total, and primary action are
  presented in customer decision order.
- Internal matching and pricing-policy language is not rendered.
- Service and payment totals are not repeated across multiple summary cards.
- The bottom action keeps total and the next action visible without resizing
  the page.
- Location selection, payment selection, coupon input, and booking submission
  remain interactive.
- Booking progress prioritizes the current status, remaining confirmation time,
  assigned Partner, and booking facts without exposing matching-policy terms.
- Open matching keeps refresh and direct cancellation available. Matched,
  travel, arrival, and in-service states replace the next-step copy without
  changing routes.
- Closed bookings no longer imply a live Partner location or an active Partner
  state.
- My Bookings separates current services from historical records using the
  actual booking-status contract rather than a decorative empty tab.
- Booking cards use customer-facing status, payment, date, and next-action
  labels. Raw booking and payment enums are not rendered.
- The entire booking card opens its existing detail route; pull-to-refresh and
  the compact refresh action remain functional.
- The bottom Booking destination opens Partner discovery rather than booking
  history. Nearby Partners are sorted by distance from the selected service
  address, with unknown distances placed last.
- Partner discovery keeps the selected address, refresh, and nearest-first
  context visible while putting Partner cards above secondary map or
  diagnostic content.
- Selecting a Partner opens the existing detail screen with profile media,
  service duration and price options, booking selection, and verified reviews.
- My Bookings remains available from More, while booking and payment
  notification deep links continue to open the relevant booking record.
- Pixel 6 viewport has no clipped buttons, incoherent overlaps, or horizontal
  overflow.

## Follow-up polish

- Replace local smoke profile-media records that point at missing MinIO objects
  when realistic photography is available.

## Home How Showcase V3

- Reference: Uncode Creative Wellness three-slide image story.
- Reference desktop capture:
  `C:\dev\massage-on-demand-vn\design-qa-source-how-v3.png`
- HANDS desktop capture:
  `C:\dev\massage-on-demand-vn\design-qa-hands-how-v3.png`
- Desktop comparison:
  `C:\dev\massage-on-demand-vn\design-qa-hands-how-comparison-v3.png`
- Reference and HANDS mobile comparison:
  `C:\dev\massage-on-demand-vn\design-qa-hands-how-mobile-comparison-v3.png`
- The How section now uses a full-frame rounded image, a high-contrast story
  panel, three working stage controls, and localized titles and descriptions.
- Removed the homepage recruitment and safety sections. The safety navigation
  now opens the dedicated localized safety route instead of a removed anchor.
- Verified the stage controls, desktop wrapping, and horizontal overflow.
- No actionable P0, P1, or P2 visual mismatch remains.

final result: passed

---

# Partner Support Halsa Features Clone

## Source truth and implementation

- Source URL: `https://halsa-template.framer.website/features`
- Source scope: `main.framer-1c6yuda`; source header and footer excluded.
- Implementation route: `http://localhost:3200/ko/partner-support`
- Insert position: immediately before `section#benefits.recruitment-statement`.
- Desktop source captures:
  `artifacts/halsa-features-clone/source-desktop-y0000.png`,
  `source-desktop-y1300-verified.png`, and
  `source-desktop-y1950-verified.png`.
- Desktop implementation captures:
  `artifacts/halsa-features-clone/implementation-desktop-y0000-final.png`,
  `implementation-desktop-y1300-final.png`, and
  `implementation-desktop-y1950-final.png`.
- Mobile source captures:
  `artifacts/halsa-features-clone/source-mobile-y0000.png`,
  `source-mobile-y1200.png`, `source-mobile-y2400.png`, and
  `source-mobile-y3000.png`.
- Mobile implementation captures:
  `artifacts/halsa-features-clone/implementation-mobile-y0000-final.png`,
  `implementation-mobile-y1200-final.png`,
  `implementation-mobile-y2400-final.png`, and
  `implementation-mobile-y3000-final.png`.
- Device pixel ratio: `1`.
- Compared viewport states: desktop `1440 x 900`, tablet `1000 x 900`, and
  mobile `390 x 844` CSS pixels.

## Same-input comparison evidence

- Desktop top:
  `artifacts/halsa-features-clone/comparison-desktop-top-final.png`
- Desktop cards:
  `artifacts/halsa-features-clone/comparison-desktop-cards-final.png`
- Desktop CTA entry:
  `artifacts/halsa-features-clone/comparison-desktop-cta-top-final.png`
- Desktop CTA/app preview:
  `artifacts/halsa-features-clone/comparison-desktop-cta.png`
- Tablet top/cards:
  `artifacts/halsa-features-clone/comparison-tablet-top.png`
- Mobile top:
  `artifacts/halsa-features-clone/comparison-mobile-top-final.png`
- Mobile cards:
  `artifacts/halsa-features-clone/comparison-mobile-middle-final.png` and
  `comparison-mobile-lower-final.png`
- Mobile CTA/app preview:
  `artifacts/halsa-features-clone/comparison-mobile-cta-final.png`

## Findings

- Typography: the exact local DM Sans source font, sizes, weights, line
  heights, wrapping, and opacity treatments match the reference.
- Spacing and geometry: desktop three-column, tablet two-column, and mobile
  single-column layouts match the measured source widths, gaps, padding,
  radii, and section heights. Desktop clone height differs from the source by
  only subpixel intrinsic-image rounding (`0.156px`).
- Colors: card fills, neutral canvas, overlay gradient, pills, buttons, and
  text contrast match the source values.
- Assets: nine original raster assets, seven original icons, and the original
  DM Sans font are served locally. No source asset is hotlinked or replaced by
  a placeholder.
- Copy: headings, descriptions, labels, CTA text, and the source's intentional
  `Sleep Cicles` spelling are preserved verbatim.
- Responsive behavior: secondary images are hidden at tablet/mobile widths;
  mobile source ordering is preserved; the clone has no horizontal overflow.
- Interaction: scroll-entry motion was verified live and settles at
  `opacity: 1` / `translateY(0)`. CTA destinations resolve to `./pricing` and
  `./features`; duplicate-label hover and keyboard-focus motion is retained.
- Accessibility: semantic sections, headings, lists, link destinations,
  meaningful image alt text, decorative-image hiding, and reduced-motion
  fallback are present.
- No actionable P0, P1, or P2 visual mismatch remains.

## Iteration history

1. The first comparison applied scroll reveal to too many grid items, causing
   temporary row drift. Reveal was limited to the same secondary images and
   CTA used by the source.
2. The first mobile comparison exposed Activity card/image ordering opposite
   to the source. Mobile order was corrected and recaptured.
3. The initial CSS scroll timeline left the CTA partially translucent at the
   comparison state. It was replaced with the source-like one-time viewport
   reveal; the post-fix comparison is fully opaque and aligned.

## Validation

- Public Web typecheck: passed.
- Public Web lint: passed.
- Public Web tests: `7` files, `14` tests passed.
- Public Web production build: passed.
- All `20` rendered clone images loaded successfully in the browser.
- Clone placement immediately before `#benefits`: passed.

final result: passed

---

# Home Method And Draggable Stories V10

- Reference: Creative Wellness `row-unique-10` and `row-unique-15`.
- Desktop side-by-side comparison:
  `C:\dev\massage-on-demand-vn\design-qa-method-desktop-comparison-v9.png`
- Desktop Method: `1265 x 1022`; reference height `1022`.
- Mobile Method: `375 x 1401`; reference height `1401.36`.
- Mobile Method uses `72px` vertical padding, `35/42px` heading,
  `662px` copy lane, and `559px` media lane.
- Desktop story rows respond to pointer drag; mobile rows retain native
  horizontal scrolling and touch panning.
- The home `download-section` was removed without leaving a broken
  `#download` target.
- Browser console errors: none.
- Typecheck, lint, 10 tests, and production build: passed.

final result: passed

---

# Home Editorial Feature Rail V6

- Source sections: Creative Wellness `row-unique-9` and `row-unique-10`.
- Source feature-rail capture:
  `C:\dev\massage-on-demand-vn\design-qa-source-feature-rail-v6.png`
- HANDS feature-rail capture:
  `C:\dev\massage-on-demand-vn\design-qa-hands-feature-rail-v6.png`
- Feature-rail comparison:
  `C:\dev\massage-on-demand-vn\design-qa-feature-rail-comparison-v6.png`
- Source method capture:
  `C:\dev\massage-on-demand-vn\design-qa-source-method-v6.png`
- HANDS method capture:
  `C:\dev\massage-on-demand-vn\design-qa-hands-method-v6.png`
- Method comparison:
  `C:\dev\massage-on-demand-vn\design-qa-method-comparison-v6.png`

## Desktop match

- Viewport: `1280 x 720`.
- Feature cards: `1102.5 x 686`, two equal columns, `18px` track gap,
  `27px` radius, and source colors `#ffe1d6`, `#d7e9ff`, `#cebffa`.
- Scroll progression: track translation starts at `0px`, reaches `-1054px`
  at midpoint, and clamps at `-2109px`.
- Method section: `1265 x 1022`; two `564px` columns with a `72px` gap and a
  `564 x 770` image card.

## Responsive and interaction checks

- At `390 x 844`, sticky movement is disabled and the three feature cards
  stack in source order without horizontal overflow.
- Reduced-motion users receive a static card sequence.
- The feature CTA links and section anchors remain interactive.
- Public Web typecheck, 10 tests, lint, and production build pass.
- No actionable P0, P1, or P2 visual mismatch remains in the side-by-side
  comparisons.

final result: passed

---

# Home Customer Stories And How Panel V5

- Source rows: Creative Wellness `row-unique-15` and `row-unique-16`.
- Source customer stories:
  `C:\dev\massage-on-demand-vn\design-qa-source-testimonials-v4.png`
- HANDS customer stories:
  `C:\dev\massage-on-demand-vn\design-qa-hands-testimonials-exact-v5.png`
- Customer stories comparison:
  `C:\dev\massage-on-demand-vn\design-qa-hands-testimonials-exact-comparison-v5.png`
- Source how panel:
  `C:\dev\massage-on-demand-vn\design-qa-source-how-exact-v5.png`
- HANDS how panel:
  `C:\dev\massage-on-demand-vn\design-qa-hands-how-exact-v5.png`
- How panel comparison:
  `C:\dev\massage-on-demand-vn\design-qa-hands-how-exact-comparison-v5.png`

## Measured match

- Story cards are `560 x 333px`, `#f7f7f7`, `36px` padded, and `16px`
  rounded with an `18px` track gap and the reference edge mask.
- Story rows are scroll-linked rather than autoplayed. A `300px` document
  scroll moves each row `97.8px` in opposite directions.
- Reduced-motion users receive static rows.
- The how panel is `364px` wide with `36px` padding, `16px` rounding, and a
  `50px` backdrop blur over the full-height image stage.
- Browser checks found no horizontal page overflow.
- Public Web typecheck, 9 tests, lint, and production build passed.

final result: passed

---

# HANDS Home Hero and FAQ Design QA

## Visual target

- Source URL:
  `https://undsgn.com/uncode/homepages/creative-wellness/`
- Desktop Hero capture:
  `C:\dev\massage-on-demand-vn\design-qa-source-wellness-hero.png`
- Desktop FAQ capture:
  `C:\dev\massage-on-demand-vn\design-qa-source-wellness-faq.png`
- Mobile Hero capture:
  `C:\dev\massage-on-demand-vn\design-qa-source-wellness-mobile-faq.png`
- Source desktop viewport: `1280 x 720`
- Source mobile viewport: `390 x 844`

## Implementation

- Desktop Hero:
  `C:\dev\massage-on-demand-vn\design-qa-hands-hero-v2.png`
- Desktop FAQ:
  `C:\dev\massage-on-demand-vn\design-qa-hands-faq-v2.png`
- Mobile Hero:
  `C:\dev\massage-on-demand-vn\design-qa-hands-mobile-hero-v2.png`
- Mobile FAQ:
  `C:\dev\massage-on-demand-vn\design-qa-hands-mobile-faq-v2.png`
- Hero comparison:
  `C:\dev\massage-on-demand-vn\design-qa-hands-hero-comparison.png`
- FAQ comparison:
  `C:\dev\massage-on-demand-vn\design-qa-hands-faq-comparison.png`
- Mobile Hero comparison:
  `C:\dev\massage-on-demand-vn\design-qa-hands-mobile-hero-comparison.png`
- Device pixel ratio: `1`

## Full-view comparison evidence

- Hero follows the source composition: an inset rounded full-screen image,
  overlay navigation, oversized left-aligned headline, CTA, and a lower-right
  glass video card.
- Desktop Hero measures the viewport height minus its `18px` outer margins.
- Mobile Hero measures `828px` in an `844px` viewport, leaving only its `8px`
  outer margin and no horizontal overflow.
- The removed app mockup section no longer renders in any locale.
- FAQ follows the source dark split-panel structure with accordion content on
  the left and a rounded editorial image on the right.

## Focused comparison evidence

- Typography: both Hero implementations use a large white display headline,
  compact supporting copy, and restrained button typography.
- Spacing: outer insets, rounded corners, Hero content position, FAQ card gaps,
  and two-column balance match the source hierarchy.
- Colors: white text, translucent video card, dark FAQ canvas, and darker
  accordion surfaces preserve the source contrast.
- Image quality: HANDS-owned local raster assets replace the reference images;
  no source hotlinks or placeholders remain in these sections.
- Copy: HANDS Korean copy replaces fitness copy without changing the source
  information hierarchy.

## Comparison history

1. Initial video used the reference template's unrelated promotional MP4.
2. Replaced it with a local `1280 x 720`, eight-second H.264 motion asset built
   from the HANDS Partner image.
3. Initial mobile Hero left `56px` below the section.
4. Replaced the fixed mobile height with `calc(100svh - 16px)`; post-fix Hero
   fills the viewport with no horizontal overflow.
5. FAQ used independent disclosure panels.
6. Added a shared native `details` name so opening one answer closes the
   previous answer, matching the source accordion.

## Primary interactions tested

- Open and play the Hero video dialog: duration `8s`, playback active.
- Close the video dialog.
- Open a second FAQ answer: open state becomes
  `[false, true, false, false]`.
- Browser console warnings/errors: none.
- Public Web tests, lint, TypeScript and production build: passed.

## Follow-up polish

- Replace the generated HANDS imagery and short motion preview when final brand
  photography and production video are supplied.

final result: passed

---

# HANDS Public Website News and Recruitment Design QA

## Visual target

- Source visual truth:
  `C:\Users\laboy\Desktop\HANDSLOGO\726621160_17932082442305497_7193134824910940148_n.jpg`
- Source pixels: `1350 x 1689`
- Target treatment: vertical editorial thumbnail with a full-image background,
  large sequence number, title, and supporting copy over the image.

## Implementation

- News page capture:
  `C:\dev\massage-on-demand-vn\design-qa-news-full.png`
- Focused news-card capture:
  `C:\dev\massage-on-demand-vn\design-qa-news-card.png`
- Side-by-side focused comparison:
  `C:\dev\massage-on-demand-vn\design-qa-news-comparison.png`
- Recruitment page capture:
  `C:\dev\massage-on-demand-vn\design-qa-recruitment.png`
- Browser viewport: `1440 x 1000` CSS pixels, device pixel ratio `1`
- News card CSS size: `427 x 534`, aspect ratio `4:5`
- State: Korean public news index with built-in published fallback article;
  Vietnamese Partner Support landing page.

## Full-view comparison evidence

- The public news page keeps the article list distinct from the site header and
  footer, with no horizontal overflow.
- The Partner Support page uses a real full-bleed image, readable Vietnamese
  navigation and CTA, and no horizontal overflow.
- Five-language navigation and the footer document routes remain available.

## Focused region comparison evidence

- The source and implementation card were normalized to the same `4:5` ratio in
  `design-qa-news-comparison.png`.
- Both use a full-frame portrait image, strong white sequence number, high
  contrast title, and supporting copy over a darkened image.
- The implementation intentionally omits the source speech bubble because it is
  image-specific editorial art rather than reusable news-card UI.

## Findings

- No actionable P0, P1, or P2 visual mismatch remains.
- Typography: display weight, hierarchy, wrapping, and supporting-copy contrast
  remain legible at desktop and mobile sizes.
- Spacing: card padding and section rhythm are consistent; the card no longer
  stretches beyond the reference proportions.
- Colors: neutral page canvas, dark image treatment, and white editorial copy
  preserve the reference contrast.
- Image quality: generated Partner and news images are sharp and use
  production-sized local assets rather than placeholders.
- Copy: locale-specific navigation, news headings, document titles, and
  Partner Support copy render in Korean, Vietnamese, English, Japanese, and
  Chinese as applicable.

## Comparison history

1. Initial news card measured `427 x 680`, making it materially taller than the
   source thumbnail.
2. Replaced the fixed minimum height with `aspect-ratio: 4 / 5`.
3. Post-fix browser measurement is `427 x 534` with ratio `0.8`; the focused
   side-by-side comparison shows no remaining P0/P1/P2 issue.
4. Browser interaction exposed Next.js's smooth-scroll declaration warning;
   the root `<html>` now declares `data-scroll-behavior="smooth"`.

## Primary interactions tested

- Open news list and news detail.
- Open Japanese Partner directory and Chinese home.
- Open Korean privacy policy and Vietnamese FAQ.
- Verify Partner directory at five desktop columns and two mobile columns.
- Check browser errors: none. The single framework smooth-scroll warning found
  during interaction was fixed in the root layout.

## Follow-up polish

- Replace generated and fallback editorial images with final brand photography
  when the production asset library is ready.

final result: passed

---

# Home Customer Stories V4

- Source rows: Creative Wellness `row-unique-15` and `row-unique-16`.
- Source capture:
  `C:\dev\massage-on-demand-vn\design-qa-source-testimonials-v4.png`
- HANDS capture:
  `C:\dev\massage-on-demand-vn\design-qa-hands-testimonials-v4.png`
- Side-by-side comparison:
  `C:\dev\massage-on-demand-vn\design-qa-hands-testimonials-comparison-v4.png`
- Two continuous testimonial rows move in opposite directions and pause on
  hover. Reduced-motion users receive static rows.
- Cards preserve the reference width, neutral surface, hierarchy, circular
  portrait, and clipped marquee edges without horizontal page overflow.

final result: passed

---

# Home Method, Stories and Final CTA V7

- Reference: Creative Wellness `row-unique-10`, `row-unique-14/15/16`, and
  `row-unique-20`.
- Row 20 source capture:
  `C:\dev\massage-on-demand-vn\design-qa-source-row20-v7.png`
- Row 20 HANDS capture:
  `C:\dev\massage-on-demand-vn\design-qa-hands-row20-v7.png`
- Row 20 comparison:
  `C:\dev\massage-on-demand-vn\design-qa-row20-comparison-v7.png`
- Stories source capture:
  `C:\dev\massage-on-demand-vn\design-qa-source-stories-spacing-v7.png`
- Stories HANDS capture:
  `C:\dev\massage-on-demand-vn\design-qa-hands-stories-spacing-v7.png`
- Stories comparison:
  `C:\dev\massage-on-demand-vn\design-qa-stories-spacing-comparison-v7.png`

## Verified dimensions

- Desktop Method: `1265 x 1022`; source layout height `1022`.
- Mobile Method: `375 x 1401.56`; source mobile layout height `1401.36`.
- Stories: `201px` heading lane, two `333px` rows with an `18px` gap, and
  `144px` closing space; total `1029px`.
- Final CTA desktop: `1235 x 557`, `27px` radius, `60/72px` heading.
- Final CTA mobile: `347 x 482`; source measured `348 x 481.59`.
- Mobile story rail: `375px` viewport over `2026px` content with native
  `overflow-x: auto`, `touch-action: pan-x`, and scroll snap.
- No document-level horizontal overflow at desktop or mobile widths.

## Validation

- Typecheck: passed.
- Tests: 5 files, 10 tests passed.
- Lint: passed.
- Production build: passed.
- No actionable P0, P1, or P2 visual mismatch remains.

final result: passed

---

# Home Hero Video Card V11

- Reference: Creative Wellness hero video card from the supplied DOM.
- Side-by-side card comparison:
  `C:\dev\massage-on-demand-vn\design-qa-hero-video-card-comparison-v11.png`
- Desktop card: `316 x 269px`, matching the reference `316 x 269.125px`.
- Inner media: `131 x 131px`; content columns and gap: `131px / 18px / 131px`.
- Panel: `18px` padding, `16px` radius, `rgba(255,255,255,0.1)`,
  no border, and `50px` backdrop blur.
- Typography: `27/32.4px` title and `18.8/22.56px` supporting copy.
- Mobile: card is hidden at `390 x 844`, matching the reference.
- Browser console errors: none.
- Typecheck, lint, 10 tests, and production build: passed.

final result: passed

---

# Home Hero Video Card V12

- Reference: Creative Wellness hero video card from the supplied DOM.
- Side-by-side card comparison:
  `C:\dev\massage-on-demand-vn\design-qa-hero-video-card-comparison-v12.png`
- Desktop panel: `316 x 269px`; reference: `316 x 269.125px`.
- Columns: `131px / 18px / 131px`; media: `131 x 131px`; play control:
  `75 x 75px`.
- Panel styling: `18px` padding, `16px` radius,
  `rgba(255,255,255,0.1)`, no border, and `50px` backdrop blur.
- Typography matches the measured `27.0088/32.4105px` and
  `18.8037/22.5645px` styles with `-0.05em` tracking.
- Korean copy is line-broken to preserve the reference `5 + 3` line rhythm.
- The source play glyph is served locally from the copied Uncode icon font.
- Video dialog opens and closes correctly.
- Mobile: card is hidden and document horizontal overflow is absent.
- Lint, typecheck, 10 tests, and production build: passed.

final result: passed

---

# Home Hero Video Card V13

- Reference: Creative Wellness hero video column and card from the supplied DOM.
- Side-by-side card comparison:
  `C:\dev\massage-on-demand-vn\design-qa-hero-video-card-comparison-v13.png`
- Outer desktop column: `388 x 269.125px` with `72px` left internal gutter.
- Glass card: `316 x 269.125px`, positioned `72px` from the hero right and
  bottom edges.
- Inner layout: `18px` padding, `131px / 18px / 131px` columns, and
  `131 x 131px` source poster media.
- Panel styling: `16px` radius, `rgba(255,255,255,0.1)`, no border, and
  `50px` backdrop blur.
- Play control: source `Uncode Icons` glyph inside a `75 x 75px` white circle.
- The copied source poster is served locally; no source asset is hotlinked.
- Video dialog opens, plays, closes, and pauses correctly.
- Mobile: the complete outer video column is hidden and horizontal overflow is
  absent.
- Lint, typecheck, 10 tests, and production build: passed.

final result: passed

---

# Creative Wellness Footer V1

- Reference: `https://undsgn.com/uncode/homepages/creative-wellness/` footer.
- Desktop CTA comparison:
  `C:\dev\massage-on-demand-vn\artifacts\creative-wellness-footer\compare-desktop-cta.png`
- Desktop information-grid comparison:
  `C:\dev\massage-on-demand-vn\artifacts\creative-wellness-footer\compare-desktop-info.png`
- Mobile CTA comparison:
  `C:\dev\massage-on-demand-vn\artifacts\creative-wellness-footer\compare-mobile-cta.png`
- Desktop geometry matches the reference: `1272 x 1373px` footer,
  `1236 x 557px` CTA, `1272 x 816px` information row, and `27px` radius.
- Tablet geometry matches at `820 x 900`: `816 x 1450px` footer,
  `780 x 504px` CTA, and `816 x 946px` information row.
- Mobile geometry matches at `390 x 844`: `384 x 2430.578px` footer,
  `348 x 481.594px` CTA, and `384 x 1948.984px` information row.
- Copy, Mona Sans typography, Inter rating typography, line wrapping, link
  rhythm, avatar overlap, Uncode icons, colors, and three responsive layouts
  match the measured reference values.
- The reference image, avatars, Inter font, Mona Sans font, and Uncode icon
  font are served locally; no source asset is hotlinked.
- CTA hover matches the reference black background, `0.975` scale, blurred
  glass surface, duplicate-label movement, and two-arrow track movement.
- Desktop background parallax uses the measured `-0.1 * cardTop` relationship,
  clamped to the reference range; tablet/mobile and reduced-motion modes remain
  static like the reference.
- Footer navigation, external social links, button semantics, alt text, labels,
  keyboard reachability, and reduced-motion handling were checked.
- Browser console errors: none at desktop, tablet, and mobile sizes.
- Lint, typecheck, 14 tests, and production build: passed.
- No actionable P0, P1, or P2 mismatch remains.

final result: passed

---

# HANDS Footer Menu Restoration V1

## Source and implementation

- Source visual truth: `C:\dev\hands-partner-directory-full.png`
  (`1440 x 7826px`, DPR 1).
- Source footer crop: `C:\dev\massage-on-demand-vn\output\hands-footer-desktop-source.png`
  (`1440 x 682px`).
- Implementation route: `http://localhost:3200/ko/partners`.
- Browser-rendered implementation:
  `C:\dev\massage-on-demand-vn\output\hands-footer-desktop-implementation-latest.png`
  (`1425 x 682px`).
- Comparison:
  `C:\dev\massage-on-demand-vn\output\hands-footer-desktop-comparison-latest.png`.
- Desktop CSS viewport: `1440 x 900px`, DPR 1. The `1440px` source crop was
  normalized to the browser content width of `1425px`; both comparison panels
  are `1425 x 682px`.
- State: Korean footer at rest, source on the left and implementation on the
  right.

## Full-view and focused evidence

- The complete footer is the focused comparison region, so a second crop was
  not needed: the wordmark, tagline, all four menu columns, dividers, copyright,
  utility links, and language/download controls remain legible in the combined
  evidence.
- Mobile responsive evidence:
  `C:\dev\massage-on-demand-vn\output\hands-footer-mobile-top-latest.png` and
  `C:\dev\massage-on-demand-vn\output\hands-footer-mobile-bottom-latest.png`
  at a `390 x 844px` CSS viewport, DPR 1.

## Findings

- No actionable P0, P1, or P2 mismatch remains.
- Fonts and typography: the incumbent HANDS sans stack, `78px` wordmark,
  compact Korean link weights, line heights, tracking, and hierarchy match the
  supplied reference after normalization.
- Spacing and layout rhythm: the implementation is exactly `682px` tall with
  `266px / 344px / 72px` brand, navigation, and utility regions. The `48px`
  desktop gutter, four measured column starts, divider positions, and mobile
  stacking match the reference intent without horizontal overflow.
- Colors and visual tokens: the `#131414` footer surface, off-white primary
  text, muted gray labels, and low-contrast divider treatment match the source.
- Image quality and assets: the reference footer contains no raster imagery or
  non-standard icons. The HANDS wordmark remains live text; no placeholder,
  generated asset, or source hotlink is used.
- Copy and content: all supplied Korean menus are restored, including company,
  support, partner, legal, copyright, utility, language, and download labels.
  Equivalent localized menus are present for Vietnamese, English, Japanese,
  and Chinese pages.
- Accessibility and behavior: links retain semantic navigation, visible focus,
  hover feedback, and readable contrast. The `회사 소개` link was clicked in
  the browser and correctly opened `/ko/company`.
- Browser console warnings and errors on fresh desktop and mobile captures:
  none.

## Comparison history

- Initial state: the global Creative Wellness promotional footer replaced the
  requested HANDS information architecture and was a P1 content/layout mismatch.
- First implementation pass restored all menu groups but showed P2 drift in
  wordmark width, menu type scale, and four-column spacing.
- Fixes: adjusted the wordmark tracking, link hierarchy, exact column starts,
  brand/menu region heights, tagline baseline, and mobile stacking.
- Post-fix evidence: `hands-footer-desktop-comparison-latest.png` shows no
  actionable P0/P1/P2 difference. The visible Next.js development badge and
  browser scrollbar are development tooling and were excluded from fidelity
  judgment.

## Validation

- Public tests: 7 files, 14 tests passed.
- Public lint: passed.
- Public typecheck: passed.
- Public production build: passed.
- Manual design detector: only pre-existing Mona Sans/Inter font warnings were
  reported; no finding was introduced by the HANDS footer.

## Follow-up polish

- No blocking or requested follow-up remains.

final result: passed
