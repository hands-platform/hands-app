# Codex 실행 프롬프트 — Customer Reviews 운영 화면 개선

아래 내용을 Codex의 새 작업에 그대로 붙여 넣어 사용한다.

---

## 목표

`C:\dev\massage-on-demand-vn` 프로젝트의 관리자 Customer Reviews 화면을 실제 운영자가 빠르고 안전하게 사용할 수 있도록 수정하라.

대상 화면:

- `http://localhost:3101/reviews`

감사 보고서와 증거:

- `C:\dev\massage-on-demand-vn\output\reviews-audit-2026-08-06\reviews-operator-audit.md`
- 같은 폴더의 `01`~`18` PNG 스크린샷

보고서를 단순 참고만 하지 말고, 화면 증거와 현재 코드를 다시 대조한 뒤 아래 요구사항을 실제 코드로 구현하고 검증하라. 계획만 작성하고 끝내지 말고 안전하게 구현 가능한 범위는 완료하라.

## 작업 원칙

1. 먼저 저장소의 `AGENTS.md`를 찾아 적용 범위별 지침을 읽는다.
2. 기존 dirty worktree와 사용자 변경을 보존한다. 관련 없는 파일을 되돌리거나 포맷하지 않는다.
3. 현재 프로젝트의 관리자 컴포넌트, 토큰, CSS 패턴, action feedback, confirm/drawer 패턴을 먼저 검색해 재사용한다.
4. 새 UI 라이브러리나 상태관리 라이브러리를 추가하지 않는다.
5. 이 화면만 고치기 위해 새로운 디자인 시스템이나 범용 추상화를 만들지 않는다.
6. 증상별 임시 패치를 반복하지 말고 공통 URL 생성·상태 정규화·moderation service 같은 실제 원인 지점을 고친다.
7. 실제 운영 데이터에는 Hide, Publish, Needs review, Edit를 제출하지 않는다. UI 검증에는 읽기 전용 상태, 테스트 fixture 또는 명시적인 disposable 데이터만 사용한다.
8. 고객이 작성한 원본 평점과 문구의 무결성, 변경 감사, 권한 검증, 실패 처리, 접근성은 단순화를 이유로 생략하지 않는다.
9. 대규모 스키마 변경이 없어도 안전하게 고칠 수 있는 최소 구현을 우선한다. 불변 원본을 보장할 수 없다면 고객 작성 리뷰 편집 기능을 제거하거나 서버에서도 차단한다.

## 먼저 확인할 코드

다음 파일과 모든 호출자를 읽고 실제 흐름을 추적하라. 줄 번호는 변할 수 있으므로 파일명과 함수명을 기준으로 찾는다.

- `apps/admin_web/app/reviews/page.tsx`
- `apps/admin_web/app/reviews/review-page-model.ts`
- `apps/admin_web/app/reviews/reviews-table-section.tsx`
- `apps/admin_web/app/reviews/review-page-actions.ts`
- `apps/admin_web/app/reviews/review-action-confirmation.ts`
- `apps/admin_web/app/reviews/review-row-actions.tsx`
- `apps/admin_web/app/reviews/actions.ts`
- `apps/admin_web/app/reviews/export/route.ts`
- `apps/admin_web/app/globals.css`
- `apps/admin_web/lib/admin-api.ts`
- `apps/api/src/admin/admin-review.routes.ts`
- `apps/api/src/admin/admin.dto.ts`
- `apps/api/src/admin/admin.service.ts`
- 위 파일과 연결된 `*.spec.ts`, `*.spec.tsx`

## 반드시 수정할 P0 요구사항

### 1. All dates와 기본 URL 계약 수정

현재 `normalizeReviewDateRange()`는 dateRange가 없으면 `today`를 반환하지만 `buildReviewHref()`는 `all`을 URL에서 생략한다. 그 결과 `All dates`와 `Clear filters`가 `/reviews`로 이동한 뒤 다시 Today가 된다.

수정 기준:

- `/reviews`의 기본 범위를 `all`로 통일한다.
- `All dates`와 `Clear filters`를 누르면 실제 전체 기간이 선택되고 버튼 활성 상태도 All dates여야 한다.
- `Today`는 `?dateRange=today`일 때만 활성화한다.
- 빈 Custom dates는 `Custom: Any start - Any end`로 남기지 말고 All dates로 정규화하거나 명확한 입력 오류를 표시한다. 권장은 All dates 정규화다.
- From > To를 조용히 뒤집지 말고 입력 오류로 안내한다.
- 필터 변경 시 page는 1로 돌아가되 q, pageSize, status, date, sort 등 의도적으로 유지해야 하는 값은 보존한다.

회귀 테스트:

- 빈 params → `dateRange=all`
- `/reviews`에서 All dates 활성
- Clear filters → All dates/Newest/기본 pageSize
- Today → `?dateRange=today`
- Custom empty → All dates
- Custom reversed → 사용자에게 검증 오류

### 2. moderation 작업에서 목록 문맥 보존

현재 Hide/Follow-up/Publish confirm URL은 reviewId/status/reason만 포함한다. Last month, 검색, 정렬 또는 2페이지에서 작업하면 현재 필터가 사라지고 확인 대상이 현재 rows에 없어서 확인 카드가 렌더링되지 않는다. Cancel도 `/reviews`로 고정되어 있다.

수정 기준:

- Edit 드로어에 이미 있는 안전한 `returnTo` 패턴을 모든 moderation 작업에 재사용한다.
- confirm 링크, Cancel, submit 완료 후 이동이 동일한 안전한 returnTo를 사용해야 한다.
- returnTo는 `/reviews` 하위의 내부 경로만 허용하고 `//`, 줄바꿈, 외부 URL을 거부한다.
- 확인 대상 리뷰를 현재 페이지의 `reviews.find()`에 의존해 찾지 않는다. reviewId로 정확한 단건 데이터를 가져오거나, 기존 API를 최소 변경해 정확한 ID 조회를 지원한다.
- 확인 대상이 없거나 로드에 실패하면 조용히 빈 목록으로 돌아가지 말고 명시적인 오류 상태와 취소 경로를 보여준다.
- 현재 filter, q, sort, page, pageSize, dateFrom, dateTo가 confirm/cancel/success에서 유지되는지 테스트한다.

확인 카드에 반드시 표시할 정보:

- 리뷰 별점과 문구 일부
- 고객명과 파트너명
- booking short ID
- 현재 visibility/status
- 변경 후 visibility/status
- 실제 작업 영향
- moderation reason

### 3. 고객 원본 리뷰의 불변성 확보

현재 API `moderateReview()`는 고객이 작성한 canonical `rating`과 `comment`를 직접 덮어쓰고 파트너 평점을 다시 계산한다. 감사 로그에는 before 값이 없다.

이번 작업의 최소 안전 정책:

- `createdByAdminId`가 없는 고객 작성 리뷰는 UI와 API 모두에서 rating/comment 편집을 금지한다.
- 일반 고객 리뷰의 행 메뉴에서 `Edit Review`를 제거한다.
- API에서 직접 PATCH해도 고객 작성 review의 rating/comment가 바뀌지 않도록 서버에서 검증한다. UI 차단만으로 끝내지 않는다.
- admin-created review만 수정이 필요한 기존 정책이 확인되면 그 경우에만 편집을 허용하되, 화면에 `Admin-created review`를 명시하고 변경 사유를 필수로 받는다.
- moderation 전에 기존 review를 조회하고 audit metadata에 `before`, `after`, `reason`, `actorId`, timestamp를 남긴다.
- status 변경만 수행할 때 rating/comment는 payload와 update data에 넣지 않는다.
- Published 전환 시 과거의 현재 moderation reason이 남아 `Held by admin`으로 보이지 않게 현재 reason을 정리한다. 과거 기록은 audit history에 남긴다.
- 별도 immutable source/display override 스키마가 꼭 필요하다고 판단되면 먼저 현재 데이터 모델과 마이그레이션 위험을 보고하고, 불필요한 대규모 변경 없이 요구사항을 충족할 수 있는지 검토한다.

테스트:

- 고객 작성 리뷰의 rating/comment PATCH 거부
- admin-created 리뷰 정책이 있을 경우 허용 범위 테스트
- status-only 변경이 comment/rating을 보존
- audit log에 before/after/reason 포함
- Published 전환 후 현재 reason 정리
- rating 집계가 정책대로만 변경

### 4. Follow-up/Reported/visibility 상태 계약 통일

현재 화면에는 Follow-up과 Reported가 별도 필터지만 API는 둘 다 `status = REPORTED`로 처리한다. 프런트 로컬 모델은 reportReason이 있으면 Follow-up으로 판단한다. Published 행에도 `Follow-up marker`와 `Reason: Held by admin`이 표시된다.

수정 기준:

- 별도 workflow 상태가 실제 데이터 모델에 없으므로 UI의 `Follow-up`과 `Reported`를 하나의 `Needs review` 큐로 통합한다.
- 내부 query value는 기존 호환성을 위해 `reported`를 재사용해도 된다. 새 추상화나 마이그레이션은 만들지 않는다.
- legacy `follow-up`, `low-rating`, `service-recovery` URL은 `Needs review`로 안전하게 정규화한다.
- `partnerReviewHint()`에서 review moderation 상태를 파트너 helper로 표시하지 않는다. `Follow-up marker`를 제거한다.
- Published 행에는 current reason을 표시하지 않는다.
- Hidden/Needs review 행에서만 현재 moderation reason을 상태 영역에 표시한다.
- `Needs review` 작업이 Published 리뷰를 앱에서 숨기는 효과가 있다면 메뉴 설명과 확인 카드에 `This removes the review from the app until it is resolved.`를 명시한다.
- Hide와 Needs review에는 generic 고정 사유만 보내지 말고 reason category를 필수로 받는다. 기존 confirm/form 컴포넌트 중 재사용 가능한 패턴을 먼저 찾는다.

권장 화면 상태:

- `All`
- `Visible`
- `Needs review`
- `Hidden`

### 5. CSV 전체 결과 내보내기

현재 export route는 pageSize 100으로 한 번만 요청하고 API 최대치도 100이므로 전체 172건에서 72건이 누락될 수 있다.

수정 기준:

- 기존 list API의 take/skip을 이용해 최대 100건씩 반복 조회하고 현재 필터에 맞는 전체 결과를 CSV로 생성한다.
- 새 라이브러리를 추가하지 않는다.
- 각 요청 실패를 빈 배열로 삼키지 않는다. `adminGetResult()` 또는 동등한 명시적 결과 처리를 사용해 비정상 상태 코드를 반환한다.
- 무한 루프를 방지하고 API가 빈 배열 또는 100건 미만을 반환하면 종료한다.
- summary totalCount와 실제 export count가 다르면 성공 파일로 조용히 반환하지 않는다.
- 파일명에 범위 또는 생성 날짜를 포함한다.
- 0, 1, 100, 101, 172건과 중간 API 실패를 테스트한다.

## P1 운영 화면 개선 요구사항

### 6. 요약 영역을 compact summary로 변경

- 5개의 큰 metric card가 필터와 목록을 아래로 밀어내지 않게 한다.
- 저장소에 이미 있는 compact summary/stat strip 패턴을 검색해 재사용한다.
- 한 줄 기준: `Results · Visible · Needs review · Hidden · Average rating`.
- 0건인 action state는 큰 위험 카드로 반복하지 않는다.
- 상태/search 필터가 적용된 값이라면 `All records`라고 부르지 말고 현재 결과 범위임을 표시한다.
- 결과가 없을 때 평균 평점은 `0.0`보다 `—`를 사용한다.

### 7. 표를 운영자 중심으로 재구성

현재 CSS의 `min-width: 1320px` 때문에 1440px에서도 Visibility/Actions가 잘린다.

목표 열:

1. `Submitted` — review.createdAt을 1차 표시, booking ID/booking time을 2차 표시
2. `Review` — 별점, 최대 2줄 문구, 서비스
3. `Parties` — 고객명과 파트너명
4. `State` — Visible/Needs review/Hidden, 현재 reason과 변경 시각
5. `Actions` — 항상 접근 가능

수정 기준:

- 서버가 review.createdAt으로 기간·정렬하므로 UI도 `Submitted date`, `Most recently submitted`라고 부른다.
- booking request time과 review submitted time을 혼동하지 않는다.
- booking ID와 review ID를 명시적으로 구분한다.
- 전화번호 전체와 온라인/오프라인 점을 기본 목록에서 제거한다. 상세나 권한 있는 화면에만 둔다.
- Actions와 State가 1024px·1440px에서 가로 스크롤 없이 보이게 한다.
- 기존 저장소에 responsive table/card 또는 master-detail 패턴이 있으면 재사용한다.
- empty state는 1320px 테이블 내부에 넣지 말고 컨테이너 폭 안에서 완전히 보이게 한다.
- 긴 이름, 긴 review, 서비스 여러 개에서도 행이 깨지지 않게 clamp/wrap한다.

### 8. 필터 가독성과 검증 개선

- segmented control 위에 보이는 그룹 레이블 `Status`, `Submitted date`, `Sort`를 추가한다.
- Custom 날짜의 `From`, `To` 레이블을 시각적으로 표시한다.
- 검색 placeholder를 `Search customer, partner, booking, or review`로 바꾼다.
- active filter chip은 완전한 짧은 명사형으로 쓴다. 설명 문장을 chip에 넣지 않는다.
- 잘못된 custom date는 inline error와 올바른 focus 이동으로 안내한다.

### 9. 확인·완료·오류 피드백

- 저장소의 기존 toast/flash/action feedback 패턴을 찾아 재사용한다.
- 성공 후 `Review hidden from app`, `Review published`, `Review sent to Needs review`처럼 결과를 표시한다.
- 실패 시 페이지 전체 오류가 아니라 해당 작업 근처에서 이유와 재시도 방법을 보여준다.
- 중복 제출을 막고 진행 중 버튼 상태를 표시한다.
- 작업 후 원래 목록 위치와 키보드 focus를 가능한 한 복원한다.

## P2 문구와 밀도

다음 문구를 운영자 관점으로 교체한다.

| 현재 | 교체 |
|---|---|
| `All customer-written reviews, Partner service context, and app visibility moderation in one board.` | `Review customer feedback, app visibility, and moderation history.` |
| `Review operation filters` | `Review filters` |
| `Customer-written reviews are published by default...` | `Find reviews and manage whether they appear in the customer app.` |
| `Review request date` | `Submitted date` |
| `Newest request` | `Most recently submitted` |
| `Oldest request` | `Oldest submitted` |
| `Request Time` | `Submitted` |
| `Follow-up` / `Reported` | `Needs review` |
| `Hidden from app` | `Hidden` |
| `Review rows use the same table card...` | 삭제하거나 `Review feedback and complete moderation work.` |
| `Showing 29 of 29` | `29 results` |
| `29 review(s)` | `29 reviews` |
| `Save review` | admin-created 편집이 유지될 때만 `Save admin-created review` |

문구를 코드 곳곳에 중복 하드코딩하지 말고 이미 있는 option/label 모델의 단일 위치를 사용한다. 단, 이 화면 하나를 위해 새 국제화 시스템을 만들지 않는다.

## 접근성 기준

- 모든 필터 그룹에는 화면에 보이는 레이블과 접근성 이름이 있어야 한다.
- 상태는 색상만으로 구분하지 않는다.
- action menu, confirm, drawer를 키보드만으로 사용할 수 있어야 한다.
- Esc로 닫고, 취소/완료 후 합리적인 위치로 focus가 돌아가야 한다.
- 200% 확대와 1024×768에서도 콘텐츠나 작업 버튼이 잘리지 않아야 한다.
- empty/error/success 메시지는 screen reader에 적절히 전달한다.

## 검증 절차

구현 전:

1. 보고서와 스크린샷을 읽는다.
2. 관련 함수의 모든 호출자와 기존 테스트를 검색한다.
3. 저장소의 유사한 compact summary, action feedback, confirm, responsive list 패턴을 찾는다.
4. 변경할 파일과 회귀 위험을 짧게 정리한 뒤 구현을 시작한다.

구현 후:

1. 변경된 순수 함수와 서버 서비스에 가장 작은 관련 unit test를 추가하거나 수정한다.
2. reviews 관련 테스트, API admin 관련 최소 테스트, typecheck/lint를 실행한다.
3. 전체 테스트가 과도하면 먼저 가장 작은 관련 테스트를 실행하고, 실행하지 못한 검사는 이유를 명시한다.
4. 로컬 관리자 서버를 열고 로그인된 in-app browser에서 다음을 확인한다.
   - `/reviews`
   - `?dateRange=today`
   - `?dateRange=30d`
   - Visible / Needs review / Hidden
   - Custom dates
   - 검색·정렬·2페이지 상태 보존
   - confirm/cancel의 returnTo
   - empty/error state
5. 실제 운영 데이터 mutation은 제출하지 않는다.
6. 1024×768과 1440×900 스크린샷을 저장하고 각각 직접 열어 확인한다.
7. 브라우저 console error가 없는지 확인한다.

검증 스크린샷 저장 위치:

- `C:\dev\massage-on-demand-vn\output\reviews-improvement-verification-2026-08-06\`

## 완료 조건

다음 조건을 모두 만족해야 완료로 보고한다.

- `/reviews`가 All dates로 일관되게 열린다.
- All dates에서 실제 전체 건수를 조회할 수 있다.
- Last month, 검색, 정렬, 2페이지에서 confirm이 정상 표시된다.
- Cancel과 완료 후 원래 목록 문맥이 보존된다.
- confirm은 현재 행과 변경 영향을 충분히 식별시킨다.
- 일반 고객 리뷰의 canonical rating/comment를 UI나 API로 수정할 수 없다.
- audit log에 before/after/reason이 남는다.
- Follow-up/Reported 중복이 제거되고 Needs review 의미가 프런트/API에서 일치한다.
- Published 행에 `Held by admin` 또는 `Follow-up marker`가 현재 상태처럼 보이지 않는다.
- CSV가 100건을 넘어도 전체 결과를 포함하며 실패를 빈 파일로 위장하지 않는다.
- 1024px와 1440px에서 State와 Actions가 가로 스크롤 없이 보인다.
- Custom From/To가 보이고 역전 날짜가 검증된다.
- 성공/실패 결과가 운영자에게 보인다.
- 관련 테스트와 정적 검사가 통과한다.

## 최종 보고 형식

작업이 끝나면 다음 순서로 보고하라.

1. 구현 결과 요약
2. P0/P1/P2별 완료 여부
3. 변경 파일 목록과 각 파일의 역할
4. 실행한 테스트·검사 명령과 결과
5. 브라우저 검증한 URL·viewport·상태
6. 저장한 before/after 스크린샷 링크
7. 남은 제한 또는 의도적으로 미룬 항목

완료하지 못한 요구사항을 완료했다고 표현하지 말고, 정확한 원인과 다음에 필요한 작업을 적는다.

---

