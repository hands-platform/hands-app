# Operations Policy 개선 구현용 Codex 마스터 프롬프트

이 문서는 저장소의 영구 지침이 아니라 **한 번의 구현 작업에 그대로 붙여 넣는 task prompt**다. `AGENTS.md`에 복사하지 말고, Codex에서 `C:\dev\massage-on-demand-vn`을 workspace로 연 다음 이 문서 전체를 실행 프롬프트로 사용한다.

---

당신은 HANDS 관리자 웹의 `Operations Policy`를 실제 1인 운영자가 안전하고 빠르게 사용할 수 있도록 개선하는 시니어 프로덕트 엔지니어다. 단순 분석이나 제안으로 끝내지 말고, 현재 코드와 실행 화면을 다시 확인한 뒤 root cause를 수정하고 테스트·1440px 화면 검증·구현 보고서까지 완료하라.

## 1. 작업 위치와 대상

```text
Workspace: C:\dev\massage-on-demand-vn
Primary route: http://localhost:3101/operations-policy
Audit report: docs/audits/operations-policy-final-reaudit-2026-08-11.md
Audit evidence: docs/audits/operations-policy-reaudit-evidence-2026-08-11/
```

함께 검증할 기존 route/state:

```text
/operations-policy
/operations-policy?edit=command.start_shift.matching_delays_sla_minutes#policy-command-start-shift-matching-delays-sla-minutes
/operations-policy?details=all
/operations-policy?details=matching
/operations-policy?details=matching&matching=supply
/operations-policy?details=matching&matching=simulation
/operations-policy?details=decisions
/operations-policy?details=decisions&decision=evidence
/operations-policy?details=audit
```

주요 코드:

```text
apps/admin_web/app/operations-policy/**
apps/admin_web/components/admin-form-controls.tsx
apps/admin_web/components/admin-data-table.tsx
apps/admin_web/app/globals.css
apps/admin_web/lib/operations-policy.ts
apps/admin_web/lib/admin-api.ts
apps/api/src/admin/admin.service.ts
apps/api/src/admin/admin.dto.ts
apps/api/src/matching/matching.policy.ts
infra/scripts/api-smoke.mjs
infra/scripts/check-operations-policy-consistency.mjs
```

## 2. 최종 목표

운영자가 다음 흐름을 한 번에 이해하고 실수 없이 완료할 수 있게 하라.

```text
주의 정책 확인
→ 현재값·권장값·실제 영향 확인
→ 한 정책 변경
→ 변경 전후·사유·적용 시점 확인
→ 감사 기록 검증
```

완료된 화면은 다음 조건을 만족해야 한다.

1. 정책 변경의 Before/After가 감사 기록에 정확히 표시된다.
2. 자동 스모크 기록과 사람의 운영 변경을 구분할 수 있다.
3. 필수 확인 문구와 오류가 항상 보인다.
4. 같은 값, 불완전한 사유, 미확인 상태에서는 저장할 수 없다.
5. 1440px에서 정책 목록을 글자 단위 줄바꿈이나 중첩 스크롤 없이 읽을 수 있다.
6. 28개 정책이 운영자의 실제 업무 영역으로 묶이고 주의 항목이 먼저 보인다.
7. `Live` 또는 `Current` 근거에는 관측 시각과 데이터 출처가 있다.
8. 실제 집행 정책과 planning 문구가 모순되지 않는다.
9. 각 route는 실제로 필요한 데이터만 조회한다.
10. 기존 정책 값, 권한, optimistic concurrency, 감사 트랜잭션과 비즈니스 집행 로직을 깨지 않는다.

## 3. 시작 전 필수 절차

1. 루트 `AGENTS.md`를 끝까지 읽고 따른다.
2. 감사 보고서를 끝까지 읽고 증거 PNG를 직접 연다.
3. `git status --short`와 관련 파일 diff를 확인한다.
4. dirty worktree는 사용자 소유다. reset, checkout, restore, clean, stash로 제거하지 않는다.
5. 현재 실행 중인 Admin Web/API의 PID, command line, 시작 시각과 Admin build ID를 기록한다.
6. 관련 테스트를 먼저 실행해 baseline을 남긴다.
7. 보고서의 line number를 그대로 믿지 말고 현재 심볼과 데이터 흐름을 다시 찾는다.
8. 기존 Vuexy 기반 Admin 디자인 시스템, Public Sans, spacing, badge, form, table, notice 컴포넌트를 재사용한다.
9. 새 UI 라이브러리, 새 상태 관리 라이브러리, 새 i18n 라이브러리, 데이터베이스 마이그레이션을 추가하지 않는다.
10. 구현 계획을 P0→P1→P2 slice로 만들고 한 번에 하나만 `in_progress`로 둔다.

## 4. 현재 확인된 사실

아래는 2026-08-11 실제 화면과 코드에서 확인된 사실이다. 구현 전에 재확인하되 증거 없이 무시하지 마라.

### 감사 계약 오류

```text
API write: metadata.before / metadata.after
Admin read: metadata.previousValue / metadata.value
Visible result: Before = -, After = -
```

- API: `apps/api/src/admin/admin.service.ts`의 operational policy audit write
- Admin: `apps/admin_web/app/operations-policy/policy-audit-rows.ts`
- 기존 Admin test fixture도 잘못된 `previousValue/value`를 사용해 오류를 놓쳤다.

### 감사 중복·자동화 오염

- 감사 표 8행 중 고유 내용은 4개뿐이고 4개가 정확히 두 번씩 반복됐다.
- `infra/scripts/api-smoke.mjs`가 정책을 테스트 값으로 바꾼 뒤 `finally`에서 복구한다.
- 두 변경 모두 `Demo Admin`, 일반 `operational_policy.update`로 표시된다.

### 변경 폼 접근성 오류

- `OperationsPolicyForm`이 `AdminFormCheckbox`에 label prop만 전달한다.
- 공유 컴포넌트는 children이 없으면 label을 `sr-only`로 숨긴다.
- 화면에는 작은 체크 마크만 있고 확인 문구가 보이지 않는다.
- 브라우저 native validation 때문에 영어 Admin 안에 한국어 오류 bubble이 섞였다.

### 정책 상태 모순

```text
Total policies: 28
enforced: true: 28
enforced: false: 0
Categories: Command center 7, Booking 5, Matching 5, Decision 11
```

화면은 Decision을 `Needs owner choice`, `planning is not enforced`로 설명하지만 실제 정의는 모두 live enforced다.

### 1440px 레이아웃 실패

- 8열 비교표에서 첫 열이 너무 좁아 정책명과 설명이 글자 단위로 줄바꿈된다.
- 모든 top-level card와 table에 max-height/overflow가 겹쳐 페이지·카드·표의 세로 스크롤이 중첩된다.
- Matching/Decision/Audit 전체 캡처에 큰 공백과 반복된 상단 레이아웃이 나타났다.

### 잘못된 집계와 정적 상태

- `savedCount`는 `updatedAt`만 세면서 `saved override(s)`라고 표시한다.
- 기본값으로 복구한 자동 변경도 override로 계산된다.
- `blockingCount`를 `control choice(s)`라고 표시해 실제 의미를 숨긴다.
- 공급 0, 신선 좌표 0, gate held 30인데도 초록색 `0 control choice(s)`가 먼저 보인다.
- `Live` 근거에는 observedAt, refresh, data source가 없다.
- 좌표가 부족하면 Demo Ho Chi Minh City를 사용하지만 production decision 경고가 충분하지 않다.

### 불필요한 로딩

- Advanced chooser는 버튼 세 개만 렌더하지만 settings를 조회한다.
- Matching policy editor와 Decision editor가 사용하지 않는 booking sample을 조회한다.
- 기본 화면은 settings, booking sample, policy audit, booking gate audit을 병렬 조회한다.

## 5. 절대 보존할 계약

다음을 제거하거나 약화하지 않는다.

- `expectedValue` 기반 optimistic concurrency
- API의 same-value update 차단
- reason 최소 길이 서버 검증
- policy value와 audit event의 단일 transaction
- System Policy 권한 guard
- 기존 policy key와 legacy key 호환성
- 기존 booking snapshot과 forward-only policy 의미
- wallet, payout, matching, booking-create의 실제 집행 로직
- 기존 audit record의 읽기 호환성
- 기존 Admin shell과 디자인 토큰

정책 기본값이나 집행 의미를 이번 UX 작업에서 임의로 바꾸지 않는다. 특히 매칭 10분, 반경 10km, 위치 90분, wallet gate, FCM routing 값을 화면 개선을 이유로 변경하지 않는다.

## 6. Slice P0-A — 감사 데이터 계약 복구

### 목표

실제 API가 쓴 audit metadata가 Admin 감사 표에 정확히 표시되고, 과거 레코드도 가능한 범위에서 호환되게 한다.

### 구현 요구

1. `operationalPolicyAuditRows`가 우선 `metadata.before`, `metadata.after`를 읽도록 수정한다.
2. 과거 호환이 필요하면 `before ?? previousValue`, `after ?? value` 순서로 fallback한다.
3. enforced, reason, effectiveAt, actor, key도 실제 API write schema와 대조한다.
4. API가 생성하는 metadata 객체와 동일한 shape를 Admin row builder에 넣는 계약 테스트를 추가한다.
5. 과거 legacy fixture test는 별도 compatibility test로 분리한다.
6. 값이 실제로 없는 경우에만 `-`를 표시한다.
7. audit row key는 기존 고유 audit ID를 유지한다. 내용이 같다는 이유로 정상 운영 변경을 임의 dedupe하지 않는다.

### 자동 스모크 분리

스모크 변경·복구를 화면에서 단순히 문자열 dedupe하여 숨기지 마라. root cause를 해결하라.

우선순위:

1. 스모크가 별도 test/local DB 또는 별도 automation actor를 사용하도록 한다.
2. 같은 DB를 사용해야 한다면 server-trusted audit metadata에 다음을 기록한다.
   - `source: operator | automated_smoke`
   - `environment`
   - `runId`
   - `restoration: boolean`
3. 운영 Audit 기본 목록은 human operator 변경을 우선하고 자동화 기록은 명시적 필터에서만 보여 준다.
4. 브라우저가 임의 `source=operator`를 보내 감사 출처를 속일 수 있는 계약을 만들지 않는다.
5. production에서 자동화 출처를 신뢰하려면 전용 service identity, 서버 내부 경로 또는 production에서 거부되는 검증된 automation header 등 기존 인증 구조에 맞는 신뢰 경계를 사용한다.
6. schema migration 없이 JSON metadata로 해결 가능한 범위를 먼저 선택한다.

### 완료 기준

- API metadata의 A→B가 Admin 표에 A와 B로 표시된다.
- B→A 복구도 정확한 별도 행으로 보인다.
- 자동 스모크는 사람의 변경처럼 표시되지 않는다.
- 최신 8개 일반 운영 변경이 자동 smoke 쌍으로 가득 차지 않는다.

## 7. Slice P0-B — 변경 폼을 실제로 사용할 수 있게 수정

### 확인 체크

1. 체크박스 문구를 visible children으로 렌더링하거나 공유 컴포넌트에 명시적 visible-label 계약을 추가한다.
2. 이 페이지 한 곳만 고치면 충분하면 shared component 전체 동작을 바꾸지 않는다.
3. shared component를 바꾸면 모든 caller를 검색하고 회귀 테스트를 추가한다.
4. 체크 마크와 문구 전체가 하나의 label click target이어야 한다.
5. Tab, Space, focus-visible과 screen reader accessible name을 확인한다.

### 저장 상태

Save는 다음 조건을 모두 만족할 때만 활성화한다.

```text
newValue is valid
newValue differs from expected/current value
reason length is 12..500 after whitespace normalization
confirmation is checked
not submitting
```

요구사항:

- 같은 값이면 `Current value와 같습니다`를 즉시 표시한다.
- submit 중 중복 클릭을 차단한다.
- reason에 `maxLength=500`, 글자 수, 12자 최소 안내를 표시한다.
- 브라우저 native validation bubble에 의존하지 않고 동일 언어의 inline error를 제공한다.
- 오류는 `aria-invalid`, `aria-describedby`로 연결한다.
- submit 실패 시 입력값을 보존한다.
- 첫 오류 또는 error summary로 합리적으로 focus를 이동한다.

### 정확한 오류 문구

최소한 다음을 구분한다.

- 같은 값
- 허용 범위 밖
- 사유 12자 미만
- 사유 500자 초과
- 확인 누락
- 다른 운영자가 먼저 변경한 conflict
- 권한 부족
- API/network failure

`The API rejected this policy update` 하나로 합치지 않는다. raw stack, endpoint, internal exception은 노출하지 않는다.

### 적용 시점과 승인 문구

- 예약 적용 기능이 현재 없다면 페이지 설명을 정확히 `Saved changes take effect immediately unless a service restart is required.`에 맞는 운영자 문구로 바꾼다.
- 실제 선택 기능이 없는 `Additional approval: Not required` 행을 반복 표시하지 않는다.
- 새 scheduler, approval table, maker/checker workflow를 임의로 만들지 않는다.
- 높은 위험 정책에는 현재 계약 안에서 명시적 확인 문구를 강화할 수 있지만, 별도 승인자가 필요한 제품 결정은 구현하지 말고 남은 위험으로 기록한다.

### 성공 상태

저장 성공 후 최소 다음을 보여 준다.

```text
Policy
Before → After
Changed by
Effective at
Reason
Open audit record
```

실제 운영 데이터 mutation으로 브라우저 QA하지 말고 unit/integration fixture로 검증한다.

## 8. Slice P1-A — 1440px 정책 목록 재구성

8열 giant table을 유지하면서 CSS 폭만 늘리는 임시 처방을 하지 않는다. 운영자의 찾기→비교→변경 과업에 맞게 구조를 줄인다.

### 권장 그룹

```text
Shift & Queue SLA — 7
Booking Safety — 5
Matching & Availability — 7
Money & Settlement — 3
Exceptions & Evidence — 5
Notification Routing — 1
```

기존 API category를 바꿔야만 그룹화되는 것은 아니다. UI view model에서 운영자 그룹을 만들되 policy key 기반 매핑을 한곳에 두고 누락 테스트를 작성한다.

모든 28개 key는 정확히 한 그룹에 포함되어야 하며 중복·누락 시 테스트가 실패해야 한다.

### 목록 구조

기본 목록의 핵심 열:

```text
Policy
Current value
Status
Last changed
Action
```

- Recommended value는 현재와 다를 때만 차이 배지나 상세 영역으로 표시한다.
- 긴 description, operating impact, actor detail은 row expansion 또는 우측 상세 패널로 이동한다.
- policy 이름은 단어 단위로 읽혀야 하며 문자 단위로 쪼개지면 안 된다.
- ID와 raw key는 기본 행에 노출하지 않는다.
- 그룹 헤더에 All, Needs review, Changed 수를 표시한다.
- 기본적으로 needs review가 있는 그룹을 먼저 펼친다.

### 필터

최소 다음을 제공한다.

- 검색: label과 description
- 상태: Needs review / Changed / All
- 운영 그룹
- Live/Planned/Deprecated — 실제 데이터에 존재하는 상태만
- 모두 초기화

검색·필터는 URL로 공유할 필요가 있을 때만 query를 사용한다. 변경 폼의 reason/value를 URL에 넣지 않는다.

### 변경 패널

- 목록 위치를 잃지 않도록 우측 drawer 또는 목록 바로 옆 focused panel을 사용한다.
- 기존 deep link `?edit=<key>#<anchor>`는 깨지지 않게 호환한다.
- drawer를 쓰면 focus trap, Escape/Close, focus return을 구현한다.
- 기존 디자인 시스템에 drawer 패턴이 없다면 과도한 새 abstraction을 만들지 말고 focused inline panel을 사용한다.

## 9. Slice P1-B — 스크롤과 고급 워크스페이스 정리

### 스크롤 계약

- 페이지 세로 스크롤을 하나만 유지한다.
- `.operations-policy-page > .card`의 전역 max-height/overflow 적용을 제거하거나 필요한 section에만 좁게 적용한다.
- card 안의 card와 table에 세로 스크롤을 반복하지 않는다.
- 표가 길 때만 제한된 table scroll을 쓰고 sticky header와 명확한 scroll boundary를 제공한다.
- 화면 캡처를 통과시키기 위한 CSS hack이나 screenshot 전용 분기를 만들지 않는다.

### 고급 navigation

- `details=all`이 세 버튼만 보여 주는 빈 중간 화면으로 남지 않게 한다.
- 권장 top-level tabs:

```text
Policies
Supply
Simulation
Audit
```

- `details=all` 기존 URL은 안전하게 Policies 또는 마지막으로 합리적인 workspace로 정규화/redirect한다.
- 기존 Matching/Decision/Audit deep link는 깨지지 않게 호환한다.
- Matching의 Policy editor는 단순히 giant comparison으로 돌아가는 링크가 아니라 Matching & Availability 그룹을 직접 보여 줘야 한다.
- 현재 11개 Decision 정책이 모두 enforced라면 Decision을 planning backlog처럼 유지하지 않는다. 실제 집행 그룹으로 재배치한다.
- 정말 planning 데이터가 생기기 전까지 `items marked planning are not enforced` 같은 정적 문구를 제거한다.

### 정보 밀도

- 0건 시뮬레이션 표를 여러 행의 0으로 렌더하지 않는다.
- 표본이 부족하면 prerequisites와 다음 행동이 있는 empty state를 먼저 보여 준다.
- API touchpoint와 service class 이름은 기본 운영 화면에서 숨기고 `Developer details` disclosure 또는 System Health 영역으로 이동한다.
- 제품 전략 문서처럼 긴 Owner decision backlog는 live policy 화면에서 제거하거나 실제 정책과 근거만 남기도록 축약한다.

## 10. Slice P1-C — 상태·집계·데이터 신뢰성

### 상태 단일 권위

- UI 제목과 배지는 실제 `setting.enforced`와 명시적 lifecycle status에서 파생한다.
- category가 `Decision`이라는 이유로 planning이라고 가정하지 않는다.
- 현재 28개가 모두 enforced이면 `Needs owner choice` 대신 `Live high-impact policies`와 같은 정확한 표현을 사용한다.
- Deprecated compatibility option은 선택 가능 정책처럼 강조하지 말고 호환성 정보로 낮춘다.

### 집계 이름

- `saved override(s)`는 `updatedAt` 개수가 아니다.
- 현재값과 권장/기준값이 다를 때만 `Current deviations`로 계산한다.
- `Changed at least once`, `Current deviations`, `Needs review`를 분리한다.
- `0 control choice(s)`는 `0 policy deviations` 또는 `All launch baselines aligned`처럼 실제 의미로 바꾼다.
- 정책 정합성과 공급 준비 상태를 같은 success badge로 합치지 않는다.

### Live evidence

- Supply/Simulation snapshot에 `observedAt`을 표시한다.
- 수동 `Refresh evidence`와 loading/error/old snapshot 상태를 제공한다.
- 자동 polling은 반드시 필요성이 증명될 때만 추가한다. 1인 운영 MVP에서는 수동 refresh를 우선한다.
- Demo/fallback coordinate를 쓰면 화면 상단에 `Demo reference — do not use for production policy decisions` 경고를 표시한다.
- production evidence와 smoke/demo fixture를 구분하고 표본 기간, booking 수, provider 수, 좌표 보유 수를 명시한다.
- usable supply가 0이면 화면 최상단 status는 success가 아니라 명확한 blocking warning이어야 한다.
- 경고에는 실제 작업 route를 연결한다: Partner location, Push devices, KYC, Cash settlement 등 기존 route를 재사용한다.

## 11. Slice P1-D — route별 데이터 로딩 최적화

`buildOperationsPolicyLoadPlan`을 실제 renderer와 맞춘다.

목표 예산:

| Route/state | 허용 조회 |
|---|---|
| Advanced chooser가 남는 경우 | access 외 업무 데이터 0건 |
| Policies/summary | settings + 필요한 compact attention summary |
| Matching policy editor | settings만 |
| Decision/high-impact policy editor | settings만 |
| Supply evidence | settings + bounded bookings/providers |
| Simulation | settings + bounded bookings/providers |
| Audit | settings + policy audit |

구현 요구:

- `settingsHref`도 필요할 때만 존재하도록 load plan을 명시적으로 만든다.
- Matching editor와 Decision editor가 bookings를 조회하지 않게 한다.
- policy audit과 booking gate audit을 한 화면에서 모두 쓰지 않으면 가져오지 않는다.
- 현재 `Promise.all` 병렬성은 유지한다.
- 새로운 거대한 BFF endpoint를 만들기 전에 기존 list/summary 결과를 재사용한다.
- route load plan test에서 href와 null 여부를 정확히 검증한다.
- DOM과 network 양쪽에서 활성 workspace 외 데이터가 로드되지 않는지 확인한다.

## 12. Slice P2 — 문구와 세부 완성도

### 복수형

다음을 사용자 화면에 남기지 않는다.

```text
5 enforced policy
6 saved override(s)
1 item(s)
10 minute(s)
0 partner(s)
1 booking(s)
```

기존 copy/format helper를 먼저 찾는다. 새 i18n 의존성 없이 공통 plural helper 또는 현재 프로젝트 패턴으로 `1 item`, `2 items`를 처리한다.

### 운영자 문구

- `Policy comparison` → `Operating policies` 또는 기존 Admin 용어와 맞는 명칭
- `Open change` → `Review change`
- `Decision record` → 실제 집행 상태에 맞는 `Live policy` 또는 `Planned decision`
- `Saved override` → `Current deviation` 또는 `Changed before`
- `control choice` → `policy deviation`
- `Evidence workspace` → `Read-only evidence`
- `API touchpoint`, `Server owner` → Developer details로 이동

영어를 유지하되 browser-native Korean validation이 섞이지 않게 앱 오류를 직접 렌더링한다. 이번 작업에서 전체 다국어 시스템을 새로 만들지 않는다.

### 시각 기준

- 기존 Admin surface, shadow, radius, typography를 유지한다.
- 거대한 hero, gradient, 새 색상 체계, 과도한 animation, 장식용 KPI 카드를 추가하지 않는다.
- danger는 실제 즉시 차단에만 사용하고, deviation은 warning, aligned는 neutral/success로 구분한다.
- 색상만으로 상태를 전달하지 않는다.
- 1440px의 정보 밀도와 scanability를 우선한다.

## 13. 화면 크기와 검증 범위

- 주 검증 viewport: **1440 x 1000**
- 보조 검증 viewport: **1680 x 1050 이상**
- 1024px 이하 화면의 재설계·보고·점수 산정은 이번 작업 범위에서 제외한다.
- 단, 변경으로 기존 작은 화면 CSS를 의도적으로 삭제하거나 전역 레이아웃을 깨지 않는다.
- 1440px에서 첫 viewport에 페이지 목적, 주의 상태, 검색/필터, 첫 정책 그룹이 보여야 한다.
- 정책명, 설명, ID, enum이 문자 단위로 줄바꿈되면 실패다.
- 중첩된 세로 스크롤이 존재하면 실패다.

## 14. 오류·빈 상태·경계 조건

최소 다음 상태를 구현 또는 검증한다.

```text
settings loaded + rows
settings genuine empty
settings load failure
audit genuine empty
audit load failure
no deviations
one deviation
no supply data
demo coordinate fallback
stale evidence snapshot
save validation error
save conflict
save permission error
save network/API error
save success
```

- API failure를 `0 policies`, `No audit`, `All aligned`로 표시하지 않는다.
- section failure는 다른 정상 section을 지우지 않는다.
- retry가 가능한 오류에는 Retry를 제공한다.
- 긴 label, 500자 reason, 큰 숫자, 28개 이상 정책, 0건, 1건, 복수형을 테스트한다.

## 15. 테스트 요구

### Admin Web

최소 다음을 추가하거나 보강한다.

1. 실제 API `before/after` audit metadata contract
2. legacy `previousValue/value` fallback이 필요하면 compatibility test
3. visible checkbox label — `sr-only`가 아닌 화면 텍스트
4. same value일 때 Save disabled
5. valid changed value + 12..500 reason + confirm일 때 Save enabled
6. submit 중 double-submit 차단
7. conflict/permission/range/network별 오류 문구
8. 모든 28개 policy key의 UI group 누락·중복 방지
9. current deviation 계산이 `updatedAt`이 아니라 값 비교를 사용하는지
10. enforced 상태와 UI copy/badge 정합성
11. route별 load plan과 불필요 href null 여부
12. `details=all`과 기존 deep link compatibility
13. 0/1/복수형 문구
14. 1440 전용 class/구조 회귀 — 8열 giant table과 top-level nested scroll이 돌아오지 않게 함

### API/infra

1. operational policy update audit metadata schema
2. same-value, stale expectedValue, reason 11/12/500/501 경계
3. smoke source/environment/runId/restoration 분리 계약
4. 일반 브라우저 요청이 audit source를 임의 spoof하지 못하는지
5. 기존 policy value validation과 transaction 회귀
6. policy/Admin key consistency

### 필수 명령

현재 package scripts를 확인하고 정확한 명령으로 실행한다. 최소 범위:

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- app/operations-policy
npm.cmd run test --workspace @massage-vn/api -- src/admin/admin.service.spec.ts
npm.cmd run policy:admin-consistency
npm.cmd run admin:visible-copy
npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run typecheck --workspace @massage-vn/api
```

관련 slice가 모두 끝난 뒤:

```powershell
npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api
```

UI 변경 완료 후 Impeccable detector를 변경한 UI 파일에 정확히 한 번 실행하고 결과를 검토한다. detector 결과를 무조건 고치지 말고 이번 화면과 관련된 실제 문제인지 판단한다.

## 16. 실제 화면 검증

1. 로그인된 기존 in-app browser 세션을 사용한다.
2. 서버를 재시작해야 하면 정확한 해당 PID만 확인해서 처리한다. 다른 프로젝트나 사용자 프로세스를 종료하지 않는다.
3. before/after는 같은 viewport, 같은 데이터 상태, 같은 build ID로 캡처한다.
4. screenshot만 보지 말고 DOM label, link href, `aria-current`, disabled state, focus 순서, visible error text, table/region accessible name을 확인한다.
5. 실제 운영 정책 Save를 제출하지 않는다. mutation 검증은 test fixture와 API unit/integration test로 수행한다.
6. 다음 화면을 1440 x 1000으로 캡처한다.

```text
Policies default + attention summary
Search/filter applied
One policy change panel — invalid state
One policy change panel — valid but not submitted
Supply no-data/blocking state
Simulation evidence state
Audit human-operator default view
Audit automated-smoke filter view
API failure or controlled error state
```

7. 확인 항목:
   - 글자 단위 줄바꿈 없음
   - top-level nested vertical scroll 없음
   - 필수 확인 문구 visible
   - Save disabled/enabled 전환 정상
   - audit Before/After 표시
   - automated smoke 구분
   - observedAt와 Refresh 표시
   - demo coordinate warning 표시
   - 공급 0이 success로 보이지 않음

## 17. 수용 기준

- [ ] 감사 Before/After가 실제 API metadata에서 정확히 보인다.
- [ ] 과거 audit 호환성을 필요한 범위에서 유지한다.
- [ ] 자동 스모크와 사람의 운영 변경이 구분된다.
- [ ] 필수 확인 문구가 시각적으로 보이고 키보드로 조작된다.
- [ ] 같은 값·잘못된 범위·사유 미완성·미확인 상태에서는 저장할 수 없다.
- [ ] reason 12..500 제한과 inline error가 있다.
- [ ] conflict, permission, API failure를 구분한다.
- [ ] 1440px 정책 목록에 문자 단위 줄바꿈과 8열 과밀이 없다.
- [ ] 모든 28개 정책이 정확히 한 운영 그룹에 포함된다.
- [ ] current deviation과 changed-before 집계가 분리된다.
- [ ] enforced 상태와 planning/live 문구가 모순되지 않는다.
- [ ] 페이지 세로 스크롤이 하나다.
- [ ] `details=all` 빈 chooser가 제거되거나 의미 있는 기본 workspace로 정규화된다.
- [ ] Supply/Simulation에 observedAt, Refresh, source/sample provenance가 있다.
- [ ] demo fallback과 no-supply가 명확한 warning으로 보인다.
- [ ] editor와 chooser가 불필요한 booking/settings 요청을 하지 않는다.
- [ ] 개발자 API/service 명칭이 기본 운영 화면을 지배하지 않는다.
- [ ] `(s)`와 잘못된 단·복수형이 없다.
- [ ] focused tests, typecheck, policy consistency, admin/api scope 검증 결과가 기록된다.
- [ ] 실제 운영 정책 mutation 없이 브라우저 검증을 마친다.

## 18. 금지 사항

- 감사 Before/After 오류를 CSS나 표시 문자열로만 가리지 않는다.
- 자동 smoke 중복을 정상 운영 audit까지 내용 기반 dedupe하는 방식으로 해결하지 않는다.
- 클라이언트가 audit source를 자유롭게 지정하게 하지 않는다.
- 정책 기본값이나 enforcement 비즈니스 의미를 UX 개선 명목으로 바꾸지 않는다.
- 8열 표를 유지한 채 전체 폭만 크게 늘리는 것으로 완료하지 않는다.
- 모든 카드에 max-height/overflow를 다시 적용하지 않는다.
- `adminGet(..., [])` fallback으로 API failure를 정상 empty처럼 숨기지 않는다.
- 새로운 범용 form framework, table framework, state library를 만들지 않는다.
- DB migration, 새 package, 전역 CSS 재작성, Admin 전면 리팩터링을 하지 않는다.
- 무관한 파일을 포맷하거나 기존 사용자 변경을 덮어쓰지 않는다.
- 실제 정책 Save, 결제, 지갑, 부킹 상태 mutation으로 UI QA하지 않는다.
- 1024px 이하 화면 개선에 시간을 쓰거나 최종 보고서에 모바일 평가를 넣지 않는다.
- 테스트 통과만으로 UX 완료를 선언하지 않는다.

## 19. 중단 조건

다음 경우에만 멈추고 정확한 blocker와 선택지를 보고한다.

- audit source를 신뢰성 있게 구분하려면 인증 모델 변경이 필요함
- schema migration이 실제로 필요함
- 기존 dirty change와 같은 줄을 안전하게 병합할 수 없음
- 실제 운영 정책 mutation 없이는 검증할 수 없는 요구가 있음
- 로그인이 필요함
- 정책의 제품 의미를 코드·보고서·테스트에서 결정할 수 없음

작업이 크거나 테스트가 느리다는 이유로 중단하지 않는다. 안전한 범위에서 slice를 순서대로 완료한다.

## 20. 산출물

작업 완료 후 다음을 남긴다.

```text
수정된 코드와 테스트
docs/audits/operations-policy-remediation-evidence-2026-08-11/*.png
docs/audits/operations-policy-remediation-report-2026-08-11.md
```

구현 보고서에는 다음을 포함한다.

1. 운영자가 더 안전하고 빠르게 할 수 있게 된 결과
2. P0/P1/P2별 완료·미완료 상태
3. root cause와 수정 방식
4. 변경 파일
5. 실제 audit metadata 계약과 smoke 출처 처리
6. route별 API 호출 전후
7. 실행 명령과 PASS/FAIL/SKIPPED
8. build ID와 1440px browser evidence
9. 수용 기준 PASS/FAIL/NOT VERIFIED 표
10. protected area 접촉 여부
11. dependency와 migration 여부
12. 남은 위험과 다음 단 하나의 작업

최종 응답은 파일 목록보다 운영자 결과를 먼저 설명한다. 테스트 실패나 미검증 항목을 숨기지 않는다.

지금 즉시 `git status --short`, `AGENTS.md`, 감사 보고서, 증거 이미지, 현재 관련 diff, baseline tests 확인부터 시작하라. 별도 blocker가 없으면 Slice P0-A부터 구현하고 모든 slice를 순서대로 완료하라.
