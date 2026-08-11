import Link from 'next/link';

import type { PublicSiteLocale } from '../lib/site-content';
import { HandsSiteFooter, HandsSiteHeader } from './hands-site-chrome';

const referralCopy = {
  ko: {
    eyebrow: 'HANDS REFERRALS',
    title: '좋은 경험을 나누고, 함께 보상받으세요.',
    intro: '고객과 마사지 테라피스트는 각자의 추천 코드를 공유할 수 있습니다. 추천받은 사람이 실제 활동 조건을 완료하면 검토 후 보상이 월렛에 지급됩니다.',
    note: '정확한 보상액과 진행 상태는 HANDS 앱의 현재 추천 정책에서 확인합니다.',
    customerAction: '고객 앱에서 시작하기',
    partnerAction: '마사지 테라피스트로 참여하기',
    audienceEyebrow: 'TWO REFERRAL PATHS',
    audienceTitle: '누구를 추천하느냐에 따라 조건이 달라집니다.',
    audiences: [
      {
        index: '01',
        title: '고객 추천',
        body: '친구가 고객 앱에 가입하고 첫 번째 유료 예약을 정상적으로 완료하면 추천 보상 검토가 시작됩니다.',
        steps: ['고객 앱에서 추천 코드 공유', '친구가 코드로 가입', '친구의 유료 예약 완료', '검토 후 고객 월렛 지급'],
      },
      {
        index: '02',
        title: '마사지 테라피스트 추천',
        body: '추천받은 마사지 테라피스트가 가입, 신원 확인과 승인을 마치고 첫 번째 유료 작업을 완료하면 보상 검토가 시작됩니다.',
        steps: ['파트너 앱에서 추천 코드 공유', '추천받은 사람의 가입과 KYC', '승인 후 첫 유료 작업 완료', '검토 후 파트너 월렛 지급'],
      },
    ],
    flowEyebrow: 'HOW REWARDS MOVE',
    flowTitle: '가입만으로 지급되지 않습니다.',
    flowIntro: '실제 서비스가 완료되고 결제가 확정된 뒤 중복·취소·부정 이용 여부를 확인합니다.',
    flow: [
      ['코드 연결', '가입 시 유효한 추천 코드가 한 계정에 한 번 연결됩니다.'],
      ['조건 완료', '추천 유형에 맞는 첫 유료 완료 예약 또는 작업이 필요합니다.'],
      ['보류 기간과 검토', '취소, 환불, 중복 가입과 부정 이용 여부를 확인합니다.'],
      ['월렛 지급', '승인된 보상만 고객 또는 마사지 테라피스트 월렛에 기록됩니다.'],
    ],
    rulesEyebrow: 'CLEAR RULES',
    rulesTitle: '보상 전에 꼭 확인하세요.',
    rules: [
      ['현재 정책 적용', '보상 비율, 고정 금액, 최대 횟수와 한도는 앱에 표시되는 활성 정책을 따릅니다.'],
      ['본인 추천 금지', '동일인이 자신을 추천하거나 여러 계정으로 반복 참여하면 보상이 보류 또는 취소될 수 있습니다.'],
      ['완료 예약만 인정', '취소, 환불, 결제 미확정 또는 운영 검토 중인 예약은 보상 조건으로 인정되지 않습니다.'],
      ['변경 가능한 상태', '보상은 검토 중, 지급 가능, 지급 완료 또는 취소 상태로 표시되며 근거 예약과 함께 관리됩니다.'],
    ],
    faqEyebrow: 'REFERRAL FAQ',
    faqTitle: '추천 보상에 관해 자주 묻는 질문',
    faq: [
      ['추천 코드만 입력하면 바로 보상되나요?', '아니요. 추천받은 사람이 유형별 유료 완료 조건을 충족하고 검토가 끝난 뒤 지급됩니다.'],
      ['보상 금액은 얼마인가요?', '캠페인과 활성 정책에 따라 달라집니다. 공유 전에 앱에 표시된 금액, 비율과 한도를 확인해 주세요.'],
      ['완료된 예약이 환불되면 어떻게 되나요?', '보상 지급 전이면 취소될 수 있고, 이미 지급된 경우 관계 기록과 정책에 따라 회수 또는 조정될 수 있습니다.'],
      ['추천 현황은 어디서 확인하나요?', '고객은 고객 앱, 마사지 테라피스트는 파트너 앱의 추천 화면에서 가입, 조건 완료와 보상 상태를 확인합니다.'],
    ],
    ctaTitle: '앱에서 내 추천 코드를 확인하세요.',
    ctaBody: '코드 공유부터 조건 충족, 검토와 월렛 지급까지 한 화면에서 확인할 수 있습니다.',
  },
  vi: {
    eyebrow: 'GIỚI THIỆU HANDS',
    title: 'Chia sẻ trải nghiệm tốt, cùng nhận thưởng.',
    intro: 'Khách hàng và đối tác massage có mã giới thiệu riêng. Khi người được giới thiệu hoàn tất điều kiện hoạt động thực tế, phần thưởng sẽ được kiểm tra và ghi vào ví.',
    note: 'Số tiền và trạng thái chính xác được hiển thị theo chính sách giới thiệu hiện hành trong ứng dụng HANDS.',
    customerAction: 'Bắt đầu trong ứng dụng khách hàng',
    partnerAction: 'Đăng ký đối tác massage',
    audienceEyebrow: 'HAI HÀNH TRÌNH GIỚI THIỆU',
    audienceTitle: 'Điều kiện khác nhau theo người bạn giới thiệu.',
    audiences: [
      {
        index: '01',
        title: 'Giới thiệu khách hàng',
        body: 'Việc xét thưởng bắt đầu khi người bạn được giới thiệu đăng ký ứng dụng khách hàng và hoàn tất đặt lịch trả phí đầu tiên.',
        steps: ['Chia sẻ mã trong ứng dụng khách hàng', 'Bạn bè đăng ký bằng mã', 'Hoàn tất đặt lịch trả phí', 'Xét duyệt và ghi vào ví khách hàng'],
      },
      {
        index: '02',
        title: 'Giới thiệu đối tác massage',
        body: 'Việc xét thưởng bắt đầu khi đối tác được giới thiệu hoàn tất đăng ký, KYC, phê duyệt và công việc trả phí đầu tiên.',
        steps: ['Chia sẻ mã trong ứng dụng đối tác', 'Đăng ký và hoàn tất KYC', 'Được duyệt và hoàn tất công việc đầu tiên', 'Xét duyệt và ghi vào ví đối tác'],
      },
    ],
    flowEyebrow: 'QUY TRÌNH PHẦN THƯỞNG',
    flowTitle: 'Đăng ký thôi chưa đủ để nhận thưởng.',
    flowIntro: 'HANDS xác nhận dịch vụ, thanh toán, trùng lặp, hủy và dấu hiệu gian lận trước khi ghi thưởng.',
    flow: [
      ['Liên kết mã', 'Một mã hợp lệ được liên kết một lần với tài khoản khi đăng ký.'],
      ['Hoàn tất điều kiện', 'Cần có đặt lịch hoặc công việc trả phí đầu tiên theo đúng loại giới thiệu.'],
      ['Thời gian chờ và xét duyệt', 'HANDS kiểm tra hủy, hoàn tiền, tài khoản trùng lặp và gian lận.'],
      ['Ghi vào ví', 'Chỉ phần thưởng được duyệt mới được ghi vào ví khách hàng hoặc đối tác.'],
    ],
    rulesEyebrow: 'QUY TẮC RÕ RÀNG',
    rulesTitle: 'Thông tin cần biết trước khi nhận thưởng.',
    rules: [
      ['Áp dụng chính sách hiện hành', 'Tỷ lệ, số tiền cố định, số lượt tối đa và hạn mức theo chính sách đang hiển thị trong ứng dụng.'],
      ['Không tự giới thiệu', 'Tự giới thiệu hoặc dùng nhiều tài khoản có thể khiến phần thưởng bị giữ hoặc hủy.'],
      ['Chỉ tính dịch vụ hoàn tất', 'Đặt lịch bị hủy, hoàn tiền, chưa xác nhận thanh toán hoặc đang xét duyệt không đủ điều kiện.'],
      ['Trạng thái có thể thay đổi', 'Phần thưởng được quản lý cùng đặt lịch căn cứ ở trạng thái chờ, khả dụng, đã ghi hoặc đã hủy.'],
    ],
    faqEyebrow: 'CÂU HỎI THƯỜNG GẶP',
    faqTitle: 'Câu hỏi về phần thưởng giới thiệu',
    faq: [
      ['Nhập mã là nhận thưởng ngay?', 'Không. Người được giới thiệu phải hoàn tất điều kiện trả phí và quá trình xét duyệt.'],
      ['Phần thưởng là bao nhiêu?', 'Số tiền thay đổi theo chiến dịch và chính sách đang hoạt động. Vui lòng kiểm tra trong ứng dụng trước khi chia sẻ.'],
      ['Nếu đặt lịch đã hoàn tất bị hoàn tiền?', 'Phần thưởng chưa trả có thể bị hủy; phần thưởng đã trả có thể được thu hồi hoặc điều chỉnh theo hồ sơ và chính sách.'],
      ['Xem tiến độ ở đâu?', 'Khách hàng xem trong ứng dụng khách hàng; đối tác massage xem trong ứng dụng đối tác.'],
    ],
    ctaTitle: 'Kiểm tra mã giới thiệu của bạn trong ứng dụng.',
    ctaBody: 'Theo dõi việc chia sẻ mã, điều kiện, xét duyệt và ghi thưởng vào ví tại một nơi.',
  },
  en: {
    eyebrow: 'HANDS REFERRALS',
    title: 'Share a good experience and earn together.',
    intro: 'Customers and massage therapists each have their own referral code. A reward is reviewed and credited to the wallet only after the referred person completes the qualifying activity.',
    note: 'The current reward amount and status are shown in the HANDS app under the active referral policy.',
    customerAction: 'Start in the customer app',
    partnerAction: 'Join as a massage therapist',
    audienceEyebrow: 'TWO REFERRAL PATHS',
    audienceTitle: 'The conditions depend on who you refer.',
    audiences: [
      {
        index: '01',
        title: 'Customer referral',
        body: 'Reward review starts after a referred friend joins the customer app and completes their first eligible paid booking.',
        steps: ['Share a code in the customer app', 'Friend signs up with the code', 'First paid booking is completed', 'Review and customer wallet credit'],
      },
      {
        index: '02',
        title: 'Massage therapist referral',
        body: 'Reward review starts after the referred therapist signs up, completes KYC and approval, and finishes their first eligible paid job.',
        steps: ['Share a code in the partner app', 'Referral signs up and completes KYC', 'Approval and first paid job', 'Review and partner wallet credit'],
      },
    ],
    flowEyebrow: 'HOW REWARDS MOVE',
    flowTitle: 'Signup alone does not earn a reward.',
    flowIntro: 'HANDS confirms service completion and payment, then checks cancellation, duplicates and fraud before credit.',
    flow: [
      ['Code attribution', 'One valid referral code is linked once to an account at signup.'],
      ['Qualifying activity', 'The first eligible paid booking or job must be completed.'],
      ['Hold and review', 'HANDS checks cancellations, refunds, duplicate accounts and fraud.'],
      ['Wallet credit', 'Only approved rewards are recorded in the customer or therapist wallet.'],
    ],
    rulesEyebrow: 'CLEAR RULES',
    rulesTitle: 'What to know before a reward is paid.',
    rules: [
      ['Active policy applies', 'Rates, fixed amounts, count limits and caps follow the policy displayed in the app.'],
      ['No self-referral', 'Self-referral or repeated participation with multiple accounts may lead to a hold or cancellation.'],
      ['Completed service only', 'Cancelled, refunded, unpaid or review-pending bookings do not qualify.'],
      ['Status may change', 'Rewards are tracked with the qualifying booking as pending, available, credited or cancelled.'],
    ],
    faqEyebrow: 'REFERRAL FAQ',
    faqTitle: 'Common referral reward questions',
    faq: [
      ['Is the reward paid as soon as a code is entered?', 'No. The referred person must complete the qualifying paid activity and the review must finish.'],
      ['How much is the reward?', 'It varies by campaign and active policy. Check the amount, rate and cap shown in the app before sharing.'],
      ['What if a completed booking is refunded?', 'An unpaid reward may be cancelled. A credited reward may be reversed or adjusted according to the record and policy.'],
      ['Where can I see progress?', 'Customers use the customer app and massage therapists use the partner app to view attribution, qualification and reward status.'],
    ],
    ctaTitle: 'Find your referral code in the app.',
    ctaBody: 'Track sharing, qualification, review and wallet credit in one place.',
  },
  ja: {
    eyebrow: 'HANDS 紹介プログラム',
    title: '良い体験を共有し、一緒に特典を受け取りましょう。',
    intro: '顧客とマッサージセラピストにはそれぞれ紹介コードがあります。紹介された方が所定の活動条件を完了すると、審査後にウォレットへ特典が反映されます。',
    note: '正確な特典額と状態は、HANDSアプリに表示される現在の紹介ポリシーをご確認ください。',
    customerAction: '顧客アプリで始める',
    partnerAction: 'マッサージセラピストとして参加',
    audienceEyebrow: '2つの紹介方法',
    audienceTitle: '紹介する相手によって条件が異なります。',
    audiences: [
      {
        index: '01',
        title: '顧客紹介',
        body: '友人が顧客アプリに登録し、初回の対象有料予約を完了すると特典審査が始まります。',
        steps: ['顧客アプリでコードを共有', '友人がコードで登録', '初回有料予約を完了', '審査後に顧客ウォレットへ反映'],
      },
      {
        index: '02',
        title: 'マッサージセラピスト紹介',
        body: '紹介されたセラピストが登録、KYC、承認を完了し、初回の対象有料業務を完了すると審査が始まります。',
        steps: ['パートナーアプリでコードを共有', '登録とKYCを完了', '承認後に初回有料業務を完了', '審査後にパートナーウォレットへ反映'],
      },
    ],
    flowEyebrow: '特典の流れ',
    flowTitle: '登録だけでは特典は付与されません。',
    flowIntro: 'サービス完了と決済確定後、キャンセル、重複、不正利用を確認します。',
    flow: [
      ['コード連携', '有効な紹介コードは登録時に1アカウントへ1回連携されます。'],
      ['条件完了', '紹介種別に応じた初回有料予約または業務の完了が必要です。'],
      ['保留期間と審査', 'キャンセル、返金、重複アカウント、不正利用を確認します。'],
      ['ウォレット反映', '承認された特典のみ顧客またはセラピストのウォレットへ記録されます。'],
    ],
    rulesEyebrow: '明確なルール',
    rulesTitle: '特典を受け取る前にご確認ください。',
    rules: [
      ['現在のポリシーを適用', '比率、固定額、回数上限、金額上限はアプリ表示の有効なポリシーに従います。'],
      ['自己紹介は禁止', '自分自身の紹介や複数アカウントによる参加は保留・取消の対象です。'],
      ['完了サービスのみ', 'キャンセル、返金、未決済または審査中の予約は対象外です。'],
      ['状態は変更されます', '特典は対象予約とともに審査中、利用可能、反映済み、取消で管理されます。'],
    ],
    faqEyebrow: '紹介FAQ',
    faqTitle: '紹介特典に関するよくある質問',
    faq: [
      ['コード入力ですぐに付与されますか？', 'いいえ。紹介された方が対象有料条件を完了し、審査が終わった後に付与されます。'],
      ['特典はいくらですか？', 'キャンペーンと有効なポリシーにより異なります。共有前にアプリで金額、比率、上限をご確認ください。'],
      ['完了予約が返金された場合は？', '未付与の特典は取り消される場合があり、付与済みの場合は記録とポリシーに基づき調整されることがあります。'],
      ['進捗はどこで確認できますか？', '顧客は顧客アプリ、セラピストはパートナーアプリの紹介画面で確認できます。'],
    ],
    ctaTitle: 'アプリで紹介コードを確認しましょう。',
    ctaBody: 'コード共有から条件完了、審査、ウォレット反映まで一か所で確認できます。',
  },
  zh: {
    eyebrow: 'HANDS 推荐计划',
    title: '分享优质体验，一起获得奖励。',
    intro: '客户和按摩治疗师各自拥有推荐码。被推荐人完成相应的真实活动条件后，奖励经审核记入钱包。',
    note: '准确奖励金额和状态以HANDS应用中当前生效的推荐政策为准。',
    customerAction: '在客户应用中开始',
    partnerAction: '加入成为按摩治疗师',
    audienceEyebrow: '两种推荐路径',
    audienceTitle: '根据推荐对象，条件有所不同。',
    audiences: [
      {
        index: '01',
        title: '客户推荐',
        body: '被推荐的朋友注册客户应用并完成首个符合条件的付费预约后，奖励审核开始。',
        steps: ['在客户应用分享推荐码', '朋友使用推荐码注册', '完成首个付费预约', '审核后记入客户钱包'],
      },
      {
        index: '02',
        title: '按摩治疗师推荐',
        body: '被推荐的治疗师完成注册、KYC和审批，并完成首个符合条件的付费工作后，奖励审核开始。',
        steps: ['在伙伴应用分享推荐码', '注册并完成KYC', '获批并完成首个付费工作', '审核后记入伙伴钱包'],
      },
    ],
    flowEyebrow: '奖励流程',
    flowTitle: '仅注册不会获得奖励。',
    flowIntro: '服务完成并确认支付后，HANDS会检查取消、重复账户和欺诈风险。',
    flow: [
      ['推荐码关联', '一个有效推荐码在注册时仅与一个账户关联一次。'],
      ['完成条件', '须完成对应类型的首个符合条件的付费预约或工作。'],
      ['等待与审核', 'HANDS检查取消、退款、重复账户和欺诈。'],
      ['钱包入账', '仅经批准的奖励会记入客户或治疗师钱包。'],
    ],
    rulesEyebrow: '清晰规则',
    rulesTitle: '奖励发放前需要了解。',
    rules: [
      ['适用当前政策', '比例、固定金额、次数和金额上限以应用展示的生效政策为准。'],
      ['禁止自我推荐', '自我推荐或使用多个账户重复参与可能导致奖励暂停或取消。'],
      ['仅限完成服务', '已取消、已退款、未确认支付或审核中的预约不符合条件。'],
      ['状态可能变化', '奖励与依据预约一并记录为待审核、可用、已入账或已取消。'],
    ],
    faqEyebrow: '推荐常见问题',
    faqTitle: '关于推荐奖励的常见问题',
    faq: [
      ['输入推荐码后会立即奖励吗？', '不会。被推荐人须完成对应付费条件并通过审核。'],
      ['奖励金额是多少？', '金额取决于活动和生效政策。分享前请在应用中查看金额、比例和上限。'],
      ['已完成预约后来退款怎么办？', '未发放奖励可能被取消；已入账奖励可能按记录和政策撤回或调整。'],
      ['在哪里查看进度？', '客户在客户应用、按摩治疗师在伙伴应用的推荐页面查看关联、条件和奖励状态。'],
    ],
    ctaTitle: '在应用中查看您的推荐码。',
    ctaBody: '集中查看分享、条件完成、审核和钱包入账状态。',
  },
} as const;

export function ReferralIntroPage({ locale }: { readonly locale: PublicSiteLocale }) {
  const copy = referralCopy[locale];

  return (
    <div className="hands-site referral-page">
      <HandsSiteHeader currentPath="/referrals" locale={locale} />
      <main>
        <section className="referral-hero">
          <div className="referral-hero-overlay" />
          <div className="referral-hero-copy">
            <p className="eyebrow">{copy.eyebrow}</p>
            <h1>{copy.title}</h1>
            <p>{copy.intro}</p>
            <div className="referral-actions">
              <Link className="button button-light" href={`/${locale}/partners#download`}>
                {copy.customerAction}
              </Link>
              <a className="text-button" href="https://join.hands.vn">
                {copy.partnerAction} <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>
          <p className="referral-hero-note">{copy.note}</p>
        </section>

        <section className="referral-audiences">
          <header className="referral-section-heading">
            <p className="eyebrow dark">{copy.audienceEyebrow}</p>
            <h2>{copy.audienceTitle}</h2>
          </header>
          <div className="referral-audience-grid">
            {copy.audiences.map((audience) => (
              <article key={audience.index}>
                <span>{audience.index}</span>
                <h3>{audience.title}</h3>
                <p>{audience.body}</p>
                <ol>
                  {audience.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </article>
            ))}
          </div>
        </section>

        <section className="referral-flow-section">
          <div className="referral-flow-intro">
            <p className="eyebrow">{copy.flowEyebrow}</p>
            <h2>{copy.flowTitle}</h2>
            <p>{copy.flowIntro}</p>
          </div>
          <ol className="referral-flow-list">
            {copy.flow.map(([title, body], index) => (
              <li key={title}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="referral-rules-section">
          <header className="referral-section-heading">
            <p className="eyebrow dark">{copy.rulesEyebrow}</p>
            <h2>{copy.rulesTitle}</h2>
          </header>
          <div className="referral-rule-grid">
            {copy.rules.map(([title, body], index) => (
              <article key={title}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="referral-faq-section">
          <div>
            <p className="eyebrow">{copy.faqEyebrow}</p>
            <h2>{copy.faqTitle}</h2>
          </div>
          <div>
            {copy.faq.map(([question, answer], index) => (
              <details key={question} open={index === 0}>
                <summary>{question}</summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="referral-final-cta">
          <div>
            <p className="eyebrow">{copy.eyebrow}</p>
            <h2>{copy.ctaTitle}</h2>
            <p>{copy.ctaBody}</p>
          </div>
          <div className="referral-actions">
            <Link className="button button-light" href={`/${locale}/partners#download`}>
              {copy.customerAction}
            </Link>
            <a className="text-button" href="https://join.hands.vn">
              {copy.partnerAction} <span aria-hidden="true">↗</span>
            </a>
          </div>
        </section>
      </main>
      <HandsSiteFooter locale={locale} />
    </div>
  );
}
