# Customer Referrals 페이지 최종 재감사 보고서

- 감사일: 2026-08-12 (ICT)
- 대상: `http://localhost:3101/referrals/customers`
- 화면 범위: 1440 × 1000 이상 데스크톱 화면만 검사
- 제외 범위: 1024px 이하 반응형/모바일 화면 전체
- 방법: 로그인된 실제 화면 캡처, DOM 상태 확인, Admin Web/API/Referral/Wallet/Prisma/Smoke 코드 교차 검토, 관련 테스트 실행
- 변경 여부: 이번 감사에서는 애플리케이션 코드를 수정하지 않았다. 감사 보고서와 화면 증거만 추가했다.

## 1. 최종 판정

이전 개선의 핵심 방향은 상당 부분 반영됐다. 기본 화면은 `Needs action`을 앞에 두고, 보상 상태별 빠른 큐, 검색·상태 필터, 정책 권한 분리, 부모 상세, 보상별 의사결정 근거, 사유·확인 체크를 갖췄다. 서버 측 보상 생성·상태 변경·지갑 원장·역분개도 직렬화 트랜잭션, 예상 상태/수정 시각, 안정적인 source key, 감사 로그를 사용해 기본적인 금액 안전성이 좋다.

하지만 현재 상태를 **실제 고객 추천 보상을 켜도 되는 출시 상태**로 판정할 수는 없다. 가장 큰 문제는 다음 다섯 가지다.

1. 실제 운영 화면이 `Smoke Referral ...` 계정과 `Smoke policy ...`로 채워져 있는데 정상 데이터와 구분되지 않는다.
2. 화면에는 `Qualified`인 추천이 `No qualifying booking linked`로 표시되며, 증거가 없는데도 `Release hold`가 가능하다.
3. 1440px에서도 보상 큐의 `Action` 열이 잘리고 상세 원장은 내부 가로 스크롤 없이는 액션에 도달하기 어렵다.
4. `Ready to credit` 큐가 비어 있을 때 화면 제목은 계속 `Needs action`이고, 정책/상세 지표에는 `Current filters` 같은 사실과 무관한 범위 배지가 반복된다.
5. 기본 목록 한 번에 운영자 권한 + 부모 목록 + 필터 요약 + 보상 큐 + 전체 부모 요약을 각각 읽어 중복 집계 비용이 크다.

따라서 판정은 다음과 같다.

| 구분 | 점수 | 판정 |
|---|---:|---|
| 이전 개선 반영도 | 84/100 | 핵심 구성과 안전 확인 흐름은 대체로 반영 |
| 화면 완성도 | 70/100 | 시각 체계는 안정적이나 1440px 표·그리드 결함 존재 |
| 운영자 사용성 | 67/100 | 업무 흐름은 보이지만 중복 정보와 잘못된 라벨이 판단을 방해 |
| 금액 변경 안전성 | 84/100 | 사유·확인·낙관적 동시성·원장/역분개 구조는 좋음 |
| 데이터 신뢰도 | 52/100 | fixture 오염과 자격/예약 근거 모순이 출시 차단 요소 |
| 성능·유지보수성 | 64/100 | 읽기 fan-out과 중복 집계, 화면별 임의 scope 추론 문제 |
| 접근성 기초 | 76/100 | 의미 라벨과 포커스 스타일은 있으나 대표 액션 접근성이 낮음 |
| 테스트 신뢰도 | 82/100 | Referral 핵심 182개 통과; UI 의미·fixture·1440 회귀 검사가 비어 있음 |
| **종합** | **71/100** | **개선 반영 확인 · 실제 추천 보상 출시는 조건부 보류** |

**출시 게이트:** P0 두 건을 해결하고, 1440px 액션 가시성·큐 문구·fixture 격리 회귀 테스트까지 통과하기 전에는 고객 추천 wallet credit를 운영에 활성화하지 않는 것이 안전하다.

## 2. 화면별 재검수 결과

| 단계 | 상태 | 실제 확인 결과 | 증거 |
|---|---|---|---|
| 기본 Needs action | ⚠️ | 상단 요약과 빠른 큐는 명확함. 화면 데이터가 전부 Smoke fixture이고 보상 근거가 모순됨 | [기본 화면](referrals-customers-reaudit-evidence-2026-08-12/01-needs-action-1440x1000.png) |
| 보상 큐 표 | ❌ | 1440px에서도 오른쪽 Action 열이 잘려 대표 업무가 첫 화면에 보이지 않음 | [보상 큐 표](referrals-customers-reaudit-evidence-2026-08-12/03-needs-action-table-1440x1000.png) |
| All records/부모 목록 | ⚠️ | 빠른 큐와 접힌 부모 기록은 동작함. 보상 수와 부모 수를 같은 결과 문구에서 혼용할 위험이 있음 | [All records](referrals-customers-reaudit-evidence-2026-08-12/06b-all-records-table-stable-1440x1000.png) |
| 검색 결과 없음 | ✅ | 활성 필터, 명확한 빈 상태, Clear 동선이 일관됨 | [검색 빈 상태](referrals-customers-reaudit-evidence-2026-08-12/08-search-empty-result-1440x1000.png) |
| Ready to credit 없음 | ❌ | 탭은 Ready인데 표 제목은 `Needs action`; 큐 고유 설명 대신 일반 필터 빈 상태가 표시됨 | [Ready 빈 상태](referrals-customers-reaudit-evidence-2026-08-12/09-ready-empty-1440x1000.png) |
| 정책 설정 | ⚠️ | 제한된 영역·권한·사유·확인은 좋음. `Current filters` 배지, 단위 없는 원시 숫자, Smoke 정책 문구가 신뢰를 떨어뜨림 | [정책 설정](referrals-customers-reaudit-evidence-2026-08-12/10-policy-settings-1440x1000.png) |
| 정책 영향 검토 | ❌ | `After save`가 새 값/차이/노출액을 계산하지 않고 설명만 표시해 실질적인 liability preview가 아님 | [정책 영향 검토](referrals-customers-reaudit-evidence-2026-08-12/12-policy-liability-preview-1440x1000.png) |
| 부모 상세 상단 | ⚠️ | 요약과 프로필 연결은 좋음. 5번째 카드가 다음 줄에 혼자 남고, 이름/전화가 같은 카드에서 반복됨 | [상세 상단](referrals-customers-reaudit-evidence-2026-08-12/13b-reward-detail-stable-1440x1000.png) |
| 부모/링크 근거 | ⚠️ | 앱 링크 설정 차단 사유는 유용함. 사실 지표에 `Current filters`/`All records`가 잘못 붙음 | [부모 근거](referrals-customers-reaudit-evidence-2026-08-12/14-detail-parent-evidence-1440x1000.png) |
| Operations board | ❌ | 상단 KPI·타임라인·원장과 같은 정보를 7개 카드로 반복하고 마지막 카드가 혼자 줄바꿈됨 | [Operations board](referrals-customers-reaudit-evidence-2026-08-12/15-detail-operations-board-1440x1000.png) |
| 의사결정 타임라인 | ✅ | 단계별 자격·검토·큐·wallet 상태를 순서대로 이해하기 좋음 | [타임라인](referrals-customers-reaudit-evidence-2026-08-12/16-detail-decision-timeline-1440x1000.png) |
| 보상 원장 | ❌ | Qualified인데 두 보상 모두 예약 링크가 없고, raw attribution/ledger ID와 가로 스크롤이 가독성을 해침 | [보상 원장](referrals-customers-reaudit-evidence-2026-08-12/17-detail-reward-ledger-1440x1000.png) |
| Held 액션 | ⚠️ | 사유·현재 상태·금액·영향·확인 체크는 좋음. `Booking evidence unavailable` 상태에서도 Release hold가 노출됨 | [Held 액션](referrals-customers-reaudit-evidence-2026-08-12/18-held-reward-actions-1440x1000.png) |
| Held 결정 근거 | ⚠️ | 마지막 결정·사유·시간은 유용하나 넓은 표 셀 내부 disclosure여서 비교와 스캔이 어려움 | [결정 근거](referrals-customers-reaudit-evidence-2026-08-12/20-held-decision-evidence-detail-1440x1000.png) |
| Credited 역분개 | ✅ | 이미 credit된 보상은 신규 credit가 아니라 보상 원장을 보존하는 Reverse만 제공함 | [Credited 액션](referrals-customers-reaudit-evidence-2026-08-12/21-credited-reward-actions-1440x1000.png) |

## 3. 잘 개선된 부분

### 3.1 운영 시작점을 `Needs action`으로 정리

- `Ready to credit`, `On hold`, `Pending`, `Credited`, `All records`를 빠른 큐로 분리했다.
- 기본 화면은 전체 부모 명단보다 액션 큐를 먼저 보여 준다.
- 전체 부모 기록은 접힌 disclosure로 내려 일상 업무의 밀도를 낮췄다.
- 검색·상태·무결성·정렬 필터와 활성 필터 제거가 URL 상태로 유지된다.
- 검색 결과가 없을 때 원인과 Clear 동선을 명확히 제공한다.

이 방향은 운영자가 “추천 전체를 탐색”하는 것이 아니라 “지금 결정할 보상부터 처리”하게 한다는 점에서 적절하다.

### 3.2 금액 변경의 기본 안전장치

- Reward action은 12~500자 사유와 명시적 확인 체크를 요구한다.
- 서버 액션은 reward id, 기대 상태, 기대 updatedAt을 전달한다.
- API는 직렬화 트랜잭션과 optimistic conflict 검사를 사용한다.
- wallet credit는 안정적인 source key로 중복 원장 기록을 방지한다.
- 이미 credit된 보상은 기존 원장을 수정/삭제하지 않고 보상 ledger/journal을 생성해 역분개한다.
- cashout paid에는 별도 Finance 승인자와 transfer reference가 필요하다.
- 정책 변경은 기존 updatedAt을 기대값으로 사용하고 before/after/reason 감사 로그를 기록한다.

이 부분은 단순 UI 개선보다 훨씬 중요하며, 현재 구현의 가장 강한 부분이다.

### 3.3 오류와 권한 경계

- 정책 변경은 `SYSTEM_POLICY`, 보상 처리는 `FINANCE_SETTLEMENTS` 권한으로 분리된다.
- 부모 목록 실패는 보상 큐 전체를 막지 않고 부분 오류로 처리한다.
- 보상/요약 실패 시에는 reward decision 전에 재시도하도록 명확히 차단한다.
- 상세 404는 `notFound()`, 비-404 읽기 실패는 별도 unavailable 상태로 분기한다.

다만 로그인 세션이 만료된 뒤 오류 화면을 실제 캡처하지 못했으므로 상세 error/permission 화면 평가는 코드 검토 기준이다.

## 4. 출시 차단 문제

### P0-1. Smoke fixture가 실제 운영 데이터처럼 노출됨

#### 확인 사실

- 기본 화면의 부모/추천 고객명이 `Smoke Referral ...`이다.
- 정책 메모는 `Smoke policy for customer referral admin UI checks.`이다.
- Seed 스크립트는 `metadata: { smoke: 'referral-admin' }`를 저장하지만 Admin 조회 조건은 이 metadata를 제외하거나 표시하지 않는다.
- Seed 보상은 `qualifyingBookingId: null`로 만들어진다.
- 따라서 정상 운영자는 fixture인지 실사용 보상인지 구분할 수 없다.

관련 코드:

- `infra/scripts/referral-smoke-seed.mjs:261-320, 467-488`
- `apps/api/src/admin/admin.service.ts:33333-33467`
- `apps/api/prisma/schema.prisma:1393-1475`

#### 운영 위험

- KPI, 대기 금액, credited 금액, 마케팅/재무 집계가 테스트 데이터로 오염된다.
- 운영자가 25,000 VND held 보상을 실제 고객의 미지급 금액으로 오인할 수 있다.
- fixture의 불가능한 상태가 정상 흐름처럼 보이므로 프로세스 교육과 장애 판단을 왜곡한다.

#### 수정 요구

1. 기존 `metadata.smoke`를 이용해 production/shared 운영 조회에서 fixture를 기본 제외한다. 이 목적만으로 새 schema 필드는 필요 없다.
2. 개발 환경에서 fixture를 보여 줄 때는 화면 상단과 각 행에 `TEST FIXTURE · 금액 작업 금지`를 명시한다.
3. fixture를 포함하는 별도 `Developer test data` 토글은 Developer/System 권한에서만 노출한다.
4. smoke 실행은 run id를 metadata에 저장하고 종료 시 생성 목록을 정확히 정리한다.
5. 정리는 문자열 패턴 삭제가 아니라 dry-run manifest → exact ids 확인 → apply 순서로 수행한다.
6. 운영 출시 체크에 `visible referral fixture reward count = 0`을 추가한다.

#### 완료 기준

- 운영 모드 `/referrals/customers`에는 `metadata.smoke` 보상이 0개다.
- 개발 모드에서 포함한 fixture는 모든 요약/행/상세/액션에서 TEST FIXTURE로 식별된다.
- fixture에는 실제 wallet mutation 버튼이 비활성화된다.

### P0-2. 예약 근거가 없는데 Release hold가 가능함

#### 확인 사실

- Attribution은 `Qualified`, integrity는 `Clear`다.
- 보상 원장과 action evidence에는 `No qualifying booking linked`/`Booking evidence unavailable`가 표시된다.
- `ReferralRewardActions`는 `status === HELD && !walletLedger`만으로 `Release hold`를 허용하고 booking evidence 존재를 조건에 포함하지 않는다.
- 사양은 “paid booking 확인 후 reward”와 “운영자가 qualifying booking을 확인”하도록 요구한다.

관련 코드:

- `apps/admin_web/app/referrals/referral-detail.tsx:565-572, 618-631, 732-736`
- `docs/superpowers/specs/2026-06-24-referral-rewards-design.md:27-54, 141-165, 261-267`

#### 운영 위험

사유와 체크박스가 있어도 근거 자체가 없는 상태에서 운영자가 보상을 wallet credit 가능한 상태로 이동시킬 수 있다. 한 번 credit된 뒤에는 역분개할 수 있지만, 잘못 지급하고 되돌리는 것은 안전한 승인 흐름이 아니다.

#### 수정 요구

- 비-fixture 보상은 `qualifyingBookingId`, 완료/결제 상태, 계산 snapshot, attribution integrity를 API가 다시 검증한 뒤에만 Release/Credit를 허용한다.
- 필수 증거가 없으면 버튼을 숨기기보다 `Blocked: qualifying booking evidence missing`로 disabled 처리하고 해결 링크를 보여 준다.
- 수동 예외가 꼭 필요하면 일반 Release가 아니라 별도 `Approve exception` 흐름으로 분리한다.
- 예외 흐름은 사유, evidence URL/attachment, 2차 Finance 승인자, before/after snapshot, 감사 action을 요구한다.
- UI 조건은 안내일 뿐이며 최종 차단은 API에서 수행한다.

#### 완료 기준

- booking evidence가 없는 비-fixture reward의 release/credit API는 409 또는 도메인 오류를 반환한다.
- 화면에는 차단 사유와 다음 해결 행동이 표시된다.
- fixture는 실제 wallet mutation 경로에 진입하지 못한다.

## 5. P1 우선 개선 사항

### P1-1. 1440px에서 대표 액션이 보이지 않음

`referral-reward-queue-table`은 최소 1120px이고 각 열이 220 + 220 + 170 + 260 + 상태 + 130px로 확장된다. 왼쪽 Admin navigation과 본문 padding을 제외하면 1440px viewport 안에서 Action이 잘린다. 상세 원장도 고정 1240px에 7개 열을 두어 내부 가로 스크롤이 생긴다.

관련 코드:

- `apps/admin_web/app/globals.css:2146-2192`
- `apps/admin_web/app/globals.css:5688-5724`
- `apps/admin_web/app/globals.css:30486-30553`

수정안:

- 큐를 `Customer`, `Reward evidence`, `Amount/state`, `Updated/SLA`, `Action` 5열로 재설계한다.
- Parent와 referred customer는 하나의 relationship cell로 합친다.
- `Qualified`, integrity, booking은 evidence cell 한 곳에서 체크리스트로 보여 준다.
- Action은 120~144px 오른쪽 sticky로 두고 항상 `Review`가 보이게 한다.
- 긴 decision 문구는 한 줄 요약 + 상세 drawer로 이동한다.
- 상세 원장은 화면 내 표를 5열로 축약하고 raw id는 Copy가 있는 disclosure로 옮긴다.

완료 기준:

- 1440 × 1000에서 큐의 고객·금액·상태·대표 액션이 가로 스크롤 없이 보인다.
- 1440px에서 상세 원장 Action을 찾기 위해 내부 가로 스크롤하지 않는다.
- Playwright screenshot 회귀 검사로 action cell bounding box가 viewport/content 영역 안에 있음을 검증한다.

### P1-2. 선택한 큐와 제목/빈 상태가 불일치

`CustomerReferralRewardQueueTable`은 `reward === all`이면 `All reward records`, 그 외에는 전부 `Needs action`으로 제목을 고정한다. 또한 quick queue 선택도 active filter로 계산해 Ready 빈 상태가 단순 필터 검색 실패처럼 보인다.

관련 코드:

- `apps/admin_web/app/referrals/referral-dashboard.tsx:756-791`

필수 매핑:

| reward | 제목 | 빈 상태 제목 | 운영 안내 |
|---|---|---|---|
| `attention` | Needs action | No reward work | 현재 처리할 보상이 없음 |
| `available` | Ready to credit | Nothing ready to credit | 자격·근거 검토를 통과한 보상이 없음 |
| `held` | On hold | No held rewards | 현재 검토 보류 건이 없음 |
| `pending` | Pending checks | No pending rewards | hold 기간/자동 검증을 기다리는 건이 없음 |
| `credited` | Credited history | No credited rewards | wallet 원장 반영 이력이 없음 |
| `all` | All reward records | No reward records | 추천 보상 기록이 없음 |

검색·상태·무결성 필터가 추가됐을 때만 `No matching ...`과 Clear filters를 사용한다. quick queue 자체는 검색 필터와 분리한다.

### P1-3. 사실 지표에 `Current filters`가 임의로 붙음

`AdminTraceSummary`의 `inferScope` 기본값이 true이고, 추론할 단어가 없으면 `inferredMetricScope()`가 `Current filters`를 반환한다. Referral 정책, 부모 정보, app-link readiness, operations board의 정적 사실까지 현재 필터 범위처럼 표시된다.

관련 코드:

- `apps/admin_web/components/admin-overview-card.tsx:320-352`
- `apps/admin_web/components/metric-card.tsx:88-134`
- `apps/admin_web/app/referrals/referral-dashboard.tsx:311, 360, 513`
- `apps/admin_web/app/referrals/referral-detail.tsx:186, 513`

수정안:

- Referral의 정적 summary에는 `inferScope={false}`를 명시한다.
- 실제 범위가 필요한 값만 명시적인 scope를 전달한다: `Current queue`, `All referral activity`, `Policy`, `Wallet ledger`.
- 공용 컴포넌트의 fallback을 `undefined`로 바꿀지 영향 범위를 검토한다. 광범위한 회귀 위험이 있으면 우선 Referral 호출부만 수정한다.

완료 기준:

- Referral 화면에서 의미 없는 `Current filters`, `All records`, `Pending` 배지가 0개다.
- 모든 남은 scope는 해당 수치의 실제 데이터 범위를 설명한다.

### P1-4. 정책 변경의 liability preview가 실제 비교를 하지 않음

현재 `Before save`는 일부 현재값을 표시하지만 `After save`는 “submitted values replace...”라는 문장뿐이다. 운영자가 5%를 50%로 잘못 입력하거나 cap에 0 하나를 더 넣어도 영향 검토에서 차이를 볼 수 없다.

수정안:

- number 입력에 `VND`, `%`, `days`, `referrals` 단위를 field suffix로 고정한다.
- VND 입력은 표시값에 천 단위 구분을 사용하되 서버에는 정수 minor-unit 계약을 유지한다.
- dirty field만 `old → new`, 차이율, 위험색으로 표시한다.
- 현재 Ready/Pending/Held 보상 수와 금액 중 정책 변경 영향을 받을 범위를 구분해 보여 준다.
- 이미 생성된 reward snapshot에는 소급 적용되지 않는다면 그 사실을 명시한다.
- 저장 버튼은 form validity와 dirty state가 참일 때만 활성화하고, disabled 사유를 표시한다.
- 위험 변경(percentage/cap 증가, hold 감소)은 별도 강한 confirmation summary를 사용한다.

완료 기준:

- 저장 전에 모든 변경 값과 단위, 전/후 차이, 적용 범위, 현재 노출액을 한 화면에서 검증할 수 있다.
- 변경값이 없거나 사유/확인이 없으면 Save가 비활성화된다.

### P1-5. 기본 화면의 중복 읽기와 집계 fan-out

운영 모드 페이지는 동시에 다음을 읽는다.

1. 현재 운영자 권한
2. 전체 부모 목록
3. 현재 reward 필터 summary
4. 현재 reward 큐 rows
5. reward=all 부모 summary

`summaryHref`와 `parentSummaryHref`가 동일한 domain 집계를 필터만 달리해 두 번 요청한다. API summary는 다시 count, attribution count, reward groupBy, attention summary를 병렬 조회한다. 빠른 큐를 바꿀 때 부모 기록과 전체 집계까지 다시 요청되므로 데이터가 늘수록 체감 속도가 악화될 구조다.

관련 코드:

- `apps/admin_web/app/referrals/customers/page.tsx:39-67`
- `apps/api/src/admin/admin.service.ts:7076-7143`

권장안:

- `/admin/referrals/customers/workspace` read model 하나로 `queueSummary`, `queueRows`, `parentSummary`, `parentRowsPage`, `readVersion`을 반환한다.
- 또는 최소 변경으로 summary endpoint가 filtered + all buckets를 한 응답에서 반환하게 해 두 번째 summary 요청을 제거한다.
- quick queue 전환은 접힌 parent records를 다시 읽지 않게 route segment/Suspense 또는 별도 fetch 경계를 둔다.
- Admin API budget에 referral workspace 시나리오를 추가한다.

권장 성능 완료 기준:

- 기본 페이지 admin read 요청: 권한 포함 최대 2회 또는 단일 workspace read + 공용 access cache.
- 동일 화면에서 동일 referral reward 집계의 중복 쿼리 0회.
- 1440px warm navigation p95 목표를 로컬 서비스에서 측정하고 1.5초 이하를 목표로 삼는다. 이번 감사에서는 API 서비스가 실행 중이지 않아 수치 기준을 측정하지 못했다.

## 6. P2 구조·문구 개선 사항

### P2-1. 상세 화면의 세 개 요약이 같은 사실을 반복

상세 상단 KPI, `Referral operations board`, `Decision timeline`이 referral/reward/ready/pending/held/credited 상태를 반복한다. 특히 7개 board 카드의 마지막 `Next operator action`이 다음 줄에 혼자 남아 큰 빈 공간을 만든다.

권장 구조:

1. 상단 `Command strip`: 현재 결론, 막힌 이유, 금액, 다음 행동 4개만 유지
2. `Decision timeline`: 자격 → 무결성 → hold → wallet 상태를 주된 evidence 흐름으로 유지
3. `Referral operations board`: 삭제
4. 기존 board의 closed/credited totals는 원장 헤더의 compact chips로 이동

### P2-2. 부모 정보 중복

Parent account 카드에서 name/phone이 value/detail과 `AdminPersonCell` 액션에 반복된다. 한 번은 사람 식별, 한 번은 Open profile만 제공하면 충분하다.

- 제목: 부모 이름
- 보조: 전화번호 + customer short id
- 액션: `Open customer profile`
- referral code와 링크 준비 상태는 별도 `Sharing readiness` 블록

### P2-3. raw ID와 내부 이벤트명이 운영 문구로 노출

- `smoke_referral_customer_attribution`
- 긴 wallet ledger id
- `referral_reward.hold`
- `reward record(s)` 같은 개발자 중심 문구

운영 화면에는 다음처럼 번역한다.

- `Hold placed by Demo Admin`
- `Wallet credit not posted`
- `Attribution REF-…` + Copy
- `View audit evidence`

원본 ID와 action key는 Technical details disclosure나 Audit log 링크 안에 보존한다.

### P2-4. 결과 단위 혼용

Filter panel에 전달되는 `filteredCount`는 reward row 수인데 `totalCount`는 parent account 수다. `1 of 2`만 표시되면 무엇을 세는지 알 수 없고 서로 다른 단위를 비교하게 된다.

- 상단 큐 결과: `1 reward shown`
- 접힌 부모 기록: `2 parent accounts`
- 전체 활동: `3 rewards · 2 referred customers`

서로 다른 단위를 하나의 `shown of total`에 넣지 않는다.

### P2-5. Growth 메뉴 안의 Finance 소유권을 명시

Customer Referrals를 Growth & Communications에 두는 것은 acquisition 업무 기준으로 맞다. 그러나 reward credit는 Finance 권한이고 policy는 System 권한이다. 페이지를 재무로 옮기기보다 다음을 명시하는 편이 낫다.

- 각 큐 헤더에 Owner: `Growth review` / `Finance decision`
- 권한이 없는 운영자에게 `Escalate to Finance`와 담당 팀 표시
- Policy settings에 `Restricted · System policy`
- Wallet credit 완료 후 General Ledger/Wallet evidence 링크

## 7. 권장 목표 화면 구성

### 목록

```text
Customer Referrals
[Needs action 1] [Ready 0] [On hold 1] [Pending 0] [Credited 1] [All 3]

Action summary: 1 held · oldest decision … · 25,000 VND exposure
[Search customer/referral code/booking] [Integrity] [State] [Sort]

Relationship | Evidence | Amount & state | Updated/SLA | Action
Parent → Referred
               Booking ✓  Integrity ✓
                                              [Review]

▸ Parent activity (2 accounts)
```

### 상세

```text
Parent customer / Referred customer
[Decision: On hold] [25,000 VND] [Booking evidence: blocked] [Next: repair evidence]

Decision timeline
Attribution → Eligibility → Integrity → Hold/Ready → Wallet

Evidence checklist              Decision panel
- qualifying booking            - reason
- paid/completed status         - confirmation
- calculation snapshot          - one allowed action
- policy version                - impact preview

Reward ledger / Audit history
```

핵심은 카드 수를 늘리는 것이 아니라 **현재 결정, 필수 근거, 다음 행동**을 한 축에 배치하는 것이다.

## 8. 코드 수준 수정 목록

| 우선순위 | 파일/영역 | 수정 |
|---|---|---|
| P0 | `apps/api/src/admin/admin.service.ts` | fixture 기본 제외 또는 dev-only include, reward release/credit precondition 재검증 |
| P0 | `apps/api/src/referrals/referrals.service.ts` | qualifying booking/payment/integrity/policy snapshot 검증을 wallet 전 상태 변경의 권위로 유지 |
| P0 | `infra/scripts/referral-smoke-seed.mjs` | run id, environment guard, cleanup manifest, wallet mutation 금지 fixture |
| P1 | `apps/admin_web/app/referrals/referral-dashboard.tsx` | queue별 title/empty copy, quick queue와 ad-hoc filters 분리, 결과 단위 수정 |
| P1 | `apps/admin_web/app/referrals/referral-detail.tsx` | evidence 없는 release 차단 표시, board 제거, static scope 제거, raw id 접기 |
| P1 | `apps/admin_web/app/referrals/customers/page.tsx` | 중복 summary 요청 제거 또는 workspace read model 적용 |
| P1 | `apps/admin_web/app/globals.css` | 1440 큐/원장 열 재설계, sticky action, orphan card 제거 |
| P1 | `apps/admin_web/components/admin-overview-card.tsx` 호출부 | static summary에 `inferScope={false}` 또는 명시 scope |
| P1 | 정책 form/client component | live old/new diff, VND/%/days 단위, dirty/valid 상태 |
| P1 | Referral 테스트 | fixture, evidence gate, queue semantics, 1440 action visibility, request budget 추가 |

## 9. 테스트 검수 결과

### 통과

| 범위 | 명령 | 결과 |
|---|---|---:|
| Admin Referral 화면/액션/계약 | `npm.cmd test -- app/referrals/referral-dashboard.spec.tsx app/referrals/referral-detail.spec.tsx app/referrals/actions.spec.ts app/referrals/page.spec.tsx app/referrals/referral-smoke-seed-contract.spec.ts app/referrals/referral-reward-action-smoke-contract.spec.ts app/referrals/referral-wallet-credit-readiness-contract.spec.ts app/referrals/referral-public-link-smoke-contract.spec.ts` | 8 files, 71 passed |
| API Referral domain/accounting | `npm.cmd test -- src/referrals/referrals.service.spec.ts src/referrals/referrals.accounting.spec.ts src/referrals/referrals.controller.spec.ts src/referrals/referral-wallet-credit-schema-contract.spec.ts src/referrals/referral-claim-api-smoke-contract.spec.ts` | 5 files, 67 passed |
| Admin core referral service | 좁힌 referral policy/reward/cashout/parent/closeout 패턴 | 23 passed |
| Admin controller/DTO | `npm.cmd test -- src/admin/admin.controller.spec.ts src/admin/admin.dto.spec.ts -t referral` | 21 passed |
| Dashboard filters/empty/policy | `npm.cmd test -- app/referrals/referral-dashboard.spec.tsx -t "filters|empty|customer referral|policy"` | 12 passed |

### 실패/미측정

1. `admin.service.spec.ts -t referral`: 26개 중 2개 실패
   - Referral marketing campaign id 기대값 `REFSMOKE`와 실제 정규화 값 `refsmoke`의 계약 불일치다.
   - platform fee revenue 제외 검증 자체는 유지되지만, cross-surface campaign key 정규화 계약을 한쪽으로 통일해야 한다.
2. `npm.cmd run admin:api-budget:strict`: API 서비스가 실행되지 않아 `fetch failed`로 미측정
   - 코드 실패로 단정하지 않았으며, 실제 stack에서 다시 실행해야 한다.

### 새로 필요한 회귀 테스트

- quick queue별 heading/empty copy 매핑
- Referral 화면에 의미 없는 `Current filters`가 렌더링되지 않음
- 1440px에서 queue/ledger action bounding box가 보임
- production/shared mode에서 smoke metadata rows가 제외됨
- 비-fixture `Qualified` reward에 qualifying booking이 반드시 존재함
- booking evidence 없는 release/credit API 차단
- 정책 old/new liability preview 계산
- 기본 workspace의 API/DB query budget
- reward count와 parent count 단위가 섞이지 않음

## 10. 출시 전 완료 기준

### 반드시 완료

- [ ] 운영 화면의 test fixture 0개 또는 명확한 dev-only 격리
- [ ] booking/payment evidence 없는 release/credit 서버 차단
- [ ] 1440px에서 대표 액션이 가로 스크롤 없이 표시
- [ ] 큐별 제목·빈 상태·count 단위 정확성
- [ ] 의미 없는 scope badge 0개
- [ ] 관련 P0/P1 회귀 테스트 통과
- [ ] Referral API budget 실제 stack에서 측정·통과

### 강력 권장

- [ ] 정책 전/후 liability diff
- [ ] 상세 Operations board 제거 및 evidence 중심 재배치
- [ ] raw id/내부 action key를 technical details로 이동
- [ ] 읽기 workspace 통합 또는 중복 summary 제거
- [ ] Finance owner/escalation 표시

## 11. 감사 한계

- 1024px 이하 화면은 사용자 요청에 따라 완전히 제외했다.
- 로그인 세션 만료와 로컬 dev server 재기동 이후 상세 오류/permission 상태는 live capture하지 못해 코드로만 검토했다.
- 로컬 dev server가 검사 중 한 번 listener를 잃었지만 원인 로그가 충분하지 않아 제품 안정성 결함으로 판정하지 않았다.
- 전체 키보드 탐색, 스크린리더, 대비 측정까지 수행한 정식 WCAG 감사는 아니다.
- API 서비스 미실행으로 strict budget의 실제 네트워크/DB 성능 수치를 얻지 못했다.
- 기존 referral 전용 재감사 보고서 파일은 저장소에서 찾지 못해 현재 화면, 현재 코드, 권위 사양을 기준으로 개선 반영도를 판정했다.

## 12. 변경 파일·보호 영역·남은 위험

### 이번 감사에서 추가한 파일

- `docs/audits/referrals-customers-final-reaudit-2026-08-12.md`
- `docs/audits/referrals-customers-reaudit-evidence-2026-08-12/*`

### 보호 영역

- 애플리케이션 코드, Prisma schema/migration, auth, booking, payment, wallet, shared types는 수정하지 않았다.
- 이번 작업은 문서와 화면 증거 추가뿐이다.

### 남은 핵심 위험

- fixture가 운영 truth로 노출되는 데이터 신뢰 위험
- 증거 없는 reward 상태 변경/향후 오지급 위험
- 1440px에서 대표 액션을 놓치는 운영 오류 위험
- 정책 오입력의 금액 영향이 저장 전에 보이지 않는 위험
- 데이터 증가 시 중복 집계로 목록이 느려질 위험

## 13. 다음 권장 작업

다음 작업은 이 보고서를 구현 명세로 변환한 Codex 수정 프롬프트를 작성하고, **P0 fixture 격리 → P0 evidence gate → P1 queue/1440 UI → P1 정책 preview → 성능 통합** 순서로 한 단계씩 구현·검증하는 것이다.
