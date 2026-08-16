# Codex 실행 프롬프트 — Coupons 출시 차단 문제 및 운영 UX 개선

아래 `실행용 프롬프트` 전체를 새 Codex 작업에 그대로 붙여 넣는다. 이 문서는 단순 UI 수정이 아니라 쿠폰 데이터 위생, 할인 손실 통제, redemption 원장, 운영 화면, 권한, 감사 이력과 검증까지 한 작업 흐름으로 연결한다.

---

## 실행용 프롬프트

당신은 `C:\dev\massage-on-demand-vn` 저장소에서 HANDS 관리자 Coupons 도메인을 출시 가능한 수준으로 개선하는 Codex다. 분석이나 제안만 하고 끝내지 말고, 현재 코드와 실제 화면을 확인한 다음 안전한 범위에서 구현·테스트·브라우저 검증·문서화까지 완료하라.

이 작업은 복잡하고 보호 영역을 포함하므로 먼저 계획을 세우되, 계획만 제출하고 멈추지 말고 구현까지 계속 진행하라. 사용자 선택이 반드시 필요한 파괴적 데이터 변경 직전만 멈추고 승인 요청을 하라.

### 1. 목표

`/coupons`를 단순 CRUD 화면에서 다음 질문에 즉시 답할 수 있는 운영 도구로 바꾼다.

1. 지금 고객이 사용할 수 있는 쿠폰은 무엇인가?
2. 어떤 쿠폰이 종료·예산 소진·정책 미완성 때문에 위험한가?
3. 각 쿠폰이 몇 번 사용됐고 회사 할인 비용은 얼마인가?
4. 고객별/전체 사용 한도와 예산을 서버가 원자적으로 지키는가?
5. 누가 어떤 이유로 생성·수정·활성화·중지했는가?
6. 테스트 fixture가 실제 체크아웃과 운영 집계를 오염하지 않는가?

최종 목표는 1440px 이상 관리자 화면에서 운영자가 가로 스크롤이나 개별 쿠폰 반복 열기 없이 상태·노출·책임자·대표 액션을 판단하고, 서버는 동시 요청에서도 할인 한도와 회계 증거를 보존하는 것이다.

### 2. 반드시 먼저 읽을 자료

작업 전에 다음을 읽고 현재 코드와 대조하라.

- `AGENTS.md`
- `docs/audits/coupons-final-reaudit-2026-08-12.md`
- `docs/audits/coupons-reaudit-evidence-2026-08-12/`
- `apps/admin_web/app/coupons/**`
- `apps/admin_web/app/globals.css`의 coupon 관련 규칙
- `apps/admin_web/lib/admin-api.ts`의 coupon 계약
- `apps/api/src/admin/admin-coupon.routes.ts`
- `apps/api/src/admin/admin.service.ts`의 coupon 메서드와 helper
- `apps/api/src/admin/admin.dto.ts`의 coupon DTO
- `apps/api/src/admin/admin-operator-category.guard.ts`
- `apps/api/src/admin/admin-operator-permission-manifest.json`
- `apps/api/src/bookings/bookings.pricing.ts`
- `apps/api/src/bookings/bookings.service.ts`
- `apps/api/src/customers/customers.service.ts`의 coupon preview
- `apps/api/src/settlements/coupon-settlement.ts`
- `apps/api/prisma/schema.prisma`
- `infra/scripts/api-smoke.mjs`
- 기존 fixture cleanup 스크립트와 테스트 패턴

보고서 작성 이후 변경된 코드가 있다면 최신 코드를 우선하되, 보고서의 문제를 조용히 생략하지 말고 `해결됨 / 여전히 존재 / 구현 방향 변경 필요`로 판정하라.

### 3. 작업 방식과 저장소 제약

- `AGENTS.md`를 준수하고 단일 에이전트로 순차 작업한다.
- 작업 루트는 반드시 `C:\dev\massage-on-demand-vn`이다.
- 기존 dirty worktree와 사용자 변경을 보존한다.
- 관련 없는 리팩터링, 라이브러리 교체, 대규모 CSS 재작성은 하지 않는다.
- 현재 디자인 토큰, Admin 컴포넌트, drawer, notice, table, status 패턴을 재사용한다.
- 새 production dependency는 정말 필요하지 않으면 추가하지 않는다.
- 1024px 이하 화면은 설계·검사·보고 범위에서 완전히 제외한다.
- 기준 viewport는 1440 × 1000이며, 가능하면 1600 × 1000도 확인한다.
- 사용자-facing 관리자 문구는 현재 화면과 동일하게 영어를 유지한다.
- `Coupons`, `Marketing Analytics`, `Coupon Finance`는 합치지 않는다. 역할을 유지하고 scoped link만 강화한다.
- percentage coupon과 company-funded 정책만 유지한다. 현재 지원하지 않는 partner-funded/platform-fee-funded UI는 만들지 않는다.
- preview 결과를 최종 권한으로 사용하지 않는다. 최종 검증은 항상 예약 생성 서버 트랜잭션에서 다시 수행한다.
- `prisma migrate reset`, `db push`, 임의 SQL 삭제, 광범위한 update/delete를 실행하지 않는다.
- 실제 SMOKE 쿠폰 pause/delete/archive apply는 사용자 승인 없이 실행하지 않는다.
- cleanup 코드와 dry-run inventory는 작성하고 실행할 수 있지만 apply는 별도 승인 경계다.
- `.env*`, 인증 비밀, 결제 자격증명은 출력하거나 수정하지 않는다.
- 코드 변경 후 UI를 실제 브라우저로 열어 검증한다. 스크린샷만 보고 끝내지 말고 DOM/동작/오류 상태도 확인한다.
- Impeccable skill이 제공되면 `harden` 관점으로 극단 데이터, 오류, 권한, 동시 작업, 긴 텍스트와 빈 상태를 검사한다.

### 4. 현재 확인된 출시 차단 사실

재감사 시점의 실제 화면에서 다음이 확인됐다.

- Live checkout codes: 84
- Scheduled launches: 0
- Inactive records: 0
- `/coupons?q=SMOKE`: 83 matching
- 표의 SMOKE 레코드: `10% off`, `ACTIVE`, `Starts immediately`, `No end date`
- 1440px에서 Actions가 잘리고 내부 가로·세로 스크롤이 생김
- Delete가 overflow menu가 아니라 모든 행에 노출됨
- 목록 사용량은 숫자 대신 `View usage`만 표시됨
- usage drawer 합계는 전체가 아니라 현재 페이지 10건 기준
- Coupon 모델에는 총 사용 한도, 고객별 한도, 예산, owner, provenance, version이 없음

이 사실을 개발 fixture라고 가정해 무시하지 말고 출시 차단 상태로 취급하라.

## 5. 구현 범위

다음 Phase를 순서대로 구현하라. 각 Phase가 끝날 때 관련 테스트를 먼저 통과시킨 뒤 다음으로 이동한다.

### Phase 0 — Fixture 위생과 안전한 cleanup 기반

#### 0.1 Coupon provenance 계약

Coupon에 최소 다음 개념을 추가한다. 기존 enum/명명 규칙을 먼저 확인하고 저장소에 맞는 이름을 사용하라.

- operator-created
- smoke-test
- seed
- legacy/unknown
- fixture run ID
- createdAt / updatedAt

중요 조건:

- Admin API 클라이언트가 임의로 provenance를 지정하지 못하게 한다.
- 일반 관리자 생성은 항상 operator-created다.
- smoke 스크립트만 비운영 환경에서 server-owned 방식으로 smoke provenance/run ID를 기록한다.
- 기존 레코드는 migration에서 무조건 operator-created로 위장하지 말고 legacy/unknown으로 둔다.

#### 0.2 Cleanup 도구

기존 `service-catalog-cleanup`, `tax-policy-fixture-cleanup` 패턴을 재사용해 coupon fixture cleanup 도구와 테스트를 만든다.

필수 동작:

- 기본 실행은 dry-run이다.
- 후보별 code, description, active, provenance, fixtureRunId, usageCount, discount, startsAt, endsAt, 권장 action을 출력한다.
- 후보 판정은 provenance를 우선하고, legacy 데이터는 `^SMOKE\d+$`와 정확한 smoke description을 보조 근거로 사용한다.
- 사용 0: delete candidate
- 사용 있음: hard delete 금지, pause/archive candidate
- apply는 reviewed manifest와 exact confirmation 없이는 실패한다.
- production apply는 별도의 더 강한 confirmation을 요구한다.
- 이 작업에서는 dry-run까지만 실행하고 apply는 하지 않는다.

#### 0.3 Smoke lifecycle

`infra/scripts/api-smoke.mjs`의 coupon 생성 흐름을 수정한다.

- 생성 레코드에 smoke provenance와 run ID가 남아야 한다.
- 성공/실패와 무관하게 `finally`에서 최소 Pause를 시도한다.
- 사용된 fixture는 삭제하지 않고 기록 상태로 남긴다.
- cleanup 실패는 숨기지 않고 smoke 결과에 명시한다.
- shared/production DB에서는 명시적 fixture 허용 설정 없이는 coupon smoke 생성을 차단한다.

#### 0.4 Release gate

출시 준비 검사에 다음을 추가한다.

- active smoke fixture count = 0
- active legacy coupon 중 정책 미완성 count = 0
- 결과가 0이 아니면 명확한 code, count, 다음 명령을 출력하고 실패한다.

### Phase 1 — Coupon 정책과 Redemption 원장

#### 1.1 Coupon 정책 필드

현재 모델과 migration에 다음 기능을 추가한다.

- owner
- max redemptions 또는 budget amount 중 최소 하나
- per-customer limit, 신규 기본값 1
- minimum order amount
- currency, 현재 VND
- no-end-date approval reason
- paused/archive reason
- optimistic version
- archivedAt

서비스 범위까지 이번 구조에서 안전하게 구현할 수 있으면 명시적인 `ALL_SERVICES` 또는 selected services 계약을 추가하라. 관계 모델이 과도하게 커지거나 기존 예약 계약과 충돌하면 억지 JSON을 만들지 말고, `ALL_SERVICES`를 명시적으로 저장하는 최소 안전 계약을 우선 구현하고 후속 범위를 문서화하라.

Migration 조건:

- 기존 데이터를 파괴하지 않는다.
- legacy 필드는 nullable/backfill 가능한 단계적 migration으로 만든다.
- 신규 Paused 쿠폰은 필수 정책 없이 저장되지 않게 한다.
- 기존 active coupon의 정책이 미완성이면 `Policy incomplete`로 파생하고 신규 체크아웃에서 fail closed한다.
- 기존 레코드를 자동 삭제·자동 archive하지 않는다.

#### 1.2 CouponRedemption

별도 redemption 원장을 구현한다. 최소 정보:

- coupon ID
- booking ID unique
- customer profile ID
- discount amount
- state: reserved/applied/reversed
- created/applied/reversed timestamps
- reversal reason/reference

상태명은 기존 프로젝트 enum 관례에 맞추되 의미는 보존한다.

#### 1.3 원자적 검증과 동시성

예약 생성의 최종 coupon 검증과 redemption reservation을 하나의 DB 트랜잭션 안에서 처리한다.

트랜잭션 안에서 반드시 다시 확인할 것:

- active/archived
- ICT start/end
- policy completeness
- minimum order
- total redemption count
- customer redemption count
- budget consumed + requested discount
- no-end approval
- supported funding/accounting policy

PostgreSQL advisory lock 또는 저장소에서 이미 사용 중인 동등한 원자적 패턴을 재사용하라. Preview 후 Booking 사이의 TOCTOU를 허용하지 않는다. 중복 요청과 retry에도 booking ID unique/idempotency로 이중 redemption을 막는다.

#### 1.4 Redemption lifecycle

Booking/Payment/Cancel/Refund/Settlement의 실제 상태 흐름을 조사하고 상태 전이를 하나의 명시적 계약으로 만든다.

- booking/payment 생성 시 capacity reservation
- 성공 시 applied
- 결제 실패/예약 생성 실패 시 rollback 또는 release
- 취소/환불 시 idempotent reversed
- 이미 reversed인 요청 재시도는 no-op
- settlement metadata의 coupon snapshot과 redemption이 서로 추적 가능

현금 결제만 가정해 다른 기존 결제 흐름을 깨뜨리지 않는다. 다만 현재 실제 출시가 cash-only로 제한돼 있다면 해당 feature/policy 설정을 존중하고 테스트에서 명시한다.

#### 1.5 할인 위험 정책

- 신규 쿠폰은 1~100% 형식 검증을 유지한다.
- 기본 운영 상한을 기존 policy 시스템에 둘 수 있으면 정책화한다.
- 상한 초과/100%/No end date는 elevated confirmation을 요구한다.
- 1인 운영 시에도 Master Admin, typed confirmation, mandatory reason, immediate audit/notification 조합을 사용한다.
- `start >= end`를 거부한다. 현재 `start > end`만 거부하는 프런트/API를 모두 수정한다.

### Phase 2 — API와 권한

#### 2.1 목록/요약 API

N+1 쿼리를 만들지 말고 pagination 단위 aggregate를 제공한다.

목록 행에 필요한 최소 데이터:

- operational state
- owner
- applied/reversed usage count
- total discount amount
- last used at
- budget used / remaining
- max redemptions / remaining
- policy completeness issues
- createdAt / updatedAt

요약에 필요한 최소 데이터:

- Live
- Starts within 24h
- Ends within 24h
- Paused
- Expired
- Policy incomplete
- No end date
- Redemptions today
- Discount cost today
- Active fixtures

#### 2.2 상태와 정렬

`Records` 하나로 합치지 말고 API/프런트 모두 다음 상태를 지원한다.

- live
- scheduled
- paused
- expired
- policy-incomplete
- archived
- all

기본 정렬:

- Live: 종료 임박 → 예산 소진율 → 최근 사용
- Scheduled: 시작 임박
- Paused: 최근 변경
- Expired/Archived: 최근 종료/변경
- Policy incomplete: 위험도 → 최근 변경
- All: 최근 변경

사용자가 선택할 수 있는 sort:

- ends-soon
- starts-soon
- highest-exposure
- recently-changed
- code-asc

필터/query parsing, return context, pagination을 보존하고 잘못된 query는 안전한 기본값으로 정규화한다.

#### 2.3 Usage summary API

현재 페이지 10건이 아니라 전체 집계 summary를 API에서 계산한다.

- all linked bookings/redemptions
- applied/reversed count
- total customer paid
- total discount
- reversed discount
- completed/cancelled count
- first used / last used

기존 payment metadata 기반 과거 레코드와 새 Redemption 원장을 함께 읽는 migration/compatibility 전략을 구현하라. 중복 합산하지 않는다.

#### 2.4 권한

페이지 위치는 `Growth & Communications > Coupons`로 유지한다. 현재 `SYSTEM_COUPONS`가 SYSTEM parent에 연결된 구조를 검토하고 가능한 최소 변경으로 조회와 mutation을 분리한다.

목표 권한 의미:

- coupon view
- coupon edit
- coupon activate/pause
- coupon delete/archive

프로젝트 enum/manifest/guard 구조상 새 key가 migration을 요구하면 올바른 migration과 호환 alias를 제공한다. 기존 Master Admin 접근을 깨뜨리지 않는다. 권한 없음, view-only, mutation 일부만 허용되는 상태를 UI와 API 모두 테스트한다.

### Phase 3 — 1440px 운영 화면 재구성

이 화면은 Impeccable의 `Operate` 모드로 다룬다. 장식보다 스캔 속도, 위험 신호, 대표 액션, 일관성을 우선한다.

#### 3.1 상단 정보 구조

- 큰 KPI 카드 3개를 compact metric strip으로 바꾼다.
- 동일 count를 metric과 filter에서 불필요하게 반복하지 않는다.
- freshness timestamp는 페이지 단위 하나로 표시한다.
- metric strip에는 Live, starts <24h, ends <24h, policy incomplete, redemptions today, discount today를 우선한다.
- active fixture가 1개 이상이면 정상 카드가 아니라 release-blocking danger notice를 최상단에 표시한다.

#### 3.2 필터

상태 segmented control:

- Live
- Scheduled
- Paused
- Expired
- Needs setup
- All

별도 quick filter:

- No end date
- Zero usage
- Fixture
- Ends <24h
- Budget near limit

검색은 code/description/owner를 지원한다. Apply와 Reset 동작, URL query, pagination 초기화를 일관되게 유지한다.

#### 3.3 표

1440 × 1000에서 **표 내부 가로 스크롤이 없어야 한다**.

권장 열:

1. Coupon: code, description, discount
2. Availability: operational state, start/end 또는 핵심 경고
3. Exposure: uses, total discount, budget/limit remaining
4. Owner / updated
5. Actions

동작 요구:

- 대표 액션은 Manage 또는 Pause/Activate 하나만 직접 노출한다.
- Edit/Delete/Archive는 `ActionMenu`의 실제 dropdown으로 이동한다.
- Delete는 menu를 열기 전 화면에 보이면 안 된다.
- Actions는 오른쪽 sticky 140~160px 범위를 목표로 한다.
- 긴 code/description/owner가 표 폭을 깨뜨리지 않게 ellipsis/clamp와 전체값 접근 수단을 제공한다.
- 페이지 pagination을 유지하고 표 내부 세로 스크롤을 제거한다.
- sticky header는 유지할 수 있지만 nested vertical scroll은 만들지 않는다.
- `ACTIVE`와 `Available at checkout now`처럼 같은 뜻을 반복하지 않는다.

CSS 숫자를 먼저 고정하지 말고 실제 1440px 캡처에서 열 폭을 측정한 뒤 조정한다. 완료 시 table container의 `scrollWidth <= clientWidth`를 자동 또는 브라우저 assertion으로 검증한다.

#### 3.4 생성 drawer

기존 장점은 유지한다.

- Paused 기본 생성
- 코드 50개 배치
- 코드 정규화/중복/길이 검증
- ICT 표기
- 부분 성공 결과

추가 필드/정보:

- owner
- max redemptions 또는 budget
- per-customer limit, 기본 1
- minimum order
- end date 또는 no-end approval reason
- Funding: Company
- Accounting: Marketing expense
- Partner settlement base: Pre-coupon service amount
- Estimated maximum liability

50개 batch가 동일한 정책을 공유한다는 사실을 명확히 표시하고 저장 전 accepted code preview를 제공한다.

#### 3.5 수정 drawer

- 현재 operational state와 정책 completeness를 상단에 표시한다.
- 이미 사용된 쿠폰을 수정하면 다음 경고를 표시한다.
  - `Past bookings keep the original coupon snapshot. Future bookings use this change.`
- discount/window/limit/budget 변경이 미래 예약에 미치는 영향을 보여준다.
- 최근 변경 5건의 actor, reason, before/after, time을 표시한다.
- version conflict는 조용히 덮어쓰지 말고 reload/compare 안내를 한다.

#### 3.6 Usage drawer

- 빈 상태를 120~180px 수준의 compact 상태로 줄인다.
- 빈 상태에도 code, status, owner, window와 Edit/Pause/Marketing link를 제공한다.
- 데이터가 있으면 `Campaign summary`와 `Current page rows`를 분리한다.
- summary 금액은 전체 데이터 기준임을 명시한다.
- Marketing Analytics와 Coupon Finance로 coupon code를 유지하는 scoped link를 추가한다.

#### 3.7 Activation/Pause/Delete 확인

확인창에 최소 다음을 표시한다.

- code / discount
- start/end
- owner
- use count / total discount
- remaining budget/limit
- company-funded liability
- 고객 영향
- reason 입력

100%, No end date, policy threshold 초과는 typed confirmation을 추가한다. 사용된 쿠폰은 Delete 대신 Archive/Pause 경로를 안내한다.

#### 3.8 Preview checkout

생성/수정 drawer에서 읽기 전용 preview를 제공한다.

- representative service 선택
- original price
- discount
- customer pays
- company expense
- window result
- limit/budget result

Preview API는 실제 service/provider 가격을 서버에서 다시 읽어 계산하며, 클라이언트가 보낸 subtotal을 권위 값으로 신뢰하지 않는다. Preview 성공은 activation 보장이 아니다.

### Phase 4 — Audit, copy, error, accessibility hardening

#### 4.1 Audit

Create/Update/Activate/Pause/Delete/Archive에 다음을 남긴다.

- actor
- reason
- before
- after
- occurredAt
- request/event ID
- target coupon/version

Redemption apply/reverse도 booking/payment/refund/settlement reference로 추적 가능하게 한다.

#### 4.2 오류 상태

각 상태를 서로 구분한다.

- 400 validation
- 401 session expired
- 403 permission denied
- 404 target missing
- 409 version/limit conflict
- 429 rate limited
- 500/503 source unavailable

오류 시 입력값을 보존하고, mutation이 실제 적용됐는지 불명확한 경우 재시도 전에 현재 coupon 상태를 다시 확인하도록 안내한다.

#### 4.3 문구

다음 원칙을 적용한다.

- 빈 description: `No campaign description`
- policy 미완성: `Needs setup`과 누락 필드 표시
- fixture: `Test fixture — unavailable at checkout`
- 사용 없음: `No redemption has been recorded.`
- page-only 금액을 전체 금액처럼 표시하지 않는다.
- action 성공 notice에는 이전 상태, 새 상태, 적용 시각을 포함한다.

#### 4.4 접근성과 hardening

- drawer focus trap/return focus
- keyboard-only로 filter, row action, drawer, confirm 사용 가능
- dialog/drawer accessible name 유지
- live region 중복 announcement 방지
- 상태를 색상만으로 표현하지 않기
- 80자 code, 500자 description, 긴 owner 이름, 큰 금액, 1000건 이상 usage, 빈/오류/권한 상태 검사
- 중복 submit과 빠른 연속 activation 방지
- CJK/베트남어 문자와 긴 영어 문구가 overflow를 만들지 않게 한다.

## 6. 구현하지 말아야 할 것

- Coupons/Marketing Analytics/Coupon Finance를 한 거대한 페이지로 합치지 않는다.
- 기존 Admin 디자인 시스템을 버리고 새 UI library를 도입하지 않는다.
- 모바일/1024px 이하 대응을 이유로 1440px 레이아웃을 복잡하게 만들지 않는다.
- row마다 usage API를 호출하는 N+1 구현을 하지 않는다.
- payment metadata 과거 데이터와 새 Redemption을 이중 합산하지 않는다.
- client-side count만으로 coupon limit을 강제하지 않는다.
- preview 요청의 subtotal을 최종 금액으로 신뢰하지 않는다.
- 사용된 쿠폰을 hard delete하지 않는다.
- legacy coupon을 근거 없이 정상 operator coupon으로 backfill하지 않는다.
- 실제 SMOKE 83개에 대한 pause/delete/archive apply를 승인 없이 실행하지 않는다.
- 테스트 통과를 위해 business rule을 완화하지 않는다.
- 관련 없는 finance, auth, matching, wallet 코드를 정리하지 않는다.
- 작업 결과를 커밋하지 않는다. 사용자가 명시적으로 요청한 경우에만 커밋한다.

## 7. 테스트 요구사항

기존 테스트를 보존하고 다음을 추가한다.

### API/DB

- provenance은 client가 위조할 수 없음
- fixture는 checkout 불가 또는 정책에 따라 명확히 fail closed
- policy incomplete coupon checkout 거부
- total cap 마지막 1개에 동시 요청 2개 → 정확히 1개 성공
- budget 마지막 금액 동시 요청 → 초과 없음
- per-customer limit 동시 요청 → 초과 없음
- 동일 booking retry → redemption 1개
- payment/booking 실패 → reservation release
- cancellation/refund 반복 요청 → reversal 1회
- settlement snapshot과 redemption 금액 일치
- legacy payment metadata usage와 new redemption 중복 없음
- start === end 거부
- active fixture release gate 실패
- cleanup dry-run/apply confirmation/used coupon archive 규칙

### Admin Web

- Live/Scheduled/Paused/Expired/Needs setup/All filter
- sort/query/pagination/return context
- summary와 row aggregate 표시
- view-only/permission-denied/mutation permission 조합
- Delete dropdown 기본 닫힘
- used coupon delete 대신 archive guidance
- create 필수 정책과 batch partial result
- edit version conflict
- usage 전체 summary와 page rows 분리
- compact empty state
- API source별 독립 error state

### 브라우저/E2E

1440 × 1000에서 다음을 캡처하고 확인한다.

1. 기본 Live 목록
2. Fixture/Needs setup danger state
3. Scheduled/Paused/Expired 빈 상태
4. 생성 drawer
5. 수정 drawer
6. 사용내역 empty/data 상태
7. Action dropdown 닫힘/열림
8. Activation confirmation
9. permission denied/read-only
10. API failure

필수 assertion:

- coupon table horizontal overflow 없음
- Actions와 핵심 열이 한 화면에 보임
- Delete는 dropdown을 열기 전 미노출
- drawer/confirm keyboard focus 정상
- console error/warning 없음

## 8. 실행할 검증 명령

Windows에서는 `npm.cmd`를 사용한다. 실제 변경 파일에 맞춰 focused test를 먼저 실행하고 이후 보호 영역 검증으로 확장한다.

최소 검증:

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- app/coupons
npm.cmd run test --workspace @massage-vn/api -- src/bookings/bookings.pricing.spec.ts src/settlements/coupon-settlement.spec.ts src/admin/admin.service.spec.ts -t "coupon|redemption"
npm.cmd run prisma:migrations:check
npm.cmd run verify:scope -- -Scope api
npm.cmd run verify:scope -- -Scope admin
```

`schema.prisma`, migrations, bookings, payments, settlements, shared contracts 등 보호 영역의 동작을 바꿨으므로 최종적으로 다음도 실행한다.

```powershell
npm.cmd run verify:local
```

서비스/외부 환경 때문에 전체 검증을 실행할 수 없다면 성공으로 간주하지 말고, 정확한 실패 명령·원인·미검증 위험을 최종 보고서에 남긴다.

## 9. 완료 기준

코드 구현 완료 기준:

- fixture provenance와 safe cleanup 도구가 구현됨
- cleanup dry-run manifest가 생성되고 apply는 실행되지 않음
- active fixture release gate가 구현됨
- Coupon policy와 Redemption ledger migration이 존재함
- 원자적 total/customer/budget 제한이 서버에서 강제됨
- cancel/refund reversal이 idempotent함
- 목록 API가 usage/discount/budget/owner/policy 상태를 반환함
- usage API가 전체 summary를 반환함
- Paused와 Expired가 분리됨
- 1440px 표 가로 스크롤이 제거됨
- Delete가 dropdown으로 이동함
- 생성/수정/확인에 owner, limits, budget, liability, reason이 반영됨
- scoped Marketing Analytics/Coupon Finance link가 있음
- mutation audit에 before/after/reason이 남음
- focused test와 보호 영역 검증이 통과함
- before/after 브라우저 증거가 저장됨

데이터 rollout 완료 기준은 별도로 표시한다.

- 실제 83개 SMOKE 후보의 dry-run 결과 검토
- 사용자 승인 후에만 pause/archive/delete apply
- Live fixture 0
- Active policy-incomplete 0

승인 없이 데이터 rollout까지 완료했다고 주장하지 않는다.

## 10. 산출물

다음을 남긴다.

1. 구현 코드와 migration
2. coupon fixture cleanup script와 tests
3. 관련 unit/integration/browser tests
4. before/after 화면 증거 폴더
5. `docs/audits/coupons-remediation-implementation-report-YYYY-MM-DD.md`

구현 보고서에는 다음을 포함한다.

- 보고서 요구사항별 `완료 / 부분 완료 / 미완료`
- 변경 파일
- migration/backfill 전략
- cleanup dry-run 후보 수와 분류
- 실행한 명령과 pass/fail/skipped
- 보호 영역 변경
- 브라우저 캡처 링크
- 남은 데이터 rollout 승인 작업
- 남은 위험
- 출시 가능 여부와 점수

## 11. 최종 응답 형식

최종 응답은 다음 순서로 작성한다.

1. 한 줄 판정
2. 구현 완료 항목
3. cleanup dry-run 결과와 apply 미실행 사실
4. 테스트/검증 결과
5. 보호 영역 변경
6. 남은 위험 또는 사용자 승인 필요 작업
7. 구현 보고서 링크
8. 다음 권장 작업 1개

중요: 일부 항목을 구현하지 못했으면 숨기지 말고 이유와 출시 영향을 명시하라. 테스트가 통과해도 Live fixture, 정책 미완성, 동시성 또는 reversal이 해결되지 않았으면 출시 가능으로 판정하지 마라.

---

## 이 프롬프트의 사용 메모

- 이 작업은 DB schema, migration, booking, settlement, 권한을 포함하므로 작은 UI 수정 작업보다 훨씬 크다.
- Codex 앱에서는 새 작업을 열어 이 프롬프트를 사용하는 편이 좋다.
- Plan 모드로 시작해도 되지만 계획 승인만 기다리지 말고 구현까지 진행하도록 프롬프트에 이미 명시돼 있다.
- 실제 83개 SMOKE 레코드 정리 apply 단계에서는 Codex가 사용자 승인을 요청하는 것이 정상이다.
