# HANDS Admin Navigation & IA 재감사 보고서

- 감사일: 2026-08-08
- 대상: `C:\dev\massage-on-demand-vn`
- 기준 화면: 1692 × 1272 데스크톱
- 근거: 첨부 구현 보고서, 현재 코드, 독립 테스트, 로그인 브라우저 실화면, 키보드 포커스, 테마 및 콘솔 로그
- 변경 범위: 애플리케이션 코드는 수정하지 않았으며 이 보고서와 현재 감사 캡처만 생성함

## 1. 최종 판정

**조건부 통과**다. 첨부 보고서에서 주장한 핵심 내비게이션 개선은 대부분 실제 코드와 화면에 반영되었고, 독립적으로 다시 실행한 Admin 전체 게이트도 모두 통과했다.

- 구현 보고서 준수도: **93/100**
- 운영자 중심 화면 품질: **86/100**
- 종합 품질: **89/100 · Good**

다만 최종 완료로 보기에는 네 가지가 남아 있다.

1. `Setup Readiness`의 핵심 콘텐츠가 운영 상태가 아니라 개발 로드맵·E2E·baseline command 중심이다.
2. 상위 작업공간 대표 링크가 실제 현재 URL과 다른데도 `aria-current="page"`를 가진다.
3. `App Session Diagnostics` 헤더의 `Shift command`는 상시 노출 사이드바와 중복된다.
4. 알림이 0건일 때 `role="menu"` 안에 `menuitem`이 하나도 없는 접근성 불일치가 있다.

이 중 1번은 운영자 관점의 정보구조 문제로 우선 수정해야 한다. 나머지는 현재 기능을 막지는 않지만 최종 IA·접근성 마감 전에 정리하는 것이 맞다.

## 2. 첨부 구현 보고서 주장 검증

| 구현 보고서 주장 | 독립 판정 | 근거 |
| --- | --- | --- |
| 세부 페이지까지 정확한 breadcrumb 제공 | 통과 | 브라우저 캡처와 `admin-nav-match.spec.ts`에서 Referrals, Messaging, Booking Closeout, System Health, payout risk 확인 |
| System Health를 사이드바 한 항목으로 축소하고 상세 페이지를 로컬 내비게이션으로 제공 | 부분 통과 | 화면 구조는 맞지만 `/app-sessions`에서 `/setup` 링크도 `aria-current="page"`를 가짐 |
| Push Send와 Customer Referrals의 중복 헤더 액션 제거 | 통과 | Push Send에 헤더 액션 없음, Customer Referrals는 Referral Cashouts 중복 없음 |
| 전역 검색 입력 고정, 결과만 스크롤 | 통과 | 입력 상단 유지, 결과 목록 `overflow-y:auto`, `scrollTop:0` 확인 |
| 검색·알림 Escape 후 트리거로 포커스 복귀 | 통과 | 브라우저에서 Search와 Operation Alerts 모두 트리거 복귀 확인 |
| Operation Alerts 키보드 이동 | 부분 통과 | populated item 로직·테스트 통과, 실제 fixture는 0건이라 실화면 항목 이동은 확인 불가. 빈 메뉴 의미론 문제는 남음 |
| payout saved view의 상태·해제·적용 범위 구분 | 통과 | `Risk state · Clear`, `Clear saved view`, 비적용 배치 안내와 hash anchor 확인 |
| 라이트·다크 muted/inactive 대비 | 통과 | 라이트 muted 5.09:1, sidebar muted 4.64:1, 다크 muted 6.18:1, sidebar muted 5.09:1 |
| Admin 전체 테스트·빌드·가드 통과 | 통과 | 826 files / 4,406 tests, typecheck, lint, guards, visible copy, build 모두 PASS |

## 3. 화면별 재감사

### Step 1 — Shift Command

**상태: 양호**

- 사이드바 대분류 7개와 Shift Command가 명확하게 분리된다.
- `Next action → Open queues → Money status` 순서가 운영 우선순위와 맞다.
- 첫 화면에서 업무량이 많지만 가장 오래된 재무 큐와 SLA가 상단에 있어 의사결정 방향은 분명하다.
- 이 IA 변경으로 인한 회귀는 찾지 못했다.

### Step 2 — Customer Referrals

**상태: 통과**

- breadcrumb가 `Growth & Communications → Referrals → Customer Referrals`까지 정확하다.
- 로컬 탭은 Customer / Partner / Cashouts를 한 작업공간에 묶는다.
- 과거 중복이던 Referral Cashouts 헤더 액션은 제거되었다.
- 남은 `Open policy settings`는 기능상 타당하나 `Open referral policy`처럼 대상이 드러나는 문구가 더 친화적이다.

### Step 3 — Setup Readiness

**상태: IA 통과, 운영 콘텐츠는 개선 필요**

- `System Health`는 사이드바에 한 번만 보이고 로컬 탭은 세 상세 페이지를 제공한다.
- breadcrumb와 H1 `Setup Readiness`는 일치한다.
- 그러나 본문에는 `Developer readiness`, `Master progress control`, `HANDS MVP work`, `Verified baseline`, `Show baseline commands`, 저장소 roadmap 경로가 노출된다.
- 이것은 운영자가 서비스 상태를 판단하는 화면이라기보다 개발 프로젝트 관리 화면이다.

권장 구조:

1. 운영자용 `System Health`에는 서비스/통합별 상태, 마지막 정상 시각, 업무 영향, 담당 팀, 운영자가 할 다음 행동을 제공한다.
2. 개발 로드맵, baseline command, 저장소 경로는 별도 개발자 전용 화면으로 이동하거나 개발자 권한에서만 노출한다.
3. 상태 명칭을 `Ready / Partial / Blocked`에서 `정상 / 제한 운영 / 운영 차단`과 같이 업무 영향 중심으로 바꾼다.

### Step 4 — App Session Diagnostics

**상태: 부분 통과**

- breadcrumb, 로컬 탭, H1이 모두 `App Session Diagnostics`로 맞춰졌다.
- Live / Stale / Expired 구분과 필터는 운영상 유용하다.
- 헤더의 `Shift command`는 항상 보이는 사이드바의 Shift Command와 중복되므로 제거하는 편이 낫다.
- `Notifications`는 관련 업무 연결이라 유지할 수 있지만 `Open notification delivery`처럼 목적을 명확히 해야 한다.
- 데이터가 모두 0일 때 6개의 큰 metric card가 동일한 무정보 상태를 반복한다. `No live, stale, or expired app sessions` 요약을 먼저 보여주고 상세 지표는 축약하는 편이 빠르다.
- 운영자가 기술 용어에 익숙하지 않다면 `App Activity & Reachability` 또는 `App Connectivity`가 더 직접적이다.

### Step 5 — Push Send

**상태: 구조 통과, 문구·대상 선택 개선 필요**

- 중복 Templates 헤더 액션은 제거되었다.
- preview-first 흐름과 `Preview required` 상태는 대량 발송 안전장치로 적절하다.
- `FCM deliveries`, `Specific user id`, `Optional user id`는 구현 중심 표현이다.
- 특정 사용자 발송에서 운영자가 내부 ID를 직접 입력해야 하는 구조는 오류 가능성이 높다.

권장 수정:

- 설명: `Review the audience before sending a manual app notification.`
- 특정 대상: 고객/파트너 이름·전화번호 검색 후 계정을 선택하고 내부 ID는 보조 정보로 표시한다.
- preview 확인에는 대상 수, 역할, 언어, 열릴 화면, 제외 수와 제외 이유를 한 번에 보여준다.

### Step 6 — Post-match Cancellations

**상태: 시각·정보구조 통과, ARIA 의미론 수정 필요**

- breadcrumb가 `Booking Operations → Booking Closeout → Post-match Cancellations`로 정확하다.
- Completed Services와 Post-match Cancellations를 한 closeout 작업공간으로 묶은 구성이 합리적이다.
- 화면에서는 Post-match Cancellations가 선택되지만 사이드바의 `/bookings/completed` 대표 링크도 `aria-current="page"`를 가진다.
- 시각적 작업공간 선택은 유지하되 `aria-current`는 실제 현재 목적지 링크 하나에만 써야 한다.

### Step 7 — Payout / Withdrawal Risk saved view

**상태: 통과**

- hash anchor가 정확히 withdrawal request 섹션의 상단으로 이동했다.
- `Risk state · Clear`는 현재 saved view가 위험 레코드 0건임을 말하고, `Clear saved view`는 필터 제거 행동으로 분리되어 있다.
- `Other payout batches · not filtered by this saved view.`가 아래 표 범위를 분명하게 설명한다.
- 보고서에서 의도한 혼동 제거가 실제 화면에서도 달성되었다.

### Step 8 — Global search 기본 결과

**상태: 통과**

- `partner` 검색 시 Partner Operations의 운영 목적지가 우선 노출된다.
- 입력은 계속 보이고 포커스도 입력에 유지된다.
- 기본 7개 결과는 빠른 탐색에 충분하며 각 결과의 소속 작업공간도 표시된다.

### Step 9 — Global search 전체 결과

**상태: 통과**

- 22개 결과를 열어도 검색 입력은 상단에 고정된다.
- 결과 목록만 368px 높이에서 스크롤되고 `scrollTop=0`으로 첫 그룹부터 시작한다.
- `Partner Operations` 그룹 제목이 첫 화면에 유지되어 분류를 잃지 않는다.

### Step 10 — Operation Alerts

**상태: 기능 통과, 빈 상태 접근성 개선 필요**

- Escape 후 알림 트리거로 포커스가 돌아온다.
- 실제 데이터는 `No operation alerts`였고 콘솔 오류는 없다.
- 현재는 `role="menu"` 컨테이너에 `menuitem`이 0개이며 포커스는 트리거에 남는다.
- 0건일 때는 popover를 `role="status"` 또는 작은 비모달 상태 영역으로 렌더링하거나, 전체 popover를 `dialog` 패턴으로 통일하는 편이 정확하다.
- 시각적으로도 빈 상태 안에 다시 카드가 들어가 불필요한 card-in-card가 생긴다. 한 줄 상태로 줄이면 충분하다.

### Step 11 — Dark theme

**상태: 통과**

- 본문, muted copy, 비활성 내비게이션, 표면과 테두리가 실제 화면에서 구분된다.
- 계산 대비도 WCAG AA 본문 기준을 넘는다.
- 라이트 테마로 원상복구한 뒤 감사를 종료했다.

## 4. 우선순위별 수정 요구사항

### P1 — 운영자용 System Health와 개발자용 readiness 분리

관련 파일:

- `apps/admin_web/app/setup/setup-overview-section.tsx:48`
- `apps/admin_web/app/setup/setup-progress-control-section.tsx:29`
- `apps/admin_web/app/setup/setup-progress-control-section.tsx:47`
- `apps/admin_web/app/setup/setup-page-model.ts:202`

완료 조건:

- 일반 운영자 화면에서 저장소 경로, baseline command, MVP roadmap 문구가 보이지 않는다.
- 각 상태 항목은 `상태 / 업무 영향 / 마지막 확인 / 담당 팀 / 다음 행동`을 제공한다.
- 개발 정보가 필요하면 권한이 분리된 별도 화면 또는 상세 disclosure로 이동한다.

### P2 — `data-active`와 `aria-current` 분리

관련 파일:

- `apps/admin_web/components/admin-shell-nav.tsx:178`
- `apps/admin_web/components/admin-shell-nav.tsx:206`
- `apps/admin_web/components/admin-shell-nav.spec.tsx:246`

수정 방법:

- 상위 작업공간이 선택되었음을 표현할 때는 `data-active="true"`만 사용한다.
- `aria-current="page"`는 링크의 `href`가 `activeDestination`과 정확히 같은 경우에만 설정한다.
- `/app-sessions`에서는 `/app-sessions` 로컬 탭만, post-match cancellation에서는 해당 세부 링크만 current가 되도록 테스트한다.

### P2 — App Sessions 중복 액션 제거와 0-state 압축

관련 파일:

- `apps/admin_web/app/app-sessions/page.tsx:86`

완료 조건:

- 헤더의 `Shift command`를 제거한다.
- Notifications를 유지할 경우 동사와 목적을 포함한 문구로 바꾼다.
- 모든 지표가 0일 때 운영자가 1초 안에 정상/무데이터를 판단할 수 있는 요약 상태를 제공한다.

### P2 — Operation Alerts 빈 상태 의미론 수정

관련 파일:

- `apps/admin_web/components/admin-workspace-header.tsx:304`

완료 조건:

- `role="menu"`를 사용한 경우 최소 하나의 focusable `menuitem`이 존재한다.
- 0건이면 menu가 아닌 status/dialog 패턴을 사용하고 알림 트리거의 label도 현재 0건 상태를 전달한다.
- Escape, 바깥 클릭, 첫 항목 포커스, Arrow/Home/End, 포커스 복귀 테스트를 유지한다.

### P2 — Push Send 특정 사용자 검색 제공

관련 파일:

- `apps/admin_web/app/notifications/push-send/page.tsx:150`
- `apps/admin_web/app/notifications/push-send/page.tsx:199`
- `apps/admin_web/app/notifications/push-send/page.tsx:235`

완료 조건:

- 운영자가 raw user ID를 외워 입력하지 않아도 된다.
- 이름·전화번호·역할로 검색하고 명확한 한 계정을 선택한다.
- `FCM` 같은 내부 전송 구현 용어를 운영 문구에서 제거한다.

### P3 — 별도 시각 부채

Impeccable detector가 현재 `globals.css`의 기존 left-rail/side-tab 패턴 6건을 보고했다. 이번 내비게이션 수정의 직접 회귀는 아니며 아래 소유 화면을 각각 확인한 뒤 별도 정리해야 한다.

- Vietnam map operator read
- Marketing needs-action cards
- Booking finance highlight
- Dispatch step cards
- Timeline steps
- Operations check items

일괄 제거하면 상태 구분이 사라질 수 있으므로 공통 토큰과 한 가지 강조 규칙으로 통합하는 방식이 안전하다.

## 5. 검증 결과

### 독립 실행 명령

1. 대상 Admin 회귀 테스트 9개 파일: **138 tests PASS**
2. `npm.cmd run verify:scope -- admin`: **PASS**
3. Admin 전체 테스트: **826 files / 4,406 tests PASS**
4. TypeScript typecheck: **PASS**
5. ESLint: **PASS**
6. Admin query guards: **0 violations**
7. Admin visible copy: **1,566 files / 0 violations**
8. Admin production build: **65 pages generated**
9. 브라우저 console warnings/errors: **0**

### 접근성 증거의 한계

- DOM role, accessible name, `aria-current`, 실제 키보드 Escape와 포커스 복귀는 확인했다.
- 알림 데이터가 0건이어서 populated menu의 Arrow/Home/End 이동은 현재 코드와 component fixture 결과로 확인했다.
- 실제 NVDA/JAWS/VoiceOver 발화 순서, OS 고대비 모드, 색각 시뮬레이션은 이번 자동 감사에서 직접 측정하지 않았다.

## 6. 릴리스·작업 트리 위험

- 현재 worktree에는 1,598개 상태 항목이 있고 Admin 관련 항목 959개, 보호 영역으로 분류되는 항목 410개가 함께 존재한다.
- 자동 검증은 모두 통과했지만 이 정도 규모의 미커밋 변경에서는 이번 IA 수정만 독립적으로 추적·리뷰하기 어렵다.
- 최종 릴리스 전에는 최소한 내비게이션/IA 변경을 별도 commit 또는 명확한 변경 묶음으로 분리하고, 보호 영역 변경과 독립적으로 검토해야 한다.
- 이번 감사는 reset, checkout, cleanup, commit, push, 배포, 데이터 변경을 하지 않았다.

## 7. 현재 감사 캡처

### 01 — Shift Command

![Shift Command](C:/dev/massage-on-demand-vn/output/admin-navigation-ia-final-reaudit-2026-08-08/01-shift-command.png)

### 02 — Customer Referrals

![Customer Referrals](C:/dev/massage-on-demand-vn/output/admin-navigation-ia-final-reaudit-2026-08-08/02-referral-customers.png)

### 03 — Setup Readiness

![Setup Readiness](C:/dev/massage-on-demand-vn/output/admin-navigation-ia-final-reaudit-2026-08-08/03-system-health-setup.png)

### 04 — App Session Diagnostics

![App Session Diagnostics](C:/dev/massage-on-demand-vn/output/admin-navigation-ia-final-reaudit-2026-08-08/04-system-health-app-sessions.png)

### 05 — Push Send

![Push Send](C:/dev/massage-on-demand-vn/output/admin-navigation-ia-final-reaudit-2026-08-08/05-notifications-push-send.png)

### 06 — Post-match Cancellations

![Post-match Cancellations](C:/dev/massage-on-demand-vn/output/admin-navigation-ia-final-reaudit-2026-08-08/06-post-match-cancellations.png)

### 07 — Payout saved view

![Payout saved view](C:/dev/massage-on-demand-vn/output/admin-navigation-ia-final-reaudit-2026-08-08/07-payout-saved-view.png)

### 08 — Global search default

![Global search default](C:/dev/massage-on-demand-vn/output/admin-navigation-ia-final-reaudit-2026-08-08/08-global-search-default.png)

### 09 — Global search show all

![Global search show all](C:/dev/massage-on-demand-vn/output/admin-navigation-ia-final-reaudit-2026-08-08/09-global-search-show-all.png)

### 10 — Operation Alerts empty state

![Operation Alerts](C:/dev/massage-on-demand-vn/output/admin-navigation-ia-final-reaudit-2026-08-08/10-operation-alerts.png)

### 11 — Dark theme

![Dark theme](C:/dev/massage-on-demand-vn/output/admin-navigation-ia-final-reaudit-2026-08-08/11-dark-theme-payout.png)

## 8. 권장 실행 순서

1. Setup Readiness를 운영자 화면과 개발자 화면으로 분리한다.
2. sidebar representative의 `aria-current` 의미론을 수정한다.
3. App Sessions 중복 액션과 0-state를 정리한다.
4. Operation Alerts 0건 semantics를 수정한다.
5. Push Send의 raw user ID 입력을 검색 선택기로 바꾼다.
6. 같은 9개 대상 회귀 테스트와 `verify:scope -- admin`을 다시 실행한다.
7. 1692 × 1272에서 같은 경로와 키보드 흐름을 재캡처한다.
