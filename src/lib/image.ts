import sharp from "sharp";
import convert from "heic-convert";

const WEB_MAX = 2000;
const THUMB_MAX = 400;

export async function processImage(input: Buffer): Promise<{
  web: Buffer;
  thumb: Buffer;
  exif: Buffer | null;
  width: number;
  height: number;
}> {
  const meta = await sharp(input).metadata();
  const exif = meta.exif ?? null;

  // sharp's prebuilt libvips/libheif cannot decode HEVC-coded HEIC pixels
  // (only container/box metadata). Fall back to heic-convert (libheif-js/WASM)
  // to decode HEIC/HEIF input into a JPEG buffer sharp can then process.
  const decoded =
    meta.format === "heif"
      ? Buffer.from(await convert({ buffer: input, format: "JPEG", quality: 0.92 }))
      : input;

  let width = meta.width ?? 0;
  let height = meta.height ?? 0;
  if (meta.width === undefined || meta.height === undefined) {
    const decodedMeta = await sharp(decoded).metadata();
    width = decodedMeta.width ?? 0;
    height = decodedMeta.height ?? 0;
  }

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
