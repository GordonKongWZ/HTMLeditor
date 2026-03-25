/**
 * separator.model.js — Separator / Divider component schema definition.
 *
 * The separator is an atomic, non-editable block rendered as <hr>.
 */

import { registerComponent } from '../../core/schemaRegistry.js';

registerComponent({
  type:     'divider',
  label:    '分割线',
  cssClass: 'bi-divider',
  def:      '',

  match(el) {
    return el && el.tagName && el.tagName.toLowerCase() === 'hr';
  },

  normalize(_b) {
    // No content to normalize; divider is purely structural.
  },

  toHTML(b) {
    return '<hr data-bid="' + b.id + '">';
  },

  fromHTML(_el, mkBlock) {
    return mkBlock('divider', {});
  },

  /** Dividers don't accept paste. */
  onPaste(_fragment, _ctx) {
    return [];
  },

  /** Dividers are non-editable; no key handling needed. */
  onKeyDown(_event) {
    return false;
  },
});
