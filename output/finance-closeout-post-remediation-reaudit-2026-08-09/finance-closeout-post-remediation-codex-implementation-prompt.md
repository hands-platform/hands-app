# Finance Closeout 재감사 후속 개선 — Codex 구현 프롬프트

아래 내용을 새 Codex 작업에 그대로 붙여 넣어 사용한다.

---

## START OF PROMPT

당신은 `C:\dev\massage-on-demand-vn` HANDS monorepo의 단일 구현 담당자다.

`/finance-closeout` Settlement Repair 화면은 이전 개선으로 금융 write 안전성이 상당히 좋아졌지만, 최신 재감사에서 실제 운영 흐름과 표시 수치의 신뢰성을 훼손하는 문제가 남았다. 첨부 보고서를 기준으로 코드를 다시 추적하고, 필요한 수정·테스트·1440px 이상 브라우저 검증까지 완료하라.

기준 보고서:

`C:\dev\massage-on-demand-vn\output\finance-closeout-post-remediation-reaudit-2026-08-09\finance-closeout-post-remediation-reaudit-report.md`

감사 증거 이미지 폴더:

`C:\dev\massage-on-demand-vn\output\finance-closeout-post-remediation-reaudit-2026-08-09`

### 1. 작업 목표

운영자가 다음 질문에 즉시 답할 수 있는 화면으로 완성한다.

1. 지금 보고 있는 숫자는 정확히 어떤 필터와 모집단을 기준으로 하는가?
2. 이 레코드는 지금 복구 가능한가, 정책 검토가 필요한가, 증빙이 부족한가?
3. 차단됐다면 누가 무엇을 어디에서 고친 뒤 어떻게 재확인해야 하는가?
4. Shift Handoff의 finance review 링크는 실제 해당 업무 영역에 도착하는가?
5. 1440px 화면에서 queue와 10건 비교 결과를 빠르게 스캔할 수 있는가?

최종 목표는 화려한 재설계가 아니라 **수치 신뢰성, 실제 다음 행동, 금융 안전, 1440px 스캔성**이다.

### 2. 반드시 지킬 범위와 안전 규칙

- 먼저 루트 `AGENTS.md`를 끝까지 읽고 따른다.
- 이 저장소는 single-agent workflow다. subagent나 multi-agent 도구를 사용하지 않는다.
- dirty worktree의 사용자 변경을 보존한다. reset, checkout, clean, stash로 덮어쓰지 않는다.
- 기존 design system, admin component, formatter, status badge, filter, drawer, table 패턴을 재사용한다.
- 새 UI library, state library, table library, chart library를 추가하지 않는다.
- 새 abstraction, 신규 infrastructure, background job, cache, event system을 측정 근거 없이 만들지 않는다.
- 기존 endpoint/helper를 작은 수정으로 재사용할 수 있으면 새 endpoint를 만들지 않는다.
- 금융·정산·wallet·tax 동작을 단순화하거나 client 판단으로 옮기지 않는다.
- 실제 정산 repair POST나 금융 write를 브라우저 검증 중 실행하지 않는다.
- DB migration이 정말 필요한 경우 임의로 적용하지 말고, 기존 idempotency/unique/upsert 구조로 해결 가능한지 먼저 조사한다.
- **1440px 이상 데스크톱만 검증한다. 1024px 이하, 모바일, 태블릿 디자인은 작업 범위와 최종 보고에서 완전히 제외한다.**
- 이미 해결된 fail-closed, policy gate, dual approval, sourceVersion, checkpoint, drawer focus 동작을 약화시키지 않는다.

### 3. 구현 전 반드시 확인할 코드 흐름

다음 파일과 실제 호출자를 모두 읽고, 보고서의 line number가 최신 코드와 다르면 현재 코드를 기준으로 수정한다.

#### Admin Web

- `apps/admin_web/app/finance-closeout/page.tsx`
- `apps/admin_web/app/finance-closeout/finance-closeout-settlement-backlog-section.tsx`
- `apps/admin_web/app/finance-closeout/finance-closeout-settlement-repair-drawer.tsx`
- `apps/admin_web/app/finance-closeout/finance-closeout-settlement-dry-run-section.tsx`
- `apps/admin_web/app/finance-closeout/finance-closeout-settlement-batch-preview-section.tsx`
- `apps/admin_web/lib/finance-closeout.ts`
- `apps/admin_web/app/operations-handoff/page.tsx`
- `apps/admin_web/app/operations-handoff/operations-handoff-finance-action-section.tsx`
- `apps/admin_web/app/operations-handoff/operations-handoff-finance-actions.ts`
- `apps/admin_web/components/admin-drawer-backdrop-button.tsx`
- `apps/admin_web/components/use-admin-modal-focus.ts`
- `apps/admin_web/components/admin-segmented-control.tsx`

#### API / finance safety

- `apps/api/src/admin/admin-settlement.routes.ts`
- `apps/api/src/admin/admin.dto.ts`
- `apps/api/src/admin/admin.service.ts`
- `apps/api/src/earnings/earnings.service.ts`
- `apps/api/prisma/schema.prisma`의 settlement/earning unique·upsert 관련 모델 — 읽기 우선

#### 테스트

- `apps/admin_web/app/finance-closeout/page.spec.tsx`
- `apps/admin_web/lib/finance-closeout.spec.ts`
- `apps/admin_web/app/operations-handoff/page.spec.tsx`
- `apps/admin_web/app/operations-handoff/operations-handoff-finance-action-section.spec.tsx`
- `apps/admin_web/app/operations-handoff/operations-handoff-finance-actions.spec.ts`
- `apps/admin_web/components/admin-drawer-backdrop-button.spec.tsx`
- `apps/admin_web/components/use-admin-modal-focus.spec.tsx`
- 관련 API controller/service/DTO settlement tests

수정 전에 반드시 다음을 추적한다.

- `buildFinanceCloseoutOperationsHref`의 모든 caller
- `operations-handoff-finance-review` ID를 선언·렌더링·테스트하는 모든 파일
- settlement gap list와 summary query의 filter 전달 경로 전체
- blocker code를 생성하는 서버 코드와 현재 연결 가능한 finance evidence 페이지
- `AdminDrawerBackdropButton`의 모든 caller
- batch preview/dry-run에서 record별로 실행되는 DB query와 calculator 호출
- repair action의 concurrent request, unique constraint, upsert, audit write 경계

---

## Phase A — P1: Finance Handoff dead destination을 실제 workflow로 복구한다

현재 문제:

- `/finance-closeout?view=operations`는 `/operations-handoff?...#operations-handoff-finance-review`로 redirect한다.
- URL hash는 생기지만 destination page에 해당 element가 렌더링되지 않는다.
- `OperationsHandoffFinanceActionSection` component는 존재하지만 `operations-handoff/page.tsx`에서 사용되지 않는 orphan 상태다.
- 기존 테스트는 redirect 문자열과 orphan component만 각각 검증해 실제 연결 실패를 잡지 못한다.

### 구현 요구사항

1. 먼저 `OperationsHandoffFinanceActionSection`과 finance action builder가 현재 도메인에서 여전히 권위 있는 데이터를 만들 수 있는지 확인한다.
2. 기존 server-backed data path를 작은 변경으로 재사용할 수 있다면 current Shift Handoff 페이지의 적절한 위치에 실제 section을 렌더링한다.
3. section을 복구할 경우:
   - 실제 `id="operations-handoff-finance-review"`가 DOM에 존재해야 한다.
   - open finance work를 우선 표시하고 clear/completed 상태는 접어서 보이게 한다.
   - `details=all`, `range` query가 의미가 없다면 사용하지 말고 canonical query로 정리한다.
   - heading, count, owner/assignee, oldest, next action, destination link가 실제 데이터와 일치해야 한다.
4. 현재 IA에서 finance section 자체가 제거된 것이 의도이며 데이터 source도 더 이상 유효하지 않다면 orphan section을 억지로 되살리지 않는다. 이 경우:
   - `Open Shift Handoff finance review`라는 잘못된 약속을 제거한다.
   - 기존 Operations legacy URL을 실제 권위 페이지인 Finance Overview 또는 정확한 filtered finance queue로 redirect한다.
   - dead anchor, orphan component, 불필요한 테스트를 함께 정리한다.
5. 어느 방향이든 **존재하지 않는 anchor로 이동하는 상태는 금지**한다.

### 최소 구현 선택 원칙

- 기존 finance action data와 section을 현재 Operations Handoff가 이미 사용할 수 있으면 복구가 우선이다.
- 이를 위해 과거 closeout page의 여러 aggregate 조회·중복 카드까지 다시 가져와야 한다면 복구하지 말고 정확한 권위 페이지로 링크를 바꾼다.
- 새로운 aggregate infrastructure는 이 문제만을 위해 만들지 않는다.

### 필수 테스트

- legacy operations URL의 최종 destination을 검증한다.
- destination page markup에 실제 target ID와 finance heading이 존재하는지 검증한다.
- finance open row 또는 honest clear state가 렌더링되는지 검증한다.
- href 문자열만 검증하고 끝내지 않는다.

### 완료 조건

- redirect 후 target element가 존재한다.
- hash가 있다면 해당 element로 이동한다.
- 사용자는 generic Shift Handoff 상단이 아니라 약속된 finance 업무 또는 정확한 권위 페이지에 도착한다.

---

## Phase B — P1: KPI와 active filter의 모집단을 일치시킨다

현재 문제:

- list는 `age`, `track`, `q`, `period`, `paymentMethod`를 사용한다.
- summary는 `q`, `period`, `paymentMethod`만 사용한다.
- Canonical backlog 18건을 보는 동안 `Oldest 80d`, `Evidence blocked 1` 같은 전체 85건 기준 수치가 `Filtered queue`처럼 보인다.

### 구현 요구사항

수정 전에 현재 운영 목적을 코드와 화면에서 확인한 뒤 아래 두 방식 중 더 작은 정확한 방식을 선택한다.

#### 방식 1 — Active-scope summary

- summary query/API가 `age`와 `track`도 받아 list와 같은 where를 사용한다.
- matching count, oldest, blocked/track 관련 값을 같은 active scope로 계산한다.
- API response의 `scope`에도 실제 적용된 `age`, `track`, `q`, `period`, `paymentMethod`를 반환한다.

#### 방식 2 — Global과 filtered를 정직하게 분리

- 기존 summary를 전역 overview로 유지한다.
- 전역 카드에는 `All repair tracks`, `All gap ages`를 명시한다.
- active filter summary에서는 같은 scope로 계산할 수 없는 `Oldest`를 제거하거나 별도 active-scope 값으로 교체한다.
- 전역 KPI와 active matching count를 같은 filter summary 안에 섞지 않는다.

### 금지사항

- paginated 현재 page의 첫 row만 보고 전체 active queue의 oldest라고 추정하지 않는다.
- label만 `Filtered`로 바꾸고 backend scope는 그대로 두지 않는다.
- 한 그룹 안에서 서로 다른 모집단의 count와 oldest를 나란히 표시하지 않는다.

### 필수 테스트

최소 다음 조합을 고정 데이터로 테스트한다.

- `canonical + backlog`
- `historical-ready + all`
- `evidence-blocked + all`
- `period + paymentMethod + q`

각 조합에서 list total, summary count, oldest, response scope 또는 UI scope label이 일치해야 한다.

### 완료 조건

- 운영자가 카드나 filter summary만 보고도 전역 숫자와 현재 필터 숫자를 구분할 수 있다.
- `Matching bookings`와 `Oldest`를 한 그룹에 표시한다면 반드시 동일한 query scope다.

---

## Phase C — P1: 기본 page identity와 blocked remediation을 완성한다

### C-1. Browser page title

- `/finance-closeout`에 프로젝트 기존 metadata 패턴을 사용해 유효한 title을 제공한다.
- 권장: `Settlement Repair · HANDS Admin`
- queue, batch, drawer query state에서도 기본 route title이 빈 문자열이 되지 않아야 한다.
- WCAG 2.4.2 Page Titled를 충족하도록 테스트한다.

### C-2. Evidence blocked를 해결 가능한 task로 만든다

현재 drawer는 blocker를 설명하지만 담당·해결 경로·재확인이 없다.

구현 요구사항:

1. 서버가 반환하는 blocker code 전체를 조사한다.
2. blocker code별 operator-facing remediation model을 기존 helper 또는 작은 mapping으로 정의한다.
3. 각 blocker는 가능한 범위에서 다음을 제공한다.
   - `Responsible team` 또는 실제 owner
   - `Missing evidence`
   - `Next action`
   - 정확한 `Open source` deep link
   - 안전한 `Recheck evidence` 또는 현재 preview refresh
4. 실제 assignee가 저장되지 않는데 `Assigned to`라고 거짓 표시하지 않는다. 이 경우 `Responsible team: Finance`처럼 표현한다.
5. 기존 booking detail, payment fee, tax, wallet, settlement audit 페이지 중 정확한 경로를 재사용한다.
6. 해결 도구가 없으면 fake CTA를 만들지 않는다.
7. 기존 case/task 도메인이 이미 있고 작은 변경으로 연결할 수 있을 때만 remediation case 생성 기능을 사용한다.
8. 같은 blocker 문장을 `Resolve before repair`와 `Policy gate`에서 두 번 반복하지 않는다.
9. blocked 상태에서는 repair/approval control을 계속 숨긴다.

필수 상태:

- fee evidence missing
- tax evidence missing
- wallet evidence missing 또는 count mismatch
- payment/earning/monthly-close 관련 blocker
- unknown blocker fallback — code는 audit detail에 유지하되 사람에게는 안전한 설명과 booking evidence link 제공

완료 조건:

- 운영자는 drawer 안에서 누가, 무엇을, 어디에서 확인해야 하는지 알 수 있다.
- 수정 후 같은 filter와 booking preview를 잃지 않고 재검사할 수 있다.

---

## Phase D — P2: Batch 성능을 측정한 뒤 가장 작은 구조 개선만 한다

현재 상태:

- client의 10개 개별 HTTP 요청은 batch endpoint 하나로 이미 개선됐다.
- 하지만 API batch는 `Promise.all(ids.map(preview))`, dry-run은 최대 100건을 record별 preview로 반복한다.
- local browser 기준 66건 dry-run 약 0.75초, 10건 comparison 약 0.81초로 현재 체감 속도는 나쁘지 않다.

### 구현 요구사항

1. 먼저 query/call count를 측정하거나 테스트 double로 기록하여 fan-out을 수치로 확인한다.
2. 작은 bulk-read로 줄일 수 있을 때만 다음을 적용한다.
   - 대상 booking/payment/earning/evidence를 한 번 또는 소수의 bulk query로 조회
   - monthly period를 dedupe하여 closing rows bulk 조회
   - 조회한 데이터를 기존 policy/calculator에 전달하여 in-memory mapping
3. 단일 preview와 batch preview가 서로 다른 정책 판정을 만들지 않도록 동일한 pure decision helper를 재사용한다.
4. 다음은 금지한다.
   - job queue
   - 새로운 cache service
   - background worker
   - 신규 message/event infrastructure
   - 성능 근거 없는 DB schema 변경
5. 현재 구조가 이미 충분히 빠르고 bulk conversion이 금융 계산 안전성을 크게 복잡하게 만든다면 구현을 보류하고 측정 결과와 병목이 아닌 이유를 최종 보고에 남긴다.

### 필수 검증

- 1건 preview와 batch 안 동일 booking의 policy decision, blockers, expected accounting이 동일하다.
- 10건 및 100건에서 query/call count와 elapsed를 변경 전후 같은 조건으로 기록한다.
- 100건 제한과 generatedAt, read-only 의미를 유지한다.

---

## Phase E — P2: 1440px queue와 selected comparison의 스캔성을 개선한다

### E-1. Selected comparison

현재 7열 표는 1440px에서도 booking ID와 action이 단어별로 줄바꿈된다.

권장 구조:

- 약 5개 열: `Record / Policy / Accounting / Evidence / Action`
- `Record`: 축약 booking ID + copy, completed time, customer/partner 맥락
- `Policy`: Approved / Review required / Blocked와 사람용 reason
- `Accounting`: customer/partner 핵심 금액과 balance 상태
- `Evidence`: fee/tax/wallet count, 필요 시 disclosure
- `Action`: `Review evidence` 또는 `Review & repair`, nowrap 보장

구현 규칙:

- booking ID는 앞 8~10자를 표시하되 전체 ID를 복사할 수 있어야 한다.
- 전체 ID는 accessible label/title 등으로 확인 가능해야 한다.
- 기존 formatter와 copy component가 있으면 반드시 재사용한다.
- `min-width: 0`, 적절한 grid/table width, nowrap을 사용하고 임의 fixed pixel 폭을 과도하게 추가하지 않는다.
- customer/partner 정보가 batch API에 없으면 기존 batch response를 additive하게 확장하되 record별 새 HTTP 요청은 만들지 않는다.
- 모바일용 card layout은 만들지 않는다.

### E-2. Queue selection action

- 선택 0건: `Compare selected` disabled.
- 인접 helper: `Select up to 10 records.`
- 선택 후: `Compare selected (3)`처럼 count 표시.
- 10건 초과를 UI에서 막고 이유를 설명한다.
- 기존 form submit 구조에 최소 client state만 추가한다. 새 상태 관리 dependency를 추가하지 않는다.
- no-JS fallback이 필요한 기존 프로젝트 패턴이 있으면 보존한다.

### E-3. Queue context

- 기존 행에 service/location/owner/next-action 데이터를 이미 안전하게 얻을 수 있다면 판단 맥락을 보강한다.
- 이를 위해 별도 per-row API 호출이나 큰 contract 변경이 필요하면 이번 범위에서 억지로 추가하지 않는다.
- 핵심 목표는 comparison wrapping과 selection clarity다.

### 완료 조건

- 1440×900에서 raw ID가 3~4줄로 깨지지 않는다.
- action label이 단어별로 줄바꿈되지 않는다.
- 한 행의 policy와 다음 행동을 2~3초 안에 식별할 수 있다.
- horizontal page overflow가 없다.

---

## Phase F — P2: Drawer close semantics와 재시도 안전성을 보완한다

### F-1. 중복 close accessible name

현재 backdrop button과 header close button이 모두 `Close settlement repair preview`로 노출될 수 있다.

요구사항:

- screen reader와 keyboard에는 modal 내부의 명시적 close control 하나만 노출한다.
- backdrop click-dismiss는 유지할 수 있지만 `aria-hidden`, `tabIndex=-1` 또는 기존 dialog primitive의 pointer-dismiss 패턴을 사용한다.
- `AdminDrawerBackdropButton`은 공용 component이므로 모든 caller를 확인한다.
- 다른 drawer가 backdrop을 유일한 close control로 쓰는 경우 공용 기본값을 무조건 바꾸지 말고 finance drawer에 안전한 prop을 추가한다.
- 기존 Escape, focus loop, background inert, trigger focus return을 회귀시키지 않는다.

### F-2. Idempotency와 authoritative status 조사

현재 확인된 보호:

- settlement snapshot `bookingId` unique
- upsert 기반 write
- submit 전 최신 preview/sourceVersion 확인
- post-write checkpoint

남은 위험:

- 명시적 request idempotency key가 보이지 않는다.
- 두 요청이 동시에 preview gate를 통과하면 requested audit가 중복될 수 있다.
- timeout/response loss 후 authoritative repair status를 조회하는 명시적 흐름이 없다.

요구사항:

1. repo 전체에서 기존 idempotency helper/middleware/request key 패턴을 먼저 찾는다.
2. 기존 패턴이 있으면 settlement repair에 재사용하고 concurrent/duplicate request test를 추가한다.
3. 기존 구조가 없고 migration이 필요하다면 이번 작업에서 즉시 새 framework를 만들지 않는다.
4. unique/upsert/checkpoint로 실제 금전 중복은 막히는지, audit 중복만 남는지 transaction 경계를 추적한다.
5. 최소 안전 개선으로 해결 가능하면 적용한다. 예: existing snapshot/sourceVersion을 authoritative status로 재조회하는 기존 endpoint/notice 활용.
6. 큰 schema/outbox 작업이 필요하면 정확한 위험, 필요한 migration, backfill, rollback, protected-area 검증을 최종 보고에 남기고 보류한다.

금융 안전을 “코드가 아마 막을 것”이라고 추측하지 말고 테스트 근거를 남긴다.

---

## Phase G — P3: 운영 문구와 정보 밀도를 정리한다

다음 문구를 현재 domain truth와 기존 tone에 맞춰 정리한다.

| 현재 | 목표 문구 |
|---|---|
| `State` | `Repair track` 또는 `Repair readiness` |
| `Range` | `Gap age` |
| `Historical settlement dry-run` | `Batch safety check (read-only)` |
| `Run read-only dry-run` | `Run safety check` |
| `Refresh dry-run` | `Run safety check again` |
| `Writes: Disabled` | `Read-only — no records will be changed` |
| `OPEN_OR_UNLINKED` | `Monthly close is open or not linked` |
| `PAYMENT_FEE_POLICY_DEFAULTED` | `No matching payment-fee policy; review required` |
| `Open governed repair` | `Review & repair` |

규칙:

- machine code는 audit/debug detail에 보존할 수 있지만 primary operator message로 그대로 노출하지 않는다.
- reason은 `원인 → 영향 → 다음 행동` 순서의 한두 문장으로 쓴다.
- 기본값인 `All months`, `All payment methods`는 적용된 필터가 없을 때 summary chip으로 반복하지 않는다.
- `Manual review 0`은 active-risk KPI와 같은 시각 무게로 두지 않는다.
- global KPI와 filter summary에서 같은 count를 반복하지 않는다.
- `Actionable repair`의 값이 count가 아니라 `Preview required`라면 KPI가 아닌 process notice로 옮기거나 단위를 통일한다.
- user-facing provider 명칭은 `Partner`를 유지한다.

### `aria-current` 점검

- `AdminSegmentedControl`의 `semantics`와 실제 용도를 확인한다.
- 각 독립 set 안에서 current item이 하나인 것은 정상이다. 단순히 한 페이지에 여러 `aria-current`가 있다는 이유만으로 바꾸지 않는다.
- filter가 tab/pressed selection으로 잘못 노출되는 경우에만 기존 semantics prop을 사용해 수정한다.
- 공용 component 변경 시 모든 caller와 관련 tests를 실행한다.

---

## 4. 반드시 보존할 기존 성공 사항

다음은 최신 재감사에서 통과한 기능이다. 수정 과정에서 제거하거나 약화시키지 않는다.

- required source 실패 시 `Data unavailable — do not close or repair`
- API 오류와 진짜 empty queue 구분
- last refreshed ICT와 safe refresh
- Historical `REVIEW_REQUIRED`의 batch → comparison → drawer → submit 일관성
- `APPROVED` 상태에서만 repair form 노출
- self-approval 서버 차단
- 12자 이상 repair reason의 client/server validation
- sourceVersion stale preview 거부
- booking ID confirmation
- before/after, evidence, policy gate 순서
- post-write checkpoint와 evidence links
- drawer 최초 focus, Tab/Shift+Tab loop, Escape, focus return, background inert
- dark mode surface 일관성
- read-only dry-run과 100건 제한
- 선택 10건의 단일 batch HTTP endpoint

관련 regression test를 유지하고 필요한 경우 더 구체적으로 강화한다.

---

## 5. 상태별 UI 요구사항

다음 상태가 서로 다른 의미와 행동을 가져야 한다.

1. Loading
2. Required source unavailable
3. Successful empty queue
4. No filter result
5. Canonical approved preview
6. Historical policy review required
7. Evidence blocked
8. Stale preview
9. No eligible approver
10. Selected comparison 0 / 1 / 10건
11. Dry-run truncated at 100
12. Repair success
13. Repair checkpoint failed — write may have happened, retry 금지와 authoritative evidence 제공
14. Duplicate/concurrent request

색만으로 상태를 구분하지 말고 status text와 다음 행동을 함께 제공한다.

---

## 6. 자동 테스트

최소 다음 테스트를 실행한다. 실제 변경 파일에 따라 관련 테스트를 추가한다.

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- app/finance-closeout/page.spec.tsx lib/finance-closeout.spec.ts app/operations-handoff/page.spec.tsx app/operations-handoff/operations-handoff-finance-action-section.spec.tsx app/operations-handoff/operations-handoff-finance-actions.spec.ts components/admin-drawer-backdrop-button.spec.tsx components/use-admin-modal-focus.spec.tsx components/admin-segmented-control.spec.tsx

npm.cmd run test --workspace @massage-vn/api -- src/admin/admin.controller.spec.ts src/admin/admin.service.spec.ts src/admin/admin.dto.spec.ts -t "settlement gap|settlement repair|historical settlement"
```

변경 범위에 따라 다음 scope verification을 실행한다.

```powershell
npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api
```

Protected area의 behavior가 바뀌거나 schema/shared contract를 수정했다면 `AGENTS.md`가 요구하는 추가 검증을 수행한다. 실행하지 못한 검증은 성공으로 표현하지 말고 `skipped` 이유를 정확히 남긴다.

### 반드시 추가하거나 강화할 회귀 테스트

- redirect destination 실제 section 존재
- active/global summary scope 의미
- document metadata title
- blocker code별 remediation copy/link/fallback
- selection 0/1/10 count와 disabled/max 상태
- backdrop이 접근성 트리에 중복 close로 노출되지 않음
- focus loop/Escape/focus return 유지
- batch와 single preview policy 결과 동일
- stale sourceVersion 거부
- self-approval 거부
- concurrent/duplicate repair의 실제 보호 경계

---

## 7. 브라우저 검증

로그인된 in-app browser를 사용할 수 있으면 사용한다. 브라우저가 이미 열려 있더라도 현재 URL만 신뢰하지 말고 직접 필요한 상태로 이동해 확인한다.

검증 viewport:

- 1440×900 이상 데스크톱
- 1024px 이하 검증 금지

반드시 캡처할 상태:

1. 기본 Repair queue 상단과 KPI scope
2. Canonical + backlog filter와 summary
3. Historical policy review queue/drawer
4. Evidence blocked drawer의 remediation actions
5. Batch safety check 결과
6. Selected comparison 10건
7. 선택 0건 CTA 상태
8. legacy `?view=operations`의 최종 destination
9. dark mode 기본 상단

브라우저에서 확인할 사항:

- page title
- target anchor 존재와 실제 이동
- count/oldest/scope 의미
- 1440px horizontal overflow
- ID/action wrapping
- keyboard-only drawer 동작
- close control의 accessible name 수
- blocker link destination
- read-only action만 사용

실제 settlement repair submit은 실행하지 않는다.

---

## 8. 기계적 UI 검사

모든 UI 코드 수정이 끝난 뒤 `impeccable` detector를 관련 변경 UI 파일에 **한 번만** 실행한다. detector가 깨끗해도 live workflow, 수치 scope, finance policy가 안전하다고 단정하지 않는다. 발견 항목은 실제 코드 문맥에서 false positive 여부를 확인한다.

---

## 9. 완료 조건

다음을 전부 만족해야 구현 완료로 판단한다.

- dead Finance Handoff anchor/link가 없다.
- legacy Operations URL이 실제 finance 업무 또는 정확한 권위 페이지에 도착한다.
- redirect 문자열뿐 아니라 destination content integration test가 있다.
- global KPI와 active filter summary의 모집단이 명확히 구분된다.
- 같은 그룹의 count와 oldest는 동일 scope다.
- `/finance-closeout`의 document title이 유효하다.
- blocker마다 responsible team/owner, missing evidence, next action, source link, recheck 또는 정직한 fallback이 있다.
- blocked/review-required 상태에서 repair action은 계속 잠긴다.
- 1440px comparison에서 ID와 action이 단어 단위로 깨지지 않는다.
- 선택 0건 CTA가 disabled이고 선택 수와 최대 10건 제한이 보인다.
- screen reader에 중복된 close action이 노출되지 않는다.
- drawer keyboard/focus 동작이 유지된다.
- batch 성능은 측정값과 query/call count가 보고된다.
- 성능 개선을 보류했다면 근거가 있다.
- machine code가 primary operator copy를 대신하지 않는다.
- 이미 통과한 fail-closed, policy, dual approval, stale preview, checkpoint 회귀 테스트가 계속 통과한다.
- 실제 finance write 없이 브라우저 검증을 완료한다.
- 1024px 이하 관련 항목이 결과 보고서에 포함되지 않는다.

---

## 10. 구현 원칙

- symptom이 아니라 root cause를 수정한다.
- shared helper 한 곳이 모든 caller를 안전하게 고칠 수 있으면 caller마다 patch하지 않는다.
- 다만 공용 component 변경은 모든 caller를 확인하고 회귀 테스트한다.
- 금융 정책과 eligibility는 서버가 권위 있게 판정하고 UI는 동일 계약을 표현한다.
- operator copy와 machine code를 분리한다.
- source가 없거나 실패한 값을 0 또는 clear로 추론하지 않는다.
- 새 의존성보다 기존 component와 native HTML/CSS를 사용한다.
- 한 번 쓰는 abstraction, speculative config, 신규 framework를 만들지 않는다.
- loading, error, empty, blocked, stale, success, ambiguous-result 상태를 숨기지 않는다.
- long booking ID, 긴 이름, 큰 VND 금액에서도 1440px 스캔성을 유지한다.

---

## 11. 최종 보고 형식

작업 완료 후 다음 순서로 보고한다.

1. **결과** — 완료/부분 완료/차단 및 release 판단
2. **운영자 관점 변화** — 무엇이 더 정확하고 빠르게 되었는지
3. **감사 항목 매핑** — P1/P2/P3별 해결/부분 해결/보류
4. **변경 파일** — 파일별 핵심 변경
5. **수치 scope 계약** — global과 active filter가 어떻게 구분되는지
6. **Finance Handoff destination** — 최종 URL, target, 데이터 source
7. **금융 안전** — preserved gates, idempotency/concurrency 조사 결과
8. **성능** — 변경 전후 query/call count와 elapsed, 측정 조건
9. **자동 테스트** — 명령과 pass/fail/skipped 수
10. **브라우저 증거** — 1440px screenshot 절대 경로와 상태별 결과
11. **Protected areas touched** — 해당 여부와 추가 검증
12. **남은 위험** — 실제 write 미실행, migration 보류 등
13. **다음 권장 작업** — 하나만 제안

완료하지 않은 항목을 완료한 것처럼 표현하지 않는다. 테스트 green만으로 live destination, finance correctness, 운영 workflow가 검증됐다고 주장하지 않는다.

## END OF PROMPT

---

## 사용 방법

1. 새 Codex 작업을 `C:\dev\massage-on-demand-vn`에서 연다.
2. 위 `START OF PROMPT`부터 `END OF PROMPT`까지 전체를 붙여 넣는다.
3. 최신 재감사 보고서와 screenshot 폴더가 그대로 존재하는지 확인한다.
4. 실제 금융 write는 별도 승인된 staging 검증으로 분리한다.
