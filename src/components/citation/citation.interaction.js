/**
 * citation.interaction.js — Citation / Blockquote keyboard behavior.
 *
 * Enter inside a blockquote inserts a <br> (Shift+Enter equivalent).
 * The blockquote remains a single unified block.
 */

/**
 * Returns true if the keydown in a citation should be handled as a line break.
 * @param {KeyboardEvent} event
 * @returns {boolean}
 */
export function isCitationLineBreak(event) {
  return event.key === 'Enter' && !event.shiftKey;
}
