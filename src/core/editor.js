/**
 * editor.js — Core editor state and DOM-building utilities.
 *
 * Exports:
 *   - Mutable state object (state)
 *   - Utility helpers: uid, mkBlock, $id, mkDiv, esc, debounce
 *   - Block element builders: _buildBlockEl, _appendBlockEl, _buildInner, _refreshInner
 *   - Code-sync and preview scheduling: syncCode, b2html, wrapHTML, schedPv, doPv
 *   - HTML → blocks parser: parseHtmlToBlocks
 */

import { emit } from './eventBus.js';

/* =========================================================
   MUTABLE STATE
   All modules read/write state via this single shared object.
   ========================================================= */
export const state = {
  blocks: [],
  sel: null,          // currently selected block id
  ctxId: null,        // block id for active context menu
  dlgType: null,      // active dialog type string
  tblH: [],           // table dialog: current headers
  tblR: [],           // table dialog: current rows
  eqMode: 'block',    // equation dialog mode ('block'|'inline')
  pvTimer: null,      // preview debounce timer
  idSeq: 0,           // block id sequence counter
  editingBlock: null, // block being edited in a dialog
  syncingFromCode: false,       // guard: prevent feedback loop
  pendingScrollBid: null,       // bid to scroll to in preview on next render
  draggingId: null,             // bid being dragged for reorder
  treeMode: true,               // true = tree view; false = raw HTML textarea
  treeExpanded: {},             // bid → bool: whether expanded in tree
  syncTreeTimer: null,          // debounce timer for tree rebuild
};

export const TREE_DEPTH_MAX = 5;

/* =========================================================
   BLOCK DEFINITIONS
   Canonical display labels and default content strings.
   Extension point: add new types here or via schemaRegistry.
   ========================================================= */
export const DEFS = {
  h1:        { label:'H1',       def:'' },
  h2:        { label:'H2',       def:'' },
  h3:        { label:'H3',       def:'' },
  h4:        { label:'H4',       def:'' },
  h5:        { label:'H5',       def:'' },
  p:         { label:'段落',     def:'' },
  blockquote:{ label:'引用',     def:'' },
  ul:        { label:'无序列表', def:'' },
  ol:        { label:'有序列表', def:'' },
  abstract:  { label:'摘要',     def:'' },
  authors:   { label:'作者',     def:'' },
  keywords:  { label:'关键词',   def:'' },
  infobox:   { label:'信息框',   def:'' },
  eq:        { label:'公式块',   def:'' },
  'eq-inline':{ label:'行内式', def:'' },
  img:       { label:'图片',     def:'' },
  video:     { label:'视频',     def:'' },
  table:     { label:'表格',     def:'' },
  codeblock: { label:'代码块',   def:'' },
  refs:      { label:'文献',     def:'' },
  divider:   { label:'分割线',   def:'' },
  raw:       { label:'自定义',   def:'' },
};

/* Alignment button definitions used by paragraph / abstract blocks */
export const ALIGN_DEFS = [
  { v:'',       label:'默认', svg:'<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="15" y2="18"/></svg>' },
  { v:'left',   label:'左',  svg:'<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>' },
  { v:'center', label:'中',  svg:'<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>' },
  { v:'right',  label:'右',  svg:'<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg>' },
  { v:'justify',label:'两端',svg:'<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>' },
];

/* =========================================================
   UTILITIES
   ========================================================= */

/** Generate a unique block id. */
export function uid() { return 'b' + (++state.idSeq); }

/** Create a new block object with sane defaults. */
export function mkBlock(type, data) {
  var d = DEFS[type] || { label: type, def: '' };
  return {
    id:      uid(),
    type:    type,
    label:   d.label,
    content: (data && data.content != null) ? data.content : d.def,
    data:    data || {},
  };
}

/** Shorthand for document.getElementById. */
export function $id(id) { return document.getElementById(id); }

/** Create a div, optionally setting its className. */
export function mkDiv(cls) {
  var d = document.createElement('div');
  if (cls) d.className = cls;
  return d;
}

/** HTML-escape a string for use in attribute values / innerHTML. */
export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

/** Return a debounced version of `fn` that fires after `ms` ms of silence. */
export function debounce(fn, ms) {
  var t;
  return function() {
    var a = arguments;
    clearTimeout(t);
    t = setTimeout(function(){ fn.apply(null, a); }, ms);
  };
}

/* =========================================================
   EDITABLE ELEMENT FACTORIES
   ========================================================= */

/**
 * Create a plain contentEditable div for simple text blocks (headings, lists…).
 * @param {string} content — initial HTML/text content
 * @param {string} placeholder
 * @param {Object} [opts] — { enterBlurs: bool }
 */
export function makeBE(content, placeholder, opts) {
  var d = document.createElement('div');
  d.className = 'be';
  d.contentEditable = 'true';
  d.setAttribute('data-ph', placeholder || '');
  d.spellcheck = false;
  if (content) d.innerHTML = content;
  if (opts && opts.enterBlurs) {
    d.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); d.blur(); }
    });
  }
  return d;
}

/**
 * Create a rich-text contentEditable div (paragraphs, abstracts…).
 * Supports paste interception and custom Enter handling.
 * @param {string} content — initial innerHTML
 * @param {string} placeholder
 * @param {Object} [opts] — { onEnter: fn(event, el) }
 */
export function makeRichBE(content, placeholder, opts) {
  var d = document.createElement('div');
  d.className = 'be rich-be';
  d.contentEditable = 'true';
  d.setAttribute('data-ph', placeholder || '');
  d.spellcheck = false;
  if (content) d.innerHTML = content;
  d.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (opts && opts.onEnter) { e.preventDefault(); opts.onEnter(e, d); }
    }
  });
  return d;
}

/* =========================================================
   INLINE NODE CLEANUP (used by paste pipeline)
   ========================================================= */

/**
 * Recursively clean an inline DOM node, preserving only safe formatting.
 * Returns an HTML string.
 */
export function _cleanInlineNode(node) {
  if (node.nodeType === 3) return esc(node.textContent);
  if (node.nodeType !== 1) return '';
  var tag = node.tagName.toLowerCase();
  var children = Array.prototype.slice.call(node.childNodes).map(_cleanInlineNode).join('');

  // Preserve safe inline tags
  if (['b','strong','i','em','u','s','del','strike','sup','sub','code'].indexOf(tag) >= 0) {
    return '<' + tag + '>' + children + '</' + tag + '>';
  }
  if (tag === 'a') {
    var href = (node.getAttribute('href') || '').trim();
    if (href && !/^javascript:/i.test(href)) {
      return '<a href="' + esc(href) + '">' + children + '</a>';
    }
    return children;
  }
  // Handle color spans
  var st = node.style || {};
  var fwStr = st.fontWeight || '';
  var fw = fwStr === 'bold' || fwStr === 'bolder' ? 700 : (parseInt(fwStr) || 0);
  var td = st.textDecoration || '';
  if (fw >= 700) return '<b>' + children + '</b>';
  if (td.indexOf('underline') >= 0) return '<u>' + children + '</u>';
  if (td.indexOf('line-through') >= 0) return '<s>' + children + '</s>';
  if (st.color) return '<span style="color:' + esc(st.color) + '">' + children + '</span>';
  return children;
}

/** Trim leading/trailing <br> tags from an HTML string. */
export function _trimBrs(html) {
  return html.replace(/^(\s*<br\s*\/?>)+/i,'').replace(/(\s*<br\s*\/?>)+$/i,'').trim();
}

/* =========================================================
   CODE SYNC (blocks → HTML textarea)
   ========================================================= */

/** Debounced tree sync — called after state.blocks changes. */
let _syncTreeFn = null;

/** Register the tree-sync callback (set by ui/toolbar.js after DOM is ready). */
export function setTreeSyncFn(fn) { _syncTreeFn = fn; }

/** Sync _blocks → HTML textarea and schedule tree rebuild. */
export function syncCode() {
  if (state.syncingFromCode) return;
  var body = state.blocks.map(b2html).join('\n\n');
  var html = wrapHTML(body);
  $id('ctarea').value = html;
  $id('cchars').textContent = html.length + ' chars';
  if (_syncTreeFn) _syncTreeFn();
}

/** Convert a single block object to an HTML string. */
export function b2html(b) {
  var al = b.data && b.data.align ? ' style="text-align:' + b.data.align + '"' : '';
  var bid = ' data-bid="' + b.id + '"';
  switch (b.type) {
    case 'h1': case 'h2': case 'h3': case 'h4': case 'h5':
      return '<' + b.type + bid + '>' + (b.content || '') + '</' + b.type + '>';
    case 'p':
      return '<p' + bid + al + '>' + (b.content || '') + '</p>';
    case 'blockquote':
      return '<blockquote' + bid + '><p>' + (b.content || '') + '</p></blockquote>';
    case 'ul': {
      var items = (b.content || '').split('\n').filter(Boolean);
      return '<ul' + bid + '>' + items.map(function(i){ return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>';
    }
    case 'ol': {
      var items2 = (b.content || '').split('\n').filter(Boolean);
      return '<ol' + bid + '>' + items2.map(function(i){ return '<li>' + esc(i) + '</li>'; }).join('') + '</ol>';
    }
    case 'abstract':
      return '<div class="abstract-box"' + bid + al + '><p class="abs-label">Abstract / 摘要</p><p>' + (b.content || '') + '</p></div>';
    case 'authors':
      return '<p class="paper-authors"' + bid + '>' + (b.content || '').split('\n').map(esc).join('<br>') + '</p>';
    case 'keywords': {
      var kws = (b.content || '').split(',').map(function(k){ return '<span class="kw">' + esc(k.trim()) + '</span>'; }).join('');
      return '<div class="kw-row"' + bid + '>' + kws + '</div>';
    }
    case 'infobox': {
      var ibType = (b.data && b.data.ibType) || 'info';
      var ibTitle = (b.data && b.data.ibTitle) || '提示';
      return '<div class="ib ib-' + ibType + '"' + bid + '><p class="ibt">' + esc(ibTitle) + '</p>' + (b.content || '') + '</div>';
    }
    case 'eq': {
      var eqRaw = (b.data && b.data.raw) || '';
      var eqLbl = (b.data && b.data.label) ? ' data-eqlabel="' + esc(b.data.label) + '"' : '';
      return '<div class="eq"' + bid + eqLbl + '>$$' + eqRaw + '$$</div>';
    }
    case 'eq-inline':
      return '<p' + bid + '>$' + ((b.data && b.data.raw) || '') + '$</p>';
    case 'img': {
      var d = b.data || {};
      var numStr = d.fignum ? '<p class="fn">' + esc(d.fignum) + '</p>' : '';
      var capStr = d.caption ? '<figcaption>' + esc(d.caption) + '</figcaption>' : '';
      return '<figure class="af"' + bid + '>'
        + (d.src ? '<img src="' + esc(d.src) + '" alt="' + esc(d.alt || '') + '">' : '')
        + capStr + numStr + '</figure>';
    }
    case 'video': {
      var dv = b.data || {};
      var numVStr = dv.fignum ? '<p class="fn">' + esc(dv.fignum) + '</p>' : '';
      var capVStr = dv.caption ? '<figcaption>' + esc(dv.caption) + '</figcaption>' : '';
      var vidEl = '';
      if (dv.src) {
        if (dv.vtype === 'iframe') vidEl = '<iframe src="' + esc(dv.src) + '" frameborder="0" allowfullscreen></iframe>';
        else vidEl = '<video src="' + esc(dv.src) + '" controls></video>';
      }
      return '<figure class="vw"' + bid + '>' + vidEl + capVStr + numVStr + '</figure>';
    }
    case 'table': {
      var dt = b.data || {};
      var h = dt.headers || [], r = dt.rows || [];
      var capT = dt.caption ? '<p class="tc"><span class="tn2">' + esc(dt.tablenum || '') + '</span>' + esc(dt.caption) + '</p>' : '';
      var thead = h.length ? '<thead><tr>' + h.map(function(hh){ return '<th>' + esc(hh) + '</th>'; }).join('') + '</tr></thead>' : '';
      var tbody = r.length ? '<tbody>' + r.map(function(row){
        return '<tr>' + h.map(function(_,ci){ return '<td>' + esc(row[ci] || '') + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody>' : '';
      return '<div class="tw"' + bid + '>' + capT + '<table>' + thead + tbody + '</table></div>';
    }
    case 'codeblock': {
      var dc = b.data || {};
      return '<div class="cbw"' + bid + '><p class="cl">' + esc(dc.lang || 'code') + '</p><pre><code>' + esc(b.content || '') + '</code></pre></div>';
    }
    case 'refs': {
      var refLines = (b.content || '').split('\n').filter(Boolean);
      return '<div class="refs"' + bid + '><ol>' + refLines.map(function(l){ return '<li>' + esc(l) + '</li>'; }).join('') + '</ol></div>';
    }
    case 'divider':
      return '<hr' + bid + '>';
    case 'raw':
      return (b.data && b.data.html) ? b.data.html.replace(/\s*data-bid="[^"]*"/, '') + ' ' + bid.trim() : ('<!-- raw block -->' + bid);
    default:
      return '<p' + bid + '>' + esc(b.content || '') + '</p>';
  }
}

/** Wrap a body HTML string in the full article template. */
export function wrapHTML(body) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css"
  integrity="sha384-nB0miv6/jRmo5UMMR1wu3Gz6NLsoTkbqJghGIsx//Rlm+ZU03BU6SQNC66uf4l5"
  crossorigin="anonymous">
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"
  integrity="sha384-7zkQWkzuo3B5mTepMUcHkMB5jZaolc2xDwL6VFqjFALcbeS9Ggm/Yr2r3Dy4lfFg"
  crossorigin="anonymous"
  onload="document.querySelectorAll('.eq').forEach(function(el){try{var raw=el.textContent.trim().replace(/^\\$\\$/,'').replace(/\\$\\$$/,'').trim();el.innerHTML='';katex.render(raw,el,{displayMode:true,throwOnError:false});}catch(e){}});document.querySelectorAll('p').forEach(function(el){var t=el.textContent;var m=t.match(/^\\$(.+)\\$$/);if(m){try{var sp=document.createElement('span');katex.render(m[1],sp,{displayMode:false,throwOnError:false});el.innerHTML=sp.outerHTML;}catch(e){}}});"><\/script>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,"Helvetica Neue",Arial,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;
  max-width:860px;margin:0 auto;padding:32px 24px;color:#1a1a18;line-height:1.7;background:#fff}
h1{font-size:1.55rem;font-weight:800;margin-bottom:6px;line-height:1.25}
h2{font-size:1.15rem;font-weight:700;margin-top:28px;margin-bottom:8px;color:#2644ba}
h3{font-size:1rem;font-weight:600;margin-top:20px;margin-bottom:6px}
h4{font-size:.92rem;font-weight:500;margin-top:14px;margin-bottom:4px;color:#5f5e5a}
h5{font-size:.78rem;font-weight:500;text-transform:uppercase;letter-spacing:.06em;color:#888780;margin-top:12px}
p{margin-bottom:10px;font-size:.95rem}
.paper-authors{font-size:.88rem;color:#5f5e5a;margin-bottom:14px}
.abstract-box{background:#e8ecf9;border:.5px solid #b8c4ec;border-radius:8px;padding:12px 16px;margin-bottom:16px}
.abs-label{font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#2644ba;margin-bottom:5px}
.abstract-box p:not(.abs-label){font-size:.88rem;color:#1a3090;margin-bottom:0}
.kw-row{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}
.kw{background:#e8ecf9;color:#2644ba;font-size:.78rem;padding:2px 8px;border-radius:4px;border:.5px solid #b8c4ec}
blockquote{border-left:3px solid #2644ba;background:#e8ecf9;border-radius:0 8px 8px 0;padding:8px 14px;margin:12px 0;font-style:italic;color:#1a3090}
ul,ol{padding-left:1.5em;margin-bottom:10px}
li{margin-bottom:3px;font-size:.95rem}
.ib{border-radius:8px;padding:10px 14px;margin-bottom:10px}
.ib-info{background:#e8ecf9;border:.5px solid #b8c4ec}
.ib-ok{background:#EAF3DE;border:.5px solid #C0DD97}
.ib-warn{background:#FAEEDA;border:.5px solid #FAC775}
.ib-error{background:#FCEBEB;border:.5px solid #F7C1C1}
.ib-note{background:#f5f5f3;border:.5px solid rgba(0,0,0,.14)}
.ibt{font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px}
.eq{text-align:center;padding:10px;overflow-x:auto;margin:10px 0;font-size:1.05rem}
figure{margin:14px 0;text-align:center}
figure img,figure video,figure iframe{max-width:100%;border-radius:6px}
figcaption{font-size:.8rem;color:#5f5e5a;margin-top:4px}
.fn{font-size:.75rem;color:#888780}
.tw{overflow-x:auto;margin-bottom:12px}
table{border-collapse:collapse;font-size:.875rem;width:100%}
th{background:#e8ecf9;color:#1a3090;font-weight:500;padding:6px 10px;text-align:left;border-bottom:.5px solid #b8c4ec}
td{padding:5px 10px;border-bottom:.5px solid rgba(0,0,0,.08)}
tr:nth-child(even) td{background:#f5f5f3}
.tc{font-size:.75rem;color:#888780;margin-bottom:5px}
.cbw{background:#f5f5f3;border:.5px solid rgba(0,0,0,.14);border-radius:8px;overflow:hidden;margin-bottom:12px}
.cl{font-size:.7rem;color:#888780;padding:3px 10px;background:#eeede9;border-bottom:.5px solid rgba(0,0,0,.14)}
pre{padding:10px 12px;overflow-x:auto}
code{font-family:"SFMono-Regular",Consolas,"Liberation Mono",Menlo,monospace;font-size:.8rem;line-height:1.6}
.refs{margin-top:20px}
.refs ol{padding-left:1.6em;font-size:.85rem;color:#5f5e5a}
hr{border:none;border-top:1px solid rgba(0,0,0,.14);margin:18px 0}
</style>
</head>
<body class="ar">
${body}
</body>
</html>`;
}

/* =========================================================
   PREVIEW
   ========================================================= */

/** Schedule a preview refresh (debounced). */
export function schedPv() {
  clearTimeout(state.pvTimer);
  state.pvTimer = setTimeout(doPv, 380);
}

/** Immediately refresh the preview iframe. */
export function doPv() {
  var html = $id('ctarea').value;
  var frame = $id('pframe');
  var pendingBid = state.pendingScrollBid;
  state.pendingScrollBid = null;
  var scrollX = 0, scrollY = 0;
  if (!pendingBid) {
    try { scrollX = frame.contentWindow.scrollX || 0; scrollY = frame.contentWindow.scrollY || 0; } catch(e) {}
  }
  var doc = frame.contentDocument || (frame.contentWindow && frame.contentWindow.document);
  if (doc) {
    doc.open(); doc.write(html); doc.close();
    emit('pvRefreshed', frame);
    if (pendingBid) {
      setTimeout(function(){ scrollPreviewToBlock(pendingBid); }, 50);
    } else if (scrollX || scrollY) {
      try { frame.contentWindow.scrollTo(scrollX, scrollY); } catch(e) {}
    }
  } else {
    var blob = new Blob([html], { type:'text/html' });
    var url = URL.createObjectURL(blob);
    frame.src = url;
    frame.addEventListener('load', function _pvLoad() {
      frame.removeEventListener('load', _pvLoad);
      emit('pvRefreshed', frame);
    });
    setTimeout(function(){ URL.revokeObjectURL(url); }, 8000);
  }
}

/** Scroll the preview iframe to the element with data-bid=bid. */
export function scrollPreviewToBlock(bid) {
  if (!bid) return;
  var frame = $id('pframe');
  try {
    var doc = frame.contentDocument || frame.contentWindow.document;
    if (!doc || !doc.body) return;
    var el = doc.querySelector('[data-bid="' + bid + '"]');
    if (!el) return;
    var fh = frame.contentWindow.innerHeight || frame.clientHeight;
    var top = 0, node = el;
    while (node && node !== doc.body) { top += node.offsetTop || 0; node = node.offsetParent; }
    var dest = top - fh / 2 + el.offsetHeight / 2;
    frame.contentWindow.scrollTo({ top: Math.max(0, dest), behavior: 'smooth' });
    _ensurePvHlStyle(doc);
    var prev = doc.querySelector('._pv_hl');
    if (prev) { prev.classList.remove('_pv_hl'); void prev.offsetWidth; }
    void el.offsetWidth;
    el.classList.add('_pv_hl');
  } catch(e) {}
}

export function _ensurePvHlStyle(doc) {
  if (doc.getElementById('_pv_hl_style')) return;
  var s = doc.createElement('style');
  s.id = '_pv_hl_style';
  s.textContent = '@keyframes _pv_hl{0%,60%{outline:1.5px solid rgba(38,68,186,.85);background-color:rgba(38,68,186,.1)}100%{outline:1.5px solid rgba(38,68,186,0);background-color:rgba(38,68,186,0)}}._pv_hl{animation:_pv_hl 1.3s ease-out forwards!important;outline-offset:2px!important;}._pv_hl_ctx{outline:1.5px solid rgba(38,68,186,.85)!important;outline-offset:2px!important;}';
  (doc.head || doc.body).appendChild(s);
}

/** Scroll the block editor panel to show the block element. */
export function scrollEditorToBlock(id) {
  var el = $id(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/** Scroll the code/tree pane to the position of the given block id. */
export function _scrollCodeToBlock(id) {
  if (!id) return;
  if (state.treeMode) {
    var tnEl = $id('tn-' + id);
    if (tnEl) tnEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }
  var ta = $id('ctarea');
  if (document.activeElement === ta) return;
  var val = ta.value;
  var idx = val.indexOf('data-bid="' + id + '"');
  if (idx < 0) return;
  var linesBefore = val.substring(0, idx).split('\n').length - 1;
  var lineHeight = 12 * 1.65;
  ta.scrollTop = Math.max(0, linesBefore * lineHeight - ta.clientHeight / 3);
}

/* =========================================================
   HTML → BLOCKS PARSER
   ========================================================= */

/**
 * Parse an HTML string into an array of block objects.
 * Returns null if the HTML does not contain a .ar wrapper element.
 *
 * Security note: `el.innerHTML` is read from DOM elements already parsed by
 * DOMParser — it reflects the browser's HTML serialization of trusted
 * user-authored content.  The resulting block `content` values are later
 * rendered inside the preview iframe, which is intentional for an HTML
 * editor.  Consumers must NOT inject this content into the host page's DOM
 * without further sanitization.
 */
export function parseHtmlToBlocks(htmlStr) {
  var doc = new DOMParser().parseFromString(htmlStr, 'text/html');
  var ar = doc.querySelector('.ar');
  if (!ar) return null;

  var blocks = [];
  /** Strip unsafe tags from an element's content, keeping safe inline HTML. */
  function _cleanEl(el) {
    return Array.prototype.slice.call(el.childNodes).map(_cleanInlineNode).join('');
  }

  var children = Array.prototype.slice.call(ar.children);

  function capInfo(el) {
    if (!el) return { cap: '', num: '' };
    var numEl = el.querySelector('.tn2,.fn');
    var num = numEl ? numEl.textContent.trim() : '';
    var cap = el.textContent.replace(num, '').trim();
    return { cap: cap, num: num };
  }

  var i = 0;
  while (i < children.length) {
    var el = children[i];
    var tag = el.tagName.toLowerCase();

    if (tag === 'hr') { blocks.push(mkBlock('divider', {})); i++; continue; }
    if (/^h[1-5]$/.test(tag)) { blocks.push(mkBlock(tag, { content: _cleanEl(el) })); i++; continue; }
    if (tag === 'p') {
      var cls = el.className || '';
      if (cls.indexOf('paper-authors') >= 0) {
        var txt = el.innerHTML.replace(/<br\s*\/?>/gi, '\n');
        // Strip remaining tags safely via DOM text extraction
        var _tmpDiv = document.createElement('div');
        _tmpDiv.innerHTML = txt;
        txt = (_tmpDiv.textContent || '').trim();
        blocks.push(mkBlock('authors', { content: txt })); i++; continue;
      }
      // Check for inline equation: $...$
      var rawTxt = el.textContent.trim();
      if (/^\$[^$]+\$$/.test(rawTxt)) {
        var eqRaw = rawTxt.slice(1, -1);
        blocks.push(mkBlock('eq-inline', { raw: eqRaw })); i++; continue;
      }
      var align = el.style.textAlign || '';
      blocks.push(mkBlock('p', { content: el.innerHTML.trim(), align: align })); i++; continue;
    }
    if (tag === 'blockquote') {
      var bqp = el.querySelector('p');
      blocks.push(mkBlock('blockquote', { content: (bqp ? bqp.innerHTML : el.innerHTML).trim() })); i++; continue;
    }
    if (tag === 'ul') {
      var lis = Array.prototype.slice.call(el.querySelectorAll('li')).map(function(li){ return li.textContent.trim(); });
      blocks.push(mkBlock('ul', { content: lis.join('\n') })); i++; continue;
    }
    if (tag === 'ol') {
      var olis = Array.prototype.slice.call(el.querySelectorAll('li')).map(function(li){ return li.textContent.trim(); });
      blocks.push(mkBlock('ol', { content: olis.join('\n') })); i++; continue;
    }

    if (tag === 'div') {
      var cls2 = el.className || '';
      if (cls2.indexOf('abstract-box') >= 0) {
        var absP = el.querySelector('p:not(.abs-label)');
        var align2 = el.style.textAlign || '';
        blocks.push(mkBlock('abstract', { content: absP ? absP.innerHTML.trim() : '', align: align2 })); i++; continue;
      }
      if (cls2.indexOf('kw-row') >= 0) {
        var kws = Array.prototype.slice.call(el.querySelectorAll('.kw')).map(function(k){ return k.textContent.trim(); });
        blocks.push(mkBlock('keywords', { content: kws.join(', ') })); i++; continue;
      }
      if (cls2.indexOf('ib') >= 0 && !/^ib-/.test(cls2)) {
        var ibTypeM = cls2.match(/\bib-(\w+)\b/);
        var ibType = ibTypeM ? ibTypeM[1] : 'info';
        var ibt = el.querySelector('.ibt');
        var ibTitle = ibt ? ibt.textContent.trim() : '提示';
        ibt && ibt.parentNode.removeChild(ibt);
        blocks.push(mkBlock('infobox', { ibType: ibType, ibTitle: ibTitle, content: el.innerHTML.trim() })); i++; continue;
      }
      if (el.classList.contains('eq')) {
        var eqRaw2 = el.textContent.trim().replace(/^\$\$/, '').replace(/\$\$$/, '').trim();
        var eqLabel = el.getAttribute('data-eqlabel') || '';
        blocks.push(mkBlock('eq', { raw: eqRaw2, label: eqLabel })); i++; continue;
      }
      if (el.classList.contains('tw')) {
        var tbl = el.querySelector('table');
        var headers = [], rows = [];
        var tci = capInfo(el.querySelector('.tc'));
        if (tbl) {
          headers = Array.prototype.slice.call(tbl.querySelectorAll('thead th')).map(function(th){ return th.textContent.trim(); });
          rows = Array.prototype.slice.call(tbl.querySelectorAll('tbody tr')).map(function(tr){
            return Array.prototype.slice.call(tr.querySelectorAll('td')).map(function(td){ return td.textContent.trim(); });
          });
        }
        blocks.push(mkBlock('table', { headers: headers, rows: rows, caption: tci.cap, tablenum: tci.num })); i++; continue;
      }
      if (el.classList.contains('cbw')) {
        var cbcl = el.querySelector('.cl');
        var cbcode = el.querySelector('pre code');
        blocks.push(mkBlock('codeblock', { lang: cbcl ? cbcl.textContent.trim() : 'code', content: cbcode ? cbcode.textContent : '' })); i++; continue;
      }
      if (el.classList.contains('refs')) {
        var refItems = Array.prototype.slice.call(el.querySelectorAll('li')).map(function(li){ return li.textContent.trim(); });
        blocks.push(mkBlock('refs', { content: refItems.join('\n') })); i++; continue;
      }
    }

    if (tag === 'figure') {
      var cls3 = el.className || '';
      if (cls3.indexOf('vw') >= 0) {
        var vwSrc = ''; var vwType = 'file';
        var iframe = el.querySelector('iframe');
        var video = el.querySelector('video');
        if (iframe) { vwSrc = iframe.getAttribute('src') || ''; vwType = 'iframe'; }
        else if (video) vwSrc = video.getAttribute('src') || '';
        var vci = capInfo(el.querySelector('figcaption'));
        var vfn = capInfo(el.querySelector('.fn'));
        blocks.push(mkBlock('video', { src: vwSrc, vtype: vwType, caption: vci.cap, fignum: vfn.num })); i++; continue;
      }
      // Default figure → image
      var imgEl = el.querySelector('img');
      var fci = capInfo(el.querySelector('figcaption'));
      var ffn = capInfo(el.querySelector('.fn'));
      blocks.push(mkBlock('img', {
        src: imgEl ? (imgEl.getAttribute('src') || '') : '',
        alt: imgEl ? (imgEl.getAttribute('alt') || '') : '',
        caption: fci.cap,
        fignum: ffn.num,
      })); i++; continue;
    }

    // Fallback: raw block
    var rawHtml = el.outerHTML.replace(/\s*data-bid="[^"]*"/g, '').trim();
    blocks.push(mkBlock('raw', { html: rawHtml }));
    i++;
  }
  return blocks;
}

/* =========================================================
   BLOCK ELEMENT BUILDER
   ========================================================= */

/** Build the drag handle element for a block. */
function _mkDragHandle(bid) {
  var h = document.createElement('div');
  h.className = 'bdrag'; h.draggable = true; h.title = '拖动排序'; h.textContent = '⠿';
  h.addEventListener('dragstart', function(e) {
    state.draggingId = bid;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', bid);
    setTimeout(function(){ var el = $id(bid); if (el) el.style.opacity = '.4'; }, 0);
  });
  h.addEventListener('dragend', function() {
    var el = $id(bid); if (el) el.style.opacity = '';
    state.draggingId = null;
    document.querySelectorAll('.bi.drag-before,.bi.drag-after').forEach(function(n){
      n.classList.remove('drag-before'); n.classList.remove('drag-after');
    });
  });
  return h;
}

/**
 * Build the full DOM element for a block (wrapper + controls + inner content).
 * Imported by commandManager.js.
 */
export function _buildBlockEl(b) {
  var el = document.createElement('div');
  el.id = b.id;
  el.className = 'bi bi-' + b.type;

  // Left gutter controls
  var ctrl = mkDiv('bctrl');
  var btnUp = document.createElement('button'); btnUp.className = 'bcb'; btnUp.title = '上移'; btnUp.textContent = '↑';
  var btnDn = document.createElement('button'); btnDn.className = 'bcb'; btnDn.title = '下移'; btnDn.textContent = '↓';
  btnUp.addEventListener('click', function(e){ e.stopPropagation(); emit('moveBlock', b.id, -1); });
  btnDn.addEventListener('click', function(e){ e.stopPropagation(); emit('moveBlock', b.id,  1); });
  ctrl.appendChild(btnUp); ctrl.appendChild(_mkDragHandle(b.id)); ctrl.appendChild(btnDn);
  el.appendChild(ctrl);

  // Type badge
  var badge = document.createElement('span');
  badge.className = 'btbadge'; badge.textContent = b.label;
  el.appendChild(badge);

  // Inner content
  var inner = mkDiv('binn');
  _buildInner(inner, b);
  el.appendChild(inner);

  // Events
  el.addEventListener('click', function(){ emit('selectBlock', b.id); });
  el.addEventListener('contextmenu', function(e){ e.preventDefault(); emit('openCtxMenu', e, b.id); });
  el.addEventListener('dragover', function(e) {
    if (!state.draggingId || state.draggingId === b.id) return;
    e.preventDefault(); e.dataTransfer.dropEffect = 'move';
    var rect = el.getBoundingClientRect();
    var before = e.clientY < rect.top + rect.height / 2;
    el.classList.toggle('drag-before', before);
    el.classList.toggle('drag-after', !before);
  });
  el.addEventListener('dragleave', function(e) {
    if (!el.contains(e.relatedTarget)) {
      el.classList.remove('drag-before'); el.classList.remove('drag-after');
    }
  });
  el.addEventListener('drop', function(e) {
    e.preventDefault();
    var after = el.classList.contains('drag-after');
    el.classList.remove('drag-before'); el.classList.remove('drag-after');
    if (state.draggingId && state.draggingId !== b.id) emit('reorderBlock', state.draggingId, b.id, after);
  });

  return el;
}

/** Append a newly built block element to #blist and remove the empty hint. */
export function _appendBlockEl(b) {
  var hint = $id('ehint');
  if (hint && hint.parentNode) hint.parentNode.removeChild(hint);
  $id('blist').appendChild(_buildBlockEl(b));
}

/**
 * Populate the .binn element for a block.
 * Extension point: components register their own rendering via _buildInner switch.
 */
export function _buildInner(inner, b) {
  inner.innerHTML = '';

  function addEditBtn(label, fn) {
    var btn = document.createElement('button');
    btn.className = 'edit-btn'; btn.textContent = '✏ ' + label;
    btn.addEventListener('click', function(e){ e.stopPropagation(); fn(b); });
    inner.appendChild(btn);
  }

  function addBE(content, placeholder, onChange, opts) {
    var d = makeBE(content, placeholder, opts);
    inner.appendChild(d);
    d.addEventListener('input', function() { onChange(d.innerText); syncCode(); schedPv(); });
    return d;
  }

  function addRichBE(content, placeholder, onChange, opts) {
    var d = makeRichBE(content, placeholder, opts);
    inner.appendChild(d);
    d.addEventListener('input', function() { onChange(d.innerHTML); syncCode(); schedPv(); });
    return d;
  }

  function addAlignRow(b) {
    var row = mkDiv('align-row');
    ALIGN_DEFS.forEach(function(a) {
      var btn = document.createElement('button');
      btn.className = 'abtn' + (b.data.align === a.v ? ' on' : '');
      btn.innerHTML = a.svg + a.label;
      btn.title = a.label;
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        b.data.align = (b.data.align === a.v) ? '' : a.v;
        row.querySelectorAll('.abtn').forEach(function(ab){ ab.classList.remove('on'); });
        if (b.data.align) btn.classList.add('on');
        syncCode(); schedPv();
      });
      row.appendChild(btn);
    });
    inner.appendChild(row);
  }

  switch (b.type) {
    case 'h1': case 'h2': case 'h3': case 'h4': case 'h5':
      addBE(b.content, '输入标题…', function(v){ b.content = v; }, { enterBlurs: true });
      break;

    case 'p': {
      var d = addRichBE(b.content, '输入段落文字…', function(v){ b.content = v; }, {
        onEnter: function(e, el) { emit('splitParagraph', b, el); }
      });
      d.addEventListener('paste', function(e) { emit('inlinePaste:p', e, d, b); });
      addAlignRow(b);
      break;
    }

    case 'blockquote': {
      var wrap = mkDiv('bqx'); inner.appendChild(wrap);
      var d2 = makeRichBE(b.content, '引用文字…');
      d2.addEventListener('paste', function(e){ emit('inlinePaste:blockquote', e); });
      wrap.appendChild(d2);
      d2.addEventListener('input', function(){ b.content = d2.innerHTML; syncCode(); schedPv(); });
      break;
    }
    case 'ul': case 'ol': {
      var lbl = mkDiv(); lbl.style.cssText = 'font-size:10px;color:var(--t2);margin-bottom:4px';
      lbl.textContent = b.type === 'ul' ? '无序列表（每行一项）' : '有序列表（每行一项）';
      inner.appendChild(lbl);
      addBE(b.content, '列表项…', function(v){ b.content = v; });
      break;
    }
    case 'abstract': {
      var wrap2 = mkDiv('abx'); inner.appendChild(wrap2);
      var tit = mkDiv('abxtit'); tit.textContent = 'Abstract / 摘要'; wrap2.appendChild(tit);
      var d3 = makeRichBE(b.content, '摘要内容…');
      d3.addEventListener('paste', function(e){ emit('inlinePaste:abstract', e); });
      wrap2.appendChild(d3);
      d3.addEventListener('input', function(){ b.content = d3.innerHTML; syncCode(); schedPv(); });
      addAlignRow(b);
      break;
    }
    case 'authors': {
      var lbl2 = mkDiv(); lbl2.style.cssText = 'font-size:10px;color:var(--t2);margin-bottom:4px';
      lbl2.textContent = '作者 · 机构（换行分隔）'; inner.appendChild(lbl2);
      addBE(b.content, '作者信息…', function(v){ b.content = v; });
      break;
    }
    case 'keywords': {
      var lbl3 = mkDiv(); lbl3.style.cssText = 'font-size:10px;color:var(--t2);margin-bottom:4px';
      lbl3.textContent = '关键词（逗号分隔）'; inner.appendChild(lbl3);
      addBE(b.content, '关键词A, 关键词B…', function(v){ b.content = v; });
      break;
    }
    case 'infobox': {
      var colors = {
        info:  { bg:'var(--acl)', bd:'var(--acb)', tc:'var(--acd)' },
        ok:    { bg:'#EAF3DE',   bd:'#C0DD97',    tc:'#27500A' },
        warn:  { bg:'#FAEEDA',   bd:'#FAC775',    tc:'#633806' },
        error: { bg:'#FCEBEB',   bd:'#F7C1C1',    tc:'#791F1F' },
        note:  { bg:'var(--bg1)',bd:'var(--bm)',   tc:'var(--t0)' },
      };
      var c = colors[b.data.ibType || 'info'] || colors.info;
      var wrap3 = mkDiv('ibx');
      wrap3.style.background = c.bg; wrap3.style.border = '.5px solid ' + c.bd;
      var tit2 = mkDiv('ibxtit'); tit2.style.color = c.tc;
      tit2.textContent = b.data.ibTitle || '提示'; wrap3.appendChild(tit2);
      var d4 = makeRichBE(b.content, '内容…'); d4.style.color = c.tc;
      d4.addEventListener('paste', function(e){ emit('inlinePaste:infobox', e); });
      wrap3.appendChild(d4);
      inner.appendChild(wrap3);
      d4.addEventListener('input', function(){ b.content = d4.innerHTML; syncCode(); schedPv(); });
      addEditBtn('修改信息框', function(bl){ emit('openDialog', 'infobox', bl); });
      break;
    }
    case 'eq': {
      var wrap4 = mkDiv('eqx'); inner.appendChild(wrap4);
      var lbl4 = document.createElement('span'); lbl4.className = 'eqlbl';
      lbl4.textContent = '公式块' + (b.data.label ? ' · ' + b.data.label : ''); wrap4.appendChild(lbl4);
      var raw = mkDiv('eqraw'); raw.textContent = b.data.raw || '(空公式)'; wrap4.appendChild(raw);
      addEditBtn('编辑公式', function(bl){ emit('openDialog', 'eq', bl, 'block'); });
      break;
    }
    case 'eq-inline': {
      var lbl5 = mkDiv(); lbl5.style.cssText = 'font-size:10px;color:var(--t2);margin-bottom:4px';
      lbl5.textContent = '行内公式'; inner.appendChild(lbl5);
      var sp = document.createElement('span'); sp.className = 'iqx';
      sp.textContent = b.data.raw || '(空)'; inner.appendChild(sp);
      addEditBtn('编辑', function(bl){ emit('openDialog', 'eq', bl, 'inline'); });
      break;
    }
    case 'img': {
      var wrap5 = mkDiv('imgx'); inner.appendChild(wrap5);
      var ph = mkDiv('imgph');
      ph.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
      var nm = document.createElement('span');
      nm.textContent = b.data.src ? b.data.src.substring(0, 44) : '未设置图片 URL';
      ph.appendChild(nm); wrap5.appendChild(ph);
      var cap = mkDiv('imgcap'); cap.textContent = b.data.caption || '图片标题'; wrap5.appendChild(cap);
      addEditBtn('编辑图片', function(bl){ emit('openDialog', 'img', bl); });
      break;
    }
    case 'video': {
      var wrap6 = mkDiv('vidx'); inner.appendChild(wrap6);
      var ph2 = mkDiv('vidph');
      ph2.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>';
      var nm2 = document.createElement('span');
      nm2.textContent = b.data.src ? b.data.src.substring(0, 44) : '未设置视频 URL';
      ph2.appendChild(nm2); wrap6.appendChild(ph2);
      var cap2 = mkDiv('vidcap'); cap2.textContent = b.data.caption || '视频标题'; wrap6.appendChild(cap2);
      addEditBtn('编辑视频', function(bl){ emit('openDialog', 'video', bl); });
      break;
    }
    case 'table': {
      var lbl6 = mkDiv('tblcap');
      var th = b.data.headers || []; var tr = b.data.rows || [];
      lbl6.textContent = (b.data.caption || '表格') + (th.length ? ' · ' + th.length + '列 × ' + tr.length + '行' : '');
      inner.appendChild(lbl6);
      if (th.length) {
        var tblx = mkDiv('tblx'); inner.appendChild(tblx);
        var tbl2 = document.createElement('table');
        var thead2 = document.createElement('thead');
        var hr2 = document.createElement('tr');
        th.forEach(function(hh){ var thEl = document.createElement('th'); thEl.textContent = hh; hr2.appendChild(thEl); });
        thead2.appendChild(hr2); tbl2.appendChild(thead2);
        var tbody2 = document.createElement('tbody');
        tr.forEach(function(row){
          var trEl = document.createElement('tr');
          th.forEach(function(_, ci){ var tdEl = document.createElement('td'); tdEl.textContent = row[ci] || ''; trEl.appendChild(tdEl); });
          tbody2.appendChild(trEl);
        });
        tbl2.appendChild(tbody2); tblx.appendChild(tbl2);
      }
      addEditBtn('编辑表格', function(bl){ emit('openDialog', 'table', bl); });
      break;
    }
    case 'codeblock': {
      var wrap7 = mkDiv('cbx'); inner.appendChild(wrap7);
      var hdr = mkDiv('cbxh');
      var langSpan = document.createElement('span'); langSpan.textContent = b.data.lang || 'code'; hdr.appendChild(langSpan);
      wrap7.appendChild(hdr);
      var d5 = makeBE(b.content, '// 输入代码…');
      d5.style.fontFamily = 'var(--fm)'; d5.style.fontSize = '11px';
      d5.style.background = 'var(--bg1)'; d5.style.padding = '7px 9px'; d5.style.lineHeight = '1.6';
      wrap7.appendChild(d5);
      d5.addEventListener('input', function(){ b.content = d5.innerText; syncCode(); schedPv(); });
      break;
    }
    case 'refs': {
      var lbl7 = mkDiv(); lbl7.style.cssText = 'font-size:10px;font-weight:600;color:var(--t1);margin-bottom:5px;text-transform:uppercase;letter-spacing:.04em';
      lbl7.textContent = '参考文献（每行一条）'; inner.appendChild(lbl7);
      var d6 = makeBE(b.content, '1. 作者, 标题, 年份.');
      d6.style.fontSize = '12px'; d6.style.color = 'var(--t1)'; inner.appendChild(d6);
      d6.addEventListener('input', function(){ b.content = d6.innerText; syncCode(); schedPv(); });
      break;
    }
    case 'divider': {
      var wrap8 = mkDiv(); wrap8.style.cssText = 'display:flex;align-items:center;padding:4px 0;pointer-events:none';
      wrap8.innerHTML = '<div style="flex:1;height:1px;background:var(--bm)"></div><span style="font-size:10px;color:var(--t2);padding:0 8px">分割线</span><div style="flex:1;height:1px;background:var(--bm)"></div>';
      inner.appendChild(wrap8);
      break;
    }
    case 'raw': {
      var rawWrap = mkDiv('cbx'); inner.appendChild(rawWrap);
      var rawHd = mkDiv('cbxh');
      rawHd.innerHTML = '<span style="color:var(--ac);font-size:10px">自定义 HTML</span>';
      rawWrap.appendChild(rawHd);
      var rawPre = mkDiv('be');
      rawPre.style.cssText = 'font-family:var(--fm);font-size:10px;padding:6px 9px;overflow:auto;white-space:pre;max-height:80px;color:var(--t1);line-height:1.5';
      rawPre.textContent = (b.data.html || '<div></div>').substring(0, 300);
      rawWrap.appendChild(rawPre);
      break;
    }
    default: {
      addBE(b.content, '', function(v){ b.content = v; });
    }
  }
}

/** Re-render the inner content of an existing block element. */
export function _refreshInner(b) {
  var el = $id(b.id);
  if (!el) return;
  var inner = el.querySelector('.binn');
  if (inner) _buildInner(inner, b);
}

/* =========================================================
   BLOCK COUNT
   ========================================================= */

/** Update the block count display in the top bar. */
export function _updateCount() {
  var el = $id('bcount');
  if (el) el.textContent = state.blocks.length + ' 个块';
}
