/**
 * contextMenu.js — Preview iframe right-click context menu.
 *
 * Attaches a contextmenu listener to the preview iframe document.
 * When the user right-clicks a block inside the preview, shows a small
 * menu that lets them select or delete the block in the editor.
 *
 * Called from app.js after each preview refresh (pvRefreshed event).
 */

import { state, $id, _ensurePvHlStyle, scrollEditorToBlock } from '../core/editor.js';
import { deleteBlock } from '../core/commandManager.js';
import { setSelected } from '../core/selection.js';
import { on } from '../core/eventBus.js';

/** Currently highlighted block id (for the context-menu's delete action). */
var _pvCtxId = null;
/** The iframe contentDocument that the menu was last attached to. */
var _pvCtxMenuDoc = null;

/**
 * Open the preview context menu at screen coordinates (x, y).
 * @param {string} bid — block id
 * @param {number} x
 * @param {number} y
 */
function _openPvCtxMenu(bid, x, y) {
  _pvCtxId = bid;
  var m = $id('ctxm-pv');
  if (!m) return;

  // Highlight the target element in the preview
  if (_pvCtxMenuDoc) {
    var prev = _pvCtxMenuDoc.querySelector('._pv_hl_ctx');
    if (prev) prev.classList.remove('_pv_hl_ctx');
    var el = _pvCtxMenuDoc.querySelector('[data-bid="' + bid + '"]');
    if (el) {
      _ensurePvHlStyle(_pvCtxMenuDoc);
      el.classList.add('_pv_hl_ctx');
    }
  }

  m.style.left = x + 'px';
  m.style.top  = y + 'px';
  m.classList.add('open');
  requestAnimationFrame(function() {
    var r = m.getBoundingClientRect();
    if (r.right  > window.innerWidth)  m.style.left = (x - r.width)  + 'px';
    if (r.bottom > window.innerHeight) m.style.top  = (y - r.height) + 'px';
  });
}

/**
 * Handle right-click inside the preview iframe.
 * @param {MouseEvent} e — event from inside the iframe
 */
function _pvCtxMenuHandler(e) {
  e.preventDefault();
  var target = e.target;
  // Walk up to find the element with data-bid
  while (target && target !== _pvCtxMenuDoc.body) {
    if (target.dataset && target.dataset.bid) break;
    target = target.parentNode;
  }
  if (!target || !target.dataset || !target.dataset.bid) return;
  var bid = target.dataset.bid;
  var frame = $id('pframe');
  var r = frame.getBoundingClientRect();
  // Map from iframe coordinates to page coordinates
  _openPvCtxMenu(bid, r.left + e.clientX, r.top + e.clientY);
}

/**
 * Dismiss the preview context menu when the user clicks elsewhere inside
 * the preview iframe.
 * @param {MouseEvent} _e
 */
function _pvClickHandler(_e) {
  $id('ctxm-pv').classList.remove('open');
  if (_pvCtxMenuDoc) {
    var prev = _pvCtxMenuDoc.querySelector('._pv_hl_ctx');
    if (prev) prev.classList.remove('_pv_hl_ctx');
  }
}

/**
 * Attach (or re-attach) the context menu listener to the preview iframe document.
 * Should be called after each preview refresh.
 * @param {HTMLIFrameElement} frame
 */
export function attachPvContextMenu(frame) {
  var fdoc;
  try {
    fdoc = frame.contentDocument || frame.contentWindow.document;
    if (!fdoc || !fdoc.body) return;
  } catch (e) { return; }

  // Detach from old document if it changed
  if (_pvCtxMenuDoc && _pvCtxMenuDoc !== fdoc) {
    try {
      _pvCtxMenuDoc.removeEventListener('contextmenu', _pvCtxMenuHandler);
      _pvCtxMenuDoc.removeEventListener('click',       _pvClickHandler);
    } catch (e) {}
  }

  _pvCtxMenuDoc = fdoc;
  fdoc.addEventListener('contextmenu', _pvCtxMenuHandler);
  fdoc.addEventListener('click',       _pvClickHandler);
}

/**
 * Wire the preview context menu buttons.
 * Called once from app.js during initialisation.
 */
export function initContextMenu() {
  // Close any open context menus on outside click
  document.addEventListener('click', function() {
    document.querySelectorAll('#ctxm-pv, #ctxm, #ctxm-tree').forEach(function(m) {
      m.classList.remove('open');
    });
  });

  // Preview context menu actions
  var selBtn = $id('cxpv-sel');
  var delBtn = $id('cxpv-del');
  if (selBtn) {
    selBtn.addEventListener('click', function() {
      if (_pvCtxId) {
        setSelected(_pvCtxId);
        scrollEditorToBlock(_pvCtxId);
      }
    });
  }
  if (delBtn) {
    delBtn.addEventListener('click', function() {
      if (_pvCtxId) deleteBlock(_pvCtxId);
    });
  }

  // Re-attach preview context menu after every preview refresh
  on('pvRefreshed', function(frame) {
    attachPvContextMenu(frame);
  });
}
