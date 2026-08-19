import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SkyApp } from "@/components/sky-app";
import { catalogObjectFixture } from "@/test/fixtures";

vi.mock("@/lib/orbit", () => ({
  objectsOverhead: () => [{
    noradId: catalogObjectFixture.noradId,
    objectName: catalogObjectFixture.objectName,
    elevationDegrees: 45,
    azimuthDegrees: 90,
    azimuthCompass: "E",
    rangeKm: 500,
    motion: "rising",
  }],
}));

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

    await user.click(screen.getByText("Choose a city or enter coordinates"));
    await user.clear(screen.getByLabelText("Latitude"));
    await user.type(screen.getByLabelText("Latitude"), "40.7128");
    await user.clear(screen.getByLabelText("Longitude"));
    await user.type(screen.getByLabelText("Longitude"), "-74.006");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("Manual location saved on this device.")).toBeVisible();
    expect(JSON.parse(window.localStorage.getItem("zenith-observer-v1") ?? "null")).toMatchObject({
      version: 3,
      observer: { latitude: 40.7128, longitude: -74.006 },
      source: "manual",
      accuracyMeters: null,
    });
  });

  it("retains the fallback when geolocation is denied", async () => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (_success: PositionCallback, error: PositionErrorCallback) => error({ code: 1 } as GeolocationPositionError),
      },
    });
    const user = userEvent.setup();
    render(<SkyApp />);

    await user.click(screen.getByText("Choose a city or enter coordinates"));
    await user.selectOptions(screen.getByLabelText("U.S. city"), "seattle-wa");
    await user.click(screen.getByRole("button", { name: "Use my location" }));
    expect(await screen.findByText(/manual coordinates remain active/i)).toBeVisible();
    expect(screen.getByText("Los Angeles fallback")).toBeVisible();
  });

  it.each([
    [2, /location was unavailable/i],
    [3, /precise location timed out/i],
  ])("explains geolocation error code %s", async (code, message) => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (_success: PositionCallback, error: PositionErrorCallback) => error({ code } as GeolocationPositionError),
      },
    });
    const user = userEvent.setup();
    render(<SkyApp />);
    await user.click(screen.getByRole("button", { name: "Use my location" }));
    expect(await screen.findByText(message)).toBeVisible();
  });

  it("requests one high-accuracy fix and saves its accuracy", async () => {
    const getCurrentPosition = vi.fn((...args: Parameters<Geolocation["getCurrentPosition"]>) => {
      const [success] = args;
      success({
        coords: { latitude: 32.71574, longitude: -117.16109, accuracy: 42 },
        timestamp: Date.parse("2026-08-19T01:00:00Z"),
      } as GeolocationPosition);
    });
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition },
    });
    const user = userEvent.setup();
    render(<SkyApp />);

    await user.click(screen.getByRole("button", { name: "Use my location" }));
    expect(getCurrentPosition).toHaveBeenCalledOnce();
    expect(getCurrentPosition.mock.calls[0][2]).toEqual({ enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 });
    expect(screen.getAllByText("Accurate to about 42 m").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Refresh location" })).toBeVisible();
    expect(screen.getByLabelText("U.S. city")).toHaveValue("");
    expect(JSON.parse(window.localStorage.getItem("zenith-observer-v1") ?? "null")).toEqual({
      version: 3,
      observer: { latitude: 32.71574, longitude: -117.16109 },
      source: "device",
      accuracyMeters: 42,
      capturedAt: "2026-08-19T01:00:00.000Z",
    });
  });

  it("warns when a device fix is coarse", async () => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition: (success: PositionCallback) => success({
        coords: { latitude: 34, longitude: -118, accuracy: 6_200 },
        timestamp: Date.now(),
      } as GeolocationPosition) },
    });
    const user = userEvent.setup();
    render(<SkyApp />);
    await user.click(screen.getByRole("button", { name: "Use my location" }));
    expect(screen.getByText(/approximate.*6\.2 km/i)).toBeVisible();
  });

  it("restores legacy coordinates and clears them back to the example fallback", async () => {
    window.localStorage.setItem("zenith-observer-v1", JSON.stringify({ latitude: 51.5074, longitude: -0.1278 }));
    const user = userEvent.setup();
    render(<SkyApp />);

    expect(await screen.findByText("Saved location")).toBeVisible();
    await user.click(screen.getByText("Choose a city or enter coordinates"));
    await user.click(screen.getByRole("button", { name: "Clear saved location" }));
    expect(screen.getByText("Los Angeles fallback")).toBeVisible();
    expect(window.localStorage.getItem("zenith-observer-v1")).toBeNull();
  });

  it("stages a city selection and applies it only when saved", async () => {
    const user = userEvent.setup();
    render(<SkyApp />);

    await user.click(screen.getByText("Choose a city or enter coordinates"));
    await user.selectOptions(screen.getByLabelText("U.S. city"), "san-francisco-ca");

    expect(screen.getByLabelText("Latitude")).toHaveValue("37.7749");
    expect(screen.getByLabelText("Longitude")).toHaveValue("-122.4194");
    expect(screen.getByText("Los Angeles fallback")).toBeVisible();
    expect(window.localStorage.getItem("zenith-observer-v1")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("San Francisco, CA city center")).toBeVisible();
    expect(JSON.parse(window.localStorage.getItem("zenith-observer-v1") ?? "null")).toMatchObject({
      version: 3,
      observer: { latitude: 37.7749, longitude: -122.4194 },
      source: "city",
      cityId: "san-francisco-ca",
      accuracyMeters: null,
    });
  });

  it("treats edited city coordinates as a manual location", async () => {
    const user = userEvent.setup();
    render(<SkyApp />);

    await user.click(screen.getByText("Choose a city or enter coordinates"));
    await user.selectOptions(screen.getByLabelText("U.S. city"), "new-york-ny");
    await user.clear(screen.getByLabelText("Latitude"));
    await user.type(screen.getByLabelText("Latitude"), "40.7");
    expect(screen.getByLabelText("U.S. city")).toHaveValue("");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(JSON.parse(window.localStorage.getItem("zenith-observer-v1") ?? "null")).toMatchObject({
      version: 3,
      source: "manual",
      observer: { latitude: 40.7, longitude: -74.006 },
    });
  });

  it("restores version 3 cities and version 2 locations", async () => {
    const savedAt = "2026-08-19T01:00:00.000Z";
    window.localStorage.setItem("zenith-observer-v1", JSON.stringify({
      version: 3,
      observer: { latitude: 47.6062, longitude: -122.3321 },
      source: "city",
      cityId: "seattle-wa",
      accuracyMeters: null,
      capturedAt: savedAt,
    }));
    const { unmount } = render(<SkyApp />);
    expect(await screen.findByText("Seattle, WA city center")).toBeVisible();
    const user = userEvent.setup();
    await user.click(screen.getByText("Choose a city or enter coordinates"));
    expect(screen.getByLabelText("U.S. city")).toHaveValue("seattle-wa");
    await user.click(screen.getByRole("button", { name: "Clear saved location" }));
    expect(screen.getByLabelText("U.S. city")).toHaveValue("");
    expect(screen.getByText("Los Angeles fallback")).toBeVisible();
    unmount();

    window.localStorage.setItem("zenith-observer-v1", JSON.stringify({
      version: 2,
      observer: { latitude: 32.7157, longitude: -117.1611 },
      source: "manual",
      accuracyMeters: null,
      capturedAt: savedAt,
    }));
    render(<SkyApp />);
    expect(await screen.findByText("Saved location")).toBeVisible();
  });

  it("preserves coordinates from an unrecognized saved city as manual", async () => {
    window.localStorage.setItem("zenith-observer-v1", JSON.stringify({
      version: 3,
      observer: { latitude: 41.5, longitude: -87.6 },
      source: "city",
      cityId: "retired-city-id",
      accuracyMeters: null,
      capturedAt: "2026-08-19T01:00:00.000Z",
    }));
    render(<SkyApp />);

    expect(await screen.findByText("Saved location")).toBeVisible();
    expect(screen.getByText("41.5000°, -87.6000°")).toBeVisible();
  });

  it("restarts Tonight calculations once when a staged city is saved", async () => {
    const worker = { postMessage: vi.fn(), terminate: vi.fn(), onmessage: null, onerror: null };
    const WorkerMock = vi.fn(() => worker);
    vi.stubGlobal("Worker", WorkerMock);
    const user = userEvent.setup();
    render(<SkyApp />);

    await user.click(await screen.findByRole("button", { name: /Tonight/ }));
    await waitFor(() => expect(WorkerMock).toHaveBeenCalledTimes(1));
    await user.click(screen.getByText("Choose a city or enter coordinates"));
    await user.selectOptions(screen.getByLabelText("U.S. city"), "dallas-tx");
    expect(WorkerMock).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(WorkerMock).toHaveBeenCalledTimes(2));
  });

  it("requests and stores a server-grounded dossier by NORAD ID", async () => {
    const dossier = {
      whatItIs: "A crewed orbital laboratory.",
      operator: "NASA and international partners",
      purpose: "Scientific research in low Earth orbit",
      story: "The station has hosted continuous crews for decades.",
      confidence: "high",
    };
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify(response), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(dossier), { status: 200 }));
    const user = userEvent.setup();
    render(<SkyApp />);

    await user.click(await screen.findByRole("button", { name: new RegExp(catalogObjectFixture.objectName, "i") }));
    expect(await screen.findByText("A crewed orbital laboratory.")).toBeVisible();
    expect(fetch).toHaveBeenLastCalledWith("/api/dossier", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ noradId: catalogObjectFixture.noradId }),
    }));
    expect(JSON.parse(window.localStorage.getItem(`zenith-dossier-${catalogObjectFixture.noradId}`) ?? "null")).toEqual(dossier);
  });
});
