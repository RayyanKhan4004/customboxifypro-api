# Quote communication and WhatsApp inbox

The existing `POST /api/v1/requests` and `POST /api/v1/requests/with-attachment` endpoints submit quotes. The response includes `{ id, status, quoteNumber, conversationId }`. The browser must retain a random `idempotencyKey` while retrying the same submission and generate a new key for a genuinely new quote. `whatsappOptIn` is separate from the required quote-contact consent. When it is true, `contact.phone` must be E.164 (for example `+15551692329`).

## Components

- `customer-requests`: quote persistence, stable reference, customer/conversation linkage, email and WhatsApp outbox records, in-app quote notification.
- `chats`: customer, conversation and message collections; admin chat API; signed Meta webhook; assigned-agent access checks.
- `jobs/notifications`: MongoDB delivery outbox. The timer claims pending records atomically every five seconds, applies a 60-second lease and bounded exponential retries. Expired leases and ambiguous network failures become `uncertain` to prevent blind resends. Administrators must inspect these before explicitly retrying.
- `in-app-notifications`: persistent quote and assigned-agent message notifications, with per-admin read state.
- `whatsapp`: Meta Cloud API transport. The Graph version is supplied by configuration. The API token stays on the backend.

When a quote opts in to WhatsApp but its phone number already belongs to a conversation under a different customer email, the quote remains unlinked (`conversationId: null`, `conversationSkipReason: phone_linked_to_different_customer`). Its receipt template is queued directly to the opted-in phone number without exposing or attaching the other customer's conversation. The outbox uses the same quote idempotency key, template approval check, and delivery handling as linked confirmations.

The outbox collection needs a unique index on `idempotencyKey` and an index on `{ status, nextAttemptAt, leaseUntil }`. Conversations need a unique index on `{ phoneNumberId, waId }`; messages need unique partial indexes for provider IDs and idempotency keys. Run `npm run db:indexes:communications` during deployment before enabling messaging. Production disables Mongoose `autoIndex`, so schema declarations alone are insufficient. Index creation may fail if existing data violates uniqueness; inspect and resolve duplicates before retrying.

MongoDB is required. Redis is not required for this feature. Set `REDIS_ENABLED=false`; with this value the existing BullMQ modules are not initialized. The outbox timer runs inside each API replica and coordinates through atomic MongoDB claims. Set `NOTIFICATION_DISPATCH_ENABLED=false` only if a separate API process is running the dispatcher. There is no separate worker entry point yet, so keep it enabled for production delivery.

## Environment

Set `EMAIL_ENABLED=true`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`, and `EMAIL_ADMIN_RECIPIENTS` to enable quote emails. `EMAIL_REPLY_TO` is optional. If email is disabled, quote submission still succeeds.

Set `WHATSAPP_ENABLED=true` only after supplying a current `WHATSAPP_GRAPH_API_VERSION`, a rotated `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_DEFAULT_TEMPLATE_LANGUAGE`, and `WHATSAPP_CONFIRMATION_TEMPLATE`. The template must be approved by Meta as a utility template with two body text parameters in this order: customer name and quote number. Configuring its name does not prove approval; verify it in WhatsApp Manager. Use the Meta test sender and approved development recipients first. Do not register or alter the production sender as part of local testing.

Keep `WHATSAPP_QUOTE_TEMPLATE_ENABLED=false` while `quote_received` is in review. New quote confirmations are stored as `blocked` in the outbox and chat history. After the template is approved in the *same configured WABA*, confirm its exact language code, set `WHATSAPP_CONFIRMATION_TEMPLATE=quote_received` and `WHATSAPP_DEFAULT_TEMPLATE_LANGUAGE` to that code, then enable the switch and restart. The dispatcher checks the WABA template status before sending; a non-approved or missing template is marked `blocked`. Previously blocked jobs are not released automatically. An administrator can retry a blocked template from Notification deliveries after the backend verifies that WhatsApp sending is enabled and the template is approved for its configured language. Rotate an expired token before retrying; a provider 401 prevents verification. Inspect uncertain deliveries separately because retrying them may send a duplicate. The template body already contains `#` before its second parameter, so the API passes `CB-...` without an extra `#`.

For a separate development connectivity test, set `WHATSAPP_TEST_RECIPIENT` to one E.164 number verified in Meta's test-recipient list and set `WHATSAPP_TEST_TEMPLATE_LANGUAGE` to the actual `hello_world` language in the test WABA. An administrator with `settings.manage` may explicitly call `POST /api/v1/admin/notification-deliveries/whatsapp-test/hello-world`. The endpoint refuses production mode, checks that `hello_world` is approved in the configured WABA, and enqueues a zero-parameter template through the MongoDB outbox. Do not call it with the previously exposed token; rotate the token first. A queued response is not proof of provider acceptance or delivery; inspect the outbox provider reference and subsequent status webhook.

The Admin Requests detail shows `conversationSkipReason` when a quote cannot link to a conversation: `sender_not_configured`, `phone_missing_or_invalid`, or `phone_linked_to_different_customer`. A successful quote response can therefore still have `conversationId: null`; this is not a delivery success. The earlier response could have been served by an older process, but this cannot be proven without the process and request logs.

The webhook callback is `https://<public-api-host>/api/v1/webhooks/whatsapp`. It must be reachable over HTTPS. Configure the same verify token in Meta and subscribe to the WhatsApp `messages` field. GET verification checks the token and returns the challenge; POST checks `X-Hub-Signature-256` against the original request body and app secret. The route does not use admin cookies.

For production email, verify the sender domain and configure the provider's SPF/DKIM records manually. No DNS changes are made by this application.

## Admin API

All paths below are under `/api/v1` and require the existing admin session unless identified as public.

| Route | Purpose | Permission |
| --- | --- | --- |
| `GET /admin/chats` | Paginated conversations, search and filters | `chats.read` |
| `GET /admin/chats/:id` | Conversation/customer detail | `chats.read` |
| `GET /admin/chats/:id/messages` | Cursor-paged history | `chats.read` |
| `POST /admin/chats/:id/messages` | Queue free-form text within the 24-hour window | `chats.reply` |
| `GET /admin/chats/:id/quotes` | Linked quote summaries | `chats.read` |
| `GET/POST /admin/chats/:id/notes` | Staff-only notes | `chats.read` / `chats.notes.create` |
| `PATCH /admin/chats/:id/assign` | Assign an active chat-capable admin | `chats.assign` |
| `PATCH /admin/chats/:id/status` | Open or resolve | `chats.manage` |
| `POST /admin/chats/:id/read` | Clear unread count | `chats.read` |
| `GET /admin/chats/templates/available` | Configured template names | `chats.read` |
| `POST /admin/chats/:id/send-template` | Queue the configured quote template | `chats.templates.send` |
| `GET /admin/chats/:id/messages/:messageId/attachment` | Authorized media download | `chats.read` |
| `GET /admin/notifications` | In-app notifications | authenticated admin |
| `POST /admin/notifications/:id/read` | Mark notification read for current admin | authenticated admin |
| `GET /admin/notification-deliveries/failed` | Failed/uncertain/blocked outbox entries | `settings.manage` |
| `POST /admin/notification-deliveries/whatsapp-test/hello-world` | Explicit development test to the configured recipient | `settings.manage` |
| `POST /admin/notification-deliveries/:id/retry` | Manual retry; blocked WhatsApp templates require an enabled provider and approved template | `settings.manage` |

The `chat-agent` role is created by `npm run db:seed`. It sees only assigned conversations. Run the seed after deployment to refresh the super-admin permission list and create the new role.

## Manual test with Meta's test sender

1. Rotate any token exposed outside secret storage, then set the new token only in the backend environment. Configure the test phone number ID and an approved recipient in Meta.
2. Approve the two-parameter utility template; set its exact name and language in the backend environment.
3. Deploy the API on HTTPS, enter the callback URL and verify token in Meta, and subscribe to `messages`.
4. Submit a quote with a new idempotency key, a test recipient in E.164 form, and explicit WhatsApp opt-in. Confirm the quote reference, customer, conversation, outbox entries, and Admin notification.
5. Wait for the dispatcher. Confirm Meta's provider message ID and status webhooks, and confirm the customer receives exactly one approved template.
6. Reply from the test recipient. Confirm the inbound message appears in `/chats`, the assigned agent receives a notification, and a free-form reply can be sent during the service window.
7. Replay the same webhook payload with the valid signature and confirm no duplicate message. Test an invalid signature and confirm rejection. Test an expired service window and confirm free-form sending is blocked.
8. Disable SMTP temporarily and confirm the quote still saves and the email delivery appears as failed or uncertain. Retry only after inspecting possible duplicate delivery.

Automated tests must mock the Meta and SMTP transports; never use a real recipient in a unit test.

## Current limitations

Meta template approval and actual delivery require external verification. This implementation does not install a PWA, provide browser push, sync email replies into the WhatsApp inbox, or persist WhatsApp attachments in R2. Attachments are downloaded on demand through a permission-checked API and are limited to supported MIME types and 16 MB. The webhook processes database writes before acknowledging; there is no separate durable webhook-event inbox. Production verification must measure the response time under expected webhook volume.
