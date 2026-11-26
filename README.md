# TourGuard Assistant

TourGuard is a safety assistant for tourists on guided tours. A tourist receives a secure link by SMS and can use the web experience to view their tour details, contact their guide, report a safety incident, and check report status.

The repository contains a NestJS/Prisma backend and a React/Vite frontend.

## MVP capabilities

Tourists can:

- Open a secure, tokenized tourist link.
- View their tour name, description, meeting point, schedule, and guide contact.
- Call their assigned guide from the browser.
- Create a LOST report with an optional note.
- Create a MISSING report for another tourist on the same tour.
- Check the status of their own report.

Operators can use protected API routes to:

- Create guides and tours.
- Add tourists and generate secure assistant links.
- Retry failed SMS delivery.
- List, acknowledge, and resolve tour reports.

The backend also exposes an AI assistant endpoint backed by Ollama. Its tools are authorized by the backend and can retrieve tour context, guide contact, create reports, and retrieve report status.

## Architecture

- `src/` — NestJS API, Prisma services, reports, tourists, tours, guides, SMS, and agent tools.
- `frontend/` — React/Vite tourist experience.
- `prisma/` — PostgreSQL schema and migrations.
- `docs/frontend-api.md` — frontend API contract and authentication rules.
- `compose.yaml` — local PostgreSQL database.

The API is served under `/api/v1`.

Tourist requests use:

```http
Authorization: Bearer <raw-tourist-token>
```

Operator requests use:

```http
X-Operator-Key: <operator-api-key>
```

Raw tourist tokens are kept in the frontend session memory only. Do not commit `.env`, API keys, SMS credentials, or raw tourist links.

## Prerequisites

- Node.js and npm
- Docker, for local PostgreSQL
- `jq`, for the optional demo-data commands
- Ollama, if the AI assistant is being used locally

## Backend setup

Install dependencies and create local environment configuration:

```bash
npm install
cp .env.example .env
```

Set a local operator key in `.env`. Keep values containing `$` in single quotes when exporting them in a shell.

Start PostgreSQL:

```bash
docker compose up -d db
```

Apply migrations:

```bash
npm run db:migrate
```

Start the backend on port `3004`:

```bash
npm run start:dev
```

The API is available at `http://localhost:3004/api/v1`.

## Frontend setup

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend normally runs at `http://localhost:5173`. During local development, Vite proxies `/api` requests to the backend on port `3004`.

Open the root page to see the public shell. A tourist page is opened at:

```text
http://localhost:5173/tourist/<raw-tourist-token>
```

For generated links to use the frontend origin, set this backend value:

```env
TOURIST_ASSISTANT_BASE_URL=http://localhost:5173
```

## Creating a local demo tourist

The SMS service can be unavailable during local development. The operator API still returns the secure link, so a demo tourist can be created without receiving an SMS.

First, make sure the backend is running and enter the configured operator key without exposing it in shell history:

```bash
read -r -s -p "Operator key: " OPERATOR_API_KEY
echo
export OPERATOR_API_KEY
```

Then create a guide, tour, and tourist. The commands below require `jq`:

```bash
STAMP=$(date +%s | tail -c 7)

GUIDE=$(curl -sS -X POST http://localhost:3004/api/v1/guides \
  -H "X-Operator-Key: $OPERATOR_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Demo Guide $STAMP\",\"phone\":\"+2547${STAMP}01\"}")

GUIDE_REFERENCE=$(echo "$GUIDE" | jq -r '.data.publicReference')

TOUR=$(curl -sS -X POST http://localhost:3004/api/v1/tours \
  -H "X-Operator-Key: $OPERATOR_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Nairobi City Tour $STAMP\",\"description\":\"A guided city tour.\",\"meetingPoint\":\"Kenya National Archives\",\"startAt\":\"2026-12-01T08:00:00.000Z\",\"endAt\":\"2026-12-01T12:00:00.000Z\",\"guideReference\":\"$GUIDE_REFERENCE\"}")

TOUR_ID=$(echo "$TOUR" | jq -r '.data.id')

TOURIST=$(curl -sS -X POST http://localhost:3004/api/v1/tourists \
  -H "X-Operator-Key: $OPERATOR_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Demo Tourist $STAMP\",\"phone\":\"+2547${STAMP}02\",\"tourId\":\"$TOUR_ID\"}")

echo "$TOURIST" | jq
echo "$TOURIST" | jq -r '.data.secureLink'
```

Open the printed `secureLink` in a browser. If SMS is not configured, `smsStatus` may be `FAILED`; this does not prevent local testing.

## Testing and builds

Backend tests:

```bash
npm test
npm run build
```

Frontend tests and build:

```bash
cd frontend
npm test
npm run build
```

Integration and end-to-end tests use the configured test database:

```bash
npm run db:migrate:test
npm run test:integration
npm run test:e2e
```

## API documentation

See [docs/frontend-api.md](docs/frontend-api.md) for endpoint shapes, authentication rules, permitted data, report transitions, and frontend error handling.
