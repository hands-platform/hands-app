import 'dart:typed_data';

import 'package:image_picker/image_picker.dart';

class ProviderPickedImage {
  const ProviderPickedImage({
    required this.bytes,
    required this.contentType,
    required this.name,
  });

  final Uint8List bytes;
  final String contentType;
  final String name;
}

Future<ProviderPickedImage?> pickProviderImage({
  required int imageQuality,
  required double maxWidth,
}) async {
  final image = await ImagePicker().pickImage(
    source: ImageSource.gallery,
    imageQuality: imageQuality,
    maxWidth: maxWidth,
  );
  if (image == null) {
    return null;
  }

  return ProviderPickedImage(
    bytes: await image.readAsBytes(),
    contentType: image.mimeType ?? guessImageContentTypeFromName(image.name),
    name: image.name,
  );
}

String guessImageContentTypeFromName(String name) {
  final lowerName = name.toLowerCase();
  if (lowerName.endsWith('.png')) {
    return 'image/png';
  }
  if (lowerName.endsWith('.webp')) {
    return 'image/webp';
  }
  return 'image/jpeg';
}
