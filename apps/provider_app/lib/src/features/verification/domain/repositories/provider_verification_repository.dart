abstract class ProviderVerificationRepository {
  Future<Map<String, dynamic>> verification();

  Future<Map<String, dynamic>> createVerificationUpload({
    String contentType = 'image/jpeg',
    required int sizeBytes,
  });

  Future<Map<String, dynamic>> uploadVerificationFile({
    required List<int> bytes,
    required String contentType,
  });

  Future<Map<String, dynamic>> submitVerification({
    List<String> fileIds = const [],
  });
}
