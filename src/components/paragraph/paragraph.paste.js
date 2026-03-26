/**
 * paragraph.paste.js — Paragraph paste handler.
 *
 * Owns the inline paste logic for paragraph blocks:
 *   - Single-paragraph paste: insert inline at the caret.
 *   - Multi-paragraph paste:  split the current block at the caret and insert
 *     additional paragraph blocks below.
 *
 * The handler is registered on the 'inlinePaste:p' event so that
 * editor.js can dispatch paste events generically by block type.
 */

import { on }                                         from '../../core/eventBus.js';
import {
  _htmlToParagraphs,
  _getCaretSplitContent,
  _insertPBlocksAfter,
  _parsePasteContent,
} from '../../core/pastePipeline.js';
import { syncCode, schedPv, _updateCount, $id }       from '../../core/editor.js';
import { getComponent }                               from '../../core/schemaRegistry.js';

/**
 * Inline paste filter: sanitize and return safe inline HTML for a single paste
 * into an existing paragraph. Called for single-paragraph pastes.
 * @param {string} inlineHtml — already-cleaned inline HTML fragment
 * @returns {string}
 */
export function paragraphInlinePasteFilter(inlineHtml) {
  // Currently a pass-through; sanitization is done upstream in _htmlToParagraphs.
  // Extension point: apply paragraph-specific inline transformations here.
  return inlineHtml || '';
}

/**
 * Handle paste inside a paragraph block.
 * Intercepts clipboard, parses into inline segments, inserts blocks.
 * @param {ClipboardEvent} e
 * @param {HTMLElement} d — the contentEditable element
 * @param {Object} b — the block object
 */
function _handlePBlockPaste(e, d, b) {
  e.preventDefault();
  var html  = e.clipboardData ? e.clipboardData.getData('text/html')  : '';
  var text  = e.clipboardData ? e.clipboardData.getData('text/plain') : '';
  var paras = _htmlToParagraphs(html, text);
  if (!paras.length) return;

  if (paras.length === 1) {
    // Single paragraph: insert inline at caret
    document.execCommand('insertHTML', false, paras[0]);
    b.content = d.innerHTML;
    syncCode(); schedPv();
    return;
  }

  var parts = _getCaretSplitContent(d);
  var firstContent = parts.before + paras[0];
  var lastContent  = paras[paras.length - 1] + parts.after;
  var allContents  = [firstContent].concat(paras.slice(1, -1)).concat([lastContent]);

  d.innerHTML = allContents[0];
  b.content = allContents[0];

  var hint = $id('ehint'); if (hint && hint.parentNode) hint.parentNode.removeChild(hint);
  var lastId = _insertPBlocksAfter(b.id, allContents.slice(1), b.data.align || '');
  _updateCount(); syncCode(); schedPv();

  setTimeout(function() {
    var lastBEl = $id(lastId);
    if (!lastBEl) return;
    var richEl = lastBEl.querySelector('.rich-be');
    if (!richEl) return;
    richEl.focus();
    var s = window.getSelection();
    var r = document.createRange();
    r.selectNodeContents(richEl);
    r.collapse(false);
    s.removeAllRanges(); s.addRange(r);
  }, 10);
}

// Wire the paragraph inline paste handler to the generic type-keyed event.
on('inlinePaste:p', _handlePBlockPaste);

// Expose the handler and a global paste parser on the registered descriptor
// so moduleManager can detect capabilities and future callers can bypass the eventBus.
var _comp = getComponent('p');
if (_comp) {
  _comp.inlinePaste = _handlePBlockPaste;
  // globalPasteParser: interpret clipboard as plain paragraph blocks.
  // This is the default fallback used by the global paste dialog.
  _comp.globalPasteParser = function(html, text) {
    return _parsePasteContent(html, text);
  };
}

