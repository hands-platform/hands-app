import 'dart:convert';
import 'dart:io';

import 'package:customer_app/src/core/api_client.dart';
import 'package:customer_app/src/core/realtime_socket.dart';
import 'package:customer_app/src/features/chat/data/repositories/chat_repository_impl.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('persists customer chat messages through the authenticated HTTP API',
      () async {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    addTearDown(() => server.close(force: true));

    String? requestPath;
    String? requestMethod;
    Map<String, dynamic>? requestBody;
    server.listen((request) async {
      requestPath = request.uri.path;
      requestMethod = request.method;
      requestBody = jsonDecode(await utf8.decoder.bind(request).join())
          as Map<String, dynamic>;
      request.response.headers.contentType = ContentType.json;
      request.response.write(jsonEncode({
        'id': 'message-1',
        'chatRoomId': 'chat-room-1',
        'body': 'I am waiting at the saved address.',
      }));
      await request.response.close();
    });

    final repository = ChatRepositoryImpl(
      ApiClient(baseUrl: 'http://127.0.0.1:${server.port}'),
      RealtimeSocket(baseUrl: 'http://127.0.0.1:${server.port}'),
    );

    expect(
      await repository.sendChatMessage(
        'chat-room-1',
        'I am waiting at the saved address.',
      ),
      {
        'id': 'message-1',
        'chatRoomId': 'chat-room-1',
        'body': 'I am waiting at the saved address.',
      },
    );
    expect(requestMethod, 'POST');
    expect(requestPath, '/chat/rooms/chat-room-1/messages');
    expect(requestBody, {'body': 'I am waiting at the saved address.'});
  });
}
