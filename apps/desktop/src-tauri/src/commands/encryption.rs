use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

use crate::crypto;
use crate::error::{AppError, Result};

fn get_salt_path(app: &AppHandle) -> PathBuf {
    let app_dir = app.path().app_data_dir().expect("Failed to get app data dir");
    app_dir.join(".encryption_salt")
}

#[tauri::command]
pub fn is_encryption_enabled() -> bool {
    crypto::is_encryption_enabled()
}

#[tauri::command]
pub fn has_encryption_configured(app: AppHandle) -> bool {
    get_salt_path(&app).exists()
}

#[tauri::command]
pub fn setup_encryption(app: AppHandle, password: String) -> Result<()> {
    let salt_path = get_salt_path(&app);

    // Check if encryption is already configured
    if salt_path.exists() {
        return Err(AppError::Encryption(
            "Encryption already configured. Use unlock_encryption instead.".to_string()
        ));
    }

    // Initialize encryption and save salt
    let salt = crypto::init_encryption(&password, None)?;
    fs::write(&salt_path, &salt)
        .map_err(|e| AppError::Io(format!("Failed to save salt: {}", e)))?;

    Ok(())
}

#[tauri::command]
pub fn unlock_encryption(app: AppHandle, password: String) -> Result<()> {
    let salt_path = get_salt_path(&app);

    if !salt_path.exists() {
        return Err(AppError::Encryption(
            "Encryption not configured. Use setup_encryption first.".to_string()
        ));
    }

    let salt = fs::read_to_string(&salt_path)
        .map_err(|e| AppError::Io(format!("Failed to read salt: {}", e)))?;

    crypto::init_encryption(&password, Some(&salt))?;

    Ok(())
}

#[tauri::command]
pub fn lock_encryption() -> Result<()> {
    crypto::clear_encryption();
    Ok(())
}

#[tauri::command]
pub fn change_encryption_password(app: AppHandle, old_password: String, new_password: String) -> Result<()> {
    let salt_path = get_salt_path(&app);

    if !salt_path.exists() {
        return Err(AppError::Encryption("Encryption not configured".to_string()));
    }

    // Verify old password by trying to unlock
    let old_salt = fs::read_to_string(&salt_path)
        .map_err(|e| AppError::Io(format!("Failed to read salt: {}", e)))?;

    crypto::init_encryption(&old_password, Some(&old_salt))?;

    // Clear and set up with new password
    crypto::clear_encryption();
    let new_salt = crypto::init_encryption(&new_password, None)?;

    fs::write(&salt_path, &new_salt)
        .map_err(|e| AppError::Io(format!("Failed to save new salt: {}", e)))?;

    Ok(())
}

#[tauri::command]
pub fn disable_encryption(app: AppHandle, password: String) -> Result<()> {
    let salt_path = get_salt_path(&app);

    if !salt_path.exists() {
        return Err(AppError::Encryption("Encryption not configured".to_string()));
    }

    // Verify password
    let salt = fs::read_to_string(&salt_path)
        .map_err(|e| AppError::Io(format!("Failed to read salt: {}", e)))?;

    crypto::init_encryption(&password, Some(&salt))?;

    // Clear encryption and remove salt file
    crypto::clear_encryption();
    fs::remove_file(&salt_path)
        .map_err(|e| AppError::Io(format!("Failed to remove salt: {}", e)))?;

    Ok(())
}
