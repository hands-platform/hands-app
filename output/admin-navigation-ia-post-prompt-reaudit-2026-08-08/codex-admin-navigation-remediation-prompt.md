# Codex 실행 프롬프트 — HANDS Admin 내비게이션·정보구조 최종 개선

아래 내용을 새 Codex 작업에 그대로 붙여 넣어 사용한다.

---

## 작업 목표

`C:\dev\massage-on-demand-vn` 저장소의 HANDS 관리자 웹에서 내비게이션·카테고리·워크스페이스·브레드크럼·전역 검색의 남은 운영 UX 결함을 실제 코드로 수정하고, 데스크톱 실화면과 자동 검증으로 완료 여부를 증명해라.

이 작업은 분석 보고서 작성만 하는 일이 아니다. 먼저 현재 상태를 확인한 뒤 필요한 코드를 구현하고, 테스트를 추가·수정하고, 실제 브라우저로 결과를 다시 검수해야 한다.

가장 먼저 다음 기준 문서를 처음부터 끝까지 읽고 이를 source of truth로 사용해라.

- 감사 보고서: `C:\dev\massage-on-demand-vn\output\admin-navigation-ia-post-prompt-reaudit-2026-08-08\admin-navigation-post-prompt-reaudit.md`
- 증거 캡처 폴더: `C:\dev\massage-on-demand-vn\output\admin-navigation-ia-post-prompt-reaudit-2026-08-08`
- 저장소 지침: 저장소 루트와 작업 대상 하위 경로의 모든 `AGENTS.md`

## 사용자와 운영 환경

- 사용자는 프로그래머가 아니라 HANDS 운영자다.
- 운영자가 현재 위치, 처리 대상, 다음 행동을 빠르게 판단할 수 있어야 한다.
- 실제 사용 화면은 1440px 이상 데스크톱이다.
- 1024px 이하 반응형 디자인은 이번 작업에서 분석·수정·테스트·보고하지 마라. 기존 동작은 훼손하지 않되 모바일 개선에 시간을 쓰지 마라.
- 현재 디자인 시스템, Vuexy 계열 토큰, 카드/테이블/버튼 패턴을 유지한다.
- 새로운 UI 라이브러리나 production dependency를 추가하지 마라.
- 이미 잘된 Shift Command 활성 표현, 검색 기본 랭킹, 저장 뷰 query/hash, 다크 테마, 기존 권한 로직은 보존한다.

## 작업 안전 규칙

1. 작업 트리가 이미 많이 변경돼 있을 수 있다. 기존 사용자 변경을 되돌리거나 덮어쓰지 마라.
2. 먼저 `git status --short`와 관련 파일 diff를 확인하고, 이번 요구에 필요한 파일만 최소 범위로 수정해라.
3. API, Prisma schema/migration, 인증, 공개 웹, Customer/Partner 앱은 건드리지 마라. 관리자 프런트엔드와 관련 테스트/검증 스크립트만 작업한다.
4. 테스트를 통과시키기 위해 검사를 삭제하거나 assertion을 약화하지 마라. 사용자에게 더 나은 의도된 문구로 변경되어 기존 테스트가 낡은 경우에만 근거를 남기고 expectation을 갱신한다.
5. 임의의 대규모 리팩터링, 새 허브 페이지, 새 최상위 카테고리, 전면적인 색상/타이포그래피 변경은 하지 마라.
6. 화면에 데이터를 만들기 위해 실제 운영 레코드를 생성·수정·삭제하지 마라. 필요한 상호작용은 read-only 화면과 테스트 fixture로 검증한다.

## 구현 요구사항

### 1. 브레드크럼 판정 정확도 수정

주요 파일:

- `apps/admin_web/lib/admin-nav-match.ts`
- `apps/admin_web/lib/admin-nav-match.spec.ts`
- 필요 시 `apps/admin_web/lib/admin-navigation.ts`

현재 문제:

- `/referrals/customers`가 `HANDS > Growth & Communications > Referrals`에서 끝나며 `Customer Referrals`가 생략된다.
- `/setup`, `/app-sessions`, `/background-jobs`에서 `System Health` workspace가 생략된다.
- 일반 대표 페이지와 query 기반 특수 검색 진입점의 page-label 우선순위가 섞여 있다.

필수 결과:

- `/referrals/customers` → `HANDS > Growth & Communications > Referrals > Customer Referrals`
- `/referrals/partners` → `HANDS > Growth & Communications > Referrals > Partner Referrals`
- `/notifications/templates` → `HANDS > Growth & Communications > Messaging > Notification Templates`
- `/notifications/push-send` → `HANDS > Growth & Communications > Messaging > Push Send`
- `/bookings/post-match-cancellations` → `HANDS > Booking Operations > Booking Closeout > Post-match Cancellations`
- `/setup` → `HANDS > Administration & Settings > System Health > Setup Readiness`
- `/app-sessions` → `HANDS > Administration & Settings > System Health > App Session Diagnostics`
- `/background-jobs` → `HANDS > Administration & Settings > System Health > Background Jobs`
- 출금 위험 query 진입점은 기존처럼 `Finance Records & Close > Partner Money > Payout / Withdrawal Risk`를 유지한다.

구현 원칙:

- query로 구체화된 특수 search entry는 일반 workspace 대표 페이지보다 우선한다.
- query가 없는 workspace 대표 URL에서는 실제 `activeWorkspacePage`를 일반 대표 search entry보다 우선한다.
- System Health처럼 sidebar의 local/representative group도 workspace 후보로 계산한다.
- 경로별 조건문을 계속 추가하는 방식보다 중앙 내비게이션 메타데이터로 해결한다.
- 모든 workspace 첫 페이지와 query 특수 진입점을 table-driven regression test로 추가한다.

### 2. 페이지 헤더 액션과 로컬 탭의 중복 제거

주요 파일:

- `apps/admin_web/app/notifications/push-send/page.tsx`
- `apps/admin_web/app/referrals/referral-dashboard.tsx`
- 관련 spec 파일

수정:

- Push Send 헤더의 `/notifications/templates` `Templates` 버튼을 제거한다. 상단 `Notification Templates` 탭이 이동을 전담한다.
- Customer Referrals 헤더의 `/referrals/cashouts` `Open reward cashouts` 버튼을 제거한다. 상단 `Referral Cashouts` 탭이 이동을 전담한다.
- 권한 기반 고유 작업인 `Open policy settings`는 유지한다.
- Notification Templates에서 이미 제거된 중복 액션을 다시 만들지 마라.

회귀 방지:

- Customer와 Partner Referrals를 모두 검증한다.
- 가능하면 특정 문구 하나만 검사하지 말고 `page header action href`와 해당 `local workspace href`가 겹치지 않는 계약 테스트를 추가한다.

### 3. System Health 중복 내비게이션 제거와 명칭 통일

주요 파일:

- `apps/admin_web/lib/admin-navigation.ts`
- `apps/admin_web/components/admin-shell-nav.tsx`
- `apps/admin_web/components/admin-page-template.tsx`
- `/setup` 관련 page/spec

목표 구조:

- `Administration & Settings` 아래 사이드바에는 `System Health` 대표 항목 하나만 표시한다.
- 대표 항목 클릭 목적지는 `/setup`이다.
- `/setup`, `/app-sessions`, `/background-jobs` 어디에 있어도 사이드바의 `System Health` 대표 항목이 활성화된다.
- 세부 3개 페이지 전환은 상단 `System Health` 로컬 워크스페이스 탭만 담당한다.
- 세부 3개 링크를 사이드바와 상단 탭에 동시에 노출하지 않는다.
- 검색에서는 세부 페이지를 계속 찾을 수 있어야 한다.
- System Health를 새 최상위 카테고리로 만들거나 별도 허브를 만들지 마라.

명칭:

- `/setup`의 H1을 `Setup Readiness`로 통일한다.
- `Developer Setup`은 페이지 이름으로 사용하지 않는다. 개발자·기술 관련 의미가 필요하면 설명 문구 안에서만 사용한다.
- `System Health`, `Setup Readiness`, `App Session Diagnostics`, `Background Jobs`를 전역에서 동일하게 쓴다.

### 4. 전역 검색 전체 결과의 스크롤 구조 수정

주요 파일:

- `apps/admin_web/components/admin-workspace-header.tsx`
- `apps/admin_web/app/globals.css`
- 검색/내비게이션 관련 spec

현재 문제:

- `Show all results` 이후 검색 popover 전체가 스크롤되어 검색 입력과 첫 그룹명이 화면 위로 사라진다.
- 방향키로 결과를 이동한 뒤 전체 보기를 누르면 이전 scroll position 때문에 첫 그룹부터 보이지 않을 수 있다.

필수 동작:

- popover 외곽은 고정하고 검색 입력 영역은 항상 보이게 한다.
- 결과 목록만 독립적으로 세로 스크롤한다.
- `Show all results` 전환 시 결과 목록 scrollTop을 0으로 되돌린다.
- 검색 결과 그룹은 각 그룹의 최고 검색 rank 순으로 표시하고, 그룹 안에서는 기존 rank 순서를 보존한다.
- `Ctrl/Meta+K`, 자동 입력 포커스, Enter, ArrowUp/Down 순환, Escape 닫기와 검색 버튼 포커스 복귀, 외부 클릭 닫기 동작을 보존한다.
- 검색 결과가 적을 때 불필요한 빈 스크롤 영역을 만들지 않는다.

CSS 주의:

- 공용 `.topbar-dropdown`의 overflow를 무조건 바꿔 Operation Alerts를 깨뜨리지 마라.
- 검색 popover에 한정된 selector로 outer/list scrolling을 분리한다.

### 5. Operation Alerts 키보드 포커스 계약 완성

주요 파일:

- `apps/admin_web/components/admin-workspace-header.tsx`
- 관련 component spec

필수 동작:

- 알림 트리거 ref와 공용 `closeNotifications(returnFocus)` 동작을 만든다.
- Escape로 메뉴를 닫으면 알림 트리거 버튼으로 포커스가 돌아온다.
- 외부 클릭으로 닫을 때는 강제로 포커스를 옮기지 않는다.
- 메뉴 항목을 선택하면 정상 이동하며 메뉴가 닫힌다.
- 알림 항목이 있는 fixture에서 ArrowDown/ArrowUp, Home/End 또는 프로젝트가 채택한 동등한 menu keyboard pattern을 검증한다.
- 기존 `role="menu"`, `role="menuitem"`, `aria-expanded`, `aria-controls`를 유지한다.

### 6. 출금 위험 저장 뷰의 문맥 명확화

대상 URL:

`/payouts?range=all&withdrawalStatus=REVIEW_REQUIRED#partner-wallet-withdrawal-requests`

필수 수정:

- 저장 뷰 상단의 모호한 녹색 `Clear`가 상태를 뜻한다면 `Risk state · Clear`처럼 명확히 바꾼다. 단순 중복 정보라면 제거한다.
- `Clear saved view` 액션과 시각·문구 의미가 겹치지 않게 한다.
- 저장 뷰에 의해 필터링되지 않는 하단 Payout batch list 앞에 범위 안내를 추가한다. 예: `Other payout batches · not filtered by this saved view`.
- query/hash, selected status card, saved-view strip, anchor positioning은 현재 정상 동작을 그대로 보존한다.
- 0건/1건 이상 상태를 테스트한다.

### 7. 다크 테마와 포커스 시각 검증

- 1440px 이상에서 light/dark 두 테마를 확인한다.
- `--admin-muted`, `--admin-sidebar-muted`, 비활성 pill 텍스트가 각 실제 배경에서 일반 텍스트 4.5:1, 큰 텍스트 3:1 기준을 충족하는지 계산한다.
- 이미 통과하면 변경하지 마라.
- 실패할 때만 공용 토큰을 최소 조정하고 페이지별 임시 색상을 추가하지 마라.
- Administration summary의 기본 브라우저 검은 focus outline이 디자인 시스템과 지나치게 충돌하면 기존 `--admin-focus-ring`을 이용한 `:focus-visible` 스타일로 통일한다. 포커스 표시 자체를 제거해서는 안 된다.

### 8. 전체 관리자 릴리스 게이트 복구

현재 감사 기준 baseline:

- 표적 테스트 8 files / 118 tests: PASS
- typecheck: PASS
- lint: PASS
- production build: PASS
- 전체 Admin test: 7 files, 8 tests FAIL
- visible-copy guard: 2 violations
- `verify:scope admin`: FAIL

해야 할 일:

1. 먼저 현재 baseline을 다시 실행해 실제 실패 목록을 확보한다.
2. 이번 변경으로 발생한 실패와 기존 working-tree 실패를 구분한다.
3. Admin 프런트엔드 범위 안에서 안전하게 수정 가능한 실패는 원인을 해결한다.
4. 폼 컨트롤 CSS 계약, Vietnam Overview raw surface, Calendar focus 스타일, Partner detail empty-copy expectation을 각각 실제 UI 계약과 비교해 코드 또는 낡은 테스트를 올바른 쪽으로 수정한다.
5. visible-copy guard의 `usage-overview-trend-chart.tsx` 내부 `score` 오탐은 사용자 표시 문구를 검사한다는 본래 목적을 약화하지 않는 방식으로 해결한다. 의미가 명확하면 내부 변수명을 `seriesTotal` 같은 운영 문구와 무관한 이름으로 바꾸는 최소 수정도 허용한다.
6. 검사를 skip하거나 실패 파일을 제외 목록에 넣어 통과시키지 마라.

## 필수 브라우저 검수

로그인된 로컬 관리자 화면을 사용할 수 있으면 실제 브라우저로 검수한다. 사용할 수 없으면 인증을 우회하거나 mock 화면만 보고 통과했다고 주장하지 말고 정확한 제한을 보고한다.

검수 뷰포트는 1440px 이상으로 고정한다. 권장 1692×1272.

반드시 확인할 화면:

1. `/`
2. `/setup`
3. `/app-sessions`
4. `/background-jobs`
5. `/notifications/templates`
6. `/notifications/push-send`
7. `/referrals/customers`
8. `/referrals/partners`
9. `/bookings/post-match-cancellations`
10. `/payouts?range=all&withdrawalStatus=REVIEW_REQUIRED#partner-wallet-withdrawal-requests`

상호작용 검수:

- Ctrl/Meta+K로 검색 열기
- `partner` 입력
- ArrowDown/ArrowUp/Enter 동작
- `Show all results` 클릭 직후 검색 입력과 첫 그룹이 보이는지 확인
- Escape 후 검색 트리거 포커스 확인
- Operation Alerts Escape 후 알림 트리거 포커스 확인
- System Health 세부 페이지에서 사이드바 대표 항목과 상단 로컬 탭 활성 상태 확인
- light/dark 전환 후 핵심 텍스트와 상태색 확인

수정 후 증거 캡처를 다음 폴더에 저장한다.

`C:\dev\massage-on-demand-vn\output\admin-navigation-ia-post-prompt-fix-2026-08-08`

최소 캡처:

- Customer Referrals 정확한 브레드크럼
- System Health 단일 사이드바 항목 + 정확한 브레드크럼
- Push Send 중복 액션 제거
- 전역 검색 기본 결과
- 전역 검색 전체 결과 첫 그룹
- 출금 저장 뷰 문맥 안내
- light/dark 대표 화면

## 필수 자동 검증

저장소 루트 `C:\dev\massage-on-demand-vn`에서 실행한다.

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- --run lib/admin-navigation.spec.ts lib/admin-nav-match.spec.ts components/admin-shell-nav.spec.tsx app/payouts/payouts-page-model.spec.ts app/payouts/payout-wallet-withdrawal-request-section.spec.tsx app/notifications/templates/page.spec.tsx app/notifications/push-send/page.spec.tsx app/referrals/referral-dashboard.spec.tsx
npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run lint --workspace @massage-vn/admin-web
npm.cmd run admin:query-guards
npm.cmd run admin:visible-copy
npm.cmd run build --workspace @massage-vn/admin-web
npm.cmd run verify:scope -- admin
```

필요한 신규 component/spec가 생기면 표적 테스트 명령에 추가한다.

## 최종 완료 조건

다음 조건을 모두 만족해야 완료로 보고한다.

- 모든 지정 경로의 브레드크럼이 정확하다.
- System Health 세부 링크가 사이드바와 상단 탭에 중복되지 않는다.
- Push Send와 Customer Referrals의 헤더 이동 액션이 로컬 탭과 중복되지 않는다.
- 전역 검색 전체 보기에서도 검색 입력과 첫 그룹이 유지된다.
- 검색 및 Operation Alerts의 Escape 포커스 복귀가 테스트와 브라우저에서 확인된다.
- 출금 위험 저장 뷰의 상태/해제/하단 목록 범위가 서로 구분된다.
- 기존 Shift Command 활성 상태, 검색 랭킹, query/hash, 권한 로직, light/dark 테마가 퇴행하지 않는다.
- 표적 테스트, typecheck, lint, visible-copy, build가 모두 통과한다.
- `verify:scope admin`이 PASS한다. 정말로 이번 범위 밖의 외부 조건 때문에 통과할 수 없다면 실패 명령·정확한 실패·왜 범위 밖인지 증거를 남기고 성공으로 표현하지 않는다.

## 최종 보고 형식

작업 완료 후 다음 순서로 보고한다.

1. 운영자 관점에서 무엇이 개선됐는지
2. 변경한 파일 목록과 파일별 변경 이유
3. 브레드크럼·System Health·검색·알림·출금 저장 뷰의 전후 동작
4. 실행한 모든 검증 명령과 PASS/FAIL 결과
5. 브라우저에서 확인한 경로·상호작용·뷰포트
6. 저장한 캡처와 구현 결과 문서의 절대 경로
7. 남은 위험이나 범위 밖 실패

다음 결과 문서도 작성한다.

`C:\dev\massage-on-demand-vn\output\admin-navigation-ia-post-prompt-fix-2026-08-08\implementation-report.md`

작업 중 발견한 추가 개선은 현재 요구를 끝낸 뒤 별도 제안으로만 남겨라. 현재 범위를 넓혀 임의로 구현하지 마라.

---

## 이 프롬프트를 사용할 때

Codex 앱에서 저장소 `C:\dev\massage-on-demand-vn`을 연 뒤 위 프롬프트를 그대로 붙여 넣는다. 먼저 계획 검토를 받고 싶다면 프롬프트 맨 앞에 `/plan`을 추가하고, 계획 승인 후 구현을 요청한다.
