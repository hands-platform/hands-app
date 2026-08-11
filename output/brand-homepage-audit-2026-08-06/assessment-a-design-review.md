# Assessment A — Brand and design review

Target: `apps/public_web/app/page.tsx` → `http://localhost:3200/ko`
Mode: Persuade

## Design specificity

HANDS has a recognizable editorial shell: full-bleed photography, oversized Korean type, muted paper background, soft pastel feature panels, and restrained rounded surfaces. The hero's therapist-at-home image is product-specific. The system loses that specificity after the hero because most imagery depicts exercise, yoga, or generic wellness rather than an at-home massage marketplace. The repeated language about “wellness,” “connection,” and “moments” could describe a gym, coaching service, or meditation app with minimal changes.

## Heuristic scores (before detector evidence)

| # | Heuristic | Score | Evidence |
|---|---|---:|---|
| 1 | Visibility of system status | 2 | Carousel states exist, but horizontal sections and testimonial rails give weak movement/position cues. |
| 2 | Match with the real world | 2 | Core service is stated, but generic fitness imagery and abstract wellness language obscure “a verified massage therapist comes to you.” |
| 3 | User control and freedom | 3 | FAQ, video close, and step selectors are controllable; desktop story rails and mobile testimonial overflow are less explicit. |
| 4 | Consistency and standards | 3 | Visual system is cohesive; CTA labels and destinations shift among start, browse, find, download, and anchors. |
| 5 | Error prevention | 2 | “HANDS 시작하기” and “앱 다운로드” do not plainly disclose the next destination; public placeholder partner/business data creates misleading expectations. |
| 6 | Recognition rather than recall | 2 | The page repeats the service model, but concrete proof, actual providers, availability, and verification details arrive very late. |
| 7 | Flexibility and efficiency | n/a | Marketing landing page. |
| 8 | Aesthetic and minimalist design | 3 | Strong art direction and hierarchy; mobile cards are over-tall and the same product claims repeat across many sections. |
| 9 | Error recovery | n/a | No meaningful form/transaction on this surface. |
| 10 | Help and documentation | 3 | FAQ and legal links are visible; safety and verification explanations are too vague for a trust-sensitive service. |
| **Total** |  | **20/32** | **Acceptable; strong visual foundation, weak clarity and trust proof.** |

## Cognitive load

Moderate (2 checklist failures):

- Single focus fails above the fold: navigation, app download, start, browse, and video compete.
- Minimal choices fails above the fold: more than four visible actions compete before trust is earned.
- Chunking, grouping, reading order, and working-memory demands are otherwise reasonable.
- Mobile physical effort is excessive: fixed `min-height: 740px` feature copy panels stretch three repeated ideas across many screenfuls.

## Emotional journey

- Peak: the hero feels calm, premium, and immediately human.
- Valley: fitness/yoga imagery shifts the category from massage-at-home to generic active wellness.
- Trust break: fictional-looking testimonials, repeated `Smoke Partner` entries, blank profile images, and “대표/사업자 주소: 정보 등록 예정.”
- Ending: the final CTA is visually polished but repeats the generic gym imagery and cannot repair the trust break immediately above it.

## Strengths

1. The hero establishes a premium, calm tone and shows a therapist in a plausible service setting.
2. The editorial composition and pastel/neutral palette feel more distinctive than a typical marketplace grid.
3. The three-step booking explanation and FAQ provide a coherent mental model once visitors reach them.

## Priority issues

1. **P1 — Public proof is visibly placeholder data.** `Smoke Partner`, blank avatars, and pending business details undermine a safety-sensitive home service.
2. **P1 — Category confusion after the hero.** Running/yoga imagery and abstract wellness copy make HANDS look like fitness coaching rather than an on-demand massage marketplace.
3. **P1 — The promise and CTA are not literal enough.** “HANDS 시작하기,” “앱 다운로드,” and “웰니스 공간” require interpretation; visitors need to know that a verified therapist comes to their chosen place and time.
4. **P2 — Trust proof is too late and vague.** Verification, pricing transparency, safety records, and support are claimed but not explained near the first CTA.
5. **P2 — The page is too long and repetitive, especially on mobile.** Value, feature rail, method, steps, testimonials, FAQ, provider strip, and final CTA restate the same three ideas.

## Persona red flags

- **Jordan, first-timer:** sees five competing actions in the hero; “웰니스” and “1:1 코칭” blur whether this is massage, coaching, or fitness. The path after “시작하기” is not explicit.
- **Riley, trust tester:** immediately finds generic testimonial names, future-dated-looking metadata, `Smoke Partner`, blank avatars, and business registration placeholders. These read as fabricated proof.
- **Casey, mobile visitor:** must scroll through very tall cards before reaching real providers or trust detail. Testimonials imply horizontal swipe without controls, and the provider names truncate.

## Accessibility risks visible without detector input

- The pale gray statement headline (`#c9cbc7` on `#f5f5f2`) is likely far below text contrast requirements.
- How-step dot controls are `21×30px`, below the common 44×44 touch target expectation.
- Desktop testimonial rows are drag-first and have no visible previous/next controls.
- Multiple scroll-driven transforms may be disorienting; reduced-motion handling exists in source for the largest rails, which is a strength.
- Full keyboard, focus order, contrast ratios, and screen-reader behavior still require technical testing.

## Copy direction

- Brand promise: “오늘 필요한 마사지를, 원하는 곳에서.”
- Literal support: “위치와 시간을 선택하면 가까운 검증 테라피스트를 비교하고 바로 예약할 수 있어요. 예약 후에는 채팅과 실시간 상태로 도착부터 완료까지 확인하세요.”
- Primary CTA: “내 주변 테라피스트 보기.”
- Secondary CTA: “3분 예약 과정 보기.”
- Trust strip near hero: “신원·자격 확인 / 가격 사전 확인 / 예약 기록·고객지원” — only retain claims that operations can prove.

## Proposed information order

1. Literal promise + one primary CTA.
2. Three compact trust proofs.
3. Real nearby therapists with photo, area, service, price, rating, and verified status.
4. Three-step booking path.
5. How verification/safety/support actually work.
6. Verified customer evidence.
7. FAQ and final CTA.

## Provocative questions

- If the word HANDS disappeared, would the imagery still tell visitors that a massage therapist comes to them?
- Why is the first real provider evidence shown after the FAQ instead of immediately after the promise?
- Is every testimonial and verification claim traceable to real operational data today?
