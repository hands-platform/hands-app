# HANDS Admin 정보 구조 제안

## 목표

운영자가 시스템 구조가 아니라 **업무 목적과 처리 시점**으로 화면을 찾게 한다. 1차 구현은 기존 라우트를 그대로 재배치한다. URL 변경과 새 화면은 실제 분리가 필요한 경우에만 2차로 진행한다.

## 현재 메뉴 구조

| 현재 그룹 | 메뉴 |
|---|---|
| Shift Operations | Start Shift, Calendar, Operations History |
| Bookings | Live Bookings, Completed, Post-match Cancellations |
| Customers | Customers, Customer Referrals, Customer Reviews, Partner Evaluations |
| Partners | Partners, Unapproved Partners, Unsettled Partners, Partner Referrals |
| Analytics | Vietnam Overview, Usage Overview, Partner Overview, Marketing Analytics |
| Growth & Communications | Coupons, Notifications, Notification Templates, Push Send |
| Finance Today | Finance Overview, Approval Queue, Refunds, Payout/Withdrawal Risk, Unmatched Bank Transactions |
| Money Movement | Payments, Payment Clearing, Wallet Adjustments, Partner Bank Deposits, Payouts |
| Accounting Records | General Ledger, Booking Settlement Records, Settlement Reversals, Coupon Finance |
| Tax & Monthly Close | Monthly Tax Closing, Platform VAT, Partner Withholding, Payment Fees |
| Restricted Settings | Company Bank Accounts, Finance Approvers, Tax Policy |
| Policies | Operations Policy, Service Catalog, Website Content |
| Admin Control | Admin Operators, Audit Log |
| Developer / System | Setup Readiness, App Sessions, Background Jobs |

현재 구조는 제품 모듈과 회계 분류를 충실히 반영하지만, 오늘의 운영 업무와 설정·기술 증거가 여러 그룹에 흩어진다. 특히 메뉴 밖의 Cash Settlements, Finance Closeout, Partner Controls, Earnings, Referral Cashouts는 발견성이 낮다.

## 제안 구조

```text
Start Shift
├─ Live Operations
│  ├─ Live Bookings
│  ├─ Calendar
│  ├─ Completed Bookings
│  ├─ Post-match Cancellations
│  └─ Operations History
├─ Customer Support
│  ├─ Customers
│  ├─ Customer Reviews
│  ├─ Partner-to-Customer Evaluations
│  ├─ Chat Evidence
│  └─ Customer Notifications
├─ Partner Operations
│  ├─ Partner Approvals
│  ├─ Partner Directory
│  ├─ Partner Controls
│  ├─ Partner Performance
│  └─ Partner Referrals
├─ Finance Today
│  ├─ Finance Overview
│  ├─ Approval Queue
│  ├─ Refunds
│  ├─ Bank Reconciliation
│  ├─ Cash Settlements
│  ├─ Payment Clearing
│  └─ Finance Closeout
├─ Finance Records
│  ├─ Payments
│  ├─ Partner Deposits
│  ├─ Payouts
│  ├─ Partner Earnings
│  ├─ Wallet Adjustments
│  ├─ General Ledger
│  ├─ Settlement Audit & Reversals
│  └─ Coupon Finance
├─ Growth & Content
│  ├─ Marketing Analytics
│  ├─ Coupons
│  ├─ Customer Referrals
│  ├─ Referral Cashouts
│  ├─ Notification Templates
│  ├─ Push Send
│  └─ Website Content
├─ Tax, Close & Policies
│  ├─ Tax & Close Overview
│  ├─ Monthly Tax Closing
│  ├─ Platform VAT
│  ├─ Partner Withholding
│  ├─ Payment Fee Evidence
│  ├─ Operations Policy
│  ├─ Service Catalog
│  └─ Restricted Settings
└─ Admin & System
   ├─ Admin Operators
   ├─ Audit Log
   └─ Developer/System
      ├─ Setup
      ├─ App Sessions
      └─ Background Jobs
```

사이드바에는 최상위 8개 영역과 사용자의 역할에 맞는 항목만 보인다. `Developer/System`은 지금처럼 `MASTER_ADMIN` 중심으로 격리한다.

## 핵심 원칙

1. **오늘 할 일 먼저:** 각 영역의 첫 화면은 설명서가 아니라 대기 큐, 최장 대기, 금액, 담당자, 다음 행동을 보여 준다.
2. **읽기와 쓰기 분리:** 목록과 상세는 판단을 돕고, 금액·승인·발송·정책 변경은 명시적으로 연 작업 패널에서만 수행한다.
3. **기술 증거는 단계적으로:** 원시 ID, JSON, callback, metadata는 기본 목록에서 숨기고 상세 또는 Developer/System에서 제공한다.
4. **권한 없는 항목은 숨김:** 비활성 메뉴를 쌓지 않고, 접근 가능한 업무만 보여 준다. 직접 URL 접근은 명확한 권한 없음 상태를 반환한다.
5. **한 객체, 한 정식 경로:** `/providers`, `/files`, `/referrals` 같은 별칭은 호환 리다이렉트로만 유지한다.

## 현재 라우트 매핑

### Start Shift / Live Operations

| 제안 메뉴 | 기존 라우트 | 조치 |
|---|---|---|
| Start Shift | `/` | 유지. 열린 큐 종류와 총 레코드 수를 구분 |
| Live Bookings | `/bookings` | 유지. 기본 랜딩 |
| Completed Bookings | `/bookings/completed` | 유지 |
| Post-match Cancellations | `/bookings/post-match-cancellations` | 유지 |
| Calendar | `/calendar` | 유지 |
| Operations History | `/operations-handoff` | 유지 |

### Customer Support

| 제안 메뉴 | 기존 라우트 | 조치 |
|---|---|---|
| Customers | `/customers` | 유지 |
| Customer Reviews | `/reviews` | 유지 |
| Partner-to-Customer Evaluations | `/reviews/partner-customer-evaluations` | 유지 |
| Chat Evidence | `/chat-archive` | 숨은 경로를 정식 메뉴로 승격 |
| Customer Notifications | `/notifications` | Growth가 아니라 고객지원의 발송 이력/운영 큐로 배치 |
| Files | `/files` | 메뉴에서 제거하고 `/chat-archive` 리다이렉트 유지 |

### Partner Operations

| 제안 메뉴 | 기존 라우트/쿼리 | 조치 |
|---|---|---|
| Partner Approvals | `/partners?review=unapproved` | 가장 자주 쓰는 큐로 노출 |
| Partner Directory | `/partners` | 유지 |
| Unsettled Partners | `/partners?review=unsettled` | Finance Today에서도 교차 링크 |
| Partner Controls | `/partner-controls` | 숨은 경로를 정식 메뉴로 승격 |
| Partner Performance | `/partners/overview` | 기존 Analytics에서 이동 |
| Partner Referrals | `/referrals/partners` | 유지 |
| Providers | `/providers`, `/providers/[id]` | 메뉴에서 제거하고 Partner 경로로 리다이렉트 유지 |

### Finance Today

| 제안 메뉴 | 기존 라우트/쿼리 | 조치 |
|---|---|---|
| Finance Overview | `/finance-overview` | 기본 랜딩 |
| Approval Queue | `/finance-tax/approval-queue` | 유지 |
| Refunds | `/refunds` | 유지 |
| Bank Reconciliation | `/finance-tax/bank-reconciliation` | 유지. 가져오기 흐름은 별도 탭/단계로 분리 |
| Cash Settlements | `/cash-settlements` | 숨은 경로를 정식 메뉴로 승격 |
| Payment Clearing | `/finance-tax/payment-clearing` | 유지 |
| Finance Closeout | `/finance-closeout` | 숨은 경로를 정식 메뉴로 승격 |
| Payout Risk | 기존 payout risk 쿼리 | Payouts의 저장된 뷰로 유지 |
| Unmatched Bank | 기존 unmatched bank 쿼리 | Bank Reconciliation의 저장된 뷰로 유지 |

### Finance Records

| 제안 메뉴 | 기존 라우트 | 조치 |
|---|---|---|
| Payments | `/payments` | callback 전체 ledger는 상세로 이동 |
| Partner Deposits | `/finance-tax/partner-bank-deposits` | 유지 |
| Payouts | `/payouts` | 유지 |
| Partner Earnings | `/earnings` | 숨은 경로를 정식 메뉴로 승격 |
| Wallet Adjustments | `/wallet-adjustments` | 유지. 검색 기반 대상 선택기로 변경 |
| General Ledger | `/finance-tax/general-ledger` | 유지 |
| Settlement Audit | `/finance-tax/booking-settlement-audit` | 유지 |
| Settlement Reversals | `/finance-tax/settlement-reversals` | 유지 |
| Coupon Finance | `/finance-tax/coupon-finance` | 유지 |

### Growth & Content

| 제안 메뉴 | 기존 라우트 | 조치 |
|---|---|---|
| Marketing Analytics | `/marketing-analytics` | 분석 유지, spend 저장 작업은 별도 패널 |
| Coupons | `/coupons` | 유지 |
| Customer Referrals | `/referrals/customers` | 유지 |
| Referral Cashouts | `/referrals/cashouts` | 숨은 경로를 정식 메뉴로 승격 |
| Notification Templates | `/notifications/templates` | 유지. 이벤트/언어 편집 구조 개선 |
| Push Send | `/notifications/push-send` | 유지. 권한과 확인 단계 유지 |
| Website Content | `/website-content` | 유지 |
| Referrals alias | `/referrals` | `/referrals/customers` 리다이렉트 유지 |

### Tax, Close & Policies

| 제안 메뉴 | 기존 라우트 | 조치 |
|---|---|---|
| Tax & Close Overview | `/finance-tax` | `/finance-overview`와 중복되지 않게 기간 마감 상태만 표시 |
| Monthly Tax Closing | `/finance-tax/monthly-tax-closing` | 유지 |
| Platform VAT | `/finance-tax/platform-vat` | 유지 |
| Partner Withholding | `/finance-tax/partner-withholding-tax` | 유지 |
| Payment Fee Evidence | `/finance-tax/payment-fees` | 기간별 적용 결과만 기본 표시 |
| Operations Policy | `/operations-policy` | 읽기 요약 + 정책별 편집 패널 |
| Service Catalog | `/services` | 유지 |
| Tax Policy | `/tax-policy` | Restricted Settings 하위 |
| Company Bank Accounts | `/finance-tax/company-bank-accounts` | Restricted Settings 하위 |
| Finance Approvers | `/finance-tax/finance-approvers` | Restricted Settings 하위 |
| Referral Policy | 현재 고객/파트너 referral 페이지의 편집기 | 1차는 기존 액션 재사용, 메뉴는 Restricted Settings로 이동 |
| Payment Fee Policy | 현재 payment-fees의 초안 편집기 | 1차는 기존 액션 재사용, 메뉴는 Restricted Settings로 이동 |

### Admin & System

| 제안 메뉴 | 기존 라우트 | 조치 |
|---|---|---|
| Admin Operators | `/admin-operators` | 유지 |
| Audit Log | `/audit-log` | metadata는 행 기본값에서 접기 |
| Setup | `/setup` | Developer/System 유지 |
| App Sessions | `/app-sessions` | Developer/System 유지 |
| Background Jobs | `/background-jobs` | Developer/System 유지, 핵심 열만 남김 |

## 영역별 랜딩 화면 계약

새 대시보드를 여러 개 만들 필요는 없다. 기존 목록 위에 공통된 작은 요약 규칙만 적용한다.

| 순서 | 반드시 보여 줄 정보 | 제외할 정보 |
|---:|---|---|
| 1 | 현재 역할이 처리해야 할 큐와 건수 | 기능 소개 문장 |
| 2 | 최장 대기, 금액/영향, 담당자 | 구현 방식, raw enum |
| 3 | 가장 중요한 기본 행동 하나 | 모든 가능한 행동의 동시 노출 |
| 4 | 저장된 뷰와 현재 필터 | 0으로만 채워진 KPI 줄 |
| 5 | 최근 완료/감사 이력 링크 | 전체 metadata, payload JSON |

## 상세 화면 계약

- 상단: 객체 식별 요약, 현재 상태, 가장 중요한 다음 행동, 위험 경고.
- 본문: `Overview / Activity / Money / Communications / Evidence`처럼 객체에 맞는 섹션.
- 쓰기 작업: 하나를 선택해 여는 패널. 대상 신원, 변경 전/후, 사유, 증거, 승인 필요 여부를 고정 표시.
- 완료 후: 변경 결과와 감사 이벤트 링크를 같은 자리에서 제공.
- 원시 ID와 payload: `Technical evidence` 접힘 영역에만 표시.

## 권한과 메뉴 가시성

기존 `admin-operator-access-model.ts`를 단일 근거로 계속 사용한다. 새 권한 체계를 추가하지 않고, 같은 카테고리를 제안 그룹에 매핑한다.

| 사용자 유형 | 기본 시작점 | 기본 노출 |
|---|---|---|
| Shift operator | Start Shift | Live Operations, Customer Support |
| Partner operator | Partner Approvals | Partner Operations, 필요한 고객지원 링크 |
| Finance operator | Finance Overview | Finance Today, Finance Records, Tax & Close |
| Growth/content | Marketing Analytics | Growth & Content, 읽기 가능한 고객 결과 |
| Admin manager | Start Shift | 허용된 전체 운영 영역, Admin Control |
| Master admin | Start Shift | 전체 + Restricted Settings + Developer/System |

권한이 없는 직접 URL에는 일반 not-found가 아니라 `이 화면에 접근할 권한이 없습니다`와 요청 경로에 맞는 안전한 목록 CTA를 제공한다.

## 구현 순서

1. **메뉴 재배치:** `admin-navigation.ts`에서 기존 URL을 8개 영역으로 재그룹한다.
2. **숨은 큐 승격:** 기존 다섯 핵심 경로를 역할에 따라 보이게 한다.
3. **라벨 정리:** 기술/개발 문구와 raw enum을 운영 문구로 매핑한다.
4. **고위험 작업 분리:** 지갑 조정, 고객 발송, 정책 저장, 은행 가져오기를 한 번에 하나씩 여는 작업으로 바꾼다.
5. **필요할 때만 URL 정리:** 사용 로그와 운영자 테스트 후 정책 전용 URL을 추가한다. 기존 URL은 리다이렉트로 유지한다.

URL을 먼저 대규모 변경하거나 새 공통 프레임워크를 만들 필요는 없다. 기존 라우트와 접근 모델을 재사용하는 메뉴 재배치가 첫 단계다.

## 기존 URL과 제안 URL

| 기존 URL/기능 | 1차 제안 URL | 향후 분리 시 URL | 권한 |
|---|---|---|---|
| `/`, `/calendar`, `/operations-handoff` | 동일 | 없음 | Shift 운영 권한 |
| `/bookings`와 하위 상세 | 동일 | 없음 | Booking 운영 권한 |
| `/customers`, `/reviews`, `/chat-archive` | 동일 | 없음 | 고객지원/증거 권한 |
| `/partners`, `/partner-controls`, `/partners/overview` | 동일 | 없음 | Partner 운영 권한 |
| `/finance-overview`, `/refunds`, `/cash-settlements`, `/finance-closeout` | 동일 | 없음 | Finance 운영 권한 |
| `/finance-tax/bank-reconciliation` | 동일 | 같은 URL의 `review`/`import` 작업 탭 우선 | Bank reconciliation 권한 |
| `/payments`, `/payouts`, `/earnings`, `/wallet-adjustments` | 동일 | 없음 | 해당 money movement 권한 |
| `/finance-tax/*` 기록·마감 화면 | 동일 | 없음 | Accounting/Tax 권한 |
| referral 목록 안 정책 편집 | 기존 action 재사용 | `/settings/referral-policy`는 실제 분리 필요가 확인된 뒤 추가 | Restricted policy 권한 |
| payment-fees 안 정책 편집 | 기존 action 재사용 | `/settings/payment-fee-policy`는 실제 분리 필요가 확인된 뒤 추가 | Restricted finance 권한 |
| `/operations-policy`, `/services`, `/tax-policy` | 동일 | 없음 | Policy/Restricted 권한 |
| `/admin-operators`, `/audit-log` | 동일 | 없음 | Admin Control 권한 |
| `/setup`, `/app-sessions`, `/background-jobs` | 동일 | 없음 | Master/Developer-System 권한 |
| `/providers`, `/providers/[id]` | `/partners`, `/partners/[id]` | 별칭 제거는 사용량 0 확인 후 | Partner 권한 |
| `/files` | `/chat-archive` | 별칭 제거는 사용량 0 확인 후 | Chat evidence 권한 |
| `/referrals` | `/referrals/customers` | 별칭 제거는 사용량 0 확인 후 | Referral 권한 |
