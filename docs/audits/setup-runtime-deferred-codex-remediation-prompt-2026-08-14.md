# Codex 실행 프롬프트 — Setup Deferred 운영 원장·Launch policy·1440px UX 개선

아래 프롬프트 전체를 새 Codex 작업에 그대로 붙여 넣고 실행한다.

---

## 1. 역할과 최종 목표

너는 다음 역할을 동시에 수행하는 시니어 엔지니어다.

- 1인 운영자를 위한 Admin UX 설계자
- Next.js App Router 프런트엔드 엔지니어
- NestJS health/readiness 계약 설계자
- 출시 범위와 운영 안전성 검증자
- 테스트·빌드·실행 서버·브라우저 QA 담당자

이번 작업은 추가 분석 보고서나 새 프롬프트 작성이 아니다. 아래 요구사항을 실제 코드에 구현하고, 테스트하고, 실행 서버를 재시작한 뒤 1440px 이상 브라우저에서 증거를 남겨라.

최종 목표:

> 현금 결제 MVP에서 의도적으로 보류한 MoMo, VNPay, Referral app links를 현재 장애처럼 보이지 않게 하면서도, 1인 운영자가 미래 재개 조건·검토 시점·정확한 다음 작업을 안전하게 추적할 수 있는 Deferred 운영 원장을 만든다.

운영 시간대의 기준은 반드시 베트남 현지 시간인 Asia/Ho_Chi_Minh, UTC+7이다. Asia/Bangkok으로 표기하지 마라.

## 2. 작업 경로와 필수 자료

정확한 작업 저장소:

    C:\dev\massage-on-demand-vn

수정 금지 저장소:

    C:\dev\massage-vn-workspace

주요 대상 URL:

    http://localhost:3101/setup?mode=runtime&view=deferred

의미상 정규 URL:

    http://localhost:3101/setup?mode=readiness&view=deferred

작업 전에 다음 자료를 반드시 읽어라.

- docs/audits/setup-runtime-deferred-final-reaudit-2026-08-14.md
- docs/audits/setup-runtime-deferred-final-reaudit-evidence-2026-08-14/
- docs/audits/setup-final-reaudit-2026-08-12.md
- docs/audits/setup-runtime-active-final-reaudit-2026-08-14.md
- docs/audits/setup-runtime-active-codex-remediation-prompt-2026-08-14.md
- AGENTS.md
- docs/operations/health-readiness.md
- docs/operations/external-services-launch-checklist.md
- 결제 및 cash-only launch scope 관련 현재 문서

보고서의 결론을 맹목적으로 복사하지 말고 현재 소스, 테스트, 실행 중인 서버 화면과 대조하라. 그러나 이미 확인된 결함을 다시 보고만 하고 구현하지 않는 것은 완료가 아니다.

## 3. 현재 감사 기준선

다음은 구현 전에 다시 확인해야 할 기준선이다.

- cash-only MVP에서 Deferred는 정확히 3개다.
  - MoMo
  - VNPay
  - Referral app links
- 현재 Needs action은 0이다.
- 이 3개는 현재 출시 차단 요소가 아니다.
- runtime/deferred 화면은 비활성 미래 기능을 Runtime health 아래에 노출한다.
- 기존 Deferred 표는 7열이며 현재 런타임에서 의미 없는 상태, 시간, 영향, 소유자 정보를 반복한다.
- 1440px에서 콘텐츠 래퍼 약 1065px, 표 약 1144px, 가로 넘침 약 79px이 확인됐다.
- 1440px 행 높이는 약 367~368px이고 단어가 비정상적으로 분절된다.
- 1600px에서도 행 높이가 약 217~218px이며 읽기 흐름이 좋지 않다.
- 서비스명과 행 작업 버튼을 동시에 보기 어렵다.
- 결제 관련 이동은 /payments의 기본 Capture ready / All methods로 열려 gateway readiness 근거가 되지 못한다.
- /referrals는 /referrals/customers로 이동하며 Referral link readiness 위치로 직접 연결되지 않는다.
- mode=readiness&view=deferred가 의미상 맞지만 기존 화면은 여전히 과도한 열과 잘린 작업을 가진다.
- 기존 테스트 통과는 현재 결함을 그대로 고정했을 가능성이 있다.
- 다음 신규 모델 표식은 기존 구현에서 확인되지 않았다.
  - evidence-gaps
  - evidenceGaps
  - notMonitored
  - evidenceHref
  - relatedWorkspaceHref
- API에 legacy isDeferredExternalCategory와 신규 externalServicePolicy가 함께 존재해 정책이 이중화되어 있다.
- 문서상 Android MVP는 public base URL과 Android 두 URL이 필요하고 iOS는 보류인데, 현재 health service는 Android와 iOS URL을 모두 요구할 수 있다.

## 4. 절대 보존해야 할 원칙

- cash-only 출시라는 이유로 결제 gateway 항목을 삭제하거나 숨기지 마라.
- MoMo와 VNPay를 현재 출시 blocker로 승격하지 마라.
- Referral app links를 cash-only blocker로 잘못 분류하지 마라.
- 설정값이 존재한다는 이유만으로 healthy 또는 ready라고 표시하지 마라.
- health/readiness 확인 과정에서 실제 결제, SMS, 이메일, 푸시, 환불, 지급 등 외부 부작용을 발생시키지 마라.
- 비밀값, 환경변수 키, 토큰, 계좌정보를 Admin UI나 API 응답에 노출하지 마라.
- 에러나 unknown을 0 또는 정상으로 바꾸지 마라.
- 새 사이드바 페이지를 만들지 말고 /setup 정보 구조 안에서 해결하라.
- Vuexy 및 현재 공용 컴포넌트와 토큰을 우선 재사용하라.
- 신규 UI 라이브러리를 추가하지 마라.
- 1024px 이하 반응형은 이번 감사와 완료 기준에서 제외한다.
- 1440px 이상 데스크톱 운영 환경을 우선 최적화한다.

## 5. 저장소 안전 규칙

- 현재 dirty worktree는 사용자 작업이다.
- git reset, checkout, clean 또는 무관한 파일 되돌리기를 하지 마라.
- .env, 실제 credential, 실제 gateway enable flag를 수정하지 마라.
- 실제 결제나 메시지 전송을 발생시키지 마라.
- 이 작업만을 위해 DB schema나 migration을 추가하지 마라.
- 인증과 권한 검사를 약화하지 마라.
- 링크 개선만을 위해 apps/api/src/payments/**의 보호된 결제 로직을 건드리지 마라.
- 단일 에이전트로 작업하고 하위 에이전트를 생성하지 마라.

## 6. 먼저 조사할 코드와 소비자

정확한 파일명은 현재 저장소에서 찾아야 한다. 최소한 다음 범위를 조사하라.

- apps/admin-web/app/setup/**
- apps/admin-web에서 Setup navigation, query parsing, tabs, tables, refresh를 담당하는 컴포넌트
- apps/admin-web/app/payments/**
- apps/admin-web/app/referrals/**
- apps/api/src/health/**
- launch scope, external service policy, deferred category 관련 공용 모델
- health/readiness 응답을 소비하는 테스트와 문서

최소 검색:

    rg -n "isDeferredExternalCategory|externalServicePolicy|Deferred|not monitored|evidenceHref|relatedWorkspaceHref|runbookHref" apps docs
    rg -n "MOMO|VNPAY|Referral app links|ANDROID|IOS|PUBLIC.*URL" apps docs
    rg -n "min-width|nth-child|overflow-x|table-layout|word-break|overflow-wrap" apps/admin-web/app/setup
    rg -n "mode=runtime|mode=readiness|view=deferred|view=active|view=evidence" apps/admin-web

기존 모델과 데이터 흐름을 이해하지 않은 채 화면에 하드코딩된 예외를 추가하지 마라.

## 7. Phase 0 — 구현 전 증거 고정

코드를 수정하기 전에 다음을 기록하라.

1. 현재 경로와 저장소 루트
2. git status와 관련 파일 diff
3. 위 신규 모델 표식 검색 결과
4. 현재 .next 빌드 시각과 실행 프로세스 시작 시각
5. 관련 테스트 기준선
6. 1440x1000 화면의 표 clientWidth, scrollWidth, 행 높이
7. runtime/deferred URL의 실제 선택 상태
8. 각 현재 작업 링크의 실제 도착 URL

기준선 수집 후에는 멈추지 말고 구현을 계속하라.

## 8. Phase 1 — 단일 Launch manifest와 정책

출시 범위 판정의 단일 진실 공급원을 만든다. 다음 항목이 서로 다른 조건문에서 독립적으로 계산되지 않게 하라.

- 현재 launch stage
- cash-only 여부
- required capability
- deferred capability
- blocker 여부
- Admin queue 분류
- API count
- 문서에서 설명하는 범위

권장 모델의 개념:

    launchStage
    currentStageRequired
    currentStageBlocking
    deferredReason
    futureReadiness
    reviewTrigger

반드시 만족할 정책:

- cash-only stage에서 MoMo와 VNPay는 Deferred다.
- Referral app links도 현재 범위에서 Deferred다.
- 이 세 항목은 Needs action count에 들어가지 않는다.
- 외부 서비스 전체 수, active 수, deferred 수, current stage readiness가 같은 manifest에서 파생된다.
- legacy isDeferredExternalCategory는 신규 정책으로 정규화하거나 제거한다.
- 호환성 때문에 남기면 내부 구현은 단일 policy를 호출하고, 테스트로 동일 결과를 보장한다.
- 정책 모호성이 실제 결제 노출을 바꾸지 않는다면 출시 차단으로 과장하지 말고 코드·문서 일치 문제로 해결한다.

## 9. Phase 2 — Deferred와 Future readiness 분리

현재 런타임 상태와 미래 재개 준비 상태를 분리한다.

권장 FutureReadiness:

    NOT_STARTED
    PARTIAL
    READY_FOR_REENTRY

필요 필드:

    launchScope
    deferredReason
    futureReadiness
    reentryChecks
    reviewTrigger
    reviewedAt
    evidenceHref
    relatedWorkspaceHref
    runbookHref

규칙:

- futureReadiness는 기존의 안전한 health/readiness check 결과에서 파생한다.
- 단순 config 존재 여부를 READY로 오판하지 않는다.
- reentryChecks는 운영자가 이해할 수 있는 문장이어야 한다.
- 환경변수 키나 secret 이름을 UI에 표시하지 않는다.
- reviewedAt이 없으면 unknown을 숨기지 말고 명확히 표현한다.
- 별도 DB 없이 현재 코드·문서 기반 파생 모델로 먼저 해결한다.

## 10. Phase 3 — Referral Android/iOS 정책 정합성

Referral app links의 현재 출시 기준을 명확히 통일한다.

- Android MVP 재개 조건:
  - public base URL
  - Android customer destination
  - Android partner destination
  - routing smoke verification
- iOS 관련 URL은 iOS release profile이 활성화되기 전까지 future/deferred다.
- Android 준비 상태를 계산할 때 iOS URL 부재 때문에 실패시키지 마라.
- API, Admin copy, 문서, 테스트가 같은 기준을 사용하게 하라.
- 향후 iOS launch stage가 추가될 때 별도 required 조건으로 승격할 수 있게 설계하라.

## 11. Phase 4 — URL과 정보구조 정규화

최종 구조:

    System Health
    └─ External Services
       ├─ Runtime health
       │  ├─ Needs action
       │  ├─ Active services
       │  └─ Evidence gaps
       └─ Launch readiness
          ├─ Needs action
          ├─ Required capabilities
          └─ Deferred

필수 동작:

- mode=runtime&view=deferred는 서버 측에서 mode=readiness&view=deferred로 정규화한다.
- 클라이언트 effect로 늦게 URL을 교체하지 마라.
- 정규화 후 올바른 탭과 뷰에 aria-current 또는 동등한 선택 상태가 있어야 한다.
- refresh 후에도 canonical URL과 선택 상태가 유지되어야 한다.
- 잘못된 mode/view 조합은 명시적 허용 목록에 따라 결정적으로 정규화한다.
- runtime의 Evidence gaps를 구현하고 unknown, notMonitored, evidenceGaps를 하나의 모호한 상태로 뭉개지 마라.

## 12. Phase 5 — Deferred 전용 운영 원장

Deferred 화면은 Runtime health 표의 재사용본이 아니라 미래 작업 원장이어야 한다.

상단 요약 문구의 의도:

    Deferred for cash-only launch 3
    These capabilities do not block the current launch.
    Review only when the trigger is reached.

운영자에게 보이는 표는 최대 5열:

1. Capability
2. Why deferred
3. Re-entry prerequisites
4. Review trigger
5. Action

기본 행에서 제거:

- Runtime health
- Not monitored
- Config check
- No current impact
- 의미 없는 history
- 반복되는 owner
- 반복되는 timestamp

추가 정보는 native details/summary 또는 기존 접근 가능한 disclosure 패턴으로 제공:

- future readiness
- 개별 re-entry checklist
- last reviewed
- evidence
- related workspace
- runbook
- owner가 실제로 필요한 경우에만 보조 정보

행별 문구는 반드시 구체적이어야 한다.

MoMo:

- 왜 보류됐는지 cash-only launch와 연결해 설명
- gateway 계약·sandbox 검증·reconciliation runbook 등 실제 재개 전제 표시
- 검토 트리거는 카드/전자결제 범위 승인 같은 운영 이벤트로 표현

VNPay:

- MoMo 문구를 복사하지 말고 VNPay에 맞는 전제와 검토 트리거 표시

Referral app links:

- Android public link와 customer/partner destination 준비를 표시
- iOS는 별도 future scope임을 표시
- 앱 배포 또는 referral campaign 활성화가 검토 트리거임을 설명

UI에 노출되는 운영 문구는 현재 제품 언어에 맞춰 자연스러운 영어로 작성한다. 개발자 용어와 환경변수명을 그대로 노출하지 마라.

## 13. Phase 6 — 1440px 데스크톱 레이아웃

Deferred 전용 표에서 다음 기존 제약을 제거하거나 격리하라.

- min-width: 1260px
- 7열 전용 nth-child 최소 너비
- 전역 word-break로 인한 단어 분절

1440x1000 필수 기준:

- scrollWidth <= clientWidth
- 수평 스크롤 없음
- Capability와 Action을 동시에 볼 수 있음
- 단어 중간 분절 없음
- 작업 버튼 라벨이 완전히 보임
- 기본 행 높이 목표 96~140px
- 3개 Deferred 항목을 짧은 스크롤 안에서 함께 비교 가능
- overflow hidden으로 콘텐츠를 잘라 통과시키지 않음
- 문서 전체의 단일 세로 스크롤 흐름 유지

1600x1000에서도 light/dark theme을 확인한다.

1024px 이하 대응을 위해 구조를 복잡하게 만들지 말고 이번 보고서에 포함하지 마라.

## 14. Phase 7 — 링크 의미와 정확한 도착점

링크 역할을 분리한다.

- evidenceHref: 해당 준비 상태를 증명하는 근거
- relatedWorkspaceHref: 관련 업무 화면
- runbookHref: 운영 절차 문서 또는 내부 가이드

규칙:

- /payments 기본 화면은 MoMo/VNPay readiness 근거가 아니다.
- 결제 페이지는 related workspace로만 표시한다.
- 기본 primary action은 Setup 내부에서 해당 capability의 checklist/details를 여는 것이어야 한다.
- 실제 지원되고 테스트된 query가 있을 때만 paymentMethod=MOMO 또는 paymentMethod=VNPAY 같은 보조 링크를 제공한다.
- Referral은 실제 존재하고 안정적인 anchor/query가 있을 때만 직접 연결한다.
- 없는 hash나 동작하지 않는 query를 꾸며내지 마라.
- 링크는 클릭 테스트로 최종 URL과 화면 문맥을 확인한다.

## 15. Phase 8 — 명칭과 중복 제거

권장 명칭:

- System Health
- External Services
- App Sessions
- Background Jobs
- Runtime health
- Launch readiness

제거 또는 정리:

- 같은 영역에서 Setup Readiness와 Launch readiness를 혼용하지 않는다.
- 같은 숫자를 헤더, 카드, 설명, 표에 불필요하게 반복하지 않는다.
- Deferred 3이라는 숫자는 요약과 목록 길이가 일치할 때만 표시한다.
- owner는 현재 행의 핵심 의사결정에 필요하지 않으면 기본 열에서 제거한다.

## 16. Phase 9 — Refresh 상호작용

Refresh는 장식 버튼이 아니라 검증 가능한 상태 전이를 제공해야 한다.

- 현재 mode/view/canonical URL 보존
- 기존 데이터를 즉시 지워 layout shift를 만들지 않음
- pending 동안 버튼 busy/disabled 처리
- 접근 가능한 진행 상태 문구
- 완료 시 마지막 확인 시각 또는 성공 상태
- 실패 시 기존 데이터를 보존하고 명시적인 오류 상태
- focus 보존
- 짧은 spinner flicker만 보이는 구현 금지
- 자동 polling 추가 금지
- 전체 페이지를 client component로 바꾸지 말고 필요한 leaf component만 client로 유지

## 17. Phase 10 — 문서 동기화

다음을 문서에 반영하라.

- 인증이 필요한 health/readiness 계약
- 단일 launch manifest의 역할
- cash-only에서 Deferred가 차단이 아닌 이유
- FutureReadiness 의미
- Referral Android와 iOS 범위 차이
- payment gateway 재검토 트리거
- 베트남 운영 시간대 Asia/Ho_Chi_Minh, UTC+7

소스와 문서의 분류가 다르면 둘 중 하나를 임의로 숨기지 말고 하나의 정책으로 통일한다.

## 18. 필수 테스트

API 테스트:

1. cash-only에서 Deferred가 정확히 MoMo, VNPay, Referral app links인지
2. 세 항목이 blocker count에 들어가지 않는지
3. 전체 service count와 그룹 count 합이 일치하는지
4. currentStageReady가 같은 manifest에서 계산되는지
5. legacy helper와 신규 policy 결과가 일치하거나 legacy가 제거됐는지
6. FutureReadiness 세 상태 계산
7. config 존재만으로 ready가 되지 않는지
8. Android 준비 계산에서 iOS 부재가 실패를 만들지 않는지
9. iOS release stage에서는 iOS 조건이 별도로 적용되는지
10. API 응답에 secret/env key가 없는지
11. evidence, related workspace, runbook 의미가 섞이지 않는지
12. health check가 외부 부작용을 만들지 않는지

Admin query/model 테스트:

1. mode별 허용 view
2. runtime/deferred의 readiness/deferred 정규화
3. 새로고침 후 canonical URL 유지
4. runtime Evidence gaps 분류
5. unknown, notMonitored, evidenceGaps의 구분
6. Deferred count와 행 수 일치
7. MoMo, VNPay, Referral의 구체적 copy
8. 잘못된 query 조합 fallback
9. Runtime active와 Deferred 데이터 중복 방지

컴포넌트 테스트:

1. 최대 5개 기본 헤더
2. Runtime health 열 미노출
3. Not monitored/config check/no current impact 반복 미노출
4. capability별 primary action
5. details/summary 키보드 접근
6. aria-expanded 또는 native semantics
7. 현재 탭 aria-current
8. refresh pending
9. refresh success
10. refresh error와 기존 데이터 보존
11. 긴 문구에서도 action 잘림 없음
12. 단어 중간 분절 방지
13. 베트남 시간대 표기

목적지 테스트:

1. MoMo related workspace 문맥
2. VNPay related workspace 문맥
3. Referral readiness 직접 위치
4. 존재하지 않는 hash/query 없음

기존 테스트 assertion이 결함을 고정하고 있다면 요구사항에 맞게 수정하라. 테스트를 통과시키기 위해 요구사항을 약화하지 마라.

## 19. 검증 명령

저장소에 실제 존재하는 스크립트를 확인한 뒤 최소한 다음을 실행한다.

    npm.cmd run test --workspace @massage-vn/admin-web -- app/setup
    npm.cmd run test --workspace @massage-vn/api -- src/health/health.controller.spec.ts src/health/health.service.spec.ts
    npm.cmd run test --workspace @massage-vn/admin-web -- app/referrals
    npm.cmd run typecheck --workspace @massage-vn/admin-web
    npm.cmd run typecheck --workspace @massage-vn/api
    npm.cmd run admin:visible-copy
    npm.cmd run verify:scope -- -Scope admin
    npm.cmd run verify:scope -- -Scope api
    npm.cmd run build --workspace @massage-vn/admin-web

referrals를 수정하지 않았다면 해당 테스트 생략 이유를 최종 보고서에 적는다.

공유 계약이나 보호된 영역을 건드렸다면 저장소 규칙에 따라 verify:local 등 상위 검증도 실행한다.

선택적으로 기존 정적 UX detector를 사용할 수 있지만, 이번 범위의 파일과 마커에 한정하고 결과를 수동 검토한다.

## 20. 빌드와 실행 서버 생명주기

실행 중인 Next 프로세스가 사용하는 .next에 바로 빌드하지 마라.

순서:

1. 관련 로컬 프로세스 상태 확인
2. 안전하게 admin-web 프로세스 중지
3. production build
4. production server 재시작
5. 프로세스 시작 시각 확인
6. .next build 시각이 프로세스 시작보다 이전인지 확인
7. HTTP 200 확인
8. 브라우저에서 신규 copy/구조/canonical URL 확인

최종 보고서에는 source, build artifact, running process가 같은 구현임을 입증하라.

## 21. 소스 마커 검증

구현 후 최소 검색:

    rg -n "evidence-gaps|evidenceGaps|notMonitored|deferredReason|futureReadiness|reviewTrigger|relatedWorkspaceHref|runbookHref" apps docs
    rg -n "Unknown or not monitored|View deferred scope|isDeferredExternalCategory|min-width: 1260px" apps docs

규칙:

- 신규 마커는 실제 데이터 흐름과 UI에서 사용되어야 한다.
- 검색 통과용 dead constant나 주석을 만들지 마라.
- 구형 문구와 스타일은 compatibility 또는 다른 화면에서 필요한 경우에만 남기고 이유를 기록한다.

## 22. 브라우저 QA와 증거

검사 viewport:

- 1440x1000
- 1600x1000

1024px 이하 화면은 검사하지 않는다.

필수 스크린샷:

1. runtime active
2. runtime evidence gaps
3. runtime/deferred 입력 후 canonical redirect 결과
4. readiness deferred 전체
5. Deferred 3개 행 비교
6. MoMo details
7. VNPay details
8. Referral details
9. Referral destination
10. refresh pending
11. refresh complete
12. dark theme 1600
13. light theme 1600

브라우저 확인:

- URL 정규화
- 정확한 mode/view 선택 상태
- Deferred 정확히 3개
- 각 항목의 보류 이유, 재개 조건, 검토 트리거, action
- Runtime 전용 문구 제거
- 기본 헤더 최대 5개
- scrollWidth <= clientWidth
- 행 높이
- 단어 분절 없음
- 키보드 Tab/Enter/Space
- focus 유지
- aria-current와 disclosure semantics
- 모든 링크의 실제 도착점
- refresh pending/completion/error
- light/dark
- console error 없음
- 실제 외부 부작용 없음

## 23. 완료 게이트

Gate A — 정책과 소스:

- 단일 launch policy
- Deferred 정확히 3
- blocker 0 유지
- Android/iOS 정책 일치
- secret 미노출

Gate B — URL과 화면:

- runtime/deferred canonical redirect
- readiness/deferred 선택 상태
- Evidence gaps 분리
- capability별 구체적 운영 문구

Gate C — 1440px:

- 수평 스크롤 없음
- service/action 동시 노출
- 단어 분절 없음
- 기본 행 높이 목표 충족

Gate D — 링크와 피드백:

- 모든 목적지 정확
- evidence/related/runbook 역할 분리
- refresh 상태 전이 검증

Gate E — 품질과 런타임:

- 관련 테스트 통과
- typecheck 통과
- visible copy 통과
- build 통과
- 재시작한 production server에서 브라우저 QA 통과

하나라도 실패하면 완료로 보고하지 말고 Release hold와 남은 항목을 명시한다.

## 24. 산출물

구현 보고서:

    docs/audits/setup-runtime-deferred-remediation-report-2026-08-14.md

증거 폴더:

    docs/audits/setup-runtime-deferred-remediation-evidence-2026-08-14/

보고서에 포함:

- 최종 판정과 점수
- 감사 기준선 대비 해결/미해결 표
- launch manifest 설계
- Deferred 3 분류 증거
- Needs action 0 증거
- Android/iOS 정합성
- canonical URL 증거
- 1440/1600 실측
- 각 링크 도착점
- refresh 상태 전이
- 접근성 확인
- light/dark
- source marker 검색
- 변경 파일
- 관련 git diff
- 테스트 명령과 실제 결과
- build 시각
- process 시작 시각
- HTTP 결과
- console 결과
- 보호된 파일 변경 여부
- 외부 mutation 없음
- 남은 위험과 다음 작업

모든 날짜와 시각은 Asia/Ho_Chi_Minh, UTC+7 기준임을 명시한다.

## 25. 권장 실행 순서

1. AGENTS.md와 관련 감사 자료 읽기
2. dirty worktree와 관련 diff 보호
3. 현재 source/API/UI/test/build/runtime 기준선 수집
4. 단일 launch manifest 정리
5. Deferred/FutureReadiness 모델 구현
6. Referral Android/iOS 정책 통일
7. URL 정규화와 Evidence gaps 구현
8. Deferred 전용 5열 이하 원장 구현
9. 링크 의미와 목적지 수정
10. refresh 상태 전이 구현
11. 문서 동기화
12. 테스트 추가·수정
13. typecheck와 정적 검증
14. 프로세스 중지 후 production build
15. production server 재시작
16. 1440/1600 브라우저 QA와 스크린샷
17. 구현 보고서 작성

## 26. 중단 조건

다음 상황에서만 구현을 중단하고 정확한 증거와 함께 보고한다.

- 실제 gateway 활성화가 요구되는 경우
- credential 또는 secret이 필요한 경우
- 실제 결제·메시지 전송이 필요한 경우
- 사용자 작업과 직접 충돌해 안전하게 병합할 수 없는 경우
- 권한 계약을 약화해야만 구현 가능한 경우

단순히 코드가 복잡하거나 기존 테스트가 실패한다는 이유로 중단하지 마라.

## 27. 최종 응답 형식

최종 응답은 짧되 다음을 빠뜨리지 마라.

1. Verdict: Ready 또는 Release hold
2. 실제 운영자 UX 변화
3. 단일 launch policy와 Deferred 3 증거
4. Android/iOS 정책 결과
5. canonical URL과 1440px 실측
6. 변경 파일
7. 실행한 테스트와 결과
8. build/process/HTTP/브라우저 증거
9. 보호된 파일 변경 여부
10. 외부 mutation 없음
11. 남은 위험과 다음 단계

기존 테스트 숫자를 복사하지 말고 이번 실행의 실제 결과만 사용한다. 브라우저에서 신규 구조와 canonical URL이 확인되지 않으면 완료로 보고하지 마라.

## 최종 지시

지금 바로 올바른 저장소에서 구현을 시작하라. dirty worktree를 보존하고, 단일 launch policy, Deferred와 Future readiness 분리, runtime/deferred 정규화, Evidence gaps, 최대 5열 운영 원장, capability별 문구, Android/iOS 정합성, 정확한 링크, refresh 상태 전이, 1440px 무수평스크롤을 실제 코드와 테스트로 완성하라.

production build와 서버 재시작 후 1440px 및 1600px에서 직접 검증하고, 베트남 시간대 Asia/Ho_Chi_Minh 기준의 구현 보고서와 스크린샷 증거를 남겨라.
