import 'package:flutter_test/flutter_test.dart';
import 'package:provider_app/provider_app.dart';

void main() {
  test('recognizes reviewable public partner media', () {
    expect(
      providerPublicMediaIsReviewable({
        'purpose': 'PROFILE_IMAGE',
        'visibility': 'PUBLIC',
        'uploadStatus': 'UPLOADED',
      }),
      isTrue,
    );
    expect(
      providerPublicMediaIsReviewable({
        'purpose': 'PROVIDER_GALLERY',
        'visibility': 'PUBLIC',
        'uploadStatus': 'UPLOADED',
      }),
      isTrue,
    );
    expect(
      providerPublicMediaIsReviewable({
        'purpose': 'CCCD_FRONT',
        'visibility': 'PRIVATE',
        'uploadStatus': 'UPLOADED',
      }),
      isFalse,
    );
  });

  test('labels partner public media review states', () {
    expect(providerPublicMediaReviewStatus({}), 'PENDING_REVIEW');
    expect(
      providerPublicMediaReviewStatus({'reviewStatus': 'APPROVED'}),
      'APPROVED',
    );
    expect(
      providerPublicMediaReviewStatus({'reviewStatus': 'REJECTED'}),
      'REJECTED',
    );
    expect(
      providerPublicMediaPurposeLabel('PROFILE_IMAGE'),
      'Ảnh hồ sơ',
    );
    expect(
      providerPublicMediaPurposeLabel('PROVIDER_GALLERY'),
      'Ảnh công việc',
    );
    expect(
      providerPublicMediaReviewLabel('REJECTED'),
      contains('Cần chỉnh sửa'),
    );
  });
}
