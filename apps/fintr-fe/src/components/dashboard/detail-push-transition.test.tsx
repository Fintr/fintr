import { describe, it, expect, vi } from "vitest";

vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  return {
    ...actual,
    useReducedMotion: () => false,
  };
});
import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  DETAIL_PUSH_EASE,
  DETAIL_PUSH_DURATION_SEC,
  DashboardPushChildren,
  DetailPushNavigationProvider,
  DetailPushPanel,
  useDetailPushExit,
  useDetailPushPhase,
} from "./detail-push-transition";

describe("useDetailPushPhase", () => {
  it("starts in the enter phase", () => {
    const { result } = renderHook(() => useDetailPushPhase(false));

    expect(result.current.phase).toBe("enter");
  });

  it("plays exit then runs the callback after animation completes", () => {
    const then = vi.fn();
    const { result } = renderHook(() => useDetailPushPhase(false));

    act(() => {
      result.current.requestExit(then);
    });

    expect(result.current.phase).toBe("exit");
    expect(then).not.toHaveBeenCalled();

    act(() => {
      result.current.handleAnimationComplete();
    });

    expect(then).toHaveBeenCalledTimes(1);
  });

  it("skips exit motion when the user prefers reduced motion", () => {
    const then = vi.fn();
    const { result } = renderHook(() => useDetailPushPhase(true));

    act(() => {
      result.current.requestExit(then);
    });

    expect(result.current.phase).toBe("enter");
    expect(then).toHaveBeenCalledTimes(1);
  });

  it("does not run the enter-complete callback as navigation", () => {
    const then = vi.fn();
    const { result } = renderHook(() => useDetailPushPhase(false));

    act(() => {
      result.current.handleAnimationComplete();
    });

    expect(then).not.toHaveBeenCalled();
  });

  it("ignores an in-flight enter completion after exit has started", () => {
    const then = vi.fn();
    const { result } = renderHook(() => useDetailPushPhase(false));

    act(() => {
      result.current.requestExit(then);
    });

    act(() => {
      result.current.handleAnimationComplete({ x: 0 });
    });

    expect(then).not.toHaveBeenCalled();

    act(() => {
      result.current.handleAnimationComplete({ x: "100%" });
    });

    expect(then).toHaveBeenCalledTimes(1);
  });
});

describe("detail push motion constants", () => {
  it("stays within a 280ms enter budget", () => {
    expect(DETAIL_PUSH_DURATION_SEC).toBeLessThanOrEqual(0.28);
    expect(DETAIL_PUSH_DURATION_SEC).toBeGreaterThanOrEqual(0.2);
    expect(DETAIL_PUSH_EASE).toEqual([0.32, 0.72, 0, 1]);
  });
});

describe("DetailPushPanel with back", () => {
  const BackButton = () => {
    const { requestExit } = useDetailPushExit();

    return (
      <button type="button" onClick={() => requestExit(() => undefined)}>
        Go back
      </button>
    );
  };

  it("exposes the enter phase on the content panel", () => {
    render(
      <DetailPushNavigationProvider>
        <DetailPushPanel>
          <p>Transaction body</p>
        </DetailPushPanel>
      </DetailPushNavigationProvider>,
    );

    expect(screen.getByTestId("detail-push-panel")).toHaveAttribute(
      "data-detail-push",
      "enter",
    );
    expect(screen.getByText("Transaction body")).toBeInTheDocument();
  });

  it("falls back to immediate back when no panel is mounted", async () => {
    const user = userEvent.setup();
    const then = vi.fn();

    const OrphanBack = () => {
      const { requestExit } = useDetailPushExit();
      return (
        <button type="button" onClick={() => requestExit(then)}>
          Go back
        </button>
      );
    };

    render(
      <DetailPushNavigationProvider>
        <OrphanBack />
      </DetailPushNavigationProvider>,
    );

    await user.click(screen.getByRole("button", { name: /go back/i }));

    expect(then).toHaveBeenCalledTimes(1);
  });

  it("lets the header request an exit while the panel is mounted", async () => {
    const user = userEvent.setup();

    render(
      <DetailPushNavigationProvider>
        <BackButton />
        <DetailPushPanel>
          <p>Transaction body</p>
        </DetailPushPanel>
      </DetailPushNavigationProvider>,
    );

    await user.click(screen.getByRole("button", { name: /go back/i }));

    expect(screen.getByTestId("detail-push-panel")).toHaveAttribute(
      "data-detail-push",
      "exit",
    );
  });
});

describe("DashboardPushChildren", () => {
  it("does not wrap tab screens that hide back until scroll", () => {
    render(
      <DetailPushNavigationProvider>
        <DashboardPushChildren pathname="/dashboard/">
          <p>Transactions list</p>
        </DashboardPushChildren>
      </DetailPushNavigationProvider>,
    );

    expect(screen.queryByTestId("detail-push-panel")).not.toBeInTheDocument();
    expect(screen.getByText("Transactions list")).toBeInTheDocument();
  });

  it("remounts an enter-phase panel when query params change after back", async () => {
    const user = userEvent.setup();
    const ExitTrigger = () => {
      const { requestExit } = useDetailPushExit();

      return (
        <button type="button" onClick={() => requestExit(() => undefined)}>
          Go back
        </button>
      );
    };

    const view = (search: string) => (
      <DetailPushNavigationProvider>
        <ExitTrigger />
        <DashboardPushChildren
          pathname="/dashboard/space_settings/categories/detail"
          search={search}
        >
          <p>Category body</p>
        </DashboardPushChildren>
      </DetailPushNavigationProvider>
    );

    const { rerender } = render(view("categoryId=child&kind=expense"));

    await user.click(screen.getByRole("button", { name: /go back/i }));

    expect(screen.getByTestId("detail-push-panel")).toHaveAttribute(
      "data-detail-push",
      "exit",
    );

    rerender(view("categoryId=parent&kind=expense"));

    expect(screen.getByTestId("detail-push-panel")).toHaveAttribute(
      "data-detail-push",
      "enter",
    );
    expect(screen.getByText("Category body")).toBeInTheDocument();
  });

  it("wraps every immediate-back nested screen", () => {
    const pathnames = [
      "/dashboard/transactions/detail",
      "/dashboard/loans",
      "/dashboard/loans/detail",
      "/dashboard/space_settings/accounts",
      "/dashboard/space_settings/accounts/detail",
      "/dashboard/space_settings/categories",
      "/dashboard/space_settings/categories/detail",
      "/dashboard/space_settings/tags",
      "/dashboard/space_settings/entities",
      "/dashboard/space_settings/entities/detail",
      "/dashboard/space_settings/import",
      "/dashboard/space_settings/subscriptions",
    ];

    const { rerender } = render(
      <DetailPushNavigationProvider>
        <DashboardPushChildren pathname={pathnames[0]}>
          <p>Nested screen</p>
        </DashboardPushChildren>
      </DetailPushNavigationProvider>,
    );

    for (const pathname of pathnames) {
      rerender(
        <DetailPushNavigationProvider>
          <DashboardPushChildren pathname={pathname}>
            <p>Nested screen</p>
          </DashboardPushChildren>
        </DetailPushNavigationProvider>,
      );

      expect(
        screen.getByTestId("detail-push-panel"),
        pathname,
      ).toBeInTheDocument();
    }
  });
});
