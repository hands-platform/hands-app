# Notification Delivery 운영자 UX·안전성 개선 Codex 실행 프롬프트

아래 작업을 계획이나 제안으로 끝내지 말고 **현재 소스에 실제로 구현하고 검증**하라.

## 목표

`http://localhost:3101/notifications`를 개발자용 알림 로그가 아니라 운영자가 다음 행동을 빠르고 안전하게 결정하는 `Notification Delivery` 작업 화면으로 완성한다.

현재 구현의 좋은 구조는 유지하면서 다음 결과를 만든다.

1. `No active push route`와 `No send attempt after 15m`가 과거 알림 수만 건에 묻히지 않고 현재 해결해야 할 대상부터 보인다.
2. 실패 그룹에서 해당 provider/failure code의 레코드만 정확히 열 수 있다.
3. 실패 원인에 맞는 담당자·기술 조치·재시도 조건이 표시된다.
4. 1440×900과 1600×900에서 필터, 표, CTA가 잘리거나 글자 단위로 깨지지 않는다.
5. 이름 없는 사용자의 전체 전화번호가 화면과 접근성 이름에 노출되지 않는다.
6. 재시도 queue 적재와 audit 결과가 어긋나 사용자를 중복 재시도로 유도하지 않는다.
7. 반복 업무의 주 동작, 수동 Refresh, 데이터 범위, 상태 기준 시점을 운영자가 바로 이해할 수 있다.

## 기준 문서와 화면 증거

먼저 다음 보고서를 처음부터 끝까지 읽고, P1/P2 요구와 “유지해야 할 좋은 구현”을 작업 계약으로 사용한다.

`C:\dev\massage-on-demand-vn\output\notifications-post-implementation-audit-2026-08-07\notifications-post-implementation-deep-audit.md`

같은 폴더의 현재 실행 화면 증거도 확인한다.

- `01-base-needs-action-1440.jpg`
- `02-failed-queue-1440.jpg`
- `03-row-action-menu-1440.jpg`
- `04-retry-confirmation-1440.jpg`
- `05-no-attempt-1440.jpg`
- `06-no-route-1440.jpg`
- `07-stale-route-empty-1440.jpg`
- `08-delivery-records-1440.jpg`
- `09-base-failure-groups-1600.jpg`
- `10-delivery-records-1600.jpg`
- `11-delivery-records-dark-1600.jpg`

보고서의 파일/라인 번호가 현재 수정으로 이동했을 수 있으므로 번호만 믿지 말고 함수명과 caller를 `rg`로 다시 찾는다. 현재 코드와 실행 화면이 최종 사실이다.

## 작업 위치와 기본 규칙

- 저장소: `C:\dev\massage-on-demand-vn`
- 시작 전에 루트와 대상 하위 경로의 `AGENTS.md`를 모두 읽는다.
- `git status --short`로 dirty worktree를 확인하고 기존 사용자 변경을 보존한다.
- `git reset --hard`, `git checkout --`, broad clean, 전체 Node 프로세스 종료를 하지 않는다.
- 현재 디자인 시스템, form/table/action/menu/notice/pagination 컴포넌트와 query builder를 재사용한다.
- 새 UI 라이브러리, 새 npm dependency, 새 디자인 시스템을 추가하지 않는다.
- Prisma schema나 migration은 기본적으로 변경하지 않는다. 이번 요구는 기존 Notification/Delivery/PushDevice 데이터와 SQL CTE/집계로 해결한다.
- 파일이 크다는 이유만으로 새 repository/facade/factory를 만들지 않는다.
- 같은 판단을 여러 화면에 복제하지 말고 기존 공통 helper의 실제 caller를 확인한 뒤 가장 좁은 공통 지점에서 수정한다.
- 현재 테스트가 잘못된 동작을 고정한다면 구현과 함께 행동 계약 테스트로 수정한다.
- 실제 notification 발송, retry 제출, legacy review 저장, DB 데이터 수정·삭제는 브라우저 QA에서 수행하지 않는다.
- 확인창은 열어 내용·초점·취소를 검증하되 제출하지 않는다.

## 검사 화면 범위

- 반드시 검사: **1440×900, 1600×900 데스크톱**
- 이번 작업에서 검사·보고하지 않음: 1024px 이하, 모바일, 태블릿, 200% 확대
- 1024px 이하 대응을 위해 별도 컴포넌트나 CSS를 추가하지 않는다.
- 자연스럽게 기존 작은 화면 동작이 유지되는 것은 허용하지만 완료 보고의 평가 대상으로 삼지 않는다.

## 유지해야 하는 현재 계약

다음은 이미 잘 구현됐으므로 퇴행시키지 않는다.

- H1과 navigation label은 `Notification Delivery`다.
- 상위 구조는 `Needs action | Delivery records` 두 모드다.
- 현재 기본 표는 `Created | Recipient | Notification | Send status | Next action` 5열이다.
- records의 기본 날짜는 `Today · Vietnam time`이다.
- page size는 10이며 server-side pagination과 out-of-range canonical redirect를 유지한다.
- list error, summary error, empty result, filter zero는 서로 다른 상태다.
- FCM `SENT`는 `Accepted by FCM`이지 기기 수신 완료가 아니다.
- 재시도 확인창은 성공한 device path를 제외하고 미해결 path만 보여 준다.
- retry reason은 화면과 서버에서 12–500자로 검증한다.
- enqueue 직전 서버 eligibility 재검증과 successful-device exclusion을 유지한다.
- Web의 `NOTIFICATIONS_RETRY` 노출 제어와 API permission guard를 모두 유지한다.
- raw push token, full device ID, full phone, provider response 원문을 목록·URL·audit metadata에 노출하지 않는다.
- 기존 legacy URL redirect를 유지한다.
  - system incident → Background Jobs
  - finance overdue → Bank reconciliation
  - legacy delivery review → 새 notification issue/mode
- `/notifications/templates`, `/notifications/push-send` route와 권한을 건드리지 않는다.
- light/dark theme token과 기존 visual language를 유지한다.

다음은 추가하지 않는다.

- KPI dashboard, chart, decorative metric card
- bulk retry, bulk contact, bulk status mutation
- automatic polling 또는 realtime subscription
- page-size selector
- 새 persistent incident/assignment/acknowledgement 모델
- 알림 발송 채널 정책의 전면 재설계

## 작업 전 추적할 핵심 코드

실제 caller를 확인하면서 최소한 다음 흐름을 읽는다.

Admin Web:

- `apps/admin_web/app/notifications/page.tsx`
- `apps/admin_web/app/notifications/notification-page-model.ts`
- `apps/admin_web/app/notifications/notification-table-row.tsx`
- `apps/admin_web/app/notifications/notifications-table-section.tsx`
- `apps/admin_web/app/notifications/notification-delivery-cell.tsx`
- `apps/admin_web/app/notifications/notification-failure-copy.ts`
- `apps/admin_web/app/notifications/notification-action-confirmation.ts`
- `apps/admin_web/app/notifications/notification-action-return-href.ts`
- `apps/admin_web/app/notifications/actions.ts`
- 관련 notification `*.spec.ts`, `*.spec.tsx`
- `apps/admin_web/app/globals.css`의 notification table/filter/action 선택자
- generic `router.refresh()`와 Admin form/action pattern
- `apps/admin_web/lib/admin-api.ts`의 notification list/summary 타입

API와 queue:

- `apps/api/src/admin/admin-notification.routes.ts`
- `apps/api/src/admin/admin.service.ts`의 notification list/summary/retry 흐름
- `apps/api/src/admin/admin-notification-retry-query.ts`
- `apps/api/src/admin/admin-notification-unattempted-query.ts`
- `apps/api/src/admin/admin-notification-device-health-query.ts`
- `apps/api/src/admin/admin-notification-production-data.ts`
- `apps/api/src/notifications/notifications.service.ts`
- notification send queue/processor와 retry audit helper
- `apps/api/src/admin/admin-operator-category.guard.ts`
- 관련 focused specs

URL/보안 caller:

- `issue`, `provider`, `failureCode`, `age`, `range`, `sort`, `page`를 읽고 생성하는 모든 caller
- `notificationUserLabel`, phone masking, action accessible name의 모든 caller
- retry API 결과와 `retryNotice`를 소비하는 모든 caller
- failure group list와 summary가 사용하는 SQL predicate

## 구현 단계

### 1. Needs action을 현재 운영 해결 단위로 변경

#### 1-1. `No active push route`

현재 문제:

- 기본 action 범위가 all ages이고 oldest 정렬이다.
- 현재 활성 target-role push device가 없는 사용자의 과거 Notification을 레코드 단위로 모두 반환한다.
- 화면에 `75,160 notifications`가 표시되고 첫 페이지가 81일 전 행으로 채워진다.

요구사항:

1. no-route action queue의 목록·pagination 단위를 `(userId, targetRole)` 또는 현재 데이터에서 동일 의미를 보장하는 **수신자/경로 복구 단위**로 그룹화한다.
2. 새 DB 모델 없이 기존 SQL CTE와 representative notification 패턴을 사용한다.
3. 한 그룹 행에 최소한 다음 정보를 제공한다.
   - recipient identity와 role
   - 현재 활성 target route 유무
   - 가장 최근 관련 notification 제목/유형/생성 시각
   - 최초/최근 발생 시각
   - unresolved notification count
4. API total과 pagination은 그룹 수를 뜻하게 하고 notification record count도 별도 제공한다.
5. 화면 count는 `N recipients · M notifications`처럼 두 단위를 명시한다.
6. 기본 action scope에서는 현재 처리 범위만 보이고, 오래된 기록은 `History` 또는 명시적 `All ages`에서만 보이게 한다.
7. 기존 age/range URL과 legacy link를 가능한 한 보존한다. 새 parameter가 필요하면 기존 query builder를 확장한다.
8. 동일 사용자가 같은 route 문제로 한 페이지에 반복되지 않아야 한다.
9. current scope 안에서는 SLA를 놓치지 않도록 deterministic sort를 사용한다. 기존에 검증된 urgency 정책이 있으면 재사용한다. 없다면 새 복잡한 점수 체계를 만들지 말고 현재 범위 안에서 oldest-first와 명시적 sort를 사용한다.

`No active push route`는 현재 사용자 상태를 기준으로 하므로 과거 알림 시점의 상태처럼 표현하지 않는다. `Push route now: inactive`처럼 현재 기준임을 표시한다.

#### 1-2. `No send attempt after 15m`

1. 기본 화면에서 79일 전 레코드가 현재 장애처럼 보이지 않게 한다.
2. 최소한 `15–60m`, `1–24h`, `24h+ history`의 의미가 목록/필터/카운트에서 구분되게 한다.
3. 기본 queue는 현재 운영 범위를 사용하고 `24h+`는 history에서 접근한다.
4. worker 확인이 필요한 행은 가능한 경우 권한에 맞는 `Check worker` 또는 `Audit trail`을 주 동작으로 제공한다.
5. Background Jobs 권한이 없는 운영자에게 접근 불가능한 링크를 주 동작으로 노출하지 않는다.

완료 조건:

- `/notifications?issue=no-route` 첫 페이지가 오래된 notification 반복 목록이 아니다.
- 동일 수신자가 한 route 문제로 중복되지 않는다.
- recipient count와 notification count가 구분된다.
- current와 history의 list/summary/pagination predicate가 서로 일치한다.
- no-attempt의 15분 SLA와 24시간 이상 history가 같은 레이블로 섞이지 않는다.

### 2. 실패 그룹 exact deep link 구현

현재 `notification-table-row.tsx`의 모든 `Open affected records`가 `/notifications?issue=failed`로 이동한다.

요구사항:

1. failure group CTA는 해당 row의 normalized `provider`와 `failureCode` 또는 안정적인 incident key를 URL에 포함한다.
2. 문자열을 직접 이어 붙이지 말고 기존 `buildNotificationDeliveryHref`와 URLSearchParams 패턴을 확장한다.
3. provider/failureCode는 URL encoding, 허용값 검증, canonical reset을 거친다.
4. Web view/model, Admin API route, list SQL, summary SQL이 **동일 normalization과 exact predicate**를 사용한다.
5. 상세 목록 상단에 예를 들어 `FCM · Firebase project mismatch` active filter와 `Clear group`을 표시한다.
6. page 이동, Refresh, retry confirm, Cancel 후에도 exact group scope가 유지된다.
7. CTA 문구는 `Open this group` 또는 공간에 맞는 `Open records`로 바꾼다.

최소 테스트:

- 서로 다른 provider/failureCode 그룹은 서로 다른 href를 가진다.
- `/`, `_`, `-`가 포함된 failureCode가 안전하게 encode/decode된다.
- 선택 그룹의 rows, total, summary가 동일한 predicate 결과다.
- 다른 failureCode가 섞이지 않는다.
- Clear group URL은 다른 독립 필터를 불필요하게 제거하지 않는다.

### 3. failure code별 운영 안내를 분리

현재 그룹의 대표 delivery recovery hint를 기술 조치로 재사용해 9개 그룹 모두 앱 재실행 안내가 나온다. `notification-failure-copy.ts` 또는 현재 가장 가까운 기존 helper를 확장하고 새 runbook framework를 만들지 않는다.

최소 분류:

| 유형 | 운영 문구와 CTA | Owner | Retry eligibility |
|---|---|---|---|
| `PUSH_PROVIDER_NOT_CONFIGURED`, credential missing | FCM 설정과 worker readiness 확인, Setup/Background Jobs 열기 | Developer/System | 설정 검증 전 금지 |
| `messaging/mismatched-credential` | Firebase project/credential 일치 확인 | Developer/System | project 검증 전 금지 |
| `INVALID_ARGUMENT`, `messaging/invalid-argument` | latest provider response의 payload/template/target field 확인 | Developer/System | 원인 수정 후 |
| `UNREGISTERED`, `messaging/registration-token-not-registered` | 앱 재실행 또는 새 enabled token 확인, recipient 열기 | Customer Support | 새 route 확인 후 |
| `UNCLASSIFIED_FAILURE`, provider unknown | provider response와 Background Jobs evidence 확인 | Developer/System | 원인 분류 또는 provider 회복 후 |

요구사항:

- group의 `Technical next step`에 owner와 retry condition이 짧게 보인다.
- 설정 문제에 고객 연락을 권하지 않는다.
- token 문제에서만 앱 재실행/recipient 확인을 우선한다.
- 접근 권한이 없는 Developer/System 링크는 숨기거나 안전한 감사 링크로 대체한다.
- 원문 provider response, token, 전체 device ID는 노출하지 않는다.
- unknown code는 거짓 해결책 대신 `Review latest provider response before retrying`처럼 보수적으로 표시한다.

### 4. 개인정보 fallback을 닫는다

현재 `notificationUserLabel()`은 이름이 없을 때 raw phone을 반환하고 이 값이 `Actions for ...` 접근성 이름에 들어갈 수 있다.

목록용 identity 우선순위:

1. Partner display name 또는 user fullName
2. masked phone
3. `User {shortId}`

요구사항:

- visible recipient primary label과 ActionMenu/primary action의 accessible name이 같은 list-safe helper를 사용한다.
- 이름 없는 Customer, Partner, Admin을 모두 처리한다.
- 전체 전화번호를 의도적으로 사용하는 상세/contact caller가 있다면 전역 helper 의미를 무리하게 바꾸지 말고 list-safe helper 하나를 둔다.
- DOM text, `aria-label`, `title`, URL, serialized markup 어디에도 full phone이 없어야 한다.

최소 테스트:

- 이름 없는 Customer/Partner/Admin fixture를 render한다.
- rendered HTML 전체에 원문 전화번호가 없음을 검증한다.
- masked phone 또는 short ID가 남아 서로 구분 가능함을 검증한다.

### 5. retry enqueue와 audit 결과의 공백을 제거

현재 흐름은 queue enqueue 성공 후 audit을 쓰므로 outcome audit 실패 시 실제 job이 존재해도 Web이 `Nothing was queued`라고 오도할 수 있다.

새 distributed transaction이나 새 persistence model을 만들지 말고 기존 queue/audit primitive와 Node 표준 기능으로 다음 불변조건을 만족시킨다.

1. 서버 reason validation과 eligibility 재검증을 유지한다.
2. `notification.retry_requested` audit이 성공한 뒤에만 enqueue한다.
3. request에 `crypto.randomUUID()` 같은 표준 correlation ID를 부여한다.
4. enqueue 성공 후 `notification.retry_queued` outcome에 correlation, notification ID, actor, reason, queue name, job ID, masked path snapshot을 남긴다.
5. enqueue 실패 시 성공 notice를 반환하지 않고 가능한 범위에서 `notification.retry_failed` outcome을 같은 correlation로 기록한다.
6. enqueue는 성공했지만 queued outcome audit만 실패한 경우 이를 generic queue failure로 바꾸지 않는다.
7. 이미 생성된 job ID를 응답에서 보존하고 Web은 `Retry queued · audit confirmation pending`처럼 중복 재시도를 유도하지 않는 경고를 보여 준다.
8. 이 degraded outcome은 server logger/monitoring에서도 correlation과 job ID로 찾을 수 있어야 한다.
9. raw token, full phone, full device ID, provider response body는 audit/job metadata에 넣지 않는다.
10. 기존 deduplication과 successful-device exclusion을 유지한다.

최소 테스트:

- request audit 실패 시 retry/enqueue가 호출되지 않는다.
- enqueue 실패 시 queued audit과 success notice가 없다.
- enqueue 실패 outcome은 request와 동일 correlation을 가진다.
- enqueue 성공 시 requested/queued audit과 job이 동일 correlation로 추적된다.
- enqueue 성공 + outcome audit 실패 시 UI가 `Nothing was queued`라고 표시하지 않는다.
- 12–500자 reason, 403 permission, 409 state/no eligible path, queue unavailable 계약이 유지된다.

### 6. 1440/1600 데스크톱 레이아웃 수정

#### 6-1. Delivery records 필터

현재 CSS는 sidebar를 제외한 실제 content 폭을 고려하지 않고 검색 + select 5개 + actions를 한 줄에 강제한다.

요구사항:

- 1600px의 현재 한 줄 배치는 유지할 수 있다.
- 1440px에서는 기존 form component를 사용해 읽기 쉬운 2행 또는 4열 grid로 전환한다.
- 최소 1440px에서 `Apply filters`, `Reset`이 문자 단위로 줄바꿈되지 않는다.
- action 영역은 최소 120px 이상을 확보하고 `white-space: nowrap`을 적용한다.
- viewport 폭만 보지 말고 실제 admin content 폭에서 안정적으로 동작하게 한다. 기존 구조에 container query가 없다면 새 시스템을 만들지 말고 정확한 desktop breakpoint를 사용한다.
- page-level horizontal scroll을 만들지 않는다.

#### 6-2. Failure groups table

요구사항:

- 1440과 1600에서 원인 label, provider/raw code, 마지막 헤더, CTA 전체가 보인다.
- incident group table에는 일반 notification record와 다른 명시적 column class 또는 table variant를 사용한다.
- 긴 failure code를 사람용 label, provider, raw code의 3단 정보로 표시한다.
- raw code는 복사 가능하고 separator 기준으로 읽을 수 있게 개행한다.
- CTA를 짧게 만들고 최소 폭을 확보한다.
- 꼭 필요한 경우 기존 `.admin-table-scroll`의 내부 가로 스크롤을 정상 복구하되, outer shell의 overflow 조합 때문에 마지막 열이 잘리지 않게 한다.
- table 내부 별도 vertical scroll은 추가하지 않는다.

완료 조건:

- 1440×900과 1600×900 캡처에서 필터 버튼, 실패 코드, 우측 CTA가 모두 읽힌다.
- 글자가 `Ap / ply / filte / rs`, `INVALID_ARGUM / ENT`처럼 의미 없이 분해되지 않는다.
- light/dark 모두 동일한 구조를 유지한다.

### 7. 반복 운영 동작과 상태 문구 보완

#### 7-1. 기본 group selected state

- issue selector 첫 항목에 `Failure groups · N groups`를 추가한다.
- 기본 `/notifications`와 `issue=groups`에서 시각적 selected 상태와 접근성 현재 상태가 모두 존재해야 한다.
- group count 단위는 notifications가 아니라 groups다.

#### 7-2. 주 동작을 메뉴 밖에 표시

`Next action`에서 다음 주 동작은 ellipsis를 열기 전에 보여 준다.

- failure group: `Open this group`
- retry 가능한 failed/partial: `Review & retry`
- no-route/token recovery: `Open recipient`
- no-attempt: 권한에 맞는 `Check worker` 또는 `Audit trail`
- accepted/skipped record: `Audit trail`

`Open booking`, `Audit trail` 등 secondary action만 overflow menu에 둔다. 기존 action 데이터를 재사용하고 동일 동작을 두 군데에서 별도로 생성하지 않는다.

#### 7-3. 수동 Refresh

- data status 또는 page actions에 현재 필터/issue/group/page를 보존하는 `Refresh`를 추가한다.
- 기존 generic `router.refresh()` 패턴과 button atom을 재사용한다.
- auto refresh는 만들지 않는다.
- refresh 중 상태와 갱신된 `Refreshed {time}`을 제공한다.
- source 오류는 기존 list/summary error state로 처리한다.

#### 7-4. 데이터 범위

- 현재처럼 아무 근거 없이 고정 `Data boundary unverified`만 보여 주지 않는다.
- 먼저 기존 API/data-scope metadata와 `withAdminNotificationDataScope` caller를 확인한다.
- authoritative metadata가 있으면 `Operational data`, `Mixed data`, `Fixture data`를 동적으로 표시한다.
- authoritative 구분이 없다면 이름에 `Demo`나 `Audit`이 포함됐다는 휴리스틱으로 production/fixture를 추정하지 않는다.
- 이 경우 `Scope unverified · smoke/seed/fixture flags filtered`처럼 현재 보장 수준과 한계를 정확히 표시하고 상세 설명 또는 관련 setup/audit 링크를 제공한다.
- 검증 근거 없이 `Test data excluded`라고 쓰지 않는다.
- 완전한 경계 보장이 schema 변경 없이는 불가능하면 나머지 작업을 완료하고 이 항목만 정확한 blocker로 보고한다.

#### 7-5. 상태 기준 시점

- `App offline`은 `Push route: inactive`처럼 무엇의 상태인지 명시한다.
- current partner status는 `Partner now: available/busy/offline`처럼 현재 상태임을 명시한다.
- 79일 전 notification 시각과 현재 파트너 상태를 같은 시점의 정보처럼 보이게 하지 않는다.

#### 7-6. 검색과 숫자

- API 검색을 불필요하게 넓히기 전에 placeholder를 실제 지원 범위와 맞춘다.
- 현재 지원 범위가 ID와 수신자 이름이라면 `Notification ID, booking ID, recipient name or ID`로 수정한다.
- title/type 검색을 실제로 추가할 때만 그 문구를 사용한다.
- 모든 queue/group/record count에 기존 number formatter를 적용해 `75,160`처럼 표시한다.
- 0건 issue는 유지하되 성공/clear tone으로 시각적 비중을 낮춘다.

## 테스트 요구

기존 source-string 존재 검사보다 실제 URL, model, rendered markup, API predicate, server outcome을 검증하는 행동 테스트를 우선한다.

반드시 추가 또는 수정할 계약:

1. default failure groups selected state와 group 단위 count.
2. 서로 다른 group의 exact href와 active filter.
3. exact filter의 list/summary/total 일치.
4. failure code 분류별 서로 다른 owner/action/retry condition.
5. no-route 수신자 그룹 pagination과 notification count.
6. no-attempt current/history age 경계.
7. 이름 없는 Customer/Partner/Admin의 raw phone 비노출.
8. visible primary action과 secondary overflow 분리.
9. retry requested → enqueue → queued/failed/degraded audit 결과.
10. list error, summary error, empty, invalid filter, out-of-range redirect 회귀 방지.
11. legacy redirect와 permission guard 유지.

## 검증 명령

변경 전 관련 focused baseline을 실행하고, 변경 후 다시 실행한다. 새 spec 파일을 만들면 명령에 포함한다.

Admin Web:

```powershell
npm.cmd run test -w @massage-vn/admin-web -- app/notifications/page.spec.tsx app/notifications/notification-page-model.spec.ts app/notifications/notification-delivery-ops-queue-section.spec.tsx app/notifications/notifications-table-section.spec.tsx app/notifications/notification-action-confirmation.spec.ts app/notifications/actions.spec.ts
npm.cmd run typecheck -w @massage-vn/admin-web
npm.cmd run build -w @massage-vn/admin-web
```

Admin Web scoped lint:

```powershell
Set-Location apps/admin_web
npx.cmd eslint app/notifications/page.tsx app/notifications/notification-page-model.ts app/notifications/notification-table-row.tsx app/notifications/notifications-table-section.tsx app/notifications/notification-action-confirmation.ts app/notifications/actions.ts
Set-Location ../..
```

API:

```powershell
npm.cmd run test -w @massage-vn/api -- src/admin/admin-notification-production-data.spec.ts src/admin/admin-notification-retry-query.spec.ts src/admin/admin-notification-unattempted-query.spec.ts src/admin/admin-notification-device-health-query.spec.ts src/admin/admin-operator-category.guard.spec.ts src/notifications/notification-retry-audit.spec.ts src/notifications/notifications.service.spec.ts src/notifications/notifications.processor.spec.ts
npm.cmd run typecheck -w @massage-vn/api
```

보안과 scope:

```powershell
npm.cmd run security:admin-sensitive
npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api
```

명령이나 파일이 현재 저장소에 없으면 임의로 성공 처리하지 말고 존재하는 가장 가까운 focused spec을 실행하고 차이를 최종 보고한다. unrelated dirty worktree 실패는 명령, 첫 root cause, 이번 변경과의 관련성을 구분한다.

## 실제 브라우저 검증

현재 소스로 Admin Web build/runtime 정합성을 확인한 뒤 로그인된 in-app browser에서 검사한다.

안전 규칙:

- 3101 listener를 재기동해야 하면 PID, command line, working directory를 먼저 확인한다.
- 모든 `node.exe`를 종료하지 말고 정확히 확인된 Admin Web process만 다룬다.
- 실제 retry, push send, legacy review, 데이터 mutation을 실행하지 않는다.
- 현재 run에서 직접 캡처하고 과거 캡처를 최종 증거로 재사용하지 않는다.

필수 1440×900 캡처:

1. default Needs action와 selected `Failure groups`.
2. 서로 다른 두 failure group의 exact URL/active filter 중 하나.
3. failure group table의 전체 마지막 열.
4. no-route 수신자 그룹 큐와 두 count 단위.
5. no-attempt current/history 구분.
6. failed row의 visible `Review & retry`와 secondary menu.
7. retry confirmation을 열고 제출하지 않은 상태.
8. Delivery records 필터의 정상 Apply/Reset 배치.
9. 이름 없는 recipient의 masked identity를 안전한 fixture/unit render로 확인할 수 있으면 그 증거.

필수 1600×900 캡처:

1. failure groups table.
2. Delivery records 필터와 테이블.
3. light 또는 dark 중 변경 영향을 확인할 수 있는 상태. 다른 테마도 DOM/시각 검증한다.

각 화면에서 확인:

- page-level horizontal scroll 없음.
- 필터 버튼과 마지막 표 열 잘림 없음.
- selected mode/issue/group이 명확함.
- 주 동작이 ellipsis 없이 보임.
- keyboard focus가 action/menu/confirmation/cancel에서 합리적으로 이동함.
- full phone, raw token, full device ID가 DOM/accessible name에 없음.
- console error/warning 0. 개발 HMR 로그는 별도로 구분한다.

최종 캡처는 새 폴더에 저장한다.

`C:\dev\massage-on-demand-vn\output\notifications-improvement-verification-2026-08-08\`

## protected area

기본적으로 다음은 건드리지 않는다.

- Prisma schema/migrations
- auth/session contract
- payment/wallet/finance domain
- booking/matching state machine
- shared realtime event contract
- unrelated admin pages

정말 필요한 경우 먼저 caller와 영향 범위를 증명하고 최소 변경한다. protected area를 건드렸다면 해당 영역 전용 테스트와 위험을 최종 보고에 명시한다.

## 최종 완료 기준

다음이 모두 충족돼야 완료다.

- 기본 `/notifications`에서 `Failure groups · N groups`가 selected다.
- no-route 기본 큐는 수신자/경로 복구 단위이며 오래된 notification 반복 목록이 아니다.
- no-route에 recipient 수와 notification 수가 모두 보인다.
- no-attempt current SLA와 24h+ history가 구분된다.
- 서로 다른 failure group이 서로 다른 exact URL을 가진다.
- 선택 group의 list, total, summary가 같은 provider/failureCode를 뜻한다.
- credentials/project/token/unknown failure의 운영 안내와 owner가 서로 다르다.
- 이름 없는 수신자의 full phone이 visible HTML과 accessible name에 없다.
- enqueue 이전 requested audit과 queued/failed/degraded outcome을 correlation으로 추적할 수 있다.
- 이미 queued된 job을 audit 실패 때문에 `Nothing was queued`라고 오도하지 않는다.
- 1440과 1600에서 필터, failure code, 마지막 헤더, CTA가 잘리지 않는다.
- `Next action`의 주 동작이 메뉴 밖에 보인다.
- 현재 scope를 보존하는 manual Refresh가 동작한다.
- 데이터 범위 문구가 실제 보장 수준을 과장하지 않는다.
- 상태 문구가 push route와 partner current status를 구분한다.
- 숫자가 locale formatting으로 표시된다.
- 기존 retry confirmation, permission, legacy redirect, pagination, empty/error 상태가 유지된다.
- focused tests, typecheck, build, lint, security/scope verification 결과가 명시된다.
- 최종 캡처와 실행 화면이 현재 source/build와 일치한다.

일부 항목이 기술적으로 불가능해도 가능한 독립 항목을 모두 완료한다. 완료되지 않은 항목을 성공으로 포장하지 말고 blocker, 코드 근거, 안전한 최소 대안과 다음 한 단계를 보고한다.

## 최종 보고 형식

최종 답변은 다음 순서로 작성한다.

1. 운영자 관점에서 실제로 달라진 결과
2. P1/P2 요구별 완료·부분 완료·미완료 표
3. 변경 파일과 각 파일을 바꾼 이유
4. 데이터/query/URL/audit 계약의 핵심 before/after
5. 실행한 명령과 pass/fail/skipped 결과
6. 1440/1600 캡처 링크
7. 개인정보·권한·retry audit 검증 결과
8. protected area touched 여부
9. 남은 위험과 다음 권장 작업 하나

`개선 완료`라고만 쓰지 않는다. 다음과 같이 운영자가 재검증할 수 있는 구체적 증거를 포함한다.

- exact failure group URL 예시
- no-route recipient count와 notification count
- 이름 없는 recipient의 masked label/aria 결과
- retry audit correlation과 degraded outcome test
- 1440 필터와 마지막 열 캡처
- 실제 H1/mode/selected issue 상태

## 우선순위

1. 현재 운영 queue의 해결 단위와 시간 범위
2. exact failure scope와 원인별 올바른 조치
3. 개인정보와 retry/audit 안전성
4. 1440 레이아웃
5. 주 동작, Refresh, 상태/검색/숫자 문구
6. 데이터 경계의 가장 정확한 보장 수준

새 기능의 수가 아니라 **운영자가 지금 처리할 대상과 다음 행동을 정확히 알고, 개인정보 노출이나 중복 retry 없이 작업을 끝낼 수 있는지**를 성공 기준으로 삼는다.
