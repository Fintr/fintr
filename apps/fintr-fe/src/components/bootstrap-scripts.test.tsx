import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const insertedCallbacks: Array<() => ReactNode> = [];

vi.mock("next/navigation", () => ({
  useServerInsertedHTML: (callback: () => ReactNode) => {
    insertedCallbacks.push(callback);
  },
}));

vi.mock("@/lib/kiron-blogger", () => ({
  shouldLoadKironBlogger: () => false,
}));

import { BootstrapScripts } from "./bootstrap-scripts";

function scriptIds(node: ReactNode): string[] {
  const collected: string[] = [];

  const visit = (value: ReactNode) => {
    if (!value || typeof value !== "object") {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    const element = value as { props?: { id?: string; children?: ReactNode } };

    if (element.props?.id) {
      collected.push(element.props.id);
    }

    visit(element.props?.children);
  };

  visit(node);
  return collected;
}

describe("BootstrapScripts", () => {
  it("inserts bootstrap scripts only once across streaming flushes", () => {
    insertedCallbacks.length = 0;

    render(<BootstrapScripts serviceWorkerUrl="/sw-dev.js" />);

    expect(insertedCallbacks).toHaveLength(1);

    const first = insertedCallbacks[0]();
    const second = insertedCallbacks[0]();

    expect(first).not.toBeNull();
    expect(second).toBeNull();
  });

  it("does not inject Kirón blogger on the marketing homepage by default", () => {
    insertedCallbacks.length = 0;

    render(<BootstrapScripts serviceWorkerUrl="/sw-dev.js" />);

    expect(scriptIds(insertedCallbacks[0]())).not.toContain(
      "fintr-blogger-connect",
    );
  });
});

