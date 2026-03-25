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
 * }
 *
 * Extension point: call registerComponent() from each component module.
 */

/** @type {Map<string, Object>} type → component descriptor */
const _registry = new Map();

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
