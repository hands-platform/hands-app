# Assessment B — Detector and browser evidence

Target: `apps/public_web/components/hands-home-page.tsx`
Live URL: `http://localhost:3200/ko`

## Deterministic detector

- Command scope: `apps/public_web/components`
- Exit: `0`
- Findings: `0` (`[]`)
- Interpretation: the detector found no banned implementation patterns in the component directory. This does not validate brand clarity, real-data credibility, copy truthfulness, or color contrast.

## Browser fallback evidence

Live overlay injection was not available because Codex Browser exposes read-only page evaluation. No overlay server was started, no script was injected, and no user-visible overlay is claimed. Fallback evidence is the accepted screenshot set, DOM snapshot, computed styles, layout measurements, and console log check.

### Default desktop viewport

- Viewport: `1280×720`; document height: `10,166px`.
- Hero: `1229×684px`.
- The `108px` statement headline computes to `rgb(201,203,199)` on `rgb(245,245,242)`: contrast ratio `1.50:1`.
- Step dot controls measure `35×30`, `21×30`, and `21×30px`.
- Horizontally overflowing regions: feature track `3344/1235px`; each testimonial track `3450/1265px`.
- Current CTA destinations:
  - “앱 다운로드” → `/ko/partners#download`
  - Hero “HANDS 시작하기” → `#download`
  - “마사지 테라피스트 둘러보기” → `#partners`
  - Final “마사지 테라피스트 찾기” → `/ko/partners`
- Default viewport screenshot shows the hero video card compressed into many short lines beside the oversized headline.

### Mobile viewport

- Viewport: `390×844`; document height: `11,094px` (about 13.1 viewport heights).
- The three feature panels begin at `2,044px`, `3,043px`, and `4,043px` and each measures `982px` tall.
- Each feature copy block has a fixed `740px` height; the entire feature rail consumes `3,017px`.
- Real partner evidence does not begin until `9,289px`; the final CTA begins at `9,965px`.
- Partner names returned by the live API: one `Linh Wellness` and four `Smoke Partner` records.
- Mobile testimonial tracks overflow to `2,026px` inside a `375px` viewport without visible next/previous controls.
- Step dots remain `21–35×30px`, below the common `44×44px` touch target expectation.

## Runtime observations

- Browser console errors/warnings: none.
- DOM headings and primary landmarks are present.
- FAQ uses native `details/summary`, and the step selector exposes `aria-label` and `aria-pressed`.
- Source includes a `prefers-reduced-motion` branch for the major scroll-driven rails.

## False positives and limits

- The hidden mobile menu appears in the overflow query even when closed; treat this as a measurement artifact, not a confirmed defect.
- Visual inspection confirms the provider placeholder and business-registration copy, but screenshots alone cannot establish whether testimonial identities or verification claims are authentic.
- Full keyboard order, screen-reader announcements, 200% zoom reflow, network performance, and real booking conversion require separate interaction testing.
