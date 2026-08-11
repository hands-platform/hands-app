# Codex 실행 프롬프트 — Shift Command 운영 화면 개선

아래 프롬프트 전체를 새 Codex 작업에 그대로 붙여 넣어 사용한다.

---

## 역할과 목표

당신은 HANDS 관리자 웹을 실제로 사용하는 **운영 책임자 관점의 시니어 프로덕트 엔지니어**다. `Shift Command` 첫 화면을 보기 좋게 꾸미는 것이 아니라, 운영자가 로그인한 뒤 **가장 위험한 미처리 업무를 즉시 발견하고 올바른 화면으로 이동할 수 있도록** 코드와 화면을 직접 수정하라.

현재 화면의 핵심 문제는 상단에 `Needs action · 0`, `Current clear`, `Clear`가 강조되지만 실제로는 Finance review 180건, 48시간 초과 146건, historical backlog 987건과 금전 위험이 존재한다는 것이다. `현재 실시간 업무 0건`과 `전체 운영 위험 0건`을 절대로 같은 의미로 표시하지 마라.

분석만 하고 끝내지 말고, 코드를 수정하고 테스트와 실제 브라우저 검증까지 완료하라.

## 작업 위치와 필수 자료

- 저장소: `C:\dev\massage-on-demand-vn`
- 대상 앱: `apps/admin_web`
- 대상 페이지: `/` — Shift Command
- 로컬 관리자 화면: `http://localhost:3101/`
- 상세 감사 보고서: `output/shift-command-audit-2026-08-05/shift-command-operator-audit.md`
- 비교 캡처: `output/shift-command-audit-2026-08-05/*.png`

작업을 시작하기 전에 다음을 순서대로 수행하라.

1. `AGENTS.md`를 전부 읽고 준수한다.
2. 위 감사 보고서를 전부 읽고 SC-001부터 SC-015까지 코드 위치와 근거를 확인한다.
3. `git status --short`로 기존 사용자 변경을 확인하고 관련 없는 변경을 보존한다.
4. 화면 코드, 관련 helper, 기존 spec, API 집계 흐름을 먼저 추적한다.
5. 현재 로그인된 in-app browser의 실제 화면을 다시 캡처해 보고서의 기준 화면과 비교한다.

단일 에이전트로 작업하라. 하위 에이전트나 별도 작업자를 만들지 마라.

## 구현 원칙

- 기존 디자인 시스템, 컴포넌트, CSS 토큰과 설치된 의존성을 재사용한다.
- 새 UI 라이브러리, 차트 라이브러리 또는 상태관리 라이브러리를 추가하지 않는다.
- 새 데이터베이스 모델, migration, 실제 shift 엔티티를 추가하지 않는다.
- 기존 API 응답과 화면 데이터로 해결할 수 있으면 API 계약을 확장하지 않는다.
- 문제별 임시 조건문을 `page.tsx` 여러 곳에 복제하지 말고, 기존 priority/helper 흐름의 한 지점에서 우선순위를 계산한다.
- 범용 abstraction, 미래용 설정, 신규 디자인 시스템을 만들지 않는다.
- 기존 deep link와 권한 처리를 유지한다.
- 숫자를 추정하거나 가짜 데이터를 만들지 않는다. 데이터가 없으면 명확히 `Unavailable` 또는 빈 상태로 표시한다.
- `Provider ####` 계정을 이름 패턴만으로 자동 제외하지 않는다. 실제 fixture 표식이나 승인된 근거가 없으면 그대로 두고 최종 보고서에 데이터 품질 위험으로 기록한다.
- UI 문구는 영어를 유지하되 개발자 용어가 아닌 운영자 용어를 사용한다. 사용자 노출 용어는 `Provider`가 아니라 `Partner`다.

## 반드시 구현할 변경

### 1. 전역 `Next action`을 실제 위험 기준으로 계산

현재 운영 대기열과 Finance review를 분리해서 판단하지 말고 하나의 `globalPriorityItems` 흐름으로 합쳐라. 기존 helper를 확장하거나 가장 가까운 공용 계산 지점에 구현한다.

권장 우선순위는 다음과 같다.

1. 데이터 소스 사용 불가 또는 집계 실패
2. SLA 초과
3. 미배정 업무
4. 현재 운영자의 담당 업무
5. 현재 고객 대기 또는 진행 장애
6. 금액 영향이 있는 미처리 업무
7. 일반 backlog

상단에는 가장 우선순위가 높은 한 건을 `Next action`으로 보여주고 실제 업무 필터가 적용된 deep link를 CTA로 사용한다. 실제 조치가 전혀 없을 때는 빈 Booking monitor로 가는 보라색 주 CTA를 만들지 마라.

현재 감사 데이터와 같은 조건에서는 빈 Booking monitor보다 48시간을 초과한 Finance review 또는 미배정 Finance queue가 먼저 선택되어야 한다.

### 2. `Clear`의 의미를 제한

- `Current clear`를 `No live operational cases need action`으로 변경한다.
- 실시간 업무가 0이어도 Finance 또는 historical backlog가 남아 있으면 페이지 전체를 초록색 `Clear`로 표현하지 않는다.
- 전체 위험이 없을 때만 전역적인 정상 상태를 사용한다.
- `1 operating queue clear`, `1 Finance review queue clear`, `5 money queues clear` 같은 큰 disclosure 박스는 제거한다.
- 필요하면 상단 보조 문구 하나인 `7 checks clear` 또는 접힌 `All checks`로만 통합한다.

### 3. 금융 위험 숫자를 실제 운영 단위로 표시

`Money risk · 2`, `1 urgent · 1 backlog`처럼 범주 수를 사건 수처럼 보이게 하는 표현을 제거한다.

가능한 기존 데이터로 다음과 같이 표시한다.

- `146 overdue`
- `108 unassigned`
- `84 backlog`
- 금액이 있으면 `138.5m VND exposed`

모든 숫자에는 `cases`, `queues`, `overdue`, `unassigned`, `VND` 중 정확한 단위를 붙인다. 사건 수와 대기열 종류 수를 한 숫자로 섞지 않는다.

### 4. 실제 assignee 표시

이미 계산되는 `assigneeLabel`을 화면까지 전달하라. 기존 `OperationsCommandBoardItem`에는 필요한 최소 선택 필드만 추가하고 기존 `AdminQueueMeta`의 assignee 표시를 재사용한다.

다음 정보가 서로 구분되어야 한다.

- `Team: Finance`
- `Assignee: Unassigned`, `Assignee: Mine` 또는 실제 담당자명

미배정 건은 경고 상태와 미배정 필터 deep link를 제공한다.

### 5. 오래된 위험의 심각도를 보존

- `Legacy cleanup`을 `Historical backlog (24h+)`로 변경한다.
- 환불, 결제 보류, 현금 정산, 고객 알림 실패는 오래됐다는 이유만으로 `info` tone으로 낮추지 않는다.
- 접힌 상태에서도 `987 cases · 179.13m VND exposed · oldest 78d`처럼 총규모, 금액 영향, 최장 경과를 보여준다.
- 상세은 계속 접을 수 있어도 위험 요약 자체를 다른 페이지에 숨기지 않는다.

### 6. 헤더와 첫 화면을 운영자 중심으로 정리

첫 화면의 정보 순서를 다음과 같이 바꾼다.

1. `Shift Command` 제목, 현재 operator, 마지막 갱신 시각, Refresh
2. `Next action` 한 건
3. compact counters: 고객 매칭 대기, 서비스 진행 중, 미배정, SLA 초과
4. `Open queues`: 현재 운영과 Finance queue를 같은 우선순위로 정렬
5. `Historical backlog (24h+)`
6. 데이터가 있을 때만 분석 및 성과 정보

`Current shift`가 실제 shift 엔티티가 아니라 오늘의 시간 범위라면 `Today so far` 또는 `Live operations`로 변경한다. 새 shift 모델을 만들지 마라.

현재 operator, `My queues`, `Unassigned`, `SLA overdue`, 마지막 갱신 시각과 기존 `/operations-handoff` 링크를 compact bar로 제공하되, 기존 데이터로 정확히 계산 가능한 항목만 표시한다.

### 7. 중복 행동과 깨진 메뉴 제거

- 잘려서 보이지 않고 사이드바와 본문 링크를 반복하는 `More actions` 메뉴를 제거한다.
- 고유한 가치가 있다면 `Operations history`만 헤더의 낮은 우선순위 보조 링크로 남긴다.
- `Booking monitor`, Finance, Payments, Notifications, Cash settlements, Past records 링크는 가장 관련 있는 한 위치에만 남긴다.
- 헤더의 주 행동은 `Refresh`와 실제 `Next action`으로 제한한다.

메뉴를 살리는 방향은 기본 선택이 아니다. 제거가 더 작고 명확한 해결책이다.

### 8. 빈 분석 영역 축소

Booking flow, Shift outcome, Money flow, Customer activity가 모두 비어 있으면 큰 빈 카드 네 개를 렌더링하지 마라.

한 개의 compact 상태로 교체한다.

`No bookings or customer activity today. View last 7 days.`

데이터가 있을 때만 기존 차트 그리드를 보여준다. 비교 문구는 빈 상태와 모순되지 않도록 `0 requests today; 13 fewer than the same time yesterday`처럼 쓴다.

### 9. Partner 성과 영역을 운영 우선으로 변경

- `needsAttention`에 데이터가 있으면 이를 기본 탭으로 선택한다.
- 탭에 `Needs attention 5`처럼 건수를 표시하거나, 의미 없는 빈 탭은 숨긴다.
- 5개 탭이 데스크톱에서는 한 줄에 맞고 작은 화면에서는 균형 있게 2열로 배치되도록 수정한다.
- 모든 모드에서 12열을 보여주지 말고 모드별 핵심 열만 보여준다.
  - Needs attention: Partner, 문제, 마지막 활동, 담당/열기
  - Most active: Partner, App opens, Sessions, Last active
- `sessionized app opens` 같은 구현 용어를 `Partner app activity today` 같은 운영 문구로 바꾼다.
- 관련 Partner overview가 이미 있으면 성과 랭킹은 그쪽 이동 링크만 남겨도 된다. 새 페이지는 만들지 않는다.

### 10. 반응형과 접근성 수정

- 1024×768에서 상태 줄, `Refresh every 60s`, 헤더 액션과 메뉴가 잘리지 않아야 한다.
- freshness 정보를 `Today so far · Updated 16:11 ICT · All sources healthy`처럼 한 문장으로 줄인다.
- `Test data excluded`와 자동 갱신 주기는 도움말 또는 보조 텍스트로 내린다.
- `Update available`은 `New data — refresh`로 변경한다.
- Partner tablist에 `aria-controls`, 연결된 `tabpanel`, 좌우 화살표 키 이동과 명확한 focus 표시를 구현한다.
- Tab/Shift+Tab으로 모든 주요 행동에 접근 가능해야 한다.
- 200% 확대와 1024px에서 가로 페이지 스크롤, 잘린 CTA, 보이지 않는 메뉴가 없어야 한다.

## 권장 문구 기준

| 기존 | 변경 |
|---|---|
| Current clear | No live operational cases need action |
| Needs action now | Next action / Open queues |
| Legacy cleanup | Historical backlog (24h+) |
| Finance review ownership | Finance queues needing assignment |
| Owner Finance | Team: Finance · Assignee: Unassigned |
| 1 urgent · 1 backlog | 146 overdue · 108 unassigned · 84 backlog |
| Active match wait · None | No customers waiting for a match |
| Selected window | Today, 00:00–now (ICT) |
| Update available | New data — refresh |
| Ordered by sessionized app opens... | Partner app activity today |

실제 값이 다르면 하드코딩하지 말고 현재 데이터에서 계산한다.

## 구현 순서

### Phase A — 판단 오류 제거

1. 전역 Next action과 CTA 수정
2. Clear 의미 분리
3. 실제 assignee 전달 및 표시
4. 금융 숫자 단위 수정
5. historical backlog의 위험 tone과 요약 수정
6. More actions 제거

### Phase B — 첫 화면 밀도 정리

1. 헤더와 상태 줄 단순화
2. Clear 박스와 중복 CTA 제거
3. compact operator/queue context 추가
4. 1024px 레이아웃 수정

### Phase C — 분석과 Partner 영역 정리

1. 전체 empty analytics를 compact state로 통합
2. Partner Needs attention 기본 선택과 count
3. 모드별 테이블 열과 탭 레이아웃
4. 키보드 tab 접근성

각 Phase 후 관련 spec을 실행하고, 실패를 다음 Phase로 넘기지 마라. 그러나 중간 보고만 하고 멈추지 말고 전체 범위를 완료하라.

## 테스트 요구사항

기존 테스트 파일을 우선 확장한다.

- `apps/admin_web/app/start-shift-action-priority.spec.ts`
- `apps/admin_web/app/start-shift-finance-review-workload.spec.ts`
- `apps/admin_web/app/start-shift-operations-command-board.spec.ts`
- `apps/admin_web/components/start-shift-chart-widgets.spec.tsx`
- `apps/admin_web/components/start-shift-ranking-widgets.spec.tsx`

최소한 다음 회귀 조건을 자동화한다.

1. live booking이 0이어도 overdue Finance가 있으면 Finance가 Next action이 된다.
2. 실제 assignee/unassigned 값이 command board까지 보존된다.
3. 금전 위험은 24시간을 넘겨도 warning/danger를 유지한다.
4. 모든 분석 데이터가 비어 있으면 큰 빈 카드 네 개 대신 compact 상태 하나가 나온다.
5. Needs attention에 행이 있으면 기본 Partner 탭이 된다.
6. Partner 탭의 키보드 이동과 ARIA 연결이 유지된다.

다음 명령을 실행한다.

```powershell
npm.cmd run test --workspace @massage-vn/admin-web
npm.cmd run lint --workspace @massage-vn/admin-web
npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run verify:scope -- -Scope admin
```

API 코드를 실제로 수정한 경우에만 다음도 실행한다.

```powershell
npm.cmd run test --workspace @massage-vn/api
npm.cmd run lint --workspace @massage-vn/api
npm.cmd run typecheck --workspace @massage-vn/api
npm.cmd run verify:scope -- -Scope api
```

API source가 실행 중인 `dist/main.js`보다 새 것이면 기존 로컬 스크립트로 API를 rebuild/restart한 뒤 화면을 검증한다. 데이터 삭제, seed 재실행, migration 생성은 하지 마라.

## 브라우저 검증

코드 테스트만으로 완료 처리하지 마라. 로그인된 in-app browser에서 `/`를 다시 열고 다음 상태를 직접 확인한다.

1. 기본 데스크톱 화면
2. 1024×768
3. 200% 확대
4. Partner Needs attention 탭
5. Historical backlog 펼침/접힘
6. 키보드 Tab과 좌우 화살표 이동
7. 새 데이터가 있을 때 `New data — refresh`

수정 전과 수정 후를 같은 viewport에서 캡처한다. 최소한 다음 결과 화면을 저장한다.

- 상단 첫 화면
- 1024×768 첫 화면
- Partner Needs attention
- Historical backlog 펼침 상태

## 완료 기준

- 1024×768 첫 화면에서 스크롤 없이 `Next action`, 실시간 핵심 수치, overdue/unassigned 규모를 확인할 수 있다.
- 빈 Booking monitor가 최우선 CTA가 되지 않는다.
- `Clear`가 Finance와 historical 위험을 가리지 않는다.
- 모든 주요 숫자에 정확한 단위가 있다.
- Finance 카드에 team과 실제 assignee가 함께 보인다.
- historical backlog는 금액, 건수, 최장 경과와 적절한 경고 tone을 유지한다.
- 중복 CTA와 깨진 More actions가 없다.
- 빈 차트가 네 번 반복되지 않는다.
- Partner 주의 대상이 숨겨지지 않고 넓은 12열 표에 의존하지 않는다.
- 1024px 및 200% 확대에서 잘림과 가로 페이지 스크롤이 없다.
- 테스트, lint, typecheck, admin scope verification이 통과한다.
- 새 의존성, 새 DB 모델, 불필요한 API 계약 변경이 없다.

## 최종 보고 형식

완료 후 다음 순서로 간결하지만 빠짐없이 보고한다.

1. 운영자가 무엇을 더 빨리 판단할 수 있게 되었는지
2. 변경 파일 목록과 핵심 변경
3. 실행한 명령과 각각의 pass/fail/skipped 결과
4. 브라우저 검증 viewport와 캡처 경로
5. 보호 영역 수정 여부
6. 남은 위험 또는 의도적으로 보류한 항목
7. 다음으로 감사할 관리자 페이지 한 곳

완료 기준을 충족하지 못한 항목이 있으면 완료했다고 말하지 말고, 정확한 실패 원인과 재현 방법을 기록하라.

