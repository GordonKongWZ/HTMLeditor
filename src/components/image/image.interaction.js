/**
 * image.interaction.js — Image keyboard / focus behavior.
 *
 * Images are atomic non-editable blocks managed through the dialog.
 * Extension point: add drag-to-resize, caption inline editing, etc.
 */

/**
 * Attach image block interaction handlers.
 * Currently a no-op; image editing is done via the dialog.
 * @param {HTMLElement} _blockEl — the .bi-img block wrapper element
 */
export function attachImageInteraction(_blockEl) {
  // No-op: image content is edited via the image dialog.
  // Extension point: attach drag-resize handles, inline caption editing, etc.
}
