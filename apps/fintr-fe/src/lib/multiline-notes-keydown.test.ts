import { describe, it, expect, vi } from "vitest";
import type { KeyboardEvent } from "react";
import { handleMultilineNotesKeyDown } from "./multiline-notes-keydown";

const createMockEvent = (
  overrides: Partial<KeyboardEvent<HTMLTextAreaElement>> & {
    currentTarget?: HTMLTextAreaElement;
  },
): KeyboardEvent<HTMLTextAreaElement> => {
  const preventDefault = vi.fn();
  const blur = vi.fn();
  const el = (overrides.currentTarget ??
    ({ blur } as unknown as HTMLTextAreaElement)) as HTMLTextAreaElement;
  return {
    key: "Enter",
    shiftKey: false,
    preventDefault,
    currentTarget: el,
    ...overrides,
  } as unknown as KeyboardEvent<HTMLTextAreaElement>;
};

describe("handleMultilineNotesKeyDown", () => {
  it("calls preventDefault and blurs the textarea on Enter without Shift", () => {
    const blur = vi.fn();
    const el = { blur } as unknown as HTMLTextAreaElement;
    const event = createMockEvent({ currentTarget: el });

    handleMultilineNotesKeyDown(event);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(blur).toHaveBeenCalledTimes(1);
  });

  it("does nothing on Shift+Enter", () => {
    const blur = vi.fn();
    const el = { blur } as unknown as HTMLTextAreaElement;
    const event = createMockEvent({
      currentTarget: el,
      shiftKey: true,
    });

    handleMultilineNotesKeyDown(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(blur).not.toHaveBeenCalled();
  });

  it("ignores non-Enter keys", () => {
    const blur = vi.fn();
    const el = { blur } as unknown as HTMLTextAreaElement;
    const event = createMockEvent({
      currentTarget: el,
      key: "a",
    });

    handleMultilineNotesKeyDown(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(blur).not.toHaveBeenCalled();
  });
});
