# Chat Flow

## Rule
- Chat room is created after matching and becomes usable when partner starts service flow.
- Mobile apps hide completed booking chat after service completion.
- Admin keeps the full chat archive for every booking.

## Customer
1. Customer selects final partner.
2. Booking is matched.
3. Chat room appears.
4. Customer sends/receives messages.
5. After completion, chat is no longer primary mobile action.

## Partner
1. Partner accepts matched booking.
2. Partner starts service.
3. Chat tab opens for customer communication.
4. Partner can share current location manually.
5. After completion, chat is hidden from active mobile workflow.

## Admin
- Search by booking, customer, partner, date/time.
- View all messages.
- Export or inspect message history.
- Do not delete operational chat archive unless retention policy allows.

## Events
- chat.message.created
- booking.matched
- service.started
- service.completed
