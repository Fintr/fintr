import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Tabs, TabsList, TabsTrigger } from "./tabs";

describe("TabsList", () => {
  it("keeps the first tab reachable when the list overflows and scrolls", () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
        </TabsList>
      </Tabs>,
    );

    const list = screen.getByRole("tablist");
    expect(list.className).toContain("justify-center-safe");
    expect(list.className.split(" ")).not.toContain("justify-center");
  });
});
