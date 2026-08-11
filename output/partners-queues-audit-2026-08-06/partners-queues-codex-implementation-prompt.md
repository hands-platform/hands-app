# 파트너 작업 큐 3종 개선 구현용 Codex 프롬프트

아래 프롬프트는 HANDS Admin의 `Approvals`, `Onboarding blockers`, `Wallet debt` 작업 큐를 실제로 수정하기 위한 실행 지시서다.

계획이나 추가 감사 보고서만 작성하지 말고, 안전하게 구현 가능한 항목은 코드 수정·테스트·동일 실행본 브라우저 검증까지 완료해야 한다.

이 문서는 한 번의 Codex 작업에 붙여 넣는 task prompt다. 저장소 전체에 영구 적용되는 `AGENTS.md`나 skill로 복사하지 마라.

---

당신은 `C:\dev\massage-on-demand-vn` 저장소의 선임 제품 엔지니어다. HANDS 관리자 웹의 다음 세 작업 큐를 실제 운영자가 빠르고 정확하게 사용할 수 있도록 개선하라.

```text
http://localhost:3101/partners?review=approval-pending&sort=oldest
http://localhost:3101/partners?review=unapproved
http://localhost:3101/partners?review=unsettled
```

## 1. 작업 목표

운영자가 각 화면에서 10초 안에 다음 질문에 답하고 바로 행동할 수 있어야 한다.

### Approvals

1. 지금 실제로 승인 결정을 기다리는 Partner는 누구인가?
2. 얼마나 기다렸고 SLA를 넘겼는가?
3. 무엇이 부족하거나 위험한가?
4. 누가 담당하며 어떤 결정을 내려야 하는가?

### Onboarding blockers

1. 어느 온보딩 단계에서 막혔는가?
2. 가장 중요한 blocker는 무엇인가?
3. 운영자 행동과 Partner 행동 중 무엇을 기다리는가?
4. 마지막 활동과 다음 후속 행동은 무엇인가?

### Wallet debt

1. 실제 canonical wallet balance가 음수인가?
2. 채무 금액과 발생 근거는 무엇인가?
3. 지급·출금·서비스 제한 상태는 무엇인가?
4. 다음 정산 행동은 무엇인가?

핵심 운영 계약은 다음과 같다.

```text
Correct queue population
→ Canonical amount and timestamp
→ Clear blocker or debt reason
→ One next action
→ Verifiable total and export
```

시각 장식부터 시작하지 마라. 잘못된 모집단과 금액을 더 보기 좋게 만드는 것은 실패다.

기존 HANDS Admin의 Public Sans, Vuexy 토큰, Lucide 아이콘, Admin page shell, filter, table, badge, pagination, empty/error pattern을 재사용하라. 새 디자인 시스템, 새 테이블 엔진, 새 filter DSL 또는 새 UI dependency를 추가하지 마라.

## 2. 반드시 먼저 읽을 자료

다음 순서로 읽고 현재 코드와 대조하라.

1. `C:\dev\massage-on-demand-vn\AGENTS.md`
2. `C:\dev\massage-on-demand-vn\docs\agent\HANDS_CODEX_WORKFLOW_GUARD.md`
3. 상세 감사 보고서:
   `C:\dev\massage-on-demand-vn\output\partners-queues-audit-2026-08-06\partners-queues-operator-ux-data-audit.md`
4. 감사 캡처 폴더:
   `C:\dev\massage-on-demand-vn\output\partners-queues-audit-2026-08-06`

다음 캡처 19장을 직접 열어 화면 기준으로 사용하라.

```text
01-approvals-empty-1440.png
02-unapproved-top-1440.png
03-unapproved-table-1440.png
04-unapproved-table-right-bottom-1440.png
05-unsettled-top-1440.png
06-unsettled-table-1440.png
07-unsettled-table-right-bottom-1440.png
08-unsettled-filtered-1440.png
09-unsettled-wallet-sort-mismatch-1440.png
10-unapproved-booking-sort-mismatch-1440.png
11-approvals-empty-1024.png
12-unapproved-top-1024.png
13-unapproved-table-1024.png
14-unsettled-table-1024.png
15-approvals-empty-720.png
16-unapproved-top-720.png
17-unapproved-table-720.png
18-unsettled-table-720.png
19-unsettled-table-right-720.png
```

감사 보고서의 P0/P1/P2, 코드 근거, 인수 조건과 감사 한계를 작업 기준으로 사용하라.

## 3. 시작 절차와 작업 트리 보호

작업 시작 시 다음을 수행하라.

1. `git status --short`
2. 관련 파일의 현재 diff 확인
3. 수정 후보 함수의 모든 caller와 관련 test를 `rg`로 추적
4. 기존 focused tests를 먼저 실행해 baseline 기록
5. Admin Web 3101 포트의 PID, command line, 시작 시각 확인
6. 현재 `apps/admin_web/.next/BUILD_ID`가 있으면 기록

현재 작업 트리는 매우 많이 수정돼 있다. 기존 변경은 사용자 소유다.

- `git reset`, `checkout`, `restore`, `clean`으로 기존 변경을 제거하지 마라.
- 관련 파일에 이미 수정이 있으면 전체 파일을 덮어쓰지 말고 현재 의도를 보존한 최소 diff를 작성하라.
- 다른 관리자 화면의 개선 사항을 되돌리지 마라.
- 사용자가 요청하지 않으면 commit하지 마라.
- 단일 에이전트로 작업하고 sub-agent를 사용하지 마라.
- 전체 저장소를 무작정 스캔하지 마라.
- 실제 승인, 반려, 계정 보류, wallet 조정, 지급, 출금, 정산 완료를 브라우저에서 제출하지 마라.
- 실제 개인정보 CSV를 다운로드하거나 출력하지 마라.
- schema, wallet authority, auth, payment, matching 같은 보호 영역 변경은 UI 정리와 섞지 마라.
- 보호 영역이 필요하다는 근거가 생기면 해당 slice만 `PROTECTED REVIEW NEEDED`로 분리하고, 안전한 나머지 작업은 계속하라.

## 4. 먼저 확인할 코드 범위

아래 파일부터 읽고 필요한 경우에만 인접 caller로 확장하라.

### Admin Web

```text
apps/admin_web/app/partners/page.tsx
apps/admin_web/app/partners/partner-review-mode.ts
apps/admin_web/app/partners/partner-primary-list-tabs.tsx
apps/admin_web/app/partners/partner-filter-board.tsx
apps/admin_web/app/partners/partner-filters.ts
apps/admin_web/app/partners/partner-list-query.ts
apps/admin_web/app/partners/partner-master-list-section.tsx
apps/admin_web/app/partners/partner-master-row.ts
apps/admin_web/app/partners/partner-activity-facts.ts
apps/admin_web/app/partners/partner-export-rows.ts
apps/admin_web/app/api/admin/partners/export/route.ts
apps/admin_web/lib/admin-navigation.ts
apps/admin_web/lib/admin-nav-match.ts
apps/admin_web/app/globals.css
```

### API

```text
apps/api/src/admin/admin.service.ts
apps/api/src/admin/admin.service.spec.ts
apps/api/src/admin/admin-provider-profile-selects.ts
```

관련 controller/DTO/route가 실제 query contract에 필요할 때만 추가로 읽어라. Prisma schema 또는 migration부터 시작하지 마라.

## 5. 변경하면 안 되는 기존 권위

- NestJS API가 Partner 운영 상태와 비즈니스 규칙의 권위다.
- negative wallet은 final acceptance, service start, payout release를 차단하지만 marketplace visibility 자체는 차단하지 않는다.
- 내부 legacy code는 Provider를 사용할 수 있지만 user-facing copy는 Partner를 사용한다.
- 기존 operator access/category guard와 감사 로그를 약화하지 않는다.
- Approvals 0건 empty state의 좋은 구조와 `View held / rejected`, directory 이동 경로는 보존한다.
- Partner detail, Partner Controls, Partner Performance, Finance 화면의 전문 기능을 이 목록에 복제하지 않는다.
- 검색, pagination, 읽기 전용 목록 기능을 회귀시키지 않는다.
- owner, debt since, last contact 같은 데이터가 없으면 화면에서 가짜 값을 만들지 않는다.

## 6. 필수 수용 기준

모든 구현과 최종 보고를 `PPQ-001~010`으로 추적하라.

### PPQ-001 — 전체 모집단과 정렬의 진실성

현재 실행 화면에서 확인된 치명적 문제:

```text
Onboarding blockers 기본: 148
Bookings 정렬 후:         25

Wallet debt 기본:         124
Wallet debt 정렬 후:       17
```

원인은 서버가 직접 처리하지 않는 정렬에서 `PARTNER_LOCAL_FILTER_HYDRATION_LIMIT = 25`만 가져온 뒤 Admin Web이 로컬 정렬/필터를 수행하기 때문이다.

완료 조건:

1. 화면에 노출되는 모든 sort/filter는 전체 필터 모집단에 적용된다.
2. rows, total, pagination, filter summary와 export가 같은 query contract를 사용한다.
3. 25명 부분집합을 전체 큐처럼 표시하는 operator-visible 경로가 없다.
4. 전체 Partner를 브라우저로 가져와 정렬하는 방식으로 바꾸지 않는다.
5. 운영상 불필요한 local-only 정렬은 제거한다.
6. 유지할 정렬은 API/DB가 전체 모집단 기준으로 처리해야 한다.
7. 지원하지 않는 query sort를 조용히 다른 정렬로 바꾸고 원래 label을 유지하지 않는다.
8. sort를 변경해도 필터된 total은 변하지 않는다.

최소 안전안:

- Approvals: canonical oldest submission
- Onboarding blockers: canonical oldest actionable 또는 서버가 보장하는 oldest/name
- Wallet debt: canonical largest/oldest debt를 서버에서 지원할 수 있을 때만 제공
- `Bookings`, `Completed`, `Revenue` 등 큐 목적과 무관한 정렬은 제거

필수 테스트:

- 25명을 초과하는 fixture
- 26번째 이후 레코드가 가장 큰 값인 경우
- sort 전후 total 불변
- table total, pagination total, summary total 일치
- unsupported sort의 안전한 canonical URL과 정확한 label

### PPQ-002 — canonical Wallet debt

현재 실행 화면에는 Wallet debt 큐인데도 다음 행이 반복된다.

```text
0 VND
No negative balance
```

현재 큐 포함 조건은 `WalletBalanceSummary.balance < 0`이지만 행 표시와 local sort는 `ProviderEarning`의 PENDING/AVAILABLE 합계로 만든 `activitySummary.walletBalance`를 사용한다.

완료 조건:

1. 큐 포함 조건, total, 행의 Debt, sort와 CSV가 동일한 canonical VND wallet balance를 사용한다.
2. 기존 `WalletBalanceSummary`를 우선 재사용한다.
3. directory select에 필요한 최소 wallet summary 필드만 추가한다.
4. `pendingPayout`, `availablePayout`과 wallet balance를 다른 개념과 label로 유지한다.
5. Wallet debt 큐의 모든 표시 행은 canonical balance `< 0`이다.
6. 0, 양수, summary 없음, VND가 아닌 통화는 명시적으로 처리한다.
7. 프런트에서 `balance >= 0` 행만 숨겨 서버 계약 불일치를 감추지 않는다.
8. 다른 목록에서 이미 사용하는 wallet summary override 패턴이 있으면 재사용한다.

필수 테스트:

- 음수, 0, 양수, summary 없음, 복수 통화
- queue total과 표시 금액 일치
- wallet-debt sort가 전체 모집단에서 정확함
- export 금액 일치
- 기존 negative-wallet 차단 정책 회귀 없음

`apps/api/src/provider-wallet/**`, schema 또는 migration 변경 없이 읽기 모델에서 해결 가능한지 먼저 확인하라. 보호 영역 변경이 정말 필요하면 해당 항목만 `PROTECTED REVIEW NEEDED`로 보고하라.

### PPQ-003 — 세 큐의 의미와 정보구조

1차 Partner 목록 구조를 다음 네 가지로 정리하라.

```text
Partner directory
Approvals
Onboarding blockers
Wallet debt
```

기존 route를 재사용한다.

```text
Partner directory:    /partners
Approvals:            /partners?review=approval-pending&sort=oldest
Onboarding blockers:  /partners?review=unapproved
Wallet debt:          /partners?review=unsettled
```

완료 조건:

1. Approvals route에서 sidebar, breadcrumb, 상단 탭과 H1이 모두 Approvals를 가리킨다.
2. user-facing `Unapproved Partners`를 `Onboarding blockers`로 변경한다.
3. user-facing `Unsettled Partners`를 `Wallet debt`로 변경한다.
4. `0 approvals`와 `148 onboarding blockers`가 모순처럼 보이지 않게 각 포함 기준을 설명한다.
5. 상단 탭, sidebar와 breadcrumb가 같은 primary mode resolver를 재사용한다.
6. 각 큐 설명은 포함 대상과 운영자의 다음 행동을 한 문단 안에서 말한다.
7. 기존 deep link와 route는 깨지지 않는다.

### PPQ-004 — 업무 이벤트 기준의 Waiting/Debt age

현재 age bucket과 승인 SLA는 `ProviderProfile.updatedAt`을 사용한다. 이 시각은 프로필의 일반 수정 시각이지 큐 진입 시각이 아니다.

큐별 기준:

```text
Approvals:
현재 활성 verification/KYC 제출의 submittedAt

Onboarding blockers:
현재 blocker 시작 또는 보완 요청 시각

Wallet debt:
잔액이 처음 음수가 된 ledger/debt event 시각
```

완료 조건:

1. Approvals의 row age, bucket, oldest sort와 SLA가 동일한 submission timestamp를 사용한다.
2. profile의 unrelated update가 승인 순서나 SLA를 바꾸지 않는다.
3. verification과 KYC가 동시에 pending이면 명확한 하나의 규칙을 정하고 테스트로 고정한다.
4. Onboarding/Wallet의 canonical event timestamp가 현재 데이터 모델에 없으면 `ProviderProfile.updatedAt`을 계속 `Queue age`로 표시하지 않는다.
5. 정확한 시각이 없으면 해당 control/label을 제거하고 missing contract를 최종 위험으로 보고한다.
6. 화면에서 임의로 debt age 또는 blocker age를 추정하지 않는다.

### PPQ-005 — 큐별 필터·정렬·초기화

현재 세 큐가 `State / App activity / Verification / KYC`, 8개 공용 정렬과 일반 `Queue age`를 거의 그대로 공유한다.

큐별 기본 필터:

```text
Approvals:
Waiting age / Missing evidence / Risk / Owner(실제 데이터가 있을 때)

Onboarding blockers:
Stage / Exact blocker / Waiting for / Last Partner activity / Owner(실제 데이터가 있을 때)

Wallet debt:
Debt amount / Debt age(정확할 때) / Settlement status / Payout or withdrawal hold / Owner(실제 데이터가 있을 때)
```

완료 조건:

1. 큐 목적과 무관한 필터·정렬을 기본 화면에서 제거한다.
2. 하나의 sort control과 하나의 active state만 보인다.
3. `Checklist`와 `Newest first`가 동시에 선택된 것처럼 보이지 않는다.
4. `Clear filters`는 현재 queue mode를 보존한다.
5. secondary query를 붙여도 active tab/nav/breadcrumb가 유지된다.
6. native form submit 후 빈/default query parameter가 남지 않는다.
7. 현재 구현 helper로 해결하고 새 filter framework를 만들지 않는다.
8. filter 적용 0건에서도 현재 filter를 수정하거나 reset할 수 있다.

필수 테스트:

- 각 queue clear href
- secondary query와 query order 변경
- page 이동 후 active mode
- canonical URL에 불필요한 빈/default parameter 없음
- filtered empty에서 현재 mode와 filter context 유지

### PPQ-006 — 행동 중심의 큐별 표

각 표는 데스크톱 기준 6개 이하 핵심 열을 목표로 한다.

#### Approvals

| 열 | 내용 |
|---|---|
| Partner | 표시명, ID, 필요한 최소 식별 정보 |
| Waiting | canonical submitted time, age, SLA |
| Review state | Verification/KYC 제출 상태 |
| Top issues | missing/risk 상위 2개와 `+N` |
| Owner | 실제 owner가 있을 때, 없으면 Unassigned의 근거 필요 |
| Action | `Review submission` |

#### Onboarding blockers

| 열 | 내용 |
|---|---|
| Partner | 이름, ID, 연락 가능 상태 |
| Stage | Registration / Verification / KYC / Documents / Hold |
| Top blockers | 정확한 blocker 1~2개와 `+N` |
| Waiting/Activity | 정확한 blocker age 또는 마지막 Partner 활동 |
| Owner | 실제 데이터가 있을 때 |
| Action | `Review blockers`, `Request correction` 또는 `Open profile` |

#### Wallet debt

| 열 | 내용 |
|---|---|
| Partner | 이름, ID, 연락 가능 상태 |
| Debt | canonical VND balance |
| Debt since/Cause | 실제 ledger 근거가 있을 때만 |
| Settlement | payout/withdrawal hold와 실제 settlement 상태 |
| Owner | 실제 데이터가 있을 때 |
| Action | `Review wallet debt` 또는 기존 settlement 화면 진입 |

완료 조건:

1. Onboarding에서 `Gender`를 제거한다.
2. `7 approval needs` 같은 개수만 표시하지 말고 상위 원인을 보여준다.
3. Wallet debt에서 중복 `Revenue`, `Payout`, approval needs를 제거한다.
4. `Wallet` 셀 안에서 wallet balance와 payout을 섞지 않는다.
5. 모든 행에 현재 큐 목적에 맞는 명시적 CTA가 있다.
6. `Not saved · legal name`처럼 라벨 없는 조합을 제거한다.
7. owner, cause, debt since가 없으면 가짜 값을 만들거나 unrelated timestamp로 대체하지 않는다.
8. 전문 처리 기능은 상세/정산 화면으로 연결하고 목록에 복제하지 않는다.

### PPQ-007 — 반응형·스크롤·접근성

현재 문제:

- `.partners-page > .card`의 viewport 기반 max-height/세로 overflow
- `.vuexy-partner-table`의 `min-width: 1440px`
- Partner 첫 열이 sticky가 아님
- 1024/720에서 파트너 신원과 오른쪽 업무 정보를 동시에 볼 수 없음
- 720 Wallet debt 오른쪽에서 금액 음수 부호/앞자리가 잘릴 수 있음

완료 조건:

1. 페이지는 기본적으로 하나의 세로 스크롤 흐름을 사용한다.
2. 제목, filter와 table card의 중첩 세로 스크롤을 제거한다.
3. 1440, 1280, 1024 CSS px에서 핵심 큐 문맥과 CTA가 보인다.
4. 720 CSS px 또는 200% 확대에서 Partner, 핵심 상태/금액과 CTA를 함께 볼 수 있다.
5. 720에서는 억지로 1440px 표를 유지하지 말고 기존 primitive를 사용한 compact/card row 전환을 우선 검토한다.
6. 가로 스크롤이 불가피하면 Partner와 금액 문맥을 잃지 않으며 음수 부호가 클리핑되지 않는다.
7. 중요한 열을 단순 `display:none`으로 숨겨 업무 정보를 제거하지 않는다.
8. filter, tab, table region, pagination과 CTA에 접근 가능한 이름이 있다.
9. keyboard focus 순서와 focus-visible이 명확하다.
10. 색상 없이도 approval, blocked, debt, overdue를 이해할 수 있다.
11. 200% 확대에서 핵심 업무 수행에 양방향 스크롤이 필요하지 않다.

새 table dependency를 추가하지 말고 기존 `AdminDataTable`, `AdminTableScroll`, card, badge, pagination을 재사용하라.

### PPQ-008 — Empty, Error, Freshness 상태

Approvals 0건 empty state의 좋은 구조는 유지하되 다음 계약을 추가하라.

완료 조건:

1. 실제 0건과 API/list/summary 실패를 구분한다.
2. fallback `{ totalCount: 0 }`이 성공한 `0 awaiting decision`으로 보이지 않는다.
3. error state는 실패 범위와 retry 행동을 제공한다.
4. existing 공용 alert/error pattern과 `role="alert"`를 우선 재사용한다.
5. true empty에는 `Last checked`와 `Refresh`를 제공한다.
6. filtered empty에는 현재 filter summary, `Change filters`, `Reset filters`를 제공한다.
7. Approvals true empty의 `View held / rejected`, `Open partner directory`는 보존한다.
8. 새로고침으로 실제 mutation이 일어나지 않는다.

검증 상태:

```text
Approvals true empty
Approvals filtered empty
Onboarding no results
Wallet debt no results
List unavailable
Summary unavailable 또는 partial failure
Retry success/failure
```

### PPQ-009 — Export 범위와 데이터 provenance

현재 `Export`는 범위가 모호하며 화면과 같은 pagination/hydration 경로를 사용한다.

완료 조건:

1. export 범위를 버튼 문구에 정확히 표시한다.
2. 가장 작은 안전안이 current page라면 `Export current page (10)`으로 명시한다.
3. filtered full queue를 구현한다면 서버에서 누락 없이 생성하고 total과 rows를 검증한다.
4. 25명 local hydration을 full export처럼 내보내지 않는다.
5. export filter, sort, scope, row count와 generatedAt을 안전한 metadata로 남긴다.
6. 기존 access/category guard와 CSV formula-injection 방어를 유지한다.
7. 실제 개인정보 CSV를 브라우저에서 다운로드하지 않는다.

운영 데이터 분리:

1. `Smoke`, `Audit`, 숫자형 이름 패턴으로 행을 숨기지 않는다.
2. 기존 `adminProviderProductionDataWhere()` 또는 provenance helper의 의미와 caller를 먼저 확인한다.
3. 신뢰 가능한 기존 provenance가 있으면 queue, total과 export에 동일하게 적용한다.
4. provenance가 없어 schema 변경이 필요하면 임시 휴리스틱을 만들지 말고 `PROTECTED REVIEW NEEDED`로 보고한다.

### PPQ-010 — 운영 문구와 최종 검증

최소 문구 목표:

| 현재 | 변경 목표 |
|---|---|
| Partners | Partner directory |
| Unapproved Partners | Onboarding blockers |
| Unsettled Partners | Wallet debt |
| Partner operations filters | 큐별 `Approval filters`, `Onboarding filters`, `Wallet debt filters` |
| Ready now / Records sort | Sort by |
| Checklist | 실제로 보장되는 Operational priority 또는 제거 |
| Queue age | Waiting age / Debt age — canonical timestamp가 있을 때만 |
| 148 approval candidates | 148 partners with onboarding blockers |
| 124 settlement matchs | 124 partners with wallet debt |
| 7 approval needs | `KYC missing · ID rejected · +5` 형태 |
| Not saved · An Pham | 라벨이 있는 legal name/gender 문구 |
| Export | 범위와 건수가 포함된 label |
| Clear filters | 현재 큐를 유지하는 reset label |

추가 완료 조건:

1. 개발 구현 용어보다 운영자가 결정에 필요한 단어를 사용한다.
2. 단수/복수 문법이 정확하다.
3. 첫 1440×900 viewport에서 필터만 보이지 않고 실제 큐 상태 또는 첫 행이 보인다.
4. browser console error/warning이 없다.
5. 기존 좋은 Vuexy/Admin visual identity를 유지한다.
6. 과도한 카드, 그라디언트, 장식, animation을 추가하지 않는다.

## 7. 구현 순서

다음 순서를 지켜라.

### Phase 0 — Baseline과 보호

1. status와 관련 diff 확인
2. 관련 caller/test 추적
3. focused test baseline 실행
4. current build/PID 기록
5. 감사 화면과 현재 화면이 같은 상태인지 확인

### Phase 1 — 데이터 신뢰성

1. PPQ-001 전체 모집단과 정렬
2. PPQ-002 canonical wallet balance
3. PPQ-004 canonical queue timestamp
4. PPQ-009 export population/provenance
5. rows/summary/pagination/export parity 테스트

각 root cause를 하나의 거대한 Admin service 리팩터링으로 섞지 마라. 기존 가장 높은 공통 helper/read model에서 최소 수정하라.

### Phase 2 — 정보구조와 큐 상태

1. PPQ-003 4개 primary mode
2. PPQ-005 queue-specific filter/sort/clear
3. PPQ-008 empty/error/freshness
4. sidebar/breadcrumb/tab resolver 통일

### Phase 3 — 표와 반응형

1. PPQ-006 queue별 6개 이하 열과 명시적 CTA
2. PPQ-007 중첩 스크롤 제거
3. 1440px table min-width 의존 제거
4. 1440/1280/1024/720 reflow
5. PPQ-010 문구와 정보 밀도

### Phase 4 — 최종 검증

1. focused tests
2. Admin/API typecheck와 build
3. 변경 범위에 맞는 scope verification
4. 동일 build ID 브라우저 검증
5. keyboard/focus/reflow/console 검사
6. before/after 캡처와 PPQ 판정표 작성

실제 외부 차단이 없다면 Phase 1 계획만 제출하고 멈추지 말고 전체 안전 범위를 구현하라. schema, 새로운 wallet authority, provenance 또는 권한 모델 결정이 필요한 항목만 근거와 함께 분리하라.

## 8. 관련 테스트와 명령

기존 baseline:

```text
Admin Web: 11 files, 135 tests passed
API:       17 partner-directory tests passed, 519 skipped
```

가장 작은 관련 테스트부터 실행하라.

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- app/partners/page.spec.tsx app/partners/partner-filters.spec.ts app/partners/partner-filter-board.spec.tsx app/partners/partner-master-list-section.spec.tsx app/partners/partner-master-row.spec.ts app/partners/partner-list-query.spec.ts app/partners/partner-primary-list-tabs.spec.tsx app/partners/partner-review-mode.spec.ts lib/admin-nav-match.spec.ts app/api/admin/partners/export/route.spec.ts app/partners/partner-export-rows.spec.ts
```

API query/read model 변경 후:

```powershell
npm.cmd run test --workspace @massage-vn/api -- src/admin/admin.service.spec.ts -t "partner directory"
```

완결된 Admin Web slice 후:

```powershell
npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run build --workspace @massage-vn/admin-web
npm.cmd run verify:scope -- -Scope admin
```

API 변경 후:

```powershell
npm.cmd run typecheck --workspace @massage-vn/api
npm.cmd run build --workspace @massage-vn/api
npm.cmd run verify:scope -- -Scope api
```

실제 변경 범위와 위험에 맞춰 실행하라. 작은 slice마다 full build를 반복하지 말고 focused tests를 먼저 사용한다. 실행하지 못한 명령은 `SKIPPED`와 이유를 보고한다.

현재 잘못된 25명 local sort나 `0 VND` Wallet debt를 허용하는 테스트가 있으면 “기존 테스트 보존”을 이유로 잘못된 동작을 유지하지 마라. 올바른 계약으로 테스트를 수정하고 기존 테스트 공백을 설명하라.

추가해야 할 핵심 회귀 테스트:

1. 30명 이상 fixture의 sort total 보존
2. 26번째 이후 최고값 레코드가 첫 페이지로 올라오는 전역 정렬
3. canonical wallet summary와 earning 합계가 다른 경우
4. Wallet debt의 모든 표시값 `< 0`
5. secondary query를 붙인 nav/tab/breadcrumb 활성 상태
6. queue별 clear filter href
7. profile updatedAt과 submission timestamp가 다른 approval 순서/SLA
8. API failure와 true empty 분리
9. export scope/row count/total 일치
10. 720px에서 Partner/금액/CTA 문맥 유지

## 9. 브라우저 검증

1. 사용자가 로그인해 둔 in-app browser를 재사용한다.
2. 다른 브라우저나 새 비로그인 세션을 사용하지 않는다.
3. build 후 `.next/BUILD_ID`와 실행 중 3101 앱이 같은 build인지 확인한다.
4. 재시작이 필요하면 3101 포트의 정확한 Admin Web PID와 command line을 확인한 뒤 해당 프로세스만 대상으로 한다.
5. 다른 프로젝트나 사용자 프로세스를 종료하지 않는다.
6. before/after는 같은 viewport, route, query와 가능한 한 같은 데이터 상태로 비교한다.
7. screenshot만 확인하지 말고 DOM text, accessible name, href, active mode, total, scrollWidth/clientWidth와 focus 순서를 확인한다.
8. 실제 mutation과 실제 PII export는 수행하지 않는다.

after 캡처는 원본 감사 폴더를 덮어쓰지 말고 다음 폴더에 저장한다.

```text
output/partners-queues-improvement-verification-2026-08-06/
```

최소 캡처:

```text
01-approvals-empty-1440.png
02-onboarding-blockers-top-1440.png
03-onboarding-blockers-table-1440.png
04-wallet-debt-top-1440.png
05-wallet-debt-table-1440.png
06-onboarding-sort-total-proof-1440.png
07-wallet-debt-sort-total-proof-1440.png
08-wallet-debt-filtered-1440.png
09-approvals-1024.png
10-onboarding-blockers-1024.png
11-wallet-debt-1024.png
12-approvals-720.png
13-onboarding-blockers-720.png
14-wallet-debt-720.png
15-api-error-1440.png
```

안전한 live row가 없어 특정 상태를 검증할 수 없으면 운영 DB에 fixture를 추가하지 말고 `NOT VERIFIED — no safe live row`로 보고한다. 데이터 계약은 test fixture로 검증하라.

브라우저에서 확인할 상태:

```text
Approvals true empty 또는 실제 row
Approvals filtered empty
Onboarding blockers default
Onboarding blockers filtered
Wallet debt default
Wallet debt filtered
supported sort 전후 total
search no results
API/list unavailable
summary unavailable/partial
1440 / 1280 / 1024 / 720
keyboard-only traversal
console error/warning
```

UI 수정이 끝난 뒤 Impeccable detector가 사용 가능하면 변경된 UI 파일에 한 번만 실행하라.

```powershell
node C:\Users\laboy\.codex\skills\impeccable\scripts\detect.mjs --json <changed-ui-targets>
```

탐지 결과를 맹목적으로 따르지 말고 이 운영 화면의 정확성·접근성·기존 디자인 권위에 맞는 항목만 수정한다.

## 10. 완료 판정표

최종 응답 전에 다음을 각각 `PASS / FAIL / NOT VERIFIED / PROTECTED REVIEW NEEDED`로 판정하라.

| ID | 완료 기준 |
|---|---|
| PPQ-001 | sort/filter/rows/total/pagination이 전체 모집단에서 일치 |
| PPQ-002 | Wallet debt 포함·표시·sort·CSV가 같은 canonical balance 사용 |
| PPQ-003 | Directory/Approvals/Onboarding blockers/Wallet debt 의미와 active state 일치 |
| PPQ-004 | queue age/SLA가 실제 업무 event timestamp 사용 또는 잘못된 age 제거 |
| PPQ-005 | 큐별 filter/sort, clear mode 보존, canonical URL |
| PPQ-006 | 6개 이하 핵심 열, 정확한 blocker/debt와 명시적 CTA |
| PPQ-007 | 하나의 세로 흐름, 1024/720에서 신원·상태·행동 유지 |
| PPQ-008 | true empty, filtered empty와 API error/partial 상태 분리 |
| PPQ-009 | export 범위·행 수 정확, provenance 휴리스틱 없음 |
| PPQ-010 | 운영 문구·접근성·동일 build 브라우저 검증 완료 |

하나라도 `FAIL`이면 완료했다고 말하지 마라. 같은 범위에서 안전하게 수정 가능하면 계속 고친다. 실제 schema/권한/비즈니스 결정이 필요한 경우에만 정확한 blocker와 최소 선택지를 보고한다.

## 11. 하지 말아야 할 구현

- 25명 local sort를 유지하고 label만 바꾸기
- 0 VND 행을 프런트에서 숨기기
- 전체 Partner를 브라우저로 불러와 정렬하기
- Smoke/Audit/번호형 이름 패턴으로 test 데이터를 제거하기
- ProviderProfile.updatedAt을 approval/debt timestamp처럼 계속 사용하기
- Approvals를 `Partners` 탭 활성 상태로 두기
- 모든 queue에 같은 filter/sort를 계속 노출하기
- 모든 열을 유지한 채 sticky column만 추가하기
- 좁은 화면에서 중요한 열을 무조건 `display:none` 처리하기
- 가짜 owner, debt age, blocker age, last contact 만들기
- API failure를 정상 empty state로 fallback하기
- current page export를 full queue처럼 표현하기
- 새 table/filter/export framework 만들기
- 새 UI dependency 추가하기
- `globals.css` 전체 재작성
- Admin service 전체 리팩터링
- protected wallet/schema/auth 변경을 UI cleanup과 섞기
- 사용자 dirty change 되돌리기
- 실제 승인/정산 mutation으로 테스트하기

## 12. 최종 보고 형식

최종 응답은 파일 목록보다 운영 결과를 먼저 설명하고 다음 순서를 따른다.

1. 운영자가 더 빠르고 안전하게 처리할 수 있게 된 결과
2. PPQ-001~010 판정표
3. 데이터 계약 변경
   - 전체 모집단
   - canonical wallet balance
   - canonical queue timestamp
   - export/provenance
4. 정보구조, 필터, 표와 문구 변경
5. 변경 파일과 각 파일의 역할
6. 실행한 명령과 `PASS / FAIL / SKIPPED`
7. build ID와 브라우저 before/after 증거 경로
8. 1440/1280/1024/720 결과
9. empty/error/partial, keyboard/focus와 console 결과
10. 보호 영역, schema migration와 새 dependency 변경 여부
11. 기존 사용자 변경 보존 여부
12. 남은 위험과 다음 단 하나의 작업
13. commit을 만들었다면 hash, 아니면 `Not committed`

완료하지 않은 사항을 완료한 것처럼 표현하지 마라. 계획이나 추가 제안서만 제출하지 말고, 안전한 범위의 실제 구현·focused tests·build·동일 build 실행본 검증까지 수행하라.

지금 `git status --short`, 필수 문서 읽기, 관련 caller 추적과 baseline focused tests부터 시작한 뒤 PPQ-001과 PPQ-002의 데이터 신뢰성 문제를 먼저 해결하라.

---

## 사용 방법

1. Codex에서 `C:\dev\massage-on-demand-vn`을 작업 폴더로 연다.
2. 이 파일에서 `당신은 C:\dev...`부터 마지막 실행 지시까지 붙여 넣는다.
3. 현재 로그인된 in-app browser 세션과 3101 Admin Web을 유지한다.
4. Codex가 schema, provenance, 권한 또는 새로운 wallet authority 변경 필요성을 코드로 증명한 경우에만 해당 결정을 검토한다.
5. Codex가 계획이나 Phase 1 일부만 제출하고 안전한 미완료 작업을 남기면 다음 문장으로 계속 지시한다.

```text
PPQ-001~010에서 안전하게 진행 가능한 미완료 항목을 계속 구현해. 추가 계획이나 감사 보고서로 끝내지 말고 focused tests, build, 같은 BUILD_ID의 브라우저 before/after 검증까지 완료해. 실제 schema·권한·wallet authority 결정이 필요한 항목만 PROTECTED REVIEW NEEDED로 분리해.
```
