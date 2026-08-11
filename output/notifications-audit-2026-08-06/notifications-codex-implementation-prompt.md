# Codex 실행 프롬프트 — Notification Delivery 운영 개선

아래 `Prompt` 전체를 새 Codex 작업에 그대로 전달한다. 이 문서는 디자인 아이디어가 아니라 **현재 HANDS 코드에서 Admin Web·API·권한·재시도·감사·테스트·실제 브라우저 검증까지 완료시키는 실행 계약**이다.

---

## Prompt

작업 경로는 반드시 `C:\dev\massage-on-demand-vn`만 사용한다.

관리자 페이지 `http://localhost:3101/notifications`를 운영자가 빠르고 안전하게 사용할 수 있는 **Notification Delivery 운영 화면**으로 개선하라. 화면만 보기 좋게 바꾸지 말고, queue 이름·집계 단위·API predicate·전송 상태·재시도 권한·감사 기록·페이지네이션·개인정보가 모두 같은 의미를 갖도록 Admin Web과 NestJS API의 실제 흐름을 함께 수정하라.

간단한 작업 계획을 세운 뒤 계획만 보고하고 멈추지 않는다. 현재 코드를 검사하고, 필요한 최소 범위로 구현하고, 관련 테스트와 HANDS scope verification을 실행하고, 로그인된 실제 관리자 화면에서 전후 상태를 확인한 뒤 결과를 보고한다. 데이터 삭제, 실제 FCM 발송, 실제 retry 확정, legacy review 저장은 이 작업에서 실행하지 않는다.

### 1. 먼저 읽을 자료

다음 순서로 확인한다.

1. `C:\dev\massage-on-demand-vn\AGENTS.md`
2. `C:\dev\massage-on-demand-vn\docs\agent\HANDS_CODEX_WORKFLOW_GUARD.md`
3. `C:\dev\massage-on-demand-vn\output\notifications-audit-2026-08-06\notifications-operator-ux-security-audit.md`
4. 같은 폴더의 `01-default-incidents.png`부터 `18-out-of-range-page.png`까지 모든 감사 캡처

감사 이후 코드가 바뀌었을 수 있으므로 보고서만 믿고 수정하지 않는다. 먼저 `git status --short`를 확인하고, 관련 파일의 현재 내용과 diff를 검사한 뒤 실제 caller와 request flow를 추적한다. 기존 dirty worktree의 수정과 untracked 파일은 모두 사용자 소유다. 되돌리거나 덮어쓰거나 broad format하지 않는다.

HANDS는 single-agent 저장소다. subagent, worker, handoff, multi-agent 도구를 사용하지 않는다.

### 2. 최종 운영 목표

운영자는 첫 화면에서 추측하지 않고 다음 질문에 답할 수 있어야 한다.

- 지금 아직 해결되지 않은 알림 전송 문제는 몇 건인가?
- 문제 유형은 실패, worker 미처리, 활성 mobile route 없음, app route 갱신 필요 중 무엇인가?
- 어떤 Customer 또는 Partner의 어떤 알림인가?
- FCM이 요청을 받아들인 것인가, 실제 실패한 것인가, 아직 시도하지 않은 것인가?
- partial delivery라면 성공한 path와 실패한 path는 각각 몇 개인가?
- 재시도해도 되는 path는 무엇이며 이미 성공한 device는 제외되는가?
- 원인은 Notification Delivery에서 처리할 문제인가, Background Jobs 또는 Finance source 화면에서 처리할 문제인가?
- 현재 결과가 실제 0건인가, filter 불일치인가, 요청 실패인가, 범위 밖 page인가?
- 현재 숫자의 단위가 notification, user, app route, failure group 중 무엇인가?
- 누가 어떤 근거로 retry했으며 어떤 job과 device path가 대상이었는가?

이 화면의 visitor mode는 **Operate**다. 장식이나 chart보다 정확한 상태, 빠른 scan, 다음 행동, 실패 방지, 권한, 감사 가능성, 개인정보 최소 노출을 우선한다.

### 3. 고정된 제품·정보구조 결정

다음 결정은 다시 토론하지 말고 구현한다. 현재 코드나 다른 caller와 충돌하는 사실을 발견하면 가장 작은 호환 방법을 선택하고 최종 보고에 기록한다.

1. `/notifications` route는 유지한다.
2. 내비게이션, breadcrumb, H1을 `Notification Delivery`로 통일한다.
3. 이 페이지는 Customer·Partner·Admin notification의 **전송 운영과 전송 기록**만 담당한다.
4. top-level mode는 `Needs action`과 `Delivery records` 두 개만 둔다.
5. 기본 mode는 `Needs action`이다.
6. `Needs action`의 기본 결과는 최근 24시간만이 아니라 **모든 age의 latest unresolved delivery path**를 반영한다.
7. persistent incident lifecycle을 새로 만들지 않는다. 현재 계산형 incident는 `Open failure groups`라고 부른다.
8. `Current incidents / Historical cleanup` 이중 구조를 제거한다. 24시간 경과는 해결이나 SLA 제외를 의미하지 않는다.
9. `Failed sends`와 `Needs retry`는 하나의 canonical `Failed` 상태로 합친다.
10. Needs action 상태는 최대 네 개만 노출한다.
    - `Failed`
    - `No send attempt after 15m`
    - `No active push route`
    - `App route needs refresh`
11. `System incidents`와 incident-state filter는 `/notifications`에서 제거한다. source of truth는 `/background-jobs`다.
12. `Finance overdue`와 `Finance history`는 `/notifications`에서 제거한다. source of truth는 Bank Reconciliation이다.
13. `Sent`, `Skipped`, `Mobile push`, `In-app route`, `Partner alerts`, `No-show`, `Payout setup`은 top-level queue가 아니다. 필요한 항목만 `Delivery records`의 status/channel/type filter로 제공한다.
14. `/notifications/templates`와 `/notifications/push-send` route, 권한, 동작은 유지한다. 이 작업에서 template 또는 campaign UI를 재설계하지 않는다.
15. 내부 DB status `SENT`는 user-facing copy에서 `Delivered`로 번역하지 않는다. `Accepted by FCM` 또는 `Sent to push provider`를 사용한다.
16. `No active push route`는 target role에 맞는 enabled PushDevice가 0개이고, 해당 notification이 이미 성공 완료된 상태가 아닌 경우만 포함한다.
17. `No send attempt after 15m`는 enabled target route가 있지만 delivery row가 없고 notification 생성 후 15분 이상 지난 경우다.
18. partial delivery는 성공보다 unresolved path를 먼저 표시한다.
19. 기본 목록에서 전화번호 전체값을 반복 표시하지 않는다. 기존 shared masking helper가 있으면 재사용한다.
20. manual retry는 server-side eligibility 재검증과 audit reason을 반드시 거친다.
21. Notification Delivery 열람 권한과 manual retry 권한을 분리한다.
22. 오래된 deep link는 깨뜨리지 말고 canonical route로 redirect하거나 source 화면으로 보낸다.

### 4. 수정 전 최소 조사 범위

`rg`로 먼저 찾고 shared helper를 수정하기 전 모든 caller를 확인한다. 최소한 다음 파일과 관련 spec을 검사한다.

Admin Web:

- `apps/admin_web/app/notifications/page.tsx`
- `apps/admin_web/app/notifications/notification-page-model.ts`
- `apps/admin_web/app/notifications/notification-filter-board-section.tsx`
- `apps/admin_web/app/notifications/notifications-table-section.tsx`
- `apps/admin_web/app/notifications/notification-table-row.tsx`
- `apps/admin_web/app/notifications/notification-delivery-cell.tsx`
- `apps/admin_web/app/notifications/notification-action-confirmation.ts`
- `apps/admin_web/app/notifications/notification-action-return-href.ts`
- `apps/admin_web/app/notifications/notification-review-runbook.ts`
- `apps/admin_web/app/notifications/actions.ts`
- `apps/admin_web/app/globals.css`
- `apps/admin_web/lib/admin-api.ts`
- `apps/admin_web/lib/admin-navigation.ts`
- `apps/admin_web/lib/admin-operator-access-model.ts`
- `apps/admin_web/lib/admin-operator-permissions.ts`
- `apps/admin_web/lib/admin-notification-delivery.ts`
- phone masking과 operator notice의 기존 shared pattern

API와 queue:

- `apps/api/src/admin/admin-notification.routes.ts`
- `apps/api/src/admin/admin.service.ts`의 `listNotifications`, `notificationSummary`, `retryNotification`
- `apps/api/src/admin/admin-notification-production-data.ts`
- `apps/api/src/admin/admin-notification-retry-query.ts`
- `apps/api/src/admin/admin-notification-unattempted-query.ts`
- `apps/api/src/admin/admin-notification-device-health-query.ts`
- `apps/api/src/admin/admin-queue-list.ts`
- `apps/api/src/admin/admin-operator-category.guard.ts`
- `apps/api/src/notifications/notifications.service.ts`
- `apps/api/src/notifications/notifications.processor.ts`
- `apps/api/src/notifications/notification-send.queue.ts`
- `apps/api/src/notifications/notification-retry-audit.ts`
- `apps/api/src/notifications/notification-target-role.ts`
- `apps/api/prisma/schema.prisma`의 permission enum, Notification, PushDevice, NotificationDelivery
- notification을 실제 DB에 만드는 smoke/seed/audit script와 local fixture writer

Caller와 호환성:

- `/notifications?review=` URL을 만드는 dashboard, start-shift, booking detail, customer/partner detail, background-jobs, audit-log, setup, operations-handoff 코드
- `/admin/notifications`, `/summary`, `/:id/retry`, `/review-legacy` caller
- notification permission category를 읽는 Admin Web/API guard와 operator management UI

`notification-page-model.ts`가 크다는 이유로 먼저 기계적으로 파일을 쪼개지 않는다. mixed-domain branch와 중복 queue를 제거한 뒤 남은 delivery concern만 필요한 최소 범위로 정리한다.

### 5. P0 — 데이터 의미와 신뢰

#### A. Production/test data 경계

현재 `Test data excluded` label과 실제 결과가 모순된다. 다음 원칙으로 수정한다.

- 사람 이름에 `Smoke`, `Demo`, `Audit`가 포함됐다는 이유만으로 제외하지 않는다.
- 기존 `adminNotificationProductionDataWhere/Sql`을 production predicate의 단일 출발점으로 유지한다.
- 실제 local smoke/seed/audit writer를 찾아 notification `data`에 명시적 provenance marker를 기록하게 한다. 기존 `smokeFixture`, `smoke`, `fixture` 계약을 재사용하고 같은 의미의 새 필드를 만들지 않는다.
- stable fixture ID prefix가 writer 코드에 명시되어 있다면 그 계약만 shared predicate에 추가한다. 화면 이름을 근거로 prefix를 추측하지 않는다.
- Prisma where, raw SQL failure query, unattempted query, device-health summary가 같은 predicate를 사용하도록 parity test를 추가한다.
- 기존 DB의 unmarked fixture를 자동 삭제하거나 이름 기반으로 update하지 않는다. 필요하면 안전한 dry-run 목록과 수동 정리 필요성을 최종 보고한다.
- 현재 data boundary를 완전히 보장할 수 없다면 `Test data excluded`를 제거하고 `Mixed local data` 또는 `Data boundary unverified`처럼 사실에 맞는 상태를 표시한다.
- summary에서 무조건 `dataClass: 'live'`를 반환해 production 보장을 암시하지 않는다.

#### B. Queue predicate를 화면 문구와 일치시키기

`disabled-device`의 현재 `pushDevices.some(enabled:false)` 조건을 운영 queue에서 사용하지 않는다.

`No active push route`의 canonical 조건:

- notification의 target role을 explicit `data.targetRole` 또는 기존 legacy role sets로 결정한다.
- 해당 role의 enabled PushDevice가 0개다.
- notification의 latest per-device disposition이 이미 모두 성공한 기록이 아니다.
- 결과 row와 summary count가 같은 predicate를 사용한다.

count 단위:

- 결과가 notification row면 header는 `N notifications`라고 쓴다.
- distinct affected user count를 보조로 표시할 수 있지만 `N users`라고 명시한다.
- disabled app route inventory는 이 action queue에서 제거하거나 diagnostics에만 둔다.
- 하나의 badge/card 안에서 users, routes, notifications를 설명 없이 섞지 않는다.

`Failed`의 canonical 조건:

- device path별 latest delivery를 기준으로 failed path가 하나 이상 남아 있다.
- successful path와 failed path가 함께 있으면 partial이다.
- 이미 이후 성공으로 회복된 과거 failure만으로 queue에 남기지 않는다.
- 기존 `Failed sends`와 `Needs retry` URL은 같은 canonical 화면으로 redirect한다.

`No send attempt after 15m`:

- enabled target route가 있다.
- delivery row가 0개다.
- createdAt으로 15분 이상 지났다.
- user-facing copy는 `Delivery not confirmed`가 아니라 `No send attempt after 15m`다.
- primary guidance는 `Check notification worker`다. 긴급 사용자 연락은 secondary guidance다.

`App route needs refresh`:

- target role의 enabled route가 있지만 lastSeenAt이 기존 stale threshold를 넘었다.
- 이미 성공 완료된 notification을 action queue에 포함하지 않는다.
- `Inactive app user` 또는 실제 접속상태처럼 보이는 `App offline` 문구를 사용하지 않는다.

#### C. 전송 status의 정확한 의미

- `SENT`는 FCM/provider acceptance로 취급한다.
- user-facing label은 `Accepted by FCM` 또는 provider 일반화가 필요하면 `Sent to push provider`다.
- 실제 device receipt 또는 app open telemetry가 없다면 `Delivered`, `Received`, `Read`를 표시하지 않는다.
- `SKIPPED`는 `Push not sent`로 표시하고 이유를 함께 제공한다.
- delivery attempt summary는 latest 한 건만 headline으로 사용하지 않는다.
- path별 latest 상태를 집계해 `1 failed · 1 accepted`처럼 표시하고 unresolved path를 먼저 보여준다.
- expanded evidence에는 provider, platform, masked device ID, attempted time, failure code, HTTP status, recovery hint를 표시한다.
- 전체 history는 기존 Audit trail에 두고 현재 table disclosure에 무제한 복제하지 않는다.

### 6. P0 — Manual retry 안전과 감사

#### A. 별도 권한

새 permission category `NOTIFICATIONS_RETRY`를 추가한다.

- `NOTIFICATIONS_DELIVERY`는 page와 delivery evidence read 권한이다.
- `NOTIFICATIONS_RETRY`는 manual retry POST와 UI action 권한이다.
- MASTER_ADMIN의 기존 최고 권한 동작은 유지한다.
- delegated operator는 explicit `NOTIFICATIONS_RETRY`가 있어야 한다.
- Admin Web action visibility, confirmation 접근, server action, API guard를 모두 같은 경계로 맞춘다.
- API guard에서는 `/admin/notifications/:id/retry`가 generic `/admin/notifications` read prefix보다 먼저/더 구체적으로 매칭되게 한다.
- Prisma enum과 migration이 필요하면 HANDS migration 규칙을 따른다. 기존 migration을 수정하지 말고 새 migration을 만든다.
- operator permission catalog에 label `Notification retry`, scope `Manual retry of unresolved notification delivery paths`를 추가한다.

legacy review는 System source cleanup이므로 일반 delivery operator에게 노출하지 않는다. migration 기간에 route를 유지해야 하면 기존 developer/system 권한으로 제한하고 `/notifications` primary UI에서는 제거한다.

#### B. Server-side retry contract

모든 manual retry에 12–500자의 operator reason을 요구한다. UI validation만 믿지 말고 API DTO/service에서도 검증한다.

API는 enqueue 직전에 현재 상태를 다시 읽고 다음을 확인한다.

- notification이 존재한다.
- target role에 맞는 enabled device가 있다.
- 이미 `SENT`가 기록된 device는 제외한다.
- 적어도 하나의 eligible unresolved/unsent device path가 남아 있다.
- 전부 성공했거나 eligible path가 0개면 409 Conflict를 반환한다.
- queue add가 실패하면 성공 응답이나 성공 audit를 만들지 않는다.
- BullMQ notificationId deduplication과 processor의 successful-device exclusion은 유지한다.
- processor도 마지막 방어선으로 delivered device를 계속 제외한다.

retry audit metadata에는 최소한 다음을 남긴다.

- actor
- reason
- notificationId
- target role
- retry 시점의 accepted/failed/skipped/unattempted path count
- eligible device count와 masked/stable device identifiers
- failure codes
- queued job ID, queue name, attempts/backoff
- enqueue outcome

raw push token, 전체 전화번호, 불필요한 provider response body는 audit에 저장하지 않는다.

#### C. Confirmation UX

confirmation에는 다음을 먼저 보여준다.

- notification title과 short ID
- recipient와 role
- booking/source context link
- `N failed · N accepted · N eligible for retry`
- 실제 unresolved path 목록
- 이미 성공해서 제외되는 path 수
- required `Retry reason`
- Audit trail

CTA:

- `Retry unresolved paths`
- `Cancel`

`Latest evidence: FCM SENT` 한 줄만으로 partial retry를 설명하지 않는다.

#### D. Action 결과

- `actions.ts`에서 retry와 legacy review에 `adminPost(..., fallback)`을 사용해 실패를 삼키지 않는다.
- 프로젝트의 기존 `adminPostOrThrow` 및 action notice pattern을 재사용한다.
- 성공: `Retry queued`와 가능하면 short job ID를 표시한다.
- 실패를 최소한 `Permission denied`, `State changed`, `No eligible path`, `Queue unavailable`, `Unknown failure`로 구분한다.
- 실패 후에도 원래 filter/page context를 보존한다.
- success/failure notice는 `role=status` 또는 `role=alert`를 올바르게 사용한다.

### 7. P0 — Pagination, 오류, 개인정보

#### A. Pagination canonicalization

- page size 10은 유지한다. selector를 추가하지 않는다.
- `page < 1`은 1로 canonicalize한다.
- list와 summary를 받은 뒤 `total > 0 && requestedPage > totalPages`면 모든 독립 filter를 보존한 last valid URL로 redirect한다.
- clamp된 page 번호만 보여주면서 원래 invalid skip의 빈 rows를 유지하지 않는다.
- URL, selected page, fetched rows, total, `Showing x–y`가 일치해야 한다.
- total 0이면 pagination footer와 `Showing 0 to 0`를 숨긴다.
- 같은 defect가 있는 shared pagination helper를 수정할 경우 먼저 모든 caller를 확인하고 notification/chat archive 양쪽 regression을 피한다.

#### B. 읽기·쓰기 오류 상태

- 기존 list/summary `adminGetResult`와 명시적 read error state는 유지한다.
- list 실패는 empty queue가 아니라 `Notification records unavailable`과 Retry를 표시한다.
- summary 실패 시 안전한 list는 유지하고 count만 unavailable로 표시한다.
- no open issue, no records, no filter match, invalid filter, out-of-range redirect, permission denial을 서로 다른 상태로 표시한다.
- write 실패를 redirect-only 성공처럼 처리하지 않는다.

#### C. 개인정보

- 기본 list의 전화번호는 masked format만 표시한다.
- full phone은 이미 권한이 적용된 Customer/Partner detail 또는 명시적 contact action에서만 확인한다.
- 기존 shared masking helper가 있으면 재사용한다. 없으면 한 곳에 작은 helper와 test만 추가한다.
- raw push token과 full device ID는 HTML, URL, audit copy에 노출하지 않는다.
- action accessible name에는 recipient/title/time context를 포함하되 phone 전체값을 넣지 않는다.

### 8. P1 — 화면 구조와 운영 문구

#### A. 상단 구조

다음 순서로 단순화한다.

1. H1 `Notification Delivery`
2. 설명 `Review unresolved mobile send issues and inspect delivery records.`
3. compact data status: scope, Vietnam time, refreshed time, truthful data-boundary state
4. `Needs action | Delivery records`
5. mode에 필요한 compact filter
6. 결과

현재의 큰 `Notification operation filters` 설명 card, 중복 current/history control, records 아래 반복되는 board를 제거한다.

#### B. Needs action

- 기본 정렬은 oldest unresolved first다.
- 상단 issue selector는 최대 네 개이며 count 단위를 표시한다.
- 기본 결과는 `Open failure groups`다.
- persistent incident가 아니므로 `incident`, `recovered`, `cleanup`, `owner assigned`처럼 보이는 copy를 사용하지 않는다.
- failure group은 latest unresolved paths를 provider + normalized failure code로 group한다. 단순 시간 bucket 때문에 연속 장애가 나뉘지 않게 한다.

Failure group 열:

1. `Cause`
2. `Affected`
3. `First / latest`
4. `Age`
5. `Technical next step`
6. `Open affected records`

표가 1024px에서 맞지 않으면 5열로 합친다. representative user의 전체 전화번호를 group fallback으로 표시하지 않는다.

다른 issue 상태는 notification-level rows로 표시해도 된다. 한 row의 우선순위는 `Issue → Recipient → Notification → Evidence → Next action`이다.

#### C. Delivery records

기본 기간은 명시적인 `Today`를 유지해도 된다. 전체 82,945건을 최초 진입에서 자동 로드하지 않는다.

필수 filter:

- Search: notification ID, booking ID/reference, recipient name 또는 ID
- Recipient role: All / Customer / Partner / Admin
- Channel: All / FCM / In-app
- Send status: All / Accepted / Failed / Skipped / Not attempted
- Date: Today / Previous day / 7 days / 30 days / All
- Sort: Newest / Oldest

다음은 top-level queue로 만들지 않는다.

- Partner alerts
- No-show
- Payout setup
- Mobile push
- In-app route
- Sent
- Skipped

알림 type filter가 실제 운영상 필요하면 기존 type 값에서 searchable select 하나만 만든다. 새 filter framework를 만들지 않는다.

#### D. Compact record layout

desktop 기본 열:

1. `Created`
2. `Recipient`
3. `Notification`
4. `Send status`
5. `Next action`

규칙:

- 기존 `Type`은 Notification cell의 작은 보조 label로 이동한다.
- 기존 `Ops record`는 제거하고 Send status에 통합한다.
- status와 action은 첫 viewport에 보인다.
- `Action`을 가로 scroll 맨 끝에 숨기지 않는다.
- 일반적인 10행 pagination에서 table 내부 `max-height`와 세로 scroll을 제거한다.
- page scroll 하나만 유지한다.
- 1024px 이하에서는 같은 semantic data를 stacked row/card layout으로 전환한다.
- raw enum `ONLINE_AVAILABLE`를 `Online and available` 같은 operator copy로 변환한다.
- 실제 app session 근거가 없으면 `App offline`을 표시하지 않는다.

#### E. 정확한 문구

다음 copy를 기준으로 사용한다.

| 제거/변경 전 | 최종 copy |
|---|---|
| `Customer Notifications` | `Notification Delivery` |
| `Notifications` | `Notification Delivery` |
| `Delivery incidents` | `Open failure groups` |
| `Historical cleanup` | 제거; 필요하면 age filter `24h+` |
| `Needs retry` | `Failed` |
| `Push delivered` | `Accepted by FCM` |
| `Delivery not confirmed` | `No send attempt after 15m` |
| `Push unavailable users` | `No active push route` |
| `Inactive app users` | `App route needs refresh` |
| `No current SLA impact` | 제거 |
| `Test data excluded` | 검증된 경우만; 아니면 `Data boundary unverified` |
| `Provider` user-facing copy | `Partner` |

### 9. 기존 URL과 source 화면 호환

모든 기존 `review` caller를 `rg`로 확인하고 다음처럼 canonicalize한다. query 이름을 꼭 새로 만들 필요는 없지만 화면 결과와 URL 의미는 하나여야 한다.

- `review=failed`와 `review=needs-retry` → canonical `Failed`
- `review=delivery-incidents` → canonical `Open failure groups`
- `review=delivery-incident-history` → `Open failure groups` + `age=over-24h`
- `review=disabled-device`와 `review=no-push-path` → canonical `No active push route`의 정확한 predicate
- `review=delivery-gap`와 오래된 `unattempted` deep link → `No send attempt after 15m` 또는 records의 `Not attempted`; 기존 의미에 맞게 redirect
- `review=stale-device` → `App route needs refresh`
- `review=system-incidents` → `/background-jobs`의 대응 view
- `review=finance-overdue`와 `review=finance-overdue-history` → Bank Reconciliation의 대응 view
- `review=sent`, `skipped`, `fcm`, `in-app-route`, business type filters → Delivery records mode의 canonical filter

redirect 시 독립적으로 의미 있는 date, age, booking, user, sort filter는 보존한다. source 화면과 맞지 않는 notification-only filter는 억지로 전달하지 않는다.

Audit Log, Booking detail, Customer/Partner detail에서 notification record로 돌아오는 링크는 계속 작동해야 한다.

### 10. 접근성·반응형 합격 기준

- 1024×768에서 issue, recipient, status, next action을 가로 scroll 없이 확인할 수 있다.
- 1280×720과 1440×900에서 5개 기본 column과 action이 첫 화면에 보인다.
- 200% zoom에서 page-level horizontal scroll이 생기지 않는다.
- 내부 table vertical scroll이 없다.
- filter와 mode는 visible label과 current state를 가진다.
- action menu accessible name은 notification shortId만이 아니라 recipient + title 또는 created time context를 포함한다.
- color를 제거해도 Failed, Partial, Accepted, Skipped, Not attempted 상태를 텍스트로 구분한다.
- keyboard로 mode → filter → row/action → confirmation → cancel에 이동할 수 있고 focus가 보인다.
- confirmation open/close 후 focus가 합리적인 위치로 복원된다.
- empty/error/status notice는 적절한 live region 또는 alert semantics를 사용한다.

### 11. 구현하지 말 것

- 새 notification incident management 플랫폼
- acknowledge/assign/resolve incident schema
- chart 또는 KPI dashboard 추가
- bulk retry, bulk contact, bulk data cleanup
- page-size selector
- 새 UI/상태관리/filter library
- generic repository/service abstraction
- 이름 기반 fixture 휴리스틱
- raw FCM token 또는 full device ID 노출
- Notification Delivery 안의 Background Job/Finance source queue 복제
- 요청하지 않은 Customer app 또는 Partner app 변경

이미 설치된 dependency와 기존 HANDS component/pattern을 재사용한다. 새 dependency가 꼭 필요하다고 판단하면 추가하지 말고 먼저 근거와 대안을 보고한다.

### 12. 테스트 요구사항

먼저 작은 관련 spec을 실행하고, 통과 후 scope verification으로 넓힌다.

#### Admin Web unit/component tests

최소 regression:

- H1/nav label이 `Notification Delivery`
- primary mode가 두 개뿐임
- system/finance/additional 21 queue가 렌더링되지 않음
- SENT가 `Delivered`로 번역되지 않음
- partial row가 `failed` evidence를 먼저 표시함
- full phone이 목록 markup에 없음
- retry action은 `NOTIFICATIONS_RETRY` 권한 없이는 없음
- retry confirmation에 reason과 unresolved path summary가 있음
- write success/failure/state-change notice
- `page=9999` canonical redirect
- old review deep-link canonicalization
- empty/error states
- compact/stacked markup의 accessible labels

#### API/query tests

최소 regression:

- production predicate의 Prisma/raw SQL parity
- 명시적 fixture marker 제외와 null/missing JSON path 처리
- No active push route가 target role의 enabled device 0 조건을 사용함
- enabled route가 하나라도 있는 delivered notification은 No active route에서 제외됨
- latest per-device failure/recovery disposition
- Failed/Needs retry canonical predicate parity
- no attempt 15분 경계
- stale route와 already-successful notification 제외
- list count/summary count predicate parity
- retry reason validation 12–500자
- retry permission guard
- already delivered/no eligible path 409
- successful device exclusion과 BullMQ dedup 유지
- partial retry audit에 unresolved path snapshot과 job ID 포함
- queue failure 시 false success/audit가 없음
- legacy review 권한 제한

#### Migration/permission tests

- 새 `NOTIFICATIONS_RETRY` enum migration이 신규 migration으로 존재함
- operator category manifest, Web/API access model, permission management 화면이 같은 category를 사용함
- MASTER_ADMIN과 delegated category behavior가 기존 permission convention과 일치함
- `npm.cmd run prisma:migrations:check`

#### 권장 실행 순서

현재 package script와 test runner를 확인한 뒤 Windows 명령을 사용한다. 예:

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- app/notifications/notification-page-model.spec.ts app/notifications/notification-action-confirmation.spec.ts
npm.cmd run test --workspace @massage-vn/api -- src/admin/admin-notification-retry-query.spec.ts src/admin/admin-notification-device-health-query.spec.ts
npm.cmd run notifications:retry-audit-contract
npm.cmd run admin:visible-copy
npm.cmd run security:admin-sensitive
npm.cmd run prisma:migrations:check
npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api
```

현재 변경 파일에 맞춰 focused spec path를 추가하고, repo의 실제 Vitest script와 다른 인자를 임의로 사용하지 않는다.

Prisma schema/migration과 permission/security-sensitive API를 변경하므로 focused tests가 통과한 뒤 가능하면 다음 full local check도 실행한다.

```powershell
npm.cmd run verify:local
```

기존 dirty worktree나 외부 service 부족 때문에 broader check가 실패하면 관련 없는 파일을 수정해 억지로 통과시키지 않는다. 명령, 실패 지점, 이번 변경과의 관련성을 최종 보고한다.

### 13. 실제 브라우저 검증

로그인된 in-app browser가 있으면 그 세션을 사용한다. 새 로그인 정보를 요구하지 않는다. 실제 retry, legacy review, Finance assignment, FCM send는 제출하지 않는다.

다음 상태를 캡처하고 DOM/copy/count를 확인한다.

1. 기본 `/notifications` — Needs action, open failure groups
2. Failed issue
3. No send attempt after 15m
4. No active push route — delivered row가 섞이지 않는지
5. App route needs refresh
6. Delivery records Today
7. Delivery records All + filters
8. partial retry confirmation — 제출하지 않음
9. read-only operator 또는 test로 retry action/endpoint 차단
10. `page=9999` canonicalization
11. list/summary error state — test 또는 safe mock에서만
12. 1024×768
13. 1280×720
14. 1440×900
15. 200% zoom 또는 동등한 responsive accessibility 확인

브라우저 console warning/error도 확인한다. 캡처는 새 폴더에 저장한다.

`C:\dev\massage-on-demand-vn\output\notifications-implementation-2026-08-06\`

기존 감사 캡처와 동일 viewport를 비교해 다음을 확인한다.

- 21개 queue 제거
- test boundary copy가 사실과 일치
- Delivered 오표현 제거
- partial evidence 충돌 제거
- action이 첫 화면에 표시
- nested vertical scroll 제거
- full phone 제거
- page/count/rows 일치

### 14. 완료 정의

다음 조건을 모두 만족해야 완료다.

- `/notifications`가 Notification Delivery 전송 운영으로 역할이 축소됨
- `Needs action | Delivery records`만 top-level mode로 남음
- System/Finance source 업무가 제거 또는 canonical redirect됨
- Failed/Needs retry 중복이 없음
- No active route, no attempt, stale route predicate가 화면 문구와 일치함
- SENT를 Delivered라고 표시하지 않음
- partial row/confirmation이 unresolved path를 먼저 보여줌
- manual retry가 별도 권한, reason, server revalidation, audit를 가짐
- write 실패가 성공처럼 보이지 않음
- fixture 경계 label이 실제 보장 수준과 일치함
- full phone/push token이 목록에 노출되지 않음
- out-of-range page가 실제 valid rows로 canonicalize됨
- 1024·1280·1440·200%에서 핵심 status/action 접근 가능
- focused Admin/API/permission/query tests 통과
- admin/api scope verification 결과가 보고됨
- 실제 브라우저 캡처와 console 확인 완료

### 15. 최종 보고 형식

다음 순서로 간결하지만 빠짐없이 보고한다.

1. 운영 결과 — 무엇이 어떻게 단순하고 안전해졌는지
2. 변경 파일 — Admin Web / API / Prisma migration / tests로 구분
3. 데이터·상태 계약 — 각 Needs action predicate와 SENT 의미
4. 권한·재시도 계약 — 누가, 어떤 조건과 reason으로 retry할 수 있는지
5. 호환성 — old URL과 source 화면 redirect
6. 검증 — 실행한 명령과 pass/fail/skipped
7. 브라우저 검증 — viewport별 결과와 캡처 경로
8. protected area — schema/migration/permission 변경과 integration review 결과
9. 보존한 영역 — templates, push-send, BullMQ dedup, successful-device exclusion 등
10. 남은 위험 — 자동 정리하지 않은 unmarked legacy fixture, 실행하지 않은 실제 FCM send 등

코드를 수정하지 않고 분석만 했거나, 계획만 제시했거나, 실제 브라우저 검증 없이 끝내면 완료가 아니다. 반대로 새 incident 플랫폼, bulk action, chart, generic framework를 추가하는 것도 완료가 아니다. **기존 구조에서 불필요한 기능을 제거하고, predicate·권한·문구·재시도 안전을 한 번에 맞춘 최소 구현**을 완료하라.

---

## 사용 메모

이 문서는 한 번의 구현 작업을 위한 prompt다. 저장소의 영구 규칙은 기존 `AGENTS.md`가 담당한다. 같은 workflow를 여러 프로젝트에서 반복 사용해야 할 때만 별도 Codex skill로 승격한다.
