/**
 * selection.js — Block selection state management.
 *
 * Manages the currently selected block, updates DOM highlight classes,
 * and synchronises the tree / code / preview panes.
 */

import { state, $id, scrollEditorToBlock, _scrollCodeToBlock, schedPv } from './editor.js';
import { emit } from './eventBus.js';

/**
 * Select a block by id (or pass null to deselect).
 * Updates DOM, emits 'blockSelected' event, and synchronises panes.
 * @param {string|null} id
 */
export function setSelected(id) {
  // Remove old selection highlight
  if (state.sel) {
    var oldEl = $id(state.sel);
    if (oldEl) oldEl.classList.remove('sel');
    // Update tree node highlight
    var oldTn = $id('tn-' + state.sel);
    if (oldTn) {
      var oldHdr = oldTn.querySelector('.tn-hdr');
      if (oldHdr) oldHdr.classList.remove('tn-sel');
    }
  }

  state.sel = id || null;

  if (id) {
    var el = $id(id);
    if (el) el.classList.add('sel');
    // Update tree node highlight
    var tn = $id('tn-' + id);
    if (tn) {
      var hdr = tn.querySelector('.tn-hdr');
      if (hdr) hdr.classList.add('tn-sel');
    }
    scrollEditorToBlock(id);
    _scrollCodeToBlock(id);
    // Highlight block in preview
    state.pendingScrollBid = id;
    schedPv();
  }

  emit('blockSelected', id);
}
