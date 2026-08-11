# Shift Handoff 개선용 Codex 실행 프롬프트

- 작성일: 2026-08-05
- 작업 저장소: `C:\dev\massage-on-demand-vn`
- 근거 보고서: `output/operations-handoff-audit-2026-08-05/operations-handoff-operator-audit.md`
- 목적: 감사 결과를 다시 해석하는 데 그치지 않고, Codex가 코드 수정·테스트·실제 화면 검증까지 한 작업에서 완료하도록 하는 실행 명세

## MASTER PROMPT

아래 내용을 새 Codex 작업에 그대로 붙여 넣는다.

```text
작업 위치는 C:\dev\massage-on-demand-vn 이다.

Operations Handoff 관리자 화면을 실제 운영자가 빠르고 안전하게 교대 인계할 수 있는 `Shift Handoff` workspace로 개선하라. 이번 작업은 추가 감사나 제안서 작성이 아니라 실제 코드 수정, 회귀 테스트, 로그인된 로컬 브라우저 검증, 검증 캡처 저장까지 완료하는 구현 작업이다.

핵심 결과는 다음과 같다.

- 사이드바에는 `Shift Handoff` 한 항목만 둔다.
- 한 workspace 안에 URL 기반 `Current`와 `Handoff history` 두 mode를 둔다.
- Current는 실제 전체 open case를 정확히 조회·선택·인계하고, 받은 인계를 확인하는 작업 화면이다.
- Handoff history는 실제 shift handoff 전송/확인 기록만 보여주는 읽기 화면이다.
- 일반 booking/customer/Partner/finance 활동 목록은 이 화면에서 제거하고 기존 Audit Log 및 각 도메인 전용 화면을 사용한다.
- create/acknowledge 실패, open-case API 실패, 잘못된 clear handoff가 운영자에게 숨겨지지 않게 한다.
- 1024px 이상 관리자 화면에서 중첩 세로 스크롤과 잘림 없이 사용할 수 있어야 한다.

계획만 제시하고 멈추지 말고 아래 순서와 완료 조건을 따라 구현하라.

## 1. 먼저 읽고 현재 동작을 추적하라

반드시 다음을 먼저 읽는다.

1. 저장소 루트의 `AGENTS.md`
2. `output/operations-handoff-audit-2026-08-05/operations-handoff-operator-audit.md`
3. 감사 캡처:
   - `01-operations-history-overview.png`
   - `02-history-detailed-activity.png`
   - `03-history-activity-table.png`
   - `04-current-handoff-form.png`
   - `05-current-handoff-1024.png`
   - `06-operations-history-1024.png`
   - `08-booking-history-count-mismatch.png`
4. 관련 Admin Web/API 코드와 테스트

작업 시작 시 `git status --short`로 기존 사용자 변경을 확인하고 보존한다. 수정하려는 함수와 component의 모든 caller를 `rg`로 먼저 찾는다. 한 route에서 드러난 증상만 덧대지 말고 count/row predicate, write error handling, permission validation의 실제 공통 원인을 고친다.

우선 확인할 파일은 다음과 같지만, 이름만 보고 전부 수정하지 말고 실제 import/caller를 추적한다.

Admin Web:

- `apps/admin_web/lib/admin-navigation.ts`
- `apps/admin_web/lib/admin-api.ts`
- `apps/admin_web/app/operations-handoff/page.tsx`
- `apps/admin_web/app/operations-handoff/actions.ts`
- `apps/admin_web/app/operations-handoff/operations-shift-handoff-form.tsx`
- `apps/admin_web/app/operations-handoff/operations-shift-handoff-section.tsx`
- `apps/admin_web/app/operations-handoff/operations-handoff-page-model.ts`
- `apps/admin_web/app/operations-handoff/operations-handoff-pagination.tsx`
- `apps/admin_web/app/operations-handoff/operations-handoff-activity-stream-section.tsx`
- `apps/admin_web/app/operations-handoff/operations-handoff-booking-queue-section.tsx`
- `apps/admin_web/app/operations-handoff/operations-handoff-customer-partner-section.tsx`
- `apps/admin_web/app/operations-handoff/operations-handoff-finance-*-section.tsx`
- `apps/admin_web/app/globals.css`
- 관련 `.spec.ts` / `.spec.tsx`

API:

- `apps/api/src/admin/admin-governance.routes.ts`
- `apps/api/src/admin/admin.service.ts`
- `apps/api/src/admin/admin-start-shift-open-cases.ts`
- 관련 route/service 테스트

## 2. 고정 제품 결정

아래 결정은 구현 중 다시 되돌리거나 임의로 다른 구조로 바꾸지 않는다.

1. 두 데이터 mode는 유지하지만 두 개의 사이드바 페이지는 만들지 않는다.
2. 사이드바에는 `Shift Handoff` 하나만 표시하고 기본 목적지는 `/operations-handoff?view=handoff`로 한다.
3. 페이지 title은 두 mode 모두 `Shift Handoff`다.
4. 상단에 URL을 사용하는 peer navigation을 둔다.
   - Current: `/operations-handoff?view=handoff`
   - Handoff history: `/operations-handoff`
5. 기존 URL과 bookmark는 계속 동작해야 한다. 새 route나 redirect migration을 만들지 않는다.
6. mode 전환은 실제 링크로 구현하고 현재 링크에 `aria-current="page"`를 제공한다. URL navigation인데 가짜 ARIA tab widget으로 만들지 않는다.
7. Current mode는 History payload를 요청하지 않는다.
8. History mode는 Current open-case payload를 요청하지 않는다.
9. Current의 섹션 순서는 `Assigned to me` → `Waiting for others` → `Create handoff`다.
10. `Assigned to me`는 현재 operator가 incoming인 미확인 handoff다.
11. `Waiting for others`는 현재 operator가 보냈고 아직 확인되지 않은 handoff다.
12. Handoff history는 shift handoff create/acknowledgement 기록만 표시한다.
13. 일반 operations event, booking, customer, Partner, finance history를 이 페이지에 다시 만들지 않는다. 기존 Audit Log와 도메인별 화면을 사용한다.
14. incoming operator는 현재 operator 자신이 아닌 active operator여야 하고, 선택한 case category를 처리할 권한이 있어야 한다.
15. UI 문구는 기존 관리자 웹 기준에 맞춰 영어로 작성한다. 사용자 노출 문구에서 `Provider` 대신 `Partner`를 사용한다.
16. 새 UI/state/date library, 새 범용 framework, 새 DB table/schema/migration을 추가하지 않는다.
17. 기존 Admin/Vuexy component, token, 날짜/시간 helper, action notice pattern, permission model을 재사용한다.
18. Customer/Partner 앱과 무관한 booking/payment 비즈니스 규칙은 수정하지 않는다.

## 3. 목표 정보 구조

다음보다 더 많은 상위 섹션을 추가하지 않는다.

Shift Handoff
├─ Current
│  ├─ Assigned to me
│  ├─ Waiting for others
│  └─ Create handoff
└─ Handoff history
   ├─ Handoff date range
   ├─ Operator/status/case filters
   └─ Paginated handoff records

상단 권장 문구:

- Title: `Shift Handoff`
- Description: `Transfer unresolved work to the next operator and confirm receipt.`
- Mode links: `Current`, `Handoff history`

페이지 title과 section title을 같은 문구로 연속 반복하지 않는다. `Shift command`, `Current handoff`, `View completed handoffs` 같은 경쟁 CTA를 여러 개 나열하지 않는다. 다른 운영 화면이 꼭 필요하면 기존 navigation이나 의미가 명확한 보조 링크 하나만 사용한다.

## 4. P0 — 데이터 신뢰와 안전성

### 4.1 실제 전체 open case source

현재 form은 start-shift summary의 `nextCases` teaser를 재사용하며, API는 queue별 current/overdue/legacy case를 각각 최대 3개만 내려준다. 이 데이터를 인계 form의 전체 source로 사용하지 않는다.

기존 `adminStartShiftOpenCaseCtes`와 `action_items` CTE를 재사용하여 operations handoff용 paginated open-case 조회를 추가하거나 기존 governance endpoint를 최소 확장한다. 별도 service 계층이나 새 framework를 만들지 않는다.

권장 API 형태:

`GET /admin/operations-handoff/open-cases`

지원 query:

- `page`
- `pageSize` — 기본 25
- `q` — case ID 또는 기존 안전한 검색 대상
- `queue`
- `age`

최소 row 사실:

- `caseId`
- `queueKey`
- 운영자용 queue label
- `occurredAt`
- 계산 가능한 age
- `slaMinutes`
- overdue 여부
- 의미 있는 queue인 경우 amount/currency
- detail URL
- 현재 owner가 있으면 owner
- 현재 상태

필수 조건:

- `totalRows`와 반환 row는 정확히 같은 predicate를 사용한다.
- 검색과 filter는 받아 온 한 페이지를 client에서 다시 거르는 방식이 아니라 server predicate에 적용한다.
- 기본 sort는 priority 후 oldest이며 tie-breaker가 안정적이어야 한다.
- page 범위를 벗어나면 안전하게 보정한다.
- full ID와 `queueKey`로 case를 구분한다. 서로 다른 queue에서 같은 짧은 ID가 충돌하지 않게 한다.
- start-shift dashboard의 3개 teaser 동작은 필요하면 그대로 유지하되 handoff form과 분리한다.

### 4.2 loading, empty, filtered-empty, error를 분리

open-case fetch에 fallback `null`을 사용해 실패를 0건처럼 보이지 않게 한다. 기존 `adminGetResult` 또는 저장소의 동등한 result pattern을 재사용한다.

상태별 문구:

- 실제 전체 queue 0건: `No open cases are waiting for handoff.`
- 검색/filter 결과 0건: `No open cases match this search.`
- API 실패: `Open cases could not be loaded. Retry before sending a handoff.`
- loading: 기존 Admin loading pattern

API 실패 시 preview/send를 차단하고 Retry를 제공한다. 비활성 버튼만 두지 말고 차단 이유를 화면에 적는다.

### 4.3 create/acknowledge의 조용한 실패 제거

`actions.ts`의 create/acknowledge가 `adminPost(..., null)`로 non-2xx, network, permission 오류를 삼키지 않게 한다. 기존 `adminPostOrThrow`와 server action notice/action-state pattern을 사용한다. generic `adminPost` 전체 동작을 바꿔 다른 caller에 회귀를 만들지 말고, 공통 원인이 정말 generic helper에 있을 때만 모든 caller를 확인한 뒤 수정한다.

필수 동작:

- submit 중 중복 create/acknowledge 차단
- 버튼 pending 상태
- 성공/오류 결과를 화면의 accessible live region에 전달
- 성공 후 필요한 데이터만 refresh/revalidate
- 실패 시 입력과 선택을 보존해 재시도 가능

정확한 기본 문구:

- create success: `Handoff sent to {operator}.`
- acknowledge success: `Handoff acknowledged at {time}.`
- conflict: `This handoff was already acknowledged.`
- stale cases: `Some selected cases are no longer open. Review the list and try again.`
- permission: `You do not have permission to send or acknowledge this handoff.`

서버의 permission, validation, audit log, acknowledgement idempotency를 느슨하게 하지 않는다.

### 4.4 잘못된 Clear handoff 방지

선택된 case가 0개라는 client 사실만으로 `Clear handoff`라고 표시하거나 보낼 수 없어야 한다.

- server가 같은 open-case predicate로 현재 open count 0을 다시 확인한 경우에만 clear handoff를 허용한다.
- open count가 1개 이상이고 선택이 0이면 preview와 send를 막는다.
- 차단 문구: `Select at least one open case, or resolve the queue before sending a clear handoff.`
- 일부만 선택하면 `3 selected · 12 remain open`처럼 선택 수와 남은 수를 함께 표시한다.
- clear handoff audit metadata에는 server가 확인한 `No open cases at handoff time` 사실을 남긴다.
- preview와 최종 submit 사이 case가 해결되거나 새 case가 생긴 race를 서버에서 검증하고, stale 상태를 정확한 오류로 반환한다.

### 4.5 operator identity와 eligibility

현재의 최근 50명 role-lumped directory와 `Local Admin Web Actor` 같은 generic identity를 그대로 쓰지 않는다.

- 현재 outgoing operator는 인증된 실제 admin identity에서 구한다.
- active operator만 선택 가능하게 한다.
- inactive/revoked operator를 제외한다.
- 현재 operator 자신은 incoming option에서 제외하고 서버에서도 self-handoff를 거부한다.
- option의 primary label은 `Full name · Role · email`이고 전화번호는 보조 정보다.
- 이름 없는 계정은 email 등 기존 안전한 식별자를 사용하되 전화번호만 primary label로 만들지 않는다.
- 기존 operator directory endpoint를 필요한 만큼 최소 확장한다. 별도 operator service를 만들지 않는다.
- selected case별 required permission category와 incoming operator의 category permission을 기존 permission model로 비교한다.
- 하나라도 처리 권한이 없는 case가 있으면 create를 전체 차단하고 해당 queue/category를 알 수 있는 오류를 반환한다.
- 권한 category를 추측하거나 role 이름만으로 허용하지 않는다.

검색 가능한 기존 combobox component가 있으면 재사용한다. 없다면 native 입력과 기존 목록/filter만으로 가장 작은 접근 가능한 구현을 사용하고 새 dependency를 추가하지 않는다.

### 4.6 Handoff history의 정확한 범위와 pagination

기존 shift handoff history 응답을 다음 조건으로 최소 확장한다.

권장 API 형태:

`GET /admin/operations-handoff/shift`

지원 query:

- `range`
- `page`
- `pageSize` — 기본 25
- `status` — all/acknowledged/waiting
- `operator` — outgoing 또는 incoming 검색/선택
- `q` — case ID 또는 shift label

필수 조건:

- 날짜 범위의 기준은 handoff `createdAt`이며 UI label은 `Handoff date`다.
- `acknowledgedAt`은 별도 열/사실로 표시한다.
- total count와 rows가 같은 range/filter predicate를 사용한다.
- pagination은 서버에서 수행한다.
- legacy audit metadata도 읽는다.
- page size 3을 사용하지 않는다.

현재 `unresolvedCaseIds: string[]` metadata는 DB schema 변경 없이 `{ caseId, queueKey }[]` 형태를 지원하도록 확장할 수 있다. 새 기록에는 링크 복원이 가능한 structured 항목을 저장하고, 기존 string array 기록도 계속 파싱한다. 기존 감사 기록을 마이그레이션하거나 덮어쓰지 않는다.

### 4.7 History에서 중복 operations 목록 제거

다음 generic section은 Handoff history에서 렌더링하거나 요청하지 않는다.

- unresolved activity stream / Needs review
- booking history queue
- customer history
- current Partner attention snapshot
- finance closeout/decision history
- 여러 독립 pagination
- `Export visible rows`

이 제거로 0 rows/348 total booking 모순을 사용자 화면에서 없앤다. 해당 model/component가 이 route에서만 쓰이고 import가 완전히 사라졌다면 관련 dead code와 테스트를 삭제할 수 있다. 다른 route/shared caller가 있으면 삭제하지 않는다. 삭제 전 반드시 `rg`로 caller를 확인한다.

일반 활동 이력이 필요하면 기존 Audit Log로 가는 명확한 보조 링크를 사용한다. Audit Log가 이미 action key query를 지원하면 shift handoff filter를 링크에 포함할 수 있다. 지원하지 않으면 이번 작업에서 새 saved-view framework를 만들지 않는다.

## 5. P1 — 운영 흐름과 화면 구성

### 5.1 Current의 작업 순서

첫 화면을 다음 순서로 배치한다.

1. `Assigned to me`
2. `Waiting for others`
3. `Create handoff`

`Assigned to me` 각 항목에는 최소한 다음을 보여준다.

- outgoing operator
- sent time/age
- shift label
- case count와 case 링크
- handoff note
- default owner
- `Acknowledge handoff` action

`Waiting for others` 각 항목에는 최소한 다음을 보여준다.

- incoming operator
- sent time/age
- shift label
- case count
- `Waiting for {operator}` 상태
- 상세 보기

0건 badge는 green success로 과장하지 않고 neutral하게 표현한다. 현재 operator와 관계없는 모든 팀 handoff를 기본 화면에 섞지 않는다.

### 5.2 Create handoff form

권장 문구:

- Section: `Create handoff`
- Description: `Choose who receives the shift and which open cases need follow-up.`
- `Handoff label` → `Shift label`
- `Case owner` → `Default case owner`
- `Unresolved open cases` → `Cases to hand over`
- `Next action note` → `Handoff note`
- Preview: `Preview handoff`
- Send: `Send to {operator}`

Shift label:

- 로컬 운영 시간대와 기존 날짜 helper로 `5 Aug 2026 · Evening handoff` 같은 기본값을 자동 생성한다.
- 실제 shift schedule/domain 값이 이미 있으면 그것을 재사용한다.
- 자동값은 수정 가능하게 유지한다.
- 새 shift scheduling abstraction을 만들지 않는다.

Incoming operator와 owner:

- incoming operator 선택 시 `Default case owner`도 같은 operator로 설정한다.
- 기본 form에서는 별도 owner field를 반복 노출하지 않는다.
- `Assign a different owner` 같은 advanced disclosure를 열었을 때만 override한다.
- override operator도 동일한 active/permission 검증을 통과해야 한다.

Case 선택은 native multiple select 대신 checkbox table/checklist로 구현한다.

권장 열:

- Select
- Queue
- Case
- Age / SLA
- Amount
- Current state
- Owner
- Open

행 action은 generic `Open`이 아니라 대상에 맞게 `Open booking`, `Open payment`, `Open audit record`처럼 구체적으로 쓴다. checkbox는 label과 연결되고 keyboard로 개별 선택 가능해야 한다. `Select visible`은 현재 server page/filter에 보이는 항목만 선택하며 scope를 문구로 밝힌다. 숨은 페이지 전체 선택 기능은 새로 만들지 않는다.

검색/queue/age filter 변경 시 page를 1로 되돌린다. 기본 sort는 priority 후 oldest다. full case ID는 접근 가능하게 유지하고 짧은 표시는 프로젝트의 기존 ID helper를 재사용한다.

### 5.3 Preview

기존 preview 단계를 유지하고 다음 사실을 한 번에 확인할 수 있게 한다.

- outgoing operator
- incoming operator
- shift label
- selected cases와 queue
- selected count와 remaining open count
- default owner/override
- handoff note
- clear handoff 여부와 서버 확인 상태

preview에서 edit으로 돌아가도 입력/선택이 유지되어야 한다. preview 자체가 create mutation을 실행하지 않는다.

### 5.4 Handoff history table

Handoff history는 table 하나로 구성한다.

열:

- Sent at
- Shift
- Outgoing
- Incoming
- Cases
- Owner
- Status
- Acknowledged at
- Open

필터:

- Handoff date range
- outgoing/incoming operator
- `Acknowledged` / `Waiting`
- case ID 또는 shift label 검색
- Reset filters

상세는 기존 component pattern에 맞는 expanded row 또는 상세 영역을 사용한다. 이 기능 하나를 위해 새 drawer framework를 만들지 않는다.

상세 최소 사실:

- case별 queue와 direct link
- handoff note
- acknowledgement actor/time
- audit record link
- legacy metadata일 때 확인 가능한 사실과 `Not recorded` 상태

status는 색상 외에 `Waiting` 또는 `Acknowledged` 텍스트를 제공한다. 모든 반복 action을 generic `Open`으로 쓰지 않는다.

## 6. P2 — 반응형, 문구, 접근성

### 6.1 중첩 scroll 제거

현재 `globals.css`에서 `.operations-handoff-page > .card` 전체에 max-height와 `overflow-y: auto`를 주는 규칙을 제거하거나 route 전용 scope를 최소 수정한다.

- form, empty state, compact summary card는 자연스러운 page flow를 사용한다.
- page 자체가 세로 scroll한다.
- 긴 table만 기존 `AdminTableScroll` 또는 동등한 scoped horizontal scroll을 사용한다.
- card 내부 세로 scroll과 table 내부 세로 scroll을 겹치지 않는다.
- toolbar의 status/action은 1024px에서 wrap하며 잘리지 않는다.
- CSS로 해결할 수 있는 반응형 문제에 JS viewport listener를 추가하지 않는다.
- 의미 있는 table은 필요할 때만 내부 가로 scroll을 허용하고 accessible name을 제공한다.

검증 viewport:

- 1024×768
- 1280×720
- 1440×900

세 viewport에서 page/sidebar/card/table의 중첩 세로 scrollbar, 잘린 status/action, 본문 전체의 불필요한 가로 scroll이 없어야 한다.

### 6.2 정확한 상태 문구

다음 구분을 유지한다.

- true empty와 filtered empty
- loading과 error
- waiting과 acknowledged
- selected와 remain open
- current operator에게 온 인계와 내가 보낸 인계
- current metadata와 legacy/not-recorded metadata

`No matching open cases` 하나로 모든 상태를 덮지 않는다. timezone은 저장소의 shared convention을 사용하고, 운영자에게 날짜 기준을 보여줘야 한다면 `Asia/Ho_Chi_Minh` 기준임을 기존 형식으로 명확히 한다.

### 6.3 접근성

- URL mode navigation에 labelled navigation과 `aria-current` 제공
- checkbox와 행 label 연결, Space로 선택 가능
- 모든 form error를 field/context와 연결
- create/acknowledge 결과를 `aria-live` 영역에 전달
- disabled button 주변에 disabled reason 표시
- icon-only action에 accessible name 제공
- focus indicator 유지
- status/SLA를 색상만으로 전달하지 않음
- 반복 링크 이름을 목적지별로 구분
- table/scroll region에 accessible name 제공
- 200% browser zoom에서도 핵심 작업 가능
- Tab/Shift+Tab 순서가 mode → queue → form → action 흐름을 크게 방해하지 않음

## 7. 반드시 유지할 기존 구현

다음은 회귀시키지 않는다.

- `view=handoff` branch가 History payload를 불러오지 않는 조건부 loading
- History에서 final write action을 직접 제공하지 않는 원칙
- send 전 preview
- assigned incoming operator만 acknowledgement할 수 있는 API 검사
- acknowledgement 중복 방지/idempotency
- create/acknowledgement audit log
- server filtering/pagination 방향
- Admin auth/permission 경계
- shared Admin component와 Vuexy token
- heading, region, semantic table 구조
- 개인정보 masking과 기존 보안 규칙

## 8. 구현 원칙과 범위 제한

- 먼저 삭제/재사용 가능성을 찾고 필요한 최소 diff로 구현한다.
- 한 화면만 위한 새 repository/service/interface/factory를 만들지 않는다.
- 기존 helper가 있으면 재사용한다.
- 새 dependency를 추가하지 않는다.
- DB migration/schema 변경을 하지 않는다.
- client-side 재필터링으로 server total과 다른 목록을 만들지 않는다.
- 결측 데이터를 거짓 기본값으로 채우지 않는다.
- 권한 category, case 상태, acknowledgement actor를 추측하지 않는다.
- generic admin API helper를 바꿀 때는 모든 caller를 확인한다.
- unrelated refactor, 대규모 파일명 변경, 디자인 시스템 교체를 하지 않는다.
- dead code 삭제는 해당 operations-handoff route 외 caller가 없을 때만 한다.
- 소스 파일의 기존 사용자 변경을 되돌리지 않는다.
- 테스트를 통과시키기 위해 permission, validation, audit, idempotency를 약화하지 않는다.

## 9. 최소 회귀 테스트

기존 테스트 구조를 재사용하고 아래 위험을 잡는 집중 테스트를 추가/수정한다. 무의미한 대량 snapshot은 만들지 않는다.

Admin Web:

1. navigation에는 `Shift Handoff` 한 항목만 있고 `Current Handoff`와 `Operations History`가 중복되지 않는다.
2. 기존 두 URL이 각각 Current/History mode를 정확히 연다.
3. Current는 history/generic activity payload를 요청하지 않는다.
4. History는 open-case/current queue payload를 요청하지 않는다.
5. page title, description, mode link, `aria-current`가 요구와 일치한다.
6. Current 순서가 Assigned to me → Waiting for others → Create handoff다.
7. current operator 기준으로 받은 인계와 보낸 인계를 정확히 그룹화한다.
8. open-case loading/true empty/filtered empty/error가 서로 다른 문구와 동작을 가진다.
9. API error에서는 preview/send가 차단되고 Retry가 보인다.
10. 전체 open case가 있는데 선택 0이면 clear handoff가 차단된다.
11. server 확인 open count 0일 때만 clear preview가 가능하다.
12. partial selection은 selected/remaining count를 표시한다.
13. incoming 선택 시 owner가 기본값으로 동기화되고 advanced override가 동작한다.
14. inactive/self/ineligible operator를 선택할 수 없거나 create가 거부된다.
15. checkbox table의 filter/pagination/selection scope가 정확하다.
16. create/acknowledge success, network/non-2xx, conflict, stale, permission, pending 상태가 보인다.
17. 실패 후 form 입력과 case 선택이 보존된다.
18. History는 handoff table 하나만 렌더링하고 generic activity/booking/customer/Partner/finance 목록을 렌더링하지 않는다.
19. History filter 변경 시 page 1, reset 시 관련 query 정리, 한 페이지면 pagination 숨김.
20. legacy string metadata와 structured case metadata가 모두 표시된다.
21. generic `Open` 반복 대신 목적지가 구체적인 링크 이름을 사용한다.
22. 관련 CSS 테스트 pattern이 있으면 operations-handoff card의 강제 세로 scroll 제거와 toolbar wrap을 검증한다.

API:

1. 각 queue의 첫 3개를 넘는 open case도 결과와 total에 포함된다.
2. open-case rows와 total이 같은 predicate를 사용한다.
3. `q`, queue, age filter와 page/pageSize가 server-side로 동작한다.
4. priority 후 oldest sort와 tie-breaker가 안정적이다.
5. 현재 resolved/stale case는 create 직전에 거부된다.
6. 선택 0의 clear handoff는 server open count 0일 때만 허용된다.
7. active operator만 허용되고 self-handoff가 거부된다.
8. selected queue의 category permission이 없는 incoming operator는 거부된다.
9. create/acknowledge 오류가 정확한 status/error로 전달된다.
10. assigned incoming operator만 acknowledge할 수 있다.
11. acknowledgement idempotency/conflict와 기존 audit log가 유지된다.
12. Handoff history range/page/status/operator/search가 rows와 total에 동일하게 적용된다.
13. history date는 createdAt 기준이고 acknowledgedAt은 별도 사실이다.
14. legacy `string[]` case metadata와 새 `{caseId, queueKey}[]` metadata가 모두 파싱된다.
15. start-shift summary teaser와 다른 admin route에 회귀가 없다.

모든 항목을 별도 테스트 파일 하나씩 만들 필요는 없다. 기존 가까운 spec에 가장 작은 사례를 추가하되, P0 분기와 API trust boundary는 실제 회귀 테스트로 남긴다.

## 10. 검증 명령

Windows PowerShell 기준으로 실제 `package.json` script를 확인한 다음 다음을 실행한다.

```powershell
npm.cmd run test --workspace @massage-vn/admin-web
npm.cmd run test --workspace @massage-vn/api
npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api
```

보호 경로 또는 shared behavior를 수정했거나 `AGENTS.md`가 요구하면 다음도 실행한다.

```powershell
npm.cmd run verify:local
```

명령이 실제 script와 다르면 임의로 건너뛰지 말고 `package.json`에서 대응 명령을 찾아 실행한다. 실패가 기존 실패인지 이번 변경 때문인지 분리해 기록한다. 테스트만 통과시키고 브라우저 검증을 생략하지 않는다.

## 11. 실제 브라우저 검증

로그인된 로컬 관리자 웹에서 다음 URL을 직접 확인한다.

- `http://localhost:3101/operations-handoff?view=handoff`
- `http://localhost:3101/operations-handoff`

최소 viewport:

- 1024×768
- 1280×720
- 1440×900

안전하게 확인할 상태:

1. Current 기본 화면과 섹션 순서
2. open case가 25건을 넘는 상태의 pagination/search/filter
3. true empty와 filtered empty
4. API error는 fixture/test로 증명하고 가능하면 로컬 안전 mock 상태도 확인
5. open case가 있는데 선택 0인 차단 상태
6. partial selection의 selected/remain 표시
7. 실제 0건에서 clear handoff preview
8. incoming 선택 → default owner 자동 설정 → advanced override
9. preview에서 operator/case/note/count 확인
10. Assigned to me와 Waiting for others의 서로 다른 상태
11. Handoff history의 7일/30일 등 기존 지원 range, Waiting/Acknowledged filter, case 검색
12. legacy metadata record 표시
13. 두 mode 사이 이동 시 URL과 `aria-current`
14. 세 viewport에서 status/action 잘림, nested vertical scroll, page 전체 가로 scroll 없음
15. keyboard focus/checkbox 및 200% zoom
16. 브라우저 console error 없음

검증 캡처는 다음 새 폴더에 저장한다.

`C:\dev\massage-on-demand-vn\output\operations-handoff-improvement-verification-YYYY-MM-DD\`

기존 감사 캡처를 덮어쓰지 않는다. 검증 때문에 공유/운영 데이터에 임의 handoff를 생성하거나 acknowledgement하지 않는다. local seed/fixture 환경에서 side effect가 안전하다고 명확히 확인된 경우에만 create/acknowledge를 실제 수행하고, 그렇지 않으면 mutation 상태는 집중 테스트로 검증한다.

## 12. 완료 조건

다음을 모두 만족할 때만 완료로 보고한다.

- 사이드바에 `Shift Handoff` 하나만 보인다.
- Current와 Handoff history를 상단에서 직접 전환할 수 있다.
- 기존 두 URL이 계속 동작한다.
- mode별 조건부 데이터 loading이 유지된다.
- Current open-case 목록이 3개 teaser가 아니라 전체 server-side queue를 paginate/search한다.
- open case rows와 total이 같은 predicate를 사용한다.
- API failure와 실제 0건이 다르게 보인다.
- open case가 남아 있으면 clear handoff를 보낼 수 없다.
- incoming operator가 active, non-self, category-eligible인지 서버가 검증한다.
- 실제 current admin identity가 outgoing으로 보인다.
- create/acknowledge success와 error가 명시적으로 보인다.
- duplicate submit이 차단된다.
- Current가 Assigned to me → Waiting for others → Create handoff 순서다.
- native multiple select가 접근 가능한 checkbox table/checklist로 교체됐다.
- incoming operator가 default owner가 되고 override는 advanced option이다.
- Shift label 기본값이 자동 생성되고 수정 가능하다.
- Handoff history는 실제 handoff record table 하나만 보여준다.
- History range/filter가 rows와 total에 동일하게 적용된다.
- legacy와 structured case metadata가 모두 동작한다.
- page size 3이 제거되고 기본 25다.
- generic booking/customer/Partner/finance/current activity 목록이 Handoff history에서 제거됐다.
- 0 rows와 양수 total의 모순이 이 workspace에 없다.
- 1024×768에서 status, form, action이 잘리지 않는다.
- card/table/page 중첩 세로 scroll이 없다.
- keyboard와 200% zoom에서 핵심 작업이 가능하다.
- 새 dependency와 DB migration이 없다.
- 관련 Admin Web/API 테스트와 저장소 검증이 통과한다.
- 검증 캡처가 새 폴더에 저장됐다.

## 13. 완료 후 보고 형식

한국어로 다음 순서만 구체적으로 보고한다.

1. 변경 결과 요약
2. 운영자가 체감하는 변화
3. 고정한 데이터 기준
   - open-case predicate와 sort
   - clear handoff 조건
   - operator eligibility
   - history date/filter 기준
4. 변경한 파일과 삭제한 dead code
5. 실행한 테스트/검증 명령과 결과
6. 브라우저 검증 viewport/상태와 캡처 경로
7. `AGENTS.md` 보호 영역 수정 여부
8. 남은 위험, 확인하지 못한 상태, 다음 권장 작업 한 가지

`완료`라고만 쓰지 말고 각 P0 요구사항이 어떤 코드와 테스트로 충족됐는지 추적 가능하게 작성한다. 범위 밖 장기 개선이나 새 기능을 구현하지 말고, 정말 필요한 후속 사항만 마지막에 한 줄로 기록한다.
```

## 사용 방법

1. 새 Codex 작업을 `C:\dev\massage-on-demand-vn`에서 시작한다.
2. 위 `MASTER PROMPT` 전체를 붙여 넣는다.
3. Codex가 계획이나 추가 보고서만 작성하고 멈추면 다음 문장을 이어서 보낸다.

```text
계획을 승인한다. 추가 감사 문서를 만들지 말고 현재 작업에서 코드 수정, 집중 테스트, 저장소 검증, 실제 브라우저 확인과 캡처 저장까지 완료하라. 완료 조건을 충족하지 못한 항목은 성공으로 표현하지 말고 정확한 blocker와 증거를 보고하라.
```

4. 작업 완료 후 최종 보고에서 테스트 결과, 보호 영역, 캡처 폴더, 미검증 상태를 확인한다.

## 이 프롬프트가 의도적으로 제외한 것

- 새로운 Operations Timeline 페이지
- Audit Log용 새 saved-view framework
- 새 디자인 시스템 또는 UI dependency
- 새 shift scheduling 시스템
- DB schema/table/migration
- 모든 case를 한 번에 선택하는 위험한 cross-page selection
- Customer/Partner 앱 또는 무관한 booking/payment 규칙 변경

기존 route, audit metadata, open-case CTE, Admin component와 permission model로 해결하는 것이 이번 작업의 최소 범위다.
