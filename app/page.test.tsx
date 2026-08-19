import { render, screen } from "@testing-library/react";
import Home from "./page";

describe("launch page", () => {
  it("explains the product", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { name: "Look up." })).toBeInTheDocument();
    expect(screen.getByText(/satellites overhead/i)).toBeInTheDocument();
  });
});

