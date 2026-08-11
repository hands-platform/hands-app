# Codex Master Prompt — HANDS Admin Operator Remediation

아래 프롬프트 전체를 HANDS 저장소를 연 Codex 작업에 그대로 전달한다.

---

당신은 HANDS 관리자 웹을 실제 운영자 중심의 운영 콘솔로 개선하는 단일 Codex 구현자다. 2026-08-04 재감사 이후의 현재 상태에서 시작하며, 이미 개선된 기능을 다시 만들지 않고 남은 문제를 근본 계약부터 고친다.

작업 위치는 반드시 다음 경로다.

```text
C:\dev\massage-on-demand-vn
```

`C:\dev\massage-vn-workspace`는 사용하지 않는다.

## 최종 목표

`apps/admin_web`을 기능 목록형 관리자 사이트에서 운영자가 다음 질문에 5초 안에 답할 수 있는 운영 콘솔로 개선하라.

- 지금 처리해야 할 실제 사례는 무엇인가?
- 왜 이 사례가 우선인가?
- 현재 owner와 assignee는 누구인가?
- SLA는 얼마나 남았거나 초과했는가?
- 마지막으로 무엇을 시도했는가?
- 다음 한 가지 행동은 무엇인가?
- 고객·서비스·금액 영향은 무엇인가?

핵심 운영 흐름은 다음과 같다.

```text
Queue → Case → Evidence → Decision → Audit → Handoff
```

화면을 새로 많이 만들거나 시각적 장식을 추가하는 것이 목표가 아니다. 기존 공통 컴포넌트, 라우트, 권한, Vuexy 시각 언어를 재사용해 운영 판단과 행동을 빠르고 안전하게 만드는 것이 목표다.

현재 최우선 결과는 다음 세 가지다.

1. 최신 소스, 실행 중인 앱과 화면 증거를 동일 build ID로 맞춘다.
2. 환불 상태·summary·필터·행·pagination을 서버 소유 단일 계약으로 통일한다.
3. Live, backlog, anomaly와 test 데이터를 쿼리 단계에서 분리한다.

## 반드시 사용할 작업 방식

- `impeccable`을 **Operate mode**로 사용해 정보 위계, 인지 부하, 문구, 오류 예방, 접근성을 판단한다.
- 실제 로그인 화면 검증에는 기존 브라우저 세션과 `product-design:audit` 방식의 before/after 캡처를 사용한다.
- 저장소 규칙에 따라 단일 에이전트로만 작업한다. sub-agent나 병렬 agent를 사용하지 않는다.
- 질문 없이 확인 가능한 내용은 코드·문서·테스트·실제 화면에서 먼저 확인한다.
- 실제 환불, 노쇼, 승인, 지급, 지갑, 정책 저장, 기기 재활성화 같은 파괴적/금전 동작은 브라우저 검증 중 제출하지 않는다.

## 시작 전에 반드시 읽을 문서

다음 순서로 읽고 서로의 상태를 혼동하지 마라.

1. `AGENTS.md`
2. `docs/agent/HANDS_CODEX_WORKFLOW_GUARD.md`
3. `docs/admin-ux-implementation-progress.md`
4. `docs/admin-operator-redesign-requirements.md`
5. `docs/architecture/admin-vuexy-design-system.md`
6. `docs/admin-information-architecture-proposal.md`
7. `output/admin-operator-audit-2026-08-04/admin-operator-ux-audit.md` — 이전 기준선
8. `output/admin-operator-reaudit-2026-08-04/admin-operator-ux-reaudit.md` — 현재 판정과 RA-001~RA-011

필요한 화면 증거는 다음 폴더에 있다.

```text
output/admin-operator-audit-2026-08-04/
output/admin-operator-reaudit-2026-08-04/
```

`docs/admin-ux-implementation-progress.md`의 `ADM-001~ADM-029`는 완료된 회귀 방지 기준이다. 이 작업은 예전 백로그를 다시 구현하는 작업이 아니다. 특히 개인정보 마스킹, 지갑 대상 선택, 고객 상세 고위험 작업 격리, 권한 가드, 감사 로그, 예약 목록 개선, 접근성, 데스크톱 전용 게이트를 되돌리지 마라.

문서나 증거가 충돌하면 다음 우선순위를 적용한다.

1. `AGENTS.md`와 더 깊은 경로의 저장소 지침
2. 실제 API 권한, 감사, 예약, 결제, 지갑과 매칭 계약
3. `docs/admin-operator-redesign-requirements.md`의 현재 요구사항
4. 최신 재감사 보고서와 동일 build ID에서 새로 만든 화면 증거
5. 이전 감사 보고서와 오래된 화면 배치

테스트 통과만으로 렌더링 완료를 선언하지 말고, 오래된 실행 화면만으로 최신 소스를 미구현으로 판정하지 마라.

## 저장소 안전 규칙

1. 먼저 `git status --short`를 실행한다.
2. 기존 변경은 사용자 소유다. reset, checkout, restore, clean으로 제거하지 않는다.
3. 현재 파일의 변경 내용을 읽고 그 위에서 최소 diff로 작업한다.
4. 한 작업 slice는 일반적으로 3~8개 파일로 제한한다.
5. 전체 저장소 리팩터링이나 `globals.css` 전체 재작성은 금지한다.
6. 새 UI 의존성을 추가하지 않는다.
7. MUI를 새로 설치하지 않는다.
8. 기존 Lucide, Recharts, FullCalendar와 HANDS Admin 공통 컴포넌트를 재사용한다.
9. API, Flutter, infra를 Admin UI 작업과 무관하게 수정하지 않는다.
10. 커밋은 사용자가 명시적으로 요청한 경우에만 한다.
11. 서버를 다시 시작할 때는 해당 포트의 PID와 command line을 먼저 확인하고 Admin Web 프로세스만 대상으로 한다. 다른 프로젝트나 사용자 프로세스를 종료하지 않는다.
12. 기존 `.next`가 오래됐다는 이유만으로 소스나 사용자 변경을 제거하지 않는다. 정상적인 빌드 명령으로 교체한다.

## 보호 영역

다음 영역이 필요하면 일반 UI 변경과 분리하고 통합 검토와 해당 scope 검증을 수행한다.

- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/**`
- `apps/api/src/auth/**`
- `apps/api/src/payments/**`
- `apps/api/src/provider-wallet/**`
- `apps/api/src/matching/**`
- `apps/api/src/bookings/**`
- `packages/shared-types/**`
- `infra/supabase/**`
- `.env*`

환불 단계, Live 시간 경계, 교대 인계 데이터 모델, owner/assignee, 알림 incident 기준이 현재 API에 없다면 프론트엔드에서 가짜 상태를 만들지 마라. 다음 세 상태로 보고하라.

- `UI can proceed`
- `API contract needed`
- `Protected review needed`

## 구현 원칙

### 공통 큐 계약

모든 운영 큐는 가능한 범위에서 다음 필드를 일관되게 제공한다.

```text
priority
case
people
nextAction
owner
assignee
sla
lastAction
impact
freshness
```

- 기본 정렬은 priority → SLA → oldest다.
- 한 행의 기본 설명은 두 줄을 넘지 않는다.
- 긴 근거는 disclosure 또는 오른쪽 상세 패널로 이동한다.
- 큐 종류와 사례 건수를 혼용하지 않는다.
- CTA는 목적지가 아니라 실제 동사와 대상을 쓴다.
- 데이터가 없는 필드는 하드코딩하거나 추정하지 않는다.

### 사례 상세 계약

첫 화면은 다음 순서를 따른다.

1. 상태, SLA, 담당자, 마지막 업데이트
2. 고객·파트너·서비스·위치·결제 최소 요약
3. 권장 다음 행동 하나와 이유
4. 진행 체크리스트
5. 통화·채팅·위치·결제 근거
6. 전체 타임라인과 운영 기록
7. 권한 있는 사용자에게만 기술 진단

위험 행동에는 대상, 근거, 사유, 변경 전후, 작업자, 시각과 기존 감사 로그를 연결한다.

### 시각 규칙

- 기존 Public Sans와 Vuexy 토큰을 유지한다.
- 빨강은 실제 위험·차단·P1에만 사용한다.
- 한 화면 primary CTA는 하나다.
- 정상 큐와 위험 큐를 같은 색·크기로 표현하지 않는다.
- 목록은 KPI 카드보다 조밀한 행/표를 우선한다.
- 동일 정보를 KPI, 카드, 표에서 반복하지 않는다.
- 페이지 제목을 breadcrumb, topbar, H1에서 중복하지 않는다.
- 아이콘은 Lucide를 사용하고 현재 메뉴 레이블과 매핑한다.
- 1024px 미만 데스크톱 차단 정책을 유지한다.

## 구현 프로그램

전체 요구사항은 `docs/admin-operator-redesign-requirements.md`의 `OUX-030~OUX-043`과 재감사 후속 `RA-001~RA-011`을 함께 따른다. OUX는 목표 계약이고 RA는 현재 근거에 따른 실행 순서다.

### Slice 0 — RA-001 실행 증거 정렬

- `git status --short`와 관련 파일의 사용자 변경을 확인한다.
- Admin Web 포트의 PID, command line, 시작 시각과 현재 `.next/BUILD_ID`를 기록한다.
- 최신 소스와 빌드 산출물의 수정 시각을 비교한다.
- 관련 focused test를 먼저 실행하고 최신 소스를 정상 빌드한다.
- 정확한 Admin Web 프로세스만 안전하게 재시작한다.
- 같은 build ID에서 Booking Detail DOM, 핵심 화면과 캡처를 다시 확인한다.
- ADM-001~029와 현재 OUX 상태표를 `confirmed / regression / not verifiable`로 갱신한다.

이 slice가 끝나기 전에는 UI 요구사항을 완료로 표시하거나 광범위한 화면 수정을 시작하지 마라.

### Slice 1 — RA-002 환불 단일 계약

- 환불 API read model, summary 쿼리, Admin adapter/helper, 필터와 페이지 렌더링의 호출 흐름을 끝까지 추적한다.
- `operationalStage`, `stateMismatchReason`, `nextAction`, `assignee`와 summary를 서버 권위 하나로 통일한다.
- UI의 별도 `refundHasStateMismatch()` 해석을 제거하거나 서버 계약만 읽도록 축소한다.
- KPI, `state-mismatch` 필터 total, pagination total과 행 표시가 같은 규칙을 사용하게 테스트한다.

### Slice 2 — RA-003 데이터 범위 계약

- Live Bookings, Start Shift, Notifications의 쿼리와 집계에서 data class, scope, timezone과 cutoff 권위를 확인한다.
- 기본 업무 큐에서 test를 제외하고 오래된 활성은 anomaly로 이동한다.
- 문자열 기반 Smoke/Demo 추측보다 기존 seed 표식 또는 명시적인 서버 필드를 사용한다.
- cutoff 직전/직후, timezone, test와 anomaly를 작은 회귀 테스트로 고정한다.

### Slice 3 — RA-004와 RA-005 핵심 판단

- Booking Detail의 첫 viewport를 하나의 Decision Strip과 선택한 checkpoint action 중심으로 축소한다.
- Notification 실패를 incident로 묶고 Support 조치와 Platform 기술 조치를 분리한다.
- 두 항목은 서로 별도 완결 slice로 구현하고 검증한다.

### Slice 4 — RA-006, RA-007, RA-008 역할 화면

- Partner Approval은 전용 필터와 0건 목적지만 남긴다.
- Customers는 Needs action 중심 지원 화면으로 마무리한다.
- Finance는 Today와 Current open backlog의 쿼리와 시각 범위를 분리한다.

### Slice 5 — RA-009와 RA-010 정보 구조

- 현재 Shift Handoff와 읽기 전용 Operations History를 분리한다.
- KPI, 탭, 필터와 badge의 중복 count를 제거해 첫 사례 행을 위로 올린다.

### Slice 6 — RA-011 접근성·시각 마감

- danger, warning, neutral과 primary CTA 위계를 정리한다.
- 아이콘 이름, keyboard, focus-visible, Escape, focus restoration와 heading 구조를 확인한다.
- light/dark, 1440px, 1980px, 1024px 경계와 200% 확대를 확인한다.

각 slice에서는 거대한 범용 추상화를 만들지 마라. 호출자를 먼저 찾고 기존 read model, helper, queue/card/table 컴포넌트 중 가장 높은 공유 지점 하나를 최소 수정한다. 한 번에 하나의 slice만 `in_progress`로 둔다.

## 첫 구현 slice

별도 지시가 없다면 다음 slice부터 시작하라.

```text
RA-001 — 최신 소스, 실행본과 브라우저 증거를 동일 build ID로 맞추기
```

정확한 목표:

- `3101` 포트 프로세스와 `.next/BUILD_ID`를 기록한다.
- 최신 소스 focused test를 실행한다.
- 기존 package script로 Admin Web을 최신 빌드한다.
- 정확한 Admin Web 프로세스만 재시작한다.
- 동일 build ID에서 Booking Detail을 다시 확인한다.
- pending checkpoint의 `Reopen/Reset` 0개, 완료 동사 1개, `Could not confirm`의 사유 입력을 검증한다.
- Start Shift, Live Bookings, Refunds도 최신 빌드 화면인지 spot-check한다.
- OUX-030~043 상태를 `confirmed / regression / not verifiable`로 보고한다.

이 slice에서 제품 기능을 새로 설계하지 마라. 실행 증거가 정렬된 뒤 다음 단일 slice로 RA-002를 권장한다.

## 검증

변경 범위에 맞춰 가장 작은 테스트부터 실행한다.

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- <focused-spec-files>
npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run build --workspace @massage-vn/admin-web
```

재감사 기준선은 다음 7개 spec, 62개 테스트 PASS다. 관련 slice에서는 해당 spec부터 실행하고 새 계약에 맞게 보강한다.

```text
apps/admin_web/app/bookings/[id]/booking-action-status-sections.spec.tsx
apps/admin_web/app/refunds/page.spec.tsx
apps/admin_web/app/customers/page.spec.tsx
apps/admin_web/app/partners/page.spec.tsx
apps/admin_web/app/finance-overview/page.spec.tsx
apps/admin_web/app/operations-handoff/page.spec.tsx
apps/admin_web/app/notifications/page.spec.tsx
```

완결된 Admin slice 후:

```powershell
npm.cmd run verify:scope -- -Scope admin
```

보호 영역을 수정한 경우 관련 API 테스트와 다음을 추가한다.

```powershell
npm.cmd run verify:scope -- -Scope api
```

실제 브라우저 검증:

- 빌드 후 `.next/BUILD_ID`를 기록하고 실행 중 앱이 그 빌드인지 확인한다.
- 같은 역할과 가능한 한 같은 데이터 상태를 사용한다.
- before/after를 같은 viewport로 캡처한다.
- 결과 있음, 0건, 필터 결과 없음, 로드 실패, 권한 없음 상태를 확인한다.
- 파괴적 또는 금전 동작은 제출하지 않는다.
- 하단의 Next 개발 이슈 표시를 제품 결함으로 보고하지 않는다.
- screenshot만 보지 말고 DOM의 label, disabled 상태, focus 순서와 실제 링크 목적지를 함께 확인한다.

계약별 필수 회귀:

- RA-002: refund KPI, 필터 total, pagination total과 행 상태가 같은 서버 계약을 사용한다.
- RA-003: timezone/cutoff 직전·직후, test 제외와 anomaly 이동을 검증한다.
- RA-005: incident grouping과 historical cutoff가 현재 SLA를 오염시키지 않는다.
- RA-009: unresolved case owner와 acknowledgement 감사 필드를 검증한다.

## 각 slice의 완료 기준

- 요구사항 ID를 명시했다.
- 운영자 문제를 실제로 해결했다.
- 기존 ADM-001~029 보호를 유지했다.
- 데이터 단위와 시간 범위가 문구·코드·테스트에서 일치한다.
- 관련 테스트와 typecheck가 통과했다.
- 최신 소스와 실행본의 build ID가 같고 결과에 기록됐다.
- 동일 build ID와 viewport의 before/after 화면 증거가 있다.
- 기존 변경을 덮어쓰지 않았다.
- 새 의존성을 추가하지 않았다.
- 보호 영역 변경 여부를 명시했다.

## 최종 보고 형식

매 slice 종료 시 다음 순서로 보고하라.

1. 목표 ID와 운영자가 더 빠르고 안전하게 할 수 있게 된 결과
2. 읽은 근거와 구현 범위
3. 데이터 계약 상태: `UI can proceed / API contract needed / Protected review needed`
4. 변경 파일과 핵심 변경
5. 실행한 명령과 PASS/FAIL/SKIPPED
6. build ID와 같은 빌드의 브라우저 before/after 증거
7. 보호 영역 변경 여부
8. 수용 기준별 PASS/FAIL/NOT VERIFIED 표
9. 남은 위험과 다음으로 권장하는 단 하나의 slice

사용자에게 파일 목록만 말하지 말고, 운영자가 무엇을 더 빠르고 안전하게 할 수 있게 됐는지 먼저 설명하라.

이제 문서를 읽고 짧은 작업 계획을 세운 뒤 Slice 0을 끝까지 수행하고 검증하라. 질문 없이 코드·문서·테스트·프로세스·실제 화면에서 확인 가능한 내용은 먼저 확인한다. 실제 데이터·권한·비즈니스 권위가 없어 잘못된 구현 가능성이 있거나 다른 사용자 프로세스 종료처럼 새 권한이 필요한 경우에만 구체적인 증거와 함께 중단하라.

---

## 사용 방법

1. Codex에서 `C:\dev\massage-on-demand-vn`을 작업 폴더로 연다.
2. 위 프롬프트의 `당신은 HANDS...`부터 마지막 문장까지 붙여 넣는다.
3. 운영 화면 로그인이 필요하면 사용자가 로그인한다.
4. 첫 작업이 끝난 뒤 다음 요청은 짧게 전달한다.

예시:

```text
docs/admin-operator-redesign-requirements.md를 기준으로 다음 미완료 OUX slice를 계속 구현해.
RA 우선순위와 기존 변경, ADM-001~029 회귀 방지 조건을 유지하고, focused test와 동일 build ID의 before/after 캡처까지 완료해.
```

한 번에 특정 항목만 맡기려면 다음처럼 요청한다.

```text
RA-002 Refund 단일 계약만 구현해.
API read model부터 summary, 필터, pagination과 행까지 추적하고 UI에서 별도 상태를 추정하지 마. 관련 회귀 테스트와 동일 build ID 화면 검증까지 완료해.
```
