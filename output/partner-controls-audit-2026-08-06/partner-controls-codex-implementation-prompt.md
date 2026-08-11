# Partner Controls 개선 구현용 Codex 프롬프트

아래 프롬프트를 `C:\dev\massage-on-demand-vn` 저장소를 연 Codex 작업에 그대로 붙여 넣는다. 별도의 새 저장소나 새 UI 프레임워크를 만들지 않는다.

---

## 복사해서 사용할 프롬프트

```text
C:\dev\massage-on-demand-vn 프로젝트의 관리자 웹 `Partner Controls`를 실제 운영자가 신뢰하고 빠르게 처리할 수 있는 화면으로 개선해줘.

이번 작업은 단순 스타일 수정이 아니다. 데이터 범위와 페이지네이션을 먼저 정확하게 만들고, 운영 정책 문구를 통일한 다음, 중복 화면을 하나의 우선순위 큐 중심으로 재구성해야 한다. 계획만 작성하고 멈추지 말고, 안전한 범위 안에서 구현·테스트·브라우저 검증까지 완료해라.

## 반드시 먼저 읽을 자료

1. C:\dev\massage-on-demand-vn\AGENTS.md
2. C:\dev\massage-on-demand-vn\docs\agent\HANDS_CODEX_WORKFLOW_GUARD.md
3. C:\dev\massage-on-demand-vn\output\partner-controls-audit-2026-08-06\partner-controls-operator-ux-data-audit.md
4. 같은 폴더의 01~27 PNG 스크린샷

보고서의 P0/P1 발견 사항과 완료 기준을 구현 요구사항으로 취급해라. 스크린샷은 참고 증거이며, 현재 실행 화면도 로그인된 브라우저에서 다시 확인해라.

## 작업 목표

운영자가 첫 화면에서 다음 질문에 즉시 답할 수 있어야 한다.

- 지금 가장 먼저 처리할 파트너는 누구인가?
- 정확히 무엇이 문제인가?
- 이 문제는 marketplace visibility, invitation, final acceptance, service start, payout, withdrawal 중 무엇을 막는가?
- 언제부터 대기했고 SLA를 넘었는가?
- 담당자와 다음 행동은 무엇인가?
- 표시된 전체 건수와 필터 결과를 신뢰할 수 있는가?

## 절대 조건

- 기존 사용자의 미커밋 변경이 많다. 이번 작업과 무관한 파일을 수정하거나 되돌리거나 포맷하지 마라.
- `git reset --hard`, `git checkout --`, 광범위한 삭제를 사용하지 마라.
- 새 UI 프레임워크, 새 테이블 라이브러리, 새 상태관리 라이브러리를 추가하지 마라.
- 기존 AdminSection, AdminFilterPanel, AdminDataTable, AdminPageTemplate, ActionMenu, ConfirmDialog, form control, badge, pagination 패턴을 먼저 찾아 재사용해라.
- 기존 `/admin/provider-reports`, `/admin/provider-sanctions` 호출자를 모두 검색한 뒤 API 응답을 변경해라. 다른 화면이 배열 응답을 기대한다면 기존 계약을 깨지 말고 `withTotal=true` 같은 opt-in 계약 또는 Partner Controls 전용 paged endpoint를 사용해라.
- UI에서 10건을 받아 놓고 전체 데이터인 것처럼 계산하거나 필터하지 마라.
- production/staging 데이터를 생성·수정·차단·해제하는 브라우저 행동은 검증 중 실행하지 마라. 테스트는 fixture/mock/test DB를 사용해라.
- 확인되지 않은 정책을 추측하지 마라. 저장소의 operations policy, booking authority, wallet/settlement, KYC/bank/tax 규칙을 먼저 추적해라.
- 단, 아래 두 규칙은 현재 보고서와 화면에서 확인된 기준으로 통일한다. 더 권위 있는 저장소 규칙과 충돌하면 즉시 충돌 위치를 보고하고, 임의로 넓은 차단을 만들지 마라.
  1. Negative wallet은 marketplace visibility 자체를 막지 않는다. final acceptance, service start, payout release를 막는다.
  2. Vietnam MVP의 optional tax profile은 Level 2 approval, matching, work, payout, wallet withdrawal을 막지 않는다.

## 구현 순서

### 0. 사전 조사

- 현재 `git status`를 기록하고 Partner Controls와 직접 관련된 파일만 작업 범위로 잡아라.
- 다음 흐름을 끝까지 추적해라.
  - admin_web page/search params/load plan
  - admin API route/service/Prisma query
  - reports, sanctions, provider risk rows의 모든 호출자
  - summary aggregate 정의
  - wallet/KYC/bank/tax/account-block 정책 정의
  - shared table, pagination, dialog/drawer/disclosure 패턴
- 현재 화면을 1440×900, 1024×900, 720×900에서 캡처하고 보고서의 문제를 재현해라.
- 짧은 실행 계획을 공유하되, 실제 정책 충돌이나 파괴적 변경 승인이 필요한 경우가 아니면 사용자 응답을 기다리지 말고 계속 구현해라.

### 1. 데이터 신뢰성부터 수정

#### 1-1. 실제 서버 페이지네이션

Reports와 Account controls에 실제 서버 페이지네이션을 구현해라.

필수 입력:

- `skip`
- `take`
- `q`
- report: `status`, `severity`, `sort`
- account control: `sanction/status`, `sort`

필수 출력:

- `items`
- `totalCount`

호환성 요구:

- 기존 API 호출자가 배열을 기대한다면 기본 응답은 유지하고 Partner Controls에서만 paged 응답을 opt-in으로 요청해라.
- `totalPages = Math.ceil(totalCount / take)`만 사용해라.
- 현재 페이지 row 수로 전체 건수와 다음 페이지를 추정하는 `partnerControlEstimatedTotalPages`, `partnerControlPagedListTotalRows` 계열 로직을 제거해라.
- page 3에서 `21–30 of 30`과 page 4 링크가 동시에 나오는 상태를 없애라.
- 범위를 벗어난 page query는 안전하게 마지막 페이지 또는 page 1로 정규화해라.

#### 1-2. 서버 검색과 필터

- `filterReports`, `filterSanctions`처럼 이미 10건으로 잘린 배열을 클라이언트/페이지 서버에서 다시 필터하지 마라.
- 검색·상태·심각도 필터는 Prisma query에 반영해라.
- 필터가 바뀌면 page는 1로 리셋해라.
- 빈 상태에는 확인한 전체 범위를 명시해라. 예: `347개 리포트 중 조건에 맞는 항목이 없습니다.`
- 11번째 이후에만 존재하는 데이터도 검색 결과에 나와야 한다.

#### 1-3. Partner risk queue

- `/admin/partner-controls/providers?take=10`의 최근 ID 10명 샘플을 운영 큐로 사용하지 마라.
- 위험도 기준의 서버 정렬, 검색, 필터, totalCount를 제공해라.
- 최소 우선순위는 account block, negative wallet, payout hold, urgent/major open report, overdue report, KYC/work gate, stale location 순으로 기존 정책을 확인해 구성해라.
- 상단 aggregate와 상세 큐가 같은 정의와 범위를 사용하게 해라.
- 일부 샘플만 보여 주는 경우 반드시 `전체 N명 중 상위 10명`으로 표기하고 전체 큐 링크를 제공해라.

#### 1-4. 리포트 생성 파트너 검색

- 최근 10명 `<select>`를 제거해라.
- 전체 허용 파트너를 서버 검색하는 기존 combobox/autocomplete 패턴을 찾아 재사용해라.
- 이름, 마스킹 전화번호, 짧은 Partner ID, 현재 상태로 동명이인을 구분해라.

### 2. 차단 정책을 하나의 기준으로 통일

코드에 여러 번 직접 작성된 차단 문구를 하나의 typed policy impact model 또는 기존 정책 helper에서 파생시켜라. 불필요한 추상화는 만들지 말고, 모든 호출자가 공유할 수 있는 최소 모델 하나만 사용해라.

필수 영향 축:

- Marketplace visibility
- Invitation/dispatch
- Final acceptance
- Service start
- Payout release/creation
- Wallet withdrawal

최소 blocker 종류:

- Negative wallet
- Account block
- Payout hold
- KYC/activity readiness
- Bank approval
- Stale/missing location
- Optional tax record

문구 수정:

- wallet debt의 `Booking blocked`를 `Acceptance & service start blocked`로 바꿔라.
- `before this partner accepts more bookings`, `cannot participate in marketplace bookings`처럼 전체 booking 참여를 막는 것처럼 보이는 문구를 제거해라.
- wallet 안내는 `Partner may remain visible. Final acceptance, service start, and payout release stay blocked until the debt is cleared.`라는 의미로 통일해라.
- tax 안내는 `Optional · no operating gate`의 의미로 통일하고 payout gated 문구를 제거해라.
- 화면마다 별도 문장을 만들지 말고 같은 policy result를 badge, detail, operator instruction에서 재사용해라.

정책 contract test를 추가해서 서로 다른 섹션에서 다시 모순될 수 없게 해라.

### 3. 운영 정보구조 단순화

#### 3-1. 항상 보이는 workspace navigation

- `Summary | Partner blockers | Reports | Account controls`를 페이지 상단의 명확한 탭/segmented navigation으로 제공해라.
- 현재 workspace와 filter/query 상태를 유지해라.
- `details=all`과 `Open workspaces`가 실제 workspace를 열지 않는 모순을 제거해라.
- 필요 없는 `details=all` 모드는 삭제하거나 기존 URL 호환을 위해 가장 적절한 workspace로 redirect/normalize해라.

#### 3-2. Summary

8개 KPI를 다음 네 개의 링크형 KPI로 축소해라.

- Urgent reports
- Active restrictions
- Debt gates
- Overdue

각 KPI에는 다음을 명시해라.

- 정확한 scope (`All partners` 또는 명시된 필터 범위)
- 갱신 시각
- 값에 따른 명시적인 tone/kind
- 클릭 시 해당 서버 필터가 적용된 큐

문자열 추론에 맡긴 `Current filters`, 값이 0인데도 보이는 `Needs action`을 없애라.

Location, device, onboarding 신호는 `Health signals` 보조 영역으로 이동하고 기본 우선순위 큐를 밀어내지 않게 해라.

#### 3-3. Partner blockers

현재 다섯 섹션을 하나의 운영 큐로 통합해라.

삭제/통합 대상:

- Partner control board
- Marketplace and payout unblock board
- Marketplace and payout unblock playbook
- Partner operating block matrix
- System control checklist

단일 행의 필수 정보:

- Priority
- Partner
- Blocking reason
- Actual impact
- Age/SLA
- Owner 또는 Unassigned
- Next action

Operator script, customer impact, policy explanation, evidence, linked reports는 행 상세 drawer/disclosure에 넣어라. 저장소에 기존 drawer 패턴이 있으면 재사용하고, 없으면 접근 가능한 기존 dialog/detail disclosure 패턴을 사용해라. 새 범용 drawer framework를 만들지 마라.

첫 1440×900 화면에 실제 우선순위 행이 최소 5개 보여야 한다.

#### 3-4. Reports

- 필터와 큐를 KPI보다 먼저 보이게 해라.
- 기본 행은 읽기 전용으로 만들고 primary action은 `Review report` 하나만 둬라.
- 행에 Report, Partner, Severity/Status, Owner, Age/SLA, Last update, Review를 표시해라.
- `Create partner report` 상시 폼을 제거하고 우측 상단 `New report` 버튼으로 열어라.
- category 자유 텍스트는 기존 도메인 정의를 확인해 controlled taxonomy로 바꿔라. 최소 Safety, Behavior, Identity, Payment, Service quality, Other를 검토해라.
- Booking ID 직접 입력보다 기존 booking search/link 패턴이 있으면 재사용해라.

#### 3-5. Account controls

- `Active`와 `History`를 분리해라.
- 기본은 Active다.
- Active가 0이면 해제 이력 10건을 대신 보여 주지 말고 명확한 정상 빈 상태를 보여 줘라.
- History에는 Lifted/Expired를 표시해라.
- 가능하면 issued by, lifted by, linked evidence/report, starts/expires/lifted, duration을 보여 줘라.

### 4. 위험한 변경 행동을 안전하게 수정

- Reports 표의 각 행에 상시 노출된 `Apply`와 `Update` 폼을 제거해라.
- 보고서 상태/심각도/resolution note 수정은 report review panel 안에서 수행해라.
- 계정 제한 적용은 별도 흐름으로 분리해라.

필수 account restriction 적용 단계:

1. restriction type 선택
2. 실제 영향 범위 미리보기
3. 최소 12자 이유
4. 관련 report/evidence
5. expiry 입력 또는 명시적인 no expiry
6. 대상 파트너와 행동을 포함한 최종 확인

- `ACCOUNT_BLOCK`, `PAYOUT_HOLD`는 일반 Warning과 시각·문구상 구분해라.
- 현재 lift confirmation 패턴은 유지하고, 해제 이유/evidence가 도메인상 필요하다면 추가해라.
- 저장 성공/실패를 해당 panel에서 명확히 알리고 실패 시 입력값을 보존해라.
- 접근 가능한 버튼 이름에 행동과 대상을 포함해라. 반복되는 `Apply`, `Update`, `Open`만 사용하지 마라.

### 5. 반응형과 개인정보

- `.partner-controls-page > .card` 전체에 적용된 max-height/overflow auto를 제거해라.
- 스크롤이 꼭 필요한 긴 큐 한 곳에만 명시적인 scroll container를 사용해라.
- section heading, filter, pagination은 내부 스크롤에 같이 잘리지 않게 해라.
- 1440px에서도 Partner와 primary action이 동시에 보여야 한다.
- 1199px 이하에서는 1180px desktop table을 억지로 유지하지 말고 핵심 필드 중심 row card 또는 기존 responsive table pattern을 사용해라.
- 1024×900과 720×900에서 가로 스크롤 없이 Partner와 primary action에 접근할 수 있어야 한다.
- 전화번호는 기본 마스킹하고 권한 있는 상세 화면에서만 전체 값을 보여 줘라.
- 숫자가 한 자리씩 줄바꿈되지 않게 해라.
- muted text와 badge 색 대비를 확인하고 상태를 색만으로 전달하지 마라.

### 6. Smoke/test 데이터

- 이름 prefix만으로 production 데이터를 삭제하지 마라.
- 테스트 데이터의 생성 경로와 환경을 추적해라.
- 명시적인 test/staging 속성이 이미 있으면 기본 운영 큐에서 제외하고 필터로 접근하게 해라.
- 그런 속성이 없다면 위험한 추정 필터를 만들지 말고, staging 환경 표시와 안전한 후속 migration 요구를 문서화해라.
- 현재 화면이 staging이면 상단에 명확한 `STAGING / TEST DATA` 표시를 추가할 기존 환경 배너 패턴이 있는지 먼저 찾아라.

## 권장 문구

- `Next operator actions` → `Priority queue`
- `1 action(s)` → `1 priority item`
- `0 action(s)` → `No priority items`
- `Open` → `Review debt`, `Review report`, `Review restriction`
- `Apply` → `Apply restriction`
- `Update` → `Save report changes`
- `Control filters` → `Filter this queue`
- `Active controls` → `Active account restrictions`
- `Booking blocked` for wallet debt → `Acceptance & service start blocked`
- `10 shown` → `10 of {totalCount}`

사용자 화면의 기존 언어가 영어이므로 이번 구현에서는 영문 UI copy를 일관되게 다듬고, 별도 국제화 시스템을 새로 만들지 마라.

## 테스트 요구사항

기존 테스트만 통과시키지 말고 다음 회귀 테스트를 추가해라.

### API/service/controller

- reports 25건에서 page 1/2/3이 서로 다른 id를 반환한다.
- totalCount가 모든 page에서 25로 고정된다.
- sanctions에도 같은 계약을 검증한다.
- q/status/severity/sanction/sort/skip/take가 Prisma query에 반영된다.
- 기존 배열 응답 호출자가 있다면 호환성이 유지된다.

### admin_web

- 필터 변경 시 page 1 URL을 만든다.
- totalRows/totalPages가 서버 totalCount를 사용한다.
- 11번째 이후 데이터도 검색 결과에 렌더링된다.
- wallet/tax 정책 문구 contract가 모든 surface에서 일치한다.
- Active account controls가 0일 때 History가 기본 목록에 섞이지 않는다.
- restriction 생성은 confirmation 없이는 실행되지 않는다.
- Partner Controls 구조 테스트를 단순 source-string 존재 검사에서 실제 동작 검증으로 강화한다.

### 브라우저 검증

로그인된 인앱 브라우저에서 다음 route/state를 검증하고 스크린샷을 저장해라.

- `/partner-controls`
- Partner blockers workspace
- Reports 기본/OPEN 빈 상태/2페이지/마지막 페이지
- Account controls Active/History
- 1440×900, 1024×900, 720×900

확인 항목:

- 첫 화면에 실제 queue row가 보인다.
- 동일 KPI와 queue 수치가 모순되지 않는다.
- 페이지 분모가 이동해도 고정된다.
- Partner와 primary action이 동시에 보인다.
- 내부 스크롤이 중첩되지 않는다.
- wallet/tax copy가 canonical policy와 일치한다.
- console error/warning이 없다.

## 최소 실행 검증

저장소의 실제 package script를 확인한 후 최소한 다음 범위를 실행해라.

- admin-web Partner Controls 관련 Vitest
- API admin service/controller의 partner-control/provider-report/provider-sanction 관련 Vitest
- 관련 TypeScript typecheck 또는 변경 파일을 포함하는 가장 좁은 typecheck
- 변경 파일 lint
- 브라우저 재현 검증

테스트가 기존 사용자 변경이나 이미 존재하던 실패 때문에 막히면, 실패 명령·첫 오류·이번 변경과의 관련성을 구분해서 보고해라. 테스트를 통과시키기 위해 무관한 파일을 수정하지 마라.

## 완료 조건

다음 조건을 모두 만족해야 완료다.

- 전체 집계와 상세 큐의 scope가 명시되고 모순되지 않는다.
- 실제 totalCount 기반 페이지네이션이 동작한다.
- 서버 전체 데이터에 검색/필터가 적용된다.
- 11번째 이후 파트너/리포트를 찾을 수 있다.
- wallet과 tax 정책 문구가 모든 화면에서 동일하다.
- 다섯 개 진단 섹션이 하나의 우선순위 큐 중심으로 정리된다.
- Reports의 상시 20개 mutation form이 사라진다.
- 제한 적용에 영향 미리보기와 확인이 있다.
- Account controls의 Active와 History가 분리된다.
- 1440/1024/720에서 primary action이 가로 스크롤 없이 보인다.
- 관련 테스트와 브라우저 검증을 완료한다.

## 최종 보고 형식

최종 답변에는 다음만 명확히 정리해라.

1. 운영자가 체감할 핵심 변화
2. 데이터/API 계약 변경과 호환 방식
3. 정책 문구의 최종 기준
4. 변경 파일 목록
5. 실행한 테스트/검증 명령과 결과
6. before/after 스크린샷 경로
7. 보존한 사용자 변경과 건드리지 않은 영역
8. 남은 위험 또는 실제로 확인하지 못한 항목

기능 일부만 구현했는데 전체 완료라고 말하지 마라. 완료 조건별로 완료/미완료를 표시해라.
```

---

## Codex에 추가로 줄 수 있는 한 줄

Codex가 계획만 작성하고 멈춘 경우 다음 문장을 이어서 보낸다.

```text
위 계획을 승인한다. 사용자 응답을 더 기다리지 말고 Phase 1 데이터 정확성부터 순서대로 구현하고, 각 단계의 테스트와 브라우저 검증까지 완료해라.
```

## 권장 실행 방식

- 한 번에 전부 구현하되, 내부적으로 `데이터 계약 → 정책 → UI → 안전한 행동 → 반응형` 순서를 지키게 한다.
- 첫 구현 후에는 새 작업에서 `/review`로 미커밋 변경을 검토하고, 특히 pagination, policy copy, account restriction 안전성을 다시 확인한다.
- 같은 유형의 관리자 페이지 개선을 계속 반복한다면 이 문서 전체를 `AGENTS.md`에 넣지 말고 별도의 관리자 UX 구현 기준 문서 또는 전용 skill로 관리한다.
