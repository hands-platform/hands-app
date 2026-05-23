import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../domain/entities/address_search_result.dart';

class GeoapifyGeocodingDataSource {
  GeoapifyGeocodingDataSource({required this.apiKey, http.Client? client})
      : _client = client ?? http.Client();

  final String apiKey;
  final http.Client _client;
  final Map<String, List<AddressSearchResult>> _cache = {};

  Future<List<AddressSearchResult>> search(String query) async {
    final normalized = query.trim().toLowerCase();
    if (normalized.length < 2 || apiKey.isEmpty) {
      return [];
    }

    final cached = _cache[normalized];
    if (cached != null) {
      return cached;
    }

    final uri = Uri.https('api.geoapify.com', '/v1/geocode/search', {
      'text': query.trim(),
      'filter': 'countrycode:vn',
      'bias': 'countrycode:vn',
      'lang': 'vi',
      'limit': '6',
      'apiKey': apiKey,
    });
    final response = await _client.get(uri);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception('Address search failed (${response.statusCode}).');
    }

    final body = jsonDecode(response.body) as Map<String, dynamic>;
    final features = body['features'] is List<dynamic>
        ? body['features'] as List<dynamic>
        : [];
    final results = features
        .map((feature) {
          final item = feature as Map<String, dynamic>;
          final properties = item['properties'] as Map<String, dynamic>? ?? {};
          final lat = _asDouble(properties['lat']);
          final lng = _asDouble(properties['lon']);
          final label = properties['formatted']?.toString() ??
              properties['address_line1']?.toString() ??
              query;
          if (lat == null || lng == null) {
            return null;
          }
          return AddressSearchResult(
              label: label, latitude: lat, longitude: lng);
        })
        .whereType<AddressSearchResult>()
        .toList();

    _cache[normalized] = results;
    return results;
  }

  double? _asDouble(dynamic value) {
    if (value is num) {
      return value.toDouble();
    }
    if (value is String) {
      return double.tryParse(value);
    }
    return null;
  }
}
