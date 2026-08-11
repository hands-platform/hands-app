# Partners 운영 개선 구현용 Codex 프롬프트

아래 지시를 계획이나 추가 감사 보고서로 끝내지 말고, 실제 코드 수정·테스트·실행본 브라우저 검증까지 완료하라.

이 문서는 한 번의 구현 작업에 붙여 넣는 task prompt다. 저장소 전체에 영구 적용되는 `AGENTS.md`나 skill로 복사하지 마라.

---

당신은 `C:\dev\massage-on-demand-vn` 저장소의 선임 제품 엔지니어다. HANDS 관리자 웹의 다음 화면을 실제 파트너 운영자 관점으로 개선하라.

```text
http://localhost:3101/partners
```

## 1. 최종 결과

운영자가 이 화면에서 10초 안에 다음 질문에 정확히 답하고 다음 행동으로 이동할 수 있어야 한다.

1. 찾는 Partner가 누구인가?
2. 지금 일을 받을 수 있는가?
3. 받을 수 없다면 가장 중요한 blocker는 무엇인가?
4. 지금 승인, 온보딩 보완, 지갑 부채 처리 중 어떤 작업이 필요한가?
5. 얼마나 기다렸고 누가 처리해야 하는가?
6. 목록의 total, 정렬, 잔액과 export를 믿을 수 있는가?

핵심은 시각 장식이 아니라 다음 운영 계약이다.

```text
Correct scope → Clear state → One blocker → One next action → Verifiable evidence
```

현재 화면을 전면 재작성하거나 새 디자인 시스템을 만들지 마라. 기존 HANDS Admin 컴포넌트, Public Sans, Vuexy 토큰, Lucide 아이콘, 필터·표·페이지네이션 패턴을 재사용하라.

먼저 짧은 실행 계획을 세운 뒤 즉시 구현을 계속하라. 코드·테스트·실행 화면에서 확인 가능한 질문을 사용자에게 되묻지 마라. 보호 영역 변경이나 실제 제품 결정이 필요한 slice만 명확한 증거와 함께 중단하고, 나머지 안전한 slice는 계속 완료하라.

## 2. 반드시 읽을 근거

다음 순서로 전체 내용을 읽고 실제 코드와 대조하라.

1. `C:\dev\massage-on-demand-vn\AGENTS.md`
2. `C:\dev\massage-on-demand-vn\docs\agent\HANDS_CODEX_WORKFLOW_GUARD.md`
3. 감사 보고서:
   `C:\dev\massage-on-demand-vn\output\partners-audit-2026-08-06\partners-operator-ux-data-audit.md`
4. 감사 캡처 폴더:
   `C:\dev\massage-on-demand-vn\output\partners-audit-2026-08-06`

보고서의 P0/P1/P2, 구현 순서, 수용 기준, 하지 말아야 할 수정을 모두 작업 기준으로 사용하라.

현재 화면 증거로 다음 19장을 직접 열어 확인하라.

```text
01-default-top.png
02-queue-and-table-top.png
03-default-table.png
04-default-table-rows.png
05-unapproved-top.png
07-unapproved-table-rows.png
08-unsettled-top.png
09-unsettled-table.png
10-filtered-unsettled-top.png
11-empty-state.png
12-approval-pending-empty.png
13-1024-top.png
14-1024-table.png
15-720-top.png
16-720-sort-age.png
18-720-table-right.png
19-1440-top.png
20-1440-table.png
22-bookings-sort-total-vs-table.png
```

`06`, `17`, `21`은 더 좋은 증거와 중복되는 캡처이므로 구현 판단의 기준으로 사용할 필요가 없다.

## 3. 시작할 때 확인할 코드 범위

먼저 아래 파일을 읽고, 수정할 함수의 모든 caller와 관련 test를 `rg`로 추적하라. 이 목록 밖으로 무작정 전체 저장소를 스캔하지 마라.

### Admin Web

```text
apps/admin_web/app/partners/page.tsx
apps/admin_web/app/partners/partner-filters.ts
apps/admin_web/app/partners/partner-filter-board.tsx
apps/admin_web/app/partners/partner-list-query.ts
apps/admin_web/app/partners/partner-master-list-section.tsx
apps/admin_web/app/partners/partner-master-row.ts
apps/admin_web/app/partners/partner-primary-list-tabs.tsx
apps/admin_web/app/partners/partner-review-mode.ts
apps/admin_web/app/partners/partner-activity-facts.ts
apps/admin_web/app/partners/partner-export-rows.ts
apps/admin_web/app/api/admin/partners/export/route.ts
apps/admin_web/components/admin-data-table.tsx
apps/admin_web/components/admin-queue-age-sort-controls.tsx
apps/admin_web/lib/admin-navigation.ts
apps/admin_web/lib/admin-nav-match.ts
apps/admin_web/lib/admin-operator-access-model.ts
apps/admin_web/app/globals.css
```

### API

```text
apps/api/src/admin/admin.service.ts
apps/api/src/admin/admin.service.spec.ts
apps/api/src/admin/admin-provider-selects.ts
apps/api/src/admin/admin.dto.ts
apps/api/src/admin/admin.controller.ts
```

필요한 경우에만 Prisma schema와 기존 production-data helper를 읽어라. schema migration부터 만들지 마라.

### 관련 테스트

```text
apps/admin_web/app/partners/page.spec.tsx
apps/admin_web/app/partners/partner-filters.spec.ts
apps/admin_web/app/partners/partner-filter-board.spec.tsx
apps/admin_web/app/partners/partner-master-list-section.spec.tsx
apps/admin_web/app/partners/partner-master-row.spec.ts
apps/admin_web/app/partners/partner-list-query.spec.ts
apps/admin_web/app/partners/partner-primary-list-tabs.spec.tsx
apps/admin_web/app/partners/partner-review-mode.spec.ts
apps/admin_web/app/partners/partner-export-rows.spec.ts
apps/admin_web/app/api/admin/partners/export/route.spec.ts
apps/admin_web/lib/admin-nav-match.spec.ts
```

## 4. 작업 트리와 안전 규칙

작업 시작 시 다음을 수행한다.

1. `git status --short`
2. 관련 파일의 현재 diff 확인
3. Admin Web 3101 포트의 PID, command line, 시작 시각 확인
4. 현재 `.next/BUILD_ID` 기록

현재 작업 트리는 매우 많이 수정되어 있다. 기존 변경은 사용자 소유다.

- reset, checkout, restore, clean으로 기존 변경을 제거하지 마라.
- 관련 파일에 사용자 수정이 있으면 내용을 보존한 채 최소 diff로 작업하라.
- 다른 관리자 페이지의 개선 사항을 되돌리지 마라.
- 사용자가 요청하지 않으면 commit하지 마라.
- 단일 에이전트로 작업하고 sub-agent를 사용하지 마라.
- 새 UI/테이블 라이브러리나 새 런타임 의존성을 추가하지 마라.
- `globals.css` 전체 재작성이나 파트너 영역 전면 리팩터링을 하지 마라.
- 새로운 범용 repository, query framework, filter DSL, table engine을 만들지 마라.
- 기존 helper에서 한 번 고칠 수 있는 문제를 화면별 예외로 반복하지 마라.
- 실제 승인, 반려, 지갑 변경, 지급, 출금, 계정 차단을 브라우저에서 제출하지 마라.
- 실제 CSV의 개인정보를 다운로드하거나 출력하지 마라. export는 fixture 기반 test와 response header/shape로 검증하라.
- 보안, 개인정보, 접근성, 금전 데이터 검증은 단순화를 이유로 생략하지 마라.

기존 `impeccable` skill이 있으면 운영자 정보 위계와 문구·인지부하 검토에 사용하고, 실제 로그인 화면은 사용자가 열어 둔 in-app browser와 `product-design:audit` 방식으로 before/after를 검증하라. 해당 skill이 없더라도 코드·DOM·동일 viewport 캡처 검증을 생략하지 마라.

## 5. 변경하면 안 되는 기존 권위

- NestJS API가 파트너 운영 상태와 비즈니스 규칙의 권위다.
- 음수 wallet은 final acceptance, service start, payout release를 차단하지만 marketplace visibility 자체를 차단하지 않는다.
- 내부 legacy code는 Provider를 사용할 수 있지만 user-facing copy는 Partner를 사용한다.
- 기존 role/category route guard와 감사 로그를 약화하지 않는다.
- approval 0건 empty state의 좋은 구조와 대체 이동 경로를 보존한다.
- Partner 상세, Partner Controls, Partner Performance, finance specialist 화면의 책임을 디렉터리로 복제하지 않는다.
- 기존 검색, 페이지네이션, 읽기 전용 목록 기능을 회귀시키지 않는다.

## 6. 필수 수용 기준 ID

모든 구현과 최종 보고는 `PRT-001~010`으로 추적하라.

### PRT-001 — 목록·총계·정렬의 전체 모집단 계약

현재 치명적 문제:

```text
Partner total: 1378
local hydration limit: 25
Bookings sort table total: 25
```

`booking-count`, `completed-count`, `gross-revenue`, `wallet-debt` 등 일부 정렬은 25명만 불러와 브라우저에서 정렬하면서 전체 1,378명의 순위처럼 보인다.

완료 조건:

1. 화면에 노출되는 모든 sort/filter는 전체 필터 모집단에 적용된다.
2. 목록 rows, total, pagination, filter summary와 export가 같은 filter/sort contract를 사용한다.
3. `PARTNER_LOCAL_FILTER_HYDRATION_LIMIT = 25` 기반 결과를 전체 결과처럼 표시하는 경로가 없다.
4. 클라이언트가 전체 파트너를 가져와 정렬하는 방식으로 바꾸지 않는다.
5. 지원되지 않는 정렬은 서버 전체 정렬을 구현하기 전까지 UI에서 제거한다.
6. 운영상 꼭 필요한 정렬만 남긴다. 최소 안전안은 `Newest`, `Oldest`, `Name`처럼 이미 서버 전체 범위가 보장되는 정렬이다.
7. `Bookings`, `Completed`, `Revenue`, `Wallet debt`를 유지하려면 DB/API가 전체 모집단 기준으로 정렬하고 회귀 테스트가 증명해야 한다.
8. 숨겨진 advanced filter와 다른 화면의 deep link caller도 확인한다. 25명 로컬 필터에 의존하는 operator-visible 경로는 서버화하거나 제거/대체한다.

가장 작은 안전한 해법을 선택하라. 여러 통계 정렬을 새로 구현하는 것보다 운영상 불필요한 버튼을 제거하는 것이 충분하면 제거하라. 단, 기존 링크를 조용히 다른 정렬로 fallback시키지 마라.

필수 테스트:

- 25개를 초과하는 fixture를 사용한다.
- 26번째 이후 레코드가 최고 예약 수/매출/부채를 가진 경우를 검증한다.
- source total, table total, pagination total이 일치한다.
- query parameter가 unsupported sort일 때 거짓 sort label이 나타나지 않는다.

### PRT-002 — canonical Wallet debt 계약

현재 치명적 문제:

- 미정산 포함 조건은 `WalletBalanceSummary.balance < 0`이다.
- 표시는 `ProviderEarning`의 PENDING/AVAILABLE 합계로 만든 `activitySummary.walletBalance`다.
- 그래서 `0 VND / No negative balance` 파트너가 Wallet debt 큐에 포함된다.

완료 조건:

1. Wallet debt 포함 조건, total, 행 Wallet, sort와 export는 모두 동일한 canonical VND `WalletBalanceSummary`를 사용한다.
2. pending payout과 available payout은 wallet balance와 다른 필드·레이블로 유지한다.
3. Wallet debt 큐에는 표시 balance가 음수인 Partner만 존재한다.
4. summary가 없거나 통화가 다른 경우를 명시적으로 처리한다.
5. API의 다른 파트너 운영 목록에서 이미 사용하는 `walletBalanceSummaries` select/override 패턴을 먼저 찾아 재사용한다.
6. 프런트에서 `balance >= 0` 행을 숨겨 서버 불일치를 감추지 않는다.
7. `apps/api/src/provider-wallet/**`, Prisma schema 또는 migration 변경이 정말 필요하다면 이 slice를 `Protected review needed`로 보고한다. 기존 summary를 읽어 해결할 수 있으면 schema를 바꾸지 않는다.

필수 테스트:

- 음수, 0, 양수, summary 없음, 여러 통화
- queue total과 표시값 일치
- export wallet balance 일치
- 기존 negative-wallet 비즈니스 차단 계약 회귀 없음

### PRT-003 — Approvals와 Onboarding blockers 분리

현재 상태:

- `approval-pending`: verification/KYC가 제출되어 실제 결정 대기 중인 큐
- `unapproved`: 제출 전 미완료, 보완, 반려, 차단 상태까지 포함하는 넓은 목록
- 실제 화면에서는 0 approvals와 148 unapproved의 차이가 설명되지 않는다.

1차 탭을 다음 네 가지 업무로 정리하라.

```text
Directory
Approvals
Onboarding blockers
Wallet debt
```

기존 route를 재사용한다.

```text
Directory: /partners
Approvals: /partners?review=approval-pending&sort=oldest
Onboarding blockers: /partners?review=unapproved
Wallet debt: /partners?review=unsettled
```

완료 조건:

1. Approval route에서 상단 탭, sidebar, breadcrumb와 H1이 모두 Approvals를 가리킨다.
2. `Unapproved Partners` user-facing copy는 `Onboarding blockers`로 바꾼다.
3. `Unsettled Partners` user-facing copy는 `Wallet debt`로 바꾼다.
4. 각 탭의 설명은 어떤 레코드가 포함되고 운영자가 무엇을 해야 하는지 말한다.
5. `0 approvals`와 `148 onboarding blockers`가 모순처럼 보이지 않는다.
6. 기존 approval 0건 empty state와 held/rejected, directory 이동 링크는 보존한다.

### PRT-004 — 승인 대기시간 단일 기준

현재 행의 `approvalSubmittedAt`은 verification/KYC `submittedAt`을 사용하지만 서버 age bucket, oldest와 SLA는 `ProviderProfile.updatedAt`을 사용한다.

완료 조건:

1. Approvals의 행 timestamp, waiting age, age bucket, oldest sort와 SLA overdue는 같은 canonical review timestamp를 사용한다.
2. 우선 기존 verification/KYC `submittedAt`을 사용한다.
3. pending verification과 pending KYC가 동시에 있으면 현재 계약에 맞는 하나의 명확한 기준을 정하고 테스트로 고정한다. 가장 오래 기다린 active submission을 우선하는 기존 행 의도와 대조하라.
4. profile의 unrelated update가 승인 순서나 SLA를 바꾸지 않는다.
5. canonical filter/order를 DB에서 안전하게 구현할 수 없는 경우 프런트 추정으로 대체하지 않는다. 정확한 API contract gap을 보고하고 다른 slice를 계속한다.
6. schema에 새 `reviewQueuedAt`을 추가해야만 해결된다는 증거가 있을 때만 migration 결정을 요청한다.

필수 테스트:

- submittedAt과 profile updatedAt이 다른 경우
- verification만 pending, KYC만 pending, 둘 다 pending
- SLA threshold 직전/직후
- profile edit 후 순서가 유지됨

### PRT-005 — 운영 데이터와 Test/Seed/Audit 데이터 분리

현재 화면에 `Smoke Partner`, `Audit Cancellation Partner`, 번호형 Partner가 운영 목록과 total에 섞인다.

완료 조건:

1. 먼저 기존 `adminProviderProductionDataWhere()`와 production/test 식별 helper의 실제 의미와 caller를 확인한다.
2. 신뢰할 수 있는 기존 provenance가 있으면 partner directory query와 summary에 재사용한다.
3. 이름, 전화번호, ID 문자열 패턴으로 test 데이터를 추정해 숨기지 않는다.
4. 운영 Directory, Approvals, Onboarding blockers, Wallet debt, total과 export는 기본적으로 production/live 데이터만 포함한다.
5. `Include test data`가 필요하다면 명시적 권한과 명시적 provenance가 있을 때만 제공한다.
6. 기존 스키마에 신뢰할 provenance가 없고 migration이 필요하면 이 slice만 `Protected review needed`로 보고한다. 임시 이름 휴리스틱을 구현하지 않는다.

필수 테스트:

- live/test/seed/audit 분리
- 모든 queue total과 export 기본 제외
- 명시적 include 동작이 있다면 권한과 active filter 표시

### PRT-006 — 큐를 보존하는 navigation과 filter

현재 nav는 query string 전체 exact match라 secondary filter가 붙으면 sidebar 활성 상태가 사라진다. 일반 `Clear filters`는 항상 `/partners`로 이동해 현재 큐를 이탈한다.

완료 조건:

1. Partner nav 활성 판단은 pathname과 primary `review` mode를 사용한다.
2. `q`, `activity`, `verification`, `kyc`, `age`, `sla`, `page`, parameter order는 현재 탭 활성 상태를 깨지 않는다.
3. breadcrumb와 H1도 같은 primary mode resolver를 재사용한다.
4. Clear filters는 현재 mode를 보존한다.
5. 개별 active filter chip을 안전하게 제거할 수 있으면 기존 href builder로 구현한다. 새 filter framework는 만들지 않는다.
6. native form submit URL에 빈/default parameter가 남지 않도록 canonical URL을 만든다. 기존 directory form/helper를 우선 사용한다.
7. advanced filter disclosure는 operator가 발견할 수 있어야 한다. 이미 advanced filter가 URL에 있을 때만 렌더링되는 구조를 제거한다.
8. 30개 review lane을 한 select에 그대로 노출하지 않는다. 자주 쓰는 queue는 탭으로, 나머지는 기존 책임 화면과 작은 관련 그룹으로 정리한다.

필수 테스트:

- query order 변경
- secondary filters 추가
- page 이동
- 각 탭의 clear href
- canonical URL에 빈/default parameter가 없음

### PRT-007 — 운영 행동 중심 표와 반응형 구조

일반 Directory 표는 최대 6개 핵심 컬럼으로 줄여라.

권장 구조:

| 컬럼 | 내용 |
|---|---|
| Partner | 표시명, legal name이 다를 때만 보조 표시, ID |
| Availability | Ready/Busy/Offline와 마지막 app activity |
| Blocker | 일을 못 받는 가장 중요한 이유 1개와 `+N` |
| Current work | 현재 booking 또는 최근 work 요약 |
| Data quality | 판단에 영향을 주는 location/app tracking 결손만 표시 |
| Action | 현재 상태에 맞는 명확한 CTA 하나 |

큐별 요구사항:

`Approvals`:

- Partner
- Waiting age/SLA
- 상위 missing/risk blocker 2개 +N
- Owner 또는 Unassigned
- Review submission CTA

`Onboarding blockers`:

- Gender 컬럼 제거
- 단계
- 상위 blocker 2개 +N
- 마지막 Partner 활동
- Owner
- Request correction/Open profile CTA

`Wallet debt`:

- Partner
- canonical Wallet debt
- Debt since 또는 기존 데이터에서 확인 가능한 최신 발생 근거
- payout/withdrawal hold 요약
- Owner/last follow-up이 실제로 존재할 때만 표시
- Open wallet/settlement CTA
- 중복 Revenue와 Payout 컬럼 제거

실제 데이터에 owner, debtSince, latestDebtBooking이 없다면 가짜 값을 만들지 마라. 존재하는 정보만 표시하고 missing API contract를 최종 위험으로 보고한다.

레이아웃 완료 조건:

1. `.partners-page > .card`의 일괄 max-height/overflow가 이 화면의 제목·필터·목록에 여러 세로 스크롤을 만들지 않는다.
2. `.vuexy-partner-table`의 `min-width:1440px` 의존을 제거한다.
3. 1440, 1280, 1024 CSS px에서 기본 Directory 핵심 흐름에 가로 스크롤이 없다.
4. 720 CSS px/200% 확대 수준에서도 Partner, state, blocker, action의 문맥이 유지된다.
5. 가로 스크롤이 불가피한 전문 큐는 Partner 열을 sticky로 유지하되, 먼저 컬럼 축소로 해결한다.
6. empty state는 1,440px 빈 table과 가로 scrollbar를 만들지 않는다.
7. 페이지는 기본적으로 하나의 세로 스크롤 흐름을 사용한다.
8. 행 helper text는 두 줄을 넘지 않고 핵심 근거를 tooltip에만 숨기지 않는다.

기존 `AdminDataTable`, `AdminTableScroll`, pagination, card, badge를 재사용하라. 새 table dependency를 추가하지 마라.

### PRT-008 — 운영자 문구와 정보 밀도

최소한 다음 문구를 운영자 중심으로 정리하라.

| 현재 | 변경 목표 |
|---|---|
| Partners | Partner directory |
| Vuexy management table 설명 | Find a Partner, confirm whether they can take work, and open the right follow-up. |
| Partner operations filters | Find and filter partners |
| Ready now / Records sort | Sort by |
| Checklist | Operational priority 또는 지원되는 실제 정렬명 |
| AGE | Waiting age — 실제 queue에서만 |
| Unapproved Partners | Onboarding blockers |
| Unsettled Partners | Wallet debt |
| settlement matchs | partners with wallet debt 또는 settlement cases |
| Not saved · legal name | 레이블이 있는 `Legal name: Not recorded` |
| App not tracked | Tracking unavailable |
| Unknown platform | Platform not recorded |

추가 원칙:

1. 일반 Directory에서 queue age와 SLA controls를 제거한다.
2. `Checklist`와 `Newest first`처럼 동시에 활성인 이중 정렬 구조를 제거한다.
3. 정렬은 하나의 control과 하나의 active state만 사용한다.
4. 제목 카드와 필터 높이를 줄여 1440×900 첫 viewport에 실제 Partner 행이 보이게 한다.
5. 반복되는 data-missing badge가 실제 blocker보다 강하게 보이지 않게 한다.
6. CTA는 `Open`만 쓰지 말고 `Review submission`, `Open controls`, `Review wallet debt`처럼 행동과 대상을 쓴다.
7. 단수/복수는 기존 helper를 무작정 사용할 때 어색해지지 않도록 명확한 item label을 사용한다.

### PRT-009 — Export 범위와 개인정보 보호

현재 기본 export는 current `visibleProviders`만 내보내면서 phone, device, latest session IP, wallet/account 정보를 포함한다.

이 작업에서 가장 작은 안전한 결과를 구현하라.

1. 현재 페이지 export를 유지한다면 버튼을 `Export current page (10)`처럼 정확히 표시한다.
2. `Export all`을 새로 만들지 않아도 된다. 전체 export가 명시적으로 요구되지 않았다.
3. 기본 Partner directory CSV에서 raw phone, latest session IP, device token/identifier와 불필요한 account note를 제거하거나 기존 안전한 masking helper를 적용한다.
4. export route는 기존 operator access/category guard를 우회하지 않는다.
5. export scope, row count, filter, sort와 generatedAt을 CSV metadata 또는 안전한 응답 계약에 남긴다.
6. 실제 데이터 CSV를 브라우저에서 다운로드해 PII를 출력하지 않는다.
7. 민감한 full export가 업무상 반드시 필요하다는 기존 권한 계약이 있다면 삭제하지 말고 별도 권한·audit 경계를 확인한 뒤 보고한다.

필수 테스트:

- current page 행 수와 label 일치
- page 2 export가 page 2만 포함
- raw phone/IP/device identifier 미포함 또는 기존 규칙에 따른 masking
- unauthorized/permission failure
- content disposition, UTF-8 CSV와 formula injection protection 회귀 없음

### PRT-010 — 상태·접근성·실행본 검증

다음 상태를 실제 실행본에서 확인한다.

```text
Directory default
Approvals with rows 또는 정확한 0건 empty state
Onboarding blockers
Wallet debt
secondary filters applied
search no results
API/list unavailable
summary unavailable 또는 partial failure
1024 CSS px
1280 CSS px
1440 CSS px
720 CSS px 또는 실제 200% zoom
keyboard-only traversal
```

완료 조건:

1. API failure가 `0 Partners`, `No approvals`, `0 VND` 같은 정상 empty state로 보이지 않는다.
2. error는 실패 범위와 retry 방법을 제공하고 `role="alert"` 또는 기존 공용 error pattern을 사용한다.
3. 검색, select, tabs, sort, table region, pagination과 CTA에 접근 가능한 이름이 있다.
4. focus-visible이 보이고 focus 순서가 화면 읽기 순서와 일치한다.
5. horizontal scroll region이 남으면 keyboard focus와 정확한 aria-label을 유지한다.
6. 색상만으로 Ready, Blocked, Debt, Overdue를 구분하지 않는다.
7. 200% zoom에서 양방향 스크롤 없이 핵심 업무를 수행한다.
8. browser console error/warning을 확인한다.

## 7. 구현 순서

다음 순서를 지켜라. 데이터가 틀린 상태에서 카드와 색상만 먼저 다듬지 마라.

### Phase 0 — 증거와 작업 트리 정렬

1. git status와 관련 diff 확인
2. 관련 code/test caller 추적
3. 기존 focused tests 실행
4. 현재 build ID와 before 화면 기록

### Phase 1 — 데이터 신뢰성

1. PRT-001 전체 모집단 계약
2. PRT-002 canonical wallet balance
3. PRT-004 approval waiting timestamp
4. PRT-005 production/test scope
5. 목록/summary/pagination/export parity tests

각 항목은 root cause가 다르므로 한 번에 거대한 service refactor로 섞지 마라. 가장 높은 기존 공통 helper/read model에서 최소 수정한다.

### Phase 2 — 정보구조와 운영 흐름

1. PRT-003 4개 탭
2. PRT-006 nav/clear/canonical URL
3. 큐별 filter/sort 분리
4. 큐별 next action 연결

### Phase 3 — 표·문구·반응형

1. PRT-007 6컬럼 이하 표
2. 카드 내부 세로 스크롤 제거
3. min-width 1440 제거
4. PRT-008 문구와 밀도
5. 1440/1280/1024/720 검증

### Phase 4 — 개인정보·오류·접근성

1. PRT-009 current page export와 기본 PII 최소화
2. PRT-010 unavailable/empty/partial 상태
3. keyboard, focus, reflow 검증

실제 외부 차단이 없다면 Phase 1 하나만 하고 멈추지 말고 전체 구현을 완료하라. 다만 schema migration, 새로운 wallet authority, 권한 모델 변경이 필요한 slice는 명확히 분리해 사용자 결정을 요청할 수 있다.

## 8. 테스트 명령

가장 작은 관련 테스트부터 실행한다.

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- app/partners/page.spec.tsx app/partners/partner-filters.spec.ts app/partners/partner-filter-board.spec.tsx app/partners/partner-master-list-section.spec.tsx app/partners/partner-master-row.spec.ts app/partners/partner-list-query.spec.ts app/partners/partner-primary-list-tabs.spec.tsx app/partners/partner-review-mode.spec.ts lib/admin-nav-match.spec.ts app/api/admin/partners/export/route.spec.ts app/partners/partner-export-rows.spec.ts
```

API contract 변경 후:

```powershell
npm.cmd run test --workspace @massage-vn/api -- src/admin/admin.service.spec.ts -t "partner directory"
```

완결된 Admin Web slice 후:

```powershell
npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run build --workspace @massage-vn/admin-web
npm.cmd run verify:scope -- -Scope admin
```

API 또는 wallet read model을 변경한 후:

```powershell
npm.cmd run typecheck --workspace @massage-vn/api
npm.cmd run build --workspace @massage-vn/api
npm.cmd run verify:scope -- -Scope api
```

모든 명령을 무조건 반복하지 말고, 각 phase에서 focused test를 먼저 실행한다. final build/scope 검증은 실제 변경 범위에 맞게 수행하고, 실행하지 못한 명령은 이유를 보고한다.

테스트가 기존 잘못된 25명 로컬 정렬이나 `0 VND` 미정산 행을 허용하고 있다면 테스트를 보존한다는 이유로 잘못된 동작을 유지하지 마라. 새 올바른 계약으로 테스트를 수정하고, 왜 기존 테스트가 공백이었는지 기록한다.

## 9. 실행본과 브라우저 검증

1. 기존 로그인된 in-app browser를 사용한다.
2. build 후 `.next/BUILD_ID`를 기록하고 실행 중 3101 앱이 같은 build인지 확인한다.
3. 재시작이 필요하면 3101 포트의 정확한 Admin Web PID와 command line을 확인한 뒤 해당 프로세스만 대상으로 한다.
4. 다른 프로젝트나 사용자 프로세스를 종료하지 않는다.
5. before/after는 같은 viewport, route, query와 가능한 한 같은 데이터 상태로 캡처한다.
6. screenshot만 보지 말고 DOM text, accessible name, href, total, active tab/nav, scrollWidth/clientWidth, focus 순서를 확인한다.
7. 실제 mutation과 실제 PII export는 수행하지 않는다.

after 캡처는 감사 원본을 덮어쓰지 말고 다음 폴더에 저장한다.

```text
output/partners-improvement-verification-2026-08-06/
```

최소 캡처:

```text
01-directory-1440x900.png
02-approvals-1440x900.png
03-onboarding-blockers-1440x900.png
04-wallet-debt-1440x900.png
05-filtered-wallet-debt-1440x900.png
06-search-empty-1440x900.png
07-directory-1280x720.png
08-directory-1024x768.png
09-directory-200-percent.png
10-api-error-1440x900.png
```

데이터가 없어 특정 row state를 캡처할 수 없으면 억지 fixture를 운영 DB에 추가하지 말고 `NOT VERIFIED — no safe live row`로 보고한다. test fixture에서 계약은 검증하라.

## 10. 완료 판정표

최종 응답 전에 아래 항목을 각각 `PASS / FAIL / NOT VERIFIED / PROTECTED REVIEW NEEDED`로 판정하라.

| ID | 완료 기준 |
|---|---|
| PRT-001 | 노출 정렬·필터·total·pagination이 전체 모집단에서 일치 |
| PRT-002 | Wallet debt 포함 조건과 표시/CSV가 같은 canonical balance 사용 |
| PRT-003 | Directory/Approvals/Onboarding blockers/Wallet debt 의미와 active state 일치 |
| PRT-004 | approval row age, bucket, sort, SLA가 같은 submitted timestamp 사용 |
| PRT-005 | production과 test/seed/audit 데이터가 구조적으로 분리 |
| PRT-006 | secondary query 후에도 nav/breadcrumb 유지, clear가 queue 보존 |
| PRT-007 | 6컬럼 이하, 하나의 세로 흐름, 1024/200% 핵심 문맥 유지 |
| PRT-008 | 개발 문구·이중 정렬·잘못된 복수형·레이블 없는 helper 제거 |
| PRT-009 | export 범위 명확, 기본 CSV PII 최소화, 권한 유지 |
| PRT-010 | empty/error/partial 분리, keyboard/focus/reflow 검증 |

하나라도 FAIL이면 완료라고 말하지 마라. 안전하게 고칠 수 있으면 같은 작업에서 수정한다. 실제 schema/권한/비즈니스 결정이 필요한 경우에만 정확한 blocker와 최소 선택지를 보고한다.

## 11. 하지 말아야 할 구현

- 25명 로컬 정렬을 유지하고 label만 바꾸기
- 0 VND 행을 프런트에서 숨기기
- 전체 1,378명을 브라우저로 불러와 정렬하기
- Smoke/Audit/Partner 이름 패턴으로 test 데이터를 제거하기
- profile updatedAt을 approval submitted time처럼 계속 사용하기
- 모든 review lane을 탭으로 만들기
- 모든 컬럼을 유지하고 sticky first column만 추가하기
- 중요한 컬럼을 좁은 화면에서 무조건 `display:none` 처리하기
- 가짜 owner, 가짜 debt age, 가짜 last contact 만들기
- API failure를 empty state로 fallback하기
- raw phone/IP/device를 기본 export에 그대로 두기
- 새 table/filter/export framework 만들기
- 새 UI dependency 추가하기
- protected wallet/schema/auth 변경을 UI cleanup과 섞기
- 사용자 dirty change를 되돌리기

## 12. 최종 보고 형식

최종 응답은 파일 목록보다 운영 결과를 먼저 설명하고 다음 순서를 따른다.

1. 운영자가 더 빠르고 안전하게 할 수 있게 된 결과
2. PRT-001~010 판정표
3. 데이터 계약 변경
   - 전체 모집단
   - canonical wallet balance
   - approval timestamp
   - production/test scope
4. 정보구조와 문구 변경
5. 변경 파일과 각 파일의 역할
6. 실행한 명령과 PASS/FAIL/SKIPPED
7. build ID와 브라우저 before/after 증거 경로
8. 1440/1280/1024/200% 결과
9. 접근성, 오류/빈 상태와 export 개인정보 검증
10. 보호 영역, 새 dependency, schema migration 변경 여부
11. 기존 사용자 변경 보존 여부
12. 남은 위험과 다음 단 하나의 작업
13. commit을 만들었다면 hash, 아니면 `Not committed`

완료하지 않은 사항을 완료한 것처럼 표현하지 마라. 계획, 분석 또는 추가 제안서만 제출하지 말고 실제 구현·테스트·동일 build 실행본 검증까지 수행하라.

지금 `git status --short`, 필수 문서 읽기, 관련 caller 추적과 기존 focused test부터 시작한 뒤 Phase 1의 데이터 신뢰성 문제를 먼저 해결하라.

---

## 사용 방법

1. Codex에서 `C:\dev\massage-on-demand-vn`을 작업 폴더로 연다.
2. 이 파일에서 `당신은 C:\dev...`부터 `Phase 1의 데이터 신뢰성 문제를 먼저 해결하라.`까지 붙여 넣는다.
3. 현재 저장소의 로그인된 브라우저 세션을 유지한다.
4. Codex가 schema migration, 권한 모델 또는 실제 wallet authority 변경 필요성을 증명한 경우에만 해당 결정을 검토한다.
5. 단순히 작업이 크다는 이유로 Phase 1 후 중단하면, 다음 문장으로 계속 지시한다.

```text
PRT-001~010에서 안전하게 진행 가능한 미완료 항목을 계속 구현해. 계획이나 보고서만 작성하지 말고 focused test, build, 동일 build ID의 브라우저 before/after 검증까지 완료해. PROTECTED REVIEW NEEDED 항목만 근거와 함께 분리해.
```
