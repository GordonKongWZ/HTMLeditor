/**
 * heading.model.js — Heading component schema definition.
 *
 * Registers h1–h5 heading components with the central schemaRegistry.
 * Each heading level shares the same behavior but different CSS class and label.
 */

import { registerComponent } from '../../core/schemaRegistry.js';

/** Heading levels h1–h5 share the same component contract. */
[1, 2, 3, 4, 5].forEach(function(level) {
  var type = 'h' + level;
  registerComponent({
    type:     type,
    label:    'H' + level,
    cssClass: 'bi-' + type,
    def:      '',

    /**
     * Match: returns true when el is a heading element of this level.
     * @param {Element} el
     */
    match(el) {
      return el && el.tagName && el.tagName.toLowerCase() === type;
    },

    /**
     * Normalize: ensure content is plain text only (no block children).
     * @param {Object} b — block object
     */
    normalize(b) {
      if (typeof b.content !== 'string') b.content = String(b.content || '');
    },

    /**
     * Serialize block → HTML string.
     * @param {Object} b
     */
    toHTML(b) {
      return '<' + type + ' data-bid="' + b.id + '">' + (b.content || '') + '</' + type + '>';
    },

    /**
     * Parse DOM element → block object.
     * @param {Element} el
     * @param {Function} mkBlock
     */
    fromHTML(el, mkBlock) {
      return mkBlock(type, { content: el.innerHTML.trim() });
    },

    /**
     * onPaste: headings accept plain text only.
     * Returns null to fall back to default paragraph paste behavior.
     */
    onPaste(_fragment, _ctx) {
      return null; // Extension point: could strip formatting
    },

    /**
     * onKeyDown: Enter blurs the heading (creating a new paragraph below is
     * handled by the toolbar Insert shortcut).
     * @param {KeyboardEvent} event
     */
    onKeyDown(event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        event.target.blur();
        return true;
      }
      return false;
    },
  });
});
