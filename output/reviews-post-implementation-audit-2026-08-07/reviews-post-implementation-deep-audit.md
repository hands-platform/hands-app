# Customer Reviews 재감사 보고서

- 대상: `http://localhost:3101/reviews`
- 감사일: 2026-08-07
- 화면 기준: 1440×900, 1600×900 데스크톱만 검사
- 제외: 1024px 이하 화면, 모바일/태블릿 반응형
- 방법: 로그인된 실제 화면 상태별 캡처, 키보드/메뉴/확인 흐름 점검, Admin Web·API·Prisma 코드 추적, 집중 테스트 및 타입 검사
- 변경 범위: 제품 코드는 수정하지 않았고 이 보고서와 증빙 캡처만 추가했다.

## 1. 최종 결론

이전 감사의 핵심 P0 문제는 대부분 제대로 해결됐다. 기본 진입은 전체 기간을 보여주고, 목록은 1440px에서도 5개 핵심 열로 무리 없이 읽히며, Publish/Hide/Needs review가 하나의 상태 모델로 정리됐다. 위험 조치에는 리뷰·고객·파트너·예약·현재 상태·다음 상태·영향을 보여주는 확인 단계가 생겼다. 고객이 작성한 리뷰 본문은 서버에서도 수정할 수 없고, 관리자 작성 리뷰만 수정할 수 있으며 변경 전후와 사유가 감사 로그에 남는다. CSV도 첫 100건에서 잘리지 않고 전체 결과를 페이지 단위로 읽는다.

다만 “완료”라고 판단하기에는 세 가지 P1이 남아 있다.

1. `Custom dates`를 누르면 날짜 입력란이 나타나지 않고 즉시 `All dates`로 되돌아간다.
2. 숨김 또는 Needs review 상태의 관리자 작성 리뷰는 편집 제출이 항상 실패하는 코드 경로가 있다.
3. 표의 서비스명·숨김 사유·앱 노출 설명에 쓰는 12px 보조 텍스트 대비가 밝은 테마에서 2.29:1이다. 운영 정보로는 너무 흐리며 WCAG 일반 텍스트 기준 4.5:1에 미달한다.

따라서 현재 평가는 **이전보다 크게 개선됐지만, P1 3건을 해결하기 전에는 운영 UX 개선을 완료 처리하면 안 되는 상태**다.

## 2. 점수와 심각도

| 항목 | 점수 | 판단 |
|---|---:|---|
| 접근성 | 3/4 | 키보드 메뉴, 초점 트랩, 명시적 라벨은 좋아졌지만 보조 텍스트 대비와 실제 모달 동작 불일치가 남음 |
| 성능 | 3/4 | 서버 페이지네이션과 전체 CSV가 정상. 확인 화면에서도 배경 목록/요약을 다시 읽는 비용은 남음 |
| 1440px 이상 데스크톱 | 3/4 | 표는 잘 맞지만 1440px 필터가 두서없이 줄바꿈되고 첫 화면에 실제 목록이 거의 안 보임 |
| 테마 | 3/4 | 밝은/어두운 테마 모두 구조는 안정적. 중요 보조 텍스트 명도는 재조정 필요 |
| 구현 무결성 | 3/4 | 상태·확인·감사·내보내기 경계가 좋아졌지만 맞춤 날짜와 비공개 관리자 리뷰 편집에 기능 결함 존재 |
| **합계** | **15/20** | **Good — 운영 투입 가능성은 높지만 핵심 결함 수정 필요** |

- P0: 0건
- P1: 3건
- P2: 7건
- P3: 4건

## 3. 이전 감사 항목 재검증

| 이전 핵심 항목 | 현재 상태 | 근거와 판단 |
|---|---|---|
| 기본 기간이 최근 구간으로 제한됨 | 해결 | `/reviews`가 `All dates`로 열리고 실제 172건을 표시한다. API 요청에도 `from/to`가 없다. |
| 행 조치가 위험하고 맥락이 부족함 | 해결 | 메뉴에서 바로 변경하지 않고 확인 화면으로 이동한다. 리뷰, 고객, 파트너, 예약, 현재/다음 상태, 영향이 표시된다. |
| 상태 표현 불일치 | 해결 | 화면과 API가 `PUBLISHED → Visible`, `REPORTED → Needs review`, `HIDDEN → Hidden`으로 정렬됐다. 앱 노출 여부도 별도 문구로 표시된다. |
| 고객 작성 리뷰 본문 수정 위험 | 해결 | `createdByAdminId`가 있는 리뷰만 편집 UI를 제공하고 API도 고객 작성 리뷰 편집을 거부한다. |
| 편집 사유/감사 증거 부족 | 해결 | 관리자 작성 리뷰 편집은 사유가 필수이며 API 감사 로그에 before/after와 actor/timestamp/reason이 기록된다. |
| CSV 100건 제한 | 해결 | 요약 count를 먼저 읽고 100건 단위로 전 페이지를 수집한다. 중간 실패나 count 변동 시 불완전 파일 대신 오류를 반환한다. |
| 1440px 표 가독성 | 해결 | 5열 구조가 가로 스크롤 없이 맞고 고객/파트너, 상태, 조치가 분리된다. |
| 필터의 의미와 활성 상태 | 대부분 해결 | Status/Submitted date/Sort가 구분되고 활성 항목에는 `aria-current="page"`가 있다. 맞춤 날짜 진입 결함은 남아 있다. |
| 빈 화면과 실패 상태 | 대부분 해결 | 데이터 실패와 실제 0건을 구분한다. Needs review 빈 화면 문장 조립 오류는 남아 있다. |

## 4. 잘된 부분 — 유지해야 하는 기준

### 4.1 운영자가 상태와 앱 영향을 함께 이해할 수 있다

- 표의 `State`는 `Visible`, `Needs review`, `Hidden`을 보여준다.
- 바로 아래에 `App visible` 또는 `Not visible in app`을 표시해 상태명과 실제 고객 영향이 분리된다.
- Hide 확인 화면은 “감사 증거로 보존되지만 앱에는 보이지 않는다”는 영향을 명시한다.
- Publish 시 파트너 평점에 다시 포함된다는 영향도 코드에 명시되어 있다.

상태명, 운영 조치, 고객 앱 영향이 서로 다른 개념이라는 점이 이전보다 훨씬 명확해졌다. 이 구분은 유지해야 한다.

### 4.2 위험 조치가 즉시 실행되지 않는다

- 행의 44×44px 점 3개 버튼은 리뷰별 접근 가능한 이름을 가진다.
- 메뉴를 열면 첫 항목으로 초점이 이동하고 방향키·Home·End·Escape가 동작한다.
- 현재 상태와 동일한 조치는 메뉴에서 제거된다.
- 실제 변경 전 확인 화면이 나타나며 비공개 조치에는 사유가 필수다.
- 취소 또는 처리 후 기존 검색·상태·기간·정렬을 `returnTo`로 복원한다.
- 외부 URL을 `returnTo`로 주입할 수 없도록 `/reviews` 경로만 허용한다.

이 흐름은 운영 안전성과 반복 작업 속도의 균형이 좋다. 메뉴 자체를 다시 큰 버튼 묶음으로 되돌릴 필요는 없다.

### 4.3 고객 원문과 관리자 작성 콘텐츠의 경계가 생겼다

- 고객 작성 리뷰에는 편집 메뉴를 제공하지 않는다.
- 관리자 작성 리뷰에만 `Edit Review`를 표시한다.
- 수정 화면에서 Original review와 Replacement를 분리한다.
- 서버는 UI를 우회한 고객 리뷰 수정 요청도 거부한다.
- 파트너 평점 집계는 `PUBLISHED` 리뷰만 다시 계산한다.

이 경계는 반드시 유지해야 한다. 향후 수정에서도 UI 가드만 믿지 말고 현재 API 가드를 보존해야 한다.

### 4.4 표 구조는 1440px 운영 환경에 적합해졌다

- `Submitted / Review / Parties / State / Actions`의 5열만 유지해 폭을 안정화했다.
- 고객과 파트너를 한 열에서 시각적으로 구분한다.
- 예약 상세, 고객 상세, 파트너 상세로 연결되는 링크가 있다.
- 메뉴가 오른쪽 끝에서 열려도 잘리지 않는다.
- 1600px에서는 필터와 표 머리글이 한 화면 안에 더 자연스럽게 들어온다.

### 4.5 내보내기와 오류 처리가 신뢰할 수 있게 바뀌었다

- CSV는 현재 검색·상태·기간·정렬 범위를 보존한다.
- 전체 count를 기준으로 100건씩 반복 수집한다.
- 중간 페이지 로드 실패와 데이터 변동을 감지해 잘못된 완성 파일을 내려주지 않는다.
- 데이터 API 실패를 0건으로 위장하지 않고 별도 오류 상태를 보여준다.

## 5. P1 — 반드시 먼저 수정할 항목

### P1-1. `Custom dates`가 실제로 열리지 않는다

**재현**

1. `/reviews` 진입
2. Submitted date에서 `Custom dates` 클릭
3. URL은 잠시 `?dateRange=custom`을 요청하지만 렌더링 결과는 다시 `All dates`
4. `From`, `To`, `Apply dates`가 나타나지 않음

증빙: `09-custom-dates-no-fields-1440.jpg`

**근본 원인**

- `reviews-table-section.tsx:175-183`은 `dateRange=custom`, 빈 `dateFrom/dateTo` 링크를 만든다.
- `review-page-model.ts:206-218`은 custom인데 두 날짜가 모두 비어 있으면 `dateRange`를 강제로 `all`로 정규화한다.
- 날짜 입력 UI는 `filters.dateRange === 'custom'`일 때만 렌더링된다(`reviews-table-section.tsx:186-221`).
- 테스트도 현재 결함을 정상 동작처럼 고정한다(`review-page-model.spec.ts:94`).

**수정 방법**

- `buildReviewFilters`에서 빈 custom을 `all`로 바꾸지 말고 `custom`을 유지한다.
- 두 날짜가 모두 비어 있을 때 API 범위는 전체로 처리하되, UI는 날짜 입력을 보여준다. 기존 `customDateRangeBounds`가 이미 무한 범위를 처리하므로 새 라이브러리는 필요 없다.
- `Custom dates` 클릭 → From/To 렌더링 → Apply dates 제출이라는 한 경로만 유지한다.
- 기존 테스트의 `dateRange=custom → all` 기대값을 제거하고 입력란 렌더링 테스트로 교체한다.

**완료 조건**

- 빈 custom 진입 시 `Custom dates`가 활성 상태다.
- From/To가 둘 다 보인다.
- 한쪽 날짜만 입력해도 열린 범위로 동작한다.
- From > To이면 API를 호출하지 않고 현재 인라인 오류에 초점이 간다.
- 날짜를 적용한 뒤 검색·상태·정렬·페이지 크기가 유지된다.

### P1-2. 비공개 관리자 작성 리뷰 편집이 항상 실패할 수 있다

**문제 경로**

- 관리자 작성 리뷰는 상태와 무관하게 편집 가능하다(`reviews-table-section.tsx:343-351`).
- 편집 폼은 현재 status를 보내지만 `reportReason`을 항상 빈 문자열로 보낸다(`review-row-actions.tsx:194-198`).
- API는 상태가 `HIDDEN` 또는 `REPORTED`이면 `reportReason`이 없을 때 요청을 거부한다(`admin.service.ts:26096-26124`).
- 따라서 숨김/Needs review 상태의 관리자 작성 리뷰에서 본문이나 평점을 편집하면 UI는 일반 실패 알림으로 돌아갈 가능성이 높다.

**수정 방법**

가장 작은 안전한 수정은 두 계층을 함께 바로잡는 것이다.

1. 편집 요청은 상태 전환 요청과 구분하고, 상태가 변하지 않는 콘텐츠 편집에서는 기존 `reportReason`을 보존한다.
2. UI에서 현재 `reportReason`을 빈 값으로 덮어 보내지 않는다.
3. API는 비공개 상태로 새로 전환할 때만 새 moderation reason을 필수로 하고, 같은 비공개 상태에서 관리자 작성 콘텐츠만 수정할 때는 저장된 사유를 유지한다.
4. 고객 작성 리뷰 수정 거부와 edit reason 필수는 그대로 보존한다.

**완료 조건**

- 관리자 작성 PUBLISHED/HIDDEN/REPORTED 리뷰 각각에서 평점·본문 편집 성공.
- HIDDEN/REPORTED 편집 후 기존 moderation reason이 사라지지 않음.
- 상태는 편집 전과 동일하게 유지됨.
- 감사 로그 before/after/reason이 유지됨.
- 고객 작성 리뷰 콘텐츠 편집 요청은 계속 400으로 거부됨.
- 이 세 상태를 포괄하는 API 테스트와 Admin Web action 테스트 추가.

### P1-3. 실제 운영 정보가 disabled 색상으로 표시된다

**측정 결과**

- `.vuexy-review-copy-cell span`: 12px, `rgba(47, 43, 61, 0.4)`, 흰 배경 대비 **2.29:1**
- `.vuexy-review-card td small`: 12px, 같은 색, 대비 **2.29:1**
- 적용 정보: 서비스명, 관리자 작성 표시, 숨김/신고 사유, 앱 노출 설명 등

이 내용은 비활성 컨트롤이 아니라 운영 판단에 필요한 정보다. 특히 `Reason: Held by admin`과 `Not visible in app`가 흐려 감사 맥락을 놓치기 쉽다.

**근본 원인**

- `globals.css:22444-22450`과 `globals.css:19361-19364`가 정보성 텍스트에 `var(--admin-disabled)`를 사용한다.

**수정 방법**

- disabled 토큰은 실제 disabled UI에만 사용한다.
- 표의 정보성 보조 텍스트는 최소 `var(--admin-muted)` 또는 별도 secondary text 토큰으로 바꾼다.
- 12px를 유지한다면 밝은/어두운 테마 모두 최소 4.5:1을 충족한다.
- 서비스와 상태 사유는 13px/18px 정도로 올리면 스캔성이 더 안정적이다.

**완료 조건**

- 서비스, 사유, 앱 노출 문구가 두 테마 모두 4.5:1 이상.
- 비활성 메뉴/버튼만 disabled 토큰 사용.
- 1440×900에서 상태 사유를 확대 없이 읽을 수 있음.

## 6. P2 — 운영 효율을 높이기 위한 다음 수정

### P2-1. 1440px 필터 구조를 “상태 탭 + 작업 도구 한 줄”로 재구성한다

현재 1440px에서는 Status와 Submitted date가 첫 줄, Sort가 왼쪽 아래, Search/Rows/Apply가 오른쪽 아래, Export가 다시 그 아래로 떨어진다. 각 제어가 기능은 하지만 한 작업 묶음처럼 보이지 않는다. 검색 placeholder도 `Search customer, partner, booking, or...`에서 잘린다.

권장 구조:

1. 첫 줄: `All / Visible / Needs review / Hidden` 상태 탭
2. 둘째 줄: Search(가변 폭) + Submitted date select + Sort select + Rows select + `Update list` + Export
3. Custom dates를 고르면 셋째 줄에 네이티브 From/To + `Apply dates`

상태는 반복 사용하는 핵심 큐이므로 탭을 유지한다. 날짜 6개와 정렬 4개는 `<select>`가 더 짧고 일관적이다. 새 컴포넌트나 의존성을 만들지 말고 이미 쓰는 `AdminFormSelect`, `AdminFormDate`를 재사용하면 된다.

### P2-2. 첫 화면에 실제 리뷰 목록을 더 많이 보여준다

1440×900 첫 화면은 페이지 제목 카드 124px, 지표 50px, 필터 패널 약 430px가 차지해 표 제목만 겨우 보인다. 리뷰 운영 화면의 주 업무는 목록 판독과 조치이므로 최소 표 머리글과 첫 행은 첫 화면 안에 들어오는 편이 낫다.

권장:

- reviews 페이지의 헤더 padding을 24px → 16px 수준으로 줄인다.
- 페이지 설명, 필터 설명, 표 설명에서 반복되는 문장을 하나만 남긴다.
- 필터를 P2-1 구조로 바꿔 높이를 줄인다.
- 지표를 필터 패널 머리글과 결합하거나 상태 탭에 count를 붙인다.

1600px에서는 이미 표 머리글이 첫 화면에 들어오므로 목표는 1440px에서 같은 정보 우선순위를 만드는 것이다.

### P2-3. 같은 숫자가 세 번 반복되는 구조를 정리한다

기본 화면에서 `172`가 다음 위치에 반복된다.

- 상단 Results 지표
- Review filters 우측 `172 results`
- Customer reviews 우측 `172 reviews`

운영 가치가 있는 것은 전체/상태별 분포와 현재 필터 결과 두 종류뿐이다.

권장:

- 상단: 전체 Visible/Needs review/Hidden을 큐 링크로 제공
- 필터 패널: 현재 조건의 `172 matching` 하나만 제공
- 표 패널 우측 count 제거; 하단 pagination이 `Showing 1 to 10 of 172`를 이미 설명
- 표 제목은 페이지 제목과 중복되는 `Customer reviews` 대신 `Review queue` 사용

### P2-4. 현재 지표의 범위를 명확히 한다

상태나 검색을 적용하면 요약 API에도 같은 필터가 들어간다. 그래서 Needs review가 0건인 현재 데이터에서 해당 큐를 열면 Results/Visible/Needs review/Hidden이 모두 0이 된다. 기술적으로는 “현재 결과 요약”이지만 운영자는 상단 상태 숫자를 전체 큐 현황으로 해석하기 쉽다.

두 범위를 섞지 말아야 한다.

- 전체 큐 요약: 필터와 무관한 Visible/Needs review/Hidden, 각 항목은 해당 큐 링크
- 현재 결과: 검색·날짜·상태가 반영된 matching count와 평균 평점

최소 구현은 현재 filtered summary를 pagination에 유지하고 작은 unfiltered summary 요청 하나를 추가하는 것이다. 단, 실제 운영에서 전체 큐 수가 상시 필요하지 않다면 상단 지표를 제거하고 current result만 명확하게 표시하는 편이 더 단순하다.

### P2-5. 확인 UI를 실제 모달 동작과 일치시킨다

현재 확인 카드에는 `role="alertdialog"`, `aria-modal="true"`, 초점 트랩이 있지만 CSS position은 `static`이고 배경은 inert/aria-hidden이 아니다. 화면상으로는 페이지 맨 위에 삽입된 카드이며, 마우스로 뒤의 지표·필터를 클릭할 수 있다. 보조기술에는 모달이라고 알리면서 실제 포인터 동작은 모달이 아닌 상태다.

권장:

- 실제 modal/drawer로 쓸 경우 기존 backdrop + drawer/focus 유틸을 재사용하고 배경 포인터를 차단한다.
- Escape는 취소, 취소 후 원래 행 조치 버튼으로 초점 복귀, 기존 returnTo 유지.
- 인라인 확인 카드로 남길 경우 `aria-modal`과 강제 초점 트랩을 제거하고 주변 콘텐츠와 동일한 문서 흐름으로 취급한다.

위험 조치이므로 첫 번째 방식이 더 일관적이다.

### P2-6. moderation reason과 operator note를 분리한다

현재 사유는 5개 고정 선택지만 있다. 분류에는 좋지만 실제 케이스의 구체적 근거를 기록할 수 없다. 새 DB 필드는 필요 없다.

- `reportReason`: 현재 고정 카테고리 유지
- `reason`: 기존 API 감사 로그 필드를 이용해 `Operator note (optional)` 입력 추가
- 숨김/Needs review 확인 화면에서 선택 사유와 메모를 함께 저장
- 이력 화면에는 카테고리와 운영 메모를 구분해 표시

이미 `ConfirmDialog.textInputs`와 API의 `reason`이 있으므로 기존 도구를 재사용하면 된다.

### P2-7. 빈 큐 문구 조립 오류를 수정한다

현재 Needs review 빈 화면:

> No customer reviews currently match this queue. reviews removed from the app until moderation is resolved.

두 번째 문장이 소문자로 시작하고 주어가 빠져 있다. 문자열 조각을 이어 붙이지 말고 상태별 완성 문장을 반환한다.

권장 문구:

- Title: `No reviews need moderation`
- Body: `No reviews are currently waiting for a moderation decision. Current date range: All dates.`
- CTA: `View all reviews`

Hidden 빈 화면:

- Title: `No hidden reviews`
- Body: `No reviews are currently hidden from the customer app. Current date range: All dates.`

## 7. P3 — 다듬기 항목

### P3-1. 별점 옆에 숫자를 함께 표시한다

별만 보면 3점과 4점을 빠르게 세어야 한다. `★★★★★ 5/5`처럼 숫자를 함께 보여주면 정렬 결과를 더 빨리 검증할 수 있다. 현재 `aria-label`은 좋으므로 시각 텍스트만 보강한다.

### P3-2. Submitted와 Requested가 같은 경우 중복을 줄인다

현재 각 행은 리뷰 제출 시각과 예약 요청 시각을 모두 보여준다. 둘이 같은 샘플 데이터에서는 같은 날짜가 반복되어 ID와 핵심 리뷰 내용이 묻힌다.

- Submitted는 항상 유지
- Requested는 두 시각이 다르거나 예약 조사에 필요한 경우에만 보조 정보로 표시
- 또는 booking 링크 title/상세 화면으로 이동

단, 의미가 다른 데이터이므로 필드를 완전히 합치지는 않는다.

### P3-3. `Apply` 버튼 이름을 구체화한다

상태와 날짜 버튼은 즉시 적용되는데 검색/페이지 크기만 `Apply`를 눌러야 한다. `Update list` 또는 `Search`가 현재 동작을 더 잘 설명한다. Custom date에는 별도 `Apply dates`를 유지한다.

### P3-4. benign filter에 warning tone을 쓰지 않는다

현재 검색, 날짜, 정렬 중 하나만 활성화해도 result badge와 table badge가 warning 색상으로 바뀐다. `Oldest submitted`나 검색은 경고가 아니다.

- 일반 필터: neutral/info
- Needs review 큐: warning
- 데이터 오류: danger

톤을 의미에 맞게 제한하면 색상 신호의 신뢰도가 높아진다.

## 8. 제안하는 최종 화면 구조

```text
Customer Reviews                                      [Export]
Review customer feedback and control app visibility.

[All 172] [Visible 170] [Needs review 0] [Hidden 2]

Review queue                                      172 matching
[Search .........................................] [Date ▾] [Sort ▾] [Rows ▾] [Update list]
(Custom 선택 시) [From yyyy-mm-dd] [To yyyy-mm-dd] [Apply dates]
[Active filter chips] [Clear]

SUBMITTED | REVIEW | PARTIES | STATE | ACTIONS
...
Showing 1–10 of 172                            pagination
```

핵심은 새 기능 추가가 아니라 중복 제거와 우선순위 재배치다.

- 상태 큐는 빠른 탭으로 유지
- 보조 조건은 한 줄 도구로 축약
- 실제 목록을 첫 화면 위로 올림
- 전체 큐 count와 현재 결과 count를 명확히 구분
- 위험 조치는 기존 확인 흐름을 유지하되 실제 modal 동작과 일치

## 9. 구현 순서

### 1차 — 기능 결함과 접근성

1. Custom dates 정규화 결함 수정
2. HIDDEN/REPORTED 관리자 작성 리뷰 편집 시 기존 reportReason 보존
3. 표 보조 텍스트 대비 4.5:1 이상으로 수정
4. 위 세 경로의 회귀 테스트 추가

### 2차 — 운영 밀도

1. 필터를 상태 탭 + 한 줄 도구로 재구성
2. 결과 count 중복 제거
3. 첫 화면에 표 머리글과 첫 행 노출
4. 전체 큐/현재 결과 요약의 범위 분리

### 3차 — 확인·문구·미세 조정

1. 확인 카드를 실제 modal/drawer 동작으로 통일
2. operator note 추가
3. 빈 큐 완성 문장 적용
4. 별점 숫자, 버튼명, 필터 tone 정리

## 10. 필수 회귀 테스트

### Admin Web

- `/reviews` 기본 진입은 All dates이며 API에 from/to가 없음
- Custom dates 클릭만으로 From/To가 렌더링됨
- 한쪽 날짜만 입력하는 열린 범위 지원
- 역전 날짜는 인라인 오류 및 API 미호출
- 검색/상태/기간/정렬/페이지 크기가 서로 보존됨
- PUBLISHED/HIDDEN/REPORTED 관리자 작성 리뷰 편집 action payload 검증
- 고객 작성 리뷰에는 Edit Review가 없음
- 조치 링크가 returnTo를 보존함
- CSV가 0/1/100/101/172건에서 전체를 내보냄

### API

- 고객 작성 리뷰 rating/comment 수정 거부
- 관리자 작성 리뷰 세 상태에서 콘텐츠 편집 성공
- 비공개 상태 편집 시 기존 reportReason 보존
- 새 HIDDEN/REPORTED 전환은 moderation reason 필수
- PUBLISHED 전환은 reportReason 제거
- 평점 재계산은 PUBLISHED만 포함
- 감사 로그 before/after/actor/timestamp/reason 검증

### 브라우저

- 1440×900: 가로 스크롤 없음, 첫 표 머리글/첫 행 노출
- 1600×900: 필터가 의도한 한 줄 구조 유지
- 밝은/어두운 테마: 정보성 12–13px 텍스트 4.5:1 이상
- 메뉴: Enter/Space 열기, 방향키 이동, Escape 닫기, 초점 복귀
- 확인: 배경 클릭/Tab 차단, Escape 취소, 취소 후 원래 조치 버튼으로 복귀

## 11. 검증 결과

| 검증 | 결과 |
|---|---|
| Admin Web 리뷰 집중 테스트 | 9 files, 59 tests passed |
| API review 집중 테스트 | 70 passed, 483 skipped |
| Admin Web typecheck | 통과 |
| API typecheck | 통과 |
| 대상 파일 ESLint | exit 0; Pages 경로 안내 메시지만 출력 |
| Impeccable detector | 리뷰 전용 코드 경고 없음. 전체 `globals.css`의 다른 영역 side-tab 7건만 탐지 |

테스트가 모두 통과했지만 P1-1은 현재 테스트가 잘못된 기대값을 고정하고 있고, P1-2는 비공개 관리자 리뷰 편집 조합 테스트가 없어 발견되지 않는다. “테스트 통과”와 “운영 흐름 정상”을 동일하게 판단하면 안 된다.

## 12. 화면 증빙

| 파일 | 확인한 상태 |
|---|---|
| `01-reviews-top-1440.jpg` | 기본 상단, 반복 count, 1440 필터 줄바꿈 |
| `02-reviews-table-1440.jpg` | 1440 5열 표, 상태/조치/당사자 구성 |
| `03-review-action-menu-1440.jpg` | Visible 행의 Hide / Needs review 메뉴 |
| `04-needs-review-empty-1440.jpg` | Needs review 0건 큐 |
| `05-needs-review-empty-detail-1440.jpg` | 빈 화면 문구 조립 오류 |
| `06-hidden-reviews-top-1440.jpg` | Hidden 필터와 filtered summary |
| `07-hidden-reviews-table-1440.jpg` | 숨김 사유와 앱 비노출 상태 |
| `08-hidden-action-menu-1440.jpg` | Hidden 행의 Publish / Needs review 메뉴 |
| `09-custom-dates-no-fields-1440.jpg` | Custom dates 클릭 후 All dates로 복귀하는 결함 |
| `10-reviews-top-1600.jpg` | 1600 상단과 필터 배치 |
| `11-reviews-table-1600.jpg` | 1600 표 |
| `12-reviews-top-dark-1440.jpg` | 어두운 테마 |
| `13-hide-confirmation-1440.jpg` | Hide 확인 맥락, 사유 선택, 영향 설명 |

## 13. 최종 판정

현재 버전은 이전 감사의 본질적인 위험을 잘 줄였다. 특히 전체 기간 기본값, 상태 모델, 위험 조치 확인, 고객 원문 보호, 감사 로그, 전체 CSV는 합격이다. 다음 수정은 대규모 재설계가 아니라 세 가지 P1을 먼저 닫고, 1440px에서 필터와 중복 count를 압축해 실제 리뷰 행을 위로 올리는 작업이어야 한다.

**완료 판정 기준:** P1 3건을 수정하고 1440×900에서 Custom dates, 세 상태의 관리자 작성 리뷰 편집, 4.5:1 텍스트 대비를 실제 브라우저와 테스트로 모두 재검증할 것.
