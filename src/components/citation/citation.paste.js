/**
 * citation.paste.js — Citation paste rules.
 *
 * Pasting into a blockquote strips block structure and inserts inline content only.
 * Delegated to _handleGenericRichPaste in pastePipeline.js.
 */

/**
 * Filter pasted text for use inside a blockquote.
 * Returns a single-line string (strips newlines and block markup).
 * @param {string} text
 * @returns {string}
 */
export function citationPasteFilter(text) {
  return (text || '').replace(/\s*\n\s*/g, ' ').trim();
}
