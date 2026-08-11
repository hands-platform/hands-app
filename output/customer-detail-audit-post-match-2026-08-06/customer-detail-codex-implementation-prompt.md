# Codex 구현 프롬프트 — Customer Detail 운영자 UX 개선

아래 프롬프트 전체를 새로운 Codex 작업에 그대로 붙여 넣는다.

---

## 역할과 목표

너는 `C:\dev\massage-on-demand-vn`의 HANDS 관리자 웹을 개선하는 시니어 제품 엔지니어다.

사용 가능한 경우 `impeccable` 스킬을 **Operate 모드의 기존 화면 정밀 개선**으로 적용하고, 실제 화면 검증에는 in-app `browser` 스킬을 사용하라. 신규 시각 세계나 새 디자인 시스템을 만들지 말고 현재 관리자 UI를 운영 친화적으로 정돈하라.

대상 페이지:

- URL: `http://localhost:3101/customers/audit_post_match_customer_profile`
- 주요 화면: `apps/admin_web/app/customers/[id]/page.tsx`

목표는 화면을 단순히 예쁘게 바꾸는 것이 아니다. 고객 문의를 처리하는 실제 운영자가 다음 질문에 빠르고 안전하게 답할 수 있도록 고객 상세 페이지의 데이터 계약, 정보 구조, 문구, 작업 안전성, 반응형, 접근성을 함께 수정하라.

1. 지금 처리해야 할 일이 있는가?
2. 현재 예약과 최근 취소 패턴은 무엇인가?
3. 결제·환불·지갑 상태를 믿어도 되는가?
4. 고객에게 연락할 수 있는가?
5. 운영 메모가 올바른 고객·예약에 기록되는가?
6. 분쟁 시 예약·채팅·금전 증거를 빠르게 찾을 수 있는가?

계획이나 추가 보고서만 작성하고 멈추지 말고, 코드를 수정하고 테스트와 실제 브라우저 검증까지 완료하라.

## 먼저 읽을 자료

작업을 시작하기 전에 반드시 아래 자료를 읽고 현재 코드와 대조하라.

1. 저장소 지침
   - `C:\dev\massage-on-demand-vn\AGENTS.md`
2. 심층 감사 보고서
   - `C:\dev\massage-on-demand-vn\output\customer-detail-audit-post-match-2026-08-06\customer-detail-operator-audit.md`
3. 화면 증거 19장
   - `C:\dev\massage-on-demand-vn\output\customer-detail-audit-post-match-2026-08-06`
4. 주요 구현
   - `apps/admin_web/app/customers/[id]/page.tsx`
   - `apps/admin_web/app/customers/[id]/actions.ts`
   - `apps/admin_web/app/customers/[id]/customer-detail-overview-shell.tsx`
   - `apps/admin_web/app/customers/[id]/customer-booking-operation-board.tsx`
   - `apps/admin_web/app/customers/[id]/customer-wallet-adjustment-panel.tsx`
   - `apps/admin_web/app/customers/[id]/customer-wallet-adjustment-form.tsx`
   - `apps/admin_web/components/admin-form-controls.tsx`
   - `apps/admin_web/app/globals.css`
   - `apps/admin_web/lib/admin-api.ts`
   - `apps/api/src/admin/admin-customer-selects.ts`
   - `apps/api/src/admin/admin.service.ts`

보고서의 줄 번호는 코드 변경으로 달라질 수 있다. 줄 번호를 맹신하지 말고 관련 함수와 호출자를 `rg`로 다시 찾아 실제 흐름을 추적하라.

## 작업 원칙

- 현재 화면은 신규 디자인이 아니라 기존 관리자 디자인 시스템 안에서 하는 정밀 개선이다.
- 기존 `AdminSection`, `AdminTablePanel`, `AdminSectionHeader`, `AdminDataTable`, `AdminEmptyState`, `StatusBadge`, 폼 컨트롤과 CSS 토큰을 우선 재사용하라.
- 새로운 UI 프레임워크, 테이블 라이브러리, 상태관리 라이브러리, 아이콘 패키지를 추가하지 마라.
- 공용 컴포넌트 하나를 바꾸면 다른 관리자 화면에 미치는 영향을 먼저 조사하라. 고객 상세에만 필요한 변경이면 범위를 해당 화면으로 제한하라.
- 사용자 작업이 섞인 dirty worktree를 보존하라. 관련 없는 변경을 되돌리거나 포맷하지 마라.
- `git reset --hard`, 광범위한 checkout, 삭제 명령을 사용하지 마라.
- 데이터베이스 schema, migration, 인증, 결제·지갑 핵심 로직 등 `AGENTS.md`의 protected area는 필요 없이 건드리지 마라.
- UI에서 `Provider`는 내부 코드 명칭으로만 허용하고 사용자 문구는 `Partner`를 사용하라.
- 테스트용 브라우저 확인 중 실제 푸시 발송, 메모 저장, 지갑 반영을 하지 마라. 지갑은 Review 단계까지만 확인하고 `Apply now`는 누르지 마라.
- 자동화된 테스트에서만 격리된 fixture를 사용해 저장 동작을 확인하라.
- 기존 기능을 삭제하지 말고, 운영자가 덜 중요한 기록을 필요할 때 열어 볼 수 있도록 계층을 조정하라.
- 추측으로 숫자·고객 상태·위험 라벨을 만들지 마라. 화면에 표시하는 신호는 서버 데이터로 설명 가능해야 한다.

## 목표 정보 구조

페이지를 다음 순서로 정리하라.

### 1. Customer command header

첫 화면에서 다음 항목이 보여야 한다.

- 고객명, 전화번호, 구분 가능한 고객 ID
- 현재 예약 유무와 활성 예약 링크
- `Open actions` 건수
- `History signals` 건수
- 기본 작업 `Add note`
- 보조 작업 `Contact customer`
- 고위험 작업 `Financial adjustment`

현재의 큰 `No action needed` 카드는 제거하거나 compact command strip으로 축소하라. 조치가 없다는 사실과 이력 패턴이 없다는 사실을 동일하게 취급하지 마라.

예시:

- `No open action`
- `No failed payment, open refund, reported review, or delivery failure requires action now.`
- `History signal · 6 of the latest 6 bookings were cancelled by a Partner.`
- `Checked at {time} · payments, refunds, reviews, notifications`

반복 취소는 자동 제재나 고객 위험 판정이 아니라 검토 가능한 `History signal`로만 표시하라.

### 2. Current customer state

- 신원·연락처·가입일·주소·앱 연락 가능 상태를 한 영역에 유지한다.
- `Unknown`, `Not recorded`, `Not loaded`, `Unavailable`을 구분한다.
- 실제 장애가 아닌 `App offline`은 빨간 위험 presence로 표현하지 않는다.
- 빠른 작업의 위계를 다음처럼 분리한다.
  1. Add note
  2. Contact customer
  3. Financial adjustment

### 3. Recent bookings

- 현재 API가 최신 6건만 제공하는 동안 제목은 `Recent bookings`, 범위는 `Latest 6 bookings`로 표시한다.
- 활성 예약은 최신 6건 배열에 우연히 포함되는 것에 의존하지 말고 서버 계약으로 보장한다.
- 전체 예약 경로가 이미 있으면 재사용하고, 없으면 가장 작은 서버 페이지네이션 경로를 구현한다.
- 운영 표는 수평 스크롤을 피할 수 있도록 다음 4개 의미 그룹을 기준으로 재구성한다.
  - `When & booking`
  - `Service & Partner`
  - `Money`
  - `Outcome`
- 주소와 기술 세부값은 행 상세, disclosure 또는 명확한 2차 정보로 이동한다.
- 예약 ID는 앞부분 `audit_po`만 보여 주지 말고 고유 suffix, 요청 시각, 결제 유형 등을 결합해 서로 구분되게 한다.

### 4. Money

- `Current balance`, `Open now`, `All time`, `Latest 6 bookings`의 범위를 섞지 않는다.
- 지갑 조회 실패를 0 VND로 표시하지 않는다.
- 지갑 원장은 `Before`, `Change`, `After` 관계를 명확히 보여 준다.
- 과거 음수 잔액은 현재 위험처럼 표시하지 말고, 현재 잔액이 음수일 때만 위험 신호를 준다.
- 기술 source key와 reference는 2차 상세로 내리고 운영 사유·관련 예약·시각을 우선한다.

### 5. Retained records

아래 기록은 보존하되 기본 화면 길이를 줄인다.

- Operator notes
- Notifications
- Chat evidence
- Referral
- Developer/System audit

0건 Referral/Notes/Notifications는 큰 빈 카드와 빈 표로 반복하지 말고 compact empty state로 표시한다.

채팅은 방 목록 또는 아코디언으로 제공하고 한 번에 한 transcript만 펼친다. 방 목록에는 예약 suffix, 서비스, 결제 유형, 종료 상태·시각, 마지막 메시지 또는 메시지 수를 제공한다.

## 필수 수정 사항

### P0-1. API 실패와 실제 데이터 없음 분리

현재 고객 상세은 `adminGet(..., null)` 이후 `notFound()`를 사용하고, 지갑 원장은 실패 fallback으로 balance 0과 빈 rows를 사용한다. 이를 수정하라.

요구사항:

- 저장소에 이미 존재하는 result/error-state 패턴을 먼저 찾아 재사용한다.
- HTTP 404만 실제 `notFound()`로 처리한다.
- 401/403은 권한 상태, 5xx/network는 unavailable 상태로 처리한다.
- 지갑 조회 실패 시 0원·0건을 렌더링하지 않는다.
- 고객 기본 정보는 성공했지만 지갑만 실패한 경우 페이지 전체를 막지 말고 Money 영역에 부분 실패 상태와 retry 경로를 표시한다.
- Needs action 계산에 필요한 데이터가 일부 실패하면 `Check incomplete`라고 표시한다.
- fallback 숫자로 운영자를 안심시키지 마라.

테스트:

- 고객 API 404 → 실제 not-found.
- 고객 API 500 → not-found가 아닌 unavailable.
- 지갑 API 500 → `0 VND`가 아닌 wallet unavailable.
- 고객 성공 + 지갑 실패 → 고객 기본 정보는 유지되고 Money 영역만 오류.

### P0-2. 운영자 메모 대상과 검증 수정

요구사항:

- 일반 고객 상세에서 `Related booking` 기본값을 빈 값으로 바꾼다.
- 예약 상세처럼 bookingId 맥락이 명시적으로 전달된 경우에만 해당 예약을 미리 선택한다.
- `Quick note preset`, `Related booking`, `Activity note` 라벨을 화면에 보이게 한다.
- 예약 option은 동일 접두사에서도 구분 가능해야 한다.
  - 예: `…profile · 5 Aug 18:48 · Cash · Partner cancelled`
- textarea에 적절한 `required`와 최소 길이를 제공한다.
- 빈 제출은 아무 반응 없이 return하지 말고 인라인 오류 또는 명시적 실패 상태를 제공한다.
- 서버의 “이 예약이 이 고객 소유인가” 검증은 유지한다.
- 저장 성공·실패 후 포커스와 메시지를 운영자가 인지할 수 있게 한다.

테스트:

- 기본 선택은 `No booking link`.
- 동일 접두사 6개 예약 옵션이 모두 구분됨.
- 빈 메모는 API 호출 없이 오류 표시.
- 다른 고객 예약 ID는 서버에서 거부.
- 정상 저장은 기존 audit log 계약 유지.

### P0-3. 언어와 앱 상태 데이터 계약 수정

일반 모드에서는 `appSessions`가 제외되는데 화면은 그 데이터로 언어를 계산하므로 `Unknown`이 정상 값처럼 표시된다.

요구사항:

- 진단 권한 없이 노출 가능한 안전한 세션 요약만 API로 제공한다. 필요한 후보는 `deviceLanguage`, `lastSeenAt` 정도다.
- IP, deviceId, raw session 진단 정보는 일반 응답에 넣지 않는다.
- 안전한 요약을 추가하지 않는 편이 더 적절하면 일반 모드에서 언어 행을 숨겨라. 가짜 `Unknown`을 보여 주지 마라.
- `Language: Not recorded`, `App reachability: No active device`처럼 이유가 드러나는 문구를 사용한다.
- 진단 모드의 명시적 opt-in은 유지한다.

테스트:

- 언어가 기록된 고객은 일반 모드에서 정확한 언어 표시.
- 언어가 실제 미기록이면 `Not recorded`.
- 일반 응답에 IP/deviceId가 없음.
- developer diagnostics는 기존 권한·query gate 유지.

### P0-4. 최신 6건과 전체 이력의 계약 수정

요구사항:

- 최신 일부 데이터는 항상 `Latest 6` 또는 실제 N으로 표시한다.
- `Booking history`를 `Recent bookings`로 교체한다.
- `Admin archive for every matched booking`을 현재 범위와 일치하는 문구로 바꾼다.
  - 단기: `Chat evidence from the latest 6 bookings.`
- 활성 예약은 별도 query/summary/select 등 가장 작은 root fix로 보장한다.
- 기존 전체 예약 목록이 고객 필터를 지원한다면 그 경로를 `View all bookings`로 재사용한다.
- 기존 경로가 없으면 customer booking/chat 전용 서버 페이지네이션을 구현하되, 전체 상세 payload를 무제한으로 키우지 마라.
- 7건 이상 fixture로 범위와 전체 접근 경로를 테스트한다.

### P1-1. 예약 표와 운영 문구

요구사항:

- 1024px 및 1440px에서 핵심 예약 정보를 수평 스크롤 없이 읽게 한다.
- `RELEASED`, `CUSTOMER_WALLET` 같은 기술 상태를 운영 언어로 번역한다. 필요하면 원본 코드는 tooltip/detail에 남긴다.
- `No service / 0 VND`로 정상 0원 서비스처럼 단정하지 말고 `Service snapshot unavailable`로 표시한다.
- Request Time보다 State 시간이 이른 데이터가 정상 계약인지 코드·fixture를 추적한다.
  - 데이터가 잘못됐으면 root cause/fixture를 고친다.
  - 의미가 다른 시간이면 `Requested`, `Cancelled at`처럼 동사를 명시한다.
- `Active booking is shown first when available.`처럼 현재 예약이 없는 상태에서도 자연스러운 문구를 사용한다.

### P1-2. 푸시 연락 가능 상태

요구사항:

- 활성 고객 기기가 0대면 빠른 작업에서부터 `Push unavailable · no active device`로 비활성화한다.
- 비활성 버튼을 열어 dead form을 보여 주지 않는다.
- 전화번호 복사 또는 연락 메모처럼 기존 기능으로 가능한 대체 행동 하나를 제공한다.
- `0 activedevices`를 `0 active devices`로 고친다.
- 권한이 없는 경우와 기기가 없는 경우를 구분한다.

### P1-3. 지갑 조정 안전성

기존 MASTER_ADMIN 권한과 Review → Apply 2단계는 유지한다.

요구사항:

- 최종 검토에 `Before → Change → After`를 크게 표시한다.
- 최종 버튼에 금액과 방향을 포함한다.
  - 예: `Apply 100,000 VND credit now`
- 실행자, 사유, 근거, 즉시 원장·감사 기록 생성 사실을 버튼 주변에 표시한다.
- 고액 근거 URL 기준을 입력 단계에서 미리 안내한다.
- 위험 작업은 Add note와 같은 기본 위계에 놓지 않는다.
- 별도 다중 승인 시스템은 현재 정책·기존 코드에 실제 요구가 없으면 새로 만들지 않는다.

### P1-4. 채팅·감사 기록 밀도

요구사항:

- 채팅방은 기본 compact 목록 또는 native `details` 기반 아코디언으로 제공한다.
- 한 번에 한 transcript만 펼치는 동작을 구현한다.
- 취소된 보존 채팅의 녹색 presence를 제거한다.
- `Open booking`, `Open full chat archive`의 accessible name에 대상 예약을 포함한다.
- 방 제목은 상위 Chat history보다 낮은 heading level을 사용한다.
- 기술 room ID는 보조 정보나 상세로 이동한다.
- 메모 0건은 빈 표 대신 compact empty state와 Add note 동작만 제공한다.

### P1-5. 목록 복귀 맥락

- 고객 목록에서 상세로 들어온 경우 검색어·필터·페이지로 돌아갈 수 있게 한다.
- 저장소에 이미 있는 `returnTo`, search param 보존, back-link 패턴을 찾아 재사용한다.
- 임의 외부 URL로 이동할 수 있는 open redirect를 만들지 않는다.

### P2. 문구와 밀도 정돈

- `Sign-up Date` → `Sign-up date`
- `Recent cancellations` → `Cancellations in latest 6`
- `Adjust wallet` → `Financial adjustment`
- `Balance` → `Before → After` 또는 명시적 세 열
- `Add operator note` → `Add customer activity note`
- `Open system audit` → `Load developer/system evidence`
- `Export CSV` → `Export retained customer activity CSV`
- 중복되는 `Unknown`, 0건 배지, 빈 표를 제거한다.
- Referral이 0건이면 한 줄 상태로 축소한다.
- 큰 파란 KPI 패널은 정보 우선순위에 맞게 밀도를 줄이되 기존 디자인 토큰을 유지한다.

## 접근성 요구사항

- 모든 입력에 시각적으로 보이는 라벨을 제공한다.
- 상태는 색만으로 전달하지 않는다.
- 반복 링크는 대상이 포함된 고유한 accessible name을 가진다.
- heading 순서를 `h1 → h2 → h3` 의미 구조에 맞춘다.
- 키보드만으로 빠른 작업, 필터, disclosure, 페이지네이션을 사용할 수 있어야 한다.
- 저장 성공·실패와 부분 조회 실패는 적절한 live region 또는 포커스 이동으로 인지 가능해야 한다.
- 200% zoom에서도 핵심 작업이 잘리거나 겹치지 않아야 한다.
- 긴 고객 ID·예약 ID·주소는 손실 없이 줄바꿈 또는 복사가 가능해야 한다.
- 위험 버튼은 색뿐 아니라 버튼 문구로 금액·방향·즉시성을 전달한다.

## 반응형 완료 조건

다음 viewport를 실제 브라우저로 확인하라.

- 1024×768
- 1280×800
- 1440×900
- 가능하면 200% zoom에 해당하는 좁은 CSS viewport

완료 기준:

- 1024×768 첫 화면에 고객명, 현재 예약 유무, Open actions, History signals, Add note가 보인다.
- 1024와 1440에서 핵심 예약 4개 의미 그룹에 수평 스크롤이 필요 없다.
- 사이드바 때문에 본문이 비정상적으로 좁아지면 기존 admin shell의 반응형 패턴 안에서 축소/토글을 조정한다.
- 채팅·추천·감사 기록이 기본 펼침 상태로 전체 페이지를 과도하게 늘리지 않는다.
- 클릭 영역, 필터, 페이지네이션이 겹치거나 잘리지 않는다.

## 구현 순서

다음 순서로 진행하고 각 단계가 끝날 때 관련 테스트를 실행하라.

1. 현재 코드와 테스트, 호출자, 공용 패턴 조사.
2. API 오류 상태·safe language summary·active booking·latest N 계약 수정.
3. 메모 대상·검증 수정.
4. 상단 command header와 빠른 작업 위계 수정.
5. 예약 4열 구조와 운영 문구 수정.
6. Money/ledger/wallet review 수정.
7. 푸시, 빈 상태, 채팅 아코디언, 접근성 수정.
8. 관련 단위·계약 테스트 실행.
9. 브라우저에서 대상 fixture 전체 화면 검증.
10. 발견한 시각 결함을 한 번에 수정하고 최종 확인 1회를 수행한다. 무한한 미세조정 반복은 하지 마라.

## 테스트 요구사항

기존 테스트 스타일과 fixture를 재사용하고 최소한 아래 계약을 남겨라.

### Admin web

- 고객 API 404/500 구분.
- 지갑 부분 실패 상태.
- Needs action과 History signal 분리.
- Latest N 문구.
- 메모 기본 예약 없음·visible labels·빈 제출 오류.
- 동일 접두사 예약의 고유 옵션/행 라벨.
- 활성 기기 없음/권한 없음의 푸시 상태.
- 지갑 before/change/after와 최종 버튼 문구.
- 채팅 아코디언과 고유 accessible link name.
- 핵심 구조에 대한 접근성 가능한 markup.

### API

- safe session summary에 허용 필드만 포함.
- 일반 고객 detail 응답에 IP/deviceId/raw diagnostics 미포함.
- 활성 예약 계약.
- latest booking limit와 전체 경로/페이지네이션 계약.
- 기존 고객 소유 booking 검증 유지.

### 실행 명령

변경 범위에 맞는 focused test부터 실행하고 마지막에 아래를 실행하라.

```powershell
npm.cmd run test --workspace @massage-vn/admin-web
npm.cmd run test --workspace @massage-vn/api
npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run typecheck --workspace @massage-vn/api
npm.cmd run lint --workspace @massage-vn/admin-web
npm.cmd run lint --workspace @massage-vn/api
npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api
```

모든 저장소 테스트를 무조건 돌리기보다 먼저 관련 spec을 지정해 빠르게 실패 원인을 좁혀라.

UI 편집이 모두 끝난 뒤 Impeccable detector가 현재 환경에 있으면 변경한 UI 파일을 대상으로 정확히 한 번 실행하라.

```powershell
node "C:\Users\laboy\.codex\skills\impeccable\scripts\detect.mjs" --json "apps/admin_web/app/customers/[id]/page.tsx" "apps/admin_web/app/customers/[id]/customer-booking-operation-board.tsx" "apps/admin_web/app/globals.css"
```

detector 지적은 맹목적으로 따르지 말고 이 페이지와 관련된 실제 결함만 수정하라.

## 브라우저 검증 시나리오

로그인된 in-app browser가 있으면 이를 사용하라. 기존 세션을 보존하고 다음을 확인하라.

1. 기본 진입: 상단 command header와 현재 상태.
2. 예약 필터: All/Live/Completed/Cancelled와 페이지 이동.
3. 7건 이상 fixture가 있으면 Latest N/전체 접근 경로.
4. 활성 기기 0대: Push unavailable, dead form 미노출.
5. Add note 폼: visible labels, No booking link 기본값, 고유 예약 옵션, 빈 입력 오류.
6. Wallet adjustment: Review까지만 진행하고 before/change/after 확인. Apply 금지.
7. Wallet ledger: before/change/after와 관련 근거.
8. Chat evidence: 목록/아코디언, 한 transcript, 고유 링크 이름.
9. 1024×768, 1280×800, 1440×900 스크린샷.
10. console error/warning과 hydration 오류 확인.

실제 푸시 발송, 메모 저장, 지갑 Apply는 하지 마라.

## 금지 사항

- 보고서만 다시 작성하고 종료하지 마라.
- 최신 6건을 전체 이력처럼 표시하지 마라.
- API 오류를 빈 데이터·0원으로 숨기지 마라.
- 일반 모드 응답에 민감한 세션 진단 정보를 추가하지 마라.
- 메모 대상을 자동으로 최신 예약에 연결하지 마라.
- 활성 기기가 없는데 발송 가능한 것처럼 보이게 하지 마라.
- 표 문제를 scrollbar 장식만으로 해결하지 마라.
- 사용자 문구에 `Provider`를 노출하지 마라.
- 새 디자인 시스템, 새 전역 상태 체계, 범용 추상화, 불필요한 의존성을 만들지 마라.
- 관련 없는 관리자 페이지를 함께 리디자인하지 마라.
- 테스트를 통과시키기 위해 실제 안전 검증이나 접근성 요구를 삭제하지 마라.
- 요청받지 않은 commit/push를 하지 마라.

## 최종 수용 기준

아래 항목이 모두 충족되어야 완료다.

- API 장애가 404·0원·0건으로 위장되지 않는다.
- 부분 실패에서도 신뢰 가능한 고객 정보는 유지된다.
- 일반 모드 언어 표시가 실제 안전 데이터와 일치하거나 정직하게 숨겨진다.
- 활성 예약이 latest 6 의존 없이 보장된다.
- 모든 최신 일부 데이터에 실제 범위가 표시된다.
- 메모 기본값은 No booking link이며 예약을 유일하게 식별할 수 있다.
- 빈 메모 제출에 명확한 피드백이 있다.
- Open actions와 History signals가 분리된다.
- 활성 푸시 기기 0대일 때 dead form으로 진입하지 않는다.
- 1024와 1440에서 핵심 예약 정보를 수평 스크롤 없이 읽는다.
- 지갑 검토에서 before/change/after와 금액·방향·실행자가 보인다.
- 채팅은 방을 구분할 수 있고 한 번에 한 transcript만 펼친다.
- 빈 Referral/Notes/Notifications가 페이지 높이를 낭비하지 않는다.
- 키보드, heading, 고유 링크 이름, 상태 메시지 기본 접근성이 충족된다.
- 관련 테스트·typecheck·lint·admin/api scope verification 결과가 보고된다.

## 최종 보고 형식

작업 완료 후 다음 형식으로 간결하지만 빠짐없이 보고하라.

1. 운영자 관점에서 무엇이 달라졌는지.
2. 변경한 파일 목록과 각 파일의 역할.
3. 데이터/API 계약 변경과 민감 정보 보호 방식.
4. 실행한 테스트와 pass/fail/skipped 결과.
5. 1024/1280/1440 브라우저 검증 결과와 스크린샷 경로.
6. protected area를 건드렸는지 여부.
7. 남은 위험 또는 의도적으로 미룬 항목.

완료되지 않은 항목이 있으면 숨기지 말고 이유와 정확한 다음 작업을 명시하라.

---

## 이 프롬프트가 의도하는 최소 구현 방향

- 기존 관리자 디자인 언어는 유지한다.
- 새 시스템을 만드는 대신 기존 컴포넌트와 API 패턴을 재사용한다.
- 먼저 잘못된 데이터 신뢰와 메모 연결 위험을 제거한다.
- 이후 상단 우선순위, 예약 표, 지갑, 채팅의 정보 밀도를 개선한다.
- 운영자가 실제로 실수할 수 있는 부분은 시각적 개선보다 우선한다.
