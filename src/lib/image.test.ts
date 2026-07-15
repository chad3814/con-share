// @vitest-environment node
import { readFileSync } from "fs";
import { join } from "path";
import sharp from "sharp";
import { isHeic, processImage } from "@/lib/image";

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

    interface ParsedExif {
      Make?: string;
      Copyright?: string;
    }
    const parsed = JSON.parse(result.exif!.toString()) as ParsedExif;
    expect(parsed.Make).toBe("TestCam");
    expect(parsed.Copyright).toContain("Chad");

    const webMeta = await sharp(result.web).metadata();
    expect(webMeta.format).toBe("webp");
    expect(webMeta.width).toBeLessThanOrEqual(2000);
    expect(webMeta.exif).toBeUndefined(); // stripped

    const thumbMeta = await sharp(result.thumb).metadata();
    expect(thumbMeta.width).toBeLessThanOrEqual(400);
    expect(thumbMeta.exif).toBeUndefined();
  });

  it("reports the DISPLAY dimensions for EXIF-rotated photos (orientation 6 swaps width/height)", async () => {
    // Store a landscape 400x200 image but tag it with EXIF orientation 6
    // (rotate 90deg CW to display), the way an iPhone captures a portrait
    // photo while writing landscape-oriented sensor data plus an
    // orientation tag. sharp's metadata().width/height ignore orientation
    // by design; only metadata().autoOrient reflects the displayed size.
    const input = await sharp({
      create: { width: 400, height: 200, channels: 3, background: { r: 12, g: 34, b: 56 } },
    })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();

    // Sanity-check the fixture actually carries the orientation tag and that
    // sharp's own auto-orient metadata reports the swapped (display) size —
    // this pins down the sharp behavior processImage relies on.
    const fixtureMeta = await sharp(input).metadata();
    expect(fixtureMeta.orientation).toBe(6);
    expect(fixtureMeta.width).toBe(400);
    expect(fixtureMeta.height).toBe(200);
    expect(fixtureMeta.autoOrient).toEqual({ width: 200, height: 400 });

    const result = await processImage(input);

    // Display dims are swapped relative to the stored (pre-rotate) dims.
    expect(result.width).toBe(200);
    expect(result.height).toBe(400);

    // The web/thumb derivatives are rendered with rotation applied, so they
    // should come out portrait too (narrower than tall).
    const webMeta = await sharp(result.web).metadata();
    expect(webMeta.width).toBeLessThan(webMeta.height);
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

describe("isHeic", () => {
  it("returns true for the committed HEIC fixture bytes", () => {
    expect(isHeic(fixtureHeic())).toBe(true);
  });

  it("returns false for a JPEG buffer produced by sharp", async () => {
    const jpeg = await sharp({
      create: { width: 10, height: 10, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .jpeg()
      .toBuffer();
    expect(isHeic(jpeg)).toBe(false);
  });
});
