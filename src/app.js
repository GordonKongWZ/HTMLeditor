/**
 * app.js — Application entry point.
 *
 * Import order matters:
 *  1. Core modules (no DOM dependencies)
 *  2. Component registrations (register into schemaRegistry)
 *  3. UI modules (wire DOM)
 *  4. Sample content (pre-populate on first load)
 */

/* ── Core ── */
import './core/eventBus.js';
import './core/schemaRegistry.js';
import './core/editor.js';
import './core/selection.js';
import './core/history.js';
import './core/commandManager.js';
import './core/pastePipeline.js';

/* ── Component registrations ── */
import './components/heading/heading.model.js';
import './components/paragraph/paragraph.model.js';
import './components/citation/citation.model.js';
import './components/abstract/abstract.model.js';
import './components/separator/separator.model.js';
import './components/image/image.model.js';

/* ── UI modules ── */
import { initToolbar }     from './ui/toolbar.js';
import { initContextMenu } from './ui/contextMenu.js';
import { initShortcuts }   from './ui/shortcuts.js';

/* ── App-level imports for insertBlock / doPv ── */
import { insertBlock, applyCodeToBlocks } from './core/commandManager.js';
import { doPv }  from './core/editor.js';

/* =========================================================
   BOOTSTRAP — wait for DOM before wiring UI
   ========================================================= */
document.addEventListener('DOMContentLoaded', function () {
  initToolbar();
  initContextMenu();
  initShortcuts();

  // Initial preview render
  doPv();
});

/* =========================================================
   SAMPLE CONTENT — pre-populate editor on first page load
   ========================================================= */
window.addEventListener('load', function () {
  insertBlock('h1',       { content: '基于轻量卷积神经网络的车牌角点定位方法' });
  insertBlock('authors',  { content: '王某某¹  李某某²\n¹ 某大学电子信息学院  · ² 某研究院智能感知实验室' });
  insertBlock('abstract', { content: '本文提出一种面向 FPGA 部署的轻量卷积神经网络，用于新能源车牌角点坐标定位。在 CCPD 数据集上实现了 3.4 px 平均关键点误差，INT8 量化后参数量约 52 KB。' });
  insertBlock('keywords', { content: '车牌角点定位, 轻量 CNN, FPGA 部署, INT8 量化' });
  insertBlock('h2',       { content: '1. 引言' });
  insertBlock('p',        { content: '车牌识别（LPR）是智能交通系统的核心感知任务。' });
  insertBlock('h2',       { content: '2. 方法' });
  insertBlock('p',        { content: '本节介绍所提网络结构与训练策略。' });
  insertBlock('divider',  {});
  insertBlock('refs',     { content: '1. 作者A, "标题A." 期刊X, 2023.\n2. 作者B, "标题B." 期刊Y, 2022.' });
});
