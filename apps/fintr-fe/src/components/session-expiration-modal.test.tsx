import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

const mockLogout = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/home",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ logout: mockLogout }),
}));

import SessionExpirationModal from "./session-expiration-modal";
import { triggerSessionExpiration } from "@/lib/session-expiration-handler";

describe("SessionExpirationModal", () => {
  it("shows again for a later expiry after the first one was acknowledged", () => {
    render(<SessionExpirationModal />);

    act(() => triggerSessionExpiration());
    fireEvent.click(screen.getByRole("button", { name: "Okay" }));
    expect(mockLogout).toHaveBeenCalledOnce();
    expect(screen.queryByText("Session Expired")).not.toBeInTheDocument();

    act(() => triggerSessionExpiration());
    expect(screen.getByText("Session Expired")).toBeInTheDocument();
  });
});
