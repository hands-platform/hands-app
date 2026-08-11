# HANDS 관리자 웹 성능·정보구조 전체 재감사 보고서

- 감사일: 2026-08-08
- 대상 저장소: `C:\dev\massage-on-demand-vn`
- 대상 화면: HANDS Admin `http://localhost:3101`
- 화면 기준: 1440px 이상 데스크톱만 평가. 1024px 이하 및 모바일은 감사·점수·권고에서 제외
- 감사 방식: 74개 App Router 페이지 전체 코드 인벤토리, 내비게이션 연결성 검사, 로그인 브라우저 13개 대표 업무 화면 실측·캡처, 현재 Next.js 서버 로그, API 응답 로그, DOM·콘솔 검사, 관련 회귀 테스트
- 변경 범위: 애플리케이션 코드는 수정하지 않았고, 이번 보고서와 감사 캡처만 생성함

## 1. 결론

현재 느림은 실제다. 가장 큰 원인은 데이터베이스나 API가 항상 느려서가 아니라 **운영자가 보는 3101 화면이 프로덕션 서버가 아닌 `next dev --webpack` 개발 서버로 실행되고 있고, 74개 라우트와 대형 공용 파일을 페이지 전환 때 반복 컴파일하기 때문**이다.

현재 세션에서 확인한 대표 콜드 전환은 `/setup` 62초, `/bookings` 35~59초, `/partners` 약 30초, `/operations-handoff` 41초, `/notifications` 39초, `/marketing-analytics` 52초였다. 같은 페이지가 메모리에 남은 상태에서 즉시 다시 열면 0.27~2.24초로 줄었다. 이 차이는 현재 체감 지연의 주원인이 개발용 컴파일임을 강하게 보여준다.

다만 프로덕션 실행으로 바꾸는 것만으로 모든 지연이 사라지지는 않는다. Shift Command는 최대 14개 GET 코드 경로, Settlement Repair는 15개 GET 코드 경로를 한 페이지에서 구성하고 있으며, Shift Command는 두 번째 `Promise.all`의 가장 느린 응답이 끝날 때까지 핵심 화면 전체가 기다린다. 컴파일이 끝난 요청에서도 일부 페이지의 app 처리 시간이 10~14초로 관찰되어 데이터 집계와 서버 렌더 구조도 P1 개선 대상이다.

정보구조는 이전 감사보다 확실히 좋아졌다. 74개 페이지 중 정적 업무 페이지는 내비게이션 또는 로컬 작업공간에서 모두 도달 가능하고, 과거 중복이던 `operations-handoff?view=handoff`는 정규 URL로 리디렉션된다. Setup Readiness의 개발자 중심 본문, 잘못된 `aria-current`, Push Send의 raw ID 입력, Operation Alerts 빈 메뉴 의미론도 코드와 화면에서 개선되었다.

남은 핵심 IA 문제는 다음 세 가지다.

1. Partner Directory, Partner Control Queue, Partner Operations Overview가 같은 위험 집단을 세 개의 동급 목적지에서 반복한다.
2. Settlement Repair Queue의 사이드바 이름과 H1 `Finance Closeout`이 다르고, 한 화면에 3단계 제어행이 중첩된다.
3. Shift Command와 도메인 Overview가 같은 수치를 반복하므로, Shift Command는 전사 우선순위만 남기고 상세 요약을 줄여야 한다.

### 최종 판정

- 현재 운영용 성능: **조건부 실패** — 운영자가 3101 개발 서버를 직접 사용한다면 P0
- 정보구조·운영 편의성: **82/100 · Good, 추가 정리 필요**
- UI 구현 감사 점수: **13/20 · Acceptable**
  - 접근성 3/4
  - 현재 런타임 성능 1/4
  - 1440px+ 데스크톱 레이아웃 3/4
  - 테마 일관성 3/4
  - 구현 건전성 3/4

## 2. 속도 감사: 무엇이 얼마나 느린가

### 2.1 현재 실제 실행 방식

현재 프로세스는 다음과 같다.

```text
next dev --webpack --port 3101
```

코드 근거는 `apps/admin_web/package.json:5`의 `"dev": "next dev --webpack"`이며, 실행 프로세스 명령행에서도 동일하게 확인했다. Next.js 공식 문서상 `next dev`는 HMR·개발 진단을 포함한 개발 모드이고, `next start`가 `next build` 이후 사용하는 프로덕션 모드다. Next.js 16에서는 Turbopack이 기본이며 `--webpack`은 명시적으로 Webpack을 선택한다.

### 2.2 콜드 라우트 전환

| 화면 | 현재 세션 응답 | 서버 로그 분해 | 판정 |
| --- | ---: | --- | --- |
| Setup Readiness | 약 62초 | Next 59초 + app 3초 | 개발 컴파일 지배 |
| Live Bookings | 약 35~59초 | Next 34.7~58초 + app 약 1초 | 개발 컴파일 지배 |
| Partner Directory | 약 30초 | Next 19초 + app 11.5초 | 컴파일 + 앱 처리 모두 큼 |
| Partner Control Queue | 약 23초 | Next 20.8초 | 개발 컴파일 지배 |
| Partner Overview | 약 21.5초 | Next 18.8초 | 개발 컴파일 지배 |
| Finance Overview | 약 23.2초 | Next 12.8초 + app 10.4초 | 데이터·렌더도 큼 |
| Settlement Repair | 약 18.8초 | Next 17.8초 + app 0.98초 | 개발 컴파일 지배 |
| Notification Delivery | 약 39.1초 | Next 25.9초 + app 13.2초 | 컴파일 + 앱 처리 모두 큼 |
| Marketing Analytics | 약 52초 | Next 49초 | 개발 컴파일 지배 |
| Customer Usage | 약 23.6초 | Next 21.2초 | 개발 컴파일 지배 |
| Shift Command 재컴파일 | 약 39.9초 | Next 25.9초 + app 14초 | 컴파일 + 다중 데이터 장벽 |
| Shift Handoff | 약 41초 | Next 28.4초 + app 12.2초 | 컴파일 + 앱 처리 모두 큼 |

여러 라우트를 순환한 뒤 이미 열었던 Shift Command와 Live Bookings도 다시 수십 초가 걸렸다. 이것은 개발 서버가 대형 라우트를 온디맨드로 다시 컴파일하거나 캐시에서 밀어내는 현상이라는 추론과 일치한다. 정확한 내부 캐시 퇴거 원인은 Next trace를 별도로 수집해야 하지만, 운영 화면에서 개발 컴파일을 제거해야 한다는 결론에는 영향이 없다.

### 2.3 웜 전환

같은 세션에서 직전 컴파일이 살아 있을 때 측정한 브라우저 전환은 다음과 같다.

| 화면 | 웜 전환 |
| --- | ---: |
| Shift Command 즉시 재로딩 | 275ms |
| Live Bookings | 2.24초 |
| Shift Handoff | 631ms |
| Customers | 432ms |
| Partner Control Queue | 871ms |
| Partner Directory | 859ms |
| Finance Overview | 271ms |
| Settlement Repair | 612ms |
| Tax & Close | 443ms |
| Notification Delivery | 270ms |
| Marketing Analytics | 278ms |
| Customer Usage | 274ms |

따라서 “모든 API가 매번 30~60초”인 구조는 아니다. 개발 번들러의 콜드 비용과 일부 페이지의 서버 데이터 비용을 분리해서 고쳐야 한다.

### 2.4 API와 화면 처리

현재 API health는 약 106ms였고, 대표 관리자 API 로그는 대체로 6~350ms 범위였다.

- 현재 운영자 권한: 약 6~30ms
- 고객 목록: 약 55~98ms
- Partner Overview 집계: 약 96~172ms
- Partner Control 요약: 약 39~61ms
- Partner 목록: 일부 약 340ms

이는 20~60초 지연의 1차 원인이 API 자체가 아님을 보여준다. 단, 페이지가 많은 호출을 한꺼번에 기다리는 구조와 일부 10초 이상의 app 구간은 별도 개선해야 한다.

## 3. 코드 수준 원인

### P0 — 운영 화면이 개발 서버에 연결됨

- `apps/admin_web/package.json:5`: `next dev --webpack`
- 현재 프로세스도 `next dev --webpack --port 3101`
- Next.js 16의 기본 개발 번들러는 Turbopack인데 현재는 Webpack을 강제함

영향:

- 라우트 첫 방문 및 캐시에서 밀린 후 재방문 때 대형 컴파일 발생
- 한 탭의 컴파일이 다른 열린 관리자 탭의 요청에도 체감 지연을 유발
- 개발용 HMR·소스맵·진단 비용이 운영자 사용 경로에 포함

### P1 — 페이지 전체를 막는 다중 데이터 장벽

Shift Command는 `apps/admin_web/app/page.tsx:392`와 `:413`에서 두 단계 `Promise.all`을 사용한다. 두 번째 단계에는 최대 13개 데이터 소스가 있고, 가장 느린 하나가 끝날 때까지 `Next action`을 포함한 화면 전체가 렌더되지 않는다.

정적 코드 기준 GET 호출 상위 페이지:

| 페이지 | GET 코드 경로 | 파일 크기 |
| --- | ---: | ---: |
| Settlement Repair | 15 | 801줄 |
| Shift Command | 14 | 1,396줄 |
| Bank Reconciliation | 8 | 1,928줄 |
| Partner Money | 7 | 2,233줄 |
| Wallet Adjustments | 5 | 1,389줄 |
| Payment Clearing | 5 | 736줄 |
| Marketing Analytics | 4 | 1,778줄 |

호출 수 자체가 곧 지연 시간은 아니지만, 화면이 모든 응답을 기다리는 구조에서는 느린 꼬리 응답과 장애 전파가 커진다.

### P1 — 로딩 경계가 사실상 없음

- `apps/admin_web/app` 아래 `loading.tsx`: 0개
- 앱·컴포넌트의 `Suspense`: 공통 셸 내비게이션용 1개 파일뿐
- 우선순위가 높은 요약과 느린 표·차트를 분리 스트리밍하지 않음

결과적으로 데이터 한 군데가 지연되어도 운영자는 빈 화면 또는 전체 페이지 지연으로 느낀다.

### P2 — 모든 GET이 `no-store`

`apps/admin_web/lib/admin-api.ts:5727`에서 모든 `adminGetResult`가 `cache: 'no-store'`를 사용한다. 라이브 예약, 경보, 결제 승인 큐에는 타당하지만 서비스 카탈로그, 템플릿, 정책, 지역 목록처럼 변경 빈도가 낮은 데이터까지 동일 정책이면 전환마다 불필요한 왕복과 서버 렌더가 발생한다.

### P2 — 같은 요청 안에서도 토큰 생성 반복 가능

각 `adminGet`은 `getAdminAccessToken()`을 호출하고, 이 함수는 세션 신원 조회 후 API 토큰을 생성한다(`apps/admin_web/lib/admin-api.ts:5911`). Shift Command처럼 다중 GET을 쓰는 요청에서는 request-local memoization으로 중복 세션 해석·서명을 줄일 수 있다. 이 항목은 수십 초 지연의 주원인은 아니지만 안전한 소규모 개선이다.

### P2 — 대형 공용 변경 단위

- `apps/admin_web/app/globals.css`: 25,024줄, 약 536KB
- `apps/admin_web/lib/admin-api.ts`: 6,116줄, 약 161KB
- Admin page 파일: 74개
- client 지시문을 포함한 TS/TSX 모듈: 37개

대형 전역 CSS와 단일 API 모듈은 개발 서버의 변경 영향 범위와 컴파일 그래프를 키운다. `Marketing Analytics` 1,778줄, `Partner Money` 2,233줄, 고객 상세 2,452줄처럼 페이지 단위도 크다. 기능별 모듈화는 개발 컴파일과 리뷰 안정성을 함께 개선한다.

### P3 — DOM·차트 밀도

대표 화면 DOM은 Marketing Analytics 1,208개 요소·88개 SVG, Customer Usage 824개·76개 SVG, Partner Directory 1,157개 요소였다. 이것은 30~60초 서버 지연의 원인은 아니지만 초기 hydration, 페인트, 스크롤 부하를 키울 수 있다. 차트와 긴 표는 화면 아래에서 지연 렌더하거나 행 가상화를 적용할 후보이다.

## 4. 성능 해결 방안

### 4.1 P0 — 운영용 3101을 프로덕션 모드로 분리

권장 운영:

```powershell
npm.cmd run build --workspace @massage-vn/admin-web
npm.cmd run start --workspace @massage-vn/admin-web -- --port 3101
```

- 3101: 운영자 검수·실사용용 production build
- 별도 포트 예: 3102: 개발자 HMR용 dev server
- 현재 활성 개발 세션을 보호하기 위해 이번 감사에서는 서버를 중지하거나 `.next`를 덮는 production build를 실행하지 않음

개발 서버가 꼭 필요하면 별도 브랜치에서 `--webpack`을 제거해 Next.js 16 기본 Turbopack 호환성을 검증한다. Webpack 전용 설정이나 loader가 있으면 그 항목만 보완하고, 호환성 확인 없이 운영 브랜치에서 즉시 바꾸지는 않는다.

완료 기준:

- 운영자 URL이 `next start` 프로세스로 제공됨
- 콜드 compile 메시지가 운영 요청 로그에서 사라짐
- 핵심 10개 라우트의 production p50/p95를 별도 측정

### 4.2 P1 — Shift Command를 한 개의 운영 집계 계약으로 축소

이미 존재하는 start-shift summary를 확장해 화면 첫 페인트에 필요한 다음 정보만 한 번에 반환한다.

- 가장 오래된 최우선 업무 1건
- 도메인별 action count, oldest age, exposure amount
- 데이터 생성 시각과 실패한 하위 소스
- 상세 목록으로 이동할 URL

Partner 전체 목록, booking 전체 목록, notification 원본 목록 등 상세 계산용 배열은 Shift Command에서 제거하거나 화면 아래 스트리밍 영역으로 이동한다.

완료 기준:

- Shift Command 초기 서버 호출 1~3개
- `Next action`은 하위 표·차트보다 먼저 표시
- 한 하위 소스 실패가 전체 화면을 빈 상태로 만들지 않음

### 4.3 P1 — 업무 우선순위별 스트리밍

권장 경계:

1. 셸·H1·데이터 생성 시각
2. Next action / Needs action
3. 핵심 KPI
4. 긴 표·차트·이력

각 독립 섹션을 Server Component와 `Suspense`로 나누고, `loading.tsx` 또는 의미 있는 섹션 skeleton을 제공한다. 단순 스피너가 아니라 “우선 큐 불러오는 중”, “이력 불러오는 중”처럼 운영 맥락을 유지한다.

### 4.4 P2 — 데이터 신선도 정책을 세 종류로 분리

| 데이터 종류 | 권장 정책 |
| --- | --- |
| Live bookings, alerts, approvals, payment risk | `no-store` 유지 또는 짧은 실시간 갱신 |
| Dashboard aggregate, usage summary | 15~60초 revalidate 또는 tag invalidation |
| 서비스·정책·템플릿·지역·설정 | 5~30분 revalidate + 변경 시 tag invalidation |

캐싱은 라이브 큐에 일괄 적용하면 안 된다. Next.js `fetch`는 요청별 `cache`, `next.revalidate`, tag 정책을 지원하므로 데이터 의미에 따라 명시적으로 나눈다.

### 4.5 P2 — 모듈 경계 축소

- `admin-api.ts`를 `booking-api`, `partner-api`, `finance-api`, `messaging-api`, `admin-session`으로 분리
- `globals.css`를 foundation/token, shell, 공통 component, route/workspace 스타일로 분리
- 1,000줄 이상 페이지는 data model, view sections, actions, table columns로 분리
- 공용 barrel export가 모든 도메인을 한 번에 끌어오지 않는지 확인

목표는 파일을 예쁘게 나누는 것이 아니라 라우트 한 개 수정이 전체 관리자 그래프를 다시 컴파일하지 않도록 변경 경계를 좁히는 것이다.

### 4.6 측정 체계

최소 계측:

- 라우트별 server render p50/p95
- 각 BFF/API subcall duration과 가장 느린 소스
- browser navigation, LCP, INP, CLS
- query count와 payload size
- dev compile과 production request를 별도 대시보드로 분리

Sentry나 PostHog를 도입할 수 있지만, 먼저 서버 로그에 `route`, `requestId`, `dataSource`, `durationMs`, `resultCount`를 구조화해 남기는 것만으로도 충분하다.

## 5. 전체 74개 페이지 정보구조 감사

### 5.1 연결성

- 총 page route: 74
- 정적 업무 route 중 내비게이션·로컬 작업공간 정확 연결: 54
- 동적 상세 route: 15
- 내비게이션에 직접 노출되지 않은 정적 route: `/login`과 레거시 리디렉션 4개뿐
- 레거시 alias: `/providers`, `/providers/[id]`, `/files`, `/referrals`

레거시 alias는 기존 북마크와 딥링크 호환을 위해 유지하되 검색·사이드바에 노출하지 않는 현재 정책이 맞다. 지금 삭제할 필요는 없다.

### 5.2 상위 카테고리

현재 8개 상위 진입점은 운영 업무 기준으로 대체로 적절하다.

1. Shift Command
2. Booking Operations
3. Customer Support
4. Partner Operations
5. Finance Operations
6. Finance Records & Close
7. Growth & Communications
8. Administration & Settings

상위 카테고리를 더 줄이면 Finance의 실행 큐와 회계 기록이 다시 섞이고, Growth의 발송 위험 작업과 시스템 설정이 섞일 가능성이 높다. 따라서 상위 개수는 유지하는 편이 낫다.

다만 `Finance Operations`는 `Finance Action Queues`처럼 실행 목적을 더 직접적으로 표현할 여지가 있다. `Finance Records & Close`는 현 명칭을 유지해도 의미가 구분된다.

### 5.3 합쳐야 하는 항목

#### Partner Operations: 한 작업공간으로 통합

현재 세 동급 페이지:

- Partner Directory
- Partner Control Queue
- Partner Operations Overview

실제 화면에서 Control Queue는 1,310 partners with blockers와 124 debt gates를 보여주고, Overview도 124 wallet risk와 pending verification, online-not-bookable을 다시 보여준다. Directory의 `Wallet Debt` saved view도 같은 집단으로 연결된다.

권장 구조:

```text
Partner Operations
├─ Overview       현재 공급·리스크 요약, 상세 실행 링크
├─ Action Queue   승인·가용성·wallet·운영 제한 실제 처리
└─ Directory      검색·프로필·저장 보기
```

세 URL은 딥링크 호환을 위해 유지하되 사이드바에는 `Partner Operations` 하나만 두고 로컬 탭으로 전환한다. Overview 카드 자체에서 수정하지 말고 Action Queue로 정확한 filter를 가진 채 이동시킨다.

#### Settlement Repair: 이름과 제어 계층 통합

현재 사이드바는 `Settlement Repair Queue`, H1은 `Finance Closeout`이다. 화면에는 다음 세 단계가 연속된다.

1. Closeout workspace
2. Settlement review mode
3. Settlement gap filters

권장:

- breadcrumb, H1, 사이드바 모두 `Settlement Repair`
- 상단 control은 `Operations closeout | Repair queue | Batch evidence` 한 줄
- 그 아래에는 상태·기간·담당자 filter만 배치
- `Operations closeout`이 완전히 다른 목적이라면 `/finance-overview?view=closeout`로 분리하고 이 페이지에서는 제거

### 5.4 합치면 안 되는 항목

- Customers / Customer Signals / Chat Evidence: 계정 처리, 평가·메모 moderation, 증거 검색으로 목적이 다름
- Notification Delivery / Templates / Push Send: 장애 처리, 콘텐츠 관리, 위험 발송 작업으로 권한·실수 비용이 다름
- Marketing Analytics / Customer Usage: 획득·캠페인과 제품 사용·lifecycle이 다름. 같은 Insights workspace를 공유하는 현재 구조가 맞음
- Finance Overview / Settlement Repair / Tax & Period Close: 오늘의 돈 상태, 오류 복구, 기간 마감으로 시간축과 책임이 다름
- Completed Services / Post-match Cancellations: 같은 Booking Closeout workspace의 서로 다른 실행 탭으로 현재 구조가 맞음

### 5.5 제거보다 축소할 항목

#### Shift Command

Shift Command의 `Next action → Open queues` 순서는 좋다. 그러나 화면 아래 `Money status`가 바로 위 finance queue의 177 overdue, 160 unassigned, 84 backlog 등을 다시 반복한다.

유지할 것:

- 가장 오래된 1건
- 도메인별 미처리 수·최장 경과·노출 금액
- 담당자/인수인계 상태

도메인 Overview로 보낼 것:

- 순위표
- 전체 KPI grid
- 상세 추세·차트
- 추가 큐 목록

#### Tax & Period Close

같은 첫 화면에 `Closeout gates 63`이 상단 metric과 다음 카드에서 두 번 보인다. 하나는 제거하고 남은 카드에 `63 · oldest age · owner · open checks`를 결합한다.

#### Customer Usage

선택한 날짜·granularity·comparison이 두 줄의 badge로 반복되고, 모든 값이 0이어도 큰 metric card와 funnel card가 계속 나타난다.

- 상단에는 기간과 freshness만 한 줄로 유지
- 0건이면 `No tracked usage in this period`와 가능한 원인·다음 행동을 먼저 표시
- 차트·funnel은 `Show empty report` disclosure 뒤로 이동

#### Notification Delivery

0 failure groups인데도 두 단계 탭, 네 개 상태 분류, 세 개 age 탭, 빈 table이 모두 남는다. 장애가 0이면 `All delivery paths healthy`를 주 상태로 보여주고, `Delivery records`와 과거 이력은 보조 action으로 축약한다.

## 6. 이전 감사 요구사항 재검증

| 이전 요구 | 현재 판정 | 근거 |
| --- | --- | --- |
| Setup Readiness를 운영자 상태표로 전환 | 해결 | Service / Status / Affected work / Last checked / Owning team / Next action 표 확인 |
| 상위 workspace와 실제 current의 `aria-current` 분리 | 해결 | exact destination만 `aria-current`, 회귀 테스트 통과 |
| App Sessions의 Shift Command 중복 action 제거 | 해결 | 헤더에 `Open notification delivery`만 유지 |
| Operation Alerts 0건 menu 의미론 | 해결 | alert 존재 시 menu, 0건 시 status |
| Push Send raw user ID 제거 | 해결 | 이름·전화번호 검색, 내부 ID 숨김 |
| `operations-handoff?view=handoff` 중복 URL | 해결 | canonical `/operations-handoff`로 redirect |
| Live Bookings의 0건 Additional queues 과밀 | 해결 | non-zero exceptions만 승격, 0건은 `No additional exceptions`로 축약 |

전체적으로 이전 프롬프트는 잘 반영되었다. 이번 감사에서 발견한 문제는 주로 성능 런타임과 Partner/Finance의 두 번째 수준 통합이다.

## 7. 대표 화면 13개 재감사

1. **Setup Readiness — 양호.** 이전 개발 로드맵 중심 화면이 운영 상태표로 바뀌었다. `Owning team` 열의 이메일 줄바꿈은 팀명 우선, 연락처 상세 disclosure로 정리할 수 있다.
2. **Partner Control Queue — 부분 개선 필요.** 우선순위 큐는 명확하지만 Directory wallet saved view와 Overview의 위험 수치가 반복된다.
3. **Customers — 양호.** 검색·필터·빈 상태가 간결하고 계정 처리 목적이 분명하다.
4. **Partner Directory — 양호하나 밀도 높음.** saved view와 export 범위가 명확하지만 row 정보량이 많아 1440px에서 핵심 열 고정이 필요하다.
5. **Partner Overview — 통합 필요.** 요약은 좋지만 Action Queue의 위험 집단을 다시 보여준다. summary-to-filter drill-down으로 바꿔야 한다.
6. **Finance Overview — 양호.** Today / Backlog / Money Flow 구분과 한 개 aggregate 계약은 좋은 기준 구현이다.
7. **Settlement Repair — 개선 필요.** 이름 불일치와 3단 control hierarchy가 운영 판단을 늦춘다.
8. **Tax & Period Close — 개선 필요.** Closeout gates 수치 중복을 제거해야 한다.
9. **Notification Delivery — 구조는 양호, 0-state 과밀.** 실제 장애 0건일 때 control과 빈 table이 너무 많이 남는다.
10. **Marketing Analytics — 부분 개선 필요.** Needs action을 위로 올린 것은 좋지만 range/source/platform/region/campaign이 한 번에 펼쳐져 있다. 기본 3개 filter + More filters가 더 빠르다.
11. **Customer Usage — 개선 필요.** 날짜·freshness metadata 반복과 0값 card matrix를 축약해야 한다.
12. **Shift Command — 양호.** 최우선 action이 명확하지만 바로 아래 finance summary 반복을 줄일 수 있다.
13. **Live Bookings — 양호.** Work now / Monitor 구분, zero exception suppression, Additional exceptions 0-state가 이전보다 운영 친화적이다.

## 8. 실행 우선순위

### P0 — 1일 이내

1. 운영용 3101을 production build + `next start`로 전환한다.
2. dev server를 별도 포트로 분리한다.
3. production 환경에서 핵심 10개 route의 p50/p95를 다시 측정한다.

### P1 — 2~5일

1. Shift Command와 Settlement Repair의 다중 호출을 aggregate 계약으로 축소한다.
2. Next action, 핵심 KPI, 상세 table에 독립 Suspense 경계를 둔다.
3. Partner Operations를 Overview / Action Queue / Directory 로컬 workspace로 통합한다.
4. Settlement Repair의 이름과 control hierarchy를 단순화한다.

### P2 — 1~2주

1. 라이브·준실시간·안정 데이터 cache 정책을 분리한다.
2. request-local token memoization을 적용한다.
3. `admin-api.ts`, `globals.css`, 1,000줄 이상 페이지를 도메인별로 분할한다.
4. Customer Usage·Notification Delivery의 0-state를 축약한다.
5. route/API/browser 성능 계측을 추가한다.

### P3 — 후속 정리

Impeccable detector가 기존 `globals.css`의 side-tab 강조 6건과 Inter font 사용 1건을 보고했다. 이번 느림의 직접 원인은 아니다. side-tab은 상태 의미를 확인한 뒤 공통 강조 토큰으로 정리하고, referral 인쇄물의 Inter 사용은 브랜드·출력 일관성을 확인하기 전에는 제거하지 않는다.

## 9. 검증 결과와 한계

### 독립 실행

- 내비게이션·매칭·셸·로컬 헤더 테스트: **4 files / 74 tests PASS**
- 현재 브라우저 console warning/error: **0**
- page route 전체 인벤토리: **74개**
- 내비게이션 정확 연결 검사: 정적 업무 route 누락 없음
- 현재 dirty worktree: **1,607개 상태 항목**

### 한계

- 이번 감사에서는 활성 개발 서버와 로그인 세션을 보호하기 위해 production build를 실행하지 않았다. 따라서 위 성능 수치는 현재 `next dev --webpack` 런타임 감사이며 production p95가 아니다.
- `window.performance` 기반 Lighthouse/LCP/INP/CLS를 수집하지 못해 브라우저 벽시계, 서버 route log, DOM 크기로 판단했다.
- 전체 74개 route는 코드·내비게이션 관점에서 검사했고, 시각 검사는 대표 13개 고위험 업무 화면을 현재 실행에서 새로 캡처했다.
- 접근성은 DOM role, accessible label, 키보드 관련 코드·테스트와 화면을 확인했다. NVDA/JAWS/VoiceOver 실제 발화, OS 고대비, 색각 시뮬레이션은 수행하지 않았다.
- 기존 worktree 변경 1,607개를 보존했으며 reset, checkout, cleanup, commit, push, 배포, 데이터 변경을 하지 않았다.

## 10. 공식 참고 문서

- Next.js CLI: `next dev`, `next build`, `next start` — https://nextjs.org/docs/app/api-reference/cli/next
- Next.js Turbopack: Next.js 16 기본 개발 번들러와 `--webpack` opt-in — https://nextjs.org/docs/pages/api-reference/turbopack
- Next.js fetch cache/revalidate/tag — https://nextjs.org/docs/app/api-reference/functions/fetch

## 11. 현재 감사 캡처

### 01 — Setup Readiness

![Setup Readiness](C:/dev/massage-on-demand-vn/output/admin-full-performance-ia-audit-2026-08-08/01-setup-readiness.jpg)

### 02 — Partner Control Queue

![Partner Control Queue](C:/dev/massage-on-demand-vn/output/admin-full-performance-ia-audit-2026-08-08/02-partner-controls.jpg)

### 03 — Customers

![Customers](C:/dev/massage-on-demand-vn/output/admin-full-performance-ia-audit-2026-08-08/03-customers.jpg)

### 04 — Partner Directory

![Partner Directory](C:/dev/massage-on-demand-vn/output/admin-full-performance-ia-audit-2026-08-08/04-partner-directory.jpg)

### 05 — Partner Operations Overview

![Partner Operations Overview](C:/dev/massage-on-demand-vn/output/admin-full-performance-ia-audit-2026-08-08/05-partner-overview.jpg)

### 06 — Finance Overview

![Finance Overview](C:/dev/massage-on-demand-vn/output/admin-full-performance-ia-audit-2026-08-08/06-finance-overview.jpg)

### 07 — Settlement Repair Queue

![Settlement Repair Queue](C:/dev/massage-on-demand-vn/output/admin-full-performance-ia-audit-2026-08-08/07-settlement-repair-queue.jpg)

### 08 — Tax & Period Close

![Tax & Period Close](C:/dev/massage-on-demand-vn/output/admin-full-performance-ia-audit-2026-08-08/08-tax-close-overview.jpg)

### 09 — Notification Delivery

![Notification Delivery](C:/dev/massage-on-demand-vn/output/admin-full-performance-ia-audit-2026-08-08/09-notification-delivery.jpg)

### 10 — Marketing Analytics

![Marketing Analytics](C:/dev/massage-on-demand-vn/output/admin-full-performance-ia-audit-2026-08-08/10-marketing-analytics.jpg)

### 11 — Customer Usage

![Customer Usage](C:/dev/massage-on-demand-vn/output/admin-full-performance-ia-audit-2026-08-08/11-customer-usage.jpg)

### 12 — Shift Command

![Shift Command](C:/dev/massage-on-demand-vn/output/admin-full-performance-ia-audit-2026-08-08/12-shift-command.jpg)

### 13 — Live Bookings

![Live Bookings](C:/dev/massage-on-demand-vn/output/admin-full-performance-ia-audit-2026-08-08/13-live-bookings.jpg)
