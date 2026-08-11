# Codex 실행용 프롬프트 — Live Bookings 운영 UX 재개선

아래 프롬프트 전체를 `C:\dev\massage-on-demand-vn`을 작업 폴더로 연 Codex 작업에 붙여 넣는다.

---

## Prompt

당신은 HANDS 관리자 웹의 Live Bookings 운영 화면을 실제 운영자가 빠르고 안전하게 사용할 수 있도록 수정하는 시니어 풀스택 엔지니어다.

이번 작업은 분석이나 제안서 작성으로 끝내지 말고, 아래 감사 보고서를 근거로 **코드를 직접 수정하고 테스트와 실제 브라우저 검증까지 완료**하라.

### 1. 목표

`http://localhost:3101/bookings`의 Live 운영과 Records 조회를 명확히 분리하고 다음 문제를 근본적으로 해결하라.

1. 겹치는 단계·예외·기록을 모두 `Additional queues`로 부르는 정보구조.
2. `Marketplace open`, `Matching delays`, `No supply`의 문구와 실제 API predicate 불일치.
3. Needs action 등 액션 큐가 기본 `Newest first`로 열리는 문제.
4. Records에서 의미 없는 Requested age 필터와 Live 큐 메뉴가 노출되는 문제.
5. Records 표의 가로 스크롤, 열 침범, 중복 시간·상태·closure 문구.
6. Records에서 audit/test fixture 포함 여부를 판단할 수 없는 문제.
7. Custom dates의 보이는 라벨, 오류 연결, 포커스가 부족한 문제.
8. 검색 0건 문구, `Clear` badge, 실행처럼 보이는 상세 이동 링크 등 운영 문구 문제.
9. 0건인 12개 큐 링크를 `Show empty queues` 아래 같은 강조도로 보여 주는 문제.

완료 상태는 “코드가 빌드된다”가 아니라, 운영자가 첫 화면에서 현재 할 일과 이상 상태를 빠르게 파악하고 Records를 별도 조회 도구로 이해할 수 있는 상태다.

### 2. 반드시 먼저 읽을 자료

1. 저장소 지침:
   - `C:\dev\massage-on-demand-vn\AGENTS.md`
2. 감사 보고서:
   - `C:\dev\massage-on-demand-vn\output\bookings-improvement-verification-2026-08-07\bookings-post-implementation-deep-audit.md`
3. 핵심 화면 증거:
   - `01-needs-action-1440.png`
   - `05-records-30d-top-1440.png`
   - `06-records-30d-table-1440.png`
   - `08-records-search-empty-1440.png`
   - `10-records-custom-dates-error-1440.png`
   - `11-additional-empty-queues-expanded-1440.png`
   - `14-records-table-1600.png`

스크린샷은 위 보고서와 같은 output 디렉터리에 있다. 화면만 보고 추측하지 말고 현재 컴포넌트, API predicate, summary count, URL 생성, 테스트를 함께 추적하라.

### 3. 작업 규칙과 경계

- 반드시 `C:\dev\massage-on-demand-vn`에서 작업한다.
- `AGENTS.md`를 우선 적용하고 단일 에이전트로 작업한다. 서브에이전트를 사용하지 않는다.
- 현재 작업 트리는 매우 많이 변경되어 있을 수 있다. 시작 시 `git status --short`와 관련 파일의 `git diff`를 확인한다.
- 사용자의 기존 변경을 reset, checkout, revert, overwrite하지 않는다.
- 이번 작업과 관계없는 파일을 수정하지 않는다.
- 새 npm 패키지를 설치하지 않는다.
- 새 디자인 시스템, 새 상태관리 계층, 새 추상화, 새 라우트를 만들지 않는다.
- 현재 `?view=...` URL과 기존 Admin 컴포넌트·토큰·패턴을 재사용한다.
- 데이터베이스 schema와 migration을 변경하지 않는다.
- mobile app, public web, 인증, 결제 실행 로직, wallet/settlement 동작은 변경하지 않는다.
- 사용자에게 보이는 명칭은 항상 `Partner`를 사용한다. 내부 타입·DB 컬럼의 provider 명칭은 불필요하게 바꾸지 않는다.
- 실제 근거가 없는 marketplace flag, event, SLA 값을 발명하거나 하드코딩하지 않는다.
- 검증은 1440×900과 1600×900 데스크톱만 수행한다. 더 작은 viewport에 작업 시간이나 보고서 내용을 사용하지 않는다.
- 사용자가 요청하지 않았으므로 commit, push, 배포는 하지 않는다.
- 구현 중 불확실한 business predicate가 나오면 관련 모델·event·policy·기존 helper를 먼저 검색한다. 신뢰할 수 있는 persisted evidence가 없으면 추측 구현 대신 안전한 이름 변경 또는 해당 뷰 제거를 선택하고 최종 보고서에 이유를 적는다.

### 4. 먼저 추적할 코드

다음 파일과 모든 caller/test를 우선 확인하라. 줄 번호는 감사 당시 기준이므로 현재 코드에서는 심볼 이름으로 다시 찾는다.

- `apps/admin_web/app/bookings/booking-monitor.tsx`
- `apps/admin_web/app/bookings/booking-monitor-page.tsx`
- `apps/admin_web/app/bookings/booking-monitor-filters-section.tsx`
- `apps/admin_web/app/bookings/booking-monitor-options.ts`
- `apps/admin_web/app/bookings/booking-monitor-list-section.tsx`
- `apps/admin_web/app/bookings/booking-monitor-list-row-model.ts`
- `apps/admin_web/app/bookings/booking-monitor-next-action-label.ts`
- `apps/admin_web/app/bookings/booking-empty-message.ts`
- `apps/admin_web/app/bookings/booking-closure-list-signal.ts`
- `apps/admin_web/app/bookings/booking-monitor-route-load-plan.ts`
- `apps/admin_web/app/bookings/booking-page-params.ts`
- `apps/admin_web/components/admin-form-controls.tsx`
- `apps/admin_web/app/globals.css`
- `apps/admin_web/lib/booking-check-level.ts`
- `apps/api/src/admin/admin-booking-list-query.ts`
- booking list summary/count를 만드는 API 파일과 predicate helper
- 위 파일들의 관련 `*.spec.ts`와 `*.spec.tsx`

`rg`로 각 predicate와 helper의 모든 caller를 확인한 뒤 한 곳의 root cause를 고쳐라. 목록 query와 summary count가 다른 조건을 사용하지 않도록 특히 주의한다.

### 5. 구현 요구사항

#### A. Live 운영 정보구조

Live 화면에서 다음 관계가 시각적으로 분명해야 한다.

- `Work now`: Needs action
- `Monitor`: Live now, Matching now, In service
- `Additional exceptions`: 현재 실제로 조치가 필요한 예외만 표시
- `Booking records`: Live와 분리된 보조 이동 링크

요구사항:

1. `Needs action`을 가장 중요한 work queue로 유지한다.
2. `Live now`, `Matching now`, `In service`는 상호 배타적인 작업량이 아니라 monitoring view임을 그룹 라벨로 명확히 한다.
3. 겹치는 count를 계속 보여 주는 영역에는 `Views can overlap`처럼 합계가 아님을 짧게 알린다.
4. 현재의 `Additional queues / Live flow, exceptions, and history` 구조를 제거하거나 재구성한다.
5. `History`와 `Records`는 Live Additional에서 제거한다.
6. `Blocked today`는 booking row 큐가 아니므로 `Creation failures today` 상태/알림으로 분리한다.
7. 추가 예외가 모두 0이면 12개 링크를 표시하지 말고 다음처럼 한 줄만 보여 준다.
   - `No additional exceptions`
   - 보조 링크 또는 disclosure: `Browse queue directory`
8. `Browse queue directory`가 필요하면 기존 disclosure를 재사용한다. 0건 항목은 accent pill이 아닌 muted 일반 목록으로 표시하고 이름, count, 한 줄 목적만 제공한다.
9. Queue directory에는 History를 넣지 않는다.
10. Additional exceptions는 non-zero만 기본 노출하고 위험도/대기시간 순으로 정렬한다.

#### B. 숨겨진 큐의 predicate와 이름

다음은 CSS나 문구만 바꾸지 말고 실제 조건을 확인해야 한다.

##### Marketplace open

- 현재 `OPEN_MATCHING`만 검사한다면 `Matching now`와 중복되는 잘못된 의미다.
- 먼저 기존 metadata, matching event, marketplace open timestamp/flag, policy snapshot 또는 canonical helper가 있는지 찾는다.
- 기존 persisted evidence가 있으면 그것을 기준으로 list와 summary count를 동일하게 수정한다.
- reliable evidence가 없다면 새 필드나 migration을 만들지 말고 이 뷰를 `Open matching`으로 정확히 rename하거나 중복 뷰를 제거한다.

##### Matching delays

- 새 요청이 단순히 participant 0명이라는 이유만으로 즉시 delay가 되어서는 안 된다.
- `expired` 또는 `participant 없음 + 기존 정책에서 정한 대기 임계값 초과`만 포함한다.
- 임계값은 기존 operational policy/helper를 재사용한다. 새 magic number를 추가하지 않는다.

##### No supply

- 정상 초기 대기 상태와 운영 개입이 필요한 supply 문제를 구분한다.
- 초기 상태를 계속 보여 줘야 한다면 `No joins yet` 같은 진단/단계 필터로 표현한다.
- 예외 큐에는 기존 SLA 또는 matching deadline을 넘긴 경우만 올린다.

##### Matched now

- `In service`와 겹치지 않도록 범위를 확인한다.
- handoff 전후 상태만 의미한다면 `Matched / handoff`처럼 정확한 이름을 사용하고 `IN_SERVICE`는 제외한다.

##### 계약 테스트

- 각 view의 list predicate와 summary count predicate가 같다는 최소 계약 테스트를 추가한다.
- 겹침이 의도된 view는 테스트 이름과 UI helper에서 의도를 명시한다.

#### C. view별 기본 정렬

정렬 버튼의 현재 동작은 유지하되 기본값을 운영 목적에 맞춘다.

- Oldest first 기본:
  - Needs action
  - Matching delays
  - Handoff repair / Chat handoff missing
  - No supply / Supply intervention
  - Data anomaly
- Newest first 기본:
  - Booking records
- Live now, Matching now, In service는 현재 row 의미를 확인해 기존 newest 또는 더 적합한 기존 시간 필드를 선택한다. 새로운 정렬 종류는 만들지 않는다.

URL에 `sort`가 없을 때도 UI selected state, server load plan, API `orderBy`가 같은 기본값을 사용해야 한다. 브라우저에서 첫 행 날짜를 비교하고 단위 테스트를 추가한다.

#### D. Records를 별도 조회 workspace로 정리

새 라우트는 만들지 말고 현재 `/bookings?view=all` 및 기존 history view를 사용한다.

Records workspace에 포함할 view:

- All records
- Pre-match cancelled
- Preferred rejected
- Preferred no response

요구사항:

1. 위 view는 모두 `Booking records` 제목과 historical context를 사용한다.
2. Live primary queue와 Live Additional/Queue directory를 Records 안에 렌더링하지 않는다.
3. `Back to live bookings` 링크를 명확히 제공한다.
4. Records에는 검색, period, Records outcome, sort만 남긴다.
5. Requested age 필터는 Records와 history outcome view에서 완전히 제거한다.
6. 새 backend filter를 억지로 만들지 않는다. 기존 view를 outcome segmented control로 재사용한다.
7. period는 Today, Previous day, Last 7 days, Last month, Custom dates를 유지한다.
8. Records 상단에 실제 응답을 근거로 다음 정보를 한 줄로 표시한다.
   - Historical
   - 선택 period
   - total record count
   - audit/test fixture 포함 여부
9. `Audit fixtures may be visible`처럼 불확실한 문구를 사용하지 않는다. 현재 응답에 존재하면 `Audit fixtures included`, 없으면 운영 환경 정책에 맞는 확정 문구를 사용한다.
10. `Records 1290`을 Records 화면의 Additional 안에서 다시 보여 주지 않는다.

#### E. Records 표를 5열로 단순화

현재 6열에서 중복되는 `Last activity`를 Status에 합치거나 제거한다. 목표 구조:

1. `Booking · Customer`
   - booking ID link
   - request/opened time
   - customer name and masked phone
2. `Status · Closed`
   - status
   - 종료 또는 마지막 핵심 시각 한 번
   - closure evidence badge 최대 한 개
3. `Partner · Service`
   - final/requested Partner
   - service
   - customer price와 실제 의미가 확인된 Partner payout/minimum
4. `Area · Payment`
   - 서비스 주소/지역
   - payment outcome 또는 필요한 최소 상태
5. `Follow-up`
   - `Needs follow-up` 또는 `No follow-up`
   - 상세 이동 링크
   - 한두 줄의 이유

추가 요구사항:

- 1440×900과 1600×900에서 이웃 열 침범이 없어야 한다.
- 핵심 5열에 가로 스크롤이 없어야 한다.
- CSS로 긴 내용을 잘라 숨기는 것만으로 해결하지 않는다. 목록 정보량 자체를 줄인다.
- 초 단위 시각은 목록에서 제거한다.
- 상태 시각과 Last activity 시각을 중복 표시하지 않는다.
- closure의 raw note/reason 전체는 상세 페이지에서만 보여 준다.
- 행 전체가 클릭되지 않는다면 `Open a row for full evidence` 문구를 사용하지 않는다.
- 기존 상세 링크와 returnTo 동작은 보존한다.
- pagination 20행과 현재 페이지 이동 동작은 보존한다.

#### F. 운영 문구 정리

다음 원칙을 적용한다.

- `Clear`가 no active checks를 뜻한다면 `Checks clear`로 바꾼다.
- Records에서는 가능하면 check signal과 follow-up을 하나의 명확한 상태로 통합한다.
- follow-up 링크가 상세 페이지로 이동만 한다면 실행 명령처럼 보이지 않게 한다.
  - `Release payment hold` → `Review payment hold` 또는 `Open payment decision`
  - 실제 release 버튼은 상세 화면에서만 실행 동사 사용
- `actor missing closure` → `Closure actor missing`
- `provider closure` → `Closed by Partner`
- `Terminal booking has no explicit closure actor/reason saved yet.` → `Closure metadata missing`
- `No address`와 `Address missing`을 동시에 보여 주지 말고 `Service address missing` 한 개만 사용한다.
- `Minimum 300.000 VND`는 실제 의미를 확인해 `Partner minimum` 또는 `Partner payout`으로 명확히 한다.
- fixture 내부 note는 목록 본문에서 제거하고 `Test fixture` badge/tooltip 또는 상세에서만 보여 준다.
- UI 문장은 짧고 행동 주체와 다음 단계가 드러나야 한다.

#### G. 검색 빈 상태

Records 검색이 0건일 때 generic 초기 데이터 문구를 사용하지 않는다.

예시:

`No records match “{query}” in {period}. Clear the search or change the period.`

요구사항:

- query와 period를 현재 상태에서 가져온다.
- 결과 패널 내부에 `Clear search` 또는 `Reset filters`를 제공한다.
- 검색이 없는 실제 0건 상태와 검색/필터에 의한 0건 상태를 구분한다.
- 현재 `emptyBookingMessage`의 search branch가 Records에서도 호출되도록 root cause를 수정한다.

#### H. Custom dates 접근성

- `From`과 `To`를 화면에 보이는 label로 렌더링한다.
- validation 오류를 실제 date picker input에 `aria-invalid=true`로 연결한다.
- 오류 ID를 `aria-describedby`로 연결한다.
- 제출 실패 시 첫 오류 필드에 포커스를 이동한다.
- `AdminFormDate`의 non-native picker 경로가 `ariaDescribedBy`, `ariaInvalid`, 필요한 ref/focus 계약을 전달하지 않는다면 shared component에서 한 번 수정한다.
- shared component 변경 시 기존 date control 테스트를 보존하고 새 ARIA 전달 테스트를 추가한다.
- 시작일>종료일, 빈 값, 90일 제한의 기존 validation 동작을 보존한다.

#### I. 첫 화면 정보 밀도

1440×900에서 선택 큐의 제목, count, 첫 행 또는 빈 상태가 첫 화면에 보여야 한다.

- primary views와 검색은 즉시 보이게 유지한다.
- age와 order는 기존 disclosure/filter 패턴을 사용해 한 개의 compact `Filters` 영역으로 합칠 수 있다.
- 적용 중인 filter는 summary chip/text로 보여 준다.
- Additional exceptions 또는 Queue directory가 결과보다 앞에서 큰 높이를 차지하지 않게 한다.
- 새 popover 라이브러리나 custom overlay를 만들지 않는다. 기존 disclosure와 form components를 사용한다.

### 6. 유지해야 할 현재 장점

다음을 망가뜨리지 않는다.

- `/bookings` 기본 Needs action 선택과 URL/view 일치.
- `?view=active`의 Live now 선택과 전용 설명.
- Oldest/Newest 버튼 클릭 시 실제 정렬 방향이 맞는 현재 동작.
- Live 빈 큐의 구체적인 empty-state 문구.
- Stop/Start auto-refresh 동작, paused/socket/last refresh 상태.
- 검색 form submit과 정확 ID 검색.
- period preset과 custom date 90일 제한.
- Light/Dark theme.
- accessible table region name과 `aria-current` selected state.
- booking/customer/Partner/detail 링크와 returnTo.
- Completed와 Post-match Cancellations 전용 페이지의 기존 역할.

### 7. 구현 방식

다음 순서로 한 번에 완료하라.

1. Baseline
   - `git status --short`
   - 관련 파일 diff 확인
   - 현재 report와 screenshots 확인
   - 관련 테스트 목록 확인
2. Predicate와 sort
   - 실제 data evidence와 policy 추적
   - canonical predicate/helper 재사용
   - list/summary parity 수정
   - view별 기본 sort 수정
3. Information architecture
   - Live Work now/Monitor/Additional exceptions
   - Records workspace 분리
   - History outcome 이동
   - empty queues 제거/Queue directory 축소
4. Records table/copy
   - 5열과 follow-up 모델
   - 중복·raw diagnostic copy 제거
   - empty search 수정
5. Date accessibility
   - visible labels, invalid/describedby, focus
6. Verification
   - targeted tests
   - typecheck/lint 또는 scope verification
   - 실제 브라우저 1440×900, 1600×900
   - before/after screenshot 저장 및 직접 열어 확인

기존 helper나 컴포넌트로 해결할 수 있는 것은 재사용한다. 한 번만 쓰는 abstraction, 새 configuration layer, 미래용 확장 구조는 만들지 않는다.

### 8. 최소 테스트 요구사항

기존 테스트를 업데이트하고 다음 회귀 테스트를 추가하라.

#### Admin Web

- default view와 URL/view 일치.
- action view의 default sort는 oldest, Records는 newest.
- Records/history views에서 Requested age가 렌더링되지 않음.
- Records에서 Live primary/Additional가 렌더링되지 않음.
- Records outcome control과 Back to live bookings가 올바른 href를 가짐.
- 검색 0건 문구에 query/period와 clear action이 포함됨.
- 5개 Records header와 중복 Last activity 제거.
- `Checks clear`/follow-up copy가 모순되지 않음.
- Custom dates visible labels와 ARIA error 연결.
- Additional exceptions가 0일 때 12개 accent link가 나타나지 않음.
- non-zero exception은 올바른 링크와 count를 가짐.

#### API

- Marketplace open의 실제 predicate.
- 새 OPEN_MATCHING+0 participant가 Matching delays에 즉시 포함되지 않음.
- SLA/expiry를 넘은 무참여 요청은 Matching delays 또는 Supply intervention에 포함됨.
- Matched/handoff와 In service 범위가 의도대로 분리됨.
- list predicate와 summary count predicate parity.
- oldest/newest order 방향.

우선 다음 기존 테스트 묶음을 실행하고 변경에 맞게 보강하라.

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- app/bookings/booking-monitor-filters-section.spec.tsx app/bookings/booking-monitor-list-section.spec.tsx app/bookings/booking-monitor-route-load-plan.spec.ts app/bookings/booking-page-params.spec.ts app/bookings/booking-empty-message.spec.ts app/bookings/booking-list-time.spec.ts app/bookings/booking-monitor-live-status-section.spec.tsx app/bookings/booking-monitor-shell.spec.ts components/admin-form-controls.spec.tsx

npm.cmd run test --workspace @massage-vn/api -- src/admin/admin-booking-list-query.spec.ts src/admin/admin-queue-list.spec.ts
```

수정한 파일과 직접 관련된 추가 spec도 함께 실행한다.

그 다음 가능한 범위에서 다음을 실행한다.

```powershell
npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run verify:scope -- -Scope admin
```

API 동작을 수정했다면 API scope 검증도 실행한다.

```powershell
npm.cmd run verify:scope -- -Scope api
```

광범위한 기존 작업 트리 문제로 scope 검증이 실패하면 실패를 숨기지 말고, 이번 변경과 관련된 실패인지 구분해 최종 보고서에 적는다.

### 9. 브라우저 검증 시나리오

로그인 상태의 `http://localhost:3101/bookings`를 실제 브라우저에서 확인한다.

#### 1440×900

1. 기본 Needs action
   - default oldest 선택
   - Work now/Monitor 구분
   - 첫 행 또는 빈 상태가 첫 화면에 보임
2. Additional exceptions 0건
   - `No additional exceptions`
   - 12개 0건 pill이 주 화면에 없음
3. Queue directory
   - 필요한 경우에만 열림
   - History 없음
   - muted 목록과 설명
4. Records Last month
   - Live 큐/Additional/Requested age 없음
   - historical status와 fixture 여부 표시
   - outcome/period/search/sort만 표시
5. Records table
   - 5열
   - 가로 스크롤 없음
   - 열 침범 없음
   - raw closure/test note 없음
6. 검색
   - 실제 ID 1건
   - 없는 ID 0건과 정확한 문구/clear action
7. Custom dates
   - From/To 라벨
   - 빈 제출 오류, invalid state, focus
8. Stop/Start auto-refresh와 Light/Dark 회귀 확인

#### 1600×900

- Records 표의 Status/Booking 경계와 Follow-up 열을 다시 확인한다.
- 긴 이름, 주소 없음, closure metadata 없음, 긴 follow-up helper가 있어도 이웃 열을 침범하지 않아야 한다.

수정 후 스크린샷은 다음 폴더에 저장한다.

`C:\dev\massage-on-demand-vn\output\bookings-improvement-implementation-2026-08-07\`

각 스크린샷을 저장한 뒤 직접 열어 잘림, 겹침, 잘못된 selected state, 낮은 대비를 확인한다.

### 10. 완료 기준

다음을 모두 만족해야 완료다.

- Live에서 업무 큐, 모니터링 view, 예외, 기록이 구분된다.
- `Show empty queues`와 12개 동일 강조 0건 링크가 주 운영 흐름에서 사라진다.
- Marketplace/Delay/Supply 이름과 predicate가 일치하거나, 근거가 없으면 정확한 이름으로 축소된다.
- action queue 기본 oldest와 Records 기본 newest가 UI/API 모두 일치한다.
- Records/history에서 Requested age와 Live Additional이 보이지 않는다.
- Records에 historical period/count/fixture 신뢰 정보가 보인다.
- 1440과 1600에서 Records 핵심 표가 가로 스크롤과 열 침범 없이 읽힌다.
- `Clear`와 next action이 모순되지 않는다.
- 상세 이동 링크가 실행 action처럼 보이지 않는다.
- 검색 0건 문구가 query와 period를 설명하고 결과 안에서 복구할 수 있다.
- Custom dates의 보이는 라벨, invalid state, error description, focus가 동작한다.
- 관련 단위 테스트가 통과한다.
- 기존 Live empty state, pause/resume, theme, links, pagination이 회귀하지 않는다.

### 11. 최종 응답 형식

최종 응답은 구현 결과부터 간결하게 보고하고 다음을 포함한다.

1. 변경된 파일과 핵심 변경.
2. BKV-01~BKV-13 중 완료/부분 완료/미완료 상태.
3. 실행한 명령과 pass/fail/skipped.
4. 브라우저 검증 viewport와 저장한 screenshot 경로.
5. protected area를 건드렸는지 여부.
6. 보존한 기존 사용자 변경.
7. 신뢰할 수 있는 data evidence가 없어 rename/remove를 선택한 항목과 이유.
8. 남은 risk.
9. 다음 권장 작업 한 개.

단순히 “개선했다”고 쓰지 말고, 운영자가 무엇을 더 빨리 판단할 수 있게 되었는지와 어떤 acceptance criterion으로 확인했는지 보고하라.

---

## 이 프롬프트의 핵심 의도

- UI만 재배치하지 않고 queue predicate와 summary/list 일치까지 수정한다.
- 새 dependency나 route보다 기존 코드와 삭제/단순화를 우선한다.
- 근거 없는 business rule은 만들지 않는다.
- Records를 새로운 기능으로 확장하기보다 현재 quick lookup 역할에 맞게 줄인다.
- 실제 운영자의 판단 순서인 `지금 할 일 → 진행 상태 → 예외 → 기록 조회`를 화면 구조에 반영한다.
