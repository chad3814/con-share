import { render, screen } from "@testing-library/react";
import PhotoGrid, { type GalleryPhoto } from "@/components/PhotoGrid";

describe("PhotoGrid", () => {
  it("shows an empty state when there are no photos", () => {
    render(<PhotoGrid photos={[]} />);
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
    render(<PhotoGrid photos={[photo]} />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", photo.thumbUrl);
    expect(img).toHaveAttribute("alt", photo.description);
  });
});
