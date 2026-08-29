# HANDS Admin Shift Command Remediation Prompt

> 대상: Codex가 `Shift Command` 재감사 결과를 검증하고, 기존 구조를 보호하면서 확정된 문제를 한 건씩 수정하기 위한 실행 프롬프트
>
> 감사 기준: 2026-08-18 ICT (`Asia/Ho_Chi_Minh`)
>
> 대상 페이지: `http://localhost:3101/`

---

## Codex에 전달할 작업 지시

작업 저장소는 다음 하나만 사용한다.

```text
C:\dev\massage-on-demand-vn
```

`C:\dev\massage-vn-workspace`는 HANDS 작업에 사용하지 않는다.

먼저 다음 파일을 완전히 읽고 준수한다.

```text
C:\dev\massage-on-demand-vn\AGENTS.md
C:\dev\.agents\skills\receiving-code-review\SKILL.md
```

사용할 스킬:

- `receiving-code-review`
- UI 변경 검증이 필요할 때 `ui-ux-pro-max`
- 실제 페이지 검증이 필요할 때 `webapp-testing` 또는 `browser:control-in-app-browser`

브라우저 검증 기준:

- `1440px` 이상 데스크톱만 검사한다.
- 필요하면 `1980px`에서도 확인한다.
- `1024px` 이하 화면은 검사·보고·수정 범위에서 제외한다.
- 업무를 변경하는 버튼, 재무 처리, 승인, 배정, 인계, 정책 변경은 읽기 전용 감사 중 실행하지 않는다.
- 표시 시간은 베트남 시간 `Asia/Ho_Chi_Minh` 기준으로 해석한다.

---

## 1. 필수 작업 원칙

이 프로젝트는 상당 부분 구현된 production-oriented 프로젝트다.

다른 구조가 더 깔끔해 보인다는 이유만으로 재설계·대규모 리팩터링하지 않는다.

반드시 보존한다.

- 기존 비즈니스 흐름
- 기존 API 계약
- DB 스키마와 데이터 호환성
- Admin Web/API 연동
- 기존 인증·권한 검사
- 기존 URL·검색 파라미터·필터 계약
- 기존 컴포넌트와 디자인 토큰
- 현재 명명 규칙
- 관련 없는 사용자 변경 사항

금지 사항:

- 패키지 설치
- DB schema 변경
- 새로운 상태 관리 도입
- 새로운 디자인 시스템 도입
- 전체 관리자 페이지 리디자인
- 대규모 컴포넌트 재작성
- 관련 없는 문제 수정
- 기존 테스트 삭제 또는 의미 완화
- display name만으로 운영 데이터를 광범위하게 제외
- 여러 문제를 한 번에 수정한 뒤 일괄 테스트
- subagent 또는 multi-agent 사용
- 명시적 요청 없는 커밋 생성

---

## 2. 검토 의견 처리 방식

`receiving-code-review` 절차를 따른다.

각 발견 사항마다 다음 순서로 진행한다.

1. 보고서의 요구사항을 읽는다.
2. 요구사항을 자신의 말로 정리한다.
3. 실제 코드·현재 화면·기존 테스트·필요한 경우 읽기 전용 DB 조회로 재검증한다.
4. `confirmed issue`, `probable issue`, `recommendation`, `not reproduced`를 구분한다.
5. 현재 아키텍처에 맞는 최소 수정안을 결정한다.
6. 한 항목만 수정한다.
7. 해당 항목의 targeted test를 실행한다.
8. 통과한 뒤 다음 항목으로 이동한다.

보고서와 실제 코드가 다르면 보고서를 맹목적으로 구현하지 않는다. 다음 근거를 제시하고 기술적으로 판단한다.

- 정확한 파일과 함수
- 현재 동작
- 기존 동작이 존재하는 이유
- 관련 테스트
- 변경 시 회귀 가능성

비즈니스 정책이 불명확한 항목은 임의로 결정하지 않는다. 코드 수정 전에 증거와 선택지를 보고하고 사용자 결정을 기다린다.

---

## 3. 시작 전 상태 기록

다음을 먼저 실행하고 결과를 기록한다.

```powershell
git branch --show-current
git status --short
```

기존 변경이 있으면 절대 덮어쓰거나 되돌리지 않는다.

우선 확인할 파일:

### Admin Web

- `apps/admin_web/app/page.tsx`
- `apps/admin_web/app/page.spec.tsx`
- `apps/admin_web/app/dashboard-trace-summary.tsx`
- `apps/admin_web/app/dashboard-trace-summary.spec.tsx`
- `apps/admin_web/app/start-shift-action-priority.ts`
- `apps/admin_web/app/start-shift-action-priority.spec.ts`
- `apps/admin_web/app/start-shift-finance-review-workload.ts`
- `apps/admin_web/app/start-shift-finance-review-workload.spec.ts`
- `apps/admin_web/components/start-shift-refresh-button.tsx`
- `apps/admin_web/components/start-shift-refresh-button.spec.tsx`
- `apps/admin_web/components/start-shift-ranking-widgets.tsx`
- `apps/admin_web/components/start-shift-ranking-widgets.spec.tsx`
- `apps/admin_web/lib/admin-operator-access.ts`
- `apps/admin_web/lib/admin-session-api.ts`
- `apps/admin_web/proxy.ts`
- `apps/admin_web/app/globals.css`

### API

- `apps/api/src/admin/admin.service.ts`
- `apps/api/src/admin/admin.service.spec.ts`
- `apps/api/src/admin/admin-booking-list-query.ts`
- `apps/api/src/admin/admin-booking-list-query.spec.ts`
- `apps/api/src/admin/admin-analytics.routes.ts`

---

# Phase 1 — P1 데이터 신뢰성

## SC-01: 감사·fixture 데이터가 운영 화면에 노출되는 문제

### 감사에서 확인된 동작

화면에는 `Test data excluded`가 표시되지만 다음 감사용 Partner 프로필이 `Partner needs attention`에 노출됐다.

```text
audit_booking_list_resolved_provider_profile
audit_booking_list_preferred_provider_profile
audit_post_match_provider_profile
```

확인할 함수:

- `adminIdentifierProductionDataSql`
- `adminCustomerProductionDataWhere`
- `adminProviderProductionDataWhere`
- `adminProviderProductionDataSql`
- `adminProfileProductionDataSql`
- `adminBookingProductionDataWhere`
- `adminBookingProductionDataSql`
- Start Shift Partner ranking SQL

### 필수 불변식

- 명시적으로 식별 가능한 audit/smoke/seed/fixture 데이터는 운영 지표·랭킹·주의 큐에 포함되지 않아야 한다.
- 실제 운영 데이터는 제외되면 안 된다.
- 데이터 제외 기준은 display name 추측보다 명시적 provenance를 우선해야 한다.

### 최소 수정 방향

1. 기존 `User.fixtureKind`, `fixtureRunId`, `fixtureExpiresAt` 정보를 우선 활용한다.
2. 레거시 `audit_*` profile/user ID를 명시적으로 제외한다.
3. 기존 `smoke`, `seed-`, `demo` 제외 조건을 유지한다.
4. `Provider 0003` 같은 표시 이름 패턴만으로 데이터를 제외하지 않는다.
5. Booking과 Partner/Customer production predicate의 의미를 가능한 범위에서 맞춘다.
6. 공통화가 대규모 리팩터링이 되면 현재 함수 안에서 최소 수정한다.
7. DB schema는 변경하지 않는다.
8. 운영 DB 레코드를 자동 삭제하거나 수정하지 않는다.

모든 fixture가 확실히 제외된다고 증명할 수 없다면 UI 문구를 실제 보장 범위에 맞춘다.

```text
기존: Test data excluded
임시 권장: Marked test data excluded
```

단, deterministic fixture 필터를 증명할 수 있으면 기존 문구를 유지할 수 있다.

### 필수 테스트

- `audit_*` providerProfileId 제외
- `audit_*` userId 제외
- `fixtureKind != null` 사용자 제외
- smoke/seed/demo 기존 제외 유지
- 일반 CUID 기반 실제 Partner 유지
- 실제 사용자의 이름에 `Audit` 문자열이 있다는 이유만으로 제외되지 않음
- Partner needs-attention ranking에서 fixture 제외
- Booking production filter 회귀 없음

Phase 1 수정과 targeted test를 완료한 뒤 결과를 보고하고 Phase 2로 이동한다.

---

# Phase 2 — P1 데이터 범위 표기

## SC-02: `Today so far`와 전체 기간 열린 재무 업무가 한 범위처럼 보이는 문제

### 감사에서 확인된 동작

- 상단은 `scope="current-shift"`와 `Today so far`를 사용한다.
- Payment clearing과 Bank reconciliation은 `range: 'all'`이다.
- Partner deposit reconciliation도 전체 미해결 재고를 보여준다.
- 실제 화면에는 68일·46일·34일 된 재무 기록이 오늘 범위 아래 표시된다.

### 필수 불변식

운영자는 다음을 혼동하면 안 된다.

1. 오늘 베트남 시간의 활동·성과
2. 전체 기간의 현재 미해결 업무

### 최소 수정 방향

데이터 조회 범위와 API 계약은 변경하지 않는다. 문구와 범위 표시만 정확하게 수정한다.

권장 의미:

```text
Shift activity · Today (Vietnam)
Open work · All dates
```

추가 조건:

- 전체 기간 재무 큐에는 `All dates` 또는 `All-date backlog` 범위를 표시한다.
- `Today result`는 오늘 베트남 시간 기준을 유지한다.
- 7일/30일 분석 탭의 동작은 유지한다.
- 새 컴포넌트보다 기존 `StatusBadge`, `DashboardDataScopeStatus`, `AdminQueueMeta`를 재사용한다.

### 필수 테스트

- 오늘 활동 범위 문구
- 전체 기간 열린 업무 범위 문구
- 오늘 활동 0건 + 과거 backlog 존재 상태
- 7일/30일 전환
- 기존 큐 URL과 API query 불변

Phase 2 수정과 targeted test를 완료한 뒤 결과를 보고하고 Phase 3으로 이동한다.

---

# Phase 3 — P1 probable issue 재검증

## SC-03: 오래된 재무 backlog가 실시간 고객 문제보다 우선될 수 있는 문제

이 항목은 비즈니스 우선순위 변경이므로 바로 수정하지 않는다.

다음 시나리오를 테스트로 먼저 재현한다.

```text
Payment clearing: 68일 전, SLA overdue
Matching delay: 현재 고객이 16분 대기, SLA overdue, isLiveBlock=true
```

추적할 함수:

- `prioritizeStartShiftActions`
- `splitStartShiftActions`
- `prioritizeStartShiftCommandItems`
- `commandItemPriority`
- `compareStartShiftActions`

현재 로직에서 어느 항목이 `Next action`이 되는지 증명한다.

### 권장 우선순위 정책안

1. 데이터 소스 장애
2. 현재 서비스 중단 또는 실시간 고객 대기
3. 서비스 진행을 막는 결제 위험
4. 기타 SLA 초과 업무
5. 미할당 업무
6. 내 업무
7. 일반 경고
8. 정보·정상 상태

다음을 보고하고 사용자 승인을 기다린다.

- 현재 우선순위 결과
- 변경 후 예상 결과
- 영향을 받는 큐
- 기존 테스트와 충돌하는 부분
- 최소 코드 변경안
- 회귀 위험

사용자 승인 전에는 Phase 3 우선순위 코드를 수정하지 않는다.

---

# Phase 4 — 확정된 P2 수정

각 항목을 반드시 한 건씩 수정하고 개별 테스트한다.

## SC-04: 전체 데이터 정상 문구의 정확성

현재 상단 상태는 Start Shift Summary를 기준으로 판단하며 별도 `start-shift-analytics` 실패를 포함하지 않을 수 있다.

최소 수정 권장:

- `All data sources current`를 `Command data current`로 축소한다.
- Analytics 상태는 `Today result` 섹션에서 별도로 표시한다.
- Command 영역이 Analytics를 기다리지 않는 기존 Suspense 구조를 유지한다.
- Analytics 실패 때문에 상단 Command 영역을 blocking하지 않는다.

필수 테스트:

- Summary 성공 + Analytics 실패
- Summary 실패 + Analytics 성공
- 둘 다 성공
- Analytics section-scoped 오류 상태

## SC-05: 남은 큐 수의 의미

현재 `openQueueItems = globalPriorityItems.slice(1)`이므로 최우선 큐가 수치에서 제외된다.

최소 수정 권장:

```text
제목: Remaining queues
배지: 2 more queues
```

전체 수를 표시하기로 결정하면 다음처럼 표현한다.

```text
3 open queues
```

이 경우 최우선 큐가 `Next action`으로 분리됐다는 설명이 있어야 한다. 기존 카드·링크 구조는 변경하지 않는다.

## SC-06: 중복 가능한 수치의 의미

현재 `Unassigned`, `SLA overdue`, `backlog` 수치는 서로 겹칠 수 있다.

권장 표현:

```text
180 open
180 over 48h
160 of 180 unassigned
```

조건:

- `Money status`에서도 고유 전체 열린 건수를 먼저 표시한다.
- 겹치는 수치를 합계처럼 표현하지 않는다.
- 계산 로직이 정확하면 API를 변경하지 않고 UI 문구만 수정한다.

## SC-07: 로그인 운영자 신원

현재 `Signed-in operator` fallback이 표시되는 원인을 확인한다.

Proxy의 forwarded access에는 ID·roles·categories만 포함될 수 있다.

최소 수정 우선순위:

1. 기존 데이터로 full name 또는 email을 얻을 수 있는지 확인한다.
2. API 계약 변경 없이 가능하면 기존 정보를 사용한다.
3. 불가능하면 `Operator {shortId}`를 표시한다.
4. 표시 이름 하나 때문에 새로운 API 요청을 추가하지 않는다.
5. fullName/email 계약 확장이 꼭 필요하다면 구현 전에 영향 범위를 보고한다.

`Mine` 계산에 사용하는 operator ID 동작은 변경하지 않는다.

## SC-08: 60초 갱신 문구와 실제 동작

현재 interactive element에 포커스가 남아 있으면 자동 refresh가 연기될 수 있다.

가장 작은 안전 수정은 문구를 실제 동작에 맞추는 것이다.

```text
기존: Refresh every 60s
권장: Checks for updates every 60s
```

자동 refresh 로직까지 수정할 경우 다음 상태를 구분한다.

- 단순 링크/버튼 포커스
- 입력 편집 중
- modal/drawer 열림
- document hidden
- 새 데이터 사용 가능
- 수동 Refresh

단순 포커스만으로 무기한 갱신이 중단되면 안 된다. 문구 수정만으로 충분한지 먼저 판단한다.

## SC-09: Leaders와 Needs attention의 의미

현재 `Customer and Partner leaders` 안에 `Partner needs attention`만 표시될 수 있다.

최소 수정:

- Partner attention만 있으면 외부 섹션 제목도 `Partner needs attention`
- Customer attention만 있으면 `Customer needs attention`
- 둘 다 있으면 `Customers and Partners needing attention`
- 실제 성과 랭킹이 있을 때만 `Customer and Partner leaders`
- 표시 가능한 모드가 하나뿐이면 tablist를 렌더링하지 않음
- 여러 탭이 있을 때 기존 keyboard interaction 유지

필수 테스트:

- Partner attention only
- Customer attention only
- 양쪽 attention
- 실제 performance rankings 존재
- 단일 모드에서 `role="tablist"` 없음
- 다중 탭에서 ArrowLeft/ArrowRight/Home/End 유지

---

# Phase 5 — P3 화면 밀도

P1/P2가 모두 통과한 뒤에만 진행한다.

대상:

- Money status
- Additional work
- Today result

최소 개선 조건:

- Money status를 새로운 시스템으로 재설계하지 않는다.
- 기존 `AdminSection` 내부에서 불필요한 최소 높이와 여백만 줄인다.
- Additional work가 1~2건이면 기존 metric card를 compact row 형태로 정렬한다.
- `Today (Vietnam)` 상태와 활성 `Today` 탭의 중복을 제거한다.
- Partner approvals에는 기존 데이터로 가능한 경우 `Oldest`, `Owner`, `Open oldest` 중 하나를 제공한다.
- 이를 위해 새로운 API를 만들지 않는다.
- 1440px과 1980px에서만 확인한다.

---

# 4. 검증 명령

각 수정 직후 해당 targeted test를 먼저 실행한다.

Admin Web 관련 최종 targeted test:

```powershell
npm.cmd test --workspace @massage-vn/admin-web -- app/page.spec.tsx app/start-shift-action-priority.spec.ts app/start-shift-finance-review-workload.spec.ts components/start-shift-refresh-button.spec.tsx components/start-shift-ranking-widgets.spec.tsx app/dashboard-trace-summary.spec.tsx
```

API production-data predicate를 수정했다면:

```powershell
npm.cmd test --workspace @massage-vn/api -- src/admin/admin-booking-list-query.spec.ts
npm.cmd test --workspace @massage-vn/api -- src/admin/admin.service.spec.ts -t "Start Shift"
```

최종 빠른 범위 검증:

```powershell
npm.cmd run verify:admin:fast
npm.cmd run verify:api:fast
```

명령이 프로젝트의 실제 script 계약과 다르면 먼저 `package.json`을 확인하고 동등한 기존 명령을 사용한다. 패키지를 새로 설치하지 않는다.

---

# 5. 브라우저 승인 기준

실제 로그인된 Admin Web에서 다음을 확인한다.

- 1440px 첫 화면에 `Next action`이 보임
- 1980px에서도 과도한 행 확장이나 빈 공간 없음
- document-level 가로 overflow 없음
- 오늘 활동과 전체 기간 열린 업무가 명확히 구분됨
- 명시적 감사용 Partner가 운영 랭킹에 없음
- Remaining queue 수가 정확함
- 중복 수치가 합계처럼 보이지 않음
- 로그인 운영자를 식별할 수 있음
- Analytics 실패와 상단 Command 상태가 모순되지 않음
- attention-only 상태의 섹션 제목이 실제 내용과 일치함
- 단일 모드에 불필요한 tablist가 없음
- 60초 갱신 문구와 실제 동작이 일치함
- 기존 직접 큐 링크가 정확한 필터와 oldest-first 동작을 유지함

시각적 검증 전후 스크린샷을 같은 viewport로 남긴다. 실제 화면 확인 없이 CSS 소스만 보고 UI 완료를 선언하지 않는다.

---

# 6. 완료 보고 형식

## 검증 결과

- 각 보고서 항목의 재현 여부
- `confirmed / probable / recommendation / not reproduced` 구분
- 보고서와 실제 코드가 달랐던 부분

## 수정 결과

각 수정마다 다음을 기록한다.

- ID와 severity
- 변경 파일
- 관련 함수·컴포넌트
- 이전 동작
- 변경 동작
- 최소 수정인 이유
- API/DB 계약 영향
- 회귀 위험

## 테스트

- 실행 명령
- 통과/실패/skip 수
- 실패 원인
- 실행하지 못한 검증

## 브라우저 검증

- viewport
- 실제 표시 문구
- 주요 수치
- 링크 목적지
- 남은 시각적 문제

## 보호 영역

- DB schema 변경 여부
- API contract 변경 여부
- 패키지 설치 여부
- 인증·권한 영향 여부
- 기존 사용자 변경 보존 여부

## 남은 문제

- 의도적으로 수정하지 않은 항목
- 비즈니스 정책 결정이 필요한 항목
- 다음 한 건으로 처리할 권장 작업

작업 종료 시 다음을 다시 실행한다.

```powershell
git status --short
```

코드를 수정했다면 실제 변경 파일만 정확히 보고한다. 검증하지 않은 항목은 완료로 표시하지 않는다.
