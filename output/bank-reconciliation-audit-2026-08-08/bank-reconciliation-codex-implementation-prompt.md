# HANDS Bank Reconciliation 개선 구현용 Codex 프롬프트

아래 프롬프트 전체를 새 Codex 작업에 그대로 붙여 넣어 사용한다.

---

## Prompt

`C:\dev\massage-on-demand-vn`의 HANDS 관리자 웹과 API에서 Bank Reconciliation 운영 화면을 실제로 개선해줘.

이번 작업은 단순한 스타일 변경이 아니다. Finance 운영자가 오래된 미처리 거래를 즉시 발견하고, 올바른 결제 근거를 선택하고, 다른 승인자의 검증을 거쳐 안전하게 대사 처리하며, 감사자가 이후 결과를 오해 없이 추적할 수 있도록 운영 흐름·상태 모델·문구·테이블·필터·조회 구조를 함께 정리하는 작업이다.

### 기준 문서

작업 전에 다음 파일을 반드시 모두 읽어라.

1. `C:\dev\massage-on-demand-vn\AGENTS.md`
2. `C:\dev\massage-on-demand-vn\output\bank-reconciliation-audit-2026-08-08\bank-reconciliation-deep-audit-report.md`

보고서의 화면 증거와 실제 코드를 교차 확인하고, 보고서 내용을 무비판적으로 복사하지 말고 현재 코드에 이미 반영된 사항이 있는지 먼저 확인한다. 이미 올바르게 구현된 부분은 다시 만들거나 구조를 흔들지 않는다.

### 작업 환경과 범위

- 작업 루트: `C:\dev\massage-on-demand-vn`
- 주요 화면:
  - `/finance-tax/bank-reconciliation`
  - `/finance-tax/bank-reconciliation/[id]`
  - `/finance-tax/bank-reconciliation/import-batches/[batchImportId]`
  - Statement imports 및 manual exception 관련 상태
- 주요 코드 후보:
  - `apps/admin_web/app/finance-tax/bank-reconciliation/**`
  - `apps/admin_web/lib/admin-navigation.ts`
  - `apps/admin_web/app/globals.css`
  - `apps/api/src/admin/**`
- 1440px 이상 데스크톱 운영 환경만 최적화한다.
- 1024px 이하 반응형 디자인은 이번 작업의 검사·수정·보고 대상에서 제외한다.
- 기존 작업 트리의 사용자 변경사항을 보존하고, 이번 기능과 관련 없는 코드는 수정하지 않는다.
- 새 UI 라이브러리나 불필요한 의존성을 추가하지 않는다. 기존 디자인 시스템과 컴포넌트를 우선 사용한다.
- 저장소의 single-agent 규칙을 지키고 하위 에이전트를 생성하지 않는다.

## 반드시 보존할 금융 안전 계약

다음 서버 계약은 UI 개선 중에도 약화시키거나 프론트 검증으로 대체하면 안 된다.

- Review owner와 최종 Finance approver는 서로 다른 사람이어야 한다.
- 은행 거래 잔액과 원천 증거 잔액을 초과하는 매칭을 서버에서 차단한다.
- 동일 원천의 중복 연결을 서버에서 차단한다.
- 동시 변경을 직렬화 가능한 트랜잭션 또는 기존 동등 수준으로 보호한다.
- 매칭, 부분 매칭, 무시, 반전, 담당자 변경의 감사 로그를 유지한다.
- IGNORED 처리는 활성 매칭이 없는 허용 상태에서만 가능해야 한다.
- CSV 미리보기, SHA-256, 중복 분류, 원본 파일 미보관 정책을 유지한다.
- 서버 권한, 승인 서명, 감사 근거 길이 검증을 약화시키지 않는다.

보호 영역을 변경해야 한다면 `AGENTS.md`의 integration review와 검증 명령을 적용한다. 스키마 마이그레이션은 정말 필요한 경우가 아니면 만들지 않는다.

## 구현 전 조사

코드를 수정하기 전에 다음을 짧게 정리한 뒤 바로 구현을 계속한다. 사용자 승인이 필요한 범위 변경이 발견되지 않는 한 계획만 제시하고 멈추지 않는다.

1. 현재 URL 기본값과 sidebar/search 진입 URL
2. 목록·요약·담당자 workload·facet 조회 경로
3. 거래 상세의 candidate 조회와 선택 방식
4. IGNORED, REVERSED, MATCHED, PARTIALLY_MATCHED, UNMATCHED의 허용 동작
5. 가져오기 배치의 헤더와 셀 데이터 매핑
6. 목록에서 상세로 이동할 때 보존되는 query state
7. 관련 테스트와 재사용 가능한 기존 컴포넌트

## P1 — 운영 사고 방지 항목

### 1. 기본 진입을 global open queue로 통일

- `/finance-tax/bank-reconciliation` 진입 시 오래된 열린 건을 숨기지 않는다.
- 기본 작업 범위는 `All open + Needs action`이 되게 한다.
- Today는 “오늘 발생한 거래”를 보는 보조 필터로 제공하되 전체 미처리 규모와 혼동되지 않게 한다.
- 다음 command KPI는 선택한 발생일 범위 때문에 0으로 사라지지 않는 global open 지표로 만든다.
  - `Unassigned 48h+`
  - `Open exposure`
  - `Partially matched`
  - `Resolved rate`
- sidebar, 검색 결과, 페이지 내부 canonical link가 같은 기본 URL 규칙을 사용하게 한다.
- 기본 화면의 0은 반드시 “현재 열린 작업이 0”일 때만 그렇게 해석되도록 한다.

### 2. Payment clearing 후보 오매칭 방지

현재처럼 최근 30일·최대 50건을 가져와 금액 차이로만 정렬하고 첫 항목을 자동 선택하는 방식을 제거한다.

- 현재 은행 거래 ID를 받는 transaction-specific candidate 조회 경로를 사용하거나 구현한다.
- 후보 판단에는 가능한 범위에서 다음 근거를 사용한다.
  - 금액과 통화
  - 거래 발생일과 결제/예약 발생일의 차이
  - 방향
  - transfer reference 또는 외부 참조
  - counterparty
  - booking/customer
  - 결제 유형과 현재 상태
  - 이미 사용된 금액과 남은 금액
- 후보 응답에는 `score/confidence`뿐 아니라 사람이 이해할 수 있는 `match reasons`를 포함한다.
- 동일 금액 후보가 여러 개이면 아무 후보도 기본 선택하지 않는다.
- 강한 참조 근거가 없는 단순 금액 일치는 `Recommended`가 아니라 `Candidate`로 표시한다.
- 후보 UI에 최소 다음을 보여준다.
  - 발생일시
  - booking/customer 식별 정보
  - 결제 유형 및 상태
  - 원 금액/남은 금액
  - 날짜 차이/금액 차이
  - transfer reference
  - 추천 근거
- 30일 밖 또는 첫 50건 밖의 결제 근거를 검색할 수 있는 `Find another payment` fallback을 제공한다.
- 검색 결과가 0건일 때 막힌 빈 화면으로 끝내지 말고 검색 조건 조정 또는 원천 상세로 이동할 수 있게 한다.
- Advanced source match에서 Payment clearing을 완전히 제외해 복구가 불가능한 상태를 만들지 않는다.
- 최종 매칭 시 기존 서버 검증을 다시 수행한다. 화면에서 추천됐다는 이유로 서버 검증을 생략하지 않는다.

### 3. Import batch 헤더-셀 매핑 수정

`apps/admin_web/app/finance-tax/bank-reconciliation/import-batches/[batchImportId]/page.tsx`에서 다음 의미가 정확히 대응되게 한다.

- `Import result` → `row.status` (`IMPORTED`, `SKIPPED`, 실패 결과 등)
- `Reconciliation` → `row.transaction.status` (`UNMATCHED`, `MATCHED`, `IGNORED`, `PARTIALLY_MATCHED`, `REVERSED` 등)

문자열이 화면 어딘가에 존재하는지만 보는 테스트가 아니라, 같은 DOM 행에서 헤더와 셀의 의미·순서를 검증하는 회귀 테스트를 추가한다. 최소 IMPORTED/IGNORED 조합과 SKIPPED, MATCHED, PARTIALLY_MATCHED를 검증한다.

### 4. 상태 모델과 문구를 단일 계약으로 통일

상태별 허용 동작, 다음 행동, tone, closeout 문구를 한곳에서 결정하는 UI 상태 모델을 만든다. 동일 상태를 여러 조건문이 서로 다르게 해석하지 않게 한다.

- `UNMATCHED` → owner assignment 또는 evidence 선택 필요
- `PARTIALLY_MATCHED` → 남은 금액에 대한 추가 evidence 필요
- `MATCHED` → Closed — fully matched
- `IGNORED` → Closed — no matching required
- `REVERSED` → 현재 도메인 정책에 맞게 Re-opened 또는 Closed-reversed를 명시

필수 조건:

- IGNORED 화면 어디에도 `Create explicit match`가 나타나지 않는다.
- IGNORED는 미매칭 금액이 남아 있어도 warning/open으로 보이지 않는다.
- 재개가 실제로 지원된다면 권한과 감사 근거가 있는 `Reopen review`로 별도 제공하고, 지원되지 않으면 행동 버튼을 만들지 않는다.
- Evidence Hub, summary card, badge, 도움말, CTA가 같은 상태 계약을 사용한다.
- `remainingAmount` 하나만으로 상태 tone이나 다음 행동을 결정하지 않는다.

### 5. Reconciled 범주 재정의

`Matched`, `Ignored`, `Reversed`를 모두 `Reconciled`라는 성공 지표에 섞지 않는다.

- 상위 구분을 `Open / Closed / Skipped` 또는 현재 도메인에 더 적합한 동등한 구조로 정리한다.
- Closed 안에서도 `Matched / Ignored / Reversed`를 개별 집계·필터할 수 있어야 한다.
- `Resolved rate`의 분자와 분모를 코드와 tooltip에서 명확히 정의한다.
- 배치 단위 `Approval stage`가 실제 거래별 승인 상태와 관계없다면 제거하거나 정확한 데이터에서 계산한다.
- 열린 행이 없는 배치의 `Unassigned`는 오류처럼 보이지 않도록 `No active owner needed`로 표시한다.

### 6. 목록 복귀 문맥 보존

- 목록에서 상세로 이동할 때 현재 `range`, `review`, `owner`, `age`, `evidence source`, `direction`, `query`, `page`, `rows/take`를 보존한다.
- 검증된 `returnTo` 또는 동등한 안전한 방식으로 명시적 Back CTA와 변경 후 redirect에 적용한다.
- Open redirect를 만들지 않는다. 허용 path를 bank reconciliation 영역으로 제한하고 query allowlist 또는 동등한 검증을 사용한다.
- 브라우저 뒤로가기와 화면의 Back CTA가 동일한 운영 위치로 돌아가게 한다.

### 7. 일상 처리 테이블 재구성

1440px 이상 화면에서 핵심 다음 행동이 가로 스크롤 뒤에 숨지 않게 한다.

- 기본 표는 다음 결정 정보 중심으로 축약한다.
  - Transaction
  - Bank evidence
  - Amount
  - Review state
  - Next action
- Evidence source는 별도 넓은 열보다 Review state 안의 보조 badge/metadata로 합칠 수 있다.
- 마지막 `Open` 또는 `Next action` 열을 sticky right로 고정하거나, 가로 스크롤 없이 보이도록 구성한다.
- 금액은 우측 정렬·nowrap을 사용한다.
- 긴 reference/ID는 최대 2줄, 전체값 tooltip, copy action을 제공한다.
- 행 전체를 무조건 클릭 대상으로 만들어 checkbox나 버튼과 충돌시키지 않는다.
- 매칭 이력은 요약 행과 펼칠 수 있는 audit detail/timeline 구조로 바꿔 한 행의 과도한 높이를 줄인다.

## P2 — 처리 속도와 인지 부하 개선

### 8. 필터를 2단 구조로 축약

- 첫 줄: Queue tabs와 count
- 둘째 줄: Search, Owner, Age, Direction
- `More filters`: Evidence source, Range, Rows
- 기본값은 active filter chip으로 반복하지 않는다.
- 기본값이 아닌 필터만 chip으로 표시하고 `Clear all`을 제공한다.
- 적용된 필터는 URL에 유지한다.
- 결과 설명은 자연어 한 줄로 축약한다.

### 9. Bulk assignment를 선택 후 작업 바로 전환

- 선택된 행이 없으면 담당자·근거·Assign selected 폼을 상시 노출하지 않는다.
- 선택 후 sticky bulk action bar를 보여준다.
- `선택 건수 · 합계 금액 · 48h+ 건수`를 함께 표시한다.
- `Select visible`은 현재 페이지에만 적용된다는 것을 명시한다.
- 선택 건과 최소 근거 길이 조건을 충족하기 전에는 CTA를 비활성화한다.

### 10. Manual exception 정보 구조 정리

운영상 독립 페이지가 꼭 필요하지 않다면 `Statement imports` 안의 `Create missing transaction` drawer/modal로 통합한다.

- 탭에는 실제 활성 workspace와 다른 상태를 표시하지 않는다.
- 독립 workspace를 유지한다면 세 번째 탭 `Manual exception`을 명시한다.
- `Import statement` 문구는 업로드와 이력을 모두 포함하도록 `Statement imports`로 통일한다.
- 빈 필수값, 최소 근거 길이, 중복 확인이 충족되기 전에는 확인 disclosure와 CTA를 활성화하지 않는다.
- 새 미해결 거래 생성 CTA에 destructive 색상을 쓰지 않는다.

### 11. Raw source ID 입력 개선

- Source type 선택 후 도메인별 검색 autocomplete를 제공한다.
- 선택 전에 금액, 통화, 상태, 소유자, 발생일, 이미 사용된 금액을 미리 보여준다.
- 원시 ID 직접 입력은 권한 있는 운영자를 위한 보조 `Paste exact ID` 옵션으로 낮춘다.

### 12. 감사 역할 문구 정리

- `Review owner`
- `Decision approved by`
- `Decision recorded at`
- `Reason`

실제 proposer가 별도로 존재하지 않는다면 동일 사용자를 `Ignored by`와 `Approved by`로 중복 표시하지 않는다. API가 제공하는 actor 의미도 확인해 UI 라벨과 일치시킨다.

### 13. 운영자 중심 마이크로카피

- 내부 enum을 그대로 노출하지 말고 Sentence case 운영 문구로 변환한다.
- 원시 enum은 감사 export, tooltip, 개발 진단 정보에서만 유지한다.
- 페이지 설명은 “조회”가 아니라 운영 목적을 설명한다. 예:
  - `Resolve unmatched company bank movements and retain auditable evidence.`
- `Today`와 `All open`, `Matched`와 `Resolved`, `Ignored`와 `Failed`가 혼동되지 않게 한다.
- 중요 evidence와 다음 행동은 14px 이상으로 유지하고, 보조 metadata만 더 작게 표현한다.
- 라이트/다크 테마 모두에서 색상만으로 상태를 구분하지 않는다.

## P3 — 데이터 조회와 코드 구조 개선

과도한 추상화나 대규모 리팩터링은 피하되, 동일 화면에서 중복되는 집계와 거대한 페이지 책임은 정리한다.

- command board, facets, owner workload, rows가 같은 운영 snapshot을 사용하도록 `workbench` read model 또는 최소 범위의 summary/facet 캐시를 검토한다.
- 현재 범위 summary와 global open summary를 목적 없이 중복 조회하지 않는다.
- 프론트 페이지를 다음 책임 단위로 분리한다.
  - query-state parser/model
  - command board
  - queue tabs/filter bar
  - owner workload
  - transaction table
  - candidate matcher
  - audit history
- 서버 집계 로직은 의미가 명확한 작은 함수 또는 query layer로 분리하되, 사용처가 하나뿐인 추상 계층은 만들지 않는다.
- production 계측 없이 인덱스를 추측해 추가하지 않는다.
- 가능한 경우 endpoint별 p50/p95, DB time, row count를 확인할 수 있는 기존 로깅/계측 지점을 사용한다.
- Next 개발 서버의 최초 compile 시간을 production DB 성능 문제로 해석하지 않는다.

## 시각 구성 목표

목록 화면은 아래 우선순위를 따른다.

1. Header: `Bank reconciliation` + global open 요약 + `Statement imports`
2. Queue tabs: Needs action / Partial / Closed와 각 count
3. 간결한 필터 도구막대
4. 필요할 때 펼치는 owner workload
5. 핵심 행동이 항상 보이는 transaction table

상세 화면은 아래 우선순위를 따른다.

1. Sticky decision header: reference, amount, remaining, status, owner, SLA, primary action
2. Bank evidence와 provenance
3. 명시 선택 방식의 scored candidates 또는 owner assignment blocker
4. Audit history, reversed evidence, advanced source search
5. Terminal 상태에서는 변경 폼을 숨기고 close reason과 evidence를 강조

기존 HANDS 관리자 디자인 언어를 유지한다. 불필요한 카드 중첩, 과도한 pill, 장식용 gradient, 모든 영역의 박스화는 피한다. 정보 계층, 작업 우선순위, 표 정렬, 문구 명확성에 집중한다.

## 테스트 요건

기존 테스트를 유지하고 다음 회귀 테스트를 추가한다.

1. 루트 기본 진입이 global open queue를 표시한다.
2. Today 발생 건이 0이어도 global overdue/open KPI가 숨겨지지 않는다.
3. Import result와 Reconciliation 헤더-셀 의미가 정확히 대응한다.
4. IGNORED 상태에는 match CTA와 open 경고가 나타나지 않는다.
5. REVERSED 상태의 표시와 허용 행동이 정책과 일치한다.
6. 목록 → 상세 → Back에서 모든 필터와 페이지가 보존된다.
7. 동일 금액 후보가 여러 건이면 기본 선택이 없다.
8. candidate 항목에 날짜·booking/customer·reference·차이·근거가 표시된다.
9. 30일/50건 범위 밖 payment evidence를 검색할 수 있다.
10. bulk action은 선택 전 숨겨지고 선택 건수·금액·overdue 수를 표시한다.
11. required form 조건 전에는 확인 CTA가 비활성화된다.
12. 서버의 owner/approver 분리, 금액 초과, 중복, 동시성 검증 테스트가 계속 통과한다.

테스트는 단순 문자열 존재보다 사용자의 실제 의미와 상호작용을 검증한다. 현재 프로젝트 테스트 도구와 패턴을 따른다.

## 브라우저 검증

구현 후 로그인된 로컬 관리자 화면을 실제 브라우저에서 확인한다.

- 기본 진입
- All open 및 Today 상태
- 필터 적용·해제·URL 유지
- 행 선택과 bulk assignment
- 거래 상세 candidate 선택
- IGNORED와 REVERSED terminal 상태
- 목록으로 복귀
- Statement imports
- Import batch 상세
- 라이트·다크 테마

1440px 이상 데스크톱 기준으로 확인한다. 읽기 전용 화면 검증을 우선하고, 실제 금융 거래 생성·매칭·무시·반전·CSV 업로드처럼 데이터를 변경하는 동작은 테스트 전용 데이터가 확실하지 않으면 제출하지 않는다. 제출하지 못한 동작은 코드와 자동화 테스트로 검증하고 한계로 보고한다.

## 실행 검증

최소한 다음 집중 테스트와 저장소 scope 검증을 실행한다. 실제 package script와 현재 테스트 파일 구조를 먼저 확인하고 맞는 명령으로 조정할 수 있다.

```powershell
npm.cmd --workspace @massage-vn/admin-web test -- app/finance-tax/bank-reconciliation
npm.cmd --workspace @massage-vn/api test -- src/admin/admin.dto.spec.ts src/admin/admin.controller.spec.ts src/admin/admin.service.spec.ts -t "bank reconciliation|bank statement|bank transaction"
npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api
```

보호 영역의 동작을 변경했다면 `AGENTS.md`가 요구하는 전체 로컬 검증도 수행한다. 외부 서비스나 환경 문제로 실행할 수 없는 검증은 통과했다고 쓰지 말고 정확한 원인과 미검증 범위를 남긴다.

## 완료 조건

아래 항목이 모두 충족되어야 완료로 보고한다.

- 루트 진입 즉시 전체 미해결 규모와 48h+ 미배정이 보인다.
- Today가 0이어도 오래된 open queue를 0으로 오인하지 않는다.
- Import result에는 IMPORTED/SKIPPED 계열, Reconciliation에는 UNMATCHED/MATCHED/IGNORED 계열이 표시된다.
- IGNORED 거래의 어느 영역에도 `Create explicit match`가 나타나지 않는다.
- 상세에서 Back을 누르면 원래 필터·검색어·페이지·행 수로 돌아간다.
- 동일 금액 후보가 여러 건이면 후보를 자동 선택하지 않는다.
- 30일 밖 또는 첫 50건 밖의 clearing evidence를 검색할 수 있다.
- 후보마다 날짜·booking/customer·reference·금액/날짜 차이·추천 근거가 보인다.
- Closed 집계에서 Matched, Ignored, Reversed를 구분할 수 있다.
- 1440px 이상에서 Next action이 가로 스크롤 뒤에 숨지 않는다.
- bulk action은 선택 후에만 나타나며 선택 건수와 금액을 보여준다.
- 기존 Finance 승인·금액·중복·동시성·감사 로그 계약이 모두 유지된다.
- 관련 자동화 테스트와 scope 검증 결과가 보고된다.

## 작업 방식

- 먼저 현재 구현과 테스트를 조사하고 짧은 실행 계획을 세운다.
- P1 운영 사고 방지 항목부터 구현하고 관련 테스트를 즉시 추가한다.
- 그 다음 P2 처리 속도, 마지막으로 필요한 범위만 P3 구조 개선을 적용한다.
- 한 번에 광범위한 unrelated refactor를 하지 않는다.
- 기존 사용자 변경을 덮어쓰거나 되돌리지 않는다.
- 구현 중 보고서와 현재 코드가 다르면 현재 코드와 실제 브라우저 동작을 우선하고 차이를 기록한다.
- 요구사항이 서버 상태 모델과 충돌하면 임의로 우회하지 말고 해당 계약을 코드·테스트로 확인한 뒤 가장 안전한 방향을 선택한다.
- 단순히 문구와 CSS만 바꾸고 완료로 처리하지 않는다. 데이터 의미와 실제 허용 행동이 UI와 일치해야 한다.

## 최종 보고 형식

작업 완료 후 아래 순서로 보고한다.

1. 운영자가 체감하게 될 변경 결과
2. P1/P2/P3별 구현 완료·미완료 항목
3. 변경 파일과 각 파일의 역할
4. API 또는 데이터 계약 변경 여부
5. 실행한 명령과 PASS/FAIL/SKIPPED 결과
6. 브라우저에서 확인한 주요 상태와 화면
7. 보호 영역 수정 여부와 integration review 결과
8. 남은 위험, 실제 데이터에서 추가 확인할 사항
9. 다음 권장 작업 한 가지

테스트 실패나 미검증 항목을 숨기지 말고, 구현하지 못한 요구는 이유와 정확한 후속 작업으로 남겨라.

---

## 사용 팁

- 바로 구현하려면 위 `Prompt` 전체를 새 Codex 작업에 붙여 넣는다.
- 먼저 계획만 검토하려면 프롬프트 앞에 `/plan`을 추가한다.
- 구현 범위가 너무 크면 Codex가 제시한 계획에서 P1을 먼저 완료한 뒤 같은 작업에서 P2와 P3를 이어서 수행한다.
