# Codex 실행 프롬프트 — Customer Referrals 출시 차단 문제 및 운영 UX 개선

아래 `실행용 프롬프트` 전체를 새 Codex 작업에 그대로 붙여 넣는다. 이 프롬프트는 `/referrals/customers`의 화면만 다듬는 작업이 아니라 테스트 데이터 격리, 추천 보상 자격 근거, wallet 변경 안전성, 운영 화면·문구, 읽기 성능, 회귀 테스트와 브라우저 검증을 하나의 작업 흐름으로 연결한다.

---

## 실행용 프롬프트

당신은 `C:\dev\massage-on-demand-vn` 저장소에서 HANDS 관리자 `Customer Referrals`를 실제 운영 가능한 수준으로 개선하는 Codex다.

분석이나 제안만 하고 끝내지 말고 다음을 순서대로 완료하라.

1. 재감사 보고서와 현재 코드를 대조한다.
2. 문제를 `해결됨 / 부분 해결 / 미해결 / 보고서 이후 변경됨`으로 판정한다.
3. 출시 차단 문제부터 안전하게 구현한다.
4. 관련 테스트를 작성하고 실행한다.
5. 로그인된 실제 관리자 화면을 1440px 이상에서 검증한다.
6. 구현 보고서와 증거를 저장한다.

계획은 먼저 세우되 계획만 제출하고 멈추지 말고 구현까지 계속 진행하라. 다만 실제 운영 데이터 삭제·수정, fixture cleanup apply, referral policy 강제 복원, wallet 원장 mutation처럼 외부 상태를 변경하거나 복구하기 어려운 작업 직전에는 반드시 멈추고 사용자 승인을 받아라.

## 1. 최종 목표

`/referrals/customers`를 다음 질문에 운영자가 즉시 답할 수 있는 안전한 운영 도구로 만든다.

1. 지금 사람이 처리해야 하는 추천 보상은 무엇인가?
2. 이 보상은 어떤 고객 관계와 어떤 완료·결제 예약을 근거로 하는가?
3. integrity, policy snapshot, hold 기간, wallet 상태가 모두 안전한가?
4. 지금 가능한 액션은 무엇이며, 불가능하다면 정확히 무엇이 부족한가?
5. reward를 release, credit, reverse하면 wallet과 감사 이력에 어떤 변화가 생기는가?
6. 현재 화면의 데이터가 실제 운영 데이터인지 테스트 fixture인지 구분할 수 있는가?
7. 운영자가 1440px 화면에서 가로 스크롤 없이 핵심 정보와 대표 액션을 볼 수 있는가?

최종 화면은 기존 HANDS Admin 디자인 시스템을 유지해야 한다. 새로운 시각 세계를 만들거나 장식적인 대시보드로 바꾸지 말고, `Operate` 모드에 맞게 스캔성, 사실성, 금액 안전성, 근거와 다음 행동을 우선한다.

## 2. 반드시 먼저 읽을 자료

작업 전에 다음을 읽고 현재 구현과 대조하라.

- `AGENTS.md`
- `docs/audits/referrals-customers-final-reaudit-2026-08-12.md`
- `docs/audits/referrals-customers-reaudit-evidence-2026-08-12/`
- `docs/superpowers/specs/2026-06-24-referral-rewards-design.md`
- `apps/admin_web/app/referrals/customers/page.tsx`
- `apps/admin_web/app/referrals/customers/[id]/page.tsx`
- `apps/admin_web/app/referrals/referral-dashboard.tsx`
- `apps/admin_web/app/referrals/referral-detail.tsx`
- `apps/admin_web/app/referrals/actions.ts`
- `apps/admin_web/app/referrals/**/*spec*`
- `apps/admin_web/components/admin-overview-card.tsx`
- `apps/admin_web/components/metric-card.tsx`
- `apps/admin_web/components/admin-data-table.tsx`
- `apps/admin_web/lib/admin-api.ts`의 referral 계약
- `apps/admin_web/app/globals.css`의 referral/table/summary 관련 규칙
- `apps/api/src/admin/admin-referral.routes.ts`
- `apps/api/src/admin/admin.service.ts`의 referral policy, parent, reward queue, reward action helper
- `apps/api/src/admin/admin.dto.ts`의 referral DTO
- `apps/api/src/referrals/referrals.service.ts`
- `apps/api/src/referrals/**/*spec*`
- `apps/api/prisma/schema.prisma`의 ReferralCode, ReferralAttribution, ReferralReward, wallet/ledger 관계
- `infra/scripts/referral-smoke-seed.mjs`
- 기존 fixture cleanup, release gate, dry-run manifest 구현 패턴
- Admin operator permission manifest와 Finance/System Policy 권한 구현

보고서 작성 후 코드가 바뀌었다면 최신 코드를 우선한다. 그러나 보고서 항목을 조용히 생략하지 말고 각 항목의 현재 상태와 근거를 구현 보고서에 남겨라.

## 3. 저장소 및 작업 제약

- 작업 루트는 반드시 `C:\dev\massage-on-demand-vn`이다.
- `AGENTS.md`에 따라 단일 에이전트로 순차 작업한다.
- 기존 dirty worktree와 사용자의 미커밋 변경을 보존한다.
- 관련 없는 코드, 문서, CSS를 정리하거나 되돌리지 않는다.
- 보호 영역 변경은 최소화하고 matching scope verification을 수행한다.
- 현재 디자인 토큰, Admin 컴포넌트, table, drawer, notice, status badge, form 패턴을 재사용한다.
- 새로운 production dependency는 정말 필요하지 않으면 추가하지 않는다.
- user-facing Admin 문구는 현재 제품과 동일하게 영어를 유지한다.
- `Partner`를 사용자 문구로 사용하고 내부의 기존 provider 명칭을 무리하게 일괄 변경하지 않는다.
- 1024px 이하 화면은 설계, 테스트, 캡처, 보고에서 완전히 제외한다.
- 기준 viewport는 `1440 × 1000`, 추가 확인은 `1600 × 1000`이다.
- 모바일 대응을 위해 데스크톱 정보 밀도를 희생하지 않는다.
- 전체 디자인 개편, 새로운 폰트·팔레트, 과한 animation, gradient, 대형 장식 카드는 추가하지 않는다.
- DB reset, `prisma migrate reset`, 임의 `db push`, broad update/delete, raw SQL cleanup을 실행하지 않는다.
- `.env*`, 인증 비밀, wallet/결제 자격증명을 출력하거나 수정하지 않는다.
- 기존 `metadata`로 해결할 수 있는 fixture 구분을 위해 새 migration을 만들지 않는다.
- UI에서 버튼을 숨기는 것으로 보안·금액 통제가 끝났다고 간주하지 않는다. 최종 권한과 검증은 API/domain service에 둔다.
- 실제 wallet ledger를 테스트 목적으로 생성·수정·삭제하지 않는다.
- 실제 fixture cleanup apply와 policy 복원 apply는 코드·dry-run까지만 준비하고 사용자 승인 없이 실행하지 않는다.
- 브라우저 검증은 사용자가 로그인한 인앱 브라우저를 우선 사용한다. 세션이 만료됐다면 로그인 화면까지만 열고 사용자에게 로그인을 요청한다.
- Impeccable skill을 사용할 수 있으면 기존 시각 체계를 보존한 `harden`, `clarify`, `layout`, `optimize` 관점으로 구현한다. UI 변경 완료 후 detector를 한 번만 실행한다.

## 4. 재감사에서 확인된 사실

다음은 2026-08-12 재감사 시점의 실제 화면과 코드에서 확인된 사실이다.

- 기본 큐: Ready 0 VND, On hold 25,000 VND 1건, Pending 0, Credited 50,000 VND 1건
- 부모/추천 고객명이 `Smoke Referral ...`로 표시됨
- 정책 메모: `Smoke policy for customer referral admin UI checks.`
- attribution은 `Qualified`, integrity는 `Clear`
- 동시에 보상에는 `No qualifying booking linked` 또는 `Booking evidence unavailable`가 표시됨
- booking evidence가 없어도 Held reward에 `Release hold`가 노출됨
- `infra/scripts/referral-smoke-seed.mjs`는 `metadata: { smoke: 'referral-admin' }`를 저장함
- 같은 seed는 reward를 `qualifyingBookingId: null`로 생성함
- Admin referral 조회 조건은 fixture metadata를 기본 제외하거나 행에 표시하지 않음
- 1440px에서 reward queue의 `Action` 열이 잘림
- 상세 reward ledger는 내부 가로 스크롤이 있어야 Action에 도달 가능함
- `Ready to credit` 빠른 큐를 선택해도 표 제목은 `Needs action`
- 정적 정책/부모/링크/operations 지표에 `Current filters`, `All records`, `Pending` 범위 배지가 잘못 표시됨
- 정책 impact preview의 `After save`는 실제 전/후 값을 계산하지 않음
- 상세 상단 KPI, Referral operations board, Decision timeline이 같은 상태를 반복함
- 기본 페이지는 access, parent rows, filtered summary, reward queue, all-parent summary를 병렬로 읽고 filtered/all summary를 중복 집계함
- Referral 핵심 테스트 182개는 통과했지만 marketing campaign id 대소문자 계약 테스트 2개는 실패함
- strict API budget은 API 서비스 미실행으로 측정되지 않음

이 사실을 단순 개발 환경 특성으로 무시하지 말고, 운영 화면과 운영 데이터 계약의 결함으로 처리하라.

## 5. 구현 순서

아래 Phase를 순서대로 수행한다. 각 Phase가 끝날 때 관련 테스트를 통과시킨 뒤 다음 Phase로 이동한다. P0가 해결되지 않았는데 UI만 완료됐다고 보고하지 않는다.

### Phase 0 — 현재 상태 재확인과 안전 기준 고정

1. 감사 보고서의 항목을 체크리스트로 만든다.
2. 현재 코드에서 각 항목이 여전히 존재하는지 확인한다.
3. wallet credit/reverse, booking closeout, policy snapshot, fixture seed의 실제 권위 경로를 추적한다.
4. 기존 idempotency, source key, Serializable transaction, expected status/updatedAt, compensating ledger를 보존한다.
5. 기존 referral 테스트를 수정 전에 실행해 baseline을 기록한다.
6. `REFSMOKE`와 `refsmoke` 중 어느 형태가 권위 계약인지 사용처를 추적하고, 마케팅 집계·referral source key·기존 데이터 호환을 깨지 않는 한쪽으로 테스트와 코드를 정렬한다.

Phase 0에서 기존 도메인 안전장치를 임의로 단순화하거나 테스트 기대값만 무조건 낮추지 않는다.

### Phase 1 — Test fixture 격리와 smoke lifecycle

#### 1.1 기존 metadata를 이용한 fixture 판정

새 schema를 만들기 전에 이미 있는 다음 metadata를 재사용한다.

- `metadata.smoke === 'referral-admin'`
- 가능하면 `metadata.fixtureRunId`
- fixture audience/customer/partner 식별 정보

공통 helper를 만들어 ReferralCode, ReferralAttribution, ReferralReward의 fixture 판정을 일관되게 처리한다. JSON metadata 접근 방식은 현재 Prisma/PostgreSQL 구현과 프로젝트 관례를 따른다.

#### 1.2 운영 조회에서 기본 제외

다음 조회 경로에 fixture 정책을 적용한다.

- customer referral parent list
- customer reward queue
- customer referral summary와 attention count
- customer parent detail
- partner referral에 공유 helper가 적용되는 경우 동일한 안전성
- referral 관련 마케팅/재무 집계 중 운영 truth로 사용되는 경로

요구사항:

- production/shared 운영 모드에서는 fixture가 기본 제외된다.
- 단순 query parameter만으로 일반 운영자가 fixture를 포함할 수 없게 한다.
- 개발 환경에서 fixture 표시가 필요하면 Developer/System 권한과 명시적인 include 조건을 모두 요구한다.
- 개발 화면에 fixture를 포함하면 페이지 상단과 각 행/상세에 `TEST FIXTURE · wallet actions disabled`를 표시한다.
- fixture의 release, credit, reverse, cashout 같은 실제 금액 mutation은 UI와 API 모두에서 차단한다.
- summary count/amount에서도 fixture가 제외된다.

#### 1.3 Smoke policy 오염 방지

현재 화면에 Smoke policy notes가 남은 원인을 추적한다.

- smoke가 실행 전 policy snapshot을 저장하도록 한다.
- smoke가 policy를 바꿨다면 `finally`에서 안전한 복원을 시도한다.
- 복원은 현재 policy가 해당 run이 쓴 값/버전과 정확히 일치할 때만 수행한다.
- 다른 운영자가 중간에 바꿨다면 덮어쓰지 말고 conflict를 보고한다.
- production/shared DB에서는 명시적인 fixture 허용 없이는 policy mutation smoke를 차단한다.
- 가능하면 isolated test DB에서 실행하는 경로를 기본으로 한다.

현재 저장된 Smoke policy를 이 작업에서 임의로 복원하지 않는다. 먼저 current value, 예상 원본, 마지막 감사 로그, safe restore 가능 여부를 dry-run 보고서로 출력하고 사용자 승인을 기다린다.

#### 1.4 Fixture inventory와 cleanup

기존 cleanup 스크립트 패턴을 재사용해 referral fixture inventory/cleanup 도구를 작성한다.

- 기본 실행은 dry-run이다.
- exact ReferralCode, Attribution, Reward, wallet ledger reference, policy audit relation을 출력한다.
- 각 대상의 metadata, 상태, 금액, qualifying booking, wallet ledger 존재 여부를 표시한다.
- wallet ledger가 있는 fixture는 hard delete 금지다.
- wallet ledger가 없는 fixture도 관계 순서를 확인하지 않고 삭제하지 않는다.
- cleanup apply는 reviewed manifest, exact ids, 강한 confirmation 없이는 실패한다.
- production apply에는 별도 environment confirmation을 요구한다.
- 이 작업에서는 dry-run까지만 실행한다.

#### 1.5 완료 기준

- 운영 조회에서 fixture reward/amount/count가 0이다.
- dev include 상태에서는 명확한 TEST FIXTURE 표시가 있다.
- fixture wallet action API가 거부된다.
- smoke가 실제 policy를 남기지 않는다.
- cleanup dry-run은 안전한 manifest를 만들지만 실제 데이터는 바꾸지 않는다.

### Phase 2 — Qualifying booking evidence gate

이 Phase가 금액 안전성의 핵심이다. UI 조건보다 API/domain 검증을 먼저 구현한다.

#### 2.1 서버 전제조건

비-fixture reward의 `release held reward`와 `credit to wallet` 직전에 다음을 서버에서 다시 검증한다.

- `qualifyingBookingId`가 존재함
- booking이 실제로 존재함
- booking 상태가 referral 자격을 발생시킨 완료 상태임
- 현재 출시 결제 정책에서 paid/settled 증거가 충족됨
- booking reversal/refund/fraud/admin block 등 무효화 조건이 없음
- attribution status가 Qualified임
- fraud/integrity 상태가 허용됨
- reward calculation snapshot이 존재하고 금액/currency가 유효함
- reward가 기대 상태와 expectedUpdatedAt을 유지함
- wallet ledger가 아직 없는 credit/release 상태임
- policy cap/count와 기존 source key/idempotency 계약을 깨지 않음

booking/payment 조건을 Admin UI에서 새로 계산하지 말고 기존 booking closeout/referral domain의 권위 helper를 재사용하거나 하나의 도메인 validator로 추출한다. UI 입력값으로 자격을 만들어 내지 않는다.

#### 2.2 실패 계약

필수 근거가 없으면 API는 상태를 변경하지 않고 구조화된 conflict/domain error를 반환한다.

최소 error reason 예시:

- `QUALIFYING_BOOKING_MISSING`
- `QUALIFYING_BOOKING_NOT_ELIGIBLE`
- `PAYMENT_EVIDENCE_MISSING`
- `ATTRIBUTION_NOT_QUALIFIED`
- `INTEGRITY_REVIEW_REQUIRED`
- `REFERRAL_FIXTURE_MUTATION_BLOCKED`
- `REWARD_STATE_CHANGED`

기존 Admin API 오류 형식이 있으면 그 형식을 재사용한다. 오류 문구만 문자열 비교하는 구조를 만들지 않는다.

#### 2.3 Admin 화면의 blocker 표현

- booking evidence가 없으면 액션을 숨기지 말고 disabled 상태와 차단 사유를 보여 준다.
- 문구: `Blocked: qualifying booking evidence is missing.`
- 다음 행동: `Open booking`, `Open attribution evidence`, `View audit history` 중 실제 가능한 링크만 제공한다.
- Release/Credit confirmation은 서버 evidence preflight 결과를 사용한다.
- UI에서 booking id가 있다고 API 검증을 생략하지 않는다.
- Reverse는 credited reward의 compensating ledger 계약을 유지한다.

#### 2.4 예외 승인 범위

일반 Release를 약하게 만들어 수동 예외를 허용하지 않는다. 저장소에 이미 dual-control exception 패턴이 있고 안전하게 재사용할 수 있을 때만 별도 후속 흐름을 구현한다.

그렇지 않으면 이번 작업에서는 다음을 문서화하고 exception UI를 만들지 않는다.

- 필요한 evidence attachment/reference
- 별도 Finance approver
- exception audit action
- 적용 가능한 상태와 금액 한도
- compensating/reversal 절차

#### 2.5 완료 기준

- booking/payment evidence 없는 비-fixture release/credit 요청은 상태·wallet·audit을 변경하지 않는다.
- 동일 요청 재시도와 동시 요청에서도 중복 credit가 없다.
- 화면은 정확한 blocker와 해결 경로를 보여 준다.
- 정상 evidence가 있는 reward만 기존 안전한 flow로 진행된다.

### Phase 3 — 목록 정보 구조와 1440px 액션 가시성

#### 3.1 상단 명령 구조

기존 큐를 유지하되 큰 카드와 중복 설명을 늘리지 않는다.

- `Needs action`
- `Ready to credit`
- `On hold`
- `Pending checks`
- `Credited history`
- `All records`

상단에는 현재 큐의 다음 정보만 compact하게 보여 준다.

- count
- amount
- oldest/next SLA 또는 최근 decision 시각
- owner: Growth review 또는 Finance decision

정확한 SLA 데이터가 없으면 임의 목표 시간을 만들지 말고 `Oldest waiting` 또는 `Last decision`을 사용한다.

#### 3.2 큐별 제목과 빈 상태

다음 매핑을 단일 configuration에서 관리해 탭, 제목, result tone, 빈 상태가 서로 어긋나지 않게 한다.

| reward | Table title | Empty title | Empty message |
|---|---|---|---|
| `attention` | Needs action | No reward work | No customer referral rewards currently need action. |
| `available` | Ready to credit | Nothing ready to credit | No rewards have completed the required evidence checks. |
| `held` | On hold | No held rewards | No rewards are currently held for review. |
| `pending` | Pending checks | No pending rewards | No rewards are waiting for the hold period or automated checks. |
| `credited` | Credited history | No credited rewards | No customer referral rewards have been posted to wallet. |
| `all` | All reward records | No reward records | No customer referral reward records are available. |

quick queue 선택은 검색 필터 실패가 아니다. `q`, status, fraud/integrity, range 같은 추가 조건이 있을 때만 `No matching ...`과 `Clear filters`를 표시한다.

#### 3.3 결과 단위

reward와 parent account를 같은 `shown of total` 문구에서 비교하지 않는다.

- 큐: `1 reward shown`
- 부모 disclosure: `2 parent accounts`
- 전체 활동: `3 rewards · 2 referred customers`

API와 컴포넌트 prop 이름도 단위를 드러내게 한다. 단순히 화면 문구만 바꾸고 서로 다른 count를 계속 전달하지 않는다.

#### 3.4 1440px 큐 표

큐는 다음 5열을 기준으로 재구성한다.

1. `Relationship`
   - Parent customer
   - `→` Referred customer
   - 전화번호 또는 short customer id
2. `Evidence`
   - Booking linked/missing
   - Qualified/pending/blocked
   - Integrity clear/review required
3. `Reward`
   - VND amount
   - Pending/Available/Held/Credited
4. `Decision`
   - Last human-readable decision
   - operator/time 또는 waiting age
5. `Action`
   - 항상 보이는 `Review`

요구사항:

- Parent와 referred customer를 별도 넓은 열 두 개로 유지하지 않는다.
- raw attribution id를 고객 보조문구로 사용하지 않는다.
- Action 열은 오른쪽 sticky, 120~144px 범위의 고정 폭으로 둔다.
- table 전체가 1440px Admin content 폭 안에 들어와야 한다.
- 기본 큐에서 내부 가로 스크롤이 없어야 한다.
- 긴 decision은 한 줄 의미 요약 후 detail/disclosure에서 전체 evidence를 보여 준다.
- 상태는 색상만으로 전달하지 않고 텍스트를 유지한다.

#### 3.5 부모 기록

- `All parent records` disclosure는 기본 접힘을 유지해도 된다.
- disclosure 제목에 parent count를 명시한다.
- 부모 탐색 표가 별도 목적이면 reward queue와 결과/필터 count를 공유하지 않는다.
- 부모 이름, referred count, eligible bookings, reward exposure, latest activity, profile action을 우선한다.
- 단순 raw ID와 중복 전화번호는 접거나 줄인다.

#### 3.6 완료 기준

- 1440 × 1000에서 Relationship, Evidence, Reward, Decision, Review가 가로 스크롤 없이 보인다.
- 선택한 quick queue와 제목·설명·빈 상태가 일치한다.
- reward count와 parent count가 섞이지 않는다.
- fixture 포함 개발 모드에서도 TEST FIXTURE 표시 때문에 Action이 잘리지 않는다.

### Phase 4 — 상세 페이지를 evidence 중심으로 정리

#### 4.1 Command strip

상세 상단은 다음 4개 판단만 한 줄에 둔다.

- `Current decision`
- `Reward amount`
- `Evidence readiness`
- `Next operator action`

5번째 카드가 다음 줄에 혼자 남는 auto-fit 구성을 제거한다. 값이 길어지면 카드 수를 늘리지 말고 내용 우선순위를 조정한다.

#### 4.2 중복 Operations board 제거

- `Referral operations board`는 제거한다.
- 유일한 정보가 있다면 command strip, ledger header chips, timeline에 이동한다.
- `Decision timeline`은 자격 → integrity → hold/ready → wallet의 주 evidence 흐름으로 유지한다.
- 상단 KPI, board, timeline에 같은 count/amount를 세 번 표시하지 않는다.

#### 4.3 Parent와 sharing 정보

Parent account 카드의 이름/전화를 한 번만 표시한다.

- heading: customer name
- helper: phone + short customer id
- action: `Open customer profile`
- referral code와 public/app link readiness는 `Sharing readiness` 블록으로 분리
- missing public base/Android/iOS 설정은 blocker와 해결 경로를 유지

#### 4.4 Evidence checklist

Reward마다 다음 evidence를 한 블록에서 확인할 수 있게 한다.

- attribution qualified
- integrity clear 또는 review required
- qualifying booking linked
- booking completed/paid evidence
- calculation snapshot/policy version
- hold period state
- wallet ledger posted/not posted

각 항목은 `Ready`, `Missing`, `Blocked`, `Not applicable`처럼 텍스트로 표현한다. 존재하지 않는 증거를 성공처럼 보이게 하지 않는다.

#### 4.5 Reward ledger

- 1440px에서 Action까지 내부 가로 스크롤 없이 보이게 열을 축약한다.
- 추천 고객, booking/evidence, amount/state, wallet/decision, action 중심으로 구성한다.
- raw attribution id, wallet ledger id, internal action key는 `Technical details` disclosure로 이동한다.
- raw id에는 short display와 Copy를 제공한다.
- `referral_reward.hold`는 `Hold placed`처럼 운영 문구로 번역한다.
- credited row는 `Reverse reward`만 허용하고 기존 compensating ledger 설명을 유지한다.

#### 4.6 Action panel

- panel 제목에 대상 고객, 금액, 현재 상태를 명확히 표시한다.
- action별 영향을 별도로 표시한다. 하나의 일반 영향 문구를 모든 버튼에 공유하지 않는다.
- 사유 12~500자와 확인 체크를 유지한다.
- evidence blocker가 있으면 submit을 disabled하고 이유를 panel 상단에 표시한다.
- form validity와 confirmation이 충족되기 전 버튼을 disabled한다.
- 여러 액션이 가능할 때 destructive/reversal 액션은 시각적으로 구분한다.
- cashout dual-control 계약을 깨지 않는다.

#### 4.7 scope badge 수정

Referral의 정적 `AdminTraceSummary` 호출에는 우선 `inferScope={false}`를 사용한다.

실제 scope가 필요한 값만 명시한다.

- `Current queue`
- `All referral activity`
- `Policy`
- `Wallet ledger`

공용 `inferredMetricScope()` fallback을 전역 변경하면 다른 Admin 페이지에 회귀가 생길 수 있다. 먼저 Referral 호출부를 수정하고, 공용 fallback 변경은 전체 사용처와 테스트를 확인한 경우에만 한다.

#### 4.8 완료 기준

- 의미 없는 `Current filters`, `All records`, `Pending` scope badge가 없다.
- 상세에서 같은 상태/금액을 반복하는 대형 요약 영역이 없다.
- 현재 결론, 증거, blocker, 다음 액션을 첫 화면에서 판단할 수 있다.
- raw 기술 정보는 필요할 때만 펼쳐 볼 수 있다.

### Phase 5 — Referral policy 변경 안전성

정책 값 자체와 API 계약을 무리하게 바꾸지 말고, 저장 전 판단을 실질적으로 만든다.

#### 5.1 입력 단위와 형식

- commission percentage: `%`
- hold period: `days`
- VAT: `%`
- max total/per reward: `VND`
- max referrals/bookings: 명확한 count 단위
- VND 표시에는 천 단위 구분을 사용한다.
- 서버에 보내는 값은 기존 정수/비율 계약을 유지한다.
- 표시용 formatting이 form submission 값을 바꾸지 않게 테스트한다.

#### 5.2 실제 Before/After preview

정책 form을 필요한 최소 client boundary로 분리해 입력 변경을 실시간 계산한다.

- dirty field만 `old → new`
- 금액/percentage 차이
- 위험 변경 표시: percentage/cap 증가, hold 감소, enabled 전환
- 현재 Ready/Pending/Held count와 amount
- 새 정책이 기존 reward snapshot에 소급 적용되는지 여부
- 예상 적용 시점과 영향을 받는 대상

정확한 미래 liability를 계산할 근거가 없다면 가짜 추정치를 만들지 않는다. 대신 현재 exposure와 이론상 cap 변화, 비소급 범위를 정확히 구분한다.

#### 5.3 저장 통제

- 변경값이 없으면 Save disabled
- 사유가 12자 미만이면 Save disabled
- confirmation이 없으면 Save disabled
- 현재 policy가 page load 이후 바뀌면 conflict 처리와 최신값 재검토
- 위험 변경은 confirmation summary에서 old/new를 다시 표시
- 저장 후 audit evidence 링크 또는 확인 가능한 감사 식별자를 제공

#### 5.4 Smoke policy 문구

운영 화면에서 Smoke policy notes가 발견되면 단순 UI에서 숨기지 않는다.

- fixture contamination warning을 표시한다.
- safe restore dry-run 결과로 연결한다.
- 사용자 승인 없는 자동 복원은 하지 않는다.

#### 5.5 완료 기준

- 운영자는 저장 전에 모든 변경값, 단위, 차이, 적용 범위, 현재 exposure를 볼 수 있다.
- invalid/unchanged form은 제출할 수 없다.
- optimistic conflict와 audit trail이 유지된다.

### Phase 6 — 읽기 성능 개선

먼저 측정하고 최소 변경을 선택한다. endpoint를 새로 만드는 것이 목적이 아니다.

#### 6.1 현재 fan-out 계측

기본 목록과 quick queue 전환에서 다음을 기록한다.

- Admin Web server fetch 수
- API endpoint별 응답 시간
- DB query 수 또는 기존 query budget 지표
- duplicated filtered/all summary query
- parent disclosure가 접힌 상태에서도 parent rows를 읽는지

#### 6.2 최소 개선 우선순위

1. filtered summary와 all-parent summary를 한 응답에서 재사용할 수 있으면 두 번째 summary 요청을 제거한다.
2. 접힌 parent records가 일상 큐 전환 때 다시 필요하지 않으면 별도 fetch/stream boundary로 분리한다.
3. access 정보가 안전하게 request-level cache 가능한 기존 패턴이 있으면 재사용한다.
4. 위 변경으로도 budget을 넘으면 `/admin/referrals/customers/workspace` read model을 만든다.

새 workspace endpoint를 만들 경우 응답 경계를 명확히 한다.

- queue summaries
- selected queue rows
- parent activity summary
- parent rows page 또는 lazy href
- read version/as-of
- 부분 실패를 표현할 수 있는 경계

#### 6.3 성능 완료 기준

- 동일 request에서 동일 reward aggregate를 중복 계산하지 않는다.
- quick queue 전환이 접힌 parent table 전체를 불필요하게 다시 읽지 않는다.
- 권한 포함 최대 2개의 Admin read 또는 동등한 단일 workspace read 구조를 목표로 한다.
- 실제 stack에서 `admin:api-budget:strict`를 실행한다.
- 1440px warm navigation p95를 측정하고 결과를 보고한다. 목표는 1.5초 이하이지만 환경 문제로 달성하지 못하면 병목과 측정 조건을 정확히 남긴다.

### Phase 7 — 문구, 접근성, 오류 상태 hardening

#### 7.1 운영자 문구

다음 원칙을 적용한다.

- 내부 action key 대신 사람이 이해하는 과거형 결정
- raw ID 대신 대상과 의미, 필요 시 Technical details
- `reward record(s)` 대신 정확한 복수형 또는 숫자 중심 표현
- `No qualifying booking`은 단순 공백이 아니라 mutation blocker일 때 위험 문구로 표시
- `Integrity clear`와 `Qualified`가 booking missing을 덮어쓰지 않게 evidence별 독립 상태 사용
- owner가 다르면 `Finance decision required`, `System policy access required`를 표시

#### 7.2 오류 상태

최소 다음을 검증한다.

- 전체 reward queue 읽기 실패
- parent records만 부분 실패
- 상세 404
- 상세 API 실패
- 권한 없음
- policy optimistic conflict
- reward state/updatedAt conflict
- booking evidence missing
- fixture mutation blocked
- API timeout/retry
- action 성공 후 최신 상태 재표시

오류 메시지는 무슨 일이 일어났는지, 금액 상태가 바뀌었는지, 다음 행동이 무엇인지 알려야 한다.

#### 7.3 접근성

- keyboard만으로 quick queue, filters, parent disclosure, Review, action panel, confirmation을 조작 가능
- visible focus 유지
- disabled button의 이유를 인접 텍스트로 제공
- table region과 action menu의 accessible name이 고객/보상을 식별
- 상태를 색상만으로 전달하지 않음
- sticky Action이 focus될 때 잘리지 않음
- dialog/panel open 시 focus 이동, close 시 trigger 복귀
- 긴 이름, 전화번호 없음, 매우 큰 VND, 긴 reason에서도 레이아웃 유지

#### 7.4 Impeccable detector

UI 변경이 끝난 뒤 한 번만 실행한다.

```powershell
node C:\Users\laboy\.codex\skills\impeccable\scripts\detect.mjs --json apps/admin_web/app/referrals/referral-dashboard.tsx apps/admin_web/app/referrals/referral-detail.tsx apps/admin_web/app/globals.css
```

실제 변경 파일이 추가되면 detector 대상에 포함한다. 결과를 보고 불필요한 과잉 카드, 의미 없는 scope, action clipping, 불명확한 copy를 한 번에 수정하고, 무한 polish loop를 돌지 않는다.

## 6. 구현하지 말아야 할 것

- fixture 데이터를 정상 고객 데이터처럼 숨기거나 이름만 바꾸지 않는다.
- fixture를 문자열 `Smoke` 검색만으로 hard delete하지 않는다.
- 실제 fixture cleanup apply를 사용자 승인 없이 실행하지 않는다.
- wallet ledger가 있는 fixture를 삭제하지 않는다.
- 현재 Smoke policy를 감사 로그/동시성 확인 없이 자동 복원하지 않는다.
- booking id 존재 여부만 UI에서 확인하고 API release/credit를 허용하지 않는다.
- Admin UI가 booking/payment 자격 계산의 권위가 되게 하지 않는다.
- evidence missing을 confirmation checkbox 하나로 우회하지 않는다.
- 예외 승인을 일반 Release action에 섞지 않는다.
- 이미 credit된 원장을 update/delete해서 이력을 없애지 않는다.
- 기존 source key/idempotency/Serializable transaction/expectedUpdatedAt을 제거하지 않는다.
- quick queue마다 별도 중복 컴포넌트와 문구 분기를 흩뿌리지 않는다. 단일 config를 사용한다.
- 1440px 문제를 `overflow-x: auto`만 추가해 해결했다고 하지 않는다.
- 모든 열을 축소해 핵심 고객/금액/액션이 읽기 어려워지게 하지 않는다.
- Operations board를 유지한 채 카드 크기만 줄여 중복을 숨기지 않는다.
- 공용 metric scope 추론을 영향 분석 없이 전역 변경하지 않는다.
- 미래 liability를 근거 없이 추정해 정확한 값처럼 표시하지 않는다.
- 새로운 chart, animation, icon set, color system을 만들지 않는다.
- 1024px 이하 CSS와 테스트를 작업 범위에 포함하지 않는다.
- unrelated refactor, dependency upgrade, formatter 전체 실행을 하지 않는다.
- 테스트 실패를 snapshot/expectation만 완화해 통과시키지 않는다.

## 7. 테스트 요구사항

### 7.1 API/domain

최소 다음 회귀 테스트를 추가한다.

- production/shared 운영 조회에서 smoke metadata code/attribution/reward 제외
- dev include + 권한 조건에서만 fixture 표시
- fixture summary amount/count 제외
- fixture release/credit/reverse/cashout mutation 차단
- smoke policy snapshot restore conflict 처리
- cleanup 기본 dry-run, exact manifest/confirmation 없는 apply 거부
- 비-fixture reward의 qualifyingBookingId 필수
- booking not found 차단
- booking not completed/paid 차단
- reversed/refunded/fraud booking 차단
- attribution not qualified 차단
- integrity review required 차단
- calculation snapshot missing/invalid 차단
- 정상 reward release/credit 성공
- 동시 release/credit 중복 원장 0
- 재시도 idempotency
- credited reversal이 compensating ledger/journal을 보존
- expected status/updatedAt conflict
- campaign id normalization 계약

### 7.2 Admin Web

- quick queue별 title/description/empty mapping
- quick queue 선택만으로 `No matching filters`를 사용하지 않음
- 추가 검색/상태 필터가 있을 때만 clear filters 표시
- reward count와 parent count 단위 분리
- static Referral summaries에 의미 없는 `Current filters` 없음
- fixture badge와 mutation disabled 상태
- booking evidence blocker와 disabled action
- 정상 evidence reward의 allowed action
- credited reward에는 Reverse만 표시
- policy form dirty/valid/confirmation 상태
- policy before/after diff와 단위
- operations board 제거 후 timeline/evidence 유지
- raw id가 기본 화면에 노출되지 않고 technical details에서 접근 가능
- partial/total read error
- permission denied 상태

### 7.3 브라우저/E2E

로그인된 실제 브라우저에서 최소 다음 상태를 캡처하고 DOM/동작도 검증한다.

1. 1440 × 1000 기본 Needs action
2. 1440 × 1000 Ready 빈 상태
3. On hold 큐
4. Credited history
5. 검색 결과 없음
6. All parent records 접힘/펼침
7. 상세 command strip/evidence timeline
8. booking evidence missing blocker
9. 정상 evidence reward action panel
10. credited reversal panel
11. policy unchanged/dirty/invalid/valid 상태
12. policy conflict
13. fixture dev include 표시와 action disabled
14. 부분 읽기 실패 또는 테스트 가능한 오류 상태
15. 1600 × 1000 sanity check

레이아웃 assertion:

- queue와 ledger의 대표 Action bounding box가 content viewport 안에 있음
- 기본 큐와 ledger에 불필요한 horizontal scroll이 없음
- sticky Action이 sidebar/viewport에 가려지지 않음
- command strip 마지막 항목이 혼자 orphan row로 내려가지 않음
- 긴 고객명, 긴 reason, 큰 VND에서 겹침/세로 글자 배치가 없음

1024px 이하 viewport는 생성하거나 검사하지 않는다.

## 8. 실행할 검증 명령

현재 package script를 먼저 확인하고 실제 존재하는 명령만 실행한다. 기본 후보는 다음과 같다.

### Admin Web

```powershell
cd C:\dev\massage-on-demand-vn\apps\admin_web
npm.cmd test -- app/referrals/referral-dashboard.spec.tsx app/referrals/referral-detail.spec.tsx app/referrals/actions.spec.ts app/referrals/page.spec.tsx app/referrals/referral-smoke-seed-contract.spec.ts app/referrals/referral-reward-action-smoke-contract.spec.ts app/referrals/referral-wallet-credit-readiness-contract.spec.ts app/referrals/referral-public-link-smoke-contract.spec.ts
```

새로 만든 테스트 파일을 위 명령에 포함한다.

### API

```powershell
cd C:\dev\massage-on-demand-vn\apps\api
npm.cmd test -- src/referrals/referrals.service.spec.ts src/referrals/referrals.accounting.spec.ts src/referrals/referrals.controller.spec.ts src/referrals/referral-wallet-credit-schema-contract.spec.ts src/referrals/referral-claim-api-smoke-contract.spec.ts
npm.cmd test -- src/admin/admin.controller.spec.ts src/admin/admin.dto.spec.ts -t referral
npm.cmd test -- src/admin/admin.service.spec.ts -t referral
```

### Scope verification

```powershell
cd C:\dev\massage-on-demand-vn
npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api
```

보호 영역 또는 booking/wallet 계약을 변경했다면 AGENTS.md에 따른 전체 local verification도 수행한다.

```powershell
npm.cmd run verify:local
```

### API budget

실제 서비스 stack을 안전하게 실행할 수 있을 때:

```powershell
cd C:\dev\massage-on-demand-vn\apps\admin_web
npm.cmd run admin:api-budget:strict
```

서비스가 없어 실패하면 코드 실패로 왜곡하지 말고, 필요한 서비스와 미측정 항목을 보고한다.

### Fixture inventory

새 dry-run script의 정확한 명령을 package script에 추가하고 실행한다. 예:

```powershell
npm.cmd run referral:fixture:inventory
```

명령 이름은 저장소 관례에 맞게 결정한다. 이 작업에서는 apply 옵션을 실행하지 않는다.

## 9. 완료 기준

다음 조건이 모두 충족돼야 완료로 보고한다.

### 출시 차단

- [ ] production/shared 운영 조회에 test fixture가 나타나지 않는다.
- [ ] fixture가 summary count/amount를 오염하지 않는다.
- [ ] dev include fixture는 명확히 표시되고 wallet mutation이 차단된다.
- [ ] smoke 실행이 referral policy를 오염시키지 않는다.
- [ ] cleanup은 dry-run manifest까지 준비되고 apply는 실행되지 않았다.
- [ ] booking/payment evidence 없는 release/credit가 API에서 차단된다.
- [ ] 정상 evidence reward만 release/credit할 수 있다.
- [ ] wallet idempotency와 compensating reversal이 유지된다.

### 운영 화면

- [ ] 1440 × 1000에서 큐 대표 액션이 가로 스크롤 없이 보인다.
- [ ] 상세 ledger Action도 가로 스크롤 없이 접근 가능하다.
- [ ] quick queue와 제목·빈 상태·result count가 일치한다.
- [ ] reward와 parent count 단위가 섞이지 않는다.
- [ ] 의미 없는 `Current filters` scope가 없다.
- [ ] Operations board 중복이 제거됐다.
- [ ] 상세 첫 화면에서 결론·근거·blocker·다음 행동을 판단할 수 있다.
- [ ] raw ID와 internal action key는 기본 운영 문구에 노출되지 않는다.
- [ ] policy 변경 전/후 값과 단위·적용 범위·현재 exposure가 보인다.
- [ ] invalid/unchanged policy form은 저장할 수 없다.

### 성능과 품질

- [ ] 동일 reward aggregate 중복 조회가 제거되거나 근거와 함께 최소화됐다.
- [ ] quick queue 전환이 접힌 parent table을 불필요하게 다시 읽지 않는다.
- [ ] Referral 관련 테스트가 통과한다.
- [ ] 기존 referral marketing test 2개의 normalization 계약이 해결됐다.
- [ ] Admin/API scope verification이 통과한다.
- [ ] API budget 또는 미측정 사유가 정확히 기록됐다.
- [ ] 1440/1600 실제 브라우저 증거가 저장됐다.
- [ ] 1024px 이하 검사는 보고서에 포함되지 않았다.

P0가 남아 있거나 테스트가 실패하면 완료라고 말하지 말고 `부분 완료`로 보고한다.

## 10. 산출물

다음을 남긴다.

1. 필요한 코드와 테스트 변경
2. fixture inventory/cleanup dry-run 도구와 사용 문서
3. 브라우저 증거 폴더
   - `docs/audits/referrals-customers-remediation-evidence-2026-08-12/`
4. 구현 보고서
   - `docs/audits/referrals-customers-remediation-implementation-2026-08-12.md`

구현 보고서에는 다음을 포함한다.

- 감사 항목별 `해결됨 / 부분 해결 / 미해결 / 변경 불필요` 표
- 화면 전/후 구조
- API/domain 안전성 변경
- fixture 격리와 cleanup dry-run 결과
- policy smoke lifecycle
- booking evidence precondition
- wallet/idempotency/reversal 보존 근거
- 성능 전/후 요청·쿼리·시간
- 테스트 명령과 pass/fail/skipped 수
- 1440/1600 캡처 링크
- 변경 파일
- 보호 영역 변경 여부
- migration 여부
- 실제 데이터 mutation을 실행하지 않았다는 확인
- 남은 위험과 다음 작업

## 11. 최종 응답 형식

최종 응답은 다음 순서를 사용한다.

1. 결과를 한 문장으로 먼저 말한다.
2. P0/P1별 구현 결과를 요약한다.
3. 변경 파일을 링크한다.
4. 테스트 명령과 통과/실패/미측정을 정확히 적는다.
5. 1440px 대표 캡처를 보여 준다.
6. fixture cleanup/policy restore/wallet mutation을 실제로 실행했는지 명시한다.
7. 보호 영역과 migration 변경 여부를 적는다.
8. 남은 위험을 숨기지 않는다.
9. 다음으로 가장 가치 있는 한 가지 작업만 제안한다.

“대부분 개선됨”, “문제없음” 같은 모호한 표현을 쓰지 않는다. 실제 검증하지 않은 성능, 데이터 상태, wallet 결과를 추정하지 않는다.

---

## 이 프롬프트의 사용 메모

- 새 Codex 작업에 `실행용 프롬프트` 전체를 그대로 붙여 넣는다.
- 우선순위는 `fixture 격리 → evidence gate → 1440px 목록 → 상세 단순화 → policy preview → 성능` 순서다.
- 실제 fixture cleanup apply나 현재 Smoke policy 복원은 별도 사용자 승인 작업으로 분리한다.
- 한 번에 범위가 너무 크면 P0와 P1을 순차 커밋할 수 있지만, 최종 완료 판정은 전체 완료 기준으로 한다.
