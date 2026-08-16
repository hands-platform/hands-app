# HANDS Admin Customer Usage 최종 보완 구현 프롬프트

아래 전체 내용을 새 Codex 작업에 그대로 전달한다. 이 문서는 재분석이나 조언만 요청하는 프롬프트가 아니다. 2026-08-12 최종 재감사에서 확인된 문제를 실제 코드, 데이터 계약, 테스트, 운영 문구와 브라우저 화면까지 수정하기 위한 실행 지시서다.

---

## 1. 역할과 최종 목표

너는 HANDS의 관리자 분석 화면을 출시 가능한 상태로 마무리하는 시니어 풀스택 엔지니어이자 운영형 제품 디자이너다.

대상 화면:

```text
http://localhost:3101/usage-overview
```

이 화면의 실제 사용자는 프로그래머가 아니라 **서비스를 혼자 관리하며 고객 활동과 예약 흐름을 판단하는 운영자**다. 운영자는 다음 사실을 화면에서 믿을 수 있어야 한다.

1. 같은 기간과 같은 명칭의 수치는 모든 카드, 차트, 정확 값 표와 목적지에서 일치한다.
2. 전체 예약 생성과 Preferred Partner 요청은 서로 다른 모집단으로 명확히 구분된다.
3. Production, Synthetic, Unknown 출처가 섞이지 않고, 검증되지 않은 값을 성공 상태로 선언하지 않는다.
4. 사용량 수집이 없거나 지연된 경우를 실제 고객 활동 0으로 오해하지 않는다.
5. 조치 큐의 수와 목적지 목록의 수, 필터, 행 상태가 같은 데이터 계약을 사용한다.
6. Custom 기간을 처음 선택해도 보이는 날짜와 실제 적용 상태가 모순되지 않는다.
7. 순위의 제목, 포함 기준, 정렬 기준이 일치하며 0 이벤트 고객을 사용량 1위로 표시하지 않는다.
8. 1440px 이상 데스크톱에서 첫 화면부터 조치 대상과 데이터 건강 상태를 빠르게 파악한다.
9. 키보드와 스크린리더로 기간 선택, 오류, 데이터 건강 상태, 차트의 정확 값에 접근할 수 있다.
10. 개발 데이터에서만 빠른 화면이 아니라 운영 규모에서도 측정 가능한 성능 예산을 가진다.

최종 재감사 점수는 **79/100, 조건부 승인**이었다. 카드 디자인만 다듬거나 문구만 바꿔 점수를 높이는 것이 목표가 아니다. 아래 데이터 계약과 출시 게이트가 코드, 테스트, 실제 브라우저 화면에서 충족돼야 완료다.

구현 우선순위는 반드시 다음 순서를 따른다.

```text
예약 집계 계약 통일
→ Booking provenance와 테스트 데이터 격리
→ Usage freshness 출시 게이트
→ Custom 기간·순위·큐 의미 정합성
→ 1440px 운영 화면 압축
→ 성능·접근성 하드닝
```

## 2. 작업 위치와 기준 자료

- 저장소: `C:\dev\massage-on-demand-vn`
- 기준 감사 보고서: `C:\dev\massage-on-demand-vn\docs\audits\usage-overview-final-reaudit-2026-08-12.md`
- 화면·DOM 증거: `C:\dev\massage-on-demand-vn\docs\audits\usage-overview-final-reaudit-evidence-2026-08-12\`
- 저장소 지침: `C:\dev\massage-on-demand-vn\AGENTS.md`
- 공통 워크플로 가드: `C:\dev\massage-on-demand-vn\docs\agent\HANDS_CODEX_WORKFLOW_GUARD.md`

시작 전에 `AGENTS.md`, 워크플로 가드, 감사 보고서를 끝까지 읽는다. 보고서 요약만 읽지 말고 P1/P2 발견, 코드 근거, 운영 문구, 수용 기준, 테스트 공백과 인계 내용을 모두 확인한다.

특히 다음 증거를 직접 연다.

```text
01-today-empty-1600x1000.png
02-7d-top-1600x1000.png
03-source-activity-expanded-1600x1000.png
04-reach-booking-outcomes-1600x1000.png
05-period-retention-base-1600x1000.png
06-services-regions-1600x1000.png
07-custom-default-invalid-1600x1000.png
08-custom-applied-top-1600x1000.png
09-activity-trends-1600x1000.png
10-chart-data-expanded-1600x1000.png
11-7d-dark-1600x1000.png
12-today-empty-expanded-1600x1000.png
13-attention-queue-destination-1600x1000.png
```

감사 당시 확인된 대표 수치는 다음과 같다. 이 값은 재현 기준일 뿐 fixture처럼 하드코딩하지 않는다.

```text
7일 범위:
- Booking outcomes / Created in period: 6
- Cancelled: 6
- Activity trends: No activity in this period
- Needs attention / New customers without a booking: 2
- 목적지 Customers 결과: 2

Custom 2026-08-01 ~ 2026-08-12:
- Booking outcomes / Created in period: 344
- Activity trend / Created records total: 176

Data health:
- Usage signal time unavailable
- Production usage freshness is unknown
- Customer ranking에 Smoke Cancellation Customer 노출
```

구현 전에 현재 DB와 소스를 다시 읽어 값이 달라졌는지 확인한다. 달라졌다면 현재 근거를 사용하되 계약 불일치가 해소된 것인지 데이터만 바뀐 것인지 구분한다.

## 3. 작업 방식과 안전 경계

- `AGENTS.md`에 따라 단일 에이전트로 작업한다. subagent, worker, handoff agent를 사용하지 않는다.
- 먼저 짧은 실행 계획을 세우고, 계획만 제출한 채 멈추지 말고 안전한 범위의 구현과 검증까지 계속한다.
- 시작 시 `git status --short`를 기록한다.
- dirty worktree의 기존 변경은 사용자 작업이다. 관련 없는 파일을 revert, reset, cleanup, 이동 또는 일괄 포맷하지 않는다.
- 보고서의 증상만 패치하지 말고 관련 caller와 SQL helper를 추적해 가장 좁은 공통 원인을 수정한다.
- 기존 Next.js, NestJS, Prisma, Vitest, Admin 컴포넌트, 토큰과 유틸을 우선 재사용한다.
- 새 UI framework, chart library, analytics platform, state management, cache framework를 추가하지 않는다.
- 성능은 측정 없이 최적화하지 않는다. 로컬 감사에서 7일 navigation은 74~182ms였으므로, 병목 증거 없이 Redis·materialized view·새 endpoint 체계를 먼저 만들지 않는다.
- 실제 운영/공유 DB의 schema migration, provenance backfill, fixture 삭제·변경은 승인 없이 적용하지 않는다.
- migration과 dry-run/backfill 도구는 작성하고 격리된 로컬 또는 테스트 DB에서 검증할 수 있다. 공유 데이터 apply는 별도 명시적 승인을 요구한다.
- 이름에 `Smoke`나 `Demo`가 포함됐다는 이유만으로 실제 데이터를 영구적으로 숨기는 name heuristic을 최종 provenance 계약으로 사용하지 않는다.
- 실제 고객·예약·파트너 레코드를 브라우저 검증 중 수정하거나 삭제하지 않는다.
- 스키마 변경이 필요하다고 판단하면 먼저 현재 metadata 기반 계약으로 안전하게 해결 가능한지 확인한다. first-class provenance 없이는 보장할 수 없다는 근거가 확인될 때만 최소 schema 변경을 한다.
- `schema.prisma`, migrations, shared contracts 또는 bookings 관련 보호 영역을 바꾸면 `AGENTS.md`의 강화 검증을 수행한다.
- 화면 구현과 검수는 **1440×1000과 1600×1000 데스크톱만** 대상으로 한다. 작은 화면 대응을 이유로 범위를 확장하지 않는다.
- 사용자 요청 없이 commit하지 않는다.
- 완료하지 못한 항목, 기존 실패, 공유 DB 승인이 필요한 항목을 성공으로 포장하지 않는다.

UI 작업은 Impeccable의 **Operate 모드**로 수행한다. 화려함보다 정보 신뢰성, 스캔 속도, 작업 우선순위, 오류 복구, 접근성을 우선한다. 기존 HANDS Admin 시각 언어와 공통 컴포넌트를 유지한다.

## 4. 이미 잘된 부분과 반드시 보존할 기능

다음은 이전 개선으로 좋아진 기반이다. 제거하거나 약화하지 않는다.

- 페이지명 `Customer Usage`와 명확한 목적 설명
- Today, Yesterday, 7 days, 30 days, This month, Custom의 제한된 기간 선택
- Asia/Ho_Chi_Minh/ICT 기준과 같은 길이의 이전 기간 비교
- API 실패, 유효하지 않은 기간, 실제 빈 데이터의 분리
- 빈 상태의 `Use last 7 days` 행동
- `Show empty report` disclosure
- `Needs attention`을 분석보다 앞에 둔 구조
- 큐 건수와 destination query를 URL로 전달하는 구조
- Unique-customer reach와 Booking outcomes의 분리
- 순차 이벤트 전환을 주장하지 않는 설명
- 상호 배타적 booking outcome reconciliation
- Period customers, exact milestone retention, Current customer base의 분리
- 전화번호 API 마스킹
- Source activity times disclosure
- 차트 요약과 정확 값 표
- 라이트/다크 테마의 동일한 정보 구조
- skip link, semantic heading, form error 연결, date picker 접근성
- bounded query window, Top N 제한과 기존 DB 인덱스

이번 수정으로 위 기능이 회귀하지 않도록 기존 테스트를 유지하고 필요한 계약 테스트를 추가한다.

## 5. 수정 전 필수 진단

코드를 변경하기 전에 아래를 수행하고 구현 보고서에 baseline을 남긴다.

1. 감사 보고서와 증거를 읽는다.
2. 현재 `/usage-overview`를 로그인된 브라우저에서 1600×1000으로 확인한다.
3. Today, 7 days, This month, bare Custom, 적용된 Custom 상태를 확인한다.
4. `Source activity times`, `Show empty report`, 두 차트의 `View chart data`를 열어 확인한다.
5. Needs attention 큐를 열고 Customers 목적지의 count, filter chip, 행 상태를 비교한다.
6. 라이트/다크 테마를 확인한다.
7. `usage-overview/page.tsx`, model, trend chart, API response contract와 모든 관련 spec을 읽는다.
8. `getAdminUsageOverview()`의 12개 query와 각 timestamp/provenance helper를 표로 정리한다.
9. `createdBookingCount`, `partnerBookingRequestCount`, trend `bookingRequestCount`, completed count가 각각 어떤 timestamp와 cohort를 쓰는지 대조한다.
10. `adminBookingProductionDataSql`, `adminBookingExplicitFixtureMetadataSql`, customer list의 production booking filter가 서로 어떻게 다른지 확인한다.
11. `AppUsageEvent`, `AppUsageDailyAggregate`, Booking의 출처를 생성하는 모든 write path와 smoke/seed script를 `rg`로 찾는다.
12. baseline focused tests, lint와 typecheck를 실행한다.
13. 현재 DB 크기와 query timing을 측정할 수 있으면 읽기 전용으로 기록한다. 측정하지 못하면 추정치를 쓰지 않는다.

우선 확인할 파일:

```text
apps/admin_web/app/usage-overview/page.tsx
apps/admin_web/app/usage-overview/usage-overview-model.ts
apps/admin_web/app/usage-overview/usage-overview-trend-chart.tsx
apps/admin_web/app/usage-overview/usage-overview-refresh-button.tsx
apps/admin_web/app/usage-overview/page.spec.tsx
apps/admin_web/app/usage-overview/usage-overview-model.spec.ts
apps/admin_web/app/customers/page.tsx
apps/admin_web/app/customers/customer-list-model.ts
apps/admin_web/app/customers/customer-list-model.spec.ts
apps/admin_web/app/customers/customer-filters.spec.ts
apps/admin_web/app/globals.css
apps/admin_web/lib/admin-api.ts

apps/api/src/admin/admin-usage-overview-query.ts
apps/api/src/admin/admin-usage-overview.ts
apps/api/src/admin/admin-usage-overview-query.spec.ts
apps/api/src/admin/admin-usage-overview.spec.ts
apps/api/src/admin/admin-booking-list-query.ts
apps/api/src/admin/admin-booking-list-query.spec.ts
apps/api/src/admin/admin.service.ts
apps/api/src/admin/admin.controller.ts
apps/api/prisma/schema.prisma
apps/api/prisma/migrations/**

infra/scripts/app-usage-events-smoke.mjs
infra/scripts/app-usage-daily-backfill.mjs
infra/scripts/app-usage-retention.mjs
infra/scripts/booking-list-smoke-seed.mjs
infra/scripts/stale-api-smoke-bookings.mjs
```

현재 소스 위치가 달라졌다면 `rg` 결과를 따라가되 전체 저장소를 무작정 읽지 않는다. 진단만 하고 멈추지 말고 Phase 1부터 구현을 계속한다.

---

## Phase 1 — 출시 게이트: 예약 집계 계약을 하나로 통일한다

### 1.1 현재 문제

- Period summary의 `createdBookingCount`는 기간 내 모든 production-qualified booking `createdAt`을 센다.
- Trend의 `bookingRequestCount`는 `preferredProviderId IS NOT NULL`인 booking만 센다.
- UI는 trend의 이 값을 `Created records`라고 표시한다.
- 그래서 같은 기간에 `Created in period 6`과 `No booking activity`, 또는 `344`와 `176`이 동시에 나타난다.

### 1.2 구현 계약

1. 전체 예약 생성과 Preferred Partner 요청을 별도 필드로 분리한다.
2. trend row에 최소 다음 의미가 명확히 드러나야 한다.

```text
createdBookingCount      // booking.createdAt이 적용 기간 내인 전체 production booking
preferredRequestCount   // preferredProviderId가 있고 booking.createdAt이 적용 기간 내
completedBookingCount   // booking.closedAt이 적용 기간 내이고 status COMPLETED
```

3. 기존 public/shared contract 이름을 바꿀 때 backward compatibility가 필요하면 API model normalizer에서 한시적으로 처리하고, UI에는 모호한 `bookingRequestCount`를 새 의미로 재사용하지 않는다.
4. hourly와 daily query가 동일한 모집단과 provenance helper를 사용한다.
5. `Booking outcomes`는 created cohort의 current status이고, trend의 `Completed during period`는 closedAt activity라는 차이를 화면 설명에 명시한다.
6. UI 명칭은 다음처럼 정확히 구분한다.

```text
Bookings created
Preferred Partner requests
Completed during period
```

7. 전체 activity empty state는 usage, created bookings, preferred requests, completed activity가 모두 0일 때만 표시한다.
8. booking이 존재하지만 usage telemetry가 unavailable인 경우 차트 전체를 `No activity`로 숨기지 않는다.

### 1.3 필수 회귀 테스트

- `sum(trend.createdBookingCount) === bookingQuality.createdBookingCount`.
- `sum(trend.preferredRequestCount) === totals.partnerBookingRequestCount`.
- 일반 booking 6건, preferred 0건 → trend에 Bookings created 6, empty state 아님.
- 전체 booking 344건, preferred 176건 → 두 시리즈가 각각 정확히 표시됨.
- hourly Today와 daily 7d/30d/custom 모두 동일 계약.
- created cohort outcome 합계가 createdBookingCount와 reconciliation됨.
- `closedAt` completion과 created cohort completion을 실수로 같은 값으로 강제하지 않는 fixture.

---

## Phase 2 — 출시 게이트: Booking provenance와 테스트 데이터를 안전하게 격리한다

### 2.1 현재 문제

- Usage aggregate는 `origin=PRODUCTION`을 요구하므로 비교적 강한 계약을 가진다.
- Booking 기반 지표는 `metadata.smokeFixture`, `metadata.auditFixture`, `metadata.dataOrigin=SYNTHETIC` 같은 명시 marker만 제외한다.
- marker가 없는 Smoke/Demo 레코드는 생산 결과에 들어온다.
- API는 `bookingFixtures: explicit-markers-excluded`를 이미 반환하지만 UI는 usage aggregate 성공 메시지만 크게 보여 전체 보고서가 production-safe인 것처럼 보인다.

### 2.2 먼저 결정할 provenance 전략

코드를 읽은 후 아래 두 전략 중 더 작은 **신뢰 가능한** 전략을 선택하고 구현 보고서에 근거를 남긴다.

#### 전략 A — 현재 스키마로 보장 가능할 때

- 모든 booking 생성 경로가 server-owned metadata provenance를 필수 기록하도록 한다.
- 공통 production predicate 하나를 Usage Overview, Customers queue, rankings, services, regions, current base에서 재사용한다.
- 알 수 없는/누락 metadata는 production으로 간주하지 않고 `UNKNOWN`으로 분류한다.
- existing unknown booking을 분류하는 dry-run 도구와 테스트를 추가한다.

#### 전략 B — JSON metadata만으로 보장할 수 없을 때

- Booking에 first-class origin enum/column을 최소 변경으로 추가한다.
- 예: `PRODUCTION | SYNTHETIC | UNKNOWN`. 실제 enum 명칭은 기존 `AppUsageOrigin` 재사용 가능성과 도메인 의미를 검토한다.
- server-owned 생성 경로에서 명시적으로 기록하고 클라이언트가 값을 위조하지 못하게 한다.
- 기존 레코드는 무조건 production으로 backfill하지 않는다. evidence 기반 dry-run으로 PRODUCTION/SYNTHETIC/UNKNOWN 후보를 분류한다.
- 공유/운영 DB에는 apply하지 않는다.

### 2.3 공통 계약

1. 예약 결과, trend, customer lifecycle, current base, customer rankings, partner rankings, services, regions, reviews/refunds가 같은 booking provenance predicate를 사용한다.
2. ID/name prefix heuristic은 dry-run 후보 탐지에만 사용할 수 있다. 최종 production authority로 사용하지 않는다.
3. Unknown booking은 production 수치에서 제외하고 `unknownBookingCount`와 이유를 API에 제공한다.
4. provenance 응답은 최소 usage와 booking을 별도로 표현한다.

```text
usage: guaranteed | incomplete
booking: guaranteed | incomplete
unknownUsageAggregateCount
unknownBookingCount
```

5. 화면은 다음처럼 소스별 상태를 보여 준다.

```text
Usage signals: Production verified
Booking records: Verification incomplete — N records excluded
```

6. usage만 guaranteed일 때 페이지 전체를 성공 톤으로 선언하지 않는다.
7. marker가 없는 기존 Smoke/Demo 레코드가 production 순위와 outcome에 나타나지 않게 한다.
8. unknown을 조용히 삭제하거나 production으로 승격하지 않는다.

### 2.4 dry-run/backfill 안전 계약

필요하면 다음 분류를 출력하는 읽기 전용 도구를 만든다.

```text
KEEP_PRODUCTION
MARK_SYNTHETIC
REVIEW_UNKNOWN
CONFLICT
```

출력에는 booking ID, 관련 customer/partner ID, 현재 marker/origin, 판정 evidence를 포함한다. 기본 실행은 dry-run이며 write하지 않는다. `--apply`는 환경 식별, manifest checksum 또는 동등한 확인과 명시적 승인을 요구한다. 이 작업에서는 공유 DB apply를 실행하지 않는다.

### 2.5 필수 테스트

- 클라이언트가 production origin을 임의 지정할 수 없음.
- explicit synthetic booking 제외.
- marker 누락 Smoke/Demo fixture가 unknown으로 분류되고 production 집계에서 제외.
- production booking은 정상 포함.
- 모든 Usage Overview booking 기반 query가 공통 predicate를 사용한다는 contract test.
- unknown 1건 이상이면 UI가 `Booking records: Production verified`라고 표시하지 않음.
- dry-run은 DB write 0건, 두 번 실행 결과 안정적.

---

## Phase 3 — 출시 게이트: Usage freshness를 실제 운영 상태로 만든다

### 3.1 현재 문제

화면은 `Production usage freshness is unknown`을 경고하지만 Active customers, Partner views, app activity를 정상 `0`처럼 함께 보여 준다. 수집 미가동과 실제 수요 0을 혼동할 수 있다.

### 3.2 구현 계약

1. `fresh`, `delayed`, `unknown`, `failed` 상태를 명확히 모델링한다. 이미 있는 상태를 우선 재사용한다.
2. `unknown` 또는 `failed`일 때 usage-derived KPI는 정상 0이 아니라 `—` 또는 `Data unavailable`로 표시한다.
3. booking-derived 지표는 별도로 계속 보여 준다.
4. 하나의 `Data health` 영역에서 소스를 분리한다.

```text
Usage telemetry: unavailable / delayed / fresh
Booking data: available / incomplete / failed
Last successful usage aggregate: ...
Report generated: ...
```

5. `Source activity times` disclosure는 유지하되 중복 문구를 제거한다.
6. `role=alert`는 실제 새 오류 또는 상태 악화에만 사용한다. 동일한 unavailable 문구를 scope chip, alert, 카드 제목에서 반복하지 않는다.
7. usage pipeline smoke/backfill/retention script를 읽고 최근 production aggregate가 생기지 않는 원인을 확인한다.
8. 코드로 수정 가능한 수집/집계 결함이면 최소 변경으로 고치고 테스트한다.
9. 환경·모바일 이벤트 발생 등 외부 조건이 필요한 경우 억지로 fake freshness를 만들지 말고 정확한 runbook과 blocker를 보고한다.

### 3.3 출시 게이트

다음 조건을 테스트 또는 읽기 전용 smoke에서 확인해야 production usage 수치를 정상 값으로 표시한다.

- 최근 48시간 이내 production aggregate timestamp.
- unknown aggregate 제외 정책 확인.
- 실제 app event → daily aggregate → admin API → UI end-to-end 한 건 검증.
- 소스 실패 시 booking 데이터와 usage 데이터가 독립적으로 degraded 상태를 보임.

### 3.4 필수 테스트

- fresh/delayed/unknown/failed 각각의 API 및 UI 상태.
- unknown에서 `0 active customers`를 수요 0으로 단정하지 않음.
- usage unavailable + booking 6건 → booking 차트와 outcome은 계속 표시.
- source status 반복 alert 없음.
- pipeline smoke가 synthetic event를 production aggregate로 집계하지 않음.

---

## Phase 4 — Custom 기간, 순위, 조치 큐의 의미를 정합하게 만든다

### 4.1 Custom 최초 진입

현재 bare `?range=custom`은 입력에 오늘 날짜를 보여 주면서 server validation error를 표시한다.

구현 계약:

1. Custom 선택 링크에 유효한 기본 기간을 넣는다. 권장은 최근 7일이며 Asia/Ho_Chi_Minh 기준으로 계산한다.
2. 또는 입력을 비워 두고 날짜 선택 안내만 표시한다. 보이는 default만 채우고 error를 띄우는 방식은 금지한다.
3. URL query, input value, applied period label이 항상 일치한다.
4. reversed range, 누락 날짜, 너무 긴 범위의 검증은 같은 폼에서 입력값을 보존하고 설명한다.
5. 기존 accessible date picker와 `aria-invalid`/error 연결을 유지한다.

필수 테스트:

- Custom 탭 첫 클릭에 오류 없음.
- URL from/to와 보이는 input 값 일치.
- Apply 즉시 유효한 보고서 로드.
- reversed/missing 범위는 입력 보존과 field error 제공.

### 4.2 고객 순위

현재 query는 usage, closed booking, booking intent를 합쳐 usage event 0 고객도 포함하지만 UI는 `Top five customers by production usage events`라고 설명한다.

권장 구현:

- `Most active customers`: production usage event가 1개 이상인 고객만 표시.
- booking issue/completion 고객이 필요하면 `Customers with booking outcomes` 또는 Needs attention 큐로 분리한다.
- 한 표를 유지해야 한다면 제목을 `Customer activity & booking outcomes`로 바꾸고 정렬 기준을 화면에 표시한다.
- 0-event 고객을 usage rank `#1`로 표시하지 않는다.
- `Last active`가 usage인지 booking인지 행별로 다르다면 source를 표시하거나 컬럼명을 정확히 바꾼다.

### 4.3 파트너 순위

- views, preferred requests, completed work를 독립 수치로 유지한다.
- production provenance가 보장된 데이터만 포함한다.
- view 0이지만 preferred request가 있는 파트너는 허용하되 표 설명이 이를 명확히 말해야 한다.
- 사용자-facing copy는 `Partner`를 사용한다.

### 4.4 Needs attention 목적지

1. 큐 count, destination query, filter chip, row current situation, booking history가 같은 production booking 계약을 사용한다.
2. 목적지 행에는 `No production booking`을 그대로 표시한다.
3. non-production 기록이 있다면 `6 non-production records`처럼 별도 보조 정보로 표시한다.
4. 같은 행에 `No booking`과 `6 total`이 설명 없이 공존하지 않는다.
5. Today, 7d, 30d, month, custom에서 count parity를 테스트한다.
6. 큐가 0건이면 기본 숨김 또는 compact empty 처리하되, 운영자가 필요하면 확인할 수 있다.

### 4.5 Region/Service 연결

- 서비스와 지역 수치도 같은 booking provenance와 created cohort를 사용한다.
- This month/Custom에서도 Vietnam Overview가 exact from/to를 받을 수 있으면 같은 기간으로 연결한다.
- destination이 exact 기간을 지원하지 않으면 조용히 다른 기간으로 열지 말고 제한을 명시한다.

---

## Phase 5 — 1440px 이상 운영 화면을 더 압축한다

큰 재설계는 하지 않는다. 기존 HANDS Admin 컴포넌트와 시각 언어를 유지하면서 첫 화면의 의사결정 밀도만 개선한다.

### 5.1 권장 상단 구조

```text
Compact header
  Customer Usage + 한 줄 설명
  Refresh / Export 또는 Copy report link

Period & Data health bar
  Presets / applied dates / comparison
  Usage telemetry health / Booking provenance health

Needs attention
  queue / count / oldest or priority / destination

Decision snapshot
  Active customers 또는 Data unavailable
  Bookings created
  Unresolved bookings
  Cancelled bookings
```

구현 요구:

- breadcrumb, Insights subnav, page title, Reporting period를 모두 없애지 않는다. 중복된 수직 padding과 카드 중첩만 줄인다.
- 1600×1000 첫 화면에 최소 한 개 Needs attention 큐의 제목·설명·행동이 완전히 보이게 한다.
- 적용 기간, 비교, report generated, data health를 한눈에 읽되 같은 unavailable 문구를 반복하지 않는다.
- 위험 상태는 색상만으로 표현하지 않는다.
- 성공/경고 카드의 정보 위계를 기존 Admin 디자인 토큰으로 유지한다.
- report 전체의 primary action은 많아도 2개로 제한한다.

### 5.2 차트와 정확 값

- 기존 차트 library와 exact data disclosure를 유지한다.
- `Bookings created`, `Preferred Partner requests`, `Completed during period`를 의미에 맞는 독립 series로 표시한다.
- 범례와 table header가 같은 문구를 사용한다.
- 두 exact table의 이중 내부 스크롤이 불편하면 하나의 full-width table 또는 한 번에 하나만 열리는 disclosure로 단순화한다.
- chart SVG와 바깥 `role=img`가 스크린리더에서 중복 탐색되지 않게 확인한다.

### 5.3 Export/공유는 최소 구현

- 기존 URL이 range/from/to를 보존하므로 우선 `Copy report link`를 작은 행동으로 제공할 수 있다.
- CSV export는 이미 있는 export helper가 있거나 운영 요구를 작은 변경으로 충족할 때만 구현한다.
- 새 export framework를 만들지 않는다.
- export를 구현하면 applied period, generated time, usage/booking provenance를 반드시 포함한다.

---

## Phase 6 — 성능, 오류, 접근성 하드닝

### 6.1 성능

현재 `getAdminUsageOverview()`는 최대 12개의 raw query를 `Promise.all`로 실행한다. 로컬 개발 데이터에서는 빠르므로 먼저 계측한다.

1. 하위 query별 duration과 실패를 관측 가능하게 한다. 기존 logging/metrics 유틸을 우선 사용한다.
2. production-like 데이터 또는 안전한 fixture 규모에서 p50/p95를 측정한다.
3. 병목이 확인될 때만 다음 순서로 최소 수정한다.

```text
중복 query/CTE 제거
→ 기존 인덱스 활용과 query plan 개선
→ 기간과 무관한 current base의 짧은 cache
→ 하위 분석 section 지연 로딩
→ 마지막 수단으로 materialized summary
```

4. 한 query 실패로 전체 화면을 무조건 숨기지 말고, API 구조를 과도하게 바꾸지 않는 범위에서 source별 partial error를 제공한다.
5. cache를 추가하면 mutation/aggregate 갱신 시 무효화와 stale 표시를 테스트한다.
6. 목표 예산:

```text
상단 운영 정보 p95 <= 1s
전체 분석 p95 <= 2s
명시적 query timeout
부분 실패 시 사용 가능한 섹션 유지
```

목표를 측정할 환경이 없으면 달성했다고 주장하지 않는다.

### 6.2 오류와 edge case

- 400 invalid range, 401, 403, 429, 500/503를 구분한다.
- booking data failure와 usage telemetry failure를 독립적으로 표현한다.
- 큰 수치, 긴 고객/파트너명, CJK/베트남어 문자, 빈 데이터, unknown provenance, delayed aggregate를 검사한다.
- Refresh 중복 클릭이 동시 요청 폭주를 만들지 않게 한다.
- 차트가 0, 매우 큰 spike, 한 시점만 있는 범위에서도 읽힌다.

### 6.3 접근성

- keyboard-only로 기간, Custom form, disclosure, 큐 링크를 사용할 수 있어야 한다.
- focus indicator와 논리적 tab order를 유지한다.
- 오류 요약과 필드 오류가 연결된다.
- 동적 freshness 상태를 중복 announce하지 않는다.
- chart summary와 exact data table이 같은 정보를 제공한다.
- Windows high contrast에서 상태가 구분된다.
- 가능하면 NVDA 또는 JAWS로 주요 흐름을 확인하고, 실행하지 못하면 정확히 skipped로 보고한다.

---

## 6. 구현하지 말아야 할 것

- `Usage Overview`, `Marketing Analytics`, `Vietnam Overview`를 한 거대한 페이지로 합치지 않는다.
- 디자인 시스템을 교체하거나 새 UI library/chart library를 추가하지 않는다.
- 모바일 대응을 이유로 이번 범위를 확장하지 않는다.
- `Smoke`/`Demo`라는 이름만 보고 영구 production filter를 만들지 않는다.
- metadata가 없는 기존 booking을 자동으로 production으로 간주하지 않는다.
- 공유/운영 DB에 migration/backfill/cleanup apply를 승인 없이 실행하지 않는다.
- Usage aggregate가 unavailable인데 가짜 timestamp나 synthetic activity를 production처럼 만들지 않는다.
- `Created records` 문구만 `Preferred requests`로 바꾸고 상단 total 불일치를 방치하지 않는다. 전체 계약을 맞춘다.
- 모든 query를 하나의 거대한 SQL로 합쳐 유지보수성과 부분 실패 가능성을 악화시키지 않는다.
- 병목 측정 없이 Redis, queue, materialized view, 새 분석 서비스부터 추가하지 않는다.
- row마다 별도 API/DB query를 호출하는 N+1 구현을 하지 않는다.
- customer ranking에서 0-event booking-only row를 설명 없이 usage rank로 유지하지 않는다.
- 테스트 통과를 위해 production/synthetic 경계를 느슨하게 하지 않는다.
- 관련 없는 referral, finance, wallet, matching, auth 코드를 정리하지 않는다.
- 현재 API 전체 typecheck의 referral attribution 실패를 이번 작업과 섞어 임의 수정하지 않는다. 별도 기존 blocker로 보고한다.
- 사용자 요청 없이 commit하지 않는다.

## 7. 테스트 요구사항

기존 테스트를 보존하고 다음을 추가한다.

### API/DB

- trend created 합계와 bookingQuality created 합계 일치
- trend preferred 합계와 partnerBookingRequest total 일치
- 일반 booking만 있는 기간이 empty activity가 아님
- created cohort outcome과 closedAt activity의 구분
- hourly/daily/custom 기간 계약 일치
- production/synthetic/unknown booking 분류
- marker 누락 fixture의 fail-closed 처리
- booking 기반 모든 usage query의 공통 provenance predicate
- unknown booking count와 provenance 응답
- usage fresh/delayed/unknown/failed 분류
- query별 timeout/partial failure 또는 현재 구조에 맞는 실패 계약
- dry-run/backfill 무쓰기와 idempotency

### Admin Web

- bare Custom 첫 진입의 URL/input/applied period 일치
- reversed/missing custom 입력 보존과 오류 연결
- usage unknown에서 KPI를 정상 0으로 표시하지 않음
- usage unavailable + booking 존재 시 booking sections 유지
- source별 Data health 상태와 중복 alert 방지
- customer usage ranking에 0-event row 미포함 또는 정확한 대체 제목
- trend 범례, summary, exact table header 문구 일치
- queue count/destination link 계약
- 빈 report disclosure와 기존 접근성 회귀 없음
- 라이트/다크 동일 정보 구조

### Customers 교차 페이지

- `usage-new-unbooked` segment가 같은 production provenance를 사용
- queue count와 destination count parity
- `No production booking` 행 문구
- non-production history 별도 표시
- dateField/joined/dateFrom/dateTo 보존

### 브라우저/E2E

1600×1000에서 다음을 캡처하고 확인한다.

1. Today empty + usage unknown
2. 7 days 상단 Data health와 Needs attention
3. 7 days booking outcomes + trends
4. Custom 최초 진입
5. Custom 적용 후 outcomes + trend exact data
6. Customer ranking과 Partner ranking
7. Source activity times
8. Needs attention 목적지 Customers
9. 라이트/다크
10. usage API 실패와 booking-only degraded 상태

필수 assertion:

- 동일 기간 created booking 합계가 outcome/trend/exact table에서 일치
- preferred request는 별도 수치
- Smoke/Demo fixture가 production 표에 없음
- usage unknown 수치가 정상 0으로 보이지 않음
- Custom 첫 진입 오류 없음
- queue와 destination count 일치
- 1600×1000 첫 화면에 큐 행동이 완전히 보임
- console error/warning 없음
- 기존 viewport override를 사용했다면 검증 후 reset

## 8. 실행할 검증 명령

Windows에서는 `npm.cmd`를 사용한다. 실제 변경 파일에 맞춰 focused test를 먼저 실행하고 보호 영역 변경 시 범위를 확장한다.

### Baseline 및 focused 검증

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- app/usage-overview/page.spec.tsx app/usage-overview/usage-overview-model.spec.ts app/customers/customer-list-model.spec.ts app/customers/customer-filters.spec.ts

npm.cmd run test --workspace @massage-vn/api -- src/admin/admin-usage-overview.spec.ts src/admin/admin-usage-overview-query.spec.ts src/admin/admin-booking-list-query.spec.ts

npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run typecheck --workspace @massage-vn/api
```

Focused lint는 변경 파일만 대상으로 실행한다.

```powershell
cd apps/admin_web
npx.cmd eslint app/usage-overview app/customers/customer-list-model.ts

cd ..\api
npx.cmd eslint src/admin/admin-usage-overview-query.ts src/admin/admin-usage-overview.ts src/admin/admin-booking-list-query.ts
```

### 기존 usage 파이프라인 검증

```powershell
npm.cmd run app-usage:backfill:test
npm.cmd run app-usage:smoke
npm.cmd run app-usage:retention:check
```

실제 데이터에 쓰는 `app-usage:backfill:apply`와 `app-usage:retention:apply`는 사용자 승인 없이 실행하지 않는다.

### 보호 영역을 변경한 경우

`schema.prisma`, migration, booking 생성 경로, shared contract를 변경했다면 최소 다음을 실행한다.

```powershell
npm.cmd run prisma:migrations:check
npm.cmd run verify:scope -- -Scope api
npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:local
```

현재 감사 baseline에는 `apps/api/src/admin/admin.service.ts:7286` referral attribution 관련 API 전체 typecheck 실패가 있었다. 시작 시 재확인하고, 동일한 기존 실패라면 usage 변경과 구분해 기록한다. 이번 변경으로 새 오류가 추가되지 않았다는 것을 focused checks로 증명한다. 기존 실패를 숨기거나 전체 검증 통과로 보고하지 않는다.

UI 변경 완료 후 Impeccable detector를 변경된 UI target에 한 번 실행한다.

```powershell
node C:\Users\laboy\.codex\skills\impeccable\scripts\detect.mjs --json <changed-ui-targets>
```

## 9. 완료 기준

다음 조건이 모두 충족돼야 코드 구현 완료로 판정한다.

- 같은 기간의 Bookings created 합계가 KPI, outcomes, trend, exact table에서 일치
- Preferred Partner requests가 별도 집계·문구로 분리
- booking provenance가 guaranteed/incomplete로 명확히 표현됨
- unknown/synthetic booking이 production 집계에서 fail-closed 처리됨
- Smoke/Demo fixture가 production 고객·파트너 순위와 예약 결과에 노출되지 않음
- Usage freshness unknown에서 usage KPI를 정상 0으로 표시하지 않음
- booking-only degraded 상태가 사용 가능한 정보로 남음
- Custom 첫 진입에 유효한 기간이 적용되고 모순된 오류가 없음
- 고객 순위 제목, 포함 기준, 정렬 기준이 일치
- 큐 count, destination count, 행 상태가 같은 production 계약을 사용
- This month/Custom 지역 상세 링크가 같은 기간을 보존하거나 제한을 명시
- 상단 반복이 줄고 1600×1000 첫 화면에 큐 행동이 보임
- 차트 exact data와 접근성이 유지됨
- focused tests/lint/admin typecheck 통과
- API 전체 typecheck의 기존/신규 실패가 정확히 구분됨
- 보호 영역 변경 시 migration/scope/full 검증 결과 기록
- before/after 화면 증거와 구현 보고서가 저장됨

데이터 rollout 완료 기준은 별도로 표시한다.

- 실제 booking provenance dry-run 결과 검토
- 사용자 승인 후에만 shared DB backfill/cleanup apply
- unknown booking 0 또는 승인된 예외 목록
- 최근 48시간 production usage aggregate 확인
- 실제 event → aggregate → admin UI end-to-end 검증

승인 없이 데이터 rollout까지 완료했다고 주장하지 않는다.

## 10. 산출물

다음을 남긴다.

1. 필요한 최소 코드와 migration
2. provenance dry-run/backfill 도구와 테스트(필요한 경우)
3. unit/integration/browser 회귀 테스트
4. before/after 화면·DOM 증거 폴더
5. `docs/audits/usage-overview-remediation-implementation-report-YYYY-MM-DD.md`

구현 보고서에는 다음을 포함한다.

- 감사 요구사항별 `완료 / 부분 완료 / 미완료`
- 변경 파일과 변경 이유
- 기존 수치와 수정 후 수치의 계약 대조
- provenance 전략 A/B 선택과 근거
- migration/backfill/dry-run 결과와 apply 미실행 사실
- usage pipeline freshness 확인 결과
- 실행한 명령과 pass/fail/skipped
- API 전체 typecheck 기존 실패 상태
- 보호 영역 변경 여부
- before/after 브라우저 캡처 링크
- 1440/1600 화면 판정
- 성능 실측과 측정 환경
- 남은 사용자 승인 또는 외부 환경 blocker
- 남은 위험
- 출시 가능 여부와 새 점수

## 11. 최종 응답 형식

최종 응답은 다음 순서로 작성한다.

1. 한 줄 출시 판정과 점수
2. 해결한 데이터 계약과 운영 화면 변경
3. provenance dry-run/backfill 결과와 apply 미실행 사실
4. usage freshness 상태
5. 테스트·검증 결과
6. 보호 영역 변경
7. 남은 위험 또는 사용자 승인 필요 작업
8. 구현 보고서 링크
9. 다음 권장 작업 1개

중요:

- UI가 예뻐지고 테스트가 통과해도 합계 불일치, fixture 노출, freshness unknown이 남아 있으면 출시 가능으로 판정하지 않는다.
- 보고서의 수치가 현재 데이터에서 재현되지 않아도 계약 테스트로 같은 조건을 만든다.
- 공유 DB apply가 필요한 작업은 명시적으로 멈추고 승인을 요청한다.
- 일부 항목이 미완료면 이유, 코드 근거와 운영 영향을 숨기지 않는다.

---

## 이 프롬프트의 사용 메모

- Codex 앱에서 저장소 `C:\dev\massage-on-demand-vn`을 연 새 작업에 이 문서 전체를 붙여 넣는다.
- 이 작업은 Admin Web, API SQL, booking provenance와 선택적 migration을 포함하므로 Plan 모드로 시작해도 좋지만 계획만 작성하고 끝내지 말고 구현과 검증까지 진행해야 한다.
- schema 변경 없이 신뢰 가능한 provenance를 보장할 수 있으면 그 경로가 우선이다. 스키마 변경은 근거가 있을 때만 최소화한다.
- 실제 booking backfill/cleanup apply 단계에서 Codex가 사용자 승인을 요청하는 것이 정상이다.
