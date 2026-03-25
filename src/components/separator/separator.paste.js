/**
 * separator.paste.js — Separator paste rules.
 * Separators are atomic; no paste is accepted.
 */

export function separatorPasteFilter(_text) {
  return ''; // Never paste into a separator
}
