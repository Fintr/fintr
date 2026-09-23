import { render, screen } from "@testing-library/react";

import PricingSection from "./pricing-section";

describe("PricingSection", () => {
  it("shows the monthly and yearly Pro prices", () => {
    render(<PricingSection />);

    expect(screen.getByText("₱100")).toBeInTheDocument();
    expect(screen.getByText("per month")).toBeInTheDocument();
    expect(screen.getByText("or ₱1,000 per year")).toBeInTheDocument();
  });
});
