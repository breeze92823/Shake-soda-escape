// Inline SVG icons for the HUD, drawn to read like chunky toy-game art.
const svg = (vb, body) => `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`

export const ICONS = {
  menu: svg('0 0 40 40', '<path d="M8 12h24M8 20h24M8 28h24" stroke="#fff" stroke-width="3" stroke-linecap="round"/>'),
  chat: svg('0 0 40 40', '<path d="M8 9h24a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H18l-7 6v-6H8a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2z" fill="none" stroke="#fff" stroke-width="2.6" stroke-linejoin="round"/><path d="M13 16h14M13 21h9" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>'),
  bell: svg('0 0 40 40', '<path d="M20 5c-6 0-9.5 4.6-9.5 10.5v6L7 27h26l-3.5-5.5v-6C29.5 9.6 26 5 20 5z" fill="#ffc21a"/><circle cx="20" cy="31" r="4" fill="#ffc21a"/>'),
  logo: svg(
    '0 0 40 40',
    `<g stroke="#121212" stroke-width="2" stroke-linejoin="round">
      <rect x="11" y="7" width="18" height="27" rx="4" fill="#fff"/>
      <rect x="11" y="15" width="18" height="10" fill="#e8283a"/>
      <rect x="15" y="4" width="10" height="4" rx="1.5" fill="#d8d8e0"/></g>`,
  ),
  emote: svg(
    '0 0 40 40',
    `<rect x="5" y="9" width="30" height="22" rx="7" fill="#ffd21a" stroke="#121212" stroke-width="2"/>
    <rect x="9" y="14" width="9" height="7" rx="2" fill="#2a6ad0"/><rect x="22" y="14" width="9" height="7" rx="2" fill="#2a6ad0"/>
    <path d="M14 25q6 4 12 0" fill="none" stroke="#121212" stroke-width="2.4" stroke-linecap="round"/>`,
  ),
  // Shaken-soda cup: clear lid, blue drink, red straw.
  cup: svg(
    '0 0 48 60',
    `<g stroke="#10233f" stroke-width="3" stroke-linejoin="round">
      <path d="M26 16 L34 3 L38 5 L31 17" fill="#e8283a"/>
      <path d="M9 22 L39 22 L35 56 L13 56 Z" fill="#5fd2ff"/>
      <path d="M11 34 L37 34 L35 56 L13 56 Z" fill="#1f9ae8"/>
      <path d="M5 16 h38 a2 2 0 0 1 2 2 v3 a2 2 0 0 1 -2 2 h-38 a2 2 0 0 1 -2 -2 v-3 a2 2 0 0 1 2 -2z" fill="#f2fbff"/>
      <path d="M12 16 q12 -9 24 0" fill="#f2fbff"/></g>
    <path d="M15 27 L16.5 50" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".75"/>`,
  ),
  // Flat fills (no gradient): the icon is inlined many times, and a shared
  // gradient id breaks when the first copy sits in a display:none element.
  trophy: svg(
    '0 0 64 64',
    `<g stroke="#5a3200" stroke-width="3.5" stroke-linejoin="round">
      <path d="M14 14 H6 q0 16 14 18 M50 14 H58 q0 16 -14 18" fill="none" stroke-width="5"/>
      <path d="M14 8 H50 V22 q0 18 -18 20 q-18 -2 -18 -20 Z" fill="#ffc933"/>
      <rect x="27" y="41" width="10" height="9" fill="#f2b21a"/>
      <path d="M17 50 H47 l3 9 H14 Z" fill="#f7a81a"/></g>
    <path d="M21 13 V22 q0 8 6 12" fill="none" stroke="#fff6c0" stroke-width="3.5" stroke-linecap="round"/>`,
  ),
  plus: svg('0 0 40 40', '<rect x="3" y="3" width="34" height="34" rx="9" fill="#38d23a" stroke="#0e3a12" stroke-width="3.5"/><path d="M20 11v18M11 20h18" stroke="#121212" stroke-width="8" stroke-linecap="round"/><path d="M20 11v18M11 20h18" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/>'),
  // Red/white ball with a sweeping white "go again" arrow.
  rebirth: svg(
    '0 0 80 80',
    `<g stroke="#121212" stroke-width="4">
      <path d="M8 38 a30 30 0 0 1 60 0 Z" fill="#e8283a"/>
      <path d="M8 38 a30 30 0 0 0 60 0 Z" fill="#f4f4f4"/>
      <circle cx="38" cy="38" r="8" fill="#fff"/></g>
    <path d="M14 58 q22 18 50 -6" fill="none" stroke="#121212" stroke-width="13" stroke-linecap="round"/>
    <path d="M14 58 q22 18 50 -6" fill="none" stroke="#eaf6ff" stroke-width="7" stroke-linecap="round"/>
    <path d="M56 44 L72 46 L66 61 Z" fill="#eaf6ff" stroke="#121212" stroke-width="3.5" stroke-linejoin="round"/>`,
  ),
  // Window close: white X with a dark outline.
  close: svg('0 0 40 40', '<path d="M10 10L30 30M30 10L10 30" stroke="#121212" stroke-width="12" stroke-linecap="round"/><path d="M10 10L30 30M30 10L10 30" stroke="#fff" stroke-width="6.5" stroke-linecap="round"/>'),
  // ">>" between the before/after columns of a window.
  chevrons: svg(
    '0 0 72 48',
    `<g fill="#fff" stroke="#121212" stroke-width="3.5" stroke-linejoin="round">
      <path d="M4 6 H17 L35 24 L17 42 H4 L22 24 Z"/><path d="M33 6 H46 L64 24 L46 42 H33 L51 24 Z"/></g>`,
  ),
  calendar: svg(
    '0 0 80 80',
    `<g stroke="#121212" stroke-width="4" stroke-linejoin="round">
      <rect x="8" y="12" width="64" height="60" rx="10" fill="#f4f4f4"/>
      <path d="M8 22 a10 10 0 0 1 10 -10 h44 a10 10 0 0 1 10 10 v8 h-64 Z" fill="#e8283a"/>
      <rect x="20" y="5" width="8" height="15" rx="3" fill="#7a7a86"/><rect x="52" y="5" width="8" height="15" rx="3" fill="#7a7a86"/></g>
    <text x="40" y="64" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="32" fill="#121212">31</text>`,
  ),
  aura: svg(
    '0 0 80 80',
    `<defs><radialGradient id="aug" cx=".5" cy=".6" r=".6"><stop offset="0" stop-color="#f6c8ff"/><stop offset=".55" stop-color="#b44aff"/><stop offset="1" stop-color="#5a12b0"/></radialGradient></defs>
    <path d="M40 6 q6 12 14 8 q-2 10 8 14 q-8 4 -2 14 q12 2 10 16 q-12 -4 -16 6 q-8 -6 -14 6 q-6 -12 -14 -6 q-4 -10 -16 -6 q-2 -14 10 -16 q6 -10 -2 -14 q10 -4 8 -14 q8 4 14 -8z" fill="url(#aug)" stroke="#2a0a5a" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M40 26 q10 10 0 22 q-10 -12 0 -22z" fill="#fff" opacity=".85"/>
    <g fill="#fff"><circle cx="18" cy="16" r="2.5"/><circle cx="64" cy="30" r="2"/><circle cx="60" cy="66" r="2.5"/></g>`,
  ),
  globe: svg(
    '0 0 80 80',
    `<circle cx="40" cy="40" r="30" fill="#3ab4ff" stroke="#121212" stroke-width="4"/>
    <g fill="#4ad83a" stroke="#121212" stroke-width="3" stroke-linejoin="round">
      <path d="M16 26 q8 -6 16 -2 q2 8 -6 10 q-2 8 -10 6 q-6 -6 0 -14z"/>
      <path d="M42 16 q12 0 18 10 q-6 4 -12 0 q-6 2 -6 -10z"/>
      <path d="M44 40 q10 -4 18 4 q-2 14 -12 18 q-4 -10 -8 -10 q-4 -6 2 -12z"/></g>
    <path d="M10 46 q30 10 60 -8" fill="none" stroke="#f4f4f4" stroke-width="6" stroke-linecap="round" opacity=".9"/>
    <circle cx="66" cy="18" r="6" fill="#ffd21a" stroke="#121212" stroke-width="2.5"/>`,
  ),
}

// Hexagon currency coin (Bloxbux). `fill` is the coin colour.
export const coin = (fill = '#3fd83a', ink = '#0e2a12') =>
  svg(
    '0 0 40 40',
    `<circle cx="20" cy="20" r="17" fill="${fill}" stroke="${ink}" stroke-width="3.5"/>
    <path d="M20 9 L29.5 14.5 V25.5 L20 31 L10.5 25.5 V14.5 Z" fill="none" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>
    <rect x="16" y="16" width="8" height="8" rx="1" fill="${ink}"/>`,
  )
