import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
} from 'crypto';

/**
 * Event access codes used to be stored as one-way SHA-256 hashes, which meant
 * an organiser who forgot a code could never see it again. They are now stored
 * with reversible AES-256-GCM encryption so owners/super-admin can read the
 * real code back, while the database alone (without the key) still cannot.
 *
 * Stored format: "enc:v1:<ivB64>:<tagB64>:<ciphertextB64>"
 * Legacy values (raw SHA-256 hex) do not carry the prefix and are detected so
 * existing events keep working until their codes are reset.
 */

const PREFIX = 'enc:v1:';

let cachedKey: Buffer | null = null;
function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const secret =
    process.env.EVENT_CODE_SECRET ??
    process.env.JWT_SECRET ??
    'gpx-action-secret-change-in-prod';
  cachedKey = scryptSync(secret, 'gpx-event-code', 32);
  return cachedKey;
}

export function encryptCode(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
}

/**
 * Returns the decrypted plaintext, or `null` when the stored value is a legacy
 * (non-reversible) SHA-256 hash or is otherwise unreadable.
 */
export function decryptCode(stored: string | null | undefined): string | null {
  if (!stored || !stored.startsWith(PREFIX)) return null;
  try {
    const [ivB64, tagB64, ctB64] = stored.slice(PREFIX.length).split(':');
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const ct = Buffer.from(ctB64, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', getKey(), iv);
    decipher.setAuthTag(tag);
    const out = Buffer.concat([decipher.update(ct), decipher.final()]);
    return out.toString('utf8');
  } catch {
    return null;
  }
}

/** Legacy hash, kept so attendees with codes set before encryption still work. */
export function sha256(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

/** True if the stored value is a legacy SHA-256 hash (cannot be shown). */
export function isLegacyCode(stored: string | null | undefined): boolean {
  return !!stored && !stored.startsWith(PREFIX);
}
