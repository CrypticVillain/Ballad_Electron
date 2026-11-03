/**
 * make-icon.mjs — renders the app icons and the installer's artwork, using
 * Electron's own Chromium (and the app's bundled fonts) so nothing else needs
 * installing:
 *
 *   build/icon.svg        → build/icon.png        (1024×1024, the dark icon)
 *                            build/icons/ballad-dark.ico
 *   build/icon-light.svg  → build/icon-light.png
 *                            build/icons/ballad-light.ico
 *   build/installerSidebar.bmp, uninstallerSidebar.bmp   the Welcome / Finish pages' side art
 *   build/installerHeader.bmp                              the other pages' header
 *   build/installer-match.ico                              the "Match Windows" icon preview
 *
 * electron-builder makes Ballad.exe's icon from ballad-dark.ico and picks
 * the .bmp files up by name. The window, tray and Dock use the PNGs, and
 * Windows shortcuts the .ico files (copied into resources/icons), so the icon
 * you pick (Settings → Appearance, or the installer) shows everywhere. The
 * artwork is in Ballad's Display style: dot-matrix Doto, Geist Mono labels,
 * near-black and off-white with the orange meter.
 *
 *   npm run icon -w apps/desktop
 */
import { app, BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const build = path.join(here, '../build');
const fonts = path.join(here, '../../../node_modules/@fontsource');

const SIZE = 1024;
/** The sizes Windows asks an .ico for (PNG entries are fine since Vista). */
const ICO_SIZES = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256];
const ICONS = [
  { svg: 'icon.svg', png: 'icon.png', ico: 'icons/ballad-dark.ico' },
  { svg: 'icon-light.svg', png: 'icon-light.png', ico: 'icons/ballad-light.ico' },
];

/** An .ico holding PNG images at each size. */
function ico(image) {
  const images = ICO_SIZES.map((size) => ({ size, png: image.resize({ width: size, height: size, quality: 'best' }).toPNG() }));
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, png }, i) => {
    const entry = 6 + i * 16;
    header.writeUInt8(size >= 256 ? 0 : size, entry); // width (0 = 256)
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1); // height
    header.writeUInt16LE(1, entry + 4); // color planes
    header.writeUInt16LE(32, entry + 6); // bits per pixel
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...images.map((i) => i.png)]);
}

/** A 24-bit .bmp (what NSIS wants for its page art). */
function bmp(image) {
  const { width, height } = image.getSize();
  const bgra = image.toBitmap(); // top-down BGRA
  const row = Math.ceil((width * 3) / 4) * 4;
  const out = Buffer.alloc(54 + row * height);
  out.write('BM', 0);
  out.writeUInt32LE(out.length, 2);
  out.writeUInt32LE(54, 10);
  out.writeUInt32LE(40, 14);
  out.writeInt32LE(width, 18);
  out.writeInt32LE(height, 22); // positive: bottom-up rows
  out.writeUInt16LE(1, 26);
  out.writeUInt16LE(24, 28);
  out.writeUInt32LE(row * height, 34);
  for (let y = 0; y < height; y++) {
    const dst = 54 + (height - 1 - y) * row;
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      out[dst + x * 3] = bgra[src]; // B
      out[dst + x * 3 + 1] = bgra[src + 1]; // G
      out[dst + x * 3 + 2] = bgra[src + 2]; // R
    }
  }
  return out;
}

const font = (family, file, weight) =>
  `@font-face{font-family:${family};font-weight:${weight};src:url(data:font/woff2;base64,${fs.readFileSync(path.join(fonts, file)).toString('base64')}) format('woff2')}`;
const FONTS = [
  font('Doto', 'doto/files/doto-latin-900-normal.woff2', 900),
  font('GeistMono', 'geist-mono/files/geist-mono-latin-500-normal.woff2', 500),
].join('');

const svgData = (file) => `data:image/svg+xml;base64,${fs.readFileSync(path.join(build, file)).toString('base64')}`;
/** The bare mark (no tile): the B in off-white, the meter's bars cut out of it in the background color. */
const bareMark = (size, background) =>
  `<svg viewBox="0 0 120 120" width="${size}" height="${size}"><path d="M42 30v60M42 30h18a15 15 0 0 1 0 30H42M42 60h22a15 15 0 0 1 0 30H42" fill="none" stroke="#f1efea" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>` +
  [[70, 24, 13], [79, 13, 24], [88, 19, 18]].map(([x, y, h]) => `<rect x="${x}" y="${y}" width="7" height="${h}" rx="3.5" fill="#ff4a1c" stroke="${background}" stroke-width="4"/>`).join('') +
  `</svg>`;

/** The Welcome / Finish pages' side art: the app's dark rail, a dot grid, the mark and the dot-matrix wordmark. 2× for sharp scaling. */
const sidebar = (label) => `
  <div style="position:relative;width:328px;height:628px;overflow:hidden;background:#141414;
    background-image:radial-gradient(circle,#262626 1.5px,transparent 1.9px);background-size:14px 14px;background-position:7px 7px">
    <div style="position:absolute;left:34px;top:46px">${bareMark(92, '#141414')}</div>
    <div style="position:absolute;left:32px;top:176px;font:900 50px/1 Doto;letter-spacing:0.04em;color:#f1efea">BALLAD</div>
    <div style="position:absolute;left:34px;top:240px;font:500 12.5px/1.7 GeistMono;letter-spacing:0.16em;color:#8f8c86">STORIES · WORLDS<br>CHARACTERS · LORE</div>
    <div style="position:absolute;left:34px;right:34px;bottom:96px;height:1px;background:#2c2c2c"></div>
    <div style="position:absolute;left:34px;bottom:54px;display:flex;align-items:center;gap:12px;font:500 12px/1 GeistMono;letter-spacing:0.16em;color:#bdb9b1">
      <span style="width:9px;height:9px;border-radius:50%;background:#ff4a1c;box-shadow:0 0 10px 2px rgba(255,74,28,.55)"></span>${label}
    </div>
  </div>`;

/** The header lockup (left of each page's title): the icon tile and the wordmark, on white. 2×. */
const header = `
  <div style="width:300px;height:114px;background:#ffffff;display:flex;align-items:center;gap:16px;padding-left:22px;box-sizing:border-box">
    <img src="${svgData('icon.svg')}" width="62" height="62">
    <div style="display:flex;flex-direction:column;gap:8px">
      <div style="font:900 30px/1 Doto;letter-spacing:0.04em;color:#141414">BALLAD</div>
      <div style="display:flex;align-items:center;gap:7px;font:500 10.5px/1 GeistMono;letter-spacing:0.16em;color:#6f6c66">
        <span style="width:6px;height:6px;border-radius:50%;background:#ff4a1c"></span>SETUP
      </div>
    </div>
  </div>`;

/** The "Match Windows" preview: dark on the left, light on the right. */
const match = `
  <div style="position:relative;width:${SIZE}px;height:${SIZE}px">
    <img src="${svgData('icon.svg')}" width="${SIZE}" height="${SIZE}" style="position:absolute;clip-path:inset(0 50% 0 0)">
    <img src="${svgData('icon-light.svg')}" width="${SIZE}" height="${SIZE}" style="position:absolute;clip-path:inset(0 0 0 50%)">
  </div>`;

let window;
async function render(html, width, height) {
  window.setContentSize(width, height);
  const page = `<html><head><meta charset="utf-8"><style>${FONTS} html,body{margin:0;background:transparent;overflow:hidden}</style></head><body>${html}</body></html>`;
  await window.loadURL(`data:text/html;base64,${Buffer.from(page).toString('base64')}`);
  await window.webContents.executeJavaScript('document.fonts.ready.then(() => true)');
  await new Promise((resolve) => setTimeout(resolve, 400));
  return (await window.webContents.capturePage({ x: 0, y: 0, width, height })).resize({ width, height, quality: 'best' });
}

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  window = new BrowserWindow({ width: SIZE, height: SIZE, useContentSize: true, show: false, frame: false, transparent: true, webPreferences: { offscreen: true } });
  window.webContents.setZoomFactor(1);
  fs.mkdirSync(path.join(build, 'icons'), { recursive: true });

  for (const icon of ICONS) {
    const image = await render(`<img src="${svgData(icon.svg)}" width="${SIZE}" height="${SIZE}" style="display:block">`, SIZE, SIZE);
    fs.writeFileSync(path.join(build, icon.png), image.toPNG());
    fs.writeFileSync(path.join(build, icon.ico), ico(image));
    console.log(`build/${icon.png} and build/${icon.ico} written`);
  }

  const art = {
    'installer-match.ico': await render(match, SIZE, SIZE),
    'installerSidebar.bmp': await render(sidebar('READY TO INSTALL'), 328, 628),
    'uninstallerSidebar.bmp': await render(sidebar('UNINSTALL'), 328, 628),
    'installerHeader.bmp': await render(header, 300, 114),
  };
  for (const [name, image] of Object.entries(art)) {
    fs.writeFileSync(path.join(build, name), name.endsWith('.ico') ? ico(image) : bmp(image));
    // ART_PREVIEW=<folder>: also save PNGs of the art there, to look at.
    if (process.env.ART_PREVIEW) fs.writeFileSync(path.join(process.env.ART_PREVIEW, name.replace(/\.\w+$/, '.png')), image.toPNG());
  }
  console.log(`build/${Object.keys(art).join(', ')} written`);
  app.quit();
});
