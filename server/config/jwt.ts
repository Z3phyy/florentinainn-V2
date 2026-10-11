import crypto from "crypto";
import fs from "fs";
import path from "path";

const WEAK_SECRETS = ["management", "secret", "password", "123456", "changeme", ""];

// Resolve the persisted-secret file consistently regardless of ts-node (src) or compiled (dist) runtime.
const SECRET_FILE = path.join(process.cwd(), ".jwt-secret");

export function getJwtSecret(): string {
  const candidate = (process.env.JWT_SECRET || "").trim();

  if (candidate.length >= 32 && !WEAK_SECRETS.includes(candidate.toLowerCase())) {
    return candidate;
  }

  const persisted = readPersistedSecret();
  if (persisted) {
    return persisted;
  }

  const generated = crypto.randomBytes(48).toString("hex");
  try {
    fs.writeFileSync(SECRET_FILE, generated, { flag: "wx", mode: 0o600 });
  } catch {
    // File may have been created concurrently — re-read it.
    const existing = readPersistedSecret();
    if (existing) {
      return existing;
    }
  }

  console.warn(
    "[SECURITY] JWT_SECRET in .env is missing or weak. A strong random secret was generated " +
      "and persisted to .jwt-secret so sessions survive restarts. Set a strong JWT_SECRET in your .env."
  );
  return generated;
}

// Returns the effective secret plus any pre-existing persisted secrets so that
// tokens issued before a JWT_SECRET rotation keep verifying (smooth rollover).
export function getJwtSecretCandidates(): string[] {
  const candidates = [getJwtSecret()];

  const persisted = readPersistedSecret();
  if (persisted && !WEAK_SECRETS.includes(persisted.toLowerCase()) && !candidates.includes(persisted)) {
    candidates.push(persisted);
  }

  return candidates;
}

function readPersistedSecret(): string | null {
  try {
    if (fs.existsSync(SECRET_FILE)) {
      const persisted = fs.readFileSync(SECRET_FILE, "utf8").trim();
      if (persisted) {
        return persisted;
      }
    }
  } catch {
    // Ignore read errors; fall through to generation.
  }
  return null;
}