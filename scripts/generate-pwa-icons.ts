/**
 * Generate PNG PWA icons from public/seedling-icon.svg so Android (and iOS)
 * use the seedling icon instead of a generic/keyhole icon when "Add to Home Screen".
 * Run: npx tsx scripts/generate-pwa-icons.ts
 */
import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";

const ROOT = path.join(__dirname, "..");
const SVG_PATH = path.join(ROOT, "public", "seedling-icon.svg");
const OUT_DIR = path.join(ROOT, "public", "icons");

const SIZES = [192, 512] as const;

// Replace currentColor so Sharp renders a visible stroke (emerald-700)
const EMERALD_STROKE = "#047857";
function svgWithColor(svgPath: string): Buffer {
  const raw = fs.readFileSync(svgPath, "utf-8");
  const withColor = raw.replace(/currentColor/g, EMERALD_STROKE);
  return Buffer.from(withColor);
}

async function main() {
  if (!fs.existsSync(SVG_PATH)) {
    console.error("Missing", SVG_PATH);
    process.exit(1);
  }
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const svgBuffer = svgWithColor(SVG_PATH);

  for (const size of SIZES) {
    const outPath = path.join(OUT_DIR, `icon-${size}.png`);
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outPath);
    console.log("Wrote", outPath);
  }
  console.log("Done. Update public/manifest.json to reference /icons/icon-192.png and /icons/icon-512.png");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
