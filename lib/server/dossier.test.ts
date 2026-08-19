import { createDossierPrompt, enforceCatalogUncertainty } from "@/lib/server/dossier";
import { dossierSchema } from "@/lib/dossier-schema";
import { catalogObjectFixture } from "@/test/fixtures";

describe("grounded dossier generation", () => {
  it("includes every authoritative field and anti-confabulation rules", () => {
    const prompt = createDossierPrompt(catalogObjectFixture);
    expect(prompt).toContain("norad_id: 694");
    expect(prompt).toContain("object_type: PAY");
    expect(prompt).toContain("country_of_origin: US");
    expect(prompt).toContain("never invent a mission");
  });

  it("accepts explicit uncertainty for obscure debris", () => {
    expect(dossierSchema.parse({
      whatItIs: "An unidentified fragment in low Earth orbit.",
      operator: null,
      purpose: null,
      story: "The catalog does not identify its source mission. Its orbit is the only reliable context available.",
      confidence: "low",
    }).confidence).toBe("low");
  });

  it("rejects malformed or overconfident output shapes", () => {
    expect(() => dossierSchema.parse({ whatItIs: "Unknown", confidence: "certain" })).toThrow();
  });

  it("forces generic rocket bodies to retain nulls and low confidence", () => {
    const generic = {
      ...catalogObjectFixture,
      objectName: "SL-3 R/B",
      metadata: { ...catalogObjectFixture.metadata!, objectType: "R/B" as const },
    };
    expect(enforceCatalogUncertainty(generic, {
      whatItIs: "A spent rocket body.",
      operator: "A guessed operator",
      purpose: "A guessed mission",
      story: "The orbit and launch date are known, while its source mission is not identified.",
      confidence: "high",
    })).toMatchObject({ operator: null, purpose: null, confidence: "low" });
  });
});
