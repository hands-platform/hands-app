# Finance Overview 개선용 Codex 실행 프롬프트

아래 내용을 새 Codex 작업의 첫 메시지로 그대로 붙여 넣어 사용한다.

---

## 복사용 프롬프트

```text
HANDS 관리자 웹의 Finance Overview를 감사 보고서에 따라 실제로 수정하고 검증해라. 분석 보고서만 다시 작성하고 끝내지 말고, 코드 수정 → 테스트 → 로그인된 브라우저 검증 → 최종 변경 보고까지 완료하라.

작업 위치와 운영 규칙

- 저장소: C:\dev\massage-on-demand-vn
- 반드시 C:\dev\massage-on-demand-vn\AGENTS.md를 먼저 읽고 따른다.
- C:\dev\massage-vn-workspace는 사용하지 않는다.
- 단일 에이전트로 작업하고 subagent나 multi-agent 도구를 사용하지 않는다.
- 기존 사용자의 변경 사항과 관련 없는 파일은 건드리지 않는다.
- 작업 전 git status와 관련 diff를 확인하고, 완료 후 변경 파일을 명확히 보고한다.
- 대상 URL: http://localhost:3101/finance-overview
- 대상은 1440px 이상 데스크톱 관리자 환경이다. 1024px 이하 반응형/모바일 디자인은 이번 작업의 검사·보고·최적화 범위에서 완전히 제외한다.
- 기존 HANDS 관리자 UI의 디자인 토큰, 다크/라이트 테마, 컴포넌트 스타일을 시각적 기준으로 사용한다. 새 디자인 시스템이나 외부 UI 라이브러리를 도입하지 않는다.
- Finance Overview를 별도 페이지들로 분리하지 않는다. `Today movement / Current backlog / Money flow`의 세 작업공간을 한 페이지 안에 유지한다.
- 회계·정산 데이터를 추측하거나 누락값을 0으로 꾸미지 않는다. 데이터 범위가 다르면 계산을 통일하거나 범위를 화면에 명시한다.
- Prisma schema, migration, auth, wallet/payment 핵심 도메인, shared contract 등 보호 영역을 불필요하게 변경하지 않는다. 필요한 경우 AGENTS.md의 추가 검증을 수행한다.

먼저 읽을 문서

1. C:\dev\massage-on-demand-vn\output\finance-overview-reaudit-2026-08-08\finance-overview-reaudit-report.md
2. C:\dev\massage-on-demand-vn\AGENTS.md

중점 검사 파일

- apps/admin_web/app/finance-overview/page.tsx
- apps/admin_web/app/finance-overview/finance-overview-model.ts
- apps/admin_web/app/finance-overview/finance-overview-model.spec.ts
- apps/admin_web/app/finance-overview/page.spec.tsx
- apps/admin_web/app/dashboard-trace-summary.tsx
- apps/admin_web/components/admin-segmented-control.tsx
- apps/admin_web/app/globals.css
- apps/api/src/admin/admin.service.ts
- apps/api/src/admin/admin.service.spec.ts
- apps/api/src/admin/admin.controller.spec.ts

작업 원칙

- Operate 모드의 관리자 화면으로 다룬다. 장식보다 빠른 스캔, 데이터 신뢰, 처리 순서, 실수 방지가 우선이다.
- 현재 화면과 코드를 먼저 확인하고 데이터의 `today / selected range / monthly period / current all-open` 범위를 표로 정리한 뒤 수정한다.
- 기존 aggregate API의 값과 각 카드/행/링크 목적지 필터의 범위를 추적한다.
- 수정 전 로그인된 실제 화면에서 Today, Backlog, Money Flow Today, Money Flow 7d, 다크/라이트 상태를 확인한다.
- 구현이 끝난 뒤 동일 상태를 1692×1272 또는 그와 유사한 1440px 이상 화면에서 다시 확인한다.
- 임시 TODO, 가짜 값, 하드코딩된 감사 데이터, CSS로만 문제를 숨기는 방식은 금지한다.

P1 — 반드시 구현할 사항

1. 데이터 신선도 표시를 정직하게 수정한다.

- 현재 페이지는 자동 갱신이 없는데 `Live · updated`를 표시한다.
- 이 aggregate는 서버 내부 집계 비용이 크므로 이번 작업에서는 무조건적인 60초 polling을 추가하지 않는다.
- `Snapshot updated HH:mm`과 명시적인 `Refresh` 버튼을 제공한다.
- Refresh는 현재 workspace/range/period를 유지하면서 데이터를 다시 가져와야 한다.
- 갱신 중에는 중복 클릭을 막고 진행 상태를 보여준다.
- 생성 시각으로부터 5분이 지나면 클라이언트에서도 stale 상태가 보이도록 한다.
- 상태 변화와 갱신 완료는 과도하지 않은 aria-live 영역으로 전달한다.
- 실제 자동 갱신이 없는 한 `Live` 문구를 사용하지 않는다.

2. URL을 화면 상태의 단일 진실로 만든다.

- Today의 canonical URL은 `/finance-overview` 또는 의미가 동일한 최소 URL이어야 한다. flow에서 사용하던 `range`와 `period`를 남기지 않는다.
- Backlog의 canonical URL은 `/finance-overview?view=queues`처럼 workspace만 표현하고, 실제로 사용하지 않는 movement range와 tax period를 남기지 않는다.
- Money Flow에서만 `view=flow`, `range`, `period`를 보존한다.
- 잘못된 조합으로 직접 진입했을 때 화면만 내부적으로 강제하고 잘못된 URL을 남겨두지 말고 canonical URL로 정규화한다.
- 특히 7d Money Flow에서 Today를 누른 뒤 URL에 `range=7d&period=...`가 남지 않아야 한다.
- URL 생성 규칙과 직접 진입 규칙을 테스트한다.

3. Current backlog의 실제 운영 우선순위를 구현한다.

- 현재 `tone → ownerState → insertion order`만 사용하는 정렬을 제거한다.
- 문자열 label을 파싱하지 말고 action item 모델에 정렬용 숫자/불리언 필드를 명시한다. 예: `slaBreached`, `oldestAgeMinutes` 또는 `oldestAgeDays`, `impactScore`/`impactAmount`, `ownerState`, stable source index.
- 기본 순서는 운영 위험을 반영해야 한다. SLA 초과와 장기 방치가 최우선이고, 미배정 상태와 금액/고객 영향도가 그다음 판단 근거가 되도록 deterministic comparator 또는 명시적인 risk score를 만든다.
- 감사 fixture에서 82일 Refund와 59일 Payment clearing이 37일 Bank reconciliation 아래에 묻히지 않도록 테스트한다.
- 화면에 `Sorted by operational risk`를 표시한다.
- 필요하면 `Risk / Oldest` 두 가지 정렬만 제공한다. 복잡한 다중 정렬 UI는 만들지 않는다.
- 같은 입력은 항상 같은 순서를 반환해야 한다.

4. 재무 데이터의 범위 계약을 바로잡는다.

4-1. Payment fee

- 7d Payment processing fee가 12,000 VND인데 CARD/CASH/MOMO breakdown이 전부 0으로 보이는 현재 불일치를 해결한다.
- 먼저 `paymentSummary`, `amountSummary`, `paymentFeeSummary`가 각각 range인지 monthly period인지 확인한다.
- 결제수단 breakdown이 movement 분석이라면 총액과 동일 range로 조회하도록 API/모델을 수정한다.
- breakdown이 월간 세금 마감 데이터여야 한다면 `Last 7 days` 섹션에서 제거하고 `2026-08 tax period`처럼 월 범위를 제목에 명시한 별도 월간 섹션으로 이동한다.
- 어느 방식을 선택했는지 코드 주석이 아니라 타입, 이름, 화면 label과 테스트로 명확하게 표현한다.
- 서로 다른 범위의 수치를 동일 범위인 것처럼 같은 카드에 표시하지 않는다.

4-2. General Ledger

- `General Ledger 472 batches`처럼 all-time count를 표시한다면 문구를 `472 total batches`로 명확히 하고 링크도 `/general-ledger?range=all`로 이동시킨다.
- active range count로 바꿀 경우 카드와 목적지 모두 동일 range를 사용한다.
- count와 링크 목적지 필터가 항상 일치하는 테스트를 추가한다.

4-3. Tax and closeout

- 대표 count를 `openTaxCount` 하나로 사용하지 않는다.
- tax, payout outflow reconciliation, coupon/formula 등 실제로 행을 Needs action으로 만드는 모든 open trigger의 합계를 대표 수치로 계산한다.
- 예시 상태는 `6 closeout checks`, 상세는 `6 payout outflow · 0 tax · 0 formula`처럼 원인을 바로 알 수 있어야 한다.
- tax=0, payout outflow=6 fixture 테스트를 추가한다.

4-4. Refund backlog

- Current backlog 행의 count와 amount는 모두 current all-open 기준이어야 한다.
- current open amount가 API에서 신뢰성 있게 제공되지 않으면 selected-period amount 문구를 행에서 제거한다.
- `0 VND opened in selected period`처럼 현재 backlog와 무관한 시점 정보를 섞지 않는다.

5. Backlog 링크 접근성을 수정한다.

- 행 전체 링크의 단순 `aria-label="Review {label}"` 때문에 visible count/oldest/impact/owner가 접근 가능한 이름에서 사라지지 않게 한다.
- 가능한 경우 visible content를 링크 이름으로 사용한다.
- 별도 aria-label이 필요하면 `Open Refund review, 112 open, oldest 82 days, unassigned`처럼 핵심 업무 맥락을 포함한다.
- 아이콘은 장식이면 스크린리더에서 숨긴다.

P2 — 같은 작업에서 함께 개선할 UI

6. Backlog 행 레이아웃을 1440px 이상 운영 화면에 맞게 재구성한다.

- 현재 CSS의 마지막 82px action column과 `Review {긴 큐 이름}` 반복을 제거한다.
- 행 전체를 클릭 가능하게 유지하고 마지막에는 짧은 `Open` 또는 chevron만 둔다.
- 열은 최소한 Priority / Queue / Work / Oldest / Impact / Owner / Action의 의미가 한눈에 보여야 한다.
- 1692px에서 Bank reconciliation 등 가장 긴 실제 label과 큰 숫자를 넣어도 action 문구가 세로로 깨지지 않아야 한다.
- 경고 아이콘은 행 priority에 한 번만 사용하고 각 메타 정보마다 반복하지 않는다.
- owner, oldest, impact의 기준선과 숫자 정렬을 통일한다.

7. Finance scope 영역을 압축한다.

- description과 하단 `Scope:`의 중복 문장을 하나로 합친다.
- 작업공간 제어는 한 줄로 유지한다.
- Movement range와 Monthly tax period는 Money Flow에서만 보여주고 같은 control row 안에 배치한다.
- Today와 Backlog에는 사용하지 않는 range/period 컨트롤이나 설명을 보여주지 않는다.
- 작업공간 전환 시 상단 영역의 높이가 불필요하게 크게 변하지 않게 한다.

8. Today의 빈 상태를 운영 친화적으로 바꾼다.

- 큰 빈 카드 대신 컴팩트한 한 줄 상태 strip을 사용한다.
- 권장 문구: `No finance movement recorded today. Current balances and open queues may still require attention.`
- 오늘 이동이 0이면 Current Balances와 현재 주의 항목이 첫 화면 안에 더 빨리 나타나게 한다.
- 0을 오류나 로딩 실패처럼 표현하지 않는다.

9. Money Flow의 0값과 중복 KPI를 정리한다.

- 선택 범위의 movement 값이 모두 0이면 4개 0 카드와 동일한 상세 값을 반복하지 말고 `No movement in selected range` 상태를 한 번 보여준다.
- 이 경우에도 current liabilities, authorized holds, pending cash, open queues는 숨기지 않는다. 이것들은 기간 movement와 별개의 현재 상태다.
- movement 값이 있을 때는 상단 요약과 상세에서 동일한 네 총계를 그대로 두 번 반복하지 않는다. 상단은 결론, 상세는 구성 요소와 조정 항목 역할을 맡긴다.
- range 기반 섹션과 current/all-open 섹션을 시각적으로 구분하고 각 섹션 제목에 scope를 명시한다.

10. 이전 기간 비교를 활용한다.

- API가 이미 반환하는 `comparisonSummary`를 먼저 검증한다.
- 데이터 계약이 정확하면 7d/30d/90d에서 핵심 KPI의 이전 동일 길이 기간 대비 증감을 간결하게 표시한다.
- 이전 값이 0이거나 비교 불가능하면 무한대 퍼센트를 만들지 말고 `No comparable prior data`처럼 처리한다.
- 비교 값을 표시하지 않기로 결정한다면 서버의 불필요한 previous summary 계산과 응답을 제거한다. 계산만 하고 버리지 않는다.

11. 세부 행의 클릭 가능성을 명확히 한다.

- 카드 안의 링크 행은 기본 상태에서도 작은 chevron 등으로 이동 가능함을 알 수 있어야 한다.
- hover, focus-visible, active 상태를 기존 디자인 토큰으로 구현한다.
- 카드 전체를 버튼처럼 과장하거나 새로운 색상 체계를 만들지 않는다.

12. Segmented control의 의미 구조를 개선한다.

- workspace 전환은 `<nav aria-label="Finance overview workspaces">`처럼 탐색 의미를 갖게 한다.
- range 선택은 적절한 named group 또는 tab semantics를 사용한다.
- 공유 `AdminSegmentedControl`을 변경할 경우 다른 관리자 페이지의 사용처를 검색하고 하위 호환성을 유지한다. 필요하면 semantic variant/prop을 추가한다.
- active 상태를 모두 무조건 `aria-current="page"`로 표현하지 않는다.
- 키보드 focus-visible 상태를 보존한다.

13. 문구를 다음 원칙으로 정리한다.

- `Live · updated` → `Snapshot updated HH:mm` + `Refresh`
- `Review {long queue name}` → visible action은 `Open` 또는 chevron
- `0 open tax`인데 다른 closeout 업무가 존재하는 문구 금지
- `Payment fee methods 3` → `3 methods` 또는 실제 범위와 금액을 설명하는 문구
- 중복 `Scope:` 문장 → `Last 7 days movement · 2026-08 tax period`처럼 한 줄
- user-facing 명칭은 Provider가 아니라 Partner를 사용한다.
- 개발자 내부 용어보다 운영자가 처리해야 할 행동과 결과를 먼저 쓴다.

성능 개선 범위

- 먼저 정확성, URL, 레이아웃을 수정하고 그다음 성능을 측정한다.
- 현재 프런트 aggregate 요청 하나를 여러 클라이언트 요청으로 무작정 쪼개 waterfall을 만들지 않는다.
- `financeOverviewSummary` 내부 22개 병렬 집계 중 workspace에서 사용하지 않는 결과가 있는지 확인한다.
- 응답 계약을 명확하게 유지할 수 있다면 workspace별로 불필요한 서버 집계를 생략하거나 적절한 서버 캐시/부분 집계 경계를 사용한다.
- 일부 summary 실패 때문에 모든 값을 0으로 표시하지 않는다. 기존 unavailable/error truth를 보존한다.
- 수정 전후 Today, Backlog, 7d Flow 전환 시간을 같은 조건에서 기록한다.
- 광범위한 API 구조 개편이 필요하면 추측으로 진행하지 말고, 우선 불필요한 계산 제거와 명확한 scope 계약까지만 안전하게 구현하고 남은 위험을 보고한다.

반드시 추가하거나 갱신할 테스트

1. 82일/59일 장기 업무가 37일 업무 아래에 묻히지 않는 priority test
2. Today/Backlog/Flow workspace별 canonical URL test
3. 7d fee total과 method breakdown의 범위 계약 test
4. General Ledger count와 destination filter 일치 test
5. tax=0, payout outflow=6일 때 `6 closeout checks`가 되는 test
6. Refund backlog가 selected-period amount를 current amount처럼 표시하지 않는 test
7. backlog link accessible name에 queue/count/oldest/owner가 포함되는 test
8. stale 5분 경과 및 Refresh 상태 test
9. 0 movement와 current liability가 동시에 존재하는 empty-state test
10. comparison prior=0 처리 test

최소 검증 명령

- `npm.cmd run test --workspace @massage-vn/admin-web -- --run app/finance-overview/finance-overview-model.spec.ts app/finance-overview/page.spec.tsx`
- API를 변경했으면 관련 `apps/api/src/admin/admin.service.spec.ts`와 `admin.controller.spec.ts`의 Finance Overview 테스트를 실행한다.
- `npm.cmd run verify:scope -- -Scope admin`
- API를 변경했으면 `npm.cmd run verify:scope -- -Scope api`
- AGENTS.md가 요구하는 추가 검증을 수행하고, 실행하지 못한 검증은 이유와 위험을 정확히 보고한다.

브라우저 완료 검수

로그인된 `http://localhost:3101/finance-overview`를 1692×1272 또는 유사한 1440px 이상 화면에서 직접 검사한다.

1. Today 기본 URL과 빈 상태
2. Current backlog의 기본 정렬과 긴 행 label
3. Money Flow Today의 0 movement 상태
4. Money Flow 7d의 fee total/method scope
5. 7d Flow → Today 전환 후 canonical URL
6. 7d Flow → Backlog 전환 후 canonical URL
7. General Ledger 링크 목적지
8. Refresh loading/completion/stale 상태
9. 다크 테마
10. 라이트 테마
11. 콘솔 warning/error
12. 키보드로 workspace/range/queue link 접근

수정 전후 스크린샷을 남기고 다음을 시각적으로 확인한다.

- 1440px 이상에서 Backlog action과 label이 비정상적으로 세로 줄바꿈되지 않는다.
- Today 0 상태에서 Current Balances가 과도하게 아래로 밀리지 않는다.
- range 기반 값, monthly period 값, current/all-open 값이 제목과 배치만으로 구분된다.
- 다크/라이트 테마의 대비와 focus-visible이 유지된다.

완료 조건

- URL의 workspace/range/period와 실제 화면 scope가 항상 일치한다.
- 같은 섹션의 숫자는 같은 범위를 사용하거나 다른 범위가 눈에 보이게 명시된다.
- Backlog 첫 행과 정렬 설명이 실제 운영 위험을 반영한다.
- 1692px에서 긴 action text가 여러 줄로 깨지지 않는다.
- 자동 갱신이 없을 때 `Live`가 표시되지 않으며 Refresh와 stale 상태가 작동한다.
- Today 0 상태에서 현재 balances와 open-risk 정보가 우선 노출된다.
- 7d fee total이 양수인데 동일 범위의 method breakdown이 전부 0인 모순이 없다.
- 기존 41개 Finance Overview 테스트와 신규 계약 테스트가 모두 통과한다.
- 다크/라이트 테마와 다른 AdminSegmentedControl 사용처에 회귀가 없다.
- 브라우저 콘솔에 새 warning/error가 없다.

최종 보고 형식

1. 운영자 관점에서 무엇이 달라졌는지
2. 변경 파일 목록과 각 파일의 역할
3. P1/P2 항목별 구현 결과
4. 데이터 scope 결정 사항: today/range/period/all-open
5. 테스트·verify 명령과 pass/fail/skipped 결과
6. 브라우저 검증한 URL/상태와 스크린샷 경로
7. 성능 수정 전후 수치
8. 보호 영역 변경 여부
9. 남은 위험 또는 의도적으로 제외한 항목

중요: 작업 도중 보고서에 적힌 숫자를 하드코딩하지 말고 실제 데이터와 타입에서 계산하라. 수정이 끝나기 전에는 완료라고 보고하지 마라.
```

---

## 이 프롬프트가 고정한 구현 결정

- Finance Overview는 세 페이지로 분리하지 않고 한 페이지의 세 작업공간으로 유지한다.
- 무거운 aggregate를 60초마다 강제 호출하지 않고, 이번 수정에서는 `Snapshot + manual Refresh + stale clock`을 기본으로 한다.
- URL에서 사용하지 않는 range/period를 제거해 URL을 실제 화면 상태와 일치시킨다.
- Backlog는 문자열을 파싱하지 않고 정렬 가능한 숫자 필드를 모델에 둔다.
- Payment fee 데이터는 동일 범위로 통일하거나 월간 섹션으로 명확히 분리한다. 범위가 다른 숫자를 같은 카드에 섞는 것은 허용하지 않는다.
- 모바일/1024px 이하 화면은 구현 우선순위와 검수 보고에서 제외한다.

