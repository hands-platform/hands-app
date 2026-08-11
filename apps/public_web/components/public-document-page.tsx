import type { PublicSiteKey, PublicSiteLocale } from '../lib/site-content';
import { HandsSiteFooter, HandsSiteHeader } from './hands-site-chrome';

type DocumentDefinition = {
  title: string;
  intro: string;
  sections: Array<[string, string]>;
};

const routeTitles = {
  '/company': ['회사 소개', 'Giới thiệu HANDS', 'About HANDS', '会社紹介', '公司介绍'],
  '/service-areas': ['서비스 지역', 'Khu vực dịch vụ', 'Service areas', 'サービスエリア', '服务地区'],
  '/contact': ['문의하기', 'Liên hệ', 'Contact', 'お問い合わせ', '联系我们'],
  '/support/faq': ['자주 묻는 질문', 'Câu hỏi thường gặp', 'Frequently asked questions', 'よくある質問', '常见问题'],
  '/safety': ['안전과 신뢰', 'An toàn và tin cậy', 'Safety and trust', '安全と信頼', '安全与信赖'],
  '/support/disputes': ['신고 및 분쟁 처리', 'Báo cáo và tranh chấp', 'Reports and disputes', '通報・紛争対応', '举报与争议处理'],
  '/partner-policy': ['마사지 테라피스트 운영정책', 'Chính sách hoạt động đối tác', 'Partner operating policy', 'パートナー運営ポリシー', '伙伴运营政策'],
  '/legal/partner-terms': ['마사지 테라피스트 이용약관', 'Điều khoản đối tác', 'Partner terms', 'パートナー規約', '伙伴条款'],
  '/legal/privacy': ['개인정보처리방침', 'Chính sách quyền riêng tư', 'Privacy policy', 'プライバシーポリシー', '隐私政策'],
  '/legal/terms': ['서비스 이용약관', 'Điều khoản dịch vụ', 'Terms of service', '利用規約', '服务条款'],
  '/legal/cookies': ['쿠키 정책', 'Chính sách cookie', 'Cookie policy', 'Cookieポリシー', 'Cookie政策'],
  '/company-info': ['사업자 정보', 'Thông tin doanh nghiệp', 'Company information', '事業者情報', '企业信息'],
} as const;

const localeIndex: Record<PublicSiteLocale, number> = { ko: 0, vi: 1, en: 2, ja: 3, zh: 4 };

export function publicDocumentDefinition(
  path: string,
  locale: PublicSiteLocale,
): DocumentDefinition | null {
  const labels = routeTitles[path as keyof typeof routeTitles];
  if (!labels) return null;
  const title = labels[localeIndex[locale]];
  const body = documentBody(locale);
  return {
    title,
    intro: body.intro(title),
    sections: body.sections(path),
  };
}

export function PublicDocumentPage({
  definition,
  locale,
  path,
  site,
}: {
  readonly definition: DocumentDefinition;
  readonly locale: PublicSiteLocale;
  readonly path: string;
  readonly site: PublicSiteKey;
}) {
  const recruitment = site === 'PARTNER_RECRUITMENT';
  return (
    <div className="hands-site public-document-page">
      <HandsSiteHeader
        currentPath={path}
        locale={locale}
        site={recruitment ? 'recruitment' : 'main'}
      />
      <main>
        <header className="public-document-heading">
          <p className="eyebrow dark">HANDS INFORMATION</p>
          <h1>{definition.title}</h1>
          <p>{definition.intro}</p>
        </header>
        <div className="public-document-content">
          {definition.sections.map(([title, body], index) => (
            <section key={title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h2>{title}</h2>
                <p>{body}</p>
              </div>
            </section>
          ))}
        </div>
      </main>
      <HandsSiteFooter locale={locale} site={recruitment ? 'recruitment' : 'main'} />
    </div>
  );
}

function documentBody(locale: PublicSiteLocale) {
  if (locale === 'vi') {
    return {
      intro: (title: string) => `${title} của HANDS và thông tin cần thiết để sử dụng dịch vụ rõ ràng, an toàn.`,
      sections: (path: string) => vietnameseSections(path),
    };
  }
  if (locale === 'ja') {
    return {
      intro: (title: string) => `HANDSの${title}と、サービスを安心して利用するために必要な情報です。`,
      sections: (path: string) => japaneseSections(path),
    };
  }
  if (locale === 'zh') {
    return {
      intro: (title: string) => `这里说明HANDS的${title}以及安全使用服务所需的重要信息。`,
      sections: (path: string) => chineseSections(path),
    };
  }
  if (locale === 'en') {
    return {
      intro: (title: string) => `${title} and the information needed to use HANDS clearly and safely.`,
      sections: (path: string) => englishSections(path),
    };
  }
  return {
    intro: (title: string) => `HANDS의 ${title}와 서비스를 명확하고 안전하게 이용하기 위해 필요한 정보를 안내합니다.`,
    sections: (path: string) => koreanSections(path),
  };
}

function koreanSections(path: string): Array<[string, string]> {
  if (path === '/legal/privacy') {
    return [
      [
        '적용 범위와 시행',
        '이 방침은 HANDS 공개 웹사이트, 고객 앱, 마사지 테라피스트 앱 및 고객지원에서 처리하는 개인정보에 적용됩니다.\n\n최종 업데이트: 2026년 7월 31일\n시행일: HANDS 정식 서비스 개시일\n\nHANDS 운영 법인의 정식 상호, 등록번호, 주소와 개인정보 담당 연락처는 법인 정보 확정 후 정식 출시 전에 웹사이트 하단과 이 방침에 게시합니다.',
      ],
      [
        '수집하는 개인정보',
        '• 계정 정보: 이름, 휴대전화번호, 인증 정보, 프로필과 언어 설정\n• 예약 정보: 선택한 서비스, 예약 일시, 서비스 주소, 요청사항, 예약 상태와 취소 사유\n• 위치 정보: 가까운 마사지 테라피스트 조회, 매칭, 서비스 진행 및 분쟁 확인에 필요한 현재 위치와 예약 위치\n• 거래 정보: 결제수단, 결제·환불 금액, 거래 식별자, 쿠폰 및 고객 월렛 원장\n• 상담·안전 정보: 채팅, 첨부 이미지, 리뷰, 신고, 고객지원 기록과 운영 판단 기록\n• 기기·이용 정보: IP 주소, 기기·운영체제·앱 버전, 세션, 푸시 토큰, 접속·오류·보안 로그\n• 마사지 테라피스트 정보: 신원·KYC 자료, 프로필 사진, 서비스·가격, 활동 지역, 정산·세금·은행 정보\n\nHANDS는 목적에 필요한 최소 정보만 수집하며, 정확한 위치와 결제·금융 관련 정보 등 민감한 데이터는 별도 보호조치를 적용합니다.',
      ],
      [
        '개인정보 이용 목적',
        '개인정보는 다음 목적에 필요한 범위에서 처리합니다.\n\n• 계정 생성, 본인 확인, 로그인과 보안\n• 가까운 마사지 테라피스트 검색, 예약, 매칭, 채팅과 서비스 진행\n• 결제, 환불, 쿠폰, 월렛, 정산과 세무 기록 처리\n• 위치·채팅·예약 기록을 이용한 취소, 노쇼, 신고와 분쟁 검토\n• 알림 발송, 고객지원, 서비스 품질과 안전 개선\n• 부정 이용, 계정 탈취, 결제 오류와 법령 위반의 예방·조사\n• 법적 의무 이행과 감사 가능한 운영 기록 보존\n\n수집 당시 안내한 목적과 양립할 수 없는 새로운 목적으로 이용하려면 법령이 허용하는 경우를 제외하고 별도 동의를 받습니다.',
      ],
      [
        '처리 근거와 동의',
        'HANDS는 이용자의 명확한 동의, 서비스 계약의 체결·이행, 법적 의무 준수, 긴급한 생명·건강 보호 또는 관계 법령이 허용하는 근거에 따라 개인정보를 처리합니다.\n\n동의가 필요한 경우 처리할 데이터, 목적, 처리 주체와 이용자의 권리를 사전에 알리고 선택 가능한 방식으로 동의를 받습니다. 침묵이나 응답하지 않는 행위는 동의로 보지 않습니다. 이용자는 동의를 철회할 수 있으며, 철회 전 적법하게 처리된 정보에는 영향을 주지 않습니다.',
      ],
      [
        '보유 기간과 파기',
        '개인정보는 해당 목적을 달성할 때까지 보유한 뒤 복구하기 어려운 방법으로 삭제하거나 파기합니다. 다만 결제, 환불, 세금, 회계, 분쟁, 사기 방지와 법적 의무에 필요한 기록은 관계 법령이 정한 기간 또는 진행 중인 분쟁이 종료될 때까지 분리 보관할 수 있습니다.\n\n계정 삭제 요청이 접수되어도 미완료 예약, 환불, 정산, 신고나 법적 보존 의무가 있으면 해당 기록만 제한적으로 보관하고 다른 목적으로 사용하지 않습니다.',
      ],
      [
        '제공 및 처리 위탁',
        'HANDS는 서비스 제공에 필요한 범위에서 다음 유형의 수신자 또는 처리업체와 정보를 처리할 수 있습니다.\n\n• 예약을 수행하는 고객과 마사지 테라피스트: 이름, 프로필, 서비스 주소, 예약·채팅 정보\n• 결제 및 환불 사업자: 거래 식별자, 결제수단, 금액과 상태\n• 휴대전화 인증, 푸시 알림, 지도·주소, 클라우드·스토리지, 보안·고객지원 사업자\n• 법령상 의무가 있거나 적법한 요청이 있는 정부·수사·사법기관\n\n운영 공급업체가 확정되면 업체명, 처리 목적, 데이터 항목과 보유 기간을 이 방침 또는 별도 위탁 목록에 공개합니다. 개인정보를 판매하지 않습니다.',
      ],
      [
        '국외 이전',
        '클라우드, 푸시 알림, 지도 또는 결제 서비스의 서버가 베트남 밖에 있는 경우 개인정보가 국외에서 처리될 수 있습니다. HANDS는 이전 국가, 수신자, 목적, 데이터 항목, 보유 기간과 보호조치를 확인하고 베트남의 개인정보 보호 요건에 따라 필요한 동의, 영향평가 및 기록을 이행합니다.',
      ],
      [
        '이용자의 권리',
        '이용자는 관계 법령이 정하는 범위에서 다음을 요청할 수 있습니다.\n\n• 개인정보 처리 사실의 고지와 열람·제공\n• 동의, 동의 철회와 처리 반대\n• 부정확한 정보의 정정\n• 삭제, 처리 제한과 관련 민원 제기\n• 손해배상 청구 및 위반 사항 신고\n\n요청은 앱 고객지원 또는 정식 출시 전에 고지할 개인정보 담당 연락처로 접수합니다. HANDS는 본인 확인 후 법정 기한 안에 처리하며, 다른 사람의 권리나 법적 의무 때문에 제한되는 경우 그 사유를 안내합니다.',
      ],
      [
        '안전조치와 사고 대응',
        'HANDS는 역할 기반 접근통제, 인증정보 보호, 전송구간 암호화, 중요 작업 감사로그, 결제 상태의 중복 처리 방지, 백업과 취약점 점검 등 합리적인 기술적·관리적 보호조치를 적용합니다.\n\n개인정보 침해가 확인되면 영향을 통제하고 원인을 조사하며, 관계 법령이 요구하는 기관과 이용자에게 필요한 내용을 통지합니다.',
      ],
      [
        '변경 및 문의',
        '중요한 변경이 있으면 시행 전에 웹사이트 또는 앱에서 변경 내용과 시행일을 알립니다. 수집 목적, 민감정보 처리 또는 제3자 제공 범위가 실질적으로 달라지는 경우 필요한 동의를 다시 받습니다.\n\n이 방침은 베트남 개인정보 보호에 관한 정부 시행령 제13/2023/NĐ-CP, 소비자 권리 보호법 제19/2023/QH15 및 적용되는 관계 법령을 기준으로 작성되었습니다. 정식 사업자·담당자 정보가 등록되기 전까지는 이 문서를 출시 준비용 정책으로 운영합니다.\n\n베트남어본을 기준 문서로 하며, 번역본과 내용이 다른 경우 관계 법령이 허용하는 범위에서 베트남어본을 우선합니다.',
      ],
    ];
  }
  if (path === '/legal/terms') {
    return [
      [
        '약관의 목적과 시행',
        '이 약관은 HANDS가 제공하는 공개 웹사이트, 고객 앱, 예약·매칭·채팅·결제·월렛 및 고객지원 서비스의 이용 조건을 정합니다.\n\n최종 업데이트: 2026년 7월 31일\n시행일: HANDS 정식 서비스 개시일\n\nHANDS 운영 법인의 정식 상호, 등록번호, 주소와 연락처는 법인 정보 확정 후 정식 출시 전에 웹사이트 하단에 게시합니다.',
      ],
      [
        '서비스의 성격',
        'HANDS는 고객이 마사지 테라피스트의 공개 프로필, 서비스, 가격과 리뷰를 확인하고 앱에서 예약할 수 있도록 연결하는 플랫폼입니다. 웹사이트는 정보 제공용이며 예약은 고객 앱에서 진행합니다.\n\n마사지 테라피스트는 자신의 서비스 제공 자격과 프로필 정보의 정확성에 책임을 집니다. HANDS는 신원·운영정보 확인, 예약 기록, 결제와 분쟁 지원을 제공하지만 특정 치료 효과나 의료적 결과를 보증하지 않습니다.',
      ],
      [
        '이용 자격과 계정',
        '이용자는 관계 법령상 계약을 체결할 수 있어야 하며 정확한 휴대전화번호와 계정 정보를 제공해야 합니다. 계정과 인증수단을 다른 사람에게 양도하거나 공유해서는 안 됩니다.\n\n부정 가입, 타인 사칭, 자동화된 접근, 결제 악용 또는 안전을 위협하는 행위가 확인되면 HANDS는 확인 절차를 거쳐 이용을 제한하거나 계정을 정지할 수 있습니다.',
      ],
      [
        '예약과 매칭',
        '고객은 서비스 주소, 일시, 마사지 테라피스트, 서비스와 결제수단을 확인한 뒤 예약을 요청합니다. 가까운 순서와 이용 가능 상태는 저장된 위치, 활동 시간과 시스템 상태를 기준으로 제공되며 실제 도착시간을 보장하지 않습니다.\n\n마사지 테라피스트가 예약을 수락해 매칭이 성립하면 출발 단계가 시작되고 채팅이 열립니다. 고객과 마사지 테라피스트는 채팅을 통해 도착, 위치와 필요한 요청을 확인해야 합니다.',
      ],
      [
        '가격, 결제와 월렛',
        '최종 결제금액은 예약 확정 화면에 표시된 서비스 가격, 쿠폰, 세금과 적용 가능한 수수료를 기준으로 합니다. 결제수단은 현금, 고객 월렛 또는 지원되는 카드·전자결제가 될 수 있습니다.\n\n현금 결제는 고객이 마사지 테라피스트에게 직접 지급합니다. 월렛·카드 결제는 앱에 표시된 절차에 따라 승인·취소·환불됩니다. 고객 월렛은 HANDS 서비스 결제와 승인된 환불·보상에 사용하는 전자적 잔액 기록이며 은행 예금이나 양도 가능한 현금계좌가 아닙니다.',
      ],
      [
        '취소, 노쇼와 환불',
        '고객은 마사지 테라피스트가 예약을 수락하기 전까지 앱에서 예약을 취소할 수 있습니다. 매칭 후에는 고객이 직접 취소할 수 없으며, 마사지 테라피스트가 채팅에서 고객 요청 또는 정당한 사유를 기록해 취소를 요청합니다.\n\n매칭 후 취소 시 현금 결제에는 서비스 대금 흐름이 발생하지 않고, 월렛 결제액은 고객 월렛으로 복구되며, 카드 결제는 결제사업자의 취소·환불 절차를 따릅니다. 서비스가 완료되지 않았으므로 마사지 테라피스트 지급액, 플랫폼 수수료와 관련 세금도 확정되지 않습니다.\n\n마사지 테라피스트가 고객을 만나지 못한 경우에는 채팅, 예약 위치, 양측 위치와 연락 기록을 바탕으로 HANDS가 노쇼 여부와 결제·환불 결과를 검토합니다. 결제수단 또는 금융기관에 따라 실제 환불 반영 시점은 달라질 수 있습니다.',
      ],
      [
        '서비스 완료와 분쟁',
        '마사지 테라피스트는 서비스를 마친 뒤 작업 완료를 처리해야 하며, 완료 처리 후 결제·수수료·정산 기록이 확정됩니다. 양측이 만난 뒤 서비스 품질, 안전 또는 결제에 관한 분쟁이 발생하면 고객지원에 접수해야 합니다.\n\nHANDS는 예약 상태, 채팅, 결제, 서비스 주소와 허용된 위치 기록 등 관련 증거를 검토해 운영 결과를 결정할 수 있습니다. 이용자는 조사에 필요한 정확한 정보를 제공하고 기록 보존을 방해해서는 안 됩니다.',
      ],
      [
        '이용자 의무와 금지행위',
        '고객과 마사지 테라피스트는 서로를 존중하고 안전한 서비스 환경을 유지해야 합니다. 다음 행위는 금지됩니다.\n\n• 허위 정보, 사칭, 조작된 리뷰나 결제 증거 제출\n• 폭력, 위협, 차별, 성희롱, 불법 또는 서비스 범위를 벗어난 요구\n• 플랫폼을 우회하기 위한 연락처·결제 유도 또는 수수료 회피\n• 다른 사람의 개인정보, 채팅, 사진이나 위치를 무단 공개\n• 앱·API의 무단 접근, 자동화, 역공학, 악성코드 또는 서비스 방해\n\n위반 정도에 따라 예약 제한, 콘텐츠 삭제, 계정 정지, 손해배상 청구 또는 관계기관 신고가 이루어질 수 있습니다.',
      ],
      [
        '리뷰, 채팅과 콘텐츠',
        '이용자가 등록한 리뷰, 메시지와 이미지는 사실에 근거해야 하며 타인의 권리와 법령을 침해해서는 안 됩니다. HANDS는 서비스 운영, 안전, 신고 처리와 분쟁 증거 보존에 필요한 범위에서 해당 콘텐츠를 저장·검토할 수 있습니다.\n\n불법, 허위, 모욕, 광고, 개인정보 침해 또는 예약과 무관한 콘텐츠는 사전 통지 없이 숨김·삭제될 수 있습니다. 콘텐츠의 저작권은 원칙적으로 작성자에게 남지만, HANDS는 서비스 제공과 분쟁 처리에 필요한 범위에서 이를 이용할 수 있습니다.',
      ],
      [
        '서비스 변경과 중단',
        '점검, 보안 사고, 통신·지도·결제사업자 장애, 천재지변 또는 법적 요구로 서비스 일부가 일시 중단될 수 있습니다. HANDS는 합리적으로 가능한 경우 사전에 알리고, 긴급한 보안·안전 조치는 사후에 안내할 수 있습니다.\n\n중요 기능이나 이용 조건을 변경하는 경우 적용일과 영향을 고지합니다. 이용자에게 불리한 중대한 변경은 관계 법령이 요구하는 절차와 기간을 따릅니다.',
      ],
      [
        '책임과 손해 처리',
        'HANDS는 고의 또는 과실로 이용자에게 발생시킨 직접 손해에 대해 관계 법령에 따른 책임을 집니다. 이용자의 허위 정보, 약관 위반, 기기·통신 장애, 제3자 서비스 장애 또는 통제하기 어려운 사유로 발생한 손해는 HANDS의 책임 범위에서 제외되거나 제한될 수 있습니다.\n\n이 조항은 소비자에게 법률상 보장된 권리를 배제하거나 HANDS의 고의·중대한 과실 책임을 면제하지 않습니다.',
      ],
      [
        '준거법, 분쟁 해결과 변경',
        '이 약관은 베트남 법률을 따릅니다. 분쟁이 발생하면 먼저 앱 고객지원에서 사실관계와 해결안을 협의하고, 해결되지 않으면 베트남의 권한 있는 소비자 보호기관, 조정·중재기관 또는 법원에 신청할 수 있습니다.\n\n이 약관은 베트남 소비자 권리 보호법 제19/2023/QH15, 전자거래법 제20/2023/QH15, 전자상거래에 관한 시행령 제52/2013/NĐ-CP 및 적용되는 관계 법령을 기준으로 작성되었습니다. 변경 시 새 시행일과 주요 내용을 이 페이지에 고지합니다. 베트남어본을 기준 문서로 하며, 번역본과 다른 경우 관계 법령이 허용하는 범위에서 베트남어본을 우선합니다.',
      ],
    ];
  }
  if (path === '/legal/cookies') {
    return [
      [
        '정책 범위와 현재 상태',
        '이 정책은 hands.vn과 HANDS가 운영하는 공개 웹사이트에서 사용하는 쿠키 및 유사 저장기술을 설명합니다.\n\n최종 업데이트: 2026년 7월 31일\n시행일: HANDS 정식 서비스 개시일\n\n현재 공개 웹사이트는 광고, 사용자 추적 또는 선택적 방문 분석 쿠키를 사용하지 않습니다. 선택적 기술을 도입하기 전에는 이 정책과 동의 화면을 먼저 업데이트합니다.',
      ],
      [
        '쿠키란 무엇인가요?',
        '쿠키는 웹사이트가 브라우저에 저장하는 작은 데이터입니다. 로그인 상태, 보안 설정, 언어와 같은 정보를 기억하는 데 사용할 수 있습니다. 로컬 스토리지, 세션 스토리지와 기기 식별자처럼 비슷한 기능을 하는 기술도 이 정책에서 함께 설명합니다.',
      ],
      [
        '필수 기술',
        '웹사이트 호스팅, 보안, 부하 분산, 언어 경로 유지 또는 정상적인 페이지 제공을 위해 필수 쿠키나 요청 로그가 사용될 수 있습니다. 이러한 기술은 웹사이트가 요청된 기능을 제공하거나 보안을 유지하는 데 필요하므로 선택적 광고 목적으로 사용하지 않습니다.\n\nHANDS가 직접 설정하는 필수 항목이 생기면 이름, 목적과 보유 기간을 아래 목록에 추가합니다. 현재 공개 웹사이트 코드에는 HANDS가 설정하는 별도의 필수 쿠키가 없습니다.',
      ],
      [
        '분석 및 광고 쿠키',
        '현재 HANDS 공개 웹사이트에는 방문자 행동을 추적하는 분석 쿠키, 광고 픽셀, 교차 사이트 추적기 또는 개인화 광고 쿠키가 설치되어 있지 않습니다.\n\n향후 선택적 분석 또는 마케팅 기술을 도입할 경우 기본값은 비활성으로 두고, 제공업체·목적·보유 기간을 알린 뒤 이용자의 명확한 동의를 받습니다. 거부해도 필수적인 웹사이트 이용에는 불이익이 없도록 합니다.',
      ],
      [
        '외부 링크와 제3자 서비스',
        '앱 스토어, 결제사업자, 지도 또는 다른 외부 사이트로 이동하면 해당 사업자가 자체 쿠키와 개인정보처리방침을 적용할 수 있습니다. HANDS는 외부 사이트가 설정하는 쿠키를 통제하지 않으므로 이동 전 해당 사업자의 정책을 확인해 주세요.',
      ],
      [
        '브라우저에서 관리하기',
        '이용자는 브라우저 설정에서 쿠키를 확인·삭제·차단할 수 있습니다. 모든 쿠키를 차단하면 언어 선택, 보안 또는 향후 로그인 기능 등 일부 기능이 정상적으로 작동하지 않을 수 있습니다.\n\n선택적 쿠키가 도입되면 웹사이트의 쿠키 설정에서 동의를 변경하거나 철회할 수 있도록 제공합니다. 동의 철회 전 적법하게 처리된 정보에는 영향을 주지 않습니다.',
      ],
      [
        '변경과 문의',
        '사용하는 기술이나 제공업체가 바뀌면 이 정책의 목록, 목적과 보유 기간을 업데이트합니다. 선택적 추적 범위가 실질적으로 변경되면 다시 동의를 받습니다.\n\n쿠키 및 개인정보 처리에 관한 문의는 앱 고객지원 또는 정식 출시 전에 웹사이트에 고지할 개인정보 담당 연락처로 접수할 수 있습니다. 베트남어본을 기준 문서로 하며, 번역본과 다른 경우 관계 법령이 허용하는 범위에서 베트남어본을 우선합니다.',
      ],
    ];
  }
  if (path === '/service-areas') {
    return [
      ['현재 운영 지역', 'HANDS는 호찌민, 하노이, 다낭과 나트랑을 중심으로 마사지 테라피스트 공개 프로필을 제공합니다. 실제 예약 가능 지역은 앱에서 확인합니다.'],
      ['지역 확대', '마사지 테라피스트 검증과 서비스 운영 준비가 완료된 지역부터 순차적으로 확대합니다.'],
      ['지역별 마사지 테라피스트', '마사지 테라피스트 목록에서 도시와 구 단위로 공개 프로필을 확인할 수 있습니다.'],
    ];
  }
  if (path === '/contact') {
    return [
      ['고객 문의', '예약, 결제, 환불과 서비스 문제는 HANDS 앱의 고객지원에서 예약 정보와 함께 접수해 주세요.'],
      ['마사지 테라피스트 문의', '가입, 검증, 서비스 운영과 정산 문의는 마사지 테라피스트 앱 또는 마사지 테라피스트 지원 채널을 이용해 주세요.'],
      ['사업 제휴', '회사 및 제휴 문의는 공식 이메일과 사업자 연락처가 확정된 후 이 페이지에 고지합니다.'],
    ];
  }
  if (path === '/support/faq') {
    return [
      ['예약은 어디에서 하나요?', '마사지 테라피스트 상세 페이지에서 서비스와 리뷰를 확인한 뒤 HANDS 앱에서 예약합니다. 웹사이트에서는 예약을 받지 않습니다.'],
      ['마사지 테라피스트는 어떻게 확인하나요?', '공개 프로필, 서비스 가격, 활동 지역과 고객 리뷰를 확인할 수 있습니다.'],
      ['문제가 생기면 어떻게 하나요?', '앱 고객지원에서 예약, 채팅과 결제 기록을 기준으로 신고 및 분쟁 검토를 요청할 수 있습니다.'],
    ];
  }
  return [
    ['운영 원칙', 'HANDS는 정보의 투명성, 책임 있는 운영, 고객과 마사지 테라피스트 양쪽의 안전을 우선합니다.'],
    ['이용자 확인 사항', '예약 전 마사지 테라피스트 프로필, 가격과 서비스 내용을 확인해 주세요. 중요한 변경은 이 페이지에 고지합니다.'],
    ['문의와 변경', '앱 고객지원 또는 공식 문의 채널을 이용해 주세요. 정책과 법적 문서는 시행일과 함께 업데이트합니다.'],
  ];
}

function vietnameseSections(path: string): Array<[string, string]> {
  if (path === '/legal/privacy') {
    return [
      [
        'Phạm vi áp dụng và hiệu lực',
        `Chính sách này áp dụng cho dữ liệu cá nhân được xử lý trên website công khai, ứng dụng khách hàng, ứng dụng đối tác massage và kênh hỗ trợ khách hàng của HANDS.

Cập nhật lần cuối: 31/07/2026
Ngày có hiệu lực: ngày HANDS chính thức cung cấp dịch vụ

Tên pháp lý, mã số doanh nghiệp, địa chỉ và đầu mối bảo vệ dữ liệu cá nhân của đơn vị vận hành HANDS sẽ được công bố tại chân trang website và trong chính sách này trước khi dịch vụ chính thức ra mắt.`,
      ],
      [
        'Dữ liệu cá nhân được thu thập',
        `• Thông tin tài khoản: họ tên, số điện thoại, thông tin xác thực, hồ sơ và lựa chọn ngôn ngữ
• Thông tin đặt lịch: dịch vụ, thời gian, địa chỉ phục vụ, yêu cầu, trạng thái và lý do hủy
• Dữ liệu vị trí: vị trí hiện tại và vị trí đặt lịch cần thiết để tìm đối tác gần nhất, ghép nối, vận hành dịch vụ và xử lý tranh chấp
• Dữ liệu giao dịch: phương thức thanh toán, số tiền thanh toán hoặc hoàn tiền, mã giao dịch, coupon và sổ cái ví khách hàng
• Dữ liệu hỗ trợ và an toàn: trò chuyện, hình ảnh đính kèm, đánh giá, báo cáo, hồ sơ hỗ trợ và quyết định vận hành
• Dữ liệu thiết bị và sử dụng: địa chỉ IP, thiết bị, hệ điều hành, phiên bản ứng dụng, phiên đăng nhập, token thông báo, nhật ký truy cập, lỗi và bảo mật
• Dữ liệu đối tác massage: thông tin định danh và KYC, ảnh hồ sơ, dịch vụ, giá, khu vực hoạt động, ngân hàng, quyết toán và thuế

HANDS chỉ thu thập dữ liệu cần thiết cho từng mục đích. Vị trí chính xác và thông tin thanh toán hoặc tài chính được áp dụng biện pháp bảo vệ tăng cường.`,
      ],
      [
        'Mục đích xử lý',
        `HANDS xử lý dữ liệu trong phạm vi cần thiết để:

• Tạo tài khoản, xác minh danh tính, đăng nhập và bảo mật
• Tìm đối tác gần nhất, đặt lịch, ghép nối, trò chuyện và theo dõi dịch vụ
• Xử lý thanh toán, hoàn tiền, coupon, ví, quyết toán và hồ sơ thuế
• Kiểm tra việc hủy, vắng mặt, báo cáo và tranh chấp dựa trên vị trí, trò chuyện và đặt lịch
• Gửi thông báo, hỗ trợ khách hàng, cải thiện chất lượng và an toàn
• Ngăn ngừa, điều tra gian lận, chiếm đoạt tài khoản, lỗi thanh toán và vi phạm pháp luật
• Thực hiện nghĩa vụ pháp lý và lưu giữ hồ sơ có thể kiểm toán

Nếu sử dụng dữ liệu cho mục đích mới không tương thích với mục đích đã thông báo, HANDS sẽ xin sự đồng ý riêng trừ trường hợp pháp luật cho phép.`,
      ],
      [
        'Căn cứ xử lý và sự đồng ý',
        `HANDS xử lý dữ liệu trên cơ sở sự đồng ý rõ ràng của chủ thể dữ liệu, việc giao kết hoặc thực hiện hợp đồng dịch vụ, tuân thủ nghĩa vụ pháp lý, bảo vệ tính mạng hoặc sức khỏe trong tình huống khẩn cấp, hoặc căn cứ khác được pháp luật cho phép.

Khi cần sự đồng ý, HANDS sẽ thông báo trước loại dữ liệu, mục đích, bên xử lý và quyền của chủ thể dữ liệu, đồng thời cung cấp lựa chọn chấp thuận rõ ràng. Im lặng hoặc không phản hồi không được xem là đồng ý. Việc rút lại sự đồng ý không ảnh hưởng đến tính hợp pháp của hoạt động xử lý đã thực hiện trước đó.`,
      ],
      [
        'Thời hạn lưu giữ và xóa dữ liệu',
        `Dữ liệu được lưu giữ đến khi hoàn thành mục đích xử lý và sau đó được xóa hoặc tiêu hủy bằng phương thức khó khôi phục. Hồ sơ thanh toán, hoàn tiền, thuế, kế toán, tranh chấp, phòng chống gian lận và nghĩa vụ pháp lý có thể được lưu riêng trong thời hạn luật định hoặc đến khi tranh chấp kết thúc.

Khi người dùng yêu cầu xóa tài khoản, HANDS vẫn có thể lưu giữ có giới hạn các hồ sơ liên quan đến đặt lịch chưa hoàn tất, hoàn tiền, quyết toán, báo cáo hoặc nghĩa vụ lưu trữ và không sử dụng chúng cho mục đích khác.`,
      ],
      [
        'Chia sẻ và thuê bên xử lý',
        `HANDS có thể xử lý hoặc chia sẻ dữ liệu trong phạm vi cần thiết với:

• Khách hàng và đối tác massage thực hiện đặt lịch: tên, hồ sơ, địa chỉ dịch vụ, thông tin đặt lịch và trò chuyện
• Đơn vị thanh toán và hoàn tiền: mã giao dịch, phương thức, số tiền và trạng thái
• Nhà cung cấp xác thực điện thoại, thông báo đẩy, bản đồ, địa chỉ, hạ tầng đám mây, lưu trữ, bảo mật và hỗ trợ khách hàng
• Cơ quan nhà nước, điều tra hoặc tư pháp khi có nghĩa vụ pháp lý hoặc yêu cầu hợp lệ

Khi nhà cung cấp chính thức được xác định, HANDS sẽ công bố tên, mục đích, loại dữ liệu và thời hạn lưu giữ trong chính sách này hoặc danh sách xử lý riêng. HANDS không bán dữ liệu cá nhân.`,
      ],
      [
        'Chuyển dữ liệu ra nước ngoài',
        `Nếu máy chủ của dịch vụ đám mây, thông báo đẩy, bản đồ hoặc thanh toán đặt ngoài Việt Nam, dữ liệu có thể được xử lý ở nước ngoài. HANDS sẽ xác định quốc gia, bên nhận, mục đích, loại dữ liệu, thời hạn lưu giữ và biện pháp bảo vệ, đồng thời thực hiện yêu cầu về đồng ý, đánh giá tác động và lưu hồ sơ theo pháp luật Việt Nam.`,
      ],
      [
        'Quyền của chủ thể dữ liệu',
        `Trong phạm vi pháp luật quy định, người dùng có quyền:

• Được thông báo, truy cập và yêu cầu cung cấp dữ liệu cá nhân
• Đồng ý, rút lại sự đồng ý và phản đối xử lý
• Yêu cầu chỉnh sửa thông tin không chính xác
• Yêu cầu xóa, hạn chế xử lý và gửi khiếu nại
• Yêu cầu bồi thường và tố cáo hành vi vi phạm

Yêu cầu được gửi qua hỗ trợ trong ứng dụng hoặc đầu mối bảo vệ dữ liệu sẽ được công bố trước khi ra mắt. HANDS sẽ xác minh danh tính và xử lý trong thời hạn luật định; nếu yêu cầu bị hạn chế do quyền của người khác hoặc nghĩa vụ pháp lý, HANDS sẽ thông báo lý do.`,
      ],
      [
        'Biện pháp bảo mật và ứng phó sự cố',
        `HANDS áp dụng các biện pháp kỹ thuật và quản trị hợp lý như kiểm soát truy cập theo vai trò, bảo vệ thông tin xác thực, mã hóa đường truyền, nhật ký kiểm toán cho thao tác quan trọng, ngăn xử lý trùng trạng thái thanh toán, sao lưu và kiểm tra lỗ hổng.

Khi xác nhận có sự cố dữ liệu cá nhân, HANDS sẽ kiểm soát ảnh hưởng, điều tra nguyên nhân và thông báo cho cơ quan có thẩm quyền cùng người dùng khi pháp luật yêu cầu.`,
      ],
      [
        'Thay đổi, liên hệ và ngôn ngữ',
        `Thay đổi quan trọng sẽ được thông báo trên website hoặc ứng dụng trước ngày có hiệu lực. Nếu mục đích thu thập, phạm vi dữ liệu nhạy cảm hoặc chia sẻ với bên thứ ba thay đổi đáng kể, HANDS sẽ xin lại sự đồng ý khi cần.

Chính sách này được xây dựng trên cơ sở Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân, Luật Bảo vệ quyền lợi người tiêu dùng 19/2023/QH15 và pháp luật liên quan của Việt Nam. Bản tiếng Việt là bản tham chiếu chính; các bản dịch được cung cấp để thuận tiện và bản tiếng Việt được ưu tiên trong phạm vi pháp luật cho phép.`,
      ],
    ];
  }
  if (path === '/legal/terms') {
    return [
      [
        'Mục đích và hiệu lực',
        `Điều khoản này quy định điều kiện sử dụng website công khai, ứng dụng khách hàng, dịch vụ đặt lịch, ghép nối, trò chuyện, thanh toán, ví và hỗ trợ khách hàng của HANDS.

Cập nhật lần cuối: 31/07/2026
Ngày có hiệu lực: ngày HANDS chính thức cung cấp dịch vụ

Tên pháp lý, mã số doanh nghiệp, địa chỉ và thông tin liên hệ của đơn vị vận hành HANDS sẽ được công bố tại chân trang website trước khi dịch vụ chính thức ra mắt.`,
      ],
      [
        'Bản chất của dịch vụ',
        `HANDS là nền tảng giúp khách hàng xem hồ sơ công khai, dịch vụ, giá và đánh giá của đối tác massage, sau đó đặt lịch trong ứng dụng. Website chỉ cung cấp thông tin; việc đặt lịch được thực hiện trong ứng dụng khách hàng.

Đối tác massage chịu trách nhiệm về điều kiện cung cấp dịch vụ và tính chính xác của hồ sơ. HANDS hỗ trợ xác minh, lưu hồ sơ đặt lịch, thanh toán và giải quyết tranh chấp nhưng không bảo đảm kết quả điều trị hoặc hiệu quả y tế cụ thể.`,
      ],
      [
        'Điều kiện sử dụng và tài khoản',
        `Người dùng phải có năng lực giao kết hợp đồng theo pháp luật và cung cấp số điện thoại cùng thông tin tài khoản chính xác. Không được chuyển nhượng hoặc chia sẻ tài khoản hay phương thức xác thực.

HANDS có thể xác minh, hạn chế hoặc tạm khóa tài khoản khi phát hiện đăng ký gian dối, mạo danh, truy cập tự động, lạm dụng thanh toán hoặc hành vi đe dọa an toàn.`,
      ],
      [
        'Đặt lịch và ghép nối',
        `Khách hàng kiểm tra địa chỉ dịch vụ, thời gian, đối tác massage, dịch vụ và phương thức thanh toán trước khi gửi yêu cầu. Thứ tự gần nhất và trạng thái sẵn sàng dựa trên vị trí đã lưu, giờ hoạt động và trạng thái hệ thống, không phải cam kết thời gian đến chính xác.

Khi đối tác chấp nhận và ghép nối thành công, giai đoạn di chuyển bắt đầu và phòng trò chuyện được mở. Hai bên phải dùng trò chuyện để xác nhận việc đến nơi, vị trí và yêu cầu cần thiết.`,
      ],
      [
        'Giá, thanh toán và ví',
        `Số tiền cuối cùng căn cứ vào giá dịch vụ, coupon, thuế và phí áp dụng hiển thị trên màn hình xác nhận. Phương thức thanh toán có thể gồm tiền mặt, ví khách hàng hoặc thẻ và thanh toán điện tử được hỗ trợ.

Với tiền mặt, khách hàng trả trực tiếp cho đối tác massage. Thanh toán ví hoặc thẻ được phê duyệt, hủy và hoàn tiền theo quy trình hiển thị trong ứng dụng. Ví khách hàng là số dư điện tử dùng cho dịch vụ HANDS và khoản hoàn hoặc bồi hoàn được phê duyệt; ví không phải tiền gửi ngân hàng hay tài khoản tiền mặt có thể chuyển nhượng.`,
      ],
      [
        'Hủy, vắng mặt và hoàn tiền',
        `Khách hàng có thể hủy trong ứng dụng trước khi đối tác chấp nhận. Sau khi ghép nối, khách hàng không thể tự hủy; đối tác phải ghi nhận trong trò chuyện rằng việc hủy là theo yêu cầu của khách hàng hoặc vì lý do chính đáng.

Nếu hủy sau ghép nối, thanh toán tiền mặt không phát sinh dòng tiền dịch vụ; khoản đã trả bằng ví được hoàn về ví; khoản thanh toán thẻ được xử lý theo quy trình hủy hoặc hoàn của đơn vị thanh toán. Vì dịch vụ chưa hoàn thành, khoản trả cho đối tác, phí nền tảng và thuế liên quan không được xác lập.

Nếu đối tác không gặp được khách hàng, HANDS sẽ xem xét trò chuyện, địa chỉ đặt lịch, vị trí được phép và lịch sử liên lạc để quyết định tình trạng vắng mặt cùng kết quả thanh toán hoặc hoàn tiền. Thời điểm ghi nhận hoàn tiền có thể khác nhau theo phương thức và tổ chức tài chính.`,
      ],
      [
        'Hoàn thành dịch vụ và tranh chấp',
        `Đối tác phải đánh dấu hoàn thành sau khi kết thúc dịch vụ; sau đó hồ sơ thanh toán, phí và quyết toán được xác lập. Tranh chấp về chất lượng, an toàn hoặc thanh toán sau khi hai bên gặp nhau phải được gửi đến hỗ trợ khách hàng.

HANDS có thể xem xét trạng thái đặt lịch, trò chuyện, thanh toán, địa chỉ dịch vụ và dữ liệu vị trí được phép để đưa ra quyết định vận hành. Người dùng phải cung cấp thông tin chính xác và không được cản trở việc lưu giữ chứng cứ.`,
      ],
      [
        'Nghĩa vụ và hành vi bị cấm',
        `Khách hàng và đối tác phải tôn trọng nhau và duy trì môi trường dịch vụ an toàn. Các hành vi sau bị cấm:

• Cung cấp thông tin giả, mạo danh, đánh giá hoặc chứng từ thanh toán bị thao túng
• Bạo lực, đe dọa, phân biệt đối xử, quấy rối tình dục, yêu cầu bất hợp pháp hoặc ngoài phạm vi dịch vụ
• Lôi kéo liên hệ hoặc thanh toán ngoài nền tảng để né phí
• Công khai trái phép dữ liệu cá nhân, trò chuyện, hình ảnh hoặc vị trí của người khác
• Truy cập trái phép, tự động hóa, dịch ngược, mã độc hoặc cản trở ứng dụng và API

Tùy mức độ vi phạm, HANDS có thể hạn chế đặt lịch, xóa nội dung, tạm khóa tài khoản, yêu cầu bồi thường hoặc báo cơ quan có thẩm quyền.`,
      ],
      [
        'Đánh giá, trò chuyện và nội dung',
        `Đánh giá, tin nhắn và hình ảnh do người dùng đăng phải đúng sự thật và không xâm phạm pháp luật hoặc quyền của người khác. HANDS có thể lưu và xem xét nội dung trong phạm vi cần thiết để vận hành dịch vụ, bảo đảm an toàn, xử lý báo cáo và lưu chứng cứ tranh chấp.

Nội dung bất hợp pháp, giả mạo, xúc phạm, quảng cáo, xâm phạm quyền riêng tư hoặc không liên quan đến đặt lịch có thể bị ẩn hoặc xóa. Quyền tác giả về nguyên tắc thuộc người tạo, nhưng HANDS được sử dụng nội dung trong phạm vi cần thiết để cung cấp dịch vụ và giải quyết tranh chấp.`,
      ],
      [
        'Thay đổi và gián đoạn dịch vụ',
        `Một phần dịch vụ có thể tạm ngừng do bảo trì, sự cố bảo mật, lỗi viễn thông, bản đồ, thanh toán, thiên tai hoặc yêu cầu pháp lý. HANDS sẽ thông báo trước khi hợp lý và có thể thông báo sau đối với biện pháp bảo mật hoặc an toàn khẩn cấp.

Thay đổi quan trọng về tính năng hoặc điều kiện sử dụng sẽ được công bố cùng ngày áp dụng và ảnh hưởng. Thay đổi bất lợi đáng kể cho người dùng tuân theo thủ tục và thời hạn mà pháp luật yêu cầu.`,
      ],
      [
        'Trách nhiệm và bồi thường',
        `HANDS chịu trách nhiệm theo pháp luật đối với thiệt hại trực tiếp do lỗi cố ý hoặc lỗi của HANDS. Trách nhiệm có thể được loại trừ hoặc giới hạn đối với thiệt hại phát sinh từ thông tin sai, vi phạm điều khoản, thiết bị hoặc kết nối của người dùng, lỗi dịch vụ bên thứ ba hoặc sự kiện ngoài khả năng kiểm soát hợp lý.

Điều khoản này không loại trừ quyền bắt buộc của người tiêu dùng và không miễn trách nhiệm của HANDS đối với hành vi cố ý hoặc lỗi nghiêm trọng.`,
      ],
      [
        'Luật áp dụng, giải quyết tranh chấp và ngôn ngữ',
        `Điều khoản này được điều chỉnh bởi pháp luật Việt Nam. Tranh chấp trước hết được trao đổi qua hỗ trợ trong ứng dụng; nếu không giải quyết được, người dùng có thể yêu cầu cơ quan bảo vệ người tiêu dùng, hòa giải, trọng tài hoặc tòa án có thẩm quyền tại Việt Nam xử lý.

Điều khoản được xây dựng trên cơ sở Luật Bảo vệ quyền lợi người tiêu dùng 19/2023/QH15, Luật Giao dịch điện tử 20/2023/QH15, Nghị định 52/2013/NĐ-CP về thương mại điện tử và pháp luật liên quan. Bản tiếng Việt là bản tham chiếu chính và được ưu tiên khi có khác biệt với bản dịch trong phạm vi pháp luật cho phép.`,
      ],
    ];
  }
  if (path === '/legal/cookies') {
    return [
      [
        'Phạm vi và trạng thái hiện tại',
        `Chính sách này giải thích cookie và công nghệ lưu trữ tương tự trên hands.vn và các website công khai do HANDS vận hành.

Cập nhật lần cuối: 31/07/2026
Ngày có hiệu lực: ngày HANDS chính thức cung cấp dịch vụ

Hiện tại website công khai không sử dụng cookie quảng cáo, theo dõi người dùng hoặc phân tích truy cập tùy chọn. Trước khi bổ sung công nghệ tùy chọn, HANDS sẽ cập nhật chính sách và giao diện xin đồng ý.`,
      ],
      [
        'Cookie là gì?',
        `Cookie là dữ liệu nhỏ được website lưu trong trình duyệt để ghi nhớ trạng thái đăng nhập, cài đặt bảo mật hoặc ngôn ngữ. Chính sách này cũng bao gồm công nghệ có chức năng tương tự như local storage, session storage và mã nhận dạng thiết bị.`,
      ],
      [
        'Công nghệ thiết yếu',
        `Cookie thiết yếu hoặc nhật ký yêu cầu có thể được dùng cho lưu trữ website, bảo mật, cân bằng tải, duy trì đường dẫn ngôn ngữ và cung cấp trang được yêu cầu. Các công nghệ này chỉ phục vụ chức năng và bảo mật, không dùng cho quảng cáo tùy chọn.

Nếu HANDS trực tiếp thiết lập cookie thiết yếu, tên, mục đích và thời hạn sẽ được bổ sung vào danh sách này. Hiện mã nguồn website công khai không thiết lập cookie riêng của HANDS.`,
      ],
      [
        'Cookie phân tích và quảng cáo',
        `Website công khai hiện không cài đặt cookie phân tích hành vi, pixel quảng cáo, công cụ theo dõi chéo website hoặc cookie quảng cáo cá nhân hóa.

Nếu bổ sung công nghệ phân tích hoặc tiếp thị tùy chọn, mặc định chúng sẽ bị tắt. HANDS sẽ thông báo nhà cung cấp, mục đích và thời hạn lưu giữ, đồng thời xin sự đồng ý rõ ràng. Việc từ chối không ảnh hưởng đến chức năng thiết yếu của website.`,
      ],
      [
        'Liên kết ngoài và dịch vụ bên thứ ba',
        `Khi chuyển đến cửa hàng ứng dụng, đơn vị thanh toán, bản đồ hoặc website ngoài, bên thứ ba có thể áp dụng cookie và chính sách riêng. HANDS không kiểm soát cookie do website bên ngoài thiết lập; vui lòng kiểm tra chính sách của họ trước khi tiếp tục.`,
      ],
      [
        'Quản lý trong trình duyệt',
        `Người dùng có thể xem, xóa hoặc chặn cookie trong cài đặt trình duyệt. Chặn toàn bộ cookie có thể làm ảnh hưởng đến lựa chọn ngôn ngữ, bảo mật hoặc chức năng đăng nhập trong tương lai.

Nếu cookie tùy chọn được bổ sung, website sẽ cung cấp phần cài đặt để thay đổi hoặc rút lại sự đồng ý. Việc rút lại không ảnh hưởng đến hoạt động xử lý hợp pháp trước đó.`,
      ],
      [
        'Thay đổi, liên hệ và ngôn ngữ',
        `Khi công nghệ hoặc nhà cung cấp thay đổi, HANDS sẽ cập nhật danh sách, mục đích và thời hạn lưu giữ. Nếu phạm vi theo dõi tùy chọn thay đổi đáng kể, HANDS sẽ xin lại sự đồng ý.

Yêu cầu về cookie và dữ liệu cá nhân có thể gửi qua hỗ trợ trong ứng dụng hoặc đầu mối bảo vệ dữ liệu được công bố trước khi ra mắt. Bản tiếng Việt là bản tham chiếu chính và được ưu tiên khi có khác biệt với bản dịch trong phạm vi pháp luật cho phép.`,
      ],
    ];
  }
  if (path === '/service-areas') {
    return [
      ['Khu vực hiện tại', 'HANDS giới thiệu đối tác tại TP. Hồ Chí Minh, Hà Nội, Đà Nẵng và Nha Trang. Khả năng đặt lịch thực tế được hiển thị trong ứng dụng.'],
      ['Mở rộng khu vực', 'Khu vực mới được mở sau khi hoàn tất kiểm tra đối tác và chuẩn bị vận hành.'],
      ['Tìm theo địa phương', 'Danh sách đối tác cho phép xem hồ sơ theo thành phố và quận.'],
    ];
  }
  return [
    ['Nguyên tắc vận hành', 'HANDS ưu tiên thông tin minh bạch, vận hành có trách nhiệm và an toàn cho cả khách hàng lẫn đối tác.'],
    ['Thông tin cần kiểm tra', 'Vui lòng xem hồ sơ, giá và nội dung dịch vụ trước khi đặt lịch. Thay đổi quan trọng sẽ được công bố tại đây.'],
    ['Liên hệ và cập nhật', 'Sử dụng hỗ trợ trong ứng dụng hoặc kênh liên hệ chính thức. Chính sách được cập nhật kèm ngày hiệu lực.'],
  ];
}

function englishSections(path: string): Array<[string, string]> {
  if (path === '/legal/privacy') {
    return [
      [
        'Scope and effective date',
        `This policy applies to personal data processed through the HANDS public website, customer app, massage therapist app and customer support.

Last updated: 31 July 2026
Effective date: the official launch date of the HANDS service

The legal name, business registration number, address and data protection contact of the HANDS operating entity will be published in the website footer and this policy before the official launch.`,
      ],
      [
        'Personal data we collect',
        `• Account data: name, phone number, authentication data, profile and language settings
• Booking data: selected service, date and time, service address, requests, status and cancellation reason
• Location data: current and booking locations needed for nearby discovery, matching, service operations and dispute review
• Transaction data: payment method, payment and refund amounts, transaction identifiers, coupons and customer wallet ledger
• Support and safety data: chats, attached images, reviews, reports, support records and operational decisions
• Device and usage data: IP address, device, operating system, app version, session, push token, access, error and security logs
• Massage therapist data: identity and KYC documents, profile media, services, prices, operating area, settlement, tax and bank details

HANDS collects only what is necessary for each purpose. Precise location and payment or financial data receive enhanced safeguards.`,
      ],
      [
        'How we use personal data',
        `We process personal data as needed to:

• Create accounts, verify identity, sign users in and protect security
• Find nearby massage therapists, book, match, chat and manage service progress
• Process payments, refunds, coupons, wallets, settlements and tax records
• Review cancellations, no-shows, reports and disputes using booking, chat and location evidence
• Send notifications, provide support and improve quality and safety
• Prevent and investigate fraud, account takeover, payment errors and unlawful activity
• Meet legal duties and retain auditable operating records

If a new purpose is not compatible with the purpose originally disclosed, we will obtain separate consent unless the law permits the processing.`,
      ],
      [
        'Legal basis and consent',
        `HANDS processes personal data based on clear consent, the formation or performance of a service contract, compliance with legal obligations, protection of life or health in an emergency, or another basis permitted by law.

Where consent is required, we explain the data, purpose, processor and user rights in advance and provide a clear choice. Silence or inaction is not consent. Withdrawal does not affect processing that was lawful before the withdrawal.`,
      ],
      [
        'Retention and deletion',
        `We retain personal data until its purpose is fulfilled and then delete or destroy it using methods designed to prevent recovery. Payment, refund, tax, accounting, dispute, fraud prevention and legal records may be segregated and retained for the statutory period or until an active dispute is resolved.

After an account deletion request, we may keep only records required for unfinished bookings, refunds, settlements, reports or legal retention and will not use them for unrelated purposes.`,
      ],
      [
        'Sharing and processors',
        `HANDS may process or share data as needed with:

• The customer and massage therapist fulfilling a booking: name, profile, service address, booking and chat data
• Payment and refund providers: transaction identifier, method, amount and status
• Phone authentication, push notification, maps, address, cloud, storage, security and customer support providers
• Government, investigative or judicial authorities where required by law or a valid request

Once production suppliers are confirmed, we will publish their names, purposes, data categories and retention periods here or in a separate processor list. HANDS does not sell personal data.`,
      ],
      [
        'International transfers',
        `Where cloud, push, mapping or payment servers are located outside Vietnam, data may be processed abroad. HANDS will identify the destination, recipient, purpose, data, retention period and safeguards and complete any consent, impact assessment and recordkeeping required under Vietnamese law.`,
      ],
      [
        'Your rights',
        `Subject to applicable law, users may:

• Be informed and request access to or a copy of personal data
• Consent, withdraw consent and object to processing
• Correct inaccurate information
• Request deletion or restriction and submit a complaint
• Seek compensation and report a violation

Requests may be submitted through in-app support or the data protection contact published before launch. HANDS verifies identity and responds within the legal period. If another person's rights or a legal duty limits a request, we will explain the reason.`,
      ],
      [
        'Security and incident response',
        `HANDS uses reasonable technical and organisational safeguards, including role-based access, credential protection, encryption in transit, audit logs for sensitive operations, duplicate payment-state prevention, backups and vulnerability checks.

If a personal data incident is confirmed, HANDS will contain the impact, investigate the cause and notify competent authorities and affected users where required by law.`,
      ],
      [
        'Changes, contact and language',
        `Material changes will be announced on the website or in the app before they take effect. If collection purposes, sensitive-data processing or third-party sharing changes materially, we will obtain renewed consent where required.

This policy reflects Vietnam's Decree 13/2023/ND-CP on personal data protection, Consumer Rights Protection Law 19/2023/QH15 and other applicable law. The Vietnamese version is the primary reference. Translations are provided for convenience and the Vietnamese version prevails to the extent permitted by law.`,
      ],
    ];
  }
  if (path === '/legal/terms') {
    return [
      [
        'Purpose and effective date',
        `These terms govern the HANDS public website, customer app, booking, matching, chat, payment, wallet and customer support services.

Last updated: 31 July 2026
Effective date: the official launch date of the HANDS service

The legal name, business registration number, address and contact details of the HANDS operating entity will be published in the website footer before the official launch.`,
      ],
      [
        'Nature of the service',
        `HANDS is a platform where customers can view public massage therapist profiles, services, prices and reviews and then book in the app. The website is informational and does not accept bookings.

Massage therapists are responsible for their eligibility to provide services and for the accuracy of their profiles. HANDS supports verification, booking records, payment and dispute handling but does not guarantee a particular therapeutic or medical outcome.`,
      ],
      [
        'Eligibility and accounts',
        `Users must have legal capacity to contract and provide an accurate phone number and account information. Accounts and authentication methods may not be transferred or shared.

HANDS may verify, limit or suspend access after detecting fraudulent registration, impersonation, automated access, payment abuse or conduct that threatens safety.`,
      ],
      [
        'Booking and matching',
        `Before requesting a booking, the customer reviews the service address, time, massage therapist, service and payment method. Nearby order and availability rely on stored location, working hours and system status and do not guarantee an exact arrival time.

When a massage therapist accepts and matching is complete, the travel stage starts and chat opens. Both parties should use chat to confirm arrival, location and necessary requests.`,
      ],
      [
        'Prices, payments and wallet',
        `The final amount is based on the service price, coupons, taxes and applicable fees shown on the confirmation screen. Payment methods may include cash, customer wallet or supported card and electronic payments.

For cash bookings, the customer pays the massage therapist directly. Wallet and card payments are authorised, cancelled and refunded through the flow shown in the app. The customer wallet is an electronic balance for HANDS services and approved refunds or rewards; it is not a bank deposit or transferable cash account.`,
      ],
      [
        'Cancellation, no-show and refunds',
        `A customer may cancel in the app before a massage therapist accepts. After matching, the customer cannot cancel directly; the massage therapist must record in chat that cancellation is requested by the customer or supported by a valid reason.

For post-match cancellation, no service funds move for cash; wallet payments are restored to the customer wallet; and card payments follow the payment provider's cancellation or refund process. Because service was not completed, therapist earnings, platform fees and related taxes do not become final.

If the massage therapist cannot meet the customer, HANDS reviews chat, booking address, permitted location and contact records to decide the no-show and payment or refund result. Posting time may vary by payment method and financial institution.`,
      ],
      [
        'Completion and disputes',
        `The massage therapist must mark the service complete after finishing it. Payment, fee and settlement records become final after completion. Any dispute concerning quality, safety or payment after the parties meet must be submitted to customer support.

HANDS may review booking status, chat, payment, service address and permitted location records to make an operational decision. Users must provide accurate information and must not obstruct evidence retention.`,
      ],
      [
        'Duties and prohibited conduct',
        `Customers and massage therapists must treat each other respectfully and maintain a safe service environment. Prohibited conduct includes:

• False information, impersonation, manipulated reviews or payment evidence
• Violence, threats, discrimination, sexual harassment, unlawful or out-of-scope requests
• Moving contact or payment off-platform to avoid fees
• Unauthorised disclosure of another person's data, chat, images or location
• Unauthorised access, automation, reverse engineering, malware or interference with the app or API

Depending on severity, HANDS may restrict bookings, remove content, suspend accounts, seek damages or report conduct to the authorities.`,
      ],
      [
        'Reviews, chats and content',
        `Reviews, messages and images must be truthful and must not violate law or another person's rights. HANDS may retain and review content as needed to operate the service, protect safety, handle reports and preserve dispute evidence.

Illegal, false, abusive, promotional, privacy-infringing or booking-irrelevant content may be hidden or removed. Copyright generally remains with the creator, while HANDS may use the content as needed to provide the service and resolve disputes.`,
      ],
      [
        'Changes and interruptions',
        `Part of the service may be interrupted by maintenance, a security incident, telecommunications, maps or payment-provider failure, force majeure or legal requirements. HANDS will give advance notice where reasonably possible and may give notice afterward for urgent security or safety action.

Material changes to features or terms will be published with their effective date and impact. Changes materially adverse to users follow the procedures and notice periods required by law.`,
      ],
      [
        'Liability',
        `HANDS is responsible under applicable law for direct loss caused by its intent or fault. Liability may be excluded or limited for loss caused by a user's false information, breach of these terms, device or connectivity problem, third-party service failure or an event beyond reasonable control.

Nothing in these terms removes mandatory consumer rights or excludes HANDS liability for intentional misconduct or gross fault.`,
      ],
      [
        'Governing law, disputes and language',
        `These terms are governed by Vietnamese law. The parties should first seek resolution through in-app support. If unresolved, a user may apply to a competent Vietnamese consumer authority, mediator, arbitrator or court.

These terms reflect Consumer Rights Protection Law 19/2023/QH15, Electronic Transactions Law 20/2023/QH15, E-commerce Decree 52/2013/ND-CP and other applicable law. The Vietnamese version is the primary reference and prevails over a translation to the extent permitted by law.`,
      ],
    ];
  }
  if (path === '/legal/cookies') {
    return [
      [
        'Scope and current status',
        `This policy explains cookies and similar storage technologies on hands.vn and other HANDS public websites.

Last updated: 31 July 2026
Effective date: the official launch date of the HANDS service

The public website currently does not use advertising, user-tracking or optional analytics cookies. We will update this policy and the consent interface before introducing optional technology.`,
      ],
      [
        'What is a cookie?',
        `A cookie is a small piece of data a website stores in a browser to remember items such as login state, security settings or language. This policy also covers technologies with similar functions, including local storage, session storage and device identifiers.`,
      ],
      [
        'Strictly necessary technology',
        `Necessary cookies or request logs may be used for hosting, security, load balancing, maintaining language paths or delivering requested pages. They support functionality and security and are not used for optional advertising.

If HANDS directly sets a necessary cookie, its name, purpose and retention period will be added to this list. The current public website code does not set a separate HANDS cookie.`,
      ],
      [
        'Analytics and advertising cookies',
        `The public website currently has no behavioural analytics cookie, advertising pixel, cross-site tracker or personalised advertising cookie.

If optional analytics or marketing technology is added, it will be off by default. We will identify the provider, purpose and retention period and obtain clear consent. Refusal will not prevent use of essential website functions.`,
      ],
      [
        'External links and third parties',
        `When users navigate to an app store, payment provider, map or another external site, that provider may apply its own cookies and privacy policy. HANDS does not control cookies set by external sites, so users should review their policies before continuing.`,
      ],
      [
        'Browser controls',
        `Users may view, delete or block cookies through browser settings. Blocking all cookies may affect language selection, security or future login features.

If optional cookies are introduced, the website will provide settings to change or withdraw consent. Withdrawal does not affect processing that was lawful before withdrawal.`,
      ],
      [
        'Changes, contact and language',
        `If technologies or providers change, HANDS will update the list, purposes and retention periods. We will seek renewed consent if optional tracking changes materially.

Cookie and personal-data questions may be submitted through in-app support or the data protection contact published before launch. The Vietnamese version is the primary reference and prevails over a translation to the extent permitted by law.`,
      ],
    ];
  }
  return [
    ['Our approach', 'HANDS prioritises clear information, responsible operations and the safety of customers and massage therapists.'],
    ['What to check', 'Review massage therapist profiles, pricing and service details before booking. Material updates are published on this page.'],
    ['Contact', 'Use in-app support or the official contact channel and include the relevant booking information for review.'],
  ];
}

function japaneseSections(path: string): Array<[string, string]> {
  if (path === '/legal/privacy') {
    return [
      [
        '適用範囲と施行日',
        `本方針は、HANDSの公開ウェブサイト、顧客アプリ、マッサージセラピストアプリおよびカスタマーサポートで処理される個人データに適用されます。

最終更新日：2026年7月31日
施行日：HANDS正式サービス開始日

HANDS運営法人の正式名称、事業者登録番号、住所および個人データ保護窓口は、正式リリース前にウェブサイトのフッターと本方針に掲載します。`,
      ],
      [
        '取得する個人データ',
        `• アカウント情報：氏名、電話番号、認証情報、プロフィール、言語設定
• 予約情報：サービス、日時、提供先住所、要望、予約状態、キャンセル理由
• 位置情報：近隣検索、マッチング、サービス運営、紛争確認に必要な現在地と予約地
• 取引情報：支払方法、支払・返金額、取引識別子、クーポン、顧客ウォレット台帳
• サポート・安全情報：チャット、添付画像、レビュー、通報、サポート記録、運営判断
• 端末・利用情報：IPアドレス、端末、OS、アプリ版、セッション、プッシュトークン、アクセス・エラー・セキュリティログ
• マッサージセラピスト情報：本人確認・KYC資料、プロフィール画像、サービス、料金、活動地域、精算、税務、銀行情報

HANDSは各目的に必要な範囲のみ取得し、正確な位置情報および支払・金融情報には強化した保護措置を適用します。`,
      ],
      [
        '利用目的',
        `個人データは次の目的に必要な範囲で処理します。

• アカウント作成、本人確認、ログイン、セキュリティ
• 近隣セラピスト検索、予約、マッチング、チャット、サービス進行
• 支払、返金、クーポン、ウォレット、精算、税務記録
• 予約・チャット・位置記録に基づくキャンセル、ノーショー、通報、紛争確認
• 通知、カスタマーサポート、品質・安全性の改善
• 不正利用、アカウント乗っ取り、支払障害、法令違反の防止・調査
• 法的義務の履行および監査可能な運営記録の保存

当初通知した目的と両立しない新たな目的に利用する場合、法令で認められる場合を除き、別途同意を取得します。`,
      ],
      [
        '処理根拠と同意',
        `HANDSは、明確な同意、サービス契約の締結・履行、法的義務の遵守、緊急時の生命・健康の保護、または法令で認められるその他の根拠に基づいて個人データを処理します。

同意が必要な場合は、データの種類、目的、処理主体および利用者の権利を事前に説明し、明確な選択手段を提供します。沈黙や不作為を同意とはみなしません。同意の撤回は、撤回前に適法に行われた処理には影響しません。`,
      ],
      [
        '保存期間と削除',
        `個人データは利用目的が達成されるまで保存し、その後、復元が困難な方法で削除または廃棄します。ただし、支払、返金、税務、会計、紛争、不正防止および法的義務に関する記録は、法定期間または紛争終了まで分離保存することがあります。

アカウント削除後も、未完了予約、返金、精算、通報または法的保存義務に必要な記録のみ限定的に保持し、別目的には使用しません。`,
      ],
      [
        '提供先と処理委託',
        `HANDSはサービス提供に必要な範囲で次の相手とデータを処理または共有することがあります。

• 予約を履行する顧客とマッサージセラピスト：氏名、プロフィール、提供先住所、予約・チャット情報
• 支払・返金事業者：取引識別子、支払方法、金額、状態
• 電話認証、プッシュ通知、地図・住所、クラウド、ストレージ、セキュリティ、サポート事業者
• 法的義務または適法な要請に基づく行政・捜査・司法機関

本番事業者が確定した後、事業者名、目的、データ項目、保存期間を本方針または別の委託先一覧で公開します。HANDSは個人データを販売しません。`,
      ],
      [
        '国外移転',
        `クラウド、プッシュ通知、地図または決済サーバーがベトナム国外にある場合、データが国外で処理されることがあります。HANDSは移転先、受領者、目的、データ項目、保存期間、保護措置を確認し、ベトナム法が求める同意、影響評価および記録を実施します。`,
      ],
      [
        '利用者の権利',
        `適用法令の範囲で、利用者は次の権利を有します。

• 処理に関する通知、アクセス、データ提供の請求
• 同意、同意撤回、処理への異議
• 不正確な情報の訂正
• 削除、処理制限、苦情申立て
• 損害賠償請求および違反の通報

請求はアプリ内サポートまたは正式リリース前に公表するデータ保護窓口で受け付けます。本人確認後、法定期間内に対応し、他者の権利または法的義務により制限される場合は理由を説明します。`,
      ],
      [
        '安全管理と事故対応',
        `HANDSは、役割に基づくアクセス制御、認証情報保護、通信の暗号化、重要操作の監査ログ、決済状態の重複処理防止、バックアップ、脆弱性確認など合理的な技術的・組織的措置を講じます。

個人データ事故を確認した場合、影響を封じ込め、原因を調査し、法令に従って関係当局および影響を受ける利用者へ通知します。`,
      ],
      [
        '変更・連絡先・言語',
        `重要な変更は施行前にウェブサイトまたはアプリで通知します。収集目的、センシティブデータの処理、第三者提供が実質的に変わる場合は、必要に応じて再同意を取得します。

本方針は、ベトナムの個人データ保護政令13/2023/ND-CP、消費者権利保護法19/2023/QH15および関連法令に基づきます。ベトナム語版を正本とし、翻訳との相違がある場合は、法令で認められる範囲でベトナム語版を優先します。`,
      ],
    ];
  }
  if (path === '/legal/terms') {
    return [
      [
        '目的と施行日',
        `本規約は、HANDSの公開ウェブサイト、顧客アプリ、予約、マッチング、チャット、支払、ウォレットおよびカスタマーサポートの利用条件を定めます。

最終更新日：2026年7月31日
施行日：HANDS正式サービス開始日

HANDS運営法人の正式名称、事業者登録番号、住所および連絡先は、正式リリース前にウェブサイトのフッターに掲載します。`,
      ],
      [
        'サービスの性質',
        `HANDSは、顧客がマッサージセラピストの公開プロフィール、サービス、料金、レビューを確認し、アプリで予約できるプラットフォームです。ウェブサイトは情報提供用で、予約は顧客アプリで行います。

マッサージセラピストはサービス提供資格とプロフィールの正確性に責任を負います。HANDSは本人確認、予約記録、決済、紛争対応を支援しますが、特定の治療効果や医療上の結果を保証しません。`,
      ],
      [
        '利用資格とアカウント',
        `利用者は法令上契約を締結できる能力を有し、正確な電話番号とアカウント情報を提供しなければなりません。アカウントや認証手段の譲渡・共有は禁止します。

不正登録、なりすまし、自動アクセス、決済の悪用、安全を脅かす行為が確認された場合、HANDSは確認のうえ利用制限またはアカウント停止を行うことがあります。`,
      ],
      [
        '予約とマッチング',
        `顧客は、提供先住所、日時、マッサージセラピスト、サービス、支払方法を確認して予約を依頼します。近い順および利用可能状態は、保存された位置、稼働時間、システム状態に基づき、正確な到着時間を保証するものではありません。

セラピストが承諾しマッチングが成立すると移動段階が始まり、チャットが開きます。双方は到着、場所、必要な要望をチャットで確認してください。`,
      ],
      [
        '料金、支払、ウォレット',
        `最終金額は、確認画面に表示されたサービス料金、クーポン、税金、適用手数料に基づきます。支払方法には現金、顧客ウォレット、対応するカード・電子決済があります。

現金予約では顧客がセラピストへ直接支払います。ウォレット・カード決済はアプリ表示の手順に従って承認、取消、返金されます。顧客ウォレットはHANDSサービスと承認済み返金・特典に使う電子残高であり、銀行預金や譲渡可能な現金口座ではありません。`,
      ],
      [
        'キャンセル、ノーショー、返金',
        `顧客はセラピストが承諾する前にアプリからキャンセルできます。マッチング後、顧客は直接キャンセルできず、セラピストが顧客の要請または正当な理由をチャットに記録してキャンセルを申請します。

マッチング後のキャンセルでは、現金決済にサービス代金の移動はなく、ウォレット決済は顧客ウォレットへ戻され、カード決済は決済事業者の取消・返金手順に従います。サービス未完了のため、セラピスト報酬、プラットフォーム手数料、関連税金は確定しません。

セラピストが顧客に会えなかった場合、HANDSはチャット、予約住所、許可された位置、連絡記録を確認し、ノーショーと支払・返金結果を判断します。反映時期は支払方法や金融機関により異なります。`,
      ],
      [
        'サービス完了と紛争',
        `セラピストはサービス終了後に完了処理を行い、その後、支払、手数料、精算記録が確定します。双方が会った後の品質、安全、支払に関する紛争はカスタマーサポートへ申告してください。

HANDSは予約状態、チャット、決済、提供先住所、許可された位置記録を確認して運営判断を行うことがあります。利用者は正確な情報を提供し、証拠保存を妨げてはなりません。`,
      ],
      [
        '義務と禁止行為',
        `顧客とセラピストは互いを尊重し、安全なサービス環境を維持しなければなりません。次の行為を禁止します。

• 虚偽情報、なりすまし、操作したレビューや支払証拠
• 暴力、脅迫、差別、性的嫌がらせ、違法またはサービス範囲外の要求
• 手数料回避を目的とするプラットフォーム外の連絡・支払誘導
• 他者の個人データ、チャット、画像、位置の無断公開
• アプリ・APIへの不正アクセス、自動化、リバースエンジニアリング、マルウェア、妨害

違反の程度に応じ、予約制限、コンテンツ削除、アカウント停止、損害賠償請求または関係当局への通報を行うことがあります。`,
      ],
      [
        'レビュー、チャット、コンテンツ',
        `投稿するレビュー、メッセージ、画像は事実に基づき、法令や他者の権利を侵害してはなりません。HANDSはサービス運営、安全、通報処理、紛争証拠の保存に必要な範囲でコンテンツを保存・確認できます。

違法、虚偽、侮辱、広告、プライバシー侵害、予約と無関係なコンテンツは非表示または削除されることがあります。著作権は原則として作成者に残りますが、HANDSはサービス提供と紛争解決に必要な範囲で利用できます。`,
      ],
      [
        '変更と中断',
        `保守、セキュリティ事故、通信・地図・決済事業者の障害、不可抗力または法的要請により、一部サービスが中断することがあります。合理的に可能な場合は事前に通知し、緊急の安全・セキュリティ措置は事後通知することがあります。

重要な機能または条件の変更は施行日と影響を公表し、利用者に重大な不利益となる変更には法令所定の手続と通知期間を適用します。`,
      ],
      [
        '責任',
        `HANDSは故意または過失により生じさせた直接損害について、適用法令に従って責任を負います。利用者の虚偽情報、規約違反、端末・通信障害、第三者サービス障害、合理的支配を超える事由による損害については責任が除外または制限されることがあります。

本条は、消費者に保障された強行法上の権利を排除せず、HANDSの故意または重大な過失に対する責任を免除しません。`,
      ],
      [
        '準拠法、紛争解決、言語',
        `本規約はベトナム法に準拠します。まずアプリ内サポートを通じて解決を協議し、解決しない場合はベトナムの権限ある消費者保護機関、調停・仲裁機関または裁判所へ申し立てることができます。

本規約は、消費者権利保護法19/2023/QH15、電子取引法20/2023/QH15、電子商取引政令52/2013/ND-CPおよび関連法令に基づきます。ベトナム語版を正本とし、翻訳との相違がある場合は法令で認められる範囲でベトナム語版を優先します。`,
      ],
    ];
  }
  if (path === '/legal/cookies') {
    return [
      [
        '適用範囲と現在の状態',
        `本方針は、hands.vnおよびHANDSが運営する公開ウェブサイトで使用するCookieと類似の保存技術を説明します。

最終更新日：2026年7月31日
施行日：HANDS正式サービス開始日

現在、公開ウェブサイトでは広告、ユーザー追跡、任意のアクセス解析Cookieを使用していません。任意技術を導入する前に、本方針と同意画面を更新します。`,
      ],
      [
        'Cookieとは',
        `Cookieは、ログイン状態、セキュリティ設定、言語などを記憶するため、ウェブサイトがブラウザに保存する小さなデータです。本方針は、ローカルストレージ、セッションストレージ、端末識別子など同様の機能を持つ技術も対象とします。`,
      ],
      [
        '必須技術',
        `ホスティング、セキュリティ、負荷分散、言語経路の維持、要求されたページの提供に必要なCookieまたはリクエストログが使用されることがあります。これらは機能と安全のために使われ、任意の広告には使用しません。

HANDSが必須Cookieを直接設定する場合、名称、目的、保存期間を本一覧に追加します。現在の公開ウェブサイトのコードは、HANDS独自のCookieを設定していません。`,
      ],
      [
        '分析・広告Cookie',
        `現在、公開ウェブサイトには行動分析Cookie、広告ピクセル、クロスサイトトラッカー、パーソナライズ広告Cookieはありません。

任意の分析・マーケティング技術を追加する場合、初期状態では無効とし、提供者、目的、保存期間を示したうえで明確な同意を取得します。拒否してもウェブサイトの必須機能は利用できます。`,
      ],
      [
        '外部リンクと第三者',
        `アプリストア、決済事業者、地図または外部サイトへ移動すると、その事業者独自のCookieとプライバシー方針が適用されることがあります。HANDSは外部サイトのCookieを管理しないため、移動前に各方針をご確認ください。`,
      ],
      [
        'ブラウザでの管理',
        `利用者はブラウザ設定からCookieを表示、削除、ブロックできます。すべてをブロックすると、言語選択、セキュリティ、将来のログイン機能に影響することがあります。

任意Cookieを導入した場合、ウェブサイトで同意を変更または撤回できる設定を提供します。撤回前に適法に行われた処理には影響しません。`,
      ],
      [
        '変更・連絡先・言語',
        `技術または提供者が変わった場合、一覧、目的、保存期間を更新します。任意追跡の範囲が実質的に変わる場合は再同意を取得します。

Cookieと個人データに関する問い合わせは、アプリ内サポートまたは正式リリース前に公表するデータ保護窓口で受け付けます。ベトナム語版を正本とし、翻訳との相違がある場合は法令で認められる範囲でベトナム語版を優先します。`,
      ],
    ];
  }
  return [
    ['基本方針', 'HANDSは明確な情報、責任ある運営、顧客とマッサージセラピスト双方の安全を優先します。'],
    ['利用者への案内', '予約前にプロフィール、料金、サービス内容をご確認ください。重要な変更はこのページでお知らせします。'],
    ['お問い合わせ', 'アプリ内サポートまたは公式お問い合わせ窓口からご連絡ください。確認に必要な予約情報をご用意ください。'],
  ];
}

function chineseSections(path: string): Array<[string, string]> {
  if (path === '/legal/privacy') {
    return [
      [
        '适用范围与生效日期',
        `本政策适用于HANDS公开网站、客户应用、按摩治疗师应用及客户支持渠道处理的个人数据。

最后更新：2026年7月31日
生效日期：HANDS正式服务上线之日

HANDS运营主体的法定名称、企业登记号、地址及个人数据保护联系方式将在正式上线前公布于网站页脚及本政策中。`,
      ],
      [
        '我们收集的个人数据',
        `• 账户信息：姓名、电话号码、验证信息、个人资料和语言设置
• 预约信息：所选服务、日期时间、服务地址、特别要求、预约状态和取消原因
• 位置信息：用于附近搜索、匹配、服务运营和争议核查的当前位置及预约位置
• 交易信息：支付方式、支付与退款金额、交易标识、优惠券和客户钱包账本
• 支持与安全信息：聊天、附件图片、评价、举报、客服记录和运营决定
• 设备与使用信息：IP地址、设备、操作系统、应用版本、会话、推送令牌、访问、错误和安全日志
• 按摩治疗师信息：身份与KYC材料、个人资料图片、服务、价格、服务区域、结算、税务和银行信息

HANDS仅收集各目的所必需的数据，并对精确位置及支付、金融数据采取加强保护措施。`,
      ],
      [
        '个人数据的使用目的',
        `我们在必要范围内将个人数据用于：

• 创建账户、身份验证、登录和安全保护
• 搜索附近按摩治疗师、预约、匹配、聊天和服务进度管理
• 处理支付、退款、优惠券、钱包、结算和税务记录
• 根据预约、聊天和位置证据审查取消、爽约、举报和争议
• 发送通知、提供客服、改善质量与安全
• 防止和调查欺诈、账户盗用、支付错误及违法行为
• 履行法律义务并保存可审计的运营记录

如新目的与原告知目的不兼容，除法律允许外，我们将另行取得同意。`,
      ],
      [
        '处理依据与同意',
        `HANDS基于明确同意、服务合同的订立或履行、法律义务、紧急情况下保护生命健康，或法律允许的其他依据处理个人数据。

需要同意时，我们会事先说明数据类型、目的、处理主体及用户权利，并提供明确选择。沉默或不作为不构成同意。撤回同意不影响撤回前已依法完成的处理。`,
      ],
      [
        '保存期限与删除',
        `个人数据保存至处理目的完成，之后以难以恢复的方式删除或销毁。支付、退款、税务、会计、争议、反欺诈及法定义务记录可按法定期限或至争议结束时单独保存。

账户删除后，对于未完成预约、退款、结算、举报或法定保存义务所需记录，我们可能仅作有限保留且不会用于其他目的。`,
      ],
      [
        '共享与受托处理',
        `HANDS可在提供服务所需范围内与以下主体处理或共享数据：

• 履行预约的客户与按摩治疗师：姓名、个人资料、服务地址、预约和聊天信息
• 支付与退款服务商：交易标识、方式、金额和状态
• 电话验证、推送通知、地图地址、云服务、存储、安全和客服供应商
• 因法律义务或有效请求而涉及的政府、调查或司法机关

正式供应商确定后，我们将在本政策或单独的处理方清单中公布名称、目的、数据类别和保存期限。HANDS不会出售个人数据。`,
      ],
      [
        '跨境传输',
        `如云服务、推送、地图或支付服务器位于越南境外，数据可能在境外处理。HANDS将确认目的地、接收方、目的、数据、保存期限和保护措施，并依越南法律完成所需同意、影响评估和记录。`,
      ],
      [
        '您的权利',
        `在适用法律范围内，用户有权：

• 获得处理告知并请求访问或取得个人数据
• 作出或撤回同意，并反对处理
• 更正不准确信息
• 请求删除、限制处理并提出投诉
• 请求赔偿并举报违法行为

用户可通过应用内客服或上线前公布的数据保护联系方式提交请求。HANDS将在核实身份后于法定期限内处理；如因他人权利或法律义务受到限制，我们会说明原因。`,
      ],
      [
        '安全措施与事件响应',
        `HANDS采取合理的技术和管理措施，包括基于角色的访问控制、认证信息保护、传输加密、敏感操作审计日志、支付状态防重复处理、备份和漏洞检查。

确认发生个人数据事件后，HANDS将控制影响、调查原因，并在法律要求时通知主管机关和受影响用户。`,
      ],
      [
        '变更、联系与语言',
        `重大变更将在生效前通过网站或应用公布。如收集目的、敏感数据处理或第三方共享发生实质变化，我们将在需要时重新取得同意。

本政策依据越南个人数据保护第13/2023/ND-CP号法令、消费者权益保护法19/2023/QH15及其他适用法律制定。越南语版本为主要依据；翻译仅为便利，在法律允许范围内以越南语版本为准。`,
      ],
    ];
  }
  if (path === '/legal/terms') {
    return [
      [
        '目的与生效日期',
        `本条款规定HANDS公开网站、客户应用、预约、匹配、聊天、支付、钱包和客户支持服务的使用条件。

最后更新：2026年7月31日
生效日期：HANDS正式服务上线之日

HANDS运营主体的法定名称、企业登记号、地址及联系方式将在正式上线前公布于网站页脚。`,
      ],
      [
        '服务性质',
        `HANDS是帮助客户查看按摩治疗师公开资料、服务、价格和评价，并在应用内预约的平台。网站仅提供信息，不接受预约。

按摩治疗师对其服务资格及资料准确性负责。HANDS提供验证、预约记录、支付和争议处理支持，但不保证特定治疗效果或医疗结果。`,
      ],
      [
        '使用资格与账户',
        `用户应具备依法订立合同的能力，并提供准确的电话号码和账户信息。账户和验证方式不得转让或共享。

发现虚假注册、冒充、自动化访问、支付滥用或危及安全的行为时，HANDS可在核查后限制使用或暂停账户。`,
      ],
      [
        '预约与匹配',
        `客户在提交预约前应确认服务地址、时间、按摩治疗师、服务和支付方式。距离排序与可用状态依据保存的位置、工作时间和系统状态，不构成准确到达时间的保证。

治疗师接受预约并完成匹配后，即进入出发阶段并开启聊天。双方应通过聊天确认到达、位置和必要要求。`,
      ],
      [
        '价格、支付与钱包',
        `最终金额以确认页面显示的服务价格、优惠券、税费及适用费用为准。支付方式可包括现金、客户钱包或受支持的银行卡和电子支付。

现金预约由客户直接向治疗师支付。钱包和银行卡支付按应用所示流程授权、取消和退款。客户钱包是用于HANDS服务及已批准退款或奖励的电子余额，不是银行存款或可转让现金账户。`,
      ],
      [
        '取消、爽约与退款',
        `治疗师接受前，客户可在应用内取消。匹配后客户不能直接取消；治疗师须在聊天中记录取消是应客户要求或基于正当原因。

匹配后取消时，现金支付不发生服务款项流转；钱包支付退回客户钱包；银行卡支付按支付服务商的取消或退款流程处理。因服务未完成，治疗师报酬、平台费用及相关税费均不确认。

如治疗师未能见到客户，HANDS将审查聊天、预约地址、经许可的位置和联系记录，以判断爽约及支付或退款结果。到账时间可能因支付方式和金融机构而异。`,
      ],
      [
        '服务完成与争议',
        `治疗师应在服务结束后标记完成，之后支付、费用和结算记录生效。双方见面后发生的质量、安全或支付争议应提交客户支持。

HANDS可审查预约状态、聊天、支付、服务地址及经许可的位置记录并作出运营决定。用户须提供准确信息，不得妨碍证据保存。`,
      ],
      [
        '义务与禁止行为',
        `客户与治疗师应相互尊重并维护安全的服务环境。禁止：

• 虚假信息、冒充、操纵评价或支付证据
• 暴力、威胁、歧视、性骚扰、违法或超出服务范围的要求
• 为规避费用而诱导转至平台外联系或支付
• 未经授权披露他人的个人数据、聊天、图片或位置
• 未经授权访问、自动化、反向工程、恶意软件或干扰应用和API

HANDS可视严重程度限制预约、删除内容、暂停账户、索赔或向主管机关举报。`,
      ],
      [
        '评价、聊天与内容',
        `用户发布的评价、消息和图片应真实，不得违反法律或侵害他人权利。HANDS可在运营、安全、举报处理和争议证据保存所需范围内存储和审查内容。

违法、虚假、侮辱、广告、侵犯隐私或与预约无关的内容可被隐藏或删除。著作权原则上归创作者所有，但HANDS可在提供服务和解决争议所需范围内使用。`,
      ],
      [
        '服务变更与中断',
        `维护、安全事件、通信、地图或支付服务故障、不可抗力或法律要求可能导致部分服务中断。合理可行时HANDS会提前通知；紧急安全措施可事后通知。

重要功能或条件变更将公布生效日期和影响。对用户有重大不利影响的变更将遵守法律规定的程序和通知期限。`,
      ],
      [
        '责任',
        `HANDS对其故意或过失造成的直接损失依法承担责任。因用户虚假信息、违反条款、设备或网络问题、第三方服务故障或合理控制之外的事件造成的损失，责任可能被排除或限制。

本条不排除消费者的法定强制权利，也不免除HANDS对故意行为或重大过失的责任。`,
      ],
      [
        '适用法律、争议与语言',
        `本条款适用越南法律。争议应首先通过应用内客服协商；未能解决时，用户可向越南有权的消费者保护机构、调解或仲裁机构、法院申请处理。

本条款依据消费者权益保护法19/2023/QH15、电子交易法20/2023/QH15、电子商务第52/2013/ND-CP号法令及其他适用法律制定。越南语版本为主要依据，在法律允许范围内与翻译不一致时以越南语版本为准。`,
      ],
    ];
  }
  if (path === '/legal/cookies') {
    return [
      [
        '范围与当前状态',
        `本政策说明hands.vn及HANDS运营的其他公开网站所使用的Cookie和类似存储技术。

最后更新：2026年7月31日
生效日期：HANDS正式服务上线之日

当前公开网站不使用广告、用户追踪或可选访问分析Cookie。引入可选技术前，我们会先更新本政策和同意界面。`,
      ],
      [
        '什么是Cookie？',
        `Cookie是网站保存在浏览器中的小型数据，用于记住登录状态、安全设置或语言。本政策也涵盖本地存储、会话存储和设备标识等具有类似功能的技术。`,
      ],
      [
        '严格必要技术',
        `托管、安全、负载均衡、保持语言路径或提供所请求页面可能需要必要Cookie或请求日志。这些技术仅用于功能与安全，不用于可选广告。

如HANDS直接设置必要Cookie，我们会在清单中加入其名称、目的和保存期限。当前公开网站代码未设置HANDS专有Cookie。`,
      ],
      [
        '分析与广告Cookie',
        `当前公开网站没有行为分析Cookie、广告像素、跨站追踪器或个性化广告Cookie。

如加入可选分析或营销技术，将默认关闭。我们会说明供应商、目的和保存期限，并取得明确同意。拒绝不会妨碍网站必要功能的使用。`,
      ],
      [
        '外部链接与第三方',
        `访问应用商店、支付服务商、地图或其他外部网站时，第三方可能适用自己的Cookie和隐私政策。HANDS无法控制外部网站设置的Cookie，请在继续前查看其政策。`,
      ],
      [
        '浏览器控制',
        `用户可在浏览器设置中查看、删除或阻止Cookie。阻止所有Cookie可能影响语言选择、安全或未来的登录功能。

如引入可选Cookie，网站将提供设置以更改或撤回同意。撤回不影响此前依法完成的处理。`,
      ],
      [
        '变更、联系与语言',
        `技术或供应商变更时，HANDS将更新清单、目的和保存期限。如可选追踪范围发生实质变化，我们会重新取得同意。

Cookie和个人数据问题可通过应用内客服或上线前公布的数据保护联系方式提交。越南语版本为主要依据，在法律允许范围内与翻译不一致时以越南语版本为准。`,
      ],
    ];
  }
  return [
    ['基本原则', 'HANDS重视信息透明、负责任的运营，以及客户和按摩治疗师双方的安全。'],
    ['使用说明', '预约前请确认按摩治疗师资料、价格与服务内容。重要变更会在本页面公布。'],
    ['联系我们', '请通过应用内客服或官方联系渠道咨询，并准备相关预约信息以便核查。'],
  ];
}
