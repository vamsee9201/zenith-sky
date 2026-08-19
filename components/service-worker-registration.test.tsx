import { render, waitFor } from "@testing-library/react";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";

describe("ServiceWorkerRegistration", () => {
  it("registers the same-origin worker at the app root", async () => {
    const register = vi.fn().mockResolvedValue({});
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { register },
    });
    render(<ServiceWorkerRegistration />);
    await waitFor(() => expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/" }));
    Reflect.deleteProperty(navigator, "serviceWorker");
  });
});
