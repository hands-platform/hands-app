# HANDS Admin Push Send 최종 보완 구현 프롬프트

아래 전체 내용을 새 Codex 작업에 그대로 전달한다. 이 문서는 화면을 다시 분석해 달라는 프롬프트가 아니라, 기존 감사 보고서와 현재 소스에서 확인된 `Push Send`의 안전성·운영성 문제를 실제 코드, DB 계약, queue lifecycle, 테스트, 1440px 이상 관리자 화면까지 수정하기 위한 실행 지시서다.

---

## 1. 역할과 최종 목표

너는 HANDS의 수동 Push 캠페인 기능을 출시 가능한 수준으로 마무리하는 시니어 풀스택 엔지니어다.

대상 화면:

```text
http://localhost:3101/notifications/push-send
```

이 화면은 일반 콘텐츠 편집 화면이 아니다. 한 번의 잘못된 클릭이 여러 실제 고객 또는 파트너에게 외부 알림을 발송할 수 있는 **elevated-risk 운영 도구**다.

주 사용자는 프로그래머가 아니라 **혼자 운영 업무를 처리하는 관리자**다. 운영자는 다음 사실을 확실히 확인한 뒤 발송할 수 있어야 한다.

1. 미리보기에서 확인한 대상과 실제 발송 대상이 동일하다.
2. `Customers`, `Partners`, 선택 segment, 특정 계정, 언어, 앱 목적지가 실제 서버 발송 계약과 일치한다.
3. 100명 제한을 넘었을 때 임의의 100명에게 부분 발송되지 않는다.
4. `Queued`, `Delivering`, `Completed`, `Partial failure`, `Failed`가 실제 상태와 일치한다.
5. 같은 요청을 두 번 클릭하거나 재시도해도 중복 캠페인이 만들어지지 않는다.
6. 발송 중 일부가 실패해도 캠페인·수신자·알림·감사 기록이 모순되지 않는다.
7. 발송 전에 수신자 수, 대상 언어, 앱 목적지, 실제 문구, 변경 사유를 마지막으로 확인한다.
8. 발송 후에는 캠페인의 실제 성공·실패·미시도 결과와 감사 증거로 이동할 수 있다.

UI를 예쁘게 바꾸는 것만으로 완료하지 말라. 이번 작업의 우선순위는 다음과 같다.

```text
미리보기와 발송의 동일성
→ 임의 부분 발송 제거
→ 언어·목적지 실제 계약
→ idempotent queue lifecycle
→ 최종 확인·감사·오류 복구
→ 1440px 운영 화면과 접근성
```

## 2. 작업 위치와 기준 자료

- 저장소: `C:\dev\massage-on-demand-vn`
- 운영 UX 감사: `C:\dev\massage-on-demand-vn\docs\admin-operations-ux-audit.md`
- 정보구조 제안: `C:\dev\massage-on-demand-vn\docs\admin-information-architecture-proposal.md`
- 알림 전달 재감사: `C:\dev\massage-on-demand-vn\docs\audits\notifications-final-reaudit-2026-08-12.md`
- 알림 템플릿 재감사: `C:\dev\massage-on-demand-vn\docs\audits\notification-templates-final-reaudit-2026-08-12.md`
- Push fanout 위험 등록부: `C:\dev\massage-on-demand-vn\docs\audits\performance-cost-risk-register.md`
- 기존 IA 화면 증거:
  - `C:\dev\massage-on-demand-vn\output\admin-navigation-ia-final-reaudit-2026-08-08\05-notifications-push-send.png`
  - `C:\dev\massage-on-demand-vn\output\admin-navigation-ia-post-prompt-fix-2026-08-08\03-push-send-no-duplicate-action.png`
- 저장소 지침: `C:\dev\massage-on-demand-vn\AGENTS.md`

시작 전에 `AGENTS.md`와 위 보고서의 Push Send·Notification Delivery·Notification Templates 관련 부분을 읽는다.

감사 보고서에서 이미 확인된 기본 방향은 다음과 같다.

- Push Send는 Notification Templates 및 Delivery와 목적이 다르므로 독립 페이지로 유지한다.
- 수신자 preview는 좋은 안전장치이므로 유지한다.
- `NOTIFICATIONS_PUSH` 권한과 최종 확인 단계를 유지·강화한다.
- 발송 후 실제 전달 증거와 audit로 이동할 수 있어야 한다.
- Notification Templates의 `admin.push.broadcast`가 실제 수동 발송에서 사용되지 않는 문제와 소유권을 정리해야 한다.
- 외부 push provider fanout, 오래된 device token, 영구 실패 token은 성능·비용·신뢰성 위험이다.

## 3. 작업 방식과 안전 경계

- 단일 에이전트로 끝까지 작업한다. subagent, worker agent, handoff agent를 사용하지 않는다.
- 먼저 실행 계획을 세우되 계획만 제출하고 멈추지 말고 P0부터 실제 구현과 검증까지 계속한다.
- `git status --short`로 시작 상태를 기록한다.
- 기존 dirty worktree는 사용자 작업이다. 관련 없는 변경을 revert, reset, cleanup, 일괄 format하지 않는다.
- 가장 좁은 공통 계약을 수정한다. 페이지와 API 각각에 중복된 임시 분기를 만들지 않는다.
- 새 UI framework, 상태 관리 library, table framework, campaign SaaS를 추가하지 않는다.
- 기존 Admin component, NestJS DTO/guard, Prisma transaction, BullMQ/background-job, NotificationsService, audit helper를 우선 재사용한다.
- 실제 고객·파트너에게 push를 발송하지 않는다.
- 실제 공유·운영 DB에서 preview 또는 send mutation을 실행하지 않는다.
- 자동 테스트 fixture 또는 명시적인 로컬 격리 환경에서만 campaign lifecycle을 검증한다.
- remote/shared database에 migration을 임의 적용하지 않는다.
- destructive migration, 기존 campaign/notification 삭제, token 일괄 비활성화를 하지 않는다.
- Prisma schema/migrations, notification processor, mobile routing, shared contracts는 영향도가 큰 영역이다. 수정 시 `AGENTS.md`의 scope/full 검증을 따른다.
- 서버를 재시작할 때 모든 `node.exe`를 종료하지 않는다. 대상 포트의 PID, command line, working directory를 먼저 확인한다.
- 1024px 이하 모바일·태블릿·반응형 관리자 화면은 이번 작업과 보고서에서 **완전히 제외**한다.
- Admin UI 검증은 `1440×1000`과 `1600×1000`만 수행한다.
- mobile app은 responsive 디자인 대상이 아니라 push destination contract 검증 대상으로만 확인한다.
- 사용자 요청 없이 commit하지 않는다.
- 일부 항목을 완료하지 못하면 성공으로 포장하지 말고 blocker, 증거, 발송 위험을 기록한다.

UI 작업에는 저장소에서 사용 가능한 경우 `impeccable`의 운영형 관리자 화면 원칙을 적용한다. 장식보다 발송 대상 확인, 위험 강조, 실수 방지, 오류 복구, 접근성을 우선한다.

## 4. 이미 잘된 부분과 반드시 보존할 기능

다음은 현재 구현의 장점이다. 이번 변경으로 제거하거나 약화하지 않는다.

- Customers와 Partners를 명확히 구분한다.
- 고객·파트너별 segment allowlist가 있다.
- 특정 계정을 raw ID 입력이 아니라 이름·전화번호 검색으로 찾을 수 있다.
- UI에서 내부 user ID를 기본 노출하지 않는다.
- 전화번호를 마스킹하려는 화면 방향이 있다.
- target role에 맞는 active push device가 있는 사용자만 후보로 찾는다.
- Admin 계정을 manual push 대상으로 허용하지 않는다.
- 역할별 destination allowlist가 있다.
- 제목 120자, 본문 500자 제한을 API DTO에서 검증한다.
- Preview에서 recipient count, will send count, 제한, sample recipients를 보여준다.
- 수신자 0명일 때 send 버튼이 비활성화된다.
- 캠페인을 persistent Notification 경로로 생성해 Notification Delivery와 연결하려는 방향이 있다.
- 별도 `NOTIFICATIONS_PUSH` elevated permission category가 있다.
- 최근 캠페인 기간 필터, 서버 pagination, summary API가 있다.
- 성공·실패 notice와 기본 audit event가 있다.
- Notification Templates와 Push Send의 중복 navigation action이 제거됐다.

기존 테스트가 보호하는 위 기능을 유지하고, 아래 계약을 추가한다.

## 5. 먼저 수행할 진단

코드 수정 전에 다음을 수행하고 구현 보고서에 baseline을 남긴다.

1. 기준 보고서를 읽는다.
2. 현재 `/notifications/push-send`를 1440×1000에서 확인한다.
3. 다음 파일과 관련 spec을 우선 확인한다.

```text
apps/admin_web/app/notifications/push-send/page.tsx
apps/admin_web/app/notifications/push-send/actions.ts
apps/admin_web/app/notifications/push-send/push-send-page-model.ts
apps/admin_web/app/notifications/push-send/page.spec.tsx
apps/admin_web/app/notifications/push-send/push-send-page-model.spec.ts
apps/admin_web/lib/admin-api.ts
apps/admin_web/lib/admin-operator-access-model.ts
apps/admin_web/app/globals.css

apps/api/prisma/schema.prisma
apps/api/prisma/migrations/**
apps/api/src/admin/admin.dto.ts
apps/api/src/admin/admin-notification.routes.ts
apps/api/src/admin/admin.service.ts
apps/api/src/admin/admin.service.spec.ts
apps/api/src/admin/admin-operator-category.guard.ts
apps/api/src/notifications/notifications.service.ts
apps/api/src/notifications/notifications.processor.ts
apps/api/src/notifications/notification-push-payload.ts
apps/api/src/notifications/notification-push-payload.spec.ts
apps/api/src/notifications/notification-template-catalog.ts

apps/customer_app/lib/src/features/notification/domain/entities/push_notification_open_intent.dart
apps/customer_app/lib/src/customer_shell.dart
apps/customer_app/lib/src/features/notification/presentation/customer_notification_screen.dart
apps/provider_app/lib/src/features/notification/domain/entities/push_notification_open_intent.dart
apps/provider_app/lib/src/provider_shell.dart
```

4. 다음 현재 동작을 실제 코드로 표로 정리한다.

```text
preview recipient predicate
send recipient predicate
user count
device attempt count
100명 제한 동작
locale의 실제 사용 위치
destination별 required IDs
campaign status transition
recipient status transition
notification persist/enqueue 순서
중간 실패 시 DB 상태
double-submit/idempotency 상태
audit metadata
history가 보여주는 실제/파생 상태
```

5. Customers/Partners 각 destination이 두 mobile app에서 실제 어느 화면으로 열리는지 확인한다.
6. `chat`, `booking`, `providerProfile`, `earnings`처럼 ID가 필요한 destination과 list-level destination을 구분한다.
7. Notifications processor가 한 사용자당 몇 개 device token에 fanout하는지 확인한다.
8. 영구 실패 token을 비활성화하는 기존 정책과 가장 최근 device 우선 정책을 확인한다.
9. 현재 focused test와 typecheck를 변경 전 실행해 baseline을 기록한다.

진단만 하고 작업을 멈추지 말고 아래 Phase 1부터 구현을 계속한다.

---

## Phase 1 — P0 발송 안전 계약을 바로잡는다

### P0-1. Preview와 Send를 서버가 보증하는 동일 snapshot으로 묶는다

#### 현재 문제

현재 preview와 send는 같은 조건을 다시 계산할 뿐, preview 결과를 서버가 증명하거나 send 요청에 연결하지 않는다.

Preview 이후 다음이 바뀌면 운영자가 본 대상과 실제 발송 대상이 달라질 수 있다.

- active push device
- user role/account 상태
- booking/session 기반 segment 포함 여부
- 검색한 특정 계정의 eligibility
- locale/device 조건
- title/body/destination 입력값

또한 API를 직접 호출하면 preview 없이 send를 요청할 수 있다.

#### 구현 불변식

1. preview는 서버가 발급한 `previewId` 또는 `previewReceipt`를 반환한다.
2. receipt는 최소 다음에 묶여야 한다.
   - preview actor/admin
   - normalized targetRole
   - normalized targetSegment
   - selected targetUserId nullable
   - delivery locale
   - normalized destination + destination identifiers
   - title/body 또는 copy hash
   - exact recipient snapshot 또는 deterministic fingerprint
   - eligible user count
   - eligible device-attempt count
   - createdAt / expiresAt
3. send API는 유효하고 만료되지 않은 receipt 없이는 실패한다.
4. 다른 admin의 receipt를 사용할 수 없다.
5. preview 후 copy, locale, destination, target, segment가 바뀌면 기존 receipt는 무효다.
6. receipt는 send transition에서 원자적으로 한 번만 소비된다.
7. double click, browser retry, network retry가 같은 receipt로 중복 campaign을 만들지 않는다.
8. receipt가 만료되거나 audience가 변경됐으면 HTTP 409 또는 명확한 conflict를 반환하고 새 preview를 요구한다.
9. client가 보낸 recipient count나 recipient IDs를 권위 값으로 신뢰하지 않는다.
10. send는 preview snapshot의 대상에게만 진행한다.

#### 권장 구현 방향

현재 `AdminPushCampaign`과 `AdminPushCampaignRecipient` 모델 및 queue 관례를 확인한 뒤 가장 작은 안전한 방식을 선택한다.

가능한 설계:

- preview 시 `AdminPushCampaign`을 `PREVIEWED` draft로 생성하고 exact recipient snapshot을 recipient rows에 저장한다.
- 또는 전용 short-lived preview record를 사용한다.

어느 방식을 사용하든 다음이 필요하다.

- expiry
- actor binding
- copy/criteria fingerprint
- exact recipient snapshot
- atomic one-time transition
- idempotency
- expired preview cleanup

브라우저가 임의로 만들 수 있는 unsigned hash만 추가하고 완료하지 않는다. 서명 token을 사용한다면 저장소의 기존 signing primitive와 replay 방지 저장소를 사용해야 한다. 단순 HMAC만으로 one-time consumption을 해결했다고 주장하지 않는다.

### P0-2. 100명 초과 시 임의의 최신 100명에게 보내는 동작을 제거한다

#### 현재 문제

Preview는 다음처럼 보여준다.

```text
recipientCount = 전체 대상
willSendCount = min(recipientCount, 100)
capped = recipientCount > 100
```

Send는 `orderBy createdAt desc, take 100`으로 최신 100명만 선택한다. 이 100명은 운영적으로 의미 있는 cohort가 아니며, UI에서 `Capped`를 보여주지만 send 버튼은 활성화된다.

#### 구현 계약

1. 전체 eligible recipient가 100명을 초과하면 send를 차단한다.
2. `willSendCount=100`을 정상 발송 가능한 상태처럼 표시하지 않는다.
3. UI는 다음처럼 명확히 안내한다.

```text
Audience too large · 143 eligible users
Manual send limit · 100 users
Narrow the audience or choose a specific account. No one has been sent yet.
```

4. API send도 동일하게 fail closed한다. UI 우회로 임의 부분 발송할 수 없어야 한다.
5. future batch campaign 기능을 이번 작업에서 임의로 만들지 않는다.
6. 정확한 100명 이하의 preview snapshot만 confirm 단계로 진행한다.
7. `orderBy createdAt desc`는 sample 정렬에는 사용할 수 있지만 발송 subset 결정에 사용하지 않는다.

### P0-3. Language 선택이 실제 recipient device와 copy 계약에 반영되게 한다

#### 현재 문제

- UI는 `Default language`, en, vi, ko, ja, zh를 선택하게 한다.
- Partner는 vi로 고정한다.
- API는 locale을 campaign row에 저장하지만 recipient query와 `NotificationsService.create()`에는 사용하지 않는다.
- 따라서 특정 언어 문구가 다른 언어 사용자를 포함한 segment 전체에 발송될 수 있다.
- 한 사용자가 여러 locale device를 갖고 있으면 같은 문제가 더 커진다.

#### 구현 계약

1. manual freeform campaign은 언어를 명시적으로 요구한다.
2. `Default language`라는 모호한 선택을 제거한다.
3. blank locale이 정말 필요하다면 `Same copy to every matched language`처럼 실제 동작을 정확히 표현하고 별도 elevated confirmation을 요구한다. 가능하면 이번 범위에서는 명시 locale만 허용한다.
4. preview recipient predicate와 device attempt predicate에 locale을 포함한다.
5. send/processor도 해당 role + locale의 active device만 대상으로 한다.
6. user-level eligibility와 device-level attempts를 구분한다.
7. preview에는 최소 다음을 보여준다.
   - eligible users
   - eligible devices / estimated provider attempts
   - selected language
   - excluded because language/device mismatch
8. locale은 campaign metadata와 각 Notification delivery evidence에서 추적 가능해야 한다.
9. 한 사용자에게 다른 locale의 오래된 device가 있어도 선택 언어 문구를 그 device에 보내지 않는다.
10. Partner를 vi로 고정하는 정책이 실제 제품 정책이면 API에서도 강제하고 이유를 UI에 설명한다. 제품 정책이 아니라면 Customers와 같은 명시 선택으로 바꾼다.
11. 언어별 freeform 문구를 자동 번역하지 않는다.
12. 여러 언어에게 보내려면 언어별 별도 preview/confirm campaign을 사용한다. 이번 작업에서 복잡한 다국어 batch composer를 만들지 않는다.

### P0-4. Destination과 mobile deep-link 계약을 일치시킨다

#### 현재 문제

UI는 `Chat`, `Bookings`, `Partners`, `Earnings` 등을 선택할 수 있지만 payload에는 destination 문자열만 있고 `bookingId`, `chatRoomId`, `providerProfileId`, `earningId` 등이 없다.

현재 mobile routing에서는 일부 destination이 ID 없이 generic list로 열리지만, 일부는 notification center로 fallback하거나 기대 화면과 다르게 동작할 수 있다. 특히 Partner의 `chat`은 chatRoomId가 없으면 notification center로 fallback하는 코드가 있다.

#### 구현 계약

1. Customer/Partner별 destination capability matrix를 코드로 정의한다.
2. 각 destination에 다음을 선언한다.

```ts
type ManualPushDestinationDefinition = {
  role: 'CUSTOMER' | 'PROVIDER';
  value: string;
  label: string;
  mode: 'LIST' | 'DETAIL';
  requiredTargetFields: readonly string[];
};
```

실제 구조가 더 단순하면 맞게 축소해도 되지만 의미는 유지한다.

3. ID 없이 안정적으로 열리는 list-level destination만 기본 manual campaign에서 제공한다.
4. detail destination을 유지하려면 admin이 검색·선택한 실제 entity ID를 요구하고 API가 role/ownership/접근 가능성을 검증한다.
5. `chat`처럼 필요한 ID를 선택하는 UI가 없다면 옵션에서 제거한다.
6. label은 실제 열리는 화면과 일치해야 한다.
   - 특정 상세가 아니라 목록이면 `Bookings list`, `Partners list`처럼 표시한다.
7. preview에서 최종 deep-link payload를 사람이 읽는 형태로 보여준다.
8. API allowlist와 두 mobile app parser test가 같은 contract를 사용하거나 서로 검증한다.
9. unsupported role/destination/identifier 조합은 preview 단계에서 차단한다.
10. destination이 무효일 때 조용히 notification center로 fallback해 성공으로 표시하지 않는다.

### P0-5. 동기식 부분 저장을 idempotent campaign queue lifecycle로 바꾼다

#### 현재 문제

현재 create API는 다음 순서로 동작한다.

1. Campaign row를 처음부터 `SENT`, `sentAt=now`로 생성
2. 최대 100명을 for-loop로 순차 처리
3. 각 Notification 생성/queue
4. 각 CampaignRecipient 생성
5. 마지막에 notificationCount 업데이트
6. 마지막에 audit 생성

중간 recipient에서 오류가 나면 앞선 알림은 이미 생성됐지만 campaign은 `SENT`, notificationCount는 0일 수 있고 audit가 없을 수 있다. HTTP 요청이 길어지고 재시도 시 중복 발송 위험도 있다.

#### 구현 계약

1. campaign status를 실제 lifecycle로 만든다.

최소 의미:

```text
PREVIEWED
QUEUED
PROCESSING
COMPLETED
PARTIAL_FAILED
FAILED
EXPIRED
```

기존 프로젝트 enum 관례를 확인해 Prisma enum 또는 validated string을 선택한다. raw arbitrary string을 계속 확장하지 않는다.

2. `SENT`와 `sentAt`을 알림 생성 전에 기록하지 않는다.
3. confirm 요청은 preview snapshot을 원자적으로 `QUEUED`로 전환하고 campaign job 하나를 enqueue한다.
4. HTTP 요청은 100개의 Notification을 순차 생성하지 않는다.
5. worker는 campaign recipient snapshot을 idempotently 처리한다.
6. `(campaignId, userId)` unique를 활용하되 Notification 중복까지 막는 명시적 idempotency contract를 만든다.
7. worker retry가 같은 recipient의 persistent Notification을 두 개 만들지 않는다.
8. Notification persist 성공 후 enqueue 실패, recipient link update 실패 등 각 경계에서 안전하게 재개할 수 있어야 한다.
9. 이미 notificationId가 연결된 recipient는 다시 생성하지 않는다.
10. 상태 전이는 compare-and-set 또는 transaction으로 보호한다.
11. recipient별 최소 상태:

```text
PENDING
NOTIFICATION_CREATED
QUEUED
DELIVERED
FAILED
SKIPPED
```

실제 Notifications Delivery lifecycle에 맞춰 이름을 조정할 수 있지만 `QUEUED`와 provider `DELIVERED`를 혼동하지 않는다.

12. campaign `COMPLETED`는 모든 대상이 terminal 상태이고 성공 기준을 충족할 때만 사용한다.
13. 일부 성공/일부 실패는 `PARTIAL_FAILED`다.
14. 모든 실패는 `FAILED`다.
15. queue 생성 실패, worker failure, audit failure를 각각 추적한다.
16. campaign job과 notification job의 correlation ID를 남긴다.
17. queue retry/backoff는 기존 notification queue 정책을 재사용한다.
18. 실제 FCM success/failure가 늦게 확정되면 campaign status를 worker callback으로 갱신하거나 read-time aggregate로 계산한다. 단순 `Notification row created`를 `Delivered`로 표시하지 않는다.

---

## Phase 2 — 최종 확인, 권한, 감사, 오류 복구를 강화한다

### P1-1. Preview 다음에 명시적인 Confirm 단계를 둔다

현재 preview card의 `Send push` 버튼 하나만으로 외부 영향 작업이 실행된다.

Confirm panel 또는 modal에 다음을 한 화면에서 표시한다.

```text
Target role
Audience segment
Specific account 또는 All matched users
Selected language
Eligible users
Eligible device attempts
Excluded counts와 이유
App destination
Exact title
Exact body
Push visual preview
Preview expiry
Operator reason
```

요구사항:

1. 모든 campaign에 12~500자의 발송 사유를 요구한다.
2. typed confirmation은 `SEND {eligibleUserCount}`처럼 실제 수신자 수를 포함한다.
3. specific single-account send에도 확인은 유지하되 UI는 간결하게 만든다.
4. recipient 0, over limit, expired preview, unsupported destination, language mismatch, stale preview에서는 confirm할 수 없다.
5. confirm 버튼의 accessible name에 대상과 수신자 수를 포함한다.
6. confirm modal은 focus trap, Escape close, close 후 trigger focus 복귀를 지원한다.
7. confirm 화면에서 copy를 수정하면 send하지 않고 preview를 무효화하고 다시 preview하게 한다.

### P1-2. Idempotency와 중복 submit을 서버에서 차단한다

- client button disabled만으로 완료하지 않는다.
- preview receipt 소비와 campaign 생성/queue transition을 하나의 idempotent server transaction으로 만든다.
- 같은 idempotency key/preview를 재요청하면 기존 campaign 결과를 반환한다.
- 다른 payload가 같은 key를 사용하면 409를 반환한다.
- browser double click, Next server action retry, API timeout 후 retry를 테스트한다.
- 빠른 반복 campaign에 대한 기존 rate-limit primitive가 있으면 적용한다.
- 없는 경우 임의의 복잡한 rate-limit subsystem을 만들지 말고, receipt single-use와 idempotency를 우선한다.

### P1-3. `NOTIFICATIONS_PUSH` elevated permission을 양쪽에서 유지한다

1. page view, preview, confirm/send, campaign detail의 권한을 현재 operator access model과 일치시킨다.
2. preview receipt는 발급한 admin에게만 유효하다.
3. read-only 또는 권한 없는 운영자에게 send control을 숨기는 것만으로 끝내지 말고 API도 403을 반환한다.
4. `NOTIFICATIONS_PUSH`를 일반 ADMIN 기본 권한으로 자동 부여하지 않는다.
5. Master Admin과 명시적으로 권한을 받은 operator만 사용한다.
6. permission denial을 empty/failed campaign처럼 표시하지 않는다.

### P1-4. Audit를 발송 전·queue·완료 상태까지 연결한다

최소 audit event:

```text
admin_push_campaign.previewed
admin_push_campaign.confirmed
admin_push_campaign.queued
admin_push_campaign.completed
admin_push_campaign.partial_failed
admin_push_campaign.failed
```

프로젝트 관례상 event 수를 줄여야 하면 하나의 lifecycle audit 구조를 사용해도 되지만 다음 증거는 남아야 한다.

- actor/admin
- reason
- preview/campaign ID
- target role
- target segment
- specific target 여부
- locale
- destination + safe identifiers
- exact eligible user count
- estimated/actual device attempts
- excluded counts
- send limit
- copy hash
- 실제 campaign row의 title/body 참조
- previewedAt / confirmedAt / queuedAt / completedAt
- correlation ID / job ID
- final success/failed/skipped counts
- failure classification summary

raw push token, 전체 전화번호, device ID, 전체 recipient ID 목록을 audit metadata에 넣지 않는다.

### P1-5. 오류 시 draft를 보존하고 원인을 구분한다

현재 `actions.ts`는 모든 오류를 잡아 generic redirect하며 title/body/target draft를 잃는다.

1. composer를 client state + in-place action result 구조로 바꾼다.
2. 검색, preview, confirm 실패 후 다음 값을 유지한다.
   - role
   - segment
   - selected account
   - locale
   - destination
   - title/body
   - reason
3. title/body를 URL query에 넣지 않는다.
4. message copy가 browser history, access log, referrer에 남지 않게 한다.
5. 다음 오류를 구분한다.
   - 400 invalid target/copy
   - 401 session expired
   - 403 permission denied
   - 404 selected entity missing
   - 409 preview stale/audience changed/already consumed
   - 422 over limit/unsupported destination
   - 429 send rate limited
   - 500/503 queue or source unavailable
6. preview API 실패를 `preview=null`로 조용히 숨기지 않는다.
7. mutation 결과가 불명확하면 새 캠페인을 만들기 전에 idempotency key로 기존 결과를 조회한다.
8. 실패 notice에 `No push was sent`라고 표시하려면 서버가 실제로 notification 0건을 보장해야 한다.
9. 일부가 이미 queue된 경우 generic failure가 아니라 `Partially queued — review campaign evidence`로 안내한다.

### P1-6. 개인정보 노출을 최소화한다

현재 preview sample의 display fallback에서 raw phone이 이름처럼 표시될 수 있고 API는 raw id/phone을 반환한다.

1. preview API는 Admin UI에 필요한 최소 필드만 반환한다.
2. 가능하면 서버에서 `displayLabel`, `maskedPhone`, `platform`, `lastActiveAt`처럼 이미 마스킹된 형태를 반환한다.
3. 이름이 없을 때 raw phone을 `<strong>` fallback으로 사용하지 않는다.
4. 내부 user ID, raw push token, 전체 device ID를 DOM, accessible name, audit에 노출하지 않는다.
5. specific account search 결과는 기존 masked phone 방향을 유지한다.
6. sample은 최대 5명으로 bounded한다.

---

## Phase 3 — 실제 전달 증거와 캠페인 이력을 운영 가능하게 만든다

### 3.1 History 상태를 실제 lifecycle로 표시한다

현재 campaign row는 기본 `SENT`를 보여주지만 실제 provider delivery 결과와 연결되지 않는다.

각 행에 다음을 우선 표시한다.

```text
Queued/started/completed time
Audience + language
Destination
Title
Eligible users
Device attempts
Delivered / failed / pending / skipped
Actual campaign status
Created by
```

요구사항:

- `SENT` raw string을 그대로 표시하지 않는다.
- `Queued`와 `Delivered`를 구분한다.
- partial failure를 성공색으로 표시하지 않는다.
- pending이 오래 지속되면 `Delivery delayed` 상태와 다음 행동을 표시한다.
- summary와 list가 같은 date/status contract를 사용한다.
- `Recipients`와 `Notifications`가 무엇을 세는지 구분한다.
- device attempts를 recipient users와 섞어 합산하지 않는다.

### 3.2 Campaign detail 또는 evidence drawer를 제공한다

행에서 다음 상세로 이동할 수 있게 한다.

- normalized targeting 조건
- preview snapshot count
- actual queue/delivery count
- destination
- exact title/body
- reason
- actor
- lifecycle timestamps
- failure group summary
- sample recipient 결과는 masked
- correlation/job IDs는 Technical details 안에 표시
- Audit log link
- Notification Delivery filtered link 또는 campaign-specific evidence

Notification Delivery가 아직 `campaignId` filter를 지원하지 않으면 다음 중 작은 안전한 방식을 선택한다.

1. campaign detail API에서 linked notification/delivery aggregate를 제공한다.
2. `/notifications`에 campaignId exact filter를 추가하고 deep link한다.

필터 없이 전체 Notification Delivery 페이지로 보내고 완료하지 않는다.

### 3.3 날짜 범위와 summary 오류를 정확히 처리한다

- Today/Previous day는 서버 local timezone에 암묵적으로 의존하지 말고 프로젝트의 ICT/Vietnam date window helper를 사용한다.
- `All loaded`는 `All history`처럼 실제 의미로 고친다.
- summary API 실패 시 현재 page rows 합계를 전체 합계처럼 fallback하지 않는다.
- list와 summary의 독립 오류를 구분한다.
- pagination은 date/status filter와 campaign context를 유지한다.
- 기본 history는 최근 action이 필요한 queued/failed/delayed 캠페인을 먼저 찾을 수 있어야 한다.

### 3.4 Push device fanout 비용과 상태를 정리한다

`performance-cost-risk-register.md`의 PCR-009를 반영한다.

1. preview에서 user count와 실제 role+locale device attempt count를 구분한다.
2. Notifications processor가 한 사용자에게 모든 과거 enabled device를 무제한 시도하지 않게 한다.
3. 프로젝트 정책에 맞춰 최근 role+locale device를 우선한다.
4. 한 사용자당 device cap을 상수와 테스트로 관리한다.
5. permanent provider failure token은 기존 정책에 따라 비활성화한다.
6. transient failure는 함부로 token을 비활성화하지 않는다.
7. cap 때문에 제외된 device count를 관찰 가능하게 한다.
8. 이 변경이 일반 notification delivery에도 영향을 주면 관련 regression test를 추가한다.

---

## Phase 4 — 1440px 이상 운영 화면을 재구성한다

### 4.1 큰 KPI 카드를 compact risk strip으로 바꾼다

현재 Campaigns, Last send, Recipients 세 카드가 composer를 아래로 밀고, 0건일 때도 큰 공간을 사용한다.

다음 정보를 compact strip으로 우선 표시한다.

```text
Queued / delivering
Failed / partial failed
Recipients today
Device attempts today
Last completed send
```

요구사항:

- 같은 수치를 history title/filter에서 반복하지 않는다.
- 1440×1000에서 composer 핵심 입력과 Preview CTA가 가능한 첫 화면에 보이게 한다.
- 실패/지연 캠페인이 있으면 단순 통계보다 먼저 표시한다.
- 0건 지표를 세 개의 큰 카드로 만들지 않는다.

### 4.2 Composer를 명확한 3단계로 구성한다

```text
1. Choose audience
2. Write and preview message
3. Confirm and queue
```

#### Step 1 — Choose audience

- Customers / Partners segmented control
- specific account search는 선택 사항
- audience segment
- language
- destination
- 각 segment의 실제 운영 정의를 짧게 설명
- 특정 계정 선택 시 segment 전체가 아니라 해당 계정 한 명만 대상이라는 것을 강조

#### Step 2 — Write and preview

- title `n / 120`
- body `n / 500`
- 실제 push card 형태 미리보기
- language badge
- destination preview
- preview recipient 실행
- preview 실패/over limit/0 recipient 상태

#### Step 3 — Confirm and queue

- server-verified snapshot 요약
- exact counts
- exclusion reason
- reason
- typed confirmation
- `Queue push campaign` 버튼

`Send push`라는 즉시 완료형 문구보다 실제 동작에 맞는 `Queue push campaign`을 사용한다.

### 4.3 수신자 미리보기를 운영 판단 중심으로 바꾼다

미리보기 상단에 다음 순서로 표시한다.

1. `Eligible users`
2. `Eligible devices`
3. `Excluded users/devices`
4. exclusion reason breakdown
5. `Manual limit`
6. exact sample recipients

`Ready` badge는 다음 조건을 모두 만족할 때만 표시한다.

- receipt 발급 성공
- recipient 1~100
- destination valid
- locale valid
- device attempts 1 이상
- preview not expired
- copy valid

100명 초과를 `Capped`라는 경고 하나로 표시하고 send 가능하게 두지 않는다.

### 4.4 캠페인 History를 action-oriented하게 만든다

- 기본 탭: Needs attention / Today / 7 days / 30 days / All history
- Needs attention: failed, partial failed, delayed, queue error
- 행 primary action: `View evidence`
- Audit log와 Notification Delivery는 detail 안에서 제공
- raw ID는 short ID로 표시하고 전체 ID는 Technical details/copy action에 둔다.
- title/body는 최대 2줄 clamp, 전체 문구는 detail에서 확인한다.
- 1440px에서 핵심 열과 View evidence가 한 화면에 보이게 한다.
- table 내부 horizontal scroll이 생기지 않도록 실제 content container 폭을 기준으로 조정한다.

### 4.5 오류·빈 상태·접근성

다음을 구분한다.

- 아직 캠페인이 없음
- filter 결과 없음
- preview source unavailable
- history list unavailable
- summary unavailable
- permission denied
- preview expired
- recipient changed
- over limit
- queue unavailable
- partial queue/delivery failure

접근성 요구:

- audience role, segment, language, destination의 label 연결
- account search result keyboard selection
- selected account 상태를 색상 외 텍스트로 표현
- preview result `role=status`, blocking error `role=alert`를 중복 announcement 없이 사용
- confirm dialog focus trap/return focus
- disabled button에 이유가 인접 텍스트로 보임
- 상태색만으로 queued/failed/completed를 구분하지 않음
- 모든 일반 텍스트 대비 4.5:1 이상
- loading 중 중복 submit 방지

### 4.6 1440+ hardening 상태

다음을 캡처·검증한다.

- Customers / segment send composer
- Partners / segment send composer
- specific account selected
- recipient 0
- recipient 1
- recipient 100
- recipient 101 이상 blocked
- language mismatch exclusion
- invalid destination
- preview expired/conflict
- final confirmation
- queued success
- partial failed history
- campaign evidence detail
- permission denied/read-only
- API/queue failure with draft preserved
- 120자 title
- 500자 body
- Vietnamese/Korean/Japanese/Chinese copy
- 라이트 1440×1000
- 다크 1440×1000
- 라이트 1600×1000
- console warning/error 0건
- page/table horizontal overflow 없음

1024px 이하 관리자 화면은 구현·캡처·완료 조건에 넣지 않는다.

---

## Phase 5 — Notification Templates와 역할을 정리한다

현재 `admin.push.broadcast` template은 카탈로그에 있지만 manual push는 `resolveTemplate:false`로 freeform title/body를 보낸다.

이번 작업에서 소유권을 명확히 한다.

권장 기본 방향:

- Push Send는 elevated freeform/manual campaign workspace로 유지한다.
- `admin.push.broadcast`는 Notification Templates의 일반 runtime template처럼 표시하지 않는다.
- 해당 catalog entry가 실제 사용되지 않는다면 제거하고 Push Send로 안내한다.
- 카탈로그 migration은 기존 campaign title/body를 변경하지 않는다.

대안으로 reviewed manual templates를 지원하려면 실제 READY template 선택과 exact copy snapshot을 Push Send preview에 연결해야 한다. 단순히 `resolveTemplate:true`로 바꾸고 사용자 입력과 섞지 않는다.

이번 범위에서는 template library를 새로 만들지 않는다. freeform과 managed template 중 하나의 실제 계약을 명확히 선택하고 dead template을 남기지 않는 것이 목표다.

## 6. 구현하지 말아야 할 것

- UI preview만 유지하고 API direct send는 preview 없이 허용하지 않는다.
- preview count와 send count를 따로 재계산하면서 같다고 가정하지 않는다.
- 101명 이상에서 최신 100명만 임의 선택하지 않는다.
- `Capped` warning만 추가하고 send 버튼을 활성화하지 않는다.
- locale을 campaign row에만 저장하고 recipient/device filter에서는 무시하지 않는다.
- 다른 locale device에 선택 언어 문구를 보내지 않는다.
- 필요한 ID가 없는 destination을 동작하는 것처럼 표시하지 않는다.
- Partner chat이 notification center로 fallback하는데 `Chat` 성공으로 표시하지 않는다.
- campaign을 queue 전에 `SENT`로 기록하지 않는다.
- Notification 생성 성공을 provider delivery 성공으로 표시하지 않는다.
- HTTP 요청에서 100개의 notification을 순차 생성하지 않는다.
- client button disable만으로 double submit을 막았다고 주장하지 않는다.
- retry 시 같은 campaign recipient의 Notification을 중복 생성하지 않는다.
- generic redirect로 draft를 잃지 않는다.
- title/body를 URL query에 넣지 않는다.
- summary API 실패 시 현재 20개 page row를 전체 합계처럼 표시하지 않는다.
- 이름이 없을 때 raw phone을 화면 fallback으로 표시하지 않는다.
- raw push token, full phone, device ID, recipient ID list를 DOM/audit에 노출하지 않는다.
- `NOTIFICATIONS_PUSH`를 일반 ADMIN 기본 권한으로 자동 부여하지 않는다.
- Push Send와 Notification Templates/Delivery를 한 거대한 페이지로 합치지 않는다.
- 새로운 UI framework, queue system, workflow engine을 추가하지 않는다.
- 실제 사용자에게 테스트 push를 발송하지 않는다.
- shared/production DB에 migration이나 cleanup을 승인 없이 적용하지 않는다.
- 1024px 이하 responsive 작업을 포함하지 않는다.
- 사용자 요청 없이 commit하지 않는다.

## 7. 필수 테스트

### API·DB·Queue

- preview recipient predicate와 snapshot recipient가 일치
- preview actor binding
- expired preview 차단
- changed target/locale/destination/copy가 기존 preview를 무효화
- preview 없이 send 차단
- consumed preview 재사용 시 기존 campaign 반환 또는 409, 중복 생성 0
- double submit → campaign 1개, recipient notification 각 1개
- recipient 0 차단
- recipient 100 허용
- recipient 101 차단, notification 0개
- 임의 `take 100` 부분 발송 없음
- locale별 user/device eligibility
- 다른 locale device로 fanout하지 않음
- role mismatch targetUserId 차단
- disabled device 제외
- unsupported destination 차단
- detail destination required IDs 누락 차단
- mobile destination contract test
- PREVIEWED→QUEUED→PROCESSING→COMPLETED 전이
- 일부 recipient failure → PARTIAL_FAILED
- 전체 failure → FAILED
- worker retry에서 persistent Notification 중복 없음
- Notification persist 후 enqueue failure 재개 가능
- campaign/recipient/notification/audit correlation 유지
- audit reason/counts/locale/destination/lifecycle 포함
- raw token/full phone/recipient list audit 미포함
- recent role+locale device cap
- permanent token failure 비활성화, transient failure 유지
- ICT date range contract

mock test만으로 transaction/idempotency/unique constraint를 완료하지 않는다. 실제 PostgreSQL 및 queue test 관례가 있으면 통합 테스트를 추가한다.

### Admin Web

- title/body가 query string에 포함되지 않음
- role/segment/account/locale/destination 선택
- account search raw user ID 미노출
- raw phone fallback 없음
- preview loading/success/0/over-limit/error
- preview receipt 만료
- copy 수정 시 preview 무효화
- final confirmation의 exact count/reason/typed phrase
- double submit button 상태
- 400/401/403/404/409/422/429/500/503 문구
- 실패 후 draft 유지
- queued notice가 `sent/delivered`라고 거짓 표현하지 않음
- history status와 counts
- Needs attention filter
- evidence detail과 scoped audit/delivery link
- summary/list 독립 오류
- permission denied/read-only
- pagination/filter context 유지

### Mobile

- Customer destination matrix
- Partner destination matrix
- list-level destination ID 없이 정상 open
- detail destination required ID 검증
- invalid/incomplete destination의 명시적 안전 fallback
- manual push payload의 role/locale/destination routing

### 브라우저/E2E

실제 외부 push 없이 fixture/mock queue에서 다음을 검증한다.

1. 기본 composer
2. specific account 선택
3. 0 recipient
4. 100 recipient ready
5. 101 recipient blocked
6. locale exclusion
7. invalid destination
8. actual push preview
9. final typed confirmation
10. queued result
11. partial failure history
12. evidence detail
13. permission denied
14. queue error + draft preservation
15. dark theme
16. 1600px layout

필수 assertion:

- 외부 provider call 0회
- duplicate campaign/notification 0개
- 1440px horizontal overflow 없음
- title/body URL 노출 없음
- raw phone/token/device ID DOM 노출 없음
- confirm focus 정상
- console warning/error 0건

## 8. 실행할 검증 명령

Windows에서는 `npm.cmd`를 사용한다. 실제 변경 파일에 맞춰 focused test를 먼저 실행하고 범위를 확장한다.

최소 예시:

```powershell
npm.cmd run test -w @massage-vn/admin-web -- app/notifications/push-send/page.spec.tsx app/notifications/push-send/push-send-page-model.spec.ts app/notifications/push-send/actions.spec.ts lib/admin-operator-access-model.spec.ts
npm.cmd run test -w @massage-vn/api -- src/admin/admin.service.spec.ts -t "manual push|push campaign"
npm.cmd run test -w @massage-vn/api -- src/notifications/notification-push-payload.spec.ts src/notifications/notifications.service.spec.ts src/notifications/notifications.processor.spec.ts
npm.cmd run typecheck -w @massage-vn/admin-web
npm.cmd run typecheck -w @massage-vn/api
```

Mobile routing을 변경했으면 해당 package의 test/analyze를 실행한다. 저장소에 정의된 정확한 명령을 먼저 확인한다.

Prisma/queue/notifications/mobile protected behavior를 변경하므로 다음도 수행한다.

```powershell
npm.cmd run prisma:migrations:check
npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api
npm.cmd run verify:scope -- -Scope customer
npm.cmd run verify:scope -- -Scope provider
npm.cmd run verify:local
```

외부 서비스, queue, mobile SDK 또는 기존 사용자 변경 때문에 전체 검증을 실행할 수 없다면 성공으로 기록하지 않는다. 실패한 정확한 명령, 원인, 이번 변경과의 관련성, 미검증 위험을 구현 보고서에 남긴다.

## 9. 완료 기준

다음 항목이 모두 충족되어야 완료다.

### 발송 대상 안전

- 서버 발급 preview snapshot 없이는 send 불가
- preview와 send의 target/copy/locale/destination이 동일
- preview receipt actor-bound, expiring, one-time, idempotent
- recipient 101 이상은 부분 발송 없이 차단
- client가 보낸 count/recipient list를 신뢰하지 않음
- double submit에서 campaign 1개

### 언어·목적지

- locale이 recipient와 실제 device delivery filter에 반영됨
- `Default language` 모호성이 제거됨
- user count와 device attempts가 분리됨
- role별 destination이 mobile 실제 동작과 일치
- required ID 없는 detail destination은 선택 불가
- invalid destination이 성공으로 표시되지 않음

### Queue·상태·복구

- web request에서 recipient별 동기 for-loop 제거
- PREVIEWED/QUEUED/PROCESSING/COMPLETED/PARTIAL_FAILED/FAILED 의미 존재
- campaign이 queue 전에 SENT가 되지 않음
- worker retry가 Notification 중복을 만들지 않음
- 중간 실패 후 campaign/recipient/notification/audit가 일치
- 실제 provider 결과와 campaign evidence가 연결됨

### 운영 통제

- reason 12~500자
- `SEND {count}` typed confirmation
- `NOTIFICATIONS_PUSH` elevated permission 양쪽 강제
- queued와 delivered 문구 구분
- 오류별 draft 보존
- copy가 URL/history/referrer에 노출되지 않음
- raw phone/token/device ID가 UI/audit에 노출되지 않음
- audit와 exact delivery evidence link 제공

### 1440+ 화면

- compact risk strip
- Audience → Message Preview → Confirm 3단계
- recipient/device/exclusion/limit 표시
- over-limit blocking state
- actual push visual preview
- action-oriented history와 evidence detail
- 1440×1000, 1600×1000에서 horizontal overflow 없음
- 라이트·다크 테마, 최대 길이, CJK/베트남어, 오류 상태 검증
- console warning/error 0건
- 1024px 이하 검사는 제외

### 검증

- focused Admin/API/Notification/Queue tests 통과
- migration check 통과
- admin/api/customer/provider scope 검증 실행
- 가능한 범위에서 verify:local 실행
- 실제 외부 push 발송 0건
- before/after 브라우저 증거 저장
- 미완료·미검증 위험을 구현 보고서에 기록

## 10. 산출물

다음을 남긴다.

1. API, Admin Web, queue/processor, 필요 시 mobile routing 및 Prisma migration 코드
2. preview receipt/idempotency/lifecycle/destination/locale 테스트
3. 1440px·1600px before/after 화면 증거 폴더
4. 다음 구현 보고서

```text
docs/audits/push-send-remediation-implementation-2026-08-12.md
```

구현 보고서에는 다음을 포함한다.

- 요구사항별 `완료 / 부분 완료 / 미완료`
- 변경 파일
- preview→confirm→queue→delivery 최종 상태 흐름
- recipient user/device/locale predicate
- Customer/Partner destination matrix
- 100명 제한 동작
- idempotency와 중간 실패 복구 전략
- migration 작성·적용 여부
- audit contract
- 실행 명령과 pass/fail/skipped
- protected area 변경
- 브라우저 캡처 링크
- 실제 외부 push 미발송 사실
- 남은 위험
- 출시 가능 여부와 점수

## 11. 최종 응답 형식

최종 응답은 다음 순서로 작성한다.

1. 한 줄 판정
2. preview/send 동일성 및 100명 제한 수정
3. 언어·destination 계약 수정
4. queue lifecycle·idempotency 수정
5. confirmation·permission·audit 수정
6. 1440+ UI와 history/evidence 수정
7. 테스트·검증 결과
8. protected area 변경
9. 남은 위험
10. 구현 보고서 링크
11. 다음 권장 작업 1개

중요:

- 화면이 좋아져도 preview receipt, 101명 차단, locale device filter, queue idempotency가 해결되지 않았으면 출시 가능으로 판정하지 않는다.
- Notification row 생성만 확인하고 delivery 완료라고 판정하지 않는다.
- integration test가 없는 idempotency/transaction 동작은 검증 완료로 표시하지 않는다.
- 실제 push를 보내지 않았다는 이유로 E2E 전체를 생략하지 말고 mock provider/fixture queue에서 끝까지 검증한다.
- migration을 작성했지만 shared/production DB에 적용하지 않았다면 적용 완료라고 주장하지 않는다.

---

## 이 프롬프트의 사용 메모

- 이 작업은 단순 Admin UI 수정이 아니라 Prisma, queue, NotificationsService, device routing, 필요 시 mobile destination contract를 포함하는 큰 작업이다.
- 새 Codex 작업에서 이 MD 파일을 직접 지정해 실행하는 것이 좋다.
- Plan 모드로 시작할 수 있지만 계획 이후 실제 구현과 검증까지 진행하도록 이미 지시돼 있다.
- 실제 사용자 push 발송이나 shared/production migration 적용은 이 프롬프트가 승인한 범위가 아니다.
- 구현 후에는 `/notifications/push-send`를 같은 1440px 이상 기준으로 별도 재감사해야 한다.
