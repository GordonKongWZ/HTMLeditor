/**
 * commandManager.js — Block-level commands (insert, move, delete, duplicate, reorder).
 *
 * All structural mutations to state.blocks go through these functions.
 * Each command updates state, DOM, code textarea, and schedules a preview refresh.
 */

import { state, $id, mkBlock, _buildBlockEl, _appendBlockEl, _refreshInner, syncCode, schedPv, _updateCount, b2html, parseHtmlToBlocks } from './editor.js';
import { setSelected } from './selection.js';
import { on, emit } from './eventBus.js';

/* =========================================================
   INSERT
   ========================================================= */

/**
 * Insert a new block of the given type, with optional pre-set data.
 * Inserts after the currently selected block (or appends to end).
 * @param {string} type
 * @param {Object} [data]
 * @returns {Object} the new block object
 */
export function insertBlock(type, data) {
  var b = mkBlock(type, data);
  var selIdx = state.sel
    ? state.blocks.findIndex(function(x){ return x.id === state.sel; })
    : -1;

  if (selIdx >= 0) {
    state.blocks.splice(selIdx + 1, 0, b);
    var hint = $id('ehint'); if (hint && hint.parentNode) hint.parentNode.removeChild(hint);
    var newEl = _buildBlockEl(b);
    var selEl = $id(state.sel);
    if (selEl && selEl.nextSibling) selEl.parentNode.insertBefore(newEl, selEl.nextSibling);
    else if (selEl) selEl.parentNode.appendChild(newEl);
    else $id('blist').appendChild(newEl);
  } else {
    state.blocks.push(b);
    _appendBlockEl(b);
  }

  _updateCount();
  syncCode();
  schedPv();

  // Scroll, select and auto-focus text blocks after paint
  setTimeout(function() {
    var el = $id(b.id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setSelected(b.id);
    var AUTO_EDIT = { p:1, h1:1, h2:1, h3:1, h4:1, h5:1 };
    if (AUTO_EDIT[b.type]) {
      var beEl = el.querySelector('.be');
      if (beEl) {
        beEl.focus();
        var s = window.getSelection();
        var r = document.createRange();
        r.selectNodeContents(beEl);
        r.collapse(false);
        s.removeAllRanges(); s.addRange(r);
      }
    }
  }, 40);

  return b;
}

/* =========================================================
   MOVE
   ========================================================= */

/**
 * Move a block up (-1) or down (+1) in the list.
 * @param {string} id
 * @param {number} dir — -1 or +1
 */
export function moveBlock(id, dir) {
  var idx = state.blocks.findIndex(function(b){ return b.id === id; });
  if (idx < 0) return;
  var newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= state.blocks.length) return;
  var tmp = state.blocks[idx];
  state.blocks[idx] = state.blocks[newIdx];
  state.blocks[newIdx] = tmp;

  // Re-render DOM order
  var bl = $id('blist');
  var els = Array.prototype.slice.call(bl.children).filter(function(e){ return e.classList && e.classList.contains('bi'); });
  if (dir === -1 && newIdx < els.length && idx < els.length) {
    bl.insertBefore(els[idx], els[newIdx]);
  } else if (dir === 1 && newIdx < els.length) {
    if (els[newIdx].nextSibling) bl.insertBefore(els[idx], els[newIdx].nextSibling);
    else bl.appendChild(els[idx]);
  }
  syncCode(); schedPv();
}

/* =========================================================
   REORDER (drag-drop)
   ========================================================= */

/**
 * Reorder a block by moving `fromId` before or after `toId`.
 * @param {string} fromId
 * @param {string} toId
 * @param {boolean} after — true = insert after toId, false = before
 */
export function reorderBlock(fromId, toId, after) {
  var fromIdx = state.blocks.findIndex(function(b){ return b.id === fromId; });
  var toIdx   = state.blocks.findIndex(function(b){ return b.id === toId; });
  if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
  var moved = state.blocks.splice(fromIdx, 1)[0];
  var insertAt = state.blocks.findIndex(function(b){ return b.id === toId; });
  if (after) insertAt++;
  state.blocks.splice(insertAt, 0, moved);

  var bl = $id('blist');
  var fromEl = $id(fromId);
  var toEl   = $id(toId);
  if (!fromEl || !toEl) return;
  if (after) {
    if (toEl.nextSibling) bl.insertBefore(fromEl, toEl.nextSibling);
    else bl.appendChild(fromEl);
  } else {
    bl.insertBefore(fromEl, toEl);
  }
  syncCode(); schedPv();
}

/* =========================================================
   DELETE
   ========================================================= */

/**
 * Delete a block by id.
 * @param {string} id
 */
export function deleteBlock(id) {
  state.blocks = state.blocks.filter(function(b){ return b.id !== id; });
  if (state.sel === id) {
    state.sel = null;
  }
  var el = $id(id); if (el) el.parentNode.removeChild(el);
  if (!state.blocks.length) {
    var bl = $id('blist');
    if (bl && !bl.querySelector('#ehint')) {
      var hint = document.createElement('div');
      hint.id = 'ehint';
      hint.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 5v14M5 12h14"/></svg><div>使用上方工具栏插入组件块</div><div style="font-size:10px;opacity:.6">每个组件独立生成代码片段</div>';
      bl.appendChild(hint);
    }
  }
  _updateCount(); syncCode(); schedPv();
}

/* =========================================================
   DUPLICATE
   ========================================================= */

/**
 * Duplicate a block (deep copy) and insert it after the original.
 * @param {string} id
 */
export function duplicateBlock(id) {
  var idx = state.blocks.findIndex(function(b){ return b.id === id; });
  if (idx < 0) return;
  var orig = state.blocks[idx];
  var nb = JSON.parse(JSON.stringify(orig));
  nb.id = mkBlock(orig.type, {}).id;

  state.blocks.splice(idx + 1, 0, nb);
  var origEl = $id(id);
  var newEl  = _buildBlockEl(nb);
  if (origEl && origEl.nextSibling) origEl.parentNode.insertBefore(newEl, origEl.nextSibling);
  else if (origEl) origEl.parentNode.appendChild(newEl);
  else $id('blist').appendChild(newEl);

  _updateCount(); syncCode(); schedPv();
  setTimeout(function(){ setSelected(nb.id); }, 40);
}

/* =========================================================
   INSERT-AFTER (tree panel helper)
   ========================================================= */

/**
 * Insert a plain block of the given type after the block with `afterBid`.
 * @param {string} afterBid
 * @param {string} type
 */
export function insertBlockAfter(afterBid, type) {
  var idx = state.blocks.findIndex(function(b){ return b.id === afterBid; });
  if (idx < 0) { insertBlock(type); return; }
  var b = mkBlock(type, {});
  state.blocks.splice(idx + 1, 0, b);
  var afterEl = $id(afterBid);
  var newEl = _buildBlockEl(b);
  if (afterEl) {
    if (afterEl.nextSibling) afterEl.parentNode.insertBefore(newEl, afterEl.nextSibling);
    else afterEl.parentNode.appendChild(newEl);
  } else {
    $id('blist').appendChild(newEl);
  }
  var hint = $id('ehint'); if (hint && hint.parentNode) hint.parentNode.removeChild(hint);
  _updateCount(); syncCode(); schedPv();
  setTimeout(function(){ setSelected(b.id); }, 40);
}

/**
 * Insert a raw (custom HTML) block after `afterBid` and open its tree editor.
 * @param {string} afterBid
 */
export function insertRawBlockAfter(afterBid) {
  var idx = state.blocks.findIndex(function(b){ return b.id === afterBid; });
  if (idx < 0) return;
  var b = mkBlock('raw', { html: '<div>自定义 HTML</div>' });
  state.blocks.splice(idx + 1, 0, b);
  var afterEl = $id(afterBid);
  var newEl = _buildBlockEl(b);
  if (afterEl) {
    if (afterEl.nextSibling) afterEl.parentNode.insertBefore(newEl, afterEl.nextSibling);
    else afterEl.parentNode.appendChild(newEl);
  } else {
    $id('blist').appendChild(newEl);
  }
  var hint = $id('ehint'); if (hint && hint.parentNode) hint.parentNode.removeChild(hint);
  _updateCount(); syncCode(); schedPv();
  // Auto-open the tree HTML editor for the new raw block
  setTimeout(function() {
    setSelected(b.id);
    /**
     * 'openTreeEdit' — request the tree view (toolbar.js) to open the inline
     * HTML editor panel for the block identified by `bid`.
     * Payload: bid {string}
     */
    emit('openTreeEdit', b.id);
  }, 80);
}

/* =========================================================
   APPLY BLOCK HTML (tree inline editor)
   ========================================================= */

/**
 * Replace a block's content by parsing newly edited HTML.
 * @param {string} bid
 * @param {string} newHtml
 */
export function applyBlockHtml(bid, newHtml) {
  var idx = state.blocks.findIndex(function(b){ return b.id === bid; });
  if (idx < 0) return;

  var wrapped = '<div class="ar">' + newHtml + '</div>';
  var parsed = parseHtmlToBlocks(wrapped);

  var newBlock;
  if (parsed && parsed.length > 0 && parsed[0].type !== 'raw') {
    newBlock = parsed[0];
    newBlock.id = bid;
  } else {
    newBlock = mkBlock('raw', { html: newHtml });
    newBlock.id = bid;
  }

  state.blocks[idx] = newBlock;
  var oldEl = $id(bid);
  if (oldEl) oldEl.parentNode.replaceChild(_buildBlockEl(newBlock), oldEl);
  syncCode(); schedPv();
}

/* =========================================================
   APPLY CODE EDITOR → BLOCKS
   ========================================================= */

let _codeParseTimer = null;

/** Debounced: parse the code textarea and update blocks. */
export function schedApplyCode() {
  clearTimeout(_codeParseTimer);
  _codeParseTimer = setTimeout(applyCodeToBlocks, 600);
}

/** Immediately parse code textarea and rebuild blocks. */
export function applyCodeToBlocks() {
  var ta = $id('ctarea');
  if (!ta) return;
  var newBlocks = parseHtmlToBlocks(ta.value);
  if (!newBlocks) return;
  state.syncingFromCode = true;
  state.blocks = newBlocks;
  state.sel = null;
  var bl = $id('blist');
  bl.innerHTML = '';
  state.blocks.forEach(function(b){ _appendBlockEl(b); });
  _updateCount();
  state.syncingFromCode = false;
  // Notify tree to rebuild
  emit('syncTree');
}

/* =========================================================
   EVENT BUS WIRING
   Connect eventBus events emitted from editor.js _buildBlockEl
   back to these command functions.
   ========================================================= */
on('moveBlock',   function(id, dir){ moveBlock(id, dir); });
on('reorderBlock',function(from, to, after){ reorderBlock(from, to, after); });
on('selectBlock', function(id){ setSelected(id); });
