/**
 * paragraph.paste.js — Paragraph paste rules.
 *
 * Multi-block paste is handled by the central paste pipeline
 * (pastePipeline.js → _handlePBlockPaste).
 * This file documents the single-paragraph inline paste behavior.
 */

/**
 * Inline paste filter: sanitize and return safe inline HTML for a single paste
 * into an existing paragraph. Called by pastePipeline._handlePBlockPaste for
 * single-paragraph pastes.
 * @param {string} inlineHtml — already-cleaned inline HTML fragment
 * @returns {string}
 */
export function paragraphInlinePasteFilter(inlineHtml) {
  // Currently a pass-through; sanitization is done upstream in _htmlToParagraphs.
  // Extension point: apply paragraph-specific inline transformations here.
  return inlineHtml || '';
}
