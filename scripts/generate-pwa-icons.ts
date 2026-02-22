/**
 * Generate PNG PWA icons for "Add to Home Screen" on Android and iOS.
 * Run: npx tsx scripts/generate-pwa-icons.ts
 * Or with custom image: npx tsx scripts/generate-pwa-icons.ts --source public/app-icon.png
 */
import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";

const ROOT = path.join(__dirname, "..");
const SVG_PATH = path.join(ROOT, "public", "seedling-icon.svg");
const PNG_SOURCE = path.join(ROOT, "public", "app-icon.png");
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
  const usePng = process.argv.includes("--source") || fs.existsSync(PNG_SOURCE);
  const sourcePath = process.argv.includes("--source")
    ? path.resolve(ROOT, process.argv[process.argv.indexOf("--source") + 1] ?? PNG_SOURCE)
    : PNG_SOURCE;

  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  let pipeline: sharp.Sharp;
  if (usePng && fs.existsSync(sourcePath)) {
    pipeline = sharp(sourcePath);
    console.log("Using PNG source:", sourcePath);
  } else if (fs.existsSync(SVG_PATH)) {
    const svgBuffer = svgWithColor(SVG_PATH);
    pipeline = sharp(svgBuffer);
    console.log("Using SVG source:", SVG_PATH);
  } else {
    console.error("No source found. Add public/app-icon.png or ensure public/seedling-icon.svg exists.");
    process.exit(1);
  }

  for (const size of SIZES) {
    const outPath = path.join(OUT_DIR, `icon-${size}.png`);
    await pipeline.clone().resize(size, size).png().toFile(outPath);
    console.log("Wrote", outPath);
  }
  console.log("Done. Icons at /icons/icon-192.png and /icons/icon-512.png");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
