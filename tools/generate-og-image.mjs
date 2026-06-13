import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const WIDTH = 1200;
const HEIGHT = 630;
const BG = '#060606';

const logoPath = path.join(root, 'src/assets/logos/cloudcast-regal-dark.png');
const outPath = path.join(root, 'public/og-image.png');

const logo = sharp(logoPath);
const meta = await logo.metadata();
const logoWidth = meta.width ?? 1024;
const logoHeight = meta.height ?? 430;

const maxLogoWidth = Math.round(WIDTH * 0.72);
const scale = Math.min(1, maxLogoWidth / logoWidth);
const targetWidth = Math.round(logoWidth * scale);
const targetHeight = Math.round(logoHeight * scale);

const resizedLogo = await logo.resize(targetWidth, targetHeight, { fit: 'inside' }).png().toBuffer();

const left = Math.round((WIDTH - targetWidth) / 2);
const top = Math.round((HEIGHT - targetHeight) / 2) - 24;

const taglineSvg = Buffer.from(`
<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <text
    x="50%"
    y="${top + targetHeight + 52}"
    text-anchor="middle"
    fill="#9ca3af"
    font-family="Inter, system-ui, -apple-system, sans-serif"
    font-size="28"
    font-weight="500"
  >Professional Broadcast Tools in the Cloud</text>
</svg>
`);

await sharp({
  create: {
    width: WIDTH,
    height: HEIGHT,
    channels: 3,
    background: BG,
  },
})
  .composite([
    { input: resizedLogo, left, top },
    { input: taglineSvg, left: 0, top: 0 },
  ])
  .png()
  .toFile(outPath);

console.log(`Wrote ${outPath} (${WIDTH}x${HEIGHT})`);
