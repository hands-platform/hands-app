# HANDS Partner App IA

## 기준
- 화면 표기는 Partner를 기본 용어로 사용한다.
- Partner App은 베트남 파트너가 가입, 인증, 온라인 상태, 예약 수락, 채팅, 완료, 수익/출금까지 처리하는 앱이다.
- 초기 가입에서는 이탈을 줄이기 위해 최소 정보만 받고, 세금 정보는 첫 수익 발생 후 출금 전 플로우로 유도한다.

## 제외
- Store Member / affiliate / franchise 기능
- 제휴 매장 프로그램
- 다른 국가 지점 분기
- 별도 스태프 파견 앱

## Main Navigation
1. Requests
2. Schedule
3. Earnings
4. Chat
5. Profile

## IA Tree
- App Start
  - Splash / Login Check
  - Approval Status Check
- Auth
  - Phone OTP Login
  - Partner Register
  - Session Recovery
- Onboarding
  - Basic profile
  - Service skill/category
  - Service area
  - KYC upload
  - Bank account
  - Agreement consent
  - Approval pending
- Work
  - Online / offline toggle
  - One-time GPS send on app open
  - 10-minute interval location update while app is open
  - Last location status
- Requests
  - Direct first-pick request
  - Nearby backup request list within policy radius
  - Accept / reject
  - Active order
  - Complete order
- Chat
  - Chat detail opens after matching/service start
  - Location share
  - Chat hidden on mobile after completion
- Earnings
  - Earnings summary
  - Cash fee debt
  - Wallet ledger
  - Payout request
  - Tax info collection gate after first earning
- Profile
  - Profile detail
  - KYC status
  - Service prices
  - Work time
  - Devices / sessions

## MVP
- Login, basic profile, online status, location update, booking request list, accept/reject, active order, chat, complete, earnings summary.

## Phase 2
- KYC review loop, bank account history, wallet debt blocking, tax profile gate, payout request.

## Phase 3
- Advanced schedule, document re-upload, partner badges, richer notification routing, native storage optimization.
