# HANDS Admin 심층 개선 기준 — DRA-001~DRA-012

- 기준일: 2026-08-05
- 대상: `apps/admin_web`과 이를 직접 지원하는 `apps/api/src/admin`
- 상태: 구현 및 검증 완료
- 근거 보고서: `output/admin-operator-deep-reaudit-2026-08-05/admin-operator-ux-deep-reaudit.md`
- 실행 프롬프트: `docs/agent/prompts/admin-operator-deep-remediation-master.md`

## 1. 문서 목적

이 문서는 2026-08-05 현재 실행 중인 HANDS Admin을 코드·화면·문구·실제 조회 계약까지 다시 검사해 확인한 문제의 구현 기준과 완료 판정 방법을 정의한다.

이 문서의 목표는 화면을 더 화려하게 만드는 것이 아니다. 운영자가 대기열 숫자를 믿고, 실제 사례로 이동하고, 개인정보를 불필요하게 노출하지 않으며, 교대 시 잘못된 데이터를 남기지 않게 하는 것이다.

핵심 운영 흐름은 다음과 같다.

```text
Queue count → Linked cases → Evidence → Action → Audit → Handoff
```

## 2. 기준 문서 우선순위

문서와 코드가 충돌하면 다음 순서를 적용한다.

1. `AGENTS.md`와 더 가까운 경로의 저장소 지침
2. 인증·권한·감사·결제·지갑·예약 상태 등 실제 서버 계약
3. 이 문서의 `DRA-001~DRA-012`와 수용 기준
4. 2026-08-05 심층 재감사 보고서와 같은 실행본에서 만든 캡처
5. `docs/admin-operator-redesign-requirements.md`의 `OUX-030~043`, `RA-001~011`
6. `docs/admin-ux-implementation-progress.md`의 기존 완료 기록

기존 `ADM-001~029`, `RA-001~011`의 보호 의도는 유지한다. 단, 이번 심층 감사에서 실제 회귀가 증명된 항목은 기존 `COMPLETE` 표기보다 현재 증거를 우선한다.

## 3. 현재 증명된 기준선

### 3.1 화면 계약 불일치

| 항목 | 집계 화면 | 연결된 목록 |
|---|---:|---:|
| Open refunds | 112 | 0 |
| Unresolved notification failures | 410 | 0 |

### 3.2 읽기 전용 DB 비교

| 항목 | 현재 로컬 값 |
|---|---:|
| 전체 Booking | 2,966 |
| raw SQL production Booking | 2,954 |
| Prisma production Booking | 0 |
| fixture 포함 unresolved notification | 412 |
| raw SQL production unresolved notification | 410 |
| Prisma production notification | 0 |

이 숫자는 현재 데이터의 재현 근거이며 테스트에 고정할 상수가 아니다. 완료 기준은 특정 숫자가 아니라 동일한 필터·시점에서 raw SQL 집계, Prisma summary와 linked list가 같은 결과를 내는 것이다.

### 3.3 코드 원인

- `apps/api/src/admin/admin-booking-list-query.ts:116-132`
- `apps/api/src/admin/admin-booking-list-query.ts:130`의 `string_contains: ''`
- `apps/api/src/admin/admin.service.ts:40654-40705`
- nullable JSON path를 포함한 `NOT: { OR: [...] }`
- `apps/admin_web/lib/admin-api.ts:5473-5496`의 silent fallback
- `apps/admin_web/app/customers/customers-table-section.tsx:57`의 raw phone 렌더링

## 4. 전체 목표와 성공 조건

### 4.1 운영 신뢰성

- 대시보드 count와 CTA가 연 목록 total이 같은 계약을 사용한다.
- API 실패는 정상 0건으로 표시되지 않는다.
- `Live`, `Current`, `Historical`, `Legacy cleanup`, `Test data excluded`의 의미가 코드·문구·화면에서 일치한다.

### 4.2 개인정보

- 목록, 검색 결과와 기본 export에서 전체 전화번호를 노출하지 않는다.
- 고객 상세의 원문 contact는 기존 권한 경계 안에서만 제공한다.
- 새 reveal 권한 시스템은 만들지 않는다. 기존 계약으로 안전하게 지원할 수 없으면 기본 마스킹을 유지하고 별도 요구로 남긴다.

### 4.3 운영 효율

- 첫 viewport에서 현재 처리할 사례 또는 목적 있는 정상/오류 상태가 보인다.
- 기술 필터와 참고 지표가 주 작업을 밀어내지 않는다.
- 인수인계는 실제 operator와 open case를 참조한다.

### 4.4 구현 품질

- 기존 helper와 화면 패턴을 먼저 재사용한다.
- 새 UI·상태관리·날짜·테이블 의존성을 추가하지 않는다.
- schema migration 없이 해결 가능한 문제에 컬럼이나 테이블을 추가하지 않는다.
- 한 slice는 가능한 한 3~8개 파일로 제한한다.
- 한 번에 하나의 slice만 진행한다.

## 5. 비목표와 금지사항

- 전체 관리자 웹 재작성
- `globals.css` 전면 교체
- MUI 또는 다른 UI framework 추가
- 모든 관리자 문구를 한 번에 정리하는 광범위한 sweep
- 알림 incident를 위한 새 영구 테이블부터 만드는 작업
- 고객 전화번호 reveal을 위한 새 권한 체계 발명
- 실제 환불, 지급, 지갑, 승인, 노쇼, 정책 변경을 브라우저에서 제출
- 사용자 변경을 `reset`, `checkout`, `restore`, `clean`으로 제거
- 테스트 통과만으로 화면 완료 선언
- screenshot만 보고 링크·DOM·데이터 계약 검증 생략

## 6. 실행 순서와 단계 게이트

### Gate A — 데이터와 개인정보 P0

1. DRA-001 production-data 쿼리 정상화
2. DRA-002 API unavailable과 정상 empty 분리
3. DRA-003 Customer Directory/Export 전화번호 마스킹

Gate A의 모든 수용 기준이 PASS가 되기 전에는 대규모 시각 정리나 DRA-005 이후 작업을 시작하지 않는다.

### Gate B — 큐와 인수인계 P1

4. DRA-004 Dashboard ↔ list 단일 큐 계약
5. DRA-005 Current shift ↔ legacy cleanup 분리
6. DRA-006 Notification incident 중심 구조
7. DRA-007 구조화된 Shift Handoff

### Gate C — 반응형·문구·마감

8. DRA-008 Customer Directory 1024px
9. DRA-009 Finance 경고 원인
10. DRA-010 Customer Detail 밀도와 PII
11. DRA-011 운영 문구
12. DRA-012 시각 위계

## 7. 상세 요구사항

### DRA-001 [P0] — production-data 조건을 null-safe 단일 계약으로 수정

#### 운영자 문제

대시보드는 실제 미처리 사례를 보고하지만 Booking/Refund/Notification 목록은 0건이다. 운영자는 처리할 일이 없다고 오판할 수 있다.

#### 구현 기준

- `adminBookingProductionDataWhere()`와 `adminNotificationProductionDataWhere()`의 모든 caller를 먼저 찾는다.
- nullable JSON path가 missing/null인 정상 row를 보존한다.
- 명시적인 smoke/seed 식별자와 fixture metadata만 제외한다.
- `string_contains: ''`를 제거한다.
- raw SQL production helper와 Prisma helper의 정의 차이를 표로 확인하고 의도적으로 통일한다.
- 공통 helper 한 곳에서 고친다. 각 list/summary에 예외 조건을 추가하지 않는다.
- schema migration은 하지 않는다.

#### 필수 테스트

- 기존 `apps/api/src/admin/admin-booking-list-query.spec.ts`의 잘못된 shape expectation을 수정한다.
- 다음 PostgreSQL 의미를 실제로 검증하는 가장 작은 integration check를 남긴다.
  - fixture key missing
  - fixture key JSON null
  - `smokeFixture: true`
  - `smoke: true`
  - legacy string smoke marker
  - `smoke*`, `seed-*` ID
  - 정상 ID와 정상 metadata
- raw SQL production count와 Prisma production count parity를 검증한다.
- Refund와 Notification summary/list parity를 검증한다.

#### 수용 기준

- [ ] 같은 필터와 시점에서 SQL production count = Prisma production count
- [ ] Shift Command refund count = linked Refund summary/list total
- [ ] Shift Command notification failure count = linked Notification summary/list total
- [ ] Booking Monitor가 production Booking을 정상 로드
- [ ] 명시적 smoke/seed fixture는 기본 큐에서 제외
- [ ] API typecheck/build PASS

### DRA-002 [P0] — API unavailable을 정상 0건과 분리

#### 구현 기준

- `Reviews`의 `adminGetResult()`/`Review data unavailable` 패턴을 먼저 재사용한다.
- 새 전역 error framework를 만들지 않는다.
- 최소 대상은 Shift Command의 핵심 sources, Booking list, Refund list/summary, Notification list/summary, Finance backlog다.
- 부분 실패 시 전체 페이지를 0으로 만들지 말고 실패한 section만 unavailable로 표시한다.
- 오류 상태에는 `role="alert"`, 실패 범위, 재시도 방법과 가능하면 마지막 성공/생성 시각을 제공한다.
- 정상 0건은 기존 empty state를 유지한다.

#### 수용 기준

- [ ] 500/401/403/timeout에서 `No action needed`, `0 rows`, `0 VND`로 위장하지 않음
- [ ] 정상 200 + 빈 결과는 목적 있는 empty state 표시
- [ ] list 성공 + summary 실패와 반대 조합을 각각 테스트
- [ ] 오류 상태와 empty state의 DOM/text가 서로 다름
- [ ] 기존 Reviews load-failure 동작 회귀 없음

### DRA-003 [P0] — Customer Directory와 Export 전화번호 마스킹

#### 구현 기준

- Booking list 또는 wallet owner lookup의 기존 서버 마스킹 규칙을 재사용한다.
- Customer Directory read model에서 `name` fallback, helper phone, 검색 결과와 export field가 원문 번호를 노출하지 않게 한다.
- 검색은 서버에서 원문 번호로 가능해도 결과 표시는 마스킹할 수 있다.
- Customer Detail API의 현재 권한 경계는 유지한다. 별도 reveal 기능을 새로 만들지 않는다.
- Detail PII 반복 축소는 DRA-010에서 다룬다.

#### 수용 기준

- [ ] Directory HTML에 전체 전화번호 없음
- [ ] 고객 이름이 없을 때 name fallback도 마스킹됨
- [ ] CSV/default export에 전체 전화번호 없음
- [ ] 검색 기능 유지
- [ ] Booking list 기존 마스킹 회귀 없음
- [ ] 권한 없는 역할이 detail 원문 contact를 우회 조회하지 못함

### DRA-004 [P1] — Dashboard와 상세 큐의 단일 정의

#### 구현 기준

- Refund open status처럼 raw SQL과 Prisma가 서로 다른 상태 집합을 사용하지 않게 한다.
- `count`, `overdueCount`, `oldestAt`, `amount`, `owner`, `href`를 하나의 큐 정의로 관리하거나 contract test로 강제한다.
- dashboard card와 linked route의 filter를 같은 test case에서 검증한다.
- 새 status가 생기면 test가 실패해야 한다.

#### 수용 기준

- [ ] 모든 Shift Command Needs action CTA의 count와 linked list total 일치
- [ ] linked route가 같은 `range/review/sla/sort` 의미 사용
- [ ] queue type 수와 case 수를 혼용하지 않음
- [ ] generatedAt/scope가 비교 가능한 형태로 제공됨

### DRA-005 [P1] — Current shift와 legacy cleanup 분리

#### 구현 기준

- 현재 운영 정책을 기준으로 `Current operational`, `Overdue operational`, `Legacy cleanup`을 구분한다.
- 75~78일 적체를 current live와 같은 danger block으로 표시하지 않는다.
- Shift Command 첫 화면에는 각 queue 전체 집계와 실제 next case 1~3개를 분리한다.
- unassigned/owner가 있으면 표시하고 기존 assignment route를 재사용한다.

#### 수용 기준

- [ ] first viewport에서 current와 legacy 범위가 구분됨
- [ ] 오래된 적체가 현재 live KPI를 오염시키지 않음
- [ ] `1 operating queues clear` 같은 복수 오류 없음
- [ ] primary CTA는 하나

### DRA-006 [P1] — Notification을 incident 중심으로 축소

#### 구현 기준

- 기존 delivery incident read model을 먼저 사용한다.
- 새 persistent incident table을 만들지 않는다.
- provider/failure code/time window 기준 grouping을 서버 read model에서 수행한다.
- Support가 필요한 customer fallback과 Developer/System 기술 evidence를 구분한다.
- failed/unresolved/needs-retry/FCM 등의 기술 큐는 2차 disclosure 또는 Developer/System으로 낮춘다.
- `Historical`과 `Live`가 동시에 현재 상태처럼 보이지 않게 scope badge를 통일한다.

#### 수용 기준

- [ ] 1024×900 첫 viewport에서 incident row 또는 정상/error state가 보임
- [ ] 같은 원인의 반복 실패가 하나의 incident로 묶임
- [ ] 영향 users/notifications, first/latest, owner, fallback 표시
- [ ] 24h+ history가 current SLA count를 오염시키지 않음
- [ ] 기술 상세를 보지 않아도 Support next action을 결정 가능

### DRA-007 [P1] — Shift Handoff를 실제 operator와 open case에 연결

#### 구현 기준

- outgoing operator는 현재 session에서 가져온다.
- incoming operator와 owner는 기존 Admin user/team data에서 선택한다.
- unresolved case는 기존 open queue에서 검색·선택한다.
- server가 operator 존재/권한, case 존재/현재 open 상태를 검증한다.
- note requirement와 acknowledgement audit를 유지한다.
- submit 전 recipient/case preview를 제공한다.
- breadcrumb, nav와 H1을 `Current Handoff` 의미로 일치시킨다.

#### 수용 기준

- [ ] 임의 문자열 operator/owner 제출 불가
- [ ] 존재하지 않거나 closed case 제출 차단
- [ ] unresolved case가 있으면 note 필수
- [ ] acknowledgement actor/time 보존
- [ ] History는 읽기 전용 유지
- [ ] destructive operational action 없이 브라우저 검증 가능

### DRA-008 [P1] — Customer Directory 1024px 겹침 제거

#### 구현 기준

- 기본 열을 `Customer / Last activity / Bookings / Attention / Value` 중심으로 줄이는 방안을 우선한다.
- App locale, Sign-up, Last address는 detail 또는 disclosure로 이동할 수 있다.
- 전체 열을 유지하면 sticky identity, keyboard 가능한 horizontal scroll과 시각적 affordance를 제공한다.
- 반복되는 Unknown/Never active는 필요하면 상단 data-quality summary로 묶는다.

#### 수용 기준

- [ ] 1024×900에서 텍스트 겹침 0건
- [ ] 전체 phone 노출 0건
- [ ] row detail link keyboard 접근 가능
- [ ] 1440/1688px에서 불필요한 빈 공간이나 열 왜곡 없음

### DRA-009 [P2] — Finance backlog의 실제 경고 원인 표시

#### 구현 기준

- warning tone을 만든 non-zero trigger를 카드에 표시한다.
- visible counts가 모두 0이면 warning card로 표시하지 않는다.
- `Open queue` 대신 실제 대상과 동사를 쓴다.

#### 수용 기준

- [ ] 모든 warning 카드에 visible non-zero reason 존재
- [ ] 모든 trigger 0이면 current backlog에서 제외
- [ ] CTA가 정확한 filtered queue를 엶

### DRA-010 [P2] — Customer Detail의 PII 반복과 빈 섹션 축소

#### 구현 기준

- 전화번호는 첫 viewport에서 한 번만 표시한다.
- 현재 detail 권한에서 원문 contact가 필요하더라도 H1/subtitle/card에 반복하지 않는다.
- technical diagnostics는 data issue 또는 적절한 역할에서 secondary disclosure로 낮춘다.
- 내용 없는 긴 sections는 요약 아래 접거나 렌더링하지 않는다.

#### 수용 기준

- [ ] first viewport 원문 phone 반복 없음
- [ ] no-action customer에서 technical diagnostics가 primary action이 아님
- [ ] 비어 있는 sections가 페이지 길이를 불필요하게 늘리지 않음
- [ ] 기존 wallet/push/note 권한과 감사 동작 유지

### DRA-011 [P2] — 운영 문구 자연화

우선 대상:

- `booking(s)`, `row(s)`, `case(s)`, `record(s)`, `Partner(s)`, `formula issue(s)`
- `All loaded`
- 마침표 뒤 소문자로 이어지는 queue 설명
- 반복 `Open queue`
- `without mixing in older backlog`
- `Pause live`

#### 구현 기준

- 기존 `admin-copy`, format helper나 visible-copy guard를 재사용한다.
- 전체 저장소 sweep 대신 핵심 11개 화면과 공유 컴포넌트부터 고친다.
- CTA는 `Review refunds`, `Assign bank reviews`, `Resolve tax flags`처럼 동사+대상을 쓴다.

#### 수용 기준

- [ ] 핵심 11개 화면 visible `(s)` 0건
- [ ] 문장 연결 문법 오류 0건
- [ ] `All loaded` 대신 명확한 시간 범위
- [ ] `admin:visible-copy` PASS

### DRA-012 [P3] — 시각 위계와 상단 공간 마감

#### 구현 기준

- danger는 즉시 고객/금액/처리 차단에만 쓴다.
- overdue는 warning, legacy/history는 neutral로 구분한다.
- Finance Today가 all zero면 네 개 0카드 대신 compact clear state를 사용한다.
- light/dark는 하나의 theme control로 합친다.
- 페이지당 primary CTA는 하나다.

#### 수용 기준

- [ ] 색 없이 label/icon/position으로 상태 구분 가능
- [ ] all-zero 화면에서 KPI card wall 없음
- [ ] 1024/1440/1688 및 light/dark에서 레이아웃 유지
- [ ] focus-visible, keyboard, heading 구조 회귀 없음

## 8. 검증 명령

가장 작은 focused test부터 실행한다. Windows에서는 저장소의 기존 `npm.cmd`와 PowerShell script를 사용한다.

### API slice

```powershell
npm.cmd run test --workspace @massage-vn/api -- src/admin/admin-booking-list-query.spec.ts
npm.cmd run typecheck --workspace @massage-vn/api
npm.cmd run build --workspace @massage-vn/api
npm.cmd run verify:scope -- -Scope api
```

Notification/Refund/AdminService를 수정하면 관련 `admin.service.spec.ts` 테스트 이름을 `-t`로 좁혀 먼저 실행한다.

### Admin Web slice

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- <focused-spec-files>
npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run build --workspace @massage-vn/admin-web
npm.cmd run admin:visible-copy
npm.cmd run verify:scope -- -Scope admin
```

### 대표 focused specs

```text
apps/admin_web/app/reviews/page.spec.tsx
apps/admin_web/app/refunds/page.spec.tsx
apps/admin_web/app/notifications/notification-page-model.spec.ts
apps/admin_web/app/notifications/page.spec.tsx
apps/admin_web/app/customers/customer-list-model.spec.ts
apps/admin_web/app/customers/customers-table-section.spec.tsx
apps/admin_web/app/customers/page.spec.tsx
apps/admin_web/app/customers/[id]/page.spec.tsx
apps/admin_web/app/operations-handoff/operations-shift-handoff-section.spec.tsx
apps/admin_web/app/operations-handoff/page.spec.tsx
apps/admin_web/app/finance-overview/finance-overview-model.spec.ts
apps/admin_web/app/finance-overview/page.spec.tsx
```

## 9. 브라우저 검증 매트릭스

최신 소스로 build한 뒤 해당 build ID와 API process 시작 시각을 기록한다. 같은 build에서 확인한다.

| 경로 | 필수 상태 | 필수 확인 |
|---|---|---|
| `/` | current/legacy queues | count, CTA, owner, oldest, scope |
| `/bookings` | result/empty/error | production rows, unavailable 구분 |
| Refund CTA exact URL | result/error | dashboard count와 total parity |
| Notification CTA exact URL | result/error | dashboard count와 total parity |
| `/notifications` | 1024/1440 | incident가 first viewport에 보임 |
| `/customers` | needs-action/empty | 정상 empty와 error 구분 |
| `/customers?view=all` | 1024/1440 | phone masking, 열 겹침 없음 |
| `/customers/[id]` | no-action | PII 반복, diagnostics 위계 |
| Partner approval queue | 0건 | 현재 좋은 empty 구조 회귀 없음 |
| Finance Today/Backlog | all-zero/non-zero | scope, 실제 warning reason |
| Current Handoff | empty/validation | 실제 제출 없이 field/preview/validation 확인 |
| Operations History | empty/history | read-only 유지 |

추가 접근성 점검:

- 200% zoom
- keyboard-only 주요 흐름
- focus-visible
- disclosure Escape/focus restoration
- heading 구조
- 오류 상태 `role="alert"`
- 테이블 horizontal scroll keyboard 접근

## 10. Slice 완료 보고 형식

각 slice를 마칠 때 다음 순서로 보고한다.

1. DRA ID와 운영자 결과
2. 확인한 root cause와 재사용한 기존 패턴
3. 변경 파일
4. 데이터 계약 상태: `UI can proceed / API contract needed / Protected review needed`
5. 실행한 명령과 PASS/FAIL/SKIPPED
6. build ID와 같은 build의 before/after 또는 상태 캡처
7. 수용 기준 PASS/FAIL/NOT VERIFIED 표
8. 보호 영역 변경 여부
9. 남은 위험
10. 다음 단 하나의 slice

## 11. 전체 완료 정의

다음 조건을 모두 충족해야 전체 완료다.

- Gate A, B, C의 모든 필수 수용 기준 PASS
- Dashboard ↔ linked list parity PASS
- API unavailable ↔ normal empty 구분 PASS
- Customer list/export raw phone 0건
- 1024px Notifications/Customers first-view 기준 PASS
- Handoff invalid operator/case server validation PASS
- 관련 focused tests, API/Admin typecheck/build PASS
- `verify:scope api`, `verify:scope admin` PASS
- 같은 build ID에서 현재-run browser 증거 저장
- `docs/admin-ux-implementation-progress.md`에 DRA 상태와 실제 검증 결과 기록
- 기존 사용자 변경 보존
- 새 의존성 없음
- 실제 금전·환불·지갑·승인·정책 mutation을 브라우저에서 실행하지 않음

## 12. 완료로 인정하지 않는 경우

- unit test가 Prisma object shape만 확인하고 PostgreSQL null 의미를 검증하지 않음
- Dashboard 숫자만 수정하고 linked list가 여전히 다른 조건을 사용함
- API 오류를 copy만 바꿔 empty state로 계속 표시함
- CSS로 전화번호를 숨기고 HTML/API/export에는 원문이 남음
- client-side filter로 fixture를 숨기고 API total은 오염된 상태
- Handoff 입력 UI만 select처럼 보이고 서버는 임의 문자열을 계속 허용함
- 1440px만 확인하고 1024px 겹침을 검증하지 않음
- 오래된 screenshot이나 다른 build ID로 완료를 주장함
- 기존 `ADM`/`RA` 보호 동작을 깨뜨림

## 13. 완료 기록

- 완료일: 2026-08-05
- Gate A/B/C와 DRA-001~DRA-012: COMPLETE
- PostgreSQL parity: Booking 2,954 = 2,954, Refund 112 = 112, Notification 410 = 410
- API scope: 1,934 tests PASS, 1 intentional skip; Prisma, policy contracts, typecheck, lint, build PASS
- Admin scope: 4,197 tests PASS; typecheck, lint, query guard, visible-copy 1,553 files, build PASS
- Admin production build: `ER5ik7otyFt_ph8dWAX0h`
- Same-build browser: Start Shift, Refunds, Notifications, Customers, Finance Today/Backlog, Current Handoff, and Operations History PASS with no runtime log or document-level horizontal overflow
- Privacy: Customer Directory rendered zero full-phone patterns at 1024px; the default list and export masking remain contract-tested
- Accessibility: one theme control, light/dark restore, table keyboard focus outline, 1024px layout, and a 720px viewport equivalent to 200% of the 1440px desktop layout PASS
- Safety: no schema migration, new dependency, or browser mutation of money, refund, wallet, approval, policy, or handoff data
