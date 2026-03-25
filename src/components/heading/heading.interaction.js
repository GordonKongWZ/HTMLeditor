/**
 * heading.interaction.js — Heading keyboard / edit behavior.
 *
 * Enter: blur (heading stays on one line; new paragraph below is inserted
 *        via the Insert shortcut or toolbar).
 * Shift+Enter: same as Enter for headings (no line break).
 */

/**
 * Attach heading interaction handlers to a contentEditable element.
 * @param {HTMLElement} el — the .be element inside the heading block
 */
export function attachHeadingInteraction(el) {
  el.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      el.blur();
    }
  });
}
