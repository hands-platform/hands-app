# 파트너 상세 기본 보기 / 전체 기록 심층 UX·코드 감사

- 감사일: 2026-08-06
- 대상:
  - `http://localhost:3101/partners/audit_booking_list_resolved_provider_profile`
  - `http://localhost:3101/partners/audit_booking_list_resolved_provider_profile?section=full`
- 기준 사용자: 프로그래머가 아닌 실제 운영자, 파트너 승인 담당자, 고객지원·정산 담당자
- 검수 범위: 실제 렌더링 화면, 문구, 상태 판정, 업무 흐름, 권한 경계, 고위험 행동, 반응형·접근성, 관련 코드와 테스트
- 코드 변경: 없음

## 1. 결론

현재 기본 보기는 “빠른 운영 개요”라는 방향은 맞지만, 카드 위의 자동 문구가 `Current filters`, `All records`, `Needs action`처럼 업무와 무관하게 추론되어 상태 신뢰도를 떨어뜨린다. 전체 기록 보기는 파트너 정보를 한곳에 모았다는 장점이 있으나, 실제 화면 높이가 약 15,948px이고 23개 표·8개 폼·45개 제목을 한 페이지에 렌더링한다. 운영자가 한 가지 결정을 내리기 위해 지나치게 많은 내용을 훑어야 한다.

가장 좋은 개선은 새 페이지를 더 만드는 것이 아니다. 이미 존재하는 `dossier`, `access`, `bookings`, `control` 작업 공간을 살리고, 기본 경로를 “운영 지휘 화면”으로, 각 작업 공간을 “업무별 상세 화면”으로 쓰는 것이다. `section=full`은 긴 전체 기록이 아니라 작업 공간 색인으로 축소하거나 기본 보기로 호환 리다이렉트하는 편이 낫다.

단순 시각 문제보다 먼저 고쳐야 할 신뢰 문제가 있다.

1. 권한 거부나 API 오류가 빈 배열로 바뀌어 `0건`, `Clear`처럼 보일 수 있다.
2. 공통 상태 번역기가 도메인을 구분하지 않아 `MANUAL_OFFLINE`을 “운영자가 오프라인 처리”로, KYC의 `DRAFT`를 “프로필 초안”으로 잘못 표시한다.
3. KYC 승인, 미디어 삭제, 계정 제어처럼 위험도가 다른 행동의 확인·포커스·권한 표시 방식이 일관되지 않다.
4. 핵심 표가 페이지 안에서 다시 세로 스크롤되고, 예약 증거 표의 오른쪽 열은 1280px 화면에서도 잘린다.

## 2. 감사 점수

| 항목 | 점수 | 핵심 근거 |
|---|---:|---|
| 접근성 | 2/4 | 표 의미 구조와 토큰은 있으나 확인 화면의 초기 포커스·모달 격리 부족, 과도한 중첩 스크롤, 제목 계층 과밀 |
| 성능 | 2/4 | 전체 보기 코드 경로가 최대 6개 Admin 조회를 예약하고, 빈 상태까지 23개 표·8개 폼을 렌더링 |
| 반응형 | 1/4 | 1280px에서도 7열 증거 표가 잘리며, 1024px 미만은 거친 포인터에서만 데스크톱 차단 |
| 테마 | 3/4 | 라이트·다크 토큰 적용은 일관적이다. 다만 흐린 보조 문구와 위험 행동 대비는 실측 검증 필요 |
| 구현 무결성 | 2/4 | 상태 문구의 도메인 혼용, 권한 실패의 빈 데이터 처리, 1,938줄 페이지와 170개 라우트 파일로 변경 위험 증가 |
| **총점** | **10/20** | **사용 가능하지만 중요한 신뢰·업무 구조 개선이 필요** |

심각도 집계: P0 0건 / P1 6건 / P2 10건 / P3 3건.

## 3. 측정된 현재 구조

| 측정 항목 | 기본 보기 | `section=full` |
|---|---:|---:|
| 페이지 높이, 1280×720 | 약 1,757px | 약 15,948px |
| 주요 화면 역할 | 빠른 개요 | 승인·근무·예약·재무·기록 전체 혼합 |
| 표 | 소수 요약 | 23개 |
| 폼 | 없음에 가까움 | 8개 |
| 제목 `h1~h3` | 단순 | 45개 |
| 내부 세로 스크롤 표 | 없음 | 확인된 것만 4개 |

구현 규모:

- `apps/admin_web/app/partners/[id]/page.tsx`: 1,938줄
- 같은 라우트 폴더: 170개 TypeScript/TSX 파일
- 이 중 비테스트 소스: 86개, 약 16,175줄
- Impeccable 정적 탐지기: 기계적으로 확정 가능한 위반 0건. 아래 문제는 실제 화면·데이터 흐름·코드 문맥을 함께 대조해 확인했다.

## 4. 현재 잘된 부분

1. 기본 보기에서 파트너 이름, 전화번호, 도시를 바로 확인할 수 있다.
2. 전체 보기 최상단에 미해결 항목을 먼저 두려는 방향은 올바르다.
3. KYC, 근무 준비, 예약, 재무, 운영 기록을 큰 업무 영역으로 분류한 것은 운영자의 사고방식과 가깝다.
4. 표에 열 제목이 있고, 스크롤 영역에 `Scrollable data table` 이름과 포커스 스타일이 있어 기본 의미 구조는 갖췄다.
5. 개발자 진단은 권한 확인 후 별도 진입점으로 노출하려는 구조가 있다.
6. 위험 행동에 사유를 요구하고 감사 로그에 남기려는 정책 자체는 좋다.
7. 라이트·다크 모드 모두 기존 디자인 토큰을 사용한다.

## 5. 최우선 P1 문제

### P1-1. 권한 거부·API 오류가 `Clear / 0건`으로 오인될 수 있음

근거:

- 전체 보기는 재무 자료를 별도 API로 읽는다: `page.tsx:365-445`.
- `adminGet`은 403, 500, 네트워크 오류를 전달하지 않고 주어진 fallback만 반환한다: `apps/admin_web/lib/admin-api.ts:5591-5615`.
- 화면은 빈 배열을 “0건”, “Clear”, “No records found”로 렌더링한다.
- 페이지는 현재 운영자 권한을 개발자 진단과 수동 고객 리뷰에만 명시적으로 사용한다: `page.tsx:353`, `page.tsx:723-726`.

영향:

- 권한이 없는 운영자가 “자료를 볼 수 없음”을 “문제가 없음”으로 해석할 수 있다.
- 정산 담당이 아닌 운영자가 지갑·출금·조정 내역을 비어 있다고 믿고 다음 결정을 내릴 수 있다.

수정 요건:

- `adminGetResult`를 사용해 각 영역을 `loaded | forbidden | error | empty`로 구분한다.
- `forbidden`은 “재무 권한이 없어 확인할 수 없음”, `error`는 “자료 로드 실패—결정 보류”로 표시한다.
- 실패·권한 거부 상태에서는 `Clear`, `Ready`, `0건`을 절대 계산하지 않는다.
- 화면 행동도 `PARTNERS_KYC`, `FINANCE_SETTLEMENTS`, `FINANCE_WALLET_ADJUSTMENTS`, `CUSTOMERS_REVIEWS`, `DEVELOPER_SYSTEM` 권한별로 숨기거나 읽기 전용 처리한다.
- 서버 권한은 그대로 최종 권위로 유지한다. 프런트 권한 처리는 설명성과 실수 방지용이다.

### P1-2. 공통 상태 번역기가 업무 의미를 틀리게 표시함

확인된 실제 모순:

| 원본 상태/문맥 | 현재 화면 | 실제 코드 의미 | 권장 문구 |
|---|---|---|---|
| KYC `DRAFT` | `Profile draft` | KYC 자료 미제출·미승인 | `KYC not submitted` 또는 `3 documents missing` |
| Availability `MANUAL_OFFLINE` | `Taken offline by an operator` | 파트너가 직접 근무 가능 상태를 끔 | `Partner set offline` |
| Payout `DEFERRED` | `DEFERRED` 또는 `Review postponed` | 첫 수익 전이라 지급 대상이 아님 | `Not eligible yet — no payable earning` |
| Wallet positive balance | `Clear`, `50.000 VND` | HANDS가 파트너에게 보유한 양수 잔액/부채 | `50,000 VND held for Partner` |

원인:

- `apps/admin_web/lib/admin-copy.ts:12-39`의 한 개 `partnerOperatingStatusLabel`이 KYC, 프로필, 근무 가능 상태, 지급 상태를 모두 번역한다.
- `partner-detail-operational-status-model.ts:122-129`는 “파트너가 직접 오프라인으로 전환”이라고 판단하지만, 화면 렌더링 단계에서 다시 “운영자가 오프라인 처리”로 바뀐다.

수정 요건:

- 범용 상태 번역을 더 확장하지 않는다.
- `kycStatusLabel`, `availabilityStatusLabel`, `payoutEligibilityLabel`, `walletPositionLabel`처럼 실제 도메인별 최소 매핑을 둔다.
- 상태만 보여주지 말고 `결과 + 원인 + 기준 시각`을 함께 보여준다.
- 테스트는 원본 enum이 아니라 운영자에게 표시되는 최종 문장을 검증한다.

### P1-3. 전체 기록이 너무 길고 페이지 내부 세로 스크롤이 핵심 행을 숨김

근거:

- 전체 화면은 약 15,948px이다.
- `.partners-page .admin-table-scroll`에 `max-height`와 `overflow:auto`가 적용된다: `globals.css:6399-6406`.
- 최상단 `Needs action` 표에서도 5개 중 처음 2개만 한 번에 보이고, 표 안에서 다시 스크롤해야 한다.
- `Work readiness` 7개 행도 내부 스크롤로 일부가 숨는다.

영향:

- 운영자는 페이지 스크롤과 표 스크롤을 번갈아 사용해야 한다.
- “5 open”을 보고도 실제 5개가 한 화면 흐름에서 연결되지 않는다.
- 페이지 길이가 길어질수록 상단 요약과 현재 위치를 잃는다.

수정 요건:

- `section=full`에 모든 상세 컴포넌트를 쌓지 않는다.
- 기본 보기에서 미해결 5개 이하는 모두 펼쳐 표시하고 세로 내부 스크롤을 제거한다.
- 긴 기록은 기존 업무별 작업 공간에서 페이지네이션 또는 날짜 필터로 본다.
- 전체 페이지에 별도의 새 내비게이션 시스템을 만들지 말고, 기존 `dossier / access / bookings / control` 작업 공간 링크를 재사용한다.

### P1-4. 고위험 행동의 확인·포커스·삭제 보호가 일관되지 않음

확인된 차이:

- 상단 `Reject partner`, `Block account`는 확인 화면을 연다.
- KYC `Approve`는 즉시 제출 폼이다.
- `Apply account control`도 사유 입력 뒤 즉시 제출한다.
- 공개 프로필 사진 삭제는 삭제 아이콘을 누르면 바로 서버 액션을 제출한다: `partner-detail-document-media-section.tsx:244`.
- 공통 `ConfirmDialog`는 `role="alertdialog"`이지만 `aria-modal`, 초기 포커스, 배경 비활성화, Escape 복귀가 없다: `admin-surface.tsx:442-460`.
- 실제 확인 화면 진입 후 활성 요소는 `BODY`였다.
- 확인 제목이 `Hold Partner audit_bo?`처럼 잘린 내부 ID를 사용한다.

수정 요건:

- 승인, 거절, 계정 중지, 지급 중지, 미디어 삭제는 같은 확인 패턴을 사용한다.
- 확인 화면에는 파트너 표시명, 대상, 현재 상태, 바뀔 상태, 영향 범위, 사유, 만료 시각을 명시한다.
- 다이얼로그로 구현할 경우 초기 포커스, 포커스 트랩, `aria-modal`, Escape 취소, 취소 후 원래 버튼으로 포커스 복귀를 보장한다.
- 단순 라우트 기반 확인 카드로 유지할 경우 `alertdialog` 역할을 제거하고 일반 확인 페이지로 의미를 맞춘다.
- 미디어 삭제는 미리보기·파일 유형·취소·최종 확인을 거친다.
- 제목에는 잘린 ID 대신 `An Pham`을 쓰고 전체 ID는 보조 메타데이터로만 둔다.

### P1-5. 예약 증거 표가 운영자에게 읽히지 않음

근거:

- `Partner booking evidence bundles`는 7열이다.
- 1280px 화면에서도 `Ops evidence`, `Open` 열이 잘리고 내부 가로·세로 스크롤을 사용한다.
- `Booking and chat records`는 한 행 안에 전체 채팅 창을 넣어 행 높이가 매우 커진다.

수정 요건:

- 첫 화면 표는 `예약 / 상태 / 파트너 역할 / 금액 / 다음 행동` 5개 핵심 열만 남긴다.
- 고객 주소, 채팅, 지급, 운영 증거는 행 펼침 또는 오른쪽 상세 패널에서 보여준다.
- 채팅 본문은 기본 접힘 상태로 하고 마지막 메시지·메시지 수·마지막 시각만 표에 둔다.
- `Booking`, `Customer`, `Chat` 링크는 하나의 `Open details` 메뉴로 정리한다.
- 예약 ID는 `audit_bo...` 대신 짧은 ID와 서비스 시각을 같이 표시하고, 전체 ID는 복사 버튼으로 제공한다.

### P1-6. 경고는 있지만 실행 가능한 다음 행동이 없는 항목이 있음

예:

- 서비스 가격은 “정확한 payout rule을 생성해야 함”이라고 알려주지만 해당 규칙 생성 화면으로 직접 가는 링크가 없다.
- 앱 도달 불가의 다음 행동은 `Ask Partner to reopen the app`이지만 링크나 연락 기록 행동이 없다.
- KYC 서류가 없을 때 `Put on hold`가 비활성화되고, `Request documents` 또는 안내 전송 행동도 없다.

수정 요건:

- 모든 미해결 행에 `담당 영역`, `다음 행동`, `완료 조건`을 둔다.
- 서비스 행은 해당 서비스·가격 조건이 채워진 서비스 카탈로그/payout rule 화면으로 링크한다.
- 위치·앱·서류 요청은 “파트너에게 안내 전송 + 운영 노트 자동 기록”을 한 행동으로 제공한다.
- 실행 경로가 없는 상태는 `Needs action`으로 세지 말고 `Monitoring` 또는 `Information`으로 분리한다.

## 6. P2 개선 항목

### P2-1. 기본 보기 카드의 자동 범위 배지가 의미 없음

`PartnerDetailFastOverview`는 카드마다 tone을 계산하지만 `PartnerDetailFastOverviewSection`이 `AdminMetricGrid`로 변환할 때 tone/scope를 전달하지 않는다. 이후 `MetricCard`가 문구를 보고 `Current filters`, `All records`, `Needs action` 등을 자동 추론한다.

수정:

- 파트너 상세 카드에서는 자동 scope 추론을 사용하지 않는다.
- 상태 배지가 꼭 필요할 때만 `Blocked`, `Stale`, `Ready`, `No data`를 명시적으로 전달한다.
- `Wallet Clear`에 `Needs action`이 붙는 현재 모순을 테스트로 고정해 제거한다.

### P2-2. `Needs action`과 `Current partner status`가 같은 정보를 반복함

- 두 영역 모두 승인 2개, 근무 3개, 총 5개를 반복한다.
- 상단에는 하나의 `Action required` 목록을 두고, 그 아래에는 4개 상태만 간결하게 보여주는 편이 낫다.

### P2-3. `Open full partner record` 명칭이 실제 동작과 다름

- 전체 보기에서도 예약·지급·노트·타임라인은 최대 3개로 잘라 미리 보여준다: `page.tsx:1880-1882`.
- 실제 전체 기록은 다시 `Open all ... records` 링크로 이동해야 한다.

수정:

- 버튼을 `Open workspaces` 또는 `View partner work areas`로 바꾼다.
- `section=full`은 작업 공간 색인만 보여주거나 기본 경로로 리다이렉트한다.

### P2-4. 프로필 편집과 KYC 판단이 한 카드에 섞임

- 운영자는 KYC 증거를 판단하려는데 번역 5개 입력과 공개 사진 업로드가 먼저 보인다.

수정:

- `Identity evidence`를 첫 영역으로 둔다.
- `Public profile content`와 번역은 `Edit public profile`을 눌렀을 때만 펼친다.
- 승인 판단용 필드와 고객 앱 콘텐츠 편집 권한을 분리한다.

### P2-5. 빈 상태가 페이지를 과도하게 늘림

- 리뷰 0건인데 고객 리뷰 표와 파트너 평가 표를 각각 크게 렌더링한다.
- 출금 정보 없음, 세금 프로필 선택 사항, 수동 조정 0건도 각각 큰 카드와 표를 차지한다.

수정:

- 비차단 0건 영역은 한 줄 요약으로 접는다.
- `No records`는 정상·미수집·권한 없음·오류를 다른 문구와 색으로 구분한다.
- 실제 기록이 생길 때만 표를 렌더링한다.

### P2-6. 전체 페이지에서 현재 위치를 잃음

- 상단 상태 링크는 있으나 스크롤하면 사라진다.

수정:

- 최대 5개 업무 탭을 상단에 고정한다: `Overview / Approval / Work / Money / History`.
- 현재 탭과 미해결 수만 표시하고, 별도 복잡한 목차 컴포넌트는 만들지 않는다.

### P2-7. 데이터 기준 시각과 출처가 부족함

- `28h old`, `Not tracked`, `50.000 VND`는 보이지만 마지막 동기화 시각과 출처가 없다.

수정:

- 위치·앱·지갑·예약 영역에 `Updated`, `Source`, `Policy threshold`를 둔다.
- 데이터가 stale이면 단순 노란색이 아니라 기준과 초과 시간을 표시한다.

### P2-8. 영어 운영 화면 안에 파일 선택 문구만 한국어로 표시됨

- 브라우저 기본 파일 입력이 `파일 선택 / 선택된 파일 없음`으로 표시된다.

수정:

- 기존 파일 입력을 유지하되, 운영 화면 언어와 맞는 커스텀 표시 문자열을 사용한다.
- 실제 파일 input은 접근 가능하게 유지하고 숨김 처리만 한다.

### P2-9. 제목 구조가 과밀함

- 페이지 H1 외에 같은 수준 H2가 40개 이상이다.
- 큰 업무 영역과 내부 카드가 모두 H2라 화면 읽기 순서가 평평하다.

수정:

- H1: 파트너 이름
- H2: Approval, Work, Bookings, Money, History
- H3: 각 영역 내부 카드
- 장식용 카드 제목은 heading이 아닌 strong/label을 사용한다.

### P2-10. 재무 문구가 운영자에게 회계 의미를 충분히 설명하지 못함

- `Available / liability`, `Current balance`, `Wallet clear`가 동시에 보여 차이를 이해하기 어렵다.

수정:

- `Partner wallet balance`, `Amount owed by Partner`, `Amount owed to Partner`, `Withdrawable now` 네 개로 재정의한다.
- `Withdrawable now`를 계산할 수 없으면 `Not calculated`로 보여주고 0으로 만들지 않는다.

## 7. P3 시각 다듬기

1. 큰 카드 안의 여백이 많아 정보량이 적은데도 페이지가 길어진다. 빈 상태 카드의 세로 패딩을 줄인다.
2. 상단 주요 행동과 위험 행동이 같은 줄의 작은 pill 형태라 우선순위가 약하다. 기본 행동 1개, 보조 행동, `More` 메뉴로 재배치한다.
3. 파스텔 상태 카드가 많아 색 의미가 희석된다. 색은 `blocked / needs review / ready / unavailable` 네 의미에만 쓴다.

## 8. 권장 정보 구조

새 라우트를 만들 필요 없이 기존 작업 공간을 재사용한다.

| 운영 목적 | 권장 진입점 | 내용 |
|---|---|---|
| 빠른 판단 | `/partners/[id]` | 파트너 헤더, 미해결 행동, 현재 근무 가능 여부, 최근 활동 |
| 승인·프로필 | `?section=dossier&dossier=approval` | 필수 신원, KYC, 서비스 승인, 수정 요청 |
| 근무 준비 | `?section=access&access=readiness` | 서비스, 위치, 앱 도달, 스케줄, availability |
| 예약 증거 | `?section=bookings&bookings=journey` | 예약 목록과 선택한 예약의 증거 |
| 재무 | `?section=dossier&dossier=finance` | 지갑, 출금, 정산, payout, 세금; 권한별 읽기/행동 분리 |
| 기록·제어 | `?section=control&control=records` | 노트, 신고, 계정 제어, 타임라인 |
| 기술 진단 | `?section=access&access=diagnostics` | Developer/System 권한 전용 |

`section=full` 처리 권장안:

1. 기존 링크 호환을 위해 경로는 당장 제거하지 않는다.
2. 긴 전체 기록 대신 위 6개 작업 공간의 상태·미해결 수·마지막 업데이트만 보여준다.
3. 다음 버전에서 기본 보기로 리다이렉트해도 되는지 사용 로그로 확인한다.

## 9. 기본 보기 목표 화면

```text
An Pham · Partner set offline · Ho Chi Minh City
[Contact Partner] [Open chat] [More actions]

Action required (5)
1. KYC — 3 documents missing                [Request documents]
2. Service — payout rule missing             [Open service rule]
3. Location — 28h old, policy ≤ 90m          [Request refresh]
4. App — no reachable device                 [Send app reminder]
5. Profile — legal name and public fields    [Review profile]

Can this Partner work now?
[Approval blocked] [No bookable service] [Partner set offline] [Wallet: no debt]

Recent activity
- Last booking cancelled · 5 Aug 16:23        [Open booking]
- Last location · 5 Aug 18:43
- Last operator note · None                   [Add note]

[Approval] [Work] [Bookings] [Money] [History]
```

## 10. 파트별 상세 수정 요건

| 파트 | 유지할 것 | 제거·축소할 것 | 반드시 추가할 것 |
|---|---|---|---|
| 헤더 | 이름, 전화, 도시, 현재 상태 | `Fast operations overview` 같은 내부 설명 | 마지막 업데이트, 연락, 채팅, More actions |
| Action required | 미해결 수, 원인, 링크 | 내부 세로 스크롤, 중복 상태 카드 | 우선순위, 담당 영역, 완료 조건, 직접 행동 |
| Profile & KYC | 필수 신원, 문서 증거, 결정 이력 | 번역·미디어 업로드의 기본 펼침 | `Request documents`, 필수/선택 구분, 파트너에게 보일 안내 미리보기 |
| Work readiness | 서비스, 위치, 앱, availability | 정보성 `No action` 행을 미해결 표에 혼합 | “지금 예약 가능?” 단일 결론, 기준 시각, 서비스 규칙 링크 |
| Bookings | 최근 예약과 핵심 상태 | 7열 전체 증거 표, 행 안 전체 채팅 | 선택 예약 상세 패널, 마지막 채팅 요약, 복사 가능한 ID |
| Reviews | 고객 리뷰/파트너 평가 분리 | 0건일 때 두 개의 큰 빈 표 | 0건 한 줄, 있으면 최신 3건만 |
| Money | 지갑·출금·지급 상태 | 비차단 빈 카드의 기본 펼침 | 금액 방향, 권한/로드 상태, 지급 가능 여부와 이유 |
| Reports & controls | 감사 사유, 타임라인 | 보고서 작성·제재 적용 폼의 항상 펼침 | `Create report`, `Apply control` 명시적 모드와 확인 단계 |
| Notes | 빠른 프리셋과 감사 기록 | 전폭 보라색 CTA | 작성자·시각·연결 업무, 저장 후 성공 알림 |
| Diagnostics | 별도 권한과 온디맨드 링크 | 일반 운영 화면의 기술 용어 | 데이터 출처·진단 시각, 읽기 전용 표시 |

## 11. 운영 문구 교체안

| 현재 | 권장 |
|---|---|
| Open full partner record | Open partner workspaces |
| Fast operations overview | Operational summary |
| Current partner status | Can this Partner work now? |
| Profile draft (KYC) | KYC not submitted |
| Taken offline by an operator | Partner set offline |
| Payout: DEFERRED | Not eligible yet — no payable earning |
| Payout gate is clear or deferred. | No payout hold; eligibility starts after the first payable earning. |
| Wallet: Clear | No cash-fee debt |
| App access: Not tracked | No app activity data |
| Filter all booking records | Open booking workspace |
| Open all finance records | Open finance workspace |
| No profile evidence found (agreement) | No agreement acceptance recorded |
| Review postponed (tax optional) | Not required for current Vietnam MVP |
| Hold Partner audit_bo? | Hold An Pham’s account? |

## 12. 접근성·반응형 요구사항

1. 확인 흐름 진입 시 첫 입력 또는 제목에 포커스가 있어야 한다.
2. 확인 다이얼로그를 쓸 경우 배경 포커스를 막고 Escape와 포커스 복귀를 지원한다.
3. 작은 pill 링크를 주요 행동 버튼으로 쓰지 말고 최소 44×44px 목표를 적용한다.
4. 내부 세로 스크롤 표를 제거한다. 필요한 가로 스크롤은 영역 이름, 포커스 표시, 열 고정으로 명확히 한다.
5. 1024px에서 페이지 자체의 가로 스크롤 없이 핵심 결정과 행동이 보여야 한다.
6. 200% 확대에서 헤더 행동, 상태 배지, 폼이 겹치지 않아야 한다.
7. 색 없이도 `Blocked`, `Needs review`, `Ready`, `No data`가 텍스트로 구분되어야 한다.
8. 라이트·다크 모드의 일반 텍스트 4.5:1, 큰 텍스트 3:1 대비를 자동 검사한다.
9. heading 계층과 landmark를 스크린리더로 검증한다.
10. 파일 선택, 미디어 미리보기, 삭제 버튼에 파일 유형과 대상 이름이 포함된 접근 가능한 이름을 둔다.

## 13. 구현 순서

### 1단계 — 신뢰와 안전

- API 결과를 `empty / forbidden / error`로 분리
- 상태 문구를 도메인별 매핑으로 교체
- 고위험 행동 확인 패턴과 포커스 수정
- 권한 없는 행동 숨김/읽기 전용 처리

### 2단계 — 정보 구조 단순화

- 기본 보기를 운영 지휘 화면으로 축소
- `section=full`을 작업 공간 색인으로 변경
- 기존 `dossier / access / bookings / control` 링크 재사용
- 중복 `Needs action / Current status` 통합

### 3단계 — 표와 빈 상태

- 예약 증거 표를 요약 목록 + 상세 패널로 변경
- 파트너 상세에만 내부 세로 스크롤 제거
- 0건 비차단 영역 접기
- 상단 고정 업무 탭 추가

### 4단계 — 문구·접근성·테마 검증

- 운영 문구 교체
- 1024px, 1280px, 1440px와 200% 확대 검수
- 키보드·스크린리더·다크 모드 대비 검수

## 14. Codex 수정 기준

다음 기준을 모두 만족해야 완료로 본다.

- [ ] 권한 없음·API 실패가 `Clear`, `Ready`, `0건`으로 표시되지 않는다.
- [ ] `MANUAL_OFFLINE`은 실제 주체에 맞게 “Partner set offline”으로 표시된다.
- [ ] KYC `DRAFT`가 “Profile draft”로 표시되지 않는다.
- [ ] payout `DEFERRED`가 원인과 함께 설명된다.
- [ ] 기본 보기 첫 화면에 가장 중요한 미해결 행동과 직접 실행 링크가 있다.
- [ ] 기본 보기의 자동 `Current filters / All records` 배지를 제거한다.
- [ ] `section=full`이 15,000px 장문 상세를 한 번에 렌더링하지 않는다.
- [ ] `Needs action` 5개가 내부 세로 스크롤 없이 보인다.
- [ ] 예약 목록은 1024px에서 핵심 열이 잘리지 않는다.
- [ ] 삭제·승인·거절·계정 제어는 일관된 확인 흐름을 사용한다.
- [ ] 확인 흐름에 초기 포커스, 취소, 포커스 복귀가 있다.
- [ ] 운영자 권한에 맞지 않는 수정·재무 행동이 노출되지 않는다.
- [ ] 빈 기록, 권한 없음, 로드 실패가 서로 다른 상태로 보인다.
- [ ] 새 디자인 시스템·새 상태 추론기·새 라우트를 추가하지 않는다.
- [ ] 기존 NestJS 업무 규칙과 감사 로그 권위를 바꾸지 않는다.

## 15. 검증 결과

실행한 테스트:

```text
npm.cmd run test --workspace @massage-vn/admin-web --
  app/partners/[id]/page.spec.tsx
  app/partners/[id]/partner-detail-fast-overview.spec.tsx
  app/partners/[id]/partner-detail-operational-status-model.spec.ts
  app/partners/[id]/partner-detail-operational-status-section.spec.tsx
  app/partners/[id]/partner-detail-document-media-section.spec.tsx
  app/partners/[id]/partner-detail-reports-controls-section.spec.tsx
  components/confirm-dialog.spec.tsx
```

- 결과: 7개 파일, 45개 테스트 전부 통과
- 해석: 현재 구현 계약은 유지되고 있으나, 잘못된 상태 문구와 긴 전체 화면 구조도 테스트가 기대하는 상태다. 개선 시 테스트 기대값을 함께 바꿔야 한다.
- 보호 영역 변경: 없음
- 소스 코드 변경: 없음

## 16. 증거 한계

- 실제 로그인 세션의 감사용 fixture 한 건을 검수했다.
- 브라우저 캡처는 1280×720 기준이다. 사용한 브라우저가 뷰포트 변경을 지원하지 않아 1024px 동작은 CSS와 코드로 추가 검토했다.
- 스크린리더 실제 낭독, 200% 확대, 저속 네트워크, 권한별 계정, 403/500 주입은 실행하지 않았다.
- 승인, 거절, 계정 중지, 제재, 삭제 등 실제 데이터를 바꾸는 행동은 제출하지 않았다.
- 다크 모드는 대표 확인 화면을 시각 검수했으며, 전체 페이지의 자동 WCAG 대비 측정은 별도 테스트가 필요하다.

## 17. 캡처 증거

### 기본 보기

#### 01. 상단과 운영 카드 — 개선 필요

![기본 보기 상단](./01-default-overview.png)

자동 범위 배지의 의미가 실제 상태와 맞지 않고, 9개 카드가 모두 같은 중요도로 보인다.

#### 02. 운영 카드 하단과 신원·예약 요약 — 개선 필요

![기본 보기 신호와 요약](./02-default-signals.png)

Identity와 Booking command는 읽기 쉽지만 카드 높이가 크고, 상태 카드와 다시 같은 정보를 반복한다.

#### 03. 지급 준비와 다음 행동 — 개선 필요

![기본 보기 다음 행동](./03-default-action.png)

다음 행동 문장은 있으나 `Detail workspaces`, `Cash settlements`, `Payout batches`가 현재 문제 해결 순서와 직접 연결되지 않는다.

### 전체 기록

#### 04. 상단과 Needs action — 위험

![전체 기록 상단](./04-full-needs-action.png)

5개 미해결 항목 중 일부만 보이며 표 안에서 다시 스크롤해야 한다.

#### 05. Current status와 Profile 진입 — 개선 필요

![현재 상태와 프로필](./05-full-status-profile.png)

Needs action을 다시 카드 5개로 반복한다. Money 값은 방향과 사용 가능 여부가 불명확하다.

#### 06. 프로필 필드와 번역 — 개선 필요

![프로필과 번역](./06-full-profile-translations.png)

승인 증거보다 번역 편집 폼이 크게 차지한다.

#### 07. KYC, 보류, 공개 미디어 — 위험

![KYC와 공개 미디어](./07-full-kyc-media-history.png)

자료가 없는데 승인과 보류 버튼의 비활성 이유와 가능한 다음 행동이 충분히 설명되지 않는다.

#### 08. 재제출 안내와 Work 진입 — 개선 필요

![재제출 안내와 근무 준비](./08-full-resubmission-work.png)

0건 재제출 안내가 큰 표를 차지하고 바로 다음 영역에서도 같은 문제 수를 반복한다.

#### 09. Work readiness 표 — 위험

![근무 준비 표](./09-full-readiness-pricing.png)

내부 세로 스크롤 때문에 7개 행을 한 흐름으로 볼 수 없고, availability 주체 문구가 실제 데이터와 반대다.

#### 10. 서비스 가격 준비 — 개선 필요

![서비스 가격 준비](./10-full-pricing-location.png)

문제 원인은 명확하지만 정확한 payout rule을 만드는 직접 행동이 없다.

#### 11. 위치·약관·예약 진입 — 보통

![위치와 약관](./11-full-location-agreements-bookings.png)

두 개 참조 카드는 비교적 읽기 쉽다. 약관 0건 문구는 `No profile evidence` 대신 약관 도메인에 맞춰야 한다.

#### 12. 예약 증거 번들 — 위험

![예약 증거 번들](./12-full-booking-bundles.png)

7열 표의 오른쪽 내용과 행동이 잘리고 한 행의 텍스트가 지나치게 길다.

#### 13. 예약·채팅 기록 — 위험

![예약과 채팅 기록](./13-full-booking-chat-records.png)

표 한 셀 안의 채팅 창이 행 높이를 크게 늘리고 스캔을 방해한다.

#### 14. 리뷰 0건 — 개선 필요

![리뷰 빈 상태](./14-full-reviews-wallet.png)

0건인데 고객 리뷰와 파트너 평가가 각각 큰 빈 표로 렌더링된다.

#### 15. 지갑 요약 — 개선 필요

![지갑 요약](./15-full-wallet-detail.png)

금액은 보이지만 “현재 잔액, 가용/부채, 음수 미수금”의 관계와 출금 가능액이 불명확하다.

#### 16. 수동 조정·출금 요청 — 개선 필요

![수동 조정과 출금 요청](./16-full-wallet-adjustments-withdrawals.png)

0건 표가 큰 면적을 차지하며 권한 없음과 실제 0건을 구분하지 않는다.

#### 17. Payout operations — 보통

![지급 운영](./17-full-payout-operations.png)

상태 묶음은 좋지만 `DEFERRED`의 원인과 “출금 요청 clear”의 관계가 한눈에 연결되지 않는다.

#### 18. 출금·세금·최근 지급 기록 — 개선 필요

![출금과 세금](./18-full-payout-records.png)

현재 승인과 무관한 빈 정보가 페이지 절반 이상을 차지한다.

#### 19. 신고 작성과 계정 제어 — 위험

![신고와 계정 제어](./19-full-operations-controls.png)

신고 작성 폼이 항상 펼쳐져 있고, 일반 운영 기록과 제재 행동의 경계가 약하다.

#### 20. 수동 계정 제어 — 위험

![수동 계정 제어](./20-full-manual-control-reports.png)

`Apply account control`이 상세 화면 안에서 바로 실행 가능하며 별도 확인 단계가 없다.

#### 21. 운영 노트와 타임라인 진입 — 보통

![운영 노트](./21-full-notes-timeline.png)

노트 작성 의도는 좋지만 저장 버튼이 지나치게 강하고, 현재 작업과 연결할 방법이 없다.

#### 22. 최근 타임라인과 시스템 진단 — 양호

![타임라인과 시스템 진단](./22-full-timeline-diagnostics.png)

최근 이벤트 3개 요약과 진단 분리는 이 페이지에서 가장 운영 친화적인 패턴이다.

### 고위험 행동과 테마

#### 23. 거절 확인 — 위험

![거절 확인](./23-reject-confirmation.png)

내부 ID가 제목에 노출되고 이유 입력·취소·최종 버튼이 오른쪽에 압축되어 있다.

#### 24. 계정 중지 확인 — 위험

![계정 중지 확인](./24-block-confirmation.png)

시각적으로는 확인 카드지만 `alertdialog` 역할과 실제 포커스 동작이 맞지 않는다.

#### 25. 다크 모드 확인 화면 — 보통

![다크 모드 확인](./25-dark-mode-confirmation.png)

테마 토큰은 일관되지만 보조 문구와 비활성/위험 상태의 대비를 자동 측정해야 한다.

