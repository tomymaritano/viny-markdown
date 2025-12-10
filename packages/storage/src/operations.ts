// =============================================================================
// Operation Log Repository
// =============================================================================

import type { Operation, OperationType, EntityType } from '@viny/domain';
import { dbExecute, dbSelect, saveDatabase } from './database.js';
import { generateId, now, computeChecksumSync } from './utils.js';

export interface CreateOperationInput {
  type: OperationType;
  entityType: EntityType;
  entityId: string;
  payload: unknown;
  deviceId: string;
  ownerId: string;
}

// DB row type (snake_case from SQLite)
interface OperationRow {
  id: string;
  type: OperationType;
  entity_type: EntityType;
  entity_id: string;
  payload: string;
  timestamp: string;
  server_seq: number | null;
  device_id: string;
  owner_id: string;
  synced_at: string | null;
  checksum: string;
}

// Convert DB row to Operation domain object
function rowToOperation(row: OperationRow): Operation {
  return {
    id: row.id,
    type: row.type,
    entityType: row.entity_type,
    entityId: row.entity_id,
    payload: JSON.parse(row.payload),
    timestamp: row.timestamp,
    serverSeq: row.server_seq,
    deviceId: row.device_id,
    ownerId: row.owner_id,
    syncedAt: row.synced_at,
    checksum: row.checksum,
  };
}

/**
 * Create and persist a new operation
 */
export async function createOperation(input: CreateOperationInput): Promise<Operation> {
  const timestamp = now();
  const payloadJson = JSON.stringify(input.payload);
  const checksum = computeChecksumSync(payloadJson);

  const operation: Operation = {
    id: generateId(),
    type: input.type,
    entityType: input.entityType,
    entityId: input.entityId,
    payload: input.payload,
    timestamp,
    serverSeq: null,
    deviceId: input.deviceId,
    ownerId: input.ownerId,
    syncedAt: null,
    checksum,
  };

  await dbExecute(
    `INSERT INTO operations (id, type, entity_type, entity_id, payload, timestamp, server_seq, device_id, owner_id, synced_at, checksum)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      operation.id,
      operation.type,
      operation.entityType,
      operation.entityId,
      payloadJson,
      operation.timestamp,
      operation.serverSeq,
      operation.deviceId,
      operation.ownerId,
      operation.syncedAt,
      operation.checksum,
    ]
  );

  saveDatabase();
  return operation;
}

/**
 * Get all operations for an entity
 */
export async function getOperationsForEntity(entityId: string): Promise<Operation[]> {
  const rows = await dbSelect<OperationRow>(
    `SELECT * FROM operations WHERE entity_id = ? ORDER BY timestamp ASC`,
    [entityId]
  );
  return rows.map(rowToOperation);
}

/**
 * Get unsynced operations
 */
export async function getUnsyncedOperations(): Promise<Operation[]> {
  const rows = await dbSelect<OperationRow>(
    `SELECT * FROM operations WHERE synced_at IS NULL ORDER BY timestamp ASC`
  );
  return rows.map(rowToOperation);
}

/**
 * Get operations since a timestamp
 */
export async function getOperationsSince(timestamp: string): Promise<Operation[]> {
  const rows = await dbSelect<OperationRow>(
    `SELECT * FROM operations WHERE timestamp > ? ORDER BY timestamp ASC`,
    [timestamp]
  );
  return rows.map(rowToOperation);
}

/**
 * Mark operations as synced
 */
export async function markOperationsSynced(
  operationIds: string[],
  serverSeqs: Map<string, number>
): Promise<void> {
  const syncedAt = now();

  for (const id of operationIds) {
    const serverSeq = serverSeqs.get(id) ?? null;
    await dbExecute(
      `UPDATE operations SET synced_at = ?, server_seq = ? WHERE id = ?`,
      [syncedAt, serverSeq, id]
    );
  }

  saveDatabase();
}
