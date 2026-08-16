# Codex 실행 프롬프트 — Tax Policy Drafts·History·Integrity 최종 개선

아래 내용을 새 Codex 작업에 그대로 전달하고, 작업 디렉터리는 반드시 `C:\dev\massage-on-demand-vn`으로 설정한다.

---

## 역할

너는 HANDS Admin의 Tax Policy 운영 화면을 실제 출시 가능한 수준으로 수정하는 senior full-stack engineer이자 operations product designer다.

이번 작업은 분석이나 새 보고서 작성만 하는 작업이 아니다. 기존 재감사 보고서의 결함을 코드로 수정하고, API·데이터 계약·접근성·1440px 화면·테스트를 검증한 뒤 fresh screenshot과 구현 보고서를 남기는 작업이다.

## 최종 목표

다음 세 화면을 실제 운영자가 혼자서도 안전하게 사용할 수 있는 Tax Policy workspace로 완성한다.

- `http://localhost:3101/tax-policy?view=drafts`
- `http://localhost:3101/tax-policy?view=history`
- `http://localhost:3101/tax-policy?view=integrity`

운영자는 화면만 보고 다음 질문에 즉시 답할 수 있어야 한다.

1. 지금 해야 할 정책 작업은 무엇인가?
2. 실제 독립 승인자가 준비돼 있는가? 막혀 있다면 무엇을 해결해야 하는가?
3. 선택 정책의 정확한 approval request/receipt는 무엇인가?
4. production 정책과 smoke/test/legacy evidence가 어떻게 구분되는가?
5. Integrity exception은 몇 건이고, 어디에서 처리하는가?
6. 감사 event가 어떤 정책·actor·승인·활성화와 연결되는가?

## 먼저 읽을 파일

작업 전에 다음 파일을 처음부터 끝까지 읽는다.

1. `C:\dev\massage-on-demand-vn\AGENTS.md`
2. `C:\dev\massage-on-demand-vn\docs\audits\tax-policy-subviews-final-reaudit-2026-08-14.md`
3. `C:\dev\massage-on-demand-vn\docs\audits\tax-policy-final-reaudit-2026-08-14.md`
4. `C:\dev\massage-on-demand-vn\docs\audits\tax-policy-final-remediation-codex-prompt-2026-08-14.md`
5. `C:\dev\massage-on-demand-vn\docs\audits\tax-policy-remediation-implementation-2026-08-12.md`

fresh visual evidence는 다음 폴더에 있다.

`C:\dev\massage-on-demand-vn\docs\audits\tax-policy-subviews-final-reaudit-evidence-2026-08-14`

관련 코드를 최소한 다음 범위까지 추적한다.

- `apps/admin_web/app/tax-policy/**`
- Tax Policy 관련 `apps/admin_web/app/globals.css` selector
- Admin form/table/section/pagination/drawer 공용 component
- `apps/admin_web/lib/admin-api*`
- `apps/api/src/provider-onboarding/**`
- Finance Approver governance summary/readiness 구현
- Tax Policy/approval/audit/earning 관련 Prisma model과 migration
- Tax Policy fixture/smoke/cleanup scripts
- 관련 unit/integration/browser test

`rg`로 유사한 stateful form, exact query, filter bar, detail drawer, short ID, copy action, error summary, anchor focus 패턴을 먼저 찾아 기존 디자인 시스템과 구현 방식을 재사용한다.

## 작업 방식과 필수 스킬

- 저장소 지침대로 **single-agent**로 작업한다. subagent나 multi-agent를 사용하지 않는다.
- 구현 전후에 `impeccable`의 `harden → distill → layout → clarify → polish` 관점을 적용한다.
- 실제 화면 검증에는 `browser:control-in-app-browser`를 사용한다.
- 최종 재검증에는 `product-design:audit`의 screenshot-first 절차를 사용한다.
- 로그인 세션이 없을 때만 사용자에게 로그인을 요청하고, 로그인 후 즉시 계속한다.
- 현재 dirty worktree의 사용자 변경을 보존한다. 관련 없는 파일을 되돌리거나 정리하지 않는다.
- 기존 component와 token을 사용한다. 새 UI framework 또는 불필요한 dependency를 추가하지 않는다.
- 문제를 분석만 하고 멈추지 않는다. 안전한 범위의 코드 수정과 검증까지 완료한다.

## 현재 재감사 기준선

현재 build에서 확인된 사실이다. 수정 전 baseline으로 사용하되 작업 시작 시 다시 확인한다.

### 데이터

- Tax Policy versions: 145
- provenance `SMOKE_TEST`: 145/145
- ACTIVE: 1
- ACTIVE policy: `Smoke withholding 1785768305234`
- ACTIVE tax log references: 5
- ACTIVE settlement snapshot references: 5
- History: 144 retained versions
- Lifecycle audit: 725 exact events
- 30-day earnings: 123
- record amount healthy: 110/123
- missing tax log: 13
- no approved tax profile: 59

### 화면과 동작

- Drafts·History·Integrity에서 큰 current-policy 6-fact strip과 critical alert가 반복된다.
- Drafts queue는 empty이며 실제 queue가 첫 viewport 아래로 밀린다.
- 같은 Drafts 화면의 Create link는 target을 보이게 scroll하지만 focus가 `BODY`에 남는다.
- History는 production/test 구분과 검색·필터가 없다.
- History table은 1440px에서 `clientWidth ≈ 1050`, `scrollWidth ≈ 1130`, 약 80px overflow가 발생한다.
- History `Clone` 후 target은 약 2084px 아래에 있고 `scrollY=0`, focus=`BODY`다.
- smoke clone은 name, notes, 5% rate를 prefill한다.
- immutable source도 `Editing ...`으로 표시한다.
- persisted source simulator도 `Impact preview · production calculation contract`로 표시한다.
- Integrity 13/59 exceptions에는 rate/age/owner/SLA/action이 없다.
- Lifecycle audit에는 pagination 외 filter/detail action이 없다.
- visible copy에 `Full Provider earning population`이 남아 있다.

### 코드

- selected policy approval request를 exact ID로 부르지 않고 general page를 policy page와 같은 `skip`으로 조회한 뒤 client filter한다.
- API는 이미 `GET /admin/tax-policy-approval-requests?policyVersionId=...`를 지원한다.
- nearest scheduled는 mixed workspace first page에서 client-side 계산한다.
- server actions의 success/error redirect가 Drafts view, exact policy, form state와 focus를 보존하지 않는다.
- History와 Drafts가 같은 7열 table을 사용한다.
- Tax Policy access/readiness와 Finance Approver governance가 하나의 capability truth를 공유하지 않는다.

### 기존 테스트

- Admin focused: 7 files / 29 tests PASS
- API focused: 2 files / 25 tests PASS

이 테스트 pass는 기존 계약만 보장한다. 이번 완료 조건을 검증하는 regression test를 추가해야 한다.

## 절대 보존할 기존 불변식

다음 기존 개선을 제거하거나 약화하지 않는다.

- ACTIVE, APPROVED, SCHEDULED, SUPERSEDED, ARCHIVED, REJECTED, LEGACY_REVIEW version은 immutable
- metadata/rule edit는 DRAFT에서만 가능
- maker는 자신의 approval request를 결정할 수 없음
- approval request와 receipt는 durable record
- approval payload hash와 stale-change protection
- create policy + optional fallback rule + audit의 transaction 원자성
- scheduled activation의 serializable transaction/advisory lock/one-ACTIVE 보호
- Vietnam time parsing과 명시적 ICT label
- exact audit domain query와 exact total
- integrity unavailable을 0으로 위장하지 않는 규칙
- retained financial references와 historical policy evidence

## 권한과 안전 경계

이 작업은 로컬 코드 수정과 non-destructive verification을 승인한다. 다음은 승인하지 않는다.

- 실제 정책 생성·수정·approval request·approve/reject·activation
- 실제 법령명·세율·승인자·운영자 값의 임의 생성
- ACTIVE smoke 정책 삭제, provenance 변경 또는 강제 비활성화
- tax log/settlement snapshot/history/audit 삭제
- shared 또는 operational DB에 fixture/smoke/test write
- destructive cleanup, reset, reseed, migration reset
- 관련 없는 admin IA 또는 finance domain의 광범위한 refactor

브라우저에서는 read-only navigation, filter, disclosure, drawer, theme, empty native validation까지만 실행한다. 실제 mutation 상태는 unit/integration test 또는 명시적 isolated disposable DB에서 검증한다.

현재 ACTIVE smoke는 금융 기록이 참조하므로 삭제하지 않는다. 이 작업에서는 안전한 replacement UI·server guard·runbook만 준비한다. 실제 production evidence, maker/checker, activation은 사람이 별도로 수행한다.

## 구현 요구사항

### Phase 0 — truth와 fail-closed 경계

#### P0-1. Production, test, smoke, legacy evidence를 구조적으로 분리한다

- History 기본값은 `Production history`다.
- 현재 enum/model을 확인해 governed production을 정확히 표현하는 provenance를 사용한다. 단순 이름/문자열 검색으로 production을 추정하지 않는다.
- `Test & legacy evidence`는 별도 source filter와 exact count로 제공한다.
- Lifecycle audit도 같은 source taxonomy를 사용한다.
- Integrity evidence row에 source를 증명할 수 있으면 Production/Test/Legacy badge를 표시한다.
- source를 증명할 수 없는 record는 production으로 간주하지 말고 `Unknown evidence source`로 표시한다.
- API total, pagination, empty state가 선택 filter와 정확히 일치해야 한다.
- unavailable과 zero results를 구분한다.

#### P0-2. Tax Policy와 Finance Approver가 같은 readiness/capability truth를 사용하게 한다

현재 Tax Policy service의 credential-exists 판정과 Finance Approver governance 구현을 함께 추적한다.

- 공통 `verified production finance actor` 또는 동등한 capability helper를 하나만 둔다.
- 최소한 다음을 truthfully 검사한다.
  - required admin/finance role
  - required category
  - production provenance
  - setup completion
  - credential 존재 및 disabled/locked 상태
  - 현재 시스템이 실제로 검증 가능한 session assurance
  - MFA/attestation이 정책상 필요하지만 시스템이 증명하지 못하면 explicit blocker
- UI summary, request preflight, request execution, decision preflight, decision execution이 같은 predicate를 사용한다.
- 증명되지 않은 상태를 `Verified`, `Ready`, `Independent approver ready`라고 표시하지 않는다.
- 부족한 조건은 stable error/blocker code로 fail closed한다.
- upstream auth token guard에만 암묵적으로 의존하지 말고 high-risk service boundary가 필요한 assurance를 명시적으로 검사한다.
- 다른 finance action 전체를 이번 범위에서 재작성하지 않는다. Tax Policy와 이 화면이 사용하는 Finance Approver summary/readiness의 truth를 우선 통일하고, 더 넓은 불일치는 구현 보고서의 별도 위험으로 남긴다.

#### P0-3. Fixture actor의 operational Tax Policy write를 차단한다

- smoke/fixture script와 테스트의 first-write guard를 추적한다.
- shared/local operational DB에서는 fixture actor가 Tax Policy write를 실행할 수 없어야 한다.
- DB integration이 필요하면 disposable DB/schema allowlist를 first write 전에 강제한다.
- env flag 하나만으로 shared DB write가 허용되지 않아야 한다.
- cleanup은 append-only audit를 삭제하는 방식이 아니라 disposable schema 폐기로 처리한다.
- 실제 shared DB의 기존 smoke records는 자동 정리하지 않는다.

#### P0-4. Non-production source의 silent production clone을 제거한다

- History row의 기본 action은 `Inspect` 또는 `Open` 하나다.
- `SMOKE_TEST`, seed, migration, legacy source에 직접 `Clone`을 제공하지 않는다.
- source detail 안에서만 `Prepare clean production draft`를 제공한다.
- non-production source에서는 name, notes, legal evidence, rate를 자동으로 production draft에 복사하지 않는다.
- source policy ID와 supersession lineage는 보존한다.
- 다음 두 축을 별도로 표시한다.
  - `Created by`
  - `Source lineage`
- source rules는 read-only comparison으로 제공하고, 새 draft에 반영할 값은 operator가 명시적으로 선택·입력하게 한다.
- client checkbox만으로 안전하다고 처리하지 않는다. clean-source review acknowledgement는 approval request 전에 server가 검증하고 durable evidence로 남겨야 한다.
- 기존 structured evidence로 정확히 표현할 수 있으면 재사용한다. 불가능할 때만 최소 schema/migration을 추가한다.

### Phase 1 — exact query와 mutation recovery

#### P1-1. Selected policy의 exact approval request/receipt를 로드한다

- API에 이미 존재하는 `policyVersionId` filter를 Admin load plan에서 사용한다.
- policy list pagination과 approval request pagination을 결합하지 않는다.
- selected policy가 있으면 exact ID로 pending와 decided receipt를 조회한다.
- exact request query 실패는 `No request`가 아니라 `Approval evidence unavailable`이다.
- pending request가 있는데 duplicate submission form이 나타나지 않아야 한다.
- receipt에는 가능한 범위에서 maker, checker, requested/decided time, decision, payload hash, scheduled/activation state를 보여 준다.
- exact-query regression test를 추가한다.

#### P1-2. Nearest scheduled activation을 전체 dataset에서 정확히 조회한다

- mixed first page에서 client 계산하지 않는다.
- server에서 `SCHEDULED`, `effectiveFrom >= now`, ascending, `take=1`을 조회한다.
- drafts가 25개 이상이거나 scheduled가 여러 개여도 가장 가까운 item을 반환한다.
- query failure는 `None`이 아니라 `Unavailable`이다.
- no scheduled item과 unavailable을 구분한다.
- 기존 list API를 좁게 확장하거나 작은 summary endpoint를 사용한다. 계산 authority를 중복하지 않는다.

#### P1-3. 모든 mutation의 작업 문맥과 값을 보존한다

다음 action을 모두 확인한다.

- create policy draft
- update draft metadata
- create rule
- update rule
- submit approval request
- approve
- reject

성공 시:

- `view=drafts` 유지
- 변경된 exact `policyId` 선택
- 적절한 editor/receipt anchor 유지
- create response가 반환한 실제 ID 사용
- success notice와 focus target 제공

실패 시:

- 400/401/403/409/422/500/timeout을 성공과 구분
- entered values와 selected policy 보존
- legal source, rationale, evidence 내용을 URL query에 넣지 않음
- form-level error summary와 field-level error를 함께 제공
- helper/error를 `aria-describedby`로 연결
- first invalid field에 focus
- stale/conflict에는 reload/review CTA 제공
- 중복 제출과 pending state를 fail closed 처리

기존 shared `useActionState` 또는 form-state pattern을 재사용한다. 새로운 form framework를 추가하지 않는다.

#### P1-4. Create/Prepare scroll과 focus를 실제로 완료한다

- 같은-view Create와 cross-view Prepare 모두 처리한다.
- async server-rendered target이 준비된 뒤 `scrollIntoView({ block: 'start' })`를 실행한다.
- section heading 또는 적절한 target에 `tabIndex=-1`과 programmatic focus를 제공한다.
- sticky view navigation 아래에 target이 가려지지 않도록 `scroll-margin-top`을 적용한다.
- reduced-motion을 존중한다.
- URL hash, target visibility, active element를 1440×1000 browser test로 검증한다.

### Phase 2 — Drafts workspace 재구성

#### P1-5. 반복되는 current-policy 영역을 줄인다

- `view=current`에서만 현재 expanded 6-fact command strip을 유지한다.
- Drafts, History, Integrity에는 compact risk banner를 사용한다.
- compact banner에는 다음만 포함한다.
  - active policy name/source
  - severity
  - 핵심 blocker 한 줄
  - Current detail 또는 governed replacement CTA
- critical smoke 위험은 숨기지 않지만 같은 6개 fact와 긴 alert를 반복하지 않는다.
- 1440×1000 첫 viewport에 현재 view title과 첫 queue/summary가 보여야 한다.

#### P1-6. Drafts를 real work queue로 만든다

selected policy가 없어도 header에서 다음 exact state를 제공한다.

- Needs author
- Awaiting checker
- Approved
- Scheduled
- verified independent approver readiness
- blocker summary
- Finance Approvers deep link

요구사항:

- count는 전체 server result를 사용한다. 첫 25건에서 추정하지 않는다.
- empty queue는 `No policy work is currently queued`와 다음 안전한 action을 제공한다.
- create CTA는 header와 form에서 중복 강조하지 않는다.
- actor가 create/request 권한이 없으면 active-looking primary action을 보여 주지 않는다.
- `Open withholding records`는 supporting/overflow action으로 낮춘다.
- page title/section copy는 운영 task 중심으로 정리한다. 필요하면 `Drafts & scheduled`를 `Policy work queue`로 바꾼다.

#### P1-7. Create form의 field contract를 명확히 한다

- visible required marker와 required legend
- legal source URL helper
- tax subject helper
- change summary helper
- `Change rationale and source`는 `Approval rationale / operator evidence`처럼 역할을 명확히 함
- field/server error slot을 layout shift가 과하지 않게 제공
- top error summary가 각 field error로 이동 가능
- CTA는 form 전체의 final action처럼 보이게 배치
- CTA 문구는 실제 동작에 맞게 `Save production draft` 또는 동등한 표현 사용
- creation never activates policy라는 설명은 유지
- native validation에만 의존하지 않음

### Phase 3 — History workspace 재구성

#### P1-8. Production history를 기본으로 하고 server filter/search를 구현한다

필수 source view:

- `Production history`
- `Test & legacy evidence (exact count)`

필수 filter:

- provenance/source
- lifecycle
- effective date from/to

필수 search:

- policy name
- policy ID
- legal source

요구사항:

- query state는 URL에 유지한다.
- server total, pagination, empty state가 filter/search와 일치한다.
- filter를 바꾸면 page를 1로 reset한다.
- refresh/pagination/detail 복귀 시 state를 잃지 않는다.
- production 0건이면 `No governed production policy history`를 명시한다.
- test/legacy 144건을 production history처럼 보이게 하지 않는다.

#### P1-9. History table을 5열로 줄이고 1440 overflow를 제거한다

기본 열:

1. `Policy / source` — name, revision, provenance badge, copyable short ID
2. `Lifecycle / effective` — lifecycle, Vietnam time
3. `Rule coverage` — rule count와 짧은 coverage summary
4. `Legal / approval` — source readiness와 receipt state
5. `Open` — `Inspect` 하나

요구사항:

- Drafts와 History가 같은 7열 table markup을 강제로 공유하지 않게 한다.
- primary History table에서 1440×1000 `scrollWidth <= clientWidth`가 성립해야 한다.
- action은 한두 줄 안에서 읽혀야 한다.
- full raw ID, 긴 evidence, secondary metadata는 detail/disclosure로 이동한다.
- row 전체를 button처럼 만들지 않는다. 명시적 link/action을 사용한다.
- generic global table CSS를 깨지 말고 History-specific class/layout을 사용한다.

#### P1-10. History detail을 inspection 중심으로 만든다

- immutable source heading은 `Reviewing source policy` 또는 동등한 문구를 사용한다.
- `Editing`을 사용하지 않는다.
- detail은 lifecycle, source lineage, legal evidence, rules, approval receipt, audit link를 제공한다.
- source policy와 새 draft form을 같은 편집 context처럼 보이게 하지 않는다.
- source detail → clean draft preparation의 순서를 명확히 한다.

### Phase 4 — Integrity와 audit를 action workspace로 전환

#### P1-11. Integrity summary를 actionable issue cards로 바꾼다

대상 issue:

- amount mismatch
- missing tax log
- missing immutable snapshot
- no active policy at earning time
- no approved tax profile
- no matching rule

각 issue는 server가 실제로 제공할 수 있는 범위에서 다음을 포함한다.

- exact count
- denominator와 rate
- severity와 명시적 판단 기준
- oldest affected time/age
- classification: current regression / legacy-migration debt / applicability-readiness / unknown
- owner와 SLA, 또는 `Owner not assigned` / `SLA not configured`라는 정직한 상태
- `Open records`

요구사항:

- non-zero issue는 0/healthy fact와 같은 neutral treatment를 사용하지 않는다.
- `No approved tax profile`은 금액 corruption이 아니라 applicability evidence 부족임을 설명한다.
- `Open records`는 실제 server-side filtered records를 연다.
- client-side 25-row sample filtering으로 exact queue를 가장하지 않는다.
- owner/SLA 모델이 없으면 가짜 owner나 시간을 만들지 않는다.

#### P1-12. Exact integrity evidence endpoint/list를 제공한다

현재 `/admin/earnings?range=30d&take=25` sample만으로 issue queue를 만들지 않는다.

- 기존 API를 안전하게 확장하거나 Tax Policy 전용 evidence endpoint를 만든다.
- 최소 query: issue, source, date range, sort, take, skip.
- issue filter는 summary와 같은 server truth를 사용한다.
- total과 rows를 함께 반환한다.
- `oldest` sort를 지원한다.
- audit/issue pagination state를 서로 다른 URL key로 관리한다. 하나의 `page`로 두 collection을 결합하지 않는다.
- row는 Partner/Booking, source, issue classification, earning tax/tax log, event time, exact booking finance link를 제공한다.
- Partner와 Booking을 한 cell로 합치는 등 1440 scanability를 우선한다.
- action copy는 `Open booking finance evidence`처럼 목적지를 명확히 한다.

#### P1-13. Lifecycle audit investigation을 구현한다

기본값:

- Production/operator events
- Test/smoke/legacy는 별도 source filter

필수 filter:

- action
- actor
- source/provenance
- policy ID
- date from/to

필수 detail:

- exact event ID
- exact target/policy link
- actor
- created time in ICT
- before/after 또는 제공 가능한 structured mutation evidence
- payload hash
- approval request/receipt
- activation attempt/failure code
- copy ID

요구사항:

- broad text search로 exact Tax Policy audit total을 만들지 않는다.
- filter와 exact domain predicate를 AND로 적용한다.
- dense metadata를 table cell에 모두 반복하지 말고 drawer/disclosure로 이동한다.
- deep link는 URL에 event ID를 유지한다.
- 없는 event/policy는 명시적 not-found와 recovery CTA를 제공한다.
- export를 제공한다면 filter state를 그대로 보존하고 민감정보를 확대 노출하지 않는다.

### Phase 5 — 문구, accessibility, theme

#### P1-14. Truthful copy로 교정한다

최소 교정:

| 현재 | 권장 방향 |
|---|---|
| Create new draft | Prepare production draft |
| Drafts & scheduled | Policy work queue |
| Editing `<immutable source>` | Reviewing source policy: `<name>` |
| Clone ... as a new draft | Prepare clean production draft from this source |
| Impact preview · production calculation contract | Saved source policy preview |
| Full Provider earning population | Full Partner earning population |
| Evidence | Open booking finance evidence |
| Legacy · review required | Test legacy · review required |
| Change rationale and source | Approval rationale / operator evidence |
| No approved tax profile | Tax profile not approved — applicability evidence missing |

프로젝트 내부 class/model 이름의 `provider`는 불필요하게 변경하지 않는다. 사용자에게 보이는 copy만 `Partner`로 통일한다.

#### P2-1. Accessibility

- 기존 landmark, heading, nav, table semantics를 유지한다.
- navigation link를 억지로 ARIA tab widget으로 바꾸지 않는다.
- 모든 input에 visible label을 유지한다.
- helper/error를 `aria-describedby`로 연결한다.
- error summary와 drawer의 focus lifecycle을 검증한다.
- Create/Prepare target focus를 검증한다.
- color만으로 Production/Test/Critical/Healthy를 구분하지 않는다.
- copy ID/action의 accessible name을 명확히 한다.
- sticky nav가 focus ring을 가리지 않아야 한다.

#### P2-2. Theme와 visual polish

- 기존 design token을 사용한다. 새 hard-coded color를 추가하지 않는다.
- light/dark에서 muted text, table border, warning/danger, disabled action, focus ring을 확인한다.
- non-zero issue severity는 dark에서도 구분돼야 한다.
- WCAG contrast를 측정하지 않았으면 통과했다고 주장하지 않는다.
- decorative redesign, gradient 남용, 카드 수 증가를 하지 않는다.
- 정보 밀도와 task priority를 우선한다.

## URL state 권장 계약

기존 계약과 충돌하지 않는지 먼저 확인한 뒤 의미가 겹치지 않는 URL key를 사용한다. 예:

```text
/tax-policy?view=drafts&queue=awaiting-checker&queuePage=1&policyId=...
/tax-policy?view=history&source=production&lifecycle=superseded&query=...&historyPage=1
/tax-policy?view=integrity&issue=missing-tax-log&source=production&evidencePage=1&sort=oldest
/tax-policy?view=integrity&auditSource=production&auditAction=tax_policy.activated&auditPage=1&auditEventId=...
```

- 선택되지 않은 다른 view의 stale param은 canonical URL에서 제거한다.
- filter/pagination helper를 중앙화하되 speculative abstraction을 만들지 않는다.
- query parameter와 API DTO/validation을 같은 allowlist로 관리한다.

## Performance 기준

- 기존 view-specific bounded `Promise.all` 패턴을 유지한다.
- 새 exact query 때문에 불필요한 serial waterfall을 만들지 않는다.
- count/summary와 row query는 가능하면 server에서 병렬 처리한다.
- 전체 725 audit events 또는 전체 earnings를 Admin Web로 보내 client filter하지 않는다.
- search/filter는 bounded, indexed query를 사용한다.
- 새 schema/index가 필요하면 실제 query plan과 기존 index를 먼저 확인한다.
- broad memoization이나 client state framework를 추가하지 않는다.

## Required tests

### API/security/data tests

1. selected policy approval query는 exact policy request만 반환
2. selected request가 general queue pagination과 무관함
3. nearest scheduled는 mixed first 25 밖의 earliest scheduled도 반환
4. scheduled query unavailable과 none을 구분
5. history production/test source total과 pagination 정확성
6. history provenance/lifecycle/date/search 조합
7. integrity summary count와 issue evidence total 일치
8. integrity oldest sort와 issue classification
9. audit source/action/actor/policy/date filter와 exact total
10. setup incomplete actor request/decision 거부
11. absent/disabled/locked credential 거부
12. 증명할 수 없는 required assurance는 explicit blocker/fail closed
13. fixture actor shared/operational DB Tax Policy write 거부
14. disposable test environment에서만 fixture write 허용
15. maker self-decision 거부 유지
16. role-only actor decision 거부
17. Finance readiness summary와 Tax Policy decision이 같은 predicate 사용
18. non-production source approval은 clean-source durable acknowledgement 없으면 거부
19. approval payload/stale protection 유지
20. one-ACTIVE/serialized activation 기존 테스트 유지

### Admin Web tests

1. Current만 expanded command strip 사용
2. Drafts/History/Integrity는 compact banner 사용
3. Drafts exact queue count와 approver blocker 표시
4. actor capability에 따른 CTA label/disabled/hidden 상태
5. success가 `view=drafts`, exact ID, anchor를 유지
6. validation/API failure가 values와 selected policy 보존
7. field helper/error의 `aria-describedby`
8. first invalid focus와 error summary link
9. exact pending request가 duplicate submit UI 억제
10. approval evidence unavailable을 no request로 표시하지 않음
11. non-production source가 unsafe values를 prefill하지 않음
12. immutable source에서 `Editing` 제거
13. saved-only simulator가 `Saved source policy preview`로 표시
14. History default production과 test/legacy exact count
15. History filters/search/pagination URL 보존
16. History 5열과 Inspect action
17. Integrity non-zero card의 exact Open records link
18. audit filters/detail deep link
19. visible Provider copy 제거
20. empty/unavailable/not-found/conflict state 분리

### Browser tests — 1440×1000만 필수

1. Drafts first viewport에 queue header/status가 보임
2. Create same-view target visibility와 focus
3. Prepare cross-view target visibility와 focus
4. invalid create form의 value/error/focus 보존
5. History production empty state
6. Test & legacy history filter와 exact count
7. History table `scrollWidth <= clientWidth`
8. History Inspect detail과 source lineage
9. Integrity issue cards와 filtered records
10. audit production/test filter와 event detail
11. booking finance evidence link
12. light/dark 상태

1024px 이하 viewport는 테스트, screenshot, 보고서, 완료 점수에 포함하지 않는다. 기존 공용 component를 수정해 우연히 작은 화면 회귀 위험이 생기면 코드 수준의 안전성은 유지하되, 이번 작업의 별도 mobile redesign 범위로 확장하지 않는다.

## 검증 명령

먼저 `package.json`의 실제 script를 확인하고 존재하는 명령만 실행한다. 최소 검증:

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- app/tax-policy/page.spec.tsx app/tax-policy/actions.spec.ts app/tax-policy/tax-policy-page-model.spec.ts app/tax-policy/tax-policy-audit-summary.spec.ts app/tax-policy/tax-policy-snapshot-consistency.spec.ts app/tax-policy/tax-policy-notice.spec.ts app/tax-policy/tax-policy-time.spec.ts

npm.cmd run test --workspace @massage-vn/api -- src/provider-onboarding/provider-onboarding.service.spec.ts src/earnings/tax-policy-withholding.spec.ts

npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run typecheck --workspace @massage-vn/api
npm.cmd run lint --workspace @massage-vn/admin-web
npm.cmd run lint --workspace @massage-vn/api
npm.cmd run build --workspace @massage-vn/admin-web
npm.cmd run build --workspace @massage-vn/api

npm.cmd run admin:visible-copy
npm.cmd run admin:query-guards
npm.cmd run tax-policy:fixture-cleanup:test
npm.cmd run tax-policy:fixture-cleanup:check
npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api
```

추가·변경된 test 파일은 focused command에 포함한다.

Prisma schema/migration, auth, shared types 또는 `AGENTS.md` protected area를 수정했다면 matching integration review와 다음 full verification을 수행한다.

```powershell
npm.cmd run verify:local
powershell -ExecutionPolicy Bypass -File .\infra\scripts\verify-local.ps1 -WithServices
```

실패가 발생하면 관련/비관련을 증거 없이 추정하지 않는다. 다음 독립 검증이 가능하면 계속 실행하고 PASS/FAIL/SKIPPED를 각각 기록한다.

DB integration은 disposable environment가 기술적으로 확인된 경우에만 실행한다. shared/operational DB이면 write test를 실행하지 말고 blocked 이유와 guard 결과를 보고한다.

## Visual verification

코드 수정 후 이전 screenshot을 재사용하지 않는다. 로그인된 실제 Admin build를 열어 새로 캡처하고 직접 검사한다.

필수 viewport:

- 1440 × 1000
- 선택 사항: 1680px 또는 1920px desktop

검사 항목:

- first viewport 정보 우선순위
- clipping/overflow/action wrapping
- exact count와 filter state
- production/test/unknown source 구분
- Create/Prepare scroll와 focus
- empty/unavailable/error/conflict/not-found 상태
- form error와 entered-value retention
- issue severity와 Open records
- audit filter/detail
- light/dark consistency

fresh evidence 폴더:

`C:\dev\massage-on-demand-vn\docs\audits\tax-policy-subviews-final-remediation-evidence-2026-08-14`

최소 screenshot:

1. Drafts first viewport
2. Draft form error state
3. exact selected approval receipt 또는 blocked state
4. History production view
5. History test/legacy view
6. History table no-overflow
7. source inspection/clean draft preparation
8. Integrity issue summary
9. filtered issue records
10. Lifecycle audit filters
11. audit event detail
12. dark theme

각 screenshot은 저장 후 직접 열어 확인한다. screenshot을 찍었다는 사실만으로 visual QA를 완료했다고 보고하지 않는다.

## Operational replacement runbook

현재 ACTIVE smoke를 코드 작업에서 바꾸지 않는다. 다음 파일이 없거나 현재 구현과 맞지 않으면 작성/갱신한다.

`C:\dev\massage-on-demand-vn\docs\runbooks\tax-policy-smoke-active-replacement.md`

필수 내용:

1. backup/read-only inventory
2. authoritative Vietnam legal/accounting evidence owner
3. clean production draft 생성
4. source lineage와 rule boundary review
5. 실제 production maker와 별도 checker
6. Vietnam effective time 예약
7. activation 직전/직후 one-ACTIVE 확인
8. calculation sample과 immutable snapshot 확인
9. approval receipt, payload hash, activation audit 확인
10. 문제 발생 시 기존 policy 직접 편집/삭제가 아니라 corrective version 사용
11. 기존 smoke policy와 5 tax logs/5 snapshots 보존
12. 각 단계 stop/abort 조건

실제 법령, 세율, 사람 이름은 작성하지 말고 required placeholder와 owner를 표시한다.

## 완료 기준

### Code-complete

다음을 모두 만족해야 code-complete다.

1. Tax Policy와 사용 중인 Finance Approver readiness가 같은 capability truth를 사용
2. fixture actor의 operational write가 차단됨
3. production/test/legacy/unknown evidence가 분리됨
4. non-production source의 silent clone과 approval이 차단됨
5. exact selected approval request가 로드됨
6. nearest scheduled가 전체 dataset 기준으로 정확함
7. mutation success/error가 Drafts context와 values를 보존함
8. field errors와 focus가 접근 가능함
9. Create/Prepare scroll+focus가 실제 browser에서 통과함
10. Drafts 첫 viewport에 queue/readiness가 보임
11. History production/test filter와 server total이 정확함
12. History 1440 horizontal overflow가 0임
13. Integrity exceptions가 exact filtered records로 연결됨
14. Lifecycle audit filters/detail/deep link가 동작함
15. misleading copy가 제거됨
16. focused tests, typecheck, lint, build, scope verification 결과가 보고됨
17. fresh authenticated screenshots가 저장·검사됨

### Operational release

다음은 code-complete와 별개다. 사람의 실제 운영 증거 없이는 완료로 표시하지 않는다.

1. 실제 법률/회계 근거 입력
2. 실제 production operator draft
3. 실제 별도 Finance checker 승인
4. ACTIVE smoke의 governed scheduled replacement
5. activation과 새 immutable financial evidence 확인
6. retained smoke references 보존 확인
7. 실제 두 계정 end-to-end 검증

이 단계가 수행되지 않았으면 최종 판정은 반드시 다음처럼 분리한다.

`Code remediation complete/partial; operational release still blocked.`

## 구현 보고서

완료 후 다음 파일을 작성한다.

`C:\dev\massage-on-demand-vn\docs\audits\tax-policy-subviews-final-remediation-implementation-2026-08-14.md`

필수 내용:

1. 결론: code-complete와 operational release 분리
2. 재감사 요구사항별 `완료 / 부분 완료 / 차단` 표
3. 변경 파일과 변경 목적
4. Admin IA/component/copy 변경
5. API/query/data/security 계약 변경
6. schema/migration/index 변경과 이유
7. test/verification 명령별 PASS/FAIL/SKIPPED 및 실제 수치
8. 1440 browser 실측 결과
9. fresh screenshot 목록
10. protected area touched 여부와 full verification 결과
11. DB mutation, approval, activation, destructive cleanup을 하지 않았다는 확인
12. 기존 사용자 변경을 보존했다는 확인
13. 남은 위험과 실제 사람에게 필요한 운영 단계
14. 다음 한 가지 권장 작업

## Stop rules

- 실제 legal evidence, rate, production actor 또는 checker가 없으면 값을 만들지 않는다.
- shared DB write가 필요한 검증은 실행하지 않는다.
- schema/auth 변경 없이는 안전한 server evidence를 남길 수 없다면 최소 protected-area 변경과 검증을 수행하되 이유를 보고한다.
- 현재 시스템이 MFA/session assurance를 증명하지 못하면 `verified`를 가정하지 말고 explicit blocker로 남긴다.
- unrelated broad refactor가 필요해 보이면 이번 completion criteria에 필요한 최소 경계까지만 수정한다.
- ACTIVE smoke를 자동 교체·삭제하지 않는다.
- 핵심 요구와 검증을 완료하면 추가 장식이나 새 기능으로 범위를 넓히지 않는다.

## 최종 응답 형식

결론부터 작성한다.

- code-complete 여부
- operational release 여부
- 가장 중요한 변경 5개 이내
- 테스트 PASS/FAIL/SKIPPED 수치
- fresh evidence/구현 보고서 링크
- 남은 blocker
- 다음 한 가지 권장 작업

실패·미검증·운영 blocker를 숨기지 않는다. 테스트가 통과했더라도 실제 production policy와 maker/checker가 준비되지 않았다면 출시 가능이라고 말하지 않는다.

---

## 기대 결과

이 작업의 성공 기준은 카드나 색을 추가하는 것이 아니다. 화면, API와 데이터가 같은 truth를 사용하고 운영자가 다음 행동을 실수 없이 선택할 수 있어야 한다.

- Drafts는 실제 작업 queue다.
- History는 production evidence와 test evidence를 혼동하지 않는다.
- Integrity는 숫자 보고서가 아니라 처리 가능한 exception workspace다.
- Audit는 exact investigation tool이다.
- smoke source는 production evidence로 조용히 승격되지 않는다.
- code 완료와 실제 운영 출시가 명확히 분리된다.

