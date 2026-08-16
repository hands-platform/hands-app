# Codex 실행 프롬프트 — Marketing Analytics 데이터 신뢰성·운영 UX 최종 개선

아래 내용을 새 Codex 작업에 그대로 붙여 넣어 사용한다.

---

## 역할

너는 `C:\dev\massage-on-demand-vn` 프로젝트의 시니어 제품 엔지니어이자 마케팅 분석, 데이터 품질, 운영 관측성, 관리자 UX 전문가다.

이번 작업의 목적은 `/marketing-analytics`를 더 화려한 대시보드로 꾸미는 것이 아니다. 1인 운영자가 이 화면만 보고 다음 질문에 정확히 답하고 안전하게 행동할 수 있도록 데이터 계약, 캠페인 위험 판정, 수동 광고비 원장, 권한, API, 화면 정보 구조와 테스트를 함께 개선해야 한다.

1. 지금 중단하거나 검토해야 하는 캠페인은 무엇인가?
2. 광고비·유입·가입·첫 예약·완료·플랫폼 수수료 수익이 같은 cohort와 기간으로 비교되는가?
3. 성과가 좋아 보이는 것이 실제 성과인지, 광고비나 attribution 데이터가 빠져서 그렇게 보이는 것인지?
4. `No threshold breach`가 충분한 증거에 근거한 판단인가?
5. 수동 광고비가 어느 날짜·소스·플랫폼·지역·캠페인에 기록됐고 누락된 날짜는 없는가?
6. 비용을 수정할 때 기존 값, 변경 이유, 동시 수정, 감사 기록을 신뢰할 수 있는가?
7. Source·Platform·Campaign·Region·Coupon 필터가 화면의 어느 데이터에 적용되는가?
8. API 일부가 실패하거나 데이터가 불완전할 때 0건 또는 성공으로 오인되지 않는가?

시각적 밀도보다 **분석 결과의 진실성, 불충분한 증거의 정직한 표시, 손실 캠페인 누락 방지, 수동 비용 원장의 무결성, 실제 운영 행동 연결**을 우선한다.

## 작업 위치와 기준 문서

- 저장소: `C:\dev\massage-on-demand-vn`
- 대상 화면: `http://localhost:3101/marketing-analytics`
- 저장소 지침:
  - `C:\dev\massage-on-demand-vn\AGENTS.md`
- 기존 전체 운영 UX 보고서:
  - `C:\dev\massage-on-demand-vn\docs\admin-operations-ux-audit.md`
- 기존 개선 backlog:
  - `C:\dev\massage-on-demand-vn\docs\admin-ux-implementation-backlog.md`
- 기존 구현 진행 보고서:
  - `C:\dev\massage-on-demand-vn\docs\admin-ux-implementation-progress.md`
- 관련 IA 기준:
  - `C:\dev\massage-on-demand-vn\docs\admin-information-architecture-proposal.md`
- 기존 관리자 디자인 기준:
  - `C:\dev\massage-on-demand-vn\docs\architecture\admin-vuexy-design-system.md`

작업을 시작하면 위 문서와 현재 코드를 먼저 읽는다. 보고서와 이 프롬프트는 감사 시점의 근거다. 현재 코드에 이미 구현된 항목을 중복 구현하지 말고, 화면·API·테스트를 다시 확인한 뒤 필요한 차이만 수정한다.

로그인된 화면 재감사 캡처는 아직 완료되지 않았으므로, 구현 전 현재 화면을 1440px 이상에서 직접 확인하고 구현 후 같은 조건으로 다시 검증해야 한다. 코드를 읽은 것만으로 시각·상호작용 완료를 주장하지 않는다.

## 주요 대상 범위

실제 의존 관계와 호출자를 조사한 후 꼭 필요한 관련 파일만 추가한다.

### Admin Web

- `apps/admin_web/app/marketing-analytics/page.tsx`
- `apps/admin_web/app/marketing-analytics/marketing-analytics-model.ts`
- `apps/admin_web/app/marketing-analytics/marketing-analytics-trend-chart.tsx`
- `apps/admin_web/app/marketing-analytics/marketing-spend-action-form.tsx`
- `apps/admin_web/app/marketing-analytics/actions.ts`
- `apps/admin_web/app/marketing-analytics/loading.tsx`
- `apps/admin_web/app/marketing-analytics/**/*.spec.*`
- `apps/admin_web/lib/admin-api.ts`
- `apps/admin_web/lib/admin-navigation.ts`
- `apps/admin_web/lib/admin-operator-access-model.ts`
- `apps/admin_web/lib/admin-operator-permissions.ts`
- `apps/admin_web/app/globals.css`
- 기존 공용 drawer, table, pagination, notice, form, filter, status component

### API·데이터

- `apps/api/src/admin/admin-analytics.routes.ts`
- `apps/api/src/admin/admin-marketing-analytics.ts`
- `apps/api/src/admin/admin.service.ts`의 marketing 관련 메서드
- `apps/api/src/admin/admin.dto.ts`
- `apps/api/src/admin/admin-operator-category.guard.ts`
- 관련 API/controller/service 테스트
- `apps/api/prisma/schema.prisma`
- 필요한 경우 최소 additive migration과 read-only dry-run script
- 필요한 경우 `packages/shared-types`

`schema.prisma`, migrations, shared types, auth/permission은 `AGENTS.md`의 protected area다. 변경 시 해당 scope 검증과 full local verification 요구를 따른다. 공유·production DB에 migration을 적용하거나 데이터를 수정하지 않는다.

## 데스크톱 검증 기준

- **1440px 이상 데스크톱만 구현·검증한다.**
- 필수 viewport: `1440×1000`, `1600×1000`.
- 필요하면 `1920×1080`을 추가한다.
- 1024px 이하, 모바일, 태블릿, responsive reflow는 이번 작업에서 완전히 제외한다.
- 1024px 이하 문제를 구현 보고서, 잔여 이슈, 스크린샷 목록에 넣지 않는다.
- 기존 작은 화면 CSS를 고의로 훼손하지는 말되 이번 작업의 시간과 완료 기준으로 사용하지 않는다.

## 이미 개선된 부분 — 반드시 보존

현재 구현에는 이전 보고서의 핵심 방향이 상당 부분 반영되어 있다. 다음을 삭제하거나 약화하지 않는다.

1. 광고비 입력이 기본 분석 화면에 항상 노출되지 않고 `Add spend` 뒤에 격리되어 있다.
2. 광고비 변경 전에 정확한 기존 row를 읽고 Before → After와 delta를 보여준다.
3. `expectedUpdatedAt`으로 stale write를 409로 차단한다.
4. 광고비와 audit log가 Serializable transaction 안에서 함께 저장된다.
5. VND만 허용하고 change reason을 12–500자로 요구한다.
6. 저장 성공 후 값·날짜·사유와 Audit Log 진입점을 보여준다.
7. headline summary, coupon summary, coupon rows, dimension rows가 독립적으로 실패할 수 있다.
8. API 실패를 실제 0건과 구분하고 Retry를 제공한다.
9. 기본 화면은 summary만 로드하고 dimension/coupon rows는 on demand로 server paging한다.
10. attribution coverage와 unknown signup 원인·최근 대상 계정을 보여준다.
11. campaign efficiency에 CPA completed와 Fee ROAS를 함께 표시한다.
12. gross booking ROAS와 platform fee ROAS를 구분한다.
13. trend chart에는 screen-reader용 데이터 표가 있다.
14. source/platform/campaign과 region의 적용 범위 차이를 문구로 설명한다.
15. 기존 집중 테스트는 현재 기준 Admin Web 38개, marketing helper API 18개가 통과한다.

이번 작업은 위 성과를 유지하면서 남은 신뢰성·운영 효율 문제를 해결하는 **narrow refinement**다. 새로운 디자인 세계, 차트 라이브러리, analytics platform을 도입하지 않는다.

## 작업 안전 원칙

1. dirty worktree의 기존 변경은 사용자 작업이다. 관련 없는 변경을 되돌리거나 덮어쓰지 않는다.
2. `git reset --hard`, 광범위 checkout, 사용자 변경 삭제를 금지한다.
3. 브라우저 검수에서 실제 광고비 저장, coupon 변경, 고객 데이터 변경을 실행하지 않는다.
4. 광고비 write 흐름은 격리 test fixture 또는 service test에서 검증한다.
5. production/shared DB에 migration apply, duplicate merge, backfill, row delete/update를 실행하지 않는다.
6. Meta·Google·TikTok 광고 API를 새로 연결하지 않는다.
7. 실시간 MMP, SDK, attribution vendor를 추가하지 않는다.
8. 화면에서 경보를 없애기 위해 threshold를 임의로 완화하거나 데이터를 clamp하지 않는다.
9. API 오류를 빈 배열, 0 VND, 성공 배지로 숨기지 않는다.
10. CSS로 긴 화면이나 표 문제를 숨기지 않는다.
11. 현재 9개 미만 수준의 summary에 virtualization이나 복잡한 client state framework를 도입하지 않는다.
12. secret, 광고 계정 ID, 토큰, phone, exact location, raw device identifier를 새 API나 화면에 노출하지 않는다.

## 현재 코드에서 재확인된 핵심 위험

구현 전 최신 코드로 다시 확인한다. 감사 시점의 확인 사항은 다음과 같다.

### 1. Action count가 실제 전체 위험 수가 아니다

`buildMarketingActionPriorities()`는 최종적으로 `slice(0, 4)`를 반환한다. 화면의 `{actions.length} open`은 최대 네 개만 세므로 실제 문제가 7개여도 `4 open`으로 보일 수 있다. 설명에 “최대 네 개 표시”는 있지만 전체 open count와 hidden count가 없다.

### 2. 위험 캠페인을 top 5 성과 행에서만 찾는다

API `buildMarketingCampaignEfficiency()`는 `marketingRowSort`로 정렬한 뒤 기본 5개만 반환한다. 현재 정렬은 platform fee revenue, completed booking, signup 순이다. 프론트의 action priority는 이 top 5만 검사한다.

따라서 수익이 있는 캠페인 다섯 개 뒤에 **광고비는 크지만 완료 고객이 0인 캠페인**이 있으면 action queue에서 완전히 빠질 수 있다. 운영 위험 판정은 presentation top rows에서 만들면 안 된다.

### 3. `No threshold breach`가 충분한 증거 없이 성공처럼 보일 수 있다

`hasMarketingDecisionEvidence()`는 entrant, signup, ad spend 중 하나만 1 이상이어도 true다. 캠페인 ID가 없는 수동 광고비만 존재하고 고객 성과가 없어도 action이 비어 있으면 성공 tone의 `No threshold breach`가 될 수 있다.

“판정할 증거가 없음”, “일부 증거만 있음”, “신뢰 가능한 판단 가능”을 구분해야 한다.

### 4. 수동 광고비 completeness를 확인할 방법이 없다

현재 화면은 선택 기간의 manual spend 합계만 보여준다. 다음을 알 수 없다.

- 기간 중 며칠의 spend row가 존재하는가
- 마지막 광고비 입력일은 언제인가
- 어떤 source/campaign 날짜가 누락됐는가
- 광고비가 없는 것이 실제 0원인지 기록 누락인지
- attribution campaign과 spend campaign이 매칭되지 않는 row가 있는가

이 상태에서 CPA/ROAS를 성공·경고 색으로 표시하면 비용 누락 때문에 성과가 좋아 보일 수 있다.

### 5. campaign ID의 대소문자·정규화 계약이 일관되지 않다

- attribution SQL filter는 campaign ID를 case-insensitive로 비교한다.
- 일부 Prisma spend filter는 exact string을 사용한다.
- `MarketingSpendDaily` unique key는 원본 campaign string을 사용한다.
- efficiency merge는 lowercase key로 합친다.

`launch-hcm`과 `Launch-HCM`이 서로 다른 spend row로 저장되지만 분석에서는 한 캠페인처럼 합쳐질 수 있다. exact review와 filter에서는 다시 갈라질 수 있다.

### 6. Read와 spend mutation 권한이 분리되어 있지 않다

`/admin/marketing` 전체가 `GROWTH_MARKETING` 하나의 category 아래에 있다. Marketing Analytics를 볼 수 있는 운영자에게 spend upsert도 허용될 가능성이 있다. UI에서 Add spend를 숨기는 것만으로 해결하지 말고 API/service에서 별도 capability를 강제해야 한다.

### 7. 광고비 입력에 안전하지 않은 기본값과 경계가 남아 있다

- 새 spend draft는 조건에 따라 source `google`, platform `android`를 기본값으로 사용한다.
- 실제 source/platform을 모르는 운영자가 기본값을 그대로 저장할 수 있다.
- future date 차단 정책이 없다.
- Prisma Int 및 운영상 합리적인 최대 VND 경계가 UI/DTO에 명확하지 않다.
- 동일 값을 다시 저장해도 updatedAt과 audit가 새로 생길 수 있다.
- 성공 응답에 정확한 audit ID가 없다.

### 8. 필터 scope가 설명을 읽어야만 이해된다

상단 Source/Platform/Campaign은 headline acquisition cohort에 적용되지만 Coupon은 range만 사용하고 Region은 spend/location breakdown만 사용한다. 현재 설명은 비교적 정확하지만 페이지가 길어서 operator가 다른 섹션까지 같은 filter가 적용된다고 오인할 수 있다.

### 9. 핵심 metric limitation이 페이지 하단 disclosure에 있다

anonymous pre-signup opens 미수집, manual spend, region sample, first-touch source 같은 중요한 제한이 분석 결과 이후에 나온다. 운영자는 제한을 읽기 전에 ROAS와 action을 먼저 신뢰할 수 있다.

### 10. 페이지가 하나의 긴 보고서처럼 누적된다

기본 route에 Needs action, funnel, attribution diagnostics, campaign efficiency, outcome metrics, previous comparison, trend, coupon performance, region scope, breakdown loader, insights가 순서대로 쌓인다. 각각은 유용하지만 일상 의사결정·캠페인 조사·쿠폰 분석·광고비 입력이라는 서로 다른 작업이 한 긴 페이지에 섞여 있다.

## P0-A — Decision readiness를 명시적인 계약으로 만든다

단순 boolean `hasEvidence`를 제거하고 서버 또는 shared domain model에서 다음과 같은 명시적 상태를 반환한다.

```ts
type MarketingDecisionReadiness = {
  status: 'INSUFFICIENT' | 'PARTIAL' | 'READY' | 'STALE';
  reasons: Array<
    | 'NO_ACQUISITION_EVIDENCE'
    | 'NO_SPEND_EVIDENCE'
    | 'INCOMPLETE_SPEND_DAYS'
    | 'LOW_ATTRIBUTION_COVERAGE'
    | 'UNMATCHED_CAMPAIGN_SPEND'
    | 'UNMATCHED_CAMPAIGN_OUTCOMES'
    | 'STALE_AGGREGATE'
  >;
  attributionCoveragePercent: number | null;
  spendCoveragePercent: number | null;
  campaignJoinCoveragePercent: number | null;
  lastCompleteDate: string | null;
};
```

구체적인 이름은 현재 contract와 맞출 수 있지만 의미는 보존한다.

### 판정 원칙

1. Entrant, signup, spend 중 하나만 있다고 `READY`로 판정하지 않는다.
2. CPA/ROAS를 행동 기준으로 사용하려면 해당 scope에 spend와 outcome evidence가 함께 있어야 한다.
3. 캠페인 효율 판정에는 campaign ID가 연결된 spend와 outcome이 필요하다.
4. attribution coverage가 기준 미만이면 channel 비교는 `PARTIAL`이다.
5. spend 날짜 누락이 있으면 비용 효율 metric은 `PARTIAL` 또는 `STALE`이다.
6. 판단 준비가 안 됐으면 `No threshold breach`를 success tone으로 표시하지 않는다.
7. `READY`일 때만 `No configured threshold exceeded`를 중립 또는 성공으로 보여준다.
8. `READY`도 “광고비 증액 권장”을 의미하지 않는다. 단지 설정된 경보 조건이 감지되지 않았다는 뜻이다.

### 화면

Needs action 위 또는 같은 헤더에 작고 명확한 evidence status를 둔다.

```text
Decision evidence: Ready | Partial | Insufficient | Stale
Attribution coverage: N%
Spend days recorded: N / N
Campaign match: N%
Last complete date: YYYY-MM-DD
```

긴 data-gap 목록을 상단에 반복하지 말고 가장 중요한 blocker 1–3개와 `View metric scope` disclosure를 제공한다.

## P0-B — 전체 캠페인 universe에서 위험을 계산한다

운영 action을 presentation용 top 5 행에서 만들지 않는다.

### 서버 계약

다음 중 현재 코드에 가장 작은 해법을 선택한다.

1. 모든 캠페인을 DB aggregate한 뒤 risk summary와 paged rows를 별도로 반환한다.
2. risk 조건을 SQL/HAVING 또는 bounded aggregate query에서 직접 계산한다.
3. summary endpoint에 risk candidates와 exact total을 반환하고 campaign table은 별도 server paging한다.

금지:

- 전체 원본 고객/예약 row를 메모리에 로드해 위험을 계산
- 화면 top 5 결과를 action source로 재사용
- `slice(0, 4)` 이후 길이를 전체 open count로 사용

권장 응답:

```ts
type MarketingActionSummary = {
  totalCount: number;
  visibleCount: number;
  hiddenCount: number;
  items: MarketingActionItem[];
  generatedAt: string;
  thresholdVersion: string;
};
```

### action priority

최소 다음 signal을 전체 범위에서 평가한다.

1. spend > 0, completed customer = 0
2. Fee ROAS < 1.00x이고 decision evidence가 READY/PARTIAL인 캠페인
3. spend 급증 + completed cohort 감소/정체
4. cancellation rate 기준 초과
5. completed cohort의 유의미한 하락
6. attribution coverage 저하
7. spend coverage 누락 또는 stale
8. unmatched spend campaign

각 action에는 다음을 포함한다.

```text
Severity
Scope
Observed value
Threshold
Evidence readiness
Why it matters
Direct investigation link
```

threshold는 frontend에만 하드코딩하지 않는다. 서버 또는 shared policy에서 version과 함께 관리하고 UI는 적용된 규칙을 설명한다. 정책 편집 UI는 이번 범위에 추가하지 않는다.

## P0-C — Manual spend completeness와 reliability

수동 광고비 합계만 반환하지 말고 선택 scope의 기록 완전성을 함께 계산한다.

### 최소 aggregate

```ts
type MarketingSpendCoverage = {
  expectedDayCount: number;
  recordedDayCount: number;
  missingDates: string[];
  lastRecordedDate: string | null;
  latestUpdatedAt: string | null;
  totalSpendAmount: number | null;
  hasExplicitZeroRows: boolean;
  unmatchedCampaignRowCount: number;
  duplicateCanonicalCampaignCount: number;
  status: 'COMPLETE' | 'PARTIAL' | 'MISSING' | 'STALE';
};
```

### 의미 규칙

1. row가 없는 날을 자동으로 실제 0원으로 간주하지 않는다.
2. 실제 0원과 미입력을 구분하려면 explicit zero row 또는 운영 정책이 필요하다.
3. `MISSING/PARTIAL/STALE`이면 CPA, Gross ROAS, Fee ROAS에 neutral/warning reliability 표시를 붙인다.
4. 불완전한 광고비로 산출한 ROAS에 success green을 사용하지 않는다.
5. spend가 실제 0이고 명시적으로 확인됐다면 `No paid spend recorded`로 표현한다.
6. manual source임을 상단에 유지하고 last update와 담당자/원장 링크를 제공한다.
7. selected source/campaign에 expected daily cadence가 적용되지 않는 경우 무조건 N일 모두 입력을 강제하지 말고, 명시적인 tracking scope/policy를 사용한다.

### 운영 화면

`Campaigns & spend` view에 다음을 제공한다.

- `Spend coverage`
- `Missing dates`
- `Last entry`
- `Unmatched campaign rows`
- `Open spend ledger`
- `Add spend`

단순 KPI 카드를 여러 개 추가하지 말고 compact reliability strip 또는 table summary를 사용한다.

## P0-D — Campaign identity를 canonical하게 만든다

### 조사

1. Customer App marketing attribution metadata의 campaign ID 생성 지점을 검색한다.
2. Referral code, manual spend, URL filter, API query, SQL join, audit target의 campaign ID 의미를 정리한다.
3. 현재 DB를 read-only로 조회해 대소문자·공백·동일 이름 duplicate 후보를 집계한다.
4. 실제 데이터 값이나 고객 식별자를 보고서에 노출하지 않는다.

### 권장 계약

```text
campaignKey: canonical lowercase/trimmed identity
campaignId: external or operator-visible stable identifier
campaignName: display-only mutable label
```

구현 규칙:

1. write, read, filter, aggregate, exact review, audit target이 같은 canonicalization을 사용한다.
2. display name으로 identity를 결정하지 않는다.
3. 기존 compatibility가 필요하면 additive `campaignKey`를 도입한다.
4. schema 변경이 필요하면 migration과 duplicate dry-run을 만든다.
5. duplicate candidate는 자동 merge하지 않는다.
6. 공유/production DB에 backfill 또는 unique constraint 적용을 실행하지 않는다.
7. collision 발생 시 migration apply 전 operator decision manifest를 만든다.
8. canonical key가 같은 여러 row를 분석에서 조용히 합치면서 exact ledger에서는 따로 보이게 두지 않는다.
9. unmatched spend/outcome row를 별도 review 상태로 보여준다.

## P0-E — Spend write 권한과 API 불변식

Marketing Analytics read와 daily spend mutation을 분리한다.

### 권한

- 기존 permission manifest와 leaf category 체계를 먼저 조사한다.
- 가능하면 `GROWTH_MARKETING` read 아래에 최소 `GROWTH_MARKETING_SPEND` 또는 동등한 manage capability를 둔다.
- UI는 actor capability에 따라 `Add spend`를 숨기거나 disabled 처리하고 view-only 설명을 제공한다.
- API guard와 service 내부에서 write capability를 다시 검증한다.
- parent permission fallback 때문에 의도치 않게 모든 reader가 writer가 되지 않는지 테스트한다.
- Master/Admin의 기존 정책을 임의로 바꾸지 않는다.

### 입력 불변식

1. date는 정확한 Vietnam business date다.
2. future actual-spend date는 거부한다. 계획 예산 기능이 필요하면 별도 개념이며 이번 범위에 섞지 않는다.
3. amount는 정수 VND이며 DB Int와 운영 정책을 만족하는 명시적 max를 둔다.
4. source와 platform은 unsafe default를 사용하지 않는다.
5. 값이 불명확하면 `Unknown/Unallocated`를 operator가 명시적으로 선택하게 하고 Google/Android로 추정하지 않는다.
6. campaign 전체 비용이면 `All campaigns` scope를 명시적으로 확인한다.
7. current filters에서 값을 prefill할 수는 있지만 review에 source와 scope가 눈에 띄어야 한다.
8. unsupported source/platform/region/campaign은 structured 400으로 거부한다.
9. 동일 값 no-op은 새 audit row와 updatedAt을 만들지 않거나 명확한 no-change receipt를 반환한다.
10. double submit/retry가 중복 audit를 만들지 않도록 idempotency 또는 stable no-op 정책을 둔다.
11. stale expectedUpdatedAt은 409와 최신 current value/diff를 반환한다.
12. transaction 안에서 spend와 audit를 함께 처리한다.
13. audit metadata는 필요한 필드만 whitelist하고 actor, before, after, reason, canonical target, request/correlation ID를 기록한다.
14. 성공 응답은 audit ID를 반환한다.

권장 stable error code:

```text
MARKETING_SPEND_PERMISSION_REQUIRED
MARKETING_SPEND_DATE_INVALID
MARKETING_SPEND_FUTURE_DATE
MARKETING_SPEND_AMOUNT_INVALID
MARKETING_SPEND_SCOPE_INVALID
MARKETING_SPEND_CAMPAIGN_AMBIGUOUS
MARKETING_SPEND_VERSION_CONFLICT
MARKETING_SPEND_REASON_REQUIRED
MARKETING_SPEND_NO_CHANGE
MARKETING_SPEND_UNAVAILABLE
```

## P1-A — 한 route 안에서 작업 목적을 분리한다

새 사이드바 page를 늘리지 말고 `/marketing-analytics` 하나에 내부 view를 둔다.

권장 view:

```text
Overview
Campaigns & spend
Attribution quality
Coupons
```

URL 예시:

```text
/marketing-analytics?view=overview&range=7d
/marketing-analytics?view=campaigns&range=7d
/marketing-analytics?view=attribution&range=7d
/marketing-analytics?view=coupons&range=7d
```

현재 route·filter 링크와 deep link를 보존하면서 query를 정규화한다.

### Overview — 기본

1. Decision evidence status
2. Marketing needs action
3. 핵심 funnel/outcome metric
4. Previous-period comparison
5. Trend
6. 가장 중요한 data limitation

기본 화면에 attribution 계정 상세, coupon code table, 네 개 dimension table을 모두 쌓지 않는다.

### Campaigns & spend

1. Spend completeness/reliability
2. Campaign risk summary
3. server-paged campaign efficiency table
4. spend ledger
5. Add/Edit spend review drawer 또는 기존 bounded panel

### Attribution quality

1. signup/entrant source coverage
2. unknown reason grouping
3. recent affected customer links
4. source/platform breakdown
5. client/app version diagnosis

### Coupons

1. range-only scope를 명확히 표시
2. coupon outcome summary
3. server-paged code rows
4. Coupon operations / Coupon finance 연결

## P1-B — Filter scope를 시각적으로 명확히 한다

현재 모든 filter가 모든 section에 적용되는 것처럼 보이지 않게 한다.

### 공통 filter

```text
Range
Source
Platform
Campaign
```

적용 대상:

- Overview acquisition cohort
- Campaigns
- Attribution quality

### 별도 scope

- Coupon: Range only
- Region: spend/location evidence only

규칙:

1. view 전환 시 해당 view에 유효한 filter만 유지한다.
2. 무효 filter를 조용히 적용된 것처럼 보이지 않는다.
3. Coupon으로 이동해 source/platform이 무시되면 `Coupon metrics use range only`를 header scope badge에 표시한다.
4. Region은 global filter row에 두지 않고 Campaigns & spend의 breakdown scope에 둔다.
5. active filter summary에는 실제 적용되는 filter만 표시한다.
6. invalid query는 안정적인 기본값으로 복구하고 화면을 비우지 않는다.
7. campaign ID free-text는 가능하면 최근 known campaign suggestion을 제공하되 대규모 autocomplete framework는 추가하지 않는다.

## P1-C — Spend ledger를 만든다

현재 exact row preview만 있고 운영자가 기존 비용 row를 탐색하는 원장이 없다.

`Campaigns & spend` view에 server-paged daily spend ledger를 제공한다.

권장 열:

```text
Spend date
Source
Platform
Region
Campaign
Amount
Coverage state
Last updated
Updated by
Action
```

필터:

```text
Date/range
Source
Platform
Region
Campaign
Coverage issue: All / Missing / Unmatched / Duplicate candidate
```

규칙:

1. 기본 25, 최대 50 server paging.
2. exact total과 current range를 표시한다.
3. ledger row에서 `Review/Edit`를 열면 current value를 다시 읽는다.
4. list row에 editable input을 직접 반복하지 않는다.
5. row history 또는 exact Audit Log link를 제공한다.
6. audit link는 generic action 검색뿐 아니라 canonical target 또는 audit ID를 유지한다.
7. 실제 delete를 추가하지 않는다. 잘못된 spend를 0으로 correction하는 정책이 맞는지 조사하고 명확히 문서화한다.
8. bulk import는 실제 운영 수요가 없으면 추가하지 않는다.

## P1-D — Campaign table과 action 조사 흐름

Campaign table은 top 5 장식 카드가 아니라 server-paged investigation table로 확장한다.

권장 열:

```text
Campaign
Evidence state
Spend
Completed new customers
CPA completed
Gross ROAS
Fee ROAS
Attribution coverage
Decision
Action
```

기본 sort:

1. Needs action severity
2. Spend at risk
3. Below break-even
4. Unknown/partial evidence
5. Healthy evidence

operator가 선택할 수 있는 sort:

```text
Highest risk
Highest spend
Lowest Fee ROAS
Most completed customers
Recent activity
```

행을 열면 drawer 또는 bounded detail에서 다음을 보여준다.

- selected range와 cohort 정의
- spend coverage/missing dates
- source/platform/region scope
- funnel outcome
- previous comparison
- unmatched evidence
- direct spend ledger link
- 관련 coupon/referral evidence link가 실제로 있을 때만 표시

결정을 자동 집행하거나 광고를 중단하는 기능은 만들지 않는다.

## P1-E — 문구와 metric contract

### `firstOpens` 의미 정리

현재 backend의 `firstOpens`는 anonymous install first-open이 아니다. authenticated app-open evidence와 new signup을 결합한 `Tracked customer entry`다.

1. 화면에서 `Platform first opens`, `first opens` 같은 표현을 제거한다.
2. `Tracked entrants` 또는 데이터 사전에 정의한 한 가지 용어를 사용한다.
3. API contract를 바꾸면 기존 소비자를 검색한다.
4. compatibility가 필요하면 additive `trackedEntrants`를 추가하고 `firstOpens`는 deprecated로 둔다.
5. anonymous pre-signup opens가 수집되지 않는다는 제한을 decision evidence 근처에 표시한다.
6. 실제 raw count를 단지 100% funnel을 만들기 위해 조용히 줄이지 않는다.
7. 각 funnel stage가 동일 signup cohort의 subset인지 query와 test로 증명한다.

### 운영 문구

| 현재/위험 표현 | 권장 표현 |
|---|---|
| No threshold breach | No configured threshold exceeded 또는 Evidence incomplete |
| No marketing action triggered | No action signal detected; evidence status를 함께 표시 |
| Platform first opens | Platform of tracked entrants |
| Spend source: manual records | Manual spend ledger · coverage N/N days |
| Fee positive | Above fee break-even |
| Tracked only | Outcome tracked · spend not recorded |
| Channel | Platform으로 통일 |
| n/a | Not calculable — missing spend/outcome evidence |

`ROAS`, `CPA`, `MMP`, `first-touch` 같은 용어에는 짧은 설명 또는 metric scope가 있어야 한다. 같은 설명을 모든 카드에 반복하지 않는다.

## P1-F — 오류·conflict·receipt

다음 상태를 구분한다.

```text
Loading
Loaded
Actual empty
Insufficient evidence
Partial evidence
Stale data
401 session expired
403 read permission denied
403 spend write permission denied
409 version conflict
422/400 field validation
429 rate limited
5xx summary unavailable
Partial section failure
Save success
No change
```

### Spend form hardening

1. server field error를 해당 input/textarea와 `aria-describedby`로 연결한다.
2. 오류 summary에서 field로 이동할 수 있게 한다.
3. 첫 오류로 focus를 이동한다.
4. 실패 후 입력·reason을 보존한다.
5. conflict에서는 최신 current value, operator draft, delta를 다시 보여주고 재검토하게 한다.
6. 자동으로 stale draft를 덮어쓰지 않는다.
7. pending 중 submit을 막고 server에서도 중복을 방어한다.
8. 성공 receipt에 canonical target, saved amount/date/scope, actor, timestamp, reason, audit ID를 제공한다.
9. 401을 403 문구로 합치지 않는다.
10. 성공 query parameter만으로 receipt를 위조하지 않는다.

## P1-G — 접근성·시각·1440px 품질

1. 1440×1000 첫 화면에서 page title, active scope, decision evidence, needs action, 핵심 metric 일부가 보이게 한다.
2. 긴 세로 보고서 구조를 view로 분리해 작업 위치를 잃지 않게 한다.
3. 페이지 문서 하나만 세로 스크롤한다.
4. wide table은 가로 스크롤을 허용하되 첫 열 sticky와 header 의미를 유지한다.
5. 카드 내부 고정 높이 + vertical scroll을 만들지 않는다.
6. status는 색상만으로 전달하지 않는다.
7. view tabs, filters, disclosure, table sort, pagination, spend drawer를 keyboard로 사용할 수 있게 한다.
8. drawer/dialog를 사용하면 focus trap, Escape, trigger focus return, unsaved-change guard를 제공한다.
9. chart에는 현재 sr-only table을 유지하고 짧은 text summary를 추가한다.
10. loading/save/refresh 결과는 live region으로 전달한다.
11. long campaign ID/name, CJK, Vietnamese accents, large VND, empty name, unknown platform을 테스트한다.
12. 라이트·다크 테마에서 muted text와 chart legend 가독성을 확인한다.
13. 200% zoom과 Windows high contrast는 가능하면 확인하되 1024px 이하 responsive 보고로 변질시키지 않는다.

## P2-A — API·성능 구조

현재 summary-only default와 on-demand pagination을 유지한다.

권장 endpoint 책임 예시:

```text
GET  /admin/marketing/summary
GET  /admin/marketing/actions/summary
GET  /admin/marketing/campaigns
GET  /admin/marketing/spend-coverage
GET  /admin/marketing/spend-daily
GET  /admin/marketing/spend-daily/:id 또는 canonical target query
POST /admin/marketing/spend-daily
GET  /admin/marketing/coupons/summary
GET  /admin/marketing/coupons
GET  /admin/marketing/dimensions/:dimension
```

route 이름은 기존 ownership과 compatibility에 맞게 조정한다.

원칙:

1. default Overview는 summary, readiness, action summary만 로드한다.
2. campaign rows, spend ledger, coupon rows, diagnostics는 해당 view에서만 로드한다.
3. exact total은 `COUNT(*) OVER()` 또는 bounded count query로 제공한다.
4. action summary는 전체 campaign aggregate를 평가하지만 raw row hydration을 하지 않는다.
5. 같은 CTE/query를 과도하게 반복하면 측정 후 최소 범위에서 통합한다.
6. 무거운 raw SQL에는 실제 query plan 또는 API timing 근거 없이 index를 추가하지 않는다.
7. 현재 checkpoint 기준 Marketing Analytics 약 77ms / 170KB가 문서화되어 있으나 최신 값을 다시 측정한다.
8. API budget 인증 실패를 성능 통과로 기록하지 않는다.
9. cache/revalidate는 spend mutation 이후 관련 summary/action/ledger tag를 정확히 무효화한다.
10. partial endpoint failure가 전체 page를 막지 않게 한다.

## P2-B — 테스트 신뢰도 개선

현재 테스트의 shared component/source string 검증을 모두 삭제하지는 말되, 상태 의미와 데이터 무결성을 보호하는 행동 테스트를 우선한다.

특히 다음을 보완한다.

- `No threshold breach`가 insufficient evidence에서 success로 보이지 않는 테스트
- action totalCount가 visible 4개보다 클 수 있는 테스트
- 위험 캠페인이 presentation top 5 밖이어도 action에 포함되는 테스트
- case-variant campaign ID의 일관된 filter/review/aggregate 테스트
- spend coverage missing day와 explicit zero 구분 테스트
- read-only operator가 spend mutation을 할 수 없는 테스트
- future date, max VND, no-op, double submit, audit ID 테스트
- conflict 후 draft 보존과 current value 재검토 테스트

## 필수 테스트

### Admin Web

1. 기본 Overview는 heavy campaign/coupon/dimension rows를 요청하지 않는다.
2. 각 view는 필요한 endpoint만 요청한다.
3. view와 filter query가 안정적으로 round-trip한다.
4. Coupon view는 range-only scope를 명시하고 source/platform 적용을 가장하지 않는다.
5. Region은 spend/location scope에만 표시된다.
6. readiness `INSUFFICIENT/PARTIAL/READY/STALE`이 서로 다른 문구와 tone을 사용한다.
7. insufficient evidence에서 success `No threshold breach`가 나오지 않는다.
8. total action count와 visible/hidden count가 정확하다.
9. campaign table risk sort와 server paging이 정확하다.
10. spend ledger total/current range/paging이 정확하다.
11. Add spend는 manage capability가 있을 때만 보인다.
12. view-only 사용자는 분석을 볼 수 있지만 save form을 사용할 수 없다.
13. unsafe source/platform default가 없다.
14. future date, invalid amount, reason 11/12/500/501자가 정확히 처리된다.
15. 401, 403, 409, 429, 500가 구분된다.
16. field error가 input과 연결되고 입력이 보존된다.
17. conflict에서 latest/draft diff가 보인다.
18. success receipt에 audit ID와 exact target link가 있다.
19. long/CJK/Vietnamese campaign copy가 layout을 깨지 않는다.
20. trend chart의 accessible table과 summary가 유지된다.

### API/helper/service

1. risk actions는 전체 campaign aggregate에서 계산된다.
2. top 5 presentation limit가 risk candidate를 제거하지 않는다.
3. action totalCount와 visible items가 독립적이다.
4. readiness는 spend/outcome/attribution completeness를 반영한다.
5. missing spend row와 explicit zero row가 구분된다.
6. spend coverage의 expected/recorded/missing date가 Vietnam date 기준으로 정확하다.
7. current/previous range가 같은 business window 의미를 가진다.
8. campaign canonicalization이 write/read/filter/join/audit에 동일하다.
9. case duplicate candidate가 dry-run에서 검출된다.
10. unmatched spend/outcome row count가 정확하다.
11. read permission과 manage-spend permission이 분리된다.
12. service 내부 write authorization을 우회할 수 없다.
13. future spend date가 거부된다.
14. amount 0, max, max+1, decimal, unsafe integer가 정확히 처리된다.
15. 동일 값 no-op이 duplicate audit를 만들지 않는다.
16. idempotent retry가 duplicate audit를 만들지 않는다.
17. stale expectedUpdatedAt은 write 전에 409다.
18. spend와 audit는 transaction 안에서 함께 commit/rollback된다.
19. audit metadata에 허용된 필드와 reason/audit target만 있다.
20. summary·actions·ledger cache invalidation이 저장 후 일치한다.
21. smoke/test 계정과 synthetic attribution이 production aggregate에 섞이지 않는다.
22. anonymous pre-signup open을 실제 first open으로 주장하지 않는다.
23. coupon summary와 rows는 source/platform filter를 잘못 적용하지 않는다.

### 동시성·데이터 경계

1. 같은 spend row를 두 운영자가 동시에 수정
2. 같은 idempotency key 재시도
3. case-variant campaign row 동시 생성
4. 0, 1, 4, 5, 6, 25, 26, 1000+ 캠페인
5. action 0, 1, 4, 5, 100+
6. spend 날짜 0일, 일부, 전체, explicit zero
7. attribution coverage 0%, 79.99%, 80%, 100%
8. no spend, no outcome, spend-only, outcome-only, both
9. 긴 campaign ID/name, accents, CJK, emoji

## 검증 명령

실제 package script와 파일 존재 여부를 먼저 확인한 뒤 다음과 동등한 검증을 실행한다.

### 기존 baseline과 집중 테스트

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- app/marketing-analytics
npm.cmd run test --workspace @massage-vn/api -- src/admin/admin-marketing-analytics.spec.ts
```

관련 service/route/guard를 수정했다면 marketing 관련 service와 controller test도 실행한다.

```powershell
npm.cmd run test --workspace @massage-vn/api -- src/admin/admin.controller.spec.ts src/admin/admin-operator-category.guard.spec.ts src/admin/admin-route-domain.spec.ts
```

`admin.service.spec.ts`는 매우 크므로 현재 Vitest의 name filter 또는 관련 파일 전략을 확인해 marketing case를 실제로 실행한다. 단순히 파일을 지정하고 관련 테스트가 skip된 상태를 통과로 기록하지 않는다.

### 정적·범위 검증

```powershell
npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run typecheck --workspace @massage-vn/api
npm.cmd run admin:visible-copy
npm.cmd run admin:api-budget
npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api
```

schema/migration/shared types/permission manifest를 변경했다면:

```powershell
npm.cmd run prisma:migrations:check
npm.cmd run verify:local
```

명령이 환경·인증 문제로 실패하면 실패 사실, 원인, 재현 명령을 보고한다. 실행하지 않은 검증을 통과로 기록하지 않는다.

UI 변경 후 Impeccable detector를 변경 UI 파일에 한 번 실행한다.

```powershell
node C:\Users\laboy\.codex\skills\impeccable\scripts\detect.mjs --json <changed-ui-targets>
```

검출 결과를 실제 결함 기준으로 한 번의 bounded 수정 pass에서 해결하고 최종 확인한다. 무제한 미세 조정을 반복하지 않는다.

## 브라우저 QA와 증거

인증된 in-app browser를 사용한다. 로그인 세션이 없으면 사용자에게 로그인만 요청하고 계속한다.

실제 광고비 저장은 하지 않는다. 저장 성공은 test fixture 또는 격리 환경에서 검증한다. production/shared data에 가짜 비용 row를 만들지 않는다.

검증 viewport:

```text
1440x1000 필수
1600x1000 필수
1024px 이하 제외
```

캡처할 상태:

```text
01-overview-ready-1440x1000.png
02-overview-partial-evidence.png
03-needs-action-hidden-count.png
04-campaign-risk-table.png
05-campaign-detail-evidence.png
06-spend-coverage-missing-dates.png
07-spend-ledger.png
08-add-spend-review.png
09-spend-version-conflict.png
10-read-only-spend-permission.png
11-attribution-quality.png
12-coupon-range-only-scope.png
13-summary-api-unavailable.png
14-partial-section-failure.png
15-keyboard-dark-mode-1600x1000.png
```

안전하게 재현할 수 없는 오류·권한·conflict 상태는 production에서 만들지 말고 fixture/mockable loader/test environment를 사용한다. 재현하지 못하면 가짜 캡처를 만들지 말고 blocker로 보고한다.

증거 저장 위치:

```text
docs/audits/marketing-analytics-remediation-evidence-2026-08-12/
```

## 권장 실행 순서

### Phase 0 — 진실 확인

1. `AGENTS.md`, 기존 보고서, progress 문서를 읽는다.
2. dirty worktree와 marketing 관련 diff를 확인한다.
3. 현재 로그인 화면을 1440×1000에서 캡처하고 전체 길이·필터·Add spend·lazy rows를 확인한다.
4. MarketingSpendDaily와 campaign metadata를 read-only로 진단한다.
5. summary/action/campaign/spend/coupon 호출자와 permission을 inventory한다.
6. 기존 Admin 38개, helper API 18개를 baseline으로 실행한다.

### Phase 1 — P0 데이터 신뢰성

1. Decision readiness contract
2. 전체 campaign universe 기반 action summary
3. exact total/hidden action count
4. Spend completeness/reliability
5. Campaign canonical identity
6. Read/manage-spend 권한 분리
7. Spend write invariants, audit ID, no-op/idempotency
8. 핵심 의미 테스트

### Phase 2 — P1 운영 UX

1. Overview/Campaigns & spend/Attribution/Coupons view
2. 실제 적용 범위에 맞춘 filters
3. Campaign risk table와 detail
4. Spend ledger와 bounded review flow
5. evidence/metric scope를 상단에 노출
6. 오류/conflict/receipt/accessibility hardening
7. 1440px layout 정리

### Phase 3 — 성능·migration·최종 QA

1. API budget과 query plan
2. duplicate dry-run과 migration 검증
3. focused tests/typecheck/scope/full verification
4. Impeccable detector 한 번
5. 1440/1600 브라우저 캡처
6. 구현 보고서

P0가 남은 상태에서 탭과 카드만 정리하고 전체 완료로 보고하지 않는다. 반대로 backend action 계산만 수정하고 긴 화면·filter scope·spend ledger 문제를 그대로 두지 않는다.

## 완료 산출물

구현과 함께 다음을 만든다.

```text
docs/audits/marketing-analytics-remediation-report-2026-08-12.md
docs/audits/marketing-analytics-remediation-evidence-2026-08-12/
```

구현 보고서에 포함할 내용:

1. 변경 전 root cause와 변경 후 상태 계약
2. Decision readiness 판정표
3. Action 전체 수·표시 수·hidden 수
4. Spend completeness 계산 기준
5. Campaign canonicalization과 duplicate dry-run
6. Read/manage-spend permission 계약
7. Spend transaction/audit/idempotency
8. 변경 파일과 목적
9. schema/migration과 apply 미실행 사실
10. 테스트 명령과 실제 pass/fail/skipped
11. API timing/payload/query budget
12. 1440/1600 화면 증거
13. 실행하지 않은 production mutation
14. 남은 위험과 Release ready/hold 판정
15. 다음에 할 가장 중요한 한 가지

## 최종 인수 체크리스트

### 데이터·판정

```text
[ ] insufficient/partial/ready/stale evidence가 구분된다.
[ ] insufficient evidence가 success 상태로 보이지 않는다.
[ ] risk action이 top 5 campaign 밖의 손실 캠페인도 찾는다.
[ ] total open과 visible/hidden count가 정확하다.
[ ] action threshold와 version이 추적 가능하다.
[ ] spend missing date와 explicit zero가 구분된다.
[ ] incomplete spend에서 CPA/ROAS가 확정적 성공으로 보이지 않는다.
[ ] campaign identity가 write/read/filter/join/audit에서 동일하다.
[ ] unmatched와 duplicate candidate가 관측 가능하다.
[ ] Tracked entrants를 실제 anonymous first opens로 주장하지 않는다.
```

### 광고비 원장·권한

```text
[ ] Marketing read와 spend manage 권한이 분리된다.
[ ] API/service가 manage capability를 강제한다.
[ ] unsafe Google/Android 기본 저장이 없다.
[ ] future date와 amount max가 차단된다.
[ ] exact current value와 Before/After가 유지된다.
[ ] stale conflict에서 draft를 덮어쓰지 않는다.
[ ] no-op/retry가 duplicate audit를 만들지 않는다.
[ ] spend와 audit가 원자적으로 commit/rollback된다.
[ ] 성공 receipt에 audit ID와 exact target이 있다.
[ ] paged spend ledger에서 기존 row를 찾고 검토할 수 있다.
```

### 운영 UX

```text
[ ] Overview/Campaigns & spend/Attribution/Coupons가 한 route 안에서 분리된다.
[ ] 각 filter의 실제 적용 scope가 명확하다.
[ ] 기본 화면에서 decision evidence와 needs action을 먼저 본다.
[ ] critical metric limitation이 페이지 하단에만 숨지 않는다.
[ ] campaign risk를 severity 기준으로 조사할 수 있다.
[ ] empty/error/partial/stale가 구분된다.
[ ] 401/403/409/429/500 문구와 recovery가 다르다.
[ ] field error와 focus/input preservation이 동작한다.
[ ] chart accessible table이 유지된다.
[ ] 1440px에서 문서 세로 스크롤이 하나다.
[ ] keyboard와 dark mode 검증이 완료됐다.
```

### 안전·검증

```text
[ ] 실제 광고비·coupon·고객 데이터를 브라우저 QA에서 변경하지 않았다.
[ ] production/shared DB migration과 backfill을 적용하지 않았다.
[ ] secret·ad identifier·exact location이 노출되지 않는다.
[ ] 기존 사용자 dirty changes를 보존했다.
[ ] Admin/API focused tests가 통과했다.
[ ] Admin/API typecheck와 scope verification이 통과했다.
[ ] protected area 변경 시 migration check와 verify:local을 수행했다.
[ ] Impeccable detector를 한 번 실행했다.
[ ] 1440×1000과 1600×1000 증거를 저장했다.
[ ] 1024px 이하 항목을 검사·보고하지 않았다.
```

P0가 하나라도 남으면 `Release hold`와 정확한 blocker를 보고한다.

## 중단 조건

다음 경우에만 상태와 증거를 정리해 사용자 확인을 요청한다.

- 공유·production DB에 campaign duplicate merge/backfill/migration apply가 필요할 때
- 실제 광고비 row mutation이 필요할 때
- permission migration이 기존 운영자의 접근을 실질적으로 바꾸며 정책 소유자 결정이 필요할 때
- authoritative campaign identity 규칙이 Customer App/Referral/manual spend 사이에서 충돌할 때
- 기존 dirty change와 같은 코드에서 사용자 의도를 보존할 수 없는 충돌이 있을 때

그 외에는 합리적인 가정을 구현 보고서에 기록하고 P0부터 계속 진행한다.

## 최종 응답 형식

결과부터 간결하게 보고한다.

```text
Verdict: Release ready | Release hold
P0 remaining: 0 | N

Outcome
- 데이터 신뢰성과 운영 흐름 개선 요약

Changed files
- 파일과 목적

Verification
- 명령: PASS/FAIL/SKIPPED
- Admin/API test count
- 1440px/1600px 증거

Protected areas / migrations
- 변경 여부
- created/not applied | applied with approval | none

Data mutations
- none 또는 명시 목록

Remaining risks
- 출시 차단/비차단 구분

Next action
- 가장 중요한 한 가지
```

실제로 완료하지 않은 항목은 완료라고 쓰지 않는다. 실행하지 않은 검증은 통과로 기록하지 않는다.

## Codex 최종 실행 지시

지금 바로 구현을 시작하라. 새 분석 보고서나 또 다른 프롬프트만 작성하고 멈추지 않는다.

- 현재 로그인 화면과 코드를 다시 확인한다.
- 계획을 만들고 P0 데이터 판정부터 실제 코드를 수정한다.
- 기존 사용자 변경과 이미 완료된 개선을 보존한다.
- 위험 캠페인을 top 5 presentation row에서 찾지 않는다.
- 충분한 증거가 없으면 성공 상태를 만들지 않는다.
- 광고비 누락과 실제 0원을 구분한다.
- read와 spend write 권한을 서버까지 분리한다.
- 필요한 테스트를 작성하고 실제로 실행한다.
- 1440px와 1600px 화면을 캡처해 검증한다.
- production mutation과 migration apply만 보류하고 나머지는 끝까지 완료한다.

최종 목표는 더 많은 차트가 아니라, 운영자가 **데이터가 충분한지 먼저 확인하고, 실제 손실 캠페인을 빠짐없이 찾고, 수동 광고비를 안전하게 관리한 뒤 다음 행동을 선택할 수 있는 신뢰 가능한 Marketing Analytics 작업공간**이다.
