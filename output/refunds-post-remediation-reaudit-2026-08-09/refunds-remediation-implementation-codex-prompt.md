# Codex 실행 프롬프트 — HANDS Admin `/refunds` 재감사 후 개선 구현

아래 내용을 **그대로 Codex에 전달**한다.

---

## 작업 목표

`C:\dev\massage-on-demand-vn` 프로젝트의 HANDS Admin `/refunds` 페이지를 재감사 보고서 기준으로 실제 수정하라.

이번 작업의 목표는 단순한 시각적 정리가 아니다. 운영자가 환불 건을 발견한 뒤 승인 검토, 상태 불일치 확인, 결제 타임라인 확인까지 **선택한 환불 ID를 잃지 않고 한 흐름으로 완료**할 수 있게 만드는 것이다.

반드시 다음 보고서를 먼저 끝까지 읽고 근거로 사용하라.

```text
C:\dev\massage-on-demand-vn\output\refunds-post-remediation-reaudit-2026-08-09\refunds-post-remediation-reaudit-report.md
```

이전 감사 문서도 비교가 필요할 때만 참고하라.

```text
C:\dev\massage-on-demand-vn\output\refunds-audit-2026-08-08\refunds-deep-audit-report.md
C:\dev\massage-on-demand-vn\output\refunds-audit-2026-08-08\refunds-remediation-codex-prompt.md
```

작업을 계획만 하고 끝내지 말고, 소스 수정·테스트·실제 브라우저 검증·결과 보고서 작성까지 완료하라.

---

## 반드시 지켜야 할 범위와 원칙

### 화면 기준

- **1440px 이상 데스크톱만 지원·검수한다.**
- 기준 캡처 크기는 `1440 × 900`이다.
- 1024px 이하 반응형, 모바일, 태블릿 화면은 이번 작업 범위에서 완전히 제외한다.
- 범위 밖 반응형 작업으로 시간을 쓰거나 관련 문제를 결과 보고서에 넣지 마라.

### 운영·금융 안전 원칙

- `/refunds`는 환불 triage·검색·상태 파악 화면이다.
- 승인·거절 권한은 Approval Queue에 유지한다.
- `/refunds`에 직접 승인·거절 mutation 버튼을 추가하지 마라.
- maker-checker, RBAC, 재검증, 감사로그 규칙을 약화하지 마라.
- 기존 금융 상태 전이와 API 의미를 임의로 변경하지 마라.
- 존재하지 않는 환불 복구 mutation을 UI만으로 꾸며 내지 마라.
- 실제 안전한 repair API가 없으면 정확한 증거 화면, 결제/부킹 링크, 명확한 escalation owner를 제공하라.
- Settlement Repair는 settlement snapshot/earning 복구 전용이다. 환불 상태 불일치의 범용 목적지로 사용하지 마라.

### 코드 작업 원칙

- 먼저 repo 및 하위 경로의 `AGENTS.md`를 모두 확인하라.
- 현재 worktree는 사용자 변경사항이 있는 dirty 상태일 수 있다. 관련 없는 변경을 되돌리거나 덮어쓰지 마라.
- `git reset --hard`, `git checkout --`, 광범위 삭제를 사용하지 마라.
- 기존 공용 Admin 컴포넌트, 상태 badge, form control, table/pagination 패턴을 우선 재사용하라.
- 새 라이브러리는 추가하지 마라. 현재 React/Next/CSS로 해결하라.
- 과도한 추상화나 범용 프레임워크를 만들지 말고 Refunds 흐름에 필요한 최소 구조로 구현하라.
- 현재 정상화된 큐 계약, 검색, 빈 상태, 페이지 정규화, 로딩, 정확한 결제 링크를 깨뜨리지 마라.
- 구현 중 관련 없는 페이지를 재디자인하지 마라. 단, Approval Queue와 Payment detail의 환불 인계 계약에 필요한 최소 변경은 범위에 포함한다.

### 권장 스킬과 도구

- UI 구현·정리에는 사용 가능한 경우 `$impeccable`의 audit/clarify/layout/harden/polish 지침을 사용하라.
- 로그인된 화면 확인은 Codex Desktop의 in-app browser가 있으면 그것을 우선 사용하라.
- 실제 UI를 1440×900으로 캡처하고 모든 캡처를 직접 열어 확인하라.
- 앱이 이미 실행 중이면 기존 세션을 사용하고 불필요하게 프로세스를 재시작하지 마라.

---

## 현재 확인된 정상 동작 — 반드시 보존

다음 항목은 이미 개선됐으므로 회귀시키면 안 된다.

1. `/refunds` 기본값은 `range=all`, `review=open`, `sort=oldest`다.
2. 기본 화면에서 전체 열린 112건이 보이고 Today 0 때문에 숨겨지지 않는다.
3. 배타적 큐 계약은 현재 데이터에서 다음과 같다.
   - Approval required: 3
   - Gateway processing: 0
   - Reconciliation required: 109
   - Open work: 112
4. `Open payment`는 정확한 `/payments/{paymentId}`로 이동한다.
5. 검색은 refund ID, booking ID, payment ID, 고객명, 전화번호를 서버에서 처리한다.
6. Age 구간은 0–1h, 1–4h, 4–24h, 1–3d, 3–7d, 7d+다.
7. SLA는 4h 기준 Within/Overdue/Overdue under 24h/24h+ critical을 제공한다.
8. Today 빈 상태는 전체 열린 환불 수와 `View all open refunds`를 제공한다.
9. 범위를 초과한 `page=999`는 마지막 유효 페이지로 정규화된다.
10. `/refunds/loading.tsx`가 있다.
11. queue meta와 refund rows는 병렬로 읽고, 기본 경로의 DB 읽기는 약 3회 구조로 줄어 있다.
12. 현재 focused Admin 테스트 14개와 API queue 계약 테스트 9개가 통과한다.

---

## 구현 우선순위

반드시 **P1 → P2 → P3** 순서로 작업하라. P1이 끝나기 전에 시각적 polish에 집중하지 마라.

---

# P1. 운영 흐름을 실제로 완성하라

## P1-1. Approval Queue exact-focus 계약

### 현재 문제

`AWAITING_DECISION` 환불의 `Review decision`이 아래 범용 URL로만 이동한다.

```text
/finance-tax/approval-queue?view=refunds
```

Approval Queue는 109개 state mismatch를 먼저 보여 줄 수 있어서 방금 선택한 3개 승인 가능 환불이 첫 페이지에 나타나지 않는다.

### 구현 요구

Approval Queue에 `requestId` 또는 의미가 동일한 exact-focus query 계약을 추가하라.

권장 URL:

```text
/finance-tax/approval-queue?view=refunds&requestId={refundId}#approval-{refundId}
```

원래 Refunds URL을 안전하게 보존할 수 있도록 `returnTo`도 지원하라.

예:

```text
/finance-tax/approval-queue?view=refunds&requestId={refundId}&returnTo={encodedRefundsUrl}#approval-{refundId}
```

다음 조건을 모두 만족해야 한다.

- selected request가 기본 `take=10`과 큐 정렬 밖에 있어도 반드시 조회된다.
- summary count는 전체 선택 범위의 실제 count를 유지한다.
- focus 결과는 첫 화면 상단 또는 별도 focused case panel에 렌더링한다.
- 해당 건의 Ready/Blocked/State mismatch 상태를 최신 서버 응답으로 표시한다.
- Ready일 때만 기존 maker-checker 조건에 따라 approve/reject가 나타난다.
- State mismatch에는 approve/reject를 절대 노출하지 않는다.
- 존재하지 않거나 이미 해결된 ID면 빈 큐처럼 보이게 하지 말고 “해당 요청을 찾을 수 없거나 상태가 변경됨”을 표시한다.
- `Back to refund queue`가 원래 검색·큐·날짜·나이·SLA·정렬·페이지를 복원한다.

### 백엔드 구현 지침

- 실제 controller/DTO/query/service 위치를 검색해서 기존 패턴에 맞게 수정하라.
- `apps/api/src/admin/admin.service.ts`의 finance approval queue read path와 관련 타입을 확인하라.
- exact ID 조회는 일반 10개 목록에 우연히 포함되기를 기대하면 안 된다.
- 다음 중 현재 구조에 가장 작은 방식을 선택하라.
  1. focused refund를 별도 필드로 반환
  2. requestId가 있으면 그 요청을 목록 최상단에 병합
  3. requestId 전용 exact read endpoint 사용
- 중복 행이 생기지 않게 하라.
- focus 대상 하나를 위해 전체 109건을 클라이언트로 보내지 마라.

### Refunds 링크 수정

`apps/admin_web/app/refunds/page.tsx`의 `refundPrimaryAction()`에서 `AWAITING_DECISION` 링크가 정확한 refund ID와 returnTo를 포함하도록 변경하라.

현재 필터 URL을 행 생성 단계에서 안전하게 전달할 구조를 설계하라. URL은 `URLSearchParams`로 생성하고 문자열 이어 붙이기로 query를 조립하지 마라.

---

## P1-2. State mismatch를 정확한 환불 검토 화면으로 연결

### 현재 문제

`STATE_MISMATCH`의 `Open reconciliation`이 다음으로 이동한다.

```text
/finance-closeout?q={bookingId}
```

Finance Closeout은 settlement snapshot 복구 화면이므로 refund/payment/booking 상태 불일치를 처리할 수 없다.

### 이번 구현 방향

새로운 큰 페이지를 만들기 전에 P1-1의 Approval Queue exact-focus 계약을 재사용하라.

권장 URL:

```text
/finance-tax/approval-queue?view=refunds&requestId={refundId}&returnTo={encodedRefundsUrl}#approval-{refundId}
```

State mismatch focused view에는 최소한 다음이 보여야 한다.

- 전체 Refund ID
- 전체 Payment ID
- 전체 Booking ID
- Refund status
- Payment status
- Booking status
- 사람이 이해할 수 있는 mismatch reason
- Payment timeline 링크
- Booking detail 링크
- 최신 상태 Refresh/Revalidate
- 실제 repair action이 있으면 권한·확인·감사로그가 있는 안전한 action
- repair action이 없으면 명확한 owner와 escalation 문구

다음은 금지한다.

- 상태 불일치에 Approve/Reject 노출
- Finance Closeout 0건 화면으로 이동
- “Repair”라는 이름의 비동작 버튼 추가
- 결제/부킹 상태를 클라이언트에서 임의로 맞추는 mutation

Refunds의 CTA 문구는 목적지 기능에 맞춰 다음 중 하나로 명확히 하라.

- `Review state mismatch`
- `Open reconciliation case`

단순히 `Open reconciliation`이라고 쓰고 아무 복구 수단이 없는 화면으로 보내지 마라.

---

## P1-3. Review checklist를 실제 disclosure로 구현

### 현재 문제

현재 action cell의 링크는 `#refund-review-{id}`로만 이동하고 `<details>`의 open 상태를 변경하지 않는다.

### 구현 요구

- 외부 `<a href="#...">`를 실제 상태를 가진 button으로 바꾼다.
- button에 `aria-expanded`와 `aria-controls`를 제공한다.
- 클릭, Enter, Space 모두 열기/닫기를 수행한다.
- Escape로 닫고 toggle button 또는 summary로 포커스를 돌린다.
- 한 번에 한 사례만 확장하는 방식을 권장한다.
- 열릴 때 대상이 현재 viewport 안에 오도록 필요한 경우 `scrollIntoView({ block: 'nearest' })`를 사용한다.
- 해시 직접 진입을 계속 지원한다면 초기 open 상태까지 연결한다. 지원하지 않을 거면 해시 계약을 제거한다.

### 렌더링 구조

현재는 10개 사례마다 기본 행과 닫힌 checklist 행을 모두 렌더링한다. 이를 고쳐 다음처럼 만든다.

- 닫힘: 사례 행 1개만 존재
- 열림: 선택 사례 바로 아래 full-width detail row 1개만 추가
- 다른 사례를 열면 이전 사례는 닫힘

필요하면 `refunds-table-section.tsx`의 최소 범위만 client component로 전환하라. 서버에서 전달하는 row 모델은 문자열·숫자·tone key처럼 직렬화 가능한 값 위주로 정리하라. 단순 toggle을 위해 페이지 전체를 client component로 바꾸지 마라.

체크리스트 열기 버튼 이름은 다음처럼 상태를 포함할 수 있다.

```text
Review controls · 2/5 ready
```

---

## P1-4. Payment detail이 active refund를 인식하게 수정

### 현재 문제

이미 열린 환불 요청이 있는 결제 상세에서 다음 안전 행동이 다시 `Request refund review`로 표시된다.

### 구현 요구

Payment detail의 next-safe-action 계산에 최신 active refund를 포함하라.

상태별 권장 동작:

| 환불 상태 | Payment detail CTA |
|---|---|
| active refund 없음 | `Request refund review` |
| `REQUESTED` | `Open pending refund review` |
| approval/provider/gateway processing | `Open refund progress` |
| state mismatch | `Review refund state mismatch` |
| completed/rejected만 존재 | 기존 정책에 따라 새 요청 가능 여부 계산 |

- active refund가 있는 동안 새 refund request CTA를 숨긴다.
- 대신 정확한 refund ID의 Approval Queue focused view 또는 Refunds exact search로 이동한다.
- 화면에서 open refund ID와 status를 읽을 수 있어야 한다.
- 서버 mutation이 중복을 막는 기존 검증은 그대로 유지한다.

---

# P2. 1440px 운영 밀도와 정보 명확성 개선

## P2-1. 중첩 세로 스크롤 제거

현재 `.refund-table-scroll`의 아래 규칙 때문에 페이지 스크롤 안에 별도 세로 스크롤이 생긴다.

```css
max-height: min(720px, calc(100vh - 210px));
overflow: auto;
```

1440px 데스크톱 Refunds 화면에서는 다음 방향으로 수정하라.

```css
max-height: none;
overflow-x: auto;
overflow-y: visible;
```

- 표 내부 세로 스크롤을 제거한다.
- 문서 가로 overflow는 만들지 않는다.
- 1440px에서 필요한 최소 표 폭은 유지하되 가능하면 6열 구조로 정리한다.
- sticky table header가 전체 페이지 스크롤에서 오작동하면 sticky를 제거한다. 내부 세로 스크롤을 되살리지 마라.

## P2-2. 한 건 한 행과 6열 구조

권장 열:

1. Stage / age / created / refund ID
2. Customer / booking
3. Amount / payment
4. Reason / source
5. Readiness / blockers
6. Owner / next action

적용 원칙:

- stage badge와 같은 stage 굵은 문구를 중복 표시하지 않는다.
- primary action과 checklist toggle을 같은 Action 영역에서 명확히 분리한다.
- Reason/Source가 길어도 한 셀이 지나치게 높아지지 않게 한다.
- full raw source code는 기본 주요 문구가 아니라 보조 정보로 둔다.
- pagination은 표 외부 아래에 계속 유지한다.

## P2-3. Evidence를 Data/Control readiness로 수정

현재 5개 체크는 목록 payload의 존재·정합성을 확인하는 것이지 승인용 immutable evidence가 아니다.

다음 문구를 사용하라.

- 열 제목: `Control readiness` 또는 `Data readiness`
- 요약: `2/5 control facts available`
- blocker: `2 control gaps`

체크 항목은 다음 상태를 구분한다.

- Available
- Missing
- Not required
- Mismatch

`Decision evidence`라는 표현은 Approval Queue의 실제 승인 snapshot에만 사용하라.

## P2-4. 명령 보드 카드를 큐 바로가기로 변경

각 metric을 실제 링크로 만든다.

| 카드 | 이동 필터 |
|---|---|
| Approval required | `review=requested` |
| Gateway processing | `review=processing` |
| Reconciliation required | `review=state-mismatch` |
| SLA overdue | `review=open&sla=overdue` |
| Oldest open | `review=open&sort=oldest` |

- q, range, age, customerProfileId처럼 현재 scope에 필요한 필터는 보존한다.
- queue 카드 이동 시 page는 1로 초기화한다.
- 현재 선택 큐 카드는 active 상태를 보여 준다.
- active는 색상만으로 표현하지 말고 텍스트 또는 `aria-current`를 제공한다.
- 설명 문구에서 command board count가 어떤 필터를 따르고 Queue 선택을 어떻게 해석하는지 명확히 한다.

## P2-5. More filters 표현과 발견성

- `More filtersAge and SLA`가 붙지 않도록 summary에 명시적인 gap을 준다.
- 권장 문구: `More filters · Age and SLA`
- 활성 advanced filter가 있으면 `1 active`, `2 active` badge를 표시한다.
- Age/SLA controls 자체는 현재 segmented navigation을 재사용한다.
- 112건 모두 overdue인 현재 상황에서는 command board의 SLA card가 바로가기 역할을 하게 한다.

## P2-6. Source code를 운영자 문구로 매핑

raw enum/metadata source를 그대로 주요 문구로 노출하지 마라.

예:

```text
UNMATCHED_BOOKING_CLOSE → Created while closing an unmatched booking
ADMIN_MANUAL → Created manually by an administrator
```

- 실제 저장값을 조사해 현재 존재하는 source 값 전체를 매핑한다.
- 모르는 값은 사람이 읽을 수 있게 humanize하고 raw code를 보조 정보로 남긴다.
- `Not recorded`는 `Legacy request — source not recorded`처럼 의미와 제약을 함께 표현한다.
- 매핑 함수에 단위 테스트를 추가한다.

## P2-7. 문서 title 추가

Refunds route 또는 가장 적절한 layout metadata에 다음 제목을 추가한다.

```text
Refunds | HANDS Admin
```

- `document.title`이 빈 문자열이면 안 된다.
- 다른 페이지의 title 패턴이 있으면 동일한 형식을 따른다.

## P2-8. 다크 모드 계층 보완

- 새로운 hard-coded 색을 추가하지 말고 기존 admin theme token을 사용한다.
- 보조 텍스트, 입력 placeholder, 비활성 metric, card border가 배경과 구분되게 한다.
- warning/danger 카드가 다크 모드에서 흐릿한 갈색 한 톤으로 뭉치지 않게 한다.
- 색만으로 상태를 구분하지 않는다.
- 정량 contrast 도구가 없으면 WCAG 통과를 주장하지 말고 시각 캡처와 사용 토큰을 보고한다.

---

# P3. 코드와 세부 완성도 정리

## P3-1. 전체 ID 확인·복사

- 목록에는 short ID를 유지할 수 있다.
- Refund/Booking/Payment 전체 ID는 title, tooltip, details, copy button 중 기존 디자인 시스템과 가장 일관된 방식으로 제공한다.
- copy button에는 명확한 accessible name과 성공 피드백을 준다.

## P3-2. 사용되지 않는 체크리스트 컴포넌트 정리

아래 컴포넌트가 현재 페이지에서 사용되지 않는지 다시 확인하라.

```text
apps/admin_web/app/refunds/refund-decision-checklist-section.tsx
```

- 실제 import가 없고 최종 구현과 중복되면 파일과 전용 spec을 제거한다.
- 재사용한다면 현재 inline readiness와 중복되지 않게 하나의 패턴으로 통합한다.
- 사용자 변경이거나 다른 작업의 예정 파일이라는 증거가 있으면 삭제하지 말고 결과 보고서에 남긴다.

## P3-3. legacy CSS 정리

`.refunds-table-card` selector의 실제 참조를 전체 검색하라.

- 참조가 없으면 관련 legacy CSS만 제거한다.
- 공용 payout/coupon selector까지 함께 삭제하지 마라.
- 현재 `.refund-cases-panel`, `.refund-table-scroll`, `.refund-operations-table` 스타일을 최종 기준으로 정리한다.

---

## 필수 테스트

### 기존 focused tests

다음을 반드시 실행하고 모두 통과시켜라.

```powershell
npm run test --workspace @massage-vn/admin-web -- app/refunds/page.spec.tsx app/refunds/refund-command-board-section.spec.tsx app/refunds/refund-filter-board-section.spec.tsx app/refunds/refunds-table-section.spec.tsx
```

```powershell
npm run test --workspace @massage-vn/api -- src/admin/admin-refund-queue.spec.ts
```

### 추가해야 할 회귀 테스트

최소한 다음 계약을 테스트하라.

1. `AWAITING_DECISION` action URL에 exact refund ID가 포함된다.
2. `STATE_MISMATCH` action이 더 이상 `/finance-closeout`으로 가지 않는다.
3. focused Approval Queue는 기본 take 밖의 exact request를 반환한다.
4. focused request와 일반 queue에 같은 refund가 중복 렌더링되지 않는다.
5. state mismatch focused item에는 approve/reject action이 없다.
6. 존재하지 않거나 상태가 바뀐 focused ID는 명확한 state를 렌더링한다.
7. returnTo가 허용된 admin 내부 경로만 보존하고 외부 URL을 허용하지 않는다.
8. checklist toggle의 open/close 상태와 ARIA 계약을 검증한다.
9. active refund가 있는 payment detail은 `Request refund review`를 노출하지 않는다.
10. source code mapping과 unknown fallback을 검증한다.
11. document title이 `Refunds | HANDS Admin`이다.
12. 기존 default/all/today/search/page canonicalization 테스트가 계속 통과한다.

변경 범위가 여러 앱에 걸치므로 관련 최소 typecheck도 실행하라.

```powershell
npm run typecheck --workspace @massage-vn/admin-web
npm run typecheck --workspace @massage-vn/api
```

프로젝트에 기존 오류가 있어 실패하면 이번 변경으로 생긴 오류와 기존 오류를 구분해 근거와 함께 보고하라.

---

## 필수 브라우저 검증

로그인된 실제 앱을 `1440 × 900`에서 검증하라. DOM이나 코드만 보고 완료 판정하지 마라.

각 단계에서 URL, 화면 내용, 선택 ID 보존 여부, 콘솔 오류를 확인하고 스크린샷을 저장하라.

권장 저장 위치:

```text
C:\dev\massage-on-demand-vn\output\refunds-remediation-verification-<date>\
```

### 캡처할 흐름

1. `/refunds` 기본 상단
   - All dates / Open work / Oldest first
   - 3 / 0 / 109 / 112 계약
2. 기본 사례 표
   - 페이지 내부 세로 스크롤만 존재
   - 한 건 한 기본 행
3. checklist 닫힘
4. checklist 열림
   - button 상태와 full-width detail 확인
5. Approval required 3건
6. 첫 `Review decision` 클릭 후 focused Approval Queue
   - 동일 refund ID가 첫 화면에 보이는지 확인
7. 첫 state mismatch action 클릭 후 focused mismatch view
   - refund/payment/booking 상태와 실제 다음 행동 확인
8. exact payment detail
   - active refund가 있으면 새 request CTA가 숨겨지는지 확인
9. Today 빈 상태
   - 전체 열린 건수와 복귀 링크 확인
10. exact ID 검색
11. `page=999` canonicalization
12. More filters 닫힘/열림
13. dark mode 상단과 사례 표

### 브라우저 합격 기준

- 문서 가로 overflow 없음
- `.refund-table-scroll`에 별도 세로 overflow 없음
- 브라우저 콘솔 오류 0건
- Review checklist가 클릭·Enter·Space로 열림
- 정확한 refund ID가 Approval Queue에서 보임
- state mismatch가 Settlement Repair 0건 화면으로 가지 않음
- active refund 결제에서 중복 request CTA 없음
- `document.title === 'Refunds | HANDS Admin'`
- 라이트/다크 모두 상태와 텍스트 계층을 식별 가능

모든 스크린샷은 저장 후 직접 열어 확인하라. 캡처만 저장하고 보지 않은 상태로 완료하지 마라.

---

## 성능 회귀 방지

- 기본 `/refunds`의 병렬 queue-meta + rows 구조를 유지한다.
- command card 링크화를 위해 추가 DB 요청을 만들지 마라.
- Approval Queue exact focus는 해당 deep-link에만 필요한 최소 exact read를 추가한다.
- focus 요청 하나를 찾기 위해 전체 109건을 전송하지 마라.
- 서버 검색의 exact ID query는 가능하면 fast path를 사용하되, 기존 부분 검색을 제거하지 마라.
- 수정 전후 로컬 워밍 응답시간을 동일 조건에서 여러 번 측정해 결과 보고서에 남긴다.
- 단일 로컬 표본을 운영 p95나 WCAG 성능 보증으로 표현하지 마라.

---

## 금지 사항

- 계획이나 제안서만 작성하고 구현을 멈추는 것
- `/refunds`에 직접 approve/reject mutation 추가
- maker-checker 또는 RBAC 완화
- 실제 기능이 없는 Repair 버튼 추가
- state mismatch를 Finance Closeout으로 계속 보내는 것
- 정확한 환불 ID 없이 범용 Approval Queue로 보내는 것
- checklist 링크를 해시 강조만 되도록 남기는 것
- 모든 사례의 닫힌 detail row를 계속 렌더링하는 것
- 1440px에서 테이블 내부 세로 스크롤을 유지하는 것
- raw 내부 source code를 주요 운영 문구로 그대로 노출하는 것
- 새 UI 라이브러리·상태 라이브러리 설치
- 임의 DB 데이터 수정이나 seed 변경으로 화면만 맞추는 것
- 관련 없는 페이지·CSS·사용자 변경사항 정리
- 1024px 이하 반응형 작업 또는 검사
- 테스트를 삭제·약화해 통과시키는 것

---

## 작업 완료 보고서

구현 완료 후 다음 파일을 작성하라.

```text
C:\dev\massage-on-demand-vn\output\refunds-remediation-verification-<date>\refunds-remediation-implementation-report.md
```

보고서에는 반드시 포함한다.

1. 최종 판정: 완료 / 부분 완료 / 차단
2. P1/P2/P3 요구사항별 구현 상태
3. 변경 파일 목록과 파일별 책임
4. Approval Queue exact-focus API/URL 계약
5. state mismatch 최종 목적지와 제공 작업
6. Payment detail active-refund 정책
7. 1440×900 전후 캡처
8. 실행한 테스트·typecheck 명령과 결과
9. 브라우저 콘솔·overflow·document title 결과
10. 성능 표본과 한계
11. 남은 위험 또는 미완료 항목
12. 임의로 수정하지 않은 관련 없는 dirty 파일

완료 메시지는 “수정했다”로 끝내지 말고 다음 형식으로 요약하라.

```text
결과: [완료/부분 완료/차단]
핵심 변화: [운영자가 이제 무엇을 끝까지 할 수 있는지]
검증: [테스트 수, typecheck, 브라우저 흐름]
보고서: [절대 경로]
잔여 위험: [없음 또는 구체적 항목]
```

---

## 최종 완료 조건

다음 항목이 모두 충족돼야 작업 완료로 판정한다.

- [ ] Approval required 선택 건이 exact focused Approval Queue로 이동한다.
- [ ] take/sort와 무관하게 선택 refund가 반환된다.
- [ ] State mismatch가 정확한 환불 상태 검토 화면으로 이동한다.
- [ ] Settlement Repair의 무관한 0건 화면으로 이동하지 않는다.
- [ ] Review checklist가 실제로 열리고 접근성 상태가 맞다.
- [ ] 닫힌 checklist row가 모든 사례의 높이를 차지하지 않는다.
- [ ] 1440px에서 중첩 세로 스크롤이 없다.
- [ ] stage 중복 표시가 없다.
- [ ] Evidence 표현이 Data/Control readiness로 정정됐다.
- [ ] Command card가 실제 큐 링크이며 active 상태를 표시한다.
- [ ] More filters 문구가 분리되고 활성 개수를 표시한다.
- [ ] source code가 운영자용 문구로 변환된다.
- [ ] active refund payment에서 중복 request CTA가 없다.
- [ ] `Refunds | HANDS Admin` title이 적용됐다.
- [ ] 기존 큐 계약·검색·빈 상태·canonicalization·loading이 회귀하지 않았다.
- [ ] focused tests, 추가 회귀 테스트, 관련 typecheck가 완료됐다.
- [ ] 1440×900 실제 화면 캡처와 직접 확인이 완료됐다.
- [ ] 구현 보고서가 작성됐다.

이 조건 중 하나라도 충족되지 않으면 `완료`라고 쓰지 말고 `부분 완료` 또는 `차단`으로 보고하라.

