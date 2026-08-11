# Codex 실행용 — Marketing Analytics 재감사 후 개선 구현 프롬프트

아래 프롬프트 전체를 `C:\dev\massage-on-demand-vn`을 workspace로 연 Codex 작업에 붙여 넣어 사용한다.

---

## 프롬프트 시작

`C:\dev\massage-on-demand-vn` 프로젝트의 HANDS Admin `Marketing Analytics` 페이지를 재감사 보고서에 맞게 실제로 수정하고 검증해줘.

이 작업은 단순한 스타일 보정이 아니다. **운영자가 잘못된 지역·기간·광고 효율 수치를 믿지 않도록 데이터 계약을 바로잡고, 1440px 이상 데스크톱에서 빠르고 명확하게 판단하고 조치할 수 있는 화면을 완성하는 것**이 목표다.

### 반드시 먼저 읽을 자료

1. 재감사 보고서
   - `C:\dev\massage-on-demand-vn\output\marketing-analytics-post-remediation-reaudit-2026-08-10\marketing-analytics-post-remediation-deep-reaudit-report.md`
2. 현재 화면 증거
   - `C:\dev\massage-on-demand-vn\output\marketing-analytics-post-remediation-reaudit-2026-08-10\01-default-top-1440.png`
   - `C:\dev\massage-on-demand-vn\output\marketing-analytics-post-remediation-reaudit-2026-08-10\04-attribution-detail-empty-campaign-1440.png`
   - `C:\dev\massage-on-demand-vn\output\marketing-analytics-post-remediation-reaudit-2026-08-10\12-region-filter-hcm-unchanged-headline-1440.png`
   - `C:\dev\massage-on-demand-vn\output\marketing-analytics-post-remediation-reaudit-2026-08-10\14-spend-review-read-failure-1440.png`
   - `C:\dev\massage-on-demand-vn\output\marketing-analytics-post-remediation-reaudit-2026-08-10\15-breakdown-tables-1440.png`
   - `C:\dev\massage-on-demand-vn\output\marketing-analytics-post-remediation-reaudit-2026-08-10\16-coupon-performance-loaded-1440.png`
   - `C:\dev\massage-on-demand-vn\output\marketing-analytics-post-remediation-reaudit-2026-08-10\19-dark-theme-trend-1440.png`
3. 이전 성능·IA 기준
   - `C:\dev\massage-on-demand-vn\output\admin-full-performance-ia-audit-2026-08-08\admin-full-performance-ia-audit.md`
   - `C:\dev\massage-on-demand-vn\output\admin-full-performance-ia-audit-2026-08-08\codex-admin-performance-ia-implementation-prompt.md`
4. 저장소의 `AGENTS.md`와 하위 `AGENTS.md`가 있으면 작업 전 모두 확인하고 해당 범위의 지침을 따른다.

### 주요 코드 범위

- `apps/admin_web/app/marketing-analytics/page.tsx`
- `apps/admin_web/app/marketing-analytics/marketing-analytics-model.ts`
- `apps/admin_web/app/marketing-analytics/marketing-analytics-trend-chart.tsx`
- `apps/admin_web/app/marketing-analytics/actions.ts`
- `apps/admin_web/app/marketing-analytics/loading.tsx`
- 위 파일들의 `*.spec.ts` 및 `*.spec.tsx`
- `apps/admin_web/app/globals.css` 중 Marketing Analytics 전용 스타일
- `apps/admin_web/lib/admin-api.ts` 및 관련 공용 컴포넌트 — 필요한 범위만
- `apps/api/src/admin/admin-marketing-analytics.ts`
- `apps/api/src/admin/admin-analytics.routes.ts`
- `apps/api/src/admin/admin.service.ts`의 marketing analytics query 영역
- 관련 API 테스트

관련 호출부·타입·스키마·DB 모델도 반드시 추적하되, Marketing Analytics와 직접 관계없는 페이지를 리팩터링하지 마라.

## 작업 원칙

1. 먼저 보고서와 현재 코드를 비교해 각 P0~P3가 아직 재현되는지 확인한다.
2. 현재 worktree가 dirty일 수 있다. 사용자의 기존 변경을 보존하고, 관련 없는 파일을 되돌리거나 덮어쓰지 마라.
3. 화면만 고치지 말고 UI 문구, query predicate, API response 의미, test expectation이 같은 계약을 사용하게 한다.
4. 운영 데이터가 부족하다고 새로운 의미나 귀속 규칙을 추측하지 마라. 저장된 evidence로 증명할 수 없는 수치는 제공하지 않는다.
5. 기존 라우트, deep link, 권한 검사, 감사 로그, 캐시 무효화, 통화 단위, Vietnam time 기준을 보존한다.
6. 새로운 라이브러리는 꼭 필요하지 않으면 추가하지 말고 기존 디자인 시스템·컴포넌트·토큰을 우선 사용한다.
7. 실제 브라우저 검증에서는 광고비 저장이나 다른 운영 데이터 mutation을 실행하지 않는다. mutation 동작은 unit/integration test와 mock으로 검증한다.
8. 구현 중 필요한 정보는 코드·테스트·브라우저에서 먼저 확인한다. 안전하게 판단할 수 없는 제품 정책만 blocker로 보고한다.
9. 소스 수정 후 관련 테스트와 typecheck를 실행하고, 1440×900 실제 화면을 다시 캡처해 전후 차이를 검증한다.
10. 커밋·푸시·배포는 요청 범위가 아니다.

## P0 — 가장 먼저 해결할 데이터 신뢰성 문제

### P0-1. Region filter 계약 수정

현재 문제:

- 화면은 `Range, source, and region scope the headline customer cohort`라고 설명한다.
- 실제 attribution query는 `source`, `platform`, `campaignId`만 받는다.
- Region은 일부 manual spend와 location breakdown에만 적용된다.
- 이 상태에서 Region별 CPA·ROAS는 서로 다른 범위의 분자와 분모를 결합할 수 있다.

먼저 데이터 모델과 현재 저장 evidence를 조사해서 **고객 획득 시점의 Region을 결정적으로 귀속할 수 있는지** 판단한다.

#### 결정 규칙

- first touch 시점의 region evidence가 저장되어 있고 entrants → signup → booking → revenue와 spend 모두 같은 predicate로 제한할 수 있으면 진짜 region-scoped cohort를 구현한다.
- 그렇지 않으면 Region을 global headline filter에서 제거한다. Region은 `Spend & location breakdown scope`의 로컬 필터로 이동하고, headline KPI·comparison·Needs action·coupon에는 영향을 주지 않게 한다.
- 예약 후 저장된 주소나 최신 100개 주소를 신규 고객의 first-touch region으로 소급 추정하지 마라.
- 일부 수치만 Region 필터를 적용한 상태로 headline CPA·ROAS를 계산하지 마라.

UI 문구도 실제 계약에 맞춘다. 예:

- global cohort가 Range/Source만 지원한다면: `Range and source scope the acquisition cohort.`
- Region 로컬 섹션: `Region scopes recorded spend and location evidence only.`

#### 완료 기준

- Region이 global이면 모든 headline numerator와 denominator가 같은 Region cohort를 사용한다.
- Region이 local이면 global active summary와 headline 수치에서 완전히 분리된다.
- Region 변경 시 적용되는 섹션과 적용되지 않는 섹션을 테스트한다.
- HCMC 선택 전후 값이 같더라도 그것이 실제 데이터 결과인지, 필터 미적용인지 테스트가 구분한다.

### P0-2. Today의 previous-period window 수정

현재 `adminMarketingPreviousRangeWindow`는 Today의 이전 기간을 어제 같은 현지 시간대가 아니라 오늘 시작점 직전의 elapsed duration으로 계산한다.

수정 요구:

- Vietnam time에서 Today가 `오늘 00:00 → 현재 시각`이면 previous는 `어제 00:00 → 어제 동일 시각`이어야 한다.
- Yesterday는 그 전날의 전체 날짜와 비교한다.
- 7d/30d는 현재 계약을 확인하고 겹치지 않는 동일 길이 기간을 사용한다.
- label과 실제 시간창이 일치하게 한다.

회귀 테스트에 최소한 다음을 포함한다.

- 2026-06-22 12:00 ICT 기준 Today previous = 2026-06-21 00:00~12:00 ICT.
- 00:01, 12:00, 23:59 ICT 경계.
- UTC 값과 표시 label을 함께 assert.
- 현재 잘못된 기대값을 승인하는 테스트는 올바른 값으로 수정.

### P0-3. API unavailable과 실제 empty를 분리

현재 summary/coupon summary가 `adminGet`의 empty fallback을 사용해 API 장애를 실제 0처럼 보이게 한다.

수정 요구:

- 핵심 summary는 성공 여부를 보존하는 결과 타입을 사용한다. 기존 `adminGetResult` 또는 프로젝트의 표준 패턴을 재사용한다.
- UI 상태를 최소한 `available with data`, `available but empty`, `unavailable`로 구분한다.
- unavailable에서는 0 KPI, `No marketing evidence`, 정상 comparison/action을 렌더링하지 않는다.
- 대신 다음을 보여준다.
  - `Marketing data is temporarily unavailable`
  - 마지막 성공 시각이 있으면 표시
  - Retry 또는 새로고침 action
  - 필요한 경우 System Health 링크
- summary와 coupon summary가 각각 실패할 수 있으므로 전체 페이지를 불필요하게 함께 막지 않는다.

회귀 테스트:

- 500, 503, timeout → unavailable UI.
- 정상 `{0...}` 응답 → valid empty UI.
- summary 실패 + coupon 성공, summary 성공 + coupon 실패를 독립적으로 처리.

### P0-4. Coupon scope 분리

현재 coupon API는 Range만 사용하지만 Source/Platform/Region/Campaign 필터가 URL과 global 화면에 남아 적용되는 것처럼 보인다.

수정 요구:

- 쿠폰 섹션에 `Scope: selected range only`를 명확히 표시한다.
- coupon loader·pagination href에는 coupon이 지원하지 않는 global filter를 전달하지 않는다.
- global filter summary와 쿠폰 scope를 시각적으로 분리한다.
- 기존 coupon route/deep link는 깨지지 않게 normalization 또는 호환 처리를 한다.
- source/campaign별 coupon attribution은 현재 API와 evidence가 지원하지 않으면 새로 추측해서 만들지 않는다.

## P1 — 1440px 운영 레이아웃과 action 정합성

### P1-1. Attribution / Campaign operations grid 수정

현재 1440px에서 attribution 카드가 지나치게 좁고 diagnostics가 잘리며, 빈 Campaign efficiency 카드가 attribution 높이를 따라가 큰 공백을 만든다.

수정 요구:

- 1440 기준 operations grid를 `1fr / 1fr~1.2fr` 수준으로 조정한다.
- `align-items: start`를 사용하고 두 카드의 `min-height: 100%`를 제거한다.
- attribution diagnostic row가 카드 안에서 잘리거나 가로 overflow를 만들지 않게 한다.
- 빈 Campaign efficiency는 160~220px 정도의 compact empty state 또는 자연 높이로 표시한다.
- campaign 데이터가 많을 때 표가 카드 밖으로 새지 않는 것도 확인한다.

### P1-2. Needs action 밀도와 우선순위

- 1440px에서 최대 2열 또는 세로 priority list를 사용한다.
- 한 카드에 Priority, issue, why it matters, 핵심 값, evidence, next action을 유지한다.
- 최대 네 건을 보여주는 현재 정책은 유지할 수 있지만 4열 고정은 제거한다.
- cancellation rate가 25%를 넘으면 Top insights에만 묻지 말고 Needs action으로 승격하거나 실제 evidence destination으로 연결한다.

### P1-3. Breakdown 표를 실제로 읽을 수 있게 수정

현재 Campaign/Platform 표를 2열 카드 안에 넣어 첫 열과 설명이 한 글자씩 줄바꿈되고 수평 스크롤이 과도하다.

수정 요구:

- Source, Campaign, Platform, Region breakdown은 각자 전체 폭으로 쌓거나 tab/accordion으로 한 번에 하나만 표시한다.
- on-demand 로딩은 유지한다.
- 요약에 불필요한 열은 제거하고 상세 정보는 row detail 또는 evidence 링크로 이동한다.
- 내부 수평 스크롤이 필요한 경우 첫 식별 열은 sticky/min-width로 읽을 수 있게 한다.
- 빈 table도 오른쪽이 잘리지 않는 compact state를 사용한다.
- 하단 loader는 2열 grid의 한쪽 칸에 두지 말고 전체 폭을 차지하게 한다.

### P1-4. Region sample의 정직한 표시

`ADMIN_MARKETING_REGION_LIMIT = 100`을 사용한 결과를 전체 집계처럼 표시하지 마라.

- 가능하면 DB aggregate query로 정확한 전체 집계를 구현한다.
- 이번 범위에서 안전하게 구현할 수 없다면 제목·설명·응답 metadata에 sample임을 명시한다.
- 예: `Recent location evidence · up to 100 records per source`.
- sample 데이터는 headline budget decision이나 action threshold에 사용하지 않는다.

### P1-5. ROAS 이름·tone·action 값을 일치

- 상단 `ROAS`는 `Gross ROAS`로 바꾼다.
- campaign break-even 판단은 `Fee ROAS` 또는 `Fee return on spend`로 명시한다.
- `Fee ROAS 1.00x`가 break-even임을 근거와 함께 표시한다.
- n/a는 neutral, break-even 미달은 warning/danger, 기준 충족은 success로 tone을 계산한다.
- Below break-even action의 대표 값은 CPA가 아니라 실제 판단 기준인 Fee ROAS여야 한다.
- evidence 화면 또는 링크에서 Spend / Completed / Gross booking value / Platform fee revenue / Gross ROAS / Fee ROAS를 구분한다.

### P1-6. Add daily spend 결과 피드백

현재 잘못된 서버 입력은 무응답으로 return하고 POST 실패·충돌·성공 결과가 폼 안에 충분히 남지 않는다.

수정 요구:

- 프로젝트의 표준 server action result 패턴을 조사해서 재사용한다.
- 필드 오류를 해당 필드와 summary에 표시한다.
- reason 최소 길이 등 검증 규칙을 UI helper와 서버가 공유하거나 같은 의미로 유지한다.
- stale `expectedUpdatedAt` 충돌, 권한 거부, API unavailable, network error를 서로 구분한다.
- 성공 후 저장 값, 저장 시각, operator reason, Audit Log 링크를 확인할 수 있게 한다.
- `Current spend could not be loaded`일 때의 fail-closed 동작은 유지한다.
- placeholder는 `e.g. launch-hcm`, `e.g. Launch HCMC`, `e.g. 600000`처럼 예시임을 명확히 한다.

## P2 — 운영자 문구, 중복, 첫 화면 밀도

### 내부 용어 제거

다음을 제거하거나 운영 언어로 교체한다.

- `FCM-ready delivery layer`
- `ref-smoke, campaign id...`
- success tone의 `No live ad API`

권장 문구:

- Platform 설명: `First recorded app platform` 또는 불필요하면 제거.
- Campaign placeholder: `Search recent campaigns`.
- Spend source badge: neutral tone의 `Spend source: manual records`.

### Campaign filter 개선

- 최근 캠페인을 label + ID로 찾을 수 있는 searchable picker를 우선 제공한다.
- exact Campaign ID는 advanced input으로 유지할 수 있다.
- 현재 저장 데이터/API로 picker 후보를 제공할 수 없다면 위험한 새 endpoint를 즉흥적으로 추가하지 말고, 기존 campaign breakdown을 재사용할 수 있는지 먼저 확인한다.

### Active filter summary 정리

- Range와 실제 non-default filter만 보여준다.
- `Platform: All platforms`, `Region: All regions` 같은 기본값은 active filter로 반복하지 않는다.
- 각 non-default filter clear와 Clear all은 유지한다.
- Region을 local scope로 내렸다면 global summary에 포함하지 않는다.

### 첫 화면 압축

- Page header와 filter panel의 세로 공간을 줄여 1440×900 첫 화면에서 첫 Needs action의 제목·핵심 값·action이 충분히 보이게 한다.
- Region 옵션을 모두 큰 segmented link로 펼치지 말고, 필요하면 compact select/search 또는 local filter로 바꾼다.
- More filters를 전체 폭의 높은 빈 박스처럼 보이게 하지 않는다.

### KPI와 Funnel 중복 제거

- Funnel은 `Entrants → Signups → Address ready → First booking created → First booking completed`를 담당한다.
- KPI는 중복 단계 숫자 대신 `Ad spend / CPA completed / Gross ROAS / Fee ROAS / Platform fee revenue`를 우선한다.
- 모든 카드에 같은 `Last 7 days`를 반복하지 말고 섹션 scope badge 한 번으로 통일한다.
- comparison은 의사결정에 필요한 4~5개만 유지한다.

### Coupon 0-state 축약

- summary가 모두 0이면 다섯 개 큰 KPI 카드를 렌더링하지 않는다.
- `No coupon checkout activity in this range` compact state, 기간 변경 안내, Coupon operations 링크, on-demand detail action만 보여준다.
- 데이터가 있을 때만 KPI grid를 표시하고 1440에서 읽기 좋은 3+2 또는 auto-fit 구성을 사용한다.

### Metric scope & limitations

- 긴 문장을 pill처럼 보이게 하지 않는다.
- `Metric scope & limitations` disclosure 안에서 bullet로 제공한다.
- 최소한 다음을 정확히 설명한다.
  - acquisition first-touch 기준
  - manual spend source
  - Region 적용 범위 또는 귀속 규칙
  - unknown attribution
  - sample limit이 남아 있다면 그 제한

## P3 — 유지보수성과 성능

### 컴포넌트 분리

현재 `page.tsx`가 1,800줄 이상이다. 다음 단위로 책임을 분리하되 불필요한 추상화는 만들지 마라.

- filter panel
- data availability state
- needs action
- attribution/campaign operations
- acquisition funnel/outcome metrics
- comparison/trend
- coupon performance
- breakdown workspace
- spend editor/review/result

Server Component 경계를 유지하고 클라이언트 컴포넌트는 상호작용에 필요한 최소 범위로 제한한다.

### API service 분리

- `admin.service.ts` 전체를 대규모 리팩터링하지 않는다.
- Marketing Analytics의 window/cohort/query composition을 테스트 가능한 작은 함수 또는 전용 module로 옮길 수 있으면 해당 범위만 분리한다.
- controller/route public contract와 기존 DI 패턴을 유지한다.

### Threshold 정책

현재 attribution 80%, baseline 3, decline -25%, fee ROAS 1, spend growth 25%가 프론트 모델에 하드코딩돼 있다.

- 서버가 판단 근거를 소유하고 threshold metadata와 action을 응답하도록 만드는 방식을 우선 검토한다.
- 과도한 API 변경이 필요하면 최소한 한 공유 policy source로 통합하고 화면에 기준을 표시한다.
- 테스트가 threshold 변경과 action 결과를 함께 검증하게 한다.

### 차트와 테마

- `#ff9f43`, `#7367f0`, `#00bad1`, `#28c76f` 하드코딩을 semantic chart token으로 교체한다.
- light/dark 모두에서 선, legend, tooltip, focus/hover 상태를 확인한다.
- 현재 제공되는 chart `aria-label`과 screen-reader용 데이터 표는 유지한다.

### 성능

- 현재 breakdown/coupon on-demand 로딩은 유지한다.
- summary, coupon summary, optional breakdown의 독립 실패·로딩 경계를 만든다.
- Recharts dynamic import는 실제 bundle/interaction 측정에서 의미가 있을 때만 적용한다.
- 캐시 freshness와 mutation invalidation을 깨지 않는다.
- 근거 없이 virtualization이나 새 상태관리 라이브러리를 추가하지 않는다.

## 권장 최종 화면 순서

1. Header: 페이지 목적, Add spend, generated time, neutral data-source status.
2. Compact global filters: 신뢰 가능한 cohort filter만 표시.
3. Needs action: 최대 2열, evidence와 next action 포함.
4. Acquisition funnel.
5. Business outcome metrics: Spend, CPA, Gross ROAS, Fee ROAS, Fee revenue.
6. Previous-period comparison과 trend.
7. Coupon performance: range-only scope, empty면 compact state.
8. On-demand breakdown workspace: 전체 폭 또는 한 번에 한 dimension.
9. Metric scope & limitations disclosure.

## 테스트 요구사항

기존 테스트를 수정하는 데 그치지 말고 다음 회귀 테스트를 추가한다.

### Admin Web

- summary unavailable과 real empty 구분.
- coupon unavailable 독립 처리.
- global/local filter scope와 href.
- More filters active/open 상태.
- non-default filter만 summary에 표시.
- Gross/Fee ROAS label, value, tone.
- Below break-even action이 Fee ROAS를 표시.
- coupon all-zero compact state.
- spend form invalid/conflict/unavailable/success result.
- internal copy가 렌더링되지 않음.

### API

- Today previous window의 Vietnam-time 경계.
- Region이 global로 유지된다면 동일 cohort predicate를 모든 numerator/denominator에 적용.
- Region을 local로 내리면 summary contract에서 Region이 headline을 바꾸지 않음을 명시적으로 검증.
- sample aggregate metadata 또는 full aggregate 결과.
- threshold/action metadata가 서버로 이동했다면 각 경계값.
- 기존 route와 pagination 호환.

### 실행할 검증

저장소의 package scripts와 AGENTS.md를 확인해서 정확한 명령을 사용한다. 최소한 다음 범주를 통과시킨다.

1. Marketing Analytics Admin Web unit/component tests.
2. 관련 Admin API unit/service/controller tests.
3. Admin Web typecheck.
4. API typecheck.
5. 변경 파일 lint 또는 저장소 표준 lint.
6. 가능하면 관련 production build 또는 route build 검증.

테스트 실패를 기존 문제로 단정하지 말고 변경 전후와 관련성을 조사한다. 해결하지 못한 실패는 명령, 오류, 영향 범위를 정확히 보고한다.

## 브라우저 QA

로그인이 필요하면 기존 로그인 세션을 우선 사용한다. 다음 상태를 1440×900에서 실제로 확인하고 새 캡처를 만든다.

1. 기본 7 days 화면.
2. More filters 닫힘/열림.
3. Source 또는 Platform active filter.
4. Region이 최종 설계에서 적용되는 정확한 로컬/글로벌 상태.
5. Needs action 0건, 1건, 여러 건의 테스트 가능한 상태.
6. attribution diagnostics + empty campaign.
7. KPI/funnel/comparison/trend.
8. coupon all-zero와 데이터 있음 상태.
9. on-demand Source/Campaign/Platform/Region breakdown.
10. Add spend draft/review/read-failure UI. 실제 저장은 실행하지 않는다.
11. summary unavailable/coupon unavailable 상태는 fixture, mock 또는 component test로 검증하고 가능하면 안전한 로컬 상태로 캡처한다.
12. light/dark theme.

각 캡처에서 다음을 확인한다.

- 텍스트·badge·table column 잘림 없음.
- 불필요한 큰 빈 카드 없음.
- 첫 화면에서 Needs action이 실제로 보임.
- 데이터 범위 문구와 수치가 같은 계약을 사용함.
- 내부 개발 용어 없음.
- 버튼·링크·필터의 목적이 동사 또는 결과로 명확함.
- console error/warning과 failed request를 확인하고 관련 항목을 해결 또는 보고함.

## 완료 조건

다음 조건을 모두 만족하기 전에는 완료라고 보고하지 마라.

1. Region이 동일 cohort 전체를 필터링하거나 headline에서 안전하게 분리됨.
2. Today가 어제 동일 Vietnam local time 범위와 비교됨.
3. API 장애가 0건처럼 표시되지 않음.
4. Coupon의 range-only scope가 화면·URL·API에서 일치함.
5. 1440×900에서 operations grid와 모든 on-demand 표가 읽을 수 있음.
6. Gross ROAS, Fee ROAS, break-even action 값과 tone이 일치함.
7. Add spend의 오류·충돌·성공 피드백이 명시적임.
8. `FCM-ready delivery layer`, `ref-smoke`, success-tone `No live ad API`가 제거됨.
9. 관련 테스트/typecheck/lint가 통과함.
10. 실제 화면 재검수와 구현 보고서가 생성됨.

## 최종 산출물

다음 폴더를 만들고 결과를 정리한다.

`C:\dev\massage-on-demand-vn\output\marketing-analytics-remediation-implementation-2026-08-10\`

필수 산출물:

1. `marketing-analytics-remediation-implementation-report.md`
2. 1440×900 검증 스크린샷
3. 필요하면 별도의 before/after 성능 측정 파일

구현 보고서에는 다음을 포함한다.

- 최종 판정과 운영자 관점 변화.
- 보고서 P0~P3 각 항목의 `완료 / 부분 완료 / 미완료` 매핑.
- Region scope에 대해 실제로 선택한 설계와 그 근거.
- 변경한 파일과 역할.
- API/data contract 변화.
- 화면 구조와 문구 변화.
- 테스트·typecheck·lint/build 명령과 결과.
- warm/cold 또는 before/after 성능 수치가 있으면 측정 조건과 함께 표기.
- 남은 위험과 후속 작업.
- 새 스크린샷을 본문에 삽입.

최종 답변은 다음 순서로 간결하게 작성한다.

1. 무엇을 고쳤는지.
2. 가장 중요한 데이터 신뢰성 결정.
3. 테스트 결과.
4. 구현 보고서 링크.
5. 남은 blocker가 있다면 정확한 이유.

## 프롬프트 끝

