import { render, screen } from "@testing-library/react";
import { SkyDome } from "@/components/sky-dome";

describe("SkyDome", () => {
  it("plots current objects from their list azimuth and elevation", () => {
    render(<SkyDome overhead={[{
      noradId: "100001",
      objectName: "Six digit test",
      azimuthDegrees: 0,
      azimuthCompass: "N",
      elevationDegrees: 90,
      rangeKm: 500,
      motion: "steady",
    }]} />);
    expect(screen.getByRole("img", { name: /North-up sky dome/ })).toBeVisible();
    expect(screen.getByText("Six digit test, 90° N")).toBeInTheDocument();
  });
});
