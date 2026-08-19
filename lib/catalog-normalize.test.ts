import { joinCatalog } from "@/lib/catalog-normalize";
import { rawOmmArraySchema, rawSatcatArraySchema } from "@/lib/schemas";
import { rawOmmFixture, rawSatcatFixture } from "@/test/fixtures";

describe("catalog normalization", () => {
  it("joins OMM and SATCAT records and normalizes blank values", () => {
    const omm = rawOmmArraySchema.parse([rawOmmFixture]);
    const satcat = rawSatcatArraySchema.parse([rawSatcatFixture]);
    const [object] = joinCatalog(omm, satcat);

    expect(object.noradId).toBe("694");
    expect(object.omm.epoch).toBe("2026-08-18T11:19:41.098944Z");
    expect(object.metadata?.owner).toBe("US");
    expect(object.metadata?.operationalStatus).toBeNull();
  });

  it("preserves six-digit catalog numbers as strings", () => {
    const omm = rawOmmArraySchema.parse([{ ...rawOmmFixture, NORAD_CAT_ID: 100178 }]);
    const [object] = joinCatalog(omm, []);
    expect(object.noradId).toBe("100178");
    expect(object.metadata).toBeNull();
  });
});

