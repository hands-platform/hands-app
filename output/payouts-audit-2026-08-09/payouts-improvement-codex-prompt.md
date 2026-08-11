# `/payouts` 개선 구현용 Codex 프롬프트

아래 `START OF PROMPT`부터 `END OF PROMPT`까지 복사하여 `C:\dev\massage-on-demand-vn`을 작업공간으로 연 Codex에 전달한다.

이 프롬프트는 `payouts-deep-audit-report.md`의 지적사항을 실제 코드로 수정하기 위한 실행 지시서다. 단순 재감사나 제안서 작성용이 아니다.

---

## START OF PROMPT

`C:\dev\massage-on-demand-vn` 프로젝트의 HANDS Admin `/payouts`를 실제 Finance 운영자가 정확하고 빠르게 사용할 수 있는 Partner Money command surface로 개선해라. 감사 보고서를 다시 요약하는 데서 끝내지 말고, 관련 Admin Web·API·도메인 계산·테스트를 실제로 수정하고 로그인된 1440px 화면에서 직접 검증해라.

이번 작업의 핵심은 “화면을 예쁘게 만드는 것”보다 다음 세 가지다.

1. `Clear`, `MATCHED`, 금액, 건수가 정확히 같은 데이터 범위를 뜻하게 만들기
2. 지급 전 release blocker와 지급 후 reconciliation repair를 분리하기
3. Payout batch와 Wallet withdrawal을 한 화면에 과도하게 쌓지 않고 한 번에 한 운영 업무만 처리하게 만들기

### 1. 반드시 먼저 확인할 자료

작업 전 다음 자료를 직접 읽고 현재 코드와 대조해라.

1. 저장소와 하위 경로에 적용되는 모든 `AGENTS.md`
2. `C:\dev\massage-on-demand-vn\output\payouts-audit-2026-08-09\payouts-deep-audit-report.md`
3. 같은 폴더의 `01`~`22` PNG 화면 증빙
4. `apps/admin_web/app/payouts/` 전체
5. `apps/admin_web/lib/admin-api.ts`의 조회·오류 처리 계약
6. payout/withdrawal/earning/accounting/reconciliation을 담당하는 API와 서비스 코드
7. payout·withdrawal·finance 관련 기존 테스트
8. 공용 Admin page, table, filter, action menu, dialog, drawer, notice, status badge, money/date formatter
9. `apps/admin_web/app/globals.css`의 payout 관련 selector와 기존 디자인 토큰

보고서의 과거 line number를 맹목적으로 따르지 말고 현재 소스에서 동일한 로직을 다시 찾아라. 현재 구현이 이미 수정된 항목은 중복 구현하지 말고, acceptance criteria로 재검증해라.

먼저 `git status`를 확인하고 현재 worktree의 사용자 변경을 보존해라. 관련 없는 수정, 자동 포맷, 대량 줄바꿈 변경, 파일 삭제, reset/checkout을 하지 마라.

간단한 실행 계획을 세운 뒤 구현을 계속 진행해라. 코드와 데이터에서 확인할 수 없는 금융 정책만 blocker로 보고하고, 컴포넌트 분리·이름·쿼리 구조 같은 구현 선택은 합리적으로 결정해라.

### 2. 범위와 완료 목표

최종 결과는 다음을 모두 만족해야 한다.

1. 1440px 이상 데스크톱에서 현재 처리할 지급 업무를 첫 화면에서 판단할 수 있다.
2. API 실패, partial data, 빈 필터 결과, 실제 정상 0건을 서로 다르게 표시한다.
3. Money flow의 모든 금액과 MATCHED/MISMATCH 판정은 동일한 batch 집합을 사용한다.
4. 49건의 bank match pending 같은 전역 위험이 빈 선택 필터 때문에 `Clear`로 바뀌지 않는다.
5. PAID/CANCELLED 배치는 지급 전 Release blocker에 포함되지 않는다.
6. Payout batches, Wallet withdrawals, Reconciliation 중 선택한 한 업무만 row 단위로 로드하고 표시한다.
7. 한 행에는 가장 안전한 primary action 하나만 보이고, 나머지 증거와 액션은 drawer 또는 More 메뉴에 있다.
8. 기존 maker-checker, server preflight, exact ID confirmation, concurrency check, reversal evidence, accounting journal 안전장치를 유지하거나 강화한다.
9. 검색·필터·페이지·선택 상태가 URL로 재현되고 action 확인·취소·완료 후에도 유지된다.
10. 관련 기존 테스트와 새 회귀 테스트가 모두 통과하고, 1440×900 before/after 화면을 직접 열어 검수한다.

1024px 이하 반응형/모바일 UI는 이번 작업의 검사·완료 범위에서 완전히 제외한다. 모바일 재설계나 모바일 QA에 시간을 사용하지 마라. 기존 작은 화면 코드를 의도적으로 손상시키지는 말되, 완료 판정과 스크린샷은 1440px 이상만 사용한다.

### 3. 변경하면 안 되는 금융 안전장치

다음 동작은 현재 구현의 장점이며 보호 대상이다.

- Payout transfer evidence 변경 시 full payout batch ID 재입력
- 10자 이상 변경 사유
- expected status / transfer ref / notes를 이용한 optimistic concurrency 검사
- 증빙 변경의 before / after / reason audit log
- PAID closeout은 PROCESSING 상태에서만 가능
- PAID closeout은 FINANCE_APPROVER 권한 필요
- processing maker와 paid approver 분리
- transfer reference가 없으면 paid closeout 차단
- withdrawal paid closeout의 maker-checker
- payout/withdrawal reversal의 별도 Finance approver
- reversal reason, bank reversal reference, private evidence URL 또는 attachment 요구
- reversal ledger와 current-period accounting journal
- 서버가 UI와 독립적으로 preflight와 상태 전이를 다시 검증

UI 단순화를 이유로 이 조건을 숨기거나 삭제하지 마라. row에서 drawer/dialog로 이동시키는 것은 가능하지만 서버 검사는 그대로 유지해야 한다.

### 4. P0 — 반드시 구현할 항목

#### P0-A. 조회 실패를 0건·Clear·MATCHED로 표시하지 않기

현재 `/payouts`는 여러 `adminGet(..., fallback)`을 병렬 호출하며 실패한 응답을 `[]` 또는 `null`로 바꿀 수 있다. 이 fallback으로 KPI 0, 빈 table, `Clear`, `MATCHED`를 만들면 안 된다.

구현 요구사항:

- payout batches, payout summary, money flow, withdrawal rows, withdrawal summary, policy, earnings 각각 성공/실패 상태를 보존해라.
- `adminGetResult` 또는 동등한 typed result를 사용해 `ready | partial | error`를 구분해라.
- 한 panel의 API 실패가 다른 panel 전체를 막지는 않게 하되, 실패한 panel은 정상 판정을 만들지 못하게 해라.
- 오류 상태에 `Data unavailable`, 대상 데이터, 재시도 방법, 마지막 요청/성공 시각을 표시해라.
- stale data를 보여줄 경우 `Stale`과 마지막 성공 시각을 표시하고 금액 변경 action은 실행 시 live server preflight를 다시 요구해라.
- 401/403/404/429/500을 정상 empty state로 바꾸지 마라.
- summary 실패 시 목록 10개만으로 전체 KPI를 추정하지 마라.
- rows 실패 시 summary 숫자만 보고 현재 table이 정상 로드됐다고 표시하지 마라.

권장 계약:

```ts
type FinancePanelResult<T> = {
  status: 'ready' | 'partial' | 'error';
  data: T | null;
  generatedAt: string | null;
  lastSuccessfulAt?: string | null;
  errorCode?: string;
  retryable?: boolean;
};
```

#### P0-B. Money flow의 데이터 범위를 하나로 통일

현재 All dates 화면은 전체 159개 payout summary의 `64,440,000 VND`와 현재 로드된 10개 배치의 service evidence `5,250,000 VND`를 같은 Money flow에 표시하면서, gap은 현재 10개 batch끼리 계산해 `0 / MATCHED`라고 판정한다.

이 문제를 다음 중 하나의 명확한 방식으로 해결해라.

권장 방식:

- API가 선택한 전체 range에 대해 gross, payout net, evidence net, platform fee, withholding, cash debt, gap, scope count를 aggregate한다.
- UI는 이 aggregate만 사용해 Money flow와 verdict를 렌더링한다.
- 목록 pagination rows를 전역 reconciliation 계산에 사용하지 않는다.

허용 가능한 대안:

- 현재 페이지 10건만 계산한다면 모든 값에 `Visible 10 of 159 batches` scope를 적용하고 전체 summary 금액을 절대 섞지 않는다.

최소 계약:

```ts
type PayoutMoneyFlowSummary = {
  scope: 'selected-range' | 'visible-page';
  scopeBatchCount: number;
  totalBatchCount: number;
  evidenceBatchCount: number;
  grossAmount: number;
  payoutNetAmount: number;
  evidenceNetAmount: number;
  platformFeeAmount: number;
  withholdingAmount: number;
  cashDebtAmount: number;
  netGap: number;
  completeness: 'complete' | 'partial' | 'unavailable';
  verdict: 'MATCHED' | 'MISMATCH' | 'NOT_EVALUATED';
  generatedAt: string;
};
```

판정 규칙:

- `MATCHED`는 동일 scope, complete evidence, API 성공이 모두 충족될 때만 가능하다.
- `partial`, `error`, 서로 다른 batch count는 `NOT_EVALUATED`다.
- top withheld tax와 Money flow tax가 다른 범위라면 각각 정확한 scope label을 붙이거나 하나로 통일해라.
- `4 check(s)`처럼 check 종류 개수를 문제 건수처럼 표시하지 마라.

#### P0-C. Withdrawal false-clear 제거

현재 server summary는 `Paid / bank match pending 49`를 보여주지만 기본 선택 `Review required 0`의 visible rows를 기준으로 section header가 `Clear`가 된다.

구현 요구사항:

- section/global health는 server summary의 전역 open counters로 계산해라.
- 선택 필터가 0건이면 `No records in Review required`라고 표시해라.
- 전역 open risk가 있으면 header warning을 유지하고 `49 bank matches pending`을 함께 보여라.
- `Showing 10 of 49 bank matches pending`처럼 현재 페이지와 전체 건수를 구분해라.
- Requested, Review required, Bank transfer pending도 visible rows가 아니라 summary count를 사용해라.
- summary가 실패하면 0으로 추정하지 말고 unavailable로 표시해라.
- 기본 queue는 `All open` 또는 가장 높은 우선순위의 non-zero action queue로 정해라.
- 미해결 active backlog는 생성일 range 때문에 사라지지 않게 한다. History/closed records만 range filter를 적용하거나, UI에서 `Outstanding backlog`와 `Selected period`를 명확히 분리해라.

#### P0-D. 지급 전 blocker와 지급 후 repair를 분리

현재 API preflight는 PAID batch에도 `PAYOUT_STATUS_NOT_PAYABLE`, wallet balance insufficient, paid evidence incomplete를 함께 반환하고, UI는 blocker와 warning을 하나의 `payoutBlockingReasons`로 합쳐 Release blocker에 넣는다.

다음 phase 계약으로 분리해라.

```ts
type PayoutRiskModel = {
  phase: 'PRE_RELEASE' | 'IN_TRANSFER' | 'POST_PAYMENT' | 'ARCHIVED';
  releasePreflight: {
    allowed: boolean;
    blockers: FinanceFinding[];
    warnings: FinanceFinding[];
  } | null;
  reconciliationFindings: FinanceFinding[];
};
```

요구사항:

- `DRAFT`, `FAILED`, `PROCESSING`만 지급 전 queue에 포함할 수 있다.
- `PAID`의 missing wallet ledger, missing GL journal, withholding mismatch, missing historical ref는 `Post-payment evidence repair`로 보낸다.
- `CANCELLED`는 release action 대상이 아니다. 필요한 audit finding만 archive/reconciliation에 둔다.
- Release blocker 설명에서 PAID 배치에 `should not be paid`, `before marking paid`, `cannot advance to paid`를 표시하지 마라.
- Partner finance queue의 recent negative wallet movement 조건에 terminal 상태를 포함하지 마라.
- 최근 5개 wallet movement 합계를 지급 가능 잔액처럼 사용하지 마라. 필요한 경우 현재 wallet balance, open reservations, target amount를 동일 snapshot에서 비교해라.
- 한 batch가 Release blocker, Partner finance queue, Batch list에 같은 이유로 세 번 반복되지 않게 primary queue를 하나 정해라.

#### P0-E. Payout batches와 Wallet withdrawals를 업무 view로 분리

현재 한 Operations/Records 문서 안에 다음이 연속 렌더링된다.

- Needs action
- Money flow
- Release blocker
- Partner finance queue
- Wallet withdrawals
- Payout batch list

이를 같은 `/payouts` route 아래의 명확한 view로 분리해라.

권장 구조:

```text
/payouts?view=batches
  - Review
  - Processing
  - Release blocked
  - Paid history

/payouts?view=withdrawals
  - Requested
  - Bank correction / review
  - Bank transfer pending
  - Paid / bank match pending
  - Reconciled / reversed history

/payouts?view=reconciliation
  - Bank unmatched
  - Ledger / GL incomplete
  - Tax evidence mismatch
  - Reference repair
  - Reversal history
```

요구사항:

- 별도 상위 navigation page를 늘리지 말고 `/payouts` 내부 segmented tabs를 사용해라.
- 기본 view는 `batches`의 열린 지급 업무다.
- 선택한 view의 rows와 무거운 preflight만 fetch/render해라.
- 공통 상단 summary가 필요하면 가벼운 aggregate endpoint만 사용해라.
- withdrawal view가 아니면 withdrawal rows와 reversal approver directory를 로드하지 마라.
- batch view가 아니면 full payout table/preflight rows를 로드하지 마라.
- 기존 `details=all`, `view=audit`, `view=records` URL은 안전하게 새 view로 normalize하거나 redirect해 bookmark를 깨뜨리지 마라.
- Release policy는 `/operations-policy`를 single source of truth로 유지하고 payout 화면에는 적용값/영향 요약과 deep link만 둔다.

#### P0-F. API와 UI의 scope·상태 contract 테스트

summary와 list가 같은 `range`, business time zone, status semantics를 사용하도록 명시적 contract를 만들어라.

- 모든 aggregate에 `generatedAt`, `range`, `timeZone`, `scopeCount`를 포함해라.
- active outstanding queue와 historical selected range를 구분해라.
- API partial failure가 UI health badge에 전달되도록 해라.
- action 실행 전에는 표시 시점의 summary가 아니라 대상 record의 live preflight를 서버에서 다시 계산해라.

### 5. P1 — 운영 효율 개선

#### P1-A. 기본 화면과 KPI 단순화

현재 기본 Today가 모두 0이어도 KPI 8개가 첫 화면을 차지한다.

상단 primary health는 최대 네 개로 줄여라.

- Payout review
- Transfers in progress
- Bank matches pending
- Post-payment evidence repair

요구사항:

- `Total batches`, `Total net`, `Withheld tax`, `Settled`는 period summary 또는 Records/History의 보조 영역으로 낮춘다.
- `Today created 0`과 `Open backlog N`을 구분한다.
- `Payout holds`는 `Active partner account holds`로 명명한다.
- unbatched cash debt는 `Unbatched cash-debt earnings`로 별도 표시한다.
- 모든 KPI는 클릭 시 정확한 queue로 이동해야 한다.
- 0인 카드 여러 개를 반복하지 말고 compact clear state로 축소한다.

#### P1-B. Payout batch 검색·필터·정렬

서버 기반으로 다음을 구현해라.

- Search: batch ID, partner name, partner phone, transfer reference
- Queue: Review, Processing, Release blocked, Post-payment repair, Paid history
- Status
- Finding/evidence: missing ref, bank issue, tax mismatch, ledger/GL mismatch
- Amount range
- Age/SLA
- Owner/assignee가 현재 모델에 존재하는 경우 owner
- Sort: severity, oldest, highest amount, newest

요구사항:

- URL query로 재현 가능해야 한다.
- 적용된 필터를 table 위 제거 가능한 chip으로 표시한다.
- `Clear filters`를 제공한다.
- 검색어 길이를 제한·정규화하고 query injection/N+1을 만들지 마라.
- owner 모델이 없으면 가짜 owner를 만들지 말고 report에 데이터 모델 gap으로 남겨라.

#### P1-C. Wallet withdrawal 검색·필터

- Search: request ID, partner name/phone, transfer ref, bank last4
- Queue/status
- Reconciliation: unmatched/matched
- Evidence: attachment missing, transfer date missing, maker missing, journal missing
- Age/SLA
- Approver/owner가 현재 모델에 존재하는 경우

Paid unmatched는 현재 page count와 total count를 항상 함께 표시한다.

#### P1-D. Compact payout batch table

1440px Admin content 폭 약 1,050px에서 빠르게 비교 가능한 구조로 바꿔라.

| 열 | 내용 |
|---|---|
| Partner / Batch | partner name·phone, short batch ID, copy/open |
| Amount | net amount, withholding 보조 |
| Stage | Review / Processing / Paid / Repair |
| Primary issue | 가장 중요한 blocker 또는 reconciliation finding 하나 |
| Transfer evidence | ref, bank, evidence 상태 |
| Age / Owner | queue age, SLA, owner가 있을 때 |
| Next action | primary action 하나 + More |

요구사항:

- 기본 행 높이 80~112px, 최대 128px를 목표로 한다.
- full earning/tax/operator/preflight evidence는 drawer에서 보여라.
- 긴 ID/ref는 ellipsis + accessible full value + copy를 제공한다.
- Action 열이 1440px에서 잘리거나 한 글자씩 줄바꿈되면 안 된다.
- `.payout-batch-list-card` class를 단순히 붙여 1,840px table을 만드는 것으로 끝내지 마라.
- 필요한 경우 제한된 수평 스크롤은 허용하지만 primary columns와 action은 첫 viewport에서 읽혀야 한다.

#### P1-E. Withdrawal reversal form을 단일 drawer/dialog로 이동

현재 paid/unmatched 10개 행마다 reason, reference, evidence URL, approver, submit form이 반복된다.

- row에는 `Match bank evidence`, `Open journal`, `More`만 둔다.
- `Reverse paid withdrawal` 선택 시 하나의 drawer/dialog를 렌더링한다.
- drawer를 열기 전에는 reversal input과 approver directory를 로드하지 않거나 짧은 safe cache를 사용한다.
- drawer에는 partner, amount, bank, transfer ref, paid actor/time, maker, expected journal, approver, reason, evidence를 표시한다.
- destructive action은 focus trap, Escape/Cancel, trigger focus return을 지원한다.
- 중복 제출을 막고 서버 오류 시 입력값을 보존한다.
- existing maker-checker와 reversal evidence requirement를 절대 완화하지 마라.

#### P1-F. Transfer evidence editor와 action URL 수정

현재 withdrawal saved view에서 `Review transfer`를 누르면 withdrawal hash가 유지되어 editor가 아래에 열려도 브라우저가 withdrawal section에 머문다.

- batch action은 withdrawal hash를 제거하고 selected batch drawer 또는 `#selected-payout-transfer`에 정확히 focus해라.
- 필터/페이지/정렬은 안전한 return context로 보존해라.
- `returnTo`를 사용하면 내부 `/payouts` 경로만 허용해 open redirect를 막아라.
- editor는 2~3열로 구성하고 full batch ID confirmation은 전체 폭으로 둔다.
- `Close editor`, Cancel, action 완료 후 원래 batch queue와 row로 돌아가야 한다.
- 현재 페이지 10개에 없는 selected batch는 ID로 별도 조회하거나 명확한 not-found를 보여라.

#### P1-G. Processing/Paid confirmation 강화

모든 payout confirmation에 다음을 표시해라.

- partner name/phone
- amount와 currency
- bank name/account last4
- short ID와 full batch ID 확인 방법
- current stage
- transfer reference/evidence state
- maker와 approver 요구
- 예상 accounting boundary 또는 journal
- 서버 preflight의 허용/차단 이유

버튼 문구:

- `Processing` → `Start transfer preparation`
- `Paid` → `Approve paid closeout`
- `Failed` → `Record transfer failure`
- reversal은 기존 위험 문구를 유지하되 대상과 회계 영향을 명확히 표시

서버가 차단하면 direct query URL로 확인창을 열어도 submit이 불가능해야 한다.

#### P1-H. Queue age, SLA, owner

- 각 actionable row에 queue entered at 또는 가장 정확한 action start timestamp를 사용해 age를 표시해라.
- 실제 SLA 정책이 코드/설정에 있을 때만 SLA를 표시해라.
- 임의 SLA 시간이나 owner를 만들지 마라.
- 데이터가 없다면 `Not assigned`, `SLA not configured`처럼 명확히 표시하고 별도 모델 개선 항목으로 남겨라.

### 6. Release policy와 Reconciliation 정리

#### Release policy

- Operations Policy가 canonical 설정 원천이다.
- payout 화면에는 current value, effect, last updated, deep link만 compact하게 표시한다.
- policy panel의 `max-height + overflow-y:auto` 중첩 세로 스크롤을 제거한다.
- payout KPI 8개를 policy view에서 반복하지 마라.

#### Reconciliation

- `Audit evidence`를 운영자가 이해하기 쉬운 `Reconciliation`으로 변경한다.
- Bank unmatched, ledger/GL incomplete, tax evidence mismatch, historical ref repair, reversal history로 분류한다.
- `Already batched`, `Service options`, `Status lanes`가 전체 범위인지 visible page인지 제목에 명시한다.
- aggregate가 전체 범위를 뜻하면 서버 전체 aggregate를 사용한다.
- `Release blocker`와 동일 finding을 중복 렌더링하지 마라.

### 7. 운영 문구 기준

다음 문구를 반영해라.

| 현재 | 권장 |
|---|---|
| `4 signal(s)` | 실제 open issue 합계 또는 `1 batch needs review` |
| `4 check(s)` | `0 mismatches`, `N issues`, `Not evaluated` |
| `Clear` | 전체 정상일 때만 사용 |
| 빈 선택 필터 | `No records in this filter` |
| `10 bank match pending` | `Showing 10 of 49 bank matches pending` |
| PAID의 `Release blocker` | `Post-payment evidence repair` |
| `Partner-facing payout readiness queue` | `Partner payout readiness queue` |
| `Row` | `Open batch {shortId}` 또는 구체적 action |
| `Review amount` | `Net payout awaiting review` |
| `Payout holds` | `Active partner account holds` |
| cash debt | `Unbatched cash-debt earnings` |
| `Processing` | `Start transfer preparation` |
| `Paid` | `Approve paid closeout` |
| `item(s)`, `row(s)`, `batch(es)` | 정상 plural formatter |

다음 상태를 서로 바꿔 쓰지 마라.

- `Clear`: 전체 source가 성공했고 실제 issue가 0
- `No records`: 현재 선택 filter 결과만 0
- `Not evaluated`: 범위/증빙/소스가 부족해 판정 불가
- `Data unavailable`: API 실패
- `Partial`: 일부 데이터만 성공
- `Matched`: 동일 scope의 완전한 증빙이 일치

### 8. 접근성과 1440px 시각 기준

- 현재 정상적인 `h1 → h2 → h3` 구조와 control accessible names를 유지해라.
- 상태를 색상만으로 전달하지 마라.
- table header association을 유지해라.
- action menu/dialog/drawer의 accessible name에 partner 또는 batch short ID를 포함해라.
- drawer/dialog의 초기 focus, Tab/Shift+Tab, Escape, Cancel, trigger focus return을 검증해라.
- dynamic success/error는 적절한 live region으로 알린다.
- disabled action의 차단 이유를 keyboard와 screen reader로 확인할 수 있어야 한다.
- 1440×900에서 글자 겹침, action 잘림, 과도한 줄바꿈, 이중 스크롤, 불명확한 primary action이 없어야 한다.
- 1024px 이하 테스트와 수정은 완료 조건에 포함하지 마라.

### 9. 성능 요구사항

감사 시 paid/unmatched 화면의 실측값은 다음과 같다.

- document height: 12,415px
- DOM nodes: 2,188
- links: 130
- forms: 11
- visible input/select: 40
- rows: 30
- tables: 14

목표:

- active view 하나만 렌더링
- 기본 view document height 5,000px 이하를 목표
- 기본 list DOM nodes 1,500 이하를 목표
- row 화면에서 forms 0, 열린 drawer에 form 1개
- row 화면 visible controls 15개 안팎
- 10개 row를 현실적인 스크롤 거리에서 비교 가능
- server pagination 유지
- approver directory는 reversal drawer를 열 때만 fetch 또는 safe cache
- accounting preview는 row마다 nested table을 만들지 않는 compact semantic 구조 고려
- N+1 query를 추가하지 않기
- 실제 query와 render 구조를 측정한 뒤 필요한 최적화만 적용하기
- 복잡한 cache layer를 추측으로 추가하지 않기

수정 전후 warm navigation, DOM nodes, forms/controls, document height를 같은 1440×900 상태에서 측정해 최종 보고에 포함해라.

### 10. 회귀 테스트 — 기존 테스트 통과만으로 완료 금지

현재 감사 시점 기준 테스트는 통과했다.

- Admin Web payout: 15 files / 108 tests passed
- API payout: 87 tests passed
- API withdrawal: 28 tests passed

그러나 이 테스트들은 scope 혼합과 false-clear를 충분히 잡지 못한다. 다음 테스트를 추가해라.

#### Admin Web / presenter 테스트

1. payout summary API 실패 시 KPI 0 또는 Clear가 표시되지 않음
2. batch list 실패와 정상 empty state가 다르게 표시됨
3. Money flow partial/error에서 MATCHED가 표시되지 않음
4. 동일 scope 159개 aggregate가 complete일 때만 MATCHED 가능
5. visible-page 대안이면 `10 of 159`가 표시되고 전체 금액이 섞이지 않음
6. server summary `paidUnreconciled=49`, selected Review required 0에서 header warning 유지
7. empty selected filter는 `No records in this filter`
8. PAID batch가 Release blocker에 나타나지 않음
9. PAID evidence anomaly가 Reconciliation repair에 나타남
10. terminal batch의 negative recent movement가 pre-release Partner finance queue에 나타나지 않음
11. view=batches에서 withdrawal rows/reversal forms가 렌더링되지 않음
12. view=withdrawals에서 payout batch table이 렌더링되지 않음
13. paid/unmatched 10개 row에 reversal form이 10개 생기지 않음
14. selected reversal drawer에 form 1개만 존재
15. Review transfer가 withdrawal hash가 아닌 selected batch editor/drawer를 연다
16. action cancel/complete 후 view/filter/page/sort 유지
17. Processing confirmation에 partner, amount, bank, batch ID 포함
18. keyboard dialog/drawer focus lifecycle

#### API / 도메인 테스트

1. payout Money flow aggregate가 list pagination과 독립적
2. aggregate의 scopeBatchCount/evidenceBatchCount/completeness/verdict 계약
3. partial evidence는 NOT_EVALUATED
4. DRAFT/FAILED/PROCESSING만 release preflight 대상
5. PAID findings는 reconciliation findings로 분리
6. PAID/CANCELLED가 release blocker query에 포함되지 않음
7. payout paid closeout maker-checker 유지
8. withdrawal paid closeout maker-checker 유지
9. reversal separate approver/evidence/journal 유지
10. concurrent transfer evidence update conflict 유지
11. full batch ID reconfirm 불일치 차단 유지
12. outstanding queue와 selected historical range semantics 테스트
13. summary/list failure 또는 partial response contract 테스트

#### 1440px 브라우저 검증

로그인 세션이 있는 in-app browser가 사용 가능하면 그것을 사용해 다음 상태를 1440×900으로 캡처해라.

- 기본 Payout batches open work
- Review queue
- Processing queue
- Release blocked queue
- Wallet withdrawals summary
- Paid / bank match pending 49건 view
- Reconciliation / post-payment repair
- 정상 empty filter와 global warning이 함께 있는 상태
- Data unavailable/partial 상태
- Transfer evidence drawer/editor
- Processing confirmation
- blocked Paid confirmation
- withdrawal reversal drawer

스크린샷 파일을 저장하는 것만으로 완료하지 마라. 각 이미지를 직접 열고 숫자 범위, 문구, 글자 잘림, table 폭, primary action, 이중 스크롤, false-clear 여부를 확인해라.

### 11. 권장 검증 명령

실제 `package.json`과 `AGENTS.md`의 명령을 우선하되 최소한 다음을 실행해라.

```powershell
# Admin Web payout tests
cd C:\dev\massage-on-demand-vn\apps\admin_web
npm.cmd test -- app/payouts

# API payout tests
cd C:\dev\massage-on-demand-vn\apps\api
npm.cmd test -- src/earnings/earnings.service.spec.ts src/admin/admin.service.spec.ts -t payout

# API withdrawal tests
npm.cmd test -- src/earnings/earnings.service.spec.ts src/admin/admin.service.spec.ts -t withdrawal
```

수정한 범위의 typecheck와 lint를 실행해라. 전체 저장소 검사가 기존 사용자 변경 때문에 실패하면 관련 범위의 결과와 기존 실패를 분리해서 보고해라.

Impeccable detector가 설치돼 있고 hook이 활성화되지 않았다면 UI 변경을 모두 마친 뒤 변경된 payout TSX/CSS 대상에 대해 한 번만 실행하고, payout과 무관한 global false positive는 구분해라.

```powershell
node C:\Users\laboy\.codex\skills\impeccable\scripts\detect.mjs --json <changed payout UI targets>
```

### 12. 변경 금지 및 보호 범위

- 관련 없는 Admin 페이지와 전역 navigation IA를 재설계하지 마라.
- Partner Money 상위 카테고리 밖으로 payout 책임을 확장하지 마라.
- General Ledger, Bank Reconciliation, Operations Policy의 canonical 책임을 `/payouts`에 복제하지 마라. deep link와 요약만 제공해라.
- 새로운 UI library, table library, state management library를 추가하지 마라.
- 기존 디자인 토큰, 공용 component, money/date formatter를 재사용해라.
- 테스트 통과를 위해 preflight, maker-checker, role requirement, evidence requirement를 완화하지 마라.
- UI가 계산한 `allowed` 값을 API가 신뢰하게 만들지 마라.
- API 오류를 fallback data로 숨기지 마라.
- 실제 payout/withdrawal/ledger 데이터를 삭제·수정·보정하지 마라.
- data repair가 필요하면 migration/ops plan으로 분리하고 자동 실행하지 마라.
- 기존 사용자 변경을 되돌리거나 관련 없는 파일을 포맷하지 마라.
- 1024px 이하 대응을 완료 조건에 추가하지 마라.

### 13. 완료 조건

다음 항목이 모두 충족될 때만 완료라고 보고해라.

- [ ] API failure/partial/empty/clear 상태가 구분됨
- [ ] Money flow의 모든 값과 verdict가 동일 scope 사용
- [ ] partial 또는 scope mismatch에서 MATCHED가 표시되지 않음
- [ ] withdrawal 49건 open risk가 빈 선택 필터 때문에 Clear가 되지 않음
- [ ] `Showing 10 of 49`처럼 visible/total count가 구분됨
- [ ] PAID/CANCELLED가 Release blocker에서 제외됨
- [ ] post-payment anomaly가 Reconciliation repair로 이동됨
- [ ] Payout batches / Wallet withdrawals / Reconciliation view 분리
- [ ] active view 데이터만 row 단위로 fetch/render
- [ ] payout batch 검색과 핵심 filter 구현
- [ ] withdrawal 검색과 핵심 filter 구현
- [ ] payout table이 1440px에서 빠르게 비교 가능
- [ ] 반복 reversal forms 제거, drawer form 1개
- [ ] transfer editor가 올바른 대상에 focus하고 context 보존
- [ ] Processing/Paid confirmation에 핵심 대상 정보 표시
- [ ] maker-checker, preflight, concurrency, evidence, journal 보호
- [ ] queue age/SLA/owner가 실제 데이터 범위에서 정확히 표시되거나 gap 보고
- [ ] 신규 회귀 테스트와 기존 payout/withdrawal 테스트 통과
- [ ] 1440×900 before/after 캡처 직접 비교
- [ ] 수정 전후 DOM/forms/height/navigation 수치 보고

### 14. 최종 보고 형식

작업을 끝낸 뒤 다음 순서로 보고해라.

1. 구현 결과와 최종 판정 한 문단
2. P0/P1 항목별 `완료 / 부분 완료 / 미완료` 표
3. 최종 Payout / Withdrawal / Reconciliation IA
4. 변경 파일과 각 파일의 역할
5. Money flow 최종 scope와 verdict 계약
6. Release preflight와 post-payment repair 분리 계약
7. 기존 금융 안전장치 보존 확인
8. 1440px before/after 스크린샷 경로와 각 화면 판정
9. 실행한 테스트·typecheck·lint·detector 결과
10. 수정 전후 성능 수치
11. 남은 데이터 migration/운영 정리/정책 결정 항목
12. 기존 사용자 변경 중 건드리지 않은 보호 영역

코드 일부만 수정하고 나머지를 제안으로 남기지 마라. 안전하게 구현할 수 있는 항목은 실제 코드와 테스트까지 완료해라. 미완료 항목이 있으면 `완료`라고 표현하지 말고 정확한 blocker, 영향, 다음 작업을 적어라.

## END OF PROMPT
