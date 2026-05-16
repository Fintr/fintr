import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MarkdownContent } from "./markdown-content";

describe("MarkdownContent", () => {
  afterEach(() => {
    cleanup();
  });

  it("returns null when content is empty or whitespace only", () => {
    const { container: empty } = render(<MarkdownContent content="" />);
    expect(empty.firstChild).toBeNull();

    cleanup();

    const { container: spaces } = render(
      <MarkdownContent content={"   \n\t  "} />,
    );
    expect(spaces.firstChild).toBeNull();
  });

  it("renders bold text from markdown using a strong element", () => {
    render(<MarkdownContent content="Hello **world**" />);

    const strong = screen.getByText("world");
    expect(strong.tagName).toBe("STRONG");
    expect(strong).toHaveClass("font-semibold", "text-foreground");
  });

  it("renders GFM unordered lists with ul and li", () => {
    const markdown = [
      "- First item",
      "- Second item",
    ].join("\n");

    const { container } = render(<MarkdownContent content={markdown} />);

    const ul = container.querySelector("ul");
    expect(ul).toBeInTheDocument();
    expect(ul).toHaveClass("list-disc");

    const items = container.querySelectorAll("li");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("First item");
    expect(items[1]).toHaveTextContent("Second item");
  });

  it("applies text-sm on the wrapper and merges optional className (not on Markdown root)", () => {
    const { container } = render(
      <MarkdownContent
        content="Paragraph."
        className="text-primary"
      />,
    );

    const wrapper = container.firstElementChild;
    expect(wrapper?.tagName).toBe("DIV");
    expect(wrapper).toHaveClass("text-sm", "text-primary");

    expect(wrapper?.querySelector("p")).toHaveTextContent("Paragraph.");
  });

  it("does not render raw HTML from markdown as live elements", () => {
    const { container } = render(
      <MarkdownContent content='<script>document.body.dataset.x="1"</script>' />,
    );

    expect(container.querySelector("script")).toBeNull();
  });
});
