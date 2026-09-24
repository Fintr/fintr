import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PRO_FEATURES } from "@/lib/pro-features";

import PricingSection from "./pricing-section";

describe("PricingSection", () => {
  it("shows monthly Pro price by default and yearly when toggled on", async () => {
    const user = userEvent.setup();
    render(<PricingSection />);

    expect(screen.getByText("₱100")).toBeInTheDocument();
    expect(screen.getByText("per month")).toBeInTheDocument();
    expect(screen.queryByText("₱1,000")).not.toBeInTheDocument();
    expect(screen.queryByText("per year")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("switch", {
        name: "Toggle between monthly and yearly Fintr Pro pricing",
      }),
    );

    expect(screen.getByText("₱1,000")).toBeInTheDocument();
    expect(screen.getByText("per year")).toBeInTheDocument();
    expect(screen.getByText("Save 17%")).toBeInTheDocument();
    expect(screen.queryByText("₱100")).not.toBeInTheDocument();
    expect(screen.queryByText("per month")).not.toBeInTheDocument();
  });

  it("hides the yearly savings badge when monthly is selected", () => {
    render(<PricingSection />);

    expect(screen.queryByText("Save 17%")).not.toBeInTheDocument();
  });

  it("lists each Pro feature", () => {
    render(<PricingSection />);

    for (const feature of PRO_FEATURES) {
      expect(screen.getByText(feature.name)).toBeInTheDocument();
      expect(screen.getByText(feature.description)).toBeInTheDocument();
    }
  });
});
