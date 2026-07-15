// @vitest-environment node
import { readFileSync } from "fs";
import { join } from "path";
import sharp from "sharp";
import { processImage } from "@/lib/image";

async function fixtureWithExif(): Promise<Buffer> {
  return sharp({ create: { width: 3000, height: 2000, channels: 3, background: { r: 10, g: 20, b: 30 } } })
    .withExif({ IFD0: { Copyright: "Chad", Make: "TestCam" } })
    .jpeg()
    .toBuffer();
}

function fixtureHeic(): Buffer {
  return readFileSync(join(__dirname, "../__fixtures__/sample.heic"));
}

describe("processImage", () => {
  it("extracts EXIF, strips it from derivatives, and resizes", async () => {
    const input = await fixtureWithExif();
    const result = await processImage(input);

    expect(result.width).toBe(3000);
    expect(result.height).toBe(2000);
    expect(result.exif).not.toBeNull();
    expect(result.exif!.length).toBeGreaterThan(0);

    const webMeta = await sharp(result.web).metadata();
    expect(webMeta.format).toBe("webp");
    expect(webMeta.width).toBeLessThanOrEqual(2000);
    expect(webMeta.exif).toBeUndefined(); // stripped

    const thumbMeta = await sharp(result.thumb).metadata();
    expect(thumbMeta.width).toBeLessThanOrEqual(400);
    expect(thumbMeta.exif).toBeUndefined();
  });

  it("decodes real HEVC-coded HEIC input via the heic-convert fallback", async () => {
    const input = fixtureHeic();
    const result = await processImage(input);

    expect(result.width).toBe(200);
    expect(result.height).toBe(150);
    // Real HEIC container carries no EXIF in this fixture; acceptable per spec.
    expect(result.exif).toBeNull();

    const webMeta = await sharp(result.web).metadata();
    expect(webMeta.format).toBe("webp");
    expect(webMeta.width).toBeLessThanOrEqual(2000);
    expect(webMeta.exif).toBeUndefined();

    const thumbMeta = await sharp(result.thumb).metadata();
    expect(thumbMeta.format).toBe("webp");
    expect(thumbMeta.width).toBeLessThanOrEqual(400);
    expect(thumbMeta.exif).toBeUndefined();
  });
});
