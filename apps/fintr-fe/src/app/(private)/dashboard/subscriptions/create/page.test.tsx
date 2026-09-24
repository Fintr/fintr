import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
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

vi.mock("@/hooks/useNativeCheckoutGate", () => ({
  useNativeCheckoutGate: () => "web",
}));

vi.mock("@/hooks/async/useSubscriptions", () => ({
  useSubscriptionPlans: () => ({
    plans: [
      {
        id: "plan-monthly",
        slug: "pro_monthly",
        name: "Pro Monthly",
        description: "Billed every month",
        priceCents: 10_000,
        priceCurrency: "PHP",
        interval: "month",
      },
      {
        id: "plan-yearly",
        slug: "pro_yearly",
        name: "Pro Yearly",
        description: "Billed every year",
        priceCents: 100_000,
        priceCurrency: "PHP",
        interval: "year",
      },
    ],
    isLoading: false,
    isError: false,
    error: null,
  }),
  useCreateSubscription: () => ({
    createSubscription: vi.fn(),
    isCreating: false,
    data: null,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import CreateSubscriptionPage from "./page";

describe("create subscription page", () => {
  it("shows the yearly savings on the yearly plan", () => {
    render(<CreateSubscriptionPage />);

    expect(screen.getByText("saves 17%")).toBeInTheDocument();
  });
});
