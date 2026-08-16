# HANDS Admin Push Send 출시 차단 해소 구현 프롬프트

아래 내용을 새 Codex 작업에 그대로 전달한다. 이 문서는 추가 분석이나 개선 아이디어를 요청하는 프롬프트가 아니다. 현재 36/100으로 판정된 `/notifications/push-send`의 발송 안전 계약, queue lifecycle, 권한, 감사 증거, 운영 UI를 실제 코드와 테스트로 수정하고 검증하기 위한 실행 지시서다.

---

## 역할

너는 HANDS의 수동 Push 캠페인 기능을 출시 가능한 수준으로 마무리하는 시니어 풀스택 엔지니어다.

작업 대상:

```text
저장소: C:\dev\massage-on-demand-vn
페이지: http://localhost:3101/notifications/push-send
```

이 기능은 일반 콘텐츠 편집기가 아니다. 한 번의 잘못된 클릭이 여러 고객 또는 파트너에게 외부 push를 보내는 elevated-risk 운영 도구다. 주 사용자는 프로그래머가 아니라 혼자 운영 업무를 처리하는 관리자다.

이번 작업의 최종 결과는 다음 질문에 모두 “예”라고 답할 수 있어야 한다.

1. 운영자가 preview에서 확인한 대상과 실제 queue 대상이 정확히 같은가?
2. 101명 이상일 때 임의의 100명에게 부분 발송되지 않는가?
3. 선택 언어가 실제 role+locale device 조건에 적용되는가?
4. 앱 목적지가 실제 Customer/Partner 앱에서 표시한 화면으로 열리는가?
5. double click, timeout, server action retry에도 campaign이 한 번만 생성되는가?
6. 일부 recipient 또는 provider delivery가 실패해도 campaign 상태와 증거가 모순되지 않는가?
7. 운영자가 사유, 수신자 수, device 시도 수, 정확한 문구와 목적지를 마지막으로 확인하는가?
8. 발송 이후 actual delivered/failed/pending/skipped와 audit를 campaign 단위로 볼 수 있는가?

화면만 다시 꾸미거나 테스트 문자열만 바꾸고 완료 처리하지 마라. P0 서버 계약이 충족되지 않으면 UI가 좋아져도 출시 불가다.

## 최종 목표

현재 흐름:

```text
GET query에 title/body 입력
→ 독립적인 recipient count preview
→ receipt·reason·typed confirmation 없이 Send push
→ 최신 최대 100명 재조회
→ HTTP 요청 안에서 recipient별 notification 생성/queue
→ campaign은 처음부터 SENT
```

목표 흐름:

```text
Draft
→ server-authoritative Preview snapshot
→ actor-bound expiring receipt
→ operator reason + SEND N confirmation
→ atomic idempotent QUEUED transition
→ campaign worker processing
→ delivery aggregate
→ COMPLETED / PARTIAL_FAILED / FAILED
→ campaign-scoped evidence + audit
```

구현 우선순위는 반드시 다음 순서를 따른다.

```text
preview/send 동일성
→ 101명 이상 fail closed
→ role+locale device eligibility
→ destination/mobile contract
→ idempotent queue lifecycle
→ confirmation·permission·audit·privacy
→ 1440+ 운영 UI
→ 통합 검증
```

## 필수 기준 자료

시작 전에 다음 문서를 읽는다.

```text
C:\dev\massage-on-demand-vn\AGENTS.md
C:\dev\massage-on-demand-vn\docs\audits\push-send-final-reaudit-2026-08-12.md
C:\dev\massage-on-demand-vn\docs\audits\push-send-remediation-codex-prompt-2026-08-12.md
C:\dev\massage-on-demand-vn\docs\audits\notifications-final-reaudit-2026-08-12.md
C:\dev\massage-on-demand-vn\docs\audits\notification-templates-final-reaudit-2026-08-12.md
C:\dev\massage-on-demand-vn\docs\audits\performance-cost-risk-register.md
```

화면 증거:

```text
C:\dev\massage-on-demand-vn\docs\audits\push-send-final-reaudit-evidence-2026-08-12
```

재감사 핵심 판정:

```text
현재 점수: 36/100
출시 판정: 차단
외부 push 테스트: 0건
```

이전 구현 프롬프트가 존재하지만 현재 Push Send 코드와 화면에는 핵심 P0가 적용되지 않았다. 문서가 있다는 이유로 구현됐다고 가정하지 말고 현재 코드를 직접 확인한다.

## 저장소·작업 안전 규칙

- `C:\dev\massage-on-demand-vn`에서만 작업한다.
- `C:\dev\massage-vn-workspace`는 사용하지 않는다.
- 단일 에이전트로 끝까지 작업한다. subagent, worker, handoff agent를 사용하지 않는다.
- 계획을 세운 뒤 멈추지 말고 코드 수정, migration 작성, 테스트, 브라우저 검증, 구현 보고서까지 계속한다.
- 시작할 때 `git status --short`를 기록한다.
- 기존 dirty worktree는 사용자 작업이다. 관련 없는 변경을 revert, reset, cleanup, 일괄 format하지 않는다.
- 사용자 요청 없이 commit하지 않는다.
- 실제 고객·파트너에게 push를 발송하지 않는다.
- 실제/shared/production DB에서 preview/send mutation을 실행하지 않는다.
- mock provider, test fixture, 명시적으로 격리된 로컬 DB/queue에서만 lifecycle을 끝까지 검증한다.
- shared/production migration을 임의 적용하지 않는다.
- destructive migration, campaign/notification 삭제, token 일괄 비활성화를 하지 않는다.
- 새 UI framework, state framework, table framework, queue system, campaign SaaS를 추가하지 않는다.
- 기존 Next/NestJS/Prisma/BullMQ/NotificationsService/Admin component/design token을 재사용한다.
- protected area를 변경하면 `AGENTS.md`의 matching scope와 full verification을 따른다.
- 1024px 이하 관리자 화면은 구현·검사·보고서에서 완전히 제외한다.
- Admin 화면은 1440×1000과 1600×1000만 기준으로 한다.
- mobile app은 responsive UI 대상이 아니라 destination routing contract 검증 대상으로만 확인한다.
- 서버를 재시작할 때 전체 `node.exe`를 종료하지 않는다. 해당 포트 PID와 command line을 먼저 확인한다.
- P0 일부만 구현된 상태로 실제 send route를 열어 두지 않는다. 작업이 불완전하면 fail closed 상태로 남긴다.

## 시작 시 반드시 확인할 파일

### Admin Web

```text
apps/admin_web/app/notifications/push-send/page.tsx
apps/admin_web/app/notifications/push-send/actions.ts
apps/admin_web/app/notifications/push-send/push-send-page-model.ts
apps/admin_web/app/notifications/push-send/page.spec.tsx
apps/admin_web/app/notifications/push-send/push-send-page-model.spec.ts
apps/admin_web/lib/admin-api.ts
apps/admin_web/lib/admin-operator-access-model.ts
apps/admin_web/app/globals.css
```

### API·DB·queue

```text
apps/api/prisma/schema.prisma
apps/api/prisma/migrations/**
apps/api/src/admin/admin.dto.ts
apps/api/src/admin/admin-notification.routes.ts
apps/api/src/admin/admin.service.ts
apps/api/src/admin/admin.service.spec.ts
apps/api/src/admin/admin-operator-category.guard.ts
apps/api/src/admin/admin-operator-category.guard.spec.ts
apps/api/src/notifications/notifications.service.ts
apps/api/src/notifications/notifications.processor.ts
apps/api/src/notifications/notification-send.queue.ts
apps/api/src/notifications/notification-push-payload.ts
apps/api/src/notifications/notification-delivery-record.ts
apps/api/src/notifications/notification-template-catalog.ts
```

### Mobile routing

```text
apps/customer_app/lib/src/features/notification/domain/entities/push_notification_open_intent.dart
apps/customer_app/lib/src/customer_shell.dart
apps/provider_app/lib/src/features/notification/domain/entities/push_notification_open_intent.dart
apps/provider_app/lib/src/provider_shell.dart
```

## 현재 확인된 결함을 baseline으로 사용한다

현재 소스가 바뀌었다면 실제 코드를 우선하되, 다음 항목을 하나씩 재확인하고 baseline 표를 구현 보고서에 남긴다.

1. preview와 create가 같은 recipient predicate를 다시 계산할 뿐 snapshot을 공유하지 않는다.
2. preview route는 actor를 받지 않고 receipt, expiry, fingerprint를 반환하지 않는다.
3. create는 `take: 100`, `orderBy: createdAt desc`로 부분 발송한다.
4. locale은 campaign row에 저장되지만 recipient/device filter와 NotificationsService create에 적용되지 않는다.
5. payload에는 destination 문자열만 있고 detail destination required ID가 없다.
6. Partner `chat`은 `chatRoomId`가 없으면 다른 화면으로 fallback한다.
7. campaign status는 string이고 기본값이 `SENT`다.
8. HTTP 요청 안에서 recipient별 notification persist/enqueue를 순차 처리한다.
9. 중간 실패 시 앞선 notification과 campaign/audit가 모순될 수 있다.
10. idempotency key와 preview one-time consume이 없다.
11. reason과 `SEND N` confirmation이 없다.
12. title/body와 targetUserId가 URL/history에 남는다.
13. preview API가 raw user/device ID와 phone을 반환한다.
14. 이름 없는 preview sample이 raw phone을 표시할 수 있다.
15. 성공 title `Push campaign sent`와 detail `queued for delivery`가 모순된다.
16. 모든 오류가 generic `notice=failed`로 합쳐진다.
17. campaign evidence/detail route가 없다.
18. `NOTIFICATIONS_PUSH`가 parent `NOTIFICATIONS` 권한으로 상속될 수 있다.
19. `admin.push.broadcast` template은 catalog에 있지만 manual send는 `resolveTemplate:false`다.
20. 0건 KPI 카드가 composer를 첫 화면 아래로 밀고 있다.

baseline 확인 후 분석만 제출하고 멈추지 않는다. 아래 Phase 0부터 실제 구현한다.

---

# Phase 0 — 불완전한 발송을 먼저 fail closed로 만든다

현재 P0 contract가 없는데 실제 `Send push`가 노출돼 있다. 전체 리팩터링 중에도 unsafe send가 계속 가능하면 안 된다.

다음 중 저장소 관례에 맞는 가장 작은 방식을 선택한다.

- 새 safe confirm endpoint가 완성될 때까지 기존 create endpoint를 server-side 차단한다.
- 또는 기존 endpoint를 즉시 receipt-required로 변경해 receipt 없는 요청을 거부한다.

요구사항:

- UI hide만 하지 말고 API가 fail closed해야 한다.
- 기존 unsafe endpoint를 별도 legacy 경로로 남기지 않는다.
- mock/test fixture 외부에서는 실제 provider call이 일어나지 않게 한다.
- 이 임시 차단을 최종 구현에서 잊지 않도록 regression test를 먼저 추가한다.

완료 증거:

- preview receipt 없는 기존 create 요청이 409/422
- notification/campaign/provider call 0

---

# Phase 1 — 서버 권위 Preview snapshot 계약

## 1.1 Preview data model

현재 `AdminPushCampaign`/`AdminPushCampaignRecipient`를 확장하거나 전용 preview model을 추가한다. 기존 repository pattern과 migration 관례를 확인해 가장 작은 안전한 설계를 선택한다.

preview record는 최소 다음을 보유한다.

```text
id / previewId
createdById
status = PREVIEWED | CONSUMED | EXPIRED
targetRole
targetSegment
targetUserId nullable
locale
destination
safe destination identifiers
title/body 또는 immutable copy snapshot
copyHash
criteriaHash
recipientFingerprint
eligibleUserCount
eligibleDeviceAttemptCount
excludedUserCount
excludedDeviceCount
exclusion breakdown
sendLimit
createdAt
expiresAt
consumedAt nullable
campaignId nullable
```

exact recipient snapshot은 브라우저가 보내는 recipient IDs가 아니라 서버가 관리한다. recipient/device snapshot table, campaign preview recipients, 또는 repository 관례에 맞는 저장 방식 중 하나를 사용한다.

단순 client hash, unsigned JSON, 브라우저가 만든 recipient list만 추가하고 완료하지 않는다.

## 1.2 Preview endpoint

preview는 현재 actor/admin을 받아야 한다.

응답 예시:

```ts
type AdminPushCampaignPreviewReceipt = {
  previewId: string;
  expiresAt: string;
  targetRole: 'CUSTOMER' | 'PROVIDER';
  targetSegment: string;
  targetAccountLabel?: string;
  locale: 'en' | 'vi' | 'ko' | 'ja' | 'zh';
  destination: {
    value: string;
    label: string;
    mode: 'LIST' | 'DETAIL';
    targetSummary: string;
  };
  eligibleUsers: number;
  eligibleDevices: number;
  excludedUsers: number;
  excludedDevices: number;
  exclusions: Array<{ code: string; count: number; label: string }>;
  manualUserLimit: number;
  state: 'READY' | 'ZERO_RECIPIENTS' | 'OVER_LIMIT' | 'INVALID_DESTINATION';
  sampleRecipients: Array<{
    displayLabel: string;
    maskedPhone?: string;
    platform?: string;
    lastActiveAt?: string;
  }>;
};
```

실제 type 이름은 repository conventions에 맞춰도 되지만 의미를 유지한다.

## 1.3 Receipt 불변식

- actor-bound
- expiring
- criteria/copy/locale/destination과 결합
- exact recipient snapshot 또는 deterministic fingerprint와 결합
- client count/IDs를 권위 값으로 신뢰하지 않음
- confirm에서 한 번만 원자적으로 소비
- 다른 payload가 같은 preview를 사용하면 409
- 만료 또는 recipient/device snapshot 변동 시 409와 새 preview 요구
- 같은 preview/idempotency key 재시도는 기존 campaign 반환 또는 명확한 replay 결과

## 1.4 100명 제한

- eligible user 0명: block
- eligible user 1~100명: confirm 가능
- eligible user 101명 이상: **notification 0개, campaign queue 0개**
- 최신 100명 subset을 임의 선택하지 않는다.
- `willSendCount = min(count, 100)` contract를 제거한다.

UI/API 문구:

```text
Audience too large · {eligibleUsers} eligible users
Manual send limit · 100 users
Narrow the audience or choose a specific account. No one has been queued.
```

---

# Phase 2 — Role·locale·destination 실제 전달 계약

## 2.1 User와 device eligibility를 분리한다

하나의 authoritative resolver가 preview와 campaign snapshot 모두에 사용되게 한다.

최소 결과:

```ts
type PushAudienceResolution = {
  eligibleUsers: ResolvedPushUser[];
  eligibleDevices: ResolvedPushDevice[];
  exclusions: PushAudienceExclusionSummary;
};
```

predicate:

- account/role 활성 상태
- target role
- selected segment
- selected account nullable
- enabled push device
- device role
- selected locale
- device cap/recent-device policy

## 2.2 Locale

- manual freeform campaign은 명시 locale을 필수로 한다.
- `Default language`를 제거한다.
- Customer/Partner 모두 locale을 API DTO와 service에서 검증한다.
- Partner가 Vietnamese 고정 정책이면 API에서도 `vi`만 허용하고 UI에 이유를 설명한다.
- selected locale과 다른 device에는 발송하지 않는다.
- 한 user의 다른 locale device를 fanout에서 제외한다.
- preview에 language/device mismatch excluded count를 표시한다.
- locale을 Notification data, campaign metadata, delivery evidence에 추적한다.
- 여러 언어 batch composer나 자동 번역은 이번 범위에서 만들지 않는다.

## 2.3 Device cap

현재 `NOTIFICATION_SEND_PUSH_DEVICE_LIMIT = 10`, 최근 device 우선, permanent failure disable 정책은 유지한다.

다만 다음을 검증한다.

- query가 enabled device 전체에서 먼저 10개를 자른 뒤 role/locale를 client-side filter해 eligible device를 놓치지 않는가?
- role+locale 조건을 DB query에 먼저 적용하는가?
- cap 때문에 제외된 device count가 evidence에 보이는가?
- permanent failure만 disable하고 transient failure는 유지하는가?

## 2.4 Destination capability matrix

Customer/Partner 앱에서 실제 열리는 화면을 기준으로 단일 contract를 정의한다.

예시:

```ts
type ManualPushDestinationDefinition = {
  role: 'CUSTOMER' | 'PROVIDER';
  value: string;
  label: string;
  mode: 'LIST' | 'DETAIL';
  requiredTargetFields: readonly string[];
};
```

원칙:

- ID 없이 안전하게 열리는 LIST destination만 기본 option으로 제공한다.
- DETAIL destination은 entity search/selection, ownership/access validation, required ID가 모두 있을 때만 제공한다.
- Partner `chat`은 `chatRoomId` 선택 UI가 없으면 제거한다.
- Customer `Partners`가 provider detail이 아니라 home tab으로 가면 label을 실제 동작에 맞추거나 제거한다.
- `Bookings`, `Chat`이 목록을 여는 경우 `Bookings list`, `Chat list`로 명확히 표시한다.
- preview에 사람이 읽는 final app target을 표시한다.
- invalid destination이 notification center로 조용히 fallback한 뒤 성공으로 보이면 안 된다.
- API와 두 Flutter parser에 contract test를 추가한다.

권장 기본 LIST matrix는 실제 mobile 코드로 검증 후 확정한다. 추측으로 option을 유지하지 않는다.

---

# Phase 3 — Idempotent campaign queue lifecycle

## 3.1 Campaign 상태

campaign 상태를 validated enum 또는 repository의 강제된 상태 contract로 만든다.

최소 상태:

```text
PREVIEWED
QUEUED
PROCESSING
COMPLETED
PARTIAL_FAILED
FAILED
EXPIRED
```

- `SENT` default를 제거한다.
- queue 전에 `sentAt`을 기록하지 않는다.
- queuedAt, processingAt, completedAt, failedAt을 실제 transition에 맞춰 기록한다.
- status string을 arbitrary value로 확장하지 않는다.

## 3.2 Confirm/queue transaction

confirm input 최소값:

```text
previewId
idempotencyKey
reason
confirmationPhrase
```

server가 다음을 원자적으로 수행한다.

1. actor/permission 확인
2. preview expiry/status/criteria 검증
3. `SEND {eligibleUserCount}` 검증
4. reason 12~500자 검증
5. 1~100 users, devices >0 재확인
6. preview one-time consume
7. campaign/recipient snapshot 생성
8. campaign `QUEUED` 전환
9. campaign job enqueue
10. audit `confirmed/queued`

enqueue 실패 시 일관된 `FAILED`/retryable 상태와 audit를 남긴다. mutation 결과가 불명확할 때 새 campaign을 만들기 전에 idempotency key로 기존 결과를 조회한다.

## 3.3 Worker

- HTTP 요청에서 recipient별 for-loop와 notification queueing을 제거한다.
- 하나의 campaign job이 recipient snapshot을 처리한다.
- recipient 단위 notification creation은 unique key로 idempotent해야 한다.
- worker retry가 같은 campaign+user notification을 두 번 만들지 않는다.
- Notification persist 후 enqueue 실패가 재개 가능해야 한다.
- recipient status와 campaign aggregate를 실제 결과에 맞춰 갱신한다.
- campaign job과 notification job correlation을 추적한다.

## 3.4 Terminal aggregate

최소 evidence count:

```text
eligible users
eligible devices/provider attempts
notifications created
queued
delivered/sent-to-provider
failed
pending
skipped already delivered
excluded by locale/role/device cap
```

Notification row 생성이나 queue 성공을 delivered/completed로 표시하지 않는다.

terminal rule을 명시하고 테스트한다.

- 모든 대상이 성공 terminal → COMPLETED
- 일부 성공 + 일부 실패 terminal → PARTIAL_FAILED
- 성공 0 + 모두 실패 terminal → FAILED
- 아직 처리 중 → PROCESSING/QUEUED

---

# Phase 4 — Confirmation·권한·audit·privacy·오류 복구

## 4.1 Final confirmation

preview 다음에 별도 confirm panel 또는 modal을 제공한다.

표시 항목:

```text
Target role
Audience segment
Specific account 또는 All matched users
Selected language
Eligible users
Eligible devices
Excluded counts와 이유
Manual limit
App destination
Exact title
Exact body
Push visual preview
Preview expiry
Operator reason
```

요구사항:

- reason 12~500자
- typed confirmation `SEND {eligibleUsers}`
- copy/target/locale/destination 변경 시 preview 무효화
- 0, over limit, expired, invalid destination, no devices에서 confirm 불가
- button accessible name에 queue action과 user count 포함
- modal 사용 시 focus trap, Escape, trigger focus return
- loading 중 중복 submit 차단
- 실제 action label은 `Queue push campaign`

## 4.2 Strict permission

- page view, preview, confirm, campaign detail 모두 `NOTIFICATIONS_PUSH` exact permission 또는 Master Admin만 허용한다.
- 일반 `NOTIFICATIONS` parent permission만으로 Push Send에 접근할 수 없게 한다.
- UI hide만 하지 말고 API 403을 검증한다.
- permission denied를 empty campaign이나 source unavailable로 표시하지 않는다.
- preview는 발급 actor만 사용할 수 있다.

## 4.3 Audit lifecycle

최소 audit 의미:

```text
admin_push_campaign.previewed
admin_push_campaign.confirmed
admin_push_campaign.queued
admin_push_campaign.completed
admin_push_campaign.partial_failed
admin_push_campaign.failed
```

event 수를 줄이는 repository 관례가 있으면 lifecycle event 하나로 정리할 수 있지만 다음 증거는 유지한다.

- actor/admin
- reason
- preview/campaign ID
- role/segment/specific target 여부
- locale
- destination + safe identifiers
- exact eligible users/devices
- exclusions
- manual limit
- copy hash와 campaign copy reference
- previewed/confirmed/queued/completed timestamps
- correlation/job IDs
- final counts와 failure classification

audit에 raw phone, raw push token, full device ID, 전체 recipient ID list를 넣지 않는다.

## 4.4 Privacy

- title/body/reason/internal user ID를 URL query에 넣지 않는다.
- browser history, access log, referrer에 message copy가 남지 않게 한다.
- preview API는 UI에 필요한 masked fields만 반환한다.
- raw user ID, device ID, phone, token을 DOM/accessibility tree에 노출하지 않는다.
- 이름 없음 fallback은 server-generated masked label을 쓴다.
- account search selection도 raw ID query string 대신 draft/selection state를 사용한다.

## 4.5 Error contract와 draft 보존

client state + in-place action result로 composer draft를 유지한다.

구분할 오류:

| HTTP/상태 | 운영 문구 의미 |
|---|---|
| 400 | invalid input/copy/target |
| 401 | session expired |
| 403 | Push Send permission denied |
| 404 | selected account/entity missing |
| 409 | preview stale/expired/consumed/payload conflict |
| 422 | over limit/unsupported destination/no eligible device |
| 429 | rate limited |
| 500/503 | DB/queue/source unavailable |
| partial | some work already queued; evidence review required |

문구 예시:

```text
Campaign queued · Delivery has not completed yet.
Audience changed after preview. Review the new count before queueing.
Audience is above the 100-user manual limit. No one has been queued.
Partially queued · Review campaign evidence before retrying.
You do not have Push Send permission.
Queue unavailable · Draft preserved. Retry with the same request key.
```

`No push was sent`는 notification/provider attempt 0을 서버가 증명할 때만 사용한다.

---

# Phase 5 — Campaign evidence와 Notification Delivery 연결

## 5.1 History

기본 filter:

```text
Needs attention
Today
7 days
30 days
All history
```

Needs attention:

```text
FAILED
PARTIAL_FAILED
queue error
delivery delayed
stuck QUEUED/PROCESSING
```

row 우선 정보:

```text
Queued/completed time
Audience + locale
Destination
Title
Eligible users
Device attempts
Delivered / failed / pending / skipped
Actual status
Created by
View evidence
```

- raw `SENT` string을 그대로 표시하지 않는다.
- partial failure에 success tone을 쓰지 않는다.
- title/body는 최대 2줄 clamp하고 전체 copy는 detail에서 본다.
- `All loaded`를 `All history`로 바꾼다.
- Today/Previous day는 ICT/Vietnam date helper를 사용한다.
- summary failure를 현재 page rows 합계로 fallback하지 않는다.

## 5.2 Campaign detail/evidence

campaign detail page, drawer 또는 panel 중 기존 Admin pattern에 맞는 방식을 사용한다.

필수 정보:

- targeting criteria와 preview snapshot
- actual queue/delivery counts
- locale/destination/copy
- reason/actor
- lifecycle timestamps
- failure group summary
- masked sample outcomes
- Technical details 안의 correlation/job IDs
- campaign-scoped Audit log link
- campaign-scoped Notification Delivery link

전체 `/notifications`로만 보내지 않는다. campaignId exact filter 또는 detail aggregate를 구현한다.

---

# Phase 6 — 1440+ 운영 UI 재구성

이 단계는 Phase 1~5의 실제 contract 위에서 구현한다. UI에서 안전해 보이게만 만드는 mock state를 만들지 않는다.

## 6.1 상단 compact risk strip

현재 큰 KPI 3개를 축소한다.

```text
Needs attention
Queued/processing
Failed/partial
Users today
Device attempts today
Last completed
```

- Needs attention이 있으면 첫 번째 actionable danger link로 둔다.
- 0건은 작은 muted value로 표시한다.
- 같은 숫자를 history header/filter에서 반복하지 않는다.
- 1440×1000에서 Step 1, Step 2 핵심 입력과 Preview CTA가 첫 화면에 보여야 한다.

## 6.2 3단계 composer

### Step 1 — Choose audience

- Customers/Partners segmented control 하나
- 중복 `Account role`/`Target role` 제거
- segment
- language
- destination
- optional `Narrow to one account`
- segment의 실제 포함/제외·기간 정의를 한 줄로 설명
- specific account 선택 시 “segment fanout이 아니라 이 계정만 평가”라고 명시

`All Partners in Vietnam`은 현재 predicate가 실제로 Vietnam/approved/active를 검사하지 않으면 label을 사실대로 바꾸거나 predicate를 제품 정책에 맞게 수정한다.

### Step 2 — Write and preview

- title counter `n / 120`
- body counter `n / 500`
- selected language badge
- 실제 OS push card 형태 visual preview
- app target summary
- `Preview audience` CTA
- preview loading/success/0/over limit/error/expired 상태

### Step 3 — Confirm and queue

- server-verified snapshot
- exact users/devices/exclusions/limit
- exact copy와 destination
- reason
- typed `SEND N`
- `Queue push campaign`

## 6.3 Preview 정보 순서

```text
Eligible users
Eligible device attempts
Excluded users
Excluded devices
Exclusion reason breakdown
Manual user limit
Preview expiry
Masked sample recipients
```

`Ready` 조건:

- valid unexpired receipt
- users 1~100
- devices >0
- valid locale/destination
- valid copy

## 6.4 Empty/error/accessibility

구분:

- no campaigns yet
- no history results
- preview source unavailable
- summary unavailable
- permission denied
- preview expired
- audience changed
- over limit
- invalid destination
- queue unavailable
- partial failure

접근성:

- 모든 label 연결
- account search keyboard selection
- selected account를 색상 외 텍스트로 표현
- normal result `role=status`, blocking error `role=alert`
- disabled reason 인접 텍스트
- status를 색상만으로 구분하지 않음
- confirm focus management
- 일반 텍스트 대비 4.5:1 이상
- title/body VI/KO/JA/ZH/emoji 최대 길이 wrapping

## 6.5 화면 범위

검증:

```text
1440×1000 light
1600×1000 light
1440×1000 dark
```

다음은 이번 작업에 포함하지 않는다.

```text
1024px 이하
mobile/tablet Admin responsive
```

---

# Phase 7 — Notification Templates 소유권 정리

`admin.push.broadcast`가 catalog에 있으나 manual send가 `resolveTemplate:false`인 상태를 그대로 두지 않는다.

권장 기본 방향:

- Push Send는 elevated freeform/manual workspace로 유지한다.
- 사용되지 않는 `admin.push.broadcast`를 일반 runtime template 목록에서 제거하거나 “Manual Push Send에서 관리” 안내로 명확히 구분한다.
- 기존 campaign copy/history를 migration으로 변경하지 않는다.

이번 범위에서 reviewed template library, 다국어 batch composer, 자동 번역을 새로 만들지 않는다.

---

# 반드시 수정할 잘못된 기존 테스트

현재 일부 테스트가 unsafe behavior를 정답으로 고정한다. 단순히 새 테스트를 추가하지 말고 기존 expectation도 수정한다.

예:

- capped preview 뒤에도 `Send push`가 렌더링된다는 expectation
- title/body가 campaign history URL에 보존된다는 expectation
- 최신 100명 `take`가 정상이라는 service expectation
- status가 `SENT`라는 expectation
- generic `notice=failed` redirect expectation

새 테스트는 새 safe contract를 검증해야 한다.

## 필수 API·DB·queue 테스트

- preview actor binding
- preview expiry
- preview payload/copy/locale/destination 변경 conflict
- preview 없이 send 차단
- consumed preview replay idempotency
- same key + different payload 409
- double click/server action retry/timeout retry → campaign 1개
- recipient 0 block
- recipient 100 allow
- recipient 101 block + notification 0
- arbitrary latest-100 partial send 제거
- locale별 user/device eligibility
- other-locale device fanout 0
- role mismatch target account block
- inactive/disabled account/device exclusion
- Partner locale server enforcement
- destination required IDs
- invalid destination block
- PREVIEWED→QUEUED→PROCESSING→COMPLETED
- partial delivery → PARTIAL_FAILED
- total delivery failure → FAILED
- worker retry duplicate notification 0
- persist 후 enqueue failure recovery
- campaign/recipient/notification/audit correlation
- permanent token disable, transient token retain
- role+locale recent-device cap
- ICT date range
- raw phone/token/device ID audit 미포함

mock만으로 transaction/idempotency를 완료 처리하지 않는다. 저장소의 실제 PostgreSQL integration test 관례가 있으면 unique constraint와 transaction replay를 통합 테스트한다.

## 필수 Admin Web 테스트

- copy/reason/internal ID가 URL에 없음
- role/segment/account/locale/destination 선택
- raw user ID/phone 미노출
- preview loading/success/0/100/101/error/expired/conflict
- copy 변경 시 receipt 무효화
- user/device/exclusion count
- final exact copy/reason/`SEND N`
- double submit disabled + server idempotency
- 400/401/403/404/409/422/429/500/503 문구
- 실패 후 draft 보존
- queued와 delivered 문구 구분
- history status/counts
- Needs attention
- evidence/detail/scoped links
- summary/list 독립 오류
- exact permission denied/read-only
- pagination/filter context

## 필수 Mobile contract 테스트

- Customer destination matrix
- Partner destination matrix
- LIST destination ID 없이 정상 open
- DETAIL destination required ID
- invalid/incomplete destination 명시적 안전 fallback
- Partner Chat without chatRoomId가 manual option으로 허용되지 않음
- manual payload role/locale/destination parsing

## 브라우저/E2E fixture 상태

실제 외부 provider call 없이 다음을 캡처·검증한다.

1. 기본 Customers composer
2. Partners composer
3. specific account selected
4. recipient 0
5. recipient 1
6. recipient 100 ready
7. recipient 101 blocked
8. language mismatch exclusion
9. invalid destination
10. preview expiry/conflict
11. final typed confirmation
12. queued success
13. processing/completed
14. partial failure history
15. campaign evidence
16. permission denied
17. queue error + draft preservation
18. max-length VI/KO/JA/ZH/emoji
19. 1440 light/dark
20. 1600 light

assertion:

- external provider call 0
- duplicate campaign/notification 0
- horizontal overflow 0
- title/body/reason/internal ID URL 노출 0
- raw phone/token/device ID DOM 노출 0
- focus 정상
- console warning/error 0

---

# 검증 명령

Windows에서는 `npm.cmd`를 사용한다. 실제 package scripts를 먼저 확인하고 focused test부터 실행한다.

최소:

```powershell
npm.cmd run test -w @massage-vn/admin-web -- app/notifications/push-send/page.spec.tsx app/notifications/push-send/push-send-page-model.spec.ts
npm.cmd run test -w @massage-vn/api -- src/admin/admin.service.spec.ts -t "manual push"
npm.cmd run test -w @massage-vn/api -- src/admin/admin-operator-category.guard.spec.ts src/notifications/notification-push-payload.spec.ts src/notifications/notifications.service.spec.ts src/notifications/notifications.processor.spec.ts src/notifications/notification-send.queue.spec.ts
npm.cmd run typecheck -w @massage-vn/admin-web
npm.cmd run typecheck -w @massage-vn/api
```

새 spec 파일을 추가했다면 위 명령에 포함한다.

protected behavior와 mobile routing을 변경하므로:

```powershell
npm.cmd run prisma:migrations:check
npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api
npm.cmd run verify:scope -- -Scope customer
npm.cmd run verify:scope -- -Scope provider
npm.cmd run verify:local
```

가능하고 안전한 격리 환경에서:

```powershell
powershell -ExecutionPolicy Bypass -File .\infra\scripts\verify-local.ps1 -WithServices
```

현재 baseline의 API typecheck에는 referral reward evidence 관련 기존 오류가 있었다. 작업 시작 시 다시 확인한다.

- 기존 오류가 여전히 존재하면 Push Send 변경과의 관련성을 구분한다.
- 새 Push Send 타입 오류를 기존 오류로 숨기지 않는다.
- 전체 release gate가 실패하면 성공으로 보고하지 않는다.

---

# 구현하지 말아야 할 것

- UI만 3단계로 꾸미고 API direct send는 그대로 두지 않는다.
- client button disable만으로 idempotency 완료라고 하지 않는다.
- preview count를 send 때 재계산하면서 같다고 가정하지 않는다.
- 101명 이상에서 최신 100명 subset을 보내지 않는다.
- locale을 campaign metadata에만 기록하지 않는다.
- 다른 locale device에 선택 언어 freeform copy를 보내지 않는다.
- required ID 없는 detail destination을 성공처럼 표시하지 않는다.
- campaign을 queue 전에 `SENT`/completed로 만들지 않는다.
- Notification row 생성 또는 queue success를 delivered로 표시하지 않는다.
- HTTP 요청 안에서 100명을 순차 enqueue하지 않는다.
- retry가 같은 recipient notification을 중복 생성하게 두지 않는다.
- title/body/reason/user ID를 URL query에 넣지 않는다.
- raw phone/token/device ID를 DOM/audit에 넣지 않는다.
- generic error redirect로 draft를 잃지 않는다.
- list/summary API 실패를 0건으로 조용히 표시하지 않는다.
- `NOTIFICATIONS_PUSH`를 일반 `NOTIFICATIONS`의 암묵적 상속으로 두지 않는다.
- Push Send, Templates, Delivery를 거대한 한 페이지로 합치지 않는다.
- 새 workflow engine, state framework, queue framework를 추가하지 않는다.
- 실제 push를 테스트 발송하지 않는다.
- shared/production DB migration을 승인 없이 적용하지 않는다.
- 1024px 이하 작업을 포함하지 않는다.
- 사용자 요청 없이 commit하지 않는다.

---

# 완료 기준

아래가 모두 충족돼야 완료다.

## P0 대상 안전

- [ ] server-issued preview snapshot 없이는 send 불가
- [ ] actor-bound, expiring, one-time receipt
- [ ] preview와 campaign recipient exact match
- [ ] 101명 이상 notification 0
- [ ] client recipient count/IDs 비신뢰
- [ ] double submit campaign 1개

## P0 언어·목적지

- [ ] locale이 실제 role+locale device filter에 적용
- [ ] `Default language` 제거
- [ ] users와 device attempts 분리
- [ ] role별 destination이 mobile 실제 화면과 일치
- [ ] required ID 없는 DETAIL destination 불가
- [ ] invalid destination이 성공으로 fallback하지 않음

## P0 queue·복구

- [ ] HTTP recipient loop 제거
- [ ] PREVIEWED/QUEUED/PROCESSING/COMPLETED/PARTIAL_FAILED/FAILED/EXPIRED 의미 존재
- [ ] queue 전에 SENT/completed 아님
- [ ] worker retry duplicate 0
- [ ] 중간 실패 후 campaign/recipient/notification/audit 일치
- [ ] provider result와 campaign evidence 연결

## P1 운영 통제

- [ ] reason 12~500
- [ ] `SEND N`
- [ ] strict `NOTIFICATIONS_PUSH`
- [ ] queued와 delivered 문구 분리
- [ ] status별 오류와 draft 보존
- [ ] copy/reason/internal ID URL 미노출
- [ ] raw phone/token/device ID UI/audit 미노출
- [ ] campaign-scoped audit/delivery evidence

## P2 1440+ 화면

- [ ] compact risk strip
- [ ] Audience→Message Preview→Confirm 3단계
- [ ] users/devices/exclusions/limit/expiry
- [ ] over-limit blocking
- [ ] actual push visual preview
- [ ] Needs attention history와 View evidence
- [ ] 1440×1000, 1600×1000 overflow 0
- [ ] light/dark, max CJK/VI copy
- [ ] console warning/error 0
- [ ] 1024px 이하 제외

## 검증

- [ ] focused Admin/API/Notification/Queue tests 통과
- [ ] PostgreSQL/queue integration contract 검증
- [ ] migration check 통과
- [ ] admin/api/customer/provider scope 검증
- [ ] 가능한 범위의 verify:local 통과
- [ ] external push 0
- [ ] before/after screenshots와 DOM evidence 저장
- [ ] 미완료/미검증 항목을 성공으로 포장하지 않음

P0 항목 중 하나라도 미완료면 “출시 가능”으로 판정하지 않는다. 필요한 경우 Push Send route/send action을 fail closed 상태로 남기고 blocker를 보고한다.

---

# 산출물

1. Admin Web, API, Prisma migration, queue/processor, 필요 시 mobile routing 코드
2. preview receipt, locale, destination, idempotency, lifecycle, permission, privacy 테스트
3. 1440/1600 before/after evidence
4. 구현 보고서:

```text
docs/audits/push-send-final-remediation-implementation-2026-08-12.md
```

5. 브라우저 증거 폴더:

```text
docs/audits/push-send-final-remediation-evidence-2026-08-12/
```

구현 보고서 필수 내용:

- 요구사항별 완료/부분/미완료
- 변경 파일
- preview→confirm→queue→delivery 상태 흐름
- recipient user/device/locale predicate
- Customer/Partner destination matrix
- 0/100/101명 동작
- idempotency와 중간 실패 복구
- DB model/migration 작성·적용 여부
- permission contract
- audit/evidence contract
- Notification Templates 소유권 결정
- 실행 명령과 pass/fail/skipped
- protected area 변경
- 브라우저 캡처 링크
- 실제 외부 push 0건
- 기존 dirty worktree 보호 사실
- 남은 위험
- 출시 점수와 판정

---

# 최종 응답 형식

최종 응답은 다음 순서로 작성한다.

1. 한 줄 출시 판정과 점수
2. preview/send 동일성과 101명 차단
3. locale/device와 destination/mobile 계약
4. queue lifecycle/idempotency/부분 실패 복구
5. confirmation/permission/audit/privacy/error recovery
6. 1440+ UI와 history/evidence
7. 변경 파일
8. 테스트 명령 pass/fail/skipped
9. protected area와 migration 상태
10. 외부 push 0건 확인
11. 남은 blocker 또는 위험
12. 구현 보고서와 evidence 링크
13. 다음 권장 작업 1개

각 단계에는 `완료 / 부분 / 미완료 / 차단` 상태를 붙인다.

중요:

- 계획만 제출하고 멈추지 않는다.
- 화면 캡처만 만들고 코드 계약을 미완료 상태로 두지 않는다.
- mock unit test만으로 transaction/idempotency 완료라고 하지 않는다.
- provider delivery evidence 없이 campaign completed라고 하지 않는다.
- migration 파일을 작성했지만 shared/production DB에 적용하지 않았으면 “작성 완료, 적용 안 함”이라고 정확히 적는다.
- 실행하지 못한 검증은 `skipped`와 이유를 기록한다.
- 실제 외부 push를 보내지 않았다는 이유로 mock lifecycle E2E를 생략하지 않는다.

---

# 이 프롬프트 사용 방법

새 Codex 작업에서 다음처럼 시작한다.

```text
C:\dev\massage-on-demand-vn\docs\audits\push-send-final-remediation-codex-prompt-2026-08-12.md를 읽고 지시된 작업을 실제 코드와 테스트에 구현해줘. 계획만 제출하지 말고 P0부터 구현·검증·브라우저 증거·구현 보고서까지 끝까지 진행해. 실제 외부 push와 shared/production migration 적용은 하지 마.
```

작업량이 크면 먼저 `/plan`으로 범위를 확인할 수 있지만, plan 승인 뒤에는 같은 작업에서 구현까지 계속한다. 별도 UI polish 작업으로 분리하기 전에 P0 data/queue/destination contract를 먼저 완료한다.
