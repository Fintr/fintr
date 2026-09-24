import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import { ProFeatureGate } from "./pro-feature-gate";

const proState = vi.hoisted(() => ({
  data: undefined as
    | {
        pro: boolean;
        source: string;
        trialDaysRemaining: number;
      }
    | undefined,
  isPending: true,
  isPaused: false,
}));

vi.mock("@/hooks/async/useProAccess", () => ({
  useProAccess: () => proState,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

describe("ProFeatureGate", () => {
  beforeEach(() => {
    proState.data = undefined;
    proState.isPending = true;
    proState.isPaused = false;
  });

  it("waits while Pro access is still loading", () => {
    render(
      <ProFeatureGate featureName="Dashboard Insights">
        <p>Insights body</p>
      </ProFeatureGate>,
    );

    expect(screen.getByText("Checking Fintr Pro…")).toBeInTheDocument();
    expect(screen.queryByText("Insights body")).not.toBeInTheDocument();
  });

  it("keeps the feature locked when access is unknown offline", () => {
    proState.isPaused = true;

    render(
      <ProFeatureGate featureName="Dashboard Insights">
        <p>Insights body</p>
      </ProFeatureGate>,
    );

    expect(
      screen.getByText("Fintr Pro is required for Dashboard Insights"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Get Fintr Pro" })).toHaveAttribute(
      "href",
      "/dashboard/settings",
    );
    expect(screen.queryByText("Insights body")).not.toBeInTheDocument();
  });

  it("shows the feature during the trial", () => {
    proState.data = { pro: true, source: "trial", trialDaysRemaining: 6 };
    proState.isPending = false;

    render(
      <ProFeatureGate featureName="Dashboard Insights">
        <p>Insights body</p>
      </ProFeatureGate>,
    );

    expect(screen.getByText("Insights body")).toBeInTheDocument();
  });

  it("shows the feature when a Pro subscription is active", () => {
    proState.data = { pro: true, source: "subscription", trialDaysRemaining: 0 };
    proState.isPending = false;

    render(
      <ProFeatureGate featureName="Dashboard Insights">
        <p>Insights body</p>
      </ProFeatureGate>,
    );

    expect(screen.getByText("Insights body")).toBeInTheDocument();
  });

  it("locks the feature after the trial", () => {
    proState.data = { pro: false, source: "none", trialDaysRemaining: 0 };
    proState.isPending = false;

    render(
      <ProFeatureGate featureName="Dashboard Insights">
        <p>Insights body</p>
      </ProFeatureGate>,
    );

    expect(
      screen.getByText("Fintr Pro is required for Dashboard Insights"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Insights body")).not.toBeInTheDocument();
  });
});
