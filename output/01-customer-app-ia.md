# HANDS Customer App IA

## 기준
- 앱 이름은 HANDS, 서비스 국가는 Vietnam 전체로 고정한다.
- 참고 APK의 화면 순서와 정보 구조만 참고하고, 브랜드/문구/이미지/아이콘/소스/자산은 사용하지 않는다.
- Customer App은 여행객과 베트남 거주 고객 모두가 빠르게 주소를 정하고 파트너를 예약하는 앱이다.
- 다국어는 최종 디자인 이후 적용하되 IA는 Vietnamese, English, Korean, Chinese, Japanese 확장을 전제로 한다.

## 제외
- 국가 선택 화면
- Store Member / affiliate / franchise / multi-country branch
- 태국/필리핀 등 국가별 분기
- 제휴점 전용 앱

## Main Navigation
1. Home
2. Partners
3. Bookings
4. Chat
5. Profile

## IA Tree
- App Start
  - Splash / Boot
  - Onboarding
  - Login Check
- Auth
  - Phone OTP Login
  - Register Profile
  - Session Recovery
- Home
  - Current city / serviceable region
  - Address selector
  - Recommended services
  - Nearby partners
  - Active booking banner
- Booking
  - Service List
  - Service Detail
  - Address Picker
  - Partner List / Picker
  - Partner Detail
  - Booking Information
  - Payment Method
  - Checkout Webview
  - Booking Complete
  - Booking Detail
  - Cancel Modal
- Matching
  - Preferred partner waiting
  - Backup partner shortlist
  - Customer final partner selection
  - Auto-close timeout
- Chat
  - Chat List
  - Chat Detail
  - Location preview
- Wallet
  - Balance / points / coupon
  - Payment history
  - Refund history
- Profile
  - Customer info
  - Address book
  - Notifications
  - Reviews
  - Terms

## MVP
- Phone auth, home, service list/detail, address picker, partner list/detail, booking, payment placeholder, matching, chat, review, booking history.

## Phase 2
- Coupon, wallet credit, refund detail, notification center, saved addresses, admin-controlled service regions.

## Phase 3
- Full multilingual copy, loyalty/VIP, advanced personalization, native payment callbacks, app deep links.
