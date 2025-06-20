/**
 * @license MIT
 * @copyright 2025 karteekiitg
 */

// Import our universal crypto implementation
import { crypto } from './crypto.js';

/**
 * Options for the {@link generateEmailAlias} function.
 * @public
 */
interface GenerateOptions {
  /**
   * The master secret key for HMAC generation.
   */
  secretKey: string;
  /**
   * An array of strings to form the identifiable part of the alias.
   * These will be joined by a hyphen.
   * @example `['shop', 'amazon']`
   */
  aliasParts: string[];
  /**
   * The custom domain for the alias.
   * @example `example.com`
   */
  domain: string;
  /**
   * The desired length of the hexadecimal hash signature.
   * @defaultValue 8
   */
  hashLength?: number;
}

/**
 * Options for the {@link validateEmailAlias} function.
 * @public
 */
interface ValidateOptions {
  /**
   * The master secret key used for validation.
   */
  secretKey: string;
  /**
   * The full email alias to validate.
   * @example `shop-amazon-a1b2c3d4@example.com`
   */
  fullAlias: string;
  /**
   * The length of the hash used in the alias. Must match the length used during generation.
   * @defaultValue 8
   */
  hashLength?: number;
}

/**
 * The core cryptographic function to generate an HMAC-SHA-256 signature.
 * @internal
 */
async function _getHmacSignature(secretKey: string, data: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return crypto.subtle.sign('HMAC', key, encoder.encode(data));
}

/**
 * Converts an ArrayBuffer to a hexadecimal string.
 * @internal
 */
function _bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generates a verifiable, HMAC-based email alias for a custom domain.
 *
 * @remarks
 * This function is deterministic. Given the same inputs, it will always produce
 * the same output. It is safe to use in any modern JavaScript environment that
 * supports the Web Crypto API.
 *
 * @param options - The options object for generating the alias. See {@link GenerateOptions}.
 * @returns A promise that resolves to the full, generated email alias.
 * @throws An error if `aliasParts` is an empty array.
 *
 * @public
 */
export async function generateEmailAlias({
  secretKey,
  aliasParts,
  domain,
  hashLength = 8,
}: GenerateOptions): Promise<string> {
  if (!aliasParts || aliasParts.length === 0) {
    throw new Error('The `aliasParts` array cannot be empty.');
  }
  if (aliasParts.some((part: string) => typeof part !== 'string')) {
    throw new Error('All elements in `aliasParts` must be strings.');
  }

  const localPartPrefix = aliasParts.join('-');
  const signatureBuffer = await _getHmacSignature(secretKey, localPartPrefix);
  const fullHash = _bufferToHex(signatureBuffer);
  const truncatedHash = fullHash.substring(0, hashLength);

  return `${localPartPrefix}-${truncatedHash}@${domain}`;
}

/**
 * Validates a verifiable email alias against a secret key.
 *
 * @remarks
 * This function performs the same HMAC signature generation as `generateEmailAlias`
 * and compares the result to the hash in the provided alias.
 * It will gracefully return `false` for any malformed alias string.
 *
 * @param options - The options object for validating the alias. See {@link ValidateOptions}.
 * @returns A promise that resolves to `true` if the alias is valid, and `false` otherwise.
 *
 * @public
 */
export async function validateEmailAlias({
  secretKey,
  fullAlias,
  hashLength = 8,
}: ValidateOptions): Promise<boolean> {
  if (!fullAlias || typeof fullAlias !== 'string') {
    return false;
  }

  // Regex to parse the alias into its three main components:
  const aliasRegex = new RegExp(`^(.*)-([a-f0-9]{${hashLength}})@(.+)$`);
  const match = fullAlias.match(aliasRegex);

  if (!match) {
    return false;
  }

  // Extract the parts with proper null checking
  const localPartPrefix = match[1];
  const providedHash = match[2];

  // Additional safety check (though this should never happen given our regex)
  if (!localPartPrefix || !providedHash) {
    return false;
  }

  // Re-generate the hash using the same parameters.
  const signatureBuffer = await _getHmacSignature(secretKey, localPartPrefix);
  const fullHash = _bufferToHex(signatureBuffer);
  const expectedHash = fullHash.substring(0, hashLength);

  return providedHash === expectedHash;
}
