# Codex 실행용 프롬프트 — HANDS Admin 성능·정보구조 개선

아래 프롬프트를 `C:\dev\massage-on-demand-vn`을 작업 폴더로 연 Codex 작업에 그대로 붙여 넣는다. 다단계 작업이므로 Codex 앱에서 Plan mode를 사용할 수 있으면 먼저 `/plan`을 실행한 뒤 붙여 넣는 것을 권장한다.

---

## 복사해서 사용할 프롬프트

```text
목표

HANDS 관리자 웹의 현재 기능과 디자인 시스템을 보존하면서, 실제 운영자가 1440px 이상 데스크톱에서 빠르게 우선순위를 판단하고 업무를 처리할 수 있도록 성능, 정보구조, 화면 문구, 빈 상태와 접근성을 개선하라. 분석이나 제안만 작성하지 말고, 아래 범위의 코드를 직접 수정하고 실제 화면과 테스트로 검증하라.

작업 위치와 기준 자료

- 저장소: C:\dev\massage-on-demand-vn
- 관리자 웹: apps/admin_web
- 필요할 때만 수정 가능한 관리자 API: apps/api 또는 현재 저장소에서 실제 Admin API를 소유한 패키지
- 현재 관리자 URL: http://localhost:3101
- 기준 감사 보고서:
  C:\dev\massage-on-demand-vn\output\admin-full-performance-ia-audit-2026-08-08\admin-full-performance-ia-audit.md
- 기준 화면 캡처:
  C:\dev\massage-on-demand-vn\output\admin-full-performance-ia-audit-2026-08-08\01-setup-readiness.jpg
  C:\dev\massage-on-demand-vn\output\admin-full-performance-ia-audit-2026-08-08\02-partner-controls.jpg
  C:\dev\massage-on-demand-vn\output\admin-full-performance-ia-audit-2026-08-08\03-customers.jpg
  C:\dev\massage-on-demand-vn\output\admin-full-performance-ia-audit-2026-08-08\04-partner-directory.jpg
  C:\dev\massage-on-demand-vn\output\admin-full-performance-ia-audit-2026-08-08\05-partner-overview.jpg
  C:\dev\massage-on-demand-vn\output\admin-full-performance-ia-audit-2026-08-08\06-finance-overview.jpg
  C:\dev\massage-on-demand-vn\output\admin-full-performance-ia-audit-2026-08-08\07-settlement-repair-queue.jpg
  C:\dev\massage-on-demand-vn\output\admin-full-performance-ia-audit-2026-08-08\08-tax-close-overview.jpg
  C:\dev\massage-on-demand-vn\output\admin-full-performance-ia-audit-2026-08-08\09-notification-delivery.jpg
  C:\dev\massage-on-demand-vn\output\admin-full-performance-ia-audit-2026-08-08\10-marketing-analytics.jpg
  C:\dev\massage-on-demand-vn\output\admin-full-performance-ia-audit-2026-08-08\11-customer-usage.jpg
  C:\dev\massage-on-demand-vn\output\admin-full-performance-ia-audit-2026-08-08\12-shift-command.jpg
  C:\dev\massage-on-demand-vn\output\admin-full-performance-ia-audit-2026-08-08\13-live-bookings.jpg

작업 원칙

1. 먼저 AGENTS.md와 감사 보고서를 끝까지 읽고 현재 dirty worktree를 확인하라.
2. 기존 사용자 변경을 보존하라. reset, checkout, clean, 광범위한 자동 포맷, 관련 없는 리팩터링을 하지 마라.
3. 현재 브라우저의 로그인 세션을 사용할 수 있으면 in-app Browser로 실제 화면을 확인하라. 직접 Playwright CLI가 별도 허가를 요구하는 환경이면 허가 없이 우회하지 마라.
4. 현재 구현의 토큰, 공통 컴포넌트, 색상, 표, 배지, breadcrumb와 workspace 패턴을 디자인 기준으로 사용하라. 새로운 시각 체계를 만들지 마라.
5. 이 화면은 Operate 모드의 내부 관리자 도구다. 장식보다 스캔 속도, 상태 비교, 다음 행동, 오류 방지를 우선하라.
6. 1024px 이하와 모바일 디자인은 검사·수정·보고 범위에서 완전히 제외하라. 1440px 및 1692px 데스크톱에서만 검증하라. 다만 기존 모바일 코드를 일부러 깨뜨리지는 마라.
7. 관리자 화면의 표시 문구는 현재 제품 언어인 영어를 유지하되, 프로그래머 용어가 아니라 운영자 행동 언어로 작성하라.
8. 데이터 의미나 회계·예약·권한 규칙을 추측해서 바꾸지 마라. API 계약이나 DB 변경이 필요하면 기존 패턴을 확인하고 최소 범위로 구현하라.
9. 새 패키지는 표준 기능과 기존 의존성으로 해결할 수 없을 때만 추가하라.
10. 계획만 제시하고 멈추지 마라. 짧은 실행 계획을 만든 뒤, 파괴적 변경이나 외부 권한이 필요한 진짜 blocker가 없으면 구현과 검증까지 계속하라.

현재 확인된 성능 근거

- 현재 3101 프로세스는 `next dev --webpack --port 3101`이다.
- 콜드 라우트 전환은 약 18~62초지만 즉시 재로딩은 대부분 0.27~2.24초다.
- API 대표 응답은 대체로 6~350ms이므로 수십 초 지연의 1차 원인은 개발 컴파일이다.
- apps/admin_web/app/globals.css는 약 25,024줄이다.
- apps/admin_web/lib/admin-api.ts는 약 6,116줄이다.
- apps/admin_web/app 아래 loading.tsx는 현재 0개다.
- Shift Command에는 최대 14개 GET 코드 경로가 있고, Settlement Repair에는 15개가 있다.
- 모든 admin GET이 현재 `cache: 'no-store'`를 사용한다.
- Shift Command는 여러 데이터 소스를 `Promise.all`로 모두 기다린 후 본문을 렌더한다.

필수 구현 범위

P0. 운영용 실행과 개발용 실행 분리

- 기존 개발자 workflow를 망가뜨리지 말고 dev 명령은 개발용으로 유지하라.
- 프로젝트의 기존 script/배포 패턴을 먼저 확인한 뒤, 운영자 검수용 production build + start 명령을 명확하게 제공하라.
- 3101을 production server로 운영하고 dev server는 3102 같은 별도 포트로 실행할 수 있도록 package script 또는 문서를 정리하라.
- 현재 활성 프로세스를 임의로 종료하지 마라.
- Next.js 16에서 `--webpack`을 제거하고 기본 Turbopack을 사용할 수 있는지 실제 호환성을 검사하라. 호환이 확인되면 dev script를 단순화하고, 호환되지 않으면 원인과 필요한 Webpack 의존성을 문서화하라.
- production build를 실제 실행해 검증하라. 활성 dev의 `.next`와 충돌할 위험이 있으면 프로세스를 죽이지 말고 안전한 검증 방법을 사용하거나 정확한 blocker를 최종 보고하라.
- production 모드 측정 없이 “속도가 해결됐다”고 주장하지 마라.

P1. Shift Command 초기 렌더 병목 제거

- apps/admin_web/app/page.tsx의 두 단계 Promise.all과 최대 14개 GET 사용을 분석하라.
- 이미 있는 start-shift summary를 우선 재사용·확장해 초기 화면에 필요한 데이터를 1~3개 서버 호출로 축소하라.
- 초기 계약에는 다음만 포함하라.
  - 가장 오래된 최우선 action
  - 도메인별 action count
  - oldest age
  - 금액 또는 운영 impact
  - assignee/handoff 상태
  - generatedAt와 실패한 하위 source
  - 정확한 상세 queue URL
- 전체 Partner, booking, notification, payment 목록을 Shift Command에서 다시 받아 계산하지 않게 하라.
- Next action과 Open queues가 긴 표·차트보다 먼저 렌더되도록 Server Component와 Suspense 경계를 나눠라.
- 한 데이터 소스의 실패가 전체 Shift Command를 빈 화면으로 만들지 않게 부분 실패 상태를 구현하라.
- 화면 아래 Money status가 위의 Finance queue 수치를 반복하지 않도록 축약하라. 도메인 상세는 Finance Overview로 연결하라.

P1. 느린 페이지의 데이터·렌더 경계 개선

- 우선 대상:
  - /
  - /finance-closeout
  - /notifications
  - /operations-handoff
  - /partners
  - /marketing-analytics
- H1/상태 시각/핵심 action, KPI, 긴 표·차트를 별도 경계로 나눠라.
- 필요한 route에는 의미 있는 loading.tsx 또는 section-level fallback을 추가하라.
- 단순 spinner 대신 `Loading priority queue`, `Loading records`처럼 사용자가 무엇을 기다리는지 알 수 있게 하라.
- 차트, 이력, 긴 표는 첫 업무 판단을 막지 않도록 아래에서 지연 렌더하라.
- 긴 목록이 실제로 수백~수천 행을 DOM에 렌더할 때만 기존 의존성 또는 가벼운 방식으로 pagination/virtualization을 적용하라. 근거 없이 라이브러리를 추가하지 마라.

P2. 데이터 신선도 정책 분리

- `adminGet` 전체에 단일 no-store 정책을 유지하지 말고, 데이터 의미별 helper 또는 옵션을 도입하라.
- 다음은 항상 최신이어야 하므로 no-store 또는 기존 realtime 갱신을 유지하라.
  - live bookings
  - operation alerts
  - approvals
  - payment/refund/settlement risk
  - operator assignment/handoff
- 다음은 15~60초 revalidate 또는 mutation 후 tag invalidation을 검토하라.
  - dashboard aggregate
  - partner/usage/marketing summary
- 다음은 5~30분 revalidate와 mutation 후 tag invalidation을 적용할 수 있다.
  - service catalog
  - notification templates
  - regions
  - stable policies/settings
- 실시간 업무 데이터가 캐시 때문에 오래 보이지 않도록 테스트를 추가하라.
- 같은 서버 요청에서 반복되는 session identity 조회와 API token 생성을 request-local memoization하라. 보안 경계와 operator identity가 섞이지 않게 하라.

P2. Partner Operations 정보구조 통합

- 현재 URL과 딥링크는 보존하라.
  - /partners/overview
  - /partner-controls
  - /partners
- 사이드바에서 세 개의 동급 목적지처럼 보이지 않도록 하나의 `Partner Operations` workspace로 묶어라.
- workspace local tabs:
  - Overview
  - Action Queue
  - Directory
- 각 역할을 엄격히 나눠라.
  - Overview: 현재 공급, verification, availability, wallet risk의 요약과 변화
  - Action Queue: operator가 실제 승인·제한·wallet·가용성 문제를 처리하는 곳
  - Directory: Partner 검색, 프로필 조회, saved view
- Overview에서 보여주는 124 wallet risk 같은 수치는 Action Queue 또는 Directory의 정확한 filter를 포함한 deep link로 이동해야 한다.
- 같은 위험 집단을 세 페이지에서 각각 별도 업무처럼 반복하지 마라.
- Directory의 기존 Approval, Onboarding blockers, Wallet debt saved view와 query parameter를 보존하라.
- breadcrumb, global search, aria-current, local tab current 상태를 함께 수정하고 회귀 테스트를 추가하라.

P2. Settlement Repair 화면 단순화

- sidebar, breadcrumb, H1의 명칭을 모두 `Settlement Repair`로 통일하라.
- `Finance Closeout`, `Settlement Repair Queue`처럼 같은 화면을 다르게 부르는 문구를 제거하라.
- 현재 연속된 `Closeout workspace`, `Settlement review mode`, `Settlement gap filters` 세 제어층을 다음처럼 정리하라.
  - 첫 행: `Operations closeout | Repair queue | Batch evidence`
  - 둘째 행: 상태, 기간, 담당자와 실제 기록 filter
- 같은 의미의 탭과 filter를 중복 배치하지 마라.
- 현재 query parameter와 기존 딥링크를 가능하면 호환하라. 변경이 필요하면 legacy query를 canonical query로 redirect하라.
- Finance Overview, Settlement Repair, Tax & Period Close는 하나의 거대한 페이지로 합치지 마라. 각각 Today money state, repair execution, period close라는 독립 목적을 유지하라.

P2. 중복 정보와 빈 상태 축약

Tax & Period Close
- 첫 viewport에 두 번 표시되는 `Closeout gates` 수치를 하나로 줄여라.
- 남은 카드에는 count, oldest age, owner, next action을 결합하라.

Notification Delivery
- failure group이 0일 때 두 단계 탭, 다수 분류, age 탭과 빈 table을 모두 펼치지 마라.
- 주 상태를 `All delivery paths healthy`로 표시하라.
- Delivery records와 24h+ history는 보조 action 또는 disclosure로 제공하라.
- 장애가 존재할 때는 현재의 failure group, affected, first/latest, technical next step 정보를 그대로 사용할 수 있어야 한다.

Customer Usage
- reporting period, granularity, comparison, freshness badge의 반복을 한 줄로 축약하라.
- 데이터가 모두 0이면 `No tracked usage in this period` 상태와 가능한 원인, Refresh 또는 기간 변경 action을 먼저 보여라.
- 0으로 채워진 KPI/funnel 전체는 `Show empty report` disclosure 뒤로 이동하라.
- 실제 데이터가 있으면 KPI와 funnel을 정상 노출하라.

Marketing Analytics
- 첫 화면 필터는 Range, Source, Region 중심으로 제한하라.
- Platform과 Campaign ID 등 덜 자주 쓰는 항목은 `More filters`로 이동하라.
- active filter를 한 줄 요약하고 개별 clear와 Clear all을 제공하라.
- Marketing needs action은 계속 첫 분석 결과보다 위에 유지하라.

Setup Readiness
- `Owning team`에는 이메일 주소보다 팀명을 먼저 표시하라.
- 연락처는 row detail 또는 보조 문구로 이동해 좁은 열에서 이메일이 여러 줄로 깨지지 않게 하라.

Live Bookings
- 현재 개선된 Work now / Monitor 구조와 non-zero exception promotion을 보존하라.
- 0건 queue 11개를 다시 펼쳐 놓지 마라.
- `No additional exceptions` 상태를 유지하라.

유지해야 하는 현재 구조

- Customers / Customer Signals / Chat Evidence는 합치지 마라.
- Notification Delivery / Templates / Push Send는 합치지 마라.
- Marketing Analytics / Customer Usage는 같은 Insights workspace에 두되 별도 페이지로 유지하라.
- Finance Overview / Settlement Repair / Tax & Period Close는 별도 페이지로 유지하라.
- Completed Services / Post-match Cancellations는 Booking Closeout의 별도 로컬 탭으로 유지하라.
- /providers, /providers/[id], /files, /referrals legacy redirect를 삭제하지 마라.
- Setup Readiness의 현재 운영 상태표를 개발 로드맵 화면으로 되돌리지 마라.
- Push Send의 이름·전화번호 recipient 검색을 raw ID 입력으로 되돌리지 마라.
- Operation Alerts 0건의 role=status 의미론과 정확한 aria-current 구현을 보존하라.

운영자 문구 기준

- 상태만 말하지 말고 가능한 경우 `무슨 문제인지 → 영향 → 다음 행동` 순서로 작성하라.
- `FCM`, raw user id, fixture provenance, internal enum 같은 구현 용어를 주요 문구로 노출하지 마라.
- 위험 badge는 원인과 action을 대신하지 않는다.
- 빈 상태는 `0 records`만 말하지 말고 정상인지, 데이터가 없는지, 필터 때문에 없는지 구분하라.
- action label은 `Open`, `Review`, `Assign`, `Resolve`, `Retry`, `View evidence`처럼 결과가 드러나는 동사를 사용하라.
- `Current`, `Needs action`, `History`의 시간·상태 의미를 페이지마다 일관되게 사용하라.

접근성·상호작용 기준

- 실제 현재 목적지 하나에만 aria-current="page"를 사용하라.
- workspace가 선택됐다는 시각 상태는 data-active와 분리하라.
- local tabs, filter, disclosure, empty state에 적절한 semantic element를 사용하라.
- keyboard focus, Escape 복귀, 검색 결과 이동과 메뉴 상호작용을 깨뜨리지 마라.
- 상태를 색상 하나로만 구분하지 말고 label 또는 icon과 함께 제공하라.
- loading, partial error, empty, stale, permission denied 상태를 모두 처리하라.

코드 구조 개선

- admin-api.ts를 한 번에 전면 재작성하지 마라. 변경하는 도메인부터 booking, partner, finance, messaging, session API 모듈로 점진 분리하라.
- globals.css를 무작정 자동 분할하지 마라. 변경하는 workspace의 공통 component와 route style부터 작은 경계로 이동하라.
- 1,000줄 이상 페이지는 data model, view section, table column, action component로 나누되 한 번만 쓰는 사소한 wrapper를 남발하지 마라.
- 기존 public API와 route query 계약을 최대한 유지하라.

성능 검증 기준

수정 전과 수정 후를 같은 조건에서 비교하라.

반드시 분리해서 기록할 것:

- dev cold compile time
- production navigation/server response
- API subcall duration
- request count
- payload size
- 주요 화면 DOM element와 SVG 수
- 가능하면 LCP, INP, CLS

최소 목표:

- 운영용 production 요청에 dev compile 지연이 존재하지 않는다.
- production warm navigation은 대표 화면에서 p50 1초 이내, p95 2.5초 이내를 목표로 한다.
- 목표를 달성하지 못하면 수치를 숨기지 말고 가장 느린 route와 data source를 보고한다.
- Shift Command 초기 데이터 source는 1~3개다.
- 최우선 action은 상세 표·차트보다 먼저 보인다.
- 라이브 큐는 cache 때문에 오래된 상태를 보여주지 않는다.

테스트와 시각 검증

1. 변경한 모듈의 가장 작은 관련 테스트부터 실행하라.
2. 다음 기존 테스트는 반드시 포함하라.
   - admin-navigation.spec.ts
   - admin-nav-match.spec.ts
   - admin-shell-nav.spec.tsx
   - admin-workspace-header 관련 테스트
3. 변경한 화면의 page/component 테스트를 추가하거나 갱신하라.
4. Admin typecheck, lint, visible-copy/query guard와 production build를 실행하라.
5. 로그인 브라우저에서 최소 다음 화면을 1440px 이상으로 직접 확인하라.
   - /
   - /bookings
   - /partners
   - /partner-controls
   - /partners/overview
   - /finance-overview
   - /finance-closeout
   - /finance-tax
   - /notifications
   - /marketing-analytics
   - /usage-overview
   - /setup
6. 각 화면에서 잘림, 잘못된 current state, 중복 카드, 빈 상태, filter 동작, console warning/error를 확인하라.
7. UI 변경이 끝난 뒤에만 Impeccable detector가 사용 가능하면 변경한 UI target 전체에 정확히 한 번 실행하고, 결과를 맥락에 맞게 수정하거나 설명하라.
8. 첫 시각 검사에서 발견된 문제를 한 번에 수정하고, 최종 확인은 한 차례만 추가하라. 끝없는 미세 조정 루프를 만들지 마라.

완료 조건

다음 조건을 모두 만족해야 완료로 판단한다.

- 운영용 production 실행 경로와 개발용 실행 경로가 분리됨
- Shift Command의 초기 다중 데이터 장벽이 제거됨
- 라이브/준실시간/안정 데이터 cache 정책이 코드에서 구분됨
- Partner Operations가 Overview / Action Queue / Directory workspace로 정리됨
- Settlement Repair 이름과 control hierarchy가 통일됨
- Tax, Notification Delivery, Customer Usage, Marketing Analytics의 중복·빈 상태가 개선됨
- 기존 deep link, saved view, 권한, write action과 audit trail이 깨지지 않음
- 관련 테스트, typecheck, lint와 build 결과가 명시됨
- 1440px 이상 실제 화면 캡처와 before/after 성능 표가 생성됨
- console warning/error가 없거나 남은 항목이 정확히 설명됨

최종 보고 형식

최종 답변은 다음 순서로 작성하라.

1. 결과 판정: 완료 / 부분 완료 / blocker
2. 실제 성능 before/after 표: dev cold와 production을 섞지 말 것
3. 구현한 변경: Performance, Partner IA, Finance IA, empty state/copy 순서
4. 변경 파일 목록과 각 파일의 목적
5. 실행한 명령과 PASS/FAIL 결과
6. 실제 확인한 URL과 화면 캡처 경로
7. 보존한 legacy route/API 계약
8. 남은 위험과 후속 작업은 최대 5개

아직 측정하지 않은 성능, 실행하지 않은 테스트, 열어보지 않은 화면을 완료했다고 쓰지 마라. 앱 코드 외 기존 dirty 변경 수와 보호 영역을 최종 보고하고, commit, push, 배포는 명시적으로 요청받지 않았다면 하지 마라.
```

---

## 프롬프트가 강제하는 핵심 결과

- 개발 서버 체감 개선과 실제 production 성능 개선을 구분한다.
- 제안서만 작성하지 않고 코드 수정과 브라우저 검증까지 수행한다.
- 현재 잘 개선된 Live Bookings, Setup, Push Send, Operation Alerts를 회귀시키지 않는다.
- Partner 세 페이지는 URL을 삭제하지 않고 하나의 운영 작업공간으로 정리한다.
- Finance 페이지를 무리하게 합치지 않고 Settlement Repair 내부의 중복 계층만 제거한다.
- 모바일 작업으로 범위가 확장되지 않도록 1440px 이상을 명시한다.
- 기존 1,000개 이상의 dirty 변경을 덮어쓰지 않도록 안전 경계를 둔다.
