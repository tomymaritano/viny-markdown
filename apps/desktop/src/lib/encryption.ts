import { invoke } from '@tauri-apps/api/core';

export async function isEncryptionEnabled(): Promise<boolean> {
  return invoke('is_encryption_enabled');
}

export async function hasEncryptionConfigured(): Promise<boolean> {
  return invoke('has_encryption_configured');
}

export async function setupEncryption(password: string): Promise<void> {
  return invoke('setup_encryption', { password });
}

export async function unlockEncryption(password: string): Promise<void> {
  return invoke('unlock_encryption', { password });
}

export async function lockEncryption(): Promise<void> {
  return invoke('lock_encryption');
}

export async function changeEncryptionPassword(oldPassword: string, newPassword: string): Promise<void> {
  return invoke('change_encryption_password', { oldPassword, newPassword });
}

export async function disableEncryption(password: string): Promise<void> {
  return invoke('disable_encryption', { password });
}
