# Codex Master Prompt — Audit Log Release Hardening

아래 프롬프트 전체를 새 Codex 작업에 그대로 붙여 넣어 사용한다.

---

당신은 `C:\dev\massage-on-demand-vn` 저장소에서 HANDS 관리자 웹의 Audit Log를 출시 가능한 수준으로 수정하는 시니어 풀스택 엔지니어다. 단순히 화면 문구나 배지만 바꾸지 말고, **감사 데이터의 저장·분류·필터·집계·Saved View·상세 증거·CSV/JSON Export가 동일한 진실과 동일한 범위를 사용하도록 끝까지 구현하고 검증하라.**

## 최우선 참고 자료

작업을 시작하기 전에 다음 문서와 증거를 반드시 읽어라.

1. 최신 재감사 보고서  
   `C:\dev\massage-on-demand-vn\docs\audits\audit-log-post-remediation-final-reaudit-2026-08-14.md`
2. 현재 실행 화면 증거  
   `C:\dev\massage-on-demand-vn\docs\audits\audit-log-post-remediation-final-reaudit-evidence-2026-08-14\`
3. 이전 감사 보고서  
   `C:\dev\massage-on-demand-vn\docs\audits\audit-log-final-reaudit-2026-08-11.md`
4. 이전 개선 프롬프트  
   `C:\dev\massage-on-demand-vn\docs\audits\audit-log-remediation-codex-prompt-2026-08-11.md`

보고서의 결론은 현재 **66/100, release HOLD**다. 기존 개선을 되돌리지 말고 남은 P0/P1을 해결하라.

## 작업 규칙

- 저장소의 `AGENTS.md`를 먼저 읽고 모두 준수한다.
- 현재 워크트리는 매우 dirty할 수 있다. 기존 변경은 사용자 소유다. 관련 없는 변경을 삭제·되돌리거나 정리하지 않는다.
- `git reset --hard`, `git checkout --`, 광범위 삭제를 사용하지 않는다.
- 구현 전 `git status --short`와 관련 파일 diff를 확인하고, 겹치는 변경을 보존한다.
- DB 스키마·마이그레이션·인덱스·트리거를 수정하기 전 사용 가능한 경우 `supabase-postgres-best-practices` 스킬을 먼저 읽고 적용한다.
- UI를 수정할 때는 기존 HANDS 디자인 토큰, Admin 컴포넌트, 테이블·필터·Drawer 패턴을 재사용한다. 새 디자인 시스템이나 임의의 색상/아이콘 패키지를 추가하지 않는다.
- 운영자는 개발자가 아니다. 내부 enum과 쿼리 구조보다 “무슨 일이 일어났고 지금 무엇을 해야 하는지”가 먼저 보이게 한다.
- 샘플·가짜 데이터·하드코딩된 현재 건수로 문제를 가리지 않는다.
- API 실패를 정상 빈 상태처럼 표시하지 않는다.
- 실제 감사 이벤트를 삭제하거나 불변 이력을 조용히 덮어쓰지 않는다. 레거시 보정은 재현 가능하고 검토 가능한 마이그레이션 또는 correction event 방식이어야 한다.
- 사용자 요구에 따라 **1440px 이상 데스크톱만 지원·검사한다. 1024px 이하 반응형 작업, 테스트, 보고는 이번 범위에 넣지 않는다.**
- 단위 테스트 통과만으로 완료하지 않는다. 최신 빌드로 실제 로그인 화면을 확인하고 캡처한다.

## 현재 확인된 P0

### P0-1. 분류·필터·집계·Export가 서로 다른 진실을 사용한다

실제 재현 결과:

- 기본 화면의 `Recorded 60~61`을 선택하면 5건만 반환된다.
- `Unknown 9`를 선택하면 0건이 반환된다.
- 필터 후 Area select는 `All areas`처럼 보이지만 active chip은 `Area: Unknown`이라고 표시된다.
- 9개의 `admin_user.finance_approver.*` 이벤트가 `UNKNOWN / INFO`에 남아 있다.

핵심 원인:

- schema v2 쓰기는 `area`, `severity`, `outcome`을 저장한다.
- 행 read model은 저장 값을 우선 사용한다.
- facet과 Saved View count는 저장 값과 action inference를 혼합한다.
- 실제 filter/Saved View predicate는 주로 action 이름 규칙만 사용하고 저장 classification을 무시한다.
- UNKNOWN 필터는 명시적 UNKNOWN 조회가 아니라 no-match sentinel로 끝난다.

관련 코드:

- `apps/api/src/admin/admin-audit-event-registry.ts`
- `apps/api/src/admin/admin.service.ts`
- `apps/api/src/admin/admin-audit-event-registry.spec.ts`
- `apps/api/src/admin/admin.service.spec.ts`
- `apps/admin_web/app/audit-log/page-content.tsx`
- `apps/admin_web/lib/admin-api.ts`

### P0-2. `bucket` 범위가 workspace 및 Export에서 소실된다

실제 재현 결과:

- `/audit-log?bucket=Operations%2FPolicy&range=all&sort=newest` URL에서 전체 22,966건이 표시됐다.
- 같은 시점 DB의 `operational_policy.*` 이벤트는 1,325건이었다.
- CSV/JSON Export 링크에도 `bucket`이 없었다.
- Clear all이 교차 페이지의 고정 scope까지 제거한다.

관련 코드:

- `apps/admin_web/app/audit-log/page-content.tsx`
- `apps/admin_web/app/api/admin/audit-log/export/route.ts`
- `apps/admin_web/app/api/admin/audit-log/export/route.spec.ts`
- `apps/api/src/admin/admin-governance.routes.ts`
- `apps/api/src/admin/admin.service.ts`

### P0-3. 실행 중인 빌드가 최신 소스와 다르다

- API `dist/main.js`보다 `apps/api/src`가 최신이다.
- Admin은 `next start`인데 `.next/BUILD_ID`보다 `globals.css` 및 다른 Admin source가 최신이다.
- 오래된 실행 화면으로 최종 검증하지 말라.

## 목표 아키텍처

감사 이벤트의 단일 진실을 다음과 같이 만든다.

```text
stored/effective classification
        │
        ├── row read model
        ├── filter predicates
        ├── summary
        ├── facets
        ├── saved views
        ├── pagination snapshot
        ├── event detail/download
        └── CSV/JSON export + export audit evidence
```

같은 scope와 snapshot에 대해 다음 불변식을 만족해야 한다.

```text
visible facet count
= filtered totalCount
= rows obtainable through cursor pagination
= exported row count (export limit 이내)
```

## 구현 단계

### Phase 0. 안전한 기준선 확보

1. `AGENTS.md`, 최신 보고서, 관련 코드와 테스트를 읽는다.
2. `git status --short`와 관련 파일 diff를 확인한다.
3. `npm.cmd run local:status`로 API/Admin 상태와 build freshness를 기록한다.
4. 현재 Audit Log focused tests와 typecheck를 먼저 실행해 기준선을 기록한다.
5. read-only DB query로 다음 기준값을 기록한다. 숫자를 코드나 테스트에 하드코딩하지 않는다.
   - current Vietnam day 전체 non-page-view 건수
   - area/outcome/severity/actorType별 저장 분포
   - UNKNOWN production actions
   - `operational_policy.*` 등 각 bucket predicate별 건수
   - schema v2 hash 누락 건수
   - schema v2 system actor mismatch

### Phase 1. canonical effective classification 구현

#### 1-1. schema v2 저장 classification을 canonical truth로 사용

- schema v2 이상의 `area`, `severity`, `outcome`, `actorType` 저장 값을 row, filter, facet, summary, Saved View, export 모두에서 동일하게 사용한다.
- action-name inference는 레거시 데이터 또는 명시적으로 허용한 보정 경로에서만 사용한다.
- `adminAuditEventReadModel`, `adminAuditWorkspaceWhere`, `adminAuditWorkspaceFacets`, `adminAuditSavedViewCount`, `adminAuditSavedViewWhere`, export query가 같은 effective classification을 사용하게 한다.
- 중복된 규칙 구현을 만들지 말고 한 모듈/한 contract로 통합한다.

#### 1-2. legacy 처리

다음 중 저장소 구조와 데이터량에 맞는 한 가지 방법을 선택하고 이유를 구현 보고서에 기록한다.

- 검토 가능한 one-time backfill migration으로 legacy classification을 채운다.
- 또는 DB view/generated effective field 등 쿼리 가능한 단일 effective classification 계층을 둔다.

금지:

- UI에서만 표시 값을 바꾸기
- endpoint마다 다른 action inference 재구현
- 기존 이력을 삭제하거나 임의로 덮어쓰기
- UNKNOWN을 숨기기 위해 All로 강제 변환하기

#### 1-3. UNKNOWN을 실제 조회 가능하게 한다

- UNKNOWN facet이 N건이면 UNKNOWN filter도 동일한 N건을 반환해야 한다.
- 선택된 facet 값은 결과가 0이어도 select에서 사라지면 안 된다.
- facet은 base-scope 또는 self-excluding facet 방식 중 하나를 일관되게 사용한다.
- active chip과 select 표시가 항상 URL/query state와 일치해야 한다.

#### 1-4. finance approver classification

`admin_user.finance_approver.*`를 explicit registry에 추가한다. 최소 기대 의미:

| Event | Area | Outcome | Severity guidance |
|---|---|---|---|
| requested | SECURITY | OPENED | NOTICE |
| approved | SECURITY | SUCCEEDED | NOTICE |
| grant | SECURITY | SUCCEEDED | NOTICE 또는 REVIEW |
| revoke | SECURITY | SUCCEEDED | NOTICE 또는 REVIEW |
| blocked | SECURITY | DENIED | REVIEW |

finance/treasury 관련 tag를 추가해 Money 관련 탐색에서도 찾을 수 있게 하되, primary area와 saved-view 포함 기준을 문서화한다.

모든 production action constant 또는 실제 emitter를 수집하는 registry coverage test를 추가한다. 명시적 exemption이 없는 action이 UNKNOWN으로 분류되면 테스트가 실패해야 한다.

#### 1-5. background event 의미 정리

현재 producer의 `failure_registered + RECORDED + REVIEW`와 action inference의 `failure/registered` 의미가 충돌한다.

- 최초 incident open/alert는 OPENED + REVIEW.
- 같은 incident 안에서 반복 수집되는 failure observation은 RECORDED + INFO 또는 명확한 telemetry 의미로 분리한다.
- acknowledge는 ACKNOWLEDGED.
- recovery/resolution은 RESOLVED.
- action 이름과 outcome이 모순되지 않게 한다.

### Phase 2. query scope와 Export 완전 통일

#### 2-1. typed canonical query key contract

페이지 URL, workspace API, drawer return URL, CSV/JSON export proxy, Nest controller, service options, export filter evidence/hash가 하나의 query-key 계약을 공유하게 한다.

최소 검토 키:

- `view`
- `range`
- `q`
- `area`
- `outcome`
- `severity`
- `actorType`
- `objectType`
- `eventId`
- `correlationId`
- `requestId`
- `from`
- `to`
- `sort`
- `bucket`
- `priority`
- `action`
- `targetPrefix`

`cursor`와 drawer `event`는 화면 탐색 전용임을 명시하고 export에 섞지 않는다.

#### 2-2. bucket propagation

- `auditFilterParams()` 또는 대체 canonical builder에 `bucket`을 포함한다.
- Next export allowlist, Nest export controller, service options, filter evidence/hash에 포함한다.
- workspace와 export가 동일한 bucket predicate를 사용한다.
- drawer open/close, Saved View 이동, Refresh, Next/Previous, CSV/JSON 모두 bucket을 보존한다.
- `Clear all`을 `Clear filters`로 바꾸고 고정 context scope는 보존한다.
- 사용자가 scope를 인식하도록 `Scope: Operations Policy` 같은 visible chip/heading을 표시한다.

#### 2-3. scope parity tests

각 지원 bucket에 대해 동적 기대값으로 다음을 검증한다.

- API workspace total
- saved-view/facet totals
- 전체 cursor 결과
- CSV row count
- JSON row count
- export audit filter hash/evidence
- 화면의 visible scope

현재 1,325 같은 실제 건수는 변화할 수 있으므로 테스트에 하드코딩하지 않는다. 동일 snapshot의 canonical predicate count와 비교한다.

### Phase 3. 운영자용 projection과 UI

#### 3-1. Review required를 실제 actionable queue로 만든다

현재 raw event count를 Review required라고 부르는 것은 부정확하다. 다음 중 기존 도메인 구조에 가장 작은 변경으로 구현한다.

- 기존 incident target/lifecycle을 사용한 unresolved incident projection
- 또는 Audit Log 상단에 별도 `Action required incidents` projection을 제공하고 raw `Review-level events`와 명확히 분리

각 incident는 한 줄로 표시한다.

- queue/job
- current status
- first seen / last seen
- occurrence count
- age/SLA
- owner/acknowledgement
- latest reason
- System Health 또는 incident detail 링크

raw immutable events는 삭제하지 않는다. 반복 이벤트는 Evidence/history에서 계속 조회 가능해야 한다.

#### 3-2. source freshness 의미 수정

- Audit source Data lag는 전체 audit source high-water mark로 계산한다.
- q, area, outcome 등 content filter가 Data lag를 바꾸면 안 된다.
- 필터 결과의 최근 시점이 필요하면 Investigation results에 `Latest matching event`로 별도 표시한다.
- 빈 검색 결과가 source freshness를 Unknown으로 만들면 안 된다.

#### 3-3. cursor Previous 구현

- page 2 이후에 정확한 `Previous page`를 제공한다.
- 브라우저 Back에만 의존하지 않는다.
- 최초 snapshot timestamp를 앞/뒤 이동 모두에서 보존한다.
- 필터, bucket, sort, view를 모두 보존한다.
- 필요하면 URL에 안전한 cursor stack을 두거나 API previous cursor를 제공한다.

#### 3-4. 1440px+ advanced filter layout 수정

현재 `.audit-more-filters`가 `grid-column: 1 / 4`인 상태에서 내부 6열을 만들어 필드가 찌그러진다.

- open 상태에서는 advanced disclosure가 `grid-column: 1 / -1`을 사용한다.
- 1440px에서 3열 또는 4열로 구성한다.
- ID 검색 필드는 최소 220~260px의 실사용 폭을 갖게 한다.
- From/To는 함께 배치한다.
- exclusive boundary 설명은 label 안에서 줄바꿈시키지 말고 helper text로 둔다.
- Apply/Clear는 안정적인 footer row에 둔다.
- 1440×1000과 1600×1000에서 스크린샷으로 확인한다.
- 1024px 이하 CSS를 새로 만들거나 검사하지 않는다.

#### 3-5. 세부 UX와 접근성

- 검색 placeholder를 `Event, actor, object, or ID`처럼 짧게 한다.
- 검색·필터 상태는 URL에 유지해 deep link가 가능해야 한다.
- active filter chip은 잘리거나 사라지지 않게 wrap한다.
- 모든 Evidence 링크의 accessible name을 고유하게 만든다. 예: `Open evidence for <event label>, <time>`.
- Drawer에 object ID, actor key, payload hash copy action을 추가한다.
- Occurred와 Recorded, schema version, integrity state를 표시한다.
- Drawer open 중 배경 document scroll을 잠근다.
- Escape close와 trigger focus restore를 유지한다.
- 색상만으로 상태를 전달하지 않는다.
- 현재 디자인 토큰과 lucide 등 기존 아이콘 체계를 재사용하고 emoji/임의 SVG를 추가하지 않는다.

### Phase 4. 최신 빌드로 최종 검증

1. 구현과 테스트가 끝난 뒤 API와 Admin을 현재 소스에서 새로 build한다.
2. 프로젝트가 제공하는 로컬 start/stop 절차로 정확한 프로세스만 재시작한다. 광범위 process kill을 하지 않는다.
3. `local:status`에서 API build freshness가 stale이 아님을 확인한다.
4. Admin `.next/BUILD_ID`, source timestamp, 실행 process start를 비교한다.
5. 가능하면 System Health와 Audit Log trust strip에 build SHA와 build time을 노출한다.
6. 로그인된 실제 Admin 화면에서 최신 build임을 확인한 뒤 캡처한다.

## 필수 테스트

기존 테스트 통과 외에 아래 회귀 테스트를 추가한다.

### API/data contracts

1. schema v2 stored classification이 row/facet/filter/saved view/export에서 동일하다.
2. 모든 area facet의 advertised count와 filtered total이 같다.
3. 모든 outcome facet의 advertised count와 filtered total이 같다. 특히 RECORDED.
4. UNKNOWN area/outcome이 실제로 조회된다.
5. 모든 severity/actorType facet도 count parity를 만족한다.
6. Saved View count와 Saved View total이 같다.
7. bucket별 workspace/export/filter hash가 같은 scope를 사용한다.
8. filter가 source freshness를 바꾸지 않는다.
9. finance-approver production actions가 UNKNOWN으로 남지 않는다.
10. 신규 production action registry coverage가 작동한다.
11. schema v2 system events에 human actor ID가 붙지 않는다.
12. 일반 Audit Log page view가 audit row를 생성하지 않는다.

### Admin web contracts

1. canonical query builder가 workspace/export/refresh/saved view/drawer/pagination에 bucket과 필터를 일관되게 전달한다.
2. Clear filters가 bucket을 보존한다.
3. selected facet option이 결과 0에서도 select에 남는다.
4. active chip과 select 값이 URL state와 일치한다.
5. page 2에 Previous가 있고 snapshot/filter/scope를 보존한다.
6. Evidence accessible name이 행별로 고유하다.
7. Drawer focus/Escape/return-focus가 유지된다.
8. advanced filters open 상태의 1440px CSS contract를 검증한다.

### 실행 명령

저장소의 실제 package scripts를 다시 확인한 후 최소 다음을 실행한다.

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- app/audit-log app/api/admin/audit-log
npm.cmd run test --workspace @massage-vn/api -- src/admin/admin-audit-event-registry.spec.ts src/admin/admin-audit-helpers.spec.ts src/admin/admin-audit-log-index-contract.spec.ts src/admin/admin-background-jobs.service.spec.ts
npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run typecheck --workspace @massage-vn/api
```

관련 service/controller 테스트를 추가했다면 함께 실행한다. 전체 build도 실행해야 한다.

## 실제 브라우저 검증 시나리오

반드시 현재 로그인 세션이 있는 실제 브라우저에서 확인한다. 각 단계에서 DOM과 화면을 모두 본다.

1. `/audit-log` 기본 화면
2. Review required/actionable incident view
3. Security & access
4. Money & policy
5. `bucket=Operations/Policy` scope
6. 다른 지원 bucket 최소 2개
7. Area Unknown
8. Outcome Recorded
9. 결과가 없는 고유 검색어
10. More filters open
11. page 1 → page 2 → Previous → page 1
12. Evidence Drawer open/copy/Escape/focus restore
13. CSV/JSON export scope 및 row-count header
14. light mode 1440×1000
15. dark mode 1600×1000

검증 스크린샷은 다음에 저장한다.

`docs/audits/audit-log-post-remediation-final-verification-evidence-2026-08-14/`

최소 캡처:

- default 1440
- actionable review queue 1440
- scoped Operations Policy 1440
- advanced filters open 1440
- UNKNOWN 결과 1440
- RECORDED 결과 1440
- second page/Previous 1440
- evidence drawer 1440
- dark mode 1600

1024px 이하 캡처나 이슈는 만들지 않는다.

## 완료 조건

다음이 모두 만족되어야 완료다.

- 모든 visible facet count가 같은 scope의 filtered total과 일치한다.
- Saved View, summary, list, drawer download, CSV, JSON이 같은 classification/scope를 사용한다.
- UNKNOWN과 RECORDED가 광고한 건수만큼 실제 조회된다.
- Operations Policy scope가 전체 Audit Log를 반환하지 않는다.
- 화면에 현재 scope가 명시된다.
- Clear filters가 bucket/context를 제거하지 않는다.
- finance approver action이 UNKNOWN으로 남지 않는다.
- Review required가 반복 5분 이벤트 목록이 아니라 actionable incident를 보여주거나, raw event view와 정직하게 분리된다.
- Data lag가 content filter에 따라 바뀌지 않는다.
- page 2에서 Previous가 동작한다.
- advanced filters가 1440×1000에서 읽고 조작 가능하다.
- Evidence Drawer의 키보드 접근성이 유지된다.
- 최신 API/Admin build로 화면 검증이 완료된다.
- focused tests, typecheck, build, browser console smoke가 모두 통과한다.

## 금지되는 불완전한 해결

- 화면의 숫자만 맞춰 보이게 만들기
- RECORDED 또는 UNKNOWN만 별도 if 문으로 특수 처리하기
- `bucket`을 한 URL에만 추가하고 export/controller/hash를 빠뜨리기
- Saved View badge만 바꾸고 실제 query를 그대로 두기
- 반복 실패 이벤트를 삭제하거나 숨기기
- API 오류를 0건으로 처리하기
- 최신 build 없이 기존 브라우저 화면만 보고 완료 선언하기
- 1024px 이하 대응에 시간을 사용하기
- 관련 없는 dirty worktree 변경을 포맷하거나 되돌리기

## 산출물

1. 실제 제품 코드와 필요한 migration/test 수정
2. 브라우저 검증 스크린샷 폴더
3. 구현·검증 보고서  
   `docs/audits/audit-log-post-remediation-final-implementation-report-2026-08-14.md`

구현 보고서에 반드시 포함한다.

- 변경 파일 목록과 변경 이유
- canonical classification 설계
- legacy 처리 방식과 rollback/운영 위험
- bucket/query-key contract
- recurring incident projection 방식
- DB read-only before/after 수치
- 실행한 명령과 정확한 결과
- 빌드 SHA/시간 및 실행 프로세스 freshness
- 1440/1600 화면별 검증 결과와 스크린샷 경로
- 미해결 위험과 다음 작업

## 최종 응답 형식

작업이 끝나면 다음 순서로 간결하게 보고한다.

1. 출시 차단 P0가 해결됐는지 여부
2. 핵심 데이터 불변식 before/after
3. 구현한 주요 변경
4. 테스트/typecheck/build/browser 결과
5. 보고서와 증거의 절대 경로 링크
6. 남은 위험이 있으면 숨기지 말고 명시

P0가 하나라도 재현되면 “완료”라고 하지 말고, 재현 단계·원인·남은 조치를 보고하라.

