# Push Send final remediation implementation

구현일: 2026-08-13  
저장소: `C:\dev\massage-on-demand-vn`  
화면: `/notifications/push-send`

## 1. 출시 판정

**코드 기준 출시 후보 승인, 92/100.** P0 서버 계약은 완료됐다. 실제 배포는 이번 작업 지시대로 수행하지 않았으며, staging에서 migration 적용 후 mock provider campaign worker acceptance를 한 번 통과시키는 것을 배포 게이트로 남긴다.

외부 push는 0건이다. 실제/shared/production DB의 preview/send mutation과 migration 적용도 0건이다.

## 2. 구현 전 baseline 20개 처리 결과

| # | baseline | 결과 | 구현 |
| --- | --- | --- | --- |
| 1 | preview/create snapshot 불일치 | 완료 | 한 authoritative resolver와 actor-bound receipt snapshot 사용 |
| 2 | actor/expiry/fingerprint 없는 preview | 완료 | actor, 15분 expiry, copy/criteria hash, recipient fingerprint 저장 |
| 3 | `take: 100` 부분 발송 | 완료 | 전체 eligible count를 먼저 확인하고 101명부터 notification/queue 0 |
| 4 | locale 미적용 | 완료 | role+locale를 device DB predicate에 cap보다 먼저 적용 |
| 5 | destination required ID 부재 | 완료 | ID-less LIST destination allowlist만 제공 |
| 6 | Partner chat fallback | 완료 | manual option에서 chat/detail destination 제거 |
| 7 | string status와 `SENT` default | 완료 | Prisma enum과 QUEUED/PROCESSING/terminal timestamps 적용 |
| 8 | HTTP recipient loop | 완료 | campaign 단위 BullMQ job으로 이동 |
| 9 | 중간 실패 상태 모순 | 완료 | recipient idempotency와 terminal aggregate 적용 |
| 10 | idempotency/one-time consume 없음 | 완료 | unique idempotency key와 atomic receipt consume 적용 |
| 11 | reason/`SEND N` 없음 | 완료 | 12~500자 reason과 exact phrase를 API/UI 양쪽에서 검증 |
| 12 | copy와 ID가 URL에 노출 | 완료 | POST server action + client state, URL은 fixture/history filter만 허용 |
| 13 | raw user/device/phone preview | 완료 | masked operator projection만 응답 |
| 14 | phone fallback 노출 | 완료 | server-generated masked display label 사용 |
| 15 | sent/queued 문구 모순 | 완료 | `Campaign queued · Delivery has not completed yet.` 사용 |
| 16 | generic 오류 | 완료 | permission/limit/stale/expired/consumed/queue failure를 분리 |
| 17 | campaign evidence 없음 | 완료 | campaign-scoped summary/evidence endpoint와 history details 제공 |
| 18 | parent permission 상속 | 완료 | `NOTIFICATIONS_PUSH` exact permission 또는 Master Admin만 허용 |
| 19 | 쓰지 않는 broadcast template | 완료 | editable default catalog에서 제거하고 legacy row 필터링 |
| 20 | 0 KPI가 composer를 밀어냄 | 완료 | compact risk strip과 3-step desktop composer 적용 |

## 3. Preview와 confirm 동일성

### authoritative resolver

Preview와 confirm은 동일한 server resolver를 사용한다. resolver는 account state, role, segment, optional account selection, enabled device, device role, selected locale, recent-device cap을 한 번에 평가한다.

Preview는 브라우저가 보낸 count나 recipient ID를 신뢰하지 않는다. 서버가 exact recipient/device snapshot과 다음 값을 보관한다.

- actor ID 및 receipt status
- target role, segment, locale, destination
- immutable title/body snapshot과 copy hash
- criteria hash와 recipient fingerprint
- eligible/excluded user/device count와 exclusion breakdown
- expiresAt, consumedAt, campaignId

Confirm은 receipt actor, expiry, READY state, copy/criteria hash, fingerprint, current re-resolution을 검증한다. payload나 audience가 바뀌면 409로 새 preview를 요구한다.

### 0 / 100 / 101 경계

- 0명: `ZERO_RECIPIENTS`, confirm 불가.
- 1~100명: exact snapshot에 대해서만 confirm 가능.
- 101명 이상: `OVER_LIMIT`, recipient snapshot/notification/campaign queue 0.
- `min(count, 100)` 또는 최신 100명 subset 계약은 제거했다.

## 4. Locale, device, destination, mobile 계약

- Customer locale: `en`, `vi`, `ko`, `ja`, `zh`를 명시 선택한다.
- Partner locale: 제품 정책에 따라 `vi`만 API/UI에서 허용한다.
- device query는 role+locale+enabled 조건을 DB에 먼저 적용한 다음 최신 device 10개 cap을 적용한다.
- locale mismatch, no enabled device, cap exclusion은 preview/evidence count에 남는다.
- Customer LIST destination: Notification center, Bookings list.
- Partner LIST destination: Notification center, Bookings/Requests, Jobs, Earnings, Profile.
- entity ID가 필요한 chat/provider detail은 이번 manual composer에서 제거했다.
- API destination matrix와 Customer/Partner Flutter open-intent test가 같은 allowlist를 검증한다.

## 5. Queue lifecycle, idempotency, 부분 실패 복구

Lifecycle:

```text
PREVIEWED -> QUEUED -> PROCESSING -> COMPLETED | PARTIAL_FAILED | FAILED
          -> EXPIRED
```

- confirm 입력은 `previewId`, `idempotencyKey`, `reason`, `confirmationPhrase`다.
- `SEND {eligibleUserCount}`와 12~500자 reason을 서버가 재검증한다.
- receipt 소비는 `updateMany` 조건부 write로 원자화했다.
- 동일 actor+idempotency key 재시도는 새 campaign을 만들지 않고 기존 결과를 반환한다.
- campaign 하나당 queue job 하나이며 job ID도 campaign ID로 dedupe한다.
- recipient notification persistence는 campaign+user 단위 unique/idempotent write다.
- provider/recipient 일부 실패는 delivered/failed/pending/skipped aggregate로 `PARTIAL_FAILED`가 된다.
- queue add가 실패하면 campaign은 FAILED로 남는다.
- queue add 성공 후 queueJobId/audit persistence가 실패하면 QUEUED campaign을 보존하고 같은 key retry를 요구한다. 새 campaign은 만들지 않는다.

격리 PostgreSQL integration에서 동시 receipt consume 1회와 unique 제약을 검증했다. 테스트 DB는 종료 후 삭제했다.

## 6. Confirmation, permission, audit, privacy, error recovery

- Step 1 Audience, Step 2 Write and preview, Step 3 Confirm and queue로 구성했다.
- final panel은 role, segment/account, language, eligible users/devices, excluded breakdown, manual limit, destination, exact title/body, expiry를 다시 표시한다.
- reason과 exact phrase가 유효할 때만 queue CTA가 활성화된다.
- loading 중 submit을 막고 receipt가 stale/expired/consumed이면 draft를 보존한 채 새 preview를 요구한다.
- page, preview, confirm, evidence 모두 exact `NOTIFICATIONS_PUSH` 또는 Master Admin만 접근한다.
- audit에는 actor, reason, safe campaign ID, counts, timestamps를 남기고 title/body, phone, token, raw recipient/device ID는 넣지 않는다.
- campaign list/evidence 응답은 explicit operator projection을 사용해 `createdById`, targetUserId, idempotency key, hashes, metadata를 제외한다.
- UI는 actor raw ID 대신 `Actor recorded in campaign audit`를 표시한다.
- generic failure redirect를 제거하고 403/409/422/queue unavailable 복구 문구를 분리했다.

## 7. Desktop UI와 history/evidence

관리자 UI 범위는 지시대로 1440x1000, 1600x1000만 검증했다. 1024 이하 responsive 구현/검사는 하지 않았다.

- compact risk strip: Needs attention, queued/processing, users, device attempts, delivered, last completed.
- first viewport에 audience와 copy composer가 들어온다.
- title/body counter는 120/500 경계를 표시한다.
- receipt 결과는 eligible users/devices와 exclusion을 먼저 보여준다.
- 101명에서는 명시적으로 아무도 queue되지 않았음을 표시한다.
- campaign history는 queued/processing/completed/partial/failed 상태, delivery aggregate, reason, timestamps, exclusion, audit/delivery 링크를 제공한다.
- history scroll region은 고유 accessible label과 keyboard focus를 가진다.
- light 1440/1600과 dark 1440에서 horizontal overflow가 없었다.

## 8. 변경 파일과 역할

### Admin Web

- `apps/admin_web/app/notifications/push-send/page.tsx`: permission gate, summary/history/evidence composition.
- `apps/admin_web/app/notifications/push-send/push-campaign-composer.tsx`: 3-step client composer와 receipt invalidation/confirmation.
- `apps/admin_web/app/notifications/push-send/actions.ts`: safe POST preview/confirm action과 오류 분류.
- `apps/admin_web/app/notifications/push-send/push-send-page-model.ts`: audience/destination/history presentation model.
- `apps/admin_web/app/notifications/push-send/push-send-browser-fixtures.ts`: non-production explicit browser scenarios.
- 인접 specs: page/model/confirmation/fixture 회귀.
- `apps/admin_web/lib/admin-api.ts`: receipt/campaign/evidence API contracts.
- `apps/admin_web/lib/admin-operator-permissions.ts`: exact Push permission.
- `apps/admin_web/app/globals.css`: Push composer/history desktop layout와 상태 tokens.

### API, queue, DB

- `apps/api/prisma/schema.prisma`: campaign/recipient enum, receipt, idempotency, aggregate/timestamps.
- `apps/api/prisma/migrations/20260813113000_harden_admin_push_campaign_lifecycle/migration.sql`: lifecycle schema migration.
- `apps/api/src/admin/admin.dto.ts`: preview/confirm/list DTO validation.
- `apps/api/src/admin/admin-notification.routes.ts`: actor-bound preview/confirm/evidence routes.
- `apps/api/src/admin/admin.service.ts`: resolver, receipt, atomic confirm, safe projections.
- `apps/api/src/admin/admin-operator-category.guard.ts`: Push exact permission.
- `apps/api/src/notifications/admin-push-destination.ts`: role destination matrix.
- `apps/api/src/notifications/admin-push-campaign.queue.ts`: one campaign job and retry/backoff.
- `apps/api/src/notifications/admin-push-campaign.processor.ts`: idempotent fanout.
- `apps/api/src/notifications/notifications.service.ts`: recipient notification idempotent persist.
- `apps/api/src/notifications/notifications.processor.ts`: role/locale delivery, terminal aggregate.
- `apps/api/src/notifications/notification-template-catalog.ts`: unused broadcast template 제거.
- 인접 unit/integration specs: receipt race, queue retry, worker aggregate, safe projection.

### Mobile contract tests

- `apps/customer_app/test/push_notification_open_intent_test.dart`
- `apps/provider_app/test/push_notification_open_intent_test.dart`

## 9. 테스트와 검증 결과

| 명령/범위 | 결과 |
| --- | --- |
| Admin Push focused specs | PASS, 2 files / 9 tests |
| API Push focused spec | PASS, 6 tests, unrelated cases skipped by `-t` |
| API notification processor/service/worker specs | PASS, 39 tests |
| Isolated PostgreSQL campaign integration | PASS, 2 tests; isolated DB removed |
| Prisma format/generate/validate/migration check | PASS; migration은 shared/prod 미적용 |
| Admin typecheck/lint/build | PASS |
| API scope | PASS; 174 files passed, 3 skipped / 2374 tests passed, 8 skipped; typecheck/lint/build PASS |
| Customer scope | PASS; analyze + 139 tests |
| Partner scope | PASS; analyze + 181 tests |
| Push data/retry audit/FCM/policy/query/visible-copy guards | PASS |
| Admin scope | PARTIAL; Push focused/typecheck/lint/build PASS, 기존 무관한 3 specs 실패 |
| `verify:local` | PARTIAL; build/typecheck/mobile/public PASS, 기존 setup/authority/Vietnam/domain/Supabase/Admin failures 존재 |

Admin 전체 테스트의 Push와 무관한 기존 실패:

1. `components/admin-surface-css.spec.tsx`: shared notice CSS 중복 block 기대 불일치.
2. `lib/admin-navigation.spec.ts`: Company Bank Accounts visibility 기대와 현재 dirty navigation 불일치.
3. `app/finance-closeout/page.spec.tsx`: fixture 시간 기준 `Oldest: 70d` 기대, 실제 `73d`.

`verify:local`의 추가 기존/환경 실패:

- `setup:doctor`: 실제 외부 console credential이 아직 채워지지 않은 preflight.
- `authority:check`: Operations Policy dirty 변경의 marker 기대 불일치.
- `scope:vietnam`: 기존 prompt 문서 내 비-Vietnam 예시 탐지.
- `api:domain-smoke`: 기존 domain smoke assertion 불일치.
- Supabase schema: 기존 `FINANCE_EVIDENCE` enum alignment 누락.
- Docker/API live smoke: services를 시작하지 않아 SKIP.

이번 Push 변경의 focused tests, typecheck, lint, build, API scope, 두 mobile scope에는 실패가 없다. 전체 로그는 evidence 폴더에 보존했다.

## 10. Protected area와 migration 상태

- Protected area 수정: Prisma schema/migration, Admin permission guard, notification queue/processor, mobile routing contract tests.
- matching/payment/settlement mutation은 수정하지 않았다.
- migration 파일은 작성하고 isolated DB에서만 검증했다.
- shared/staging/production DB에는 migration을 적용하지 않았다.
- 기존 대형 dirty worktree와 관련 없는 수정/untracked 파일은 보존했다.
- commit/push/deploy는 수행하지 않았다.

## 11. 외부 push 0건 확인

- 실제 FCM/provider endpoint를 호출하지 않았다.
- 브라우저에서는 fixture 결과만 렌더링했고 실제 queue submit을 누르지 않았다.
- worker 검증은 mock provider/queue와 isolated DB에서 수행했다.
- 실제 고객/Partner token을 조회하거나 비활성화하지 않았다.

## 12. 남은 위험과 배포 체크

1. staging DB에 migration을 적용한 뒤 migration status와 rollback/read compatibility를 확인해야 한다.
2. staging의 mock provider로 1명 campaign을 실행해 QUEUED -> PROCESSING -> terminal evidence를 확인해야 한다.
3. 실제 Firebase credential/provider delivery 검증은 외부 연동 단계이므로 이번 0-send 범위에서 의도적으로 제외했다.
4. 전체 `verify:local`의 기존 전역 실패는 Push release diff와 분리해 별도 정리해야 한다.

## 13. 증거

- 화면/로그 인덱스: `docs/audits/push-send-final-remediation-evidence-2026-08-12/README.md`
- 핵심 1명 confirmation: `05-one-recipient-ready-1440-light.png`
- 101명 fail closed: `07-101-blocked-1440-light.png`
- 부분 실패 이력: `14-partial-history-1600-light.png`
- 열린 campaign evidence: `15-campaign-evidence-expanded-1600.png`
- dark theme: `19-ready-1440-dark.png`
- 전체 로컬 로그: `verify-local.log`

최종 권장 작업은 **staging에서 migration을 적용하고 mock provider 1명 campaign lifecycle acceptance를 실행하는 것** 하나다.
