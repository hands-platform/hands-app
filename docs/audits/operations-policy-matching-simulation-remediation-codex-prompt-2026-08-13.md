# HANDS Operations Policy · Matching Simulation 보완 구현용 Codex 프롬프트

아래 전체 내용을 새 Codex 작업에 그대로 전달한다. 이 작업은 추가 감사 보고서 작성이 아니라, 최종 재감사에서 확인된 문제를 실제 코드·테스트·브라우저 화면에서 수정하고 출시 승인 조건까지 검증하는 구현 작업이다.

---

## 1. 역할과 최종 목표

너는 HANDS의 운영 정책과 실제 booking matching 계약을 안전하게 연결하는 시니어 풀스택 엔지니어다.

저장소:

```text
C:\dev\massage-on-demand-vn
```

대상 화면:

```text
http://localhost:3101/operations-policy?details=matching&matching=simulation
```

현재 재감사 점수는 **66/100**이고, 판정은 **정책 의사결정용 출시 보류**다.

현재 차단 UI는 이전보다 좋아졌지만 계산 기준이 실제 marketplace 후보 계약과 다르다. 최종 목표는 다음과 같다.

1. 화면이 실제 production booking 후보 계산과 같은 진실을 말한다.
2. Demo 좌표나 불완전한 근거가 `Ready`로 표시되지 않는다.
3. 현재 공급이 0이어도 독립적인 과거 정책 근거는 계속 볼 수 있다.
4. 운영자는 차단된 정확한 단계와 이동해야 할 큐를 즉시 이해한다.
5. 새 계산은 완전히 read-only이며 booking, participant, push, audit, 정책 값을 변경하지 않는다.
6. 1440px 이상 데스크톱에서 현재 관리자 디자인 시스템과 자연스럽게 일치한다.

이 작업에서는 이름만 `Simulator`인 기능을 과장하지 않는다. **새 what-if 편집기는 만들지 말고 화면을 `Current dispatch preview` 또는 `Matching policy preview`로 재정의한다.** 향후 실제 proposed-policy 비교가 필요할 때 별도 작업으로 확장한다.

## 2. 반드시 먼저 읽을 자료

다음 파일을 끝까지 읽고 시작한다.

```text
C:\dev\massage-on-demand-vn\AGENTS.md
C:\dev\massage-on-demand-vn\docs\audits\operations-policy-matching-simulation-final-reaudit-2026-08-13.md
C:\dev\massage-on-demand-vn\docs\audits\operations-policy-final-reaudit-2026-08-13.md
C:\dev\massage-on-demand-vn\docs\audits\operations-policy-matching-supply-final-reaudit-2026-08-13.md
C:\dev\massage-on-demand-vn\docs\audits\operations-policy-matching-simulation-final-reaudit-evidence-2026-08-13\browser-metrics.json
```

화면 증거도 직접 확인한다.

```text
01-simulation-default-1440x1000.png
02-simulation-refreshed-1440x1000.png
03-partner-readiness-destination-1440x1000.png
04-simulation-default-1600x1000.png
05-simulation-dark-1440x1000.png
```

보고서 작성 이후 소스가 바뀌었을 수 있으므로 최신 코드와 실행 화면에서 각 문제를 다시 확인한다. 이미 해결된 항목을 다시 구현하지 말고 회귀 테스트만 보강한다.

## 3. 작업 방식과 안전 경계

- `git status --short`로 시작 상태를 기록한다.
- dirty worktree의 기존 변경은 사용자 작업이다. 관련 없는 파일을 revert, reset, cleanup, 이동, 일괄 format하지 않는다.
- `AGENTS.md`에 따라 단일 에이전트로 작업한다. subagent나 별도 작업 thread를 만들지 않는다.
- 분석이나 계획만 작성하고 멈추지 말고 P0부터 구현·테스트·브라우저 검증까지 진행한다.
- `impeccable`이 제공되면 **Operate + harden** 관점으로 사용한다. 장식보다 정확성, 스캔 가능성, 상태 구분, 오류 복구, 접근성을 우선한다.
- `ponytail` 원칙을 적용한다. 새 계산 로직을 Admin Web에 복제하지 말고 기존 production helper/resolver를 재사용한다.
- 새로운 상태 관리 라이브러리, 디자인 시스템, chart library, workflow engine, simulation framework를 추가하지 않는다.
- Prisma schema와 migration은 이번 작업에서 변경하지 않는 것을 기본으로 한다. 꼭 필요하다고 판단되면 먼저 기존 구조로 해결할 수 없는 이유를 코드 근거로 남긴다.
- 실제 운영 정책을 저장하지 않는다.
- 실제 booking, participant, push/in-app notification, audit record를 생성하지 않는다.
- 실제 고객·Partner 데이터의 status, location, KYC, wallet을 변경해 Ready 상태를 만들지 않는다.
- 서버 재시작이 필요하면 대상 포트의 PID와 command line을 확인하고 정확한 프로세스만 재시작한다. 모든 `node.exe`를 종료하지 않는다.
- 사용자 요청 없이 commit하지 않는다.
- 1024px 이하 화면은 구현·검수·최종 보고서에서 제외한다.
- 화면 기준은 1440×1000, 1600×1000이며 light/dark를 확인한다.
- protected area인 `apps/api/src/matching/**`, `apps/api/src/bookings/**`, shared contract를 수정하면 `AGENTS.md`의 강화 검증을 수행한다.

## 4. 먼저 추적할 코드와 계약

### Admin Web

```text
apps/admin_web/app/operations-policy/page.tsx
apps/admin_web/app/operations-policy/operations-policy-page-model.ts
apps/admin_web/app/operations-policy/policy-simulation.ts
apps/admin_web/app/operations-policy/policy-simulation.spec.ts
apps/admin_web/app/operations-policy/operations-policy-live-simulator-section.tsx
apps/admin_web/app/operations-policy/operations-policy-live-simulator-section.spec.tsx
apps/admin_web/app/operations-policy/operations-policy-change-impact-section.tsx
apps/admin_web/app/operations-policy/operations-policy-drilldown-section.tsx
apps/admin_web/app/operations-policy/operations-policy-outcome-effect-section.tsx
apps/admin_web/app/operations-policy/policy-impact-dashboard.ts
apps/admin_web/app/operations-policy/policy-drilldown.ts
apps/admin_web/app/operations-policy/policy-outcome-effect.ts
apps/admin_web/lib/operations-policy.ts
apps/admin_web/lib/admin-api.ts
apps/admin_web/app/globals.css
```

### API와 production matching

```text
apps/api/src/admin/admin-partner.routes.ts
apps/api/src/admin/admin.service.ts
apps/api/src/admin/admin.service.spec.ts
apps/api/src/admin/admin-provider-profile-selects.ts
apps/api/src/admin/admin-operator-category.guard.ts
apps/api/src/bookings/bookings.backup-providers.ts
apps/api/src/bookings/bookings.backup-providers.spec.ts
apps/api/src/bookings/bookings.provider-readiness.ts
apps/api/src/bookings/bookings.provider-readiness.spec.ts
apps/api/src/bookings/bookings.service.ts
apps/api/src/bookings/bookings.service.spec.ts
apps/api/src/matching/matching.policy.ts
apps/api/src/matching/matching.policy.spec.ts
apps/api/src/provider-wallet/provider-wallet.policy.ts
```

수정 전에 다음 흐름을 끝까지 추적한다.

```text
Operations Policy route/query
→ load plan
→ settings / booking evidence / Partner evidence API
→ reference booking selection
→ production marketplace candidate query
→ radius and invitation limit
→ Partner participation/final selection gates
→ Admin preview response
→ page status
→ blocker breakdown
→ recovery CTA
```

실제 production 단계의 의미를 먼저 확정한다.

- `visible`: 현재 booking marketplace 목록에 노출될 수 있는가
- `invitable`: 현재 alert/invitation 대상이 될 수 있는가
- `final-gate-ready`: 고객 최종 선택 또는 참여 완료 시 기존 wallet/readiness gate를 통과할 수 있는가

이 세 의미를 임의로 합치지 않는다. production 코드가 실제로 구분하지 않는 단계는 UI에서 만들어 내지 말고, 현재 계약에 맞는 이름을 사용한다.

## 5. 보존해야 할 현재 개선사항

다음은 회귀시키지 않는다.

- `Blocked · no eligible Partner supply`로 성공 오표현을 제거한 점
- Demo reference를 별도 warning notice로 표시한 점
- 준비 조건 미충족 시 의미 없는 0건 결과표를 숨긴 점
- settings, booking 20, Partner 30을 병렬·제한 조회해 기존 페이지를 가볍게 만든 점
- 권한 부족 시 명시적 403 notice를 보여 주는 route model
- Policies/Supply/Simulation/Audit가 하나의 Operations Policy workspace 안에 있는 구조
- Partner readiness CTA가 실제 Partner Controls 위치 큐로 이동하는 동작
- 1440/1600에서 가로 overflow가 없는 레이아웃
- light/dark theme의 기존 토큰과 공통 Admin component 사용
- 브라우저에서 실제 정책 저장이나 데이터 mutation 없이 검수할 수 있는 구조

P0를 고치는 과정에서 이 개선을 제거하지 않는다.

## 6. 이번 구현의 결정 사항

보고서에는 두 선택지가 있었지만 이번 작업에서는 다음 방향으로 확정한다.

### 구현한다

- 이름: `Current dispatch preview` 또는 `Matching policy preview`
- 현재 live policy와 production evidence를 사용하는 read-only preview
- 실제 production marketplace 후보 helper/resolver 재사용
- 구조화된 reference와 상태
- 전체 집계와 blocker breakdown
- historical policy evidence의 독립 렌더링

### 구현하지 않는다

- proposed policy 입력 폼
- 정책 저장 버튼
- 임의 coordinate 입력기
- 새로운 chart library
- 새로운 DB table/migration
- 복잡한 workflow/state machine library

향후 what-if 비교가 필요하면 현재 read-only preview API를 확장하는 별도 작업으로 남긴다.

## 7. P0-1 — production 후보 계약을 재사용하는 read-only API

### 현재 문제

`policy-simulation.ts`는 `status.startsWith('ONLINE')`, 위치, 24시간 제한, `blockedAt`, 반경만으로 후보를 다시 계산한다. 실제 `bookings.backup-providers.ts`는 status, 위치 신선도, verification, KYC, 필수 승인 문서, requested service, reject 이력 등을 함께 적용한다.

이중 계산을 유지한 채 누락 조건만 Admin Web에 하나씩 추가하지 않는다.

### 필수 구현

1. 기존 API route 구조를 확인한 뒤 Operations Policy diagnostics 권한 아래에 read-only preview endpoint를 추가한다.
2. what-if 입력을 이번에 만들지 않으므로 가장 단순한 **GET endpoint**를 우선한다.

예시:

```text
GET /admin/operations-policy/matching-preview
GET /admin/operations-policy/matching-preview?referenceBookingId=...
```

3. referenceBookingId가 없으면 서버가 deterministic reference를 선택한다.
4. 우선순위는 production 의사결정에 쓸 수 있는 active/actionable booking을 먼저 사용한다. completed/cancelled/refunded booking을 조용히 production reference로 사용하지 않는다.
5. production reference가 없으면 Demo reference를 반환할 수 있지만 상태는 반드시 `DEMO_PREVIEW_ONLY`다.
6. marketplace 후보는 `backupProviderCandidateWhere`, radius helper, invitation limit helper 등 실제 production 경로의 공통 함수를 재사용한다.
7. 특정 booking의 service, preferred Partner, reject/participant 이력을 실제 계약대로 적용한다.
8. production 코드와 preview가 모두 호출할 수 있는 가장 좁은 공통 helper가 없다면 그 helper만 추출한다. preview 전용으로 matching 규칙을 복제하지 않는다.
9. endpoint는 다음과 같은 mutation을 절대 호출하지 않는다.

```text
booking create/update
participant create/update
push/in-app send
audit create
policy save
wallet ledger write
Redis/realtime dispatch state write
```

10. 전체 Provider row를 Admin Web으로 보내지 않는다. 서버에서 단계별 count와 상위 후보만 계산해 반환한다.
11. 후보 상위 목록은 기존 invitation/distance ordering을 사용하고 화면에 필요한 최소 필드만 반환한다.
12. endpoint의 권한·error shape는 기존 Admin diagnostics pattern을 따른다.

### 권장 응답 계약

현재 프로젝트의 기존 타입 패턴을 먼저 확인하고 가장 작은 타입으로 구현한다. 이름은 저장소 관례에 맞게 조정할 수 있지만 의미는 다음을 보존한다.

```ts
type AdminMatchingPreview = {
  status:
    | 'UNAVAILABLE'
    | 'BLOCKED_NO_REFERENCE'
    | 'DEMO_PREVIEW_ONLY'
    | 'INCOMPLETE_EVIDENCE'
    | 'BLOCKED_NO_ELIGIBLE_SUPPLY'
    | 'READY_WITH_PRODUCTION_EVIDENCE';
  reference: {
    kind: 'BOOKING' | 'DEMO';
    bookingId: string | null;
    bookingStatus: string | null;
    serviceId: string | null;
    lat: number;
    lng: number;
    observedAt: string | null;
    label: string;
  };
  checkedAt: string;
  evidence: {
    totalEvaluated: number;
    returnedCandidates: number;
    truncated: boolean;
    newestAt: string | null;
    oldestAt: string | null;
  };
  stages: Array<{
    code: string;
    label: string;
    passedCount: number;
    excludedCount: number;
    actionHref: string | null;
    actionLabel: string | null;
  }>;
  primaryBlocker: {
    code: string;
    title: string;
    detail: string;
    actionHref: string | null;
    actionLabel: string | null;
  } | null;
  candidates: Array<{
    partnerId: string;
    name: string;
    distanceMeters: number;
    locationUpdatedAt: string;
    stage: 'VISIBLE' | 'INVITABLE' | 'FINAL_GATE_READY';
    blockerCodes: string[];
  }>;
  safety: {
    dryRun: true;
    mutationsPerformed: false;
  };
};
```

상태와 stage를 문자열 추론으로 만들지 않는다. API가 구조화해 반환하고 Admin Web은 표시만 한다.

### P0-1 테스트

- production 후보와 preview가 같은 fixture에서 같은 Partner ID 집합을 반환한다.
- ONLINE_BUSY가 production 계약상 후보가 아니면 preview에서도 제외된다.
- ONLINE_AVAILABLE_SOON의 실제 production 의미가 preview와 일치한다.
- verification 미승인 제외.
- KYC 미승인 제외.
- 필수 문서 누락 제외.
- service 미지원 제외.
- 해당 booking reject 이력 제외.
- preferred Partner 제외 규칙 일치.
- fresh location cutoff 경계값 일치.
- radius 경계값 일치.
- invitation ordering/limit 일치.
- preview 호출 전후 booking, participant, notification, audit, wallet write mock이 0회다.

## 8. P0-2 — Demo와 production Ready를 구조적으로 분리

### 현재 문제

현재는 `Reference location` metric 문자열이 `Demo Ho Chi Minh City`인지 검색해 경고를 만들고, `ready` boolean은 Demo 여부를 확인하지 않는다. Demo 좌표 주변에 fresh Partner가 있으면 `Ready`와 production 금지 경고가 동시에 나올 수 있다.

### 필수 구현

- `reference.kind`를 API 응답의 정식 필드로 사용한다.
- `ready` boolean 중심 분기를 제거하고 구조화된 `status`로 렌더링한다.
- `DEMO_PREVIEW_ONLY`에서는 candidate 정보가 있더라도 production Ready 배지를 표시하지 않는다.
- Demo 결과에 사용할 문구:

```text
Demo preview only
No actionable booking coordinate is available. Results use the Ho Chi Minh City demo reference and cannot approve a live policy decision.
```

- production reference가 없고 Demo도 계산할 수 없으면 `BLOCKED_NO_REFERENCE`를 사용한다.
- `READY_WITH_PRODUCTION_EVIDENCE`는 reference.kind가 BOOKING이고 API 근거가 complete일 때만 가능하다.
- page component가 metric label/value 문자열을 검색해 상태를 유추하지 않게 한다.

### P0-2 테스트

- Demo reference + eligible Partner가 있어도 Ready가 아니다.
- BOOKING reference + complete evidence + eligible supply에서만 production Ready다.
- reference label 문구가 바뀌어도 상태 판정은 변하지 않는다.
- Demo/blocked/ready의 badge, notice, CTA가 서로 모순되지 않는다.

## 9. P1-1 — 표본을 전체 공급으로 오해하지 않게 함

### 현재 문제

기존 provider endpoint는 `id desc` 최신 30명만 읽고 totalCount가 없다. 화면은 이를 근거로 `no eligible Partner supply`라고 절대적으로 말한다.

### 필수 구현

- 새 server preview가 실제 production query 범위 전체를 집계하면 exact count임을 응답에 표시한다.
- 후보 상세 반환은 상위 N명으로 제한하되 전체 stage count는 잘리지 않게 한다.
- 전체 집계가 불가능하거나 의도적으로 표본만 사용하면 `truncated: true`와 `INCOMPLETE_EVIDENCE` 상태를 사용한다.
- truncated 상태에서 다음 문구를 금지한다.

```text
No eligible Partner supply
0 eligible Partners globally
Ready
```

- 대신 다음처럼 범위를 포함한다.

```text
Evidence incomplete · 0 eligible in the evaluated sample
30 of 120 Partner records evaluated
```

- Simulation route가 새 endpoint를 사용하면 기존 `/admin/operations-policy/providers?take=30` 조회가 더 이상 필요하지 않은지 확인한다. Supply workspace가 계속 사용하면 endpoint 자체를 제거하지 말고 Simulation load plan에서만 불필요한 fetch를 제거한다.

## 10. P1-2 — current preview와 historical evidence 분리

### 현재 문제

`policySimulation.ready`가 false이면 다음 독립 섹션도 모두 숨긴다.

- Policy change impact
- Policy impact drill-down
- Policy outcome effect

### 필수 구현

페이지를 두 개의 독립 영역으로 구성한다.

```text
Current dispatch preview
Historical policy evidence
```

- current preview는 reference/supply 조건에 따라 blocked/demo/incomplete/ready가 될 수 있다.
- historical evidence는 booking sample API가 성공하면 current preview 상태와 무관하게 렌더링한다.
- booking sample이 0이면 역사 섹션 내부의 명확한 empty state를 표시한다.
- booking API가 실패하면 current preview까지 무조건 실패시키지 말고 dependency를 구분한다. 단, preview endpoint 자체가 booking reference를 선택하지 못하면 해당 preview 상태만 정확히 표시한다.
- 역사 섹션 제목과 설명에서 현재 공급 진단이 아니라 과거 booking policy snapshot 근거임을 명시한다.

권장 안내:

```text
Current dispatch preview is blocked, but historical policy evidence is still available below.
```

### 테스트

- no eligible supply에서도 세 historical section이 렌더링된다.
- booking sample 0에서는 각 0값 표를 남발하지 않고 하나의 유용한 empty state를 보여 준다.
- booking API 실패와 preview API 실패가 서로 다른 오류 상태로 표시된다.

## 11. P1-3 — stale Partner 초대 수치 오류 제거

서버 production resolver를 재사용하면 stale Partner가 실제 invitable count에 들어가지 않아야 한다.

- client-side fallback 로직이 남는 경우 `invitedPartners = freshEligible...` 계약을 적용한다.
- 가능한 경우 client-side candidate 계산 자체를 제거한다.
- `would be invited now` 수치는 server가 반환한 invitable count만 사용한다.
- candidate list에서 stale record를 진단 목적으로 보여 줄 수는 있지만 `Excluded · stale location`으로 명확히 표시하고 invite count에 넣지 않는다.

### 테스트

- stale Partner는 candidate diagnostic에 나타날 수 있어도 invited/ready count에는 포함되지 않는다.
- UI 설명과 count가 같은 source field를 사용한다.

## 12. P1-4 — checked time과 evidence freshness 분리

### 현재 문제

`page.tsx`의 `new Date().toISOString()`은 렌더 시각일 뿐 source freshness가 아니다. 새로고침만 해도 최신처럼 보인다.

### 필수 구현

- `checkedAt`은 API가 preview를 계산한 시각이다.
- `evidence.newestAt`, `evidence.oldestAt`은 실제 근거 레코드 시각에서 계산한다.
- Partner location은 `currentLocationUpdatedAt`, reference booking은 실제 booking/ref timestamp를 사용한다.
- Admin UI에서는 기존 `DateTimeText`, `formatRelativeTime`, `Intl.DateTimeFormat` 등 공통 시간 도구를 재사용한다.
- ICT 절대 시각과 상대 시각을 함께 보이게 한다.

예:

```text
Checked 23:22 ICT · just now
Partner evidence newest 2h ago · oldest 3d ago
```

- raw ISO 전체 문자열을 기본 운영 화면에 노출하지 않는다.
- 새로고침 후 checkedAt만 바뀌고 evidence timestamp가 같으면 그 차이를 그대로 보여 준다.
- `Refresh evidence`는 `Re-run preview`로 변경하고 pending/loading 중 중복 요청을 막는다. 현재 구현이 server navigation link라 별도 state가 불필요하면 새 client state를 만들지 않는다.

## 13. P1-5 — blocker funnel과 원인별 CTA

현재 위치 문제 하나로 모든 차단을 설명하지 않는다. 서버가 생산 후보 계약에서 실제 단계별 count를 반환하고 UI는 다음과 같은 짧은 funnel로 표시한다.

```text
Evaluated
→ Online/available
→ Identity & required documents
→ Requested service
→ Fresh location
→ Inside radius
→ Invitable / final gate
```

### UI 요구

- 각 단계에 passed/excluded count를 표시한다.
- 0이 되는 첫 번째 단계를 primary blocker로 표시한다.
- primary blocker에 맞는 CTA 하나를 주 행동으로 둔다.
- 다른 원인은 secondary link 또는 상세 disclosure로 둔다.
- 모든 단계를 큰 KPI 카드로 만들지 않는다. 한 줄 funnel, compact step list, 또는 existing Admin task breakdown을 재사용한다.
- 현재 route와 실제 큐를 확인한 뒤 링크한다. 존재하지 않는 관리 큐를 새로 만들지 않는다.

예시 매핑은 현재 route를 확인해 조정한다.

| blocker | 권장 행동 |
|---|---|
| availability/status | Partner Controls의 availability/status 큐 |
| verification/KYC/documents | Partner approval 큐 |
| service eligibility | Service Catalog 또는 Partner detail service section |
| stale/missing location | `/partner-controls?details=controls&review=location` |
| outside radius | reference와 radius 정책 검토 |
| wallet/final gate | wallet/Partner control 관련 기존 큐 |
| incomplete evidence | 재실행 또는 evidence scope 설명 |

정확한 destination이 없는 경우 잘못된 링크를 만들지 말고 `Open Partner details` 또는 `Review Supply workspace`처럼 실제 존재하는 상위 큐로 보낸다.

## 14. P2 — 화면 명칭, active state, 운영 문구

### 14.1 명칭

- workspace tab은 기존 IA를 크게 흔들지 않기 위해 `Simulation`을 유지할 수 있다.
- 페이지 내부 제목은 `Current dispatch preview` 또는 `Matching policy preview`로 변경한다.
- `Live policy simulator`, `Ready for dispatch check`처럼 실제 기능보다 강한 표현을 제거한다.
- what-if 입력이 없다는 사실을 내부 구현 설명으로 길게 쓰지 않는다.

### 14.2 active workspace

- `aria-current="page"`는 보존한다.
- 기존 primary/accent token을 사용해 배경, border/indicator, font weight 중 최소 두 가지로 현재 탭을 구분한다.
- 색상 하나만으로 선택 상태를 표시하지 않는다.
- operations-policy workspace에만 scope하고 공통 Admin link 기본 스타일을 전역 변경하지 않는다.
- light/dark 모두 확인한다.

### 14.3 문구

운영자가 이해할 수 있도록 다음 방향을 적용한다.

| 기존 | 변경 방향 |
|---|---|
| `Observed 2026-...Z` | `Checked 23:22 ICT · 2 min ago` |
| `30 bounded Partner records` | exact coverage 또는 `partial sample` 명시 |
| `Simulation prerequisites are not met` | `Cannot run a production dispatch preview` |
| `No zero-result simulation tables are shown` | 제거 |
| `Review Partner readiness` | primary blocker에 맞는 구체적 동사 |
| `Refresh evidence` | `Re-run preview` |
| `Ready` | `Ready with production evidence` |

사용자-facing copy는 Partner를 사용하고 내부 코드에서만 provider naming을 유지한다.

## 15. 권장 최종 화면 순서

```text
Operations Policy
Policy workspaces: Policies / Supply / Simulation / Audit

Current dispatch preview
[status] [Re-run preview]
Reference · checked time · source freshness · evidence coverage

Demo/Incomplete/Unavailable notice — 해당할 때만

Primary blocker
Compact blocker funnel
[primary action] [Review Supply]

Candidate preview — production reference와 의미 있는 데이터가 있을 때만
Dry run only · no booking, participant, or notification was created

Historical policy evidence
Policy change impact
Policy impact drill-down
Policy outcome effect
```

같은 차단 결론을 badge, warning, empty state로 세 번 반복하지 않는다. 상태, 이유, 다음 행동의 세 층으로 정리한다.

## 16. 오류·권한·빈 상태

다음 상태를 각각 테스트하고 운영 문구를 구분한다.

### Permission denied

- 기존 Developer/System diagnostics 권한 계약을 보존한다.
- API 403과 빈 데이터 0을 구분한다.

### Preview unavailable

- API 500/timeout을 `No eligible supply`로 바꾸지 않는다.
- `Evidence unavailable`과 retry action을 표시한다.

### No production reference

- Demo가 있으면 `Demo preview only`.
- Demo도 없으면 `No actionable booking reference`.

### Incomplete evidence

- sample coverage를 정확히 표시하고 absolute conclusion을 금지한다.

### No eligible supply with complete evidence

- production query가 전체 범위에서 0을 증명했을 때만 `Blocked · no eligible Partner supply`를 사용한다.
- primary blocker와 recovery CTA를 표시한다.

### Ready with production evidence

- booking reference, complete evidence, production candidate contract가 모두 충족될 때만 사용한다.
- `Dry run only` 안전 문구를 함께 표시한다.

## 17. 자동 테스트 요구사항

### API / production contract

- production candidate resolver와 preview 결과 ID 일치.
- status, KYC, verification, required docs, service, reject, preferred Partner, freshness, radius, invitation limit 경계.
- deterministic reference selection.
- terminal booking을 production reference로 잘못 선택하지 않음.
- Demo에서 production Ready 불가.
- exact coverage와 truncated coverage 상태 구분.
- endpoint 권한 200/403.
- 500/error와 no supply 구분.
- 모든 mutation mock 0회.

### Admin Web

- structured status별 header badge/notice/copy.
- string label 검색으로 Demo를 판정하지 않음.
- Demo + candidate가 있어도 Ready copy 없음.
- incomplete sample에서 absolute no-supply copy 없음.
- no supply에서도 historical evidence 렌더링.
- stale Partner가 invited count에 없음.
- checkedAt과 evidence freshness 별도 표시.
- primary blocker별 CTA href/label.
- Simulation workspace `aria-current`와 시각 class/token.
- unavailable/403/empty/blocked/demo/ready 상태.
- page-level horizontal overflow를 유발하는 고정 폭 추가 없음.

source 문자열 포함 여부만 검사하는 테스트로 끝내지 않는다. builder/route response/component render의 실제 값과 상태 전환을 검증한다.

## 18. 성능 기준

- Admin Web에서 전체 Partner row를 받아 재계산하지 않는다.
- 서버에서 전체 count와 top candidate만 반환한다.
- N+1 query를 만들지 않는다.
- 기존 production query helper가 여러 relation을 요구하면 select/include를 필요한 필드로 제한한다.
- Simulation route의 API 호출을 기록하고 불필요한 provider sample fetch를 제거한다.
- historical booking 20건 제한은 근거 섹션에 적절하면 유지한다.
- 새 endpoint는 read-only이므로 cache보다 정확한 freshness를 우선한다. 측정 없이 새 cache를 추가하지 않는다.
- browser console warning/error 0을 유지한다.

## 19. 접근성·디자인 품질 기준

- 기존 Admin design token, `AdminSection`, `AdminNoticeCard`, `StatusBadge`, `AdminEmptyState`, form-control link/button을 재사용한다.
- 새 임의 색상, radius, shadow, font system을 만들지 않는다.
- active tab과 blocked/ready 상태를 색상만으로 구분하지 않는다.
- heading level과 section 이름을 논리적으로 유지한다.
- 동적 재실행 결과가 client interaction으로 바뀌는 경우 적절한 `role="status"`를 사용하되 같은 메시지를 중복 announce하지 않는다.
- 모든 CTA는 키보드로 접근 가능하고 label만 읽어도 목적을 이해할 수 있어야 한다.
- 긴 Partner 이름, 큰 count, 긴 blocker 문구에서도 overflow가 없어야 한다.
- light/dark 모두 확인한다.
- 1024px 이하 반응형 작업은 하지 않는다.

## 20. 검증 명령

먼저 package scripts를 확인하고 현재 저장소에 맞게 조정한다. 최소 다음을 실행한다.

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- app/operations-policy components/admin-form-control-usage.spec.tsx

npm.cmd run test --workspace @massage-vn/api -- src/bookings/bookings.backup-providers.spec.ts src/bookings/bookings.provider-readiness.spec.ts src/matching/matching.policy.spec.ts src/admin/admin.controller.spec.ts src/admin/admin.service.spec.ts -t "operations policy|matching preview|backup provider"

npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run typecheck --workspace @massage-vn/api
npm.cmd run policy:admin-consistency
```

변경한 파일에 대해 관련 lint를 실행한다.

```powershell
npm.cmd exec --workspace @massage-vn/admin-web -- eslint app/operations-policy lib/operations-policy.ts lib/admin-api.ts

npm.cmd exec --workspace @massage-vn/api -- eslint src/admin src/bookings/bookings.backup-providers.ts src/bookings/bookings.provider-readiness.ts
```

protected matching/bookings behavior를 변경했으면 `AGENTS.md`에 따라 최소 다음을 추가한다.

```powershell
npm.cmd run verify:scope -- -Scope api
npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:local
```

`verify:local`이 환경 의존성 때문에 실패하면 숨기지 말고 실패 단계, 이번 변경과의 관련성, 대체 검증 결과를 기록한다. 무관한 기존 실패를 고치기 위해 범위를 넓히지 않는다.

UI 수정이 끝나면 Impeccable detector가 사용 가능한 환경에서 한 번만 실행한다.

```powershell
node C:\Users\laboy\.codex\skills\impeccable\scripts\detect.mjs --json apps/admin_web/app/operations-policy/page.tsx apps/admin_web/app/operations-policy/operations-policy-live-simulator-section.tsx apps/admin_web/app/globals.css
```

detector 지적은 기계적 품질 참고이며 실제 운영 계약과 브라우저 검증보다 우선하지 않는다.

## 21. 브라우저 검증

현재 소스와 실행 build가 같은지 확인한 뒤 로그인된 로컬 관리자 화면을 직접 검증한다.

### 필수 화면

1. 1440×1000 light 기본 상태.
2. 1600×1000 light 기본 상태.
3. 1440×1000 dark 기본 상태.
4. 현재 자연 데이터의 Demo/blocked 상태.
5. `Re-run preview` 전후 checkedAt과 evidence freshness.
6. primary CTA 목적지.
7. historical evidence가 blocked 상태에서도 보이는 화면.
8. 권한이 허용되면 restricted 403 상태. 계정이 없으면 자동 테스트로 증명하고 한계를 보고.
9. unavailable fixture 또는 자동 테스트 근거.
10. production Ready 상태는 안전한 기존 fixture/test seam이 있을 때만 화면 캡처.

### 금지

- 실제 Partner 위치/KYC/status/wallet을 바꿔 Ready를 만들지 않는다.
- 실제 booking을 생성하지 않는다.
- 실제 정책을 저장하지 않는다.
- 실제 알림을 보내지 않는다.
- Ready를 자연 데이터로 재현할 수 없으면 source/integration/component 테스트 근거와 재현 한계를 명시한다.

### 브라우저 합격 기준

- 1440/1600에서 가로 overflow 없음.
- 현재 Simulation workspace가 시각적으로 구분됨.
- 상태, 이유, 다음 행동이 첫 화면에서 명확함.
- Demo/incomplete가 production Ready로 보이지 않음.
- blocked 상태에서도 historical evidence 접근 가능.
- primary CTA가 실제 존재하는 올바른 큐로 이동함.
- raw ISO와 개발자용 구현 문구가 기본 화면에 없음.
- light/dark에서 텍스트와 경계가 읽힘.
- console warning/error 0.

## 22. 금지 사항

- P0를 남기고 CSS와 문구만 수정한 뒤 완료하지 않는다.
- production matching 규칙을 Admin Web에 복제하지 않는다.
- `startsWith('ONLINE')` 같은 추정 규칙을 유지하지 않는다.
- Demo 여부를 label 문자열 비교로 판정하지 않는다.
- incomplete sample을 global no-supply로 표현하지 않는다.
- stale Partner를 invited count에 넣지 않는다.
- current supply가 0이라는 이유로 historical evidence를 숨기지 않는다.
- production helper의 의미를 바꾸어 preview에 맞추지 않는다. preview가 production을 따라야 한다.
- what-if editor, chart framework, 새로운 DB table을 이번 작업에 추가하지 않는다.
- 공통 Admin button/link 기본 스타일을 전역으로 바꾸지 않는다.
- 실제 운영 데이터 mutation으로 브라우저 상태를 만들지 않는다.
- 테스트를 통과시키려고 business rule fixture를 거짓으로 완화하지 않는다.
- unrelated dirty worktree를 정리하지 않는다.
- 사용자 요청 없이 commit하지 않는다.

## 23. 완료 조건

다음 조건을 모두 충족해야 완료다.

- Admin Web의 별도 candidate 계산이 제거되거나 production resolver 결과만 표시한다.
- preview와 production marketplace 후보가 같은 fixture에서 일치한다.
- Demo reference가 production Ready가 될 수 없다.
- exact/incomplete evidence가 구분된다.
- global no-supply 문구는 complete evidence에서만 사용된다.
- stale Partner가 invited count에 들어가지 않는다.
- checkedAt과 source freshness가 분리된다.
- primary blocker와 원인별 CTA가 표시된다.
- current preview blocked 상태에서도 historical evidence가 보인다.
- 내부 제목이 기능을 과장하지 않는다.
- Simulation workspace의 active state가 시각·의미론적으로 분명하다.
- dry-run endpoint가 mutation을 만들지 않는 테스트가 있다.
- Admin/API 집중 테스트, typecheck, policy consistency가 통과한다.
- protected area 강화 검증 결과가 보고된다.
- 1440/1600 light/dark 브라우저 검증이 완료된다.
- 실제 운영 정책, booking, Partner, wallet, notification 데이터가 변경되지 않는다.

## 24. 최종 구현 보고서 형식

작업이 끝나면 다음 형식으로 보고한다.

```markdown
# Operations Policy Matching Preview remediation implementation report

## 결론
- 완료/부분 완료/차단
- 출시 판정
- 변경 후 자체 점수

## 시작 상태
- 기존 dirty worktree
- 재현한 P0/P1/P2

## 변경 파일
- 파일별 변경 이유

## 계산 계약
- production resolver 재사용 방법
- visible/invitable/final-gate 의미
- reference selection
- evidence coverage

## P0 해결 증거
### Production candidate parity
### Demo cannot become Ready
### Read-only mutation proof

## 운영 UI 개선
- blocker funnel
- CTA
- checked time/source freshness
- historical evidence
- active workspace/copy

## 테스트 결과
- 실행 명령
- passed/failed/skipped
- 기존 실패와 이번 회귀 구분

## 브라우저 증거
- 1440/1600
- light/dark
- 핵심 상태 screenshot 경로
- console 결과
- 재현하지 못한 상태와 이유

## 성능
- API 호출 수
- query/response 범위
- 불필요 fetch 제거

## 보호 영역
- 변경한 protected files
- verify:scope / verify:local 결과

## 데이터 안전
- schema/migration 변경 여부
- 실제 mutation 없음 근거

## 남은 위험
- 실제로 남은 항목만 기재

## 다음 권장 작업
- what-if policy comparison은 별도 작업으로 제안 가능
```

완료하지 못한 항목을 숨기지 않는다. 보고서만 새로 작성하고 끝내지 말고 실제 구현, 자동 테스트, 실행 build, 브라우저 화면을 근거로 최종 판정한다.
