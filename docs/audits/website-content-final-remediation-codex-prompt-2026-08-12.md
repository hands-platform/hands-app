# HANDS Admin Website Content 최종 보완 구현 프롬프트

아래 전체 내용을 새 Codex 작업에 그대로 전달한다. 이 문서는 재분석이나 조언만 요청하는 프롬프트가 아니다. 2026-08-12 최종 재감사에서 확인된 문제를 실제 코드, 데이터 계약, 운영 화면, 테스트와 브라우저 검증까지 수정하기 위한 실행 지시서다.

---

## 1. 역할과 최종 목표

너는 HANDS의 공개 웹 콘텐츠와 관리자 CMS를 출시 가능한 상태로 마무리하는 시니어 풀스택 엔지니어이자 운영형 제품 디자이너다.

대상 화면:

```text
http://localhost:3101/website-content
```

이 화면의 실제 사용자는 프로그래머가 아니라 **혼자 사이트 콘텐츠를 관리하는 운영자**다. 운영자는 다음 사실을 화면에서 믿을 수 있어야 한다.

1. 관리자에 표시되는 페이지 경로와 실제 공개 웹 경로가 일치한다.
2. `Live`, `Draft`, `검증 필요`, `게시 차단`, `번역 누락` 수치가 현재 탭과 필터 범위에 맞다.
3. CMS가 관리하는 페이지와 코드 폴백이 제공하는 페이지를 구분할 수 있다.
4. 입력 오류·네트워크 오류·동시 수정이 발생해도 작성 내용을 잃지 않는다.
5. 게시 불가 상태에서는 어떤 UI 우회로도 게시 확인 단계에 들어갈 수 없다.
6. 게시 전에 Live와 Draft의 실제 변경 내용과 방문자 영향을 확인할 수 있다.
7. 첫 게시 직후 심각한 문제가 생겨도 안전하게 비공개로 전환할 수 있다.
8. 삭제·게시·rollback·take offline의 실행자, 사유, 대상과 결과를 추적할 수 있다.
9. 5개 언어의 번역 누락과 원문보다 오래된 번역을 한눈에 찾을 수 있다.
10. 1440px 이상 화면에서 목록, 폼, 섹션 편집기가 운영 순서대로 읽히고 불필요한 빈 공간이 없다.

감사 당시 점수는 **68/100, 정식 출시 보류**였다. 점수를 겉으로 높이거나 카드 디자인만 바꾸는 것이 목표가 아니다. 아래의 출시 게이트가 실제 데이터 계약, 코드, 테스트, 브라우저 화면에서 충족돼야 완료다.

구현 우선순위는 반드시 다음 순서를 따른다.

```text
route manifest·DB·public resolver 정합성
→ CMS/코드 폴백 소유권
→ readiness·summary 데이터 신뢰성
→ 입력 오류 복구·게시/삭제 안전
→ 운영자 중심 1440px+ UI
→ 번역·미디어·감사 효율
```

## 2. 작업 위치와 기준 자료

- 저장소: `C:\dev\massage-on-demand-vn`
- 기준 감사 보고서: `C:\dev\massage-on-demand-vn\docs\audits\website-content-final-reaudit-2026-08-12.md`
- 화면·DOM·경로 증거: `C:\dev\massage-on-demand-vn\docs\audits\website-content-final-reaudit-evidence-2026-08-12\`
- 저장소 지침: `C:\dev\massage-on-demand-vn\AGENTS.md`

시작 전에 `AGENTS.md`와 기준 감사 보고서를 끝까지 읽는다. 보고서 요약만 읽지 말고 P1/P2 발견, 코드 근거, 운영 문구, 수용 기준, 테스트 공백을 모두 확인한다.

특히 다음 근거를 직접 연다.

```text
01-pages-directory-1600x1000.png
02-news-directory-1600x1000.png
03-new-article-1600x1000.png
04-new-page-1600x1000.png
05-detail-overview-1600x1000.png
07-section-editor-1600x1000.png
08-section-editor-lower-1600x1000.png
09-seo-publishing-1600x1000.png
10-activity-1600x1000.png
11-delete-confirmation-1600x1000.png
12-pages-directory-dark-1600x1000.png
14-invalid-article-recovery-1600x1000.png
15-route-inventory.json
```

감사 시점의 수치는 다음과 같지만, 구현 전에 현재 DB와 소스를 다시 읽어 변동 여부를 확인한다.

```text
현재 관리자 목록: 17 route groups / 85 locale pages
소스 bootstrap manifest: 34 route groups / 170 locale pages
현재 Live: 0
현재 Draft changes: 85
현재 Needs attention: 85
현재 legacy readiness UNKNOWN: 85
```

위 수치를 테스트 fixture처럼 하드코딩하지 않는다. 현재 상태를 읽고 차이를 구조적으로 계산해야 한다.

## 3. 작업 방식과 안전 경계

- `AGENTS.md`에 따라 단일 에이전트로 작업한다. subagent, worker, handoff agent를 사용하지 않는다.
- 먼저 실행 계획을 세우되 계획만 제출하고 멈추지 말고, 안전한 범위의 코드 구현과 검증까지 계속한다.
- 시작 시 `git status --short`를 기록한다.
- dirty worktree의 기존 변경은 사용자 작업이다. 관련 없는 파일을 revert, reset, cleanup, 이동, 일괄 포맷하지 않는다.
- 관련된 가장 좁은 공통 계약을 수정한다. caller마다 임시 조건문을 복제하지 않는다.
- 기존 Next.js/NestJS/Prisma 구조와 Admin 컴포넌트·토큰을 우선 재사용한다.
- 새 UI framework, CMS framework, workflow engine, state management library, 번역 SaaS를 추가하지 않는다.
- 실제 운영 콘텐츠를 임의로 게시, 삭제, take offline, rollback하지 않는다.
- 실제 DB의 17→34 route migration 또는 85개 readiness 일괄 갱신은 **dry-run까지만 수행**한다. apply에는 사용자의 명시적 승인이 필요하다.
- destructive migration, 기존 Live/Draft revision 삭제, 코드 폴백 일괄 제거를 승인 없이 수행하지 않는다.
- migration은 작성할 수 있지만 공유·원격·운영 DB에 임의 적용하지 않는다. 로컬 격리 DB 또는 테스트 DB에서 검증한다.
- 브라우저 검증 중 실제 페이지를 publish/delete/take offline하지 않는다. 테스트 fixture 또는 격리된 로컬 데이터만 사용한다.
- `schema.prisma`, migrations, shared contracts 등 보호 영역을 변경하면 `AGENTS.md`의 강화 검증을 수행한다.
- 서버 재시작이 필요하면 해당 포트 PID와 command line을 먼저 확인한다. 모든 `node.exe`를 일괄 종료하지 않는다.
- 화면 구현과 보고서는 **1440×1000과 1600×1000 데스크톱만** 대상으로 한다. 1024px 이하 UI는 작업·검수·보고에서 제외한다.
- 사용자 요청 없이 commit하지 않는다.
- 완료하지 못한 항목은 성공으로 포장하지 않는다. blocker, 코드 근거, 출시 영향을 최종 보고서에 남긴다.

UI 작업은 Impeccable의 **Operate 모드**로 다룬다. 장식보다 정보 신뢰성, 작업 우선순위, 오류 복구, 키보드 접근성, 위험 작업의 안전성을 우선한다. 기존 HANDS Admin의 시각 언어와 공통 컴포넌트를 유지한다.

## 4. 이미 잘된 부분과 반드시 보존할 기능

다음 기반은 이전 개선으로 좋아졌다. 제거하거나 약화하지 않는다.

- Pages와 News의 작업 영역 분리
- 경로 그룹×KO/EN/VI/JA/ZH 매트릭스
- 서버 검색·필터·페이지네이션
- Overview / Content / SEO & Publishing / Activity 작업 공간
- Draft / Live / Archived revision 모델
- optimistic version 검사
- 서버 publish readiness 검증
- 버전·만료가 바인딩된 서명 preview token
- `CONTENT_VIEW`, `CONTENT_EDIT`, `CONTENT_PUBLISH`, `CONTENT_DELETE` 권한 분리
- publish, rollback, discard, delete 감사 이벤트
- 빈 상태와 API 오류 상태를 구분하는 구조
- 라이트·다크 테마의 공통 정보 구조
- 삭제 확인창의 Cancel 초기 포커스
- 상세 진입 전 section body를 불필요하게 전부 읽지 않는 현재 데이터 로딩 방향

이번 수정으로 위 기능이 회귀하지 않도록 기존 테스트를 유지하고 필요한 테스트를 확장한다.

## 5. 수정 전 필수 진단

코드를 변경하기 전에 아래를 수행하고 구현 보고서에 baseline을 남긴다.

1. 감사 보고서와 증거를 읽는다.
2. 현재 `/website-content`를 1440×1000과 1600×1000에서 확인한다.
3. Pages, News, New page, New article, detail의 네 작업 공간, section editor, delete confirm을 확인한다.
4. 현재 route inventory를 DB와 API 양쪽에서 다시 집계한다.
5. route 구조가 선언된 모든 위치를 `rg`로 찾고 표로 만든다.
6. public route resolver가 실제 URL을 어느 CMS template path로 바꾸는지 확인한다.
7. CMS가 없을 때 렌더링되는 모든 코드 폴백 경로를 목록화한다.
8. 모든 `adminSummary()` caller와 쿼리 범위를 확인한다.
9. 모든 Website Content server action의 실패·409·403·validation 흐름을 확인한다.
10. publish, rollback, discard, delete, preview, readiness 구현과 테스트를 읽는다.
11. baseline focused tests와 typecheck를 실행한다.

우선 확인할 파일:

```text
apps/admin_web/app/website-content/page.tsx
apps/admin_web/app/website-content/actions.ts
apps/admin_web/app/website-content/website-content-types.ts
apps/admin_web/app/website-content/website-content-pagination.ts
apps/admin_web/app/website-content/*.spec.ts*
apps/admin_web/components/admin-form-controls.tsx
apps/admin_web/app/globals.css

apps/api/src/site-content/site-content.service.ts
apps/api/src/site-content/site-content.controller.ts
apps/api/src/site-content/*.spec.ts
apps/api/src/admin/admin.dto.ts
apps/api/src/admin/admin.controller.ts
apps/api/src/admin/admin-operator-category.guard.ts
apps/api/prisma/schema.prisma
apps/api/prisma/migrations/**

apps/public_web/app/[locale]/[[...slug]]/page.tsx
apps/public_web/lib/site-content.ts
apps/public_web/lib/site-content.spec.ts
apps/public_web/components/public-site-section.tsx
apps/public_web/components/public-site-section.spec.tsx

infra/scripts/bootstrap-public-site-structure.mjs
infra/scripts/**public*site*
```

진단 결과로 보고서의 수치가 달라졌다면 현재 코드·DB 근거를 사용하되, 왜 달라졌는지 구현 보고서에 적는다. 진단만 하고 멈추지 말고 아래 Phase 1부터 구현을 계속한다.

---

## Phase 1 — 출시 게이트: route manifest와 실제 제공 페이지를 일치시킨다

### 1.1 단일 route manifest 계약

#### 현재 문제

- 감사 당시 DB에는 17개 route group만 있었지만 bootstrap에는 34개가 선언돼 있었다.
- DB에는 `/partners/[city]/[slug]`가 있었지만 public resolver는 `/partners/[city]/[district]`와 `/partners/[city]/[district]/[slug]`를 사용한다.
- route 정의와 public mapping, completeness 집계가 서로 다른 정보를 사용한다.

#### 구현 계약

1. MAIN과 PARTNER_RECRUITMENT의 route path, site, required locales, section template, public template path를 하나의 타입 안전 manifest에서 관리한다.
2. bootstrap/migration, API completeness summary, public route resolver의 contract test가 이 manifest와 같은 route key를 사용하게 한다.
3. 서버와 public web 사이에 런타임 패키지 공유가 오히려 결합을 키우면, 하나의 canonical data file과 각 consumer의 validated loader를 사용한다. 불필요한 새 패키지를 만들지 않는다.
4. route key는 최소 `site + locale + normalized path`로 유일해야 한다.
5. dynamic route의 placeholder 이름과 순서를 정확히 검증한다.
6. manifest에 없는 기존 DB route를 자동 삭제하지 말고 `STALE_ROUTE` 후보로 분류한다.
7. manifest에 있고 DB에 없는 route는 `MISSING_ROUTE`로 분류한다.
8. 같은 route가 중복 선언되면 build/test가 실패해야 한다.

#### 필수 테스트

- manifest route 중복 0개
- required locale 조합 누락 0개
- public resolver가 생성하는 template path가 manifest route와 일치
- `/partners/[city]/[district]` 및 상세 route 일치
- stale `/partners/[city]/[slug]`가 명시적 migration 후보로 검출됨
- manifest 변경 시 bootstrap과 completeness가 동시에 깨지는 contract test

### 1.2 revision-aware, idempotent bootstrap/migration

#### 현재 문제

현재 bootstrap은 legacy `PublicSitePage.sections` 생성 방식을 사용하고 `PublicSitePageRevision`, `draftRevisionId`를 만들지 않는다. 그대로 실행하면 목록에는 있지만 편집·preview·readiness 평가가 불가능한 페이지가 생길 수 있다.

#### 구현 계약

1. 기존 bootstrap을 현재 revision 모델과 호환되게 수정하거나, 더 안전하면 새 migration script로 대체하고 legacy script는 명확히 deprecated 처리한다.
2. 신규 route는 page + Draft revision + draftRevisionId + revision sections를 하나의 transaction에서 생성한다.
3. 기존 정상 revision-backed route는 내용과 revision을 덮어쓰지 않는다.
4. 기존 legacy page는 현재 데이터 snapshot을 보존한 채 revision-backed Draft로 이관한다.
5. Live route가 있다면 active revision을 변경하거나 Draft를 자동 publish하지 않는다.
6. 두 번 실행해 두 번째 실행의 변경 건수가 0인 idempotent 동작을 보장한다.
7. 기본 실행은 dry-run이며 DB에 쓰지 않는다.
8. dry-run 결과에는 다음 분류와 exact ID/path를 기록한다.

```text
KEEP
CREATE
BACKFILL_REVISION
MOVE_ROUTE
STALE_ROUTE
CONFLICT
BLOCKED
```

9. apply는 reviewed manifest checksum, 환경 식별, 명시적 confirmation을 요구한다.
10. 이 작업에서는 실제 공유/운영 데이터 apply를 실행하지 않는다.

#### 완료 기준

- dry-run에서 route×locale expected/actual 차이가 설명된다.
- 격리 테스트 DB에서 생성된 모든 route가 편집·preview·readiness 평가 가능하다.
- 재실행 변경 0건.
- 기존 revision/section/content가 손실되지 않는다.
- conflict는 조용히 덮어쓰지 않고 실패한다.

### 1.3 CMS/코드 폴백 소유권 계약

#### 현재 문제

관리자 Live가 0이어도 public web의 코드 폴백 페이지가 방문자에게 보일 수 있다. 운영자는 CMS 수정이 실제 페이지를 바꾸는지 알 수 없다.

#### 구현 계약

각 route에 다음 중 하나의 파생 소유권 상태를 제공한다.

```text
CMS_LIVE
CODE_FALLBACK
NOT_SERVED
OWNERSHIP_CONFLICT
```

1. 목록과 상세에서 사람이 읽는 문구로 제공 방식을 표시한다.
2. 최초 CMS publish가 코드 폴백을 대체한다면 게시 확인에 경고한다.
3. `Open Live page`가 실제로 열 페이지의 소유권을 표시한다.
4. cutover는 `preview 확인 → 링크/SEO 검증 → publish → public result 확인 → fallback 제거 후보` 단계로 기록한다.
5. CMS publish만으로 코드 폴백 소스를 자동 삭제하지 않는다.
6. fallback 제거는 별도 명시적 코드 변경으로 처리한다.
7. CMS fetch 실패와 CMS page 없음은 구분한다. 일시적 API 실패가 예기치 않게 폴백 콘텐츠를 노출하는 정책인지 명확히 테스트한다.

---

## Phase 2 — readiness와 지표를 신뢰할 수 있게 만든다

### 2.1 레거시 `UNKNOWN` 일괄 재평가

1. 현재 readiness evaluator를 pure function 또는 재사용 가능한 service method로 만든다.
2. 모든 Draft를 읽어 `READY`, `BLOCKED`, `UNKNOWN`을 dry-run으로 재평가한다.
3. `UNKNOWN`을 단순히 READY로 바꾸지 않는다. 실제 title/body/section/SEO/path 조건을 평가한다.
4. 결과는 page ID, site, locale, path, 이전 상태, 새 상태, issue codes를 포함한다.
5. apply는 별도 확인을 요구하며 audit metadata를 남긴다.
6. 신규·편집 저장은 readiness를 항상 재계산한다.
7. legacy Draft를 한 번 열고 저장해야만 상태가 생기는 현재 의존을 제거한다.

완료 기준은 실제 데이터 rollout 전 dry-run에서 **설명 없는 UNKNOWN이 0건**인 것이다. 사용자 승인 전 DB apply는 하지 않는다.

### 2.2 view/filter-scoped summary

1. summary 입력에 `contentType`, `site`, `locale`, `readiness`, `query` 범위를 명시한다.
2. Pages와 News가 서로의 수치를 공유하지 않는다.
3. News 0개라면 기사 전용 Live/Draft/Blocked/Recently published도 정확히 0 또는 실제 기사 수치여야 한다.
4. 전역 지표를 별도로 유지하면 `전체 Pages 기준`처럼 범위를 UI에 표시한다.
5. `missingTranslations`는 기존 행 개수만 세지 말고 manifest route×required locale matrix와 비교한다.
6. 다음을 구분해서 집계한다.

```text
Ready
Blocked
Needs validation
Missing route
Missing translation
Stale translation
Recently published
```

7. 지표 클릭 시 같은 scope의 필터된 목록으로 이동한다.
8. 필터 결과와 전역 요약을 혼합해 보여주지 않는다.

### 2.3 summary 성능

1. 현재 목록 렌더의 DB query 수와 응답 시간을 측정한다.
2. Pages/News 목록마다 전역 집계를 반복하지 않는다.
3. 가능한 경우 범위가 명시된 집계 쿼리 하나 또는 소수의 `groupBy`로 통합한다.
4. 짧은 TTL cache를 사용한다면 content mutation 후 정확히 무효화한다.
5. N+1 query를 만들지 않는다.
6. 데이터가 1,000 locale pages로 늘어도 server pagination과 summary가 전체 section body를 읽지 않게 한다.

---

## Phase 3 — 폼 오류와 query state를 복구 가능한 구조로 바꾼다

### 3.1 typed server action result

#### 현재 문제

`runAction`이 대부분의 오류를 `status=failed`로 축약하고 redirect한다. 잘못된 slug 제출 시 목록으로 돌아가며 모든 입력값이 사라진다.

#### 구현 계약

1. create/update form은 `useActionState` 또는 현재 Next.js 버전에 맞는 동등한 typed action state를 사용한다.
2. validation 실패 시 같은 form과 같은 workspace에 머문다.
3. 입력값, 선택한 site/locale, 스크롤 위치, 선택한 section을 보존한다.
4. 상단 오류 요약과 field-level 오류를 함께 제공한다.
5. 첫 오류 필드로 포커스를 이동한다.
6. 다음 오류를 구분한다.

```text
400 validation
401 session expired
403 permission denied
404 page/revision missing
409 version conflict
429 rate limited
500/503 temporary failure
```

7. 409에서는 최신 revision과 내 입력을 보존하고 reload/compare 경로를 제공한다.
8. mutation 결과가 불명확한 500/timeout에서는 즉시 재제출을 유도하지 말고 현재 page/revision 상태를 먼저 다시 확인하게 한다.
9. submit 중 버튼을 비활성화해 중복 생성·중복 저장을 방지한다.
10. 성공 시에만 PRG redirect와 success notice를 사용한다.

### 3.2 slug·URL 검증

1. client hint, input pattern, 서버 DTO/service validation이 같은 규칙을 사용한다.
2. 입력 중 정규화된 실제 URL preview를 보여준다.
3. 공백·대문자·연속 slash·예약 경로·동적 placeholder·중복 route를 구분해 설명한다.
4. URL을 자동 변환한다면 원본을 조용히 바꾸지 말고 결과를 운영자에게 보여준다.

필드 오류 문구 예시:

```text
URL 주소는 영문 소문자, 숫자, 하이픈과 슬래시만 사용할 수 있습니다.
이 사이트와 언어에는 같은 주소가 이미 있습니다.
이 주소는 코드에서 사용하는 예약 경로와 충돌합니다.
```

### 3.3 query parameter allowlist

1. list query와 detail query schema를 분리한다.
2. Back to Pages에는 list의 search/site/locale/status/page/sort만 보존한다.
3. detail workspace에는 pageId/workspace와 현재 작업에 필요한 파라미터만 보존한다.
4. `sectionId`, `deleteSectionId`, `confirmPublish`가 Pages/News/New page 링크로 새지 않게 한다.
5. 잘못된 query는 안전한 기본값으로 정규화한다.

---

## Phase 4 — 게시·비공개·삭제 안전성을 완성한다

### 4.1 실제 disabled 게시 컨트롤

1. `UNKNOWN` 또는 `BLOCKED`에서는 publish confirm URL을 생성하지 않는다.
2. 차단 상태는 anchor가 아니라 semantic disabled button 또는 비동작 상태 패널로 렌더링한다.
3. primary 색을 사용하지 않는다.
4. 차단 이유와 해결할 편집 위치를 링크로 제공한다.
5. `AdminFormControlLink`가 표준 anchor 속성을 누락하는 문제는 공통 컴포넌트 계약에서 수정하거나, disabled 동작에 link를 사용하지 않는다.
6. 키보드 tab order에서 차단 컨트롤이 실행 가능한 요소처럼 보이지 않아야 한다.

### 4.2 Live↔Draft field-level diff

게시 확인에 최소 다음 변경을 표시한다.

```text
page identity/path
SEO title/description/canonical/noIndex
section add/delete/reorder/enable/disable
section title/body/image/link/CTA field changes
translation status
broken link/image checks
route ownership and code fallback replacement
first publish / normal update / large deletion risk level
```

1. diff는 Live와 Draft를 안정적으로 정규화한 뒤 생성한다.
2. JSON 문자열 순서 차이를 실제 변경으로 오인하지 않는다.
3. 긴 본문 전체를 강제로 펼치지 말고 변경 요약과 필요 시 상세 확장을 제공한다.
4. 최초 게시에는 현재 code fallback이 대체되는지 명시한다.
5. 삭제 섹션 수나 noIndex/canonical 변경은 danger/warning으로 강조한다.

### 4.3 Take offline

1. `CONTENT_PUBLISH` 또는 별도 기존 권한 관례에 맞는 강한 권한으로 제한한다.
2. 현재 Live snapshot, site, locale, path, 제공 방식, 방문자 영향을 표시한다.
3. 5~500자의 변경 사유와 정확한 path typed confirmation을 요구한다.
4. active revision 해제, audit event, 상태 갱신을 하나의 transaction에서 처리한다.
5. take offline 이후 동작을 ownership policy에 따라 명확히 정의한다.

```text
code fallback으로 복귀
404/not served
maintenance response
```

6. 사용자가 모르는 상태로 code fallback이 다시 나타나지 않게 확인창과 결과 notice에 표시한다.
7. 중복 요청은 idempotent하게 처리한다.
8. 최초 publish 직후에도 take offline이 가능해야 한다.

### 4.4 rollback 활동 이력

1. 옛 revision의 원래 publisher/time과 이번 rollback 실행 actor/time을 구분한다.
2. 활동 타임라인에 revision activated, published, rolled back, taken offline을 별도 이벤트로 표시한다.
3. raw operator ID 대신 이름·이메일·역할을 보여준다.
4. reason, before/after active revision, request/event ID를 audit metadata에 남긴다.

### 4.5 삭제 확인

1. 숨겨진 `confirmationId === pageId`만으로 사람의 확인을 대신하지 않는다.
2. site, locale, path, section count, Live 이력, Draft revision, 삭제 후 영향을 표시한다.
3. 운영자가 정확한 path를 입력해야 한다.
4. 서버는 입력값을 DB의 현재 path와 비교한다.
5. 삭제 사유를 요구한다.
6. Live 이력이 있거나 ownership conflict가 있으면 hard delete하지 않고 archive/resolve 경로를 안내한다.
7. 삭제 버튼은 일상 작업 화면의 primary action과 경쟁하지 않게 `More/위험 작업` 아래로 이동한다.

---

## Phase 5 — 1440px+ 운영 화면을 재구성한다

기존 Admin 디자인 시스템을 보존한다. 새로운 시각 세계를 만들지 말고 현재 컴포넌트·색상·간격을 정교하게 재배치한다.

### 5.1 목록 상단

현재 5개 큰 KPI 카드를 compact operational summary strip으로 바꾼다.

우선 정보:

```text
게시 차단
검증 필요
경로 누락
번역 누락/오래됨
최근 게시
```

- 각 항목은 클릭 가능한 작업 큐다.
- 같은 수치를 카드와 표 상단에서 반복하지 않는다.
- freshness timestamp는 페이지 단위로 한 번만 표시한다.
- 정상 0건은 약하게, 즉시 조치가 필요한 항목은 명확하게 표시한다.

### 5.2 필터

- 검색: 운영 이름과 URL path
- 사이트
- 언어
- 상태
- 제공 방식: CMS Live / Code fallback / Not served / Conflict
- quick views: 검증 필요 / 게시 차단 / 번역 누락 / stale translation / missing route
- 적용된 필터 chip과 전체 초기화
- 지표 클릭과 동일한 query contract

다음 개발자 문구는 제거한다.

```text
Search and pagination run on the server; section content is loaded only after opening a route.
```

권장 문구:

```text
페이지 이름이나 주소로 찾고, 사이트·언어·상태로 범위를 좁히세요.
```

### 5.3 경로 그룹 표

권장 열:

```text
페이지
실제 제공 방식
KO
EN
VI
JA
ZH
최근 변경
```

요구사항:

- 내부명 `MAIN EN /company`보다 사람이 이해하는 페이지명을 우선 표시한다.
- path는 한 번만 표시한다.
- 언어 상태 링크의 accessible name에 페이지명·언어·상태를 포함한다.
- 상태를 색상만으로 표현하지 않는다.
- 긴 path/페이지명이 열 폭을 깨뜨리지 않게 wrap 또는 clamp하고 전체값을 확인할 수 있게 한다.
- 1440×1000에서 페이지 수준 가로 넘침이 없어야 한다.

### 5.4 상세 헤더

권장 구조:

```text
회사 소개 · KO
hands.vn/company · Code fallback · Draft · 게시 준비 검증 필요

[미리보기] [Live 열기] [게시 준비 검토]
```

- H1을 항상 `Website Content`로 두지 않는다.
- 제목만 보고 페이지, 언어, 사이트, path, Draft/Live 상태를 식별할 수 있어야 한다.
- `Preview Draft`, `Open Live page`는 현재 button/link 컴포넌트 규칙에 맞게 시각적으로 일관돼야 한다.
- Danger zone은 기본 작업 하단의 큰 카드가 아니라 `More/위험 작업` 또는 별도 설정 영역으로 이동한다.

### 5.5 새 페이지·기사 폼

새 페이지 순서:

```text
페이지 정체성
→ 사이트·언어
→ URL
→ SEO 기본값
→ 생성
```

새 기사 순서:

```text
제목·slug·게시일
→ 썸네일
→ 본문
→ SEO
→ 저장
```

요구사항:

- 최대 2열을 사용하고 긴 textarea는 전체 폭을 사용한다.
- 공통 `.admin-form-grid` auto-fit을 무작정 전체 변경하지 않는다. 다른 관리자 화면 회귀를 막기 위해 Website Content 전용 layout class 또는 안전한 공통 variant를 사용한다.
- 본문이 화면 오른쪽의 좁은 칸으로 밀리지 않게 한다.
- 썸네일 URL 입력에는 preview와 alt text를 제공한다.
- asset manager가 현재 저장소 범위를 크게 벗어나면 새 시스템을 만들지 말고 URL preview·검사부터 구현한다.
- 저장 중, 성공, 실패, unsaved changes 상태가 명확해야 한다.

### 5.6 섹션 편집기

1. section key는 자동 생성하고 고급 설정에 숨긴다.
2. 숫자 sort order 대신 drag handle과 키보드용 위/아래 이동 버튼을 제공한다.
3. Hero, FAQ, CTA, Legal, Contact 등 kind별 필요한 필드를 제공한다.
4. 모든 kind에 generic 필드를 강제로 노출하지 않는다.
5. 이미지 URL은 preview, alt, 오류 상태를 제공한다.
6. 링크는 실제 대상, 외부/내부 여부, 유효성 상태를 보여준다.
7. raw JSON은 고급 disclosure에 두고 parse 오류를 field-level로 표시한다.
8. 1440px+에서 다음 중 실제로 더 읽기 좋은 구조를 선택하고 캡처로 검증한다.

```text
섹션 목록 280px / 편집기 flexible / preview 380px
또는
섹션 목록 300px / 편집기 flexible
```

preview가 빈 placeholder에 불과하면 억지 3열을 만들지 않는다.

### 5.7 Activity

- 리비전 번호, 상태, 실행자 이름/이메일, 변경 사유, 실행 시각을 보여준다.
- revision history와 audit event를 하나의 읽기 쉬운 타임라인으로 묶되 원본 데이터 계약을 잃지 않는다.
- 빈 이력은 큰 빈 표 대신 compact empty state를 사용한다.

---

## Phase 6 — 번역과 콘텐츠 운영 효율

### 6.1 번역 상태 계약

현재 Prisma 모델과 revision 구조를 먼저 조사하고 최소 안전 계약을 설계한다. 의미상 다음 상태를 구분해야 한다.

```text
MISSING
NEEDS_TRANSLATION
NEEDS_REVIEW
READY
STALE
```

1. 단순히 locale row가 존재한다는 이유로 번역 완료로 보지 않는다.
2. 기준 언어 revision이 바뀌면 연결된 번역이 stale인지 계산할 수 있어야 한다.
3. 번역을 자동 READY로 만들지 않는다.
4. 현재 schema로 파생 계산이 가능하면 새 테이블을 만들지 않는다.
5. source revision 연결이 꼭 필요하면 단계적 migration과 backfill 전략을 작성한다.
6. 기존 번역 내용을 덮어쓰지 않는다.

### 6.2 기준 언어 복제

- 신규 locale Draft에 기준 언어 구조를 복제할 수 있다.
- 실행 전 생성될 section 수와 덮어쓰지 않을 필드를 보여준다.
- 기존 번역이 있으면 overwrite하지 않고 conflict를 표시한다.
- 복제 결과는 `NEEDS_TRANSLATION` 또는 `NEEDS_REVIEW`이며 READY가 아니다.
- 1인 운영을 위해 일괄 준비 기능은 제공하되 실제 publish는 개별 route 검토를 유지한다.

### 6.3 링크·이미지·SEO 검사

최소 범위:

- 필수 이미지 URL 형식과 alt 누락
- 내부 링크가 manifest route와 일치하는지
- canonical path 형식
- title/description 길이
- noIndex 경고
- code fallback 대체 여부

외부 URL의 실시간 네트워크 검사는 timeout과 일시 오류를 구분한다. 저장 자체를 무조건 막지 말고 publish readiness에서 warning/blocking 정책을 명시한다.

---

## Phase 7 — 운영 문구와 접근성 hardening

### 7.1 문구 교체

| 현재 | 권장 |
|---|---|
| `UNKNOWN` | `검증 필요` |
| `Needs content` | `게시 준비 미완료` |
| `Review Publish` | `게시 준비 검토` |
| `Review and publish revision 1` | `변경 내용 확인 후 게시` |
| `Operator label` | `관리용 페이지 이름 (방문자에게 보이지 않음)` |
| `Section key` | `내부 섹션 ID (자동 생성)` |
| `Sort order` | `화면에서 순서를 변경하세요` |
| `Raw JSON is optional` | `고급 설정은 필요한 경우에만 사용하세요` |
| `No success was recorded...` | `저장하지 못했습니다. 표시된 항목을 확인하세요. 입력 내용은 보존했습니다.` |
| `1 route groups` | `1개 페이지 경로` |
| `Delete Draft route?` | `이 페이지 초안을 영구 삭제할까요?` |

영문 관리자 UI를 유지해야 하는 제품 정책이 있으면 문장을 자연스러운 운영 영어로 바꾸되, raw enum과 구현 세부사항은 노출하지 않는다. 임의로 전체 관리자 UI 언어를 한국어로 바꾸지 않는다.

### 7.2 접근성

- 모든 form field에 label, hint, error 연결
- validation summary에서 오류 field로 이동 가능
- dialog focus trap과 닫힌 뒤 trigger로 focus 복귀
- keyboard-only로 filter, tabs, section reorder, preview, confirm 사용 가능
- 상태를 색상만으로 전달하지 않음
- dynamic save/error/readiness update는 중복되지 않는 live region으로 알림
- 반복 링크 이름에 page/locale/section 문맥 포함
- disabled publish가 tab/activation 대상으로 남지 않음
- light/dark theme 모두에서 focus ring과 warning/danger 대비 유지

### 7.3 데이터·문구 hardening

다음 상태를 테스트한다.

- 100자 이상의 페이지명과 긴 path
- KO/EN/VI/JA/ZH CJK·성조 문구
- 빈 title/body/image/link
- 50개 이상 section
- 1,000개 이상의 locale page
- 0개 News
- 누락 route, stale route, ownership conflict
- 400/401/403/404/409/429/500/503
- 느린 요청과 timeout
- 저장 버튼 빠른 연속 클릭
- 두 브라우저의 동시 revision 수정
- malformed JSON과 잘못된 URL

지원하지 않는 언어·기기 범위까지 새로 확장하지 않는다.

## 8. 구현하지 말아야 할 것

- UI 카드와 CSS만 바꾸고 데이터 정합성 문제를 남기지 않는다.
- 현재 route count 17/34를 영구 상수로 하드코딩하지 않는다.
- 기존 85개 UNKNOWN을 근거 없이 READY로 backfill하지 않는다.
- shared/production DB에 route/readiness migration을 승인 없이 apply하지 않는다.
- manifest에 없는 route를 자동 삭제하지 않는다.
- CMS publish 시 코드 폴백 소스를 자동 제거하지 않는다.
- CMS API 오류를 page not found와 동일하게 취급하지 않는다.
- blocked publish를 href가 남은 가짜 disabled link로 만들지 않는다.
- 실패한 form을 목록으로 redirect해 입력을 버리지 않는다.
- client-side validation만 신뢰하지 않는다.
- take offline을 일반 edit 권한에 열지 않는다.
- 첫 publish의 영향을 일반 revision update와 동일하게 보지 않는다.
- 사용 이력이 있는 Live route를 hard delete하지 않는다.
- raw JSON, 내부 key, numeric sort를 기본 운영 흐름으로 유지하지 않는다.
- 새 CMS·editor·drag-and-drop library를 근거 없이 추가하지 않는다.
- 전체 `.admin-form-grid`를 바꿔 관련 없는 관리자 페이지를 깨뜨리지 않는다.
- 모바일 대응을 이유로 1440px 운영 레이아웃을 복잡하게 만들지 않는다.
- 관련 없는 booking, finance, auth, wallet 코드를 정리하지 않는다.
- 테스트 통과를 위해 readiness, permission, audit 규칙을 완화하지 않는다.
- 사용자 요청 없이 commit하지 않는다.

## 9. 필수 테스트

### API/데이터 계약

- manifest route/locale matrix 중복·누락 검사
- public resolver/template path 일치
- bootstrap dry-run 분류와 no-write 보장
- 격리 DB에서 revision-backed route 생성
- idempotent 재실행 변경 0건
- legacy page content 보존 backfill
- stale/conflict route fail-safe
- Pages/News/contentType별 summary
- site/locale/readiness/query별 summary
- missing route와 missing translation 구분
- readiness UNKNOWN 재평가
- BLOCKED publish 서버 거부
- Take offline 권한·사유·typed path·idempotency
- rollback actor/time과 original publisher/time 구분
- delete typed path 검증
- audit before/after/reason/request ID

### Admin Web

- News 0개에서 기사 전용 지표 0
- 전역 지표 범위 label
- metric click → 같은 scope filter
- form validation 실패 후 값 보존
- 첫 오류 focus와 field error 연결
- 401/403/404/409/429/500 상태별 문구
- 중복 submit 차단
- blocked publish confirm URL 없음
- semantic disabled publish 상태
- field-level diff 표시
- first publish fallback replacement warning
- Take offline/delete confirmation 내용
- list/detail query allowlist
- sectionId가 list/new 링크로 새지 않음
- 사람 친화적 page header와 accessible link names
- view-only/edit/publish/delete 권한 조합
- light/dark theme 회귀 없음

### Public Web

- CMS Live가 있으면 정확한 revision 렌더
- CMS page 없음과 API failure 정책 구분
- Code fallback/CMS ownership 결과 일치
- take offline 후 policy대로 fallback/404/maintenance 동작
- rollback 후 공개 revision 일치
- canonical/noIndex/locale route 회귀 없음

### 브라우저/E2E

1440×1000과 1600×1000에서 다음을 캡처한다.

1. Pages 기본 목록
2. News 0개/데이터 상태
3. filtered work queue
4. New page form과 validation error
5. New article form과 validation error
6. detail header/overview
7. section editor와 reorder
8. SEO/Publishing blocked state
9. publish diff/first publish warning
10. Activity timeline
11. Take offline confirm
12. Delete confirm
13. permission denied/read-only
14. API failure
15. dark theme 대표 화면

필수 assertion:

- 페이지 수준 horizontal overflow 없음
- 긴 textarea가 주 편집 폭을 사용함
- 상세 제목만으로 route/locale/state 식별 가능
- blocked publish는 click/tab으로 실행 불가
- form error 후 값 보존
- Delete/Take offline은 명시적 위험 작업 안에 있음
- dialog focus/return focus 정상
- console error/warning 없음
- page/detail query에 stale sectionId 없음

UI 변경을 마친 뒤 저장소에서 사용 가능한 Impeccable detector를 변경 UI 파일에 한 번 실행하고, 관련 finding만 수정·보고한다. detector 통과를 위해 관련 없는 공통 CSS를 대규모 변경하지 않는다.

## 10. 실행할 검증 명령

Windows에서는 `npm.cmd`를 사용한다. 실제 변경 파일에 맞춰 focused test를 먼저 실행한다.

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- app/website-content/page.spec.tsx app/website-content/actions.spec.ts app/website-content/website-content-pagination.spec.ts

npm.cmd run test --workspace @massage-vn/api -- src/site-content/site-content.service.spec.ts src/admin/admin-operator-category.guard.spec.ts

npm.cmd run test --workspace @massage-vn/public-web -- lib/site-content.spec.ts components/public-site-section.spec.tsx

npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run typecheck --workspace @massage-vn/api
```

변경된 admin/API/public 파일에는 focused ESLint를 실행한다. 새 migration 또는 schema 변경이 있으면 다음도 실행한다.

```powershell
npm.cmd run prisma:migrations:check
npm.cmd run verify:scope -- -Scope api
npm.cmd run verify:scope -- -Scope admin
```

protected area 또는 공개 웹 제공 방식의 동작을 변경했으므로 최종적으로 가능한 범위에서 다음을 실행한다.

```powershell
npm.cmd run verify:local
powershell -ExecutionPolicy Bypass -File .\infra\scripts\verify-local.ps1 -WithServices
```

서비스·시간·외부 환경 때문에 전체 검증을 실행할 수 없다면 성공으로 간주하지 않는다. 정확한 명령, 실패 원인, 미검증 위험을 구현 보고서에 남긴다.

## 11. 단계별 완료 기준

### 출시 Gate A — 코드 완료

- canonical route manifest와 contract tests가 존재함
- revision-aware migration/bootstrap과 dry-run이 구현됨
- 실제 apply 없이 create/backfill/move/stale/conflict 후보가 출력됨
- CMS/Code fallback/Not served/Conflict 소유권이 API와 UI에 표시됨
- Pages와 News summary가 분리되고 필터 scope가 정확함
- UNKNOWN readiness dry-run 재평가가 가능함
- form 오류에서 값과 위치가 보존됨
- blocked publish가 실제 disabled임
- Live↔Draft field-level diff가 있음
- first publish fallback replacement warning이 있음
- Take offline이 권한·사유·typed confirmation·audit와 함께 구현됨
- 삭제 확인이 현재 path를 서버에서 검증함

### 출시 Gate A — 데이터 rollout 완료

다음은 사용자 승인 후 별도 apply가 필요한 상태로 구분한다.

- manifest와 DB route matrix 일치
- 모든 page가 revision-backed
- 설명 없는 UNKNOWN 0건
- stale route 처리 승인
- 각 public route ownership 승인
- first CMS cutover 검토 완료

승인 없이 데이터 rollout까지 완료했다고 주장하지 않는다.

### 운영 Gate B

- compact work summary와 클릭 가능한 queue
- 사람 친화적 route table
- 1440px+ 폼 재배치
- page identity header
- 유형별 section editor와 reorder
- 번역 stale/clone workflow
- 사람 친화적 Activity timeline
- light/dark 및 keyboard 검증

## 12. 산출물

다음을 남긴다.

1. 구현 코드와 필요한 migration
2. canonical route manifest와 contract tests
3. route/readiness dry-run script와 tests
4. focused unit/integration/browser tests
5. before/after 화면 증거 폴더
6. `docs/audits/website-content-remediation-implementation-report-YYYY-MM-DD.md`

구현 보고서에는 다음을 포함한다.

- 감사 요구사항별 `완료 / 부분 완료 / 미완료`
- baseline과 수정 후 점수
- 변경 파일
- route manifest/DB/public resolver 구조
- migration/backfill/dry-run 전략
- dry-run의 expected/actual/create/backfill/move/stale/conflict 수치
- 실제 apply 미실행 사실
- CMS/코드 폴백 소유권 정책
- 실행한 명령과 pass/fail/skipped
- protected area 변경
- 브라우저 before/after 캡처 링크
- 남은 데이터 rollout 승인 작업
- 남은 위험과 출시 가능 여부

## 13. 최종 응답 형식

최종 응답은 다음 순서로 작성한다.

1. 한 줄 판정
2. 단계별 구현 상태와 health
3. 완료한 출시 게이트
4. route/readiness dry-run 결과와 apply 미실행 사실
5. UI 개선 결과
6. 테스트·검증 pass/fail/skipped
7. protected area 변경
8. 남은 위험 또는 사용자 승인 필요 작업
9. 구현 보고서 링크
10. 다음 권장 작업 1개

각 단계는 다음 형식을 사용한다.

```text
Step 1 — Route contract: 완료 / 양호
Step 2 — Data readiness: 부분 완료 / 승인 필요
Step 3 — Publish safety: 완료 / 양호
Step 4 — Operator UI: 완료 / 양호
Step 5 — Verification: 부분 완료 / 위험 명시
```

중요:

- 일부 항목을 구현하지 못했으면 이유와 출시 영향을 숨기지 않는다.
- 테스트가 통과해도 route ownership, UNKNOWN, form recovery, publish diff, take offline 중 하나라도 해결되지 않았으면 출시 가능으로 판정하지 않는다.
- 실제 데이터 migration apply를 하지 않았다면 코드 완료와 데이터 rollout 완료를 분리해 보고한다.
- 화면이 예뻐졌다는 이유만으로 완료하지 않는다. 관리자가 보는 상태와 실제 공개 결과가 일치해야 한다.

---

## 이 프롬프트의 사용 메모

- 이 작업은 Admin Web, API, Public Web, infra script, 필요 시 Prisma migration까지 포함하는 큰 작업이다.
- Codex 앱에서 새 작업을 열어 이 문서 전체를 전달하는 것을 권장한다.
- 계획을 세운 뒤 안전한 구현까지 계속하도록 이미 지시돼 있다.
- route/readiness 데이터 apply와 실제 publish/delete/take offline에는 사용자 승인이 필요한 것이 정상이다.
- 범위가 너무 커 한 번에 완료되지 않으면 임의로 P2부터 처리하지 말고, 출시 Gate A의 코드 계약을 먼저 완성한 뒤 정확한 중단점과 미완료 위험을 남긴다.
