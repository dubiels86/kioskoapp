/**
 * diagnostico-keys.ts — Diagnóstico de matching de claves Ed25519.
 *
 * Verifica que la clave pública que usa el cliente (src/lib/license-public-key.pem)
 * sea exactamente la pareja de la clave privada del license-server
 * (mini-services/license-server/keys/private.pem).
 *
 * Si NO coinciden → toda licencia emitida por este license-server fallará con
 * "Firma inválida: verification_error" al intentar activarla en el cliente.
 *
 * Uso:  bun mini-services/license-server/diagnostico-keys.ts
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const KEYS_DIR = path.resolve(import.meta.dir, "keys");
const PRIVATE_KEY_PATH = path.join(KEYS_DIR, "private.pem");
const PUBLIC_KEY_PATH = path.join(KEYS_DIR, "public.pem");
const CLIENT_PUBLIC_KEY_PATHS = [
  path.resolve(import.meta.dir, "../../src/lib/license-public-key.pem"),
  path.resolve(process.cwd(), "src/lib/license-public-key.pem"),
];

function fmtFingerprint(pem: string): string {
  // Derivar el fingerprint SHA-256 del DER de la clave pública.
  const pub = crypto.createPublicKey(pem);
  const der = pub.export({ type: "spki", format: "der" });
  const hash = crypto.createHash("sha256").update(der).digest("hex");
  return hash.slice(0, 16) + "…" + hash.slice(-16);
}

function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  DIAGNÓSTICO DE KEYS Ed25519 — KioskoApp");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // 1) ¿Existe la clave privada del license-server?
  console.log("1) Clave PRIVADA del license-server:");
  console.log("   ruta: " + PRIVATE_KEY_PATH);
  if (!fs.existsSync(PRIVATE_KEY_PATH)) {
    console.log("   ❌ NO EXISTE. El license-server no se arrancó nunca en esta");
    console.log("      máquina, o las claves se borraron.");
    console.log("\n   FIX: arrancá el license-server para que auto-genere las claves:");
    console.log("        cd mini-services/license-server && bun run dev");
    return;
  }
  const privPem = fs.readFileSync(PRIVATE_KEY_PATH, "utf8");
  const priv = crypto.createPrivateKey(privPem);
  if (priv.asymmetricKeyType !== "ed25519") {
    console.log(`   ❌ La clave no es Ed25519 (es ${priv.asymmetricKeyType}).`);
    console.log("      FIX: borrá keys/ y arrancá el license-server de nuevo.");
    return;
  }
  // Derivar la pública a partir de la privada (esta es la "verdad").
  const expectedPub = crypto.createPublicKey(priv);
  const expectedPubPem = expectedPub.export({ type: "spki", format: "pem" });
  const expectedFp = fmtFingerprint(expectedPubPem);
  console.log(`   ✅ Existe (Ed25519). Fingerprint pública derivada: ${expectedFp}`);

  // 2) ¿Existe la clave pública del cliente (src/lib/license-public-key.pem)?
  console.log("\n2) Clave PÚBLICA del cliente (src/lib/license-public-key.pem):");
  let clientPubPath: string | null = null;
  for (const p of CLIENT_PUBLIC_KEY_PATHS) {
    if (fs.existsSync(p)) {
      clientPubPath = p;
      break;
    }
  }
  if (!clientPubPath) {
    console.log("   ❌ NO EXISTE en ninguna ruta candidata:");
    for (const p of CLIENT_PUBLIC_KEY_PATHS) console.log("      - " + p);
    console.log("\n   FIX: arrancá el license-server (las sincroniza automáticamente):");
    console.log("        cd mini-services/license-server && bun run dev");
    return;
  }
  console.log("   ruta: " + clientPubPath);
  const clientPubPem = fs.readFileSync(clientPubPath, "utf8");
  let clientFp: string;
  try {
    clientFp = fmtFingerprint(clientPubPem);
    console.log(`   ✅ Existe. Fingerprint: ${clientFp}`);
  } catch (e) {
    console.log("   ❌ El archivo existe pero NO es una clave pública PEM válida.");
    console.log("      Contenido (primeras 80 chars): " + clientPubPem.slice(0, 80));
    console.log("\n   FIX: borrá el archivo y arrancá el license-server para regenerarlo:");
    console.log(`        rm ${clientPubPath}`);
    console.log("        cd mini-services/license-server && bun run dev");
    return;
  }

  // 3) ¿Coinciden?
  console.log("\n3) Matching:");
  console.log(`   derivada de privada : ${expectedFp}`);
  console.log(`   archivo del cliente: ${clientFp}`);
  if (expectedFp === clientFp) {
    console.log("   ✅ COINCIDEN. Las claves son pareja.");
    console.log("\n   Si aún así te da 'verification_error', la licencia que estás");
    console.log("   pegando fue firmada por OTRA clave privada (de otra máquina).");
    console.log("   Generá una NUEVA licencia con el license-server de ESTA máquina:");
    console.log("     - botón verde 'Emitir licencia de prueba', o");
    console.log("     - bun mini-services/license-server/issue-license.ts --customer ...");
    console.log("   NO pegues licencias de otras máquinas ni del chat.");
  } else {
    console.log("   ❌ NO COINCIDEN. El cliente está verificando con una clave pública");
    console.log("      que NO es pareja de la clave privada del license-server.");
    console.log("\n   CAUSA: probablemente borraste keys/ y se regeneró una nueva clave");
    console.log("      privada, pero el archivo src/lib/license-public-key.pem quedó");
    console.log("      apuntando a la clave pública vieja. O viceversa.");
    console.log("\n   FIX LIMPIO (regenerar todo desde cero):");
    console.log("      cd mini-services/license-server");
    console.log("      rm -rf keys/ data.db data.db-shm data.db-wal");
    console.log("      rm ../../src/lib/license-public-key.pem");
    console.log("      bun run dev   # ← regenera keys + sincroniza pública");
    console.log("      # luego en OTRA terminal, emitir licencia nueva:");
    console.log("      cd ../..");
    console.log("      bun mini-services/license-server/issue-license.ts --customer Dubiel --plan pro --days 365");
    console.log("      # (o usá el botón verde 'Emitir licencia de prueba' en la app)");
  }

  // 4) Bonus: verificar una licencia específica si se pasa como argumento
  const licPath = process.argv[2];
  if (licPath) {
    console.log("\n4) Verificando licencia: " + licPath);
    let licContent: string;
    try {
      licContent = fs.readFileSync(licPath, "utf8");
    } catch {
      console.log("   ❌ No se pudo leer el archivo.");
      return;
    }
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(licContent);
    } catch {
      console.log("   ❌ El archivo no es JSON válido.");
      return;
    }
    const sig = payload.signature;
    if (typeof sig !== "string") {
      console.log("   ❌ La licencia no tiene campo 'signature'.");
      return;
    }
    const { signature: _sig, ...rest } = payload;
    void _sig;
    const canonical = stableStringify(rest);
    const isValid = crypto.verify(
      null,
      Buffer.from(canonical, "utf8"),
      expectedPub,
      Buffer.from(sig, "base64")
    );
    console.log(`   resultado: ${isValid ? "✅ FIRMA VÁLIDA (firmada por ESTA clave privada)" : "❌ FIRMA INVÁLIDA (firmada por OTRA clave privada)"}`);
    if (!isValid) {
      console.log("   → La licencia fue emitida por otro license-server. No la uses acá.");
      console.log("     Emití una nueva desde ESTA máquina.");
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringify((value as Record<string, unknown>)[k])).join(",") + "}";
}

main();
