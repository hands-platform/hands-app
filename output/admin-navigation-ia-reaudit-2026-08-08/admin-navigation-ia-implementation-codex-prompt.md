# Codex 실행 프롬프트 — 관리자 카테고리 및 정보 구조 개편

아래 내용을 새 Codex 작업에 그대로 붙여 넣어 사용한다.

---

## 프롬프트 시작

`C:\dev\massage-on-demand-vn` 프로젝트의 관리자 웹 정보 구조와 내비게이션을 실제 운영자 중심으로 개편해줘. 단순히 메뉴명을 바꾸는 작업이 아니라, 중복 링크를 제거하고 관련 업무를 하나의 작업공간으로 연결하며 검색·아이콘·접기 동작까지 일관되게 수정하는 작업이다.

### 가장 먼저 읽을 자료

다음 보고서를 처음부터 끝까지 읽고, 보고서의 감사 결과를 이번 구현의 요구사항과 판단 근거로 사용해라.

`C:\dev\massage-on-demand-vn\output\admin-navigation-ia-reaudit-2026-08-08\admin-navigation-information-architecture-audit.md`

보고서와 같은 폴더의 `01`~`11` PNG는 현재 화면의 증거다. 구현 전후 비교에 사용해라.

프로젝트 안에 적용되는 `AGENTS.md`가 있으면 먼저 읽고 따른다. `git status`로 기존 변경사항을 확인하고, 사용자 변경을 덮어쓰거나 되돌리지 마라.

### 권장 작업 방식과 스킬

- 관리자 도구이므로 디자인 모드는 **Operate**로 판단한다. 화려함보다 탐색 속도, 예측 가능성, 업무 상태 인지, 안전한 행동을 우선한다.
- 사용 가능한 경우 `$impeccable distill` 원칙을 적용해 기능을 삭제하지 않고 탐색 복잡성만 줄인다.
- 실제 화면 검증에는 `browser:control-in-app-browser`를 사용한다. 이미 로그인된 `http://localhost:3101` 세션이 있으면 그 세션을 재사용한다.
- 새 이미지 생성, 새로운 디자인 세계, 외부 UI 프레임워크 도입은 필요 없다. 기존 관리자 디자인 시스템과 Lucide 아이콘을 재사용한다.

## 목표

현재 마스터 관리자 기준 11개 대분류와 60개 사이드바 링크를, 운영자의 실제 업무 대상과 행동을 기준으로 재구성한다.

핵심 결과는 다음과 같아야 한다.

1. 대분류를 원칙적으로 8개 이하로 줄인다.
2. 동일한 기본 URL의 쿼리 상태를 별도 페이지처럼 사이드바에 중복 노출하지 않는다.
3. 같은 업무 생명주기에 속한 화면은 대표 작업공간과 로컬 탭/서브내비게이션으로 연결한다.
4. 모든 기존 기능, 권한, 감사 추적, 상세 URL, 레거시 리다이렉트를 보존한다.
5. 메뉴 검색에서 정확한 제목 일치가 설명 본문 일치보다 먼저 나온다.
6. 1440px 이상 데스크톱에서 빠르게 스캔하고 이동할 수 있어야 한다.

## 사용자와 화면 조건

- 사용자는 개발자가 아니라 매일 예약·고객·파트너·재무 예외를 처리하는 운영자다.
- 검수 대상은 **1440px 이상 데스크톱만**이다.
- 1024px 이하 반응형 디자인은 이번 작업의 분석·스크린샷·완료 보고에 포함하지 마라.
- 다만 기존 반응형 코드를 일부러 삭제하거나 명백히 깨뜨리지는 마라.
- 화면 표시 언어는 현재 제품처럼 영어를 유지한다. 라벨의 대소문자는 Title Case로 통일한다.

## 반드시 보존할 것

- 기존 API 호출, 서버 액션, 데이터 쿼리와 mutation 동작
- 역할·권한 필터와 서버 측 직접 URL 접근 제한
- 기존 상세 URL과 북마크 가능 URL
- 감사 로그와 운영 증거 링크
- `/providers`, `/providers/[id]`, `/files` 레거시 리다이렉트
- `/bookings/[id]`, `/customers/[id]`, `/partners/[id]` 등 상세 페이지
- `/login` 인증 경계
- 현재 URL의 검색 파라미터 의미와 브라우저 뒤로가기 동작
- 사용자 또는 다른 작업에서 이미 만든 변경사항

페이지 통합은 URL이나 기능 삭제가 아니다. 기존 URL은 유지하면서 대표 화면의 탭이나 로컬 내비게이션으로 연결한다.

## 금지 사항

- 보고서를 읽지 않고 메뉴 배열만 임의 수정하지 마라.
- 기존 운영 기능이나 데이터 표를 하나로 섞어서 행동 위험을 높이지 마라.
- 접근 로그 확인 없이 레거시 라우트나 핵심 페이지를 삭제하지 마라.
- 권한이 다른 행동을 한 탭에 무조건 노출하지 마라.
- 권한 검사를 클라이언트 표시 여부에만 의존하지 마라.
- 사이드바에서 링크를 먼저 제거한 뒤 대체 진입 경로를 나중으로 미루지 마라.
- 새로운 의존성이나 별도 아이콘 패키지를 추가하지 마라.
- 전체 관리자 화면의 색상·타이포그래피를 재디자인하지 마라.
- 1024px 이하 화면을 위해 시간을 쓰거나 별도 수정 보고를 만들지 마라.

## 권장 최종 대분류

다음 8개를 기준 구조로 사용하되, 코드를 조사한 결과 권한 또는 소유 팀 때문에 조정이 필요하면 근거를 남기고 최소 범위에서 조정한다.

### 1. Shift Command

- `/`로 바로 이동하는 단일 최상위 링크
- 부모와 자식이 모두 `Shift command`인 현재 중복 구조 제거
- 링크가 하나뿐이므로 접기/펼치기 섹션으로 만들지 않는다.

### 2. Booking Operations

- Live Bookings
- Calendar
- Booking Closeout
- Shift Handoff
- Vietnam Operations Map

변경 사항:

- `Live Operations` → `Booking Operations`
- `Vietnam Overview` → `Vietnam Operations Map`
- `Closeout Operations`와 `Post-match Cancellations`는 `Booking Closeout` 작업공간의 로컬 탭으로 연결한다.
- 완료 목록과 취소 결정 데이터를 하나의 표에 섞지 않는다. 서로 다른 URL·필터·행동 권한은 유지한다.

### 3. Customer Support

- Customers
- Customer Signals
- Chat Evidence

변경 사항:

- `Customer Reviews`와 `Partner Notes`를 `Customer Signals` 작업공간의 로컬 탭/서브내비게이션으로 연결한다.
- `Notification Delivery`는 이 영역에서 제거하고 Messaging으로 이동한다.
- `Customer Usage`는 이 영역에서 제거하고 Growth & Communications로 이동한다.

### 4. Partner Operations

- Partner Directory
- Partner Control Queue
- Partner Operations Overview

변경 사항:

- `Partner directory` → `Partner Directory`
- `Partner Controls` → `Partner Control Queue`
- `Partner overview` → `Partner Operations Overview`
- 승인 대기, 온보딩 장애, 지갑 부채는 계속 Partner Directory의 검색 가능한 저장 보기로 유지하고 독립 사이드바 링크로 만들지 않는다.
- `Partner Referrals`는 통합 Referrals의 Partners 탭으로 이동한다. Partner 화면에서 해당 탭으로 가는 컨텍스트 바로가기는 둘 수 있지만 사이드바 중복은 만들지 않는다.

### 5. Finance Operations

- Finance Overview
- Approval Queue
- Refunds
- Bank Reconciliation
- Cash Settlements
- Payment Clearing
- Finance Closeout

변경 사항:

- `Finance Today` → `Finance Operations`
- `Payout / Withdrawal Risk`는 `/payouts`의 저장 보기로 유지하되 사이드바에서 제거한다.
- `Unmatched Bank Transactions`는 Bank Reconciliation의 저장 보기/배지로 유지하되 사이드바에서 제거한다.
- 위험/미일치 건수는 원본 메뉴 오른쪽 배지 또는 Finance Overview에서 한 번만 표시한다.
- Payment Clearing과 Finance Closeout은 권한과 승인 주체를 확인한다. 동일 운영 흐름이라면 `Settlement Operations` 로컬 서브내비게이션으로 연결하되, 서로 다른 데이터와 행동은 합치지 않는다.

### 6. Finance Records & Close

- Payments
- Partner Money
- Wallet Adjustments
- General Ledger
- Settlement Records
- Tax & Close

변경 사항:

- `Finance Records`와 `Tax & Monthly Close`를 이 대분류 안에서 논리적으로 연결한다.
- Partner Deposits, Payouts, Partner Earnings는 `Partner Money` 로컬 서브내비게이션으로 접근 가능하게 한다.
- Settlement Audit과 Settlement Reversals는 `Settlement Records` 로컬 서브내비게이션으로 연결한다.
- Tax & Close에는 Overview, Monthly Closing, Platform VAT, Partner Withholding, Payment Fee Evidence를 연결한다.
- `Coupon Finance`를 사이드바에서 제외하려면 먼저 Coupons 또는 General Ledger 안에 명확한 대체 진입 링크를 만든다. 사용 빈도 근거가 없으면 이번 변경에서 기능이나 URL을 삭제하지 않는다.

### 7. Growth & Communications

- Marketing Analytics 또는 Insights
- Customer Usage
- Coupons
- Referrals
- Messaging
- Website Content

변경 사항:

- `Growth & Content` → `Growth & Communications`
- Customer Usage를 이곳으로 이동한다.
- Website Content를 Restricted Settings에서 이곳으로 이동한다. 발행 권한은 그대로 제한한다.
- Notification Delivery, Notification Templates, Push Send를 `Messaging` 작업공간에서 다음 로컬 탭으로 연결한다.
  - Delivery Incidents
  - Templates
  - Manual Send
  - Send History가 이미 존재하면 함께 연결
- Customer Referrals, Partner Referrals, Referral Cashouts와 정책 화면을 `Referrals` 작업공간에서 다음 탭으로 연결한다.
  - Customer Program
  - Partner Program
  - Cashouts
  - Policies: 권한 보유자에게만 표시
- 현재 숨김 허브 `/referrals`를 대표 작업공간으로 승격하는 방안을 우선 검토하되 기존 하위 URL은 유지한다.

### 8. Administration & Settings

- Operations Policy
- Service Catalog
- Company Bank Accounts
- Finance Approvers
- Tax Policy
- Admin Operators
- Audit Log
- 역할 제한 System Health

System Health 로컬 그룹:

- Setup Readiness
- App Session Diagnostics
- Background Jobs

변경 사항:

- `Restricted Settings`, `Admin & System`, `Developer / System`을 하나의 대분류에서 권한별 소그룹으로 정리한다.
- 개발자/시스템 항목은 현재처럼 허용된 역할에만 노출한다.
- 다음 세 항목은 독립 사이드바 메뉴에서 제거하고 원본 작업공간의 권한 탭으로 둔다.
  - Customer Referral Policy
  - Partner Referral Policy
  - Payment Fee Policy
- `Restricted`처럼 권한 상태를 업무 이름으로 사용하지 않는다.

## 동일 기본 라우트 중복 제거

다음 링크 쌍은 pathname이 동일하고 쿼리만 다르다. 쿼리 링크는 검색 가능한 저장 보기 또는 페이지 내부 탭으로 유지하되 사이드바에서는 대표 pathname을 한 번만 노출한다.

1. `/payouts` ↔ `/payouts?range=all&withdrawalStatus=REVIEW_REQUIRED`
2. `/finance-tax/bank-reconciliation` ↔ `?range=all&review=unmatched`
3. `/referrals/customers` ↔ `?settings=policy`
4. `/referrals/partners` ↔ `?settings=policy`
5. `/finance-tax/payment-fees` ↔ `?settings=policy`

정확한 href 중복만 검사하지 말고, 쿼리를 제거한 pathname 중복을 검출하는 테스트를 추가한다. 의도적인 예외가 정말 필요하면 코드에 이유를 명시한 allowlist를 사용한다.

## 사이드바 동작 수정

관련 파일을 우선 확인한다.

- `apps/admin_web/lib/admin-navigation.ts`
- `apps/admin_web/components/admin-shell-nav.tsx`
- `apps/admin_web/lib/admin-navigation.spec.ts`
- `apps/admin_web/components/admin-shell-nav.spec.tsx`

요구사항:

1. Shift Command는 직접 링크로 렌더링한다.
2. 일반 대분류는 현재 경로가 속한 하나만 기본으로 연다.
3. 사용자가 다른 대분류를 열면 이전 대분류가 닫히는 단일 열림 아코디언으로 만든다.
4. 키보드 포커스, `aria-expanded`, 현재 페이지 표시를 유지한다.
5. 활성 쿼리 저장 보기의 현재 선택 표시도 기존처럼 정확해야 한다.
6. 각 대분류의 직접 링크는 원칙적으로 7개 이하로 유지한다. 기능이 숨겨질 위험이 있으면 먼저 로컬 서브내비게이션을 만든다.

## 안정적인 메뉴 ID와 아이콘

현재 라벨 문자열을 키로 아이콘을 찾기 때문에 변경된 라벨이 기본 아이콘으로 떨어진다. 다음과 같이 개선한다.

- 내비게이션 대분류와 링크에 안정적인 `id`를 추가한다.
- 필요한 경우 명시적인 `iconKey`를 추가한다.
- 라벨 문자열이 아니라 `iconKey`로 기존 Lucide 아이콘을 선택한다.
- 현재 메뉴 전체가 의도적인 아이콘을 갖도록 한다.
- 모든 링크를 서로 완전히 다른 아이콘으로 만들 필요는 없지만, 여러 대분류가 모두 같은 기본 `UserRoundCog`로 보이는 상태는 없앤다.
- 라벨 변경 후에도 아이콘이 유지되는 테스트를 추가한다.
- 타입과 설정이 과도하게 복잡해지지 않도록 단순한 union 또는 명시적 맵을 사용한다.

## 상단 검색 수정

관련 파일을 우선 확인한다.

- `apps/admin_web/components/admin-workspace-header.tsx`
- `apps/admin_web/components/admin-topbar-search-input.tsx`
- `apps/admin_web/lib/admin-navigation.ts`의 검색 엔트리 생성 코드

현재 단순 `includes` + 메뉴 원본 순서 + `.slice(0, 7)` 때문에 `partner` 검색 시 Live Bookings가 Partner Directory보다 앞선다. 다음 우선순위로 결정적인 랭킹 함수를 구현한다.

1. 제목 완전 일치
2. 제목 시작 일치
3. 제목의 단어 시작 일치
4. 저장 보기 제목 또는 alias 일치
5. 대분류명 일치
6. 설명 본문 일치

추가 요구사항:

- 랭킹한 후 상위 결과를 제한한다.
- 동점은 안정적으로 정렬한다.
- 결과가 제한 수보다 많으면 `Show all results (n)` 또는 같은 의미의 접근 가능한 안내를 제공한다.
- 빈 검색 상태는 메뉴 첫 7개를 그대로 보여 주지 않는다. 구현 비용이 과도하지 않다면 Recent/Needs Attention/Common Destinations를 사용하고, 관련 데이터가 없다면 최소한 대분류별 대표 목적지를 보여 준다.
- `partner` 검색에서 Partner Directory, Partner Control Queue, Partner Operations Overview가 설명에 partner만 포함된 Live Bookings/Notification Delivery보다 앞서는 테스트를 추가한다.

## 작업공간 통합 방식

통합은 거대한 단일 페이지를 새로 만드는 것이 아니다. 다음 원칙을 사용한다.

- 기존 대표 페이지 셸과 디자인 시스템을 재사용한다.
- 관련 화면 상단에 일관된 로컬 탭 또는 서브내비게이션을 둔다.
- 현재 탭은 URL로 표현되어 새로고침과 북마크가 가능해야 한다.
- 각 탭의 필터 상태는 다른 탭으로 이동했다가 돌아와도 예측 가능해야 한다.
- 권한이 없는 탭은 숨기거나 명확한 읽기 전용 상태로 처리하고 서버 권한을 유지한다.
- 위험한 mutation은 각 기존 페이지에 남겨 행동 맥락과 확인 절차를 보존한다.
- 데이터를 억지로 하나의 테이블이나 카드 그리드에 섞지 않는다.
- 이미 존재하는 로컬 탭/세그먼트 컴포넌트가 있으면 새 컴포넌트를 만들기 전에 재사용한다.

## 구현 순서

### 1단계 — 조사와 변경 지도

- 보고서와 관련 코드를 읽는다.
- 현재 11개 대분류, 링크 수, pathname 중복 수를 코드로 확인한다.
- 역할별 메뉴 필터와 숨김 라우트 정책을 확인한다.
- 기존 탭/세그먼트 내비게이션 컴포넌트를 찾아 재사용 가능성을 판단한다.
- 수정할 파일과 보존할 URL을 짧은 계획으로 정리한 뒤 바로 구현한다.

### 2단계 — 안전한 P0 개편

- 대분류와 메뉴명 재배치
- Shift Command 직접 링크
- 5개 쿼리 중복 사이드바 제거
- Customer Usage, Notification Delivery, Website Content 위치 이동
- 단일 열림 아코디언
- 안정적인 `id`/`iconKey`
- 검색 랭킹 수정
- 관련 단위 테스트 수정·추가

### 3단계 — P1 작업공간 연결

대체 진입 경로를 먼저 만든 후 개별 사이드바 링크를 줄인다.

- Customer Signals
- Booking Closeout
- Messaging
- Referrals
- Settlement Records
- Tax & Close
- 가능하고 안전하면 Settlement Operations

한 번에 백엔드 도메인을 합치지 말고 프런트 정보 구조와 로컬 내비게이션 중심으로 구현한다.

### 4단계 — 브라우저 검증과 결함 수정

- 실행 중인 관리자 웹을 사용한다. 필요하면 프로젝트의 기존 로컬 실행 명령을 확인한다.
- 1692×1272 또는 1440px 이상 화면에서 검증한다.
- 한 번의 종합 화면 검사에서 발견된 결함을 모아 수정하고, 최대 한 번 더 확인한다.
- 1024px 이하 화면은 캡처하거나 보고하지 않는다.

## 반드시 검증할 화면과 상태

1. Shift Command가 중복된 부모/자식 없이 한 번만 보이는 상태
2. 권장 8개 대분류 전체
3. 각 대분류를 열었을 때 직접 링크 수와 순서
4. 다른 대분류를 열면 이전 대분류가 닫히는 상태
5. `/partners/overview` 같은 깊은 경로에서 올바른 대분류와 메뉴 활성 상태
6. Payouts의 risk 저장 보기 직접 URL에서 대표 메뉴가 활성화되는 상태
7. Bank Reconciliation의 unmatched URL에서 대표 메뉴가 활성화되는 상태
8. `partner` 검색 결과 순서
9. 검색 결과가 7개를 넘을 때 추가 결과 안내
10. 일반 운영자 권한에서 System Health가 숨겨지는 계약
11. 마스터/허용 역할에서 System Health가 접근 가능한 계약
12. 통합 작업공간의 각 로컬 탭과 기존 URL

## 테스트 및 품질 확인

프로젝트에 맞는 정확한 명령을 확인한 후 최소한 다음을 실행한다.

```powershell
npm run test --workspace @massage-vn/admin-web -- --run lib/admin-navigation.spec.ts components/admin-shell-nav.spec.tsx
npm run typecheck --workspace @massage-vn/admin-web
npm run lint --workspace @massage-vn/admin-web
```

검색 또는 통합 작업공간 테스트 파일을 추가했다면 해당 파일도 명시적으로 실행한다. 변경 범위와 시간이 허용하면 admin web 전체 테스트 또는 build도 실행한다.

기존 실패가 있으면 이번 변경으로 생긴 실패와 기존 실패를 구분해 보고한다. 테스트를 통과시키기 위해 중요한 검증을 삭제하거나 완화하지 않는다.

UI 수정이 끝난 뒤 Impeccable detector가 현재 환경에 있으면 변경한 UI 파일을 대상으로 한 번만 실행하고, 실제 관련 경고만 수정한다.

```powershell
node C:\Users\laboy\.codex\skills\impeccable\scripts\detect.mjs --json <변경한 UI 파일들>
```

## 추가할 회귀 테스트

- 전체 페이지가 메뉴 또는 숨김 정책에 계속 포함됨
- sidebar href 정확 중복 없음
- query를 제거한 pathname 중복 없음 또는 명시적 allowlist만 허용
- 대분류 8개 이하
- 링크 하나뿐인 접이식 대분류 없음
- 대분류 직접 링크 7개 초과 검토
- 모든 섹션·링크에 안정적인 id와 유효한 iconKey 존재
- 검색 정확 일치가 설명 일치보다 우선
- 역할별 System Health 노출 제한
- 기존 레거시 별칭이 메뉴에 노출되지 않고 올바르게 리다이렉트
- 기존 deep link의 active menu 매칭 유지

기존 테스트의 `Shift command and the eight operator work areas`처럼 설명과 기대 배열 수가 어긋난 테스트명도 실제 구조에 맞게 수정한다.

## 완료 기준

다음을 모두 충족해야 완료다.

- 마스터 관리자 기준 대분류 8개 이하
- 같은 pathname이 독립 사이드바 페이지로 중복되지 않음
- 링크 하나뿐인 접이식 대분류 없음
- 한 대분류의 직접 링크가 원칙적으로 7개 이하
- 관련 기능은 로컬 탭, 저장 보기, 대표 페이지 등 대체 경로로 모두 접근 가능
- 모든 기존 상세·감사·레거시 URL 정상 동작
- 권한 모델과 서버 접근 통제 유지
- `partner` 검색 결과의 정확한 Partner 제목들이 설명 일치 결과보다 먼저 표시
- 현재 라벨들이 의도적인 섹션/항목 아이콘을 가짐
- 1440px 이상에서 사이드바와 검색이 잘리거나 겹치지 않음
- 관련 테스트, typecheck, lint 통과 또는 기존 실패를 증거와 함께 명확히 구분

## 최종 보고 형식

작업이 끝나면 다음 순서로 간결하지만 구체적으로 보고해라.

1. 구현 결과 요약
2. 변경 전후 대분류 수·사이드바 링크 수·고유 pathname 수
3. 현재 → 새 카테고리 이동표
4. 사이드바에서 제거했지만 어디에서 계속 접근 가능한지 목록
5. 보존한 URL·권한·운영 행동
6. 수정한 주요 파일
7. 실행한 테스트와 결과
8. 1440px 이상 브라우저 검증 화면과 확인한 상태
9. 구현하지 못한 항목이 있다면 정확한 이유와 안전한 후속 작업

계획이나 제안만 하고 끝내지 말고, 코드를 실제로 수정하고 테스트와 브라우저 검증까지 완료해라. 다만 데이터 손실, 권한 약화, 운영 행동 변경 가능성이 발견되면 그 부분은 억지로 합치지 말고 기존 동작을 보존한 채 정보 구조와 연결 방식만 개선해라.

## 프롬프트 끝

---

## 사용 메모

- 이 프롬프트는 관리자 정보 구조 전체 개편용이다.
- 범위를 줄이고 싶다면 Codex에 `우선 2단계(P0)까지만 구현하고 검증해줘`라고 마지막에 추가한다.
- 작업공간 통합까지 한 번에 진행하려면 그대로 사용한다.
