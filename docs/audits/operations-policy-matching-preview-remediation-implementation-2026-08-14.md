# Operations Policy Matching Preview remediation implementation report

## 결론

- 구현 상태: 기능 범위 완료. 저장소 전체 출시 게이트는 기존의 무관한 실패 때문에 보류.
- 출시 판정: Matching Preview 자체는 release candidate. 전체 저장소 release는 `verify:scope`와 `verify:local`의 기존 실패 정리 후 재판정.
- 변경 후 자체 점수: 94/100.
- `/operations-policy?details=matching&matching=simulation`은 더 이상 Admin Web 표본으로 후보를 재계산하지 않고, production booking matching과 같은 서버 후보 helper를 사용하는 read-only `Current dispatch preview`다.

## 시작 상태

- 시작 시 worktree에는 Admin, API, 모바일, public web, infra, audit 자료의 대규모 기존 변경과 untracked 파일이 있었다.
- 기존 변경을 reset, checkout, cleanup 또는 일괄 format하지 않았다.
- 재현한 핵심 문제는 Admin Web의 별도 candidate 계산, Demo reference의 성공 오인 가능성, 30-row 표본의 전체 공급 오인, current supply 차단 시 historical evidence 동반 은닉이었다.

## 변경 파일

- `apps/api/src/bookings/bookings.backup-providers.ts`: production과 preview가 함께 쓰는 단계별 후보 predicate, alert, wallet, radius, invitation finalization helper.
- `apps/api/src/bookings/bookings.service.ts`: production backup Partner resolver가 공통 helper를 사용하도록 연결.
- `apps/api/src/admin/admin-matching-preview.ts`: deterministic booking reference와 exact stage counts를 계산하는 read-only preview builder.
- `apps/api/src/admin/admin-matching-preview.spec.ts`: Demo, terminal reference, incomplete coordinate, parity, no-write 회귀 테스트.
- `apps/api/src/admin/admin-partner.routes.ts`, `admin.service.ts`: Developer/System diagnostics GET endpoint 연결.
- `apps/api/src/admin/admin-operator-category.guard.ts`, `admin-route-domain.ts` 및 spec: 권한과 route ownership 계약.
- `apps/admin_web/lib/admin-api.ts`: 구조화된 preview 응답 타입.
- `apps/admin_web/app/operations-policy/operations-policy-page-model.ts`, `page.tsx`: simulation load plan을 preview API로 전환하고 current/historical dependency를 분리.
- `apps/admin_web/app/operations-policy/operations-policy-live-simulator-section.tsx`: 구조화된 상태, blocker funnel, freshness, CTA, dry-run 표시.
- `apps/admin_web/app/operations-policy/policy-distance-format.ts`: 작은 공통 거리 formatter.
- 관련 Admin/API spec과 `apps/admin_web/app/globals.css`: 상태별 렌더링, active workspace, 데스크톱 레이아웃 회귀 방지.
- 기존 client-side `policy-simulation.ts`와 spec은 제거했다.

## 계산 계약

### Production resolver 재사용

- production과 preview 모두 `backupProviderCandidateStageWheres`를 사용한다.
- status, blocked account, verification, KYC, 필수 문서, requested service, reject history, preferred Partner, fresh location을 동일한 Prisma predicate로 적용한다.
- 이후 `resolveBackupProviderDispatchCandidates`가 radius와 booking alert preference를 적용한다.
- `finalizeBackupProviderDispatchCandidates`가 현재 production wallet gate와 invitation limit/order를 적용한다.

### 단계 의미

- `Online / available`: production이 허용하는 `ONLINE_AVAILABLE` 또는 `ONLINE_AVAILABLE_SOON`.
- `Fresh dispatch location`: 정책의 freshness cutoff를 통과한 위치 근거.
- `Inside matching radius`: production 거리 계산을 통과한 Partner.
- `Matching alert preferences`: booking service/customer 조건과 Partner alert 설정이 일치한 Partner.
- `Final invitation gate`: 현재 production wallet gate를 통과한 Partner.
- `Invitation limit`: 거리순 정렬과 현재 invitation cap 적용 결과.

### Reference selection

- 명시적 `referenceBookingId`가 있으면 해당 booking을 확인하되 terminal/expired 상태는 production reference로 승인하지 않는다.
- 자동 선택은 `OPEN_MATCHING`, unexpired, service 존재 조건에서 `openedAt`, `createdAt`, `id` 순으로 deterministic하다.
- booking이 없으면 Demo metadata만 반환하며 supply query를 실행하지 않는다.
- `null` coordinate를 숫자 0으로 바꾸지 않는다.

### Evidence coverage

- stage count는 표본이 아닌 server-side count query다.
- candidate 상세만 invitation 결과 상위 10개로 제한한다.
- Demo는 `totalEvaluated: 0`, `stages: []`, `DEMO_PREVIEW_ONLY`이며 production coverage 결론을 만들지 않는다.

## P0 해결 증거

### Production candidate parity

- production service와 preview가 공통 where/radius/alert/wallet/limit helper를 호출한다.
- protected focused API suite 8 files, 322 tests가 통과했다.
- status, readiness, matching policy와 backup provider 경계 테스트가 같은 실행에서 통과했다.

### Demo cannot become Ready

- API status가 `reference.kind`와 구조화된 enum으로 결정된다.
- Demo path는 Partner 공급을 평가하지 않으며 `READY_WITH_PRODUCTION_EVIDENCE`를 반환할 수 없다.
- 자연 브라우저 데이터에서도 `Demo preview only`, `Not production evidence`, `Not evaluated`가 표시되고 `Ready` 문구는 0건이었다.

### Read-only mutation proof

- endpoint는 count, aggregate, findMany, wallet groupBy와 policy read만 수행한다.
- mutation mock 0회 테스트가 통과했다.
- 브라우저 검증에서는 preview 재실행과 read-only queue 이동만 수행했다. 정책 저장, booking 생성, Partner/KYC/location/wallet 변경, notification 발송은 하지 않았다.

## 운영 UI 개선

- 기능명을 `Current dispatch preview`로 낮춰 실제 현재 정책 진단 범위와 맞췄다.
- Demo, unavailable, incomplete, blocked-no-supply, production-ready를 문자열 검색 없이 구조화된 status로 렌더링한다.
- production booking일 때만 단계별 funnel과 candidate preview를 보여 준다.
- checked time과 Partner source freshness를 분리하고 `DateTimeText`와 상대 시각을 사용한다.
- primary blocker가 정확한 운영 큐 CTA를 제공한다.
- historical policy snapshot/impact/drill-down/outcome은 current preview가 Demo 또는 blocked여도 독립적으로 렌더링한다.
- Simulation workspace는 `aria-current`와 기존 Admin active token으로 구분한다.

## 테스트 결과

- PASS: Admin Operations Policy suite, 46 files / 206 tests.
- PASS: protected focused API suite, 8 files / 322 tests.
- PASS: required filtered API command, 3 passed files / 10 passed tests; 2 files와 853 tests는 filter로 skipped.
- PASS: Admin/API typecheck.
- PASS: changed Admin/API ESLint.
- PASS: `policy:admin-consistency`.
- PASS: Admin/API production build.
- PASS: `git diff --check`; line-ending warning만 존재.
- FAIL, unrelated: API scope는 기존 Push campaign persistence test 1건 실패. 결과는 2401 passed, 11 skipped이며 API typecheck/lint/build는 계속 통과.
- FAIL, unrelated: Admin scope는 shared notice CSS expectation, company-bank navigation expectation, 날짜 고정 Finance Closeout age expectation 3건 실패.
- `verify:local` 완료: API/Admin/public web build, Admin/API typecheck, customer/provider Flutter analyze/test 통과. Docker service smoke는 환경상 skipped.
- `verify:local` 기존 실패: external setup/authority/Vietnam scope/API domain smoke/Supabase schema/Admin full test. 주요 근거는 누락된 deferred setup copy/authority marker, 문서의 비표준 Vietnam timezone 문자열, API domain assertion, `FINANCE_EVIDENCE` SQL enum alignment, 위 Admin 3 tests다.
- Impeccable detector는 마지막에 한 번 실행했다. 현재 task selector가 아닌 전역 `globals.css`의 기존 side-tab 패턴 6건만 warning으로 보고해 exit 1이었다.

## 브라우저 증거

- URL: `http://localhost:3101/operations-policy?details=matching&matching=simulation`
- 1440x1000 light: `output/operations-policy-matching-preview-verification-2026-08-14/01-demo-preview-light-1440x1000.png`
- historical full page: `output/operations-policy-matching-preview-verification-2026-08-14/02-demo-preview-historical-light-1440-full.png`
- 1600x1000 light: `output/operations-policy-matching-preview-verification-2026-08-14/03-demo-preview-light-1600x1000.png`
- 1440x1000 dark: `output/operations-policy-matching-preview-verification-2026-08-14/04-demo-preview-dark-1440x1000.png`
- rerun: `output/operations-policy-matching-preview-verification-2026-08-14/05-demo-preview-rerun-dark-1440x1000.png`
- CTA destination: `output/operations-policy-matching-preview-verification-2026-08-14/06-open-matching-bookings-cta-dark-1440x1000.png`
- 1440/1600 모두 document horizontal overflow가 없었다.
- raw ISO visible copy는 없었다.
- `Re-run preview` 후 `checkedAt`은 `2026-08-13T21:56:09.265Z`에서 `2026-08-13T21:58:11.662Z`로 갱신됐다. Demo에는 Partner evidence가 없으므로 source freshness는 계속 Unavailable로 정직하게 유지됐다.
- CTA는 `/bookings?view=matching`의 `Live bookings > Matching now`로 이동했고 browser back 후 동일 preview query가 복원됐다.
- console error/warning은 0건이었다.
- 403, preview unavailable, production Ready는 안전한 자연 데이터/account가 없어 브라우저에서 인위적으로 만들지 않았고 route/guard/component tests로 증명했다.

## 성능

- Simulation load plan에서 기존 Partner 30-row client sample fetch를 제거했다.
- 전체 Partner row는 Admin Web으로 전송하지 않는다.
- 서버는 병렬 count/aggregate와 한 candidate query, 필요한 경우 한 wallet groupBy를 사용한다.
- candidate response는 top 10이고 historical bookings는 기존 20건 제한을 유지한다.
- 새 dependency, cache, polling abstraction을 추가하지 않았다.

## 보호 영역

- 변경: `apps/api/src/bookings/bookings.backup-providers.ts`, `apps/api/src/bookings/bookings.service.ts`.
- 강화 검증으로 protected focused API 322 tests, API scope, Admin scope, `verify:local`을 모두 실행했다.
- scope/local의 실패는 위와 같이 이번 matching preview와 무관한 기존 변경에서 발생했고 숨기지 않았다.

## 데이터 안전

- 이번 작업은 Prisma schema 또는 migration을 추가하지 않았다.
- 실제 운영 정책, booking, participant, notification, audit, wallet ledger를 변경하지 않았다.
- endpoint 권한은 `DEVELOPER_SYSTEM`으로 fail-closed하며 200/403 route tests가 있다.

## 남은 위험

- 자연 데이터에 active actionable booking이 없어 production Ready/blocked funnel의 실제 화면 캡처는 없다. 상태는 API/component tests로 검증했다.
- 전체 저장소 release gate에는 본 작업 외 기존 실패가 남아 있다.
- 현재 production wallet gate 의미는 기존 production 계약을 그대로 따른다. 정책 자체를 바꾸는 작업은 이 preview 범위에 포함하지 않았다.

## 다음 권장 작업

- 별도 작업에서 실제 운영 데이터를 변경하지 않는 fixture seam으로 production Ready, exact blocked, unavailable, 403의 브라우저 visual regression을 자동화한다. Proposed-policy what-if 비교는 현재 read-only preview 위에 별도 기능으로 설계한다.
