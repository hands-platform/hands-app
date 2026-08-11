# Codex 실행 프롬프트 — Wallet Adjustments 최종 개선

아래 내용을 새 Codex 작업에 그대로 붙여 넣어 사용한다.

---

## 역할

너는 `C:\dev\massage-on-demand-vn` 프로젝트의 시니어 제품 엔지니어이자 재무 운영 UX 전문가다.

단순히 화면을 예쁘게 바꾸는 것이 아니라 다음 목표를 동시에 달성해야 한다.

1. 잘못된 회계 기간이나 승인 우회로 인해 부정확한 지갑 조정이 실행되지 않게 한다.
2. 재무 운영자가 승인 대기·예외·증거·반전을 빠르고 정확하게 처리하게 한다.
3. 현재 디자인 시스템과 관리자 정보 구조를 유지하면서 1440px 이상 화면의 가독성을 높인다.
4. 기존에 정상적으로 개선된 URL privacy, 정책 매트릭스, preview, maker/checker, reversal 안전장치를 절대 퇴행시키지 않는다.

## 작업 위치와 기준 문서

- 저장소: `C:\dev\massage-on-demand-vn`
- 대상 화면: `http://localhost:3101/wallet-adjustments`
- 기준 보고서:
  - `C:\dev\massage-on-demand-vn\output\wallet-adjustments-post-remediation-reaudit-2026-08-09\wallet-adjustments-post-remediation-reaudit-report.md`
- 이전 심층 감사:
  - `C:\dev\massage-on-demand-vn\output\wallet-adjustments-audit-2026-08-09\wallet-adjustments-deep-audit-report.md`
- 이전 구현 보고서:
  - `C:\dev\massage-on-demand-vn\output\wallet-adjustments-remediation-2026-08-09\wallet-adjustments-remediation-report.md`

먼저 세 문서를 모두 읽고, 현재 코드와 실제 실행 화면을 다시 확인한 다음 수정한다. 보고서 문구를 기계적으로 복사하지 말고 현재 구현·데이터 모델·공용 컴포넌트와 대조한다.

## 화면 범위

- **1440 × 900 이상 데스크톱만 구현·검증한다.**
- 1024px 이하, 모바일, 태블릿, responsive reflow는 이번 작업 범위에서 완전히 제외한다.
- 1024px 이하 문제를 구현 보고서, 테스트 결과, 잔여 이슈에 포함하지 않는다.
- 기존 작은 화면 CSS를 일부러 삭제하거나 망가뜨리지는 말되, 이번 작업의 시간과 판단 기준으로 사용하지 않는다.

## 작업 원칙

1. 기존 dirty worktree는 사용자 작업이다. 관련 없는 변경을 되돌리거나 덮어쓰지 않는다.
2. `git reset --hard`, 광범위 checkout, 무관한 파일 정리, 기존 사용자 변경 삭제를 금지한다.
3. 기존 디자인 토큰과 공용 관리자 컴포넌트를 재사용한다. 새로운 UI 라이브러리를 추가하지 않는다.
4. 표면적인 CSS 패치로 증상을 숨기지 말고 데이터·API·승인 정책·화면 구조를 함께 수정한다.
5. 금융 상태를 변경하는 실제 요청 생성, 승인, 거절, stale 취소, reversal 실행을 브라우저에서 수행하지 않는다.
6. 브라우저 검증은 검색과 preview까지만 사용하고, 쓰기 흐름은 단위·통합 테스트와 disposable fixture로 검증한다.
7. 오류 시 빈 결과로 위장하지 말고 fail-closed 오류 상태를 보여 준다.
8. 구현 중 기존 허용 매트릭스와 maker/checker 정책을 약화시키지 않는다.
9. 정책 충돌이 발견되면 조용히 추측하지 말고 코드·문서 근거를 정리한다. 단, 아래에서 명시한 기본 정책은 그대로 구현한다.

## 보존해야 하는 현재 장점

다음은 이미 잘 구현되었으므로 반드시 유지하고 회귀 테스트를 보강한다.

- Records / Requests / New request의 URL-addressable workspace 분리
- 활성 view의 데이터만 조회하는 구조
- owner 검색과 preview를 POST/local state로 처리하는 구조
- URL·redirect에 owner ID, amount, reason, attachment draft를 싣지 않는 구조
- 정책 API 기반 owner/type/direction 허용 매트릭스
- API 생성 시점과 승인 시점의 정책 재검증
- idempotency key
- approval 시 latest balance 재검증
- immutable ledger, journal, audit evidence 연결
- cash booking deduction의 settlement-only 정책
- original source에 고정된 reversal
- reversal exact amount, opposite direction, duplicate 방지
- preview 이후 입력이 변경되면 제출 버튼을 다시 잠그는 form key
- bank/cash 및 output VAT 비영향 표시
- light/dark theme와 1440px 기본 테이블 가독성

## 구현 전 필수 조사

코드를 수정하기 전에 다음을 조사하고 작업 메모에 남긴다.

1. `apps/admin_web/app/wallet-adjustments/**`
2. `apps/admin_web/app/customers/[id]/customer-wallet-adjustment-*`
3. `apps/admin_web/app/finance-tax/approval-queue/**`
4. `apps/admin_web/components/admin-data-table*`, `admin-details`, form controls, drawer/modal 계열 공용 컴포넌트
5. `apps/api/src/wallet-adjustments/**`
6. `apps/api/src/admin/admin-wallet.routes.ts`
7. `apps/api/src/admin/admin.service.ts`의 manual wallet adjustment create/preview/approve/reject/cancel/list/single-request 함수
8. Prisma의 `ManualWalletAdjustmentRequest`, wallet ledger, accounting journal, file/evidence 관련 모델
9. 기존 admin file presign/upload/complete/read URL 흐름
10. accounting monthly period status의 의미와 다른 finance 화면에서 사용하는 open-period 정책
11. 현재 관련 테스트와 fixture

공용 구현이 있으면 그것을 사용한다. 동일 기능을 새로 중복 구현하지 않는다.

---

# Phase 0 — P0 재무 통제 수정

## 0-1. 회계 월 정책을 명시적인 allowlist로 통일

### 현재 문제

- 일반 wallet adjustment는 `CLOSED`만 차단한다.
- reversal은 `DECLARED`, `PAID`, `CLOSED`를 차단한다.
- 따라서 일반 조정이 신고·납부된 월에 들어갈 수 있다.
- accounting month를 비워도 preview와 request 생성이 가능하다.

### 기본 정책

- 일반 조정과 reversal 모두 `DRAFT`, `REVIEWED` 기간만 허용한다.
- `DECLARED`, `PAID`, `CLOSED`는 모두 거절한다.
- period record가 존재하지 않거나 상태를 확인할 수 없으면 fail-closed한다.
- accounting month는 필수다.
- 단순히 클라이언트에서 required를 추가하는 것으로 끝내지 말고 API가 최종 권한을 가진다.

### 구현 요구

1. 공용 함수로 `assertManualWalletAdjustmentPeriodOpen(...)` 또는 동등한 정책 함수를 만든다.
2. preview, request create, approval execution에서 같은 함수를 호출한다.
3. reversal도 별도 조건문을 중복하지 말고 같은 정책 함수를 사용한다.
4. UI month selector는 현재 사용 가능한 `DRAFT|REVIEWED` 월만 선택하게 한다.
5. 각 option 또는 인접 설명에 월 상태를 표시한다.
6. open period가 없으면 request form을 비활성화하고 명확한 danger notice와 Tax & Period Close 링크를 제공한다.
7. preview 핵심 요약에 `Accounting month`와 `Period status`를 표시한다.
8. 기존 `Posting month not assigned` legacy record는 유지하되 신규 record에서는 발생하지 않게 한다.

### 안정적인 오류 코드

다음과 같은 stable code를 사용한다. 기존 네이밍 규칙이 있으면 그것에 맞추되 의미를 유지한다.

- `WALLET_ADJUSTMENT_PERIOD_REQUIRED`
- `WALLET_ADJUSTMENT_PERIOD_NOT_FOUND`
- `WALLET_ADJUSTMENT_PERIOD_NOT_OPEN`

UI는 code를 field/error copy로 안전하게 매핑한다. API 원문 오류를 그대로 노출하지 않는다.

### 필수 테스트

- DRAFT: preview/create/approve 허용
- REVIEWED: preview/create/approve 허용
- DECLARED: 세 단계 모두 거절
- PAID: 세 단계 모두 거절
- CLOSED: 세 단계 모두 거절
- missing/unknown period: 세 단계 모두 거절
- request 생성 후 승인 전에 period가 닫힌 경우 승인 거절
- reversal에서도 동일 matrix

## 0-2. customer-direct maker/checker 우회 제거

### 현재 문제

고객 상세의 `executionMode=customer-direct`는 Master Admin 한 명이 request 생성과 실행을 한 트랜잭션에서 완료한다. 이는 Wallet Adjustments가 표시하는 별도 승인 원칙과 충돌한다.

### 이번 작업의 기본 정책

- 고객 상세에서 시작한 조정도 즉시 실행하지 않는다.
- 모든 일반 customer/partner wallet adjustment는 maker request를 생성하고 다른 finance approver가 Approval Queue에서 실행한다.
- 별도의 break-glass 즉시 실행은 이번 작업에서 새로 만들지 않는다.
- 저장소에 명시적인 최신 운영 정책 문서가 있고 정말로 break-glass를 요구하는 경우에만 작업을 멈추고 근거와 대안을 보고한다. 기존 코드에 endpoint가 있다는 사실만으로 정책 근거로 간주하지 않는다.

### 구현 요구

1. 고객 상세의 `executionMode=customer-direct` hidden input과 즉시 실행 문구를 제거한다.
2. 고객 상세 폼도 `/admin/wallet-adjustment-requests`에 maker request만 생성한다.
3. CTA를 `Create approval request`로 바꾼다.
4. 완료 notice를 `Applied`가 아니라 `Awaiting finance approval`로 바꾼다.
5. 생성 후 Wallet Adjustments Requests 또는 Approval Queue의 해당 request로 연결한다.
6. `/wallet-adjustment-requests/customer-direct` route와 `executeCustomerWalletAdjustmentDirect` service를 제거한다.
7. 제거가 즉시 불가능한 외부 소비자가 있으면 route는 항상 deprecated/disabled 상태로 fail-closed하고 어떤 ledger도 생성하지 않게 한다.
8. maker self-approval 거절을 고객 상세에서 생성한 request에도 동일하게 적용한다.

### 필수 테스트

- 고객 상세 submit은 REQUESTED record만 만들고 ledger/journal을 만들지 않음
- 같은 maker의 approve 거절
- 다른 finance approver의 approve 성공
- 기존 customer-direct endpoint가 제거되었거나 execution을 거절함
- customer detail copy에 `immediately`, `Apply now`, `single operator` 의미가 남지 않음

## 0-3. Legacy invalid pending 처리

### 현재 문제

현재 pending 데이터에는 `CUSTOMER + Partner Bonus` 같은 최신 정책상 불가능한 요청이 있다. 승인 API는 최종적으로 막지만 list UI는 승인 가능한 것처럼 보인다.

### 구현 요구

1. request list/single API에서 현재 정책을 적용한 preflight를 반환한다.
2. 최소 필드:
   - `canApprove`
   - `blockers[]`
   - stable blocker `code`
   - operator-facing `message`
3. invalid legacy 요청에는 `POLICY_MIGRATION_REQUIRED` 또는 동등한 stable blocker를 사용한다.
4. `canApprove=false`면 `Review in Approval Queue`를 활성 CTA로 표시하지 않는다.
5. `Legacy invalid — cannot approve` badge와 `Cancel and recreate` 행동을 표시한다.
6. 안전한 migration/backfill 스크립트를 작성할 수는 있지만 production data를 임의로 실행하지 않는다.
7. migration 대상 건수, 현재 status, 변경될 status/reason을 dry-run으로 출력할 수 있게 한다.
8. Approval Queue도 같은 preflight와 blocker를 사용한다.

---

# Phase 1 — 매일 사용하는 운영 화면 개선

## 1-1. Requests를 pending-first 작업 큐로 변경

### 기본 상태

- `/wallet-adjustments?view=requests` 최초 진입은 `REQUESTED`만 보여 준다.
- 기본 정렬은 `oldest` 또는 SLA severity 우선이다.
- query string에 기본값을 반드시 노출할 필요는 없지만 화면 상태와 pagination link는 일관돼야 한다.

### 상단 saved views

다음 네 가지 saved view와 건수를 제공한다.

1. `Awaiting approval`
2. `Stale / blocked`
3. `Needs recreation`
4. `History`

요구 사항:

- empty queue는 0을 명확히 보여 주되 과도한 카드 그리드를 만들지 않는다.
- 현재 선택 상태가 keyboard와 screen reader에 전달돼야 한다.
- 상태별 count API는 실제 filter 정의와 일치해야 한다.
- `History` 안에서 Executed / Rejected / Cancelled를 추가 filter로 선택한다.

### SLA 표시

- 단순 `Pending 25d` 문자열만 쓰지 않는다.
- 프로젝트의 운영 정책 또는 기존 SLA token을 찾아 normal/warning/stale 기준을 적용한다.
- 최신순 대신 oldest/SLA 순을 지원한다.
- blocker가 있으면 lifecycle column의 첫 줄에 operator-facing blocker를 표시한다.

## 1-2. Record/Request detail 레이아웃 교체

### 금지

- 긴 audit detail을 현재처럼 마지막 table cell 안에 렌더링하지 않는다.
- column width를 조금 늘리는 CSS만으로 해결하지 않는다.
- invalid table DOM을 만들지 않는다.

### 권장 구조

다음 중 현재 공용 패턴과 가장 잘 맞는 하나를 선택한다.

- summary row 다음의 full-width detail row
- 520~640px side drawer
- 별도 detail route

선택 기준:

- 1440px에서 summary row 높이와 정렬을 유지해야 한다.
- 최소 900px 이상의 내용 폭 또는 충분한 drawer 폭을 확보해야 한다.
- keyboard로 열고 Escape로 닫을 수 있어야 한다.
- focus가 열기 control → detail heading → 닫기 후 원래 control로 자연스럽게 이동해야 한다.
- URL-addressable detail이 운영 공유에 유리하면 `recordId`/`requestId` query를 사용하되 민감한 reason/evidence URL은 URL에 넣지 않는다.

### 공용 detail 내용

Record와 Request가 가능한 한 같은 `WalletAdjustmentEvidencePanel` 또는 동등한 공용 컴포넌트를 사용한다.

섹션:

- Summary
- Wallet owner
- Request and ledger references
- Maker / approver / decision actor
- Accounting month and status
- Before / delta / after
- Adjustment type and direction
- Reason
- Evidence
- Accounting entries
- Lifecycle timestamps
- Available next action

ID는 다음 규칙을 사용한다.

- 화면에는 short ID
- full ID는 title/accessible description
- 명확한 Copy 버튼
- 관련 entity로 이동할 수 있으면 링크
- 긴 source key를 기본 summary에 그대로 노출하지 않음

## 1-3. Reversal 확인 정보 강화

1. single-request API가 list API와 동일하게 owner display identity, masked phone/reference, maker, approver를 hydrate하게 한다.
2. reversal 상단 고정 summary에 다음을 표시한다.
   - owner name과 masked identity
   - original request short ID + Copy
   - ledger short ID + Copy
   - executed time
   - original before/delta/after
   - original accounting month/status
   - maker/approver
   - evidence 있음/없음
   - fixed reversal direction/amount
3. raw owner ID를 primary identity로 사용하지 않는다.
4. original evidence reconciliation이 실패하면 form 전체를 fail-closed한다.
5. reversal evidence가 필수인지 기존 재무 정책을 확인한다. 명확한 규정이 없으면 임의로 강화하지 말고 구현 보고서에 결정 필요 항목으로 남긴다.

## 1-4. Evidence를 내부 파일 ID로 전환

### 원칙

- 임의 외부 URL을 감사 증거의 영구 식별자로 사용하지 않는다.
- 기존 admin file presign/upload/complete/read URL 흐름을 재사용한다.
- 새로운 storage dependency를 추가하지 않는다.

### 데이터 모델

현재 스키마와 file 모델을 조사한 후 최소 다음을 연결한다.

- `attachmentFileId` 또는 의미가 분명한 relation
- checksum/hash
- mime type
- original filename
- size
- uploadedAt
- uploadedBy
- retention/review status가 기존 모델에 있다면 재사용

### UI

- URL textbox 대신 Upload/Attach evidence control을 사용한다.
- 업로드된 파일명, 크기, 상태, 제거/교체 행동을 표시한다.
- high amount와 receivable write-off에서 evidence를 required로 강제한다.
- detail 화면은 권한 확인된 read URL을 그때 발급해 연다.
- 기존 URL-only legacy evidence는 `Legacy URL evidence`로 읽기 전용 표시하고 신규 작성에는 허용하지 않는다.

### 보안

- 신규 경로에서 HTTP를 허용하지 않는다.
- URL fallback을 잠시 유지해야 한다면 최소 HTTPS만 허용하고 UI copy/API error를 일치시킨다.
- signed read URL 자체를 request/audit 영구 필드에 저장하지 않는다.

---

# Phase 2 — 검색, 감사 품질, 접근성, 문구

## 2-1. 실제 운영 규모용 필터

Records:

- accounting period 또는 date range
- owner name/phone/reference 검색
- owner type
- adjustment type
- direction
- amount range
- maker/approver
- evidence 있음/없음
- period missing
- newest/oldest/amount sort

Requests:

- saved view/status
- request/owner 검색
- owner type
- adjustment type/direction
- SLA
- blocker
- amount range
- maker
- evidence
- oldest/newest/SLA sort

공통:

- filter는 server-side query에 반영한다.
- pagination, count, export가 있다면 같은 filter 정의를 사용한다.
- 적용된 filter chip과 Clear all을 제공한다.
- empty filtered result와 API failure를 구분한다.
- page size는 10/25/50을 유지한다.

## 2-2. 감사 사유 품질

단순 최소 글자 수만 늘리는 것으로 끝내지 않는다.

요청 입력을 다음 의미로 구조화한다.

- `Operational cause`
- `Expected correction`
- `Case / incident reference` — 해당 조직에서 사용하는 case ID가 있을 때
- 추가 상세 reason

최소 규칙:

- 자유 사유는 trim 후 12자 이상
- 무의미한 공백만 허용하지 않음
- API와 UI가 같은 길이·정규화 규칙을 사용함
- 기존 legacy reason은 변경하지 않고 그대로 표시함
- 상세 화면에서 구조화된 항목을 읽기 좋게 표시함

## 2-3. 접근성과 상태 전달

1. owner 검색 완료 시 결과 건수를 `aria-live="polite"`로 안내한다.
2. owner 선택 후 Step 2 heading 또는 section에 적절히 focus를 이동한다.
3. preview 성공/실패를 live region으로 안내한다.
4. 오류 summary focus 후 field error와 `aria-describedby` 연결을 유지한다.
5. detail open/close focus restoration을 테스트한다.
6. tab semantics와 selected state를 유지한다.
7. `document.title`을 `Wallet Adjustments | HANDS Admin`으로 설정한다.
8. 전체 WCAG 준수를 주장하지 말고 실제 검증 범위를 보고한다.

## 2-4. 문구와 표시 정리

다음 문구를 운영자 언어로 정리한다.

- `47 executed record(s)` → `47 executed records`
- `1 request(s)` → `1 request`
- `10 request(s)` → `10 requests`
- enum은 sentence case로 통일
- `Promotion Credit` → `Promotion credit`
- `Referral Correction` → `Referral correction`
- `Error Correction` → `Error correction`
- raw `CUSTOMER`, `PARTNER`는 문맥상 필요하지 않으면 `Customer`, `Partner`
- `Posting month not assigned` 반복 → compact `Legacy · period missing` badge

`period missing`은 단순 문구가 아니라 saved filter/data repair queue로도 접근 가능하게 한다.

---

# 성능 기준

1. 활성 view 외의 row list를 미리 조회하지 않는다.
2. list endpoint는 pagination 이전·이후 데이터 접근을 확인해 N+1을 만들지 않는다.
3. status count와 list를 위해 동일한 대형 query를 중복하지 않는다.
4. owner/admin identity hydration은 현재 page IDs를 batch 조회한다.
5. 10/25/50행에서 DOM과 렌더링이 불필요하게 배수 증가하지 않게 한다.
6. 닫힌 detail 내용을 모든 행에 무겁게 pre-render하지 않는다. 필요 시 선택한 detail만 조회한다.
7. 이미지나 신규 무거운 dependency를 추가하지 않는다.

# 권한과 보안 기준

1. 화면에서 버튼을 숨기는 것만으로 권한을 구현하지 않는다.
2. create/approve/reject/cancel/reversal/file-read를 API에서 각각 검증한다.
3. maker와 approver가 같은 경우 항상 거절한다.
4. approval 시 request의 persisted payload를 사용하고 클라이언트 payload로 덮어쓰지 않는다.
5. policy, balance, period, evidence, reversal source를 approval 트랜잭션 안에서 재검증한다.
6. idempotency와 duplicate reversal guard를 유지한다.
7. 실패한 승인에서 request status나 ledger가 부분 변경되지 않게 transaction을 유지한다.

# 테스트 요구

기존 테스트를 삭제하거나 assertion을 약화해 통과시키지 않는다. 필요한 테스트를 추가한다.

## Admin Web

- Records/Requests/Create 활성 view별 API 호출 분리
- Requests 기본 pending/oldest 상태
- saved view count와 query 유지
- legacy invalid request blocker/disabled action
- full-width detail 또는 drawer semantics/focus
- reversal hydrated identity
- month required/open status UI
- structured reason validation
- file evidence 상태
- plural/casing/title
- URL privacy
- preview invalidation

## API

- owner × direction × adjustment type 전체 허용/거절 matrix
- DRAFT/REVIEWED/DECLARED/PAID/CLOSED/missing period matrix
- create 시 허용됐지만 approve 전에 period 변경된 경우
- maker self-approval
- customer detail request도 동일 maker/checker
- customer-direct 제거/거절
- latest balance revalidation
- legacy invalid preflight
- reversal source/owner/amount/direction/duplicate/evidence reconciliation
- file evidence ownership, mime/size/status, read authorization
- idempotency collision
- failed transaction에 partial ledger/journal/request mutation 없음

## 실행해야 할 검증

저장소의 실제 script 이름을 확인한 뒤 최소 다음 수준으로 실행한다.

```powershell
npm.cmd test --workspace @massage-vn/admin-web -- --run app/wallet-adjustments app/customers/[id]
npm.cmd test --workspace @massage-vn/api -- --run src/wallet-adjustments src/admin/admin.service.spec.ts
npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run typecheck --workspace @massage-vn/api
```

변경 범위가 공용 finance component, Prisma schema, file service, approval queue에 걸치면 해당 package의 관련 테스트와 build도 추가 실행한다.

# 브라우저 검증

로그인된 in-app browser가 있으면 그것을 사용한다. 없으면 현재 환경에서 제공되는 브라우저 제어 방식을 사용한다.

반드시 1440 × 900에서 다음 상태를 확인하고 스크린샷을 저장한다.

1. Records 기본
2. Records table
3. Record full-width detail 또는 drawer open
4. Requests 기본 pending/oldest
5. Stale/blocked saved view
6. Legacy invalid request blocker
7. Request detail open
8. New request initial
9. Owner search result
10. Open accounting month 선택
11. Valid preview
12. 입력 변경 후 preview invalidation
13. Reversal hydrated summary
14. Evidence file attached 상태
15. API failure/empty result를 구분한 상태
16. Dark mode 대표 화면

브라우저 검증 중 실제 `Create approval request`, approve, reject, cancel, reversal submit을 누르지 않는다.

확인할 수치:

- `window.innerWidth === 1440`
- document horizontal overflow 없음
- `document.title` 정상
- URL에 ownerId, amount, reason, attachment draft 없음
- opened detail이 마지막 column 폭에 갇히지 않음
- pending 기본 정렬 oldest/SLA
- detail open/close focus 복귀
- preview 이후 입력 변경 시 create disabled

# 완료 조건

다음 조건을 모두 만족해야 완료로 보고한다.

- [ ] P0 기간 정책이 preview/create/approve/reversal에 동일하게 적용됨
- [ ] customer-direct 즉시 실행이 제거되거나 완전히 비활성화됨
- [ ] 모든 정상 조정이 다른 approver를 요구함
- [ ] legacy invalid pending이 승인 가능하게 보이지 않음
- [ ] Requests 기본이 pending-first, oldest/SLA-first임
- [ ] record/request detail이 full-width 또는 충분한 drawer로 표시됨
- [ ] reversal에서 사람이 읽을 수 있는 원본 identity/evidence를 확인함
- [ ] 신규 evidence가 내부 file ID 기반임
- [ ] month가 필수이며 open status를 확인할 수 있음
- [ ] structured reason과 audit reference를 남길 수 있음
- [ ] 필요한 filters/saved views/counts가 실제 API query와 일치함
- [ ] URL privacy와 preview invalidation이 유지됨
- [ ] 1440 × 900 light/dark 검증 완료
- [ ] 관련 테스트·typecheck·build 통과
- [ ] 실제 금융 mutation 없이 QA 완료

# 결과물

1. 구현 코드와 migration
2. 추가·수정된 테스트
3. 1440 × 900 검증 스크린샷
4. 다음 경로의 구현 보고서

`C:\dev\massage-on-demand-vn\output\wallet-adjustments-final-remediation-<YYYY-MM-DD>\wallet-adjustments-final-remediation-report.md`

구현 보고서에는 다음을 포함한다.

- 변경 요약
- P0/P1/P2별 해결 상태
- 변경한 파일과 이유
- 데이터 migration/dry-run 결과
- 정책 매트릭스
- 실행한 테스트 명령과 통과 수
- 브라우저 검증 단계와 스크린샷
- 실제 금융 mutation을 하지 않았다는 확인
- 남은 blocker와 후속 의사결정
- 기존 장점의 회귀 여부

# 최종 응답 형식

1. 가장 먼저 완료 여부와 남은 blocker를 말한다.
2. P0가 하나라도 남으면 “완료”라고 표현하지 않는다.
3. 구현한 핵심 변경을 5~10개로 요약한다.
4. 테스트와 브라우저 검증 결과를 숫자로 제시한다.
5. 구현 보고서의 절대 경로 링크를 제공한다.
6. 수정하지 않은 관련 없는 사용자 변경을 명시한다.

작업을 시작하라. 먼저 기준 보고서와 현재 코드를 읽고, 현재 상태를 짧게 요약한 뒤 Phase 0부터 순서대로 구현한다.

---

## 짧은 실행용 버전

컨텍스트가 충분히 유지되는 동일 작업에서 다시 실행할 때만 아래 축약본을 사용한다.

```text
C:\dev\massage-on-demand-vn의 Wallet Adjustments 최종 개선을 수행해줘.

기준 문서:
C:\dev\massage-on-demand-vn\output\wallet-adjustments-post-remediation-reaudit-2026-08-09\wallet-adjustments-post-remediation-reaudit-report.md

1440×900 이상 데스크톱만 구현·검증하고 1024px 이하 내용은 완전히 제외해.

우선순위:
1. 일반 조정과 reversal 모두 DRAFT/REVIEWED period만 허용하고 DECLARED/PAID/CLOSED/missing을 preview/create/approve에서 fail-closed.
2. customer-direct 즉시 실행 제거. 고객 상세도 maker request만 만들고 다른 finance approver가 실행.
3. legacy invalid pending에 canApprove=false/blocker를 반환하고 승인 CTA 대신 cancel/recreate 제공.
4. Requests 기본을 REQUESTED + oldest/SLA 순으로 변경하고 Awaiting/Stale/Needs recreation/History saved view와 count 추가.
5. record/request details를 마지막 cell 밖의 full-width row 또는 충분한 drawer로 변경.
6. reversal owner/maker/approver/original time/balance/period/evidence를 hydrate.
7. evidence를 임의 URL에서 기존 file upload 기반 attachmentFileId로 전환. 신규 HTTP URL 금지.
8. period/owner/type/direction/amount/actor/evidence/SLA/sort 필터 추가.
9. structured reason, document title, aria-live/focus, ID Copy, plural/casing 정리.

현재 URL privacy, policy allowlist, approval-time revalidation, idempotency, latest balance check, immutable ledger/journal/audit, source-bound reversal, preview invalidation, light/dark는 유지해.

dirty worktree의 관련 없는 사용자 변경은 되돌리지 마. 실제 금융 요청 생성·승인·거절·취소·반전은 브라우저에서 수행하지 말고 테스트로 검증해.

관련 admin/API 테스트, typecheck, build를 실행하고 1440×900 브라우저 상태를 캡처해. P0가 남으면 완료라고 하지 말고, output/wallet-adjustments-final-remediation-<date>/wallet-adjustments-final-remediation-report.md에 변경·테스트·스크린샷·남은 blocker를 기록해.
```
