import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "./error-boundary";

const Throw = ({ message }: { message: string }) => {
  throw new Error(message);
};

describe("ErrorBoundary", () => {
  it("renders children when there is no error", () => {
    render(
      <ErrorBoundary>
        <span>ok</span>
      </ErrorBoundary>
    );

    expect(screen.getByText("ok")).toBeInTheDocument();
  });

  it("renders fallback when a child throws", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Throw message="boom" />
      </ErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("boom")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reload app/i })).toBeInTheDocument();

    spy.mockRestore();
  });
});
