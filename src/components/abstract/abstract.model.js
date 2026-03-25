/**
 * abstract.model.js — Abstract component schema definition.
 */

import { registerComponent } from '../../core/schemaRegistry.js';

registerComponent({
  type:     'abstract',
  label:    '摘要',
  cssClass: 'bi-abstract',
  def:      '',

  match(el) {
    return el && (el.className || '').includes('abstract-box');
  },

  normalize(b) {
    if (typeof b.content !== 'string') b.content = '';
    if (!b.data) b.data = {};
    if (typeof b.data.align !== 'string') b.data.align = '';
  },

  toHTML(b) {
    var al = b.data && b.data.align ? ' style="text-align:' + b.data.align + '"' : '';
    return '<div class="abstract-box" data-bid="' + b.id + '"' + al + '>'
      + '<p class="abs-label">Abstract / 摘要</p>'
      + '<p>' + (b.content || '') + '</p>'
      + '</div>';
  },

  fromHTML(el, mkBlock) {
    var p = el.querySelector('p:not(.abs-label)');
    return mkBlock('abstract', {
      content: p ? p.innerHTML.trim() : '',
      align: el.style.textAlign || '',
    });
  },

  onPaste(_fragment, _ctx) {
    return null; // handled by _handleGenericRichPaste
  },

  onKeyDown(_event) {
    return false;
  },
});
