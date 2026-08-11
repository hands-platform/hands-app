# Codex Master Prompt — HANDS Admin Deep Remediation

이 파일은 저장소 영구 지침이 아니라 **한 번의 구현 작업에 그대로 붙여 넣는 task prompt**다. `AGENTS.md`에 복사하거나 deprecated custom prompt로 설치하지 않는다.

---

당신은 HANDS 관리자 웹의 심층 재감사 결과를 코드에 반영하는 단일 Codex 구현자다. 화면 장식보다 운영 데이터의 정확성, 개인정보 보호, 실제 업무 흐름을 우선한다.

작업 위치:

```text
C:\dev\massage-on-demand-vn
```

다른 유사 폴더나 오래된 workspace를 사용하지 마라.

## 목표

현재 HANDS Admin을 다음 조건을 만족하는 신뢰 가능한 운영 콘솔로 수정하라.

1. Dashboard의 queue count와 CTA가 연 실제 사례 목록이 일치한다.
2. API 장애와 정상 0건이 명확히 다르다.
3. Customer Directory와 기본 export에 전체 전화번호가 노출되지 않는다.
4. Current/Overdue/Legacy/Test 데이터 범위가 섞이지 않는다.
5. Notification, Finance, Handoff와 Customer 화면이 실제 운영자 판단 순서에 맞는다.
6. 1024px에서도 핵심 작업을 읽고 조작할 수 있다.
7. 기존 권한·감사·금전·지갑·예약 보호 계약을 유지한다.

핵심 흐름:

```text
Queue count → Linked cases → Evidence → Action → Audit → Handoff
```

## 먼저 읽을 문서

다음 파일을 순서대로 읽고 현재 코드와 대조하라.

1. `AGENTS.md`
2. `docs/agent/HANDS_CODEX_WORKFLOW_GUARD.md`
3. `docs/admin-operator-deep-remediation-criteria.md`
4. `output/admin-operator-deep-reaudit-2026-08-05/admin-operator-ux-deep-reaudit.md`
5. `docs/admin-ux-implementation-progress.md`
6. `docs/admin-operator-redesign-requirements.md`
7. `docs/architecture/admin-vuexy-design-system.md`

현재 화면 증거:

```text
output/admin-operator-deep-reaudit-2026-08-05/
```

`docs/admin-operator-deep-remediation-criteria.md`의 DRA 수용 기준을 구현 완료의 기준으로 사용하라. 기존 progress 문서가 `COMPLETE`라고 해도 이번 current-run 증거와 실제 코드가 반대를 증명하면 회귀로 처리하라.

## 현재 확인된 P0 사실

2026-08-05 읽기 전용 진단에서 다음이 확인됐다.

```text
Booking total:                    2,966
SQL production Booking:          2,954
Prisma production Booking:       0
Dashboard open refunds:          112
Linked Refund list:              0
SQL unresolved notifications:    410
Linked Notification list:        0
```

이 숫자는 현재 데이터의 증거이며 테스트 상수가 아니다. 같은 시점·필터에서 집계와 목록이 일치하게 만드는 것이 목표다.

우선 조사할 코드:

```text
apps/api/src/admin/admin-booking-list-query.ts:116-132
apps/api/src/admin/admin-booking-list-query.spec.ts:18-27
apps/api/src/admin/admin.service.ts:4798-4817
apps/api/src/admin/admin.service.ts:5316
apps/api/src/admin/admin.service.ts:5331
apps/api/src/admin/admin.service.ts:40654-40705
apps/admin_web/lib/admin-api.ts:5473-5496
apps/admin_web/app/reviews/page.tsx
apps/admin_web/app/customers/customers-table-section.tsx:57
apps/admin_web/app/customers/customer-list-model.ts:164-165
```

가장 유력한 root cause는 nullable JSON path를 포함한 `NOT: { OR: [...] }`와 `string_contains: ''`다. 이 가설을 실제 generated query/PostgreSQL 동작으로 검증한 뒤 공통 helper에서 고쳐라. 화면별 예외 조건으로 증상을 가리지 마라.

## 작업 규칙

- 저장소 지침에 따라 sub-agent를 사용하지 않는다.
- 가능하면 `impeccable`, `product-design:audit`, 로그인된 in-app browser를 사용한다. 해당 skill/tool이 없으면 현재 코드·DOM·screenshot 검증으로 계속한다.
- 시작 시 `git status --short`를 확인한다.
- 기존 dirty worktree는 사용자 소유다. reset, checkout, restore, clean으로 제거하지 않는다.
- 관련 caller와 기존 helper/pattern을 먼저 찾는다.
- 가장 높은 공통 지점의 최소 root-cause fix를 선택한다.
- 한 slice는 일반적으로 3~8개 파일로 제한한다.
- 새 의존성을 추가하지 않는다.
- schema migration 없이 해결 가능한 문제에 schema를 추가하지 않는다.
- `globals.css` 전체 재작성이나 관리자 웹 전면 리팩터링을 하지 않는다.
- 실제 환불, 승인, 지급, 지갑, 노쇼, 정책 변경을 브라우저에서 제출하지 않는다.
- DB 진단은 read-only aggregate/count만 사용하고 PII나 실제 ID를 출력하지 않는다.
- 커밋은 사용자가 명시적으로 요청하지 않으면 만들지 않는다.
- 한 번에 하나의 slice만 `in_progress`로 둔다.

## 보호해야 하는 기존 동작

- `ADM-001~ADM-029`의 권한, 감사, 지갑, 예약 목록 개인정보, 위험 행동 보호
- `RA-001~RA-011`에서 실제로 유지되는 개선
- Partner 명칭과 기존 Vuexy/Public Sans 디자인 언어
- role/category route guard
- read-first Customer Detail
- maker/checker와 idempotency
- Operations History의 읽기 전용 성격
- Partner Approval의 전용 0건 empty state
- Finance Today와 Current Backlog의 workspace 분리

## 실행 프로그램

전체 DRA 프로그램을 순차적으로 완료하라. 각 slice는 focused tests와 현재 화면 검증까지 끝낸 뒤 다음 slice로 진행한다. 보호 영역 변경, schema migration, 파괴적 작업 또는 제품 결정을 사용자에게 받아야만 하는 경우에만 멈추고 정확한 blocker를 보고하라.

### Slice A1 — DRA-001 production-data root cause

목표:

- Booking과 Notification의 Prisma production-data 조건을 null-safe하게 수정한다.
- `string_contains: ''`를 제거한다.
- raw SQL과 Prisma의 fixture 정의를 통일한다.
- 모든 caller를 확인하고 공통 helper 한 곳에서 수정한다.
- Refund/Notification/Booking 목록이 실제 production rows를 반환하게 한다.

필수 검증:

- fixture key missing/null/boolean/string, smoke/seed ID와 정상 row를 검증한다.
- 기존 unit test의 객체 shape만 맞추지 말고 PostgreSQL JSON-null 의미를 확인하는 작은 runnable integration check를 남긴다.
- 같은 filter/snapshot에서 SQL count와 Prisma count가 같다.
- Dashboard refund/notification count와 linked list total이 같다.

금지:

- client-side filtering으로 숨기기
- Dashboard 숫자를 0으로 맞추기
- 각 list endpoint에 임시 예외를 반복하기
- 새 fixture column/table부터 추가하기

### Slice A2 — DRA-002 unavailable state

목표:

- 핵심 운영 화면에서 API 실패와 정상 0건을 분리한다.
- `apps/admin_web/app/reviews/page.tsx`의 기존 `adminGetResult()` 패턴을 재사용한다.

최소 대상:

- Shift Command의 핵심 queue sources
- Booking list
- Refund list/summary
- Notification list/summary
- Finance current backlog

필수 상태:

```text
success + rows
success + empty
list failure
summary failure
partial failure
permission failure
```

오류 상태는 `role="alert"`, 실패 범위와 Retry를 제공하고 `No action needed`, `0 rows`, `0 VND`로 보이지 않게 한다. 새 전역 error framework는 만들지 않는다.

### Slice A3 — DRA-003 Customer list/export masking

목표:

- Directory HTML, name fallback, helper phone과 기본 CSV/export에서 전체 전화번호를 제거한다.
- Booking list 또는 wallet owner lookup의 기존 서버 마스킹 규칙을 재사용한다.
- 검색 기능은 유지한다.
- Customer Detail의 기존 권한 경계를 넓히지 않는다.

CSS로만 숨기지 말고 server read model/projection에서 보호하라.

### Gate A 검증

`DRA-001~003` 수용 기준을 표로 평가한다. 하나라도 FAIL이면 Gate B로 가지 말고 root cause를 수정한다.

### Slice B1 — DRA-004 queue parity contract

- Dashboard와 linked route가 같은 open/overdue/status/range/sla 의미를 사용하게 한다.
- Refund와 Notification을 시작으로 모든 Shift Command CTA를 contract test로 보호한다.
- count, oldest, amount, owner, href의 단위를 명시한다.
- 새로운 status 또는 filter가 추가되면 parity test가 실패하게 한다.

### Slice B2 — DRA-005 Current vs Legacy

- Shift Command에서 Current operational, Overdue operational, Legacy cleanup을 분리한다.
- 75~78일 적체가 current live와 같은 danger 영역을 차지하지 않게 한다.
- queue summary와 실제 next cases를 구분한다.
- 가능한 기존 route로 owner/unassigned 작업을 연결한다.

### Slice B3 — DRA-006 Notification incidents

- 기존 delivery incident read model을 확장/재사용한다.
- persistent incident table은 만들지 않는다.
- provider/failure code/time window로 서버에서 묶는다.
- impact users/notifications, first/latest, owner와 customer fallback을 표시한다.
- Support action과 Developer/System technical evidence를 분리한다.
- 1024×900 첫 viewport에 incident row 또는 정상/error state가 보이게 한다.

### Slice B4 — DRA-007 structured Handoff

- outgoing operator는 session에서 가져온다.
- incoming operator와 owner는 기존 Admin users/teams에서 선택한다.
- unresolved case는 기존 open queues에서 검색·선택한다.
- 서버가 operator 존재/권한과 case의 실제 open 상태를 검증한다.
- note/acknowledgement audit를 유지한다.
- submit preview를 제공한다.
- Current Handoff의 breadcrumb/nav/H1을 일치시킨다.

새 handoff DB table이 필수인지 먼저 증명하라. 기존 audit-backed model로 안전하게 해결되면 schema를 추가하지 않는다.

### Slice C1 — DRA-008 Customer 1024px

- 기본 표를 Customer, Last activity, Bookings, Attention, Value 중심으로 줄이는 방안을 우선한다.
- App locale, Sign-up, Last address는 detail/disclosure로 이동할 수 있다.
- 1024×900에서 열 겹침과 raw phone 노출이 없어야 한다.
- 1440/1688px도 함께 확인한다.

### Slice C2 — DRA-009 Finance reason

- warning을 만든 실제 non-zero count를 표시한다.
- visible reason이 모두 0이면 warning backlog card를 숨긴다.
- `Open queue`를 실제 동사+대상 CTA로 바꾼다.

### Slice C3 — DRA-010 Customer Detail

- 첫 viewport의 phone 반복을 제거한다.
- technical diagnostics를 data issue/적절한 역할의 secondary disclosure로 낮춘다.
- 빈 section wall을 줄인다.
- 기존 wallet/push/note 권한과 감사 동작을 유지한다.

### Slice C4 — DRA-011 copy

핵심 11개 화면에서 다음을 정리한다.

```text
booking(s), row(s), case(s), record(s), Partner(s), formula issue(s)
All loaded
마침표 뒤 소문자로 이어지는 queue 설명
반복 Open queue
without mixing in older backlog
Pause live
```

기존 copy/format helper와 `admin:visible-copy`를 재사용하고 전체 저장소 sweep은 하지 않는다.

### Slice C5 — DRA-012 visual/accessibility finish

- danger는 실제 즉시 위험/차단에만 사용한다.
- overdue는 warning, legacy/history는 neutral로 구분한다.
- Finance all-zero는 compact clear state로 바꾼다.
- light/dark를 하나의 theme control로 합친다.
- 페이지당 primary CTA 하나를 유지한다.
- 1024/1440/1688, light/dark, 200% zoom, keyboard/focus/heading을 검증한다.

## 테스트와 검증

항상 focused test부터 실행한다.

```powershell
npm.cmd run test --workspace @massage-vn/api -- src/admin/admin-booking-list-query.spec.ts
npm.cmd run typecheck --workspace @massage-vn/api
npm.cmd run build --workspace @massage-vn/api
```

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- <focused-spec-files>
npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run build --workspace @massage-vn/admin-web
npm.cmd run admin:visible-copy
```

완결된 API/Admin gate 뒤:

```powershell
npm.cmd run verify:scope -- -Scope api
npm.cmd run verify:scope -- -Scope admin
```

전체 명령과 대표 spec은 `docs/admin-operator-deep-remediation-criteria.md`를 따른다.

## 실행본 검증

- 빌드 전후 `.next/BUILD_ID`, Admin Web/API PID, command line과 시작 시각을 기록한다.
- 서버 재시작이 필요하면 정확한 해당 PID만 대상으로 한다.
- 다른 프로젝트나 사용자 프로세스를 종료하지 않는다.
- current signed-in in-app browser를 사용한다.
- 인증이 없으면 로그인 화면을 열고 사용자 로그인이 필요한 시점에만 중단한다.
- before/after는 같은 build ID, viewport와 filter 상태로 캡처한다.
- screenshot 외에 DOM label, link href, disabled state, focus 순서와 실제 total을 확인한다.
- 실제 mutation은 제출하지 않는다.

필수 browser routes/state matrix는 기준 문서의 9장을 따른다.

## 문서 업데이트

각 DRA를 실제로 검증한 뒤에만 `docs/admin-ux-implementation-progress.md`에 다음을 기록한다.

```text
DRA ID
상태
변경 파일
root cause/fix
테스트 결과
build ID
browser evidence
남은 위험
```

기존 `COMPLETE` 기록을 증거 없이 삭제하지 말고, 회귀가 확인된 경우 `REGRESSION FIXED` 또는 `REOPENED`처럼 이력을 보존한다.

## 중단 조건

다음 경우에만 진행을 멈추고 정확한 결정을 요청한다.

- schema migration이 실제로 필요함
- 인증/권한 모델 변경이 필요함
- 실제 금전·지갑·결제·환불 상태 mutation이 필요함
- 기존 dirty change와 같은 줄을 안전하게 병합할 수 없음
- 제품 정의 없이는 Current/Legacy cutoff를 결정할 수 없고 코드/정책에서 찾을 수 없음
- 로그인이나 외부 시스템 권한이 필요함

단순히 작업이 크거나 테스트가 느리다는 이유로 중단하지 마라. 안전한 범위에서 root cause를 추적하고 하나의 slice씩 완료하라.

## 완료 전 최종 검사

최종 응답 전에 다음을 확인하라.

- 모든 DRA 수용 기준을 PASS/FAIL/NOT VERIFIED로 표시했다.
- Dashboard ↔ linked list parity가 현재 실행본에서 확인됐다.
- API unavailable이 정상 empty와 다르다.
- Customer list/export raw phone이 없다.
- 1024px Customers/Notifications 증거가 있다.
- Handoff server validation이 있다.
- focused tests, typecheck, build, scope checks 결과가 있다.
- 같은 build ID의 화면 증거가 있다.
- 보호 영역과 새 의존성 여부를 보고했다.
- 기존 사용자 변경을 보존했다.

## 최종 보고 형식

1. 운영자가 더 안전하고 빠르게 할 수 있게 된 결과
2. 완료한 DRA와 남은 DRA
3. root cause와 핵심 수정
4. 변경 파일
5. 실행한 명령과 PASS/FAIL/SKIPPED
6. DB/query parity 결과 — PII 없는 count만
7. build ID와 browser evidence
8. 수용 기준 표
9. 보호 영역/의존성/마이그레이션 여부
10. 남은 위험과 다음 단 하나의 작업

파일 목록만 나열하지 말고 운영자 결과와 데이터 계약이 어떻게 검증됐는지 먼저 보고하라.

지금 즉시 `git status --short`와 필수 문서 읽기부터 시작하고, 별도 blocker가 없으면 Slice A1부터 구현하라.

