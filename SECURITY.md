# Security

## Deployment

- Use a dedicated Chatwoot integration agent with access only to the required inboxes.
- Keep its API token server-side. Never use a `VITE_` variable for credentials.
- Serve the dashboard under the same HTTPS origin as Chatwoot. Preserve dashboard
  authentication headers through the reverse proxy; do not expose unauthenticated CRUD routes.
- Use a separate PostgreSQL database and strong credentials. Back it up securely:
  scheduled messages and creator/editor identities are sensitive conversation data.
- Keep environment files, browser profiles, logs, database exports, and TLS keys
  out of Git and container build contexts. Restrict credential-file permissions.
- Never cache `/later/api/` at a reverse proxy or CDN. Private API responses use
  `Cache-Control: private, no-store`, including authentication failures. Retain
  these headers and the cache bypass rules from the supplied nginx example.
- The dashboard discards loaded messages, drafts and dialogs on access denial,
  session changes, page hiding and restoration. Visible tabs revalidate access
  every 10 seconds; remote revocation is detected at the next request, not pushed
  instantly by Chatwoot. Late responses from previous scopes are ignored.
- Cancellation conditions are checked immediately before sending. A contact reply
  or status change racing with the send request cannot recall an already-sent message.
- Delivery markers reduce duplicate risk after interrupted requests; they are not
  an exactly-once guarantee across independent systems.

## Reporting a vulnerability

Do not put credentials, private messages, or exploitable vulnerability details in
public issues. Use the repository's private GitHub vulnerability reporting feature
when enabled. Otherwise, ask a maintainer for a private reporting channel without
including sensitive details. Rotate any credential that has been exposed.
