// =============================================================================
// Database Initialization (Tauri SQLite or sql.js/WASM fallback)
// =============================================================================

import initSqlJs, { type Database } from 'sql.js';
import { SCHEMA } from './schema.js';

// Check if running in Tauri
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

let db: Database | null = null;
let initialized = false;

// =============================================================================
// Tauri Native SQLite Support
// =============================================================================

type TauriDatabase = {
  execute: (sql: string, params?: unknown[]) => Promise<{ rowsAffected: number; lastInsertId: number }>;
  select: <T>(sql: string, params?: unknown[]) => Promise<T[]>;
  close: () => Promise<void>;
};

let tauriDb: TauriDatabase | null = null;

export async function initTauriDatabase(): Promise<TauriDatabase> {
  if (tauriDb) return tauriDb;

  if (!isTauri()) {
    throw new Error('Not running in Tauri environment');
  }

  // Dynamic import with string literal to avoid static analysis
  // This will only be resolved at runtime when in Tauri
  const modulePath = '@tauri-apps/plugin-sql';
  const module = await import(/* @vite-ignore */ modulePath);
  const Database = module.default;
  tauriDb = await Database.load('sqlite:viny.db') as TauriDatabase;
  console.log('Tauri native SQLite initialized');
  return tauriDb;
}

export function getTauriDatabase(): TauriDatabase | null {
  return tauriDb;
}

// Async execute for Tauri
export async function tauriExecute(sql: string, params: unknown[] = []): Promise<{ rowsAffected: number; lastInsertId: number }> {
  if (!tauriDb) {
    await initTauriDatabase();
  }
  return tauriDb!.execute(sql, params);
}

// Async select for Tauri
export async function tauriSelect<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  if (!tauriDb) {
    await initTauriDatabase();
  }
  return tauriDb!.select<T>(sql, params);
}

// =============================================================================
// sql.js (WASM) - Web fallback
// =============================================================================

async function initSqlJsDatabase(): Promise<Database> {
  if (db) return db;

  const SQL = await initSqlJs({
    locateFile: (file) => `https://sql.js.org/dist/${file}`,
  });

  // Try to load from localStorage
  const savedData = localStorage.getItem('viny-db');
  if (savedData) {
    const uint8Array = new Uint8Array(
      atob(savedData)
        .split('')
        .map((c) => c.charCodeAt(0))
    );
    db = new SQL.Database(uint8Array);
  } else {
    db = new SQL.Database();
    db.run(SCHEMA);
  }

  return db;
}

// =============================================================================
// Unified Async Database API
// =============================================================================

/**
 * Initialize the database (Tauri native or sql.js fallback)
 */
export async function initDatabase(): Promise<void> {
  if (initialized) return;

  if (isTauri()) {
    await initTauriDatabase();
    console.log('Using Tauri native SQLite');
  } else {
    await initSqlJsDatabase();
    console.log('Using sql.js (WASM)');
  }

  initialized = true;
}

/**
 * Execute a SQL statement (INSERT, UPDATE, DELETE)
 */
export async function dbExecute(sql: string, params: unknown[] = []): Promise<{ rowsAffected: number }> {
  if (!initialized) {
    await initDatabase();
  }

  if (isTauri() && tauriDb) {
    const result = await tauriDb.execute(sql, params);
    return { rowsAffected: result.rowsAffected };
  } else if (db) {
    db.run(sql, params);
    const changes = db.getRowsModified();
    return { rowsAffected: changes };
  }

  throw new Error('Database not initialized');
}

/**
 * Query the database (SELECT)
 * Returns array of objects with column names as keys
 */
export async function dbSelect<T extends Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  if (!initialized) {
    await initDatabase();
  }

  if (isTauri() && tauriDb) {
    // Tauri returns objects directly
    return tauriDb.select<T>(sql, params);
  } else if (db) {
    // sql.js returns { columns: [], values: [[]] } - convert to objects
    const result = db.exec(sql, params);
    if (!result.length || !result[0].values.length) return [];

    const columns = result[0].columns;
    return result[0].values.map((row) => {
      const obj: Record<string, unknown> = {};
      columns.forEach((col, i) => {
        obj[col] = row[i];
      });
      return obj as T;
    });
  }

  throw new Error('Database not initialized');
}

/**
 * Save the database (only needed for sql.js - localStorage persistence)
 */
export function saveDatabase(): void {
  if (!db || isTauri()) return;

  const data = db.export();
  const base64 = btoa(String.fromCharCode(...data));
  localStorage.setItem('viny-db', base64);
}

// Legacy sync API (deprecated - use dbSelect/dbExecute)
export function getDatabase(): Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    saveDatabase();
    db.close();
    db = null;
  }

  if (tauriDb) {
    tauriDb.close().catch(console.error);
    tauriDb = null;
  }

  initialized = false;
}
