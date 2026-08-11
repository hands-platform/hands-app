import 'package:customer_app/src/core/api_client.dart';
import 'package:customer_app/src/core/realtime_socket.dart';
import 'package:customer_app/src/features/chat/data/repositories/chat_repository_impl.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('uploads a private file before sending its chat reference', () async {
    final api = _RecordingUploadApiClient();
    final repository = ChatRepositoryImpl(
      api,
      RealtimeSocket(baseUrl: 'http://socket.test'),
    );

    final message = await repository.sendChatAttachment(
      'room-1',
      bytes: [1, 2, 3],
      contentType: 'image/jpeg',
    );

    expect(api.uploadedBytes, [1, 2, 3]);
    expect(api.completedFileId, 'file-1');
    expect(api.sentAttachmentId, 'file-1');
    expect(message['id'], 'message-1');
  });
}

class _RecordingUploadApiClient extends ApiClient {
  _RecordingUploadApiClient() : super(baseUrl: 'http://api.test');

  List<int> uploadedBytes = [];
  String? completedFileId;
  String? sentAttachmentId;

  @override
  Future<dynamic> postJson(String path, Map<String, dynamic> body) async {
    if (path == '/files/presign') {
      return {
        'file': {'id': 'file-1'},
        'upload': {
          'url': 'https://storage.test/file-1',
          'headers': {'content-type': 'image/jpeg'},
        },
      };
    }
    if (path == '/files/file-1/complete') {
      completedFileId = 'file-1';
      return {};
    }
    if (path == '/chat/rooms/room-1/messages') {
      sentAttachmentId =
          ((body['attachments'] as List).single as Map)['id']?.toString();
      return {'id': 'message-1', ...body};
    }
    throw StateError('Unexpected POST $path');
  }

  @override
  Future<void> putBytes(
    Uri uri, {
    required Map<String, String> headers,
    required List<int> bytes,
  }) async {
    uploadedBytes = bytes;
  }
}
