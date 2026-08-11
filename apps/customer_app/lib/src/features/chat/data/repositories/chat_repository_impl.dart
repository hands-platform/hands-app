import '../../../../core/api_client.dart';
import '../../../../core/realtime_socket.dart';
import '../../domain/repositories/chat_repository.dart';

class ChatRepositoryImpl implements ChatRepository {
  const ChatRepositoryImpl(this._api, this._socket);

  final ApiClient _api;
  final RealtimeSocket _socket;

  @override
  Future<List<dynamic>> listChatMessages(String chatRoomId) async {
    final result = await _api.getJson('/chat/rooms/$chatRoomId/messages');
    return result is List<dynamic> ? result : [];
  }

  @override
  void joinChat(String chatRoomId) {
    _socket.joinChat(chatRoomId);
  }

  @override
  Future<Map<String, dynamic>> sendChatMessage(
    String chatRoomId,
    String text,
  ) async {
    final result = await _api.postJson(
      '/chat/rooms/$chatRoomId/messages',
      {'body': text},
    );
    return result is Map<String, dynamic> ? result : <String, dynamic>{};
  }

  @override
  Future<Map<String, dynamic>> sendChatAttachment(
    String chatRoomId, {
    required List<int> bytes,
    required String contentType,
  }) async {
    final presign = await _api.postJson('/files/presign', {
      'contentType': contentType,
      'visibility': 'PRIVATE',
      'purpose': 'chat-attachment',
    });
    if (presign is! Map) {
      throw const FormatException('Upload response is invalid.');
    }
    final file = presign['file'];
    final upload = presign['upload'];
    if (file is! Map || upload is! Map) {
      throw const FormatException('Upload response is incomplete.');
    }
    final fileId = file['id']?.toString() ?? '';
    final rawUrl = upload['url']?.toString() ?? '';
    if (fileId.isEmpty || rawUrl.isEmpty) {
      throw const FormatException('Upload response is incomplete.');
    }
    final headers = upload['headers'] is Map
        ? Map<String, String>.from(
            (upload['headers'] as Map).map(
              (key, value) => MapEntry('$key', '$value'),
            ),
          )
        : {'content-type': contentType};
    final parsed = Uri.parse(rawUrl);
    await _api.putBytes(
      parsed.hasScheme ? parsed : Uri.parse(_api.baseUrl).resolveUri(parsed),
      headers: headers,
      bytes: bytes,
    );
    await _api.postJson('/files/$fileId/complete', {
      'sizeBytes': bytes.length,
    });
    final result = await _api.postJson('/chat/rooms/$chatRoomId/messages', {
      'body': 'Photo',
      'attachments': [
        {'id': fileId},
      ],
    });
    return result is Map<String, dynamic> ? result : <String, dynamic>{};
  }

  @override
  Future<Uri> getChatAttachmentUri(String fileId) async {
    final result = await _api.getJson('/files/$fileId/read-url');
    final rawUrl = result is Map && result['read'] is Map
        ? (result['read'] as Map)['url']?.toString() ?? ''
        : '';
    if (rawUrl.isEmpty) {
      throw const FormatException('Attachment read URL is missing.');
    }
    final parsed = Uri.parse(rawUrl);
    return parsed.hasScheme
        ? parsed
        : Uri.parse(_api.baseUrl).resolveUri(parsed);
  }
}
