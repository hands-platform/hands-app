# Chat Flow

## Rule

Chat is created for matched bookings. It is available to the customer and selected partner during the active service flow. After the partner completes the service, normal mobile chat disappears from the active app flow, but Admin retains the full archive.

## Flow

1. Customer selects final partner.
2. API creates or opens the booking chat room.
3. Partner starts service/work flow.
4. Customer and partner exchange messages.
5. Messages are stored as `ChatMessage` records.
6. Admin can view booking chat history for operations, cancellation, no-show, refund, and dispute decisions.

## Events

- `chat.message.created`
- `service.started`
- `service.completed`

## Admin Use

Admin should show chat as evidence and history, not as a customer or partner score.
