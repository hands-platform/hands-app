# Marketing Analytics 최종 개선 실행 프롬프트

아래 전체 내용을 새 Codex 작업에 그대로 전달한다.

---

## 역할과 목표

너는 `C:\dev\massage-on-demand-vn` 저장소의 HANDS 관리자 웹을 실제 운영 가능한 상태로 마무리하는 시니어 풀스택 엔지니어이자 운영 UX 설계자다.

이번 작업은 새 감사 보고서를 작성하는 일이 아니다. 기존 재감사 결과를 근거로 **Marketing Analytics의 코드, API 계약, 권한, 데이터 의미, 테스트, 1440px 이상 운영 화면을 실제로 수정하고 검증하는 작업**이다.

운영자는 매일 광고비 누락, 캠페인 손실, 기여도 품질, 쿠폰 성과를 확인하고 조치한다. 따라서 다음을 우선한다.

1. 데이터가 충분한지 먼저 이해할 수 있어야 한다.
2. `데이터 없음`, `실제 0`, `불완전`, `API 실패`를 다르게 보여야 한다.
3. 다음 행동과 복구 방법이 분명해야 한다.
4. 광고비 변경은 현재값, 변경 이유, conflict 방어, 감사 로그를 보장해야 한다.
5. 빈 상태·권한 없음·동시 수정에서도 작업이 끊기지 않아야 한다.

현재 판정은 다음과 같다.

```text
Score: 72/100
Verdict: RELEASE HOLD
P0: 0
P1: 6
P2: 6
```

## 먼저 읽을 자료

다음을 읽고 현재 코드와 비교한다.

```text
AGENTS.md
docs/audits/marketing-analytics-final-reaudit-2026-08-12.md
docs/audits/marketing-analytics-remediation-report-2026-08-12.md
docs/audits/marketing-analytics-final-reaudit-evidence-2026-08-12/
apps/admin_web/app/marketing-analytics/page.tsx
apps/admin_web/app/marketing-analytics/marketing-analytics-model.ts
apps/admin_web/app/marketing-analytics/actions.ts
apps/admin_web/app/marketing-analytics/marketing-spend-action-form.tsx
apps/admin_web/app/marketing-analytics/page.spec.tsx
apps/admin_web/app/marketing-analytics/marketing-analytics-model.spec.ts
apps/admin_web/app/marketing-analytics/actions.spec.ts
apps/admin_web/lib/admin-api.ts
apps/admin_web/lib/admin-operator-access-model.ts
apps/api/src/admin/admin-analytics.routes.ts
apps/api/src/admin/admin-marketing-analytics.ts
apps/api/src/admin/admin-operator-category.guard.ts
apps/api/src/admin/admin.service.ts
apps/api/src/admin/admin-marketing-analytics.spec.ts
apps/api/prisma/schema.prisma
apps/api/prisma/migrations/20260812140000_add_marketing_spend_permission/migration.sql
```

## 작업 원칙

1. `git status --short`와 marketing 관련 diff를 먼저 확인한다.
2. 기존 사용자 변경을 되돌리거나 정리하지 않는다.
3. 관련 없는 파일을 포맷·리팩터링하지 않는다.
4. 기존 공용 form/table/badge/section atom과 light/dark token을 유지한다.
5. 새 UI·상태관리·차트 라이브러리를 추가하지 않는다.
6. `Missing is not zero`, 서버 전체 action total, review-first, read/write 권한 분리, 부분 실패 처리를 보존한다.
7. 1024px 이하 화면은 검사·수정·보고 범위에서 완전히 제외한다.
8. 필수 viewport는 1440×900 또는 1440×1000, 그리고 1600×1000이다.
9. 실제 공유/운영 데이터에 광고비 row를 생성·수정하지 않는다.
10. production/shared DB migration은 사용자 승인 없이 적용하지 않는다.
11. 마이그레이션 파일 존재와 실행 DB 적용을 같은 것으로 보고하지 않는다.
12. spend GET 실패와 permission migration 미적용을 근거 없이 같은 원인이라고 단정하지 않는다.
13. P1이 남으면 `Release ready`라고 보고하지 않는다.

## 대상 화면

```text
/marketing-analytics?range=today&view=campaigns
/marketing-analytics?range=today&view=attribution
/marketing-analytics?range=today&view=coupons
```

# Phase 0 — 기준선과 원인 확인

## 실제 화면

인증된 in-app browser에서 다음을 확인한다. 로그인 세션이 없으면 로그인만 요청하고 계속한다.

1. Campaigns 첫 화면과 More filters
2. Add spend Draft 입력 후 Review까지만 진행
3. Coupons의 `Load coupon performance`
4. Attribution의 0/0 coverage
5. Recent location evidence의 visible/total count
6. light/dark theme

실제 `Save spend`는 누르지 않는다.

## Spend current-value GET

`GET /admin/marketing/spend-daily`의 실제 응답을 다음처럼 구분한다.

```text
200 + existing row
200 + null — 신규 exact key
400/422 invalid query
401 session expired
403 permission denied
404 route/runtime mismatch
409 canonical duplicate/conflict
429 rate limit
5xx database/API failure
network/unreachable
```

현재 UI는 `readFailed` boolean만 전달해 status/errorCode/requestId를 소실한다. route 등록, API build/runtime, auth, query normalization을 확인하고 증거에 기반해 원인을 기록한다.

## 권한 DB 상태

secret을 출력하지 않고 읽기 전용으로 확인한다.

1. PostgreSQL enum에 `GROWTH_MARKETING_SPEND`가 있는가
2. `_prisma_migrations`에 해당 migration 완료 행이 있는가
3. 실행 API의 generated Prisma client가 같은 enum을 아는가
4. 현재 사용자가 master, reader, spend manager 중 무엇인가

## Baseline 검증

```powershell
npm.cmd test --workspace @massage-vn/admin-web -- --run app/marketing-analytics/page.spec.tsx app/marketing-analytics/marketing-analytics-model.spec.ts app/marketing-analytics/actions.spec.ts
npm.cmd test --workspace @massage-vn/api -- --run src/admin/admin-marketing-analytics.spec.ts src/admin/admin-operator-category.guard.spec.ts src/admin/admin.controller.spec.ts -t "marketing|Marketing"
npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run typecheck --workspace @massage-vn/api
npm.cmd run prisma:migrations:check
```

API typecheck에 marketing 외 referral 오류가 재현되면 baseline failure로 기록하고 관련 없는 코드를 임의로 고치지 않는다.

# Phase 1 — P1 6건 수정

## P1-01. Add spend Review와 복구

### 200 + null

- 신규 row로 간주한다.
- Existing value를 0 VND로 표시한다.
- New value, delta, exact scope를 표시한다.
- operator reason 입력 후 Save가 가능하다.
- `expectedUpdatedAt`은 null/empty로 전달한다.

### 200 + record

- 현재 금액, 신규 금액, delta를 표시한다.
- record의 `updatedAt`을 optimistic version으로 사용한다.

### GET 실패

- Save 버튼을 노출하지 않는다.
- 날짜, source, platform, region, campaign ID/name, amount를 보존한다.
- 다음 동작을 제공한다.

```text
Retry current value
Edit inputs
Cancel
```

상태별 문구와 복구를 구분한다.

| 상태 | 문구 방향 | 복구 |
|---|---|---|
| 401 | Session expired | Sign in again |
| 403 | Spend evidence cannot be loaded with this access | Close/request access |
| 409 | Multiple rows resolve to this campaign key | Review ledger conflict |
| 429 | Too many requests | Retry later |
| 5xx/network | Current spend could not be verified | Retry/Edit inputs |

`requestId`가 있으면 복사 가능한 운영 증거로 제공하되 raw stack, token, secret은 노출하지 않는다.

구현 시 boolean 대신 bounded read-result type으로 status/errorCode/requestId를 전달한다. 복잡한 client store는 만들지 말고 기존 query Draft와 공용 component를 사용한다.

필수 테스트:

```text
existing row → Before/After/Save
missing row 200/null → Existing 0 VND/Save
403/409/503 → no Save + 맞는 복구
모든 실패 → Draft 보존
```

## P1-02. Spend manage 권한과 migration

다음 계약을 유지한다.

```text
GROWTH_MARKETING       = analytics read
GROWTH_MARKETING_SPEND = daily spend write
MASTER_ADMIN           = write allowed
```

- 일반 GROWTH/GROWTH_MARKETING이 spend write를 자동 상속하지 않게 한다.
- schema, migration, permission manifest/UI, web capability, API guard, service authorization을 일치시킨다.
- migration 미적용 DB에서는 `migration required` 상태를 setup/health 또는 구현 보고서에서 분명히 드러낸다.
- local disposable DB이며 사용자가 적용을 승인한 경우에만 migration을 적용한다.
- 적용 시 Prisma generate → API build → restart → role smoke 순서로 검증한다.
- 미적용이면 `created/not applied`라고 보고한다.

역할 테스트:

```text
reader: page/ledger visible, Add spend hidden, POST 403
spend manager: Add spend visible, GET visible, POST allowed
master: allowed
revoked/unknown: denied
```

## P1-03. Coupons 빈 상태의 무반응 CTA 제거

권장 구현:

1. summary activity가 0이면 `Load coupon performance`를 제거한다.
2. honest empty state를 표시한다.

```text
No coupon checkout activity in Today
Try Yesterday, 7 days, or 30 days, or review Coupon operations.
```

3. Range 전환 또는 Coupon operations 링크만 둔다.
4. summary activity가 있을 때만 code-level rows on-demand load를 제공한다.
5. `couponPerformance=1` 직접 접근 + 0 rows는 요청 완료 상태를 표시하거나 canonical empty URL로 정리한다.
6. page API failure와 실제 0 rows를 구분한다.

필수 테스트:

```text
summary 0 → no Load button
summary 0 + couponPerformance=1 → repeated no-op 없음
summary > 0 + not loaded → Load
summary > 0 + rows → table
summary > 0 + 0 rows → explicit loaded-empty
page failure → Retry rows
```

## P1-04. Attribution 0/0을 Not available로 통일

coverage rate를 `number | null`로 바꾼다.

```text
denominator=0 → null
numerator=0, denominator>0 → 0
numerator=denominator>0 → 100
```

signup coverage, entrant coverage, decision readiness에 같은 규칙을 적용한다.

`null` UI:

```text
Not available
No signups in Today
```

- `0% of 0`을 표시하지 않는다.
- no-data 상태에 progressbar와 `aria-valuenow=0`을 렌더링하지 않는다.
- 실제 분모가 있고 coverage가 0일 때만 0%를 표시한다.

테스트: `0/0`, `0/4`, `1/4`, `4/4`.

## P1-05. Location rows와 totalCount 통일

현재 API는 region bucket 전체를 totalCount로 반환하고 UI가 비활동 row를 제거한다. 이를 제거한다.

권장 계약:

1. address save, booking created/completed/cancelled, ad spend 중 하나라도 있는 row만 서버에서 남긴다.
2. 그 전체 row set으로 totalCount를 계산한다.
3. 그 다음 skip/take를 적용한다.
4. UI의 후처리 `hasMarketingActivity` 필터를 제거한다.
5. rows, totalCount, footer가 같은 모집단을 사용한다.
6. 범위를 벗어난 page는 유효 page로 normalize한다.

테스트:

```text
8 buckets/0 active → 0/0
8 buckets/1 active → 1/1
8 buckets/8 active → 8/8
25 active/take 10 → 10/10/5, total 25
region filter → filtered rows/total 일치
```

## P1-06. Campaign 표에 Fee ROAS 제공

위험 정책이 Fee ROAS를 사용하므로 표도 같은 판단 수치를 제공한다.

권장 열:

```text
Campaign
Completed
Ad spend
CPA completed
Fee revenue
Fee ROAS
Gross ROAS
Decision
```

- 공간이 부족하면 Signups/Cancelled를 상세로 이동하되 Fee ROAS는 숨기지 않는다.
- `Fee ROAS = platform fee revenue / ad spend`
- `Gross ROAS = gross booking value / ad spend`
- spend evidence가 missing이면 확정 계산값을 표시하지 않는다.
- action observed value, 표 Fee ROAS, server threshold가 일치해야 한다.
- 1.00x break-even 설명은 한 번만 제공한다.

테스트:

```text
complete spend → Fee/Gross ROAS 분리
missing spend → Not calculable
explicit zero spend → division unavailable
Fee ROAS < 1.00 → action과 row 값 일치
```

# Phase 2 — P2 운영 UX와 성능

## 1440px 첫 화면

1440×900/1000에서 다음이 한 화면에 들어오게 한다.

```text
title
active workspace
range/source 핵심 필터
Decision reliability
Needs action 진입부 또는 첫 action
```

- 큰 hero card를 compact title toolbar로 축소한다.
- workspace와 핵심 filter를 가깝게 둔다.
- Generated/cohort/source는 compact metadata row로 만든다.
- More filters disclosure는 유지한다.
- 새 sticky 구조보다 기존 shell과 충돌하지 않는 최소 변경을 우선한다.
- 1024px 이하 breakpoint는 추가·수정하지 않는다.

## Filter reset 의미

다음처럼 분리한다.

```text
Clear dimensions → source/platform/campaign/region 제거, 현재 range 유지
Use default range → range=7d
```

모호한 `Clear all`은 사용하지 않는다. query round-trip test를 추가한다.

## View별 metadata

Campaigns/Attribution:

```text
Signup cohort
Spend source: manual records
```

Coupons:

```text
Booking-created cohort
Source: booking coupon metadata
```

Coupons에 signup/manual spend metadata를 표시하지 않는다.

## 운영 문구

| 현재 | 수정 |
|---|---|
| `1 expected spend date(s)` | `1 spend date is missing from the ledger` |
| `30 expected spend date(s)` | `30 spend dates are missing from the ledger` |
| `policy marketing-risk-v1` | `Risk policy v1` + 내부 key는 detail |
| `Top 0` | `No ranked campaigns` |
| `No campaign evidence in today` | `No campaign evidence for Today` |
| `n/a` | `Not calculable` 또는 `Not available` |

작은 plural helper는 허용하지만 새 i18n framework는 추가하지 않는다.

## Fetch waterfall

현재 summary batch가 끝난 뒤 dimensions/coupon page/spend ledger가 시작된다.

1. filters와 paging만으로 시작 가능한 요청은 동시에 시작한다.
2. view별 불필요한 endpoint는 호출하지 않는다.
3. Overview는 heavy rows를 로드하지 않는다.
4. Coupons summary와 요청된 page를 병렬로 시작한다.
5. Campaign dimensions와 ledger는 summary를 기다리지 않는다.
6. 실제 정합성 이유가 없으면 새 batch endpoint를 만들지 않는다.
7. 캐시 태그와 spend save invalidation을 유지한다.
8. 가능하면 호출 수, timing, payload 전후를 기록한다.

# Phase 3 — 접근성·경계 상태

1. active workspace/filter의 `aria-current` 또는 selected state를 유지한다.
2. More filters keyboard/disclosure state를 유지한다.
3. 오류는 `role=alert`, 성공은 `role=status`를 사용한다.
4. Retry/Edit/Cancel focus 순서를 자연스럽게 한다.
5. field 오류를 `aria-describedby`로 연결한다.
6. no-data coverage에는 progressbar를 만들지 않는다.
7. status를 색상만으로 전달하지 않는다.
8. dark theme danger/warning/muted 대비를 확인한다.

경계 fixture:

```text
0/1/30 missing dates
0/1/8/25 region rows
0/0, 0/4, 1/4, 4/4 attribution
VND 0, 1, 2,000,000,000, max+1, decimal
long campaign ID/name
Vietnamese accents, CJK, emoji
unknown source/platform
two operators editing same row
```

# Phase 4 — 검증

## 집중 테스트

```powershell
npm.cmd test --workspace @massage-vn/admin-web -- --run app/marketing-analytics/page.spec.tsx app/marketing-analytics/marketing-analytics-model.spec.ts app/marketing-analytics/actions.spec.ts
npm.cmd test --workspace @massage-vn/api -- --run src/admin/admin-marketing-analytics.spec.ts src/admin/admin-operator-category.guard.spec.ts src/admin/admin.controller.spec.ts -t "marketing|Marketing"
```

`admin.service.spec.ts`의 marketing case도 name filter로 실제 실행한다. 모두 skip된 결과를 통과로 기록하지 않는다.

## 정적 검증

```powershell
npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run typecheck --workspace @massage-vn/api
npm.cmd run prisma:migrations:check
```

스크립트가 존재하면 다음도 실행한다.

```powershell
npm.cmd run admin:visible-copy
npm.cmd run admin:api-budget
npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api
```

명령 부재 또는 unrelated baseline failure는 PASS로 위장하지 말고 `SKIPPED`/`FAIL`로 기록한다.

## Impeccable detector

변경 UI에 한 번 실행한다.

```powershell
node C:\Users\laboy\.codex\skills\impeccable\scripts\detect.mjs --no-advisory apps/admin_web/app/marketing-analytics apps/admin_web/app/globals.css
```

공용 CSS의 다른 페이지 finding은 marketing 결함과 분리한다. 무제한 polish loop를 돌리지 않는다.

## 브라우저 QA

인증된 in-app browser에서 캡처한다.

```text
01-campaigns-top-1440x900.png
02-campaigns-decision-1440x900.png
03-campaign-fee-roas-table-1600x1000.png
04-region-pagination-1600x1000.png
05-add-spend-new-row-review.png
06-add-spend-read-error-recovery.png
07-add-spend-read-only-permission.png
08-attribution-no-cohort.png
09-attribution-populated.png
10-coupons-today-empty.png
11-coupons-populated-table.png
12-marketing-dark-1600x1000.png
```

실제 광고비 저장·권한 변경·공유 데이터 mutation 없이 fixture/mock/isolated 환경을 사용한다. 재현 불가능한 상태는 가짜 캡처하지 말고 테스트 증거로 대체한다.

증거 위치:

```text
docs/audits/marketing-analytics-final-remediation-evidence-2026-08-12/
```

# 완료 산출물

```text
docs/audits/marketing-analytics-final-remediation-report-2026-08-12.md
docs/audits/marketing-analytics-final-remediation-evidence-2026-08-12/
```

구현 보고서에는 다음을 포함한다.

1. P1/P2별 root cause와 결과
2. Add spend 상태 전이표
3. permission migration 생성/적용 여부
4. 0/0 attribution contract
5. region rows/totalCount contract
6. Fee ROAS action/table 일치
7. coupon empty/load contract
8. filter reset 의미
9. fetch 전후 요청 구조
10. 변경 파일과 목적
11. 실제 PASS/FAIL/SKIPPED와 test count
12. unrelated baseline failure
13. 1440/1600 light/dark 증거
14. 실행하지 않은 mutation
15. Release ready/hold와 blocker

# 보호 영역

다음을 훼손하지 않는다.

```text
Missing spend is not zero
explicit zero row is valid evidence
server-authoritative total/visible/hidden actions
manual spend review-first flow
operator reason and audit event
expectedUpdatedAt conflict protection
read/manage-spend permission separation
partial endpoint failure isolation
generatedAt and metric scope
coupon operations vs coupon finance responsibility
existing admin tokens/shared UI atoms
light/dark theme
1440px+ desktop operations priority
```

# 완료 체크리스트

```text
[ ] 200/null spend row가 신규 Review로 진행된다.
[ ] GET 실패에서 status별 문구와 Retry/Edit/Cancel이 있다.
[ ] 실패 후 Draft가 보존된다.
[ ] migration DB 상태와 적용 여부를 명시했다.
[ ] reader/spend manager/master 역할이 분리된다.
[ ] coupon Today empty에 무반응 CTA가 없다.
[ ] attribution 0/0이 Not available이다.
[ ] no-data 상태에 0% progressbar가 없다.
[ ] region rows와 totalCount가 같은 모집단이다.
[ ] 캠페인 표 Fee ROAS가 action과 일치한다.
[ ] 1440 첫 화면에 reliability/action 진입이 보인다.
[ ] Clear dimensions가 range를 유지한다.
[ ] Coupons metadata가 정확하다.
[ ] 독립 API가 불필요하게 직렬 실행되지 않는다.
[ ] Admin/API focused tests를 실제 실행했다.
[ ] typecheck/migration check 결과를 정확히 기록했다.
[ ] Impeccable detector를 한 번 실행했다.
[ ] 1440/1600 light/dark QA를 완료했다.
[ ] 1024px 이하를 검사·보고하지 않았다.
[ ] 실제 광고비/공유 데이터 mutation이 없다.
```

# 중단 조건

다음 경우에만 사용자 승인을 요청한다.

1. shared/production DB migration 적용
2. 실제 광고비 row 생성·수정
3. 기존 dirty change와 직접 충돌
4. campaign identity merge/backfill
5. 기존 운영자 권한을 바꾸는 정책 결정

그 외에는 합리적인 가정을 기록하고 P1부터 구현을 계속한다.

# 최종 응답 형식

```text
Verdict: Release ready | Release hold
Score: N/100
P1 remaining: 0 | N

Outcome
- 실제 완료된 개선

Changed files
- 파일과 목적

Verification
- 명령: PASS/FAIL/SKIPPED
- test count
- 1440/1600 증거

Migration / protected areas
- created/not applied | applied with approval | none

Data mutations
- none 또는 정확한 목록

Remaining risks
- 출시 차단/비차단 구분

Next action
- 가장 중요한 한 가지
```

## 최종 실행 지시

지금 바로 현재 코드와 화면을 확인하고 구현을 시작한다. 또 다른 감사 보고서나 프롬프트만 작성하고 멈추지 않는다.

1. baseline과 원인을 확인한다.
2. P1 6건을 실제 코드로 수정한다.
3. P2 운영 UX와 fetch 구조를 수정한다.
4. 회귀 테스트를 작성한다.
5. migration은 승인 범위에서만 처리한다.
6. 테스트, typecheck, migration check를 실행한다.
7. 1440/1600 light/dark 화면을 캡처한다.
8. 구현 보고서와 증거를 남긴다.

최종 결과는 더 많은 카드가 아니라, 운영자가 **증거 부족을 성공으로 오해하지 않고, 손실 캠페인의 근거를 확인하며, 광고비를 안전하게 검토하고, 다음 행동을 확실히 선택할 수 있는 작업공간**이어야 한다.

---

