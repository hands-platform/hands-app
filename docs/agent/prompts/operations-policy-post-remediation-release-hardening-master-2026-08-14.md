# Operations Policy 재감사 후 출시 하드닝용 Codex 마스터 프롬프트

이 문서는 `Operations Policy` 구현 후 최종 재감사 결과를 실제 수정과 재검증으로 전환하기 위한 **1회성 실행 프롬프트**다. 저장소의 영구 지침인 `AGENTS.md`에는 합치지 않는다. Codex에서 `C:\dev\massage-on-demand-vn`을 workspace로 연 뒤 이 문서 전체를 한 번에 전달한다.

---

Role: 당신은 HANDS 관리자 웹의 운영 정책 안전성, 감사 데이터 신뢰성, 1인 운영자 업무 효율, Next.js UI 품질과 회귀 검증을 함께 책임지는 시니어 프로덕트 엔지니어다.

Goal: `/operations-policy`를 **정책을 빠르게 찾고, 안전하게 변경하고, Supply/Simulation 영향을 이해하고, 같은 정책 감사 증거를 화면·API·CSV·JSON에서 일관되게 확인할 수 있는 출시 가능한 운영 워크스페이스**로 완성하라. 계획이나 보고서 작성만으로 끝내지 말고, 현재 코드와 최신 production build 화면을 다시 확인한 뒤 범위 안의 코드·테스트·문구·레이아웃을 실제로 수정하고 검증 증거를 남겨라.

## 1. 기준 자료

```text
Workspace:
C:\dev\massage-on-demand-vn

Primary route:
http://localhost:3101/operations-policy

Final re-audit report:
docs/audits/operations-policy-post-remediation-final-reaudit-2026-08-14.md

Evidence index:
docs/audits/operations-policy-post-remediation-reaudit-evidence-2026-08-14/README.md

Evidence images:
docs/audits/operations-policy-post-remediation-reaudit-evidence-2026-08-14/

Previous focused prompt:
docs/agent/prompts/operations-policy-audit-final-remediation-master-2026-08-13.md

Previous broad prompt:
docs/agent/prompts/operations-policy-final-remediation-master-2026-08-13.md
```

보고서의 과거 line number나 구현 상태를 맹신하지 말고 현재 symbol, request flow, API contract, CSS와 dirty diff를 다시 확인하라. 이미 더 좋은 수정이 들어가 있다면 덮어쓰지 말고 그 구현을 검증·보완한다.

## 2. 작업 권한과 경계

이 요청은 다음 로컬 작업을 승인한다.

- 관련 코드, 테스트, 문서, 실행 로그와 현재 diff 읽기
- Operations Policy, Audit Log와 직접 연결된 Admin Web/API/CSS/test 수정
- 비파괴 test, typecheck, lint, build와 scope 검증
- 로그인된 로컬 브라우저의 비파괴 탐색, 입력, screenshot과 network/console 확인
- mock, fixture 또는 disposable test DB를 사용한 write/read 상태 검증
- 최신 Admin production build 생성과 로컬 3101 서버 재시작

다음은 승인하지 않는다.

- 실제 정책 저장, rollback, 운영/shared DB mutation 또는 audit backfill
- 실제 export 파일에 포함된 민감 운영 데이터를 외부로 공유
- 결제·지갑·부킹·정산·매칭 동작 변경
- schema/migration, RLS, 인증·권한 모델, 환경변수 또는 배포 인프라 변경
- 사용자 변경 삭제, `reset`, `checkout`, `restore`, `stash`, `clean`
- 새 UI 프레임워크, 상태관리 프레임워크, 패키지 또는 중복 route 도입
- 무관한 전면 리팩터링이나 dead-code 정리를 P0/P1 수정과 혼합
- subagent 또는 multi-agent 사용
- 사용자 요청 없는 commit

schema, 권한 모델 또는 새 dependency가 필요하다고 판단되면 임의로 확장하지 말고 기존 계약으로 해결할 수 없는 증거와 최소 대안을 구현 보고서에 남겨라.

## 3. 화면·디자인 범위

- 필수 viewport: **1440×1000**과 **1920×1080**
- 필수 theme: light와 dark. 전체 matrix를 양쪽에서 반복할 필요는 없지만 active 상태와 핵심 table은 둘 다 확인한다.
- **1024px 이하 화면은 구현 목표, 검사, screenshot, 보고서와 점수에서 완전히 제외한다.**
- 작은 화면 대응을 새로 만들거나 기존 small-screen CSS를 정리하는 데 시간을 쓰지 않는다.
- 현재 Admin design token, surface, badge, table, drawer, form-control, focus 패턴을 재사용한다.
- 운영 판단에 필요하지 않은 장식 카드, 그래프, animation 또는 신규 KPI를 추가하지 않는다.
- 같은 페이지 안의 workspace/source/lifecycle 전환은 키보드로 접근 가능해야 하며, 기존 Link 계약이 허용하면 `scroll={false}` 같은 표준 동작으로 불필요한 상단 점프를 막는다. 수동 스크롤 상태관리 코드는 만들지 않는다.

사용 가능한 경우 다음 도구/스킬을 사용한다.

- `ui-ux-pro-max` 또는 `impeccable`: 1440px 정보 위계, table density, active state, form/navigation 접근성
- `browser:control-in-app-browser` 또는 Playwright: 로그인 세션을 유지한 실제 production build 검증과 screenshot

## 4. 반드시 보존할 현재 개선 결과

아래는 재감사에서 확인된 정상 동작이다. 다시 설계하지 말고 회귀 테스트로 고정한다.

- API source of truth 기준 `19 Live / 2 Locked / 7 Planned`
- Locked/Planned는 목록뿐 아니라 직접 URL과 API PATCH에서도 fail-closed
- 1440px 정책 편집기는 full width, side-by-side는 1680px 이상에서만 사용
- 1440px 주요 화면의 page horizontal overflow 0
- high-risk 정책은 client와 API 모두 정확한 정책 label 확인 요구
- expected-value stale-write 보호
- setting update와 audit row를 같은 transaction에 기록
- 같은 policy key write에 PostgreSQL advisory transaction lock 적용
- audit health unavailable일 때 write disabled
- 처음 열린 form은 neutral validation state
- audit source는 `operator | automated_smoke | legacy_unknown`, server-side filter 후 source별 최대 8건
- Audit workspace에서는 policy settings request를 하지 않음
- Supply/Simulation의 Blocked, Demo reference, zero-result disclosure 의미
- diagnostic table은 기본 접힘 상태
- permission denied, API failure, true empty를 서로 다르게 표현
- validation 과정에서 실제 operation mutation을 하지 않음
- 기존 보안 redaction, audit integrity와 접근 권한 계약

이 항목 중 하나라도 이번 diff에서 깨지면 새 기능보다 회귀 복구를 우선한다.

## 5. 완료 조건

완료를 선언하려면 다음 결과가 모두 필요하다.

1. Full Audit의 browser URL, workspace API, summary, facets, pagination, saved view, refresh, evidence drawer, CSV와 JSON이 동일한 `Operations/Policy` scope를 유지한다.
2. scoped 화면과 export 결과에는 `operational_policy.*`가 아닌 action이 섞이지 않는다.
3. Full Audit 기본 진입은 `bucket=Operations%2FPolicy&range=all&sort=newest`를 포함한다.
4. scoped Audit Log에서 `Scope: Operations / Policy`를 바로 확인할 수 있고, `Clear refinements`는 scope를 보존하며 `Exit policy scope`만 scope를 제거한다.
5. Operations Policy audit row에서 정확한 event ID의 기존 Audit Evidence drawer를 열 수 있다.
6. audit pagination은 `First / Newer / Older`를 제공하고 source 변경과 잘못된 cursor를 안전하게 처리한다.
7. 1440px audit table은 4개 주요 열 중심으로 읽히며 policy label이 단어 중간에서 깨지지 않는다.
8. workspace/source active 상태는 light/dark에서 배경 외 border·font weight·indicator 중 하나 이상으로 명확하다.
9. 7개 Shift & Queue SLA Live policy에 generic impact fallback이 남지 않는다.
10. lifecycle KPI에서 Live/Locked/Planned 실제 목록을 바로 필터링할 수 있다.
11. changed/last changed 표현이 operator와 legacy/automated provenance를 구분한다.
12. dirty form의 정책 전환, workspace 전환, Close와 browser Back의 Cancel/Accept 결과가 실제 interaction test로 고정된다.
13. 1440×1000 첫 viewport에 filter bar와 첫 그룹 최소 2개 정책 행이 보인다.
14. 현재 source보다 늦게 생성된 BUILD_ID의 production server가 3101에서 실행되고, 그 실행물을 다시 캡처한다.
15. 모든 in-scope test/typecheck/lint/build가 통과한다. unrelated baseline 실패는 이전/이후 증거로 분리한다.
16. 구현 보고서, screenshot 목록, HEAD SHA, BUILD_ID, server start time과 남은 제한을 남긴다.

## 6. 시작 절차

1. 루트 `AGENTS.md`, 이 프롬프트, 최종 재감사 보고서와 evidence README를 끝까지 읽는다.
2. evidence PNG 중 `01`, `02`, `05`, `08`, `11`~`18`을 직접 확인한다.
3. `git status --short`, `git diff --`와 관련 untracked 파일을 확인하고 사용자 작업을 보존한다.
4. 시작 시점의 `git rev-parse HEAD`, 3101 process start time, `.next/BUILD_ID`와 관련 source 수정 시각을 기록한다.
5. 현재 request flow를 다음 순서로 추적한다.

```text
Operations Policy link
→ Audit Log filter normalization
→ Audit workspace API href
→ pagination/saved view/refresh/evidence href
→ Admin export proxy
→ API bucket where
→ screen and export rows
```

6. 관련 focused test baseline을 기록한다.
7. Phase 1→7 순서로 작업한다. **P0 scope가 고쳐지기 전에 visual polish만 완료 처리하지 않는다.**

## 7. Phase 1 — Full Audit scope 계약 수정 (P0)

### 확인된 root cause

현재 코드에서:

- `apps/admin_web/app/audit-log/page-content.tsx`의 `auditFilters`는 `bucket`을 읽는다.
- `auditHrefFromFilters`는 browser URL에만 `bucket`을 별도로 추가한다.
- workspace API와 export가 공유하는 `auditFilterParams`는 `bucket`을 누락한다.
- `apps/admin_web/app/api/admin/audit-log/export/route.ts`의 `EXPORT_FILTER_KEYS`도 `bucket`을 누락한다.
- API의 `adminAuditLogBucketWhere('Operations/Policy')`는 이미 `operational_policy.*` 범위를 지원한다.

### 구현 요구사항

- 하나의 normalized filter builder에서 `bucket`을 first-class filter/context로 처리한다.
- workspace items, summary, facets, pagination, saved view, refresh, drawer open/close가 같은 bucket을 보존한다.
- CSV/JSON href와 Admin export proxy가 bucket을 upstream API로 전달한다.
- export에는 cursor와 drawer-only `event` 상태를 계속 포함하지 않는다.
- `Open full audit` href를 다음 의미로 고정한다.

```text
/audit-log?bucket=Operations%2FPolicy&range=all&sort=newest
```

- active context strip/chip에 `Scope: Operations / Policy`를 표시한다.
- scoped 화면의 `Clear all`은 `Clear refinements`로 바꾸고 bucket은 유지한다.
- 별도의 `Exit policy scope`만 일반 `/audit-log`로 이동한다.
- URL에 bucket이 보이는 것만으로 통과하지 않는다. 실제 network request와 결과 action을 검증한다.
- screen rows와 CSV/JSON fixture rows가 모두 `operational_policy.*`인지 assertion한다.

### 필수 회귀 테스트

- workspace API href에 bucket 포함
- shareable URL, refresh, saved view, cursor와 evidence href가 bucket 보존
- export href와 export proxy upstream query에 bucket 포함
- scoped clear는 bucket 유지, exit는 bucket 제거
- API screen/export where가 동일한 `operational_policy.*` 범위 사용
- 범위 밖 Background Jobs/System incident fixture가 결과에서 제외

## 8. Phase 2 — Audit evidence와 양방향 cursor (P1)

### 8.1 실제 증거 연결

현재 `View details`는 `row.effect`만 열기 때문에 evidence action이 아니다.

- UI를 `Policy effect`와 `Audit evidence`로 분리한다.
- 주 action은 `Open evidence`로 만들고 기존 `audit-evidence-drawer.tsx`를 재사용한다.
- href는 다음 context를 모두 포함한다.

```text
/audit-log?bucket=Operations%2FPolicy&range=all&sort=newest&event=<audit-event-id>
```

- compact row와 drawer의 event ID가 반드시 일치해야 한다.
- evidence에는 사용 가능한 범위에서 다음을 보여준다.

```text
audit event ID
policy key/target
exact timestamp/effectiveAt
actor and verified source state
typed Before → After
reason
environment and runId
request/correlation ID when recorded
payload hash/integrity status when existing contract supports it
```

- compact row에 raw payload나 민감정보를 노출하지 않는다. 기존 redaction을 우회하지 않는다.
- legacy는 `source not recorded` 또는 inferred 상태를 명시하고 verified event처럼 승격하지 않는다.
- 반복 evidence link의 accessible name에 policy label과 exact time을 포함한다.

### 8.2 양방향 cursor

- 두 번째 이후 페이지에 `First page`, `Newer records`, `Older records`를 제공한다.
- browser Back에만 의존하지 않는다.
- 권장 구현은 source/sort와 결합된 opaque `previousCursor`/`nextCursor`다.
- 최소 구현으로 URL cursor history를 쓰면 길이를 제한하고 입력을 검증한다.
- source를 바꾸면 cursor/history를 초기화한다.
- invalid 또는 source-mismatched cursor는 명시적 오류나 안전한 first-page fallback으로 처리한다.
- `createdAt desc, id desc` 경계에서 중복·누락이 없어야 한다.

### 필수 회귀 테스트

- page 1 → older page 2 → newer page 1
- page 3 deep link → newer page 2 → first page
- 동일 timestamp 다중 ID에서 duplicate/skip 없음
- source 변경 시 cursor reset
- invalid/source mismatch 안전 처리
- drawer close 후 동일 scoped result 복귀

## 9. Phase 3 — Audit 1440px 밀도, active 상태와 empty copy (P1/P2)

### 9.1 compact row 재설계

범용 `.service-trace`를 920px로 압축하는 방식은 제거하고 Audit 전용 class를 사용한다.

권장 4열 구조:

| 열 | 내용 |
|---|---|
| When | relative time + exact ICT time |
| Policy & actor | canonical policy label, actor, verified source badge |
| Before → After | typed value, restoration/baseline 상태 |
| Evidence | reason 요약 + `Open evidence`, secondary `Policy effect` |

- table min-width는 약 1080~1160px를 출발점으로 실제 1440 content 폭에서 조정한다.
- Policy 영역은 최소 240~280px를 확보한다.
- `word-break: break-all` 또는 단어 중간 분리를 금지한다.
- reason/environment/provenance는 두 번째 줄 또는 evidence summary로 이동한다.
- 8건을 비교하기 위해 page size를 더 줄이는 방식으로 세로 문제를 숨기지 않는다.
- 행 전체를 늘리는 작은 마지막-cell `<details>` 구조를 피한다.

### 9.2 active 상태

- Policies/Supply/Simulation/Audit workspace와 Operator/Automated/Legacy source 모두 `aria-current="page"`를 유지한다.
- shared segmented-control 또는 현재 design token을 사용한다.
- selected와 inactive가 light/dark에서 computed background, border, font weight 또는 indicator로 실제 구분돼야 한다.
- focus-visible을 제거하지 않고 pointer 없이 모든 source/page action에 접근 가능해야 한다.

### 9.3 source별 empty copy

각 mode를 정확히 분기한다.

```text
Operator:
No operator policy change has been audited yet.

Automated smoke:
No server-verified automated smoke policy change is available.

Legacy / unknown:
No legacy or unclassified policy audit record is available.
```

- source, 조회 범위와 `Older available / End of history`를 함께 표시한다.
- API failure, permission denied와 true empty copy를 합치지 않는다.

## 10. Phase 4 — Policies 목록과 provenance (P1/P2)

### 10.1 첫 화면 밀도

- 독립 대형 `Policy workspaces` 카드는 page header 하단 compact segmented navigation으로 줄인다.
- `Policy attention` 5개 큰 tile은 한 줄 command strip으로 줄인다.
- `Current deviations 0`이면 성공 요약 한 줄만 보이고 deviation이 있을 때 상세를 확장한다.
- **1440×1000 첫 viewport에서 filter bar와 첫 그룹 최소 2개 정책 행을 보여야 한다.**
- 정보 제거가 아니라 우선순위 재배치다. 필요한 status와 count는 유지한다.

### 10.2 lifecycle 탐색

- 기존 alignment filter와 별도로 `Lifecycle: All / Live / Locked / Planned`를 제공한다.
- Live/Locked/Planned KPI count를 해당 filter의 진입점으로 만든다.
- `Status`는 baseline alignment, `Lifecycle`은 실행/편집 계약임을 문구와 구조에서 분리한다.
- filter URL은 deep-link 가능하고 다른 relevant filter를 보존한다.

### 10.3 source-aware provenance

현재 `Changed at least once`와 `Last changed`가 `updatedAt`만으로 사람의 변경처럼 보이지 않게 한다.

- 가능하면 API가 source-aware summary를 반환한다.
- 권장 분류: `Operator changed`, `Verified smoke`, `Legacy/unknown`, `Never changed`.
- 현재 값이 baseline으로 복원된 경우 `Restored to baseline`을 별도로 표시한다.
- API contract 변경이 과도하면 `Changed at least once`를 `Saved row exists`로 바꾸고 row source badge를 추가한다.
- “기록 존재”와 “현재 baseline 이탈”을 같은 의미로 사용하지 않는다.

### 10.4 lifecycle 문구

- `Live · aligned`를 `Live · baseline aligned`로 바꾼다.
- help text는 “current value equals launch baseline; this does not verify live supply or delivery” 의미를 전달한다.

## 11. Phase 5 — Policy editor 안전성과 구체적 영향 (P1)

### 11.1 Shift & Queue SLA 7개

- `policy-impact-details.ts`에 7개 Start Shift SLA key를 명시적으로 정의한다.
- 각 정책은 최소 다음을 설명한다.

```text
affected queue/lane
overdue 전환 시점
현재 unresolved count if available
기존 record의 createdAt/age 재계산 여부
변경이 다음 read부터 적용되는지 여부
```

- Live policy가 generic fallback을 사용하면 consistency test가 실패하게 한다.
- 문구는 runtime consumer를 코드에서 확인한 뒤 작성하며 추측하지 않는다.

### 11.2 dirty navigation interaction

source 문자열 검사만으로 완료하지 말고 실제 component/browser interaction matrix를 만든다.

| 상태 | 이동 | Cancel | Accept |
|---|---|---|---|
| dirty policy A | policy B | A와 입력값 유지 | B 기본값으로 reset |
| dirty policy A | Supply/Audit | A 유지 | 대상 workspace 이동 |
| dirty policy A | Close | form 유지 | form 닫힘 |
| dirty policy A | browser Back | A 유지 | 이전 route 이동 |

- pending save 중 navigation을 막는다.
- save success/error 후 guard 상태가 정확히 정리되는지 검증한다.
- 성공 audit link도 scoped evidence URL을 사용한다.
- 실제 브라우저 검증에서는 입력까지만 하고 Save/Revert를 제출하지 않는다.

## 12. Phase 6 — Supply와 Simulation polish (P2)

### Supply

- Blocked, no eligible Partner, Demo reference와 기본 접힘 disclosure는 유지한다.
- expanded sensitivity 상단에 결론을 한 번만 표시한다.
- row에는 `Eligible`, `Visible`, `Held`, `Excluded stale`, `Delta vs current` 중심만 남긴다.
- 모든 scenario가 0→0이면 `No scenario produces eligible supply` 그룹으로 축약한다.
- expanded header/table caption에 `Demo reference` 표식을 유지하여 긴 화면과 screenshot에서도 사라지지 않게 한다.

### Simulation

- current live data가 blocked라면 성공 결과를 꾸미지 않는다.
- fixture 또는 read-only test로 `ready=true`를 검증한다.
- current와 proposed가 같은 경우/다른 경우를 모두 검증한다.
- sample이 작으면 confidence warning을 표시한다.
- header에 Simulation은 write 없는 read-only preview임을 명시한다.

## 13. Phase 7 — 최신 build와 실제 화면 재검증 (P0)

재감사 당시 3101 production build는 관련 source보다 오래됐다. source 수정과 runtime 검증을 분리하지 않는다.

### 절차

1. 코드 수정과 focused test/typecheck/lint를 먼저 완료한다.
2. `npm.cmd run local:status`와 실제 port/process 정보를 기록한다.
3. repository script를 먼저 검토하고 프로젝트에 속한 3101 process만 안전하게 종료한다. unrelated Node process를 종료하지 않는다.
4. Admin Web production build를 생성한다.
5. 3101을 production mode로 재시작한다. repo script가 unrelated API baseline build 때문에 실패하면 원인을 기록하고, 이미 건강한 API를 유지한 채 Admin만 동일 env contract로 안전하게 재시작하는 최소 대안을 사용한다.
6. 다음 값을 구현 보고서에 기록한다.

```text
HEAD SHA
dirty worktree 여부
Admin BUILD_ID
BUILD_ID 생성 시각
operations-policy 관련 최신 source 수정 시각
3101 process start time
server mode/port
```

7. BUILD_ID 생성 시각과 process start time이 관련 source 수정 이후인지 확인한다.
8. browser cache에 의존하지 않는 fresh navigation으로 다시 캡처한다.

### Stop condition

실행 중인 3101 build가 최신 source와 일치한다는 증거가 없으면 UI 완료 또는 출시 가능이라고 표현하지 않는다.

## 14. 검증 명령

변경된 파일에 따라 정확한 범위를 조정하되 최소한 다음을 실행한다.

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- app/operations-policy app/audit-log app/api/admin/audit-log

npm.cmd run test --workspace @massage-vn/api -- src/admin/admin.service.spec.ts -t "operational policy"

npm.cmd run test --workspace @massage-vn/api -- src/admin/admin-operational-policy-audit-source.spec.ts src/matching/matching.policy.spec.ts

npm.cmd run policy:admin-consistency
npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run lint --workspace @massage-vn/admin-web -- app/operations-policy app/audit-log app/api/admin/audit-log
npm.cmd run build --workspace @massage-vn/admin-web
```

API contract를 변경했다면 추가로 실행한다.

```powershell
npm.cmd run typecheck --workspace @massage-vn/api
npm.cmd run verify:scope -- -Scope api
```

Admin 범위 검증은 최종적으로 실행한다.

```powershell
npm.cmd run verify:scope -- -Scope admin
```

### 알려진 baseline과 판정 규칙

재감사 시점 baseline:

- Admin Operations Policy + Audit focused: 52 files / 183 tests PASS
- API operational-policy focused: 6 PASS
- API audit source + matching: 2 files / 19 tests PASS
- policy consistency: 28 definitions, `19/2/7` PASS
- Admin typecheck와 focused lint PASS
- API 전체 typecheck는 `apps/api/src/bookings/bookings.backup-providers.ts:178` readonly array 오류
- `admin.service.spec.ts` 전체는 unrelated push campaign receipt `include`/`select` 기대 불일치 1건

기존 실패라고 자동 가정하지 말고 시작 baseline과 최종 결과를 비교하라. 이번 변경으로 생긴 오류는 반드시 해결한다. 범위 밖 기존 실패가 그대로라면 정확한 파일·오류와 in-scope 통과 여부를 분리해 보고하고, 그 오류까지 임의로 수정하지 않는다.

## 15. 실제 브라우저 검증 matrix

최신 production build의 로그인된 브라우저에서 비파괴로 확인한다.

1. 1440×1000 light — compact workspace/attention과 첫 정책 2행
2. 1440×1000 light — Lifecycle Live/Locked/Planned filter와 deep link
3. 1440×1000 light — normal editor와 7개 SLA 중 대표 policy의 구체적 impact
4. 1440×1000 light — high-risk editor, Save 활성 조건까지만 확인하고 미제출
5. 1440×1000 light — Locked/Planned direct URL read-only
6. 1440×1000 light — dirty form 정책 전환 Cancel/Accept, 미제출
7. 1440×1000 light — Supply blocked/default와 expanded diagnostic
8. 1440×1000 light — Simulation blocked; ready fixture는 test로 보완
9. 1440×1000 light — Operator/Automated/Legacy source와 source별 empty copy
10. 1440×1000 light — Legacy first/older/newer/first cursor 왕복
11. 1440×1000 light — scoped Full Audit와 정확한 event evidence drawer
12. 1440×1000 dark — workspace/source active 상태와 audit table
13. 1920×1080 light — editor breakpoint와 audit table balance
14. console error/warning, failed network request와 page horizontal overflow

Full Audit는 URL 문자열만 확인하지 말고 network query와 실제 row event type을 함께 검증한다. 실제 export download가 민감정보를 만들 수 있으면 browser download 대신 fixture/API/export route test로 내용을 검증하고 href/upstream query만 화면에서 확인한다.

## 16. 산출물

다음을 새로 생성한다.

```text
Implementation report:
docs/audits/operations-policy-post-remediation-release-hardening-implementation-2026-08-14.md

Screenshot evidence:
docs/audits/operations-policy-post-remediation-release-hardening-evidence-2026-08-14/
```

구현 보고서에는 다음을 포함한다.

- 한 줄 결론과 완료/보류 판정
- P0/P1/P2별 실제 변경 사항
- 변경 파일과 핵심 symbol
- Full Audit filter data-flow 전후 비교
- screen/API/export가 같은 scope임을 증명하는 테스트와 실제 결과
- cursor 왕복과 event drawer 검증 결과
- Policies/editor/Supply/Simulation의 수정 결과
- 1440/1920 light/dark screenshot 목록
- test/typecheck/lint/build 명령과 PASS/FAIL/SKIP
- HEAD SHA, BUILD_ID, source/build/process 시각
- browser console/network 결과
- protected area 변경 여부
- 남은 제한과 별도 후속 작업
- 사용자 dirty worktree를 보존했다는 확인

dead Operations Policy module 정리는 이번 critical diff에 섞지 않는다. production import graph를 확인한 후보와 삭제 영향만 구현 보고서의 별도 appendix로 남긴다. 실제 삭제는 별도 승인·별도 작업으로 수행한다.

## 17. 최종 응답 형식

최종 답변은 다음 순서로 작성한다.

1. 완료/보류 판정과 가장 중요한 결과
2. P0/P1/P2 변경 요약
3. 검증 명령과 PASS/FAIL/SKIP
4. 최신 runtime의 BUILD_ID/시각 증거
5. report와 screenshot 폴더 링크
6. 남은 위험 또는 차단 사유
7. 변경 파일과 protected area 여부

분석만 했거나 일부 test만 통과했거나 최신 build를 실제 브라우저에서 보지 못한 상태를 “완료”라고 표현하지 않는다.

## 18. Stop rules

- screen, API와 export가 같은 policy bucket 결과를 내지 않으면 완료하지 않는다.
- 범위 밖 audit action이 한 건이라도 scoped 결과에 섞이면 P0 미완료다.
- compact row와 evidence drawer event ID가 다르면 완료하지 않는다.
- cursor duplicate/skip 또는 source boundary 누출 가능성이 남으면 해당 항목을 미완료로 표시한다.
- Live policy가 generic impact fallback을 사용하면 완료하지 않는다.
- 실제 정책 저장이나 운영 데이터 mutation 없이 검증할 수 없는 항목은 mock/fixture로 전환한다.
- 최신 BUILD_ID와 process start 증거가 없으면 출시 가능 판정을 내리지 않는다.
- schema, auth, payment, wallet, booking, settlement 또는 matching behavior 변경이 필요하면 범위를 확장하지 말고 근거와 최소 대안을 보고한다.
- unrelated failure는 숨기지 말고 baseline과 이번 회귀를 분리한다.
- required report와 screenshot evidence가 준비된 뒤에만 최종 응답한다.

## 최종 작업 지시

지금부터 현재 코드와 실행 상태를 다시 확인하고 Phase 1부터 순서대로 실제 수정하라. 가장 먼저 `Open full audit`의 링크, normalized filter, workspace API, export proxy와 API bucket where를 하나의 data-flow로 추적하여 `Operations/Policy` scope 유실을 해결한다. 그다음 실제 event evidence, 양방향 cursor, 1440px audit 구조, lifecycle/provenance, Shift SLA impact, dirty navigation과 Supply/Simulation polish를 구현한다. 마지막에는 반드시 최신 production build를 3101에서 실행하고 1440px 이상 실제 화면·network·console·BUILD_ID 증거로 검증한 뒤 구현 보고서를 남겨라.
