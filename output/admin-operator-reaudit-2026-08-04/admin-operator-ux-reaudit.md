⚠️ DEGRADED: single-context (repository policy requires a single-agent workflow)

# HANDS 관리자 웹 운영자 UX 재감사 보고서

- 재감사일: 2026-08-04
- 대상: `C:\dev\massage-on-demand-vn\apps\admin_web`
- 비교 기준: 이전 감사 20/40, `ADM-001~ADM-029`, `OUX-030~OUX-043`
- 방법: 로그인된 Chrome에서 운영 흐름 11개 화면과 핵심 대기열 2개를 새로 캡처하고 DOM·현재 소스·타깃 테스트를 교차 확인했다.
- 비범위: 환불, 노쇼, 지갑, 파트너 승인 등 실제 데이터 변경. 완전한 WCAG 적합성 선언. 역할별 계정 전체 조합의 수동 검증.

## 1. 결론

개선 방향은 맞고 실제 진전도 확인됐다. 이전보다 `Needs action`, 범위, 소유 팀, 가장 오래된 건, 금액 영향, 다음 행동이 훨씬 잘 보인다. 환불의 `State mismatch`, 재무의 우선순위 카드, 알림의 사용자·기기·알림·시도 단위 설명, 고객 상세의 예외 우선 배치는 특히 좋은 변화다.

그러나 아직 “운영자가 믿고 처리할 수 있는 콘솔”로 완료됐다고 보기는 어렵다. 남은 핵심은 장식이 아니라 다음 세 가지다.

1. **실행본과 소스가 다르다.** 3101 서버의 `.next` 빌드는 16:53, 확인한 소스는 18:36~19:22 수정본이다. 예약 상세 화면에는 여전히 `Mark done / Blocked / Reset`이 보이지만 최신 소스에는 항목별 동사, `Could not confirm`, 완료 후 `Reopen checkpoint`가 구현돼 있다.
2. **집계와 사례 판정의 단일 기준이 없다.** 환불 상단 `State mismatch 3`과 달리 첫 페이지의 다수 행이 `State mismatch`로 표시된다. 서버 summary와 프론트 행 판정이 서로 다른 규칙을 사용한 결과로 보인다.
3. **역사·테스트 데이터가 현재 업무를 오염시킨다.** Live Bookings의 19일·46일 사례, Start Shift의 77일·75일·74일 사례, 알림의 75일 실패, Smoke/Demo 레코드가 계속 현재 큐에 섞인다.

따라서 다음 단계는 새 UI 라이브러리나 대규모 재설계가 아니다. **최신 빌드 배포 보장 → 서버 소유 집계 계약 통일 → live/anomaly/test 데이터 격리 → 화면별 정보 밀도 축소** 순서가 가장 작고 안전하다.

## 2. 증거 신뢰성 및 즉시 조치

### 실행본과 소스 불일치

| 증거 | 시각 |
|---|---|
| `apps/admin_web/.next/BUILD_ID` | 2026-08-04 16:53 |
| `.next/server/app/bookings/[id]/page.js` | 2026-08-04 16:52 |
| `booking-action-status-sections.tsx` | 2026-08-04 19:22 |
| `refunds/page.tsx` | 2026-08-04 18:36 |

3101은 `next start` 실행본이다. 따라서 이 보고서는 다음 두 층을 구분한다.

- **운영 화면 판정**: 현재 3101에서 실제 운영자가 보는 상태. 캡처가 근거다.
- **최신 소스 판정**: 아직 3101에 반영되지 않은 개선. 코드와 타깃 테스트가 근거다.

최신 소스 타깃 테스트는 7개 파일, 62개 테스트가 모두 통과했다. 다만 이것은 최신 프로덕션 빌드와 화면 검증을 대신하지 않는다.

### 배포 수용 기준

- 빌드 산출물 생성 시각이 배포 대상 소스보다 오래되지 않는다.
- 화면 하단 또는 진단 정보에 build SHA/ID를 노출하고, 감사 캡처에 같은 ID가 기록된다.
- 배포 후 예약 상세에서 pending 항목에 `Reopen/Reset`이 없고, 항목별 완료 동사와 `Could not confirm`이 표시된다.
- 아래 11개 경로를 같은 build ID로 재캡처한 뒤에만 OUX 완료 상태를 확정한다.

## 3. 디자인 건강 점수

| # | 휴리스틱 | 이전 | 현재 | 판정 |
|---|---|---:|---:|---|
| 1 | 시스템 상태 가시성 | 3/4 | 3/4 | 범위·업데이트·oldest·owner가 늘었지만 live 데이터가 오래됐다. |
| 2 | 실제 업무 언어 | 2/4 | 3/4 | 행동 문구가 좋아졌으나 Vuexy, FCM, raw 상태가 여전히 첫 화면에 보인다. |
| 3 | 사용자 통제와 자유 | 2/4 | 3/4 | disclosure와 안전한 지갑 요청 흐름은 좋다. 예약 상세 실행본은 아직 위험하다. |
| 4 | 일관성과 표준 | 2/4 | 2/4 | 실행본/소스, 환불 summary/행, Today/All dates의 기준이 어긋난다. |
| 5 | 오류 예방 | 1/4 | 2/4 | 지갑 승인 게이트와 환불 mismatch는 좋아졌다. 예약/환불 단일 판정 계약이 미완료다. |
| 6 | 기억보다 인식 | 2/4 | 3/4 | 다음 행동·소유자·영향이 보이지만 사례 근거가 여전히 여러 영역에 흩어진다. |
| 7 | 유연성과 효율 | 2/4 | 2/4 | 고급 필터 접기는 개선됐으나 My queue, assignee, role home은 확인되지 않았다. |
| 8 | 미학적·최소주의 | 2/4 | 2/4 | 카드 품질은 나아졌지만 KPI·필터·설명 벽이 첫 업무 행을 밀어낸다. |
| 9 | 오류 인지·복구 | 2/4 | 3/4 | mismatch와 행동형 알림 문구가 추가됐다. incident grouping은 없다. |
| 10 | 도움말과 문서 | 2/4 | 2/4 | Policy 의미는 명확해졌지만 문맥 도움말과 운영 runbook 연결은 제한적이다. |
| **합계** |  | **20/40** | **25/40** | **+5, Acceptable — 개선은 분명하나 데이터 신뢰성과 배포 일치가 완료 조건** |

## 4. OUX-030~043 재판정

| ID | 상태 | 확인 결과 | 다음 완료 조건 |
|---|---|---|---|
| OUX-030 공통 셸 | 부분 개선 | 주 제목은 하나로 줄고 Policy/알림 이름이 명확해졌다. Light/Dark 두 버튼과 큰 상단 카드가 남는다. | 테마를 하나의 토글로 합치고 페이지 헤더 높이를 줄인다. |
| OUX-031 역할별 홈 | 미해결 | 역할별 `My queue`, `Unassigned`, 최근 사례 바로가기를 확인하지 못했다. | 역할별 기본 큐를 2클릭/10초 기준으로 수동 검증한다. |
| OUX-032 Start Shift | 부분 개선 | 실제 top 3, owner, oldest, impact, 정상 큐 접기가 추가됐다. | 77d/75d/74d를 Data anomaly로 옮기고 My queue/Unassigned/Escalations를 제공한다. |
| OUX-033 Live Bookings | 미해결 | action-first 목록과 고급 필터 접기는 좋다. 19d/46d, Smoke, KPI 반복, 모호한 두 금액이 남는다. | live 시간 계약과 test data 기본 제외를 서버 쿼리·테스트로 고정한다. |
| OUX-034 Booking Detail | 부분 개선·미배포 | 최신 소스에는 항목별 동사/사유/Reopen 제한이 있다. 3101은 여전히 3개 동등 버튼과 즉시 노쇼 폼을 표시한다. | 최신 빌드 배포 후 Decision Strip과 상호 배타적 `Cannot complete service` 흐름을 확인한다. |
| OUX-035 Customers | 미해결 | Needs action 뷰는 생겼으나 Vuexy 문구, 성별 KPI, All customers 기본값이 그대로다. | 기본 KPI를 Needs attention/Active booking/New today 3개로 줄이고 지원 문구로 교체한다. |
| OUX-036 Partner Approvals | 미해결 | 0건인데 검색 4개, 정렬 8개, age/order/SLA, Export가 화면 대부분을 차지한다. | approval 전용 필터만 남기고 0건에서는 필터·Export를 숨긴다. |
| OUX-037 Finance | 부분 개선 | Today/Current/Month 섹션, owner/assignee/oldest/impact가 좋아졌다. | Command에서 월 세금 기간을 숨기고 Today 카드에서 all-date count와 `0 VND` 오인을 제거한다. |
| OUX-038 Handoff/History | 부분 개선 | 제목과 설명은 History로 정리됐다. 그러나 `Incomplete handoff`, `Write note`가 History 안에 있고 shift acknowledgement 실체가 없다. | 현재 Handoff를 별도 모델/화면으로 두고 History는 읽기 전용으로 만든다. |
| OUX-039 Refunds | 부분 개선·새 회귀 | State mismatch 큐와 간결한 열은 추가됐다. 상단 3건과 보이는 다수 mismatch 행이 충돌한다. | 상태 단계와 집계를 서버 소유 enum/summary 하나로 통일하고 assignee를 추가한다. |
| OUX-040 Notifications | 부분 개선 | 지원 작업/기기/역사 섹션, 단위 설명, 행동형 문구가 추가됐다. | 동일 원인을 incident로 묶고 75d 항목을 현재 SLA에서 제외하며 FCM 상세를 Developer로 이동한다. |
| OUX-041 데이터 계약 | 미해결 | update 시각은 추가됐지만 역사 활성·Smoke/Demo가 기본 운영 화면에 남는다. | 모든 운영 기본 화면에서 테스트 데이터 0건, 오래된 활성은 anomaly만 표시한다. |
| OUX-042 문구 사전 | 부분 개선 | `Review oldest refund`, `Push unavailable · contact by phone` 등이 반영됐다. | Start Shift/Booking Monitor/Vuexy/FCM/raw enum과 미배포 예약 문구를 정리한다. |
| OUX-043 시각/접근성 | 부분 개선 | 상태 라벨과 heading 구조는 좋아졌다. 카드·필터 반복과 Start Shift의 red sea가 남는다. | 한 화면 primary CTA 하나, 정상/주의/차단 시각 무게 분리, 1440/1980/1024/200% 재검증. |

## 5. 우선순위별 추가 수정 요건

### [P0] RA-001 — 최신 소스와 실행본을 동일 build ID로 고정

- **문제**: 현재 화면만 보면 예약 행동 보호가 미구현이고, 소스만 보면 구현 완료다. 둘 중 하나만 보고 완료 처리하면 회귀를 놓친다.
- **수정**: 빌드·시작·브라우저 검증을 하나의 배포 작업으로 묶고 결과에 build ID를 남긴다. 기존 `next build`/`next start`만 사용한다.
- **수용 기준**: 예약 상세 DOM에서 pending checkpoint에 `Reopen/Reset` 0개, 각 완료 동사 1개, `Could not confirm`은 사유 입력을 거친다.
- **권장 명령**: `$impeccable harden`

### [P0] RA-002 — 환불 상태와 summary를 서버 소유 단일 계약으로 통일

- **문제**: 상단 `State mismatch 3`인데 첫 페이지에는 3개를 넘는 행이 mismatch로 보인다. `page.tsx`는 KPI에 `summary.stateMismatchCount`를 사용하면서 행은 별도 `refundHasStateMismatch()`로 다시 판정한다.
- **수정**: API가 각 refund에 `operationalStage`, `stateMismatchReason`, `nextAction`, `assignee`를 제공하고 summary도 같은 쿼리/규칙으로 집계한다. UI는 재해석하지 않는다.
- **수용 기준**: `state-mismatch` 필터 total, KPI, pagination total, 첫 페이지 mismatch 개수가 동일 규칙으로 설명된다. `Open cases`와 `Awaiting decision`이 동일 112라면 포함 관계를 명시하거나 단계형 상호 배타 집합으로 바꾼다.
- **권장 명령**: `$impeccable harden`

### [P1] RA-003 — Live/Data anomaly/Test data를 쿼리 단계에서 분리

- **문제**: 19d/46d 예약, 74~77d 대기열, 75d 알림, Smoke/Demo가 현재 업무로 보인다.
- **수정**: 공통 필드 `dataClass = live | backlog | anomaly | test`, `scopeStart/End`, `lastEventAt`, `sourceUpdatedAt`을 서버 read model에 추가한다. 기본 운영 큐는 `test` 제외, 시간 초과 활성은 `anomaly`만 포함한다.
- **수용 기준**: 기본 Live/Start Shift/Support 큐의 Smoke/Demo 0건. 정책 시간을 넘은 활성 레코드는 Live KPI 0건, Data anomaly에는 같은 건이 보인다.
- **권장 명령**: `$impeccable clarify`

### [P1] RA-004 — Booking Detail을 결정 1개 중심으로 축소

- **문제**: 최신 소스가 버튼 문구는 고쳤지만 상단은 여전히 섹션 링크 → Needs action → 4카드 → no-show 폼 순서다. 운영자는 한 번에 어떤 결정을 내려야 하는지보다 가능한 조작을 먼저 본다.
- **수정**: 고정 Decision Strip에 상태/SLA/assignee/연락/위치/결제/권장 행동을 한 줄로 보여준다. 4개 checkpoint는 조밀한 행으로 만들고 선택된 행만 action을 연다. no-show/cancel/expiry는 `Cannot complete service` 하나 아래 상호 배타 옵션으로 둔다.
- **수용 기준**: 1440px 첫 viewport에서 권장 행동, 핵심 근거, 담당자가 동시에 보이고 primary CTA는 하나다.
- **권장 명령**: `$impeccable distill`

### [P1] RA-005 — Notification을 사례가 아니라 incident 중심으로 집계

- **문제**: Needs retry 747, unresolved failures 412, failed attempts 439, delivery gaps 451 등 설명은 좋아졌지만 동일 기술 원인으로 반복된 행을 운영자가 하나씩 처리해야 한다. 75d 실패도 SLA overdue다.
- **수정**: provider/failureCode/time window별 incident를 만들고 `영향 사용자`, `영향 알림`, `첫 발생`, `최근 발생`, `owner`, `customer fallback`을 표시한다. 24h 이상 과거 실패는 historical/data cleanup으로 보낸다.
- **수용 기준**: 같은 원인의 100개 실패가 1 incident로 보이고, Support는 연락 대상만, Platform owner는 기술 조치만 본다.
- **권장 명령**: `$impeccable clarify`

### [P1] RA-006 — Partner Approval의 0건/전용 필터 계약

- **문제**: 0건인데 디렉터리용 정렬과 Export가 첫 화면 대부분을 차지한다.
- **수정**: approval에서는 Search, Waiting age, Missing item, Risk flag만 노출한다. 0건이면 필터·Export를 접고 `Held/Rejected 보기`, `Partner directory 열기`만 제공한다.
- **수용 기준**: 0건 화면의 첫 viewport에서 빈 상태와 다음 목적지가 바로 보이고 Revenue/Wallet debt/Bookings 정렬은 없다.
- **권장 명령**: `$impeccable distill`

### [P2] RA-007 — Customers를 지원 탐색 화면으로 마무리

- **문제**: `aligned to the Vuexy management table`와 네 카드의 성별 미수집 분포가 운영 목적보다 앞선다.
- **수정**: 설명을 `Find a customer and resolve booking, payment, wallet, or review issues.`로 교체한다. KPI는 Needs attention, Active booking, New today만 남기고 Support 기본 뷰는 Needs action으로 둔다. 성별은 분석/고급 필터로 이동한다.
- **수용 기준**: 첫 업무 행이 1440px 첫 viewport에 보이고 구현 기술 문구와 성별 KPI가 없다.
- **권장 명령**: `$impeccable clarify`

### [P2] RA-008 — Finance의 Today와 All-open 의미를 시각적으로 분리

- **문제**: `Today Money Risk` 카드가 `Open Refunds 0 VND / 112`, `Unmatched Bank 13.4M / 44 across all dates`를 Today 배지 아래 보여 준다.
- **수정**: `Today movement`와 `Current open backlog` 탭을 분리한다. 금액 집계 불가 시 `Amount unavailable`을 사용한다. Command 기본 화면에서는 Monthly tax period와 tax 전문 카드를 숨긴다.
- **수용 기준**: Today 영역의 모든 count/amount가 today query만 사용하고, all-date 값은 Current backlog에만 보인다.
- **권장 명령**: `$impeccable organize`

### [P2] RA-009 — Handoff와 History의 데이터 모델 분리

- **문제**: History 안에 Incomplete handoff와 Write note가 있어 읽기 전용 기록인지 현재 인계인지 다시 혼합된다.
- **수정**: `ShiftHandoff`에 outgoing shift, incoming operator, unresolved case IDs, owner, note, acknowledgedBy/At를 저장한다. API가 없으면 History에서는 쓰기 요소를 제거하고 기능 미지원으로 표시한다.
- **수용 기준**: History는 읽기 전용이며 현재 Handoff의 모든 미해결 건에 owner/assignee가 있고 수신 확인이 감사 가능하다.
- **권장 명령**: `$impeccable organize`

### [P2] RA-010 — 화면 상단의 KPI/필터 반복 제거

- **문제**: Booking, Customers, Refunds, Notifications, Operations History에서 같은 count가 KPI·탭·필터·section badge로 반복된다.
- **수정**: 페이지당 `작업 요약 한 줄 + 큐 탭 + 결과 표`를 기본 구조로 사용한다. 고급 필터와 참고 지표는 disclosure에 둔다.
- **수용 기준**: 같은 count가 첫 viewport에서 최대 두 번만 보이고, 첫 사례 행이 필터보다 먼저 또는 같은 viewport에 보인다.
- **권장 명령**: `$impeccable distill`

### [P3] RA-011 — 시각 토큰과 액션 위계 마감

- **문제**: Start Shift에서 큰 분홍 영역 세 개가 모두 같은 긴급도로 보이고, 중립 링크/primary 버튼 구분도 약하다.
- **수정**: danger는 즉시 차단/고객·금액 위험에만 사용하고 overdue backlog는 warning, historical/anomaly는 neutral로 구분한다. 페이지당 primary CTA 하나를 유지한다.
- **수용 기준**: 흑백/색각 차이에서도 텍스트·아이콘·위치로 우선순위를 구분할 수 있다.
- **권장 명령**: `$impeccable polish`

## 6. 화면별 상세 판정 및 캡처

### 6.1 Start Shift — 부분 개선, 건강도 2.5/4

- 좋아짐: 최상위 3개 대기열, queue/item 구분, owner/oldest/impact, 정상 큐 접기, live updated가 보인다.
- 남음: 994건을 현재 shift로 보이며 74~77일 건이 모두 큰 위험색이다. My queue/Unassigned/Data anomaly가 없다.
- 제안: top 3은 실제 case 3건으로 바꾸고, 오래된 적체는 Data anomaly/Backlog summary로 분리한다.

![Start Shift](C:/dev/massage-on-demand-vn/output/admin-operator-reaudit-2026-08-04/01-start-shift.png)

### 6.2 Booking Monitor — 부분 개선, 건강도 2/4

- 좋아짐: `Needs action` 기본 작업 설명, Next action 열, advanced filter 접기, Pause live가 명확하다.
- 남음: KPI와 탭 count 중복, 19d/46d 활성, Smoke 레코드, `Customer 400.000 / min 300.000` 의미 불명확, 첫 표 행이 화면 하단에 걸린다.
- 제안: live/anomaly/test 분리 후 `Customer charge`와 `Partner payout`을 별도 라벨로 쓴다.

![Booking Monitor](C:/dev/massage-on-demand-vn/output/admin-operator-reaudit-2026-08-04/02-live-bookings.png)

### 6.3 Booking Detail — 최신 소스 미배포, 건강도 2/4

- 좋아짐: Needs action 1건과 섹션 점프가 추가됐다. 최신 소스에는 구체 동사와 차단 사유 흐름이 있다.
- 남음: 실행본은 4개 카드마다 같은 3버튼을 노출하고 no-show form을 즉시 펼친다. 고정 Decision Strip이 없다.
- 제안: 최신 빌드 반영을 먼저 확인한 뒤 카드 4개를 행으로 압축하고 하나의 권장 행동만 강조한다.

![Booking Detail](C:/dev/massage-on-demand-vn/output/admin-operator-reaudit-2026-08-04/03-booking-detail.png)

### 6.4 Customers — 미해결, 건강도 2/4

- 좋아짐: Needs action 뷰, customer attention, push reachable, 고급 필터 접기가 있다.
- 남음: Vuexy 설명, 7 KPI, 성별 미수집 분포 4회, All customers 기본값이 지원 업무를 가린다.
- 제안: 지원 사례 3 KPI와 Needs action 기본값으로 축소한다.

![Customers](C:/dev/massage-on-demand-vn/output/admin-operator-reaudit-2026-08-04/04-customers.png)

### 6.5 Partner Approvals — 미해결, 건강도 1/4

- 좋아짐: approval 제목, oldest pending, age/SLA 개념은 맞다.
- 남음: 0건인데 4개 검색 필터, 8개 정렬, age/order/SLA, Export가 모두 보인다.
- 제안: approval 전용 최소 필터와 목적 있는 빈 상태만 남긴다.

![Partner Approvals](C:/dev/massage-on-demand-vn/output/admin-operator-reaudit-2026-08-04/05-partner-approvals.png)

### 6.6 Finance Overview — 개선됨/부분 개선, 건강도 3/4

- 좋아짐: Needs Action Now 카드에 owner, assignee, oldest, impact와 queue CTA가 있다. Current balance/Month close를 구분했다.
- 남음: Command에 tax period가 노출되고 Today Money Risk에 all-date 수치가 섞인다.
- 제안: Today movement와 Current backlog를 다른 탭으로 강제한다.

![Finance Overview](C:/dev/massage-on-demand-vn/output/admin-operator-reaudit-2026-08-04/06-finance-overview.png)

### 6.7 Operations History — 부분 개선, 건강도 2.5/4

- 좋아짐: 페이지명과 설명이 History로 통일되고 Last 7 days 범위가 명확하다.
- 남음: History 안에 Incomplete handoff와 Write note가 있어 읽기/쓰기 경계가 다시 흐려진다. KPI·checklist·issue lane도 중복된다.
- 제안: 현재 Handoff를 별도 실체로 구현하고 History는 완전한 읽기 전용으로 둔다.

![Operations History](C:/dev/massage-on-demand-vn/output/admin-operator-reaudit-2026-08-04/07-operations-history.png)

### 6.8 Refunds — 부분 개선·새 집계 회귀, 건강도 2/4

- 좋아짐: State mismatch queue, Evidence/Payment/Next action 열, 간결한 행 구조가 생겼다.
- 남음: 상단 `State mismatch 3`과 보이는 다수 mismatch 행이 충돌한다. Open cases와 Awaiting decision도 모두 112다. 필터가 표보다 한 화면 이상 먼저 나온다.
- 제안: 상태·집계 단일 서버 계약, assignee, 상호 배타 단계, 필터 1행 축소를 우선한다.

![Refund Filters](C:/dev/massage-on-demand-vn/output/admin-operator-reaudit-2026-08-04/08-refunds.png)

![Refund Queue](C:/dev/massage-on-demand-vn/output/admin-operator-reaudit-2026-08-04/08b-refund-queue.png)

### 6.9 Notifications — 부분 개선, 건강도 2.5/4

- 좋아짐: 지원 작업·기기·역사 구분, 단위 설명, `Push unavailable · contact by phone` 문구가 좋아졌다.
- 남음: 747/451/93/412/439 등 서로 다른 집합이 여전히 큰 카드로 경쟁한다. 75일 실패가 current overdue이고 FCM policy/setup이 Support 첫 흐름에 남는다.
- 제안: incident grouping, historical SLA 제외, Support/Platform owner 분리, 기술 상세 disclosure를 적용한다.

![Notification Overview](C:/dev/massage-on-demand-vn/output/admin-operator-reaudit-2026-08-04/09-notification-failures.png)

![Notification Queue](C:/dev/massage-on-demand-vn/output/admin-operator-reaudit-2026-08-04/09b-notification-queue.png)

### 6.10 Customer Detail — 개선됨, 건강도 3.5/4

- 좋아짐: 예외 1건을 최상단에 두고 owner와 Review messages를 제공한다. 읽기 상태가 먼저이며 wallet/message/note는 URL로 한 작업만 연다.
- 남음: `Open technical diagnostics`가 일반 페이지 action과 같은 수준이다. Smoke 고객이 운영 화면에 노출된다.
- 제안: diagnostics는 권한 기반 Developer disclosure로 낮추고 test badge/격리를 적용한다.

![Customer Detail](C:/dev/massage-on-demand-vn/output/admin-operator-reaudit-2026-08-04/10-customer-detail.png)

### 6.11 Wallet Adjustments — 개선됨, 건강도 4/4

- 좋아짐: owner type + 검색, preview required, 별도 승인자, 고액 증거, 세금 민감 증거, 요청/실행 이력 분리가 명확하다.
- 유지 조건: raw ID 입력을 다시 열지 말고 maker/checker, idempotency, immutable ledger 연결을 회귀 테스트로 계속 보호한다.

![Wallet Adjustments](C:/dev/massage-on-demand-vn/output/admin-operator-reaudit-2026-08-04/11-wallet-adjustments.png)

## 7. 운영자 페르소나 재점검

**숙련 운영자**

- Start Shift와 Finance의 top queue CTA는 빨라졌다.
- Partner 0건 필터, Refund/Notification의 필터 벽은 여전히 반복 작업을 느리게 한다.
- assignee가 실제로 저장·필터되는 공통 계약이 없어 개인 작업량 관리가 어렵다.

**신규 운영자**

- owner, oldest, next action이 추가돼 이전보다 이해하기 쉽다.
- Today인데 all-date 숫자가 나오고, Open/Awaiting가 같은 112이며, live에 46d 사례가 있어 화면 의미를 신뢰하기 어렵다.
- Vuexy/FCM/raw enum은 교육 비용을 남긴다.

**키보드·스크린리더 사용자**

- 알림 버튼의 접근 가능한 이름과 heading 구조는 좋아졌다.
- 반복 KPI와 긴 필터 그룹은 선형 탐색 비용이 크다.
- 이번 감사는 전체 키보드 시나리오와 200% 확대를 다시 실행하지 않았으므로 WCAG 준수를 주장하지 않는다.

## 8. 디자인 특이성 판정

**수동 평가**: HANDS 도메인 문구와 데이터는 더 구체적이 됐다. 특히 booking lifecycle, partner payout, cash debt, refund mismatch, notification fallback은 일반 템플릿보다 도메인성이 높다. 반면 화면 구성은 여전히 `큰 KPI 카드 → 큰 필터 카드 → 큰 표`가 반복돼 다른 관리자 제품으로 교체해도 구조가 거의 같다. 다음 차별화는 색이나 카드가 아니라 `queue → case → decision → handoff`를 모든 업무에서 같은 방식으로 제공하는 데서 나와야 한다.

**자동 검사**: 수동 평가를 끝낸 뒤 대표 TSX 12개에 `detect.mjs --json`을 한 번 실행했고 결과는 `[]`였다. 코드 패턴 위반은 찾지 못했지만, 집계 불일치·역사 데이터·필터 과밀·배포 드리프트는 이 검사 범위 밖이다.

## 9. 코드 근거

- 공통 상단 접근성/Policy: `apps/admin_web/components/admin-workspace-header.tsx:155`, `:164`
- Customers Vuexy 문구: `apps/admin_web/app/customers/page.tsx:55`
- Customers 성별 KPI: `apps/admin_web/app/customers/customer-management-view-model.ts:79`, `:244`
- Booking 구체 동사/차단 사유/Reopen 제한: `apps/admin_web/app/bookings/[id]/booking-action-status-sections.tsx:382`, `:393`, `:399`
- Booking no-show 최신 문구: `apps/admin_web/app/bookings/[id]/booking-action-status-sections.tsx:603`, `:626`
- Refund KPI summary 사용: `apps/admin_web/app/refunds/page.tsx:59`, `:85`
- Refund 행 별도 mismatch 판정: `apps/admin_web/app/refunds/page.tsx:175`, `:202`
- Finance all-date 값을 Today 섹션에 노출: `apps/admin_web/app/finance-overview/finance-overview-model.ts:752`
- Notification 단위 설명: `apps/admin_web/app/notifications/notification-page-model.ts:823`, `:858`, `:920`
- Notification 행동 문구: `apps/admin_web/app/notifications/notification-delivery-cell.tsx:99`
- Partner approval에서 디렉터리 정렬 유지: `apps/admin_web/app/partners/partner-filter-board.tsx:244`
- Operations History 제목: `apps/admin_web/app/operations-handoff/page.tsx:477`

## 10. 구현 순서

1. RA-001 실행본/소스 build ID 일치 및 최신 화면 재검증
2. RA-002 환불 단일 상태/집계 계약
3. RA-003 live/anomaly/test 데이터 격리
4. RA-004 예약 Decision Strip, RA-005 notification incident grouping
5. RA-006 Partner approval, RA-007 Customers, RA-008 Finance 정보 밀도 축소
6. RA-009 Handoff 모델, RA-010 반복 제거
7. RA-011 시각 마감과 1440/1980/1024/200%·키보드 재검증

## 11. 검증 체크리스트

- 동일 build ID로 11개 경로 캡처
- Refund KPI/filter/pagination/row 판정 일치 contract test
- Live booking 시간 경계와 anomaly 이동 unit test
- Smoke/Demo 기본 제외와 QA opt-in test
- Notification incident grouping 및 historical SLA 제외 test
- Partner approval 0건에서 Export/고급 정렬 미노출 test
- Customers 기본 3 KPI와 Needs action view test
- Finance Today query에 all-date 값 미포함 test
- Booking pending checkpoint에 Reopen/Reset 없음, Block 사유 필수, no-show 확인 단계 test
- 기존 ADM-001~029 및 역할/권한/개인정보/지갑/감사 회귀 테스트 유지

## 12. 소규모 관찰

- 대부분의 페이지에서 상단 본문 카드 높이를 20~30% 줄여도 정보 손실이 없다.
- `record(s)`, `booking(s)`, `row(s)`는 운영 문구에서 자연스러운 복수형으로 정리할 수 있다.
- Customer Detail의 기술 진단 버튼은 운영 action보다 낮은 위치가 적절하다.
- Start Shift의 More actions는 현재 목적지가 보이지 않아 발견성과 신뢰가 낮다.
- 알림 표의 긴 사용자/타입/제목 셀은 2행 요약 + row detail로 줄일 수 있다.

## 13. 질문 및 실행 기록

- **질문 생략**: 로그인 상태, 요구 문서, 이전 캡처, 현재 코드가 충분해 감사 진행을 막는 질문은 없었다.
- **브라우저**: 현재 실행본에 읽기 전용으로 접근했다. 실제 업무 데이터는 변경하지 않았다.
- **테스트**: 7 files / 62 tests PASS.
- **자동 detector**: 12개 대표 TSX, 결과 0건.
- **제약**: 저장소 정책상 단일 에이전트만 사용해 병렬 디자인 관점 교차검증은 수행하지 못했다.
- **핵심 한계**: 3101 실행본이 최신 소스보다 오래됐다. 최신 build 재캡처 전에는 미배포 개선을 운영 완료로 판정할 수 없다.
