# Codex 실행 프롬프트 — Notification Delivery 재검증 후속 보완

아래 `Prompt` 전체를 새 Codex 작업에 그대로 전달한다. 이 문서는 최초 재설계 프롬프트가 아니라, 이미 구현된 개선을 보존하면서 재검증 보고서에 남은 문제만 닫는 **후속 구현 계약**이다.

---

## Prompt

작업 경로는 반드시 `C:\dev\massage-on-demand-vn`만 사용한다. `C:\dev\massage-vn-workspace`는 사용하지 않는다.

관리자 페이지 `http://localhost:3101/notifications`의 재검증에서 남은 문제를 실제 코드와 실행 화면에서 수정하라. 목표는 새로운 대시보드를 다시 만드는 것이 아니라, 현재 소스에 이미 구현된 `Notification Delivery` 구조를 실제 3101 런타임에 반영하고 다음 결함을 최소 범위로 해결하는 것이다.

1. failure group action이 선택한 group만 여는 exact deep link가 아니다.
2. 이름 없는 recipient의 full phone이 visible label 또는 accessible name에 노출될 수 있다.
3. retry enqueue 성공 뒤 audit write가 실패할 수 있는 감사 공백이 있다.
4. 기본 `Open failure groups`가 issue selector에서 선택 상태로 보이지 않는다.
5. `Next action`의 실제 행동이 ellipsis 뒤에 숨겨져 있다.
6. 운영 queue에 명시적인 manual refresh가 없다.
7. data-boundary 문구가 운영자가 데이터 신뢰 범위를 판단하기 어렵다.
8. legacy 계산과 source-string test가 새 화면의 실제 계약보다 많이 남아 있다.
9. legacy history deep link의 age 의미가 notification 생성 시각과 latest unresolved attempt 시각 사이에서 불명확하다.

계획만 작성하고 멈추지 않는다. 현재 코드와 dirty diff를 먼저 확인하고, 실제 caller와 request flow를 추적한 뒤 구현·focused test·scope verification·Admin Web build·3101 재기동·로그인된 브라우저 검증까지 완료한다. 실제 알림 발송 또는 manual retry는 실행하지 않는다.

### 1. 먼저 읽고 지킬 자료

다음 순서로 읽는다.

1. `C:\dev\massage-on-demand-vn\AGENTS.md`
2. `C:\dev\massage-on-demand-vn\docs\agent\HANDS_CODEX_WORKFLOW_GUARD.md`
3. `C:\dev\massage-on-demand-vn\output\notifications-audit-2026-08-06\notifications-post-implementation-revalidation-report.md`
4. 같은 폴더의 재검증 캡처 `01-notifications-top-1440.png`부터 `23-notifications-all-history-720-action-column.png`까지

보고서의 현상과 파일명은 출발점이지 현재 코드보다 높은 권위가 아니다. 작업 시작 시 `git status --short`와 관련 diff를 확인하고, 보고서 이후 변경된 코드가 있으면 현재 동작을 기준으로 판단한다.

HANDS 저장소 규칙:

- main agent 하나만 사용한다. subagent, worker, handoff, multi-agent 도구를 사용하지 않는다.
- 기존 modified/untracked 파일은 사용자 소유다. 되돌리거나 삭제하거나 broad format하지 않는다.
- 현재 작업 파일만 수정한다. stage 또는 commit은 별도 요청이 없으면 하지 않는다.
- 새 dependency, 새 state library, 새 table framework, 새 realtime framework, 새 audit framework를 추가하지 않는다.
- shared helper를 바꾸기 전 `rg`로 모든 caller를 확인한다.
- 화면 문구에서는 `Provider`가 아니라 `Partner`를 사용한다. 내부 legacy identifier는 유지할 수 있다.

### 2. 현재 구현에서 반드시 보존할 계약

다음은 이미 구현됐으므로 regression을 만들지 않는다.

- route는 `/notifications`다.
- nav와 H1은 `Notification Delivery`다.
- top-level mode는 `Needs action | Delivery records` 두 개다.
- System 업무는 Background Jobs, Finance 업무는 Bank Reconciliation으로 분리된다.
- canonical issue는 `Failed`, `No send attempt after 15m`, `No active push route`, `App route needs refresh`다.
- default result는 모든 age의 unresolved failure groups다.
- FCM `SENT`의 사용자 문구는 `Accepted by FCM`이며 `Delivered`가 아니다.
- 표 기본 구조는 `Created | Recipient | Notification | Send status | Next action`의 compact 5열이다.
- page size는 10이고 server pagination과 out-of-range canonical redirect를 유지한다.
- list error, summary error, empty, filter zero 상태를 서로 구분한다.
- `NOTIFICATIONS_DELIVERY`와 `NOTIFICATIONS_RETRY` 권한을 분리한다.
- retry reason은 server에서 12–500자로 검증한다.
- 이미 성공한 device path는 retry 대상에서 제외하고 enqueue 직전에 eligibility를 재검증한다.
- raw push token, full device ID, full phone을 목록·URL·audit metadata에 노출하지 않는다.
- `/notifications/templates`와 `/notifications/push-send`의 route와 권한을 유지한다.

위 계약을 다시 설계하거나 21개 legacy queue, System incident, Finance queue, 큰 KPI/reference card를 복원하지 않는다.

### 3. 작업 전 최소 조사 범위

관련 caller를 `rg`로 찾은 뒤 최소한 다음 흐름을 확인한다.

Admin Web:

- `apps/admin_web/app/notifications/page.tsx`
- `apps/admin_web/app/notifications/notification-page-model.ts`
- `apps/admin_web/app/notifications/notification-table-row.tsx`
- `apps/admin_web/app/notifications/notifications-table-section.tsx`
- `apps/admin_web/app/notifications/notification-action-confirmation.ts`
- `apps/admin_web/app/notifications/actions.ts`
- 관련 `*.spec.ts`와 `*.spec.tsx`
- `apps/admin_web/components/start-shift-refresh-button.tsx`의 `router.refresh()` 패턴
- notification responsive CSS가 있는 `apps/admin_web/app/globals.css`
- `apps/admin_web/lib/admin-api.ts`의 notification query/summary type

API와 queue:

- `apps/api/src/admin/admin-notification.routes.ts`
- `apps/api/src/admin/admin.service.ts`의 list, summary, `retryNotification`
- `apps/api/src/admin/admin-notification-retry-query.ts`
- failure-group/list/summary predicate를 만드는 notification query helper
- `apps/api/src/notifications/notifications.service.ts`의 `retry`
- `apps/api/src/notifications/notification-send.queue.ts`
- `apps/api/src/notifications/notification-retry-audit.ts`
- 관련 focused specs

호환성:

- `/notifications?review=delivery-incident-history`를 만드는 caller
- `issue`, `provider`, `failureCode`, `age`, `page`를 읽고 만드는 모든 caller
- `notificationUserLabel()`과 phone masking helper의 모든 caller
- notification retry API response와 audit action을 사용하는 caller

파일이 크다는 이유만으로 먼저 분리하지 않는다. 실제로 render되지 않는 계산과 dead component만 caller 확인 후 삭제한다.

### 4. 실행 순서

#### 단계 A — 최신 소스와 3101 런타임 정합성부터 확보

현재 3101은 이전 감사 당시 `next start -p 3101`의 stale production build를 보여 줬다. 코드 수정 전 다음을 안전하게 확인한다.

1. 3101을 점유한 정확한 PID, 실행 명령, working directory를 read-only로 확인한다.
2. 현재 source와 `.next/BUILD_ID` 시각을 비교한다.
3. 현재 source로 Admin Web build를 만든다.
4. broad process kill을 하지 말고, 확인된 3101 Admin Web 프로세스만 종료·재기동한다.
5. 로그인된 브라우저에서 H1 `Notification Delivery`, 두 mode, 5개 이하 issue 선택 구조, legacy board 제거가 실제로 보이는지 확인한다.

이 단계의 목적은 stale 화면을 없애는 것이다. build ID나 commit hash를 UI에 추가하지 않는다. 배포 검증 로그로 충분하다. 기존 23개 stale 캡처를 최종 개선 증거로 재사용하지 않는다.

#### 단계 B — failure group exact deep link

현재 모든 failure group row가 `/notifications?issue=failed`로 이동하는 문제를 고친다.

요구사항:

- group row action은 해당 row의 `provider`와 normalized `failureCode`를 URL에 포함한다.
- 예: `/notifications?issue=failed&provider=FCM&failureCode=UNREGISTERED`
- URL 값은 기존 query builder를 통해 encode한다. 문자열을 수동 연결하지 않는다.
- page/model/API route/list query/summary query가 같은 normalization과 predicate를 사용한다.
- unsupported provider 또는 failureCode는 임의 검색 조건으로 통과시키지 말고 기존 invalid-filter 처리 방식으로 무시 또는 canonical reset한다.
- deep link 진입 후 active filter에 `FCM · App route expired`처럼 현재 scope가 보인다.
- reset하면 `issue=failed`만 남기고 독립된 다른 filter를 의도치 않게 지우지 않는다.
- 선택 group의 row만 나오고 total/count도 같은 predicate를 사용한다.
- exact filtering을 실제로 구현한 뒤 action copy를 `Open this group`으로 바꾼다.

새 filter framework를 만들지 않는다. 기존 `buildNotificationDeliveryHref`, `notificationDeliveryModelParams`, API query helper를 확장하는 가장 작은 변경을 우선한다.

최소 테스트:

- 서로 다른 provider/failureCode group은 서로 다른 href를 만든다.
- URL special character가 안전하게 encode된다.
- selected group 진입 시 반환 rows, total, summary가 모두 같은 group이다.
- reset URL이 canonical하다.

#### 단계 C — 이름 없는 recipient 개인정보 보호

`notification-page-model.ts`에서 masked `userPhone`을 만들어도 `notificationUserLabel()`이 이름이 없을 때 raw phone을 반환하는 경로를 닫는다.

목록과 action accessible name의 안전한 우선순위:

1. `fullName`
2. masked phone
3. short user ID

요구사항:

- visible recipient primary label과 `Actions for ...` accessible name이 같은 list-safe label을 사용한다.
- 이름 없는 Customer와 Partner 모두 검사한다.
- full phone은 권한이 적용되는 상세 페이지 또는 명시적 contact action 밖에서는 보이지 않는다.
- 기존 `notificationUserLabel()`의 다른 caller가 full phone을 의도적으로 필요로 하면 전역 의미를 무리하게 바꾸지 말고 notification list 전용 작은 helper 하나를 둔다.

최소 테스트:

- 이름 없는 Customer와 Partner fixture를 render한다.
- rendered HTML 전체와 accessible name에 raw full phone이 없음을 검사한다.
- masked phone 또는 short ID가 visible하게 남아 운영자가 recipient를 구분할 수 있음을 검사한다.

#### 단계 D — retry enqueue와 audit의 실패 공백 제거

현재 `AdminService.retryNotification()`은 `notifications.retry()`로 queue enqueue를 끝낸 뒤 `writeAudit()`을 호출한다. enqueue 성공 후 audit write가 실패하면 실제 job은 존재하지만 API가 실패로 보이고 감사 흔적이 없을 수 있다.

새 distributed transaction, outbox, audit service 추상화를 만들지 말고 현재 audit/queue primitive로 다음 불변조건을 만족시킨다.

- reason validation과 server-side eligibility 재검증은 유지한다.
- enqueue 전에 `retry requested` audit을 성공적으로 기록한다.
- 시작 audit 실패 시 queue add를 호출하지 않는다.
- request와 outcome을 연결할 correlation ID를 Node 표준 기능으로 만든다. 같은 ID를 request audit, queued/failed outcome, 가능하면 queue job metadata에 사용한다.
- enqueue 성공 시 `queued` outcome에 job ID, queue name, actor, reason, eligible path snapshot, masked device IDs를 남긴다.
- enqueue 실패 시 `failed` outcome을 기록하고 성공 notice를 반환하지 않는다.
- enqueue는 성공했지만 outcome audit 보강이 실패한 경우 generic retry 실패로 보여 중복 실행을 유도하지 않는다. 이미 생성된 job ID/notification ID/correlation을 Background Jobs 또는 서버 로그에서 찾을 수 있는 최소한의 계약을 남긴다.
- raw token, full phone, full device ID, provider response body를 audit 또는 job metadata에 넣지 않는다.
- BullMQ notificationId deduplication과 processor의 successful-device exclusion을 유지한다.

기존 반환 타입을 무리하게 넓히거나 새 persistence model을 만들지 않는다. 현재 primitive로 완전한 원자성을 보장할 수 없는 경계는 거짓으로 숨기지 말고, 중복 retry를 막는 사용자 응답과 추적 가능한 correlation을 우선한다.

최소 테스트:

- request audit 실패 시 `notifications.retry()`/queue add가 호출되지 않는다.
- queue add 실패 시 `queued` audit과 성공 response가 없다.
- queue add 실패의 `failed` outcome은 같은 correlation을 가진다.
- queue add 성공 시 request와 queued audit에서 동일 correlation과 job ID를 추적할 수 있다.
- 성공한 device path 제외, 권한, 12–500자 reason, 409 계약이 regression 없이 유지된다.

#### 단계 E — 운영자가 첫눈에 현재 상태와 다음 행동을 알게 한다

현재 구조를 유지하고 다음만 보완한다.

1. issue selector 첫 항목에 `Open failure groups · N groups`를 넣고 default `issue=groups`에서 selected 상태로 표시한다.
2. count 단위를 구분한다. failure group은 `groups`, 나머지는 `notifications`다.
3. `Next action` cell에 primary text action을 직접 보여 준다.
   - failure group: `Open this group`
   - retry 가능 실패: `Review & retry`
   - no route/stale route: `Open recipient`
   - accepted/skipped record: `Open audit trail`
4. `Audit trail` 같은 secondary action만 기존 overflow menu에 둔다.
5. primary action과 overflow trigger 모두 충분한 accessible name과 keyboard focus를 가진다.
6. header의 data status 영역에 manual `Refresh`를 둔다. 새 auto-refresh를 만들지 않는다.
7. refresh는 기존 `router.refresh()` 패턴과 현재 button atom을 재사용한다. Start Shift 전용 aria-label/copy를 그대로 복사하지 않는다.
8. refresh 중 `Refreshing`, 완료 후 새 `Refreshed {time}`, 실패 시 기존 summary/list error state를 사용한다.
9. `Data boundary unverified`는 현재 backend가 provenance를 보장하지 않는 동안 `Mixed local data · fixture rows may remain`로 바꾼다.
10. API가 boundary metadata를 실제 제공하면 `Operational data · fixtures excluded`; metadata가 없으면 `Data scope unavailable`을 사용한다. 검증 없이 `Test data excluded`를 표시하지 않는다.

navigation group은 조직 ownership 정보가 코드에서 확인되지 않으면 이번 작업에서 이동하지 않는다. 중복 nav item도 만들지 않는다. 대신 description이 Customer, Partner, Admin delivery 범위를 오해시키는지 확인하고 필요한 최소 문구만 보완한다.

추가하지 않을 것:

- chart/KPI dashboard
- persistent incident/ack/assign/resolve model
- bulk retry 또는 bulk contact
- page-size selector
- 자동 polling/realtime subscription
- 긴 runbook 또는 reference metric card

#### 단계 F — legacy 정리와 테스트 신뢰도

`notification-page-model.ts`와 관련 component/spec에서 현재 page가 더 이상 쓰지 않는 legacy 계산을 caller 확인 후 삭제한다.

후보:

- metrics / channelMetrics / recordMetrics
- channelSummary
- partnerAlertSmokeFallback / fcmSmokeReadiness
- opsQueue
- legacy filter board와 channel policy section 전용 상태

삭제 기준:

- 현재 page, templates, push-send, deep-link compatibility 또는 다른 caller가 사용하면 유지한다.
- 사용하지 않는 계산을 다른 facade/repository/factory로 옮기지 말고 삭제한다.
- dead component/spec도 함께 제거하되 unrelated 화면은 건드리지 않는다.
- 한 번에 broad refactor하지 않는다. 이번 변경에 직접 연결되는 dead path만 정리한다.

`page.spec.tsx`의 `readFileSync`/`toContain()` source-string 검사는 실제 행동 테스트로 바꾼다.

행동 테스트가 확인할 것:

- default `Open failure groups` selected state
- visible primary action label과 secondary overflow
- exact group href와 active filter
- unnamed recipient masking과 accessible name
- 1024px 이하 status/action 배치에 필요한 class/구조
- list error, summary error, empty, invalid filter, out-of-range redirect

import boundary처럼 source inspection이 유일하게 적합한 소수 계약만 source-string test로 남긴다.

#### 단계 G — legacy history age 의미 고정

`review=delivery-incident-history`가 `issue=groups&age=over-24h`로 redirect되는 호환 계약을 확인한다.

- failure cleanup의 의미는 `latest unresolved delivery attempt age`를 기준으로 고정한다.
- notification `createdAt`이 아니라 group의 latest unresolved `attemptedAt`이 24시간을 넘었는지 list와 summary에서 같은 방식으로 판단한다.
- delivery row가 전혀 없는 `No send attempt after 15m`는 이 failure-group history 조건에 섞지 않는다.
- redirect URL, UI copy, API predicate, test fixture가 같은 시간 기준을 사용한다.
- 기존 외부 deep link는 깨뜨리지 않는다.

만약 현재 데이터 모델상 group age를 query에서 정확히 계산할 수 없으면 조용히 createdAt을 유지하지 말고, 코드 근거와 가장 작은 안전한 대안을 최종 보고한다. 새 incident table은 만들지 않는다.

### 5. 반응형·접근성 합격 기준

실제 최신 build를 로그인된 브라우저에서 1440×900, 1024×900, 720×900으로 확인한다.

- page-level horizontal scroll이 없다.
- table 내부에 별도 vertical scroll 영역이 없다.
- 1024px 이하에서 row가 stacked layout으로 보이며 recipient, status, primary action이 같은 row 안에 있다.
- primary action을 보기 위해 recipient/title context를 잃지 않는다.
- selected mode/issue와 active group filter가 시각적 상태뿐 아니라 접근성 상태로도 구분된다.
- keyboard만으로 mode, issue, primary action, overflow, confirmation, cancel을 사용할 수 있다.
- focus가 modal 밖으로 새지 않고 close 후 trigger 또는 합리적인 위치로 복귀한다.
- 색만으로 failed/accepted/skipped 상태를 구분하지 않는다.
- full phone, raw token, full device ID가 DOM과 accessible name에 없다.
- 브라우저 console error와 warning은 0이다. 기존 unrelated warning이 있으면 정확히 구분해 보고한다.

최종 캡처는 `C:\dev\massage-on-demand-vn\output\notifications-improvement-verification-2026-08-06\`에 저장한다.

최소 캡처:

1. 1440 default Needs action와 selected failure groups
2. 1440 exact failure group 진입과 visible active filter
3. 1440 failed record의 `Review & retry`와 confirmation
4. 이름 없는 recipient row의 masked label
5. 1024 stacked row
6. 720 stacked row와 visible primary action
7. Delivery records filter와 accepted/skipped copy
8. list error/empty 중 안전하게 재현 가능한 상태

실제 retry confirm 제출, FCM send, legacy review 저장, 데이터 삭제는 하지 않는다. confirmation은 열어 내용과 focus만 검증하고 취소한다.

### 6. 검증 명령

먼저 변경과 직접 관련된 focused test를 실행한다.

Admin Web:

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- app/notifications/page.spec.tsx app/notifications/notification-page-model.spec.ts app/notifications/notifications-table-section.spec.tsx app/notifications/notification-action-confirmation.spec.ts app/notifications/actions.spec.ts
npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run build --workspace @massage-vn/admin-web
```

API:

```powershell
npm.cmd run test --workspace @massage-vn/api -- src/admin/admin-notification-production-data.spec.ts src/admin/admin-notification-retry-query.spec.ts src/admin/admin-notification-unattempted-query.spec.ts src/admin/admin-notification-device-health-query.spec.ts src/admin/admin-operator-category.guard.spec.ts src/notifications/notification-retry-audit.spec.ts src/notifications/notifications.service.spec.ts src/notifications/notifications.processor.spec.ts
npm.cmd run typecheck --workspace @massage-vn/api
```

scope verification:

```powershell
npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api
```

새 spec 파일을 만들었다면 focused command에 추가한다. 테스트가 기존 dirty worktree의 unrelated 실패로 막히면 실패 명령, 첫 root cause, 이번 변경과의 관련성을 구분해 보고하고 passing이라고 쓰지 않는다.

Prisma schema/migration, shared types, auth, payment, wallet, booking, matching, realtime event contract를 건드리지 않는 것이 기본이다. 검사 결과 정말 필요한 경우에만 최소 변경하고 AGENTS.md의 protected-area 검증과 full local verification을 추가한다.

### 7. 3101 재기동 안전 규칙

- 현재 source build가 성공한 뒤 재기동한다.
- port 3101의 정확한 listener와 command line을 다시 확인한다.
- broad `taskkill /IM node.exe`, 모든 Node 프로세스 종료, wildcard kill을 하지 않는다.
- 확인된 HANDS Admin Web PID만 종료한다.
- 같은 working directory와 `next start -p 3101` 계약으로 숨김/비대화형 프로세스를 시작한다.
- 새 server가 실제 응답할 때까지 로그와 HTTP를 확인한다.
- H1과 mode가 최신 source와 일치하지 않으면 build/runtime mismatch를 해결하기 전 시각 QA를 진행하지 않는다.

### 8. 최종 완료 기준

다음이 모두 충족돼야 완료다.

- 실제 3101 H1/nav가 `Notification Delivery`다.
- 첫 화면에 `Needs action | Delivery records`와 5개 issue option만 있다.
- default에서 `Open failure groups · N groups`가 selected다.
- 서로 다른 failure group이 서로 다른 exact URL을 가지며 list/total/summary가 같은 group을 뜻한다.
- 이름 없는 Customer/Partner의 full phone이 visible HTML과 accessible name에 없다.
- primary `Next action`은 ellipsis를 열기 전에 보인다.
- manual Refresh와 refreshed time이 동작한다.
- data-boundary copy가 실제 보장 수준을 과장하지 않는다.
- retry request audit이 enqueue보다 먼저 성공하고, queued/failed outcome과 correlation을 추적할 수 있다.
- audit 실패 때문에 이미 queued된 retry를 사용자가 다시 실행하도록 오도하지 않는다.
- `NOTIFICATIONS_RETRY`, reason, eligibility, accepted-path exclusion, 409 계약이 유지된다.
- legacy history age가 latest unresolved attempt 기준으로 UI/API/test에서 일치한다.
- 1440/1024/720에서 nested scroll이나 숨은 action이 없다.
- focused test, typecheck, Admin Web build, admin/api scope verification 결과가 명시돼 있다.
- 최종 캡처와 현재 source가 같은 build를 증명한다.

일부가 불가능하면 완료라고 선언하지 않는다. 정확한 blocker, 확인한 근거, 안전하게 끝낸 범위, 다음 한 단계를 보고한다.

### 9. 최종 보고 형식

최종 답변은 다음 순서로 간결하고 구체적으로 작성한다.

1. 운영자 관점에서 달라진 결과
2. P0/P1/P2별 완료·미완료 상태
3. 변경 파일과 각 파일의 이유
4. 실행한 명령과 pass/fail/skipped 결과
5. 3101 build/runtime 정합성 확인 결과
6. 1440/1024/720 캡처 링크
7. 개인정보·권한·retry audit 검증 결과
8. protected area touched 여부
9. 남은 위험과 다음 권장 작업 하나

"개선했다"고만 쓰지 않는다. exact group URL 예시, masked recipient 결과, retry audit ordering test, 실제 H1/mode, 반응형 결과처럼 운영자가 확인할 수 있는 증거를 포함한다.

---

## 이 프롬프트가 강제하는 우선순위

1. stale build 제거와 실제 화면 정합성
2. exact group scope, 개인정보, retry audit 안전
3. selected state, visible action, refresh, data-scope 문구
4. dead 계산 삭제와 behavior test
5. responsive browser acceptance

새 기능의 수가 아니라 **잘못된 대상 처리, 개인정보 노출, 중복 retry, stale 화면 승인 가능성을 없애는 것**이 성공 기준이다.
