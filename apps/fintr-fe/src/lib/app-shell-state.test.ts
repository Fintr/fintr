import { afterEach, describe, expect, it } from "vitest";

import {
  clearAppShellReadyForTests,
  hasAppShellReady,
  markAppShellReady,
} from "./app-shell-state";

describe("app-shell-state", () => {
  afterEach(() => {
    clearAppShellReadyForTests();
  });

  it("starts false until the shell is marked ready", () => {
    expect(hasAppShellReady()).toBe(false);
    markAppShellReady();
    expect(hasAppShellReady()).toBe(true);
  });
});
