/**
 * heading.paste.js — Heading paste rules.
 *
 * When content is pasted into a heading, strip block structure and
 * keep only the plain text of the first "paragraph".
 */

/**
 * Transform a pasted clipboard string for use in a heading.
 * Returns the first non-empty line of plain text.
 * @param {string} text — plain text from clipboard
 * @returns {string}
 */
export function headingPasteFilter(text) {
  if (!text) return '';
  // Keep only the first non-empty line
  var line = (text.split('\n').find(function(l){ return l.trim(); }) || '').trim();
  return line;
}
