import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/image", () => ({
  default: (props: { alt?: string }) => <img alt={props.alt ?? ""} />,
}));

const emblaApi = {
  selectedScrollSnap: () => 0,
  scrollSnapList: () => [0, 1, 2],
  scrollTo: vi.fn(),
  on: vi.fn(),
};

vi.mock("embla-carousel-react", () => ({
  default: () => [() => undefined, emblaApi],
}));

vi.mock("embla-carousel-autoplay", () => ({
  default: () => ({}),
}));

import AppCarouselSection from "./app-carousel-section";

describe("AppCarouselSection", () => {
  it("keeps the app preview screenshots mounted for interaction", () => {
    const { rerender } = render(<AppCarouselSection />);

    expect(
      screen.getByRole("heading", { name: "See Fintr in Action" }),
    ).toBeInTheDocument();
    expect(
      screen.getByAltText("Track expenses easily with Fintr"),
    ).toBeInTheDocument();

    rerender(<AppCarouselSection />);

    expect(
      screen.getByRole("button", { name: "Go to slide 1" }),
    ).toBeEnabled();
  });
});
