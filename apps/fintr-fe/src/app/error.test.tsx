import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import RouteError from "./error";

const chunkLoadError = (): Error & { digest?: string } => {
  const error = new Error("Failed to fetch dynamically imported module") as Error & {
    digest?: string;
  };
  error.name = "ChunkLoadError";
  return error;
};

describe("app error boundary", () => {
  const reload = vi.fn();
  const replace = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("location", {
      reload,
      replace,
      pathname: "/dashboard/insights",
    });
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("does not show Loading the latest version when a chunk fails while offline", () => {
    vi.stubGlobal("navigator", { onLine: false });

    render(<RouteError error={chunkLoadError()} reset={vi.fn()} />);

    expect(
      screen.queryByText(/Loading the latest version/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Updating Fintr/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/A new version of Fintr is available/i),
    ).not.toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
  });

  it("does not show a chunk dump while offline; opens the cached home shell instead", () => {
    vi.stubGlobal("navigator", { onLine: false });
    const error = chunkLoadError();
    error.message =
      "Failed to load chunk /_next/static/chunks/10v6t4z48uztl.js from module 545109";

    render(<RouteError error={error} reset={vi.fn()} />);

    expect(screen.queryByText(/Failed to load chunk/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Try Again/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Reload Page/i)).not.toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith("/dashboard/home");
  });

  it("does not stay on the latest-version screen when recovery cannot reload", () => {
    sessionStorage.setItem("fintr_chunk_reload_at", String(Date.now()));

    render(<RouteError error={chunkLoadError()} reset={vi.fn()} />);

    expect(
      screen.queryByText(/Loading the latest version/i),
    ).not.toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
  });
});
