# Operations Policy 최종 개선 구현용 Codex 마스터 프롬프트

이 문서는 `Operations Policy` 최종 재감사 결과를 실제 코드 수정으로 전환하기 위한 **1회성 실행 프롬프트**다. 저장소의 영구 지침인 `AGENTS.md`에 복사하지 않는다. Codex에서 `C:\dev\massage-on-demand-vn`을 workspace로 연 뒤 이 문서 전체를 한 번에 전달한다.

---

Role: 당신은 HANDS 관리자 웹의 운영 안전성, 정책 집행 계약, 감사 추적, 데스크톱 UX를 함께 책임지는 시니어 프로덕트 엔지니어다.

Goal: `/operations-policy`를 1인 운영자가 **정확한 정책만, 정확한 값으로, 실제 집행 여부를 알고, 충돌이나 오조작 없이 변경하고 감사할 수 있는 화면**으로 완성하라. 분석이나 추가 보고서 제안으로 끝내지 말고, 현재 코드와 실행 화면을 재확인한 다음 허용된 범위의 코드·테스트·문구·레이아웃을 실제로 수정하고 검증 보고서와 화면 증거까지 남겨라.

## 1. 작업 범위와 기준 자료

```text
Workspace: C:\dev\massage-on-demand-vn
Primary route: http://localhost:3101/operations-policy
Final audit: docs/audits/operations-policy-final-reaudit-2026-08-13.md
Evidence: docs/audits/operations-policy-final-reaudit-evidence-2026-08-13/
Previous implementation prompt: docs/agent/prompts/operations-policy-remediation-master.md
```

주요 코드:

```text
apps/admin_web/app/operations-policy/**
apps/admin_web/app/globals.css
apps/admin_web/lib/admin-api.ts
apps/admin_web/lib/operations-policy.ts
apps/api/src/admin/admin.service.ts
apps/api/src/admin/admin.dto.ts
apps/api/src/admin/admin-operational-policy-audit-source.ts
apps/api/src/matching/matching.policy.ts
infra/scripts/check-operations-policy-consistency.mjs
infra/scripts/api-smoke.mjs
```

## 2. 권한과 작업 방식

이 요청은 다음 로컬 작업을 승인한다.

- 관련 파일과 현재 diff 읽기
- 범위 안의 Admin Web, API, 테스트, 검증 스크립트, CSS, 문서 수정
- 비파괴 테스트, typecheck, build/scope 검증 실행
- 로그인된 로컬 브라우저에서 비파괴 화면·상호작용 검증과 screenshot 저장

다음은 승인하지 않는다.

- 실제 운영/shared DB의 정책 PATCH, 결제·지갑·부킹·정산 데이터 mutation
- 과거 감사 로그의 실제 backfill 실행
- schema/migration, 인증 모델, 배포 설정 변경
- 사용자 dirty change 삭제·reset·restore·checkout·stash·clean
- 새 패키지, 새 UI 프레임워크, 새 상태관리 프레임워크 도입
- 무관한 코드 포맷팅이나 전면 리팩터링
- subagent 또는 multi-agent 사용

실제 데이터 write가 필요한 검증은 fixture, mock, 전용 test database 또는 rollback 가능한 integration test로 수행한다. 운영 화면에서는 Save를 누르지 않는다.

## 3. 화면 범위

- 필수 viewport: **1440×1000**, **1600×1000**
- 선택 보조 viewport: 1680px 이상
- **1024px 이하 화면은 검사·재설계·점수·보고 대상에서 완전히 제외한다.**
- 작은 화면 CSS를 일부러 삭제하지는 않지만, 이번 완료 판단에 사용하지 않는다.

## 4. 먼저 보존해야 하는 개선 결과

아래는 이미 구현됐으므로 다시 만드는 작업이 아니다. 변경 후에도 회귀하면 실패다.

- audit Before/After가 `before ?? previousValue`, `after ?? value`로 보인다.
- 필수 확인 문구가 화면에 보이고 체크박스와 연결된다.
- same value, 값 범위, reason 12–500자, 확인 체크를 client와 server가 검증한다.
- 정책은 6개 운영 그룹과 5열 목록으로 정리되어 있다.
- 검색, 상태, 그룹 필터가 동작하고 URL 상태를 유지한다.
- top-level 중첩 세로 스크롤이 제거됐다.
- Policies, Supply, Simulation, Audit가 한 route의 workspace tab으로 통합됐다.
- Supply/Simulation에 observedAt, bounded sample, Demo 좌표 경고가 있다.
- 공급 0은 상단에서 `Blocking`으로 보이고 Simulation 결과 표는 prerequisite 실패 시 숨겨진다.
- policy value와 audit event는 같은 transaction에 기록된다.

이전 프롬프트를 그대로 재실행하지 말고, 최종 감사에서 미해결 또는 새로 발견된 항목만 수정하라.

## 5. 성공 조건

최종 완료를 선언하려면 모두 충족해야 한다.

1. 정책 A의 미저장 값·사유·확인·server action state가 정책 B로 절대 넘어가지 않는다.
2. dirty form 이동은 폐기 확인을 요구하고, submit 중에는 정책·탭·닫기 전환을 막는다.
3. `Live`는 실제 runtime consumer와 integration proof가 있는 정책만 의미한다.
4. consumer 없는 7개는 Planned/Reference only, 변경 불가능한 2개는 Locked로 보이며 API도 write를 거부한다.
5. 화면의 Live/Locked/Planned 수와 API consumer contract가 일치한다.
6. 동시에 같은 expectedValue로 PATCH한 두 요청 중 정확히 하나만 성공하고 audit도 한 건만 생긴다.
7. 1440px에서 Action 열, Close, 검색, 필터, Save가 잘리거나 글자 단위로 깨지지 않는다.
8. 과거 자동 smoke가 Operator로 표시되지 않고 source별 최신 행을 서버에서 조회한다.
9. 공급 0일 때 긴 0값 diagnostics는 기본 DOM/화면을 지배하지 않는다.
10. Simulation readiness와 header badge가 모순되지 않는다.
11. 진단 탭 노출과 실제 권한 계약이 일치한다.
12. 초기 form은 빨간 오류투성이가 아니며 오류는 touched/submit 이후에 표시된다.
13. high-risk 변경에는 현재 시스템으로 구현 가능한 명시 확인과 안전한 rollback 경로가 있다.
14. 관련 focused tests, typecheck, consistency check, Admin/API scope 검증이 통과한다.
15. 실제 화면을 1440/1600에서 다시 렌더·검사하고 증거를 남긴다.

## 6. 시작 절차

1. 루트 `AGENTS.md`, 최종 감사 보고서, 기존 remediation prompt를 끝까지 읽는다.
2. 감사 증거 PNG 중 최소 `05`, `06`, `08`, `09`, `10`, `11`, `14`를 직접 연다.
3. `git status --short`와 관련 파일 diff를 확인해 사용자 작업을 보존한다.
4. 보고서 line number가 아니라 현재 심볼과 data flow를 다시 찾는다.
5. 현재 관련 테스트와 typecheck를 실행해 baseline을 기록한다.
6. 구현은 아래 Phase 1→5 순서로 진행한다. 앞 단계의 안전 계약이 실패하면 뒤 단계의 시각 polish부터 하지 않는다.

## 7. Phase 1 — 정책 오저장 경로 제거 (P0)

### 7.1 정책별 form state 격리

확인된 root cause:

- `operations-policy-form.tsx`의 local state와 `useActionState`가 최초 setting으로 초기화된다.
- `page.tsx`는 동일 위치에 `<OperationsPolicyForm setting={selectedSetting} />`을 재사용한다.

최소 안전 수정:

```tsx
<OperationsPolicyForm key={selectedSetting.key} setting={selectedSetting} />
```

단, key 추가만으로 완료하지 말고 다음 전환 계약을 구현한다.

- pristine form: 다른 정책·탭·Close로 즉시 이동 가능
- dirty form: `Discard unsaved policy change?` 확인 후 이동
- cancel: 현재 form과 URL/selection 유지
- confirm: 새 정책 current value로 초기화, reason 빈 값, unchecked, touched false, action state idle
- submitting: row action, Close, tab 전환을 비활성화하고 명확한 saving label 표시
- success/error state도 다른 policy에 남지 않음
- browser back/forward와 deep link `?edit=<key>`에서도 동일 계약 유지

과도한 전역 state manager를 추가하지 않는다. 기존 page/form 경계에서 가장 작은 구현을 사용한다.

### 7.2 필수 테스트

- React interaction test로 A form을 유효하게 만든 뒤 B를 선택해 state reset 검증
- dirty 이동 cancel/confirm 두 경로
- submit 중 selection/tab/close 차단
- action success/error 이후 다른 policy로 이동하면 action state 초기화
- 실제 1440/1600 browser에서 비파괴 재현 절차 재검증

## 8. Phase 2 — Live 표시를 실제 집행 계약과 일치시키기 (P0)

### 8.1 lifecycle과 consumer contract

현재 `enforced: true` 수동 플래그를 Live의 유일한 근거로 사용하지 않는다. 기존 정의 source에 최소한 다음 계약을 둔다.

```ts
type OperationalPolicyLifecycle = 'live' | 'locked' | 'planned' | 'deprecated';

type OperationalPolicyConsumerContract = {
  consumerIds: readonly string[];
  integrationTestIds: readonly string[];
  applicationScope: string;
  fallbackBehavior: string;
};
```

프로젝트 naming에 맞게 조정해도 되지만 다음 원칙은 바꾸지 않는다.

- `live`: 실제 service가 값을 읽고 동작이 바뀌며 integration proof가 있음
- `locked`: 현재 MVP 고정 계약이라 변경할 수 없음
- `planned`: 정의·설명은 있으나 runtime consumer가 없어 읽기 전용
- `deprecated`: legacy compatibility만 유지하며 신규 변경 대상이 아님

API list response와 Admin `AdminOperationalPolicySetting`이 lifecycle, risk, consumer summary를 함께 전달하게 한다. `enforced`가 다른 consumer에 필요하면 호환 필드로 유지할 수 있으나, UI Live count와 write eligibility는 lifecycle을 사용한다.

### 8.2 즉시 비편집 처리할 정책

다음 7개는 새 business behavior를 추측해 연결하지 말고 `planned` 또는 `reference only`로 처리한다.

```text
wallet.negative_balance_gate
decision.action_evidence_gate_mode
cash.settlement_clearance_policy
payout.batch_cycle_policy
matching.first_pick_expiry_action_policy
cancellation.after_match_policy
no_show.evidence_requirement_policy
```

다음 2개는 현재 런타임 의미상 `locked`다.

```text
matching.marketplace_open_mode
matching.preferred_accept_mode
```

- `marketplace_open_mode`: 다른 저장값도 runtime에서 동일 값으로 normalize됨
- `preferred_accept_mode`: 대안이 하나뿐이고 resolver가 입력을 무시함

이 9개 행에서는 `Review change`를 제거하고 상태 이유, 현재 고정/계획 의미, 향후 Live 승격 조건을 간결하게 표시한다.

### 8.3 server write guard

- lifecycle이 `live`가 아닌 key의 PATCH를 UI만 막지 말고 API에서도 409로 거부한다.
- error response는 운영자가 이해할 수 있는 안정적인 code/message를 갖는다.
- 기존 저장값과 legacy read compatibility는 보존한다.
- 7개 policy를 실제 consumer에 임의로 연결하거나 wallet/payout/cancellation 의미를 새로 설계하지 않는다.

### 8.4 consistency 검증 강화

`infra/scripts/check-operations-policy-consistency.mjs` 또는 더 적합한 기존 검사에 다음을 추가한다.

- 모든 policy key는 lifecycle을 정확히 하나 가짐
- live policy는 비어 있지 않은 allowlisted consumer ID와 integration test ID를 가짐
- planned/locked/deprecated는 Admin에서 editable로 노출되지 않음
- Admin/API key, default, lifecycle count가 일치함
- 알 수 없는 consumer ID나 중복 key는 검사를 실패시킴

문자열만 적어 두고 실제 consumer가 존재하는 것처럼 위장하지 않는다. consumer manifest는 repo의 실제 symbol/test와 매핑되어야 한다.

### 8.5 UI copy/count

고정 `Live policies 28 / 28`을 lifecycle count로 교체한다. 감사 당시 예상 분포는 `19 live · 2 locked · 7 planned`지만 숫자를 하드코딩하지 말고 API 결과에서 계산한다. 실제 추적 결과가 달라지면 증거와 함께 정확한 숫자를 사용한다.

## 9. Phase 3 — 감사 신뢰성과 원자적 동시 수정 (P1)

### 9.1 audit source 3상태

```text
operator
automated_smoke
legacy_unknown
```

- `metadata.source`가 없는 기록을 무조건 operator로 간주하지 않는다.
- reason 문자열만으로 보안상 신뢰되는 source를 만들지 않는다.
- 과거 `Automated smoke coverage...`는 UI에서 `Legacy automation · source inferred`로 분리할 수 있으나, inference임을 명시한다.
- historical DB row를 실제로 rewrite하지 않는다. 필요하면 **dry-run only** backfill script/plan을 만들고 실행은 하지 않는다.
- 새 smoke 기록의 source는 기존 server-trusted HMAC/service identity 계약을 유지한다. browser가 source를 spoof할 수 없어야 한다.

### 9.2 server-side filter와 cursor

- audit endpoint가 source와 cursor/limit를 받도록 기존 DTO/service 패턴 안에서 구현한다.
- Admin에서 최근 50건을 받은 뒤 client filter하지 않는다.
- Operator/Automated/Legacy 탭 각각 해당 source의 최신 8건을 서버에서 반환한다.
- Audit workspace에서는 settings가 필요 없다면 settings request를 제거한다.
- 목록의 Last changed는 가능하면 `lastOperatorChangedAt`, `lastOperatorChangedBy`, `lastChangeSource`로 실제 operator change를 구분한다.
- schema migration 없이 기존 audit metadata와 query로 해결한다. migration이 불가피하면 구현을 멈추고 이유와 대안을 보고한다.

### 9.3 audit table 밀도

기본 표는 다음 6개 정보에 집중한다.

```text
When | Policy | Before → After | Actor / Source | Reason | Details
```

Ops effect, environment, runId, restoration은 row expansion 또는 기존 패턴의 detail drawer로 이동한다. Before/After와 source 가독성을 희생하지 않는다.

### 9.4 optimistic concurrency 원자화

현재 SELECT→compare→upsert만으로 동시 요청을 막았다고 간주하지 않는다.

- 기존 Prisma/PostgreSQL 구조에서 가장 작은 원자적 방법을 선택한다.
- 허용 방향: expected value 조건부 update + affected row 검증, 또는 materialized row에 `SELECT ... FOR UPDATE`.
- row가 없는 default 상태의 create race와 unique conflict도 409로 정규화한다.
- value write와 audit insert의 단일 transaction을 유지한다.
- 실패한 concurrent request는 audit를 만들지 않는다.
- 실제 PostgreSQL integration test에서 같은 key/expectedValue를 사용한 두 요청을 동시에 실행하고 `1 success + 1 conflict + 1 audit`를 검증한다.
- 순차 mock test만 추가하고 완료로 선언하지 않는다.

이 변경은 운영 핵심 계약이므로 API focused test와 `verify:scope api`를 반드시 실행한다. schema나 migration을 건드리지 않는다.

## 10. Phase 4 — 1440px 운영 UX와 상태 표현 (P1)

### 10.1 editor layout

- 1440–1599px에서는 목록+editor 2열을 사용하지 않는다.
- 기존 Admin 패턴이 있으면 우측 drawer를 재사용하고, 없으면 목록 아래/전체 폭 focused editor를 사용한다.
- side-by-side는 실제 content width가 충분한 1680px 이상에서만 허용한다.
- 목록 5열 모두 보이고 Action을 `overflow:hidden`으로 자르지 않는다.
- Close는 icon+accessible name 또는 nowrap 최소 폭 버튼으로 구현한다.
- filter search label과 placeholder 전체가 보이게 한다.
- filtered group header는 `4 shown / 7 total`처럼 표시한다.

Drawer 사용 시 focus trap, Escape, Close, 원래 row로 focus return을 구현한다. screenshot 전용 CSS 분기를 만들지 않는다.

### 10.2 validation presentation

- initial render에서는 danger 오류를 표시하지 않는다.
- field error는 touched 또는 submit attempt 이후에만 보인다.
- 아직 입력이 없는 상태의 조건은 중립 helper/checklist로 보인다.
- 유효한 값에 danger 색을 남기지 않는다.
- server error 후에는 error summary와 관련 field error를 유지한다.
- same value, range, short/long reason, missing confirm, conflict, permission, network를 구분한다.

### 10.3 readiness 공통 모델

Supply와 Simulation에서 다음 공통 상태를 사용한다.

```text
ready | blocked | unavailable | stale | demo_evidence
```

- readiness와 observedAt/freshness를 하나의 success badge로 섞지 않는다.
- Simulation prerequisite가 false면 header는 `Blocked · no eligible Partner supply`다.
- Demo evidence는 production decision에 사용할 수 없다는 문구를 유지한다.
- 권한 부족을 조용히 Policies로 redirect하지 않는다.

### 10.4 권한 정합성

현재 page access는 `SYSTEM_POLICY`, diagnostics는 `DEVELOPER_SYSTEM` 계열로 분리되어 있다. 기존 권한 의도를 코드·navigation·API guard에서 확인하고 한 가지 계약으로 맞춘다.

- 운영 정책 결정을 위한 필수 근거라면 read-only Supply/Simulation/Audit를 `SYSTEM_POLICY`에 허용
- 개발자 전용이라면 해당 탭을 숨기고 직접 URL에는 403 및 필요한 권한 표시
- 탭은 보이지만 조용히 Policies로 돌아가는 상태는 금지

새 role 체계나 auth migration은 만들지 않는다.

## 11. Phase 5 — 긴 진단, 위험도, 문구와 dead code (P1/P2)

### 11.1 Supply zero-state

usable supply가 0이면 기본 화면에는 다음만 먼저 보인다.

1. `Blocked — 0 usable Partners`
2. 원인 요약: identity/location/push
3. 실제 작업 route 최대 3개
4. `Show diagnostic details`

diagnostic disclosure를 열기 전에는 0값 sensitivity/stage table을 대량 렌더하지 않는다. 두 sensitivity 표는 열었을 때도 각각 전체 폭으로 세로 배치한다. open matching sample이 0이면 stage scenario 표 대신 `No open bookings to model`을 표시한다.

### 11.2 policy risk와 rollback

정책 정의에 다음 최소 계약을 둔다.

```text
risk: low | medium | high
blastRadius: 운영자가 이해할 수 있는 짧은 영향 범위
```

- low: 현재 confirm 계약
- medium: 영향 queue/current active count 확인
- high: 기존 re-auth 기능이 있으면 재사용. 없다면 정확한 policy label 입력 확인을 사용하고 새 인증 시스템을 만들지 않음
- success summary: audit ID, Before→After, actor, effective time, reason, `Revert to Before`
- rollback은 기존 PATCH + latest expectedValue + 새 reason을 사용하며 새 audit event를 남김
- stale current value이면 rollback도 409로 실패하고 최신값을 다시 보여 줌
- 결제/지갑/정산 값을 실제로 바꾸는 브라우저 QA는 금지

### 11.3 실제 영향 문구

7개 Start Shift SLA의 fallback 문구 `future automation`을 제거한다. 각 정책은 다음을 설명한다.

- 어느 queue의 overdue 기준인지
- 임계값을 줄이거나 늘릴 때 영향
- 가능한 경우 current open/overdue count
- 해당 queue 링크

`Live`인데 `future automation`이라고 쓰거나 `Planned`인데 즉시 동작한다고 쓰지 않는다.

### 11.4 FCM readiness

정적 `FCM live smoke and token recovery passed` 문구를 신뢰 근거로 쓰지 않는다. 기존 System Health data가 이미 있으면 `Configured`, `Smoke passed`, `Monitoring ready`, `Policy enabled`를 동적으로 분리한다. 새 health backend를 발명해야 한다면 정적 성공 문구를 제거하고 `Not verified in this workspace`로 정직하게 표시한다.

### 11.5 unused Operations Policy 모듈

다음 후보는 `rg`로 production import가 없는지 확인한 후에만 삭제한다.

```text
action gate checklist
authority baseline
booking create gate section
enforcement trace section
matching playbook section
next choices section
owner decision backlog section
recommended value review section
```

- tests만 import하는 파일은 production dead code일 수 있다.
- 실제 다른 route/helper가 사용하면 삭제하지 않는다.
- 삭제 시 해당 전용 test와 orphan helper도 함께 정리하되, 현재 핵심 form/workspace test를 강화한다.
- 대규모 구조 개편이나 무관한 정리는 하지 않는다.

## 12. 필수 테스트 시나리오

### Admin Web

1. A→B policy selection state reset
2. dirty navigation cancel/confirm
3. submit 중 policy/tab/close 차단
4. lifecycle별 editable/read-only 상태와 count
5. initial validation neutral, touched/submit error, valid helper non-danger
6. 1440 editor 구조에서 Action/Close/filter가 존재하고 잘리지 않는 구조 계약
7. source tabs가 server query를 사용하고 legacy_unknown을 분리
8. Audit load plan이 불필요한 settingsHref를 만들지 않음
9. supply 0에서 diagnostics/stage tables 기본 미렌더
10. simulation ready=false가 blocked header
11. diagnostics permission에 따른 tab hidden 또는 403
12. filtered group shown/total count
13. 7개 Shift SLA impact copy/queue mapping completeness
14. high-risk confirmation과 rollback state

### API/infra

1. non-live lifecycle PATCH → 409
2. live policy consumer manifest completeness
3. source filter/cursor가 각 source의 최신 N개 반환
4. source spoof 방지와 legacy_unknown compatibility
5. simultaneous PATCH → one success, one 409, one audit
6. absent row/default create race
7. rollback도 expectedValue, reason, audit transaction 유지
8. key/default/lifecycle/consumer consistency

테스트 fixture에 숫자 `19/2/7`만 하드코딩해 실제 contract drift를 숨기지 않는다. 정의에서 계산하고 expected key set을 명시적으로 검증한다.

## 13. 검증 명령

먼저 `package.json`의 실제 script를 확인하고 현재 repo에 맞는 정확한 명령을 사용한다. 최소 실행 범위:

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- app/operations-policy components/admin-form-control-usage.spec.tsx
npm.cmd run test --workspace @massage-vn/api -- src/admin/admin.service.spec.ts src/matching/matching.policy.spec.ts
npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run typecheck --workspace @massage-vn/api
npm.cmd run policy:admin-consistency
npm.cmd run admin:visible-copy
npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api
```

동시성 test에 전용 PostgreSQL service가 필요하면 기존 integration-test setup을 사용한다. 사용할 수 없다면 코드·단위 테스트만으로 PASS라고 쓰지 말고 `NOT VERIFIED — real PostgreSQL concurrency`로 남긴다.

UI 변경이 끝나면 현재 설치된 Impeccable detector를 변경한 Operations Policy UI/CSS 범위에 한 번 실행한다. 기존 unrelated global warning은 구분해서 보고한다.

## 14. 실제 브라우저 검증

로그인된 in-app browser 세션을 사용한다. 서버 재시작이 필요하면 해당 프로젝트의 정확한 PID와 command line을 확인한 뒤 처리하고 다른 프로세스를 종료하지 않는다.

다음 screenshot을 동일 build/data 상태에서 남긴다.

```text
01-policies-1440x1000.png
02-policy-editor-initial-1440x1000.png
03-policy-editor-dirty-switch-confirm-1440x1000.png
04-policy-editor-valid-not-submitted-1600x1000.png
05-planned-and-locked-policies-1600x1000.png
06-supply-zero-default-1600x1000.png
07-supply-diagnostics-expanded-1600x1000.png
08-simulation-blocked-1600x1000.png
09-audit-operator-1600x1000.png
10-audit-legacy-automation-1600x1000.png
11-permission-state-if-reproducible-1600x1000.png
```

브라우저 확인 항목:

- A에 값/reason/check를 넣고 B로 이동할 때 discard 확인이 보임
- confirm 후 B의 current value, blank reason, unchecked, idle 상태
- actual Save 미제출
- 1440에서 Action, Close, filter label/placeholder, Save가 보임
- 글자 단위 줄바꿈과 page-level horizontal overflow 없음
- initial form danger error 없음
- Planned/Locked에 edit action 없음
- lifecycle counts가 실제 rows와 일치
- Supply 기본 높이가 0 diagnostics로 과도하게 길지 않음
- Simulation header가 blocked 내용과 일치
- Operator 목록에 legacy smoke가 섞이지 않음
- browser console error/warning과 failed network request 기록

## 15. 금지되는 지름길

- `key` remount 없이 effect로 일부 field만 덮어 stale action state를 남기지 않는다.
- UI에서 버튼만 숨기고 API write를 허용하지 않는다.
- consumer 없는 key에 임의의 service 이름 문자열만 붙여 Live로 유지하지 않는다.
- 과거 reason 문자열을 authoritative source로 승격하지 않는다.
- client-side recent-50 filter를 pagination으로 부르지 않는다.
- 순차 mock을 concurrency proof로 사용하지 않는다.
- 1440에서 Action을 overflow로 숨기거나 horizontal scroll에 떠넘기지 않는다.
- 공급 0 diagnostics를 CSS로만 가리고 접근 가능한 DOM에 전부 렌더하지 않는다.
- 모든 정책에 똑같은 고위험 confirmation을 적용하지 않는다.
- API failure를 empty/aligned 상태로 표시하지 않는다.
- 실제 운영 policy Save로 browser test하지 않는다.
- 1024px 이하 화면을 감사하거나 최종 보고서에 포함하지 않는다.
- 테스트 통과만으로 화면 검증을 생략하지 않는다.

## 16. 중단 조건

다음 경우에만 해당 slice를 멈추고 정확한 blocker, 확인한 증거, 가장 작은 대안을 보고한다. 다른 독립 slice는 안전하면 계속 진행한다.

- schema/migration 없이는 source filter나 concurrency를 안전하게 구현할 수 없음
- 기존 auth 모델 변경 없이는 high-risk re-auth를 구현할 수 없음
- dirty user change와 같은 줄을 안전하게 병합할 수 없음
- 정책의 실제 business 의미가 코드·테스트·보고서에서 결정되지 않음
- 전용 PostgreSQL integration environment가 없어 실제 concurrency proof를 실행할 수 없음
- 로그인이 필요함

작업이 많거나 테스트가 느리다는 이유로 중단하지 않는다. 추측으로 wallet, payout, cancellation, booking, matching 의미를 새로 만들지도 않는다.

## 17. 산출물

구현 코드와 테스트 외에 다음을 남긴다.

```text
docs/audits/operations-policy-final-remediation-evidence-2026-08-13/*.png
docs/audits/operations-policy-final-remediation-report-2026-08-13.md
```

최종 구현 보고서에는 다음 표를 포함한다.

1. P0/P1/P2 finding별 `PASS | PARTIAL | BLOCKED | NOT VERIFIED`
2. root cause와 실제 수정
3. lifecycle별 정책 key와 실제 consumer/test mapping
4. route/tab별 API 요청 전후
5. concurrency test 결과와 audit row 수
6. 1440/1600 screenshot index와 build ID
7. 실행 명령별 PASS/FAIL/SKIPPED
8. 변경 파일
9. protected area, schema, migration, dependency 접촉 여부
10. 남은 위험과 출시 판단
11. 다음 단 하나의 우선 작업

## 18. 최종 응답 형식

최종 응답은 다음 순서로 짧고 명확하게 작성한다.

1. 운영자가 무엇을 더 안전하고 빠르게 할 수 있게 됐는지
2. 출시 차단 P0가 모두 해결됐는지
3. 검증 결과 요약
4. 구현 보고서와 증거 링크
5. protected area/미검증/남은 위험

파일을 많이 바꿨다는 사실보다 **오저장 방지, 실제 Live 계약, 원자적 충돌 방지, 감사 신뢰성**이 증명됐는지를 우선 보고한다. 실패나 미검증을 숨기지 않는다.

지금 `git status --short`, `AGENTS.md`, 최종 감사 보고서, 지정 증거 이미지, 관련 diff와 baseline test 확인부터 시작하라. 별도 blocker가 없으면 Phase 1부터 실제 구현하고, 모든 성공 조건을 검증한 뒤에만 완료를 선언하라.
