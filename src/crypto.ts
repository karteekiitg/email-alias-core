/**
 * Universal crypto setup for browser extensions, Cloudflare Workers, and Node.js
 * @internal
 */

// Type definition for crypto interface
interface CryptoInterface {
  subtle: SubtleCrypto;
}

/**
 * Gets the appropriate crypto implementation based on the environment
 * @internal
 */
function getCrypto(): CryptoInterface {
  // Browser extensions, modern browsers, and Cloudflare Workers
  if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    return globalThis.crypto;
  }

  // Older browsers fallback
  if (typeof window !== 'undefined' && window.crypto) {
    return window.crypto;
  }

  // Web Workers fallback
  if (typeof self !== 'undefined' && self.crypto) {
    return self.crypto;
  }

  // Node.js environment (for testing)
  if (typeof global !== 'undefined') {
    try {
      // Dynamic import to avoid bundler issues
      const { webcrypto } = eval('require')('node:crypto');
      return webcrypto as CryptoInterface;
    } catch {
      // Fallback for older Node.js versions
      try {
        const { webcrypto } = eval('require')('crypto');
        return webcrypto as CryptoInterface;
      } catch {
        throw new Error('Web Crypto API not available. Node.js 16+ required.');
      }
    }
  }

  throw new Error('Crypto API not available in this environment');
}

// Export the crypto instance
export const crypto = getCrypto();
