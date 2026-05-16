import { describe, it, expect } from "vitest";

import { supportTicketDetailHref } from "./support-ticket-routes";

describe("supportTicketDetailHref", () => {
  it("builds a path under /crm/requests/ticket with id query for static export", () => {
    const id = "cd6098bb-7c4c-47d5-80ab-38bcb23e83e1";
    expect(supportTicketDetailHref(id)).toBe(
      "/crm/requests/ticket?id=cd6098bb-7c4c-47d5-80ab-38bcb23e83e1",
    );
  });

  it("encodes characters that would break query strings", () => {
    expect(supportTicketDetailHref("a&b=c")).toBe(
      "/crm/requests/ticket?id=a%26b%3Dc",
    );
    expect(supportTicketDetailHref("one two")).toBe(
      "/crm/requests/ticket?id=one%20two",
    );
  });
});
