import manifest from "@/app/manifest";

describe("PWA manifest", () => {
  it("is standalone and provides install icons", () => {
    const value = manifest();
    expect(value.display).toBe("standalone");
    expect(value.start_url).toBe("/");
    expect(value.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ sizes: "192x192" }),
      expect.objectContaining({ sizes: "512x512" }),
    ]));
  });
});
