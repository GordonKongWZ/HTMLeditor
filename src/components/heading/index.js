/**
 * heading/index.js — Heading component entry point (h1–h5).
 *
 * This is the single import target for the heading block module.
 * It aggregates:
 *   - Model registration for h1–h5
 *   - Editor-side CSS injection
 *
 * Headings use a plain contentEditable element (makeBE) which does not
 * fire custom paste events; no paste.js wiring is needed.
 */

import { injectComponentCSS } from '../../core/schemaRegistry.js';
import './heading.model.js';

const _css = `
/* ── Heading component (editor styles) ── */
.bi-h1 .be{font-size:1.15rem;font-weight:700}
.bi-h2 .be{font-size:1rem;font-weight:700;color:var(--ac)}
.bi-h3 .be{font-size:.95rem;font-weight:600}
.bi-h4 .be{font-size:.88rem;font-weight:500;color:var(--t1)}
.bi-h5 .be{font-size:.78rem;font-weight:500;text-transform:uppercase;letter-spacing:.06em;color:var(--t2)}
`;
injectComponentCSS('heading', _css);
