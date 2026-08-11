# Wallet Adjustments 개선 구현용 Codex 마스터 프롬프트

아래 지시를 하나의 구현 작업으로 수행하라. 단순 분석이나 제안으로 끝내지 말고, 현재 소스의 실제 동작을 다시 확인한 뒤 안전하게 수정하고 테스트와 1440px 이상 화면 검증까지 완료하라.

## 1. 역할과 목표

너는 HANDS 관리자 시스템의 시니어 프로덕트 엔지니어이자 재무 운영 UX 책임자다. 대상은 다음 페이지다.

- 작업 경로: `C:\dev\massage-on-demand-vn`
- 대상 화면: `http://localhost:3101/wallet-adjustments`
- 기준 보고서: `output/wallet-adjustments-audit-2026-08-09/wallet-adjustments-deep-audit-report.md`
- 기준 스크린샷: `output/wallet-adjustments-audit-2026-08-09/*.png`
- 주요 Admin Web 코드: `apps/admin_web/app/wallet-adjustments/**`
- 주요 API 회계 코드: `apps/api/src/wallet-adjustments/wallet-adjustments.accounting.ts`
- 관련 Admin API: `apps/api/src/admin/admin.service.ts`
- 공통 Admin API wrapper: `apps/admin_web/lib/admin-api.ts`

운영자가 정확한 지갑 대상을 고르고, 허용된 조정만 검토하여 별도 승인자에게 넘기며, 요청부터 원장·회계·감사 증거까지 안전하게 추적할 수 있는 화면으로 개선한다.

이 작업은 미관 개선보다 다음 순서가 중요하다.

1. 잘못된 금전·회계 요청을 API에서 거절한다.
2. 사유와 증거 등 민감한 생성 정보를 URL에서 제거한다.
3. 생성·요청·원장 업무를 한 route의 실제 탭으로 분리한다.
4. 미리보기와 오류를 작업 위치에서 즉시 이해할 수 있게 한다.
5. 표·필터·문구·접근성과 로딩 비용을 운영 환경에 맞게 개선한다.

## 2. 시작 전 필수 절차

1. 루트의 `AGENTS.md`를 먼저 읽고 따른다.
2. 기준 보고서를 끝까지 읽고, 11개 스크린샷을 직접 확인한다.
3. `git status --short`와 관련 파일 diff를 확인한다. 작업 트리에는 사용자의 다른 변경이 많으므로 절대로 초기화하거나 덮어쓰지 않는다.
4. 현재 테스트를 먼저 실행해 baseline을 기록한다.
5. 보고서의 과거 line number를 맹신하지 말고 현재 소스에서 심볼과 동작을 다시 찾는다.
6. 기존 Vuexy 기반 Admin 디자인 시스템, 공통 컴포넌트와 스타일을 재사용한다. 새로운 UI 라이브러리나 임의의 디자인 체계를 추가하지 않는다.
7. 광범위한 리팩터링, 무관한 페이지 수정, 데이터베이스 마이그레이션, 패키지 추가는 하지 않는다.

## 3. 절대 보존할 안전장치

다음 동작은 제거하거나 약화하지 않는다.

- 이름·전화 검색과 마스킹된 신원 확인
- 선택된 owner의 유형, 계정 상태, 현재 잔액 확인
- maker/checker 분리와 자기 승인 금지
- 승인 시점 최신 잔액 재검증
- idempotency key와 중복 원장 방지
- 요청 이력과 실행 원장의 분리
- 고객 지갑 debit의 양수 잔액 초과 금지
- closed period의 직접 수정 금지
- 고액 및 receivable write-off 증거 요구
- 현금 예약 공제의 booking settlement 경로 강제
- 은행·현금, VAT, 수익, 지갑·채권 영향을 보여 주는 회계 미리보기
- 불변 원장과 감사 추적

## 4. P0 — 회계 허용 정책을 API의 단일 권위로 구현

### 문제

현재 `Customer wallet + Partner bonus + Credit`과 같은 의미적으로 잘못된 조합도 `PARTNER_BONUS_EXPENSE → CUSTOMER_WALLET_LIABILITY` 미리보기와 제출 가능한 CTA를 만든다. UI의 disabled 조건은 API 정책이 아니므로 우회할 수 있다.

### 구현 요구

1. `ownerType × adjustmentType × direction`의 명시적 정책 모듈을 API 영역에 만든다.
2. 정책은 deny-by-default로 동작해야 한다. 목록에 없는 조합은 미리보기와 생성 요청 양쪽에서 동일한 구조화 오류로 거절한다.
3. Admin Web 옵션은 이 정책에서 파생된 허용 목록 또는 API가 반환하는 허용 목록을 사용한다. 프런트와 API에 서로 다른 배열을 중복 하드코딩하지 않는다.
4. 최소한 다음 조합은 확실히 거절한다.
   - Customer + `PARTNER_BONUS`
   - Customer + `RECEIVABLE_WRITE_OFF`
   - Partner + `PROMOTION_CREDIT`
   - 일반 생성 화면의 `CASH_BOOKING_DEDUCTION`
   - 원본 실행 요청이 없는 `MANUAL_REVERSAL`
5. `PENALTY`처럼 revenue 영향을 만들 수 있는 조합은 기존 UI의 `blockedAccountingImpact`에만 의존하지 않는다. API가 최종 허용/거절한다.
6. 현재 enum `CUSTOMER_COMPENSATION`이 Partner owner에서 `PARTNER_COMPENSATION_EXPENSE`로 변환되는 동작을 확인한다. 저장 enum을 섣불리 변경하지 말고, 정책상 허용된다면 화면 라벨만 owner에 따라 `Customer compensation` 또는 `Partner compensation`으로 표시한다.
7. 저장된 과거 record의 raw enum 호환성을 깨지 않는다.
8. 회계 정책을 코드·문서·테스트에서 찾을 수 없는 조합은 임의로 허용하지 않는다. 안전하게 차단하고 최종 보고서에 `재무 정책 확인 필요`로 별도 기록한다.
9. 모든 허용 조합은 debit/credit 계정과 affects 결과를 검증하고, 모든 거절 조합은 preview와 create API가 같은 오류 코드를 반환하도록 테스트한다.

### 권장 구조

- 정책 이름 예: `manual-wallet-adjustment-policy.ts`
- 제공 함수 예:
  - `getAllowedManualAdjustmentTypes(ownerType, direction)`
  - `assertManualAdjustmentCombinationAllowed(input)`
  - `getManualAdjustmentPolicyReason(input)`
- 오류는 문자열 비교에 의존하지 말고 안정적인 code를 둔다.
  - 예: `WALLET_ADJUSTMENT_COMBINATION_NOT_ALLOWED`
  - 예: `WALLET_ADJUSTMENT_REVERSAL_SOURCE_REQUIRED`
  - 예: `WALLET_ADJUSTMENT_SETTLEMENT_ROUTE_REQUIRED`

함수명은 현행 코드에 맞게 조정해도 되지만 정책의 단일 권위와 deny-by-default 원칙은 바꾸지 않는다.

## 5. P0 — 생성 폼의 민감 정보를 URL과 redirect에서 제거

### 제거 대상

생성 및 미리보기 과정에서 다음 값이 주소, 브라우저 히스토리, redirect URL에 남으면 안 된다.

- `ownerId`
- `amount`
- `reason`
- `attachmentUrl` 또는 증거 접근 URL
- 생성 폼의 기타 민감한 draft 값

### 구현 요구

1. `readWalletAdjustmentFormState`가 생성 입력을 `searchParams`에서 읽는 구조를 제거한다.
2. 미리보기는 GET navigation이 아니라 POST 기반 server action 또는 인증된 preview 호출과 로컬 form state로 처리한다.
3. 새로고침 복구가 반드시 필요하면 URL에는 불투명하고 짧게 만료되는 server-side draft ID만 둔다.
4. 생성 성공 redirect에는 안전한 notice code와 생성된 request ID 정도만 허용한다.
5. attachment의 실제 signed URL을 저장·전달하지 말고, 가능하면 통제된 storage object ID 또는 attachment ID를 사용한다. 현행 저장 계약 때문에 즉시 변경하기 어렵다면 적어도 URL과 로그에 노출되지 않도록 하고 위험을 명시한다.
6. URL 보안 회귀 테스트를 추가한다. 성공·검증 실패·API 실패 redirect 모두에서 reason과 attachment가 없어야 한다.
7. 잘못된 `javascript:` 등 attachment scheme 차단은 유지한다.

## 6. P1 — 한 route 안의 실제 업무 탭으로 재구성

물리적인 페이지를 추가하지 말고 `/wallet-adjustments` 안에서 다음 세 view를 실제 렌더 및 데이터 로드 분기로 구현한다.

```text
Wallet Adjustments
├─ Records       기본 화면, 실행된 원장 및 감사 조회
├─ Requests      요청 lifecycle 이력
└─ New request   권한 있는 maker의 생성 작업
```

### 탭 계약

- `view=records`: 기본값. 원장 목록·필터만 불러온다.
- `view=requests`: 요청 목록·필터만 불러온다.
- `view=create`: owner 검색, 생성 폼, 미리보기만 불러온다.
- 알 수 없는 view는 `records`로 정규화한다.
- 활성 탭을 `aria-current` 또는 적절한 tab semantics로 표시한다.
- `New request`는 권한이 있는 maker에게만 제공한다.
- pending의 승인·거절 실행은 `/finance-tax/approval-queue?view=wallet`이 유일한 workspace다.
- `Requests`에는 lifecycle 추적과 Approval Queue 이동만 제공하고 승인 UI를 중복 구현하지 않는다.
- 활성 view와 무관한 list·summary API를 호출하지 않는다.
- 가능하면 list 응답의 total을 활용해 별도 summary count 호출을 제거하되, 계약을 무리하게 넓히지 않는다.

### create 화면

- 작업 순서: 대상 검색 → 대상 고정 → 방향 → 허용 사유 유형 → 금액 → 귀속 월 → 증거 → 상세 사유 → 변경 내용 검토 → 승인 요청 생성
- 선택된 owner는 이름/reference, 유형, 상태, 현재 잔액이 보이는 고정 summary로 표시한다.
- `대상 변경`을 제공한다.
- 미리보기는 입력 폼 옆 패널 또는 바로 아래에 배치한다.
- 1440×900에서 preview 결과와 최종 CTA가 입력 완료 지점으로부터 1 viewport 안에 보여야 한다.
- preview가 오래되었으면 amount/type/direction/owner 변경 시 명시적으로 invalidation한다.
- 입력과 preview payload가 일치하지 않으면 제출할 수 없다.

## 7. P1 — 오류, 빈 상태, 로딩 상태를 분리

현재 `adminGet`/`adminPost` fallback이 API 실패를 빈 배열, `0`, `null`로 바꾸어 실제 0건과 장애가 구분되지 않는다.

### 구현 요구

1. 이 페이지의 데이터 요청은 `ok`, `status`, 안전한 error code를 보존하는 result 형태를 사용한다.
2. 다음 상태를 명확히 구분한다.
   - loading
   - genuine empty
   - validation error
   - permission error
   - API/service failure
   - success
3. section 단위 실패는 다른 정상 section을 지우지 말고 `조회 실패 — 다시 시도`를 표시한다.
4. preview 오류는 form 상단 요약과 해당 필드의 inline 오류로 표시한다.
5. 오류 발생 시 첫 오류 또는 오류 summary로 포커스를 이동한다.
6. 실패 메시지는 내부 stack, endpoint, raw exception을 노출하지 않고 운영자가 다음 행동을 이해하게 쓴다.

예:

- `이 대상과 조정 유형은 함께 사용할 수 없습니다. 조정 유형을 다시 선택하세요.`
- `최신 잔액이 변경되어 다시 검토해야 합니다.`
- `미리보기를 불러오지 못했습니다. 입력값은 유지되었습니다. 다시 시도하세요.`

## 8. Manual reversal 흐름 수정

1. `Manual reversal`을 일반 `New request`의 adjustment type 목록에서 제거한다.
2. 실행 완료된 원장 또는 요청 상세의 `이 조정 반전 요청` 액션에서만 시작하게 한다.
3. 원본 request ID, owner, 금액, 반대 방향, 원본 회계 entry를 고정한다.
4. 사용자가 임의로 owner·금액·방향을 바꿀 수 없게 한다.
5. 새 반전 사유와 필요 증거만 입력하게 한다.
6. 이미 반전됨, 원본 불일치, 닫힌 월, 권한 부족 등 실패를 구체적으로 보여 준다.
7. 기존 reversal API 계약을 재사용하고, 별도 승인과 idempotency를 유지한다.

원장·요청 상세 화면까지 수정 범위가 커질 경우에는 최소한 일반 옵션을 제거하고 정상 진입 링크/액션을 구현할 수 있는 가장 가까운 기존 상세 surface를 사용한다. 새 라우트를 임의로 만들지 않는다.

## 9. 요청·원장 필터와 표 개선

### 상태 독립성

생성, 요청, 원장 state가 같은 query key를 공유하지 않게 한다.

- 생성 state는 URL에 두지 않는다.
- 요청 필터: `requestStatus`, `requestOwnerType`, `requestOwnerId`, `requestDateRange` 등 request prefix 사용
- 원장 필터: `recordOwnerType`, `recordOwnerId`, `recordDateRange` 등 record prefix 사용
- pagination은 활성 탭의 필터만 보존한다.
- exact owner filter가 있으면 이름/reference chip과 `해제`를 항상 보여 준다.

### Requests 필터

현행 API가 지원하는 범위 안에서 우선 구현하고, 필요한 API filter를 좁게 추가한다.

- 상태
- 기간: 오늘, 7일, 30일, 사용자 지정
- owner 이름·전화·reference
- request ID
- maker/approver
- adjustment type과 direction
- 금액 범위
- 증거 상태
- 정렬: 오래된 순, 최신 순, 큰 금액 순, SLA 위험 순
- `모두 초기화`

pending row에는 가능한 범위에서 다음을 표시한다.

- age
- SLA 또는 stale 상태
- blocker
- maker 때문에 자기 승인 불가능한지
- Approval Queue 이동 링크

### Records 필터

- posting 기간과 귀속 월
- owner 검색
- request/approval/ledger/journal ID
- adjustment type과 direction
- 금액 범위
- reversal 여부
- maker/approver
- 회계 계정
- 감사 내보내기 기능이 이미 공통 패턴으로 존재하면 재사용

### 표 가독성

1. 1440px에서 owner 이름, ID, enum이 문자 단위로 쪼개지지 않게 scoped table layout을 적용한다.
2. `overflow-wrap:anywhere`를 전체 핵심 열에 적용하지 않는다.
3. ID는 축약 표시 + 복사 기능 또는 detail drawer에서 전체 표시한다.
4. raw enum, 긴 reason, accounting detail, actor metadata는 기본 행에 모두 쌓지 말고 detail drawer/disclosure로 이동한다.
5. 상태, owner, amount, created/posted time, next action을 우선 열로 둔다.
6. `Ledger linked`, `Attachment saved`는 실제 원장·journal·증거 링크로 바꾼다.
7. row action은 텍스트 의미와 키보드 focus를 갖는다.

## 10. 문구와 접근성

### 운영자 문구

아래 방향으로 교체하되 기존 번역·용어 체계와 일관성을 유지한다.

| 기존 | 권장 |
|---|---|
| Wallet owner type | Wallet owner |
| Customer or partner | Name or phone number |
| Credit wallet | Add balance (+) |
| Debit wallet | Deduct balance (−) |
| Adjustment type | Adjustment reason |
| Monthly period | Accounting month |
| Attachment URL | Evidence attachment |
| Preview accounting | Review changes |
| Preview required | Review required |
| Submit for approval | Create approval request |
| Adjustment request history | Adjustment requests |
| Manual adjustment history | Executed wallet adjustments |
| Ledger linked | View ledger record |
| No wallet ledger write | No balance change |
| Awaiting decision | Awaiting finance approval |
| No direct DB write | Preview — not applied yet |
| Approval id still required | Applied only after separate finance approval |

- user-facing copy에서 `DB write`, raw enum, 내부 구현 용어를 기본 노출하지 않는다.
- raw enum과 debit/credit 계정명은 `Accounting details` disclosure에서 확인 가능하게 유지한다.
- Partner owner에서 `CUSTOMER_COMPENSATION`을 노출해야 한다면 라벨은 `Partner compensation`으로 humanize한다.

### 접근성

1. 모든 필드는 항상 보이는 실제 label을 가진다. placeholder를 label로 사용하지 않는다.
2. 세 데이터 영역에 서로 다른 accessible name을 준다.
   - `Wallet owner search results`
   - `Wallet adjustment requests`
   - `Executed wallet ledger`
3. 중복되는 `Wallet owner`, `Rows per page` control은 fieldset/legend 또는 고유 label로 구분한다.
4. 오류에 `aria-invalid`, `aria-describedby`를 연결한다.
5. 성공·오류·필터 적용 후 합리적인 heading 또는 status로 포커스를 이동한다.
6. primary button의 일반 텍스트 대비는 최소 4.5:1을 확보한다.
7. placeholder 안내 텍스트가 필요하면 보조 설명으로 이동하고 충분한 대비를 사용한다.
8. 색상만으로 상태를 전달하지 않는다.

## 11. 입력 계약과 증거 처리

프런트와 API의 제한을 맞춘다.

- VND 금액은 양의 정수이며 API 최대값을 UI와 server action에서도 검증
- reason의 API 최대 길이를 label/helper와 입력 `maxLength`에 반영
- attachment 식별자의 최대 길이와 허용 형식 일치
- 회계 귀속 월은 `type=month` 또는 동등한 강한 입력 검증 사용
- 금액은 입력과 미리보기에서 VND formatting 제공
- 고액과 write-off에는 증거 누락 이유와 해결 행동 표시
- 증거는 가능하면 임의 URL 입력이 아니라 기존 통제형 upload/attachment picker 패턴 재사용
- 증거 접근 권한과 짧은 만료 URL 정책을 깨지 않는다

## 12. 성능 기준

- 기본 `records` view에서 create, owner search, request list API를 호출하지 않는다.
- `requests` view에서 ledger list API를 호출하지 않는다.
- `create` view에서 request와 ledger list를 호출하지 않는다.
- 초기 DOM 목표: 600개 이하
- 기본 view 세로 길이 목표: 2,500px 이하
- 상세 증거와 회계 상세는 drawer/disclosure가 열릴 때 로드
- 불필요한 `no-store` 요청과 중복 summary 요청을 줄인다.
- 기존 캐시·실시간 정확성 계약을 확인한 뒤 변경하며, 금전 데이터가 오래 캐시되지 않게 한다.

## 13. 화면 제약과 디자인 기준

- 실제 운영 환경은 데스크톱 1440px 이상이다.
- 1440×900을 주 검증 viewport로 사용하고 넓은 화면에서 과도한 빈 공간이나 긴 줄이 생기지 않는지만 추가 확인한다.
- 기존 Admin shell, spacing, typography, badge, form, table 패턴을 유지한다.
- 장식보다 scanability, 정확한 상태, 다음 행동, 고밀도 데이터 가독성을 우선한다.
- 거대한 hero, 불필요한 KPI 카드, 그라데이션, 새 색상 체계, 과도한 animation을 추가하지 않는다.
- 정책 설명은 반복 카드로 크게 쌓지 말고 짧은 summary와 필요 시 disclosure로 제공한다.

## 14. 테스트 요구

### API

최소 다음을 추가 또는 보강한다.

- 모든 owner/type/direction 허용 matrix
- Customer + Partner bonus 거절
- Customer + Receivable write-off 거절
- Partner + Promotion credit 거절
- Cash booking deduction의 settlement route 강제
- Manual reversal source 필수
- revenue/tax/bank 관련 UI-only block의 API 강제
- preview와 create의 동일 정책 오류
- 허용 조합별 debit/credit account snapshot
- closed period, balance, maker/checker, idempotency 기존 회귀

### Admin Web

- view별로 필요한 API만 호출하는지
- 기본 view가 records인지
- create 입력이 URL에 포함되지 않는지
- 성공·실패 redirect에 reason/attachment/amount/ownerId가 없는지
- owner와 direction 변경 시 허용 option만 표시되는지
- preview invalidation과 payload 일치 여부
- preview 오류와 retry UI
- Manual reversal 일반 option 제거
- request/record filter state 독립성과 pagination 보존
- exact owner chip과 reset
- 고유한 table accessible name
- 시각 label, 오류 연결, focus 이동
- 1440px 표 class/min-width/nowrap 회귀

### 실행 명령

현재 package script를 먼저 확인하고 정확한 명령으로 실행한다. 최소한 다음 범위를 검증한다.

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- app/wallet-adjustments/page.spec.tsx app/wallet-adjustments/actions.spec.ts
npm.cmd run test --workspace @massage-vn/api -- src/wallet-adjustments/wallet-adjustments.accounting.spec.ts
npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api
```

금전 동작을 변경하므로 환경이 허용하면 `npm.cmd run verify:local`도 실행한다. 환경·기존 실패 때문에 실행하지 못하면 실패를 숨기지 말고 정확한 명령, 원인, 영향 범위를 최종 보고서에 기록한다.

## 15. 실제 화면 검증

1. 로그인된 기존 브라우저 세션을 사용한다.
2. 1440×900에서 다음 상태를 캡처하고 직접 비교한다.
   - Records 기본 화면
   - Requests 기본 화면
   - Pending + oldest/SLA 필터
   - New request 초기 화면
   - Customer 선택 후 허용 옵션
   - Partner 선택 후 허용 옵션
   - 정상 preview와 CTA
   - 잘못된 조합 차단 오류
   - preview API 실패 상태
   - exact owner filter와 해제
   - record detail/evidence 링크
3. `Customer + Partner bonus`가 옵션에서 보이지 않고, API 직접 테스트에서도 거절되는지 확인한다.
4. 주소창과 history에 reason, attachment, amount, ownerId가 남지 않는지 확인한다.
5. preview가 입력 완료 위치에서 1 viewport 안에 보이는지 확인한다.
6. 1440px에서 표의 이름·ID·enum이 문자 단위로 깨지지 않는지 확인한다.
7. 실제 `Submit for approval`, 승인, 거절, 취소, 반전 등 금전 상태를 바꾸는 액션은 실행하지 않는다. 테스트 fixture와 non-mutating preview로 검증한다.
8. UI 변경 완료 후 Impeccable detector를 변경된 UI 파일에 정확히 한 번 실행하고 결과를 검토한다.

## 16. 완료 수용 기준

- [ ] 잘못된 owner/type/direction 조합이 UI와 API 양쪽에서 거절된다.
- [ ] 정책의 단일 권위와 deny-by-default 동작이 테스트된다.
- [ ] Manual reversal은 원본 executed adjustment에서만 시작된다.
- [ ] 생성 입력과 증거 정보가 URL 또는 redirect에 남지 않는다.
- [ ] `records`, `requests`, `create`가 실제 렌더·데이터 로드 탭이다.
- [ ] 기본 탭은 Records다.
- [ ] preview와 최종 CTA가 입력 위치에서 1 viewport 안에 있다.
- [ ] API 실패가 0건 또는 빈 상태처럼 보이지 않는다.
- [ ] preview 실패가 필드 오류와 다음 행동을 제공한다.
- [ ] request와 record 필터가 독립적이며 reset과 pagination이 정상 동작한다.
- [ ] pending 요청에서 age/SLA/blocker/Approval Queue 링크를 확인할 수 있다.
- [ ] 요청→승인→ledger→journal→evidence를 실제 링크로 추적할 수 있다.
- [ ] 1440px에서 핵심 셀의 문자 단위 줄바꿈이 없다.
- [ ] 실제 label, 고유 region 이름, 오류 연결, focus 처리가 있다.
- [ ] 일반 크기 primary button text 대비가 4.5:1 이상이다.
- [ ] 활성 view 외의 API 호출과 대량 DOM이 제거된다.
- [ ] 대상 테스트와 admin/api scope 검증이 통과한다.

## 17. 금지 사항

- 프런트의 option 숨김이나 button disabled만으로 회계 안전 문제가 해결됐다고 판단하지 않는다.
- 회계 정책을 추측해 애매한 조합을 허용하지 않는다.
- `adminGet(..., [])`, `adminPost(..., null)` 식으로 오류를 빈 상태로 숨기지 않는다.
- `reason`, `attachmentUrl`, amount, owner ID를 query string에 다시 넣지 않는다.
- 요청·원장·생성을 다시 한 긴 세로 페이지에 동시에 렌더하지 않는다.
- Approval Queue의 승인 기능을 이 페이지에 중복 구현하지 않는다.
- 일반 생성 유형으로 `MANUAL_REVERSAL` 또는 `CASH_BOOKING_DEDUCTION`을 제공하지 않는다.
- 기존 사용자 변경을 reset, checkout, clean, stash하거나 덮어쓰지 않는다.
- 무관한 파일을 포맷하거나 광범위하게 정리하지 않는다.
- 실제 금전 변경 액션으로 UI QA를 하지 않는다.

## 18. 최종 산출물

작업이 끝나면 다음을 제공한다.

1. 수정된 코드와 테스트
2. `output/wallet-adjustments-remediation-2026-08-09/` 아래의 1440px 검증 스크린샷
3. 같은 폴더의 `wallet-adjustments-remediation-report.md`
4. 최종 응답에는 다음을 명확히 정리한다.
   - 변경 파일
   - P0/P1 해결 내용
   - 회계 허용 matrix와 정책 근거
   - 실행한 명령과 pass/fail/skipped 결과
   - protected area 접촉 여부
   - 실제 금전 변경 없이 검증한 범위
   - 남은 재무 정책 결정과 위험
   - 다음 권장 작업

완료 여부는 “화면이 더 예뻐졌다”가 아니라 **잘못된 조정이 서버에서 차단되고, 민감 정보가 URL에 남지 않으며, 운영자가 1440px 화면에서 한 업무를 빠르고 정확하게 끝낼 수 있는지**로 판단하라.
