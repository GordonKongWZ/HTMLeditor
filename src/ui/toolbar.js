/**
 * toolbar.js — Toolbar wiring, tree view, resize handle, and dialogs.
 *
 * Responsibilities:
 *   - Wire toolbar insert/dialog buttons
 *   - Top-bar actions (import, export, copy, clear)
 *   - Tree view (build, expand, edit, insert panels)
 *   - Device/scale controls
 *   - Dialog management (image, video, equation, table, code, infobox)
 *   - Floating format bar
 *   - Code editor tab switching
 *   - Resize handle between editor and code panes
 */

import { state, $id, mkDiv, esc, debounce, syncCode, schedPv, doPv, b2html, parseHtmlToBlocks, _buildBlockEl, _refreshInner, TREE_DEPTH_MAX, setTreeSyncFn } from '../core/editor.js';
import { insertBlock, deleteBlock, moveBlock, duplicateBlock, applyCodeToBlocks, schedApplyCode, insertBlockAfter, insertRawBlockAfter, applyBlockHtml } from '../core/commandManager.js';
import { setSelected } from '../core/selection.js';
import { on, emit } from '../core/eventBus.js';

/* =========================================================
   TREE VIEW
   ========================================================= */

function switchCeTab(mode) {
  state.treeMode = (mode === 'tree');
  $id('ce-tree-pane').style.display = state.treeMode ? '' : 'none';
  $id('ctarea').style.display = state.treeMode ? 'none' : '';
  $id('ce-tab-tree').classList.toggle('act', state.treeMode);
  $id('ce-tab-html').classList.toggle('act', !state.treeMode);
  if (state.treeMode) _doSyncTree();
}

function syncTree() {
  if (!state.treeMode) return;
  clearTimeout(state.syncTreeTimer);
  state.syncTreeTimer = setTimeout(_doSyncTree, 80);
}

function _doSyncTree() {
  if (!state.treeMode) return;
  var pane = $id('ce-tree-pane');
  if (!pane) return;
  pane.innerHTML = '';
  if (!state.blocks.length) {
    var emp = document.createElement('div');
    emp.className = 'tv-empty';
    emp.textContent = '暂无内容';
    pane.appendChild(emp);
    return;
  }
  state.blocks.forEach(function(b) { pane.appendChild(_buildTreeNode(b)); });
}

function _tagCls(tagName) {
  var t = (tagName || '').toLowerCase();
  if (/^h[1-6]$/.test(t)) return 'tt-h';
  if (t === 'p' || t === 'blockquote') return 'tt-p';
  if (t === 'div') return 'tt-div';
  if (t === 'figure') return 'tt-fig';
  if (t === 'ul' || t === 'ol') return 'tt-list';
  if (t === 'hr') return 'tt-hr';
  return 'tt-def';
}

function _tagLabel(el) {
  var tag = el.tagName.toLowerCase();
  var s = '<' + tag;
  var cls = el.getAttribute('class');
  if (cls) {
    var parts = cls.split(/\s+/).filter(Boolean);
    s += '.' + parts.slice(0, 2).join('.');
    if (parts.length > 2) s += '…';
  }
  s += '>';
  return s;
}

function _blockHasChildren(type) {
  return ['abstract','infobox','img','video','table','codeblock','refs',
          'ul','ol','blockquote','keywords','raw'].indexOf(type) >= 0;
}

function _blockTagDisplay(b) {
  switch (b.type) {
    case 'h1': return { tag:'h1', cls:'', color:'tt-h' };
    case 'h2': return { tag:'h2', cls:'', color:'tt-h' };
    case 'h3': return { tag:'h3', cls:'', color:'tt-h' };
    case 'h4': return { tag:'h4', cls:'', color:'tt-h' };
    case 'h5': return { tag:'h5', cls:'', color:'tt-h' };
    case 'p':  return { tag:'p',  cls:'', color:'tt-p' };
    case 'blockquote': return { tag:'blockquote', cls:'', color:'tt-p' };
    case 'ul': return { tag:'ul', cls:'', color:'tt-list' };
    case 'ol': return { tag:'ol', cls:'', color:'tt-list' };
    case 'abstract':  return { tag:'div', cls:'abstract-box', color:'tt-div' };
    case 'authors':   return { tag:'p',   cls:'paper-authors', color:'tt-p' };
    case 'keywords':  return { tag:'div', cls:'kw-row', color:'tt-div' };
    case 'infobox':   return { tag:'div', cls:'ib', color:'tt-div' };
    case 'eq':        return { tag:'div', cls:'eq', color:'tt-div' };
    case 'eq-inline': return { tag:'p',   cls:'', color:'tt-p' };
    case 'img':       return { tag:'figure', cls:'af', color:'tt-fig' };
    case 'video':     return { tag:'figure', cls:'vw', color:'tt-fig' };
    case 'table':     return { tag:'div', cls:'tw', color:'tt-div' };
    case 'codeblock': return { tag:'div', cls:'cbw', color:'tt-div' };
    case 'refs':      return { tag:'div', cls:'refs', color:'tt-div' };
    case 'divider':   return { tag:'hr',  cls:'', color:'tt-hr' };
    case 'raw':       return { tag:'?',   cls:'自定义', color:'tt-def' };
    default:          return { tag:'div', cls:'', color:'tt-def' };
  }
}

function _buildTreeNode(b) {
  var wrap = document.createElement('div');
  wrap.className = 'tn';
  wrap.id = 'tn-' + b.id;

  var expanded = !!state.treeExpanded[b.id];
  var td = _blockTagDisplay(b);
  var hasChildren = _blockHasChildren(b.type);

  var hdr = document.createElement('div');
  hdr.className = 'tn-hdr' + (state.sel === b.id ? ' tn-sel' : '');

  var tog = document.createElement('span');
  tog.className = 'tn-tog' + (hasChildren ? ' clickable' : '');
  tog.textContent = hasChildren ? (expanded ? '▼' : '▶') : '·';
  if (hasChildren) {
    (function(bid) {
      tog.addEventListener('click', function(e) {
        e.stopPropagation();
        state.treeExpanded[bid] = !state.treeExpanded[bid];
        var b2 = state.blocks.find(function(x){ return x.id === bid; });
        if (b2) {
          var tnEl = $id('tn-' + bid);
          if (tnEl) tnEl.parentNode.replaceChild(_buildTreeNode(b2), tnEl);
        }
      });
    })(b.id);
  }
  hdr.appendChild(tog);

  var badge = document.createElement('span');
  badge.className = 'tn-badge';
  badge.textContent = b.label;
  hdr.appendChild(badge);

  var tagSpan = document.createElement('span');
  tagSpan.className = 'tn-tag ' + td.color;
  tagSpan.textContent = '<' + td.tag + (td.cls ? '.' + td.cls : '') + '>';
  hdr.appendChild(tagSpan);

  var _previewDiv = document.createElement('div');
  _previewDiv.innerHTML = b.content || '';
  var preview = (_previewDiv.textContent || '').replace(/\s+/g, ' ').trim();
  if (!preview && b.type === 'raw') {
    _previewDiv.innerHTML = b.data.html || '';
    preview = (_previewDiv.textContent || '').replace(/\s+/g, ' ').trim();
  }
  if (preview.length > 50) preview = preview.substring(0, 50) + '…';
  if (preview) {
    var txtSpan = document.createElement('span');
    txtSpan.className = 'tn-txt';
    txtSpan.textContent = preview;
    hdr.appendChild(txtSpan);
  }

  var acts = document.createElement('span');
  acts.className = 'tn-acts';

  var editBtn = document.createElement('button');
  editBtn.className = 'tn-act tn-a-edit';
  editBtn.title = '编辑 HTML';
  editBtn.innerHTML = '<svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" width="9" height="9"><path d="M6.5 1L9 3.5 4 8.5l-3 .5.5-3z"/></svg>';
  (function(bid, nodeWrap) {
    editBtn.addEventListener('click', function(e) { e.stopPropagation(); _toggleTreeEdit(bid, nodeWrap); });
  })(b.id, wrap);
  acts.appendChild(editBtn);

  var insBtn = document.createElement('button');
  insBtn.className = 'tn-act tn-a-ins';
  insBtn.title = '在下方插入';
  insBtn.innerHTML = '<svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8" width="9" height="9"><line x1="5" y1="1" x2="5" y2="9"/><line x1="1" y1="5" x2="9" y2="5"/></svg>';
  (function(bid, nodeWrap) {
    insBtn.addEventListener('click', function(e) { e.stopPropagation(); _toggleTreeInsert(bid, nodeWrap); });
  })(b.id, wrap);
  acts.appendChild(insBtn);

  var delBtn = document.createElement('button');
  delBtn.className = 'tn-act tn-a-del';
  delBtn.title = '删除';
  delBtn.innerHTML = '<svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8" width="9" height="9"><line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/></svg>';
  (function(bid) {
    delBtn.addEventListener('click', function(e) { e.stopPropagation(); if (confirm('确定删除此块？')) deleteBlock(bid); });
  })(b.id);
  acts.appendChild(delBtn);

  hdr.appendChild(acts);

  (function(bid, h, nodeWrap) {
    h.addEventListener('click', function() { setSelected(bid); });
    h.addEventListener('dblclick', function(e) { e.stopPropagation(); _toggleTreeEdit(bid, nodeWrap); });
    h.addEventListener('contextmenu', function(e) { e.preventDefault(); _openTreeCtxMenu(e, bid, nodeWrap); });
  })(b.id, hdr, wrap);

  wrap.appendChild(hdr);

  if (hasChildren && expanded) {
    var rootEl = null;
    try {
      var blockHtml = b2html(b);
      var tmpDoc = new DOMParser().parseFromString('<x>' + blockHtml.trim() + '</x>', 'text/html');
      rootEl = tmpDoc.querySelector('x > *') || null;
    } catch(e) {}
    if (rootEl) {
      var childWrap = document.createElement('div');
      childWrap.className = 'tn-children';
      _renderInnerChildren(rootEl, childWrap, 0);
      wrap.appendChild(childWrap);
    }
  }

  return wrap;
}

function _renderInnerChildren(el, container, depth) {
  if (depth > TREE_DEPTH_MAX) return;
  Array.prototype.slice.call(el.childNodes).forEach(function(node) {
    if (node.nodeType === 3) {
      var t = (node.textContent || '').replace(/\s+/g, ' ').trim();
      if (!t) return;
      var row = document.createElement('div');
      row.className = 'tn-inner-node';
      var rh = document.createElement('div');
      rh.className = 'tn-inode-hdr';
      var dot = document.createElement('span'); dot.className = 'tn-tog'; dot.textContent = '·';
      rh.appendChild(dot);
      var ts = document.createElement('span'); ts.className = 'tn-inode-txt';
      ts.textContent = '"' + (t.length > 60 ? t.substring(0, 60) + '…' : t) + '"';
      rh.appendChild(ts);
      row.appendChild(rh);
      container.appendChild(row);
    } else if (node.nodeType === 1) {
      var row2 = document.createElement('div');
      row2.className = 'tn-inner-node';
      var rh2 = document.createElement('div');
      rh2.className = 'tn-inode-hdr';
      var arrow = document.createElement('span'); arrow.className = 'tn-tog';
      arrow.textContent = node.children.length ? '▸' : '·';
      rh2.appendChild(arrow);
      var tagS = document.createElement('span'); tagS.className = 'tn-inode-tag';
      tagS.textContent = _tagLabel(node);
      rh2.appendChild(tagS);
      var innerTxt = (node.textContent || '').replace(/\s+/g, ' ').trim();
      if (innerTxt.length > 0) {
        var its = document.createElement('span'); its.className = 'tn-inode-txt';
        its.textContent = innerTxt.length > 50 ? innerTxt.substring(0, 50) + '…' : innerTxt;
        rh2.appendChild(its);
      }
      row2.appendChild(rh2);
      if (node.children.length && depth < TREE_DEPTH_MAX) {
        var cc = document.createElement('div'); cc.className = 'tn-children';
        _renderInnerChildren(node, cc, depth + 1);
        row2.appendChild(cc);
      }
      container.appendChild(row2);
    }
  });
}

export function _toggleTreeEdit(bid, wrap) {
  var wasOpen = !!wrap.querySelector('.tn-edit-wrap');
  document.querySelectorAll('.tn-edit-wrap, .tn-ins-wrap').forEach(function(el){ el.remove(); });
  if (wasOpen) return;

  var b = state.blocks.find(function(x){ return x.id === bid; });
  if (!b) return;

  var editWrap = document.createElement('div');
  editWrap.className = 'tn-edit-wrap';

  var ta = document.createElement('textarea');
  ta.value = b2html(b).trim();
  ta.spellcheck = false;
  ta.rows = 5;
  editWrap.appendChild(ta);

  var btns = document.createElement('div');
  btns.className = 'tn-edit-btns';

  var saveBtn = document.createElement('button');
  saveBtn.className = 'tn-edit-save';
  saveBtn.textContent = '✓ 应用';
  saveBtn.addEventListener('click', function() {
    applyBlockHtml(bid, ta.value.trim());
    editWrap.remove();
  });

  var cancelBtn = document.createElement('button');
  cancelBtn.className = 'tn-edit-cancel';
  cancelBtn.textContent = '取消';
  cancelBtn.addEventListener('click', function() { editWrap.remove(); });

  btns.appendChild(saveBtn);
  btns.appendChild(cancelBtn);
  editWrap.appendChild(btns);
  wrap.appendChild(editWrap);
  ta.focus();
  ta.setSelectionRange(0, 0);
}

var _INSERT_BLOCK_TYPES = [
  { t:'h1', l:'H1' },{ t:'h2', l:'H2' },{ t:'h3', l:'H3' },{ t:'h4', l:'H4' },{ t:'h5', l:'H5' },
  { t:'p',  l:'段落' },{ t:'blockquote', l:'引用' },{ t:'ul', l:'无序列表' },{ t:'ol', l:'有序列表' },
  { t:'abstract', l:'摘要' },{ t:'authors', l:'作者' },{ t:'keywords', l:'关键词' },
  { t:'divider', l:'分割线' },{ t:'refs', l:'参考文献' },{ t:'raw', l:'自定义 HTML' }
];

function _toggleTreeInsert(bid, wrap) {
  var wasOpen = !!wrap.querySelector('.tn-ins-wrap');
  document.querySelectorAll('.tn-edit-wrap, .tn-ins-wrap').forEach(function(el){ el.remove(); });
  if (wasOpen) return;

  var insWrap = document.createElement('div');
  insWrap.className = 'tn-ins-wrap';

  var lbl = document.createElement('div');
  lbl.className = 'tn-ins-label';
  lbl.textContent = '在下方插入：';
  insWrap.appendChild(lbl);

  var btnsDiv = document.createElement('div');
  btnsDiv.className = 'tn-ins-btns';

  _INSERT_BLOCK_TYPES.forEach(function(it) {
    var btn = document.createElement('button');
    btn.className = 'tn-ins-btn';
    btn.textContent = it.l;
    btn.addEventListener('click', function() {
      insWrap.remove();
      if (it.t === 'raw') insertRawBlockAfter(bid);
      else insertBlockAfter(bid, it.t);
    });
    btnsDiv.appendChild(btn);
  });

  insWrap.appendChild(btnsDiv);
  wrap.appendChild(insWrap);
}

/* =========================================================
   DIALOG MANAGEMENT
   ========================================================= */

function openDlg(title, html, type) {
  state.dlgType = type;
  $id('dtitle').textContent = title;
  $id('dcontent').innerHTML = html;
  $id('doverlay').classList.add('open');
}

function closeDlg() {
  $id('doverlay').classList.remove('open');
  state.dlgType = null;
  state.editingBlock = null;
}

/* ── Image ── */
function openImgDialog(b) {
  state.editingBlock = b || null;
  var d = b ? b.data : {};
  openDlg('插入图片',
    '<div class="df"><label>图片 URL / 路径</label><input id="d-isrc" value="' + esc(d.src||'') + '" placeholder="https://example.com/img.png"></div>' +
    '<div class="df"><label>Alt 文本</label><input id="d-ialt" value="' + esc(d.alt||'') + '" placeholder="图片描述"></div>' +
    '<div class="df"><label>图片标题</label><input id="d-icap" value="' + esc(d.caption||'') + '" placeholder="图 1：示意图"></div>' +
    '<div class="df"><label>图号（可选）</label><input id="d-inum" value="' + esc(d.fignum||'') + '" placeholder="图 1"></div>',
  'img');
}

function confirmImg() {
  var data = { src:$id('d-isrc').value.trim(), alt:$id('d-ialt').value.trim(), caption:$id('d-icap').value.trim(), fignum:$id('d-inum').value.trim() };
  if (state.editingBlock) { Object.assign(state.editingBlock.data, data); _refreshInner(state.editingBlock); syncCode(); schedPv(); }
  else insertBlock('img', data);
}

/* ── Video ── */
function openVideoDialog(b) {
  state.editingBlock = b || null;
  var d = b ? b.data : {};
  openDlg('插入视频',
    '<div class="df"><label>类型</label><select id="d-vtype"><option value="file"' + ((!d.vtype||d.vtype==='file')?' selected':'') + '>本地/直链 (video)</option><option value="iframe"' + (d.vtype==='iframe'?' selected':'') + '>嵌入 iframe (B站/YouTube)</option></select></div>' +
    '<div class="df"><label>URL / src</label><input id="d-vsrc" value="' + esc(d.src||'') + '" placeholder="https://..."></div>' +
    '<div class="df"><label>视频标题</label><input id="d-vcap" value="' + esc(d.caption||'') + '" placeholder="视频 1：演示"></div>' +
    '<div class="df"><label>视频号（可选）</label><input id="d-vnum" value="' + esc(d.fignum||'') + '" placeholder="视频 1"></div>',
  'video');
}

function confirmVideo() {
  var data = { vtype:$id('d-vtype').value, src:$id('d-vsrc').value.trim(), caption:$id('d-vcap').value.trim(), fignum:$id('d-vnum').value.trim() };
  if (state.editingBlock) { Object.assign(state.editingBlock.data, data); _refreshInner(state.editingBlock); syncCode(); schedPv(); }
  else insertBlock('video', data);
}

/* ── Equation ── */
var _dEqPv = debounce(function(){
  var raw = $id('d-eqraw'); if (!raw) return;
  var pv = $id('eqpv'); if (!pv) return;
  if (window.katex) {
    try { pv.innerHTML = ''; window.katex.render(raw.value, pv, { displayMode: state.eqMode === 'block', throwOnError: false }); }
    catch(e) { pv.textContent = 'KaTeX 错误'; }
  } else {
    pv.textContent = raw.value;
  }
}, 280);

function openEqDialog(mode, b) {
  state.eqMode = mode;
  state.editingBlock = b || null;
  var d = b ? b.data : {};
  openDlg(mode === 'block' ? '公式块' : '行内公式',
    '<div class="df"><label>LaTeX 公式（不含 $ 符号）</label><textarea id="d-eqraw" rows="3" placeholder="E = mc^2">' + esc(d.raw||'') + '</textarea></div>' +
    '<div id="eqpv">预览</div>' +
    (mode === 'block' ? '<div class="df" style="margin-top:8px"><label>公式编号（可选）</label><input id="d-eqlbl" value="' + esc(d.label||'') + '" placeholder="(1)"></div>' : ''),
  'eq');
  setTimeout(function(){
    var ta = $id('d-eqraw');
    if (ta) { ta.addEventListener('input', _dEqPv); _dEqPv(); }
  }, 30);
}

function confirmEq() {
  var raw = ($id('d-eqraw') || {}).value || '';
  var lbl = ($id('d-eqlbl') || {}).value || '';
  if (state.editingBlock) {
    state.editingBlock.data.raw = raw; state.editingBlock.data.label = lbl;
    _refreshInner(state.editingBlock); syncCode(); schedPv();
  } else {
    if (state.eqMode === 'block') insertBlock('eq', { raw:raw, label:lbl });
    else insertBlock('eq-inline', { raw:raw });
  }
}

/* ── Table ── */
var _tblEditBlock = null;

function openTableDialog(b) {
  _tblEditBlock = b || null;
  state.tblH = b ? [].concat(b.data.headers || []) : ['列 1','列 2','列 3'];
  state.tblR = b ? b.data.rows.map(function(r){ return [].concat(r); }) : [[' ',' ',' '],[' ',' ',' ']];
  openDlg('表格',
    '<div class="df"><label>表格标题</label><input id="d-tcap" value="' + esc(b && b.data.caption || '') + '" placeholder="表 1：数据对比"></div>' +
    '<div class="df"><label>表号（可选）</label><input id="d-tnum" value="' + esc(b && b.data.tablenum || '') + '" placeholder="表 1"></div>' +
    '<div class="tbtns"><button class="tadd" id="tadd-col">+ 列</button><button class="tadd" id="tadd-row">+ 行</button><button class="tadd" id="tdel-col">− 末列</button><button class="tadd" id="tdel-row">− 末行</button></div>' +
    '<div class="tbed" id="tbed"></div>',
  'table');
  setTimeout(function(){
    $id('tadd-col').addEventListener('click', function(){ state.tblH.push('列' + (state.tblH.length+1)); state.tblR.forEach(function(r){ r.push(''); }); renderTbed(); });
    $id('tadd-row').addEventListener('click', function(){ state.tblR.push(state.tblH.map(function(){ return ''; })); renderTbed(); });
    $id('tdel-col').addEventListener('click', function(){ if (state.tblH.length > 1) { state.tblH.pop(); state.tblR.forEach(function(r){ r.pop(); }); renderTbed(); } });
    $id('tdel-row').addEventListener('click', function(){ if (state.tblR.length > 0) { state.tblR.pop(); renderTbed(); } });
    renderTbed();
  }, 30);
}

function renderTbed() {
  var wrap = $id('tbed'); if (!wrap) return;
  var h = '<table><thead><tr>';
  state.tblH.forEach(function(hh, ci){ h += '<th><input value="' + esc(hh) + '" oninput="window._tblHSet(' + ci + ',this.value)"></th>'; });
  h += '</tr></thead><tbody>';
  state.tblR.forEach(function(row, ri){
    h += '<tr>';
    state.tblH.forEach(function(_, ci){ h += '<td><input value="' + esc(row[ci]||'') + '" oninput="window._tblRSet(' + ri + ',' + ci + ',this.value)"></td>'; });
    h += '</tr>';
  });
  h += '</tbody></table>';
  wrap.innerHTML = h;
}

// Expose table cell update helpers to inline oninput handlers
window._tblHSet = function(ci, v) { state.tblH[ci] = v; };
window._tblRSet = function(ri, ci, v) { state.tblR[ri][ci] = v; };

function confirmTable() {
  var cap = $id('d-tcap').value.trim();
  var tnum = $id('d-tnum').value.trim();
  var data = { headers:[].concat(state.tblH), rows:state.tblR.map(function(r){ return [].concat(r); }), caption:cap, tablenum:tnum };
  if (_tblEditBlock) { Object.assign(_tblEditBlock.data, data); _refreshInner(_tblEditBlock); syncCode(); schedPv(); }
  else insertBlock('table', data);
}

/* ── Code ── */
function openCodeDialog() {
  state.editingBlock = null;
  openDlg('代码块',
    '<div class="df"><label>语言</label><select id="d-clang"><option>python</option><option>verilog</option><option>javascript</option><option>cpp</option><option>c</option><option>java</option><option>bash</option><option>html</option><option>css</option><option>text</option></select></div>' +
    '<div class="df"><label>代码</label><textarea id="d-ccode" rows="6" style="font-family:var(--fm);font-size:12px" placeholder="// 粘贴代码"></textarea></div>',
  'code');
}

function confirmCode() {
  var lang = $id('d-clang').value;
  var content = $id('d-ccode').value;
  var b = insertBlock('codeblock', { lang:lang, content:content });
  b.content = content; syncCode(); schedPv();
}

/* ── Infobox ── */
function openInfoboxDialog(b) {
  state.editingBlock = b || null;
  var d = b ? b.data : {};
  openDlg('信息框',
    '<div class="df"><label>类型</label><select id="d-ibtype"><option value="info"' + ((!d.ibType||d.ibType==='info')?' selected':'') + '>信息（蓝）</option><option value="ok"' + (d.ibType==='ok'?' selected':'') + '>成功（绿）</option><option value="warn"' + (d.ibType==='warn'?' selected':'') + '>警告（橙）</option><option value="error"' + (d.ibType==='error'?' selected':'') + '>错误（红）</option><option value="note"' + (d.ibType==='note'?' selected':'') + '>备注（灰）</option></select></div>' +
    '<div class="df"><label>标题</label><input id="d-ibtit" value="' + esc(d.ibTitle||'提示') + '" placeholder="标题"></div>' +
    '<div class="df"><label>内容</label><textarea id="d-ibcnt" rows="3" placeholder="内容……">' + esc(b ? b.content : '') + '</textarea></div>',
  'infobox');
}

function confirmInfobox() {
  var ibType = $id('d-ibtype').value;
  var ibTitle = $id('d-ibtit').value.trim();
  var content = $id('d-ibcnt').value.trim();
  if (state.editingBlock) {
    state.editingBlock.data.ibType = ibType; state.editingBlock.data.ibTitle = ibTitle; state.editingBlock.content = content;
    _refreshInner(state.editingBlock); syncCode(); schedPv();
  } else {
    var b = insertBlock('infobox', { ibType:ibType, ibTitle:ibTitle, content:content });
    b.content = content; syncCode(); schedPv();
  }
}

/* ── Dialog wiring ── */
on('openDialog', function(type, b, extra) {
  if (type === 'img')     openImgDialog(b);
  else if (type === 'video')   openVideoDialog(b);
  else if (type === 'eq')      openEqDialog(extra || 'block', b);
  else if (type === 'table')   openTableDialog(b);
  else if (type === 'infobox') openInfoboxDialog(b);
});

/* =========================================================
   CONTEXT MENUS
   ========================================================= */

var _treeCtxId = null, _treeCtxWrap = null;

function _openTreeCtxMenu(e, id, nodeWrap) {
  _treeCtxId = id; _treeCtxWrap = nodeWrap;
  var m = $id('ctxm-tree');
  var x = e.clientX, y = e.clientY;
  m.style.left = x + 'px'; m.style.top = y + 'px';
  m.classList.add('open');
  requestAnimationFrame(function() {
    var r = m.getBoundingClientRect();
    if (r.right > window.innerWidth) m.style.left = (x - r.width) + 'px';
    if (r.bottom > window.innerHeight) m.style.top = (y - r.height) + 'px';
  });
}

/* =========================================================
   INIT — called once from app.js after DOM is ready
   ========================================================= */

export function initToolbar() {
  // Register tree-sync callback in editor.js
  setTreeSyncFn(syncTree);

  // Listen for syncTree event from commandManager
  on('syncTree', function() { syncTree(); });

  // Listen for openTreeEdit event (e.g. after insertRawBlockAfter)
  on('openTreeEdit', function(bid) {
    var tnEl = $id('tn-' + bid);
    if (tnEl) _toggleTreeEdit(bid, tnEl);
  });

  /* ── Toolbar insert buttons ── */
  document.querySelectorAll('[data-insert]').forEach(function(btn){
    btn.addEventListener('click', function(){ insertBlock(btn.dataset.insert); });
  });
  document.querySelectorAll('[data-dialog]').forEach(function(btn){
    btn.addEventListener('click', function(){
      var d = btn.dataset.dialog;
      if (d === 'img')       openImgDialog();
      else if (d === 'video')      openVideoDialog();
      else if (d === 'eq-block')   openEqDialog('block');
      else if (d === 'eq-inline')  openEqDialog('inline');
      else if (d === 'table')      openTableDialog();
      else if (d === 'code')       openCodeDialog();
      else if (d === 'infobox')    openInfoboxDialog();
    });
  });

  /* ── Dialog confirm ── */
  $id('dcancel').addEventListener('click', closeDlg);
  $id('dconfirm').addEventListener('click', function(){
    if (state.dlgType === 'img')     confirmImg();
    else if (state.dlgType === 'video')   confirmVideo();
    else if (state.dlgType === 'eq')      confirmEq();
    else if (state.dlgType === 'table')   confirmTable();
    else if (state.dlgType === 'code')    confirmCode();
    else if (state.dlgType === 'infobox') confirmInfobox();
    closeDlg();
  });
  $id('doverlay').addEventListener('click', function(e){ if (e.target === this) closeDlg(); });

  /* ── Top bar ── */
  $id('btn-export').addEventListener('click', function(){
    var blob = new Blob([$id('ctarea').value], { type:'text/html' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'article.html'; a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
  });
  $id('btn-copy').addEventListener('click', function(){
    var self = this;
    navigator.clipboard.writeText($id('ctarea').value).then(function(){
      var orig = self.textContent; self.textContent = '✓ 已复制';
      setTimeout(function(){ self.textContent = orig; }, 1500);
    });
  });
  $id('btn-import').addEventListener('click', function(){
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.html,.htm';
    inp.onchange = function(e){
      var f = e.target.files[0]; if (!f) return;
      var r = new FileReader(); r.onload = function(ev){
        $id('ctarea').value = ev.target.result;
        $id('cchars').textContent = ev.target.result.length + ' chars';
        doPv();
        applyCodeToBlocks();
      };
      r.readAsText(f);
    };
    inp.click();
  });
  $id('btn-clear').addEventListener('click', function(){
    if (state.blocks.length && !confirm('确定清空所有块？')) return;
    state.blocks = []; state.sel = null;
    var bl = $id('blist');
    bl.innerHTML = '<div id="ehint"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 5v14M5 12h14"/></svg><div>使用上方工具栏插入组件块</div><div style="font-size:10px;opacity:.6">每个组件独立生成代码片段</div></div>';
    $id('bcount').textContent = '0 个块';
    $id('ctarea').value = ''; $id('cchars').textContent = '0 chars';
    $id('pframe').src = 'about:blank';
    syncTree();
  });

  /* ── Code editor textarea ── */
  $id('ctarea').addEventListener('input', function(){
    $id('cchars').textContent = this.value.length + ' chars';
    schedPv();
    schedApplyCode();
  });

  /* ── Code editor tab buttons ── */
  $id('ce-tab-tree').addEventListener('click', function(){ switchCeTab('tree'); });
  $id('ce-tab-html').addEventListener('click', function(){ switchCeTab('html'); });

  /* ── Device/scale buttons ── */
  document.querySelectorAll('.dbtn').forEach(function(btn){
    btn.addEventListener('click', function(){
      document.querySelectorAll('.dbtn').forEach(function(b){ b.classList.remove('act'); });
      btn.classList.add('act');
      var w = btn.dataset.w;
      var cw = $id('cw'), ch = $id('ch'), cx = $id('cdx');
      var wrap = $id('pfwrap'), frame = $id('pframe');
      if (w === 'custom') {
        $id('pouter').classList.remove('pv-resp');
        cw.style.display = ch.style.display = cx.style.display = 'inline-block';
        applyCustom();
      } else {
        cw.style.display = ch.style.display = cx.style.display = 'none';
        if (w === '100%') {
          $id('pouter').classList.add('pv-resp');
          wrap.style.width = '100%'; frame.style.height = ''; frame.style.minHeight = '';
        } else {
          $id('pouter').classList.remove('pv-resp');
          wrap.style.width = w; frame.style.height = '820px'; frame.style.minHeight = '';
        }
        applyScale();
      }
    });
  });
  $id('cw').addEventListener('input', applyCustom);
  $id('ch').addEventListener('input', applyCustom);
  $id('pscale').addEventListener('change', applyScale);

  function applyCustom() {
    var w = parseInt($id('cw').value) || 800, h = parseInt($id('ch').value) || 600;
    $id('pfwrap').style.width = w + 'px'; $id('pframe').style.height = h + 'px';
    applyScale();
  }
  function applyScale() {
    var s = parseFloat($id('pscale').value) || 1;
    $id('pfwrap').style.transform = 'scale(' + s + ')';
    var fh = $id('pframe').style.height;
    if (fh && fh !== '100%') $id('pfwrap').style.marginBottom = ((parseInt(fh) * s) - parseInt(fh)) + 'px';
  }

  /* ── Resize handle ── */
  (function(){
    var handle = $id('rhandle'), dragging = false, sy = 0;
    handle.addEventListener('mousedown', function(e){ dragging = true; sy = e.clientY; document.body.style.cursor = 'ns-resize'; document.body.style.userSelect = 'none'; });
    document.addEventListener('mousemove', function(e){
      if (!dragging) return;
      var dy = e.clientY - sy;
      var be = $id('beditor'), ce = $id('cewrap');
      var nh = be.offsetHeight + dy, nc = ce.offsetHeight - dy;
      if (nh > 60 && nc > 50) { be.style.flex = 'none'; be.style.height = nh + 'px'; ce.style.flex = 'none'; ce.style.height = nc + 'px'; }
      sy = e.clientY;
    });
    document.addEventListener('mouseup', function(){ dragging = false; document.body.style.cursor = ''; document.body.style.userSelect = ''; });
  })();

  /* ── Tree context menu wiring ── */
  $id('cxt-edit').addEventListener('click', function() {
    if (_treeCtxWrap) _toggleTreeEdit(_treeCtxId, _treeCtxWrap);
  });
  $id('cxt-up').addEventListener('click', function(){ moveBlock(_treeCtxId, -1); });
  $id('cxt-dn').addEventListener('click', function(){ moveBlock(_treeCtxId,  1); });
  $id('cxt-dup').addEventListener('click', function(){ duplicateBlock(_treeCtxId); });
  $id('cxt-ins').addEventListener('click', function() {
    if (_treeCtxWrap) _toggleTreeInsert(_treeCtxId, _treeCtxWrap);
  });
  $id('cxt-del').addEventListener('click', function(){
    if (confirm('确定删除此块？')) deleteBlock(_treeCtxId);
  });

  /* ── Editor context menu wiring ── */
  on('openCtxMenu', function(e, id) {
    state.ctxId = id;
    var m = $id('ctxm');
    m.style.left = e.clientX + 'px'; m.style.top = e.clientY + 'px';
    m.classList.add('open');
  });
  $id('cx-up').addEventListener('click', function(){ moveBlock(state.ctxId, -1); });
  $id('cx-dn').addEventListener('click', function(){ moveBlock(state.ctxId,  1); });
  $id('cx-dup').addEventListener('click', function(){ duplicateBlock(state.ctxId); });
  $id('cx-del').addEventListener('click', function(){ deleteBlock(state.ctxId); });

  /* ── Code pane selection sync ── */
  (function() {
    var _codeSelTimer = null;
    function syncSelFromCode() {
      clearTimeout(_codeSelTimer);
      _codeSelTimer = setTimeout(function() {
        var ta = $id('ctarea');
        var before = ta.value.substring(0, ta.selectionStart);
        var m = before.match(/data-bid="(b\d+)"/g);
        if (!m || !m.length) return;
        var id = m[m.length - 1].slice('data-bid="'.length, -1);
        if (id && id !== state.sel && state.blocks.find(function(b){ return b.id === id; })) {
          setSelected(id);
        }
      }, 300);
    }
    $id('ctarea').addEventListener('click',  syncSelFromCode);
    $id('ctarea').addEventListener('keyup',  syncSelFromCode);
  })();

  /* ── Floating format bar ── */
  (function(){
    var bar = $id('fmt-bar');
    var _savedRange = null;
    var _hideFmtTimer = null;

    bar.addEventListener('mousedown', function(e) {
      var sel = window.getSelection();
      if (sel && sel.rangeCount > 0) _savedRange = sel.getRangeAt(0).cloneRange();
      e.preventDefault();
    });

    function restoreSel() {
      if (_savedRange) {
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(_savedRange);
      }
    }

    function afterFormat() {
      var el = document.activeElement;
      while (el && el !== document.body) {
        if (el.classList && el.classList.contains('rich-be')) {
          el.dispatchEvent(new Event('input', { bubbles: true }));
          break;
        }
        el = el.parentNode;
      }
    }

    $id('fmt-b').addEventListener('click', function() { restoreSel(); document.execCommand('bold',          false, null); afterFormat(); });
    $id('fmt-i').addEventListener('click', function() { restoreSel(); document.execCommand('italic',        false, null); afterFormat(); });
    $id('fmt-s').addEventListener('click', function() { restoreSel(); document.execCommand('strikeThrough', false, null); afterFormat(); });
    $id('fmt-u').addEventListener('click', function() { restoreSel(); document.execCommand('underline',     false, null); afterFormat(); });

    document.querySelectorAll('.fmt-clr').forEach(function(sw) {
      sw.addEventListener('click', function() {
        restoreSel();
        var c = sw.dataset.c;
        if (c) {
          document.execCommand('styleWithCSS', false, true);
          document.execCommand('foreColor', false, c);
          document.execCommand('styleWithCSS', false, false);
        } else {
          document.execCommand('styleWithCSS', false, true);
          document.execCommand('foreColor', false, 'inherit');
          document.execCommand('styleWithCSS', false, false);
        }
        afterFormat();
      });
    });

    function nodeInRichBE(node) {
      while (node && node !== document.body) {
        if (node.classList && node.classList.contains('rich-be')) return node;
        node = node.parentNode;
      }
      return null;
    }

    document.addEventListener('selectionchange', function() {
      clearTimeout(_hideFmtTimer);
      var sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        _hideFmtTimer = setTimeout(function() { bar.classList.remove('vis'); }, 120);
        return;
      }
      var rb = nodeInRichBE(sel.anchorNode);
      if (!rb) { _hideFmtTimer = setTimeout(function() { bar.classList.remove('vis'); }, 120); return; }

      var range = sel.getRangeAt(0);
      var rect = range.getBoundingClientRect();
      if (!rect.width && !rect.height) { bar.classList.remove('vis'); return; }

      bar.classList.add('vis');
      var bw = bar.offsetWidth || 200;
      var bh = bar.offsetHeight || 34;
      var left = Math.max(4, Math.min(rect.left + rect.width / 2 - bw / 2, window.innerWidth - bw - 4));
      var top  = rect.top - bh - 8;
      if (top < 4) top = rect.bottom + 8;
      bar.style.left = left + 'px';
      bar.style.top  = top  + 'px';

      try {
        $id('fmt-b').classList.toggle('on', document.queryCommandState('bold'));
        $id('fmt-i').classList.toggle('on', document.queryCommandState('italic'));
        $id('fmt-s').classList.toggle('on', document.queryCommandState('strikeThrough'));
        $id('fmt-u').classList.toggle('on', document.queryCommandState('underline'));
      } catch(e) {}
    });
  })();
}
