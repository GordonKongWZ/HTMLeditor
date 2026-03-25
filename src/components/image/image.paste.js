/**
 * image.paste.js — Image paste rules.
 *
 * Image blocks are atomic and do not accept pasted content.
 * Extension point: detect pasted image data URLs and create image blocks.
 */

/**
 * Attempt to extract an image src from clipboard data.
 * Returns an image block data object if a data URL or image URL is detected.
 * Returns null if nothing image-like is found.
 * @param {DataTransfer} clipboardData
 * @returns {{ src: string }|null}
 */
export function imagePasteDetect(clipboardData) {
  if (!clipboardData) return null;
  // Extension point: check clipboardData.files for image files
  for (var i = 0; i < (clipboardData.files || []).length; i++) {
    var file = clipboardData.files[i];
    if (file.type.startsWith('image/')) {
      // Return a data URL after reading — caller must handle the async FileReader
      return { file: file };
    }
  }
  return null;
}
