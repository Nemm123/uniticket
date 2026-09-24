import { createHash, randomBytes, verify } from 'node:crypto';

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function isSolanaWalletAddress(value: string): boolean {
  try {
    return decodeBase58(value).length === 32;
  } catch {
    return false;
  }
}

export function walletAuthMessage(input: { domain: string; walletAddress: string; nonce: string; issuedAt: Date; expiresAt: Date }): string {
  return [
    'UniTicket Wallet Authentication',
    `Domain: ${input.domain}`,
    `Wallet: ${input.walletAddress}`,
    `Nonce: ${input.nonce}`,
    `Issued At: ${input.issuedAt.toISOString()}`,
    `Expires At: ${input.expiresAt.toISOString()}`,
    'Purpose: authenticate this wallet with UniTicket. This request creates no blockchain transaction.',
  ].join('\n');
}

export function verifySolanaMessageSignature(walletAddress: string, message: string, signatureBase64: string): boolean {
  try {
    const publicKey = decodeBase58(walletAddress);
    const signature = Buffer.from(signatureBase64, 'base64');
    if (publicKey.length !== 32 || signature.length !== 64) return false;
    return verify(
      null,
      Buffer.from(message, 'utf8'),
      { key: Buffer.concat([ED25519_SPKI_PREFIX, publicKey]), format: 'der', type: 'spki' },
      signature,
    );
  } catch {
    return false;
  }
}

function decodeBase58(value: string): Buffer {
  if (!value || value.length > 64) throw new Error('Invalid base58 value.');
  const digits: number[] = [];
  for (const character of value) {
    const index = BASE58_ALPHABET.indexOf(character);
    if (index < 0) throw new Error('Invalid base58 character.');
    let carry = index;
    for (let i = 0; i < digits.length; i += 1) {
      const next = digits[i] * 58 + carry;
      digits[i] = next & 0xff;
      carry = next >> 8;
    }
    while (carry > 0) {
      digits.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (const character of value) {
    if (character !== '1') break;
    digits.push(0);
  }
  return Buffer.from(digits.reverse());
}
