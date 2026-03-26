/**
 * abstract/index.js — Abstract component entry point.
 *
 * This is the single import target for the abstract block module.
 * It aggregates:
 *   - Model registration
 *   - Paste handler wiring (inline paste event registration)
 *   - Editor-side CSS injection
 */

import { injectComponentCSS } from '../../core/schemaRegistry.js';
import './abstract.model.js';
import './abstract.paste.js';   // registers on('inlinePaste:abstract', …)

const _css = `
/* ── Abstract component (editor styles) ── */
.abx{background:var(--acl);border:.5px solid var(--acb);border-radius:var(--r8);padding:8px 12px}
.abxtit{font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:.07em;color:var(--ac);margin-bottom:5px}
.abx .be{font-size:12px;color:var(--acd)}
`;
injectComponentCSS('abstract', _css);
