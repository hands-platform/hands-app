# Post-match cancellations 개선용 Codex 실행 프롬프트

아래 `MASTER PROMPT` 전체를 새 Codex 작업에 붙여 넣고, 작업 디렉터리를 `C:\dev\massage-on-demand-vn`으로 지정한다. 이 프롬프트는 분석만 다시 하는 용도가 아니라 **코드 수정, 테스트, 실제 브라우저 검증까지 완료**하기 위한 실행 지시서다.

---

## MASTER PROMPT

```text
당신은 `C:\dev\massage-on-demand-vn` 저장소에서 관리자 웹의 Post-match cancellations 운영 화면을 개선한다.

이번 작업의 목적은 화면을 단순히 예쁘게 꾸미는 것이 아니다. 실제 운영자가 다음 질문에 빠르게 답하고 안전하게 처리할 수 있도록 정보 구조, 데이터 기준, 문구, 반응형 레이아웃, 상세 화면 연결을 함께 고친다.

- 지금 반드시 판단해야 하는 건은 무엇인가?
- 가장 오래 기다린 건은 무엇인가?
- 고객과 Partner 중 누가 취소했는가?
- 취소가 매칭 후 몇 분 뒤 발생했는가?
- 돈이 실제로 복원됐는가, 유지됐는가, 아직 미결정인가?
- 자동 결정인가, 관리자가 결정했는가, 과거 데이터라 판별 불가능한가?
- 어떤 증거를 보고 상세 화면에서 최종 판단해야 하는가?

계획이나 추가 보고서만 작성하고 끝내지 말고, 아래 요구사항을 실제 코드로 구현하고 테스트와 브라우저 검증까지 수행하라.

## 1. 먼저 읽을 자료

작업 전에 다음 파일을 반드시 읽고, 감사 결과의 근거와 현재 구현 흐름을 확인하라.

1. 운영자 UX 감사 보고서
   - `C:\dev\massage-on-demand-vn\output\post-match-cancellations-audit-2026-08-05\post-match-cancellations-operator-audit.md`

2. 감사 화면 캡처
   - `01-overview.png`
   - `02-queues-and-review-row.png`
   - `03-needs-review-queue.png`
   - `04-needs-review-table.png`
   - `05-all-cancellations-table.png`
   - `06-no-show-empty-state.png`
   - `07-reason-filter-no-clear.png`
   - `08-detail-decision-panel.png`
   - `09-detail-sla-and-back-link.png`
   - 모두 `C:\dev\massage-on-demand-vn\output\post-match-cancellations-audit-2026-08-05\` 아래에 있다.

3. 저장소 지침
   - 저장소 루트 및 변경 대상 디렉터리의 `AGENTS.md`
   - `package.json`과 각 workspace의 테스트/검증 스크립트

구현 전에 `rg`로 관련 호출부와 테스트를 찾고, 공용 로직을 바꾸는 경우 `/bookings`, `/bookings/completed`, 다른 booking monitor 화면에 미치는 영향도 확인하라. 화면 한 곳의 증상만 덧대지 말고, 실제 원인이 공용 분류·날짜·행 모델에 있으면 그 원인을 한 번만 고쳐라.

## 2. 작업 범위

주요 대상:

- 관리자 목록: `/bookings/post-match-cancellations`
- 취소 상세: `/bookings/[id]` 중 post-match cancellation decision/evidence 영역
- 이를 공급하는 admin API의 목록·요약·필터·정렬 로직

수정 후보 파일은 아래와 같다. 실제 호출 관계를 확인해 필요한 최소 파일만 변경하라.

- `apps/admin_web/app/bookings/booking-monitor-page.tsx`
- `apps/admin_web/app/bookings/booking-monitor-route-load-plan.ts`
- `apps/admin_web/app/bookings/booking-monitor.tsx`
- `apps/admin_web/app/bookings/booking-monitor-options.ts`
- `apps/admin_web/app/bookings/booking-monitor-filters-section.tsx`
- `apps/admin_web/app/bookings/booking-monitor-list-section.tsx`
- `apps/admin_web/app/bookings/booking-monitor-list-row-model.ts`
- `apps/admin_web/app/bookings/booking-monitor-next-action-label.ts`
- `apps/admin_web/app/bookings/booking-empty-message.ts`
- `apps/admin_web/app/bookings/booking-post-match-cancellations-section.tsx`
- `apps/admin_web/app/bookings/booking-post-match-cancellations-model.ts`
- `apps/admin_web/app/bookings/booking-post-match-cancellation-reason.ts`
- `apps/admin_web/app/bookings/booking-monitor-operation-links.ts`
- `apps/admin_web/app/bookings/[id]/booking-command-briefing-sections.tsx`
- `apps/admin_web/app/bookings/[id]/booking-outcome-review-panel.ts`
- `apps/admin_web/app/bookings/[id]/booking-detail-post-match-decision-section.tsx`
- `apps/admin_web/app/globals.css`
- `apps/api/src/admin/admin-booking-list-query.ts`
- `apps/api/src/admin/admin.service.ts`

`apps/api/src/bookings/**`는 보호 범위이므로, 이미 저장되는 사실을 읽는 것만으로 해결할 수 있다면 수정하지 마라. 불가피하게 변경해야 하면 저장소 지침에 따른 전체 검증을 수행하고 이유를 최종 보고에 명시하라.

## 3. 고정 제품 결정

아래 사항은 구현 중 임의로 바꾸지 않는다.

1. 라우트는 `/bookings/post-match-cancellations`를 유지한다.
2. 사용자에게 보이는 문구는 현재 관리자 웹과 동일하게 영어를 사용한다.
3. 관리자 화면에서는 `Provider` 대신 기존 제품 용어인 `Partner`를 사용한다.
4. 페이지 제목은 `Post-match cancellation review`로 한다.
5. 상단의 항상 보이는 작업 탭은 정확히 다음 세 개다.
   - `Needs decision`
   - `All cancellation records`
   - `No-show review`
6. `Needs decision`은 날짜와 무관하게 아직 열려 있는 전체 backlog를 보여준다. 기본값 `today` 같은 숨은 날짜 제한을 두지 않는다.
7. `No-show review`도 실제로 운영자 후속 판단이 필요한 열린 건만 보여주며 숨은 날짜 제한을 두지 않는다.
8. `All cancellation records`는 해결된 이력을 조회하는 화면이며, 사용자에게 보이는 `Decision period` 필터를 사용한다. 기본 기간은 최근 30일이다.
9. post-match cancellation의 시간 기준은 `decisionAt` 하나로 통일한다. 목록 건수, 기간 필터, age 필터, 정렬, 표시 문구가 모두 같은 기준을 사용해야 한다.
10. 목록 화면에서는 증거와 금액을 보고 상세로 들어가는 것까지만 제공한다. Partner fee 복원/유지 같은 최종 파괴적 결정 버튼은 상세 화면에만 둔다.
11. 새 UI 라이브러리, 새 상태관리 라이브러리, 새 날짜 라이브러리, 새 DB 테이블/컬럼/마이그레이션을 추가하지 않는다. 기존 컴포넌트, 기존 응답 데이터, 기존 metadata/audit 사실을 재사용한다.
12. 고객 앱과 Partner 앱은 수정하지 않는다.
13. 공용 booking monitor를 수정하더라도 다른 booking 목록의 문구, 날짜 범위, 정렬, 행 액션이 회귀하지 않도록 route/view-aware하게 처리한다.

## 4. P0 — 반드시 해결할 문제

### 4.1 열린 backlog에서 숨은 `today` 범위 제거

현재 `manual-decision` 기본 화면은 화면에 날짜 필터를 보여주지 않으면서 내부적으로 `dateRange=today`를 적용할 수 있다. 이 상태에서는 어제 이전에 생성된 미결정 건이 운영자에게 보이지 않는다.

구현 요구:

- `Needs decision` 요청에는 시작일/종료일을 보내지 않는다.
- 검색어, 사유, age 같은 사용자가 직접 선택한 필터는 사용할 수 있지만 숨은 날짜 범위는 없어야 한다.
- 전체 미결정 건수와 목록 쿼리는 동일한 open-decision predicate를 사용한다.
- `All cancellation records`에만 보이는 `Decision period`를 제공하고 기본 30일을 적용한다.
- 기간 필터는 생성일이나 임의의 여러 timestamp OR 조건이 아니라 post-match `decisionAt`을 사용한다.
- 열린 큐의 기본 정렬은 `Decision age: oldest first`다.
- 전체 기록의 기본 정렬은 `Decision time: newest first`다.
- URL query와 브라우저 뒤로가기를 사용해 탭/기간/필터/페이지 상태를 재현할 수 있어야 한다.

테스트에는 오늘 이전에 생성된 미결정 건이 기본 `Needs decision` 결과에 포함되는 사례를 반드시 넣는다.

### 4.2 실제 행위자와 현재 상태에 맞는 다음 행동 문구

현재 Partner가 취소한 행인데 action이 `Review payment outcome / Customer cancelled`처럼 표시될 수 있다. 운영자는 이를 고객 귀책으로 오인할 수 있다.

다음 행동 라벨을 현재 route/view와 해결 상태로 결정하라.

- post-match pending: `Review cancellation decision`
- 자동 또는 관리자 승인으로 Partner fee가 복원됨: `View restored fee record`
- Partner fee가 유지됨: `View held fee record`
- no-show의 미결정 후속 조치: `Review no-show outcome`

추가 조건:

- 취소 주체와 action 주체가 서로 모순되지 않아야 한다.
- 해결된 기록에 `Review`, `Decide`, 위험/경고 스타일처럼 아직 처리해야 한다는 인상을 주지 않는다.
- 상세로 이동하는 링크의 accessible name에도 동일한 의미를 반영한다.
- 다른 booking route에서 기존 next action 의미가 바뀌지 않도록 테스트한다.

### 4.3 자동 결정 통계는 추측하지 말고 실제 사실로 분류

현재 구현처럼 `approved && autoApprovalEligible`, `closedReason` 문자열 부분 일치, earning 상태만으로 자동 승인 수를 계산하지 마라. 자동 승인 가능성과 실제 자동 승인은 다르다.

이미 저장되는 구조화된 사실을 우선 사용한다.

- 실제 자동 처리: `metadata.postMatchCancellation.autoApproved === true` 같은 기존 명시적 사실
- 관리자 처리: 기존 `closedByRole === ADMIN`, canonical admin action/audit 사실
- 결과: 기존 canonical resolution, fee/payment/earning 결과

분류 규칙:

1. `Needs decision`: 아직 최종 결과가 없는 열린 건
2. `Auto-resolved`: 명시적으로 실제 자동 처리가 확인되는 해결 건
3. `Admin approved`: 관리자가 Partner fee 복원을 승인한 건
4. `Admin kept fee`: 관리자가 Partner fee 유지를 결정한 건
5. `Unknown / legacy`: 과거 데이터라 처리 주체를 신뢰성 있게 판별할 수 없는 해결 건

금지 사항:

- metadata가 없다는 이유만으로 자동 처리로 간주하지 않는다.
- `eligible`을 `auto-resolved`로 세지 않는다.
- 자유 텍스트 substring 하나로 최종 source를 확정하지 않는다.
- 판별 불가능한 과거 데이터를 0이나 자동 승인에 섞지 않는다.
- 같은 분류 규칙을 summary와 row model에 중복 구현하지 않는다. 기존 공용 도메인 helper가 있으면 재사용하고, 없으면 현재 범위에서 가장 작은 순수 helper 하나로 공유한다.

화면에서는 지표의 의미와 범위를 짧게 명시한다. 예:

- `Open backlog · all dates`
- `Resolved · selected decision period`
- `Source unavailable in legacy records`

### 4.4 1280px에서 겹치는 레이아웃 수정

현재 1280×720에서 sidebar를 포함하면 operations row의 텍스트와 action이 겹치고, 지표용 3열 표가 전역 booking table 최소 너비를 상속해 과도하게 넓어진다.

구현 요구:

- 지표 요약 영역에 일반 booking list의 큰 `min-width` 클래스를 재사용하지 않는다.
- operations row는 전용 grid 또는 container query를 사용해 실제 content container 폭에 반응하게 한다.
- 필수 정보를 숨기거나 글자를 극단적으로 줄여 해결하지 않는다.
- 좁은 폭에서는 정보 블록을 자연스럽게 세로로 쌓고, action은 별도 줄에 안정적으로 배치한다.
- 긴 ID, 사유, audit text 때문에 인접 열이 침범하지 않도록 `min-width: 0`, wrapping, overflow 기준을 명시한다.
- 1280×720, 1024×768, 1440×900에서 수평 겹침, 잘린 버튼, 본문 전체의 불필요한 가로 스크롤이 없어야 한다.
- 의미 있는 데이터 테이블 자체는 필요하면 내부 scroll region을 유지하되, scroll 대상과 label을 명확히 한다.

### 4.5 목록·상세 SLA와 복귀 경로 일치

현재 목록은 `Target 2h / Overdue`라고 표시하지만 상세는 `SLA Not defined`로 보일 수 있고, 상세 breadcrumb/back 링크는 `Live Bookings`로 돌아간다.

구현 요구:

- post-match cancellation review의 SLA 계산 기준을 목록과 상세가 같은 helper/상수로 사용한다.
- 상세에서 `Not defined`가 나오지 않게 한다.
- SLA 기준이 2시간이면 목록과 상세 모두 같은 `decisionAt` 기준으로 due/overdue를 계산한다.
- 목록에서 상세로 이동할 때 다음 복귀 문맥을 query에 보존한다.
  - source route/view
  - tab
  - page
  - search
  - reason
  - age
  - decision period
  - 가능하면 현재 row anchor
- 상세 breadcrumb와 back link는 `Post-match cancellation review`로 돌아가야 한다.
- 브라우저 back 또는 명시적 back link로 돌아왔을 때 필터, 페이지, 스크롤/행 문맥이 가능한 범위에서 복원되어야 한다.
- 외부에서 상세 URL로 바로 들어온 경우에는 안전한 기본 복귀 경로 `/bookings/post-match-cancellations`를 사용한다.

## 5. P1 — 운영 효율을 위한 정보 구조 개선

### 5.1 첫 화면은 설명이 아니라 작업 큐부터

첫 viewport의 우선순위를 다음처럼 구성한다.

1. 제목과 한 줄 설명
2. 핵심 지표/긴급 신호
3. 세 개의 작업 탭
4. 현재 결과의 필터와 목록
5. 운영 가이드

긴 정적 설명과 metric 해설 표가 작업 목록을 아래로 밀지 않게 한다. 운영 가이드는 기본적으로 접힌 native disclosure(`<details>` 등 기존 패턴)로 제공하고, 열었을 때만 규칙과 예외를 읽을 수 있게 한다.

권장 문구:

- Title: `Post-match cancellation review`
- Description: `Review cancellations after a match, confirm evidence, and decide the Partner fee outcome.`
- Guide summary: `How decisions work`

generic한 `Additional queues`, `Other queues` 섹션은 이 전용 페이지에서 제거한다. 세 핵심 큐는 숨겨진 select가 아니라 항상 보이는 tab/segmented navigation이어야 한다.

### 5.2 탭과 지표의 범위 분리

상단 지표는 운영자가 긴급도와 처리 결과를 이해하는 데 필요한 최소 항목만 둔다.

권장 구성:

- `Needs decision` — 전체 날짜의 현재 열린 backlog
- `Overdue` — 열린 backlog 중 SLA 초과
- `Auto-resolved` — 선택된 decision period 내 실제 자동 해결
- `Admin decisions` — 선택 기간의 승인/fee 유지 합계 또는 두 값을 명확히 분리
- `Unknown / legacy` — source 판별 불가

공간이 부족하면 카드 수를 늘리기보다 의미가 겹치는 숫자를 합치거나 보조 줄로 제공한다. vanity metric은 추가하지 않는다.

검색, reason, age 필터가 바뀌어도 전역 큐 지표 자체가 현재 검색 결과 수로 축소되어서는 안 된다. 다음을 명확히 분리한다.

- queue/global count
- 현재 필터가 적용된 result count

### 5.3 필터를 실제 운영 문법으로 정리

필터 요구:

- 검색
- cancellation reason
- decision age (`Needs decision`/`No-show review`에서만)
- decision period (`All cancellation records`에서만)
- reset filters

사유 필터에는 현재 데이터의 canonical reason과 함께 `Legacy / unknown`을 제공한다. 어떤 필터든 하나 이상 활성화되면 `Reset filters`가 보여야 하며, reason만 적용된 경우에도 반드시 보여야 한다.

`Requested`, `Created age`처럼 실제 기준과 다른 문구를 쓰지 않는다. `decisionAt` 기준이면 UI도 `Decision age`라고 표시한다.

필터 변경 시 page를 1로 되돌리고 URL query와 서버 요청이 일치해야 한다.

### 5.4 행에는 판단에 필요한 증거와 돈을 우선 배치

post-match cancellation 전용 operations row는 다음 정보의 우선순위를 따른다.

식별/상태:

- 충돌하지 않는 짧은 booking ID
- 취소 주체: `Partner cancelled` 또는 실제 actor
- pending/resolved 상태
- 요청/결정 시각과 decision age

사건 증거:

- matched 후 몇 분 뒤 취소됐는지
- cancellation reason
- 관련 chat message count
- cancellation location/좌표 존재 여부 또는 기존 location evidence

금액/결과:

- payment method
- payment status
- payment amount
- Partner fee amount
- fee resolution: pending/restored/held
- SLA 및 assignee가 실제 존재하면 표시

다음 정보는 운영 결정에 직접 필요하지 않으므로 목록의 주요 열에서 제거하거나 상세로 내린다.

- app presence
- participants 나열
- 긴 audit note 원문
- 개발자 중심의 raw metadata

기존 API/detail model에 이미 있는 데이터를 재사용한다. 위 정보를 보여주기 위해 새 DB schema를 만들지 않는다. 데이터가 없으면 거짓 기본값을 표시하지 말고 `Not recorded`처럼 정직한 상태를 사용하되, 반복되는 결측 문구가 화면을 압도하지 않게 한다.

### 5.5 ID는 짧지만 구분 가능하게

UUID 앞 8자만 잘라 표시해 충돌 가능성을 높이지 않는다. 기존 `shortRecordId`나 프로젝트의 식별자 helper가 있으면 재사용하고, 없으면 `prefix…suffix`처럼 눈으로 구분 가능한 최소 표현을 사용한다.

- 전체 ID는 title/accessible description 또는 copy action으로 접근 가능해야 한다.
- 새 copy library를 추가하지 말고 native clipboard와 기존 toast 패턴이 있을 때만 사용한다.

### 5.6 No-show review를 이름뿐인 큐로 두지 않기

현재 `status=NO_SHOW` 전체를 단순히 보여주면서 `pending review`라고 주장하지 않는다.

- 저장소에 기존 no-show review predicate/domain 상태가 있으면 그것을 재사용한다.
- 없다면 현재 데이터로 명확히 확인 가능한 열린 후속 조치만 최소 조건으로 정의한다. 예: 미해결 payment/outcome, 미완료 closeout 또는 기존 운영 task 상태.
- 목록과 summary count는 반드시 동일한 predicate를 사용한다.
- 이미 해결된 no-show는 열린 큐에 포함하지 않는다.
- 판별할 구조화된 사실이 전혀 없다면 억지 heuristic을 만들지 말고, 빈 상태에서 현재 제공 가능한 사실을 정확히 설명하도록 구현한다. 새 DB schema는 이번 범위가 아니다.

### 5.7 이력 화면에서 realtime 오해 제거

`All cancellation records` 같은 과거 이력 화면에서 `Realtime connecting`을 보여주지 않는다. 실제 realtime subscription이 필요한 열린 queue에만 상태를 보여준다.

- 연결 중 상태가 무한히 남지 않아야 한다.
- 연결 상태는 페이지의 핵심 작업보다 시각적으로 강하지 않아야 한다.
- realtime을 제거한 화면도 refresh 시 정확한 서버 데이터를 받는다.

## 6. P2 — 마감 품질

### 6.1 빈 상태

빈 상태는 원인을 구분한다.

- queue 자체가 비어 있음: `No cancellations currently need a decision.`
- 현재 필터 결과가 없음: `No cancellation records match the current filters.` + `Reset filters`
- 검색 결과 없음: 검색어를 포함하되 개인정보를 과도하게 반복하지 않음
- no-show review가 비어 있음: `No no-show cases currently need review.`

필터가 적용된 상태에서 `All clear`처럼 전체 큐가 비었다고 오해할 문구를 쓰지 않는다.

### 6.2 페이지네이션과 page size

- 기본 page size는 25로 한다.
- `totalPages <= 1`이면 불필요한 pagination control을 숨긴다.
- 전체 결과 수와 현재 표시 범위를 명확히 제공한다.
- page query가 범위를 벗어나면 안전하게 유효한 페이지로 보정한다.

### 6.3 중복과 소음 제거

- 자기 자신을 다시 가리키는 중복 title/link를 제거한다.
- 같은 상태를 badge, 본문, action에서 세 번 반복하지 않는다.
- 긴 audit note, presence, participants는 목록을 압도하지 않게 상세에 둔다.
- 색상만으로 pending/overdue/resolved를 구분하지 않는다.

### 6.4 접근성

- tab은 키보드로 이동하고 현재 선택 상태를 보조기기에 전달한다.
- 필터 label과 input/select 연결을 유지한다.
- table/scroll region에 accessible name을 제공한다.
- icon-only 버튼에는 accessible name이 있어야 한다.
- focus indicator를 제거하지 않는다.
- status와 SLA는 색상 외 텍스트로도 전달한다.
- 링크와 버튼의 역할을 혼동하지 않는다.
- loading, error, empty 상태가 보조기기에도 이해 가능해야 한다.

## 7. 상세 화면 개선 기준

기존 상세 화면의 좋은 구조는 유지한다.

- decision panel의 증거 → 금액 → 최종 결정 순서
- anchor 기반 빠른 이동
- 최종 fee 결정은 상세에서만 수행

다음은 수정한다.

1. breadcrumb/back destination을 `Post-match cancellation review`로 교체하고 list return context를 보존한다.
2. 목록과 같은 cancellation review SLA 및 due/overdue 계산을 사용한다.
3. 상세 상단에 취소 actor, matched 후 경과 시간, reason, payment/Partner fee 상태를 빠르게 스캔 가능한 요약으로 제공한다.
4. 결정 버튼 문구가 실제 결과를 명시해야 한다.
   - 예: Partner fee 복원
   - 예: Partner fee 유지
   현재 프로젝트의 검증된 영어 문구와 confirmation pattern을 사용하라.
5. 결정 전 confirmation에는 영향을 받는 금액과 비가역/후속 영향을 명확히 보여준다.
6. 이미 해결된 건에서는 결정 버튼 대신 read-only decision record와 처리 주체/시간을 보여준다.
7. legacy 데이터의 source를 알 수 없으면 추측하지 말고 `Unknown / legacy`로 표시한다.

결정 mutation 자체의 비즈니스 규칙은 이번 UX 작업을 이유로 재작성하지 않는다. 기존 권한, validation, audit 기록, idempotency를 유지한다.

## 8. 구현 원칙

- 새 추상화보다 기존 helper/component를 먼저 찾는다.
- 한 화면만 위한 거대한 범용 프레임워크를 만들지 않는다.
- shared helper 한 곳이 진짜 원인이면 그곳을 수정하고 route-specific 조건을 명시한다.
- client에서 받은 전체 목록을 재필터링해 summary를 꾸미지 않는다. server filtering/pagination을 유지한다.
- summary와 list가 같은 predicate/시간 기준을 사용하게 한다.
- raw string 비교가 필요하면 canonical enum/constant/helper를 우선한다.
- 결측 데이터를 거짓으로 채우지 않는다.
- 기존 전화번호 masking과 개인정보 보호를 유지한다.
- 기존 admin design tokens와 components를 사용한다.
- CSS로 충분한 반응형 문제에 JS viewport listener를 추가하지 않는다.
- 새 dependency와 DB migration은 금지한다.
- unrelated refactor, 파일명 일괄 변경, 스타일 시스템 교체는 하지 않는다.

## 9. 테스트 요구사항

기존 테스트 패턴을 확인하고, 아래 회귀를 잡는 최소한의 집중 테스트를 추가하거나 수정한다.

### Admin web

1. route load plan
   - `Needs decision`에 숨은 날짜 파라미터가 없음
   - `No-show review`에 숨은 날짜 파라미터가 없음
   - `All cancellation records` 기본 decision period 30일
   - 기본 page size 25
   - 탭별 기본 sort가 요구와 일치

2. classification/summary model
   - 명시적 auto-approved metadata → Auto-resolved
   - admin approved → Admin approved
   - admin held fee → Admin kept fee
   - source 결측 legacy → Unknown / legacy
   - eligible만 true인 건은 Auto-resolved가 아님

3. next action
   - Partner cancelled pending → `Review cancellation decision`
   - resolved restored → `View restored fee record`
   - resolved held → `View held fee record`
   - no-show pending → `Review no-show outcome`
   - post-match 행에서 `Customer cancelled` 오표시가 없음
   - 다른 booking route의 기존 action 회귀 없음

4. filters
   - 세 탭 직접 전환
   - reason의 Legacy / unknown
   - reason만 활성화해도 Reset filters 표시
   - reset 시 page 포함 관련 query 정리
   - filter 변경 시 page 1

5. list row
   - 사건 증거와 payment/fee 사실 표시
   - app presence, participants, 긴 audit note가 주요 행에 없음
   - 해결 행이 pending action을 사용하지 않음
   - 전체 ID 접근 가능

6. empty/pagination/realtime
   - queue empty와 filtered empty 문구 구분
   - 한 페이지면 pagination 숨김
   - historical view에는 realtime connecting 없음

7. detail navigation/SLA
   - return context 생성 및 fallback route
   - 목록과 상세 SLA 동일
   - 해결 건 read-only 상태

8. responsive contract
   - 기존 CSS 테스트 패턴이 있으면 전용 class/container query/min-width 규칙을 검증
   - 테스트를 위한 무의미한 snapshot 대량 추가는 하지 않음

### API

1. 오늘 이전 미결정 건이 열린 backlog에 포함됨
2. list와 summary가 동일한 open predicate를 사용함
3. decision period와 age가 `decisionAt` 기준임
4. oldest/newest 정렬이 요구와 일치함
5. actual auto/admin/legacy 분류가 명시적 사실에 기반함
6. legacy NULL metadata/reason이 자동 처리로 오분류되지 않음
7. no-show review list와 count가 같은 review predicate를 사용함
8. search/reason/age 필터가 global queue count를 잘못 축소하지 않음
9. server pagination이 유지됨

금액 및 최종 결정 경로 테스트가 이미 있다면 그대로 통과시켜라. 테스트 통과를 위해 실제 비즈니스 규칙을 느슨하게 만들지 않는다.

## 10. 실행할 검증 명령

Windows PowerShell 기준으로 저장소에 존재하는 실제 스크립트를 먼저 확인한 뒤 다음을 실행한다.

```powershell
npm.cmd run test --workspace @massage-vn/admin-web
npm.cmd run test --workspace @massage-vn/api
npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api
```

보호 경로를 수정했거나 저장소 지침이 요구하면 다음도 실행한다.

```powershell
npm.cmd run verify:local
```

명령 이름이 실제 package script와 다르면 임의로 건너뛰지 말고 `package.json`에서 대응 명령을 찾아 실행한다. 실패가 기존 실패인지 이번 변경 때문인지 분리해 보고한다.

## 11. 실제 브라우저 검증

테스트만 통과하고 끝내지 말고 로그인된 로컬 관리자 웹에서 실제 화면을 확인한다.

대상:

- `http://localhost:3101/bookings/post-match-cancellations`
- 해당 목록에서 진입한 post-match cancellation 상세

최소 viewport:

- 1280×720
- 1024×768
- 1440×900

확인할 상태:

1. 기본 `Needs decision`
2. 오늘 이전 미결정 건이 포함되는 상태 또는 이를 보장하는 fixture/test 증거
3. `All cancellation records` 기본 30일
4. `No-show review`의 실제 열린 건 또는 정확한 empty state
5. reason filter만 적용한 상태와 Reset filters
6. `Legacy / unknown` reason/source 상태
7. 검색 결과 없음
8. SLA 초과 및 oldest-first 상태
9. 자동 해결, 관리자 승인, fee 유지, legacy 행의 서로 다른 문구
10. 목록 → 상세 → back으로 필터/페이지 문맥 복원
11. 상세 SLA가 목록과 일치
12. 세 viewport에서 텍스트/버튼 겹침과 페이지 전체 가로 스크롤 없음

검증 캡처는 다음 새 폴더에 저장한다.

`C:\dev\massage-on-demand-vn\output\post-match-cancellations-improvement-verification-YYYY-MM-DD\`

기존 감사 캡처를 덮어쓰지 않는다. 검증을 위해 운영/공유 데이터에 임의 레코드를 생성하거나 금액 결정을 실행하지 않는다. 필요한 데이터 상태는 테스트 fixture로 검증하고, 실제 브라우저에서는 안전한 read-only 상태만 사용한다.

## 12. 완료 조건

다음을 모두 만족해야 완료다.

- 열린 `Needs decision` backlog에 숨은 날짜 제한이 없다.
- 날짜, count, age, sort가 모두 `decisionAt` 기준으로 일치한다.
- 자동 처리, 관리자 처리, legacy가 추측 없이 구분된다.
- Partner 취소 행에 `Customer cancelled`가 표시되지 않는다.
- 해결된 행은 더 이상 pending review처럼 보이지 않는다.
- 첫 viewport에서 핵심 큐와 긴급도가 먼저 보인다.
- 세 개의 핵심 큐가 항상 직접 선택 가능하다.
- reason-only 상태에서도 Reset filters가 보인다.
- 필터 결과 수와 global queue count가 구분된다.
- 행에서 증거, payment, Partner fee 결과를 판단할 수 있다.
- 1280×720과 1024×768에서 내용이 겹치지 않는다.
- 목록과 상세의 SLA가 일치한다.
- 상세의 breadcrumb/back이 post-match cancellation 목록 문맥으로 돌아간다.
- no-show review가 단순 `NO_SHOW 전체`를 pending으로 오인시키지 않는다.
- historical view에 무의미한 realtime connecting이 없다.
- empty state가 queue empty와 filtered empty를 구분한다.
- 접근성 기본 동작이 유지된다.
- 새 dependency와 DB migration이 없다.
- 다른 booking monitor route에 회귀가 없다.
- 관련 admin/API 테스트와 저장소 검증이 통과한다.

## 13. 최종 보고 형식

작업 완료 후 한국어로 다음 순서만 간결하고 구체적으로 보고한다.

1. 변경 결과 요약
2. 운영자가 체감하는 변화
3. 핵심 데이터 기준
   - open backlog
   - decisionAt
   - auto/admin/legacy 분류
   - no-show review predicate
4. 변경한 파일
5. 실행한 테스트와 결과
6. 브라우저 검증 viewport/상태와 캡처 경로
7. 남은 제약 또는 확인하지 못한 사항

`완료`라고만 쓰지 말고, 각 요구사항이 어떤 코드와 테스트로 충족됐는지 추적 가능하게 작성하라. 반대로 요청 범위 밖의 장기 개선안이나 새 기능은 구현하지 말고 남은 제약에 한 줄로만 기록하라.
```

---

## 사용 방법

1. 새 Codex 작업을 `C:\dev\massage-on-demand-vn`에서 시작한다.
2. 위 `MASTER PROMPT` 전체를 붙여 넣는다.
3. Codex가 계획만 제시하면 다음 문장을 이어서 보낸다.

```text
계획을 승인한다. 보고서만 추가 작성하지 말고 현재 작업에서 코드 수정, 테스트, 브라우저 검증, 검증 캡처 저장까지 완료하라.
```

4. 작업이 끝나면 최종 보고의 테스트 결과와 캡처 폴더를 확인한다.

