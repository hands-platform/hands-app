import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:provider_app/src/core/api_client.dart';
import 'package:provider_app/src/core/realtime_socket.dart';
import 'package:provider_app/src/features/chat/data/repositories/chat_repository_impl.dart';

void main() {
  test('loads the persisted provider chat unread summary', () async {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    addTearDown(() => server.close(force: true));

    String? requestPath;
    server.listen((request) async {
      requestPath = request.uri.path;
      request.response.headers.contentType = ContentType.json;
      request.response.write(jsonEncode({'unreadCount': 3}));
      await request.response.close();
    });

    final repository = ChatRepositoryImpl(
      ApiClient(baseUrl: 'http://127.0.0.1:${server.port}'),
      RealtimeSocket(baseUrl: 'http://127.0.0.1:${server.port}'),
    );

    expect(await repository.notificationSummary(), {
      'unreadCount': 3,
    });
    expect(requestPath, '/notifications/provider-chat/summary');
  });

  test('marks only the opened provider chat room read', () async {
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
        'updated': 2,
        'unreadCount': 1,
      }));
      await request.response.close();
    });

    final repository = ChatRepositoryImpl(
      ApiClient(baseUrl: 'http://127.0.0.1:${server.port}'),
      RealtimeSocket(baseUrl: 'http://127.0.0.1:${server.port}'),
    );

    expect(await repository.markNotificationsRead('chat-room-1'), {
      'updated': 2,
      'unreadCount': 1,
    });
    expect(requestMethod, 'PATCH');
    expect(requestPath, '/notifications/provider-chat/read');
    expect(requestBody, {'chatRoomId': 'chat-room-1'});
  });

  test('persists provider chat messages through the authenticated HTTP API',
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
        'body': 'I arrived at the service address.',
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
        'I arrived at the service address.',
      ),
      {
        'id': 'message-1',
        'chatRoomId': 'chat-room-1',
        'body': 'I arrived at the service address.',
      },
    );
    expect(requestMethod, 'POST');
    expect(requestPath, '/chat/rooms/chat-room-1/messages');
    expect(requestBody, {'body': 'I arrived at the service address.'});
  });

  test('uploads a private provider chat photo before creating its message',
      () async {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    addTearDown(() => server.close(force: true));

    final requests = <String>[];
    final bodies = <String, dynamic>{};
    server.listen((request) async {
      requests.add('${request.method} ${request.uri.path}');
      if (request.uri.path == '/files/presign') {
        bodies['presign'] = jsonDecode(await utf8.decoder.bind(request).join());
        request.response.headers.contentType = ContentType.json;
        request.response.write(jsonEncode({
          'file': {'id': 'file-1'},
          'upload': {
            'url': 'http://127.0.0.1:${server.port}/upload',
            'headers': {'content-type': 'image/jpeg'},
          },
        }));
      } else if (request.uri.path == '/upload') {
        bodies['upload'] = await request.fold<List<int>>(
          <int>[],
          (bytes, chunk) => bytes..addAll(chunk),
        );
      } else if (request.uri.path == '/files/file-1/complete') {
        bodies['complete'] =
            jsonDecode(await utf8.decoder.bind(request).join());
        request.response.headers.contentType = ContentType.json;
        request.response.write('{}');
      } else {
        bodies['message'] = jsonDecode(await utf8.decoder.bind(request).join());
        request.response.headers.contentType = ContentType.json;
        request.response.write(jsonEncode({
          'id': 'message-photo-1',
          'attachments': [
            {'id': 'file-1'},
          ],
        }));
      }
      await request.response.close();
    });

    final repository = ChatRepositoryImpl(
      ApiClient(baseUrl: 'http://127.0.0.1:${server.port}'),
      RealtimeSocket(baseUrl: 'http://127.0.0.1:${server.port}'),
    );

    expect(
      await repository.sendChatAttachment(
        'chat-room-1',
        bytes: const [1, 2, 3],
        contentType: 'image/jpeg',
      ),
      {
        'id': 'message-photo-1',
        'attachments': [
          {'id': 'file-1'},
        ],
      },
    );
    expect(requests, [
      'POST /files/presign',
      'PUT /upload',
      'POST /files/file-1/complete',
      'POST /chat/rooms/chat-room-1/messages',
    ]);
    expect(bodies['presign'], {
      'contentType': 'image/jpeg',
      'visibility': 'PRIVATE',
      'purpose': 'chat-attachment',
      'sizeBytes': 3,
    });
    expect(bodies['upload'], [1, 2, 3]);
    expect(bodies['complete'], {'sizeBytes': 3});
    expect(bodies['message'], {
      'body': 'Photo',
      'attachments': [
        {'id': 'file-1'},
      ],
    });
  });
}
