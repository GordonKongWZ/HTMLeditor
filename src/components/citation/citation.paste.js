/**
 * citation.paste.js — Citation (blockquote) paste handler.
 *
 * Pasting into a blockquote strips block structure and inserts inline content only.
 * Delegates to the shared _handleGenericRichPaste utility from pastePipeline.js.
 *
 * The handler is registered on the 'inlinePaste:blockquote' event so that
 * editor.js can dispatch paste events generically by block type.
 */

import { on }                        from '../../core/eventBus.js';
import { _handleGenericRichPaste }   from '../../core/pastePipeline.js';
import { getComponent }              from '../../core/schemaRegistry.js';

/**
 * Filter pasted text for use inside a blockquote.
 * Returns a single-line string (strips newlines and block markup).
 * @param {string} text
 * @returns {string}
 */
export function citationPasteFilter(text) {
  return (text || '').replace(/\s*\n\s*/g, ' ').trim();
}

// Wire the blockquote inline paste handler to the generic type-keyed event.
on('inlinePaste:blockquote', function(e) { _handleGenericRichPaste(e); });

// Expose on the descriptor so moduleManager can detect the capability.
var _comp = getComponent('blockquote');
if (_comp) _comp.inlinePaste = _handleGenericRichPaste;

