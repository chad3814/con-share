import sharp from "sharp";
import convert from "heic-convert";
import exifr from "exifr";

const WEB_MAX = 2000;
const THUMB_MAX = 400;
const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs", "mif1", "msf1"]);

export function isHeic(input: Buffer): boolean {
  if (input.length < 12) return false;
  if (input.toString("latin1", 4, 8) !== "ftyp") return false;
  return HEIC_BRANDS.has(input.toString("latin1", 8, 12));
}

// Reads EXIF directly from the RAW original bytes via exifr, independent of
// sharp/heic-convert. This is the only path that recovers EXIF (incl. GPS)
// from HEIC: heic-convert drops it during JPEG re-encode, and sharp's libheif
// can't safely read metadata from real iPhone HEIC files (see isHeic comment
// below). Works for JPEG/HEIC/etc. Returns a JSON buffer (dates serialize to
// ISO strings) or null if nothing was found / parsing failed.
async function extractExif(input: Buffer): Promise<Buffer | null> {
  try {
    const parsed = await exifr.parse(input, { tiff: true, exif: true, gps: true });
    if (!parsed || Object.keys(parsed).length === 0) return null;
    return Buffer.from(JSON.stringify(parsed));
  } catch {
    return null;
  }
}

export async function processImage(input: Buffer): Promise<{
  web: Buffer;
  thumb: Buffer;
  exif: Buffer | null;
  width: number;
  height: number;
}> {
  // sharp's libheif rejects real iPhone HEICs at metadata() time (iref reference
  // security limit of 16; Apple files carry ~48). Detect HEIC by magic bytes and
  // decode via heic-convert (libheif-js) BEFORE sharp touches the bytes.
  const decoded = isHeic(input)
    ? Buffer.from(await convert({ buffer: input, format: "JPEG", quality: 0.92 }))
    : input;

  const exif = await extractExif(input);

  // sharp's top-level metadata().width/height deliberately ignore EXIF
  // orientation ("EXIF orientation is not taken into consideration" per
  // sharp's own type docs) even when the pipeline has .rotate() applied
  // beforehand — that call only affects pixel output, not the metadata()
  // read. The orientation-aware (i.e. displayed/rotated) dimensions live in
  // metadata().autoOrient, which sharp always populates regardless of
  // .rotate(). Read those so portrait iPhone photos (orientation 5-8, which
  // swap width/height) report correct displayed dims.
  const meta = await sharp(decoded).metadata();
  const width = meta.autoOrient.width;
  const height = meta.autoOrient.height;

  const web = await sharp(decoded)
    .rotate() // apply EXIF orientation before stripping
    .resize({ width: WEB_MAX, height: WEB_MAX, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();

  const thumb = await sharp(decoded)
    .rotate()
    .resize({ width: THUMB_MAX, height: THUMB_MAX, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 75 })
    .toBuffer();

  return { web, thumb, exif, width, height };
}
