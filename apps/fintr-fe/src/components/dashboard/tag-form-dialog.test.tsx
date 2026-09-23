import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";

import TagFormDialog from "./tag-form-dialog";
import { tagStylePresetSrc } from "@/lib/tags/preset-style-images";

const proAccess = vi.hoisted(() => ({
  pro: true,
}));

vi.mock("@/hooks/async/useProAccess", () => ({
  useProAccess: () => ({
    data: {
      pro: proAccess.pro,
      source: proAccess.pro ? "trial" : "none",
      trialDaysRemaining: proAccess.pro ? 7 : 0,
    },
    isPending: false,
  }),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe("TagFormDialog — create", () => {
  beforeEach(() => {
    proAccess.pro = true;
  });

  it("shows the sample style picker before the tag exists", () => {
    render(
      <TagFormDialog
        trigger={<span />}
        open
        onOpenChange={vi.fn()}
        onAdd={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /use japan vacation sample/i }),
    ).toBeInTheDocument();
  });

  it("previews a sample locally instead of assigning it immediately", async () => {
    const user = userEvent.setup();
    const onAssignStyleImage = vi.fn();

    render(
      <TagFormDialog
        trigger={<span />}
        open
        onOpenChange={vi.fn()}
        onAdd={vi.fn()}
        onAssignStyleImage={onAssignStyleImage}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /use japan vacation sample/i }),
    );

    expect(onAssignStyleImage).not.toHaveBeenCalled();
    expect(
      screen.getByLabelText(/tag name style preview/i).querySelector("img"),
    ).toHaveAttribute("src", tagStylePresetSrc("japan-vacation"));
  });

  it("creates the tag with the selected sample", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockResolvedValue(undefined);

    render(
      <TagFormDialog
        trigger={<span />}
        open
        onOpenChange={vi.fn()}
        onAdd={onAdd}
      />,
    );

    await user.type(screen.getByLabelText(/^name$/i), "Japan 2026");
    await user.click(
      screen.getByRole("button", { name: /use japan vacation sample/i }),
    );
    await user.click(screen.getByRole("button", { name: /^create tag$/i }));

    expect(onAdd).toHaveBeenCalledWith(
      "Japan 2026",
      expect.any(String),
      "japan-vacation",
    );
  });

  it("points people to Settings when tag images need Fintr Pro", () => {
    proAccess.pro = false;

    render(
      <TagFormDialog
        trigger={<span />}
        open
        onOpenChange={vi.fn()}
        onAdd={vi.fn()}
      />,
    );

    expect(screen.getByRole("link", { name: "Get Fintr Pro" })).toHaveAttribute(
      "href",
      "/dashboard/settings",
    );
    expect(
      screen.queryByRole("button", { name: /use japan vacation sample/i }),
    ).not.toBeInTheDocument();
  });
});
