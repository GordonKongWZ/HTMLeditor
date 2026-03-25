/**
 * paragraph.model.js — Paragraph component schema definition.
 */

import { registerComponent } from '../../core/schemaRegistry.js';

registerComponent({
  type:     'p',
  label:    '段落',
  cssClass: 'bi-p',
  def:      '',

  match(el) {
    return el && el.tagName && el.tagName.toLowerCase() === 'p'
      && !(el.className || '').includes('paper-authors');
  },

  normalize(b) {
    if (typeof b.content !== 'string') b.content = '';
    if (!b.data) b.data = {};
    if (typeof b.data.align !== 'string') b.data.align = '';
  },

  toHTML(b) {
    var al = b.data && b.data.align ? ' style="text-align:' + b.data.align + '"' : '';
    return '<p data-bid="' + b.id + '"' + al + '>' + (b.content || '') + '</p>';
  },

  fromHTML(el, mkBlock) {
    return mkBlock('p', {
      content: el.innerHTML.trim(),
      align: el.style.textAlign || '',
    });
  },

  /**
   * onPaste: paragraphs handle multi-block paste via pastePipeline.
   * Returns null to use default pipeline.
   */
  onPaste(_fragment, _ctx) {
    return null;
  },

  /**
   * onKeyDown: Enter splits the paragraph at cursor.
   * This is wired in _buildInner via the 'splitParagraph' event.
   */
  onKeyDown(_event) {
    return false; // handled by makeRichBE opts.onEnter
  },
});
