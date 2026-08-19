import { getCatalog, resetCatalogCacheForTests } from "@/lib/server/catalog";
import { rawOmmFixture, rawSatcatFixture } from "@/test/fixtures";

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("CelesTrak catalog cache", () => {
  beforeEach(() => resetCatalogCacheForTests());

  it("coalesces concurrent refreshes and joins both feeds", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse([rawOmmFixture]))
      .mockResolvedValueOnce(jsonResponse([rawSatcatFixture]));
    const sleep = vi.fn(async () => undefined);

    const [first, second] = await Promise.all([
      getCatalog({ fetcher, sleep }),
      getCatalog({ fetcher, sleep }),
    ]);

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalled();
    expect(first.objects[0].metadata?.owner).toBe("US");
    expect(second.objects).toEqual(first.objects);
  });

  it("serves stale data when an expired refresh fails", async () => {
    const initialFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse([rawOmmFixture]))
      .mockResolvedValueOnce(jsonResponse([rawSatcatFixture]));
    const sleep = async () => undefined;
    const initial = await getCatalog({ fetcher: initialFetch, sleep });

    const failedFetch = vi.fn<typeof fetch>().mockRejectedValue(new Error("upstream offline"));
    const stale = await getCatalog({
      now: Date.now() + 25 * 60 * 60 * 1000,
      fetcher: failedFetch,
      sleep,
    });

    expect(stale.stale).toBe(true);
    expect(stale.objects).toEqual(initial.objects);
    expect(failedFetch).toHaveBeenCalledTimes(2);
  });

  it("fails closed on malformed upstream data without a cache", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse([{ OBJECT_NAME: "broken" }]))
      .mockResolvedValueOnce(jsonResponse([rawSatcatFixture]));

    await expect(getCatalog({ fetcher, sleep: async () => undefined })).rejects.toThrow();
  });
});

