/**
 * license-server — central license authority for KioskoApp
 *
 * Independent Bun mini-service. Issues Ed25519-signed floating licenses,
 * tracks per-device activations, receives heartbeats and silent telemetry.
 *
 * Port: 3042 (hardcoded by design — the KioskoApp client gateway maps
 * `?XTransformPort=3042` to this port).
 *
 * Signing key: keys/private.pem  (Ed25519, MUST NEVER be shipped to clients)
 * Verifying key: src/lib/license-public-key.pem  (embedded in the client app)
 */

import { Database } from "bun:sqlite";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PORT = 3042;

/**
 * Shared admin secret. The KioskoApp super-admin panel uses this same constant
 * when calling admin endpoints (issue / revoke / list / unrevoke).
 *
 * ⚠️  This is a KNOWN shared secret — fine for an internal mini-service sitting
 *     behind the gateway in a trusted deployment, but in production you MUST:
 *       1. Move it to an env var / secret manager.
 *       2. Rotate it periodically.
 *       3. Serve only over TLS.
 */
const ADMIN_API_KEY = "kiosko-admin-secret-2025";

const KEYS_DIR = path.resolve(import.meta.dir, "keys");
const PRIVATE_KEY_PATH = path.join(KEYS_DIR, "private.pem");
const PUBLIC_KEY_PATH = path.join(KEYS_DIR, "public.pem");
/**
 * Path where the KioskoApp CLIENT expects the public key
 * (`<repo-root>/src/lib/license-public-key.pem`). Resolved relative to this
 * mini-service so it works whether the repo is run from source or from the
 * standalone build.
 */
const CLIENT_PUBLIC_KEY_PATHS = [
  path.resolve(import.meta.dir, "../../src/lib/license-public-key.pem"),
  path.resolve(process.cwd(), "src/lib/license-public-key.pem"),
];
const DB_PATH = path.resolve(import.meta.dir, "data.db");

/**
 * Ensure an Ed25519 keypair exists at startup. If `keys/private.pem` is
 * missing (e.g. on a fresh `git clone`), generate a new keypair, write the
 * private key to `keys/private.pem` (0600) and the public key to BOTH
 * `keys/public.pem` and `src/lib/license-public-key.pem` (so the client app
 * can verify licenses signed by this server).
 *
 * This makes the system self-bootstrapping on a new machine: just start the
 * license-server and the keys are created automatically.
 */
function ensureKeypair(): void {
  if (fs.existsSync(PRIVATE_KEY_PATH)) {
    // Keypair already present. Make sure the client-side public key file also
    // exists (it might have been deleted or never copied on a fresh clone).
    if (!fs.existsSync(PUBLIC_KEY_PATH)) {
      // Re-export the public key from the existing private key.
      const priv = crypto.createPrivateKey(fs.readFileSync(PRIVATE_KEY_PATH, "utf8"));
      const pubPem = crypto.createPublicKey(priv).export({ type: "spki", format: "pem" });
      fs.writeFileSync(PUBLIC_KEY_PATH, pubPem, { mode: 0o644 });
    }
    syncClientPublicKey();
    return;
  }

  fs.mkdirSync(KEYS_DIR, { recursive: true });
  console.log("[keys] No Ed25519 keypair found. Generating a new one...");

  // Generate Ed25519 keypair.
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");

  const privPem = privateKey.export({ type: "pkcs8", format: "pem" });
  const pubPem = publicKey.export({ type: "spki", format: "pem" });

  fs.writeFileSync(PRIVATE_KEY_PATH, privPem, { mode: 0o600 });
  fs.writeFileSync(PUBLIC_KEY_PATH, pubPem, { mode: 0o644 });

  console.log(`[keys] Private key written to ${PRIVATE_KEY_PATH}`);
  console.log(`[keys] Public key  written to ${PUBLIC_KEY_PATH}`);

  syncClientPublicKey();
}

/**
 * Copy `keys/public.pem` → `src/lib/license-public-key.pem` so the KioskoApp
 * client can verify licenses signed by this server. No-op if the source is
 * missing. Writes to every candidate path that exists or can be created.
 */
function syncClientPublicKey(): void {
  if (!fs.existsSync(PUBLIC_KEY_PATH)) return;
  const pubPem = fs.readFileSync(PUBLIC_KEY_PATH, "utf8");
  for (const candidate of CLIENT_PUBLIC_KEY_PATHS) {
    try {
      // Only write if the directory exists (don't create arbitrary dirs).
      const dir = path.dirname(candidate);
      if (fs.existsSync(dir)) {
        // Skip if the file already has the exact same content (avoid touching
        // mtime on every boot).
        if (fs.existsSync(candidate)) {
          const current = fs.readFileSync(candidate, "utf8");
          if (current === pubPem) continue;
        }
        fs.writeFileSync(candidate, pubPem, { mode: 0o644 });
        console.log(`[keys] Synced public key → ${candidate}`);
      }
    } catch (err) {
      console.warn(`[keys] Could not sync public key to ${candidate}:`, err);
    }
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Plan = "trial" | "pro" | "enterprise";

interface LicenseRow {
  licenseId: string;
  customer: string;
  plan: Plan;
  issuedAt: string;
  expiresAt: string;
  maxDevices: number;
  features: string; // JSON-encoded array
  signature: string;
  revoked: number;
  createdAt: string;
}

interface ActivationRow {
  activationId: string;
  licenseId: string;
  fingerprint: string;
  activationToken: string;
  hostname: string;
  activatedAt: string;
  lastHeartbeat: string;
  active: number;
}

interface TelemetryRow {
  id: number;
  fingerprint: string;
  version: string;
  timestamp: string;
  licenseId: string | null;
  ip: string;
  receivedAt: string;
}

interface LicensePayload {
  licenseId: string;
  customer: string;
  plan: Plan;
  issuedAt: string;
  expiresAt: string;
  maxDevices: number;
  features: string[];
  signature: string;
}

// ---------------------------------------------------------------------------
// Canonical JSON signing helper
// ---------------------------------------------------------------------------

/**
 * Stable JSON stringify: keys are sorted alphabetically at every nesting level.
 * Arrays keep their element order (sorting arrays would corrupt data like
 * `features`). Used to produce a deterministic canonical form before signing.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(stableStringify).join(",") + "]";
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return (
    "{" +
    keys
      .map(
        (k) =>
          JSON.stringify(k) +
          ":" +
          stableStringify((value as Record<string, unknown>)[k]),
      )
      .join(",") +
    "}"
  );
}

/** Build the unsigned canonical-JSON form of a license payload. */
function canonicalLicenseForm(fields: Omit<LicensePayload, "signature">): string {
  return stableStringify(fields);
}

// ---------------------------------------------------------------------------
// Signing
// ---------------------------------------------------------------------------

// Bootstrap the keypair on first run, then load the private key for signing.
ensureKeypair();
const privateKey = crypto.createPrivateKey(
  fs.readFileSync(PRIVATE_KEY_PATH, "utf8"),
);

if (privateKey.asymmetricKeyType !== "ed25519") {
  throw new Error(
    `Expected Ed25519 private key, got ${privateKey.asymmetricKeyType}`,
  );
}

/** Sign canonical JSON with the server's Ed25519 private key → base64. */
function signLicense(fields: Omit<LicensePayload, "signature">): string {
  const canonical = canonicalLicenseForm(fields);
  const sig = crypto.sign(null, Buffer.from(canonical, "utf8"), privateKey);
  return sig.toString("base64");
}

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

const db = new Database(DB_PATH, { create: true });
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
  CREATE TABLE IF NOT EXISTS licenses (
    licenseId  TEXT PRIMARY KEY,
    customer   TEXT NOT NULL,
    plan       TEXT NOT NULL,
    issuedAt   TEXT NOT NULL,
    expiresAt  TEXT NOT NULL,
    maxDevices INTEGER NOT NULL,
    features   TEXT NOT NULL,            -- JSON-encoded array
    signature  TEXT NOT NULL,
    revoked    INTEGER NOT NULL DEFAULT 0,
    createdAt  TEXT NOT NULL
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS activations (
    activationId     TEXT PRIMARY KEY,
    licenseId        TEXT NOT NULL,
    fingerprint      TEXT NOT NULL,
    activationToken  TEXT NOT NULL,
    hostname         TEXT,
    activatedAt      TEXT NOT NULL,
    lastHeartbeat    TEXT NOT NULL,
    active           INTEGER NOT NULL DEFAULT 1
  );
  CREATE INDEX IF NOT EXISTS idx_activations_license
    ON activations(licenseId);
  CREATE INDEX IF NOT EXISTS idx_activations_token
    ON activations(activationToken);
  CREATE INDEX IF NOT EXISTS idx_activations_license_fp_active
    ON activations(licenseId, fingerprint, active);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS telemetry (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    fingerprint TEXT,
    version     TEXT,
    timestamp   TEXT,
    licenseId   TEXT,
    ip          TEXT,
    receivedAt  TEXT NOT NULL
  );
`);

// Prepared statements ------------------------------------------------------

const stmtInsertLicense = db.prepare<
  unknown,
  {
    $licenseId: string;
    $customer: string;
    $plan: string;
    $issuedAt: string;
    $expiresAt: string;
    $maxDevices: number;
    $features: string;
    $signature: string;
    $revoked: number;
    $createdAt: string;
  }
>(`INSERT INTO licenses
   (licenseId, customer, plan, issuedAt, expiresAt, maxDevices, features, signature, revoked, createdAt)
   VALUES ($licenseId, $customer, $plan, $issuedAt, $expiresAt, $maxDevices, $features, $signature, $revoked, $createdAt)`);

const stmtGetLicense = db.prepare<LicenseRow, { $licenseId: string }>(
  `SELECT * FROM licenses WHERE licenseId = $licenseId`,
);

const stmtListLicenses = db.prepare<LicenseRow, unknown>(
  `SELECT * FROM licenses ORDER BY createdAt DESC`,
);

const stmtSetRevoked = db.prepare<
  unknown,
  { $revoked: number; $licenseId: string }
>(`UPDATE licenses SET revoked = $revoked WHERE licenseId = $licenseId`);

const stmtGetActivationByToken = db.prepare<
  ActivationRow,
  { $activationToken: string }
>(`SELECT * FROM activations WHERE activationToken = $activationToken`);

const stmtGetActiveActivationByFingerprint = db.prepare<
  ActivationRow,
  { $licenseId: string; $fingerprint: string; $active: number }
>(
  `SELECT * FROM activations
   WHERE licenseId = $licenseId AND fingerprint = $fingerprint AND active = $active
   LIMIT 1`,
);

const stmtListActiveActivations = db.prepare<
  ActivationRow,
  { $licenseId: string; $active: number }
>(
  `SELECT * FROM activations
   WHERE licenseId = $licenseId AND active = $active
   ORDER BY activatedAt ASC`,
);

const stmtListAllActivations = db.prepare<
  ActivationRow,
  { $licenseId: string }
>(`SELECT * FROM activations WHERE licenseId = $licenseId ORDER BY activatedAt DESC`);

const stmtInsertActivation = db.prepare<
  unknown,
  {
    $activationId: string;
    $licenseId: string;
    $fingerprint: string;
    $activationToken: string;
    $hostname: string;
    $activatedAt: string;
    $lastHeartbeat: string;
    $active: number;
  }
>(`INSERT INTO activations
   (activationId, licenseId, fingerprint, activationToken, hostname, activatedAt, lastHeartbeat, active)
   VALUES ($activationId, $licenseId, $fingerprint, $activationToken, $hostname, $activatedAt, $lastHeartbeat, $active)`);

const stmtTouchHeartbeat = db.prepare<
  unknown,
  { $lastHeartbeat: string; $activationToken: string }
>(`UPDATE activations SET lastHeartbeat = $lastHeartbeat WHERE activationToken = $activationToken`);

const stmtDeactivateByToken = db.prepare<
  unknown,
  { $activationToken: string; $licenseId: string; $fingerprint: string }
>(
  `UPDATE activations SET active = 0
   WHERE activationToken = $activationToken
     AND licenseId = $licenseId
     AND fingerprint = $fingerprint`,
);

const stmtDeactivateByFingerprint = db.prepare<
  unknown,
  { $licenseId: string; $fingerprint: string }
>(
  `UPDATE activations SET active = 0
   WHERE licenseId = $licenseId AND fingerprint = $fingerprint`,
);

const stmtInsertTelemetry = db.prepare<
  unknown,
  {
    $fingerprint: string;
    $version: string;
    $timestamp: string;
    $licenseId: string | null;
    $ip: string;
    $receivedAt: string;
  }
>(`INSERT INTO telemetry (fingerprint, version, timestamp, licenseId, ip, receivedAt)
   VALUES ($fingerprint, $version, $timestamp, $licenseId, $ip, $receivedAt)`);

// ---------------------------------------------------------------------------
// Row → payload helpers
// ---------------------------------------------------------------------------

function rowToPayload(row: LicenseRow): LicensePayload {
  return {
    licenseId: row.licenseId,
    customer: row.customer,
    plan: row.plan as Plan,
    issuedAt: row.issuedAt,
    expiresAt: row.expiresAt,
    maxDevices: row.maxDevices,
    features: JSON.parse(row.features) as string[],
    signature: row.signature,
  };
}

function activationRowToPublic(
  row: ActivationRow,
): {
  activationId: string;
  fingerprint: string;
  hostname: string | null;
  activatedAt: string;
  lastHeartbeat: string;
  active: boolean;
} {
  return {
    activationId: row.activationId,
    fingerprint: row.fingerprint,
    hostname: row.hostname,
    activatedAt: row.activatedAt,
    lastHeartbeat: row.lastHeartbeat,
    active: row.active === 1,
  };
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Admin-Key",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...CORS_HEADERS,
    },
  });
}

function err(message: string, status: number, extra: Record<string, unknown> = {}): Response {
  return json({ error: message, ...extra }, status);
}

async function readJson(req: Request): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new HttpError(400, "invalid_json", "Request body is not valid JSON.");
  }
}

class HttpError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function isAdmin(req: Request): boolean {
  return req.headers.get("X-Admin-Key") === ADMIN_API_KEY;
}

function requireAdmin(req: Request): void {
  if (!isAdmin(req)) {
    throw new HttpError(401, "admin_key_required", "Missing or invalid X-Admin-Key header.");
  }
}

function logRequest(method: string, pathname: string, status: number): void {
  console.log(`${new Date().toISOString()}  ${method} ${pathname} -> ${status}`);
}

function shortId(id: string): string {
  return id.length <= 8 ? id : id.slice(-8);
}

// ---------------------------------------------------------------------------
// Endpoint handlers
// ---------------------------------------------------------------------------

// POST /api/issue ---------------------------------------------------------
async function handleIssue(req: Request): Promise<Response> {
  requireAdmin(req);
  const body = await readJson(req);

  const customer = String(body.customer ?? "").trim();
  const plan = String(body.plan ?? "trial") as Plan;
  const expiresAt = String(body.expiresAt ?? "").trim();
  const maxDevices = Number(body.maxDevices ?? 1);
  const features = Array.isArray(body.features)
    ? (body.features as unknown[]).map(String)
    : [];

  if (!customer) throw new HttpError(400, "missing_customer", "`customer` is required.");
  if (!["trial", "pro", "enterprise"].includes(plan))
    throw new HttpError(400, "invalid_plan", "`plan` must be trial|pro|enterprise.");
  if (!expiresAt) throw new HttpError(400, "missing_expiresAt", "`expiresAt` is required (ISO-8601).");
  if (!Number.isFinite(maxDevices) || maxDevices < 1)
    throw new HttpError(400, "invalid_maxDevices", "`maxDevices` must be a positive integer.");
  // Sanity-check expiresAt parses as a date.
  if (Number.isNaN(Date.parse(expiresAt)))
    throw new HttpError(400, "invalid_expiresAt", "`expiresAt` must be ISO-8601.");

  const licenseId = crypto.randomUUID();
  const issuedAt = new Date().toISOString();
  const createdAt = issuedAt;

  const fields: Omit<LicensePayload, "signature"> = {
    licenseId,
    customer,
    plan,
    issuedAt,
    expiresAt,
    maxDevices,
    features,
  };
  const signature = signLicense(fields);
  const payload: LicensePayload = { ...fields, signature };

  stmtInsertLicense.run({
    $licenseId: licenseId,
    $customer: customer,
    $plan: plan,
    $issuedAt: issuedAt,
    $expiresAt: expiresAt,
    $maxDevices: maxDevices,
    $features: JSON.stringify(features),
    $signature: signature,
    $revoked: 0,
    $createdAt: createdAt,
  });

  console.log(`[issue] license ${shortId(licenseId)} issued for "${customer}" (${plan})`);

  // Pretty-printed license.lic content the admin can copy into a file.
  const licenseFileContent = JSON.stringify(payload, null, 2);

  return json(
    {
      ok: true,
      license: payload,
      licenseFileContent,
    },
    201,
  );
}

// POST /api/activate ------------------------------------------------------
async function handleActivate(req: Request): Promise<Response> {
  const body = await readJson(req);
  const licenseId = String(body.licenseId ?? "").trim();
  const fingerprint = String(body.fingerprint ?? "").trim();
  const hostname = body.hostname !== undefined && body.hostname !== null
    ? String(body.hostname)
    : null;

  if (!licenseId) throw new HttpError(400, "missing_licenseId", "`licenseId` is required.");
  if (!fingerprint) throw new HttpError(400, "missing_fingerprint", "`fingerprint` is required.");

  const license = stmtGetLicense.get({ $licenseId: licenseId });
  if (!license) throw new HttpError(404, "license_not_found", "License not found.");
  if (license.revoked === 1)
    return json({ status: "revoked" }, 403);
  if (new Date(license.expiresAt).getTime() < Date.now())
    return json({ status: "expired" }, 403);

  // Existing active activation for this fingerprint → refresh heartbeat, reuse token.
  const existing = stmtGetActiveActivationByFingerprint.get({
    $licenseId: licenseId,
    $fingerprint: fingerprint,
    $active: 1,
  });
  if (existing) {
    const now = new Date().toISOString();
    stmtTouchHeartbeat.run({ $lastHeartbeat: now, $activationToken: existing.activationToken });
    console.log(
      `[activate] license ${shortId(licenseId)} fp ${shortId(fingerprint)} re-activated (token reused)`,
    );
    return json({
      status: "active",
      activationToken: existing.activationToken,
      license: rowToPayload(license),
      features: JSON.parse(license.features) as string[],
      expiresAt: license.expiresAt,
    });
  }

  // New fingerprint — check the device cap.
  const activeActivations = stmtListActiveActivations.all({
    $licenseId: licenseId,
    $active: 1,
  });
  if (activeActivations.length >= license.maxDevices) {
    // REJECT: client must revoke an old device first.
    // We return the current activations so the admin/user can pick one to revoke.
    console.log(
      `[activate] license ${shortId(licenseId)} DENIED max_devices_reached (${activeActivations.length}/${license.maxDevices})`,
    );
    return json(
      {
        status: "max_devices_reached",
        maxDevices: license.maxDevices,
        activeDevices: activeActivations.length,
        activations: activeActivations.map(activationRowToPublic),
      },
      403,
    );
  }

  // Create the new activation.
  const now = new Date().toISOString();
  const activationId = crypto.randomUUID();
  const activationToken = crypto.randomBytes(32).toString("hex");
  stmtInsertActivation.run({
    $activationId: activationId,
    $licenseId: licenseId,
    $fingerprint: fingerprint,
    $activationToken: activationToken,
    $hostname: hostname,
    $activatedAt: now,
    $lastHeartbeat: now,
    $active: 1,
  });

  console.log(
    `[activate] license ${shortId(licenseId)} fp ${shortId(fingerprint)} activated (${activeActivations.length + 1}/${license.maxDevices})`,
  );

  return json(
    {
      status: "active",
      activationToken,
      license: rowToPayload(license),
      features: JSON.parse(license.features) as string[],
      expiresAt: license.expiresAt,
    },
    201,
  );
}

// POST /api/heartbeat ------------------------------------------------------
async function handleHeartbeat(req: Request): Promise<Response> {
  const body = await readJson(req);
  const licenseId = String(body.licenseId ?? "").trim();
  const fingerprint = String(body.fingerprint ?? "").trim();
  const activationToken = String(body.activationToken ?? "").trim();

  if (!licenseId || !fingerprint || !activationToken)
    throw new HttpError(400, "missing_fields", "`licenseId`, `fingerprint` and `activationToken` are required.");

  const activation = stmtGetActivationByToken.get({ $activationToken: activationToken });
  if (!activation || activation.licenseId !== licenseId || activation.fingerprint !== fingerprint || activation.active !== 1)
    return json({ status: "not_found" }, 404);

  const license = stmtGetLicense.get({ $licenseId: licenseId });
  if (!license) return json({ status: "not_found" }, 404);
  if (license.revoked === 1) {
    // Auto-deactivate so the slot is freed for someone else.
    stmtDeactivateByToken.run({
      $activationToken: activationToken,
      $licenseId: licenseId,
      $fingerprint: fingerprint,
    });
    console.log(`[heartbeat] license ${shortId(licenseId)} REVOKED — deactivating fp ${shortId(fingerprint)}`);
    return json({ status: "revoked" }, 403);
  }
  if (new Date(license.expiresAt).getTime() < Date.now()) {
    stmtDeactivateByToken.run({
      $activationToken: activationToken,
      $licenseId: licenseId,
      $fingerprint: fingerprint,
    });
    console.log(`[heartbeat] license ${shortId(licenseId)} EXPIRED — deactivating fp ${shortId(fingerprint)}`);
    return json({ status: "expired" }, 403);
  }

  const now = new Date().toISOString();
  stmtTouchHeartbeat.run({ $lastHeartbeat: now, $activationToken: activationToken });

  return json({
    status: "active",
    features: JSON.parse(license.features) as string[],
    expiresAt: license.expiresAt,
  });
}

// POST /api/deactivate -----------------------------------------------------
async function handleDeactivate(req: Request): Promise<Response> {
  const body = await readJson(req);
  const licenseId = String(body.licenseId ?? "").trim();
  const fingerprint = String(body.fingerprint ?? "").trim();
  const activationToken =
    body.activationToken !== undefined && body.activationToken !== null
      ? String(body.activationToken).trim()
      : "";

  if (!licenseId || !fingerprint)
    throw new HttpError(400, "missing_fields", "`licenseId` and `fingerprint` are required.");

  // Admin can deactivate without a token. Client must supply their own token.
  if (!isAdmin(req) && !activationToken) {
    throw new HttpError(
      400,
      "missing_token",
      "Non-admin requests must include `activationToken`.",
    );
  }

  if (activationToken) {
    const activation = stmtGetActivationByToken.get({ $activationToken: activationToken });
    if (
      !activation ||
      activation.licenseId !== licenseId ||
      activation.fingerprint !== fingerprint
    ) {
      return err("activation_not_found", 404);
    }
    stmtDeactivateByToken.run({
      $activationToken: activationToken,
      $licenseId: licenseId,
      $fingerprint: fingerprint,
    });
  } else {
    // Admin path: deactivate by fingerprint only.
    stmtDeactivateByFingerprint.run({ $licenseId: licenseId, $fingerprint: fingerprint });
  }

  console.log(
    `[deactivate] license ${shortId(licenseId)} fp ${shortId(fingerprint)} deactivated${isAdmin(req) ? " (admin)" : ""}`,
  );
  return json({ ok: true });
}

// POST /api/revoke ---------------------------------------------------------
async function handleRevoke(req: Request): Promise<Response> {
  requireAdmin(req);
  const body = await readJson(req);
  const licenseId = String(body.licenseId ?? "").trim();
  if (!licenseId) throw new HttpError(400, "missing_licenseId", "`licenseId` is required.");

  const license = stmtGetLicense.get({ $licenseId: licenseId });
  if (!license) throw new HttpError(404, "license_not_found", "License not found.");

  stmtSetRevoked.run({ $revoked: 1, $licenseId: licenseId });
  console.log(`[revoke] license ${shortId(licenseId)} revoked`);
  return json({ ok: true });
}

// POST /api/unrevoke -------------------------------------------------------
async function handleUnrevoke(req: Request): Promise<Response> {
  requireAdmin(req);
  const body = await readJson(req);
  const licenseId = String(body.licenseId ?? "").trim();
  if (!licenseId) throw new HttpError(400, "missing_licenseId", "`licenseId` is required.");

  const license = stmtGetLicense.get({ $licenseId: licenseId });
  if (!license) throw new HttpError(404, "license_not_found", "License not found.");

  stmtSetRevoked.run({ $revoked: 0, $licenseId: licenseId });
  console.log(`[unrevoke] license ${shortId(licenseId)} un-revoked`);
  return json({ ok: true });
}

// GET /api/licenses --------------------------------------------------------
async function handleListLicenses(req: Request, url: URL): Promise<Response> {
  // Auth via header OR ?key= query param (so admins can open the URL in a browser).
  const queryKey = url.searchParams.get("key");
  if (queryKey !== ADMIN_API_KEY) requireAdmin(req);

  const licenses = stmtListLicenses.all();
  const result = licenses.map((row) => {
    const activations = stmtListAllActivations.all({ $licenseId: row.licenseId });
    const activeCount = activations.filter((a) => a.active === 1).length;
    return {
      ...rowToPayload(row),
      revoked: row.revoked === 1,
      createdAt: row.createdAt,
      activations: {
        active: activeCount,
        total: activations.length,
        devices: activations.map(activationRowToPublic),
      },
    };
  });

  return json(result);
}

// GET /api/health ----------------------------------------------------------
function handleHealth(): Response {
  return json({ ok: true, service: "license-server" });
}

// POST /api/telemetry ------------------------------------------------------
async function handleTelemetry(req: Request): Promise<Response> {
  const body = await readJson(req);
  const fingerprint = body.fingerprint !== undefined ? String(body.fingerprint) : null;
  const version = body.version !== undefined ? String(body.version) : null;
  const timestamp = body.timestamp !== undefined ? String(body.timestamp) : null;
  const licenseId =
    body.licenseId !== undefined && body.licenseId !== null
      ? String(body.licenseId)
      : null;
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;

  stmtInsertTelemetry.run({
    $fingerprint: fingerprint ?? "",
    $version: version ?? "",
    $timestamp: timestamp ?? "",
    $licenseId: licenseId,
    $ip: ip ?? "",
    $receivedAt: new Date().toISOString(),
  });

  // Intentionally always 200 { ok:true } — silent phone-home.
  return json({ ok: true });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const ROUTES: Record<string, (req: Request, url: URL) => Promise<Response> | Response> = {
  "/api/issue": handleIssue,
  "/api/activate": handleActivate,
  "/api/heartbeat": handleHeartbeat,
  "/api/deactivate": handleDeactivate,
  "/api/revoke": handleRevoke,
  "/api/unrevoke": handleUnrevoke,
  "/api/licenses": handleListLicenses,
  "/api/health": () => handleHealth(),
  "/api/telemetry": handleTelemetry,
};

async function route(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const pathname = url.pathname;
  const method = req.method.toUpperCase();

  // CORS preflight
  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const handler = ROUTES[pathname];
  if (!handler) {
    return err("not_found", 404, { path: pathname });
  }

  // GET routes
  if (method === "GET") {
    if (pathname !== "/api/health" && pathname !== "/api/licenses") {
      return err("method_not_allowed", 405, { allowed: "POST" });
    }
  } else if (method === "POST") {
    if (pathname === "/api/health" || pathname === "/api/licenses") {
      return err("method_not_allowed", 405, { allowed: "GET" });
    }
  } else {
    return err("method_not_allowed", 405, { allowed: "GET, POST, OPTIONS" });
  }

  try {
    const res = await handler(req, url);
    return res;
  } catch (e: unknown) {
    if (e instanceof HttpError) {
      return err(e.code, e.status, { message: e.message });
    }
    console.error("[unhandled]", e);
    return err("internal_error", 500, {
      message: e instanceof Error ? e.message : String(e),
    });
  }
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const server = Bun.serve({
  port: PORT,
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const pathname = url.pathname;
    const method = req.method.toUpperCase();

    let res: Response;
    try {
      res = await route(req);
    } catch (e) {
      console.error("[router-fatal]", e);
      res = err("internal_error", 500, {
        message: e instanceof Error ? e.message : String(e),
      });
    }

    logRequest(method, pathname, res.status);
    return res;
  },
});

console.log(`╔══════════════════════════════════════════════════════════╗`);
console.log(`║  license-server listening on http://localhost:${PORT}        ║`);
console.log(`║  signing key: ${PRIVATE_KEY_PATH}`);
console.log(`║  database:    ${DB_PATH}`);
console.log(`║  admin key:   ${ADMIN_API_KEY}  ⚠ rotate in production`);
console.log(`╚══════════════════════════════════════════════════════════╝`);

// Keep a reference so Bun doesn't complain in strict TS about unused `server`.
void server;

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

process.on("SIGINT", () => {
  console.log("\n[shutdown] closing DB and exiting…");
  db.close();
  process.exit(0);
});
process.on("SIGTERM", () => {
  console.log("\n[shutdown] SIGTERM received, exiting…");
  db.close();
  process.exit(0);
});
