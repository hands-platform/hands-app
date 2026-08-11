# Codex 구현 프롬프트 — Coupons 운영 화면 재개선

아래 프롬프트 전체를 새 Codex 작업에 그대로 붙여 넣으면 된다.

```text
목표

C:\dev\massage-on-demand-vn 프로젝트의 HANDS Admin Coupons 화면을 실제 Growth/Operations 운영자가 안전하고 빠르게 사용할 수 있는 수준으로 수정하라.

이번 작업은 단순 제안이나 추가 보고서 작성이 아니다. 현재 코드와 로그인된 실제 화면을 먼저 확인하고, 아래 P0/P1 요구사항을 코드로 구현한 뒤 테스트·typecheck·1440px 이상 브라우저 검증·전후 캡처·구현 보고서까지 완료하라.

가장 먼저 읽을 자료

1. C:\dev\massage-on-demand-vn\output\coupons-post-remediation-reaudit-2026-08-10\coupons-post-remediation-deep-reaudit-report.md
2. 같은 폴더의 01~13 감사 캡처
3. 저장소의 AGENTS.md가 있다면 적용 범위에 맞게 전부 읽는다.
4. 아래 관련 코드를 실제 최신 상태로 다시 읽는다.

- apps/admin_web/app/coupons/page.tsx
- apps/admin_web/app/coupons/actions.ts
- apps/admin_web/app/coupons/coupon-action-confirmation.ts
- apps/admin_web/app/coupons/coupon-filter-board.tsx
- apps/admin_web/app/coupons/coupon-filters.ts
- apps/admin_web/app/coupons/coupon-page-model.ts
- apps/admin_web/app/coupons/coupon-page-presenters.ts
- apps/admin_web/app/coupons/coupons-table-section.tsx
- apps/admin_web/components/admin-form-date-picker-field.tsx
- apps/admin_web/components/confirm-dialog*.tsx
- apps/admin_web/components/admin-data-table*.tsx
- apps/admin_web/components/admin-drawer*.tsx
- apps/admin_web/lib/admin-api.ts
- apps/admin_web/app/globals.css의 Coupons 관련 selector
- apps/api/src/admin/admin-coupon.routes.ts
- apps/api/src/admin/admin.service.ts의 coupon list/summary/usage/create/update/delete
- apps/api/src/admin/admin.dto.ts의 coupon DTO
- apps/api/prisma/schema.prisma의 Coupon model
- 관련 spec 전체

작업 원칙

- 작업 시작 시 `git status --short`와 관련 파일 diff를 확인한다.
- 현재 worktree에는 사용자의 미완료 변경이 많다. 관련 없는 변경을 되돌리거나 정리하지 않는다.
- `git reset --hard`, 광범위 checkout/revert, 임의 삭제를 사용하지 않는다.
- 기존 HANDS Admin design system, token, Admin component를 재사용한다.
- 새 UI library나 date library는 기존 코드만으로 해결할 수 없다는 근거가 있을 때만 추가한다.
- `/coupons` 한 페이지 안에서 운영 흐름을 통합한다. 새 페이지를 불필요하게 늘리지 않는다.
- 1440px 이상 데스크톱만 검수한다. 1440px 미만 대응을 이번 작업의 문제·수용 기준·보고서에 넣지 않는다.
- 예쁜 화면보다 운영 안전성, 수치 신뢰성, scanability, 짧은 작업 동선을 우선한다.
- 기술 구현 문구가 아니라 실제 운영자가 이해하는 문구를 사용한다.
- 존재하지 않는 owner, 예산, 사용 제한, eligibility 정책을 임의로 만들지 않는다.
- 실제 로컬 DB의 83개 `SMOKE*` 쿠폰을 자동 삭제·수정·Pause하지 않는다. 데이터 변경은 별도 검증된 cleanup 대상 목록과 사용자 승인 없이는 수행하지 않는다.
- 브라우저 검수 중 실제 coupon create/update/pause/delete submit을 하지 않는다. 변경 동작은 격리된 test fixture 또는 mock으로 검증한다.
- 구현 과정에서 발견한 기존 오류를 조용히 숨기지 말고 구현 보고서에 구분해서 기록한다.

완료 판정

아래 P0와 P1은 모두 구현해야 한다. 일부만 고치고 완료라고 하지 않는다. P2는 기존 계약으로 안전하게 구현 가능한 항목을 포함하며, 새로운 비즈니스 정책 결정이 필요한 항목만 명확한 근거와 함께 deferred로 남길 수 있다.

P0-1. ICT 날짜·시간 round-trip 오류를 수정한다

현재 문제:

- 카드에는 `28 Jul 2025, 06:14`로 보이지만 edit picker에는 `2025-07-27 11:14 PM`으로 나타난다.
- `toISOString().slice(0, 16)`으로 만든 timezone 없는 값이 browser local datetime으로 다시 해석된다.
- 값을 변경하지 않고 Save해도 UTC instant가 ICT 기준 7시간 바뀔 수 있다.

구현 요구:

1. Coupon start/end의 기준 timezone을 `Asia/Bangkok` / ICT로 명시한다.
2. API/DB의 UTC instant → ICT wall time input 변환과 ICT wall time input → UTC instant 변환을 서로 역함수로 구현한다.
3. server timezone과 browser timezone에 의존해 timezone 없는 문자열을 `new Date(value)`로 직접 해석하지 않는다.
4. card, create, edit, confirmation, audit copy에서 시간이 보이면 `ICT`를 명시한다.
5. coupon 전용 helper로 해결할 수 있으면 공통 date picker 전체를 위험하게 바꾸지 않는다. 공통 component를 바꾼다면 다른 사용처 회귀 테스트를 추가한다.
6. 변경 없는 edit submit은 원래 ISO instant와 정확히 같아야 한다.

필수 테스트:

- `2025-07-27T23:14:00.000Z` → `28 Jul 2025, 06:14 ICT`
- picker 표시 → unchanged submit → 원본 ISO 유지
- start/end 양쪽
- 비어 있는 start/end
- invalid value
- server/browser timezone이 달라도 동일한 결과

P0-2. API 실패와 진짜 0건을 분리한다

현재 문제:

- page가 `adminGet(..., [])`와 zero summary fallback을 사용한다.
- API 장애가 `Live 0`, `No coupons`, `No bookings`로 보일 수 있다.

구현 요구:

1. list, summary, usage 요청에 `adminGetResult` 또는 동등한 result contract를 사용한다.
2. 다음 상태를 명확하게 분리한다.
   - 정상 데이터
   - 정상 0건
   - 인증/권한 실패
   - API/network failure
   - usage만 실패
3. summary 실패 시 0 KPI를 보여주지 말고 `Coupon summary unavailable`과 Retry를 제공한다.
4. list 실패 시 empty state를 보여주지 않는다.
5. usage 실패 시 `No bookings`라고 쓰지 않고 `Usage unavailable · Retry`를 제공한다.
6. source unavailable 상태에서 mutation control을 계속 허용할지 기존 Admin policy를 확인한다. 안전한 판단 근거가 없으면 create/edit/destructive action을 비활성화하고 이유를 표시한다.
7. `generatedAt`을 `Updated … ICT`로 화면에 연결한다.

P0-3. Smoke fixture 재발을 막는다

현재 화면에는 전체 84개 중 `SMOKE*` 83개가 Live로 남아 있다.

구현 요구:

1. `rg`로 `SMOKE`, coupon 생성 smoke/E2E script와 test를 모두 찾는다.
2. test가 생성한 coupon id를 추적하고 사용 이력이 없는 자기 fixture만 cleanup하도록 수정한다.
3. 공유 환경에서 smoke coupon을 기본 active/open-ended로 만들지 않는다.
4. 이름 prefix만으로 production 데이터를 삭제하는 코드를 만들지 않는다.
5. 기존 83개는 read-only inventory를 만든다. 가능하면 coupon id, code, active, window, usage count, create audit actor/time을 포함한다.
6. 현재 schema/로그로 provenance를 신뢰성 있게 판별할 수 없다면 그 한계를 보고한다. 임의 추정으로 schema migration을 만들지 않는다.
7. provenance field가 반드시 필요하다고 판단하면 최소 migration, backfill 정책, API/UI/test 영향까지 함께 구현하되 기존 row의 값을 임의로 확정하지 않는다.

P1-1. 모든 view와 page에서 Delete/Pause confirmation이 정상 동작하게 한다

현재 문제:

- confirmation href가 `view`, `q`, `couponPage`를 버린다.
- confirmation model이 현재 로드된 10개 coupon에서만 target을 찾는다.
- page 2+, Scheduled, Records, 검색 결과에서 dialog가 열리지 않는다.

구현 요구:

1. confirmation target을 현재 list slice에 의존하지 말고 coupon id로 독립 조회한다.
2. `returnTo` 또는 sanitize된 canonical Coupons query로 원래 `view/q/couponPage`를 보존한다.
3. open redirect가 생기지 않도록 return destination은 `/coupons` 내부 query만 허용한다.
4. Cancel, backdrop, Escape, 성공 redirect 모두 원래 context로 돌아간다.
5. target missing/API failure 시 dialog를 조용히 숨기지 말고 안전한 error state와 return action을 보여준다.
6. confirmation dialog의 현재 `alertdialog`, aria-modal, focus trap, Cancel 초기 focus는 유지한다.

필수 테스트:

- Live page 1
- Live page 2 이상
- Scheduled
- Records
- All + 검색
- 존재하지 않는 coupon id
- target API failure
- returnTo sanitize

P1-2. Pause/Activate를 실제 운영 경로에 연결한다

현재 코드에는 presenter, href builder, confirmation builder, server action이 있지만 UI trigger가 없다.

구현 요구:

1. Live/Scheduled row에는 `Pause`, paused record에는 `Activate`를 직접 제공한다.
2. Active checkbox를 edit form에서 제거해 confirmation 우회를 막는다.
3. Pause/Activate는 반드시 기존 confirmation flow를 통과한다.
4. Activate 전에 window가 만료됐으면 action을 막고 `Update end time before activation`을 표시한다.
5. confirmation에는 code, discount, start/end ICT, customer checkout 영향이 보인다.
6. status action 성공 후 원래 list context와 focus 복원 전략을 적용한다.
7. `couponActionMenuItems`를 실제로 사용하거나 dead abstraction을 제거한다. 두 구현을 중복 유지하지 않는다.

P1-3. Create flow를 안전한 draft-first flow로 변경한다

현재 문제:

- Coupon codes, Campaign description, Discount % label이 시각적으로 숨겨져 있다.
- batch separator, parsed count, duplicate/invalid 결과가 없다.
- 개수 제한 없이 code마다 순차 POST한다.
- 기본 `active: true`, 즉시 시작, 종료 없음이 가능하다.

구현 요구:

1. 상시 노출 Create panel을 제거하고 header의 `Create coupon` primary button으로 drawer/dialog를 연다.
2. 다음 visible label/helper를 제공한다.
   - Coupon codes
   - One code per line or separate with commas
   - Campaign description
   - Discount percent
   - Starts · ICT
   - Ends · ICT
3. 입력 중 parsed code count, duplicates removed, invalid/too-long code를 preview한다.
4. 합리적인 batch 상한을 코드와 API 양쪽에서 강제한다. 기존 정책이 없으면 50개를 기본 제안으로 사용하고 상수/테스트로 명시한다.
5. batch request는 code별 success/failure 결과를 반환한다. 일부 실패 시 정확한 실패 code와 원인을 보여준다.
6. 새 coupon의 기본 상태는 Paused/Draft로 한다.
7. `No end date`는 빈 값의 암묵적 의미가 아니라 명시적 선택으로 만든다.
8. active/open-ended 생성이 허용돼야 한다면 최종 확인 단계에서 `Create N active coupons · starts now · no end date`를 명확히 보여준다.
9. Save/Create와 Cancel을 제공하고 mutation 중 loading/disabled 상태를 구현한다.
10. 실제 정책이 없는 coupon auto-generation, 예산, customer eligibility를 임의로 추가하지 않는다.

P1-4. 카드 목록을 dense 운영 table로 변경한다

현재 문제:

- 10개 card가 약 3,444px 높이를 만든다.
- campaign description이 card에서 보이지 않는다.
- 같은 checkout 상태가 3~4번 반복된다.
- Delete가 모든 카드의 강한 red action으로 항상 보인다.

구현 요구:

1. `/coupons` 기본 결과를 기존 `AdminDataTable` 기반 dense table로 바꾼다.
2. 다음 column을 우선한다.
   - Code / campaign description
   - Discount
   - Checkout window · ICT
   - Status
   - Usage
   - Last used 또는 Updated/Freshness 중 실제 데이터가 있는 값
   - Actions
3. 없는 데이터는 만들어내지 않는다. usage count가 필요하면 API에 `usageBookingCount` 또는 `hasUsage`를 추가한다.
4. `All`은 하나의 table과 Status column으로 표현한다. Live/Upcoming/Records empty section 세 개를 반복하지 않는다.
5. section/list count는 `Showing 1–10 of 84`처럼 현재 page와 filtered total을 구분한다.
6. Edit와 View usage는 같은 route의 우측 drawer 또는 동등한 detail panel로 연다.
7. drawer를 열 때 scroll을 top으로 초기화하지 않고, 적절한 heading/첫 field로 focus한다.
8. drawer를 닫을 때 원래 row action으로 focus를 복원한다.
9. Delete는 `More` 안의 저빈도 destructive action으로 내린다. Pause/Activate는 status 근처에 둔다.
10. 기존 filter/search/server pagination contract는 유지한다.

P1-5. Operator 문구를 정리한다

다음 문구 원칙을 적용한다.

- `Checkout preview and booking payment authorization should apply this discount.` → `Available at checkout now.`
- `Safe to use in customer checkout now.` → status와 중복이므로 제거
- `Booking usage loads on demand` → `Usage not loaded · View usage`
- `84 running / 0 upcoming / 0 expired` → 제거하거나 `84 live · 0 scheduled · 0 records`
- `No bookings used this coupon recently.` → `No recorded bookings for this coupon.`
- `Amount` → 실제 의미에 맞게 `Customer paid`
- 단수/복수 처리: `1 coupon`, `2 coupons`
- 개발자 용어인 preview, authorization, payload, API는 일반 운영 문구에 노출하지 않는다. 오류 detail에서 필요한 경우에만 사용한다.

P2-1. Usage drawer를 audit-friendly하게 만든다

1. empty usage에서는 table header와 horizontal scrollbar를 렌더링하지 않는다.
2. 데이터가 있으면 상단 summary에 기존 데이터로 계산 가능한 항목을 제공한다.
   - Bookings
   - Customer paid
   - Discount granted
   - Reversed/refunded
3. original amount가 신뢰 가능한 경우 `Original price`, `Customer paid`, `Discount`를 구분한다.
4. payment status, booking status, reversal status를 서로 다른 의미로 유지한다.
5. multi-service booking은 첫 service만 버리지 말고 전체를 요약한다. 예: `Thai Massage +2`.
6. booking detail link와 개인정보 표시 정책은 기존 Admin 규칙을 유지한다.
7. usage pagination과 현재 coupon/view context를 유지한다.

P2-2. Freshness와 운영 상태를 보강한다

1. summary의 `generatedAt`을 page header 또는 filter 위에 표시한다.
2. API별 성공/실패가 다르면 source별 상태를 표현한다.
3. 현재 schema에 owner, budget, limit 정보가 없으므로 값을 임의로 표시하지 않는다.
4. owner, max redemption, minimum order, eligible services/regions/customer segments, budget, Archived lifecycle은 구현 보고서의 `Policy decisions required`에 정리한다.
5. 정책이 확정되지 않은 상태에서 대규모 schema 확장을 하지 않는다.

권장 최종 화면 구조

1. Header
   - Coupons
   - 운영 목적 한 문장
   - Updated … ICT / source state
   - Create coupon
2. KPI
   - Live codes
   - Scheduled
   - Records 또는 Needs review
   - usage/spend는 신뢰 가능한 API를 구현한 경우만 추가
3. Filter toolbar
   - Live / Scheduled / Records / All
   - code/campaign search
   - Apply / Clear / Reset all
4. Dense table
5. Pagination
6. 우측 drawer
   - Overview
   - Edit
   - Usage
   - Audit 정보가 이미 존재하고 안전하게 조회 가능하면 Audit

시각 품질 기준

- 기존 HANDS Admin typography, spacing, radius, surface, button hierarchy를 유지한다.
- 같은 의미를 badge, helper, paragraph로 반복하지 않는다.
- 긴 date range 전체를 큰 pill로 만들지 않는다.
- status는 색상과 text를 함께 사용한다.
- primary action은 화면당 하나의 명확한 우선순위를 갖는다.
- destructive red는 confirmation과 저빈도 action에만 사용한다.
- table row에서 code와 campaign description을 가장 먼저 읽을 수 있어야 한다.
- light와 dark theme 모두 검수한다.
- 1440×900과 1920×1080에서 horizontal overflow, 잘림, 과도한 빈 공간, 긴 page height를 확인한다.
- 1440px 미만 검수나 수정은 이번 범위에 넣지 않는다.

접근성 기준

- 단일 H1과 올바른 heading/landmark 구조를 유지한다.
- 모든 visible form field에는 visible label이 있어야 한다.
- active lifecycle에는 `aria-current` 또는 동등한 semantic state가 있어야 한다.
- drawer/dialog는 focus trap, Escape, close button, focus restore를 제공한다.
- server mutation 성공/실패는 `role=status` 또는 `role=alert`로 전달한다.
- loading 중 중복 submit을 막는다.
- table header와 row action에는 명확한 accessible name이 있어야 한다.

필수 코드 검증

1. 수정한 Coupons 관련 unit/component tests
2. Admin API coupon tests
3. timezone round-trip tests
4. confirmation context tests
5. API failure state tests
6. batch create parser/limit/partial result tests
7. Pause/Activate lifecycle tests
8. usage empty/data/multi-service tests
9. smoke fixture cleanup tests
10. Admin Web typecheck
11. API typecheck 또는 build

기존 Finance typecheck 오류가 남아 있으면 Coupons 변경으로 새 오류가 추가되지 않았음을 분리해 증명하고 정확한 기존 오류를 보고한다. 관련 없는 Finance 코드를 이번 작업에서 임의로 고치지 않는다.

브라우저 검수

로그인된 `http://localhost:3101/coupons`를 1440×900과 1920×1080에서 직접 확인한다. 기존 세션을 사용할 수 있으면 활용한다.

반드시 캡처할 상태:

1. 기본 Live light theme
2. Scheduled/Records empty state
3. All + 검색 결과와 0건 검색
4. Create drawer의 기본/validation/batch preview
5. Edit drawer와 ICT 날짜 일치
6. Usage empty와 usage data fixture
7. Live page 2 이상의 Delete confirmation
8. Pause와 Activate confirmation
9. API failure state는 격리된 mock/test 환경에서 확인
10. dark theme

각 화면에서 버튼이 실제로 올바른 target/state를 여는지 확인한다. screenshot만 찍고 정상이라고 판단하지 않는다. 브라우저에서 실제 운영 데이터를 변경하는 confirm submit은 하지 않는다.

완료 보고서

다음 파일을 생성한다.

C:\dev\massage-on-demand-vn\output\coupons-remediation-implementation-2026-08-10\coupons-remediation-implementation-report.md

보고서에 포함할 내용:

- 최종 판정과 before/after 요약
- P0/P1/P2 항목별 완료/부분/보류 표
- 변경 파일과 핵심 설계 결정
- timezone contract 설명
- API failure contract 설명
- Create/Pause/Delete safety 설명
- fixture 재발 방지와 기존 83개 inventory 처리 상태
- 현재 실행에서 새로 캡처한 before/after 화면
- 실행한 test/typecheck/build와 실제 결과
- 미해결 정책 결정과 이유
- 감사 보고서의 최종 수용 기준 체크리스트

최종 응답 형식

1. 구현 결과를 먼저 말한다.
2. 해결한 P0/P1을 간결하게 요약한다.
3. 테스트 결과를 숫자로 제시한다.
4. 구현 보고서와 주요 파일을 절대경로 링크로 제공한다.
5. 변경하지 않은 실제 데이터와 남은 정책 결정을 명확히 구분한다.

완료 금지 조건

- 날짜가 card와 picker에서 다름
- unchanged edit가 instant를 변경함
- page 2/Scheduled/Records/search에서 confirmation이 열리지 않음
- Pause/Activate UI가 없음
- API failure가 0/empty로 보임
- 핵심 form label이 시각적으로 숨겨짐
- create가 설명 없는 active/no-end를 기본으로 만듦
- campaign description이 목록에서 보이지 않음
- empty usage에 wide scrollbar가 남음
- 관련 test 실패
- 기존 83개 fixture를 근거 없이 삭제하거나 production data라고 단정함

위 조건 중 하나라도 남으면 작업을 완료로 선언하지 말고 원인, 남은 작업, 검증 근거를 보고하라.
```

## 사용 메모

- 이 프롬프트는 감사 보고서를 다시 요약하라는 요청이 아니라 실제 구현과 검증을 요구한다.
- P0/P1을 완료 조건으로 고정하고, 정책이 없는 대규모 schema 확장은 방지한다.
- 현재 운영 데이터 삭제를 허용하지 않으므로 Smoke 83건은 inventory와 재발 방지까지만 수행한다.
- 1440px 이상 데스크톱만 작업 범위로 고정한다.
