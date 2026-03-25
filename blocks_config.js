/* =========================================================
   blocks_config.js
   块组件配置文件 — 独立于编辑器核心逻辑

   包含：
     · DEFS                - 各块类型的基本定义
     · ALIGN_DEFS          - 对齐按钮定义
     · SC_INSERT_DEFS      - 插入类快捷键配置（可自定义）
     · INSERT_BLOCK_TYPES  - 树视图插入面板的块类型列表
     · PREVIEW_CSS         - 预览输出的 CSS 样式
     · b2html(b)           - 块 → HTML 字符串
     · buildBlockInner(inner, b, api) — 块在编辑器中的 UI 构建
     · wrapHTML(body)      - 包装完整预览 HTML 文档

   所有内容通过 window.EditorBlocks 导出。
   ========================================================= */
"use strict";

(function () {

/* =========================================================
   BLOCK TYPE DEFINITIONS
   ========================================================= */
var DEFS = {
  h1:         { label:'H1',      def:'一级标题' },
  h2:         { label:'H2',      def:'二级标题' },
  h3:         { label:'H3',      def:'三级标题' },
  h4:         { label:'H4',      def:'四级标题' },
  h5:         { label:'H5',      def:'五级标题' },
  p:          { label:'段落',    def:'在此输入段落文字……' },
  blockquote: { label:'引用',    def:'引用内容' },
  ul:         { label:'无序列表', def:'列表项 1\n列表项 2\n列表项 3' },
  ol:         { label:'有序列表', def:'步骤一\n步骤二\n步骤三' },
  abstract:   { label:'摘要',    def:'摘要内容……' },
  authors:    { label:'作者',    def:'王某某¹  李某某²\n¹ 某大学电子信息学院' },
  keywords:   { label:'关键词',  def:'关键词A, 关键词B, 关键词C' },
  infobox:    { label:'信息框',  def:'' },
  eq:         { label:'公式块',  def:'' },
  'eq-inline':{ label:'行内公式',def:'' },
  img:        { label:'图片',    def:'' },
  video:      { label:'视频',    def:'' },
  table:      { label:'表格',    def:'' },
  codeblock:  { label:'代码块',  def:'// 代码' },
  refs:       { label:'参考文献',def:'1. 作者, "标题." 期刊, 年份.' },
  divider:    { label:'分割线',  def:'' },
  raw:        { label:'自定义',  def:'<div>自定义 HTML</div>' },
};

/* =========================================================
   ALIGNMENT BUTTON DEFINITIONS
   ========================================================= */
/* Shared alignment button definitions */
var ALIGN_DEFS = [
  { v:'left',    label:'左对齐',   svg:'<svg viewBox="0 0 12 10" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="0" y1="2" x2="12" y2="2"/><line x1="0" y1="5" x2="8" y2="5"/><line x1="0" y1="8" x2="10" y2="8"/></svg>' },
  { v:'center',  label:'居中',     svg:'<svg viewBox="0 0 12 10" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="0" y1="2" x2="12" y2="2"/><line x1="2" y1="5" x2="10" y2="5"/><line x1="1" y1="8" x2="11" y2="8"/></svg>' },
  { v:'right',   label:'右对齐',   svg:'<svg viewBox="0 0 12 10" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="0" y1="2" x2="12" y2="2"/><line x1="4" y1="5" x2="12" y2="5"/><line x1="2" y1="8" x2="12" y2="8"/></svg>' },
  { v:'justify', label:'两端对齐', svg:'<svg viewBox="0 0 12 10" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="0" y1="2" x2="12" y2="2"/><line x1="0" y1="5" x2="12" y2="5"/><line x1="0" y1="8" x2="12" y2="8"/></svg>' },
];

/* =========================================================
   INSERT SHORTCUT DEFINITIONS
   可自定义的插入块快捷键配置。
   由编辑器核心在初始化时与固定快捷键合并。
   ========================================================= */
var SC_INSERT_DEFS = [
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
];

/* =========================================================
   INSERT PANEL BLOCK TYPE LIST
   树视图"在下方插入"面板中展示的块类型列表。
   ========================================================= */
var _INSERT_BLOCK_TYPES = [
  { t:'h1', l:'H1' },{ t:'h2', l:'H2' },{ t:'h3', l:'H3' },{ t:'h4', l:'H4' },{ t:'h5', l:'H5' },
  { t:'p',  l:'段落' },{ t:'blockquote', l:'引用' },{ t:'ul', l:'无序列表' },{ t:'ol', l:'有序列表' },
  { t:'abstract', l:'摘要' },{ t:'authors', l:'作者' },{ t:'keywords', l:'关键词' },
  { t:'divider', l:'分割线' },{ t:'refs', l:'参考文献' },{ t:'raw', l:'自定义 HTML' }
];

/* =========================================================
   PREVIEW CSS
   嵌入在导出/预览 HTML 文档中的样式表内容。
   ========================================================= */
var PREVIEW_CSS = ':root{\n    --accent:#2644ba;--accent-light:#e8ecf9;--accent-mid:#8fa0dc;\n    --accent-dark:#1a3090;--accent-border:#b8c4ec;\n    --color-background-primary:#ffffff;--color-background-secondary:#f5f5f3;\n    --color-background-tertiary:#eeede9;--color-text-primary:#1a1a18;\n    --color-text-secondary:#5f5e5a;--color-text-tertiary:#888780;\n    --color-border-tertiary:rgba(0,0,0,0.12);--color-border-secondary:rgba(0,0,0,0.22);\n    --font-sans:-apple-system,"Helvetica Neue",Arial,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;\n    --font-mono:"SFMono-Regular",Consolas,"Liberation Mono",Menlo,monospace;\n    --border-radius-md:8px;--border-radius-lg:12px;\n  }\n  *,*::before,*::after{box-sizing:border-box}\n  body{margin:0;background:var(--color-background-primary);color:var(--color-text-primary);font-family:var(--font-sans);-webkit-font-smoothing:antialiased}\n  .ar{max-width:100%;margin:0;padding:2rem 2rem 4rem;line-height:1.8}\n  .ar h1{font-size:1.85rem;font-weight:700;margin:0 0 .5rem;letter-spacing:-.02em}\n  .ar h2{font-size:1.25rem;font-weight:700;margin:2.8rem 0 .6rem;color:var(--accent)}\n  .ar h3{font-size:1.05rem;font-weight:600;margin:1.8rem 0 .4rem}\n  .ar h4{font-size:.95rem;font-weight:500;margin:1.3rem 0 .3rem;color:var(--color-text-secondary)}\n  .ar h5{font-size:.78rem;font-weight:500;margin:1rem 0 .25rem;color:var(--color-text-tertiary);text-transform:uppercase;letter-spacing:.07em}\n  .ar p{margin:0 0 .9rem;font-size:1rem}\n  .paper-authors{font-size:15px;color:var(--color-text-secondary);margin:.3rem 0 .2rem}\n  .paper-affil{font-size:13px;color:var(--color-text-tertiary);margin:0 0 .5rem}\n  .kw-row{display:flex;gap:6px;flex-wrap:wrap;margin:-.5rem 0 2rem}\n  .kw{font-size:12px;padding:2px 9px;border-radius:4px;background:var(--accent-light);color:var(--accent-dark);font-weight:500}\n  .ar a{color:var(--accent);text-decoration:none;border-bottom:1px solid var(--accent-border)}\n  .ar a:hover{border-bottom-color:var(--accent)}\n  .ar blockquote{margin:1.5rem 0;padding:1rem 1.25rem;border-left:3px solid var(--accent);background:var(--accent-light);border-radius:0 var(--border-radius-md) var(--border-radius-md) 0;color:var(--accent-dark);font-style:italic}\n  .ar blockquote p{margin:0}\n  .ar code{font-family:var(--font-mono);font-size:.875em;background:var(--accent-light);border:.5px solid var(--accent-border);border-radius:4px;padding:1px 5px;color:var(--accent-dark)}\n  .abstract-box{background:var(--accent-light);border:.5px solid var(--accent-border);border-radius:var(--border-radius-md);padding:1.1rem 1.4rem;margin:0 0 2rem}\n  .abstract-box .abs-title{font-size:12px;font-weight:500;text-transform:uppercase;letter-spacing:.07em;color:var(--accent);margin-bottom:8px}\n  .abstract-box p{margin:0;font-size:14px;line-height:1.75;color:var(--accent-dark)}\n  .cbw{margin:1.5rem 0;border-radius:var(--border-radius-md);border:.5px solid var(--color-border-tertiary);overflow:hidden}\n  .ch{display:flex;align-items:center;justify-content:space-between;padding:6px 14px;background:var(--color-background-tertiary);border-bottom:.5px solid var(--color-border-tertiary)}\n  .cl{font-family:var(--font-mono);font-size:12px;color:var(--color-text-tertiary)}\n  .cbw pre{margin:0;padding:1.1rem 1.25rem;background:var(--color-background-secondary);overflow-x:auto}\n  .cbw pre code{background:none;border:none;padding:0;font-size:13px;line-height:1.65;color:var(--color-text-primary)}\n  .tw{margin:1.5rem 0}.tc{font-size:13px;color:var(--color-text-secondary);margin-bottom:6px;text-align:center}\n  .tc span{font-weight:500;color:var(--color-text-primary)}\n  .t-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;border-radius:var(--border-radius-md);border:.5px solid var(--color-border-tertiary)}\n  table.at{width:100%;border-collapse:collapse;font-size:14px;min-width:480px}\n  .at th{background:var(--accent-light);color:var(--accent-dark);font-weight:500;padding:8px 14px;text-align:left;font-size:13px;border-bottom:.5px solid var(--accent-border);white-space:nowrap}\n  .at td{padding:8px 14px;border-bottom:.5px solid var(--color-border-tertiary);white-space:nowrap}\n  .at tr:last-child td{border-bottom:none}\n  .at tr:nth-child(odd) td{background:var(--color-background-primary)}\n  .at tr:nth-child(even) td{background:var(--color-background-secondary)}\n  .at .best{font-weight:500;color:var(--accent)}\n  .af{margin:2rem 0}.af .iw{background:var(--color-background-secondary);border:.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-lg);overflow:hidden;display:flex;flex-direction:column}\n  .af .img-body{display:block;line-height:0}.af .img-body img{display:block;width:100%;height:auto}\n  .af figcaption{border-top:.5px solid var(--color-border-tertiary);background:var(--color-background-tertiary);padding:7px 14px;font-size:13px;color:var(--color-text-secondary);text-align:center}\n  .af figcaption span{font-weight:500;color:var(--color-text-primary)}\n  .eq{font-family:var(--font-mono);font-size:14px;background:var(--color-background-secondary);border:.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-md);padding:.8rem 1.2rem;margin:1rem 0;text-align:center;color:var(--color-text-primary)}\n  .eq-label{float:right;color:var(--color-text-tertiary);font-size:13px}\n  .ib{margin:1.25rem 0;padding:.9rem 1.2rem;border-radius:var(--border-radius-md);font-size:14.5px}\n  .ib .bt{font-weight:500;font-size:12px;text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px}\n  .ib p{margin:0;line-height:1.65}\n  .b-info{background:var(--accent-light);border:.5px solid var(--accent-border)}.b-info .bt,.b-info p{color:var(--accent-dark)}\n  .b-ok{background:#EAF3DE;border:.5px solid #C0DD97}.b-ok .bt,.b-ok p{color:#27500A}\n  .b-warn{background:#FAEEDA;border:.5px solid #FAC775}.b-warn .bt,.b-warn p{color:#633806}\n  .b-err{background:#FCEBEB;border:.5px solid #F7C1C1}.b-err .bt,.b-err p{color:#791F1F}\n  .b-note{background:var(--color-background-secondary);border:.5px solid var(--color-border-tertiary)}\n  .b-note .bt{color:var(--color-text-secondary)}.b-note p{color:var(--color-text-primary)}\n  .vw{margin:2rem 0}.vw .vbox{background:var(--color-background-secondary);border:.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-lg);overflow:hidden}\n  .vw .vbox video,.vw .vbox iframe{display:block;width:100%;aspect-ratio:16/9;border:none;background:#000}\n  .vw figcaption{border-top:.5px solid var(--color-border-tertiary);background:var(--color-background-tertiary);padding:7px 14px;font-size:13px;color:var(--color-text-secondary);text-align:center;border-radius:0 0 var(--border-radius-lg) var(--border-radius-lg)}\n  .vw figcaption span{font-weight:500;color:var(--color-text-primary)}\n  .ar ul,.ar ol{margin:.2rem 0 1rem;padding-left:0;list-style:none}\n  .ar li{position:relative;font-size:1rem;line-height:1.8;padding-left:1.4rem;margin-bottom:.35rem;color:var(--color-text-primary)}\n  .ar ul>li::before{content:\'\';position:absolute;left:0;top:.72em;width:5px;height:5px;border-radius:50%;background:var(--accent)}\n  .ar ol{counter-reset:ol-counter}.ar ol>li{counter-increment:ol-counter}\n  .ar ol>li::before{content:counter(ol-counter) \'.\';position:absolute;left:0;top:0;font-size:.875rem;font-weight:500;color:var(--accent);line-height:1.8}\n  .katex{font-size:1em}.katex-display{margin:0;overflow-x:auto;overflow-y:hidden}\n  .eq .katex-display{display:flex;align-items:center;justify-content:center}\n  .refs ol{padding-left:1.4rem;margin:0}.refs li{font-size:13px;color:var(--color-text-secondary);line-height:1.7;margin-bottom:.5rem}';

/* =========================================================
   BLOCK → HTML  (纯函数，无 DOM 依赖)
   ========================================================= */
function b2html(b) {
  var bid = ' data-bid="'+b.id+'"';
  switch(b.type) {
    case 'h1': case 'h2': case 'h3': case 'h4': case 'h5':
      return '  <'+b.type+bid+'>'+b.content+'</'+b.type+'>';
    case 'p': {
      var pstyle = b.data.align ? ' style="text-align:'+b.data.align+'"' : '';
      return '  <p'+bid+pstyle+'>'+b.content+'</p>';
    }
    case 'blockquote':
      return '  <blockquote'+bid+'>\n    <p>'+b.content+'</p>\n  </blockquote>';
    case 'ul': {
      var items=b.content.split('\n').filter(function(s){return s.trim();}).map(function(s){return '    <li>'+s.trim()+'</li>';}).join('\n');
      return '  <ul'+bid+'>\n'+items+'\n  </ul>';
    }
    case 'ol': {
      var items=b.content.split('\n').filter(function(s){return s.trim();}).map(function(s){return '    <li>'+s.trim()+'</li>';}).join('\n');
      return '  <ol'+bid+'>\n'+items+'\n  </ol>';
    }
    case 'abstract': {
      var absstyle = b.data.align ? ' style="text-align:'+b.data.align+'"' : '';
      return '  <div class="abstract-box"'+bid+'>\n    <div class="abs-title">摘要</div>\n    <p'+absstyle+'>'+b.content+'</p>\n  </div>';
    }
    case 'authors': {
      var lines=b.content.split('\n');
      var a=lines[0]||''; var f=lines[1]||'';
      return '  <p class="paper-authors"'+bid+'>'+a+'</p>'+(f?'\n  <p class="paper-affil">'+f+'</p>':'');
    }
    case 'keywords': {
      var kws=b.content.split(',').map(function(k){return k.trim();}).filter(Boolean);
      return '  <div class="kw-row"'+bid+'>\n'+kws.map(function(k){return '    <span class="kw">'+k+'</span>';}).join('\n')+'\n  </div>';
    }
    case 'infobox': {
      var m={info:'b-info',ok:'b-ok',warn:'b-warn',error:'b-err',note:'b-note'};
      var cls=m[b.data.ibType||'info']||'b-info';
      return '  <div class="ib '+cls+'"'+bid+'>\n    <div class="bt">'+(b.data.ibTitle||'提示')+'</div>\n    <p>'+b.content+'</p>\n  </div>';
    }
    case 'eq': {
      var lbl=b.data.label?' data-eqlabel="'+b.data.label+'"':'';
      return '  <div class="eq"'+bid+lbl+'>\n    $$'+(b.data.raw||'')+'$$\n  </div>';
    }
    case 'eq-inline':
      return '  <p'+bid+'>$'+(b.data.raw||'')+'$</p>';
    case 'img': {
      var d=b.data; var src=d.src||''; var alt=d.alt||''; var cap=d.caption||''; var fn=d.fignum||'';
      return '  <figure class="af"'+bid+'>\n    <div class="iw">\n      <div class="img-body">\n        <img src="'+src+'" alt="'+alt+'" loading="lazy">\n      </div>\n      <figcaption>'+(fn?'<span>'+fn+'</span>：':'')+cap+'</figcaption>\n    </div>\n  </figure>';
    }
    case 'video': {
      var d=b.data; var src=d.src||''; var cap=d.caption||''; var fn=d.fignum||'';
      var media=d.vtype==='iframe'
        ?'      <iframe src="'+src+'" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"></iframe>'
        :'      <video controls>\n        <source src="'+src+'" type="video/mp4">\n        您的浏览器不支持 video 标签。\n      </video>';
      return '  <figure class="vw"'+bid+'>\n    <div class="vbox">\n'+media+'\n    </div>\n    <figcaption>'+(fn?'<span>'+fn+'</span>：':'')+cap+'</figcaption>\n  </figure>';
    }
    case 'table': {
      var d=b.data; var h=d.headers||[]; var r=d.rows||[]; var cap=d.caption||''; var tn=d.tablenum||'';
      var s='  <div class="tw"'+bid+'>\n';
      if(cap) s+='    <p class="tc">'+(tn?'<span>'+tn+'</span>：':'')+cap+'</p>\n';
      s+='    <div class="t-scroll">\n    <table class="at">\n      <thead>\n        <tr>'+h.map(function(hh){return'<th>'+hh+'</th>';}).join('')+'</tr>\n      </thead>\n      <tbody>\n';
      r.forEach(function(row){ s+='        <tr>'+h.map(function(_,i){return'<td>'+(row[i]||'')+'</td>';}).join('')+'</tr>\n'; });
      s+='      </tbody>\n    </table>\n    </div>\n  </div>';
      return s;
    }
    case 'codeblock':
      return '  <div class="cbw"'+bid+'>\n    <div class="ch"><span class="cl">'+(b.data.lang||'code')+'</span></div>\n    <pre><code>'+b.content+'</code></pre>\n  </div>';
    case 'refs': {
      var items=b.content.split('\n').filter(function(s){return s.trim();}).map(function(s){return'      <li>'+s.trim()+'</li>';}).join('\n');
      return '  <div class="refs"'+bid+'>\n    <h2>参考文献</h2>\n    <ol>\n'+items+'\n    </ol>\n  </div>';
    }
    case 'divider':
      return '  <hr'+bid+' style="border:none;border-top:0.5px solid var(--color-border-tertiary);margin:2rem 0;">';
    case 'raw': {
      var rh = (b.data.html || '<div></div>').trim();
      // inject data-bid into the first opening tag
      return '  ' + rh.replace(/(<[a-zA-Z][a-zA-Z0-9]*)(\s|\/?>)/, '$1 data-bid="'+b.id+'"$2');
    }
    default:
      return '  <!-- '+b.type+' -->';
  }
}

/* =========================================================
   WRAP HTML  (生成完整的预览 HTML 文档)
   ========================================================= */
function wrapHTML(body) {
  return '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>论文</title>\n<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">\n<style>\n  ' + PREVIEW_CSS + '\n</style>\n</head>\n<body>\n<div class="ar">\n\n' + body + '\n\n</div>\n<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"><\\/script>\n<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js"\n  onload="renderMathInElement(document.body,{delimiters:[{left:\'$$\',right:\'$$\',display:true},{left:\'$\',right:\'$\',display:false}],throwOnError:false});document.querySelectorAll(\'.eq[data-eqlabel]\').forEach(function(el){if(el.querySelector(\'.eq-label\'))return;var s=document.createElement(\'span\');s.className=\'eq-label\';s.textContent=el.getAttribute(\'data-eqlabel\');el.insertBefore(s,el.firstChild);});"><\\/script>\n<script>document.addEventListener(\"click\",function(e){var n=e.target;while(n&&n!==document.body){if(n.hasAttribute&&n.hasAttribute(\"data-bid\")){try{parent.__pvBidClick(n.getAttribute(\"data-bid\"));}catch(x){}return;}n=n.parentElement;}});<\\/script>\n</body>\n</html>';
}

/* =========================================================
   BUILD BLOCK INNER  (构建块在编辑器中的 UI)
   api 对象包含：
     makeBE, makeRichBE, mkDiv   — 来自编辑器核心的 DOM 工具
     ALIGN_DEFS                  — 对齐按钮定义
     syncCode, schedPv           — 状态更新回调
     openImgDialog, openVideoDialog, openEqDialog,
     openInfoboxDialog, openTableDialog
   ========================================================= */
function buildBlockInner(inner, b, api) {
  inner.innerHTML = '';

  function addEditBtn(label, fn) {
    var btn = document.createElement('button');
    btn.className = 'edit-btn'; btn.textContent = '✏ ' + label;
    btn.addEventListener('click', function(e){ e.stopPropagation(); fn(b); });
    inner.appendChild(btn);
  }

  function addBE(content, placeholder, onChange) {
    var d = api.makeBE(content, placeholder);
    inner.appendChild(d);
    d.addEventListener('input', function() { onChange(d.innerText); api.syncCode(); api.schedPv(); });
    return d;
  }

  function addRichBE(content, placeholder, onChange) {
    var d = api.makeRichBE(content, placeholder);
    inner.appendChild(d);
    d.addEventListener('input', function() { onChange(d.innerHTML); api.syncCode(); api.schedPv(); });
    return d;
  }

  function addAlignRow(b) {
    var row = api.mkDiv('align-row');
    api.ALIGN_DEFS.forEach(function(a) {
      var btn = document.createElement('button');
      btn.className = 'abtn' + (b.data.align === a.v ? ' on' : '');
      btn.innerHTML = a.svg + a.label;
      btn.title = a.label;
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        b.data.align = (b.data.align === a.v) ? '' : a.v;
        row.querySelectorAll('.abtn').forEach(function(ab){ ab.classList.remove('on'); });
        if (b.data.align) btn.classList.add('on');
        api.syncCode(); api.schedPv();
      });
      row.appendChild(btn);
    });
    inner.appendChild(row);
  }

  switch (b.type) {
    case 'h1': case 'h2': case 'h3': case 'h4': case 'h5':
      addBE(b.content, '输入标题…', function(v){ b.content=v; });
      break;

    case 'p': {
      addRichBE(b.content, '输入段落文字…', function(v){ b.content=v; });
      addAlignRow(b);
      break;
    }

    case 'blockquote': {
      var wrap = api.mkDiv('bqx'); inner.appendChild(wrap);
      var d = api.makeRichBE(b.content, '引用文字…');
      wrap.appendChild(d);
      d.addEventListener('input', function(){ b.content=d.innerHTML; api.syncCode(); api.schedPv(); });
      break;
    }
    case 'ul': case 'ol': {
      var lbl = api.mkDiv(); lbl.style.cssText='font-size:10px;color:var(--t2);margin-bottom:4px';
      lbl.textContent = b.type==='ul' ? '无序列表（每行一项）' : '有序列表（每行一项）';
      inner.appendChild(lbl);
      addBE(b.content, '列表项…', function(v){ b.content=v; });
      break;
    }
    case 'abstract': {
      var wrap = api.mkDiv('abx'); inner.appendChild(wrap);
      var tit = api.mkDiv('abxtit'); tit.textContent='Abstract / 摘要'; wrap.appendChild(tit);
      var d = api.makeRichBE(b.content, '摘要内容…');
      wrap.appendChild(d);
      d.addEventListener('input', function(){ b.content=d.innerHTML; api.syncCode(); api.schedPv(); });
      addAlignRow(b);
      break;
    }
    case 'authors': {
      var lbl = api.mkDiv(); lbl.style.cssText='font-size:10px;color:var(--t2);margin-bottom:4px';
      lbl.textContent='作者 · 机构（换行分隔）'; inner.appendChild(lbl);
      addBE(b.content, '作者信息…', function(v){ b.content=v; });
      break;
    }
    case 'keywords': {
      var lbl = api.mkDiv(); lbl.style.cssText='font-size:10px;color:var(--t2);margin-bottom:4px';
      lbl.textContent='关键词（逗号分隔）'; inner.appendChild(lbl);
      addBE(b.content, '关键词A, 关键词B…', function(v){ b.content=v; });
      break;
    }
    case 'infobox': {
      var colors = {
        info:  {bg:'var(--acl)', bd:'var(--acb)', tc:'var(--acd)'},
        ok:    {bg:'#EAF3DE',   bd:'#C0DD97',    tc:'#27500A'},
        warn:  {bg:'#FAEEDA',   bd:'#FAC775',    tc:'#633806'},
        error: {bg:'#FCEBEB',   bd:'#F7C1C1',    tc:'#791F1F'},
        note:  {bg:'var(--bg1)',bd:'var(--bm)',   tc:'var(--t0)'},
      };
      var c = colors[b.data.ibType||'info'] || colors.info;
      var wrap = api.mkDiv('ibx');
      wrap.style.background=c.bg; wrap.style.border='.5px solid '+c.bd;
      var tit = api.mkDiv('ibxtit'); tit.style.color=c.tc;
      tit.textContent = b.data.ibTitle || '提示'; wrap.appendChild(tit);
      var d = api.makeRichBE(b.content, '内容…'); d.style.color=c.tc; wrap.appendChild(d);
      inner.appendChild(wrap);
      d.addEventListener('input', function(){ b.content=d.innerHTML; api.syncCode(); api.schedPv(); });
      addEditBtn('修改信息框', api.openInfoboxDialog);
      break;
    }
    case 'eq': {
      var wrap = api.mkDiv('eqx'); inner.appendChild(wrap);
      var lbl = document.createElement('span'); lbl.className='eqlbl';
      lbl.textContent = '公式块'+(b.data.label?' · '+b.data.label:''); wrap.appendChild(lbl);
      var raw = api.mkDiv('eqraw'); raw.textContent = b.data.raw||'(空公式)'; wrap.appendChild(raw);
      addEditBtn('编辑公式', function(bl){ api.openEqDialog('block', bl); });
      break;
    }
    case 'eq-inline': {
      var lbl = api.mkDiv(); lbl.style.cssText='font-size:10px;color:var(--t2);margin-bottom:4px';
      lbl.textContent='行内公式'; inner.appendChild(lbl);
      var sp = document.createElement('span'); sp.className='iqx';
      sp.textContent = b.data.raw||'(空)'; inner.appendChild(sp);
      addEditBtn('编辑', function(bl){ api.openEqDialog('inline', bl); });
      break;
    }
    case 'img': {
      var wrap = api.mkDiv('imgx'); inner.appendChild(wrap);
      var ph = api.mkDiv('imgph');
      ph.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
      var nm = document.createElement('span');
      nm.textContent = b.data.src ? b.data.src.substring(0,44) : '未设置图片 URL';
      ph.appendChild(nm); wrap.appendChild(ph);
      var cap = api.mkDiv('imgcap'); cap.textContent = b.data.caption||'图片标题'; wrap.appendChild(cap);
      addEditBtn('编辑图片', api.openImgDialog);
      break;
    }
    case 'video': {
      var wrap = api.mkDiv('vidx'); inner.appendChild(wrap);
      var ph = api.mkDiv('vidph');
      ph.innerHTML='<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>';
      var nm = document.createElement('span');
      nm.textContent = b.data.src ? b.data.src.substring(0,44) : '未设置视频 URL';
      ph.appendChild(nm); wrap.appendChild(ph);
      var cap = api.mkDiv('vidcap'); cap.textContent = b.data.caption||'视频标题'; wrap.appendChild(cap);
      addEditBtn('编辑视频', api.openVideoDialog);
      break;
    }
    case 'table': {
      var lbl = api.mkDiv('tblcap');
      var h = b.data.headers || []; var r = b.data.rows || [];
      lbl.textContent = (b.data.caption||'表格') + (h.length ? ' · '+h.length+'列 × '+r.length+'行' : '');
      inner.appendChild(lbl);
      if (h.length) {
        var tblx = api.mkDiv('tblx'); inner.appendChild(tblx);
        var tbl = document.createElement('table');
        var thead = document.createElement('thead');
        var hr = document.createElement('tr');
        h.forEach(function(hh){ var th=document.createElement('th'); th.textContent=hh; hr.appendChild(th); });
        thead.appendChild(hr); tbl.appendChild(thead);
        var tbody = document.createElement('tbody');
        r.forEach(function(row){
          var tr=document.createElement('tr');
          h.forEach(function(_,ci){ var td=document.createElement('td'); td.textContent=row[ci]||''; tr.appendChild(td); });
          tbody.appendChild(tr);
        });
        tbl.appendChild(tbody); tblx.appendChild(tbl);
      }
      addEditBtn('编辑表格', api.openTableDialog);
      break;
    }
    case 'codeblock': {
      var wrap = api.mkDiv('cbx'); inner.appendChild(wrap);
      var hdr = api.mkDiv('cbxh');
      var langSpan = document.createElement('span'); langSpan.textContent=b.data.lang||'code'; hdr.appendChild(langSpan);
      wrap.appendChild(hdr);
      var d = api.makeBE(b.content, '// 输入代码…');
      d.style.fontFamily='var(--fm)'; d.style.fontSize='11px';
      d.style.background='var(--bg1)'; d.style.padding='7px 9px'; d.style.lineHeight='1.6';
      wrap.appendChild(d);
      d.addEventListener('input', function(){ b.content=d.innerText; api.syncCode(); api.schedPv(); });
      break;
    }
    case 'refs': {
      var lbl = api.mkDiv(); lbl.style.cssText='font-size:10px;font-weight:600;color:var(--t1);margin-bottom:5px;text-transform:uppercase;letter-spacing:.04em';
      lbl.textContent='参考文献（每行一条）'; inner.appendChild(lbl);
      var d = api.makeBE(b.content, '1. 作者, 标题, 年份.');
      d.style.fontSize='12px'; d.style.color='var(--t1)'; inner.appendChild(d);
      d.addEventListener('input', function(){ b.content=d.innerText; api.syncCode(); api.schedPv(); });
      break;
    }
    case 'divider': {
      var wrap = api.mkDiv(); wrap.style.cssText='display:flex;align-items:center;padding:4px 0;pointer-events:none';
      wrap.innerHTML='<div style="flex:1;height:1px;background:var(--bm)"></div><span style="font-size:10px;color:var(--t2);padding:0 8px">分割线</span><div style="flex:1;height:1px;background:var(--bm)"></div>';
      inner.appendChild(wrap);
      break;
    }
    case 'raw': {
      var rawWrap = api.mkDiv('cbx'); inner.appendChild(rawWrap);
      var rawHd = api.mkDiv('cbxh');
      rawHd.innerHTML = '<span style="color:var(--ac);font-size:10px">自定义 HTML</span>';
      rawWrap.appendChild(rawHd);
      var rawPre = api.mkDiv('be');
      rawPre.style.cssText = 'font-family:var(--fm);font-size:10px;padding:6px 9px;overflow:auto;white-space:pre;max-height:80px;color:var(--t1);line-height:1.5';
      rawPre.textContent = (b.data.html || '<div></div>').substring(0, 300);
      rawWrap.appendChild(rawPre);
      break;
    }
    default: {
      addBE(b.content, '', function(v){ b.content=v; });
    }
  }
}

/* =========================================================
   EXPORT
   ========================================================= */
window.EditorBlocks = {
  DEFS:               DEFS,
  ALIGN_DEFS:         ALIGN_DEFS,
  SC_INSERT_DEFS:     SC_INSERT_DEFS,
  INSERT_BLOCK_TYPES: _INSERT_BLOCK_TYPES,
  PREVIEW_CSS:        PREVIEW_CSS,
  b2html:             b2html,
  wrapHTML:           wrapHTML,
  buildBlockInner:    buildBlockInner,
};

})();
