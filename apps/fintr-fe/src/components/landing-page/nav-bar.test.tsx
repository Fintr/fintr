import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DEFAULT_AUTHENTICATED_PATH } from "@/lib/auth-routes";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: true,
  }),
}));

vi.mock("next/image", () => ({
  default: (props: { alt?: string }) => <img alt={props.alt ?? ""} />,
}));

describe("Landing navbar authenticated CTA", () => {
  it("sends logged-in users to Home instead of Transactions", async () => {
    const Navbar = (await import("./nav-bar")).default;
    render(<Navbar />);

    const dashboardLink = screen.getByRole("link", { name: "Dashboard" });
    expect(dashboardLink).toHaveAttribute("href", DEFAULT_AUTHENTICATED_PATH);
    expect(dashboardLink).toHaveAttribute("href", "/dashboard/home");
    expect(dashboardLink).not.toHaveAttribute("href", "/dashboard");
  });
});
