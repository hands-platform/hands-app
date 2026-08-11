# Partners 개선 구현용 Codex 프롬프트

아래 내용을 새 Codex 작업에 그대로 붙여 넣어 사용한다.

---

## 작업 요청

`C:\dev\massage-on-demand-vn` 프로젝트의 관리자 웹 `http://localhost:3101/partners`를 실제 운영자 관점에서 개선해라.

먼저 다음 감사 보고서를 끝까지 읽고, 보고서의 증거와 현재 코드를 대조한 다음 수정하라.

- 감사 보고서: `C:\dev\massage-on-demand-vn\output\partners-post-implementation-audit-2026-08-08\partners-post-implementation-audit.md`
- 화면 증거 폴더: `C:\dev\massage-on-demand-vn\output\partners-post-implementation-audit-2026-08-08`

작업 대상은 `/partners` 내부의 다음 네 운영 모드다.

- Directory
- Approvals
- Onboarding blockers
- Wallet debt

이번 작업은 1440px 이상 데스크톱 운영 환경만 대상으로 한다. 1024px 이하 반응형·모바일 화면은 분석하거나 수정하지 마라. 기존 모바일 코드를 일부러 삭제할 필요도 없다.

## 작업 원칙

1. 먼저 현재 코드와 모든 관련 호출부를 추적한 뒤 root cause를 수정하라.
2. 기존 helper, 타입, 컴포넌트, 테스트 패턴을 우선 재사용하라.
3. 새 UI 라이브러리, 상태 관리 라이브러리, export service, drawer, 범용 추상화는 추가하지 마라.
4. 이미 잘 동작하는 서버 페이지네이션, 전체 건수, current-page CSV 범위, Wallet debt 기준 잔액, 내부 탭, 접근성 속성을 깨뜨리지 마라.
5. 보고서와 현재 코드가 다르면 현재 코드와 실제 브라우저 동작을 기준으로 판단하고 차이를 작업 결과에 기록하라.
6. 사용자가 만든 기존 변경과 무관한 dirty worktree 파일은 수정하거나 되돌리지 마라.
7. 상태나 blocker의 의미를 추측하지 마라. 기존 enum, API 응답, 정책 helper에서 근거를 찾고, 근거가 없는 owner/action 문구는 만들지 마라.
8. 한 번에 전면 재설계하지 말고 아래 P1부터 완료한 뒤 P2를 처리하라.

## 구현 전 확인

다음 파일과 관련 호출부를 먼저 읽어라. 경로가 변경됐다면 `rg`로 현재 위치를 찾아라.

- `apps/api/src/admin/admin.service.ts`
- `apps/admin_web/lib/admin-navigation.ts`
- `apps/admin_web/lib/admin-nav-match.ts`
- `apps/admin_web/components/admin-workspace-header.tsx`
- `apps/admin_web/components/admin-directory-filter-form.tsx`
- `apps/admin_web/app/partners/partner-filter-board.tsx`
- `apps/admin_web/app/partners/partner-filters.ts`
- `apps/admin_web/app/partners/partner-master-list-section.tsx`
- `apps/admin_web/app/partners/partner-master-row.ts`
- `apps/admin_web/app/api/admin/partners/export/route.ts`

특히 shared form이나 navigation matcher를 수정하기 전에 모든 caller를 검색해 다른 관리자 페이지에 미치는 영향을 확인하라.

## P1 구현 요구사항

### 1. Directory Oldest 정렬 의미 수정

현재 Directory 기본 `Newest`는 partner의 `user.createdAt desc`를 사용하지만 `Oldest`는 `updatedAt asc`를 사용하는 것으로 감사됐다.

수정 요구:

- Directory의 `Newest`와 `Oldest`가 같은 가입일 필드의 내림차순/오름차순이 되게 한다.
- `Newest`: `user.createdAt desc`
- `Oldest`: `user.createdAt asc`
- Approval queue에서 실제 승인 제출 시각을 사용하는 별도 정렬은 변경하지 않는다.
- API 테스트에 “Oldest가 가입일 오름차순을 사용한다”는 회귀 검증을 추가한다.

완료 기준:

- Directory에서 Oldest를 선택했을 때 가장 오래 가입한 파트너부터 나타난다.
- 전체 건수와 서버 페이지네이션이 그대로 유지된다.
- Approval queue 정렬 결과는 변하지 않는다.

### 2. Partner navigation을 하나의 workspace 구조로 통일

현재 좌측 메뉴에는 `Partner Approvals`, `Partner Directory`, `Unsettled Partners`가 있고 내부 탭에는 네 모드가 있어 중복·누락·명칭 불일치가 발생한다. Onboarding blockers에서는 Partner Operations 그룹과 breadcrumb가 현재 위치를 잃는다.

권장 구조:

```text
Partner Operations
└─ Partner directory
   ├─ Directory
   ├─ Approvals
   ├─ Onboarding blockers
   └─ Wallet debt
```

수정 요구:

- 좌측 메뉴에는 `/partners` workspace 진입점 하나를 사용한다.
- `review=approval-pending`, `review=unapproved`, `review=unsettled`에서도 같은 좌측 항목이 활성화되어야 한다.
- 세부 모드 전환은 기존 내부 탭이 담당한다.
- `Unsettled Partners` 명칭은 모든 사용자 노출 위치에서 `Wallet debt`로 통일한다.
- breadcrumb는 최소한 Partner Operations와 Partner directory의 관계를 유지하고 현재 내부 모드를 식별할 수 있어야 한다.
- `/partners/overview`의 메뉴 라벨이 상위 그룹명과 같은 `Partner Operations`라면 `Partner overview`로 바꾼다.
- 기존 deep link와 query URL은 깨뜨리지 않는다.

완료 기준:

- 네 내부 모드 어느 곳에서도 Partner Operations 그룹이 접히거나 active context가 사라지지 않는다.
- 좌측 메뉴와 내부 탭이 같은 기능을 서로 다른 이름으로 중복 노출하지 않는다.
- `/partners?review=unapproved`에서도 올바른 breadcrumb와 좌측 active 상태가 보인다.

### 3. CSV upstream 실패와 정상 0건 분리

현재 export route에서 upstream 조회 실패가 fallback `[]`로 처리되어 정상 0건 CSV처럼 보일 수 있다.

수정 요구:

- 프로젝트에 이미 있는 result-aware admin fetch 패턴을 찾아 재사용한다.
- partner list 또는 필요한 policy 조회가 실패하면 CSV 200을 반환하지 않는다.
- 실패 시 명확한 non-2xx 응답과 운영자가 이해할 수 있는 오류 메시지를 반환한다.
- 정상적으로 결과가 0건인 경우와 upstream 실패를 구분한다.
- 기존 current-page export 범위와 관련 응답 메타데이터는 유지한다.
- 개인정보가 포함된 실제 CSV를 작업 결과에 첨부하거나 출력하지 않는다.

완료 기준:

- upstream 500/timeout 테스트는 non-2xx를 기대한다.
- 정상 0건 테스트는 실패와 다른 정상 응답을 기대한다.
- 기존 current-page CSV 테스트가 통과한다.

### 4. Onboarding blockers를 Next action 중심으로 변경

현재 행의 `verification review`, `KYC MISSING`, `+N more`는 상태만 보여주고 다음 담당자와 행동을 설명하지 못한다.

수정 요구:

- 새 칼럼을 추가해 표 폭을 늘리기보다 기존 `Top blockers` 영역을 `Next action` 중심으로 재구성한다.
- 기존 blocker/status/policy 데이터에 근거가 있을 때만 다음 형태로 표현한다.
  - `Partner: upload ID front`
  - `Operator: review submitted KYC`
  - `Operator: lift account hold`
- 첫 항목은 가장 우선적인 담당자+행동을 표시하고 나머지는 `+N more`로 유지한다.
- owner를 코드상 확정할 수 없는 경우 거짓으로 Operator 또는 Partner를 지정하지 말고 `Review required: ...` 같은 중립적이고 사실적인 문구를 사용한다.
- Stage 셀의 `Verification Verification ...` 같은 반복 문구를 제거한다.
- 상세 진입 CTA는 `Review blockers`를 유지하되 row의 Next action과 충돌하지 않게 한다.
- mapping 로직은 기존 row/helper 위치에 최소한으로 두고, 한 번만 쓰는 범용 framework를 만들지 않는다.

완료 기준:

- 가능한 모든 행에서 프로필을 열기 전에 다음 담당자와 행동을 알 수 있다.
- 근거 없는 owner 추론이 없다.
- 같은 단어가 한 셀에서 반복되지 않는다.
- 1440px에서 표의 가로 스크롤이 생기지 않는다.

## P2 구현 요구사항

### 5. 필터 URL 정규화

현재 native GET form 제출 후 다음처럼 빈 값과 기본값이 주소에 남는다.

```text
/partners?sort=newest&q=&providerStatus=&activity=&verification=&kyc=&bookingFlow=completed-work
```

수정 요구:

- 모든 `AdminDirectoryFilterForm` caller를 확인한다.
- shared component에서 안전하게 해결할 수 있으면 한 번만 수정한다.
- 다른 페이지마다 기본 query 규칙이 달라 shared 수정이 위험하면 partner form에만 기존 `buildPartnerListHref` 규칙을 재사용한다.
- 빈 파라미터와 기본 `sort=newest`를 제거한다.
- 현재 review mode는 보존한다.
- 필터 링크 공유, 새로고침, 뒤로가기 동작을 유지한다.

완료 예:

- Completed work만 적용: `/partners?bookingFlow=completed-work`
- Onboarding 검색: `/partners?review=unapproved&q=검색어`
- Clear filters: Directory는 `/partners`, Onboarding은 해당 review mode를 유지한 초기 주소

### 6. Booking flow 발견성

- 숨겨진 추가 필터가 Booking flow 하나뿐이면 기본 필터 줄로 올린다.
- 현재 폭이나 필터 밀도 때문에 기본 줄 이동이 부적절하면 `More filters`를 `Booking flow`로 바꾼다.
- drawer, modal, 새 필터 패널은 만들지 않는다.

### 7. Directory 행 정보 중복 제거

- Onboarding 칼럼에 이미 있는 verification/KYC blocker를 Account에서 반복하지 않는다.
- Account는 계정 정상/제한 상태와 프로필 열기 동작에 집중한다.
- `Open`은 `Open profile`로 바꾼다.
- 필요하면 칼럼명을 `Account / action`으로 바꾸되 새 Action 칼럼을 추가해 폭을 늘리는 방식은 피한다.
- Directory 설명을 검색 가능한 키와 운영 목적이 드러나는 문구로 바꾼다.

권장 문구:

```text
Search by partner name, phone, or ID, then open a profile to review status and restrictions.
```

### 8. 빈 상태 동작 정리

Approvals:

- 상단 Refresh와 본문 Refresh가 중복되면 상단 하나만 유지한다.
- `View held / rejected`가 실제 Onboarding blockers 전체로 이동한다면 `View onboarding blockers`로 바꾼다.
- 실제 데이터 필터 없이 held/rejected 전용 큐를 새로 만들지 않는다.

Onboarding 0건:

- `Reset filters` 하나를 primary action으로 둔다.
- 상단 필터로 이동하는 `Change filters`가 필요하면 secondary text link로만 둔다.
- 0건에서는 `Export current page (0)`을 disabled 또는 숨김 처리한다.
- disabled를 선택하면 이유를 `No records to export`로 설명한다.

### 9. 전역 검색 alias

- `partner`, `partners`, `provider`, `providers`가 Partner directory workspace를 찾도록 한다.
- approvals, onboarding, wallet debt 검색도 적절한 workspace/deep link를 찾도록 기존 navigation metadata를 재사용한다.
- 단순 plural normalization 또는 alias metadata 정도로 해결하고 검색 시스템을 새로 만들지 않는다.
- 검색 결과 명칭과 도착 화면 제목을 일치시킨다.

## 보존해야 할 현재 장점

다음은 회귀시키지 마라.

- 서버 기준 전체 건수와 페이지네이션
- 전체 결과 기준 Name 정렬
- current-page CSV 범위 표시
- Wallet debt의 `Canonical VND wallet balance`
- Wallet debt의 service/payout/marketplace 제한 설명
- 네 내부 탭과 `aria-current="page"`
- 표 머리글의 `scope="col"`
- native form label 연결과 visible focus
- 상태를 색상뿐 아니라 텍스트로 표현하는 방식
- 필터 0건과 큐 자체 0건을 구분하는 empty state

## 접근성 기준

- 키보드만으로 탭, 필터, disclosure, Apply, reset, row CTA를 사용할 수 있어야 한다.
- active tab과 active navigation은 programmatic state와 시각 상태가 모두 있어야 한다.
- 의미 없는 0건 export는 focus 대상이 되지 않아야 한다.
- 상태나 제한은 색상만으로 전달하지 않는다.
- 전체 WCAG 준수를 주장하지 말고 이번 변경 범위의 회귀만 검증한다.

## 테스트 요구사항

수정 전에 기존 테스트를 확인하고, 변경된 의미마다 가장 작은 회귀 테스트를 추가하라.

최소 검증:

1. Directory Oldest가 `user.createdAt asc`를 사용한다.
2. Approval queue의 제출일 정렬은 유지된다.
3. 네 review mode에서 Partner workspace nav가 active다.
4. Partner/Partners/Provider/Providers 검색 alias가 작동한다.
5. 빈/default 필터가 canonical URL에서 제거된다.
6. review mode를 보존한 canonical URL을 만든다.
7. Onboarding next action이 기존 blocker data에 따라 truthfully 표시된다.
8. 0건 export가 실행되지 않는다.
9. CSV upstream 실패와 정상 0건 응답이 구분된다.

기존 관련 테스트 명령:

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- app/partners/page.spec.tsx app/partners/partner-filters.spec.ts app/partners/partner-filter-board.spec.tsx app/partners/partner-master-list-section.spec.tsx app/partners/partner-master-row.spec.ts app/partners/partner-primary-list-tabs.spec.tsx app/partners/partner-review-mode.spec.ts lib/admin-nav-match.spec.ts app/api/admin/partners/export/route.spec.ts app/partners/partner-export-rows.spec.ts

npm.cmd run test --workspace @massage-vn/api -- src/admin/admin.service.spec.ts -t "partner"
```

변경한 파일에 lint/typecheck 명령이 정의되어 있으면 관련 workspace 범위에서 실행하라. 전체 저장소 명령이 지나치게 크면 변경 범위의 가장 좁은 공식 명령을 사용하라.

## 브라우저 검증

구현 후 로그인된 관리자 화면을 실제 브라우저에서 1440px 이상으로 확인하라.

반드시 확인할 URL:

- `/partners`
- `/partners?review=approval-pending&sort=oldest`
- `/partners?review=unapproved`
- `/partners?review=unsettled`
- `/partners?bookingFlow=completed-work`
- `/partners?review=unapproved&q=존재하지않는검색어`

확인 항목:

- 좌측 active state와 breadcrumb
- 내부 탭 이름과 active state
- 필터 적용 후 canonical URL
- 공유 URL 새로고침 후 상태 복원
- Directory row 중복 제거
- Onboarding Next action의 사실성
- Approvals/Onboarding empty state 행동 수
- 0건 export 상태
- Wallet debt 명칭 통일
- 1440px 가로 overflow 부재

검증 스크린샷은 새 output 폴더에 저장하고 기존 감사 스크린샷을 덮어쓰지 마라.

## 완료 보고 형식

작업이 끝나면 다음 순서로 짧고 구체적으로 보고하라.

1. 수정 완료 요약
2. P1/P2 항목별 변경 결과
3. 변경 파일 목록과 각 파일의 역할
4. 실행한 테스트와 결과
5. 브라우저에서 확인한 URL과 결과
6. 아직 검증하지 못한 항목 또는 실제 데이터 부재
7. 의도적으로 추가하지 않은 기능

완료라고 보고하기 전에 위 수용 기준과 테스트를 실제로 확인하라. 구현할 근거가 부족한 domain rule이 있으면 임의로 만들지 말고, 가능한 나머지 작업을 완료한 뒤 정확한 blocker만 보고하라.

---
