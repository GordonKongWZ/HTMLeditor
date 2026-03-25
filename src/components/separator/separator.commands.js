/**
 * separator.commands.js — Separator / Divider commands.
 */

import { insertBlock } from '../../core/commandManager.js';

/**
 * Insert a divider (horizontal rule) block.
 * @returns {Object}
 */
export function insertSeparator() {
  return insertBlock('divider', {});
}
