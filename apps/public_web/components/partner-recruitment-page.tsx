import { HandsSiteFooter, HandsSiteHeader } from './hands-site-chrome';
import { HalsaFeaturesClone } from './halsa-features-clone';
import { HeroVideoCard } from './hero-video-card';
import { OhioCreativeCapabilities } from './ohio-creative-capabilities';
import { AsymmetricVisionClone } from './asymmetric-vision-clone';

export function PartnerRecruitmentPage() {
  return (
    <div className="hands-site recruitment-page">
      <HandsSiteHeader locale="vi" site="recruitment" theme="overlay" />
      <main>
        <section className="recruitment-hero" id="top">
          <div
            className="recruitment-hero-media"
            aria-label="Hai đối tác HANDS đến phục vụ khách hàng"
            role="img"
          />
          <div className="recruitment-hero-shade" aria-hidden="true" />
          <div className="recruitment-hero-copy">
            <p className="eyebrow">TRỞ THÀNH ĐỐI TÁC HANDS</p>
            <h1>
              Tự chủ công việc.
              <br />
              Vững vàng mỗi ngày.
            </h1>
            <p>
              Chọn thời gian, khu vực và dịch vụ bạn muốn cung cấp. HANDS giúp hành trình làm việc rõ ràng
              hơn.
            </p>
            <a className="button button-light" href="https://join.hands.vn/">
              Đăng ký trên ứng dụng
            </a>
          </div>
          <HeroVideoCard
            className="recruitment-hero-video"
            poster="/images/recruitment/partner-interview.png"
            subtitle="Lịch làm việc linh hoạt, trải nghiệm thực tế."
            title="Câu chuyện từ đối tác HANDS"
          />
        </section>

        <HalsaFeaturesClone />

        <OhioCreativeCapabilities />

        <AsymmetricVisionClone />
      </main>
      <HandsSiteFooter locale="vi" site="recruitment" />
    </div>
  );
}
