# Partner Controls 운영자 UX · 데이터 신뢰성 심층 감사

- 감사 대상: `http://localhost:3101/partner-controls` 및 `details=controls`, `details=reports`, `details=sanctions`, `details=all`
- 감사 일자: 2026-08-06 (Asia/Bangkok)
- 관점: 개발 편의가 아니라 실제 운영자가 “누구에게, 왜, 무엇을, 언제까지 해야 하는가”를 빠르고 안전하게 판단할 수 있는가
- 방법: 로그인된 실제 화면을 1440×900, 1024×900, 720×900에서 직접 확인하고, DOM/스크롤 치수·문구·라우팅·서버 조회 코드·집계 코드·테스트를 교차 검증했다.
- 데이터 변경: 없음. 생성·수정·제재·해제 버튼은 실행하지 않았다.

## 1. 결론

현재 화면은 카드와 폼의 시각적 일관성은 좋아졌지만, 운영 화면으로서 가장 중요한 **숫자·범위·정책 문구의 신뢰성**이 아직 확보되지 않았다. 특히 전체 집계와 최근 10명 샘플을 같은 의미처럼 나란히 보여 주고, 현재 페이지 길이로 전체 건수를 추정하며, 필터를 서버 전체 데이터가 아니라 이미 잘린 10건에 적용한다. 화면이 깔끔해 보여도 운영자는 실제 큐를 놓치거나 잘못된 차단 범위를 이해할 수 있다.

출시 전 우선순위는 다음과 같다.

1. 전체 데이터와 10건 샘플의 혼용을 없애고 모든 숫자에 동일한 범위·갱신 시각을 적용한다.
2. 리포트/계정 제어 API를 `{ items, totalCount }` 기반의 실제 서버 검색·필터·정렬·페이지네이션으로 바꾼다.
3. 지갑 부채·세금·KYC가 각각 무엇을 막는지 하나의 정책 정의에서만 파생되게 한다.
4. 다섯 개의 중복 진단 섹션을 하나의 우선순위 큐와 보조 정책 패널로 축소한다.
5. 행 안의 즉시 변경 폼을 검토 드로어 + 명시적 확인 단계로 옮긴다.

## 2. 잘된 부분

- 전역 사이드바, 현재 메뉴 강조, breadcrumb가 일관되고 위치를 잃지 않는다.
- `Summary / Control diagnostics / Reports / Account controls`로 책임을 분리하려는 정보구조 방향은 맞다.
- 폼 컨트롤에 접근 가능한 이름이 있고, H1/H2 구조와 landmark가 대체로 명확하다.
- 제어 해제는 확인 다이얼로그를 거치며, 이미 종료된 제어를 다시 해제하지 못하게 한 점은 안전하다.
- `Operator script`, `Customer impact`, `Booking impact`, `Payout impact`라는 설명 축은 운영자 교육에 유용하다.
- 현금 수수료 부채의 정확한 정책 문구인 “노출은 가능하되 최종 수락·서비스 시작·지급 해제는 제한”이 일부 카드에는 명확히 표현되어 있다.
- 빈 결과에 설명 문구가 있고, 검색·상태·심각도 필터에도 레이블이 있다.

이 장점은 유지하되, 같은 사실을 여러 곳에서 다시 작성하지 말고 한 번만 계산·표현해야 한다.

## 3. 핵심 발견 사항

### P0-1. 전체 집계와 최근 10명 샘플이 같은 화면에서 충돌한다

상단 KPI는 전체 DB 집계다. 현재 값은 Wallet debt 89, Location gaps 190, Shared devices 230, Onboarding gaps 1266이다. 반면 명령 센터와 진단 보드는 `take=10`으로 가져온 최근 10명만 계산한다. 그래서 같은 화면에서 다음처럼 값이 달라진다.

| 신호 | 상단 전체 집계 | 하단/워크스페이스 계산 | 운영자에게 보이는 문제 |
|---|---:|---:|---|
| Wallet debt | 89명 | 1명 / 80,000 VND | 88명을 왜 볼 수 없는지 설명이 없음 |
| Shared devices | 230명 | 0명 | “CLEAR”가 전체가 안전하다는 뜻처럼 보임 |
| Active controls | 0건 | 진단 보드의 “Active controls 10” | 이름은 같지만 실제로는 제재 수와 일반 후속조치를 혼용 |
| Location gaps | 190명 | 7명 | 전체 큐와 샘플 큐가 구분되지 않음 |
| Onboarding gaps | 1266명 | Documents 10명 | 샘플 10명 모두가 전체처럼 보임 |

코드 근거:

- [partner-control-page-load-plan.ts](../../apps/admin_web/app/partner-controls/partner-control-page-load-plan.ts#L4)는 모든 상세 목록을 10건으로 고정한다.
- [page.tsx](../../apps/admin_web/app/partner-controls/page.tsx#L131)는 그 10명으로 리포트 생성 파트너 옵션을 만들고, [page.tsx](../../apps/admin_web/app/partner-controls/page.tsx#L141)는 같은 샘플로 명령 센터를 계산한다.
- [admin.service.ts](../../apps/api/src/admin/admin.service.ts#L11172)는 상단 KPI를 전체 테이블 aggregate로 계산한다.

수정 요구:

- 상단 KPI와 모든 큐는 동일한 서버 범위를 사용한다.
- 샘플을 유지해야 한다면 `최근 등록 10명 샘플`처럼 데이터 범위를 제목과 수치 옆에 강제로 표시한다. 그러나 운영 큐에는 샘플을 사용하지 않는 것이 맞다.
- 진단 공급자 API는 `risk sort + server filters + totalCount`를 반환해야 한다. `id desc` 최근 10명은 위험 우선순위가 아니다.
- 모든 KPI에 `전체 파트너 · 20:15 갱신`과 같은 범위/시각을 표시한다.

완료 기준:

- 같은 신호 이름은 모든 화면에서 같은 정의와 같은 값 또는 명시적으로 다른 범위를 보여 준다.
- 11번째 이후의 위험 파트너도 검색·정렬·페이지 이동으로 접근 가능하다.

### P0-2. 페이지네이션의 전체 건수는 실제 전체 건수가 아니다

리포트 3페이지에서 `Showing 21 to 30 of 30 entries`라고 표시하면서 동시에 4페이지 링크가 보인다. 4페이지로 이동하면 `31 to 40 of 40`으로 분모가 다시 증가하고 5페이지 링크가 생긴다. 이 분모는 전체 건수가 아니라 현재 페이지의 끝 번호다.

코드 근거:

- [page.tsx](../../apps/admin_web/app/partner-controls/page.tsx#L1889)는 현재 페이지가 10건이면 무조건 다음 페이지가 있다고 추정한다.
- `totalRows`도 현재 페이지의 마지막 번호를 그대로 사용한다.
- 프런트의 [partner-control-page-load-plan.ts](../../apps/admin_web/app/partner-controls/partner-control-page-load-plan.ts#L93)는 `skip`을 보내지만, 저장소의 [admin-partner.routes.ts](../../apps/api/src/admin/admin-partner.routes.ts#L194)와 [admin.service.ts](../../apps/api/src/admin/admin.service.ts#L11634)는 `take`만 읽는다. 현재 실행 중 API와 저장소 코드의 계약이 일치하는지도 확인해야 한다.

수정 요구:

- 리포트와 계정 제어 API를 `{ items, totalCount }`로 통일한다.
- `skip`, `take`, `q`, `status`, `severity`/`sanction`, `sort`를 API가 직접 처리한다.
- `totalPages = ceil(totalCount / take)`만 사용하고 추정 함수 네 개를 삭제한다.
- 마지막 페이지를 넘는 URL은 마지막 유효 페이지로 정규화하거나 명확한 빈 상태를 보여 준다.

완료 기준:

- 어떤 페이지로 이동해도 분모가 바뀌지 않는다.
- 3페이지에 4페이지 링크가 있으면 전체 건수가 최소 31개다.
- 페이지 1과 페이지 2의 row id가 중복되지 않는다.
- API 재시작 후에도 동일하게 동작한다.

### P0-3. 검색과 필터가 전체 데이터가 아니라 이미 잘린 10건에 적용된다

[page.tsx](../../apps/admin_web/app/partner-controls/page.tsx#L126)에서 서버가 반환한 10건을 받은 다음 [page.tsx](../../apps/admin_web/app/partner-controls/page.tsx#L1893)의 `filterReports`와 [page.tsx](../../apps/admin_web/app/partner-controls/page.tsx#L1905)의 `filterSanctions`를 적용한다. 따라서 “0 shown / No reports match”는 전체 데이터에 대한 사실이 아니다. 검색 대상이 다른 페이지에 있으면 존재해도 없다고 나온다.

같은 문제로 `Create partner report`의 파트너 선택도 최근 10명만 제공한다. 실제 운영자는 오래된 파트너에게 새 신고를 등록할 수 없다.

수정 요구:

- 모든 필터와 검색을 서버 쿼리로 이동한다.
- 필터 변경 시 페이지를 1로 되돌린다.
- 파트너 선택은 전체 권한 범위를 대상으로 하는 검색형 combobox를 사용한다.
- 빈 상태는 `전체 347건 중 조건에 맞는 리포트가 없습니다`처럼 확인 범위를 말한다.

### P0-4. 차단 정책 문구가 서로 모순된다

현재 화면은 같은 지갑 부채를 다음처럼 다르게 설명한다.

- 정확한 설명: “파트너는 계속 노출될 수 있지만 최종 수락·서비스 시작·지급 해제가 제한된다.”
- 잘못 넓은 배지: `Booking blocked`
- 잘못 넓은 안내: “before this partner accepts more bookings”
- 운영 block matrix: `cannot participate in marketplace bookings`

세금 정책도 충돌한다.

- Unblock board: “세금 프로필은 Vietnam MVP에서 승인·매칭·근무·지급·출금을 막지 않는다.”
- System checklist: “Tax information can stay pending until first earning, but payout must remain gated.”

코드 근거:

- 잘못 넓은 지갑 차단: [page.tsx](../../apps/admin_web/app/partner-controls/page.tsx#L1176), [page.tsx](../../apps/admin_web/app/partner-controls/page.tsx#L1228), [page.tsx](../../apps/admin_web/app/partner-controls/page.tsx#L1839)
- 세금 지급 차단 문구: [page.tsx](../../apps/admin_web/app/partner-controls/page.tsx#L2052)

수정 요구:

- 정책 담당자가 canonical matrix를 승인한다: `Marketplace visibility / Invitation / Final acceptance / Service start / Payout creation / Withdrawal`.
- 화면 문구는 이 matrix에서 파생하고 개별 섹션에서 직접 문자열을 만들지 않는다.
- 지갑 부채 배지는 `Acceptance & service start blocked`로 바꾼다.
- 세금이 정말 선택 사항이라면 모든 화면에서 `Optional · no operating gate`로만 표시한다.
- KYC, bank, location, account block도 동일한 영향 축으로 표현한다.

### P1-1. 운영 작업보다 8개 KPI가 먼저 나오고 모든 워크스페이스에서 반복된다

1440 화면에서도 상세 워크스페이스의 첫 화면은 KPI가 대부분 차지하고 실제 큐는 아래에 있다. 1024에서 기본 페이지 높이는 2542px, Control diagnostics는 5229px였다. 운영자는 이미 “Reports”를 선택했는데도 같은 8개 카드를 다시 통과해야 한다.

수정 요구:

- 상세 워크스페이스에서는 8개 KPI를 제거하고 56~72px 높이의 compact queue header만 둔다.
- 첫 화면에는 항상 우선순위 행 5~8개가 보이게 한다.
- 전체 Summary에는 네 개만 유지한다: `Urgent reports`, `Active restrictions`, `Debt gates`, `Overdue`.
- Location/device/onboarding은 `Health signals` 보조 패널로 접는다.

### P1-2. 같은 10명의 사실을 다섯 번 반복한다

Control diagnostics는 다음을 연속으로 보여 준다.

1. Partner control board
2. Marketplace and payout unblock board
3. Marketplace and payout unblock playbook
4. Partner operating block matrix
5. System control checklist

설명은 유익하지만, 같은 신호와 정책을 다른 카드/문장으로 반복하면서 모순과 스크롤을 만든다.

수정 요구:

- `Partner blockers`라는 하나의 우선순위 큐로 통합한다.
- 각 행은 `우선순위 · 파트너 · 문제 · 영향 범위 · 경과/SLA · 담당자 · 다음 행동`만 보여 준다.
- 행을 열면 정책 근거, operator script, customer impact, 관련 리포트/증거를 side panel에 표시한다.
- playbook은 빈번히 바뀌는 실시간 큐가 아니라 도움말/정책 drawer로 이동한다.

### P1-3. 중첩 스크롤과 가로 스크롤이 핵심 맥락을 분리한다

CSS가 Partner Controls의 모든 직접 카드에 `max-height`와 `overflow:auto`를 적용하고, 모든 테이블에 `min-width:1180px`를 강제한다.

측정값:

| 영역 | viewport/카드 너비 | 실제 콘텐츠 너비 | 내부 높이/스크롤 높이 |
|---|---:|---:|---:|
| Reports, 1440 | 1100px | 1204px | 787 / 2355px |
| Checklist, 1440 | 1100px | 1204px | 787 / 1656px |
| Checklist, 1024 | 684px | 1204px | 787 / 1677px |
| Reports, 720 | 656px | 1204px | 787 / 2376px |

오른쪽 행동을 보려 가로 스크롤하면 파트너 이름과 섹션 제목까지 화면 밖으로 사라진다. 페이지 스크롤, 카드 세로 스크롤, 카드 가로 스크롤, 사이드바 스크롤이 동시에 존재한다.

코드 근거: [globals.css](../../apps/admin_web/app/globals.css#L12855), [globals.css](../../apps/admin_web/app/globals.css#L12864)

수정 요구:

- 모든 카드에 일괄 적용한 `max-height/overflow:auto`를 제거한다.
- 긴 큐 하나에만 명시적인 스크롤 컨테이너를 둔다. 헤더·필터·페이지네이션은 그 컨테이너 밖에 둔다.
- 1200px 미만에서는 desktop table을 강제로 유지하지 말고 우선순위 행 카드로 바꾼다.
- desktop에서도 Partner 열과 Action 열을 고정하거나, 행 클릭으로 상세 drawer를 열어 가로 스크롤을 없앤다.

### P1-4. 리포트 행에 위험한 변경 폼이 두 개씩 상시 노출된다

리포트 10건에는 `Apply`와 `Update` 폼이 각각 하나씩 있어 총 20개 폼이 한 표에 들어간다. `Apply`는 warning뿐 아니라 payout hold, account block, profile review hold를 즉시 만들 수 있지만, 제어 생성에는 해제와 같은 확인 단계가 없다.

수정 요구:

- 기본 행은 읽기 전용으로 바꾸고 한 개의 `Review report` 행동만 둔다.
- drawer에서 조사 상태·심각도·resolution note를 수정한다.
- 계정 제한 적용은 별도 `Apply restriction` 절차로 분리한다: 영향 미리보기, 이유, 만료, 관련 증거, 최종 확인.
- `Account block`과 `Payout hold`는 권한이 있는 운영자만 보이게 하고 감사 actor를 표시한다.
- 저장 성공/실패를 행 또는 drawer 안에서 명확히 알리고, 실패 시 입력값을 보존한다.

### P1-5. 새 리포트 폼이 항상 펼쳐져 있어 큐를 가린다

운영자는 대개 기존 큐를 처리하러 들어오지만, 466px 높이의 생성 폼이 보고서 목록보다 먼저 나온다. Open 필터 결과가 0건일 때도 생성 폼을 지나야 빈 결과를 볼 수 있다.

수정 요구:

- 우측 상단 `New report` 버튼으로 옮기고 drawer/modal에서 연다.
- Category는 `Safety / Behavior / Identity / Payment / Service quality / Other`의 통제된 taxonomy로 바꾼다.
- Booking ID 직접 입력 대신 booking search/link를 제공한다.
- 파트너 검색 결과에 전화번호 일부, 상태, 최근 예약을 함께 보여 동명이인을 구분한다.

### P1-6. 테스트 데이터가 운영 기록과 섞여 있다

현재 리포트와 계정 제어 목록 대부분이 `Smoke partner control report`, `Smoke Referral ...`, `Smoke test ...`이다. 이를 구분하는 environment/test 배지도 없고 기본 목록에서 제외되지 않는다.

수정 요구:

- 운영 DB라면 smoke fixture 생성을 중단하고 기존 데이터를 정리/격리한다.
- staging이라면 화면 상단에 `STAGING / TEST DATA`를 강하게 표시한다.
- 테스트 계정은 `isTest` 같은 명시적 속성으로 필터하고, 이름 prefix에 의존하지 않는다.

### P1-7. 전화번호가 기본 노출되고 좁은 열에서 숫자 단위로 줄바꿈된다

전화번호는 이 큐의 1차 판단 정보가 아닌데 모든 행에서 전체 번호를 노출한다. Reports 표에서는 `+84 998 6792 73`이 여러 줄로 끊겨 읽기 어렵고 개인정보 노출 면적만 늘어난다.

수정 요구:

- 기본은 `+84 •••• 9273`처럼 마스킹하고, 권한 있는 운영자가 상세에서 볼 때만 전체 표시한다.
- 파트너 식별은 이름 + 짧은 Partner ID를 기본으로 사용한다.
- 숫자 단위 줄바꿈을 금지하고 열이 좁으면 보조 정보를 숨긴다.

### P1-8. `Open workspaces` 행동이 실제로 워크스페이스를 열지 않는다

`details=all`은 세 워크스페이스를 모두 열지 않고 명령 센터/우선순위 행동을 제거한 뒤 KPI와 세 개 버튼만 보여 준다. 버튼 텍스트와 결과가 맞지 않는다.

수정 요구:

- 상단에 항상 보이는 탭을 직접 사용하고 `Open workspaces`를 삭제한다.
- 또는 버튼을 `Choose a workspace`로 바꾸고 workspace selector anchor로 스크롤한다.
- `details=all` 모드는 필요하지 않으므로 제거하는 것이 가장 단순하다.

### P1-9. Account controls 기본 화면은 활성 제어보다 해제된 이력을 먼저 보여 준다

상단 Active controls는 0이지만 Account controls 기본 목록은 LIFTED 이력 10건을 보여 준다. 운영자는 “지금 처리할 것”과 “감사 이력”을 구분하기 어렵다.

수정 요구:

- 기본 탭은 `Active`로 고정하고 실제 0건이면 명확한 건강한 빈 상태를 보여 준다.
- `History` 탭에 Lifted/Expired를 옮긴다.
- 역사 행에는 issued by, lifted by, linked evidence, 정확한 duration을 표시한다.

### P1-10. 운영자가 필요한 owner · deadline · age · last change가 큐에 없다

명령 센터는 SLA를 말하지만 Reports 표에는 담당자, due at, age, 마지막 변경이 없다. Account controls에도 발행/해제 actor가 없다. 결국 누가 처리 중인지 알 수 없어 중복 대응이 발생한다.

수정 요구:

- 리포트 큐에 `Owner`, `Age/SLA`, `Last update`를 추가한다.
- 미할당/기한초과를 우선 정렬한다.
- 행 상세에 최근 활동 3개와 다음 필요한 증거를 보여 준다.

### P2-1. KPI badge가 문맥이 아니라 문자열 추론으로 생성된다

`Open reports`와 `Urgent / major`에는 `Current filters`, `Shared devices`에도 `Current filters`, `Onboarding gaps`에는 `Pending`이 붙는다. 이는 [metric-card.tsx](../../apps/admin_web/components/metric-card.tsx#L88)의 문자열 추론 결과다.

수정 요구:

- 이 페이지 KPI에는 `scope`와 `kind`를 명시적으로 전달한다.
- 예: `All partners`, `Current queue`, `Needs review`, `Healthy`.
- 0인데 `Needs action`인 상태를 없애고 값에 따라 tone을 정한다.

### P2-2. 행동 이름이 너무 일반적이다

`Open`, `Apply`, `Update`, `action(s)`는 어느 대상에 무엇을 하는지 말하지 않는다.

권장 문구:

| 현재 | 권장 |
|---|---|
| Next operator actions | Priority queue |
| 1 action(s) | 1 priority item / No priority items |
| Open | Review debt / Review report / Review restriction |
| Apply | Apply restriction |
| Update | Save report changes |
| Control filters | Filter this queue |
| Open workspaces | 삭제 또는 Choose a workspace |
| Booking blocked (wallet debt) | Acceptance & service start blocked |
| Active controls | Active account restrictions |
| 10 shown | 10 of 347 |

### P2-3. 좁은 화면은 메뉴만 반응형이고 핵심 큐는 반응형이 아니다

720px에서 사이드바는 햄버거로 바뀌고 KPI 두 열도 유지되지만, Reports/Checklist/Account controls는 여전히 1204px 표다. 운영자가 태블릿에서 긴급 조치만 처리하는 경우를 고려하면 핵심 행동이 오른쪽에 숨는 현재 구조는 부적합하다.

수정 요구:

- 1199px 이하에서는 핵심 정보 4개만 세로 row card로 제공한다.
- primary action은 항상 첫 화면 오른쪽 또는 카드 하단에 보이게 한다.
- 보조 필드는 `More details` disclosure에 넣는다.

## 4. 권장 화면 구조

### Summary

1. Header: `Partner risk & access` + `All partners · Updated 20:15`
2. Sticky tabs: `Summary | Partner blockers | Reports | Account controls`
3. 네 개의 링크형 KPI: `Urgent reports`, `Active restrictions`, `Debt gates`, `Overdue`
4. Priority queue 5~8행
5. Collapsible health signals: location/device/onboarding

### Partner blockers

| Priority | Partner | Blocking reason | Actual impact | Age/SLA | Owner | Action |
|---|---|---|---|---|---|---|
| Critical | Partner 8283 | -80,000 VND debt | Final acceptance · service start · payout | 3h | Finance | Review debt |

한 행을 열면 operator script, customer impact, policy source, evidence, recent activity를 보여 준다. 별도 playbook/matrix/checklist 섹션은 만들지 않는다.

### Reports

- 상단: 서버 검색 + Status + Severity + Owner + SLA + 정렬
- 우측: `New report`
- 표: Report, Partner, Severity/Status, Owner, Age/SLA, Last update, Review
- 행 상세 drawer: evidence, booking/customer links, timeline, status update, restriction flow

### Account controls

- 탭: `Active (0) | History`
- 표: Restriction, Partner, Impact, Source report, Started/Expires, Actor, Review
- 해제는 현재 confirmation 패턴을 유지하되 evidence/해제 이유를 필수로 한다.

## 5. 구현 순서와 완료 기준

### Phase 1 — 데이터 계약과 정책 정확성

- API real pagination/filter/search/totalCount 구현
- provider risk queue를 서버 정렬·검색으로 전환
- 전체 집계와 큐 scope 통일
- canonical blocker matrix 작성 후 모든 문구 통합
- smoke data 격리

완료 기준: 수치 충돌 0건, phantom page 0건, 11번째 이후 검색 가능, 정책 문구 snapshot test 통과.

### Phase 2 — 정보구조 단순화

- sticky workspace tabs
- 다섯 진단 섹션을 단일 queue + drawer로 축소
- KPI 8개 → 핵심 4개
- Account controls active/history 분리
- New report drawer 전환

완료 기준: 1440×900 첫 화면에 실제 작업 행 5개 이상 노출, 동일 사실 반복 섹션 0개.

### Phase 3 — 안전한 행동과 반응형

- row mutation forms 제거
- restriction 영향 미리보기 + confirmation
- owner/SLA/actor/audit 표시
- 1024/720 row-card layout
- phone masking

완료 기준: 720~1440에서 primary action 가로 스크롤 없이 접근 가능, 계정 차단/지급 보류가 한 번의 일반 `Apply` 클릭으로 실행되지 않음.

## 6. 반드시 추가할 테스트

- 리포트 25건 fixture: page 1/2/3의 ID가 서로 다르고 totalCount가 25로 고정된다.
- 11번째 이후에만 존재하는 파트너/리포트를 검색하면 결과가 나온다.
- 필터 변경 시 page가 1로 리셋된다.
- 마지막 페이지 이후 URL을 입력해도 phantom page가 생기지 않는다.
- Wallet debt/KYC/Bank/Tax/Account block 각각의 영향 matrix contract test.
- 세금은 선택 사항이라는 정책이 모든 카드·행·drawer에서 동일 문구로 렌더링된다.
- 1024/720에서 파트너 이름과 primary action이 동시에 보이는 visual/DOM assertion.
- 테스트 데이터는 production 기본 큐에 노출되지 않는다.
- 계정 제한 생성은 confirmation 없이는 server action이 실행되지 않는다.

현재의 28개 admin-web 관련 테스트와 4개 API `partner control` 테스트는 통과하지만, 기존 구조 테스트는 문자열 존재 여부 중심이라 위 데이터 정확성·페이지 구분·정책 일관성을 검증하지 못한다.

## 7. 접근성 및 개인정보

- 통과/강점: navigation landmark, heading 계층, 폼 label, 빈 상태 status는 대체로 갖춰져 있다.
- 고위험: 오른쪽 행동을 보기 위해 파트너 정체성을 화면 밖으로 밀어야 하며, 확대 사용자·키보드 사용자에게 문맥 유지가 어렵다.
- 고위험: 반복 버튼명이 `Apply`/`Update`라 screen reader의 버튼 목록에서 대상을 식별하기 어렵다. `Apply account block to Partner 8283`처럼 accessible name에 대상·행동을 포함한다.
- 개인정보: 전체 전화번호 기본 노출을 마스킹하고 상세 권한 확인 후 공개한다.
- 확인 필요: muted text와 pastel badge의 대비는 이번 감사에서 자동 contrast 수치 측정을 완료하지 않았으므로 axe/Playwright 접근성 검사와 실제 색 대비 검증을 별도 통과해야 한다.

## 8. 코드 변경 대상 범위

최소 변경 지점은 다음 네 축이다.

- [apps/admin_web/app/partner-controls/page.tsx](../../apps/admin_web/app/partner-controls/page.tsx): 정보구조, copy, drawer/queue, client-side filter 제거
- [apps/admin_web/app/partner-controls/partner-control-page-load-plan.ts](../../apps/admin_web/app/partner-controls/partner-control-page-load-plan.ts): 실제 page/filter query contract
- [apps/api/src/admin/admin-partner.routes.ts](../../apps/api/src/admin/admin-partner.routes.ts) 및 [admin.service.ts](../../apps/api/src/admin/admin.service.ts): skip/take/filter/sort/totalCount
- [apps/admin_web/app/globals.css](../../apps/admin_web/app/globals.css#L12849): 전역 nested-scroll 강제 제거와 responsive row layout

새 UI 프레임워크나 새로운 테이블 라이브러리는 필요 없다. 이미 있는 AdminSection, AdminFilterPanel, AdminDataTable, ConfirmDialog, ActionMenu를 재구성하는 것으로 충분하다.

## 9. 캡처 로그

| # | 파일 | 확인 상태 | 핵심 관찰 |
|---:|---|---|---|
| 01 | [01-default-top-1440.png](./01-default-top-1440.png) | 심각 | 첫 화면을 8개 KPI가 점유, 범위 표기 없음 |
| 02 | [02-command-center-1440.png](./02-command-center-1440.png) | 심각 | 전체 KPI와 10명 명령 센터 값 충돌 |
| 03 | [03-next-actions-workspaces-1440.png](./03-next-actions-workspaces-1440.png) | 개선 필요 | 다음 행동은 유용하나 `Booking blocked`, `Open`이 부정확 |
| 04 | [04-control-diagnostics-top-1440.png](./04-control-diagnostics-top-1440.png) | 심각 | 상세 워크스페이스에서도 KPI 반복 |
| 05 | [05-control-board-rows-1440.png](./05-control-board-rows-1440.png) | 심각 | 지갑 부채를 새 booking 전체 차단처럼 표현 |
| 06 | [06-control-board-rows-focused-1440.png](./06-control-board-rows-focused-1440.png) | 심각 | 내부 세로/가로 스크롤과 smoke row 혼재 |
| 07 | [07-unblock-policy-board-1440.png](./07-unblock-policy-board-1440.png) | 경고 | 설명 품질은 좋지만 4열 장문 카드라 scan이 어려움 |
| 08 | [08-unblock-policy-board-bottom-1440.png](./08-unblock-policy-board-bottom-1440.png) | 심각 | Tax optional 정책이 다른 섹션과 충돌 |
| 09 | [09-system-checklist-1440.png](./09-system-checklist-1440.png) | 심각 | 1440에서도 action 열이 잘림 |
| 10 | [10-system-checklist-right-1440.png](./10-system-checklist-right-1440.png) | 심각 | action을 보면 partner/heading 맥락을 잃음 |
| 11 | [11-reports-top-1440.png](./11-reports-top-1440.png) | 심각 | Reports에서도 동일 KPI 반복 |
| 12 | [12-reports-filter-create-1440.png](./12-reports-filter-create-1440.png) | 개선 필요 | 생성 폼이 큐보다 먼저 나오고 항상 펼쳐짐 |
| 13 | [13-reports-table-1440.png](./13-reports-table-1440.png) | 심각 | 전화번호 줄바꿈, 행당 2개 mutation form, action 잘림 |
| 14 | [14-reports-table-right-1440.png](./14-reports-table-right-1440.png) | 심각 | Update를 보면 report 제목을 잃음 |
| 15 | [15-account-controls-top-1440.png](./15-account-controls-top-1440.png) | 심각 | Active 0과 해제 이력 10건이 같은 우선순위처럼 보임 |
| 16 | [16-account-controls-table-1440.png](./16-account-controls-table-1440.png) | 심각 | Account history도 중첩 스크롤·가로 스크롤 사용 |
| 17 | [17-account-controls-filter-1440.png](./17-account-controls-filter-1440.png) | 개선 필요 | 기본 All이 해제 이력을 전면 노출 |
| 18 | [18-default-top-1024.png](./18-default-top-1024.png) | 경고 | 1024 첫 화면에 실제 작업이 없음 |
| 19 | [19-default-top-720.png](./19-default-top-720.png) | 경고 | shell은 반응형이나 KPI 밀도가 높음 |
| 20 | [20-system-checklist-1024.png](./20-system-checklist-1024.png) | 심각 | 684px 컨테이너에 1204px 표 |
| 21 | [21-system-checklist-720.png](./21-system-checklist-720.png) | 심각 | 태블릿 폭에서 money/action이 숨음 |
| 22 | [22-reports-table-1024.png](./22-reports-table-1024.png) | 심각 | 1024에서 account control/action이 잘림 |
| 23 | [23-reports-table-720.png](./23-reports-table-720.png) | 심각 | 720에서 핵심 변경 행동에 직접 접근 불가 |
| 24 | [24-account-controls-table-1024.png](./24-account-controls-table-1024.png) | 심각 | 1024에서 linked report/timeline/action이 잘림 |
| 25 | [25-open-workspaces-result-1440.png](./25-open-workspaces-result-1440.png) | 경고 | Open workspaces가 실제 workspace를 열지 않음 |
| 26 | [26-reports-open-empty-1440.png](./26-reports-open-empty-1440.png) | 심각 | 생성 폼 뒤의 0 결과가 전체 범위처럼 단정됨 |
| 27 | [27-reports-page3-footer-1440.png](./27-reports-page3-footer-1440.png) | 심각 | `21–30 of 30`인데 page 4 링크가 존재 |

## 10. 전체 스크린샷

### 기본 화면과 Summary

![기본 화면 상단](./01-default-top-1440.png)

![명령 센터](./02-command-center-1440.png)

![다음 행동과 워크스페이스](./03-next-actions-workspaces-1440.png)

### Control diagnostics

![진단 상단](./04-control-diagnostics-top-1440.png)

![제어 보드 첫 행](./05-control-board-rows-1440.png)

![제어 보드 내부 스크롤](./06-control-board-rows-focused-1440.png)

![Unblock board](./07-unblock-policy-board-1440.png)

![Unblock board 하단](./08-unblock-policy-board-bottom-1440.png)

![System checklist 왼쪽](./09-system-checklist-1440.png)

![System checklist 오른쪽](./10-system-checklist-right-1440.png)

### Reports

![Reports 상단](./11-reports-top-1440.png)

![Reports 필터와 생성 폼](./12-reports-filter-create-1440.png)

![Reports 표 왼쪽](./13-reports-table-1440.png)

![Reports 표 오른쪽](./14-reports-table-right-1440.png)

### Account controls

![Account controls 상단](./15-account-controls-top-1440.png)

![Account controls 표](./16-account-controls-table-1440.png)

![Account controls 필터](./17-account-controls-filter-1440.png)

### 반응형 검증

![기본 1024](./18-default-top-1024.png)

![기본 720](./19-default-top-720.png)

![Checklist 1024](./20-system-checklist-1024.png)

![Checklist 720](./21-system-checklist-720.png)

![Reports 1024](./22-reports-table-1024.png)

![Reports 720](./23-reports-table-720.png)

![Account controls 1024](./24-account-controls-table-1024.png)

### 라우팅·필터·페이지네이션 검증

![Open workspaces 결과](./25-open-workspaces-result-1440.png)

![Open reports 빈 결과](./26-reports-open-empty-1440.png)

![Reports page 3 footer](./27-reports-page3-footer-1440.png)
