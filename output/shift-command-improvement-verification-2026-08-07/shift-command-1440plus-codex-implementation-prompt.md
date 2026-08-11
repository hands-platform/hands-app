# Shift Command 1440px+ 개선 구현용 Codex 프롬프트

아래 프롬프트를 `C:\dev\massage-on-demand-vn` 프로젝트를 연 Codex 작업에 그대로 붙여 넣는다. 여러 파일의 UI, 집계 의미, 테스트를 함께 다루므로 reasoning은 High가 적절하다.

---

## 복사해서 사용할 프롬프트

```text
너는 C:\dev\massage-on-demand-vn 저장소의 HANDS Admin 운영 화면을 수정한다.

이번 작업은 분석이나 제안만 하는 작업이 아니다. 현재 코드를 충분히 추적한 뒤 실제 코드를 수정하고, 테스트와 로그인된 실제 화면 검증까지 완료하라.

# 1. 목표

관리자 첫 화면 `/`의 Shift Command를 실제 운영자가 다음 업무를 빠르고 정확하게 결정할 수 있는 1440px 이상 데스크톱 전용 command surface로 완성한다.

이미 완료된 개선 방향은 유지한다.

- Finance를 포함한 전역 `Next action`
- Team과 Assignee 구분
- Mine, Unassigned, SLA overdue, Open handoff
- `Today so far`, source health, generated time, auto refresh
- Clear queue 축소
- 빈 Today 차트 compact 처리
- Partner `Needs attention` 자동 선택
- 기존 light/dark design token과 admin component 체계

# 2. 먼저 읽을 자료

작업 전에 다음 파일을 읽고 현재 구현과 호출 관계를 확인하라.

- C:\dev\massage-on-demand-vn\output\shift-command-improvement-verification-2026-08-07\shift-command-post-implementation-deep-audit.md
- C:\dev\massage-on-demand-vn\apps\admin_web\app\page.tsx
- C:\dev\massage-on-demand-vn\apps\admin_web\app\start-shift-action-priority.ts
- C:\dev\massage-on-demand-vn\apps\admin_web\components\start-shift-chart-widgets.tsx
- C:\dev\massage-on-demand-vn\apps\admin_web\components\start-shift-ranking-widgets.tsx
- C:\dev\massage-on-demand-vn\apps\admin_web\components\start-shift-refresh-button.tsx
- C:\dev\massage-on-demand-vn\apps\admin_web\components\admin-surface.tsx
- C:\dev\massage-on-demand-vn\apps\admin_web\app\globals.css
- C:\dev\massage-on-demand-vn\apps\api\src\admin\admin.service.ts
- 위 코드의 관련 spec 파일과 formatter/helper

저장소의 AGENTS.md와 더 가까운 하위 AGENTS.md가 있으면 먼저 읽고 따른다. 관련 helper, formatter, component가 이미 있으면 재사용하고 새 추상화는 최소화한다.

# 3. 지원 화면 범위

이번 작업의 공식 지원 범위는 다음과 같다.

- 최소 viewport: 1440×900
- 대상: 1440px 이상 데스크톱 관리자 화면
- 검증 권장: 1440×900과 1600×900
- light mode와 dark mode 모두 확인

다음은 명시적으로 범위 밖이다.

- 1439px 이하 viewport
- 1280px, 1024px, tablet, mobile
- 200% 확대 대응
- 모바일 navigation 또는 desktop-only gate 변경
- 1439px 이하만을 위한 breakpoint/CSS 수정

기존 작은 화면 코드를 일부러 삭제하거나 망가뜨릴 필요는 없지만, 작은 화면 문제 때문에 설계나 구현을 확장하지 마라. 완료 판정과 시각 QA는 1440px 이상만 사용한다.

# 4. 운영 화면 설계 원칙

이 화면의 mode는 `Operate`다. 예쁜 장식보다 판단 속도, 데이터 의미, 행동 연결이 우선이다.

- 화면 최상단에서 operator가 `무엇을`, `왜`, `누가`, `언제까지`, `얼마나 큰 영향으로` 처리해야 하는지 알 수 있어야 한다.
- 위험, 경고, 정보, 정상 상태는 기존 token과 component로 일관되게 표현한다.
- 같은 숫자를 다른 단위로 섞지 않는다. cases, queues, overdue, unassigned, VND를 명시한다.
- 같은 행동과 같은 기간 정보는 반복하지 않는다.
- 새 dashboard card, decorative badge, gradient, animation을 불필요하게 추가하지 않는다.
- 영어 UI 문구는 개발자 용어보다 운영자가 바로 이해할 수 있는 표현을 사용한다.
- empty, stale, unavailable, partial source 상태를 기존 방식대로 유지한다.

# 5. 구현할 변경 사항

아래 순서대로 구현한다.

## A. 잘못된 conversion/funnel 의미 제거 — 최우선

현재 7일 화면의 Requests, Matched, Started, Completed, Cancelled, No show는 각각 서로 다른 발생 시각으로 집계된다.

- Requests: Booking.createdAt
- Matched: Booking.matchedAt
- Started: service.started notification.createdAt
- Completed: ProviderEarning.createdAt
- Cancelled/No show: closedAt 또는 updatedAt

따라서 현재 프론트의 `Request-to-completion`과 aggregate `Match rate`는 동일 booking cohort의 전환율이 아니다.

이번 작업에서는 새 cohort API를 만들지 말고 가장 작은 안전한 수정을 적용하라.

1. `Booking flow`를 `Operational events`로 변경한다.
2. 설명을 `Events recorded in the selected period; counts are not a same-cohort funnel.`처럼 명확하게 바꾼다.
3. chart series label도 `Requests created`, `Bookings matched`, `Services started`, `Bookings completed`처럼 독립 사건임을 드러낸다.
4. `Shift outcome`의 `Request-to-completion`, aggregate `Match rate`, completion progressbar를 제거한다.
5. 해당 카드는 `Period event totals`로 바꾸고 사건별 합계만 보여준다.
6. 접근성용 data table은 유지하되 funnel/conversion으로 읽히는 title과 aria label을 수정한다.
7. 사용하지 않게 된 rate 계산 함수와 코드는 삭제한다.
8. backend API 집계는 다른 사용자가 없고 변경이 반드시 필요한 경우가 아니면 건드리지 않는다.

완료 조건:

- Started보다 Completed가 큰 데이터도 설명상 모순이 아니다.
- 동일 cohort가 아닌 값을 conversion, completion rate, match rate라고 부르지 않는다.
- `Request-to-completion` 문자열이 Shift Command 렌더 결과에 존재하지 않는다.

## B. 전역 우선순위와 `oldest` 문구를 일치시킨다

현재 개별 action 정렬은 overdue끼리 oldest를 사용하지만, 최종 `prioritizeStartShiftCommandItems`는 같은 우선순위에서 overdueCount와 unassignedCount를 먼저 사용한다. CTA는 `Review oldest ...`라고 표시하므로 데이터에 따라 문구와 실제 선택이 달라질 수 있다.

수정 요구:

1. command item이 raw `oldestAt`을 유지하도록 기존 모델에 최소 필드만 추가한다.
2. unavailable/failed 우선, SLA overdue 우선 등 현재 category 정책은 유지한다.
3. 같은 SLA 우선순위에서는 유효한 `oldestAt` 오름차순을 overdueCount보다 먼저 비교한다.
4. 날짜가 없거나 잘못된 경우 기존 count/index fallback으로 안정적으로 정렬한다.
5. oldest와 overdueCount가 충돌하는 테스트를 추가한다.

완료 조건:

- `Review oldest X`가 실제 최장 경과 queue를 가리킨다.
- unavailable/failed와 SLA category 우선순위는 회귀하지 않는다.

## C. `Next action`의 중복 CTA를 하나로 줄인다

현재 같은 href와 같은 의미의 `Review oldest ...`가 section header와 card 내부에 함께 나타난다.

수정 요구:

1. section header의 primary button은 유지한다.
2. 단일 Next action card에서는 동일 action label을 숨긴다.
3. Open queues와 Historical backlog 카드의 action link는 유지한다.
4. 이를 위해 새 범용 component hierarchy를 만들지 말고 기존 `StartShiftActionGrid`에 필요한 최소 optional prop 정도만 사용한다.

완료 조건:

- Next action section에 동일 목적 CTA가 정확히 한 번 나타난다.
- ageing chip과 next case deep link는 그대로 동작한다.

## D. Money status를 상단 Finance queue와 연결한다

현재 status badge의 overdue, unassigned, exposed 합계는 위의 Finance queue를 포함하지만 body만 보면 합계를 재검산하기 어렵다.

수정 요구:

1. Money status title 또는 compact supporting copy에서 `Open Finance queues are prioritised above.`라는 관계를 명확히 한다.
2. 이미 Next action/Open queues에 표시한 Finance review queue를 큰 카드로 복제하지 않는다.
3. 이 section에는 payment holds, settlement gaps, refunds, cash debt, payout처럼 추가적인 money 상태만 남긴다.
4. Today에서 값이 0인 `Available payout`은 action-needed body에서 숨긴다.
5. 값이 전부 clear이면 기존 compact clear/empty 패턴을 사용한다.
6. 상단 badge의 합계 계산은 현재 의미를 보존한다.

완료 조건:

- operator가 `overdue/unassigned/exposed`가 위 Finance queues를 포함한다는 사실을 한 번에 이해한다.
- 0 VND metric이 warning/action 카드처럼 보이지 않는다.
- 같은 queue를 두 개의 큰 카드로 반복하지 않는다.

## E. Today의 Partner attention 영역을 실제 내용에 맞춘다

현재 Today 화면에서 customer ranking은 없고 Partner attention만 있어도 상위 title이 `Customer and Partner leaders`이고, 값이 0인 성과 탭이 함께 보인다.

수정 요구:

1. Today에서 Partner needs-attention 데이터만 존재하면 section title을 `Partner needs attention`으로 표시한다.
2. 해당 상태에서는 count가 0인 performance tab을 숨기고 `Needs attention` table을 바로 보여준다.
3. 7d 이상에서 실제 데이터가 있는 performance tab은 유지한다.
4. customer와 partner 데이터가 모두 있으면 기존 결합 title을 사용해도 된다.
5. tablist/tabpanel의 aria 연결과 ArrowLeft/ArrowRight/Home/End 동작을 유지한다.
6. tab을 필터링한 뒤에도 roving tabindex index가 정확해야 한다.

완료 조건:

- section title과 실제 body가 일치한다.
- Today의 빈 performance tab 때문에 attention 흐름이 분산되지 않는다.
- 7일 performance 탐색은 회귀하지 않는다.

## F. 음수 Partner earnings의 의미와 통화 포맷을 정리한다

수정 요구:

1. Partner `Most completed`의 `Earnings` 열을 `Net earnings`로 변경한다.
2. 음수를 0으로 바꾸거나 절댓값으로 바꾸지 않는다.
3. 음수 값에는 기존 warning text/tone을 사용해 조정 또는 debt 가능성을 인지시킨다.
4. `/earnings`가 실제 provider filter를 지원하는지 코드로 확인한다. 지원할 때만 검증된 deep link를 제공하고, 존재하지 않는 query parameter는 만들지 않는다.
5. chart와 ranking에 로컬로 중복된 money formatter를 새로 늘리지 않는다.
6. 저장소의 기존 admin money formatter를 찾아 재사용하거나, 기존 formatter에 compact option을 최소 범위로 추가한다.
7. exact operational amount와 compact analytical amount의 용도를 구분하되 VND 위치와 음수 표기는 일관되게 한다.

완료 조건:

- `-VND 80K`가 `Net earnings`라는 의미로 읽힌다.
- 동일 용도의 금액은 통화 위치와 compact 규칙이 같다.
- 음수의 실제 원인을 확인할 수 없는 상태에서 임의로 `Debt`라고 단정하지 않는다.

## G. 자동 갱신 보류 상태를 접근성 있게 알린다

현재 operator가 control을 조작 중이면 자동 refresh를 보류하고 버튼을 `New data — refresh`로 바꾸는 동작은 유지한다.

수정 요구:

1. updateAvailable이 false에서 true가 되는 순간 `New dashboard data is available.`을 알리는 visually hidden `role=status` 또는 `aria-live=polite`를 추가한다.
2. 매 60초마다 반복 발화하지 않는다.
3. refresh 완료 후 live message를 정상 상태로 되돌린다.
4. 기존 focus 보존과 refresh 동작을 유지한다.

완료 조건:

- 상호작용 때문에 refresh가 보류될 때만 한 번 공지한다.
- 버튼 label과 visible text가 현재 상태와 일치한다.

## H. 1440px 데스크톱의 조작 영역과 중복 문구를 마감한다

수정 요구:

1. ranking tab과 자주 쓰는 icon control의 hit area를 기존 density를 크게 해치지 않는 범위에서 최소 40~44px로 맞춘다.
2. 표의 `Open` 링크는 padding을 포함한 충분한 hit area를 갖게 한다.
3. section에서 기간을 이미 표시하면 내부 card의 동일한 `Last 7 days` badge 반복을 줄인다.
4. Live, Stale, Unavailable 같은 상태 정보는 제거하지 않는다.
5. 1440px에서 table과 cards가 지나치게 커지거나 첫 화면 정보량이 줄지 않게 한다.

완료 조건:

- 1440×900에서 주요 조작이 편하고 정보 밀도도 유지된다.
- 동일 기간 문구의 시각적 반복이 줄지만 데이터 상태는 분명하다.

## I. `Provider ####` 데이터 신뢰 문제는 조사하되 운영 데이터를 수정하지 않는다

수정 요구:

1. production filter와 Partner ranking query가 어떤 기준으로 fixture/test 계정을 제외하는지 코드로 확인한다.
2. `Provider ####` 이름만 보고 계정을 자동 제외, 이름 변경, 삭제하지 않는다.
3. 저장소 안에 명시적 fixture/test marker가 이미 있고 안전하게 재사용할 수 있을 때만 filter 누락을 수정한다.
4. 실제 계정 가능성이 있거나 DB 확인이 필요하면 코드를 억지로 바꾸지 말고 최종 보고에 필요한 데이터 확인 항목을 남긴다.
5. production DB row를 수정하거나 seed를 재실행하지 않는다.

완료 조건:

- test exclusion 로직을 추측으로 확대하지 않는다.
- 코드로 확정할 수 없는 데이터 성격은 명시적인 남은 확인 사항으로 보고한다.

# 6. 수정하지 말아야 할 것

- 1439px 이하 responsive 문제
- 1280px action card wrap
- 1024px Shift context layout
- mobile/tablet CSS
- 200% zoom layout
- sidebar navigation 구조
- 다른 admin page의 정보 구조
- 새 chart/UI library
- 새 database shift model
- production 데이터 직접 수정
- fake data 또는 이름을 임의로 예쁘게 바꾸는 처리
- 전체 dashboard 재설계
- 관련 없는 대규모 CSS/refactor

# 7. 테스트 요구

최소한 다음 기존 테스트를 실행하고 필요한 테스트를 수정/추가하라.

npm.cmd run test --workspace @massage-vn/admin-web -- app/page.spec.tsx app/dashboard-page-model.spec.ts app/dashboard-trace-summary.spec.tsx app/start-shift-action-priority.spec.ts app/start-shift-finance-review-workload.spec.ts app/start-shift-operations-command-board.spec.ts components/start-shift-chart-widgets.spec.tsx components/start-shift-ranking-widgets.spec.tsx components/start-shift-refresh-button.spec.tsx

추가 검증:

- admin-web typecheck
- 변경 파일의 lint 또는 저장소에서 지원하는 가장 좁은 lint 검증
- priority: oldest와 volume이 충돌하는 case
- chart: `Request-to-completion`과 잘못된 aggregate rate가 렌더되지 않는지
- ranking: Today attention-only와 7d performance tab 동작
- refresh: updateAvailable live announcement
- Money status: 0 available payout 숨김과 open money state 유지
- Next action CTA가 한 번만 나타나는지

새 테스트 framework나 screenshot dependency는 추가하지 마라.

# 8. 실제 화면 검증

로그인된 in-app browser를 사용할 수 있으면 수정 후 실제 `/`를 확인하라.

검증 viewport:

- 1440×900 light
- 1440×900 dark
- 1600×900 light

각 상태에서 확인:

1. Next action과 Open queues가 읽기 쉽고 가로 overflow가 없다.
2. Next action의 동일 CTA가 한 번만 보인다.
3. Today empty 결과가 compact하게 유지된다.
4. Money status 합계와 위 Finance queue의 관계가 명확하다.
5. Today는 Partner attention 목적에 맞는 title과 controls를 보인다.
6. 7d analytics는 event totals로 표시되고 conversion처럼 보이지 않는다.
7. Most completed는 `Net earnings`와 일관된 VND 포맷을 사용한다.
8. light/dark에서 기존 위험 색상과 텍스트 계층이 유지된다.

1439px 이하 viewport는 캡처하거나 완료 기준으로 사용하지 마라.

# 9. 작업 방식

1. 먼저 관련 코드와 기존 helper/caller를 추적한다.
2. 필요한 파일만 수정한다.
3. 기존 component와 token을 재사용한다.
4. 한 번의 일관된 구현으로 변경한 뒤 테스트한다.
5. 실제 화면을 한 차례 점검하고 발견한 문제를 한 번에 수정한다.
6. 최종 확인 후 불필요한 dead code와 unused import를 제거한다.
7. unrelated user changes가 있으면 보존한다.
8. commit, push, production 배포는 하지 않는다.

# 10. 완료 기준

다음 조건을 모두 충족해야 완료다.

- 잘못된 funnel/conversion 표현이 제거됐다.
- 전역 `oldest` 정렬과 CTA 문구가 일치한다.
- Next action 중복 CTA가 제거됐다.
- Money status와 상단 Finance queues의 관계가 명확하다.
- Today Partner attention 영역의 title과 controls가 실제 내용에 맞는다.
- `Net earnings`와 VND 포맷이 일관된다.
- deferred refresh가 screen reader에 공지된다.
- 1440px 이상에서 light/dark 화면이 안정적이다.
- 관련 테스트와 typecheck가 통과한다.
- 1439px 이하 범위를 위해 불필요한 코드를 추가하지 않았다.
- production 데이터는 수정하지 않았다.

# 11. 최종 보고 형식

작업 완료 후 다음만 간결하게 보고하라.

1. 수정한 운영 문제와 결과
2. 변경 파일 목록
3. 실행한 테스트와 결과
4. 1440/1600 실제 화면 검증 결과
5. 코드만으로 확정하지 못한 데이터 확인 사항
6. 의도적으로 제외한 1439px 이하 범위

분석 보고서만 새로 작성하고 멈추지 말고, 위 완료 기준을 만족하도록 실제 구현과 검증까지 끝내라.
```

---

## 이 프롬프트에서 의도적으로 제외한 이전 보고서 항목

- 1280px action card 세로 깨짐
- 1024px Shift context 압축
- 720px 이하 grid row 충돌
- 200% 확대 overlap
- 작은 화면 회귀 테스트

1440px 이상에서도 필요한 지표 의미, 우선순위, 중복 CTA, Money status, Partner attention, 통화 포맷, live announcement는 그대로 포함했다.
