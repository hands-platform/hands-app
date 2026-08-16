# HANDS Admin Notification Templates 최종 보완 구현 프롬프트

아래 전체 내용을 새 Codex 작업에 그대로 전달한다. 이 문서는 재분석만 요청하는 프롬프트가 아니라, 2026-08-12 최종 재감사에서 확인된 문제를 실제 코드·DB 계약·테스트·운영 화면까지 수정하고 검증하기 위한 실행 지시서다.

---

## 1. 역할과 최종 목표

너는 HANDS의 알림 발송 계약과 관리자 운영 도구를 출시 가능한 상태로 마무리하는 시니어 풀스택 엔지니어다.

대상은 HANDS 관리자 웹의 다음 화면이다.

```text
http://localhost:3101/notifications/templates
```

이 화면의 사용자는 프로그래머가 아니라 **혼자 운영 업무를 처리하는 관리자**다. 운영자는 화면에서 다음 사실을 믿을 수 있어야 한다.

1. `Ready`라고 표시된 문구는 해당 언어로 실제 검수된 문구다.
2. Customer/Partner 대상 표시는 실제 수신 대상과 일치한다.
3. 편집한 템플릿은 어떤 실제 발송 이벤트에 연결되는지 확인할 수 있다.
4. 필수 변수가 빠진 문구는 저장뿐 아니라 실제 발송 단계에서도 차단된다.
5. `Use managed copy`와 실제 알림 발송 중지는 서로 다른 개념으로 표시된다.
6. 저장 실패나 동시 수정 충돌이 발생해도 입력한 문구를 잃지 않는다.
7. 페이지를 조회하는 것만으로 DB 수정 시각이나 감사 증거가 변하지 않는다.

감사 당시 점수는 **48/100, 출시 차단**이었다. 점수를 겉으로 높이는 것이 목표가 아니다. 아래의 P0 발송 계약과 수용 기준이 실제 코드와 테스트에서 충족되어야만 완료다.

레이아웃 polish만 하고 완료하지 말라. 이번 작업의 핵심은 다음 순서다.

```text
발송 타입·대상·템플릿 계약
→ placeholder payload 계약
→ 번역 준비 상태와 runtime fallback
→ GET 무쓰기·동시 수정·오류 복구
→ 운영자 중심 UI·접근성·실제 미리보기
```

## 2. 작업 위치와 기준 자료

- 저장소: `C:\dev\massage-on-demand-vn`
- 기준 감사 보고서: `C:\dev\massage-on-demand-vn\docs\audits\notification-templates-final-reaudit-2026-08-12.md`
- 화면·DOM·DB 증거: `C:\dev\massage-on-demand-vn\docs\audits\notification-templates-final-reaudit-evidence-2026-08-12\`
- 저장소 지침: `C:\dev\massage-on-demand-vn\AGENTS.md`

시작 전에 `AGENTS.md`와 기준 감사 보고서를 끝까지 읽고 따른다. 보고서 결론만 읽지 말고 화면별 증거, 코드 근거, 금지 사항, 수용 기준을 모두 확인한다.

특히 다음 증거를 확인한다.

```text
01-default-top-1440x1000.png
02-editor-fields-1440x1000.png
03-technical-details-1440x1000.png
04-vietnamese-tab-1440x1000.png
05-keyboard-tab-state.json
06-placeholder-validation-1440x1000.png
07-change-summary-invalid-1440x1000.png
08-pause-change-summary-1440x1000.png
09-route-reload-timings.json
10-default-dark-1440x1000.png
11-default-light-1600x1000.png
11-layout-1600x1000.json
13-console-warnings-errors.json
14-database-translation-integrity.json
15-database-template-routing-evidence.json
16-database-updated-at-after-read.json
```

## 3. 작업 방식과 안전 경계

- 단일 에이전트로 끝까지 작업한다. subagent, worker, handoff agent를 사용하지 않는다.
- 복잡한 작업이므로 먼저 실행 계획을 세우되, 계획만 제출하고 멈추지 말고 P0부터 구현까지 계속 진행한다.
- `git status --short`로 시작 상태를 기록한다.
- 기존 dirty worktree는 사용자 작업이다. 관련 없는 파일을 revert, reset, cleanup, 일괄 reformat하지 않는다.
- 관련된 가장 좁은 공통 계약을 수정한다. caller마다 임시 조건문을 복제하지 않는다.
- 새 UI 프레임워크, 상태 관리 라이브러리, 번역 관리 SaaS, workflow engine을 추가하지 않는다.
- 기존 Prisma/NestJS/Next.js 컴포넌트, DTO, audit helper, form/button/status 컴포넌트를 우선 재사용한다.
- 실제 사용자에게 push/in-app 알림을 발송하지 않는다.
- 브라우저 검증 중 실제 공유·운영 DB의 템플릿 문구를 저장하지 않는다. mutation은 자동 테스트 fixture 또는 명시적 로컬 격리 데이터로 검증한다.
- destructive migration, 기존 번역 행 삭제, 운영 데이터 일괄 변경을 하지 않는다.
- migration을 작성하되 remote/shared database에 임의 적용하지 않는다. 저장소 관례에 따라 로컬 또는 테스트 DB에서만 검증한다.
- protected area인 Prisma schema/migrations, bookings, shared contract 등을 변경하면 `AGENTS.md`의 강화 검증을 수행한다.
- 서버를 재시작해야 하면 해당 포트의 PID와 command line을 먼저 확인한다. 모든 `node.exe`를 일괄 종료하지 않는다.
- 1024px 이하 모바일·태블릿·반응형 UI는 이번 작업 및 결과 보고서에서 **완전히 제외**한다.
- 화면 검증은 `1440×1000`과 `1600×1000`에서 수행한다.
- 사용자 요청 없이 commit하지 않는다.
- 완료하지 못한 항목은 성공으로 포장하지 말고 blocker, 코드 근거, 출시 영향을 남긴다.

UI 작업에는 저장소에서 사용 가능한 경우 `impeccable`의 운영형 관리자 화면 원칙을 적용한다. 장식보다 정보 신뢰성, 행동 우선순위, 키보드 접근성, 오류 복구를 우선한다.

## 4. 이미 잘된 부분과 반드시 보존할 기능

다음은 이전 개선으로 좋아진 부분이다. 제거하거나 약화하지 않는다.

- 한 템플릿을 선택하고 5개 언어를 탭으로 편집하는 구조
- 변경된 여러 언어를 한 번에 원자적으로 저장하는 흐름
- 기술 정보가 기본적으로 접혀 있는 구조
- 지원하지 않는 placeholder와 필수 placeholder 누락의 저장 전 검증
- 웹 검증과 API 재검증
- 변경 언어 요약과 저장 버튼 상태
- 저장하지 않은 변경이 있을 때 이탈 경고
- API template key allowlist
- 언어 allowlist와 제목 120자·본문 500자 제한
- 하나의 transaction에서 template/translation/audit를 처리하려는 방향
- audit metadata의 before/after와 changed locale
- `NOTIFICATIONS_TEMPLATES` 권한 분리
- 1440px·1600px에서 페이지 수준 가로 넘침이 없는 현재 레이아웃
- 라이트·다크 테마의 공통 정보 구조

이번 수정으로 위 기능이 회귀하지 않도록 기존 테스트를 유지하고 필요한 테스트를 확장한다.

## 5. 먼저 수행할 진단

코드 수정 전에 다음을 수행하고 구현 보고서에 짧은 baseline을 남긴다.

1. 보고서와 증거를 읽는다.
2. 현재 `/notifications/templates`를 1440×1000에서 확인한다.
3. 다음 파일과 관련 spec을 우선 확인한다.

```text
apps/admin_web/app/notifications/templates/page.tsx
apps/admin_web/app/notifications/templates/notification-template-editor.tsx
apps/admin_web/app/notifications/templates/actions.ts
apps/admin_web/app/notifications/templates/page.spec.tsx
apps/admin_web/app/notifications/templates/actions.spec.ts
apps/admin_web/lib/admin-api.ts
apps/admin_web/app/globals.css

apps/api/prisma/schema.prisma
apps/api/prisma/migrations/**
apps/api/src/admin/admin.dto.ts
apps/api/src/admin/admin.controller.ts
apps/api/src/admin/admin.service.ts
apps/api/src/notifications/notification-template-catalog.ts
apps/api/src/notifications/notification-template-catalog.spec.ts
apps/api/src/notifications/notifications.service.ts
apps/api/src/notifications/notifications.service.spec.ts
apps/api/src/bookings/bookings.notifications.ts
apps/api/src/bookings/bookings.notifications.spec.ts
apps/api/src/chat/chat.service.ts
```

4. `NotificationsService.create()`와 notification을 직접 생성하는 모든 caller를 찾는다.
5. 모든 실제 `(notification type, targetRole)` 조합을 표로 만든다.
6. 각 조합에 현재 선택되는 template key, 기대 template key, 필수 variables, caller payload를 기록한다.
7. `booking.cancelled`, `booking.no_show`, chat, payment, payout, admin push처럼 고객·파트너 또는 수동 발송에서 의미가 겹치는 타입도 빠짐없이 확인한다.
8. `ensureDefaultNotificationTemplates()`의 모든 caller와 DB write 횟수를 확인한다.
9. 현재 관련 focused test, typecheck를 변경 전 실행해 baseline을 기록한다.

진단만 하고 멈추지 말고 아래 Phase 1부터 실제 구현을 계속한다.

---

## Phase 1 — P0 발송 계약을 먼저 바로잡는다

### P0-1. `notification.type`, `targetRole`, `templateKey`를 명시적인 계약으로 분리한다

#### 현재 문제

현재 template resolver는 다음과 같이 `input.type`만 사용한다.

```ts
where: { key: input.type }
```

그래서 같은 type을 고객과 파트너가 함께 사용할 때 역할별 템플릿을 선택할 수 없다.

확인된 예:

- 고객과 파트너 모두 `booking.matched`를 발행하지만 파트너용 카탈로그 키는 `booking.matched.partner`다.
- 고객과 파트너 모두 `service.started`를 발행하지만 파트너용 카탈로그 키는 `service.started.partner`다.
- 카탈로그는 `chat.message`지만 실제 발행 타입은 `chat.message.created`다.
- `admin.push.broadcast`는 카탈로그에 있지만 수동 푸시는 `resolveTemplate: false`다.
- 일부 cancellation/no-show 타입은 실제로 여러 역할에서 사용될 가능성이 있으므로 전체 caller 확인이 필요하다.

#### 구현 계약

1. 사용자 앱·읽음 상태·라우팅·analytics가 의존할 수 있는 기존 `notification.type`을 무분별하게 rename하지 않는다.
2. 알림 이벤트 타입과 문구 템플릿 키를 분리한다.
3. 가장 작은 안전한 설계는 `CreateNotificationInput`에 내부용 `templateKey`를 선택적으로 추가하고, ambiguous caller가 명시적으로 template key를 전달하도록 하는 것이다.
4. 기존 caller 호환이 필요하면 중앙 pure function으로 `(type, targetRole) -> templateKey` fallback을 제공한다.
5. explicit `templateKey`와 fallback mapping이 충돌하거나 대상 역할이 맞지 않으면 조용히 진행하지 말고 개발·테스트 환경에서 명확히 실패하게 한다.
6. runtime resolver는 최종 template key로 카탈로그를 조회한다.
7. resolved template key를 PII 없는 metadata 또는 구조화 로그에 남겨 실제 발송 문구를 추적할 수 있게 한다. 기존 data contract를 깨지 않는 가장 작은 위치를 사용한다.
8. 모든 실제 `(type, targetRole)` 조합이 정확히 한 template key로 연결되어야 한다.
9. 모든 카탈로그 템플릿은 최소 한 개 실제 caller 또는 명확한 수동 발송 경로에서 도달 가능해야 한다.
10. 같은 문구가 정말 역할 공통이라면 audience 모델을 억지로 속이지 말고, 역할별 키를 만들거나 기존 스키마에 맞는 명시적 공용 계약을 설계한다.
11. `admin.push.broadcast`는 다음 중 실제 동작과 맞는 한 가지로 정리한다.
    - 수동 푸시가 관리 문구를 실제 사용하게 연결한다.
    - 수동 입력 전용이라면 Template catalog에서 제거하고 `Push Send` 화면으로 안내한다.
12. 사용되지 않는 템플릿을 UI에서만 숨기지 않는다. 코드·카탈로그 계약에서 dead entry를 제거해야 한다.

#### 필수 테스트

- 모든 실제 `(type, targetRole)` 조합의 expected template key matrix test
- 고객 `booking.matched` → 고객용 문구
- 파트너 `booking.matched` → 파트너용 문구
- 고객/파트너 `service.started`의 역할별 문구
- `chat.message.created`의 실제 수신 역할별 문구
- 카탈로그의 모든 키가 최소 하나의 runtime route에서 도달 가능함
- 모든 runtime route가 카탈로그 또는 명시적 no-template policy 중 하나를 가짐
- 잘못된 explicit templateKey/audience 조합의 안전한 실패

### P0-2. placeholder 정의와 caller payload를 하나의 계약으로 만든다

#### 현재 문제

다음 템플릿은 `{partnerName}`을 필수로 요구한다.

```text
provider.joined
provider.accepted
provider.rejected
```

그러나 booking notification helper의 data에는 `providerProfileId`만 있고 `partnerName`이 없다. 현재 렌더러는 값이 없으면 `{partnerName}` literal을 그대로 둔다.

#### 구현 계약

1. 위 caller payload에 실제 표시 이름을 `partnerName`으로 제공한다.
2. 전체 카탈로그의 `requiredVariables`와 모든 실제 caller data key를 자동 비교한다.
3. 카탈로그에서 변수 목록만 선언하고 본문에서 사용하지 않는 변수와, 본문에서 사용하지만 목록에 없는 변수도 검사한다.
4. 템플릿 렌더 후 `{...}` placeholder가 남으면 해당 렌더 결과를 저장·전송하지 않는다.
5. 미치환 placeholder가 있으면 caller가 제공한 안전한 기본 title/body로 fallback한다.
6. fallback 문구에도 미치환 placeholder가 있다면 발송을 차단하고 구조화된 오류를 남긴다.
7. 로그에는 template key, type, targetRole, missing variable name까지만 기록하고 사용자 이름이나 본문 전체를 기록하지 않는다.
8. 정상 문구에서 중괄호를 문자로 쓸 필요가 있다면 명시적 escape 계약을 정의한다. 필요하지 않다면 YAGNI 원칙으로 추가하지 않는다.

#### 필수 테스트

- `provider.joined/accepted/rejected` payload에 `partnerName` 존재
- 모든 route의 required variables가 caller payload에 존재
- 렌더 후 미치환 placeholder 0개
- 누락 시 caller copy fallback
- fallback에도 unresolved token이 있으면 enqueue/persist 차단
- PII가 오류 로그에 포함되지 않음

### P0-3. 번역 상태와 runtime 언어 선택을 데이터로 관리한다

#### 현재 문제

현재 DB의 vi/ko/ja/zh 88개 행은 영어 원문과 동일하지만 UI는 title/body가 비어 있지 않다는 이유만으로 `Complete`로 표시한다.

#### 데이터 모델 계약

현재 Prisma 모델과 프로젝트 enum 관례를 조사한 뒤, 다음 의미를 보존하는 최소 모델을 구현한다.

```ts
type NotificationTranslationStatus =
  | 'SOURCE_COPIED'
  | 'NEEDS_TRANSLATION'
  | 'NEEDS_REVIEW'
  | 'READY';
```

번역 행에는 최소 다음 운영 증거가 필요하다.

```text
status
reviewedAt nullable
reviewedByAdminId nullable
updatedAt
```

필요하면 relation 대신 reviewer ID scalar를 사용해 migration 범위를 줄일 수 있지만 기존 감사·actor 관례를 먼저 확인한다.

#### migration/backfill 계약

1. 영어 source locale은 기존 카탈로그와 일치하는 경우 `READY`로 초기화한다.
2. 비영어 행이 영어 source와 동일하면 migration 시점에만 `SOURCE_COPIED`로 분류한다.
3. 영어와 다른 기존 비영어 문구도 자동 `READY`로 만들지 말고 `NEEDS_REVIEW`로 둔다.
4. 비어 있는 행은 `NEEDS_TRANSLATION`로 둔다.
5. 문자열 동일성은 초기 migration 분류에만 사용한다. 이후 runtime readiness의 유일한 기준으로 사용하지 않는다.
6. 기존 행을 삭제하거나 덮어쓰지 않는다.
7. 기계 번역 또는 Codex가 만든 번역을 자동 `READY`로 만들지 않는다.

#### runtime 언어 선택 계약

1. 요청 locale의 번역이 `READY`일 때만 해당 언어 문구를 사용한다.
2. 요청 locale이 준비되지 않았다면 `READY` 영어 source로 fallback한다.
3. 영어 source도 준비되지 않았거나 렌더에 실패하면 caller 기본 문구로 fallback한다.
4. fallback 발생은 PII 없는 metric/log로 관찰 가능하게 한다.
5. `SOURCE_COPIED`, `NEEDS_TRANSLATION`, `NEEDS_REVIEW` 문구를 현지 번역인 것처럼 선택하지 않는다.

#### 편집 상태 전이

1. 영어 source 변경은 다른 언어를 자동 READY로 유지하지 않는다. 기존 비영어 문구는 `NEEDS_REVIEW` 또는 `NEEDS_TRANSLATION`로 내려야 한다.
2. 비영어 문구를 저장하면 기본적으로 `NEEDS_REVIEW`가 된다.
3. 운영자가 명시적으로 `Reviewed and ready`를 선택한 언어만 actor/time과 함께 `READY`가 된다.
4. READY 문구를 다시 변경하면 같은 저장에서 명시적으로 재검수하지 않는 한 `NEEDS_REVIEW`로 돌아간다.
5. 한 명이 운영하는 환경이므로 별도 다중 승인 workflow는 만들지 않는다.

### P0-4. `Paused`의 의미를 실제 서버 동작과 일치시킨다

현재 `enabled=false`는 알림 발송 중지가 아니라 관리 템플릿 대신 caller 기본 문구를 사용하는 동작이다.

이번 페이지에서는 기존 boolean 의미를 보존하되 다음처럼 수정한다.

- `Notification template enabled` → `Use managed copy`
- `Enabled for every language` → `When off, notifications still send using the code fallback copy.`
- badge `Paused` → `Managed copy off`
- 변경 요약 `Availability: Paused` → `Managed copy: Off`

실제 알림 발송 중지 기능을 이 페이지에 추가하지 않는다. 진짜 delivery policy는 별도 운영 정책 영역의 책임이다. 현재 boolean을 실제 발송 차단으로 바꿔 기존 알림을 예기치 않게 끊지 않는다.

---

## Phase 2 — 조회·저장·오류 처리의 운영 신뢰성을 고친다

### P1-1. GET을 완전한 read-only로 만든다

#### 현재 문제

`listNotificationTemplates()`가 `ensureDefaultNotificationTemplates()`를 호출해 매 조회마다 22개 upsert와 translation createMany를 실행한다. `updatedAt @updatedAt` 때문에 화면 reload만으로 모든 템플릿 수정 시각이 바뀐다.

#### 구현 계약

1. list GET과 update 요청에서 `ensureDefaultNotificationTemplates()` 호출을 제거한다.
2. 기본 템플릿 생성은 저장소 관례에 맞는 Prisma migration 또는 명시적 bootstrap 단계로 이동한다.
3. 새 환경에서도 migration/seed 절차 후 카탈로그가 완전해야 한다.
4. runtime GET은 누락 템플릿을 자동 생성하지 않는다.
5. 카탈로그 코드와 DB key의 차이를 찾는 read-only health/contract check를 제공한다.
6. 누락 key가 있으면 화면을 정상 empty처럼 보여주지 말고 `Catalog setup incomplete` 운영 오류를 표시한다.
7. GET 전후 template/translation `updatedAt`이 같다는 테스트를 추가한다.
8. migration은 기존 문구를 덮어쓰지 않고 누락 row만 안전하게 생성해야 한다.

### P1-2. optimistic concurrency를 구현한다

GET이 더 이상 `updatedAt`을 오염시키지 않게 한 뒤 이를 revision으로 사용할 수 있다.

1. Admin API 응답에 template revision 또는 `updatedAt`을 명시적으로 제공한다.
2. PATCH DTO에 `expectedUpdatedAt` 또는 `expectedRevision`을 요구한다.
3. transaction 내부에서 revision이 일치할 때만 template row를 갱신한다.
4. 이미 변경됐다면 아무 번역도 쓰지 않고 HTTP 409를 반환한다.
5. 번역 변경 시 template revision도 반드시 갱신되게 한다.
6. UI는 409에서 현재 서버본과 내 초안을 비교하고 `Reload latest`와 `Copy my draft`를 제공한다.
7. 마지막 저장이 조용히 앞선 작업을 덮어쓰면 안 된다.

### P1-3. 변경 사유와 감사 증거를 보강한다

1. 저장 시 5~500자의 짧은 변경 사유를 요구한다.
2. audit metadata에 reason, expected revision, resulting revision, changed locales, readiness transition, managed-copy before/after, before/after copy를 남긴다.
3. 화면에 최근 실제 변경자와 시각을 보여준다.
4. GET으로 갱신된 시각을 변경 이력으로 사용하지 않는다.
5. 문구 전체가 민감 로그나 일반 서버 로그에 중복 노출되지 않게 하고, 상세 before/after는 기존 admin audit 저장 정책을 따른다.

### P1-4. 저장 실패 시 초안을 보존한다

현재 server action은 모든 오류를 catch한 뒤 redirect하여 초안을 잃고 원인을 하나로 합친다.

1. 기존 Admin form pattern을 조사하고 `useActionState` 또는 동등한 in-place action result를 사용한다.
2. 오류가 발생해도 현재 template, locale, 모든 draft, managed-copy 상태, reason을 유지한다.
3. 다음 오류를 운영 문구로 구분한다.
   - 400 validation
   - 401 session expired
   - 403 permission denied
   - 404 template missing/catalog incomplete
   - 409 stale revision
   - 500/503 source unavailable
4. 네트워크/서버 오류에는 안전한 재시도와 초안 복사 기능을 제공한다.
5. mutation 결과가 불명확한 경우 무조건 재전송하지 말고 최신 revision을 먼저 확인한다.
6. 성공 notice는 raw key가 아니라 사람이 읽는 템플릿 이름과 변경 언어를 사용한다.
7. 기술 key는 audit 및 고급 정보에 유지한다.

### P1-5. load error와 진짜 empty state를 분리한다

1. `adminGet(..., [])`로 API 실패를 정상 빈 목록처럼 보이지 않게 한다.
2. loading 실패, permission denied, catalog incomplete, 실제 empty를 각각 구분한다.
3. 코드 기본 카탈로그가 존재하는 시스템에서 DB 0건은 정상 empty가 아니라 setup/runtime 오류다.
4. 오류 화면은 retry와 점검할 health 정보를 제공하되 raw stack/secret을 노출하지 않는다.

---

## Phase 3 — 1440px 이상 운영 화면을 재구성한다

### 3.1 중복 KPI를 compact readiness bar로 바꾼다

현재 `Templates`, `Enabled`, `Customers`, `Partners` 네 카드는 공간 대비 운영 가치가 낮고 입력 영역을 fold 아래로 민다.

다음 값을 한 줄짜리 compact readiness bar에 우선 표시한다.

```text
Needs translation
Needs review
Routing contract errors
Managed copy off
Last genuine change
```

요구사항:

- `Customers + Partners = Templates`처럼 파생 가능한 중복 숫자는 큰 카드로 표시하지 않는다.
- 1440×1000에서 선택된 템플릿의 제목·메시지 입력 시작점이 가능한 첫 화면 안에 보이게 한다.
- routing error가 있으면 정상 metric이 아니라 danger 상태로 가장 먼저 보인다.
- readiness 숫자는 전체 22개×5개 언어를 기준으로 서버 또는 한 번의 응답에서 계산한다. 행마다 별도 API를 호출하지 않는다.

### 3.2 searchable catalog를 제공한다

22개 템플릿을 native select 하나로 숨기지 말고, 새 UI 라이브러리 없이 간단한 검색 가능한 catalog를 만든다.

권장 구조:

```text
좌측 320~360px catalog
우측 유동형 editor
```

catalog 요구사항:

- 검색: 사람이 읽는 영어 제목, 설명, event key
- 필터: audience, channel, readiness, managed copy
- 그룹: Booking, Service, Chat, Payment/Payout, Admin broadcast
- 각 행: 친화적 이름, Customer/Partner, Push/In-app, 언어 준비 `n/5`, 상태
- 기본 선택: 첫 번째 조치 필요 템플릿
- 조치 필요 항목이 없으면 URL 선택 또는 최근 편집 템플릿
- 키보드로 검색 결과 이동·선택 가능
- 22개 규모에 맞는 단순 구현을 사용하고 virtualized list나 table framework를 추가하지 않는다.

### 3.3 선택 문맥을 URL과 동기화한다

- template 선택 시 `template` query를 갱신한다.
- locale 선택 시 `locale` query를 갱신한다.
- shallow/client navigation으로 불필요한 전체 reload를 피한다.
- 새로고침, 뒤로가기, 북마크, 링크 공유에서 같은 template/locale이 열린다.
- dirty 상태에서 URL 전환은 기존 이탈 경고를 유지한다.

### 3.4 언어 탭 상태와 접근성을 수정한다

표시 상태:

```text
Source copied
Needs translation
Needs review
Ready
Changed
```

접근성 요구:

- 선택 탭만 `tabIndex=0`, 나머지는 `-1`
- ArrowLeft/ArrowRight로 이전·다음 언어 이동
- Home/End 지원
- tab id와 tabpanel `aria-labelledby` 연결
- tab `aria-controls`와 panel id 연결
- focus와 selected 상태를 구분하되 모두 명확히 표시
- 선택·비선택 탭의 일반 글자와 작은 상태 글자 모두 4.5:1 이상 대비
- 상태는 색상만으로 표현하지 않음
- 기존의 선택 탭 흰 글자/연한 배경 1.29:1, 작은 글자/보라색 2.29:1 조합을 제거

### 3.5 편집 필드와 변수 도구를 개선한다

- 제목에 현재 글자 수 `n / 120`
- 메시지에 현재 글자 수 `n / 500`
- supported variables를 JSON이 아닌 설명형 chip으로 표시
- 예: `Partner name · required · Mai`
- 변수 chip 클릭 시 현재 커서 위치에 placeholder 삽입
- 필수/선택 변수 구분
- event key는 Advanced/Technical details에 유지하고 copy 버튼 제공
- raw channel `BOTH`는 `Push + in-app`으로 표시
- 저장 전 언어별 title/message before/after 요약
- 변경 사유 입력
- `Reviewed and ready`를 명시적으로 선택할 수 있는 제어

### 3.6 실제 채널 미리보기를 제공한다

현재 일반 파란 텍스트 블록을 다음 구조로 개선한다.

- Push preview
- In-app preview
- template channel에 없는 preview는 비활성 또는 숨김
- 실제 최대 폭과 줄 수에 가까운 truncation
- 제목·본문 문자 수
- sample variables가 적용된 결과
- 클릭 destination 또는 `No destination configured`
- Push + in-app이면 두 결과를 비교 가능

OS별 완벽한 device simulator를 만들 필요는 없다. 운영자가 제목 잘림, 본문 길이, 목적지, 변수 치환을 판단할 수 있는 최소한의 실제형 preview면 된다.

### 3.7 Managed copy 제어의 영향 설명

- 편집 header 또는 저장 영역에서 `Use managed copy`를 제공한다.
- 끄면 `Notifications continue using the code fallback copy.`를 즉시 표시한다.
- 변경 요약에 before/after를 표시한다.
- 변경 사유를 요구한다.
- 실제 delivery pause처럼 보이는 badge, label, confirmation을 사용하지 않는다.

### 3.8 1440+ 시각·상태 hardening

다음을 모두 확인한다.

- 라이트 테마 1440×1000
- 다크 테마 1440×1000
- 라이트 테마 1600×1000
- 120자 제목
- 500자 메시지
- CJK 및 베트남어 문구
- 긴 template 이름과 description
- load error
- permission denied/read-only
- catalog incomplete
- stale revision 409
- server error with preserved draft
- SOURCE_COPIED/NEEDS_TRANSLATION/NEEDS_REVIEW/READY 혼합 상태
- routing contract error 상태
- managed copy off 상태
- console warning/error 0건
- 페이지 수준 horizontal overflow 없음

1024px 이하 레이아웃은 구현 완료 조건과 캡처 목록에 넣지 않는다.

---

## Phase 4 — 테스트와 계약 검증

기존 테스트를 유지하고 다음을 추가한다.

### API·DB 테스트

- default catalog key unique 및 locale 정의 검증
- catalog key와 runtime route reachability 양방향 검증
- 모든 `(type, targetRole)`의 expected template key
- explicit templateKey와 audience 불일치 차단
- 모든 caller payload와 required placeholder 일치
- unresolved placeholder가 persisted/sent 되지 않음
- vi/ko/ja/zh `SOURCE_COPIED` 문구를 localized READY로 선택하지 않음
- READY locale 선택
- locale not ready → READY English fallback
- English unusable → caller copy fallback
- managed copy off → caller copy 발송, delivery 자체는 유지
- GET list에서 upsert/createMany/update 0회
- GET 전후 updatedAt 불변
- migration이 기존 문구를 덮어쓰지 않음
- source locale 변경 시 다른 언어 readiness downgrade
- non-English save → NEEDS_REVIEW
- reviewed save → READY + reviewer/time
- expected revision 일치 시 원자 저장 + 단일 audit
- stale revision → 409 + 모든 write 0회
- reason/readiness/revision이 audit metadata에 존재

실제 PostgreSQL semantics가 필요한 migration/concurrency 검증은 mock만으로 끝내지 말고 저장소의 통합 테스트 관례를 따른다.

### Admin Web 테스트

- readiness bar의 전체 집계
- searchable catalog의 검색·필터·기본 조치 항목 선택
- template/locale URL round-trip
- SOURCE_COPIED/NEEDS_TRANSLATION/NEEDS_REVIEW/READY 표시
- 언어 탭 ArrowLeft/Right, Home, End, roving tabindex
- tab/tabpanel ARIA 연결
- placeholder validation과 저장 비활성
- 문자 수와 변수 삽입
- managed copy off 문구와 변경 요약
- 400/401/403/404/409/500 상태별 문구
- 저장 실패 후 모든 draft 보존
- 성공 notice의 친화적 이름
- load failure가 empty로 표시되지 않음
- read-only operator가 mutation control을 사용할 수 없음

### 브라우저/E2E 증거

1440×1000에서 다음을 캡처한다.

1. 기본 조치 필요 catalog와 readiness bar
2. READY/NEEDS_REVIEW가 섞인 언어 탭
3. 키보드로 언어 탭을 이동한 focus 상태
4. placeholder 오류와 disabled save
5. Push/In-app preview
6. managed copy off 영향 설명과 변경 요약
7. stale revision 409에서 draft가 유지된 상태
8. load/API error와 retry 상태
9. 라이트 테마 전체 화면
10. 다크 테마 전체 화면

1600×1000에서 다음을 캡처한다.

1. 전체 catalog/editor 레이아웃
2. 긴 문구와 최대 길이 상태

브라우저 검증에서는 실제 사용자 알림을 발송하지 않는다. 저장 흐름이 필요하면 격리된 테스트 fixture나 mock route를 사용한다.

## 6. 구현하지 말아야 할 것

- `Complete`를 `Ready`로 이름만 바꾸지 않는다.
- 영어 문구를 다섯 언어에 복사해 빈 칸을 채우지 않는다.
- Codex/기계 번역 결과를 검수 없이 READY로 만들지 않는다.
- 실제 앱이 사용하는 notification type을 영향 분석 없이 rename하지 않는다.
- 역할별 문구 문제를 UI label 변경으로만 감추지 않는다.
- 죽은 템플릿을 UI에서 숨기기만 하고 runtime 계약은 그대로 두지 않는다.
- 미치환 placeholder를 literal 상태로 저장·전송하지 않는다.
- GET에서 upsert를 유지한 채 cache만 추가하지 않는다.
- `enabled=false`를 실제 delivery pause로 몰래 바꾸지 않는다.
- 이 문구 편집 페이지에 실제 발송 중지 정책까지 합치지 않는다.
- 다중 승인 workflow engine이나 번역 SaaS를 도입하지 않는다.
- template row마다 readiness API를 호출하는 N+1을 만들지 않는다.
- 저장 실패 시 redirect로 draft를 잃지 않는다.
- 409 conflict에서 last-write-wins로 자동 재저장하지 않는다.
- 새로운 UI framework나 table/list library를 추가하지 않는다.
- 기존 audit, 권한, unsaved navigation guard를 약화하지 않는다.
- 관련 없는 Notifications Delivery, Push Send, bookings, auth, finance 코드를 정리하지 않는다.
- 1024px 이하 UI 대응을 이번 작업에 포함하지 않는다.
- 테스트 통과를 위해 business rule이나 placeholder 검증을 완화하지 않는다.
- 사용자 요청 없이 commit하지 않는다.

## 7. 실행할 검증 명령

Windows에서는 `npm.cmd`를 사용한다. 실제 변경 파일에 맞춰 focused test를 먼저 실행한 뒤 scope 검증으로 확장한다.

최소 focused 검증 예시:

```powershell
npm.cmd run test -w @massage-vn/admin-web -- app/notifications/templates/page.spec.tsx app/notifications/templates/actions.spec.ts lib/admin-operator-access-model.spec.ts
npm.cmd run test -w @massage-vn/api -- src/notifications/notification-template-catalog.spec.ts src/notifications/notifications.service.spec.ts src/bookings/bookings.notifications.spec.ts
npm.cmd run test -w @massage-vn/api -- src/admin/admin.service.spec.ts -t "notification template"
npm.cmd run typecheck -w @massage-vn/admin-web
npm.cmd run typecheck -w @massage-vn/api
```

Migration과 protected area 변경이 있으므로 다음도 실행한다.

```powershell
npm.cmd run prisma:migrations:check
npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api
npm.cmd run verify:local
```

`verify:local`이 외부 서비스나 기존 사용자 변경 때문에 실패하면 무조건 성공으로 기록하지 않는다. 정확한 실패 명령, 이번 변경과의 관련성, 미검증 위험을 구현 보고서에 남긴다.

## 8. 완료 기준

다음 항목이 모두 충족되어야 구현 완료다.

### 발송 계약

- 모든 실제 `(type, targetRole)`이 정확히 한 template key로 연결된다.
- 모든 카탈로그 템플릿이 실제 경로에서 도달 가능하다.
- Customer/Partner 역할별 문구가 실제 발송에서 구분된다.
- `chat.message.created`와 catalog가 연결된다.
- `admin.push.broadcast`가 실제 동작과 일치하는 위치로 정리된다.
- 모든 필수 placeholder가 caller payload에 존재한다.
- unresolved placeholder가 저장·발송되지 않는다.

### 번역 준비 상태

- vi/ko/ja/zh 영어 복사본 88개가 Complete/Ready로 표시되지 않는다.
- SOURCE_COPIED/NEEDS_TRANSLATION/NEEDS_REVIEW/READY 상태가 DB와 UI에 존재한다.
- READY가 아닌 현지 언어는 명시적 English/caller fallback을 따른다.
- 변경·검수 상태 전이가 테스트된다.
- reviewer/time이 감사 가능하다.

### 데이터·저장 안전

- list GET은 DB write를 0회 수행한다.
- GET으로 updatedAt이 바뀌지 않는다.
- 두 탭 동시 수정에서 두 번째 stale save가 409가 된다.
- 409나 서버 오류 후 draft가 유지된다.
- 오류 원인이 상태별로 구분된다.
- 변경 사유·before/after·revision·readiness가 audit에 남는다.
- load error가 정상 empty로 보이지 않는다.

### 운영 화면

- 중복 KPI가 compact readiness bar로 바뀐다.
- template 검색·필터·조치 필요 기본 선택이 가능하다.
- template/locale이 URL에서 복원된다.
- 언어 탭의 키보드 조작과 ARIA 연결이 정상이다.
- 언어 탭의 텍스트 대비가 4.5:1 이상이다.
- 문자 수, 변수 설명·삽입, 실제형 Push/In-app preview가 있다.
- `Managed copy off`가 알림 계속 발송 사실을 명확히 설명한다.
- 1440×1000과 1600×1000에서 페이지 가로 넘침이 없다.
- 라이트·다크 테마와 오류·긴 문구 상태가 검증된다.
- console warning/error가 없다.

### 검증과 보고

- focused tests, typecheck, migration check, admin/api scope 검증 결과가 기록된다.
- protected area 변경 때문에 가능한 범위에서 `verify:local`이 수행된다.
- before/after 화면 증거가 저장된다.
- 미완료 항목과 출시 위험이 숨김없이 기록된다.

## 9. 산출물

다음을 남긴다.

1. API, Admin Web, Prisma migration 구현 코드
2. 발송 route/placeholder/readiness/concurrency 테스트
3. 1440px·1600px before/after 화면 증거 폴더
4. 다음 구현 보고서

```text
docs/audits/notification-templates-remediation-implementation-2026-08-12.md
```

구현 보고서에는 다음을 포함한다.

- 감사 요구사항별 `완료 / 부분 완료 / 미완료`
- 변경 파일
- 발송 `(type, targetRole) -> templateKey` 최종 매핑표
- migration/backfill 전략과 실제 적용 여부
- 번역 readiness와 fallback 계약
- managed-copy 실제 의미
- 실행한 명령과 pass/fail/skipped
- protected area 변경
- 브라우저 캡처 링크
- 남은 운영 번역·검수 작업
- 남은 위험
- 출시 가능 여부와 재평가 점수

실제 vi/ko/ja/zh 번역 검수가 남아 있다면 기능 구현 완료와 콘텐츠 rollout 완료를 구분한다. 검수되지 않은 번역을 READY로 만들지 말고, 출시 전 운영 작업으로 정확히 기록한다.

## 10. 최종 응답 형식

최종 응답은 다음 순서로 작성한다.

1. 한 줄 판정
2. P0 발송 계약 수정 결과
3. 번역 readiness/migration 결과
4. 저장 안전·오류 복구 결과
5. 1440+ UI·접근성 결과
6. 테스트와 검증 결과
7. protected area 변경
8. 남은 위험과 콘텐츠 rollout 작업
9. 구현 보고서 링크
10. 다음 권장 작업 1개

중요:

- UI가 예뻐져도 발송 역할 매핑, placeholder, readiness, managed-copy 의미가 해결되지 않았으면 출시 가능으로 판정하지 않는다.
- 테스트가 통과해도 실제 비영어 번역 검수가 남았다면 `코드 출시 가능`과 `다국어 콘텐츠 출시 가능`을 분리해서 판정한다.
- migration을 작성했지만 shared/production DB에 적용하지 않았다면 적용 완료라고 주장하지 않는다.
- 일부 항목을 구현하지 못했다면 이유, 증거, 출시 영향을 명시한다.

---

## 이 프롬프트의 사용 메모

- 이 작업은 UI 수정만이 아니라 Prisma migration, 발송 resolver, bookings notification payload를 포함하므로 큰 작업이다.
- 새 Codex 작업에서 이 MD 파일을 직접 지정해 실행하는 것이 좋다.
- Plan 모드로 시작할 수 있지만 계획 작성 후 구현까지 이어서 진행하도록 이미 지시돼 있다.
- 사용자 알림을 실제 발송하거나 shared/production DB에 migration을 적용하는 단계는 이 프롬프트가 승인한 범위가 아니다.
- 구현 후에는 같은 1440px 이상 기준으로 재감사를 별도 수행한다.
