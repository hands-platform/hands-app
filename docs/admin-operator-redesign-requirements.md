# HANDS Admin 운영자 중심 재설계 요구사항

문서 상태: 2026-08-04 재감사 반영 구현 기준안  
작성 기준일: 2026-08-04  
대상: `apps/admin_web`  
제품 모드: **Operate**  
주 사용 환경: 1024px 이상 데스크톱, 기준 1440px, 와이드 1980px

## 1. 문서 목적

이 문서는 HANDS 관리자 웹을 기능 중심 관리자 사이트에서 실제 운영자가 빠르고 안전하게 일하는 운영 콘솔로 개선하기 위한 구현 기준이다.

이 문서가 해결하려는 질문은 하나다.

> 운영자가 지금 처리해야 할 실제 사례, 처리 이유, 담당자, SLA, 마지막 행동, 다음 행동과 영향을 5초 안에 이해하고 안전하게 처리할 수 있는가?

화면을 새로 많이 만들거나 새 디자인 시스템을 도입하는 것이 목표가 아니다. 기존 라우트, Vuexy 계열 시각 언어, HANDS 공통 Admin 컴포넌트와 권한 계약을 재사용해 `큐 → 사례 → 판단 → 결정 → 인계` 흐름을 일관되게 만드는 것이 목표다.

## 2. 문서 우선순위와 참고 자료

충돌이 생기면 다음 순서를 따른다.

1. `AGENTS.md`의 저장소 운영·보호 규칙
2. 실제 API 권한, 감사 로그, 예약·결제·지갑·매칭 비즈니스 계약
3. 이 문서의 운영자 UX 요구사항
4. `docs/architecture/admin-vuexy-design-system.md`의 시각·컴포넌트 규칙
5. 기존 화면의 우연한 배치나 오래된 테스트 문구

반드시 함께 읽을 자료:

- `docs/admin-ux-implementation-progress.md`
- `docs/admin-operations-ux-audit.md`
- `docs/admin-information-architecture-proposal.md`
- `docs/admin-ux-implementation-backlog.md`
- `docs/architecture/admin-vuexy-design-system.md`
- `docs/agent/HANDS_CODEX_WORKFLOW_GUARD.md`
- `output/admin-operator-audit-2026-08-04/admin-operator-ux-audit.md`
- `output/admin-operator-reaudit-2026-08-04/admin-operator-ux-reaudit.md` — 현재 판정과 후속 우선순위

화면 증거:

- `output/admin-operator-audit-2026-08-04/01-login.png`
- `output/admin-operator-audit-2026-08-04/02-start-shift.png`
- `output/admin-operator-audit-2026-08-04/03-live-bookings.png`
- `output/admin-operator-audit-2026-08-04/04-booking-detail.png`
- `output/admin-operator-audit-2026-08-04/05-customers.png`
- `output/admin-operator-audit-2026-08-04/06-partner-approvals.png`
- `output/admin-operator-audit-2026-08-04/07-finance-overview.png`
- `output/admin-operator-audit-2026-08-04/08-operations-history.png`
- `output/admin-operator-audit-2026-08-04/09-refund-review.png`
- `output/admin-operator-audit-2026-08-04/10-notification-failures.png`
- `output/admin-operator-reaudit-2026-08-04/` — 개선 후 11개 화면의 현재 증거

## 3. 현재 기준선

`docs/admin-ux-implementation-progress.md`에 기록된 `ADM-001~ADM-029`는 완료된 회귀 방지 기준이다. 새 작업은 다음을 되돌리면 안 된다.

- 예약 목록의 전화번호 마스킹과 상세 주소 보호
- 지갑 조정의 검색 기반 대상 선택, 대상 고정, 멱등성, 감사 로그
- 고객 상세의 읽기 우선 구조와 한 번에 하나의 고위험 작업 패널
- 역할·카테고리 기반 메뉴 및 직접 URL/API 권한 가드
- 다국어 알림 템플릿의 원자적 저장
- 은행 대사의 가져오기/검토 흐름 분리
- 운영 정책의 읽기 비교와 단일 편집 흐름
- callback ledger의 운영 목록 제거
- KPI 값의 올바른 heading 구조
- 예약 목록의 액션 우선 구조와 고급 필터 접기
- 운영 화면의 seed/smoke/API 안내 문구 제거
- 리뷰·달력·not-found·배경 작업·파트너 상태·지급·감사 로그·접근성 개선
- 1024px 미만 데스크톱 전용 차단 정책

기존 구현 진행 문서와 실제 코드가 다를 경우 코드를 우선 확인하고, 이유 없이 완료 기능을 다시 작성하지 않는다.

### 3.1 재감사 기준선과 증거 신뢰성

2026-08-04 재감사 점수는 25/40으로 이전 20/40보다 개선됐다. Finance 우선순위 카드, 환불 State mismatch 큐, 알림의 행동형 문구, Customer Detail, Wallet Adjustments는 유지해야 할 개선이다.

다만 재감사 당시 `3101` 포트는 최신 소스가 아니라 오래된 `next start` 산출물을 제공했다.

| 증거 | 재감사 확인 시각 |
|---|---|
| `.next/BUILD_ID` | 2026-08-04 16:53 |
| `.next/server/app/bookings/[id]/page.js` | 2026-08-04 16:52 |
| `app/bookings/[id]/booking-action-status-sections.tsx` | 2026-08-04 19:22 |
| `app/refunds/page.tsx` | 2026-08-04 18:36 |

따라서 소스·테스트·브라우저 화면 중 하나만 보고 완료 처리하면 안 된다. 각 slice는 최신 소스로 빌드하고, 실행 중인 build ID를 기록한 뒤, 같은 build ID에서 DOM과 화면을 다시 확인해야 한다.

### 3.2 OUX-030~OUX-043 현재 상태

| ID | 상태 | 남은 핵심 조건 |
|---|---|---|
| OUX-030 | 부분 개선 | 테마 제어를 하나로 합치고 페이지 헤더 높이를 줄인다. |
| OUX-031 | 미해결 | 역할별 My queue, Unassigned, 최근 사례를 2클릭/10초 안에 연다. |
| OUX-032 | 부분 개선 | 74~77일 된 항목을 Data anomaly로 옮기고 역할별 큐를 제공한다. |
| OUX-033 | 미해결 | Live 시간 계약과 Smoke/Demo 기본 제외를 쿼리·테스트로 고정한다. |
| OUX-034 | 부분 개선·미배포 | 최신 빌드에서 Decision Strip과 상호 배타적 실패 흐름을 확인한다. |
| OUX-035 | 미해결 | 지원 KPI 3개와 Needs action 기본 뷰, 운영 문구를 적용한다. |
| OUX-036 | 미해결 | Approval 전용 필터만 남기고 0건에서 필터·Export를 접는다. |
| OUX-037 | 부분 개선 | Today와 all-date backlog를 데이터와 화면에서 분리한다. |
| OUX-038 | 부분 개선 | 현재 Handoff 모델과 읽기 전용 History를 분리한다. |
| OUX-039 | 부분 개선·집계 회귀 | 환불 단계·행·필터·summary를 서버 소유 단일 계약으로 통일한다. |
| OUX-040 | 부분 개선 | 반복 실패를 incident로 묶고 과거 실패를 현재 SLA에서 제외한다. |
| OUX-041 | 미해결 | 기본 운영 큐의 테스트 데이터와 오래된 활성 데이터를 격리한다. |
| OUX-042 | 부분 개선 | Vuexy/FCM/raw enum과 남은 기술 문구를 운영 언어로 바꾼다. |
| OUX-043 | 부분 개선 | KPI/필터 반복, 과도한 danger, 다중 primary CTA를 정리한다. |

## 4. 사용자와 업무 상황

### 4.1 Dispatcher

- 실시간 매칭, 고객 선택, 파트너 이동과 서비스 중 예외를 관리한다.
- 가장 오래 기다린 예약과 개입 이유를 먼저 봐야 한다.
- 연락·위치·서비스 상태를 빠르게 확인하고 담당자를 지정한다.

### 4.2 Customer Support

- 고객 문의, 취소, 환불, 알림 실패와 리뷰 문제를 해결한다.
- 고객의 최근 예약·결제·연락 이력과 다음 행동이 중요하다.
- 기술 오류나 원시 상태보다 고객에게 무엇을 안내해야 하는지가 먼저다.

### 4.3 Partner Operations

- 파트너 승인, KYC, 제한, 가용성, 현금 부채와 운영 성과를 검토한다.
- 승인 대기와 일반 디렉터리의 필터가 달라야 한다.
- 신원·승인 결정은 일괄 실행하지 않고 개별 근거를 확인한다.

### 4.4 Finance Operator

- 환불, 대사, 미수금, 지급 위험과 마감 예외를 처리한다.
- 금액, 건수, 최장 대기, 상태 불일치, 담당자와 승인 권한이 중요하다.
- Today와 누적 백로그가 섞이면 안 된다.

### 4.5 Shift Lead

- 미지정 사례, SLA 초과, 에스컬레이션, 데이터 이상과 교대 인계를 관리한다.
- 개별 기능 수치보다 전체 업무 소유권과 인계 완료 여부가 중요하다.

## 5. 제품 원칙

### 5.1 사례가 화면의 기본 단위다

큐 종류나 기능 카드가 아니라 실제 예약·환불·알림 incident·파트너 검토 건을 기본 작업 단위로 삼는다.

### 5.2 한 화면에는 하나의 주 행동만 둔다

상태 변경이 여러 개 가능해도 권장 행동 하나만 primary로 표시한다. 위험하거나 드문 행동은 secondary, text, overflow 순으로 낮춘다.

### 5.3 설명보다 다음 행동을 먼저 쓴다

페이지 설명은 기술 구현이 아니라 운영자의 목적을 말한다. CTA는 목적지가 아니라 구체적인 업무 동사를 쓴다.

### 5.4 현재 업무와 기록을 분리한다

Current shift, Today, All open backlog, Historical record를 명확히 구분한다. 과거 기록을 현재 SLA 작업처럼 표현하지 않는다.

### 5.5 위험 행동은 근거와 감사 이력을 요구한다

노쇼, 취소, 환불, 승인, 거절, 지갑, 지급, 정책 변경은 대상·근거·변경 전후·사유·작업자·시각을 검증한다.

### 5.6 운영 언어를 기본값으로 쓴다

FCM, callback, ledger, raw enum, 내부 rule ID는 기본 목록에서 숨긴다. 운영자가 해야 할 행동으로 번역하고 기술 상세에서만 원문을 제공한다.

### 5.7 데이터가 없으면 꾸미지 않는다

0으로 채운 KPI, 관련 없는 정렬, 사용 불가능한 Export와 필터를 빈 화면에 남기지 않는다.

## 6. 비목표

- 새 UI 프레임워크나 MUI 도입
- `globals.css` 전체 재작성
- 전체 라우트 URL 개편
- 새로운 모바일 관리자 앱
- API 계약을 무시한 프론트엔드 가짜 상태
- 데모용 가짜 운영 데이터 생성
- 전체 75개 페이지의 동시 재작성
- 디자인 변경과 무관한 API·Flutter·infra 리팩터링
- 기존 권한 또는 감사 로그 보호의 완화

## 7. 목표 정보 구조

역할별 첫 화면에는 다음 6개 업무 목적을 기준으로 한 바로가기를 제공한다.

```text
Shift command
Live service
Support cases
Partner review
Money actions
Handoff
```

기존 8개 운영 카테고리와 권한 모델은 즉시 제거하지 않는다. 1차 구현은 다음 방식으로 한다.

- 기존 URL과 권한 카테고리는 유지한다.
- 역할별 기본 홈과 빠른 업무 목적 6개를 제공한다.
- 월마감, 기록, 정책, 제한 설정, 개발 도구는 `Records & settings` 계열로 낮춘다.
- 역할에 허용되지 않은 항목은 계속 숨긴다.
- 직접 URL 접근과 API 가드는 기존 fail-closed 계약을 유지한다.

## 8. 공통 운영 큐 계약

새로운 범용 프레임워크를 만들지 말고, 이미 여러 화면에 반복되는 큐 표현을 최소 공통 모델로 정리한다.

| 필드 | 필수 | 의미 | 예시 |
|---|:---:|---|---|
| `priority` | 예 | 안전·고객·금액·SLA 영향 순위 | `P1 · customer waiting` |
| `case` | 예 | 사람이 읽는 사례 제목 | `Booking #9RSG` |
| `people` | 조건부 | 마스킹된 고객·파트너 | `Demo Customer / Linh Wellness` |
| `nextAction` | 예 | 지금 수행할 한 가지 행동 | `Contact partner` |
| `owner` | 예 | 책임 팀 | `Live Ops` |
| `assignee` | 예 | 현재 담당자 또는 미지정 | `Unassigned` |
| `sla` | 예 | 남은 시간 또는 초과 시간 | `22m overdue` |
| `lastAction` | 예 | 마지막 시도와 결과 | `Called 8m ago · no answer` |
| `impact` | 조건부 | 금액·서비스·사용자 영향 | `400,000 VND` |
| `freshness` | 예 | 데이터 기준 시각 | `Updated 12s ago` |

규칙:

- 기본 정렬은 priority → SLA → oldest다.
- 한 행의 설명은 두 줄을 넘지 않는다.
- 긴 근거는 disclosure 또는 오른쪽 상세 패널로 이동한다.
- 카드 전체 클릭만 사용하지 않고 명확한 CTA를 제공한다.
- 큐와 사례의 건수를 혼용하지 않는다.
- owner와 assignee는 다른 개념으로 유지한다.
- 데이터가 지원하지 않는 필드는 추측하거나 하드코딩하지 않는다. 별도 API 요구사항으로 기록한다.

## 9. 공통 사례 상세 계약

사례 상세의 첫 화면은 다음 순서로 구성한다.

1. 상태, SLA, 담당자, 마지막 업데이트
2. 고객·파트너·서비스·주소·결제의 최소 요약
3. 권장 다음 행동 하나와 선택 이유
4. 진행 체크리스트
5. 통화·채팅·위치·결제 근거 패널
6. 전체 타임라인과 운영 기록
7. 권한이 있을 때만 개발자 진단

위험 행동 규칙:

- `Blocked`: 사유와 다음 확인 시각 필수
- `Reopen`: 이전 완료 항목에서만 제공하고 사유 필수
- `No-show`: 고객 연락·파트너 도착·위치·결제 증거를 검토한 후 확인
- `Refund approve/reject`: 근거, 금액, 결제 경로, 고객 안내를 함께 확인
- `Partner approve/reject`: 누락 문서와 위험 신호를 함께 확인
- `Retry/Re-enable`: 기술적 사전 조건이 충족됐을 때만 활성화

## 10. 신규 요구사항

### OUX-030 — 공통 셸의 제목과 영구 액션 축소

관련 파일:

- `apps/admin_web/components/admin-workspace-header.tsx`
- `apps/admin_web/components/admin-page-template.tsx`
- `apps/admin_web/components/admin-root-shell.tsx`
- `apps/admin_web/components/admin-shell-nav.tsx`
- `apps/admin_web/lib/admin-navigation.ts`

요구사항:

- breadcrumb의 현재 페이지명, 상단 페이지명, 본문 H1의 삼중 반복을 하나의 주 제목으로 축소한다.
- 라이트/다크 두 버튼을 하나의 토글 또는 사용자 메뉴로 통합한다.
- 지역 전환 기능이 없다면 `Vietnam Operations` 영구 칩을 제거한다.
- `Live Workspace`는 제거하거나 실제 연결 상태와 데이터 기준 시각을 보여 준다.
- `Help`와 `Operations Policy`의 의미를 분리한다.
- 알림 아이콘 버튼에 접근 가능한 이름을 제공한다.
- 현재 내비게이션 레이블과 icon map을 동기화하고 fallback 아이콘 반복을 줄인다.
- 데스크톱 전용 정책을 유지한다면 실제로 사용하지 않는 모바일 메뉴 상태를 정리한다. 단, 1024px 차단 계약과 테스트를 먼저 확인한다.

수용 기준:

- 동일 페이지명이 시각적으로 두 번 이상 주 제목으로 반복되지 않는다.
- 첫 viewport에서 페이지의 주요 작업이 셸보다 먼저 인지된다.
- 모든 아이콘 버튼이 접근 가능한 이름을 가진다.
- 기존 역할 메뉴와 직접 URL 권한 테스트가 유지된다.

### OUX-031 — 역할별 작업 홈과 빠른 목적지

요구사항:

- Dispatcher, Support, Partner Ops, Finance, Shift Lead, Admin 역할별 기본 작업 목적을 정의한다.
- 상단 검색에서 `My queue`, `Unassigned`, 최근 사례, 기존 페이지를 구분한다.
- 기존 8개 권한 카테고리와 URL은 유지하되 일상 업무에서 Records/Settings/System의 시각적 우선순위를 낮춘다.
- 역할이 없는 MASTER_ADMIN은 전체 메뉴를 보되 업무 목적 바로가기를 제공한다.

수용 기준:

- 각 역할이 핵심 작업 큐를 2클릭 또는 10초 안에 연다.
- 권한 없는 메뉴는 노출되지 않는다.
- 기존 ADM-004/005/014 권한 회귀 테스트가 통과한다.

### OUX-032 — Start Shift를 실제 Shift Command로 변경

관련 파일:

- `apps/admin_web/app/page.tsx`
- Start Shift 관련 model/component/spec 파일

요구사항:

- `Needs action`, `Live now`, `Money status`를 실제 사례 중심으로 통합한다.
- `My queue`, `Unassigned`, `Escalations`, `Data anomaly` 뷰를 제공한다.
- 상단에는 가장 중요한 실제 사례 3개를 표시한다.
- 큐 카드의 CTA는 일반 큐가 아니라 다음 실제 사례 또는 명확한 필터 결과를 연다.
- 정상 큐는 `N queues clear` 한 줄로 접는다.
- 성과·리더·수요/공급 분석은 운영 명령 영역과 분리한다.
- `77d oldest` 같은 비정상 장기 사례는 Data anomaly로 분리한다.

수용 기준:

- 운영자가 10초 안에 최우선 실제 사례를 연다.
- `queues need attention`과 `total items`가 구분된다.
- 정상 큐가 위험 큐와 같은 시각적 무게를 갖지 않는다.

### OUX-033 — Live Bookings의 신뢰 가능한 라이브 조건

관련 파일:

- `apps/admin_web/app/bookings/booking-monitor-page.tsx`
- `apps/admin_web/app/bookings/booking-monitor.tsx`
- booking monitor model/list/filter/spec 파일

요구사항:

- 라이브 뷰는 상태와 시간 범위를 모두 만족한 사례만 포함한다.
- 오래된 활성 사례는 Data anomaly 저장 뷰로 분리한다.
- Demo/Smoke 레코드는 기본 운영 뷰에서 숨기거나 명확한 테스트 배지와 별도 필터를 사용한다.
- KPI와 바로 아래 필터에서 같은 수치를 반복하지 않는다.
- 기본 열 순서는 Status, SLA, Next action, Customer, Partner, Service, Area, Impact 순으로 검토한다.
- Next action은 동사, 이유, 초과 시간을 한두 줄로 표현한다.
- 고객 결제와 파트너 지급을 명확히 분리한다.
- Realtime 상태는 연결 여부와 마지막 업데이트 시각을 제공한다.

수용 기준:

- 기본 Live 화면에 정책상 허용 범위를 넘은 역사 사례가 없다.
- 데이터 격리 기준이 단위 테스트로 고정된다.
- 기존 개인정보 마스킹 계약이 유지된다.
- 첫 업무 행이 1440px 기본 viewport에서 보인다.

### OUX-034 — Booking Detail의 Decision Strip과 상태 변경 보호

관련 파일:

- `apps/admin_web/app/bookings/[id]/page.tsx`
- `apps/admin_web/app/bookings/[id]/booking-action-status-sections.tsx`
- booking detail model/section/action/spec 파일

요구사항:

- 상단 고정 Decision Strip에 상태, SLA, 담당자, 연락 상태, 위치, 결제, 권장 행동을 보여 준다.
- Customer contacted, Partner contacted, Location checked, Payment reviewed는 네 개의 체크리스트 행으로 표현한다.
- `Mark done`을 각 항목에 맞는 동사로 바꾼다.
- `Blocked`는 사유와 다음 확인 시각을 받는다.
- `Reset`은 완료된 항목에만 `Reopen checkpoint`로 제공한다.
- 노쇼, 취소, 만료 행동을 `Cannot complete service` 결정 흐름 안에서 상호 배타적으로 제공한다.
- 채팅·통화·위치·결제 근거를 결정 화면과 같은 문맥에서 확인한다.
- raw 상태와 rule ID는 운영 문구 아래의 기술 상세로 이동한다.
- 모든 변경의 actor, timestamp, before/after, note를 표시하거나 기존 감사 기록으로 연결한다.

수용 기준:

- pending 체크포인트에서 Reopen/Reset을 선택할 수 없다.
- 사유 없는 Block/Reopen/No-show 제출이 서버 액션까지 도달하지 않는다.
- 한 화면에서 근거를 확인하고 권장 행동을 완료할 수 있다.
- 예약·결제·지갑·매칭 비즈니스 규칙은 UI에서 재정의하지 않는다.

### OUX-035 — Customers를 지원 사례 탐색 화면으로 변경

관련 파일:

- `apps/admin_web/app/customers/page.tsx`
- customer list/filter/table/model/spec 파일

요구사항:

- Vuexy 구현 설명을 운영 목적 문구로 교체한다.
- 기본 KPI를 `Needs attention`, `Active booking`, `New today` 중심으로 축소한다.
- 성별·인구통계는 운영 첫 화면에서 제거하고 분석 화면으로 낮춘다.
- Support 역할은 Needs attention을 기본값으로 사용하거나 마지막 뷰를 기억한다.
- 목록에 문의/주의 이유, 마지막 연락, 담당자, SLA를 제공할 수 있는지 데이터 계약을 확인한다.
- 전화번호 마스킹과 상세 조회 보호를 유지한다.

수용 기준:

- 페이지 설명이 운영자 행동을 말하고 구현 기술을 언급하지 않는다.
- 지원 사례를 찾기 위해 불필요한 KPI를 해석하지 않아도 된다.
- 데이터가 없는 필드는 프론트엔드에서 생성하지 않는다.

### OUX-036 — Partner Approvals 전용 작업공간

관련 파일:

- `apps/admin_web/app/partners/page.tsx`
- partner filter/model/table/spec 파일

요구사항:

- Approval 뷰의 필터를 Search, Waiting age, Missing verification item, Risk flag로 제한한다.
- Revenue, Wallet debt, Bookings 같은 디렉터리 정렬은 Approval 뷰에서 숨긴다.
- 기본 정렬은 oldest pending이다.
- 행에 제출 시각, 누락 문서, 위험 신호, 검토자, 할당 상태를 표시한다.
- 0건이면 Export와 고급 필터를 숨긴다.
- 빈 상태에 held/rejected와 directory 이동을 제공한다.
- 일괄 승인은 제공하지 않고 필요하면 일괄 할당만 제공한다.

수용 기준:

- 0건 상태에서 무관한 필터와 Export가 첫 화면을 차지하지 않는다.
- 승인 결정은 개별 파트너 증거 화면에서 수행된다.
- 기존 Partner 권한과 운영 label map이 유지된다.

### OUX-037 — Finance Overview의 시간 범위와 작업 소유권

관련 파일:

- `apps/admin_web/app/finance-overview/page.tsx`
- finance overview model/component/spec 파일

요구사항:

- Today와 All open backlog를 다른 섹션 또는 탭으로 분리한다.
- Command 화면에서 월 세금 기간을 기본 노출하지 않는다.
- 작업 표에 Queue, Amount, Count, Oldest, Owner, Assignee, Next action을 제공한다.
- 활성 필터 배지 반복을 한 줄 범위 요약으로 축소한다.
- 금액을 계산할 수 없을 때 `0 VND`로 오인시키지 않고 `Amount unavailable`을 표시한다.
- 일반 운영자 화면에서 GL·세금 전문 용어의 우선순위를 낮춘다.

수용 기준:

- Today 영역에는 오늘 범위의 값만 있다.
- 각 금액 카드의 기간, 단위, 건수 관계가 설명된다.
- owner와 assignee를 지원하지 않는 API는 별도 요구사항으로 기록한다.

### OUX-038 — Shift Handoff와 Operations History 분리

관련 파일:

- `apps/admin_web/app/operations-handoff/page.tsx`
- operations handoff/history model/component/spec 파일

요구사항:

- 현재 교대 인계와 완료 이력을 명시적으로 분리한다.
- Handoff에 outgoing shift, incoming operator, timestamp, unresolved cases, owner, note, acknowledgement를 제공한다.
- 예외가 없으면 자유형 노트를 강제하지 않는다.
- 예외가 있으면 유형·현재 상태·다음 행동·담당자를 구조화해 기록한다.
- 수신 확인 전 상태를 `Awaiting acknowledgement`로 유지한다.
- KPI, checklist, issue signal, finance history의 반복을 하나의 미해결 사례 목록으로 통합한다.

수용 기준:

- 인계 후 모든 미해결 사례에 owner 또는 assignee가 있다.
- 수신 운영자와 확인 시각이 감사 가능하다.
- Operations History는 읽기 전용 기록으로 분리된다.

현재 API에 교대 실체나 acknowledgement가 없다면 UI에서 완료된 것처럼 가장하지 않는다. 데이터 모델/API 변경을 별도 보호 작업으로 제안한다.

### OUX-039 — Refund Review의 상태 모델과 사례 행 단순화

관련 파일:

- `apps/admin_web/app/refunds/page.tsx`
- refund command/filter/table/model/action/spec 파일
- 필요 시 관련 API refund/payment/booking read model

목표 상태 모델:

```text
Requested
→ Evidence review
→ Approved | Rejected
→ Payment pending
→ Customer notified
→ Closed
```

요구사항:

- 상단 수치는 상호 배타적 단계 또는 명시적인 별도 집합만 사용한다.
- refund, payment, booking 상태가 충돌하면 `State mismatch` 큐로 분리한다.
- 목록 기본 열을 Age, Customer, Amount, Reason, Evidence, Payment, Assignee, Next action 중심으로 구성한다.
- 반복되는 다섯 단계 Ops hint는 행에서 제거하고 상세 패널 체크리스트로 이동한다.
- 환불 승인/거절 전에 예약 근거, 결제 경로, 금액, 고객 안내 문구를 함께 검토한다.
- `Payment complete`와 `Customer notified`를 별도 완료 조건으로 기록한다.

수용 기준:

- `Total`, `Requested`, `Refunded booking`, `Needs action`의 관계를 운영자가 설명할 수 있다.
- `REQUESTED` refund와 `REFUNDED` payment/booking의 충돌이 일반 완료 상태처럼 보이지 않는다.
- 환불 결정은 기존 권한과 감사 로그를 유지한다.
- API 상태를 UI에서 임의로 재해석하지 않고 서버 소유 모델과 합의한다.

### OUX-040 — Notification 운영 큐와 기술 Incident 분리

관련 파일:

- `apps/admin_web/app/notifications/page.tsx`
- notification page model/queue/filter/table/delivery component/spec 파일
- 필요 시 관련 notification API read model

요구사항:

- Customer Support 작업, Platform incident, Device maintenance, Historical records를 분리한다.
- notification, attempt, user, device 단위를 모든 KPI에 명시한다.
- 동일 실패 원인은 개별 알림 수백 개가 아니라 incident로 묶고 영향 사용자·알림 수를 표시한다.
- 75일 된 실패 같은 역사 항목은 현재 SLA에서 제외하고 기록/데이터 정리 대상으로 분리한다.
- 운영자 기본 문구는 `Push unavailable · contact by phone`처럼 행동 중심으로 제공한다.
- FCM_HTTP_V1, HTTP status, token reason, worker/credential은 기술 상세 또는 Developer/System에 둔다.
- `Re-enable device`는 새 토큰 등록 등 사전 조건을 충족했을 때만 활성화한다.

수용 기준:

- 한 카드에서 서로 다른 단위의 수치를 같은 총계처럼 비교하지 않는다.
- 같은 기술 원인의 실패가 운영자 사례 747개로 중복되지 않는다.
- 고객/파트너 연락 행동과 플랫폼 기술 조치의 owner가 구분된다.

### OUX-041 — 데이터 범위·신선도·테스트 데이터 계약

적용 범위: 모든 운영 큐

요구사항:

- `Current shift`, `Today`, `All open`, `Historical` 범위 표현을 공통화한다.
- `last updated`, `source delayed`, `partial data`, `test data included` 상태를 공통 표현한다.
- Demo/Smoke 데이터의 식별 기준을 서버 또는 기존 데이터 필드에서 가져온다.
- 운영 화면에서 테스트 데이터를 기본 숨김 처리하되, QA 역할은 명시적으로 볼 수 있게 한다.
- 오래된 활성 상태는 무조건 삭제하지 않고 Data anomaly 큐로 보낸다.

수용 기준:

- 모든 운영 KPI에 시간 범위와 단위가 있다.
- 오래된 상태를 숨겨 데이터 문제를 은폐하지 않는다.
- 운영자 기본 화면에서 Demo/Smoke 레코드가 0건이다.

### OUX-042 — 운영 문구 사전

대표 교체:

| 현재 | 운영 문구 |
|---|---|
| Start Shift | Shift command |
| Resolve overdue | Review oldest refund / Contact affected customer |
| Booking Monitor | Live bookings |
| Mark done | Contact confirmed / Location verified / Payment checked |
| Blocked | Could not confirm |
| Reset | Reopen checkpoint |
| Confirm no-show | Review and confirm no-show |
| Full history | View completed handoffs |
| Live Workspace | Live · updated 12s ago |
| Review retries | Contact affected users / Open delivery incident |
| Customer list aligned to Vuexy | Find a customer and resolve booking, payment, wallet, or review issues. |

규칙:

- 사용자 화면은 Partner를 사용하고 내부 호환 코드만 Provider를 허용한다.
- CTA는 동사와 대상을 포함한다.
- `open`, `review`, `held` 같은 범용 단어는 대상과 완료 조건을 함께 쓴다.
- raw enum은 운영 문구의 보조 정보로만 제공한다.

### OUX-043 — 시각 위계와 접근성 마감

요구사항:

- 빨강은 실제 P1·차단·위험 상태에만 사용한다.
- 한 화면 primary CTA는 하나만 둔다.
- 정상 큐는 중립 처리하고 긴급 큐와 같은 색·크기를 사용하지 않는다.
- 목록은 카드보다 조밀한 행/표를 우선한다.
- 긴 설명은 disclosure나 상세 패널로 이동한다.
- 동일 정보를 KPI, 카드, 표에서 반복하지 않는다.
- 모든 아이콘 버튼은 이름을 갖는다.
- focus-visible, Escape, focus restore, heading 구조를 유지한다.
- 상태를 색만으로 전달하지 않는다.
- 1440px, 1980px, 1024px 경계, 200% 확대를 확인한다.

수용 기준:

- 첫 화면에서 최우선 작업과 primary CTA가 하나로 인지된다.
- 키보드만으로 핵심 큐 열기, 사례 확인, 안전한 취소/닫기가 가능하다.
- 기존 ADM-028/029 접근성 및 데스크톱 차단 테스트가 통과한다.

## 10.1 재감사 후속 요구사항

다음 `RA` 항목은 OUX 요구사항을 대체하지 않는다. 2026-08-04 재감사에서 확인된 구현 순서와 교차 화면 계약이며, OUX 완료 판정 전에 함께 만족해야 한다.

### RA-001 [P0] — 소스·실행본·화면을 동일 build ID로 고정

문제:

- 재감사 실행본에는 최신 Booking Detail 보호가 없었지만 최신 소스에는 있었다.
- 오래된 `.next` 화면과 최신 소스 테스트를 섞으면 미구현과 완료를 모두 잘못 판정할 수 있다.

요구사항:

- 기존 `next build`와 `next start` 흐름을 사용한다. 별도 배포 프레임워크를 추가하지 않는다.
- 빌드 직후 `.next/BUILD_ID`, 시작 시각, 검증 URL과 포트를 작업 결과에 기록한다.
- 브라우저 검증 전에 실행 프로세스가 같은 build ID를 제공하는지 확인한다.
- latest source, focused test, rendered DOM, screenshot을 한 증거 묶음으로 남긴다.

수용 기준:

- Booking Detail pending checkpoint에 `Reopen/Reset`은 0개이고 각 완료 동사는 1개다.
- `Could not confirm`은 사유 입력과 취소 가능한 확인 단계를 거친다.
- 보고서의 테스트 결과와 화면 캡처가 동일 build ID를 가리킨다.

### RA-002 [P0] — 환불 상태·행·summary의 서버 소유 단일 계약

문제:

- KPI는 서버 `summary.stateMismatchCount`를 사용하고 화면 행은 `refundHasStateMismatch()`로 다시 계산해 상단 3건과 보이는 mismatch 행 수가 충돌한다.

요구사항:

- API read model이 각 환불에 `operationalStage`, `stateMismatchReason`, `nextAction`, `assignee`를 제공한다.
- summary, 필터 total, pagination total과 행 상태는 같은 쿼리·같은 상태 판정 규칙을 사용한다.
- Admin UI는 서버 상태를 표시할 뿐, 별도 휴리스틱으로 운영 단계를 다시 만들지 않는다.
- `Open cases`와 `Awaiting decision`이 포함 관계면 문구로 명시하고, 단계 KPI라면 상호 배타 집합으로 제공한다.

수용 기준:

- `state-mismatch` 필터 total, KPI, pagination total과 결과 행이 동일 규칙으로 설명된다.
- 첫 페이지에서 보이는 mismatch 표시 수가 KPI와 다르더라도 pagination/필터 범위로 정확히 설명된다.
- 환불 상태 계약 테스트 하나가 summary와 각 행 판정의 동일성을 깨뜨리는 변경을 실패시킨다.

### RA-003 [P1] — Live·Backlog·Data anomaly·Test data 분리

문제:

- 19일/46일 예약, 74~77일 대기열, 75일 알림, Smoke/Demo가 현재 업무로 표시된다.

요구사항:

- 서버 read model에서 `dataClass = live | backlog | anomaly | test`, `scopeStart`, `scopeEnd`, `lastEventAt`, `sourceUpdatedAt`을 권위 있게 제공한다.
- 기본 운영 큐는 `test`를 제외하고 정책 시간을 넘은 활성 레코드는 `anomaly`에만 포함한다.
- 테스트 데이터 표식은 이름 문자열 추측보다 기존 seed/test 식별자 또는 명시 필드를 우선한다.

수용 기준:

- 기본 Live Bookings, Start Shift, Support 큐의 Smoke/Demo는 0건이다.
- 정책 시간을 넘은 활성 레코드는 Live KPI에서 0건이고 Data anomaly에서 같은 건을 찾을 수 있다.
- 시간 경계, timezone, cutoff 직전/직후와 테스트 데이터 제외를 단위 테스트로 고정한다.

### RA-004 [P1] — Booking Detail을 한 번의 결정 중심으로 축소

요구사항:

- 1440px 첫 viewport의 고정 Decision Strip에 상태, SLA, assignee, 연락, 위치, 결제, 권장 행동과 이유를 보여준다.
- checkpoint는 조밀한 행으로 만들고 선택한 한 행만 action을 연다.
- no-show, cancel, expiry는 `Cannot complete service` 아래 상호 배타 옵션으로 둔다.
- 한 시점의 primary CTA는 하나이며 기술 상태와 raw ID는 보조 상세로 이동한다.

수용 기준:

- 운영자는 첫 viewport에서 담당자, 핵심 근거와 권장 행동을 동시에 확인한다.
- 위험 상태 변경은 대상·사유·변경 전후·작업자·시각과 감사 이력을 남긴다.

### RA-005 [P1] — Notification을 incident 중심으로 집계

요구사항:

- 동일 provider, failureCode와 정책 time window의 반복 실패를 하나의 incident로 묶는다.
- incident는 영향 사용자, 영향 알림, 첫 발생, 최근 발생, owner와 customer fallback을 제공한다.
- 24시간 이상 과거 실패는 historical/data cleanup으로 보내 현재 SLA에서 제외한다.
- Support에는 연락 대상을, Platform owner에는 기술 조치를 기본 표시한다. FCM 원문은 Developer 상세로 이동한다.

수용 기준:

- 같은 원인의 100개 실패는 1 incident로 보인다.
- 과거 실패는 현재 overdue KPI에 포함되지 않는다.
- incident grouping과 historical cutoff를 테스트한다.

### RA-006 [P1] — Partner Approval의 전용 필터와 빈 상태

요구사항:

- Approval 화면에는 Search, Waiting age, Missing item, Risk flag만 기본 노출한다.
- 0건이면 필터와 Export를 접고 `Held/Rejected 보기`, `Partner directory 열기`를 다음 목적지로 제공한다.
- Revenue, Wallet debt, Bookings 같은 directory 정렬은 Approval에서 제거한다.

수용 기준:

- 0건 화면의 첫 viewport에서 결과 없음과 다음 목적지가 즉시 보인다.

### RA-007 [P2] — Customers를 지원 사례 탐색 화면으로 마감

요구사항:

- 설명은 `Find a customer and resolve booking, payment, wallet, or review issues.`처럼 지원 업무를 말한다.
- 기본 KPI는 Needs attention, Active booking, New today 세 개만 사용한다.
- Support 기본 뷰는 Needs action으로 두고 성별 정보는 분석 또는 고급 필터로 이동한다.
- Vuexy, component, table alignment 같은 구현 문구를 운영 화면에서 제거한다.

수용 기준:

- 1440px 첫 viewport에 첫 업무 행이 보이고 구현 기술 문구와 성별 KPI가 없다.

### RA-008 [P2] — Finance Today와 All-open 범위 분리

요구사항:

- `Today movement`와 `Current open backlog`를 별도 탭 또는 명시적 섹션으로 나눈다.
- Today의 count와 amount는 today query만 사용한다.
- all-date 값은 Current backlog에만 표시하고 금액 집계가 없으면 `0 VND` 대신 `Amount unavailable`을 사용한다.
- Command 기본 화면에서 Monthly tax period와 세금 전문 카드를 숨긴다.

수용 기준:

- 사용자가 모든 금액과 건수의 시간 범위를 라벨만 보고 구분한다.

### RA-009 [P2] — Handoff와 History의 데이터 모델 분리

요구사항:

- `ShiftHandoff`는 outgoing shift, incoming operator, unresolved case IDs, owner, note, acknowledgedBy/At를 저장한다.
- History는 읽기 전용으로 유지한다. API가 없으면 History의 쓰기 UI를 제거하고 `API contract needed`로 보고한다.

수용 기준:

- 현재 Handoff의 모든 미해결 건에 owner 또는 assignee가 있다.
- 수신 확인은 작업자와 시각이 감사 가능하며 History에는 `Write note` 같은 현재 작업이 없다.

### RA-010 [P2] — KPI·탭·필터·badge 반복 제거

요구사항:

- 페이지 기본 구조는 `작업 요약 한 줄 → 큐 탭 → 결과 표`다.
- 고급 필터와 참고 지표는 disclosure에 둔다.
- Booking, Customers, Refunds, Notifications, Operations History부터 중복을 제거한다.

수용 기준:

- 같은 count는 첫 viewport에서 최대 두 번만 보인다.
- 첫 사례 행이 필터보다 먼저 또는 같은 viewport에 보인다.

### RA-011 [P3] — 상태·액션 시각 위계 마감

요구사항:

- danger는 즉시 차단 또는 고객·금액 위험에만 사용한다.
- overdue backlog는 warning, historical/anomaly는 neutral로 구분한다.
- 페이지당 primary CTA 하나를 유지하고 상태를 색만으로 전달하지 않는다.

수용 기준:

- 흑백과 색각 차이가 있어도 텍스트, 아이콘과 위치로 우선순위를 구분할 수 있다.
- 1440px, 1980px, 1024px 경계와 200% 확대, 키보드 흐름을 통과한다.

## 11. 구현 순서

1. **RA-001 증거 정렬**: 최신 소스를 빌드하고 동일 build ID에서 Booking Detail과 핵심 화면을 다시 캡처한다. 이 단계 전에는 화면 요구사항을 완료 처리하지 않는다.
2. **RA-002 환불 계약**: 서버 소유 단계·summary·필터·행·pagination을 하나의 계약으로 통일한다.
3. **RA-003 데이터 격리**: Live, backlog, anomaly, test를 read model과 쿼리에서 분리한다.
4. **RA-004 + RA-005 핵심 판단**: Booking Decision Strip과 Notification incident를 각각 완결된 slice로 구현한다.
5. **RA-006 + RA-007 + RA-008 역할 화면**: Partner Approval, Customers, Finance를 운영 목적에 맞게 정리한다.
6. **RA-009 + RA-010 정보 구조**: Handoff/History 모델을 분리하고 KPI·필터 반복을 제거한다.
7. **RA-011 마감**: 시각 위계, 접근성, viewport와 200% 확대를 최종 검증한다.

각 번호는 별도 완결 slice로 수행한다. 일반적인 UI slice는 3~8개 파일을 목표로 하되, RA-002·003·005·009처럼 서버 권위가 필요한 항목은 최소한의 end-to-end 계약 파일과 테스트까지 포함한다. 공통 추상화나 새 의존성보다 기존 read model, helper와 컴포넌트의 가장 높은 공유 지점을 수정한다.

## 12. 검증 계약

### 12.1 매 slice 필수

- 변경 전 `git status --short`
- 관련 테스트 파일 실행
- Admin typecheck 또는 변경 범위에 맞는 검증
- 결과 있음, 0건, 필터 결과 없음, 로드 실패, 권한 없음 상태 확인
- 기존 개인정보·권한·감사 로그 회귀 확인
- 변경 전후 화면을 같은 viewport와 가능한 한 같은 데이터 상태로 캡처
- 최신 소스 빌드 ID와 실행 중 build ID를 기록하고 같은 값인지 확인
- 소스, 테스트, DOM과 screenshot이 같은 빌드에서 나온 증거인지 확인

### 12.2 공통 컴포넌트 변경

최소 확인 화면:

- Start Shift
- Live Bookings
- Customers
- Partner Approvals
- Finance Overview
- Refunds
- Notifications

### 12.3 권장 명령

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- <focused-spec-files>
npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run verify:scope -- -Scope admin
```

API·예약·결제·지갑·매칭·권한·감사 계약을 변경하면 관련 API 테스트와 `-Scope api`를 추가한다. 전체 로컬 검증은 완결된 보호 영역 변경 또는 병합 전 단계에서만 수행한다.

재감사 당시 최신 소스 기준으로 다음 7개 spec의 62개 테스트가 통과했다. 이것은 새 기준선일 뿐 최신 프로덕션 빌드와 브라우저 확인을 대신하지 않는다.

```text
apps/admin_web/app/bookings/[id]/booking-action-status-sections.spec.tsx
apps/admin_web/app/refunds/page.spec.tsx
apps/admin_web/app/customers/page.spec.tsx
apps/admin_web/app/partners/page.spec.tsx
apps/admin_web/app/finance-overview/page.spec.tsx
apps/admin_web/app/operations-handoff/page.spec.tsx
apps/admin_web/app/notifications/page.spec.tsx
```

후속 slice에는 다음 회귀 검증을 추가하거나 기존 spec에 최소한으로 보강한다.

- Refund: summary, `state-mismatch` 필터 total, pagination과 행 상태가 같은 서버 계약을 사용한다.
- Live data: timezone/cutoff 경계와 test/anomaly 기본 제외를 검증한다.
- Notification: incident grouping과 historical cutoff가 현재 SLA를 오염시키지 않는다.
- Handoff: 미해결 사례 owner와 acknowledgement 감사 필드를 검증한다.

## 13. 성공 지표

| 지표 | 목표 |
|---|---|
| 최우선 사례 열기 | 교대 시작 후 10초, 2클릭 이하 |
| 라이브 예외 담당자 할당 | 30초 이하 |
| 사유 없는 위험 상태 변경 | 0건 |
| Live 큐의 역사 데이터 | 0건, Data anomaly로 분리 |
| 운영 기본 화면의 Demo/Smoke | 0건 |
| 미지정 SLA 초과 사례 | 교대 종료 시 0건 목표 |
| 인계 수신 확인 | 100% |
| 기본 화면의 내부 기술 오류 코드 | 0건 |
| 역할별 일상 업무 목적지 | 6개 이하 |
| 개인정보 회귀 | 원문 전화·전체 주소 기본 목록 노출 0건 |

## 14. 완료 정의

요구사항 하나는 다음을 모두 만족할 때만 완료다.

- 화면의 문제와 운영 영향을 해결했다.
- 기존 ADM-001~029 보호장치를 유지했다.
- 데이터 단위와 시간 범위를 코드/문구/테스트에서 일치시켰다.
- 위험 행동의 권한·사유·감사 계약을 유지하거나 강화했다.
- 관련 테스트와 typecheck가 통과했다.
- 최신 소스와 실행본의 build ID가 같고 결과에 기록됐다.
- 같은 build ID와 viewport의 before/after 캡처로 개선을 확인했다.
- 수정 파일, 실행 명령, 보호 영역, 남은 위험, 다음 작업을 보고했다.

## 15. Codex가 임의로 결정하면 안 되는 항목

다음 항목은 실제 데이터 모델과 비즈니스 권위 확인 없이 UI만으로 결정하지 않는다.

- 환불 단계와 최종 완료 조건
- Live Booking의 정확한 시간 경계
- 교대 shift/acknowledgement의 데이터 모델
- owner/assignee 저장 위치와 권한
- 알림 incident 묶음 기준과 재시도 정책
- 파트너 승인·거절 권한과 필수 증거
- 결제·지갑·정산 상태 변경
- 예약 취소·만료·노쇼의 비즈니스 결과

필요 데이터가 없으면 가짜 값을 만들지 말고 `UI can proceed / API contract needed / protected review needed`로 구분해 보고한다.
