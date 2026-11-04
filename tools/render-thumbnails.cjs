// Renders a product image for every demo product color (3D garment, three-quarter view, transparent background).
//   1. npm run dev   (in my-ecommerce-store, port 5180)
//   2. node tools/render-thumbnails.cjs http://127.0.0.1:5180
// Writes my-ecommerce-store/public/demo/products/<id>-<color>.png, then converts to .webp if Pillow is present.
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path'); const { execSync } = require('child_process');
const base = process.argv[2] || 'http://127.0.0.1:5180';
const out = path.join(__dirname, '../my-ecommerce-store/public/demo/products');
fs.mkdirSync(out, { recursive: true });
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 640, height: 800 } });
  await p.goto(`${base}/render.html`);
  await p.waitForFunction(() => window.__studioUp && window.__catalog, null, { timeout: 120000 });
  const catalog = await p.evaluate(() => window.__catalog);
  let n = 0;
  for (const item of catalog) {
    for (const c of item.colors) {
      const file = path.join(out, `${item.id}-${slug(c.name)}.png`);
      await p.evaluate(({ type, color }) => window.__show(type, color), { type: item.type, color: c });
      await p.waitForTimeout(250);
      await p.locator('canvas').screenshot({ path: file, omitBackground: true });
      n++;
    }
  }
  await b.close();
  console.log(`rendered ${n} images`);
  try {
    execSync(`python3 -c "
import glob,os
from PIL import Image
for f in glob.glob('${out}/*.png'):
    im=Image.open(f).convert('RGBA'); bb=im.getbbox()
    im.save(f[:-4]+'.webp','WEBP',quality=82,method=6); os.remove(f)
"`, { stdio: 'inherit' });
  } catch (e) { console.log('kept PNGs (no Pillow)'); }
})();
