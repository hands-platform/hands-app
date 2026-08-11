# Codex 구현 프롬프트 — Cash Settlements 운영 워크벤치 개선

아래 내용을 새 Codex 작업에 그대로 붙여 넣어라.

---

## 역할

너는 `C:\dev\massage-on-demand-vn` 저장소의 시니어 제품 엔지니어이자 금융 운영 UX 담당자다. 목표는 `/cash-settlements`를 보기 좋은 설명 페이지가 아니라, 실제 운영자가 미정산 현금 수수료 채권을 **정확하고 안전하게 찾아 처리하고 결과를 확인할 수 있는 단일 운영 워크벤치**로 개선하는 것이다.

## 먼저 읽을 자료

1. `C:\dev\massage-on-demand-vn\AGENTS.md`
2. `C:\dev\massage-on-demand-vn\output\cash-settlements-audit-2026-08-08\cash-settlements-deep-audit-report.md`
3. cash-settlements Admin Web 페이지·컴포넌트·테스트
4. 관련 Admin API route/service, earnings policy/service, wallet ledger 및 기존 finance approval/deposit 흐름

작업 전에 현재 구현을 다시 확인하고 보고서의 파일명이나 구조가 바뀌었다면 실제 코드 기준으로 추적하라. 보고서를 맹목적으로 구현하지 말고, 모든 금융 상태 변경 규칙은 기존 도메인 모델과 감사 로그에 맞춰 검증하라.

## 핵심 목표

1. 어떤 필터 상태에서도 Review → Confirm/Cancel/Success/Error 흐름이 끊기지 않는다.
2. 실재하는 승인 증빙 없이는 채권을 PAID로 변경할 수 없다.
3. 실패가 성공처럼 보이지 않으며, 성공 결과와 audit trail을 운영자가 확인할 수 있다.
4. 동일 작업의 재전송이 증빙·처리 시각·원장을 덮어쓰지 않는다.
5. 기본 화면에서 전체 미해결 위험과 실제 처리 우선순위가 즉시 보인다.
6. 반복 설명 카드와 인라인 폼을 제거해 하나의 스캔 가능한 업무 목록과 상세 drawer로 통합한다.

## 작업 범위와 제약

- 대상은 1440px 이상 데스크톱 관리자 환경이다. 1024px 이하 반응형 개선은 이번 범위에서 제외한다.
- 모바일 레이아웃을 이유로 데스크톱 정보 밀도를 낮추지 않는다.
- 기존 dark/light theme와 디자인 토큰을 재사용한다.
- `AGENTS.md`의 protected area와 검증 명령을 준수한다.
- API/금융 도메인을 수정할 때 기존 데이터, ledger, audit trail 호환성을 보존한다.
- 브라우저 검증 중 실제 금전 상태를 변경하지 않는다. mutation 검증은 테스트 fixture/격리 환경에서 수행한다.
- 새 라이브러리는 꼭 필요한 경우에만 추가한다. 기존 컴포넌트와 URL/state 패턴을 우선 재사용한다.
- 단순 문구 변경으로 증빙 안전성 문제를 덮지 않는다. 서버가 반드시 권한·상태·승인 레코드를 검증해야 한다.

## P0 — 반드시 먼저 해결

### 1. Review settlement 문맥 손실 제거

현재 `range=all`, `sort=oldest`, queue, search, page 등의 상태에서 Review를 누르면 confirm 파라미터만 남고 기본 Today로 돌아가 대상 row를 찾지 못한다.

구현 요구:

- `range`, `age`, `sort`, `sla`, `queue`, `q`, `page`, `pageSize`, `view`를 하나의 canonical filter state로 정의한다.
- 모든 링크·검색 form·queue tab·pagination·Review·Cancel·success/error redirect가 같은 URL builder를 사용한다.
- 확인 대상은 현재 페이지 `rows.find()`에 의존하지 말고 earning ID로 권한이 적용된 서버 조회를 하거나, 안전한 detail route/drawer data source에서 읽는다.
- 필요하면 same-origin `returnTo`를 쓰되 서버에서 `/cash-settlements` 내부 경로만 허용하고 외부/프로토콜 상대 URL은 거절한다.
- Cancel과 처리 결과 후 같은 필터, page, sort, 선택 row와 가능한 경우 focus를 복원한다.
- URL에 민감한 메모 전문을 싣지 않는다. 서버 action/form data로 전달하고 URL은 대상/상태 식별만 담당한다.

### 2. 합성 settlement reference를 실제 증빙으로 쓰지 않기

`HANDS-CASH-<short-booking-id>`는 내부 상관관계 키일 뿐 은행 입금 또는 승인된 상계 증빙이 아니다.

구현 요구:

- 자동 생성 reference를 `Reference ready`로 표시하거나 정산 form의 제출값으로 prefill하지 않는다.
- evidence 상태를 최소 다음으로 분리한다.
  - booking cash payment recorded
  - bank deposit evidence linked
  - approved admin offset linked
  - missing settlement evidence
- `Admin offset` 실행에는 기존 finance approval/offset request의 승인된 레코드가 필요하다. 저장소에 이미 있는 approval queue/결재 모델을 먼저 찾아 재사용한다.
- 서버는 approval의 상태, partner, earning, amount, currency, 미사용 여부를 검증한다.
- 적합한 기존 승인 모델이 없다면 가장 작은 명확한 maker-checker 흐름을 설계한다. 요청과 승인을 분리하고 승인 전에는 earning을 PAID로 바꾸지 않는다.
- 은행 입금은 승인된 deposit record를 연결하여 배분하며 자유 입력 reference만으로 완료하지 않는다.
- 기존 합성 reference가 이미 저장된 데이터가 있다면 삭제/덮어쓰기 전에 별도 감사·마이그레이션 계획을 제시하고 승인 없이 파괴적 변경을 하지 않는다.

### 3. 오류 전파와 결과 피드백

현재 direct settlement action은 fallback helper로 권한 거부, 4xx/5xx, 네트워크 오류를 삼킬 수 있다.

구현 요구:

- 금융 mutation은 throw/result 기반 helper를 사용하고 실패를 성공으로 변환하지 않는다.
- 예상 오류는 운영자용 메시지와 안정적인 error code로 표시한다.
- 성공 시 처리된 earning, amount, method, audit ID, resulting status를 보여준다.
- 처리 중 중복 클릭을 막고 재시도 가능 여부를 명확히 한다.
- 서버 로그에는 구조화된 actor/target/result/reason을 남기되 민감정보를 노출하지 않는다.

### 4. 서버 상태 가드·멱등성·증빙 불변성

구현 요구:

- 허용된 open 상태이면서 negative cash-fee receivable인 earning만 정산 가능하다.
- 조건부 update 또는 트랜잭션으로 경쟁 요청을 막는다.
- 이미 PAID면 같은 idempotency key의 동일 결과만 안전하게 반환하거나 명확한 conflict를 반환한다.
- 기존 `paidAt`, settlement reference, approval link, ledger evidence를 재호출로 덮어쓰지 않는다.
- wallet ledger upsert가 잘못된 재호출로 증빙을 바꾸지 않도록 한다.
- audit 기록과 earning/ledger 변경이 원자적으로 일관되게 완료되거나 실패하도록 한다.

## P1 — 운영 정보 구조와 데이터 정확성

### 5. 기본 진입과 지표

- 기본 범위를 `All open`으로 변경한다. Today는 선택 필터로 유지한다.
- 기본 정렬은 운영 목적에 따라 `oldest overdue` 또는 `highest exposure` 중 하나로 명시하고 서버에서 전역 적용한다.
- 상단 primary KPI는 네 개로 제한한다.
  - Open exposure
  - Overdue
  - Missing settlement evidence
  - Partners affected
- fee/tax/coupon 구성은 secondary breakdown으로 둔다.
- `Total wallet debt`처럼 계산 범위를 과장하는 이름을 실제 의미에 맞게 수정한다.
- `Payment evidence OK`를 booking evidence와 settlement evidence로 분리한다.

### 6. 서버 정렬과 페이지네이션

- API가 페이지를 자르기 전에 선택한 정렬을 전역 데이터에 적용한다.
- 화면에서 현재 10개 row만 다시 정렬하지 않는다.
- `oldest`, `highest debt`, `newest`, SLA 정렬 정의와 tie-breaker를 테스트로 고정한다.
- summary와 list가 동일한 open-debt predicate를 공유하도록 중복 조건을 정리한다.

### 7. 필터 단순화

- 1행: All open / Overdue / Missing evidence / High exposure / Payment check queue tabs.
- 2행: 검색 / 정렬 / Advanced filters.
- Advanced filters: date range, age, SLA, page size.
- queue select와 queue link를 중복 제공하지 않는다.
- 활성 칩은 사용자가 기본값에서 바꾼 조건만 표시한다.
- 필터 변경 시 page를 1로 초기화하되 다른 관련 상태는 보존한다.

### 8. Full view 통합

현재 `view=full`의 execution desk, priority board, rules, workflow, handoff map, command queue, checklist, provider cards는 동일 정보를 반복하며 전역과 현재 페이지 집계를 섞는다.

- 별도 full 운영 화면을 제거하고 기본 cash-settlements workbench로 통합한다.
- 정책·워크플로·용어는 `Operating guide` drawer/접이식 도움말로 이동한다.
- 전역 카드에는 전역 API 집계만 사용한다.
- 현재 페이지 값은 `Visible rows`로 명시한다.
- API의 `topProviderGroups` 등 기존 전역 집계를 우선 활용하고, 화면의 10개 row로 전역 우선순위를 만들지 않는다.
- 기존 `view=full` URL은 안전하게 기본 workbench 또는 guide가 열린 상태로 호환 redirect한다.

### 9. 표 + detail drawer

목록 열:

- Partner
- Booking
- Exposure (fee/tax breakdown은 보조)
- Age/SLA
- Settlement evidence
- Owner/follow-up
- Next action

동작:

- 행마다 반복되는 3개 인라인 입력과 여러 버튼을 제거한다.
- `Review` 하나로 drawer를 연다.
- drawer에는 전체 booking/earning ID, partner, timeline, linked deposit/offset approval, current balance/exposure, expected result, audit history, reason/evidence action을 둔다.
- 확인 단계에서 before/after 금액과 ledger effect를 보여준다.
- 각 입력의 accessible name은 대상 earning/booking을 포함해 고유해야 한다.
- drawer는 focus trap, Escape 닫기, 닫은 후 원래 row로 focus 복원을 지원한다.

### 10. 파트너 입금 요청의 업무 단위 수정

- partner bank deposit request를 earning 행마다 반복 생성하지 않는다.
- partner 단위 Deposit requests 흐름에서 요청을 한 번 생성하고 상태를 추적한다.
- 승인된 입금을 여러 적합한 earning에 배분하는 기존 권위 있는 흐름과 연결한다.
- 중복 요청, 금액 초과 배분, 다른 partner 배분을 서버에서 막는다.

## P2 — 운영 생산성

가능한 기존 도메인과 최소 변경으로 다음을 추가한다.

- owner/assignee
- last contact 및 결과
- next follow-up / promised payment date
- escalation level/reason
- recently settled/history 링크

대규모 신규 CRM을 만들지 말고 현재 운영 데이터 모델에서 지원 가능한 최소 세트를 구현한다. 별도 스키마가 필요하면 Phase 1·2와 분리된 migration 및 rollout 계획을 작성한다.

## UX 문구 원칙

- 내부 구현 용어보다 운영자가 판단할 말로 쓴다.
- `Payment evidence`와 `Settlement evidence`를 혼용하지 않는다.
- `Admin offset`에는 무엇을 상계하고 누가 승인했는지 설명한다.
- 빈 상태는 `No records`로 끝내지 말고 현재 범위와 다음 선택을 알려준다.
- 성공·실패·충돌 메시지에 대상, 결과, 다음 행동을 포함한다.
- 영어 운영 UI를 유지하되 짧고 일관된 용어를 사용한다.

## 구현 순서

1. 현재 failing behavior를 재현하는 회귀 테스트를 먼저 추가한다.
2. P0 문맥 보존과 대상 조회를 수정한다.
3. 증빙/승인 검증, 오류 전파, 멱등성·상태 가드를 구현한다.
4. API 정렬과 evidence summary 정의를 수정한다.
5. 화면을 workbench + table + drawer로 통합한다.
6. filter URL과 legacy full-view 호환을 정리한다.
7. 접근성, 테마, 성능, 브라우저 시나리오를 검증한다.

## 필수 테스트

다음 테스트를 코드로 추가하거나 갱신하라.

### URL/화면

- `range=all&sort=oldest&queue=missing-ref&page=2`에서 Review/Cancel/Success/Error 후 상태 보존.
- 현재 page rows 밖의 earning도 ID로 정확히 조회.
- 악성/외부 returnTo 거절.
- 모든 filter/search/queue/pagination 링크가 canonical query 보존.
- legacy `view=full` 호환.

### 금융 도메인

- 합성 reference만 있는 요청 거절.
- 승인 없는 admin offset 거절.
- 다른 partner/amount/currency 또는 이미 사용된 approval 거절.
- open 상태가 아닌 earning 거절.
- 동시 2회 요청 중 하나만 변경 성공.
- 동일 idempotency 요청 재전송 시 evidence/paidAt/ledger 불변.
- mutation 실패 시 audit/earning/ledger가 부분 반영되지 않음.
- 권한 거부/4xx/5xx/네트워크 오류가 UI 오류로 노출.

### 데이터 정확성

- 정렬이 페이지 경계 전체에서 정확함.
- summary/list predicate 일치.
- booking evidence와 settlement evidence 집계가 서로 독립적임.
- 전역 지표와 visible-row 지표가 섞이지 않음.

### UX/접근성

- drawer keyboard open/close/focus restore.
- 반복 row action/field의 accessible name 고유.
- dark/light 1440px 이상 시각 회귀.
- 빈 상태, loading, permission denied, stale/conflict, success 상태.

## 검증 명령

저장소 실제 script를 확인한 뒤 최소 다음 범위를 실행하라.

```powershell
npm.cmd --workspace @massage-vn/admin-web test -- app/cash-settlements
npm.cmd --workspace @massage-vn/api test -- src/earnings/earnings.service.spec.ts src/earnings/earnings.policy.spec.ts src/admin/admin.controller.spec.ts src/admin/admin.service.spec.ts
npm.cmd run verify:scope -- admin api
```

관련 protected area를 건드렸다면 `AGENTS.md`가 요구하는 추가 typecheck/test/guard를 모두 실행한다. 테스트를 필터링해 통과시킨 경우 full 관련 suite도 별도로 실행한다.

브라우저에서는 1440px 이상에서 다음을 read-only 또는 격리 데이터로 확인한다.

1. 기본 진입 시 전체 open 위험 노출.
2. queue/search/sort/filter/page 상태 보존.
3. Review drawer의 정확한 대상과 증빙 상태.
4. Cancel/error 후 문맥 복원.
5. dark/light 테마.
6. legacy full URL.
7. 전체 페이지 길이와 반복 정보 감소.

## 완료 조건

- P0 네 항목이 코드와 테스트로 해결됨.
- 실제 승인 증빙 없는 direct PAID 변경 경로가 없음.
- 실패가 사용자에게 명확히 보이고 성공 결과/audit ID를 확인할 수 있음.
- 기본 화면이 All open이며 운영 우선순위가 서버 전역 정렬과 일치함.
- full view 중복이 제거되고 전역/페이지 집계가 섞이지 않음.
- 표가 스캔 가능하고 작업은 detail drawer에서 안전하게 완료됨.
- 1440px 이상 dark/light에서 시각·키보드 검증 완료.
- 기존 관련 테스트와 새 회귀 테스트, scope verification 통과.

## 최종 보고 형식

작업 후 다음 순서로 보고하라.

1. 운영자 관점에서 무엇이 달라졌는지
2. 해결한 P0/P1/P2 항목과 남은 항목
3. 변경 파일 목록
4. API/DB/금융 불변식 변경 내용
5. 실행한 테스트·검증 명령과 결과
6. 1440px 이상 before/after 캡처 경로
7. protected area 수정 여부
8. rollout/데이터 마이그레이션/권한/감사 위험
9. 아직 남은 결정이나 후속 작업

완료하지 못한 항목을 완료했다고 표현하지 말고, 차단 원인과 가장 작은 다음 행동을 명시하라.

---
