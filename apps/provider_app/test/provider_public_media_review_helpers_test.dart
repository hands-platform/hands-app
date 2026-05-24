import 'package:flutter_test/flutter_test.dart';
import 'package:provider_app/main.dart';

void main() {
  test('recognizes reviewable public provider media', () {
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

  test('labels provider public media review states', () {
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
      'Profile image',
    );
    expect(
      providerPublicMediaPurposeLabel('PROVIDER_GALLERY'),
      'Work photo',
    );
    expect(
      providerPublicMediaReviewLabel('REJECTED'),
      contains('Needs changes'),
    );
  });
}
