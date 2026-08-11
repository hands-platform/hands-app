# HANDS Admin `/partners` 운영자 UX·데이터 계약 심층 감사

- 감사 일자: 2026-08-06 (Asia/Bangkok)
- 대상: `http://localhost:3101/partners` 및 같은 화면의 주요 운영 상태
- 관점: 개발자가 아니라 실제 교대 운영자, 파트너 온보딩 담당자, 정산 담당자
- 방법: 로그인된 실제 화면 캡처 → 상태별 상호작용 → 1440/1024/720 CSS px 반응형 확인 → 접근성 구조 확인 → 화면 문구와 데이터 생성 코드를 역추적
- 변경 범위: 앱 코드는 수정하지 않았고, 이 보고서와 감사용 캡처만 추가했다.

## 1. 한 줄 결론

화면은 시각적 일관성과 기본 접근성 골격은 좋아졌지만, 지금은 **운영자가 믿고 순위를 판단하기에는 데이터 모집단과 상태 계약이 불안정하고, 큐·디렉터리·재무 역할이 한 화면에서 섞여 있다.** 특히 아래 네 가지는 디자인보다 먼저 고쳐야 한다.

1. `Bookings`, `Completed`, `Revenue`, `Wallet debt` 등 일부 정렬이 1,378명 전체가 아니라 먼저 받은 25명만 정렬하면서 전체 정렬처럼 보인다.
2. `Unsettled Partners`의 포함 조건과 화면에 표시하는 지갑 잔액의 원천이 달라 `0 VND / No negative balance` 파트너가 미정산 큐에 나타난다.
3. `Partner Approvals`, `Unapproved Partners`, 일반 디렉터리의 의미와 대기시간 기준이 섞여 승인 담당자가 “지금 결정할 건”과 “아직 제출도 안 된 건”을 구분하기 어렵다.
4. 모든 카드를 독립 스크롤 영역으로 만들고 표 최소 너비를 1,440px로 고정해, 좁은 화면과 200% 확대 수준에서 파트너 신원을 잃은 채 좌우·상하 스크롤해야 한다.

## 2. 운영자 핵심 업무 기준

이 페이지는 아래 네 가지 질문에 빠르게 답해야 한다.

1. **찾기:** 특정 파트너를 이름·전화·ID로 찾을 수 있는가?
2. **판단:** 현재 일을 받을 수 있는지, 막혔다면 왜 막혔는지 즉시 알 수 있는가?
3. **처리:** 승인, 계정 제어, 정산, 상세 확인 중 다음에 어디로 가야 하는가?
4. **증명:** 화면의 총계·정렬·필터·잔액을 운영자가 믿고 내보낼 수 있는가?

현재 화면은 1번은 대체로 수행하지만 2~4번은 데이터 계약과 정보구조 때문에 신뢰 비용이 높다.

## 3. 잘된 점

- 전체 앱과 동일한 카드, 배지, 표, 버튼 체계를 사용해 시각적 일관성이 있다.
- 검색창과 select에 접근 가능한 이름이 있고, 표 헤더는 `scope="col"`, 빈 상태는 `role="status"`와 `aria-live`를 사용한다.
- 상태가 색상만으로 전달되지 않고 `Ready now`, `Offline`, `KYC Approved`처럼 텍스트를 병행한다.
- 승인 대기 0건 상태는 “할 일이 없음”과 대체 이동 경로를 함께 보여 준다.
- 필터 결과 수, 활성 필터, 페이지네이션이 존재해 기본 디렉터리 골격은 갖춰져 있다.
- 정산 큐가 별도 표 구성을 갖는 방향 자체는 맞다. 문제는 컬럼 우선순위와 잔액 원천이다.

## 4. 캡처 단계와 화면 건강도

건강도는 `양호 / 주의 / 높음 / 치명적`로 표시했다.

| 단계 | 캡처 상태 | 건강도 | 핵심 관찰 |
|---:|---|---|---|
| 1 | 기본 상단 | 주의 | 개발 구현 문구, 승인 탭 누락, 필터 밀도 |
| 2 | 정렬·나이·표 진입 | 높음 | 디렉터리에 큐 나이와 이중 정렬이 노출 |
| 3 | 기본 표 헤더 | 높음 | 8개 컬럼, 역할 혼합, 가로 스크롤 전제 |
| 4 | 기본 표 행 | 높음 | `Not saved`, 테스트성 레코드, 행동 부재 |
| 5 | 미승인 상단 | 높음 | 사이드바 컨텍스트 상실, 승인 의미 혼합 |
| 6 | 미승인 행 | 높음 | 성별 노출, blocker는 숫자뿐, 다음 행동 없음 |
| 7 | 미정산 상단 | 주의 | 재무 큐 방향은 맞으나 일반 필터가 과다 |
| 8 | 미정산 행 | 치명적 | `0 VND / No negative balance`가 미정산 큐에 포함 |
| 9 | 미정산+추가 필터 | 높음 | 보조 쿼리 추가 시 활성 사이드바가 사라짐 |
| 10 | 검색 결과 없음 | 주의 | 빈 상태에도 1,440px 표와 가로 스크롤 유지 |
| 11 | 승인 대기 0건 | 주의 | 빈 상태는 좋지만 상단 탭은 `Partners` 활성 |
| 12 | 1024 상단 | 주의 | 사이드바와 넓은 카드가 본문 폭을 크게 잠식 |
| 13 | 1024 표 | 치명적 | 핵심 컬럼 절반 이상이 화면 밖으로 밀림 |
| 14 | 720 상단 | 주의 | 헤더는 적응하지만 필터 행동과 밀도는 불균형 |
| 15 | 720 정렬·나이 | 높음 | 작은 화면에 8개 정렬과 나이·순서 제어가 겹침 |
| 16 | 720 표 오른쪽 | 치명적 | 파트너 신원·상태가 사라진 채 재무 컬럼만 보임 |
| 17 | 1440 기본 상단 | 주의 | 넓은 화면에서도 제목/필터가 첫 화면을 대부분 점유 |
| 18 | 1440 기본 표 | 높음 | 카드 내부 상하·좌우 스크롤과 낮은 정보 밀도 |
| 19 | Bookings 정렬 | 치명적 | 상단 1,378명과 표 25명이 동시에 표시됨 |

### 단계 1 — 기본 상단

![기본 상단](C:/dev/massage-on-demand-vn/output/partners-audit-2026-08-06/01-default-top.png)

- `Partner directory aligned to the Vuexy management table...`은 운영 목적이 아니라 구현 방식을 설명한다.
- 상단 1차 탭은 `Partners / Unapproved Partners / Unsettled Partners`뿐이다. 사이드바의 `Partner Approvals`와 화면 탭이 서로 다른 정보구조를 갖는다.
- 운영자가 첫 화면에서 알고 싶은 것은 “지금 처리할 일”인데, 제목 카드와 넓은 필터가 우선 노출된다.

### 단계 2 — 정렬·나이·표 진입

![정렬과 나이](C:/dev/massage-on-demand-vn/output/partners-audit-2026-08-06/02-queue-and-table-top.png)

- `Checklist`와 `Newest first`가 동시에 활성이다. 하나는 정렬 버튼, 하나는 순서 버튼처럼 보이지만 실제로 같은 `sort` 값을 다른 방식으로 제어한다.
- 일반 파트너 디렉터리의 `AGE`는 큐 대기시간이 아니라 `ProviderProfile.updatedAt` 기준이다. “무엇이 늙었는가”가 드러나지 않는다.
- `24h+ 1,374`는 액션 큐처럼 보이지만 대부분 오래 업데이트되지 않은 전체 레코드다. 운영자가 1,374건의 지연 작업으로 오해할 수 있다.

### 단계 3 — 기본 표 헤더

![기본 표](C:/dev/massage-on-demand-vn/output/partners-audit-2026-08-06/03-default-table.png)

- `Partner / State / Level / Access / Location / Work / Wallet / Account`는 디렉터리, 활동 진단, 위치, 재무, 승인·계정 제어를 한 줄에 합친 구조다.
- 일반 검색 업무에서 필요한 핵심은 `파트너 / 현재 운영 가능 여부 / 막힘 이유 / 최근 활동 / 현재 작업 / 다음 행동`이다.
- Wallet과 Account 상세는 전문 큐나 상세로 이동시키고, 기본 목록에는 경고 요약만 남기는 편이 빠르다.

### 단계 4 — 기본 표 행

![기본 표 행](C:/dev/massage-on-demand-vn/output/partners-audit-2026-08-06/04-default-table-rows.png)

- `Not saved · Legal name not saved`처럼 레이블 없는 두 값이 붙어 있어 첫 값이 성별이라는 것을 알 수 없다.
- `Smoke Partner`, `Audit Cancellation Partner`, `Partner 7284` 같은 테스트·합성 가능성이 높은 레코드가 운영 목록에 섞여 있다.
- 행 전체에서 다음 운영 행동이 없다. 결국 이름을 눌러 상세에 들어가 추론해야 한다.

### 단계 5 — 미승인 상단

![미승인 상단](C:/dev/massage-on-demand-vn/output/partners-audit-2026-08-06/05-unapproved-top.png)

- `Unapproved Partners`는 148건이지만, 별도 `Partner Approvals`는 0건이다. 두 숫자의 차이가 설명되지 않는다.
- 실제 코드는 `approval-pending`을 제출된 검증/KYC 결정 큐로, `unapproved`를 폭넓은 미완료·차단 상태로 취급한다. 문구는 둘 다 승인 작업처럼 들린다.
- 이 쿼리에서는 사이드바 Partner Operations가 접히고 breadcrumb가 단순 `HANDS > Partners`가 되어 현재 위치를 잃는다.

### 단계 6 — 미승인 행

![미승인 표 행](C:/dev/massage-on-demand-vn/output/partners-audit-2026-08-06/07-unapproved-table-rows.png)

- `Gender`는 승인 판단 우선 정보가 아니다. 운영상 꼭 필요하지 않다면 제거해야 한다.
- `7 approval needs`, `10 approval needs`는 심각도와 이유를 알려 주지 않는다. 최소 상위 2개 blocker와 `+N`을 보여 줘야 한다.
- `누가 처리할지`, `얼마나 기다렸는지`, `다음 버튼`이 없다.

### 단계 7 — 미정산 상단

![미정산 상단](C:/dev/massage-on-demand-vn/output/partners-audit-2026-08-06/08-unsettled-top.png)

- 정산 전용 설명과 별도 결과 수는 좋은 방향이다.
- 그러나 일반 디렉터리의 verification/KYC/app activity 필터, 8종 정렬, 프로필 업데이트 나이까지 그대로 남아 재무 처리 흐름을 흐린다.
- `124 settlement matchs`는 어색한 복수형이다. `124 partners with wallet debt` 또는 `124 settlement cases`가 명확하다.

### 단계 8 — 미정산 행

![미정산 표의 0 VND 오류](C:/dev/massage-on-demand-vn/output/partners-audit-2026-08-06/09-unsettled-table.png)

- `Smoke Partner`가 `0 VND`, `No negative balance`인데 미정산 큐에 포함된다.
- 코드상 포함 조건은 `WalletBalanceSummary.balance < 0`이지만, 행 표시는 `ProviderEarning`의 `PENDING/AVAILABLE` 집계로 만든 `activitySummary.walletBalance`를 사용한다.
- 이는 표현 오류가 아니라 **동일한 ‘wallet balance’에 서로 다른 원장을 사용한 데이터 계약 오류**다.
- `Wallet`에 pending/available이 이미 나오는데 `Payout` 컬럼이 다시 같은 값을 반복한다. `Revenue`도 지금 정산해야 할 부채보다 우선순위가 낮다.

### 단계 9 — 미정산 추가 필터

![필터 적용 후 미정산](C:/dev/massage-on-demand-vn/output/partners-audit-2026-08-06/10-filtered-unsettled-top.png)

- `Online available + App active 7D` 적용 후 결과는 2건으로 좁혀지지만 URL에 `age=all`, 빈 `q`, 빈 verification/KYC 등이 포함된다.
- 사이드바의 활성 항목은 쿼리 문자열 전체가 정확히 같을 때만 일치해, 보조 필터가 추가되면 `Unsettled Partners` 활성 상태가 사라진다.
- `Clear filters`는 현재 큐가 아니라 `/partners`로 이동한다. 운영자는 “미정산 안에서 보조 필터만 초기화”를 기대한다.

### 단계 10 — 검색 결과 없음

![빈 검색 결과](C:/dev/massage-on-demand-vn/output/partners-audit-2026-08-06/11-empty-state.png)

- 빈 상태의 제목과 안내 문구는 적절하다.
- 하지만 행이 0개여도 표 최소 너비 1,440px가 유지되어 불필요한 가로 스크롤이 생긴다.
- 긴 검색어 활성 칩이 줄임 처리되어 무엇을 검색했는지 확인하기 어렵다.

### 단계 11 — 승인 대기 0건

![승인 대기 빈 상태](C:/dev/massage-on-demand-vn/output/partners-audit-2026-08-06/12-approval-pending-empty.png)

- `No partner approvals are waiting`, held/rejected 보기, directory 이동은 좋은 빈 상태 설계다.
- 그러나 페이지 상단 탭은 `Partners`가 활성이다. 사이드바는 `Partner Approvals`, 본문은 approval queue, 탭은 Partners라는 세 가지 현재 위치가 충돌한다.
- 이 큐의 대기시간은 행에서는 verification/KYC `submittedAt`을 계산하지만, 서버의 나이 버킷과 SLA는 `ProviderProfile.updatedAt`을 사용한다. 같은 화면에서 기준 시점이 다르다.

### 단계 12 — 1024 상단

![1024 상단](C:/dev/massage-on-demand-vn/output/partners-audit-2026-08-06/13-1024-top.png)

- 250px 사이드바가 유지되어 본문 폭이 크게 줄어든다.
- 제목 설명은 좁게 감기지만 카드 오른쪽은 비어 있어 공간 배분이 비효율적이다.
- breadcrumb와 필터가 여러 줄로 늘어나 실제 데이터가 첫 화면 아래로 밀린다.

### 단계 13 — 1024 표

![1024 표](C:/dev/massage-on-demand-vn/output/partners-audit-2026-08-06/14-1024-table.png)

- Partner, State, Level 이후 Access가 잘리고 Location·Work·Wallet·Account는 보이지 않는다.
- 운영자는 “행을 세로로 찾은 뒤 가로로 이동”해야 하고, 다시 파트너를 확인하려면 왼쪽으로 돌아와야 한다.
- 첫 열이 sticky가 아니므로 신원과 판단 정보가 분리된다.

### 단계 14 — 720 상단

![720 상단](C:/dev/massage-on-demand-vn/output/partners-audit-2026-08-06/15-720-top.png)

- 사이드바가 접히고 상단 헤더가 유지되는 점은 좋다.
- 필터 입력은 좁아지는데 Export/Apply는 별도 오른쪽 열을 유지해 비대칭 여백이 생긴다.
- 720 CSS px는 실제 모바일 목표라기보다 데스크톱 200% 확대에 가까운 검증값이다. 관리자 웹도 이 폭에서 핵심 작업이 가능해야 한다.

### 단계 15 — 720 정렬·나이

![720 정렬과 나이](C:/dev/massage-on-demand-vn/output/partners-audit-2026-08-06/16-720-sort-age.png)

- 8개의 정렬 버튼, 5개의 나이 버튼, 오래된/최신 순서가 좁은 화면에 연속으로 배치된다.
- 디렉터리 검색이라는 주업무보다 운영 규칙 해석에 더 많은 공간과 주의를 요구한다.
- `Checklist`, `Oldest pending`, `Newest first`의 관계를 이해해야만 현재 정렬을 알 수 있다.

### 단계 16 — 720 표 오른쪽

![720 표 오른쪽](C:/dev/massage-on-demand-vn/output/partners-audit-2026-08-06/18-720-table-right.png)

- 오른쪽으로 이동하면 `Location / Work / Wallet / Account`만 보이고 파트너 신원과 State는 사라진다.
- 오른쪽 끝 Account 문구도 잘린다.
- WCAG 1.4.10 Reflow 관점에서 필수 내용을 이해하기 위해 두 방향 스크롤이 필요하고, 신원 문맥이 보존되지 않는다.

### 단계 17 — 1440 기본 상단

![1440 기본 상단](C:/dev/massage-on-demand-vn/output/partners-audit-2026-08-06/19-1440-top.png)

- 넓은 화면에서도 제목 카드, 탭, 필터, 정렬, 나이 제어가 첫 화면 대부분을 차지한다.
- 운영 데이터가 첫 화면에 거의 나타나지 않아 교대 중 빠른 스캔에 불리하다.
- 일반 디렉터리에는 한 줄 제목/설명 + 검색/핵심 필터 + 단일 정렬이면 충분하다.

### 단계 18 — 1440 기본 표

![1440 기본 표](C:/dev/massage-on-demand-vn/output/partners-audit-2026-08-06/20-1440-table.png)

- 화면 자체, 필터 카드, 표 카드가 각각 상하 스크롤을 만들고 표는 다시 좌우 스크롤을 만든다.
- CSS가 `.partners-page > .card`에 최대 높이와 `overflow-y:auto`를 적용하고, 표는 `min-width:1440px`를 강제한다.
- `App not tracked`, `Unknown platform`, `No location`이 반복돼 핵심 예외보다 데이터 결손 문구가 시각적 주의를 많이 차지한다.

### 단계 19 — Bookings 정렬의 모집단 불일치

![전체 1378명과 로컬 25명 정렬 불일치](C:/dev/massage-on-demand-vn/output/partners-audit-2026-08-06/22-bookings-sort-total-vs-table.png)

- 같은 화면에서 필터 영역은 `Showing 10 of 1378`, 표는 `25 matching Partners`를 표시한다.
- `booking-count` 정렬은 서버 페이지네이션을 끄고 최대 25명만 불러온 뒤 브라우저에서 정렬한다.
- 따라서 첫 행은 “1,378명 중 예약이 가장 많은 파트너”가 아니라 “서버 기본 순서로 먼저 받은 25명 중 예약이 많은 파트너”다.
- Export도 이 같은 `visibleProviders` 페이지에만 적용되어 버튼 문구만 보고는 “전체 필터 결과”인지 “현재 페이지”인지 알 수 없다.

## 5. 우선순위별 수정 요구사항

### P0 — 운영 판단을 틀리게 만들 수 있는 문제

#### P0-1. 모든 노출 정렬·필터를 전체 모집단 기준으로 통일

현재 원인:

- `partner-filters.ts`가 서버에서 처리하지 못하는 정렬/필터에 `PARTNER_LOCAL_FILTER_HYDRATION_LIMIT = 25`를 사용한다.
- 서버 정렬은 실질적으로 기본, `name`, `oldest`만 지원하고 예약 수·완료 수·매출·지갑 부채는 25개 로컬 행에서 정렬한다.
- summary는 로컬 정렬만 적용된 경우 여전히 전체 1,378건을 보여 준다.

요구사항:

1. 화면에 유지할 정렬은 API와 DB 쿼리에서 전체 모집단 기준으로 구현한다.
2. 구현 전에는 해당 정렬 버튼을 숨기거나 `현재 페이지 정렬`로 명시한다. 운영 화면에서는 숨기는 편이 안전하다.
3. 목록, 총계, 페이지네이션, CSV가 동일한 필터/정렬 계약을 사용해야 한다.
4. 응답에 `totalCount`, `rows`, `sort`, `filterScope`, `generatedAt`을 한 계약으로 반환해 화면이 서로 다른 호출을 조합해 거짓 숫자를 만들지 않게 한다.
5. 회귀 테스트는 25개를 넘는 fixture를 만들고 26번째 이후의 최고값이 1페이지 첫 행으로 오는지 검증한다.

완료 기준:

- `Bookings` 정렬 시 필터 총계와 표 총계가 동일하다.
- 1,378명 전체에서 가장 큰 예약 수가 첫 행이다.
- CSV도 같은 정렬/필터 전체 결과 또는 명시된 현재 페이지만 포함한다.

#### P0-2. 미정산 포함 조건과 표시 잔액을 하나의 원장으로 통일

현재 원인:

- 서버 큐 포함 조건: `walletBalanceSummaries.some(balance < 0, currency=VND)`.
- 목록 표 표시값: `getProviderListActivitySummaries()`가 ProviderEarning의 PENDING/AVAILABLE을 합산한 값.
- API의 다른 운영 목록은 이미 `walletBalanceSummaries`를 select하고 화면용 activity summary에 덮어쓰는 패턴을 사용한다.

요구사항:

1. 미정산 여부, 행 Wallet, 정렬, total, CSV가 모두 canonical `WalletBalanceSummary(VND)`를 사용한다.
2. pending/available payout은 별도 이름과 별도 원천으로 유지하고 `wallet balance`와 섞지 않는다.
3. 잔액 0 이상 행은 미정산 큐에 절대 포함하지 않는다.
4. 데이터 불일치가 발견되면 숨기지 말고 `Balance data mismatch` 내부 경고와 감사 가능 로그를 남긴다.
5. 음수/0/양수, summary 없음, 여러 통화 fixture로 계약 테스트를 추가한다.

완료 기준:

- `Unsettled Partners`의 모든 행은 표시 Wallet이 VND 음수다.
- 큐 total, 행 표시, CSV가 같은 잔액을 사용한다.

#### P0-3. 승인 큐의 의미와 기준시점을 명확히 분리

권장 정보구조:

- `Approvals`: verification 또는 KYC가 제출되어 **운영자가 지금 승인/반려 결정을 해야 하는 건**.
- `Onboarding blockers`: 아직 제출 준비가 안 됐거나 보완·차단·미완료인 파트너.
- `Partner directory`: 전체 검색과 상태 확인.
- `Wallet debt`: 음수 지갑 잔액 정산 큐.

요구사항:

1. `Partner Approvals`를 1차 탭에도 포함하고 approval URL에서 정확히 활성화한다.
2. `Unapproved Partners`를 `Onboarding blockers` 또는 `Held / incomplete`로 바꾼다.
3. 승인 대기시간은 명시적 `reviewQueuedAt`/`submittedAt`을 canonical 값으로 정한다.
4. 행의 submitted time, age bucket, oldest sort, SLA overdue가 모두 같은 timestamp를 사용한다.
5. `ProviderProfile.updatedAt`은 프로필 수정으로 바뀔 수 있으므로 승인 SLA 기준으로 사용하지 않는다.
6. 각 행에 `상위 blocker 2개 +N`, `대기시간`, `담당자`, `다음 행동`을 표시한다.

완료 기준:

- 0 Approvals와 148 Onboarding blockers의 차이를 설명 문구 없이도 이해할 수 있다.
- 제출 시간을 변경하지 않는 프로필 수정이 SLA 순서를 바꾸지 않는다.

#### P0-4. 테스트·합성 데이터를 운영 데이터와 구조적으로 분리

현재 관찰:

- 화면에 `Smoke Partner`, `Audit Cancellation Partner`, 번호형 `Partner ####`가 다수 보인다.
- 파트너 목록 데이터 모델과 화면에서 `isSynthetic`, `dataOrigin`, `environment` 같은 provenance 표식을 찾지 못했다.

요구사항:

1. 이름 휴리스틱이 아니라 DB의 명시적 provenance(`LIVE`, `TEST`, `SEED`, `AUDIT`)를 둔다.
2. 운영 큐·총계·정렬·CSV는 기본적으로 LIVE만 포함한다.
3. 테스트 데이터를 봐야 하는 권한자에게만 `Include test data`를 제공하고 화면에 명확한 배지를 표시한다.
4. 기존 레코드는 마이그레이션/시드 생성 경로를 통해 provenance를 채운다.

완료 기준:

- 테스트 데이터가 운영 approval/debt/ready-now 총계에 영향을 주지 않는다.

#### P0-5. 스크롤과 reflow 구조 수정

요구사항:

1. 페이지 본문은 기본적으로 하나의 세로 스크롤만 사용한다.
2. `.partners-page > .card`의 일괄 `max-height/overflow-y:auto`를 이 페이지의 제목·필터·목록 카드에 적용하지 않는다.
3. 기본 목록은 5~6개 핵심 컬럼으로 줄이고 1,440px 최소 너비를 제거한다.
4. 가로 스크롤이 불가피하면 Partner 열을 sticky로 고정하고 현재 행의 신원을 계속 보존한다.
5. 1024px에서는 우선순위 낮은 데이터를 행의 보조 줄이나 상세로 이동한다.
6. 720px/200% 확대에서는 파트너, 상태, blocker, 다음 행동을 한 화면 흐름에서 읽을 수 있어야 한다.
7. 빈 상태에서는 표 자체를 렌더링하지 않거나 최소 너비를 해제한다.

완료 기준:

- 1440px에서 페이지와 카드가 동시에 세로 스크롤되지 않는다.
- 1024px와 720px에서 핵심 업무가 좌우 스크롤 없이 가능하다.
- 200% 확대, 키보드만 사용, 고대비 모드에서 다시 검증한다.

### P1 — 처리 시간과 오류 가능성을 줄이는 문제

#### P1-1. 큐별로 필터와 정렬을 다르게 제공

`Partner directory`:

- 검색
- 운영 상태
- KYC/Verification
- 앱 활동
- 단일 Sort select: 운영 우선순위, 이름, 최근 활동 정도

`Approvals`:

- 검색
- 대기시간/SLA
- 누락 자료
- 위험 플래그
- 담당자/미배정
- 정렬은 oldest first 고정 또는 명확한 단일 선택

`Onboarding blockers`:

- blocker 유형
- 단계
- 마지막 파트너 활동
- 담당자

`Wallet debt`:

- 부채 크기
- 부채 발생 시점
- 지급 보류 여부
- 미처리 출금 요청
- 담당자

일반 디렉터리에 `Queue age`를 두지 말고, 큐에서만 `Waiting age`를 사용한다.

#### P1-2. 기본 표를 운영 행동 중심으로 재구성

권장 컬럼:

| 컬럼 | 표시 내용 |
|---|---|
| Partner | 표시명, legal name(다를 때만), ID, 신뢰 가능한 테스트/실데이터 배지 |
| Availability | Ready / Busy / Offline + 마지막 앱 활동 |
| Blocker | 일을 못 받는 가장 중요한 이유 1개 + 추가 개수 |
| Current work | 활성 booking 또는 최근 완료 시점 |
| Data quality | location/app tracking 누락이 실제 판단에 영향을 줄 때만 경고 |
| Action | View, approve, contact, controls, wallet 등 현재 상태에 맞는 1차 행동 |

Wallet, Revenue, Payout, Approval needs는 각각의 전문 큐로 옮긴다.

#### P1-3. 미승인 행을 판단 가능한 형태로 변경

- Gender 제거.
- `10 approval needs` 대신 `Identity missing · KYC draft · +8`.
- `Waiting 3d 4h`, `Owner: Unassigned`.
- CTA는 상태에 따라 `Review submission`, `Request correction`, `Open profile` 중 하나.
- 이미 반려/보류된 경우 사유의 안전한 요약을 표시하되 민감 문서 내용은 목록에 노출하지 않는다.

#### P1-4. 미정산 행을 부채 처리에 맞게 변경

권장 컬럼:

- Partner
- Wallet debt
- Debt since / latest debt booking
- Pending withdrawal or payout hold
- Last contact / owner
- Next action

`Revenue`와 중복 `Payout`은 제거한다. 총매출이 필요하면 상세 drawer/페이지에서 제공한다.

#### P1-5. 내보내기의 범위와 개인정보를 명시

현재 CSV는 `visibleProviders`만 내보내면서 phone, device, latest session IP, 재무·계정 정보를 포함한다.

요구사항:

1. 버튼을 `Export current page (10)` 또는 `Export all 1,378 results`처럼 정확히 표시한다.
2. 전체 결과 내보내기는 서버 스트리밍/비동기 작업으로 구현하고 동일 필터 계약을 사용한다.
3. phone/IP/device 같은 민감 컬럼은 업무상 필요한 별도 권한과 감사 로그를 요구한다.
4. 기본 CSV는 최소 필드만 포함하고, 민감 확장 export는 확인 단계와 목적 입력을 둔다.
5. export 생성 시 필터, 정렬, 행 수, 생성 시각, 요청 운영자를 기록한다.

#### P1-6. 사이드바 활성 매칭을 의미 기반으로 변경

현재 `admin-nav-match.ts`는 query가 있는 링크를 전체 query string exact match로 비교한다.

요구사항:

- `/partners` 경로와 `review` 같은 1차 모드만 활성 매칭에 사용한다.
- `q`, `activity`, `age`, `page` 같은 보조 필터는 무시한다.
- query parameter 순서에도 영향을 받지 않아야 한다.
- 같은 방식으로 breadcrumb 제목도 primary mode에서 생성한다.

#### P1-7. `Clear filters`가 현재 큐를 보존

- Directory에서는 `/partners`.
- Onboarding blockers에서는 `/partners?review=unapproved`.
- Wallet debt에서는 `/partners?review=unsettled`.
- Approvals에서는 canonical approval URL.

개별 활성 필터 칩도 하나씩 제거할 수 있게 한다.

#### P1-8. 고급 필터 발견성 개선

현재 `showAdvancedFilters`가 참일 때만 `More filters` 자체가 렌더링된다. 즉, 고급 필터가 이미 URL에 있어야 고급 필터 UI를 발견할 수 있는 역설이 생긴다.

- 기본 화면에도 `More filters` disclosure는 항상 보이게 한다.
- 다만 현재 30개에 가까운 review lane을 한 select에 모두 넣지 않는다.
- `Readiness`, `Quality`, `Files`, `Account & security`처럼 3~4개 그룹으로 나눈다.
- 자주 쓰는 운영 큐는 필터가 아니라 탭/사이드바 목적지로 승격한다.

### P2 — 문구·시각적 밀도·마감

| 현재 문구 | 권장 문구 | 이유 |
|---|---|---|
| Partners | Partner directory | 전체 레코드 검색 목적 명확화 |
| Vuexy management table… | Find a partner, confirm whether they can take work, and open the right follow-up. | 구현 설명 제거 |
| Partner operations filters | Find and filter partners | 짧고 행동 중심 |
| Ready now / Records sort | Sort by | 개념 혼합 제거 |
| Checklist | Operational priority | 의미 명확화 |
| AGE | Waiting age | 실제 큐에서만 사용 |
| Unapproved Partners | Onboarding blockers | 결정 대기와 미완료 분리 |
| Unsettled Partners | Wallet debt | 포함 조건을 직접 표현 |
| 124 settlement matchs | 124 partners with wallet debt | 잘못된 복수형과 모호함 제거 |
| Not saved · Legal name… | Legal name: Not recorded | 레이블 없는 값 제거 |
| App not tracked | Tracking unavailable | 파트너의 비활성으로 오해 방지 |
| Unknown platform | Platform not recorded | 데이터 결손임을 명시 |
| No location | Location unavailable | 비난 없이 상태 표현 |

추가 시각 권장:

- 제목 카드 높이를 줄여 첫 화면에 최소 2~3개 행이 보이게 한다.
- 상태 배지는 핵심 상태 1개를 강조하고, 보조 상태는 muted text로 낮춘다.
- 반복되는 `App not tracked`, `Unknown platform`은 행마다 강한 배지 대신 페이지 수준 데이터 품질 요약 또는 작은 경고 아이콘으로 축약한다.
- 긴 helper text는 2줄 상한을 두고 전체 내용은 tooltip이 아니라 상세 화면에서 제공한다.
- Partner 이름 또는 행 끝에 명확한 `Open` 액션을 둔다. 클릭 가능한 이름만으로 행동을 암시하지 않는다.

## 6. 코드에서 확인한 직접 원인

| 문제 | 직접 원인 | 위치 |
|---|---|---|
| 25명 로컬 정렬 | 서버 처리 불가 시 hydration limit 25 후 로컬 sort/filter | `apps/admin_web/app/partners/partner-filters.ts:82-86, 822-824, 903` |
| 총계/표 불일치 | 로컬 정렬은 summary filter mismatch로 보지 않아 전체 summary 유지 | `partner-filters.ts:83, 135-138` |
| 미정산 0 VND | filter는 WalletBalanceSummary, display는 activity summary earning 집계 | `apps/api/src/admin/admin.service.ts:10880-10890, 10780-10790, 28136+` |
| 승인 SLA 시간 불일치 | list/summary age와 SLA가 ProviderProfile.updatedAt 사용 | `admin.service.ts:10767, 10826, 10835` |
| 행 제출시간은 별도 기준 | verification/KYC submittedAt 중 이른 값 사용 | `apps/admin_web/app/partners/partner-master-row.ts:121-128` |
| 카드 내부 스크롤 | 모든 partners page 직계 card에 max-height/overflow-y:auto | `apps/admin_web/app/globals.css:5702-5717` |
| 표 강제 폭 | partner table min-width:1440px | `globals.css:18994-19002` |
| 사이드바 활성 상실 | query string 전체 exact match | `apps/admin_web/lib/admin-nav-match.ts:8-14` |
| Clear가 큐 이탈 | 일반 filter footer href가 항상 `/partners` | `apps/admin_web/app/partners/partner-filter-board.tsx:80` |
| 이중 정렬 | segmented sort와 AdminQueueAgeSortControls가 같은 sort를 제어 | `partner-filter-board.tsx:142-162` |
| 고급 필터 미발견 | showAdvancedFilters가 참일 때만 disclosure 렌더링 | `partner-filter-board.tsx:164` |
| Approvals 탭 누락 | primary tabs가 Partners/Unapproved/Unsettled만 정의 | `partner-primary-list-tabs.tsx:13-16` |
| Gender/중복 재무 | unapproved에 Gender, unsettled에 Wallet/Revenue/Payout | `partner-master-list-section.tsx:52-66, 171-172` |
| 어색한 복수형 | `adminCountLabel(rowCount, 'settlement match')` | `partner-master-list-section.tsx:506` |
| Export 범위 모호 | current pagination의 visibleProviders만 CSV 생성 | `apps/admin_web/app/api/admin/partners/export/route.ts:62-70` |
| Export 민감정보 | phone, device, IP, wallet/account 등이 기본 컬럼 | `partner-export-rows.ts:11-56, 101` |

## 7. 권장 최종 화면 구조

### 7.1 상단

- breadcrumb: `Partner Operations / Partner directory`
- 한 줄 제목과 짧은 운영 설명
- 우측: `Export current page (10)` 또는 권한 있는 `Export all results`

### 7.2 1차 탭

1. Directory
2. Approvals
3. Onboarding blockers
4. Wallet debt

각 탭의 수치는 **같은 canonical API 계약**에서 가져오고, 테스트 데이터는 제외한다.

### 7.3 필터

- 첫 줄: Search, State, KYC/Verification, App activity, Apply
- 둘째 줄: 활성 필터 칩, Clear within current view, More filters
- 정렬은 단일 select 또는 3개 이하 segmented control
- queue age는 Approvals/Onboarding blockers 같은 실제 대기 큐에만 표시

### 7.4 목록

- 첫 열 Partner sticky는 가로 스크롤을 남길 경우의 안전망이다.
- 더 좋은 기본안은 컬럼을 6개 이내로 줄여 가로 스크롤 자체를 없애는 것이다.
- 행 전체가 아니라 명시적 CTA를 제공한다.
- 하단에 `1–10 of 1,378`와 페이지네이션, 필요할 때만 page size를 둔다.

## 8. 구현 순서

### 1차 — 신뢰성

1. 전체 모집단 정렬/필터 API 계약 통합.
2. canonical wallet balance 통일.
3. approval waiting timestamp 통일.
4. 테스트 데이터 provenance와 기본 제외.
5. 목록/summary/export 계약 테스트.

### 2차 — 정보구조

1. 탭을 Directory/Approvals/Onboarding blockers/Wallet debt로 재편.
2. nav active matching을 route+primary mode 기준으로 변경.
3. 큐별 필터/정렬/컬럼 분리.
4. Clear filters가 현재 큐를 보존하도록 변경.

### 3차 — 레이아웃·접근성

1. 카드별 세로 스크롤 제거.
2. 표 1,440px 최소 폭 제거, 6컬럼 이하 구성.
3. 1024/720/200% reflow 구현.
4. 키보드 포커스, 스크린리더, 고대비, 실제 200% 확대 검증.

### 4차 — 문구와 마감

1. 개발 구현 문구 제거.
2. 큐/버튼/복수형/결손 상태 문구 수정.
3. 데이터 품질 경고의 시각적 강도 축소.
4. export 범위와 민감정보 안내 추가.

## 9. Codex 구현 수용 기준

### 데이터

- [ ] 노출된 모든 정렬은 전체 필터 모집단에 적용된다.
- [ ] 화면 total, 표 total, pagination total, export total이 일치한다.
- [ ] Wallet debt 큐의 모든 행은 canonical VND balance가 음수다.
- [ ] 승인 age, SLA, oldest sort, 행 timestamp가 같은 시점을 사용한다.
- [ ] 테스트/seed/audit 데이터는 운영 큐와 total에서 기본 제외된다.

### 운영 흐름

- [ ] Approvals와 Onboarding blockers의 의미가 겹치지 않는다.
- [ ] 각 큐의 행에서 blocker, waiting age, owner, next action을 확인할 수 있다.
- [ ] 보조 필터를 적용해도 사이드바와 breadcrumb가 현재 큐를 유지한다.
- [ ] Clear filters는 현재 큐를 보존한다.
- [ ] export 범위와 포함 행 수가 버튼에서 명확하다.

### 접근성·반응형

- [ ] 기본 페이지에는 하나의 세로 스크롤 흐름만 있다.
- [ ] 1024px에서 핵심 6개 이하 컬럼을 좌우 스크롤 없이 읽을 수 있다.
- [ ] 720px/200% 확대에서 파트너 신원, 상태, blocker, action을 함께 볼 수 있다.
- [ ] 빈 상태에는 불필요한 가로 스크롤이 없다.
- [ ] 키보드만으로 탭, 검색, 필터, 목록, 페이지네이션, CTA를 순서대로 사용할 수 있다.
- [ ] focus-visible, screen reader 명칭, 고대비 모드를 확인한다.

### 테스트

- [ ] 26번째 이후의 레코드가 최고 정렬값인 경우를 검증한다.
- [ ] 음수/0/양수 wallet balance와 여러 통화를 검증한다.
- [ ] approval submittedAt과 profile updatedAt이 다른 경우를 검증한다.
- [ ] nav query order/secondary filters/page가 활성 상태를 깨지 않는지 검증한다.
- [ ] queue-preserving clear href를 검증한다.
- [ ] CSV current page/all results와 민감 export 권한을 검증한다.

## 10. 하지 말아야 할 수정

- 25명 로컬 정렬을 유지한 채 문구만 바꾸지 않는다.
- `0 VND` 행을 프런트에서 숨겨 원장 불일치를 감추지 않는다.
- `Smoke`, `Audit`, `Partner ####` 이름 패턴으로 테스트 데이터를 제거하지 않는다.
- 모든 review lane을 그대로 탭으로 만들지 않는다.
- 좁은 화면에서 중요한 컬럼을 무조건 `display:none`으로 숨기지 않는다.
- sticky column만 추가하고 1,440px 표와 중복 컬럼을 그대로 두지 않는다.
- tooltip에 핵심 blocker나 다음 행동을 숨기지 않는다.
- 색상만으로 approval/wallet/account 위험을 표현하지 않는다.
- 새 UI 라이브러리나 새 테이블 의존성을 추가하지 않는다. 기존 `AdminDataTable`, 필터, badge, pagination 패턴으로 충분하다.

## 11. 검증 결과

실행한 확인:

```text
npm.cmd run test --workspace @massage-vn/admin-web --
  app/partners/page.spec.tsx
  app/partners/partner-filters.spec.ts
  app/partners/partner-filter-board.spec.tsx
  app/partners/partner-master-list-section.spec.tsx
  app/partners/partner-master-row.spec.ts
  app/partners/partner-list-query.spec.ts
  app/partners/partner-primary-list-tabs.spec.tsx
  app/partners/partner-review-mode.spec.ts
  lib/admin-nav-match.spec.ts
  app/api/admin/partners/export/route.spec.ts
  app/partners/partner-export-rows.spec.ts

결과: 11 files, 135 tests passed
```

```text
npm.cmd run test --workspace @massage-vn/api --
  src/admin/admin.service.spec.ts -t "partner directory"

결과: 1 file, 17 tests passed, 515 skipped by filter
```

현재 테스트가 통과한다는 것은 기존 구현 계약을 만족한다는 뜻이다. 캡처에서 확인된 25명 로컬 정렬과 잔액 원천 불일치는 기존 테스트가 잡지 못하는 **계약 공백**이다.

## 12. 감사 한계

- 로그인된 로컬 개발 데이터 기준으로 확인했다. 운영 데이터 분포와 권한별 화면 차이는 별도 검증이 필요하다.
- 실제 screen reader 낭독, 브라우저 200% zoom, Windows 고대비 모드는 이번 회차에서 직접 실행하지 않았다. 720 CSS px reflow와 DOM 의미 구조로 위험을 판정했다.
- Export는 민감정보 다운로드를 유발하므로 실제 버튼을 누르지 않고 route와 CSV 생성 코드를 확인했다.
- 파트너 상세에서 실제 승인/정산을 수행하지 않았다. 변경을 발생시키지 않는 목록·필터·상태 감사만 수행했다.

## 13. 최종 판정

- 시각적 일관성: **양호**
- 정보구조: **높은 개선 필요**
- 운영 효율: **높은 개선 필요**
- 데이터 신뢰성: **치명적 개선 필요**
- 반응형/reflow: **치명적 개선 필요**
- 기본 접근성 구조: **주의, 재검증 필요**

가장 먼저 해야 할 일은 UI를 더 꾸미는 것이 아니라 **파트너 목록·총계·정렬·CSV가 같은 전체 모집단을 사용하고, 미정산 필터·표시가 같은 canonical wallet balance를 사용하도록 계약을 바로잡는 것**이다.
