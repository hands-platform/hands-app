# HANDS Admin Shift Command Final Re-audit Remediation Prompt

> 목적: 2026-08-18 재감사에서 남은 문제만 기존 구조를 보호하며 한 건씩 수정하고, 실제 1440px·1980px 운영 화면에서 재검증한다.
>
> 대상 페이지: `http://localhost:3101/`
>
> 감사 기준 시각: 2026-08-18 ICT (`Asia/Ho_Chi_Minh`)
>
> 현재 재감사 점수: 82/100 · 조건부 통과

---

## Codex에 전달할 실행 지시

작업 저장소는 다음 경로 하나만 사용한다.

```text
C:\dev\massage-on-demand-vn
```

`C:\dev\massage-vn-workspace`는 사용하지 않는다.

작업 전 다음 파일을 완전히 읽고 준수한다.

```text
C:\dev\massage-on-demand-vn\AGENTS.md
C:\dev\.agents\skills\receiving-code-review\SKILL.md
```

필수 스킬:

- `receiving-code-review`
- 실제 화면 검증 시 `browser:control-in-app-browser` 또는 `webapp-testing`
- UI 판단이 필요한 항목에서 `ui-ux-pro-max`

단일 에이전트로만 작업한다. subagent·multi-agent는 사용하지 않는다.

---

# 1. 절대 작업 원칙

이 프로젝트는 이미 상당 부분 구현된 production-oriented 프로젝트다.

다른 구조가 더 깔끔해 보인다는 이유로 재설계·대규모 리팩터링하지 않는다.

반드시 보존한다.

- 기존 비즈니스 흐름
- 기존 API 계약
- DB schema와 데이터 호환성
- 현재 Admin Web/API 연동
- 기존 인증·권한·세션 검사
- 현재 URL·검색 파라미터·필터 계약
- 기존 컴포넌트와 디자인 토큰
- 기존 큐 링크와 oldest-first 동작
- 관련 없는 사용자 변경 사항

금지 사항:

- 패키지 설치
- DB schema 변경
- 운영 DB 데이터 생성·수정·삭제
- 새로운 상태 관리 도입
- 새로운 디자인 시스템 도입
- 전체 페이지 재설계
- 공용 `AdminActionCard`의 광범위한 재작성
- API 응답 계약 변경
- 관련 없는 문제 수정
- 테스트 삭제·skip·의미 완화
- display name 패턴만으로 Partner를 운영 데이터에서 제외
- 여러 finding을 한 번에 수정한 뒤 일괄 검증
- 명시적 요청 없는 commit 생성

1024px 이하 화면은 검사·수정·보고 범위에 포함하지 않는다.

지원 화면은 다음 두 크기로 검증한다.

```text
1440px 이상
권장 추가 검증: 1980px
```

---

# 2. 작업 방식

`receiving-code-review` 절차에 따라 각 finding을 다음 순서로 처리한다.

1. 요구사항을 자신의 말로 다시 정리한다.
2. 현재 코드·테스트·실제 화면에서 재현한다.
3. `confirmed issue`, `probable issue`, `recommendation`, `not reproduced`를 구분한다.
4. 현재 구조에 맞는 최소 수정안을 결정한다.
5. 한 finding만 수정한다.
6. 해당 finding의 targeted test를 실행한다.
7. 실제 1440px 화면에서 결과를 확인한다.
8. 성공한 뒤 다음 finding으로 이동한다.

보고서가 실제 코드와 다르면 맹목적으로 수정하지 않는다. 기술적 근거를 남긴다.

각 finding의 완료 보고에는 반드시 다음을 포함한다.

- severity
- 변경 파일
- 관련 함수·컴포넌트
- 재현한 현재 동작
- 최소 수정 내용
- API/DB 계약 영향
- 회귀 위험
- 실행한 테스트
- 실제 화면 검증 결과

---

# 3. 시작 전 상태 기록

먼저 다음을 실행한다.

```powershell
git branch --show-current
git status --short
```

기존 변경은 절대 덮어쓰거나 되돌리지 않는다.

우선 확인할 파일:

```text
apps/admin_web/app/page.tsx
apps/admin_web/app/page.spec.tsx
apps/admin_web/app/globals.css
apps/admin_web/app/start-shift-action-priority.ts
apps/admin_web/app/start-shift-action-priority.spec.ts
apps/admin_web/app/start-shift-operations-command-board.ts
apps/admin_web/app/dashboard-page-model.ts
apps/admin_web/app/dashboard-page-model.spec.ts
apps/admin_web/app/dashboard-trace-summary.tsx
apps/admin_web/app/dashboard-trace-summary.spec.tsx
apps/admin_web/components/start-shift-ranking-widgets.tsx
apps/admin_web/components/start-shift-ranking-widgets.spec.tsx
apps/admin_web/lib/admin-operator-access.ts
apps/admin_web/lib/admin-session-api.ts
apps/admin_web/proxy.ts
apps/api/src/admin/admin-booking-list-query.ts
apps/api/src/admin/admin.service.ts
```

현재 변경 상태를 기준선으로 삼는다. 이미 구현된 다음 개선은 되돌리지 않는다.

- `Shift activity · Today (Vietnam)`
- `Command data current`
- `Checks for updates every 60s`
- `Open work · All dates`
- `Remaining queues`, `N more queues`
- attention-only 섹션 제목 보정
- 단일 모드에서 tablist 제거
- audit/smoke/seed/fixture provenance 필터
- Additional work compact layout
- Today 결과의 중복 배지 제거

---

# Phase 1 — P1: Analytics 장애 fallback 우선순위 일치

## SHIFT-REAUDIT-01

- severity: `P1`
- 분류: `confirmed issue`
- 관련 위치:
  - `apps/admin_web/app/page.tsx`의 `exactActionQueueItems`
  - `apps/admin_web/app/page.tsx`의 `globalPriorityItems`
  - `apps/admin_web/app/start-shift-action-priority.ts`의 `commandItemPriority`

### 확인된 현재 동작

Analytics 응답이 정상일 때 `startShiftCommandItem`은 현재 고객 문제에 `isLiveBlock`을 설정한다.

그러나 Analytics가 실패하고 Command summary fallback을 사용할 때 다음 항목에는 같은 신호가 없다.

```text
Matching exceptions
Customer choice
```

현재 priority 함수에서는:

```text
isLiveBlock       -> 우선순위 1
isServiceBlock    -> 우선순위 2
Finance SLA       -> 우선순위 3
일반 danger/warn  -> 우선순위 6
```

따라서 Analytics만 실패하면 현재 고객의 매칭 장애가 오래된 Finance SLA보다 뒤로 밀릴 수 있다.

### 보존할 우선순위 불변식

현재 코드에 이미 도입된 다음 정책을 더 확대하거나 재설계하지 말고 정상·fallback 경로에서만 일치시킨다.

```text
데이터 장애
→ 실시간 고객/매칭 차단
→ 서비스 진행 차단
→ 기타 SLA 초과
→ 미할당
→ 내 업무
→ 일반 경고
```

### 최소 수정

1. fallback `Matching exceptions`에 정확한 `isLiveBlock` 신호를 부여한다.
2. `Customer choice`가 현재 고객 대기 항목이라는 기존 정상 경로의 의미와 동일하다면 같은 신호를 부여한다.
3. `Completed closeout`을 임의로 service block으로 확대하지 않는다.
4. 새로운 priority 시스템이나 mapper 대규모 리팩터링을 만들지 않는다.
5. 정상 Analytics 경로의 기존 정렬 결과는 유지한다.

### 필수 테스트

다음 조합을 `page.spec.tsx` 또는 가장 가까운 기존 targeted test에서 검증한다.

```text
Analytics unavailable
Command summary available
Matching expired > 0
Finance over-48h > 0
```

기대 결과:

- `Matching exceptions`가 `Next action`
- 오래된 Finance queue는 `Remaining queues`
- Analytics 정상/실패 경로가 동일한 업무 우선순위를 표시
- 고객 대기 0건이면 Finance가 정상적으로 우선됨

Phase 1을 완료하고 targeted test가 통과한 뒤에만 Phase 2로 이동한다.

---

# Phase 2 — P1: Money status의 현재·과거 금액 범위 분리

## SHIFT-REAUDIT-02

- severity: `P1`
- 분류: `confirmed issue`
- 관련 위치: `apps/admin_web/app/page.tsx`의 `moneyOpenStatusLabel`

### 확인된 현재 동작

건수는 현재와 과거를 구분해 표시하지만 노출 금액은 다음처럼 합산한다.

```ts
financeReviewOpenAmount + historicalImpactAmount
```

같은 문구 안에서 다음 두 의미가 충돌한다.

```text
84 historical backlog cases tracked separately
53.440.000 VND exposed
```

`exposed` 금액에는 historical 금액이 포함될 수 있으므로 운영자가 현재 처리해야 하는 금액으로 오해할 수 있다.

### 최소 수정

API와 데이터 계산 계약은 변경하지 않는다. 이미 존재하는 값을 분리해 표시한다.

```text
Current open exposure: financeReviewOpenAmount
Historical exposure: historicalImpactAmount
Historical backlog count: settlementBacklogCount + historicalMoneyCaseCount
```

조건:

1. 현재 금액과 historical 금액을 다시 더해 하나의 무범위 `exposed` 값으로 표시하지 않는다.
2. 합계가 꼭 필요하면 `Total including historical`이라고 명시한다.
3. 값이 0인 항목은 기존 패턴에 따라 숨길 수 있다.
4. 현재 Finance review 건수의 포함 관계는 유지한다.
5. `Money status`만 수정하고 Finance API나 DB query를 변경하지 않는다.

### 필수 테스트

- 현재 금액만 존재
- historical 금액만 존재
- 현재·historical 금액 모두 존재
- 둘 다 0
- 각 금액이 올바른 범위 label과 함께 표시
- `financeReviewOpenAmount + historicalImpactAmount`가 무범위 `exposed` 문구로 출력되지 않음

Phase 2를 완료하고 targeted test가 통과한 뒤에만 Phase 3으로 이동한다.

---

# Phase 3 — P2: 작업 카드 grid 시각 회귀 수정

## SHIFT-REAUDIT-03

- severity: `P2`
- 분류: `confirmed issue`
- 관련 위치:
  - `apps/admin_web/app/page.tsx`의 `StartShiftActionGrid`
  - `apps/admin_web/app/globals.css`의 `.start-shift-action-item`

### 확인된 현재 동작

`scopeLabel`을 `AdminActionCard`의 새로운 직접 자식으로 추가했지만 해당 요소의 grid 위치가 명시되지 않았다.

실제 측정:

```text
1440px: SLA overdue 배지 폭 약 452px, 제목/설명 열 약 317px
1980px: SLA overdue 배지 폭 약 452px 유지
```

상태 배지가 긴 띠로 늘어나고 제목·설명·건수·범위·메타 정보가 서로 분리돼 보인다.

### 최소 수정

1. scope badge에 전용 class를 부여한다.
2. status, title, detail, value, scope, queue meta, ageing, action의 grid 위치를 명시한다.
3. status와 scope badge는 내용 폭만 사용하도록 `justify-self: start` 또는 동등한 기존 패턴을 적용한다.
4. `AdminActionCard` 공용 컴포넌트를 광범위하게 변경하지 않는다.
5. 가능하면 `.dashboard-page .start-shift-action-item` 범위 안에서 수정한다.
6. `Open work · All dates` 의미는 유지한다.
7. document-level horizontal overflow가 생기면 안 된다.

### 시각 승인 기준

1440px·1980px 모두에서:

- `SLA overdue` 배지가 카드 열 전체로 늘어나지 않음
- title과 detail이 운영자가 한 번에 읽을 수 있는 폭을 가짐
- `Open work · All dates`가 어느 queue의 범위인지 명확함
- Team, Assignee, Oldest, Impact가 시각적으로 같은 queue에 묶임
- 긴 Partner deposit title과 긴 VND 금액에서도 겹침 없음
- 가로 overflow 없음

### 필수 테스트

- scope label이 있는 카드
- scope label이 없는 카드
- 긴 제목·설명·금액
- 1440px screenshot
- 1980px screenshot
- 가능하면 computed bounding box 또는 시각 회귀 assertion으로 상태 배지가 과도하게 stretch되지 않음을 확인

CSS 소스만 보고 완료로 선언하지 않는다. 실제 화면을 캡처한다.

---

# Phase 4 — P2: Money status 헤더와 남은 문구 정리

## SHIFT-REAUDIT-04

- severity: `P2`
- 분류: `confirmed issue`
- 관련 위치: `apps/admin_web/app/page.tsx`의 Money status `AdminSection`

### 확인된 현재 동작

- 모든 지표를 하나의 긴 header badge에 넣어 1440px에서 `Money status` 제목이 두 줄로 압축된다.
- 본문에는 이름 변경 전 문구가 남아 있다.

```text
Finance work is prioritized in Next action and Open queues above.
```

실제 섹션 이름은 `Remaining queues`다.

### 최소 수정

1. header status는 한두 개의 핵심 지표만 남긴다.
2. over-48h, unassigned, current exposure, historical backlog/exposure는 기존 body의 작은 metric/chip/dl 패턴으로 이동한다.
3. 새로운 dashboard 시스템을 만들지 않는다.
4. 다음 문구를 현재 명칭과 일치시킨다.

```text
Finance work is prioritized in Next action and Remaining queues above.
```

5. Phase 2에서 분리한 current/historical 범위를 그대로 유지한다.

### 필수 테스트

- 0건
- open만 존재
- 모든 보조 지표 존재
- 큰 VND 금액
- 1440px에서 제목 한 줄 유지
- `Open queues above` 문구가 남지 않음

---

# Phase 5 — P2: 운영자 신원을 사람이 이해할 수 있게 표시

## SHIFT-REAUDIT-05

- severity: `P2`
- 분류: `confirmed issue`
- 관련 위치:
  - `apps/admin_web/app/page.tsx`의 `operatorLabel`
  - `apps/admin_web/lib/admin-operator-access.ts`의 `forwardedAdminOperatorAccess`
  - `apps/admin_web/proxy.ts`의 trusted forwarded access headers

### 확인된 현재 동작

실제 화면에는 다음과 같은 내부 ID가 표시된다.

```text
Operator cmpfe6qx...
```

Proxy가 검증한 `serverSession.operatorAccess`에는 이름·이메일이 존재할 수 있지만 현재 forwarded access에는 ID·roles·categories만 전달한다.

### 최소 수정 방향

1. 먼저 `getAdminWebSessionStateWithApi`가 검증 후 반환하는 `operatorAccess.fullName`·`email`의 실제 계약을 확인한다.
2. 이미 존재하는 검증된 값만 사용한다.
3. 추가 Admin API 요청을 만들지 않는다.
4. 내부 trusted header를 확장한다면 반드시:
   - 브라우저에서 들어온 동일 header를 먼저 삭제
   - 검증된 `serverSession.operatorAccess` 값만 다시 설정
   - ID와 identity가 일치할 때만 읽기
5. 표시 우선순위:

```text
fullName
→ email
→ 명확한 unavailable 문구
```

내부 DB ID를 운영자의 기본 표시 이름으로 사용하지 않는다.

### 보안 불변식

- 사용자가 임의로 보낸 `x-hands-admin-operator-*` header가 UI 신원을 바꾸면 안 된다.
- 기존 role/category 권한 판단은 변경하지 않는다.
- `Mine` 계산에 사용되는 operator ID는 유지한다.
- 이메일·이름을 로그에 새로 남기지 않는다.

### 필수 테스트

- fullName 존재
- fullName 없음 + email 존재
- 둘 다 없음
- spoofed name/email header 제거
- 검증된 session access만 forward
- 추가 API 요청 없음
- 기존 ID·roles·categories 권한 테스트 유지

---

# Phase 6 — P2 probable: 미분류 Partner provenance 처리

## SHIFT-REAUDIT-06

- severity: `P2`
- 분류: `probable issue`
- 이 단계는 분석 우선이며 운영 데이터는 수정하지 않는다.

### 확인된 현재 상태

다음 명시적 감사 데이터는 현재 화면에서 제거됐다.

```text
audit_booking_list_resolved_provider_profile
audit_booking_list_preferred_provider_profile
audit_post_match_provider_profile
```

그러나 현재 Partner needs attention에는 다음 일반화된 프로필이 남아 있다.

```text
Provider 0003
Provider 0011
Provider 6889
Provider 2578
Provider 7033
```

재감사 당시 이들의 `fixtureKind`, `fixtureRunId`, `fixtureExpiresAt`은 모두 `null`이었다. 실제 운영 데이터인지 과거 미표시 seed인지 현재 증거만으로 확정할 수 없다.

### 분석 절차

1. 읽기 전용으로 생성 출처와 운영 활동을 확인한다.
2. 실제 가입·인증·예약·운영 활동 증거가 있는지 조사한다.
3. fixture provenance가 빠진 historical seed인지 확인한다.
4. 결과를 `confirmed production`, `confirmed fixture`, `unknown provenance`로 분류한다.

### 금지 사항

- 이름이 `Provider 0003` 같은 형식이라는 이유만으로 제외
- 레코드 삭제
- fixture 필드 임의 갱신
- DB migration 또는 schema 변경
- 근거 없는 production/test 판정

### 최소 UI 조치

모든 test data 제외를 증명할 수 없다면 상단 문구만 실제 보장 범위에 맞춘다.

```text
기존: Test data excluded
권장: Marked test data excluded
```

provenance가 확정되지 않은 상태에서 DB 데이터를 고치지 않는다. 데이터 정리가 필요하면 별도 승인 작업으로 보고한다.

### 필수 테스트

- 명시적 audit/smoke/seed/fixture 제외 유지
- 일반 CUID production Partner 유지
- 이름만으로 제외되지 않음
- UI 문구가 실제 보장 범위와 일치

---

# 4. Targeted test 명령

각 Phase 직후 가장 가까운 targeted test를 먼저 실행한다.

Admin Web 관련 최종 묶음:

```powershell
npm.cmd test --workspace @massage-vn/admin-web -- app/dashboard-page-model.spec.ts app/dashboard-trace-summary.spec.tsx app/page.spec.tsx app/start-shift-action-priority.spec.ts components/start-shift-ranking-widgets.spec.tsx
```

현재 기준선은 다음과 같다.

```text
5 test files
89 tests passed
```

API production-data predicate를 실제로 변경한 경우에만:

```powershell
npm.cmd test --workspace @massage-vn/api -- src/admin/admin-booking-list-query.spec.ts src/admin/admin.service.spec.ts
```

현재 기준선은 다음과 같다.

```text
2 test files
732 tests passed
```

최종 Admin 빠른 검증:

```powershell
npm.cmd run verify:admin:fast
```

API 코드를 수정한 경우에만:

```powershell
npm.cmd run verify:api:fast
```

마지막으로:

```powershell
git diff --check
git status --short
```

실패한 검증을 기존 문제라고 단정하지 않는다. 현재 변경으로 발생했는지 추적한다.

---

# 5. 브라우저 검증 절차

실제 로그인된 `http://localhost:3101/`에서 검증한다.

주의:

- production `next start` 탭이 이전 문서를 유지할 수 있으므로 현재 build와 process 시작 시각을 확인한다.
- 필요하면 명시적으로 한 번 새로고침한 뒤 현재 빌드 화면을 감사한다.
- 데이터 변경 버튼, 배정, 승인, 인계, 재무 mutation은 실행하지 않는다.
- 화면 캡처만 수행한다.

필수 viewport:

```text
1440x1000
1980x1100
```

필수 캡처:

1. 상단 Shift context + Next action
2. Remaining queues
3. Money status + Additional work
4. Today result + Partner needs attention

최종 화면 승인 기준:

- 정상·Analytics fallback 모두 실시간 고객 장애 우선순위가 같음
- 현재 Finance 금액과 historical 금액이 분리됨
- status badge가 카드 폭 전체로 늘어나지 않음
- title/detail/value/scope/meta가 논리적으로 정렬됨
- Money status 제목이 1440px에서 불필요하게 두 줄로 압축되지 않음
- `Open queues above` 문구가 남지 않음
- 운영자 이름 또는 이메일을 식별 가능
- 명시적 감사용 Partner가 랭킹에 없음
- test-data 문구가 실제 provenance 보장 범위와 일치
- document-level horizontal overflow 없음
- 브라우저 console error/warning 없음

화면 확인 없이 CSS와 unit test만으로 완료를 선언하지 않는다.

---

# 6. 완료 보고 형식

## A. 시작 상태

- branch
- 시작 `git status --short`
- 기존 변경 파일 수
- 현재 실행 중인 Admin build/process 확인

## B. Finding별 결과

각 ID에 대해:

```text
ID:
severity:
판정: confirmed / probable / recommendation / not reproduced
변경 파일:
관련 함수:
이전 동작:
변경 동작:
최소 수정인 이유:
API contract 영향:
DB schema 영향:
회귀 위험:
```

## C. 테스트

- 실제 실행 명령
- pass/fail/skip 수
- 실패 원인
- 실행하지 못한 검증

## D. 브라우저 검증

- viewport
- 실제 표시 문구
- Next action 선택 결과
- current/historical 금액
- 주요 요소 배치
- horizontal overflow
- console error/warning
- 스크린샷 절대 경로

## E. 보호 영역

- DB schema 변경 여부
- API contract 변경 여부
- 패키지 설치 여부
- 인증·권한 영향 여부
- 운영 데이터 mutation 여부
- 기존 사용자 변경 보존 여부

## F. 남은 문제

- 의도적으로 수정하지 않은 항목
- provenance 또는 운영 정책 결정이 필요한 항목
- 다음 한 건으로 처리할 권장 작업

한 항목을 검증하지 못했다면 완료로 표시하지 않는다.
