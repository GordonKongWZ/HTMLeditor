/**
 * schemaRegistry.js — Central component registry.
 *
 * Each component module exports an object implementing the component contract:
 * {
 *   type       : string           — block type identifier ('h1', 'p', 'abstract', …)
 *   label      : string           — human-readable display label
 *   cssClass   : string           — CSS class suffix appended to '.bi-{type}'
 *   def        : string           — default content string
 *   match(el)  : bool             — whether a DOM element belongs to this component
 *   normalize(b, ctx) : void      — repair/validate a block object in-place
 *   toHTML(b)  : string           — serialize block → HTML string
 *   fromHTML(el, mkBlock) : block|null  — parse DOM element → block object
 *   onPaste(fragment, ctx) : block[]|null  — transform pasted content (null = skip)
 *   onKeyDown(event, ctx) : bool  — handle keydown; return true if consumed
 *   inlinePaste(e, el, b) : void  — [optional] inline paste handler, set by paste.js
 *   globalPasteParser(html, text) : block[]|null  — [optional] global paste parser,
 *                                    set by paste.js; used by paste dialog type selector
 *   _builtin   : bool             — [optional] flag: built-in modules cannot be removed
 * }
 *
 * Extension point: call registerComponent() from each component module.
 */

/** @type {Map<string, Object>} type → component descriptor */
const _registry = new Map();

/** @type {Map<string, HTMLStyleElement>} type → injected <style> element */
const _cssElements = new Map();

/**
 * Register a component descriptor.
 * @param {Object} descriptor — must have at minimum `type` and `label`
 */
export function registerComponent(descriptor) {
  if (!descriptor || !descriptor.type) {
    console.warn('[schemaRegistry] registerComponent: descriptor missing `type`', descriptor);
    return;
  }
  _registry.set(descriptor.type, descriptor);
}

/**
 * Unregister a component descriptor by type.
 * Also removes any injected CSS for this component.
 * @param {string} type
 */
export function unregisterComponent(type) {
  _registry.delete(type);
  removeComponentCSS(type);
}

/**
 * Check whether a component type is registered.
 * @param {string} type
 * @returns {boolean}
 */
export function hasComponent(type) {
  return _registry.has(type);
}

/**
 * Inject a <style> tag for a component into document.head.
 * Idempotent: calling again with the same type has no effect.
 * @param {string} type
 * @param {string} cssText
 */
export function injectComponentCSS(type, cssText) {
  if (!cssText || !cssText.trim()) return;
  if (_cssElements.has(type)) return; // already injected
  var el = document.createElement('style');
  el.setAttribute('data-component-css', type);
  el.textContent = cssText;
  document.head.appendChild(el);
  _cssElements.set(type, el);
}

/**
 * Remove the injected <style> tag for a component.
 * @param {string} type
 */
export function removeComponentCSS(type) {
  var el = _cssElements.get(type);
  if (el && el.parentNode) el.parentNode.removeChild(el);
  _cssElements.delete(type);
}


/**
 * Get a registered component descriptor by type.
 * @param {string} type
 * @returns {Object|undefined}
 */
export function getComponent(type) {
  return _registry.get(type);
}

/**
 * Return all registered component types.
 * @returns {string[]}
 */
export function getAllTypes() {
  return Array.from(_registry.keys());
}

/**
 * Return all registered component descriptors.
 * @returns {Object[]}
 */
export function getAllComponents() {
  return Array.from(_registry.values());
}

/**
 * Find the first component whose match() returns true for a given DOM element.
 * @param {Element} el
 * @returns {Object|undefined}
 */
export function matchComponent(el) {
  for (const comp of _registry.values()) {
    if (typeof comp.match === 'function' && comp.match(el)) return comp;
  }
  return undefined;
}
