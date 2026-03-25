/**
 * paragraph.interaction.js — Paragraph keyboard / edit behavior.
 *
 * Enter key splits the paragraph at the cursor.
 * This is wired in editor.js _buildInner via makeRichBE opts.onEnter
 * which emits 'splitParagraph' → pastePipeline._splitParagraphAtCursor.
 */

/**
 * Returns true if the keydown event should split the paragraph.
 * @param {KeyboardEvent} event
 * @returns {boolean}
 */
export function isParagraphSplitKey(event) {
  return event.key === 'Enter' && !event.shiftKey;
}
