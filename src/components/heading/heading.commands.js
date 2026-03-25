/**
 * heading.commands.js — Heading component commands.
 *
 * Provides insert/update helpers specific to heading blocks.
 * Generic block operations (move, delete, duplicate) live in commandManager.js.
 */

import { insertBlock } from '../../core/commandManager.js';

/**
 * Insert a heading block of the given level (1–5).
 * @param {number} level — 1 to 5
 * @param {string} [content] — optional initial text
 * @returns {Object} the new block
 */
export function insertHeading(level, content) {
  var type = 'h' + Math.min(5, Math.max(1, level));
  return insertBlock(type, content != null ? { content: content } : {});
}
