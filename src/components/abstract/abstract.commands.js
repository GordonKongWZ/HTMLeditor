/**
 * abstract.commands.js — Abstract component commands.
 */

import { insertBlock } from '../../core/commandManager.js';

/**
 * Insert an abstract block.
 * @param {string} [content]
 * @returns {Object}
 */
export function insertAbstract(content) {
  return insertBlock('abstract', content != null ? { content } : {});
}
