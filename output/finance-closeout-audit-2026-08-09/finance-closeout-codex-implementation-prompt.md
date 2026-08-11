# Finance Closeout 개선 구현용 Codex 프롬프트

아래 `START OF PROMPT`부터 `END OF PROMPT`까지 새 Codex 작업에 그대로 붙여 넣어 사용한다. 이 프롬프트는 단순 시안 제안이 아니라 코드 수정, 화면 검증, 테스트, 결과 보고까지 완료하도록 작성되었다.

---

## START OF PROMPT

당신은 HANDS 관리자 웹의 재무 운영 안전성과 운영자 UX를 개선하는 시니어 풀스택 엔지니어다. 다음 감사 보고서를 구현 기준으로 사용하여 `Finance Closeout / Settlement Repair`를 실제 운영자가 신뢰할 수 있는 도구로 수정하라.

이번 작업의 최종 목표는 “화면을 더 예쁘게 만드는 것”이 아니다. 운영자가 다음 질문에 빠르고 정확하게 답하고, 잘못된 정산 복구를 방지하며, 수행 결과를 감사 증거로 남길 수 있어야 한다.

1. 지금 반드시 처리해야 할 정산 누락은 무엇인가?
2. 어떤 건은 바로 복구 가능하고 어떤 건은 정책 검토 또는 증빙 보완이 필요한가?
3. 화면에 보이는 0건, Clear, Ready를 실제로 신뢰해도 되는가?
4. 복구 실행 전 무엇이 변경되는가?
5. 실행 후 어떤 snapshot, journal, clearing, audit 기록이 만들어졌는가?

### 1. 작업 위치와 필수 자료

- 저장소: `C:\dev\massage-on-demand-vn`
- 관리자 웹: `apps/admin_web`
- API: `apps/api`
- 대상 URL: `http://localhost:3101/finance-closeout`
- 감사 보고서: `output/finance-closeout-audit-2026-08-09/finance-closeout-deep-audit-report.md`
- 화면 증거: `output/finance-closeout-audit-2026-08-09/*.png`

작업 시작 시 다음을 순서대로 수행하라.

1. 저장소 루트의 `AGENTS.md`를 읽고 모든 규칙을 지킨다.
2. 감사 보고서를 처음부터 끝까지 읽는다.
3. `git status`, 관련 diff, 기존 테스트를 확인하여 사용자의 미완료 변경을 보존한다.
4. 아래 파일만 보지 말고 호출 관계와 기존 공용 패턴을 함께 조사한다.
   - `apps/admin_web/app/finance-closeout/page.tsx`
   - `apps/admin_web/app/finance-closeout/**`
   - `apps/admin_web/lib/finance-closeout.ts`
   - `apps/admin_web/lib/admin-api.ts`
   - `apps/admin_web/components/admin-surface.tsx`
   - `apps/api/src/admin/admin.service.ts`
   - `apps/api/src/admin/admin.controller.ts`
   - `apps/api/src/admin/admin.dto.ts`
   - 관련 Admin Web/API spec 파일
5. `impeccable` 스킬을 사용할 수 있으면 기존 디자인 시스템을 보존하는 좁은 `harden`, `distill`, `clarify`, `optimize` 작업으로 사용한다. 새로운 시각 언어 또는 별도 디자인 시스템을 만들지 않는다.
6. 구현 전에 짧은 작업 계획과 변경 예상 파일을 작성한 뒤, 사용자의 추가 승인을 기다리지 말고 구현과 검증까지 진행한다. 단, 데이터베이스 migration, 실제 금융 write, 파괴적 명령이 필요하면 해당 부분만 멈추고 이유와 대안을 보고한다.

### 2. 절대 지켜야 할 경계

- 실제 정산 복구, 승인, 지급, wallet 변경 등 금융 mutation을 브라우저에서 실행하지 않는다.
- production 데이터나 API 응답을 화면용 임시 값, hardcoded count, fixture로 대체하지 않는다.
- API 실패, 권한 오류, timeout을 빈 배열이나 0건으로 바꾸지 않는다.
- `technical eligibility`와 `policy approval`을 같은 의미로 취급하지 않는다.
- 정책상 허용되지 않은 override 또는 승인 경로를 새로 발명하지 않는다.
- 기존 API 계약을 깨지 않는다. 필요한 필드는 가급적 additive하게 추가하고 기존 호출자의 호환성을 확인한다.
- 고객/파트너 정산 금액, journal 계산, 세금·수수료 규칙을 UI 편의를 위해 변경하지 않는다.
- 사용자 문구에는 `Provider`가 아니라 `Partner`를 사용한다.
- 기존 디자인 토큰, 공용 컴포넌트, 표·필터·상태 패턴을 재사용한다.
- 새로운 UI 라이브러리나 불필요한 dependency를 추가하지 않는다.
- 관련 없는 대규모 refactor를 하지 않는다.
- 사용자가 지정한 운영 환경은 1440px 이상 desktop이다. 1440px 이상을 집중 검증하고 1024px 이하 또는 모바일 대응은 이번 작업의 범위와 보고서에 넣지 않는다. 단, 기존 반응형 동작을 고의로 파괴하지는 않는다.
- 관리자에게 내부 exception code, raw enum, raw database ID만 보여 주지 않는다. 사람이 이해할 수 있는 문구를 먼저 표시하고 기술 값은 보조 정보나 복사 기능으로 제공한다.

### 3. 구현 우선순위

아래 순서를 바꾸지 말라. P0/P1이 완료되지 않은 상태에서 시각적 polish만 수행하지 않는다.

## Phase A — P0: false-clear를 완전히 제거한다

현재 `adminGet` 및 page fallback 때문에 API 장애, 인증 만료, timeout, 5xx가 `0`, 빈 큐, `Clear`, `Ready`로 보일 수 있다. 이를 fail-closed 방식으로 수정한다.

요구사항:

1. Finance Closeout의 모든 필수 source는 `data`와 함께 다음 상태를 보존해야 한다.
   - `ok`
   - HTTP/status 또는 오류 유형
   - source 이름
   - `generatedAt` 또는 마지막 성공/갱신 시각
2. `adminGetResult` 또는 동일한 오류 보존 패턴을 사용한다. 실패 응답을 fallback data만 반환하는 형태로 축소하지 않는다.
3. 하나 이상의 필수 source가 실패하면 다음 규칙을 적용한다.
   - 0건, Clear, Ready를 계산하거나 표시하지 않는다.
   - `Data unavailable — do not close or repair`의 명확한 차단 상태를 보여 준다.
   - 실패한 source, 오류 유형, 성공한 source 수, 마지막 갱신 시각을 표시한다.
   - 안전한 `Retry`를 제공한다.
   - closeout/repair 관련 primary action을 잠근다.
4. 일부 source만 성공한 경우 `5 of 7 sources loaded`처럼 partial data임을 표시한다.
5. 개별 widget 오류가 전체 페이지를 blank로 만들 필요는 없지만, 불완전한 데이터로 운영 완료 판단을 내리지 못하게 한다.
6. `0건`, `Clear`, `Ready`는 모든 required source가 성공한 경우에만 렌더링한다.

필수 회귀 테스트:

- 모든 source 실패 시 0/Clear/Ready가 렌더링되지 않는다.
- 단일 source 실패 시 partial-data 경고와 action lock이 보인다.
- 401/403/429/500/timeout을 정상 empty state와 구분한다.
- 진짜 성공 응답의 0건은 정상 empty state로 표시된다.

## Phase B — P1: 정책 판정을 하나의 권위 있는 계약으로 통일한다

현재 batch dry-run은 66건에 `PAYMENT_FEE_POLICY_DEFAULTED` 정책 검토를 요구하지만 selected comparison과 repair drawer는 `Eligible / Full preview passed`로 표시한다. 이 불일치를 제거한다.

요구사항:

1. preview 응답이 최소한 다음 의미를 구분하도록 한다. 기존 명칭과 타입 체계가 있으면 그것을 재사용하고 additive하게 확장한다.
   - `technicalEligibility`: 계산·증빙 구조상 복구 가능한가
   - `policyDecision`: `APPROVED`, `REVIEW_REQUIRED`, `BLOCKED` 또는 기존 동등 enum
   - 사람이 읽는 `policyReasons`
   - 필요 시 `policyVersion`과 exception code
2. 이 판정을 다음 모든 위치에서 동일하게 사용한다.
   - batch dry-run summary
   - prepared batch
   - selected settlement comparison
   - individual repair drawer
   - submit validation
   - repair 결과/audit metadata
3. `technicalEligibility=true`이고 `policyDecision=REVIEW_REQUIRED`이면 `Eligible` 또는 `Full preview passed` 단독 표현을 금지한다.
4. 기본 표시 문구는 다음 형태로 통일한다.
   - `Technically valid · Policy review required`
   - 설명: `Payment-fee policy could not be matched. Expected fee is currently 0 VND; review before repair.`
5. 정책 검토가 완료되지 않았으면 repair primary action을 기본적으로 차단한다.
6. 기존 도메인 규칙이 명시적으로 exception approval을 허용할 때만 별도 승인 근거를 받는다. 이 경우 다음을 audit metadata에 남긴다.
   - 승인자
   - 검토 근거
   - policy version
   - exception code
   - 시각
7. 기존 도메인에 override 정책이 없다면 임의로 만들지 말고 차단 상태와 올바른 다음 경로를 제공한다.

필수 회귀 테스트:

- `REVIEW_REQUIRED`가 batch → comparison → drawer → submit까지 사라지지 않는다.
- technical eligibility와 policy decision 조합별 표시와 action 상태가 정확하다.
- 서버 submit 단계에서도 stale 또는 누락된 policy approval을 거절한다.

## Phase C — P1: Closeout 집계의 범위와 정확성을 보장한다

현재 operations view는 all-time과 today를 섞고 최대 10건 목록 길이를 전체 count처럼 사용할 수 있다. 정확한 aggregate 계약으로 교체한다.

요구사항:

1. closeout/handoff 전용 aggregate endpoint 또는 기존 동등 endpoint를 사용하여 각 gate를 동일한 Vietnam-time cutoff 기준으로 집계한다.
2. 각 gate는 최소한 다음 값을 제공한다.
   - `status`
   - `count`
   - `amount`
   - `oldestAt`
   - `scope`
   - `sourceStatus`
   - `generatedAt`
   - 가능한 경우 `owner`와 `nextAction`
3. detail array의 길이 또는 `take=10` 응답으로 전체 total을 계산하지 않는다.
4. `Today`와 `All-time unresolved`를 섞지 않는다. API 한계로 all-time만 가능한 값은 별도 scope로 명시한다.
5. list와 summary는 동일한 `period`, `paymentMethod`, `q` 및 적용 가능한 필터 범위를 사용한다.
6. 화면에는 `Last refreshed HH:mm ICT`와 명시적인 refresh action을 제공한다.
7. drawer를 연 뒤 source version이 바뀌면 stale preview를 거절하고 재검토를 요구한다.

## Phase D — P1: 정보구조를 업무 단위로 정리한다

최종 정보구조는 다음을 목표로 한다.

### `/finance-closeout` 기본 화면: Settlement Repair

1. 헤더
   - 제목: `Settlement Repair`
   - 설명: `Find missing settlement records, verify evidence, and repair them safely.`
   - `Last refreshed`, `Refresh`, `Audit trail`
2. 단일 요약 strip
   - `Backlog`
   - `Actionable`
   - `Blocked`
   - `Oldest gap`
3. primary queue
   - `Actionable`
   - `Blocked`
   - `Manual review`
4. repair mode는 equal-weight page tab이 아니라 filter/column으로 제공한다.
   - `Standard reconstruction`
   - `Paid-record reconstruction`
5. 필터
   - `Gap age`
   - `Month`
   - `Payment method`
   - `Owner`
   - `Booking, customer, or partner search`
6. 표
   - priority
   - 축약 booking ID + copy
   - 서비스/도시 또는 운영 맥락
   - 고객/파트너
   - amount/payment method
   - completed time와 gap age/SLA
   - repair mode
   - policy/blocker
   - owner
   - next action
7. 1440px 이상에서 핵심 판단 열이 한 화면에 들어오도록 한다.
8. sticky header와 필요한 경우 sticky action column을 사용한다.

### Batch diagnostics

- Settlement Repair의 secondary view로 유지한다.
- `Historical settlement dry-run` 대신 `Batch safety check (read-only)`를 사용한다.
- 실행 버튼은 `Run safety check`로 바꾼다.
- 최상단에는 하나의 authoritative decision banner만 둔다.
  - `Ready for individual approval`
  - 또는 `Policy review required — repair is paused`
- 기술 batch key보다 `June 2026 · Cash · 10 records`처럼 운영 문맥을 먼저 표시한다.
- comparison 행에도 동일 policy decision을 반드시 전달한다.

### 기존 Operations closeout 호환 화면

- `Settlement Repair`와 동급 탭으로 계속 노출하지 않는다.
- 유효한 closeout gate는 `Operations Handoff`의 finance handoff 영역으로 통합한다.
- 기존 `?view=operations` URL은 링크 호환성을 위해 새 위치로 redirect하거나 명확한 migration notice를 제공한다.
- redirect 대상과 anchor는 실제 기존 라우트 구조를 조사하여 결정하고 테스트한다.
- 같은 상태를 task board, checklist, action map, payout checks로 반복하지 않는다.
- 하나의 gate list만 사용하며 기본값은 `Open / Blocked only`다.
- 모든 항목이 정상일 때는 `6 checks clear` 한 줄과 `Show cleared checks` disclosure만 보여 준다.
- gate 행은 `Gate / status / count & amount / oldest / owner / next action`으로 통일한다.

## Phase E — P1: 개별 복구 drawer를 운영 결정 화면으로 만든다

drawer의 정보 순서는 다음과 같이 통일한다.

1. `Summary`
2. `Before / after`
3. `Evidence`
4. `Policy gate`
5. `Approval`
6. `Result` 또는 실행 전 confirmation

요구사항:

- 운영자가 복구 전에 생성·변경될 snapshot, journal, clearing, earning 영향을 비교할 수 있어야 한다.
- 차단된 건은 mutation control을 노출하지 않는다.
- blocker마다 사람이 읽는 설명과 다음 정보를 제공한다.
  - owner
  - source page 또는 evidence link
  - next action
  - recheck
- 해결 도구가 이미 존재하면 정확한 deep link를 제공한다.
- 도구가 없으면 임의 fake CTA를 만들지 말고 기존 case/task 패턴을 조사하여 `Create remediation case`를 구현하거나, 구현 불가 이유를 보고한다.
- approver selector에서는 현재 actor, disabled account, 자격 없는 role, test/smoke identity를 제외한다.
- 사람 이름과 업무 그룹을 우선 표시하고 raw ID는 보조 정보로 내린다.
- UI와 API의 reason validation을 일치시킨다. 최소 길이뿐 아니라 공백만 입력을 거절한다.
- reason helper는 `Root cause / Evidence checked / Expected result / Ticket` 구조를 안내한다.

### 접근성 필수 조건

- drawer open 시 제목 또는 첫 유효 입력으로 focus를 이동한다.
- Tab/Shift+Tab focus loop를 drawer 내부에 유지한다.
- Escape로 닫는다.
- 닫은 뒤 원래 `Review & repair` trigger로 focus를 돌린다.
- 배경은 `inert` 또는 검증된 기존 dialog primitive로 탐색되지 않게 한다.
- `aria-modal`, accessible name/description, 명확한 validation message를 제공한다.
- keyboard-only 자동 테스트를 추가한다.

## Phase F — P1: 실행 결과와 재시도 안전성을 강화한다

실제 write는 이번 브라우저 검증에서 실행하지 않지만 코드와 테스트는 다음을 보장해야 한다.

1. repair 요청은 기존 idempotency 인프라가 있으면 반드시 사용한다.
2. 응답 손실 또는 timeout 후 booking ID/idempotency key로 authoritative repair status를 조회할 수 있어야 한다.
3. 가능한 범위에서 finance write와 success audit를 transaction/outbox 경계로 묶는다.
4. 새로운 DB migration 없이 기존 구조로 안전하게 구현할 수 있는지 먼저 조사한다.
5. migration이 반드시 필요하면 임의로 적용하지 말고 정확한 schema·backfill·rollback 계획과 필요한 보호 검증을 보고한다.
6. 성공 결과에는 다음을 표시하고 가능한 항목은 deep link로 제공한다.
   - snapshot ID
   - journal ID
   - clearing ID
   - checkpoint
   - audit ID
   - actor/approver
   - completedAt
7. `Do not retry`만 보여 주지 않는다. 다음 action을 제공한다.
   - `Check repair status`
   - `Open settlement record`
   - `Open audit trail`

필수 회귀 테스트:

- 동일 idempotency key 재전송
- concurrent repair
- mutation 성공 후 response loss
- checkpoint failure
- 성공 후 모든 evidence link 노출

## Phase G — P1/P2: 성능을 구조적으로 개선한다

1. selected comparison의 최대 10개 개별 HTTP preview 요청을 batch preview endpoint 하나로 교체한다.
2. 서버 dry-run이 최대 100건에 대해 동일 데이터를 반복 조회하지 않도록 booking/payment/earning/closing/evidence를 묶어서 읽는다.
3. dry-run 결과는 filter + source version을 key로 짧게 캐시할 수 있으나, stale finance 판단을 만들지 않도록 `generatedAt`, invalidation 기준, refresh 동작을 명시한다.
4. 100건 결과가 충분히 빠르면 단순 request-response를 유지한다. 측정 없이 job queue 같은 과도한 구조를 만들지 않는다.
5. 검색 입력은 기존 패턴을 따르는 debounce 또는 명시적 submit 중 더 단순하고 예측 가능한 방식을 사용한다.
6. 변경 전후 다음을 같은 1440px 이상 환경에서 측정한다.
   - default repair queue
   - blocked queue
   - drawer preview
   - batch safety check
   - selected comparison
7. 성능 수치가 개발 서버 영향을 포함한다는 점을 결과 보고서에 명시한다.

## Phase H — P2: 문구와 시각적 위계를 운영자 중심으로 다듬는다

다음 문구를 기준으로 하되 실제 domain truth와 i18n 패턴을 보존한다.

| 기존 문구 | 변경 문구 |
|---|---|
| `State` | `Repair readiness` |
| `Range` | `Gap age` |
| `Canonical` | `Standard reconstruction` |
| `Historical evidence ready` | `Paid-record reconstruction` |
| `Historical settlement dry-run` | `Batch safety check (read-only)` |
| `Run read-only dry-run` | `Run safety check` |
| `Open governed repair` | `Review & repair` |
| `Completed / snapshot missing` | `Settlement snapshot missing` |
| `Writes: Disabled` | `Read-only — no records will be changed` |
| `PAYMENT_FEE_POLICY_DEFAULTED: 66` | `66 records have no matched payment-fee policy. Expected fee is currently 0 VND; review before approval.` |

추가 기준:

- 0건인 `Manual review`는 주요 카운트 카드와 동등한 시각 무게를 주지 않는다.
- 동일 count를 summary card와 filter pill에서 반복하지 않는다.
- 정상 상태의 큰 녹색 카드를 반복하지 않는다.
- 색만으로 정상/주의/차단을 구분하지 않는다.
- raw booking ID는 8~10자 축약 + copy button으로 제공하고 전체 값은 accessible label/tooltip에서 확인할 수 있게 한다.
- 선택 전 `Compare selected`는 disabled하고, 선택 후 `Compare selected (3)`처럼 수를 보여 준다.
- destructive 또는 irreversible action은 강한 confirmation hierarchy를 유지한다.
- loading, empty, no-result, partial-data, permission-denied, stale-preview, policy-review, blocker, success, ambiguous-result 상태를 모두 설계한다.

### 4. 구현 품질 원칙

- 페이지에만 쓰이는 파생 상태와 domain 판정을 구분한다. 정책과 eligibility는 서버가 권위 있게 결정하고 UI는 동일 계약을 표현한다.
- 금액은 기존 currency formatter를 사용하고 Vietnam locale/timezone 규칙을 따른다.
- filter state와 URL query를 동기화하여 새로고침과 deep link가 유지되게 한다.
- 페이지네이션과 정렬은 server-side를 유지한다.
- loading 중 기존 데이터가 있다면 무조건 전체 blank로 만들지 말고 stale/refreshing 상태를 명시한다.
- 버튼 disable만으로 이유를 숨기지 말고 인접 설명을 제공한다.
- 공용 컴포넌트를 수정할 때 다른 관리자 페이지 회귀 가능성을 점검한다.
- 디자인 토큰을 사용하고 임의 색상, 과도한 gradient, 새 card 패턴, 과도한 badge를 추가하지 않는다.
- 운영 화면답게 장식보다 스캔성, 상태 정확성, 다음 행동을 우선한다.

### 5. 검증 절차

구현 후 다음 검증을 모두 수행한다.

#### 자동 테스트

최소한 기존 관련 테스트와 새 회귀 테스트를 실행한다.

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- app/finance-closeout/page.spec.tsx lib/finance-closeout.spec.ts app/finance-closeout/finance-closeout-task-board-section.spec.tsx app/finance-closeout/finance-closeout-evidence-checklist-section.spec.tsx app/finance-closeout/finance-closeout-shift-action-map-section.spec.tsx app/finance-closeout/finance-closeout-payout-release-checks-section.spec.tsx app/finance-closeout/finance-closeout-payment-earning-section.spec.tsx app/finance-closeout/finance-closeout-cash-debt-handoff-section.spec.tsx

npm.cmd run test --workspace @massage-vn/api -- src/admin/admin.controller.spec.ts src/admin/admin.service.spec.ts -t "settlement gap|settlement repair|historical settlement"

npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api
```

- 실제 변경된 테스트 파일이 위 목록과 다르면 정확한 파일을 추가한다.
- protected area 또는 shared contract를 변경했다면 `AGENTS.md`가 요구하는 full verification을 수행한다.
- 느리거나 환경 의존적인 검증을 실행하지 못하면 실패로 숨기지 말고 `skipped` 이유를 정확히 남긴다.

#### 브라우저 검증

로그인된 in-app browser를 사용할 수 있으면 이를 사용한다. 1440×900 이상 desktop viewport에서 다음 상태를 실제로 열고 스크린샷을 남긴다.

1. default Settlement Repair
2. Actionable filter
3. Blocked filter와 blocker remediation
4. standard reconstruction drawer
5. paid-record reconstruction drawer
6. policy review required drawer
7. partial API failure/fail-closed 상태 — 테스트 환경 또는 안전한 mock layer에서만 재현
8. Batch safety check 결과
9. selected comparison
10. legacy operations URL redirect와 새 Finance handoff gate

실제 금융 mutation은 실행하지 않는다.

키보드로 다음을 직접 확인한다.

- drawer trigger → 최초 focus
- Tab/Shift+Tab loop
- Escape close
- trigger focus return
- disabled action의 설명
- filter와 표의 논리적 focus 순서

#### 기계적 UI 검사

`impeccable` detector를 사용할 수 있으면 모든 UI 수정이 끝난 뒤 변경된 UI target에 한 번 실행한다. 중간 단계에서 반복 실행하지 않는다.

### 6. 완료 조건

다음 조건을 전부 만족해야 완료로 판단한다.

- API failure가 0, empty, Clear, Ready로 보이는 경로가 없다.
- partial source 상태에서는 repair/closeout 결정이 잠긴다.
- batch, comparison, drawer, submit이 같은 policy decision을 사용한다.
- `REVIEW_REQUIRED`가 `Eligible` 단독 표현으로 바뀌지 않는다.
- list와 summary의 filter/scope가 일치한다.
- bounded detail list 길이를 total count로 사용하지 않는다.
- Settlement Repair, Batch diagnostics, Operations Handoff의 업무 경계가 명확하다.
- Operations duplicate cards/checklists/action maps가 단일 gate list로 정리된다.
- blocker마다 owner/next action/recheck 또는 정확한 대안이 있다.
- drawer focus management와 keyboard test가 통과한다.
- 결과 화면에 authoritative status와 생성 증거 링크가 있다.
- batch preview N+1 HTTP 호출이 제거되거나 측정 가능한 근거와 함께 최소화된다.
- 1440px 이상에서 핵심 판단 정보와 primary action이 쉽게 스캔된다.
- 기존 관련 테스트와 새 회귀 테스트가 통과한다.
- 실제 금융 write 없이 화면 검증을 완료한다.

### 7. 최종 보고 형식

작업을 끝낸 뒤 다음 순서로 보고하라.

1. **결과**: 구현 완료/부분 완료/차단 상태와 릴리스 판단
2. **무엇이 달라졌는지**: 운영자 업무 흐름 중심 요약
3. **P0/P1 해결 매핑**: 감사 항목별 변경 파일과 해결 방식
4. **변경 파일**: 파일별 핵심 변경
5. **검증**: 실행 명령, pass/fail/skipped 수치
6. **브라우저 증거**: 상태별 screenshot 경로와 확인 결과
7. **성능 비교**: 동일 조건의 변경 전후 수치
8. **protected areas touched**: 해당 여부와 추가 검증
9. **남은 위험**: 실제 write 미실행, migration 보류 등
10. **다음 권장 작업**: 하나만 제안

완료되지 않은 항목을 완료된 것처럼 표현하지 말라. 테스트 통과만으로 운영 안전성이 증명됐다고 주장하지 말고, 화면·API 계약·코드·테스트를 서로 대조한 근거를 남겨라.

## END OF PROMPT

---

## 빠른 사용 팁

- 새 Codex 작업을 저장소 `C:\dev\massage-on-demand-vn`에서 연 뒤 위 프롬프트 전체를 붙여 넣는다.
- 현재 작업 트리에 중요한 미커밋 변경이 있으면 프롬프트 위에 한 줄로 해당 파일을 추가한다.
- 구현 범위가 너무 크다고 판단될 때도 Codex가 임의로 P2만 처리하지 않도록, 반드시 P0 → P1 → P2 순서를 유지한다.
- 실제 금융 mutation 검증은 별도 승인과 안전한 staging 데이터가 준비된 후 후속 작업으로 분리한다.
