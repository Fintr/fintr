import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FilterOptionPills } from "./filter-option-pills";

const options = [
  { value: "all", label: "All" },
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
];

const renderPills = (
  onChange: (value: string) => void,
  scrollable = true,
) => {
  render(
    <FilterOptionPills
      options={options}
      value="all"
      onChange={onChange}
      ariaLabel="Filter transactions by type"
      scrollable={scrollable}
    />,
  );

  return screen.getByRole("radio", { name: "Expense" });
};

describe("FilterOptionPills", () => {
  afterEach(() => {
    cleanup();
  });

  it("selects a pill on the first touch when the finger stays put", () => {
    const onChange = vi.fn();
    const expense = renderPills(onChange);

    fireEvent.pointerDown(expense, {
      pointerType: "touch",
      clientX: 20,
      clientY: 16,
      button: 0,
    });
    fireEvent.pointerUp(expense, {
      pointerType: "touch",
      clientX: 22,
      clientY: 17,
      button: 0,
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("expense");
  });

  it("leaves the touch pointer free so iOS can deliver that first tap", () => {
    const onChange = vi.fn();
    const expense = renderPills(onChange);

    const touchAllowed = fireEvent.pointerDown(expense, {
      pointerType: "touch",
      clientX: 20,
      clientY: 16,
      button: 0,
      cancelable: true,
    });

    expect(touchAllowed).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not select a pill when the touch moves like a scroll", () => {
    const onChange = vi.fn();
    const expense = renderPills(onChange);

    fireEvent.pointerDown(expense, {
      pointerType: "touch",
      clientX: 10,
      clientY: 16,
      button: 0,
    });
    fireEvent.pointerUp(expense, {
      pointerType: "touch",
      clientX: 48,
      clientY: 16,
      button: 0,
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("still selects a pill from a mouse click", () => {
    const onChange = vi.fn();
    const expense = renderPills(onChange);

    fireEvent.pointerDown(expense, {
      pointerType: "mouse",
      clientX: 20,
      clientY: 16,
      button: 0,
      cancelable: true,
    });
    fireEvent.click(expense);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("expense");
  });

  it("keeps a mouse press from focusing a scrollable pill", () => {
    const onChange = vi.fn();
    const expense = renderPills(onChange);

    const mouseAllowed = fireEvent.pointerDown(expense, {
      pointerType: "mouse",
      clientX: 20,
      clientY: 16,
      button: 0,
      cancelable: true,
    });

    expect(mouseAllowed).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });
});
