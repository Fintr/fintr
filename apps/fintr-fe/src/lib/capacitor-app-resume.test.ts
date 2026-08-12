import { afterEach, describe, expect, it, vi } from "vitest";

import { subscribeCapacitorAppResume } from "./capacitor-app-resume";

const mockAddListener = vi.fn();
const mockRemove = vi.fn();

vi.mock("@capacitor/app", () => ({
  App: {
    addListener: (...args: unknown[]) => mockAddListener(...args),
  },
}));

vi.mock("@/lib/capacitor", () => ({
  isNativeCapacitor: vi.fn(),
}));

import { isNativeCapacitor } from "@/lib/capacitor";

describe("subscribeCapacitorAppResume", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.mocked(isNativeCapacitor).mockReset();
  });

  it("does not register a listener on web builds", () => {
    vi.mocked(isNativeCapacitor).mockReturnValue(false);

    const unsubscribe = subscribeCapacitorAppResume(vi.fn());
    unsubscribe();

    expect(mockAddListener).not.toHaveBeenCalled();
  });

  it("calls onResume when the native app becomes active", async () => {
    vi.mocked(isNativeCapacitor).mockReturnValue(true);
    mockAddListener.mockResolvedValue({ remove: mockRemove });

    const onResume = vi.fn();
    subscribeCapacitorAppResume(onResume);

    await vi.waitFor(() => {
      expect(mockAddListener).toHaveBeenCalledWith(
        "appStateChange",
        expect.any(Function),
      );
    });

    const handler = mockAddListener.mock.calls[0]?.[1] as (state: {
      isActive: boolean;
    }) => void;

    handler({ isActive: false });
    expect(onResume).not.toHaveBeenCalled();

    handler({ isActive: true });
    expect(onResume).toHaveBeenCalledOnce();
  });

  it("removes the listener on unsubscribe", async () => {
    vi.mocked(isNativeCapacitor).mockReturnValue(true);
    mockAddListener.mockResolvedValue({ remove: mockRemove });

    const unsubscribe = subscribeCapacitorAppResume(vi.fn());

    await vi.waitFor(() => {
      expect(mockAddListener).toHaveBeenCalled();
    });

    unsubscribe();

    expect(mockRemove).toHaveBeenCalled();
  });
});
