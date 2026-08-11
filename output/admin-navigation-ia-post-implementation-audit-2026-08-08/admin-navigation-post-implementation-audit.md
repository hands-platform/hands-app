# HANDS Admin 내비게이션·카테고리 재구성 사후 감사 보고서

- 감사일: 2026-08-08
- 대상: `http://localhost:3101` 관리자 웹 전체 내비게이션 구조와 대표 워크스페이스
- 화면 범위: 운영 환경과 동일한 1440px 이상 데스크톱만 평가. 1024px 이하 및 모바일 레이아웃은 평가에서 완전히 제외했다.
- 감사 방법: 현재 로그인 세션의 실제 화면, 접근성 DOM 스냅샷, 내비게이션 설정/컴포넌트/권한 필터/라우트 매칭 코드, 관련 단위 테스트·TypeScript·ESLint를 교차 검증했다.
- 변경 범위: 이 감사에서는 애플리케이션 코드를 수정하지 않았다. 보고서와 현재 실행 화면 캡처만 추가했다.

## 1. 최종 판정

현재 재구성은 **방향과 핵심 구조는 성공적이며, 운영 배치에 가까운 B+ 수준(약 82/100)** 이다.

이전처럼 많은 개별 페이지와 쿼리 큐를 사이드바에 나열하지 않고, 8개의 업무 대분류와 37개의 대표 목적지, 검색 전용 저장 뷰, 페이지 내부 워크스페이스 탭으로 역할을 분리했다. 운영자가 “어떤 업무를 하려는가”를 기준으로 탐색할 수 있게 된 점이 가장 큰 개선이다. 현재 구조에서 카테고리를 더 합치거나 페이지를 삭제할 필요는 없다.

다만 최종 완료로 보기 전 반드시 해결할 핵심 항목이 2개 있다.

1. `Payout / Withdrawal Risk` 검색 딥링크는 필터 자체는 서버 요청에 적용되지만, 페이지 최상단에 현재 저장 뷰가 전혀 표시되지 않고 실제 출금 요청 섹션이 큰 페이지 하단에 있다. 운영자는 “위험 큐가 비었는지, 필터가 적용되지 않았는지” 오해할 수 있다.
2. 현재 내비게이션 컴포넌트가 ESLint를 통과하지 못한다. 활성 섹션 변경을 `useEffect` 내부의 동기 `setState`로 처리해 렌더 연쇄와 전환 순간의 잘못된 아코디언 노출 가능성이 남아 있다.

## 2. 요구사항 충족도

| 검수 항목 | 판정 | 근거 |
|---|---|---|
| 대분류를 8개 이내로 정리 | 통과 | 정확히 8개: Shift Command, Booking, Customer, Partner, Finance Operations, Finance Records & Close, Growth & Communications, Administration & Settings |
| Shift Command를 독립 첫 화면으로 유지 | 통과 | `/` 직접 링크로 유지됨 |
| 동시에 하나의 대분류만 펼침 | 통과 | 단일 `openSectionId`로 제어됨 |
| 현재 페이지가 속한 대분류 자동 열림 | 부분 통과 | 화면에서는 동작하나 구현 방식이 lint 실패 및 전환 플리커 위험을 만든다 |
| 쿼리 저장 뷰를 사이드바에서 제거 | 통과 | Partner Approvals, Wallet Debt 등은 검색 결과로 이동 |
| 관련 페이지를 로컬 워크스페이스로 묶음 | 통과 | Booking Closeout, Customer Signals, Messaging, Referrals, Partner Money, Settlement Records, Tax & Close, System Health 적용 |
| 페이지/데이터를 무리하게 합치지 않음 | 통과 | URL과 업무 처리 흐름은 유지하고 탐색 레이어만 통합함 |
| 검색 결과 정확도 | 통과 | `partner` 검색 시 Partner Directory → Partner Control Queue → Partner Operations Overview 순으로 노출 |
| URL·쿼리·권한 필터 보존 | 통과 | 정적 테스트 및 모델 테스트 통과 |
| 실제 저장 뷰의 도착 맥락 | 미흡 | Withdrawal Risk는 적용 상태가 첫 화면에 드러나지 않고 대상 섹션으로 이동하지 않음 |
| 키보드 검색 경험 | 미흡 | 표시된 `Ctrl K`가 동작하지 않고 `Escape`로 닫히지 않음 |
| 코드 품질 게이트 | 미흡 | TypeScript는 통과했으나 ESLint 1 error, 1 warning |

## 3. 카테고리 구조 평가

### 유지해야 하는 현재 대분류

현재 8개 대분류는 운영자의 책임 단위와 잘 맞는다. 특히 `Finance Operations`와 `Finance Records & Close`를 분리한 것은 옳다. 전자는 오늘 처리해야 할 승인·환불·대사·현금정산·예외 복구, 후자는 이미 생성된 결제·지갑·원장·세금·마감 기록을 다루므로 작업 모드가 다르다.

추가 통합이나 페이지 삭제는 권장하지 않는다. 더 줄이면 다음 문제가 생긴다.

- Customer Support와 Partner Operations를 합치면 문의 대상과 책임자가 섞인다.
- Finance Operations와 Finance Records & Close를 합치면 13개 대표 목적지가 한 그룹에 몰린다.
- Growth & Communications를 Administration에 넣으면 일상 마케팅 업무가 보호 설정과 섞인다.
- Booking Closeout, Messaging, Referrals 등을 한 페이지로 물리적으로 합치면 권한과 위험 수준이 다른 작업이 한 화면에서 충돌한다.

### 보완할 명칭

- `Finance Closeout`은 상위 `Finance Records & Close` 및 하위 `Tax & Close`와 단어가 겹친다. 실제 설명이 “governed settlement gaps repair”이므로 **Settlement Repair Queue** 또는 **Finance Exception Repair**가 더 직관적이다.
- `Tax & Close`는 **Tax & Period Close**로 바꾸면 월 마감 업무임을 더 명확히 전달한다.
- Breadcrumb의 `Partner directory`는 사이드바와 동일하게 **Partner Directory**로 대소문자를 통일한다.

## 4. 잘된 점

1. 사이드바의 첫 스캔 비용이 크게 줄었다. 운영자는 먼저 업무 영역을 고르고 그 안에서 3~7개 대표 목적지만 비교하면 된다.
2. `Booking Closeout`, `Messaging`, `Referrals`, `Partner Money`의 로컬 탭은 관련성은 유지하면서 사이드바 중복을 없앴다.
3. 과거 쿼리 변형 페이지를 삭제하지 않고 검색 저장 뷰로 유지해 기능 손실이 없다.
4. 각 항목에 안정적인 `id`와 `iconKey`를 사용해 라벨 변경이 아이콘·테스트를 깨뜨리지 않는다.
5. 권한 필터가 대표 링크뿐 아니라 검색 엔트리와 로컬 그룹에도 적용된다.
6. 1440px 이상에서 아코디언, 활성 링크, 로컬 탭, 검색 드롭다운이 레이아웃 파손 없이 표시된다.
7. 라이트·다크 테마 모두 정보 계층과 활성 보라색 상태가 일관적이다.
8. 실제 `partner` 검색의 상위 세 결과가 운영자가 가장 자주 찾을 핵심 파트너 화면 순서와 일치한다.

## 5. 우선순위별 추가 개선 요구사항

### P1 — 릴리스 전 수정

#### P1-1. Withdrawal Risk 저장 뷰를 실제 큐 위치에 도착시키기

현재 검색 엔트리는 `/payouts?range=all&withdrawalStatus=REVIEW_REQUIRED`로 이동한다. 모델은 `withdrawalStatus`를 API 요청에 전달하므로 필터 데이터는 맞다. 그러나 해당 섹션 `#partner-wallet-withdrawal-requests`가 명령 큐, 자금 흐름, release blocker, partner finance queue 뒤에 렌더링된다. 첫 화면에는 `Payouts`, 전체 159개 배치, Operations 탭만 보여 현재 위험 큐가 보이지 않는다.

권장 수정:

- 검색 href를 `/payouts?range=all&withdrawalStatus=REVIEW_REQUIRED#partner-wallet-withdrawal-requests`로 변경한다.
- 페이지 상단에 `Saved view: Withdrawal requests · Review required` 필터 칩과 결과 건수를 노출한다.
- `Clear saved view` 링크를 제공한다.
- 섹션 제목 바로 아래에 `Review required`가 선택된 상태를 텍스트와 시각 상태 모두로 표시한다.
- 검색 딥링크, 페이지네이션, 행 액션 후 복귀 URL이 같은 hash와 필터를 보존하는지 테스트한다.

완료 기준: 링크 진입 직후 대상 섹션 제목, 선택 필터, 결과 건수가 첫 화면 안에 보이고 운영자가 3초 안에 “어떤 큐에 들어왔는지” 말할 수 있어야 한다.

#### P1-2. 내비게이션 상태 계산을 effect 기반 동기 setState에서 제거

`components/admin-shell-nav.tsx` 106~110행의 effect가 lint error를 만든다. 라우트 변경 시 이전 수동 열림 상태가 한 렌더 남을 수 있다.

권장 수정:

- `routeKey = pathname + '?' + search`를 만든다.
- 상태에는 `{ routeKey, sectionId }` 형태의 “현재 라우트에서 사용자가 수동으로 고른 섹션”만 저장한다.
- 현재 routeKey와 상태 routeKey가 다르면 렌더 중 파생한 `activeSection.id`를 사용한다.
- effect를 제거하고 클릭 시에만 상태를 갱신한다.
- 활성 라우트 변경, 현재 섹션 닫기, 다른 섹션 수동 열기, Shift Command 이동을 테스트한다.

완료 기준: ESLint가 0 error/0 warning이고, 라우트 전환 중 잘못된 섹션이 한 프레임도 열리지 않아야 한다.

### P2 — 다음 개선 배치

#### P2-1. `Ctrl K`와 검색 팝오버의 닫기 규칙 완성

화면에 `Ctrl K`가 표시되지만 실제 키 입력으로 검색이 열리지 않는다. 검색 입력에서 `Escape`를 눌러도 닫히지 않는다. 코드에도 전역 단축키, outside click, 포커스 복귀가 없다.

권장 수정:

- Windows/Linux `Ctrl+K`, macOS `Meta+K`로 열기/닫기.
- `Escape`로 닫고 검색 트리거로 포커스 복귀.
- 바깥 클릭으로 닫기.
- 열릴 때 입력 자동 포커스, 닫을 때 query 또는 show-all 상태의 정책을 명시.
- ArrowUp/ArrowDown으로 결과 이동, Enter로 실행, Tab 순환 또는 비모달 popover 의미를 명확히 한다.
- 단축키와 Escape 동작을 컴포넌트 테스트로 추가한다.

#### P2-2. Breadcrumb가 실제 하위 페이지를 끝점으로 표시하도록 수정

현재 Notification Templates에서 breadcrumb는 `HANDS > Growth & Communications > Messaging`으로 끝난다. Partner Referrals도 `... > Referrals`, Post-match Cancellations도 `... > Booking Closeout`까지만 표시한다. `aria-current="page"`가 실제 페이지가 아니라 대표 워크스페이스를 가리키는 셈이다.

권장 구조:

- `HANDS > Growth & Communications > Messaging > Notification Templates`
- `HANDS > Growth & Communications > Referrals > Partner Referrals`
- `HANDS > Booking Operations > Booking Closeout > Post-match Cancellations`
- 워크스페이스 대표는 링크, 실제 현재 페이지는 마지막 텍스트와 `aria-current="page"`.

#### P2-3. Shift Command의 활성 표시를 hover보다 강하게 구분

하위 링크는 보라색 그라데이션으로 명확하지만 독립 직접 링크인 Shift Command의 활성 상태는 일반 대분류 hover와 같은 연한 배경이다. Shift 화면에서 다른 대분류를 펼치기 위해 클릭하면 두 항목이 모두 활성처럼 보일 수 있다.

권장 수정:

- Shift Command 활성 시 하위 링크와 같은 강한 보라색 또는 3px 좌측 활성 바를 사용한다.
- 펼쳐진 상태는 chevron 회전과 굵기만 바꾸고 “현재 페이지” 색을 사용하지 않는다.
- `aria-current`는 현재 링크 하나에만 유지한다.

#### P2-4. 로컬 워크스페이스 탭과 페이지 헤더 버튼 중복 제거

- Notification Templates의 `Delivery board`, `Push send`는 바로 위 로컬 탭과 동일한 목적지다.
- Partner Referrals의 `Open reward cashouts`도 로컬 `Referral Cashouts` 탭과 중복된다.

로컬 탭에 존재하는 단순 이동 버튼은 제거한다. 헤더 버튼은 `Create template`, `Send reviewed push`, `Open policy settings`처럼 현재 페이지에서 수행하는 고유 행동만 남긴다.

#### P2-5. Administration의 System Health 노출 밀도 완화

Administration은 직접 목적지 7개와 System Health 3개를 함께 보여 가장 길다. 권한상 Master Admin만 보는 구성이므로 치명적이지 않지만, 일반 설정과 기술 진단의 시각적 밀도가 높다.

현재 카테고리를 분리해 9번째 대분류를 만들 필요는 없다. 대신 다음 중 하나가 적합하다.

- `System Health` 소그룹을 기본 접힘 상태로 만들고 내부 3개 링크를 펼친다.
- 또는 `/system-health` 허브를 대표 링크로 만들고 Setup, App Sessions, Background Jobs를 로컬 탭으로 둔다.

#### P2-6. 모든 로컬 워크스페이스에 공통 계약 테스트 추가

현재 테스트는 핵심 그룹 일부를 다루지만 모든 그룹의 대표 URL/활성 탭/권한 축소를 표 형태로 검증하지 않는다.

최소 대상: Booking Closeout, Customer Signals, Messaging, Referrals, Partner Money, Settlement Records, Tax & Close, System Health.

각 그룹에서 대표 URL, 하위 URL, query URL, 권한이 하나만 남은 경우 로컬 탭 숨김, active 판정을 테스트한다.

### P3 — 마감 품질

- `Partner directory`를 `Partner Directory`로 통일한다.
- `Partner Money`와 `Wallet Adjustments`가 동일 계열 지갑 아이콘을 사용해 빠른 스캔 시 구분이 약하다. Wallet Adjustments에는 조정/교환을 나타내는 별도 아이콘을 사용한다.
- `Vietnam Operations Map`, `Finance Records & Close`, `Growth & Communications`, `Administration & Settings`의 2행 표시는 1440px 이상에서 허용 가능하다. 다만 텍스트를 더 줄이기보다 현재 사이드바 폭과 줄 간격을 유지해야 한다.
- 검색 `Show all results`가 20개 이상일 때는 섹션별 heading을 넣어 긴 단일 목록의 스캔 비용을 줄인다. 기본 7개 결과 정책은 유지한다.

## 6. 화면별 감사 단계와 상태

1. **Shift Command 기본 화면 — 건강**: 8개 대분류와 독립 시작 화면이 명확하다. 직접 링크 활성 강도만 보완 필요.
2. **Booking Operations 펼침 — 건강**: Live/Calendar/Closeout/Handoff/Map이 업무 흐름대로 구성됐다.
3. **Customer Support 펼침 — 건강**: Customers/Signals/Chat Evidence가 중복 없이 구분된다.
4. **Partner Operations 펼침 — 건강**: Directory/Control Queue/Overview의 목적 차이가 분명하다.
5. **Finance Operations 펼침 — 양호**: 7개로 상한에 가깝지만 현재 처리 업무라는 공통성이 있다. Finance Closeout 명칭만 개선 권장.
6. **Finance Records & Close 펼침 — 양호**: 기록·원장·세금·마감이 잘 모였다. 유사 아이콘을 보완하면 더 빠르게 스캔 가능하다.
7. **Growth & Communications 펼침 — 건강**: Insights/Coupons/Referrals/Messaging/Website Content 재배치가 자연스럽다.
8. **Administration & Settings 펼침 — 주의**: 권한 구분은 적절하지만 System Health 포함 시 가장 조밀하다.
9. **Messaging / Notification Templates — 주의**: 로컬 탭은 성공적이나 breadcrumb와 헤더 이동 버튼이 중복된다.
10. **Referrals / Partner Referrals — 주의**: 로컬 탭은 성공적이나 cashout 이동 버튼이 중복된다.
11. **Booking Closeout / Post-match Cancellations — 건강**: 두 페이지를 데이터 병합 없이 한 워크스페이스로 묶은 방식이 적절하다.
12. **Partner Money 위험 딥링크 — 개선 필요**: 필터는 적용되지만 대상 큐와 선택 상태가 첫 화면에 없다.
13. **`partner` 검색 — 건강**: 핵심 3개 파트너 목적지가 상단에 정확히 정렬된다.
14. **다크 테마 — 양호**: 계층과 활성 상태가 유지된다. 정량 대비 검사는 별도 도구로 추가할 수 있다.

## 7. 품질 점수

| 영역 | 점수 | 평가 |
|---|---:|---|
| 정보 구조와 업무 적합성 | 18/20 | 대분류와 워크스페이스 전략이 좋고 더 합칠 필요 없음 |
| 운영자 위치 인식과 문구 | 15/20 | 명칭은 전반적으로 좋아졌으나 breadcrumb와 일부 Closeout 용어가 모호 |
| 상호작용과 접근성 | 13/20 | semantic nav/dialog/searchbox는 좋으나 Ctrl K, Escape, outside click, focus 복귀 미구현 |
| 1440px+ 시각 완성도 | 18/20 | 라이트/다크 모두 안정적이고 레이아웃 파손 없음 |
| 코드·테스트·회귀 안전성 | 18/20 | 43개 관련 테스트 및 typecheck 통과, 단 lint error와 누락된 상호작용 테스트 존재 |
| **총점** | **82/100** | **B+ — 구조는 채택 가능, P1 수정 후 완료 판정 권장** |

Impeccable 기술 감사 환산: 접근성 3/4, 성능 3/4, 테마 4/4, 1440px+ 레이아웃 3/4, 구현 무결성 3/4 = **16/20 (Good)**. 사용자의 범위 지시에 따라 1024px 이하 반응형은 점수와 보고서에서 제외했다.

## 8. 검증 결과

실행 명령:

```text
npm run test --workspace @massage-vn/admin-web -- --run lib/admin-navigation.spec.ts components/admin-shell-nav.spec.tsx lib/admin-nav-match.spec.ts app/payouts/payouts-page-model.spec.ts
npm run typecheck --workspace @massage-vn/admin-web
npm run lint --workspace @massage-vn/admin-web
node C:\Users\laboy\.codex\skills\impeccable\scripts\detect.mjs --json apps/admin_web/components
```

결과:

- 관련 테스트: **4 files, 43 tests 전부 통과**
- TypeScript: **통과**
- Impeccable 정적 detector: **발견 0건**
- ESLint: **실패** — `admin-shell-nav.tsx:108` 1 error, `:110` 1 warning

## 9. 접근성 증거와 한계

확인한 항목:

- 실제 브라우저 접근성 트리에서 `navigation`, `link`, `searchbox`, `dialog`, `aria-current`, `aria-expanded` 노출 확인
- 키보드로 `Ctrl+K`와 `Escape` 실제 입력 확인
- 라이트/다크 1440px 이상 시각 확인

이번 감사에서 확인하지 않은 항목:

- NVDA/JAWS/VoiceOver 실제 낭독 순서
- 자동 색상 대비 측정 및 색각 이상 시뮬레이션
- 일반 운영자/Finance Approver 등 별도 계정으로 로그인한 실화면 권한 축소. 권한은 코드와 단위 테스트로만 검증했다.
- 1024px 이하 화면과 모바일 레이아웃은 사용자 지시에 따라 검사하지 않았다.

## 10. 구현 순서

1. Withdrawal Risk hash·상단 saved-view context 추가
2. 아코디언 effect 제거 및 ESLint 통과
3. Ctrl/Meta+K, Escape, outside click, focus 복귀 구현
4. breadcrumb에 실제 로컬 페이지 추가
5. 중복 헤더 이동 버튼 제거
6. 명칭·대소문자·아이콘 마감
7. 전체 로컬 워크스페이스 계약 테스트 추가

위 1~4까지 완료하면 운영자 사용성은 실질적으로 완료 단계이고, 5~7은 마감 품질과 회귀 방지 단계다.
