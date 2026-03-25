/**
 * paragraph.commands.js — Paragraph-specific commands.
 */

import { insertBlock } from '../../core/commandManager.js';

/**
 * Insert a new paragraph block with optional initial content.
 * @param {string} [content]
 * @param {string} [align]
 * @returns {Object} the new block
 */
export function insertParagraph(content, align) {
  return insertBlock('p', { content: content || '', align: align || '' });
}
