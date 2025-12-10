// =============================================================================
// Storage Utilities
// =============================================================================

import { v7 as uuidv7 } from 'uuid';

/**
 * Generate a UUID v7 (time-ordered)
 */
export function generateId(): string {
  return uuidv7();
}

/**
 * Get current ISO timestamp
 */
export function now(): string {
  return new Date().toISOString();
}

/**
 * Compute SHA-256 checksum of data
 */
export async function computeChecksum(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Synchronous checksum for operations (fallback)
 */
export function computeChecksumSync(data: string): string {
  // Simple hash for sync contexts - in production use a proper sync hash
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}
