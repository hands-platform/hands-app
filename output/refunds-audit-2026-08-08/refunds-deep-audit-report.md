# HANDS Admin `/refunds` 심층 운영 UX·코드 감사 보고서

- 감사일: 2026-08-08
- 감사 대상: `http://localhost:3101/refunds`
- 화면 기준: 1692 × 1272, 1440px 이상 데스크톱 운영 환경
- 제외 범위: 1024px 이하 반응형 화면
- 검수 방식: 로그인된 실제 화면, 큐·필터·다크 모드·교차 페이지 흐름, React/Next.js 구현, API 분류 계약, Prisma 인덱스, 관련 테스트를 교차검증
- 앱 소스 수정: 없음. 이 보고서와 감사 스크린샷만 생성함.

## 1. 최종 판정

현재 화면은 외형과 기본 테이블 구조는 정돈됐지만, 운영자가 실제로 사용하기에는 **중요한 상태·기간·행동 경로가 잘못 연결된 조건부 사용 단계**다.

**종합 점수: 52 / 100 — C등급, 핵심 운영 오류 수정 전 정식 운영 비권장**

| 항목 | 점수 | 판정 |
|---|---:|---|
| 시각적 정돈과 일관성 | 72 | 기본 카드·표·상태 배지는 일관됨 |
| 운영자 첫 판단 지원 | 38 | 기본 진입에서 112건 백로그가 0건으로 보임 |
| 큐 분류 정확성 | 32 | `Awaiting decision`에 `State mismatch` 109건이 섞임 |
| 실제 업무 완료 가능성 | 39 | 승인·거절·정합성 수리로 이어지는 CTA가 없음 |
| 필터와 탐색성 | 55 | 기간·연령·정렬은 있으나 `All dates`가 실제로 작동하지 않음 |
| 증빙 검토 경험 | 43 | 규칙 설명은 있으나 실제 증빙이 아니며 펼침 레이아웃이 무너짐 |
| 접근성과 상태 전달 | 68 | 의미 구조는 양호하나 다크 모드 대비와 문구 문제가 남음 |
| 성능과 로딩 피드백 | 47 | 첫 전환 3.23초 관측, 요약 API가 과도한 DB 집계를 수행함 |
| 테스트 신뢰도 | 62 | 관련 테스트는 통과하지만 잘못된 기본값을 정답으로 고정함 |

### 현재 데이터가 보여주는 실제 운영 상태

| 화면/큐 | 현재 관측 결과 |
|---|---:|
| 기본 `/refunds` | 오늘 생성된 미처리 0건 |
| 전체 기간 `Open cases` | 112건 |
| 전체 기간 `Awaiting decision` | 112건 |
| 전체 기간 `State mismatch` | 109건 |
| 전체 기간 `Payment processing` | 0건 |
| 전체 기간 `Closed refunds` | 39건 |
| 전체 기록 | 151건 |
| 전체 기간 Open SLA | 112건 모두 4시간 초과, 모두 24시간 초과 |

화면상 `Awaiting decision`의 첫 3건 뒤로 `State mismatch` 행이 이어진다. 즉 실제 의사결정 후보는 3건으로 보이지만, 원시 환불 상태가 `REQUESTED`인 상태 불일치 109건까지 같은 큐에 포함되어 112건으로 표시된다.

## 2. 잘된 부분

1. 사이드바에서 `Finance Operations > Refunds`의 위치와 현재 선택 상태가 명확하다.
2. 환불 행에 예약, 결제, 금액, 사유, 작업 신호, 담당 업무 영역을 한 번에 보여주려는 방향은 적절하다.
3. 상태 불일치 판단을 브라우저에서 재계산하지 않고 API의 `operationalStage`, `stateMismatchReason`, `nextAction`, `assignee` 계약으로 받는 구조는 바람직하다.
4. 환불 목록과 요약을 병렬로 가져오며, 한 소스가 실패해도 다른 소스는 유지하는 부분 실패 처리가 구현되어 있다.
5. 서버 페이지네이션, 연령 필터, SLA 필터, 정렬 기반이 이미 있어 전면 재작성은 필요하지 않다.
6. 상태는 색상뿐 아니라 `Awaiting decision`, `State mismatch`, `Closed` 같은 텍스트로도 전달된다.
7. 관련 프론트엔드 테스트 23개와 API 테스트 5개가 모두 통과했다. 다만 현재 테스트는 일부 잘못된 운영 계약도 그대로 고정하고 있다.

## 3. 최우선 수정 사항

### P0-1. 기본 화면이 실제 백로그를 “0건”으로 숨긴다

**관측**

- `/refunds` 기본 진입은 `Today + Open cases`이고 화면에는 `Showing 0 of 0`, `0 refunds`가 표시된다.
- 같은 시점에 `?range=all&review=open`으로 들어가면 112건이 보이고, 전부 4시간 및 24시간 SLA를 초과했다.

**코드 원인**

- `DEFAULT_REFUND_REVIEW = 'open'`과 함께, `range`가 없으면 `today`로 해석한다: `apps/admin_web/app/refunds/page.tsx:33`, `:212-228`.
- 프론트 테스트가 이 동작을 명시적으로 정답으로 고정한다: `apps/admin_web/app/refunds/page.spec.tsx:33-63`.

**운영 위험**

- 운영자는 “현재 처리할 환불이 없음”으로 판단하고 112건의 누적 백로그를 놓칠 수 있다.
- 특히 환불은 생성일이 오늘인지보다 아직 열려 있는지가 중요하므로, 생성일 기준 기본 범위가 업무 우선순위를 왜곡한다.

**수정 방법**

- 기본 진입을 `range=all&review=open&sort=oldest`로 변경한다.
- 헤더에 `112 open · 112 overdue · oldest 43d`처럼 전체 백로그와 최장 대기시간을 먼저 보여준다.
- “오늘 생성”은 별도 보조 범위로 유지한다.
- 오늘 0건인 빈 상태라면 반드시 `오늘 생성된 미처리 환불은 없습니다. 전체 미처리 112건 보기`를 제공한다.

### P0-2. `All dates`가 실제로는 다시 `Today`로 돌아간다

**관측**

- `All dates`를 클릭하면 URL이 `/refunds?review=open`이 된다.
- 이 URL을 페이지가 다시 `Today (Vietnam)`으로 해석한다.
- `range=all`을 주소에 직접 넣었을 때만 112건이 표시된다.

**코드 원인**

- `All dates` 링크는 `range=all`을 쓰지 않는다: `page.tsx:277-283`.
- `withRefundRange()`와 `refundHref()`도 `all`이면 `range`를 제거한다: `page.tsx:286-292`, `:329-349`.
- 반대로 파라미터가 없으면 `today`로 읽는다: `page.tsx:225`.

**수정 방법**

- 기본값과 canonical URL 규칙을 하나로 통일한다.
- 가장 안전한 방식은 모든 기간 링크에 `range=all|today|7d|30d`를 항상 명시하는 것이다.
- 큐, 기간, 연령, SLA, 정렬, 고객 필터를 모두 하나의 `URLSearchParams` 빌더로 관리한다.
- 큐나 기간을 바꿀 때 `page`는 1로 초기화하고, 나머지 유효 필터는 보존한다.
- `All dates`와 모든 큐의 조합을 실제 페이지 렌더링까지 검증하는 회귀 테스트를 추가한다.

### P0-3. `Awaiting decision` 큐가 작업 단계와 원시 상태를 혼용한다

**관측**

- `Awaiting decision`: 112건
- `State mismatch`: 109건
- `Awaiting decision` 목록에서 첫 3건 다음 행부터 `State mismatch`가 표시된다.

**코드 원인**

- 목록 필터는 `review=requested`를 단순히 `status: 'REQUESTED'`로 변환한다: `apps/api/src/admin/admin.service.ts:42352-42369`.
- 읽기 모델은 상태 불일치를 `REQUESTED`보다 우선해 `STATE_MISMATCH`로 분류한다: `admin.service.ts:42399-42411`.
- 화면의 큐 이름은 읽기 모델 단계처럼 보이지만, 실제 필터는 저장 상태라서 두 계약이 어긋난다.
- 프론트 테스트는 `requested` API 응답에 `STATE_MISMATCH` 행을 넣고도 정상 렌더링을 기대한다: `apps/admin_web/app/refunds/page.spec.tsx:86-156`.

**수정 방법**

- 운영 큐는 서로 배타적인 `operationalStage` 계약으로 필터링한다.
- `Awaiting decision`: `status=REQUESTED AND NOT stateMismatch`.
- `Payment processing`: 처리 중 상태이면서 `NOT stateMismatch`.
- `Closed`: `status=COMPLETED AND NOT stateMismatch`.
- `State mismatch`: 기존 mismatch 조건 전용.
- `Open cases`: 위의 미종결 작업 단계를 합친 상위 큐로 유지한다.
- 요약 카운트도 동일한 배타적 조건을 사용해 큐 합계가 설명 가능해야 한다.

### P0-4. 환불 행의 `Open payment` 링크가 과거 결제를 열지 못한다

**관측**

- 상태 불일치 행의 `Open payment`는 `/payments#payment-{id}`로 이동한다.
- 결제 페이지 기본값은 `Today + Needs action`이라 과거 환불 결제가 목록에 없고, 해시 대상도 찾지 못한다.
- 실제 검수에서는 링크 이동 후 결제 화면이 0건으로 나타났고 대상 결제 ID가 DOM에 없었다.

**코드 원인**

- 환불 테이블 링크 생성: `apps/admin_web/app/refunds/page.tsx:153`.
- 결제 페이지 기본 필터: `apps/admin_web/app/payments/payment-page-model.ts:67`, `:128-140`.
- 프로젝트에는 `/payments/[id]` 상세 경로가 이미 존재한다.

**수정 방법**

- `paymentHref`를 `/payments/${refund.paymentId}`로 변경한다.
- 예약 링크처럼 결제도 필터와 무관한 상세 경로로 연결한다.
- “환불 → 결제 상세 → 환불로 돌아가기” 왕복 링크와 대상 ID 보존을 검증한다.

### P0-5. “다음 행동”이 실제 행동 페이지로 이어지지 않는다

**관측**

- `Awaiting decision` 행은 “Review evidence and approve or reject”라고 안내하지만 승인·거절 버튼이나 Approval Queue 링크가 없다.
- `State mismatch` 행은 정합성 복구를 지시하지만 수리 워크플로로 이동하는 CTA가 없다.

**현재 중복 구조**

- 실제 승인과 거절은 `/finance-tax/approval-queue?view=refunds`에서 수행한다.
- `/refunds`는 같은 환불 요청을 다시 나열하지만 실행 경로를 제공하지 않는다.

**권장 경계**

- `/refunds`: 환불 생명주기 모니터링, 상태 정합성, 증빙 조회, 재무 인계.
- `/finance-tax/approval-queue?view=refunds`: maker-checker 기반 승인·거절 실행.
- `/payments/[id]`: 결제·게이트웨이 증빙 상세.
- `/bookings/[id]`: 서비스·고객·파트너·채팅 맥락.
- Settlement Repair: 상태 불일치 수리 실행.

**수정 방법**

- `Awaiting decision` 탭을 Approval Queue로 이동시키는 교차 링크로 바꾸거나, 각 행에 `Review in Approval Queue`를 주요 CTA로 둔다.
- `State mismatch` 행에는 `Open reconciliation` 또는 `Create repair case`를 주요 CTA로 둔다.
- 현재 단계별로 하나의 주요 행동만 강조하고 예약/결제 열기는 보조 링크로 둔다.

## 4. 중요한 UX·정보 설계 수정

### P1-1. `Decision evidence`는 실제 증빙이 아니라 생성된 검토 규칙이다

현재 펼침 내용은 예약 상태, 결제 상태, 일반 운영 규칙을 조합한 체크리스트다. 요청자, 승인자, 요청·승인 시각, 게이트웨이 참조, 콜백 결과, 감사 로그 ID 같은 실제 증빙은 없다.

**권장**

- 현재 내용을 `Review checklist`로 이름을 바꾼다.
- 실제 `Decision evidence`에는 요청자/시각, 요청 사유, maker/approver, 승인·거절 결과, 결제 provider reference, callback confirmation, audit event를 보여준다.
- 증빙 완성도를 `3/5 complete`, `1 blocker`처럼 행에 요약한다.

### P1-2. 증빙 펼침이 테이블 한 행의 높이와 비교 가능성을 무너뜨린다

`AdminDisclosure`가 마지막 `td` 안에 있고 네 개의 `AdminStageItem`을 세로로 렌더링한다: `apps/admin_web/app/refunds/refunds-table-section.tsx:93-113`.

공용 CSS의 stage item은 `90px + content + action` 3열 그리드라 좁은 마지막 열에서 과도하게 줄바꿈된다: `apps/admin_web/app/globals.css:18457-18505`.

**권장 순서**

1. 가장 권장: 행 클릭 시 우측 480~560px 증빙 드로어를 열고, 목록의 스크롤 위치를 유지한다.
2. 대안: 현재 행 바로 아래에 `colSpan=8`인 전체 폭 상세 행을 렌더링한다.
3. 피해야 할 방식: 좁은 `Next action` 셀 안에서 네 개 카드를 계속 펼치는 방식.

### P1-3. 필터가 첫 화면을 과도하게 차지하며 계층이 뒤섞여 있다

- `Clear filters`가 큐 탭의 첫 번째 항목으로 들어가 큐처럼 보인다.
- `All dates`를 활성화하면 `showAdvancedFilters`가 항상 true라 페이지 이동 때마다 고급 필터가 다시 열리고 표가 아래로 밀린다: `refund-filter-board-section.tsx:69-71`.
- `Advanced filters` 설명에는 항상 SLA가 쓰이지만 SLA 행은 `open` 이외 큐에서 사라진다.
- 상단 `Showing 10 of 112`와 아래 `112 refunds`는 같은 정보를 중복한다.

**권장**

- 기본 작업 범위인 `All dates`, `Open`, `Oldest first`는 고급 필터가 아니라 기본 상태로 취급한다.
- 상단 1줄: 검색, 큐, 기간, 정렬, `More filters`, `Reset`.
- `Reset`은 큐 세그먼트 밖 우측에 둔다.
- 큐 탭에 배타적 카운트를 넣는다: `Decision 3`, `Processing 0`, `Mismatch 109`, `Closed 39`.
- 고급 필터에는 고객, 결제수단, 금액 범위, 원인, 실제 담당자만 넣는다.
- 활성 필터 칩은 접힌 상태에서도 항상 보이게 한다.

### P1-4. 연령 버킷이 현재 백로그를 구분하지 못한다

현재 112건이 모두 `24h+`라 `Under 1h / 1-4h / 4-24h / 24h+`는 실제 우선순위를 제공하지 못한다.

**권장**

- 환불 SLA 4시간을 기준으로 `0-1h`, `1-4h`, `4-24h`, `1-3d`, `3-7d`, `7d+`로 확장한다.
- 기본 정렬은 `Oldest first`로 두고, 오래된 상위 5건을 상단 위험 스트립에 표시한다.

### P1-5. 열 이름과 실제 내용이 맞지 않는다

- `Evidence` 열에는 실제로 workflow stage, booking ID, booking status, 예약 링크가 들어 있다.
- `Owner`는 사람이나 배정 상태가 아니라 `Finance approval`, `Finance reconciliation` 같은 정적 workstream이다.

**권장 열 구조**

| 열 | 표시 내용 |
|---|---|
| Case | 상태, 경과시간, 환불 ID |
| Customer / Booking | 고객, 예약 ID, 예약 상태 |
| Money | 금액, 수단, 결제 상태 |
| Reason | 사유와 소스 |
| Evidence | 실제 증빙 완성도와 blocker |
| Workstream / owner | 업무 영역, 실제 claim 담당자, due time |
| Action | 단계별 주요 CTA 1개 + 보조 메뉴 |

현재 실제 배정 기능을 추가하지 않는다면 `Owner`를 `Workstream`으로 바꾸는 것이 정직하다.

### P1-6. 검색과 집중 필터가 없다

운영자가 전화 문의를 받았을 때 환불 ID, 예약 ID, 결제 ID, 고객명/전화번호로 바로 찾을 수 없다. 151건을 페이지별로 넘기는 방식만 존재한다.

**권장**

- 통합 검색: refund ID, booking ID, payment ID, 고객명, 전화번호.
- 보조 필터: 결제수단, 환불 원인, source, workstream/claimed owner.
- 결과가 0건이면 현재 필터와 전체 범위를 비교하고 `전체에서 검색`을 제공한다.

### P1-7. 페이지 번호가 범위를 초과할 때 표시와 요청이 어긋날 수 있다

API 요청의 `skip`은 원래 URL의 page로 먼저 계산하고, 이후 화면 페이지 번호만 summary의 total page로 줄인다: `page.tsx:231-248`, `:370-389`.

예를 들어 `page=999`이면 빈 목록을 가져온 뒤 UI는 마지막 페이지 번호처럼 보일 수 있다.

**권장**

- summary로 total page를 확인한 뒤 유효한 page로 canonical redirect하거나, API가 total과 rows를 한 응답으로 반환하게 한다.
- 범위를 넘긴 page, 필터 변경 후 기존 page 유지, 마지막 페이지 삭제 상황을 테스트한다.

## 5. 성능 감사

### 관측 결과

- 고유 쿼리로 3회 전환 측정: 약 `3.23초`, `0.69초`, `0.68초`.
- 첫 전환에서 전역 로딩 UI가 잠시 `Shift Command`로 나타나는 DOM 상태도 관측됐다.
- 전역 로딩 파일은 모든 경로에 `Shift Command` 제목을 고정한다: `apps/admin_web/app/loading.tsx:4`.

### 코드 병목

`RefundsPage`는 목록과 summary를 병렬 요청한다: `page.tsx:46-51`.

하지만 `refundSummary()`는 한 번의 화면 전환에서 다음 작업을 수행한다.

- 8개의 기본 count
- 5개의 age bucket count
- open 큐이면 SLA count 1개
- oldest open aggregate 1개
- SLA 정책 조회 가능성

즉 비-open 큐는 최소 14개, open 큐는 최소 15개의 DB 집계 작업을 유발한다: `apps/api/src/admin/admin.service.ts:14133-14234`.

현재 `/refunds` 필터 UI가 실제로 사용하는 summary 필드는 `totalCount`, `queueAgeCounts`, `queueSla`뿐이다: `page.tsx:65-100`. 나머지 전체 요약 지표는 이 화면에서는 계산만 하고 버린다.

### 수정 우선순위

1. `/refunds` 전용 경량 queue meta 응답을 만든다: `totalCount`, exclusive queue counts, age buckets, SLA, oldestAt, generatedAt.
2. 가능한 카운트는 PostgreSQL `FILTER` 기반 단일 집계 또는 제한된 groupBy로 합친다.
3. 현재 존재하는 `Refund(status, createdAt)` 인덱스는 유지한다: `apps/api/prisma/schema.prisma:2367-2382`.
4. 상태 불일치의 relation 조건은 인덱스를 추측해 추가하지 말고 실제 `EXPLAIN (ANALYZE, BUFFERS)`로 검증한다.
5. `apps/admin_web/app/refunds/loading.tsx`를 추가해 제목과 필터 셸이 유지되는 Refunds 전용 skeleton을 제공한다.
6. 변경 이벤트에서 태그를 무효화할 수 있다면 5~10초의 짧은 summary cache를 검토한다. 승인 직후에는 즉시 revalidate해야 한다.

### 성능 합격 기준

- 로컬 warm filter transition p95: 800ms 이하.
- API 목록 p95: 300ms 이하, queue meta p95: 300ms 이하.
- cold route ready: 1.5초 이하.
- 필터 전환 중 페이지 제목과 현재 표가 사라지지 않고 pending 상태만 표시.

## 6. `/refunds`와 Approval Queue를 합쳐야 하는가

**전체 페이지를 합치지는 않는 것이 좋다.** 두 화면은 권한과 위험도가 다르다.

- 환불 현황·정합성·감사 조회는 `/refunds`에 남긴다.
- 돈을 움직이는 승인·거절은 maker-checker 보호가 있는 Approval Queue에 남긴다.

다만 현재처럼 같은 데이터를 별도 페이지에 중복 나열하고 서로 연결하지 않는 구조는 좋지 않다.

**가장 효율적인 구조**

1. `/refunds`의 `Awaiting decision` 카드는 `Approval Queue · Refunds`로 이동하는 링크 역할을 한다.
2. `/refunds` 행에는 실제 상태에 따라 `Review approval`, `Track gateway`, `Repair mismatch`, `Review closeout` 중 하나만 주요 CTA로 표시한다.
3. Approval Queue의 각 환불 행에는 `Open refund record` 역링크를 둔다.
4. 공통 데이터는 하나의 API read model에서 파생하고 화면별로 필요한 필드만 요청한다.

## 7. 권장 목표 화면 구성

### 첫 화면

1. 제목: `Refund Control Center`
2. 보조 문구: `Approve in Approval Queue, reconcile mismatches here, and verify payment closeout.`
3. 우측: `Updated 22:51`, `Refresh`, `Open Approval Queue`
4. 위험 스트립:
   - `Awaiting decision 3`
   - `Payment processing 0`
   - `State mismatch 109`
   - `SLA overdue 112`
5. 필터 툴바:
   - 검색
   - Queue
   - Range
   - Sort
   - More filters
   - Reset
6. 테이블: 기본 `All dates + Open + Oldest first`, 25행, sticky header.

### 빈 상태

잘못된 예:

`No refunds currently match this queue. refunds awaiting a decision or payment completion.`

권장 예:

`오늘 생성된 미처리 환불은 없습니다.`

`전체 기간에는 112건이 열려 있습니다.`

버튼: `View all open refunds`

### 증빙 검토

- 행 안에서 네 개 카드를 펼치지 않는다.
- 우측 드로어 상단에 환불 ID, 단계, 금액, 고객, 예약/결제 링크를 고정한다.
- 탭: `Evidence`, `Timeline`, `Audit`, `Notes`.
- 실제 blocker와 다음 CTA를 하단 sticky footer에 둔다.

## 8. 문구 수정안

| 현재 | 권장 |
|---|---|
| Refunds | Refund Control Center 또는 Refund Operations |
| Refund operation filters | Refund queue |
| Refund operations | Cases |
| Clear filters | Reset |
| Awaiting decision | Approval required |
| Payment processing | Gateway processing |
| State mismatch | Reconciliation required |
| Closed refunds - closed refund cases. | Closed refunds - completed and reconciled refund records. |
| Owner | Workstream 또는 Assigned to |
| Decision evidence | Review checklist; 실제 증빙을 넣은 뒤에만 Decision evidence 사용 |
| No refunds currently match this queue. refunds... | No open refunds were created today. View all open refunds. |

## 9. 코드 정리 사항

다음 두 컴포넌트는 테스트 외 실제 페이지에서 사용되지 않는다.

- `apps/admin_web/app/refunds/refund-command-board-section.tsx`
- `apps/admin_web/app/refunds/refund-decision-checklist-section.tsx`

선택지는 둘 중 하나다.

1. 상단 exclusive queue summary와 실제 증빙 드로어 설계에 맞게 통합한다.
2. 향후 계획이 없다면 컴포넌트와 전용 테스트를 삭제해 죽은 UI 계약을 제거한다.

현재처럼 존재하지만 화면에는 보이지 않는 상태는 유지보수자가 이미 제공되는 기능으로 오인하게 만든다.

## 10. 구현 순서

### 1차 — 운영 오류 차단

1. 기본 `range=all`, `review=open`, `sort=oldest`.
2. `range=all` canonical URL과 모든 링크 보존 규칙 수정.
3. 큐를 배타적 operational stage 조건으로 변경.
4. `Open payment`를 `/payments/[id]`로 변경.
5. Approval Queue와 Settlement Repair CTA 연결.
6. 오늘 0건 빈 상태에서 전체 백로그 경고 제공.

### 2차 — 작업 효율

1. 상단 큐 카운트 스트립.
2. 검색과 고가치 필터.
3. 열 구조 재설계와 실제 assignment/workstream 구분.
4. 증빙 우측 드로어.
5. invalid page canonicalization.

### 3차 — 성능·품질

1. queue meta 경량 API와 집계 쿼리 축소.
2. Refunds 전용 loading skeleton.
3. dark mode 대비 수정.
4. 실제 증빙·감사 로그·타임라인 통합.
5. dead component 정리.

## 11. 필수 회귀 테스트

1. `/refunds` 기본 진입이 전체 미처리 백로그와 가장 오래된 건을 보여준다.
2. `All dates` 클릭 후 URL과 active chip 모두 `range=all`이다.
3. 모든 Queue × Range 조합이 기간, 연령, SLA, 정렬, 고객 필터를 의도대로 보존한다.
4. `Awaiting decision` 결과에는 `STATE_MISMATCH`가 단 한 건도 없다.
5. `Closed` 결과에는 상태 불일치가 없다.
6. 현재 fixture에서 decision 3, mismatch 109처럼 배타적 합계가 설명 가능하다.
7. `Open payment`가 필터 목록이 아니라 `/payments/[id]` 상세를 연다.
8. decision CTA가 Approval Queue의 해당 요청을 연다.
9. evidence를 열어도 목록 행 높이가 늘어나지 않고 드로어에서 검토된다.
10. `page=999`가 유효 마지막 페이지로 redirect되거나 올바른 결과를 반환한다.
11. summary/list 일부 실패 시 성공한 영역은 유지되며 stale/fresh 상태가 표시된다.
12. 다크 모드 sidebar, muted text, badge가 WCAG AA 대비를 만족한다.
13. 로딩 중 제목이 `Refunds`로 유지된다.
14. 키보드만으로 큐, 필터, 행, 증빙 드로어, 닫기, 주요 CTA를 사용할 수 있다.

## 12. 테스트 실행 결과

### Admin Web

```text
Test Files  5 passed (5)
Tests       23 passed (23)
Duration    1.22s
```

실행 대상:

- `app/refunds/page.spec.tsx`
- `app/refunds/refund-filter-board-section.spec.tsx`
- `app/refunds/refunds-table-section.spec.tsx`
- `app/refunds/refund-command-board-section.spec.tsx`
- `app/refunds/refund-decision-checklist-section.spec.tsx`

### API

```text
Test Files  1 passed (1)
Tests       5 passed, 568 skipped
Duration    4.99s
```

실행 대상은 환불 필터, 상태 조합, summary, SLA, overdue subset 관련 테스트다.

**해석:** 테스트 실패는 없지만, 테스트가 현재의 `Today` 기본값과 `requested` 안의 mismatch 허용을 검증하고 있어 제품 요구에 맞게 테스트 계약부터 바꿔야 한다.

## 13. 화면 흐름별 증거

### 1) 기본 진입 — 건강도: 위험

오늘 기준 0건이므로 화면은 깨끗해 보이지만 전체 기간 112건을 숨긴다. 빈 표, `Showing 0 of 0`, `0 refunds`가 중복되고 성공처럼 해석될 가능성이 높다.

![기본 Today Open 큐](C:/dev/massage-on-demand-vn/output/refunds-audit-2026-08-08/01-default-open-queue.jpg)

### 2) 기본 고급 필터 — 건강도: 주의

현재 범위가 `Today (Vietnam)`임을 확인할 수 있다. SLA는 `On time`으로 보이지만 이는 전체 백로그가 아니라 오늘 0건에 대한 판단이다.

![기본 고급 필터](C:/dev/massage-on-demand-vn/output/refunds-audit-2026-08-08/02-advanced-filters-open.jpg)

### 3) 전체 미처리 백로그 — 건강도: 위험

주소에 `range=all`을 직접 명시하자 112건과 `Overdue 112`가 나타난다. 기본 화면과 운영 의미가 완전히 달라진다.

![전체 기간 미처리 백로그](C:/dev/massage-on-demand-vn/output/refunds-audit-2026-08-08/04-open-backlog-all-dates.jpg)

### 4) 상태 불일치 큐 — 건강도: 작업량 명확, 실행성 부족

109건의 상태 불일치를 한눈에 볼 수 있으나 실제 reconciliation 실행 CTA와 실제 담당자/기한이 없다.

![상태 불일치 백로그](C:/dev/massage-on-demand-vn/output/refunds-audit-2026-08-08/05-state-mismatch-backlog.jpg)

### 5) 승인 대기 큐 혼합 — 건강도: 위험

같은 `Awaiting decision` 목록의 첫 3건 뒤부터 `State mismatch`가 연속으로 표시된다. 큐 제목, 카운트, 실제 행 단계가 불일치한다.

![승인 대기와 상태 불일치 혼합](C:/dev/massage-on-demand-vn/output/refunds-audit-2026-08-08/11-awaiting-queue-mixes-mismatch.jpg)

### 6) Decision evidence 펼침 — 건강도: 사용 곤란

마지막 셀 안의 세부 카드가 좁게 줄바꿈되면서 행 전체가 비정상적으로 길어지고 왼쪽에 큰 빈 공간이 생긴다.

![증빙 펼침 레이아웃](C:/dev/massage-on-demand-vn/output/refunds-audit-2026-08-08/06-decision-evidence-expanded.jpg)

### 7) Closed refunds — 건강도: 보통

39건의 완료 기록을 확인할 수 있다. 다만 `Closed` 조건도 operational stage와 배타적으로 맞추고 실제 감사 증빙을 제공해야 한다.

![완료된 환불](C:/dev/massage-on-demand-vn/output/refunds-audit-2026-08-08/09-closed-refunds.jpg)

### 8) 다크 모드 — 건강도: 개선 필요

본문은 판독 가능하지만 사이드바 비활성 메뉴와 상단 액션 아이콘의 대비가 지나치게 낮다.

![다크 모드 환불 화면](C:/dev/massage-on-demand-vn/output/refunds-audit-2026-08-08/10-closed-refunds-dark.jpg)

### 9) `Open payment` 도착 화면 — 건강도: 실패

과거 결제의 해시 링크로 이동했지만 결제 페이지가 기본 `Today + Needs action` 0건을 보여주며 대상 결제를 찾지 못한다.

![환불에서 열린 결제 링크가 빈 목록으로 도착](C:/dev/massage-on-demand-vn/output/refunds-audit-2026-08-08/13-open-payment-link-empty.jpg)

## 14. 최종 결론

이 화면은 디자인을 더 화려하게 만드는 것보다 먼저 **운영 범위와 상태 계약을 바로잡아야 한다.** 가장 큰 문제는 0건처럼 보이는 기본 화면, 작동하지 않는 전체 기간, 겹치는 큐, 끊긴 결제/승인/수리 링크다.

핵심 수정 후에는 현재의 카드·테이블 디자인 시스템을 그대로 유지하면서도 훨씬 신뢰할 수 있는 환불 운영 콘솔로 개선할 수 있다. 우선 `range=all`과 배타적 `operationalStage`를 확정하고, 다음으로 단계별 주요 CTA와 증빙 드로어, 마지막으로 summary 집계 비용을 줄이는 순서가 가장 안전하다.
