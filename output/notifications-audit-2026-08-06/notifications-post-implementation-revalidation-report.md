# Notifications 재검증 보고서

- 대상: `http://localhost:3101/notifications`
- 재검증 시각: 2026-08-06 21:02–21:15 (Asia/Bangkok)
- 화면 폭: 1440×900, 1024×900, 720×900
- 관점: 실제 관리자 운영자, 고객 지원, 알림 전송 장애 대응, 권한·감사·개인정보
- 범위: 화면, 문구, URL 상태, 반응형, Admin Web 코드, NestJS API 집계, 재시도 권한·감사, focused tests
- 이번 작업에서 애플리케이션 코드는 수정하지 않았다.

## 1. 결론

현재 소스 코드는 이전 보고서의 핵심 방향을 상당 부분 반영했다. `Notification Delivery`, `Needs action | Delivery records`, 네 가지 canonical issue, 정확한 FCM 문구, 읽기/재시도 권한 분리, 실패·빈 상태 구분, 5열 표와 1024px 이하 stacked row까지 구현돼 있다.

그러나 **브라우저가 보여 주는 3101 화면은 이 최신 소스가 아니다.** 실행 중인 서버는 `next start -p 3101`이며 빌드 산출물은 19:26, 현재 `page.tsx`는 20:51에 수정됐다. 따라서 브라우저에는 이전의 `Notifications`, 21개 queue, System/Finance 혼합, 82,945건 legacy table, 중첩 스크롤이 계속 보인다. 이 상태에서는 “개선 완료”를 시각적으로 승인할 수 없다.

최종 판정은 다음과 같다.

| 영역 | 판정 | 이유 |
|---|---|---|
| 현재 소스 구조 | 조건부 양호 | 핵심 IA와 안전 계약이 구현됨 |
| 3101 실제 화면 | 승인 불가 | 최신 소스보다 오래된 production build가 서비스 중 |
| 운영자 행동성 | 보완 필요 | exact failure group deep link와 visible primary action이 없음 |
| 개인정보 | 보완 필요 | 이름 없는 사용자는 full phone이 label/accessible name에 다시 노출될 수 있음 |
| 재시도 안전 | 대체로 양호, 감사 순서 위험 | 별도 권한·reason·서버 재검증은 있으나 enqueue 후 audit 실패 가능성이 남음 |
| 반응형 | 소스상 개선, 미검증 | stacked CSS는 있으나 실제 3101은 여전히 가로/세로 중첩 scroll |
| 테스트 | focused pass, 계약 테스트 보강 필요 | 170개 focused test 통과; 일부 page test가 source 문자열 검사에 의존 |

## 2. 가장 먼저 해결할 P0

### P0-1. 최신 소스와 실제 관리자 화면을 일치시킨다

#### 관찰

- 실행 프로세스: `next start -p 3101`
- `.next/BUILD_ID` 수정: 2026-08-06 19:26
- `apps/admin_web/app/notifications/page.tsx` 수정: 2026-08-06 20:51
- 21:02 이후 캡처에는 구 UI가 그대로 노출된다.
- 현재 소스의 H1은 `Notification Delivery`지만 화면 H1은 `Notifications`다.
- 현재 소스에는 `NotificationFilterBoardSection`이 없지만 화면에는 `Notification operation filters`와 legacy queue가 남아 있다.

#### 운영 위험

- 운영자와 개발자가 서로 다른 화면을 기준으로 장애를 논의한다.
- 테스트 통과가 실제 배포 화면 개선을 보장하지 않는다.
- 구 화면에서 System/Finance 업무를 계속 처리해 source-of-truth 분리가 무력화된다.

#### 수정 요구

1. dirty worktree를 보존한 상태에서 현재 Admin Web source로 새 build를 만든다.
2. 3101 프로세스를 새 build로 재기동한다.
3. 브라우저에서 H1, nav, mode, issue selector, 표, confirmation을 다시 캡처한다.
4. build ID, commit 또는 작업 tree fingerprint를 관리자 화면 하단에 추가하지는 않는다. 배포 검증 script/로그에서 확인하면 충분하다.
5. 시각 QA가 끝날 때까지 legacy 캡처를 개선 결과 증거로 사용하지 않는다.

#### 합격 기준

- `/notifications` H1과 nav가 모두 `Notification Delivery`다.
- 첫 화면에 `Needs action | Delivery records`만 있다.
- `Notification operation filters`, System incidents, Finance overdue/history, 21개 additional queue가 없다.
- 실제 화면과 현재 `page.tsx` 구조가 일치한다.

### P0-2. `Open affected records`가 선택한 failure group만 열게 한다

#### 코드 근거

`notification-table-row.tsx`의 failure group action은 모든 row에서 같은 URL을 사용한다.

```tsx
<StatusBadgeLink href="/notifications?issue=failed" tone="warning">
  Open affected records
</StatusBadgeLink>
```

group row에는 이미 `provider`, `failureCode`, affected count가 있지만 action URL에는 전달되지 않는다.

#### 운영 위험

- `FCM / UNREGISTERED` 1건을 눌러도 모든 failed notification이 열린다.
- 운영자는 다시 원인을 검색해야 하며, 큰 queue에서는 어떤 row가 원래 group인지 잃는다.
- 버튼 문구가 실제 동작보다 더 구체적인 결과를 약속한다.

#### 수정 요구

최종 목표는 exact deep link다.

- URL 예: `/notifications?issue=failed&provider=FCM&failureCode=UNREGISTERED`
- list와 summary API가 같은 `provider`·normalized `failureCode` predicate를 사용한다.
- page/model/API query에 두 값의 allowlist 또는 안전한 normalization을 둔다.
- 링크 진입 후 active filter chip에 `FCM · App route expired`처럼 표시한다.
- reset하면 `issue=failed`만 남긴다.

API 확장이 당장 어렵다면 문구를 `Open failed notifications`로 낮춰 거짓 약속부터 제거한다. 그러나 운영 효율을 위해 exact filter가 최종 요구다.

#### 합격 기준

- 서로 다른 두 failure group action이 서로 다른 URL을 가진다.
- 열린 failed row가 선택 group의 provider/failure code와 모두 일치한다.
- list total, summary count, page rows가 같은 predicate를 사용한다.

### P0-3. 이름 없는 사용자에게 full phone을 다시 노출하지 않는다

#### 코드 근거

- `notification-page-model.ts`의 `userPhone`은 mask된다.
- 그러나 `notificationUserLabel()`은 `fullName`이 없으면 raw `phone`을 반환한다.
- 이 값은 table primary label과 `Actions for ...` accessible name에 사용된다.

즉 helper는 `••• ••• 7101`이어도 label 또는 action aria-label에는 `+849...`가 남을 수 있다.

#### 수정 요구

- list 전용 recipient label은 `fullName ?? maskedPhone ?? short user ID` 순서로 만든다.
- action accessible name도 같은 list-safe label을 사용한다.
- full phone은 권한이 있는 Customer/Partner detail 또는 명시적 contact action에서만 제공한다.
- `notificationUserLabel()`의 다른 caller를 먼저 확인하고, 전역 의미를 바꾸기 위험하면 list 전용 작은 helper 하나만 추가한다.

#### 합격 기준

- 이름 없는 customer/Partner fixture를 render했을 때 HTML 전체에 full phone이 없다.
- visible label과 action accessible name 모두 masked phone 또는 short user ID를 사용한다.

### P0-4. retry enqueue와 감사 기록 사이의 실패 공백을 닫는다

#### 현재 계약

- `NOTIFICATIONS_RETRY` 권한 분리: 구현됨
- reason 12–500자 service validation: 구현됨
- 성공 device 제외, eligible path 재검증, 409: 구현됨
- masked device IDs와 job ID를 audit metadata에 기록: 구현됨

#### 남은 위험

`AdminService.retryNotification()`은 queue enqueue가 포함된 `notifications.retry()`를 먼저 실행하고 그 뒤 `writeAudit()`을 호출한다. enqueue가 성공한 뒤 audit DB write가 실패하면 실제 재시도 job은 생겼지만 Admin API는 실패하고 감사 기록도 없을 수 있다.

#### 수정 요구

새 framework를 만들지 말고 기존 audit pattern을 재사용한다.

1. 최소한 `retry requested` audit을 먼저 남긴다.
2. enqueue 성공 시 같은 correlation ID로 `queued` 결과와 job ID를 기록한다.
3. enqueue 실패 시 `failed` outcome을 기록하고 UI에는 성공을 표시하지 않는다.
4. 시작 audit 자체가 실패하면 enqueue하지 않는다.
5. 성공 audit 보강이 실패한 경우에도 운영자가 Background Jobs에서 correlation/job을 찾을 수 있어야 한다.

#### 합격 기준

- audit write 선행 실패 시 queue add가 호출되지 않는다.
- queue add 실패 시 `queued` audit과 성공 notice가 없다.
- queue add 성공 시 actor, reason, eligible path snapshot, masked IDs, job ID를 correlation으로 찾을 수 있다.

## 3. P1 — 실제 운영 속도를 높이는 보완

### P1-1. 기본 `Open failure groups`도 issue selector의 선택 상태로 보여 준다

현재 default `view.issue`는 `groups`지만 `NotificationIssueSelector` options에는 `Failed`, `No send attempt after 15m`, `No active push route`, `App route needs refresh` 네 개만 있다. default 진입에서는 어느 option도 active가 아니다.

운영자는 결과 제목을 읽어야만 현재 mode를 안다. 다음 중 하나로 통일한다.

- 권장: selector 첫 항목에 `Open failure groups · N groups`를 추가하고 기존 네 상태와 함께 5개로 운영한다.
- 네 개 제한을 반드시 지켜야 하면 `Open failure groups`를 별도 active summary chip/primary tab으로 명확히 표시하고 네 issue selector를 “다른 보기”로 구분한다.

현재 코드와 문구 계약상 첫 번째가 더 직관적이다. count 단위는 반드시 `groups`, 나머지는 `notifications`로 구분한다.

### P1-2. `Next action`을 ellipsis 뒤에 숨기지 않는다

소스의 5열 구조는 구 화면보다 훨씬 낫지만 `ActionMenu variant="dropdown"` trigger는 여전히 점 세 개뿐이다. column heading은 `Next action`인데 실제 cell에는 다음 행동 이름이 없다.

수정 기준:

- 가장 중요한 action 하나를 visible text button/link로 노출한다.
- `Audit trail` 같은 secondary action만 overflow menu로 둔다.
- 기존 `ActionMenu`의 `button-list` 또는 기존 button/link atom을 재사용한다.
- retry 가능 row: `Review & retry`
- no route/stale route: `Open recipient`
- accepted/skipped history: `Open audit trail`
- failure group: `Open this group`

### P1-3. 운영 queue에 명시적 새로고침을 제공한다

현재 source는 `Refreshed {time}`이라고 정확히 표시하지만 auto-refresh나 manual refresh가 없다. 구 화면의 거짓 `Live`보다 정직하지만, 장애 대응 queue로는 최신화 행동이 불명확하다.

- 기존 `StartShiftRefreshButton`/`router.refresh()` pattern을 재사용해 `Refresh` 버튼을 추가한다.
- 자동 갱신은 새 realtime framework를 만들지 말고, 실제 운영 요구가 확인될 때만 기존 booking monitor pattern을 재사용한다.
- 새로고침 중 label, 완료 시 갱신 시각, 실패 시 summary/list error를 보여 준다.
- 사용자가 action menu나 confirmation을 조작하는 동안 강제 auto-refresh하지 않는다.

### P1-4. `Data boundary unverified`를 운영자가 이해할 수 있는 상태로 바꾼다

현재 문구는 기술적으로 정직하지만 “그래서 숫자를 믿어도 되는가?”에 답하지 않는다.

권장 copy:

| 상태 | 문구 |
|---|---|
| provenance와 predicate가 검증됨 | `Operational data · fixtures excluded` |
| local DB에 unmarked fixture 가능 | `Mixed local data · fixture rows may remain` |
| API boundary metadata unavailable | `Data scope unavailable` |

API summary에는 `scopeStart`, `scopeEnd`, `sourceUpdatedAt`가 이미 있다. 이를 사용해 scope를 표시하고, 검증 상태가 생기기 전에는 `Test data excluded`를 복원하지 않는다.

### P1-5. navigation 위치를 실제 업무 소유권과 맞춘다

label은 현재 source에서 `Notification Delivery`로 수정됐지만 여전히 `Customer Support` group에 있다. 이 화면은 Customer, Partner, Admin notification record와 전송 인프라를 모두 다룬다.

- 주 사용자가 Support이고 delivery 대응 ownership도 Support라면 현재 group을 유지하되 description에서 `Customer, Partner, and Admin delivery`를 명시한다.
- Platform/Operations가 주 owner면 `Live Operations`로 이동한다.
- 중복 nav item을 만들지 않는다.

조직 소유권이 확인되지 않았으므로 이번 보고서는 이동을 강제하지 않고 결정 항목으로 남긴다.

## 4. P2 — 유지보수와 테스트 신뢰도

### P2-1. 새 화면에서 사용하지 않는 legacy 계산과 component를 삭제한다

현재 `page.tsx`는 단순해졌지만 `notification-page-model.ts`는 2,864줄이며 새 page가 쓰지 않는 다음 값을 계속 계산한다.

- metrics / channelMetrics / recordMetrics
- channelSummary
- partnerAlertSmokeFallback / fcmSmokeReadiness
- opsQueue
- legacy filter board / channel policy section 관련 상태

삭제 전에 `rg`로 caller를 확인한다. API deep-link compatibility는 유지하되, Admin Web에서 page가 더 이상 render하지 않는 계산·component·spec은 직접 삭제한다. 새 repository, facade, factory를 만들지 않는다.

### P2-2. source 문자열 검사를 실제 동작 테스트로 바꾼다

`page.spec.tsx`는 `readFileSync` 후 `toContain()`으로 계약을 검사한다. 이 방식은 다음을 잡지 못한다.

- default `groups` selector가 visually active가 아닌 문제
- action이 ellipsis로만 보이는 문제
- 이름 없는 사용자의 full phone 노출
- current source와 3101 build가 다른 문제
- 1024px stacked CSS가 실제로 적용되지 않는 문제

보강 기준:

- page/model render test에서 actual link, accessible name, selected state를 검사한다.
- unnamed recipient, partial delivery, exact group link fixture를 추가한다.
- 1440/1024/720 browser smoke를 배포 acceptance에 추가한다.
- source 문자열 test는 import boundary처럼 정말 필요한 소수만 남긴다.

### P2-3. legacy history deep link의 age 기준을 명시한다

`review=delivery-incident-history`는 새 구조에서 `issue=groups&age=over-24h`로 이동한다. 현재 query age는 notification `createdAt`, group의 핵심 시각은 latest unresolved delivery `attemptedAt`이다. 두 시각이 다르면 예상과 다른 group이 포함될 수 있다.

- 운영 정의를 `notification age` 또는 `latest unresolved attempt age` 중 하나로 고정한다.
- failure group cleanup 의미라면 `latest unresolved attempt age`가 더 정확하다.
- UI copy와 API predicate를 같은 시각 기준으로 맞춘다.

## 5. 현재 소스에서 확인된 개선

| 개선 목표 | 현재 코드 상태 | 판정 |
|---|---|---|
| H1/nav `Notification Delivery` | page/nav source 반영 | 구현, 런타임 미반영 |
| primary mode 두 개 | `Needs action`, `Delivery records` | 구현 |
| System/Finance source 분리 | old review URL을 Background Jobs/Bank Reconciliation로 redirect | 구현 |
| current/history 이중 구조 제거 | 새 page에서 제거 | 구현 |
| canonical issue | failed/no-attempt/no-route/stale-route | 구현 |
| 모든 unresolved age failure groups | API `delivery-incidents`가 mode `all`로 group | 구현 |
| provider + failure code grouping | SQL group 기준 일치 | 구현 |
| FCM `SENT` 문구 | `Accepted by FCM` | 구현 |
| partial evidence | failed가 accepted보다 먼저 표시 | 구현 |
| 5열 compact table | Created/Recipient/Notification/Send status/Next action | 구현 |
| 내부 table vertical scroll 제거 | source CSS `max-height:none; overflow:visible` | 구현, 런타임 미반영 |
| 1024px stacked row | responsive CSS 존재 | 구현, 실제 화면 미검증 |
| page 10 rows/canonical redirect | 구현 | 구현 |
| list/summary error와 empty 분리 | 구현 | 구현 |
| retry permission 분리 | `NOTIFICATIONS_RETRY` | 구현 |
| retry reason·409·successful path 제외 | API/service 반영 | 구현 |
| audit snapshot·masked device ID | 반영 | 구현 |
| full phone 기본 helper mask | 부분 구현 | 이름 없는 사용자 보완 필요 |
| test data copy | `Data boundary unverified` | 정직하지만 operator copy 보완 필요 |

## 6. 권장 최종 화면 구성

새 카드나 chart를 추가하지 않는다. 현재 source 구조를 유지하면서 다음만 보완한다.

1. Header
   - `Notification Delivery`
   - `Review unresolved mobile send issues and inspect delivery records.`
   - scope · Vietnam time · refreshed time · data boundary · `Refresh`
2. Mode
   - `Needs action`
   - `Delivery records`
3. Needs action selector
   - `Open failure groups · N groups`
   - `Failed · N notifications`
   - `No send attempt after 15m · N notifications`
   - `No active push route · N notifications`
   - `App route needs refresh · N notifications`
4. 결과
   - 첫 화면에 issue/recipient/status/primary action이 모두 보인다.
   - primary action text가 보이고, audit만 overflow에 둔다.
5. Delivery records
   - Search, Recipient role, Channel, Send status, Date, Sort만 유지한다.
   - 기본 Today, 10 rows, server pagination을 유지한다.

추가하지 않을 것:

- chart/KPI dashboard
- persistent incident schema
- ack/assign/resolve lifecycle
- bulk retry/bulk contact
- page-size selector
- 새 filter/state library

## 7. 문구 수정안

| 현재 또는 잔존 문구 | 권장 문구 | 이유 |
|---|---|---|
| `Data boundary unverified` | `Mixed local data · fixture rows may remain` | 실제 영향 설명 |
| default에서 선택 없음 | `Open failure groups · N groups` active | 현재 상태 명시 |
| `Open affected records` | `Open this group` | exact scoped link일 때만 사용 |
| ellipsis only | `Review & retry`, `Open recipient`, `Open audit trail` | 다음 행동을 scan 가능하게 함 |
| `All unresolved ages` | 유지 | API mode `all`과 일치 |
| `Accepted by FCM` | 유지 | receipt/open으로 오해하지 않음 |
| `No send attempt after 15m` | 유지 | worker 문제와 사용자 미수신을 구분 |
| `No active push route` | 유지 | user 상태를 추측하지 않음 |
| `App route needs refresh` | 유지 | `inactive user`보다 정확함 |

## 8. 구현 순서

### 단계 1 — 릴리스 정합성

1. 현재 source build
2. 3101 재기동
3. H1/mode/queue 제거 확인
4. 1440/1024/720 재캡처

### 단계 2 — P0 데이터·보안

1. failure group exact filter/deep link
2. unnamed recipient masking
3. retry audit correlation/order 보강
4. focused Web/API/security tests

### 단계 3 — P1 운영성

1. group selector active/count
2. visible primary next action
3. manual Refresh
4. data boundary operator copy

### 단계 4 — 정리

1. unused model fields 계산 제거
2. dead legacy component/spec 삭제
3. source-string test를 behavior test로 교체

## 9. 완료 기준

- 최신 source가 3101에 실제로 보인다.
- default selector에서 `Open failure groups`가 선택돼 있다.
- group action이 provider/failure code로 exact filter된다.
- unnamed recipient의 full phone이 HTML/accessible name에 없다.
- Next action은 점 세 개를 열기 전에 보인다.
- manual refresh와 refreshed time이 동작한다.
- retry는 separate permission, reason, eligibility, accepted-path exclusion, correlated audit를 모두 만족한다.
- 1440·1024·720에서 page-level horizontal scroll이 없고 내부 vertical table scroll이 없다.
- 1024 이하에서는 status와 action이 같은 stacked row 안에 보인다.
- list/summary 실패, empty, filter zero, out-of-range page가 구분된다.
- System/Finance source 업무는 `/notifications`에 다시 나타나지 않는다.

## 10. 실행한 검증

### Admin Web

```text
npm.cmd run test --workspace @massage-vn/admin-web --
  app/notifications/page.spec.tsx
  app/notifications/notification-page-model.spec.ts
  app/notifications/notifications-table-section.spec.tsx
  app/notifications/notification-action-confirmation.spec.ts
```

- 4 files passed
- 88 tests passed

### API

```text
npm.cmd run test --workspace @massage-vn/api --
  src/admin/admin-notification-production-data.spec.ts
  src/admin/admin-notification-retry-query.spec.ts
  src/admin/admin-notification-unattempted-query.spec.ts
  src/admin/admin-notification-device-health-query.spec.ts
  src/admin/admin-operator-category.guard.spec.ts
  src/notifications/notification-retry-audit.spec.ts
  src/notifications/notifications.service.spec.ts
  src/notifications/notifications.processor.spec.ts
```

- 8 files passed
- 82 tests passed

### 실행하지 않은 검증

- `next build`와 3101 재기동: 감사 요청은 read-only였고 현재 사용 중인 production build를 덮어쓰지 않았다.
- 실제 notification retry/legacy review/Finance assignment: 외부 상태를 바꾸므로 실행하지 않았다.
- 최신 source의 browser visual QA: stale 3101 build 때문에 완료할 수 없었다.

### Browser console

- `error`: 0
- `warn`: 0
- 최종 전달 탭은 viewport override를 해제하고 `http://localhost:3101/notifications`로 복원했다.

## 11. 캡처 단계와 화면 건강도

| # | 캡처 | 상태 | 핵심 관찰 |
|---:|---|---|---|
| 1 | 기본 1440 상단 | 불량 | 구 H1·현재/과거 중복·0건 incident table |
| 2 | 기본 filter | 불량 | 결과보다 queue 설명/필터가 큼 |
| 3 | advanced 펼침 상단 | 불량 | active chip은 있으나 핵심 옵션이 아래로 밀림 |
| 4 | advanced 전체 | 불량 | 15개 additional queue로 선택 과부하 |
| 5 | All notifications Today | 주의 | 0건이지만 큰 empty table과 filter가 우선 |
| 6 | Needs action clear | 주의 | clear state는 명확하나 records와 중복 |
| 7 | Reference metrics | 불량 | 0 카드 12개가 운영 queue보다 큼 |
| 8 | Partner policy/history | 불량 | delivery 운영과 정책·개발 setup이 혼합 |
| 9 | All history 상단 | 불량 | 82,945건 전체와 heavy filter가 즉시 노출 |
| 10 | history table left | 불량 | nested scroll, 긴 기술 문구, action 미노출 |
| 11 | table right | 불량 | action을 보려면 identity/time을 잃음 |
| 12 | action menu | 주의 | action 자체는 안전하지만 primary action이 ellipsis 뒤에 숨음 |
| 13 | System incidents | 불량 | Customer Notifications 아래 시스템 사고 혼합 |
| 14 | System gate/table | 불량 | 긴 runbook과 filter가 결과보다 앞섬 |
| 15 | Finance overdue | 불량 | Customer Support 안에 Finance source queue 혼합 |
| 16 | Finance owner/SLA | 주의 | owner·SLA는 유용하나 source 화면에 있어야 함 |
| 17 | Historical cleanup | 불량 | raw error code가 깨져 줄바꿈되고 action은 화면 밖 |
| 18 | history 하단 filter | 불량 | filter가 table과 pagination 뒤에 나타남 |
| 19 | Finance history | 불량 | 0건에도 다층 filter를 모두 노출 |
| 20 | 1024 | 불량 | sidebar 비중이 크고 filter가 긴 세로 흐름 |
| 21 | 720 상단 | 주의 | page overflow는 없으나 header/filter가 첫 화면 대부분 차지 |
| 22 | 720 table left | 불량 | status/action이 보이지 않고 1280px table을 내부 scroll |
| 23 | 720 table right | 불량 | status/action을 보면 recipient/title context가 사라짐 |

## 12. 전체 캡처

### 1. 기본 화면 상단

![기본 Notifications 화면](01-notifications-top-1440.png)

### 2. 기본 filter 영역

![기본 filter](02-notifications-filters-1440.png)

### 3. Advanced filter 펼침

![Advanced filter 펼침](03-notifications-advanced-filters-1440.png)

### 4. Advanced filter 전체

![Advanced filter 전체](04-notifications-advanced-filters-bottom-1440.png)

### 5. All notifications Today

![All notifications Today](05-notifications-all-1440.png)

### 6. Needs action clear

![Needs action clear](06-notifications-all-bottom-1440.png)

### 7. Reference metrics

![Reference metrics](07-notifications-reference-metrics-1440.png)

### 8. Partner policy와 history

![Policy와 history](08-notifications-policy-and-history-1440.png)

### 9. All history filter

![All history filter](09-notifications-all-history-top-1440.png)

### 10. All history table left

![All history table left](10-notifications-all-history-table-1440.png)

### 11. All history table action column

![All history action column](11-notifications-table-action-column-1440.png)

### 12. Action menu

![Action menu](12-notifications-action-menu-1440.png)

### 13. System incidents

![System incidents](13-notifications-system-incidents-1440.png)

### 14. System incident gate와 table

![System incident gate](14-notifications-system-incidents-gate-table-1440.png)

### 15. Finance overdue

![Finance overdue](15-notifications-finance-overdue-1440.png)

### 16. Finance owner와 SLA

![Finance owner와 SLA](16-notifications-finance-owner-sla-1440.png)

### 17. Historical delivery cleanup

![Historical delivery cleanup](17-notifications-delivery-history-1440.png)

### 18. Historical table 뒤 filter

![Historical filter 위치](18-notifications-delivery-history-filters-bottom-1440.png)

### 19. Finance history

![Finance history](19-notifications-finance-history-1440.png)

### 20. 1024px

![1024px](20-notifications-all-history-1024.png)

### 21. 720px 상단

![720px 상단](21-notifications-all-history-720-top.png)

### 22. 720px table left

![720px table left](22-notifications-all-history-720-table.png)

### 23. 720px action column

![720px action column](23-notifications-all-history-720-action-column.png)

## 13. 보호·보존할 영역

- `/notifications/templates`, `/notifications/push-send`의 기존 route와 권한
- BullMQ notificationId deduplication
- 이미 성공한 device path 제외
- target role 기반 eligible device 판정
- retry reason 12–500자와 server-side revalidation
- `NOTIFICATIONS_DELIVERY`와 `NOTIFICATIONS_RETRY` 분리
- raw token과 full device ID 비노출
- list/summary explicit error state
- server pagination 10 rows와 out-of-range canonical redirect
- System/Finance source 화면 redirect

## 14. 남은 위험

- local DB의 이름 기반 `Smoke`, `Demo`, `Audit` row는 명시적 provenance가 없으면 production predicate에서 제외되지 않을 수 있다.
- 최신 source의 실제 visual 결과는 새 build 전까지 알 수 없다.
- actual FCM send, retry, audit persistence failure path는 이번 감사에서 실행하지 않았다.
- source-based unit test 통과만으로 배포된 3101의 화면 일치를 보장할 수 없다.
