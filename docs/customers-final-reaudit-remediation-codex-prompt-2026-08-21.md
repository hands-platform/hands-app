# Customers 최종 재감사 후속 보완 Codex 실행 프롬프트

아래 내용을 새 Codex 작업에 그대로 붙여 넣어 사용한다.

---

`C:\dev\massage-on-demand-vn`의 HANDS Admin `Customers` 페이지에 대해 최종 재감사에서 확인된 잔여 항목만 최소 변경으로 보완하라.

이 작업은 Customers 화면을 다시 설계하거나 기존 기능을 재작성하는 작업이 아니다. 현재 페이지는 **18.7/20, 페이지 단독 출시 가능한 수준**이며 P0/P1은 없다. 이미 완료된 개선을 보존하면서 아래 P2/P3 항목만 검증하고 한 건씩 처리한다.

계획만 작성하고 멈추지 말고 다음 순서로 진행한다.

```text
현재 상태 확인
→ 성능 기준선 측정
→ 제목 중복 수정·검증
→ 정렬 문구 중복 수정·검증
→ 근거가 있을 때만 DB 중복 작업 최소화·검증
→ 격리된 시각 회귀 증거 보강
→ 전체 focused 회귀 검증
→ 구현 보고서 작성
```

## 1. 작업 루트와 필수 문서

작업 루트는 다음 하나뿐이다.

```text
C:\dev\massage-on-demand-vn
```

다른 복사본이나 `C:\dev\massage-vn-workspace`는 사용하지 않는다.

가장 먼저 아래 문서를 끝까지 읽는다.

```text
C:\dev\massage-on-demand-vn\AGENTS.md
C:\dev\massage-on-demand-vn\output\customers-final-reaudit-2026-08-21\customers-final-deep-reaudit.md
```

주요 화면 증거:

```text
C:\dev\massage-on-demand-vn\output\customers-final-reaudit-2026-08-21\01-default-queue-1440x1000.png
C:\dev\massage-on-demand-vn\output\customers-final-reaudit-2026-08-21\02-all-customers-1440x1000.png
C:\dev\massage-on-demand-vn\output\customers-final-reaudit-2026-08-21\03-more-filters-open-1440x1000.png
C:\dev\massage-on-demand-vn\output\customers-final-reaudit-2026-08-21\04-custom-date-validation-1440x1000.png
C:\dev\massage-on-demand-vn\output\customers-final-reaudit-2026-08-21\06-queue-filtered-empty-1440x1000.png
C:\dev\massage-on-demand-vn\output\customers-final-reaudit-2026-08-21\09-invalid-page-normalization-1440x1000.png
C:\dev\massage-on-demand-vn\output\customers-final-reaudit-2026-08-21\10-most-bookings-1440x1000.png
C:\dev\massage-on-demand-vn\output\customers-final-reaudit-2026-08-21\11-all-customers-1980x1100.png
C:\dev\massage-on-demand-vn\output\customers-final-reaudit-2026-08-21\12-all-customers-dark-1980x1100.png
C:\dev\massage-on-demand-vn\output\customers-final-reaudit-2026-08-21\14-customer-detail-transition-1440x1000.png
```

보고서의 line number는 시작점일 뿐이다. 현재 소스와 `git diff`가 사실의 기준이다.

## 2. 사용할 스킬과 작업 방식

다음 스킬을 순서에 맞게 사용한다.

1. `receiving-code-review`
   - 감사 내용을 맹목적으로 구현하지 말고 현재 코드에서 각 지적을 재현·검증한다.
2. `vercel-react-best-practices`
   - Admin Web의 Next.js server rendering과 데이터 로딩 변경을 검토할 때만 사용한다.
3. `supabase-postgres-best-practices`
   - Prisma/Postgres query 수와 집계 중복을 분석하거나 변경할 때만 사용한다.
4. `browser:control-in-app-browser` 또는 현재 제공되는 in-app browser 스킬
   - 로그인 상태가 유지된 실제 Customers 화면을 검증하고 스크린샷을 저장한다.

새 디자인을 만들지 않으므로 Figma, image generation, frontend redesign 스킬은 사용하지 않는다.

한 번에 여러 finding을 섞어 수정하지 않는다. 각 단계는 아래 순서를 지킨다.

```text
현재 동작 재현
→ 관련 caller와 테스트 확인
→ 최소 변경
→ 해당 단계 focused test
→ diff 검토
→ 다음 단계
```

## 3. 절대 제약

- 기존 business flow를 변경하지 않는다.
- DB schema와 migration을 변경하지 않는다.
- 기존 API route, query parameter, response contract를 깨지 않는다.
- 새 API version, repository layer, cache layer, query framework를 만들지 않는다.
- 패키지를 설치하지 않는다.
- Customers UI를 재설계하지 않는다.
- navigation, sidebar, page header, 표 구조를 다시 만들지 않는다.
- 1024px 이하 화면은 검사·수정·보고 범위에서 완전히 제외한다.
- 1440px 이상 desktop 운영 화면만 다룬다.
- 자동 새로고침, realtime, infinite scroll, page-size selector를 추가하지 않는다.
- production 고객 목록에 테스트·감사 fixture를 노출하지 않는다.
- PII masking, 권한 분리, 서버 guard를 약화하지 않는다.
- Operations Handoff, Push Send, CSV export 같은 공유 consumer를 확인하지 않고 customer directory response를 축소하지 않는다.
- 사용자 dirty worktree의 무관한 변경을 수정·정리·되돌리지 않는다.
- broad formatting과 무관한 lint cleanup을 하지 않는다.
- commit은 요청받지 않았다면 만들지 않는다.

## 4. 반드시 보존할 현재 동작

아래는 이미 완료된 기능이다. 후속 작업에서 회귀시키지 않는다.

- 기본 운영 뷰 `Payment & review`
- 명시적 `All customers`, `New today`, `App seen today`
- 각 operational view의 `N customers` 접근성 이름
- `Browse all {count} customers` 빈 상태 행동
- 검색·세그먼트·정렬을 1차 영역에 둔 구조
- 날짜·언어·성별을 `More filters`에 둔 구조
- Custom 날짜 즉시 표시, 필수값·역순 검증, `role=alert`
- Vietnam 시간 `Asia/Ho_Chi_Minh` 기준 날짜 계산
- API 오류와 정상 0건 구분
- operational view별 filtered-empty 문구
- `page=99`의 마지막 유효 페이지 redirect
- 서버 pagination과 filter-preserving URL
- `CUSTOMERS_DIRECTORY`와 `CUSTOMERS_DETAIL` 권한 분리
- 권한에 따른 detail link/lock 분기
- 안전한 Customers `returnTo`
- masked phone, short customer ID
- 전체 예약 `activitySummary`를 우선하는 현재 상태 계산
- `Session activity period`, `Recorded app language`의 정직한 의미
- `Captured payments`와 `Wallet balance` 분리
- fixture·smoke·audit 데이터의 production 목록 제외
- semantic table, native disclosure, shared status/form/table component
- 1440px·1980px Light/Dark의 현재 레이아웃

## 5. PHASE 0 — 수정 전 읽기 전용 검증

파일을 수정하기 전에 다음을 수행한다.

1. `git status --short`와 Customers 관련 `git diff`를 확인한다.
2. 다음 현재 파일과 관련 spec을 끝까지 읽는다.

```text
apps/admin_web/app/layout.tsx
apps/admin_web/app/customers/page.tsx
apps/admin_web/app/customers/page.spec.tsx
apps/admin_web/app/customers/customer-filter-board.tsx
apps/admin_web/app/customers/customer-filter-board.spec.tsx
apps/admin_web/app/customers/customer-filters.ts
apps/admin_web/app/customers/customer-filters.spec.ts
apps/admin_web/app/customers/customer-list-model.ts
apps/admin_web/app/customers/customer-list-model.spec.ts
apps/admin_web/app/customers/customer-management-view-model.ts
apps/admin_web/app/customers/customer-management-view-model.spec.ts
apps/admin_web/app/customers/customers-table-section.tsx
apps/admin_web/app/customers/customers-table-section.spec.tsx
apps/api/src/admin/admin-customer.routes.ts
apps/api/src/admin/admin-customer-selects.ts
apps/api/src/admin/admin-customer-selects.spec.ts
apps/api/src/admin/admin.service.ts
apps/api/src/admin/admin.service.spec.ts
```

3. `/admin/customers`와 `/admin/customers/summary`의 모든 현재 caller를 `rg`로 찾는다.
4. `AdminCustomerDirectoryRow`가 Customers 이외 어디에서 사용되는지 확인한다.
5. root metadata template과 Customers page metadata가 실제 title을 어떻게 합성하는지 확인한다.
6. 로그인 상태가 유지된 in-app browser에서 아래를 확인한다.

```text
document.title
/customers
/customers?view=all
/customers?view=all&sort=booking-count
```

7. 현재 summary/list query 구조와 unit mock 기준 query 수를 기록한다.

분석 결과가 보고서와 다르면 보고서를 따르지 말고 현재 근거를 최종 보고에 남긴다.

## 6. PHASE 1 — CUS-RR-P3-01 문서 제목 중복 수정

### 재현해야 할 현재 동작

```text
Customers | HANDS Admin · HANDS Admin
```

원인은 Customers page가 제품명을 포함한 title을 지정하고 root metadata template이 제품명을 다시 붙이는 것이다.

### 필수 결과

```text
Customers · HANDS Admin
```

### 최소 수정 원칙

- root layout의 공통 template은 변경하지 않는다.
- Customers page metadata만 `Customers`로 설정한다.
- client-side `document.title` script를 추가하지 않는다.
- 다른 페이지 metadata를 일괄 수정하지 않는다.
- 기존 잘못된 문자열을 기대하는 Customers test를 올바른 기대값으로 바꾼다.

### 필수 테스트

- `apps/admin_web/app/customers/page.spec.tsx`
- 실제 browser의 `document.title`

이 단계가 통과한 뒤에만 다음 단계로 간다.

## 7. PHASE 2 — CUS-RR-P3-02 정렬 문구 명확화와 중복 제거

### 재현해야 할 현재 동작

All customers 표 header가 동시에 다음을 표시한다.

```text
Sorted by Newest first
34 customers · Newest first
```

서버의 default 정렬은 `user.createdAt desc`이므로 `Newest first`는 최근 예약인지 최근 가입 고객인지 모호하다.

### 필수 결과

- default sort의 운영자 문구를 `Newest customers`로 명확하게 한다.
- compact result label은 다음 형식을 사용한다.

```text
34 customers · Newest customers
```

- All customers에서는 같은 정렬 설명을 별도 description으로 반복하지 않는다.
- `Payment & review`의 queue 목적 설명은 유지한다.
- 실제 sort enum, URL, 서버 orderBy는 변경하지 않는다.
- `Customer name`, `Most bookings`의 현재 동작을 유지한다.
- 새 component나 CSS 구조를 만들지 않는다.

### 구현 전 확인

`AdminTablePanel`의 description이 optional인지 확인한다. optional이면 All view description을 생략하고, 필수 contract라면 정렬을 반복하지 않는 짧은 운영 설명을 기존 prop으로 제공한다. 공통 component API를 이 한 페이지 때문에 재설계하지 않는다.

### 필수 테스트

- default select label
- default result label
- `Most bookings` result label
- existing queue description
- URL `sort=booking-count`와 서버 orderBy 유지

이 단계가 통과한 뒤 diff가 copy-only인지 확인한다.

## 8. PHASE 3 — CUS-RR-P2-01 성능 기준선과 조건부 최소 최적화

이 finding은 **probable issue**다. 느릴 것이라는 추측만으로 코드를 바꾸지 않는다.

### 8.1 먼저 증명할 것

현재 코드에서 다음을 표로 기록한다.

| 항목 | 확인 내용 |
| --- | --- |
| Customers page fetch | summary/list/operator access 호출 수 |
| `customerSummary` | count, groupBy, booking count 호출 수 |
| `listCustomers` | directory select, activity summary, audit summary 호출 수 |
| directory payload | 최근 booking, session, push device, audit data 포함 여부 |
| Customers 실제 사용 필드 | table/view model이 소비하는 필드 |
| 공유 consumer | Handoff, Push account search, CSV 등 |

가능하면 현재 프로젝트에 이미 있는 logging/metrics를 사용해 local p50/p95 또는 최소 반복 TTFB를 측정한다. 이 한 작업을 위해 production telemetry system을 새로 만들지 않는다.

### 8.2 구현 허용 조건

아래 조건을 모두 만족할 때만 최적화한다.

- 동일 predicate에서 중복 계산되는 결과임을 코드와 테스트로 증명했다.
- 반환 JSON shape와 의미를 유지할 수 있다.
- DB schema, API route, query parameter 변경이 필요 없다.
- Handoff, Push Send, CSV export를 깨지 않는다.
- summary count와 list pagination total의 의미가 바뀌지 않는다.
- 변경 후 query 수가 실제로 줄어드는 test를 작성할 수 있다.

### 허용되는 최소 예

- 동일한 filter scope에서 이미 얻은 gender group 합계로 total을 재사용한다.
- today group 합계와 today view count가 완전히 동일할 때만 결과를 재사용한다.
- needs-action total과 view count가 동일 predicate일 때만 중복 count를 없앤다.
- `options.view`에 따라 predicate가 달라질 수 있으므로 모든 호출에서 무조건 같은 값이라고 가정하지 않는다.

### 금지되는 구현

- response field 삭제
- endpoint 분리 또는 새 version 생성
- 새 projection/query language 도입
- Redis cache 추가
- page-level client cache 추가
- raw SQL 전체 재작성
- Prisma schema/index/migration 변경
- Customers page를 client fetching으로 전환
- shared consumer를 무시한 directory select 축소

안전한 중복 제거를 증명하지 못하면 이 단계에서는 소스 변경을 하지 않는다. 대신 기준선, 확인한 blocker, 다음 측정 방법을 구현 보고서에 남긴다. **보류는 실패가 아니며 추측 구현보다 우선한다.**

### 필수 테스트

- 기존 `customerSummary` 반환값 동등성
- `viewCounts.all`, `needsAction`, `newToday`, `activeToday` 결과
- q/segment/language/gender/date filter scope
- `view`가 undefined/all인 경우와 다른 view인 경우
- query call count upper bound
- list total과 pagination total 일치
- Handoff, Push search, CSV consumer 관련 기존 test

## 9. PHASE 4 — CUS-RR-P3-03 격리된 시각 회귀 증거

현재 실행 데이터 34명은 예약·앱 활동·열린 업무가 없어 복합 row를 실브라우저에서 확인할 수 없었다.

### 목표

production 목록에 fixture를 섞지 않고 다음 3개 상태를 검증한다.

1. 활성 예약 + 최근 앱 활동
2. payment/refund/reported review 다중 open work
3. 긴 고객 이름 + cancellation/no-show history

### 허용 조건

- 기존 테스트 fixture, story, e2e seed, browser fixture 방식이 있으면 재사용한다.
- 테스트 데이터는 격리되고 종료 후 production 목록에 남지 않아야 한다.
- 기존 fixture cleanup contract를 사용한다.
- 새 package를 설치하지 않는다.

기존 안전한 fixture 방식이 없으면 production DB에 임시 데이터를 쓰지 않는다. 그 경우 기존 React/unit render test에 1440px에서 문제가 될 긴 copy와 다중 signal 구조를 추가하고, 실브라우저 검증 제한을 보고한다.

### 필수 시각 확인

- 고객 이름이 최대 2줄 안에서 식별 가능
- Current situation의 badge와 시간 문구가 겹치지 않음
- Open work의 다중 badge가 열 경계를 침범하지 않음
- History가 현재 open work와 구분됨
- 금액 열 정렬 유지
- Light/Dark 모두 읽을 수 있음

## 10. 화면 검증 범위

다음 크기만 검사한다.

```text
1440×1000
1980×1100
```

1024px 이하 화면의 반응형 문제는 발견하더라도 이번 보고서에 넣지 않는다.

필수 URL/상태:

```text
/customers
/customers?view=all
/customers?view=all&sort=booking-count
/customers?view=all&page=99
/customers?q=zzzz-no-customer
/customers?view=new-today&q=zzzz-no-customer
/customers?view=active-today&q=zzzz-no-customer
More filters open
Custom dates incomplete
Customer detail → Back to search results
Light
Dark
```

각 상태에서 확인한다.

- document title
- operational view count와 결과 수 일치
- sort label, URL, row order 일치
- filtered-empty 원인 문구
- active filter chip과 Clear filters
- page=99 redirect
- detail link/returnTo
- 문서 horizontal overflow 없음
- console error 없음

새 화면 증거 폴더:

```text
C:\dev\massage-on-demand-vn\output\customers-final-remediation-verification-2026-08-21
```

스크린샷을 저장한 뒤 반드시 직접 열어 잘림, 겹침, 대비, 과도한 여백을 확인한다.

## 11. 단계별 테스트 명령

### 제목 수정 직후

```powershell
npm.cmd --workspace @massage-vn/admin-web test -- app/customers/page.spec.tsx
```

### 정렬 문구 수정 직후

```powershell
npm.cmd --workspace @massage-vn/admin-web test -- app/customers/customer-filter-board.spec.tsx app/customers/customer-filters.spec.ts app/customers/customers-table-section.spec.tsx
```

### 성능 집계 변경을 실제로 한 경우

먼저 관련 test name을 확인하고 customer directory/summary만 focused 실행한다.

```powershell
npm.cmd --workspace @massage-vn/api test -- src/admin/admin.service.spec.ts -t "customer directory|customer summary|customer list rows"
```

### 최종 Customers focused 회귀

```powershell
npm.cmd --workspace @massage-vn/admin-web test -- app/customers/page.spec.tsx app/customers/customer-filters.spec.ts app/customers/customer-filter-board.spec.tsx app/customers/customer-list-model.spec.ts app/customers/customer-management-view-model.spec.ts app/customers/customers-table-section.spec.tsx
```

```powershell
npm.cmd --workspace @massage-vn/api test -- src/admin/admin-customer-selects.spec.ts src/admin/admin.service.spec.ts -t "customer directory|usage new-unbooked|customer list rows|customer notifications|customer detail activity|customer detail booking|safe session summary"
```

### lint와 typecheck

```powershell
npm.cmd --workspace @massage-vn/admin-web exec -- eslint app/customers/page.tsx app/customers/customer-filters.ts app/customers/customer-filter-board.tsx app/customers/customer-list-model.ts app/customers/customer-management-view-model.ts app/customers/customers-table-section.tsx
```

```powershell
npm.cmd --workspace @massage-vn/api exec -- eslint src/admin/admin-customer.routes.ts src/admin/admin-customer-selects.ts src/admin/admin.service.ts
```

```powershell
npm.cmd --workspace @massage-vn/admin-web run typecheck
npm.cmd --workspace @massage-vn/api run typecheck
```

테스트 실패가 이번 변경과 무관하면 해당 파일과 오류를 증거로 남기고 무관한 코드를 수정하지 않는다.

## 12. 완료 기준

- [ ] 현재 report와 현재 코드를 비교해 각 finding을 재검증했다.
- [ ] 기존 dirty worktree를 보존했다.
- [ ] 실제 title이 `Customers · HANDS Admin`이다.
- [ ] title에 제품명이 두 번 나오지 않는다.
- [ ] default 정렬 문구가 가입 고객 기준임을 명확히 한다.
- [ ] All customers header에 같은 정렬 문구가 두 번 반복되지 않는다.
- [ ] sort enum, URL, 서버 orderBy는 기존과 동일하다.
- [ ] 성능 수정 전 query 기준선을 기록했다.
- [ ] 성능 변경을 했다면 response contract와 count 의미가 동일하다.
- [ ] 성능 변경을 했다면 query call count가 실제로 감소했다.
- [ ] Handoff, Push search, CSV consumer를 확인했다.
- [ ] 안전한 근거가 없으면 성능 코드를 추측으로 수정하지 않았다.
- [ ] production 목록에 fixture가 남지 않는다.
- [ ] 기존 권한, masking, 빈 상태, 날짜 검증, page redirect가 유지된다.
- [ ] 1440px·1980px Light/Dark에서 horizontal overflow가 없다.
- [ ] 관련 focused test, lint, typecheck 결과를 기록했다.
- [ ] 브라우저 console error가 없다.
- [ ] 새 dependency, schema, migration, route contract 변경이 없다.

## 13. 구현 보고서

작업이 끝나면 다음 파일을 작성한다.

```text
C:\dev\massage-on-demand-vn\docs\audits\customers-final-remediation-implementation-report-2026-08-21.md
```

보고서는 다음 순서로 작성한다.

1. 최종 결론과 수정 전/후 점수
2. finding별 `implemented / verified-no-change / deferred-with-evidence` 상태
3. 변경 파일과 각 root cause
4. Customers title 수정 증거
5. sort copy 수정 증거
6. 성능 기준선, query count 전후, 최적화 여부
7. 공유 consumer contract 보존 근거
8. 테스트·lint·typecheck 명령과 결과
9. 브라우저 URL·viewport·Light/Dark 검증 결과
10. 스크린샷 경로
11. 건드리지 않은 기존 변경과 protected area
12. 남은 위험과 다음 한 가지 권장 작업

`개선했습니다`, `최적화했습니다`처럼 증거 없는 표현을 사용하지 않는다. 파일, 함수, 테스트, browser state, query count로 완료를 증명한다.

## 14. 최종 작업 원칙

- 분석 없이 바로 수정하지 않는다.
- confirmed issue와 recommendation을 구분한다.
- probable performance issue를 confirmed 장애처럼 표현하지 않는다.
- 작은 수정 후 바로 테스트한다.
- 보고서의 제안이 현재 코드와 충돌하면 현재 코드 근거를 우선한다.
- 기존 동작을 유지하는 최소 구현을 선택한다.
- 더 깔끔한 architecture가 보인다는 이유로 범위를 넓히지 않는다.
- 안전하게 증명하지 못한 최적화는 보류하고 정확히 보고한다.

---

## 이 프롬프트가 해결하도록 제한한 항목

```text
CUS-RR-P2-01  Customers navigation DB 읽기 비용 — probable issue
CUS-RR-P3-01  중복 document title — confirmed issue
CUS-RR-P3-02  sort 문구 중복·모호성 — recommendation
CUS-RR-P3-03  복합 row 시각 회귀 증거 — recommendation
```

그 밖의 Customers 기능은 이번 작업의 수정 대상이 아니다.
