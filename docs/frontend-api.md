# TourGuard frontend API contract

The API prefix is `/api/v1`. The frontend should use the deployed backend origin as `API_BASE_URL`.

## Authentication

Tourist routes use the secure token from the SMS link:

```http
Authorization: Bearer <tourist-access-token>
```

Operator routes use the configured operator key:

```http
X-Operator-Key: <operator-api-key>
```

Never log or persist the raw tourist token outside the secure session. Database IDs and raw access-token hashes are backend-only.

## Tourist experience

### Get the authenticated tourist context

```http
GET /tourists/context
Authorization: Bearer <token>
```

Returns only the authenticated tourist, their tour, and assigned guide:

```json
{
  "status": "ok",
  "data": {
    "name": "Demo Tourist",
    "phone": "+254712345678",
    "publicReference": "32-character-lowercase-hex-reference",
    "tour": {
      "name": "Nairobi City Tour",
      "description": "A guided city tour.",
      "meetingPoint": "Kenya National Archives",
      "startAt": "2026-12-01T08:00:00.000Z",
      "endAt": "2026-12-01T12:00:00.000Z",
      "guide": {
        "name": "Demo Guide",
        "phone": "+254700000001"
      }
    }
  }
}
```

### Get guide contact

The preferred frontend interaction is the agent chat endpoint below. The agent can call `getGuideContact` using the authenticated session token. The frontend must not call Prisma or expose database records directly.

### Create a LOST report

```http
POST /reports/lost
Authorization: Bearer <token>
Content-Type: application/json
```

Body fields are optional unless supplied:

```json
{
  "lat": -1.286389,
  "lng": 36.817223,
  "note": "Near the main entrance."
}
```

### Create a MISSING report

```http
POST /reports/missing
Authorization: Bearer <token>
Content-Type: application/json
```

The `missingTouristReference` must belong to the authenticated tourist's tour:

```json
{
  "missingTouristReference": "32-character-lowercase-hex-reference",
  "lat": -1.286389,
  "lng": 36.817223,
  "note": "Last seen near the entrance."
}
```

### Get report status

```http
GET /reports/status/:publicReference
Authorization: Bearer <token>
```

Only the report reporter can retrieve the status. A different tourist receives `404`.

## Agent chat

```http
POST /agent/chat
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{ "message": "Where is the meeting point?" }
```

Response:

```json
{ "message": "..." }
```

The assistant uses tools for current tour data and safety actions. Tool authorization is enforced by the backend; the model must not be trusted to authorize requests.

## Operator routes

### Create a guide

```http
POST /guides
X-Operator-Key: <operator-key>
```

```json
{ "name": "Demo Guide", "phone": "+254700000001" }
```

The response contains `publicReference`, not the database ID.

### Create a tour

```http
POST /tours
X-Operator-Key: <operator-key>
```

```json
{
  "name": "Nairobi City Tour",
  "description": "A guided city tour.",
  "meetingPoint": "Kenya National Archives",
  "startAt": "2026-12-01T08:00:00.000Z",
  "endAt": "2026-12-01T12:00:00.000Z",
  "guideReference": "32-character-lowercase-hex-reference"
}
```

`endAt` must be after `startAt`.

### Add a tourist

```http
POST /tourists
X-Operator-Key: <operator-key>
```

```json
{
  "name": "Demo Tourist",
  "phone": "+254712345678",
  "tourId": "operator-tour-id"
}
```

The response includes the secure link only for the creation/retry operation. SMS delivery is reported as `SENT` or `FAILED`; a failed SMS does not undo the database record.

### Retry a failed SMS

```http
POST /tourists/:publicReference/sms/retry
X-Operator-Key: <operator-key>
```

Retry is allowed only when the tourist SMS status is `FAILED`. Retrying rotates the access token, invalidating the previous link.

### Manage reports

```http
GET   /reports/tour/:tourId
PATCH /reports/:publicReference/acknowledge
PATCH /reports/:publicReference/resolve
X-Operator-Key: <operator-key>
```

Report lists and status responses expose `publicReference`, `type`, `status`, timestamps, and permitted report details. Tourists cannot access operator report lists or transitions.

## Common errors

Errors use NestJS HTTP status responses. The frontend should handle these without displaying raw provider or database details:

- `400` invalid input, invalid time range, malformed reference, or invalid state transition input.
- `401` missing/invalid bearer token or operator key.
- `404` unknown resource or a resource not authorized for the current tourist.
- `409` invalid report state transition or conflicting operation.
- `429` public endpoint rate limit exceeded.
- `503` SMS or Ollama provider unavailable.

Tourist-facing error messages intentionally avoid revealing whether another tourist, report, or token exists.
