# Partner Overview 운영자 UX·데이터 정의 심층 감사

- 감사 대상: `http://localhost:3101/partners/overview`
- 감사 일시: 2026-08-06 20:33~20:45 (Vietnam time)
- 관찰 상태: 로그인된 관리자, 로컬 실데이터/시드 상태
- 확인 범위: Today, 7 days, 30 days, 90 days, Negative wallet 필터, 1440×900, 1024×900, 720×900
- 코드 범위: Admin Web 페이지·CSS·모델·테스트, NestJS Partner Overview 집계, 공개 Partner 준비 조건, 운영 정책 문서
- 변경 범위: 애플리케이션 코드는 수정하지 않았고 이 보고서와 증거 캡처만 생성했다.

## 1. 결론

현재 페이지는 정보량과 링크 연결은 충분하지만, 운영자가 수치를 믿고 바로 행동하기에는 아직 위험하다. 가장 큰 문제는 장식이나 간격이 아니라 **같은 용어가 다른 계산을 뜻하고, 서로 다른 시간 범위의 지표가 한 화면에 섞이며, 일부 정책이 확정된 MVP 운영 원칙과 충돌한다는 점**이다.

가장 먼저 고쳐야 할 항목은 다음 다섯 가지다.

1. 고객 앱 노출 조건에서 은행 승인 의존성을 제거한다.
2. 상단의 `Ready now`와 지역·서비스 표의 `Ready now`를 서로 다른 정의로 분리한다.
3. 원인 주체를 구분하지 않은 `Partner Cancellation Rate` 문구를 고친다.
4. `Booking quality risk` 목록에서 지갑·일반 위험 Partner가 섞이는 집계 로직을 분리한다.
5. 현재 시점 스냅샷과 선택 기간 성과를 시각적·문구적으로 분리한다.

그 다음으로 데스크톱에서도 깨지는 운영 상태 카드, 반응형 그리드 충돌, 좁은 반쪽 폭 테이블, 앱 텔레메트리 미수집 비율, 0건 구간의 `-100%` 표시를 고쳐야 한다.

## 2. 잘된 점

- Vietnam time과 갱신 시각을 표시한다.
- 기간, 도시, 서비스, 승인, 온라인, 지갑, 위험 필터가 한곳에 모여 있다.
- 활성 필터를 칩으로 표시하고 개별 제거·전체 초기화를 제공한다.
- `blocker counts can overlap`, `signals can overlap` 안내는 중복 집계 오해를 줄인다.
- 우선순위 카드, 운영 상태, 큐가 실제 Partner 목록으로 연결된다.
- Registered → Approved → Ready Now 퍼널은 큰 이탈 지점을 빠르게 보여준다.
- 앱 사용 지표를 예약 성과와 분리하려는 방향은 맞다.
- API가 실패하면 0으로 위장하지 않고 데이터 없음 상태를 보여주도록 작성돼 있다.

## 3. 운영자가 현재 화면에서 오판할 수 있는 지점

### P0-1. 은행 승인이 고객 앱 노출을 막는 구조가 MVP 정책과 충돌한다

화면은 `Customer App visibility blockers`에 `Bank approval missing 163`을 노출한다. 코드에서도 `publicProviderIdentityWhere()`가 승인 은행 계좌를 필수 조건으로 포함하고, 이 조건을 고객 공개 조회가 재사용한다.

- 화면 근거: `04-operating-status-signals-1440.png`
- 정책 근거: `docs/architecture/provider-onboarding.md:38` — 은행 계좌 검토는 Partner 수준 게이트가 아니며 출금 요청 시 검토한다.
- 정책 근거: `docs/agent/HANDS_CODEX_WORKFLOW_GUARD.md:47` — 음수 지갑도 마켓 노출은 유지한다.
- 코드 근거: `apps/api/src/providers/provider-public-readiness.ts:31-68`
- 코드 근거: `apps/api/src/admin/admin.service.ts:33787-33814`, `8508-8546`

운영 영향:

- 은행 계좌가 아직 없는 승인 Partner가 고객 앱에서 사라질 수 있다.
- 운영자는 은행 승인 163건을 공급 노출 장애로 오인하고, 정작 지급 단계의 업무를 공급 복구 업무보다 먼저 처리할 수 있다.

수정 요건:

- `publicProviderIdentityWhere()`에서 승인 은행 계좌 조건을 제거한다.
- 고객 앱 노출 blocker 목록에서 `Bank approval missing`을 제거한다.
- 해당 집계는 Finance/Wallet 영역으로 이동하고 `Payout bank not approved` 또는 `Withdrawal bank review pending`으로 표시한다.
- 공개 목록에는 은행 승인 여부와 음수 지갑 여부가 영향을 주지 않아야 한다.
- 음수 지갑 정책 문구는 다음처럼 단정적으로 쓴다.

> Negative wallet does not hide a Partner or prevent request participation. Final acceptance, service start, and payout release are blocked until settlement.

완료 기준:

- 승인·KYC·필수 신분 문서·공개 서비스·신선 위치·허용 온라인 상태를 충족한 Partner는 은행 계좌가 없어도 공개된다.
- 같은 Partner는 지급/출금 단계에서만 은행 미승인 경고를 받는다.
- API 단위 테스트에 “은행 계좌 없음 → 공개 가능, 출금/지급 불가” 계약이 남는다.

### P0-2. `Ready now`가 화면 안에서 두 가지 뜻으로 사용된다

상단 운영 상태와 퍼널의 `Ready now`는 0명이다. 반면 같은 화면의 지역 표에는 Ho Chi Minh City 188명, 서비스 표에는 Foot Massage 45 min 165명이 `Ready now`로 표시된다.

코드상 원인은 명확하다.

- 상단 `Ready now`: 승인 + KYC + `ONLINE_AVAILABLE` + 차단 없음 + 활성 서비스 + 음수 지갑 아님 + 90분 이내 위치.
- 지역·서비스 `Ready now`: `isProviderReadyForDispatchStatus()`가 참인 온라인 상태만 계산하며 실제 예약 가능 게이트를 적용하지 않는다.
- 코드 근거: `apps/api/src/admin/admin.service.ts:33841-33854`, `34072-34117`, `34163-34172`
- 화면 헤더 근거: `apps/admin_web/app/partners/overview/page.tsx:742-764`, `799-823`

운영 영향:

- 운영자는 “지금 예약 가능한 공급이 188명”이라고 판단할 수 있지만 실제 완전 예약 가능 공급은 0명이다.
- 공급 부족 대응, 프로모션, 배차 판단이 반대로 내려갈 수 있다.

수정 요건:

- 지역·서비스 표의 현재 `Ready now`를 `Online available`로 즉시 변경한다. 이 변경은 계산을 건드리지 않는 가장 안전한 1차 수정이다.
- 실제 예약 가능 수가 필요하면 별도 `Bookable now` 열을 추가하고 상단 Ready Now와 동일한 predicate를 재사용한다.
- 용어 계약을 아래처럼 고정한다.

| 용어 | 단일 정의 |
|---|---|
| Online available | Partner 상태가 `ONLINE_AVAILABLE` |
| Bookable now | 승인·KYC·활성 서비스·위치 신선·계정 정상·지갑 정산 완료·온라인 가능 |
| Visible in customer app | 공개 신분·활성 서비스·신선 위치·허용 온라인 상태·계정 정상. 은행/지갑은 노출 게이트가 아님 |

완료 기준:

- 같은 화면 어디에서도 `Ready now`가 다른 계산에 사용되지 않는다.
- 상단 Bookable now 0이면 모든 지역·서비스 Bookable now 합계도 0이다.

### P0-3. `Partner Cancellation Rate`는 Partner 귀책 취소율이 아니다

현재 코드는 `CANCELLED`, `NO_SHOW`, `EXPIRED` 상태를 모두 취소로 합산한다. 취소 주체나 사유를 구분하지 않은 채 UI에서 `Partner Cancellation Rate`라고 표시한다.

- 코드 근거: `apps/api/src/admin/admin.service.ts:7358`, `8317-8332`, `8670-8688`
- 화면 근거: Today 0%, 7일 99%, 30·90일 100%

운영 영향:

- 고객 취소, 시스템 만료, Partner no-show가 Partner 귀책 취소로 한데 묶일 수 있다.
- Partner 제재·교육·평가 판단에 직접적인 오판을 만든다.

수정 요건:

- 취소 actor/reason을 계산할 수 있을 때만 `Partner-caused cancellation rate`를 쓴다.
- 현재 데이터만 유지한다면 `Non-completed booking rate` 또는 `Cancelled / no-show / expired rate`로 이름을 바꾼다.
- 상세 표의 `Cancel`도 `Non-completed` 또는 분리된 `Cancelled`, `No-show`, `Expired`로 바꾼다.

완료 기준:

- 명칭과 분모·분자의 이벤트 정의가 도움말에 표시된다.
- 고객 취소가 Partner 귀책 지표에 포함되지 않는 테스트가 있다.

### P0-4. 품질 위험 표가 지갑 위험 Partner를 보여준다

Today 품질 KPI는 취소 0, no-show 0, 리뷰 후속 0인데 아래 표에는 `Negative wallet` Partner가 다섯 명 표시된다. 7일 화면에서도 첫 행을 제외한 다수 행의 행동이 `Review wallet receivable`이다.

원인은 `qualityRiskFacts`가 실제 품질 신호뿐 아니라 일반 `riskLevel === critical/high`까지 포함하기 때문이다. 음수 지갑이 critical이므로 품질 표에 들어온다.

- 코드 근거: `apps/api/src/admin/admin.service.ts:8333-8353`
- 일반 위험 사유 우선순위: `apps/api/src/admin/admin.service.ts:34328-34368`
- 화면 근거: `09-quality-wallet-risk-1440.png`, `20-quality-wallet-risk-7d-1440.png`

운영 영향:

- `Quality risk 56 partners`의 의미와 실제 표가 일치하지 않는다.
- 품질 담당자가 지갑 정산 업무를 받는다.
- 실제 no-show, 저평점, 높은 취소 Partner가 음수 지갑 Partner 뒤에 밀릴 수 있다.

수정 요건:

- 품질 목록 predicate를 `cancellationRate >= threshold || lowReviewCount > 0 || noShowReports > 0`로 제한한다.
- 정렬도 no-show, 저평점, 취소율 순으로 품질 전용 정렬을 사용한다.
- `mainReason`과 `recommendedAction`도 품질 전용 값을 만들어 `Review wallet receivable`이 품질 표에 나타나지 않게 한다.
- `riskPartnerCount`와 표 row 집합이 같은 predicate를 사용한다.

완료 기준:

- 품질 KPI가 모두 0이면 품질 표는 비어 있다.
- 품질 표의 모든 행은 최소 한 개의 품질 근거를 가진다.
- 음수 지갑만 있는 Partner는 Finance/Wallet 표에만 나타난다.

### P0-5. 기간 필터가 현재 스냅샷과 기간 성과에 섞여 보인다

Today, 7일, 30일, 90일을 바꿔도 Ready now, 현재 오프라인, 현재 지갑 총액 같은 스냅샷은 그대로이고 앱 활동·리뷰·예약 성과만 달라진다. 그러나 상단의 `Partner supply range`와 전역 기간 탭은 페이지 전체가 해당 기간으로 필터된 것처럼 보인다.

7일 확인값:

- App-active Partners 4, App Opens 20, Session Starts 19
- Quality risk 56, selection issues 3
- 현재 Ready now는 Today와 동일하게 0

운영 영향:

- 사용자는 “7일 동안 Ready now 0”인지 “현재 Ready now 0”인지 구분하기 어렵다.
- 같은 Finance 카드 안에서 기간 매출과 현재 지갑 잔액이 나란히 표시된다.

수정 요건:

- 페이지를 `Current operations · as of …`와 `Performance · selected period` 두 범위로 명시적으로 분리한다.
- 기간 탭은 Performance 섹션 헤더에 배치하거나, 전역 위치를 유지한다면 각 카드에 `Current` 또는 `Last 7 days` scope를 반드시 표시한다.
- Finance는 `Period earnings`와 `Current balance exposure`로 분리한다.
- 현재 값이 기간 탭에 의해 변하지 않는다는 설명을 짧게 표시한다.

완료 기준:

- 운영자가 각 수치의 기준 시점과 기간을 카드만 보고 알 수 있다.
- 7일 탭에서 현재 스냅샷에는 `Current` 배지가, 기간 성과에는 `Last 7 days` 배지가 표시된다.

## 4. 레이아웃·상호작용 문제

### P1-1. 운영 상태 카드가 1440px 데스크톱부터 깨진다

`Ready now0Approved...`, `Available but blocked187Online...`처럼 배지·라벨·값·설명이 한 줄에 이어 붙는다. 1024와 720에서도 동일하다.

원인:

- `AdminOverviewCommandCard` 내부는 `<span><strong><small><em>` 구조다.
- 기존 `.partner-overview-command-card > div`에는 `display: grid`가 있으나 운영 카드가 `baseClassName="partner-overview-operating-card"`로 이를 교체해 공통 레이아웃을 잃는다.
- 코드 근거: `apps/admin_web/components/admin-overview-card.tsx:396-445`
- CSS 근거: `apps/admin_web/app/globals.css:10309-10360`, `11232-11236`, `11343-11396`

수정 요건:

- 새 컴포넌트를 만들지 말고 기존 `partner-overview-command-card` 레이아웃을 함께 재사용한다.
- 라벨, 값, 설명, 링크는 각각 독립 행이어야 한다.
- 1440/1024에서는 3열, 720에서는 1~2열이 되도록 실제 카드 최소 폭을 기준으로 전환한다.

### P1-2. Finance KPI 다섯 칸이 반쪽 카드에 들어가 값이 겹친다

7일 화면에서 19.800.000 VND, 3.510.000 VND, 지급액, 지갑 잔액이 서로 겹쳐 읽을 수 없다.

원인:

- Quality와 Finance를 2열 반쪽 폭으로 놓는다.
- 각 반쪽 안에서 Mini KPI를 다시 5열로 강제한다.
- CSS 근거: `apps/admin_web/app/globals.css:11454-11457`, `11500-11528`

수정 요건:

- Quality와 Finance를 세로로 쌓아 각각 전체 폭을 사용한다.
- Finance 내부는 3열 이하로 제한하거나 `Period earnings`와 `Current wallet` 두 묶음으로 나눈다.
- 금액은 절대 겹치거나 말줄임되지 않아야 한다.

### P1-3. 720px에서도 Quality와 Finance가 두 열로 남는다

`@media (max-width: 900px)`에서 1열로 바꾸지만 뒤에 선언된 `.usage-overview-insight-grid`의 `@media (max-width: 1180px)` 2열 규칙이 cascade로 다시 덮는다.

- CSS 근거: `apps/admin_web/app/globals.css:11696-11707`, `12170-12180`
- 화면 근거: `17-quality-wallet-risk-720.png`

수정 요건:

- 공통 insight grid보다 Partner Overview 전용 반응형 규칙이 뒤에서 적용되게 순서를 정리하거나 충분히 구체적인 전용 selector를 사용한다.
- 720px에서 두 섹션은 1열이어야 한다.

### P1-4. 주요 표가 데스크톱에서도 반쪽 폭 수평 스크롤이다

1440 화면에서 Area 표는 약 484px 컨테이너 안에 1065px, Service 표는 878px 폭 콘텐츠를 넣는다. 오른쪽으로 스크롤하면 Area/Service 식별 열이 사라지고 Status만 남는다.

수정 요건:

- Area와 Service 표도 전체 폭으로 세로 배치한다. 새 라이브러리는 필요 없다.
- 첫 열은 `position: sticky; left: 0`으로 고정하고 배경을 지정한다.
- 빈 지역 네 개를 반복하지 말고 공급이 있는 지역을 먼저 보여주며 `4 areas with no supply`로 접을 수 있다.
- 긴 이름은 음절 단위로 깨지지 않게 최소 폭과 `overflow-wrap: normal`을 적용한다.

### P1-5. Selection friction 표는 핵심 행동이 화면 밖에 있다

13개 열 때문에 Partner, 지역, 조회수만 먼저 보이고 `Reason`과 `Action`은 오른쪽 끝에 숨는다. 실제 운영자는 원인과 다음 행동을 가장 먼저 봐야 한다.

수정 요건:

- 기본 표를 `Partner | Demand signal | Booking eligibility | Response | Conversion | Recommended action` 여섯 열로 줄인다.
- 가격, 이미지 수, 갤러리 수, 서비스 수는 행의 `<details>`에 넣는다.
- `Available now`와 `Not eligible now`가 동시에 보이지 않게 `Online status`와 `Bookable status`를 분리한다.
- Action 열은 오른쪽 sticky 또는 Partner 다음 열에 둔다.

### P1-6. 페이지가 6,105px로 길고 같은 정보가 반복된다

상단 Priority, 운영 상태, blocker, 퍼널, 앱 활동, 품질, Finance, Selection, 11개 상세 큐가 모두 기본 확장돼 있다. 동일한 음수 지갑·inactive 정보가 여러 곳에 반복된다.

수정 요건:

- 기본 공개 섹션은 `Action required`, `Current supply`, `Period performance` 세 개만 둔다.
- Area/Service, App activity, Quality, Finance, Selection, 전체 큐는 같은 route 안에서 기존 segmented control이나 네이티브 `<details>`로 접는다.
- 0건 섹션은 `No action required` 한 줄로 축약한다.
- 새 페이지나 새 차트 라이브러리는 만들지 않는다.

## 5. 지표 정의·문구 문제

### P1-7. 앱 활동 0은 행동 0이 아니라 수집 부재일 가능성이 크다

Today 기준 Approved 1,235명 중 `Not Tracked Yet` 1,223명이며, tracked inactive는 4명이다. 운영 상태의 `Inactive 7D 1,075`는 앱 텔레메트리가 아니라 세션·참여·예약 활동을 합친 별도 정의다.

수정 요건:

- `Inactive 7D`를 `No operational activity in 7D`로 바꾼다.
- 앱 영역의 `Inactive 7D+`를 `App telemetry inactive 7D+`로 바꾼다.
- `Not Tracked Yet`를 `No app telemetry recorded`로 바꾼다.
- 최상단에 `Telemetry coverage: 12 / 1,235 approved Partners (1%)`처럼 분모를 함께 표시한다.
- coverage가 낮을 때 App Opens 0을 성과 저하로 색칠하지 않는다.

### P1-8. 이벤트 0건을 0%와 `-100% vs previous`로 표시한다

Today에는 완료·취소 이벤트가 없는데 Completion 0%, Cancellation 0%, 두 카드 모두 `-100% vs previous`로 나온다. 이는 개선이나 악화가 아니라 분모가 없는 상태다.

수정 요건:

- 현재 분모가 0이면 KPI value와 delta를 `null`로 반환한다.
- UI는 `No booking outcomes in this period` 또는 `No events in this period`를 표시한다.
- 이전 기간만 값이 있어도 현재 분모가 0이면 증감률을 계산하지 않는다.

### P1-9. 서비스 `Healthy` 판정이 실제 예약 가능성과 무관하다

Foot Massage 45분은 Offering 390, Online available 165, Eligible 0, Open 0, Done 0, Completion 0%인데 `Healthy`다. 코드가 `eligiblePartners === 0`이어도 open request가 0이면 Healthy로 내려가기 때문이다.

- 코드 근거: `apps/api/src/admin/admin.service.ts:34187-34210`

수정 요건:

- 공급 상태와 수요 상태를 분리한다.
- Eligible 0이면 `Not bookable` 또는 `No eligible Partner`를 보여준다.
- Open/Done 합이 0이면 성과 상태를 `No demand data`로 보여주고 Healthy로 판정하지 않는다.
- Area에서 Partner 0인 지역은 `Low Supply`가 아니라 `No Partner data` 또는 `No supply`로 표시한다.

### P1-10. 같은 Rating이 기간 평균과 평생 평균으로 섞인다

Today `Average Rating`은 당일 공개 리뷰가 없어 `Needs event`인데 Service 표는 4.93/5.00을 표시한다. Service 표는 Partner의 누적 `ratingAvg` 평균을 사용한다.

수정 요건:

- 기간 KPI: `Average review rating · selected period`.
- Service 표: `Lifetime Partner rating` 또는 `Current profile rating`.
- 수치 scope를 헤더 도움말에 명시한다.

### P1-11. 상세 액션 큐가 “우선순위”를 주지 않는다

11개 큐를 모두 표시하고 0건 큐도 `Open queue` 링크를 유지한다. Partner Operations 안에 Payout Blocked 1,307, Tax Info Missing 1,266이 함께 있어 공급 복구 업무와 Finance 업무가 섞인다.

수정 요건:

- 0건 큐는 기본 숨김 또는 `No work` 그룹으로 이동한다.
- 각 큐에 `Oldest waiting`, `SLA`, `Owner team`을 추가한다.
- Partner 공급/품질 큐와 Finance/Tax 큐를 그룹으로 나눈다.
- `Open queue` 반복 대신 `Review 147`, `Review oldest`처럼 행동과 대상을 표시한다.
- 가장 오래 대기 중인 업무와 운영 영향이 큰 업무를 먼저 정렬한다.

### P2-1. 상태 배지가 실제 상태를 설명하지 못한다

- Ready supply 0 → `Pending`
- Selection drop-off 0 → `Live`
- Quality risk 0 → `Current queue`

수정 요건:

- 0건은 모두 `No action` 또는 배지 제거.
- 1건 이상일 때만 `Needs action`.
- `Live`는 실시간 공급 상태에만 사용한다.

### P2-2. 문구와 내비게이션 이름이 일치하지 않는다

- Sidebar/Breadcrumb: `Partner Performance`
- H1: `Partner Overview`

수정 요건:

- 운영자 목적을 반영해 모두 `Partner Operations` 또는 모두 `Partner Performance`로 통일한다.
- 권장 H1: `Partner Operations`
- 권장 설명: `Current bookable supply, blockers, and Partner performance in Vietnam time.`

### P2-3. 도시 필터가 자유 입력이라 오타가 조용히 0건을 만든다

코드에는 HCM/Hanoi 별칭 정규화가 있지만 사용자는 지원되는 값과 범위를 알 수 없다.

수정 요건:

- 기존 Vietnam region bucket을 재사용한 select/typeahead를 제공한다.
- 자유 입력을 유지한다면 적용 후 정규화된 지역을 활성 필터에 보여준다.
- 0건이면 `No Partners match Ho Ch Minh. Try Ho Chi Minh City.` 같은 수정 안내를 제공한다.

### P2-4. 스크린리더 landmark 이름이 반복된다

여러 표의 접근 가능한 region 이름이 모두 `Scrollable data table`이다. 사용자는 landmark 목록에서 Area, Service, Quality, Finance, Selection을 구분하기 어렵다.

수정 요건:

- 각 `AdminTableScroll`에 `Area supply table`, `Service supply table`, `Booking quality risk table`처럼 고유 aria-label을 준다.
- 표 caption 또는 section heading과 `aria-labelledby`로 연결한다.
- 수평 스크롤 영역은 키보드로 접근 가능하고 focus 표시가 있어야 한다.

### P2-5. 갱신 시각은 있지만 갱신 행동과 stale 경고가 없다

API는 `refreshSeconds: 60`을 반환하지만 이 페이지는 값을 사용하지 않는다.

수정 요건:

- 기존 route를 다시 여는 `Refresh now` 링크를 제공한다.
- 마지막 갱신이 2분 이상 지났으면 `Data may be stale` 배지를 표시한다.
- 별도 실시간 프레임워크를 추가하지 않는다.

## 6. 권장 화면 구성

새 route나 새 차트 라이브러리 없이 현재 컴포넌트와 네이티브 `<details>`만으로 다음처럼 재구성하는 것이 가장 효율적이다.

### A. Header

- H1 `Partner Operations`
- `Current as of 20:39 · Vietnam time`
- `Refresh now`
- 데이터 stale/partial 경고가 있을 때만 배지

### B. Action required

0건 카드는 숨기고 실제 행동이 필요한 항목만 표시한다.

- Online but not bookable: 187
- Negative wallet settlement: 124
- Pending verification: 147
- Quality follow-up: 해당 기간 실제 품질 predicate 수

각 카드에는 Count보다 `Oldest`, `Impact`, `Next action`을 함께 둔다.

### C. Current supply

- Bookable now
- Online available
- Busy/in service
- Offline
- Customer app visible now
- Blockers: stale location, no service, documents, account

은행 승인은 여기서 제외하고 Finance로 이동한다.

### D. Performance · selected period

여기에만 Today / 7 / 30 / 90 days를 둔다.

- Completed outcomes
- Non-completed outcomes
- Join-to-response time
- Review count / selected-period rating
- 선택 전환 이슈

### E. Details

기본 접힘:

- Supply by area
- Supply by service
- App telemetry
- Booking quality
- Finance and wallet
- Selection friction
- All action queues

## 7. 권장 문구 표

| 현재 | 권장 |
|---|---|
| Partner Overview | Partner Operations |
| Partner supply range | Partner filters / Performance period |
| Ready now (area/service) | Online available |
| Ready now (actual gate) | Bookable now |
| Location <= 90m | Fresh location: last 90 min |
| Bank approval missing (visibility) | 제거 후 Finance의 Payout bank not approved |
| Partner Cancellation Rate | Non-completed booking rate |
| Needs event | No events in this period |
| Inactive 7D | No operational activity in 7D |
| Inactive 7D+ (app) | App telemetry inactive 7D+ |
| Not Tracked Yet | No app telemetry recorded |
| Avg rating (service) | Lifetime Partner rating |
| Healthy with no demand | No demand data |
| Open queue | Review {count} / Review oldest |
| Available now + Not eligible now | Online available + Not bookable |

## 8. 구현 우선순위

### 1차 — 운영 오판 차단

1. 은행 승인 공개 노출 게이트 제거 및 Finance로 이동.
2. Ready now 용어 분리.
3. Partner Cancellation Rate 명칭/계산 계약 수정.
4. 품질 목록 predicate와 action 분리.
5. Current vs selected period scope 표시.

### 2차 — 읽을 수 있는 화면 만들기

1. 운영 카드 공통 grid 레이아웃 재사용.
2. Quality/Finance와 Area/Service를 전체 폭으로 쌓기.
3. 720px CSS cascade 수정.
4. 금액 KPI를 3열 이하로 제한.
5. Selection 표 열 축소 및 Action 우선 배치.

### 3차 — 운영 효율

1. 0건 카드·큐 축약.
2. Oldest/SLA/Owner 추가.
3. 텔레메트리 coverage 표시.
4. 고유 table aria-label과 sticky identity/action 열.
5. refresh/stale 상태 제공.

## 9. 테스트 및 인수 기준

현재 실행 결과:

- Admin Web: Partner Overview 관련 2개 파일, 18 tests passed.
- API: `partner overview` 대상 6 tests passed, 530 skipped.

기존 테스트가 통과하지만 이번 문제를 잡지 못한 이유:

- CSS selector 존재 여부와 서버 마크업 문자열 중심이며 실제 1440/1024/720 레이아웃을 검증하지 않는다.
- `Ready now` 두 계산의 용어 동일성, 은행 공개 노출 정책, 품질 row predicate, 취소 actor 계약을 검증하지 않는다.

필수 추가 검증:

- 은행 계좌 없는 승인 Partner가 공개 목록에 포함되는 API 계약 테스트.
- 음수 지갑 Partner가 공개/참여 가능하지만 최종 승인·서비스 시작·지급 해제는 차단되는 계약 테스트.
- Area/Service `Online available`와 전체 `Bookable now`가 서로 다른 필드로 노출되는 테스트.
- 품질 표 모든 row가 실제 품질 근거를 갖는 테스트.
- 취소 actor 미상 상태에서 `Partner-caused` 문구가 나오지 않는 테스트.
- 분모 0일 때 KPI/delta가 `No events`인 테스트.
- 1440, 1024, 720 브라우저 확인: 텍스트·금액 겹침 없음, Quality/Finance 720에서 1열, 핵심 Action이 첫 화면에 보임.
- Today, 7d, 30d, 90d와 Negative wallet 필터 smoke 확인.

## 10. 캡처 기록

| 단계 | 상태 | 설명 | 파일 |
|---:|---|---|---|
| 1 | 정상 | 1440 Today 상단·필터 | `01-overview-top-1440.png` |
| 2 | 정상 | 1440 운영 우선순위 카드 | `02-operations-priority-1440.png` |
| 3 | 정상 | 1440 운영 상태 카드 | `03-operating-status-top-1440.png` |
| 4 | 정상 | 고객 앱 노출·blocking signals·기간 KPI | `04-operating-status-signals-1440.png` |
| 5 | 정상 | Area/Service 표 왼쪽 | `05-area-service-supply-1440.png` |
| 6 | 정상 | Area/Service 표 오른쪽 스크롤 | `06-area-service-supply-right-1440.png` |
| 7 | 정상 | Readiness funnel·App activity | `07-readiness-funnel-1440.png` |
| 8 | 정상 | App inactive/not tracked와 risk 진입부 | `08-app-activity-queues-1440.png` |
| 9 | 정상 | Today Quality/Finance | `09-quality-wallet-risk-1440.png` |
| 10 | 정상 | Today Selection friction·큐 진입부 | `10-selection-friction-1440.png` |
| 11 | 제외 | 첫 큐 캡처 중 transient layout 이동 확인, 증거로 사용하지 않음 | `11-detailed-action-queues-1440.png` |
| 12 | 정상 | 1024 상단·필터 | `12-overview-top-1024.png` |
| 13 | 정상 | 1024 운영 상태 | `13-operating-status-1024.png` |
| 14 | 정상 | 1024 Area/Service | `14-supply-tables-1024.png` |
| 15 | 정상 | 720 상단·필터 | `15-overview-top-720.png` |
| 16 | 정상 | 720 운영 상태 | `16-operating-status-720.png` |
| 17 | 정상 | 720 Quality/Finance 2열 충돌 | `17-quality-wallet-risk-720.png` |
| 18 | 정상 | 1440 7일 기간 상태 | `18-overview-top-7d-1440.png` |
| 19 | 정상 | 7일 Selection populated state | `19-selection-friction-7d-1440.png` |
| 20 | 정상 | 7일 Quality/Finance populated state | `20-quality-wallet-risk-7d-1440.png` |
| 21 | 정상 | Negative wallet 활성 필터 | `21-negative-wallet-filter-1440.png` |
| 22 | 정상 | 상세 큐 안정 상태 재검증 | `22-detailed-action-queues-verify-1440.png` |

## 11. 전체 시각 증거

### 상단과 우선순위

![1440 Today 상단](./01-overview-top-1440.png)

![1440 운영 우선순위](./02-operations-priority-1440.png)

### 운영 상태와 blocker

![1440 운영 상태](./03-operating-status-top-1440.png)

![1440 고객 앱 노출과 blocking signals](./04-operating-status-signals-1440.png)

### 지역·서비스 공급

![Area Service 왼쪽](./05-area-service-supply-1440.png)

![Area Service 오른쪽 스크롤](./06-area-service-supply-right-1440.png)

### Readiness와 앱 활동

![Readiness funnel과 앱 활동](./07-readiness-funnel-1440.png)

![App inactive와 risk 진입부](./08-app-activity-queues-1440.png)

### 품질·Finance·Selection·Queue

![Today 품질과 Finance](./09-quality-wallet-risk-1440.png)

![Today Selection friction](./10-selection-friction-1440.png)

![상세 액션 큐 안정 상태](./22-detailed-action-queues-verify-1440.png)

### 1024 반응형

![1024 상단](./12-overview-top-1024.png)

![1024 운영 상태](./13-operating-status-1024.png)

![1024 공급 표](./14-supply-tables-1024.png)

### 720 반응형

![720 상단](./15-overview-top-720.png)

![720 운영 상태](./16-operating-status-720.png)

![720 품질과 Finance](./17-quality-wallet-risk-720.png)

### 기간과 필터 상태

![7일 상단](./18-overview-top-7d-1440.png)

![7일 Selection friction](./19-selection-friction-7d-1440.png)

![7일 품질과 Finance](./20-quality-wallet-risk-7d-1440.png)

![Negative wallet 활성 필터](./21-negative-wallet-filter-1440.png)

## 12. 감사 한계

- 로컬 로그인 상태와 2026-08-06 시점 데이터만 확인했다.
- Today/7/30/90과 Negative wallet 필터는 확인했지만 모든 필터 조합을 전수 검사하지 않았다.
- 실제 운영자의 권한별 차이, 프로덕션 데이터량, 네트워크 지연, 다크 모드는 이번 범위에 포함하지 않았다.
- 애플리케이션 코드는 변경하지 않았다. 따라서 위 문제들은 그대로 존재한다.

