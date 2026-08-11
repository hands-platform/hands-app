# Customer Detail 운영자 UX 심층 감사

- 대상: `http://localhost:3101/customers/audit_post_match_customer_profile`
- 감사 일자: 2026-08-06 (Asia/Bangkok)
- 감사 관점: 개발자용 데이터 열람 화면이 아니라, 고객 문의·예약 이력·금전 조정·증거 보존을 처리하는 실제 운영자 화면
- 확인 범위: 화면 전체, 1024×768/1440×900 반응형, 예약 필터/페이지 이동, 지갑 조정의 검토 단계, 푸시 작성 불가 상태, 운영자 메모 작성 폼, 채팅 이력 1·2페이지, 관련 Web/API 코드와 실패 처리
- 안전 범위: 실제 저장·발송·지갑 반영은 실행하지 않았다. 화면과 코드만 감사했고 애플리케이션 소스는 수정하지 않았다.

## 1. 결론

이 페이지는 고객·예약·금전·알림·감사·채팅 증거를 한곳에 모았고, 고위험 지갑 조정도 검토 단계를 둔 점은 좋다. 그러나 현재는 **“한 페이지에 많이 들어가 있다”는 장점보다 “어떤 정보가 전체인지, 최근 일부인지, 조회에 실패했는지”를 운영자가 구분하기 어렵다는 위험이 더 크다.**

가장 먼저 고칠 것은 미관이 아니라 운영 판단의 신뢰성이다.

1. 고객 조회 실패는 404로, 지갑 원장 조회 실패는 0원·0건으로 보일 수 있다.
2. 일반 화면에서는 언어를 계산할 세션 데이터를 아예 받지 않으면서 `Unknown / Not saved`를 정상 값처럼 표시한다.
3. 예약은 최신 6건만 로드하지만 `Booking history`, `every matched booking`, 채팅 건수처럼 전체 이력으로 읽히는 문구를 쓴다.
4. 운영자 메모는 기본으로 최신 예약에 연결되고, 현재 테스트 데이터에서는 6개 예약 선택지가 모두 `audit_po`로 같아 잘못된 예약에 메모를 남길 가능성이 높다.
5. “No action needed”가 최근 6건 모두 파트너 취소인 이 고객의 반복 패턴까지 정상으로 묻어 버린다.

따라서 권장 개편 방향은 다음 한 문장으로 요약된다.

> 상단은 **지금 처리할 일과 신뢰 가능한 고객 상태**, 중단은 **최근 예약과 금전**, 하단은 **필요할 때 펼치는 보존 기록**으로 재구성하고, 모든 요약에는 범위·기준 시각·조회 실패 상태를 명시한다.

## 2. 현재 화면 데이터 스냅샷

감사 시점 화면에서 확인한 고객 상태는 다음과 같다.

- 고객: `Audit Cancellation Customer`
- 고객 ID: `audit_post_match_customer_profile`
- 연락처: `+84900007101`, 이메일 없음
- 실시간 예약: 0건
- 최근 로드된 예약: 6건
- 최근 완료: 0건
- 최근 취소: 6건, 모두 Partner cancel
- 지갑 잔액: 0 VND
- 지갑 원장: 입금 800,000 VND / 출금 800,000 VND / 4건
- 활성 푸시 기기: 0대
- 운영자 메모: 0건
- 보존 채팅방: 화면 기준 6개, 2페이지

![상단 기본 화면](C:/dev/massage-on-demand-vn/output/customer-detail-audit-post-match-2026-08-06/01-overview-default.png)

## 3. 운영자 핵심 과업 기준

이 페이지에서 실제 운영자가 가장 빨리 답을 얻어야 하는 질문은 아래 순서다.

1. 지금 이 고객과 관련해 즉시 처리할 일이 있는가?
2. 현재 예약은 무엇이고 고객이 왜 문의했는가?
3. 최근 취소·결제·환불 흐름에 이상 패턴이 있는가?
4. 고객에게 연락할 수 있는가? 푸시가 안 되면 다음 수단은 무엇인가?
5. 금전 조정이 필요한가? 조정 전후 잔액과 근거는 무엇인가?
6. 어떤 운영자가 언제 무엇을 확인하고 기록했는가?
7. 분쟁이 생기면 예약·채팅·결제 증거를 빠르게 묶어 볼 수 있는가?

현재 페이지는 4~7번 자료를 많이 갖고 있지만 1~3번의 우선순위와 범위 표현이 약하다.

## 4. 화면 단계별 감사

### 4.1 진입·페이지 헤더 — 상태: 보통

좋은 점:

- `Customer Detail`과 고객 식별자가 분명하다.
- 고객 목록으로 돌아가는 경로가 있다.
- 설명이 프로필만이 아니라 예외·금전·보존 기록을 다룬다는 범위를 알려 준다.

문제:

- `Back to customers`는 현재 목록의 검색어·필터·페이지·스크롤 위치를 보존하지 않는다. 목록에서 고객을 조사하던 운영자는 돌아갔을 때 조사 맥락을 다시 만들어야 한다.
- 페이지 제목보다 하위 ID와 기술적 문구가 강해, “이 고객의 현재 상태”를 읽기 전에 시스템 레코드를 보는 느낌이 난다.
- 고객 ID를 짧게 줄인 `audit_po`가 여러 곳에서 반복되지만, 이 데이터처럼 공통 접두사가 긴 ID는 서로 구분되지 않는다.

개선:

- 목록 → 상세 링크에 `returnTo`를 포함하거나 브라우저 히스토리 기반 `Back to customer results`를 제공한다.
- 헤더 1행은 `Audit Cancellation Customer`와 상태 칩, 2행은 전화·전체 고객 ID·가입일로 구성한다.
- 짧은 ID는 **앞부분이 아니라 끝 6~8자**를 쓰거나, 같은 화면 내 중복 시 자동으로 더 긴 고유 부분을 표시한다.

### 4.2 Needs action — 상태: 나쁨

현재 화면은 큰 카드로 `No action needed`를 표시하고 첫 화면의 대부분을 차지한다.

![현재 Needs action 카드](C:/dev/massage-on-demand-vn/output/customer-detail-audit-post-match-2026-08-06/18-overview-1440.png)

좋은 점:

- 실패 결제, 열린 환불, 신고 리뷰 등 어떤 예외를 검사했는지 문장으로 설명한다.
- 즉시 조치가 없을 때 불필요한 위험 경고를 만들지 않는다.

문제:

- 최근 6건이 전부 Partner cancellation인데도 단순히 `No action needed`로 끝난다. 즉시 처리 대상이 아니라도 운영 패턴으로는 중요하다.
- 카드 높이가 지나치게 커 1024×768에서는 현재 상태가 전부 아래로 밀린다.
- `No action`과 `No noteworthy pattern`을 같은 의미로 취급한다.
- 기준 시각과 데이터 범위가 없다. 조회가 정상 완료된 결과인지도 알 수 없다.

개선:

- 상태를 두 층으로 나눈다.
  - `Open actions: 0` — 지금 처리해야 할 항목
  - `History signals: 1` — 최근 6건 중 파트너 취소 6건
- 조치가 없으면 큰 카드가 아니라 상단 1줄 스트립으로 줄인다.
- `Checked at 18:52 · payments, refunds, reviews, notifications`처럼 기준 시각과 검사 범위를 표시한다.
- 반복 취소 신호에는 자동 처벌이나 고객 위험 라벨을 붙이지 말고 `Review pattern` 링크만 제공한다.

권장 문구:

- 제목: `No open action`
- 설명: `No failed payment, open refund, reported review, or delivery failure requires action now.`
- 별도 신호: `History signal · 6 of the latest 6 bookings were cancelled by a Partner.`

### 4.3 Current status·고객 신원·빠른 작업 — 상태: 보통

![현재 상태와 빠른 작업](C:/dev/massage-on-demand-vn/output/customer-detail-audit-post-match-2026-08-06/02-current-status-default.png)

좋은 점:

- 고객명·전화·실시간 예약 유무·주소·가입일이 한 카드 안에 있다.
- 실시간 예약이 있으면 바로 예약으로 이동할 수 있는 구조다.
- 주소를 2개까지만 요약해 과도한 길이를 피한다.

문제:

- 일반 모드 API는 `appSessions`를 제외하지만 화면은 그 배열로 언어를 계산한다. 따라서 실제 언어가 있어도 정상 화면은 항상 `Unknown`이 될 수 있다.
- `Unknown / Not saved`와 아래 도움말 `Unknown`이 중복된다. 원인도 “미수집”, “조회 권한 없음”, “정말 미설정” 중 무엇인지 알 수 없다.
- 아바타의 빨간 점은 `App offline`인데, 상단은 `No action needed`라 빨간색이 장애·위험처럼 읽힌다.
- `Adjust wallet`, `Send push`, `Add note`가 같은 시각적 위계다. 금전 조정은 가장 위험하고, 메모는 가장 일상적인 작업인데 동일한 버튼 행에 놓였다.
- 활성 푸시 기기가 0대인데도 `Send push`가 클릭 가능한 빠른 작업으로 노출된다.

개선:

- 운영에 필요한 안전한 세션 요약(`deviceLanguage`, `lastSeenAt`)만 별도 select로 제공하고 IP·deviceId 등 진단 정보는 계속 제외한다. 또는 정상 모드에서는 언어 행 자체를 숨긴다.
- 상태 값마다 출처를 명시한다: `Language: Not recorded`, `App reachability: No active device`.
- 빨간 presence 점은 실시간 장애가 아닌 경우 중립 회색으로 바꾸고 텍스트 상태를 유지한다.
- 빠른 작업 순서:
  1. `Add note` — 기본 작업
  2. `Contact customer` — 사용 가능한 채널만 활성화
  3. `Financial adjustment` — 별도 위험 메뉴/섹션
- 활성 기기가 없으면 버튼을 `Push unavailable`로 비활성화하고 이유를 인접 표시한다.

### 4.4 Booking history — 상태: 나쁨

![예약 요약과 표](C:/dev/massage-on-demand-vn/output/customer-detail-audit-post-match-2026-08-06/03-booking-history-summary.png)

![1440px에서도 잘리는 예약 표](C:/dev/massage-on-demand-vn/output/customer-detail-audit-post-match-2026-08-06/19-booking-history-1440.png)

좋은 점:

- 실시간·완료·취소 필터와 건수를 같이 보여 준다.
- 상태·결제·파트너·주소를 한 행에서 교차 확인할 수 있다.
- 현재 필터를 URL에 보존하고 5행 페이지네이션을 둔다.

문제:

1. **범위 오인**: API는 최신 6건만 로드한다. 그런데 제목은 `Booking history`, 문구는 `Recent records`와 “current booking stays first”를 섞어 전체 이력처럼 보인다.
2. **현재 예약 누락 가능성**: `activeBooking`도 이 최신 6건 안에서만 찾는다. 정상적으로 정렬된 데이터에서는 가능성이 낮지만, 장기 진행·데이터 지연 상황에서 계약상 전체 활성 예약을 보장하지 않는다.
3. **테이블 폭**: 7열 테이블은 기본 890px 영역에서 1,380px, 1024 화면에서는 634px 영역에서 1,380px, 1440 화면에서도 1,050px 영역에서 1,380px이다. 주소와 상태를 보려면 맨 아래까지 내려가 수평 스크롤해야 한다.
4. **식별 불가**: 6개 예약 모두 `audit_po`로 보인다. 행을 서로 구분할 핵심 정보가 없다.
5. **시간 모순**: 화면 데이터에서 Request Time은 18:48인데 State 시간은 18:18 또는 17:48로 더 이르다. 필드 의미 또는 테스트 데이터가 잘못되었는지 운영자가 판단할 수 없다.
6. **가격 의미 충돌**: Service는 `No service / 0 VND`인데 Payment는 `400,000 VND`이다. 서비스 스냅샷이 없다는 뜻인지, 금액 데이터가 비정상인지 설명이 없다.
7. **내부 상태 노출**: `RELEASED`, `CUSTOMER_WALLET` 같은 기술 상태가 운영 의미로 번역되지 않는다.
8. **요약 카드 배치**: 1024px에서 4번째 취소 카드가 홀로 다음 줄로 내려가 중요도보다 그리드 우연성이 레이아웃을 결정한다.

개선:

- 단기: 제목을 `Recent bookings`로 바꾸고 `Latest 6 records`를 명시한다.
- 목표: 고객 예약 전용 페이지네이션 API를 만들고 전체 건수·필터를 서버에서 계산한다. 활성 예약은 별도 명시적 조회/요약 필드로 보장한다.
- 표는 4개 핵심 열로 줄인다.
  - `When & booking`
  - `Service & Partner`
  - `Money`
  - `Outcome`
- 주소는 전체 셀 대신 한 줄 요약 + 상세 행/드로어로 이동한다.
- 예약 표시는 `…profile · 18:48 · Cash`처럼 고유 suffix, 시간, 결제 유형을 결합한다.
- `RELEASED`는 도메인에 맞게 `Funds released` 또는 `Payment closed`처럼 번역하고 툴팁에 원본 상태를 남긴다.
- Request/State 시간의 데이터 계약을 검증하고, 정상이라면 각각 `Requested`, `Cancelled at`처럼 동사를 명시한다.
- 서비스 스냅샷이 누락된 결제는 `Service snapshot unavailable · Payment 400,000 VND`로 보여 데이터 불일치를 숨기지 않는다.

### 4.5 Payment and wallet summary — 상태: 보통

![결제와 지갑 요약](C:/dev/massage-on-demand-vn/output/customer-detail-audit-post-match-2026-08-06/06-payment-wallet-summary.png)

좋은 점:

- 잔액·입출금·환불·현금 예약을 같은 금전 섹션에 모았다.
- 지갑 조정이 기본적으로 접혀 있어 실수 클릭을 줄인다.

문제:

- `Wallet balance`, `Lifetime captured payments`, `Recent refund records`, `Recent cash bookings`가 서로 다른 기간·기준인데 한 KPI 묶음으로 배치된다.
- 여기서 `Recent`는 시간 범위가 아니라 최신 6개 예약에 사실상 종속되지만 화면에 정의가 없다.
- 0원과 데이터 없음/조회 실패가 구분되지 않는다.
- 큰 파란 요약 패널이 실제 운영 질문보다 장식적 비중이 크다.

개선:

- `Current balance`와 `Recent booking money (latest 6)`를 시각적으로 분리한다.
- 모든 금액에 범위 라벨을 붙인다: `All time`, `Open now`, `Latest 6 bookings`.
- 조회 시각과 원장 통화를 표시한다.
- 데이터 실패 시 KPI를 0으로 채우지 말고 섹션 전체를 `Wallet data unavailable · Retry`로 표시한다.
- KPI는 최대 4개만 상시 노출하고 나머지는 `More finance details`에 넣는다.

### 4.6 Wallet adjustment — 상태: 주의 필요

![지갑 조정 입력](C:/dev/massage-on-demand-vn/output/customer-detail-audit-post-match-2026-08-06/07-wallet-adjustment-form.png)

![지갑 조정 검토 단계](C:/dev/massage-on-demand-vn/output/customer-detail-audit-post-match-2026-08-06/08-wallet-adjustment-review.png)

좋은 점:

- MASTER_ADMIN만 즉시 반영할 수 있다.
- 입력 후 `Review`를 거쳐야 `Apply now`가 나타난다.
- 검토 후 금액을 변경하면 다시 검토가 필요해지는 동작을 확인했다.
- 금액 방향·조정 유형·근거·사유를 나눠 받는다.

문제:

- `Immediate financial action`이라고 쓰면서도 최종 버튼은 일반 보라색 기본 버튼이다. 위험 작업이라는 시각 신호가 약하다.
- 최종 단계에 현재 잔액, 조정액, 예상 잔액을 한 문장으로 확정해서 읽히는 요약이 부족하다.
- 최종 반영자 계정과 감사 로그 생성 사실이 버튼 주변에 보이지 않는다.
- 고액 근거 URL 조건은 서버 규칙에 의존하고 입력 자체에는 항상 required가 아니다. 사용자는 검토 전까지 임계값을 모를 수 있다.
- 빠른 작업과 같은 위계에 있어 문의 기록 과정에서 금전 조정으로 너무 쉽게 진입한다.

개선:

- 최종 카드: `0 VND → Credit 100,000 VND → 100,000 VND`를 크게 표시한다.
- 버튼 문구: `Apply 100,000 VND credit now`처럼 금액·방향을 포함한다.
- 위험색과 아이콘을 사용하되 텍스트로도 `Immediate · writes wallet ledger and audit record`를 표시한다.
- `Applied by {operator}`와 사유·근거를 최종 확인 블록에 반복한다.
- 고액 근거 규칙을 금액 입력 도움말로 사전 안내한다.
- 이 페이지에서는 기존 2단계를 유지하고, 별도 다중 승인 시스템은 정책상 실제 필요가 확인되기 전에는 추가하지 않는다.

### 4.7 Wallet transaction history — 상태: 보통

![지갑 거래 원장](C:/dev/massage-on-demand-vn/output/customer-detail-audit-post-match-2026-08-06/09-wallet-transaction-history.png)

좋은 점:

- 서버에서 각 행의 before/after balance를 계산한다.
- 입금·출금 총액과 최종 잔액이 함께 있다.
- 원장은 서버 페이지네이션 구조를 갖는다.

문제:

- 열 제목 `Balance` 안에 이전 잔액과 `After`가 함께 있어 두 숫자의 관계가 즉시 읽히지 않는다.
- 이미 종료된 과거 음수 잔액도 빨간색으로 강하게 보여 현재 위험처럼 보인다.
- `sourceKey`, reference가 좁은 칸에서 길게 줄바꿈되어 사람이 읽는 근거보다 시스템 키가 우선된다.
- 관련 예약·환불 링크가 식별자 중심이라 실제 사건을 빠르게 복원하기 어렵다.

개선:

- 열을 `Before`, `Change`, `After`로 분리하거나 한 셀에 `-400,000 → 0 VND`로 명확히 표현한다.
- 과거 음수는 중립 숫자로, 현재 잔액이 음수일 때만 위험 신호를 준다.
- 기본 표에는 `Reason`, `Related booking`, `Operator/Source`, `Time`을 제공하고 기술 키는 펼침 상세로 옮긴다.
- 입·출금 방향뿐 아니라 `Refund`, `Service payment`, `Manual adjustment`의 운영 라벨을 우선한다.

### 4.8 Referral·Customer app notifications — 상태: 나쁨

![추천과 알림 섹션](C:/dev/massage-on-demand-vn/output/customer-detail-audit-post-match-2026-08-06/10-referral-notifications.png)

![활성 기기가 없는 메시지 폼](C:/dev/massage-on-demand-vn/output/customer-detail-audit-post-match-2026-08-06/11-send-message-form.png)

좋은 점:

- 실제 활성 기기가 없으면 발송 버튼은 비활성화된다.
- 추천 데이터가 있을 때는 고객 금전 흐름과 함께 조사할 수 있다.

문제:

- 추천 데이터 0건이 큰 빈 카드 전체를 차지한다.
- 빠른 작업에서 `Send push`를 열어야만 발송 불가를 알 수 있다.
- 타깃 문구가 `0 activedevices`로 붙어 표시된다.
- 푸시 불가 다음 행동(전화, 메모)이 연결되지 않는다.
- `0 messages`, `0 active devices`, `Unavailable`이 반복되어 정보 밀도보다 빈 상태가 크다.

개선:

- 추천 0건은 1줄 요약으로 접고, 이상 추천/보상 기록이 있을 때만 펼친다.
- 빠른 작업에서부터 `Push unavailable · no active device`로 비활성화한다.
- 대체 행동을 한 개만 제시한다: `Copy phone number` 또는 `Add contact note`.
- 문구를 `0 active devices`로 교정한다.
- 알림 섹션은 `Reachability`, `Last delivered`, `Recent messages`의 3요소로 단순화한다.

### 4.9 Operator notes·audit records — 상태: 나쁨

![감사 기록 기본 상태](C:/dev/massage-on-demand-vn/output/customer-detail-audit-post-match-2026-08-06/12-audit-records.png)

![운영자 메모 폼](C:/dev/massage-on-demand-vn/output/customer-detail-audit-post-match-2026-08-06/13-add-operator-note-form.png)

좋은 점:

- 운영자 메모는 예약·결제 상태를 바꾸지 않는다는 설명이 있다.
- API는 연결하려는 예약이 실제 이 고객 소유인지 검증한다.
- 저장 성공·실패 메시지를 위한 경로가 있다.

문제:

1. `Quick note preset`, `Related booking` 라벨이 DOM에는 있으나 공용 폼 기본값이 hidden이라 화면에서 보이지 않는다.
2. `Related booking` 기본값이 `No booking link`가 아니라 최신 예약이다. 일반 고객 메모도 의도 없이 특정 예약에 연결될 수 있다.
3. 6개 예약 선택지가 모두 `audit_po / CANCELLED 또는 REFUNDED / No service`로 보여 서로 구분되지 않는다.
4. 텍스트 영역은 client required가 아니며, 서버 액션은 빈 메모일 때 아무 메시지 없이 `return`한다. 버튼은 활성화되어 있어 눌러도 반응 없는 경험이 가능하다.
5. 0건 메모에서 섹션·배지·빈 표가 같은 사실을 반복하며 큰 공간을 차지한다.
6. `Export CSV`는 무엇을 내보내는지 범위가 불명확하다.

개선:

- 두 select에 `labelVisibility="visible"`를 명시한다.
- 예약 연결 기본값은 항상 빈 값으로 둔다. 예약 상세에서 진입한 경우에만 명시적 bookingId로 미리 선택한다.
- 예약 옵션: `…profile · 5 Aug 18:48 · Cash · Partner cancelled`처럼 유일하게 식별되게 만든다.
- textarea에 `required`, `minLength`를 주고 빈 제출 시 인라인 오류를 표시한다. 서버 검증은 그대로 유지한다.
- 0건이면 빈 표 대신 `No operator notes yet` 1줄과 `Add note`만 둔다.
- 내보내기 문구를 `Export retained customer activity CSV`로 바꾼다.

### 4.10 Chat evidence — 상태: 보통 이하

![채팅 증거 1페이지](C:/dev/massage-on-demand-vn/output/customer-detail-audit-post-match-2026-08-06/14-chat-evidence-page-1.png)

![채팅 증거 2페이지](C:/dev/massage-on-demand-vn/output/customer-detail-audit-post-match-2026-08-06/15-chat-evidence-page-2.png)

좋은 점:

- 취소·완료 후 앱에서 숨겨진 채팅을 관리자 화면에 보존한다.
- 예약과 전체 채팅 아카이브로 연결된다.
- 3개 방씩 페이지를 나눠 한 번에 모든 대화를 렌더링하지 않는다.

문제:

- 화면은 `Admin archive for every matched booking`이라고 하지만 채팅은 최신 6개 예약에서만 만든다. 고객 예약이 6건을 넘으면 “every”가 사실이 아니다.
- 방 3개를 전체 대화 카드로 펼쳐 한 화면이 매우 길다. 이 고객처럼 내용이 반복될 때 사건 비교가 어렵다.
- 제목도 모두 `audit_po / No service`라 구분되지 않는다.
- 기술 room ID가 설명의 핵심 위치를 차지한다.
- 취소된 보존 채팅의 아바타 녹색 점은 현재 온라인 상태처럼 읽힐 수 있다.
- 반복 링크 `Open booking`, `Open full chat archive`는 스크린리더 링크 목록에서 대상 예약을 구분하기 어렵다.
- 카드 제목이 상위 `Chat history`와 같은 heading level을 사용할 가능성이 있어 문서 윤곽이 과도해진다.

개선:

- 단기 문구: `Chat evidence from the latest 6 bookings`.
- 목표: 채팅 전용 서버 페이지네이션으로 전체 방 수와 대상 범위를 보장한다.
- 기본은 방 목록/아코디언으로 바꾼다: 예약 suffix, 서비스, 결제 유형, 종료 상태·시각, 마지막 메시지, 메시지 수.
- 한 번에 한 채팅만 펼치고, `Open full archive`는 2차 행동으로 둔다.
- 녹색 presence는 보존 기록 카드에서 제거한다.
- 접근성 이름을 `Open booking …profile`처럼 고유하게 만든다.

### 4.11 1024×768·1440×900 반응형 — 상태: 나쁨

![1024px 상단](C:/dev/massage-on-demand-vn/output/customer-detail-audit-post-match-2026-08-06/16-overview-1024.png)

![1024px 예약 이력](C:/dev/massage-on-demand-vn/output/customer-detail-audit-post-match-2026-08-06/17-booking-history-1024.png)

관찰:

- 1024×768에서 전체 사이드바가 유지되고, 첫 화면은 헤더와 `No action needed` 카드만 보여 준다.
- 1024 화면의 전체 페이지 높이는 약 7,986px였다.
- 1440×900에서도 페이지 높이는 약 7,193px이고, 예약 표의 Address·State가 여전히 잘린다.
- 테이블 수평 스크롤은 행 아래에 있어, 열 관계를 기억한 채 하단으로 내려가야 한다.

개선:

- 1024 이하에서는 사이드바를 축소하거나 토글 가능하게 해 작업 영역을 확보한다.
- 상단 `No action`을 한 줄로 축소하고 Current status를 첫 화면 안에 배치한다.
- 테이블 열 축소를 우선하고, 단순히 scrollbar를 더 꾸미는 방식으로 해결하지 않는다.
- 채팅·추천·감사 기록은 기본 접힘으로 바꿔 총 페이지 길이를 줄인다.
- 1024에서 핵심 정보와 주요 작업이 수평 스크롤 없이 보여야 한다.

## 5. 우선순위별 수정 항목

### P0 — 운영 판단·데이터 무결성

#### P0-1. API 실패와 실제 0/없음을 분리

현재 고객 상세은 `adminGet(..., null)` 뒤 `notFound()`, 지갑 원장은 0원·빈 배열 fallback을 사용한다. API 장애가 “고객 없음” 또는 “잔액 0원”으로 위장될 수 있다.

수정 기준:

- `404 customer missing`, `403 unauthorized`, `5xx/network unavailable`를 구분한다.
- 지갑 조회 실패 시 금액을 0으로 렌더링하지 않는다.
- 상단 Needs action도 일부 데이터가 실패하면 `Check incomplete`로 표시한다.
- 재시도 링크와 마지막 성공 시각을 제공한다.

완료 조건:

- API 500 테스트에서 404 페이지가 나오지 않는다.
- 지갑 원장 API 500 테스트에서 0 VND가 나오지 않는다.
- 부분 실패 상태가 화면과 테스트에 명시된다.

#### P0-2. 운영자 메모의 잘못된 예약 연결 방지

수정 기준:

- 기본 bookingId는 빈 값.
- select 라벨을 화면에 표시.
- 옵션마다 구분 가능한 suffix·시간·결제·상태 포함.
- 빈 메모의 client/server 오류 피드백 제공.

완료 조건:

- 일반 고객 상세에서 메모 폼을 열면 `No booking link`가 기본이다.
- 동일 접두사 예약 6개가 각자 구분된다.
- 빈 제출 시 저장 호출 없이 인라인 오류가 보인다.

#### P0-3. 언어 `Unknown`의 잘못된 정상 표시 제거

수정 기준:

- 진단 정보 없이 노출 가능한 `deviceLanguage`, `lastSeenAt` 안전 요약을 별도 조회하거나 언어 행을 숨긴다.
- `Not recorded`, `Not loaded`, `Unavailable`을 서로 다른 상태로 표현한다.

완료 조건:

- 세션 언어가 있는 고객은 일반 모드에서 올바르게 표시된다.
- 진단 모드가 아니어도 IP·deviceId는 응답에 포함되지 않는다.

#### P0-4. 전체 이력처럼 보이는 최신 6건 계약 교정

수정 기준:

- 즉시: `Recent bookings · latest 6`, `Chat evidence from latest 6 bookings`로 정직하게 표시.
- 목표: 예약/채팅을 별도 서버 페이지네이션해 전체 건수와 필터를 제공.
- 활성 예약은 최신 6건 배열에 의존하지 않는 요약 필드 또는 별도 쿼리로 보장.

완료 조건:

- 예약이 7건 이상인 fixture에서 화면 범위가 틀리게 표현되지 않는다.
- 전체 모드를 제공한다면 7번째 이후 예약과 채팅에 접근 가능하다.

### P1 — 운영 속도·오판 방지

1. `Open actions`와 `History signals`를 분리하고 반복 파트너 취소를 신호로 노출.
2. 예약 표 7열을 4개 운영 열로 재구성하고 1024/1440 수평 스크롤 제거.
3. 결제 상태·시간·서비스 누락을 운영 언어로 번역하고 불일치를 드러냄.
4. 활성 기기가 없을 때 푸시 진입 자체를 비활성화하고 대체 행동 제공.
5. 지갑 조정 최종 단계에 before/change/after, 실행자, 감사 기록, 즉시 반영 경고 표시.
6. 지갑 원장 `Balance`를 before/change/after로 명확화.
7. 채팅은 기본 목록/아코디언, 한 방만 펼침.
8. 고객 목록 복귀 맥락 보존.

### P2 — 밀도·문구·정돈

1. `Sign-up Date` → `Sign-up date`로 casing 통일.
2. `0 activedevices` → `0 active devices`.
3. 추천 0건·메모 0건·알림 0건의 큰 빈 카드를 1줄 상태로 축소.
4. 기술 room ID/source key는 2차 상세로 이동.
5. 보존 채팅에서 현재 presence 색 제거.
6. Export 범위 명시.
7. 중복 `Unknown`·0건 배지·빈 표 제거.

## 6. 권장 정보 구조

### A. Sticky customer command header

- 고객명, 전화, 고객 ID suffix
- `No live booking` / 활성 예약 링크
- `Open actions 0`
- `History signals 1`
- `Add note` 기본 버튼
- `More actions`: contact, financial adjustment, export

### B. Current case

- 문의 대응에 필요한 고객 상태
- 활성 예약 또는 마지막 예약
- 최근 핵심 사건 3개
- 연락 가능 채널

### C. Recent bookings

- Latest 6라는 범위
- 필터와 4열 compact table
- `View all bookings` 링크

### D. Money

- Current wallet balance
- Open payment/refund issues
- 최근 원장 5건
- 위험 분리된 wallet adjustment

### E. Retained records (기본 접힘)

- Operator notes
- Notifications
- Chat evidence
- Referral
- Developer/System audit

이 구조는 새 컴포넌트 체계를 추가하기보다 현재 `AdminSection`, `AdminTablePanel`, `AdminSectionHeader`, `details` 패턴을 재배치해 구현할 수 있다.

## 7. 삭제·유지·추가 기준

### 삭제 또는 축소

- 큰 `No action needed` 카드
- 데이터 0건인 Referral 전체 카드
- 메모 0건의 빈 표
- 푸시 불가 상태에서 열리는 dead form
- 모든 채팅방의 기본 전체 transcript
- 동일한 0건/Unknown 문구 반복
- 기본 화면의 기술 room ID, sourceKey

### 유지

- 역할 기반 지갑 즉시 조정 권한
- 지갑 조정의 Review → Apply 2단계
- 예약이 고객 소유인지 확인하는 서버 검증
- URL 기반 필터·페이지 상태
- 보존 채팅과 전체 아카이브 링크
- 진단 정보의 명시적 opt-in
- 공용 Admin UI primitive 사용

### 반드시 추가

- 데이터 범위와 기준 시각
- partial/error state
- history signal
- 고유한 예약 표시
- 연락 불가의 대체 행동
- 지갑 before/change/after
- 메모의 명시적 대상 선택
- 전체 예약/채팅으로 가는 경로

## 8. 권장 문구 교체표

| 현재 문구 | 권장 문구 | 이유 |
|---|---|---|
| `No action needed` | `No open action` | “패턴도 없음”으로 오해하지 않게 함 |
| `Booking history` | `Recent bookings` | 현재는 최신 6건만 로드 |
| `Recent records` | `Latest 6 bookings` | 범위를 수치로 명확화 |
| `The current booking stays first.` | `Active booking is shown first when available.` | 현재 예약이 없을 때도 자연스러움 |
| `Recent cancellations` | `Cancellations in latest 6` | 기간 오인 방지 |
| `No service / 0 VND` | `Service snapshot unavailable` | 0원 서비스로 단정하지 않음 |
| `RELEASED` | `Funds released` | 운영 의미 번역 |
| `Send push` | `Push unavailable` | 활성 기기 0대 상태 반영 |
| `0 activedevices` | `0 active devices` | 띄어쓰기 오류 교정 |
| `Adjust wallet` | `Financial adjustment` | 위험 작업 의미 강화 |
| `Apply now` | `Apply 100,000 VND credit now` | 최종 결과를 버튼에 명시 |
| `Balance` | `Before → After` | 원장 숫자 관계 명확화 |
| `Add operator note` | `Add customer activity note` | 실제 보존 대상 명확화 |
| `Admin archive for every matched booking` | `Chat evidence from the latest 6 bookings` | 현재 구현 범위와 일치 |
| `Open system audit` | `Load developer/system evidence` | 추가 데이터 로드임을 설명 |
| `Export CSV` | `Export retained customer activity CSV` | 내보내기 범위 명시 |

## 9. 접근성 감사

확인된 장점:

- 표·섹션·상태 배지 등 공용 컴포넌트를 사용한다.
- 아이콘 단독 의미보다 텍스트 링크가 대부분 함께 있다.
- 수평 스크롤 컨테이너에 focus-visible 스타일이 존재한다.
- 상태를 색만으로 표현하지 않고 텍스트를 함께 제공한다.

개선 필요:

- 메모 폼의 select 라벨은 프로그래밍 방식으로는 존재하지만 실제 운영자에게 보이지 않는다.
- 1024px에서 핵심 표를 읽으려면 과도한 수평 스크롤이 필요하다.
- 반복되는 `Open booking`/`Open full chat archive`에 고유한 accessible name이 필요하다.
- 보존 채팅의 녹색 점은 텍스트와 무관한 현재 presence 의미를 암시한다.
- 채팅방 카드 제목은 상위 섹션보다 한 단계 낮은 heading으로 구성해야 한다.
- 위험 작업 버튼은 색뿐 아니라 결과·즉시성·금액을 텍스트에 포함해야 한다.
- 긴 ID와 주소는 축소 화면에서 잘리기보다 복사 가능하고 줄바꿈 가능해야 한다.

제한:

- 키보드 전체 탭 순서, 스크린리더 실제 낭독, 고대비 모드, 200% 확대는 이번 감사에서 완전 실행하지 않았다. 구현 후 별도 QA가 필요하다.

## 10. 코드 근거

- 고객 상세 실패를 `null` fallback과 `notFound()`로 처리: `apps/admin_web/app/customers/[id]/page.tsx:163-180`
- 지갑 원장 실패 fallback이 balance 0 / rows []: `apps/admin_web/app/customers/[id]/page.tsx:167-176`
- 활성 예약과 언어를 최신 고객 상세 payload의 bookings/appSessions에서 계산: `apps/admin_web/app/customers/[id]/page.tsx:197-198`, `:287`
- 메시지 폼 노출이 활성 기기 유무와 분리: `apps/admin_web/app/customers/[id]/page.tsx:245`, `:703-731`
- 메모 예약 기본값이 최신 예약: `apps/admin_web/app/customers/[id]/page.tsx:913`
- 채팅을 로드된 bookings만으로 구성하면서 every matched booking 문구 사용: `apps/admin_web/app/customers/[id]/page.tsx:264`, `:1030`
- 빈 메모 제출이 사용자 피드백 없이 return: `apps/admin_web/app/customers/[id]/actions.ts:7-13`
- 예약 상세 조회 제한 6건: `apps/api/src/admin/admin-customer-selects.ts:118`, `:252`
- 일반 모드 user select에서 appSessions 제외: `apps/api/src/admin/admin-customer-selects.ts:217-229`, 계약 테스트 `apps/api/src/admin/admin-customer-selects.spec.ts:203`
- 공용 폼 라벨 기본값 hidden: `apps/admin_web/components/admin-form-controls.tsx:254` 등
- 예약 표 7열·5행 클라이언트 페이지네이션: `apps/admin_web/app/customers/[id]/customer-booking-operation-board.tsx:56-65`, `:96-104`
- 고객 상세 표는 overflow-x auto: `apps/admin_web/app/globals.css:19653-19662`
- 브라우저 콘솔 warning/error: 감사 시점 0건

## 11. 구현 순서

### 1차: 신뢰성 패치

1. 상세·지갑 조회 결과 타입을 success/not-found/forbidden/unavailable로 분리.
2. 메모 기본 bookingId 제거, visible labels, 필수 검증, 고유 옵션 라벨.
3. 정상 모드 언어 데이터 계약 수정 또는 행 숨김.
4. `Latest 6` 범위 문구 교정.

### 2차: 운영 우선순위 재배치

1. 큰 Needs action을 compact command strip으로 축소.
2. History signals 추가.
3. Add note를 기본 작업으로, 금전 조정을 위험 메뉴로 분리.
4. 푸시 불가 상태를 진입 전 표시.

### 3차: 이력 탐색 개선

1. 예약 4열 compact table.
2. 예약/채팅 서버 페이지네이션 또는 View all 경로.
3. 채팅 아코디언.
4. 지갑 원장 before/change/after.

### 4차: 밀도·접근성 QA

1. 1024/1280/1440, 200% zoom 검증.
2. 키보드와 스크린리더 링크 이름 검증.
3. 빈 상태 축소와 문구 통일.
4. API 403/404/500, 부분 실패 시각 회귀 테스트.

## 12. 최종 수용 기준

- 1024×768 첫 화면에서 고객명, 현재 예약 유무, Open actions, History signals, Add note가 보인다.
- 핵심 예약 정보는 1024 및 1440에서 수평 스크롤 없이 읽힌다.
- 최신 일부 데이터는 항상 `Latest N`으로 표시되고 전체 이력으로 오해되지 않는다.
- API 장애는 404·0원·0건으로 위장되지 않는다.
- 정상 모드의 언어 값이 실제 안전 요약 데이터와 일치한다.
- 메모는 기본적으로 예약에 연결되지 않으며, 연결 예약을 유일하게 식별할 수 있다.
- 빈 메모 제출 시 명확한 오류가 보인다.
- 활성 푸시 기기 0대일 때 발송 폼으로 진입하지 않는다.
- 지갑 최종 반영 전 before/change/after, 금액·방향·실행자·감사 기록이 보인다.
- 채팅 목록에서 각 방을 구분할 수 있고 한 번에 한 transcript만 펼쳐진다.
- 빈 Referral/Notes/Notifications가 긴 페이지를 만들지 않는다.
- 키보드 포커스, 고유 링크 이름, heading 계층이 검증된다.

## 13. 화면 총평

현재 페이지는 “자료가 부족한 화면”이 아니다. 오히려 자료가 많기 때문에 **범위·신뢰도·우선순위·사건 식별자**를 더 엄격히 설계해야 한다. 새 대시보드 프레임워크나 복잡한 승인 시스템을 추가할 필요는 없다. 이미 있는 Admin 컴포넌트를 재배치하고, 최신 6건 계약을 솔직하게 표현하고, 실패 상태와 메모 대상만 정확하게 만들면 운영 친화성이 크게 올라간다.
