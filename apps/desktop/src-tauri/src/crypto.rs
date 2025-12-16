use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use argon2::{password_hash::SaltString, Argon2, PasswordHasher};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use rand::rngs::OsRng;
use std::sync::RwLock;

use crate::error::{AppError, Result};

// Global encryption state
static ENCRYPTION_KEY: RwLock<Option<[u8; 32]>> = RwLock::new(None);
static ENCRYPTION_ENABLED: RwLock<bool> = RwLock::new(false);

/// Derives a 256-bit key from a password using Argon2id
fn derive_key(password: &str, salt: &SaltString) -> Result<[u8; 32]> {
    let argon2 = Argon2::default();
    let hash = argon2
        .hash_password(password.as_bytes(), salt)
        .map_err(|e| AppError::Encryption(format!("Key derivation failed: {}", e)))?;

    // Extract the hash output (32 bytes for AES-256)
    let hash_bytes = hash.hash.ok_or_else(|| {
        AppError::Encryption("Failed to get hash output".to_string())
    })?;

    let mut key = [0u8; 32];
    let bytes = hash_bytes.as_bytes();
    let len = bytes.len().min(32);
    key[..len].copy_from_slice(&bytes[..len]);

    Ok(key)
}

/// Encrypts plaintext using AES-256-GCM
/// Returns: base64(nonce || ciphertext)
pub fn encrypt(plaintext: &str) -> Result<String> {
    let key_guard = ENCRYPTION_KEY.read().unwrap();
    let key = key_guard.as_ref().ok_or_else(|| {
        AppError::Encryption("Encryption not initialized".to_string())
    })?;

    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| AppError::Encryption(format!("Cipher init failed: {}", e)))?;

    // Generate random 96-bit nonce
    let mut nonce_bytes = [0u8; 12];
    use rand::RngCore;
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| AppError::Encryption(format!("Encryption failed: {}", e)))?;

    // Prepend nonce to ciphertext
    let mut result = nonce_bytes.to_vec();
    result.extend(ciphertext);

    Ok(BASE64.encode(&result))
}

/// Decrypts ciphertext using AES-256-GCM
/// Input: base64(nonce || ciphertext)
pub fn decrypt(encrypted: &str) -> Result<String> {
    let key_guard = ENCRYPTION_KEY.read().unwrap();
    let key = key_guard.as_ref().ok_or_else(|| {
        AppError::Encryption("Encryption not initialized".to_string())
    })?;

    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| AppError::Encryption(format!("Cipher init failed: {}", e)))?;

    let data = BASE64.decode(encrypted)
        .map_err(|e| AppError::Encryption(format!("Base64 decode failed: {}", e)))?;

    if data.len() < 12 {
        return Err(AppError::Encryption("Invalid encrypted data".to_string()));
    }

    let (nonce_bytes, ciphertext) = data.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);

    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| AppError::Encryption(format!("Decryption failed: {}", e)))?;

    String::from_utf8(plaintext)
        .map_err(|e| AppError::Encryption(format!("UTF-8 decode failed: {}", e)))
}

/// Check if encryption is enabled
pub fn is_encryption_enabled() -> bool {
    *ENCRYPTION_ENABLED.read().unwrap()
}

/// Initialize encryption with a password
pub fn init_encryption(password: &str, salt_str: Option<&str>) -> Result<String> {
    let salt = if let Some(s) = salt_str {
        SaltString::from_b64(s)
            .map_err(|e| AppError::Encryption(format!("Invalid salt: {}", e)))?
    } else {
        SaltString::generate(&mut OsRng)
    };

    let key = derive_key(password, &salt)?;

    // Store key in memory
    {
        let mut key_guard = ENCRYPTION_KEY.write().unwrap();
        *key_guard = Some(key);
    }
    {
        let mut enabled_guard = ENCRYPTION_ENABLED.write().unwrap();
        *enabled_guard = true;
    }

    Ok(salt.to_string())
}

/// Clear encryption key from memory
pub fn clear_encryption() {
    let mut key_guard = ENCRYPTION_KEY.write().unwrap();
    if let Some(ref mut key) = *key_guard {
        // Zero out the key before dropping
        key.fill(0);
    }
    *key_guard = None;

    let mut enabled_guard = ENCRYPTION_ENABLED.write().unwrap();
    *enabled_guard = false;
}

/// Encrypt content if encryption is enabled, otherwise return as-is
pub fn maybe_encrypt(content: &str) -> Result<String> {
    if is_encryption_enabled() {
        encrypt(content)
    } else {
        Ok(content.to_string())
    }
}

/// Decrypt content if it looks encrypted, otherwise return as-is
pub fn maybe_decrypt(content: &str) -> Result<String> {
    if !is_encryption_enabled() {
        return Ok(content.to_string());
    }

    // Check if content looks like base64 encrypted data
    if content.len() > 16 && BASE64.decode(content).is_ok() {
        decrypt(content)
    } else {
        Ok(content.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt() {
        let password = "test_password_123";
        let salt = init_encryption(password, None).unwrap();

        let plaintext = "Hello, World! This is a secret message.";
        let encrypted = encrypt(plaintext).unwrap();

        // Encrypted should be different from plaintext
        assert_ne!(encrypted, plaintext);

        // Should be able to decrypt
        let decrypted = decrypt(&encrypted).unwrap();
        assert_eq!(decrypted, plaintext);

        // Re-init with same salt should work
        clear_encryption();
        init_encryption(password, Some(&salt)).unwrap();
        let decrypted2 = decrypt(&encrypted).unwrap();
        assert_eq!(decrypted2, plaintext);

        clear_encryption();
    }

    #[test]
    fn test_maybe_encrypt_decrypt() {
        // Without encryption enabled, should pass through
        let text = "Not encrypted";
        assert_eq!(maybe_encrypt(text).unwrap(), text);
        assert_eq!(maybe_decrypt(text).unwrap(), text);

        // Enable encryption
        init_encryption("password", None).unwrap();

        let encrypted = maybe_encrypt(text).unwrap();
        assert_ne!(encrypted, text);

        let decrypted = maybe_decrypt(&encrypted).unwrap();
        assert_eq!(decrypted, text);

        clear_encryption();
    }
}
