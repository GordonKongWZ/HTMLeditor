/**
 * moduleManager.js — Block module lifecycle management.
 *
 * Provides a programmatic API for inspecting, exporting, and removing
 * loaded block component modules at runtime.
 *
 * Future extension point: importModuleFromJSON() / importModuleFromURL()
 * for dynamic module loading without a page reload.
 *
 * API:
 *   getLoadedModules() : ModuleInfo[]
 *   exportModule(type) : Object | null      (JSON-serialisable metadata)
 *   removeModule(type) : void
 */

import { getAllComponents, unregisterComponent, removeComponentCSS } from './schemaRegistry.js';

/**
 * @typedef {Object} ModuleInfo
 * @property {string}  type            — block type identifier
 * @property {string}  label           — human-readable display label
 * @property {string}  cssClass        — CSS class suffix
 * @property {boolean} hasInlinePaste  — component owns inline paste handling
 * @property {boolean} hasGlobalPaste  — component provides global paste parser
 * @property {boolean} builtin         — marked as a built-in (non-removable) module
 */

/**
 * Return metadata for all currently registered block modules.
 * @returns {ModuleInfo[]}
 */
export function getLoadedModules() {
  return getAllComponents().map(function(c) {
    return {
      type:           c.type,
      label:          c.label,
      cssClass:       c.cssClass || '',
      hasInlinePaste: typeof c.inlinePaste === 'function',
      hasGlobalPaste: typeof c.globalPasteParser === 'function',
      builtin:        !!c._builtin,
    };
  });
}

/**
 * Export a component's metadata as a JSON-serialisable object.
 * Note: functions (match, normalize, toHTML, fromHTML, …) are NOT exported —
 * the export is metadata-only (for display / bookkeeping).
 * A full code-level export would require bundling the module's JS source.
 * @param {string} type
 * @returns {Object|null}
 */
export function exportModule(type) {
  var all = getAllComponents();
  var c = all.find(function(x) { return x.type === type; });
  if (!c) return null;
  return {
    type:        c.type,
    label:       c.label,
    cssClass:    c.cssClass  || '',
    def:         c.def       || '',
    _exportedAt: new Date().toISOString(),
  };
}

/**
 * Remove (unregister) a loaded block module.
 * This unregisters the descriptor from schemaRegistry and removes the
 * component's injected <style> tag from the document.
 * Existing blocks of this type already rendered in the editor are not removed.
 * @param {string} type
 */
export function removeModule(type) {
  removeComponentCSS(type);
  unregisterComponent(type);
}
