/**
 * issue-license.ts — convenience CLI to issue a license against the local
 * license-server and print the `.lic` JSON content ready to paste into the
 * KioskoApp activation screen.
 *
 * Usage (from the repo root or from mini-services/license-server/):
 *
 *   bun mini-services/license-server/issue-license.ts \
 *       --customer "Dubiel" \
 *       --plan pro \
 *       --maxDevices 2 \
 *       --days 365
 *
 * Requires the license-server to be running on http://localhost:3042
 * (start it with `bun run dev` inside mini-services/license-server/).
 */

const LICENSE_SERVER_URL = process.env.LICENSE_SERVER_URL || "http://localhost:3042";
const ADMIN_API_KEY = process.env.LICENSE_ADMIN_API_KEY || "kiosko-admin-secret-2025";

interface Args {
  customer: string;
  plan: "trial" | "pro" | "enterprise";
  maxDevices: number;
  days: number;
  features: string[];
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    customer: "",
    plan: "pro",
    maxDevices: 1,
    days: 365,
    features: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case "--customer":
      case "-c":
        args.customer = next();
        break;
      case "--plan":
      case "-p":
        args.plan = next() as Args["plan"];
        break;
      case "--maxDevices":
      case "-m":
        args.maxDevices = Number(next());
        break;
      case "--days":
      case "-d":
        args.days = Number(next());
        break;
      case "--features":
      case "-f":
        args.features = next().split(",").map((s) => s.trim()).filter(Boolean);
        break;
      case "--help":
      case "-h":
        console.log(`Usage: bun issue-license.ts --customer "Name" [--plan pro] [--maxDevices 2] [--days 365] [--features a,b,c]`);
        process.exit(0);
      default:
        if (a?.startsWith("--")) {
          console.error(`Unknown flag: ${a}`);
          process.exit(1);
        }
    }
  }
  if (!args.customer) {
    console.error("Error: --customer is required.");
    console.error('Example: bun issue-license.ts --customer "Dubiel" --plan pro --days 365');
    process.exit(1);
  }
  if (!["trial", "pro", "enterprise"].includes(args.plan)) {
    console.error(`Error: --plan must be trial|pro|enterprise (got "${args.plan}")`);
    process.exit(1);
  }
  if (!Number.isFinite(args.maxDevices) || args.maxDevices < 1) {
    console.error("Error: --maxDevices must be a positive integer.");
    process.exit(1);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + args.days * 24 * 60 * 60 * 1000);

  const body = {
    customer: args.customer,
    plan: args.plan,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    maxDevices: args.maxDevices,
    features: args.features,
  };

  console.log(`Issuing license...`);
  console.log(`  server:    ${LICENSE_SERVER_URL}`);
  console.log(`  customer:  ${body.customer}`);
  console.log(`  plan:      ${body.plan}`);
  console.log(`  maxDevices:${body.maxDevices}`);
  console.log(`  expiresAt: ${body.expiresAt}`);
  console.log("");

  const res = await fetch(`${LICENSE_SERVER_URL}/api/issue`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Key": ADMIN_API_KEY,
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json().catch(() => null)) as {
    ok?: boolean;
    error?: string;
    message?: string;
    license?: { licenseId: string };
    licenseFileContent?: string;
  } | null;

  if (!res.ok || !data?.ok) {
    console.error(`FAILED (HTTP ${res.status}):`);
    console.error(JSON.stringify(data, null, 2));
    console.error("");
    console.error("Is the license-server running?  →  cd mini-services/license-server && bun run dev");
    process.exit(1);
  }

  console.log("✅ License issued successfully!");
  console.log(`   licenseId: ${data.license?.licenseId}`);
  console.log("");
  console.log("═══════════════════════════════════════════════════════════════════════");
  console.log("📋 COPY EVERYTHING BETWEEN THE LINES BELOW and paste it into the");
  console.log("   KioskoApp activation screen (or save it as dubiel.lic and upload):");
  console.log("═══════════════════════════════════════════════════════════════════════");
  console.log(data.licenseFileContent);
  console.log("═══════════════════════════════════════════════════════════════════════");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
