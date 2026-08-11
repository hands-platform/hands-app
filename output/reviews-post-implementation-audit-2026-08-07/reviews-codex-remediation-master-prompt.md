# Codex 실행 프롬프트 — Customer Reviews 최종 운영 개선

아래 내용을 Codex의 새 작업에 그대로 붙여 넣어 사용한다.

---

## 역할과 최종 목표

너는 `C:\dev\massage-on-demand-vn`의 관리자 웹을 개선하는 시니어 제품 엔지니어다.

`http://localhost:3101/reviews` Customer Reviews 화면을 실제 운영자가 다음 업무를 빠르고 안전하게 수행할 수 있는 상태로 수정하라.

- 전체 리뷰와 상태별 큐를 즉시 파악
- 고객·파트너·예약·리뷰 내용을 빠르게 식별
- 검색·기간·정렬 조건을 혼동 없이 적용
- Visible / Needs review / Hidden 상태를 안전하게 변경
- 관리자 작성 리뷰만 정책에 맞게 편집
- 변경 사유와 감사 증거를 보존
- 1440px 이상 화면에서 목록을 최대한 빨리 확인

계획이나 제안서만 작성하고 끝내지 말고, 현재 코드와 화면을 먼저 다시 검증한 뒤 안전하게 구현 가능한 요구사항을 실제 코드로 수정하고 테스트하라.

## 단일 기준 문서와 증빙

다음 보고서를 구현 기준으로 사용한다.

- `C:\dev\massage-on-demand-vn\output\reviews-post-implementation-audit-2026-08-07\reviews-post-implementation-deep-audit.md`

같은 폴더의 화면 증빙:

- `01-reviews-top-1440.jpg`
- `02-reviews-table-1440.jpg`
- `03-review-action-menu-1440.jpg`
- `04-needs-review-empty-1440.jpg`
- `05-needs-review-empty-detail-1440.jpg`
- `06-hidden-reviews-top-1440.jpg`
- `07-hidden-reviews-table-1440.jpg`
- `08-hidden-action-menu-1440.jpg`
- `09-custom-dates-no-fields-1440.jpg`
- `10-reviews-top-1600.jpg`
- `11-reviews-table-1600.jpg`
- `12-reviews-top-dark-1440.jpg`
- `13-hide-confirmation-1440.jpg`

보고서의 줄 번호는 코드 변경으로 달라질 수 있으므로 파일명·함수명·데이터 흐름을 기준으로 다시 확인한다. 보고서의 추정이 현재 코드와 다르면 실제 재현 결과와 코드 증거를 우선하되, 차이를 최종 보고에 기록한다.

## 화면 범위

검사하고 최적화할 viewport:

- 1440×900
- 1600×900

명시적 제외:

- 1024px 이하 화면
- 모바일·태블릿 레이아웃
- 작은 화면용 카드 변환
- 1024px 이하 반응형 회귀 보고

**1024px 이하 화면을 구현 목표, 테스트 기준, 스크린샷, 최종 보고에 포함하지 마라.**

## 작업 시작 전 필수 절차

1. `C:\dev\massage-on-demand-vn`에서 작업한다.
2. 저장소 루트와 대상 하위 경로의 `AGENTS.md` 또는 `AGENTS.override.md`를 모두 확인한다.
3. `git status --short`와 관련 파일 diff를 확인한다.
4. 현재 dirty worktree와 사용자의 기존 변경을 보존한다.
5. 보고서와 13개 증빙 이미지를 직접 연다.
6. 로그인된 in-app browser에서 `/reviews`를 1440×900으로 다시 확인한다.
7. 아래 대상 파일과 관련 호출자·테스트를 읽고 실제 데이터 흐름을 추적한다.
8. 기존 관리자 컴포넌트·토큰·폼·drawer·focus·URL 생성 패턴을 먼저 검색해 재사용한다.

## 반드시 먼저 읽을 코드

Admin Web:

- `apps/admin_web/app/reviews/page.tsx`
- `apps/admin_web/app/reviews/review-page-model.ts`
- `apps/admin_web/app/reviews/reviews-table-section.tsx`
- `apps/admin_web/app/reviews/review-page-actions.ts`
- `apps/admin_web/app/reviews/review-action-confirmation.ts`
- `apps/admin_web/app/reviews/review-row-actions.tsx`
- `apps/admin_web/app/reviews/actions.ts`
- `apps/admin_web/app/reviews/export/route.ts`
- `apps/admin_web/components/confirm-dialog.tsx`
- `apps/admin_web/components/confirm-dialog-focus-boundary.tsx`
- `apps/admin_web/components/use-admin-modal-focus.ts`
- `apps/admin_web/components/client-action-dropdown.tsx`
- `apps/admin_web/components/admin-form-controls.tsx`
- `apps/admin_web/components/admin-segmented-control.tsx`
- `apps/admin_web/components/admin-page-template.tsx`
- `apps/admin_web/components/admin-surface.tsx`
- `apps/admin_web/app/globals.css`
- `apps/admin_web/lib/admin-api.ts`

API:

- `apps/api/src/admin/admin-review.routes.ts`
- `apps/api/src/admin/admin.dto.ts`
- `apps/api/src/admin/admin.service.ts`
- Prisma `Review` 모델은 읽기만 하고 현재 요구사항을 스키마 변경 없이 해결할 수 있는지 먼저 확인한다.

Tests:

- `apps/admin_web/app/reviews/**/*.spec.ts`
- `apps/admin_web/app/reviews/**/*.spec.tsx`
- `apps/api/src/admin/admin.service.spec.ts`
- `apps/api/src/admin/admin.controller.spec.ts`
- `apps/api/src/admin/admin.dto.spec.ts`

## 구현 원칙

1. 운영자의 판단 속도와 오류 방지를 디자인 기준으로 삼는다.
2. 새 UI·상태관리·날짜 라이브러리를 추가하지 않는다.
3. 기존 `AdminFormSelect`, `AdminFormDate`, `AdminDrawerSurface`, `AdminDrawerBackdropButton`, `useAdminModalFocus`, 상태 배지와 토큰을 우선 재사용한다.
4. 이 화면 하나를 위해 새 디자인 시스템, 범용 factory, 새 상태 계층을 만들지 않는다.
5. URL 정규화, moderation service처럼 여러 경로가 공유하는 근본 원인을 수정한다.
6. UI 가드만 믿지 말고 고객 원문 보호, 사유 필수, 상태 전환, 감사 로그를 서버에서도 검증한다.
7. `var(--admin-disabled)`는 실제 비활성 UI에만 사용한다.
8. 실제 운영 리뷰에 Hide, Publish, Needs review, Edit를 제출하지 않는다.
9. mutation 검증은 테스트 fixture 또는 명시적으로 폐기 가능한 로컬 데이터에서만 수행한다.
10. 관련 없는 파일, 사용자 변경, 생성 파일을 되돌리거나 대량 포맷하지 않는다.
11. Prisma schema/migration은 이번 작업에서 변경하지 않는다. 정말 불가피하면 먼저 중단하고 이유와 최소 대안을 보고한다.
12. 기존에 정상화된 전체 기간, 상태 모델, 고객 원문 불변성, 전체 CSV, returnTo 보안을 회귀시키지 않는다.

## 반드시 보존해야 하는 현재 정상 동작

- `/reviews` 기본 범위는 `All dates`
- `Visible = PUBLISHED`, `Needs review = REPORTED`, `Hidden = HIDDEN`
- 상태와 고객 앱 노출 여부를 구분해 표시
- 고객 작성 리뷰에는 Edit Review가 없음
- 고객 작성 rating/comment 수정은 API에서도 거부
- 관리자 작성 리뷰 수정에는 edit reason 필수
- moderation audit에 before/after/actor/timestamp/reason 기록
- Published 재전환 시 현재 reportReason 정리
- 파트너 평점 집계는 PUBLISHED 리뷰만 포함
- 행 조치 전에 확인 단계 제공
- confirm/cancel/success에서 안전한 `/reviews` returnTo 보존
- action menu 키보드 이동과 44px hit target
- 서버 페이지네이션
- 100건을 넘는 전체 CSV export 및 중간 실패 감지
- API 실패와 실제 0건을 구분
- 1440px에서 5개 핵심 열과 Actions가 가로 스크롤 없이 표시

## P1 — 가장 먼저 완료할 기능·접근성 결함

### P1-1. Custom dates 진입 결함 수정

현재 흐름:

- `Custom dates` 링크는 `dateRange=custom`과 빈 날짜를 만든다.
- `buildReviewFilters()`가 날짜가 비었다는 이유로 custom을 all로 바꾼다.
- 날짜 입력 UI는 `filters.dateRange === 'custom'`일 때만 렌더링된다.
- 결과적으로 날짜 입력 화면에 진입할 수 없다.

수정 요구:

1. `buildReviewFilters()`가 빈 custom을 `all`로 강제하지 않게 한다.
2. `dateRange=custom`이면 날짜가 비어 있어도 Custom이 활성 상태이고 From/To를 표시한다.
3. 날짜 두 개가 모두 비어 있는 동안 API 범위는 전체 범위로 처리해도 되지만 UI 상태는 Custom으로 유지한다.
4. 한쪽 날짜만 입력하는 열린 범위를 지원한다.
5. From > To이면 목록/요약 API를 호출하지 않고 인라인 오류를 표시한다.
6. 오류 메시지는 입력과 `aria-describedby`로 연결하고 첫 잘못된 입력으로 초점을 이동한다.
7. 날짜 적용 후 q, review, sort, pageSize를 보존하고 page는 1로 초기화한다.
8. `review-page-model.spec.ts`에서 현재 결함을 고정하는 `dateRange=custom → all` 기대값을 제거한다.

필수 테스트:

- 빈 custom을 파싱하면 `dateRange === 'custom'`
- Custom 링크 또는 제어 후 From/To가 실제 렌더링됨
- dateFrom only / dateTo only API 범위
- valid range
- reversed range 오류 및 API 미호출
- 기존 필터 보존

### P1-2. HIDDEN/REPORTED 관리자 작성 리뷰 편집 실패 수정

현재 문제:

- 관리자 작성 리뷰는 상태와 관계없이 편집 UI를 제공한다.
- 편집 폼은 현재 status와 함께 `reportReason=""`을 보낸다.
- API는 HIDDEN/REPORTED 상태이면 reportReason이 없을 때 요청을 거부한다.
- 따라서 비공개 상태의 관리자 작성 리뷰 콘텐츠 편집이 실패할 수 있다.

수정 정책:

1. 콘텐츠 편집과 moderation 상태 전환을 명확히 구분한다.
2. 같은 HIDDEN/REPORTED 상태에서 관리자 작성 리뷰의 rating/comment만 수정하면 기존 reportReason을 보존한다.
3. UI는 현재 reportReason을 빈 문자열로 덮어 보내지 않는다.
4. 새로 HIDDEN 또는 REPORTED로 전환할 때만 새 moderation category를 필수로 한다.
5. 콘텐츠 편집의 edit reason은 계속 필수다.
6. 고객 작성 리뷰 rating/comment 수정 거부는 계속 유지한다.
7. 상태, reportReason, rating, comment의 before/after가 audit log에 정확히 남아야 한다.
8. 실패를 generic catch로만 숨기지 말고 최소한 테스트에서 실제 API 오류 원인을 확인한다.

구현 시 API에서 `existing`을 조회한 뒤 다음을 구분하라.

- state transition
- same-state admin-created content edit
- customer-submitted content edit

비공개 same-state content edit는 기존 reportReason을 유지하고, 비공개 state transition은 명시적 reportReason을 요구한다. 요청이 빈 값을 보냈다는 이유로 저장된 사유를 조용히 지우면 안 된다.

필수 테스트:

- admin-created PUBLISHED 편집 성공
- admin-created HIDDEN 편집 성공 및 기존 reportReason 보존
- admin-created REPORTED 편집 성공 및 기존 reportReason 보존
- 각 편집에서 status 불변
- customer-submitted rating/comment 수정 거부
- 새 HIDDEN/REPORTED 전환은 reportReason 필수
- Published 전환은 현재 reportReason 제거
- audit before/after/reason 검증

### P1-3. 운영 정보 텍스트 대비 수정

현재 측정:

- `.vuexy-review-copy-cell span`: 12px, light theme 대비 2.29:1
- `.vuexy-review-card td small`: 12px, light theme 대비 2.29:1

수정 요구:

1. 서비스명, Admin-created review, moderation reason, app visibility 설명은 disabled 정보가 아니다.
2. 이 텍스트에서 `var(--admin-disabled)` 사용을 제거한다.
3. 기존 `var(--admin-muted)` 또는 현재 디자인 토큰 중 4.5:1을 충족하는 secondary text를 사용한다.
4. 필요하면 13px/18px로 조정한다.
5. light/dark 양쪽에서 실제 computed color와 surface를 기준으로 최소 4.5:1을 확인한다.
6. disabled 버튼·메뉴만 disabled 토큰을 유지한다.

필수 검증:

- 서비스명
- 숨김/Needs review 사유
- `App visible` / `Not visible in app`
- Admin-created review 표식
- light/dark 1440×900

## P2 — 운영 화면 구조 개선

### P2-1. 1440px 필터를 의도적인 작업 구조로 재배치

목표 구조:

```text
Status: [All] [Visible] [Needs review] [Hidden]
Search [........................]  Date [select]  Sort [select]  Rows [select]  [Update list] [Export]
Custom일 때: From [date]  To [date]  [Apply dates]
```

요구사항:

- Status는 핵심 큐이므로 한눈에 보이는 탭/segmented control로 유지한다.
- Date와 Sort는 1440px 높이를 줄일 수 있는 native/select 기반 제어를 우선한다.
- 새 날짜 라이브러리를 추가하지 않는다.
- Custom 선택 후 날짜 입력이 숨겨진 채 멈추지 않게 한다. 선택 즉시 또는 명확한 제출 후 From/To가 보여야 한다.
- Search는 가변 폭을 사용해 1440px에서도 전체 placeholder를 읽을 수 있게 한다.
- `Apply`는 `Update list` 또는 실제 동작을 설명하는 이름으로 변경한다.
- Export는 검색 제출 버튼 아래로 홀로 떨어지지 않게 같은 작업 줄에 둔다.
- 1600px에서는 같은 정보 구조를 유지하고 불필요하게 넓게 흩어지지 않게 한다.

정확한 컴포넌트 분리는 현재 코드의 가장 작은 안전한 구현을 선택하되, 기능이 같은 제어를 중복 만들지 않는다.

### P2-2. 첫 화면에서 실제 리뷰 행을 더 빨리 노출

1440×900에서 다음을 첫 화면 안에 보이게 하는 것을 목표로 한다.

- 페이지 제목
- 상태 큐
- 필터 도구
- 표 머리글
- 최소 첫 번째 리뷰 행의 핵심 정보

수정 방법:

- reviews 페이지의 과도한 header/panel padding을 줄인다.
- 페이지 설명, 필터 설명, 표 설명에서 반복 문구를 제거한다.
- 현재 5개 mini metric strip을 상태 탭 count로 흡수하거나 제거한다.
- 필터 높이를 P2-1 구조로 줄인다.
- 표 자체의 5열 구조와 Actions 접근성은 유지한다.

전역 `AdminPageTemplate`을 무조건 바꿔 다른 페이지에 영향을 주지 마라. reviews에 한정된 class나 이미 있는 compact 패턴을 우선한다.

### P2-3. count 중복과 요약 범위를 정리

현재 기본 화면은 같은 172를 Results, filter result, table result로 반복한다.

최종 의미:

- Status 탭 count: 현재 검색·날짜 범위 안에서 status만 제외한 큐 분포
- Matching count: 검색·날짜·status가 모두 반영된 실제 현재 결과
- Pagination count: 현재 결과의 위치

권장 표시:

- `All 172 / Visible 170 / Needs review 0 / Hidden 2`
- 필터 또는 queue header에 `172 matching`
- 표 카드 우측의 중복 count 제거
- pagination의 `Showing 1 to 10 of 172` 유지
- 상단 `Customer Reviews`와 표의 `Customer reviews` 중복을 줄이고 표 제목은 `Review queue` 사용

데이터 계약:

- pagination에는 모든 현재 필터가 반영된 filtered total이 필요하다.
- 상태 탭 count에는 q/date는 반영하되 현재 status 필터는 제외한 summary가 필요하다.
- 이 두 범위를 하나의 숫자로 혼용하지 않는다.
- 가장 작은 안전한 방법은 filtered summary와 status-excluded queue summary를 명시적으로 구분하는 것이다.

추가 summary 요청을 사용한다면 작은 aggregate 요청만 추가하고, 요청 실패를 0으로 위장하지 않는다. 기존 API 계약을 억지로 범용화하지 않는다.

### P2-4. 확인 UI의 semantics와 실제 동작 통일

현재 ConfirmDialog는 `role="alertdialog"`, `aria-modal="true"`, focus trap을 사용하지만 화면 안의 static 카드이고 배경이 inert하지 않다.

이번 화면의 위험 조치는 실제 modal 또는 drawer 방식으로 통일한다.

요구사항:

- 기존 backdrop/drawer/focus 패턴을 재사용한다.
- 배경을 마우스로 클릭하거나 Tab으로 이동할 수 없게 한다.
- Escape는 안전한 Cancel과 동일하게 동작한다.
- Cancel 후 가능한 경우 원래 행의 action trigger로 초점을 복원한다.
- confirm/cancel/success에서 returnTo와 필터 상태를 유지한다.
- Rating, Review, Customer, Partner, Booking, Current state, Next state, Impact를 유지한다.
- HIDDEN/REPORTED에는 moderation category가 필수다.
- 실제 조치 버튼은 사유가 없으면 submit되지 않는다.
- 현재 shared `ConfirmDialog`를 전역 변경하면 다른 화면에 미치는 영향을 먼저 검색한다. reviews에만 필요한 수정이라면 로컬 wrapper/drawer로 제한한다.

### P2-5. moderation category와 operator note 분리

DB 스키마를 추가하지 말고 기존 입력을 활용한다.

- `reportReason`: 기존 고정 moderation category
- `reason`: `Operator note (optional)`로 입력받아 audit metadata에 저장

요구사항:

- Hide와 Needs review 확인 UI에 optional operator note를 추가한다.
- 기존 `ConfirmDialog.textInputs` 또는 현재 form control을 재사용한다.
- 고정 category는 현재 상태 표시와 분류에 사용한다.
- operator note는 세부 판단 근거와 감사 이력에 사용한다.
- note를 reportReason 문자열에 임의로 합쳐 상태 표에 길게 표시하지 않는다.
- API와 감사 로그가 이미 지원하는 범위를 먼저 활용한다.

### P2-6. 빈 큐 문구를 완성 문장으로 수정

문자열 조각을 이어 붙여 다음과 같은 문장이 나오지 않게 한다.

`No customer reviews currently match this queue. reviews removed from the app...`

상태별 권장 문구:

Needs review:

- Title: `No reviews need moderation`
- Body: `No reviews are currently waiting for a moderation decision. Current date range: {range}.`
- CTA: `View all reviews`

Hidden:

- Title: `No hidden reviews`
- Body: `No reviews are currently hidden from the customer app. Current date range: {range}.`
- CTA: `View all reviews`

Visible:

- Title: `No visible reviews`
- Body: `No reviews currently match the selected filters and date range.`

All + active filters:

- Title: `No reviews match these filters`
- Body에 현재 search/date/status 범위를 짧게 표시
- CTA: `Clear filters`

상태별 완성 문장을 모델 한곳에서 반환하되, 이 화면 하나를 위해 국제화 시스템을 만들지 않는다.

### P2-7. 필터 tone을 의미에 맞게 사용

- 일반 search/date/sort 활성 상태: neutral 또는 info
- Needs review 큐: warning
- 데이터 로드/작업 실패: danger
- 단지 `Oldest submitted`가 선택됐다는 이유로 warning result badge를 쓰지 않는다.

## P3 — 함께 처리할 미세 개선

### P3-1. 별점 숫자 표시

- 별 아이콘 옆에 `5/5`, `3/5`처럼 숫자를 시각적으로 표시한다.
- 기존 접근성 이름은 유지한다.
- 열 폭을 늘리거나 새로운 rating 컴포넌트를 만들 필요는 없다.

### P3-2. Submitted와 Requested 중복 완화

- Submitted는 항상 유지한다.
- booking requested time은 submitted와 다른 의미라는 사실을 유지한다.
- 동일하거나 운영 가치가 낮은 경우 1차 목록에서 시각 우선순위를 낮추거나 booking 링크의 보조 정보로 이동한다.
- 두 날짜를 하나의 필드로 합치지 않는다.

### P3-3. Export 파일명 계약 정리

- 서버의 날짜 범위/생성일 포함 파일명을 유지한다.
- `<a download>`의 고정 파일명이 응답 헤더 파일명과 충돌하지 않게 확인한다.
- 브라우저 실제 다운로드 파일명을 한 번 검증한다.

## 목표 화면 구조

```text
Customer Reviews                                                [Export]
Review customer feedback and control app visibility.

Status  [All 172] [Visible 170] [Needs review 0] [Hidden 2]

Review queue                                              172 matching
[Search ................................] [Date ▾] [Sort ▾] [Rows ▾] [Update list]
(Custom) [From yyyy-mm-dd] [To yyyy-mm-dd] [Apply dates]
[Active filter chips] [Clear filters]

SUBMITTED | REVIEW | PARTIES | STATE | ACTIONS
row...

Showing 1–10 of 172                                pagination
```

이 구조는 참고 기준이며 현재 디자인 시스템의 정확한 spacing/token을 사용한다. 새 시각 언어를 만들거나 페이지를 전면 재작성하지 않는다.

## UX 문구 기준

유지:

- `Customer Reviews`
- `Visible`
- `Needs review`
- `Hidden`
- `App visible`
- `Not visible in app`
- `Hide review`
- `Publish review`
- `Send to Needs review`
- `Save admin-created review`

변경:

- 필터 제출 `Apply` → `Update list`
- 표 제목 `Customer reviews` → `Review queue`
- 반복 설명 문구는 한 곳만 유지
- 단순 필터 활성 상태에 warning 어휘·색상 사용 금지
- 모든 empty state는 대문자로 시작하는 완성 문장 사용

사용자 화면 문구는 영어로 유지하되 실제 운영자가 의미를 오해하지 않는 짧은 문장으로 작성한다. 내부 구현 용어인 provider는 사용자 화면에서 `Partner`로 표시한다.

## 접근성 완료 기준

- 모든 filter group과 input에 보이는 label 또는 명확한 접근성 이름이 있다.
- 활성 상태는 색상 외에 텍스트와 `aria-current` 등으로 전달된다.
- 정보성 보조 텍스트 대비는 light/dark에서 최소 4.5:1이다.
- action menu는 Enter/Space, ArrowUp/Down, Home/End, Escape로 조작 가능하다.
- confirm/drawer는 focus trap, Escape, backdrop, focus return이 동작한다.
- modal이라고 선언한 경우 배경은 실제로 조작할 수 없다.
- success는 status, failure는 alert로 전달한다.
- loading 중 중복 submit을 막는다.
- 1440px에서 keyboard focus indicator가 잘리지 않는다.

## 구현 순서

### Phase 1 — P1 기능 결함

1. Custom dates root cause 수정 및 테스트
2. HIDDEN/REPORTED 관리자 리뷰 편집 계약 수정 및 테스트
3. 정보성 텍스트 대비 수정
4. 리뷰 집중 테스트와 API 집중 테스트 실행

Phase 1이 실패한 상태에서 시각 개선만 진행하지 않는다.

### Phase 2 — 정보 구조와 밀도

1. status queue counts와 filtered matching count 분리
2. 필터 재배치
3. 반복 count와 설명 제거
4. 1440×900 첫 화면에 표 머리글과 첫 행 노출

### Phase 3 — 안전 조치와 문구

1. confirmation을 실제 modal/drawer 동작으로 통일
2. operator note 추가
3. empty copy와 filter tone 수정
4. 별점 숫자·버튼명·시간 정보 우선순위 정리

### Phase 4 — 회귀 검증

1. 테스트/typecheck/lint
2. 1440×900 및 1600×900 브라우저 검증
3. light/dark 검증
4. console/network 오류 확인
5. before/after 캡처와 최종 보고

## 최소 테스트 명령

현재 package scripts를 확인한 뒤 적합한 명령을 사용하되 최소 다음 범위를 실행한다.

Admin Web 집중 테스트:

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- app/reviews/page.spec.tsx app/reviews/review-page-model.spec.ts app/reviews/reviews-table-section.spec.tsx app/reviews/review-row-actions.spec.tsx app/reviews/review-row-actions.spec.ts app/reviews/review-page-actions.spec.ts app/reviews/review-action-confirmation.spec.ts app/reviews/actions.spec.ts app/reviews/export/route.spec.ts
```

API review 집중 테스트:

```powershell
npm.cmd run test --workspace @massage-vn/api -- src/admin/admin.service.spec.ts -t "review"
```

정적 검사:

```powershell
npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run typecheck --workspace @massage-vn/api
```

저장소 범위 검사:

```powershell
npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api
```

관련 lint를 실행한다. 전체 저장소의 기존 오류나 unrelated dirty files를 이번 변경으로 고치지 않는다. 실행하지 못한 검사는 이유를 기록한다.

## 브라우저 검증 매트릭스

실제 운영 데이터를 변경하지 않는 읽기 전용 검증을 우선한다.

### 1440×900 light

- `/reviews`
- Visible
- Needs review empty
- Hidden
- Custom dates 진입
- valid custom range
- reversed custom range
- 검색 적용
- oldest / rating sort
- rows 25
- action menu open
- Hide confirmation 진입 후 Cancel
- Needs review confirmation 진입 후 Cancel
- Publish confirmation 진입 후 Cancel

### 1440×900 dark

- 기본 상단과 표
- 정보성 보조 텍스트 대비
- action menu
- confirmation

### 1600×900 light

- 기본 상단
- 필터 한 줄 구조
- 표 머리글과 첫 행
- Hidden queue

확인할 사항:

- 가로 스크롤 없음
- action menu clipping 없음
- 검색 placeholder 전체 표시
- count 범위 의미가 명확함
- Custom From/To 표시
- confirm 배경 조작 차단
- Escape와 focus return
- console error 없음
- 관련 API 4xx/5xx 없음

실제 moderation submit은 하지 않는다. 관리자 작성 HIDDEN/REPORTED 편집 성공은 자동화 테스트 또는 disposable fixture로 확인한다.

## 스크린샷 저장 위치

새 검증 증거는 다음 폴더에 저장한다.

`C:\dev\massage-on-demand-vn\output\reviews-remediation-verification-2026-08-07\`

최소 캡처:

- `01-reviews-top-after-1440.jpg`
- `02-reviews-table-after-1440.jpg`
- `03-custom-dates-open-1440.jpg`
- `04-custom-dates-error-1440.jpg`
- `05-needs-review-empty-after-1440.jpg`
- `06-hidden-table-after-1440.jpg`
- `07-action-menu-after-1440.jpg`
- `08-confirmation-modal-after-1440.jpg`
- `09-reviews-dark-after-1440.jpg`
- `10-reviews-top-after-1600.jpg`
- `11-reviews-table-after-1600.jpg`

각 이미지를 저장한 뒤 직접 열어 잘림, 간격, 흐린 텍스트, 모달 배경, 초점 표시를 확인한다. 스크린샷을 저장했다는 사실만으로 검증 완료 처리하지 않는다.

## 완료 조건

다음 조건을 모두 만족해야 완료로 보고한다.

- Custom dates를 선택하면 From/To가 실제로 보인다.
- 열린 custom range와 valid range가 동작한다.
- reversed range는 API 호출 없이 인라인 오류를 표시한다.
- 관리자 작성 PUBLISHED/HIDDEN/REPORTED 리뷰 편집 계약이 모두 테스트된다.
- HIDDEN/REPORTED 콘텐츠 편집 후 기존 reportReason이 유지된다.
- 고객 작성 리뷰 rating/comment 수정은 계속 거부된다.
- 서비스명·사유·앱 노출 설명이 light/dark 모두 4.5:1 이상이다.
- 1440×900에서 필터가 의도적으로 정렬되고 Search/Update/Export가 분리되지 않는다.
- 1440×900 첫 화면에 표 머리글과 최소 첫 행 핵심 정보가 보인다.
- 전체/상태 큐 count와 filtered matching count의 범위가 명확히 다르다.
- 동일 result count가 세 위치에 반복되지 않는다.
- 확인 UI의 aria-modal 선언과 실제 modal 동작이 일치한다.
- 배경은 클릭/Tab할 수 없고 Escape/Cancel/focus return이 동작한다.
- moderation category와 optional operator note가 분리된다.
- 빈 큐 문장이 문법적으로 완전하고 상태 의미와 일치한다.
- 별점 숫자가 시각적으로 표시된다.
- 1440/1600, light/dark에서 가로 스크롤과 clipping이 없다.
- 리뷰 집중 테스트, API review 테스트, typecheck가 통과한다.
- 기존 전체 기간, 상태 모델, returnTo, 고객 원문 보호, audit, CSV가 회귀하지 않는다.

## 금지 사항

- 1024px 이하 화면 검사 또는 구현
- 모바일/태블릿 대응 추가
- 새 UI/날짜/상태관리 라이브러리 설치
- Prisma schema 또는 migration 변경
- 고객 작성 리뷰 원문 덮어쓰기 허용
- 실제 운영 리뷰 mutation 제출
- 전체 `globals.css` 리팩터링
- shared ConfirmDialog의 모든 호출자를 검토하지 않은 전역 동작 변경
- unrelated dirty files 수정·삭제·되돌리기
- 테스트 실패를 skip 또는 기대값 완화로 숨기기
- API 실패를 빈 결과 또는 0 count로 표시
- 보고서만 작성하고 구현을 생략

## 최종 보고 형식

작업 완료 후 아래 순서로 보고한다.

1. 운영자가 체감할 최종 결과
2. P1/P2/P3별 완료 여부
3. 변경 파일과 각 파일의 역할
4. root cause별 수정 설명
5. 실행한 테스트·typecheck·lint·scope 검증 명령과 결과
6. 브라우저 검증 URL, viewport, theme, 상태
7. before/after 스크린샷 링크
8. 보호 영역 변경 여부
9. 보존한 dirty worktree와 관련 없는 변경
10. 남은 위험 또는 완료하지 못한 항목
11. 다음 권장 작업 정확히 한 가지

완료하지 못한 항목을 완료했다고 표현하지 마라. 테스트가 통과해도 브라우저에서 재현되는 결함이 남아 있으면 완료가 아니다.

---

