# Operations Policy 개선 후 최종 재감사 보고서

- 감사 일자: 2026-08-13
- 대상 경로: `/operations-policy`, Supply, Simulation, Audit, 정책 변경 패널
- 비교 기준: `operations-policy-final-reaudit-2026-08-11.md`, `operations-policy-remediation-report-2026-08-11.md`
- 화면 기준: 1440×1000 및 1600×1000 데스크톱
- 감사 방법: 로그인된 실제 화면 캡처, 비파괴 상호작용, Admin Web·API·감사·권한 계약 추적, 관련 테스트 및 타입 검사
- 안전 원칙: 실제 정책 저장, 감사 데이터 생성, 운영 데이터 변경은 수행하지 않음

## 1. 결론

이전 보고서의 핵심 수정은 상당 부분 반영됐다. Before/After 감사 값이 정상 표시되고, 필수 확인 문구가 보이며, 정책 목록은 8열 표에서 5열 그룹 목록으로 정리됐다. Policies, Supply, Simulation, Audit도 한 경로의 워크스페이스로 통합됐고, 중첩 세로 스크롤은 제거됐다.

그러나 현재 상태는 **실제 운영 정책 변경 기능으로 출시하면 안 된다.** 이번 재감사에서 기존 보고서보다 더 위험한 두 가지 출시 차단 문제를 확인했다.

1. 한 정책에서 작성한 새 값·사유·확인 체크가 다른 정책으로 전환해도 그대로 남고, 저장 버튼도 활성화된 상태를 유지한다. 운영자는 다른 정책을 의도치 않은 값으로 바로 저장할 수 있다.
2. 화면은 28개 모두를 `Live policy`로 표시하지만, 이 중 7개는 실제 API 실행 경로에서 설정을 전혀 읽지 않는다. 추가로 1개는 다른 값을 저장해도 런타임에서 동일한 값으로 정규화되고, 1개는 선택 가능한 대안이 하나뿐이다.

**종합 점수: 61/100 — 조회·진단용 내부 화면으로는 쓸 수 있지만, 정책 쓰기 기능은 출시 보류가 필요하다.**

권장 출시 조건은 P0 2건을 먼저 해결하고, 1440px 편집 잘림·감사 출처 오분류·동시 수정 원자성을 바로 뒤이어 해결하는 것이다.

## 2. 점수표

| 영역 | 점수 | 판단 |
|---|---:|---|
| 운영자 과업 명확성 | 74/100 | 그룹·필터·탭은 좋아졌지만 정상 상태 카드와 운영 차단 상태가 분리되어 있음 |
| 정책 변경 안전성 | 35/100 | 검증·사유·확인은 좋아졌으나 정책 전환 시 이전 입력이 재사용되는 치명적 오류가 있음 |
| 정책 집행 진실성 | 42/100 | 28개가 모두 Live로 표시되지만 약 19개만 실질적으로 동작을 바꿀 수 있음 |
| 감사 데이터 신뢰성 | 55/100 | Before/After는 복구됐으나 기존 자동 스모크가 Operator로 계속 표시됨 |
| 1440px 화면 구성 | 58/100 | 기본 목록은 읽을 수 있으나 편집 패널을 열면 Action 열이 잘리고 Close가 줄바꿈됨 |
| Supply·Simulation 근거 | 57/100 | 시각·표본·Demo 경고는 좋지만 공급 0에서도 무의미한 표를 계속 노출함 |
| 접근성·문구 | 70/100 | 확인 문구·키보드 상태는 개선됐으나 초기부터 오류가 노출되고 유효 상태 도움말도 빨간색임 |
| 성능·로딩 | 66/100 | 샘플은 제한됐으나 Supply DOM이 6,634px이고 Audit도 불필요한 settings 조회를 수행함 |
| 테스트·코드 계약 | 72/100 | 204개 집중 테스트와 타입 검사는 통과했지만 실제 전환 상태·실행 소비자·동시성 계약은 누락됨 |

## 3. 이전 보고서 대비 이행 상태

| 이전 요구 | 현재 상태 | 판정 |
|---|---|---|
| 감사 Before/After 계약 통일 | `before ?? previousValue`, `after ?? value`로 표시되고 실제 화면에도 값이 보임 | 완료 |
| 필수 확인 문구 가시화 | 문구 전체가 보이고 체크박스와 연결됨 | 완료 |
| 동일 값·사유 길이·확인 검증 | 클라이언트와 서버 모두 검증함 | 완료 |
| 8열 비교표를 5열 그룹 목록으로 변경 | 기본 화면은 5열 구조로 개선됨 | 부분 완료 — 1440px 편집 시 Action 열 잘림 |
| 검색·상태·그룹 필터 | 동작하며 URL에 상태를 유지함 | 완료 |
| 중첩 세로 스크롤 제거 | 페이지 세로 스크롤 하나만 존재함 | 완료 |
| Policies/Supply/Simulation/Audit 통합 | 한 경로의 영구 탭 구조로 변경됨 | 완료 |
| 관측 시각·표본·Demo 좌표 경고 | 화면 상단에 표시되고 새로고침 링크가 있음 | 완료 |
| 공급 0을 성공이 아닌 차단으로 표시 | 상단은 `Blocking`, `Supply is not ready`로 표시함 | 부분 완료 — 하단 0값 표는 계속 노출 |
| Simulation 전제조건 실패 시 표 숨김 | Simulation 표는 숨김 | 부분 완료 — 상단 상태는 여전히 `Current snapshot` |
| 자동 스모크 출처 분리 | 새 기록 계약은 HMAC 출처를 지원함 | 부분 완료 — 기존 기록은 Operator로 오분류 |
| 불필요 API 조회 제거 | Policies는 settings만 읽고 Supply/Simulation은 제한된 표본을 읽음 | 부분 완료 — Audit도 settings를 읽음 |
| Live/Planned 상태 정합성 | 모든 정의를 Live로 표시함 | 실패 — 실제 실행 소비자가 없는 정책도 Live |
| 위험도별 확인·재인증·롤백 | 공통 체크박스와 감사 링크만 있음 | 미완료 |

## 4. 잘된 부분

1. **감사 값 복구**: 최근 감사 행에서 Before와 After가 실제 값으로 표시된다.
2. **폼 기본 계약 개선**: 값 범위, 동일 값, 사유 12–500자, 확인 체크, 충돌·권한·네트워크 오류 문구가 분리됐다.
3. **운영 영역 그룹화**: Shift & Queue SLA, Booking Safety, Matching & Availability, Money & Settlement, Exceptions & Evidence, Notification Routing의 분류는 운영자가 찾기 쉽다.
4. **기본 목록 밀도 개선**: 정책, 현재값, 상태, 마지막 변경, 작업의 5개 핵심 열은 이전 8열 표보다 낫다.
5. **상태 개념 분리**: `Current deviations`와 `Changed at least once`를 분리해 현재 이탈과 과거 변경을 구분했다.
6. **근거 출처 표시**: Supply와 Simulation에 관측 시각, booking 표본 20건, Partner 표본 30건, Demo 좌표 경고가 보인다.
7. **데이터 부족 방어**: Simulation은 실행 전제조건이 없으면 무의미한 결과 표를 숨긴다.
8. **API 기본 안전장치**: 값과 감사 이벤트가 한 트랜잭션에 기록되고, System Policy 권한과 값 범위가 서버에서 재검증된다.
9. **화면 오류 없음**: 실제 브라우저 콘솔에서 error·warning을 확인하지 못했고 페이지 수평 오버플로도 없었다.

## 5. P0 — 출시 전 필수 수정

### P0-1. 정책을 바꾸어도 이전 정책의 폼 상태가 그대로 재사용된다

실제 브라우저에서 다음 순서로 재현했다.

1. `Matching delay review SLA`, 현재값 15분을 열었다.
2. 새 값 20, 사유 `Matching delay queue review showed overdue cases above the launch baseline.`, 확인 체크를 입력했다.
3. 저장하지 않고 `Payment hold review SLA`, 현재값 60분으로 이동했다.
4. 화면 제목과 Before는 Payment hold/60분으로 바뀌었지만, After 20분·이전 사유·확인 체크가 그대로 남았다.
5. `Save policy change`가 활성화되어 있었다.

이는 단순 표시 문제가 아니라 **다른 정책을 잘못 저장할 수 있는 직접적인 운영 사고 경로**다.

코드 원인:

- `operations-policy-form.tsx:41-43`의 `useState`는 최초 마운트 때만 `setting`을 읽는다.
- `page.tsx:333`은 `<OperationsPolicyForm setting={selectedSetting} />`에 정책 키를 React `key`로 전달하지 않는다.
- 같은 위치의 Client Component가 재사용되므로 `nextValue`, `reason`, `confirmed`, `useActionState` 결과가 새 정책으로 넘어간다.

수정 요건:

- 가장 단순한 안전 수정은 `<OperationsPolicyForm key={selectedSetting.key} setting={selectedSetting} />`로 정책마다 폼을 강제 재마운트하는 것이다.
- 사용자가 값을 입력한 상태에서 다른 정책·탭·닫기를 누르면 `작성 중인 변경을 버릴까요?` 확인을 제공한다.
- 새 정책으로 이동하면 새 값은 그 정책의 현재값, 사유는 빈 값, 확인은 미체크, 서버 action 상태는 idle이어야 한다.
- 저장 버튼은 새 정책의 유효성만으로 계산해야 한다.

완료 기준:

- A 정책에서 유효한 폼을 만든 뒤 B 정책으로 이동해도 A의 값·사유·체크·성공/오류 상태가 하나도 남지 않는다.
- A에서 저장 중인 상태에는 정책 전환을 막는다.
- React rerender 기반 회귀 테스트와 실제 브라우저 전환 테스트를 추가한다.

증거: `05-policy-switch-stale-form-state-1600x1000.png`

### P0-2. 실제로 집행되지 않는 정책을 편집 가능한 Live 정책으로 표시한다

화면은 `Live policies 28 / 28`을 표시하고 각 행에 `Live · aligned`, 편집 패널에는 `Live policy`를 표시한다. 그러나 코드 소비자를 추적한 결과 다음 7개 키는 Admin CRUD 정의와 테스트 외 API 실행 코드에서 읽히지 않는다.

| 키 | 화면 의미 | 현재 실제 상태 |
|---|---|---|
| `wallet.negative_balance_gate` | 음수 지갑 최종 차단 | 실행 로직은 별도 하드코딩이며 이 키를 읽지 않음 |
| `decision.action_evidence_gate_mode` | Booking action 증거 기준 | 실행 경로에서 읽지 않음 |
| `cash.settlement_clearance_policy` | 현금 정산 해제 증거 | 실행 경로에서 읽지 않음 |
| `payout.batch_cycle_policy` | 지급 배치 주기 | 지급 실행 경로에서 읽지 않음 |
| `matching.first_pick_expiry_action_policy` | First-pick 만료 처리 | 실행 경로에서 읽지 않음 |
| `cancellation.after_match_policy` | 매칭 후 취소 처리 | 취소 로직은 별도 고정 동작이며 이 키를 읽지 않음 |
| `no_show.evidence_requirement_policy` | 노쇼 증거 최소 기준 | 실행 경로에서 읽지 않음 |

추가로:

- `matching.marketplace_open_mode`는 legacy delayed 값을 저장할 수 있지만 `matching.policy.ts:845-850`에서 두 옵션을 모두 `IMMEDIATE_WITHIN_WINDOW`로 정규화한다. 저장된 변경은 운영 동작을 바꾸지 않는다.
- `matching.preferred_accept_mode`는 선택 가능한 값이 하나뿐이며 resolver도 입력을 무시하고 고정 값을 반환한다. `Review change`를 열어도 변경할 수 없는 정책이다.

따라서 실질적으로 운영 동작을 바꿀 수 있는 정책은 약 19개다. 9개를 현재처럼 Live 편집 대상으로 두면 운영자는 변경 사유와 감사를 남기고도 시스템 동작이 바뀌지 않는 상황을 겪는다.

수정 요건:

- 정책 정의에 수동 `enforced: true` 대신 `lifecycle: live | locked | planned | deprecated`와 `consumerContract`를 둔다.
- 실제 소비자가 없는 7개는 즉시 `Planned` 또는 `Reference only`로 바꾸고 `Review change`를 제거한다.
- 고정 계약 2개는 `Locked by MVP contract`로 표시하고 편집 폼을 열지 않는다.
- Live로 승격하려면 실제 service consumer, 실패 시 fallback, snapshot 적용 범위, 통합 테스트를 함께 추가한다.
- `policy:admin-consistency`는 키·기본값뿐 아니라 각 Live 정책의 허용된 consumer manifest와 통합 테스트 존재를 검증해야 한다.

완료 기준:

- `Live` 행은 저장 후 실제 신규 요청·큐·정산·알림 동작이 바뀌는 통합 테스트를 가진다.
- 실행 소비자가 없는 정책은 저장 API가 409 또는 읽기 전용 상태를 반환한다.
- 화면의 Live 수와 consumer manifest의 Live 수가 정확히 일치한다.

## 6. P1 — 높은 우선순위

### P1-1. 1440px에서 편집 패널을 열면 정책 목록의 Action 열이 잘린다

1440×1000에서 편집 패널을 열면 좌측 목록에 Policy, Current value, Status, Last changed만 보이고 Action 열이 완전히 사라진다. 수평 스크롤도 제공되지 않는다. Close 버튼은 `Clo / se`로 줄바꿈된다.

원인:

- `globals.css:17829`는 콘텐츠 영역을 최소 660px 목록 + 최소 340px editor로 나눈다.
- 5열 목록 자체의 최소 필요 폭은 좌우 padding과 gap을 포함해 약 824px이다.
- `operations-policy-group`은 `globals.css:17843`에서 `overflow:hidden`이므로 넘친 Action 열이 잘린다.
- 단일 열 전환은 viewport 1280px 이하에서만 적용되지만, 고정 사이드바가 있는 1440px의 실제 콘텐츠 폭은 이미 부족하다.

수정 방향:

- 1440–1599px에서는 목록+편집 2열을 쓰지 말고 우측 drawer 또는 전체 폭 편집 영역을 사용한다.
- 2열을 유지하려면 최소 1680px 이상에서만 활성화하고, 목록의 5개 열 최소 폭을 실제로 보장한다.
- Close는 아이콘 버튼 또는 `white-space: nowrap`이 적용된 최소 폭 버튼으로 만든다.
- 1440px 시각 회귀 테스트는 Action 열, Close, 필터 라벨, 저장 버튼을 모두 확인해야 한다.

증거: `14-policy-change-panel-1440x1000.png`

### P1-2. 기존 자동 스모크 감사가 여전히 Operator 변경으로 표시된다

Operator changes 기본 화면의 최근 8행은 사유가 모두 `Automated smoke coverage...`인데 Source는 `Operator`, environment는 `unknown`으로 표시됐다. 반면 Automated smoke 탭은 0건이다.

원인:

- 새 HMAC 출처 계약 이전의 레코드에는 `metadata.source`가 없다.
- `policy-audit-rows.ts:36-37`은 `automated_smoke`가 아니면 모두 `operator`로 간주한다.
- 화면은 최근 50건을 받은 후 클라이언트에서 출처를 필터하고 8건만 남긴다. 특정 출처 레코드가 최신 50건 밖에 있으면 존재해도 빈 화면이 될 수 있다.
- 정책 목록의 `Changed at least once`와 Last changed도 `updatedAt`만 보므로 자동 복구 변경을 운영자 변경처럼 계산한다.

수정 방향:

- 출처를 `operator | automated_smoke | legacy_unknown` 3상태로 모델링한다.
- 과거 `Automated smoke coverage` 레코드는 일회성 backfill 또는 명시적 `Legacy automation, inferred`로 분리한다.
- 서버 audit endpoint가 source 필터와 cursor를 받아야 하며, 필터 후 8건이 아니라 해당 source의 최신 8건을 반환해야 한다.
- Settings 응답에 `lastChangeSource`, `lastOperatorChangedAt`, `lastOperatorChangedBy`를 추가해 목록 집계를 정정한다.

증거: `10-audit-operator-1600x1000.png`, `11-audit-automated-smoke-1600x1000.png`

### P1-3. optimistic concurrency가 실제 동시 요청을 원자적으로 막지 못한다

API는 transaction 안에서 현재 값을 SELECT한 뒤 `previousValue !== expectedValue`를 검사하고 UPSERT한다. 그러나 row lock이나 조건부 update가 없다. 두 요청이 동시에 같은 expectedValue를 읽으면 둘 다 검사를 통과한 후 마지막 write가 앞선 변경을 덮어쓸 수 있다.

현재 단위 테스트는 순차 mock만 검증하며 실제 PostgreSQL 동시 transaction을 검증하지 않는다.

수정 방향:

- `UPDATE ... WHERE key = ? AND value = expectedValue` 조건부 갱신과 affected row 1 검증을 사용한다.
- row가 없을 때 default value를 기준으로 하는 create race도 unique conflict를 포함해 처리한다.
- 또는 policy row를 먼저 materialize한 뒤 `SELECT ... FOR UPDATE`를 사용한다.
- 실제 DB 통합 테스트에서 두 동시 요청 중 정확히 하나만 성공하고, 실패 요청은 409이며, audit도 한 건만 생성되는지 검증한다.

### P1-4. 공급이 0인데도 6,634px 길이의 0값 표를 계속 보여 준다

Supply 상단은 `Blocking`, `0 usable Partners`, Demo 좌표 경고를 올바르게 표시한다. 그러나 바로 아래에 Final partner choice, Partner impact, radius sensitivity, freshness sensitivity, matching stage impact를 모두 렌더링한다.

현재 표본에서 반경 4행, freshness 5행, stage scenario 10행 이상이 거의 모두 0이며 같은 경고 문구를 반복한다. Supply 페이지의 전체 높이는 6,634px였다. 특히 sensitivity의 두 복잡한 표를 2열로 배치해 1600px에서도 헤더가 잘리고 가로 스크롤과 큰 공백이 생긴다.

코드 원인:

- `page.tsx:391-395`는 `usableSupply === 0`과 관계없이 세 섹션을 모두 렌더링한다.
- `operations-policy-sensitivity-preview-section.tsx`는 복잡한 표 두 개를 공통 `AdminDetailGrid` 2열에 넣는다.

수정 방향:

- usable supply 0이면 상단 차단 카드, 원인 요약, 직접 작업 3개만 먼저 표시한다.
- `Show diagnostic details`를 눌렀을 때만 좌표 표본과 0값 분석을 연다.
- sensitivity 표는 각각 전체 폭으로 세로 배치한다.
- open matching sample이 0이면 stage scenario 표를 숨기고 `No open bookings to model`로 대체한다.

증거: `06-supply-blocker-1600x1000.png`, `08-supply-sensitivity-layout-1600x1000.png`

### P1-5. 초기 폼이 사용자가 건드리기 전부터 오류 상태이고, 유효한 값도 빨간 안내로 보인다

편집 패널을 열자마자 현재값, 빈 사유, 미체크 확인에 대한 빨간 오류가 모두 표시된다. 값 20·유효 사유·확인 체크를 완성해 저장 버튼이 활성화된 상태에서도 `Choose a value different from the current value.`가 빨간색으로 남았다.

원인:

- `operations-policy-form.tsx:45-48`은 초기 렌더부터 전체 validation을 오류로 사용한다.
- 값 오류가 없을 때도 `operations-policy-form.tsx:187-188`의 동일한 danger class로 도움말을 렌더링한다.

수정 방향:

- 필드 오류는 touched 또는 제출 시도 이후에만 표시한다.
- 저장 버튼이 비활성화된 이유는 중립 도움말이나 작은 체크리스트로 보여 준다.
- 유효한 필드는 danger 색을 제거하고 필요하면 `Ready` 또는 기본 도움말만 표시한다.
- 서버 오류 후에는 오류 요약과 해당 필드 오류를 유지한다.

증거: `03-policy-change-panel-1600x1000.png`, `04-policy-change-valid-not-submitted-1600x1000.png`

### P1-6. Simulation은 실행 불가인데 상단 상태가 `Current snapshot`이다

Simulation은 Demo 좌표를 사용하고 usable supply가 없어 `Simulation prerequisites are not met`를 표시한다. 그런데 섹션 헤더 상태는 청록색 `Current snapshot`이다. 운영자는 실행 가능하고 신뢰할 수 있는 최신 결과처럼 해석할 수 있다.

원인: `page.tsx:353-354`는 Supply에서만 `usableSupply === 0`을 Blocking으로 처리한다.

수정 방향:

- 상태를 `Ready`, `Blocked`, `Unavailable`, `Stale`, `Demo evidence`로 단일 모델화한다.
- Simulation ready가 false면 `Blocked — no eligible supply`로 표시한다.
- 관측 시각과 신뢰도는 별도 정보로 표시하고 준비 상태 배지와 섞지 않는다.

증거: `09-simulation-prerequisites-1600x1000.png`

### P1-7. System Policy 운영자에게 보이는 탭과 실제 진단 권한이 다르다

페이지 자체는 `SYSTEM_POLICY` 권한으로 접근한다. 그러나 Supply, Simulation, Audit은 `DEVELOPER_SYSTEM` 계열 권한이 없으면 `operations-policy-page-model.ts:45-50`에서 조용히 Policies로 되돌린다. 상단 탭은 권한과 관계없이 항상 보이고, 권한이 부족하다는 설명도 없다.

수정 방향:

- 정책을 변경하는 운영자에게 필요한 운영 근거라면 Supply·Simulation·Audit을 `SYSTEM_POLICY` read 권한에 포함한다.
- 개발자 전용 진단이라면 탭을 숨기고 `Developer diagnostics`로 명확히 분리한다.
- 권한 부족 시 URL만 남긴 채 Policies로 보이지 말고 403 안내와 요청할 권한을 표시한다.

### P1-8. 고위험 정책도 일반 SLA와 동일한 한 번의 체크만 요구한다

FCM 전체 발송, booking gate, service area, cash·payout 관련 설정은 영향 범위가 다르지만 모두 같은 체크박스와 같은 저장 버튼을 사용한다. 롤백 버튼이나 변경 유예도 없다.

수정 방향:

- 정책 정의에 `risk: low | medium | high`와 `blastRadius`를 추가한다.
- High: 재인증 또는 정책명 입력, 의존성 readiness 확인, 즉시 롤백 링크를 제공한다.
- Medium: 영향 큐와 현재 활성 건수를 확인한다.
- Low: 현재 폼 계약을 유지한다.
- 성공 화면에 audit ID, Before→After, `Revert to Before`를 제공하고 되돌림도 새 감사 이벤트로 기록한다.

## 7. P2 — 품질 및 유지보수 개선

### P2-1. 1440px 필터 검색 라벨과 placeholder가 잘린다

1440px 기본 화면에서 `Search policies` 라벨이 두 줄로 깨지고 placeholder가 `Search label or descripti`에서 잘린다. 검색은 독립 라벨을 위에 두고 input 전체 폭을 확보하거나, Status·Group의 너비를 조금 줄이는 편이 낫다.

### P2-2. 필터된 그룹 헤더가 전체 수만 보여 준다

`Changed before` 필터에서 Matching & Availability는 실제 4행만 보이지만 헤더는 `7 policies`, `4 changed`로 표시한다. `4 shown / 7 total`로 표시해야 필터 결과 수를 즉시 이해할 수 있다.

### P2-3. Shift SLA 편집 영향 문구가 실제 집행을 설명하지 않는다

7개 Shift SLA는 실제로 사용되지만 `policyImpactDetails`에 정의가 없어 편집 패널이 fallback 문구 `This setting is tracked for auditability and future automation.`을 표시한다. Live 정책을 미래 자동화처럼 설명하는 모순이다.

각 SLA에 다음을 표시해야 한다.

- 어떤 Start Shift queue의 overdue 기준을 바꾸는지
- 현재 open/overdue 건수
- 임계값을 줄이거나 늘렸을 때의 운영 영향
- 해당 큐로 이동하는 링크

### P2-4. Audit 화면도 settings API를 불필요하게 읽는다

`operations-policy-page-model.ts:77`에서 settingsHref가 모든 모드에 항상 지정된다. Audit은 audit row 렌더링에 settings를 사용하지 않으므로 audit endpoint만 읽어야 한다.

### P2-5. 감사 표가 8열 텍스트를 한 화면에 압축한다

Before/After 복구는 좋지만 Policy, Reason, Source, Ops effect가 모두 긴 텍스트여서 1600px에서도 행 높이가 매우 크다.

권장 기본 열:

- When
- Policy
- Before → After
- Actor / Source
- Reason
- Details

Ops effect, environment, runId는 row expansion이나 상세 drawer로 이동한다.

### P2-6. 정적 FCM 준비 문구가 실제 시스템 상태와 다시 어긋날 수 있다

Supply는 `FCM live smoke and token recovery passed`를 정적 문자열로 표시한다. Policy option은 credentials와 mobile config가 준비된 뒤 켜야 한다고 설명한다. System Health의 실제 readiness 값을 읽어 `Configured`, `Smoke passed`, `Monitoring ready`, `Policy enabled`를 별도 표시해야 한다.

### P2-7. 더 이상 렌더링되지 않는 Operations Policy 모듈이 다수 남아 있다

Action gate checklist, authority baseline, booking create gate, enforcement trace, matching playbook, next choices, owner decision backlog, recommended value review 등 최소 8개 section component는 page에서 사용하지 않고 테스트만 남아 있다. 관련 model/helper까지 합치면 유지보수 표면이 더 크다.

삭제 또는 별도 archive를 권장한다. 현재 197개 Admin 집중 테스트가 통과해도 실제 폼 전환 P0를 놓친 이유 중 하나는 오래된 구조 테스트가 현재 핵심 경로보다 많은 비중을 차지하기 때문이다.

## 8. 권장 최종 정보 구조

### Policies

1. Compact header: `19 Live · 2 Locked · 7 Planned`와 마지막 운영자 변경
2. 주의 스트립: current deviation, dependency blocker, unaudited legacy, stale evidence
3. 검색·상태·그룹 필터
4. 5열 그룹 목록
5. 1440px에서는 우측 drawer, 1680px 이상에서만 side-by-side editor

### Supply

1. 최상단 readiness: `Blocked — 0 usable Partners`
2. 원인 3개: identity 30, location 30, push 30
3. 직접 작업 링크
4. `Show diagnostic details` 아래에만 표본·sensitivity

### Simulation

1. 선행조건 gate
2. 준비됐을 때만 scenario control과 결과 표시
3. 현재 정책과 후보값의 delta 중심 표시
4. Demo/stale/production 근거를 명확히 구분

### Audit

1. Operator / Automated / Legacy unknown 탭
2. Before→After 중심 6열 요약
3. source·environment·runId·effect는 drawer
4. 서버 source 필터와 cursor pagination

## 9. 운영 문구 수정안

| 현재 문구 | 권장 문구 |
|---|---|
| `Live policies 28 / 28` | `19 live · 2 locked · 7 planned` |
| `Live · aligned` | `Live · baseline aligned` — 실제 consumer가 있을 때만 |
| `This setting is tracked for auditability and future automation.` | `Changes when this queue becomes overdue on Start Shift.` |
| `Current snapshot` + simulation blocked | `Blocked · no eligible Partner supply` |
| `Operator / unknown` + automated smoke reason | `Legacy automation · source inferred` |
| `7 policies` in a 4-row filtered result | `4 shown / 7 total` |
| 초기 빨간 `Choose a value different...` | 중립 `Enter a different value to prepare a change.` |

## 10. 구현 우선순위

### 1차 — 당일 P0 안전 패치

1. `OperationsPolicyForm`을 `selectedSetting.key`로 remount
2. dirty 전환 확인과 저장 중 전환 차단
3. 7개 무소비 정책 편집 차단
4. 고정 계약 2개를 Locked로 표시
5. 전환 상태 브라우저 회귀 테스트

### 2차 — 1440px·감사 신뢰성

1. 1440px drawer/stack editor
2. legacy_unknown 출처와 과거 smoke backfill
3. 서버 source 필터·cursor
4. 정책 목록에 last operator change 출처 추가
5. 초기 오류/touched 상태 수정

### 3차 — 실행 계약·동시성

1. Live policy consumer manifest
2. 조건부 update 또는 row lock
3. 실제 PostgreSQL 동시성 통합 테스트
4. risk tier·재인증·rollback

### 4차 — Supply·Simulation 정리

1. 0 supply diagnostics 접기
2. 두 sensitivity 표 전체 폭 배치
3. ready/block/stale/demo 공통 상태 모델
4. System Health readiness 연동
5. dead Operations Policy section 제거

## 11. 필수 회귀 테스트

1. A 정책에서 값·사유·확인을 입력하고 B 정책으로 이동하면 모든 폼 상태가 초기화된다.
2. dirty 폼 전환은 명시적 폐기 확인을 요구한다.
3. 저장 중 정책 전환·탭 전환이 차단된다.
4. consumer 없는 정책은 편집 링크가 없고 PATCH도 거부된다.
5. Live 정책마다 실제 service integration test가 존재한다.
6. 두 동시 PATCH 중 한 건만 성공하고 audit도 한 건만 생성된다.
7. 1440×1000에서 Action 열, Close, 필터, 저장 버튼이 잘리지 않는다.
8. 초기 폼에는 danger 오류가 없고 touched/submit 이후에만 오류가 보인다.
9. 유효한 값 도움말은 danger 색이 아니다.
10. legacy smoke는 Operator 탭에 나타나지 않는다.
11. source 필터는 서버에서 적용되고 최신 8건을 정확히 반환한다.
12. supply 0이면 sensitivity·stage 표가 기본 렌더되지 않는다.
13. simulation ready=false이면 헤더 상태가 Blocking이다.
14. System Policy만 가진 운영자에게 진단 탭이 숨겨지거나 명확한 권한 안내가 보인다.
15. risk=high 변경은 재인증/명시 확인과 rollback을 제공한다.

## 12. 실행 검증 결과

| 명령·검증 | 결과 |
|---|---|
| 로그인 브라우저 1440×1000, 1600×1000 | 완료 |
| 정책 전환 stale-state 비파괴 재현 | 재현됨 — 저장은 수행하지 않음 |
| 브라우저 console error/warn | 0건 |
| `npm.cmd run test --workspace @massage-vn/admin-web -- app/operations-policy components/admin-form-control-usage.spec.tsx` | PASS — 46 files, 197 tests |
| `npm.cmd run test --workspace @massage-vn/api -- ... -t "operational policy\|audit source"` | PASS — 2 files, 7 tests, 654 skipped |
| `npm.cmd run typecheck --workspace @massage-vn/admin-web` | PASS |
| `npm.cmd run typecheck --workspace @massage-vn/api` | PASS |
| `npm.cmd run policy:admin-consistency` | PASS — 키·기본값 정합성, 소비자 존재는 검증하지 않음 |
| `npm.cmd run admin:visible-copy` | PASS — 1,637 files, 0 violations |
| Impeccable detector | exit 1 — 전역 CSS의 기존 side-tab 6건. Operations Policy 대상 selector 신규 항목 없음 |

자동 테스트가 모두 통과해도 이번 P0는 검출되지 않았다. 현재 form test는 정적 렌더와 개별 validation을 확인하지만, 동일 Client Component에 다른 `setting` prop을 전달하는 전환 상호작용을 검증하지 않는다. 정책 정합성 검사도 key/default만 비교하고 실제 consumer 존재를 확인하지 않는다.

## 13. 증거 캡처

증거 폴더: `docs/audits/operations-policy-final-reaudit-evidence-2026-08-13/`

1. `01-policies-overview-1600x1000.png`
2. `02-policies-overview-full-1600.png`
3. `03-policy-change-panel-1600x1000.png`
4. `04-policy-change-valid-not-submitted-1600x1000.png`
5. `05-policy-switch-stale-form-state-1600x1000.png`
6. `06-supply-blocker-1600x1000.png`
7. `07-supply-zero-tables-1600x1000.png`
8. `08-supply-sensitivity-layout-1600x1000.png`
9. `09-simulation-prerequisites-1600x1000.png`
10. `10-audit-operator-1600x1000.png`
11. `11-audit-automated-smoke-1600x1000.png`
12. `12-policies-dark-mode-1600x1000.png`
13. `13-policies-overview-1440x1000.png`
14. `14-policy-change-panel-1440x1000.png`

## 14. 최종 판단

이번 개선은 정보 구조와 기본 가독성 면에서는 성공했다. 특히 이전 P0였던 감사 Before/After와 보이지 않던 확인 문구는 제대로 고쳐졌다. 하지만 정책 변경 화면의 핵심은 보기 좋은 목록보다 **정확한 정책을 정확한 값으로 바꾸고, 실제 시스템 동작이 그 값대로 변하며, 그 사실을 감사할 수 있는 것**이다.

현재는 세 조건 중 첫 번째가 정책 전환 stale state로 깨지고, 두 번째가 무소비 Live 정책으로 깨지며, 세 번째가 legacy smoke 오분류로 부분적으로 깨진다. 따라서 UI 폴리시보다 먼저 P0 두 건과 감사 출처·동시성 계약을 수정해야 한다. 이 항목들이 해결된 뒤에야 Operations Policy를 실제 운영 쓰기 화면으로 출시할 수 있다.

## 15. 변경 및 보호 범위

- 제품 코드는 수정하지 않음
- 실제 정책 PATCH를 수행하지 않음
- 운영 DB·감사 로그·Prisma schema·migration을 변경하지 않음
- 기존 dirty worktree와 사용자 변경을 보존함
- 이번 작업에서 추가한 파일은 본 보고서와 증거 캡처 폴더뿐임
