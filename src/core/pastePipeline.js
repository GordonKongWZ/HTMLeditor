/**
 * pastePipeline.js — Paste handling pipeline.
 *
 * Pipeline stages:
 *   1. sanitize   — strip unsafe tags / event attributes
 *   2. detect     — identify HTML vs plain text
 *   3. transform  — parse into block objects (article format → generic HTML → plain text)
 *   4. normalize  — enforce block structure (handled inside mkBlock)
 *   5. insert     — batch insert via commandManager / show confirm dialog
 *
 * Exports:
 *   - _sanitizeHtml(html) : string
 *   - _parsePasteContent(html, text) : block[]
 *   - openPasteDlg(html, text) : void
 *   - closePasteDlg() : void
 *   - confirmPaste() : void
 *   - _htmlToParagraphs(html, plainText) : string[]  (inline paste in paragraph)
 *   - _getCaretSplitContent(el) : { before, after }
 *   - _splitParagraphAtCursor(b, el) : void
 *   - _insertPBlocksAfter(afterBid, contentArray, align) : string  (last inserted id)
 *   - _handlePBlockPaste(e, d, b) : void
 *   - _handleGenericRichPaste(e) : void
 */

import { state, $id, mkBlock, mkDiv, _buildBlockEl, _appendBlockEl, syncCode, schedPv, _updateCount, b2html, wrapHTML, parseHtmlToBlocks, _cleanInlineNode, _trimBrs } from './editor.js';
import { setSelected } from './selection.js';
import { on } from './eventBus.js';

/* =========================================================
   1. SANITIZE
   ========================================================= */

/**
 * Strip script tags and event-handler attributes from an HTML string.
 * @param {string} html
 * @returns {string}
 */
export function _sanitizeHtml(html) {
  if (!html) return '';
  var doc = new DOMParser().parseFromString('<body>' + html + '</body>', 'text/html');
  doc.querySelectorAll('script,noscript').forEach(function(el){ el.remove(); });
  doc.querySelectorAll('*').forEach(function(el){
    Array.prototype.slice.call(el.attributes).forEach(function(attr){
      if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
      if ((attr.name === 'href' || attr.name === 'src' || attr.name === 'action') &&
          /^javascript:/i.test(attr.value)) el.removeAttribute(attr.name);
    });
  });
  return doc.body.innerHTML;
}

/* =========================================================
   2 & 3. DETECT + TRANSFORM
   ========================================================= */

/** True when the HTML string contains meaningful block markup. */
function _hasHtmlMarkup(htmlStr) {
  return /<(h[1-6]|p|ul|ol|li|blockquote|table|pre|code|div|section|hr)\b/i.test(htmlStr);
}

/**
 * Parse an arbitrary HTML container into blocks (generic fallback parser).
 * Extension point: each component's onPaste() could intercept before this.
 */
function _parseGenericHtmlToBlocks(container) {
  var children = Array.prototype.slice.call(container.children);
  if (children.length === 1 && children[0].tagName.toLowerCase() === 'div') {
    var inner = _parseGenericHtmlToBlocks(children[0]);
    if (inner.length) return inner;
  }
  var blocks = [];
  children.forEach(function(el) {
    var tag = el.tagName.toLowerCase();
    if (tag === 'hr') {
      blocks.push(mkBlock('divider', {}));
    } else if (/^h[1-5]$/.test(tag)) {
      var txt = el.textContent.trim();
      if (txt) blocks.push(mkBlock(tag, { content: txt }));
    } else if (tag === 'p') {
      var content = _sanitizeHtml(el.innerHTML.trim());
      if (content) blocks.push(mkBlock('p', { content: content, align: el.style.textAlign || '' }));
    } else if (tag === 'blockquote') {
      var bqp = el.querySelector('p');
      blocks.push(mkBlock('blockquote', { content: _sanitizeHtml(bqp ? bqp.innerHTML : el.innerHTML) }));
    } else if (tag === 'ul') {
      var uls = Array.prototype.slice.call(el.querySelectorAll('li')).map(function(li){ return li.textContent.trim(); }).filter(Boolean);
      if (uls.length) blocks.push(mkBlock('ul', { content: uls.join('\n') }));
    } else if (tag === 'ol') {
      var ols = Array.prototype.slice.call(el.querySelectorAll('li')).map(function(li){ return li.textContent.trim(); }).filter(Boolean);
      if (ols.length) blocks.push(mkBlock('ol', { content: ols.join('\n') }));
    } else if (tag === 'pre') {
      var codeEl = el.querySelector('code') || el;
      var langMatch = codeEl.className.match(/language-(\w+)/);
      blocks.push(mkBlock('codeblock', { lang: langMatch ? langMatch[1] : '', content: codeEl.textContent }));
    } else if (tag === 'table') {
      var headers = Array.prototype.slice.call(el.querySelectorAll('thead th')).map(function(th){ return th.textContent.trim(); });
      if (!headers.length) {
        var firstRow = el.querySelector('tr');
        if (firstRow) headers = Array.prototype.slice.call(firstRow.querySelectorAll('th')).map(function(c){ return c.textContent.trim(); });
      }
      var rows = Array.prototype.slice.call(el.querySelectorAll('tbody tr')).map(function(tr){
        return Array.prototype.slice.call(tr.querySelectorAll('td')).map(function(td){ return td.textContent.trim(); });
      });
      if (!rows.length) {
        var allRows = Array.prototype.slice.call(el.querySelectorAll('tr'));
        rows = allRows.slice(headers.length ? 1 : 0).map(function(tr){
          return Array.prototype.slice.call(tr.querySelectorAll('td,th')).map(function(td){ return td.textContent.trim(); });
        });
      }
      blocks.push(mkBlock('table', { headers: headers, rows: rows, caption: '', tablenum: '' }));
    } else if (tag === 'div' || tag === 'section' || tag === 'article' || tag === 'main') {
      var sub = _parseGenericHtmlToBlocks(el);
      if (sub.length) blocks = blocks.concat(sub);
      else { var rh = _sanitizeHtml(el.outerHTML.trim()); if (rh) blocks.push(mkBlock('raw', { html: rh })); }
    } else {
      var rh2 = _sanitizeHtml(el.outerHTML.trim());
      if (rh2) blocks.push(mkBlock('raw', { html: rh2 }));
    }
  });
  return blocks;
}

/**
 * Parse clipboard data (html + text) to an array of block objects.
 * Tries article format first, then generic HTML, then plain text.
 * Extension point: component onPaste() hooks can pre-process the fragment.
 */
export function _parsePasteContent(html, text) {
  if (html && html.trim() && _hasHtmlMarkup(html)) {
    var artBlocks = parseHtmlToBlocks(html);
    if (artBlocks && artBlocks.length) return artBlocks;
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var genBlocks = _parseGenericHtmlToBlocks(doc.body);
    if (genBlocks.length) return genBlocks;
  }
  var src = (text || '').trim();
  if (!src) return [];
  return src.split('\n')
    .map(function(line){ return line.trim(); })
    .filter(Boolean)
    .map(function(line){ return mkBlock('p', { content: line }); });
}

/* =========================================================
   INLINE PASTE HELPERS (paragraph / rich-text blocks)
   ========================================================= */

/**
 * Parse HTML/plain-text into an array of inline paragraph HTML strings.
 * Used when pasting inside an existing paragraph block.
 */
export function _htmlToParagraphs(html, plainText) {
  if (!html || !html.trim()) {
    var src = (plainText || '').trim();
    if (!src) return [];
    var blocks = src.split(/\n{2,}/);
    return blocks.map(function(bl){
      return bl.split('\n').map(function(line){ return line.trim(); }).filter(Boolean).join('<br>');
    }).filter(Boolean);
  }
  var doc = new DOMParser().parseFromString(html, 'text/html');
  var segments = [];
  var inline = [];

  function flushInline() {
    var s = _trimBrs(inline.join(''));
    if (s) segments.push(s);
    inline = [];
  }

  function walk(node) {
    if (node.nodeType === 3) { inline.push(_cleanInlineNode(node)); return; }
    if (node.nodeType !== 1) return;
    var tag = node.tagName.toLowerCase();
    var BLOCK_TAGS = ['p','div','h1','h2','h3','h4','h5','h6','li','blockquote','pre','tr','td','th','br'];
    if (tag === 'br') { inline.push('<br>'); return; }
    if (BLOCK_TAGS.indexOf(tag) >= 0) {
      Array.prototype.slice.call(node.childNodes).forEach(walk);
      flushInline();
    } else {
      inline.push(_cleanInlineNode(node));
    }
  }

  Array.prototype.slice.call(doc.body.childNodes).forEach(walk);
  flushInline();
  return segments.filter(Boolean);
}

/**
 * Get the HTML content before and after the current caret position in el.
 */
export function _getCaretSplitContent(el) {
  var sel = window.getSelection();
  if (!sel || !sel.rangeCount) return { before: el.innerHTML, after: '' };
  var range = sel.getRangeAt(0);
  range.deleteContents();

  var beforeRange = document.createRange();
  beforeRange.setStart(el, 0);
  beforeRange.setEnd(range.startContainer, range.startOffset);

  var afterRange = document.createRange();
  afterRange.setStart(range.startContainer, range.startOffset);
  afterRange.setEndAfter(el.lastChild || el);

  var tmp1 = document.createElement('div'); tmp1.appendChild(beforeRange.cloneContents());
  var tmp2 = document.createElement('div'); tmp2.appendChild(afterRange.cloneContents());
  return { before: tmp1.innerHTML, after: tmp2.innerHTML };
}

/**
 * Split a paragraph block at the cursor, creating a new paragraph block below.
 */
export function _splitParagraphAtCursor(b, el) {
  var parts = _getCaretSplitContent(el);
  el.innerHTML = parts.before;
  b.content = parts.before;

  var idx = state.blocks.findIndex(function(blk){ return blk.id === b.id; });
  if (idx < 0) return;

  var newBlock = mkBlock('p', { content: parts.after, align: b.data.align || '' });
  state.blocks.splice(idx + 1, 0, newBlock);

  var origEl = $id(b.id);
  var newEl = _buildBlockEl(newBlock);
  if (origEl && origEl.nextSibling) origEl.parentNode.insertBefore(newEl, origEl.nextSibling);
  else if (origEl) origEl.parentNode.appendChild(newEl);
  else $id('blist').appendChild(newEl);

  var hint = $id('ehint'); if (hint && hint.parentNode) hint.parentNode.removeChild(hint);
  _updateCount(); syncCode(); schedPv();

  setTimeout(function() {
    var newBEl = $id(newBlock.id);
    if (!newBEl) return;
    var richEl = newBEl.querySelector('.rich-be');
    if (!richEl) return;
    richEl.focus();
    var s = window.getSelection();
    var r = document.createRange();
    r.setStart(richEl, 0);
    r.collapse(true);
    s.removeAllRanges(); s.addRange(r);
  }, 10);
}

/**
 * Insert multiple paragraph blocks after `afterBid`.
 * @returns {string} id of the last inserted block
 */
export function _insertPBlocksAfter(afterBid, contentArray, align) {
  var idx = state.blocks.findIndex(function(blk){ return blk.id === afterBid; });
  if (idx < 0) return afterBid;
  var lastInsertedEl = $id(afterBid);
  var lastId = afterBid;
  contentArray.forEach(function(content, i) {
    var nb = mkBlock('p', { content: content, align: align || '' });
    state.blocks.splice(idx + 1 + i, 0, nb);
    var newEl = _buildBlockEl(nb);
    if (lastInsertedEl && lastInsertedEl.nextSibling) lastInsertedEl.parentNode.insertBefore(newEl, lastInsertedEl.nextSibling);
    else if (lastInsertedEl) lastInsertedEl.parentNode.appendChild(newEl);
    else $id('blist').appendChild(newEl);
    lastInsertedEl = newEl;
    lastId = nb.id;
  });
  return lastId;
}

/* =========================================================
   PASTE HANDLERS FOR SPECIFIC BLOCK TYPES
   ========================================================= */

/**
 * Handle paste inside a generic rich-text block (blockquote, abstract, infobox).
 * Inserts sanitized inline content only (no new blocks).
 */
export function _handleGenericRichPaste(e) {
  e.preventDefault();
  var html  = e.clipboardData ? e.clipboardData.getData('text/html')  : '';
  var text  = e.clipboardData ? e.clipboardData.getData('text/plain') : '';
  var paras = _htmlToParagraphs(html, text);
  if (!paras.length) return;
  document.execCommand('insertHTML', false, paras.join('<br>'));
}

/* =========================================================
   5. PASTE DIALOG (confirm bulk paste)
   ========================================================= */

var _pasteBlocks = [];

/**
 * Open the paste confirmation dialog showing the parsed blocks.
 */
export function openPasteDlg(html, text) {
  _pasteBlocks = _parsePasteContent(html || '', text || '');
  if (!_pasteBlocks.length) return;

  var previewBody = _pasteBlocks.map(b2html).join('\n\n');
  var rawHtml = wrapHTML(previewBody);
  var previewDoc = new DOMParser().parseFromString(rawHtml, 'text/html');
  previewDoc.querySelectorAll('script').forEach(function(s){ s.remove(); });
  var previewHtml = '<!DOCTYPE html>\n' + previewDoc.documentElement.outerHTML;

  $id('paste-iframe').srcdoc = previewHtml;
  $id('paste-code').value = _pasteBlocks.map(b2html).join('\n\n');
  $id('paste-block-count').textContent = _pasteBlocks.length;
  $id('paste-overlay').classList.add('open');
}

/** Close the paste dialog without inserting. */
export function closePasteDlg() {
  $id('paste-overlay').classList.remove('open');
  _pasteBlocks = [];
}

/** Confirm paste dialog: insert all parsed blocks. */
export function confirmPaste() {
  if (!_pasteBlocks.length) { closePasteDlg(); return; }
  var bl = $id('blist');
  var selIdx = state.sel ? state.blocks.findIndex(function(b){ return b.id === state.sel; }) : -1;
  var hint = $id('ehint'); if (hint) hint.remove();
  _pasteBlocks.forEach(function(src, i) {
    var nb = JSON.parse(JSON.stringify(src));
    nb.id = mkBlock(src.type, {}).id;
    var newEl = _buildBlockEl(nb);
    if (selIdx >= 0) {
      state.blocks.splice(selIdx + 1 + i, 0, nb);
      var refId = i === 0 ? state.sel : state.blocks[selIdx + i].id;
      var refEl = $id(refId);
      if (refEl && refEl.nextSibling) refEl.parentNode.insertBefore(newEl, refEl.nextSibling);
      else bl.appendChild(newEl);
    } else {
      state.blocks.push(nb);
      bl.appendChild(newEl);
    }
  });
  _updateCount(); syncCode(); schedPv();
  closePasteDlg();
}

/* =========================================================
   EVENT BUS WIRING
   ========================================================= */

on('splitParagraph', function(b, el){ _splitParagraphAtCursor(b, el); });

// Fallback inline-paste handlers for block types without dedicated component folders.
// Components that have their own index.js (paragraph, abstract, citation) register
// their handlers in their own paste.js files.
['infobox'].forEach(function(type) {
  on('inlinePaste:' + type, function(e){ _handleGenericRichPaste(e); });
});
