# Operations Policy · Audit 최종 개선 구현용 Codex 마스터 프롬프트

이 문서는 `Operations Policy > Audit` 최종 재감사 결과를 실제 코드 수정으로 전환하기 위한 **1회성 실행 프롬프트**다. 저장소의 영구 지침인 `AGENTS.md`에 복사하지 않는다. Codex에서 `C:\dev\massage-on-demand-vn`을 workspace로 연 뒤 이 문서 전체를 한 번에 전달한다.

---

Role: 당신은 HANDS 관리자 웹의 감사 데이터 신뢰성, 운영자 조사 흐름, 데스크톱 정보 설계와 회귀 테스트를 함께 책임지는 시니어 프로덕트 엔지니어다.

Goal: `/operations-policy?details=audit`를 단순한 최근 변경 참고표가 아니라, 1인 운영자가 **정확한 source를 식별하고, 이벤트 증거를 열고, 과거·현재 기록 사이를 왕복하며, Full Audit와 export에서도 동일한 결과를 확인할 수 있는 감사 워크스페이스**로 완성하라. 분석이나 계획으로 끝내지 말고 현재 코드와 로그인된 실행 화면을 다시 확인한 뒤 코드·테스트·문구·레이아웃을 실제로 수정하고 검증 증거를 남겨라.

## 1. 기준 자료와 작업 범위

```text
Workspace: C:\dev\massage-on-demand-vn
Primary route: http://localhost:3101/operations-policy?details=audit
Audit report: docs/audits/operations-policy-audit-final-reaudit-2026-08-13.md
Audit evidence: docs/audits/operations-policy-audit-final-reaudit-evidence-2026-08-13/
Previous broader prompt: docs/agent/prompts/operations-policy-final-remediation-master-2026-08-13.md
```

주요 코드 후보:

```text
apps/admin_web/app/operations-policy/operations-policy-audit-trail-section.tsx
apps/admin_web/app/operations-policy/operations-policy-audit-trail-section.spec.tsx
apps/admin_web/app/operations-policy/policy-audit-rows.ts
apps/admin_web/app/operations-policy/policy-audit-rows.spec.ts
apps/admin_web/app/operations-policy/operations-policy-page-model.ts
apps/admin_web/app/operations-policy/operations-policy-page-model.spec.ts
apps/admin_web/app/operations-policy/page.tsx
apps/admin_web/app/operations-policy/page.spec.tsx
apps/admin_web/app/audit-log/page-content.tsx
apps/admin_web/app/audit-log/audit-log-page-model.spec.ts
apps/admin_web/app/audit-log/audit-evidence-drawer.tsx
apps/admin_web/app/api/admin/audit-log/export/route.ts
apps/admin_web/app/api/admin/audit-log/export/route.spec.ts
apps/admin_web/app/globals.css
apps/admin_web/lib/admin-api.ts
apps/api/src/admin/admin-governance.routes.ts
apps/api/src/admin/admin.service.ts
apps/api/src/admin/admin.service.spec.ts
```

보고서의 line number를 맹신하지 말고 현재 symbol, type, request flow와 diff를 다시 찾아라. 이미 더 좋은 구현이 존재하면 기존 패턴을 재사용한다.

## 2. 작업 권한과 금지 사항

이 요청은 다음 로컬 작업을 승인한다.

- 관련 코드, 테스트, 문서, 현재 diff 읽기
- 범위 안의 Admin Web, API, CSS, 테스트와 문서 수정
- 비파괴 test, typecheck, lint/build 또는 scope 검증
- 로그인된 로컬 브라우저에서 비파괴 탐색, 화면 크기 변경, screenshot 저장
- mock, fixture 또는 전용 테스트 데이터로 상태 검증

다음은 승인하지 않는다.

- 실제 정책 값 저장, 운영/shared DB mutation, 감사 로그 backfill 실행
- 결제·지갑·부킹·정산 데이터 변경
- schema/migration, 인증·권한 모델, 배포 설정 변경
- 사용자 dirty change 삭제, reset, restore, checkout, stash, clean
- 새 UI 프레임워크, 새 상태관리 프레임워크, 새 패키지 도입
- Operations Policy와 Audit Log 밖의 무관한 전면 리팩터링
- subagent 또는 multi-agent 사용

작업 중 schema 변경이 필요하다고 판단되면 구현을 멈추고, 왜 기존 audit metadata와 query로 해결할 수 없는지 증거와 최소 대안을 보고하라. 이번 범위는 schema 변경 없이 해결하는 것이 기본 계약이다.

## 3. 화면과 품질 범위

- 필수 viewport: **1440×1000**, **1600×1000**
- 필수 theme: light와 dark
- **1024px 이하 화면은 검사·수정 목표·보고서·점수에서 완전히 제외한다.**
- 작은 화면 CSS를 고의로 삭제하지는 않지만 이번 완료 판단에 사용하지 않는다.
- 현재 디자인 토큰, Admin surface, table, badge, drawer, form-control 패턴을 재사용한다.
- 장식용 신규 카드나 대시보드 지표를 추가하지 않는다. 감사 정확성과 운영 속도에 필요한 요소만 만든다.

사용 가능한 경우 다음 스킬을 적용한다.

- `impeccable`: 테이블 정보 위계, active 상태, 문구, 접근성 polish
- `browser:control-in-app-browser`: 로그인 세션을 유지한 실제 화면 검증과 screenshot

## 4. 반드시 보존할 현재 개선 결과

아래는 이미 정상화됐으므로 다시 설계하지 말고 회귀를 막아라.

- source는 `operator | automated_smoke | legacy_unknown` 세 상태다.
- source 필터는 API에서 먼저 적용된다.
- source별 최대 8건과 next probe만 읽는다.
- metadata.source가 없는 과거 기록을 Operator로 분류하지 않는다.
- `Legacy automation · source inferred`는 추정임을 숨기지 않는다.
- Audit route는 불필요한 policy settings, booking sample, provider sample을 요청하지 않는다.
- API failure와 성공한 0건은 서로 다른 화면이다.
- relative time과 exact time을 함께 제공한다.
- 실제 table semantics와 `aria-current`를 유지한다.
- 1440/1600에서 전체 page horizontal overflow가 없다.

기존 broader remediation prompt 전체를 다시 실행하지 말고, 이번 재감사에서 남은 항목만 수정하라.

## 5. 최종 성공 조건

완료를 선언하려면 다음 조건이 모두 충족돼야 한다.

1. `Open full audit`가 화면 URL뿐 아니라 workspace API, summary, facets, pagination, refresh, CSV, JSON에 실제 `Operations/Policy` scope를 적용한다.
2. scoped Full Audit 결과에는 `operational_policy.*`가 아닌 action이 한 건도 섞이지 않는다.
3. Full Audit 진입 시 `range=all&sort=newest`가 명시되어 과거 legacy 기록도 조사할 수 있다.
4. Audit Log 화면에서 `Scope: Operations / Policy`를 시각적으로 확인할 수 있다.
5. `Clear refinements`는 scope를 유지하고, scope를 벗어나는 행동은 별도 `Exit policy scope`로 구분된다.
6. compact row에서 고유 event ID의 실제 Full Audit evidence를 열 수 있다.
7. evidence에는 event ID, policy key/target, exact timestamp, actor, source, environment, run ID, restoration, reason, before/after와 존재하는 request/correlation ID가 포함된다.
8. `Operational effect` 설명이 남는다면 evidence와 명시적으로 분리된다.
9. cursor 두 번째 이후 페이지에서 `Newer records`와 `First page`로 되돌아올 수 있다.
10. source를 바꾸면 pagination state가 초기화되며 페이지 경계에서 중복·누락이 없다.
11. 1440px에서 Policy 열이 충분한 폭을 가지며 접힌 행 높이가 대략 96~120px 범위다.
12. workspace와 source의 현재 선택 상태가 light/dark에서 색에만 의존하지 않고 보인다.
13. Operator, Automated smoke, Legacy 세 empty state가 각각 정확한 문구와 범위를 표시한다.
14. API failure, permission denied, true empty가 서로 다른 상태로 유지된다.
15. 관련 focused tests, Admin/API typecheck와 policy consistency 검증이 통과한다.
16. 실제 화면을 1440/1600 light/dark에서 다시 렌더링하고 screenshot과 구현 보고서를 남긴다.

## 6. 시작 절차

1. 루트 `AGENTS.md`와 이 프롬프트, 최종 감사 보고서를 끝까지 읽는다.
2. 증거 PNG `01`~`08`과 `browser-metrics.json`을 직접 확인한다.
3. `git status --short`와 관련 파일 diff를 확인하고 사용자 변경을 보존한다.
4. 현재 request flow를 `Operations Policy link → Audit Log page filters → workspace API/export route → API bucket where` 순서로 추적한다.
5. 관련 focused tests와 typecheck baseline을 기록한다.
6. 아래 Phase 1→5 순서로 구현한다. P0 데이터 scope가 고쳐지기 전에 시각 polish만 먼저 완료 처리하지 않는다.

## 7. Phase 1 — Full Audit scope 계약 수정 (P0)

### 7.1 확인된 root cause

현재 `apps/admin_web/app/audit-log/page-content.tsx`는:

- `auditFilters`에서 bucket을 읽는다.
- browser URL을 만들 때는 bucket을 별도로 보존한다.
- 실제 workspace API와 export URL이 공통 사용하는 `auditFilterParams`에는 bucket을 넣지 않는다.

또한 `apps/admin_web/app/api/admin/audit-log/export/route.ts`의 `EXPORT_FILTER_KEYS`에도 bucket이 없다. API의 `adminAuditLogBucketWhere('Operations/Policy')`는 이미 `operational_policy.*`를 지원하므로, UI→Admin proxy→API 사이에서 scope를 잃지 않게 하는 것이 핵심이다.

### 7.2 구현 요구사항

- normalized audit filter builder가 bucket을 workspace API에 포함하게 한다.
- CSV/JSON 링크와 Admin Web export proxy가 bucket을 API까지 전달하게 한다.
- cursor와 drawer-only state는 export에서 계속 제외한다.
- `Open full audit` 기본 href를 다음 의미로 만든다.

```text
/audit-log?bucket=Operations%2FPolicy&range=all&sort=newest
```

- Audit Log filter summary 또는 고정 context strip에 `Scope: Operations / Policy`를 표시한다.
- bucket은 일반 검색 refinement와 다른 고정 context로 취급한다.
- `Clear all`은 scoped 진입에서는 `Clear refinements`로 바꾸고 bucket을 유지한다.
- 별도 `Exit policy scope`만 `/audit-log`의 일반 전체 조사 화면으로 이동한다.
- refresh, saved views, evidence drawer open/close, first/next page에서도 bucket을 보존한다.
- CSV/JSON 파일명 또는 response metadata에 scope를 추가하는 것이 기존 계약상 안전하면 적용하되, 새 포맷을 임의로 만들지는 않는다.

### 7.3 필수 테스트

- `buildAuditWorkspaceApiHref(buildAuditFilters({ bucket: 'Operations/Policy' }))`에 bucket이 포함된다.
- shareable URL, refresh, saved view, cursor, evidence URL이 bucket을 보존한다.
- export link가 bucket을 포함한다.
- Admin export proxy가 bucket을 upstream API에 전달하고 cursor/event는 전달하지 않는다.
- API service에서 `Operations/Policy` bucket은 `operational_policy.*`만 조회한다.
- scoped `Clear refinements`는 bucket을 유지하고 `Exit policy scope`는 제거한다.

## 8. Phase 2 — compact row를 실제 Audit Evidence에 연결 (P1)

### 8.1 원칙

현재 `View details`의 `row.effect`는 정책 설명이지 감사 증거가 아니다. 기존 `apps/admin_web/app/audit-log/audit-evidence-drawer.tsx`와 `event` query 계약을 재사용하고, Operations Policy 전용의 두 번째 증거 drawer를 만들지 않는다.

### 8.2 구현 요구사항

- `View details`를 `Open evidence` 또는 동등하게 명확한 이름으로 바꾼다.
- action은 다음 scope를 유지한 Full Audit event URL을 연다.

```text
/audit-log?bucket=Operations%2FPolicy&range=all&sort=newest&event=<audit-event-id>
```

- 기존 Audit Evidence drawer에서 해당 event를 직접 연다.
- compact row와 drawer가 동일한 event ID를 사용한다.
- drawer가 현재 normalized event에서 제공할 수 있는 증거를 모두 보여주는지 확인한다.
- policy event에 필요한 값이 normalized detail에서 빠진 경우 기존 payload/metadata를 안전하게 매핑한다. 민감정보 redaction 계약을 우회하지 않는다.
- operational effect가 꼭 필요하면 `Operational effect`라는 별도 subsection으로 표시하고 `Evidence`라는 이름을 사용하지 않는다.
- 반복 링크의 accessible name은 policy와 exact timestamp를 포함한다.

예시 의미:

```text
Open evidence for Marketplace partner invitation limit, 3 Aug 2026 21:45 ICT
```

- event ID, request ID, correlation ID에는 기존 copy-button 패턴을 재사용한다.
- legacy row에는 source metadata가 기록되지 않았고 reason 기반 추정이라는 점을 drawer에서도 유지한다.

### 8.3 필수 테스트

- compact row의 evidence href가 bucket, range, sort, event ID를 모두 포함한다.
- accessible name이 각 row마다 고유하다.
- legacy event를 열어도 verified automated smoke로 승격되지 않는다.
- drawer close 후 동일 scoped result로 돌아온다.
- permission/error 상태에서 drawer가 성공한 빈 evidence처럼 보이지 않는다.

## 9. Phase 3 — 양방향 cursor navigation (P1)

### 9.1 요구사항

- 두 번째 이후 페이지에 `Newer records`와 `First page`를 제공한다.
- 과거로 계속 이동할 수 있는 `Older records`를 유지한다.
- source를 바꾸면 cursor와 이전 페이지 history를 제거한다.
- 정렬 기준 `createdAt desc, id desc`에서 duplicate와 skip이 발생하지 않아야 한다.
- 단순히 `history.back()`에 의존하지 않는다. deep link로 두 번째 페이지를 열어도 UI로 앞으로 돌아갈 수 있어야 한다.

### 9.2 구현 선택

현재 구조에 맞는 가장 작은 안전한 방법을 선택하라.

- 권장: endpoint가 방향을 포함한 opaque cursor와 `nextCursor` / `previousCursor`를 반환한다.
- 허용: 검증된 bounded cursor stack을 URL에 보존한다.

임의 offset pagination으로 바꾸거나 전체 레코드 수를 읽기 위해 unbounded query를 추가하지 않는다. cursor는 source·sort와 결합된 opaque 계약을 선호한다.

### 9.3 필수 테스트

- page 1 → older page 2 → newer page 1 왕복
- page 3 deep link → newer page 2 → first page
- 동일 timestamp의 여러 id에서 중복·누락 없음
- source 변경 시 pagination reset
- invalid/mismatched cursor는 명시적 오류 또는 안전한 first-page fallback

## 10. Phase 4 — 1440px 정보 밀도·active 상태·문구 (P1/P2)

### 10.1 테이블 정보 구조

현재 1440px 실측은 다음과 같다.

```text
When 158 | Policy 132 | Change 196 | Actor/Source 294 | Reason 169 | Details 102
first collapsed row ≈ 216px
8 rows document height = 2,472px
```

다음 우선순위를 기준으로 명시적 column sizing을 적용한다.

| 열 | 목표 |
|---|---|
| When | 약 148px, relative + exact time |
| Policy | 최소 220px, canonical label + category/context |
| Before → After | 최소 200px |
| Actor / Source | 최소 190px |
| Reason | 최소 240px, 기본 2줄 정도로 제한하고 evidence에서 전체 확인 |
| Evidence | 약 104px, 단일 action |

- 전체 table min-width는 현재 Admin content 폭에 맞춰 약 1,100px 전후로 검증한다.
- page 전체가 아니라 table scroll region만 필요한 경우에만 가로 스크롤한다.
- native details가 작은 마지막 cell 안에서 행 전체를 늘리는 구조는 제거한다.
- 접힌 행 높이는 대략 96~120px를 목표로 한다.
- policy label은 raw key를 `/`로 조합하지 말고 기존 policy definition의 canonical label을 우선 사용한다.
- `unknown` 단독 표시는 `Environment not recorded`처럼 의미를 완성한다.
- reason을 말줄임할 경우 title 속성만으로 해결하지 말고 evidence에서 전체 내용을 접근 가능하게 한다.

### 10.2 active 상태

- `Audit` workspace와 현재 source 모두 `aria-current="page"`를 유지한다.
- 기존 segmented control/filter chip의 active 패턴을 재사용하거나 동일한 디자인 토큰을 사용한다.
- active는 background 색 하나에만 의존하지 않고 border, underline, indicator 또는 font weight 중 하나 이상을 함께 쓴다.
- workspace navigation과 source filter의 위계를 서로 다르게 보여준다.
- light와 dark에서 선택/비선택 computed style이 실제로 달라야 한다.

### 10.3 empty/provenance copy

세 source의 empty message를 정확히 분기한다.

```text
Operator:
No authenticated operator policy changes are recorded.

Automated smoke:
No server-verified automated smoke policy changes are recorded.

Legacy:
No historical policy changes without trusted source metadata were found.
```

- `All recorded history · 0 ...`처럼 조회 범위를 함께 표시한다.
- Operator empty에는 새 authenticated save 이후 기록된다는 짧은 설명과 `Open Policies`를 제공한다.
- Automated smoke empty에서 실제 health 데이터를 이미 읽을 수 있을 때만 `Open System Health`를 제공한다. 이 링크를 위해 새 expensive request를 추가하지 않는다.
- Legacy inferred badge/help는 다음 의미를 전달한다.

```text
Reason resembles an older smoke event, but trusted source metadata was not recorded.
```

- source count가 필요하면 한 번의 grouped summary로 제공한다. 세 source list를 추가로 각각 요청하지 않는다.

### 10.4 필수 UI 테스트

- legacy empty가 automated-smoke 문구를 사용하지 않는다.
- active link만 `aria-current`와 active class를 함께 가진다.
- evidence action의 accessible label이 고유하다.
- 1440 CSS contract에서 Policy 최소 폭과 compact row 구조를 검증한다.
- 1600에서도 공간이 불균형하게 Actor/Source 한 열에 몰리지 않는다.

## 11. Phase 5 — 통합 검증과 실제 화면 재검수

### 11.1 최소 테스트 세트

변경된 파일에 따라 정확한 범위를 조정하되 최소한 다음을 실행한다.

```text
npm.cmd run test --workspace @massage-vn/admin-web -- app/operations-policy/page.spec.tsx app/operations-policy/operations-policy-audit-trail-section.spec.tsx app/operations-policy/policy-audit-rows.spec.ts app/operations-policy/operations-policy-page-model.spec.ts app/audit-log/audit-log-page-model.spec.ts app/audit-log/page.spec.ts app/api/admin/audit-log/export/route.spec.ts

npm.cmd run test --workspace @massage-vn/api -- src/admin/admin.service.spec.ts -t operational

npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run typecheck --workspace @massage-vn/api
npm.cmd run policy:admin-consistency
```

테스트 이름 필터가 shell quoting 때문에 실패하면 제품 실패로 오해하지 말고 안전한 단일 단어 filter 또는 해당 파일 전체 실행으로 다시 검증한다.

### 11.2 브라우저 상태 매트릭스

로그인된 in-app browser에서 다음을 비파괴 검증한다.

1. 1440×1000 light — Operator empty
2. 1440×1000 light — Automated smoke empty
3. 1440×1000 light — Legacy first page
4. 1440×1000 light — Legacy older page와 newer/first navigation
5. 1440×1000 light — Full Audit scoped result
6. 1440×1000 light — 한 policy event의 Evidence drawer
7. 1600×1000 light — Legacy table density
8. 1440×1000 dark — workspace/source active 상태
9. console warning/error

Full Audit에서는 화면의 event type과 network/API query를 함께 확인한다. URL에 bucket이 있다는 사실만으로 통과 처리하지 않는다.

### 11.3 시각 완료 기준

- 1440에서 첫 5~6개 row를 한 viewport에 비교할 수 있다.
- Policy 이름이 단어 단위로 과도하게 부서지지 않는다.
- 선택된 workspace/source를 3초 안에 찾을 수 있다.
- `Open evidence`가 어느 row의 action인지 명확하다.
- scoped Full Audit 상단에서 scope와 기간을 바로 알 수 있다.
- light/dark에서 clipping, overlap, horizontal page overflow가 없다.

## 12. 구현 후 산출물

다음을 생성한다.

```text
Implementation report:
docs/audits/operations-policy-audit-final-remediation-report-2026-08-13.md

Screenshot evidence:
docs/audits/operations-policy-audit-final-remediation-evidence-2026-08-13/
```

구현 보고서에는 다음을 포함한다.

- 결론과 완료/미완료 판정
- P0/P1/P2별 실제 변경 내용
- 변경 파일과 핵심 symbol
- 이전 root cause가 어떻게 차단됐는지
- 화면/API/export가 동일 scope임을 증명하는 결과
- pagination 왕복 결과
- 1440/1600 light/dark screenshot 목록
- 실행한 test/typecheck/consistency 명령과 결과
- browser console 결과
- 남은 제한 또는 검증하지 못한 상태
- 사용자 dirty worktree를 보존했다는 확인

## 13. 최종 응답 형식

최종 답변은 다음 순서로 작성한다.

1. 구현 완료 여부와 가장 중요한 결과
2. P0/P1/P2별 변경 요약
3. 검증 명령과 PASS/FAIL
4. 브라우저에서 확인한 상태와 screenshot/report 링크
5. 남은 위험 또는 차단 사유
6. 변경 파일 목록

분석만 했거나 일부 테스트만 통과한 상태를 “완료”라고 표현하지 않는다. required validation을 실행하지 못하면 이유와 대체 검증을 정확히 적는다.

## 14. Stop rules

- Full Audit 화면과 export가 같은 bucket 결과를 내지 않으면 완료하지 않는다.
- compact row와 Full Audit drawer의 event ID가 일치하지 않으면 완료하지 않는다.
- pagination에서 중복/누락 가능성을 해결하지 못하면 그 부분을 명시적 미완료로 남긴다.
- 실제 정책 저장이나 운영 데이터 mutation 없이는 검증할 수 없는 항목은 mock/fixture로 전환한다.
- schema 변경, 새 dependency, 권한 모델 변경이 필요해지면 임의로 확장하지 말고 증거와 최소 대안을 보고한다.
- unrelated failing test가 있으면 기존 실패인지 이번 diff 회귀인지 분리해 보고한다.
- 보고서, screenshot, test evidence가 모두 준비된 뒤에만 최종 완료를 선언한다.

## 최종 작업 지시

지금부터 위 기준에 따라 현재 코드와 실행 화면을 다시 확인하고 Phase 1부터 순서대로 실제 수정하라. 가장 먼저 `Open full audit`의 URL, workspace API request, export proxy request와 API bucket where를 하나의 data-flow로 추적해 P0 scope 누락을 고친다. 이후 실제 event evidence 연결, 양방향 cursor, 1440px 정보 밀도와 active/empty 상태를 수정한다. 모든 변경은 기존 디자인 시스템과 감사 보안·redaction 계약을 보존하고, 테스트와 실제 브라우저 증거로 검증한 뒤 구현 보고서를 남겨라.
