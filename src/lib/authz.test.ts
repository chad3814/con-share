import { parseAdminEmails, isAdmin } from "@/lib/authz";

describe("parseAdminEmails", () => {
  it("splits, trims, and lowercases", () => {
    expect(parseAdminEmails("A@x.com, b@Y.com ")).toEqual(["a@x.com", "b@y.com"]);
  });
  it("drops empty entries", () => {
    expect(parseAdminEmails(" , a@x.com,")).toEqual(["a@x.com"]);
  });
  it("returns [] for an empty string", () => {
    expect(parseAdminEmails("")).toEqual([]);
  });
});

describe("isAdmin", () => {
  it("is true only for ADMIN role", () => {
    expect(isAdmin({ role: "ADMIN" })).toBe(true);
    expect(isAdmin({ role: "USER" })).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });
});
