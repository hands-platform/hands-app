# Service Catalog 최종 재감사 보고서

- 감사 일자: 2026-08-11
- 대상: Admin `Service Catalog` 목록, 신규 서비스 패널, 기존 서비스 편집 패널, 공개/Partner 서비스 API, 부킹·정산 연결 계약
- 화면 기준: 1440 x 1000 데스크톱만 검수함. 1024px 이하 화면은 이번 범위에서 제외함.
- 감사 방법: 로그인된 실제 화면 캡처, DOM·상호작용 확인, 현재 DB의 읽기 전용 정합성 검사, Admin Web·API·모바일 코드 추적, 관련 단위 테스트와 정적 검사 실행
- 변경 범위: 제품 코드는 수정하지 않았으며 보고서와 증거 캡처만 추가함.

## 1. 결론

이전보다 화면은 훨씬 정돈됐다. 3개 서비스와 60/90/120분 가격을 한눈에 볼 수 있고, 생성·편집을 우측 패널로 통일했으며, API의 기본 가격·지급액 검증과 감사 기록도 존재한다. **시각적 완성도만 보면 내부 관리 화면으로 사용할 수 있는 수준**이다.

그러나 실제 운영 계약은 화면이 보여 주는 것보다 훨씬 위험하다. Admin은 3개 서비스 유형과 9개 옵션만 보여 주지만, 같은 실행 환경의 공개 서비스 API는 **259개 그룹, 436개 옵션**을 반환했고 그중 **256개 그룹·426개 옵션이 smoke/test/timestamp 데이터**였다. 또한 신규 패널의 `enabled` 토글은 생성 action에서 읽지 않으며, 가격만 입력하면 토글이 꺼져 있어도 active 서비스가 생성된다. Partner payout을 비워도 active 서비스가 생성되어 고객에게 노출된 뒤 부킹 단계에서 실패할 수 있다.

더 심각하게는 기존 가격·지급액 수정이 3개 duration과 payout rule을 여러 HTTP 요청으로 순차 저장하고, 완료되지 않은 부킹의 payout snapshot을 만들지 않는다. 정산은 완료 시점에 현재 active payout rule을 다시 조회하므로 가격 규칙을 덮어쓰면 이미 생성된 부킹의 Partner 지급 계산이 바뀌거나 일반 fee policy로 fallback할 수 있다.

**종합 점수: 41/100 — 화면 재디자인은 진전됐지만, 공개 카탈로그 오염과 생성·정산 계약 때문에 출시 보류가 타당하다.**

출시 전 우선순위는 다음 네 가지다.

1. smoke/test 데이터가 공개 `/services/groups`에 노출되지 않도록 즉시 차단하고 공유 DB 오염을 정리한다.
2. 신규 서비스는 payout rule과 표시 상태가 일치할 때만 원자적으로 생성하고 기본값은 Draft로 둔다.
3. 서비스 그룹 전체 수정과 payout rule 변경을 하나의 API transaction으로 만든다.
4. 부킹 생성 시 적용 payout rule 또는 지급 금액을 snapshot하여 이후 정책 수정이 기존 부킹을 소급 변경하지 못하게 한다.

## 2. 점수표

| 영역 | 점수 | 판단 |
|---|---:|---|
| 운영자 과업 명확성 | 61/100 | 목록·추가·편집 흐름은 단순하지만 노출·정산 영향이 보이지 않음 |
| 1440px 화면 구성 | 78/100 | 정렬·간격·금액 가독성은 좋으나 중복 헤더와 큰 카드 밀도는 개선 여지 있음 |
| 생성·편집 안전성 | 24/100 | 토글 무시, payout 누락 허용, 부분 저장, 입력 중 경고 부재 |
| 카탈로그 데이터 신뢰성 | 12/100 | Admin 3개와 공개 API 259개가 불일치하고 smoke 데이터가 고객 API에 노출됨 |
| 가격·정산 무결성 | 26/100 | 서버 검증·감사 로그는 있으나 booking-time payout snapshot과 원자적 그룹 수정이 없음 |
| 다국어·고객 노출 정합성 | 20/100 | 운영 9개 옵션의 번역이 모두 비어 있고 모바일은 번역 필드를 사용하지 않음 |
| 접근성·문구 | 55/100 | dialog role은 있으나 토글 설명, 초점 관리, 인라인 오류, 복수형 문구가 부족함 |
| 성능·로딩 구조 | 42/100 | Admin 조회는 가볍게 설계했지만 공개 카탈로그가 343KB까지 팽창함 |
| 권한·감사 추적 | 76/100 | `SYSTEM_SERVICES` 권한과 before/after 감사 메타데이터는 갖춰짐 |
| 테스트 실효성 | 49/100 | 32개 관련 테스트는 통과하지만 구조·atom 사용 위주이며 실제 공개 노출·부분 저장을 검증하지 않음 |

## 3. 잘된 부분

1. 1440px에서 서비스별 60/90/120분 가격과 Partner 지급액을 비교하기 쉽다.
2. 생성과 편집을 같은 우측 패널 패턴으로 통일해 화면 이동 비용이 낮다.
3. `Service Catalog`는 `SYSTEM_SERVICES` 권한으로 보호되고 기본 소유자가 Master Admin으로 정의돼 있다.
4. API는 가격이 100,000 VND 단위를 따르는지, Partner payout이 customer price를 넘지 않는지 다시 검증한다.
5. 서비스 단건 변경은 before/after, changed fields, 자동 보정된 Partner 가격 수를 감사 메타데이터에 기록한다.
6. 서비스 duration set 신규 생성 API는 DB transaction 안에서 서비스와 payout rule을 생성한다.
7. 서비스 목록 API select는 providers와 bookings 전체를 싣지 않는 경량 구조이며 별도 성능 예산도 정의돼 있다.
8. 관련 Admin Web 20개, API 12개 단위 테스트가 모두 통과했고 visible-copy 검사도 통과했다.

## 4. P0 — 출시 전 필수 수정

### P0-1. Admin이 숨긴 smoke/test 서비스가 공개 고객 API에는 그대로 노출된다

실제 실행 환경을 읽기 전용으로 검사한 결과는 다음과 같다.

| 항목 | 실제 값 |
|---|---:|
| Admin 화면 서비스 유형 | 3 |
| Admin 화면 active 옵션 | 9 |
| 공개 `/services/groups` 그룹 | 259 |
| 공개 API 옵션 | 436 |
| 의심 smoke/test/timestamp 그룹 | 256 |
| 의심 옵션 | 426 |
| exact active payout rule이 없는 공개 옵션 | 86 |
| 공개 응답 크기 | 343,365 bytes |

원인은 구조적이다.

- Admin 페이지는 `apps/admin_web/app/services/page.tsx:12-15`와 API의 `apps/api/src/admin/admin.service.ts:24048-24058`에서 `scope=operational` 결과를 다시 필터링한다.
- 필터는 `apps/api/src/admin/admin.service.ts:37025-37040`에서 이름에 `smoke`, 단독 `test`, 10자리 이상 숫자가 있는 행을 휴리스틱으로 숨긴다.
- 반면 공개 API는 `apps/api/src/services/services.service.ts:12-22`에서 `active: true`만 확인하고 모든 active 서비스를 반환한다.
- `infra/scripts/api-smoke.mjs:1609-1756`은 실제 서비스와 payout rule을 공유 DB에 계속 생성하지만 정리 단계가 없다.
- 서비스 삭제/보관 API도 없어 반복 실행될수록 데이터가 누적된다.

이 문제는 Admin 화면만 보면 발견할 수 없다. 운영자는 정상 3개만 보지만 고객 앱은 오염된 259개 그룹을 받을 수 있다. 검색과 렌더 성능뿐 아니라 고객이 테스트 서비스를 선택하고 부킹 단계에서 실패하는 문제로 이어진다.

수정 요건:

- smoke/E2E는 운영·개발 공유 DB가 아닌 전용 테스트 DB 또는 transaction rollback 환경에서만 실행한다.
- 기존 데이터는 dry-run 보고서로 `확실한 자동 테스트 / 실제 데이터 가능성 / 참조 중`을 분류한 뒤 확실한 자동 데이터만 archive 또는 삭제한다.
- `MassageService`에 이름 휴리스틱이 아닌 명시적 `environment`, `source`, `publicationStatus` 또는 `testFixture` 필드를 둔다.
- 공개 서비스 API는 `PUBLISHED`, active, 고객가와 정확히 일치하는 active payout rule 보유, 지원 duration 조건을 모두 충족한 옵션만 반환한다.
- Admin 화면 상단에 `Public catalog health`를 표시하고 Admin 목록 수와 공개 API 수가 다르면 danger 상태로 보여 준다.
- 공개 카탈로그 계약 테스트에서 smoke/test fixture와 payout 누락 옵션이 절대 노출되지 않음을 검증한다.

완료 기준:

- 공개 API가 의도한 3개 그룹과 9개 옵션만 반환한다.
- 공개 응답에서 smoke/test/timestamp 서비스가 0개다.
- active지만 exact payout rule이 없는 옵션이 0개다.
- 같은 smoke를 반복 실행해도 운영 DB 서비스 수가 증가하지 않는다.

### P0-2. 신규 생성 화면의 Enabled 토글과 실제 저장 결과가 반대일 수 있다

신규 화면에서는 60/90/120분 행의 체크박스가 꺼져 있다. 운영자는 이 상태를 `비활성`으로 이해한다. 그러나 `createServiceDurationSet`은 `active60`, `active90`, `active120`을 읽지 않고 `active: true` 하나만 API에 전송한다.

근거:

- 체크박스는 `service-catalog-manager-section.tsx:322-327`에서 렌더된다.
- 신규 action은 `actions.ts:107-146`에서 가격과 payout만 읽고 checkbox를 무시한다.
- 같은 action은 `actions.ts:141`에서 모든 생성 행에 `active: true`를 강제한다.
- 신규 패널 스크린샷에서 토글은 꺼져 있지만 Save 버튼은 활성 상태다.

수정 요건:

- 각 duration row의 `active` 값을 action과 API DTO에 명시적으로 전달한다.
- 신규 서비스 기본값은 `DRAFT` 또는 inactive로 둔다.
- `Enabled`는 단순 기술 상태가 아니라 `Customer & Partner apps에 노출`로 가시적으로 설명한다.
- 저장 전 요약에 `공개됨 2개 / 비공개 1개`를 보여 준다.
- UI 입력, server action payload, API 저장 결과가 동일한지 통합 테스트를 추가한다.

완료 기준:

- 토글이 꺼진 duration은 저장 후에도 inactive이고 공개 API에 나타나지 않는다.
- 토글이 켜진 duration만 활성화된다.
- 새 서비스는 명시적 Publish 전까지 고객에게 노출되지 않는다.

### P0-3. payout을 비워도 active 서비스가 생성되어 고객이 마지막 단계에서 실패할 수 있다

가격 행은 base price만 입력하면 생성 대상이 된다. Partner payout은 required가 아니고 `null`을 유효한 값으로 처리한다. API는 payout rule 없이 active 서비스를 생성하며 공개 API도 이를 반환한다. 고객이 해당 서비스를 선택하면 부킹 생성 시점에야 `Admin payout rule is required...` 오류가 발생한다.

근거:

- `service-action-input.ts:19-20`은 `null` payout을 유효한 값으로 본다.
- `actions.ts:107-128`은 base price가 있으면 payout 누락 행도 통과시킨다.
- `actions.ts:142-146`은 payout이 null인 duration도 duration-set API에 보낸다.
- API는 payout이 있을 때만 rule을 생성한다: `admin.service.ts:24156-24173`.
- 공개 API는 payout 존재 여부를 필터하지 않는다: `services.service.ts:12-22`.
- 실제 공개 옵션 중 86개가 exact active payout rule 없이 노출 중이다.
- 부킹 API는 가장 늦은 단계인 `bookings.service.ts:1287-1299`에서 이를 거부한다.

수정 요건:

- active/PUBLISHED duration은 base price와 Partner payout을 모두 필수로 한다.
- `0 VND payout`은 의도한 값일 때만 허용하되 명시적 확인을 요구한다.
- payout 누락 행은 Draft로만 저장 가능하고 공개 API와 Partner activation 대상에서 제외한다.
- Save 전에 `Customer price`, `Partner payout`, `HANDS gross fee`, `%`를 계산해 한 행에 보여 준다.
- 서버와 UI 모두 exact payout rule 미존재를 필드 단위 오류로 반환한다.

완료 기준:

- payout이 비어 있는 상태에서는 `Publish`가 비활성화된다.
- payout 누락 Draft는 저장할 수 있어도 고객 API에는 노출되지 않는다.
- 고객이 화면에서 선택 가능한 모든 서비스는 부킹 생성 payout guard를 통과한다.

### P0-4. 기존 부킹의 Partner 지급 규칙이 booking-time에 고정되지 않는다

현재 정산은 부킹 완료 시 `serviceId + booking price`에 맞는 **현재 active payout rule**을 DB에서 다시 찾는다. 기존 payout rule을 수정하거나 customerPrice를 바꾸면 이미 생성된 부킹의 정산 규칙도 소급해서 달라질 수 있다. rule을 찾지 못하면 서비스별 payout 계산을 포기하고 일반 platform fee policy로 fallback한다.

근거:

- `earnings.service.ts:3603-3619`은 완료 처리 시 active payout rule을 조회한다.
- `earnings.policy.ts:384-401`은 모든 서비스에 exact rule이 없으면 `null`을 반환한다.
- `earnings.service.ts:3474-3499`는 서비스별 rule이 없으면 platform fee policy로 fallback한다.
- `BookingService`는 `serviceId`, `quantity`, `price`만 보관하고 payout rule ID/금액 snapshot이 없다: `schema.prisma:1356-1366`.
- 편집 action은 기존 base rule ID를 그대로 PATCH하며 customerPrice까지 변경한다: `actions.ts:251-270`.

수정 요건:

- 부킹 생성 또는 Partner 매칭 확정 시 `payoutRuleId`, Partner payout, VAT, other cost, currency를 immutable snapshot으로 저장한다.
- 완료·정산은 현재 rule이 아니라 booking snapshot을 사용한다.
- 사용 이력이 있는 payout rule은 값 덮어쓰기를 금지하고 새 version을 만든다.
- 가격 변경 전 non-terminal booking 수와 영향을 preflight로 보여 준다.
- 과거 rule은 `Historical — referenced by N bookings`로 보존하고 future availability만 종료한다.

완료 기준:

- 부킹 생성 후 서비스 가격·payout을 바꿔도 해당 부킹의 Partner 지급액이 변하지 않는다.
- 정산 재시도와 reversal도 같은 snapshot을 사용한다.
- 사용 이력 있는 rule을 수정하려 하면 새 version 생성 흐름으로 전환된다.

### P0-5. 3개 duration 편집이 원자적이지 않아 일부만 저장될 수 있다

신규 duration set API는 transaction을 사용하지만 편집은 60→90→120분을 순회하며 서비스 PATCH와 payout PATCH/POST를 따로 호출한다. 중간 요청이 실패하면 앞선 변경은 이미 저장됐고 화면은 마지막에 generic `API rejected`만 보여 준다.

근거:

- `actions.ts:212-277`이 duration별로 최대 2개 API 요청을 순차 실행한다.
- 서비스와 payout 저장 사이에도 별도 transaction 경계가 있다.
- 실패 시 `actions.ts:247-275`에서 즉시 redirect하므로 어떤 행까지 저장됐는지 운영자가 알 수 없다.
- 기존 API에는 그룹 전체를 원자적으로 수정하는 endpoint가 없다.

수정 요건:

- `PATCH /admin/services/duration-sets/:groupKey`를 추가하고 서비스 identity, 3개 duration, payout rules를 한 transaction에서 검증·저장한다.
- 요청에 `expectedUpdatedAt` 또는 version을 넣어 stale edit를 차단한다.
- 같은 request의 감사 로그는 하나의 change set ID로 묶고 duration별 before/after를 포함한다.
- 실패 시 전부 rollback하고 입력값을 유지한다.
- 중복 제출을 막기 위한 pending 상태와 idempotency key를 적용한다.

완료 기준:

- 90분 payout validation을 의도적으로 실패시켰을 때 60/90/120분 모두 변경 전 상태다.
- 네트워크 재시도에도 서비스·rule이 중복 생성되지 않는다.
- 성공 시 감사 로그 한 건에서 그룹 전체 변경 내용을 확인할 수 있다.

## 5. P1 — 높은 우선순위

### P1-1. `11 payout rules`와 `9 active options`의 차이를 설명하지 않는다

현재 11개 rule은 오류 11개가 아니다. 9개는 현재 base price rule이고 2개는 과거 고객가 450,000/690,000 VND rule이다. 두 과거 rule은 각각 6건·4건의 EXPIRED 부킹과 연결돼 있으나 계속 active다. 화면은 단순 숫자만 표시하고 어떤 서비스에 추가 rule이 있는지, 현재/과거/누락 중 무엇인지 알 수 없다.

권장:

- 상단을 `9 current rules · 2 historical rules · 0 missing`으로 분리한다.
- 각 duration 행에서 현재 rule과 historical price ladder를 펼쳐 볼 수 있게 한다.
- 참조가 종료된 legacy rule은 future matching에서 inactive로 전환하되 audit/history에는 보존한다.
- 숫자 badge는 클릭 시 해당 필터 목록으로 이동하게 한다.

### P1-2. 다국어 입력은 있지만 실제 운영 데이터와 모바일 소비 계약은 비어 있다

운영 9개 옵션의 `nameTranslations`는 모두 null이다. Admin은 English만 필수로 하고 Vietnamese/Korean/Japanese/Chinese 누락을 표시하지 않는다. 더구나 고객·Partner Flutter 코드는 `nameTranslations`를 읽지 않고 `service['name']`만 사용한다.

근거:

- Admin 필드: `service-catalog-manager-section.tsx:32-38`, English만 required: `:256-266`.
- 고객 앱은 `customer_service_option_helpers.dart:51,85,158` 등에서 `name`만 읽는다.
- Partner 앱은 `provider_service_price_model.dart:35`에서 `name`을 사용한다.
- description은 단일 문자열이라 언어별 설명을 저장할 모델도 없다.

권장:

- Vietnam 출시 기준 Vietnamese를 필수, English를 fallback 필수로 정의한다.
- 모바일 locale resolver가 `nameTranslations[locale] -> vi -> en -> name` 순서로 사용하게 한다.
- description도 언어별 필드를 지원하거나 첫 출시 언어를 명확히 제한한다.
- 카드에 `VI missing`, `4/5 languages` 상태를 보여 준다.
- 저장 전 실제 고객/Partner 앱 언어 미리보기를 제공한다.

### P1-3. 화면에서 가격·지급·마진의 관계를 계산하기 어렵다

목록의 `Base`, `Partner`는 개발자에게는 이해되지만 운영자에게는 모호하다. 편집 입력은 `500000` 같은 raw 숫자를 보여 주고 통화 단위, 천 단위 구분, HANDS 수익, 마진율을 표시하지 않는다.

권장 문구와 구조:

- `Base` → `Customer minimum`
- `Partner` → `Partner payout`
- 세 번째 값 → `HANDS gross fee 100,000 VND · 20%`
- 입력 오른쪽에 `VND` suffix와 포맷된 읽기값을 표시한다.
- payout > customer price, step 오류, 0 payout은 입력 즉시 행 안에서 경고한다.

### P1-4. 활성화·가격 변경 전 운영 영향이 보이지 않는다

서비스를 끄거나 최소 가격을 올리면 API는 낮은 Partner 가격을 자동으로 base price까지 올린다. 감사 메타데이터에는 조정 수가 기록되지만 저장 전에는 대상 Partner 수, 진행 중 부킹 수, 예약된 부킹 수를 볼 수 없다.

근거:

- API 자동 보정: `admin.service.ts:24233-24241`.
- Admin lightweight select는 providers/bookings count를 의도적으로 제외한다: `admin-service-selects.ts:104-131`.

권장:

- 편집 패널을 열 때 별도 impact summary endpoint로 active Partner, custom-price Partner, non-terminal bookings를 조회한다.
- 저장 전 `3 Partners' prices will rise`, `2 open bookings keep current snapshot`처럼 결과를 보여 준다.
- deactivate는 `Hide from new selection`과 `Archive after current bookings`를 구분한다.

### P1-5. API 장애가 실제 빈 카탈로그처럼 보인다

페이지는 `adminGet(..., [])`을 사용한다. 401, 500, timeout이 모두 빈 배열로 바뀌어 `No service menu items are registered`가 표시된다. 운영자는 데이터가 정말 0개인지 시스템이 실패했는지 구분할 수 없다.

수정 요건:

- `adminGetResult`로 `ok/status`를 유지한다.
- 오류면 기존 캐시를 유지하고 `Catalog could not be loaded · Retry`를 표시한다.
- 빈 상태는 성공 응답의 빈 배열일 때만 사용한다.
- 마지막 성공 시각과 source를 표시한다.

### P1-6. 서버 검증은 있지만 입력 중 피드백과 오류 복구가 없다

Partner payout을 customer price보다 크게 입력해도 화면에는 경고가 없고 Save 버튼은 계속 활성이다. 저장 후에야 drawer가 닫히고 상단 generic 오류로 돌아간다. 입력값도 잃는다.

권장:

- 각 행을 controlled client form 또는 검증 가능한 client island로 만들고 즉시 검증한다.
- `English required`, `At least one duration`, `payout required when published`, `100,000 VND steps`를 필드 아래 표시한다.
- 상단 오류 요약과 첫 오류 focus 이동을 제공한다.
- API의 400 error code와 field errors를 보존하고 generic `api-rejected`로 합치지 않는다.
- 유효하지 않을 때 Save를 비활성화하고 이유를 표시한다.

### P1-7. 위험한 변경에 사유·확인·복구 경로가 없다

가격과 Partner 지급액은 정산 정책이지만 Save 한 번으로 즉시 반영된다. 운영자는 변경 사유, 적용 시점, 변화 요약, 감사 ID를 볼 수 없고 `Undo`도 없다.

1인 운영을 전제로 별도 승인자를 강제할 필요는 없지만 다음은 필요하다.

- 변경값 `Before → After` 요약
- 12–500자 변경 사유
- `현재 부킹에는 snapshot 유지 / 신규 부킹부터 적용` 적용 범위
- 저장 성공 후 audit ID와 Audit Log 링크
- 오입력 복구를 위한 새 version 기반 rollback

### P1-8. 실제 고객 노출 순서와 공개 상태를 운영자가 관리할 수 없다

`displayOrder`는 hidden 값이고 신규 그룹은 같은 기본 order를 사용한다. 여러 신규 서비스의 순서는 group key 알파벳 순서에 의존할 수 있다. 고객 앱에서 어떤 순서로 보이는지 preview도 없다.

권장:

- 목록에 `Customer order`를 표시하고 drag 또는 명시적 순서 입력을 제공한다.
- 저장과 Publish를 분리한다.
- `Draft / Published / Hidden / Archived` 상태를 도입한다.
- 고객 홈과 Partner 서비스 선택 미리보기를 같은 데이터로 렌더한다.

### P1-9. drawer의 접근성 계약이 불완전하다

`role="dialog"`, `aria-modal`과 accessible close label은 좋다. 그러나 서버 렌더된 aside일 뿐 focus trap, open 시 첫 필드 focus, Escape close, close 후 원래 Edit 버튼 focus 복원이 없다. 배경 링크도 키보드로 계속 접근 가능하다.

권장:

- 공용 client drawer primitive로 focus trap, Escape, focus restore, scroll lock을 구현한다.
- 제목 ID를 만들고 `aria-labelledby`로 연결한다.
- backdrop을 focusable anchor가 아닌 비포커스 dismiss layer로 처리한다.
- 변경 중 닫기를 누르면 `Discard changes?`를 확인한다.

## 6. P2 — 품질 개선

### P2-1. 중복 헤더와 설명을 하나로 줄인다

상단 H1 `Service Catalog` 아래에 다시 H2 `Service catalog`와 유사한 설명이 나온다. 페이지 제목은 한 번만 사용하고 첫 카드 제목을 `Published services` 또는 `Catalog health`처럼 실제 역할로 바꾸는 편이 낫다.

### P2-2. 개발자식 복수형을 제거한다

`3 service type(s)`, `9 active option(s)`, `11 payout rule(s)`, `3 option(s)`은 완성도를 떨어뜨린다. `3 service types`, `1 service type`, `9 active options`처럼 공통 plural helper를 사용한다.

### P2-3. `Missing none`을 정상 상태 문구로 바꾼다

`3 option(s); Missing none`은 무엇이 누락되지 않았는지 불명확하다. 정상이라면 `All standard durations configured`, 누락이면 `Missing 120 min` warning만 표시한다.

### P2-4. 활성 토글의 가시 레이블을 표시한다

패널에는 체크 표시만 있고 `60 min option enabled` 텍스트는 screen-reader 전용이다. 각 행 오른쪽에 `Published` 또는 `Hidden`을 명시하고 토글 전체를 클릭 가능하게 한다.

### P2-5. 3개 서비스에서는 비교형 표가 카드보다 효율적이다

현재 2열 카드라 세 번째 카드 오른쪽이 비고 가격 비교를 위해 시선이 좌우·아래로 움직인다. `Service / Status / 60m / 90m / 120m / Language / Health / Edit` 형태의 표 또는 한 줄 accordion이면 세 서비스의 가격과 누락을 더 빨리 비교할 수 있다. 카드 유지 시 1440px에서 3열도 검토할 수 있지만 운영 밀도는 표가 더 적합하다.

### P2-6. 잘못된 edit query에 명시적 상태가 없다

`?dialog=edit&group=unknown`이면 drawer가 열리지 않고 안내도 없다. `Service not found or no longer available` notice와 목록 복귀를 제공한다.

## 7. 권장 기본 화면

### 상단 상태 스트립

1. `Published services 3`
2. `Enabled options 9`
3. `Payout health 9 current · 2 historical · 0 missing`
4. `Localization 0/3 Vietnam-ready`
5. `Public API 259 groups — blocked` 같은 anomaly 카드
6. `Last published / last changed by`

정상 지표는 차분한 neutral/success로, 실제 고객 노출 오류만 danger로 표시한다.

### 본문 목록

| Service | Publication | Languages | Duration pricing | Payout health | Partners / bookings | Last change | Action |
|---|---|---|---|---|---|---|---|
| Foot Massage | Published | EN only · VI missing | 60/90/120 | 3 current | 3 Partners · 0 open | 10:18 | Edit |

가격 셀은 각 duration마다 `Customer / Partner / HANDS fee`를 간결하게 보여 주고, historical rule이나 누락이 있을 때만 행을 확장한다.

### 편집 drawer

1. **Identity & localization**
   - English, Vietnamese 필수
   - 기타 언어 optional
   - localized customer/Partner preview
2. **Duration & pricing**
   - visible Published toggle
   - Customer minimum, Partner payout, HANDS fee, margin
   - historical payout rules disclosure
3. **Impact & publish**
   - affected Partners, open bookings, future visibility
   - change reason
   - Before → After
   - Save draft / Publish changes

## 8. 권장 운영 흐름

1. 운영자는 기본 화면에서 `Public catalog health`가 정상인지 먼저 확인한다.
2. `Add service`는 Draft를 만들고 고객에게 즉시 노출하지 않는다.
3. Vietnamese/English 이름, 설명, 최소 한 duration, customer price, Partner payout을 입력한다.
4. 시스템이 fee·margin·price step·payout rule을 즉시 검증한다.
5. 고객 앱과 Partner 앱 미리보기를 확인한다.
6. Publish 전 영향 요약과 변경 사유를 확인한다.
7. 서버는 그룹 전체를 한 transaction으로 저장하고 booking payout snapshot 계약을 보장한다.
8. 성공 후 audit ID, 적용 범위, 공개 API 반영 시각을 보여 준다.

## 9. Codex 구현 우선순위

### 1차 — 공개 오염과 부킹 실패 차단

- public service API에서 fixture/test/unpublished/payout-missing 옵션 제외
- smoke 전용 DB 또는 rollback 도입
- 기존 426개 의심 옵션 dry-run 분류·정리 도구
- Admin/Public catalog count 정합성 health check
- 신규 서비스 기본 Draft 및 active checkbox payload 수정

### 2차 — 가격·정산 무결성

- booking-time payout snapshot
- 사용 중 payout rule immutable/versioned 처리
- 그룹 원자적 PATCH endpoint
- optimistic concurrency와 idempotency
- 부분 저장 회귀 테스트

### 3차 — 운영자 중심 UI

- 상태 스트립과 anomaly 우선 표시
- 비교형 목록
- visible publication toggle
- inline VND validation, fee/margin preview
- Partner/booking impact preflight
- reason, Before→After, audit link

### 4차 — 다국어·접근성·문구

- mobile locale resolver와 description translations
- VI/EN completeness gate
- focus-managed drawer와 unsaved-change guard
- proper plurals, `Missing none`, 중복 헤더 정리

## 10. 필수 회귀 테스트

1. public `/services/groups`가 testFixture/smoke/unpublished 서비스를 반환하지 않는 계약 테스트
2. exact active payout rule이 없는 서비스가 public API에 노출되지 않는 테스트
3. 새 서비스의 unchecked duration이 inactive로 저장되는 통합 테스트
4. payout 누락 상태에서 Publish가 차단되고 Draft만 저장되는 테스트
5. 60/90/120 편집 중 한 행이 실패하면 전체 rollback되는 API 테스트
6. 같은 편집 요청 재시도 시 중복 service/rule이 생기지 않는 idempotency 테스트
7. 부킹 생성 후 payout rule을 변경해도 기존 부킹의 payout snapshot이 유지되는 테스트
8. historical rule이 non-terminal booking을 보유하면 덮어쓰기/삭제가 차단되는 테스트
9. API 401/500에서 빈 상태가 아닌 retry 오류 상태가 표시되는 렌더 테스트
10. payout > customer price, step mismatch, missing VI/EN의 inline error 테스트
11. 모바일 locale별 name/description fallback 테스트
12. smoke 실행 전후 public catalog option count가 동일한 cleanup 테스트
13. 1440 x 1000에서 drawer 잘림, 카드/표 overflow, focus 순서를 검사하는 시각·접근성 테스트
14. `1 service`, `2 services`, `0 payout rules` 문구 테스트

## 11. 실행 검증 결과

| 검사 | 결과 |
|---|---|
| Admin 실제 화면 | 3 service types, 9 active options, 11 payout rules |
| 공개 `/api/services/groups` 정합성 | FAIL — 259 groups, 436 options, 256 suspicious groups, 86 payout-missing options |
| 공개 API 5회 응답 | 35.2–117.1ms, 343,365 bytes |
| `npm.cmd run test --workspace @massage-vn/admin-web -- app/services lib/service-catalog-filters.spec.ts lib/service-base-payout-rule.spec.ts` | PASS — 7 files, 20 tests |
| `npm.cmd run test --workspace @massage-vn/api -- src/admin/admin-service-input.spec.ts src/admin/admin-service-selects.spec.ts src/services/service-catalog-groups.spec.ts` | PASS — 3 files, 12 tests |
| `npm.cmd run admin:visible-copy` | PASS — 1,604 files, 0 violations |
| `npm.cmd run admin:api-budget` | 실행 불가 — 현재 CLI 인증 토큰이 401을 반환함 |
| Impeccable static detector | Service 전용 오류는 없고 전역 CSS의 side-tab 패턴 6건을 경고함 |

단위 테스트 통과는 현재 컴포넌트 구조와 helper 검증이 맞다는 뜻이다. 현재 테스트는 shared atom 사용 여부, CSS selector, 숫자 parser 중심이라 공개 API 오염, 토글 저장 불일치, payout snapshot, 부분 저장을 잡지 못한다.

## 12. 증거 캡처

- `01-services-overview.png`: 1440px 기본 화면과 중복 헤더
- `02-add-service-dialog.png`: 신규 생성 패널, 비가시 토글 레이블, payout optional 상태
- `03-edit-service-dialog.png`: 기존 서비스 raw VND 입력과 비어 있는 다국어 필드
- `04-payout-above-price-no-warning.png`: payout 600,000 > customer price 500,000인데도 즉시 경고가 없는 상태
- `06-services-list-lower.png`: 3개 카드 전체, `11 payout rules`와 `9 options` 불일치, 세 번째 카드 옆 빈 공간

증거 폴더: `docs/audits/services-reaudit-evidence-2026-08-11/`

## 13. 최종 판단

이 페이지의 시각적 방향은 맞다. 그러나 현재 가장 큰 문제는 화면 미관이 아니라 **화면이 숨기고 있는 실제 공개 데이터와 저장 계약**이다. 운영자에게 3개 정상 서비스만 보여 주면서 고객 API는 259개 그룹을 반환하고, 생성 토글은 저장에 반영되지 않으며, payout 누락 서비스가 active가 될 수 있다. 가격 변경도 기존 부킹 정산에 소급 영향을 줄 수 있고 그룹 편집은 부분 저장될 수 있다.

따라서 다음 디자인 라운드보다 먼저 공개 카탈로그 오염 차단, Draft/Publish 상태, exact payout gate, booking-time payout snapshot, 원자적 그룹 편집을 구현해야 한다. 그 이후에 비교형 목록, 다국어 readiness, margin·impact preview를 얹어야 화면과 실제 운영 결과가 같은 제품이 된다.
