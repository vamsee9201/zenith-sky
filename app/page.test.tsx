import { render, screen } from "@testing-library/react";
import Home from "./page";
import { catalogObjectFixture } from "@/test/fixtures";

const catalogResponse = {
  updatedAt: "2026-08-18T11:19:41.098Z",
  stale: false,
  objects: [catalogObjectFixture],
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(JSON.stringify(catalogResponse), { status: 200 })),
  );
  window.localStorage.clear();
});

afterEach(() => vi.unstubAllGlobals());

describe("launch page", () => {
  it("explains the product", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { name: "What's up there?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use my location" })).toBeInTheDocument();
  });
});
