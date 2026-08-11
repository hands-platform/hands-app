# HANDS Admin UX 구현 백로그

## 우선순위 기준

- **P0:** 개인정보·금액·회복 곤란한 오처리 위험. 즉시 보호 장치가 필요하다.
- **P1:** 업무 누락, SLA 지연, 정책/콘텐츠 오변경, 주요 접근성 문제.
- **P2:** 반복 작업과 탐색 비용, 빈 상태·표·문구의 큰 마찰.
- **P3:** 일관성과 마감 품질. 상위 위험을 해결한 뒤 진행한다.

규모는 구현 상대치다: `S` 반나절~1일, `M` 2~4일, `L` 1주 이상. 실제 일정은 API·권한 변경 여부에 따라 달라진다.

## P0 — 즉시 보호

| 우선순위 | 화면 | 문제 | 운영 영향 | 제안 | 관련 파일 | 난이도 |
|---|---|---|---|---|---|:---:|
| P0 | Bookings | ADM-001: 고객 전화번호와 전체 서비스 주소가 기본 목록에 노출 | 화면공유·어깨너머·내보내기 개인정보 노출 | 전화번호 마스킹, 주소 영역 축약, 전체 값은 권한 있는 상세에서만 제공 | `apps/admin_web/app/bookings/booking-monitor-list-section.tsx` | M |
| P0 | Wallet Adjustments | ADM-002: raw `Owner profile id` 직접 입력 | 다른 계정에 금액을 반영하는 회복 곤란 오류 | 고객/파트너 검색 선택기, 고정 신원 요약, 잔액·방향·금액 최종 확인 | `apps/admin_web/app/wallet-adjustments/page.tsx`, `actions.ts` | L |
| P0 | Customer Detail | ADM-003: 지갑 조정·고객 발송·메모가 동시에 상시 노출 | 다른 고객 또는 다른 행동을 잘못 실행 | 한 번에 한 작업 패널만 열고 대상 변경 시 재확인, 감사 이벤트 연결 | `apps/admin_web/app/customers/[id]/page.tsx` | M |

## P1 — 업무 누락과 오변경 방지

| 우선순위 | 화면 | 문제 | 운영 영향 | 제안 | 관련 파일 | 난이도 |
|---|---|---|---|---|---|:---:|
| P1 | Global navigation | ADM-004: 13개 이상 그룹과 유사 재무 라벨 | 주요 큐 발견 지연·잘못된 화면 진입 | 기존 URL/권한을 재사용해 8개 업무 영역으로 재그룹 | `apps/admin_web/lib/admin-navigation.ts`, `admin-operator-access-model.ts` | M |
| P1 | Global navigation | ADM-005: Cash Settlements, Closeout, Earnings, Partner Controls, Referral Cashouts가 메뉴에 없음 | 업무 누락과 SLA 지연 | 허용 역할의 정식 메뉴에 기존 경로 연결 | `apps/admin_web/lib/admin-navigation.ts`, 해당 route pages | S |
| P1 | Notification Templates | ADM-006: 원시 키/JSON과 언어별 독립 Save | 번역 누락·부분 저장·잘못된 메시지 발송 | 템플릿 선택, 언어 탭, 미리보기, 변경 요약, 원자적 저장 | `apps/admin_web/app/notifications/templates/page.tsx` | L |
| P1 | Bank Reconciliation | ADM-007: 업로드·수동 입력·이력·담당자·검토 큐 혼합 | 중복 import, 잘못된 매칭, 문맥 전환 | `Review unmatched`와 `Import statement` 흐름 분리 | `apps/admin_web/app/finance-tax/bank-reconciliation/page.tsx`, `bank-statement-batch-import.tsx` | L |
| P1 | Operations Policy | ADM-008: 반복 Save, 내부 스크롤, 부분 저장 | 잘못된 SLA/매칭 정책 적용 | 읽기 비교표 + 한 정책 편집 패널 + 저장 전 영향 요약 | `apps/admin_web/app/operations-policy/page.tsx` | L |
| P1 | Payments | ADM-009: callback ledger가 목록과 상세에 중복 | 운영 결제 큐와 개발 진단이 경쟁 | 목록 ledger 제거, 검토 배지와 상세 타임라인 링크 유지 | `apps/admin_web/app/payments/page.tsx`, `payment-callback-attempt-ledger-section.tsx` | S |
| P1 | Metric cards | ADM-010: 모든 수치 값이 `<h2>` | 스크린리더 heading 탐색 훼손 | 일반 텍스트로 바꾸고 라벨+값 접근 이름 제공 | `apps/admin_web/components/metric-card.tsx` | S |
| P1 | Bookings | ADM-011: 내부 ID가 첫 열이고 표가 첫 화면 아래로 밀림 | 긴급 예약 판단 지연 | 상태/다음 행동/경과 우선, 고급 필터 접기, KPI 축약 | `apps/admin_web/app/bookings/booking-monitor.tsx`, `booking-monitor-list-section.tsx` | M |
| P1 | Referrals / Payment Fees | ADM-012: 일상 목록에서 정책 저장 가능 | 권한 없는 정책 오변경 | 정책 편집을 Restricted Settings로 이동, 목록은 적용 정책만 표시 | `apps/admin_web/app/referrals`, `apps/admin_web/app/finance-tax/payment-fees/page.tsx` | M |
| P1 | Empty states / Policies | ADM-013: API, seed, smoke, 구현 설명이 운영 화면에 노출 | 장애/무데이터 오판, 신뢰 저하 | 무데이터·필터 없음·로드 실패 문구 분리, 테스트 데이터 제거 | `booking-empty-message.ts`, `partner-filters.ts`, `reviews-table-section.tsx`, `tax-policy` | M |
| P1 | Permissions | ADM-014: 실제 감사 세션이 MASTER_ADMIN에 한정 | 역할별 숨김/직접 URL 권한 문제가 남을 가능성 | Shift/Partner/Finance/Master 브라우저 스모크와 권한 매트릭스 테스트 | `apps/admin_web/lib/admin-operator-access-model.ts`, auth guards | M |

## P2 — 처리 속도와 명확성

| 우선순위 | 화면 | 문제 | 운영 영향 | 제안 | 관련 파일 | 난이도 |
|---|---|---|---|---|---|:---:|
| P2 | Reviews | ADM-015: 0 KPI 다섯 개와 모호한 빈 상태 | 무데이터·필터·오류를 구분 못함 | 0 KPI 축약, 현재 필터 설명, 전체 기간/필터 초기화 행동 | `apps/admin_web/app/reviews/page.tsx`, `review-page-model.ts` | S |
| P2 | Calendar | ADM-016: 빈 달력보다 0 KPI 네 개가 먼저 보임 | 일정 본문 도달 지연 | 모든 값이 0이면 한 줄 요약 또는 숨김 | `apps/admin_web/app/calendar/page.tsx` | S |
| P2 | Not found / Permission | ADM-017: 기술 문구와 일반 Start Shift CTA | 원인과 복구 경로 불명확 | 객체별 메시지·목록 CTA, 권한 없음과 not-found 분리 | `apps/admin_web/app/not-found.tsx`, detail routes | M |
| P2 | Background Jobs | ADM-018: 12열 표가 글자 단위로 줄바꿈 | 기술 담당자도 큐 상태를 빠르게 판독 못함 | Queue/State/Waiting/Active/Failed/SLA/Action만 기본 표시 | `apps/admin_web/app/background-jobs/page.tsx` | S |
| P2 | Partner list/detail | ADM-019: DRAFT, DEFERRED, MANUAL OFFLINE, missing 노출 | 상태 해석 지연·잘못된 후속 처리 | 공통 운영 label map, raw 값은 기술 상세 | `apps/admin_web/app/partners`, shared status mapping | S |
| P2 | Payouts | ADM-020: 여러 표의 행별 Save 반복 | 다른 지급 건의 참조·메모를 저장할 위험 | 선택한 한 건 상세 패널에서 편집·재확인 | `apps/admin_web/app/payouts` | M |
| P2 | Audit Log | ADM-021: Metadata 기본 열 노출 | 감사 주체·행동·대상 판독 방해 | 핵심 열만 유지하고 metadata 상세 접기 | `apps/admin_web/app/audit-log/audit-log-table-section.tsx` | S |
| P2 | Start Shift | ADM-022: `open` 단위가 모호 | 큐 종류와 처리 건수를 오판 | `queues need attention`과 `total items` 분리 | `apps/admin_web/app/page.tsx` | S |
| P2 | Operations History | ADM-023: 요약·체크리스트·재무·노트가 길게 연속 | 현재 교대의 미완료 인계를 놓침 | 미완료 인계 우선, 완료 이력 접기 | `apps/admin_web/app/operations-handoff/page.tsx` | M |
| P2 | Marketing Analytics | ADM-024: 분석 화면에 spend 입력 상시 노출 | 탐색 중 비용 데이터 오입력 | `Add spend` 작업 패널, 기간·통화·출처 확인 | `apps/admin_web/app/marketing-analytics/page.tsx` | M |

## P3 — 마감 품질

| 우선순위 | 화면 | 문제 | 운영 영향 | 제안 | 관련 파일 | 난이도 |
|---|---|---|---|---|---|:---:|
| P3 | Global copy | ADM-025: Customer/Partner/Provider와 open/held/review 용어 불일치 | 같은 개념을 다른 업무로 오해 | UI 용어·단위 사전과 기존 label map 정리 | navigation, filter/status model files | S |
| P3 | Data tables | ADM-026: 판단 열과 내부 ID/payload가 같은 우선순위 | 표 판독 속도 저하 | 기본 8열 안팎, ID·payload·전체 주소는 상세 | shared table + major list sections | M |
| P3 | Empty pagination | ADM-027: 0건에도 비활성 Page 1 표시 | 빈 상태의 다음 행동을 방해 | 0건 페이지네이션 숨김, 필터 초기화를 빈 메시지 옆에 배치 | reviews/bookings pagination components | S |
| P3 | Accessibility | ADM-028: muted text/badge 대비와 focus를 완전 검증하지 못함 | 저시력·키보드 사용자의 작업 실패 가능 | 실제 토큰 대비 측정, 보이는 focus, 드로어 focus trap 검증 | `apps/admin_web/app/globals.css`, shared controls | M |
| P3 | Narrow viewport | ADM-029: 1024px 미만에서 긴급 큐도 차단 | 태블릿·분할 화면에서 상황 확인 불가 | 요구가 확인되면 읽기 전용 Start Shift/긴급 큐만 우선 지원 | `apps/admin_web/components/admin-desktop-only-gate.tsx` | M |

## 권장 실행 묶음

### 묶음 A — 1주 안전 패치

`ADM-001`, `ADM-005`, `ADM-009`, `ADM-010`, `ADM-013`, `ADM-015`, `ADM-017`, `ADM-022`

목표: 개인정보 노출을 줄이고, 숨은 큐와 기술 문구를 정리하며, 기존 구조를 거의 건드리지 않고 즉시 체감되는 개선을 낸다.

### 묶음 B — 금액·정책 안전

`ADM-002`, `ADM-003`, `ADM-007`, `ADM-008`, `ADM-012`, `ADM-014`, `ADM-020`

목표: 대상 선택, 확인, 승인, 감사 로그를 고위험 작업의 공통 기준으로 만든다. 새 범용 프레임워크보다 기존 form/action 패턴을 각 흐름에 맞게 재사용한다.

### 묶음 C — 정보 구조와 처리 속도

`ADM-004`, `ADM-006`, `ADM-011`, `ADM-016`, `ADM-018`, `ADM-019`, `ADM-021`, `ADM-023`, `ADM-024`

목표: 역할별 발견성과 화면 집중도를 높인다.

### 묶음 D — 검증과 마감

`ADM-025`~`ADM-029`

목표: 용어, 표, 접근성, 좁은 화면 요구를 실제 운영 검증으로 마무리한다.

## 각 PR의 최소 검증

- 변경된 역할의 메뉴 가시성과 직접 URL 접근 테스트
- 금액·발송·정책 변경은 대상, 변경 전후, 사유, 승인/확인, 감사 이벤트 검증
- 목록 DOM과 CSV에 숨겨야 할 개인정보가 없는지 검사
- 1280px 데스크톱과 900px 차단 상태 스크린샷 비교
- 결과 있음, 결과 없음, 필터 결과 없음, 로드 실패, 권한 없음, not-found 상태 확인
- 키보드로 기본 행동, 취소, 드로어 닫기, 확인 단계까지 이동

## 성공 지표

| 지표 | 기준 |
|---|---|
| 핵심 큐 발견 시간 | 역할별 주요 큐를 3클릭 이하, 30초 이하에 찾음 |
| 예약 첫 행동 도달 | 기본 데스크톱에서 첫 행과 다음 행동이 스크롤 없이 보임 |
| 개인정보 노출 | 기본 목록과 CSV의 원문 전화번호·전체 주소 0건 |
| 지갑 대상 오류 방지 | 원시 ID 직접 입력 없이 대상 선택·확인 가능 |
| 정책 변경 무결성 | 변경 전후·사유·승인자·감사 이벤트 100% 기록 |
| 빈 상태 이해 | 운영자 테스트에서 무데이터/필터 없음/실패를 구분 |
| 접근성 | 핵심 흐름에서 heading, focus, label, 대비의 AA 기준 충족 |

## 의존성과 비목표

- `ADM-002`, `ADM-003`, `ADM-007`, `ADM-008`은 서버 권한과 감사 이벤트가 UI와 함께 검증돼야 한다.
- URL 대규모 개편, 새 디자인 시스템, 모바일 전체 관리자 앱은 이번 백로그의 선행 조건이 아니다.
- 실데이터 정리 자동화는 별도 데이터 운영 작업이다. 여기서는 smoke/demo 항목이 운영 화면에 섞이지 않도록 표시·환경 규칙을 다룬다.
