import { render, screen } from "@testing-library/react";
import PhotoGrid, { type GalleryPhoto } from "@/components/PhotoGrid";

describe("PhotoGrid", () => {
  it("shows an empty state when there are no photos", () => {
    render(<PhotoGrid photos={[]} showNsfw={false} />);
    expect(screen.getByText("No photos have been shared yet.")).toBeInTheDocument();
  });

  it("renders a thumbnail image for each photo", () => {
    const photo: GalleryPhoto = {
      id: "photo-1",
      thumbUrl: "https://example-bucket.s3.us-east-1.amazonaws.com/thumb.webp",
      webUrl: "https://example-bucket.s3.us-east-1.amazonaws.com/web.webp",
      nsfw: false,
      description: "A cosplayer at the con",
    };
    render(<PhotoGrid photos={[photo]} showNsfw={false} />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", photo.thumbUrl);
    expect(img).toHaveAttribute("alt", photo.description);
  });

  it("blurs an nsfw photo behind a reveal overlay when showNsfw is false", () => {
    const photo: GalleryPhoto = {
      id: "photo-2",
      thumbUrl: "https://example-bucket.s3.us-east-1.amazonaws.com/thumb.webp",
      webUrl: "https://example-bucket.s3.us-east-1.amazonaws.com/web.webp",
      nsfw: true,
      description: "A spicy cosplay",
    };
    render(<PhotoGrid photos={[photo]} showNsfw={false} />);
    expect(screen.getByRole("button", { name: /tap to reveal/i })).toBeInTheDocument();
    const img = screen.getByRole("img");
    expect(img.className).toContain("blur");
  });

  it("renders an nsfw photo unblurred when showNsfw is true", () => {
    const photo: GalleryPhoto = {
      id: "photo-3",
      thumbUrl: "https://example-bucket.s3.us-east-1.amazonaws.com/thumb.webp",
      webUrl: "https://example-bucket.s3.us-east-1.amazonaws.com/web.webp",
      nsfw: true,
      description: "A spicy cosplay",
    };
    render(<PhotoGrid photos={[photo]} showNsfw={true} />);
    expect(screen.queryByRole("button", { name: /tap to reveal/i })).not.toBeInTheDocument();
    const img = screen.getByRole("img");
    expect(img.className).not.toContain("blur");
  });
});
