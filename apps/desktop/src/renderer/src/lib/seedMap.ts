/**
 * seedMap.ts — the sample campaign's map, drawn here (an SVG, kept in the
 * vault as a data: URL, so the starter content needs no files): Saltreach on
 * its headland, the harbor, the breakwater running out to sea and the Sunken
 * Lantern at its end.
 */
export const SALTREACH_SIZE = { width: 1600, height: 1000 };

export function saltreachMap(): string {
  const waves = Array.from({ length: 26 }, (_, i) => {
    const y = 40 + i * 38;
    const x = (i % 3) * 70;
    return `<path d="M${x} ${y} q 30 -10 60 0 t 60 0 t 60 0" transform="translate(${(i * 137) % 700} 0)" />`;
  }).join('');
  const houses = [
    [1120, 390], [1160, 372], [1200, 398], [1240, 380], [1132, 436], [1178, 450], [1222, 432], [1268, 452], [1150, 494], [1196, 506], [1244, 492], [1290, 418],
  ]
    .map(([x, y]) => `<rect x="${x}" y="${y}" width="26" height="20" rx="2" transform="rotate(${(x! * 7) % 18 - 9} ${x} ${y})" />`)
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000">
  <defs>
    <linearGradient id="sea" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1b3a4c"/><stop offset="1" stop-color="#2c5a6e"/></linearGradient>
    <linearGradient id="land" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#cbb98b"/><stop offset="0.12" stop-color="#9aa274"/><stop offset="1" stop-color="#7d8a5e"/></linearGradient>
    <radialGradient id="glow"><stop offset="0" stop-color="#ffd27a" stop-opacity="0.95"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient>
    <pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse"><path d="M80 0H0V80" fill="none" stroke="#ffffff" stroke-opacity="0.05"/></pattern>
  </defs>
  <rect width="1600" height="1000" fill="url(#sea)"/>
  <g fill="none" stroke="#9cc3d1" stroke-opacity="0.18" stroke-width="2">${waves}</g>
  <path d="M1010 0 C 980 120 960 200 935 300 C 915 380 960 430 900 470 C 860 500 905 545 950 560 C 1010 585 990 700 1030 800 C 1050 880 1080 940 1095 1000 L1600 1000 L1600 0 Z" fill="url(#land)" stroke="#e8dcb4" stroke-width="5"/>
  <path d="M1180 120 c 60 -20 120 10 160 60 c 40 50 110 40 160 20" fill="none" stroke="#5f6d45" stroke-width="3" stroke-dasharray="2 10" stroke-linecap="round"/>
  <path d="M1300 640 c -40 60 -10 140 60 170 c 70 30 130 0 170 -60" fill="none" stroke="#5f6d45" stroke-width="3" stroke-dasharray="2 10" stroke-linecap="round"/>
  <g fill="#6b4f3a" stroke="#3b2a1e" stroke-width="2">${houses}</g>
  <path d="M1100 470 L 1300 470 M 1210 360 L 1210 540" stroke="#d9c7a0" stroke-width="6" stroke-linecap="round" opacity="0.8"/>
  <path d="M935 520 C 780 500 640 470 520 455 C 450 446 390 440 340 436" fill="none" stroke="#8d8578" stroke-width="18" stroke-linecap="round"/>
  <path d="M935 520 C 780 500 640 470 520 455 C 450 446 390 440 340 436" fill="none" stroke="#b8b0a2" stroke-width="10" stroke-linecap="round" stroke-dasharray="14 6"/>
  <circle cx="300" cy="430" r="62" fill="#5c5a55" stroke="#2f2e2b" stroke-width="4"/>
  <circle cx="282" cy="414" r="22" fill="#6e6b64"/><circle cx="324" cy="452" r="16" fill="#6e6b64"/>
  <circle cx="300" cy="430" r="130" fill="url(#glow)"/>
  <circle cx="300" cy="430" r="16" fill="#f1e6c8" stroke="#2f2e2b" stroke-width="4"/>
  <rect width="1600" height="1000" fill="url(#grid)"/>
  <g font-family="Georgia, 'Times New Roman', serif" fill="#f4ecd6" text-anchor="middle" letter-spacing="6">
    <text x="1210" y="330" font-size="40" font-weight="bold" stroke="#2a2418" stroke-width="1">SALTREACH</text>
    <text x="640" y="430" font-size="22" font-style="italic" letter-spacing="3" transform="rotate(7 640 430)">The Breakwater</text>
    <text x="300" y="560" font-size="26" font-weight="bold">THE SUNKEN LANTERN</text>
    <text x="300" y="590" font-size="16" font-style="italic" letter-spacing="2">reachable at the lowest tide</text>
    <text x="400" y="860" font-size="30" font-style="italic" fill="#9cc3d1" letter-spacing="10">THE GREY REACH</text>
  </g>
  <g transform="translate(1480 120)" fill="none" stroke="#f4ecd6" stroke-width="2">
    <circle r="46" stroke-opacity="0.6"/><path d="M0 -60 L 10 0 L 0 60 L -10 0 Z" fill="#f4ecd6" fill-opacity="0.85"/><path d="M-60 0 L 0 8 L 60 0 L 0 -8 Z" fill-opacity="0.4" fill="#f4ecd6"/>
    <text y="-70" text-anchor="middle" font-family="Georgia, serif" font-size="20" fill="#f4ecd6" stroke="none">N</text>
  </g>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
