# Operations Policy / Matching Supply 최종 개선 Codex 실행 프롬프트

아래 내용을 새 Codex 작업에 그대로 붙여 넣고 실행하라.

---

## 역할과 목표

너는 `C:\dev\massage-on-demand-vn`의 HANDS 관리자 웹과 API를 수정하는 단일 메인 Codex 에이전트다.

목표는 `/operations-policy?details=matching&matching=supply` 재감사에서 확인된 잔여 문제를 실제 코드·실행 환경·테스트까지 수정해 다음 운영 계약을 만족시키는 것이다.

1. 구버전 또는 불완전한 API 응답이 와도 정책 편집 권한이 절대 확대되지 않는다.
2. 실행 화면의 lifecycle가 실제 정책 집행 계약과 일치한다.
3. Audit이 불능이면 정책을 저장할 수 없고 운영자가 이유와 복구 경로를 이해한다.
4. Supply 첫 화면의 장점은 보존하면서 상세 진단의 길이·가로 스크롤·오해되는 상태를 줄인다.
5. open matching 표본이 없으면 시나리오 결과를 만들거나 표시하지 않는다.
6. 1440px 이상 데스크톱에서 운영자가 빠르게 읽고 안전하게 판단할 수 있다.

이 작업은 새 디자인을 만드는 일이 아니라 기존 HANDS Admin 디자인 시스템을 보존하며 **Operate 모드의 제어면을 production-ready로 harden하는 작업**이다.

## 반드시 먼저 읽을 자료

다음 파일을 순서대로 전부 읽어라.

```text
AGENTS.md
docs/audits/operations-policy-matching-supply-final-reaudit-2026-08-13.md
docs/audits/operations-policy-matching-supply-final-reaudit-evidence-2026-08-13/audit-metrics.json
docs/agent/prompts/operations-policy-final-remediation-master-2026-08-13.md
```

화면 증거도 최소 다음 파일을 직접 열어 비교하라.

```text
01-matching-supply-1440x1000.png
03-supply-diagnostics-mid-1440x1000.png
04-zero-sensitivity-and-stage-1440x1000.png
05-simulation-blocked-1440x1000.png
10-policy-switch-reset-1440x1000.png
12-sensitivity-1600x1000.png
15-policies-runtime-current-1440x1000.png
16-audit-runtime-current-1440x1000.png
```

증거 폴더:

```text
docs/audits/operations-policy-matching-supply-final-reaudit-evidence-2026-08-13/
```

## 작업 규칙

- `AGENTS.md`의 단일 에이전트 규칙을 따른다. subagent·worker·handoff agent를 만들지 않는다.
- 작업 시작 시 `git status --short`와 관련 diff를 확인한다.
- 현재 작업 트리는 매우 dirty하다. 기존 변경을 사용자 작업으로 간주하고 reset, checkout, stash, 대량 포맷, 무관한 정리를 하지 않는다.
- 같은 파일에 이미 진행 중인 수정이 있으면 현재 내용을 기준으로 병합하고 이전 상태로 덮어쓰지 않는다.
- `rg`로 실제 caller, test, route, type을 추적한 뒤 root cause를 한 번만 고친다.
- 기존 컴포넌트, 타입, DateTime formatter, StatusBadge, AdminTraceSummary, AdminSection, AdminEmptyState를 우선 재사용한다.
- 새 상태관리 라이브러리, UI 라이브러리, 날짜 라이브러리, validation 라이브러리를 추가하지 않는다.
- screenshot 전용 CSS, 하드코딩된 mock 상태, 숫자만 맞추는 fixture를 만들지 않는다.
- 실제 정책 Save, rollback, wallet/payment/booking 변경을 브라우저 QA에서 제출하지 않는다.
- 1024px 이하 반응형 화면은 검사·수정·보고 범위에서 완전히 제외한다.
- 제품 UI는 영문 Admin copy를 유지하되 운영자가 이해하는 짧고 사실적인 문구를 사용한다.
- user-facing `provider` 표기는 기존 내부 타입을 제외하고 `Partner`를 유지한다.

## 현재 확인된 기준선

재감사 시점의 사실은 다음과 같다. 작업 시작 후 현재 코드에서 다시 검증하되, 증거 없이 뒤집지 않는다.

### 완료되어 보존해야 할 항목

- Supply 기본 화면은 공급 0, Demo reference, 다음 행동을 명확히 표시한다.
- 공급 0 상세 진단은 기본적으로 접혀 있고 접기 전에는 표가 DOM에 없다.
- Simulation은 공급 전제조건이 없으면 `Blocked`와 empty state를 표시하고 결과표를 숨긴다.
- 1440px 정책 편집기는 목록 아래 전체 폭으로 열려 Action/Close/Save가 보인다.
- 정책 A에서 입력 후 정책 B로 전환하면 B의 current value, 빈 reason, unchecked 상태로 초기화된다.
- initial validation은 중립 상태이고 touched/submit 이후 오류가 보인다.
- high-risk 정책 라벨 확인과 성공 후 `Revert to Before`가 구현됐다.
- API 최신 소스에는 non-live PATCH 409, expectedValue 비교, PostgreSQL advisory lock, value/audit transaction이 있다.
- audit source는 operator / automated_smoke / legacy_unknown으로 구분하는 최신 소스와 테스트가 있다.
- 정적 FCM 성공 문구는 `FCM readiness is not verified in this workspace`로 수정됐다.

이 항목은 지우거나 새 구조로 다시 만들지 말고 회귀 테스트만 보강한다.

### 아직 해결되지 않은 항목

- 실행 화면은 Live 28 / Locked 0 / Planned 0이다.
- 최신 source 계약은 Live 19 / Locked 2 / Planned 7이다.
- `AdminOperationalPolicySetting.lifecycle`가 optional이다.
- `page.tsx`, `operations-policy-groups.ts`가 lifecycle 누락 시 `enforced ? live : planned`로 fail-open 추론한다.
- Audit 화면은 실제 실행 환경에서 unavailable이다.
- 정책 편집 화면은 Audit read health와 독립적으로 Save를 열 수 있다.
- Supply 상세는 약 6,700px, 표 3개, 19행이다.
- sensitivity 표 2개가 `AdminDetailGrid` 2열에 있어 1440·1600 모두 내부 수평 스크롤을 요구한다.
- `bookings.length > 0` 때문에 open matching 0이어도 stage scenario가 표시된다.
- `Marketplace ready 0`, `Readiness follow-up 0`에 문자열 추론으로 `Live` 배지가 붙는다.
- Identity/Location/Push blocker 수가 같은 Partner를 중복 포함할 수 있지만 합산 금지 안내가 없다.
- observedAt이 raw ISO 문자열이다.
- 유효한 새 값에도 `Choose a value different from the current value.` helper가 남는다.
- 1440px Policies 검색 라벨과 placeholder가 일부 잘린다.

## 구현 순서

P0를 완료하고 검증하기 전에는 P1 시각 개선으로 넘어가지 않는다. 각 단계는 기존 구현이 이미 충족하면 재작성하지 말고 테스트·실행 증거만 남긴다.

## Phase 0 — 기준선과 실행 프로세스 확인

1. 관련 production import와 test를 `rg`로 추적한다.
2. 특히 다음 파일의 현재 내용과 diff를 확인한다.

```text
apps/admin_web/lib/admin-api.ts
apps/admin_web/app/operations-policy/page.tsx
apps/admin_web/app/operations-policy/operations-policy-groups.ts
apps/admin_web/app/operations-policy/operations-policy-page-model.ts
apps/admin_web/app/operations-policy/operations-policy-form.tsx
apps/admin_web/app/operations-policy/booking-acceptance-matrix.ts
apps/admin_web/app/operations-policy/operations-policy-final-partner-choice-section.tsx
apps/admin_web/app/operations-policy/operations-policy-sensitivity-preview-section.tsx
apps/admin_web/app/operations-policy/matching-stage-impact-preview.ts
apps/admin_web/app/operations-policy/operations-policy-matching-stage-impact-section.tsx
apps/api/src/matching/matching.policy.ts
apps/api/src/admin/admin.service.ts
apps/api/src/admin/admin-operational-policy-audit-source.ts
apps/api/src/admin/admin-operational-policy-concurrency.integration.spec.ts
infra/scripts/check-operations-policy-consistency.mjs
```

3. 3000/3101 포트의 PID, 시작 시각, command line과 source/dist build 시각을 기록한다.
4. 실행 API가 최신 source를 로드했는지 확인한다. 단순히 source가 맞다는 이유로 runtime도 맞다고 가정하지 않는다.
5. baseline focused test를 먼저 실행한다. 기존 unrelated failure는 기록하되 임의로 수리하지 않는다.

## Phase 1 — Lifecycle 계약을 fail-closed로 수정 (P0)

### 1.1 단일 lifecycle 정규화 경계

`enforced`를 lifecycle fallback으로 사용하지 않는다.

지원 상태는 다음과 같다.

```ts
type OperationalPolicyLifecycle = 'live' | 'locked' | 'planned' | 'deprecated';
type OperationalPolicyLifecycleView = OperationalPolicyLifecycle | 'unknown';
```

구현 원칙:

- API 최신 응답의 lifecycle는 required 계약이다.
- runtime에서 누락되거나 알 수 없는 값이 들어올 수 있으므로 한 곳의 작은 normalizer에서 `unknown`으로 변환한다.
- `unknown`은 절대 Live가 아니다.
- `unknown`, locked, planned, deprecated에는 edit link와 form이 없다.
- deep link `?edit=<unknown/non-live key>`도 form 대신 read-only notice를 표시한다.
- notice에는 `Policy contract unavailable — editing disabled` 또는 lifecycle별 사실적인 이유를 표시한다.
- 목록 count에 `Contract unavailable`을 별도 표시한다. 28 unknown을 28 Live로 위장하지 않는다.
- `enforced`는 legacy display/compatibility에 필요하면 유지하되 write eligibility와 Live count에는 사용하지 않는다.

가장 작은 구현을 선택하라. `page.tsx`와 `operations-policy-groups.ts`마다 별도 fallback을 복제하지 말고 기존 operations-policy helper 경계에 한 번 둔다. 새 범용 framework나 registry를 만들지 않는다.

### 1.2 API 계약과 server guard

- `OPERATIONAL_POLICY_DEFINITIONS`의 기대 분포는 19 live, 2 locked, 7 planned이다.
- 숫자만 하드코딩하지 말고 expected key set과 실제 정의에서 계산한 count를 모두 검증한다.
- non-live PATCH 409 guard를 유지하고 안정적인 error code/message를 확인한다.
- 구버전 Admin이 요청하더라도 API가 non-live 변경을 허용하지 않아야 한다.
- 실제 consumer가 없는 정책을 Live로 만들기 위해 가짜 consumer 문자열을 추가하지 않는다.
- schema/migration을 변경하지 않는다.

### 1.3 정합성 검사 강화

현재 `policy:admin-consistency`가 key/default만 확인한다면 다음을 추가한다.

- 모든 정책이 지원 lifecycle 하나를 갖는다.
- expected live/locked/planned key set이 일치한다.
- live는 실제 consumer ID와 integration test ID를 가진다.
- non-live는 editable/enforced로 노출되지 않는다.
- Admin/API key, default, lifecycle가 일치한다.
- lifecycle 누락, unknown, 중복 key, unknown consumer는 검사 실패다.

실제 symbol/test를 확인하지 않는 문자열 장식은 금지한다.

### 1.4 배포 호환성

- 관리자와 API가 다른 버전일 때도 Admin이 fail-closed인지 fixture/E2E로 검증한다.
- 기존 System Health/build fingerprint 구조가 있으면 policy contract/build 불일치를 표시하도록 재사용한다.
- 이를 위해 새 서비스나 큰 endpoint shape 변경이 필요하다면 추가하지 말고 lifecycle missing guard와 배포 smoke를 우선한다.

### Phase 1 수용 기준

- lifecycle 없는 fixture에서 edit link가 0개다.
- unknown lifecycle deep link에 form이 없다.
- 최신 동일 build 실행 화면은 Live 19 / Locked 2 / Planned 7이다.
- locked/planned PATCH는 409이고 audit row가 생기지 않는다.
- 구버전 API + 신버전 Admin 조합이 write disabled로 끝난다.

## Phase 2 — Audit 정상화와 write gate (P0)

### 2.1 실행 Audit API 복구

- controller/route/service가 source filter, cursor, limit를 실제 실행 build에 포함하는지 확인한다.
- route가 source에는 있지만 runtime에 없으면 코드를 중복 구현하지 말고 올바르게 build/restart한다.
- Operator, Automated smoke, Legacy unknown 각각 서버 필터 결과를 반환한다.
- API failure와 empty audit는 현재처럼 구분한다.
- browser가 audit source를 spoof할 수 없다는 server-trusted 계약을 보존한다.

### 2.2 정책 변경 write gate

정책 편집을 열 때 최소 비용으로 Audit read health를 확인한다.

- selected live policy가 있을 때 기존 audit endpoint를 `take=1`로 조회하는 방식처럼 현재 구조에 맞는 가장 작은 방법을 선택한다.
- Audit read가 unavailable이면 form 또는 Save를 비활성화한다.
- 단순 disabled 버튼만 두지 말고 이유, Retry, `Open System Health`를 제공한다.
- 화면 문구 예시:

```text
Policy changes are temporarily disabled
The audit trail cannot be verified. Retry or open System Health before changing a live policy.
```

- Audit이 정상이고 lifecycle가 live일 때만 write form을 연다.
- write API의 value+audit transaction은 유지한다.
- 저장 성공 응답의 audit ID가 Audit endpoint에서 즉시 읽히는 E2E를 추가한다.
- rollback도 새 audit event를 남기고 latest expectedValue 충돌을 지킨다.
- 실제 운영 정책을 브라우저에서 저장하지 않는다. API test fixture/격리된 integration environment를 사용한다.

### 2.3 동시성 증명

현재 `admin-operational-policy-concurrency.integration.spec.ts`가 이미 존재하면 새 파일을 만들지 말고 내용을 검수·보강한다.

실제 PostgreSQL에서 동일 key/expectedValue의 두 PATCH를 동시에 실행해 다음을 증명한다.

```text
1 success
1 conflict (409-equivalent)
1 persisted value
1 audit event
0 audit event for failed request
```

row가 없는 default/create race도 포함한다. 순차 mock만으로 완료 선언하지 않는다. 환경이 없으면 `NOT VERIFIED — real PostgreSQL concurrency`로 정확히 남긴다.

### Phase 2 수용 기준

- Audit 탭이 실제 실행 환경에서 정상 데이터를 표시한다.
- source 탭별 결과와 cursor가 정상이다.
- Audit unavailable fixture에서 Save가 불가능하다.
- Audit empty는 정상/쓰기 가능 여부를 계약대로 구분한다.
- 저장·rollback audit E2E 또는 명시적인 NOT VERIFIED 증거가 있다.

## Phase 3 — Supply 진단을 행동 우선 구조로 정리 (P1)

현재 기본 접힘 화면은 유지한다. 전체 페이지를 새로 디자인하지 않는다.

### 3.1 정보 계층

상세 진단을 다음 계층으로 정리한다.

```text
Supply evidence
├─ Decision strip
│  ├─ Ready / Blocked / Unavailable / Stale
│  ├─ local observed time + relative age + sample scope
│  └─ Refresh
├─ Primary blocker
│  ├─ usable / sampled
│  ├─ top root causes
│  └─ 최대 3개 실제 작업 링크
├─ Current policy snapshot
└─ Advanced diagnostics (collapsed)
   ├─ Partner gate breakdown
   ├─ Radius sensitivity
   ├─ Freshness sensitivity
   └─ Matching stage scenarios — open sample이 있을 때만
```

확장 후에도 `Review Partner location`, `Review push delivery` 같은 현재 행동 링크가 상단에서 사라지지 않게 한다. sticky를 새로 만들 필요가 없다면 상세 시작부에 한 번 더 명확히 배치하는 것으로 충분하다.

### 3.2 중복 blocker 집계 설명

Identity, Location, Push, Wallet, Account 수는 서로 배타적이지 않다.

- `Blocker categories overlap — do not total these cards.` 안내를 보인다.
- 각 카드에 가능하면 `affected / sampled`를 표시한다.
- `All records`, `Live`, `Current filters` 같은 자동 범위 배지를 blocker 의미로 사용하지 않는다.
- 해당 작업 큐가 있으면 카드 또는 섹션에 연결한다.

### 3.3 KPI 상태를 명시적 데이터로 전달

`AdminTraceSummary`의 문자열 추론을 전역 수정하지 않는다. 다른 관리자 페이지 회귀 위험이 크다.

이 Operations Policy 영역의 metric model 또는 mapping에서 기존 `scope`, `kind`를 명시한다.

예상 의미:

```text
Marketplace ready 0      → scope: Blocked, kind: risk
Final gate held 30       → scope: Needs action, kind: risk
Cash debt gate 1         → scope: Needs action, kind: risk
Identity block 30        → scope: Needs action, kind: risk
Bank review 30           → scope: Sample review 또는 All sampled, kind: record/action
Location block 30        → scope: Needs action, kind: risk
Push gap 30              → scope: Needs action, kind: action/risk
Readiness follow-up 0    → scope: No follow-up, kind: record/period
```

프로젝트의 실제 `MetricCardKind` union에 맞춰 조정한다. 값이 0이면 무조건 Live로 추론하지 않는다.

### 3.4 관측 시각과 freshness

- raw ISO를 본문 문자열로 직접 출력하지 않는다.
- 기존 `DateTimeText`, Intl, 관리자 시간 컴포넌트를 재사용한다.
- 예: `Observed 23:05 ICT · 2 min ago`.
- 절대 시각과 상대 age를 함께 제공한다.
- 기존 stale 기준이 있으면 재사용하고, 없으면 새 전역 freshness framework를 만들지 말고 이 evidence model의 최소 기준과 테스트를 둔다.
- Demo reference에서는 왜 Demo인지와 생산 근거를 만들기 위한 실제 링크/행동을 설명한다.

## Phase 4 — Zero sample과 민감도 레이아웃 수정 (P1)

### 4.1 Open matching 0

현재 `bookings.length > 0` 렌더 조건을 제거한다.

- `MatchingStageImpactPreview`에 `openMatchingCount` 또는 `hasOpenMatchingSample`을 명시한다.
- `OPEN_MATCHING`만 scenario sample로 인정한다.
- openMatchingCount가 0이면 `No open matching bookings to model` empty state만 표시한다.
- Stage 1/2/3 scenario row를 만들거나 DOM에 렌더하지 않는다.
- matched/live handoff repair 수치가 필요하면 open matching 시나리오와 분리해 사실적으로 표시한다.

### 4.2 Sensitivity 표

- `OperationsPolicySensitivityPreviewSection`의 두 표를 2열 `AdminDetailGrid`에서 제거한다.
- 1440/1600에서 가장 단순한 full-width vertical stack을 우선한다.
- 기존 탭 컴포넌트가 이미 있어 더 단순할 때만 Radius/Freshness 탭을 사용한다.
- 새 탭 시스템을 만들지 않는다.
- table wrapper는 페이지 가로 overflow뿐 아니라 내부 가로 스크롤도 없게 한다.
- 긴 `Operator read`는 짧은 `Primary blocker` 한 줄로 줄이거나 row 아래 상세로 이동한다.
- 권장 기본 열:

```text
Tested value | Usable | Change vs current | Primary blocker
```

- current value row를 텍스트/배지로 명시한다.
- 모든 결과가 0이면 표 위에 `Changing radius/freshness alone does not create usable supply in this sample.`을 표시한다.
- 중요한 의미를 색상만으로 전달하지 않는다.

### Phase 4 수용 기준

- 공급 0 기본 화면은 table 0, scenario row 0이다.
- 상세를 열어도 open matching 0이면 stage table이 없다.
- 1440×1000, 1600×1000에서 sensitivity 내부 수평 스크롤이 없다.
- `Operator read` 장문 때문에 극단적으로 높은 행이 생기지 않는다.

## Phase 5 — 남은 문구와 1440px 마감 (P2)

### 5.1 New value helper

- 현재값과 같을 때만 `Choose a value different from the current value.`를 표시한다.
- 유효하게 달라졌다면 helper를 숨기거나 `Will change 15 → 20 minutes`처럼 사실적인 중립 확인을 표시한다.
- field error와 helper가 동일 id를 공유해 screen reader에 중복/모순을 주지 않게 한다.

### 5.2 Policies 검색 필터

- 1440에서 `Search policies` 라벨이 두 줄로 깨지지 않는다.
- placeholder 전체가 읽히거나 의미가 유지되는 더 짧은 문구를 사용한다.
- Status/Operating group과 충돌하지 않도록 기존 grid 비율만 최소 조정한다.
- Action 열, Close, Save의 현재 가시성을 회귀시키지 않는다.

### 5.3 접근성과 dark mode

- disclosure의 `aria-expanded`, `aria-controls`를 유지한다.
- dynamic readiness/audit 상태는 적절한 status/alert로 공지한다.
- disabled Save의 이유가 도움말과 연결된다.
- keyboard-only로 Supply disclosure, Retry, queue links, policy editor를 탐색할 수 있다.
- warning/danger/info는 dark mode와 Windows high contrast에서 색만으로 구분하지 않는다.
- 200% text zoom에서 1440 viewport의 핵심 버튼과 표 내용이 겹치지 않는지 확인한다.

## 필수 테스트

기존 test 파일을 우선 보강하고 비슷한 새 test 파일을 만들지 않는다.

### Admin Web

1. lifecycle missing/unknown → Contract unavailable, edit link/form 없음
2. lifecycle 19/2/7 count와 expected key set
3. direct edit deep link for locked/planned/unknown → read-only notice
4. Audit unavailable → Save/form disabled, Retry/System Health 제공
5. Audit empty와 unavailable 구분
6. 기존 A→B dirty form reset 회귀
7. high-risk confirmation/rollback 회귀
8. openMatchingCount=0 → stage table/rows 없음
9. openMatchingCount>0 → scenario 표시
10. sensitivity가 2열 AdminDetailGrid를 사용하지 않는 구조 계약
11. impact metrics가 명시 scope/kind를 사용하고 ready 0에 Live가 없음
12. blocker overlap 안내
13. localized observedAt와 stale 상태
14. valid changed value helper가 모순되지 않음
15. 1440 filter/editor 구조 회귀
16. light/dark mode에서 텍스트 상태가 존재하고 색상만 사용하지 않음

### API / Integration / Consistency

1. non-live lifecycle PATCH 409
2. live/locked/planned exact key set과 count
3. lifecycle/consumer/admin consistency
4. audit source filter와 cursor
5. audit endpoint failure/empty
6. concurrent PATCH → one success, one conflict, one audit
7. absent-row create race
8. rollback expectedValue와 새 audit
9. old/missing lifecycle response compatibility는 Admin fail-closed E2E 또는 fixture로 검증

## 검증 명령

먼저 root와 workspace `package.json`의 실제 script를 확인하고 정확한 명령을 사용한다. 최소 다음 범위를 실행한다.

```powershell
npm.cmd run test -w @massage-vn/admin-web -- app/operations-policy
npm.cmd run test -w @massage-vn/api -- src/matching/matching.policy.spec.ts src/admin/admin-operational-policy-audit-source.spec.ts
npm.cmd run test -w @massage-vn/api -- src/admin/admin.service.spec.ts -t "operational policy"
npm.cmd run typecheck -w @massage-vn/admin-web
npm.cmd run typecheck -w @massage-vn/api
npm.cmd run policy:admin-consistency
npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api
```

실제 PostgreSQL integration script가 별도면 기존 방식으로 concurrency test를 실행한다.

Protected area인 `apps/api/src/matching/**`의 behavior를 변경했다면 `AGENTS.md`에 따라 integration review와 가능한 full local verification도 실행한다.

```powershell
npm.cmd run verify:local
```

실행 시간이 길거나 서비스 의존성이 없어 skip하면 이유를 정확히 보고한다. unrelated push campaign test 실패를 이번 작업의 성공으로 숨기지도, 요청 없이 광범위하게 수정하지도 않는다.

UI 수정이 끝난 뒤 한 번만 Impeccable detector를 실행한다.

```powershell
node C:\Users\laboy\.codex\skills\impeccable\scripts\detect.mjs --json `
  apps/admin_web/app/operations-policy/page.tsx `
  apps/admin_web/app/operations-policy/operations-policy-final-partner-choice-section.tsx `
  apps/admin_web/app/operations-policy/operations-policy-sensitivity-preview-section.tsx `
  apps/admin_web/app/operations-policy/operations-policy-matching-stage-impact-section.tsx `
  apps/admin_web/app/operations-policy/operations-policy-form.tsx
```

실제 변경 파일에 맞게 target을 조정한다. concept 선택 전에 반복 실행하지 않는다.

## Build와 실행 환경 검증

source test만 통과하고 runtime이 구버전인 상태로 완료 선언하지 않는다.

1. 변경 전후 API/Admin build를 실행한다.
2. 정확한 PID와 command line을 확인한다.
3. 현재 프로젝트의 해당 프로세스만 안전하게 재시작한다.
4. 다른 node/process를 광범위하게 종료하지 않는다.
5. 재시작 후 실제 페이지와 API response를 다시 확인한다.
6. build SHA/version을 얻을 수 있으면 증거 보고서에 기록한다.

최종 runtime 증거:

```text
Policies: Live 19 / Locked 2 / Planned 7 / Contract unavailable 0
Audit: Operator/Automated/Legacy 조회 가능
Supply: Blocked/Ready 상태와 localized observedAt
Simulation: 기존 Blocked 동작 유지
```

## 브라우저 검증

로그인된 in-app browser를 사용한다. 한 번의 구현 후 한 번의 종합 검수, 필요한 수정 후 최대 한 번의 확인 검수로 끝낸다. 무한 polishing loop를 만들지 않는다.

검증 viewport:

```text
1440×1000
1600×1000
```

1024px 이하 화면은 열거나 보고서에 넣지 않는다.

다음 증거를 새 폴더에 남긴다.

```text
docs/audits/operations-policy-matching-supply-final-remediation-evidence-2026-08-13/
  01-policies-lifecycle-1440x1000.png
  02-contract-unavailable-fixture-or-state-1440x1000.png
  03-audit-operator-1440x1000.png
  04-audit-unavailable-write-disabled-1440x1000.png
  05-supply-default-1440x1000.png
  06-supply-diagnostics-actions-1440x1000.png
  07-sensitivity-stacked-1440x1000.png
  08-zero-open-matching-empty-1440x1000.png
  09-sensitivity-stacked-1600x1000.png
  10-policy-valid-helper-1440x1000.png
  11-supply-dark-1440x1000.png
```

브라우저 확인 항목:

- 실제 runtime이 19/2/7인지
- locked/planned 행에 edit가 없는지
- unknown contract 상태에서 write가 닫히는지
- Audit 정상 상태와 unavailable 상태가 구분되는지
- Audit unavailable에서 Save가 불가능한지
- Supply 기본 접힘의 짧은 구조가 유지되는지
- blocker overlap 안내와 명시적 KPI 배지가 보이는지
- observedAt이 현지 시각과 relative age로 보이는지
- sensitivity 내부 가로 스크롤이 없는지
- open matching 0에서 stage table이 없는지
- 1440 filter와 form helper가 잘리지 않고 모순되지 않는지
- light/dark 모두 텍스트 대비와 상태 의미가 유지되는지
- browser console error/warning과 failed network request

정책 변경 form의 입력·전환은 검증할 수 있지만 Save는 누르지 않는다.

## 금지되는 지름길

- lifecycle 누락을 `enforced=true` 또는 다른 legacy boolean으로 Live 처리하지 않는다.
- UI 버튼만 숨기고 API가 non-live write를 허용하게 두지 않는다.
- 19/2/7 숫자를 UI에 하드코딩하지 않는다.
- API route가 stale runtime에 없다는 이유로 중복 route/service를 만들지 않는다.
- Audit API 불능을 empty 또는 aligned 상태로 표시하지 않는다.
- Audit 불능인데 Save를 열어 두지 않는다.
- `AdminTraceSummary` 전역 inference를 이 페이지 하나 때문에 광범위하게 바꾸지 않는다.
- blocker count를 서로 더하거나 배타적인 집계처럼 표현하지 않는다.
- open matching 0인데 최근 booking 20건을 근거로 scenario를 표시하지 않는다.
- sensitivity를 CSS overflow로만 감추거나 1440/1600에서 가로 스크롤에 떠넘기지 않는다.
- raw ISO를 운영자 최종 문구로 사용하지 않는다.
- 새 date/UI/state 라이브러리를 추가하지 않는다.
- 기존 완료 항목을 새 설계로 재작성하지 않는다.
- 실제 운영 policy를 저장해 E2E를 증명하지 않는다.
- schema, migration, auth role 체계를 추측으로 변경하지 않는다.
- unrelated dirty worktree를 정리하거나 되돌리지 않는다.
- 테스트 통과만으로 runtime 검증을 생략하지 않는다.

## 중단 조건

다음 경우에만 해당 slice를 멈추고 blocker와 최소 대안을 보고한다. 독립적인 다른 slice는 안전하면 계속한다.

- lifecycle 또는 audit 수정에 schema/migration이 반드시 필요한데 승인되지 않음
- 기존 auth 계약 변경 없이는 permission 상태를 구현할 수 없음
- 같은 dirty line의 사용자 변경과 안전하게 병합할 수 없음
- 실제 정책 의미가 source/test/report에서 충돌해 결정할 수 없음
- PostgreSQL integration environment가 없어 concurrency를 실제 증명할 수 없음
- 로그인이 필요함

시간이 오래 걸리거나 테스트가 많다는 이유로 중단하지 않는다.

## 완료 기준

다음이 모두 충족되어야 완료다.

### Release blocker

- [ ] lifecycle missing/unknown이 fail-closed다.
- [ ] 동일 최신 build runtime에서 19 live / 2 locked / 7 planned다.
- [ ] non-live PATCH는 API 409다.
- [ ] Audit endpoint가 실제 runtime에서 정상이다.
- [ ] Audit unavailable이면 policy Save가 불가능하다.
- [ ] source별 Audit 조회가 작동한다.

### Supply UX

- [ ] 기본 공급 차단 화면의 현재 장점을 보존했다.
- [ ] blocker 중복 집계를 명시했다.
- [ ] ready 0에 Live 배지가 없다.
- [ ] 관측 시각이 localized/relative다.
- [ ] open matching 0이면 stage table이 없다.
- [ ] sensitivity가 1440/1600에서 내부 가로 스크롤이 없다.

### Form/quality

- [ ] 유효 값 helper가 현재 상태와 모순되지 않는다.
- [ ] 1440 필터 라벨/placeholder가 잘리지 않는다.
- [ ] 기존 form reset, high-risk confirmation, rollback, Simulation blocked가 회귀하지 않았다.
- [ ] light/dark, keyboard, alert/status 의미가 유지된다.

### Verification

- [ ] focused tests와 typecheck가 통과했다.
- [ ] consistency 검사가 lifecycle/consumer까지 검사한다.
- [ ] Admin/API scope verification 결과가 있다.
- [ ] protected behavior 변경 시 full verification 결과가 있다.
- [ ] 실제 runtime/browser 증거가 있다.
- [ ] 실제 PostgreSQL concurrency 결과 또는 정확한 NOT VERIFIED가 있다.

## 산출물

구현 코드와 테스트 외에 다음을 생성한다.

```text
docs/audits/operations-policy-matching-supply-final-remediation-evidence-2026-08-13/
docs/audits/operations-policy-matching-supply-final-remediation-report-2026-08-13.md
```

구현 보고서에는 반드시 다음을 포함한다.

1. 감사 finding별 PASS / PARTIAL / BLOCKED / NOT VERIFIED
2. root cause와 실제 수정
3. source contract와 runtime lifecycle 수치
4. Audit 정상/장애 write gate 증거
5. open matching zero와 sensitivity 레이아웃 전후
6. 테스트·typecheck·scope/full verification 결과
7. 실제 PostgreSQL concurrency 결과
8. screenshot index와 viewport
9. 변경 파일 목록
10. protected area, schema, migration, dependency 접촉 여부
11. 남은 위험과 출시 판단
12. 다음 단 하나의 우선 작업

## 최종 응답 형식

최종 응답은 다음 순서로 간결하게 작성한다.

1. 운영자가 무엇을 더 안전하고 빠르게 할 수 있게 됐는지
2. P0 release blocker가 모두 해결됐는지
3. 실제 runtime 19/2/7과 Audit 상태
4. 주요 검증 PASS/FAIL/NOT VERIFIED
5. 구현 보고서와 증거 링크
6. 변경 파일과 protected area
7. 남은 위험과 다음 한 가지 작업

파일 수나 코드 양보다 **fail-closed lifecycle, 실제 runtime 일치, Audit 기반 write gate, zero-sample 정직성**을 먼저 증명하라.

지금 `git status --short`, 관련 diff, AGENTS.md, 최종 재감사 보고서와 지정 screenshot을 읽는 것부터 시작하라. 이미 완료된 변경은 보존하고, P0부터 순서대로 구현·검증한 뒤에만 완료를 선언하라.

---
