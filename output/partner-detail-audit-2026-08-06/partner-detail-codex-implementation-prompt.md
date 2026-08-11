# 파트너 상세 페이지 개선용 Codex 실행 프롬프트

아래 `실행 프롬프트` 전체를 새 Codex 작업에 그대로 붙여 넣는다. 이 문서는 단순 참고용 요구사항이 아니라, 코드 수정·화면 검증·테스트까지 포함하는 실행 지시서다.

---

## 실행 프롬프트

당신은 `C:\dev\massage-on-demand-vn`의 HANDS 관리자 웹을 수정하는 주 개발자다. 프로그래머 관점이 아니라 실제 운영자, 파트너 승인 담당자, 고객지원 담당자, 정산 담당자가 빠르고 안전하게 판단할 수 있는 화면을 만들어라.

다음 두 화면을 개선한다.

- `http://localhost:3101/partners/audit_booking_list_resolved_provider_profile`
- `http://localhost:3101/partners/audit_booking_list_resolved_provider_profile?section=full`

먼저 아래 파일을 끝까지 읽고 현재 코드와 대조한 뒤 작업하라.

1. `C:\dev\massage-on-demand-vn\AGENTS.md`
2. `C:\dev\massage-on-demand-vn\output\partner-detail-audit-2026-08-06\partner-detail-default-full-audit-report.md`
3. `C:\dev\massage-on-demand-vn\apps\admin_web\app\partners\[id]\page.tsx`
4. 해당 경로에서 호출하는 파트너 상세 컴포넌트, 상태 모델, 서버 액션, 테스트
5. `C:\dev\massage-on-demand-vn\apps\admin_web\lib\admin-api.ts`
6. `C:\dev\massage-on-demand-vn\apps\admin_web\lib\admin-copy.ts`
7. 파트너 상세에 적용되는 기존 Admin UI 컴포넌트와 `globals.css`

보고서의 줄 번호는 최초 분석 당시 기준이므로 현재 코드에서 다시 검색해 확인하라. 보고서 결론을 무조건 복사하지 말고, 코드가 이미 개선된 부분은 유지하고 아직 남은 문제만 수정하라.

### 목표

기본 경로는 파트너의 현재 운영 상태와 다음 행동을 30초 안에 판단할 수 있는 `운영 지휘 화면`으로 만든다. `section=full`은 15,000px 이상의 전체 기록을 한 번에 쌓는 화면이 아니라, 기존 업무별 작업 공간으로 이동하는 `작업 공간 색인`으로 축소한다.

이번 작업은 디자인 전면 교체가 아니다. 기존 디자인 토큰, `AdminSurface`, 기존 표·상태·버튼·링크 컴포넌트와 이미 존재하는 `dossier / access / bookings / control` 작업 공간을 재사용한다.

### 절대 조건

- 새 라우트, 새 디자인 시스템, 새 상태 추론 프레임워크, 새 라이브러리를 추가하지 않는다.
- user-facing 문구는 `Provider`가 아니라 `Partner`를 사용한다. 내부 타입·API 이름은 기존 계약을 유지한다.
- API, 데이터베이스, 지갑, 지급, 정산, 매칭 규칙과 감사 로그의 권위를 변경하지 않는다.
- 프런트 권한 처리는 설명성과 오작동 방지용이며 서버 권한 검사를 대체하지 않는다.
- 권한 없음, API 실패, 네트워크 실패를 정상적인 빈 상태 또는 `Clear / Ready / 0건`으로 표시하지 않는다.
- 금액을 계산할 수 없을 때 0으로 만들지 않는다. `Not calculated` 또는 원인을 표시한다.
- 파괴적 행동을 실제 fixture에 제출하지 않는다. UI·테스트로 검증한다.
- 현재 작업과 무관한 dirty worktree 변경을 되돌리거나 덮어쓰지 않는다.
- 보호 영역을 변경해야 할 것 같으면 먼저 프런트 안에서 해결 가능한지 확인한다. 정말 필요하다면 임의로 확장하지 말고 최종 보고서에 정확한 필요성과 검증 범위를 적는다.
- 구현 전에 현재 상태를 캡처하고, 구현 후 같은 상태·같은 뷰포트로 다시 캡처해 비교한다.

## 1단계 — 신뢰와 안전 문제를 먼저 수정

### 1. API 결과 상태 분리

전체 보기의 재무·출금·지갑 조정 등 추가 조회가 fallback 빈 배열을 반환해 오류를 숨기지 않게 수정한다.

- 기존 `adminGetResult` 또는 같은 코드베이스의 결과 상태 패턴을 재사용한다.
- 각 비동기 영역은 최소한 `loaded / empty / forbidden / error`를 구분한다.
- `forbidden`: `You do not have permission to view this financial data.`처럼 권한 부족을 명시한다.
- `error`: `Financial data could not be loaded. Pause this decision and retry.`처럼 판단 보류를 명시한다.
- `empty`: API 요청이 성공했고 실제 기록이 0개인 경우에만 사용한다.
- `forbidden / error`에서는 정상 상태 배지, `Clear`, `Ready`, `0 records`를 계산하지 않는다.
- 페이지 전체를 실패시키지 말고 해당 업무 영역에만 정확한 상태와 재시도 경로를 표시한다.

테스트에는 성공 빈 배열, 403, 500 또는 네트워크 오류가 서로 다른 최종 문구로 렌더링되는 경우를 포함한다.

### 2. 도메인별 상태 문구 분리

`partnerOperatingStatusLabel` 하나가 KYC, 가용성, 지급, 프로필 상태를 모두 번역하지 않게 한다. 기존 범용 함수를 더 복잡하게 확장하지 말고 사용 지점 가까이에 최소한의 도메인별 매핑을 둔다.

필수 결과:

| 문맥 | 원본 상태 | 표시 결과 |
|---|---|---|
| KYC | `DRAFT` | `KYC not submitted` 또는 실제 누락 수가 있으면 `{n} documents missing` |
| Availability | `MANUAL_OFFLINE` | `Partner set offline` |
| Payout | `DEFERRED` | 실제 원인을 포함한 문장. 해당 fixture에서는 `Not eligible yet — no payable earning` |
| Wallet | 양수 잔액 | `{amount} held for Partner`처럼 회계 방향이 드러나는 문장 |

각 상태는 가능하면 `결과 + 원인 + 기준 시각`을 보여준다. 테스트는 enum 매핑 함수만 검사하지 말고 운영자에게 보이는 최종 문장을 검증한다.

### 3. 권한별 노출과 읽기 전용 상태

현재 프로젝트가 사용하는 permission/category 체계를 재사용해 다음 영역을 실제 권한과 맞춘다.

- KYC 판단: `PARTNERS_KYC`
- 출금·정산: `FINANCE_SETTLEMENTS`
- 지갑 조정: `FINANCE_WALLET_ADJUSTMENTS`
- 리뷰 관련 기능: 기존 리뷰 권한 카테고리
- 시스템 진단: `DEVELOPER_SYSTEM`

권한이 없을 때 민감한 행동 버튼을 숨기거나 명확한 읽기 전용 상태로 표시한다. 권한이 없어서 숨긴 데이터를 `기록 없음`으로 표시하면 안 된다.

### 4. 고위험 행동 확인 패턴 통일

승인, 거절, 계정 중지, 지급 중지, 계정 제어, 공개 미디어 삭제를 조사해 영향도가 높은 행동에 일관된 확인 단계를 적용한다.

확인 화면에는 다음이 보여야 한다.

- 파트너 표시명
- 전체 ID는 보조 메타데이터 또는 복사 기능으로만 제공
- 실행 대상과 현재 상태
- 실행 후 상태
- 운영 및 고객/파트너에게 미치는 영향
- 필수 사유
- 필요한 경우 만료 시각
- 명확한 취소와 최종 실행 버튼

다이얼로그를 유지한다면 다음을 모두 구현한다.

- 올바른 `aria-labelledby`와 `aria-describedby`
- `aria-modal="true"`
- 진입 시 제목, 사유 입력 또는 안전한 취소 버튼에 초기 포커스
- 포커스 트랩
- Escape 취소
- 종료 후 원래 실행 버튼으로 포커스 복귀

이 접근성 동작을 현재 공통 다이얼로그에서 한 번 고치는 것이 모든 호출부의 중복 수정보다 작다면 공통 원인을 수정한다. 반대로 라우트 기반 확인 카드라면 `alertdialog` 역할을 억지로 사용하지 말고 일반 확인 페이지 의미에 맞춘다.

미디어 삭제는 대상 미리보기, 파일 유형, 취소, 최종 확인을 제공한다. 제목은 `Hold Partner audit_bo?` 같은 잘린 내부 ID 대신 실제 표시명을 사용한다.

## 2단계 — 정보 구조 단순화

### 5. 기본 경로를 운영 지휘 화면으로 재구성

첫 화면은 아래 순서를 사용한다.

1. 파트너 헤더
   - 표시명
   - 평문 현재 상태
   - 전화번호와 도시
   - 기본 행동 하나, 보조 행동, `More` 메뉴
2. `Action required`
   - 미해결 항목 최대 5개
   - 5개 이하는 내부 세로 스크롤 없이 모두 표시
   - 항목마다 담당 영역, 원인, 다음 행동, 완료 조건 표시
3. `Can work now?`
   - Approval
   - Service
   - Availability
   - Wallet
   - 각 항목을 `Ready / Blocked / Needs review / No data` 중 하나로 명시
4. 최근 활동 3건
5. 기존 업무별 작업 공간 진입점

`Needs action`과 `Current partner status`가 같은 숫자와 원인을 반복하지 않게 하나의 `Action required` 목록으로 합친다.

`PartnerDetailFastOverview`에서 tone이 사라지고 `MetricCard`가 텍스트를 추론해 붙이는 `Current filters / All records / Needs action` 같은 배지를 파트너 상세에서는 사용하지 않는다. 상태 배지가 필요하면 호출부에서 실제 업무 상태를 명시적으로 전달한다.

### 6. `section=full`을 작업 공간 색인으로 축소

기존 URL 호환을 위해 `section=full` 쿼리는 당장 삭제하지 않는다. 하지만 현재의 모든 컴포넌트 일괄 렌더링은 제거한다.

`section=full`에는 다음 작업 공간의 상태, 미해결 수, 마지막 업데이트, 이동 링크만 보여준다.

- Approval & profile → `?section=dossier&dossier=approval`
- Work readiness → `?section=access&access=readiness`
- Booking evidence → `?section=bookings&bookings=journey`
- Money → `?section=dossier&dossier=finance`
- History & controls → `?section=control&control=records`
- Diagnostics → `?section=access&access=diagnostics`, 개발자 권한 전용

버튼 문구 `Open full partner record`는 실제로 전체 기록을 열지 않으므로 `View partner work areas` 또는 `Open workspaces`로 바꾼다.

정적 조건상 도달할 수 없는 `isFullPartnerDetail` 분기가 있다면 호출 경로를 확인하고 삭제 또는 단순화한다. 추측성 추상화는 추가하지 않는다.

### 7. 고정 작업 탭

필요하면 기존 링크와 스타일을 이용해 최대 5개만 제공한다.

- Overview
- Approval
- Work
- Money
- History

현재 탭과 미해결 수만 표시한다. 새로운 복잡한 목차·내비게이션 시스템은 만들지 않는다.

## 3단계 — 각 업무 영역 정리

### 8. 경고를 실행 가능한 작업으로 변경

모든 미해결 항목은 다음 구조를 사용한다.

- 문제
- 운영 영향
- 담당 영역
- 다음 행동
- 완료 조건
- 마지막 업데이트 또는 기준 초과 시간

예시:

- 서비스 payout rule 누락 → 정확한 서비스/가격 조건이 채워진 기존 설정 화면 링크
- 앱 도달 불가 → 파트너에게 안내 전송 + 운영 노트 기록
- KYC 자료 누락 → `Request documents` 행동

실행 경로가 없는 정보는 `Needs action`으로 세지 말고 `Monitoring` 또는 `Information`으로 분리한다. 백엔드 전송 기능이 존재하지 않으면 가짜 동작을 만들지 말고 기존 연락/노트 흐름으로 연결한다.

### 9. 프로필 편집과 KYC 판단 분리

- `Identity evidence`와 승인 판단을 먼저 보여준다.
- 공개 프로필 콘텐츠와 번역 입력은 `Edit public profile`을 눌렀을 때만 펼친다.
- KYC 판단 권한과 고객 앱 공개 콘텐츠 편집 권한을 섞지 않는다.
- 파일 입력은 접근 가능한 실제 input을 유지하되 운영 UI 언어와 맞는 표시 문자열을 사용한다.

### 10. 예약 증거 구조 개선

기존 표의 첫 화면에는 다음 5개만 남긴다.

- Booking
- Status
- Partner role
- Amount
- Next action

고객 주소, 전체 채팅, 지급, 운영 증거는 기존 행 펼침, 상세 영역 또는 오른쪽 패널 패턴 중 코드베이스에 이미 있는 가장 작은 패턴을 재사용한다.

- 채팅은 기본 접힘
- 표에는 마지막 메시지 요약, 메시지 수, 마지막 시각만 표시
- `Booking / Customer / Chat` 링크는 하나의 `Open details` 진입점으로 정리
- 짧은 예약 ID와 서비스 시각을 함께 표시
- 전체 ID는 복사할 수 있게 제공
- 1024px에서 핵심 열이 잘리지 않아야 함

### 11. 재무 용어 정리

다음 네 개의 의미가 혼동되지 않게 표시한다.

- `Partner wallet balance`
- `Amount owed by Partner`
- `Amount owed to Partner`
- `Withdrawable now`

모든 금액 영역에 가능한 범위에서 `Updated`, `Source`, 적용 정책 또는 계산 불가 사유를 표시한다. 권한 부족과 로드 실패를 0원으로 렌더링하지 않는다.

### 12. 빈 상태와 표 스크롤 정리

- 파트너 상세에만 적용되는 내부 세로 스크롤을 제거한다. 다른 관리자 목록 화면의 표 동작을 전역으로 망가뜨리지 않는다.
- 비차단 0건 영역은 한 줄 요약으로 접는다.
- `No records`는 정상 빈 상태, 미수집, 권한 없음, 오류를 다른 문구로 구분한다.
- 실제 기록이 있을 때만 큰 표를 렌더링한다.
- 제목 계층은 H1 파트너 이름, H2 업무 영역, H3 내부 카드로 정리한다.
- 색은 `blocked / needs review / ready / unavailable` 의미에만 사용하고 텍스트 없이 색만으로 상태를 전달하지 않는다.

## 접근성·반응형 완료 조건

- 모든 주요 행동의 클릭/터치 목표가 최소 44×44px에 가깝게 확보된다.
- 1024px에서 페이지 자체의 가로 스크롤 없이 핵심 결정과 행동이 보인다.
- 1280px와 1440px에서도 정보 밀도와 줄바꿈을 확인한다.
- 200% 확대에서 헤더 행동, 상태 배지, 입력 폼이 겹치지 않는다.
- 다크 모드에서도 일반 텍스트 4.5:1, 큰 텍스트 3:1 대비를 만족한다.
- 키보드만으로 탭, 작업 링크, 확인 흐름, 취소, 복귀를 수행할 수 있다.
- 확인 흐름 종료 후 포커스가 실행 버튼으로 돌아온다.
- 표의 가로 스크롤이 필요하면 접근 가능한 영역 이름, 뚜렷한 포커스, 핵심 열 유지가 있어야 한다.
- 로딩, 정상 빈 상태, 권한 없음, 오류 상태를 스크린리더도 구분할 수 있다.

## 구현 방법

1. 먼저 `git status --short`로 기존 변경을 확인하고 사용자 변경을 보존한다.
2. 관련 컴포넌트와 모든 호출부를 검색해 공통 원인을 확인한다.
3. 짧은 구현 계획을 작성한다.
4. P1 신뢰·안전 문제부터 최소 변경으로 수정한다.
5. 기존 컴포넌트와 작업 공간을 재사용해 정보 구조를 단순화한다.
6. 변경한 동작마다 가장 가까운 기존 테스트를 업데이트하거나 최소 테스트를 추가한다.
7. 각 단계 후 관련 테스트를 실행하고 실패 원인을 해결한다.
8. 로그인된 브라우저가 제공되면 두 URL을 직접 열어 실제 렌더링과 문구를 검수한다.
9. 구현 전·후 동일 화면을 같은 뷰포트에서 캡처해 비교한다.
10. 최종 diff를 검토해 무관한 변경, 중복 추상화, 죽은 코드, 임시 문구를 제거한다.

## 필수 검증

최소한 다음 기존 테스트를 실행하고, 변경한 상태·권한·확인 흐름 테스트를 함께 추가/수정한다.

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- `
  "app/partners/[id]/page.spec.tsx" `
  "app/partners/[id]/partner-detail-fast-overview.spec.tsx" `
  "app/partners/[id]/partner-detail-operational-status-model.spec.ts" `
  "app/partners/[id]/partner-detail-operational-status-section.spec.tsx" `
  "app/partners/[id]/partner-detail-document-media-section.spec.tsx" `
  "app/partners/[id]/partner-detail-reports-controls-section.spec.tsx" `
  "components/confirm-dialog.spec.tsx"

npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run lint --workspace @massage-vn/admin-web
npm.cmd run verify:scope -- -Scope admin
```

시간이나 기존 저장소 오류 때문에 일부 검증이 불가능하면 생략 사실을 숨기지 말고 명령, 결과, 원인을 구분해 보고한다. 이번 변경으로 발생한 실패와 기존 실패를 구분한다.

## 반드시 추가하거나 갱신할 테스트 계약

- 성공한 빈 결과와 403/500 실패가 다른 UI 문구로 보인다.
- 권한 없음 또는 오류가 `Clear / Ready / 0 records`로 표시되지 않는다.
- KYC `DRAFT` 최종 문구가 `Profile draft`가 아니다.
- Availability `MANUAL_OFFLINE` 최종 문구가 `Taken offline by an operator`가 아니다.
- Payout `DEFERRED`가 실제 원인을 설명한다.
- 파트너 상세 metric에 `Current filters / All records`가 나타나지 않는다.
- `section=full`이 기존 장문 상세 컴포넌트를 전부 렌더링하지 않고 작업 공간 링크를 제공한다.
- 위험 행동 확인 제목에 표시명이 있고 잘린 내부 ID가 없다.
- 확인 흐름의 초기 포커스, Escape 취소, 포커스 복귀를 검증한다.
- 미디어 삭제가 확인 없이 서버 액션을 제출하지 않는다.
- 권한이 없는 KYC·재무·지갑 조정 행동이 실행 가능하게 노출되지 않는다.
- 기본 화면의 5개 이하 미해결 항목이 내부 세로 스크롤 없이 렌더링된다.

## 완료 판정 체크리스트

- [ ] 권한 없음, 로드 오류, 정상 빈 상태가 명확히 다르다.
- [ ] 잘못된 KYC·가용성·지급·지갑 문구가 제거됐다.
- [ ] 기본 화면 첫 뷰포트에서 미해결 문제와 다음 행동을 찾을 수 있다.
- [ ] `Needs action`과 상태 요약의 중복이 제거됐다.
- [ ] 파트너 상세 자동 범위 배지가 제거됐다.
- [ ] `section=full`이 15,000px 장문 기록을 한 번에 렌더링하지 않는다.
- [ ] 기존 작업 공간 URL을 재사용한다.
- [ ] 예약 증거는 1024px에서 핵심 열이 잘리지 않는다.
- [ ] 프로필 콘텐츠 편집과 KYC 판단이 분리됐다.
- [ ] 재무 금액의 방향과 계산 가능 여부를 이해할 수 있다.
- [ ] 승인·거절·중지·삭제·계정 제어가 영향도에 맞는 확인 절차를 사용한다.
- [ ] 확인 흐름이 키보드와 스크린리더 기본 요구를 만족한다.
- [ ] 0건 영역이 불필요하게 큰 표를 만들지 않는다.
- [ ] 라이트·다크 모드와 1024/1280/1440px에서 검수했다.
- [ ] 새로운 라우트·디자인 시스템·상태 프레임워크·의존성을 추가하지 않았다.
- [ ] 관련 테스트, 타입 검사, 린트와 admin scope 검증 결과를 기록했다.

## 최종 응답 형식

완료 후 다음 순서로 짧고 구체적으로 보고하라.

1. 운영자가 체감하는 변경 결과
2. 변경한 파일과 각 파일의 역할
3. P1/P2 항목별 해결 여부
4. 실행한 명령과 통과/실패/생략 결과
5. 구현 전·후 화면 캡처 경로
6. 보호 영역 변경 여부
7. 남은 위험과 이유
8. 다음 한 가지 권장 작업

테스트를 통과하지 않았거나 화면을 직접 확인하지 못했다면 `완료`라고 표현하지 마라.

---

## 사용 메모

- 이 프롬프트는 한 번의 대규모 시각 리뉴얼이 아니라 신뢰·안전 → 정보 구조 → 세부 화면 순서로 작업하도록 설계됐다.
- 범위가 너무 크면 Codex가 임의로 요구사항을 삭제하게 하지 말고, 같은 체크리스트를 유지한 채 1단계부터 순차 완료하게 한다.
- 최초 권장 범위는 1단계와 `section=full` 축소까지다. 이 두 부분이 운영 판단 오류와 페이지 구조 문제를 가장 크게 줄인다.
