# Later for Chatwoot

Later is an embedded Chatwoot dashboard app for scheduling text replies. For the current conversation, agents can create, edit, reschedule, and delete pending replies and inspect messages that exhausted their delivery retries.

Later follows the same integration and visual approach as [Crate](https://github.com/stoparmy/crate): it runs on the Chatwoot origin, receives the active conversation through the dashboard-app `postMessage` contract, and authenticates browser requests with the current Chatwoot dashboard session.

## Behavior

- Text replies only.
- Times are entered in the agent's browser timezone and stored as UTC.
- Any agent who can access a conversation can manage its pending or failed messages.
- Each message can be cancelled automatically if the contact replies after it was scheduled.
- Each message can be cancelled automatically if the conversation is not `open` at send time.
- Sent and cancelled rows are retained for audit but are not shown in the dashboard.
- Transient Chatwoot failures use bounded exponential retries; exhausted or permanent failures appear in the dashboard and can be rescheduled.
- Later adds `content_attributes.later_message_id` to sent Chatwoot messages. A worker reclaiming an interrupted job checks this marker before sending, reducing duplicate delivery after an ambiguous HTTP failure.

Chatwoot does not currently expose native scheduled messages. At the due time, Later creates a normal outgoing message through Chatwoot's application API using the configured service-account token. Chatwoot attributes the reply to that service account; Later retains the scheduling and editing agent names in its own database.

## Architecture

The published artifact is one Docker image with two process roles:

- `later`: Express API, compiled React dashboard, authenticated CRUD endpoints, and database migrations.
- `worker`: PostgreSQL-backed scheduler using atomic `FOR UPDATE SKIP LOCKED` claims and crash-safe leases.

Later uses its own PostgreSQL database. Do not point `DATABASE_URL` at the Chatwoot application database.

## Configuration

Copy `.env.example` to `.env` and set:

- `CHATWOOT_BASE_URL`: public Chatwoot origin, for example `https://helpdesk.example.org`.
- `CHATWOOT_APP_TOKEN`: API access token for the dedicated Later service account.
- `DATABASE_URL`: PostgreSQL connection URL when running outside the included Compose stack.
- `PORT`: web process port, default `3000`.
- `LATER_PUBLIC_BASE_PATH`: build-time dashboard path, such as `/later/`; defaults to relative assets.
- `LATER_WORKER_POLL_INTERVAL_MS`: idle polling interval, default `5000`.
- `LATER_WORKER_LEASE_MS`: interrupted-job lease, default `60000`.
- `LATER_WORKER_MAX_ATTEMPTS`: maximum automatic attempts, default `5`.
- `LATER_CHATWOOT_REQUEST_TIMEOUT_MS`: timeout for each Chatwoot API request, default `15000`.

Set a strong `POSTGRES_PASSWORD` for the included database. Compose requires it;
use URL-safe characters (for example, a generated hexadecimal password) because
the value is also used in the database URL.

## Run with Docker Compose

Published images are available at `ghcr.io/stoparmy/later` for AMD64 and ARM64:

```bash
docker pull ghcr.io/stoparmy/later:latest
```

Use a fixed version tag for repeatable deployments. The same image runs the web
app with its default command and the scheduler with `node dist/worker/index.js`.
Both processes need the configuration below and access to the same database.
The included Compose file builds the image from source:

```bash
cp .env.example .env
docker compose up --build
```


The web health endpoint checks database readiness:

```text
GET /api/health
```

## Install as a Chatwoot dashboard app

1. Proxy Later under a same-origin path such as `/later/`. An nginx example is available in `examples/nginx/chatwoot-later.conf`.
2. Build with `LATER_PUBLIC_BASE_PATH=/later/` if you want an absolute asset base; the default relative build also supports a fixed slug.
3. In Chatwoot, create a dashboard app whose URL is `https://helpdesk.example.org/later/`.
4. Open a conversation and select Later from the dashboard apps panel.

The `/later` to `/later/` redirect is important so browser-relative assets and API paths resolve beneath the selected slug.

## Development with Chatwoot

Use a separate local Chatwoot instance and integration agent. Proxy both services
under the same HTTPS origin using the nginx example above, register the dashboard
app, and supply the integration token through an ignored environment file.
Keep credentials, TLS keys, database volumes, browser sessions, and captured
conversation data outside the repository. The dashboard requires a real Chatwoot
session; it has no standalone authentication bypass or sample-message store.

## Local verification

```bash
npm install
npm --prefix server install
npm --prefix web install
npm test
npm run build
npm run check:publication
docker compose config --quiet
docker build -t later:local .
```

## Releases

Before the first push, run `npm run check:publication`. It checks the Git publication
file set for credentials, private workstation configuration, and captured data.
It also checks for values from local environment files without printing them.
This is a precaution, not a substitute for reviewing the files before publishing.
See [SECURITY.md](SECURITY.md) for deployment and disclosure guidance.

The GitHub Actions workflow uses semantic-release and publishes `ghcr.io/<owner>/<repository>` for `linux/amd64` and `linux/arm64`.

- `fix:` creates a patch release.
- `feat:` creates a minor release.
- `BREAKING CHANGE:` or `!` creates a major release.
- `main` publishes semver tags and `latest`.
- `beta` publishes prerelease semver tags and `beta` without changing `latest`.

## License

MIT
