import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { FloatingInput } from "./floating-input";

describe("FloatingInput", () => {
  afterEach(() => {
    cleanup();
  });

  it("uses foreground text and primary-dark-mode accent when focused in dark mode", () => {
    const { container } = render(
      <FloatingInput label="Monthly Income" />,
    );

    const input = container.querySelector("input");
    const label = container.querySelector("label");

    expect(input?.className).toContain("text-foreground");
    expect(input?.className).toContain("dark:focus:border-primary-dark-mode");
    expect(label?.className).toContain("dark:peer-focus:text-primary-dark-mode");
  });
});
