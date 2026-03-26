/**
 * paragraph/index.js — Paragraph component entry point.
 *
 * This is the single import target for the paragraph block module.
 * It aggregates:
 *   - Model registration (type contract, toHTML, fromHTML, …)
 *   - Paste handler wiring (inline paste event registration)
 *   - Editor-side CSS injection
 *
 * To load the paragraph module, import this file.
 * To unload it at runtime, call moduleManager.removeModule('p').
 */

import { injectComponentCSS } from '../../core/schemaRegistry.js';
import './paragraph.model.js';
import './paragraph.paste.js';   // registers on('inlinePaste:p', …)

// Paragraph uses the base .be / .rich-be styles from editor.css.
// Component-specific CSS is minimal; kept here for future extension.
const _css = `
/* ── Paragraph component (editor styles) ── */
/* Base styles are in editor.css (.be, .rich-be).
   Alignment is applied via inline style (text-align).
   Add paragraph-specific overrides below as the component evolves. */
`;
injectComponentCSS('p', _css);
