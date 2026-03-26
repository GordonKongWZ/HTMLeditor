/**
 * image/index.js — Image component entry point.
 *
 * This is the single import target for the image block module.
 * It aggregates:
 *   - Model registration
 *   - Editor-side CSS injection
 *
 * Images are atomic blocks (no inline editing); no paste wiring is needed.
 */

import { injectComponentCSS } from '../../core/schemaRegistry.js';
import './image.model.js';

const _css = `
/* ── Image component (editor styles) ── */
.imgx{background:var(--bg1);border:.5px solid var(--bm);border-radius:var(--r12);overflow:hidden}
.imgph{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;padding:14px;color:var(--t2);font-size:11px}
.imgph svg{width:24px;height:24px;opacity:.4}
.imgcap{border-top:.5px solid var(--bm);background:var(--bg2);padding:4px 10px;font-size:11px;text-align:center;color:var(--t1)}
`;
injectComponentCSS('img', _css);
