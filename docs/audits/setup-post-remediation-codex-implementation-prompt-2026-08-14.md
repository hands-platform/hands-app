# Codex 실행 프롬프트 — `/setup` 최종 운영 품질 개선

아래 내용을 새 Codex 작업에 그대로 붙여 넣어 사용한다.

---

## 역할

너는 `C:\dev\massage-on-demand-vn`의 시니어 풀스택 제품 엔지니어이자 관리자 운영 UX·서비스 관측성 전문가다.

이번 작업은 `/setup` 화면을 다시 디자인하는 작업이 아니다. 이미 해결된 상태 신뢰성 개선을 보존하면서, 최종 재감사에서 확인된 남은 문제를 실제 코드·API 계약·문서·테스트·화면에서 끝까지 해결하는 작업이다.

최종 사용자는 개발팀이 아니라 초기 서비스를 혼자 운영하는 운영자다. 운영자는 이 화면에서 다음 질문에 빠르게 답할 수 있어야 한다.

1. 지금 실제 장애가 있는가?
2. 장애는 아니지만 검증 증거가 부족한 서비스가 있는가?
3. 현재 Cash-only 출시를 차단하는 항목이 있는가?
4. 의도적으로 보류된 기능은 무엇인가?
5. 각 상태의 근거와 마지막 검증 시각은 무엇인가?
6. 운영자가 지금 누를 수 있는 정확한 다음 행동은 무엇인가?

장식보다 **상태 계약의 단일성, 운영 판단의 정확성, 증거와 행동의 연결, 1440px 가독성**을 우선한다.

## 작업 위치와 필수 기준 문서

- 저장소: `C:\dev\massage-on-demand-vn`
- 대상 URL: `http://localhost:3101/setup`
- 최종 재감사 보고서:
  - `C:\dev\massage-on-demand-vn\docs\audits\setup-post-remediation-final-reaudit-2026-08-14.md`
- 최신 화면 증거:
  - `C:\dev\massage-on-demand-vn\docs\audits\setup-post-remediation-final-reaudit-evidence-2026-08-14\`
- 저장소 지침:
  - `C:\dev\massage-on-demand-vn\AGENTS.md`
- 상태 API 문서:
  - `C:\dev\massage-on-demand-vn\docs\architecture\health-readiness.md`
- 이전 구현 프롬프트와 보고서:
  - `C:\dev\massage-on-demand-vn\docs\audits\setup-remediation-codex-prompt-2026-08-11.md`
  - `C:\dev\massage-on-demand-vn\docs\audits\setup-remediation-report-2026-08-11.md`

작업 시작 시 위 파일을 먼저 읽는다. 보고서의 줄 번호는 감사 당시 기준이므로 현재 파일을 `rg`로 다시 검색하고 실제 코드를 확인한다. 이미 해결된 항목을 다시 구현하거나 과거 기준으로 코드를 되돌리지 않는다.

## 현재 검증된 기준선

최종 재감사 당시 상태는 다음과 같다.

- 종합 점수: `78/100`, B-, 조건부 통과
- 새로운 P0 결함: 없음
- `Configured = Healthy` 오판: 해결됨
- Cash-only에서 MoMo·VNPay·Referral을 현재 장애로 계산하던 문제: 해결됨
- API 오류를 0건이나 정상으로 보이게 하던 문제: 해결됨
- 기본 URL: `/setup` → `Runtime health / Active services`
- 활성 서비스: 6개
- Supabase core: 실제 connectivity probe로 `Healthy`
- 나머지 필수 서비스 5개: `Configuration ready / Not monitored`
- 의도적 보류: MoMo, VNPay, Referral 3개
- 화면 수치: `Needs action 0`, `Unknown or not monitored 5`, `Deferred 3`
- 1440px 측정: 표 컨테이너 약 `1050px`, 표 콘텐츠 약 `1162px`
- 관련 Admin 테스트 59개, API health 테스트 25개가 감사 시 통과함

위 수치를 UI에 하드코딩하지 않는다. 현재 API 응답에서 계산한다.

## 이번 작업의 핵심 목표

다음 여섯 가지는 필수 완료 범위다.

1. `Evidence gaps`를 운영자가 실제로 처리할 수 있는 별도 큐로 만든다.
2. Launch readiness 0건 화면을 출시 결론형 empty state로 바꾼다.
3. API 내부의 구형·신규 출시 범위 정의를 단일 policy/manifest로 통합한다.
4. evidence, related workspace, runbook 링크의 의미를 분리한다.
5. 1440px에서 핵심 상태와 Action을 수평 스크롤 없이 보이게 한다.
6. `DEGRADED`가 조치 대상으로 계산되면서도 잘못된 행동 문구를 표시하는 결함을 수정한다.

P1을 남긴 채 문구·색상·여백만 바꾸고 완료 처리하지 않는다.

## 절대 보존해야 할 설계 결정

다음 항목은 현재 구현 방향이 맞다. 되돌리지 않는다.

1. `/setup` 하나 안에서 `Runtime health`와 `Launch readiness` 두 mode를 유지한다.
2. 별도 사이드바 페이지나 대메뉴를 추가하지 않는다.
3. 기본 진입은 `Runtime health / Active services`로 유지한다.
4. Cash-only에서 비활성 MoMo·VNPay·Referral은 `Deferred`이며 현재 장애나 blocker가 아니다.
5. configuration 존재를 `Healthy` 또는 `Operational`로 승격하지 않는다.
6. 실제 probe가 없으면 `NOT_MONITORED` 또는 근거에 맞는 `UNKNOWN`을 사용한다.
7. OTP, SMS, Push, 결제, 환불, 실제 upload 같은 부작용 probe를 자동 실행하지 않는다.
8. API의 401/403/429/5xx/timeout을 빈 표, 0건, 정상 상태로 바꾸지 않는다.
9. secret, token, private key, raw provider response, 환경 변수 값을 UI·로그·증거에 노출하지 않는다.
10. 기존 Admin 디자인 토큰·배지·테이블·버튼·notice를 재사용한다.
11. 새로운 UI 라이브러리, 모니터링 플랫폼, 상태 관리 라이브러리를 추가하지 않는다.
12. 1024px 이하, 모바일, 태블릿 반응형 개선은 이번 범위에서 완전히 제외한다.

## 작업 안전 규칙

1. 저장소에는 사용자의 다수 미커밋 변경이 존재한다. 관련 없는 변경을 수정·삭제·되돌리지 않는다.
2. `git reset --hard`, 광범위한 checkout, 무관한 파일 삭제를 금지한다.
3. 먼저 `git status --short`와 관련 파일 diff를 확인하고 사용자 변경 위에 최소 범위로 작업한다.
4. 결제 플래그, 실제 credentials, `.env` 값을 변경하지 않는다.
5. 실제 SMS·OTP·Push·결제·환불·파일 업로드를 발생시키지 않는다.
6. 데이터베이스 schema나 migration을 추가하기 전에 기존 로그·감사 기록·metrics 저장소를 먼저 조사한다. 이번 개선만을 위해 새 incident 플랫폼이나 범용 프레임워크를 만들지 않는다.
7. `next typegen`과 `next build`는 실행 중인 `next start`의 `.next` 산출물과 충돌할 수 있다. 3101 production server를 실행한 상태에서 같은 build directory를 덮어쓰지 않는다. 필요하면 repo의 local scripts로 안전하게 중지한 후 typecheck/build를 실행하고 다시 시작해 `local:status`를 확인한다. 이름이 불분명한 프로세스를 광범위하게 종료하지 않는다.

## 우선 조사할 코드

실제 호출자를 검색한 뒤 필요한 파일만 변경한다.

- `apps/admin_web/app/setup/page.tsx`
- `apps/admin_web/app/setup/setup-overview-section.tsx`
- `apps/admin_web/app/setup/setup-page-model.ts`
- `apps/admin_web/app/setup/**/*.spec.*`
- `apps/admin_web/lib/admin-api.ts`
- `apps/admin_web/lib/admin-navigation.ts`
- `apps/admin_web/app/globals.css`
- `apps/api/src/health/health.controller.ts`
- `apps/api/src/health/health.service.ts`
- `apps/api/src/health/health.controller.spec.ts`
- `apps/api/src/health/health.service.spec.ts`
- `docs/architecture/health-readiness.md`
- API/DTO의 실제 소비자와 smoke scripts

`packages/shared-types`, auth, payments, Prisma, migration 등 `AGENTS.md`의 protected area를 변경하게 되면 이유를 먼저 명시하고 요구되는 추가 검증을 수행한다. 가능하면 기존 health contract 안에서 additive하고 작은 변경을 우선한다.

## Phase 0 — 현재 상태 재확인

코드를 수정하기 전에 다음을 수행한다.

1. 기준 문서와 `AGENTS.md`를 끝까지 읽는다.
2. 관련 파일의 현재 diff와 신규 파일을 확인한다.
3. 로그인된 실제 `/setup`을 1440×1000에서 캡처한다.
4. `Runtime health`, `Launch readiness`, `Deferred`, 현재 count와 URL query round-trip을 확인한다.
5. `/health/external`의 모든 소비자를 검색한다. `checks[]`, `services[]`, `currentStageOk`, `blockingCategories`, `deferredCategories`, `scope`, `deferred` 사용처를 빠짐없이 찾는다.
6. 관련 Admin/API 집중 테스트를 baseline으로 실행한다.
7. 보고서 내용과 현재 코드가 달라졌다면 현재 코드·실행 화면을 근거로 차이를 구현 보고서에 기록한다.

새 분석 보고서만 만들고 멈추지 말고, 안전한 범위의 구현과 검증까지 계속한다.

## Phase 1 — 출시 범위 계약을 하나로 통합

### 문제

현재 API에는 같은 응답을 서로 다르게 해석할 수 있는 두 기준이 공존한다.

- legacy `decorateExternalCheck()` / `isDeferredExternalCategory()`는 Phone Auth, SMS, payments, push, storage, referrals 등을 폭넓게 `DEFERRED`로 판단한다.
- 신규 `externalServicePolicy()`는 Cash-only에서 Referral과 비활성 PG만 deferred로 두고 Phone Auth, SMS, push, storage 등을 `requiredForCurrentLaunch=true`로 판단한다.
- Admin은 주로 `services[]`를 사용하여 정상처럼 보이지만 다른 소비자가 `checks[].scope`를 사용하면 출시 결론이 달라질 수 있다.

### 구현 요구사항

1. launch profile별 capability 정책을 단일 함수 또는 작은 manifest로 정의한다.
2. capability ID/category/name, enabled, requiredForCurrentLaunch, configuration scope/deferred가 같은 정책에서 파생되게 한다.
3. `services[]`, legacy `checks[]`, counts, `currentStageOk`, `blockingCategories`, `deferredCategories`가 같은 판정 결과를 사용하게 한다.
4. 기존 소비자 호환성이 필요하면 legacy 필드를 즉시 제거하지 말고 새 기준으로 normalize한다. 제거는 별도 deprecation 작업으로 남긴다.
5. Cash-only에서 현재 정책은 다음과 같아야 한다.
   - MoMo/VNPay disabled: Deferred, blocker 아님
   - Referral: Deferred, blocker 아님
   - 현재 필수로 확정된 Phone Auth/SMS/FCM/Storage/Maps/Core: required now
6. 정책을 프론트에서 다시 추론하지 않는다.
7. API 문서의 scope 설명도 같은 기준으로 수정한다.

### 필수 계약 테스트

- 모든 capability에 대해 legacy scope와 operator-facing derived scope가 모순되지 않는다.
- Cash-only deferred 3개가 blocker count에 포함되지 않는다.
- required + incomplete만 launch configuration blocker다.
- enabled runtime `DOWN`과 `DEGRADED`가 Needs action에 포함된다.
- config-ready + runtime unprobed는 Healthy가 아니라 `NOT_MONITORED`다.
- 기존 smoke/API 소비자가 호환성을 유지한다.

## Phase 2 — 상태 count와 Evidence gaps 큐

### 상태 의미

`UNKNOWN`과 `NOT_MONITORED`를 합치지 않는다.

- `UNKNOWN`: probe가 존재하지만 결과를 확정할 수 없거나 stale/조회 실패 상태
- `NOT_MONITORED`: 안전한 runtime probe가 설계되어 있지 않은 상태
- `Evidence gap`: required/enabled 서비스인데 runtime evidence가 충분하지 않아 `UNKNOWN` 또는 `NOT_MONITORED`인 운영 검증 과제

장애와 증거 부족은 서로 다른 큐다. Evidence gap을 빨간 장애로 만들지 않는다.

### API/model 요구사항

1. counts에 최소한 다음 의미가 독립적으로 제공되게 한다.

```ts
counts: {
  needsAction: number;
  degraded: number;
  unknown: number;
  notMonitored: number;
  evidenceGaps: number;
  deferred: number;
}
```

현재 타입과 호환성을 위해 이름을 조정할 수 있지만 의미를 합치지 않는다.

2. `evidenceGaps`는 현재 required/enabled 여부와 runtime evidence 상태에서 서버 또는 공용 모델의 한 함수로 계산한다.
3. 같은 조건을 UI 여러 위치에서 복제하지 않는다.
4. 각 서비스가 가능한 범위에서 다음 evidence metadata를 제공하게 한다.

```ts
evidenceLevel: 'CONNECTIVITY' | 'FUNCTIONAL' | 'CONFIGURATION_ONLY' | 'NONE';
lastProbeAt: string | null;
lastSuccessAt: string | null;
lastVerifiedAt: string | null;
verificationMethod: string;
```

기존 필드로 충분하면 새 필드를 무조건 늘리지 말고 명확한 파생 모델을 사용한다. 실제 근거가 없는 timestamp를 생성하지 않는다.

### UI 요구사항

1. Runtime saved views를 다음과 같이 구성한다.
   - `Needs action {N}`
   - `Active services {N}`
   - `Evidence gaps {N}`
   - `Deferred {N}`
2. `Evidence gaps`와 상태 요약 count는 클릭 가능하고 동일 URL query로 deep-link된다.
3. 한 번 클릭하면 정확히 해당 서비스만 표시한다.
4. 각 evidence gap 행에서 상태의 의미, 최근 증거, 확인 방법, 다음 행동을 알 수 있어야 한다.
5. `Not monitored`를 장애색이나 `Healthy` 색으로 표현하지 않는다.
6. 상태는 색상만으로 구분하지 않고 텍스트를 유지한다.

권장 URL은 현재 query contract와 충돌하지 않는 범위에서 `mode=runtime&view=evidence-gaps` 또는 동등한 명시적 값이다. 잘못된 query는 안정적인 기본값으로 복구하고 URL round-trip 테스트를 추가한다.

## Phase 3 — Launch readiness 0건을 결론형 상태로 변경

`Launch readiness / Needs action`이 0건일 때 `No capabilities match this view.`만 표시하지 않는다.

### 필수 정보

API 결과에서 동적으로 계산하여 다음 의미를 보여 준다.

- 제목: `Cash-only launch configuration is ready`
- 현재 출시 차단 항목이 없다는 명확한 결론
- required capabilities 중 configuration-ready 수
- runtime verification이 확보된 수
- evidence gap 수
- intentionally deferred 수

감사 당시 예시는 `required 6 / runtime verified 1 / evidence gaps 5 / deferred 3`이지만 숫자를 하드코딩하지 않는다.

### 필수 CTA

- `View required capabilities`
- `Review evidence gaps`
- `View deferred scope`

CTA는 실제 같은 페이지의 URL query/view로 이동해야 한다. `view=needs-action`을 사용자가 직접 선택한 경우에도 positive conclusion을 유지한다. 자동으로 다른 탭으로 보내서 0건을 숨기지 않는다.

## Phase 4 — Action link의 의미와 목적지 정리

### API 계약

`escalationRoute` 하나에 서로 다른 의미를 넣지 않는다. 필요한 의미를 명확히 분리한다.

```ts
evidenceHref: string | null;
relatedWorkspaceHref: string | null;
runbookHref: string | null;
```

실제 기존 필드와 호환성이 필요하면 additive migration을 사용한다. 사용하지 않는 필드를 무리하게 추가하지 말고, 각 서비스에 어떤 링크가 실재하는지 먼저 검색한다.

### UI 문구 규칙

- 정확한 상태·필터·section으로 연결될 때만 `View evidence`
- 넓은 업무 화면으로만 연결되면 `Open related workspace`
- 실제 runbook 문서가 있을 때만 `Open runbook`
- 링크가 없으면 가짜 CTA를 만들지 않고 안전한 안내 문구를 표시
- primary action은 한 개만 노출하고 보조 행동은 disclosure 안에 둔다.

FCM, Auth, Maps, Storage, SMS, Supabase core, Payments, Referral 각각의 실제 목적지를 확인한다. 단순히 `/notifications`, `/partners`, `/payments` 루트로 보내면서 `View evidence`라고 부르지 않는다. 필터나 hash deep-link가 안정적으로 작동할 때만 evidence 링크로 인정한다.

## Phase 5 — DEGRADED 조치와 서비스별 영향 수정

### DEGRADED 결함

현재 Needs action 계산은 `DOWN`과 `DEGRADED`를 포함하지만 safe action과 UI 버튼은 `DOWN`만 runtime 문제로 처리한다.

수정 후 다음을 만족해야 한다.

- `DOWN`과 `DEGRADED` 모두 runtime action을 사용한다.
- `DEGRADED`에 `No configuration action required.`가 표시되지 않는다.
- 버튼은 `Review runtime impact`, `Review degraded service` 또는 서비스별 구체 행동을 사용한다.
- `DEGRADED` fixture로 API와 Admin rendering test를 추가한다.

### Impact 문구

현재 모든 DOWN 서비스에 Supabase 데이터 장애 문구를 공통 적용하지 않는다. capability metadata 또는 category별 impact를 사용한다.

- 확인된 영향만 단정한다.
- 근거가 없으면 `No confirmed impact` 또는 `Impact not yet confirmed`를 사용한다.
- 추정 피해 건수나 사용자를 만들어 내지 않는다.
- 운영자 기본 화면에는 기술적인 raw error를 노출하지 않는다.

## Phase 6 — 1440px 운영 표 재구성

### 목표

1440×1000에서 핵심 상태와 primary Action이 수평 스크롤 없이 보여야 한다. CSS로 overflow를 숨기거나 마지막 열을 잘라서 통과시키지 않는다.

### Runtime 기본 열

최대 다섯 개를 권장한다.

```text
Service
Runtime status
Evidence / last event
Current impact
Action
```

너비가 부족하면 `Current impact`도 disclosure로 이동할 수 있다. `Owner`, 상세 configuration, 전체 timestamp는 row disclosure 또는 detail 영역으로 옮긴다.

### Launch readiness 기본 열

```text
Capability
Configuration
Evidence level
Last verified
Next step
```

`Required now`는 별도 넓은 열 대신 capability/configuration 영역의 보조 배지나 문구로 합칠 수 있다.

### 행 상세 disclosure

- 키보드로 열고 닫을 수 있어야 한다.
- `aria-expanded`, 접근 가능한 이름, 안정적인 focus를 제공한다.
- Owner, verification method, exact timestamps, 관련 workspace/runbook 등 보조 정보를 담는다.
- 핵심 Action을 disclosure 안에 숨기지 않는다.

### 1440px 완료 조건

- 표가 페이지 콘텐츠 영역보다 넓지 않다.
- Action/Next step 전체 문구와 버튼이 초기 화면에 보인다.
- 서비스명이 글자 단위로 잘게 줄바꿈되지 않는다.
- 문서 세로 스크롤은 하나만 유지한다.
- 1600px 라이트/다크에서도 레이아웃이 안정적이다.

1024px 이하 breakpoint와 모바일 카드는 검사·보고·완료 기준에 포함하지 않는다.

## Phase 7 — 명칭, 중복 정보, 1인 운영 문구

같은 페이지를 여러 이름으로 부르지 않는다.

권장 명칭 체계:

- 사이드바 그룹: `System Health`
- 현재 workspace page: `External Services`
- 같은 수준의 형제: `App Sessions`, `Background Jobs`
- 내부 mode: `Runtime health`, `Launch readiness`

`Setup Readiness`라는 workspace label과 breadcrumb는 `External Services`로 통일한다. route `/setup`은 유지한다.

Saved views와 status summary가 같은 숫자를 바로 위아래에서 반복하지 않게 한다. 예:

- 첫 줄: 탐색 가능한 saved views
- 두 번째 줄: `Degraded`, `Unknown`, `Not monitored`, `Last refresh`처럼 다른 판단 정보

초기 1인 운영 환경에서는 가상의 팀명 열을 핵심 표에서 제거한다. API metadata는 향후 확장을 위해 유지할 수 있지만 기본 화면에서는 다음 정보를 우선한다.

- 확인 방법
- 마지막 검증 시각
- 현재 영향
- 실제 다음 행동

## Phase 8 — Refresh와 문서 계약

### Refresh

- 클릭 직후 loading 또는 pending 상태를 보여 준다.
- 중복 요청을 막기 위해 처리 중 버튼을 disable한다.
- 성공 또는 오류 피드백을 제공한다.
- 현재 mode/view URL을 보존한다.
- API cache가 최대 5초라면 운영자가 오해하지 않도록 필요한 범위에서 `Updated just now · cache up to 5s` 같은 설명을 사용한다.
- 자동 새로고침이나 polling framework를 새로 만들지 않는다.
- async count 변화는 focus를 이동시키지 말고 필요한 경우 하나의 의미 있는 `role=status` 메시지로 알린다. 모든 badge를 개별 live region으로 만들지 않는다.

### 문서

`docs/architecture/health-readiness.md`를 실제 controller와 일치시킨다.

- `/api/health`: public
- `/api/health/ready`: 실제 guard를 확인하여 정확히 기재
- `/api/health/external`: Admin JWT/ADMIN role 필요
- 인증 없는 `Invoke-RestMethod /api/health/external` 예시는 삭제하거나 인증된 예시/관리자 화면 사용법으로 교체
- legacy/new scope가 단일 정책에서 파생된다는 사실과 호환성 방식을 기록

문서 때문에 실제 auth guard를 약화하지 않는다.

## Runtime history 처리 원칙

현재 history가 프로세스 메모리 Map에만 있다면 재시작 후 사라진다는 한계를 확인한다.

- 기존 운영 로그, audit log, metrics store에 재사용 가능한 증거가 있으면 최소 변경으로 연결한다.
- 없다면 이번 작업에서 새 DB schema를 성급히 만들지 않는다.
- UI에서 영속적인 기록처럼 과장하지 않고 `Since this API process started`처럼 범위를 정직하게 표현하거나 해당 정보를 숨긴다.
- 영속 저장이 별도 인프라 결정이 필요하면 구현 보고서에 비차단 후속 작업으로 남긴다.

## 필수 테스트

### API health

1. 단일 launch manifest에서 legacy/new scope가 동일하게 파생된다.
2. Cash-only deferred 3개가 blocker가 아니다.
3. required + incomplete는 blocker다.
4. config-only service는 runtime `NOT_MONITORED`다.
5. `UNKNOWN`과 `NOT_MONITORED` count가 분리된다.
6. evidence gap count가 현재 required/enabled 조건과 일치한다.
7. `DOWN`과 `DEGRADED` 모두 Needs action이다.
8. `DEGRADED`가 runtime action을 가진다.
9. category별 impact 문구가 잘못된 Supabase 공통 문구로 떨어지지 않는다.
10. evidence/related workspace/runbook 링크가 의미에 맞게 분리된다.
11. secret과 raw provider error가 응답에 포함되지 않는다.
12. admin JWT/role guard가 유지된다.

### Admin model/component

1. `/setup` 기본값은 runtime/active다.
2. `Evidence gaps` view query가 parse·render·round-trip된다.
3. 잘못된 query는 안전한 기본값으로 복구된다.
4. Evidence gaps count 클릭 시 정확한 목록을 표시한다.
5. Unknown과 Not monitored를 서로 다른 상태로 표시한다.
6. Launch needs-action 0건에서 긍정 결론, 동적 수치, 3개 CTA가 표시된다.
7. 0건 empty state가 오류 상태를 정상으로 오인하지 않는다.
8. DEGRADED 행이 runtime action을 표시한다.
9. 실제 deep-link만 `View evidence`이고 넓은 route는 `Open related workspace`다.
10. row disclosure의 ARIA와 keyboard 동작이 유지된다.
11. Refresh loading/success/error와 URL state 보존을 검증한다.
12. long English/CJK/Vietnamese copy가 핵심 열을 밀어내지 않는다.

문구 원문 전체를 brittle하게 비교하는 테스트보다 상태 의미, 링크 목적지, count, accessible role을 검증한다.

## 필수 브라우저 QA

가능하면 다음 순서로 `product-design:audit`, 로그인된 in-app browser, `ui-ux-pro-max`를 사용한다. 해당 skill이 없으면 같은 원칙으로 실제 브라우저 검증을 수행한다.

검사 viewport:

```text
1440×1000 필수
1600×1000 필수
1024px 이하 완전 제외
```

최소 확인 상태:

1. Runtime / Active services
2. Runtime / Evidence gaps
3. Runtime / Needs action의 0건 또는 fixture
4. Runtime / DEGRADED fixture
5. Launch readiness / Needs action 0건 positive conclusion
6. Launch readiness / Required capabilities
7. Deferred
8. Refresh pending/success
9. 401/403/429/5xx/timeout 렌더링 fixture
10. 1600px dark mode

실제 외부 장애나 로그아웃을 일으키지 않는다. 오류·DEGRADED 상태는 기존 테스트 fixture 또는 격리된 browser fixture를 사용한다. 가짜 화면을 실제 운영 응답이라고 보고하지 않는다.

브라우저에서 확인할 항목:

- 현재 nav, mode, saved view가 시각적 상태와 `aria-current`/URL에서 일치
- 1440px에서 핵심 Action이 수평 이동 없이 보임
- Tab/Shift+Tab/Enter/Space/Escape로 mode, view, disclosure, action 사용 가능
- Refresh가 focus를 잃거나 전체 화면을 불필요하게 점프시키지 않음
- 상태가 색상만으로 전달되지 않음
- dark mode에서 본문, muted text, badge, focus ring 대비 유지
- 브라우저 console/runtime error 없음

## 검증 명령

실제 package scripts와 파일을 먼저 확인한 후 다음과 동등한 검증을 수행한다.

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- app/setup
npm.cmd run test --workspace @massage-vn/api -- src/health/health.controller.spec.ts src/health/health.service.spec.ts
npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run typecheck --workspace @massage-vn/api
npm.cmd run admin:visible-copy
npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api
```

Admin production build도 실행한다.

```powershell
npm.cmd run build --workspace @massage-vn/admin-web
```

protected area, shared contracts, auth behavior, schema 또는 광범위한 동작을 변경했다면 `AGENTS.md`에 따라 다음을 포함한 추가 검증을 수행한다.

```powershell
npm.cmd run verify:local
```

UI 변경 파일에는 사용 가능한 경우 Impeccable detector를 한 번 실행한다.

```powershell
node C:\Users\laboy\.codex\skills\impeccable\scripts\detect.mjs --json <changed-ui-targets>
```

검출 결과는 실제 결함만 한 번의 bounded pass로 수정한다. 실행하지 않은 검증을 PASS로 기록하지 않는다. unrelated failure가 발생하면 명령, 실제 오류, 이번 변경과의 관계를 보고한다.

## 구현 완료 기준

다음 조건이 모두 충족되어야 완료다.

### 상태 계약

```text
[ ] launch profile 정책이 한 곳에서 정의된다.
[ ] legacy checks와 services가 서로 다른 scope를 반환하지 않는다.
[ ] Cash-only deferred가 blocker로 계산되지 않는다.
[ ] Unknown과 Not monitored가 분리된다.
[ ] Evidence gaps가 독립적으로 계산된다.
[ ] DEGRADED에 runtime 조치 문구가 제공된다.
[ ] 서비스별 impact가 실제 의미에 맞다.
```

### 운영 UX

```text
[ ] Evidence gaps가 클릭 가능한 view다.
[ ] 한 번의 클릭으로 증거가 부족한 서비스만 볼 수 있다.
[ ] Launch 0건이 출시 결론과 동적 수치를 제공한다.
[ ] evidence/related workspace/runbook 링크가 구분된다.
[ ] 페이지 명칭이 External Services로 통일된다.
[ ] 중복 수치가 정리된다.
[ ] 1인 운영자에게 필요한 증거·시각·행동이 owner보다 우선한다.
[ ] Refresh에 pending/success/error 피드백이 있다.
```

### 1440px 화면

```text
[ ] 1440×1000에서 Action/Next step이 잘리지 않는다.
[ ] 핵심 표에 수평 스크롤이 필요하지 않다.
[ ] 서비스명이 과도하게 줄바꿈되지 않는다.
[ ] 핵심 Action은 disclosure 밖에 보인다.
[ ] 1600×1000 light/dark가 안정적이다.
[ ] 1024px 이하 항목을 검사·보고하지 않았다.
```

### 안전·회귀

```text
[ ] Configured를 Healthy로 바꾸지 않았다.
[ ] 부작용 probe를 추가하거나 실행하지 않았다.
[ ] 실제 결제·SMS·OTP·Push·upload를 발생시키지 않았다.
[ ] API 오류가 0건/정상으로 위장되지 않는다.
[ ] secret/raw provider response를 노출하지 않는다.
[ ] 관리자 guard를 약화하지 않았다.
[ ] 사용자 dirty changes를 보존했다.
```

P1 필수 항목이 하나라도 남으면 `Release hold`와 정확한 blocker를 보고한다. Runtime history 영속화처럼 별도 인프라 판단이 필요한 P2는 사실대로 non-blocking follow-up으로 분류할 수 있다.

## 산출물

구현과 함께 다음을 추가한다.

```text
docs/audits/setup-post-remediation-implementation-report-2026-08-14.md
docs/audits/setup-post-remediation-implementation-evidence-2026-08-14/
```

구현 보고서에는 다음을 포함한다.

1. 최종 verdict와 전후 점수 추정
2. P1/P2별 완료·부분 완료·미완료 표
3. launch policy 단일화 전후 계약
4. Unknown/Not monitored/Evidence gap 판정표
5. 서비스별 evidence·link·impact·operator action 매핑
6. 1440px 표 전후 측정값
7. 변경 파일과 목적
8. 실제 실행한 검증 명령과 PASS/FAIL/SKIPPED
9. protected area 변경 여부와 추가 검증
10. 외부 mutation이 없었다는 확인
11. 화면 증거와 접근성 확인 범위
12. 남은 위험과 가장 중요한 다음 작업 하나

기존 감사 보고서와 증거는 덮어쓰지 않는다.

## 권장 실행 순서

1. 문서·dirty diff·호출자·화면 baseline 확인
2. 집중 테스트 baseline 실행
3. launch policy 단일화와 계약 테스트
4. count 분리, Evidence gaps, DEGRADED/impact/link API 개선
5. Admin model과 query contract 수정
6. Launch positive empty state와 운영 표 재구성
7. 명칭·중복 정보·Refresh·문서 수정
8. 집중 테스트와 typecheck
9. 안전한 production build 순서로 build 검증
10. 1440/1600 실제 브라우저 QA와 증거 캡처
11. scope/full verification과 구현 보고서 작성

백엔드 계약을 고치지 않은 채 프론트 문자열만 조정하지 않는다. 반대로 API만 고치고 Evidence gaps, empty state, 1440px Action 노출을 남기지도 않는다.

## 중단 조건

다음 경우에만 현재 증거와 선택지를 정리하여 사용자 확인을 요청한다.

- launch profile의 authoritative 정책이 실제 결제 노출을 바꿀 정도로 충돌할 때
- shared/production DB schema 변경이 반드시 필요할 때
- 실제 provider credentials 또는 gateway flag 변경이 필요할 때
- 부작용이 있는 외부 probe가 반드시 필요하다고 판단될 때
- 같은 코드에 있는 사용자 미커밋 변경과 안전하게 병합할 수 없을 때

그 외에는 합리적인 가정을 기록하고 구현·테스트·브라우저 검수까지 계속한다.

## 최종 응답 형식

결과부터 간결하게 보고한다.

```text
Verdict: Release ready | Release hold
P1 remaining: 0 | N

Outcome
- 운영자가 달라진 점

Changed files
- 파일과 변경 목적

Verification
- 실제 명령: PASS/FAIL/SKIPPED
- 1440/1600 화면 증거

Protected areas
- 변경 여부와 추가 검증

External mutations
- none 또는 정확한 목록

Remaining risks
- 출시 차단/비차단 구분

Next action
- 가장 중요한 한 가지
```

실행하지 않은 테스트를 통과했다고 쓰지 않는다. 코드·테스트·화면·문서가 함께 일치해야 완료다.

## Codex 최종 실행 지시

지금 바로 구현을 시작하라.

- 프롬프트나 추가 감사 보고서만 작성하고 멈추지 않는다.
- 현재 코드와 실행 화면을 다시 확인한다.
- 기존 사용자 변경을 보존한다.
- P1 상태 계약부터 수정한다.
- 관련 테스트를 작성하고 실제로 실행한다.
- 1440×1000과 1600×1000에서 화면을 직접 검수한다.
- 오류·DEGRADED는 안전한 fixture로 검증한다.
- 실제 외부 mutation과 secret 변경만 보류하고 나머지는 끝까지 완료한다.

최종 목표는 모든 수치를 초록색으로 만드는 것이 아니다. 운영자가 **실제 장애, 증거 부족, 출시 차단, 의도적 보류를 혼동하지 않고 한 번의 화면에서 안전한 다음 행동을 선택할 수 있는 External Services 운영 도구**를 만드는 것이다.
