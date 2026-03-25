/**
 * history.js — Undo/redo history management (placeholder).
 *
 * The current editor relies on native contentEditable undo for rich-text fields
 * and full block-state snapshots for structural changes.
 *
 * Extension point: replace the no-op stubs below with a full snapshot/replay
 * implementation when undo/redo across block operations is required.
 */

/** @type {Array<string>} JSON snapshots of _blocks state */
const _stack = [];
let _cursor = -1;
const MAX_HISTORY = 50;

/**
 * Push a JSON snapshot of the current block list onto the history stack.
 * @param {string} snapshot — JSON.stringify(_blocks)
 */
export function pushSnapshot(snapshot) {
  // Discard any redo entries above current cursor
  _stack.splice(_cursor + 1);
  _stack.push(snapshot);
  if (_stack.length > MAX_HISTORY) _stack.shift();
  _cursor = _stack.length - 1;
}

/**
 * Retrieve the previous snapshot (undo), or null if at beginning.
 * @returns {string|null}
 */
export function undo() {
  if (_cursor <= 0) return null;
  _cursor--;
  return _stack[_cursor];
}

/**
 * Retrieve the next snapshot (redo), or null if at end.
 * @returns {string|null}
 */
export function redo() {
  if (_cursor >= _stack.length - 1) return null;
  _cursor++;
  return _stack[_cursor];
}

/** Clear all history. */
export function clearHistory() {
  _stack.length = 0;
  _cursor = -1;
}

/** True when undo is available. */
export function canUndo() { return _cursor > 0; }

/** True when redo is available. */
export function canRedo() { return _cursor < _stack.length - 1; }
