# HANDS Admin 파트너 작업 큐 3종 심층 감사

- 감사일: 2026-08-06 (Asia/Bangkok)
- 대상:
  - `/partners?review=approval-pending&sort=oldest`
  - `/partners?review=unapproved`
  - `/partners?review=unsettled`
- 관점: 프로그래머가 아니라 실제 운영자가 “누구를, 왜, 언제까지, 무엇을 해야 하는가”를 빠르고 정확하게 판단할 수 있는가
- 방법: 로그인된 실제 화면을 1440px·1024px·720px 폭에서 직접 조작·캡처하고, URL 상태·필터·정렬·가로 스크롤·빈 상태를 확인한 뒤 화면을 만드는 Admin Web/API 코드를 역추적했다.
- 변경 범위: 앱 코드는 수정하지 않았다. 이 문서와 감사 캡처만 생성했다.

## 1. 결론

세 화면은 외형적으로 정돈됐지만, 현재 상태를 운영용 큐로 신뢰하기에는 위험하다. 가장 큰 문제는 디자인보다 **운영 데이터 계약과 작업 모델**이다.

1. `Unapproved Partners`에서 전체 148명으로 보이던 집합이 `Bookings` 정렬을 누르면 25명으로 줄어든다.
2. `Unsettled Partners`에서 전체 124명으로 보이던 집합이 `Wallet debt` 정렬을 누르면 17명으로 줄어든다.
3. 정산 큐 안에 `0 VND / No negative balance` 행이 반복 노출된다. “음수 지갑 대상” 판정과 화면의 지갑 금액이 서로 다른 원장을 사용하기 때문이다.
4. 승인 대기 큐는 0명인데 미승인 화면은 148명을 `approval candidates`라고 부른다. “지금 결정할 제출 건”과 “온보딩이 미완료됐거나 보류된 계정”의 의미가 섞였다.
5. 필터·정렬·열 구성은 세 업무의 목적과 무관하게 거의 동일하다. 운영자는 명단을 볼 수 있지만, 우선순위와 다음 행동을 판단하려면 상세페이지를 반복해서 열어야 한다.
6. 1024px와 720px에서는 표의 오른쪽을 보기 위해 파트너 이름을 잃는다. 정산 금액의 음수 부호까지 잘릴 수 있어 금전 업무에는 특히 위험하다.

따라서 우선순위는 “더 예쁜 화면”이 아니라 다음 순서가 맞다.

> **P0 데이터 정확성 → P0 큐 의미 분리 → P1 업무별 필터/열/행동 → P1 반응형·접근성 → P2 문구·시각 정돈**

## 2. 운영자가 이 화면에서 달성해야 할 목표

### 목표 A — 승인 결정

- 제출된 건 중 가장 오래 기다린 건을 찾는다.
- 어떤 증빙이 부족하거나 위험한지 확인한다.
- 승인 또는 보완 요청을 하고 다음 건으로 이동한다.
- SLA 초과와 담당자를 놓치지 않는다.

### 목표 B — 온보딩 장애 해소

- 아직 운영할 수 없는 파트너를 단계별로 분류한다.
- 가장 큰 차단 사유와 마지막 파트너 활동을 확인한다.
- 운영자가 처리할 건과 파트너가 보완할 건을 분리한다.
- 담당자를 지정하고 재촉·보류·검토 행동을 수행한다.

### 목표 C — 지갑 채무 회수/해결

- 실제 음수 지갑인 파트너만 본다.
- 채무 금액과 발생 시점, 원인이 된 거래를 확인한다.
- 지급·출금·서비스 제한 상태를 확인한다.
- 회수, 부분 납부, 이의 제기, 해소 완료 상태를 기록한다.

현재 화면은 세 목표 모두에서 “누가 목록에 있는가”는 일부 보여주지만, “왜 지금 처리해야 하는가”와 “무슨 행동을 해야 하는가”가 약하다.

## 3. 확인된 장점

- 페이지 제목과 큰 섹션 제목의 계층이 명확하다.
- 승인 대기 0건일 때 빈 상태 문구와 다음 경로가 있다.
- 상태 배지는 색상뿐 아니라 텍스트도 함께 사용한다.
- 검색·select·표 같은 기본 시맨틱 구조가 존재한다.
- 720px에서 헤더와 상단 탭은 줄바꿈 없이 비교적 안정적으로 재배치된다.
- 승인 대기 표가 실제로 나타날 때는 `Submitted / Age`, `Review state`, `Missing / blocked`, `Review`처럼 승인 업무에 가까운 전용 열이 이미 구현돼 있다.
- URL에 필터 상태를 보존하는 기반과 CSV 내보내기 기반이 있다.

이 기반은 재사용할 수 있다. 새 프레임워크나 대규모 컴포넌트 재작성은 필요하지 않다.

## 4. 캡처별 검사 기록

상태 표기:

- **양호**: 운영 목표를 방해하는 뚜렷한 문제 없음
- **주의**: 이해 가능하지만 혼동·누락이 있음
- **높음**: 작업 속도나 정확성을 크게 떨어뜨림
- **치명적**: 잘못된 의사결정·누락·금전 오류 가능성

| # | 화면/조작 | 상태 | 핵심 확인 |
|---:|---|---|---|
| 1 | 승인 대기 빈 상태, 1440px | 주의 | 빈 상태는 좋지만 `Partners` 탭이 활성화돼 현재 위치가 충돌함 |
| 2 | 미승인 상단, 1440px | 높음 | 업무와 무관한 공용 필터/정렬이 화면의 대부분을 차지함 |
| 3 | 미승인 표 왼쪽, 1440px | 높음 | 정확한 차단 사유 대신 `7 approval needs` 같은 개수만 제공 |
| 4 | 미승인 표 오른쪽/하단 | 치명적 | 오른쪽 열을 보면 파트너 이름이 잘리고 내부 세로·가로 스크롤이 중첩됨 |
| 5 | 미정산 상단, 1440px | 높음 | 정산 큐에도 앱 활동·KYC·일반 레코드 정렬이 그대로 노출됨 |
| 6 | 미정산 표 왼쪽, 1440px | 치명적 | 음수 지갑 큐에 `0 VND / No negative balance`가 반복 노출됨 |
| 7 | 미정산 표 오른쪽/하단 | 치명적 | 금액·지급 상태를 볼 때 파트너 신원을 잃음 |
| 8 | 미정산 필터 적용 | 높음 | 부가 쿼리가 붙자 사이드바/브레드크럼 현재 위치가 `Partners`로 퇴행함 |
| 9 | 미정산 `Wallet debt` 정렬 | 치명적 | 전체 124명 표시가 17명으로 바뀌어 전역 정렬처럼 보이는 부분집합 정렬임 |
| 10 | 미승인 `Bookings` 정렬 | 치명적 | 전체 148명 표시가 25명으로 바뀌어 후보 누락 가능성이 생김 |
| 11 | 승인 대기 빈 상태, 1024px | 주의 | 콘텐츠는 읽히지만 승인 탭 부재와 데이터 신선도 부재가 유지됨 |
| 12 | 미승인 상단, 1024px | 높음 | 설명이 좁게 줄바꿈되고 필터 카드 자체 스크롤이 생김 |
| 13 | 미승인 표, 1024px | 치명적 | Partner/Gender/Approval needs와 KYC 일부만 보여 실제 행동 정보가 가려짐 |
| 14 | 미정산 표, 1024px | 치명적 | 주요 오른쪽 열이 모두 숨고 0 VND 대상은 계속 노출됨 |
| 15 | 승인 대기 빈 상태, 720px | 주의 | 레이아웃은 안정적이나 잘못 활성화된 `Partners` 탭이 더 두드러짐 |
| 16 | 미승인 상단, 720px | 높음 | 필터와 정렬을 통과해야 표에 도달하며 한 화면의 정보 밀도가 낮음 |
| 17 | 미승인 표, 720px | 치명적 | 파트너·성별·개수 중심으로 보이고 실제 검토·행동 정보는 화면 밖임 |
| 18 | 미정산 표 왼쪽, 720px | 치명적 | 신원은 보이나 채무 원인·발생일·행동이 없고 0 VND 행이 섞임 |
| 19 | 미정산 표 오른쪽, 720px | 치명적 | 신원을 잃고 금액 음수 부호/앞자리까지 잘릴 수 있음 |

### 캡처 1 — 승인 대기 빈 상태, 1440px

![승인 대기 빈 상태 1440](./01-approvals-empty-1440.png)

### 캡처 2 — 미승인 상단, 1440px

![미승인 상단 1440](./02-unapproved-top-1440.png)

### 캡처 3 — 미승인 표 왼쪽, 1440px

![미승인 표 왼쪽 1440](./03-unapproved-table-1440.png)

### 캡처 4 — 미승인 표 오른쪽/하단

![미승인 표 오른쪽 하단 1440](./04-unapproved-table-right-bottom-1440.png)

### 캡처 5 — 미정산 상단, 1440px

![미정산 상단 1440](./05-unsettled-top-1440.png)

### 캡처 6 — 미정산 표 왼쪽, 1440px

![미정산 표 왼쪽 1440](./06-unsettled-table-1440.png)

### 캡처 7 — 미정산 표 오른쪽/하단

![미정산 표 오른쪽 하단 1440](./07-unsettled-table-right-bottom-1440.png)

### 캡처 8 — 미정산 필터 적용

![미정산 필터 적용 1440](./08-unsettled-filtered-1440.png)

### 캡처 9 — Wallet debt 정렬 시 전체 수 불일치

![미정산 지갑 채무 정렬 불일치](./09-unsettled-wallet-sort-mismatch-1440.png)

### 캡처 10 — Bookings 정렬 시 전체 수 불일치

![미승인 예약 수 정렬 불일치](./10-unapproved-booking-sort-mismatch-1440.png)

### 캡처 11 — 승인 대기 빈 상태, 1024px

![승인 대기 빈 상태 1024](./11-approvals-empty-1024.png)

### 캡처 12 — 미승인 상단, 1024px

![미승인 상단 1024](./12-unapproved-top-1024.png)

### 캡처 13 — 미승인 표, 1024px

![미승인 표 1024](./13-unapproved-table-1024.png)

### 캡처 14 — 미정산 표, 1024px

![미정산 표 1024](./14-unsettled-table-1024.png)

### 캡처 15 — 승인 대기 빈 상태, 720px

![승인 대기 빈 상태 720](./15-approvals-empty-720.png)

### 캡처 16 — 미승인 상단, 720px

![미승인 상단 720](./16-unapproved-top-720.png)

### 캡처 17 — 미승인 표, 720px

![미승인 표 720](./17-unapproved-table-720.png)

### 캡처 18 — 미정산 표 왼쪽, 720px

![미정산 표 왼쪽 720](./18-unsettled-table-720.png)

### 캡처 19 — 미정산 표 오른쪽, 720px

![미정산 표 오른쪽 720](./19-unsettled-table-right-720.png)

## 5. 페이지별 상세 감사

## 5.1 Partner approvals — 승인 결정 큐

### 현재 화면이 잘한 점

- `Submitted verification or KYC records waiting for an admin decision.`은 큐의 의미를 비교적 정확히 설명한다.
- 빈 상태의 `Approval queue is clear`와 `0 awaiting decision`은 긍정적 완료 상태를 명확히 전달한다.
- `View held / rejected`, `Open partner directory`로 다음 업무로 이동할 수 있다.
- 실제 행이 있을 때 사용하는 표 열은 세 큐 중 가장 업무 중심적이다.

### 불필요하거나 혼란스러운 요소

1. **상단 탭의 `Partners` 활성 상태**
   - 사이드바와 브레드크럼은 `Partner Approvals`인데 상단 탭은 `Partners`가 활성화된다.
   - 한 화면에 세 개의 위치 표시가 서로 다른 말을 한다.
   - 원인: `partnerPrimaryListMode()`가 `approval-pending`을 별도 모드로 취급하지 않고 기본 `partners`를 반환한다.

2. **승인 탭 자체가 없음**
   - 상단 탭은 `Partners / Unapproved Partners / Unsettled Partners`뿐이다.
   - 승인 큐는 사이드바에는 1급 메뉴인데 페이지 내부에서는 일반 Partners의 하위 필터처럼 보인다.

3. **0건일 때 필터 보드 전체 제거**
   - 빈 상태를 간결하게 만드는 장점은 있다.
   - 그러나 필터가 적용된 0건 상태에서도 운영자는 현재 조건을 편집할 수 없고, 모두 초기화하는 경로만 사용해야 한다.
   - `page.tsx`에서 `approval-pending`이고 total이 0이면 필터 보드를 렌더링하지 않는다.

### 운영자가 보기 어려운 점

- 마지막으로 데이터가 갱신된 시각이 없다.
- 새 제출을 기다릴 때 수동 새로고침 또는 재시도 수단이 없다.
- SLA 기준 시간이 빈 상태에서는 보이지 않는다.
- 큐가 0이라는 사실이 “실시간으로 조회 완료된 0”인지 “API 실패의 fallback 0”인지 구분되지 않는다. `adminGet(..., { totalCount: 0 })` fallback이 시각적으로 성공한 0과 동일하게 보일 수 있다.

### 반드시 추가/수정해야 할 것

- 상단 1차 탭을 `Directory / Approvals / Onboarding blockers / Wallet debt`로 통일한다.
- 승인 화면에서는 `Approvals`가 항상 활성화돼야 한다.
- 빈 상태에 `Last checked 16:02`, `Refresh`를 제공한다.
- 요청 실패는 빈 상태가 아니라 오류/재시도 상태로 분리한다.
- 필터가 적용된 0건이면 현재 필터 칩과 `조건 수정`, `모두 초기화`를 유지한다.
- 행이 있을 때는 현재 전용 열을 유지하되 `Owner`, `SLA due`, `Approve / Request changes` 빠른 행동을 추가한다.

### 권장 화면 구성

1. 제목: `Partner approvals`
2. 보조 정보: `0 awaiting decision · Last checked 16:02 · SLA 24h`
3. 전용 필터: `Waiting age / Missing evidence / Risk / Owner`
4. 빈 상태 또는 표
5. 빈 상태 행동: `Refresh`, `View onboarding blockers`, `Open directory`

## 5.2 Unapproved Partners — 실제로는 온보딩 장애 큐

### 현재 의미의 문제

`Unapproved Partners` 148명은 “지금 운영자가 승인 결정을 내려야 하는 제출 건”이 아니다. API 조건에는 다음이 모두 포함된다.

- 차단된 계정
- verification이 없거나 승인되지 않은 계정
- KYC가 없거나 승인되지 않은 계정
- 검토 대기/거절 문서가 있는 계정
- 필수 문서가 없는 계정

따라서 `approval candidates`라는 배지는 오해를 만든다. 이 목록은 **Onboarding blockers** 또는 **Held & incomplete partners**가 더 정확하다.

### 불필요한 요소

1. `Gender` 열
   - 대부분 `Not saved`이고 승인 판단의 우선순위를 만들지 못한다.
   - 제한된 화면 폭을 사용하면서 더 중요한 `Blocker`, `Waiting age`, `Owner`, `Action`을 밀어낸다.

2. 공용 필터의 `State / App activity / Verification / KYC`
   - 일부는 보조 조사에 유용하지만 첫 화면의 핵심 필터가 아니다.
   - 가장 중요한 질문은 “어느 단계에서, 무엇 때문에, 누구의 행동을 기다리는가”다.

3. 8개의 공용 정렬
   - `Last work`, `Bookings`, `Completed`, `Revenue`, `Wallet debt`는 온보딩 장애 해결 우선순위와 직접 관련이 없다.
   - 첫 진입 화면에서 많은 선택지를 제공하지만 실제로 가장 오래된 차단 건이나 가장 해결 가능한 건을 찾기 어렵다.

4. `Checklist`와 `Newest first`의 동시 활성 표현
   - 하나는 작업 우선순위, 하나는 시간 방향인데 같은 영역에서 두 개가 선택된 것처럼 보인다.
   - `Ready now / Records sort`라는 이름도 현재 큐와 맞지 않는다.

### 운영자가 보기 어려운 점

1. **차단 사유가 개수뿐임**
   - `7 approval needs`, `10 approval needs`는 복잡도만 말하고 다음 행동을 말하지 않는다.
   - 운영자는 상세 화면을 열기 전에는 `KYC 누락`, `신분증 반려`, `프로필 사진 없음` 같은 상위 원인을 알 수 없다.

2. **상태와 단계가 섞임**
   - `KYC / Level`, `Access`, `Location`, `Account`가 흩어져 있지만 현재 온보딩 단계가 없다.
   - “파트너가 제출해야 함”, “운영자 검토 대기”, “보완 요청 후 회신 대기”, “계정 보류”가 분리되지 않는다.

3. **작업 소유자와 마지막 행동이 없음**
   - 누가 담당하는지, 마지막 연락/보완 요청이 언제였는지, 다음 팔로업 시점이 언제인지 없다.

4. **테스트/감사 데이터처럼 보이는 행**
   - `Audit Cancellation Partner`, `Smoke Referral Claim Partner`, 숫자형 Partner가 실제 업무 목록과 섞인다.
   - 이름 추정으로 숨기지 말고 데이터 provenance 필드로 운영/테스트를 구분해야 한다.

5. **보조 문구의 의미가 불명확함**
   - `Not saved · An Pham`은 앞부분이 성별인지 법적 이름인지 라벨이 없다.
   - 저장되지 않은 값과 표시 이름을 한 줄에 합쳐 정보 해석 비용이 커진다.

### 반응형/접근성 문제

- 표는 CSS에서 기본 `min-width: 1440px`이며 첫 번째 Partner 열도 sticky가 아니다.
- 1024px에서는 Partner/Gender/Approval needs와 KYC 일부만 보인다.
- 720px에서는 주요 행동 정보가 화면 밖이고, 오른쪽으로 이동하면 파트너 신원을 잃는다.
- 페이지 카드에 `max-height`와 `overflow-y:auto`가 적용돼 페이지 스크롤, 카드 스크롤, 표 가로 스크롤이 중첩된다.
- 키보드 사용자는 두 축 스크롤 영역을 오가야 한다.
- 행 전체가 아니라 이름 링크만 사실상 상세 진입점이며 명시적인 `Review blockers` 행동이 없다.

### 반드시 추가/수정해야 할 것

- 명칭을 `Onboarding blockers`로 변경한다.
- 배지는 `148 partners blocked from onboarding`처럼 정확하게 쓴다.
- 기본 열을 다음 6개로 줄인다.

| 열 | 내용 |
|---|---|
| Partner | 이름, ID, 연락 가능 상태 |
| Stage | Registration / Verification / KYC / Documents / Hold |
| Top blockers | 가장 중요한 1~2개 원인, 나머지는 `+N` |
| Waiting | 해당 차단 상태가 시작된 시각과 경과 시간 |
| Owner | 담당자, 미배정 표시 |
| Action | Review blockers / Contact partner / Assign |

- `Gender`, `Location`, 일반 `Revenue/Bookings` 정렬은 기본 큐에서 제거하고 상세/보조 패널로 이동한다.
- 전용 필터를 `Stage / Blocker / Waiting for / Owner / Age`로 바꾼다.
- 기본 정렬은 `Oldest actionable first` 하나로 시작한다.
- 빠른 프리셋은 `Needs admin review`, `Waiting on partner`, `Returned for correction`, `Held` 정도로 제한한다.
- `Clear filters`는 `/partners`가 아니라 `/partners?review=unapproved`를 유지해야 한다.

## 5.3 Unsettled Partners — 지갑 채무 해결 큐

### 가장 심각한 데이터 오류

화면은 “negative wallet balance” 파트너만 보여준다고 설명하지만 `Smoke Partner` 같은 행이 `0 VND / No negative balance`로 반복 표시된다.

원인은 다음 두 소스가 다르기 때문이다.

- 큐 포함 조건: `walletBalanceSummaries.balance < 0`
- 화면 표시 금액: payout되지 않은 `ProviderEarning`의 `PENDING/AVAILABLE netAmount` 합계

즉 한 원장에서 음수로 판정된 파트너에게 다른 원장의 0을 표시한다. 운영자는 해당 파트너가 채무 대상인지 판단할 수 없다.

### 불필요하거나 중복된 요소

1. `State`, `Work`, `Revenue`
   - 참고 정보일 수는 있지만 채무 회수의 첫 판단보다 우선하지 않는다.

2. `Wallet`과 `Payout`의 중복
   - Wallet 안에 이미 pending/available 금액이 있고 Payout 열이 이를 반복한다.

3. `Account`의 approval needs
   - 정산 큐의 목적과 온보딩 승인 요구가 한 셀에 섞인다.

4. 공용 정렬과 필터
   - `Checklist`, `Last work`, `Bookings`, `Completed`, `Revenue`, KYC 필터는 지갑 채무 처리 순서를 직접 만들지 않는다.

### 운영자가 보기 어려운 점

- 채무가 언제 처음 음수가 됐는지 없다.
- 채무를 만든 booking/ledger entry가 없다.
- 부분 납부·이의 제기·회수 약속·담당자·다음 후속일이 없다.
- 지급/출금 hold가 왜 걸렸는지 한눈에 보이지 않는다.
- 행별 `Open settlement`, `Record payment`, `Mark disputed` 행동이 없다.
- `124 settlement matchs`는 문법 오류이며 운영 단위도 모호하다.
- 모든 age가 `24h+`로 보이지만 이것은 채무 발생 시간이 아니라 ProviderProfile의 일반 수정 시각이다.

### 반응형/접근성 문제

- 720px에서 오른쪽으로 스크롤하면 파트너 신원을 완전히 잃는다.
- 가로 스크롤 경계에서 `-80,000 VND`의 음수 부호와 앞자리가 잘릴 수 있다.
- 금전 의미를 색에만 의존하지는 않지만, 핵심 부호가 시각적으로 잘리는 것은 별도의 심각한 위험이다.
- 현재 표는 한 행에 너무 많은 보조 수치를 넣어 읽는 순서가 일정하지 않다.

### 반드시 추가/수정해야 할 것

- 명칭을 `Wallet debt` 또는 `Partner wallet debt`로 변경한다.
- 필터·전체 수·행 표시·정렬·CSV 모두 같은 canonical wallet/ledger 소스를 사용한다.
- 기본 열을 다음 6개로 줄인다.

| 열 | 내용 |
|---|---|
| Partner | 이름, ID, 연락 가능 상태 |
| Debt | 현재 채무 금액, VND, 부호를 포함한 강조 |
| Debt since | 처음 음수가 된 시각, 경과 시간 |
| Cause | 최근 원인 booking/ledger entry, `+N` |
| Settlement | Unassigned / Contacted / Partial / Disputed / Promise due / Cleared |
| Action | Open settlement / Record payment |

- 전용 필터를 `Debt amount / Debt age / Settlement status / Payout hold / Withdrawal / Owner`로 바꾼다.
- 기본 정렬은 `Largest/oldest actionable debt`처럼 업무 규칙을 하나로 정의한다.
- 0 이상인 행은 절대 이 큐에 표시하지 않는다.
- 금액이 서로 다른 원장에서 불일치하면 조용히 하나를 선택하지 말고 `Balance mismatch` 오류 상태로 격리한다.
- `Clear filters`는 `/partners?review=unsettled`를 유지해야 한다.

## 6. 세 화면 공통 구조 문제

### 6.1 전체처럼 보이는 부분집합 정렬 — P0

현재 Admin Web은 서버가 직접 처리하지 못하는 정렬을 선택하면 최대 25명만 가져온 뒤 로컬에서 정렬한다.

- 서버 전역 처리: `ops-priority`, `name`, `oldest`
- 로컬 처리: `booking-count`, `completed-count`, `gross-revenue`, `wallet-debt` 등
- 로컬 hydration 상한: 25

화면에서 확인한 결과:

| 큐 | 기본 전체 | 정렬 후 표시 | 위험 |
|---|---:|---:|---|
| Onboarding blockers | 148 | 25 (`Bookings`) | 나머지 123명이 후보에서 누락된 것처럼 보임 |
| Wallet debt | 124 | 17 (`Wallet debt`) | 가장 큰/오래된 채무가 25명 밖에 있으면 찾을 수 없음 |

이것은 단순 표기 오류가 아니다. 운영자가 잘못된 우선순위로 일하고 CSV도 누락시킬 수 있는 데이터 정확성 결함이다.

**수정 원칙**

- 지원하는 정렬은 API/DB에서 전체 집합에 대해 수행한다.
- 당장 서버 전역 정렬을 구현하지 않을 정렬은 UI에서 제거한다.
- 어떠한 경우에도 25명 부분집합을 전체 큐처럼 표시하지 않는다.
- summary total과 row total은 같은 쿼리 계약에서 계산한다.

### 6.2 내비게이션이 쿼리 문자열 전체 일치에 의존 — P0/P1

`hrefMatchesPath()`는 query가 있는 메뉴에서 현재 search string 전체가 메뉴 href와 정확히 같아야 활성화한다.

- `/partners?review=unsettled`는 사이드바가 정상 활성화된다.
- `&providerStatus=...` 같은 필터가 붙으면 메뉴와 브레드크럼이 `Partners`로 퇴행한다.
- `/partners?review=unapproved`는 사이드바 항목 자체가 없다.

**수정 원칙**

- `/partners`에서는 `review`를 1차 mode key로 해석한다.
- `q`, `sort`, `age`, `providerStatus` 등은 현재 위치를 바꾸지 않는 secondary state다.
- 사이드바, 브레드크럼, 상단 탭이 하나의 resolver를 공유한다.

### 6.3 Queue age가 업무 시각이 아님 — P0

API는 세 큐의 age bucket과 승인 SLA를 `ProviderProfile.updatedAt`으로 계산한다. 이 필드는 프로필의 일반 수정 시각이지 다음 업무 시각이 아니다.

권장 기준:

| 큐 | 사용해야 할 기준 시각 |
|---|---|
| Approvals | 현재 활성 verification/KYC 제출 `submittedAt` |
| Onboarding blockers | 현재 차단 상태가 시작되거나 보완 요청된 시각 |
| Wallet debt | 잔액이 처음 음수가 된 ledger 시각 또는 아직 미해결인 최신 debt event |

canonical 시각이 없다면 `Queue age`를 보여주지 말고, 정확한 이벤트 모델을 만든 뒤 추가해야 한다.

### 6.4 CSV Export 범위가 모호하고 실제로 제한됨 — P0/P1

버튼은 단순히 `Export`라고 표시되지만 export route도 화면과 같은 pagination/hydration 경로를 사용한다.

- 서버 pagination이면 현재 페이지 행만 내보낼 수 있다.
- 로컬 정렬이면 최대 25명 부분집합만 내보낼 수 있다.
- 운영자는 `현재 10개`, `필터된 전체`, `전체 큐` 중 무엇을 받는지 알 수 없다.

**수정 원칙**

- 버튼을 `Export filtered queue (148)`처럼 범위와 건수를 표시한다.
- 기본은 필터된 전체 큐이며 서버 스트리밍/페이지 반복으로 완전한 결과를 생성한다.
- 현재 페이지만 필요하면 별도 메뉴로 명시한다.
- export의 total/rows/canonical balance가 화면과 동일함을 계약 테스트로 보장한다.

### 6.5 테스트/운영 데이터 provenance — P1

이름에 `Smoke`, `Audit`가 포함됐다는 이유로 숨기면 안 된다. 다음과 같은 명시적 필드가 필요하다.

- `dataOrigin: PRODUCTION | TEST | SEED | AUDIT`
- 기본 운영 큐는 `PRODUCTION`만 포함
- 권한이 있는 사용자가 `Include non-production data`를 명시적으로 켤 수 있음
- 행과 CSV에 provenance가 남음

### 6.6 표와 스크롤 구조 — P1

- `.partners-page > .card`가 viewport 기반 max-height와 자체 세로 스크롤을 가진다.
- 파트너 표는 `min-width: 1440px`다.
- 파트너 첫 열은 고객 표와 달리 sticky가 아니다.

권장 원칙:

- 페이지 세로 스크롤 하나만 유지한다.
- 목록 카드는 고정 max-height를 제거한다.
- 큐별로 열을 6개 이하로 줄여 1024px에서 가로 스크롤 없이 핵심 행동이 보이게 한다.
- 720px에서는 표를 억지로 유지하기보다 행 카드/2단 요약으로 전환해 `신원 → 핵심 상태 → 행동` 순서를 지킨다.
- 가로 스크롤이 불가피하면 Partner 열과 금액 열을 sticky 처리하고 음수 부호가 클리핑되지 않도록 한다.

## 7. 문구 개편안

| 현재 | 권장 | 이유 |
|---|---|---|
| Partners | Partner directory | 범용 명사보다 목적이 명확함 |
| Partner approvals | Partner approvals | 유지 가능 |
| Unapproved Partners | Onboarding blockers | 미승인·누락·보류를 모두 포괄함 |
| Unsettled Partners | Wallet debt | 운영자가 처리할 금융 문제를 직접 표현함 |
| Partner operations filters | Onboarding filters / Wallet debt filters | 큐 목적별로 구분 |
| Ready now / Records sort | Sort by | 현재 큐와 무관한 표현 제거 |
| Checklist | Operational priority | 실제 규칙이 전역·정확할 때만 사용 |
| Queue age | Waiting age / Debt age | 기준 사건을 명시 |
| 148 approval candidates | 148 partners with onboarding blockers | 승인 대기 큐와 혼동 제거 |
| 124 settlement matchs | 124 partners with wallet debt | 문법과 운영 단위를 동시에 수정 |
| 7 approval needs | KYC missing · ID rejected · +5 | 다음 행동을 알려줌 |
| Not saved · An Pham | Legal name: An Pham / Gender: Not provided | 라벨 없는 값 결합 제거 |
| Export | Export filtered queue (148) | 범위·건수 명시 |
| Clear filters | Reset onboarding filters | 현재 큐를 유지한다는 의미 명확화 |

## 8. 권장 정보 구조

```text
Partner Operations
├─ Directory
├─ Approvals                 제출 완료, 운영자 결정 대기
├─ Onboarding blockers       미제출·보완·보류·차단
└─ Wallet debt               음수 지갑·회수·이의 제기
```

세 화면은 같은 페이지에서 query mode로 유지해도 된다. 별도 URL 파일을 늘릴 필요는 없다. 중요한 것은 각 mode가 공유해야 할 것과 분리해야 할 것을 명확히 하는 것이다.

공유할 것:

- 페이지 shell
- 검색
- pagination
- 기본 table/card primitives
- URL state serializer

분리할 것:

- 제목·설명·빈 상태
- canonical data contract
- filter schema
- sort schema
- queue timestamp
- table columns
- row actions
- export columns

## 9. 우선순위별 수정 요구사항

## P0 — 배포 전에 정확성 보장

1. 모든 노출 정렬을 전체 서버 집합에서 수행하거나 UI에서 제거한다.
2. `PARTNER_LOCAL_FILTER_HYDRATION_LIMIT = 25` 경로를 전체 큐처럼 표시하지 않는다.
3. Wallet debt 포함 조건·표시 금액·정렬·합계·CSV를 하나의 canonical balance로 통일한다.
4. 정산 큐에서 0 이상 금액을 배제하고 mismatch를 오류 상태로 격리한다.
5. 큐 age/SLA를 업무 이벤트 시각으로 교체한다.
6. 승인/온보딩/지갑 채무의 의미와 건수를 분리한다.
7. filtered export가 전체 결과를 내보내고 건수를 검증한다.
8. API 오류 fallback 0과 실제 0건 빈 상태를 구분한다.

## P1 — 운영 효율과 반응형 개선

1. 4개 1차 탭과 공통 mode resolver를 만든다.
2. secondary query가 붙어도 사이드바/브레드크럼 활성 상태를 유지한다.
3. 큐별 전용 필터·정렬·열을 적용한다.
4. 각 행에 명시적인 primary action을 둔다.
5. Owner, waiting/debt age, next action을 목록에서 본다.
6. Clear filters가 현재 queue mode를 유지한다.
7. 중첩 세로 스크롤과 1440px 고정 표 폭을 제거한다.
8. 720px에서는 카드형 행으로 전환하고 신원과 행동을 항상 유지한다.
9. production/test provenance를 명시적으로 분리한다.

## P2 — 문구와 시각 정돈

1. `Unapproved`, `Unsettled`, `matchs`, `candidate` 문구를 운영 용어로 교체한다.
2. 라벨 없는 `Not saved · ...` 조합을 제거한다.
3. 1024px에서 제목 설명의 최대 폭과 빈 공간 균형을 조정한다.
4. 빈 상태에 last checked와 refresh를 추가한다.
5. 위험 금액·SLA·담당자 미배정을 일관된 배지 체계로 정리한다.

## 10. 코드 근거와 최소 수정 지점

| 문제 | 코드 근거 | 권장 수정 지점 |
|---|---|---|
| 승인 화면에서 Partners 탭 활성 | `partner-review-mode.ts:29-35` | `PartnerPrimaryListMode`에 approval 추가 |
| 승인 탭 없음 | `partner-primary-list-tabs.tsx:8-16` | 기존 탭 배열에 Approvals 추가 및 이름 개편 |
| 0건에서 필터 숨김 | `partners/page.tsx:283-297` | filtered empty와 true empty 분기 |
| 25명만 로컬 정렬 | `partner-filters.ts:79-86, 822-823, 903` | unsupported sort 제거 또는 API 전역 정렬 |
| 전체/표 수 불일치 | `partners/page.tsx:112-125` | rows와 summary를 동일 쿼리 계약으로 묶기 |
| Wallet debt 표시 소스 불일치 | `admin.service.ts:10879-10890`, `28136-28190` | wallet summary/ledger를 반환해 동일 값 사용 |
| directory select에 canonical wallet 없음 | `admin-provider-profile-selects.ts:620-684` | 필요한 최소 wallet summary 필드 추가 |
| age/SLA가 profile updatedAt | `admin.service.ts:10754-10768, 10804-10839, 36157-36162` | mode별 event timestamp 쿼리 |
| 미승인/정산 공용 필터 | `partner-filter-board.tsx:66-228` | mode별 filter config/분기 |
| Clear가 디렉터리로 이탈 | `partner-filter-board.tsx:74-82` | 현재 review 보존 href 사용 |
| 중복/저가치 열 | `partner-master-list-section.tsx:39-77, 150-174` | mode별 6열 업무 테이블 |
| 명시적 행 행동 없음 | `partner-master-list-section.tsx:150-174` | 큐별 마지막 Action 열 |
| naive 상태 라벨 | `partner-master-list-section.tsx:493-507` | 운영 단위 문구 직접 지정 |
| query 전체 일치 내비게이션 | `admin-nav-match.ts:1-17` | partners review mode 기준 resolver |
| 중첩 세로 스크롤 | `globals.css:5710-5717` | direct card max-height/overflow 예외 제거 |
| 1440px 표 최소 폭 | `globals.css:19240-19249` | 큐별 폭과 반응형 행 구성 |
| Partner 열 비고정 | `globals.css:19290-19294` | 필요한 경우 sticky, 모바일은 카드형 |
| CSV도 pagination 적용 | `api/admin/partners/export/route.ts:49-69` | filtered 전체 export 전용 경로 |

최소 구현 원칙은 새 추상화를 크게 만드는 것이 아니라, 이미 있는 `review mode`, 필터 빌더, 전용 표 헤더 분기를 확장하고 서버 쿼리 계약을 바로잡는 것이다.

## 11. 인수 조건

### 데이터 계약

- [ ] 어떤 정렬을 눌러도 같은 필터 집합의 total은 변하지 않는다.
- [ ] `Unapproved 148`에서 정렬 후에도 total은 148이다.
- [ ] `Wallet debt 124`에서 정렬 후에도 total은 124다.
- [ ] Wallet debt의 모든 행은 canonical balance가 `< 0`이다.
- [ ] 표·요약·CSV의 balance와 total이 일치한다.
- [ ] API 실패는 0건 빈 상태로 보이지 않는다.

### 승인 큐

- [ ] Approvals 탭·사이드바·브레드크럼이 동시에 활성화된다.
- [ ] 빈 상태에서 last checked와 refresh가 보인다.
- [ ] 필터 적용 0건에서 현재 필터를 수정할 수 있다.
- [ ] 표에 submitted age, SLA, owner, decision action이 있다.

### 온보딩 장애 큐

- [ ] `Onboarding blockers`라는 명칭과 정의를 사용한다.
- [ ] Stage, top blockers, waiting age, owner, action이 첫 화면에 보인다.
- [ ] Gender/Revenue/Wallet debt 정렬이 기본 업무 영역에서 제거된다.
- [ ] 필터 초기화 후에도 onboarding queue에 남는다.

### 지갑 채무 큐

- [ ] Debt amount, debt since, cause, status, owner, action이 첫 화면에 보인다.
- [ ] `0 VND` 또는 양수 행이 없다.
- [ ] 채무 부호와 금액은 720px에서도 잘리지 않는다.
- [ ] 필터 초기화 후에도 wallet debt queue에 남는다.

### 반응형/접근성

- [ ] 1440px·1024px·720px 모두 파트너 신원과 primary action을 동시에 볼 수 있다.
- [ ] 페이지 세로 스크롤과 카드 세로 스크롤이 중첩되지 않는다.
- [ ] 200% 확대에서도 핵심 정보와 행동이 손실되지 않는다.
- [ ] 키보드만으로 filter → row → primary action → pagination 순서가 자연스럽다.
- [ ] 스크린리더에서 queue title, total, filter state, row action이 구분된다.
- [ ] 색상 없이도 debt, overdue, blocked 의미를 이해할 수 있다.

## 12. 권장 테스트 추가

현재 실행 결과는 Admin Web 135개, API partner directory 17개가 모두 통과했다. 그러나 다음 계약을 검증하지 않아 실제 화면 결함을 놓친다.

1. 30명 이상 fixture에서 모든 노출 정렬의 total 보존 테스트
2. `summary.totalCount === paginatedRows.totalRows` 계약 테스트
3. wallet summary 음수이지만 earning 합계 0인 fixture의 canonical balance 테스트
4. wallet debt export가 필터된 전체 행을 포함하는 테스트
5. approval/unapproved/unsettled에 secondary query를 붙인 nav active 테스트
6. clear filter href가 현재 review를 보존하는 테스트
7. 큐별 timestamp source 테스트
8. API 실패와 empty result UI 분리 테스트
9. 720px에서 Partner/Amount/Action 가시성을 확인하는 브라우저 테스트

실행한 검증:

```text
Admin Web: 11 test files passed, 135 tests passed
API:       1 test file passed, 17 tests passed, 519 skipped
```

## 13. 감사 한계

- 로그인된 현재 로컬 데이터와 현재 시점의 화면을 기준으로 했다.
- 승인 대기 큐가 0건이어서 실제 승인 행은 코드 구조와 테스트를 대조했고, 실데이터 행의 시각 상태는 캡처하지 못했다.
- 실제 스크린리더 음성 출력, OS 고대비 모드, 브라우저 200% 확대는 수행하지 않았다. 720px 폭 리플로우와 DOM 시맨틱을 대체 근거로 사용했다.
- 데이터가 테스트/시드인지 운영 데이터인지 UI와 응답에 provenance가 없어 확정할 수 없었다.
- 감사 목적상 어떤 승인·보류·정산·내보내기 상태 변경도 수행하지 않았다.

## 14. 최종 권고

한 번에 세 화면을 시각적으로 다시 꾸미지 말고 다음 세 묶음으로 고친다.

1. **정확성 패치**: 전역 정렬, canonical wallet, queue timestamp, export 전체성, 오류/0건 분리
2. **업무 모델 패치**: Approvals / Onboarding blockers / Wallet debt의 용어·필터·열·행동 분리
3. **표현 패치**: 내비게이션 일치, 중첩 스크롤 제거, 1024/720 반응형, 문구와 빈 상태 정돈

이 순서를 지켜야 잘못된 데이터를 더 보기 좋게 만드는 일을 피할 수 있다.
