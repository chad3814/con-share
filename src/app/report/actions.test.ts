import { createReportAction } from "./actions";
import { getCurrentUser } from "@/lib/auth-helpers";
import { createReport } from "@/lib/reports";

vi.mock("@/lib/auth-helpers", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/reports", () => ({
  createReport: vi.fn(),
}));

function headersMock(entries: Record<string, string>) {
  return async () => new Headers(entries);
}

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

import { headers } from "next/headers";

describe("createReportAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports anonymously, using the first x-forwarded-for address", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    vi.mocked(headers).mockImplementation(
      headersMock({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }),
    );

    const formData = new FormData();
    formData.set("category", "ABUSE");

    await createReportAction("photo-1", formData);

    expect(createReport).toHaveBeenCalledTimes(1);
    expect(createReport).toHaveBeenCalledWith(
      "photo-1",
      expect.objectContaining({ category: "ABUSE" }),
      { userId: undefined, ip: "1.2.3.4" },
    );
  });

  it("attributes the report to the logged-in user", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "u1",
      role: "USER",
    });
    vi.mocked(headers).mockImplementation(
      headersMock({ "x-forwarded-for": "9.9.9.9" }),
    );

    const formData = new FormData();
    formData.set("category", "OTHER");

    await createReportAction("photo-2", formData);

    expect(createReport).toHaveBeenCalledTimes(1);
    expect(createReport).toHaveBeenCalledWith(
      "photo-2",
      expect.objectContaining({ category: "OTHER" }),
      { userId: "u1", ip: "9.9.9.9" },
    );
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    vi.mocked(headers).mockImplementation(headersMock({ "x-real-ip": "8.8.8.8" }));

    const formData = new FormData();
    formData.set("category", "COPYRIGHT");

    await createReportAction("photo-3", formData);

    expect(createReport).toHaveBeenCalledWith(
      "photo-3",
      expect.objectContaining({ category: "COPYRIGHT" }),
      { userId: undefined, ip: "8.8.8.8" },
    );
  });

  it("throws on an invalid category and never calls createReport", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    vi.mocked(headers).mockImplementation(headersMock({}));

    const formData = new FormData();
    formData.set("category", "BOGUS");

    await expect(createReportAction("photo-4", formData)).rejects.toThrow();
    expect(createReport).not.toHaveBeenCalled();
  });
});
