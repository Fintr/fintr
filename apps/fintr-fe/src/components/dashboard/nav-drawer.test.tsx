import { render, screen } from "@testing-library/react";
import { Settings } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

const authUser = vi.hoisted(() => ({
  name: "Miko Dagatan",
  picture: undefined as string | undefined,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({
    resolvedTheme: "dark",
    setTheme: vi.fn(),
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: authUser }),
}));

vi.mock("@/components/space/space-switcher", () => ({
  SpaceSwitcher: () => <div>Current Space</div>,
}));

vi.mock("@/lib/sync-theme-to-native", () => ({
  applyThemeWithNativeSync: vi.fn(),
}));

import NavDrawer from "./nav-drawer";

describe("NavDrawer theme row", () => {
  it("aligns the dark mode icon and label with the other menu items", () => {
    render(
      <NavDrawer
        open
        onClose={() => {}}
        onLogout={() => {}}
        isMobile={false}
        navItems={[
          {
            title: "Settings",
            href: "/settings",
            icon: Settings,
          },
        ]}
      />,
    );

    const settingsLink = screen.getByRole("link", { name: "Settings" });
    const settingsIcon = settingsLink.querySelector("svg");
    const darkModeLabel = screen.getByText("Dark Mode");
    const darkModeRow = darkModeLabel.closest("div");
    const darkModeIcon = darkModeRow?.querySelector("svg");

    expect(settingsIcon).toHaveClass("h-4", "w-4", "mr-2");
    expect(settingsLink).toHaveClass("gap-2", "items-center");
    expect(darkModeIcon).toHaveClass("h-4", "w-4", "mr-2");
    expect(darkModeRow).toHaveClass("gap-2", "items-center");
    expect(darkModeRow?.querySelector("[data-slot=switch]")).toBeTruthy();
  });
});

describe("NavDrawer user row", () => {
  it("shows the profile photo in place of the generic user icon", () => {
    authUser.picture = "https://cdn.example/miko.png";

    render(
      <NavDrawer
        open
        onClose={() => {}}
        onLogout={() => {}}
        isMobile={false}
        navItems={[]}
      />,
    );

    const userButton = screen.getByRole("button", { name: "Miko Dagatan" });
    const photo = userButton.querySelector("img");

    expect(photo).toHaveAttribute("src", "https://cdn.example/miko.png");
    expect(photo).toHaveClass("h-5", "w-5", "mr-2", "rounded-full");
    expect(userButton.querySelector("svg")).toBeNull();
  });
});
