import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const BRAND = 'E:/Pawple-Clean-PRESERVED-TEST/assets/brand';
const M = (f) => path.join(BRAND, 'masters', f);
const D = (f) => path.join(BRAND, 'dist', f);
fs.mkdirSync(path.join(BRAND, 'dist'), { recursive: true });
const CREAM = '#FEFBF7';

const symbol = fs.readFileSync(M('symbol.svg'));
const lockup = fs.readFileSync(M('lockup-stacked.svg'));
const micro  = fs.readFileSync(M('micro.svg'));

async function png(src, file, width, bg) {
  let pipe = sharp(src, { density: 300 }).resize({ width });
  if (bg) pipe = pipe.flatten({ background: bg });
  await pipe.png().toFile(D(file));
  console.log('wrote', file);
}
async function canvas(file, w, h, bg, inputs) {
  await sharp({ create: { width: w, height: h, channels: 4, background: bg } })
    .composite(inputs).png().toFile(D(file));
  console.log('wrote', file);
}

for (const s of [16,24,32,48,64,128,192,512,1024]) await png(symbol, `symbol-${s}.png`, s);
for (const s of [16,24,32,48]) await png(micro, `micro-${s}.png`, s);
for (const s of [512,1024]) await png(lockup, `lockup-stacked-${s}w.png`, s);
await png(symbol, 'store-ios-1024.png', 1024, CREAM);
await png(symbol, 'store-play-512.png', 512, CREAM);
await png(symbol, 'avatar-500.png', 500, CREAM);

const fg = await sharp(symbol, { density: 300 }).resize({ width: 288 }).toBuffer();
await canvas('adaptive-foreground-432.png', 432, 432, { r:0,g:0,b:0,alpha:0 }, [{ input: fg, gravity: 'center' }]);
await canvas('adaptive-background-432.png', 432, 432, CREAM, []);
const og = await sharp(lockup, { density: 300 }).resize({ width: 420 }).toBuffer();
await canvas('og-card-1200x630.png', 1200, 630, CREAM, [{ input: og, gravity: 'center' }]);

fs.writeFileSync(D('favicon.ico'), await pngToIco([D('micro-16.png'), D('micro-32.png'), D('symbol-48.png')]));
console.log('wrote favicon.ico');
