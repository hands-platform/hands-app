# Codex 실행 프롬프트 — Setup Readiness 상태 신뢰성·운영 UX 개선

아래 내용을 새 Codex 작업에 그대로 붙여 넣어 사용한다.

---

## 역할

너는 `C:\dev\massage-on-demand-vn` 프로젝트의 시니어 제품 엔지니어이자 운영 관측성, 외부 서비스 통합, 관리자 UX 전문가다.

이번 작업의 목적은 `/setup` 화면을 단순히 보기 좋게 꾸미는 것이 아니다. 1인 운영자가 다음 질문에 정확히 답할 수 있도록 API 상태 의미, 출시 범위 정책, 오류 처리, 정보 구조, 화면 문구와 테스트를 함께 개선해야 한다.

1. 지금 실제로 장애가 발생한 서비스가 있는가?
2. 단지 설정만 준비된 것인지, 실제 기능 검사까지 성공한 것인지?
3. 현금 결제 우선 출시에서 지금 반드시 해결해야 하는 차단 항목은 무엇인가?
4. 의도적으로 꺼 둔 기능과 고장 난 기능을 어떻게 구분하는가?
5. 상태 판단의 증거와 검사 시각은 무엇인가?
6. 문제가 있으면 어디에서 어떤 조치를 해야 하는가?
7. 상태 API 자체가 실패했을 때 빈 화면이나 정상 상태로 오인되지 않는가?

시각적 장식보다 **상태 의미의 정확성, false-positive 경보 제거, 안전한 probe, 오류 시 정직한 표현, 운영 행동 연결**을 우선한다.

## 작업 위치와 기준 문서

- 저장소: `C:\dev\massage-on-demand-vn`
- 대상 화면: `http://localhost:3101/setup`
- 기준 감사 보고서:
  - `C:\dev\massage-on-demand-vn\docs\audits\setup-final-reaudit-2026-08-11.md`
- 감사 화면 증거:
  - `C:\dev\massage-on-demand-vn\docs\audits\setup-reaudit-evidence-2026-08-11\`
- 저장소 지침:
  - `C:\dev\massage-on-demand-vn\AGENTS.md`
- 관련 정책 문서:
  - `C:\dev\massage-on-demand-vn\docs\architecture\payments.md`
  - `C:\dev\massage-on-demand-vn\docs\architecture\external-setup-checklist.md`

작업을 시작하면 위 문서를 먼저 끝까지 읽는다. 보고서는 감사 시점의 근거이므로 현재 코드와 실제 실행 화면을 다시 확인한 뒤 수정한다. 이미 해결된 항목을 중복 구현하거나 보고서 문장을 기계적으로 UI에 옮기지 않는다.

## 최종 목표

`/setup`을 다음 두 목적이 명확히 분리된 하나의 운영 페이지로 만든다.

1. `Runtime health`
   - 활성 서비스의 실제 현재 상태
   - 검사 증거, 마지막 성공, 장애 지속 시간, 영향, 안전한 조치
2. `Launch readiness`
   - 현재 출시 프로필에서 필요한 설정의 준비 상태
   - 현재 차단 항목과 나중에 준비할 Deferred 항목의 분리

새로운 사이드바 페이지를 추가하지 않는다. `/setup` route 안에서 두 탭 또는 동일한 수준의 내부 saved view로 표현한다. `App Session Diagnostics`와 `Background Jobs`는 별도 페이지로 유지한다.

## 절대 지켜야 할 상태 원칙

다음 원칙은 구현 편의를 이유로 완화하지 않는다.

1. 환경 변수나 자격 증명이 존재한다고 `Healthy` 또는 `Operational`로 표시하지 않는다.
2. 실제 probe가 없다면 runtime 상태는 `NOT_MONITORED` 또는 `UNKNOWN`이다.
3. `Healthy`는 부작용 없는 연결 또는 기능 검사가 최근 성공한 경우에만 사용한다.
4. 현재 출시 범위가 아닌 기능은 빨간 장애나 launch blocker로 집계하지 않는다.
5. 현금 결제 우선 출시에서 MoMo/VNPay disabled는 `Deferred — intentionally disabled`다.
6. 경보를 없애기 위해 MoMo/VNPay enable flag를 켜거나 credentials를 임의 생성·수정하지 않는다.
7. OTP 전송, Push 전송, 결제 생성, 환불, 실제 파일 업로드처럼 외부 효과가 있는 probe를 자동 refresh에서 실행하지 않는다.
8. 안전한 probe를 구현할 수 없다면 가짜 성공 대신 `Not monitored`와 검사 수준을 보여준다.
9. 응답 생성 시각을 서비스별 실제 검사 시각처럼 표시하지 않는다.
10. API 실패를 빈 데이터, 0건, 정상 상태로 표현하지 않는다.
11. secret, token, private key, 전체 환경 변수 값, 민감한 내부 명령을 화면·로그·감사 증거에 노출하지 않는다.

## 대상 범위

주요 대상은 다음 파일이다. 실제 의존 관계를 검색한 후 필요한 관련 파일만 추가한다.

- `apps/admin_web/app/setup/page.tsx`
- `apps/admin_web/app/setup/setup-overview-section.tsx`
- `apps/admin_web/app/setup/setup-page-model.ts`
- `apps/admin_web/app/setup/**/*.spec.*`
- `apps/admin_web/lib/admin-api.ts`
- `apps/admin_web/lib/admin-navigation.ts`
- `apps/admin_web/lib/admin-operator-permissions.ts`
- `apps/admin_web/lib/admin-operator-access-model.ts`
- `apps/admin_web/app/globals.css`
- `apps/api/src/health/health.controller.ts`
- `apps/api/src/health/health.service.ts`
- `apps/api/src/health/**/*.spec.*`
- 필요한 경우 관리자 API의 공용 DTO 또는 `packages/shared-types`
- 관련 운영·아키텍처 문서

`packages/shared-types`, `.env*`, auth, payments 등은 `AGENTS.md`의 protected area일 수 있다. 변경 시 해당 scope 검증과 full local verification 요구를 따른다. 결제 구현 자체는 이번 작업의 범위가 아니다. 이번 작업에서 결제 플래그나 실제 결제 동작을 변경하지 않는다.

## 화면 범위

- **1440px 이상 데스크톱만 구현하고 검증한다.**
- 필수 viewport: `1440×1000`, `1600×1000`.
- 필요하면 `1920×1080`을 추가한다.
- 1024px 이하, 모바일, 태블릿, responsive reflow는 이번 작업에서 완전히 제외한다.
- 1024px 이하 문제를 구현 보고서, 잔여 이슈, 스크린샷 목록에 넣지 않는다.
- 기존 작은 화면 CSS를 고의로 훼손하지는 않되 이번 작업의 시간과 완료 기준으로 사용하지 않는다.

## 작업 안전 원칙

1. 현재 dirty worktree의 기존 변경은 사용자 작업이다. 관련 없는 변경을 되돌리거나 덮어쓰지 않는다.
2. `git reset --hard`, 광범위 checkout, 무관한 파일 삭제를 금지한다.
3. 실제 외부 공급사에 결제·OTP·Push·SMS·환불·운영 데이터 변경을 발생시키지 않는다.
4. 운영/공유 데이터에 테스트 row나 synthetic transaction을 만들지 않는다.
5. 새로운 UI 라이브러리, 관측성 플랫폼, workflow framework를 추가하지 않는다.
6. 기존 관리자 디자인 토큰, 테이블, 배지, 탭, notice, button primitive를 재사용한다.
7. CSS로 행을 숨기거나 `overflow: hidden`으로 문제를 감추지 않는다.
8. 프론트에서 문자열을 재해석해 상태를 꾸미지 말고 서버가 명시적인 상태 계약을 제공하게 한다.
9. API 호환성이 필요한 호출자가 있으면 먼저 검색하고 additive migration 또는 compatibility layer를 사용한다.
10. 작업량이 크다는 이유로 UI 문구만 바꾸고 P0 데이터 의미를 남겨 두지 않는다.

## 현재 확인된 기준선

구현 직전에 현재 코드와 실제 화면을 다시 확인한다. 감사 당시 기준선은 다음과 같다.

- 화면은 9개 서비스를 한 표에 표시한다.
- 상단에 `3 blocked`가 표시된다.
- Referral app links, MoMo payments, VNPay payments가 Blocked다.
- 나머지 6개는 `Operational`이다.
- 프론트는 API `READY`를 `Operational`로 변환한다.
- API의 `externalGroup()`은 주로 환경 변수의 존재·형식·예상 값을 검사한다.
- API에는 이미 `currentStageOk`, `productionE2EOk`, `blockingCategories`, `deferredCategories`, `scope`, `deferred`, `operatorAction`, `commands`가 있다.
- 프론트는 이 중 중요한 scope/deferred 정보와 상세 증거를 대부분 버린다.
- 모든 행의 `Last checked`는 서비스별 probe가 아니라 응답 timestamp에서 만들어진다.
- `/health/ready`는 DB `SELECT 1`과 Redis ping 등 실제 readiness를 일부 확인한다.
- `/health/external`은 관리자 JWT/role guard가 적용되어 있다.
- 1440×1000에서 문서와 setup card에 중첩 세로 스크롤이 발생한다.
- 감사 당시 Admin setup 테스트 49개, API health 테스트 20개가 통과했다.
- 이 수치는 하드코딩하지 말고 전후 회귀 확인에만 사용한다.

## P0-A — 상태 모델을 두 축으로 분리

### 1. Configuration 상태

허용 값:

```text
CONFIGURED
INCOMPLETE
DISABLED
DEFERRED
UNKNOWN
```

의미:

- `CONFIGURED`: 필요한 설정의 존재·형식이 확인됨
- `INCOMPLETE`: 현재 필요한 설정이 누락되거나 잘못됨
- `DISABLED`: 기능 플래그로 명시적으로 꺼짐
- `DEFERRED`: 현재 출시 범위 밖이며 의도적으로 보류됨
- `UNKNOWN`: 설정 상태 API 자체를 신뢰할 수 없음

### 2. Runtime 상태

허용 값:

```text
HEALTHY
DEGRADED
DOWN
UNKNOWN
NOT_MONITORED
```

의미:

- `HEALTHY`: 최근 안전한 probe가 성공함
- `DEGRADED`: 기능은 일부 가능하지만 오류율·지연·부분 실패가 기준을 넘음
- `DOWN`: 최근 안전한 probe가 실패했고 서비스 사용이 불가함
- `UNKNOWN`: probe 결과가 stale하거나 상태 조회 실패
- `NOT_MONITORED`: configuration check만 있고 runtime probe가 없음

### 금지 변환

다음 변환을 코드와 테스트에서 제거한다.

```text
READY -> Operational
configured env -> Healthy
response timestamp -> per-service last checked
disabled gateway -> Blocked
deferred setup -> current launch blocker
```

### 권장 typed contract

현재 contract와 호출자를 조사해 이름을 조정할 수 있지만 의미는 보존한다.

```ts
type ExternalServiceStatus = {
  id: string;
  name: string;
  category:
    | 'auth'
    | 'maps'
    | 'payments'
    | 'storage'
    | 'messaging'
    | 'referrals';
  enabled: boolean;
  requiredForCurrentLaunch: boolean;
  configurationStatus:
    | 'CONFIGURED'
    | 'INCOMPLETE'
    | 'DISABLED'
    | 'DEFERRED'
    | 'UNKNOWN';
  runtimeStatus:
    | 'HEALTHY'
    | 'DEGRADED'
    | 'DOWN'
    | 'UNKNOWN'
    | 'NOT_MONITORED';
  probeType: 'CONFIG' | 'CONNECTIVITY' | 'FUNCTIONAL_E2E' | 'NONE';
  lastProbeAt: string | null;
  lastSuccessAt: string | null;
  failureSince: string | null;
  latencyMs: number | null;
  isStale: boolean;
  impactSummary: string | null;
  ownerTeam: string;
  escalationRoute: string | null;
  runbookUrl: string | null;
  safeOperatorAction: string | null;
};

type ExternalServicesOverview = {
  launchProfile: 'CASH_ONLY' | 'ONLINE_PAYMENTS';
  currentStageOk: boolean;
  generatedAt: string;
  counts: {
    launchBlockers: number;
    degraded: number;
    unknown: number;
    deferred: number;
  };
  services: ExternalServiceStatus[];
};
```

기존 `AdminExternalReadiness`를 바로 깨지 말고 모든 호출자를 검색한다. 외부 소비자가 있으면 additive field를 우선하고 deprecated field 제거는 별도 단계로 둔다.

## P0-B — 현재 출시 범위와 Cash-only 정책

현재 제품 정책은 현금 결제 우선 출시다. 다음 판정표를 서버의 단일 정책 함수 또는 capability manifest에서 관리한다.

| 출시 프로필 | 게이트웨이 상태 | Configuration | Launch blocker |
|---|---|---|---|
| CASH_ONLY | disabled | DEFERRED | 아니오 |
| CASH_ONLY | enabled + invalid | INCOMPLETE 또는 경고 | 정책 위반 경고, 현재 현금 흐름 장애는 아님 |
| ONLINE_PAYMENTS | disabled | INCOMPLETE | 예 |
| ONLINE_PAYMENTS | configured, runtime unprobed | CONFIGURED | 준비 수준에 따라 예/경고 |
| ONLINE_PAYMENTS | functional probe success | CONFIGURED | 아니오 |

구현 규칙:

1. 기존 코드나 문서에 authoritative launch profile source가 있는지 먼저 검색한다.
2. 없다면 최소한의 중앙 policy module을 만든다. 프론트와 서비스별 분기문에 정책을 복제하지 않는다.
3. 새 환경 변수를 추가해야 한다면 `.env.example`과 운영 문서를 갱신하되 실제 `.env` 값이나 secret을 수정하지 않는다.
4. 기본 정책을 임의로 온라인 결제로 바꾸지 않는다.
5. Referral처럼 현재 출시 범위가 아닌 항목도 Deferred로 처리한다.
6. 상단 빨간 수는 `requiredForCurrentLaunch && configurationStatus === INCOMPLETE` 또는 실제 활성 서비스 `DOWN`처럼 현재 행동이 필요한 항목만 포함한다.
7. Deferred는 건수는 보여주되 빨간색과 `blocked`라는 단어를 사용하지 않는다.

## P0-C — 안전한 runtime evidence

### probe 분류

각 서비스가 실제로 무엇을 검사하는지 명시한다.

| 서비스 | 허용되는 기본 판정 | 자동 probe 원칙 |
|---|---|---|
| Supabase core | DB/connectivity가 실제 성공하면 Healthy 가능 | 기존 `/health/ready` 또는 동일한 bounded check 재사용 |
| Supabase Phone Auth | Configuration ready + Runtime not monitored | 실제 OTP/SMS 전송을 자동 실행하지 않음 |
| Maps/geocoding | config-only이면 Not monitored | 공급사가 제공하는 무과금·비파괴 endpoint가 확인된 경우에만 bounded probe |
| Referral links | Deferred 또는 deterministic validation | 외부 클릭/설치 이벤트를 생성하지 않음 |
| MoMo/VNPay | Cash-only에서 Deferred | 실제 결제·callback·transaction을 자동 생성하지 않음 |
| Storage/CDN | config-only이면 Not monitored | 격리된 health object가 이미 있는 경우 read-only probe만 허용 |
| Production SMS | Configuration ready + Runtime not monitored | 실제 SMS 전송 금지 |
| FCM push | Configuration ready + Runtime not monitored | 실제 push 전송 금지 |

### 구현 규칙

1. 기존 `/health/ready`의 DB/Redis 결과를 중복 구현하지 않는다.
2. probe timeout과 cache를 둔다. 현재 5초 cache가 적합한지 실제 비용과 operator refresh 빈도를 기준으로 조정한다.
3. 외부 공급사 rate limit과 장애 전파를 막는다.
4. 한 probe 실패 때문에 전체 endpoint가 500이 되지 않게 하되, 부분 실패를 정상으로 숨기지 않는다.
5. 오류 메시지는 secret과 provider raw response를 정제한다.
6. 자동 probe를 추가하지 못한 서비스는 `NOT_MONITORED`로 완료할 수 있다. 이는 미완료가 아니라 정직한 상태다.
7. `lastProbeAt`, `lastSuccessAt`, `failureSince`는 실제 근거가 있을 때만 채운다.
8. 영구 장애 이력을 위해 새 DB 테이블을 만들기 전에 현재 관측성 저장소와 요구를 조사한다. 첫 단계에서 불필요한 incident platform을 만들지 않는다.

## P0-D — API 실패와 stale 상태

`apps/admin_web/app/setup/page.tsx`에서 상태 코드를 버리는 `adminGet` + generic fallback 사용을 제거한다.

1. `adminGetResult` 또는 동등한 typed result를 사용한다.
2. 다음 상태를 구분한다.

```text
Loading
Loaded
Actual empty if contract permits
401 Authentication expired
403 Permission denied
429 Rate limited
5xx Status service unavailable
Timeout / network failure
Stale last-known data
Partial probe failure
```

3. 401에는 다시 로그인 행동을 제공한다.
4. 403에는 필요한 권한과 접근 요청 방법을 설명한다.
5. 5xx/network에는 Retry와 안전한 request ID를 제공한다.
6. last-known snapshot을 실제로 보유하고 있을 때만 stale data를 보여준다. 없는 데이터를 가짜로 캐시하지 않는다.
7. epoch timestamp, 빈 checks, 0 counts를 실패 fallback으로 사용하지 않는다.
8. 성공한 일부 서비스와 실패한 일부 서비스를 구분하고 전체가 정상처럼 보이지 않게 한다.

## P1-A — 페이지 정보 구조와 문구

route는 `/setup`을 유지한다. 기존 사이드바 구조를 대대적으로 바꾸지 않는다.

### 페이지 헤더

권장 문구:

```text
Title: External Services
Description: Active service health and launch configuration status.
Launch profile: Cash-only launch
Last refresh: {time}
Action: Refresh
```

`Setup Readiness`, `System health`, `Current external service health`가 동시에 섞이지 않게 한다.

### 상단 상태 요약

중복 KPI 카드가 아니라 작은 status strip을 사용한다.

```text
Needs action {N}
Degraded {N}
Unknown {N}
Deferred {N}
```

- `Needs action`은 현재 출시 범위에서 실제 조치가 필요한 항목만 포함한다.
- count 클릭 시 같은 페이지의 해당 view/filter로 이동한다.
- count가 0이면 의미 없는 큰 성공 카드를 여러 개 만들지 않는다.
- API 실패 시 0을 표시하지 않는다.

### 내부 작업공간

#### Runtime health — 기본 탭

권장 열:

```text
Service
Runtime health
Evidence
Current impact
Last success / Failure since
Owner
Action
```

- 활성 서비스가 우선이다.
- configuration-only 서비스는 중립색 `Not monitored`다.
- 기본 정렬은 Needs action → Down/Degraded → Unknown/Not monitored → Healthy → Deferred 순서다.
- Deferred는 기본 Runtime 표에서 제외하거나 마지막 그룹으로 분리한다.

#### Launch readiness

권장 열:

```text
Capability
Required now
Configuration
Validation level
Owner
Next step
```

- Current launch blockers와 Deferred를 명확히 분리한다.
- 자격 증명 값과 raw commands를 기본 화면에 노출하지 않는다.
- Deferred가 많은 경우 접힌 그룹으로 둘 수 있지만 건수와 이유는 보여준다.

### 최소 saved views

복잡한 filter builder를 새로 만들지 않는다.

```text
Needs action
Active services
Deferred
```

선택한 탭/view는 URL query에 반영하고 잘못된 query에는 안정적인 기본값을 사용한다.

## P1-B — 운영 행동과 책임 정보

현재 plain text `Next action`을 실제 운영 흐름으로 연결한다.

행마다 다음 중 가장 중요한 primary action 하나만 노출하고 나머지는 overflow menu 또는 detail disclosure에 둔다.

- `Retry check`
- `Open related notifications`
- `View background jobs`
- `View app sessions`
- `Open payment readiness`
- `Open runbook`
- `View evidence`

규칙:

1. 존재하지 않는 페이지나 가짜 링크를 만들지 않는다.
2. 기존 관리자 route와 문서를 검색해 실제 목적지에 연결한다.
3. operator action과 developer setup action을 구분한다.
4. secret 변경, env 편집, gateway enable은 일상 운영자의 직접 CTA로 만들지 않는다.
5. owner를 이메일 문자열에서 임의 추론하지 않는다.
6. `ownerTeam`, `escalationRoute`, `runbookUrl`을 구조화된 metadata로 제공한다.
7. 현재 영향이 확인되지 않으면 `No confirmed impact`라고 표시한다.
8. 영향 수를 계산할 근거가 없으면 추정 숫자를 만들지 않는다.

## P1-C — 시간·증거·staleness 표현

각 행은 다음 중 실제로 존재하는 정보만 보여준다.

```text
Probe: Configuration / Connectivity / Functional E2E / None
Last checked
Last successful
Failing since
Latency
Evidence summary
Stale
```

- configuration check만 있는 행의 문구는 `Configuration checked {time}`다.
- runtime probe가 없는 행은 `Runtime not monitored`다.
- 같은 response timestamp를 모든 서비스의 last check로 복제하지 않는다.
- 상대 시간에는 필요 시 정확한 timestamp를 accessible label 또는 tooltip로 제공한다.
- stale 기준은 서버의 단일 상수/정책에서 관리하고 테스트한다.

## P1-D — 1440px 레이아웃과 접근성

1. `.setup-health-section.admin-section`의 viewport 기반 `max-height`와 세로 `overflow-y:auto`를 제거한다.
2. 페이지 문서 하나만 세로 스크롤하게 한다.
3. 표 열 때문에 필요하면 가로 스크롤만 사용한다.
4. sticky table header가 필요하면 페이지 scroll 기준으로 적용하고 app header와 겹치지 않게 한다.
5. Tab, Shift+Tab, Enter, Space, Escape, PageDown으로 핵심 흐름을 확인한다.
6. tab과 saved view는 현재 선택 상태를 텍스트와 ARIA로 전달한다.
7. 상태는 색상만으로 구분하지 않는다.
8. Refresh 결과와 오류는 적절한 live region으로 알린다.
9. focus ring을 제거하지 않는다.
10. 긴 서비스명, 긴 owner, CJK, 베트남어 악센트, 긴 오류 요약에서 열이 깨지지 않게 한다.
11. 200% zoom과 Windows high contrast는 가능하면 확인하되 1024px 이하 responsive 보고로 변질시키지 않는다.

## P1-E — Refresh·성능·동시성

1. 자동 갱신이 현재 제품에 필요한지 먼저 확인한다. 없다면 수동 Refresh + 서버 cache로 시작한다.
2. 자동 갱신을 추가한다면 탭이 background일 때 중지하고 동일 요청을 중복 실행하지 않는다.
3. Refresh 연타 시 중복 probe를 합치거나 버튼을 진행 중 상태로 둔다.
4. 느린 한 공급사가 전체 응답을 장시간 막지 않게 bounded timeout을 사용한다.
5. initial page와 tab 전환에서 같은 endpoint를 중복 호출하지 않는다.
6. 9개 서비스 수준에서 virtualization이나 복잡한 client state framework를 도입하지 않는다.
7. 실제 성능을 측정하지 않고 index, queue, 별도 health database를 추가하지 않는다.

## P2-A — 미사용 Setup 코드 정리

감사 당시 `apps/admin_web/app/setup`에는 현재 페이지에서 import되지 않는 이전 setup wizard 컴포넌트와 관련 테스트/CSS가 많이 남아 있었다.

후보:

```text
setup-registration-handoff-section.tsx
setup-readiness-order-section.tsx
setup-progress-control-section.tsx
setup-operator-actions-section.tsx
setup-migration-runway-section.tsx
setup-group-detail-summary-link.tsx
setup-group-detail-section.tsx
setup-external-backlog-section.tsx
setup-command-groups.ts
```

정리 규칙:

1. `rg`로 production import, dynamic import, test import, 문서 참조를 구분한다.
2. 실제 소비자가 없는 파일만 제거한다.
3. 이전 기술 절차가 필요하면 `docs/runbooks`로 옮기되 secret이나 obsolete command를 복사하지 않는다.
4. `externalRegistrationPlan`에서 현재 화면이 필요한 owner/action metadata만 작은 모듈로 분리한다.
5. 런타임 성능 개선이라고 과장하지 않는다. 주 목적은 유지보수와 테스트 신뢰도다.
6. P0/P1 구현과 충돌하면 cleanup은 마지막에 한다.

## P2-B — 문구 계약

권장 용어를 일관되게 사용한다.

| 부정확한 표현 | 권장 표현 |
|---|---|
| Operational | Healthy 또는 Configuration ready; 근거에 따라 선택 |
| Blocked | Launch blocker 또는 Down; 원인에 따라 선택 |
| No operator action required | No configuration action required |
| Last checked | Configuration checked / Last probe / Last success |
| System health | Runtime health |
| Setup Readiness | External Services 또는 Launch readiness 탭 |
| Disabled 결제 | Deferred — intentionally disabled |

개발자용 `API`, `env`, `scope`, `deferred category` 같은 내부 구현 용어를 운영자 기본 문구에 그대로 노출하지 않는다. 단, 기술 상세 disclosure에서는 필요한 범위로 표시할 수 있다.

## 오류·빈 상태·부분 실패 문구

generic `Unavailable` 하나로 합치지 않는다.

권장 예시:

```text
Session expired
Sign in again to refresh service status.

Access required
Developer Setup access is required to view external service configuration.

Status check unavailable
The service status endpoint did not respond. Existing services may still be operating.
Request ID: {safeRequestId}

Runtime not monitored
Configuration is ready, but no safe runtime probe is configured.

Deferred for cash-only launch
This gateway is intentionally disabled and does not block the current launch.
```

오류가 발생했는데 `All systems operational`, `0 blocked`, 빈 표를 보여주지 않는다.

## 필수 테스트

### Admin Web 모델·컴포넌트

1. API `READY` 또는 CONFIGURED가 자동으로 `Healthy/Operational`이 되지 않는다.
2. runtime probe 없음은 `Not monitored`다.
3. Cash-only에서 MoMo/VNPay disabled는 Deferred이며 blocker count에 포함되지 않는다.
4. Referral deferred도 현재 blocker에 포함되지 않는다.
5. required + incomplete만 launch blocker가 된다.
6. 활성 서비스 runtime `DOWN`은 Needs action에 포함된다.
7. response timestamp가 per-service lastProbeAt으로 복제되지 않는다.
8. probe type과 실제 timestamp가 올바르게 표시된다.
9. 401, 403, 429, 5xx, timeout, stale, partial failure가 서로 다른 UI다.
10. 오류 상태가 0건이나 정상으로 보이지 않는다.
11. Runtime/Launch tab과 saved view query가 안정적으로 round-trip한다.
12. 잘못된 query가 기본 view로 복구된다.
13. primary CTA가 실제 route/runbook을 가리킨다.
14. long text/CJK/베트남어가 표 구조를 깨지 않는다.
15. `page.spec.tsx`가 실제 사용 함수인 `adminGetResult` 또는 현재 data loader를 정확히 mock한다.

### API·service

1. configuration status와 runtime status가 독립적이다.
2. config-only success는 runtime `NOT_MONITORED`다.
3. current launch profile이 Cash-only이면 disabled gateways는 Deferred다.
4. online payment required profile에서 disabled gateway는 blocker다.
5. safe probe success/failure/timeout이 HEALTHY/DOWN/UNKNOWN으로 정확히 매핑된다.
6. 부분 probe 실패가 전체 정상으로 숨겨지지 않는다.
7. secret/raw provider response가 DTO와 logs에 노출되지 않는다.
8. `lastProbeAt`, `lastSuccessAt`, `failureSince`가 실제 이벤트 의미와 일치한다.
9. 5초 cache 또는 변경된 cache가 stale semantics와 일치한다.
10. admin JWT/role guard 회귀가 없다.
11. 기존 `AdminExternalReadiness` 소비자가 있다면 compatibility가 유지된다.
12. OTP, SMS, Push, 결제 side effect가 probe에서 호출되지 않는다.

### 브라우저/E2E

1. 1440×1000에서 세로 스크롤 컨테이너가 문서 하나뿐이다.
2. PageDown이 문서와 카드 두 곳을 동시에 움직이지 않는다.
3. Runtime health 기본 화면이 current active service를 우선한다.
4. Launch readiness에서 blocker와 Deferred가 분리된다.
5. Refresh loading, success, error가 구분된다.
6. keyboard만으로 tabs, views, row actions, Retry를 사용할 수 있다.
7. 라이트·다크 테마에서 상태 텍스트와 구조가 유지된다.

## 검증 명령

실제 package script와 파일 존재 여부를 먼저 확인한 뒤 아래와 동등한 검증을 실행한다.

### 집중 테스트

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- app/setup
npm.cmd run test --workspace @massage-vn/api -- src/health/health.controller.spec.ts src/health/health.service.spec.ts
```

### 정적·범위 검증

```powershell
npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run typecheck --workspace @massage-vn/api
npm.cmd run admin:visible-copy
npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api
```

shared types, protected area, env template 또는 광범위 동작을 변경했다면 `AGENTS.md`에 따라 필요한 추가 검증과 다음 명령을 수행한다.

```powershell
npm.cmd run verify:local
```

명령이 환경·인증 문제로 실패하면 실패 사실, 원인, 재현 명령을 보고한다. 실행하지 않은 검증을 통과로 기록하지 않는다.

UI 변경 후 Impeccable detector를 변경 UI 파일에 한 번 실행한다.

```powershell
node C:\Users\laboy\.codex\skills\impeccable\scripts\detect.mjs --json <changed-ui-targets>
```

검출 결과를 실제 결함 기준으로 한 번의 bounded 수정 pass에서 해결하고 최종 확인한다. 반복적인 무제한 미세 조정은 하지 않는다.

## 브라우저 QA와 증거

로그인된 in-app browser를 사용해 실제 변경 화면을 확인한다. 사용자 로그인이 필요하면 로그인만 요청하고 이후 검수를 계속한다.

검증 viewport:

```text
1440x1000 필수
1600x1000 필수
1024px 이하 제외
```

캡처할 상태:

```text
01-runtime-health-overview-1440x1000.png
02-launch-readiness-cash-only-1440x1000.png
03-needs-action-filter.png
04-deferred-services.png
05-runtime-not-monitored-evidence.png
06-api-unavailable-retry.png
07-partial-probe-failure.png
08-keyboard-single-scroll.png
09-dark-mode-runtime-health.png
10-all-services-1600x1000.png
```

실제 장애를 production 외부 서비스에 만들지 않는다. 오류·부분 실패·stale 상태는 테스트 fixture, mockable data loader 또는 격리된 로컬 환경에서 재현한다. 안전하게 재현하지 못한 상태는 가짜 캡처를 만들지 말고 정확한 blocker로 보고한다.

증거 저장 위치:

```text
docs/audits/setup-remediation-evidence-2026-08-11/
```

## 권장 실행 순서

### Phase 0 — 재확인과 baseline

1. `AGENTS.md`, 감사 보고서, 결제·외부 서비스 정책 문서를 읽는다.
2. 현재 dirty worktree와 관련 파일 diff를 확인한다.
3. 현재 `/setup` 화면과 1440px 중첩 스크롤을 재현한다.
4. `/health/external`, `/health/ready`, Admin contract의 모든 호출자를 검색한다.
5. 기존 집중 테스트를 baseline으로 실행한다.

### Phase 1 — P0 상태 신뢰성

1. configuration/runtime 두 축 계약 도입
2. launch profile과 Deferred 판정 중앙화
3. Cash-only 결제 false-positive 제거
4. config READY → Operational 변환 제거
5. per-service evidence/time 의미 수정
6. typed API error와 stale/partial 상태 구현
7. 핵심 계약 테스트 추가

### Phase 2 — P1 운영 화면

1. External Services 헤더와 launch profile 표시
2. Runtime health / Launch readiness 분리
3. Needs action / Active / Deferred saved views
4. 우선순위 정렬과 compact table
5. 실제 CTA·runbook·related page 연결
6. 중첩 세로 스크롤 제거
7. keyboard·오류·긴 텍스트 hardening

### Phase 3 — safe probes와 유지보수

1. 기존 readiness 결과 재사용
2. 부작용 없는 probe만 제한적으로 추가
3. 미사용 setup code/CSS를 소비자 확인 후 정리
4. source-string 중심 테스트를 의미 계약 중심으로 개선

### Phase 4 — 최종 검증

1. 집중 테스트와 typecheck
2. admin/API scope verification
3. Impeccable detector 한 번
4. 1440×1000, 1600×1000 브라우저 QA
5. 증거와 구현 보고서 작성

P0가 남아 있는데 Phase 2의 시각 개선만 적용하고 완료 처리하지 않는다. 반대로 backend만 수정하고 기존 `3 blocked`, plain text action, 중첩 스크롤을 남기지 않는다.

## 완료 산출물

구현과 함께 다음을 만든다.

```text
docs/audits/setup-remediation-report-2026-08-11.md
docs/audits/setup-remediation-evidence-2026-08-11/
```

구현 보고서에는 다음을 포함한다.

1. 변경 전 root cause와 변경 후 상태 계약
2. configuration/runtime/launch profile 판정표
3. 서비스별 probe 수준과 side-effect 안전성
4. P0/P1/P2 항목별 완료·미완료
5. 변경 파일과 목적
6. API compatibility와 protected area 변경 여부
7. 테스트 명령과 실제 pass/fail/skipped 결과
8. 1440px/1600px 화면 증거
9. 실행하지 않은 외부 mutation 확인
10. 남은 위험과 Release ready/hold 판정
11. 다음에 할 가장 중요한 한 가지

## 최종 인수 체크리스트

다음 항목을 모두 확인하기 전에는 전체 완료라고 보고하지 않는다.

### 상태 신뢰성

```text
[ ] Configured가 자동으로 Healthy/Operational이 되지 않는다.
[ ] runtime probe가 없으면 Not monitored다.
[ ] Healthy에는 최근 성공한 안전한 probe 증거가 있다.
[ ] response timestamp와 per-service probe timestamp가 구분된다.
[ ] stale/partial/error 상태가 정상으로 위장되지 않는다.
```

### 출시 범위

```text
[ ] 현재 launch profile이 한 곳에서 결정된다.
[ ] Cash-only에서 MoMo/VNPay disabled는 Deferred다.
[ ] Deferred가 빨간 blocker count에 포함되지 않는다.
[ ] required + incomplete만 launch blocker가 된다.
[ ] gateway flag와 secret을 임의로 변경하지 않았다.
```

### 운영 UX

```text
[ ] Runtime health와 Launch readiness가 분리됐다.
[ ] Needs action, Active services, Deferred를 빠르게 볼 수 있다.
[ ] 각 문제 행에 증거, 영향, 책임자, 실제 행동이 있다.
[ ] API 오류 종류와 recovery action이 구분된다.
[ ] 1440px에서 세로 스크롤 컨테이너가 하나다.
[ ] 상태가 색상만으로 전달되지 않는다.
[ ] keyboard로 핵심 흐름을 사용할 수 있다.
```

### 보안·안전

```text
[ ] secret/raw provider response가 UI·log·test evidence에 없다.
[ ] OTP/SMS/Push/결제 side effect probe를 실행하지 않았다.
[ ] 실제 운영/공유 데이터를 변경하지 않았다.
[ ] 관리자 role guard 회귀가 없다.
[ ] 기존 사용자 dirty change를 보존했다.
```

### 검증

```text
[ ] Admin setup 집중 테스트 통과
[ ] API health 집중 테스트 통과
[ ] Admin/API typecheck 통과
[ ] Admin/API scope verification 통과
[ ] 필요 시 verify:local 통과
[ ] Impeccable detector 실행 및 실제 결함 처리
[ ] 1440×1000과 1600×1000 브라우저 증거 저장
[ ] 1024px 이하 항목을 검사·보고하지 않음
```

P0 항목이 하나라도 남으면 `Release hold`와 정확한 blocker를 보고한다.

## 중단 조건

다음 경우에만 현재 상태와 증거를 정리해 사용자 확인을 요청한다.

- 실제 공유/운영 환경의 gateway flag나 secret 변경이 필요할 때
- side effect가 있는 외부 probe를 실행해야만 한다고 판단될 때
- 기존 dirty change와 같은 코드에서 사용자 의도를 보존할 수 없는 충돌이 있을 때
- launch profile을 결정할 authoritative policy가 서로 충돌하고 결과가 실제 결제 노출을 바꿀 때
- shared/production DB schema 변경이나 외부 서비스 계정 작업이 필요할 때

그 외에는 합리적인 가정을 문서화하고 P0부터 계속 구현한다.

## 최종 응답 형식

결과부터 간결하게 보고한다.

```text
Verdict: Release ready | Release hold
P0 remaining: 0 | N

Outcome
- 상태 의미와 Cash-only false-positive 해결 요약

Changed files
- 파일과 목적

Verification
- 명령: PASS/FAIL/SKIPPED
- 1440px/1600px 증거

Protected areas
- 변경 여부와 추가 검증

External mutations
- none 또는 명시 목록

Remaining risks
- 출시 차단/비차단 구분

Next action
- 가장 중요한 한 가지
```

실제 완료하지 않은 항목은 완료라고 쓰지 않는다. 테스트를 실행하지 않았으면 통과로 기록하지 않는다.

## Codex 최종 실행 지시

지금 바로 구현을 시작하라. 새 분석 보고서나 또 다른 프롬프트만 작성하고 멈추지 않는다.

- 현재 코드와 실행 화면을 다시 확인한다.
- 계획을 만들고 P0 상태 계약부터 실제 코드를 수정한다.
- 기존 사용자 변경을 보존한다.
- 안전한 probe와 불가능한 probe를 명확히 구분한다.
- 필요한 테스트를 작성하고 실행한다.
- 1440px 및 1600px 실제 화면을 캡처해 검증한다.
- 실제 외부 mutation이나 secret 변경만 보류하고 나머지는 끝까지 완료한다.
- 화면이 예뻐졌다는 이유로 상태 진실성 문제를 완료 처리하지 않는다.

최종 목표는 `3 blocked`를 없애는 것이 아니라, 운영자가 현재 장애·설정 준비·의도적 보류를 정확히 구분하고 안전한 다음 행동을 선택할 수 있는 신뢰 가능한 External Services 운영 화면이다.
