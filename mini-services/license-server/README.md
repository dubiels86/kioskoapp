# license-server

Central license authority for the KioskoApp. Issues Ed25519-signed floating
licenses, tracks per-device activations, receives heartbeats and silent
telemetry. Built as an independent Bun mini-service using only Bun built-ins
(`Bun.serve`, `bun:sqlite`, `node:crypto`).

## Run

```bash
cd /home/z/my-project/mini-services/license-server
bun install          # only dev deps (@types/bun) — runtime has zero deps
bun run dev          # starts with --hot reload on port 3042
```

The service listens on **port 3042 (hardcoded)**. The KioskoApp client
reaches it through the gateway via relative paths + the query param
`?XTransformPort=3042`.

## Files

```
mini-services/license-server/
├── index.ts          # all server logic
├── package.json      # scripts: dev (bun --hot), start
├── tsconfig.json
├── keys/
│   └── private.pem   # Ed25519 MASTER signing key — NEVER expose to clients
├── data.db           # SQLite DB (auto-created on first run)
└── README.md
```

The matching **public** key lives in the client app at
`src/lib/license-public-key.pem` — that's the only key that ships to clients.
They use it to verify that license payloads were issued by this server.

## Authentication

| Endpoint            | Auth                          |
| ------------------- | ----------------------------- |
| `/api/issue`        | Admin — `X-Admin-Key` header  |
| `/api/revoke`       | Admin — `X-Admin-Key` header  |
| `/api/unrevoke`     | Admin — `X-Admin-Key` header  |
| `/api/deactivate`   | Admin OR client (with token)  |
| `/api/licenses`     | Admin — header or `?key=`     |
| `/api/activate`     | Public (needs valid licenseId)|
| `/api/heartbeat`    | Public (needs activation token)|
| `/api/telemetry`    | Public (silent phone-home)    |
| `/api/health`       | Public                        |

The shared admin secret is the constant

```
ADMIN_API_KEY = "kiosko-admin-secret-2025"
```

defined at the top of `index.ts`. The KioskoApp super-admin panel uses the
same constant when calling the admin endpoints.

> ⚠️  **Rotate in production.** This is a known shared secret, fine for an
>     internal mini-service sitting behind the gateway in a trusted deployment.
>     For real production: move it to an env var / secret manager, rotate
>     periodically, and serve only over TLS.

## Endpoints

All endpoints accept/return JSON. Admin endpoints require the `X-Admin-Key`
header. `GET /api/licenses` alternatively accepts `?key=<ADMIN_API_KEY>`.

### `GET /api/health`
Public. Returns `{ ok: true, service: "license-server" }`.

### `POST /api/issue`  (admin)
**Body:** `{ customer, plan, expiresAt, maxDevices, features }`
- `plan`: `trial` | `pro` | `enterprise`
- `expiresAt`: ISO-8601
- `features`: string array (e.g. `["pos","inventory","repairs","multiwarehouse"]`)

**Returns (201):**
```json
{
  "ok": true,
  "license": { /* full signed payload, including `signature` */ },
  "licenseFileContent": "<pretty-printed JSON the admin can copy into license.lic>"
}
```

The signature is `crypto.sign(null, Buffer.from(canonicalJson), privateKey)`
over a **stable, key-sorted** canonical JSON of all payload fields except
`signature` (keys sorted alphabetically at every nesting level).

### `POST /api/activate`
**Body:** `{ licenseId, fingerprint, hostname }`

Logic:
1. Look up license. 404 if missing.
2. If `revoked` → `403 { status: "revoked" }`.
3. If `expiresAt < now` → `403 { status: "expired" }`.
4. If the fingerprint is already active → refresh `lastHeartbeat`, return
   the existing `activationToken` (idempotent re-activation).
5. If active device count ≥ `maxDevices` → `403 { status: "max_devices_reached", maxDevices, activeDevices, activations: [...] }`.
   The client must revoke an old device before trying again — the server
   will **not** silently evict an existing device. (Choosing rejection over
   silent eviction so a paying customer's device is never kicked off without
   an explicit admin action.)
6. Otherwise → create a new activation (`activationId`=uuid, `activationToken`=32-byte hex), return the full signed license payload + features + expiresAt.

### `POST /api/heartbeat`
**Body:** `{ licenseId, fingerprint, activationToken }`

Validates the triple against the DB. If the license has been revoked or
expired since the last heartbeat, the activation is marked inactive and the
appropriate status is returned so the client can lock itself:

- `200 { status: "active", features, expiresAt }`
- `403 { status: "revoked" }`
- `403 { status: "expired" }`
- `404 { status: "not_found" }`

### `POST /api/deactivate`
**Body:** `{ licenseId, fingerprint, activationToken? }`

Marks the matching activation as inactive. Admins (with `X-Admin-Key`) can
deactivate by `licenseId` + `fingerprint` alone; non-admins must include
their own `activationToken`. Returns `{ ok: true }`.

### `POST /api/revoke`  (admin)
**Body:** `{ licenseId }` — sets `revoked=1`. All subsequent heartbeats for
this license return `{ status: "revoked" }` and active activations are
marked inactive. Returns `{ ok: true }`.

### `POST /api/unrevoke`  (admin)
**Body:** `{ licenseId }` — clears the revoked flag. Returns `{ ok: true }`.

### `GET /api/licenses`  (admin)
Returns an array of all licenses (most-recent first), each with:
```json
{
  "licenseId": "...",
  "customer": "...",
  "plan": "pro",
  "issuedAt": "...",
  "expiresAt": "...",
  "maxDevices": 1,
  "features": ["pos", ...],
  "signature": "...",
  "revoked": false,
  "createdAt": "...",
  "activations": {
    "active": 1,
    "total": 2,
    "devices": [ { "activationId", "fingerprint", "hostname", "activatedAt", "lastHeartbeat", "active" }, ... ]
  }
}
```

### `POST /api/telemetry`
Public, silent phone-home. **Body:** `{ fingerprint, version, timestamp, licenseId? }`.
Stored in the `telemetry` table along with the request IP. Always returns
`200 { ok: true }`. Used for anonymous version tracking / pirate detection.

## Database schema

`data.db` (SQLite via `bun:sqlite`):

```sql
licenses(licenseId TEXT PRIMARY KEY, customer TEXT, plan TEXT,
         issuedAt TEXT, expiresAt TEXT, maxDevices INTEGER,
         features TEXT, signature TEXT, revoked INTEGER DEFAULT 0,
         createdAt TEXT)

activations(activationId TEXT PRIMARY KEY, licenseId TEXT,
            fingerprint TEXT, activationToken TEXT, hostname TEXT,
            activatedAt TEXT, lastHeartbeat TEXT, active INTEGER DEFAULT 1)

telemetry(id INTEGER PRIMARY KEY AUTOINCREMENT, fingerprint TEXT,
          version TEXT, timestamp TEXT, licenseId TEXT,
          ip TEXT, receivedAt TEXT)
```

## Floating-license semantics

A single `licenseId` may have up to `maxDevices` **distinct active
fingerprints** at the same time. Each device presents its hardware
fingerprint (SHA-256 of MAC + hostname + CPU info, computed client-side)
on activation. Re-activating with the same fingerprint is idempotent and
reuses the existing activation token. To free a slot, the client must call
`/api/deactivate` (or an admin can do it without a token).

## Security notes

- **`keys/private.pem` is the master signing key.** It MUST NOT be exposed
  to clients, shipped in client bundles, or committed to a public repo.
  Only this server needs it; clients only need the matching **public** key
  at `src/lib/license-public-key.pem` to verify signatures.
- The server is the source of truth: `/api/activate` and `/api/heartbeat`
  look up the license by `licenseId` in the local SQLite DB. The Ed25519
  signature is **only** for the *client* to verify that a license payload
  it received was actually issued by this server (defense against tampered
  `license.lic` files on disk).
- All admin endpoints require `X-Admin-Key`. The shared secret is hardcoded
  for simplicity — rotate it for production.
- CORS is permissive (`*`) because the client app at port 3000 calls this
  server at port 3042 cross-origin through the gateway.
- Every request is logged to stdout (`METHOD path -> status`); activation
  and heartbeat events include the last 8 chars of the licenseId/fingerprint
  for debugging without leaking full identifiers.
