import { describe, expect, it } from "vitest";

import { shouldLoadKironBlogger } from "./kiron-blogger";

describe("shouldLoadKironBlogger", () => {
  it("does not load on localhost development unless explicitly enabled", () => {
    expect(shouldLoadKironBlogger("development")).toBe(false);
    expect(shouldLoadKironBlogger("test")).toBe(false);
  });

  it("loads in production so fintr.ai can still ingest the marketing shell", () => {
    expect(shouldLoadKironBlogger("production")).toBe(true);
  });

  it("honors an explicit NEXT_PUBLIC_KIRON_BLOGGER override", () => {
    expect(shouldLoadKironBlogger("development", "true")).toBe(true);
    expect(shouldLoadKironBlogger("production", "false")).toBe(false);
  });
});
