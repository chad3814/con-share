import sharp from "sharp";

export const ACCEPTED_LOGO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const LOGO_MAX = 512;

export async function processLogo(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .resize({ width: LOGO_MAX, height: LOGO_MAX, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
}
