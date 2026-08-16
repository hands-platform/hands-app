# HANDS Admin Notification Delivery 최종 보완 구현 프롬프트

아래 전체 내용을 새 Codex 작업에 그대로 전달한다. 이 문서는 분석을 다시 요청하는 프롬프트가 아니라, 2026-08-12 최종 재감사에서 확인된 잔여 문제를 실제 코드로 수정하고 검증하기 위한 실행 지시서다.

---

## 역할과 운영 관점

너는 HANDS 관리자 웹의 `Notification Delivery`를 출시 가능한 수준으로 마무리하는 시니어 풀스택 엔지니어다.

이 화면의 주 사용자는 프로그래머가 아니라 **혼자 운영 업무를 처리하는 관리자**다. 예쁜 카드의 수보다 다음을 우선한다.

1. 화면의 숫자와 데이터 범위를 믿을 수 있어야 한다.
2. 운영자가 문제 원인과 다음 행동을 빠르게 구분할 수 있어야 한다.
3. 증거 없는 retry나 잘못된 정상 판정이 서버에서 차단되어야 한다.
4. 오래된 전달 부채를 검토하고 종결할 수 있어야 한다.
5. 1440px 이상 데스크톱에서 핵심 큐가 첫 화면 가까이에 보이고 표가 잘리지 않아야 한다.

디자인 polish만 하고 완료하지 말라. 이번 작업의 핵심은 **data contract, query semantics, deep link, health 의미, 운영 수명주기, 성능, 1440px 레이아웃을 함께 바로잡는 것**이다.

## 작업 위치와 기준 자료

- 저장소: `C:\dev\massage-on-demand-vn`
- 대상 화면: `http://localhost:3101/notifications`
- 기준 보고서: `C:\dev\massage-on-demand-vn\docs\audits\notifications-final-reaudit-2026-08-12.md`
- 화면·DOM 증빙: `C:\dev\massage-on-demand-vn\docs\audits\notifications-final-reaudit-evidence-2026-08-12\`
- 이전 구현 프롬프트: `C:\dev\massage-on-demand-vn\output\notifications-post-remediation-reaudit-2026-08-10\notifications-final-remediation-codex-prompt-2026-08-10.md`

시작 전에 저장소 루트의 `AGENTS.md`를 끝까지 읽고 따른다. 기준 보고서를 먼저 읽고, 관련 소스와 현재 실행 화면을 다시 확인한 뒤 수정한다.

특히 다음 증빙을 확인한다.

- `01-default-needs-action-1440x1000.png`: Production 기본 화면
- `03-unknown-source-1440x1000.png`: Unknown source의 current/history 상태
- `05-no-route-current-table-1440x1000.png`: no-route 표
- `06-no-route-row-actions-1440x1000.png`: 행 메뉴와 1440 clipping
- `07b-mark-reviewed-confirmation-stable-1440x1000.png`: Mark reviewed 확인창
- `10-failure-groups-history-top-1440x1000.png`: history failure groups 상단
- `11-failure-groups-history-table-1440x1000.png`: failure group 표
- `12b-broken-failure-group-deeplink-1440x1000.png`: 깨진 self-generated deep link
- `14-unknown-delivery-records-top-1440x1000.png`: Unknown records 0건 모순
- `15b-scoped-failure-result-1440x1000.png`: source를 보존한 exact filter 결과
- `16-failed-row-actions-1440x1000.png`: Retry blocked 행
- `18-production-default-dark-1440x1000.png`: 다크 테마
- `19-notification-audit-trail-1440x1000.png`: 0건 Audit trail
- `20-failure-groups-history-1600x1000.png`: 1600px 표
- `21-fcm-exact-group-1440x1000.png`: 허용된 FCM exact group

감사 당시 점수는 **69/100, 운영 승인 보류**였다. 숫자를 억지로 올리는 것이 아니라 아래 수용 기준을 증거와 함께 충족하는 것이 목표다.

## 작업 방식과 안전 경계

- 단일 에이전트로 끝까지 작업한다. subagent나 worker를 사용하지 않는다.
- `git status --short`로 시작 상태를 기록한다.
- 작업 트리의 기존 변경은 사용자 작업이다. 관련 없는 변경을 revert, reset, cleanup, reformat하지 않는다.
- 문제와 관련된 가장 좁은 공통 지점을 수정한다. 화면마다 임시 분기를 복제하지 않는다.
- 새 UI framework, 상태 관리 라이브러리, table framework, workflow engine, cache layer를 추가하지 않는다.
- 기존 helper, DTO, audit primitive, button/table/form component, query builder를 먼저 재사용한다.
- 스키마 변경은 기존 JSON metadata와 서비스 계약으로 해결할 수 없는 것이 확인된 경우에만 한다.
- Prisma schema/migration, shared types, auth, payments, wallet, bookings, matching, infra는 protected area다. 수정하면 `AGENTS.md`의 추가 검증을 수행한다.
- 실제 운영 데이터는 이름에 `Demo`, `Smoke`, `Audit`가 있다는 이유만으로 분류하거나 backfill하지 않는다.
- 실제 retry, push send, review submit, 상태 변경은 브라우저 검증에서 실행하지 않는다. mutation은 격리된 테스트 fixture로 검증한다.
- 모든 `node.exe` 프로세스를 일괄 종료하지 않는다. 서버 재기동이 필요하면 3101 listener의 PID, command line, working directory를 먼저 확인한다.
- 1024px 이하의 모바일·태블릿·반응형 디자인은 이번 작업과 검증 범위에서 **완전히 제외**한다.
- UI 검증 기준은 `1440×1000`과 `1600×1000`이다.
- 완료되지 않은 항목은 성공으로 포장하지 않는다. blocker, 코드 근거, 안전한 최소 대안을 기록한다.
- 사용자 요청 없이 commit하지 않는다.

## 이미 잘된 부분과 반드시 보존할 계약

다음 기능은 이전 개선으로 좋아졌으므로 제거하거나 약화하지 않는다.

- current 24시간과 24시간 이상 history debt가 기본 화면에서 함께 보인다.
- 정상 문구가 `No new delivery issues in the last 24 hours`처럼 범위를 명시한다.
- Production / Unknown source / Synthetic 범위를 운영자가 전환할 수 있다.
- retry API가 `notificationRetryDecision`을 다시 검사한다.
- permanent/config failure, cooldown, 시도 횟수, active retry 중복, 이미 성공한 path가 서버에서 차단된다.
- recipient와 notification 수를 구분하고 no-route를 recipient 단위로 묶는다.
- 행 액션 메뉴가 Escape로 닫히고 포커스가 trigger로 돌아온다.
- Admin system legacy alert의 `Mark reviewed`는 사유를 요구하고 감사 가능하다.
- URL 기반 records 필터, pagination, Refresh context가 유지된다.
- 전체 전화번호, raw push token, 전체 device ID를 목록과 accessible name에 노출하지 않는다.
- light/dark theme에서 같은 정보 구조를 유지한다.

이 기능들의 테스트가 이미 있다면 유지하고, 이번 변경으로 회귀하지 않았음을 최종 검증한다.

## 먼저 수행할 진단

수정 전에 다음을 수행하고 짧은 baseline을 남긴다.

1. 기준 보고서와 증빙을 읽는다.
2. 현재 `/notifications`를 1440×1000에서 확인한다.
3. 아래 심볼과 모든 caller를 `rg`로 추적한다.

```text
notificationDeliveryHealthTotals
normalizeNotificationFailureProvider
buildNotificationDeliveryView
buildNotificationDeliveryHref
adminNotificationDataScopeWhere
notificationDataWithRuntimeScope
notificationRetryDecision
adminNotificationNoRoute
Notification.create / notification.create
AuditEvidenceDrawer
```

4. 다음 파일과 관련 spec을 우선 확인한다.

```text
apps/admin_web/app/notifications/page.tsx
apps/admin_web/app/notifications/notification-page-model.ts
apps/admin_web/app/notifications/notification-table-row.tsx
apps/admin_web/app/notifications/notifications-table-section.tsx
apps/admin_web/app/notifications/notification-action-confirmation.ts
apps/admin_web/app/notifications/notification-failure-copy.ts
apps/admin_web/app/notifications/actions.ts
apps/admin_web/app/globals.css
apps/admin_web/components/action-menu.tsx

apps/api/src/admin/admin-notification-production-data.ts
apps/api/src/admin/admin-notification-retry-query.ts
apps/api/src/admin/admin-notification-unattempted-query.ts
apps/api/src/admin/admin-background-jobs.service.ts
apps/api/src/admin/admin.service.ts
apps/api/src/notifications/notifications.service.ts
apps/api/src/referrals/referrals.service.ts

infra/scripts/check-notification-retry-audit-contract.mjs
```

5. 감사에서 확인한 7개 direct `notification.create()` 호출이 현재도 존재하는지 다시 찾는다. 호출 수가 달라졌다면 실제 caller 목록을 기준으로 작업한다.
6. Production, Unknown, Synthetic의 list count, records query, action summary가 각각 어떤 predicate를 사용하는지 표로 정리한다.
7. current health와 history health에서 실행되는 쿼리 수와 의존성을 기록한다.
8. 관련 focused test, typecheck, contract test를 변경 전 한 번 실행해 baseline을 남긴다.

진단만 하고 작업을 멈추지 말고, P0부터 실제 구현을 계속한다.

---

## P0-1. `dataScope`와 `deliveryIntent`를 하나의 생성·조회 계약으로 통일한다

### 현재 확인된 문제

감사 화면에서는 다음 세 답이 동시에 나왔다.

```text
Production records: 0
Unknown delivery records: 0
Unknown historical action signals: 2,477
```

또한 current no-route에 `Background Job Queue Stale` 같은 Admin system in-app alert 4건이 push route 문제처럼 나타났다.

원인은 다음과 같다.

- 중앙 `NotificationsService.persist()`는 runtime scope를 기록하지만 일부 direct create caller가 이를 우회한다.
- raw SQL은 missing `dataScope`를 `COALESCE`로 Unknown 처리한다.
- Prisma predicate는 JSON path의 중첩 `NOT`을 사용해 actual PostgreSQL missing-key 의미가 raw SQL과 다를 가능성이 있다.
- no-route/no-attempt health query가 notification의 실제 push delivery intent를 충분히 제한하지 않는다.

### 구현 계약

현재 데이터 모델과 shared type 구조를 먼저 확인한 뒤, 모든 생성 경로가 최소 다음 의미를 기록하게 한다.

```ts
type NotificationDataScope = 'production' | 'synthetic' | 'unknown';
type NotificationDeliveryIntent = 'PUSH' | 'IN_APP_ONLY' | 'PUSH_AND_IN_APP';
```

이 타입을 무조건 새 shared type으로 추가하라는 뜻은 아니다. 기존 metadata/DTO에 같은 의미가 있다면 재사용하고 가장 작은 diff로 통일한다.

반드시 다음을 구현한다.

1. transaction 내부 direct create를 포함한 모든 Notification 생성 경로가 한 공통 pure helper를 통해 scope와 delivery intent metadata를 생성한다.
2. helper는 기존 `notificationDataWithRuntimeScope()`를 확장하거나 그와 인접한 가장 작은 공통 지점에 둔다.
3. `admin.system.*`가 제품 정책상 in-app only라면 `IN_APP_ONLY`를 명시하고 push no-route, no-attempt, stale-route 집계에서 제외한다.
4. customer/Partner에게 실제 push를 발송하는 wallet, referral, finance 등 direct persisted notification은 실제 정책에 따라 `PUSH` 또는 `PUSH_AND_IN_APP`을 명시한다.
5. 역할 이름만 보고 intent를 추정하지 않는다. notification 생성 목적과 실제 enqueue/send 경로를 근거로 결정한다.
6. Production/Unknown/Synthetic의 다음 네 곳이 동일한 canonical scope predicate를 사용하게 한다.
   - source 전체 count
   - Delivery records list/count
   - current action health
   - historical action health
7. raw SQL과 Prisma에서 missing key가 동일하게 Unknown으로 분류되도록 한다. 가능하면 predicate 계약을 한 모듈에 모으고, 중복된 독자 구현을 줄인다.
8. actual PostgreSQL integration test로 다음 fixture를 검증한다.
   - missing `dataScope`
   - explicit `production`
   - explicit `synthetic`
   - malformed/unsupported value
9. 세 scope는 겹치지 않아야 하며, 분류 대상 전체 합계와 일치해야 한다. malformed 값의 안전한 정책은 Unknown이다.
10. no-route/no-attempt/stale-route query에는 push intent 조건을 적용한다. 단순히 active device가 없다는 이유만으로 in-app notification을 문제로 분류하지 않는다.
11. 모든 direct create caller가 scope와 intent metadata를 가지는 행동 테스트 또는 좁은 contract test를 추가한다. source string 존재 검사만으로 끝내지 않는다.
12. legacy row를 자동 backfill할 때 이름/ID 휴리스틱을 쓰지 않는다. authoritative creation source나 fixture flag로 증명할 수 없으면 Unknown을 유지한다.
13. Production 기본 화면에서 Unknown backlog가 1건 이상이면 `Unknown source backlog · N` 경고를 source control 근처에 항상 노출한다.
14. `Unknown source records · N`이 source 전체 레코드 수인지 선택 큐 결과 수인지 계약을 확정한다. 전체 source 수가 아니면 `Selected queue records · N`처럼 정확한 이름으로 바꾼다.

### P0-1 수용 기준

- Production/Unknown/Synthetic list, count, records, current health, history health가 같은 scope 계약을 사용한다.
- explicit production, explicit synthetic, missing/malformed scope가 서로 겹치지 않는다.
- source count와 records count가 같은 filter에서 모순되지 않는다.
- current Admin system in-app alert가 push no-route queue에서 사라지되 Background Jobs/Operation Alerts 원래 기능은 유지된다.
- wallet/referral 등 direct create 경로가 production runtime에서 올바른 scope와 intent를 기록한다.
- Production 화면은 Unknown backlog가 존재할 때 0건 정상 화면처럼 보이지 않는다.
- 실제 PostgreSQL integration test가 missing JSON key 의미를 검증한다.

---

## P0-2. Failure group deep link를 서버가 반환하는 모든 provider에서 round-trip시킨다

### 현재 확인된 문제

서버 group query는 `FCM`, `FCM_HTTP_V1`, `ONESIGNAL` 등의 raw provider를 반환하지만 UI/API 입력 normalizer는 일부 값만 허용한다. Unknown history의 화면이 직접 만든 링크를 누르면 `dataScope`가 Production으로 돌아가거나 provider가 invalid filter로 제거되어 0건이 나온다.

화면이 만든 링크를 같은 화면이 거부하는 상태는 P0 오류다.

### 구현 계약

1. 서버가 group row로 반환한 provider/code는 동일 API의 exact filter 입력으로 다시 사용할 수 있어야 한다.
2. raw provider를 안전한 길이와 허용 문자 패턴으로 검증하거나, 다음과 같이 canonical family와 raw value를 분리한다.

```ts
type NotificationProviderFamily = 'FCM' | 'ONESIGNAL' | 'IN_APP';

type NotificationFailureGroupKey = {
  providerFamily: NotificationProviderFamily;
  rawProvider: string;
  failureCode: string;
};
```

3. 실제 코드 구조에 더 작은 계약이 있으면 사용해도 되지만 group output, URL parser, API validation, exact query가 하나의 의미를 사용해야 한다.
4. 단순히 allowlist에 `FCM_HTTP_V1`과 `ONESIGNAL` 두 문자열만 임시 추가하고 종료하지 않는다. 향후 서버가 생성하는 지원 provider도 안전하게 round-trip할 수 있는 계약을 만든다.
5. group row href를 빈 기본 view에서 만들지 않는다. 현재 `dataScope`, age `scope`, `sort`, issue, provider, failure code를 명시적으로 전달한다.
6. hardcoded `/notifications`인 `Open failure groups`도 공통 href builder를 사용한다.
7. source tab, age tab, pagination, Refresh, retry confirmation cancel/return에서 exact group context를 보존한다.
8. 다른 issue로 의도적으로 전환할 때 어떤 filter를 제거하는지 명시적으로 테스트한다.
9. query string 입력은 길이와 문자를 제한하고 raw SQL parameter binding을 유지한다.

### 필수 행동 테스트

- `FCM / INVALID_ARGUMENT` exact link가 source/scope와 결과를 보존한다.
- `FCM_HTTP_V1 / INVALID_ARGUMENT` exact link가 warning 없이 해당 group만 연다.
- `ONESIGNAL / UNCLASSIFIED_FAILURE` exact link가 warning 없이 해당 group만 연다.
- rendered row의 실제 `href`를 클릭하는 테스트를 포함한다. helper unit test만으로 완료하지 않는다.
- exact group pagination의 다음/이전 링크가 source/provider/code/scope를 유지한다.
- 잘못된 길이·문자의 provider/code는 안전하게 거부되고 warning 또는 정확한 empty/error 상태를 제공한다.

감사 당시 DB에서는 위 group이 각각 369, 96, 6건으로 관찰됐지만 이 숫자를 코드나 테스트에 하드코딩하지 않는다. fixture가 만든 값과 관계를 검증한다.

---

## P0-3. 혼합 단위 health total을 제거하고 global health와 selected result를 분리한다

### 현재 확인된 문제

`notificationDeliveryHealthTotals()`는 다음을 단순 합산한다.

```text
failure group count
+ failed notification count
+ no-attempt notification count
+ no-route recipient count
+ stale-route notification count
```

단위가 다르고 한 notification이 여러 범주에 들어갈 수 있으므로 `2,477 history` 같은 합계는 운영상 의미가 없다. exact group을 열었을 때 group count만 9에서 1로 바뀌며 total이 2,477에서 2,469로 변하는 것도 global health가 선택 필터에 오염된 증거다.

### 구현 계약

1. `notificationDeliveryHealthTotals()` 또는 같은 혼합 합산 로직을 제거한다.
2. health 상태는 다음과 같은 boolean/complete 계약으로 계산한다.

```ts
type NotificationHealthState = {
  hasCurrentDebt: boolean;
  hasHistoricalDebt: boolean;
  summaryComplete: boolean;
};
```

3. 상단 badge에 임의의 합계 숫자를 표시하지 않는다.
4. 상세 숫자는 단위별 metric으로 유지한다.
   - failure groups
   - failed notifications
   - no-attempt notifications
   - recipients without route
   - notifications without route
   - stale routes
5. 꼭 하나의 total이 필요하다면 서버에서 distinct notification union을 계산하고 `Unique affected notifications`처럼 단위를 정확히 명시한다. 성능과 중복 제거가 증명되지 않으면 total을 만들지 않는다.
6. active provider/failureCode group filter는 result list와 result count에만 적용한다.
7. global current/history health는 선택된 exact group 때문에 값이나 상태가 바뀌지 않는다.
8. summary 일부가 실패하거나 누락되면 healthy로 추정하지 않는다. `Status unavailable` 또는 partial 상태를 표시한다.
9. current clear는 current의 필요한 source가 모두 complete이고 0일 때만 표시한다.

### P0-3 수용 기준

- `2,477 history`, `2,469 history`처럼 서로 다른 단위를 합한 숫자가 사라진다.
- exact group을 열기 전후 global health 상태와 개별 global metric은 동일하다.
- 결과 count는 exact filter에 맞게 바뀌지만 health overview를 오염시키지 않는다.
- partial/error summary에서 healthy 문구가 나오지 않는다.
- 단위별 label과 count가 테스트와 화면에서 일치한다.

---

## P1-1. 1440px 실제 Admin 본문 폭에 맞춰 표를 다시 설계한다

감사에서 viewport는 1440px이었지만 sidebar와 padding을 제외한 table wrapper는 약 1002px이었다. table은 `min-width: 1080px`이라 수평 스크롤이 생겼고 행 메뉴를 열 때 `scrollLeft`가 48px 이동해 첫 열이 잘렸다.

### 구현 계약

- viewport breakpoint가 아니라 **1000~1010px의 실제 main content container**를 기준으로 설계한다.
- 1440×1000에서 핵심 표의 첫 열, 마지막 열, primary action이 동시에 보여야 한다.
- 행 메뉴 overlay를 열어도 table `scrollLeft`가 변하지 않아야 한다.
- `overflow: hidden`으로 열을 숨기지 않는다.
- 긴 기술 정보는 상세 또는 secondary action으로 이동하고 운영 판단에 필요한 정보만 목록에 둔다.
- 일반 delivery row의 우선순위는 다음을 기준으로 조정한다.

```text
Created 112 | Recipient 170 | Notification 220 | Send status 300 | Next action 160
```

- failure group row의 우선순위는 다음을 기준으로 조정한다.

```text
Cause 180 | Affected 112 | First/Latest 170 | Technical next step 340 | Open 150
```

위 숫자는 하드코딩 지시가 아니라 1002px 안에서 정보 우선순위를 정하기 위한 기준이다. 실제 padding과 border를 포함해 검증한다.

- table/card/section의 중복 horizontal padding을 줄인다.
- primary action은 한 줄로 유지한다.
- action menu는 overlay로 열리고 layout/scroll을 밀지 않는다.
- raw code는 `_`, `/`, `:`, `.` 등 의미 있는 separator에 `<wbr>`를 넣거나 짧은 원인명과 별도의 copy/details로 표현한다.
- `INVALID_ARGU / MENT`처럼 임의 문자 위치에서 끊기지 않게 한다.
- 1600px에서 공간이 넓어져도 읽기 어려운 raw code line-break가 남지 않아야 한다.
- 기존 Escape, outside click, focus return 계약을 유지한다.

### 1440 레이아웃 테스트

- 브라우저에서 wrapper `clientWidth`, table `scrollWidth`, `scrollLeft`를 기록한다.
- 1440×1000 기본 표와 failure group 표에서 page/table-level 불필요한 horizontal overflow가 없어야 한다.
- 메뉴 열기 전후 `scrollLeft`가 동일해야 한다.
- 첫 header/cell과 마지막 action을 한 캡처에 담는다.
- 1600×1000에서도 raw code와 action alignment를 확인한다.
- 1024px 이하 검사는 수행하거나 보고하지 않는다.

---

## P1-2. 큐까지 도달하기 전 중복 탐색 구조를 줄인다

현재 운영자는 결과 표 전에 다음을 연속해서 읽는다.

```text
Data status chips
→ source tabs
→ mode tabs
→ current/history health cards와 Review 링크
→ issue tabs
→ age tabs
→ result queue
```

같은 issue가 health link와 issue selector에 반복되고 첫 결과가 1440×1000 아래로 밀린다.

### 권장 정보 구조

```text
[Production ▾] [Needs action | Records] [Current <24h | History | All] [Refresh]

Current health summary | Historical debt summary

[Issue filter 또는 compact tabs]                   [Result count]
Result table
```

### 구현 원칙

- source, mode, age scope는 한 줄의 명확한 toolbar로 정리한다.
- Unknown backlog가 있을 때만 source control 옆에 warning을 노출한다.
- Synthetic 0건을 매번 주 탐색에서 강조하지 않는다. 기존 접근성을 유지하면서 Diagnostics/Data quality 성격의 위치로 축소할 수 있다.
- health metric을 drill-down 링크로 사용한다면 별도 issue selector의 중복을 줄인다.
- 별도 issue selector가 필요하면 5개 compact tabs 또는 하나의 filter control 중 현재 코드에 가장 단순한 구조를 선택한다.
- 같은 의미의 `Review` 링크를 여러 번 반복하지 않는다.
- 링크 accessible name은 `Review failed`, `Review no route`처럼 구체적으로 만든다.
- 1440×1000 첫 화면에 최소 result section title과 첫 table header가 보이게 한다.
- URL query와 back/forward history가 현재처럼 동작해야 한다.

---

## P1-3. 1인 운영용 최소 history lifecycle을 완성한다

거대한 assignment/workflow engine은 만들지 않는다. 한 명의 운영자가 오래된 부채를 다시 보고 종결 여부를 알 수 있는 최소 상태만 필요하다.

```text
Open → Reviewed → Resolved
              ↘ Accepted debt
```

### 최소 데이터

- `reviewState`
- `lastReviewedAt`
- `reviewedByAdminId`
- `reviewNote`
- `resolutionEvidence` 또는 source recovery reference
- `reviewAgainAt` — Accepted debt일 때

### 구현 원칙

1. 기존 Admin system legacy `Mark reviewed`, audit log, incident status, JSON metadata 중 재사용할 수 있는 primitive를 먼저 찾는다.
2. 일반 delivery debt에 같은 최소 review 계약을 적용한다.
3. source incident가 있는 Admin system alert는 Background Jobs 등 원래 incident 화면에서 resolve하고 Notification 화면은 상태와 deep link를 반영한다.
4. 일반 delivery debt는 evidence 없이 Resolved로 바꿀 수 없다.
5. Accepted debt는 이유와 재검토일을 요구한다.
6. 1인 운영에서는 owner/team assignment를 새로 만들지 않는다. 현재 운영자를 암묵적 reviewer로 기록한다.
7. age bucket은 `24–72h`, `3–7d`, `8–30d`, `30d+` 정도로 제한한다.
8. permission, CSRF/Server Action guard, audit logging을 기존 패턴과 동일하게 적용한다.
9. schema 변경이 필요하면 왜 기존 metadata로 안전하게 표현할 수 없는지 먼저 증명하고 migration, rollback, protected-area 검증을 포함한다.
10. persistent lifecycle이 이번 범위에서 안전하게 구현될 수 없다면 UI에 가짜 상태를 만들지 않는다. 가능한 read-only age/severity/next-action 개선을 완료하고 정확한 blocker를 최종 보고한다.

### lifecycle 행동 테스트

- evidence 없는 Resolved 요청은 서버에서 거절된다.
- Accepted debt는 reason과 reviewAgainAt 없이는 저장되지 않는다.
- Reviewed는 actor, time, note와 함께 audit에 남는다.
- permission 없는 admin은 상태를 변경할 수 없다.
- 이미 terminal인 항목의 중복 요청은 idempotent하거나 정확히 거절된다.
- full phone, raw token, full device ID가 audit metadata에 저장되지 않는다.

---

## P1-4. action summary를 view-specific으로 줄이고 동일 조건으로 성능을 측정한다

재감사 로컬 관찰값은 다음과 같다. 정확한 benchmark가 아니라 회귀 baseline이다.

| 화면 | 관찰 시간 |
|---|---:|
| Production default | 약 1.02~1.14초 |
| Unknown current | 약 2.19~2.87초 |
| Unknown history groups | 약 2.50~2.76초 |
| Unknown records | 약 0.15~0.16초 |

records가 빠른 반면 action mode는 선택 issue와 관계없는 다수 집계를 함께 실행한다.

### 구현 계약

1. global health header용 최소 summary와 selected issue detail query를 분리한다.
2. header는 current/history 여부와 핵심 단위별 count만 가져온다.
3. selected issue가 no-route면 exact failure group detail query를 실행하지 않는 식으로 view별 query budget을 만든다.
4. exact group filter는 global health query에 전달하지 않는다.
5. 동일 query를 여러 model이 중복 호출하는지 확인하고 현재 request 범위에서 안전하게 공유한다.
6. cache나 index를 먼저 추가하지 않는다.
7. DB 쿼리가 병목이면 `EXPLAIN (ANALYZE, BUFFERS)`와 query count로 근거를 남긴 뒤 최소 index/query change를 선택한다.
8. index 또는 migration을 추가하면 실제 실행계획 before/after와 protected-area 검증을 남긴다.
9. partial query failure는 healthy가 아니라 incomplete/unavailable로 보인다.
10. generated time과 data freshness를 유지한다.

### 성능 검증

- 같은 로컬 서버와 같은 URL에서 변경 전후 각각 warm 5회 측정한다.
- median, P75 또는 p90, 최소/최대와 측정 조건을 기록한다.
- 권장 목표:
  - action route P75 ≤ 1.5초
  - records/filter route P75 ≤ 1.0초
  - row menu/local interaction feedback ≤ 300ms
- 환경상 절대 목표를 증명할 수 없으면 같은 조건 대비 개선율과 남은 병목을 보고한다.
- 하나의 매우 빠른 실행만 골라 성공으로 보고하지 않는다.

---

## P1-5. Audit trail을 실제 운영 다음 행동으로 만든다

감사에서 Notification ID를 query로 전달해 Audit Log로 이동했지만 0건이었고, 일반적인 empty state만 보여 Notification Delivery로 돌아갈 경로가 없었다.

### 구현 계약

- notification audit event가 0건인 row에서 `Audit trail`을 primary action으로 두지 않는다.
- 이 경우 recipient/destination, delivery evidence, 원래 source incident처럼 실제로 도움이 되는 action을 primary로 둔다.
- Audit Log empty state가 notification context를 알고 다음 문구와 return link를 제공한다.

```text
No audit events have been recorded for this notification.
[Back to Notification Delivery]
```

- retry request/queued/failed event가 있으면 correlation ID로 하나의 흐름으로 읽을 수 있어야 한다.
- 새 generic `AuditEvidenceDrawer`가 retry metadata를 보여 준다면 그 실제 presentation contract를 테스트한다.
- `infra/scripts/check-notification-retry-audit-contract.mjs`를 현재 Audit Log 구조에 맞게 업데이트하거나 typed presentation contract로 대체한다.
- contract script를 삭제하거나 필요한 key 목록을 비워서 통과시키지 않는다.
- 최소한 다음 evidence가 normalized view 또는 raw payload drawer에서 실제로 확인 가능해야 한다.

```text
latestDelivery
retryJob
retryAlreadyDelivered
retryRisk
provider
attemptedAt
failureCode
pushDeviceId 또는 안전하게 마스킹된 식별자
pushDeviceEnabled
pushDeviceLastSeenAt
pushDevicePlatform
jobName
```

민감 정보는 마스킹하거나 short ID로 표시하고 raw token은 금지한다.

### 수용 기준

- audit event가 있는 notification은 correlation 흐름으로 열린다.
- audit event가 없는 notification은 정확한 empty 문구와 return link를 제공한다.
- `notifications:retry-audit-contract`가 현재 UI 구조와 함께 통과한다.
- 행동 테스트가 drawer 또는 normalized presentation에 필요한 retry evidence가 렌더됨을 검증한다.

---

## P2. 문구·접근성·시각 마감

P0와 P1 핵심 계약을 해결한 뒤 다음을 마감한다.

1. `Unknown source records · 0`은 전체 source count인지 selected result count인지 정확히 표현한다.
2. disabled row action의 block reason을 `title`에만 두지 않는다. 화면과 접근성 트리에 `Payload/config recovery evidence required` 같은 이유가 노출되어야 한다.
3. `Retry blocked`만 읽어도 이유와 다음 행동을 이해할 수 있게 한다.
4. `Review` 반복 링크의 accessible name을 issue별로 구체화한다.
5. `Mark reviewed` evidence가 최소 길이 미만이면 confirm button의 disabled visual/ARIA 상태가 명확해야 한다. native validation만 믿지 않는다.
6. 검색 placeholder가 1440px에서 끝까지 보이게 한다.
7. active filter는 전체 clear 외에 개별 chip 제거가 가능하도록 기존 패턴을 재사용한다.
8. `Current · under 24h`, timezone, generated time, source count는 3줄 badge stack보다 한 줄 metadata toolbar로 정리한다.
9. operator-facing 원인명과 raw provider/code를 분리한다.

```text
Invalid request payload
FCM_HTTP_V1 · INVALID_ARGUMENT
```

10. raw code는 copy/details에서 전체 값을 확인할 수 있어야 한다.
11. 색상만으로 상태를 표현하지 않는다.
12. light/dark에서 text, badge, focus-visible, disabled 상태의 대비를 확인한다.
13. user-facing 용어는 `Partner`를 사용하고 새 `Provider` 문구를 노출하지 않는다.
14. 1024px 이하 스타일은 추가하거나 검사하지 않는다.

---

## 테스트 작성 원칙

source 문자열이 파일에 존재하는지만 검사하는 테스트를 추가하지 않는다. 가능한 경우 다음 순서로 행동을 검증한다.

1. pure predicate/model unit test
2. rendered href와 rendered state test
3. API query/service outcome test
4. actual PostgreSQL integration test
5. 실제 1440/1600 browser behavior

### 반드시 추가하거나 수정할 테스트

1. missing/production/synthetic/malformed scope의 actual PostgreSQL 분리
2. source count, records list, action summary predicate 일치
3. 모든 Notification create 경로의 scope/intent metadata
4. in-app-only Admin notification의 no-route/no-attempt/stale-route 제외
5. FCM, FCM_HTTP_V1, ONESIGNAL rendered group link round-trip
6. exact group filter와 global health 독립성
7. 혼합 단위 health total 제거
8. partial summary에서 healthy 금지
9. 1440 main container에서 첫/마지막 열과 action visibility
10. action menu open 전후 horizontal scroll 불변
11. blocked retry reason의 visible/accessible rendering
12. evidence 미달 Mark reviewed confirm disabled 상태
13. history lifecycle permission/evidence/audit — 구현한 범위
14. Audit Log 0건 context/return link
15. retry evidence drawer/normalized view contract
16. 기존 server-side retry block, dedupe, success-path exclusion 회귀 방지
17. full phone/raw token/full device ID DOM 및 audit 비노출

### 감사 당시 통과한 baseline

- Admin Web notification focused tests: 7 files / 114 tests passed
- API notification focused tests: 10 files / 103 tests passed
- Admin Web typecheck: passed
- API typecheck: passed
- focused ESLint: passed
- `notifications:push-data-contract`: passed
- `security:admin-sensitive`: passed, violations 0
- browser console error: 0

### 감사 당시 실패한 계약

```powershell
npm.cmd run notifications:retry-audit-contract
```

이 명령은 exit 1이었다. API와 smoke metadata는 통과했지만 Admin Audit Log 소비자가 현재 generic drawer로 이동한 뒤 contract script가 이전 `page.tsx`/`page-content.tsx`만 검사해 필요한 evidence를 찾지 못했다. 현재 UI 계약을 검증하도록 보수하고 반드시 통과시킨다.

## 검증 명령

현재 실제 spec 파일명을 `rg --files`로 확인한 뒤 가장 가까운 focused command를 실행한다. 아래는 기준 명령이며, 존재하지 않는 경로는 성공으로 포장하지 말고 실제 명령과 대체 이유를 보고한다.

### Admin Web

```powershell
npm.cmd run test -w @massage-vn/admin-web -- app/notifications/page.spec.tsx app/notifications/notification-page-model.spec.ts app/notifications/notification-delivery-ops-queue-section.spec.tsx app/notifications/notifications-table-section.spec.tsx app/notifications/notification-action-confirmation.spec.ts app/notifications/actions.spec.ts
npm.cmd run typecheck -w @massage-vn/admin-web
```

### API

```powershell
npm.cmd run test -w @massage-vn/api -- src/admin/admin-notification-production-data.spec.ts src/admin/admin-notification-retry-query.spec.ts src/admin/admin-notification-unattempted-query.spec.ts src/admin/admin-notification-device-health-query.spec.ts src/notifications/notification-retry-audit.spec.ts src/notifications/notifications.service.spec.ts src/notifications/notifications.processor.spec.ts
npm.cmd run typecheck -w @massage-vn/api
```

### Contracts, lint, scope, security

```powershell
npm.cmd run notifications:push-data-contract
npm.cmd run notifications:retry-audit-contract
npm.cmd run security:admin-sensitive
npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api
```

관련 변경 파일을 focused ESLint로 검사한다. schema/migration/shared contract 등 protected area를 수정했으면 `AGENTS.md`가 요구하는 full local verification도 수행한다.

```powershell
npm.cmd run verify:local
powershell -ExecutionPolicy Bypass -File .\infra\scripts\verify-local.ps1 -WithServices
```

실행 환경 또는 기존 unrelated dirty change 때문에 full verification이 실패하면 명령, 첫 root cause, 이번 변경과의 관련성을 분리해 보고한다. 테스트를 생략하고 완료라고 하지 않는다.

Admin Web production build는 실행 중인 3101 preview의 `.next`를 덮어쓸 수 있으므로 현재 프로세스와 build output 구조를 먼저 확인한 뒤 안전하게 실행한다. 서버를 재시작해야 하면 해당 프로세스만 식별해서 다룬다.

## 실제 브라우저 재검수

코드와 테스트가 통과한 뒤 로그인된 browser에서 **새 화면을 직접 캡처**한다. 이전 감사 이미지를 완료 증거로 재사용하지 않는다.

새 증빙 폴더:

```text
C:\dev\massage-on-demand-vn\docs\audits\notifications-final-remediation-verification-2026-08-12\
```

### 1440×1000 필수 화면

1. Production 기본 Needs action 상단과 첫 table header
2. Unknown source 기본 화면과 정확한 source/backlog 수치
3. Unknown Delivery records와 source total/result count 관계
4. current no-route — Admin in-app false positive가 없는 상태
5. no-route/failure row action 메뉴 open 전후
6. Unknown history failure groups
7. `FCM_HTTP_V1 / INVALID_ARGUMENT` exact group
8. `ONESIGNAL / UNCLASSIFIED_FAILURE` exact group
9. `FCM / INVALID_ARGUMENT` exact group과 pagination
10. blocked retry reason이 보이는 행
11. Mark reviewed confirmation의 invalid/valid visual state — 제출하지 않음
12. Audit trail event 있음 상태 또는 테스트 fixture
13. Audit trail 0건 empty state와 return link
14. light/dark 핵심 화면

### 1600×1000 필수 화면

1. 기본 toolbar, health, issue/result hierarchy
2. failure group table과 raw code wrapping
3. Delivery records table과 마지막 action

### 브라우저에서 수치로 확인할 것

- result table wrapper `clientWidth`
- table `scrollWidth`
- 메뉴 open 전후 `scrollLeft`
- page-level horizontal overflow 여부
- first/last header visibility
- 첫 result table header의 viewport 내 위치
- route transition 5회 warm timing
- console error/warning
- full phone, raw token, full device ID DOM 비노출

실제 retry, push send, Mark reviewed submit, lifecycle mutation은 운영 브라우저에서 실행하지 않는다.

## 전체 완료 체크리스트

다음을 모두 확인하기 전에는 완료라고 하지 않는다.

- [ ] 모든 Notification 생성 경로가 dataScope와 deliveryIntent를 기록한다.
- [ ] Production/Unknown/Synthetic list, count, records, action health가 같은 scope predicate를 사용한다.
- [ ] actual PostgreSQL에서 missing key가 Unknown으로 정확히 분류된다.
- [ ] Admin system in-app notification이 push no-route/no-attempt/stale-route에 나타나지 않는다.
- [ ] Unknown source 전체 count와 records/action queue가 의미상 모순되지 않는다.
- [ ] Production 화면이 Unknown backlog를 숨긴 채 정상처럼 보이지 않는다.
- [ ] FCM, FCM_HTTP_V1, ONESIGNAL exact group link가 source/scope/context를 유지한다.
- [ ] `Open failure groups`가 현재 source와 age scope를 보존한다.
- [ ] 혼합 단위 current/history total이 제거된다.
- [ ] exact group filter가 global health를 바꾸지 않는다.
- [ ] summary partial/error에서 healthy가 되지 않는다.
- [ ] 1440×1000에서 첫/마지막 열과 primary action이 동시에 보인다.
- [ ] row menu를 열어도 horizontal scroll position이 움직이지 않는다.
- [ ] 1600px에서 raw provider/code가 임의 문자 위치에서 깨지지 않는다.
- [ ] 첫 화면에 result section title과 table header가 보인다.
- [ ] blocked retry reason을 화면과 접근성 트리에서 읽을 수 있다.
- [ ] Mark reviewed invalid evidence에서 confirm disabled 상태가 명확하다.
- [ ] history debt를 최소 Reviewed/Resolved/Accepted debt 상태로 관리할 수 있거나 정확한 persistence blocker가 증명돼 있다.
- [ ] audit 0건 상태에 정확한 문맥과 Notification Delivery return link가 있다.
- [ ] `notifications:retry-audit-contract`가 현재 Audit Log 구조와 함께 통과한다.
- [ ] action route 성능을 동일 조건 5회 측정하고 개선 또는 남은 병목을 증명한다.
- [ ] 기존 retry 안전장치, PII masking, recipient grouping, keyboard menu가 회귀하지 않는다.
- [ ] focused tests, typecheck, lint, contracts, scope/security 검증 결과가 기록된다.
- [ ] 현재 코드와 일치하는 새 1440/1600 캡처와 최종 검증 보고서가 있다.

## 하지 말아야 할 구현

- Unknown legacy를 이름이나 ID 패턴만으로 Production/Synthetic으로 일괄 변경하지 않는다.
- Admin system alert를 삭제해 Background Jobs 경고 자체를 없애지 않는다.
- in-app false positive를 UI에서만 숨기고 query intent 계약을 그대로 두지 않는다.
- provider allowlist에 관찰 문자열 두 개만 임시 추가하고 canonical contract를 방치하지 않는다.
- `2,477 history`의 label만 `signals`로 바꾸고 혼합 합산을 유지하지 않는다.
- exact filter 결과를 global health에 사용하지 않는다.
- `overflow: hidden`으로 잘린 열을 감추지 않는다.
- 행을 과도하게 높이거나 모든 기술 정보를 한 셀에 쌓아 폭 문제를 피하지 않는다.
- retry button만 숨기고 API gate를 약화하지 않는다.
- 운영자가 입력한 사유를 복구 증거로 간주하지 않는다.
- contract script를 삭제하거나 required key를 비워서 통과시키지 않는다.
- 1인 운영 화면을 위해 거대한 owner/team/workflow framework를 만들지 않는다.
- 성능 측정 없이 cache, index, dependency를 추가하지 않는다.
- 1024px 이하 responsive 작업을 이번 scope에 포함하지 않는다.
- 관련 없는 dirty change를 정리하거나 revert하지 않는다.

## 구현 우선순위

다음 순서를 지킨다.

1. dataScope + deliveryIntent 생성 계약
2. source count/list/action query predicate 통일
3. in-app-only push health false positive 제거
4. provider/group deep-link round-trip과 context 보존
5. 혼합 단위 health total 제거와 global/result 분리
6. 1440 table contract와 중복 navigation 축소
7. 1인 운영용 최소 history lifecycle
8. view-specific query와 성능 개선
9. Audit trail 문맥과 retry contract 복구
10. 문구, 접근성, raw code wrapping, dark theme 마감

P0가 실패한 상태에서 P2 시각 마감만으로 완료 처리하지 않는다.

## 최종 산출물

작업이 끝나면 다음 파일을 작성한다.

```text
C:\dev\massage-on-demand-vn\docs\audits\notifications-final-remediation-verification-2026-08-12.md
```

최종 보고서는 다음 순서로 작성한다.

1. 운영자 관점의 최종 결과와 출시 가능/보류 판정
2. P0/P1/P2별 완료·부분 완료·미완료 표
3. dataScope/deliveryIntent 생성 및 조회 계약 before/after
4. Production/Unknown/Synthetic count/list/action 일치 증거
5. provider deep-link round-trip 결과
6. health 의미와 global/result 분리 결과
7. 1440/1600 레이아웃 수치와 캡처 링크
8. history lifecycle과 permission/audit 결과
9. 성능 동일 조건 before/after 5회 표
10. Audit trail 및 retry evidence contract 결과
11. 변경 파일과 파일별 변경 이유
12. 실행한 명령과 pass/fail/skipped 결과
13. protected area touched 여부와 추가 검증
14. 개인정보, retry, audit, data migration 위험 검토
15. 기존 dirty worktree와 이번 변경 구분
16. commit 여부
17. 남은 위험과 다음 권장 작업 하나

최종 답변에는 보고서와 새 증빙 폴더의 절대 경로 링크를 제공한다.

## 최종 성공 정의

이 작업의 성공은 카드 수나 코드 변경량이 아니다.

**운영자가 Production/Unknown/Synthetic 데이터의 의미를 믿을 수 있고, current와 history 부채를 혼동하지 않으며, 화면이 만든 failure link가 정확한 레코드로 돌아가고, in-app 알림을 push 장애로 오판하지 않고, 증거 없는 retry 없이 1440px 화면에서 빠르게 업무를 끝낼 수 있어야 한다.**

