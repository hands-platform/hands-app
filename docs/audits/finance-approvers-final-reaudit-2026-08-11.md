# Finance Approvers 최종 재감사 보고서

- 감사일: 2026-08-11
- 대상: `/finance-tax/finance-approvers`
- 기준 화면: 1440 × 1000 데스크톱
- 제외 범위: 1024px 이하 반응형 UI는 사용자 요청에 따라 검사하지 않음
- 감사 범위: 실제 화면, 역할 부여·회수 흐름, 현재 데이터, 권한 모델, API·DB 트랜잭션, 감사 로그, 테스트 데이터 수명주기, 문구, 접근성, 성능 구조
- 판정: **출시 보류(Release hold)**
- 종합 점수: **38/100**

## 1. 최종 결론

화면의 기본 목적은 명확하고, API에는 자기 역할 변경 차단·마지막 승인자 제거 차단·역할 변경과 감사 로그의 동일 트랜잭션 기록이라는 좋은 기반이 있다. 그러나 현재 페이지는 “재무 이중 승인 권한을 안전하게 관리하는 통제 화면”이 아니라 “관리자 목록에서 역할 배열을 즉시 수정하는 화면”에 더 가깝다.

출시 보류의 핵심 이유는 다음과 같다.

1. 한 명의 시스템 운영자가 다른 관리자에게 재무 승인 권한을 즉시 부여하거나 회수할 수 있다. **재무 작업에는 maker-checker가 있으나, maker-checker 권한 자체를 만드는 작업에는 maker-checker가 없다.**
2. API 사유가 선택 사항이고, 생략하면 `No reason provided by API caller`라는 합성 문구로 감사 로그가 생성된다. 화면의 “모든 역할 변경에 사유를 사용한다”는 설명과 실제 서버 계약이 다르다.
3. 현재 로컬 데이터 22명의 이름이 모두 Smoke·Demo·Local·Audit 계열이며, 12명의 재무 승인자도 전부 이 집합에 속한다. 실제 독립된 두 명의 운영자가 준비되어 있다는 증거는 없다.
4. 역할 부여 이벤트는 현재 DB에서 0건이다. seed/smoke가 역할 배열을 직접 넣기 때문에 현재 승인 권한의 생성 근거를 추적할 수 없다.
5. 두 명의 승인자를 동시에 회수하면 각 트랜잭션이 상대방을 남은 승인자로 보고 둘 다 성공할 수 있는 경쟁 조건이 있다. “마지막 승인자 보호”가 단일 요청에는 유효하지만 동시 요청에는 안전하지 않다.
6. 현재 권한 범위는 전용 재무 권한 관리자가 아니라 광범위한 `SYSTEM`/`SYSTEM_ADMIN_OPERATORS` 운영자까지 역할 변경 API에 접근할 수 있다.
7. 감사 로그에서 `finance_approver`를 검색하면 실제 역할 변경이 아니라 페이지 조회 156건이 잡힌다. 운영자가 권한 변경 이력을 바로 확인할 수 없다.
8. 사용자 목록 API 실패가 빈 배열 fallback으로 바뀌어 권한 오류·API 장애가 `0 admins`, `0 approvers`처럼 보일 수 있다.

따라서 색상·간격을 추가로 다듬는 것보다 **권한 변경 자체의 이중 통제, 실제 운영자 준비 상태, 동시성, 감사 추적, 오류 상태 분리**를 먼저 해결해야 한다.

## 2. 실제 확인한 현재 상태

| 항목 | 확인값 | 운영 해석 |
|---|---:|---|
| 관리자 목록 | 22명 | 화면과 DB가 같은 수를 표시함 |
| 재무 승인자 | 12명 | 화면의 54.5%와 계산상 일치 |
| 비승인 관리자 | 10명 | 모두 권한 후보나 미처리 대상이라는 뜻은 아님 |
| 이름 기준 fixture 추정 | 22명 | Smoke·Demo·Local·Audit 명칭에 모두 해당 |
| fixture 추정 승인자 | 12명 | 실제 사람 기반 승인 준비 상태를 증명하지 못함 |
| 비-fixture로 식별 가능한 승인자 | 0명 | 현 환경에서 실제 독립 승인자를 확인할 수 없음 |
| 역할 grant/revoke 감사 이벤트 | 0건 | 현재 역할 상태의 생성 근거가 없음 |
| `finance_approver` 감사 검색 | 156건 | 확인된 표시 행은 모두 Admin web / Page view |
| 목록 상한 | 50명 | 총 관리자 수와 다음 페이지 정보가 없음 |

`fixture` 판정은 이름 패턴을 이용한 현재 환경 진단일 뿐, 영구적인 출처 판정 방법으로 사용해서는 안 된다. 운영 코드에는 `environment`, `fixtureType`, `runId`, `expiresAt` 같은 명시적 provenance가 필요하다.

또한 `appSessions`만으로 실제 관리자 활동성을 판단해서는 안 된다. 현재 디렉터리 조회가 가져오는 세션은 모바일 앱 세션일 수 있고, 관리자 웹의 로그인·MFA·당번 상태를 의미하지 않는다. 결론은 “승인자들이 모두 비활성”이 아니라 **현재 페이지와 데이터 모델만으로 실제 승인 준비 상태를 증명할 수 없다**는 것이다.

이번 감사에서는 데이터 삭제나 역할 변경을 수행하지 않았다. 빈 사유 제출은 브라우저 기본 유효성 검사까지만 확인했고 실제 API 변경은 발생시키지 않았다.

## 3. 화면과 운영 흐름별 건강도

| 단계 | 검수 내용 | 건강도 | 핵심 판단 |
|---:|---|---|---|
| 1 | 페이지 진입과 통제 상태 파악 | 위험 | 54.5% 비율과 정적인 `Protected`가 실제 독립 승인 가능 여부를 대신함 |
| 2 | 운영 규칙 이해 | 개선 필요 | 설명은 유용하지만 상단 카드와 중복되고 실제 예외·준비 상태는 없음 |
| 3 | 승인자/후보자 탐색 | 위험 | 22명을 한 목록에 노출하며 검색·필터·페이지네이션·현재 사용자 표시가 없음 |
| 4 | 역할 부여·회수 준비 | 위험 | 각 행에 즉시 실행 폼이 반복되고 영향 범위·대기 작업·백업 여부가 없음 |
| 5 | 입력 검증 | 개선 필요 | 빈 사유는 브라우저가 막지만 서버 API는 사유 생략을 허용함 |
| 6 | 변경 확인과 실패 복구 | 위험 | 확인 단계가 없고 모든 오류가 하나의 `failed` 문구로 합쳐짐 |
| 7 | 역할 변경 감사 확인 | 위험 | 정확한 역할 이력 대신 페이지 조회 로그가 검색 결과를 오염시킴 |

## 4. 잘 구현된 부분

다음 기반은 유지하는 것이 좋다.

- 페이지 제목과 목적 문구가 재무 승인 역할의 범위를 설명한다.
- 역할 변경 API는 자기 자신을 대상으로 하는 변경을 거부한다.
- 비관리자 계정에는 재무 승인 역할을 부여하지 않는다.
- 단일 요청 기준으로 마지막 재무 승인자 회수를 막는다.
- 역할 변경과 감사 로그 쓰기가 한 DB 트랜잭션 안에 있다.
- 감사 메타데이터에 이전 역할과 다음 역할 집합을 함께 기록한다.
- 테이블 헤더, 입력 레이블, 상태 텍스트가 존재하고 색상만으로 상태를 전달하지 않는다.
- 빈 사유 제출 시 네이티브 `required` 검증이 실제 제출을 막고 입력으로 포커스를 이동한다.
- 관련 관리자 웹 테스트와 API 단위 테스트가 현재 범위에서는 통과한다.

관련 코드:

- `apps/api/src/admin/admin.service.ts:3730` 자기 역할 변경 차단
- `apps/api/src/admin/admin.service.ts:3747` Admin 기본 역할 확인
- `apps/api/src/admin/admin.service.ts:3754` 마지막 승인자 확인
- `apps/api/src/admin/admin.service.ts:3769` 역할 변경
- `apps/api/src/admin/admin.service.ts:3774` 감사 이벤트 동시 기록

## 5. P0 — 출시 전에 반드시 수정

### P0-1. 승인 권한 자체의 변경에 maker-checker가 없음

현재 화면의 `Grant approver` 또는 `Revoke approver`는 서버 액션을 통해 즉시 역할 배열을 바꾼다. 요청·검토·승인 상태가 없으며 실행 버튼을 누른 운영자 한 명의 판단으로 재무 승인 권한이 생기거나 사라진다.

이는 재무 승인 체계의 가장 중요한 취약점이다. 돈 이동 작업을 두 사람이 승인하도록 만들어도, 한 사람이 공모 가능한 계정에 승인 권한을 먼저 부여할 수 있으면 통제가 우회된다.

수정 기준:

1. 직접 `grant/revoke`를 없애고 `권한 변경 요청`을 생성한다.
2. 요청자와 승인자는 반드시 다른 실제 운영자여야 한다.
3. 승인자는 전용 `FINANCE_ROLE_GOVERNANCE` 권한 또는 이에 해당하는 좁은 권한을 가져야 한다.
4. 요청에는 대상, 현재/제안 역할, 사유, 영향 분석, 요청자, 요청 시각, 만료 시각, 상태가 포함되어야 한다.
5. 승인 또는 반려 후에만 역할 변경을 실행하고 request ID와 실행 결과를 동일 감사 체인으로 연결한다.
6. 가능하다면 권한 상승 변경에는 최근 재인증 또는 MFA 확인을 요구한다.
7. 기존 승인 요청 모델을 재사용할 수 있으면 재사용하되, 감사 로그 한 행을 워크플로 상태 저장소처럼 사용하지는 않는다.

소규모 1인 운영에서는 이 요건을 숨기면 안 된다. 실제 독립된 두 번째 사람이 없으면 화면은 `Protected`가 아니라 **Independent approver unavailable**로 표시해야 한다. 외부 회계 담당자나 비상 백업 운영자를 별도로 지정하거나, 명시적인 break-glass 정책을 마련해야 한다.

break-glass를 허용한다면 다음을 모두 요구한다.

- 재인증/MFA
- 목적과 사유 최소 길이
- 짧은 권한 만료 시간
- 즉시 외부 알림
- 수정 불가능한 감사 기록
- 사후 검토 기한과 담당자

관련 코드:

- `apps/admin_web/app/finance-tax/finance-approvers/actions.ts:20`
- `apps/api/src/admin/admin.service.ts:3725`

### P0-2. 광범위한 시스템 권한이 재무 승인 권한을 변경할 수 있음

`/admin/users` API는 `SYSTEM_ADMIN_OPERATORS` 카테고리에 매핑되어 있고 상위 `SYSTEM` 카테고리도 이를 통과한다. 역할 변경 서비스 내부에는 `MASTER_ADMIN` 또는 별도 finance-role-governance 권한을 확인하는 호출이 없다.

운영 위험:

- 콘텐츠/설정/일반 관리자 운영을 위해 넓은 SYSTEM 권한을 받은 계정이 재무 승인 권한까지 변경할 수 있다.
- 관리자 계정 관리 권한과 돈 이동 승인 권한 관리가 같은 경계에 놓인다.
- 손상된 시스템 운영자 계정이 재무 통제로 수평 이동할 수 있다.

수정 기준:

1. `PATCH /admin/users/:id/finance-approver`를 일반 `/admin/users` 권한 매핑에서 분리한다.
2. 페이지 열람, 후보 조회, 변경 요청, 승인 결정, break-glass를 서로 다른 권한으로 나눈다.
3. 상위 `SYSTEM` 카테고리의 암묵적 상속만으로 변경 결정을 허용하지 않는다.
4. 서버 메서드 내부에서도 권한을 재검증해 라우트 설정 실수에 대비한다.
5. 허용·거부된 권한 변경 시도를 모두 보안 감사 대상으로 남긴다.

관련 코드:

- `apps/api/src/admin/admin-operator-category.guard.ts:172`
- `apps/api/src/admin/admin-operator-category.guard.ts:206`
- `apps/admin_web/lib/admin-operator-access-model.ts:123`
- `apps/api/src/admin/admin.service.ts:3725`

### P0-3. 서버는 변경 사유 없이도 역할 변경을 허용함

화면 input에는 `required`가 있지만 DTO의 `reason`은 `@IsOptional()`이다. 서버 액션도 빈 문자열을 `undefined`로 바꾼다. API를 직접 호출하면 사유 없이 역할 변경이 가능하고, 감사 로그에는 실제 사유 대신 `No reason provided by API caller`가 들어간다.

따라서 “Use a reason for every role change”라는 화면 설명은 현재 사실이 아니다.

수정 기준:

1. DTO에서 `reason`을 필수로 바꾼다.
2. 공백을 정규화한 뒤 최소 12자, 최대 500자를 서버에서 검사한다.
3. `No reason provided by API caller` fallback을 권한 변경 흐름에서 금지한다.
4. UI에도 글자 수, 예시, 필드 오류를 표시한다.
5. 빈 문자열, 공백, 1자, 11자, 12자, 500자, 501자 테스트를 추가한다.
6. 오류 시 입력한 사유가 보존되어야 한다.

관련 코드:

- `apps/admin_web/app/finance-tax/finance-approvers/actions.ts:11`
- `apps/api/src/admin/admin.dto.ts:428`
- `apps/api/src/admin/admin-text-helpers.ts:18`
- `apps/api/src/admin/admin.service.ts:3781`

### P0-4. 동시 회수 시 승인자가 0명이 될 수 있음

현재 마지막 승인자 검사는 트랜잭션 안에서 “대상 외 승인자 수”를 센다. 승인자가 A와 B 두 명일 때 A 회수와 B 회수가 동시에 시작되면, 두 트랜잭션 모두 상대방 한 명을 보고 검사를 통과할 수 있다. 이후 둘 다 역할을 제거하면 승인자가 0명이 된다.

수정 기준:

1. 역할 변경 전체를 직렬화한다. PostgreSQL advisory lock, 명시적 행 잠금, 또는 검증된 serializable transaction 중 프로젝트 표준에 맞는 하나를 사용한다.
2. 승인 결정 직전에 유효한 실제 승인자 수를 다시 확인한다.
3. 테스트 fixture와 비활성/잠긴 계정은 “남은 실제 승인자”에 포함하지 않는다.
4. 두 승인자 동시 회수 테스트를 병렬로 실행하고 정확히 하나만 성공하는지 검증한다.
5. 충돌은 일반 실패가 아니라 `APPROVER_SET_CHANGED` 같은 안정적인 오류 코드로 반환한다.

관련 코드:

- `apps/api/src/admin/admin.service.ts:3734`
- `apps/api/src/admin/admin.service.ts:3754`

### P0-5. 현재 승인자 준비 상태가 테스트 데이터로 과장됨

현재 환경에서 관리자 22명과 승인자 12명의 표시 이름이 모두 Smoke·Demo·Local·Audit 계열이다. seed와 smoke 스크립트는 역할 API를 거치지 않고 `FINANCE_APPROVER`를 직접 넣는다. 일부 라이프사이클 smoke는 cleanup 오류를 무시한다.

그 결과:

- 화면의 12 approvers와 54.5%는 실제 운영 준비도를 의미하지 않는다.
- 테스트 중 생성된 고권한 사용자가 남을 수 있다.
- 현재 역할에 대한 grant/revoke 감사 이벤트가 없다.
- 이름 패턴이 바뀌면 fixture와 실사용자를 구분할 수 없다.

수정 기준:

1. production에서는 fixture 사용자에게 `ADMIN`, `MASTER_ADMIN`, `FINANCE_APPROVER` 부여를 서버·DB 배포 검사로 차단한다.
2. smoke는 격리된 테스트 DB/tenant에서 실행한다.
3. fixture에 명시적 provenance와 만료 시간을 둔다.
4. cleanup 오류를 삼키지 말고 실패 결과와 남은 레코드 ID를 출력하며 테스트를 실패시킨다.
5. 테스트 전후 고권한 사용자 수와 ID 집합 불변식을 확인한다.
6. 초기 운영 승인자 부트스트랩은 별도 승인된 배포 절차와 감사 근거를 남긴다.
7. 기존 22명은 참조관계 dry-run과 데이터 보존 기준을 확인한 뒤 별도 승인 하에 정리한다. 이번 감사에서는 삭제하지 않았다.

관련 코드:

- `apps/api/prisma/seed.js:79`
- `apps/api/prisma/seed.js:472`
- `infra/scripts/api-smoke.mjs:55`
- `infra/scripts/api-smoke.mjs:69`
- `infra/scripts/provider-wallet-withdrawal-lifecycle-smoke.mjs:368`
- `infra/scripts/provider-wallet-withdrawal-lifecycle-smoke.mjs:424`
- `infra/scripts/provider-payout-reversal-lifecycle-smoke.mjs:480`
- `infra/scripts/provider-payout-reversal-lifecycle-smoke.mjs:540`

### P0-6. 역할 변경 이력을 운영 화면에서 찾을 수 없음

감사 로그 페이지에서 `q=finance_approver`를 사용하면 `action`, `target`, actor 정보의 broad contains 검색이 수행된다. 페이지 조회 이벤트 target에 `/finance-tax/finance-approvers`가 들어가므로 실제 역할 변경이 아니라 페이지 조회 156건이 검색되었다. 확인된 역할 grant/revoke 이벤트는 0건이었다.

서버는 이미 `action` 파라미터를 여러 개 받아 정확한 필터를 만들 수 있다. 새 검색 엔진보다 정확한 링크와 페이지 내 타임라인이 먼저 필요하다.

수정 기준:

1. 감사 링크는 `action=admin_user.finance_approver.grant`와 `action=admin_user.finance_approver.revoke`의 정확한 집합을 사용한다.
2. 요청 워크플로 도입 후 request/approve/reject/expire/break-glass 액션도 허용 집합에 추가한다.
3. 역할 관리 페이지에 최근 변경 10건을 직접 표시한다.
4. 대상 운영자별 이력은 `target=user:{id}`로 추가 필터링한다.
5. page view는 역할 변경 이력 수와 결과 상한을 소비하지 않아야 한다.
6. 현재 역할마다 `마지막 변경자`, `변경 시각`, `요청 ID`, `사유`를 연결한다.

관련 코드:

- `apps/api/src/admin/admin-governance.routes.ts:14`
- `apps/api/src/admin/admin.service.ts:28350`
- `apps/api/src/admin/admin.service.ts:31792`

### P0-7. API 오류가 실제 0명처럼 보임

페이지는 사용자 목록을 `adminGet(..., [])`로 읽는다. 401, 403, 5xx, timeout이 fallback으로 흡수되면 다음이 모두 정상처럼 렌더링될 수 있다.

- Approver coverage 0%
- Admin operators 0
- Non-approver admins 0
- 빈 디렉터리
- 그런데 Dual-control guard는 여전히 `Protected`

재무 통제 화면에서는 “실제로 0명”과 “조회 실패”를 절대 같은 상태로 표현하면 안 된다.

수정 기준:

1. API 성공·권한 없음·서버 실패·timeout을 구분하는 result 타입을 사용한다.
2. 실패 시 기존 수치를 0으로 계산하지 않는다.
3. command board 전체를 `Data unavailable`로 표시하고 역할 변경을 비활성화한다.
4. 마지막 정상 조회 시각, 재시도, 요청 ID를 제공한다.
5. 401/403/500/timeout 회귀 테스트를 추가한다.

관련 코드:

- `apps/admin_web/app/finance-tax/finance-approvers/page.tsx:32`

## 6. P1 — 운영 효율과 판단 품질 개선

### P1-1. `Approver coverage 54.5%`는 잘못된 성공 지표임

재무 승인자는 많을수록 좋은 것이 아니다. 필요 이상으로 권한을 넓히면 공격면과 공모 가능성이 커진다. 22명 중 12명이라는 비율은 다음을 설명하지 못한다.

- 서로 다른 실제 사람 두 명이 존재하는가
- maker와 approver가 분리되는가
- 주 담당자와 백업 담당자가 모두 사용 가능한가
- 계정이 잠기지 않았고 재인증 가능한가
- 승인 대기 업무를 처리할 수 있는가
- fixture 계정이 아닌가

대체 지표:

| 현재 지표 | 권장 지표 |
|---|---|
| Approver coverage 54.5% | Independent approval readiness: Ready / Blocked / Unknown |
| Admin operators 22 | Eligible real admins 0 / total 22 |
| Non-approver admins 10, Pending | Eligible candidates N |
| Dual-control guard Protected | Primary + backup: 0/2 verified |

`Non-approver admins`에 `Pending`을 붙이면 10명 모두에게 권한을 부여해야 할 미처리 업무처럼 보인다. 후보가 아닌 일반 관리자는 정상 상태이므로 `Pending`을 제거해야 한다.

### P1-2. 운영 규칙 카드가 상단 정보와 중복됨

상단 command board와 `Finance approver operating rule`이 관리자 수·승인자 수·보호 규칙을 반복한다. 실제 운영자가 필요한 목록과 예외가 첫 화면 아래로 밀린다.

수정 기준:

- 규칙 설명은 짧은 `How dual control works` 도움말 또는 접히는 정책 패널로 축소한다.
- 첫 화면에는 실제 준비 상태, 차단 사유, 대기 중인 권한 요청, 최근 변경을 우선한다.
- 정적인 `Safe guard` 대신 서버가 계산한 현재 위험을 표시한다.

### P1-3. 22개의 즉시 변경 폼이 목록 탐색과 오조작 위험을 높임

각 행에 사유 input과 Grant/Revoke 버튼이 반복되어 페이지가 길고, 운영자는 사람을 비교하기보다 실행 컨트롤을 계속 마주친다. 입력 열이 좁아 placeholder도 잘린다.

수정 기준:

1. 기본 테이블에서는 실행 폼을 제거하고 행별 `Review access` 하나만 제공한다.
2. 오른쪽 drawer에서 현재 상태, 변경안, 영향, 사유, 확인을 순서대로 보여준다.
3. 승인자는 `Active approvers`, 후보는 `Eligible admins`, 진행 중인 건은 `Pending requests`, 완료 이력은 `History`로 분리한다.
4. 검색, 역할 필터, 계정 상태 필터를 제공한다.
5. 빈 후보 목록과 권한 부족 상태를 명확히 구분한다.

### P1-4. 현재 로그인 운영자를 표시하거나 차단하지 않음

API는 자기 역할 변경을 막지만 화면은 현재 actor를 읽지 않는다. 실제 현재 actor와 같은 이름의 Local Admin Web Actor 행에도 활성 Revoke 버튼이 보인다. 누르면 뒤늦게 generic failure만 받게 된다.

수정 기준:

- 현재 행에 `You` 배지를 표시한다.
- 자기 행의 역할 변경 액션은 비활성화한다.
- 도움말은 “You cannot change your own finance approval access. Ask another role governor.”처럼 해결 방법을 안내한다.
- 동명이인 대신 안정적인 운영자 식별자와 업무 이메일을 표시한다.

### P1-5. 계정과 승인 준비 상태가 없음

현재 테이블은 이름, 전화번호, raw roles, Second approver/Maker only만 보여준다. 권한 결정을 위해서는 다음이 필요하다.

- 관리자 계정 상태: active, suspended, locked, revoked
- 실사용자/fixture 출처
- 최근 관리자 웹 재인증 또는 검증 상태
- 주 담당/백업 담당 구분과 당번 상태
- 현재 맡은 승인 대기 건수와 가장 오래된 건
- maker로 참여한 진행 중 요청 수
- 역할 마지막 변경자·변경 시각·사유
- 권한 검토 만료일 또는 다음 정기 검토일

모바일 `appSessions`나 push device 수를 그대로 노출하는 것은 위 상태의 대체가 아니다. 필요한 관리자 인증·준비 신호를 별도 계약으로 정의해야 한다.

### P1-6. 목록 50명 상한에 총수와 페이지 이동이 없음

API는 `take=50`으로 최신 생성 순 50명만 반환한다. 51명 이상이 되면 coverage, 관리자 수, 비승인자 수가 모두 잘못되지만 화면은 bounded API라는 설명만 보여준다.

수정 기준:

- API는 `items`, `totalCount`, `skip`, `take`를 반환한다.
- 요약 수치는 목록 page가 아니라 서버 집계에서 가져온다.
- 검색과 필터는 서버에서 적용한 뒤 페이지네이션한다.
- `Showing 1–50 of 73`처럼 범위를 표시한다.

관련 코드:

- `apps/admin_web/app/finance-tax/finance-approvers/page.tsx:32`
- `apps/api/src/admin/admin.service.ts:3248`

### P1-7. 오류·성공 피드백이 운영자가 복구할 수 있는 수준이 아님

모든 예외는 `failed`로 합쳐지고 다음 문구만 나온다.

> The API rejected this role update. Check that the target is an admin user and that at least one approver remains.

이 문구로는 자기 변경, 마지막 승인자, 권한 부족, 동시 수정, 잘못된 사유, 네트워크 오류, 대상 삭제를 구분할 수 없다. 성공도 누가 어떤 요청으로 변경했는지 영수증이 없다.

수정 기준:

- 안정적인 오류 코드와 필드 오류를 반환한다.
- 입력값과 열려 있던 drawer를 보존한다.
- 재시도 가능한 오류와 정책상 차단을 구분한다.
- 성공 시 대상, 변경 전/후, 요청자, 승인자, 시각, request ID, 감사 링크를 표시한다.
- URL의 raw `updated`/`failed` 배지를 사용자에게 그대로 노출하지 않는다.

### P1-8. 동일 상태 요청이 no-op 감사 이벤트를 만들 수 있음

이미 승인자인 사용자에게 다시 grant하거나 비승인자에게 revoke해도 현재 서비스는 역할 배열을 다시 저장하고 감사 이벤트를 만든다. 오래된 화면, 중복 클릭, 재시도에서 실제 변경이 없는 이벤트가 쌓일 수 있다.

수정 기준:

- `input.enabled === currentlyEnabled`이면 명시적인 `ROLE_ALREADY_IN_REQUESTED_STATE`를 반환한다.
- 요청 idempotency key를 지원한다.
- 역할 또는 `updatedAt` 기대값으로 stale intent를 검증한다.
- 동일 요청 재전송은 한 번만 처리되어야 한다.

### P1-9. 디렉터리 API가 사용하지 않는 세션·push 데이터를 가져옴

`finance-approver-directory` select는 사용자당 최근 app session 1개와 push device 3개를 가져오지만 현재 페이지는 이를 사용하지 않는다. 재무 권한 화면이 필요하지 않은 민감한 장치/세션 데이터를 과다 조회한다.

수정 기준:

- 목록 DTO를 최소 필드로 분리한다.
- 실제로 필요한 관리자 계정 상태는 정확한 관리자 인증 데이터에서 계산한다.
- app session/push device는 별도 상세 권한과 필요 시점에만 조회한다.

관련 코드:

- `apps/api/src/admin/admin-user-selects.ts:218`

## 7. 권장 화면 재구성

한 페이지 안에서 다음 구조를 권장한다. 별도 페이지를 많이 늘릴 필요는 없다.

### 7.1 첫 화면

1. 제목: `Finance approval access`
2. 설명: `Manage who may provide the independent second approval for money movement. Access changes require a different role governor.`
3. 우측 액션:
   - `View finance approvals`
   - `View role history`
   - `Request access change`
4. 동적 건강도:
   - `Independent approvers: 0 of 2 verified`
   - `Primary coverage: Missing`
   - `Backup coverage: Missing`
   - `Pending access requests: 0`
   - `Fixture accounts excluded: 12`
5. 위험 배너:
   - `Finance dual control is not operational. No two independent real approvers are verified.`

현재의 `Tax overview`와 일반적인 `More finance pages`는 이 페이지의 주 행동이 아니다. 승인 큐, 권한 변경 이력, 관리자 디렉터리가 더 직접적인 연결이다.

### 7.2 탭

| 탭 | 목적 | 기본 정렬 |
|---|---|---|
| Active approvers | 현재 실제 승인 권한과 준비 상태 확인 | 위험/검토기한 우선 |
| Eligible admins | 권한 후보 탐색 | 이름 또는 최근 검증 |
| Pending requests | 요청·승인·반려 처리 | oldest first |
| History | 완료된 역할 변경 감사 | newest first |

### 7.3 권장 테이블 열

| 열 | 표시 내용 |
|---|---|
| Operator | 이름, 업무 이메일/안정 식별자, `You`, fixture 여부 |
| Account | Active/Locked/Suspended, 최근 관리자 인증 검증 |
| Finance access | Approver/Maker only, Primary/Backup |
| Separation readiness | 독립 승인 가능/현재 maker 충돌/확인 불가 |
| Workload | 미처리 승인 건수, oldest age |
| Last changed | 변경 시각, 변경자, 사유 요약 |
| Review | 권한 검토 기한과 상태 |
| Action | `Review access` 하나 |

전체 전화번호는 이 의사결정에 필요하지 않으면 마스킹하거나 상세 화면으로 이동한다. raw enum `ADMIN`, `FINANCE_APPROVER`, `MASTER_ADMIN`은 운영 문구인 `Admin`, `Finance approver`, `Master admin`으로 표시한다.

### 7.4 변경 drawer

1. 대상 운영자와 현재 상태
2. 제안 변경: Grant 또는 Revoke
3. 정책 사전검사
   - 현재 사용자 자신인지
   - fixture인지
   - 실제 관리자 계정이 활성인지
   - 회수 후 primary/backup이 남는지
   - 진행 중인 maker/approver 업무가 있는지
   - 다른 role governor가 승인 가능한지
4. 영향 분석과 필요한 재배정
5. 사유 입력 12–500자
6. `Submit access request`
7. 별도 운영자의 승인/반려
8. 성공 영수증과 정확한 감사 링크

## 8. 문구 개선안

| 현재 문구 | 문제 | 권장 문구 |
|---|---|---|
| Finance Approvers | 관리 대상보다 사람 목록처럼 보임 | Finance approval access |
| Approver coverage | 비율이 높을수록 좋은 것처럼 보임 | Independent approval readiness |
| Non-approver admins / Pending | 정상적인 최소권한 사용자를 미처리로 표현 | Eligible candidates |
| Dual-control guard / Protected | 서버 검증 결과가 아닌 정적 성공 선언 | Primary + backup / Not verified |
| Finance approver operating rule | 상단과 중복 | How dual control works |
| 22 admin(s) | 프로그래머식 복수 표현 | 22 admins |
| Assigned roles | raw enum을 노출 | Access roles |
| Grant approver | 즉시 변경처럼 보이며 실제로 즉시 변경됨 | Request approver access |
| Revoke approver | 영향 확인 없이 파괴적 행동 | Request access removal |
| Reason | 행마다 동일한 접근성 이름 | Reason for changing {operator}'s access |
| Role update notice / failed | 내부 상태 코드 노출 | Access change could not be submitted |

## 9. 접근성·가독성 검수

### 유지할 점

- 테이블에 열 머리글이 있다.
- 입력에 보이는 레이블이 있다.
- 상태가 텍스트와 함께 제공된다.
- 빈 사유 제출은 포커스를 입력으로 이동시킨다.
- 데스크톱 1440px에서 주요 버튼 크기는 조작 가능하다.

### 수정할 점

1. 22개 입력의 접근 가능한 이름이 모두 `Reason`이다. 사람과 동작을 포함한 고유 레이블이 필요하다.
2. 네이티브 유효성 메시지가 브라우저 언어인 한국어(`이 입력란을 작성하세요.`)로 표시되고 페이지는 영어다. 일관된 inline 오류를 제공하되 native validation도 유지한다.
3. 오류가 제출 후 상단으로 이동하며 해당 행·입력과 연결되지 않는다. 오류 요약과 필드 `aria-describedby`를 연결한다.
4. 고위험 변경에 확인 dialog/drawer가 없어 포커스 진입·취소·복귀 흐름도 없다.
5. 현재 사용자, 비활성 사용자, fixture, 마지막 실제 승인자 등의 비활성 상태와 이유를 스크린리더에도 전달해야 한다.
6. 좁은 input에서 placeholder가 잘리므로 placeholder에 의존하지 말고 설명 텍스트를 둔다.
7. 키보드 전용 탐색과 실제 스크린리더 검증은 이번 화면 캡처만으로 완료 판정할 수 없다.

1024px 이하 반응형 문제는 이번 보고서에 포함하지 않았다.

## 10. 성능 및 데이터 계약

현재 22행에서 화면 자체의 심각한 렌더링 병목은 증명되지 않았다. 다만 다음 구조는 규모가 커질수록 불필요한 비용과 잘못된 요약을 만든다.

- 50명 전체 목록을 한 번에 렌더링
- 각 사용자에 사용하지 않는 appSessions/pushDevices 관계 조회
- 목록 결과를 다시 클라이언트에서 세어 요약 생성
- API 실패를 fallback으로 감춤
- 검색·필터·페이지네이션 없음

권장 계약:

```text
GET /admin/finance-approver-governance/summary
  readiness, verifiedRealApprovers, primaryCount, backupCount,
  eligibleCandidateCount, pendingRequestCount, fixtureExcludedCount,
  lastSuccessfulEvaluationAt

GET /admin/finance-approver-governance/operators
  items, totalCount, skip, take, filters

POST /admin/finance-approver-governance/requests
POST /admin/finance-approver-governance/requests/:id/decision
GET /admin/finance-approver-governance/history
```

실제 명칭은 프로젝트 규칙에 맞춰도 되지만, 일반 사용자 디렉터리와 재무 권한 통제 계약은 분리하는 것이 좋다.

`npm run admin:api-budget`는 이번 환경에서 HTTP 401을 받아 측정이 완료되지 않았다. 따라서 성능 예산을 통과했다고 판정하지 않는다. 인증 가능한 동일 조건에서 다시 실행해 응답 시간, query count, payload size를 기록해야 한다.

## 11. 구현 우선순위

### Slice 1 — 안전한 서버 계약

- 사유 12–500자 필수
- 전용 권한 경계
- 자기 변경·fixture·비활성 계정 차단
- no-op와 stale intent 차단
- 동시 마지막 승인자 회수 직렬화
- 구조화된 오류 코드
- exact audit action 조회

### Slice 2 — 역할 변경 요청 워크플로

- 요청/승인/반려/만료 상태
- 요청자와 승인자 분리
- 영향 분석과 재배정
- idempotency
- request ID 기반 감사 체인
- break-glass 정책은 별도 명시 승인 후 구현

### Slice 3 — 실제 운영 데이터 준비

- fixture provenance
- production fixture 차단
- smoke 격리와 cleanup 실패 가시화
- 실제 primary + backup 승인자 등록·검증
- 기존 fixture 정리 dry-run

### Slice 4 — 운영 화면 재구성

- 동적 readiness 요약
- Active/Eligible/Pending/History 탭
- 검색·필터·페이지네이션
- 현재 사용자와 계정 상태
- 단일 review drawer
- 오류 보존과 성공 영수증

### Slice 5 — 회귀 검증

- 권한, 동시성, 감사, 오류, 접근성, 성능 테스트
- 1440px 실제 화면 재감사

## 12. 완료 판정 기준

다음 항목이 모두 충족되어야 이 페이지를 출시 가능으로 재평가할 수 있다.

### 권한과 통제

- [ ] 일반 SYSTEM 운영자가 finance-role-governance 결정 API를 호출할 수 없다.
- [ ] 요청자와 승인자가 같으면 서버가 안정적인 오류 코드로 거부한다.
- [ ] 자기 역할 변경은 UI에서 비활성화되고 API에서도 거부된다.
- [ ] 실제 승인자 두 명 동시 회수 시 정확히 하나만 성공한다.
- [ ] 마지막 실제 primary/backup을 제거하는 요청은 영향 사유와 함께 차단된다.
- [ ] fixture/locked/suspended 사용자는 실제 readiness에 포함되지 않는다.
- [ ] break-glass가 있다면 재인증, 만료, 알림, 감사, 사후 검토를 모두 갖춘다.

### 입력과 오류

- [ ] 사유 0·1·11자는 거부되고 12–500자는 허용되며 501자는 거부된다.
- [ ] 동일 상태 요청은 역할을 다시 쓰거나 거짓 감사 이벤트를 만들지 않는다.
- [ ] 중복 제출은 idempotency key로 한 번만 처리된다.
- [ ] 401/403/500/timeout은 0명 상태와 다르게 표시된다.
- [ ] 오류 후 사유, 대상, 변경안이 보존된다.

### 데이터와 감사

- [ ] production readiness에 fixture가 0명으로 포함된다.
- [ ] 각 현재 역할의 grant 근거와 request ID를 찾을 수 있다.
- [ ] 역할 이력 화면에 page view가 섞이지 않는다.
- [ ] 페이지를 반복 조회해도 역할 변경 이력 수가 달라지지 않는다.
- [ ] smoke 전후 고권한 fixture 집합 불변식이 유지된다.
- [ ] cleanup 실패가 테스트 실패와 잔여 ID 보고로 이어진다.

### 화면과 접근성

- [ ] 1440px 첫 화면에서 readiness, 차단 사유, pending requests를 바로 볼 수 있다.
- [ ] Active approvers와 Eligible admins가 분리된다.
- [ ] 현재 로그인 운영자가 `You`로 표시되고 자기 액션이 비활성화된다.
- [ ] 모든 변경은 impact preview와 확인 단계를 거친다.
- [ ] 오류 메시지가 해당 필드와 연결되고 스크린리더에 전달된다.
- [ ] 키보드만으로 drawer 열기, 입력, 취소, 제출, 포커스 복귀가 가능하다.
- [ ] 영문 UI에서는 검증·오류 문구도 영문으로 일관되게 제공된다.

### 성능

- [ ] 요약은 전체 목록 page에 의존하지 않는 서버 집계다.
- [ ] 목록에 total과 페이지네이션이 있다.
- [ ] 사용하지 않는 session/push 관계를 조회하지 않는다.
- [ ] 인증된 admin API budget 검사가 통과하고 결과가 기록된다.

## 13. 이번에 실행한 검증

| 검증 | 결과 | 해석 |
|---|---|---|
| 관리자 웹 finance-approvers 관련 테스트 | PASS, 3 files / 13 tests | 현재 렌더링·액션 기본 계약은 유지됨 |
| API finance approver 관련 선택 테스트 | PASS, 12 passed / 793 skipped | 자기 변경·비관리자·마지막 승인자 등 기존 단위 범위 통과 |
| 관리자 노출 문구 검사 | PASS, 1,606 files / 0 violations | 정적 copy 규칙 위반 없음 |
| Admin API budget | BLOCKED, HTTP 401 | 성능 통과로 볼 수 없음 |
| 빈 사유 실제 화면 검증 | PASS, 제출 차단 | 브라우저 기본 검증만 확인; API 필수 계약은 아님 |
| 역할 감사 검색 | FAIL | 156건이 page view로 오염되고 역할 이벤트는 0건 |
| 현재 DB 역할 데이터 진단 | FAIL | 실제 사람 기반 승인 준비 상태를 증명하지 못함 |

현재 자동화 테스트가 추가로 다뤄야 할 범위:

- 사유 최소 길이와 API 직접 호출
- 동일 상태 no-op
- 두 승인자 동시 회수
- 정확한 action audit filter
- API 오류와 실제 empty 분리
- 51명 이상에서 total/coverage 정확성
- 현재 actor 행 비활성 UX
- seed/smoke 역할 감사와 cleanup 불변식
- 권한 변경 요청자/승인자 분리

## 14. 증거 파일

- `docs/audits/finance-approvers-reaudit-evidence-2026-08-11/01-finance-approvers-overview.png`
- `docs/audits/finance-approvers-reaudit-evidence-2026-08-11/02-finance-approver-directory-top.png`
- `docs/audits/finance-approvers-reaudit-evidence-2026-08-11/03-finance-approver-directory-bottom.png`
- `docs/audits/finance-approvers-reaudit-evidence-2026-08-11/04-empty-reason-browser-validation.png`
- `docs/audits/finance-approvers-reaudit-evidence-2026-08-11/05-generic-role-update-failure.png`
- `docs/audits/finance-approvers-reaudit-evidence-2026-08-11/06-audit-log-page-view-pollution.png`
- `docs/audits/finance-approvers-reaudit-evidence-2026-08-11/07-audit-log-only-page-views.png`

## 15. 최종 판정

현재 페이지의 시각적 완성도는 이전보다 정돈되어 있지만, 재무 권한 통제의 본질적 안전성은 아직 부족하다. 특히 **권한 변경 자체의 이중 승인 부재, 넓은 권한 경계, 사유 선택 처리, 동시성 경쟁, 테스트 고권한 계정, 역할 감사 부재**는 UI polish로 해결되지 않는다.

P0를 모두 해결하고 실제 primary + backup 운영자를 검증한 뒤, P1 화면 재구성과 1440px 재감사를 통과해야 `Release hold`를 해제하는 것이 타당하다.
