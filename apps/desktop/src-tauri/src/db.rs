use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

use crate::error::Result;

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn new(path: PathBuf) -> Result<Self> {
        let conn = Connection::open(path)?;
        conn.execute_batch("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;")?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    pub fn init_schema(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        conn.execute_batch(include_str!("schema.sql"))?;
        Ok(())
    }

    pub fn conn(&self) -> std::sync::MutexGuard<'_, Connection> {
        self.conn.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

#[allow(dead_code)]
pub fn get_db(app: &AppHandle) -> tauri::State<'_, Database> {
    app.state::<Database>()
}

pub fn init_database(app: &AppHandle) -> std::result::Result<(), Box<dyn std::error::Error>> {
    let app_dir = app.path().app_data_dir().expect("Failed to get app data dir");
    std::fs::create_dir_all(&app_dir).expect("Failed to create app data dir");

    let db_path = app_dir.join("viny.db");
    let db = Database::new(db_path).map_err(|e| Box::new(e) as Box<dyn std::error::Error>)?;
    db.init_schema().map_err(|e| Box::new(e) as Box<dyn std::error::Error>)?;

    app.manage(db);
    Ok(())
}
