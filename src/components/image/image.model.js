/**
 * image.model.js — Image component schema definition.
 *
 * Image blocks are atomic (no inline editing).
 * Content is managed via the image dialog (ui/toolbar.js → openImgDialog).
 */

import { registerComponent } from '../../core/schemaRegistry.js';

registerComponent({
  type:     'img',
  label:    '图片',
  cssClass: 'bi-img',
  def:      '',

  match(el) {
    return el && el.tagName && el.tagName.toLowerCase() === 'figure'
      && (el.className || '').includes('af');
  },

  normalize(b) {
    if (!b.data) b.data = {};
    if (typeof b.data.src     !== 'string') b.data.src = '';
    if (typeof b.data.alt     !== 'string') b.data.alt = '';
    if (typeof b.data.caption !== 'string') b.data.caption = '';
    if (typeof b.data.fignum  !== 'string') b.data.fignum = '';
  },

  toHTML(b) {
    var d = b.data || {};
    var numStr = d.fignum ? '<p class="fn">' + d.fignum + '</p>' : '';
    var capStr = d.caption ? '<figcaption>' + d.caption + '</figcaption>' : '';
    var imgEl  = d.src ? '<img src="' + d.src + '" alt="' + (d.alt || '') + '">' : '';
    return '<figure class="af" data-bid="' + b.id + '">' + imgEl + capStr + numStr + '</figure>';
  },

  fromHTML(el, mkBlock) {
    var img = el.querySelector('img');
    var cap = el.querySelector('figcaption');
    var fn  = el.querySelector('.fn');
    return mkBlock('img', {
      src:     img ? (img.getAttribute('src') || '') : '',
      alt:     img ? (img.getAttribute('alt') || '') : '',
      caption: cap ? cap.textContent.trim() : '',
      fignum:  fn  ? fn.textContent.trim()  : '',
    });
  },

  /** Images don't accept paste directly. */
  onPaste(_fragment, _ctx) {
    return [];
  },

  onKeyDown(_event) {
    return false;
  },
});
