/**
 * abstract.paste.js — Abstract paste handler.
 *
 * Pasting into an abstract strips block structure and inserts inline content only.
 * Delegates to the shared _handleGenericRichPaste utility from pastePipeline.js.
 *
 * The handler is registered on the 'inlinePaste:abstract' event so that
 * editor.js can dispatch paste events generically by block type.
 */

import { on }                        from '../../core/eventBus.js';
import { _handleGenericRichPaste }   from '../../core/pastePipeline.js';
import { getComponent }              from '../../core/schemaRegistry.js';

/**
 * Filter pasted text for use inside an abstract.
 * Extension point: could enforce max length or single-paragraph constraint.
 * @param {string} text
 * @returns {string}
 */
export function abstractPasteFilter(text) {
  return (text || '').trim();
}

// Wire the abstract inline paste handler to the generic type-keyed event.
on('inlinePaste:abstract', function(e) { _handleGenericRichPaste(e); });

// Expose on the descriptor so moduleManager can detect the capability.
var _comp = getComponent('abstract');
if (_comp) _comp.inlinePaste = _handleGenericRichPaste;

