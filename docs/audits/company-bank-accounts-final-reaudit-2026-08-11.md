# Company Bank Accounts 최종 재감사 보고서

- 감사일: 2026-08-11
- 대상: `/finance-tax/company-bank-accounts`
- 기준 화면: 1440 × 1000 데스크톱
- 제외 범위: 1024px 이하 반응형 UI는 사용자 요청에 따라 검사하지 않음
- 감사 범위: 실제 화면, 추가·편집·활성화·보관 흐름, 감사 로그 연결, 권한 모델, API·DB 모델, 테스트 데이터 수명주기, 문구, 접근성, 운영 효율
- 판정: **출시 보류(Release hold)**
- 종합 점수: **46/100**

## 1. 결론

이 페이지는 maker-checker 승인, 사유 기록, 계좌 식별정보 변경 제한, 동시 수정 방지 등 백엔드 통제의 기본 골격은 좋다. 그러나 현재 상태로는 실제 회사 계좌를 안전하게 운영하는 관리 화면이라고 보기 어렵다.

가장 큰 이유는 다음 다섯 가지다.

1. 계좌번호 마스킹 검증을 우회해 원문과 유사한 번호를 저장할 수 있다.
2. 현재 로컬 데이터 13건이 모두 smoke/test 계좌이며, 그중 활성 계좌 2건에는 실제 형식의 거래 레코드 57건이 연결되어 있다.
3. 최근 변경 조회가 페이지 조회 로그와 충돌해, 화면을 열기만 해도 실제 계좌 변경 이력이 20건에서 19·18·17건처럼 사라진다.
4. 페이지 권한, 계좌 조회 권한, 감사 로그 조회 권한이 서로 달라 권한/API 오류가 ‘계좌 0건’처럼 보일 수 있다.
5. DB 기본 상태가 `ACTIVE`이고 중복 방지가 트랜잭션·유일 제약 밖에 있어 우회 생성과 동시 생성에 대한 방어가 부족하다.

따라서 색상·간격을 더 다듬는 것보다 위 P0 통제 문제를 먼저 해결해야 한다. P0 해결 후 운영 정보 구조와 입력 흐름을 재구성하면 이 페이지는 충분히 안정적인 재무 설정 화면으로 발전할 수 있다.

## 2. 실제 확인한 현재 상태

| 항목 | 실제 확인값 | 운영 해석 |
|---|---:|---|
| 전체 계좌 | 13 | 모두 smoke/test 데이터 |
| 활성 | 2 | 두 계좌 모두 smoke 계좌 |
| 비활성 | 11 | 반복 실행으로 누적된 staged smoke 계좌 |
| 승인 대기 | 0 | 현재 승인 대기 없음 |
| 연결 거래 | 57 | 활성 smoke 계좌 두 건에 각각 1건, 56건 |
| 실제 회사 계좌 | 0 | 현재 환경에서는 확인되지 않음 |
| 최근 변경 | 처음 20 → 재방문 후 14 | 페이지 조회 로그가 결과 상한을 소비해 감소 |

데이터 삭제는 수행하지 않았다. 특히 활성 smoke 계좌 2건에는 거래가 연결되어 있으므로 이름만 보고 삭제해서는 안 된다. 비활성 11건도 참조관계·감사 보존정책을 확인하는 dry-run 없이 제거하면 안 된다.

## 3. 화면 및 흐름별 건강도

| 단계 | 검수 내용 | 건강도 | 핵심 판단 |
|---:|---|---|---|
| 1 | 계좌 목록과 요약 확인 | 위험 | 모든 레코드가 테스트 데이터이고 ‘Inactive’가 여러 상태를 뭉뚱그림 |
| 2 | 새 계좌 추가 | 개선 필요 | 폼이 목록 중간에 삽입되고 제출 버튼이 접힌 영역·화면 아래에 숨음 |
| 3 | 계좌명 편집 | 보통 | 식별정보 불변 원칙은 좋지만 오류 시 입력 보존과 필드 오류가 없음 |
| 4 | 계좌 보관 | 개선 필요 | 승인 사유를 받지만 영향 범위와 대체 계좌를 보여주지 않음 |
| 5 | 계좌 활성화 | 위험 | 소유자·검증·입금 테스트·중복 확인 없이 활성화 요청 가능 |
| 6 | 감사 로그 확인 | 위험 | 계좌 변경이 아니라 현재 페이지 조회 이벤트만 검색됨 |

## 4. 잘 구현된 부분

다음 기반은 유지하는 것이 좋다.

- 생성·편집·활성화·보관을 즉시 반영하지 않고 승인 요청으로 만든다.
- 요청자가 자신의 요청을 승인하지 못하도록 막는다.
- 승인·반려에 사유가 필요하고 감사 이벤트를 남긴다.
- 거래가 연결된 계좌는 은행명·통화·번호 끝자리 같은 식별정보를 변경하지 못한다.
- 업데이트 시 `updatedAt` 조건으로 낙관적 동시성 검사를 수행한다.
- 상태 변경 확인창은 `alertdialog`, 포커스 경계, Escape/포커스 복귀 기반을 갖춘다.
- 테이블 헤더와 입력 레이블이 존재하고 아이콘 액션에도 접근 가능한 이름이 있다.
- 원문 계좌번호를 저장하지 않으려는 설계 방향 자체는 옳다.

관련 코드:

- `apps/api/src/admin/admin.service.ts:16418` 생성 요청과 감사 기록 트랜잭션
- `apps/api/src/admin/admin.service.ts:16503` 거래 연결 후 식별정보 변경 제한
- `apps/api/src/admin/admin.service.ts:16521` 편집 요청과 동시성 검사
- `apps/api/src/admin/admin.service.ts:16578` 재무 승인자 요구
- `apps/api/src/admin/admin.service.ts:16594` 자기 승인 차단
- `apps/api/src/admin/admin.service.ts:16614` 승인 결정과 감사 기록 트랜잭션

## 5. P0 — 출시 전에 반드시 수정

### P0-1. 계좌번호 원문 저장 방지가 우회 가능함

현재 정규화 로직은 공백과 하이픈만 제거한 뒤 5자리 이상의 숫자인지 검사한다. 따라서 점, 슬래시, 문자, 특수 공백을 섞으면 원문과 유사한 번호가 마스킹 필드에 저장될 수 있다.

재현 예:

- `accountNumberMasked = "1234.5678"`
- `accountNumberLast4 = "5678"`
- 공백·하이픈 제거 후 값은 `1234.5678`이라 전체 숫자 정규식에 걸리지 않음
- 숫자만 추출한 값의 끝 네 자리는 `5678`이라 일치 검사도 통과함

이는 화면 문구인 “Raw account numbers are never stored”를 코드가 완전히 보장하지 못한다는 뜻이다.

수정 기준:

1. 운영자가 입력하는 값은 **끝 네 자리만** 받는다.
2. 화면 표시값 `•••• 5678` 또는 `****5678`은 서버가 파생한다.
3. 마스킹 문자열 입력을 계속 받을 경우 허용 형식을 명시적으로 제한하고, 전체 입력에 포함된 숫자가 네 자리를 초과하면 구분자 종류와 무관하게 거부한다.
4. 점, 슬래시, 괄호, 문자, Unicode 공백, 복사·붙여넣기 문자열을 포함한 회귀 테스트를 추가한다.
5. 원문은 요청 본문 로그, 오류 로그, 감사 로그, 메타데이터에도 남지 않아야 한다.

관련 코드:

- `apps/admin_web/app/finance-tax/company-bank-accounts/page.tsx:373`
- `apps/admin_web/app/finance-tax/company-bank-accounts/page.tsx:381`
- `apps/api/src/admin/admin.dto.ts:1770`
- `apps/api/src/admin/admin.service.ts:43469`

### P0-2. 테스트 계좌가 운영 후보 목록과 거래 흐름에 섞여 있음

현재 DB에서 확인된 계좌 13건은 전부 smoke/test 계좌다. 그중 활성 계좌 두 건은 회사 계좌 선택 후보로 노출될 수 있고 거래 57건이 연결되어 있다. 반복 smoke 실행으로 비활성 계좌 11건과 다수의 감사 이벤트도 누적됐다.

원인:

- 안정적 smoke 계좌를 직접 `ACTIVE`로 생성하거나 재사용한다.
- 라이프사이클 smoke는 실행마다 고유 계좌를 만들고 승인·이름 변경·보관하지만 정리하지 않는다.
- 테스트 데이터가 전용 DB/tenant/namespace로 격리되지 않는다.

운영 위험:

- 실제 계좌가 없어도 활성 2건으로 정상 준비 상태처럼 보인다.
- 정산·환불·입금 매칭에서 테스트 계좌를 선택할 수 있다.
- 계좌 수와 변경 이력이 계속 부풀어 오른다.
- 테스트 계좌 정리 과정에서 연결 거래나 감사 증거를 손상할 수 있다.

수정 기준:

1. smoke를 전용 DB 또는 명확히 격리된 테스트 tenant에서 수행한다.
2. 테스트 레코드에 `environment`, `fixtureType`, `runId`, `expiresAt` 같은 명시적 출처를 둔다.
3. production에서는 fixture 계좌 생성·활성화·선택을 서버에서 차단한다.
4. 라이프사이클 테스트는 시작/종료 계좌 수 불변식을 검증하고, 참조가 없는 fixture만 teardown한다.
5. 기존 데이터는 dry-run 보고서로 참조 수를 확인한 뒤 별도 승인 하에 정리한다.
6. 거래가 연결된 활성 smoke 계좌 2건은 자동 삭제 대상에서 제외한다.

관련 코드:

- `infra/scripts/api-smoke.mjs:246`
- `infra/scripts/api-smoke.mjs:4372`
- `infra/scripts/api-smoke.mjs:4575`

### P0-3. 최근 변경 20건이 실제로는 페이지 조회 로그에 의해 잘림

화면은 다음 순서로 데이터를 가져온다.

1. `/admin/audit-logs?q=company_bank_account&take=20`으로 먼저 20건을 조회한다.
2. 클라이언트에서 `target.startsWith('company_bank_account:')`만 남긴다.

하지만 이 페이지를 열 때 생성되는 `Page view` 이벤트의 target에도 `/finance-tax/company-bank-accounts`가 포함된다. 그래서 광범위한 `q` 검색에 걸린 페이지 조회 로그가 상위 20건을 소비한 뒤 클라이언트에서 버려진다. 실제 계좌 변경 없이 화면을 탐색했을 뿐인데 최근 변경 표시가 20 → 19 → 18 → 17 → 14로 감소했다.

연결된 Audit log 페이지도 계좌 변경이 아니라 이번 감사 중 발생한 `Admin web / Page view` 이벤트만 보여줬다.

수정 기준:

1. 서버가 limit 적용 전에 `targetPrefix=company_bank_account:` 또는 허용된 계좌 액션 집합으로 정확히 필터링해야 한다.
2. UI에서 broad text query 후 client post-filter를 금지한다.
3. 계좌 한 건의 `requested → approved/rejected`를 하나의 변경 타임라인으로 묶는다.
4. 총 변경 수, 현재 표시 수, 조회 상한을 구분한다.
5. 페이지를 30번 조회해도 최근 계좌 변경 20건이 동일하게 유지되는 회귀 테스트를 추가한다.

관련 코드:

- `apps/admin_web/app/finance-tax/company-bank-accounts/page.tsx:55`
- `apps/admin_web/app/finance-tax/company-bank-accounts/page.tsx:66`
- `apps/admin_web/app/finance-tax/company-bank-accounts/page.tsx:314`

### P0-4. 페이지·계좌·감사 로그 권한이 불일치하고 실패가 0건처럼 보임

현재 권한 계약은 다음처럼 분리되어 있다.

| 기능 | 요구 카테고리 |
|---|---|
| 페이지 접근 및 계좌 생성·수정 요청 | `SYSTEM_POLICY` |
| 계좌 목록 조회 | `FINANCE_BANK_RECONCILIATION` |
| 승인 결정 | `FINANCE_BANK_RECONCILIATION` |
| 감사 로그 조회 | `SYSTEM_AUDIT` |

페이지는 계좌·감사 로그·현재 접근권한을 병렬 조회하고 `adminGet(..., [])` fallback을 사용한다. 따라서 `SYSTEM_POLICY`만 가진 운영자는 페이지는 열 수 있지만 계좌와 로그 읽기는 실패하고, UI에는 권한 오류 대신 `0 accounts`, `0 recent changes`가 표시될 수 있다.

운영 위험은 ‘데이터 없음’과 ‘데이터를 볼 권한 없음/서버 장애’를 구분할 수 없다는 것이다. 재무 설정에서 이는 잘못된 신규 계좌 생성과 중복 요청으로 이어질 수 있다.

수정 기준:

1. 이 화면의 소유 카테고리와 읽기 계약을 하나로 정렬한다.
2. 추천 IA는 이 페이지를 재무 운영/재무 기록 영역의 ‘은행 계좌 설정’으로 두고, 필요한 읽기 권한을 명시하는 것이다.
3. 승인 결정은 기존 중앙 `approval-queue?view=bank-accounts`가 소유하도록 하고 이 페이지에서는 대기 건 링크와 상태만 제공한다.
4. 일부 권한만 있는 경우 빈 배열로 대체하지 말고 `권한 없음`, `API 실패`, `실제 0건`을 서로 다른 상태로 렌더링한다.
5. 마지막 정상 조회 시각, 재시도 버튼, 요청 ID를 제공한다.

관련 코드:

- `apps/admin_web/lib/admin-operator-access-model.ts:130`
- `apps/admin_web/lib/admin-operator-access-model.ts:260`
- `apps/admin_web/lib/admin-operator-access-model.ts:442`
- `apps/api/src/admin/admin-operator-category.guard.ts:86`
- `apps/api/src/admin/admin-operator-category.guard.ts:162`
- `apps/api/src/admin/admin-operator-category.guard.ts:299`

### P0-5. DB 기본 ACTIVE와 중복 생성 경쟁 조건

Prisma 모델의 계좌 상태 기본값이 `ACTIVE`다. 애플리케이션 서비스는 명시적으로 `INACTIVE` 요청을 만들지만, 다른 스크립트·배치·직접 Prisma 호출이 상태를 생략하면 승인 없이 활성 계좌가 생길 수 있다. 실제 smoke helper도 직접 활성 계좌를 만든다.

또한 중복 검사는 생성 트랜잭션 전에 `bankName + currency + last4`로 수행되고 DB 유일 제약이 없다. 동시 요청은 둘 다 검사를 통과할 수 있으며, 반대로 서로 다른 실제 계좌가 같은 끝 네 자리를 가지면 오탐 충돌한다.

수정 기준:

1. DB 기본 상태를 `INACTIVE`로 바꾸거나 기본값을 제거해 생성자가 상태를 반드시 명시하게 한다.
2. production에서 승인 절차 밖의 `ACTIVE` 생성 경로를 막는다.
3. 원문을 저장하지 않으면서 중복을 구별할 수 있도록 정규화된 은행 코드와 비가역 HMAC fingerprint 또는 은행 제공 식별자를 사용한다.
4. fingerprint에는 DB 유일 제약과 멱등 키를 둔다.
5. 중복 확인과 생성이 하나의 원자적 경계 안에 있도록 한다.

관련 코드:

- `apps/api/prisma/schema.prisma:2161`
- `apps/api/prisma/schema.prisma:2168`
- `apps/api/src/admin/admin.service.ts:16403`

## 6. P1 — 운영 효율과 판단 품질 개선

### P1-1. 계좌를 활성화하기 위한 필수 운영 정보가 부족함

현재 이름·은행명·통화·마스킹 번호만으로는 실제 회사 소유 계좌인지, 어디에 쓰는 계좌인지, 입금 수집에 사용 가능한지 판단하기 어렵다.

추가할 필드:

- 법인 계좌주명
- 표준 은행 코드 또는 통제된 은행 선택 목록
- 용도: 수금 / 환불 / 파트너 지급 / 정산 / 조정
- 방향: inbound / outbound / both
- 통화별·용도별 기본 계좌 여부
- 검증 상태: 미검증 / 증거 제출 / 검증 완료 / 실패
- 검증 방법과 증거 참조 ID
- 검증자·검증 시각
- 적용 시작일·보관 시각
- 최근 성공 statement import
- 미매칭 건수와 마지막 reconciliation 상태
- 연결 거래·import batch·예약 작업 수

은행 증빙 파일을 추가한다면 공개 URL이나 자유 텍스트에 민감정보를 넣지 말고, 제한된 저장소·만료 URL·다운로드 감사를 사용해야 한다.

### P1-2. 활성화·보관 전에 영향과 준비 상태를 보여주지 않음

현재 확인창은 사유만 요구한다. 활성화 전에는 소유권, 중복, 검증, 테스트 import가 준비됐는지 확인할 수 없고, 보관 전에는 해당 계좌를 사용하는 흐름을 확인할 수 없다.

활성화 확인창에 필요한 항목:

- 법인 소유자 일치
- 검증 증거 상태
- fingerprint 중복 결과
- statement import 테스트 결과
- 통화·용도별 기본 계좌 충돌
- 승인 가능한 별도 운영자 존재 여부

보관 확인창에 필요한 항목:

- 열린/미매칭 거래 수
- 미완료 import batch 수
- 예정된 배치·지급·환불 참조 수
- 최근 import 시각
- 이 계좌가 기본 계좌인지 여부
- 대체 계좌와 전환 시점

영향이 남아 있으면 보관을 막고 해결 링크를 제공해야 한다.

### P1-3. 1인 운영 상황에서 승인 가능성 자체를 알 수 없음

현재는 요청자와 다른 Finance approver가 반드시 필요하다. 내부통제 관점에서 자기 승인을 단순 제거해서는 안 되지만, 1인 운영에서는 요청을 만들고 나서 영구 대기 상태가 될 수 있다.

권장 방식:

1. 폼 제출 전 `승인 가능한 다른 운영자 0명/1명 이상`을 표시한다.
2. 0명이면 일반 승인 요청을 막고 운영 정책 안내를 보여준다.
3. 초기 소규모 운영은 외부 회계 담당자 또는 백업 재무 승인자 한 명을 지정하는 것이 가장 안전하다.
4. 정말 불가능한 경우에만 재인증, 시간 지연, 경고 알림, 사후 검토, 불변 감사가 포함된 명시적 break-glass 절차를 별도로 설계한다.

### P1-4. 추가·편집 폼이 ‘dialog’ URL이지만 실제로는 목록 중간 disclosure임

`?dialog=new`와 편집 URL은 모달/드로어를 암시하지만 실제 DOM은 `AdminDisclosure`가 메트릭과 테이블 사이에 펼쳐지는 구조다. 새 계좌 폼의 최종 제출·취소 버튼은 다시 펼쳐야 하는 내부 disclosure와 화면 아래에 있어 즉시 보이지 않는다.

문제:

- 목록 맥락이 갑자기 아래로 밀린다.
- 사용자는 입력 후 어디서 제출하는지 다시 찾아야 한다.
- query 이름과 실제 상호작용 모델이 다르다.
- dialog 포커스 이동·복귀·닫기·미저장 경고가 적용되지 않는다.
- 오류 리다이렉트 후 입력값이 사라진다.

수정 기준:

- 1440px 데스크톱에서는 우측 drawer 또는 전용 폼 화면을 사용한다.
- 하단에 `Cancel`과 `Submit for approval`을 sticky footer로 항상 노출한다.
- 마스킹 입력은 제거하고 끝 네 자리만 입력받는다.
- 통화는 ISO 통제 목록으로 제공하되 현재 사업 범위가 VND뿐이면 VND로 잠근다.
- 서버 오류 시 입력을 보존하고 각 필드 아래에 구체적인 오류를 표시한다.
- 성공 후 request ID, 요청자, 다음 승인 단계, 승인 큐 링크를 영수증 형태로 보여준다.

### P1-5. 상태 모델과 목록 구조가 운영 의미를 숨김

UI의 `Inactive`는 최소한 다음을 한데 묶는다.

- 승인 대기
- 한 번도 활성화되지 않음
- 반려됨
- 거래 이력이 있어 보관됨
- 시스템상 `DISABLED`
- 테스트 fixture

“Inactive accounts are retained only for historical matching”이라는 문구도 사실과 다르다. 생성 직후 반려된 계좌도 INACTIVE 레코드로 남을 수 있기 때문이다.

권장 상태 표현:

- `Pending activation`
- `Active`
- `Never activated`
- `Rejected`
- `Archived with history`
- `Disabled by system`
- `Test fixture` — production에서는 노출 금지

`DISABLED` 상태가 실제 운영에서 쓰이지 않는다면 안전한 마이그레이션 후 제거하고, 필요하다면 진입·복구 조건을 명확히 구현한다.

### P1-6. 상단 KPI가 계좌 수만 보여주며 운영 준비 상태를 말하지 못함

현재 `Total / Active / Pending / Inactive` 대형 카드는 같은 목록을 상태별로 나눈 수치에 가깝다. 운영자가 오늘 판단해야 할 것은 계좌 수보다 실제 사용 가능성과 조정 건강도다.

권장 상단 health strip:

1. **Usable real accounts** — 테스트 제외, 검증·활성 완료
2. **Pending approval** — 건수와 가장 오래된 대기 시간
3. **Import & reconciliation health** — 정상/주의/중단
4. **Last successful statement import** — 계좌와 시각

테스트 fixture가 발견되면 카드가 아니라 명확한 환경 경고로 보여준다.

### P1-7. 테이블이 계좌 식별만 보여주고 운영 판단 자료가 없음

권장 열:

| Account | Bank & legal owner | Purpose | Currency | Verification | Import/reconciliation health | Last activity | Status | Action |
|---|---|---|---|---|---|---|---|---|

- 기본 보기는 Active + Pending만 노출한다.
- Archived는 별도 필터/탭으로 분리한다.
- 테스트 fixture는 운영 환경에서 완전히 숨기거나 차단한다.
- 각 행에 연결 거래 수, 마지막 변경자·변경 시각을 제공한다.
- 편집·활성화·보관은 작은 아이콘 두 개 대신 명시적 텍스트가 있는 overflow menu로 묶는다.

### P1-8. 오류와 빈 상태가 구분되지 않음

최소 상태를 따로 구현해야 한다.

- 진짜 빈 상태: “등록된 회사 계좌가 없습니다.”
- 필터 결과 없음
- 권한 없음
- API 연결 실패
- 일부 데이터만 실패: 계좌는 보이지만 감사 로그 실패
- 오래된 캐시/마지막 성공 데이터

각 오류에는 재시도, 마지막 성공 시각, 운영자용 요청 ID가 있어야 한다.

### P1-9. 확인 버튼이 빈 사유 상태에서도 활성처럼 보임

사유 input에 `required`는 있지만 `ConfirmDialog`의 `requireValidForm`이 기본 false라 빈 상태에서도 Archive/Activate 버튼이 활성 스타일이다. 브라우저 기본 validation bubble에만 의존한다.

수정 기준:

- 최소 12자 충족 전 버튼을 비활성화한다.
- 현재 글자 수와 좋은 사유 예시를 표시한다.
- 위험 행동은 영향 검사가 모두 통과해야 활성화한다.
- 서버 오류 후 modal을 유지하고 입력을 보존한다.

## 7. P2 — 완성도 개선

- `13 account(s)`, `14 recent change(s)` 같은 개발자식 복수 표기를 실제 문장으로 바꾼다.
- 최근 변경 행에서 상태와 smoke 문자열이 붙어 보이지 않도록 정보 단위를 구분한다.
- “Latest 20”은 실제 20건을 보여줄 때만 사용하고, 아니면 “Showing 14 of 86 changes”처럼 표현한다.
- 승인 대기 KPI와 행의 pending badge는 중앙 승인 큐의 해당 요청으로 직접 연결한다.
- 한 요청의 요청·승인 이벤트를 별도 행으로 반복하지 말고 하나의 타임라인으로 묶는다.
- 사용되지 않는 `company-bank-account-approver-model.ts`와 테스트는 실제 의존성을 재확인한 후 제거 후보로 둔다.

## 8. 권장 화면 구조

### 헤더

- 제목: `Company bank accounts`
- 설명: `Manage verified company accounts used for collections, refunds, payouts, and bank reconciliation.`
- 1차 액션: `Add account`
- 2차 액션: `Open reconciliation`
- 권한/동기화 상태: `Last refreshed 10:42 · All data available`

### 운영 health strip

- `Usable accounts 2`
- `Pending approval 1 · oldest 3h 12m`
- `Reconciliation Attention · 4 unmatched`
- `Last import 10:31 · Vietcombank •••• 3101`

### 목록

- 기본 탭: `Current`
- 보조 탭: `Archived`
- 필터: Purpose, Currency, Verification, Health
- 중앙 승인 큐 링크: `Review 1 pending request`

### 우측 drawer

- 단계 1: Account identity
- 단계 2: Purpose and default rules
- 단계 3: Verification evidence
- 단계 4: Review and submit
- sticky footer: `Cancel` / `Submit for approval`

### 하단 변경 이력

- 정확한 account-target 감사 이벤트만 표시
- 요청 하나당 타임라인 하나
- 요청자, 승인자, 전후 값, 사유, request ID, 시각 표시
- 전체 이력은 계좌 전용 필터가 적용된 audit log로 이동

## 9. 권장 문구

| 현재/문제 문구 | 권장 문구 |
|---|---|
| `Raw account numbers are never stored.` | `Enter only the last four digits. Full account numbers are not accepted or stored.` |
| `Inactive` | 실제 상태에 따라 `Pending activation`, `Never activated`, `Archived` |
| `13 account(s)` | `13 accounts` |
| `14 recent change(s)` | `14 recent changes` |
| `Creation evidence` | `Why is this account needed?` |
| `Review creation request` | 별도 접힘 없이 `Review and submit` 단계로 표시 |
| `Archive` | `Submit archive request` |
| `Activate` | `Submit activation request` |
| 일반 `conflict` | `This account changed while you were reviewing it. Refresh and review the latest values.` |
| 일반 `invalid` | 필드별 오류: `Enter exactly four digits.` 등 |

## 10. 구현 우선순위

### Slice A — 보안·데이터 차단

- last4 단일 입력과 서버 파생 mask
- 우회 문자열 회귀 테스트
- DB 기본 INACTIVE/명시 상태
- fixture production guard
- smoke 격리와 dry-run 정리 도구
- 원자적 중복 방지와 멱등성

완료 기준: 원문 계좌번호가 어떤 구분자를 써도 저장되지 않고, production에서 테스트 계좌가 활성 후보가 될 수 없다.

### Slice B — 권한·감사 정확성

- 페이지의 단일 권한 계약
- 오류와 실제 0건 분리
- 서버 측 exact audit target filter
- 중앙 승인 큐로 승인 결정 통합

완료 기준: 페이지를 반복 조회해도 최근 변경 목록이 줄지 않으며, 권한 부족은 빈 계좌 목록으로 보이지 않는다.

### Slice C — 활성화·보관 준비도

- 법인 소유자·용도·검증·기본 계좌 필드
- 활성화 readiness checklist
- 보관 impact preflight와 대체 계좌
- 승인 가능한 다른 운영자 수 표시

완료 기준: 운영자가 계좌를 활성화하거나 보관하기 전에 영향과 다음 단계를 한 화면에서 판단할 수 있다.

### Slice D — 화면 재구성

- health strip
- Current/Archived 구조
- 운영 중심 테이블
- 우측 drawer + sticky footer
- 필드 오류·입력 보존·성공 receipt
- 명시적 overflow actions

완료 기준: 1440px 화면에서 주요 정보와 제출 액션이 첫 화면 또는 고정 영역에 있고, 숨겨진 disclosure를 찾아다닐 필요가 없다.

## 11. 인수 조건

### 보안

- [ ] 입력 전체에 숫자가 5개 이상 포함되면 구분자와 무관하게 거부된다.
- [ ] 서버·DB·로그·감사 이벤트 어디에도 원문 계좌번호가 남지 않는다.
- [ ] DB를 직접 호출해 상태를 생략해도 ACTIVE가 되지 않는다.
- [ ] 동일 fingerprint 동시 생성은 한 건만 성공한다.

### 데이터

- [ ] production 목록과 선택기에서 fixture 계좌가 노출되지 않는다.
- [ ] smoke 전후 참조 없는 계좌 수가 증가하지 않는다.
- [ ] 기존 fixture 정리는 dry-run과 승인 로그를 거친다.

### 권한·감사

- [ ] 페이지 접근자가 필요한 계좌 데이터를 읽을 수 있다.
- [ ] 권한 부족, API 실패, 실제 0건이 서로 다른 UI를 가진다.
- [ ] 페이지 조회 30회 후에도 최근 20개 계좌 변경은 동일하다.
- [ ] Audit log 링크는 계좌 변경 이벤트만 보여준다.

### 운영 흐름

- [ ] 활성화 요청 전 계좌주·용도·검증·중복·import readiness가 보인다.
- [ ] 보관 요청 전 열린 참조와 대체 계좌가 보인다.
- [ ] 다른 승인자가 없으면 일반 승인 요청을 제출할 수 없다.
- [ ] 실패 시 입력값과 drawer가 유지된다.
- [ ] 성공 시 request ID와 승인 큐 링크가 제공된다.

### 접근성·사용성

- [ ] drawer 열기·닫기·오류·성공 후 포커스가 예측 가능하다.
- [ ] 모든 액션은 키보드로 실행 가능하다.
- [ ] 사유가 유효하기 전 위험 버튼이 비활성화된다.
- [ ] 상태는 색상만이 아니라 텍스트로 전달된다.
- [ ] 1440px에서 제출 버튼이 항상 보인다.

## 12. 검증 실행 결과

| 검증 | 결과 |
|---|---|
| Admin web Company Bank Accounts 및 접근 모델 테스트 | PASS — 4 files, 15 tests |
| API company bank account/guard 관련 테스트 | PASS — 3 files, 33 selected tests |
| Admin visible copy 검사 | PASS — 1,606 files, 0 violations |
| Admin API budget | 측정 불가 — read smoke가 HTTP 401 수신 |

테스트가 통과해도 이번 P0 문제가 사라지는 것은 아니다. 기존 테스트는 점/슬래시를 이용한 마스킹 우회, 페이지 조회 로그에 의한 감사 결과 잘림, 권한 실패가 빈 배열로 보이는 상태, smoke 누적을 포함하지 않는다.

## 13. 증거 파일

- `docs/audits/company-bank-accounts-reaudit-evidence-2026-08-11/01-company-bank-accounts-overview.png`
- `docs/audits/company-bank-accounts-reaudit-evidence-2026-08-11/02-company-bank-accounts-full-page.png`
- `docs/audits/company-bank-accounts-reaudit-evidence-2026-08-11/03-add-bank-account-drawer.png`
- `docs/audits/company-bank-accounts-reaudit-evidence-2026-08-11/04-edit-bank-account-drawer.png`
- `docs/audits/company-bank-accounts-reaudit-evidence-2026-08-11/05-archive-confirmation.png`
- `docs/audits/company-bank-accounts-reaudit-evidence-2026-08-11/06-activate-confirmation.png`
- `docs/audits/company-bank-accounts-reaudit-evidence-2026-08-11/07-audit-log-page-view-pollution.png`
- `docs/audits/company-bank-accounts-reaudit-evidence-2026-08-11/08-audit-log-page-view-rows.png`
- `docs/audits/company-bank-accounts-reaudit-evidence-2026-08-11/09-recent-account-changes-polluted.png`

## 14. 감사 한계

- 이번 감사는 로컬 로그인 세션과 현재 로컬 데이터로 수행했다.
- production 데이터 존재 여부를 단정하지 않는다. 다만 현재 검증 환경은 실제 계좌 준비도를 증명하지 못한다.
- API 성능 예산은 인증 401로 측정하지 못했으므로 성능 합격 판정을 내리지 않았다.
- 1024px 이하 반응형은 사용자 요청에 따라 조사·평가·권고에서 제외했다.
- 데이터 수정·삭제와 소스 구현 변경은 수행하지 않았다.

## 15. 최종 판정

백엔드 승인 통제의 방향은 좋지만, 현재는 **보안·감사 정확성·테스트 데이터 격리·권한 표현**이 운영 화면의 신뢰를 깨뜨린다. P0 다섯 건이 해결되고 회귀 테스트가 추가되기 전에는 실제 회사 계좌 등록과 정산 연결에 사용하지 않는 것이 안전하다.

P0 해결 후 P1의 활성화 준비도, 보관 영향 분석, 중앙 승인 큐 통합, drawer 기반 폼을 적용하면 예상 품질은 75~82점까지 올라갈 수 있다. 실제 계좌를 이용한 statement import·reconciliation·archive end-to-end 리허설까지 통과해야 출시 가능 판정을 내릴 수 있다.
