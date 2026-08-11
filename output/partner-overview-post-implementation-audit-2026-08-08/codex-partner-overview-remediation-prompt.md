# Codex Task Prompt — Partner Operations 재감사 후 개선 구현

이 문서는 `AGENTS.md`에 추가하는 영구 지침이 아니라, **새 Codex 작업에 그대로 붙여 넣어 사용하는 일회성 구현 프롬프트**다.

---

당신은 HANDS 관리자 웹의 `Partner Operations` 화면을 실제 운영자가 숫자를 신뢰하고 바로 업무를 처리할 수 있는 상태로 개선하는 단일 Codex 구현자다.

화면을 예쁘게 꾸미는 것이 목적이 아니다. 다음 운영 계약을 정확하게 만드는 것이 목적이다.

```text
화면의 숫자 → 같은 범위의 실제 목록 → 판단 근거 → 안전한 다음 행동
```

작업 위치:

```text
C:\dev\massage-on-demand-vn
```

다른 유사 프로젝트나 오래된 workspace를 사용하지 마라.

대상 화면:

```text
http://localhost:3101/partners/overview
```

## 1. 최종 목표

다음 결과를 실제 코드와 실행 화면에서 모두 달성하라.

1. 필터된 카드 숫자와 클릭 후 Partner 목록 숫자가 일치한다.
2. 고객 취소·no-show·expired를 실제 matching failure처럼 표시하지 않는다.
3. 현재 readiness snapshot을 선택 기간 전환 퍼널처럼 표현하지 않는다.
4. `Action required`가 실제 활성 업무 집합과 일관된 우선순위를 보여준다.
5. 정상 Offline을 모두 위험 업무로 분류하지 않는다.
6. Quality risk의 총수와 상세 행이 같은 canonical predicate를 사용한다.
7. 지급 예정액과 Partner 미수금을 부호·시간 범위에 맞게 분리한다.
8. 1440px 이상 데스크톱에서 필터·표·빈 상태를 빠르게 읽고 조작할 수 있다.
9. 기존 권한, 감사, 지갑, 지급, 예약, 고객 앱 공개 정책을 깨지 않는다.

## 2. 먼저 읽고 확인할 자료

다음 순서로 읽어라.

1. `AGENTS.md`
2. `docs/agent/HANDS_CODEX_WORKFLOW_GUARD.md`
3. `docs/architecture/provider-onboarding.md`
4. `docs/architecture/admin-vuexy-design-system.md`
5. `output/partner-overview-post-implementation-audit-2026-08-08/partner-overview-post-implementation-audit.md`
6. `apps/admin_web/app/partners/overview/page.tsx`
7. `apps/admin_web/app/partners/overview/partner-overview-model.ts`
8. `apps/admin_web/app/partners/overview/page.spec.tsx`
9. `apps/admin_web/app/partners/overview/partner-overview-model.spec.ts`
10. `apps/admin_web/lib/admin-api.ts`
11. `apps/admin_web/app/globals.css`의 Partner Overview 관련 selector
12. `apps/api/src/admin/admin.service.ts`의 `getPartnerOverview()` 및 관련 helper
13. `apps/api/src/admin/admin.service.spec.ts`의 Partner Overview 테스트

이번 감사의 화면 증거:

```text
output/partner-overview-post-implementation-audit-2026-08-08/*.png
```

이전 보고서나 기억보다 위 current-run 보고서와 현재 코드를 우선한다. 다만 보고서 작성 이후 코드가 바뀌었다면 현재 동작을 다시 확인하고 차이를 기록한 뒤 작업하라.

## 3. 저장소와 작업 안전 규칙

- 저장소 지침에 따라 sub-agent를 사용하지 않는다.
- 시작 즉시 `git status --short`를 확인한다.
- 현재 worktree는 매우 dirty하며 기존 변경은 사용자 소유다.
- `git reset`, `git checkout --`, `git restore`, `git clean`으로 기존 변경을 제거하지 않는다.
- 대상 파일도 이미 수정된 상태다. 편집 전 반드시 현재 diff와 주변 코드를 읽고 기존 개선을 보존하라.
- 관련 없는 파일을 정리하거나 포맷하지 않는다.
- 새 production dependency를 추가하지 않는다.
- schema migration을 만들지 않는다.
- `globals.css` 전체 재작성이나 관리자 웹 전면 리팩터링을 하지 않는다.
- 기존 Admin 컴포넌트, status badge, form, table, empty state, query helper를 우선 재사용한다.
- 사용자 화면에서는 항상 `Partner`를 사용하고 내부 타입/DB 이름만 기존 `provider`를 유지할 수 있다.
- 실제 승인, 지급, 지갑 정산, 제재, 예약 상태 변경을 브라우저에서 제출하지 않는다.
- 브라우저 검증은 읽기, 필터, 정렬, 링크 이동만 수행한다.
- 사용자가 요청하지 않았으므로 commit을 만들지 않는다.
- 보호 영역을 변경하게 되면 변경 이유와 추가 검증을 최종 보고에 명시한다.

## 4. 화면 범위

운영 환경은 1440px 이상 데스크톱만 사용한다.

검증 viewport:

```text
1692 × 1272 권장
1440 × 900 최소
```

중요:

- 1024px 이하 반응형은 검사하거나 수정 목표로 삼지 않는다.
- 최종 보고에도 1024px 이하 내용을 넣지 않는다.
- 그렇다고 기존 작은 화면 CSS를 의도적으로 깨뜨리지는 마라. 관련 없는 responsive rule은 그대로 보존한다.

## 5. 구현 순서

아래 slice를 순서대로 구현하라. 각 slice는 root cause 확인, 최소 수정, focused test를 끝낸 뒤 다음으로 이동한다.

### Slice A — 카드 숫자와 대상 목록의 필터 계약

현재 확인된 문제:

7일 + Negative wallet 필터에서 화면은 다음을 표시한다.

```text
Selection drop-off:          2
Quality risk:                1
Online but not bookable:    19
```

하지만 일부 링크는 필터를 잃는다.

```text
Quality risk 1
  → /partners?review=quality-all&qualityRange=7d

Online but not bookable 19
  → /partners?review=available-blocked
```

우선 확인할 코드:

```text
apps/admin_web/app/partners/overview/page.tsx:620-660
apps/api/src/admin/admin.service.ts:35341-35419
apps/api/src/admin/admin.service.ts:35483-35575
```

수정 요건:

1. Overview의 count와 대상 Partner list query를 동일한 filter contract에서 생성한다.
2. 대상 목록이 지원하는 다음 범위를 가능한 한 보존한다.

```text
city
serviceId
verificationStatus
onlineStatus
walletStatus
riskStatus
range / qualityRange
queue-specific review
```

3. 공통 query builder 또는 명시적인 mapping helper를 가장 높은 안정적인 지점에 둔다.
4. 카드마다 query string을 임의로 하드코딩하지 않는다.
5. 대상 `/partners` 화면이 지원하지 않는 필터가 있다면 다음 중 하나를 선택하고 테스트로 고정한다.
   - 목록 route가 같은 필터를 안전하게 지원하도록 확장한다.
   - subset count를 링크에 사용하지 않고 `Open full queue`처럼 범위가 달라짐을 명시한다.
6. 가능하면 첫 번째 방식을 사용해 count와 list를 일치시킨다.
7. active filter chip 제거와 Clear all 동작은 유지한다.
8. Selection 내부 링크처럼 이미 필터를 보존하는 동작은 회귀시키지 않는다.

필수 계약 테스트:

- 7d + wallet negative에서 Quality card의 count와 대상 list count가 같다.
- 7d + wallet negative에서 Online but not bookable count와 대상 list count가 같다.
- city/service/risk가 추가돼도 href가 해당 지원 범위를 잃지 않는다.
- card accessible name과 실제 링크 범위가 일치한다.

### Slice B — Area outcome 의미 수정

현재 문제:

```text
HCM · Open demand 1 · Failed 150 · Failure rate 99%
```

현재 API는 다음 상태를 모두 failed booking으로 취급한다.

```text
CANCELLED
NO_SHOW
EXPIRED
```

취소 actor/reason을 구분하지 않았으므로 이는 matching failure가 아니다.

우선 확인할 코드:

```text
apps/api/src/admin/admin.service.ts:7606
apps/api/src/admin/admin.service.ts:7948-7968
apps/api/src/admin/admin.service.ts:35013-35098
apps/admin_web/app/partners/overview/page.tsx:706-759
apps/admin_web/lib/admin-api.ts
```

수정 요건:

1. 현재 상태 집합을 유지한다면 다음처럼 이름을 바꾼다.

```text
Failed                 → Non-completed outcomes
Failure rate           → Non-completed share
High Failure           → High non-completed share
failedRequests         → nonCompletedOutcomes
matchingFailureRate    → nonCompletedShare
```

2. 실제 `Matching failure`를 사용하려면 공급 부족, matching timeout 등 확정된 reason/actor만 계산해야 한다.
3. 추정으로 귀책을 만들지 않는다.
4. 상단 `Non-completed booking rate`와 Area 표가 동일한 상태 정의를 사용하게 한다.
5. API type, UI header, status copy, tests를 함께 수정해 오래된 용어가 남지 않게 한다.
6. API response rename이 영향이 크다면 호환 가능한 최소 변경을 선택하되 UI에 잘못된 의미는 남기지 않는다.

필수 테스트:

- customer cancellation이 matching failure로 표시되지 않는다.
- no-show/expired를 포함한 집합을 사용하면 UI가 `Non-completed`라고 표시한다.
- 분모가 0이면 `No events`이며 0%나 100%로 위장하지 않는다.

### Slice C — Readiness를 current snapshot으로 수정

현재 funnel은 선택 기간과 무관한 현재 count다.

```text
Registered 1,392 → Approved 1,235 → Bookable now 0
```

Today와 Last 7 days에서 같은 값이지만 UI는 `Last 7 days`, `100% drop`을 표시한다.

우선 확인할 코드:

```text
apps/api/src/admin/admin.service.ts:8817-8825
apps/admin_web/app/partners/overview/page.tsx의 funnel/render 구간
apps/admin_web/app/partners/overview/partner-overview-model.ts
```

수정 요건:

1. 섹션명을 `Current readiness snapshot`으로 변경한다.
2. selected-period badge를 제거하고 `Current · as of {generatedAt}` scope를 사용한다.
3. signup conversion/drop 문구를 제거한다.
4. 다음처럼 현재 상태 비율을 명시한다.

```text
Registered
Approved
Bookable now
Approved / registered
Bookable / approved
```

5. 진짜 cohort conversion API를 새로 만들지 않는다. 현재 요청은 기존 snapshot을 정확하게 표현하는 최소 수정이다.
6. 3개 카드라면 desktop grid도 3열 또는 compact summary에 맞춘다.

필수 테스트:

- range가 Today/7d/30d/90d로 변해도 current snapshot에는 period label이 붙지 않는다.
- Bookable now를 onboarding drop으로 설명하지 않는다.

### Slice D — Action required와 Offline 분류

현재 상단 Action required는 selection, wallet, quality 세 종류만 생성한다. 그러나 상세에는 Today 8개, 7일 9개 활성 큐가 있다.

우선 확인할 코드:

```text
apps/admin_web/app/partners/overview/page.tsx:620-702
apps/admin_web/app/partners/overview/page.tsx:1214-1274
apps/api/src/admin/admin.service.ts:8615-8632
apps/api/src/admin/admin.service.ts:35483-35575
```

수정 요건:

1. `Action required` 후보를 실제 활성 queue/status 집합에서 파생한다.
2. 상단에는 운영 영향이 큰 3~4개만 보여준다.
3. 최소 후보에 다음을 포함한다.

```text
Online but not bookable
Pending verification
Quality follow-up
Negative wallet / payout blocker
```

4. priority는 가능한 경우 `impact`, `oldest waiting`, `SLA breach`를 사용한다.
5. backend에 oldest/SLA/owner 데이터가 없으면 임의 숫자나 가짜 담당자를 만들지 않는다. 우선 명시적 impact tier와 count로 정렬하고 missing metadata를 남은 위험으로 보고한다.
6. `Only queues with current work are shown`이라는 문구가 실제 후보 집합을 설명하게 한다.
7. 전체 큐 중 상위 일부만 표시한다면 `Top 4 of 9 active queues`처럼 관계를 명시한다.
8. Offline은 neutral current status로 처리한다.
9. 다음처럼 근거 있는 예외만 action으로 유지한다.

```text
No operational activity in 7D
Expected online but offline — 실제 일정 데이터가 있을 때만
Stale location
Account blocked
Online but not bookable
```

10. Offline과 inactive 7d 집합이 겹칠 수 있음을 설명한다.

필수 테스트:

- Offline count가 0보다 커도 자동으로 `Needs action`이 되지 않는다.
- top action count와 detailed active queue count의 관계가 화면에 명시된다.
- 0건 queue는 Action required에 나오지 않는다.

### Slice E — Quality risk canonical predicate

현재 count query에는 lifetime `ratingAvg < 3`이 포함되지만 preview rows는 다음만 사용한다.

```text
cancellationRate >= 20
lowReviewCount > 0
noShowReports > 0
```

우선 확인할 코드:

```text
apps/api/src/admin/admin.service.ts:8363-8405
apps/api/src/admin/admin.service.ts:8573-8610
apps/api/src/admin/admin.service.ts:8920-8966
```

수정 요건:

1. 품질 위험의 canonical reason set을 하나로 정의한다.
2. count, preview eligibility, mainReason, recommendedAction이 같은 reason set을 사용한다.
3. lifetime rating을 유지하면 row에도 `Lifetime rating below 3` 근거와 scope를 표시한다.
4. selected-period low review와 lifetime rating을 같은 문구로 섞지 않는다.
5. `riskPartnerCount`는 exact total, `riskPartners`는 preview임을 type/copy에서 분명히 한다.
6. provider scan limit 때문에 preview가 일부라면 `Showing 5 of 56`처럼 표시한다.

필수 테스트:

- lifetime rating만 낮은 Partner가 count에 포함되면 preview row 후보에도 포함된다.
- 모든 quality row에는 최소 한 개의 visible quality reason이 있다.
- 음수 지갑만 있는 Partner는 quality risk에 포함되지 않는다.

### Slice F — Payout pending과 receivable 분리

현재 7일 화면은 다음을 표시한다.

```text
Partner Payout Pending: -205,000 VND
```

현재 aggregation은 PENDING/AVAILABLE earning을 selected period의 `createdAt`으로 제한하고 netAmount 부호를 분리하지 않는다.

우선 확인할 코드:

```text
apps/api/src/admin/admin.service.ts:8047-8068
apps/api/src/admin/admin.service.ts:8968-9015
apps/admin_web/app/partners/overview/page.tsx의 Finance 구간
```

수정 요건:

1. `Current payout outstanding`은 다음 조건을 사용한다.

```text
status in PENDING, AVAILABLE
netAmount > 0
selected-period createdAt restriction 없음
```

2. 음수 open earning은 `Partner receivable outstanding`으로 별도 집계한다.
3. period 지표가 필요하면 `Payout created in selected period`처럼 Period activity에 둔다.
4. `Partner Payout Pending` 카드가 음수가 되지 않게 한다.
5. current exposure와 selected-period activity를 type과 copy에서 분리한다.
6. wallet balance summary와 earning receivable은 다른 데이터이면 같은 값처럼 합치지 않는다.
7. payout blocked, bank not approved, tax missing, negative wallet reason은 중복될 수 있음을 명시한다.

필수 테스트:

- negative earning은 payout outstanding에 포함되지 않는다.
- positive PENDING/AVAILABLE은 생성일이 range 밖이어도 current payout outstanding에 포함된다.
- negative open earning은 receivable에 포함된다.
- current payout 값은 range 변경 때문에 바뀌지 않는다.

### Slice G — 1440px 이상 정보 구조와 빈 상태

#### G1. 필터 배치

현재 6개 필터 + 버튼인데 CSS는 `repeat(5, minmax(0, 1fr)) auto`라 Apply가 다음 줄에 혼자 내려간다.

수정 요건:

- 1440px 이상에서 6개 필터와 Apply의 관계가 한눈에 보여야 한다.
- 권장 구조는 `6 filters + auto button` 한 행 또는 `6 filters` 1행 + `active chips | Apply` 2행이다.
- 버튼이 City 아래에 홀로 남지 않아야 한다.
- active filter chips와 Clear all은 유지한다.

#### G2. Area/Service 표

수정 요건:

- 1440px 이상에서 Area/Service identity와 Status를 동시에 읽을 수 있어야 한다.
- Area/Service 첫 열과 Status를 앞쪽에 배치하거나 sticky 처리한다.
- 열을 다음 scope로 묶는다.

```text
Identity / Status
Current supply
Selected-period outcomes
```

- 부차 열의 내부 수평 scroll은 허용하지만, 정체성과 상태가 동시에 사라지면 안 된다.
- 공급과 수요가 모두 0인 지역은 `4 areas with no supply`처럼 compact group으로 줄이는 것을 우선한다.
- 별도 table library를 추가하지 않는다.

#### G3. App activity scope

다음 두 그룹을 분리한다.

```text
Usage in selected period
  App-active Partners
  App Opens
  Session Starts
  Most active

Telemetry coverage and current gaps
  Coverage
  No telemetry recorded
  Telemetry inactive 7D+
```

coverage가 1%일 때 period usage가 전체 Partner 행동을 대표하는 것처럼 보이지 않게 안내한다.

#### G4. Empty state 축약

- Today quality 0건이면 KPI/빈 표를 반복하지 말고 compact empty state를 사용한다.
- Selection 0건이면 issue tabs, sort, empty table을 숨긴다.
- `No quality follow-up in this period`, `No selection friction detected`처럼 한 줄 요약을 사용한다.
- 데이터 source failure는 empty state로 위장하지 않는다.

#### G5. Finance preview와 중복 안내

- Negative wallet 표에 `Largest 5 receivables of 124 · sorted by amount`와 `View all 124`를 제공한다.
- 모든 행에 반복되는 `Current receivable` status 열은 제거하거나 의미 있는 상태가 있을 때만 사용한다.
- `Payout blocked`는 unique Partner count임을 밝히고 bank/tax/wallet reasons는 overlap된다고 안내한다.

#### G6. Stale data

- API의 `refreshSeconds`를 재사용한다.
- `generatedAt`이 `refreshSeconds × 2`보다 오래되면 `Data may be stale`을 표시한다.
- `Refresh now`는 현재 range와 filters를 유지해야 한다.
- polling/realtime framework를 새로 추가하지 않는다.

## 6. 명칭 계약

다음 용어를 일관되게 사용하라.

| 개념 | 권장 명칭 | 금지/주의 |
|---|---|---|
| 상태가 ONLINE_AVAILABLE | Online available | Bookable과 동일시 금지 |
| 모든 최종 수락 게이트 통과 | Bookable now | 단순 온라인 상태에 사용 금지 |
| 선택 기간 미완료 결과 | Non-completed outcomes/share | actor 불명 상태를 Partner failure로 부르지 않음 |
| 현재 가입·승인·예약 가능 상태 | Current readiness snapshot | 기간 funnel/drop으로 표현 금지 |
| 양수 open earning | Current payout outstanding | 음수 값 금지 |
| 음수 open earning/미수 | Partner receivable outstanding | payout pending과 합산 금지 |
| 정상 오프라인 | Offline | 자동 Needs action 금지 |
| 위치 신선도 | Fresh location: last 90 min | `Location <= 90m` 지양 |
| 데이터 미수집 | No app telemetry recorded | 실제 비활성으로 단정 금지 |

## 7. 구현하지 말아야 할 것

- 새 관리자 route를 만들지 않는다.
- 새 chart/table/state-management library를 추가하지 않는다.
- 실제 matching failure 근거 없이 취소 상태를 Partner 귀책으로 재분류하지 않는다.
- 임의 SLA, owner, oldest time을 생성하지 않는다.
- 카드 숫자를 목록에 맞추려고 client-side에서 숨기거나 0으로 조정하지 않는다.
- 링크를 전체 목록으로 보내면서 filtered subset count를 그대로 표시하지 않는다.
- current value와 period value를 같은 badge 아래 두지 않는다.
- API 오류를 정상 0건 empty state로 표시하지 않는다.
- 관련 없는 관리자 페이지의 공통 디자인을 대규모로 바꾸지 않는다.
- 1024px 이하 대응 때문에 이번 desktop 구조를 복잡하게 만들지 않는다.

## 8. 테스트와 검증

항상 focused test부터 실행한다.

Admin Web:

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- app/partners/overview/page.spec.tsx app/partners/overview/partner-overview-model.spec.ts
npm.cmd run typecheck --workspace @massage-vn/admin-web
```

API:

```powershell
npm.cmd run test --workspace @massage-vn/api -- src/admin/admin.service.spec.ts -t "Partner Overview|partner overview"
npm.cmd run typecheck --workspace @massage-vn/api
```

관련 변경이 안정된 뒤:

```powershell
npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api
```

시간 또는 환경 문제로 전체 scope check를 실행하지 못하면 임의로 PASS 처리하지 말고 `SKIPPED`와 이유를 보고한다.

## 9. 실행 화면 검증

로그인된 in-app browser를 우선 사용한다. 로그인 상태가 없다면 로그인 화면을 열고 사용자의 로그인만 기다린다.

필수 상태 matrix:

| 상태 | 확인 내용 |
|---|---|
| Today 기본 | current supply, compact quality/selection empty state, action priority |
| Last 7 days 기본 | period metrics, Area wording, readiness current scope, quality/finance |
| Last 7 days + Negative wallet | active chip, filtered card counts, target list parity |
| 필터 제거 | 개별 remove와 Clear all, range 보존 |
| stale fixture/test state | stale badge와 Refresh now query 보존 |

필수 상호작용 검증:

1. Negative wallet 필터를 적용한다.
2. `Quality risk 1` 같은 filtered card의 href와 실제 대상 list total을 확인한다.
3. `Online but not bookable 19`의 href와 대상 list total을 확인한다.
4. 뒤로 돌아왔을 때 range/filter state가 유지되는지 확인한다.
5. Area 표에 `Failed`/`Failure rate`가 남지 않았는지 확인한다.
6. Last 7 days에서 readiness에 period/drop 문구가 없는지 확인한다.
7. payout outstanding이 음수가 아닌지 확인한다.
8. 1440px 이상에서 Area identity와 Status가 동시에 보이는지 확인한다.
9. Today 0건 Quality/Selection이 compact한지 확인한다.

화면 캡처:

```text
output/partner-overview-remediation-verification-<date>/
```

before/after는 같은 viewport와 같은 filter state를 사용한다. 캡처 후 이미지를 직접 열어 loading, crop, 잘못된 route가 아닌지 확인한다.

스크린샷만 보고 통과시키지 말고 DOM label, href, query string, list total, empty/error state도 함께 확인한다.

## 10. 완료 기준

다음 항목을 모두 PASS 또는 명시적 NOT VERIFIED로 평가하라.

```text
PO-001  Filtered card count = linked list count
PO-002  Current filters preserved in supported drilldowns
PO-003  Area non-completed semantics are honest
PO-004  Current readiness has no selected-period funnel wording
PO-005  Action required derives from actual active work
PO-006  Normal Offline is neutral
PO-007  Quality total and row reasons share one predicate
PO-008  Payout outstanding excludes negative earnings
PO-009  Receivable and payout are separate
PO-010  Filter Apply layout is clear at 1440+
PO-011  Area identity and Status are simultaneously readable at 1440+
PO-012  App usage and telemetry coverage have separate scopes
PO-013  Zero quality/selection states are compact
PO-014  Finance preview scope and overlapping reasons are explicit
PO-015  Stale data warning follows refreshSeconds contract
PO-016  Existing permissions, audit and public visibility contracts remain intact
```

FAIL이 남으면 완료라고 말하지 않는다. 안전하게 고칠 수 있는 root cause라면 계속 수정한다. 다음 경우에만 정확한 blocker를 보고하고 중단한다.

- 기존 사용자 변경과 같은 줄을 안전하게 병합할 수 없음
- schema migration이 실제로 필요함
- 실제 지급/지갑/제재/예약 mutation이 필요함
- 제품 정책이 코드와 문서에서 서로 충돌해 한쪽을 임의로 선택할 수 없음
- 로그인 또는 필요한 권한을 사용자가 제공해야 함

## 11. 최종 보고 형식

파일 목록보다 운영 결과를 먼저 설명하라.

1. 운영자가 더 정확하고 빠르게 판단할 수 있게 된 결과
2. `PO-001~016` PASS/FAIL/NOT VERIFIED 표
3. 발견한 root cause와 핵심 수정
4. 변경 파일과 각 파일의 역할
5. 실행한 테스트·typecheck·scope check 결과
6. filter card count ↔ linked list count 검증값
7. browser route/state matrix와 화면 증거 경로
8. 보호 영역 변경 여부
9. 새 dependency, migration, 실제 mutation 여부
10. 남은 위험과 다음 단 하나의 작업

기존 사용자 변경을 보존했는지 명시하고, 실행하지 않은 검증을 PASS로 표시하지 마라.

지금 `C:\dev\massage-on-demand-vn`에서 `git status --short`를 확인하고, 필수 문서와 현재 diff를 읽은 뒤 Slice A부터 구현하라. 별도 blocker가 없으면 분석 보고만 하지 말고 코드 수정, focused tests, 1440px 이상 실행 화면 검증까지 완료하라.

