# Codex 구현 프롬프트 — Partner Notes About Customers 2차 개선

아래 내용을 새 Codex 작업에 그대로 전달해 실행하라.

---

## 역할

너는 `C:\dev\massage-on-demand-vn` 저장소의 관리자 웹을 개선하는 시니어 풀스택 엔지니어다. 프로그래머가 아니라 실제 Customer Support 운영자가 다음 업무를 빠르고 안전하게 끝낼 수 있도록 `/reviews/partner-customer-evaluations` 화면을 수정하라.

운영자가 추측 없이 답할 수 있어야 한다.

- 파트너가 고객에 관해 어떤 메모를 남겼는가?
- 언제, 어떤 Partner와 booking에서 제출됐는가?
- 현재 메모 상태가 Retained, Needs review, Restricted 중 무엇인가?
- 상태를 바꾸면 어떤 운영 영향이 생기는가?
- 누가, 언제, 어떤 이유로 상태를 변경했는가?
- 현재 결과가 실제 0건인지, 필터 결과가 없는지, API가 실패한 것인지?

## 기준 문서

먼저 다음 파일을 끝까지 읽고 구현의 기준으로 사용하라.

- `AGENTS.md`
- `output/partner-customer-evaluations-post-implementation-audit-2026-08-07/partner-customer-evaluations-post-implementation-deep-audit.md`
- `output/partner-customer-evaluations-audit-2026-08-06/partner-customer-evaluations-codex-improvement-prompt.md`

보고서 screenshot도 반드시 열어서 직접 확인하라.

- `01-partner-notes-top-1440.jpg`
- `02-partner-notes-table-1440.jpg`
- `04-change-state-choices-1440.jpg`
- `05-needs-review-confirmation-1440.jpg`
- `06-custom-dates-no-fields-1440.jpg`
- `07-needs-review-empty-1440.jpg`
- `08-partner-notes-top-1600.jpg`
- `10-partner-notes-dark-1440.jpg`
- `11-change-state-1600.jpg`

모두 다음 폴더에 있다.

`output/partner-customer-evaluations-post-implementation-audit-2026-08-07/`

## 시작 전 필수 확인

1. `git status --short`와 관련 파일의 `git diff`를 먼저 확인하라.
2. worktree에는 사용자가 만든 대규모 변경과 아직 commit되지 않은 파일이 있다. 관련 변경을 덮어쓰거나 되돌리지 말고 그 위에서 작업하라.
3. 감사 이후에도 파일이 변경됐을 수 있다. 보고서 문구만 믿고 각 결함을 현재 브라우저와 현재 코드에서 재현한 뒤 수정하라.
4. 현재 worktree의 공용 `ConfirmDialog`에는 backdrop/fixed positioning 개선이 이미 들어갔을 수 있다. 이를 되돌리지 말고 실제 현재 구현을 기준으로 남은 중복 focus boundary와 focus return을 해결하라.
5. 공용 helper나 CSS를 수정하기 전에 `rg`로 모든 caller를 확인하라.

## 화면 범위

- 검사·완료 기준은 **1440×900과 1600×900 데스크톱**이다.
- light mode와 dark mode를 모두 확인한다.
- **1024px 이하, 모바일, 태블릿 반응형은 이번 작업에서 검사하지 말고 보고하지도 마라.**
- 단, 기존 작은 화면 코드를 고의로 삭제하거나 망가뜨리지는 마라.

## 잠긴 제품 결정

다음은 다시 논의하지 말고 유지한다.

1. `/reviews/partner-customer-evaluations` 글로벌 페이지를 유지한다.
2. 내비게이션은 `Partner Notes`, H1은 `Partner Notes About Customers`를 유지한다.
3. Customer Reviews와 합치지 않는다.
4. 원래 Partner note text는 immutable evidence다. 관리자 작업으로 수정하거나 삭제하지 않는다.
5. 기존 DB enum을 유지하고 UI에서 다음처럼 표현한다.
   - `PUBLISHED` → `Retained`
   - `REPORTED` → `Needs review`
   - `HIDDEN` → `Restricted`
6. `REPORTED` Partner note가 customer의 `reportedReviewCount` 신호에 포함되는 현재 동작을 유지한다.
7. assignment, SLA, bulk action, export, 새 workflow engine, 새 상태 enum은 추가하지 않는다.
8. 새 패키지·새 UI framework·새 state library를 추가하지 않는다.
9. schema/migration은 현재 필드로 구현할 수 있으므로 추가하지 않는다.

## 구현 목표

이번 작업은 P1 항목을 모두 완료하고, 아래 P2 항목까지 함께 정리하는 하나의 마감 패스다.

### P1-A. 상태 변경 메뉴를 실제로 읽고 사용할 수 있게 수정

현재 재현된 문제:

- 1440px에서 action text 폭이 약 81px다.
- 1600px에서도 menu link 폭이 약 71px다.
- `Send to Needs review`, `Restrict`가 글자 단위로 끊긴다.

구현 방향을 다음으로 고정한다.

1. 현재 5열을 다음 4열로 단순화한다.
   - `Submitted`
   - `Partner note`
   - `Context`
   - `Note state`
2. `Context`에는 다음을 읽기 쉬운 순서로 묶는다.
   - Customer link
   - Partner link
   - Booking short-id link
   - Service
3. 상태 열에는 state badge, active reason 또는 review summary, action trigger만 둔다.
4. 현재 cell 내부 `<AdminDetails>` 상태 메뉴를 제거한다.
5. 저장소의 기존 `ActionMenu`를 `variant="dropdown"`으로 재사용한다.
6. menu는 table column 폭과 무관한 overlay여야 한다.
7. menu panel 최소 폭은 220px로 하고 viewport 오른쪽과 충돌하지 않게 정렬한다.
8. 현재 state와 같은 action은 표시하지 않는다.
9. action link는 기존 confirmation URL과 `returnTo`를 그대로 보존한다.

권장 CSS 목표:

- Submitted: 약 140~160px
- Partner note: 남은 폭의 주 영역, 최소 320px
- Context: 약 250~280px
- Note state: 최소 200~220px
- note preview: 2~3줄 clamp
- state/action label은 단어 또는 글자 단위로 부자연스럽게 깨지지 않아야 한다.

완료 기준:

- 1440×900과 1600×900에서 horizontal page scroll 없음.
- Partner note preview와 state가 동시에 보임.
- dropdown menu panel 실제 폭 220px 이상.
- 모든 action label을 즉시 읽을 수 있음.
- `Review state / actions`처럼 잘리는 header가 없음.

### P1-B. Custom dates 동작 복구

현재 원인:

- `buildReviewFilters()`가 날짜 없는 `dateRange=custom`을 `all`로 정상화한다.
- `Custom dates` segmented link도 같은 URL을 사용해서 클릭 즉시 All dates로 redirect된다.
- From/To UI를 열 수 없다.

다음 방식으로 해결한다.

1. `Custom dates`를 `REVIEW_DATE_RANGE_OPTIONS` 기반 segmented range option에서 이 페이지에 한해 제외한다.
2. range options에는 `All dates`, `Today`, `Previous day`, `Last 7 days`, `Last month`만 둔다.
3. 별도의 native `<details>` 또는 기존 disclosure component를 사용해 `Custom dates`를 입력 열기 동작으로 제공한다.
4. disclosure를 여는 행위는 URL이나 현재 date range를 변경하지 않는다.
5. disclosure 안에서 보이는 `From`, `To`, `Apply dates`를 제공한다.
6. Apply할 때만 `dateRange=custom`, `dateFrom`, `dateTo`를 제출한다.
7. 한쪽 날짜만 있는 open range는 기존 API가 지원하는 의미를 유지한다.
8. 양쪽이 모두 비면 All dates로 canonicalize한다.
9. `From > To`는 inline error를 표시하고 list/summary를 조회하지 않는다.
10. Customer Reviews의 shared date 동작을 깨뜨리지 않는다.

완료 기준:

- Custom dates를 한 번 클릭하면 From/To가 즉시 보인다.
- valid custom range가 URL과 API `from/to`에 반영된다.
- empty custom은 base All dates로 돌아간다.
- reversed date는 오류를 보이며 silently swap하지 않는다.

### P1-C. 상태 queue와 filter 정보 구조 통합

현재는 같은 상태 filtering을 두 번 제공한다.

- filter card: `All / Retained / Needs review / Restricted`
- summary strip: `Total / Needs review / Restricted / Retained`

다음으로 통합한다.

1. summary strip을 유일한 state/queue filter로 유지한다.
2. filter card 안의 state segmented control은 제거한다.
3. queue 순서는 항상 다음으로 통일한다.
   - Total
   - Needs review
   - Restricted
   - Retained
4. 각 item은 active date/search scope의 global state count를 유지한다.
5. active queue는 text, background, `aria-current`로 표시한다.
6. queue link를 바꿔도 date/search/sort/pageSize를 보존하고 page만 1로 초기화한다.

필터에는 다음의 **화면에 보이는 label**을 제공한다.

- `Submitted date`
- `Custom dates`
- `Sort`
- `Search`
- `Rows`

`aria-label` 또는 `sr-only`만으로 완료 처리하지 마라.

1440px 이상에서 flex-wrap 결과에 맡기지 말고 page-specific CSS grid를 사용한다. search placeholder 전체 문구가 잘리지 않아야 하며 Apply 버튼이 다른 줄에 홀로 떨어지지 않아야 한다.

중복 정보도 줄인다.

- filter result badge와 table result badge 중 하나만 유지한다.
- queue count와 별도로 같은 `2 notes`를 여러 곳에 반복하지 않는다.

### P1-D. confirmation을 하나의 올바른 modal lifecycle로 정리

현재 소스를 먼저 확인하라. 감사 시점에는 다음 문제가 있었다.

- `ConfirmDialog` 자체 focus boundary 외에 `PartnerNoteConfirmationFocusBoundary`가 한 번 더 감싸고 있었다.
- Escape가 중복 handler를 탈 수 있었다.
- 닫힌 뒤 original action trigger가 아니라 row에 focus가 갔다.
- shared ConfirmDialog의 backdrop/fixed modal 개선이 현재 worktree에 일부 들어갔을 수 있다.

수정 요구:

1. page-specific `PartnerNoteConfirmationFocusBoundary`를 제거한다.
2. 공용 `ConfirmDialog`가 backdrop, fixed positioning, focus trap을 이미 제공하면 그대로 재사용한다.
3. modal focus lifecycle은 한 곳에서만 관리한다.
4. modal open 시 focus는 Cancel 또는 첫 form control로 이동한다.
5. Tab/Shift+Tab은 modal 안에서만 순환한다.
6. Escape, Cancel, backdrop click은 모두 mutation 없이 닫는다.
7. background는 modal 동안 pointer로 조작할 수 없어야 한다.
8. 접근성 트리에서도 modal 외 배경을 읽거나 탭으로 이동할 수 없도록 현재 공용 drawer/modal convention에 맞게 inert 또는 동등한 처리를 사용한다.
9. 닫힌 뒤 해당 row의 Actions trigger로 focus가 복원되어야 한다.
10. filter, sort, page, pageSize, queue가 `returnTo`에 보존돼야 한다.

confirmation 내용은 다음처럼 정리한다.

- Needs review title: `Send note {shortId} to Needs review?`
- Restricted title: `Restrict note {shortId}?`
- Retained title: `Return note {shortId} to Retained?`
- `reported-review risk signal`만 쓰지 말고 운영 영향을 평문으로 설명한다.
- 예: `The note remains internal and increases this customer's Needs review signal used by Customer Support.`

reason options는 목표 상태별로 분리한다.

- Needs review: booking context verification, factual dispute, possible sensitive data, possible abusive language
- Restricted: confirmed sensitive data, confirmed abusive/discriminatory language, confirmed inaccurate note, policy restriction
- Retained: active reason clear, audit history 유지

원문 comment는 어떤 form/action/API에서도 전달하거나 변경하지 않는다.

### P1-E. metadata 대비와 문구 수정

감사 실측:

- light 약 2.29:1
- dark 약 2.75:1
- 12px text

`Last reviewed`, reviewer, reason은 운영 증거이므로 disabled-looking token을 쓰면 안 된다.

수정:

1. light/dark 모두 contrast 4.5:1 이상인 기존 muted/text token을 사용한다.
2. 최소 13px을 사용한다.
3. moderation log가 없으면 `Last reviewed Not reviewed · Not reviewed`를 출력하지 않는다.
4. 대신 `Not manually reviewed` 한 줄을 사용한다.
5. moderation log가 있으면 `Reviewed {date} · {operator}` 한 줄로 표현한다.
6. default `PUBLISHED`와 실제 operator retain 결정을 혼동하지 않도록 log가 없을 때는 `Retained · default state` 또는 동등하게 명확한 문구와 neutral tone을 사용한다.

### P1-F. Booking·Customer·Partner 상세의 Partner note 정책 통일

반드시 관련 caller를 찾는다.

- `AdminReviewRecordsSection`
- Booking detail caller
- Customer detail caller
- Partner detail caller

현재 공용 component의 이전 용어를 정리한다.

- `Partner evaluations` → `Partner notes`
- `Customer evaluation` → `Partner note`
- `evaluation(s)` → 자연스러운 `note/notes`
- `Evaluation submitted` → `Note submitted`

각 Partner note에는 다음을 표시한다.

- Retained / Needs review / Restricted badge
- active reason이 있으면 reason
- reviewedAt/reviewer가 이미 응답에 있으면 review summary
- Restricted이면 `Restricted evidence · Do not use for customer decisions`
- global page로 가는 `Open in Partner Notes` deep link

추가 요구:

- contextual page에서 moderation action을 복제하지 않는다. action은 글로벌 Partner Notes page에만 둔다.
- Partner note 정렬은 booking openedAt이 아니라 note `createdAt` 기준으로 통일한다.
- 이번 global list에서 제거한 phone/presence를 다시 넣지 않는다.

## P2 정리 항목

### P2-A. 첫 viewport의 업무 밀도 개선

1440×900에서 실제 첫 row 또는 empty message가 첫 viewport 안에 보여야 한다.

- 중복 state filter 제거로 filter 높이를 줄인다.
- 반복되는 result count 하나를 제거한다.
- table description을 한 줄로 유지한다.
- header·설명·필터·summary가 업무 목록을 과도하게 아래로 밀지 않게 한다.

### P2-B. Full note detail을 좁은 table cell 안에서 확장하지 않기

현재 `Full note and metadata`는 note를 반복하고 다른 열의 Partner/Customer/Booking/Submitted까지 다시 출력해 한 행을 지나치게 늘린다.

다음 중 저장소에서 이미 검증된 가장 작은 패턴을 재사용한다.

- 기존 admin drawer
- full-width row detail panel

우선순위는 기존 drawer 재사용이다. 새 generic drawer framework를 만들지 않는다.

detail에는 다음만 구조화한다.

1. Full immutable note
2. Context: customer, Partner, booking, service, submitted, booking requested
3. Moderation: current state, active reason, reviewed by/at
4. `View moderation history`

목록에 이미 보이는 값을 좁은 note cell 안에서 다시 반복하지 않는다.

### P2-C. moderation history 접근

- 목록 API는 latest moderation 한 건만 유지해도 된다.
- drawer에서 기존 `adminAuditLog` target `provider_customer_review:{id}`의 history를 볼 수 있는 최소 read-only 경로를 제공한다.
- before, after, reason, actor, timestamp를 표시한다.
- 새 workflow나 새 table을 만들지 않는다.
- 기존 audit-log route/filter를 재사용할 수 있으면 deep link를 우선한다.

### P2-D. Partner note API 응답 최소화

현재 list select가 공용 summary select를 통해 화면에 불필요한 phone, email, roles, rating, currentLat/currentLng, blockedAt 등을 가져오는지 확인하라.

가능하면 이 surface에 맞는 최소 Prisma select를 기존 select 조각으로 구성한다.

- note: id, booking/customer/provider ids, comment, status, reportReason, moderatedAt, createdAt
- customer: id, fullName
- Partner: id, displayName
- booking: id, openedAt/createdAt, service name
- latest moderation: actor label, reason, timestamp

불필요한 PII와 실시간 위치를 list/confirmation 응답에서 제거한다. 단, 공용 detail API를 전역으로 축소해 다른 화면을 깨뜨리지 말고 Partner note endpoint의 select만 최소화한다.

## 코드 조사 대상

최소한 다음 파일과 모든 관련 caller를 확인한다.

- `apps/admin_web/app/reviews/partner-customer-evaluations/page.tsx`
- `apps/admin_web/app/reviews/partner-customer-evaluations/actions.ts`
- `apps/admin_web/app/reviews/partner-customer-evaluations/partner-note-confirmation-focus-boundary.tsx`
- `apps/admin_web/app/reviews/partner-customer-evaluations-section.tsx`
- `apps/admin_web/app/reviews/partner-customer-note-action-confirmation.ts`
- `apps/admin_web/app/reviews/review-page-model.ts`
- `apps/admin_web/components/action-menu.tsx`
- `apps/admin_web/components/confirm-dialog.tsx`
- `apps/admin_web/components/confirm-dialog-focus-boundary.tsx`
- `apps/admin_web/components/use-admin-modal-focus.ts`
- `apps/admin_web/components/admin-review-records-section.tsx`
- `apps/admin_web/app/globals.css`
- `apps/admin_web/lib/admin-api.ts`
- 관련 `*.spec.ts` / `*.spec.tsx`
- `apps/api/src/admin/admin-review.routes.ts`
- `apps/api/src/admin/admin.dto.ts`
- `apps/api/src/admin/admin.service.ts`
- `apps/api/src/admin/admin.service.spec.ts`
- `apps/api/prisma/schema.prisma`는 확인만 하고 migration을 만들지 않는다.
- customer `reportedReviewCount` query와 테스트

## 테스트 요구사항

기존 테스트를 유지하고 다음 회귀 테스트를 추가하거나 강화한다. source string 존재 여부만 검사하지 말고 실제 behavior를 증명하라.

### Admin Web model/page/component

1. base URL은 All dates.
2. Today는 explicit query.
3. Custom dates disclosure를 열면 From/To가 보임.
4. valid custom range가 유지됨.
5. empty custom은 All dates로 canonicalize.
6. reversed custom은 inline error, API 미호출.
7. state filter는 queue strip 한 곳만 존재.
8. queue 변경 시 독립 filter 보존, page 1 reset.
9. 4-column header와 Context cell content.
10. ActionMenu dropdown에 현재 상태를 제외한 action만 존재.
11. confirmation returnTo가 모든 filter/page context를 보존.
12. confirmation page-specific 이중 focus boundary가 없음.
13. no moderation이면 `Not manually reviewed`.
14. contextual Partner notes에 state/reason/restriction 표시.
15. note와 state가 자연스러운 단수/복수 문구 사용.

### Browser interaction 또는 Playwright 수준 검증

1. 1440×900 action menu panel width ≥ 220px.
2. 1600×900 action menu panel width ≥ 220px.
3. menu label이 글자 단위로 깨지지 않음.
4. Custom dates click 후 From/To visible.
5. modal open 시 background interaction 차단.
6. Tab/Shift+Tab trap.
7. Escape/Cancel 후 같은 row의 Actions trigger focus.
8. 1440×900 first viewport에서 first row 또는 empty state visible.
9. light/dark metadata computed contrast ≥ 4.5:1.

### API

1. list/summary date/search/status/sort/pagination 유지.
2. moderation은 comment를 변경하지 않음.
3. Needs review/Restricted reason 필수.
4. Retained는 active reason clear.
5. audit log에 actor, IDs, before/after, reason, timestamp.
6. REPORTED note가 customer risk signal에 계속 포함됨.
7. Partner note list/confirmation select에 불필요한 PII/location이 없음.
8. moderation history read path를 추가했다면 target이 정확히 scope됨.

## 브라우저 검증 시나리오

로그인된 현재 관리자 브라우저를 사용한다. 실제 production-like record에 mutation을 제출하지 않는다. confirmation은 열고 Cancel/Escape까지만 검증하고 mutation은 automated test로 증명한다.

반드시 확인할 URL/state:

- `/reviews/partner-customer-evaluations`
- `?dateRange=today`
- Custom dates disclosure open
- valid custom range
- reversed custom range
- `?status=needs-review`
- `?status=restricted`
- `?status=retained`
- guaranteed no-match search
- out-of-range page
- 각 현재 row의 ActionMenu
- Needs review/Restricted/Retained confirmation open → cancel
- Restricted Partner note가 보이는 Booking/Customer/Partner detail

viewport:

- 1440×900 light
- 1440×900 dark
- 1600×900 light
- 1600×900 dark

1024px 이하 검증은 하지 않는다.

브라우저 console error/warning과 failed network request도 확인한다.

## 검증 명령

정확한 파일명은 현재 저장소에 맞게 조정하되 최소 다음을 실행한다.

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- app/reviews/partner-customer-evaluations/page.spec.tsx app/reviews/partner-customer-evaluations-section.spec.tsx app/reviews/partner-customer-evaluations/actions.spec.ts app/reviews/partner-customer-note-action-confirmation.spec.ts app/reviews/review-page-model.spec.ts components/admin-review-records-section.spec.tsx components/confirm-dialog.spec.tsx

npm.cmd run test --workspace @massage-vn/api -- src/admin/admin.service.spec.ts -t "partner customer evaluations|Partner note|reported provider note"

npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run typecheck --workspace @massage-vn/api
```

수정한 Admin Web/API 파일에 대해 scoped ESLint도 실행한다. shared review helper, ConfirmDialog, ActionMenu, AdminReviewRecordsSection을 수정했다면 그 caller들의 focused regression test도 추가로 실행한다.

## 금지 사항

- 실제 브라우저에서 moderation submit 금지
- Partner note 원문 수정/삭제 금지
- 새 dependency 추가 금지
- 새 generic workflow/repository/state system 금지
- DB migration 금지
- Customer Reviews와 Partner Notes 병합 금지
- assignment/SLA/bulk/export 추가 금지
- unrelated dirty files 정리·format·revert 금지
- broad formatter 실행 금지
- source string test만 추가하고 browser behavior를 검증하지 않는 행위 금지
- 1024px 이하 문제를 이번 결과에 포함하는 행위 금지

## 구현 완료 기준

다음 항목이 모두 충족돼야 완료다.

1. 1440×900과 1600×900에서 note/action/state가 잘리지 않는다.
2. ActionMenu panel 폭이 220px 이상이고 모든 action label이 읽힌다.
3. Custom dates를 정상 UI 경로로 열고 적용할 수 있다.
4. state filtering은 queue strip 한 곳에서만 제공된다.
5. Submitted date, Custom dates, Sort, Search, Rows label이 화면에 보인다.
6. search placeholder와 Apply가 깨지지 않는다.
7. first viewport에서 실제 row 또는 empty state가 보인다.
8. modal은 하나의 focus lifecycle만 사용하고 background interaction을 차단한다.
9. Escape/Cancel 후 해당 Actions trigger로 focus가 복원된다.
10. metadata contrast가 light/dark 모두 4.5:1 이상이다.
11. `Not reviewed · Not reviewed` 중복 문구가 없다.
12. Booking/Customer/Partner 상세에서 Partner note 명칭과 state/reason/restriction이 일치한다.
13. Restricted note의 사용 제한이 모든 contextual surface에서 보인다.
14. original comment는 어떤 경로에서도 변경되지 않는다.
15. API response에서 불필요한 PII/location over-fetch가 제거된다.
16. focused tests, typecheck, scoped lint가 통과한다.
17. 브라우저 검증 screenshot을 저장하고 console/network 결과를 보고한다.

## 결과물 저장

검증 screenshot과 결과 요약을 다음 폴더에 저장하라.

`output/partner-customer-evaluations-improvement-v2-verification-2026-08-07/`

최소 screenshot:

- 1440 light overview + first row
- 1440 ActionMenu open
- 1600 ActionMenu open
- Custom dates fields open
- reversed date error
- Needs review empty 또는 populated queue
- confirmation modal
- 1440 dark overview/table
- Restricted contextual detail

## 최종 응답 형식

다음 순서로 보고하라.

1. **Implemented** — P1/P2별 실제 수정 사항
2. **Changed files** — 파일별 한 줄 설명
3. **Behavior verified** — 1440/1600 light/dark, custom dates, menu, modal, contextual status
4. **Tests** — 실행 명령과 정확한 pass/fail 수
5. **Screenshots** — 저장 폴더와 대표 파일
6. **Protected areas** — 실제 note mutation 없음, schema/auth/payment/booking 보호 여부
7. **Remaining risks** — 실제로 남은 것만, 없으면 `None`

완료하지 못한 항목이 있으면 완료했다고 표현하지 말고 정확한 원인과 재현 방법을 적어라.

