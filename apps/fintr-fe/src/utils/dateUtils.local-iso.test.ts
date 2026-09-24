import { describe, expect, it } from "vitest";

import { getLocalIsoDateKey } from "./dateUtils";

describe("getLocalIsoDateKey", () => {
  it("keeps YYYY-MM-DD strings as-is", () => {
    expect(getLocalIsoDateKey("2026-08-08")).toBe("2026-08-08");
  });

  it("uses the date segment from ISO datetimes", () => {
    expect(getLocalIsoDateKey("2026-08-08T16:00:00.000Z")).toBe("2026-08-08");
  });
});
