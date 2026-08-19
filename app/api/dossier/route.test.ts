vi.mock("@/lib/server/dossier", () => ({
  getDossier: vi.fn(async (noradId: string) => noradId === "694" ? {
    whatItIs: "A payload in Earth orbit.", operator: "United States", purpose: null,
    story: "A concise grounded story.", confidence: "high",
  } : null),
}));

import { POST } from "@/app/api/dossier/route";

describe("POST /api/dossier", () => {
  it("rejects client-supplied metadata and malformed IDs", async () => {
    const response = await POST(new Request("http://localhost/api/dossier", {
      method: "POST",
      body: JSON.stringify({ noradId: "694", owner: "forged" }),
    }));
    expect(response.status).toBe(400);
  });

  it("returns a structured dossier for a catalog object", async () => {
    const response = await POST(new Request("http://localhost/api/dossier", {
      method: "POST",
      body: JSON.stringify({ noradId: "694" }),
    }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ confidence: "high" });
  });

  it("returns 404 for an object outside the visual catalog", async () => {
    const response = await POST(new Request("http://localhost/api/dossier", {
      method: "POST",
      body: JSON.stringify({ noradId: "999999" }),
    }));
    expect(response.status).toBe(404);
  });
});

