import 'dart:convert';

import 'package:http/http.dart' as http;

enum TokenRefreshMode {
  nest,
  disabled,
}

class ApiClient {
  ApiClient({
    required this.baseUrl,
    this.tokenRefreshMode = TokenRefreshMode.nest,
    this.onTokensRefreshed,
  });

  final String baseUrl;
  final TokenRefreshMode tokenRefreshMode;
  Future<void> Function(String accessToken, String refreshToken)?
      onTokensRefreshed;
  String? accessToken;
  String? refreshToken;
  Future<bool>? _refreshInFlight;

  Future<dynamic> getJson(String path) async {
    return _sendWithRefresh(() => http.get(_uri(path), headers: _headers()));
  }

  Future<dynamic> postJson(String path, Map<String, dynamic> body) async {
    return _sendWithRefresh(() =>
        http.post(_uri(path), headers: _headers(), body: jsonEncode(body)));
  }

  Future<dynamic> deleteJson(String path, Map<String, dynamic> body) async {
    return _sendWithRefresh(() =>
        http.delete(_uri(path), headers: _headers(), body: jsonEncode(body)));
  }

  Future<void> putBytes(
    Uri uri, {
    required Map<String, String> headers,
    required List<int> bytes,
  }) async {
    final response = await http.put(uri, headers: headers, body: bytes);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(
        response.statusCode,
        const {'message': 'File upload failed'},
      );
    }
  }

  Future<void> revokeRefreshToken() async {
    final token = refreshToken;
    if (token == null || token.isEmpty) {
      return;
    }
    final response = await http.post(
      _uri('/auth/logout'),
      headers: {'content-type': 'application/json'},
      body: jsonEncode({'refreshToken': token}),
    );
    _decode(response);
  }

  Future<dynamic> patchJson(String path, Map<String, dynamic> body) async {
    return _sendWithRefresh(() =>
        http.patch(_uri(path), headers: _headers(), body: jsonEncode(body)));
  }

  Future<dynamic> putJson(String path, Map<String, dynamic> body) async {
    return _sendWithRefresh(() =>
        http.put(_uri(path), headers: _headers(), body: jsonEncode(body)));
  }

  Uri _uri(String path) => Uri.parse('$baseUrl$path');

  Map<String, String> _headers() {
    return {
      'content-type': 'application/json',
      if (accessToken != null) 'authorization': 'Bearer $accessToken',
    };
  }

  dynamic _decode(http.Response response) {
    final decoded =
        response.body.isEmpty ? <String, dynamic>{} : jsonDecode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(response.statusCode,
          decoded is Map<String, dynamic> ? decoded : {'error': decoded});
    }
    return decoded;
  }

  Future<dynamic> _sendWithRefresh(
      Future<http.Response> Function() request) async {
    final firstResponse = await request();
    if (!_shouldRefresh(firstResponse)) {
      return _decode(firstResponse);
    }

    final refreshed = await _refreshAccessTokenSingleFlight();
    if (!refreshed) {
      return _decode(firstResponse);
    }

    final retryResponse = await request();
    return _decode(retryResponse);
  }

  bool _shouldRefresh(http.Response response) {
    if (tokenRefreshMode == TokenRefreshMode.disabled) {
      return false;
    }
    if (refreshToken == null || refreshToken!.isEmpty) {
      return false;
    }
    if (response.statusCode == 401) {
      return true;
    }
    final body = _parseBody(response);
    final message = body['message'];
    return message is String && message.toLowerCase().contains('jwt expired');
  }

  Map<String, dynamic> _parseBody(http.Response response) {
    if (response.body.isEmpty) {
      return <String, dynamic>{};
    }
    final decoded = jsonDecode(response.body);
    return decoded is Map<String, dynamic>
        ? decoded
        : <String, dynamic>{'error': decoded};
  }

  Future<bool> _refreshAccessTokenSingleFlight() {
    final pending = _refreshInFlight;
    if (pending != null) {
      return pending;
    }

    late final Future<bool> refresh;
    refresh = _refreshAccessToken().whenComplete(() {
      if (identical(_refreshInFlight, refresh)) {
        _refreshInFlight = null;
      }
    });
    _refreshInFlight = refresh;
    return refresh;
  }

  Future<bool> _refreshAccessToken() async {
    if (tokenRefreshMode == TokenRefreshMode.disabled) {
      return false;
    }
    final token = refreshToken;
    if (token == null || token.isEmpty) {
      return false;
    }
    final response = await http.post(
      _uri('/auth/refresh'),
      headers: {'content-type': 'application/json'},
      body: jsonEncode({'refreshToken': token}),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      return false;
    }

    final decoded = _parseBody(response);
    final nextAccessToken = decoded['accessToken'];
    final nextRefreshToken = decoded['refreshToken'];
    if (nextAccessToken is! String || nextAccessToken.isEmpty) {
      return false;
    }

    accessToken = nextAccessToken;
    if (nextRefreshToken is String && nextRefreshToken.isNotEmpty) {
      refreshToken = nextRefreshToken;
    }
    await onTokensRefreshed?.call(accessToken!, refreshToken ?? '');
    return true;
  }
}

class ApiException implements Exception {
  ApiException(this.statusCode, this.body);

  final int statusCode;
  final Map<String, dynamic> body;

  @override
  String toString() => 'ApiException($statusCode, $body)';
}
