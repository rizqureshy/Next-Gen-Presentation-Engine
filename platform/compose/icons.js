/* ============================================================
   icons.js — small built-in icon set for Deck IR cards.
   Single-path, fill-based, 24×24 viewBox (rendered white by
   .card .ic svg). Reference by name in a card's "icon" field.
   ============================================================ */

export const ICONS = {
  star:   "M12 2l2.4 7.4H22l-6 4.4 2.3 7.2L12 16.6 5.7 21l2.3-7.2-6-4.4h7.6z",
  bolt:   "M13 2L4 14h6l-1 8 9-12h-6l1-8z",
  check:  "M9 16.2l-3.5-3.5-1.4 1.4L9 19 20 8l-1.4-1.4z",
  chart:  "M4 22H2V2h2v18h18v2H4zm3-5h2v-7H7v7zm5 0h2V7h-2v10zm5 0h2v-4h-2v4z",
  layers: "M12 3L2 9l10 6 10-6-10-6zm-7.5 8.7L2 13.5l10 6 10-6-2.5-1.8L12 16.2l-7.5-4.5z",
  globe:  "M12 2a10 10 0 100 20 10 10 0 000-20zm7.9 9h-3c-.1-2.2-.6-4.3-1.2-6a8 8 0 014.2 6zM12 4.1c.9 1.2 2 3.6 2.2 6.9H9.8C10 7.7 11.1 5.3 12 4.1zM4.1 13h3c.1 2.2.6 4.3 1.2 6a8 8 0 01-4.2-6zm3-2h-3a8 8 0 014.2-6c-.6 1.7-1.1 3.8-1.2 6zm4.9 8.9c-.9-1.2-2-3.6-2.2-6.9h4.4c-.2 3.3-1.3 5.7-2.2 6.9zm3.7-.9c.6-1.7 1.1-3.8 1.2-6h3a8 8 0 01-4.2 6z",
  shield: "M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5l8-3z",
  growth: "M6 6h9v2H9.4l9.3 9.3-1.4 1.4L8 9.4V15H6V6z",
  users:  "M8 11a4 4 0 110-8 4 4 0 010 8zm8 1a3.5 3.5 0 110-7 3.5 3.5 0 010 7zM2 20c0-3.3 2.7-6 6-6s6 2.7 6 6v1H2v-1zm14 1v-1c0-1.7-.5-3.2-1.4-4.4A5 5 0 0122 20v1h-6z",
  eye:    "M12 5c5 0 9.3 3 11 7-1.7 4-6 7-11 7S2.7 16 1 12c1.7-4 6-7 11-7zm0 3a4 4 0 100 8 4 4 0 000-8z",
  doc:    "M6 2h9l5 5v15H6V2zm8 1.5V8h4.5L14 3.5zM8 12h8v2H8v-2zm0 4h8v2H8v-2z",
  clock:  "M12 2a10 10 0 100 20 10 10 0 000-20zm1 5h-2v6l4.5 2.7 1-1.7-3.5-2V7z",
};

export function iconSvg(name) {
  const d = ICONS[name] || ICONS.star;
  return `<svg viewBox="0 0 24 24"><path d="${d}"/></svg>`;
}
