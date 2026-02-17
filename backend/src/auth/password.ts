import crypto from "crypto";

type ScryptParams = {
  cost: number;
  blockSize: number;
  parallelization: number;
  keylen: number;
};

const DEFAULT_PARAMS: ScryptParams = {
  cost: Number(process.env.SCRYPT_COST ?? 16384),
  blockSize: Number(process.env.SCRYPT_BLOCK_SIZE ?? 8),
  parallelization: Number(process.env.SCRYPT_PARALLELIZATION ?? 1),
  keylen: 64,
};

function b64(buf: Buffer) {
  return buf.toString("base64");
}

function fromB64(s: string) {
  return Buffer.from(s, "base64");
}

function scryptDerive(
  password: string,
  salt: Buffer,
  keylen: number,
  opts: { cost: number; blockSize: number; parallelization: number; maxmem: number }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keylen, opts, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(derivedKey as Buffer);
    });
  });
}

export async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16);
  const p = DEFAULT_PARAMS;

  const derived = await scryptDerive(password, salt, p.keylen, {
    cost: p.cost,
    blockSize: p.blockSize,
    parallelization: p.parallelization,
    maxmem: 256 * 1024 * 1024,
  });

  // format: scrypt$cost$blockSize$parallelization$saltB64$hashB64
  return `scrypt$${p.cost}$${p.blockSize}$${p.parallelization}$${b64(salt)}$${b64(derived)}`;
}

export async function verifyPassword(password: string, stored: string) {
  const parts = stored.split("$");
  if (parts.length !== 6) return false;
  if (parts[0] !== "scrypt") return false;

  const cost = Number(parts[1]);
  const blockSize = Number(parts[2]);
  const parallelization = Number(parts[3]);
  const salt = fromB64(parts[4]);
  const expected = fromB64(parts[5]);

  if (!Number.isFinite(cost) || !Number.isFinite(blockSize) || !Number.isFinite(parallelization)) {
    return false;
  }
  if (expected.length < 32) return false;

  const derived = await scryptDerive(password, salt, expected.length, {
    cost,
    blockSize,
    parallelization,
    maxmem: 256 * 1024 * 1024,
  });

  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}
