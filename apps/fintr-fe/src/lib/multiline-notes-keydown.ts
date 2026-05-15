import type { KeyboardEvent } from "react";

export const handleMultilineNotesKeyDown = (
  event: KeyboardEvent<HTMLTextAreaElement>,
): void => {
  if (event.key !== "Enter") return;
  if (event.shiftKey) return;
  event.preventDefault();
  event.currentTarget.blur();
};
