# HANDS Admin Notification Delivery 최종 개선 구현 프롬프트

아래 전체 내용을 새 Codex 작업에 그대로 전달한다.

---

## 역할

너는 HANDS 관리자 웹의 Notification Delivery 운영 화면을 최종 개선하는 시니어 풀스택 엔지니어다. 화면을 예쁘게 꾸미는 것이 목적이 아니라, **운영자가 현재 문제와 누적 부채를 정확히 이해하고, 잘못된 정상 판정이나 위험한 재시도 없이 다음 행동을 완료하도록 만드는 것**이 목적이다.

운영자 화면의 사용자 모드는 `Operate`다. 장식보다 정확한 상태, 빠른 스캔, 안전한 행동, 감사 가능성, 반복 업무 속도를 우선한다.

## 최종 목표

`http://localhost:3101/notifications`와 관련 Admin Web/API 흐름을 수정해 다음을 모두 달성한다.

1. 최근 24시간 현재 상태와 24시간 이상 히스토리 부채가 항상 동시에 보인다.
2. 현재 한 큐가 0이라는 이유로 전체 전달 경로가 정상이라고 오판하지 않는다.
3. 실패 코드 안내와 실제 UI/API 재시도 허용 조건이 완전히 일치한다.
4. production, synthetic, unknown 데이터 범위를 과장 없이 구분한다.
5. 1440px 데스크톱의 실제 Admin 본문 폭에서 필터, 표, 마지막 열, 기본 액션이 잘리지 않는다.
6. 오래된 히스토리를 담당·확인·해결할 수 있는 운영 수명주기를 제공한다.
7. 히스토리와 no-route 화면의 불필요한 쿼리를 줄이고 측정 가능한 성능 개선을 만든다.
8. 기존 exact failure group, recipient grouping, 개인정보 마스킹, audit ordering, URL 필터 기능은 회귀시키지 않는다.

## 작업 위치와 필수 지침

- 저장소: `C:\dev\massage-on-demand-vn`
- 시작 전에 저장소 루트 `AGENTS.md`를 끝까지 읽고 따른다.
- 단일 에이전트로 작업한다. subagent, worker, handoff agent를 사용하지 않는다.
- 작업 트리가 매우 더러울 수 있다. 기존 변경은 사용자 작업이므로 되돌리거나 정리하지 않는다.
- 관련 없는 파일을 포맷하거나 리팩터링하지 않는다.
- 새 dependency, 새 UI framework, 새 generic workflow framework를 추가하지 않는다.
- 기존 helper, component, query, audit primitive, button/table/form atom을 먼저 재사용한다.
- 증상별 임시 분기를 여러 군데 추가하지 말고 모든 caller가 통과하는 가장 좁은 공통 지점에서 원인을 수정한다.
- Prisma schema/migration, shared types, auth, payments, wallet, booking, matching, infra는 protected area다. 정말 필요한 경우에만 영향 범위를 증명하고 해당 검증까지 수행한다.
- 1024px 이하 반응형·모바일·태블릿 작업은 이번 범위가 아니다. 기존 `Desktop required` 동작을 보존하되 새 모바일 최적화 코드는 만들지 않는다.
- 검사 기준은 `1440×900`과 `1600×900` 데스크톱이다.
- 실제 retry, push send, 데이터 mutation은 브라우저 검증 중 실행하지 않는다.

## 반드시 먼저 읽을 자료

### 기준 보고서

`C:\dev\massage-on-demand-vn\output\notifications-post-remediation-reaudit-2026-08-10\notifications-post-remediation-deep-reaudit.md`

### 현재 실행 화면 캡처

`C:\dev\massage-on-demand-vn\output\notifications-post-remediation-reaudit-2026-08-10\`

특히 다음을 비교한다.

- `01-default-top-light-1440x900.png`
- `02-healthy-history-menu-expanded-light-1440x900.png`
- `03-delivery-records-light-1440x900.png`
- `04-history-light-1440x900.png`
- `05-failure-group-detail-light-1440x900.png`
- `06-no-active-route-history-light-1440x900.png`
- `08-row-actions-open-dark-1440x900.png`
- `10-no-attempt-current-light-1440x900.png`
- `11-no-attempt-history-light-1440x900.png`
- `12-retry-confirmation-light-1440x900.png`

### 이전 구현 프롬프트

`C:\dev\massage-on-demand-vn\output\notifications-post-implementation-audit-2026-08-07\notifications-codex-implementation-prompt-2026-08-08.md`

이미 완료된 개선을 다시 설계하거나 제거하지 말고, 이번 재감사에서 남은 문제만 수정한다.

## 시작 절차

1. `git status --short`로 기존 변경 범위를 기록한다.
2. 위 보고서와 캡처를 읽고 현재 코드와 실제 화면이 일치하는지 확인한다.
3. 다음 파일과 모든 caller를 먼저 추적한다.

```text
apps/admin_web/app/notifications/page.tsx
apps/admin_web/app/notifications/notification-page-model.ts
apps/admin_web/app/notifications/notification-table-row.tsx
apps/admin_web/app/notifications/notification-action-confirmation.ts
apps/admin_web/app/notifications/notification-failure-copy.ts
apps/admin_web/app/notifications/notifications-table-section.tsx
apps/admin_web/app/notifications/actions.ts
apps/admin_web/app/globals.css

apps/api/src/admin/admin.service.ts
apps/api/src/admin/admin-notification-production-data.ts
apps/api/src/admin/admin-notification-unattempted-query.ts
apps/api/src/admin/admin-notification-retry-query.ts
apps/api/src/notifications/notifications.service.ts
```

4. 같은 Admin 시스템에서 이미 쓰는 row action menu, assignment/review lifecycle, status badge, filter chip, incident owner, audit log 패턴을 `rg`로 찾는다.
5. 변경 전 focused test를 실행해 baseline을 남긴다.
6. 구현 전에 현재 정상 판정, retry eligibility, data scope, summary query의 입력과 출력 계약을 짧게 정리한다.
7. 불필요한 새 구조 없이 P0부터 순서대로 구현한다.

## 절대 회귀시키지 말아야 할 현재 성과

- `No active route`는 notification 75,160행이 아니라 recipient/target role 단위로 묶인다.
- recipient 수와 notification 수가 구분된다.
- failure group은 provider + normalized failure code exact URL을 가진다.
- 선택 group의 list, total, summary predicate가 같다.
- 이름 없는 사용자는 전체 전화번호가 아니라 masked phone 또는 short ID로 보인다.
- retry requested audit이 enqueue 전에 기록된다.
- queued/failed/pending outcome이 correlation으로 추적된다.
- 이미 성공한 device path는 재시도 대상에서 제외된다.
- URL 기반 records 필터와 filtered empty state가 유지된다.
- manual Refresh가 현재 scope와 필터를 보존한다.
- retry confirmation의 필수 사유, permission, cancel, Escape 동작이 유지된다.

## P0-1. 거짓 정상 판정을 제거한다

### 현재 원인

`apps/admin_web/app/notifications/page.tsx`의 `allDeliveryPathsHealthy`는 현재 선택된 action/groups 모델의 `totalCount === 0`만 검사한다. failed, no-attempt, no-route, stale-route와 history debt를 전체적으로 보지 않는다.

### 구현 요구

1. `allDeliveryPathsHealthy`라는 과장된 boolean을 제거한다.
2. current와 history를 독립된 health contract로 만든다.
3. current clear는 적어도 다음 current 범위 수치가 모두 0일 때만 참이다.
   - failure groups
   - failed notifications
   - no-attempt notifications
   - recipients without active route
   - stale routes
4. history는 current clear 여부와 무관하게 별도 집계와 상태를 가진다.
5. 기본 `/notifications`에서 current와 historical backlog를 항상 동시에 표시한다.
6. 히스토리가 있으면 disclosure 안에 숨기지 않는다.
7. audited 숫자를 코드에 하드코딩하지 않는다. 모든 숫자는 현재 서버 응답에서 나온다.
8. summary 일부가 실패한 경우 정상으로 추정하지 않는다. `Status unavailable`과 retry/refresh 경로를 보여 준다.

### 권장 화면 구조

```text
Notification Delivery                                 [Refresh] [Delivery records]
Scope status · Generated time · Timezone

Current · under 24h
[Failure groups] [Failed] [No attempt] [No route] [Stale route]
No new delivery issues in the last 24 hours.

Historical backlog
[Failure groups] [Failed] [No attempt] [Recipients without route / notifications]
Oldest age · Unassigned count · [Open historical backlog]

Needs action table
```

### 문구 계약

- 사용 가능: `No new delivery issues in the last 24 hours`
- 사용 가능: `Current clear · Historical backlog needs review`
- 사용 금지: `All delivery paths healthy`
- 사용 금지: `No retry or route repair is required` — history 또는 scope unknown일 때
- 범위 문구에는 current/history와 timezone을 명시한다.

### 테스트

- current groups 0, failed > 0이면 clear가 아니다.
- current 전부 0, history > 0이면 current clear와 history backlog가 동시에 보인다.
- current/history 전부 0이고 scope verified일 때만 전체적으로 clear한 표현을 사용할 수 있다.
- summary error에서 healthy 문구가 나오지 않는다.
- default URL과 explicit `issue=groups`가 같은 의미를 가진다.

## P0-2. failure runbook과 retry API 조건을 일치시킨다

### 원칙

운영자 사유 입력은 감사 증거일 뿐 복구 증거가 아니다. UI에서 버튼을 숨기는 것만으로는 완료가 아니다. **API가 authoritative retry gate를 다시 검사해야 한다.**

### 최소 분류

기존 `notification-failure-copy.ts` 또는 가장 가까운 공통 helper를 확장하고 새 runbook framework를 만들지 않는다.

```ts
type NotificationRetryState = 'allowed' | 'conditional' | 'blocked';

type NotificationRetryDecision = {
  state: NotificationRetryState;
  failureClass: 'transient' | 'route-recovery' | 'payload-config' | 'unknown';
  reason: string;
  evidence?: string;
};
```

형태는 현재 코드에 맞게 최소화할 수 있지만 UI와 API가 같은 분류 계약을 사용해야 한다.

### 실패별 요구

| 실패 | 기본 상태 | 허용 증거 |
|---|---|---|
| transient provider/network | conditional/allowed | cooldown, attempt limit, active job dedupe 통과 |
| `UNREGISTERED` / token not registered | blocked 또는 conditional | 실패 시점 이후 등록된 새 enabled token/route |
| `INVALID_ARGUMENT` / invalid argument | blocked | 실패 시점 이후 수정된 authoritative payload/template/target version |
| credential mismatch / provider not configured | blocked | provider project/config readiness와 수정 버전 확인 |
| unknown/unclassified | blocked | 원인 분류 또는 명시적 recovery evidence |

### 안전한 최소 구현

- 현재 데이터 모델에 authoritative 수정 버전이나 readiness evidence가 없다면 억지 boolean이나 운영자 checkbox를 만들지 않는다.
- 증거가 없는 permanent/config 오류는 안전하게 `blocked`로 둔다.
- `Review & retry` 대신 `Retry blocked` 또는 `Review required`를 보여 주고 정확한 다음 행동을 제공한다.
- 새 token처럼 현재 timestamp로 증명 가능한 조건만 자동으로 conditional → allowed 전환한다.
- 동일 notification/device/recovery-version의 active retry가 있으면 중복 enqueue를 거절한다.
- attempt limit와 cooldown이 기존에 있다면 재사용하고, 없다면 현재 queue primitive에서 가장 작은 server-side guard를 구현한다.
- 이미 성공한 device exclusion은 유지한다.
- raw token, full device ID, provider response body를 UI/audit/job metadata에 넣지 않는다.

### API 응답

409 또는 현재 프로젝트의 안전한 domain error 계약으로 다음을 구분한다.

- no eligible path
- retry blocked by failure policy
- recovery evidence missing
- retry already queued
- cooldown/attempt limit

웹은 이를 generic failure나 `Nothing was queued`로 뭉개지 않고 운영자가 이해할 문구로 변환한다.

### 테스트

- `INVALID_ARGUMENT`은 reason만 입력해도 enqueue되지 않는다.
- credential mismatch/provider not configured는 readiness evidence 전까지 enqueue되지 않는다.
- token failure는 실패 이후 새 enabled route가 있을 때만 허용된다.
- transient failure는 기존 성공 path를 제외하고 한 번만 enqueue된다.
- request audit 실패 시 enqueue되지 않는다.
- enqueue 성공 + outcome audit 실패의 degraded 응답과 correlation은 유지된다.
- UI model의 retry state와 API 판단이 같은 fixture에서 일치한다.
- blocked row에는 enabled retry submit action이 없다.

## P0-3. 운영 데이터 범위를 과장 없이 확정한다

### 금지 사항

- 이름에 `Smoke`, `Demo`, `Audit`가 있다는 이유만으로 production 여부를 판단하지 않는다.
- 검증 근거 없이 `Production verified` 또는 `Test data excluded`라고 쓰지 않는다.
- UI 문구만 변경하고 aggregate query는 그대로 두지 않는다.

### 구현 순서

1. notification 생성 경로와 기존 metadata를 조사한다.
2. 현재 저장된 명시적 fixture/smoke/seed flag와 data-scope metadata를 재사용한다.
3. 서버 응답에 최소한 다음 범위를 구분한다.

```ts
type NotificationDataScope = 'production' | 'mixed' | 'unknown';
```

4. explicit production으로 증명된 집계, known synthetic 제외 수, unknown 수를 구분할 수 있으면 함께 제공한다.
5. legacy unknown을 production으로 간주하지 않는다.
6. unknown이 있으면 화면은 `Scope unverified` 또는 `Mixed/unknown data excluded from production totals`처럼 정확히 표시한다.
7. production 집계와 unknown/data-quality 큐를 분리한다.
8. 기존 필터로 명백히 식별 가능한 smoke/seed/fixture는 계속 제외한다.

### schema 변경 판단

- 먼저 기존 JSON metadata, audit metadata, explicit flags, 생성 caller로 해결 가능한지 확인한다.
- 새 authoritative field 없이는 앞으로의 데이터 분류가 불가능한 것이 증명되면 최소 schema/migration을 제안 또는 구현할 수 있다.
- schema를 바꾸면 모든 notification 생성 caller를 함께 수정하고 backfill/legacy unknown 정책, rollback, protected-area 검증을 수행한다.
- 단지 배지를 `verified`로 바꾸기 위한 schema 변경은 하지 않는다.

### 테스트

- known synthetic는 production aggregate에서 제외된다.
- unknown은 production에 포함되지 않고 별도 수치 또는 scope 상태로 드러난다.
- 이름만 `Demo`인 정상 사용자는 문자열 휴리스틱으로 제외되지 않는다.
- summary와 list가 같은 scope predicate를 사용한다.
- partial source failure에서 production verified로 승격되지 않는다.

## P1-1. 1440 실제 본문 폭에서 레이아웃을 고친다

viewport 1440px 자체가 아니라 사이드바를 제외한 약 1,000~1,100px Admin main content 폭을 기준으로 검사한다.

### 표

No active route 기본 표는 다음 핵심 열을 우선한다.

```text
Recipient | Role | Alerts | First / Last | Route state | Next action
```

요구사항:

- 1440×900에서 page-level horizontal scroll이 없다.
- 마지막 헤더와 기본 CTA가 완전히 보인다.
- `Open recipient`, `Review & retry`, `Audit trail` 기본 버튼이 한 줄이다.
- action column은 최소 152~168px과 `white-space: nowrap`을 확보한다.
- 행 높이는 보통 56~64px 범위이며 한 행의 텍스트가 불필요하게 3줄 이상 되지 않는다.
- 기술 ID, 긴 provider response, 보조 metadata는 상세/확장/audit trail로 보낸다.
- 빈 표는 수평 스크롤을 만들지 않는다.
- 내부 table scroll이 꼭 필요한 record view는 마지막 열이 잘리지 않고 키보드로 접근 가능해야 한다.
- viewport breakpoint만으로 해결하지 말고 기존 구조가 허용하면 container query 또는 table-specific column contract를 사용한다.
- 새 범용 테이블 시스템을 만들지 않는다.

### Delivery records 필터

권장 구조:

```text
[Search________________________________] [Status] [Channel] [Apply]
[Role] [Period] [Sort]          [Active filters] [Clear]
```

요구사항:

- 검색 360~420px 수준, select 136~156px 수준을 실제 본문 폭에 맞게 조정한다.
- 전체 필터 높이는 가급적 112px 이내다.
- 결과 수와 table header가 900px 첫 화면에 들어온다.
- search placeholder 전체가 읽힌다.
- active filter를 기존 chip/badge 패턴으로 표시하고 개별 제거 또는 전체 clear가 가능하다.
- Apply/Clear가 문자 단위로 줄바꿈되지 않는다.
- 기존 URL query, pagination, reset 의미를 유지한다.

### failure group selector와 table

- active card의 텍스트가 의미 없이 분리되지 않는다.
- 5개 issue를 한 줄에 억지로 채우지 말고 본문 폭에서 안정적인 grid를 사용한다.
- failure cause, provider/raw code, last occurrence, next action이 잘리지 않는다.
- raw code는 읽기 가능한 separator 기준으로만 개행한다.

## P1-2. 행 액션 메뉴의 키보드 계약을 완성한다

현재 `<details>` 기반 메뉴는 Escape로 닫히지 않는다.

요구사항:

- 먼저 저장소의 기존 accessible row action/dropdown component를 찾고 재사용한다.
- 없을 때만 notifications에 필요한 최소 controller를 구현한다.
- trigger에 `aria-expanded`, `aria-controls`, 명확한 accessible name을 제공한다.
- Escape, 바깥 클릭, 다른 메뉴 열기, route change에서 닫힌다.
- 닫힌 뒤 focus가 trigger로 돌아온다.
- Tab/Shift+Tab 순서가 자연스럽고 메뉴가 화면 밖으로 잘리지 않는다.
- primary action은 메뉴 밖, secondary action만 메뉴 안에 둔다.
- 동일 action을 두 군데서 별도로 생성하지 말고 기존 action model을 재사용한다.

테스트:

- open → Escape → closed → focus trigger
- outside click close
- second menu open 시 first menu close
- accessible name에 full phone/raw ID 없음

## P1-3. 히스토리를 조회 목록이 아닌 처리 큐로 만든다

먼저 저장소에 이미 존재하는 assignment, review status, incident owner, acknowledgement, resolution note 모델을 검색한다. 가장 가까운 기존 primitive를 재사용한다. notification 전용 범용 workflow engine은 만들지 않는다.

최소 필요 상태:

```text
Open → Investigating → Waiting for fix → Ready to retry → Resolved
                                      ↘ Accepted debt
```

필수 정보:

- severity
- owner 또는 owner team
- status
- acknowledgedAt / lastReviewedAt
- oldest age와 age bucket
- recovery/resolution evidence
- resolution note와 audit trail

요구사항:

- 히스토리 상단에 oldest age, unassigned count, 30d+ count를 표시한다.
- 24~72h, 3~7d, 8~30d, 30d+ 필터 또는 요약을 제공한다.
- terminal 상태는 해결 근거 없이 설정할 수 없다.
- assignment/status 변경은 permission과 audit log를 가진다.
- bulk assignment는 기존 bulk action 패턴이 있을 때만 추가한다.
- 기존 persistent primitive가 없고 schema 변경이 너무 큰 경우, 읽기 전용 age/severity/next action 개선을 먼저 완료하고 persistence blocker를 코드 근거와 함께 명시한다. 완료되지 않은 것을 완료라고 보고하지 않는다.

## P1-4. summary와 history 성능을 개선한다

### 현재 관찰값

- default warm route: 약 0.89초
- history groups: 약 2.61초
- delivery records all: 약 2.73초
- no-route history: 약 3.87초

이 값은 로컬 관찰치이며 성능 회귀 기준선으로만 사용한다.

### 요구사항

1. `admin.service.ts`의 notification summary가 현재 view에 필요하지 않은 집계를 함께 실행하는지 확인한다.
2. 경량 header summary와 issue-specific detail query를 가능한 최소 변경으로 분리한다.
3. `mode`, `issue`, `scope`별로 필요한 쿼리만 실행한다.
4. no-route/unattempted/group history query를 `EXPLAIN (ANALYZE, BUFFERS)` 또는 현재 저장소의 안전한 쿼리 분석 방식으로 확인한다.
5. 인덱스는 측정 근거가 있을 때만 추가한다.
6. 큰 history list는 기존 cursor pagination을 유지하거나 복구한다.
7. 집계 캐시는 필요성이 측정될 때만 기존 cache primitive로 추가한다. 새 cache layer를 만들지 않는다.
8. cache가 action 가능한 row의 신선도를 가리지 않게 한다.
9. partial query failure와 stale/generated timestamp를 정확히 표시한다.

권장 목표:

- warm 내부 전환 first useful content P75 ≤ 1.5초
- 필터 적용 후 결과 갱신 P75 ≤ 1.0초
- row action feedback ≤ 300ms

환경 차이로 목표를 증명할 수 없으면 before/after 동일 조건을 최소 3회 측정해 median과 한계를 보고한다.

## P2. 문구와 시각 마감

- 접힌 `Review records and 24h+ history` disclosure는 제거하거나 운영 부채가 없을 때만 보조 탐색으로 사용한다.
- 링크가 `Open delivery recordsOpen 24h+ history`처럼 붙어 보이지 않게 한다.
- active purple button/background와 일반 텍스트 대비를 4.5:1 이상으로 조정한다.
- 기존 디자인 토큰을 수정하거나 page-specific token override를 최소 범위로 사용한다.
- current clear는 성공 tone, historical backlog는 warning/neutral debt tone으로 구분한다.
- 색상만으로 상태를 전달하지 않는다.
- focus-visible, disabled, loading, error, empty, filtered-empty 상태를 구분한다.
- 숫자는 locale formatting을 유지한다.
- `Partner` user-facing terminology를 유지하고 Provider 용어를 새로 노출하지 않는다.
- 날짜·시간은 Asia/Ho_Chi_Minh 기준과 생성 시각을 명확히 한다.
- 새 아이콘 라이브러리나 장식용 그래픽은 추가하지 않는다.

## 상태별 필수 화면 계약

다음 상태를 모두 코드와 테스트에서 다룬다.

1. current 문제 있음 + history 있음
2. current clear + history 있음
3. current clear + history clear + production verified
4. summary error + list success
5. summary success + list error
6. filtered empty
7. true empty
8. scope mixed/unknown
9. retry allowed
10. retry conditional/blocked
11. retry already queued
12. audit outcome pending/degraded
13. permission denied
14. out-of-range pagination redirect

## 데이터 및 UI 계약 예시

현재 프로젝트 타입에 맞게 최소화하되 의미를 잃지 않는다.

```ts
type NotificationDeliveryHealth = {
  scope: 'production' | 'mixed' | 'unknown';
  generatedAt: string;
  current: {
    failureGroups: number;
    failedNotifications: number;
    unattemptedNotifications: number;
    recipientsWithoutRoute: number;
    staleRoutes: number;
  };
  history: {
    failureGroups: number;
    failedNotifications: number;
    unattemptedNotifications: number;
    recipientsWithoutRoute: number;
    notificationsWithoutRoute: number;
    oldestAt: string | null;
    unassignedCount?: number;
  };
};
```

이 타입을 그대로 새 shared type으로 만들라는 뜻은 아니다. 기존 API DTO와 model에 가장 작은 diff로 같은 의미를 구현한다.

## 테스트 요구

source string 존재 검사만 추가하지 말고 URL, view model, rendered markup, API predicate, server outcome을 검증하는 행동 테스트를 우선한다.

반드시 추가하거나 수정할 계약:

1. current/history 독립 health와 거짓 healthy 방지
2. current clear + history backlog 동시 렌더링
3. summary/list error에서 healthy 문구 금지
4. retry failure class별 allowed/conditional/blocked
5. permanent/config 오류 server-side enqueue 차단
6. token recovery timestamp 조건
7. active retry dedupe와 기존 successful-device exclusion
8. production/synthetic/unknown scope predicate 일치
9. 1440 main content width에서 마지막 action visible
10. 빈 표 overflow 없음
11. filter URL/pagination/reset 회귀 없음
12. row action Escape/outside click/focus return
13. full phone/raw token/full device ID DOM 비노출
14. history owner/status/evidence 계약 — 구현 범위에 포함된 경우
15. legacy redirect와 permission guard 유지

## baseline 및 최종 검증 명령

변경 전과 후에 관련 focused test를 실행한다. 새 spec을 만들면 명령에 포함한다.

### Admin Web

```powershell
npm.cmd run test -w @massage-vn/admin-web -- app/notifications/page.spec.tsx app/notifications/notification-page-model.spec.ts app/notifications/notification-delivery-ops-queue-section.spec.tsx app/notifications/notifications-table-section.spec.tsx app/notifications/notification-action-confirmation.spec.ts app/notifications/actions.spec.ts
npm.cmd run typecheck -w @massage-vn/admin-web
npm.cmd run build -w @massage-vn/admin-web
```

### Admin Web focused lint

```powershell
Set-Location apps/admin_web
npx.cmd eslint app/notifications/page.tsx app/notifications/notification-page-model.ts app/notifications/notification-table-row.tsx app/notifications/notifications-table-section.tsx app/notifications/notification-action-confirmation.ts app/notifications/notification-failure-copy.ts app/notifications/actions.ts
Set-Location ../..
```

### API

```powershell
npm.cmd run test -w @massage-vn/api -- src/admin/admin-notification-production-data.spec.ts src/admin/admin-notification-retry-query.spec.ts src/admin/admin-notification-unattempted-query.spec.ts src/admin/admin-notification-device-health-query.spec.ts src/notifications/notification-retry-audit.spec.ts src/notifications/notifications.service.spec.ts src/notifications/notifications.processor.spec.ts
npm.cmd run typecheck -w @massage-vn/api
```

### Scope와 보안

```powershell
npm.cmd run security:admin-sensitive
npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api
```

### UI detector

UI 수정이 끝난 뒤 한 번만 실행한다.

```powershell
node C:\Users\laboy\.codex\skills\impeccable\scripts\detect.mjs --json apps/admin_web/app/notifications apps/admin_web/app/globals.css
```

명령이나 spec이 현재 저장소에 없으면 성공으로 포장하지 않는다. 존재하는 가장 가까운 focused 명령을 실행하고 대체 사유를 최종 보고한다. unrelated dirty worktree 때문에 실패하면 명령, 첫 root cause, 이번 변경과의 관련성을 구분한다.

protected area를 변경했다면 저장소 `AGENTS.md`의 full local verification 요구를 따른다.

## 실제 브라우저 검증

로그인된 in-app browser를 사용한다. 현재 run에서 새로 캡처하고 과거 캡처를 최종 증거로 재사용하지 않는다.

### 안전 규칙

- 3101 listener를 재기동해야 하면 PID, command line, working directory를 먼저 확인한다.
- 모든 `node.exe`를 종료하지 않는다.
- 실제 retry submit, push send, assignment/status mutation은 실행하지 않는다.
- confirmation은 열 수 있지만 제출하지 않는다.
- 브라우저 검증 전 현재 source/build가 실행 중인지 확인한다.

### 1440×900 필수 캡처

1. default current clear + historical backlog 동시 표시
2. current issue selector와 Needs action table
3. 24h+ failure groups
4. exact FCM/INVALID_ARGUMENT group과 blocked retry 상태
5. no active route recipient grouping과 마지막 action 열
6. no attempt current empty
7. no attempt history와 age/owner/status 정보
8. delivery records 필터와 table header가 첫 화면에 보이는 상태
9. active filter + filtered empty
10. row action menu open light 또는 dark
11. retry blocked 설명 또는 allowed confirmation — 제출 전
12. mixed/unknown scope 표시

### 1600×900 필수 캡처

1. default/current/history 구조
2. delivery records filter와 table
3. failure group table의 마지막 action 열

### 각 화면 공통 확인

- page-level horizontal scroll 없음
- 핵심 표의 마지막 열과 기본 action 잘림 없음
- 기본 action 한 줄
- selected mode/issue/scope 명확
- current와 history가 동시에 해석 가능
- production/mixed/unknown 범위가 정확
- keyboard focus와 Escape 동작 정상
- full phone, raw token, full device ID가 DOM/accessible name에 없음
- console warning/error 0건 — HMR 개발 로그는 별도 구분
- light/dark에서 같은 정보 구조 유지

새 증거 폴더:

`C:\dev\massage-on-demand-vn\output\notifications-final-remediation-verification-2026-08-10\`

## 최종 완료 기준

다음 항목을 모두 확인하기 전에는 `완료`라고 하지 않는다.

- [ ] 현재 한 issue가 0이라는 이유로 전체 healthy가 되지 않는다.
- [ ] current clear와 history backlog가 기본 화면에 동시에 보인다.
- [ ] disclosure를 열지 않아도 historical debt 규모를 알 수 있다.
- [ ] permanent/config failure는 복구 증거 전까지 API에서 retry가 차단된다.
- [ ] UI retry 상태와 API retry decision이 같은 계약을 사용한다.
- [ ] reason 입력만으로 blocked retry가 허용되지 않는다.
- [ ] active retry dedupe와 successful-device exclusion이 유지된다.
- [ ] production/synthetic/unknown 범위가 서버 predicate와 UI 문구에서 일치한다.
- [ ] 1440×900에서 필터, failure code, 마지막 헤더, 기본 CTA가 잘리지 않는다.
- [ ] 빈 표에 불필요한 수평 스크롤이 없다.
- [ ] row action menu가 Escape·외부 클릭으로 닫히고 포커스가 복귀한다.
- [ ] 히스토리 항목을 owner/status/evidence로 종결할 수 있거나, persistence blocker가 정확히 증명돼 있다.
- [ ] 성능 before/after가 동일 조건으로 측정되고 악화되지 않는다.
- [ ] 기존 exact group, no-route grouping, PII mask, audit correlation, filter URL이 회귀하지 않는다.
- [ ] focused tests, typecheck, build, lint, scope/security 검증 결과가 기록된다.
- [ ] 현재 source와 일치하는 새 1440/1600 캡처가 저장된다.

## 하지 말아야 할 구현

- `All delivery paths healthy`를 다른 긍정 문구로만 바꾸고 boolean 로직을 유지하지 않는다.
- 히스토리 숫자를 audited 캡처 값으로 하드코딩하지 않는다.
- UI에서 retry 버튼만 숨기고 API를 그대로 두지 않는다.
- 운영자가 체크박스를 누른 것을 recovery evidence로 간주하지 않는다.
- 이름 문자열로 synthetic 데이터를 추정하지 않는다.
- `overflow: hidden`으로 마지막 열을 가려 레이아웃 문제를 숨기지 않는다.
- 모든 표를 새 범용 table framework로 교체하지 않는다.
- notification만을 위한 거대한 workflow engine을 만들지 않는다.
- 성능 측정 없이 index/cache/dependency를 추가하지 않는다.
- 모바일 레이아웃을 새로 만들지 않는다.
- unrelated dirty changes를 정리하거나 revert하지 않는다.

## 구현 우선순위

1. 거짓 정상 판정 제거와 current/history 동시 구조
2. retry server-side safety gate
3. production/synthetic/unknown 데이터 신뢰 경계
4. 1440 실제 본문 폭 레이아웃
5. row action keyboard 계약
6. history 운영 수명주기
7. summary/history 성능
8. 문구·대비·시각 마감

P0가 실패한 상태에서 P2 시각 마감으로 완료 처리하지 않는다.

## 최종 보고 형식

작업 후 다음 순서로 보고한다.

1. 운영자 관점에서 실제로 달라진 결과
2. P0/P1/P2별 완료·부분 완료·미완료 표
3. 거짓 healthy 판정의 before/after 계약
4. failure class별 retry decision과 API 강제 조건
5. production/synthetic/unknown 데이터 범위의 before/after
6. 1440 레이아웃과 history lifecycle 결과
7. 성능 동일 조건 before/after 표
8. 변경 파일과 각 파일을 바꾼 이유
9. 실행한 명령과 pass/fail/skipped 결과
10. 새 1440/1600 캡처 링크
11. 개인정보·권한·audit·retry safety 검증
12. protected area touched 여부와 추가 검증
13. 남은 위험과 다음 권장 작업 하나

반드시 구체적인 증거를 포함한다.

- current 0 + history > 0 fixture의 렌더 결과
- blocked `INVALID_ARGUMENT` retry API 테스트
- token recovery timestamp 테스트
- data scope predicate 테스트
- 1440 마지막 열 캡처
- row menu Escape/focus 테스트
- focused test 개수와 결과
- browser console 결과

일부 항목이 기술적으로 불가능해도 가능한 독립 항목은 모두 완료한다. 완료되지 않은 항목은 성공으로 포장하지 말고 blocker, 코드 근거, 안전한 최소 대안, 다음 한 단계를 보고한다.

최종 성공 기준은 기능 개수나 카드 수가 아니다. **운영자가 현재 문제와 오래된 부채를 동시에 보고, 올바른 담당과 다음 행동을 선택하며, 증거 없는 retry나 오염된 집계 없이 업무를 안전하게 끝낼 수 있어야 한다.**
