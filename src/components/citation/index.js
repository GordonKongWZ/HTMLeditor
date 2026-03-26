/**
 * citation/index.js — Citation (blockquote) component entry point.
 *
 * This is the single import target for the citation block module.
 * It aggregates:
 *   - Model registration
 *   - Paste handler wiring (inline paste event registration)
 *   - Editor-side CSS injection
 */

import { injectComponentCSS } from '../../core/schemaRegistry.js';
import './citation.model.js';
import './citation.paste.js';   // registers on('inlinePaste:blockquote', …)

const _css = `
/* ── Citation / Blockquote component (editor styles) ── */
.bqx{border-left:3px solid var(--ac);background:var(--acl);border-radius:0 var(--r8) var(--r8) 0;padding:7px 10px}
.bqx .be{font-style:italic;color:var(--acd);font-size:13px}
`;
injectComponentCSS('blockquote', _css);
