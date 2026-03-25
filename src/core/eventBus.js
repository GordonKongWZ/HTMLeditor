/**
 * eventBus.js — Lightweight pub/sub event bus for cross-module communication.
 *
 * Usage:
 *   import { on, emit } from './eventBus.js';
 *   on('blockSelected', (id) => { ... });
 *   emit('blockSelected', id);
 */

const _handlers = {};

/**
 * Subscribe to an event.
 * @param {string} event
 * @param {Function} handler
 * @returns {Function} unsubscribe function
 */
export function on(event, handler) {
  if (!_handlers[event]) _handlers[event] = [];
  _handlers[event].push(handler);
  return () => off(event, handler);
}

/**
 * Unsubscribe a handler from an event.
 * @param {string} event
 * @param {Function} handler
 */
export function off(event, handler) {
  if (!_handlers[event]) return;
  _handlers[event] = _handlers[event].filter(h => h !== handler);
}

/**
 * Emit an event, calling all registered handlers.
 * @param {string} event
 * @param {...*} args
 */
export function emit(event, ...args) {
  (_handlers[event] || []).forEach(h => h(...args));
}
