# Codex 실행 프롬프트 — Partner Overview 운영자 중심 개선

아래 프롬프트를 HANDS 프로젝트를 수정할 새 Codex 작업에 그대로 붙여 넣는다.

---

## 복사 시작

당신은 HANDS 관리자 웹의 `Partner Overview`를 실제 운영자가 신뢰하고 사용할 수 있는 `Partner Operations` 화면으로 개선하는 메인 구현 에이전트다.

분석이나 제안만 하고 끝내지 말고, 아래 범위의 코드를 직접 수정하고 테스트와 실제 브라우저 검증까지 완료하라. 단, 기존 사용자 변경을 보존하며 관련 없는 리팩터링은 하지 마라.

### 1. 작업 위치와 필수 규칙

- 작업 디렉터리: `C:\dev\massage-on-demand-vn`
- `C:\dev\massage-vn-workspace`는 사용하지 마라.
- 단일 에이전트로 작업하라. subagent, worker, handoff agent, multi-agent 도구를 사용하지 마라.
- 먼저 루트 `AGENTS.md`와 `docs/agent/HANDS_CODEX_WORKFLOW_GUARD.md`를 전부 읽고 준수하라.
- 현재 worktree는 이미 수정 사항이 많을 수 있다. 시작 전에 `git status --short`와 관련 파일의 `git diff`를 확인하고, 사용자의 기존 변경을 되돌리거나 덮어쓰지 마라.
- `git reset --hard`, `git checkout --`, 광범위한 포맷팅, 무관한 파일 정리는 금지한다.
- 사용자가 요청하지 않았으므로 commit, push, 배포를 하지 마라.
- 새 UI 프레임워크, 차트 라이브러리, 테이블 라이브러리, 상태 관리 라이브러리를 추가하지 마라.
- 기존 Admin 컴포넌트, CSS 토큰, `lucide-react`, 네이티브 `<details>`, CSS grid/sticky를 재사용하라.
- 사용자 문구는 `Partner`를 사용하고 `Provider`는 내부 레거시 코드에서만 유지하라.
- 새 route를 만들지 말고 `/partners/overview` 안에서 개선하라.
- 실제 근거가 없는 SLA, 담당자, 원인, 수치를 만들어 내지 마라.
- line number는 참고일 뿐이다. 수정 전에 현재 파일 내용을 다시 확인하라.

### 2. 반드시 먼저 읽을 감사 자료

다음 보고서를 처음부터 끝까지 읽고, 보고서에 포함된 모든 채택 스크린샷을 직접 열어 확인하라.

`C:\dev\massage-on-demand-vn\output\partner-overview-audit-2026-08-06\partner-overview-operator-ux-data-audit.md`

특히 다음 증거를 우선 확인하라.

- `03-operating-status-top-1440.png`: 운영 상태 카드의 텍스트 결합/파손
- `04-operating-status-signals-1440.png`: 고객 앱 visibility blocker와 0건 KPI
- `05-area-service-supply-1440.png`, `06-area-service-supply-right-1440.png`: 반쪽 폭 수평 스크롤 표
- `17-quality-wallet-risk-720.png`: 720px에서도 Quality/Finance가 2열인 CSS cascade 문제
- `19-selection-friction-7d-1440.png`: 핵심 Reason/Action이 화면 밖에 있는 Selection 표
- `20-quality-wallet-risk-7d-1440.png`: Finance 금액 중첩과 Quality 표의 wallet row 혼입
- `22-detailed-action-queues-verify-1440.png`: 상세 큐의 안정 상태

### 3. 정책과 데이터 정의의 우선순위

충돌이 있으면 다음 순서로 판단하라.

1. `docs/agent/HANDS_CODEX_WORKFLOW_GUARD.md`
2. `docs/architecture/hands-mvp-final-authority.md`
3. `docs/architecture/provider-onboarding.md`
4. 현재 NestJS 비즈니스 로직과 그 테스트
5. Admin Web 표현
6. 감사 보고서의 제안

반드시 지켜야 하는 HANDS 계약:

- NestJS가 비즈니스 규칙의 권위다.
- Customer final selection이 최종 선택의 source of truth다.
- 음수 Partner 지갑은 marketplace visibility와 request participation을 막지 않는다.
- 음수 지갑은 final acceptance, service start, payout release를 정산 완료 전까지 막는다.
- 은행 계좌 검토는 Partner 수준의 승인·공개 게이트가 아니며 payout/withdrawal 단계에서 사용한다.
- Discovery는 주소 기반이어야 하며 일시적인 GPS freshness만으로 Partner를 marketplace에서 숨기면 안 된다.
- 위치 freshness는 실시간 배차 가능성·Bookable now 판정에는 사용할 수 있지만 공개 프로필 visibility와 같은 의미로 쓰지 마라.

### 4. 구현 목표

`/partners/overview`를 다음 세 영역이 명확히 구분되는 운영 화면으로 만든다.

1. `Action required`: 지금 운영자가 처리해야 하는 비어 있지 않은 큐
2. `Current supply`: 현재 온라인/예약 가능/차단/고객 앱 공개 상태
3. `Performance · selected period`: Today, 7, 30, 90일의 기간 성과

Area, Service, App telemetry, Quality, Finance, Selection, 전체 큐는 같은 route 안의 상세 영역으로 유지하되 기본 화면의 판단 흐름을 방해하지 않게 구성한다.

### 5. Phase 0 — 현재 상태 보존과 작업 계획

수정 전에 다음을 수행하라.

1. `git status --short`
2. 다음 파일들의 현재 diff 확인:
   - `apps/admin_web/app/partners/overview/page.tsx`
   - `apps/admin_web/app/partners/overview/partner-overview-model.ts`
   - `apps/admin_web/app/globals.css`
   - `apps/api/src/admin/admin.service.ts`
   - `apps/api/src/providers/provider-public-readiness.ts`
   - 관련 spec 파일
3. 현재 관련 구현과 호출자를 `rg`로 추적한다.
4. 감사 보고서의 스크린샷을 열어 실제 문제를 확인한다.
5. 작업 계획을 Phase 1~5로 나누되 한 번에 한 단계만 `in_progress`로 둔다.

관련 없는 dirty 파일은 건드리지 마라.

### 6. Phase 1 — P0 데이터·정책 오류 수정

#### 6.1 은행 승인을 marketplace visibility에서 제거

조사 대상:

- `apps/api/src/providers/provider-public-readiness.ts`
- `apps/api/src/providers/providers.service.ts`
- `apps/api/src/admin/admin.service.ts`
- 관련 public readiness/provider/admin tests

구현 요구:

- 승인 은행 계좌를 공개 Partner identity/discovery의 필수 조건으로 사용하지 마라.
- 고객 앱 visibility blocker에서 `Bank approval missing`을 제거하라.
- 은행 미승인은 Finance/Wallet 영역에서 `Payout bank not approved` 또는 `Withdrawal bank review pending`으로 표현하라.
- 은행 계좌가 없는 승인 Partner도 다른 공개 조건을 충족하면 marketplace에 보이게 하라.
- 은행 계좌가 없으면 payout/withdrawal 단계에서는 계속 차단돼야 한다. Earnings/withdrawal 정책을 약화시키지 마라.
- public discovery의 모든 호출자를 추적해 중앙 predicate 한 곳에서 고쳐라.
- 주소 기반 discovery 계약을 확인하라. transient GPS가 없거나 오래됐다는 이유만으로 공개 프로필을 숨기지 마라.
- 실시간 `Bookable now`에는 기존 freshness gate를 유지할 수 있다.

필수 테스트:

- 승인·KYC·필수 공개 문서·활성 서비스 조건을 충족하고 은행 계좌가 없는 Partner가 공개 조회에 포함된다.
- 같은 Partner의 payout/withdrawal은 승인 은행 계좌가 없으면 계속 차단된다.
- 음수 지갑 Partner가 marketplace visibility에서 제외되지 않는다.

#### 6.2 `Ready now` 용어 충돌 제거

현재 의미를 다음으로 고정하라.

| UI 용어 | 정의 |
|---|---|
| Online available | 상태가 `ONLINE_AVAILABLE`인 Partner |
| Bookable now | 승인·KYC·온라인 가능·활성 서비스·계정 정상·위치 freshness·지갑 정산 조건을 모두 충족 |
| Visible in customer app | 공개 프로필 조건을 충족. 은행/지갑은 visibility 게이트가 아님 |

구현 요구:

- 상단의 실제 `Ready now`를 `Bookable now`로 변경하라.
- Area/Service 표의 현재 `Ready now` 열은 `Online available`로 변경하라.
- 기존 `Eligible` 열이 실제 최종 예약 가능 predicate라면 `Bookable now`로 이름을 변경하라.
- 서로 다른 predicate에 같은 문구를 다시 사용하지 마라.
- 상단 Bookable now, 퍼널 Bookable now, Area/Service Bookable now는 동일한 predicate를 사용해야 한다.

#### 6.3 `Partner Cancellation Rate` 오인 제거

현재 `CANCELLED`, `NO_SHOW`, `EXPIRED`를 합치면서 취소 actor를 구분하지 않는다면 `Partner Cancellation Rate`라고 쓰지 마라.

가장 작은 안전한 수정:

- KPI를 `Non-completed booking rate`로 변경한다.
- detail을 `Cancelled + no-show + expired / completed + non-completed`처럼 실제 계산과 일치시킨다.
- 표의 `Cancel`도 `Non-completed` 또는 더 명확한 문구로 바꾼다.

기존 데이터에 신뢰할 수 있는 actor/reason이 이미 있다면 호출자를 추적해 Partner 귀책만 계산해도 된다. 그러나 이 작업을 위해 Prisma schema나 migration을 새로 만들지 마라.

필수 테스트:

- 데이터 정의와 화면 문구가 일치한다.
- actor를 알 수 없는 취소를 Partner 귀책으로 표현하지 않는다.

#### 6.4 Quality와 Wallet 위험을 분리

`qualityRiskFacts`에 일반 `critical/high risk`를 포함하지 마라.

Quality row의 필수 predicate:

- 높은 non-completed/cancellation 신호
- low review
- no-show report

구현 요구:

- 음수 지갑만 있는 Partner는 Quality 표에 나타나지 않게 하라.
- Quality 정렬은 no-show, low review, 높은 non-completed rate 등 품질 신호를 우선한다.
- Quality row의 `mainReason`과 `recommendedAction`도 품질 전용으로 만든다.
- `Review wallet receivable`은 Finance/Wallet 표에만 나타나야 한다.
- `riskPartnerCount`와 실제 preview rows가 같은 quality predicate를 사용해야 한다.

필수 테스트:

- Quality KPI가 모두 0이면 Quality 표도 비어 있다.
- 모든 Quality row가 적어도 하나의 품질 근거를 가진다.
- 음수 지갑만 가진 Partner는 Quality preview에서 제외된다.

#### 6.5 이벤트 분모 0 처리

- 완료 + non-completed 결과가 0건이면 completion/non-completed rate와 delta를 성과 값 0으로 표시하지 마라.
- API에서 `null` 또는 기존 모델이 지원하는 명시적 no-data 상태를 반환하라.
- UI는 `No booking outcomes in this period` 또는 `No events in this period`로 표시하라.
- current denominator가 0이면 `-100% vs previous`를 표시하지 마라.

#### 6.6 Service/Area 상태 판정 정직하게 만들기

- Eligible/Bookable 0인 서비스는 `Healthy`가 되면 안 된다.
- open + completed가 0이면 `No demand data`로 표시하고 completion 성과를 평가하지 마라.
- Partner가 0명인 지역을 `Low Supply`로 부르지 말고 `No supply` 또는 `No Partner data`로 표시하라.
- 상태와 tone이 서로 모순되지 않게 테스트하라.

### 7. Phase 2 — 시간 범위와 정보 구조 분리

현재 range 탭은 페이지 전체를 바꾸는 것처럼 보이지만 일부 값은 current snapshot이다.

구현 요구:

- 상단 scope를 `Current operations · as of {time}`와 `Performance · {selected range}`로 명확히 분리하라.
- 기간 탭은 Performance 영역에 가깝게 배치하라.
- 전역 Partner 필터는 유지하되 current snapshot 카드에는 `Current`, 기간 KPI에는 `Today/Last 7 days/...` scope를 표시하라.
- Finance에서 다음을 분리하라.
  - 기간: gross booking amount, platform fee, payout activity
  - 현재: wallet balance, negative wallet exposure, payout readiness
- Today/7d/30d/90d 변경 시 current snapshot이 유지되는 것은 버그처럼 보이지 않아야 한다.
- 갱신 시각 옆에 기존 route를 다시 여는 `Refresh now`를 제공하라.
- `refreshSeconds`를 사용하지 않을 것이라면 새 실시간 프레임워크를 만들지 말고 단순 reload 링크로 끝내라.

### 8. Phase 3 — 깨진 레이아웃과 반응형 수정

#### 8.1 Operating status 카드

원인 후보:

- `AdminOverviewCommandCard`가 기존 `.partner-overview-command-card > div { display: grid; }` 레이아웃을 제공한다.
- 운영 카드가 `baseClassName="partner-overview-operating-card"`로 공통 class를 교체하면서 내부 span/strong/small/em이 inline처럼 붙는다.

수정 요구:

- 새 카드 컴포넌트를 만들지 말고 기존 command-card class/구조를 재사용하라.
- scope, label, value, detail, action을 독립 행으로 표시하라.
- 1440, 1024, 720 모두 값과 문구가 겹치거나 붙지 않아야 한다.
- 0건 카드의 `Live/Pending/Current queue` 배지는 `No action`으로 통일하거나 제거하라.

#### 8.2 Quality/Finance와 Area/Service 폭

- Quality와 Finance를 반쪽 폭 2열로 강제하지 말고 각각 전체 폭으로 세로 배치하라.
- Area와 Service 표도 전체 폭으로 세로 배치하라.
- Finance mini KPI는 5열을 강제하지 말고 최대 3열, 좁은 화면 1~2열로 구성하라.
- 긴 VND 금액은 겹침, 잘림, ellipsis 없이 읽혀야 한다.
- 새 테이블 라이브러리를 사용하지 마라.

#### 8.3 720px CSS cascade

`partner-overview-quality-grid`의 1열 media rule이 뒤쪽 `.usage-overview-insight-grid` 2열 rule에 덮이는지 확인하라.

- Partner Overview 전용 규칙이 최종 cascade에서 이기게 하라.
- 720px에서 Quality와 Finance는 반드시 1열이다.
- 640px에서만 겨우 고쳐지는 방식은 허용하지 않는다.

#### 8.4 테이블 읽기

- Area/Service/Quality/Finance 표의 첫 Partner/Area/Service 열은 필요하면 CSS sticky로 고정한다.
- 화면 폭이 좁을 때 단어가 음절 단위로 부서지지 않게 최소 폭과 wrapping을 조정한다.
- 수평 스크롤은 허용할 수 있지만 identity와 주요 action이 동시에 사라지면 안 된다.

#### 8.5 Selection friction 축약

현재 13개 열을 기본 화면에 모두 표시하지 마라.

기본 열 권장:

- Partner
- Demand signal: views/favorites
- Bookable status와 blockers
- Response
- Conversion
- Recommended action

가격, 갤러리 수, 이미지 수, 서비스 수, 세부 rating은 `<details>` 또는 보조 문구에 넣어라.

- `Available now`와 `Not eligible now`가 같은 상태명처럼 충돌하지 않게 `Online available`과 `Not bookable`로 분리하라.
- Reason과 Action은 수평 스크롤 오른쪽 끝이 아니라 기본 viewport에서 보여야 한다.

### 9. Phase 4 — 운영 문구·큐·접근성

#### 9.1 문구 통일

다음 문구를 기준으로 사용하라.

| 현재 | 변경 |
|---|---|
| Partner Overview | Partner Operations |
| Ready now (실제 게이트) | Bookable now |
| Ready now (상태만) | Online available |
| Partner Cancellation Rate | Non-completed booking rate |
| Needs event | No events in this period |
| Inactive 7D | No operational activity in 7D |
| Inactive 7D+ (app) | App telemetry inactive 7D+ |
| Not Tracked Yet | No app telemetry recorded |
| Avg rating (service) | Lifetime Partner rating |
| Bank approval missing (visibility) | 제거하고 Finance의 Payout bank not approved로 이동 |
| Healthy with zero outcomes | No demand data / Not bookable |
| Available now + Not eligible | Online available + Not bookable |

Sidebar/Breadcrumb의 `Partner Performance`와 H1의 이름도 한 용어로 통일하라. 기존 내비게이션 영향 범위를 확인해 가장 작은 변경으로 맞춰라.

#### 9.2 App telemetry coverage

운영 `No operational activity in 7D`와 앱 `App telemetry inactive 7D+`를 별도 지표로 유지하라.

- Approved Partner 중 telemetry tracked와 untracked의 분모를 같이 표시하라.
- 예: `Telemetry coverage 12 / 1,235 approved Partners (1%)`.
- coverage가 낮으면 App Opens 0을 danger/success 성과로 해석하지 마라.
- 실제 수집되지 않은 값을 실제 0 행동처럼 표현하지 마라.

#### 9.3 Action queue

- totalCount가 0인 queue는 기본 목록에서 숨기거나 `No work` 접힘 그룹으로 이동하라.
- `Open queue` 반복 문구를 `Review {count}`처럼 바꿔라.
- Partner 공급/품질 큐와 Finance/Tax 큐를 시각적으로 구분하라.
- oldest/SLA/owner 데이터가 이미 신뢰 가능한 형태로 존재하면 표시한다.
- 데이터가 없다면 이번 작업에서 새 추정치나 하드코딩 SLA를 만들지 마라.

#### 9.4 접근성

- 반복되는 `Scrollable data table` landmark를 고유 이름으로 바꿔라.
- 예: `Area supply table`, `Service supply table`, `Booking quality risk table`, `Finance wallet risk table`, `Selection friction table`.
- section heading과 table region을 `aria-labelledby` 또는 고유 aria-label로 연결하라.
- keyboard focus가 보이고, sticky/scroll 영역도 키보드 사용이 가능해야 한다.
- 색상만으로 위험 상태를 전달하지 마라.

### 10. Phase 5 — 코드 품질과 테스트

#### 10.1 최소 변경 원칙

- 동일 predicate가 여러 곳에 복제돼 있다면 기존 canonical helper를 찾아 한 곳에서 고쳐라.
- 단일 구현을 위한 새 interface/factory/config를 만들지 마라.
- 현재 Admin 컴포넌트로 해결 가능한 것을 새 컴포넌트로 만들지 마라.
- API business logic과 Admin 표현 수정은 단계별로 분리해 검증하라.
- Prisma schema/migration, auth, payments, provider-wallet, matching, bookings, shared types는 정말 필요하지 않으면 수정하지 마라.

#### 10.2 필수 테스트

기존 테스트를 유지하고 이번에 발견된 회귀를 잡는 최소 테스트를 추가하라.

Admin Web:

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- app/partners/overview/page.spec.tsx app/partners/overview/partner-overview-model.spec.ts
```

API:

```powershell
npm.cmd run test --workspace @massage-vn/api -- src/admin/admin.service.spec.ts -t "partner overview"
```

public discovery/provider readiness를 수정했다면 해당 provider spec도 실행하라. 먼저 `rg`로 정확한 spec 파일을 찾고 관련 테스트만 실행하라.

완료 후 scope verification:

```powershell
npm.cmd run verify:scope -- -Scope api
npm.cmd run verify:scope -- -Scope admin
```

전체 수정이 끝나고 환경이 허용하면:

```powershell
npm.cmd run verify:local
```

전체 검증이 환경 문제나 시간 때문에 불가능하면 실패를 숨기지 말고 실행하지 못한 이유와 남은 위험을 최종 보고에 적어라.

### 11. 실제 브라우저 검증

코드 테스트만 통과했다고 끝내지 마라. 로그인 상태가 있는 인앱 브라우저를 사용해 직접 확인하라.

검증 URL:

- `http://localhost:3101/partners/overview`
- `http://localhost:3101/partners/overview?range=7d`
- `http://localhost:3101/partners/overview?range=30d`
- `http://localhost:3101/partners/overview?range=90d`
- `http://localhost:3101/partners/overview?range=today&walletStatus=negative`

필수 viewport:

- 1440×900
- 1024×900
- 720×900

각 viewport에서 다음을 확인하고 캡처하라.

- Operating status 카드 텍스트가 독립 행으로 읽힌다.
- `Bookable now`, `Online available`, `Visible in customer app` 정의가 충돌하지 않는다.
- Finance VND 값이 겹치거나 잘리지 않는다.
- 720에서 Quality/Finance가 1열이다.
- Area/Service identity 열이 정상적으로 읽힌다.
- Selection의 Reason/Action이 기본 viewport에서 보인다.
- 0건 KPI가 `-100%`로 오인되지 않는다.
- App telemetry coverage가 분모와 함께 보인다.
- 은행 미승인은 visibility blocker가 아니라 Finance에 있다.
- 브라우저 console error/warning을 확인한다.

스크린샷은 다음 새 폴더에 저장하라.

`C:\dev\massage-on-demand-vn\output\partner-overview-improvement-verification-YYYY-MM-DD`

기존 감사 스크린샷을 덮어쓰지 마라.

### 12. 완료 조건

다음 조건을 모두 충족하기 전에는 완료라고 말하지 마라.

- 정책 충돌이 수정됐다.
- Ready/Online/Bookable/Visible 정의가 화면과 API에서 일치한다.
- Quality와 Wallet row가 분리됐다.
- 취소 지표 문구가 실제 계산과 일치한다.
- 분모 0 KPI가 no-data로 표시된다.
- 1440/1024/720에서 카드·금액·표가 읽힌다.
- 720 Quality/Finance가 1열이다.
- Selection의 주요 action이 숨지 않는다.
- 모든 관련 focused tests가 통과한다.
- API/Admin scope verification 결과를 보고했다.
- 애플리케이션 코드 변경과 사용자 기존 변경을 구분했다.

### 13. 최종 보고 형식

최종 답변은 한국어로 다음 순서로 작성하라.

1. 구현 결과 요약
2. 변경 파일 목록과 각 파일의 역할
3. 정책·데이터 정의 변경
4. UI·문구·반응형 변경
5. 테스트 명령과 pass/fail/skipped 결과
6. 브라우저 검증 viewport·URL·스크린샷 경로
7. protected area 수정 여부
8. 보존한 기존 사용자 변경
9. 남은 위험과 후속 작업 한 가지

설명만 제공하지 말고 구현·테스트·브라우저 검증을 끝까지 수행하라.

## 복사 끝

