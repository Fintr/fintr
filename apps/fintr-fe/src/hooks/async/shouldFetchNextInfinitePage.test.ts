import { describe, expect, it } from "vitest";
import { shouldFetchNextInfinitePage } from "./shouldFetchNextInfinitePage";

describe("shouldFetchNextInfinitePage", () => {
  it("fetches when the sentinel is visible and more pages are available", () => {
    expect(
      shouldFetchNextInfinitePage({
        isIntersecting: true,
        hasNextPage: true,
        isFetchingNextPage: false,
        isFetchNextPageError: false,
      }),
    ).toBe(true);
  });

  it("does not fetch while a next page request is already in flight", () => {
    expect(
      shouldFetchNextInfinitePage({
        isIntersecting: true,
        hasNextPage: true,
        isFetchingNextPage: true,
        isFetchNextPageError: false,
      }),
    ).toBe(false);
  });

  it("stops the failure storm when the last next-page fetch errored", () => {
    expect(
      shouldFetchNextInfinitePage({
        isIntersecting: true,
        hasNextPage: true,
        isFetchingNextPage: false,
        isFetchNextPageError: true,
      }),
    ).toBe(false);
  });

  it("does not fetch when there is no next page", () => {
    expect(
      shouldFetchNextInfinitePage({
        isIntersecting: true,
        hasNextPage: false,
        isFetchingNextPage: false,
        isFetchNextPageError: false,
      }),
    ).toBe(false);
  });
});
