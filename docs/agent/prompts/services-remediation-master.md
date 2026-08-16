# Service Catalog 출시 안전성 및 운영 UX 개선용 Codex 마스터 프롬프트

이 문서는 저장소의 영구 지침이 아니라 **한 번의 구현 작업에 그대로 붙여 넣는 task prompt**다. `AGENTS.md`에 복사하지 말고, Codex에서 `C:\dev\massage-on-demand-vn`을 workspace로 연 다음 이 문서 전체를 실행 프롬프트로 사용한다.

---

당신은 HANDS의 Service Catalog를 실제 1인 운영자가 안전하게 관리할 수 있도록 개선하는 시니어 프로덕트·백엔드 엔지니어다. 단순 분석이나 화면 미화로 끝내지 말고, 현재 코드·데이터·실행 화면을 다시 검증한 뒤 **공개 카탈로그 정합성, 가격·파트너 지급액 안전성, 예약 시점 정산 스냅샷, 원자적 저장, 운영자 UX, 다국어, 테스트**를 함께 수정하라.

현재 감사 점수는 **41/100, Release hold**다. 카드 정렬이나 문구 수정만으로 완료 처리하지 않는다. 데이터 무결성 P0를 먼저 해결하고, 그 위에 운영 화면을 개선한다.

## 1. 작업 위치와 기준 자료

```text
Workspace: C:\dev\massage-on-demand-vn
Primary route: http://localhost:3101/services
Audit report: docs/audits/services-final-reaudit-2026-08-11.md
Audit evidence: docs/audits/services-reaudit-evidence-2026-08-11/
Target viewport: 1440x1000 이상 데스크톱
```

필수 증거 파일:

```text
01-services-overview.png
02-add-service-dialog.png
03-edit-service-dialog.png
04-payout-above-price-no-warning.png
06-services-list-lower.png
```

주요 코드와 데이터 흐름:

```text
apps/admin_web/app/services/**
apps/admin_web/lib/service-catalog-filters.ts
apps/admin_web/lib/service-base-payout-rule.ts
apps/admin_web/lib/admin-api.ts
apps/admin_web/components/admin-form-controls.tsx
apps/admin_web/components/admin-drawer-surface.tsx

apps/api/src/admin/admin.service.ts
apps/api/src/admin/admin.dto.ts
apps/api/src/admin/admin-service-input.spec.ts
apps/api/src/admin/admin-service-selects.ts
apps/api/src/services/services.service.ts
apps/api/src/services/service-catalog-groups.spec.ts
apps/api/src/bookings/bookings.service.ts
apps/api/src/earnings/earnings.service.ts
apps/api/src/earnings/earnings.policy.ts
apps/api/prisma/schema.prisma
apps/api/prisma/migrations/**

apps/customer_app/lib/**/customer_service_option_helpers.dart
apps/provider_app/lib/**/provider_service_price_model.dart
infra/scripts/api-smoke.mjs
```

관련 route와 deep link를 유지한다.

```text
/services
/services?dialog=new
/services?dialog=edit&group=<groupKey>
```

## 2. 최종 목표

운영자가 다음 흐름을 한 화면과 한 저장 작업으로 안전하게 완료할 수 있게 하라.

```text
공개 상태와 이상 징후 확인
→ 서비스·언어·노출 순서 확인
→ 기간별 고객 최소가·파트너 지급액·HANDS 수익 확인
→ 현재 예약·파트너·과거 지급 규칙 영향 확인
→ Draft 저장 또는 Publish
→ 변경 전후·사유·적용 범위 확인
→ 감사 기록과 실제 공개 API 결과 검증
```

완료 상태는 다음 조건을 만족해야 한다.

1. 고객 공개 API에는 명시적으로 발행된 정상 서비스만 노출된다.
2. 활성·발행 서비스 옵션은 정확히 일치하는 활성 payout rule이 없으면 공개할 수 없다.
3. 새 기간 옵션의 노출 체크박스 값이 실제 저장 payload와 일치한다.
4. 여러 기간을 수정하는 저장은 전부 성공하거나 전부 실패한다.
5. 예약 이후 서비스 가격이나 payout rule을 바꿔도 기존 예약의 정산 결과가 변하지 않는다.
6. 운영자는 현재 규칙, 과거 규칙, 누락 규칙을 구분해 볼 수 있다.
7. VI/EN 번역 준비 상태와 고객·파트너 앱의 실제 표시 문구를 확인할 수 있다.
8. 저장 전에 영향 범위, Before/After, 변경 사유, 적용 범위를 확인할 수 있다.
9. API 실패가 정상적인 빈 카탈로그처럼 보이지 않는다.
10. 1440px 이상 화면에서 핵심 비교와 수정이 빠르고 명확하다.

## 3. 작업 방식과 절대 제약

### 시작 절차

1. 루트 `AGENTS.md`를 끝까지 읽고 따른다.
2. 감사 보고서를 끝까지 읽고 모든 증거 PNG를 직접 연다.
3. `git status --short`와 관련 파일 diff를 확인한다.
4. dirty worktree는 사용자 소유다. reset, checkout, restore, clean, stash로 제거하지 않는다.
5. 보고서의 line number를 그대로 믿지 말고 현재 심볼과 호출 흐름을 다시 찾는다.
6. 현재 Admin/API build와 DB 대상이 무엇인지 확인한다. 공유·운영 DB인지 모르면 mutation을 실행하지 않는다.
7. 관련 테스트를 먼저 실행해 baseline을 기록한다.
8. 구현 계획을 P0-A → P0-B → P0-C → P1 → P2 순으로 만들고 한 번에 하나만 진행한다.
9. 단일 에이전트로 작업한다. 하위 에이전트에 위임하지 않는다.

### 제품·UI 제약

- 화면 모드는 내부 운영 도구에 맞는 `Operate`다. 장식보다 스캔 속도, 위험 인지, 정확한 저장을 우선한다.
- 기존 Vuexy 기반 Admin shell, Public Sans, 디자인 토큰, 표·배지·notice·form 패턴을 재사용한다.
- 새 UI 프레임워크, 새 상태 관리 라이브러리, 새 i18n 라이브러리, 무거운 차트 라이브러리를 추가하지 않는다.
- 이번 검수와 구현 대상은 **1440px 이상 데스크톱**이다. 1024px 이하 반응형 문제를 보고하거나 해결 범위로 확장하지 않는다.
- 이미 정해진 서비스명이나 `Partner` 용어를 임의로 다른 비즈니스 용어로 바꾸지 않는다.
- 지나친 카드 중첩, 중첩 스크롤, 거대한 안내문, 반복된 KPI, 모든 요소의 pill 처리를 피한다.
- 기존 URL query와 deep link를 깨지 않는다.

### 데이터·정산 안전 제약

- 이름에 `smoke`, `test`, timestamp가 있다는 이유만으로 데이터를 삭제하거나 숨기지 않는다.
- 실제 데이터 정리는 항상 **read-only inventory → 참조 관계 분류 → dry-run 보고서 → 명시적 apply** 순서다.
- 이번 작업 중 실제 공유·운영 DB에 cleanup apply를 실행하지 않는다. 파괴적 적용은 별도 사용자 승인을 받아야 한다.
- 테스트는 격리 DB, transaction rollback, 고유 test namespace와 확실한 teardown 중 하나 이상을 사용한다.
- 과거 payout rule이나 예약 참조 데이터는 삭제하지 않는다.
- 사용된 payout rule은 불변 버전으로 보존한다. 수정은 새 버전을 생성하고 기존 버전을 미래 적용에서만 비활성화한다.
- 기존 예약, 정산, reversal, retry는 당시 스냅샷을 사용해야 한다.
- 기존 서비스 가격 정책, 100,000 VND 단위 규칙, 권한, audit, idempotency 의미를 임의로 바꾸지 않는다.
- Prisma migration이 필요하면 additive migration만 사용하고 migration check와 보호 영역 검증을 수행한다. destructive migration이나 기존 column 의미 변경은 금지한다.

### 보호 영역

다음 경로를 수정하면 `AGENTS.md`의 보호 영역 규칙과 전체 검증을 따른다.

```text
apps/api/prisma/schema.prisma
apps/api/prisma/migrations/**
apps/api/src/bookings/**
apps/api/src/earnings/**
apps/api/src/payments/**
apps/api/src/provider-wallet/**
packages/shared-types/**
```

## 4. 구현 전에 재확인할 핵심 사실

아래는 감사 시점에 확인된 사실이다. 현재 상태를 read-only로 재측정하고 결과가 달라졌다면 증거와 함께 기록한다.

```text
Admin operational service groups: 3
Admin active duration options: 9
Active payout rules shown: 11
Public /api/services/groups: 259 groups, 436 options
Suspicious public groups: 256
Suspicious public options: 426
Exact active payout rule이 없는 public options: 86
Public response size: 343,365 bytes
Public request samples: 35.2–117.1ms
Operational options with nameTranslations = null: 9/9
```

현재 원인 후보:

1. Admin은 `/admin/services?scope=operational`에서 이름 heuristic으로 테스트 데이터를 숨긴다.
2. Public `ServicesService`는 `active=true`만 확인해 모든 활성 test/smoke row를 노출한다.
3. `infra/scripts/api-smoke.mjs`는 서비스 row를 만들고 cleanup하지 않는다.
4. 생성 화면의 기간별 active checkbox가 action payload에 반영되지 않고 `active: true`로 저장된다.
5. payout가 `null`이어도 입력 검증을 통과하고, API는 payout rule 없이 서비스를 만든다.
6. 예약 완료 정산은 예약 시점 rule이 아니라 완료 시점의 현재 active rule을 다시 읽는다.
7. 그룹 편집은 기간별 service PATCH와 payout PATCH/POST를 반복해 부분 성공이 가능하다.
8. 11개 payout rule에는 현재 9개 외에 EXPIRED booking이 참조하는 legacy rule 2개가 포함된다.
9. payout가 고객 가격보다 큰 값이어도 저장 전 inline 오류가 없고 generic redirect로 입력을 잃는다.

## 5. Slice P0-A — 공개 카탈로그 계약과 테스트 오염 차단

### 5.1 명시적인 수명주기와 출처

이름 heuristic을 공개 여부의 source of truth로 사용하지 않는다. 현재 schema를 먼저 조사한 뒤 가장 작은 내구성 있는 모델을 설계한다.

필요한 의미:

```text
publication/status: DRAFT | PUBLISHED | HIDDEN | ARCHIVED 또는 동등한 명시 상태
source/provenance: OPERATOR | SEED | SMOKE_TEST | MIGRATION 또는 동등한 식별자
active: 해당 duration option의 현재 사용 가능 여부
displayOrder: 고객 앱 노출 순서
publishedAt / publishedBy: 가능하면 감사 가능한 발행 정보
```

구현 원칙:

- 기존 운영 서비스 3개·9개 옵션은 데이터 근거를 확인한 뒤 안전하게 backfill한다.
- 과거 row를 이름만으로 자동 분류하지 않는다. 생성 audit, 참조 예약, 생성 시각, ID 목록을 함께 확인한다.
- 공개 API는 최소한 `PUBLISHED + active + 정확한 활성 payout rule + 지원 duration` 조건을 모두 만족해야 한다.
- Draft, Hidden, Archived, SMOKE_TEST provenance는 public API에서 제외한다.
- Admin operational view와 public API가 서로 다른 건강 상태를 보이지 않게 동일한 계약을 공유한다.
- public response에는 고객 앱에 필요한 필드만 포함하고 내부 note, audit, rule history를 노출하지 않는다.
- 3개 그룹·9개 옵션 기준 응답 크기는 현실적인 예산을 정해 테스트한다. 권장 상한은 32KB이며 N+1 query를 만들지 않는다.

### 5.2 Smoke 격리와 cleanup

`infra/scripts/api-smoke.mjs`의 서비스 생성 구간을 수정한다.

- 가능한 경우 전용 test database/schema 또는 transaction rollback을 사용한다.
- 불가능하면 모든 생성 ID를 추적하고 `finally`에서 참조 순서대로 제거한다.
- 생성 row에 명시적 `SMOKE_TEST` provenance와 run ID를 기록한다.
- cleanup 실패는 smoke 성공으로 숨기지 말고 실패와 남은 ID를 출력한다.
- smoke 실행 전후 public operational group/option count invariant를 검사한다.
- 운영 데이터와 같은 이름을 사용하지 않는다.

### 5.3 안전한 정리 도구

이미 쌓인 의심 데이터를 정리할 도구를 추가하되 기본 동작은 dry-run이다.

```text
npm run services:catalog-cleanup:check
npm run services:catalog-cleanup:apply -- --manifest=<reviewed-file>
```

정확한 script 이름은 저장소 관례에 맞춰도 된다. 단, 다음 계약을 지킨다.

- dry-run은 candidate ID, provenance 근거, 예약·가격·payout·audit 참조 수, 예상 조치를 machine-readable manifest와 사람이 읽는 요약으로 출력한다.
- substring 하나만으로 candidate가 되지 않는다.
- apply는 검토된 manifest와 명시적 flag가 모두 있어야 한다.
- apply는 이 작업에서 실행하지 않는다.
- 참조가 있는 row는 삭제하지 않고 archive/hide 후보로만 분류한다.
- 재실행 가능하고 idempotent해야 한다.

### P0-A 완료 조건

- public API에 smoke/test/draft row가 0개다.
- Admin header에 public catalog anomaly가 있으면 명확한 빨간 상태로 보인다.
- Admin count와 public count 차이가 상태 의미로 설명된다.
- smoke 실행 전후 공개 count가 동일하다.
- 실제 데이터 삭제 없이 dry-run 보고서를 만들 수 있다.

## 6. Slice P0-B — 생성·발행·payout 정합성

### 6.1 생성 체크박스 계약 복구

현재 `active60`, `active90`, `active120` UI 값을 server action, DTO, API까지 전달한다.

- 체크하지 않은 duration은 활성 상태로 생성하지 않는다.
- 권장 기본값은 **Save draft**다. 미완성 서비스가 고객·파트너 앱에 노출되지 않아야 한다.
- 각 기간 행에 `Customer & Partner apps: Published/Hidden` 또는 의미가 동일한 눈에 보이는 toggle label을 표시한다.
- submit 직전 요약에 생성될 기간과 공개될 기간을 분리해 보여준다.
- UI, server action, DTO, API validation, persistence에 동일한 필드 계약 테스트를 추가한다.

### 6.2 발행 gate

Draft는 번역이나 payout가 미완성이어도 저장할 수 있다. 그러나 Publish는 다음 조건을 모두 충족해야 한다.

- English name과 Vietnamese name 존재
- 지원하는 각 active duration의 customer price 존재
- 각 active duration과 customer price에 정확히 일치하는 active payout rule 존재
- partner payout가 명시적으로 입력됨. 0 VND도 의도적인 값으로 명시해야 함
- partner payout <= customer minimum price
- 가격과 payout가 VND 단위·증분 정책을 만족함
- display order와 공개 상태가 유효함

누락 시 API는 generic message가 아니라 안정적인 field error code와 필드 경로를 반환한다.

### 6.3 payout 현재·과거·누락 분리

11개 rule을 한 숫자로만 보여주지 않는다.

```text
Current rules: 현재 published option과 정확히 일치
Historical rules: 과거 가격이나 예약 참조 때문에 보존
Missing rules: published option에 필요한 rule 누락
```

- legacy Swedish 60과 Deep Tissue 90 rule의 참조를 다시 확인한다.
- 과거 rule을 삭제하지 않는다.
- 미래 예약에 필요 없다면 참조 상태를 확인한 후 active=false로 version 종료할 수 있다.
- unsettled, retry, reversal, nonterminal booking에서 필요하면 그대로 보존한다.
- rule history를 service/duration별로 inspect할 수 있게 한다.

## 7. Slice P0-C — 원자적 저장과 예약 시점 정산 스냅샷

### 7.1 그룹 단위 원자적 command

기간별로 PATCH/POST를 반복하는 client orchestration을 제거한다. 다음과 같은 단일 command endpoint 또는 동등한 application service를 만든다.

```text
PATCH /admin/services/duration-sets/:groupKey
```

하나의 요청에는 최소한 다음이 들어간다.

```text
identity/localization
publication status
display order
duration rows
customer prices
partner payouts
expected version 또는 updatedAt
change reason
idempotency key
```

서버 계약:

- Prisma transaction 하나에서 validation, service options, payout rule versions, audit change set을 처리한다.
- 하나라도 실패하면 전부 rollback한다.
- optimistic concurrency 충돌은 `409`와 현재 version 정보를 반환한다.
- 같은 idempotency key 재전송은 중복 rule이나 audit를 만들지 않는다.
- audit에는 group command ID, before, after, actor, reason, effective scope를 기록한다.
- UI는 부분 성공을 가정하지 않는다.

### 7.2 예약 시점 payout snapshot

현재 schema와 기존 booking pricing snapshot 모델을 먼저 조사한다. 중복된 스냅샷 체계를 만들지 말고, 가장 작은 내구성 있는 표현을 선택한다.

예약 생성 또는 파트너 매칭이 확정되는 업무 시점에 다음을 불변 스냅샷으로 보존한다.

```text
service option ID
service name/locale-safe label reference
duration
customer price
currency
matched payout rule ID/version
partner payout
VAT/withholding/other cost inputs that settlement calculation requires
capturedAt
policy/version provenance
```

구현 규칙:

- earnings completion, settlement retry, reversal은 현재 active rule을 다시 조회하지 않고 snapshot을 사용한다.
- 구형 예약 중 snapshot이 없는 데이터의 fallback 정책을 명시하고 audit 가능한 상태로 둔다.
- generic platform fee fallback으로 조용히 금액을 바꾸지 않는다. fallback이 불가피하면 명확한 reason code와 운영 queue를 만든다.
- 사용된 rule은 immutable이다. 새 가격은 새 rule version이다.
- 가격 변경 preflight에서 영향을 받는 nonterminal booking 수를 계산한다.
- 기존 예약의 customer price와 partner payout은 변경 이후에도 그대로 유지되어야 한다.
- migration은 additive, 재실행 안전, backfill 상태가 관측 가능해야 한다.

### P0-C 완료 조건

- 3개 duration 중 두 번째 write가 실패하는 테스트에서 DB는 변경 전 상태다.
- 같은 command를 두 번 보내도 payout rule과 audit가 중복되지 않는다.
- rule 변경 전 만든 예약을 rule 변경 후 완료해도 최초 snapshot 금액으로 정산된다.
- 구형 snapshot 누락 예약이 generic fallback으로 조용히 처리되지 않는다.

## 8. Slice P1 — 1인 운영자용 화면 구조

현재 2열 카드 나열보다 비교와 예외 처리를 빠르게 하는 구조로 바꾼다.

### 8.1 상단 상태 스트립

다음 항목만 압축해서 보여준다.

```text
Published services
Enabled duration options
Payout health: current / historical / missing
Localization readiness
Public API anomaly
Last published time / actor
```

- 같은 count를 다른 카드에서 반복하지 않는다.
- 이상이 없으면 중립 또는 성공 상태, 조치 필요 시 이유와 직접 링크를 제공한다.
- API 실패를 `0 services`로 표시하지 않는다. 오류 notice, Retry, last successful snapshot 시각을 보여준다.

### 8.2 기본 비교표

1440px 이상에서 다음 열을 한 화면에 읽을 수 있는 dense table 또는 단일 accordion 구조를 사용한다.

```text
Service
Publication
Languages
Duration pricing
Payout health
Partners / open bookings
Last change
Action
```

- 세 서비스 비교가 핵심이므로 카드 장식보다 행 정렬을 우선한다.
- `3 type(s)`, `9 option(s)` 같은 개발자식 plural을 제거한다.
- `Missing none`은 `All standard durations configured`처럼 운영 의미로 바꾼다.
- `Base price`, `Partner price` 대신 `Customer minimum`과 `Partner payout`을 사용한다.
- 모든 금액에 VND 단위와 grouping format을 적용한다.
- 고객 최소가, 파트너 지급액, HANDS gross fee와 gross margin %를 같은 행에서 비교한다.
- 활성/비활성 toggle은 텍스트 label이 항상 보여야 한다.
- 잘못된 `group` query는 빈 drawer가 아니라 not-found notice와 목록 복귀를 보여준다.

### 8.3 편집 drawer

세 영역으로 정리한다.

#### Identity & localization

- English name
- Vietnamese name
- English/Vietnamese description 또는 첫 출시 언어 정책에 맞는 명시 필드
- translation completeness
- Customer app preview / Partner app preview
- publication state와 display order

#### Duration & pricing

- 각 duration의 visible publish toggle
- Customer minimum
- Partner payout
- HANDS gross fee = customer price - partner payout
- Gross margin %
- current/historical payout rule link
- inline field validation

#### Impact & publish

- affected active partners
- partners with custom price
- affected nonterminal bookings
- Before → After diff
- required change reason
- effective scope
- `Save draft`와 `Publish changes` 분리

영향 수는 목록 전체에서 무겁게 미리 로드하지 않는다. drawer가 열릴 때 bounded endpoint로 조회하고 로딩·오류 상태를 표시한다.

### 8.4 변경 확인과 복구

1인 운영 환경이므로 maker/checker를 강제하지 않는다. 대신 다음을 강제한다.

- 고위험 변경의 구체적인 reason
- Before/After
- 영향 받은 파트너·예약 수
- Draft인지 즉시 Publish인지 명시
- 성공 receipt와 audit change-set 링크
- immutable version을 이용한 forward rollback command

rollback은 과거 row를 덮어쓰지 말고 이전 값을 새 version으로 재발행한다.

## 9. Slice P1 — 다국어와 모바일 표시 계약

현재 operational option 9개의 `nameTranslations`가 모두 null인 상태를 해결한다.

### 발행 기준

- Vietnam launch의 Published service에는 최소 VI와 EN을 요구한다.
- Draft에는 미완성을 허용하되 completeness badge를 표시한다.
- description도 translation 구조를 지원하거나, 초기 출시 언어를 명확히 정한 단일 source of truth를 둔다.

### locale resolver

고객 앱과 파트너 앱에서 공통 의미의 fallback을 사용한다.

```text
requested locale
→ Vietnamese
→ English
→ legacy name
→ stable unavailable label
```

- API DTO, Customer app, Provider app의 실제 field mapping을 계약 테스트한다.
- `null`, 빈 문자열, 일부 언어만 존재, 알 수 없는 locale을 모두 테스트한다.
- Admin preview와 모바일 resolver 결과가 동일해야 한다.
- 기존 저장 데이터와 API client를 깨는 일괄 rename을 피하고 호환 layer를 둔다.

## 10. Slice P1 — 오류, 폼, 접근성

### 폼 검증

- partner payout > customer minimum이면 해당 두 필드에 inline error를 표시하고 Save/Publish를 비활성화한다.
- 숫자 input은 VND suffix와 사람이 읽는 preview를 제공하되 서버에는 정규화된 integer를 보낸다.
- server field error는 입력값을 보존한 채 정확한 필드에 연결한다.
- generic redirect로 입력을 잃지 않는다.
- 동일 값 저장, 누락 payout, 잘못된 증분, concurrency conflict를 서로 다른 메시지로 보여준다.
- `aria-describedby`, error summary, 첫 오류 focus 이동을 구현한다.

### drawer 접근성

공통 drawer primitive를 재사용하거나 현재 `AdminDrawerSurface`를 최소 범위로 강화한다.

- dialog landmark와 accessible title
- 열릴 때 첫 의미 있는 control로 focus 이동
- Tab focus trap
- Escape close
- 닫은 뒤 trigger로 focus 복귀
- unsaved changes close guard
- overlay click 동작의 명확한 정책

## 11. Slice P2 — 문구와 시각 정리

- 중복된 H1/H2를 하나의 명확한 페이지 제목과 짧은 설명으로 정리한다.
- 설명 문장은 운영자가 판단하는 데 필요한 정보만 남긴다.
- `type(s)`, `option(s)`, `rule(s)` 같은 placeholder plural을 실제 복수 처리로 바꾼다.
- `Missing none`처럼 부정이 겹친 문구를 긍정적인 운영 문구로 바꾼다.
- 상태 색상만으로 의미를 전달하지 않고 label과 icon/text를 함께 사용한다.
- 한 row에 정보가 많더라도 핵심 가격과 위험 상태가 먼저 스캔되게 typography hierarchy를 조정한다.
- 좁은 카드에 가격 입력을 우겨 넣지 않는다. 1440px 기준 table/drawer 폭을 합리적으로 사용한다.

## 12. API와 성능 계약

1. Admin 기본 route는 상태 스트립과 비교표에 필요한 경량 데이터만 조회한다.
2. impact counts, rule history, audit details는 drawer 또는 disclosure를 열 때 조회한다.
3. public catalog는 필요한 relation만 select하고 N+1을 만들지 않는다.
4. public catalog가 비정상적으로 커지면 Admin에 anomaly를 표시하고 관측 가능한 metric/log를 남긴다.
5. 정상 3x9 fixture에서 public payload 권장 상한 32KB를 테스트한다.
6. Admin API budget 스크립트의 401이 fixture auth 만료 때문이라면 원인을 수정한다. 401을 성능 통과로 기록하지 않는다.
7. 오류, 진짜 empty state, stale last-success state를 UI와 test에서 분리한다.

## 13. 필수 테스트

구현한 계층에서 실제 회귀를 잡는 테스트를 추가한다.

### API·DB

1. public API가 Draft, Hidden, Archived, SMOKE_TEST row를 제외한다.
2. Published+active option은 정확한 active payout rule 없이는 거절된다.
3. unchecked duration은 inactive 또는 미생성 상태로 저장된다.
4. payout missing은 Draft 저장 가능, Publish 불가다.
5. payout > customer price는 구조화된 field error다.
6. duration-set command 중간 실패 시 전부 rollback된다.
7. 동일 idempotency key 재전송 시 중복 row/audit가 없다.
8. expected version 충돌은 409이며 기존 데이터를 바꾸지 않는다.
9. booking payout snapshot이 이후 rule 변경에도 불변이다.
10. settlement retry/reversal도 동일 snapshot을 사용한다.
11. historical rule 비활성화 전 nonterminal/unsettled 참조 guard가 동작한다.
12. smoke 실행 전후 public catalog count invariant가 유지된다.
13. cleanup dry-run이 참조 row를 delete candidate로 분류하지 않는다.

### Admin Web

1. API failure, empty, stale last-success를 구분한다.
2. create form active toggle이 submit payload에 정확히 반영된다.
3. payout missing/over-price/invalid increment에서 inline error와 disabled action이 동작한다.
4. server field errors 후 입력값이 유지된다.
5. current/historical/missing rule count가 정확하다.
6. invalid group query가 not-found notice를 보여준다.
7. Before/After와 impact summary가 저장 전에 보인다.
8. 단수·복수와 visible copy가 자연스럽다.
9. drawer keyboard focus lifecycle이 동작한다.

### 모바일

1. requested locale → vi → en → legacy name fallback을 검증한다.
2. VI만, EN만, 둘 다, null, 빈 번역 케이스를 검증한다.
3. Customer app과 Partner app이 동일한 서비스 옵션을 같은 의미로 표시한다.

## 14. 검증 명령

현재 package script와 파일 존재 여부를 먼저 확인한 뒤 아래와 동등한 검증을 실행한다.

### 기존 baseline과 집중 테스트

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- app/services lib/service-catalog-filters.spec.ts lib/service-base-payout-rule.spec.ts
npm.cmd run test --workspace @massage-vn/api -- src/admin/admin-service-input.spec.ts src/admin/admin-service-selects.spec.ts src/services/service-catalog-groups.spec.ts
npm.cmd run test --workspace @massage-vn/api -- src/bookings/bookings.service.spec.ts src/earnings/earnings.policy.spec.ts src/earnings/earnings.service.spec.ts
```

### 정적·범위 검증

```powershell
npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run typecheck --workspace @massage-vn/api
npm.cmd run admin:visible-copy
npm.cmd run admin:api-budget
npm.cmd run prisma:migrations:check
npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api
```

모바일 또는 shared contract를 수정했다면:

```powershell
npm.cmd run verify:scope -- -Scope customer
npm.cmd run verify:scope -- -Scope provider
npm.cmd run verify:scope -- -Scope mobile
```

보호 영역 또는 정산 동작을 수정했다면 마지막에:

```powershell
npm.cmd run verify:local
```

명령이 환경·인증 문제로 실패하면 실패 사실, 원인, 재현 명령을 보고한다. 실행하지 않은 검증을 통과로 기록하지 않는다.

## 15. 브라우저 QA

로그인된 로컬 Admin과 격리 fixture를 사용해 검증한다. 실제 운영 가격과 서비스 상태를 바꾸는 submit은 하지 않는다.

검증 viewport:

```text
1440x1000 필수
1680x1050 선택
1024px 이하 제외
```

캡처할 상태:

1. 기본 서비스 비교표와 정상 health strip
2. public anomaly 상태
3. API error와 Retry 상태
4. Add service Draft 기본값
5. payout 누락/초과 inline error
6. Edit drawer의 current/historical rule
7. impact summary와 Before/After confirmation
8. VI/EN completeness와 app preview
9. 저장 성공 receipt 또는 test fixture 성공 상태
10. keyboard focus와 unsaved close guard 증거

화면 확인 시 다음을 점검한다.

- 1440px에서 핵심 가격 열이 불필요하게 잘리지 않는가
- 상단 요약이 목록과 중복되지 않는가
- 위험 상태가 count만 있고 의미가 빠지지 않았는가
- VND와 margin이 즉시 이해되는가
- hidden toggle label이 없는가
- drawer 내부 중첩 스크롤이 생기지 않는가
- 실제 빈 상태와 오류 상태를 혼동하지 않는가

## 16. 완료 산출물

구현과 함께 다음을 만든다.

```text
docs/audits/services-remediation-report-2026-08-11.md
docs/audits/services-remediation-evidence-2026-08-11/
```

보고서에는 다음을 포함한다.

1. 구현 전후 구조와 root cause
2. P0/P1/P2 항목별 완료·미완료 상태
3. schema/migration 및 backfill 설명
4. public/Admin 실제 count와 payload 크기 전후 비교
5. payout snapshot과 versioning 계약
6. cleanup dry-run 결과와 apply 미실행 사실
7. 테스트 명령과 실제 결과
8. 1440px 캡처 목록
9. 변경 파일 목록
10. 보호 영역 변경 여부
11. 남은 위험과 출시 차단 항목
12. 다음에 할 가장 중요한 한 가지

## 17. 최종 인수 기준

다음 체크리스트가 모두 충족되기 전에는 `완료`라고 하지 않는다.

```text
[ ] public API에서 smoke/test/draft 데이터가 노출되지 않는다.
[ ] public filter가 이름 heuristic이 아닌 명시 상태/출처를 사용한다.
[ ] smoke가 서비스 데이터를 남기지 않는다.
[ ] cleanup은 dry-run과 explicit apply가 분리되어 있고 apply는 실행하지 않았다.
[ ] 생성 active toggle이 실제 persistence와 일치한다.
[ ] Draft와 Publish가 분리되어 있다.
[ ] Published option은 exact payout rule을 가진다.
[ ] 여러 duration 저장이 원자적이다.
[ ] optimistic concurrency와 idempotency가 있다.
[ ] booking/settlement/retry/reversal이 예약 시점 payout snapshot을 사용한다.
[ ] historical payout rule을 삭제하지 않고 구분 표시한다.
[ ] current/historical/missing 11 vs 9 차이를 설명할 수 있다.
[ ] VI/EN 발행 gate와 모바일 fallback이 검증됐다.
[ ] 고객가·파트너 지급액·HANDS fee/margin이 명확하다.
[ ] API error가 empty state로 보이지 않는다.
[ ] 영향 수, Before/After, reason이 저장 전에 보인다.
[ ] 고위험 변경 성공 receipt와 audit link가 있다.
[ ] drawer keyboard 접근성과 입력 보존이 동작한다.
[ ] 1440x1000 화면 검증과 증거가 있다.
[ ] focused tests, typecheck, scope verification이 통과했다.
[ ] 보호 영역 변경 시 migration check와 verify:local을 수행했다.
[ ] 실제 공유·운영 데이터에 파괴적 cleanup을 적용하지 않았다.
```

## 18. 중단 조건과 의사결정 원칙

작업량이 크다는 이유로 분석만 하고 멈추지 않는다. P0-A부터 순서대로 구현하고 각 slice를 테스트한다.

다만 다음 경우에는 상태와 증거를 정리하고 사용자에게 확인한다.

- 공유·운영 DB에 실제 cleanup apply가 필요할 때
- 기존 dirty change와 같은 코드에서 의도를 보존할 수 없는 충돌이 있을 때
- 어떤 DB가 운영 데이터인지 확인할 수 없을 때
- payout snapshot 시점이 예약 생성인지 파트너 매칭 확정인지 현재 도메인 코드만으로 결정할 수 없고 금액 결과가 달라질 때
- 기존 비즈니스 정책을 바꿔야만 해결 가능한 요구가 발견될 때

그 외에는 합리적인 가정을 문서화하고 계속 진행한다.

## 19. 최종 응답 형식

최종 응답은 결과부터 간결하게 보고한다.

```text
Outcome
- Release hold 해제 가능 여부
- 핵심 P0 해결 요약

Changed files
- 파일과 목적

Verification
- 명령: PASS/FAIL
- 1440px QA 증거

Protected areas / migrations
- 변경 여부와 검증

Data safety
- cleanup dry-run 결과
- apply 미실행 확인

Remaining risks
- 출시 차단/비차단 구분

Next action
- 가장 중요한 한 가지
```

실제 완료되지 않은 항목은 `미완료`로 표시한다. 화면이 예뻐졌다는 이유로 데이터·정산 P0를 완료 처리하지 않는다.
