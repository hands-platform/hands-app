# Codex Implementation Prompt — HANDS Admin 내비게이션 사후 감사 개선

아래 프롬프트 전체를 새 Codex 작업에 그대로 붙여 넣어 사용한다.

---

## 역할

너는 HANDS 관리자 웹을 실제 운영자가 매일 사용하는 업무 도구로 다듬는 시니어 프론트엔드 엔지니어이자 운영 UX 설계자다. 이번 작업은 새 디자인이나 전면 재설계가 아니라, 이미 개선된 정보 구조를 유지하면서 사후 감사에서 확인된 기능·상태·접근성·문구·코드 품질 결함을 완성하는 **좁은 범위의 production polish**다.

가능하면 `$impeccable polish` 기준을 적용하되, 기존 디자인 시스템과 운영 흐름을 보존한다. 단순 보고서 작성으로 끝내지 말고 코드를 직접 수정하고, 테스트와 실제 브라우저 화면까지 검증해 완료하라.

## 작업 위치와 필수 선행 확인

작업 루트:

```text
C:\dev\massage-on-demand-vn
```

반드시 먼저 다음 파일을 순서대로 읽어라.

```text
C:\dev\massage-on-demand-vn\AGENTS.md
C:\dev\massage-on-demand-vn\output\admin-navigation-ia-post-implementation-audit-2026-08-08\admin-navigation-post-implementation-audit.md
C:\dev\massage-on-demand-vn\apps\admin_web\lib\admin-navigation.ts
C:\dev\massage-on-demand-vn\apps\admin_web\lib\admin-nav-match.ts
C:\dev\massage-on-demand-vn\apps\admin_web\components\admin-shell-nav.tsx
C:\dev\massage-on-demand-vn\apps\admin_web\components\admin-workspace-header.tsx
C:\dev\massage-on-demand-vn\apps\admin_web\components\admin-workspace-local-nav.tsx
C:\dev\massage-on-demand-vn\apps\admin_web\app\payouts\page.tsx
C:\dev\massage-on-demand-vn\apps\admin_web\app\payouts\payouts-page-model.ts
C:\dev\massage-on-demand-vn\apps\admin_web\app\payouts\payout-wallet-withdrawal-request-section.tsx
C:\dev\massage-on-demand-vn\apps\admin_web\app\globals.css
```

관련 테스트 파일과 아래 중복 액션이 있는 페이지도 수정 전에 확인한다.

```text
apps/admin_web/lib/admin-navigation.spec.ts
apps/admin_web/lib/admin-nav-match.spec.ts
apps/admin_web/components/admin-shell-nav.spec.tsx
apps/admin_web/app/payouts/payouts-page-model.spec.ts
apps/admin_web/app/payouts/payout-wallet-withdrawal-request-section.spec.tsx
apps/admin_web/app/notifications/templates/page.tsx
apps/admin_web/app/notifications/push-send/page.tsx
apps/admin_web/app/referrals/referral-dashboard.tsx
```

현재 worktree가 더러울 수 있다. 기존 변경은 사용자 소유다. 작업 시작 전 `git status --short`와 대상 파일의 diff를 확인하고, 관련 없는 변경을 되돌리거나 정리하지 마라.

## 사용자와 화면 범위

- 실제 사용자는 프로그래머가 아니라 매일 예약, 고객, 파트너, 정산, 메시지와 시스템 상태를 처리하는 관리자 운영자다.
- 화면은 **1440px 이상 데스크톱에서만 사용**한다.
- **1024px 이하, 모바일, 태블릿 반응형을 검사·보고·재설계하지 마라.** 기존 모바일 코드를 일부러 삭제할 필요도 없지만 이번 작업을 위해 손대지 마라.
- 라이트·다크 테마는 모두 보존한다.
- 사용자 노출 용어는 `Provider`가 아니라 `Partner`를 사용한다.
- 운영자에게 기술 구현명, enum, 내부 API 용어를 새로 노출하지 마라.

## 현재 구조에서 반드시 보존할 것

다음 구조는 감사에서 적절하다고 판정됐으므로 다시 뒤집지 마라.

1. 대분류는 정확히 8개를 유지한다.
   - Shift Command
   - Booking Operations
   - Customer Support
   - Partner Operations
   - Finance Operations
   - Finance Records & Close
   - Growth & Communications
   - Administration & Settings
2. Shift Command는 `/` 직접 링크로 유지한다.
3. 한 번에 하나의 대분류만 펼친다.
4. Booking Closeout, Customer Signals, Messaging, Referrals, Partner Money, Settlement Records, Tax & Close, System Health의 워크스페이스 개념을 유지한다.
5. 기존 페이지, 데이터, API 호출, 권한, query 기반 저장 뷰를 삭제하거나 물리적으로 합치지 마라.
6. 안정적인 `id`, `iconKey`, 기존 permission category와 route를 보존한다.
7. Finance Operations와 Finance Records & Close를 하나로 합치지 마라.
8. 새 UI 라이브러리나 아이콘 패키지를 추가하지 말고 기존 컴포넌트, CSS token, `lucide-react`를 사용한다.

## 구현 목표

아래 작업을 **P1 → P2 → P3 순서**로 구현하라. P1이 끝나기 전에 장식적 수정부터 하지 마라.

---

## P1 — 릴리스 차단 문제

### P1-1. Payout / Withdrawal Risk 저장 뷰의 도착 맥락 수정

현재 검색 결과는 다음 URL로 이동한다.

```text
/payouts?range=all&withdrawalStatus=REVIEW_REQUIRED
```

필터는 API 요청에는 적용되지만 첫 화면에는 전체 payout 요약만 보이고, 실제 대상인 `#partner-wallet-withdrawal-requests`는 큰 페이지 하단에 있다. 운영자가 필터 실패 또는 빈 큐로 오해할 수 있다.

구현 요구사항:

1. `Payout / Withdrawal Risk` 검색 href를 다음처럼 대상 section hash까지 포함하도록 수정한다.

```text
/payouts?range=all&withdrawalStatus=REVIEW_REQUIRED#partner-wallet-withdrawal-requests
```

2. query에 `withdrawalStatus`, `withdrawalReconciliation` 또는 withdrawal 전용 partner filter가 있을 때 페이지 상단에 기존 디자인 시스템을 사용한 saved-view context를 표시한다.

예시 문구:

```text
Saved view
Withdrawal requests · Review required
{n} request(s) in this view
Clear saved view
```

3. 내부 enum을 그대로 출력하지 말고 기존 admin copy/status label helper를 사용한다.
4. `Clear saved view`는 withdrawal 관련 query와 hash만 제거하고 `range`, workspace 등 관련 없는 현재 조건은 가능한 한 보존한다.
5. 대상 section의 `Review required` 카드/필터가 선택 상태임을 색상뿐 아니라 `Selected` 문구와 접근성 상태로 전달한다.
6. withdrawal 페이지네이션, review action, edit/review 링크와 작업 완료 후 복귀 URL이 필터 및 `#partner-wallet-withdrawal-requests`를 보존하도록 한다.
7. 다른 payout 저장 뷰 또는 일반 `/payouts` 진입에는 불필요한 배너를 표시하지 않는다.
8. 새 API나 데이터 계약을 만들지 말고 현재 `walletWithdrawalSummary`, filters, 기존 응답을 사용한다.

완료 기준:

- 검색 결과로 진입한 즉시 대상 withdrawal section이 viewport 안에 위치한다.
- 현재 saved view 이름, 활성 필터와 결과 건수를 3초 안에 파악할 수 있다.
- 일반 payout 화면과 다른 query 저장 뷰는 회귀하지 않는다.

### P1-2. 사이드바 아코디언의 effect 기반 동기 setState 제거

현재 `admin-shell-nav.tsx`의 `useEffect` 내부 `setOpenSectionId`가 ESLint `react-hooks/set-state-in-effect` error와 dependency warning을 만든다.

구현 요구사항:

1. effect를 lint 예외나 비동기 우회로 숨기지 말고 상태 모델 자체를 고쳐라.
2. 권장 모델:
   - `routeKey = pathname + '?' + search`
   - 렌더에서 계산되는 `activeAccordionSectionId`
   - `{ routeKey, sectionId }` 형태의 현재 route에만 유효한 사용자 수동 선택 상태
   - 저장된 routeKey가 현재와 다르면 active section을 사용
3. 다음 동작을 모두 보존한다.
   - 최초 진입 시 현재 페이지의 대분류 자동 열림
   - 다른 대분류를 클릭하면 기존 대분류 닫힘
   - 열린 대분류를 다시 클릭하면 닫힘
   - 사용자가 Shift Command에 있는 동안 다른 대분류를 탐색 목적으로 열 수 있음
   - 다른 route로 이동하면 새 route의 대분류가 즉시 정확히 열림
4. 렌더 플리커나 한 프레임 동안 이전 섹션이 보이는 현상이 없어야 한다.
5. lint disable comment를 추가하지 마라.

완료 기준:

- 관련 파일 ESLint 0 error, 0 warning
- route 변경·수동 열기·닫기 테스트 통과
- 한 번에 하나의 대분류만 open

---

## P2 — 운영 UX와 접근성

### P2-1. 관리자 검색의 키보드·닫기·포커스 계약 완성

현재 화면에 `Ctrl K`가 표시되지만 실제 단축키가 동작하지 않고 `Escape`로도 검색이 닫히지 않는다.

구현 요구사항:

1. Windows/Linux는 `Ctrl+K`, macOS는 `Meta+K`로 검색을 열고 닫는다.
2. 텍스트 입력 중이라도 해당 조합에서는 브라우저 기본 동작을 막고 관리자 검색을 연다.
3. 열릴 때 검색 입력에 포커스를 둔다.
4. `Escape`로 닫고 검색 trigger로 포커스를 복귀한다.
5. 검색 popover 밖을 클릭하면 닫는다.
6. 결과 링크 실행 후 검색이 닫혀야 한다.
7. ArrowDown/ArrowUp으로 결과 링크를 이동하고 Enter로 선택할 수 있게 한다. 기존 Tab 탐색도 깨뜨리지 마라.
8. 결과가 없을 때 키보드 선택 index가 남지 않게 한다.
9. `Show all results` 전환 후에도 focus와 keyboard navigation이 안정적이어야 한다.
10. 검색과 Operation alerts가 동시에 열리지 않게 유지한다.
11. popover는 non-modal 동작이면 불필요한 focus trap이나 `aria-modal=true`를 추가하지 말고, 실제 동작과 ARIA 의미를 일치시킨다.
12. 가능하면 기존 dropdown/focus hook을 재사용하되 한 곳만을 위한 과도한 추상화는 만들지 마라.

테스트해야 하는 항목:

- Ctrl+K/Meta+K open/close
- Escape close와 trigger focus restore
- outside click close
- Arrow navigation/Enter
- empty results
- search와 alerts 상호 배타성

### P2-2. Breadcrumb를 실제 현재 페이지까지 표시

현재 로컬 워크스페이스 하위 화면에서도 breadcrumb가 대표 workspace에서 끝난다.

목표 예시:

```text
HANDS > Growth & Communications > Messaging > Notification Templates
HANDS > Growth & Communications > Referrals > Partner Referrals
HANDS > Booking Operations > Booking Closeout > Post-match Cancellations
HANDS > Finance Records & Close > Partner Money > Partner Earnings
```

구현 요구사항:

1. section, sidebar representative, workspace local page를 중앙 navigation config에서 파생한다.
2. workspace representative는 링크로 제공한다.
3. 실제 현재 local page만 마지막 텍스트와 `aria-current="page"`를 갖는다.
4. query 저장 뷰는 실제 운영 의미가 있는 label을 사용할 수 있다. 예: Partner Approvals, Withdrawal Risk.
5. pathname 문자열을 여러 컴포넌트에 하드코딩하지 말고 location resolver/helper를 만든다.
6. Partner Directory의 대소문자를 사이드바와 동일하게 유지한다.
7. breadcrumb가 너무 길어져 1440px 화면의 topbar action을 밀어내지 않도록 기존 스타일 안에서 검증한다.

### P2-3. Shift Command의 현재 위치 표시 강화

1. Shift Command 활성 상태를 일반 hover와 명확히 구분한다.
2. 기존 보라색 active 언어를 사용하되 페이지 하위 링크만큼 과도하지 않아도 된다. 권장 방식은 강한 active background 또는 명확한 좌측 active bar다.
3. 대분류의 단순 open/hover 상태에는 현재 페이지와 동일한 표시를 쓰지 않는다.
4. `aria-current="page"`는 실제 현재 링크 하나에만 있어야 한다.
5. 라이트·다크 테마 모두 확인한다.

### P2-4. 로컬 탭과 중복되는 헤더 이동 버튼 제거

전체 workspace 페이지를 확인하고, 바로 위 로컬 탭과 동일한 단순 이동 버튼을 제거한다.

최소 대상:

- Notification Templates의 `Delivery board`, `Push send`
- Push Send의 `Delivery board`
- Partner Referrals의 `Open reward cashouts`

규칙:

- 로컬 탭과 같은 URL로 이동하는 버튼은 제거한다.
- `Open policy settings`처럼 현재 화면의 고유하거나 보호된 컨텍스트 액션은 유지한다.
- 없는 생성/수정 기능을 새 CTA로 발명하지 마라.
- 헤더 action 영역이 비면 빈 wrapper도 제거한다.

### P2-5. Administration 안의 System Health 밀도 완화

새로운 9번째 대분류나 새 `/system-health` 허브 페이지는 만들지 마라.

1. 기존 Administration & Settings 내부의 `System Health` 소그룹을 별도의 접이식 소그룹으로 표시한다.
2. Administration을 처음 펼쳤을 때 System Health는 기본 접힘이다.
3. Setup Readiness, App Session Diagnostics, Background Jobs 중 하나가 현재 페이지면 자동으로 펼쳐진다.
4. Master Admin 또는 해당 권한 사용자에게만 기존 permission 규칙대로 표시한다.
5. 상위 대분류의 “한 번에 하나 open” 규칙과 충돌하지 않게 한다.
6. nested disclosure는 current page, open, hover 상태를 서로 구분한다.

### P2-6. 모든 로컬 워크스페이스 계약 테스트 확대

다음 그룹을 table-driven test로 검증한다.

```text
Booking Closeout
Customer Signals
Messaging
Referrals
Partner Money
Settlement Records
Tax & Close
System Health
```

각 그룹에서 검증할 것:

- representative URL
- 모든 local child URL
- query와 hash가 포함된 URL의 active 판정
- breadcrumb section/workspace/current page
- 사용 가능한 링크가 하나뿐이면 local nav를 숨기는 현재 정책
- 권한 축소 시 금지 링크와 검색 결과가 노출되지 않음
- 서로 다른 페이지가 같은 `aria-current`를 갖지 않음

---

## P3 — 문구·아이콘·긴 검색 결과 마감

### P3-1. 운영자 중심 명칭 통일

다음 명칭을 navigation, breadcrumb, search, local nav, 관련 테스트에서 일관되게 바꾼다.

```text
Finance Closeout → Settlement Repair Queue
Tax & Close → Tax & Period Close
Partner directory → Partner Directory
```

페이지 H1이나 도메인 고유 명칭까지 무조건 전역 치환하지 말고, 현재 navigation 의미를 나타내는 위치만 정확히 수정한다.

### P3-2. Wallet Adjustments 아이콘 구분

1. Partner Money와 Wallet Adjustments가 같은 wallet 계열 아이콘으로 보이지 않게 한다.
2. 기존 `lucide-react`에서 조정/교환/증감 의미가 명확한 아이콘 하나를 선택한다.
3. 안정적인 link `id`는 변경하지 말고 필요한 경우 새 안정적 `iconKey`를 추가한다.
4. icon map, icon type, config, 테스트를 함께 갱신한다.

### P3-3. Show all search results 그룹화

1. 기본 검색 결과 7개와 현재 ranking 로직은 보존한다.
2. `Show all results` 상태에서 결과가 많을 때 `sectionLabel` 기준의 읽을 수 있는 heading으로 그룹화한다.
3. 그룹화가 ranking 자체를 바꾸지 않게 한다. 같은 section 안에서는 기존 순서를 유지한다.
4. heading을 검색 결과로 focus시키지 말고 링크 탐색 순서만 자연스럽게 유지한다.
5. 빈 결과와 권한 필터 결과를 보존한다.

---

## 코드 품질 원칙

- 문제의 원인을 가장 좁은 올바른 계층에서 수정한다.
- 현재 navigation config를 단일 진실 공급원으로 유지한다.
- pathname/query/label 배열을 새 컴포넌트마다 중복 하드코딩하지 않는다.
- 한 번만 쓰는 기능을 위해 과도한 hook, context, provider, abstraction을 만들지 않는다.
- 새 의존성을 설치하지 않는다.
- CSS 색상·간격은 기존 token을 사용한다.
- focus-visible을 제거하지 않는다.
- 색상만으로 active/selected/risk 상태를 전달하지 않는다.
- 현재 영어 운영 UI의 문체와 Title Case 규칙을 유지한다.
- backend API, DB, auth, wallet accounting, payment, settlement 데이터 의미를 변경하지 않는다.
- protected area 변경이 필요해 보이면 임의로 확장하지 말고 중단 후 이유를 보고한다.

## 수정 예상 파일

아래는 예상 범위이며 실제 참조 관계를 확인한 뒤 가장 좁게 수정한다.

```text
apps/admin_web/lib/admin-navigation.ts
apps/admin_web/lib/admin-nav-match.ts
apps/admin_web/components/admin-shell-nav.tsx
apps/admin_web/components/admin-workspace-header.tsx
apps/admin_web/components/admin-workspace-local-nav.tsx
apps/admin_web/app/globals.css
apps/admin_web/app/payouts/page.tsx
apps/admin_web/app/payouts/payouts-page-model.ts
apps/admin_web/app/payouts/payout-wallet-withdrawal-request-section.tsx
apps/admin_web/app/notifications/templates/page.tsx
apps/admin_web/app/notifications/push-send/page.tsx
apps/admin_web/app/referrals/referral-dashboard.tsx
관련 spec 파일
```

## 구현 절차

1. 작업 전 `git status --short`와 대상 파일 diff를 기록한다.
2. 기존 테스트를 먼저 실행해 baseline을 확인한다. 현재 알려진 baseline은 관련 43 tests와 typecheck 통과, admin lint 실패 1 error/1 warning이다.
3. P1을 구현하고 관련 테스트를 추가·통과시킨다.
4. P2를 구현하고 keyboard/breadcrumb/permission/workspace 테스트를 추가한다.
5. P3를 구현하고 label/icon/search 회귀 테스트를 갱신한다.
6. formatter가 있다면 대상 파일에만 적용한다. 관련 없는 파일을 bulk-format하지 않는다.
7. 아래 검증 명령을 모두 실행한다.
8. 로그인된 인앱 브라우저가 있으면 그 세션을 사용해 1440px 이상에서 실제 화면과 키보드 상호작용을 검증한다.
9. 한 번의 종합 화면 검사에서 발견한 결함을 묶어서 수정하고, 한 번만 재확인한다. 끝없는 미세 수정 루프는 피한다.
10. 마지막으로 대상 diff를 다시 확인해 불필요한 변경, dead import, 임시 로그, 테스트 전용 코드를 제거한다.

## 필수 자동 검증

Windows PowerShell 기준으로 실행한다.

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- --run `
  lib/admin-navigation.spec.ts `
  lib/admin-nav-match.spec.ts `
  components/admin-shell-nav.spec.tsx `
  app/payouts/payouts-page-model.spec.ts `
  app/payouts/payout-wallet-withdrawal-request-section.spec.tsx

npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run lint --workspace @massage-vn/admin-web
npm.cmd run verify:scope -- -Scope admin

node C:\Users\laboy\.codex\skills\impeccable\scripts\detect.mjs --json <변경한 admin UI 파일 또는 가장 좁은 공통 디렉터리>
```

detector는 UI 수정이 모두 끝난 뒤 한 번만 실행한다. detector 결과가 없더라도 실제 화면 검수를 생략하지 마라.

## 필수 브라우저 검증 — 1440px 이상만

최소 1440px, 권장 약 1692×1272에서 다음을 실제로 확인한다.

1. `/`
   - Shift Command active와 다른 section hover/open이 혼동되지 않음
   - 한 번에 하나의 대분류만 open
2. `/notifications/templates`
   - breadcrumb가 Notification Templates까지 표시
   - 로컬 탭과 중복 헤더 버튼 제거
3. `/notifications/push-send`
   - breadcrumb와 중복 버튼 확인
4. `/referrals/partners`
   - breadcrumb가 Partner Referrals까지 표시
   - Referral Cashouts 중복 버튼 제거, policy action 유지
5. `/bookings/post-match-cancellations`
   - `Booking Operations > Booking Closeout > Post-match Cancellations`
6. `/payouts?range=all&withdrawalStatus=REVIEW_REQUIRED#partner-wallet-withdrawal-requests`
   - hash 도착, saved-view context, 결과 수, selected 상태 확인
7. 검색
   - Ctrl+K 또는 Meta+K
   - `partner` 검색 상위 3개 순서 유지
   - ArrowDown/ArrowUp/Enter
   - Escape와 focus 복귀
   - outside click
   - Show all의 section grouping
8. Administration & Settings
   - System Health 기본 접힘
   - System Health child route에서 자동 펼침
9. 라이트·다크 테마
   - active, hover, focus-visible, saved-view notice가 구분됨

브라우저 콘솔 error도 확인한다. 1024px 이하 화면은 열거나 보고서에 넣지 마라.

## 최종 완료 조건

다음이 모두 참일 때만 완료로 보고한다.

- [ ] 8개 대분류와 기존 URL/권한/데이터가 보존됨
- [ ] Withdrawal Risk 딥링크가 실제 큐와 선택 상태로 바로 도착함
- [ ] 일반 payout 화면이 saved-view UI로 오염되지 않음
- [ ] sidebar lint error/warning 제거
- [ ] Ctrl/Meta+K, Escape, outside click, focus restore, arrow navigation 동작
- [ ] breadcrumb가 실제 local page까지 표시
- [ ] Shift Command active와 hover/open 상태 구분
- [ ] local nav와 중복된 header 이동 버튼 제거
- [ ] System Health 소그룹 기본 접힘 및 active child 자동 펼침
- [ ] 명칭, 대소문자, Wallet Adjustments 아이콘 정리
- [ ] 기본 검색 ranking 7개 정책 유지 및 Show all 그룹화
- [ ] 관련 테스트, typecheck, lint, admin scope verification 통과
- [ ] 1440px 이상 실제 브라우저에서 라이트·다크 검수 완료
- [ ] 새 console error 없음
- [ ] 관련 없는 사용자 변경이나 protected area를 건드리지 않음

## 최종 보고 형식

최종 답변은 다음 순서로 간결하지만 구체적으로 작성한다.

1. 구현 결과 요약
2. P1/P2/P3별 실제 변경 내용
3. 변경 파일 목록
4. 실행한 검증 명령과 pass/fail 결과
5. 실제 브라우저에서 확인한 route와 상태
6. protected area 변경 여부
7. 남은 위험 또는 의도적으로 보류한 항목
8. 다음 권장 작업 1개

검증 실패를 숨기지 말고 정확한 오류를 기록한다. 작업 범위 안에서 해결 가능한 실패라면 보고만 하지 말고 해결한 뒤 다시 검증한다.

---

## 짧은 실행 지시

위 요구사항을 승인된 구현 계약으로 간주하고 바로 작업을 시작하라. 모호한 부분은 기존 코드, 감사 보고서, 현재 운영 화면에서 가장 보수적인 결정을 찾아 진행한다. 비즈니스 의미나 protected area를 변경해야만 해결 가능한 경우에만 멈춰 사용자에게 질문한다.
