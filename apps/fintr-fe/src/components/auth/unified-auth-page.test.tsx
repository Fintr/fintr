import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DEFAULT_AUTHENTICATED_PATH } from "@/lib/auth-routes";

const mockAssign = vi.fn();
const mockReplace = vi.fn();
const mockPush = vi.fn();
const mockUseAuth = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/lib/auth-storage", () => ({
  AuthStorage: {
    isAuthenticated: vi.fn(() => true),
  },
}));

import { AuthStorage } from "@/lib/auth-storage";

vi.mock("@/lib/capacitor", () => ({
  isNativeCapacitor: () => false,
}));

vi.mock("@/lib/capacitor-bridge-init", () => ({
  initCapacitorBridgeIfNeeded: vi.fn(),
}));

vi.mock("@/services/auth/modal-google-signin", () => ({
  smartInAppBrowserGoogleSignIn: vi.fn(),
}));

vi.mock("@/services/auth/in-app-apple-signin", () => ({
  smartAppleSignIn: vi.fn(),
}));

describe("UnifiedAuthPage post-login redirect", () => {
  beforeEach(() => {
    mockAssign.mockReset();
    mockReplace.mockReset();
    mockPush.mockReset();
    vi.mocked(AuthStorage.isAuthenticated).mockReturnValue(true);
    vi.stubGlobal("location", {
      pathname: "/login",
      assign: mockAssign,
    });
    mockUseAuth.mockReturnValue({
      login: vi.fn(),
      signup: vi.fn(),
      isAuthenticated: false,
      isLoading: false,
    });
  });

  it("does not redirect while the user is logged out", async () => {
    const UnifiedAuthPage = (await import("./unified-auth-page")).default;
    render(<UnifiedAuthPage isLogin={true} />);

    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockAssign).not.toHaveBeenCalled();
  });

  it("redirects authenticated users to Home instead of Transactions", async () => {
    mockUseAuth.mockReturnValue({
      login: vi.fn(),
      signup: vi.fn(),
      isAuthenticated: true,
      isLoading: false,
    });

    const UnifiedAuthPage = (await import("./unified-auth-page")).default;
    render(<UnifiedAuthPage isLogin={true} />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(DEFAULT_AUTHENTICATED_PATH);
    });
    expect(mockReplace).toHaveBeenCalledWith("/dashboard/home");
    expect(mockAssign).not.toHaveBeenCalled();
  });

  it("falls back to a hard navigation when client routing stays on login", async () => {
    vi.useFakeTimers();

    mockUseAuth.mockReturnValue({
      login: vi.fn(),
      signup: vi.fn(),
      isAuthenticated: true,
      isLoading: false,
    });

    const UnifiedAuthPage = (await import("./unified-auth-page")).default;
    render(<UnifiedAuthPage isLogin={true} />);

    expect(mockReplace).toHaveBeenCalledWith(DEFAULT_AUTHENTICATED_PATH);

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(mockAssign).toHaveBeenCalledWith(DEFAULT_AUTHENTICATED_PATH);

    vi.useRealTimers();
  });

  it("stays on login when storage has no valid session", async () => {
    vi.mocked(AuthStorage.isAuthenticated).mockReturnValue(false);

    mockUseAuth.mockReturnValue({
      login: vi.fn(),
      signup: vi.fn(),
      isAuthenticated: true,
      isLoading: false,
    });

    const UnifiedAuthPage = (await import("./unified-auth-page")).default;
    render(<UnifiedAuthPage isLogin={true} />);

    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockAssign).not.toHaveBeenCalled();
  });

  it("shows the signup form as soon as Sign up is clicked", async () => {
    const UnifiedAuthPage = (await import("./unified-auth-page")).default;
    render(<UnifiedAuthPage isLogin={true} />);

    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));

    expect(screen.getByLabelText(/First Name/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Account" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
    expect(mockPush).toHaveBeenCalledWith("/signup");
  });
});
