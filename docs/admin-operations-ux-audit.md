# HANDS 관리자 화면 운영 UX 전수 감사

감사일: 2026-08-02

대상: `apps/admin_web`, 로컬 실행 환경 `http://localhost:3101`

관점: 실제 운영자가 빠르고 안전하게 업무를 찾고, 판단하고, 처리하고, 이력을 확인할 수 있는가

## 결론

현재 관리자 웹은 기능 범위와 감사 추적은 강하지만, 운영 화면과 개발·회계 증거 화면이 한 레벨에 섞여 있다. 가장 큰 위험은 **예약 목록의 과도한 개인정보 노출**과 **지갑 조정의 원시 프로필 ID 입력**이다. 그다음은 숨겨진 핵심 재무 큐, 반복되는 인라인 편집기, 기술 용어가 그대로 드러나는 문구다.

Start Shift와 Finance Overview는 개선 방향을 이미 보여 준다. 둘 다 “지금 처리할 일”을 앞에 두고 소유자·건수·금액·최장 대기 시간을 연결한다. 이 패턴을 전체 관리자 웹의 기준으로 확장하는 것이 가장 적은 비용으로 큰 효과를 낸다.

## 현재 관리자 정보 구조

현재 정식 사이드바는 13개 운영 그룹과 별도의 `Developer / System` 그룹으로 구성된다.

| 현재 그룹 | 포함 메뉴 | 감사 판단 |
|---|---|---|
| Shift Operations | Start Shift, Calendar, Operations History | 유지. 시작·실시간·이력의 관계가 명확함 |
| Bookings | Live, Completed, Post-match Cancellations | 유지하되 Shift Operations와 연속된 업무로 보여야 함 |
| Customers | Customers, Customer Referrals, Customer Reviews, Partner Evaluations | 추천 정책 편집은 분리하고 지원 업무를 중심으로 정리 |
| Partners | Directory, Unapproved, Unsettled, Partner Referrals | Partner Controls가 빠져 있고 Unsettled는 재무와 교차 연결 필요 |
| Analytics | Vietnam, Usage, Partner, Marketing | 의사결정 주체가 달라 하나의 업무 그룹으로는 너무 넓음 |
| Growth & Communications | Coupons, Notifications, Templates, Push Send | 발송 운영, 템플릿 관리, 성장 도구가 혼합됨 |
| Finance Today | Overview, Approval, Refunds, Payout Risk, Unmatched Bank | 좋은 시간축. 숨은 Cash Settlement와 Closeout을 추가해야 함 |
| Money Movement | Payments, Clearing, Wallet, Deposits, Payouts | 거래 흐름과 고위험 조정이 한 레벨이므로 역할별 노출 필요 |
| Accounting Records | GL, Settlement, Reversals, Coupon Finance | 기록·감사 목적이 일관됨 |
| Tax & Monthly Close | Monthly Close, VAT, Withholding, Fees | Payment Fee의 정책 편집과 기간 증거는 분리 필요 |
| Restricted Settings | Bank Accounts, Approvers, Tax Policy | 유지. 추천·수수료 정책도 이 영역이 적합함 |
| Policies | Operations Policy, Service Catalog, Website Content | 운영 정책, 가격/서비스, 공개 콘텐츠의 권한·빈도가 다름 |
| Admin Control | Admin Operators, Audit Log | 유지. Audit metadata는 기본 접기 |
| Developer / System | Setup, App Sessions, Background Jobs | 유지. 현재의 역할·시각적 격리는 좋은 기준 |

정식 메뉴 밖에는 `/cash-settlements`, `/chat-archive`, `/earnings`, `/finance-closeout`, `/finance-tax`, `/partner-controls`, `/referrals/cashouts`가 있다. 이 중 호환 별칭이 아닌 업무 화면은 적절한 역할 메뉴로 승격해야 한다.

## 감사 방법과 범위

- 실제 브라우저에서 로그인된 `MASTER_ADMIN` 세션을 사용했다.
- 사이드바의 모든 링크, 소스에만 존재하는 정적 라우트, 대표 상세 라우트를 직접 열었다.
- 달력 편집기 열기/닫기, 예약 검색의 결과 없음, 고객 목록 다음 페이지 이동을 확인했다.
- 생성, 저장, 승인, 거절, 지급, 환불, 발송 등 데이터 변경 동작은 제출하지 않았다.
- 실데이터가 있는 화면에서는 고객·파트너 이름, 전화번호, 주소, 계정 식별자가 보이는 캡처를 남기지 않았다.
- 다른 역할의 실제 세션, 키보드 전체 순회, 네트워크 지연 중 로딩, 모든 상세 레코드 유형은 검증하지 못했다. 역할별 권한은 코드 모델을 보조 근거로 검토했다.
- 달력에서 일시적인 개발 오류 오버레이가 한 번 나타났으나 재접속 후 정상화됐다. 재현되지 않아 제품 결함으로 단정하지 않았다.

## 우선순위 Top 10

| 순위 | 심각도 | 발견 | 운영 영향 | 권고 |
|---:|:---:|---|---|---|
| 1 | P0 | 예약 목록이 고객 전화번호와 전체 서비스 주소를 기본 노출 | 어깨너머 노출, CSV·화면공유 유출, 잘못된 고객 연락 위험 | 목록은 전화번호 마스킹·구/동 수준 위치만 표시하고 전체 값은 권한 있는 상세 화면에서만 노출 |
| 2 | P0 | 지갑 조정이 `Owner profile id` 원문 입력을 요구 | 잘못된 계정에 금액을 반영하는 회복 곤란 오류 | 고객/파트너 검색 선택기, 고정된 신원 요약, 최종 확인 단계 도입 |
| 3 | P1 | Cash Settlements, Finance Closeout, Earnings, Partner Controls, Referral Cashouts 등 핵심 업무가 사이드바에 없음 | 대기 업무를 발견하지 못해 SLA와 월마감 지연 | 역할별 업무 홈과 정식 메뉴에 편입하고 구형 별칭은 리다이렉트 유지 |
| 4 | P1 | 13개 이상의 접이식 메뉴 그룹과 긴 영문 라벨 | 목적지를 찾는 시간이 길고 유사한 재무 화면을 혼동 | 사용자 업무 기준 8개 영역으로 재구성하고 Developer/System은 계속 격리 |
| 5 | P1 | Notification Templates가 원시 이벤트 키·변수 JSON과 언어별 개별 저장을 한 화면에 노출 | 22개 템플릿 × 5개 언어의 부분 저장·번역 누락 위험 | 템플릿 선택 → 언어 탭 → 미리보기 → 변경 요약 → 한 번에 저장 |
| 6 | P1 | Bank Reconciliation이 명세서 업로드, 수동 거래 생성, 소유자 현황, 검토 큐를 한 페이지에 결합 | 가져오기와 검토의 문맥 전환, 중복·오분류 위험 | `명세서 가져오기`와 `미매칭 검토`를 별도 작업 흐름으로 분리 |
| 7 | P1 | 고객 상세에 지갑 조정, 알림 발송, 활동 메모 등 고위험 쓰기가 모두 상시 노출 | 다른 고객을 보고 있는 상태에서 잘못된 금액·메시지 실행 위험 | 읽기 중심 요약을 기본으로 두고 고위험 동작은 명시적 작업 패널로 분리 |
| 8 | P1 | Operations Policy가 다수의 반복 Save 편집기와 내부 스크롤을 사용 | 비교가 어렵고 잘못된 정책만 부분 저장할 위험 | 읽기 전용 비교표 + 정책별 편집 드로어 + 저장 전 영향 요약 |
| 9 | P1 | Payments 기본 화면에 게이트웨이 callback ledger가 함께 노출 | 운영 결제 큐와 개발 진단 증거가 경쟁 | 목록에서는 검토 필요 건수만 표시하고 상세 타임라인 또는 Developer/System으로 이동 |
| 10 | P1 | 수치 카드의 값이 모두 `<h2>`로 렌더링 | 스크린리더 제목 구조가 깨져 업무 영역 탐색이 어려움 | 값은 일반 텍스트로 바꾸고 카드 라벨과 값을 하나의 접근 가능한 이름으로 제공 |

## 세부 발견 사항

### 페이지별 실제 목적·판단·행동 감사

| 화면/URL | 운영자의 실제 목적 | 첫 판단(최대 3개) | 핵심 행동과 감사 결과 | 관련 코드 |
|---|---|---|---|---|
| Start Shift `/` | 현재 교대에서 먼저 처리할 예외를 찾음 | 긴급 큐, 지연 위험, 자금 위험 | 큐 직접 링크는 좋음. `open` 단위가 모호하고 숨은 재무 큐 의존 | `apps/admin_web/app/page.tsx` |
| Calendar `/calendar` | 운영 일정과 후속 작업을 배치 | 오늘 이벤트, 충돌, 미완료 후속 | Add Event는 찾기 쉬움. 0 KPI가 캘린더보다 먼저 공간 점유 | `apps/admin_web/app/calendar/page.tsx` |
| Operations History `/operations-handoff` | 이전 교대의 미완료·결정·노트를 이어받음 | 미완료 인계, 재무 후속, 최신 노트 | 여러 요약·목록·노트가 길게 이어져 현재 인계가 희석 | `apps/admin_web/app/operations-handoff/page.tsx` |
| Operations Policy `/operations-policy` | 매칭/SLA 정책의 현재 값과 영향 검토 | 현재/권장 차이, 영향, 승인 사유 | 반복 Save와 내부 스크롤. 읽기 요약과 정책별 편집 분리 필요 | `apps/admin_web/app/operations-policy/page.tsx` |
| Live Bookings `/bookings` | 개입할 예약을 찾고 다음 행동 결정 | 상태, 경과, 다음 행동 | 검색은 정상. 표가 아래로 밀리고 전화/전체 주소 과다 노출 | `apps/admin_web/app/bookings/booking-monitor.tsx`, `booking-monitor-list-section.tsx` |
| Completed `/bookings/completed` | 완료 후 결제·정산·환불 예외 검토 | closeout 상태, 금액 이상, 후속 조치 | Live와 같은 큰 필터 구조. 완료 증거와 행동 우선순위 필요 | `apps/admin_web/app/bookings/page.tsx` |
| Post-match Cancellations | 취소 근거와 수수료/노쇼 결정을 마감 | 취소 시점, 증거, 금액 영향 | 목적은 명확하나 상세의 반복 상태 행동과 연결이 복잡 | `apps/admin_web/app/bookings/post-match-cancellations/page.tsx` |
| Booking Detail `/bookings/[id]` | 한 예약의 병목과 후속 조치를 해결 | 현재 병목, 책임 주체, 금액 영향 | 15개 이상 섹션과 반복 `Mark done/Blocked/Reset`로 행동 대상이 모호 | `apps/admin_web/app/bookings/[id]/page.tsx` |
| Customers `/customers` | 지원이 필요한 고객을 찾음 | 최근 활동, 주의 신호, 예약/가치 | 페이지 이동은 유지됨. 최근 주소는 영역 수준으로 축약 필요 | `apps/admin_web/app/customers/page.tsx` |
| Customer Detail `/customers/[id]` | 고객 이력과 현재 문제를 이해하고 후속 처리 | 신원, 잔액, 최근 문제 | 지갑·발송·메모가 상시 공존해 오처리 위험 | `apps/admin_web/app/customers/[id]/page.tsx` |
| Customer Reviews `/reviews` | 공개 여부나 후속 검토가 필요한 리뷰 처리 | 검토 상태, 가시성, 작성 시점 | 0 KPI·모호한 빈 상태·구현 설명이 핵심 상태보다 앞섬 | `apps/admin_web/app/reviews/page.tsx`, `reviews-table-section.tsx` |
| Partner Evaluations | 파트너가 남긴 고객 평가를 지원 근거로 확인 | 작성 시점, 당사자, 평가 내용 | 단순 증거 표로 적절. 개인정보 최소화와 상세 연결 유지 | `apps/admin_web/app/reviews/partner-customer-evaluations-section.tsx` |
| Partners `/partners` | 승인·정산·계정 문제가 있는 파트너를 찾음 | 승인 상태, 접근 상태, 지갑 위험 | 저장된 검토 뷰는 유용. 9열과 raw 상태가 판독을 방해 | `apps/admin_web/app/partners/page.tsx`, `partner-filters.ts` |
| Partner Detail `/partners/[id]` | 온보딩·업무·재무·안전 문제를 한 파트너 기준으로 해결 | 승인 준비, 계정 제한, 자금 위험 | 증거는 풍부하나 raw enum과 많은 표가 기본 노출 | `apps/admin_web/app/partners/[id]/page.tsx` |
| Partner Controls `/partner-controls` | 안전·재무·접근·SLA 예외를 한 큐에서 통제 | 제한 이유, 위험, 담당자 | 운영 가치가 높지만 메뉴에 없어 발견하기 어려움 | `apps/admin_web/app/partner-controls/page.tsx` |
| Referrals `/referrals/*` | 추천 진행과 보상 예외를 검토 | 자격, 보상, 회수 필요 | 목록 안 정책 Save가 일상 업무와 혼합. cashout은 숨은 경로 | `apps/admin_web/app/referrals` |
| Vietnam/Usage/Partner Overview | 지역·사용·공급 추세를 판단 | 이상 지역, 전환, 공급 위험 | 분석 목적은 유효하나 서로 다른 사용자를 한 그룹에 묶음 | `apps/admin_web/app/vietnam-overview`, `usage-overview`, `partners/overview` |
| Marketing Analytics | 획득 성과를 보고 비용을 보정 | 채널 성과, 비용, 전환 | 분석과 `Save spend`가 같은 기본 화면에 공존 | `apps/admin_web/app/marketing-analytics/page.tsx` |
| Notifications `/notifications` | 고객 알림 발송 이력과 실패를 확인 | 실패, 대상, 재처리 필요 | 고객지원 흐름에 더 가까움. 기술 상태는 행동 문구로 매핑 필요 | `apps/admin_web/app/notifications/page.tsx` |
| Notification Templates | 다국어 메시지를 안전하게 변경 | 이벤트, 언어 누락, 실제 미리보기 | 원시 키/JSON과 언어별 독립 Save로 부분 변경 위험 | `apps/admin_web/app/notifications/templates/page.tsx` |
| Push Send | 대상과 메시지를 확인하고 수동 발송 | 수신자 범위, 내용, 예상 건수 | recipient preview는 좋은 보호. 최종 확인과 감사 링크 유지 | `apps/admin_web/app/notifications/push-send/page.tsx` |
| Finance Overview | 오늘의 돈 관련 예외를 우선순위화 | 노출액, 최장 대기, 담당자 | 액션 큐는 우수. Finance scope 설명이 행동보다 먼저 공간 점유 | `apps/admin_web/app/finance-overview/page.tsx` |
| Approval Queue | 승인 대기 금액·정책·계좌 변경을 이중 통제 | 유형, 노출액, maker/checker | 목적은 명확하지만 여러 유형의 긴 표를 우선순위 큐로 더 압축 가능 | `apps/admin_web/app/finance-tax/approval-queue/page.tsx` |
| Refunds `/refunds` | 환불 근거와 상태를 검토·처리 | 금액, 결제/예약, 상태 | Customer/Partner가 Amount/Status보다 앞섬. 판단 열을 앞쪽으로 이동 | `apps/admin_web/app/refunds/refunds-table-section.tsx` |
| Bank Reconciliation | 은행 거래를 가져오고 미매칭을 해결 | 중복/합계, 후보, 담당자 | 업로드·수동 입력·이력·리뷰 큐가 한 페이지에 혼합 | `apps/admin_web/app/finance-tax/bank-reconciliation/page.tsx` |
| Cash Settlements | 현금 수납·미수 예외를 마감 | 미수액, 경과, 책임 주체 | 핵심 재무 큐지만 메뉴에 없음 | `apps/admin_web/app/cash-settlements/page.tsx` |
| Finance Closeout | 정산 마감 백로그를 검토 | 미마감, 금액, 선택 검토 | 실제 대기 큐가 있으나 메뉴에 없음 | `apps/admin_web/app/finance-closeout/page.tsx` |
| Payments | 결제 상태와 운영 예외를 해결 | 결제 상태, 금액, 다음 행동 | callback ledger가 기본 목록과 상세에 중복 | `apps/admin_web/app/payments/page.tsx` |
| Payouts / Earnings | 파트너 지급·인출·수익 증거를 검토 | 위험, 금액, 참조 | 여러 표와 행별 Save. Earnings는 메뉴에 없음 | `apps/admin_web/app/payouts`, `apps/admin_web/app/earnings/page.tsx` |
| Wallet Adjustments | 은행 이동 없이 잔액 변경을 요청/승인 | 대상, 방향·금액, 사유 | raw owner ID 입력이 가장 큰 금액 오처리 위험 | `apps/admin_web/app/wallet-adjustments/page.tsx`, `actions.ts` |
| GL/Settlement/Reversals/Coupon Finance | 회계 기록과 정합성 증거 확인 | 기간, 상태, 불일치 | 기록 영역으로 적절. 상세 raw 증거는 기본 접기 권장 | `apps/admin_web/app/finance-tax` 하위 각 route |
| Tax & Close | 월마감·VAT·원천징수·수수료 확인 | 기간 완결성, 누락, 정책 적용 | `/finance-tax`와 Finance Overview 일부 중복, Payment Fees에 정책 편집 혼합 | `apps/admin_web/app/finance-tax/page.tsx` 및 하위 route |
| Restricted Settings | 계좌·승인자·세금 정책 변경 | 현재/제안, 권한, 적용일 | 제한 배치는 좋음. smoke/demo 정책 데이터 제거 필요 | `apps/admin_web/app/finance-tax/company-bank-accounts`, `finance-approvers`, `apps/admin_web/app/tax-policy` |
| Coupons/Services/Website Content | 할인·서비스·공개 콘텐츠를 관리 | 적용 범위, 공개 상태, 가격 영향 | 기능은 유효. 정책/콘텐츠 권한과 운영 빈도에 맞춰 그룹 분리 | `apps/admin_web/app/coupons`, `services`, `website-content` |
| Admin Operators/Audit Log | 관리자 권한과 변경 이력 통제 | 역할, 변경 주체, 영향 대상 | 영역 분리는 좋음. Audit metadata는 기본 표에서 과도 | `apps/admin_web/app/admin-operators`, `audit-log` |
| Setup/App Sessions/Background Jobs | 통합·세션·큐 장애를 진단 | 준비 상태, 보안 세션, 실패 큐 | Developer/System 격리는 좋음. Jobs 12열은 기술 사용자에게도 판독 불가 | `apps/admin_web/app/setup`, `app-sessions`, `background-jobs` |

### 1. 시작 화면과 업무 발견성

Start Shift는 `Needs action now`, 실시간 운영 상태, 자금 상태를 먼저 보여 주고 관련 큐로 연결한다. 이는 현재 제품에서 가장 좋은 운영 패턴이다. 다만 “7 open”은 실제 레코드 수가 아니라 열린 큐 종류 수로 읽혀 카드 안의 수백 건과 의미가 충돌한다. 라벨을 `7 queues need attention`처럼 바꾸고, 전체 레코드 합계와 구분해야 한다.

핵심 경로 일부는 시작 화면 내부 링크로만 발견된다. `/cash-settlements`, `/finance-closeout`, `/earnings`, `/partner-controls`, `/referrals/cashouts`, `/chat-archive`는 실제 운영 가치가 있지만 현재 사이드바에 없거나 간접적으로만 연결된다. 숨은 기능을 새로 만들 필요는 없고, 기존 라우트를 적절한 업무 그룹에 연결하면 된다.

### 2. 예약 운영

예약 목록의 열은 `Booking / Customer / Partner / Service / Address / Status / Next action` 순서다. 내부 예약 ID가 첫 번째이고, 고객 셀의 전화번호와 주소 셀의 전체 서비스 주소가 기본 표시된다. 운영 판단에는 상태, 다음 행동, 경과 시간, 고객·파트너가 우선이며 내부 ID와 전체 주소는 상세 정보다.

상단에는 KPI, 실시간 연결 문구, 큰 필터 보드가 차례로 있어 실제 표가 기본 뷰포트 아래로 밀린다. 검색은 URL 쿼리와 함께 정상 동작했고, 결과 없음 메시지도 현재 필터를 설명했다. 그러나 결과가 없을 때도 KPI와 필터가 화면 대부분을 차지하고 빈 표와 초기화 행동은 바로 보이지 않는다.

예약 상세는 운영 상태, 노쇼, 결과, 고객/파트너, 채팅, 금액, 활동, 리뷰, 메모, 공급 정보가 한 페이지에 연속된다. `Mark done / Blocked / Reset` 계열 행동이 여러 영역에서 반복되어 어떤 체크리스트를 바꾸는지 빠르게 구분하기 어렵다. 상단에는 현재 병목과 다음 행동 하나를 제시하고, 나머지는 단계별 이력으로 접는 편이 안전하다.

### 3. 고객·파트너 운영

고객 목록의 페이지 이동은 정상 동작했다. 열은 프로필, 가입일, 최근 활동, 최근 주소, 예약, 주의, 고객 가치까지 포함해 비교적 풍부하지만, 최근 주소는 기본 목록에서 영역 수준으로 제한할 필요가 있다.

고객 상세는 읽기와 쓰기가 과도하게 결합되어 있다. 예약 이력과 잔액을 보던 같은 화면에서 지갑 조정, 고객 알림, 운영 메모를 바로 실행할 수 있다. 고위험 행동은 고객 신원과 영향 범위를 고정해 보여 주는 별도 패널에서 수행해야 한다.

파트너 목록은 상태·등급·접근·지역·업무·지갑·계정을 한 줄에 담는다. 상세의 `DRAFT`, `DEFERRED`, `MANUAL OFFLINE`, `missing` 같은 원시 상태는 내부 구현을 모르는 운영자에게 해석 부담을 준다. 운영 문구와 내부 값은 분리하고, 내부 값은 보조 정보나 감사 상세에서만 보여야 한다.

### 4. 재무 운영

Finance Overview의 액션 큐는 소유자, 금액, 최장 대기 시간을 함께 보여 주어 좋다. 반면 `Finance scope` 탭과 설명 카드가 업무 카드 앞에서 공간을 크게 차지한다. 현재 역할에 해당하는 기본 범위를 자동 선택하고 범위 설명은 보조 도움말로 낮추는 편이 낫다.

Bank Reconciliation은 CSV 가져오기 미리보기, 가져오기 이력, 수동 은행 거래 입력, 담당자 부하, 액션 큐가 한 화면에 있다. 이들은 권한과 실패 복구가 다른 작업이다. 가져오기는 배치 단위 검증과 중복 확인을 중심으로, 미매칭 검토는 한 거래씩 증거·후보·결정에 집중해야 한다.

Wallet Adjustments는 미리보기와 승인 개념을 갖춘 점은 좋다. 하지만 생성, 요청 필터, 원장 필터 모두 `Owner profile id`를 반복한다. 검색 선택기에서 대상을 고른 뒤 이름·유형·마스킹된 연락처·현재 잔액을 고정하고, 금액·방향·사유를 재확인해야 한다.

Payments는 결제 운영 표와 callback attempt ledger를 함께 렌더링한다. callback 상세는 이미 결제 상세 타임라인에도 있으므로 목록의 중복 ledger를 제거하고 “증거 검토 필요” 배지만 남기는 것이 더 작고 명확한 해결이다.

Payouts는 여러 표와 행별 `Save`가 반복되어 작업 대상을 놓치기 쉽다. 선택된 한 건의 상세 패널에서 계좌·위험·참조·메모를 확인하고 저장하도록 집중도를 높여야 한다.

### 5. 콘텐츠·정책·성장

Notification Templates는 `admin.push.broadcast`, `booking.cancelled` 같은 원시 키와 변수 JSON을 제목부에 표시한다. 다섯 언어의 제목·본문·Save 버튼이 나란히 반복되어 부분 저장 상태를 파악하기 어렵다. 친숙한 이벤트 이름, 언어 완료 상태, 실제 메시지 미리보기, 단일 변경 요약이 필요하다.

Operations Policy의 “editing code”, “deeper app-flow work” 설명은 운영자를 위한 문구가 아니다. 다수의 SLA 카드가 `Current / Recommended / Impact / input / reason / Save policy`를 반복하며 페이지 안쪽에 별도 스크롤까지 만든다. 기본 화면은 현재 값과 권장 값의 차이만 보여 주고, 편집은 한 정책씩 열어야 한다.

Referrals와 Marketing Analytics는 분석·일상 업무 화면에 정책 저장 또는 광고비 저장을 직접 결합한다. 추천 정책은 Restricted Settings로 옮기고, 마케팅 비용 입력은 별도의 명확한 쓰기 작업으로 구분해야 한다. Tax Policy와 추천 화면에 보이는 smoke/demo 문구는 운영 환경에서 제거해야 한다.

Payment Fees는 기간 증거와 정책 초안 생성이 함께 있다. 세금·마감 영역에는 기간별 적용 결과를 유지하고, 초안 편집은 제한 설정으로 이동하는 것이 역할과 위험을 맞춘다.

### 6. 시스템·상태·접근성

Setup, App Sessions, Background Jobs가 Developer/System에 격리되고 권한 모델에서도 제한된 점은 좋다. Background Jobs의 12열 표는 넓은 데스크톱에서도 큐 이름이 한 글자 단위로 줄바꿈된다. 열을 핵심 상태·지연·실패·행동으로 줄이고 세부 기술 값은 상세로 보내야 한다.

Reviews의 빈 화면은 0인 KPI 카드 다섯 개, 필터, 빈 표, 비활성 페이지네이션을 모두 보여 준다. `No customer reviews loaded.`는 오늘 필터 결과인지 데이터 로드 실패인지 설명하지 않는다. 0일 때는 빈 상태를 먼저 보여 주고 `필터 초기화` 또는 `전체 기간 보기` 하나를 제시해야 한다. “same table card”, “rounded pagination” 같은 구현 설명은 제거한다.

예약과 파트너의 기본 빈 상태는 운영자에게 API 시작 또는 seed/smoke flow 실행을 요구한다. 운영 화면에서는 `데이터를 불러오지 못했습니다 — 다시 시도`와 `아직 항목이 없습니다`를 구분해야 한다.

존재하지 않는 고객 상세는 “Admin workspace route”와 “navigation policy”를 언급하고 Start Shift로 돌려보낸다. `고객 기록을 찾을 수 없습니다. 삭제되었거나 접근 권한이 없을 수 있습니다.`와 `고객 목록으로`가 더 정확하다.

900px 폭에서는 전체 앱을 `Desktop required`로 차단한다. 고위험 폼이 깨진 채 노출되는 것보다 안전하지만, 태블릿이나 분할 화면에서 긴급 큐조차 볼 수 없다. 운영 요구가 확인되기 전에는 반응형 전체 재구축을 하지 말고, 필요 시 읽기 전용 긴급 큐부터 지원한다.

## 불필요하거나 기본 노출이 과한 요소

| 요소 | 현재 위치 | 제안 | 이유 |
|---|---|---|---|
| Socket 연결 상태 | Bookings 상단 | Developer/System 진단 또는 오류일 때만 표시 | 정상 상 |
| Callback attempt 전체 ledger | Payments 목록 하단 | 삭제하고 결제 상세 타임라인으로 연결 | 같은 증거가 상세에 이미 존재 |
| Raw notification variables JSON | Notification Templates | 기본 접기 | 템플릿 편집 판단보다 기술 구현 정보에 가까움 |
| 내부 예약 ID 첫 열 | Bookings | 마지막 열 또는 상세로 이동 | 상태·다음 행동보다 우선하지 않음태는 운영 행동을 만들지 않음 |
| Audit Metadata 열 | Audit Log | 행 상세로 이동 | 기본 감사 판단에 과도하게 상세 |
| 전부 0인 KPI 다섯 개 | Reviews | 0일 때 축약 | 빈 상태와 다음 행동을 밀어냄 |
| 전부 0인 KPI 네 개 | Calendar | 0일 때 한 줄 요약 | 실제 캘린더 사용 영역을 밀어냄 |
| `Finance scope` 설명 카드 | Finance Overview 상단 | 현재 범위만 짧게 표시, 설명은 도움말 | 액션 큐보다 앞에서 공간을 사용 |
| 반복 Save 버튼 | Templates, Operations Policy, Payouts | 선택한 한 항목의 작업 패널로 이동 | 어느 대상을 저장하는지 놓치기 쉬움 |
| 개발 구현 설명 | Reviews, Operations Policy, 빈 상태 | 삭제 또는 운영 행동 문구로 변경 | 운영자가 판단·행동하는 데 도움 없음 |

## Developer/System으로 이동하거나 접을 후보

| 후보 | 현재 위치 | 권장 위치 | 운영 화면에 남길 최소 정보 |
|---|---|---|---|
| WebSocket 연결 세부 상태 | Bookings | Developer/System > Monitoring | 연결 문제일 때 `실시간 갱신 지연 — 새로고침` 경고만 |
| Gateway callback payload/attempt | Payments | 결제 상세의 Technical evidence; 집계 진단은 Developer/System | `증거 검토 필요` 배지와 건수 |
| Queue 이름, retained job ID, BullMQ 용어 | Background Jobs | 현재 Developer/System 유지, 상세로 접기 | 큐 라벨, 지연, 실패, 다음 행동 |
| App session device/IP 진단 | App Sessions | 현재 Developer/System 유지 | 일반 운영 메뉴에는 노출하지 않음 |
| 외부 연동 credential/readiness | Setup | 현재 Developer/System 유지 | Start Shift에는 실제 운영 장애만 행동형 경고로 표시 |
| Raw audit metadata/payload | Audit Log | 행 상세 Technical evidence | actor, action, target, result, time |
| 원시 enum/내부 profile ID | Partner/Wallet/Booking 기본 화면 | 객체 상세 Technical evidence | 운영 라벨과 마스킹된 식별 요약 |

새 Diagnostics 메뉴를 추가할 필요는 없다. 이미 존재하는 `Developer / System`을 기술 집계의 정식 목적지로 사용하고, 객체별 증거는 해당 상세 화면에 접어서 둔다.

## 중복 또는 누락 기능

| 유형 | 항목 | 판단과 조치 |
|---|---|---|
| 중복 | Payments callback ledger와 Payment detail callback timeline | 목록 ledger 제거, 상세를 단일 근거로 유지 |
| 중복 | Finance Overview와 `/finance-tax` 개요 | 전자는 오늘의 액션, 후자는 기간 마감 완결성만 담당 |
| 중복 | `/providers`와 `/partners` | Partners를 정식 경로로 유지하고 Providers는 리다이렉트만 |
| 중복 | `/files`와 `/chat-archive` | Chat Evidence를 정식 경로로 유지하고 Files는 리다이렉트만 |
| 중복 | referral 목록의 정책 편집과 Tax/Restricted 정책 영역 | 추천 정책 편집을 Restricted Settings로 이동 |
| 누락 | Cash Settlements 메뉴 | Finance Today에 기존 URL 연결 |
| 누락 | Finance Closeout 메뉴 | Finance Today에 기존 URL 연결 |
| 누락 | Partner Controls 메뉴 | Partner Operations에 기존 URL 연결 |
| 누락 | Earnings 메뉴 | Finance Records에 기존 URL 연결 |
| 누락 | Referral Cashouts 메뉴 | Growth & Content 또는 Finance Today에 역할 기반 연결 |
| 누락 | 객체별 권한 없음 상태 | not-found와 분리하고 안전한 이전 목록 CTA 제공 |

API의 `admin-*.routes.ts` 계열과 `admin/system` controller를 관리자 웹의 호출 영역과 대조했다. 명확한 업무 API가 UI 없이 빠진 사례는 추가로 확인되지 않았고, 실제 누락은 위의 **이미 존재하지만 메뉴에 없는 페이지**였다. Queue acknowledge/resolve 같은 시스템 동작은 Background Jobs 상세에 남기는 것이 맞다. 사용처가 없다고 확정할 수 있는 상호작용 컴포넌트도 찾지 못해 추측성 삭제 후보는 기록하지 않았다.

## 실제 문구 감사

UI의 기본 언어가 영어이므로 제안 문구도 영어로 맞췄다. 제품 언어 정책이 정해지면 같은 의미를 한 번에 번역해야 한다.

| 화면 | 현재 문구 | 문제 | 제안 문구 | 변경 이유 |
|---|---|---|---|---|
| Start Shift | `7 open` | 큐 수인지 레코드 수인지 불명확 | `7 queues need attention` | 단위를 명시 |
| Bookings | `Socket push updates active` | 정상 기술 상태이며 행동 없음 | 정상일 때 삭제; 장애 시 `Live updates delayed — refresh to check the latest bookings` | 문제와 행동이 있을 때만 노출 |
| Bookings empty | `No bookings loaded. Start the API and run the smoke flow to populate this table.` | 운영자에게 개발 작업 요구 | `No bookings yet.` 또는 `Bookings could not be loaded — try again.` | 무데이터와 오류를 구분 |
| Partners empty | `No partners loaded. Start the API and seed data to populate this table.` | seed는 개발 용어 | `No partner records yet.` 또는 `Partners could not be loaded — try again.` | 운영 행동 중심 |
| Reviews description | `Review rows use the same table card, rounded pagination, avatars, and operator action pattern as bookings.` | 구현 설명이며 업무 목적이 없음 | `Review customer feedback and decide whether it should remain visible in the app.` | 운영 판단 설명 |
| Reviews empty | `No customer reviews loaded.` | 기간/필터/오류 원인을 알 수 없음 | `No reviews match the current date and filters. View all dates or clear filters.` | 원인과 다음 행동 제공 |
| Operations Policy | `Change live matching details from Admin instead of editing code...` | 개발 과정 중심 | `Set the live matching limits operators use during booking assignment.` | 사용 결과 중심 |
| Payment Fees | `Period policy missing` | 상태만 있고 다음 행동 없음 | `No fee policy covers this period — create or select a policy before closing.` | 필요한 조치 제시 |
| Partner detail | `DRAFT`, `DEFERRED`, `MANUAL OFFLINE`, `missing` | raw enum과 모호한 상태 | `Profile draft`, `Review postponed`, `Taken offline by an operator`, `Required information missing` | 의미와 주체 명확화 |
| Not found | `The requested Admin workspace route is not available in the current navigation policy.` | not-found와 권한 문제를 섞은 기술 문구 | `This customer record was not found. It may have been removed, or you may not have access.` | 객체·가능 원인 명시 |
| Not found CTA | `Return to Start Shift` | 현재 업무 맥락을 잃음 | `Back to customers` 등 객체별 목록 CTA | 복구 경로 단축 |
| Desktop gate | `Desktop required` | 차단 이유는 알지만 긴급 확인 대안 없음 | `Use a screen at least 1024 px wide to make Admin changes.` | 쓰기 제한의 이유와 범위 명시 |

## 위치와 레이아웃 변경안

| 화면 | 현재 배치 | 구체적 이동 방향 |
|---|---|---|
| Start Shift | 요약 카드 안에서 큐 수와 레코드 수 혼합 | 첫 영역을 `Needs action now`로 유지하고 각 행을 상태 → 최장 대기 → 영향 → 담당자 → 열기로 정렬 |
| Bookings | KPI → 실시간 기술 상태 → 큰 필터 → 표 | 제목 옆 긴급 건수, 표 바로 위 한 줄 핵심 필터, 고급 필터 접기, 첫 행을 기본 뷰포트 안으로 이동 |
| Booking detail | 여러 체크리스트 행동이 섹션마다 반복 | 상단에 병목·다음 행동 하나, 아래에 Overview/People/Money/Activity/Evidence 순서 |
| Customer detail | 읽기 정보 사이에 지갑·발송 폼 상시 노출 | 상단 읽기 요약 유지, `Adjust wallet`와 `Send message`는 별도 우측 패널로 열기 |
| Finance Overview | Finance scope 설명이 액션 큐보다 앞섬 | 현재 역할 범위를 제목 보조 텍스트로 축약하고 액션 큐를 바로 아래 배치 |
| Bank Reconciliation | import, manual transaction, workload, queue 연속 | 상단 작업 선택을 `Review unmatched`/`Import statement`로 분리하고 각각 한 흐름만 표시 |
| Notification Templates | 5개 언어 폼과 Save 반복 | 좌측 템플릿 목록, 중앙 언어 탭, 우측 실제 미리보기·변경 요약, 하단 단일 Save |
| Operations Policy | 카드마다 입력·사유·Save, 내부 스크롤 | 현재/권장/영향 비교표를 먼저 두고 선택한 정책 편집은 드로어로 이동 |
| Reviews/Calendar 빈 상태 | 0 KPI가 본문보다 먼저 | KPI 줄을 축약하고 빈 상태·필터 복구 행동을 첫 화면에 배치 |
| Background Jobs | 12열 표가 내부 스크롤 | 7개 핵심 열로 축약하고 Workflow/Job ID/스케줄 증거는 상세에 배치 |

## 주요 표 열 구조 개선안

| 표 | 현재 열 | 권장 기본 열 순서 | 상세/접기로 이동 |
|---|---|---|---|
| Bookings | Booking, Customer, Partner, Service, Address, Status, Next action | Status, Next action, Age, Customer, Partner, Service, Area, Booking | 원문 전화번호, 전체 주소, 내부 ID 설명 |
| Customers | Customer, Profile, Sign-up Date, Last activity, Last address, Bookings, Attention, Customer value | Attention, Customer, Last activity, Bookings, Customer value, Area, Sign-up | 전체 주소, 내부 profile ID |
| Partners | Partner, Gender, State, Level, Access, Location, Work, Wallet, Account | State/next review, Partner, Access, Work, Wallet risk, Area, Level | Gender가 판단에 필요하지 않으면 상세, raw state, 내부 ID |
| Refunds | Refund, Customer, Partner, Payment, Booking, Amount, Status, Ops hint | Status, Ops hint/next action, Amount, Waiting since, Customer, Payment/Booking, Partner | 내부 refund/payment ID |
| Reviews | Request Time, Partner, Customer, Review, Visibility, Actions | Visibility/attention, Review, Customer, Partner, Request time, Action | 내부 record ID |
| Finance Approval | Work type, Subject, Exposure, Control, Waiting since, Action | Urgency/SLA, Work type, Exposure, Subject, Maker/checker control, Waiting since, Decision | 정책 payload와 내부 ID |
| Bank Reconciliation | Transaction, Account & counterparty, Amount, Match progress, Review, Evidence, Open | Review state/SLA, Amount, Occurred at, Account, Counterparty, Match progress, Owner, Open | 전체 evidence, source key, import payload |
| Payments callback | Received, Method, Outcome, Gateway ref, Payment, Evidence | 목록에서 제거; 결제 상세은 Outcome, Received, Evidence summary, Error | raw payload와 gateway ref 전문 |
| Audit Log | When, Action, Actor, Target, Related board, Ops record, Metadata | When, Result, Action, Actor, Target, Related board | Ops record 원문과 Metadata |
| Background Jobs | Queue, Status, Workers, Waiting, Active, Delayed, Queue timing, SLA, Failed, Last run, Next scheduled, Workflow | Status, Queue, Waiting, Active, Delayed/SLA, Failed, Action | Workers, timing 상세, last/next schedule, workflow, job ID |

행 전체 클릭은 읽기 상세로만 사용하고, 승인·저장·발송 같은 변경은 이름 있는 버튼으로 분리한다. 상태는 색상뿐 아니라 텍스트와 다음 행동으로 표현한다.

## 브라우저 라우트 커버리지

`브라우저`는 실제 페이지를 열어 확인했다는 뜻이다. `목록만`은 현재 데이터가 없어 상세 레코드를 열지 못한 경우다. 리다이렉트는 소스와 도착 페이지를 함께 확인했다.

| 영역 | 라우트 | 확인 | 비고 |
|---|---|---|---|
| 인증/시작 | `/login`, `/` | 브라우저 | 로그아웃 없이 로그인 화면과 인증된 Start Shift 확인 |
| Shift | `/calendar`, `/operations-handoff`, `/operations-policy` | 브라우저 | 달력 드로어 열기/닫기 포함 |
| Bookings | `/bookings`, `/bookings/completed`, `/bookings/post-match-cancellations`, `/bookings/[id]` | 브라우저 | 검색 결과 없음과 대표 상세 확인 |
| Customers | `/customers`, `/customers/[id]` | 브라우저 | 다음 페이지 이동, 대표 상세 확인 |
| Reviews | `/reviews`, `/reviews/partner-customer-evaluations` | 브라우저 | 빈 상태 확인 |
| Partners | `/partners`의 기본·미승인·미정산 뷰, `/partners/[id]`, `/partner-controls`, `/partners/overview` | 브라우저 | 대표 상세 확인 |
| 호환 별칭 | `/providers`, `/providers/[id]` | 리다이렉트/브라우저 | Partners 별칭 |
| Referrals | `/referrals/customers`, `/referrals/customers/[id]`, `/referrals/partners`, `/referrals/partners/[id]`, `/referrals/cashouts` | 브라우저 | 대표 고객 추천 상세 확인 |
| Referrals 별칭 | `/referrals` | 리다이렉트 | 고객 추천으로 이동 |
| Analytics | `/vietnam-overview`, `/usage-overview`, `/marketing-analytics` | 브라우저 | 분석과 쓰기 작업 혼합 확인 |
| Communications | `/notifications`, `/notifications/templates`, `/notifications/push-send` | 브라우저 | 템플릿 다국어 편집 구조 확인 |
| Content | `/coupons`, `/website-content`, `/services` | 브라우저 | 서비스 카탈로그 포함 |
| Finance today | `/finance-overview`, `/finance-tax/approval-queue`, `/refunds`, `/cash-settlements`, `/finance-closeout` | 브라우저 | 숨은 핵심 큐 확인 |
| Money movement | `/payments`, `/payments/[id]`, `/payouts`, `/earnings`, `/wallet-adjustments` | 브라우저/목록만 | 결제 상세은 현재 대표 레코드 부족 |
| Bank | `/finance-tax/bank-reconciliation`, `/finance-tax/bank-reconciliation/[id]`, `/finance-tax/bank-reconciliation/import-batches/[batchImportId]` | 브라우저/목록만 | 기본 화면 확인, 상세 레코드 부족 |
| Deposits | `/finance-tax/partner-bank-deposits`, `/finance-tax/partner-bank-deposits/[id]` | 브라우저 | 대표 상세 확인 |
| Clearing | `/finance-tax/payment-clearing`, `/finance-tax/payment-clearing/[id]` | 브라우저/목록만 | 목록 확인, 상세 레코드 부족 |
| Accounting | `/finance-tax/general-ledger`, `/finance-tax/general-ledger/[id]`, `/finance-tax/booking-settlement-audit`, `/finance-tax/booking-settlement-audit/[id]`, `/finance-tax/settlement-reversals`, `/finance-tax/settlement-reversals/[id]`, `/finance-tax/coupon-finance` | 브라우저/목록만 | 목록 확인, 일부 상세 레코드 부족 |
| Tax/close | `/finance-tax`, `/finance-tax/monthly-tax-closing`, `/finance-tax/platform-vat`, `/finance-tax/partner-withholding-tax`, `/finance-tax/payment-fees`, `/tax-policy` | 브라우저 | 개요 중복과 정책/증거 혼합 확인 |
| Restricted finance | `/finance-tax/company-bank-accounts`, `/finance-tax/finance-approvers` | 브라우저 | 제한 설정 확인 |
| Evidence | `/chat-archive`, `/files` | 브라우저/리다이렉트 | Files는 Chat Archive 호환 별칭 |
| Admin control | `/admin-operators`, `/audit-log` | 브라우저 | 실제 변경 없음 |
| Developer/System | `/setup`, `/app-sessions`, `/background-jobs`, `/background-jobs/incidents/[id]` | 브라우저 | 대표 incident 상세 확인 |

## 화면 상태와 상호작용 커버리지

| 상태/행동 | 결과 |
|---|---|
| 기본 데이터 화면 | 주요 목록·상세·대시보드에서 확인 |
| 결과 없음 | 예약 검색과 Reviews에서 확인 |
| Not found | 존재하지 않는 고객 상세에서 확인 |
| 페이지네이션 | 고객 목록 `Next`로 2페이지 이동 확인 |
| 드로어 | Calendar `Add Event` 열기와 닫기 확인, 저장하지 않음 |
| 권한 | MASTER_ADMIN에서 제한 메뉴 확인, 다른 역할 실제 세션은 미검증 |
| 로딩 | SSR 응답이 빨라 의도적 지연 없이 캡처하지 못함 |
| 오류 | 달력의 일시 오류는 재현되지 않아 결함 목록에서 제외 |
| 파괴적 행동 | 생성·수정·승인·거절·지급·발송 제출하지 않음 |

## 근거 화면

| 증거 | URL / 페이지 | 뷰포트 | 문제 영역·발생 조건 | 관련 코드 |
|---|---|---:|---|---|
| [Start Shift](./admin-ux-audit-evidence/02-start-shift-desktop.png) | `/` Start Shift | 1677×1261 | 기본 상태. action-first 구조와 모호한 open 단위 | `apps/admin_web/app/page.tsx` |
| [Calendar](./admin-ux-audit-evidence/03-calendar-desktop.png) | `/calendar` | 1677×1261 | 이벤트가 없는 기본 상태에서 0 KPI가 캘린더보다 먼저 표시 | `apps/admin_web/app/calendar/page.tsx` |
| [Bookings no result](./admin-ux-audit-evidence/05-bookings-search-no-results.png) | `/bookings?q=…` | 1677×1261 | 일치하지 않는 검색어 적용. 필터 보드가 빈 결과보다 먼저 공간 점유 | `apps/admin_web/app/bookings/booking-monitor.tsx` |
| [Notification Templates](./admin-ux-audit-evidence/06-notification-templates-technical-keys.png) | `/notifications/templates` | 1677×1261 | 기본 상태. raw key/variables와 언어별 Save 반복 | `apps/admin_web/app/notifications/templates/page.tsx` |
| [Finance Overview](./admin-ux-audit-evidence/07-finance-overview-desktop.png) | `/finance-overview` | 1677×1261 | 기본 상태. 좋은 action queue와 앞선 scope 설명 | `apps/admin_web/app/finance-overview/page.tsx` |
| [Operations Policy](./admin-ux-audit-evidence/08-operations-policy-many-editors.png) | `/operations-policy` | 1677×1261 | 기본 상태. 반복 편집기·개발 문구·내부 스크롤 | `apps/admin_web/app/operations-policy/page.tsx` |
| [Background Jobs](./admin-ux-audit-evidence/09-background-jobs-system-only.png) | `/background-jobs` | 1677×1261 | 기본 상태. 12열 표의 과도한 줄바꿈 | `apps/admin_web/app/background-jobs/page.tsx` |
| [Reviews empty](./admin-ux-audit-evidence/10-reviews-empty-state.png) | `/reviews` | 1692×1272 | 데이터 0 상태. 0 KPI·필터·빈 표·페이지네이션 동시 노출 | `apps/admin_web/app/reviews/page.tsx` |
| [Narrow gate](./admin-ux-audit-evidence/11-admin-narrow-desktop-gate.png) | `/` | 900×900 | 1024px 미만에서 전체 앱 차단 | `apps/admin_web/components/admin-desktop-only-gate.tsx` |
| [Customer not found](./admin-ux-audit-evidence/12-customer-detail-not-found.png) | `/customers/[존재하지 않는 id]` | 1692×1272 | 없는 레코드. 기술 문구와 일반 Start Shift CTA | `apps/admin_web/app/not-found.tsx` |

예약·고객·파트너 실데이터 화면은 개인정보가 노출되어 캡처를 의도적으로 제외했다. 발견 내용은 DOM과 렌더링 소스를 대조했다.

## 코드 연결

| 관찰 | 코드 근거 |
|---|---|
| 예약 목록 전화번호·주소·열 순서 | `apps/admin_web/app/bookings/booking-monitor-list-section.tsx` |
| KPI/필터 뒤에 표가 렌더링되는 순서 | `apps/admin_web/app/bookings/booking-monitor.tsx` |
| 템플릿 원시 키·변수·언어별 form | `apps/admin_web/app/notifications/templates/page.tsx` |
| 지갑 조정 원시 owner ID | `apps/admin_web/app/wallet-adjustments/page.tsx`, `actions.ts` |
| 결제 callback ledger 중복 | `apps/admin_web/app/payments/page.tsx`, `payment-callback-attempt-ledger-section.tsx`, `apps/admin_web/app/payments/[id]/payment-detail-callback-timeline-section.tsx` |
| 운영 정책의 개발자 문구·반복 편집기 | `apps/admin_web/app/operations-policy/page.tsx` |
| Reviews 구현 설명·빈 문구 | `apps/admin_web/app/reviews/reviews-table-section.tsx`, `review-page-model.ts` |
| 수치가 모두 h2 | `apps/admin_web/components/metric-card.tsx` |
| 개발용 예약·파트너 빈 문구 | `apps/admin_web/app/bookings/booking-empty-message.ts`, `apps/admin_web/app/partners/partner-filters.ts` |
| Not found 문구와 CTA | `apps/admin_web/app/not-found.tsx` |
| 데스크톱 차단 | `apps/admin_web/components/admin-desktop-only-gate.tsx` |
| 메뉴와 숨은 라우트 | `apps/admin_web/lib/admin-navigation.ts`, `apps/admin_web/app/page.tsx` |
| 역할별 메뉴 접근 | `apps/admin_web/lib/admin-operator-access-model.ts` |
| Background Jobs 12열 표 | `apps/admin_web/app/background-jobs/page.tsx` |

## 10개 이하 Quick Wins

1. 예약 목록 전화번호를 마스킹하고 주소를 구/동 수준으로 줄인다.
2. 예약 열을 `Status → Next action → Age → Customer → Partner → Service → Area → Booking ID`로 바꾼다.
3. 예약·파트너 빈 상태에서 API, seed, smoke 문구를 제거하고 실패와 무데이터를 구분한다.
4. `MetricCard`의 값 태그를 `<h2>`에서 일반 텍스트로 바꾼다.
5. Not found 문구를 업무 객체 기준으로 바꾸고 이전 목록 CTA를 제공한다.
6. Payments 목록의 callback ledger를 제거하고 상세 타임라인으로 연결한다.
7. Reviews와 Calendar가 전부 0이면 KPI 줄을 축약하고 빈 상태를 먼저 보여 준다.
8. 숨은 `/cash-settlements`, `/finance-closeout`, `/partner-controls`를 기존 메뉴에 연결한다.
9. 템플릿 원시 변수 JSON을 기본 숨김 처리하고 친숙한 이벤트 이름을 추가한다.
10. smoke/demo 정책 문구를 운영 데이터에서 제거한다.

## 구조 개선이 필요한 항목

- 역할별 8개 업무 영역으로 메뉴 재구성
- 은행 명세서 가져오기와 미매칭 검토 흐름 분리
- 고객 상세의 읽기 기본 화면과 고위험 행동 패널 분리
- 알림 템플릿의 원자적 다국어 저장과 미리보기
- 정책 화면의 읽기 요약과 편집 드로어 분리
- 목록·상세·Developer/System 사이에서 기술 증거를 단계적으로 노출

세부 구조안은 [admin-information-architecture-proposal.md](./admin-information-architecture-proposal.md), 구현 순서는 [admin-ux-implementation-backlog.md](./admin-ux-implementation-backlog.md)에 정리했다.

## 유지할 좋은 요소

- Start Shift의 `Needs action now`와 직접 큐 링크
- Finance Overview의 소유자·금액·대기시간 중심 액션 카드
- Developer/System의 시각적·권한상 분리
- 예약 검색의 필터 인식형 결과 없음 메시지
- 고객 목록의 정상적인 URL 기반 페이지 이동
- Wallet Adjustment의 사전 회계 미리보기와 승인 개념
- 제한 설정에 배치된 회사 계좌·재무 승인자 관리
- 좁은 화면에서 위험한 폼을 억지로 축소하지 않는 안전 우선 태도
