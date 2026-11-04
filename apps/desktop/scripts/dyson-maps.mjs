// Reads Dyson Logos's Commercial Maps page (https://dysonlogos.blog/maps/commercial-maps/, saved as HTML) into the
// Library's map catalog: each free commercial-license map's title, post, image and size.
// node scripts/dyson-maps.mjs <commercial-maps.html> src/renderer/src/lib/library/dyson-maps.json src/renderer/public/library/maps
// (the third: where the maps bundled with the app are, each named as `bundledName` names it; those get `file`).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [src, out, bundled] = process.argv.slice(2);
/** A bundled map's file name: the image's own name, lower case, png or jpg. */
const bundledName = (image) => image.split('/').pop().replace(/\.(jpe?g|png)$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-') + (/\.png$/i.test(image) ? '.png' : '.jpg');
const html = readFileSync(src, 'utf8');
const decode = (s) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&#8217;|&rsquo;/g, '’')
    .replace(/&#8216;/g, '‘')
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#8211;/g, '–')
    .replace(/&#038;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

const maps = [];
const seen = new Set();
// Posts on this blog or the one before it (rpgcharacters.wordpress.com); the paid map packs (DriveThruRPG) aren't free maps.
for (const m of html.matchAll(/<figure[^>]*>\s*<a href="(https:\/\/(?:dysonlogos\.blog|rpgcharacters\.wordpress\.com)\/[^"]+)"><img([^>]*)\/?><\/a>(?:<figcaption[^>]*>([\s\S]*?)<\/figcaption>)?<\/figure>/g)) {
  const [, post, attrs, caption] = m;
  const orig = /data-orig-file="([^"]+)"/.exec(attrs)?.[1];
  const size = /data-orig-size="(\d+),(\d+)"/.exec(attrs);
  const imageTitle = /data-image-title="([^"]*)"/.exec(attrs)?.[1] ?? '';
  if (!orig || !/^https:\/\/dysonlogos\.blog\/wp-content\/uploads\//.test(orig) || seen.has(orig)) continue;
  seen.add(orig);
  const title = decode(caption ?? '') || decode(imageTitle).replace(/[-_]/g, ' ');
  const file = bundled && existsSync(join(bundled, bundledName(orig))) ? bundledName(orig) : undefined;
  maps.push({ title, post, image: orig, width: Number(size?.[1] ?? 0), height: Number(size?.[2] ?? 0), ...(file ? { file } : {}) });
}
writeFileSync(out, JSON.stringify(maps));
console.log('maps', maps.length, 'bundled', maps.filter((m) => m.file).length);
