// @vitest-environment node
import sharp from "sharp";
import { processLogo } from "@/lib/logo";

async function fixture(size: number): Promise<Buffer> {
  return sharp({
    create: { width: size, height: size, channels: 4, background: { r: 10, g: 20, b: 30, alpha: 1 } },
  })
    .png()
    .toBuffer();
}

describe("processLogo", () => {
  it("converts to webp, caps dimensions at 512, and strips metadata", async () => {
    const input = await fixture(800);
    const result = await processLogo(input);
    const meta = await sharp(result).metadata();

    expect(meta.format).toBe("webp");
    expect(meta.width).toBeLessThanOrEqual(512);
    expect(meta.height).toBeLessThanOrEqual(512);
    expect(meta.exif).toBeUndefined();
  });

  it("does not upscale images smaller than the max size", async () => {
    const input = await fixture(100);
    const result = await processLogo(input);
    const meta = await sharp(result).metadata();

    expect(meta.width).toBe(100);
    expect(meta.height).toBe(100);
  });
});
