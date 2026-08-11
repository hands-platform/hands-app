# Asymmetric `c8e6468` below-download clone — design QA recheck

## Findings

- No actionable P0, P1, or P2 fidelity, responsive, accessibility, or interaction issues remain.
- P3: both source and implementation now use Matter.js 0.18.0 runtime physics, so the exact resting order and rotation of throwable labels intentionally vary on every page load.

## Visual truth and implementation evidence

- Source URL: `https://asymmetric-9.liquid-themes.com/`
- Source target: `.elementor-element-c8e6468`
- Desktop source: `qa-recheck-source-desktop-postfix.png`
- Desktop implementation: `qa-recheck-implementation-desktop-postfix2.png`
- Desktop normalized comparison: `qa-recheck-desktop-final-comparison.png`
- Mobile source: `qa-recheck-source-mobile-late.png`
- Mobile implementation: `qa-recheck-implementation-mobile-final.png`
- Mobile normalized comparison: `qa-recheck-mobile-final-comparison.png`
- Drag-state evidence: `qa-recheck-drag-final.png`
- Scroll-physics desktop comparison: `qa-scroll-physics-desktop-comparison.png`
- Scroll-physics mobile comparison: `qa-scroll-physics-mobile-comparison.png`

## Viewports and normalization

- Desktop viewport: 1440 × 1000 CSS px; document client width 1425 px; captures 1425 × 990 px; device scale factor 1.
- Mobile viewport: 390 × 844 CSS px; document client width 375 px; captures 375 × 812 px; device scale factor 1.
- Desktop comparison crops the requested 1275 × 740 frame from `(75, 80)` in both captures, excluding the source site's sticky global header.
- Mobile comparison aligns the 335 × 616 px throwable scene at `(20, 80)` in both captures. The source's following “Recent Works” card is outside the requested target and is not treated as clone content.

## Measured comparison

### Desktop

| Surface | Source | Implementation | Result |
| --- | --- | --- | --- |
| Target frame | 1275 × 739.98 px at x=75 | 1275 × 740 px at x=75 | Pass |
| Heading | 1220 × 405 px at target y=45.98 | 1220 × 405 px at target y=45.61 | Pass |
| Heading typography | Space Grotesk 75/67.5 px, 600, -3.1 px | Same | Pass |
| CTA | 159.48 × 29 px at target y=490.98 | 159.5 × 29 px at target y=490.61 | Pass |
| Throwable runtime | Matter.js 0.18.0; gravity 0.8, restitution 0.3, 80 ms sequential release, rounded collision bodies | Same engine and parameters | Pass |
| Horizontal overflow | None in target | None; client and scroll widths are 1425 px | Pass |

### Mobile

| Surface | Source | Implementation | Result |
| --- | --- | --- | --- |
| Target frame | 335 × 964.48 px at x=20 | 335 × 964.5 px at x=20 | Pass |
| Heading | 335 × 629.5 px | 335 × 629.5 px | Pass |
| Heading typography | Space Grotesk 46.8/42.12 px, 600, -3.1 px | Same | Pass |
| Throwable stack | Randomized Matter.js collision stack in a 616 px scene | Same randomized collision stack and scene bounds | Pass |
| Horizontal overflow | None; client and scroll widths are 375 px | None; client and scroll widths are 375 px | Pass |

## Required fidelity surfaces

- Fonts and typography: exact local Space Grotesk reproduces heading glyph widths, line breaks, weight, line height, tracking, and character reveal. The source's insecure HTTP GT Walsheim face is blocked on its HTTPS page and visibly falls back to the browser sans-serif; throwable labels now use the same fallback metrics.
- Spacing and layout: frame size, top context spacing, desktop 27.5 px copy inset, mobile zero inset, mark gap, CTA geometry, scene bounds, and clipping match.
- Colors and tokens: background `#191b1d`, white copy, CTA `#f7fd92`, and all eight label fills match the source.
- Image quality and assets: both inline PNGs and the zigzag SVG are exact local source assets; there are no placeholder or CSS-drawn substitutes.
- Copy and content: all source wording and capitalization remain verbatim, including “ever element”.
- Icons: the CTA arrow is the exact source SVG path and 11 px geometry.
- States and interactions: character reveal, viewport-triggered staggered fall, body collisions, direct Matter.js drag, inertia, dynamic scroll gravity, pause while offscreen, boundaries, CTA hover, and reduced motion were checked. Before entry both versions keep the first body at opacity 0 with no transform. On entry both enable the runner and release bodies at 80 ms intervals. Both apply the source formula `gravityY = 0.7 - clamp(-2, 4, scrollDelta * 0.1)`; a 220 px downward scroll moved a settled body from y=706.3 to y=704.1 locally and y=706.4 to y=704.4 in the source before returning to rest. Heading characters use the source's `top bottom` to `center 75%` scroll range and sequential 0.2→1 reveal. CTA hover remains `rgb(247, 253, 146)` with no transform.
- Accessibility: semantic section/CTA labels, empty alt text on decorative images, keyboard-reachable CTA, and reduced-motion fallback remain in place.
- Browser console: desktop and mobile contain React development/HMR information only; no warnings or errors.

## Comparison history

1. P2 mobile typography: the first implementation was 42.12 px too short and wrapped “insight, strategic” incorrectly. Fix: character-level inline-block splitting. Post-fix: heading height and every line break match at 629.5 px.
2. P2 mobile throwable state: the first labels clustered too low and densely. Fix: target-relative rest distribution. Post-fix: `qa-recheck-mobile-final-comparison.png`.
3. P1 drag behavior: pointer moves were not received after pointerdown. Fix: window-level move/up/cancel listeners while retaining pointer capture and inertia. Post-fix: `qa-recheck-drag-final.png` and the measured coordinate change above.
4. P2 recheck finding: desktop labels overlapped more heavily than the current source rest state, mobile included the source-hidden Smart Assets Manager, and explicit Arial/local GT Walsheim produced different label widths from the source's blocked-font fallback. Fix: use the source-visible `sans-serif` fallback and tune desktop/mobile centers and rotations from fresh browser measurements. Post-fix: `qa-recheck-desktop-final-comparison.png` and `qa-recheck-mobile-final-comparison.png`.
5. P1 motion trigger: labels were running their CSS fall immediately at page load, before the section reached the viewport. Initial fix: gate the CSS animation at scene entry. Final fix: the source-matched Matter.js runner and rain observers now keep bodies hidden and static until the scene intersects, then enable and release them once.
6. P1 scroll-response mismatch: the fixed CSS keyframe could not reproduce the source's collision physics or scroll-direction gravity, and the heading reveal used a slower custom range. Fix: replace the keyframe/manual inertia code with the source's Matter.js 0.18.0 engine model, runner observers, rounded bodies, boundaries, restitution, 80 ms rain, scroll-gravity formula, and direct mouse constraint; map heading progress to the source's exact ScrollTrigger start/end geometry and sequential character timeline. Post-fix: `qa-scroll-physics-desktop-comparison.png`, `qa-scroll-physics-mobile-comparison.png`, and the measured scroll-kick values above.

## Implementation checklist

- [x] Exact local source assets
- [x] Exact desktop and mobile frame geometry
- [x] Exact heading typography and responsive wrapping
- [x] Source-visible label font metrics
- [x] Source-mapped scroll reveal and staggered Matter.js fall
- [x] Fall begins at viewport entry, not page load
- [x] Direct drag, collisions, inertia, dynamic scroll gravity, and bounds
- [x] CTA hover and reduced-motion behavior
- [x] Desktop/mobile browser console and static checks

## Open questions

- None.

final result: passed
