/**
 * Encryption utilities for Cloudflare Workers
 * Uses Web Crypto API instead of Node.js crypto module
 */

/**
 * Encrypt data using AES-GCM (Web Crypto API)
 */
export async function encryptData(plaintext: string, key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  
  // Create a key from the password
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key.padEnd(32, '0').slice(0, 32)),
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  
  // Generate IV
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Encrypt
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    keyMaterial,
    data
  );
  
  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  // Convert to base64
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt data encrypted with encryptData
 */
export async function decryptData(encrypted: string, key: string): Promise<string> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  
  // Decode from base64
  const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  
  // Extract IV and ciphertext
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  
  // Create a key from the password
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key.padEnd(32, '0').slice(0, 32)),
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
  
  // Decrypt
  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    keyMaterial,
    ciphertext
  );
  
  return decoder.decode(decrypted);
}

/**
 * Generate a random encryption IV (for database storage)
 */
export function generateIV(): string {
  const iv = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(iv, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash a value for comparison (non-reversible)
 */
export async function hashValue(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate wallet address format (basic check)
 */
export function isValidEthAddress(address: string): boolean {
  // Ethereum addresses are 42 characters: 0x + 40 hex characters
  return /^0x[a-fA-F0-9]{40}$/i.test(address);
}

/**
 * Validate Bitcoin address format (basic check)
 */
export function isValidBtcAddress(address: string): boolean {
  // P2PKH (starts with 1), P2SH (starts with 3), Bech32 (starts with bc1)
  return /^(1[a-km-zA-HJ-NP-Z1-9]{25,34}|3[a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{39,59})$/.test(address);
}

/**
 * Validate seed phrase format (12 or 24 words)
 */
export function isValidSeedPhraseFormat(phrase: string): boolean {
  const words = phrase.trim().toLowerCase().split(/\s+/);
  return words.length === 12 || words.length === 24;
}
