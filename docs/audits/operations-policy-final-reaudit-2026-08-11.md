# Operations Policy 최종 재감사 보고서

- 감사 일자: 2026-08-11
- 대상: `Operations Policy` 기본 화면, 변경 패널, Matching/Decision/Audit 고급 워크스페이스
- 화면 기준: 1440 x 1000 데스크톱만 검수함. 1024px 이하 화면은 이번 범위에서 제외함.
- 감사 방법: 로그인된 실제 화면 캡처, DOM/상호작용 확인, Admin Web·API 코드 계약 추적, 관련 단위 테스트와 정합성 검사 실행
- 변경 범위: 제품 코드는 수정하지 않았으며 보고서와 증거 캡처만 추가함.

## 1. 결론

현재 화면은 이전보다 기능 영역이 분리되었고, 한 번에 한 정책만 수정하도록 제한하며, 서버에서 동시 수정 충돌과 동일 값 저장을 차단하는 등 기술적 안전장치가 갖춰졌다. 그러나 실제 운영자가 정책을 변경하고 그 결과를 감사하는 핵심 경로에는 아직 출시 차단급 문제가 남아 있다.

**종합 점수: 56/100 — 내부 검토용으로는 사용 가능하지만 실제 운영 정책 변경 화면으로는 아직 출시 보류가 타당하다.**

출시 전 반드시 해결해야 하는 두 문제는 다음과 같다.

1. 감사 로그의 변경 전·후 값이 API와 화면의 필드 계약 불일치로 `-`로 표시된다.
2. 필수 확인 체크박스의 설명이 화면에서 완전히 숨겨져 운영자가 무엇을 확인해야 하는지 알 수 없다.

이 두 항목이 해결되기 전에는 정책을 변경하더라도 변경 사실을 신뢰성 있게 검증하기 어렵고, 정상적인 변경 제출 자체도 운영자에게 불친절하다.

## 2. 점수표

| 영역 | 점수 | 판단 |
|---|---:|---|
| 운영자 과업 명확성 | 55/100 | 정책·설명·증거·제품 의사결정이 한 화면 체계에 섞여 있음 |
| 1440px 화면 구성 | 45/100 | 8열 비교표의 첫 열이 글자 단위로 줄바꿈되고 내부 스크롤이 중첩됨 |
| 변경 안전성 | 66/100 | 서버 충돌·동일 값 차단은 좋지만 클라이언트 상태 안내와 위험도별 확인이 부족함 |
| 감사 데이터 신뢰성 | 30/100 | 전·후 값 누락, 스모크 데이터 중복, 운영 변경과 자동 테스트 구분 부재 |
| 정보 구조 | 58/100 | 고급 영역 분리는 개선됐으나 중간 선택 화면과 과도하게 긴 워크스페이스가 남음 |
| 접근성·문구 | 54/100 | 의미 있는 제목과 일부 `aria-current`는 좋지만 필수 체크 설명과 오류 안내가 실패함 |
| 성능·로딩 구조 | 69/100 | 병렬·샘플 제한은 좋지만 편집 화면과 선택 화면에서 불필요한 API 조회가 존재함 |
| 코드 정합성 | 76/100 | 관련 139개 테스트와 정책 키 정합성은 통과했지만 실제 감사 메타데이터 계약을 테스트하지 않음 |

## 3. 잘된 부분

1. 정책 변경을 한 번에 한 건으로 제한했다. 변경 화면이 `Before`, `After`, 영향, 적용 시점을 한곳에 보여 주는 방향은 맞다.
2. API는 `expectedValue`를 비교해 다른 운영자가 먼저 바꾼 경우 충돌을 차단한다.
3. API는 같은 값을 다시 저장하는 것을 거부하고, 변경 값과 감사 이벤트를 하나의 트랜잭션으로 기록한다.
4. 고급 검토를 Matching, Decision, Audit으로 분리해 기본 화면의 데이터 로딩을 일부 줄였다.
5. 시뮬레이션과 공급 근거에 현재 데이터 부족을 알리는 문구가 들어갔다.
6. 관련 Admin Web 테스트 44개 파일, 139개 테스트가 모두 통과했고 API/Admin 정책 키·기본값 정합성 검사도 통과했다.

## 4. P0 — 출시 전 필수 수정

### P0-1. 감사 로그의 Before/After 값이 실제로 표시되지 않는다

화면에서 최근 감사 행의 `Before`, `After`가 모두 `-`로 보였다. 원인은 명확하다.

- API는 `apps/api/src/admin/admin.service.ts:29177`과 `:29179`에서 메타데이터를 `after`, `before`로 기록한다.
- Admin 변환기는 `apps/admin_web/app/operations-policy/policy-audit-rows.ts:35-36`에서 `previousValue`, `value`를 읽는다.
- 단위 테스트도 실제 API 스키마가 아닌 `previousValue`, `value` 형태의 가짜 데이터를 사용해 문제를 놓쳤다.

수정 요건:

- 감사 표시 코드는 우선 `before`/`after`를 읽도록 고친다.
- 과거 레코드 호환이 필요하면 `before ?? previousValue`, `after ?? value` 순서로 읽는다.
- API가 생성한 실제 메타데이터 객체를 그대로 `operationalPolicyAuditRows`에 넣는 계약 테스트를 추가한다.
- 변경 성공 화면과 감사 화면에서 같은 변경 ID, Before, After, actor, reason, effectiveAt을 대조할 수 있게 한다.

완료 기준:

- 실제 정책을 A→B로 한 번 변경하면 감사 행 한 건에 A와 B가 정확히 표시된다.
- B→A 복구도 별도 행으로 정확히 표시된다.
- 값이 없을 때만 `-`가 표시된다.

### P0-2. 필수 확인 체크박스의 설명이 보이지 않는다

변경 패널에는 작은 빈 체크박스만 있고 `I reviewed the before and after values...` 문구가 화면에 보이지 않았다. 저장을 누르면 브라우저 기본 오류만 나타나며, 브라우저 로케일 때문에 영어 화면 안에 한국어 오류가 섞인다.

원인:

- `operations-policy-form.tsx:134`는 `AdminFormCheckbox`에 `label` prop만 전달한다.
- 공유 컴포넌트는 `admin-form-controls.tsx:602-605`에서 children이 없으면 label을 `sr-only`로 숨긴다.
- 실제 input 자체도 `globals.css:22557-22559`에서 1px로 숨겨지고 별도 마크만 표시된다.

수정 요건:

- 확인 문구를 children으로 렌더링하거나 공유 컴포넌트에 `labelVisibility="visible"` 계약을 추가한다.
- 체크박스와 문구 전체를 클릭 가능한 한 줄로 만들고 문구를 항상 보이게 한다.
- 값 변경, 12자 이상 사유, 확인 체크가 모두 충족되기 전까지 저장 버튼을 비활성화한다.
- 브라우저 기본 validation bubble에 의존하지 말고 각 필드 아래에 동일 언어의 인라인 오류를 표시한다.
- 오류 발생 시 첫 오류로 초점을 이동하고 상단 오류 요약도 제공한다.

완료 기준:

- 1440px에서 확인 문구가 잘리지 않고 보인다.
- 키보드 Tab과 Space로 체크할 수 있고 초점 링이 명확하다.
- 미완성 상태의 저장 버튼은 비활성화되고 왜 비활성인지 인라인으로 알 수 있다.

## 5. P1 — 높은 우선순위

### P1-1. 1440px에서도 정책 비교표를 읽기 어렵다

기본 화면의 표는 8개 열을 동시에 보여 주며, 정책 이름과 설명이 들어가는 첫 열이 약 1~2단어 폭으로 압축된다. `Matching delay review SLA`와 설명이 글자 단위로 수직 분해됐다. 1440px 전용 운영 환경에서도 실패한 상태다.

코드 원인:

- `page.tsx:208`부터 8개 열을 한 표에 넣는다.
- `globals.css:15994-15999`는 표 최소 폭을 920px로만 고정하고 각 열의 최소 폭이나 우선순위를 정의하지 않는다.
- Current와 Recommended가 같은 행까지 모두 표시해 표 밀도를 불필요하게 높인다.

권장 구조:

- 기본 목록은 `정책 / 현재값 / 상태 / 마지막 변경 / 작업` 5열로 줄인다.
- Recommended는 현재와 다를 때만 `권장값과 다름` 배지와 함께 보인다.
- 설명과 영향은 행 확장 또는 우측 상세 패널로 이동한다.
- 정책을 운영 영역별로 그룹화하고 기본적으로 `주의 필요`와 `권장값과 다름`만 먼저 보여 준다.
- 최소 검색, 영역 필터, 상태 필터, 변경됨 필터를 제공한다.

### P1-2. 자동 스모크가 운영 감사 이력을 오염시킨다

브라우저에서 감사 표 8행을 정규화해 비교한 결과 **8행 중 고유 내용은 4개뿐이었고 4개가 정확히 두 번씩 반복**됐다. 이유는 API 스모크가 정책을 테스트 값으로 바꾼 뒤 `finally`에서 원래 값으로 복구하면서 두 변경 모두 `Demo Admin`의 일반 운영 변경처럼 기록하기 때문이다.

근거:

- `infra/scripts/api-smoke.mjs:773-780`이 `Automated smoke coverage for ...` 사유로 실제 정책 PATCH를 수행한다.
- 같은 스크립트의 여러 `finally` 블록이 원래 값으로 복구하며 추가 감사 레코드를 만든다.
- 화면은 source/environment/runId를 구분하지 않고 최신 8개를 그대로 노출한다.

수정 요건:

- 가능하면 스모크는 운영자 감사 DB와 분리된 테스트 DB에서만 실행한다.
- 불가피하면 감사 메타데이터에 `source: operator | automated_smoke`, `environment`, `runId`, `restoration`을 기록한다.
- 운영 화면 기본값은 `source=operator`만 보여 주고 자동 검증은 별도 필터에서 확인한다.
- 자동 변경·복구 쌍을 일반 운영 변경 수나 `Last changed by` 계산에 포함하지 않는다.

### P1-3. 모든 28개 정책이 enforced인데 화면은 planning·owner choice라고 설명한다

API 정의를 계산하면 `enforced: true`가 28개, `enforced: false`가 0개다. 그런데 Decision 화면은 “items marked planning are not enforced”라고 설명하고 상태를 `Needs owner choice`로 표시한다. 이미 실시간 로직에 연결된 정책을 미결정 계획처럼 보이게 해 운영자가 영향도를 잘못 판단할 수 있다.

현재 분포:

- Command center 7
- Booking 5
- Matching 5
- Decision 11
- 전체 28개 모두 enforced

수정 요건:

- 실제 집행 여부를 단일 소스에서 받아 `Live`, `Planned`, `Deprecated`로 명확히 표시한다.
- 현재처럼 전부 집행 중이면 `Decision workspace`를 `High-impact policies` 또는 `Exception & finance policies`로 이름을 바꾼다.
- 정말 계획 단계인 선택은 운영 정책 API에서 분리해 `Product decision backlog`나 출시 체크리스트로 옮긴다.
- 정적 설명문이 아니라 현재 설정의 `enforced` 값으로 제목·배지·도움말을 결정한다.

### P1-4. 변경 화면의 적용 시점·승인 정보가 실제 선택 기능처럼 보이지만 하드코딩이다

페이지 설명은 “recorded reason and effective time”을 약속하지만 운영자는 적용 시간을 선택할 수 없다. `Effective`는 즉시 또는 재시작 후로 자동 표시되고, `Additional approval`은 항상 `Not required`다.

수정 요건:

- 예약 적용을 지원하지 않을 것이라면 설명을 `takes effect immediately after save`로 정확히 바꾼다.
- 지원할 경우 `즉시 / 예약`을 제공하고 audit에 requestedAt, effectiveAt을 구분한다.
- 위험도 등급을 도입한다.
  - 낮음: Shift SLA
  - 중간: 매칭 타이머·반경·초대 수
  - 높음: 결제·지갑·취소·노쇼·서비스 지역·알림 채널
- 1인 운영을 전제로 별도 승인자는 강제하지 않아도 되지만, 높은 위험은 재인증 또는 명시적 문구 입력, 5분 취소 유예, 즉시 롤백 중 하나를 제공한다.

### P1-5. `Live` 근거에 관측 시각과 데이터 출처가 없다

Supply evidence와 Simulation은 여러 카드를 `Live`로 표시하지만 페이지는 서버에서 한 번 가져온 스냅샷이며 자동 갱신, 마지막 갱신 시각, 수동 새로고침이 없다. 특히 실제 좌표가 부족하면 `Demo Ho Chi Minh City` 좌표를 사용하면서도 화면 상단에서 테스트 기준점임을 충분히 경고하지 않는다.

수정 요건:

- 모든 실시간성 배지에 `as of 10:42:18` 또는 상대 시각을 붙인다.
- `Refresh evidence` 버튼과 로딩·실패·오래됨 상태를 제공한다.
- Demo/fallback 좌표를 사용할 때는 상단에 `Production decision에 사용하지 마세요` 경고를 표시한다.
- 공급 0, 신선 좌표 0이면 세부 시뮬레이션 표를 펼치지 말고 선행 조건을 해결하는 빈 상태를 먼저 보여 준다.
- smoke/demo booking과 Partner를 결과 샘플에서 제외하고 포함 여부와 표본 기간을 표시한다.

### P1-6. 성공처럼 보이는 상태와 실제 운영 차단 상태가 충돌한다

Supply 화면의 `Final partner choice control matrix`는 초록색 `0 control choice(s)`를 표시하지만 같은 화면에는 `Marketplace ready 0`, `Final gate held 30`, `Location block 30`, `Push gap 30`이 표시된다. 정책 기본값이 맞다는 뜻과 실제 운영 준비가 됐다는 뜻이 섞였다.

수정 요건:

- `0 control choice(s)`를 `0 policy deviations` 또는 `All launch baselines aligned`로 바꾼다.
- 정책 정합성과 공급 준비 상태를 별도 상태로 분리한다.
- 실제 공급이 0이면 화면 최상단 상태는 성공이 아니라 `Launch blocked — no usable supply`여야 한다.
- 각 경고에 바로 이동 가능한 작업 링크를 제공한다: 위치 갱신 요청, Push 기기 확인, KYC 큐, 현금 채무 큐.

### P1-7. 중첩 스크롤이 화면 전체를 조각낸다

Matching, Decision, Audit 화면은 페이지 스크롤 안에 카드 스크롤이 다시 있고, 표에도 별도 스크롤이 있다. 실제 전체 화면 캡처에는 상단 레이아웃이 반복되고 큰 공백이 생겼으며, 운영자도 어느 스크롤 컨텍스트에 있는지 잃기 쉽다.

원인:

- `globals.css:15977-15982`가 Operations Policy의 모든 top-level card에 최대 높이와 `overflow-y:auto`를 적용한다.
- `globals.css:15986`부터 표에 또 별도 최대 높이와 overflow를 적용한다.
- 일부 작업 카드에도 추가 세로 스크롤이 적용된다.

수정 요건:

- 페이지의 세로 스크롤을 하나만 유지한다.
- top-level card의 max-height/overflow를 제거한다.
- 표가 아주 길 때만 표 내부 스크롤을 쓰되 sticky header와 명확한 경계를 제공한다.
- 0값 시뮬레이션과 반복 설명을 접어 전체 길이를 먼저 줄인다.

### P1-8. 고급 워크스페이스가 분리됐지만 여전히 과도하게 길고 중간 선택 화면이 불필요하다

`details=all`은 실제 모든 내용을 보여 주지 않고 세 개 버튼만 보여 주는 중간 화면이다. 쿼리 이름과 실제 동작이 다르고, 화면 대부분이 빈 공간이다. 각 워크스페이스 안에서는 다시 긴 설명·카드·표가 이어진다.

수정 요건:

- `details=all` 중간 화면을 제거하고 상단에 영구 탭 `Policies / Supply / Simulation / Audit`을 둔다.
- 마지막 사용 탭 또는 가장 중요한 `Policies`를 기본으로 연다.
- Decision은 실제 집행 상태에 따라 Policies 그룹에 통합하거나 별도 Product Decision 화면으로 분리한다.
- Matching의 `Policy editor`는 단순히 기본 비교표로 돌아가는 링크가 아니라 해당 7개 매칭 정책을 바로 보여 줘야 한다.

### P1-9. 잘못된 집계 이름이 운영자의 판단을 흐린다

- `savedCount`는 `updatedAt`이 있는 정책 수를 세면서 `saved override(s)`라고 부른다. 테스트가 값을 바꿨다가 기본값으로 복구해도 override로 계산된다.
- `blockingCount`는 기본값과 다른 카드 수인데 `control choice(s)`로 표시된다.
- `Recommended value review`는 이미 일치하는 28개 카드까지 만들 수 있어 주의 항목보다 정상 항목이 더 많은 공간을 차지한다.

수정 요건:

- override 수는 현재값과 기준값이 다를 때만 센다.
- `Changed at least once`, `Current deviations`, `Needs review`를 서로 분리한다.
- 기본 화면에서는 deviation과 warning만 보여 주고 `Show all aligned policies`로 확장한다.

### P1-10. 일부 라우트는 사용하지 않는 데이터를 가져온다

코드 기반 로드 계획을 보면 다음 불필요 조회가 있다.

- `needsBookings = policyOverview || matchingReview || decisionReview`이므로 Matching policy editor와 Decision editor도 booking을 읽는다.
- Advanced index는 세 버튼만 표시하지만 `settingsHref`가 항상 존재해 정책 28개를 읽는다.
- 기본 화면은 settings, booking sample, policy audit, booking gate audit까지 네 종류의 데이터를 병렬 조회한다.

수정 요건:

- Matching policy editor: settings만 조회.
- Decision editor: settings만 조회.
- Advanced chooser가 유지된다면 access 정보 외 데이터 조회 0건.
- 기본 화면은 정책 목록 1회와 주의 요약용 집계 endpoint 1회로 제한하는 방안을 검토한다.
- 성능 예산 테스트에 라우트별 허용 API 호출 수를 넣는다.

## 6. P2 — 품질 개선

### P2-1. 개발자식 복수형이 그대로 노출된다

`5 enforced policy`, `6 saved override(s)`, `1 item(s)`, `10 minute(s)`, `0 partner(s)` 같은 문구가 다수 존재한다. 운영 화면의 완성도를 크게 떨어뜨린다.

권장:

- 공통 plural helper 또는 `Intl.PluralRules`를 사용한다.
- 예: `5 enforced policies`, `1 item`, `0 partners`, `10 minutes`.

### P2-2. 운영 화면에 구현 세부사항이 과도하게 노출된다

Audit workspace에 `BookingsService.createBooking -> MatchingService.openBooking`, API endpoint 이름 등 개발자 정보가 직접 노출된다. 운영자는 “어디에서 확인하고 무엇을 해야 하는가”가 우선이다.

권장:

- 기본 문구: `새 부킹 상세 > Matching policy snapshot에서 확인`.
- 기술 정보는 `Developer details` 접기 영역이나 System Health 문서로 이동한다.

### P2-3. 정적 문구가 실제 시스템 상태와 쉽게 어긋난다

FCM 관련 문구는 일부 영역에서 “credentials가 준비되면”이라고 말하고 다른 영역에서는 “live smoke와 token recovery가 passed”라고 말한다. 정적 문자열 여러 개가 서로 다른 시점을 설명한다.

권장:

- Notifications/System Health의 실제 readiness 값을 한 모델로 가져온다.
- 상태 문구는 `Configured`, `Smoke passed`, `Production monitoring ready`, `Policy enabled` 네 단계를 분리한다.

### P2-4. 오류 안내가 원인을 구분하지 못한다

서버 action은 missing reason, missing confirmation, conflict, range error, max length, API failure를 대부분 `The API rejected this policy update`로 합친다. 또한 API DTO는 reason 최대 500자를 제한하지만 textarea에는 maxLength가 없다.

권장:

- 충돌: `다른 운영자가 먼저 변경했습니다. 최신 값을 다시 확인하세요.`
- 같은 값: `현재 값과 같습니다.`
- 범위: 허용 범위를 필드 아래 표시.
- 사유: 12–500자 카운터 표시.
- 권한: `System Policy 권한이 없습니다.`
- 네트워크: 입력값을 보존하고 재시도 제공.

## 7. 권장 정보 구조

기본 정책 목록은 아래 6개 운영 영역으로 재분류하는 것이 가장 자연스럽다.

1. **Shift & Queue SLA — 7개**
   - Matching delay, Payment hold, Cancellation, Refund, Notification failure, Cash reconciliation, Partner approval
2. **Booking Safety — 5개**
   - Customer/address distance, First-pick distance, GPS freshness, Distance gate, Vietnam service area
3. **Matching & Availability — 7개**
   - Response window, Radius, Partner location freshness, Invitation limit, Travel buffer, First-pick acceptance, Marketplace opening
4. **Money & Settlement — 3개**
   - Negative wallet gate, Cash clearance, Payout batch cycle
5. **Exceptions & Evidence — 5개**
   - Action evidence gate, First-pick expiry, Cancellation after match, No-show handling, No-show evidence
6. **Notification Routing — 1개**
   - Partner alert channel

각 그룹 헤더에는 `전체 / 주의 / 변경됨` 수만 표시하고, 기본값은 주의가 있는 그룹부터 펼친다.

## 8. 권장 기본 화면

1. 페이지 헤더
   - 현재 정책 수
   - 기준값과 다른 정책 수
   - 마지막 운영자 변경 시각
   - 데이터 갱신 시각
2. 주의 필요 스트립
   - 감사 데이터 오류
   - 공급 0
   - live deviation
   - 최근 차단된 booking create
3. 정책 그룹 목록
   - 검색
   - `Needs review / Changed / All`
   - 5열 목록
4. 우측 변경 패널
   - 선택한 정책의 현재값, 권장값, 영향, 활성 booking 영향
   - 새 값, 사유, 확인
   - 위험도에 따른 추가 확인
5. Advanced evidence 탭
   - Supply
   - Simulation
   - Audit

## 9. 권장 변경 흐름

1. `Open change`를 누르면 목록 위치를 유지한 채 우측 패널을 연다.
2. 운영자는 새 값을 입력한다.
3. 현재값과 같으면 즉시 `No change`를 표시하고 저장을 비활성화한다.
4. 값이 달라지면 영향·위험도·적용 시점이 갱신된다.
5. 사유 12–500자와 확인 체크를 완료한다.
6. 높은 위험 정책이면 재인증 또는 명시적 확인을 한 번 더 한다.
7. 저장 성공 후 `Before → After`, 적용 시각, audit ID, `Undo` 또는 롤백 링크를 표시한다.

## 10. Codex 구현 우선순위

### 1차 — P0, 감사와 변경 가능성 복구

- audit metadata `before/after` 계약 수정 및 실제 API 계약 테스트
- 확인 체크박스 문구 가시화
- 클라이언트 no-op 감지와 저장 비활성화
- 인라인 오류 및 사유 500자 제한
- 스모크 audit source 분리

### 2차 — 1440px 핵심 UX 재구성

- 8열 표를 5열 그룹 목록으로 교체
- 검색·상태·변경 필터
- top-level card 중첩 스크롤 제거
- 변경 폼을 우측 패널 또는 집중 편집 영역으로 이동

### 3차 — 데이터 신뢰성과 고급 검토 정리

- Live timestamp, Refresh, source/sample provenance
- Demo/smoke 데이터 제외
- Supply 0일 때 empty-state 우선
- 불필요 API 호출 제거
- 중간 Advanced chooser 제거 및 영구 탭 도입

### 4차 — 문구와 유지보수 품질

- plural 처리
- Planning/Live/Deprecated 상태 정합성
- 기술 문구 접기
- FCM readiness 동적화

## 11. 필수 회귀 테스트

1. 실제 API audit payload의 `before/after`가 UI에 표시되는 계약 테스트
2. 확인 체크 문구가 `sr-only`가 아닌 가시 텍스트인지 검증하는 렌더 테스트
3. 값이 같을 때 저장 비활성화, 값이 바뀌면 활성화되는 상호작용 테스트
4. reason 11자, 12자, 500자, 501자 경계 테스트
5. conflict, same value, permission, validation, network 오류별 사용자 문구 테스트
6. automated_smoke가 운영 감사 기본 목록에서 제외되는 테스트
7. `details=all`, Matching editor, Decision editor의 API 호출 예산 테스트
8. 1440 x 1000에서 첫 열 단어 단위 줄바꿈, 중첩 세로 스크롤, 가로 잘림이 없는 시각 회귀 테스트
9. 전 정책의 `enforced` 상태와 UI 배지·문구가 일치하는 테스트
10. 1/0/복수형 문구 테스트

## 12. 실행 검증 결과

| 명령 | 결과 |
|---|---|
| `npm.cmd run test --workspace @massage-vn/admin-web -- app/operations-policy` | 44 files, 139 tests PASS |
| `npm.cmd run policy:admin-consistency` | PASS — API/Admin 정책 키와 기본값 정합 |
| Impeccable static detector | Operations Policy 전용 신규 오류는 검출되지 않았으나, 전역 CSS의 side-tab 패턴 6건을 경고함. 이번 페이지 핵심 문제는 실제 렌더·상호작용 감사에서 확인됨. |

테스트 통과는 현재 구현 의도와 코드가 일치한다는 뜻이지 운영자 경험과 실제 API 감사 계약이 올바르다는 뜻은 아니다. 특히 audit row 테스트가 실제 API와 다른 가짜 필드명을 사용하고 있어 P0 문제를 놓치고 있다.

## 13. 증거 캡처

- `01-policy-overview-1440.png`: 1440px 기본 비교표의 첫 열 압축
- `02-policy-change-panel.png`: 변경 패널의 Before/After/영향 구조
- `03-policy-change-confirmation.png`: 설명이 보이지 않는 필수 체크박스
- `04-advanced-review-loading-or-empty.png`: 빈 공간이 큰 Advanced chooser
- `05-matching-policy-editor.png`: 내부 스크롤과 전체 페이지 공백
- `06-matching-supply-evidence.png`: 공급 근거 화면의 중첩 스크롤
- `07-matching-simulation.png`: Simulation의 긴 근거 구조
- `08-decision-editor.png`: Decision editor의 planning/live 모순
- `09-decision-evidence.png`: 제품 의사결정 백로그가 운영 화면을 과도하게 차지함
- `10-policy-audit-duplicates.png`: Audit workspace와 중첩 스크롤 상태

증거 폴더: `docs/audits/operations-policy-reaudit-evidence-2026-08-11/`

## 14. 최종 판단

이 페이지의 핵심 방향인 “한 번에 하나의 정책만 안전하게 변경하고 근거를 남긴다”는 맞다. 하지만 현재는 정책 목록을 읽기 어렵고, 변경 확인 문구가 보이지 않으며, 가장 중요한 감사 기록이 전·후 값을 잃고 자동 스모크 기록으로 오염되어 있다. 먼저 P0 데이터·폼 계약을 바로잡고, 그 다음 1440px 기준 정책 목록을 그룹형 5열 구조로 재구성해야 한다. 고급 시뮬레이션을 더 추가하는 것보다 이 두 단계가 운영 품질에 훨씬 큰 효과를 낸다.
