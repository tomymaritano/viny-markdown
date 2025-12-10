// =============================================================================
// Domain Invariants
// =============================================================================

import type { Note, Notebook, Tag, Operation, DomainError } from './types.js';

export type ValidationResult =
  | { valid: true }
  | { valid: false; error: DomainError };

// -----------------------------------------------------------------------------
// Note Invariants
// -----------------------------------------------------------------------------

export function validateNote(note: Partial<Note>): ValidationResult {
  if (note.title !== undefined && note.title.length > 500) {
    return {
      valid: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Note title cannot exceed 500 characters',
        context: { field: 'title', maxLength: 500 },
      },
    };
  }

  if (note.content !== undefined && note.content.length > 1_000_000) {
    return {
      valid: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Note content cannot exceed 1MB',
        context: { field: 'content', maxLength: 1_000_000 },
      },
    };
  }

  if (note.tags !== undefined && note.tags.length > 50) {
    return {
      valid: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Note cannot have more than 50 tags',
        context: { field: 'tags', maxCount: 50 },
      },
    };
  }

  return { valid: true };
}

// -----------------------------------------------------------------------------
// Notebook Invariants
// -----------------------------------------------------------------------------

export function validateNotebook(notebook: Partial<Notebook>): ValidationResult {
  if (notebook.name !== undefined) {
    if (notebook.name.trim().length === 0) {
      return {
        valid: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Notebook name cannot be empty',
          context: { field: 'name' },
        },
      };
    }

    if (notebook.name.length > 100) {
      return {
        valid: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Notebook name cannot exceed 100 characters',
          context: { field: 'name', maxLength: 100 },
        },
      };
    }
  }

  // Prevent circular parent references
  if (notebook.id && notebook.parentId && notebook.id === notebook.parentId) {
    return {
      valid: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Notebook cannot be its own parent',
        context: { field: 'parentId' },
      },
    };
  }

  return { valid: true };
}

// -----------------------------------------------------------------------------
// Tag Invariants
// -----------------------------------------------------------------------------

export function validateTag(tag: Partial<Tag>): ValidationResult {
  if (tag.name !== undefined) {
    if (tag.name.trim().length === 0) {
      return {
        valid: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Tag name cannot be empty',
          context: { field: 'name' },
        },
      };
    }

    if (tag.name.length > 50) {
      return {
        valid: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Tag name cannot exceed 50 characters',
          context: { field: 'name', maxLength: 50 },
        },
      };
    }

    // Tags should be alphanumeric with hyphens/underscores
    if (!/^[\w\-\s]+$/u.test(tag.name)) {
      return {
        valid: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Tag name can only contain letters, numbers, hyphens, underscores, and spaces',
          context: { field: 'name' },
        },
      };
    }
  }

  return { valid: true };
}

// -----------------------------------------------------------------------------
// Operation Invariants
// -----------------------------------------------------------------------------

export function validateOperation(operation: Partial<Operation>): ValidationResult {
  if (!operation.type) {
    return {
      valid: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Operation type is required',
        context: { field: 'type' },
      },
    };
  }

  if (!operation.entityType) {
    return {
      valid: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Operation entityType is required',
        context: { field: 'entityType' },
      },
    };
  }

  if (!operation.entityId) {
    return {
      valid: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Operation entityId is required',
        context: { field: 'entityId' },
      },
    };
  }

  if (!operation.deviceId) {
    return {
      valid: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Operation deviceId is required',
        context: { field: 'deviceId' },
      },
    };
  }

  if (!operation.checksum) {
    return {
      valid: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Operation checksum is required',
        context: { field: 'checksum' },
      },
    };
  }

  return { valid: true };
}
