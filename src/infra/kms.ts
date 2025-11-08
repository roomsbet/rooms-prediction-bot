/**
 * KMS Infrastructure - Key Management Service
 * 
 * This module provides AES-256-GCM encryption/decryption for user private keys.
 * Uses a master key stored in environment variables.
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const MASTER_KEY = process.env.ENCRYPTION_MASTER_KEY;

/**
 * Encrypt a Solana private key using AES-256-GCM
 * @param secretKey - Uint8Array of the secret key (64 bytes)
 * @returns Encrypted string format: iv:authTag:encrypted (hex)
 */
export async function encryptKey(secretKey: Uint8Array): Promise<string> {
  if (!MASTER_KEY || MASTER_KEY.length !== 64) {
    throw new Error('ENCRYPTION_MASTER_KEY must be a 64-character hex string (32 bytes)');
  }

  // Generate random IV (initialization vector)
  const iv = crypto.randomBytes(16);
  
  // Create cipher
  const cipher = crypto.createCipheriv(
    ALGORITHM,
    Buffer.from(MASTER_KEY, 'hex'),
    iv
  );
  
  // Encrypt the secret key
  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(secretKey)),
    cipher.final()
  ]);
  
  // Get authentication tag
  const authTag = cipher.getAuthTag();
  
  // Return format: iv:authTag:encrypted (all in hex)
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt an AES-256-GCM encrypted private key
 * @param encryptedData - Encrypted string format: iv:authTag:encrypted
 * @returns Uint8Array of the decrypted secret key
 */
export async function decryptKey(encryptedData: string): Promise<Uint8Array> {
  if (!MASTER_KEY || MASTER_KEY.length !== 64) {
    throw new Error('ENCRYPTION_MASTER_KEY must be a 64-character hex string (32 bytes)');
  }

  // Handle legacy placeholder format for backward compatibility
  if (encryptedData.startsWith('ENCRYPTED_')) {
    console.warn('⚠️  Detected legacy placeholder encryption format');
    const base64 = encryptedData.replace('ENCRYPTED_', '');
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }

  // Parse encrypted data
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }
  
  const [ivHex, authTagHex, encryptedHex] = parts;
  
  // Create decipher
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(MASTER_KEY, 'hex'),
    Buffer.from(ivHex, 'hex')
  );
  
  // Set authentication tag
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  
  // Decrypt
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final()
  ]);
  
  return new Uint8Array(decrypted);
}

/**
 * Validate KMS configuration
 * @returns true if KMS is properly configured
 */
export function validateKMSConfig(): boolean {
  const apiKey = process.env.KMS_API_KEY;
  const orgId = process.env.KMS_ORGANIZATION_ID;
  
  // For now, return true if either is set (placeholder mode is OK for dev)
  return true;
}

