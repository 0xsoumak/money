/**
 * Password hashing with PBKDF2-SHA256 via Web Crypto.
 *
 * Why not Better Auth's default (scrypt in pure JS)? It can blow through the
 * Workers free plan's CPU limit on sign-in. Web Crypto runs natively and
 * works the same in Workers and Node (used by scripts/create-user.ts).
 *
 * 100k iterations is the maximum Workers allows. Combined with sign-in rate
 * limiting and a long password, that's plenty for a single-user app.
 *
 * Format: pbkdf2_sha256$<iterations>$<salt b64>$<hash b64>
 */

const ALGORITHM = "pbkdf2_sha256";
const ITERATIONS = 100_000;
const SALT_BYTES = 16;
const KEY_BITS = 256;

const encoder = new TextEncoder();

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    KEY_BITS,
  );
  return new Uint8Array(bits);
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, ITERATIONS);
  return `${ALGORITHM}$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

export async function verifyPassword({
  hash,
  password,
}: {
  hash: string;
  password: string;
}): Promise<boolean> {
  const [algorithm, iterationsRaw, saltB64, hashB64] = hash.split("$");
  const iterations = Number(iterationsRaw);
  if (algorithm !== ALGORITHM || !saltB64 || !hashB64 || !Number.isInteger(iterations)) {
    return false;
  }
  const expected = fromBase64(hashB64);
  const actual = await derive(password, fromBase64(saltB64), iterations);
  return timingSafeEqual(actual, expected);
}
