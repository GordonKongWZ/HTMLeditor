/**
 * abstract.interaction.js — Abstract keyboard behavior.
 *
 * The abstract block is a single rich-text area.
 * Enter inserts a line break (Shift+Enter behavior) by default.
 * Extension point: could enforce single-paragraph constraint on Enter.
 */

/**
 * Returns true if the keydown should insert a line break instead of splitting.
 * @param {KeyboardEvent} event
 * @returns {boolean}
 */
export function isAbstractLineBreak(event) {
  return event.key === 'Enter' && !event.shiftKey;
}
