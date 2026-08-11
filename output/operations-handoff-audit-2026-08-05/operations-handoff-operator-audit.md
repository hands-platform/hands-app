# Operations Handoff 운영자 UX·코드 감사 보고서

- 감사일: 2026-08-05
- 대상 저장소: `C:\dev\massage-on-demand-vn`
- 대상 화면:
  - `http://localhost:3101/operations-handoff`
  - `http://localhost:3101/operations-handoff?view=handoff`
  - 보조 확인 상태: `?details=all&range=7d`
- 검증 화면 크기: 1440×900, 1024×768
- 감사 방식: 로그인된 실제 관리자 화면 캡처, DOM/상호작용 상태 확인, Next.js 화면 코드와 Admin API 조건 대조
- 소스 수정: 없음

## 1. 최종 결론

현재처럼 사이드바에서 `Current Handoff`와 `Operations History`를 **두 개의 독립 페이지처럼 노출할 필요는 없다.** 하지만 두 내용을 한 화면에 전부 길게 펼쳐 놓는 방식도 권장하지 않는다.

가장 효율적인 구조는 다음과 같다.

1. 사이드바 메뉴는 `Shift Handoff` 하나만 둔다.
2. 한 workspace 안에서 다음 두 mode를 직접 전환한다.
   - `Current` — 인계 생성, 나에게 온 인계 확인, acknowledgement
   - `Handoff history` — 실제로 전송·확인된 인계 기록만 조회
3. 현재 `Operations History`에 섞여 있는 일반 booking/customer/Partner/finance 기록은 기존 전용 화면과 `Audit Log`로 돌린다.
4. URL과 데이터 요청은 mode별로 유지한다. 즉, 화면의 정보 구조만 하나로 합치고 Current와 History 데이터를 동시에 불러오지 않는다.

권장 최소 변경안은 기존 URL을 그대로 유지하는 것이다.

- `Current`: `/operations-handoff?view=handoff`
- `Handoff history`: `/operations-handoff`
- 사이드바 링크: `/operations-handoff?view=handoff` 하나
- 페이지 상단 mode navigation: `Current` / `Handoff history`

이 방식은 bookmark와 기존 링크를 깨지 않으면서 메뉴 중복을 없애고, 현재 코드의 조건부 데이터 로딩 장점도 유지한다.

> 핵심 판단: **두 개의 데이터 mode는 필요하지만, 두 개의 사이드바 페이지는 필요하지 않다.**

## 2. 현재 상태 총평

| 영역 | 상태 | 판단 |
|---|---|---|
| Current Handoff의 기본 목적 | 보통 | 인계 생성과 acknowledgement 개념은 존재한다. |
| 실제 open case 정확성 | 위험 | 현재 화면의 0건과 History의 88건이 모순되며, open case source가 전체 목록이 아닌 표본이다. |
| 인계 write 안전성 | 위험 | API 실패를 `adminPost`가 숨겨 운영자는 저장 실패를 알 수 없다. |
| Operations History의 역사성 | 위험 | 과거 기록 화면에 현재 미해결 queue와 현재 Partner 상태가 섞여 있다. |
| 날짜 범위 일관성 | 위험 | 일부 목록은 선택된 history range를 전혀 사용하지 않는다. |
| 목록 count와 row 일치 | 실패 | `0 rows`인데 `348 booking rows`로 표시되는 상태가 실제 화면에서 확인됐다. |
| 정보 구조 | 미흡 | 다섯 개의 대형 기록 목록과 기존 전용 페이지가 중복된다. |
| 1440px 레이아웃 | 보통 | 주요 폼은 읽히지만 카드 내부 scroll이 과하다. |
| 1024px 레이아웃 | 실패 | status가 잘리고 중첩 scroll로 핵심 action이 첫 화면에서 사라진다. |
| 접근성 기초 | 일부 양호 | heading, region, table, label은 있으나 multiple select와 중첩 scroll 위험이 크다. |

## 3. 감사 단계와 화면 상태

### Step 1 — Operations History 요약

상태: **부분적으로 양호**

![Operations History overview](C:/dev/massage-on-demand-vn/output/operations-handoff-audit-2026-08-05/01-operations-history-overview.png)

확인된 장점:

- 제목, 한 줄 설명, 날짜 범위가 명확하게 분리되어 있다.
- `Current handoff`로 이동하는 CTA가 보인다.
- History 화면에서 write button을 직접 제공하지 않는 방향은 맞다.
- handoff 기록과 operator note가 없을 때 빈 상태를 제공한다.

확인된 문제:

- `Current Handoff`와 `Operations History`가 사이드바에 나란히 있어 하나의 업무가 두 메뉴로 분리된다.
- page action에 `Shift command`, `Current handoff`, `View completed handoffs`가 동시에 있어 주 행동이 분산된다.
- `View completed handoffs`는 실제로 completed handoff만 여는 것이 아니라 current review queue, booking, customer, Partner, finance 목록까지 연다.
- summary 화면도 실제 표시하지 않는 Partner/finance summary API를 여러 개 요청한다.

### Step 2 — Detailed History의 filter와 activity

상태: **운영 개념이 잘못 섞임**

![History detailed filters](C:/dev/massage-on-demand-vn/output/operations-handoff-audit-2026-08-05/02-history-detailed-activity.png)

![History activity table](C:/dev/massage-on-demand-vn/output/operations-handoff-audit-2026-08-05/03-history-activity-table.png)

확인된 문제:

- read-only history 안에서 기본값이 `Needs review`다.
- `Current 7d`, `Legacy 7d+`, `All unresolved`가 history date range와 동시에 적용된다.
- API는 먼저 선택된 `range=7d`로 record를 자른 다음 current/legacy backlog를 나눈다. 따라서 `Legacy 7d+`는 구조상 0이 되기 쉽고 `All unresolved`도 실제 전체 날짜가 아니다.
- 화면은 `All unresolved (88)`이라고 말하지만 실제로는 선택된 7일 범위 안의 unresolved다.
- filter control이 24h priority, Review, Queue scope, Source, Reason, Age, Order로 길게 쌓여 table이 첫 viewport 아래로 밀린다.
- activity는 88건인데 한 페이지에 3건만 보여 30페이지가 된다.
- `Export visible rows`는 현재 보이는 3건만 export한다. 88건 검토 상황에서 운영 가치가 낮다.
- row action이 모두 `Open`이라 어디를 여는지 scan만으로 알기 어렵다.
- slash로 연결된 summary와 긴 review reason이 table 폭을 많이 소비한다.

### Step 3 — Booking/Customer/Partner history

상태: **데이터 신뢰 실패**

![Booking history count mismatch](C:/dev/massage-on-demand-vn/output/operations-handoff-audit-2026-08-05/08-booking-history-count-mismatch.png)

실제 확인된 모순:

- table 본문: `No booking history rows.`
- pagination summary: `Showing 0 to 0 of 348 booking rows`
- pagination: 116페이지

코드 원인:

- 서버는 3개의 booking row와 전체 count를 먼저 반환한다.
- client의 `buildBookingHandoffQueue`가 그 3개 중 active 또는 최근 120분 이내 항목만 다시 거른다.
- 현재 page의 3개가 모두 client predicate에서 빠져 row는 0이지만 total은 348로 남는다.

Customer/Partner 영역의 추가 문제:

- `Customer history` API에는 선택한 history range가 전달되지 않는다.
- `Partner history`도 선택한 history range를 전달하지 않고 현재 attention snapshot을 보여준다.
- `location 2d ago`, `ONLINE_AVAILABLE`, `Location stale` 같은 현재 운영 상태는 과거 History가 아니다.
- Customer와 Partner는 각각 전용 directory와 detail 화면이 이미 존재한다.
- `Partner history` 1,262건을 3건씩 보면 421페이지가 된다.
- 한 페이지 안에 여러 독립 pagination query가 누적되어 URL과 작업 기억이 복잡해진다.

### Step 4 — Current Handoff

상태: **구조는 있으나 안전한 운영에는 부족**

![Current Handoff form](C:/dev/massage-on-demand-vn/output/operations-handoff-audit-2026-08-05/04-current-handoff-form.png)

확인된 장점:

- outgoing operator, incoming operator, owner, cases, note의 기본 개념이 존재한다.
- final send 전에 preview를 거치도록 되어 있다.
- API는 acknowledgement를 assigned incoming operator만 수행할 수 있게 검사한다.
- acknowledgement는 별도 audit log로 남고 중복 acknowledgement를 막는다.

확인된 문제:

- History 상세에는 미해결 88건이 보이지만 Current Handoff에는 `No matching open cases`가 표시된다.
- 화면은 이 상태가 실제 0건인지 API 실패인지 설명하지 않는다.
- outgoing identity가 `Local Admin Web Actor`로 보여 실제 담당자의 식별력이 약하다.
- `Handoff label`을 매번 직접 작성해야 하며 날짜/shift 기본값이 없다.
- `Incoming operator`와 `Case owner`가 같은 위치에서 동일한 목록을 요구하지만 두 역할의 차이를 설명하지 않는다.
- incoming operator를 선택해도 owner가 자동 설정되지 않는다.
- open case 선택은 native multiple select다. 여러 항목 선택 방식, queue grouping, 나이, SLA, 금액, 링크를 제공하지 않는다.
- case search는 서버 전체 queue가 아니라 이미 받은 제한된 option 안에서만 검색한다.
- next action note 하나가 선택한 모든 case에 공통 적용된다.
- acknowledgement 대기 목록은 `Assigned to me`와 `Waiting for others`가 구분되지 않는다.

### Step 5 — 1024px 최소 지원 폭

상태: **실패**

![Current Handoff at 1024](C:/dev/massage-on-demand-vn/output/operations-handoff-audit-2026-08-05/05-current-handoff-1024.png)

![Operations History at 1024](C:/dev/massage-on-demand-vn/output/operations-handoff-audit-2026-08-05/06-operations-history-1024.png)

확인된 문제:

- Current Handoff의 `0 awaiting acknowledgement`가 오른쪽에서 잘린다.
- page scroll, sidebar scroll, card 내부 scroll이 동시에 존재한다.
- form의 case selector, note, preview action이 첫 화면에서 사라진다.
- 같은 높이 제한을 모든 `.operations-handoff-page > .card`에 적용해 간단한 form도 독립 scroll 영역이 된다.
- 820px table minimum width는 최소 지원 폭에서 내부 가로 scroll을 강제한다.

History 요약은 1024px에서 상대적으로 안정적이지만, action과 date button이 여러 줄로 내려가며 첫 viewport에서 실제 history 결과가 거의 보이지 않는다.

## 4. P0 — 먼저 고쳐야 할 문제

### P0-1. History에서 live unresolved queue 제거

증거:

- History 설명은 `Read-only ... past operations`다.
- 상세 activity 기본값은 `Needs review`이며 88건의 현재 미결정 record를 보여준다.
- `page.spec.tsx`는 live queue를 History에서 제외한다고 주장하지만 실제 default model은 그렇지 않다.

운영 위험:

- 운영자는 History에서 현재 처리할 일을 보고, Shift command/Current Handoff와 어느 쪽이 정식 queue인지 판단하기 어렵다.
- 같은 unresolved record가 여러 화면에 다른 count로 나타난다.

수정 기준:

- Current/open work는 `Shift command`와 `Current Handoff`에서만 다룬다.
- Handoff history는 `operations.shift_handoff.create`와 `operations.shift_handoff.acknowledge` 기록만 보여준다.
- 일반 operations event history가 꼭 필요하면 `Audit Log`의 saved filter로 제공한다.
- History 안에 activity를 유지해야 한다면 기본 mode는 `All records / newest first`로 하고 `Needs review`와 backlog control은 제거한다.

### P0-2. Current Handoff가 실제 전체 open case를 사용하도록 수정

현재 open case option은 start-shift summary의 `nextCases`를 재사용한다. API query는 각 queue의 current/overdue/legacy에서 최대 3개씩만 내려준다.

코드 근거:

- Admin API aggregation: `currentCaseIds`, `overdueCaseIds`, `legacyCaseIds` 각각 `[1:3]`
- Admin page: `action.nextCases`만 option으로 변환
- search: 내려받은 option 안에서만 client filter

운영 위험:

- 전체 backlog가 아니라 표본만 인계할 수 있다.
- 표본에 없는 건은 검색해도 나오지 않는다.
- API가 실패하면 fallback `null` 때문에 실제 backlog와 진짜 0건을 구분할 수 없다.

수정 기준:

- start-shift summary의 teaser 목록을 form source로 사용하지 않는다.
- 기존 `action_items` CTE를 재사용한 paginated open-case endpoint를 제공한다.
- 최소 응답 사실:
  - `caseId`
  - `queueKey`와 운영자 label
  - `occurredAt` / age
  - `slaMinutes` / overdue
  - amount와 currency가 의미 있는 queue라면 금액
  - detail URL
  - 현재 owner가 있으면 owner
- total count와 rows가 같은 predicate를 사용해야 한다.
- API 실패는 `Open cases unavailable` error state로 표시하고 send를 막는다.

### P0-3. write 실패를 운영자에게 숨기지 않기

`createOperationsShiftHandoff`와 `acknowledgeOperationsShiftHandoff`는 `adminPost(..., null)`을 사용한다. `adminPost`는 permission 거부, non-2xx, network error에서 fallback을 반환한다.

결과:

- 인계를 보냈지만 실제로 저장되지 않아도 화면에 실패 이유가 없다.
- acknowledgement가 실패해도 운영자는 다시 목록만 보게 된다.

수정 기준:

- 기존 `adminPostOrThrow`와 프로젝트의 action-state/error notice pattern을 사용한다.
- create 성공: `Handoff sent to {operator}.`
- acknowledgement 성공: `Handoff acknowledged at {time}.`
- conflict: `This handoff was already acknowledged.`
- case stale: `Some selected cases are no longer open. Review the list and try again.`
- permission: `You do not have permission to send or acknowledge this handoff.`
- submit 중 중복 전송을 막고 버튼에 pending state를 표시한다.

### P0-4. `Clear handoff` 판정 수정

현재 preview는 선택한 case가 0개면 무조건 `Clear handoff`라고 표시한다. openCases에 항목이 있어도 선택하지 않으면 clear로 보낼 수 있다.

수정 기준:

- server open count가 0일 때만 `Clear handoff`를 허용한다.
- open count가 1개 이상인데 선택이 0이면 preview/send를 막고 `Select at least one open case, or resolve the queue before sending a clear handoff.`를 표시한다.
- 일부만 선택했으면 `3 selected · 12 remain open`처럼 보여준다.
- clear handoff도 감사상 의미가 있다면 `No open cases at handoff time` 사실을 server에서 다시 확인하고 기록한다.

### P0-5. operator 선택을 권한 가능한 operator로 제한

현재 directory는 Admin/Finance Approver/Master Admin role이 있는 최근 50명만 가져온다. 화면에는 role, category permission, active status를 보여주지 않는다.

실제 DOM에는 다음처럼 운영자가 혼동할 label이 있었다.

- 고객/Partner 성격의 이름을 가진 계정
- 이름 없이 전화번호만 있는 다수 항목
- Finance approver와 일반 Admin이 같은 형식으로 섞인 목록

API는 selected case의 queue와 incoming operator permission category의 호환성을 검증하지 않는다.

수정 기준:

- active operator directory를 사용하고 inactive/revoked operator를 제외한다.
- option label: `Full name · Role · email`을 우선하고 전화번호는 보조 정보로 내린다.
- 50명 hard limit 대신 검색 가능한 operator combobox 또는 충분한 active directory 응답을 사용한다.
- selected case별 required category와 incoming operator category를 비교한다.
- 접근할 수 없는 case가 포함되면 send를 막고 정확한 이유를 표시한다.
- current operator 자신을 incoming으로 선택할 수 있는지 제품 규칙을 명시한다.

### P0-6. 선택한 history range가 모든 History 데이터에 적용되도록 수정

현재 range 불일치:

- acknowledged shift handoff API: range 없음, pagination 없음
- Customer history: range 없음
- Partner history: range 없음
- Partner 상태: historical fact가 아니라 current snapshot
- operator notes/activity/finance 일부만 range 적용

수정 기준:

- Handoff history API에 `range`, `page`, `pageSize`, optional operator filter를 추가한다.
- 화면의 date filter는 실제 handoff `createdAt` 또는 `acknowledgedAt` 중 무엇을 기준으로 하는지 label로 밝힌다.
- 추천: `Handoff date`는 create time, `Acknowledged at`은 별도 열.
- range를 적용할 수 없는 current snapshot section은 History에서 제거한다.

### P0-7. Booking history의 row/count predicate 통일

현재 server pagination 뒤에 client filter가 한 번 더 적용되어 0/348 모순이 발생한다.

수정 기준:

- History records라면 client의 active/recent filter를 제거하고 서버가 반환한 history row를 그대로 표시한다.
- live attention queue라면 predicate를 API query에 옮기고 totalRows도 같은 predicate로 센다.
- history 화면에 live attention queue를 두지 않는 것이 더 단순하고 권장된다.

### P0-8. 중첩 scroll과 1024 clipping 제거

코드 원인:

- 모든 direct card에 `max-height: min(960px, calc(100vh - 96px))`
- direct card에 `overflow-y: auto`
- table container에도 별도 max-height와 overflow
- table min-width 820px

수정 기준:

- form, empty state, compact summary card에는 내부 세로 scroll을 사용하지 않는다.
- 긴 data table만 `AdminTableScroll`의 가로 scroll을 사용한다.
- 페이지 자체가 자연스럽게 세로 scroll되도록 한다.
- toolbar status/action은 1024px에서 wrap하고 잘리지 않아야 한다.
- 1024×768, 1280×720, 1440×900에서 nested vertical scrollbar가 없어야 한다.

## 5. P1 — 운영 속도를 높이는 구조 개선

### P1-1. 하나의 Shift Handoff workspace로 통합

권장 상단:

```text
Shift Handoff
Transfer unresolved work to the next operator and confirm receipt.

[ Current  0 waiting ] [ Handoff history ]
```

사이드바에서는 `Current Handoff`, `Operations History` 두 항목을 제거하고 `Shift Handoff` 하나만 둔다.

mode 전환은 같은 업무의 peer navigation이므로 segmented link 또는 tab navigation으로 표현한다. 페이지 title과 section title을 똑같이 두 번 반복하지 않는다.

### P1-2. Current 화면을 ‘form 먼저’가 아니라 ‘받은 일 → 보낼 일’ 순서로 구성

권장 순서:

1. `Assigned to me` — 내가 acknowledgement해야 하는 인계
2. `Waiting for others` — 이미 보냈지만 아직 확인되지 않은 인계
3. `Create handoff` — 새 인계 작성

현재는 create form이 먼저 나오고 acknowledgement queue가 아래에 있어 incoming operator의 첫 작업이 늦게 보인다.

### P1-3. open case 선택을 table/checklist로 변경

권장 열:

| 선택 | Queue | Case | Age / SLA | Amount | Current state | Owner | Open |
|---|---|---|---|---|---|---|---|

- checkbox는 keyboard로 개별 선택 가능해야 한다.
- queue group별 `Select visible` 정도만 제공한다.
- case ID만 보여주지 말고 운영 label과 direct link를 제공한다.
- 기본 sort는 priority 후 oldest다.
- 검색, queue, age filter를 제공하되 처음부터 모든 filter를 펼치지 않는다.

### P1-4. incoming operator와 owner 관계 단순화

권장 기본 동작:

- `Incoming operator`를 선택하면 `Default case owner`를 같은 사람으로 자동 설정한다.
- 대부분의 인계에서는 owner field를 별도로 입력하지 않는다.
- 다른 owner가 필요할 때만 `Assign a different owner`를 펼친다.
- 선택한 case마다 owner가 달라야 한다면 global owner field를 유지하지 말고 case row에서 예외만 변경한다.

### P1-5. handoff label 자동화

자유 입력 required field 대신 다음을 기본값으로 만든다.

- `5 Aug 2026 · Evening handoff`
- 또는 운영 shift schedule이 있다면 해당 shift명

label은 수정 가능하되 필수 작업을 늘리지 않는다.

### P1-6. History를 실제 handoff 기록 table 하나로 축소

권장 열:

| Sent at | Shift | Outgoing | Incoming | Cases | Owner | Status | Acknowledged at | Open |
|---|---|---|---|---|---|---|---|---|

필터:

- date range
- outgoing/incoming operator
- `Acknowledged` / `Waiting`
- case ID 검색

상세 drawer 또는 expanded row:

- selected case links
- next action note
- acknowledgement actor/time
- audit record link

Customer, Partner, Booking, Finance의 일반 목록은 이 화면에서 제거한다.

### P1-7. page size 3 제거

현재 page size 3은 다음과 같은 페이지 수를 만든다.

- activity 88건 → 30페이지
- booking 348건 → 116페이지
- Partner 1,262건 → 421페이지
- finance decision 221건 → 74페이지

권장:

- handoff history 기본 25건
- open case 선택 기본 20~25건
- 페이지당 3건은 dashboard preview에만 사용
- History에 여러 목록을 남겨야 한다면 active section 하나만 pagination한다.

### P1-8. 불필요한 summary API 요청 제거

현재 History summary mode는 화면에 사용하지 않는 Partner, cash settlement, finance closeout summary, finance decision summary 등을 요청하고 model까지 계산한다.

수정 기준:

- summary mode에서 실제로 렌더링하는 handoff history와 operator note 데이터만 요청한다.
- 카드 count를 표시할 계획이 없다면 count API도 호출하지 않는다.
- full history mode도 한 번에 다섯 목록을 load하지 않고 선택한 section만 load한다.

## 6. P2 — 문구와 마감 품질

### 권장 문구

| 현재 문구 | 권장 문구 |
|---|---|
| `Current Handoff` | page title은 `Shift Handoff`, mode는 `Current` |
| `Operations History` | `Handoff history` |
| `Select the incoming operator, owner, and unresolved open cases.` | `Choose who receives the shift and which open cases need follow-up.` |
| `Handoff label` | `Shift label` |
| `Case owner` | `Default case owner` |
| `Unresolved open cases` | `Cases to hand over` |
| `Next action note` | `Handoff note` |
| `Preview handoff` | 유지 |
| `Send handoff` | `Send to {operator}` |
| `No matching open cases` | filter 결과면 `No open cases match this search.` |
| 실제 queue 0건 | `No open cases are waiting for handoff.` |
| API 실패 | `Open cases could not be loaded. Retry before sending a handoff.` |
| `View completed handoffs` | `Handoff history` |
| generic `Open` | `Open booking`, `Open payment`, `Open audit record` |

### 추가 마감 항목

- full ID를 tooltip/copy 또는 detail에 제공하고 짧은 ID 충돌을 방지한다.
- operator phone은 primary identity가 아니라 보조 정보로 표시한다.
- filter가 없을 때와 API error일 때 같은 empty state를 쓰지 않는다.
- History date의 timezone을 `Asia/Ho_Chi_Minh`로 명시하거나 shared date convention을 따른다.
- status는 색상뿐 아니라 `Waiting`, `Acknowledged`, `Overdue` 텍스트를 유지한다.
- `0 awaiting acknowledgement`는 success badge보다 neutral 상태가 더 적합하다.
- acknowledgement row의 장식용 clipboard icon만 남기지 말고 `Waiting for {operator}` 같은 명시적 상태를 제공한다.

## 7. 접근성 위험

스크린샷과 DOM에서 확인 가능한 범위의 위험이다. 전체 WCAG 준수 여부를 의미하지 않는다.

1. native multiple select는 Ctrl/Shift 선택 지식에 의존하고 선택 상태를 비교하기 어렵다.
2. card 내부 scroll과 table 내부 scroll이 겹쳐 keyboard/trackpad/zoom 사용자가 현재 scroll context를 잃기 쉽다.
3. 1024px에서 status badge가 잘려 정보가 perceivable하지 않다.
4. `Open` 링크가 여러 row에서 반복되어 screen reader link list에서 목적지를 구분하기 어렵다.
5. `Current`, `History`를 합칠 때 tab semantics를 억지로 쓰지 말고 URL navigation이면 labelled navigation + `aria-current`를 사용한다.
6. create/acknowledge 후 success/error가 focus와 live region으로 전달되어야 한다.
7. disabled preview button에만 의존하지 말고 왜 진행할 수 없는지 text로 설명해야 한다.
8. operator option은 이름/역할이 불명확해 assistive technology에서도 항목을 구분하기 어렵다.

검증해야 할 항목:

- Tab/Shift+Tab 순서
- checkbox list의 keyboard 선택
- 200% browser zoom
- focus가 scroll container 안에서 가려지지 않는지
- create/acknowledge error live announcement
- muted text와 tonal badge의 light/dark contrast

## 8. 유지해야 할 좋은 구현

다음은 제거하지 않는다.

- `view=handoff` branch가 History payload를 불러오지 않는 조건부 loading
- History에서 final write action을 직접 제공하지 않는 원칙
- send 전 preview 단계
- assigned incoming operator만 acknowledgement할 수 있는 API 검사
- acknowledgement 중복 방지
- create/acknowledgement audit log
- server filtering과 pagination 방향
- shared Admin components와 Vuexy token 사용
- heading, region, semantic table 기본 구조
- 현재 확인 시 console error가 없었던 상태

## 9. 권장 정보 구조

```text
Live Operations
└─ Shift Handoff
   ├─ Current
   │  ├─ Assigned to me
   │  ├─ Waiting for others
   │  └─ Create handoff
   │     ├─ Incoming operator
   │     ├─ Cases to hand over
   │     ├─ Default owner (advanced override)
   │     ├─ Handoff note
   │     └─ Preview → Send
   └─ Handoff history
      ├─ Handoff date range
      ├─ Operator / status / case search
      └─ Paginated handoff records

Admin & System
└─ Audit Log
   └─ Operations activity saved filter

각 도메인 상세 기록
├─ Bookings
├─ Customers
├─ Partners
└─ Finance records
```

이 구조에서는 Shift Handoff가 다른 도메인의 directory를 복제하지 않는다.

## 10. 구현 영향 파일

주요 Admin Web:

- `apps/admin_web/lib/admin-navigation.ts`
- `apps/admin_web/app/operations-handoff/page.tsx`
- `apps/admin_web/app/operations-handoff/operations-shift-handoff-form.tsx`
- `apps/admin_web/app/operations-handoff/operations-shift-handoff-section.tsx`
- `apps/admin_web/app/operations-handoff/actions.ts`
- `apps/admin_web/app/operations-handoff/operations-handoff-page-model.ts`
- `apps/admin_web/app/operations-handoff/operations-handoff-pagination.tsx`
- `apps/admin_web/app/operations-handoff/operations-handoff-activity-stream-section.tsx`
- `apps/admin_web/app/operations-handoff/operations-handoff-booking-queue.ts`
- `apps/admin_web/app/globals.css`
- 관련 `.spec.ts` / `.spec.tsx`

주요 API:

- `apps/api/src/admin/admin-governance.routes.ts`
- `apps/api/src/admin/admin.service.ts`
- `apps/api/src/admin/admin-start-shift-open-cases.ts`
- 관련 Admin service/controller tests

새 DB table이나 migration은 우선 필요하지 않다. 기존 open-case CTE와 Admin audit metadata를 재사용하는 것이 가장 작은 구현이다.

권장 metadata 보강:

- 현재 `unresolvedCaseIds: string[]`만 저장한다.
- 동일 ID 형식이 여러 queue에 걸칠 수 있고 history에서 link를 복원하기 어렵다.
- DB schema 변경 없이 audit metadata를 `{ caseId, queueKey }[]`로 확장하고 legacy string array도 읽도록 호환한다.

## 11. 구현 순서

### Phase 1 — 데이터 신뢰와 write 안전성

1. create/acknowledge error를 숨기지 않게 변경
2. full open-case endpoint와 정확한 total 제공
3. clear handoff server validation
4. operator eligibility와 case permission 검증
5. History range/count predicate 수정
6. booking row/count 불일치 제거

### Phase 2 — 정보 구조 축소

1. 사이드바 `Shift Handoff` 하나로 통합
2. Current/Handoff history mode navigation 추가
3. generic operations lists를 Audit Log/전용 화면으로 이동
4. Current를 Assigned to me → Waiting for others → Create 순서로 변경
5. History를 단일 handoff record table로 변경

### Phase 3 — 화면 밀도와 접근성

1. page size 20~25
2. native multiple select를 checkbox table로 교체
3. owner 기본값/advanced override
4. nested vertical scroll 제거
5. 1024/1280/1440과 keyboard/zoom 검증

## 12. 완료 조건

- 사이드바에는 `Shift Handoff` 하나만 보인다.
- Current와 Handoff history를 페이지 상단에서 직접 전환할 수 있다.
- 기존 두 URL은 계속 동작한다.
- Current mode는 History payload를 요청하지 않는다.
- History mode는 Current open queue payload를 요청하지 않는다.
- Current open case count와 선택 가능한 rows가 같은 predicate를 사용한다.
- 전체 backlog를 search/paginate할 수 있고 3개 표본에 제한되지 않는다.
- API 실패와 진짜 0건이 다른 상태로 보인다.
- 실제 open case가 남아 있으면 `Clear handoff`를 보낼 수 없다.
- incoming operator가 선택 case에 접근할 권한이 없으면 send가 차단된다.
- create/acknowledge success와 error가 명시적으로 보인다.
- Handoff history date range가 count와 rows에 동일하게 적용된다.
- `No rows`와 양수 total count가 동시에 표시되지 않는다.
- History에는 current Customer/Partner snapshot이 없다.
- 한 페이지당 3건 pagination이 제거된다.
- 1024×768에서 status, form, action이 잘리지 않는다.
- page/card/table의 중첩 세로 scrollbar가 없다.
- keyboard와 200% zoom에서 핵심 작업이 가능하다.

## 13. 증거 한계

- 현재 데이터에는 전송된 open handoff와 acknowledged history record가 없어 실제 acknowledgement row의 시각 상태를 캡처하지 못했다.
- 외부 side effect를 만들지 않기 위해 handoff를 실제 전송하거나 acknowledgement하지 않았다.
- operator select의 option 내용은 DOM에서 확인했으나 native dropdown overlay는 screenshot에 포함되지 않았다.
- `No matching open cases`가 실제 0건인지 start-shift summary API 실패인지 화면만으로 구분할 수 없었다. 이 구분 불가능성 자체가 P0 finding이다.
- screen reader와 실제 200% zoom은 수행하지 않았으므로 접근성 항목은 코드/DOM/화면 기반 위험 평가다.

