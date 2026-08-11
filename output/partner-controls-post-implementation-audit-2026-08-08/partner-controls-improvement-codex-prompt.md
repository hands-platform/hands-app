# Partner Controls 개선 구현용 Codex 마스터 프롬프트

아래 작업을 `C:\dev\massage-on-demand-vn` 저장소에서 직접 구현하라. 단순 제안이나 코드 예시로 끝내지 말고, 관련 코드와 호출 흐름을 먼저 확인한 뒤 실제 수정·자동 테스트·로그인된 관리자 화면 검증·완료 보고까지 수행하라.

## 1. 작업 목적

`http://localhost:3101/partner-controls`를 실제 운영자가 잘못된 큐나 상태를 믿고 처리하지 않도록 개선한다. 시각적 재디자인보다 다음 목표를 우선한다.

1. 필터, 행 종류, 전체 건수의 의미가 항상 일치한다.
2. SLA, 우선순위, 담당 주체, 경과시간 문구가 실제 데이터 의미와 일치한다.
3. 보고서 종료와 계정 제한 해제가 감사 가능한 형태로 기록된다.
4. 운영자가 보고서 작성·검토·제한 이력을 안전하게 처리할 수 있다.
5. 1440px 이상 데스크톱에서 빠르게 스캔하고 다음 행동을 판단할 수 있다.

## 2. 반드시 먼저 읽을 자료

다음 파일을 수정 전에 전부 읽어라.

- 저장소 규칙: `C:\dev\massage-on-demand-vn\AGENTS.md`
- 재감사 보고서: `C:\dev\massage-on-demand-vn\output\partner-controls-post-implementation-audit-2026-08-08\partner-controls-post-implementation-audit.md`
- 동일 폴더의 `01-summary-top-1692.jpg`부터 `13-kyc-filter-mixed-reason-1692.jpg`까지의 증거 화면

그다음 아래 파일과 관련 호출자·타입·테스트를 `rg`로 추적하라. 줄 번호는 이후 변경되었을 수 있으므로 함수명과 실제 호출 흐름을 기준으로 판단한다.

- `apps/api/src/admin/admin.service.ts`
- `apps/api/src/admin/admin-provider-control-helpers.ts`
- `apps/admin_web/app/partner-controls/page.tsx`
- `apps/admin_web/app/partner-controls/actions.ts`
- `apps/admin_web/app/partner-controls/partner-control-page-load-plan.ts`
- 위 파일과 연결된 DTO, route/controller, API client, 공용 타입, 테스트

## 3. 작업 원칙과 금지사항

- 시작 시 `git status --short`를 확인한다. 현재 작업 트리는 매우 dirty할 수 있으며 기존 변경은 사용자 작업이다. 관련 없는 파일을 수정·정리·삭제·되돌리지 않는다.
- 원인 위치에서 가장 작은 수정으로 해결한다. 증상별 임시 조건문을 여러 곳에 복제하지 않는다.
- 기존 helper, form state, query builder, 스타일, 테스트 패턴을 먼저 재사용한다.
- 새 패키지나 UI 라이브러리를 추가하지 않는다.
- 광범위한 리팩터링, 페이지 재작성, 추상화 계층 추가, 디자인 시스템 교체를 하지 않는다.
- DB migration은 해제 사유를 신뢰성 있게 보존·조회할 기존 경로가 전혀 없을 때만 사용한다. 먼저 기존 sanction record 또는 audit metadata를 재사용할 수 있는지 확인한다.
- 서버 데이터가 없는 owner, queue, SLA 시작 시각, health count를 추정하거나 만들어내지 않는다. 데이터가 없으면 정직한 문구 또는 보고서에 지정된 최소 fallback을 사용한다.
- 테스트와 브라우저 검증 중 실제 report 생성, restriction 생성·해제 등 운영 데이터를 변경하지 않는다. 데이터 변경 검증은 fixture/mock/단위 테스트로 수행한다.
- PII가 포함된 CSV를 생성하거나 첨부하지 않는다. 전화번호 마스킹을 유지한다.
- 검수 범위는 1440px 이상 데스크톱이다. 1024px 이하 반응형·모바일 UI를 검사하거나 보고서에 포함하지 않는다. 단, 공용 CSS를 일부러 깨뜨리지는 않는다.
- 기존에 잘 구현된 서버 totalCount, 페이지네이션, 오류와 빈 상태의 구분, native disclosure, 정책 영향 설명, restriction 적용 확인 절차, semantic table/label/aria-current를 보존한다.

## 4. 구현 순서

아래 순서를 지킨다. P0 회귀 테스트가 통과하기 전에는 시각적 P2 정리를 먼저 하지 않는다.

### Phase 0 — 기준선과 실제 계약 확인

1. 현재 `review`, `status`, `sort`, `details`, `sanction`, `newReport`, `reviewReportId`의 허용값과 기본값을 코드에서 표로 정리한다.
2. `listPartnerControlProviders()`에서 DB 후보 필터 → risk 생성 → 정렬 → totalCount → pagination 흐름을 끝까지 추적한다.
3. `adminPartnerControlRisk()`의 고정 우선순위와 각 row kind가 사용하는 날짜·owner·action source를 확인한다.
4. report 목록/단건 조회/update/create, sanction create/lift/history의 UI → action → API → persistence/audit 흐름을 확인한다.
5. 관련 기존 테스트를 실행해 기준선을 기록한다. 실패가 이미 존재하면 이번 변경과의 관련 여부를 구분해 완료 보고에 남긴다.

### Phase 1 — P0: Blocking reason 필터와 반환 행을 일치시킨다

현재 문제는 구체적인 `review=kyc`로 후보를 고른 뒤 `adminPartnerControlRisk(candidate)`가 review를 받지 않고 다시 가장 높은 risk를 선택해 `Negative wallet` 행을 반환하는 것이다.

다음 계약으로 수정한다.

- 기본/attention 큐에서만 파트너별 가장 영향이 큰 risk 하나를 선택한다.
- 구체적인 blocking reason 필터에서는 반드시 그 lane의 risk를 생성·반환한다.
- API가 실제 지원하는 모든 구체 reason에 대해 결과의 모든 `row.kind`가 선택 필터와 일치한다.
- 최소 검증 대상은 account block, cash debt, payout hold, report, overdue report, KYC, bank, location이다. 실제 enum/query 값은 코드의 계약을 따른다.
- `totalCount`는 해당 lane에서 실제 렌더 가능한 행 수와 일치해야 하며, 후보 수와 표시 행 수가 달라져서는 안 된다.
- 정렬과 pagination 이후에도 계약이 깨지지 않아야 한다.

구현 지침:

- `adminPartnerControlRisk`에 선택 lane을 명시적으로 전달하거나 lane별 계산을 재사용하는 최소 변경을 선택한다.
- 같은 규칙을 API와 프런트에서 따로 구현하지 않는다. 서버 응답을 진실의 원천으로 둔다.
- 필터별 회귀 테스트를 추가한다. 테스트는 결과 kind뿐 아니라 `totalCount`도 검증한다.

### Phase 2 — P0: Report SLA 문구를 상태에 맞게 고친다

현재 `reportAgeSlaLabel()`은 report status를 무시해 `RESOLVED`에도 현재 기준 `24h SLA overdue`를 표시한다.

다음 계약으로 수정한다.

- `OPEN`, `INVESTIGATING`에만 실행 중 SLA clock과 overdue를 표시한다.
- `RESOLVED`, `DISMISSED`에는 현재 overdue를 절대 표시하지 않는다.
- 종료 상태에는 `Closed`와 종료 시각 또는 실제 처리시간을 표시한다. 기존 데이터가 종료 시각을 제공하지 않으면 거짓 처리시간을 계산하지 말고 `Closed`만 표시한다.
- Summary의 urgent/overdue 집계와 Reports 행 문구가 같은 status 기준을 사용한다.
- status별 formatter 단위 테스트 또는 page 렌더 테스트를 추가한다.

### Phase 3 — P1: 감사 추적과 상태 변경 안전성을 완성한다

#### 3-1. Restriction lift reason/evidence

- Lift confirmation에 `Lift reason and evidence` visible label과 필수 입력란을 추가한다.
- 기존 sanction reason의 최소/최대 길이 정책을 재사용한다. UI와 API trust boundary 양쪽에서 검증한다.
- action이 빈 body를 보내지 않게 하고 actor, liftedAt과 함께 reason을 감사 가능한 저장소에 기록한다.
- History에서 해제 사유를 확인할 수 있게 한다. 기존 audit metadata로 신뢰성 있게 연결 가능하면 이를 재사용하고 불필요한 migration은 만들지 않는다.
- 빈 값, 공백-only, 제한 초과를 API 테스트로 막는다.

#### 3-2. Report resolution note

- status를 `RESOLVED` 또는 `DISMISSED`로 저장할 때 resolution note를 UI와 API에서 필수로 한다.
- status가 종료 상태가 아닐 때는 불필요하게 필수화하지 않는다.
- 공백-only 입력을 거부하고 기존 길이 제한을 재사용한다.
- API 직접 호출로 UI 검증을 우회해도 저장되지 않아야 한다.
- 기존 종료 report의 빈 note를 조회하는 것은 깨뜨리지 말고, 새 상태 변경/update에만 계약을 적용한다.

#### 3-3. Report editor URL 상태와 deep link

- New report를 열 때 `reviewReportId`를 제거한다.
- Report review를 열 때 `newReport`를 제거한다.
- 두 editor가 동시에 렌더되지 않는 테스트를 추가한다.
- `reviewReportId`는 현재 목록 페이지 10개 items 안에서 찾지 말고 단건 API 조회로 불러온다.
- 유효한 ID는 현재 page/status/filter와 무관하게 해당 report를 연다.
- 존재하지 않거나 접근 불가능한 ID는 전체 페이지를 실패시키지 말고 review panel에서 명확한 not-found/error를 보여준다.

#### 3-4. Report 생성 실패 시 초안 보존

- 기존 restriction form의 action-state/error 처리 패턴을 우선 재사용한다.
- validation 또는 API 실패 시 Partner, category, severity, booking ID, summary, details와 editor open 상태를 보존한다.
- 성공 시에만 기존 성공 redirect/notice 동작을 유지한다.
- generic error 한 줄만 표시하지 말고 가능한 field error를 해당 control과 연결한다.

### Phase 4 — P1: 로딩, URL, 다음 행동의 문맥을 바로잡는다

#### 4-1. Mode-specific fetch/error

- Summary 데이터는 Summary workspace에서만 필요하면 그때만 요청한다.
- Reports와 Account controls의 성공 여부를 `summaryResult.ok`로 판단하지 않는다.
- 각 workspace의 load notice는 그 화면에 필요한 요청만 기준으로 한다.
- 한 요청 실패가 다른 성공한 목록을 0건 또는 전체 실패로 오인시키지 않게 테스트한다.

#### 4-2. Canonical query state

- 빈 `q=`와 현재 workspace의 기본 sort를 URL에 남기지 않는다.
- 예: cash debt 필터의 canonical URL은 `/partner-controls?details=controls&review=cash-debt` 형태다.
- workspace 이동 시 대상 workspace에서 허용되지 않는 sort/status/review/sanction/page 파라미터를 운반하지 않는다.
- 필터가 바뀌면 해당 목록 page를 1로 초기화한다.
- back/forward, 새로고침, 공유 URL에서 같은 화면 상태가 재현되어야 한다.
- 기존 href/query helper 한 곳에서 canonicalization을 해결하고 링크마다 문자열 조건을 복제하지 않는다.

#### 4-3. Partner 문맥이 유지되는 Next action

- Negative wallet/debt/payout 관련 action에서 대상 Partner 문맥을 잃지 않는다.
- 대상 route가 이미 partner/query/filter를 지원하면 이를 사용한다.
- 지원하지 않으면 범용 `/cash-settlements`로 보내지 말고 기존 Partner detail의 적절한 finance/payout section 등 현재 코드가 보장하는 가장 가까운 문맥 링크를 사용한다.
- 지원하지 않는 query parameter를 새로 꾸며내지 않는다.

### Phase 5 — 운영자 중심 정보 구조와 문구를 정리한다

다음 변경은 실제 데이터 계약을 유지하면서 구현한다.

#### 5-1. Summary

- 카드마다 반복되는 `All partners · timestamp`를 제거하고 page action 영역에 `Updated {time}`와 기존 Refresh를 한 번만 둔다.
- scope는 neutral로, 위험 tone은 값/상태에만 적용한다.
- `priority items`를 `Partners with blockers`로 바꾼다.
- “한 파트너당 가장 영향이 큰 blocker 하나”라는 dedup 기준을 짧게 명시한다.
- API가 제공하는 open/investigating 전체 수를 `Reports needing review`로 표시하고 urgent/overdue를 보조 수치로 둔다.
- KYC와 bank count를 정확히 분리할 수 있으면 각각의 필터 링크로 제공한다. 현재 집계로 정확히 분리할 수 없다면 `KYC or bank gap`으로 정직하게 이름을 바꾸고 거짓 count를 만들지 않는다.
- Location/KYC/Bank health signal은 실제 해당 큐로 이동하게 한다.
- Shared device에 실제 검토 경로가 없으면 실행 가능한 경로를 먼저 확인하고, 없으면 Summary에서 제거한다.
- Optional tax는 운영 gate처럼 보이는 badge가 아니라 조용한 설명 문구로 유지한다.

#### 5-2. Partner blockers table

- `Priority`를 `Impact tier`로 바꾸고 `P0 · work/payout blocked`, `P2 · readiness gap`처럼 코드가 보장하는 실제 영향을 함께 설명한다.
- `Age / SLA`를 모든 종류에 강제로 적용하지 않는다.
  - report: age와 실제 SLA/overdue
  - wallet/restriction: 실제로 신뢰할 수 있는 `Last changed` 또는 gate 시작 시각
  - 추적 시각이 없음: `Start time not tracked`
- 정책 blocker에 개인 owner가 없으면 `Unassigned`를 반복하지 않는다. 실제 근거가 있는 responsible queue/team이 있으면 표시하고, 없으면 `Responsible queue not set`처럼 정직하게 표시한다.
- KYC 상태에 따라 근거가 있을 때만 `Partner: submit missing KYC` 또는 `Operator: review submitted KYC`처럼 다음 주체와 행동을 구분한다.
- negative wallet amount를 disclosure 안에 숨기지 말고 행에서 바로 확인할 수 있게 한다.
- Owner와 Next action을 `Next owner / action`으로 합쳐 1440px 이상에서 불필요한 줄바꿈을 줄인다.
- lane 공통 Policy는 표 상단에서 한 번 설명하고 각 행 disclosure에는 해당 파트너의 실제 evidence 중심으로 보여준다.
- 필터 Apply/Reset을 마지막 필드 가까이에 배치한다.

#### 5-3. Reports와 New report

- Reports 기본 화면은 가능하면 `OPEN + INVESTIGATING` 운영 큐를 먼저 보여주고 종료된 상태는 History/명시적 상태 필터로 접근하게 한다. 기존 API가 combined active filter를 지원하지 않는다면 큰 추상화나 중복 fetch를 만들지 말고 현재 구조에서 가장 작은 정확한 구현을 선택하고 완료 보고에 선택 이유를 적는다.
- 기본 active queue가 0이면 `No reports need triage.`를 사용하고 종료 이력으로 가는 secondary action을 제공한다.
- 검색 전 임의 Partner 20명을 계속 제공할 경우 placeholder를 `Select a Partner or search`로 정확히 바꾼다. 가능하면 최소 검색어 후 matching Partner만 제공하되 새 검색 컴포넌트나 의존성은 만들지 않는다.
- Category와 Severity의 자동 기본값을 제거하고 `Select category`, `Select severity`를 명시적으로 선택하게 한다.
- Summary/Details의 required 여부와 작성 목적을 짧은 help text로 제공한다.
- 검색/적용 버튼은 대응 입력 필드 옆에 둔다.

#### 5-4. Account controls empty state와 History

- 필터 없는 Active 0건은 `No active restrictions.`로 표시한다.
- 실제 필터 적용 결과가 0건일 때만 `No active restrictions match these filters.`를 사용한다.
- History에서 발행 사유와 해제 사유, 발행/해제 actor와 시각을 구분해 읽을 수 있게 한다.

## 5. UX 카피 기준

사용자 화면의 용어는 `Provider`가 아니라 `Partner`를 사용한다. 다음 문구를 기본으로 하되 실제 문맥에 맞게 문법을 조정할 수 있다.

| 기존 | 목표 문구 |
|---|---|
| `1310 priority items` | `1,310 Partners with blockers` |
| `Priority` | `Impact tier` |
| `Age unavailable · no queue SLA` | `Start time not tracked` |
| 정책 blocker의 `Unassigned` | 실제 queue 또는 `Responsible queue not set` |
| 활성 report 영역 | `Reports needing review` |
| 기본 active report 0건 | `No reports need triage.` |
| 카드별 `All partners · timestamp` | page-level `Updated {time}` |
| 검색 전에도 옵션이 있는 `Search for a Partner first` | `Select a Partner or search` |

문구 원칙:

- 운영자가 “무엇이 문제인지, 실제로 무엇이 막혔는지, 누가 다음에 무엇을 해야 하는지”를 한 행에서 판단할 수 있게 한다.
- `P0`, `overdue`, `Unassigned`처럼 정의 없는 내부 용어를 반복하지 않는다.
- 색상만으로 상태를 전달하지 않는다.
- 데이터에 없는 SLA, owner, 시작일을 추정하지 않는다.

## 6. 자동 테스트 요구사항

기존 테스트를 유지하면서 누락된 의미 회귀 테스트를 추가한다.

필수 테스트:

1. 모든 구체 blocking reason 필터와 반환 row kind 일치 및 totalCount 일치.
2. attention/default만 파트너별 최고 risk를 선택.
3. OPEN/INVESTIGATING만 SLA/overdue 표시, RESOLVED/DISMISSED는 미표시.
4. RESOLVED/DISMISSED update에서 resolution note 필수, API 우회 차단.
5. lift reason의 UI/action/API 검증과 감사 저장.
6. New report와 review editor query 상호 배제.
7. current page 밖 report ID의 direct review fetch.
8. report 생성 실패 시 모든 draft 유지.
9. Summary 실패가 Reports/Account controls 성공 화면을 실패 처리하지 않음.
10. 빈/default query 제거와 workspace별 허용 parameter만 유지.
11. 기존 정확한 totalCount/pagination/error-vs-empty/restriction confirmation 회귀 방지.

최소 실행 명령:

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- app/partner-controls/page.spec.tsx app/partner-controls/partner-control-summary.spec.ts app/partner-controls/partner-control-page-structure.spec.ts app/partner-controls/partner-control-page-metrics.spec.ts app/partner-controls/partner-control-page-load-plan.spec.ts app/partner-controls/partner-control-page-filters.spec.ts app/partner-controls/partner-control-policy.spec.ts app/partner-controls/partner-control-desk-action-confirmation.spec.ts app/partner-controls/actions.spec.ts

npm.cmd run test --workspace @massage-vn/api -- src/admin/admin.service.spec.ts src/admin/admin-provider-control-helpers.spec.ts -t "partner control|provider report|provider sanction"

npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api
```

새 테스트 파일을 추가하면 명령에 포함한다. API 이름 필터가 관련 테스트를 실제로 실행했는지 passed/skipped 수를 확인한다. `packages/shared-types`, Prisma schema/migration 등 `AGENTS.md`의 protected area를 변경한 경우 그 규칙에 따른 integration review와 full local verification도 수행한다. 환경 문제로 전체 검증을 못 하면 숨기지 말고 정확한 명령, 실패 원인, 대체 검증을 보고한다.

## 7. 브라우저 검증 요구사항

자동 테스트 후 로그인된 관리자 세션을 재사용해 실제 서버 데이터로 아래 URL을 1440px 이상에서 검증한다. 세션이 만료되었을 때만 사용자에게 로그인을 요청한다. 실제 데이터 변경 action은 실행하지 않는다.

- `http://localhost:3101/partner-controls`
- `http://localhost:3101/partner-controls?details=controls`
- `http://localhost:3101/partner-controls?details=controls&review=kyc`
- `http://localhost:3101/partner-controls?details=controls&review=cash-debt`
- report, overdue, bank, location 등 API가 지원하는 나머지 blocking reason URL
- `http://localhost:3101/partner-controls?details=reports`
- `http://localhost:3101/partner-controls?details=reports&status=OPEN`
- `http://localhost:3101/partner-controls?details=reports&newReport=1`
- 현재 목록 밖의 유효한 `reviewReportId` direct URL
- `http://localhost:3101/partner-controls?details=sanctions&sanction=ACTIVE`
- `http://localhost:3101/partner-controls?details=sanctions&sanction=HISTORY`

화면별 확인 항목:

- 선택한 blocking reason과 모든 행의 reason/kind가 일치한다.
- KYC 필터에 Negative wallet이 섞이지 않는다.
- 화면 total과 pagination이 서버 결과와 일치한다.
- 종료 report에 overdue가 보이지 않는다.
- editor 두 개가 동시에 열리지 않고 direct report link가 동작한다.
- 빈 상태와 실패 상태가 구분된다.
- URL에 빈 값, 기본 sort, 다른 workspace의 무효 parameter가 남지 않는다.
- 1440px 이상에서 document/table 가로 overflow가 없고 `Unassigned` 같은 단어가 한 글자 단위로 깨지지 않는다.
- 키보드로 내부 탭, 필터, disclosure, form에 접근 가능하며 visible focus가 유지된다.

수정 후 핵심 화면을 새 폴더에 캡처하고, 이전 증거와 혼동하지 않게 날짜와 `after` 의미가 드러나는 파일명을 사용한다. 1024px 이하 캡처는 만들지 않는다.

## 8. 최종 수용 기준

아래 항목이 모두 충족되어야 완료다.

- [ ] KYC를 포함한 모든 구체 blocking reason 결과가 해당 row kind만 반환한다.
- [ ] 각 lane의 totalCount와 실제 렌더 가능한 행 수가 일치한다.
- [ ] RESOLVED/DISMISSED report에 current overdue가 표시되지 않는다.
- [ ] OPEN/INVESTIGATING에만 실제 SLA가 적용된다.
- [ ] 종료 status 저장 시 resolution note가 UI/API 모두에서 필수다.
- [ ] restriction lift reason/evidence가 UI/API에서 필수이고 History에서 확인 가능하다.
- [ ] New report와 Review report editor가 동시에 열리지 않는다.
- [ ] direct `reviewReportId`가 현재 목록 page/status와 무관하게 열린다.
- [ ] report 생성 실패 후 전체 draft가 유지된다.
- [ ] 현재 workspace에 불필요한 fetch 실패가 다른 화면을 실패로 표시하지 않는다.
- [ ] query URL이 canonical하고 workspace 간 무효 parameter를 운반하지 않는다.
- [ ] debt/payout Next action이 Partner 문맥을 유지한다.
- [ ] Summary timestamp는 한 번만 표시되고 위험색은 위험 값/상태에만 사용된다.
- [ ] `Partners with blockers`, `Impact tier`, owner/action/time 문구가 실제 데이터 의미와 일치한다.
- [ ] 1440px 이상에서 표 가로 overflow와 부자연스러운 단어 파손이 없다.
- [ ] 기존 totalCount, pagination, error-vs-empty, restriction confirmation, 접근성 기본 구조가 유지된다.
- [ ] 관련 자동 테스트와 admin/api scope verification이 통과한다.

## 9. 완료 보고 형식

작업을 마치면 다음 순서로 간결하지만 누락 없이 보고한다.

1. **결과 요약**: P0/P1/P2별 완료·부분 완료·미완료.
2. **변경 파일**: 각 파일과 실제 변경 목적.
3. **핵심 계약 변화**: 필터/risk, SLA, resolution, lift audit, query/load 흐름.
4. **자동 검증**: 실행한 명령별 pass/fail/skipped 수.
5. **브라우저 검증**: 확인 URL, viewport, 주요 결과, 캡처 절대 경로.
6. **Protected areas**: 변경 여부와 추가 검증 결과.
7. **보호한 기존 동작**: totalCount, pagination, restriction confirmation 등.
8. **남은 위험/미완료**: 이유와 정확한 다음 작업. 없는 경우 `없음`이라고 쓴다.
9. **다음 권장 작업**: 가장 가치가 큰 한 가지.

코드와 검증 없이 “개선했다”라고 결론 내리지 말라. 보고서의 권장안을 그대로 복사하는 것보다 현재 코드와 데이터 계약에 맞는 가장 작은 root-cause 수정이 우선이다.
