abstract class ChatRepository {
  Future<List<dynamic>> listChatMessages(String chatRoomId);

  void joinChat(String chatRoomId);

  Future<Map<String, dynamic>> sendChatMessage(
    String chatRoomId,
    String text,
  );

  Future<Map<String, dynamic>> sendChatAttachment(
    String chatRoomId, {
    required List<int> bytes,
    required String contentType,
  });

  Future<Uri> getChatAttachmentUri(String fileId);
}
