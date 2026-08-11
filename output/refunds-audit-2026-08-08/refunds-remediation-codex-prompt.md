# Codex 실행 프롬프트 — HANDS Admin `/refunds` 운영 개선

아래 프롬프트 전체를 Codex에 전달한다. 작업 위치는 반드시 `C:\dev\massage-on-demand-vn`으로 지정한다.

---

## 작업 목표

HANDS Admin의 `/refunds`를 실제 재무 운영자가 신뢰하고 사용할 수 있는 **Refund Control Center**로 개선하라.

이번 작업의 핵심은 단순한 시각 개선이 아니다. 다음 운영 오류를 코드, API 상태 계약, 링크, 필터, 문구, 테스트까지 일관되게 수정하는 것이다.

1. 기본 화면이 전체 미처리 백로그를 0건처럼 숨기는 문제
2. `All dates`가 실제로는 다시 `Today`로 돌아가는 문제
3. `Awaiting decision`과 `State mismatch`가 중복되는 큐 분류 문제
4. 과거 환불의 `Open payment` 링크가 대상 결제를 열지 못하는 문제
5. 다음 행동 문구와 실제 Approval Queue·정합성 복구 경로가 연결되지 않은 문제
6. `Decision evidence`를 펼쳤을 때 테이블 레이아웃이 무너지는 문제
7. 환불 summary가 화면에서 사용하지 않는 집계를 반복해 초기 화면이 느린 문제

계획만 작성하고 멈추지 말고, 현재 코드를 조사한 뒤 안전한 범위에서 구현·테스트·브라우저 검증까지 완료하라.

## 반드시 먼저 읽을 자료

1. 저장소 지침:
   - `C:\dev\massage-on-demand-vn\AGENTS.md`
2. 감사 보고서:
   - `C:\dev\massage-on-demand-vn\output\refunds-audit-2026-08-08\refunds-deep-audit-report.md`
3. 감사 화면 증거:
   - `C:\dev\massage-on-demand-vn\output\refunds-audit-2026-08-08\01-default-open-queue.jpg`
   - `C:\dev\massage-on-demand-vn\output\refunds-audit-2026-08-08\04-open-backlog-all-dates.jpg`
   - `C:\dev\massage-on-demand-vn\output\refunds-audit-2026-08-08\05-state-mismatch-backlog.jpg`
   - `C:\dev\massage-on-demand-vn\output\refunds-audit-2026-08-08\11-awaiting-queue-mixes-mismatch.jpg`
   - `C:\dev\massage-on-demand-vn\output\refunds-audit-2026-08-08\06-decision-evidence-expanded.jpg`
   - `C:\dev\massage-on-demand-vn\output\refunds-audit-2026-08-08\13-open-payment-link-empty.jpg`

보고서의 숫자는 감사 당시의 관측 데이터다. `112`, `109`, `39` 같은 숫자를 UI에 하드코딩하지 말고 항상 API 응답에서 계산하라.

## 작업 방식과 안전 규칙

1. 반드시 단일 에이전트로 작업한다. 서브에이전트나 멀티에이전트 도구를 사용하지 않는다.
2. 작업 시작 전에 `git status --short`와 관련 파일의 현재 diff를 확인한다.
3. 작업 트리는 이미 매우 더러울 수 있다. 사용자 변경을 reset, checkout, stash, 삭제 또는 덮어쓰지 않는다.
4. 관련 없는 파일을 정리하거나 포맷하지 않는다.
5. 기존 Admin 디자인 시스템과 공용 컴포넌트를 우선 재사용한다. 새로운 UI 라이브러리나 의존성을 추가하지 않는다.
6. 1440px 이상 데스크톱 운영 화면만 검수한다. 1024px 이하 반응형 디자인은 이번 범위에 포함하지 않는다.
7. 환불 승인·거절, maker-checker, 결제·정산 상태 전이, 감사 로그 규칙을 약화하지 않는다.
8. 실제 증빙이나 담당자 데이터가 없으면 만들어내지 않는다. 파생된 운영 규칙은 `Decision evidence`가 아니라 `Review checklist`로 표시한다.
9. DB 인덱스나 Prisma schema/migration을 추측으로 추가하지 않는다. 실제 query plan 증거 없이 schema를 변경하지 않는다.
10. `/refunds`와 Approval Queue를 한 페이지로 합치지 않는다. 역할을 분리하되 양방향 작업 경로를 연결한다.
11. 현재 코드와 런타임이 보고서와 달라졌다면 현재 코드·실제 화면을 우선하되, 차이와 판단 근거를 최종 보고에 기록한다.

## 먼저 조사할 코드

최소한 다음 파일과 인접 테스트·공용 컴포넌트를 읽고 실제 호출 흐름을 파악하라.

- `apps/admin_web/app/refunds/page.tsx`
- `apps/admin_web/app/refunds/refund-filter-board-section.tsx`
- `apps/admin_web/app/refunds/refunds-table-section.tsx`
- `apps/admin_web/app/refunds/refund-command-board-section.tsx`
- `apps/admin_web/app/refunds/refund-decision-checklist-section.tsx`
- `apps/admin_web/app/refunds/*.spec.tsx`
- `apps/admin_web/app/finance-tax/approval-queue/page.tsx`
- `apps/admin_web/app/payments/payment-page-model.ts`
- `apps/admin_web/app/payments/[id]/page.tsx`
- `apps/admin_web/app/loading.tsx`
- `apps/admin_web/app/globals.css`
- `apps/admin_web/lib/admin-api.ts`
- `apps/admin_web/lib/admin-queue-list.ts`
- `apps/admin_web/lib/date-range.ts`
- `apps/api/src/admin/admin-payment.routes.ts`
- `apps/api/src/admin/admin-refund-queue.ts`
- `apps/api/src/admin/admin.service.ts`
- `apps/api/src/admin/admin.service.spec.ts`
- `apps/api/prisma/schema.prisma`의 `Refund`, `Payment`, `Booking` 인덱스 정의

`rg`로 기존 drawer, side panel, detail row, filter toolbar, search, refresh, loading skeleton, route focus/anchor 패턴을 먼저 찾고 재사용하라.

## 구현 요구사항

### P0. 기본 운영 범위와 URL 계약 수정

1. `/refunds`의 기본 운영 상태를 다음과 같이 변경한다.
   - `range=all`
   - `review=open`
   - `sort=oldest`
   - `page=1`
2. URL에 `range`가 없을 때의 의미와 canonical URL 생성 규칙을 일치시킨다.
3. 가장 안전한 기준은 모든 기간 링크에 `range=all|today|7d|30d`를 명시하는 것이다.
4. `All dates`를 클릭했을 때 URL과 활성 필터가 모두 `range=all`이어야 한다.
5. 큐, 기간, age, SLA, sort, customer/search 조건을 하나의 query builder로 조합해 분기형 문자열 조립을 줄인다.
6. 큐나 기간 등 결과 범위를 바꾸는 필터를 클릭하면 `page`를 1로 초기화한다.
7. 유지해야 할 다른 필터는 보존한다. 단, 새 큐에서 유효하지 않은 SLA 조건은 명시적으로 제거한다.
8. `Clear filters`는 Queue 세그먼트 안에서 제거하고 별도의 `Reset` 액션으로 배치한다.

### P0. 환불 큐를 배타적 operational stage 계약으로 수정

현재 `review=requested`가 원시 `status=REQUESTED`만 검사해 `STATE_MISMATCH` 행까지 포함하는 문제를 해결하라.

목표 큐 계약:

- `awaiting decision`: REQUESTED 상태이면서 state mismatch가 아닌 건
- `payment processing`: 처리 상태이면서 state mismatch가 아닌 건
- `state mismatch`: 기존 mismatch 조건에 해당하는 건
- `closed`: COMPLETED이면서 state mismatch가 아닌 건
- `rejected`: 필요하다면 기록 전용 단계로 유지
- `open`: CLOSED/REJECTED가 아닌 모든 실제 운영 작업의 상위 합집합. 완료 상태로 저장됐어도 operational stage가 mismatch이면 open 작업에 포함할지 일관된 정책을 정하고 테스트한다.
- `all`: 모든 환불 기록

구현 시 주의사항:

1. 브라우저에서 상태를 다시 추측하지 않는다.
2. API의 list filter, summary count, read model이 동일한 helper/조건 계약을 사용하게 한다.
3. 각 하위 큐는 서로 배타적이어야 한다.
4. 상위 `open` 카운트가 하위 open workstream 합계로 설명 가능해야 한다.
5. `requested`, `processing`, `completed` 필터 결과에 `STATE_MISMATCH`가 섞이지 않게 API 테스트를 추가한다.
6. 기존 maker-checker 승인 동작과 환불 상태 전이 mutation은 변경하지 않는다.

### P0. 깨진 교차 페이지 링크 수정

1. 환불 행의 결제 링크를 `/payments#payment-{id}`에서 필터와 무관한 `/payments/{paymentId}` 상세 경로로 변경한다.
2. 예약은 기존 `/bookings/{bookingId}` 상세 경로를 유지한다.
3. `Awaiting decision` 행의 주요 CTA는 실제 Approval Queue의 Refunds view로 연결한다.
4. 가능하면 안정적인 row anchor 또는 기존 focus query pattern을 재사용해 해당 환불 요청에 포커스한다.
5. 기존에 안전한 focus 계약이 없다면 최소한 `/finance-tax/approval-queue?view=refunds`로 연결하고, 새로운 승인 mutation이나 임의의 request selection 계약을 만들지 않는다.
6. `State mismatch` 행은 현재 프로젝트에 존재하는 실제 reconciliation/repair 경로를 조사한 뒤 연결한다.
7. 직접 수리 경로가 없다면 존재하지 않는 mutation을 만들지 말고 결제 상세·예약 상세·기존 Settlement Repair 진입점으로 안전하게 연결한다.
8. Approval Queue의 환불 행에도 `/refunds#refund-{id}` 또는 더 안정적인 상세/focus 역링크를 제공한다.

### P0. 빈 상태가 전체 백로그를 숨기지 않게 수정

필터 결과가 0건이더라도 전체 기간 open 백로그가 있으면 다음을 표시한다.

- 현재 조건에서 0건이라는 정확한 문장
- 전체 기간 open 건수
- `View all open refunds` CTA

예시:

```text
No open refunds were created today.
112 refunds are still open across all dates.
[View all open refunds]
```

문장 중간이 소문자로 시작하는 현재 오류도 수정한다.

### P1. 상단 운영 명령 영역 개선

기존 디자인 시스템을 사용해 작은 command/risk strip을 제공한다.

필수 항목:

- Approval required
- Gateway processing
- Reconciliation required
- SLA overdue
- oldest open age 또는 oldest timestamp
- API `generatedAt` 기반 Updated time
- Refresh
- Open Approval Queue

규칙:

1. 카운트는 exclusive queue 계약에서 계산한다.
2. 카드가 과도하게 커지지 않게 한 줄 또는 작은 compact strip으로 구성한다.
3. 0건 큐도 운영상 필요한 경우 작은 중립 상태로 유지하되 시각적 강조는 줄인다.
4. 현재 사용되지 않는 `RefundCommandBoardSection`을 이 목적에 맞게 통합할 수 있는지 조사한다.
5. 통합하지 않는다면 관련 dead component와 테스트를 안전하게 제거한다. 사용자 변경과 겹치면 삭제하지 말고 최종 보고에 남긴다.

### P1. 필터 구성 개선

1440px 이상에서 다음 계층을 목표로 한다.

1. 기본 툴바 한 줄:
   - 통합 검색
   - Queue
   - Range
   - Sort
   - More filters
   - Reset
2. 검색 대상:
   - refund ID
   - booking ID
   - payment ID
   - customer name
   - customer phone
3. 검색은 서버 필터로 구현하고 페이지네이션·summary와 동일한 where 조건을 사용한다.
4. 검색어를 URL에 보존하고 필터 변경 시 page를 1로 초기화한다.
5. 고급 필터가 접혀도 활성 필터 칩은 보여준다.
6. `All dates`가 기본 상태라는 이유만으로 고급 필터가 자동으로 열리지 않게 한다.
7. `Advanced filters` 설명에는 실제 렌더링되는 항목만 표시한다. open 큐가 아닐 때 SLA가 없다면 SLA 문구도 제거한다.
8. `Showing 10 of 112`와 `112 refunds` 같은 중복 카운트는 하나로 정리한다.
9. 현재 모든 항목이 `24h+`에 몰리는 문제를 해결할 수 있도록 age bucket을 운영적으로 구분한다.
   - 예: `0-1h`, `1-4h`, `4-24h`, `1-3d`, `3-7d`, `7d+`
10. age bucket 계약은 프론트만 바꾸지 말고 API summary/list와 함께 변경하고 테스트한다.

### P1. 테이블을 운영자 판단 중심으로 재구성

권장 열 구조:

1. `Case`: operational stage, age, created time, refund ID
2. `Customer / Booking`: customer, booking ID/status, booking link
3. `Money`: amount, payment method/status, payment detail link
4. `Reason`: reason과 source
5. `Evidence`: 실제 증빙 완성도와 blocker 요약
6. `Workstream / Assigned to`: 정적 workstream과 실제 담당자를 구분
7. `Action`: 단계별 주요 CTA 하나와 보조 링크

규칙:

- 실제 배정 데이터가 없다면 `Owner`를 `Workstream`으로 바꾼다.
- `Evidence` 열에 workflow stage를 넣지 않는다.
- 상태, 금액, 주요 CTA가 행을 빠르게 스캔할 수 있게 열 너비와 줄바꿈을 명시한다.
- 고객 프로필 ID가 응답에 있다면 고객 상세 링크를 제공한다. 없다면 ID를 만들어내지 않는다.
- 기본 페이지 크기는 현재 성능과 표 높이를 확인한 뒤 10 또는 25 중 결정한다. 25로 늘리기 전에 성능을 검증한다.

### P1. `Decision evidence` 펼침 구조 교체

현재 마지막 `td` 안에서 펼쳐지는 네 개 stage card 구조를 제거한다.

우선순위:

1. 프로젝트에 재사용 가능한 drawer/side panel이 있으면 우측 480~560px 검토 패널을 사용한다.
2. 안전한 공용 drawer가 없으면 선택 행 아래에 `colSpan` 전체 폭 상세 행을 사용한다.
3. 새로운 UI 라이브러리는 추가하지 않는다.

패널/상세 행 요구사항:

- 선택한 환불의 ID, 상태, 금액, 고객, 예약, 결제 맥락 고정
- `Review checklist` 표시
- 실제 API에 존재하는 증빙만 표시
- 요청자/요청 시각, 승인자/결과, provider reference, callback, audit event가 실제 응답에 있을 때만 `Decision evidence` 또는 `Audit` 영역으로 표시
- blocker 수와 완료된 check 수 요약
- 단계별 주요 CTA
- 닫은 뒤 목록 스크롤과 선택 상태 보존
- 키보드 포커스 진입·복귀와 Escape 닫기 지원

### P1. 페이지네이션 오류 수정

`page=999`처럼 범위를 벗어난 페이지에서 API skip과 화면 active page가 어긋나지 않게 한다.

다음 중 현재 구조에 가장 작은 변경을 선택하라.

1. total count를 확인한 뒤 유효 page로 canonical redirect
2. rows와 total을 하나의 paginated API 응답으로 반환
3. API가 유효 page를 정규화해 반환

필수 테스트:

- page가 전체 페이지보다 큼
- 필터 변경 후 기존 page가 남아 있음
- 마지막 페이지의 데이터가 삭제되어 page가 줄어듦
- page size 변경

### P1. 다크 모드와 문구 개선

1. 다크 모드 sidebar 비활성 메뉴, muted text, 상단 icon button의 대비를 확인하고 WCAG AA 수준으로 개선한다.
2. 색상뿐 아니라 텍스트로 상태를 계속 전달한다.
3. 권장 문구:

| 현재 | 권장 |
|---|---|
| Refunds | Refund Control Center 또는 기존 IA를 고려한 Refund Operations |
| Refund operation filters | Refund queue |
| Refund operations | Cases |
| Clear filters | Reset |
| Awaiting decision | Approval required |
| Payment processing | Gateway processing |
| State mismatch | Reconciliation required |
| Owner | Workstream 또는 Assigned to |
| Decision evidence | Review checklist |
| Closed refunds - closed refund cases. | Closed refunds - completed and reconciled refund records. |

사이드바 정보 구조와 현재 프로젝트 용어 일관성을 확인한 뒤 최종 제목을 결정한다. 페이지 하나만 독자적인 명명법으로 바꾸지 않는다.

### P2. 성능 개선

먼저 현재 API 호출과 DB 집계 수를 코드로 확인하고 가능하면 동일 조건에서 전후 시간을 측정하라.

현재 감사에서 확인된 사항:

- 첫 route ready 약 3.23초
- warm transition 약 0.68~0.69초
- `refundSummary()`가 비-open 큐 최소 14개, open 큐 최소 15개의 DB 집계 작업을 수행할 수 있음
- `/refunds` UI는 전체 summary 필드 중 일부만 사용함

개선 요구사항:

1. `/refunds` 전용 경량 queue meta 응답을 검토한다.
2. 필요한 필드:
   - selected total
   - exclusive queue counts
   - age bucket counts
   - SLA overdue
   - oldest open
   - generatedAt
3. 가능한 count는 제한된 groupBy 또는 PostgreSQL aggregate/filter로 합친다.
4. Prisma raw SQL을 사용한다면 타입 안전성, 파라미터 바인딩, 테스트를 반드시 추가한다.
5. 기존 `Refund(status, createdAt)` 인덱스를 먼저 활용한다.
6. 새로운 인덱스나 migration은 `EXPLAIN (ANALYZE, BUFFERS)` 증거 없이 추가하지 않는다.
7. 승인·거절·환불 상태 변경 직후 stale summary가 남지 않게 revalidation 계약을 유지한다.
8. 캐시를 도입한다면 짧고 명시적인 TTL과 mutation 기반 invalidation을 함께 구현한다.
9. `apps/admin_web/app/refunds/loading.tsx`를 추가해 로딩 중 제목이 `Shift Command`가 아니라 `Refunds`로 유지되게 한다.

성능 목표:

- warm filter transition p95 800ms 이하
- refund list API p95 300ms 이하
- queue meta API p95 300ms 이하
- cold route ready 1.5초 이하

로컬 환경과 데이터 특성 때문에 목표를 입증하지 못하면 측정값과 병목을 정직하게 보고하고 과장하지 않는다.

## 유지해야 하는 기존 장점

다음 동작은 퇴행시키지 않는다.

- Admin 디자인 시스템과 navigation 위치
- API가 소유하는 `operationalStage`, `stateMismatchReason`, `nextAction`, workstream 계약
- 서버 페이지네이션과 서버 필터링
- 목록과 summary 중 하나가 실패해도 성공한 영역은 유지하는 부분 실패 처리
- 예약 상세 링크
- 상태를 색상과 텍스트로 함께 전달하는 접근성
- maker-checker 환불 승인·거절 보호
- 실제 결제·예약·감사 기록을 보존하는 정책

## 테스트 요구사항

기존 테스트를 단순히 통과시키기 위해 현재의 잘못된 기대값을 유지하지 않는다. 제품 계약을 수정하고 테스트 기대값도 함께 수정한다.

최소 회귀 테스트:

1. `/refunds` 기본 진입은 `range=all`, `review=open`, `sort=oldest`를 요청한다.
2. `All dates` 링크와 active chip이 모두 `range=all`이다.
3. Queue × Range 조합이 유효한 age/SLA/sort/search/customer 조건을 보존한다.
4. 결과 범위가 바뀌면 page가 1로 초기화된다.
5. `Awaiting decision`에 `STATE_MISMATCH`가 없다.
6. `Payment processing`에 mismatch가 없다.
7. `Closed`에 mismatch가 없다.
8. exclusive queue counts와 open 합계가 설명 가능하다.
9. `Open payment`가 `/payments/[id]`를 연다.
10. decision CTA가 Approval Queue Refunds view를 연다.
11. 0건인 Today 화면에서 전체 open backlog CTA가 나타난다.
12. checklist를 열어도 행 마지막 셀 안에서 세로로 폭발하지 않는다.
13. `page=999`가 올바르게 정규화된다.
14. summary 실패와 list 실패가 각각 독립된 오류 상태를 유지한다.
15. Refunds 전용 loading UI가 `Refunds` 제목을 사용한다.
16. 검색이 ID, 고객명, 전화번호와 페이지네이션/summary에 일관되게 적용된다.

우선 실행할 focused test 예시:

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- --run app/refunds/page.spec.tsx app/refunds/refund-filter-board-section.spec.tsx app/refunds/refunds-table-section.spec.tsx
npm.cmd run test --workspace @massage-vn/api -- --run src/admin/admin.service.spec.ts -t "refund"
```

실제 테스트 이름과 workspace script를 확인하고 가장 작은 관련 테스트부터 실행하라.

구현이 안정되면 최소한 다음 scope 검증을 실행하라.

```powershell
npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api
```

보호 영역을 수정했거나 결제·환불 상태 전이 동작이 바뀌었다면 `AGENTS.md`의 full local verification도 실행한다. 실행하지 못한 검증은 이유와 함께 `skipped`로 보고한다.

## 브라우저 검증 요구사항

로그인된 관리자 화면을 사용해 1440px 이상에서 실제로 확인한다. 1024px 이하 화면은 이번 보고에 포함하지 않는다.

검증 URL:

- `/refunds`
- `/refunds?range=all&review=open&sort=oldest`
- `/refunds?range=all&review=requested`
- `/refunds?range=all&review=processing`
- `/refunds?range=all&review=state-mismatch`
- `/refunds?range=all&review=completed`
- `/refunds?range=today&review=open`
- 범위를 벗어난 page URL
- 검색 결과 있음/없음
- `/payments/{paymentId}` 교차 링크
- `/finance-tax/approval-queue?view=refunds` 교차 링크

검증 항목:

1. 기본 화면에서 전체 백로그와 가장 오래된 작업을 바로 알 수 있는가
2. 큐 카운트와 실제 행 단계가 일치하는가
3. `All dates`를 클릭해도 Today로 되돌아가지 않는가
4. Reset이 Queue 옵션으로 보이지 않는가
5. 기본 화면에서 테이블이 과도하게 아래로 밀리지 않는가
6. 각 행에 단계별 주요 CTA가 하나만 명확하게 보이는가
7. 결제 링크가 실제 대상 상세를 여는가
8. Approval Queue와의 왕복 경로가 동작하는가
9. checklist/drawer가 테이블 비교를 방해하지 않는가
10. 다크 모드에서 sidebar, muted text, badge, buttons가 읽히는가
11. 키보드 포커스, Escape 닫기, 포커스 복귀가 동작하는가
12. 로딩 중 페이지 제목이 Refunds로 유지되는가

변경 전후 같은 viewport에서 스크린샷을 저장하고 시각적으로 비교하라.

## 완료 조건

다음 조건을 모두 만족해야 완료로 보고한다.

- 기본 화면이 전체 미처리 백로그를 숨기지 않는다.
- `All dates`가 실제로 동작한다.
- 운영 큐가 배타적으로 분류된다.
- 결제·승인·수리 경로가 실제 화면으로 연결된다.
- 빈 상태가 현재 조건과 전체 백로그를 구분한다.
- evidence/checklist를 열어도 테이블 레이아웃이 무너지지 않는다.
- 필터와 검색이 URL, list, summary, pagination에서 일관된다.
- invalid page가 정규화된다.
- Refunds 전용 loading 상태가 있다.
- 관련 focused tests가 통과한다.
- admin/api scope 검증 결과가 보고된다.
- 사용자 변경을 훼손하지 않는다.

## 최종 보고 형식

작업 완료 후 다음 순서로 보고하라.

1. 결과 요약
2. 변경한 파일 목록과 각 파일의 역할
3. P0/P1/P2별 구현 내용
4. 수정된 상태·URL·큐 계약
5. 브라우저 검증 결과와 before/after 스크린샷 경로
6. 실행한 명령과 pass/fail/skipped 결과
7. 보호 영역 수정 여부
8. 성능 전후 측정값
9. 남은 위험이나 의도적으로 보류한 항목
10. 다음 한 가지 권장 작업

성공하지 않은 검증을 성공했다고 표현하지 말고, 실제 확인한 근거만 보고하라.

---

## 핵심 판단 기준 요약

이 작업은 “보기 좋은 환불 목록”을 만드는 일이 아니라 다음 질문에 운영자가 5초 안에 답할 수 있게 만드는 일이다.

1. 지금 처리해야 할 환불은 몇 건인가?
2. 가장 오래된 건은 무엇인가?
3. 승인, 게이트웨이 처리, 상태 불일치 중 어느 단계인가?
4. 내가 지금 눌러야 할 정확한 다음 행동은 무엇인가?
5. 예약·결제·감사 증빙이 충분한가?

이 다섯 질문에 화면과 코드 계약이 동일한 답을 제공하도록 구현하라.
