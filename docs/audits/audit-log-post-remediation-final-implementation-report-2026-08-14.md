# Audit Log post-remediation implementation report

검증 실행일: 2026-08-15 (Asia/Bangkok)  
대상: HANDS Admin `/audit-log`  
저장소: `C:\dev\massage-on-demand-vn`

## 1. 결과 요약

재감사에서 확인된 출시 차단 데이터 문제는 코드와 집중 회귀 테스트에서 해소했다.

- schema v2의 저장된 `area`, `severity`, `outcome`, `actorType`을 canonical classification으로 사용한다.
- schema v2의 `UNKNOWN`을 legacy 추론으로 덮어쓰지 않는다.
- schema v1에만 action 기반 legacy 추론을 적용한다.
- row, facet, filter, saved view, CSV/JSON export가 같은 effective classification predicate를 사용한다.
- `bucket`과 Audit Log query key를 workspace, refresh, clear, pagination, drawer, export에서 공유한다.
- 반복 job 실패의 원시 등록 이벤트와 현재 조치가 필요한 incident를 분리했다.
- source freshness는 검색어와 classification filter에 따라 변하지 않는다.
- keyset pagination에 `Previous`를 추가했다.
- Evidence drawer의 증거 식별 정보와 키보드 동작을 보강했다.

집중 테스트, typecheck, production build, 최신 로컬 프로세스와 핵심 브라우저 흐름은 통과했다. 저장소 전체 scope 검증은 이번 변경과 무관한 기존 테스트/린트 실패 때문에 종료 코드 1이며, 세부 내용은 아래에 분리했다.

## 2. 변경 파일과 이유

### API

- `apps/api/src/admin/admin-audit-event-registry.ts`
  - canonical/legacy classification 경계, 공통 filter predicate, review-level 제외 규칙, Finance Approver action 분류를 정의했다.
- `apps/api/src/admin/admin-audit-event-registry.spec.ts`
  - v2 UNKNOWN 보존, v1 legacy 추론, canonical where, Finance Approver 분류 회귀를 검증한다.
- `apps/api/src/admin/admin.service.ts`
  - canonical facet/filter/saved-view 집계, source freshness 독립 scope, Previous cursor, actionable incident projection, Finance Approver writer를 연결했다.
- `apps/api/src/admin/admin.service.spec.ts`
  - facet parity, freshness, Previous cursor, 현재 열린 incident projection 및 저장 분류를 검증한다.
- `apps/api/src/admin/admin-background-jobs.service.ts`
  - 신규 원시 `failure_registered`를 `INFO / RECORDED`로 기록하고 lifecycle incident는 `REVIEW / OPENED`로 유지한다.
- `apps/api/src/admin/admin-background-jobs.service.spec.ts`
  - 원시 이벤트와 조치 대상 incident의 분리를 검증한다.

### Admin Web

- `apps/admin_web/app/audit-log/audit-log-query.ts`
  - Audit Log query key를 한 곳에서 관리한다.
- `apps/admin_web/app/audit-log/page-content.tsx`
  - actionable incident, Review-level event, Previous, scope-preserving control과 4열 advanced filter를 제공한다.
- `apps/admin_web/app/audit-log/audit-log-table-section.tsx`
  - 행마다 고유한 Evidence accessible name을 제공한다.
- `apps/admin_web/app/audit-log/audit-evidence-drawer.tsx`
  - Actor/Object ID, recorded time, schema version, integrity 및 copy action을 노출하고 body scroll lock을 복원한다.
- `apps/admin_web/app/api/admin/audit-log/export/route.ts`
  - 화면과 동일한 canonical query/bucket scope로 CSV/JSON export를 프록시한다.
- `apps/admin_web/lib/admin-api.ts`
  - actionable incident와 Previous cursor response contract를 반영한다.
- `apps/admin_web/app/globals.css`
  - incident row, advanced filter 4열, drawer/desktop layout을 정리했다.
- 인접 `*.spec.ts(x)`
  - query scope, export, incident, pagination, drawer 접근성, 1440px CSS contract를 고정한다.

## 3. Canonical classification과 legacy 처리

schema v2는 저장된 분류가 권위다. 저장값이 `UNKNOWN`, `INFO`, `UNKNOWN`이어도 action 문자열로 재분류하지 않는다. 이는 row와 facet이 서로 다른 숫자를 보여주던 원인을 제거한다.

schema v1만 action registry 기반으로 effective classification을 파생한다. canonical row와 legacy row의 조건을 명시적인 OR branch로 구성해 facet, filter, saved view와 export가 동일하게 동작한다. `RECORDED`와 `UNKNOWN`에 화면 전용 예외 처리는 넣지 않았다.

운영 위험:

- 기존 schema v2 Finance Approver UNKNOWN 기록 9건은 증거 불변성을 위해 수정하거나 backfill하지 않았다.
- 앞으로 생성되는 Finance Approver action은 registry를 통해 `SECURITY` 및 실제 outcome으로 저장된다.
- 과거 v2 데이터 수정이 필요하면 별도 승인된 correction event/backfill 정책이 필요하다.
- rollback은 registry/service/UI 변경을 함께 되돌려야 한다. 일부만 되돌리면 row/facet parity가 다시 깨질 수 있다.

## 4. Bucket과 query-key contract

canonical key는 `q`, `area`, `outcome`, `actorType`, `severity`, `objectType`, `eventId`, `correlationId`, `requestId`, `from`, `to`, `targetPrefix`, `bucket`이다.

- workspace, refresh, clear filters, saved view, Previous/Next, row link, drawer download, CSV/JSON export가 같은 key set을 사용한다.
- Clear filters는 현재 `bucket`을 보존한다.
- `Operations/Policy` 브라우저 검증에서 화면 scope, export URL, row link와 drawer download가 동일한 bucket을 유지했다.
- source freshness는 date/bucket scope만 사용하며 검색어나 classification filter로 바뀌지 않는다.

## 5. Recurring incident projection

`admin.background_jobs.failure_registered`는 원시 관측 기록이고, `incident.opened`/`incident.resolved`는 운영 lifecycle이다.

- 새 원시 등록 이벤트: `SYSTEM / INFO / RECORDED`
- 현재 조치 대상: 최신 lifecycle이 `OPENED`인 incident만 projection
- 해결된 incident는 Action required에서 제외
- Review-level event view에서는 반복 원시 등록 이벤트를 제외하지만 원본 Audit Log에서 삭제하거나 숨기지 않는다.

현재 projection은 최근 lifecycle 500건을 읽어 최신 상태를 계산한다. 한 번에 500건을 초과하는 서로 다른 incident lifecycle이 쌓이면 오래된 미해결 incident가 누락될 수 있어 후속 pagination/집계 검토가 필요하다.

## 6. DB read-only before/after

작업 전 read-only 조사:

| 구분 | 건수/관찰 |
| --- | --- |
| schema v1 | 49,981 |
| schema v2 | 688 |
| v2 area | OPERATOR 3, SECURITY 10, SYSTEM 637, UNKNOWN 38 |
| v2 severity | INFO 51, NOTICE 5, REVIEW 632 |
| v2 outcome | SUCCEEDED 2, SKIPPED 1, OPENED 5, RESOLVED 5, RECORDED 637, UNKNOWN 38 |
| v2 actor | HUMAN 51, SYSTEM 637 |
| raw recurring failure registrations | 627 |
| legacy Finance Approver UNKNOWN rows | 9 |

작업 중 DB row를 수정하거나 삭제하지 않았다. 따라서 저장 수치의 before/after는 동일하다. 변경 후의 차이는 조회 의미와 신규 writer 계약이다.

- 브라우저에서 Area UNKNOWN facet과 결과가 342건으로 일치했다.
- Outcome RECORDED facet/결과는 검증 중 background write에 따라 4,468~4,469건으로 함께 증가했다.
- Review-level view는 761건을 표시했고 반복 원시 registration이 아니라 실제 stale `OPENED / REVIEW` queue가 선두에 표시됐다.
- 새 background registration은 `RECORDED / INFO / SYSTEM`으로 확인했다.

## 7. 실행 명령과 결과

### 집중 검증

- `npm.cmd run test --workspace @massage-vn/admin-web -- app/audit-log app/api/admin/audit-log/export/route.spec.ts`
  - PASS: 8 files, 38 tests.
- API Audit/Background/Registry focused specs
  - PASS: 5 files, 127 tests, 613 skipped by name filter.
- `apps/api/src/admin/admin.service.spec.ts` Audit Log focused rerun
  - PASS: 72 tests, 613 skipped by name filter.
- `npm.cmd run typecheck --workspace @massage-vn/admin-web`
  - PASS.
- `npm.cmd run typecheck --workspace @massage-vn/api`
  - PASS.
- Admin production build
  - PASS.
- API production build
  - PASS.
- 관련 파일 `git diff --check`
  - PASS. LF/CRLF 안내만 있으며 whitespace error는 없다.

### Scope verification

- `npm.cmd run verify:scope -- -Scope admin`
  - build/typecheck/static guards PASS.
  - 기존 실패 3건: `admin-surface-css.spec.tsx` 중복 notice CSS contract, `admin-navigation.spec.ts` company bank account visibility, `finance-closeout/page.spec.tsx` 시간 의존 70d/74d.
  - 기존 lint 실패 1건: `operations-policy-form.tsx:83`의 `react-hooks/set-state-in-effect`.
  - 최종 exit 1.
- `npm.cmd run verify:scope -- -Scope api`
  - typecheck/lint/build/contracts PASS.
  - 기존 실패 1건: `admin.service.spec.ts:34181` manual push campaign의 `include` 기대와 현재 `select` 구현 차이.
  - 최종 exit 1.

위 실패 파일은 이번 Audit Log 변경 파일에 포함되지 않으며 assertion을 약화하거나 기존 변경을 되돌리지 않았다.

## 8. Build와 실행 프로세스 freshness

- Git base SHA: `406d16a7919c500f7b098f98bd43e83b0cad3c35`
- Git base commit time: `2026-08-11T08:38:45+07:00`
- working tree: Audit Log 변경 미커밋 상태
- latest local production process start: `2026-08-15T00:27:27.9344536+07:00`
- API source updated: `2026-08-14T17:19:55.9604676Z`
- API dist updated: `2026-08-14T17:36:48.9304971Z`
- API build freshness: `fresh`
- API health: HTTP 200
- Admin: HTTP 200

SHA는 dirty working tree 이전의 base commit이며 현재 검증한 소스 전체를 식별하는 commit hash가 아니다.

## 9. 브라우저 검증

검증 폴더:

`C:\dev\massage-on-demand-vn\docs\audits\audit-log-post-remediation-final-verification-evidence-2026-08-14`

| 화면 | 결과 | 증거 |
| --- | --- | --- |
| All records 1440x1000 | scope, freshness, incidents, rows 정상; 가로 overflow 없음 | `01-all-records-1440.png` |
| More filters 1440x1000 | 4열, 각 control 조작 가능; overflow 없음 | `02-advanced-filters-1440.png` |
| Area UNKNOWN 1440x1000 | facet 342와 filtered total 일치 | `03-unknown-classification-1440.png` |
| Outcome RECORDED 1440x1000 | canonical result와 facet 일치; 신규 INFO row 확인 | `04-recorded-outcome-1440.png` |
| Evidence drawer 1440x1000 | 증거 필드/copy/download, Escape, focus return, body lock 정상 | `05-evidence-drawer-1440.png` |
| Second page 1440x1000 | Previous/First/Next 표시; filter 보존 후 첫 페이지 복귀 | `06-second-page-previous-1440.png` |
| Operations/Policy 1600x1000 | 1,325건 scoped 결과, scope-preserving 링크/export 정상 | `07-operations-policy-scope-1600.png` |
| Review-level 1600x1000 | 761건, raw recurring registrations 제외, current OPENED incident 표시 | `08-review-level-1600.png` |

검증한 화면에서는 browser console error/warning이 없었다. 1440/1600 모두 전체 페이지 가로 스크롤이 없었고 advanced filter와 drawer가 읽기 가능한 상태였다.

## 10. 미해결 위험과 다음 작업

- 이번 세션에는 `Security & access`, `Money & policy`, 추가 bucket 2개, 고유 검색어 empty state, dark mode 1600의 별도 캡처가 없다. 핵심 contract는 테스트되었지만 최종 릴리스 체크리스트상 수동 브라우저 증거가 남아 있다.
- CSV/JSON의 bucket-preserving URL과 route contract는 브라우저/테스트로 확인했지만 다운로드 파일의 row-count header를 브라우저에서 별도로 기록하지 않았다.
- actionable incident projection의 500 lifecycle row 상한은 위에서 설명한 누락 위험이 있다.
- 역사적 v2 UNKNOWN Finance Approver 9건은 증거 보존을 위해 그대로 남아 있다.
- 저장소 전체 scope의 기존 실패 5건과 lint 1건 때문에 전체 green 상태는 아니다.

다음 작업은 위 미캡처 브라우저 시나리오와 export header를 동일한 최신 production build에서 확인한 뒤, 별도 승인된 경우에만 역사적 Finance Approver correction 정책을 결정하는 것이다.

## 11. 보호 영역과 기존 변경

- Prisma schema/migration, 인증, 권한 guard, 결제/정산 mutation은 변경하지 않았다.
- DB는 read-only로 조사했고 기존 audit event를 수정하거나 삭제하지 않았다.
- 대규모 dirty worktree와 관련 없는 untracked 파일을 보존했다.
- commit, push, 배포는 수행하지 않았다.
