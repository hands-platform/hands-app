# HANDS Admin Payments 개선 후 심층 재감사 보고서

- 감사 대상: `http://localhost:3101/payments` 및 결제 상세·확인 흐름
- 감사 일자: 2026-08-09
- 화면 기준: **1440 × 900 이상 데스크톱만 검사**
- 제외 범위: 1024px 이하, 모바일·태블릿·소형 화면 문제는 검사와 보고에서 완전히 제외
- 방식: 로그인된 실제 화면 캡처, 큐·검색·필터·숨김 메뉴·상세·확인 대화상자 점검, 프론트엔드/백엔드 정책 코드 교차 검증, 관련 테스트와 타입 검사
- 안전 제한: 실제 Capture, Release, Refund, Cash settlement 같은 금액 변경 요청은 실행하지 않음

## 1. 최종 결론

이전 감사의 가장 위험했던 문제들은 상당 부분 제대로 고쳐졌다.

- 취소·만료·노쇼 예약에서 Capture가 허용되던 프론트/서버 정책 불일치는 해소됐다.
- 서버가 실행 직전에 결제·예약·증거를 다시 읽고 정책을 재검사한다.
- 목록 행마다 거대한 4단계 정책 지도가 반복되던 구조가 간결한 1행형 테이블로 개선됐다.
- 결제 목록 조회 실패를 빈 목록처럼 보여주지 않고, 금액 액션도 실패를 성공처럼 삼키지 않도록 대부분 개선됐다.
- 검색, 큐, 방법, 결제 상태, 예약 상태, 증거 상태, 기간, 정렬이 URL과 서버 조회에 연결됐다.
- 목록 → 상세 → 확인 → 취소 시 원래 큐와 검색 문맥을 유지한다.
- 다크 테마도 1440px 화면에서 구조적으로 정상이다.

그러나 현재 상태를 **운영 배포 완료**로 판정하기에는 이르다. 특히 다음 세 가지가 핵심이다.

1. 결제 상세의 `Settle cash fee debt`는 서버가 모든 직접 정산 요청을 의도적으로 거부하므로 **성공할 수 없는 버튼**이다.
2. `Release recommended`, `Missing gateway evidence`, `All authorized`가 사실상 같은 370~371건을 반복 노출하고, 한 레코드에 `Sync`와 `Release`가 동시에 추천되어 “지금 무엇을 먼저 해야 하는가”가 모순된다.
3. 정책 후처리 필터를 데이터베이스 페이지네이션 뒤에 적용해, 조건에 따라 페이지 간 중복·누락과 잘못된 총건수가 생길 수 있다.

종합 판정: **13/20, 개선은 뚜렷하지만 금액 운영 화면으로서는 추가 보완이 필요한 상태**

## 2. 감사 건강 점수

| 영역 | 점수 | 판정 근거 |
|---|---:|---|
| 접근성·키보드 | 3/4 | 폼 라벨, 상태 텍스트, 복사 버튼 이름, 대화상자 focus trap/inert 처리는 좋다. 다만 우측 `More` 메뉴가 잘리고 Escape 후 초점이 본문으로 사라진다. |
| 성능 | 2/4 | 로컬 실측 큐 전환은 약 647~816ms였지만, Summary가 다수 count와 제한 없는 정책 후보 조회를 매번 수행해 데이터 증가 시 악화될 구조다. |
| 1440px+ 레이아웃 | 2/4 | 페이지 전체 가로 넘침은 없으나 1440px에서 테이블 내부 421px가 숨고 핵심 열과 액션이 가로 스크롤 뒤에 있다. |
| 테마 | 4/4 | 라이트/다크 모두 주요 카드·필터·상태 배지의 구조와 대비가 일관된다. |
| 구현 무결성 | 2/4 | 서버 재검증은 강해졌지만, 추천 액션 중복, 큐 중복, 실패가 확정된 현금 정산 폼, 비원자적 동시 idempotency 문제가 남았다. |
| **합계** | **13/20** | **Acceptable — 주요 운영·데이터 정확성 문제 해결 후 배포 권장** |

> 이 평가는 1440px 이상 데스크톱 환경만 대상으로 하며, 전체 WCAG 준수 인증을 의미하지 않는다.

## 3. 운영 여정별 상태

1. **Payments 진입 — 🟢 양호**  
   제목, 핵심 업무 설명, 네 개 지표, 첫 필터가 명확하게 보인다. 이전보다 첫 화면의 인지 부담이 크게 줄었다.

2. **업무 큐 선택 — 🟡 주의**  
   Queue select와 Quick queues가 모두 동작하고 URL에 상태를 남긴다. 그러나 15개 큐가 중복 노출되고 서로 겹치는 레코드가 많아 “어느 큐부터 끝내야 하는가”는 명확하지 않다.

3. **우선 처리 건 식별 — 🔴 불량**  
   Release 큐에서 행의 우선 액션이 Sync로 나타나고, Stale 667건은 모두 Manual review다. 예약 상태와 예외 사유가 첫 화면에 없어 작업 대상을 빠르게 구분하기 어렵다.

4. **행에서 상세·보조 액션 실행 — 🔴 불량**  
   기본 상세 링크와 primary action은 접근 가능하지만, 1440px에서 우측 More가 가로 스크롤 뒤에 있고 펼친 메뉴도 컨테이너에 잘린다.

5. **상세에서 정책·증거 확인 — 🟢 양호**  
   결제 상태, 예약 상태, 증거, 정책 버전, 차단된 Capture 이유가 한 화면에 모였다. 서버 정책과도 일치한다.

6. **금액 액션 확인 — 🟡 주의**  
   사유 입력, focus trap, Escape, fail-closed는 동작한다. 다만 before/after, gateway ref, actor, 평가 시각과 추천 액션 순서가 부족하다.

7. **Cash debt 해소 — 🔴 차단**  
   상세의 직접 정산 폼은 서버 정책상 항상 거부되므로 이 작업은 Payments에서 완료할 수 없다. 올바른 Cash settlements/Partner deposit 증거 흐름으로 연결해야 한다.

## 4. 이전 보고서 대비 개선 완료 여부

| 이전 핵심 지적 | 현재 판정 | 확인 내용 |
|---|---|---|
| 거대한 행 레이아웃과 세로 붕괴 | ✅ 해결 | 10개 행이 간결한 테이블로 정리됐고 문서 높이도 약 2,443px로 크게 줄었다. |
| 취소된 예약 Capture 가능 | ✅ 해결 | 서버와 상세 화면 모두 `COMPLETED`가 아니면 Capture를 차단한다. |
| 프론트와 서버 액션 정책 불일치 | ✅ 핵심 해결 | 공용 `paymentActionDecision`을 서버 실행 직전 다시 평가한다. |
| 금액 액션 오류를 성공처럼 삼킴 | △ 부분 해결 | Capture/Release/Sync/Refund는 `adminPostOrThrow`와 실패 notice를 사용한다. Cash fee debt 정산은 여전히 `adminPost(..., null)`로 실패가 숨겨진다. |
| 목록/상세 이동 시 큐 문맥 손실 | ✅ 해결 | `returnTo`에 `review`, `q`, `sort` 등이 유지된다. |
| API 오류를 빈 목록처럼 표시 | ✅ 해결 | 목록과 합계 실패를 별도 오류 상태로 보여주고 액션을 fail-closed 처리한다. |
| 검색·업무 필터 부족 | ✅ 대부분 해결 | 검색, 방법, 결제·예약·증거 상태, 기간, 정렬이 제공된다. |
| 큐 정보구조와 우선순위 불명확 | ❌ 미해결 | 정확히 중복되는 큐와 거의 동일한 큐가 존재하고, 한 건에 두 추천 액션이 생긴다. |
| 시간 필터 의미 불명확 | ❌ 미해결 | `Range`는 예약 생성일, 정렬·Age·SLA는 예약 수정일인데 UI에 명시되지 않는다. |
| 확인 화면의 사유·증거 부족 | △ 부분 해결 | 사유 입력과 증거 요약은 추가됐다. 전후 상태, gateway ref, actor, 정책 평가 시각은 부족하다. |
| 중복 제출 방지 | △ 부분 해결 | 순차 재시도는 audit receipt로 막지만 동시에 들어온 동일 키 요청을 원자적으로 선점하지 않는다. |

## 5. 화면 증거

### 5.1 기본 화면은 크게 정돈됨

![기본 Capture ready 화면](C:/dev/massage-on-demand-vn/output/payments-post-remediation-reaudit-2026-08-09/01-default-capture-ready-1440x900.jpg)

좋아진 점은 분명하다. 상단을 네 개 운영 지표로 줄였고, 검색과 주요 필터를 첫 화면에 배치했다. 예전처럼 장식성 카드가 작업 화면을 밀어내지 않는다.

### 5.2 Release 큐의 정책 문구와 행의 다음 액션이 충돌

![Release recommended 테이블](C:/dev/massage-on-demand-vn/output/payments-post-remediation-reaudit-2026-08-09/04-release-decision-table-1440x900.jpg)

큐 이름은 `Release recommended`지만 행의 `Next safe action`은 `Sync gateway status`다. 이는 단순 문구 문제가 아니라 정책 모델에서 `SYNC.recommended=true`와 `RELEASE.recommended=true`가 동시에 생기는 결과다.

### 5.3 상세 화면의 안전 차단은 잘 구현됨

![결제 상세 정책 화면](C:/dev/massage-on-demand-vn/output/payments-post-remediation-reaudit-2026-08-09/05-payment-detail-decision-top-1440x900.jpg)

현재 `AUTHORIZED / CANCELLED / Evidence Missing` 상태에서 Capture는 명확히 차단되고 Release는 가능하다. 서버 정책과 화면 정책의 핵심 일치는 확인됐다. 다만 `No verified decision timestamp`와 동시 추천 문제는 남는다.

### 5.4 확인 대화상자는 좋아졌지만 실행 전 정보가 충분하지 않음

![Release 확인 대화상자](C:/dev/massage-on-demand-vn/output/payments-post-remediation-reaudit-2026-08-09/06-release-confirmation-1440x900.jpg)

운영자 사유 12자 이상을 요구하고 현재 예약·증거·금액을 보여주는 점은 좋다. 그러나 `AUTHORIZED → RELEASED`, gateway reference, 실행 주체, 정책 평가 시각, “Sync가 먼저인지 Release가 먼저인지”는 나타나지 않는다.

### 5.5 Stale queue는 667건이지만 조치가 정의되지 않음

![Stale mismatch 상단](C:/dev/massage-on-demand-vn/output/payments-post-remediation-reaudit-2026-08-09/07-stale-mismatch-1440x900.jpg)

실제 첫 행들은 `CASH / PENDING / terminal booking / missing collection evidence`인데 화면에는 예약 상태가 없고 모두 `Manual review / Review detail`로만 나온다. 운영자가 667건을 어떤 기준으로 해소해야 하는지 알 수 없다.

### 5.6 큐 간 중복이 수치로 확인됨

![Missing gateway evidence 큐](C:/dev/massage-on-demand-vn/output/payments-post-remediation-reaudit-2026-08-09/08-missing-gateway-evidence-1440x900.jpg)

- Release recommended: 371건
- All authorized: 371건
- Missing gateway evidence: 370건
- Missing gateway evidence 큐 안의 `Release recommended` 지표: 370건

현재 데이터에서 370건은 동일한 결제들이 두 개 이상의 업무 큐에 반복 노출되는 것으로 확인된다. 운영자는 처리량을 중복으로 인식하게 된다.

### 5.7 완료 이력도 `Manual review / Missing`으로 경고됨

![All payments 이력 행](C:/dev/massage-on-demand-vn/output/payments-post-remediation-reaudit-2026-08-09/11-all-payments-history-table-1440x900.jpg)

이미 `REFUNDED`된 현금 결제가 `Manual review`, `Missing` 경고로 표시된다. 실제로 실행 가능한 액션이 하나도 없다는 이유만으로 `Manual review`가 되는 presenter 로직 때문이다. 이력과 미해결 업무를 구분해야 한다.

### 5.8 숨김 Quick queues는 드롭다운과 중복되고 건수가 없음

![Quick queues 펼침](C:/dev/massage-on-demand-vn/output/payments-post-remediation-reaudit-2026-08-09/12-quick-queues-open-1440x900.jpg)

15개 큐를 Queue select와 Quick queues 양쪽에 반복 노출한다. Quick queues에는 각 큐 건수와 긴급도가 없고, `Quick queuesServer policy decisions`, `HistoryTerminal records`처럼 레이블도 붙어 보인다.

### 5.9 우측 More 메뉴가 스크롤 컨테이너에 잘림

![가로 스크롤 뒤 More 메뉴 잘림](C:/dev/massage-on-demand-vn/output/payments-post-remediation-reaudit-2026-08-09/15-row-more-menu-1440x900.jpg)

1440px에서 테이블 영역은 약 1,065px인데 테이블 최소 너비는 1,360px이다. `More` 열을 보려면 가로 스크롤해야 하고, 펼친 330px 높이 메뉴는 173px 높이의 `overflow:auto` 컨테이너에 잘린다. 첫 항목 일부 외에는 마우스로 확인하기 어렵다.

### 5.10 다크 테마는 유지할 만한 수준

![Release queue 다크 테마](C:/dev/massage-on-demand-vn/output/payments-post-remediation-reaudit-2026-08-09/16-release-recommended-dark-1440x900.jpg)

다크 테마는 카드, 필터, 배지, 내비게이션의 색 체계가 일관된다. 이번 재수정에서 디자인 토큰 기반 구조는 유지하는 것이 좋다.

## 6. 상세 문제 목록

### P0 — 즉시 수정

#### P0-1. `Settle cash fee debt`는 성공할 수 없는 운영 버튼

- 화면 위치: 결제 상세의 현금 부채 정산 폼
- 프론트 코드:
  - `apps/admin_web/app/payments/[id]/page.tsx:385-413`
  - `apps/admin_web/app/payments/actions.ts:75-90`
- 서버 코드: `apps/api/src/admin/admin.service.ts:23962-23979`
- 근거:
  - 상세 페이지는 정산 참조와 메모를 입력받아 `/admin/earnings/:id/mark-paid`를 호출한다.
  - 서버는 `PARTNER_DEPOSIT`이면 “approved Partner deposits must be allocated…” 오류를 던지고, 다른 방식도 “approved evidence” 오류로 전부 거부한다.
  - 프론트는 `adminPost(..., null)`을 사용해 오류를 notice로 전달하지 않는다.
- 운영 영향:
  - 현금 부채가 실제 발생하면 운영자는 화면 지시에 따라 입력해도 절대 완료할 수 없다.
  - 실패 이유가 보이지 않아 재입력·중복 시도·지원 문의가 발생한다.
- 수정 방법:
  1. Payments 상세의 직접 정산 폼과 `settleCashDebt` 서버 액션을 제거한다.
  2. `Cash settlements`의 해당 earning 검토 화면 또는 `/finance-tax/partner-bank-deposits` 증거·승인 흐름으로 이동하는 링크를 제공한다.
  3. 링크 문구는 `Open cash debt review` 또는 `Record Partner deposit evidence`로 한다.
  4. 현재 payment/booking/partner/earning ID를 검색 문맥으로 전달한다.
  5. 회귀 테스트로 Payments 상세에 `Settle cash fee debt` POST 폼이 렌더링되지 않는지 검증한다.

### P1 — 배포 전 해결 권장

#### P1-1. 하나의 결제에 추천 액션이 두 개이며 큐 의미가 모순됨

- 코드: `apps/api/src/payments/payment-action-decision.ts:52-60, 190-243`
- 현재 동작:
  - 증거가 없고 provider ref가 있으면 `SYNC`가 `recommended=true`다.
  - 취소된 AUTHORIZED 결제면 `RELEASE`도 동시에 `recommended=true`다.
  - 목록 presenter는 배열에서 먼저 나오는 SYNC를 표시하지만 Release queue는 RELEASE available 여부로 포함한다.
- 운영 영향: 큐는 “Release”를 말하고 행은 “Sync”를 말하므로 운영자는 순서를 판단할 수 없다.
- 수정 방법:
  - 정책 결과에 **단 하나의 `primaryAction`**만 두고 나머지는 `availableActions`로 분리한다.
  - 외부 결제에 verified evidence가 없으면 `SYNC`를 1차 액션, sync 후 여전히 AUTHORIZED+CANCELLED이면 `RELEASE`를 2차 액션으로 정의하는 방식이 가장 안전하다.
  - Release를 즉시 허용해야 하는 사업 규칙이라면 SYNC는 추천이 아니라 보조 액션으로 내려야 한다.
  - 목록, 상세, KPI, 큐 조건은 모두 동일한 `primaryAction/primaryQueue`를 사용한다.

#### P1-2. 상단 KPI가 전체 백로그처럼 보이지만 현재 큐 안에서 다시 계산됨

- 코드:
  - `apps/admin_web/app/payments/payment-page-model.ts:159-170`
  - `apps/api/src/admin/admin.service.ts:14038-14204`
- 화면 근거:
  - Stale queue 667건에서 상단 네 KPI가 모두 0이다.
  - Missing gateway evidence queue에서는 Release recommended가 370으로 바뀐다.
- 운영 영향: 운영자는 “전체 Release backlog가 0”이라고 오해하거나 큐를 이동할 때 KPI가 갑자기 변하는 이유를 이해하기 어렵다.
- 수정 방법:
  - `queueTotal`: 현재 큐·필터의 정확한 총건수
  - `globalActionMetrics`: 현재 기간·디렉터리 필터는 반영하되 `review/age/sla`는 제외한 전체 업무 지표
  - 두 범위를 API와 UI에서 분리한다.
  - KPI에 `All queues · All dates` 같은 scope를 실제로 표시한다.

#### P1-3. 큐가 중복되고 서로 배타적인 업무 바구니가 아님

- 정확한 중복:
  - `callback-review`와 `evidence-conflict`는 서버에서 같은 predicate를 사용한다.
  - UI 설명도 둘 다 callback signature/amount/outcome conflict다.
- 거의 동일한 중복:
  - 현재 `Release recommended 371`, `All authorized 371`, `Missing gateway evidence 370`이다.
- 운영 영향: 한 건이 여러 큐에서 반복되어 실제 미처리 업무량, 담당자 소유권, 완료율을 계산할 수 없다.
- 수정 방법:
  - 1차 업무 큐를 배타적으로 정의한다.
    1. `Evidence repair` — missing/conflict, primary action Sync 또는 증거 수집
    2. `Money actions` — Capture/Release/Refund request가 실제 primary action인 건
    3. `Cash operations` — Active collection/Cash debt
    4. `Lifecycle exceptions` — 데이터·상태 수리
    5. `History` — 완료 이력과 전체 검색
  - `Unverified callback attempts`와 `Gateway evidence mismatch` 중 하나를 제거한다. 시도 단위 분석이 필요하면 결제 큐가 아니라 callback ledger로 별도 제공한다.
  - `All authorized`는 History가 아니라 진단용 Saved filter로 내린다.

#### P1-4. Stale mismatch 667건이 조치 불가능한 수동 검토로 남음

- 코드: `apps/api/src/admin/admin.service.ts:43390-43407, 43575-43589`
- 현재 하나의 큐에 섞인 유형:
  - terminal booking + CASH/PENDING
  - COMPLETED booking + AUTHORIZED지만 Capture 불가
- 화면 문제:
  - 예약 상태 열이 없다.
  - 모두 `Manual review`와 `Review detail`만 제공한다.
  - 소유자, 예외 이유, 다음 업무 화면이 없다.
- 수정 방법:
  - `Terminal cash cleanup`과 `Completed authorization blocked`를 분리한다.
  - 행에 `Booking state`, `Exception reason`, `Age`, `Owner`, `Next workspace`를 표시한다.
  - 현금 terminal row는 Cash settlements/booking outcome repair로, completed authorization은 Sync/evidence repair로 연결한다.
  - 액션이 없는 과거 terminal 현금 레코드는 업무 큐에서 제거하고 History로만 남긴다.

#### P1-5. 1440px에서 핵심 열과 More 액션이 숨고 드롭다운이 잘림

- CSS:
  - `apps/admin_web/app/globals.css:132-140`
  - `apps/admin_web/app/globals.css:1522-1534`
  - `apps/admin_web/app/globals.css:22326-22339`
- 실측:
  - 컨테이너 약 1,065px, 테이블 약 1,486px, 우측 약 421px 숨김
  - 메뉴 약 330px 높이, 스크롤 컨테이너 약 173px 높이
- 운영 영향:
  - `Last booking change`와 `More`를 보려면 매 행마다 가로 스크롤해야 한다.
  - 펼친 메뉴의 대부분이 잘려 실제 옵션을 확인할 수 없다.
- 수정 방법:
  - 1440px에서 테이블이 콘텐츠 영역 안에 들어오도록 열을 6개 이하로 재구성한다.
  - `Payment/Booking`, `Customer/Partner`, `Method/Amount`, `Payment+Booking state`, `Evidence+Updated`, `Action`을 권장한다.
  - `Booking state`는 반드시 state 열에 넣는다.
  - Action 열을 우측 sticky로 두거나 메뉴를 portal/fixed popover로 렌더링한다.
  - 더 안전한 방법은 행의 primary action 1개와 `Open detail`만 표시하고, 차단된 네 액션은 상세의 정책 지도로 이동시키는 것이다.

#### P1-6. 정책 후처리와 offset 페이지네이션 순서 때문에 중복·누락 가능

- 코드: `apps/api/src/admin/admin.service.ts:13980-14035`
- 현재 순서:
  1. DB에서 `skip` 적용
  2. 요청 크기의 최대 4배 조회
  3. 메모리에서 canonical policy 필터
  4. requestedTake만 slice
- 문제 예시:
  - 1페이지가 첫 40개 후보 안에서 10개 eligible을 골랐어도, 2페이지는 후보 10개만 건너뛰므로 1페이지에서 이미 사용한 후보를 다시 포함할 수 있다.
  - `totalCount`는 broad SQL predicate를 세어 실제 eligible count와 다를 수 있다.
- 수정 방법:
  - 최선: DB에서 조회 가능한 `primaryQueue/decision state`를 저장 또는 SQL로 계산해 정확한 WHERE/count/offset을 사용한다.
  - 대안: 안정된 cursor를 사용해 정책 필터 후 페이지를 채우고, 다음 cursor를 반환한다. 숫자 페이지 총수는 정확한 count 없이는 표시하지 않는다.
  - 테스트에 eligible/ineligible이 교차하는 3페이지 데이터를 넣어 중복·누락·총건수를 검증한다.

#### P1-7. Summary가 확장성에 불리한 다중 쿼리와 무제한 후보 로드를 수행

- 코드: `apps/api/src/admin/admin.service.ts:14064-14175`
- 확인 내용:
  - payment count 12회, callback count 2회, refund count 1회, action candidate findMany 1회, Age count 추가 호출을 한 화면마다 수행한다.
  - `actionCandidates.findMany`에는 take 제한이 없다.
  - Payments 페이지는 목록과 summary를 동시에 별도 호출한다.
- 현재 로컬 실측: Release 약 647ms, All payments 약 816ms, Stale 약 815ms
- 운영 영향: 현재는 참을 수 있어도 결제·callback 데이터가 증가하면 페이지 지연과 DB 부하가 선형으로 늘 수 있다.
- 수정 방법:
  - queue count를 한 번의 조건부 집계 SQL/CTE로 반환한다.
  - canonical decision을 DB에서 필터 가능한 상태로 만들거나 필요한 집계만 SQL로 계산한다.
  - summary 응답에 `queueCounts`, `globalMetrics`, `generatedAt`를 명시한다.
  - API budget 테스트에 쿼리 수와 최대 후보 행 수를 추가한다.

#### P1-8. 동일 idempotency key의 동시 요청은 원자적으로 차단되지 않음

- 코드: `apps/api/src/payments/payments.service.ts:1388-1432`
- 현재 보호: 먼저 audit log에서 receipt를 조회한 뒤 액션 실행 후 receipt를 쓴다.
- 남은 위험: 동시에 들어온 두 요청은 둘 다 receipt가 없다고 판단해 gateway 호출에 진입할 수 있다.
- 테스트 상태: 순차 재요청 한 번만 실행되는 테스트는 있으나 `Promise.all` 동시 요청 테스트는 없다.
- 수정 방법:
  - `(paymentId, idempotencyKey)` unique 제약을 가진 action claim/receipt 레코드를 먼저 원자적으로 생성한다.
  - 실행 중, 성공, 실패 상태와 receipt를 같은 레코드에 저장한다.
  - payment row lock 또는 transaction/advisory lock으로 동일 payment 금액 액션을 직렬화한다.
  - 동시 2~10회 호출 테스트에서 gateway adapter가 정확히 한 번만 호출되는지 검증한다.

### P2 — 다음 개선 배치에서 해결

#### P2-1. 이력 행을 `Manual review`와 경고성 `Missing`으로 표시

- 코드: `apps/admin_web/app/payments/payment-page-presenters.tsx:24-45`
- 원인: 추천 가능한 액션이 없으면 상태와 무관하게 `Manual review`로 표시한다.
- 수정 방법:
  - `REVIEW_REQUIRED`가 있을 때만 `Manual review`
  - terminal payment이면 `No action · History`
  - 완결된 기록의 비필수 과거 증거 누락은 중립 `Not recorded`로 표시하고 업무 큐에는 포함하지 않는다.

#### P2-2. 예약 상태가 행에 없어 큐 근거를 판단하기 어려움

- 코드에는 `bookingStatus`가 row model에 있지만 테이블에서 사용하지 않는다.
- 수정 방법: `Payment state` 셀에 payment와 booking 상태를 위아래로 함께 표시한다. Release/Stale/Capture 모두 예약 상태가 정책의 핵심이다.

#### P2-3. Range, Age, SLA가 서로 다른 시간 기준을 사용하지만 설명이 없음

- `Range`: booking.createdAt
- `Sort`, `Last booking change`, `Age`, `SLA`: booking.updatedAt
- 수정 방법:
  - `Range` → `Booking created`
  - `Last booking change` → `Booking updated`
  - `Age` → `Idle since booking update`
  - authorized 큐에서만 `Authorization hold SLA`를 표시한다.
  - `Age and SLAOptional` 대신 현재 큐에 맞는 동적 제목을 쓴다.

#### P2-4. Quick queues와 Queue select가 중복되며 건수·긴급도가 없음

- 15개 옵션을 두 군데에서 반복한다.
- select 폭 때문에 `Release recomme…`, `Unverified callba…`처럼 잘린다.
- 수정 방법:
  - 상단에 실제 업무량이 있는 3~5개 primary queue를 건수와 함께 노출한다.
  - 빈 큐는 `More queues`에서만 보이도록 한다.
  - History는 별도 secondary selector로 분리한다.
  - Queue select와 Quick queues 중 하나만 주 탐색으로 남긴다.

#### P2-5. 확인 대화상자 정보와 초점 복귀가 미완성

- 좋은 점: alertdialog, aria-modal, inert, Tab 순환, Escape 닫기가 동작한다.
- 미완성:
  - Escape 후 초점이 원래 Release 링크가 아니라 `<body>`로 이동한다.
  - 전후 상태, gateway ref, actor, policy evaluatedAt가 없다.
  - 금액 표기가 목록 `300.000 VND`, 모달 `300,000 VND`로 다르다.
- 수정 방법:
  - `Before: AUTHORIZED / After: RELEASED` 구조를 추가한다.
  - 동일 공용 VND formatter를 사용한다.
  - 라우트 기반 모달을 유지한다면 `returnFocus=payment-{id}` 또는 hash로 원래 trigger를 다시 focus한다.

#### P2-6. 정책 평가 시각과 증거 검증 시각이 혼재됨

- 상세에 `No verified decision timestamp`가 반복된다.
- `verifiedAt`은 evidence 시각일 뿐 decision 계산 시각이 아니다.
- 수정 방법: API에 `evaluatedAt`, `bookingUpdatedAt`, `evidenceVerifiedAt`을 분리해 반환하고 화면에 `Policy evaluated`와 `Evidence verified`로 각각 표시한다.

#### P2-7. 숨김 레이블과 문구가 붙고 빈 상태 문장이 어색함

- `Quick queuesServer policy decisions`
- `Age and SLAOptional`
- `All action decisions4 policy checks`
- `No payments currently match this queue. payments with...`
- 수정 방법:
  - summary의 `<span>`과 `<small>`에 실제 gap/구분자를 적용한다.
  - 빈 상태는 큐별 완전한 문장으로 작성한다.
  - `payment(s)` 대신 1건/복수에 맞는 영문 또는 일관된 `payments`를 사용한다.

#### P2-8. 브라우저 문서 제목이 비어 있음

- 현재 `document.title === ''`
- 수정 방법: Payments 목록과 상세에 Next metadata를 추가한다.
  - `Payments | HANDS Admin`
  - `Payment cmpfrunp | HANDS Admin`

## 7. 권장 화면 구조

### 7.1 상단 구조

1. 제목: `Payments`
2. 범위 설명: `Gateway, wallet, and cash payment exceptions requiring operator action`
3. 전역 액션 지표: Evidence repair / Capture ready / Release ready / Cash debt
4. 각 지표에 명시적 scope: `All queues · All dates`

### 7.2 업무 큐 구조

| 대분류 | 1차 큐 | 포함 조건 | 주 액션 |
|---|---|---|---|
| Evidence repair | Missing evidence | external gateway + missing verified evidence | Sync / collect evidence |
| Evidence repair | Evidence conflict | invalid signature, amount, outcome | Investigate callback |
| Money actions | Capture ready | completed + verified + capturable | Capture |
| Money actions | Release ready | terminal non-capture + evidence policy complete | Release |
| Money actions | Refund review | captured + refund evidence | Send to approval |
| Cash operations | Active collection | active booking + cash pending | Track collection |
| Cash operations | Cash debt | negative partner wallet + unsettled | Open cash settlement |
| Lifecycle repair | Terminal cash cleanup | terminal booking + stale cash state | Repair outcome |
| Lifecycle repair | Completed auth blocked | completed + authorized + capture blocked | Repair evidence/state |
| History | Completed payments | captured/released/refunded | Read-only review |

원칙은 “한 결제 = 하나의 primary work queue”다. 다른 특성은 filter 또는 secondary tag로 표현한다.

### 7.3 1440px 테이블 권장 열

| 열 | 내용 |
|---|---|
| Payment / Booking | 짧은 ID, 복사, 상세 링크 |
| Customer / Partner | 운영 식별 정보 |
| Method / Amount | 결제 방법과 금액 |
| Current state | Payment 상태 + Booking 상태 |
| Decision / Evidence | primary action, 근거, evidence 상태, updated age |
| Action | primary action 또는 Open detail; 우측 sticky |

`Last booking change`와 gateway ref는 Decision/Evidence 안에서 1~2줄로 축약하고 전체값은 tooltip 또는 상세에 둔다.

## 8. 코드 수정 우선순위

### 단계 A — 안전성과 운영 불능 제거

1. Payments 상세의 직접 Cash debt 정산 POST 폼 제거
2. 단일 primaryAction/primaryQueue 정책 도입
3. 동시 idempotency claim을 DB unique 레코드로 원자화

### 단계 B — 데이터 정확성과 성능

1. 정책 필터와 페이지네이션 순서 수정
2. 정확한 queue total과 global metrics 분리
3. 중복 count를 조건부 집계로 통합
4. 제한 없는 action candidate 로드 제거

### 단계 C — 운영 정보구조와 1440px 테이블

1. 중복 callback queue 제거
2. Release/Missing/Authorized 관계를 primary queue와 diagnostic filter로 정리
3. Stale queue를 두 개의 조치 가능한 큐로 분리
4. 1440px에서 가로 스크롤 없이 핵심 열과 Action 표시
5. 메뉴 clipping 제거

### 단계 D — 문구·접근성·마감

1. 시간 기준 라벨 명시
2. 완료 이력의 `Manual review/Missing` 경고 제거
3. 확인 화면 전후 상태·gateway ref·actor·평가 시각 추가
4. Escape 후 focus 복귀
5. 레이블 간격, 빈 문장, 금액 포맷, document title 정리

## 9. 완료 조건

다음 조건을 모두 만족해야 이번 Payments 개선을 완료로 판정할 수 있다.

- [ ] Cash debt 화면에서 성공할 수 없는 `mark-paid` 직접 폼이 존재하지 않는다.
- [ ] 어떤 결제도 동시에 두 개의 `recommended=true` 액션을 갖지 않는다.
- [ ] 각 결제는 하나의 primary work queue에만 속한다.
- [ ] `callback-review`와 `evidence-conflict` 중복이 제거된다.
- [ ] 상단 KPI scope가 명시되고 큐를 바꿔도 의미가 바뀌지 않는다.
- [ ] 목록 총건수와 각 페이지가 동일 canonical predicate를 사용한다.
- [ ] 페이지 1~N 사이 결제 ID 중복·누락 회귀 테스트가 통과한다.
- [ ] 동일 idempotency key 동시 요청에서 gateway adapter가 한 번만 호출된다.
- [ ] 1440px에서 Payment, Booking state, Next action, Action을 가로 스크롤 없이 볼 수 있다.
- [ ] More 메뉴가 테이블 overflow에 잘리지 않는다.
- [ ] terminal history가 `Manual review`로 표시되지 않는다.
- [ ] `Range`, `Age`, `SLA`, timestamp의 기준 필드가 화면에 명시된다.
- [ ] 확인 대화상자에 before/after, evidence, actor, gateway ref, policy evaluatedAt가 표시된다.
- [ ] Escape/Cancel 후 원래 액션 trigger로 focus가 복귀한다.
- [ ] Payments 목록·상세의 `document.title`이 설정된다.

## 10. 검증 결과

### 화면·상호작용

- 1440×900 라이트·다크 확인
- Capture ready, Release recommended, Active cash, Stale mismatch, Missing gateway evidence, Callback review, All authorized, All payments 확인
- 검색 1건 결과와 `returnTo` 문맥 유지 확인
- 상세 정책 차단, Release 확인 대화상자, Tab focus trap, Escape 닫기 확인
- 실제 금액 변경 버튼은 제출하지 않음

### 자동 검증

- Admin Payments 테스트: **12 files / 57 tests 통과**
- API payment 관련 필터 테스트: **49 tests 통과**
- Payment decision/service/controller 관련 테스트: 통과
- Admin web typecheck: 통과
- API typecheck: 통과
- 더 넓은 선택 API 테스트: 806개 중 804개 통과, 2개 실패
  - 실패 2개는 Payments가 아니라 monthly tax closing 기대값/정산 delta 테스트로 확인됨
  - Payments 회귀로 보이지 않지만 현재 브랜치 전체 테스트가 완전한 green은 아님

### Impeccable deterministic scan

- Payments TSX/confirmation/globals CSS 대상으로 1회 실행
- Payments 전용 코드에서 직접적인 detector 위반은 나오지 않음
- `globals.css`의 다른 페이지용 side-tab 스타일 6건만 탐지됐으며 이번 Payments 화면과 무관한 false positive/out-of-scope로 판정

## 11. 유지해야 할 좋은 구현

- 서버 실행 직전 결제·예약·증거를 재조회해 canonical policy를 재평가하는 구조
- `COMPLETED`가 아닌 예약 Capture 차단
- gateway reference 및 verified callback을 증거 요약으로 분리한 구조
- reason, idempotency key, audit receipt를 금액 액션에 포함한 구조
- API 오류 시 빈 상태가 아니라 명시적 오류와 재시도를 제공하는 fail-closed UI
- ID 축약 + 복사 버튼 + 전체 title 제공
- 목록 문맥을 `returnTo`로 유지하는 링크 생성
- callback payload 민감 키 redaction
- 공용 토큰 기반 라이트/다크 테마
- 이전보다 훨씬 간결해진 1행형 운영 테이블

## 12. 최종 판정

현재 Payments는 **외형과 기본 안전성은 확실히 개선됐지만, 큐 정의와 데이터 정확성, Cash debt 실제 운영 경로까지 완성된 상태는 아니다.**

가장 먼저 실패가 확정된 Cash debt 폼을 제거하고, 그 다음 `primaryAction/primaryQueue`를 단일화해야 한다. 이 두 작업이 끝나야 운영자가 숫자와 “다음 안전한 조치”를 신뢰할 수 있다. 이후 페이지네이션·Summary 쿼리·1440px 테이블을 정리하면 Payments는 실운영 수준에 가까워진다.
