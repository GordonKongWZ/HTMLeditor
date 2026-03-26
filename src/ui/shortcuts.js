/**
 * shortcuts.js — Keyboard shortcut configuration and dispatch.
 *
 * Features:
 *   - Configurable single-key shortcuts for inserting blocks (stored in localStorage)
 *   - Fixed shortcuts for block operations and rich-text formatting (shown for reference)
 *   - Shortcut help modal with editable key badges
 *   - Global paste interception (shows paste confirmation dialog)
 *   - Escape / Arrow / Delete key handling for selected blocks
 */

import { state, $id, mkDiv, esc } from '../core/editor.js';
import { insertBlock, moveBlock, deleteBlock, duplicateBlock } from '../core/commandManager.js';
import { setSelected } from '../core/selection.js';
import { emit } from '../core/eventBus.js';
import { openPasteDlg, closePasteDlg } from '../core/pastePipeline.js';

/* =========================================================
   SHORTCUT DEFINITIONS
   ========================================================= */

/**
 * Shortcut definition table.
 *
 * Properties:
 *   id     — unique identifier used as localStorage key fragment
 *   label  — human-readable description shown in the help modal
 *   cat    — category: 'insert' | 'block' | 'rich' | 'other'
 *   def    — default key string (single char for configurable; combo for fixed)
 *   fixed  — if true, key is not user-configurable
 */
var SC_DEFS = [
  { id:'ins-h1',    label:'插入 H1 标题',       cat:'insert', def:'1' },
  { id:'ins-h2',    label:'插入 H2 标题',       cat:'insert', def:'2' },
  { id:'ins-h3',    label:'插入 H3 标题',       cat:'insert', def:'3' },
  { id:'ins-h4',    label:'插入 H4 标题',       cat:'insert', def:'4' },
  { id:'ins-h5',    label:'插入 H5 标题',       cat:'insert', def:'5' },
  { id:'ins-p',     label:'插入段落',           cat:'insert', def:'p' },
  { id:'ins-q',     label:'插入引用块',         cat:'insert', def:'q' },
  { id:'ins-ul',    label:'插入无序列表',       cat:'insert', def:'u' },
  { id:'ins-ol',    label:'插入有序列表',       cat:'insert', def:'o' },
  { id:'ins-code',  label:'代码块（对话框）',   cat:'insert', def:'c' },
  { id:'ins-img',   label:'图片（对话框）',     cat:'insert', def:'i' },
  { id:'ins-video', label:'视频（对话框）',     cat:'insert', def:'v' },
  { id:'ins-eq',    label:'公式块（对话框）',   cat:'insert', def:'e' },
  { id:'ins-table', label:'表格（对话框）',     cat:'insert', def:'t' },
  { id:'ins-div',   label:'插入分割线',         cat:'insert', def:'d' },
  // Fixed shortcuts — shown for reference, not editable
  { id:'blk-up',  label:'上移选中块',       cat:'block', def:'↑',      fixed:true },
  { id:'blk-dn',  label:'下移选中块',       cat:'block', def:'↓',      fixed:true },
  { id:'blk-del', label:'删除选中块',       cat:'block', def:'Delete', fixed:true },
  { id:'blk-dup', label:'复制选中块',       cat:'block', def:'Ctrl+D', fixed:true },
  { id:'blk-esc', label:'取消选中',         cat:'block', def:'Escape', fixed:true },
  { id:'fmt-b',   label:'粗体',             cat:'rich',  def:'Ctrl+B', fixed:true },
  { id:'fmt-i',   label:'斜体',             cat:'rich',  def:'Ctrl+I', fixed:true },
  { id:'fmt-u',   label:'下划线',           cat:'rich',  def:'Ctrl+U', fixed:true },
  { id:'fmt-s',   label:'删除线',           cat:'rich',  def:'Ctrl+S', fixed:true },
  { id:'sc-help', label:'显示快捷键帮助',   cat:'other', def:'?',      fixed:true },
];

/** localStorage key for persisted shortcut map. */
var _scKey = 'htmleditor_sc_v1';

/** id → current key string ('' = unbound). */
var _scMap = {};

/** The shortcut id currently being re-captured, or null. */
var _scCapturing = null;

/* ─── Load persisted shortcuts ─── */
(function() {
  SC_DEFS.forEach(function(d) { if (!d.fixed) _scMap[d.id] = d.def; });
  try {
    var saved = localStorage.getItem(_scKey);
    if (saved) {
      var obj = JSON.parse(saved);
      SC_DEFS.forEach(function(d) {
        if (!d.fixed && Object.prototype.hasOwnProperty.call(obj, d.id) && typeof obj[d.id] === 'string') {
          _scMap[d.id] = obj[d.id];
        }
      });
    }
  } catch (ex) {}
})();

function _scSave() {
  try { localStorage.setItem(_scKey, JSON.stringify(_scMap)); } catch (ex) {}
}

/** Returns true if configurable shortcut `id` is currently bound to `keyNorm`. */
function _scMatchesKey(id, keyNorm) {
  var k = _scMap[id];
  return k !== '' && k !== undefined && k.toLowerCase() === keyNorm;
}

/** Reset all configurable shortcuts to their defaults. */
function _scReset() {
  SC_DEFS.forEach(function(d) { if (!d.fixed) _scMap[d.id] = d.def; });
  _scSave();
  _scCapturing = null;
  _renderScModal();
}

/** Dispatch the action for a configurable shortcut id. */
function _scDispatch(id) {
  switch (id) {
    case 'ins-h1':    insertBlock('h1'); break;
    case 'ins-h2':    insertBlock('h2'); break;
    case 'ins-h3':    insertBlock('h3'); break;
    case 'ins-h4':    insertBlock('h4'); break;
    case 'ins-h5':    insertBlock('h5'); break;
    case 'ins-p':     insertBlock('p'); break;
    case 'ins-q':     insertBlock('blockquote'); break;
    case 'ins-ul':    insertBlock('ul'); break;
    case 'ins-ol':    insertBlock('ol'); break;
    case 'ins-code':  emit('openDialog', 'code'); break;
    case 'ins-img':   emit('openDialog', 'img'); break;
    case 'ins-video': emit('openDialog', 'video'); break;
    case 'ins-eq':    emit('openDialog', 'eq', null, 'block'); break;
    case 'ins-table': emit('openDialog', 'table'); break;
    case 'ins-div':   insertBlock('divider'); break;
  }
}

/* =========================================================
   SHORTCUT HELP MODAL RENDERING
   ========================================================= */

function _scKeyHtml(key) {
  if (!key) return '<span class="sc-unbound-lbl">—</span>';
  return key.split('+').map(function(p) { return '<kbd>' + esc(p) + '</kbd>'; }).join('+');
}

function _scMakeEditBadge(def) {
  var key = _scMap[def.id] || '';
  var isCapturing = (def.id === _scCapturing);

  var badge = document.createElement('span');
  badge.className = 'sc-edit-badge' + (isCapturing ? ' sc-capturing' : '');
  badge.dataset.scid = def.id;

  var kbd = document.createElement('kbd');
  if (!key) kbd.className = 'sc-unbound';
  kbd.textContent = isCapturing ? '…' : (key ? key.toUpperCase() : '—');

  var tip = document.createElement('span');
  tip.className = 'sc-edit-tip';
  tip.textContent = isCapturing ? '按新键（Esc 取消）' : (key ? '✎ 点击修改' : '✎ 点击绑定');

  badge.appendChild(kbd);
  badge.appendChild(tip);

  badge.addEventListener('click', function(e) {
    e.stopPropagation();
    _scCapturing = def.id;
    _renderScModal();
  });

  return badge;
}

function _renderScModal() {
  var body = $id('sc-body');
  if (!body) return;
  body.innerHTML = '';

  var CAT_TITLES = {
    insert: '插入块（可自定义 · 点击按键修改）',
    block:  '选中块操作（固定）',
    rich:   '富文本格式（固定 · 文本编辑中）',
    other:  '其他（固定）',
  };

  ['insert', 'block', 'rich', 'other'].forEach(function(cat) {
    var defs = SC_DEFS.filter(function(d) { return d.cat === cat; });
    if (!defs.length) return;

    var sec = mkDiv('sc-section');
    var h = document.createElement('div');
    h.className = 'sc-section-title';
    h.textContent = CAT_TITLES[cat];
    sec.appendChild(h);

    var tbl = document.createElement('table');
    tbl.className = 'sc-table';

    defs.forEach(function(def) {
      var tr = document.createElement('tr');
      var td1 = document.createElement('td'); td1.textContent = def.label;
      var td2 = document.createElement('td'); td2.className = 'sc-kbd-cell';

      if (def.fixed) {
        td2.innerHTML = _scKeyHtml(def.def);
      } else {
        td2.appendChild(_scMakeEditBadge(def));
      }

      tr.appendChild(td1);
      tr.appendChild(td2);
      tbl.appendChild(tr);
    });

    sec.appendChild(tbl);
    body.appendChild(sec);
  });

  var hint = mkDiv('sc-hint');
  hint.textContent = '可自定义项仅支持字母和数字键（无修饰键）；已被占用的绑定将自动解除';
  body.appendChild(hint);
}

/* =========================================================
   OPEN / CLOSE HELP MODAL
   ========================================================= */

export function openShortcutHelp() {
  _renderScModal();
  $id('sc-overlay').classList.add('open');
}

export function closeShortcutHelp() {
  _scCapturing = null;
  $id('sc-overlay').classList.remove('open');
}

/* =========================================================
   CAPTURE-MODE KEY HANDLER
   ========================================================= */

function _scHandleCapture(e) {
  e.preventDefault();
  e.stopPropagation();

  if (e.key === 'Escape') {
    _scCapturing = null;
    _renderScModal();
    return;
  }

  // Accept only single letter or digit, no modifiers
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  var key = e.key;
  if (key.length !== 1 || !/^[a-z0-9]$/i.test(key)) return;

  var keyNorm = key.toLowerCase();

  // Displace any other configurable action that already owns this key
  SC_DEFS.forEach(function(d) {
    if (!d.fixed && d.id !== _scCapturing && _scMatchesKey(d.id, keyNorm)) {
      _scMap[d.id] = '';
    }
  });

  _scMap[_scCapturing] = keyNorm;
  _scSave();
  _scCapturing = null;
  _renderScModal();
}

/* =========================================================
   CONTEXT HELPERS
   ========================================================= */

/** True when the user is actively editing text (shortcuts should not fire). */
function _isEditingText() {
  var ae = document.activeElement;
  if (!ae || ae === document.body) return false;
  var tag = ae.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (ae.isContentEditable) return true;
  return false;
}

/** True when any overlay / dialog is open. */
function _isModalOpen() {
  return (
    ($id('doverlay')     && $id('doverlay').classList.contains('open'))     ||
    ($id('sc-overlay')   && $id('sc-overlay').classList.contains('open'))   ||
    ($id('paste-overlay')&& $id('paste-overlay').classList.contains('open'))
  );
}

/* =========================================================
   GLOBAL KEY / PASTE LISTENERS
   ========================================================= */

/**
 * Initialise all keyboard shortcut and paste listeners.
 * Call once from app.js after the DOM is ready.
 */
export function initShortcuts() {
  // Shortcut help modal wiring
  var scClose = $id('sc-close');
  var scReset = $id('sc-reset');
  var scOverlay = $id('sc-overlay');
  var btnSc = $id('btn-shortcuts');

  if (scClose)   scClose.addEventListener('click', closeShortcutHelp);
  if (scReset)   scReset.addEventListener('click', _scReset);
  if (scOverlay) scOverlay.addEventListener('click', function(e) { if (e.target === this) closeShortcutHelp(); });
  if (btnSc)     btnSc.addEventListener('click', openShortcutHelp);

  // Paste dialog wiring
  var pasteClose  = $id('paste-close');
  var pasteCancel = $id('paste-cancel');
  var pasteInsert = $id('paste-insert');
  if (pasteClose)  pasteClose.addEventListener('click', closePasteDlg);
  if (pasteCancel) pasteCancel.addEventListener('click', closePasteDlg);
  if (pasteInsert) {
    pasteInsert.addEventListener('click', function() {
      confirmPaste();
    });
  }

  // Global paste interception (when not in a text field)
  document.addEventListener('paste', function(e) {
    if (_isEditingText()) return;
    if (_isModalOpen()) return;
    e.preventDefault();
    var html = e.clipboardData ? e.clipboardData.getData('text/html')  : '';
    var text = e.clipboardData ? e.clipboardData.getData('text/plain') : '';
    if (!html && !text) return;
    openPasteDlg(html, text);
  });

  // Global keydown handler
  document.addEventListener('keydown', function(e) {
    // Capture mode takes priority
    if (_scCapturing) { _scHandleCapture(e); return; }

    // Escape: close modals in order, then deselect block
    if (e.key === 'Escape') {
      if ($id('paste-overlay') && $id('paste-overlay').classList.contains('open')) { closePasteDlg(); return; }
      if ($id('sc-overlay')    && $id('sc-overlay').classList.contains('open'))    { closeShortcutHelp(); return; }
      if (!_isEditingText() && !($id('doverlay') && $id('doverlay').classList.contains('open'))) {
        setSelected(null);
      }
      return;
    }

    // Space: deselect block when not editing text
    if (e.key === ' ') {
      if (!_isEditingText() && state.sel && !_isModalOpen()) {
        e.preventDefault();
        setSelected(null);
      }
      return;
    }

    // Ctrl/Meta+D: duplicate selected block
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'd') {
      if (!_isEditingText() && !_isModalOpen() && state.sel) {
        e.preventDefault();
        duplicateBlock(state.sel);
      }
      return;
    }

    // All remaining shortcuts: skip when editing text, modal open, or modifier held
    if (_isEditingText()) return;
    if (_isModalOpen()) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    // Fixed non-configurable shortcuts
    switch (e.key) {
      case 'ArrowUp':
        if (state.sel) { e.preventDefault(); moveBlock(state.sel, -1); }
        return;
      case 'ArrowDown':
        if (state.sel) { e.preventDefault(); moveBlock(state.sel,  1); }
        return;
      case 'Delete':
      case 'Backspace':
        if (state.sel) { e.preventDefault(); deleteBlock(state.sel); }
        return;
      case '?':
        e.preventDefault();
        openShortcutHelp();
        return;
    }

    // Configurable shortcuts
    if (e.key.length !== 1) return;
    var keyNorm = e.key.toLowerCase();
    for (var i = 0; i < SC_DEFS.length; i++) {
      var def = SC_DEFS[i];
      if (!def.fixed && _scMatchesKey(def.id, keyNorm)) {
        e.preventDefault();
        _scDispatch(def.id);
        return;
      }
    }
  });
}
