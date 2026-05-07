import crypto from 'node:crypto';

function getKey() {
  return crypto
    .createHash('sha256')
    .update(process.env.PASSWORD_ENCRYPTION_KEY || 'change_me_32_bytes')
    .digest();
}

export function encryptPassword(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptPassword(value) {
  const [ivHex, tagHex, encryptedHex] = String(value || '').split(':');
  if (!ivHex || !tagHex || !encryptedHex) return '';
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final()
  ]).toString('utf8');
}

export function hashToken(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function randomToken() {
  return crypto.randomBytes(32).toString('hex');
}
