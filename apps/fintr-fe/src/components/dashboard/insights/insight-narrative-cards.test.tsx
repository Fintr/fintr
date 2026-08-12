import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { InsightNarrativeCards } from "./insight-narrative-cards";
import { InsightCard } from "@/services/insights/types";

const categorySpikeInsight: InsightCard = {
  type: "category_trend",
  severity: "warning",
  title: "Subscriptions & Hobbies spending up",
  body: "Subscriptions & Hobbies is 37.14% higher than the prior period.",
  actionLabel: "Filter transactions",
  actionHref: "/dashboard?category=Subscriptions+%26+Hobbies",
};

describe("InsightNarrativeCards", () => {
  it("links Filter transactions to the category query param", () => {
    render(<InsightNarrativeCards insights={[categorySpikeInsight]} />);

    const link = screen.getByRole("link", { name: "Filter transactions" });
    expect(link).toHaveAttribute(
      "href",
      "/dashboard?category=Subscriptions+%26+Hobbies",
    );
  });

  it("renders nothing when insights are empty", () => {
    const { container } = render(<InsightNarrativeCards insights={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders LinkedIn-style illustration for profile cards", () => {
    const profileInsight: InsightCard = {
      type: "profile",
      severity: "positive",
      title: "Strong Saver",
      body: "You retained 30.00% of income this period — outstanding buffer-building.",
      actionLabel: "View transactions",
      actionHref: "/dashboard",
      profileKey: "strong_saver",
      imageKey: "strong_saver",
    };

    render(<InsightNarrativeCards insights={[profileInsight]} />);

    expect(screen.getByText("Strong Saver")).toBeInTheDocument();
    expect(document.querySelector("img")).not.toBeNull();
    expect(
      screen.getByRole("link", { name: "View transactions" }),
    ).toHaveAttribute("href", "/dashboard");
  });
});
