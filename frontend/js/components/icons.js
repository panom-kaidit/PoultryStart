// Inline stroke icons from the approved mockups, built as SVG elements (never from HTML strings).
const SVG_NS = 'http://www.w3.org/2000/svg';

const PHONE = 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z';
const EGG = 'M12 2.5c-3.8 0-7 6.6-7 11A7 7 0 0 0 12 20.5a7 7 0 0 0 7-7c0-4.4-3.2-11-7-11z';

// name -> { style: 'stroke' | 'fill', width, parts: [[tag, attributes], ...] }
const ICONS = {
  home: { width: 2, parts: [['path', { d: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' }]] },
  egg: { width: 2, parts: [['path', { d: EGG }]] },
  eggFilled: { style: 'fill', parts: [['path', { d: EGG }]] },
  plus: { width: 2.6, parts: [['path', { d: 'M12 5v14M5 12h14' }]] },
  minus: { width: 2.2, parts: [['path', { d: 'M5 12h14' }]] },
  book: { width: 2, parts: [['path', { d: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z' }], ['path', { d: 'M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5' }]] },
  more: { style: 'fill', parts: [['circle', { cx: 5, cy: 12, r: 2 }], ['circle', { cx: 12, cy: 12, r: 2 }], ['circle', { cx: 19, cy: 12, r: 2 }]] },
  chevronDown: { width: 2.2, parts: [['path', { d: 'M6 9l6 6 6-6' }]] },
  chevronLeft: { width: 2.2, parts: [['path', { d: 'M15 18l-6-6 6-6' }]] },
  chevronRight: { width: 2.2, parts: [['path', { d: 'M9 6l6 6-6 6' }]] },
  check: { width: 3, parts: [['path', { d: 'M5 12l5 5L20 7' }]] },
  warning: { width: 2.2, parts: [['path', { d: 'M12 3l10 18H2z' }], ['path', { d: 'M12 10v5M12 18h.01' }]] },
  trend: { width: 2.2, parts: [['path', { d: 'M3 17l6-6 4 4 8-8' }], ['path', { d: 'M14 7h7v7', transform: 'rotate(90 17.5 10.5)' }]] },
  phone: { width: 2.2, parts: [['path', { d: PHONE }]] },
  thermometer: { width: 2.2, parts: [['path', { d: 'M14 14.8V4a2 2 0 0 0-4 0v10.8a4 4 0 1 0 4 0z' }]] },
  house: { width: 2.2, parts: [['path', { d: 'M3 11l9-7 9 7v9H3z' }]] },
  money: { width: 2.2, parts: [['rect', { x: 3, y: 6, width: 18, height: 13, rx: 2 }], ['path', { d: 'M3 10h18' }]] },
  chart: { width: 2.2, parts: [['path', { d: 'M4 20V10M10 20V4M16 20v-7M22 20H2' }]] },
  people: { width: 2.2, parts: [['circle', { cx: 9, cy: 8, r: 3.5 }], ['path', { d: 'M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18.5 20a6.5 6.5 0 0 0-2-4.7' }]] },
  search: { width: 2.2, parts: [['circle', { cx: 11, cy: 11, r: 7 }], ['path', { d: 'M20 20l-4-4' }]] },
  share: { width: 2.2, parts: [['path', { d: 'M4 12v8h16v-8M12 3v12M7 8l5-5 5 5' }]] },
  chevronUpDown: { width: 2.2, parts: [['path', { d: 'M8 9l4-4 4 4M8 15l4 4 4-4' }]] },
  sliders: { width: 2.2, parts: [['path', { d: 'M4 6h16M4 12h16M4 18h16' }], ['path', { d: 'M9 4v4M15 10v4M8 16v4' }]] },
  droplet: { width: 2.2, parts: [['path', { d: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z' }]] },
  shield: { width: 2.2, parts: [['path', { d: 'M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z' }]] },
  clock: { width: 2.2, parts: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M12 7v5l3 2' }]] },
  pulse: { width: 2.2, parts: [['path', { d: 'M3 12h4l3-7 4 14 3-7h4' }]] },
  bag: { width: 2.2, parts: [['path', { d: 'M5 9h14l-1 11H6z' }], ['path', { d: 'M9 9V7a3 3 0 0 1 6 0v2' }]] },
  checklist: { width: 2.2, parts: [['rect', { x: 4, y: 4, width: 16, height: 16, rx: 3 }], ['path', { d: 'M8 12l3 3 5-6' }]] },
  print: { width: 2.2, parts: [['path', { d: 'M7 9V4h10v5' }], ['rect', { x: 4, y: 9, width: 16, height: 8, rx: 2 }], ['path', { d: 'M7 14h10v6H7z' }]] },
  download: { width: 2.2, parts: [['path', { d: 'M12 4v11M7 10l5 5 5-5M5 20h14' }]] },
  broiler: { width: 1.8, parts: [['path', { d: 'M15.5 4.5a5 5 0 0 1 0 7.1l-4 4-4.6-4.6 4-4a5 5 0 0 1 4.6-2.5z' }], ['path', { d: 'M6.9 11l-2.6 2.6a1.8 1.8 0 1 0 2.5 2.5l.2-.2.2.2a1.8 1.8 0 1 0 2.5-2.5' }]] },
};

export const ICON_NAMES = Object.freeze(Object.keys(ICONS));

// icon('home', { size: 24 }) -> <svg aria-hidden="true">…</svg>
// options: size (px), strokeWidth (overrides the default), color (stroke or fill; default currentColor).
export function icon(name, { size = 24, strokeWidth, color = 'currentColor' } = {}) {
  const definition = ICONS[name];
  if (!definition) throw new Error(`Unknown icon: ${name}`);
  const svg = document.createElementNS(SVG_NS, 'svg');
  const attributes = { width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false', class: `icon icon--${name}` };
  if (definition.style === 'fill') {
    Object.assign(attributes, { fill: color });
  } else {
    Object.assign(attributes, {
      fill: 'none', stroke: color, 'stroke-width': strokeWidth ?? definition.width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    });
  }
  for (const [key, value] of Object.entries(attributes)) svg.setAttribute(key, String(value));
  for (const [tag, partAttributes] of definition.parts) {
    const part = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(partAttributes)) part.setAttribute(key, String(value));
    svg.append(part);
  }
  return svg;
}
