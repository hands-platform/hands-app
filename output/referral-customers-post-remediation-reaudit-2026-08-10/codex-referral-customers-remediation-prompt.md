# Codex 실행 프롬프트 — Customer Referrals 최종 운영 안전성·UX 개선

아래 `프롬프트 시작`부터 `프롬프트 끝`까지를 `C:\dev\massage-on-demand-vn`을 작업 폴더로 연 새 Codex 작업에 그대로 붙여 넣어 사용한다. 먼저 계획만 검토하려면 맨 앞에 `/plan`을 추가하고, 실제 수정까지 맡길 때는 계획에서 멈추지 말고 구현·검증·보고까지 완료하도록 한다.

## 프롬프트 시작

당신은 HANDS 관리자 웹의 Customer Referrals 업무공간을 실제 운영자가 안전하고 빠르게 사용할 수 있도록 개선하는 시니어 풀스택 엔지니어이자 운영 UX 설계자다.

작업 저장소는 다음 한 곳뿐이다.

```text
C:\dev\massage-on-demand-vn
```

`C:\dev\massage-vn-workspace`는 HANDS 작업에 사용하지 않는다.

## 목표

`http://localhost:3101/referrals/customers`와 연결된 고객 추천 상세·정책 화면을 재감사 보고서의 완료 조건에 맞게 실제 코드로 수정하라.

이번 작업의 최우선 목표는 미관 개선이 아니라 다음 운영 계약을 완성하는 것이다.

1. 운영자가 처리할 reward 한 건을 빠르게 찾는다.
2. qualifying booking과 wallet 영향을 확인한다.
3. 충분한 결정 사유를 남긴다.
4. 동시 수정 충돌과 데이터 불변식 위반을 API가 차단한다.
5. 성공·실패·충돌·읽기 장애가 화면에서 명확히 구분된다.
6. 그 후 1440px 이상 데스크톱에서 정보 밀도와 가독성을 다듬는다.

계획이나 분석 보고서만 작성하고 멈추지 말고, 필요한 코드를 수정하고 테스트와 실제 화면 검증까지 수행하라.

## 기준 문서와 증거

작업 전 다음 보고서를 처음부터 끝까지 읽고, 보고서의 스크린샷 12장도 확인하라.

```text
output/referral-customers-post-remediation-reaudit-2026-08-10/referral-customers-post-remediation-deep-reaudit-report.md
```

스크린샷 폴더:

```text
output/referral-customers-post-remediation-reaudit-2026-08-10/
```

보고서가 요구사항의 기준이다. 다만 코드·테스트·도메인 상태 전이 규칙과 충돌하는 부분이 있으면 추측으로 구현하지 말고, 현재 계약을 코드와 테스트에서 확인한 뒤 가장 안전하고 일관된 상태 전이를 선택하고 최종 구현 보고서에 근거를 남겨라.

작업을 시작할 때 저장소의 `AGENTS.md`와 하위 범위에 추가 `AGENTS.md`가 있는지 확인하고 모두 준수하라. 특히 단일 에이전트로만 작업하고, 다른 에이전트나 서브에이전트를 만들지 않는다.

## 검사할 주요 코드

아래 파일을 출발점으로 삼되, 호출 경로·공유 컴포넌트·DTO·테스트·Prisma 모델까지 필요한 범위는 직접 추적하라.

Admin Web:

```text
apps/admin_web/app/referrals/customers/page.tsx
apps/admin_web/app/referrals/referral-dashboard.tsx
apps/admin_web/app/referrals/referral-detail.tsx
apps/admin_web/app/referrals/actions.ts
apps/admin_web/app/referrals/referral-store-setup-status.tsx
apps/admin_web/lib/admin-api.ts
apps/admin_web/lib/referral-links.ts
apps/admin_web/app/globals.css
```

Admin API와 referral domain:

```text
apps/api/src/admin/admin-referral.routes.ts
apps/api/src/admin/admin.dto.ts
apps/api/src/admin/admin.service.ts
apps/api/src/referrals/referrals.service.ts
apps/api/prisma/schema.prisma
apps/api/prisma/migrations/
```

관련 테스트:

```text
apps/admin_web/app/referrals/referral-dashboard.spec.tsx
apps/admin_web/app/referrals/referral-detail.spec.tsx
apps/admin_web/app/referrals/actions.spec.ts
apps/admin_web/lib/referral-links.spec.ts
apps/admin_web/lib/referral-reward-credit-state.spec.ts
apps/api/src/admin/admin.dto.spec.ts
apps/api/src/admin/admin.controller.spec.ts
apps/api/src/admin/admin.service.spec.ts
apps/api/src/referrals/referrals.service.spec.ts
apps/api/src/referrals/referrals.accounting.spec.ts
```

기존 `AdminPageTemplate`, `AdminDataTable`, `AdminFilterPanel`, `ActionMenu`, form control, notice, empty/error state와 디자인 토큰을 우선 재사용한다. 새 의존성은 기존 코드로 해결할 수 없고 명확한 이점이 있을 때만 추가한다.

## 절대 경계

- 이 작업의 UI 검증 범위는 **1440px 이상 데스크톱**이다.
- 기준 화면은 `1440 × 900` 라이트·다크 테마다.
- `1024px 이하`, 모바일, 태블릿 반응형 디자인은 검사·보고·수정 범위에서 제외한다.
- 기존의 1024px 이하 스타일을 일부러 삭제하거나 망가뜨리지는 말되, 이를 위한 새 레이아웃 작업이나 테스트를 만들지 않는다.
- 실제 고객·reward·wallet·정산 데이터를 테스트 목적으로 변경하지 않는다. 금전 상태 변경 검증은 fixture, mock, transaction rollback 또는 제공된 `--dry-run`을 사용한다.
- RBAC, 감사 로그, wallet/ledger 불변식을 약화하지 않는다.
- `.env*` 값을 임의로 만들거나 외부 설정이 완료된 것처럼 위장하지 않는다.
- unrelated dirty worktree 변경을 보존한다. `git reset --hard`, 광범위한 되돌리기, 관련 없는 포맷팅·리팩터링을 하지 않는다.
- 보호 영역을 변경하면 `AGENTS.md`의 integration review와 검증 요건을 따른다.
- 이번 범위와 무관한 customer/provider 앱이나 다른 Admin workspace를 개편하지 않는다.

## 구현 순서

P0부터 순서대로 처리한다. P0를 해결하지 않은 채 카드 정리나 색상 조정만 하고 완료로 보고하지 않는다.

### P0 — 금전 조치 안전성

#### 1. 결정 사유를 UI와 API 모두에서 필수화

hold, release, credit, reverse 등 reward 상태를 바꾸는 모든 작업에 다음 계약을 동일하게 적용하라.

- trim 이후 필수
- 최소 12자
- 최대 500자
- UI는 제출 전 field-level 오류를 표시하고 입력을 보존
- API DTO도 `IsString`, trim/transform, `MinLength(12)`, `MaxLength(500)` 수준으로 검증
- 빈 값에 일반 문구를 자동 대입하는 fallback 제거
- `Updated referral reward candidate from Admin Web.`와 `No reason provided by API caller` 같은 감사 무력화 fallback 제거
- 에러 문구는 운영자가 어떻게 수정해야 하는지 설명

클라이언트 검증만 믿지 말고 API에서 반드시 다시 검증한다.

#### 2. 최종 확인 단계 추가

모든 금전 상태 변경은 버튼 클릭 즉시 POST하지 않는다. 기존 공용 dialog/drawer 패턴을 사용해 최종 확인 단계를 추가하고 다음을 표시하라.

- Parent 이름과 식별 정보
- Referred customer
- Reward ID는 읽기 쉽게 축약하되 전체 값 copy 가능
- 금액과 통화
- Qualifying booking ID와 상태
- 현재 상태 → 목표 상태
- 현재 age/SLA 및 hold reason
- 최신 결정자와 결정 시각
- 운영자가 입력한 reason 전문
- 예상 customer wallet/ledger 영향
- 작업이 되돌릴 수 있는지 여부

확인 화면에서 핵심 증거가 없으면 confirm 버튼을 disabled 처리하고 부족한 조건을 설명한다. 제출 중에는 중복 클릭을 막고 진행 상태를 보여 준다.

#### 3. silent failure 제거

- 금전 변경 server action에서 fallback을 반환하는 `adminPost`를 사용해 성공처럼 진행하지 않는다.
- throw/result 계약이 명확한 `adminPostOrThrow` 또는 동등한 단일 공용 경로를 사용한다.
- 2xx 성공, validation 실패, permission 실패, 409 conflict, 5xx/network 실패를 구분한다.
- 결과를 페이지 notice 또는 action 상태로 실제 렌더링한다.
- 성공 notice에는 변경된 상태, actor, time, audit log link 또는 audit reference를 표시한다.
- 실패 notice에는 변경되지 않았음을 명시하고 재시도/새로고침 경로를 제공한다.
- 입력한 reason은 실패 시 보존한다.

#### 4. credit preflight 불변식 강화

API가 credit를 허용하기 전에 최소한 다음 조건을 서버에서 검증하라.

- qualifying booking이 실제로 존재
- booking이 완료 상태
- referral reward 정책상 qualifying 조건 충족
- 취소·환불·chargeback·settlement 불일치 없음
- attribution/integrity 상태가 명시적으로 통과
- hold 기간 만료 또는 합법적인 예외 승인
- 동일 reward/booking에 이미 ledger credit가 없음
- wallet owner와 대상 customer 일치
- 계산 당시 policy snapshot이 존재하고 유효

조건이 부족한 `CREDITED` smoke row가 보였다는 사실을 회귀 테스트로 다룬다. 잘못된 과거 데이터를 화면에서 조용히 정상처럼 표시하지 말고 `Integrity issue` 또는 이에 준하는 운영 상태와 해결 경로를 노출한다.

#### 5. 동시 수정 충돌 방지

- action payload에 `expectedStatus`와 `expectedUpdatedAt` 또는 명시적 version을 포함한다.
- DB update는 해당 예상값을 predicate에 포함한 원자적 조건부 update로 수행한다.
- stale state이면 덮어쓰지 말고 HTTP 409를 반환한다.
- UI는 `다른 운영자가 먼저 변경했습니다. 최신 상태를 불러와 다시 검토하세요.` 수준의 conflict notice와 refresh 동작을 제공한다.
- 중복 제출도 동일한 action을 두 번 적용하지 못하게 한다.

Prisma schema 변경 없이 안전한 conditional update가 가능하면 그 방법을 우선한다. version/assignment 필드를 추가해야만 요구사항을 충족할 수 있다면 migration을 작고 명확하게 만들고 보호 영역 검증을 수행한다.

### P1 — 상태 전이·범위·장애 정합성

#### 6. HELD 상태 전이 계약 확정

현재 화면의 `release or reversal` 안내와 실제 `Reverse reward`만 가능한 동작이 모순된다. 코드·테스트·도메인 정책을 조사해 legal state machine을 하나로 확정하라.

- 정책이 정상 보류 해제를 지원하면 감사 사유가 필요한 `HELD → AVAILABLE` release/reopen endpoint와 UI를 구현한다.
- 지원하지 않으면 존재하지 않는 release 안내를 모두 제거하고, HELD가 왜 reverse만 가능한지 운영 문구로 설명한다.
- 허용되지 않은 transition은 API에서 차단한다.
- 최종 보고서에 전체 reward 상태 전이표와 각 전이의 권한·preflight·audit 요건을 남긴다.

#### 7. bulk release 범위 수정

현재 UI count와 실제 mutation 범위가 다르지 않게 한다.

- 수동 release가 필요한 정책인지 먼저 확인한다.
- 필요하면 `PENDING && availableAt <= now`에 해당하는 명시적 `releaseReadyCount`를 API와 UI에서 같은 query contract로 계산한다.
- 버튼에는 `Release 3 matured pending rewards`처럼 대상 단위와 개수를 표시한다.
- 확인 화면에 정확한 scope, 합계 금액, 제외 조건을 표시한다.
- scope가 불명확하거나 자동 배치가 이미 책임지는 동작이면 수동 bulk action을 제거하는 편을 선택한다.

#### 8. 읽기 실패를 정상 0건/404로 위장하지 않기

목록, queue summary, policy, parent detail에서 `adminGet` fallback 때문에 장애가 정상 empty state로 보이지 않게 한다.

- `adminGetResult` 또는 동등한 typed result로 success/error를 분리한다.
- API/network 실패 시 `Data unavailable` 상태, retry 버튼, status/freshness를 표시한다.
- 401, 403, 404, 429, 5xx를 적절히 구분한다.
- 한 패널 실패가 가능한 경우 전체 화면을 막지 말고 그 패널만 degraded 처리한다.
- 데이터 로드 실패를 count 0, `No parents yet`, 실제 not-found로 변환하지 않는다.

#### 9. referral link readiness 단일화

링크 준비 상태의 source of truth를 `referralStoreSetupState` 하나로 통일한다.

- referral code 존재만으로 `Available`이라 표시하지 않는다.
- 필수 public base URL/Android/iOS store 설정이 부족하면 `Setup blocked`를 표시한다.
- 프로그램이 Enabled인데 링크 setup이 blocked이면 목록과 상세의 상단에 중복 없는 단일 경고를 표시한다.
- 정상 store 이동을 보장할 수 없으면 `Open referral link`를 비활성화하거나 `Preview fallback page`로 정확히 이름 붙인다.
- 일반 운영자에게 raw env key를 기본 노출하지 않는다. 필요한 경우 개발자 권한 disclosure에 배치한다.
- 문제, 고객 영향, 담당 팀, 다음 행동을 plain language로 보여 준다.

외부 환경 설정이 실제로 없으면 그대로 blocked 상태로 유지하고 이를 코드로 숨기지 않는다.

#### 10. 정책 저장 결과와 계약 누락 수정

- `?status=saved|blocked|conflict` 또는 action result를 실제 notice로 렌더링한다.
- 성공·검증 실패·권한 차단·409 conflict를 구분한다.
- API/DTO가 지원하는 `perRewardCapAmount`를 정책 form과 action payload에 포함하거나, 실제 미지원 계약이라면 API 타입에서 제거해 source of truth를 하나로 만든다. 임의로 UI만 숨기지 않는다.
- 위험 변경은 before → after, 예상 liability 영향, reason, 재확인을 보여 준다.
- 통화가 VND만 지원되면 editable 자유 텍스트가 아니라 read-only로 처리한다.
- 모든 금액은 locale-aware VND format과 명시적 단위를 사용한다.

#### 11. 필터 결과 빈 상태 수정

- active filter가 하나라도 있는데 결과가 0이면 항상 `No matching referral records` 계열 문구를 사용한다.
- 주 행동은 `Clear referral filters`로 제공한다.
- `No Customer referral parents yet`는 전체 데이터 자체가 없을 때만 사용한다.
- 필요하면 API 응답에서 `allParentCount`와 `filteredParentCount`를 분리한다.
- 검색이 KPI/queue count도 범위화한다면 `Counts scoped to current search`를 명시한다. 그렇지 않으면 전역 queue workload는 검색어와 독립시킨다.

### P2 — 운영 queue 중심 구조

#### 12. 기본 Needs action을 reward 단위 작업표로 전환

기본 queue는 parent aggregate가 아니라 reward 한 건당 한 행을 사용한다.

권장 열:

```text
Age/SLA | Parent → Referred | Amount | State | Evidence | Qualifying booking | Owner | Next action
```

요구사항:

- 기본 정렬은 overdue/위험 우선, 동일 우선순위에서는 oldest first
- reward 상태와 실제 조치 가능 여부를 분리
- owner/assignee, unassigned, 마지막 actor/time 표시
- hold reason category와 policy snapshot 차이 표시
- queue count의 단위를 `reward`로 명시
- 결과 요약에는 `N parents / M rewards`를 구분
- pagination을 유지하고 sort/filter가 페이지 간 일관되게 서버에서 적용
- 실제 작업에 필요한 행 단위 primary action은 한 개만 강조

새 API view/DTO가 필요하면 referral 범위에 한정해 구현한다. 일반 list endpoint에 임시 계산을 흩어놓지 않는다.

#### 13. All records를 보조 부모 집계 view로 유지

부모 단위 탐색은 secondary `All records` view로 유지할 수 있다.

권장 열:

```text
Parent | Code | Referrals | Open reward | Credited | Latest activity | Link state
```

- 현재 `Needs action` 열에 credited가 섞이지 않게 한다.
- `Reward exposure`로 이름을 바꾸거나 open/credited를 명확히 분리한다.
- 긴 이름은 table layout을 깨지 않게 처리하되 full identity와 copy/상세 접근을 제공한다.
- 전화번호 전체 노출이 필수인지 권한 정책을 확인하고, 필요하지 않으면 기본 마스킹 + 권한 기반 reveal/copy audit를 적용한다.

#### 14. SLA와 ownership

운영자가 반드시 볼 수 있도록 API와 UI에 다음을 연결한다.

- 현재 상태에 진입한 시각
- 경과 시간
- SLA due/overdue 상태
- owner/assignee 또는 unassigned
- 마지막 결정자와 시각
- 가능한 경우 assignment/change audit

팀의 기존 queue/SLA/assignment 패턴이 있으면 재사용하고 referral만의 별도 시스템을 만들지 않는다.

### P3 — 1440px 시각 구조·문구·접근성

#### 15. 첫 화면 정보 밀도

1440 × 900에서 다음이 첫 화면에 들어오게 한다.

- 제목과 Referral policy 접근
- program/link readiness banner
- 핵심 queue KPI 4개
- 한 줄 필터
- queue heading과 첫 작업 행

상단 KPI는 다음 4개를 우선한다.

```text
Ready | Held | Pending | Total open amount
```

sign-ups/parent count는 table header 또는 보조 summary로 이동한다. auto-fit 때문에 다섯 번째 카드가 고립된 행을 만들지 않는다.

#### 16. 1440px 필터 한 줄 구성

다음 흐름이 한 행에서 논리적으로 읽히도록 명시적 desktop grid를 사용한다.

```text
Search | Attribution | Integrity | Period | Owner | Sort | Clear | Apply
```

- Apply가 동떨어진 오른쪽에 뜨지 않게 한다.
- active filters는 읽을 수 있는 chip과 전체 clear를 제공한다.
- URL query와 form 상태가 새로고침·뒤로 가기 후 일치해야 한다.
- 1024px 이하 레이아웃은 이번 검증 대상이 아니다.

#### 17. Parent detail 재구성

- H1에 parent 이름과 `Customer referral` 맥락을 포함한다.
- breadcrumb는 `Referrals → Customer Referrals → {Parent}`로 끝낸다.
- referral code와 마스킹한 식별 정보를 제목 아래 표시한다.
- 개발 범위를 설명하는 방어적 문구를 제거하고 운영 목적을 설명한다.
- 중복 KPI, operations board, 숫자 반복 timeline을 `Decision brief` 하나로 통합한다.
- `Next operator action`을 상단으로 이동한다.
- timeline은 실제 사건, actor, 시각, 상태 변화만 시간순으로 표시한다.
- static 카드에 의미 없는 `Current filters`, `All records`, `Live` scope chip을 반복하지 않는다.

Decision brief에는 상태, 금액, age/SLA, hold reason, qualifying booking preflight, policy snapshot, expected wallet impact, owner, 권장 다음 행동을 포함한다.

#### 18. Reward ledger 가독성

- action 열을 sticky로 유지하고 action menu가 clipping되지 않게 한다.
- 긴 ID를 글자 단위로 줄바꿈하지 않는다.
- ID는 축약 + disclosure/copy로 이동한다.
- `Decision evidence` control의 글자 단위 줄바꿈을 제거한다.
- credited 행의 `Available {date}`는 `Eligible since {date}`로 의미를 분명히 한다.
- 가로 스크롤 영역은 keyboard focus와 명확한 outline을 유지한다.

#### 19. Policy 화면 정리

- Customer policy에 관계없는 `Fixed reward · Not applicable` 카드 제거
- 7개 static card 대신 `Current policy` definition list와 `Change preview` 사용
- 변경된 필드만 before → after 표시
- `per reward cap`, total cap, hold period, percent에 VND/일/% 단위 명시
- 예상 wallet liability 영향 표시
- 위험 변경에는 추가 확인
- 설정 저장 후 성공/실패 notice가 실제로 보이는지 확인

#### 20. 운영 문구와 접근성

- raw enum `QUALIFIED`, `CLEAR`, `CREDITED`, `HELD`, `android`, `referral-link`를 operator-friendly label로 변환한다.
- `(s)` 복수형을 제거하고 정확한 단수/복수 문구를 사용한다.
- `Open policy settings`는 `Referral policy` 또는 `Open customer referral policy`로 바꾼다.
- 환경 변수명보다 문제·영향·담당 팀·다음 행동을 우선한다.
- `.referral-reward-filter-meta` 등 12px 일반 텍스트는 라이트·다크 모두 대비 4.5:1 이상을 실제 계산/도구로 검증한다.
- 정보 가치가 낮은 11px `metric-card-scope` 반복을 제거한다. 남기면 최소 12px와 충분한 대비를 보장한다.
- 상태는 색상만으로 구분하지 않는다.
- dialog/drawer의 focus trap, 초기 focus, Escape, focus return, keyboard submit을 검증한다.
- 동적 success/error/conflict notice는 screen reader가 인지할 수 있게 한다.

## 권장 최종 화면

아래는 복제해야 할 픽셀 목업이 아니라 정보 우선순위 계약이다.

```text
Customer Referrals                                      [Referral policy]
Program: Enabled · Links: BLOCKED                       [Fix link setup]

[Needs action 1 reward · 25k] [Ready 0] [Held 1] [Pending 0] [All]

Search | Attribution | Integrity | Period | Owner | Sort        [Clear] [Apply]

Needs action queue — overdue and oldest first
Age/SLA | Parent → Referred | Amount | State | Evidence | Owner | Next action

All parent records (secondary)
Parent | Code | Referrals | Open reward | Credited | Latest activity | Link state
```

## 테스트 계약

기존 테스트가 통과하는 것만으로 완료가 아니다. 다음 회귀 테스트를 추가하거나 동등한 수준으로 보강하라.

1. 빈 값, 공백, 11자 reason은 UI와 API에서 차단되고 12~500자만 허용된다.
2. POST 400/403/409/500/network failure가 성공처럼 보이지 않고 reason을 보존한다.
3. 두 운영자의 stale `expectedStatus`/version 요청 중 하나만 성공하고 다른 하나는 409가 된다.
4. qualifying booking 누락, 미완료, 취소/환불/settlement 이상, 기존 ledger가 있으면 credit가 거절된다.
5. legal HELD transitions만 허용되고 UI copy와 API가 동일하다.
6. bulk release count와 실제 변경 대상이 정확히 일치한다. 액션을 제거했다면 더 이상 노출되지 않음을 검증한다.
7. list/summary/policy/detail read failure가 zero/empty/404가 아니라 error/degraded state로 렌더링된다.
8. store setup 누락 시 link가 `Setup blocked`이며 정상 링크처럼 활성화되지 않는다.
9. policy saved/blocked/conflict notice가 렌더링된다.
10. `perRewardCapAmount` 계약이 API와 UI에서 일치한다.
11. active filter 결과 0은 `No matching...`과 Clear action을 표시한다.
12. Needs action은 reward-level이며 overdue/oldest sort, owner/SLA, pagination이 유지된다.
13. 긴 이름, 긴 ID, 0건, 다중 행, 모든 reward state, page 2 fixture에서 table/action이 깨지지 않는다.
14. confirm dialog의 keyboard/focus와 notice의 accessible semantics를 검증한다.

smoke/test 데이터는 운영 데이터와 명확히 구분하고, 여러 행·긴 이름·각 상태·empty/error/conflict를 재현하는 deterministic fixture를 사용한다.

## 검증 명령

실제 package script와 테스트 파일을 먼저 확인한 뒤 가장 작은 관련 테스트부터 실행하고 범위를 넓혀라. 최소한 다음을 수행하고 결과를 기록한다.

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- app/referrals/referral-dashboard.spec.tsx app/referrals/referral-detail.spec.tsx app/referrals/actions.spec.ts lib/referral-links.spec.ts lib/referral-reward-credit-state.spec.ts
npm.cmd run typecheck --workspace @massage-vn/admin-web

npm.cmd run test --workspace @massage-vn/api -- src/admin/admin.dto.spec.ts src/admin/admin.controller.spec.ts src/admin/admin.service.spec.ts src/referrals/referrals.service.spec.ts src/referrals/referrals.accounting.spec.ts
npm.cmd run typecheck --workspace @massage-vn/api

npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api

npm.cmd run external:check:referrals
npm.cmd run referrals:public-link-smoke -- --dry-run
npm.cmd run referrals:reward-action-smoke -- --dry-run
```

테스트 러너 인자 전달 방식이 현재 workspace script와 다르면 package.json에 맞게 조정하고 실제 실행한 명령을 보고하라. 외부 설정 검사가 환경 미설정 때문에 실패하면 설정을 조작하지 말고 정확한 blocker로 남긴다.

Prisma schema/migration, wallet/ledger, shared contract 등 보호 영역을 변경했다면 `AGENTS.md`에서 요구하는 추가 검증과 가능한 범위의 `npm.cmd run verify:local`을 수행한다. 로컬 서비스나 외부 설정 때문에 실행하지 못한 검사는 `미실행`과 이유를 명시한다. 실행하지 않은 검사를 통과했다고 쓰지 않는다.

## 실제 화면 검증

로그인 가능한 브라우저 세션을 사용해 구현 후 다음을 직접 확인하고 전후 스크린샷을 저장하라. 브라우저 제어 스킬이 있으면 사용한다.

검증 URL:

```text
http://localhost:3101/referrals/customers
http://localhost:3101/referrals/customers?reward=held
실제 또는 fixture parent detail URL
Customer referral policy view
```

검증 조건:

- viewport: 1440 × 900만 필수
- 라이트와 다크 테마
- 기본 Needs action queue
- held/release-or-reverse action과 confirmation
- blank reason validation
- forced API failure/409 conflict notice
- active-filter empty state
- link setup blocked state
- 정책 before/after와 save result notice
- 긴 이름/긴 ID/여러 row/page 2 fixture
- keyboard-only dialog와 action menu 흐름
- destructive POST는 fixture/mock/dry-run만 사용

스크린샷은 다음 폴더 아래 명확한 이름으로 저장하라.

```text
output/referral-customers-post-remediation-reaudit-2026-08-10/remediation-verification/
```

## 완료 조건

아래가 모두 충족되어야 완료다.

- [ ] 빈/짧은 reason으로 reward 상태를 바꿀 수 없다.
- [ ] 모든 금전 상태 변경 전에 대상, 금액, current → target, booking evidence, wallet 영향을 확인한다.
- [ ] API 실패와 409가 성공처럼 보이지 않고 복구 경로를 제공한다.
- [ ] credit 불변식은 UI가 아니라 API에서도 강제된다.
- [ ] HELD 안내와 실제 legal transition이 정확히 일치한다.
- [ ] bulk release count와 실제 mutation scope가 동일하거나 잘못된 수동 액션이 제거됐다.
- [ ] 읽기 장애가 정상 0건·404로 보이지 않는다.
- [ ] setup 미완료 link가 Available 또는 정상 store link로 보이지 않는다.
- [ ] policy saved/blocked/conflict 결과가 화면에 보인다.
- [ ] default Needs action은 reward 단위이며 SLA·owner·oldest sort를 제공한다.
- [ ] 검색 결과 0은 `No matching...`과 Clear action을 제공한다.
- [ ] 1440 × 900에서 orphan KPI row 없이 첫 queue 행이 첫 화면에 보인다.
- [ ] detail의 중복 요약이 Decision brief와 실제 event timeline으로 정리됐다.
- [ ] 라이트·다크에서 작은 일반 텍스트도 4.5:1 대비를 충족한다.
- [ ] raw enum, 기술 문구, `(s)` 복수형이 운영 문구로 바뀌었다.
- [ ] 관련 unit/integration/UI 테스트와 typecheck가 통과한다.
- [ ] 실제 데이터 변경 없이 브라우저 검증과 스크린샷이 완료됐다.

하나라도 충족하지 못하면 완료로 표현하지 말고 `남은 blocker`로 분리한다. P0 미완료 상태에서 화면이 예뻐졌다는 이유로 운영 승인 가능하다고 판단하지 않는다.

## 최종 산출물

구현 완료 후 다음 파일을 작성하라.

```text
output/referral-customers-post-remediation-reaudit-2026-08-10/referral-customers-remediation-implementation-report.md
```

보고서는 운영자와 다음 Codex 작업이 바로 검수할 수 있도록 다음 순서로 작성한다.

1. 최종 판정: 완료 / 부분 완료 / blocker 존재
2. 변경한 사용자 흐름과 운영 효과
3. 변경 파일 목록과 파일별 핵심 변경
4. 확정한 reward 상태 전이표
5. credit preflight와 concurrency 계약
6. error/conflict/read-degraded 처리 방식
7. UI before/after 스크린샷 링크
8. 실행한 명령과 pass/fail/skipped 결과
9. 보호 영역 변경 여부와 integration review 결과
10. 외부 설정 blocker
11. 남은 위험과 다음 권장 작업

마지막 응답은 계획을 반복하지 말고 다음만 간결히 보고하라.

- 변경 결과
- 주요 변경 파일
- 검증 결과
- 외부/환경 blocker
- 구현 보고서의 절대 경로

## 프롬프트 끝

## 이 프롬프트가 강제하는 핵심

- 화면 미관보다 reward 금전 조치의 검증·확인·충돌 방지·결과 노출을 우선한다.
- 기본 목록을 parent 집계가 아닌 reward 단위 운영 queue로 바꾼다.
- 읽기 장애, 링크 미설정, 정책 저장 실패를 정상 상태로 위장하지 않는다.
- 1440px 이상 데스크톱만 검증하며 1024px 이하 항목은 작업과 보고서에서 제외한다.
- Codex가 계획이나 일부 패치에서 멈추지 않고 테스트·브라우저 검증·구현 보고서까지 끝내도록 한다.
