# Service Catalog 최종 개선용 Codex 실행 프롬프트

아래 프롬프트 전체를 새 Codex 작업에 그대로 전달한다.

---

## 역할

당신은 HANDS의 Service Catalog를 production-safe 상태로 완성하는 시니어 풀스택 엔지니어이자 운영 UX 설계자다. 이 화면의 주 사용자는 프로그래머가 아니라 베트남에서 서비스를 혼자 관리하는 운영자다.

현재 구현은 이미 이전의 공개 catalog 오염, payout 누락 공개, duration 부분 저장, booking payout 소급 변경을 해결한 82/100 수준의 Release Candidate다. 기존 구조를 재작성하거나 디자인을 새로 시작하지 말고, 2026-08-14 최종 재감사에서 확인된 남은 결함만 최소 범위로 해결한다.

## 작업 위치와 필수 기준 자료

- 작업 루트: `C:\dev\massage-on-demand-vn`
- 대상 Admin route: `http://localhost:3101/services`
- 최종 재감사 보고서: `docs/audits/services-final-reaudit-2026-08-14.md`
- 현재 화면 증거: `docs/audits/services-final-reaudit-evidence-2026-08-14/`
- 이전 구현 보고서: `docs/audits/services-remediation-report-2026-08-11.md`
- 기존 구현 프롬프트: `docs/agent/prompts/services-remediation-master.md`
- 저장소 지침: `AGENTS.md`

작업을 시작하기 전에 위 파일들을 읽고 현재 code path를 직접 확인한다. 보고서의 line number는 과거 시점일 수 있으므로 사실 판단은 현재 코드와 테스트를 우선한다.

## 최종 목표

Service Catalog의 모든 production write를 하나의 group command 계약으로 통일하고, 실제 공개 상태와 작업 중 Draft를 운영자가 혼동하지 않게 만든다. 위험한 Hide/Archive는 의도적으로 확인하고 복구할 수 있어야 하며, 기존 group key와 booking payout history를 손상시키지 않아야 한다.

완료 시 다음이 모두 참이어야 한다.

1. PUBLISHED/OPERATOR 또는 PUBLISHED/SEED 서비스는 legacy 단건 서비스·payout mutation으로 변경할 수 없다.
2. 실제 public projection과 Admin health가 같은 근거를 사용하며 마지막 점검 시각과 실패 상태를 정확히 보여 준다.
3. Live publication 상태와 working Draft readiness가 별도 표시된다.
4. Publish 전에 남은 blocker와 최종 app-visible 변화가 보인다.
5. Hide/Archive는 별도 확인 없이 실행되지 않고 성공 후 복구 또는 다음 행동이 명확하다.
6. 기존 group key는 일반 편집 화면에서 변경할 수 없다.
7. 60/90/120분의 app 노출 상태가 항상 가시적인 On/Off 문구와 큰 클릭 영역으로 보인다.
8. impact가 현재 총계뿐 아니라 이번 변경의 before → after를 설명한다.
9. mutation retry가 같은 idempotency key를 재사용한다.
10. 변경 동작을 source 문자열 검사가 아닌 실제 렌더·상호작용·API 계약 테스트로 검증한다.

## 절대 제약

### 저장소와 작업 방식

- `AGENTS.md`를 따른다.
- 단일 agent로 작업한다. subagent나 multi-agent 도구를 사용하지 않는다.
- 현재 worktree는 매우 dirty하다. 기존 사용자 변경과 다른 페이지 변경을 되돌리거나 덮어쓰지 않는다.
- `git reset --hard`, `git checkout --`, broad revert, 무관한 formatting을 금지한다.
- 수정 전 관련 파일의 현재 diff를 읽어 사용자 변경 위에 최소 patch를 적용한다.
- 제품 코드를 변경하는 구현 작업이다. 안전한 로컬 파일 수정과 비파괴 테스트는 별도 확인 없이 진행한다.
- 실제 외부 시스템 write, production/staging DB mutation, 현재 운영 catalog의 Publish/Hide/Archive는 사용자 승인 없이 실행하지 않는다.

### 제품 범위

- 1440px 이상 데스크톱만 지원 기준으로 검수한다.
- 1024px 이하 responsive 디자인을 새로 추가하거나 보고하지 않는다.
- 기존 Vuexy 기반 Admin shell, token, typography, shared component를 유지한다.
- 새로운 UI library, state library, icon library를 추가하지 않는다.
- 같은 기능의 새로운 상세 page를 만들지 않는다. `/services`의 comparison table과 drawer 구조를 유지한다.
- 현재 3개 service group 규모에 검색, pagination, virtual list를 추가하지 않는다.
- 사용자 노출 문구는 영어로 유지하고 `Provider` 대신 `Partner`를 사용한다.
- 기술 용어인 provenance, mutation hash, DTO, transaction을 운영자 기본 화면에 노출하지 않는다.

### 데이터와 정산 안전

- 기존 public catalog contract, publication/provenance, atomic group publish, optimistic concurrency, audit change set, immutable booking payout snapshot을 보존한다.
- `BookingService`의 기존 payout snapshot을 재작성하거나 backfill하지 않는다.
- 사용 이력이 있는 payout rule을 삭제하거나 값으로 덮어쓰지 않는다.
- payout rule은 versioned history를 유지한다.
- booking 생성 후 catalog 가격을 바꿔도 기존 booking의 earnings가 달라지면 안 된다.
- 실제 운영 service row, draft, payout rule을 테스트 목적으로 생성·수정·삭제하지 않는다.
- schema나 migration이 불필요하면 추가하지 않는다. 필요한 경우 기존 데이터 무손실, rollback 전략, migration 검증을 포함한다.

### 보호 영역

다음은 `AGENTS.md`의 보호 영역이다.

- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/**`
- `apps/api/src/bookings/**`
- `packages/shared-types/**`
- 기타 `AGENTS.md`에 명시된 보호 영역

이 영역을 변경하면 이유를 최종 보고서에 명시하고 API/Admin/Customer/Partner 관련 scope 검증 및 full local verification을 실행한다. 단순 UI 개선을 이유로 보호 영역을 넓게 수정하지 않는다.

## 현재 정상 동작 — 보존할 것

다음 항목은 이미 구현됐으므로 회귀시키지 않는다.

1. 공개 API는 active, `PUBLISHED`, `OPERATOR`/`SEED`, 60/90/120분, exact safe payout 조건만 반환한다.
2. 공개 response에는 payout, VAT, other cost 같은 내부 finance key가 없다.
3. 현재 local 공개 API는 3 groups, 9 options, 약 3,577 bytes다.
4. incomplete Draft 저장은 live service와 payout row를 바꾸지 않는다.
5. Publish는 60/90/120분과 payout rule version을 한 DB transaction에서 저장한다.
6. stale `expectedVersion`은 저장 전에 conflict로 차단된다.
7. payout이 customer price를 넘으면 field error, error summary, Save/Publish 차단이 즉시 나타난다.
8. EN/VI, enabled duration, explicit payout, 최소 12자 reason이 Publish gate다.
9. booking 생성 시 payout rule ID, Partner payout, rule JSON snapshot이 저장된다.
10. earnings는 booking snapshot을 사용하고 legacy snapshot 누락은 fail closed다.
11. customer/Partner 앱은 locale fallback으로 translated service name을 사용한다.
12. drawer는 `aria-modal`, labelledby, focus trap, Escape, focus return, background inert를 제공한다.
13. 기본 목록은 3개 그룹의 60/90/120분 Customer / Partner / Gross fee를 비교하는 표다.

## 구현 순서

아래 순서를 따른다. 각 slice가 테스트를 통과한 뒤 다음 slice로 넘어간다. P0이 해결되지 않으면 P2 시각 polish만 하고 완료했다고 보고하지 않는다.

## Slice P0 — production write path 단일화

### 문제

새 UI는 `PATCH /admin/services/groups/:groupKey`를 사용하지만 다음 legacy mutation route와 이를 호출하는 미사용 Admin server action이 남아 있다.

- `POST /admin/services`
- `POST /admin/services/duration-sets`
- `PATCH /admin/services/:id`
- `POST /admin/services/:id/payout-rules`
- `POST /admin/services/:id/payout-rules/bulk`
- `PATCH /admin/service-payout-rules/:id`
- `apps/admin_web/app/services/actions.ts`의 미사용 legacy action

이 경로가 PUBLISHED 운영 row를 수정하면 group transaction, expectedVersion, stable mutation key, reason, group audit를 우회하고 public option이 일시적으로 사라질 수 있다.

### 구현 요구사항

1. 모든 route와 caller를 `rg`로 조사하고 runtime caller를 분류한다.
2. Admin UI에서 사용하지 않는 legacy server action은 제거한다.
3. 기존 test/smoke가 legacy route를 필요로 한다면 일반 production write와 분리한다.
4. 최소 안전 계약은 다음과 같다.
   - PUBLISHED + OPERATOR/SEED service row는 단건 service PATCH로 수정할 수 없다.
   - PUBLISHED + OPERATOR/SEED의 payout rule은 group command 밖에서 생성·bulk 생성·PATCH할 수 없다.
   - 차단 응답은 명시적 code와 사람이 이해할 message를 가진 409 또는 403이다.
   - DRAFT/SMOKE용 경로를 유지할 경우 production environment, provenance, permission 경계를 명확히 한다.
5. public catalog가 사용하는 operational row의 변경은 최종적으로 `service_group:{groupKey}` audit target 한 건으로 추적 가능해야 한다.
6. 현재 `admin-route-domain`, operator permission guard, API smoke contract를 함께 갱신한다.
7. route를 제거할 수 있으면 제거가 우선이다. speculative compatibility layer를 추가하지 않는다.

### 완료 기준

- published operational service를 legacy 단건 route로 바꾸려는 integration test가 차단된다.
- payout legacy route도 같은 상태에서 차단된다.
- Draft → Publish group command는 계속 성공한다.
- 공개 API option count와 exact payout 계약이 변경 중 깨지지 않는다.
- Admin Web active code에서 legacy service mutation action import/사용이 0이다.
- dead-code guard가 component 파일뿐 아니라 legacy action과 forbidden production route caller도 검증한다.

## Slice P1-A — 실제 public health와 Live/Draft 상태 분리

### 목표 화면

상단 health strip은 다음 의미를 명확히 구분한다.

1. `Live catalog` — public projection의 group/option 수와 checked 시각
2. `Publish blockers` — 실제 live delivery를 막는 anomaly 수
3. `Working drafts` — unpublished draft 수
4. `Live localization` — published EN+VI ready group 수
5. `Payout coverage` — current safe rules / enabled published options, historical count
6. `Last change` — actor 또는 audit link, published time

### 구현 요구사항

1. Admin 화면이 `apps/admin_web/app/services/page.tsx`에서 임의로 public health를 추정하지 않게 한다.
2. API에 bounded read model을 추가하거나 기존 public projection service를 재사용해 실제 공개 조건과 동일한 결과를 계산한다.
3. 같은 business condition을 Admin과 public service에 복제하지 말고 shared server helper/service로 단일화한다.
4. health response에는 최소 다음을 포함한다.
   - status: healthy / degraded / unavailable
   - checkedAt
   - liveGroupCount
   - liveOptionCount
   - blockedOptionCount 또는 anomaly count
   - liveEnViReadyGroupCount
   - currentPayoutRuleCount
   - historicalPayoutRuleCount
   - workingDraftCount
   - lastPublishedAt
   - 가능하면 lastPublishedBy와 exact audit target/link를 구성할 수 있는 식별자
5. service groups 조회가 성공해도 health 조회가 실패하면 녹색 `healthy`를 보이지 않는다. 별도 `Live catalog check unavailable`과 Retry를 표시한다.
6. Draft translation을 Live localization에 포함하지 않는다.
7. row에는 다음을 구분해 표시한다.
   - Live state: Published / Hidden / Archived
   - Live localization: EN+VI ready / gap
   - Draft: No draft / Draft vN + blocker count
8. 현재 3개 그룹의 표 구조와 가격 셀은 유지한다.

### 성능 계약

- 기본 page는 service group list와 health summary의 bounded query만 수행한다.
- 전체 Provider, Booking, Audit row를 메모리에 적재하지 않는다.
- impact query는 edit drawer에서만 실행한다.
- public catalog response에 내부 finance key를 추가하지 않는다.

### 완료 기준

- 실제 public projection 3/9와 Admin `Live catalog` 3/9가 일치한다.
- public endpoint fault에서 `healthy`가 표시되지 않는다.
- incomplete Draft를 저장해도 Live localization과 Live option count가 바뀌지 않는다.
- Draft badge만 blocker 상태를 반영한다.

## Slice P1-B — 편집 key, Draft readiness, app toggle 개선

### Internal group key

1. 신규 group:
   - English 이름에서 안전한 key를 자동 생성한다.
   - 운영자는 기본적으로 key를 입력하지 않는다.
   - 충돌 또는 고급 수정이 필요할 때만 `Advanced` disclosure에서 편집한다.
   - 자동 생성 key를 제출 전에 보여 준다.
2. 기존 group:
   - read-only text로 표시한다.
   - 필요하면 copy button을 제공한다.
   - 기존 edit form에서 key를 변경해 rename을 흉내 내지 않는다.
3. 실제 rename 기능은 이 작업 범위에서 새로 만들지 않는다. 필요하면 별도 migration workflow로 남긴다.

### App visibility toggle

각 60/90/120분 row는 다음을 항상 가시적으로 표시한다.

- `Offered in Customer & Partner apps`
- `On` 또는 `Off`
- 최소 44px 상당의 label 클릭 영역
- keyboard focus-visible

기존 `AdminFormCheckbox`를 재사용하되 children 또는 별도 visible label을 제공한다. screen-reader only label만 남기지 않는다.

Off 상태의 가격값 처리 원칙도 화면에 명시한다.

- 가격값은 Draft에 보존할 수 있다.
- Off duration은 public API에 노출되지 않는다.
- Off에서 On으로 바꾸면 price와 payout readiness를 즉시 재검증한다.

### Publish blocker summary

drawer footer 또는 `Impact and publish` 상단에 실시간 checklist를 둔다.

- English name
- Vietnamese name
- Enabled durations
- Customer prices
- Partner payouts
- Change reason `N/12`
- impact availability

`Publish` label은 가능하면 결과를 말한다. 예: `Publish 3 app-visible options`.

다음 UX를 구현한다.

- blocker가 있으면 Publish disabled
- 남은 blocker 수 표시
- blocker summary에서 첫 오류로 focus 이동 가능
- Save draft는 payout conflict처럼 데이터 자체가 무효한 경우를 제외하고 불완전 Draft를 저장 가능
- server validation은 그대로 유지하며 client validation만 신뢰하지 않는다
- API error 후 입력값을 유지한다

### 언어 필드

- EN/VI는 기본 노출한다.
- KO/JA/ZH는 `Additional languages` disclosure 아래로 이동한다.
- 기존 저장 값과 preview를 보존한다.
- CJK text, 120자 name, 빈 optional translation을 테스트한다.

### 완료 기준

- 기존 group key input은 수정 불가다.
- 새 group key 자동 생성과 충돌 오류가 테스트된다.
- 세 toggle 모두 마우스와 키보드로 상태 변경 가능하며 On/Off가 보인다.
- empty 신규 form에서 Publish blocker가 제출 전에 보인다.
- payout 초과 field/summary/action 차단이 회귀하지 않는다.
- KO/JA/ZH disclosure를 열어 수정하고 저장할 수 있다.

## Slice P1-C — Impact delta와 안전한 Publish/Hide/Archive

### Impact read model

현재 count만 보여 주지 말고 form의 proposed state와 current live state를 비교한다.

최소 표시 항목:

- app-visible options: before → after
- customer minimum 또는 duration별 customer price 변화
- Partner payout 변화
- base catalog price를 따르는 Partner 수
- custom price 때문에 직접 영향이 없는 Partner 수
- open bookings 또는 open booking lines
- 기존 booking은 payout snapshot을 유지한다는 설명
- 적용 시점: future bookings only / removed from apps immediately 등

`BookingService.count()`를 계속 사용하면 UI label은 `Open booking lines`로 한다. `Open bookings`라고 표시하려면 distinct booking count를 계산한다.

Impact API가 실패하면 Publish/Hide/Archive는 차단하고 명시적 Retry를 제공한다. Save draft는 허용할 수 있다.

### Action hierarchy

기본 footer:

- `Save draft`
- `Review publish` 또는 최종 확인 단계로 여는 primary action
- `Cancel`

위험 action:

- `More actions` 또는 명확히 분리된 영역 안에 `Hide from apps`, `Archive`
- Publish와 같은 시각적 그룹에 나란히 놓지 않는다

### Confirmation

Publish confirmation은 다음을 보여 준다.

- before → after 요약
- app-visible option 수
- Partner와 booking 영향
- change reason
- 적용 후 audit 기록이 생성된다는 설명

Hide confirmation은 다음을 보여 준다.

- 앱에서 즉시 사라지는 option 수
- open booking snapshot은 유지됨
- 다시 공개하는 방법
- 최소 12자 reason

Archive confirmation은 다음을 보여 준다.

- historical record는 유지됨
- 일반 편집 화면에서 복구 가능한지 여부
- 영향 수
- explicit checkbox 또는 group key 확인
- 최소 12자 reason

기존 shared confirm dialog와 action component가 있으면 재사용한다. `window.confirm`으로 destructive business action을 구현하지 않는다.

### Recovery

- Hide 성공 후 `Republish` 또는 `Review draft` next action을 제공한다.
- Archive가 복구 가능하면 명시적 `Restore to draft` workflow를 제공한다.
- 복구가 정책상 불가능하면 확인 화면에서 되돌릴 수 없음을 분명히 표시한다.
- action success notice는 exact audit change set link를 유지한다.

### Dirty close 통일

X, backdrop, Escape, Cancel이 같은 close handler와 dirty guard를 사용하게 한다. `Cancel`을 단순 `<a href="/services">`로 두지 않는다. 저장 성공 시 dirty state를 해제하고, validation/API 실패 시 입력과 dirty state를 유지한다.

### 완료 기준

- Publish, Hide, Archive는 확인 단계 없이 API에 제출되지 않는다.
- confirmation의 impact와 최종 payload가 일치한다.
- impact unavailable에서는 위험 action이 차단되고 Save draft는 가능하다.
- Cancel, X, backdrop, Escape 모두 dirty form에서 같은 confirm을 보여 준다.
- focus가 confirmation 및 drawer에서 올바르게 이동하고 닫힌 뒤 원래 row action으로 돌아간다.

## Slice P1-D — stable idempotency와 audit evidence

### 문제

현재 server action이 API 요청마다 `randomUUID()`를 생성하면 같은 사용자 submission의 lost response retry가 새 mutation으로 보일 수 있다.

### 구현 요구사항

1. drawer/form이 시작될 때 또는 submit intent가 확정될 때 mutation key를 만들고 hidden field/state에 유지한다.
2. 같은 submission의 transport retry에는 같은 key를 사용한다.
3. payload 또는 intent가 바뀐 새 시도에는 새 key를 사용한다.
4. 성공 후 key를 소진하고 다음 action은 새 key를 사용한다.
5. server는 같은 key+same payload replay를 write 없이 성공 결과로 반환하고, same key+different payload는 conflict로 차단한다.
6. double click과 빠른 연속 submit을 disabled/pending 상태로 차단한다.
7. audit metadata는 actor, reason, before, after, version, intent, group target을 유지한다.

### 완료 기준

- API가 response를 저장 후 유실한 상황을 시뮬레이션해 같은 key retry가 payout version과 audit row를 중복 생성하지 않는다.
- same key/different payload는 409다.
- Publish button 연속 클릭이 한 command만 만든다.

## Slice P2 — 문구, 순서, history disclosure

P0/P1이 안정된 뒤 수행한다.

### 문구

- `Review` → `Edit`
- 접근성 이름: `Edit Foot Massage`처럼 row context 포함
- `Last published · Recorded` → 실제 시각과 actor 또는 `Open last audit`
- `API anomalies` 같은 기술적 문구보다 `Live delivery blockers`를 우선
- `Published`와 `Draft`를 한 badge에 섞지 않는다

### Display order

- 기존 hidden `displayOrder`를 운영 가능한 작은 control로 노출한다.
- 3개 그룹 규모에서는 drag-and-drop library를 추가하지 않는다.
- `Move up` / `Move down` 또는 명시적 order 숫자 중 현재 Admin pattern과 더 일관된 것을 사용한다.
- 순서 변경도 Draft로 저장되고 Publish 후 public API order에 반영되어야 한다.

### Payout history

`N historical`을 클릭 또는 disclosure로 열 수 있게 한다.

표시 정보:

- service duration
- customer price
- Partner payout
- active/inactive
- created/effective time
- referenced booking count 또는 reference 상태

history는 읽기 전용이며 이 화면에서 삭제·수정하지 않는다.

### Customer-facing description

다음 중 하나를 현재 실제 앱 소비 코드에 근거해 선택한다.

1. 설명이 앱에 노출된다면 `descriptionEn`, `descriptionVi`와 name과 동일한 fallback을 구현한다.
2. 설명이 아직 소비되지 않는다면 불필요한 field를 숨기거나 `Not currently shown in apps`라고 정확히 설명한다.

추정으로 schema를 늘리지 않는다. 실제 consumer를 먼저 추적한다.

## 접근성 요구사항

- semantic table, row header, fieldset/legend를 유지한다.
- row action accessible name에 서비스명을 포함한다.
- 모든 toggle은 가시 label, keyboard 조작, focus-visible을 제공한다.
- dynamic validation과 blocker 변화는 과도하지 않은 live region으로 알린다.
- error summary에서 해당 field로 focus할 수 있다.
- dialog는 `aria-modal`, labelledby, background inert, focus trap, Escape, focus return을 유지한다.
- confirmation close 후 focus가 실행한 action으로 돌아간다.
- 상태를 색상만으로 전달하지 않는다.
- Windows high contrast에서도 toggle과 danger action 경계가 보이게 한다.
- 200% zoom은 별도 mobile redesign 없이 1440px 환경에서 핵심 action 접근 가능 여부만 확인한다.

## 오류와 edge state

다음을 구현하고 테스트한다.

- service groups API 401/403/404/500/timeout
- public health API unavailable 또는 partial response
- impact API unavailable
- stale version conflict
- same idempotency key/different payload conflict
- 빈 catalog
- live catalog는 정상이고 incomplete Draft가 있는 상태
- historical payout rule 0개/1개/다수
- 긴 EN/VI/CJK 이름과 긴 description
- customer/Partner price 최대 안전 정수 범위 내 큰 값
- payout 0 VND
- payout > customer price
- enabled row의 price/payout 누락
- 3개 duration 모두 Off
- double submit
- dirty drawer navigation

Generic `Something went wrong`으로 끝내지 말고 운영자가 다음 행동을 알 수 있는 오류와 Retry를 제공한다.

## 테스트 요구사항

### API

1. published operational service legacy mutation 차단
2. published operational payout legacy mutation 차단
3. smoke/draft 경로를 유지한다면 허용 경계 테스트
4. group Draft/Publish/Hide/Archive transaction과 audit
5. actual public health와 public projection count 일치
6. Draft와 Live localization 분리
7. impact before/after와 distinct booking 의미
8. same key replay / changed payload conflict / lost response retry
9. public response internal finance key 0
10. booking payout snapshot 및 earnings immutability 회귀

### Admin Web

source 문자열 확인만으로 새 핵심 동작을 테스트하지 않는다. React component를 실제 렌더하고 user-event 또는 저장소의 기존 interaction test pattern을 사용한다.

1. visible app toggle label과 mouse/keyboard toggle
2. existing group key read-only, new key auto generation
3. Publish blocker 실시간 변화
4. payout 초과 inline error와 button 차단
5. Live와 Draft badge 분리
6. public health failure와 Retry
7. impact failure 시 위험 action 차단
8. Publish confirmation payload
9. Hide/Archive confirmation 및 cancel
10. Cancel/X/backdrop/Escape dirty guard
11. unique row action accessible name
12. Additional languages disclosure와 기존 값 보존
13. pending 중 double submit 차단

### Customer/Partner 앱

설명 locale 계약을 변경한 경우에만 관련 resolver와 화면 테스트를 추가한다. 이름 locale fallback 회귀 테스트는 유지한다.

### 시각 검수

로그인된 실제 in-app browser로 다음 상태를 1440 x 1000에서 캡처한다.

1. 기본 Live/Draft catalog
2. edit drawer 상단
3. pricing + visible toggle
4. Publish blocker 상태
5. impact before→after
6. Publish confirmation
7. Hide confirmation
8. Archive confirmation
9. public health unavailable
10. payout > price error
11. long CJK text
12. dark mode

현재 운영 catalog를 변경하지 않고 캡처할 수 없는 성공 상태는 disposable fixture/staging에서만 검증하고 미실행 사유를 기록한다.

## 권장 검증 명령

현재 package script를 먼저 확인한 뒤 실제 존재하는 명령만 사용한다. 최소 기준은 다음과 같다.

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- app/services components/admin-form-controls.spec.tsx components/admin-form-controls-css.spec.tsx lib/service-catalog-filters.spec.ts lib/service-base-payout-rule.spec.ts
npm.cmd run test --workspace @massage-vn/api -- src/admin/admin-service-input.spec.ts src/admin/admin-service-catalog.spec.ts src/services/services.service.spec.ts src/services/service-catalog-groups.spec.ts src/bookings/bookings.payload.spec.ts src/bookings/bookings.payout-setup.spec.ts src/earnings/earnings.service.spec.ts
npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run typecheck --workspace @massage-vn/api
npm.cmd run services:catalog-cleanup:test
npm.cmd run prisma:migrations:check
npm.cmd run admin:visible-copy
```

변경 범위에 따라 추가한다.

```powershell
npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api
npm.cmd run verify:scope -- -Scope customer
npm.cmd run verify:scope -- -Scope provider
npm.cmd run verify:local
powershell -ExecutionPolicy Bypass -File .\infra\scripts\verify-local.ps1 -WithServices
```

UI 변경 완료 후 Impeccable detector가 사용 가능하면 변경 대상에 한 번만 실행한다.

```powershell
node C:\Users\laboy\.codex\skills\impeccable\scripts\detect.mjs --json apps/admin_web/app/services apps/admin_web/app/globals.css apps/admin_web/components/admin-form-controls.tsx
```

`git diff --check`와 변경 파일 diff도 확인한다. full verification이 기존 무관한 실패로 끝나면 정확한 test name, 오류, 이번 변경과의 관계를 기록한다.

## 브라우저 QA 절차

1. user가 사용하는 in-app browser의 로그인 세션을 재사용한다.
2. 기존 Admin design system과 실제 화면을 먼저 확인한 뒤 수정한다.
3. 1440 x 1000과 1600 x 1000에서만 검수한다.
4. DOM snapshot으로 semantic state와 button disabled, aria label, dialog/focus를 확인한다.
5. screenshot은 증거일 뿐이므로 click, keyboard, validation, close, retry를 실제로 수행한다.
6. 현재 catalog mutation을 제출하지 않는다. write lifecycle은 disposable environment에서만 실행한다.
7. console error/warning과 실패 request를 확인한다.
8. 완료 후 `/services` light mode 기본 화면으로 복구한다.

## 중단 조건

다음 상황에서는 추측 구현을 중단하고 현재 증거, 위험, 선택지를 사용자에게 보고한다.

1. legacy route가 외부 production client에서 실제 사용 중이며 제거 또는 guard가 계약을 깨뜨릴 수 있다.
2. operational/smoke provenance를 안전하게 구분할 수 없다.
3. protected schema 변경 없이는 핵심 불변식을 보장할 수 없는데 migration 범위가 예상보다 넓다.
4. Archive의 복구 정책이 제품에서 정의되지 않았고 선택에 따라 데이터 lifecycle이 달라진다.
5. `description`의 locale 소비 계약이 customer와 Partner 앱에서 충돌한다.
6. staging 또는 disposable DB가 없어서 실제 lifecycle smoke가 현재 운영 catalog mutation을 요구한다.
7. worktree의 기존 사용자 변경과 같은 line/contract를 수정해야 하는데 의도를 안전하게 보존할 수 없다.

질문이 필요하면 구현 전체를 멈추기 전에 안전하게 독립적인 검사와 테스트를 먼저 끝내고, 결정에 꼭 필요한 최소 질문만 한다.

## 완료 산출물

1. 코드와 테스트
2. 필요한 경우 안전한 migration
3. `docs/audits/services-final-remediation-report-YYYY-MM-DD.md`
4. `docs/audits/services-final-remediation-evidence-YYYY-MM-DD/`의 화면 증거
5. 기존 재감사 항목별 `완료 / 부분 완료 / 미완료` 매트릭스
6. public API 실제 group/option/bytes/internal-key 검사 결과
7. staging lifecycle smoke 결과 또는 미실행 사유

## 최종 인수 기준

다음을 모두 만족하기 전에는 “완료”라고 하지 않는다.

- [ ] production catalog write path가 group command로 단일화됐다.
- [ ] legacy 단건 route가 published operational row를 변경하지 못한다.
- [ ] Admin health가 actual public projection과 일치한다.
- [ ] Live와 Draft readiness가 분리됐다.
- [ ] 기존 group key가 read-only다.
- [ ] app visibility toggle의 문구와 On/Off 상태가 보인다.
- [ ] Publish blocker가 제출 전에 보이고 첫 오류로 이동할 수 있다.
- [ ] impact가 before→after이며 booking 단위 의미가 정확하다.
- [ ] Publish/Hide/Archive confirmation과 recovery가 있다.
- [ ] 모든 drawer close 경로가 같은 dirty guard를 사용한다.
- [ ] same submission retry가 같은 idempotency key를 사용한다.
- [ ] 실제 렌더·interaction 기반 테스트가 추가됐다.
- [ ] 1440px 브라우저 검수와 console 검사가 통과했다.
- [ ] 공개 API가 의도한 group/option만 반환하고 finance key leak이 없다.
- [ ] booking payout snapshot과 earnings immutability가 회귀하지 않았다.
- [ ] 변경된 보호 영역과 전체 검증 결과가 보고됐다.

## 최종 응답 형식

결론부터 짧게 시작하고 다음 순서로 보고한다.

1. 완료 결과와 release 판단
2. 구현한 항목 — P0/P1/P2별
3. 변경 파일
4. 데이터/API 계약 변화
5. 실행한 테스트와 PASS/FAIL/SKIPPED
6. 브라우저 QA와 증거 경로
7. 보호 영역 변경 여부
8. 남은 위험과 미실행 항목
9. 다음 한 가지 권장 작업

테스트를 실행하지 않았으면 PASS라고 쓰지 않는다. 현재 운영 catalog를 mutation하지 않았다는 사실도 명시한다.

---

이 프롬프트는 2026-08-14 재감사 보고서의 남은 출시 요건을 구현하기 위한 것이다. 이미 해결된 P0 기반을 다시 설계하거나 광범위하게 refactor하지 말고, 현재 불변식을 보존하면서 위 인수 기준을 충족하라.
