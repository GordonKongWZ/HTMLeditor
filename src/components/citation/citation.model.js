/**
 * citation.model.js — Citation / Blockquote component schema definition.
 *
 * "Citation" maps to the blockquote block type.
 */

import { registerComponent } from '../../core/schemaRegistry.js';

registerComponent({
  type:     'blockquote',
  label:    '引用',
  cssClass: 'bi-blockquote',
  def:      '',

  match(el) {
    return el && el.tagName && el.tagName.toLowerCase() === 'blockquote';
  },

  normalize(b) {
    if (typeof b.content !== 'string') b.content = '';
  },

  toHTML(b) {
    return '<blockquote data-bid="' + b.id + '"><p>' + (b.content || '') + '</p></blockquote>';
  },

  fromHTML(el, mkBlock) {
    var p = el.querySelector('p');
    return mkBlock('blockquote', { content: (p ? p.innerHTML : el.innerHTML).trim() });
  },

  /** onPaste: insert sanitized inline HTML only (no new blocks). */
  onPaste(_fragment, _ctx) {
    return null; // handled by _handleGenericRichPaste
  },

  onKeyDown(_event) {
    return false;
  },
});
