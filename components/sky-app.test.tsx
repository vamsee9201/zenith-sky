import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SkyApp } from "@/components/sky-app";
import { catalogObjectFixture } from "@/test/fixtures";

const response = {
  updatedAt: "2026-08-18T11:19:41.098Z",
  stale: false,
  objects: [catalogObjectFixture],
};

let originalGeolocation: PropertyDescriptor | undefined;

beforeEach(() => {
  originalGeolocation = Object.getOwnPropertyDescriptor(navigator, "geolocation");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(JSON.stringify(response), { status: 200 })),
  );
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalGeolocation) {
    Object.defineProperty(navigator, "geolocation", originalGeolocation);
  } else {
    Reflect.deleteProperty(navigator, "geolocation");
  }
});

describe("SkyApp location controls", () => {
  it("keeps the manual observer location on the device", async () => {
    const user = userEvent.setup();
    render(<SkyApp />);

    await user.click(screen.getByText("Enter coordinates"));
    await user.clear(screen.getByLabelText("Latitude"));
    await user.type(screen.getByLabelText("Latitude"), "40.7128");
    await user.clear(screen.getByLabelText("Longitude"));
    await user.type(screen.getByLabelText("Longitude"), "-74.006");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("Manual location saved on this device.")).toBeVisible();
    expect(JSON.parse(window.localStorage.getItem("zenith-observer-v1") ?? "null")).toEqual({
      latitude: 40.7128,
      longitude: -74.006,
    });
  });

  it("retains the fallback when geolocation is denied", async () => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (_success: PositionCallback, error: PositionErrorCallback) => error({} as GeolocationPositionError),
      },
    });
    const user = userEvent.setup();
    render(<SkyApp />);

    await user.click(screen.getByRole("button", { name: "Use my location" }));
    expect(await screen.findByText(/manual coordinates remain active/i)).toBeVisible();
    expect(screen.getByText("Los Angeles fallback")).toBeVisible();
  });
});

