/**
 * abstract.paste.js — Abstract paste rules.
 *
 * Pasting into an abstract strips block structure and inserts inline content only.
 * Delegated to _handleGenericRichPaste in pastePipeline.js.
 */

/**
 * Filter pasted text for use inside an abstract.
 * Extension point: could enforce max length or single-paragraph constraint.
 * @param {string} text
 * @returns {string}
 */
export function abstractPasteFilter(text) {
  return (text || '').trim();
}
