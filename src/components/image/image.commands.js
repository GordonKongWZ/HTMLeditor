/**
 * image.commands.js — Image component commands.
 */

import { insertBlock } from '../../core/commandManager.js';

/**
 * Insert an image block.
 * @param {Object} data — { src, alt, caption, fignum }
 * @returns {Object}
 */
export function insertImage(data) {
  return insertBlock('img', data || {});
}
