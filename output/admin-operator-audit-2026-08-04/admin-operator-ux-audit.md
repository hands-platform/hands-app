⚠️ DEGRADED: single-context (repository policy requires a single-agent workflow)

# HANDS 관리자 웹 운영자 UX 감사

- 감사일: 2026-08-04
- 대상: `C:\dev\massage-on-demand-vn\apps\admin_web`
- 방법: 로그인된 Chrome에서 실제 화면 10개를 캡처·DOM 확인하고, 관련 Next.js/React 코드를 대조했다.
- 범위: 정보구조, 운영 흐름, 문구, 오류 예방, 시각 위계, 접근성 단서, 구현 우선순위
- 비범위: 실제 데이터 변경, 환불/노쇼/파트너 승인 실행, 완전한 WCAG 적합성 시험

## 1. 결론

현재 관리자 웹은 업무 기능과 데이터는 풍부하지만, 실제 운영자의 “다음 행동”을 중심으로 조직된 콘솔이 아니라 개발된 기능을 모두 펼쳐 놓은 기능 지도에 가깝다. 가장 큰 문제는 다음 세 가지다.

1. **행동 안전성**: 예약 상세에서 `Mark done / Blocked / Reset`이 같은 무게로 반복되고, 노쇼 확정 폼이 판단 근거와 분리된 채 바로 노출된다.
2. **데이터 신뢰성**: 라이브 큐에 19일·46일 된 예약이 남아 있고, 실패 알림은 75일 전 항목까지 현재 조치 대상으로 표시된다. 데모/Smoke 데이터도 운영 데이터와 섞인다.
3. **인지 부하**: 11개 섹션·62개 내비게이션 링크, 중복 제목, 반복 KPI와 필터 배지, 한 행 안의 장문 운영 설명 때문에 우선순위가 묻힌다.

방향은 화면을 새로 많이 만드는 것이 아니다. 기존 공통 셸과 컴포넌트를 고쳐 모든 페이지를 **큐 → 사례 → 결정 → 인계**라는 하나의 운영 모델로 통일하는 것이 가장 작고 효과적인 해법이다.

## 2. 디자인 건강 점수

| # | 휴리스틱 | 점수 | 핵심 문제 |
|---|---|---:|---|
| 1 | 시스템 상태 가시성 | 3/4 | 수치와 상태는 풍부하지만, 데이터 시점·담당자·마지막 조치가 없다. |
| 2 | 실제 업무 언어와의 일치 | 2/4 | Vuexy, FCM, ledger, closeout 등 구현/회계 언어가 운영 문구에 노출된다. |
| 3 | 사용자 통제와 자유 | 2/4 | 필터와 이동 경로는 많지만, 위험 작업의 되돌리기·재개·근거 확인 흐름이 약하다. |
| 4 | 일관성과 표준 | 2/4 | 상단 제목/본문 제목, 메뉴명/페이지명, Today/All dates의 의미가 충돌한다. |
| 5 | 오류 예방 | 1/4 | 예약 상세의 동등한 상태변경 버튼과 즉시 노쇼 확정 흐름이 실수 가능성을 높인다. |
| 6 | 기억보다 인식 | 2/4 | 큐 카드는 있으나 사례 판단 근거가 여러 페이지와 긴 세로 화면에 흩어진다. |
| 7 | 유연성과 효율 | 2/4 | `Ctrl K` 검색은 있으나 역할별 메뉴, 즐겨찾기, 내 할 일, 빠른 할당이 없다. |
| 8 | 미학적·최소주의적 디자인 | 2/4 | 시각 스타일은 정돈됐지만 카드·배지·설명의 반복이 핵심 행동을 가린다. |
| 9 | 오류 인지·복구 | 2/4 | 실패 원인은 일부 설명하지만, 담당자 지정·재시도 조건·재개 이력은 일관되지 않다. |
| 10 | 도움말과 문서 | 2/4 | 정책 페이지는 있으나 상단 `Help`가 실제 도움말이 아니고 의사결정 지점의 문맥 도움말이 부족하다. |
| **합계** |  | **20/40** | **Acceptable — 기능 기반은 있으나 운영 만족을 위해 큰 개선이 필요** |

## 3. 디자인 특이성 판정

**수동 평가**: 데이터와 업무 규칙은 HANDS의 예약·파트너·환불·현금 정산 도메인에 맞게 상당히 구체적이다. 반면 시각 구성은 KPI 카드, 필터 칩, 장문 테이블을 반복하는 범용 Vuexy 관리자 템플릿에 가깝다. HANDS만의 운영 모델인 실시간 매칭, 고객 선택, 파트너 이동, 서비스 완료, 현금 부채, 교대 인계가 하나의 일관된 작업 흐름으로 표현되지 않아 다른 마켓플레이스 관리자 화면으로 교체해도 구조적 차이가 작다.

**자동 검사**: 대표 TSX 13개에 `detect.mjs --json`을 실행한 결과는 0건이었다. 이 검사는 코드 패턴 기반이므로, 실제 데이터의 시간 범위 충돌·중복 정보·작업 소유권 부재·위험 행동 위계 문제를 잡지 못했다. 추가 자동 발견이나 오탐은 없었다.

**시각 오버레이**: Chrome의 로그인 상태를 보존한 읽기 중심 검사 흐름에서는 신뢰할 수 있는 오버레이를 주입하지 않았다. 대신 저장 스크린샷, DOM 스냅샷, 소스 위치를 교차 증거로 사용했다.

## 4. 전체 인상

화면은 깨끗하고 데이터도 많지만, 운영 콘솔이 가장 먼저 답해야 할 `지금 가장 위험한 실제 사례는 무엇이고, 누가, 언제까지, 어떤 근거로 무엇을 해야 하는가?`에 답하지 못한다. 가장 큰 기회는 장식이나 새 컴포넌트가 아니라 모든 화면을 하나의 작업 큐 계약과 안전한 사례 결정 흐름으로 통일하는 것이다.

## 5. 잘 작동하는 기반

- 시작 화면에 SLA, 금액, 오래된 건수를 노출한 의도는 맞다. 운영자는 문제가 있다는 사실을 즉시 인지할 수 있다.
- 환불과 알림 화면에는 증거 확인, 고객 안내, 결제 원장 정합성 같은 업무 규칙이 이미 문구로 존재한다. 이 내용을 긴 설명으로 두지 말고 사례별 체크리스트와 결정 가드로 재배치하면 된다.
- `AdminPageTemplate`, `AdminWorkspaceHeader`, `AdminShellNav`, 공통 카드·필터 컴포넌트가 있어 공통 셸을 고치면 다수 화면을 함께 개선할 수 있다.
- 기존 의존성인 Lucide, Recharts, FullCalendar와 현재 Vuexy 계열 스타일만으로 충분하다. 새 UI 라이브러리는 필요 없다.

## 6. 최우선 문제

### [P1] 상태 변경이 판단 흐름보다 먼저 보인다

- **증거**: 예약 상세의 열린 체크포인트마다 `Mark done`, `Blocked`, `Reset` 3개가 같은 강조색과 크기로 반복된다. 바로 아래에는 `Confirm no-show` 폼이 노출된다.
- **왜 문제인가**: 통화·위치·결제 증거를 확인하기 전에 잘못된 상태를 기록하거나 노쇼를 확정할 수 있다. 금융·고객 보상·파트너 성과에 연쇄 영향을 줄 수 있다.
- **요건**:
  - 상단에 하나의 `권장 다음 행동`만 기본 강조한다.
  - 체크포인트는 카드가 아니라 체크리스트 행으로 만들고, 선택된 행에만 주 행동을 표시한다.
  - `Blocked`는 사유와 재확인 시각을 필수로 받는다.
  - `Reset`은 완료된 항목에만 `… > 체크 다시 열기`로 제공하고 사유를 남긴다.
  - 노쇼는 `서비스를 완료할 수 없음` 결정 흐름 안으로 이동하고, 고객 연락·파트너 도착·위치·결제 증거 요약을 확인한 뒤 최종 확인한다.
  - 모든 변경에 작업자, 시각, 이전 상태, 근거 노트를 같은 자리에서 보여준다.
- **수용 기준**: 위험한 상태 변경은 한 화면에서 근거를 확인할 수 있고, 이유 없는 확정/차단/재개는 제출되지 않는다.
- **권장 명령**: `$impeccable harden`

### [P1] 라이브 큐와 운영 데이터의 신뢰도가 낮다

- **증거**: `Live Bookings`에 19일·46일 된 건이 남아 있고, 알림 실패 큐는 75일 전 건을 현재 조치 대상으로 제시한다. `Smoke`, `Demo Customer`, `Demo Partner`가 일반 운영 데이터와 섞인다.
- **왜 문제인가**: 운영자는 숫자를 믿지 않게 되고, 실제 긴급 건도 테스트/누적 부채로 오인한다.
- **요건**:
  - 라이브 큐는 상태와 시간 조건을 모두 만족한 사례만 포함한다.
  - 비정상적으로 오래된 활성 건은 `데이터 이상` 큐로 격리하고 원래 라이브 KPI에서 제외한다.
  - 데모·Smoke 데이터는 환경 배지와 함께 별도 필터로 분리하며 기본값에서 숨긴다.
  - 모든 큐에 `마지막 동기화`, `데이터 범위`, `미처리/누적/역사`를 명시한다.
  - 동일 개념의 수치가 화면마다 달라질 때 계산 기준을 툴팁으로 노출한다.
- **수용 기준**: `Live` 화면에는 SLA 범위를 벗어난 역사 데이터가 없고, 운영자가 모든 KPI의 시간 범위와 계산 기준을 한 번의 확인으로 알 수 있다.
- **권장 명령**: `$impeccable clarify`

### [P1] 내비게이션이 역할이 아니라 코드 기능 단위로 구성됐다

- **증거**: 11개 섹션, 62개 링크, 75개 페이지 경로가 있다. 일상 운영 메뉴와 월마감·제한 설정·개발자 도구가 같은 깊이에서 경쟁한다.
- **왜 문제인가**: 신규 운영자는 어디서 시작해야 할지 모르고, 숙련자는 반복 업무까지 여러 그룹을 열어야 한다.
- **요건**:
  - 1차 메뉴를 `Shift command / Live service / Support cases / Partner review / Money actions / Handoff` 6개로 제한한다.
  - 기록·월마감·정책·설정·개발 도구는 `Records & settings` 아래 2차 영역으로 이동한다.
  - 역할에 따라 기본 메뉴를 다르게 표시한다: Dispatcher, Support, Partner Ops, Finance, Shift Lead, Admin.
  - `내 할 일`, `최근 본 사례`, `즐겨찾기`를 상단 검색에 추가한다.
  - 페이지 이름과 메뉴 이름을 하나로 통일한다. `Operations History`와 `Handoff`를 혼용하지 않는다.
- **수용 기준**: 신규 운영자가 첫 5초 안에 자신의 작업 큐를 찾고, 반복 업무는 최대 2번의 클릭으로 열린다.
- **권장 명령**: `$impeccable distill`

### [P2] 페이지가 상태를 설명하지만 행동을 지정하지 않는다

- **증거**: 시작 화면의 `Resolve overdue`, 환불 화면의 장문 `Ops hint`, 알림 화면의 일반적인 `Review retries`는 어느 사례를 누가 어떻게 처리할지 직접 말하지 않는다.
- **왜 문제인가**: 운영자가 설명을 읽고 다시 판단해야 하며, 소유권과 완료 조건이 없다.
- **요건**:
  - 모든 작업 큐의 공통 필드를 `우선순위 / 사례 / 고객·파트너 / 다음 행동 / 담당자 / SLA / 마지막 조치 / 금액 영향`으로 정의한다.
  - CTA는 목적지가 아니라 동사와 대상을 쓴다. 예: `가장 오래된 환불 검토`, `파트너에게 연락`, `결제 원장 확인`.
  - 카드 전체를 모호하게 클릭시키지 말고 명시적 CTA를 둔다.
  - 장문 설명은 행 확장/사이드 패널로 옮기고 기본 행은 한두 줄로 제한한다.
- **수용 기준**: 목록만 보고도 누가 무엇을 언제까지 해야 하는지 알 수 있다.
- **권장 명령**: `$impeccable clarify`

### [P2] 공통 셸이 공간과 주의를 낭비한다

- **증거**: breadcrumb의 현재 페이지, 상단 굵은 제목, 본문 H1이 같은 제목을 반복한다. Light/Dark 두 버튼, Help, 알림, 지역, Live Workspace, 로그아웃이 항상 노출된다.
- **왜 문제인가**: 실제 업무 화면보다 셸이 먼저 보이고, 페이지마다 고유한 행동이 약해진다.
- **요건**:
  - 상단에는 breadcrumb 또는 H1 중 하나만 주 제목으로 사용한다.
  - 라이트/다크는 하나의 토글 또는 사용자 메뉴 안으로 이동한다.
  - `Vietnam Operations`는 지역 전환이 없으면 제거한다.
  - `Live Workspace`는 제거하거나 실제 연결 상태와 데이터 시각을 표시하는 `Live · updated 12s ago`로 바꾼다.
  - `Help`는 작업별 도움말을 여는 패널로 바꾸고 정책은 별도 `Policy` 링크로 둔다.
  - 알림 버튼에 접근 가능한 이름을 추가한다.
- **수용 기준**: 공통 셸 높이와 액션 수가 줄고, 각 페이지의 첫 화면에서 주 작업이 스크롤 없이 보인다.
- **권장 명령**: `$impeccable layout`

## 7. 운영자 페르소나 점검

**Alex — 숙련 운영자**

- `Ctrl K` 검색은 유용하지만 62개 목적지 검색에 머물고, 내 할 일·최근 사례·담당자 할당을 가속하지 못한다.
- 가장 오래된 환불 한 건을 처리하려면 대시보드 큐 → 환불 화면 → 필터 → 행 → 예약/결제 근거로 계속 이동해야 한다.
- 승인 큐는 0건이어도 정렬·기간·SLA 필터가 모두 보여 숙련자의 속도를 오히려 떨어뜨린다.

**Jordan — 신규 운영자**

- `Start Shift`, `Operations History`, `Handoff`의 관계가 모호하고, 페이지/메뉴 제목도 서로 다르다.
- FCM_HTTP_V1, ledger, closeout, MATCHED/PENDING 같은 용어가 실제 다음 행동보다 앞선다.
- 모든 긴급 카드가 같은 빨강이고 `Resolve overdue`가 대상을 특정하지 않아 첫 행동을 확신하기 어렵다.

**Sam — 키보드·스크린리더 사용자**

- 상단 알림 아이콘 버튼은 DOM에서 접근 가능한 이름이 없었다.
- 중복된 breadcrumb/상단 제목/H1과 긴 테이블 행은 선형 탐색 비용을 크게 만든다.
- 1024px 미만을 전면 차단하고 많은 테이블이 큰 최소 폭을 가지므로 200% 확대 시 핵심 행동과 근거를 동시에 보기 어렵다.

## 8. 소규모 관찰

- `Help` 아이콘은 도움말이 아니라 Operations Policy로 이동한다.
- 현재 메뉴 레이블 다수가 아이콘 맵에 없어 `Activity` 또는 `UserRoundCog` fallback으로 보인다.
- 데스크톱 전용 게이트와 모바일 사이드바 상태가 동시에 존재해 제품 정책과 구현이 어긋난다.
- KPI 카드의 성별 미수집 데이터, 0건 큐, 정상 상태 카드가 작업 화면의 첫 뷰를 차지한다.
- 알림 페이지는 Customer Support 안에서 개발자 진단과 고객 지원 행동을 섞는다.
- 실패 알림의 고객 전화번호가 목록에서 그대로 노출된다. 기본 마스킹과 조회 감사가 필요하다.

## 9. 목표 운영 모델과 정보구조

### 9.1 전역 구조

```text
Shift command
├─ My queue
├─ Unassigned
├─ Escalations
└─ Data health

Live service
├─ Matching
├─ Customer choice
├─ Partner en route
├─ In service
└─ Closeout

Support cases
├─ Customer cases
├─ Refund decisions
├─ Notification failures
└─ Reviews / chat evidence

Partner review
├─ Approvals
├─ Holds / risk
└─ Availability / performance

Money actions
├─ Refunds
├─ Reconciliation
├─ Cash debt
└─ Payout risk

Handoff
├─ Current shift handoff
└─ Completed handoffs

Records & settings
├─ Historical records
├─ Monthly close / tax
├─ Policy / restricted settings
└─ Developer / system
```

### 9.2 공통 큐 계약

모든 운영 큐는 서로 다른 카드 디자인을 만들지 말고 다음 필드를 공유한다.

| 필드 | 의미 | 표시 규칙 |
|---|---|---|
| Priority | 금액·고객 영향·안전·SLA를 종합한 순위 | P1/P2/P3 + 이유 한 줄 |
| Case | 예약/환불/알림/파트너 승인 | 사람이 읽는 제목 + 짧은 ID |
| People | 고객/파트너 | 이름 기본, 연락처 마스킹 |
| Next action | 지금 할 일 | 동사형 1줄 |
| Owner | 업무 소유 팀 | Support/Finance 등 |
| Assignee | 현재 담당자 | 미지정이면 바로 할당 가능 |
| SLA | 남은/초과 시간 | `23m left`, `2h overdue` |
| Last action | 마지막 시도 | 작업자·시각·결과 |
| Impact | 금액/서비스 영향 | 관련 있을 때만 표시 |

### 9.3 사례 상세의 기본 레이아웃

- 왼쪽 상단: 상태, SLA, 담당자, 고객/파트너, 서비스 주소, 결제 상태
- 중앙 상단: `권장 다음 행동` 1개와 선택 이유
- 중앙: 진행 체크리스트와 증거 요약
- 오른쪽 패널: 통화/채팅/위치/결제 기록
- 하단 탭: 전체 타임라인, 운영 기록, 개발 진단
- 위험 행동: 기본 화면에서 숨기지 않되, 정상 행동과 같은 강조를 쓰지 않고 근거·사유·확인을 요구

## 10. 화면별 상세 요건

### 화면 1 — 로그인

![로그인](C:/dev/massage-on-demand-vn/output/admin-operator-audit-2026-08-04/01-login.png)

**상태: 주의**

- 큰 왼쪽 비주얼 영역은 내부 도구의 로그인 목표에 비해 공간을 많이 사용한다.
- 영어 일반 문구와 일반 오류만 있고 비밀번호 재설정·관리자 지원 경로가 명확하지 않다.

**요건**

- 로그인 카드를 화면 중심으로 가져오고 좌측 비주얼은 축소하거나 운영 공지/환경 표시로 사용한다.
- `Production / Staging / Local` 환경을 명확히 표시한다.
- 실패 시 `자격 증명 오류`, `권한 없음`, `서버 연결 실패`를 구분하되 보안 세부정보는 노출하지 않는다.
- `Access problem? Contact admin` 또는 승인된 복구 경로를 제공한다.

### 화면 2 — Start Shift

![Start Shift](C:/dev/massage-on-demand-vn/output/admin-operator-audit-2026-08-04/02-start-shift.png)

**상태: 위험**

- `7 queues need attention · 993 total items` 아래의 주요 카드가 모두 같은 붉은 톤이라 실제 우선순위가 없다.
- 환불 112건/최장 77일, 알림 실패 412건/최장 75일, 결제 보류 373건/최장 74일이 `현재 교대` 화면에서 정상적인 업무처럼 보인다.
- 정상 큐까지 같은 화면에 펼쳐져 있고, 운영 지표와 분석 탭이 섞여 있다.

**요건**

- 화면명을 `Shift command`로 바꾸고 `내 할 일 / 미지정 / 에스컬레이션 / 데이터 이상` 4개 탭으로 시작한다.
- 상단에는 가장 중요한 3건만 사례 행으로 표시한다. 큐 카드가 아니라 실제 다음 사례를 연다.
- 순위 계산 근거를 `고객 대기 22m · 결제 400k VND · 담당자 없음`처럼 설명한다.
- 문제가 없는 큐는 `6 queues clear` 한 줄로 접는다.
- `Result / Leaders / Demand and supply` 분석은 별도 Performance 화면으로 옮긴다.
- 교대 시작 시 운영자 이름, 역할, 시작 시각, 인계 확인 여부를 기록한다.

### 화면 3 — Live Bookings

![Live Bookings](C:/dev/massage-on-demand-vn/output/admin-operator-audit-2026-08-04/03-live-bookings.png)

**상태: 위험**

- 상단은 `Live Bookings`, 본문은 `Booking Monitor`로 명칭이 다르다.
- KPI 5개 중 3개가 바로 아래 필터 탭에서 반복된다.
- 라이브 목록에 19일·46일 된 건과 Smoke 데이터가 섞여 있다.
- `Next action`은 장문으로 줄바꿈되고 담당자나 바로 실행할 행동이 없다.
- 금액 문구 `Customer 400.000 VND / min 300.000 VND`는 고객 결제액과 파트너 지급액을 구분하지 못한다.

**요건**

- 제목을 `Live service` 또는 `Live bookings` 하나로 통일한다.
- 기본 정렬을 SLA와 다음 행동 우선으로 고정한다.
- `Next action`을 `Contact partner · no departure update · 12m overdue` 형식으로 제한한다.
- 연락처, 주소, 최근 채팅은 행 클릭 시 오른쪽 사례 패널에서 바로 확인한다.
- 금액을 `Customer paid`와 `Partner payout`으로 분리한다.
- 라이브 조건을 벗어난 사례와 테스트 데이터는 목록에서 격리한다.
- Realtime 상태는 연결 여부뿐 아니라 마지막 업데이트 시각과 재연결 동작을 제공한다.

### 화면 4 — Booking Detail

![Booking Detail](C:/dev/massage-on-demand-vn/output/admin-operator-audit-2026-08-04/04-booking-detail.png)

**상태: 매우 위험**

- 8개의 섹션 점프, 4개의 체크포인트 카드, 12개의 동일 강조 버튼, 즉시 노쇼 폼이 첫 화면에 경쟁한다.
- 고객/파트너/채팅/결제/타임라인/운영기록/진단이 긴 세로 화면에 이어진다.
- `MATCHED`, `PENDING`, rule ID 등 내부 상태가 운영 언어보다 앞선다.

**요건**

- 상단 고정 `Case decision strip`을 만들고 예약 상태, SLA, 연락 상태, 주소, 결제, 담당자, 권장 행동만 보여준다.
- 체크포인트는 `Customer contact / Partner contact / Location / Payment` 4행 체크리스트로 바꾼다.
- 각 행의 완료 동사는 `Contact confirmed`, `Arrival verified`, `Payment checked`처럼 구체적으로 바꾼다.
- `Reset`은 완료 상태에서만 오버플로에 둔다.
- 노쇼·취소·만료는 별도 결정 모드로 묶고 상호 배타적으로 만든다.
- 개발자/시스템 섹션은 운영자 기본 화면에서 숨기고 권한 있는 역할만 볼 수 있게 한다.
- 원시 ID는 짧게 표시하고 복사 버튼으로 전체 값을 제공한다.

### 화면 5 — Customers

![Customers](C:/dev/massage-on-demand-vn/output/admin-operator-audit-2026-08-04/05-customers.png)

**상태: 주의**

- `Customer list aligned to the Vuexy management table...`은 사용자 목적이 아니라 구현 설명이다.
- 7개 KPI 중 초기 4개가 모두 성별 미수집 통계를 반복한다.
- 고객 지원자가 필요한 `문의 이유`, `최근 연락`, `담당자`, `SLA`가 목록에 없다.

**요건**

- 설명을 `Find a customer and resolve booking, payment, wallet, or review issues.`로 교체한다.
- KPI는 `Needs attention / Active booking / New today` 3개만 남기고 인구통계는 분석 화면으로 이동한다.
- 지원 역할은 `Needs attention`을 기본 탭으로 쓰거나 마지막 뷰를 기억한다.
- 검색은 전화번호·이메일·고객 ID·예약 ID를 한 번에 검색한다.
- 전화번호는 기본 마스킹하고, 보기 동작을 권한과 감사 로그에 기록한다.
- 목록에 마지막 문의 이유, 마지막 연락 시각, 담당자, SLA를 추가한다.

### 화면 6 — Partner Approvals

![Partner Approvals](C:/dev/massage-on-demand-vn/output/admin-operator-audit-2026-08-04/06-partner-approvals.png)

**상태: 주의**

- 0건인 승인 큐에서 검색, 5개 상태 필터, Export, 8개 정렬, 5개 기간 필터가 먼저 보인다.
- 승인 큐에 Bookings, Revenue, Wallet debt 같은 무관한 정렬이 포함된다.
- 빈 상태가 다음 행동을 안내하지 않는다.

**요건**

- 승인 전용 필터는 `Search / Waiting age / Missing verification item / Risk flag`만 제공한다.
- 기본 정렬은 오래 기다린 순이며, 목록에 제출 시각·누락 서류·위험 신호·검토자·할당 상태를 표시한다.
- 0건일 때 Export와 고급 필터를 숨기고 `No partner approvals are waiting`을 표시한다.
- 빈 상태에서 `View held/rejected partners`와 `Return to partner directory`를 제공한다.
- 일괄 승인은 금지하고 일괄 할당만 허용한다.
- 탭/페이지/사이드바 이름을 모두 `Partner approvals`로 맞춘다.

### 화면 7 — Finance Overview

![Finance Overview](C:/dev/massage-on-demand-vn/output/admin-operator-audit-2026-08-04/07-finance-overview.png)

**상태: 위험**

- `Today Money Risk` 아래에 `all dates` 수치가 섞이고, `Open Refunds 0 VND / 112 refund requests`처럼 금액과 건수 관계가 모호하다.
- Command 화면에서 월 세금 기간 필터가 먼저 보인다.
- 4개 작업 카드에 담당자와 명시적 CTA가 없다.

**요건**

- `Today`와 `All open backlog`를 다른 섹션/탭으로 분리한다.
- 상단 카드 대신 `Priority / Queue / Amount / Count / Oldest / Assignee / Next action` 순위 테이블을 쓴다.
- 월 세금 기간은 Monthly close 작업공간에만 둔다.
- 활성 필터 배지 반복을 한 줄 요약으로 줄인다.
- `0 VND / 112`가 실제 합계 미계산이면 `Amount unavailable · 112 requests`로 표현한다.
- General Ledger와 세금 전문 용어는 상세 보기에서 설명한다.

### 화면 8 — Operations History / Handoff

![Operations History](C:/dev/massage-on-demand-vn/output/admin-operator-audit-2026-08-04/08-operations-history.png)

**상태: 위험**

- 경로와 컴포넌트 의도는 handoff인데 화면 제목은 Operations History다.
- KPI, incomplete handoff, checklist, issue signals, finance history에서 동일한 문제가 반복된다.
- 실제 인계에 필요한 전임/후임 운영자, 미해결 사례 소유권, 인계 노트, 수신 확인이 없다.

**요건**

- `Operations history`와 `Shift handoff`를 분리한다.
- Handoff에는 outgoing shift, incoming operator, timestamp, unresolved cases, owner, note, acknowledgement를 둔다.
- 미해결 예외가 없으면 노트를 강제하지 않는다. 예외가 있으면 구조화된 요약을 요구한다.
- 수신 운영자가 확인하기 전까지 인계 상태를 `Awaiting acknowledgement`로 유지한다.
- History는 완료 인계와 사건 기록을 읽는 보조 탭으로 둔다.
- 반복 KPI/신호 카드는 하나의 미해결 사례 목록으로 합친다.

### 화면 9 — Refund Review

![Refund Review](C:/dev/massage-on-demand-vn/output/admin-operator-audit-2026-08-04/09-refund-review.png)

**상태: 매우 위험**

- `Total refunds 112`, `Requested 112`, `Refunded bookings 109`, `20 refund records`, `Showing 10 of 112`가 서로 겹치는 집합인지 단계인지 한눈에 알 수 없다.
- 실제 행은 refund 상태가 `REQUESTED`인데 payment와 booking은 `REFUNDED`여서 처리 완료 여부가 모호하다.
- 각 행의 `Ops hint` 안에 5단계 설명이 반복돼 테이블이 사실상 읽을 수 없는 문서가 된다.

**요건**

- 퍼널을 상호 배타적으로 정의한다: `Requested → Evidence review → Approved/Rejected → Payment pending → Customer notified → Closed`.
- 화면 상단 수치는 동일 퍼널 단계 또는 명시적인 별도 집합만 표시한다.
- 환불 목록 기본 열을 `Age / Customer / Amount / Reason / Evidence / Payment / Assignee / Next action`으로 바꾼다.
- 행에는 다음 행동 한 줄만 두고, 상세 절차는 사이드 패널 체크리스트로 옮긴다.
- 예약·결제·환불 상태가 충돌하면 `State mismatch`로 별도 우선순위를 부여한다.
- 환불 확정/거절은 근거, 금액, 결제 경로, 고객 안내 문구를 한 화면에서 검토하고 승인 권한을 확인한다.
- 결제 완료와 고객 안내 완료를 분리해 추적한다.

### 화면 10 — Notification Failures

![Notification Failures](C:/dev/massage-on-demand-vn/output/admin-operator-audit-2026-08-04/10-notification-failures.png)

**상태: 위험**

- `Needs retry 747`, `Delivery gaps 451`, `Token recovery users 93`가 현재 조치 큐처럼 보이지만 아래 역사 데이터는 notification 412, failed attempts 439, no-device 72,303으로 단위가 다르다.
- 75일 전 실패가 현재 재시도 큐에 있고, 최근 device last seen 시각과 과거 실패 시각이 한 행에 섞인다.
- Customer Support 화면 안에 FCM_HTTP_V1, HTTP 400, registration token, worker/credential 점검 등 개발자 진단이 직접 노출된다.

**요건**

- 운영자 큐와 개발자 사고/디바이스 유지보수를 분리한다.
  - 운영자: 고객/파트너 연락 필요, 예약 영향, 우회 채널 사용
  - 시스템 운영: worker/credential/FCM 오류 묶음과 재시도 정책
  - 기록: 과거 전송·attempt·device 집계
- 알림 단위, attempt 단위, user 단위, device 단위를 카드 제목에 명시한다.
- 동일 원인의 실패는 사례별 747행이 아니라 incident 1건으로 묶고 영향 사용자 수를 표시한다.
- 75일 된 실패는 역사/데이터 정리 대상으로 보내고 현재 SLA에서 제외한다.
- `Re-enable device`는 앱이 새 토큰을 등록한 증거가 있을 때만 활성화한다.
- 운영자 문구는 `Push unavailable · contact by phone`처럼 업무 행동으로 번역하고 기술 원인은 상세 패널에 둔다.

## 11. 문구 교체안

| 현재 문구 | 문제 | 권장 문구 |
|---|---|---|
| Start Shift | 시작 버튼인지 화면인지 모호 | Shift command |
| Resolve overdue | 무엇을 해결할지 불명확 | Review oldest refund / Contact affected customer |
| Booking Monitor | 메뉴명과 불일치 | Live bookings |
| Customer list aligned to the Vuexy... | 구현 설명 | Find a customer and resolve booking, payment, wallet, or review issues. |
| Mark done | 완료 기준 불명확 | Contact confirmed / Location verified / Payment checked |
| Blocked | 행위인지 상태인지 모호 | Could not confirm |
| Reset | 위험성과 대상 불명확 | Reopen checkpoint |
| Confirm no-show | 근거 확인 없이 강한 행동 | Review and confirm no-show |
| No partner rows found | 맥락과 다음 행동 없음 | No partner approvals are waiting. |
| Full history | 범위 불명확 | View completed handoffs |
| Live Workspace | 실제 상태를 말하지 않음 | Live · updated 12s ago |
| Requested / Refunded booking | 단계와 집합이 섞임 | Evidence review / Payment complete / Customer notified |
| Review retries | 기술 작업인지 고객 작업인지 불명확 | Contact affected users / Open delivery incident |

문구 원칙:

- 페이지 설명은 구현 기술이 아니라 운영자의 목표를 말한다.
- CTA는 `열기`보다 `검토`, `연락`, `할당`, `확인`, `에스컬레이션` 같은 실제 동사를 쓴다.
- 내부 상태 코드는 보조 정보로 두고, 운영 문구를 기본값으로 쓴다.
- Customer/Partner/Booking/Refund 등 핵심 용어의 대소문자와 이름을 전 화면에서 통일한다.

## 12. 시각 디자인 시스템 수정안

새 디자인 시스템을 만들지 말고 현재 스타일을 다음 규칙으로 정리한다.

- **색상**: 빨강은 P1/막힘에만 사용한다. 경고는 황색, 정보는 청색/보라, 정상은 중립/녹색을 쓴다. 한 화면이 모두 빨갛게 되지 않게 한다.
- **위계**: 한 화면에 primary CTA는 하나만 둔다. secondary는 outline, tertiary는 text/overflow로 내린다.
- **카드**: KPI 카드, 큐 카드, 상세 카드의 목적을 구분한다. 같은 정보를 카드와 테이블에 반복하지 않는다.
- **밀도**: 운영 목록은 카드보다 표/행이 적합하다. 설명은 한 줄, 상세는 확장 패널로 옮긴다.
- **타이포그래피**: 제목 3단계, 본문 2단계, 메타 1단계로 제한한다. 같은 제목을 상단과 본문에서 반복하지 않는다.
- **아이콘**: 현재 메뉴 레이블과 아이콘 맵을 동기화한다. fallback `Activity`와 `UserRoundCog` 반복을 제거한다.
- **반응형**: 1024px 미만 차단 정책을 유지할지 결정한다. 유지한다면 모바일 메뉴 코드를 제거하고 태블릿 1024–1280의 표/사이드패널 동작을 명시한다.
- **접근성**: 모든 아이콘 버튼에 이름, 모든 상태 변경에 텍스트, 키보드 포커스, 오류 요약, 라이브 상태 알림을 제공한다. 색만으로 상태를 구분하지 않는다.

## 13. 역할별 홈 화면

| 역할 | 기본 홈 | 첫 화면의 3가지 |
|---|---|---|
| Dispatcher | Live service | 대기 중 매칭, 이동 지연, 서비스 중 예외 |
| Support | Support cases | 고객 문의, 환불 결정, 연락 실패 |
| Partner Ops | Partner review | 승인 대기, 보류/위험, 파트너 연락 |
| Finance | Money actions | 미정산, 환불/결제 불일치, 은행 대사 |
| Shift Lead | Shift command | 미지정, SLA 초과, 에스컬레이션/인계 |
| Admin | Records & settings | 권한, 정책, 시스템 상태 |

역할별 홈은 권한을 새로 만드는 기능이 아니라 기존 내비게이션과 큐 필터의 기본값을 바꾸는 방식으로 구현하는 것이 가장 작다.

## 14. 구현 순서

### Phase 1 — 공통 셸과 공통 큐 계약

- 중복 제목 제거
- 상단 액션 정리 및 알림 버튼 라벨 추가
- 현재 메뉴 아이콘 맵 동기화
- 역할별 6개 1차 메뉴와 Records & settings 분리
- 공통 큐 행 컴포넌트와 `owner/assignee/SLA/last action/next action` 필드 정의

**완료 기준**: Start Shift와 Finance Overview가 동일한 큐 계약으로 렌더링되고, 운영자가 최우선 실제 사례를 2클릭 안에 연다.

### Phase 2 — 예약과 고객 지원

- Live Bookings의 오래된/테스트 데이터 격리
- Booking Detail의 결정 스트립·체크리스트·위험 행동 가드
- Customers의 구현 문구 제거, KPI 축소, 지원 필드 추가

**완료 기준**: 신규 지원 운영자가 별도 문서 없이 예약 예외를 찾아 근거를 확인하고 안전하게 상태를 기록한다.

### Phase 3 — 파트너·금융·환불·알림

- 승인 전용 필터와 빈 상태
- Today/All backlog 분리
- 환불 퍼널과 상태 불일치 큐
- 알림 운영자 큐/기술 incident/역사 데이터 분리

**완료 기준**: 모든 숫자는 단위와 기간이 명확하고, 동일 원인의 기술 실패는 incident로 묶인다.

### Phase 4 — 인계·접근성·시각 마감

- 실제 Shift Handoff 작성·수신 확인 흐름
- 키보드/스크린리더/200% 확대 검증
- 색상·간격·표 밀도·빈 상태 통일
- 운영자 사용성 테스트 3–5명

**완료 기준**: 인계 후 미해결 사례의 소유자가 사라지지 않고, 핵심 흐름을 키보드만으로 완료할 수 있다.

## 15. 성공 지표

- 교대 시작 후 최우선 실제 사례 열기: 10초 이내, 2클릭 이하
- 라이브 예외 발견 후 담당자 할당: 30초 이내
- 위험 상태 변경 중 사유 없는 제출: 0건
- `Live` 큐의 SLA 범위 초과 역사 데이터: 0건
- 운영 기본 화면의 Demo/Smoke 데이터 노출: 0건
- 미지정 SLA 초과 사례: 매 교대 종료 시 0건 목표
- 교대 인계 수신 확인률: 100%
- 운영자에게 노출되는 내부 기술 오류 코드: 기본 화면 0건
- 상단 1차 메뉴: 역할당 6개 이하

## 16. 추천 스킬·프롬프트·외부 요소

### 스킬 순서

1. `product-design:audit`: 실제 로그인 화면을 캡처하고 흐름별 증거를 남긴다.
2. `impeccable`: 운영 모드의 정보구조, 문구, 오류 예방, 접근성 기준을 적용한다.
3. `product-design:ideate`: 확정된 핵심 화면 3개만 시각 대안으로 비교한다. 전체 75개 화면을 한꺼번에 시안화하지 않는다.
4. `figma:figma-generate-design` + `figma:figma-use`: 선택한 `Shift command`, `Booking detail`, `Refund review`를 Figma 운영 흐름으로 만든다.
5. 구현 후 `browser:control-in-app-browser` 또는 Chrome 제어로 실제 데이터 상태를 다시 캡처해 비교한다.

### 권장 구현 프롬프트

```text
C:\dev\massage-on-demand-vn\apps\admin_web를 실제 베트남 운영자가 사용하는 운영 콘솔로 개선해라.

목표는 화면을 예쁘게 꾸미는 것이 아니라, 운영자가 지금 처리할 사례·이유·담당자·SLA·다음 행동을 5초 안에 이해하고 위험한 상태 변경을 실수 없이 완료하게 하는 것이다.

제약:
- 기존 Next.js 16, React 19, Lucide, Recharts, FullCalendar, 기존 Admin 컴포넌트만 재사용한다.
- 새 UI 의존성을 추가하지 않는다.
- globals.css 전체 재작성이나 신규 디자인 시스템 구축은 하지 않는다.
- API/권한/감사 로그 계약을 보존한다.
- Demo/Smoke 데이터는 운영 기본 뷰에서 격리한다.

먼저 공통 원인부터 수정한다:
1. AdminWorkspaceHeader와 AdminPageTemplate의 중복 제목 제거
2. AdminShellNav를 역할/교대 기준 6개 1차 메뉴로 단순화
3. 공통 큐 행에 priority, case, next action, owner, assignee, SLA, last action, impact 추가
4. 위험 상태 변경은 근거·사유·확인·감사 이력을 요구

그다음 세 화면만 우선 구현한다:
- Shift command: 내 할 일/미지정/에스컬레이션/데이터 이상
- Booking detail: 고정 decision strip, 4행 체크리스트, 조건부 no-show
- Refund review: 상호 배타적 퍼널, 상태 불일치 큐, 한 줄 next action

각 단계에서 실제 로그인 화면을 동일 viewport로 캡처해 before/after를 비교하고,
운영자 관점의 수용 기준과 기존 테스트/새 최소 테스트를 함께 통과시켜라.
```

### 외부 요소

- **필수 추가 없음**: 현재 설치된 Lucide와 기존 Admin 컴포넌트로 충분하다.
- **Figma**: 화면 장식보다 큐→사례→결정→인계 흐름과 컴포넌트 상태를 합의할 때만 사용한다.
- **실제 운영자 세션**: Dispatcher, Support, Finance 각 1명 이상에게 가장 오래된 사례 처리와 교대 인계를 관찰한다. 이것이 어떤 디자인 라이브러리보다 우선이다.
- **제품 분석 도구**: 새 도구를 바로 설치하지 말고, 먼저 기존 감사 로그에 `queue_opened`, `case_assigned`, `decision_completed`, `handoff_acknowledged` 시간을 기록할 수 있는지 확인한다. 부족할 때만 별도 분석 도구를 검토한다.

## 17. 코드 근거

- `apps/admin_web/lib/admin-navigation.ts`: 11개 섹션과 62개 링크의 전체 내비게이션 정의
- `apps/admin_web/components/admin-workspace-header.tsx`: breadcrumb, 페이지 제목, 검색, 테마, Help, 알림, 지역, Live Workspace의 상단 셸
- `apps/admin_web/components/admin-page-template.tsx`: 각 페이지의 두 번째 H1 생성
- `apps/admin_web/components/admin-shell-nav.tsx`: 현재 레이블과 어긋난 아이콘 맵 및 fallback 아이콘
- `apps/admin_web/components/admin-root-shell.tsx`: 데스크톱 전용 정책과 충돌하는 모바일 메뉴 상태
- `apps/admin_web/app/customers/page.tsx`: Vuexy 구현 중심 고객 설명
- `apps/admin_web/app/bookings/[id]/booking-action-status-sections.tsx`: 동일 가중치 상태 변경 버튼과 노쇼 확정 폼
- `apps/admin_web/app/operations-handoff/page.tsx`: Handoff 경로와 Operations History 명칭 혼용

## 18. 평가 한계 및 실행 기록

- 실제 로그인된 Chrome에서 10개 화면을 캡처하고 DOM 텍스트를 확인했다.
- 소스 코드와 화면 문구를 대조했으며 앱 소스는 수정하지 않았다.
- 금전·노쇼·승인·기기 재활성화 같은 변경 작업은 실행하지 않았다.
- 자동 정적 검출기는 대표 TSX 13개에서 항목을 찾지 못했다. 이는 수동 UX 문제의 부재를 의미하지 않는다.
- Chrome 컨텍스트에 신뢰할 수 있는 시각 오버레이를 주입하지 못해, 저장 스크린샷·DOM 스냅샷·소스 위치를 증거로 사용했다.
- 별도 로컬 서버를 시작하지 않았고, 사용자가 이미 실행한 localhost 화면을 검사했다.
- Questions skipped: 요청 범위가 전체 관리자 운영 UX 요건으로 명확하고, 우선 개선점이 화면 증거에서 직접 확인된다.
