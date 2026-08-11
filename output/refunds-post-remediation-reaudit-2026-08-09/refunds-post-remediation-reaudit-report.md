# HANDS Admin `/refunds` 개선 후 심층 재감사 보고서

- 감사 일시: 2026-08-09 (Asia/Bangkok)
- 감사 대상: `http://localhost:3101/refunds`
- 비교 기준: `refunds-deep-audit-report.md`, `refunds-remediation-codex-prompt.md`
- 화면 기준: **1440 × 900 데스크톱만 검사**
- 제외 범위: 1024px 이하 화면 및 모바일/태블릿 반응형
- 검증 방식: 현재 실행 화면 직접 조작·캡처, 소스/API 계약 비교, 실제 인계 경로 추적, 자동화 테스트, 브라우저 콘솔·레이아웃·응답시간 표본 확인

---

## 1. 최종 판정

### 결론

이전 52/100 상태에서 **72/100까지 분명히 개선**되었다. 기본 범위, 배타적 큐 계약, 검색, 빈 상태, 페이지 정규화, 정확한 결제 상세 링크, 로딩 화면, 집계 성능은 실제로 좋아졌다.

그러나 현재 화면은 아직 **“무엇을 먼저 볼 것인가”는 알려 주지만 “선택한 건을 끝까지 처리하는가”는 보장하지 못한다.** 특히 다음 세 경로는 운영 완료를 막는다.

1. `Review decision`이 선택한 환불 요청을 잃고 범용 승인 큐로 이동한다.
2. `Open reconciliation`이 환불 상태 불일치와 다른 성격의 Settlement Repair 화면으로 이동하며, 선택 건을 처리할 수 없다.
3. `Review checklist`가 체크리스트를 열지 않고 해시와 강조 표시만 바꾼다.

따라서 현재 상태는 **조건부 통과**다. 읽기·탐색 화면으로는 사용할 수 있지만, 승인·상태 복구를 수행하는 운영 콘솔로 배포 완료 판정을 내리기에는 이르다.

### 점수

| 평가 영역 | 점수 | 판정 |
|---|---:|---|
| 큐·데이터 계약 | 18/20 | 기본 범위와 배타적 큐가 정상화됨 |
| 운영 작업 연속성 | 7/20 | 핵심 인계 세 경로가 선택 건을 보존하지 못함 |
| 정보 구조·테이블 가독성 | 10/15 | 정보는 충실하지만 중첩 스크롤과 중복 행이 비교를 방해 |
| 검색·필터·상태 처리 | 13/15 | 검색, 날짜, 큐, 나이, SLA, 빈 상태가 실용적 |
| 문구·접근성·테마 | 11/15 | 의미 구조는 양호하나 문서 제목, 동작 명칭, 다크 대비 보완 필요 |
| 성능·신뢰성 | 8/10 | 읽기 수가 크게 감소했고 워밍 상태 응답이 안정적 |
| 코드 정합성 | 5/5 | 테스트 계약은 좋으나 사용되지 않는 이전 컴포넌트는 정리 필요 |
| **총점** | **72/100** | **핵심 인계 수정 전 조건부 통과** |

### 심각도 집계

- P0 차단: 0건
- P1 주요: 4건
- P2 보통: 8건
- P3 정리/완성도: 3건

---

## 2. 이전 감사 요건 반영 상태

| 이전 핵심 요건 | 상태 | 현재 확인 결과 |
|---|---|---|
| 기본 `/refunds`는 All dates + Open work + Oldest first | **통과** | URL 기본값과 화면 칩이 일치하며 112건을 바로 보여 줌 |
| Today 0 때문에 전체 미처리 건을 숨기지 않기 | **통과** | 기본 112건 노출, Today 빈 상태에서 전체 112건 안내 |
| 승인·게이트웨이·상태 불일치의 배타적 큐 계약 | **통과** | Open 112 = Approval 3 + Gateway 0 + Reconciliation 109 |
| 정확한 결제 상세 URL | **통과** | `/payments/{paymentId}`로 정확히 이동 |
| 서버 검색 | **통과** | 환불/부킹/결제/고객명/전화 검색 계약과 실제 결과 확인 |
| 유용한 연령 구간 | **통과** | 0–1h, 1–4h, 4–24h, 1–3d, 3–7d, 7d+ 제공 |
| SLA 필터 | **통과** | Within/Overdue/24h+ 필터 제공, 4h 정책 표시 |
| 빈 상태가 전체 백로그를 숨기지 않기 | **통과** | Today 0에서 “112 still open across all dates”와 복귀 링크 제공 |
| 잘못된 페이지 번호 정규화 | **통과** | `page=999`가 실제 마지막 `page=12`로 리다이렉트 |
| 라우트 로딩 상태 | **통과** | `loading.tsx` 및 실제 로딩 화면 확인 |
| 승인 큐로 실제 처리 가능한 인계 | **미통과** | 범용 큐로 이동하며 선택한 3건 중 해당 건이 보이지 않음 |
| 상태 불일치 복구 화면으로 실제 인계 | **미통과** | 성격이 다른 Settlement Repair 0건 화면으로 이동 |
| 체크리스트를 실제로 열기 | **미통과** | 해시만 변경되고 `<details>`는 닫힌 채 유지 |
| 명확한 증빙·준비도 표현 | **부분 통과** | 5개 체크로 개선됐지만 목록 payload에서 생성한 규칙을 “Evidence”로 표현 |
| 테이블 밀도 개선 | **부분 통과** | 열은 정리됐으나 각 건마다 닫힌 체크리스트 행이 추가되고 중첩 스크롤 발생 |
| 명확한 명령 보드 | **부분 통과** | 수치는 좋아졌지만 카드가 큐로 이동하지 않고 Queue 필터 적용 범위가 불명확 |
| 다크 모드 품질 | **부분 통과** | 토큰은 사용하지만 보조 텍스트·테두리·입력 대비가 낮아 보임 |
| 읽기 성능 개선 | **통과** | 기본 화면이 병렬 2요청, 실질 DB 읽기 약 3회 구조로 감소 |

---

## 3. 화면 흐름별 증거

### 1) 기본 명령 보드 — 개선됨 / 부분 통과

![1. 기본 명령 보드 — 개선됨](C:/dev/massage-on-demand-vn/output/refunds-post-remediation-reaudit-2026-08-09/01-default-command-board.png)

- 기본값이 All dates / Open work / Oldest first로 바로 잡혔다.
- Approval 3, Gateway 0, Reconciliation 109의 배타적 합이 Open 112와 일치한다.
- “Current refund work”가 이전보다 훨씬 작고 읽기 쉽다.
- 다만 각 수치 카드가 필터 바로가기처럼 보이지만 클릭할 수 없다.
- Queue를 `Approval required`나 `Closed`로 바꿔도 보드 수치는 전체 워크스트림 기준으로 남는다. 현재 문구만으로는 이 범위를 알기 어렵다.

### 2) 기본 사례 테이블 — 부분 통과

![2. 기본 사례 테이블 — 부분 통과](C:/dev/massage-on-demand-vn/output/refunds-post-remediation-reaudit-2026-08-09/02-default-case-table.png)

- 표는 7열로 정리됐고 고객·부킹·결제 상세 링크가 분리됐다.
- 그러나 1440px에서도 페이지 스크롤 안에 높이 제한 테이블 스크롤이 다시 생긴다.
- 측정 결과 `.refund-table-scroll`은 `clientHeight 688px`, `scrollHeight 2416px`였다.
- 한 건이 기본 행 + 닫힌 체크리스트 요약 행 두 줄을 차지한다. 한 화면에서 2–3건만 비교 가능하다.
- `Reconciliation required`가 배지와 굵은 텍스트로 같은 셀에 두 번 표시된다.

### 3) Review checklist — 기능 실패

![3. Review checklist 클릭 후 — 실패](C:/dev/massage-on-demand-vn/output/refunds-post-remediation-reaudit-2026-08-09/03b-checklist-detail.png)

- 클릭 후 URL은 `#refund-review-{id}`로 바뀌고 대상 행은 강조된다.
- 하지만 `<details>`의 `open` 상태는 바뀌지 않아 내용이 나타나지 않는다.
- 운영자는 “버튼이 고장 났다”고 판단하게 된다.
- 키보드·스크린리더 관점에서도 링크가 실제 disclosure 상태를 설명하지 못한다.

### 4) Approval required 필터 — 데이터는 통과

![4. 승인 필요 3건 — 데이터 통과](C:/dev/massage-on-demand-vn/output/refunds-post-remediation-reaudit-2026-08-09/05-approval-required-cases.png)

- 정확히 3건만 보이며 workstream은 `Finance approval`로 분류된다.
- `UNMATCHED_BOOKING_CLOSE` 같은 내부 source 코드가 그대로 노출된다.
- Reason/Source 열 폭이 좁아 한 행 높이가 크게 늘어난다.

### 5) Review decision 인계 — 주요 실패

![5. 승인 큐 인계 — 선택 건 유실](C:/dev/massage-on-demand-vn/output/refunds-post-remediation-reaudit-2026-08-09/06-approval-queue-handoff.png)

- 링크는 `/finance-tax/approval-queue?view=refunds` 하나뿐이며 refund ID를 전달하지 않는다.
- 도착 화면은 112 open, 3 ready, 109 state mismatch를 보여 주지만 첫 화면은 상태 불일치 건으로 채워진다.
- 운영자가 방금 선택한 승인 필요 건을 다시 찾아야 한다.
- 단순 `#approval-{id}` 추가만으로는 부족하다. API가 첫 10건만 반환하고 109개 불일치가 먼저 정렬될 수 있으므로 **정확한 requestId 조회 계약**이 필요하다.

### 6) 정확한 결제 상세 인계 — 링크 통과, 정책 문구 불일치

![6. 정확한 결제 상세 — 링크 통과](C:/dev/massage-on-demand-vn/output/refunds-post-remediation-reaudit-2026-08-09/07-exact-payment-detail.png)

- 환불 목록에서 정확한 Payment ID 상세로 이동한다.
- 하지만 이미 열린 환불 요청이 있는 결제에서 다음 안전 작업이 다시 `Request refund review`로 표시된다.
- 서버가 중복 생성을 막더라도 운영자에게 중복 요청 가능성을 암시하므로 잘못된 다음 행동이다.

### 7) Open reconciliation 인계 — 주요 실패

![7. 상태 복구 인계 — 도메인 불일치](C:/dev/massage-on-demand-vn/output/refunds-post-remediation-reaudit-2026-08-09/08-reconciliation-handoff.png)

- 현재 링크는 `/finance-closeout?q={bookingId}`이다.
- 도착 화면의 목적은 “완료 부킹에 settlement snapshot이 없는 건” 복구다.
- 환불/결제/부킹 상태 불일치 109건을 정합화하는 작업과 다르다.
- 실제 화면은 backlog 0, evidence blocked 0으로 나타나며 선택 환불을 처리할 작업이 없다.

### 8) Today 빈 상태 — 통과

![8. Today 빈 상태 — 통과](C:/dev/massage-on-demand-vn/output/refunds-post-remediation-reaudit-2026-08-09/09b-today-empty-guidance.png)

- “오늘 생성된 열린 환불은 0건”과 “전체 날짜에는 112건이 열려 있음”을 동시에 말한다.
- `View all open refunds`로 안전하게 기본 범위로 돌아간다.
- 이전 감사의 가장 큰 데이터 은폐 문제는 해결됐다.

### 9) 잘못된 페이지 번호 — 통과

![9. page=999 정규화 — 통과](C:/dev/massage-on-demand-vn/output/refunds-post-remediation-reaudit-2026-08-09/10-invalid-page-canonicalized.png)

- `page=999`가 마지막 페이지인 `page=12`로 정규화된다.
- 실제로 `Showing 111 to 112 of 112 refund cases`를 표시한다.

### 10) 추가 필터 — 기능 통과, 표현 보완 필요

![10. 추가 필터 확장 — 부분 통과](C:/dev/massage-on-demand-vn/output/refunds-post-remediation-reaudit-2026-08-09/12-more-filters-expanded.png)

- Age와 SLA는 유용한 구간으로 잘 구현됐다.
- 접힌 상태의 `More filtersAge and SLA` 문구가 붙어 보인다.
- 112건 모두 SLA overdue인 현재 운영 상황에서 SLA/나이 필터가 숨겨져 있어 핵심 분류 도구의 발견성이 낮다.

### 11) 다크 모드 — 부분 통과

![11. 다크 모드 — 부분 통과](C:/dev/massage-on-demand-vn/output/refunds-post-remediation-reaudit-2026-08-09/13-dark-default.png)

- 토큰 기반 테마 전환은 정상이다.
- 보조 문구, 테두리, 입력 placeholder, 비활성 카드가 모두 비슷한 중간 톤이라 정보 계층이 약해진다.
- 이번 감사에서는 정량 contrast 측정을 하지 않았으므로 WCAG 준수 여부를 단정하지 않는다.

---

## 4. P1 — 배포 전 반드시 수정할 항목

### P1-1. 승인 인계가 선택한 환불 요청을 보존하지 않는다

- 위치: `apps/admin_web/app/refunds/page.tsx:322`
- 현재: 모든 승인 건이 `/finance-tax/approval-queue?view=refunds`로 이동
- 영향: 운영자가 목록에서 선택한 건을 다시 찾으며, 109개 state mismatch가 먼저 노출돼 3개 승인 가능 건이 사실상 묻힌다.
- 수정 원칙:
  1. Refunds에서는 승인/거절을 직접 실행하지 않는다. 분리 승인 권한은 Approval Queue에 유지한다.
  2. 링크는 refund ID를 전달한다.
  3. Approval Queue API가 `requestId` 또는 `refundId`로 정확한 한 건을 우선 조회한다.
  4. 도착 즉시 해당 행이 첫 화면에 보이고, 포커스/강조/결정 버튼이 함께 보여야 한다.
- 권장 URL 계약:
  - `/finance-tax/approval-queue?view=refunds&requestId={refundId}#approval-{refundId}`
- 완료 기준:
  - 10건 제한과 기본 정렬에 상관없이 선택 환불이 반드시 렌더링됨
  - Ready/Blocked/State mismatch 중 정확한 현재 상태가 표시됨
  - Back 링크가 원래 Refunds 필터와 페이지를 보존함

### P1-2. 상태 불일치 작업이 잘못된 도메인으로 이동한다

- 위치: `apps/admin_web/app/refunds/page.tsx:324`
- 현재: `/finance-closeout?q={bookingId}`
- 영향: “환불·결제·부킹 상태 정합화” 작업이 “settlement snapshot 복구” 화면으로 이동한다. 운영자는 아무 작업도 수행할 수 없다.
- 수정 원칙:
  1. Settlement Repair는 정산 스냅샷 복구 전용으로 유지한다.
  2. 환불 state mismatch는 정확한 refund/payment/booking 세 상태와 허용 가능한 복구 행동을 보여 주는 화면으로 연결한다.
  3. 현재 Approval Queue의 refund mismatch row를 재사용하려면 위의 exact-focus 계약을 동일하게 사용한다.
- 단기 권장안:
  - `/finance-tax/approval-queue?view=refunds&requestId={refundId}#approval-{refundId}`
  - 이 화면에서 `Open payment timeline`, `Open booking`, 최신 상태 재검증, 허용된 repair/escalate 행동을 제공
- 장기 권장안:
  - 상태 복구 API가 실제로 존재할 때만 `/refunds/{id}/reconciliation` 또는 전용 drawer 도입
- 완료 기준:
  - 클릭 후 선택 환불 ID가 보임
  - 세 상태 차이가 한 화면에 보임
  - 최소 하나의 실제 다음 행동 또는 명확한 escalation owner가 있음

### P1-3. Review checklist가 열리지 않는다

- 위치: `apps/admin_web/app/refunds/refunds-table-section.tsx:113-124`
- 원인: 외부 `<a href="#refund-review-id">`가 `<details>`의 `open` 속성을 변경하지 않음
- 영향: 핵심 검토 CTA가 무반응처럼 보인다.
- 수정 방법:
  - 작은 client toggle 컴포넌트를 만들고 `button` + `aria-expanded` + `aria-controls` 사용
  - 클릭 시 대상 details를 열고 `scrollIntoView({ block: 'nearest' })`
  - 다시 클릭하면 닫히며 Escape 시 summary/toggle로 포커스 복귀
  - 한 번에 하나만 열어 비교 밀도를 유지하는 accordion 동작 권장
- 완료 기준:
  - 마우스 클릭, Enter, Space 모두 동일하게 열림
  - 열림 상태가 접근성 트리에 반영됨
  - URL 해시 직접 진입 시에도 대상 체크리스트가 열리거나 별도 상세로 이동함

### P1-4. 결제 상세의 다음 행동이 열린 환불 요청을 무시한다

- 위치: `apps/admin_web/app/payments/[id]/page.tsx:374-381` 및 payment detail read model
- 현재: 이미 open refund가 있어도 `Request refund review`가 다음 안전 행동으로 표시됨
- 영향: 중복 요청 시도, 운영자 혼란, 승인 큐 중복 확인 비용이 생긴다.
- 수정 방법:
  - payment detail next-action 계산에 `payment.refunds`의 최신 active 상태를 포함
  - `REQUESTED`이면 `Open pending refund review`
  - `APPROVAL/PROVIDER/GATEWAY_PROCESSING`이면 `Open refund progress`
  - state mismatch이면 `Open refund reconciliation`
  - active refund가 없을 때만 `Request refund review`
- 완료 기준:
  - 한 결제에 active refund가 있는 동안 새 요청 CTA가 보이지 않음
  - CTA가 정확한 refund ID로 이동

---

## 5. P2 — 다음 개선 패스에서 수정할 항목

### P2-1. 1440px에서도 중첩 세로 스크롤이 생긴다

- 위치: `apps/admin_web/app/globals.css:25806-25811`
- 현재: `max-height: min(720px, calc(100vh - 210px)); overflow: auto;`
- 영향: 페이지 스크롤과 테이블 스크롤을 번갈아 써야 하며, Page Up/Down과 휠 동작이 예측하기 어렵다.
- 수정:
  - 데스크톱 Refunds 표는 `max-height: none; overflow-x: auto; overflow-y: visible;`
  - sticky header가 꼭 필요하면 전체 페이지 컨텍스트에서 유지하거나 표를 진짜 독립 작업영역으로 만들고 상단 보드/필터를 sticky 처리해야 한다. 현재처럼 두 방식 혼합은 피한다.

### P2-2. 닫힌 체크리스트가 모든 사례마다 별도 행을 차지한다

- 위치: `refunds-table-section.tsx:116-157`
- 영향: 10개 사례가 20개 `<tr>`로 렌더링되고, 닫힌 상태에서도 약 38–50px가 추가된다.
- 수정:
  - 기본 상태에서는 사례 행 하나만 렌더링
  - 선택된 한 건에만 full-width detail row를 조건부 렌더링하거나 우측 drawer 사용
  - Evidence/Readiness 셀의 `2 of 5`를 toggle 진입점으로 사용

### P2-3. 상태명이 한 셀에서 중복된다

- 위치: `page.tsx:388-398`, `refunds-table-section.tsx:77-80`
- 현재: 배지 `Reconciliation required` + 굵은 제목 `Reconciliation required`
- 수정:
  - 배지는 stage 하나만 유지
  - 그 아래에는 age, 생성시각, short ID만 표시

### P2-4. “Evidence”가 실제 결정 증빙보다 목록 payload 준비도를 뜻한다

- 위치: `page.tsx:255-317`
- 현재 체크: booking 존재, payment 존재, metadata context, gateway reference/callback, state alignment
- 영향: 운영자가 이를 승인용 증빙 완료율로 오해할 수 있다. 실제 immutable decision evidence는 Approval Queue에 있다.
- 수정:
  - 열 이름 `Data readiness` 또는 `Control readiness`
  - `2 of 5 checks complete` → `2/5 control facts available`
  - `Missing`과 `Not required`를 명확히 구분
  - 승인 판단 증빙은 Approval Queue의 immutable snapshot을 단일 진실원으로 유지

### P2-5. 명령 보드가 큐 탐색기처럼 보이지만 클릭할 수 없고 범위가 모호하다

- 위치: `refund-command-board-section.tsx:41-60`
- 현재: Queue 필터는 `selectedTotal`에만 적용되고 워크스트림 카드 수치는 Queue 필터를 무시한다.
- 수정:
  - 카드들을 링크로 변경:
    - Approval → `review=requested`
    - Gateway → `review=processing`
    - Reconciliation → `review=state-mismatch`
    - SLA overdue → `review=open&sla=overdue`
    - Oldest → `review=open&sort=oldest`
  - 현재 선택 큐 카드에 active 상태 표시
  - 설명을 `Counts use the selected date, search, age, and SLA scope; queue cards remain mutually exclusive navigation.`처럼 명확히 함

### P2-6. 추가 필터 제목이 붙어 보이고 핵심 SLA 필터의 발견성이 낮다

- 위치: `refund-filter-board-section.tsx:138-140`, `globals.css:25778-25784`
- 현재: `More filtersAge and SLA`
- 수정:
  - summary 내부를 `display:flex; gap:8px;`로 명시
  - 문구 `More filters · Age and SLA`
  - 활성 개수 badge 제공: `2 active`
  - 현재처럼 전 backlog가 overdue인 경우 명령 보드의 SLA 카드를 바로가기 링크로 만들어 숨겨진 메뉴 의존도를 낮춤

### P2-7. 내부 source 코드가 운영자 문구로 그대로 노출된다

- 위치: `refunds-table-section.tsx:99-100`, `page.tsx:245`
- 사례: `UNMATCHED_BOOKING_CLOSE`
- 수정:
  - 사용자 문구 매핑: `Created while closing an unmatched booking`
  - raw code는 tooltip, 복사 메뉴, 상세 checklist에만 보조 정보로 유지
  - `Not recorded`는 `Legacy request — source not recorded`처럼 조치 맥락을 포함

### P2-8. 브라우저 문서 제목이 없다

- 확인 결과: `document.title === ""`; 브라우저 탭은 URL로 대체 표시
- 수정:
  - Refunds route metadata에 `title: 'Refunds | HANDS Admin'`
  - 필요하면 description도 현재 운영 문구와 맞춤
- 영향: 여러 금융 탭을 동시에 여는 운영자가 탭을 식별하기 어렵고 보조기술의 문서 식별도 약해진다.

---

## 6. P3 — 정리와 완성도

### P3-1. 전체 ID 확인·복사가 어렵다

- 목록은 `shortId()` 8자리만 보여 준다.
- 짧은 표시는 유지하되 Refund/Booking/Payment 전체 ID를 tooltip 또는 copy button으로 제공한다.

### P3-2. 사용되지 않는 이전 체크리스트 컴포넌트가 남아 있다

- 파일: `apps/admin_web/app/refunds/refund-decision-checklist-section.tsx`
- 현재 페이지에서 import되지 않고 spec만 존재한다.
- 현재 inline readiness checklist가 최종 설계라면 파일·spec을 제거한다. 반대로 이 컴포넌트를 재사용할 계획이면 중복 표현을 없애고 한 패턴으로 통일한다.

### P3-3. 이전 `.refunds-table-card` CSS가 남아 있다

- 위치: `globals.css:16261-16299`
- 현재 Refunds 표는 `.refund-cases-panel`과 `.refund-table-scroll`을 사용한다.
- 실제 참조가 없음을 전체 검색으로 확인한 후 이전 selector를 제거한다.

---

## 7. 권장 최종 화면 구조

### 상단: Current refund work

- 클릭 가능한 5개 카드
- Approval required / Gateway processing / Reconciliation required / SLA overdue / Oldest open
- 현재 큐 active 표시
- Updated, Refresh, Approval Queue는 오른쪽 보조 작업

### 필터: 한 줄 우선 작업

- Search
- Queue
- Range
- Sort
- Apply
- Reset
- 그 아래: 활성 필터 chip + `More filters · Age and SLA` + 활성 개수

Age와 SLA는 접힌 메뉴에 유지할 수 있지만, 명령 카드에서 바로 접근 가능해야 한다.

### 사례 표: 한 건 한 행

권장 6열:

1. Stage / age / created / refund ID
2. Customer / booking
3. Amount / payment
4. Reason / source
5. Readiness / blocker
6. Owner / next action

- 상태명은 한 번만 표시
- `2/5 ready` 자체가 체크리스트 toggle
- 체크리스트는 선택한 한 건만 full-width로 열기
- 세로 중첩 스크롤 제거
- primary action은 정확한 대상 ID를 보존

### 페이지 책임 분리

| 페이지 | 책임 |
|---|---|
| `/refunds` | 환불 triage, 검색, 큐 분류, 읽기용 준비도 |
| Approval Queue | maker-checker 승인/거절, immutable decision evidence |
| Payment detail | 결제 lifecycle·gateway timeline·현재 허용 행동 |
| Refund reconciliation focus | refund/payment/booking 상태 차이와 복구·escalation |
| Finance Closeout | settlement snapshot/earning 복구 전용 |

Refunds에 승인 버튼을 직접 추가하지 말고, 정확한 focus handoff를 완성하는 것이 올바른 방향이다.

---

## 8. 성능·신뢰성 검증

### 확인된 개선

- 페이지는 `queue-meta`와 목록 API를 `Promise.all`로 병렬 호출한다.
- 기본 화면 기준:
  - Queue meta: SLA policy 읽기 + 단일 집계 SQL
  - Refund list: 단일 Prisma `findMany`
  - 총 DB 읽기 약 3회 구조
- 이전 14–15개 집계 쿼리 구조보다 크게 좋아졌다.
- 워밍 상태 브라우저 표본 6회:
  - 기본: 326ms, 334ms
  - Approval required: 322ms, 322ms
  - 정확 ID 검색: 352ms, 322ms
- 브라우저 콘솔 오류: 0건
- 가로 문서 overflow: 없음 (`scrollWidth === clientWidth === 1425`)

### 남은 성능 관찰점

- 검색은 여러 필드에 `%query%` ILIKE를 사용한다. 현재 151건에서는 문제가 없지만 데이터가 커지면 trigram/index 또는 exact-ID fast path를 검토한다.
- `page=999`는 meta와 불필요한 큰 skip 목록을 함께 읽은 뒤 redirect한다. 드문 방어 경로이므로 현재는 허용 가능하지만, 운영 데이터 규모가 커지면 계측한다.
- 성능 결론은 로컬 워밍 환경의 제한된 표본이다. 운영 네트워크·운영 DB p95를 대신하지 않는다.

---

## 9. 접근성·의미 구조 검증

### 잘된 점

- H1 1개(`Refunds`), H2 3개(`Current refund work`, `Refund queue`, `Cases`)로 제목 구조가 정상이다.
- Search, Queue, Range, Sort 모두 연결된 label이 있다.
- 표 스크롤 영역은 `role="region"`, `aria-label="Refund cases table"`, `tabIndex=0`을 제공한다.
- 이름 없는 링크·버튼·summary는 발견되지 않았다.
- `<details>/<summary>` 기본 의미 구조와 Escape 닫기 지원이 있다.

### 제한

- Review checklist 외부 링크가 disclosure 상태와 연결되지 않아 의미 구조의 장점을 실제 동작에서 잃는다.
- 다크 테마 대비는 시각 검토만 했으며 정량 대비 비율을 측정하지 않았다.
- 본 보고서는 전체 WCAG 적합성 인증이 아니다.

---

## 10. 코드·자동 검증 결과

### 테스트

실행 명령:

```text
npm run test --workspace @massage-vn/admin-web -- app/refunds/page.spec.tsx app/refunds/refund-command-board-section.spec.tsx app/refunds/refund-filter-board-section.spec.tsx app/refunds/refunds-table-section.spec.tsx
```

- 4 test files 통과
- 14 tests 통과

```text
npm run test --workspace @massage-vn/api -- src/admin/admin-refund-queue.spec.ts
```

- 1 test file 통과
- 9 tests 통과

### Impeccable 정적 detector

- 대상: Refunds page/components + `globals.css`
- detector 결과: 6개 `side-tab` 경고
- 검증 결과: 모두 Refunds가 아닌 다른 selector(`vietnam-map`, `marketing`, `booking`, `dispatch`, `timeline`, `ops-check-item`)에서 발생한 범위 외 false positive
- Refunds selector에서 detector가 확정한 anti-pattern: 0건
- 다만 detector가 잡지 못하는 실제 동작 오류, 중첩 스크롤, 문구·도메인 인계 문제는 본 브라우저 감사에서 별도로 확인했다.

---

## 11. 구현 우선순위

### 1차 — 운영 경로 완성

1. Approval Queue exact `requestId` 조회·포커스 계약 추가
2. Refunds `Review decision`에 refund ID와 returnTo 전달
3. State mismatch를 Settlement Repair가 아닌 정확한 refund focus로 연결
4. Payment detail에서 active refund 인지 후 중복 요청 CTA 제거

### 2차 — 표 상호작용 정상화

1. Review checklist를 실제 button disclosure로 변경
2. 선택 행 하나만 detail row 렌더링
3. Refunds 표의 세로 중첩 스크롤 제거
4. 상태 중복 제거, Evidence → Data readiness 변경

### 3차 — 발견성·문구·완성도

1. 명령 보드 카드 링크화 + active 상태
2. `More filters · Age and SLA` 간격·활성 개수
3. source code 운영자 문구 매핑
4. 문서 title 추가
5. exact ID copy, 다크 대비 계측, dead component/CSS 정리

---

## 12. 재검수 합격 기준

- [ ] `Review decision` 한 번으로 선택한 refund가 Approval Queue 첫 화면에 보인다.
- [ ] API take/sort에 상관없이 exact requestId가 반환된다.
- [ ] `Open reconciliation` 도착 화면에 선택 refund/payment/booking 상태 차이와 실제 다음 작업이 보인다.
- [ ] Settlement Repair 0건 화면으로 잘못 이동하지 않는다.
- [ ] `Review checklist`가 클릭·Enter·Space로 실제 열린다.
- [ ] 열린 상태가 `aria-expanded`로 노출되고 Escape로 닫힌다.
- [ ] 1440px에서 페이지와 표의 이중 세로 스크롤이 없다.
- [ ] 닫힌 체크리스트가 건마다 별도 높이를 차지하지 않는다.
- [ ] 각 행의 stage 문구가 한 번만 표시된다.
- [ ] 목록의 `Evidence`가 `Data/Control readiness`로 정확히 표현된다.
- [ ] Command card가 해당 배타적 큐로 이동하고 active 상태를 보여 준다.
- [ ] active refund가 있는 Payment detail에서 새 refund request CTA가 보이지 않는다.
- [ ] 브라우저 탭 제목이 `Refunds | HANDS Admin`으로 표시된다.
- [ ] focused admin 14 tests와 API 9 tests가 계속 통과한다.
- [ ] 1440×900 기본/승인/불일치/오늘 빈 상태/검색/다크 모드 캡처를 다시 비교한다.

---

## 13. 증거 한계

- 현재 로컬 로그인 세션과 현재 로컬 데이터(총 151건)를 기준으로 검사했다.
- 승인·거절·상태 복구 같은 실제 쓰기 작업은 데이터 변경 위험 때문에 실행하지 않았다. 대신 도착 화면, URL 계약, 렌더링 상태와 코드를 검증했다.
- 운영 DB 규모의 query plan, p95/p99, 외부 결제 게이트웨이 응답시간은 검사하지 않았다.
- 다크 모드는 시각 검토이며 정량 contrast audit가 아니다.
- 1024px 이하 화면은 사용자 요청에 따라 검사·평가·보고에서 제외했다.
