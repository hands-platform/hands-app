# Codex 실행 프롬프트 — `/setup` Runtime Active 운영 UX·상태 계약·배포 일치성 개선

아래 내용을 새 Codex 작업에 그대로 붙여 넣어 사용한다.

---

## 역할

너는 `C:\dev\massage-on-demand-vn` 프로젝트의 시니어 풀스택 제품 엔지니어이자 관리자 운영 UX, Next.js, NestJS 상태 API, 운영 관측성 전문가다.

이번 작업은 추가 분석이나 문서 작성만 하는 작업이 아니다. 최신 재감사에서 확인된 `/setup?mode=runtime&view=active`의 미완료 사항을 실제 코드에 구현하고, source·production build·실행 중인 Admin server·브라우저 화면이 모두 같은 수정본인지 검증해야 한다.

최종 사용자는 개발팀이 아니라 초기 서비스를 혼자 관리하는 운영자다. 이 화면에서 다음 질문에 바로 답할 수 있어야 한다.

1. 지금 실제 장애가 있는가?
2. 장애는 아니지만 운영 증거가 부족한 서비스가 있는가?
3. 각 상태는 어떤 근거로 판단됐는가?
4. 마지막 검증은 언제, 어떤 방식으로 이루어졌는가?
5. 지금 운영자가 해야 할 가장 안전한 행동은 무엇인가?
6. 관련 업무 화면과 실제 상태 증거는 어떻게 다른가?

시각적 장식보다 **상태 계약의 정확성, evidence gap의 조치 가능성, 1440px 판단 속도, 실제 배포본 검증**을 우선한다.

## 저장소와 필수 기준 문서

- 올바른 저장소: `C:\dev\massage-on-demand-vn`
- 사용 금지 저장소: `C:\dev\massage-vn-workspace`
- 대상 URL: `http://localhost:3101/setup?mode=runtime&view=active`
- 최신 재감사 보고서:
  - `C:\dev\massage-on-demand-vn\docs\audits\setup-runtime-active-post-prompt-final-reaudit-2026-08-14.md`
- 최신 감사 화면 증거:
  - `C:\dev\massage-on-demand-vn\docs\audits\setup-runtime-active-final-reaudit-evidence-2026-08-14\`
- 이전 전체 Setup 보고서:
  - `C:\dev\massage-on-demand-vn\docs\audits\setup-post-remediation-final-reaudit-2026-08-14.md`
- 이전 구현 프롬프트:
  - `C:\dev\massage-on-demand-vn\docs\audits\setup-post-remediation-codex-implementation-prompt-2026-08-14.md`
- 저장소 지침:
  - `C:\dev\massage-on-demand-vn\AGENTS.md`
- 상태 API 문서:
  - `C:\dev\massage-on-demand-vn\docs\architecture\health-readiness.md`

작업 시작 시 위 문서를 먼저 읽는다. 보고서의 줄 번호를 맹신하지 말고 현재 파일을 `rg`로 다시 찾는다. 이미 해결된 사항을 이전 상태로 되돌리지 않는다.

## 이번 감사에서 확인된 사실

### 실행 화면

- Runtime active 서비스: 6개
- 실제 runtime Healthy: Supabase core 1개
- Configuration ready / Not monitored: 5개
- Deferred: 3개
- 화면 summary: `Needs action 0`, `Unknown or not monitored 5`, `Deferred 3`
- `Evidence gaps` saved view: 없음
- `view=evidence-gaps` 직접 접근: URL은 그대로지만 UI는 Active services로 fallback
- Runtime 표: 7열
- 1440×1000 table wrapper: 약 1050px
- 1440×1000 table content: 약 1162px
- Action을 완전히 보기 위한 수평 이동: 약 97px
- 첫 5개 row 높이: 약 199px
- Action을 보기 위해 오른쪽으로 이동하면 Service 열이 사라짐
- 1600×1000 dark theme: 구조 붕괴는 없지만 정보 밀도 문제 유지

### source와 구현 상태

최신 구현 프롬프트가 작성된 이후 주요 Setup/API 파일이 수정되지 않았다.

- `setup-overview-section.tsx`: 2026-08-12
- `setup-page-model.ts`: 2026-08-12
- `health.service.ts`: 2026-08-12
- `admin-navigation.ts`: 2026-08-10
- 구현 프롬프트: 2026-08-14

현재 구현에는 다음 marker가 없다.

```text
evidence-gaps
evidenceGaps
notMonitored
evidenceHref
relatedWorkspaceHref
Cash-only launch configuration is ready
Open related workspace
```

### build와 실행 process

- Admin process 시작: 2026-08-14 10:43
- `.next` build 생성: 2026-08-14 13:57
- 실행 process가 build보다 먼저 시작됐으므로 현재 3101 화면이 최신 `.next`를 서비스한다고 보장할 수 없다.
- running UI의 computed table min-width와 current source CSS도 일치하지 않았다.

### 기존 검증

- Admin Setup 테스트: 14 files / 59 tests PASS
- API Health 테스트: 2 files / 25 tests PASS
- Admin visible-copy: 1,641 files / violations 0

이 테스트 통과는 기존 구현이 깨지지 않았다는 뜻일 뿐, 이번 요구사항이 구현됐다는 증거가 아니다. 신규 계약 테스트가 필요하다.

## 최종 목표

다음을 모두 실제 구현한다.

1. `Evidence gaps`를 독립적인 Runtime saved view로 만든다.
2. `UNKNOWN`과 `NOT_MONITORED`를 API와 UI에서 분리한다.
3. 1440px에서 Service·상태·Action을 수평 이동 없이 동시에 보이게 한다.
4. Runtime 표를 최대 5개 핵심 열로 정리한다.
5. evidence, related workspace, runbook 링크의 의미를 분리한다.
6. Not monitored와 DEGRADED에 운영자가 이해할 수 있는 행동 문구를 제공한다.
7. legacy와 operator-facing launch scope를 단일 manifest에서 파생시킨다.
8. `Setup Readiness` 명칭을 `External Services`로 통일한다.
9. Refresh가 현재 데이터를 유지하면서 pending/success/error를 알려 주게 한다.
10. source → build → running server → browser가 같은 수정본인지 증명한다.

## 절대 보존해야 할 기존 결정

다음은 올바른 설계이므로 되돌리지 않는다.

1. `/setup` route 하나 안에서 `Runtime health`와 `Launch readiness` 두 mode를 유지한다.
2. `/setup?mode=runtime&view=active`를 기본 Runtime view로 유지한다.
3. 새로운 사이드바 페이지나 대메뉴를 추가하지 않는다.
4. Configuration과 Runtime은 독립된 상태 축이다.
5. 설정값이 존재한다고 `Healthy` 또는 `Operational`로 표시하지 않는다.
6. `Healthy`는 최근 성공한 안전한 runtime probe가 있을 때만 사용한다.
7. 안전한 probe가 없으면 `NOT_MONITORED`로 표시한다.
8. Cash-only에서 disabled MoMo, VNPay, Referral은 `Deferred`이며 blocker가 아니다.
9. API 실패를 빈 목록, 0건, Healthy로 바꾸지 않는다.
10. OTP, SMS, Push, 결제, 환불, 실제 upload를 health refresh에서 발생시키지 않는다.
11. secret, token, private key, env value, raw provider error를 UI·로그·증거에 노출하지 않는다.
12. 기존 Admin 디자인 토큰, StatusBadge, DataTable, surface와 button primitive를 재사용한다.
13. 새 UI·상태 관리·관측성 라이브러리를 추가하지 않는다.
14. 1024px 이하, 모바일, 태블릿 반응형은 이번 작업에서 완전히 제외한다.

## 저장소 안전 규칙

1. 단일 agent로 작업하고 subagent를 만들지 않는다.
2. 현재 dirty worktree의 기존 변경은 사용자 작업이다.
3. 관련 없는 변경을 수정·삭제·되돌리지 않는다.
4. `git reset --hard`, 광범위 checkout, 무관한 파일 삭제를 금지한다.
5. 작업 전 `git status --short`와 대상 파일 diff를 기록한다.
6. 같은 파일의 기존 사용자 변경 위에 최소 범위로 수정한다.
7. `.env*`, gateway flag, provider credentials를 변경하지 않는다.
8. 실제 운영 또는 공유 데이터에 fixture row를 만들지 않는다.
9. Prisma schema나 migration을 이번 작업만을 위해 추가하지 않는다.
10. auth guard를 약화하지 않는다.

## 우선 조사할 코드

실제 호출자를 검색한 뒤 필요한 파일만 수정한다.

- `apps/admin_web/app/setup/page.tsx`
- `apps/admin_web/app/setup/loading.tsx`
- `apps/admin_web/app/setup/setup-overview-section.tsx`
- `apps/admin_web/app/setup/setup-page-model.ts`
- `apps/admin_web/app/setup/**/*.spec.*`
- `apps/admin_web/lib/admin-api.ts`
- `apps/admin_web/lib/admin-navigation.ts`
- `apps/admin_web/app/globals.css`
- `apps/admin_web/components/admin-data-table.tsx`
- `apps/api/src/health/health.controller.ts`
- `apps/api/src/health/health.service.ts`
- `apps/api/src/health/health.controller.spec.ts`
- `apps/api/src/health/health.service.spec.ts`
- `docs/architecture/health-readiness.md`
- `/health/external`과 legacy `checks[]`의 모든 소비자
- 관련 smoke scripts

공용 DataTable을 수정할 경우 다른 관리자 표의 회귀 위험을 확인한다. 가능하면 Setup 전용 class와 component에서 해결한다.

## Phase 0 — 구현이 실제로 적용되는 작업공간인지 증명

이 단계는 생략하지 않는다.

1. `Get-Location`과 `git rev-parse --show-toplevel`로 저장소가 `C:\dev\massage-on-demand-vn`인지 확인한다.
2. 대상 파일의 현재 `git diff`, size, modified time을 기록한다.
3. 다음 marker가 현재 없는지 검색한다.

```powershell
rg -n "evidence-gaps|evidenceGaps|notMonitored|evidenceHref|relatedWorkspaceHref" `
  apps/admin_web/app/setup apps/admin_web/lib/admin-api.ts apps/api/src/health
```

4. 로그인된 실제 `/setup?mode=runtime&view=active`를 1440×1000에서 캡처한다.
5. table wrapper/client width와 table scroll width를 측정한다.
6. `npm.cmd run local:status` 결과와 `.next` build time, Admin process start time을 기록한다.
7. Admin/API 집중 테스트를 baseline으로 실행한다.

분석 결과만 작성하고 멈추지 않는다. 안전한 범위의 구현으로 계속 진행한다.

## Phase 1 — launch capability policy를 단일화

### 현재 문제

같은 API 응답에 두 가지 launch scope 기준이 존재한다.

- legacy `decorateExternalCheck()`는 `isDeferredExternalCategory()`를 사용한다.
- legacy 분류는 Auth, SMS, payments, push, storage, referrals를 폭넓게 Deferred로 본다.
- operator-facing `externalServicePolicy()`는 Referral과 비활성 Cash-only PG만 Deferred로 본다.
- Admin은 `services[]`를 사용하지만 smoke script나 다른 소비자는 `checks[].scope`를 사용할 수 있다.

### 구현 요구사항

1. launch profile별 capability policy를 작은 단일 manifest 또는 순수 함수로 만든다.
2. capability별 최소 정보는 다음 의미를 가진다.

```ts
type LaunchCapabilityPolicy = {
  id: string;
  category: string;
  requiredForCurrentLaunch: boolean;
  deferredForCurrentLaunch: boolean;
};
```

현재 코드 구조에 맞게 이름은 조정할 수 있다. 불필요한 범용 framework는 만들지 않는다.

3. 다음 값이 같은 policy에서 파생되게 한다.

- legacy `checks[].scope`
- legacy `checks[].deferred`
- operator `services[].requiredForCurrentLaunch`
- operator `services[].configurationStatus`
- counts
- `currentStageOk`
- `blockingCategories`
- `deferredCategories`

4. Cash-only 정책은 다음을 유지한다.

- MoMo disabled: Deferred, blocker 아님
- VNPay disabled: Deferred, blocker 아님
- Referral: Deferred, blocker 아님
- Supabase core, Auth, Maps, SMS, FCM, Storage: 현재 확정 정책에 따라 required now

5. 기존 legacy 소비자가 있으면 필드를 즉시 제거하지 말고 새 policy 결과로 normalize한다.
6. 기존 `isDeferredExternalCategory()` 같은 별도 정책 분기표는 제거하거나 단일 manifest를 호출하게 한다.
7. 프론트에서 launch policy를 다시 추론하지 않는다.

### 필수 테스트

- 모든 capability에서 legacy scope와 operator-facing scope가 모순되지 않는다.
- Cash-only deferred 3개가 blocker에 포함되지 않는다.
- required + incomplete만 launch configuration blocker다.
- enabled `DOWN`/`DEGRADED`만 runtime action queue에 들어간다.
- config ready + no runtime probe는 `NOT_MONITORED`다.

## Phase 2 — Unknown, Not monitored, Evidence gaps 분리

### 상태 의미

- `UNKNOWN`: probe가 있지만 결과를 확정하지 못했거나 stale/조회 실패
- `NOT_MONITORED`: 안전한 runtime probe가 구성되지 않음
- `Evidence gap`: 현재 enabled/required 서비스인데 신뢰 가능한 runtime evidence가 부족하여 `UNKNOWN` 또는 `NOT_MONITORED`인 검증 과제

Evidence gap은 장애가 아니며 danger blocker로 표시하지 않는다. 그렇다고 `No action` 아래에 숨기지도 않는다.

### API contract

기존 field 호환성을 조사한 뒤 additive 변경을 우선한다.

```ts
counts: {
  needsAction: number;
  launchBlockers: number;
  degraded: number;
  unknown: number;
  notMonitored: number;
  evidenceGaps: number;
  deferred: number;
}
```

1. `unknown`에 `NOT_MONITORED`를 합산하지 않는다.
2. `evidenceGaps` 계산은 API 또는 공용 domain 함수 한 곳에서 한다.
3. UI마다 조건을 복제하지 않는다.
4. 실제 근거가 있을 때만 다음 metadata를 채운다.

```ts
evidenceLevel: 'CONNECTIVITY' | 'FUNCTIONAL' | 'CONFIGURATION_ONLY' | 'NONE';
lastVerifiedAt: string | null;
verificationMethod: string;
```

기존 `probeType`, `lastProbeAt`, `lastSuccessAt`, `configurationCheckedAt`으로 의미를 충분히 표현할 수 있으면 중복 필드를 만들지 않고 명확한 view model을 사용한다.

5. response generated time을 service-specific verification time으로 복제하지 않는다.

### Admin query contract

`SetupWorkspaceView`에 `evidence-gaps`를 추가한다.

```ts
type SetupWorkspaceView =
  | 'needs-action'
  | 'active'
  | 'evidence-gaps'
  | 'deferred';
```

필수 동작:

- `/setup?mode=runtime&view=evidence-gaps` → evidence gap 행만 표시
- 감사 기준 데이터에서는 5개 표시
- `aria-current=page`가 Evidence gaps에 적용
- URL과 visible active state가 일치
- invalid view는 visible fallback과 canonical URL을 일치시킴

invalid query 처리 방식은 server redirect, canonical replace 또는 현재 패턴에 맞는 최소 구현 중 하나를 선택한다. URL은 invalid value인데 UI만 Active로 보이는 상태를 남기지 않는다.

### Saved views와 summary

Runtime saved views:

```text
Needs action {N}
Active services {N}
Evidence gaps {N}
Deferred {N}
```

- Evidence gaps는 한 번 클릭으로 5개 검증 과제를 보여 준다.
- saved view와 summary가 같은 숫자를 바로 반복하지 않게 한다.
- status summary는 `Degraded`, `Unknown`, `Not monitored`, `Last verified`처럼 다른 판단 정보를 제공한다.
- async count 변화는 필요한 경우 하나의 `role=status`와 `aria-atomic=true` 문장으로 알린다. 모든 badge를 live region으로 만들지 않는다.

## Phase 3 — Runtime Active 표를 5열 운영 구조로 축소

### 목표

1440×1000에서 Service 이름과 primary Action을 수평 이동 없이 동시에 볼 수 있어야 한다.

### 기본 열

다음을 기준으로 최대 5열을 사용한다.

```text
Service
Runtime status
Evidence / last event
Current impact
Action
```

공간이 부족하면 Current impact도 상세 disclosure로 옮길 수 있다. 핵심은 Service, status, Evidence summary, Action이다.

### 기본 행 정보

Service cell:

- 서비스명
- configuration 상태 보조 문구

Runtime cell:

- Healthy / Degraded / Down / Unknown / Not monitored
- stale 여부가 있으면 보조 문구

Evidence cell:

- `Connectivity probe`, `Configuration only`, `No runtime evidence` 등 짧은 첫 줄
- 마지막 probe/verification 또는 `Not checked automatically`
- 같은 설명을 세 줄 이상 반복하지 않는다.

Action cell:

- 현재 가장 중요한 primary action 하나
- 1440px 초기 화면에서 전체 label이 보여야 함

### 상세 disclosure

다음은 기본 열에서 제거하고 row disclosure 또는 작은 detail 영역으로 이동한다.

- Owner team
- exact timestamps
- latency
- failureSince
- verification method 상세
- runbook/관련 workspace 보조 링크
- 긴 impact 설명

구현 규칙:

- native `<details>` 또는 기존 접근 가능한 disclosure primitive를 우선한다.
- 새 범용 component framework를 만들지 않는다.
- keyboard로 열고 닫을 수 있어야 한다.
- 접근 가능한 이름과 focus ring을 유지한다.
- primary Action을 disclosure 안에 숨기지 않는다.

### CSS 요구사항

현재 다음 고정 최소폭 구조를 제거하거나 Setup 새 구조에 맞게 축소한다.

```css
.setup-health-table { min-width: 1260px; }
.setup-runtime-table ... 7개 열별 min-width
```

완료 조건:

- 1440×1000에서 `table.scrollWidth <= wrapper.clientWidth`
- Action header/cell right edge가 wrapper right edge 안에 있음
- Service 이름이 `FCM / push / service`처럼 잘게 분리되지 않음
- Not monitored row 높이가 불필요하게 약 199px가 되지 않음
- 한 화면에서 최소 5개 서비스 상태를 비교 가능
- 문서 세로 스크롤은 하나
- overflow hidden으로 문제를 감추지 않음
- 1600×1000 light/dark에서도 안정적

1024px 이하 breakpoint는 수정 목표나 완료 조건으로 사용하지 않는다.

## Phase 4 — 상태별 운영 문구 수정

### Not monitored

현재 조합:

```text
Configuration ready
Not monitored
No configuration action required.
View evidence
```

설정 조치가 없다는 사실은 맞지만 운영 검증 행동을 설명하지 못한다.

권장 의미:

```text
Runtime verification is not automated.
No runtime evidence yet.
Review recent operational evidence.
```

각 서비스에 실제 가능한 행동을 연결한다. 자동 SMS·Push·OTP·결제 probe를 만들지 않는다. 최근 실제 delivery/event 또는 수동 verification 기록이 없으면 없는 사실을 정직하게 표시한다.

### DEGRADED

현재 `externalServiceNeedsAction()`은 DEGRADED를 포함하지만 `safeOperatorAction`은 DOWN만 runtime action으로 처리한다.

수정 요구사항:

- DOWN과 DEGRADED 모두 runtime action 사용
- DEGRADED에 `No configuration action required` 금지
- UI label은 `Review runtime impact` 또는 capability별 동사 사용
- API와 Admin fixture test 추가

### Impact

모든 DOWN 서비스에 Supabase 데이터 영향 문구를 공통 사용하지 않는다.

- capability/category별 impact metadata 사용
- 확인되지 않은 영향은 `Impact not yet confirmed`
- 추정 사용자 수나 피해 건수 생성 금지
- provider raw error는 기술 상세에도 그대로 노출하지 않음

## Phase 5 — evidence, related workspace, runbook 분리

현재 `escalationRoute` 하나를 UI가 모두 `View evidence`라고 부른다.

API contract를 의미별로 분리한다.

```ts
evidenceHref: string | null;
relatedWorkspaceHref: string | null;
runbookHref: string | null;
```

호환성을 위해 기존 `escalationRoute`를 잠시 유지해야 하면 deprecated compatibility field로 두되 Admin은 새 의미를 사용한다.

표시 규칙:

- 실제 evidence filter/section → `View evidence`
- 넓은 관련 업무 화면 → `Open related workspace`
- 실제 운영 문서 → `Open runbook`
- 아무 것도 없으면 가짜 CTA를 만들지 않음

각 서비스의 실제 route를 조사한다.

- FCM `/notifications`: delivery evidence query/hash가 있을 때만 evidence
- Storage `/partners`: storage evidence와 직접 연결되지 않으면 link 제거 또는 related workspace로만 표시
- Maps `/vietnam-overview`: provider 상태 section이 아니면 related workspace
- SMS/Auth `/app-sessions`: 실제 filter가 없으면 related workspace
- Supabase core `/app-sessions`: database probe evidence가 아니면 related workspace 또는 runbook
- Payment/Referral deferred: 현재 scope와 정확한 filtered view가 있을 때만 연결

존재하지 않는 route, filter, hash를 만들지 않는다. 새 deep-link를 만들면 대상 화면도 실제 해당 상태로 열리고 테스트되어야 한다.

## Phase 6 — 명칭과 1인 운영 구조 정리

명칭을 다음과 같이 통일한다.

- Sidebar/local group: `System Health`
- 현재 page/local nav/breadcrumb: `External Services`
- 형제: `App Sessions`, `Background Jobs`
- 내부 mode: `Runtime health`, `Launch readiness`

`Setup Readiness`라는 workspace label과 breadcrumb를 제거한다. route `/setup`은 유지한다.

초기 1인 운영에서는 가상의 팀명보다 다음을 우선한다.

- 상태 근거
- 마지막 검증 시각
- 검증 방법
- 현재 영향
- 안전한 다음 행동

Owner metadata는 향후 조직 확장을 위해 API에 유지할 수 있지만 기본 5열 표에서는 제거한다.

## Phase 7 — Refresh 경험

현재 Refresh는 같은 URL의 link이며 navigation 동안 route-level `loading.tsx`가 기존 context 전체를 교체한다.

요구사항:

1. 현재 mode/view URL을 보존한다.
2. 기존 상태를 가능하면 유지하면서 Refresh control에 pending 상태를 표시한다.
3. 처리 중 중복 요청을 막는다.
4. 완료 시 `Service status refreshed` 같은 하나의 접근 가능한 status 문장을 제공한다.
5. 실패 시 기존 성공 데이터를 Healthy로 재해석하지 않고 오류와 Retry를 표시한다.
6. API cache가 최대 5초라면 필요한 범위에서 설명한다.
7. 자동 polling이나 새로운 client data framework를 추가하지 않는다.
8. Next.js 16 App Router의 Server Component data fetching과 기존 `loading.tsx`를 보존한다.

기존 프로젝트의 유사한 refresh/pending pattern을 먼저 검색한다. 가장 작은 구현을 재사용한다. 초기 페이지 진입 loading은 `loading.tsx`를 유지할 수 있지만 수동 Refresh에서 불필요하게 전체 context가 사라지는 현상은 줄인다.

## Phase 8 — 문서 인증 계약 수정

`docs/architecture/health-readiness.md`를 controller와 일치시킨다.

- `/api/health`: public
- `/api/health/ready`: 실제 controller 기준으로 public 여부 정확히 기록
- `/api/health/external`: `JwtAuthGuard + RolesGuard + ADMIN` 필요
- 인증 없는 `Invoke-RestMethod /api/health/external` 예시 제거
- 인증된 운영 방식 또는 Admin `/setup` 사용 방법으로 교체
- 단일 launch manifest와 legacy compatibility 정책 기록

문서를 맞추기 위해 실제 guard를 제거하거나 약화하지 않는다.

## Runtime history 처리 원칙

현재 runtime history가 process memory에만 있다면 재시작 후 사라질 수 있다.

- 기존 audit log/metrics/event 저장소를 먼저 조사한다.
- 재사용 가능한 저장소가 없으면 새 DB schema를 성급히 만들지 않는다.
- UI에서 장기 이력처럼 과장하지 않는다.
- 필요하면 `Since this API process started`로 범위를 표시한다.
- 영속화는 별도 비차단 후속 작업으로 기록할 수 있다.

## 필수 테스트

### API

1. 단일 manifest에서 legacy/operator scope가 동일하게 파생된다.
2. Cash-only deferred 3개가 blocker가 아니다.
3. required + incomplete만 launch configuration blocker다.
4. config-only service는 runtime `NOT_MONITORED`다.
5. `unknown`은 `UNKNOWN`만 센다.
6. `notMonitored`는 `NOT_MONITORED`만 센다.
7. `evidenceGaps`가 enabled/required evidence 부족 조건과 일치한다.
8. DOWN과 DEGRADED 모두 Needs action이다.
9. DEGRADED가 runtime action을 가진다.
10. capability별 impact가 올바르다.
11. evidence/related/runbook link 의미가 구분된다.
12. secret/raw error가 response에 없다.
13. Admin guard가 유지된다.
14. legacy consumer compatibility가 유지된다.

### Admin model

1. 기본 query는 runtime/active다.
2. `evidence-gaps` query가 parse·filter·round-trip된다.
3. invalid query의 canonical URL과 visible state가 일치한다.
4. Evidence gaps count와 목록이 정확하다.
5. Unknown/Not monitored가 분리된다.
6. active에는 enabled non-deferred 서비스만 표시된다.
7. needs-action과 evidence-gaps를 섞지 않는다.
8. deferred를 active에 섞지 않는다.

### Admin component

1. Runtime header는 최대 5개의 핵심 열을 가진다.
2. Owner가 기본 열에 없다.
3. Not monitored 행에 verification action이 표시된다.
4. DEGRADED 행에 runtime action이 표시된다.
5. 실제 evidence만 `View evidence`다.
6. 넓은 route는 `Open related workspace`다.
7. disclosure가 keyboard와 ARIA를 지원한다.
8. status count가 색상만으로 전달되지 않는다.
9. Refresh pending/success/error가 accessible status로 전달된다.
10. API error가 0건이나 Healthy로 보이지 않는다.
11. long English/CJK/Vietnamese copy가 Service와 Action을 밀어내지 않는다.

문구 전체 문자열을 brittle하게 비교하기보다 상태, count, link destination, accessible role과 실제 의미를 검증한다.

## 검증 명령

실제 package scripts를 먼저 확인하고 다음과 동등한 검증을 실행한다.

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- app/setup
npm.cmd run test --workspace @massage-vn/api -- src/health/health.controller.spec.ts src/health/health.service.spec.ts
npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run typecheck --workspace @massage-vn/api
npm.cmd run admin:visible-copy
npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api
```

UI 변경 후 사용 가능하면 Impeccable detector를 한 번 실행한다.

```powershell
node C:\Users\laboy\.codex\skills\impeccable\scripts\detect.mjs --json <changed-ui-targets>
```

실제 결함만 한 번의 bounded pass에서 수정한다.

protected area, shared contracts, auth, Prisma, migration을 변경했다면 `AGENTS.md`에 따라 필요한 추가 검증과 다음을 수행한다.

```powershell
npm.cmd run verify:local
```

실행하지 않은 검증을 PASS라고 기록하지 않는다. unrelated failure가 있으면 명령, 오류, 이번 변경과의 관계를 기록한다.

## Production build와 실행 server 일치성 검증

이번 작업의 핵심 완료 조건이다.

running `next start`와 동일한 `.next` directory에 `next typegen` 또는 `next build`를 덮어쓰지 않는다.

권장 안전 순서:

1. 구현과 집중 테스트 완료
2. 현재 local status 기록
3. repo 제공 script로 local services를 안전하게 중지
4. Admin/API typecheck
5. Admin production build
6. repo 제공 script로 production local services 시작
7. API/Admin HTTP 200 확인
8. process start time이 build time 이후인지 확인
9. 로그인된 브라우저에서 신규 marker 확인

사용 가능한 repo scripts를 먼저 확인한다. 현재 알려진 예시는 다음과 같다.

```powershell
npm.cmd run local:stop
npm.cmd run build --workspace @massage-vn/admin-web
npm.cmd run local:start:prod
npm.cmd run local:status
```

프로세스 이름을 추측해 광범위하게 종료하지 않는다. 사용자에게 필요한 browser tab은 최종 검수 후 active URL로 남긴다.

## 필수 source marker 검증

구현 후 다음 검색이 실제 결과를 반환해야 한다.

```powershell
rg -n "evidence-gaps|evidenceGaps|notMonitored|evidenceHref|relatedWorkspaceHref" `
  apps/admin_web/app/setup apps/admin_web/lib/admin-api.ts apps/api/src/health
```

다음 old pattern은 authoritative logic에서 제거되거나 compatibility wrapper로만 남아야 한다.

```powershell
rg -n "Unknown or not monitored|isDeferredExternalCategory|View evidence" `
  apps/admin_web/app/setup apps/api/src/health
```

검색 결과를 구현 보고서에 요약한다. 문자열 marker만 추가하고 실제 동작을 만들지 않는 편법은 금지한다.

## 필수 브라우저 QA

로그인된 in-app browser에서 실제 production build를 확인한다. 가능하면 `product-design:audit`, browser control, `ui-ux-pro-max` 기준을 사용한다.

검사 viewport:

```text
1440×1000 필수
1600×1000 필수
1024px 이하 완전 제외
```

반드시 캡처할 상태:

```text
01-runtime-active-1440x1000.png
02-runtime-evidence-gaps-1440x1000.png
03-runtime-needs-action-empty-1440x1000.png
04-runtime-degraded-fixture-1440x1000.png
05-runtime-row-details-1440x1000.png
06-runtime-refresh-pending.png
07-runtime-refresh-complete.png
08-runtime-error-fixture.png
09-runtime-active-dark-1600x1000.png
10-runtime-active-light-1600x1000.png
```

실제 외부 장애나 로그아웃을 발생시키지 않는다. DEGRADED와 오류는 격리된 fixture로 검증하고 운영 응답처럼 보고하지 않는다.

### 브라우저 기능 확인

- URL, active saved view, `aria-current`가 일치
- Evidence gaps view가 감사 기준 데이터에서 5개 표시
- invalid query가 canonical URL로 복구
- 1440px에서 Service와 Action이 동시에 보임
- table `scrollWidth <= clientWidth`
- Action button 전체 label이 보임
- 한 화면에서 최소 5개 row 비교 가능
- keyboard로 mode, saved view, disclosure, primary action 사용 가능
- focus ring이 보임
- Refresh 중 context와 focus가 불필요하게 사라지지 않음
- 성공/오류 상태가 전달됨
- dark theme에서 muted copy와 status badge를 읽을 수 있음
- browser console/runtime error 없음

화면 캡처만 하고 폭을 추측하지 말고 실제 DOM 수치를 기록한다.

## 구현 완료 게이트

다음 네 단계가 모두 통과해야 완료다.

### Gate A — Source

```text
[ ] 올바른 repository에서 작업했다.
[ ] 관련 source diff가 실제 존재한다.
[ ] evidence-gaps 관련 marker가 구현 파일에 존재한다.
[ ] legacy/new policy가 한 소스를 사용한다.
[ ] 사용자 unrelated diff를 보존했다.
```

### Gate B — Tests/build

```text
[ ] Admin Setup 집중 테스트 PASS
[ ] API Health 집중 테스트 PASS
[ ] Admin/API typecheck PASS
[ ] Admin visible-copy PASS
[ ] Admin/API scope verification PASS
[ ] Admin production build PASS
[ ] 필요한 경우 verify:local PASS
```

### Gate C — Running server

```text
[ ] Admin process start time이 최신 build 이후다.
[ ] API/Admin HTTP status 200이다.
[ ] 실행 화면에 Evidence gaps marker가 보인다.
[ ] 실행 화면 명칭이 External Services로 통일됐다.
[ ] source와 runtime computed layout이 일치한다.
```

### Gate D — Operator UX

```text
[ ] Evidence gaps view가 실제 동작한다.
[ ] Unknown과 Not monitored가 분리됐다.
[ ] 1440px에 수평 스크롤이 없다.
[ ] Service와 Action을 동시에 볼 수 있다.
[ ] evidence/related/runbook이 구분된다.
[ ] Not monitored에 검증 행동이 있다.
[ ] DEGRADED에 runtime 행동이 있다.
[ ] Refresh feedback이 있다.
[ ] 1600px light/dark가 안정적이다.
[ ] 1024px 이하를 검사·보고하지 않았다.
```

Gate 하나라도 실패하면 전체 완료라고 보고하지 않는다. 정확한 실패 원인과 재현 명령을 기록하고 `Release hold`로 표시한다.

## 산출물

기존 감사 보고서와 증거를 덮어쓰지 않고 다음을 새로 만든다.

```text
docs/audits/setup-runtime-active-remediation-report-2026-08-14.md
docs/audits/setup-runtime-active-remediation-evidence-2026-08-14/
```

구현 보고서에는 다음을 포함한다.

1. 최종 verdict와 P1 remaining 수
2. 올바른 worktree 확인 결과
3. 변경 전후 source marker
4. source/build/process timestamp 비교
5. launch policy 단일화 전후 계약
6. Unknown/Not monitored/Evidence gap 판정표
7. 서비스별 action link 의미와 목적지
8. Runtime 5열 구조와 disclosure 정보
9. 1440px 전후 table width와 row height
10. 변경 파일과 목적
11. 실제 검증 명령과 PASS/FAIL/SKIPPED
12. protected area 변경 여부
13. 외부 mutation 없음 확인
14. 브라우저 화면 증거
15. 접근성 확인 범위와 미확인 범위
16. 남은 출시 차단/비차단 위험

## 권장 실행 순서

1. 저장소·dirty diff·source/build/process baseline 확인
2. API와 legacy 소비자 전체 검색
3. 기존 집중 테스트 baseline
4. launch capability policy 단일화
5. count와 Evidence gaps 계약 구현
6. DEGRADED, impact, link metadata 수정
7. Admin query/view/model 테스트
8. Runtime 5열 표와 disclosure 구현
9. naming, summary, Refresh, 문서 수정
10. focused tests와 static checks
11. local services 안전 중지
12. typecheck와 production build
13. production local services 재시작
14. source/build/process marker 확인
15. 1440/1600 실제 브라우저 QA
16. scope/full verification과 구현 보고서 작성

API만 바꾸고 화면을 남기지 않는다. 화면 문자열만 바꾸고 상태 계약을 남기지도 않는다. 코드는 바꿨지만 실행 server를 재시작하지 않은 상태도 완료가 아니다.

## 중단 조건

다음 경우에만 현재 증거와 선택지를 정리해 사용자 확인을 요청한다.

- authoritative launch policy가 실제 결제 노출을 바꿀 정도로 충돌할 때
- shared/production DB schema 변경이 반드시 필요할 때
- 실제 provider credential 또는 gateway flag 변경이 필요할 때
- side-effectful external probe가 반드시 필요하다고 판단될 때
- 동일 파일의 사용자 미커밋 변경과 안전하게 병합할 수 없을 때
- local services 중지가 다른 사용자 작업을 실제로 중단시키는 것이 확인될 때

그 외에는 합리적인 가정을 기록하고 구현·검증·재시작·브라우저 QA까지 계속한다.

## 최종 응답 형식

결과부터 보고한다.

```text
Verdict: Release ready | Release hold
P1 remaining: 0 | N

Outcome
- 운영자에게 실제로 달라진 점

Source/build/runtime proof
- repository
- source marker
- build time
- process start time
- browser marker

Changed files
- 파일과 변경 목적

Verification
- 명령: PASS/FAIL/SKIPPED
- 1440/1600 실제 수치와 화면 증거

Protected areas
- 변경 여부와 추가 검증

External mutations
- none 또는 정확한 목록

Remaining risks
- 출시 차단/비차단 구분

Next action
- 가장 중요한 한 가지
```

실행하지 않은 테스트를 PASS라고 쓰지 않는다. 이전 테스트 숫자를 새 실행 결과처럼 복사하지 않는다. 브라우저에서 신규 marker를 확인하지 못하면 완료가 아니다.

## Codex 최종 실행 지시

지금 바로 실제 구현을 시작하라.

- 추가 프롬프트나 분석 보고서만 작성하고 멈추지 않는다.
- 반드시 `C:\dev\massage-on-demand-vn`에서 작업한다.
- 현재 사용자 dirty changes를 보존한다.
- launch policy와 Evidence gaps 계약부터 수정한다.
- Runtime 표를 5열 운영 구조로 만든다.
- 관련 테스트를 추가하고 실제 실행한다.
- production build 후 실행 Admin process를 최신 build로 재시작한다.
- 1440×1000과 1600×1000에서 직접 검수한다.
- source marker, build time, process time, browser marker를 구현 보고서에 남긴다.
- 실제 외부 mutation과 secret 변경만 보류하고 나머지는 끝까지 완료한다.

최종 목표는 표를 예쁘게 줄이는 것이 아니다. 혼자 운영하는 사용자가 **장애, 검증 공백, 정상, 의도적 보류를 혼동하지 않고 서비스와 다음 행동을 한 화면에서 동시에 확인할 수 있는 Runtime health 운영 도구**를 만드는 것이다.
