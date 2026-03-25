/**
 * citation.commands.js — Citation / Blockquote commands.
 */

import { insertBlock } from '../../core/commandManager.js';

/**
 * Insert a blockquote (citation) block.
 * @param {string} [content]
 * @returns {Object}
 */
export function insertCitation(content) {
  return insertBlock('blockquote', content != null ? { content } : {});
}
