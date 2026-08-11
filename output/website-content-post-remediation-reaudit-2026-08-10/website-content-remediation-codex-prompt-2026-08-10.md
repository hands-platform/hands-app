# HANDS Admin Website Content 최종 개선 구현 프롬프트

아래 전체 내용을 새 Codex 작업에 그대로 전달한다.

---

## 역할

너는 HANDS 관리자 웹의 Website Content를 실제 운영 가능한 CMS로 완성하는 시니어 풀스택 엔지니어다.

이번 작업은 화면을 보기 좋게 꾸미는 정도의 수정이 아니다. **운영자가 현재 공개 중인 페이지를 중단하지 않고 초안을 편집·미리보기·검증·게시·복구할 수 있도록 게시 안전 모델, API 원자성, 권한, 정보 구조, 문구, 데스크톱 레이아웃을 함께 바로잡는 것**이 목적이다.

운영자 화면의 사용자 모드는 `Operate`다. 장식보다 다음을 우선한다.

- 현재 Live 상태와 Draft 변경 상태의 정확한 구분
- 실수로 공개 콘텐츠를 내리거나 잘못 게시하지 않는 안전성
- 빠른 스캔과 명확한 다음 행동
- 실패 원인을 숨기지 않는 오류 처리
- 변경자·게시자·게시 시각·rollback의 감사 가능성
- KO/EN/VI/JA/ZH 콘텐츠 운영 효율

이번 작업은 보고서를 다시 작성하는 작업이 아니다. 현재 코드와 화면을 직접 확인하고, 가능한 범위를 실제로 수정하고, 테스트와 새 화면 캡처로 검증한다.

## 최종 목표

`http://localhost:3101/website-content`와 관련 Admin Web, API, Public Web을 수정해 다음을 모두 달성한다.

1. 공개 중인 Live revision과 편집 중인 Draft revision이 동시에 존재한다.
2. Draft를 저장하거나 편집해도 현재 Live 페이지의 내용·URL·공개 상태가 바뀌지 않는다.
3. 일반 페이지와 뉴스 모두 Draft preview를 제공한다.
4. Publish와 rollback은 서버에서 readiness 검사·revision 전환·감사 로그를 하나의 원자적 작업으로 처리한다.
5. 뉴스 생성·수정 중 어느 단계가 실패해도 거짓 성공, 고아 Page/Section, 기존 게시물의 강제 Draft 전환이 발생하지 않는다.
6. `publishedAt`은 일반 저장으로 변경되지 않고 실제 게시 전이에서만 정확히 관리된다.
7. Admin readiness와 Public renderer가 동일한 section schema 및 렌더 가능성 계약을 사용한다.
8. 기본 화면은 콘텐츠 현황과 목록으로 시작하고, Pages와 News 업무를 하나의 Website Content 영역 안에서 명확히 분리한다.
9. API 오류, 전체 0건, 필터 0건, 권한 부족, 충돌 상태를 서로 다르게 보여 준다.
10. 1440px 이상 데스크톱에서 표·버튼·도메인이 문자 단위로 줄바꿈되지 않고, 운영자가 첫 화면에서 핵심 상태와 작업을 파악한다.
11. 1,000개 이상의 route까지 확장할 수 있도록 목록 API가 서버 검색·필터·페이지네이션을 제공한다.
12. 기존 보안, 감사 로그, 안전한 링크 처리, 삭제 확인, 다크 테마, URL 필터 보존을 회귀시키지 않는다.

## 작업 위치와 필수 지침

- 저장소: `C:\dev\massage-on-demand-vn`
- 시작 전에 저장소 루트의 `AGENTS.md`를 끝까지 읽고 따른다.
- 단일 에이전트로 작업한다. subagent, worker, handoff agent, multi-agent 도구를 사용하지 않는다.
- 작업 트리가 매우 더러울 수 있다. 기존 변경은 사용자 작업이므로 되돌리거나 정리하지 않는다.
- 관련 없는 파일을 포맷하거나 리팩터링하지 않는다.
- 새 UI framework, CMS framework, form framework, rich-text framework, state-management library를 추가하지 않는다.
- 기존 Admin component, form/table atom, confirmation, status badge, audit log, permission guard, API error helper를 먼저 재사용한다.
- 새 추상화는 실제로 두 곳 이상에서 같은 계약을 공유할 때만 만든다. 미래 확장을 위한 범용 workflow engine은 만들지 않는다.
- 증상별 임시 분기를 여러 caller에 흩뿌리지 말고, 모든 caller가 통과하는 가장 좁은 공통 지점에서 원인을 수정한다.
- Prisma schema/migration과 shared types는 protected area다. 변경하면 `AGENTS.md`의 integration review와 full local verification을 수행한다.
- 데이터 손실 가능성이 있는 `prisma migrate reset`, `prisma db push --force-reset`, 수동 DROP/DELETE, 기존 migration 수정은 금지한다.
- 실제 production 또는 공유 DB에 migration을 적용하지 않는다. 저장소 규칙에 맞는 새 migration과 안전한 backfill을 작성하고 로컬 검증만 수행한다.
- 1024px 이하 모바일·태블릿·좁은 데스크톱 개선은 이번 범위가 아니다. 새 모바일 UI를 만들지 않는다.
- 검사 기준은 `1440×900`과 `1600×900` 데스크톱이다.
- 브라우저 검증 중 실제 Publish, Rollback, Delete, Add, Hide, Save mutation을 실행하지 않는다. mutation은 격리된 테스트 데이터와 자동 테스트에서 검증한다.
- 로그인된 in-app browser를 사용하고 현재 run에서 새 캡처를 만든다.
- 사용할 수 있다면 `impeccable`의 `harden` 기준을 적용한다. UI 수정이 끝난 뒤 detector는 한 번만 실행한다.

## 반드시 먼저 읽을 자료

### 기준 보고서

`C:\dev\massage-on-demand-vn\output\website-content-post-remediation-reaudit-2026-08-10\website-content-post-remediation-reaudit.md`

### 현재 화면 캡처

`C:\dev\massage-on-demand-vn\output\website-content-post-remediation-reaudit-2026-08-10\`

특히 다음을 비교한다.

- `01-default-top-light-1440x900.png`
- `02-route-list-light-1440x900.png`
- `03-route-pagination-add-light-1440x900.png`
- `04-add-route-light-1440x900.png`
- `05-route-settings-light-1440x900.png`
- `06-section-structure-light-1440x900.png`
- `08-section-editor-form-light-1440x900.png`
- `09-delete-section-confirmation-light-1440x900.png`
- `10-route-settings-dark-1440x900.png`
- `11-filtered-empty-light-1440x900.png`

과거 캡처는 문제 이해와 before 비교에만 사용한다. 최종 검증 증거는 수정 후 현재 run에서 다시 캡처한다.

## 반드시 먼저 추적할 코드

```text
apps/admin_web/app/website-content/page.tsx
apps/admin_web/app/website-content/actions.ts
apps/admin_web/app/website-content/actions.spec.ts
apps/admin_web/app/website-content/website-content-types.ts
apps/admin_web/app/website-content/website-content-pagination.ts
apps/admin_web/app/website-content/website-content-pagination.spec.ts
apps/admin_web/app/globals.css

apps/admin_web/lib/admin-api.ts
apps/admin_web/lib/admin-operator-access-model.ts
apps/admin_web/lib/admin-operator-permissions.ts
apps/admin_web/lib/admin-navigation.ts

apps/api/prisma/schema.prisma
apps/api/prisma/migrations/**
apps/api/src/site-content/site-content.dto.ts
apps/api/src/site-content/site-content.service.ts
apps/api/src/site-content/site-content.service.spec.ts
apps/api/src/site-content/public-site-content.controller.ts
apps/api/src/admin/admin-catalog.routes.ts
apps/api/src/admin/admin-operator-category.guard.ts

apps/public_web/app/[locale]/[[...slug]]/page.tsx
apps/public_web/components/public-site-section.tsx
apps/public_web/components/public-site-section.spec.tsx
apps/public_web/components/public-news-pages.tsx
apps/public_web/lib/site-content.ts
apps/public_web/lib/site-content.spec.ts
```

위 목록만 수정 대상으로 단정하지 않는다. `rg`로 모든 `PublicSitePage`, `PublicSiteSection`, `/admin/site-pages`, `resolvePublishedPage`, `fetchPublicSitePage`, `SYSTEM_POLICY` caller와 테스트를 추적한다.

## 시작 절차

1. `git status --short`로 기존 변경 범위를 기록한다.
2. 저장소 `AGENTS.md`, 기준 보고서, 캡처를 읽는다.
3. 현재 화면과 코드가 보고서의 지적과 여전히 일치하는지 확인한다.
4. 기존 Prisma migration 규칙, revision/versioning 패턴, publish/approve/rollback transaction, permission guard, preview token 패턴을 `rg`로 찾는다.
5. 변경 전 focused test와 typecheck를 실행해 baseline을 기록한다.
6. 구현 전 현재 데이터 흐름을 짧게 정리한다.

```text
Admin form/action
→ Admin API helper
→ Admin controller/guard
→ SiteContentService
→ Prisma Page/Section
→ public controller/cache
→ PublicManagedPage/renderer
```

7. 다음 invariant를 테스트 이름과 구현 계획에 반영한다.

- Draft edit never changes Live.
- Publish is atomic.
- Publish failure preserves the previous Live revision.
- Preview never becomes publicly accessible without authorization.
- Read failure never looks like an empty database.
- Readiness matches actual renderer output.
- General save never changes the original publishedAt.

8. 계획만 보고 멈추지 않는다. 새 권한 결정이나 외부 인프라 승인이 필요한 실제 blocker가 없다면 P0부터 구현하고 검증한다.

## 절대 회귀시키지 말아야 할 현재 성과

- 신규 일반 경로는 Draft와 No index로 시작한다.
- API가 SEO title/description, enabled section, renderable content를 게시 전에 검사한다.
- 게시 중인 기존 모델에서 섹션 수정과 삭제가 차단된다.
- 게시된 경로 삭제가 차단된다.
- Page와 Section 변경 감사 로그가 기록된다.
- 삭제 확인창은 정확한 대상 ID, Cancel 초기 포커스, Escape 취소를 제공한다.
- 공개 링크는 상대 경로와 HTTPS만 허용한다.
- 필터와 페이지네이션 URL 상태가 보존된다.
- 안전한 return URL allowlist가 유지된다.
- full phone, secret, token, raw credential이 Admin DOM, URL, audit metadata에 노출되지 않는다.
- 기존 light/dark 디자인 토큰과 Admin navigation 구조를 유지한다.
- Website Content는 `Growth & Communications`의 한 메뉴로 유지한다.

## P0-1. Live와 Draft revision을 분리한다

### 현재 문제

현재 `PublicSitePage`와 `PublicSiteSection`이 동시에 route identity, 편집본, 공개본 역할을 한다. 섹션을 수정하려면 Page를 Draft로 돌려야 하고, Public Web은 PUBLISHED row만 읽는다. 그 결과 편집을 시작하는 순간 공개 화면이 하드코딩 fallback 또는 404로 바뀔 수 있다.

### 필수 도메인 계약

정확한 Prisma 모델명은 현재 저장소 규칙에 맞게 정하되 다음 의미를 반드시 구현한다.

```text
Route identity
- stable page/route id
- site
- locale
- path
- operator label/internal name

Live revision
- 현재 공개되는 SEO, canonical, noIndex, section snapshot
- first publishedAt
- last published/activated metadata

Draft revision
- 운영자가 저장 중인 변경본
- version 또는 optimistic concurrency token
- readiness 결과
- created/updated actor와 시각

Archived revision
- 최소 한 개 이상의 이전 공개본
- rollback 대상
```

다음 중 현재 코드에 가장 작은 안전한 모델을 선택할 수 있다.

- `PublicSitePage`가 route identity와 `activeRevisionId`, `draftRevisionId`를 소유하고 별도 `PublicSitePageRevision`과 revision별 section을 두는 방식
- 동등한 안전성을 제공하는 versioned snapshot 방식

단, 기존 `PublicSitePage.status`를 이름만 바꾸거나 같은 row를 Draft/PUBLISHED로 토글하는 방식은 해결이 아니다.

### migration과 backfill

- 기존 PUBLISHED Page의 현재 SEO와 section은 active/live revision으로 보존한다.
- 기존 DRAFT Page는 draft revision으로 보존한다.
- 기존 ID 또는 route link를 가능한 한 유지하고, 변경이 필요하면 backward-compatible lookup을 제공한다.
- `site + locale + path` uniqueness를 유지한다.
- backfill은 재실행 가능하거나 안전하게 한 번만 실행되도록 한다.
- 데이터가 불완전한 legacy Page를 임의로 Published로 승격하지 않는다.
- migration 전후 row 수와 route uniqueness를 검증하는 테스트 또는 검증 스크립트를 추가한다.
- migration rollback 전략과 되돌릴 수 없는 항목을 문서화한다.
- 기존 migration 파일을 수정하지 말고 새 migration을 추가한다.

### Draft 작업

- Live Page에서 `Edit draft`를 시작하면 현재 Live revision을 복사한 Draft를 만들거나 기존 Draft를 연다.
- Draft 저장은 Live revision, public response, public cache, `publishedAt`을 변경하지 않는다.
- 동시에 두 운영자가 같은 Draft를 저장하면 version/updatedAt 기반 충돌을 검출한다.
- 충돌 시 마지막 저장이 조용히 덮어쓰지 않으며 `This draft changed while you were editing. Reload and compare.`와 같은 복구 경로를 보여 준다.
- 변경 사항이 없으면 불필요한 새 revision이나 audit event를 만들지 않는다.

### route identity 변경

Site, locale, path 변경은 일반 콘텐츠 저장과 같은 의미가 아니다. 공개 URL 이동 또는 충돌을 일으킬 수 있다.

- 기존 Live route의 site/locale/path는 일반 Draft 저장에서 직접 바꾸지 않는다.
- route move가 반드시 필요하면 별도 위험 작업으로 분리하고, destination 충돌·redirect·canonical·번역 그룹 영향을 검사한다.
- 이번 범위에서 안전한 redirect 모델이 없다면 Live route의 site/locale/path 편집을 잠그고 정확한 제한 문구를 제공한다. 임시로 URL을 바꿔 404를 만들지 않는다.

### Public Web 해석

- Public endpoint와 `PublicManagedPage`는 언제나 active/live revision만 반환한다.
- Draft가 존재해도 공개 요청 결과는 변하지 않는다.
- CMS/API 조회 실패를 `no page`로 간주해 하드코딩 fallback으로 조용히 전환하지 않는다. 알려진 fallback이 필요한 제품 정책과 API 장애를 구분한다.
- 공개 cache/revalidate가 새 revision 활성화 후 정확히 갱신되도록 한다.
- 활성 revision이 없는 Draft-only custom route는 공개 404를 유지한다.

### 테스트

- Live page에 Draft를 만들고 수정해도 public response가 기존 Live와 동일하다.
- Draft를 여러 번 저장해도 public response와 first `publishedAt`이 같다.
- Draft-only route는 공개되지 않는다.
- CMS read error는 의도된 hardcoded fallback과 구분된다.
- migration이 기존 Published와 Draft 데이터를 정확히 보존한다.
- 동일 route에 active revision은 하나뿐이다.
- concurrent Draft update가 409 또는 현재 domain conflict 계약으로 차단된다.

## P0-2. Draft preview를 안전하게 제공한다

일반 페이지와 뉴스에 동일한 preview 원칙을 적용한다.

### 요구사항

- Page workspace에 `Preview draft`와 `Open live page`를 명확히 분리한다.
- preview는 Admin session 또는 짧은 만료 시간의 서명된 preview token을 요구한다.
- 단순 `?preview=true`만으로 Draft를 공개하지 않는다.
- preview token은 page/revision/locale/site 범위와 만료 시간을 가진다.
- token, secret, 전체 preview payload를 로그나 audit metadata에 기록하지 않는다.
- preview 응답은 `no-store`, `noindex`이며 일반 public cache에 들어가지 않는다.
- Draft가 바뀌면 오래된 preview가 어떤 revision을 보여 주는지 명확히 한다.
- invalid/expired/unauthorized token은 401/403/404 중 프로젝트 정책에 맞는 상태와 안전한 문구를 반환한다.
- Admin preview link는 새 탭에서 열리고 accessible name에 Draft임을 포함한다.

### 테스트

- 인증 없는 preview 접근이 거절된다.
- 다른 revision/page token 재사용이 거절된다.
- 만료 token이 거절된다.
- preview는 Draft, public URL은 기존 Live를 동시에 보여 준다.
- preview response가 public cache에 저장되지 않는다.

## P0-3. Publish와 rollback을 원자적으로 만든다

### API 계약

현재 프로젝트 네이밍에 맞춰 최소한 다음 의미의 서버 작업을 제공한다.

```text
create/open draft
save draft
publish draft revision
rollback to previous revision
discard draft
```

정확한 route와 DTO 이름은 기존 API convention을 따른다. Admin Web이 Page 생성 → Section 생성 → status PATCH를 여러 번 호출해 게시하는 구조는 제거한다.

### Publish transaction

하나의 DB transaction 안에서 다음을 처리한다.

1. 요청자의 publish 권한 재검사
2. route와 draft revision 존재 확인
3. expected revision/version 충돌 확인
4. server-side readiness 검사
5. 기존 live revision 보관
6. draft revision을 active revision으로 전환
7. 게시 actor와 시각 기록
8. audit log 기록
9. 일관된 응답 생성

transaction 이후 cache revalidation이 실패할 수 있다면 게시 자체와 후속 cache 상태를 구분해 보고하고 재시도 가능한 안전한 경로를 제공한다. DB가 이미 게시됐는데 UI가 전체 실패라고 오판하게 하지 않는다.

### Rollback

- 이전에 실제로 Live였던 revision만 rollback 대상으로 제공한다.
- rollback confirmation에 현재 Live, 대상 revision, 게시자/게시 시각, 바뀌는 URL과 SEO 요약을 표시한다.
- rollback도 하나의 transaction과 audit event로 처리한다.
- rollback 실패 시 현재 Live가 유지된다.
- 삭제된/손상된 revision을 rollback 대상으로 표시하지 않는다.

### Publish confirmation

상태 select에서 `PUBLISHED`를 고르는 방식은 제거한다. Publish는 별도 버튼과 확인 단계다.

확인 화면에 다음을 표시한다.

- 대상 website, language, public URL
- 현재 Live revision과 Draft revision
- changed section/SEO fields 요약
- readiness checklist와 blocking reason
- canonical path
- search indexing 상태
- missing translation 상태
- 게시 후 cache 반영 상태 안내

readiness가 실패하면 버튼을 비활성화하는 데서 끝내지 말고 API도 동일한 이유로 publish를 거절한다.

### 테스트

- readiness 실패 시 active revision이 바뀌지 않는다.
- audit log 실패 등 transaction 내부 실패 시 active revision이 바뀌지 않는다.
- 중복 Publish 제출은 한 번만 활성화된다.
- stale expected revision은 충돌로 차단된다.
- publish 성공 후 public response가 새 revision으로 바뀐다.
- rollback 성공 후 public response가 선택한 이전 revision으로 바뀐다.
- rollback 실패 시 기존 Live가 유지된다.

## P0-4. 뉴스 생성·수정의 거짓 성공과 부분 상태를 제거한다

### 현재 문제

현재 뉴스 생성은 Page 생성 → Section 생성 → Publish PATCH를 순차 호출하고, 마지막 Publish 결과를 확인하지 않고 `news-created` notice를 만들 수 있다. 뉴스 수정은 게시 중인 Page를 먼저 Draft로 내린 뒤 Section과 Page를 수정해 중간 실패 시 기존 게시물을 비공개 상태로 남길 수 있다.

### 구현 요구

- `createPublicSiteNewsArticle`과 `updatePublicSiteNewsArticle`의 다중 호출 게시 흐름을 제거한다.
- 뉴스 생성은 항상 Draft로 시작한다.
- Draft 생성 시 Page/revision/article content/SEO를 하나의 server transaction으로 저장한다.
- 뉴스 수정은 Draft revision만 수정한다. 현재 Live 뉴스는 유지한다.
- Publish는 P0-3의 공통 publish endpoint와 readiness 계약을 사용한다.
- 어느 단계가 실패해도 성공 notice를 표시하지 않는다.
- 중복 submit을 막고 idempotency 또는 revision version을 사용한다.
- 서버 field error를 title, subtitle, slug, thumbnail, body 등 해당 필드에 표시하고 입력값을 보존한다.
- 고아 route/revision/section이 생기지 않는 실패 테스트를 추가한다.

### slug와 본문

- slug는 영문 소문자, 숫자, 하이픈 규칙을 입력 전에 설명한다.
- 입력 중 최종 URL preview를 보여 준다.
- 한글만 입력해 빈 slug가 되는 경우 submit 후 generic error가 아니라 즉시 명확한 inline error를 표시한다.
- slug normalization의 client와 server 계약을 일치시킨다.
- 기존 본문이 빈 줄 단위 paragraph만 지원한다면 그 제한을 명시한다.
- 새 rich-text dependency를 추가하지 않는다. 이번 범위에서 구조화 본문을 구현하려면 저장소의 기존 editor/portable content pattern이 있을 때만 재사용한다.

## P1-1. `publishedAt` 의미를 바로잡는다

- 최초 `publishedAt`은 처음 Draft→Live 전이에서 설정하고 일반 저장 또는 published→published metadata update로 바꾸지 않는다.
- 정렬에 쓰는 최초 게시일과 마지막 활성화 시각이 모두 필요하면 `publishedAt`과 `lastPublishedAt` 또는 동등한 명확한 필드로 분리한다.
- 단순 SEO 수정이 News 순서를 맨 위로 올리지 않는다.
- 명시적인 republish 정책이 있다면 UI와 API에서 별도 작업으로 드러낸다.
- migration/backfill에서 기존 게시일을 보존한다.

테스트:

- Live metadata 저장 후 `publishedAt` 불변
- 새 revision publish 후 first `publishedAt` 불변, last publish metadata만 변경
- rollback 후 제품 정책에 따른 날짜 의미가 테스트로 고정됨
- News list 정렬 회귀 없음

## P1-2. readiness와 renderer를 하나의 계약으로 만든다

### 현재 문제

API는 item의 `label`만 있어도 renderable로 인정하지만 Public renderer는 안전한 href가 없으면 label을 출력하지 않는다. 여러 Section kind도 실제로는 거의 같은 범용 renderer를 사용한다.

### 구현 원칙

- Section kind별 schema, normalization, readiness, Admin field model, Public renderer의 의미를 일치시킨다.
- schema를 Admin, API, Public Web이 공유해야 한다면 저장소의 기존 shared contract 패턴을 사용한다.
- `packages/shared-types`를 변경하면 protected-area 검증을 수행한다.
- JSON에 key가 있다는 이유로 `Configured`라고 표시하지 않는다.
- 실제 Public renderer가 visible output을 만드는지 기준으로 `Ready`, `Needs content`, `Invalid`, `Hidden`을 계산한다.
- 안전한 href가 필요한 label/action은 href가 없으면 readiness를 통과하지 않는다.
- 지원하지 않는 kind를 UI에서 선택할 수 있게 두지 않는다.

### 최소 지원 방향

현재 제품에 필요한 kind를 코드와 데이터에서 조사한 뒤 둘 중 하나를 선택한다.

1. 실제 의미가 필요한 kind마다 명시적 schema와 renderer를 구현한다.
2. 범용 콘텐츠만 지원한다면 허위 semantic kind를 제거하고 `CONTENT_SECTION`과 제한된 presentation variant로 단순화한다.

FAQ, Legal document, Partner directory처럼 구조가 다른 이름을 같은 범용 출력에 연결한 채 완료하지 않는다.

### 계약 테스트

- readiness를 통과한 fixture는 Public renderer에서 실제 visible content를 출력한다.
- renderer가 null 또는 빈 list를 출력하는 fixture는 publish가 차단된다.
- kind별 required field와 safe link 규칙을 검증한다.
- unsupported key/oversized JSON/unsafe URL이 거절된다.
- Admin readiness reason과 API error reason이 같은 fixture에서 일치한다.

## P1-3. Pages와 News를 운영 작업 단위로 분리한다

Website Content는 사이드바에서 하나의 메뉴로 유지한다. 별도 대분류나 중복 메뉴를 만들지 않는다. 내부에서 `Pages`와 `News`를 1차 탭 또는 2차 내비게이션으로 분리한다.

### 권장 기본 구조

```text
Website Content                                      [New page]
[Pages] [News]

[Live] [Draft changes] [Needs attention] [Missing translations] [Recently published]

Filters / saved views
Route groups or article list
```

### 기본 화면

- 첫 화면은 요약과 Pages 목록이다.
- `Publish news` 대형 작성 폼을 기본 화면에서 제거한다.
- `New page`, `New article`은 해당 탭의 상단 우측 생성 버튼이다.
- 생성 화면/다이얼로그는 명시적으로 열었을 때만 렌더한다.
- 선택된 Page 또는 News 상세가 열리면 전역 작성 폼·전체 목록·새 route 폼을 그 아래 다시 렌더하지 않는다.
- URL에 현재 tab, filter, page, selected item을 보존해 새로고침과 뒤로가기가 예측 가능해야 한다.

### 요약 수치

- Live: active revision이 있는 route 수
- Draft changes: Live와 다른 Draft가 있는 route 수
- Needs attention: readiness가 실패한 Draft 수
- Missing translations: route group에서 필수 locale이 누락된 수
- Recently published: 최근 7일 publish/rollback event 수

숫자를 하드코딩하지 말고 목록과 같은 server predicate로 계산한다. 일부 summary query가 실패하면 0 또는 healthy로 추정하지 않는다.

## P1-4. Route 목록을 locale 운영에 맞게 재구성한다

### 서버 목록 API

현재 모든 Page와 Section JSON을 가져와 Admin Web에서 필터·페이지네이션하는 방식을 제거한다.

최소 query:

```text
page / take 또는 cursor
q
site
locale
status/liveState
readiness
noIndex
missingTranslation
sort
```

목록 응답에는 필요한 summary만 포함한다.

```text
route/page id
site
path
operator label
locale states
live status
draft status
readiness and reasons count
section count
updatedAt
publishedAt/lastPublishedAt
updated/published actor summary
```

목록 응답에 모든 section content JSON을 싣지 않는다. 상세 진입 시에만 revision과 section을 조회한다.

### Route grouping

- 기본 목록은 `Website + Path`를 route group으로 묶는다.
- KO/EN/VI/JA/ZH 상태를 같은 행의 locale matrix 또는 명확한 grouped cells로 표시한다.
- 각 locale은 `Live`, `Draft changes`, `Needs content`, `Missing` 상태를 구분한다.
- 내부 이름, Website, Locale, Path의 반복 노출을 줄인다.
- `Manage`는 `Edit route` 또는 행 전체의 명확한 링크로 바꾼다.

### 1440px 표 계약

- Admin sidebar를 제외한 실제 본문 폭에서 검증한다.
- Website/domain과 기본 action은 `white-space: nowrap`이다.
- `hands.vn`, `join.hands.vn`, `Edit route`가 문자 단위로 개행되지 않는다.
- page-level horizontal scroll이 없다.
- 표 내부 scroll이 필요한 경우 마지막 상태/action 열이 잘리지 않고 키보드로 접근 가능하다.
- 보조 기술 정보는 상세로 보내고 기본 행 높이는 과도하게 늘리지 않는다.
- `overflow: hidden`으로 중요한 값을 가리는 방식으로 통과시키지 않는다.

### 필터와 빈 상태

필터:

- Search route or operator label
- Website
- Language
- Live/Draft status
- Needs attention
- Missing SEO
- Missing translation
- Search indexing

상태를 구분한다.

1. 실제 전체 0건: `No managed pages yet` + `New page`
2. 필터 0건: `No pages match these filters` + `Clear filters`
3. API 오류: `Pages could not be loaded` + `Retry` + request ID 또는 안전한 추적 정보
4. 권한 없음: 읽기 전용 또는 접근 제한 이유
5. 일부 summary 실패: 목록은 유지하고 해당 summary만 unavailable

API 오류 상태에서 `New page`를 기본 복구 행동으로 제시하지 않는다.

### 성능 기준

- 1,000개 route fixture에서 목록 API가 모든 section JSON을 반환하지 않는다.
- 서버 pagination이 실제 query에 적용된다.
- 같은 필터의 count와 list predicate가 일치한다.
- 1440px warm 목록 전환의 기존 관찰값을 유의미하게 악화시키지 않는다.
- 로컬 환경에서 절대 P75를 증명할 수 없으면 동일 조건 3회 before/after median과 payload size를 보고한다.
- 성능 측정 없이 새 cache layer 또는 index를 추가하지 않는다.

## P1-5. Page 상세를 전용 workspace로 만든다

### 구조

```text
Breadcrumb / Operator label
Website · Language · Public URL · Live status
[Preview draft] [Open live page] [Publish]

[Overview] [Content] [SEO & publishing] [Activity]

Main editor                         Readiness / Draft vs Live / Preview
```

### Overview

- Live status, Draft status, last updated, last published, last publisher
- public URL과 preview URL 구분
- translation group 상태
- unresolved readiness issue

### Content

- section list와 실제 운영자용 field editor
- raw JSON 없이 정상 편집 가능
- `Advanced JSON`은 권한 있는 고급 모드로 접어서 제공
- schema validation error를 해당 field 또는 item에 표시
- section 순서 변경은 drag만 의존하지 않고 키보드 가능한 Move up/Move down 제공
- row action은 `Edit`과 overflow menu로 정리
- Hide/Enable은 Draft에 적용하고 명확한 변경 배지와 Undo를 제공

### SEO & publishing

- SEO title/description 문자 수
- search result preview
- canonical 설명과 최종 URL
- search indexing을 결과 중심 문구로 설명
- readiness checklist
- Draft vs Live 변경 요약
- Publish와 rollback entry

### Activity

- created/updated/published/rolled back/deleted actor와 시각
- revision ID/version
- 변경 요약
- 감사 로그가 없거나 일부 실패하면 숨기지 않고 정확히 표시

### 작업 위계

- 일반 Save는 `Save draft changes`다.
- Publish/Unpublish/Rollback/Delete는 일반 저장과 분리한다.
- Delete confirmation의 Cancel과 danger action은 같은 높이로 우측 정렬하고 danger button을 전체 폭 막대로 만들지 않는다.
- Published route의 route identity 변경과 Delete는 정확한 제한 이유를 표시한다.

## P1-6. Section editor를 schema 기반으로 만든다

### 요구사항

- Section kind별 필드를 운영자 언어로 표시한다.
- 예: Hero는 eyebrow/title/body/primary action/image, FAQ는 question/answer 반복 field.
- field label, hint, example, length/format constraint를 제공한다.
- image URL은 상대 경로/HTTPS 규칙을 inline 검증하고 thumbnail preview를 제공한다.
- action URL은 safe href 규칙을 inline 검증한다.
- 현재 선택 section과 전체 Draft preview를 확인할 수 있다.
- JSON parsing 실패, unsupported key, oversized content, unsafe URL, missing required field를 서로 다른 오류로 표시한다.
- 저장 실패 시 JSON/field 입력이 보존된다.
- `Configured` badge를 제거하고 실제 readiness 상태와 blocking reason을 사용한다.
- 불필요한 새 generic form-builder framework는 만들지 않는다.

### Action layout

- `Edit`, `Hide/Enable`, `Delete` 세 버튼을 세로로 쌓아 행을 늘리지 않는다.
- primary `Edit`은 행에 두고 secondary actions는 accessible overflow menu에 둔다.
- menu는 trigger의 `aria-expanded`, Escape, outside click, focus return 계약을 따른다.
- 삭제는 기존 confirmation 안전장치를 유지한다.

## P1-7. 읽기 오류와 mutation 오류를 구조화한다

현재 `adminGet(..., [])`, `adminPatch(..., null)` 형태로 실패를 정상 빈값처럼 다루는 부분을 조사한다.

### 요구사항

- success, not found, validation, conflict, forbidden, network/server error를 구분한다.
- API의 구조화 오류에 최소한 code, safe message, field errors, request/correlation ID를 포함한다.
- 사용자 입력 오류는 해당 field에 표시한다.
- readiness 실패는 일반 `Failed` notice가 아니라 blocking 항목 목록으로 표시한다.
- 403은 버튼을 숨기는 것과 별개로 API에서 차단한다.
- 409 conflict는 reload/compare 경로를 제공한다.
- 500/network error는 입력값을 보존하고 retry를 제공한다.
- double submit 중에는 버튼을 disabled/loading 처리한다.
- API 오류를 빈 목록 또는 성공 notice로 변환하지 않는다.
- 내부 stack, SQL, token, secret, raw HTML은 사용자 문구에 노출하지 않는다.

## P1-8. 콘텐츠 권한을 행동 단위로 분리한다

현재 Website Content의 읽기·편집·게시·삭제가 모두 `SYSTEM_POLICY`로 묶여 있다.

### 목표 권한

현재 저장소 access model에 가장 작은 diff로 다음 의미를 구현한다.

```text
CONTENT_VIEW
CONTENT_EDIT
CONTENT_PUBLISH
CONTENT_DELETE
```

정확한 enum 이름은 기존 규칙을 따른다. 기존 `SYSTEM_POLICY` 사용자를 갑자기 차단하지 않도록 backward-compatible role mapping 또는 migration 정책을 정의한다.

### 요구사항

- read endpoint, draft mutation, publish/rollback, delete를 server guard에서 각각 검사한다.
- client에서 버튼을 숨기는 것만으로 권한을 구현하지 않는다.
- View-only 운영자는 목록, 상세, Live/Draft 상태, activity를 볼 수 있지만 mutation control은 사용할 수 없다.
- Edit-only 운영자는 Draft를 저장할 수 있지만 Publish/Rollback/Delete를 실행할 수 없다.
- Publish confirmation은 게시 권한을 API에서 다시 검사한다.
- Delete는 별도 권한과 confirmation ID를 유지한다.
- 권한 부족 화면은 필요한 권한과 요청 경로를 운영자에게 설명하되 내부 보안 정보를 노출하지 않는다.
- 권한 변경과 publish/rollback/delete의 audit log를 보존한다.

maker-checker가 제품 정책상 필요한 기존 primitive가 있으면 재사용한다. 새 승인 workflow가 큰 범위라면 임의의 가짜 승인 상태를 만들지 말고, action permission 분리까지 안전하게 구현한 뒤 maker-checker의 코드 근거 blocker를 최종 보고한다.

## P2. 운영 문구와 시각 마감

다음 문구 계약을 적용한다. 기존 Admin 전체 용어와 충돌하면 가장 가까운 공통 표현을 사용하되 의미를 약화하지 않는다.

| 현재 | 권장 |
|---|---|
| Publish news | News articles / New article |
| Publish immediately | 제거, Save as draft 기본 |
| Publish article | Save draft |
| Publish state | Live status |
| Save route | Save draft changes |
| Structured content JSON | Section fields / Advanced JSON |
| Configured | Ready / Needs content / Invalid |
| Manage | Edit route |
| No routes configured | No pages match these filters — 필터 상태에서 |
| Add the first managed route | Clear filters — 필터 상태에서 |
| Locale | Language |
| Internal name | Operator label |
| No index | Hide this page from search engines |

도움말:

- URL slug: `Use lowercase letters, numbers, and hyphens. Final URL: /{language}/news/{slug}`
- Canonical: `The preferred URL reported to search engines. Leave blank to use this page URL.`
- No index: `Ask search engines not to show this live page in results.`
- Plain article body를 유지할 때: `Separate paragraphs with a blank line. Headings, links, and lists are not supported.`

### 시각 기준

- 현재 디자인 시스템과 토큰을 유지한다.
- 새 dashboard 카드와 장식 요소를 과도하게 추가하지 않는다.
- summary는 숫자보다 상태와 action 우선순위가 먼저 읽혀야 한다.
- form은 업무 순서대로 묶고 관련 없는 필드 사이의 큰 공백을 제거한다.
- primary action은 화면별 하나를 원칙으로 한다.
- danger action은 primary처럼 넓고 강하게 표시하지 않는다.
- 상태는 색상만으로 전달하지 않고 label/icon/text를 함께 사용한다.
- focus-visible, loading, disabled, error, empty, filtered-empty, conflict 상태를 구분한다.
- 영어 UI를 유지하되 개발자 용어보다 운영자 용어를 사용한다.
- 날짜와 시간은 Admin의 기존 timezone/format helper를 사용한다.
- 1440px에서 핵심 action과 도메인이 한 줄로 읽힌다.
- 다크 테마에서 새 status, preview, error, confirmation의 대비를 확인한다.

## 필수 상태 계약

다음 상태를 코드와 행동 테스트에서 다룬다.

1. Live 없음 + Draft 있음
2. Live 있음 + Draft 없음
3. Live 있음 + Draft 변경 있음
4. Draft readiness ready
5. Draft readiness blocked — SEO 누락
6. Draft readiness blocked — enabled empty section
7. Draft readiness blocked — renderer와 불일치하는 item
8. Publish 진행 중/성공/실패
9. Publish transaction 실패 후 기존 Live 유지
10. Rollback 가능/성공/실패
11. Preview authorized/expired/forbidden
12. concurrent Draft conflict
13. API 목록 오류
14. 전체 true empty
15. filtered empty
16. summary partial error
17. view-only/edit-only/publish/delete 권한
18. unsupported section kind
19. 1,000개 route pagination
20. out-of-range page/cursor
21. long operator label/path/domain
22. KO/EN/VI/JA/ZH/CJK text와 emoji 입력

## 테스트 요구

source string 존재 여부만 검사하지 말고 실제 도메인 상태 전이, API 응답, rendered markup, URL 상태, Public renderer 결과를 검증한다.

반드시 추가하거나 수정할 계약:

1. Live/Draft 동시 존재와 Draft edit의 public 무영향
2. preview authorization와 no-store/noindex
3. publish transaction rollback과 기존 Live 보존
4. news create/update 부분 실패와 거짓 success 방지
5. idempotent/deduplicated publish
6. concurrent Draft conflict
7. publishedAt 보존과 News 정렬
8. readiness와 renderer fixture 계약
9. unsafe URL, oversized JSON, invalid section schema
10. API failure와 true empty/filtered empty 분리
11. server pagination/filter/count predicate 일치
12. locale route grouping과 missing translation
13. CONTENT_VIEW/EDIT/PUBLISH/DELETE server guard
14. 기존 SYSTEM_POLICY backward compatibility 정책
15. filter/tab/page/detail URL state 회귀 없음
16. 1440 본문 폭에서 Website/action 줄바꿈 없음
17. confirmation Cancel/Escape/focus return
18. light/dark 주요 상태 markup 또는 visual regression

## baseline 및 최종 검증 명령

변경 전과 후에 관련 focused test를 실행한다. 새 spec 파일을 만들면 명령에 포함한다.

### 현재 focused baseline

```powershell
npm.cmd run test -w @massage-vn/admin-web -- app/website-content/actions.spec.ts app/website-content/website-content-pagination.spec.ts
npm.cmd run test -w @massage-vn/api -- src/site-content/site-content.service.spec.ts
npm.cmd run test -w @massage-vn/public-web -- lib/site-content.spec.ts components/public-site-section.spec.tsx
```

### Typecheck와 build

```powershell
npm.cmd run typecheck -w @massage-vn/admin-web
npm.cmd run typecheck -w @massage-vn/api
npm.cmd run typecheck -w @massage-vn/public-web

npm.cmd run build -w @massage-vn/admin-web
npm.cmd run build -w @massage-vn/api
npm.cmd run build -w @massage-vn/public-web
```

### Focused lint

변경한 파일만 현재 ESLint 규칙으로 검사한다. 예:

```powershell
Set-Location apps/admin_web
npx.cmd eslint app/website-content app/globals.css lib/admin-operator-access-model.ts lib/admin-operator-permissions.ts
Set-Location ../api
npx.cmd eslint src/site-content src/admin/admin-catalog.routes.ts src/admin/admin-operator-category.guard.ts
Set-Location ../public_web
npx.cmd eslint app/[locale]/[[...slug]]/page.tsx components/public-site-section.tsx components/public-news-pages.tsx lib/site-content.ts
Set-Location ../..
```

실제 ESLint가 CSS 또는 glob을 지원하지 않으면 성공으로 포장하지 말고 지원되는 변경 파일만 명시적으로 검사하고 skipped 이유를 보고한다.

### Prisma와 migration

```powershell
Set-Location apps/api
npx.cmd prisma format --check
npx.cmd prisma validate
npx.cmd prisma generate
Set-Location ../..
npm.cmd run prisma:migrations:check
```

현재 Prisma CLI가 `format --check`를 지원하지 않으면 schema를 쓰기 포맷하지 말고 지원되는 validate/generate를 실행하고 차이를 보고한다. 기존 dirty schema를 무관하게 포맷하지 않는다.

### Scope, 보안, protected area

```powershell
npm.cmd run security:admin-sensitive
npm.cmd run admin:visible-copy
npm.cmd run admin:query-guards
npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api
npm.cmd run verify:scope -- -Scope public
```

Prisma schema/migration, shared types 또는 다른 protected area를 변경했으므로 최종적으로 다음도 수행한다.

```powershell
npm.cmd run verify:local
powershell -ExecutionPolicy Bypass -File .\infra\scripts\verify-local.ps1 -WithServices
```

환경/외부 서비스 때문에 full verification이 실패하면 성공으로 포장하지 않는다. 명령, 첫 root cause, 이번 변경과의 관련성, 통과한 독립 검증을 구분한다.

### UI detector

UI 수정이 끝난 뒤 한 번만 실행한다.

```powershell
node C:\Users\laboy\.codex\skills\impeccable\scripts\detect.mjs --json apps/admin_web/app/website-content apps/admin_web/app/globals.css
```

detector 경고는 기계적으로 전부 고치지 말고 대상 페이지와 관련 있는 실제 결함만 수정하고 false positive를 보고한다.

## 실제 브라우저 검증

로그인된 in-app browser에서 현재 source/build가 실행 중인지 먼저 확인한다.

### 안전 규칙

- 3101 listener를 재기동해야 하면 PID, command line, working directory를 먼저 확인한다.
- 모든 `node.exe`를 종료하지 않는다.
- 기존 사용자 브라우저 탭을 닫거나 세션을 초기화하지 않는다.
- 실제 Save/Publish/Rollback/Delete/Add/Hide를 제출하지 않는다.
- confirmation과 preview는 열 수 있지만 위험 mutation은 제출하지 않는다.
- 테스트용 fixture mutation은 격리된 자동 테스트에서만 수행한다.
- console warning/error와 failed network request를 확인한다.

### 1440×900 필수 캡처

1. 기본 Pages 탭과 summary
2. route group + locale matrix 목록
3. active filter와 결과 목록
4. filtered empty
5. API error 또는 안전한 mock/test evidence
6. News 탭의 article list
7. New article Draft 작성 화면 — submit 전
8. Page detail Overview
9. Content/section editor와 readiness
10. Draft preview와 Live link가 구분된 상태
11. SEO & publishing과 Publish confirmation — 제출 전
12. Activity/revision history와 rollback confirmation — 제출 전
13. view-only 또는 publish 권한 제한 상태
14. dark theme의 Page detail 또는 Publish confirmation

### 1600×900 필수 캡처

1. Pages 기본 목록
2. Page detail workspace
3. News article editor

### 공통 확인

- page-level horizontal scroll 없음
- `hands.vn`, `join.hands.vn`, 기본 action 문자 단위 줄바꿈 없음
- current Live와 Draft changes를 혼동하지 않음
- 기본 화면에 뉴스 대형 작성 폼 없음
- detail 아래에 전역 목록/생성 폼이 중복 렌더되지 않음
- true empty, filtered empty, API error 문구가 다름
- preview와 live URL이 명확히 다름
- publish readiness와 blocking reason이 보임
- Tab/Shift+Tab/Escape/focus return 정상
- light/dark 정보 구조 동일
- full secret/token/raw credential DOM 비노출
- console error/warning 0건 — 개발 HMR 로그는 별도 구분

새 증거 폴더:

`C:\dev\massage-on-demand-vn\output\website-content-remediation-verification-2026-08-10\`

## 완료 기준

다음 항목을 모두 확인하기 전에는 `완료`라고 하지 않는다.

- [ ] 공개 Live를 유지한 채 Draft를 생성·편집·저장할 수 있다.
- [ ] Draft 저장이 public response와 first publishedAt을 변경하지 않는다.
- [ ] 일반 Page와 News 모두 인증된 Draft preview가 있다.
- [ ] Publish가 readiness, revision activation, audit를 하나의 transaction으로 처리한다.
- [ ] Publish 실패 시 기존 Live가 유지된다.
- [ ] 최소 한 개 이전 Live revision으로 rollback할 수 있다.
- [ ] 뉴스 생성·수정에 부분 실패와 거짓 성공이 없다.
- [ ] publishedAt 저장 의미와 News 정렬이 회귀하지 않는다.
- [ ] readiness를 통과한 section이 Public renderer에서 실제 visible output을 만든다.
- [ ] Pages와 News가 하나의 Website Content 안에서 분리되고 기본 화면은 목록이다.
- [ ] detail 작업 중 전역 작성/목록/새 route 폼이 중복 렌더되지 않는다.
- [ ] route group에서 KO/EN/VI/JA/ZH 상태를 비교할 수 있다.
- [ ] 목록 API가 server pagination/filter를 사용하고 section JSON을 반환하지 않는다.
- [ ] API 오류, true empty, filtered empty, permission, conflict가 구분된다.
- [ ] View/Edit/Publish/Delete 권한을 API에서 각각 강제한다.
- [ ] 1440×900에서 도메인과 기본 action이 문자 단위로 줄바꿈되지 않는다.
- [ ] 기존 delete confirmation, safe href, return URL, audit log, dark theme가 유지된다.
- [ ] focused test, typecheck, build, lint, Prisma, migration, scope/security, full local 검증 결과가 기록된다.
- [ ] 현재 source와 일치하는 새 1440/1600 캡처가 저장된다.

## 하지 말아야 할 구현

- status label만 `Live/Draft`로 바꾸고 같은 Page row를 토글하지 않는다.
- Draft 편집을 위해 기존 Live Page를 먼저 DRAFT로 내리지 않는다.
- Public Web의 fallback을 이용해 CMS/API 장애를 숨기지 않는다.
- Preview를 인증 없는 query parameter로 공개하지 않는다.
- 뉴스 create/update를 여러 API 호출로 유지한 채 UI notice만 바꾸지 않는다.
- Publish PATCH 결과를 무시하고 success notice를 표시하지 않는다.
- readiness button만 disabled하고 API 검사를 생략하지 않는다.
- JSON에 key가 있다는 이유만으로 Ready라고 표시하지 않는다.
- 실제 renderer가 없는 semantic kind를 선택지로 노출하지 않는다.
- API 오류를 `[]`, `null`, 0건 또는 healthy로 변환하지 않는다.
- 모든 route와 section JSON을 목록에서 한 번에 가져오지 않는다.
- `overflow: hidden`으로 표 문제를 숨기지 않는다.
- `Publish immediately`를 기본 선택하지 않는다.
- 새 rich-text/CMS/form/table/workflow framework를 추가하지 않는다.
- 권한 버튼만 숨기고 server guard를 그대로 두지 않는다.
- migration에서 기존 Published 콘텐츠, publishedAt, route uniqueness를 잃지 않는다.
- 기존 migration을 수정하거나 DB를 reset하지 않는다.
- 모바일·태블릿 개선으로 범위를 확장하지 않는다.
- unrelated dirty changes를 정리, revert, format하지 않는다.
- 테스트나 캡처 없이 완료라고 하지 않는다.

## 구현 우선순위

1. Live/Draft revision 모델과 안전한 migration/backfill
2. 인증된 Draft preview
3. 원자적 Publish/Rollback과 뉴스 create/update
4. publishedAt 및 readiness/renderer 계약
5. Pages/News IA와 전용 detail workspace
6. 서버 pagination, route grouping, empty/error states
7. Section schema editor와 preview/readiness UI
8. 행동 단위 권한 분리
9. 1440px 레이아웃, 문구, 다크 테마 마감
10. 전체 회귀·성능·브라우저 검증

P0가 실패한 상태에서 P2 레이아웃만 다듬고 완료 처리하지 않는다. schema나 권한 변경이 예상보다 크더라도 가짜 Draft, 가짜 Preview, client-only Publish 안전장치를 만들지 않는다.

## 최종 보고 형식

작업 후 다음 순서로 보고한다.

1. 운영자 관점에서 실제로 달라진 결과
2. P0/P1/P2별 완료·부분 완료·미완료 표
3. Live/Draft/Preview/Publish/Rollback의 before/after 상태 흐름
4. 데이터 모델과 migration/backfill 요약
5. 뉴스 create/update 원자성 및 실패 처리 결과
6. readiness와 Public renderer 공통 계약
7. Pages/News IA, route locale matrix, detail workspace 결과
8. 권한 View/Edit/Publish/Delete 강제 결과
9. API 목록 query, payload, 1,000 route 성능 before/after
10. 변경 파일과 각 파일을 바꾼 이유
11. 실행한 모든 명령과 pass/fail/skipped 결과
12. 새 1440/1600 캡처 링크
13. console, 접근성, light/dark, 개인정보·secret 노출 검증
14. protected area touched 여부와 full verification 결과
15. migration rollback 전략과 남은 데이터 위험
16. 남은 위험과 다음 권장 작업 하나

반드시 다음 증거를 포함한다.

- Draft edit 후 public response가 기존 Live와 같은 테스트
- Publish failure 후 active revision이 유지되는 테스트
- 뉴스 부분 실패에서 고아 row와 거짓 success가 없는 테스트
- preview unauthorized/expired 테스트
- publishedAt 보존 테스트
- readiness/renderer fixture 계약 테스트
- API error와 filtered empty가 다른 rendered 결과
- server pagination이 section JSON을 싣지 않는 테스트
- permission별 API guard 테스트
- 1440px에서 domain/action이 한 줄인 캡처
- focused test 개수와 결과
- browser console 결과

일부 항목이 기술적으로 불가능해도 가능한 독립 항목은 모두 완료한다. 완료되지 않은 항목은 성공으로 포장하지 말고 blocker, 코드 근거, 운영 위험, 안전한 최소 대안, 다음 한 단계를 보고한다.

최종 성공 기준은 새 카드 수나 화면의 화려함이 아니다. **운영자가 현재 공개 페이지를 중단하지 않고 초안을 편집하고, 정확한 준비 상태와 변경 차이를 확인하고, 권한 있는 게시자가 원자적으로 게시하거나 안전하게 rollback할 수 있어야 한다.**
